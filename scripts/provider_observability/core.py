from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
import uuid
from collections import Counter
from datetime import date, datetime
from pathlib import Path, PurePosixPath
from typing import Any
from zoneinfo import ZoneInfo

from jsonschema import Draft202012Validator, FormatChecker

from . import ELIGIBILITY_STATUSES, GATE_SCHEMA_VERSION, LEGACY_SCHEMA_VERSIONS, RUN_STATUSES, SCHEMA_VERSION
from .provenance import COHORT_FIELDS, recordable_provenance, unavailable_provenance, valid_provenance

SENSITIVE_KEY = re.compile(r"cookie|authorization|oauth|token|session|password|secret", re.I)
SENSITIVE_QUERY = re.compile(r"([?&](?:access_token|token|session|auth|key)=)[^&#\s]+", re.I)
BEARER = re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]+", re.I)
FAILURE_CATEGORIES = {
    "network_transient", "provider_unavailable", "timeout", "rate_limited", "authentication_unexpected",
    "schema_drift", "empty_response", "coverage_drop", "unexpected_removal", "unverifiable_removal",
    "window_anomaly", "data_value_drift", "manifest_mismatch", "checksum_mismatch", "atomicity_failure",
    "validation_failure", "audit_failure", "default_refresh_violation", "filesystem_failure", "timezone_failure",
    "provenance_unavailable", "unknown",
}
BLOCKING_FAILURES = {
    "schema_drift", "unexpected_removal", "unverifiable_removal", "window_anomaly", "data_value_drift",
    "manifest_mismatch", "checksum_mismatch", "atomicity_failure", "validation_failure", "audit_failure",
    "default_refresh_violation", "coverage_drop", "authentication_unexpected", "provenance_unavailable",
}
TRANSIENT_FAILURES = {"network_transient", "provider_unavailable", "timeout", "rate_limited"}
VOLATILE_KEYS = {"fetchedAt", "generatedAt", "lastSuccessfulFetchAt", "updatedAt"}
RESOLUTION_FILENAME = "provider-health-resolutions.jsonl"
PROVIDER_DOMAINS = {
    "a-share-financials": "financials",
    "a-share-announcements": "announcements",
}
RUN_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "config/provider-observation-run.schema.json"
RUN_SCHEMA_VALIDATOR = Draft202012Validator(
    json.loads(RUN_SCHEMA_PATH.read_text(encoding="utf-8")),
    format_checker=FormatChecker(),
)


class DirtyWorktreeError(ValueError):
    def __init__(self, paths: list[str]):
        super().__init__("dirty_worktree")
        self.paths = paths


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n").encode("utf-8")


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload); handle.flush(); os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name): os.unlink(temp_name)


def load_json(path: Path, fallback: Any = None) -> Any:
    if not path.exists(): return fallback
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


def _aware_datetime(value: Any, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"invalid {field}")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"invalid {field}") from exc
    if parsed.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    return parsed


def validate_run(record: dict[str, Any]) -> None:
    if not isinstance(record, dict):
        raise ValueError("run must be an object")
    required = {"schemaVersion", "runId", "providerId", "providerVersion", "domain", "startedAt", "endedAt", "timezone", "durationSeconds", "status", "exitCode", "metrics", "difference", "failures", "validation", "atomicity", "worktree", "artifacts"}
    missing = sorted(required - record.keys())
    if missing: raise ValueError(f"missing run fields: {', '.join(missing)}")
    if record["schemaVersion"] not in LEGACY_SCHEMA_VERSIONS | {SCHEMA_VERSION}: raise ValueError("schemaVersion mismatch")
    if record["providerId"] not in PROVIDER_DOMAINS: raise ValueError("invalid providerId")
    if record["domain"] != PROVIDER_DOMAINS[record["providerId"]]: raise ValueError("provider/domain mismatch")
    if record["status"] not in RUN_STATUSES: raise ValueError("invalid run status")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", str(record["runId"])): raise ValueError("unsafe runId")
    if not isinstance(record["providerVersion"], str) or not record["providerVersion"]: raise ValueError("invalid providerVersion")
    if record["timezone"] != "Asia/Shanghai": raise ValueError("invalid timezone")
    duration = record["durationSeconds"]
    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(float(duration)) or duration < 0: raise ValueError("invalid durationSeconds")
    started_at = _aware_datetime(record["startedAt"], "startedAt")
    ended_at = _aware_datetime(record["endedAt"], "endedAt")
    if ended_at < started_at: raise ValueError("endedAt precedes startedAt")
    if not isinstance(record["exitCode"], int) or isinstance(record["exitCode"], bool): raise ValueError("invalid exitCode")
    if not isinstance(record["failures"], list): raise ValueError("failures must be an array")
    for failure in record["failures"]:
        if (
            not isinstance(failure, dict)
            or failure.get("category") not in FAILURE_CATEGORIES
            or not isinstance(failure.get("message"), str)
            or not isinstance(failure.get("resolved"), bool)
        ):
            raise ValueError("invalid failure")
    if record["schemaVersion"] == SCHEMA_VERSION:
        schema_errors = sorted(RUN_SCHEMA_VALIDATOR.iter_errors(record), key=lambda error: list(error.absolute_path))
        if schema_errors:
            first = schema_errors[0]
            location = ".".join(str(part) for part in first.absolute_path) or "$"
            raise ValueError(f"V2 schema validation failed at {location}: {first.message}")
        provenance = record.get("provenance")
        required_provenance = {"sourceCommitSha", "observationToolVersion", "observationToolChecksum", *COHORT_FIELDS, "provenanceCohortId"}
        if not isinstance(provenance, dict) or required_provenance - provenance.keys(): raise ValueError("missing V2 provenance")
        if not isinstance(record.get("metrics", {}).get("eligibleSample"), bool): raise ValueError("eligibleSample is required")
        if not recordable_provenance(provenance): raise ValueError("invalid V2 provenance")
        if unavailable_provenance(provenance):
            provenance_failures = [
                failure for failure in record["failures"]
                if failure.get("category") == "provenance_unavailable"
                and failure.get("resolved") is False
                and isinstance(failure.get("message"), str)
                and failure["message"].strip()
            ]
            if record["metrics"]["eligibleSample"] is not False:
                raise ValueError("unavailable provenance must be ineligible")
            if record["status"] == "success":
                raise ValueError("unavailable provenance cannot be successful")
            if not provenance_failures:
                raise ValueError("unavailable provenance requires an unresolved provenance_unavailable failure")
        atomicity = record.get("atomicity", {})
        if not all(isinstance(atomicity.get(field), str) and re.fullmatch(r"[a-f0-9]{64}", atomicity[field]) for field in ("beforeChecksum", "afterChecksum")): raise ValueError("invalid atomicity checksums")
        if any(re.match(r"^[A-Za-z]:[\\/]", str(item)) or str(item).startswith(("/", "\\")) for item in record.get("command", [])): raise ValueError("absolute command path is forbidden")
    if contains_sensitive(record): raise ValueError("sensitive field detected")


