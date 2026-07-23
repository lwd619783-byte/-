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

from . import ELIGIBILITY_STATUSES, GATE_SCHEMA_VERSION, LEGACY_SCHEMA_VERSIONS, RUN_STATUSES, SCHEMA_VERSION
from .provenance import COHORT_FIELDS, UNAVAILABLE, valid_provenance

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


def validate_run(record: dict[str, Any]) -> None:
    required = {"schemaVersion", "runId", "providerId", "providerVersion", "domain", "startedAt", "endedAt", "timezone", "durationSeconds", "status", "exitCode", "metrics", "difference", "failures", "validation", "atomicity", "worktree", "artifacts"}
    missing = sorted(required - record.keys())
    if missing: raise ValueError(f"missing run fields: {', '.join(missing)}")
    if record["schemaVersion"] not in LEGACY_SCHEMA_VERSIONS | {SCHEMA_VERSION}: raise ValueError("schemaVersion mismatch")
    if record["providerId"] not in {"a-share-financials", "a-share-announcements"}: raise ValueError("invalid providerId")
    if record["domain"] not in {"financials", "announcements"}: raise ValueError("invalid domain")
    if record["status"] not in RUN_STATUSES: raise ValueError("invalid run status")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", str(record["runId"])): raise ValueError("unsafe runId")
    if not isinstance(record["durationSeconds"], (int, float)) or record["durationSeconds"] < 0: raise ValueError("invalid durationSeconds")
    for field in ("startedAt", "endedAt"):
        datetime.fromisoformat(str(record[field]).replace("Z", "+00:00"))
    for failure in record["failures"]:
        if failure.get("category") not in FAILURE_CATEGORIES or not isinstance(failure.get("resolved", False), bool): raise ValueError("invalid failure")
    if record["schemaVersion"] == SCHEMA_VERSION:
        provenance = record.get("provenance")
        required_provenance = {"sourceCommitSha", "observationToolVersion", "observationToolChecksum", *COHORT_FIELDS, "provenanceCohortId"}
        if not isinstance(provenance, dict) or required_provenance - provenance.keys(): raise ValueError("missing V2 provenance")
        if not isinstance(record.get("metrics", {}).get("eligibleSample"), bool): raise ValueError("eligibleSample is required")
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
    runs = [load_json(path) for path in sorted((root / "runs").glob("*.json"))] if (root / "runs").exists() else []
    return sorted(runs, key=lambda item: (item.get("startedAt", ""), item.get("runId", "")))


def load_resolutions(root: Path) -> list[dict[str, Any]]:
    path = root / RESOLUTION_FILENAME
    if not path.exists(): return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def append_resolution(root: Path, resolution: dict[str, Any], runs: list[dict[str, Any]] | None = None) -> None:
    runs = runs if runs is not None else load_runs(root)
    required = {"schemaVersion", "resolutionId", "providerId", "runId", "failureIndex", "category", "resolvedAt", "reason", "evidence", "resolvedBy"}
    if required - resolution.keys(): raise ValueError("resolution missing required fields")
    if resolution["schemaVersion"] != SCHEMA_VERSION or not re.fullmatch(r"[A-Za-z0-9._-]+", str(resolution["resolutionId"])): raise ValueError("invalid resolution identity")
    existing = load_resolutions(root)
    if any(item["resolutionId"] == resolution["resolutionId"] for item in existing): raise ValueError("duplicate resolutionId")
    run = next((item for item in runs if item.get("runId") == resolution["runId"]), None)
    if not run: raise ValueError("resolution references unknown run")
    index = resolution["failureIndex"]
    if not isinstance(index, int) or index < 0 or index >= len(run.get("failures", [])): raise ValueError("resolution references unknown failure")
    failure = run["failures"][index]
    if resolution["providerId"] != run["providerId"] or resolution["category"] != failure.get("category"): raise ValueError("resolution category/provider mismatch")
    if not str(resolution["reason"]).strip() or not str(resolution["evidence"]).strip(): raise ValueError("resolution reason and evidence are required")
    if resolution.get("replacementRunId"):
        replacement = next((item for item in runs if item.get("runId") == resolution["replacementRunId"]), None)
        if not replacement: raise ValueError("resolution references unknown replacement run")
        source_cohort = run.get("provenance", {}).get("provenanceCohortId")
        replacement_cohort = replacement.get("provenance", {}).get("provenanceCohortId")
        if replacement.get("providerId") != run.get("providerId"): raise ValueError("replacement run provider mismatch")
        if run.get("schemaVersion") != SCHEMA_VERSION or replacement.get("schemaVersion") != SCHEMA_VERSION or source_cohort in {None, UNAVAILABLE} or replacement_cohort != source_cohort:
            raise ValueError("replacement run must use the same V2 provenance cohort")
    clean = redact(resolution)
    if contains_sensitive(clean): raise ValueError("sensitive resolution content")
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


