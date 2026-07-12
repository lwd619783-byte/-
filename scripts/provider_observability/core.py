from __future__ import annotations

import hashlib
import json
import os
import re
import statistics
import tempfile
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from . import ELIGIBILITY_STATUSES, RUN_STATUSES, SCHEMA_VERSION

SENSITIVE_KEY = re.compile(r"cookie|authorization|oauth|token|session|password|secret", re.I)
SENSITIVE_QUERY = re.compile(r"([?&](?:access_token|token|session|auth|key)=)[^&#\s]+", re.I)
BEARER = re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]+", re.I)
FAILURE_CATEGORIES = {
    "network_transient", "provider_unavailable", "timeout", "rate_limited", "authentication_unexpected",
    "schema_drift", "empty_response", "coverage_drop", "unexpected_removal", "data_value_drift",
    "manifest_mismatch", "checksum_mismatch", "atomicity_failure", "validation_failure", "audit_failure",
    "filesystem_failure", "timezone_failure", "unknown",
}
BLOCKING_FAILURES = {
    "schema_drift", "unexpected_removal", "manifest_mismatch", "checksum_mismatch", "atomicity_failure",
    "validation_failure", "audit_failure", "coverage_drop", "authentication_unexpected",
}
VOLATILE_KEYS = {"fetchedAt", "generatedAt", "lastSuccessfulFetchAt", "updatedAt"}


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


def append_run(root: Path, record: dict[str, Any]) -> None:
    validate_run(record)
    run_path = root / "runs" / f"{record['runId']}.json"
    if run_path.exists(): raise ValueError(f"duplicate runId: {record['runId']}")
    atomic_write(run_path, json_bytes(record))
    runs = load_runs(root)
    ledger = b"".join(json.dumps(run, ensure_ascii=False, sort_keys=True, allow_nan=False).encode("utf-8") + b"\n" for run in runs)
    atomic_write(root / "provider-health-ledger.jsonl", ledger)


def load_runs(root: Path) -> list[dict[str, Any]]:
    runs = [load_json(path) for path in sorted((root / "runs").glob("*.json"))] if (root / "runs").exists() else []
    return sorted(runs, key=lambda item: (item.get("startedAt", ""), item.get("runId", "")))


def validate_run(record: dict[str, Any]) -> None:
    required = {"schemaVersion", "runId", "providerId", "providerVersion", "domain", "startedAt", "endedAt", "timezone", "durationSeconds", "status", "exitCode", "metrics", "failures"}
    missing = sorted(required - record.keys())
    if missing: raise ValueError(f"missing run fields: {', '.join(missing)}")
    if record["schemaVersion"] != SCHEMA_VERSION: raise ValueError("schemaVersion mismatch")
    if record["status"] not in RUN_STATUSES: raise ValueError("invalid run status")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", str(record["runId"])): raise ValueError("unsafe runId")
    for failure in record["failures"]:
        if failure.get("category") not in FAILURE_CATEGORIES: raise ValueError("invalid failure category")
    if contains_sensitive(record): raise ValueError("sensitive field detected")


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: "[REDACTED]" if SENSITIVE_KEY.search(str(key)) else redact(child) for key, child in value.items()}
    if isinstance(value, list): return [redact(child) for child in value]
    if isinstance(value, str): return BEARER.sub("Bearer [REDACTED]", SENSITIVE_QUERY.sub(r"\1[REDACTED]", value))
    return value


def contains_sensitive(value: Any) -> bool:
    if isinstance(value, dict):
        return any(SENSITIVE_KEY.search(str(key)) and child != "[REDACTED]" or contains_sensitive(child) for key, child in value.items())
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


def stable(value: Any) -> Any:
    if isinstance(value, dict): return {key: stable(child) for key, child in sorted(value.items()) if key not in VOLATILE_KEYS}
    if isinstance(value, list): return [stable(child) for child in value]
    return value