def append_run(root: Path, record: dict[str, Any]) -> None:
    validate_run(record)
    if record["schemaVersion"] != SCHEMA_VERSION: raise ValueError("only V2 runs may be appended")
    run_path = root / "runs" / f"{record['runId']}.json"
    if run_path.exists(): raise ValueError(f"duplicate runId: {record['runId']}")
    atomic_write(run_path, json_bytes(record))
    runs = load_runs(root)
    ledger = b"".join(json.dumps(run, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8") + b"\n" for run in runs)
    atomic_write(root / "provider-health-ledger.jsonl", ledger)


def load_runs(root: Path) -> list[dict[str, Any]]:
    runs: list[dict[str, Any]] = []
    if (root / "runs").exists():
        for path in sorted((root / "runs").glob("*.json")):
            try:
                value = load_json(path)
                if not isinstance(value, dict):
                    raise ValueError("run file must contain an object")
                runs.append(value)
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                runs.append({
                    "runId": f"invalid-run-file-{path.stem}",
                    "_sourceFile": path.name,
                    "_loadError": str(exc),
                })
    return sorted(runs, key=lambda item: (item.get("startedAt", ""), item.get("runId", "")))


def load_resolutions(root: Path) -> list[dict[str, Any]]:
    path = root / RESOLUTION_FILENAME
    if not path.exists(): return []
    resolutions: list[dict[str, Any]] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        return [{"resolutionId": "invalid-resolution-ledger", "_loadError": str(exc)}]
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
            if not isinstance(value, dict):
                raise ValueError("resolution row must contain an object")
            resolutions.append(value)
        except (ValueError, json.JSONDecodeError) as exc:
            resolutions.append({
                "resolutionId": f"invalid-resolution-line-{line_number}",
                "_lineNumber": line_number,
                "_loadError": str(exc),
            })
    return resolutions


def validate_resolution(
    resolution: dict[str, Any],
    runs: list[dict[str, Any]],
    invalid_run_ids: set[str] | None = None,
) -> None:
    if not isinstance(resolution, dict):
        raise ValueError("resolution must be an object")
    required = {"schemaVersion", "resolutionId", "providerId", "runId", "failureIndex", "category", "resolvedAt", "reason", "evidence", "resolvedBy"}
    missing = sorted(required - resolution.keys())
    if missing: raise ValueError(f"resolution missing required fields: {', '.join(missing)}")
    if resolution["schemaVersion"] != SCHEMA_VERSION: raise ValueError("resolution schemaVersion mismatch")
    if not isinstance(resolution["resolutionId"], str) or not re.fullmatch(r"[A-Za-z0-9._-]+", resolution["resolutionId"]): raise ValueError("invalid resolutionId")
    if resolution["providerId"] not in PROVIDER_DOMAINS: raise ValueError("invalid resolution providerId")
    _aware_datetime(resolution["resolvedAt"], "resolvedAt")
    for field in ("reason", "evidence", "resolvedBy"):
        if not isinstance(resolution[field], str) or not resolution[field].strip():
            raise ValueError(f"resolution {field} is required")
    if contains_sensitive(resolution): raise ValueError("sensitive resolution content")

    by_id = {run.get("runId"): run for run in runs if isinstance(run, dict)}
    source = by_id.get(resolution["runId"])
    if not source: raise ValueError("resolution references unknown run")
    validate_run(source)
    if invalid_run_ids and source.get("runId") in invalid_run_ids:
        raise ValueError("resolution references an invalid run")
    index = resolution["failureIndex"]
    if isinstance(index, bool) or not isinstance(index, int) or index < 0 or index >= len(source.get("failures", [])):
        raise ValueError("resolution references unknown failure")
    source_failure = source["failures"][index]
    if resolution["providerId"] != source["providerId"] or resolution["category"] != source_failure.get("category"):
        raise ValueError("resolution category/provider mismatch")

    replacement_id = resolution.get("replacementRunId")
    if not replacement_id:
        return
    if not isinstance(replacement_id, str) or not re.fullmatch(r"[A-Za-z0-9._-]+", replacement_id):
        raise ValueError("invalid replacementRunId")
    replacement = by_id.get(replacement_id)
    if not replacement: raise ValueError("resolution references unknown replacement run")
    validate_run(replacement)
    if invalid_run_ids and replacement_id in invalid_run_ids:
        raise ValueError("replacement run is invalid")
    if source.get("schemaVersion") != SCHEMA_VERSION or replacement.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError("replacement resolution requires V2 runs")
    if replacement.get("providerId") != source.get("providerId"):
        raise ValueError("replacement run provider mismatch")
    source_provenance = source.get("provenance")
    replacement_provenance = replacement.get("provenance")
    if (
        not valid_provenance(source_provenance)
        or not valid_provenance(replacement_provenance)
        or replacement_provenance["provenanceCohortId"] != source_provenance["provenanceCohortId"]
    ):
        raise ValueError("replacement run must use the same valid V2 provenance cohort")
    if _aware_datetime(replacement["startedAt"], "replacement.startedAt") <= _aware_datetime(source["startedAt"], "source.startedAt"):
        raise ValueError("replacement run must be strictly later")
    replacement_failures = [
        {**failure, "runId": replacement_id, "failureIndex": index, "effectiveResolved": False}
        for index, failure in enumerate(replacement.get("failures", []))
    ]
    if (
        replacement.get("status") != "success"
        or replacement.get("metrics", {}).get("eligibleSample") is not True
        or replacement.get("validation", {}).get("passed") is not True
        or replacement.get("exitCode") != 0
        or not usable_run(replacement, replacement_failures)
    ):
        raise ValueError("replacement run must be eligible, complete, and usable")


def audit_resolution_ledger(
    resolutions: list[dict[str, Any]],
    runs: list[dict[str, Any]],
    invalid_run_ids: set[str] | None = None,
) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []
    invalid_indexes: set[int] = set()
    identities: dict[str, list[int]] = {}
    failure_keys: dict[tuple[str, int], list[int]] = {}
    for index, resolution in enumerate(resolutions):
        resolution_id = str(resolution.get("resolutionId", f"invalid-resolution-{index}")) if isinstance(resolution, dict) else f"invalid-resolution-{index}"
        identities.setdefault(resolution_id, []).append(index)
        try:
            validate_resolution(resolution, runs, invalid_run_ids)
        except (TypeError, ValueError, KeyError) as exc:
            invalid_indexes.add(index)
            issues.append({"resolutionId": resolution_id, "category": "resolution_invalid", "message": str(exc)})
            continue
        failure_keys.setdefault((resolution["runId"], resolution["failureIndex"]), []).append(index)
    for resolution_id, indexes in identities.items():
        if len(indexes) > 1:
            invalid_indexes.update(indexes)
            issues.append({"resolutionId": resolution_id, "category": "resolution_duplicate", "message": "duplicate resolutionId"})
    for (run_id, failure_index), indexes in failure_keys.items():
        if len(indexes) > 1:
            invalid_indexes.update(indexes)
            issues.append({
                "resolutionId": "*",
                "category": "resolution_conflict",
                "message": f"multiple resolutions target {run_id} failure {failure_index}",
            })
    valid_resolutions = [resolution for index, resolution in enumerate(resolutions) if index not in invalid_indexes]
    rejected_ids = list(dict.fromkeys(
        str(resolution.get("resolutionId", f"invalid-resolution-{index}"))
        if isinstance(resolution, dict)
        else f"invalid-resolution-{index}"
        for index, resolution in enumerate(resolutions)
        if index in invalid_indexes
    ))
    return {
        "rowCount": len(resolutions),
        "compatibleCount": len(valid_resolutions),
        "rejectedCount": len(invalid_indexes),
        "rejectedResolutionIds": rejected_ids,
        "issueCount": len(issues),
        "issues": issues,
        "integrityFailure": bool(issues),
        "validResolutions": valid_resolutions,
    }


def append_resolution(root: Path, resolution: dict[str, Any], runs: list[dict[str, Any]] | None = None) -> None:
    runs = runs if runs is not None else load_runs(root)
    existing = load_resolutions(root)
    clean = redact(resolution)
    audit = audit_resolution_ledger(existing + [clean], runs)
    if audit["integrityFailure"]:
        raise ValueError(audit["issues"][-1]["message"])
    payload = existing + [clean]
    atomic_write(root / RESOLUTION_FILENAME, b"".join(json.dumps(item, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8") + b"\n" for item in payload))


def make_resolution(provider_id: str, run_id: str, failure_index: int, category: str, reason: str, evidence: str, resolved_by: str, replacement_run_id: str | None = None) -> dict[str, Any]:
    value = {"schemaVersion": SCHEMA_VERSION, "resolutionId": f"resolution-{uuid.uuid4().hex}", "providerId": provider_id, "runId": run_id, "failureIndex": failure_index, "category": category, "resolvedAt": datetime.now().astimezone().isoformat(), "reason": reason, "evidence": evidence, "resolvedBy": resolved_by}
    if replacement_run_id: value["replacementRunId"] = replacement_run_id
    return value


def redact(value: Any) -> Any:
    if isinstance(value, dict): return {key: "[REDACTED]" if SENSITIVE_KEY.search(str(key)) else redact(child) for key, child in value.items()}
    if isinstance(value, list): return [redact(child) for child in value]
    if isinstance(value, str): return BEARER.sub("Bearer [REDACTED]", SENSITIVE_QUERY.sub(r"\1[REDACTED]", value))
    return value


def contains_sensitive(value: Any) -> bool:
    if isinstance(value, dict): return any((SENSITIVE_KEY.search(str(key)) and child != "[REDACTED]") or contains_sensitive(child) for key, child in value.items())
    if isinstance(value, list): return any(contains_sensitive(child) for child in value)
    if isinstance(value, str): return bool(BEARER.search(value) or re.search(r"[?&](?:access_token|token|session|auth|key)=(?!\[REDACTED\])[^&#\s]+", value, re.I))
    return False


def classify_failure(message: str, status_code: int | None = None) -> str:
    text = message.lower()
    if status_code in {401, 403} or "unauthorized" in text: return "authentication_unexpected"
    if status_code == 429 or "rate limit" in text: return "rate_limited"
    if "timeout" in text or "timed out" in text: return "timeout"
    if "schema" in text or "missing result.data" in text: return "schema_drift"
    if "empty" in text: return "empty_response"
    if status_code and status_code >= 500: return "provider_unavailable"
    if any(term in text for term in ("connection", "dns", "network", "reset")): return "network_transient"
    return "unknown"


def dirty_paths(status_text: str) -> list[str]:
    return [line[3:] if len(line) > 3 else line for line in status_text.splitlines() if line.strip()]


def observation_eligibility(status_text: str, allow_dirty_debug: bool) -> bool:
    raw_lines = [line for line in status_text.splitlines() if line.strip()]
    disallowed_lines = [line for line in raw_lines if line != "?? AGENTS.md"]
    if disallowed_lines and not allow_dirty_debug: raise DirtyWorktreeError(disallowed_lines)
    return not allow_dirty_debug


def stable(value: Any) -> Any:
    if isinstance(value, dict): return {key: stable(child) for key, child in sorted(value.items()) if key not in VOLATILE_KEYS}
    if isinstance(value, list): return [stable(child) for child in value]
    return value


def values_equal(left: Any, right: Any) -> bool:
    if isinstance(left, (int, float)) and isinstance(right, (int, float)) and not isinstance(left, bool) and not isinstance(right, bool):
        return math.isfinite(float(left)) and math.isfinite(float(right)) and float(left) == float(right)
    return stable(left) == stable(right)


def financial_diff(current: dict[str, Any], previous: dict[str, Any] | None, current_run_id: str | None = None, previous_run_id: str | None = None) -> dict[str, Any]:
    if previous is None: return {"baseline": True, "changedCompanies": 0, "valueDrifts": []}
    current_items, previous_items = current.get("items", {}), previous.get("items", {})
    drifts: list[dict[str, Any]] = []; changed: list[str] = []
    fields = {
        "latestSingleQuarter": ("operatingRevenue", "netProfitAttributableToParent", "netProfitExcludingNonRecurring", "netOperatingCashFlow"),
        "latestBalanceSheet": ("accountsReceivable", "inventory"),
        "latestRatios": ("grossMargin", "netMargin", "debtToAssetRatio", "researchExpenseRatio"),
    }
    for stock_id in sorted(set(current_items) | set(previous_items)):
        before, after = previous_items.get(stock_id), current_items.get(stock_id)
        if stable(before) != stable(after): changed.append(stock_id)
        if not before or not after or before.get("latestReportPeriod") != after.get("latestReportPeriod"): continue
        period = after.get("latestReportPeriod")
        for group, names in fields.items():
            for name in names:
                old, new = (before.get(group) or {}).get(name), (after.get(group) or {}).get(name)
                if not values_equal(old, new):
                    drifts.append({"stockId": stock_id, "reportPeriod": period, "field": f"{group}.{name}", "previousValue": old, "currentValue": new, "previousRunId": previous_run_id, "currentRunId": current_run_id})
    return {"baseline": False, "addedCompanies": sorted(set(current_items) - set(previous_items)), "removedCompanies": sorted(set(previous_items) - set(current_items)), "changedCompanies": len(changed), "valueDrifts": drifts}


def _parse_date(value: Any) -> date | None:
    try: return date.fromisoformat(str(value))
    except (TypeError, ValueError): return None


def announcement_diff(current_details: dict[str, dict[str, Any]], previous_details: dict[str, dict[str, Any]] | None, current_window: dict[str, Any] | None = None, previous_window: dict[str, Any] | None = None) -> dict[str, Any]:
    base = {"baseline": previous_details is None, "added": 0, "modified": 0, "expectedExpired": 0, "unexpectedRemoved": 0, "unverifiableRemoved": 0, "addedIds": [], "modifiedIds": [], "expectedExpiredIds": [], "unexpectedRemovedIds": [], "unverifiableRemovedIds": [], "currentWindowStart": (current_window or {}).get("start"), "currentWindowEnd": (current_window or {}).get("end"), "previousWindowStart": (previous_window or {}).get("start"), "previousWindowEnd": (previous_window or {}).get("end"), "overlapStart": None, "overlapEnd": None, "windowShiftDays": None, "windowRisks": []}
    if previous_details is None: return base
    def index(details: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
        return {str(item["announcementId"]): item for detail in details.values() for item in detail.get("announcements", []) if item.get("announcementId")}
    now_index, before_index = index(current_details), index(previous_details)
    now, before = set(now_index), set(before_index)
    added = sorted(now - before); removed = sorted(before - now)
    signature = lambda item: (item.get("title"), item.get("category"), item.get("announcementDate"), item.get("officialUrl"), item.get("pdfUrl"))
    modified = sorted(item_id for item_id in now & before if signature(now_index[item_id]) != signature(before_index[item_id]))
    cs, ce = _parse_date((current_window or {}).get("start")), _parse_date((current_window or {}).get("end"))
    ps, pe = _parse_date((previous_window or {}).get("start")), _parse_date((previous_window or {}).get("end"))
    valid = all((cs, ce, ps, pe)) and cs <= ce and ps <= pe
    risks: list[str] = []
    if not valid: risks.append("missing_or_invalid_window")
    else:
        base["windowShiftDays"] = (cs - ps).days
        overlap_start, overlap_end = max(cs, ps), min(ce, pe)
        base["overlapStart"], base["overlapEnd"] = overlap_start.isoformat(), overlap_end.isoformat()
        if cs < ps: risks.append("window_start_moved_backward")
        if ce < pe: risks.append("window_end_moved_backward")
        if (ce - cs).days < (pe - ps).days: risks.append("current_window_shortened")
        if overlap_start > overlap_end: risks.append("windows_do_not_overlap")
    expected: list[str] = []; unexpected: list[str] = []; unverifiable: list[str] = []
    for item_id in removed:
        item_date = _parse_date(before_index[item_id].get("announcementDate"))
        if not valid or risks or item_date is None:
            unverifiable.append(item_id)
        elif ps <= item_date <= pe and item_date < cs:
            expected.append(item_id)
        elif max(cs, ps) <= item_date <= min(ce, pe):
            unexpected.append(item_id)
        else:
            unverifiable.append(item_id)
    base.update({"added": len(added), "modified": len(modified), "expectedExpired": len(expected), "unexpectedRemoved": len(unexpected), "unverifiableRemoved": len(unverifiable), "addedIds": added, "modifiedIds": modified, "expectedExpiredIds": expected, "unexpectedRemovedIds": unexpected, "unverifiableRemovedIds": unverifiable, "windowRisks": risks})
    return base


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_digest(paths: list[Path], relative_to: Path) -> str:
    root = relative_to.resolve(); digest = hashlib.sha256(); files: list[Path] = []
    for item in paths:
        item = item.resolve()
        if root != item and root not in item.parents: raise ValueError("digest path outside logical root")
        files.extend(path for path in item.rglob("*") if path.is_file()) if item.is_dir() else files.append(item)
    entries = sorted((PurePosixPath(path.relative_to(root).as_posix()).as_posix(), path) for path in files if path.is_file())
    for relative, path in entries:
        digest.update(relative.encode("utf-8")); digest.update(b"\0"); digest.update(path.read_bytes()); digest.update(b"\0")
    return digest.hexdigest()


def audit_observation_ledger(root: Path, runs: list[dict[str, Any]]) -> dict[str, Any]:
    issues: list[dict[str, str]] = []
    invalid_run_ids: set[str] = set()
    invalid_v2_run_ids: set[str] = set()
    invalid_legacy_run_ids: set[str] = set()
    unclassifiable_run_ids: set[str] = set()
    validated_run_ids: set[str] = set()
    ledger_path = root / "provider-health-ledger.jsonl"
    ledger_rows: list[dict[str, Any]] = []

    def identity(value: Any, fallback: str) -> str:
        if isinstance(value, dict) and isinstance(value.get("runId"), str):
            return value["runId"]
        return fallback

    def classify_invalid(value: Any, run_id: str) -> None:
        invalid_run_ids.add(run_id)
        schema_version = value.get("schemaVersion") if isinstance(value, dict) else None
        if schema_version == SCHEMA_VERSION:
            invalid_v2_run_ids.add(run_id)
        elif schema_version in LEGACY_SCHEMA_VERSIONS:
            invalid_legacy_run_ids.add(run_id)
        else:
            unclassifiable_run_ids.add(run_id)

    def add_issue(value: Any, run_id: str, category: str, message: str) -> None:
        issues.append({"runId": run_id, "category": category, "message": message})
        classify_invalid(value, run_id)

    if ledger_path.exists():
        try:
            ledger_lines = ledger_path.read_text(encoding="utf-8").splitlines()
            for line_number, line in enumerate(ledger_lines, start=1):
                if not line.strip():
                    continue
                try:
                    row = json.loads(line)
                    if not isinstance(row, dict):
                        raise ValueError("ledger row must contain an object")
                    ledger_rows.append(row)
                except (ValueError, json.JSONDecodeError) as exc:
                    run_id = f"invalid-ledger-line-{line_number}"
                    add_issue(None, run_id, "ledger_invalid", str(exc))
        except OSError as exc:
            add_issue(None, "invalid-ledger-file", "ledger_invalid", str(exc))
    elif runs:
        for index, run in enumerate(runs):
            run_id = identity(run, f"invalid-run-{index}")
            add_issue(run, run_id, "ledger_missing", "provider-health-ledger.jsonl is missing")

    run_rows_by_id: dict[str, list[dict[str, Any]]] = {}
    for index, run in enumerate(runs):
        run_id = identity(run, f"invalid-run-{index}")
        run_rows_by_id.setdefault(run_id, []).append(run)
        try:
            validate_run(run)
            validated_run_ids.add(run_id)
        except (TypeError, ValueError, KeyError) as exc:
            add_issue(run, run_id, "run_validation_error", str(exc))

    ledger_rows_by_id: dict[str, list[dict[str, Any]]] = {}
    for index, row in enumerate(ledger_rows):
        run_id = identity(row, f"invalid-ledger-row-{index}")
        ledger_rows_by_id.setdefault(run_id, []).append(row)
        try:
            validate_run(row)
        except (TypeError, ValueError, KeyError) as exc:
            add_issue(row, run_id, "ledger_row_validation_error", str(exc))

    for run_id, rows in run_rows_by_id.items():
        if len(rows) > 1:
            for row in rows:
                classify_invalid(row, run_id)
            issues.append({"runId": run_id, "category": "run_duplicate", "message": "duplicate runId in run files"})
    for run_id, rows in ledger_rows_by_id.items():
        if len(rows) > 1:
            for row in rows:
                classify_invalid(row, run_id)
            issues.append({"runId": run_id, "category": "ledger_duplicate", "message": "duplicate runId in ledger"})

    run_ids = set(run_rows_by_id)
    for index, run in enumerate(runs):
        run_id = identity(run, f"invalid-run-{index}")
        ledger_matches = ledger_rows_by_id.get(run_id, [])
        if len(ledger_matches) != 1 or ledger_matches[0] != run:
            add_issue(run, run_id, "ledger_mismatch", "run file and ledger row differ")
        if run_id not in validated_run_ids:
            continue
        generated_relative = run.get("artifacts", {}).get("generatedRoot")
        if not isinstance(generated_relative, str):
            add_issue(run, run_id, "artifact_path_missing", "generatedRoot is missing")
            continue
        generated_root = (root / generated_relative).resolve()
        observation_root = root.resolve()
        if observation_root != generated_root and observation_root not in generated_root.parents:
            add_issue(run, run_id, "artifact_path_escape", "generatedRoot escapes observation root")
            continue
        try:
            actual_artifact = tree_digest([generated_root], generated_root)
            expected_artifact = run.get("metrics", {}).get("artifactChecksum")
            if actual_artifact != expected_artifact:
                add_issue(run, run_id, "artifact_checksum_mismatch", "isolated artifact checksum differs from run record")
            detail_name = "a-share-financials" if run.get("providerId") == "a-share-financials" else "a-share-announcements"
            manifest_path = generated_root / detail_name / "manifest.generated.json"
            actual_manifest = file_digest(manifest_path)
            expected_manifest = run.get("metrics", {}).get("manifestChecksum")
            if actual_manifest != expected_manifest:
                add_issue(run, run_id, "manifest_checksum_mismatch", "isolated manifest checksum differs from run record")
        except (OSError, ValueError) as exc:
            add_issue(run, run_id, "artifact_unreadable", str(exc))
    for run_id in sorted(set(ledger_rows_by_id) - run_ids):
        for row in ledger_rows_by_id[run_id]:
            add_issue(row, run_id, "orphan_ledger_row", "ledger row has no run file")

    v2_integrity_failure = bool(invalid_v2_run_ids or unclassifiable_run_ids)
    return {
        "runFileCount": len(runs),
        "ledgerRowCount": len(ledger_rows),
        "issueCount": len(issues),
        "issues": issues,
        "invalidRunIds": sorted(invalid_run_ids),
        "invalidV2RunIds": sorted(invalid_v2_run_ids),
        "invalidLegacyRunIds": sorted(invalid_legacy_run_ids),
        "unclassifiableRunIds": sorted(unclassifiable_run_ids),
        "runValidationIssueCount": sum(issue["category"] == "run_validation_error" for issue in issues),
        "legacyValidationIssueCount": sum(
            issue["runId"] in invalid_legacy_run_ids for issue in issues
        ),
        "v2IntegrityFailure": v2_integrity_failure,
    }


def percentile(values: list[float], ratio: float) -> float | None:
    if not values: return None
    ordered = sorted(values); index = max(0, min(len(ordered) - 1, int((len(ordered) - 1) * ratio + 0.999999)))
    return round(ordered[index], 3)


def _resolved_keys(resolutions: list[dict[str, Any]]) -> set[tuple[str, int]]:
    return {(item["runId"], item["failureIndex"]) for item in resolutions}


def effective_failure_rows(runs: list[dict[str, Any]], resolutions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    resolved = _resolved_keys(resolutions); rows = []
    latest_success = {provider: max((run.get("startedAt", "") for run in runs if run.get("providerId") == provider and run.get("status") == "success"), default="") for provider in {run.get("providerId") for run in runs}}
    for run in runs:
        for index, failure in enumerate(run.get("failures", [])):
            explicitly_resolved = (run["runId"], index) in resolved
            transient_recovered = failure.get("category") in TRANSIENT_FAILURES and latest_success.get(run.get("providerId"), "") > run.get("startedAt", "")
            rows.append({**failure, "runId": run["runId"], "failureIndex": index, "effectiveResolved": explicitly_resolved or transient_recovered})
    return rows


def usable_run(run: dict[str, Any], unresolved_for_run: list[dict[str, Any]]) -> bool:
    metrics = run.get("metrics", {})
    return run.get("status") in {"success", "partial"} and metrics.get("companyCoverage") == metrics.get("expectedCompanies") and metrics.get("structuralValidationRate") == 1 and run.get("atomicity", {}).get("productionUnchanged") is True and not any(row.get("category") in BLOCKING_FAILURES for row in unresolved_for_run)


def summarize_provider(runs: list[dict[str, Any]], timezone_name: str, resolutions: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    resolutions = resolutions or []; tz = ZoneInfo(timezone_name); effective = effective_failure_rows(runs, resolutions)
    unresolved = [row for row in effective if not row["effectiveResolved"]]
    complete = [run for run in runs if run.get("status") == "success" and not any(row["runId"] == run["runId"] for row in unresolved)]
    usable = [run for run in runs if usable_run(run, [row for row in unresolved if row["runId"] == run["runId"]])]
    days = {datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00")).astimezone(tz).date().isoformat() for run in runs}
    success_days = {datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00")).astimezone(tz).date().isoformat() for run in usable}
    durations = [float(run["durationSeconds"]) for run in runs]; streak = 0
    for run in reversed(runs):
        if run not in complete: break
        streak += 1
    failures = Counter(row["category"] for row in effective)
    total = len(runs)
    return {"totalRuns": total, "runs": total, "successRuns": sum(run.get("status") == "success" for run in runs), "partialRuns": sum(run.get("status") == "partial" for run in runs), "failedRuns": sum(run.get("status") == "failed" for run in runs), "completeSuccessRuns": len(complete), "usableRuns": len(usable), "distinctDays": len(days), "successfulDays": len(success_days), "completeSuccessRate": len(complete) / total if total else 0, "totalSuccessRate": len(usable) / total if total else 0, "expectedWindowExpiryCount": sum(run.get("metrics", {}).get("expectedWindowExpiryCount", 0) or 0 for run in runs), "unexpectedRemovalCount": sum(run.get("metrics", {}).get("unexpectedRemovalCount", 0) or 0 for run in runs), "unverifiableRemovalCount": sum(run.get("metrics", {}).get("unverifiableRemovalCount", 0) or 0 for run in runs), "latestWindowShiftDays": runs[-1].get("metrics", {}).get("windowShiftDays") if runs else None, "p50DurationSeconds": percentile(durations, .5), "p95DurationSeconds": percentile(durations, .95), "successStreak": streak, "latestStatus": runs[-1]["status"] if runs else None, "failureCounts": dict(sorted(failures.items()))}


def validate_config(config: dict[str, Any]) -> None:
    if config.get("schemaVersion") != GATE_SCHEMA_VERSION: raise ValueError("config schemaVersion mismatch")
    if not config.get("providers") or len(set(config["providers"])) != len(config["providers"]): raise ValueError("providers must be unique")
    ZoneInfo(config["timezone"])
    for key in ("minimumDistinctDays", "minimumRunsPerProvider", "minimumSuccessfulDaysPerProvider", "expectedCompanies"):
        if not isinstance(config.get(key), int) or config[key] <= 0: raise ValueError(f"invalid {key}")
    for key in ("minimumCompleteSuccessRate", "minimumTotalSuccessRate"):
        if not isinstance(config.get(key), (int, float)) or not 0 <= config[key] <= 1: raise ValueError(f"invalid {key}")


def _current_targets(runs: list[dict[str, Any]], provider_ids: list[str], supplied: dict[str, dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    if supplied is not None:
        return supplied
    targets: dict[str, dict[str, Any]] = {}
    for provider_id in provider_ids:
        candidates = [run.get("provenance") for run in runs if run.get("providerId") == provider_id and valid_provenance(run.get("provenance"))]
        if candidates:
            targets[provider_id] = candidates[-1]
    return targets


def _compatible_resolutions(
    resolutions: list[dict[str, Any]],
    runs: list[dict[str, Any]],
    eligible_run_ids: set[str],
    invalid_run_ids: set[str],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    audit = audit_resolution_ledger(resolutions, runs, invalid_run_ids)
    compatible = [
        resolution
        for resolution in audit["validResolutions"]
        if resolution["runId"] in eligible_run_ids
    ]
    return compatible, audit


def evaluate(
    runs: list[dict[str, Any]],
    config: dict[str, Any],
    production_validation: dict[str, Any] | None = None,
    resolutions: list[dict[str, Any]] | None = None,
    production_valid: bool | None = None,
    audit_errors: int = 0,
    current_provenance: dict[str, dict[str, Any]] | None = None,
    current_provenance_failures: dict[str, list[str]] | None = None,
    ledger_audit: dict[str, Any] | None = None,
) -> dict[str, Any]:
    validate_config(config); resolutions = resolutions or []; current_provenance_failures = current_provenance_failures or {}
    targets = _current_targets(runs, config["providers"], current_provenance)
    invalid_run_ids = set((ledger_audit or {}).get("invalidRunIds", []))
    invalid_v2_run_ids = set((ledger_audit or {}).get("invalidV2RunIds", []))
    grouped: dict[str, list[dict[str, Any]]] = {}
    inventory: dict[str, dict[str, Any]] = {}
    evidence_integrity_blocked = bool((ledger_audit or {}).get("v2IntegrityFailure"))
    for provider_id in config["providers"]:
        target = targets.get(provider_id)
        target_cohort = target.get("provenanceCohortId") if valid_provenance(target) else None
        buckets = {"current": [], "legacy": [], "incompatible": [], "debug": [], "provenanceUnavailable": []}
        for run in [item for item in runs if item.get("providerId") == provider_id]:
            if run.get("schemaVersion") in LEGACY_SCHEMA_VERSIONS:
                buckets["legacy"].append(run)
            elif (
                run.get("schemaVersion") != SCHEMA_VERSION
                or run.get("runId") in invalid_v2_run_ids
            ):
                buckets["incompatible"].append(run)
                evidence_integrity_blocked = True
            elif run.get("runId") in invalid_run_ids:
                buckets["incompatible"].append(run)
                evidence_integrity_blocked = True
            elif unavailable_provenance(run.get("provenance")):
                try:
                    validate_run(run)
                except (TypeError, ValueError, KeyError):
                    buckets["incompatible"].append(run)
                    evidence_integrity_blocked = True
                else:
                    buckets["provenanceUnavailable"].append(run)
            elif not valid_provenance(run.get("provenance")):
                buckets["incompatible"].append(run)
                evidence_integrity_blocked = True
            elif run.get("metrics", {}).get("eligibleSample") is False:
                buckets["debug"].append(run)
            elif not target_cohort or run.get("provenance", {}).get("provenanceCohortId") != target_cohort or run.get("provenance", {}).get("stockUniverseIdentityCount") != config["expectedCompanies"]:
                buckets["incompatible"].append(run)
            else:
                buckets["current"].append(run)
        grouped[provider_id] = buckets["current"]
        inventory[provider_id] = {
            "currentEligibleRuns": len(buckets["current"]),
            "legacyRuns": len(buckets["legacy"]),
            "incompatibleRuns": len(buckets["incompatible"]),
            "debugRuns": len(buckets["debug"]),
            "provenanceUnavailableRuns": len(buckets["provenanceUnavailable"]),
            "currentCohortId": target_cohort,
            "legacyRunIds": [run.get("runId") for run in buckets["legacy"]],
            "incompatibleRunIds": [run.get("runId") for run in buckets["incompatible"]],
            "debugRunIds": [run.get("runId") for run in buckets["debug"]],
            "provenanceUnavailableRunIds": [run.get("runId") for run in buckets["provenanceUnavailable"]],
        }
    eligible_runs = [run for provider_runs in grouped.values() for run in provider_runs]
    eligible_run_ids = {run["runId"] for run in eligible_runs}
    compatible_resolutions, resolution_audit = _compatible_resolutions(
        resolutions,
        runs,
        eligible_run_ids,
        invalid_run_ids,
    )
    providers = {
        provider: {
            **summarize_provider(items, config["timezone"], compatible_resolutions),
            "cohortAudit": inventory[provider],
        }
        for provider, items in grouped.items()
    }
    all_days = {datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00")).astimezone(ZoneInfo(config["timezone"])).date().isoformat() for run in eligible_runs}
    effective = effective_failure_rows(eligible_runs, compatible_resolutions)
    blocking = sorted({row["category"] for row in effective if not row["effectiveResolved"] and row["category"] in BLOCKING_FAILURES})
    if evidence_integrity_blocked and "checksum_mismatch" not in blocking:
        blocking.append("checksum_mismatch")
    if resolution_audit["integrityFailure"] and "resolution_integrity_failure" not in blocking:
        blocking.append("resolution_integrity_failure")
    if current_provenance_failures and "provenance_unavailable" not in blocking:
        blocking.append("provenance_unavailable")
    if production_validation is None:
        valid = True if production_valid is None else production_valid
        production_validation = {"passed": valid and audit_errors == 0, "financials": {"passed": valid, "errorCount": int(not valid), "errors": []}, "announcements": {"passed": valid, "errorCount": int(not valid), "errors": []}, "dataAudit": {"passed": audit_errors == 0, "exitCode": int(bool(audit_errors)), "p0": audit_errors, "errors": audit_errors}, "defaultRefresh": {"passed": True, "unqualifiedProvidersIncluded": []}}
    production_ok = bool(production_validation.get("passed"))
    unavailable = any(items and items[-1]["status"] == "failed" and any(failure.get("category") == "provider_unavailable" for failure in items[-1].get("failures", [])) for items in grouped.values())
    if not production_ok or blocking: status = "blocked"
    elif not eligible_runs or any(not grouped[p] for p in grouped): status = "insufficient_observation_window"
    elif unavailable: status = "provider_unavailable"
    elif len(all_days) < config["minimumDistinctDays"] or any(v["totalRuns"] < config["minimumRunsPerProvider"] or v["successfulDays"] < config["minimumSuccessfulDaysPerProvider"] for v in providers.values()): status = "observing" if len(all_days) >= 2 else "insufficient_observation_window"
    elif config.get("requireLatestSuccess") and any(v["latestStatus"] != "success" for v in providers.values()): status = "disqualified"
    elif all(v["totalSuccessRate"] >= config["minimumTotalSuccessRate"] and v["completeSuccessRate"] >= config["minimumCompleteSuccessRate"] for v in providers.values()): status = "qualified"
    elif all(v["totalSuccessRate"] >= config["minimumCompleteSuccessRate"] for v in providers.values()): status = "conditionally_qualified"
    else: status = "disqualified"
    assert status in ELIGIBILITY_STATUSES
    exit_code = 0 if status == "qualified" else 2 if status in {"insufficient_observation_window", "observing"} else 3 if status == "conditionally_qualified" else 1
    return {
        "schemaVersion": SCHEMA_VERSION,
        "gateConfigSchemaVersion": GATE_SCHEMA_VERSION,
        "status": status,
        "exitCode": exit_code,
        "observationDays": len(all_days),
        "providers": providers,
        "blockingFailures": sorted(blocking),
        "productionValidation": production_validation,
        "currentProvenance": targets,
        "currentProvenanceFailures": current_provenance_failures,
        "ledgerAudit": ledger_audit,
        "resolutionAudit": {
            "compatibleCount": len(compatible_resolutions),
            "validCount": len(resolution_audit["validResolutions"]),
            "rejectedCount": resolution_audit["rejectedCount"],
            "rejectedResolutionIds": resolution_audit["rejectedResolutionIds"],
            "issueCount": resolution_audit["issueCount"],
            "issues": resolution_audit["issues"],
            "integrityFailure": resolution_audit["integrityFailure"],
        },
        "resolutions": resolutions,
        "historicalFailures": effective,
    }