def observation_eligibility(status_text: str, allow_dirty_debug: bool, allowed_paths: set[str] | None = None) -> bool:
    allowed_paths = {"AGENTS.md"} if allowed_paths is None else allowed_paths
    paths = [path for path in dirty_paths(status_text) if path.replace("\\", "/") not in allowed_paths]
    if paths and not allow_dirty_debug: raise DirtyWorktreeError(paths)
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
    ledger_path = root / "provider-health-ledger.jsonl"
    ledger_rows: list[dict[str, Any]] = []
    if ledger_path.exists():
        try:
            ledger_rows = [json.loads(line) for line in ledger_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        except (OSError, json.JSONDecodeError) as exc:
            issues.append({"runId": "*", "category": "ledger_invalid", "message": str(exc)})
    elif runs:
        issues.append({"runId": "*", "category": "ledger_missing", "message": "provider-health-ledger.jsonl is missing"})

    ledger_by_id = {row.get("runId"): row for row in ledger_rows}
    if len(ledger_by_id) != len(ledger_rows):
        issues.append({"runId": "*", "category": "ledger_duplicate", "message": "duplicate runId in ledger"})
    run_ids = {run.get("runId") for run in runs}
    for run in runs:
        run_id = str(run.get("runId"))
        if ledger_by_id.get(run_id) != run:
            issues.append({"runId": run_id, "category": "ledger_mismatch", "message": "run file and ledger row differ"})
            invalid_run_ids.add(run_id)
        generated_relative = run.get("artifacts", {}).get("generatedRoot")
        if not isinstance(generated_relative, str):
            issues.append({"runId": run_id, "category": "artifact_path_missing", "message": "generatedRoot is missing"})
            invalid_run_ids.add(run_id)
            continue
        generated_root = (root / generated_relative).resolve()
        observation_root = root.resolve()
        if observation_root != generated_root and observation_root not in generated_root.parents:
            issues.append({"runId": run_id, "category": "artifact_path_escape", "message": "generatedRoot escapes observation root"})
            invalid_run_ids.add(run_id)
            continue
        try:
            actual_artifact = tree_digest([generated_root], generated_root)
            expected_artifact = run.get("metrics", {}).get("artifactChecksum")
            if actual_artifact != expected_artifact:
                issues.append({"runId": run_id, "category": "artifact_checksum_mismatch", "message": "isolated artifact checksum differs from run record"})
                invalid_run_ids.add(run_id)
            detail_name = "a-share-financials" if run.get("providerId") == "a-share-financials" else "a-share-announcements"
            manifest_path = generated_root / detail_name / "manifest.generated.json"
            actual_manifest = file_digest(manifest_path)
            expected_manifest = run.get("metrics", {}).get("manifestChecksum")
            if actual_manifest != expected_manifest:
                issues.append({"runId": run_id, "category": "manifest_checksum_mismatch", "message": "isolated manifest checksum differs from run record"})
                invalid_run_ids.add(run_id)
        except (OSError, ValueError) as exc:
            issues.append({"runId": run_id, "category": "artifact_unreadable", "message": str(exc)})
            invalid_run_ids.add(run_id)
    for run_id in sorted(set(ledger_by_id) - run_ids):
        issues.append({"runId": str(run_id), "category": "orphan_ledger_row", "message": "ledger row has no run file"})
    return {
        "runFileCount": len(runs),
        "ledgerRowCount": len(ledger_rows),
        "issueCount": len(issues),
        "issues": issues,
        "invalidRunIds": sorted(invalid_run_ids),
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


def _compatible_resolutions(resolutions: list[dict[str, Any]], runs: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    by_id = {run.get("runId"): run for run in runs}
    compatible: list[dict[str, Any]] = []
    rejected: list[str] = []
    for resolution in resolutions:
        run = by_id.get(resolution.get("runId"))
        if not run:
            rejected.append(str(resolution.get("resolutionId")))
            continue
        replacement_id = resolution.get("replacementRunId")
        if replacement_id:
            replacement = by_id.get(replacement_id)
            cohort = run.get("provenance", {}).get("provenanceCohortId")
            if not replacement or replacement.get("providerId") != run.get("providerId") or cohort in {None, UNAVAILABLE} or replacement.get("provenance", {}).get("provenanceCohortId") != cohort:
                rejected.append(str(resolution.get("resolutionId")))
                continue
        compatible.append(resolution)
    return compatible, rejected


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
    grouped: dict[str, list[dict[str, Any]]] = {}
    inventory: dict[str, dict[str, Any]] = {}
    evidence_integrity_blocked = False
    for provider_id in config["providers"]:
        target = targets.get(provider_id)
        target_cohort = target.get("provenanceCohortId") if valid_provenance(target) else None
        buckets = {"current": [], "legacy": [], "incompatible": [], "debug": []}
        for run in [item for item in runs if item.get("providerId") == provider_id]:
            if run.get("metrics", {}).get("eligibleSample") is False:
                buckets["debug"].append(run)
            elif run.get("schemaVersion") in LEGACY_SCHEMA_VERSIONS:
                buckets["legacy"].append(run)
            elif run.get("schemaVersion") != SCHEMA_VERSION or not valid_provenance(run.get("provenance")):
                buckets["incompatible"].append(run)
            elif run.get("runId") in invalid_run_ids:
                buckets["incompatible"].append(run)
                if run.get("provenance", {}).get("provenanceCohortId") == target_cohort:
                    evidence_integrity_blocked = True
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
            "currentCohortId": target_cohort,
            "legacyRunIds": [run.get("runId") for run in buckets["legacy"]],
            "incompatibleRunIds": [run.get("runId") for run in buckets["incompatible"]],
            "debugRunIds": [run.get("runId") for run in buckets["debug"]],
        }
    eligible_runs = [run for provider_runs in grouped.values() for run in provider_runs]
    compatible_resolutions, rejected_resolutions = _compatible_resolutions(resolutions, eligible_runs)
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
            "rejectedCount": len(rejected_resolutions),
            "rejectedResolutionIds": rejected_resolutions,
        },
        "resolutions": resolutions,
        "historicalFailures": effective,
    }