def financial_diff(current: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    if previous is None: return {"baseline": True, "changedCompanies": 0, "valueDrifts": []}
    current_items, previous_items = current.get("items", {}), previous.get("items", {})
    changed, drifts = [], []
    for stock_id in sorted(set(current_items) | set(previous_items)):
        before, after = previous_items.get(stock_id), current_items.get(stock_id)
        if stable(before) != stable(after):
            changed.append(stock_id)
            if before and after and before.get("latestReportPeriod") == after.get("latestReportPeriod"):
                for field in ("latestSingleQuarter", "latestRatios", "latestBalanceSheet"):
                    if stable(before.get(field)) != stable(after.get(field)): drifts.append({"stockId": stock_id, "field": field})
    return {"baseline": False, "addedCompanies": sorted(set(current_items) - set(previous_items)), "removedCompanies": sorted(set(previous_items) - set(current_items)), "changedCompanies": len(changed), "valueDrifts": drifts}


def announcement_diff(current_details: dict[str, dict[str, Any]], previous_details: dict[str, dict[str, Any]] | None) -> dict[str, Any]:
    if previous_details is None: return {"baseline": True, "added": 0, "removed": 0, "addedIds": [], "removedIds": []}
    def index(details: dict[str, dict[str, Any]]) -> dict[str, tuple[Any, ...]]:
        return {str(item["announcementId"]): (item.get("category"), item.get("announcementDate"), item.get("officialUrl"), item.get("pdfUrl")) for detail in details.values() for item in detail.get("announcements", []) if item.get("announcementId")}
    now_index, before_index = index(current_details), index(previous_details)
    now, before = set(now_index), set(before_index)
    modified = sorted(item_id for item_id in now & before if now_index[item_id] != before_index[item_id])
    return {"baseline": False, "added": len(now - before), "removed": len(before - now), "modified": len(modified), "addedIds": sorted(now - before), "removedIds": sorted(before - now), "modifiedIds": modified}


def percentile(values: list[float], ratio: float) -> float | None:
    if not values: return None
    ordered = sorted(values); index = max(0, min(len(ordered) - 1, int((len(ordered) - 1) * ratio + 0.999999)))
    return round(ordered[index], 3)


def summarize_provider(runs: list[dict[str, Any]], timezone_name: str) -> dict[str, Any]:
    tz = ZoneInfo(timezone_name)
    success = [run for run in runs if run["status"] == "success"]
    complete = [run for run in success if run.get("metrics", {}).get("companyCoverage") == run.get("metrics", {}).get("expectedCompanies") and run.get("metrics", {}).get("structuralValidationRate") == 1]
    days = {datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00")).astimezone(tz).date().isoformat() for run in runs}
    success_days = {datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00")).astimezone(tz).date().isoformat() for run in success}
    durations = [float(run["durationSeconds"]) for run in runs]
    streak = 0
    for run in reversed(runs):
        if run["status"] != "success": break
        streak += 1
    failures = Counter(failure["category"] for run in runs for failure in run.get("failures", []))
    return {"runs": len(runs), "successRuns": len(success), "distinctDays": len(days), "successfulDays": len(success_days), "successRate": len(success) / len(runs) if runs else 0, "completeSuccessRate": len(complete) / len(runs) if runs else 0, "p50DurationSeconds": percentile(durations, .5), "p95DurationSeconds": percentile(durations, .95), "successStreak": streak, "latestStatus": runs[-1]["status"] if runs else None, "failureCounts": dict(sorted(failures.items()))}


def validate_config(config: dict[str, Any]) -> None:
    if config.get("schemaVersion") != SCHEMA_VERSION: raise ValueError("config schemaVersion mismatch")
    if not config.get("providers") or len(set(config["providers"])) != len(config["providers"]): raise ValueError("providers must be unique")
    ZoneInfo(config["timezone"])
    for key in ("minimumDistinctDays", "minimumRunsPerProvider", "minimumSuccessfulDaysPerProvider", "expectedCompanies"):
        if not isinstance(config.get(key), int) or config[key] <= 0: raise ValueError(f"invalid {key}")
    for key in ("minimumCompleteSuccessRate", "minimumTotalSuccessRate"):
        if not isinstance(config.get(key), (int, float)) or not 0 <= config[key] <= 1: raise ValueError(f"invalid {key}")


def evaluate(runs: list[dict[str, Any]], config: dict[str, Any], production_valid: bool = True, audit_errors: int = 0) -> dict[str, Any]:
    validate_config(config)
    grouped = {provider: [run for run in runs if run.get("providerId") == provider] for provider in config["providers"]}
    providers = {provider: summarize_provider(items, config["timezone"]) for provider, items in grouped.items()}
    all_days = set()
    for run in runs:
        all_days.add(datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00")).astimezone(ZoneInfo(config["timezone"])).date().isoformat())
    blocking = sorted({failure["category"] for run in runs for failure in run.get("failures", []) if not failure.get("resolved") and failure["category"] in BLOCKING_FAILURES})
    unavailable = any(items and items[-1]["status"] == "failed" and any(failure.get("category") == "provider_unavailable" and not failure.get("resolved") for failure in items[-1].get("failures", [])) for items in grouped.values())
    if not production_valid or audit_errors or blocking: status = "blocked"
    elif not runs or any(not grouped[p] for p in grouped): status = "insufficient_observation_window"
    elif unavailable: status = "provider_unavailable"
    elif len(all_days) < config["minimumDistinctDays"] or any(v["runs"] < config["minimumRunsPerProvider"] or v["successfulDays"] < config["minimumSuccessfulDaysPerProvider"] for v in providers.values()): status = "observing" if len(all_days) >= 2 else "insufficient_observation_window"
    elif any(v["latestStatus"] != "success" for v in providers.values()): status = "disqualified"
    elif all(v["successRate"] >= config["minimumTotalSuccessRate"] and v["completeSuccessRate"] >= config["minimumCompleteSuccessRate"] for v in providers.values()): status = "qualified"
    elif all(v["successRate"] >= config["minimumCompleteSuccessRate"] for v in providers.values()): status = "conditionally_qualified"
    else: status = "disqualified"
    assert status in ELIGIBILITY_STATUSES
    exit_code = 0 if status == "qualified" else 2 if status in {"insufficient_observation_window", "observing"} else 3 if status == "conditionally_qualified" else 1
    return {"schemaVersion": SCHEMA_VERSION, "status": status, "exitCode": exit_code, "observationDays": len(all_days), "providers": providers, "blockingFailures": blocking, "productionValid": production_valid, "auditErrors": audit_errors}


def tree_digest(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    files = []
    for path in paths:
        files.extend(path.rglob("*")) if path.is_dir() else files.append(path)
    for path in sorted(p for p in files if p.is_file()):
        digest.update(str(path).encode("utf-8")); digest.update(path.read_bytes())
    return digest.hexdigest()
