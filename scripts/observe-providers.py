from __future__ import annotations

import argparse
import json
import platform
import subprocess
import sys
import time
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_announcements import PROVIDER_VERSION as ANNOUNCEMENT_VERSION
from a_share_announcements.artifacts import validate_artifacts
from a_share_financials.artifacts import MANIFEST_FILENAME, validate_split_artifacts
from a_share_financials.core import PROVIDER_VERSION as FINANCIAL_VERSION
from provider_observability import SCHEMA_VERSION
from provider_observability.core import (
    announcement_diff, append_run, atomic_write, audit_observation_ledger, classify_failure, evaluate, financial_diff,
    DirtyWorktreeError, file_digest, json_bytes, load_json, load_resolutions, load_runs, observation_eligibility, redact, tree_digest,
)
from provider_observability.production import validate_production
from provider_observability.provenance import build_current_provenance, build_provenance, recordable_provenance

DEFAULT_ROOT = ROOT / ".provider-observations"
PRODUCTION_PATHS = [
    ROOT / "src/data/real/a-share-financial-summaries.generated.json",
    ROOT / "public/data/a-share-financials",
    ROOT / "src/data/real/a-share-announcement-summaries.generated.json",
    ROOT / "public/data/a-share-announcements",
]


def args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run isolated cross-day provider observations")
    parser.add_argument("--provider", choices=("financials", "announcements", "all"), default="all")
    parser.add_argument("--observations-dir", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument("--run-id")
    parser.add_argument("--allow-dirty-debug", action="store_true", help="Debug only; the run is excluded from eligibility")
    return parser.parse_args()


def git_status() -> str:
    return subprocess.run(["git", "status", "--porcelain=v1"], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=True).stdout


def detail_documents(detail_dir: Path, id_key: str) -> dict[str, dict[str, Any]]:
    output = {}
    for path in detail_dir.glob("*.json"):
        if path.name == MANIFEST_FILENAME: continue
        document = load_json(path)
        output[str(document[id_key])] = document
    return output


def prior_observation(observation_root: Path, provider_id: str, provenance_cohort_id: str) -> tuple[dict[str, Any] | None, Path | None]:
    candidates = [
        run for run in load_runs(observation_root)
        if run.get("providerId") == provider_id
        and run.get("status") in {"success", "partial"}
        and run.get("metrics", {}).get("eligibleSample") is True
        and run.get("provenance", {}).get("provenanceCohortId") == provenance_cohort_id
    ]
    if not candidates: return None, None
    value = candidates[-1].get("artifacts", {}).get("generatedRoot")
    return candidates[-1], observation_root / value if value else None


def observe(kind: str, observation_root: Path, no_cache: bool, timeout: float, explicit_id: str | None, eligible_sample: bool = True) -> int:
    provider_id = "a-share-financials" if kind == "financials" else "a-share-announcements"
    provider_version = FINANCIAL_VERSION if kind == "financials" else ANNOUNCEMENT_VERSION
    provenance, provenance_errors = build_provenance(ROOT, provider_id)
    if provenance_errors and not recordable_provenance(provenance):
        raise ValueError("provenance acquisition failure did not produce recordable V2 evidence")
    eligible_sample = eligible_sample and not provenance_errors
    run_id = explicit_id or f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{provider_id}-{uuid.uuid4().hex[:8]}"
    artifact_root = observation_root / "artifacts" / run_id
    generated_root = artifact_root / "generated"
    cache_root = observation_root / "cache" / provider_id
    generated_root.mkdir(parents=True, exist_ok=False)
    before_digest = tree_digest(PRODUCTION_PATHS, ROOT)
    before_status = git_status()
    started_at = datetime.now(timezone.utc).replace(microsecond=0)
    started = time.monotonic()
    command = [sys.executable, str(ROOT / "scripts" / f"fetch-a-share-{kind}.py"), "--output-root", str(generated_root), "--cache-dir", str(cache_root)]
    recorded_command = ["python", f"scripts/fetch-a-share-{kind}.py", "--output-root", f"artifacts/{run_id}/generated", "--cache-dir", f"cache/{provider_id}"]
    if no_cache: command.append("--no-cache")
    if no_cache: recorded_command.append("--no-cache")
    if kind == "financials":
        command += ["--timeout", str(timeout)]
        recorded_command += ["--timeout", str(timeout)]
    process = subprocess.run(command, cwd=ROOT, text=True, encoding="utf-8", errors="replace", capture_output=True)
    duration = round(time.monotonic() - started, 3)
    ended_at = datetime.now(timezone.utc).replace(microsecond=0)
    failures: list[dict[str, Any]] = []
    messages = []
    if provenance_errors:
        failures.append({"category": "provenance_unavailable", "message": "; ".join(provenance_errors), "resolved": False})
    if process.returncode:
        message = (process.stderr or process.stdout or "provider command failed")[-2000:]
        failures.append({"category": classify_failure(message), "message": redact(message), "resolved": False})
        messages.append(redact(message))
    metrics: dict[str, Any] = {"expectedCompanies": 56, "companyCoverage": 0, "structuralValidationRate": 0, "eligibleSample": eligible_sample, "cacheMode": "bypass" if no_cache else "isolated", "retryCount": None, "timeoutCount": int(any(f["category"] == "timeout" for f in failures)), "rateLimitCount": int(any(f["category"] == "rate_limited" for f in failures)), "httpStatusCounts": {}}
    difference: dict[str, Any] = {"baseline": True}
    previous_run, previous = prior_observation(observation_root, provider_id, provenance.get("provenanceCohortId"))
    try:
        if kind == "financials":
            summary_path = generated_root / "a-share-financial-summaries.generated.json"
            detail_dir = generated_root / "a-share-financials"
            manifest = load_json(detail_dir / MANIFEST_FILENAME, {})
            summary = load_json(summary_path, {})
            universe = load_json(ROOT / "src/data/real/stock-universe.generated.json")["items"]
            expected = {item["id"] for item in universe if item.get("market") == "A股"}
            errors = validate_split_artifacts(summary_path, detail_dir / MANIFEST_FILENAME, detail_dir, expected)
            metrics.update({"companyCoverage": manifest.get("total", 0), "success": manifest.get("success", 0), "partial": manifest.get("partial", 0), "error": manifest.get("error", 0), "structuralValidationRate": 1 if not errors else 0, "detailFiles": len(list(detail_dir.glob("*.json"))) - 1, "manifestChecksum": file_digest(detail_dir / MANIFEST_FILENAME), "artifactChecksum": tree_digest([summary_path, detail_dir], generated_root)})
            difference = financial_diff(summary, load_json(previous / summary_path.name) if previous else None, run_id, previous_run.get("runId") if previous_run else None)
            if difference.get("removedCompanies"):
                failures.append({"category": "coverage_drop", "message": f"removed companies: {len(difference['removedCompanies'])}", "resolved": False})
            if difference.get("valueDrifts"):
                failures.append({"category": "data_value_drift", "message": f"same-period value drifts: {len(difference['valueDrifts'])}", "resolved": False})
        else:
            summary_path = generated_root / "a-share-announcement-summaries.generated.json"
            detail_dir = generated_root / "a-share-announcements"
            manifest = load_json(detail_dir / MANIFEST_FILENAME, {})
            universe = load_json(ROOT / "src/data/real/stock-universe.generated.json")["items"]
            expected = {item["id"] for item in universe if item.get("market") == "A股"}
            errors = validate_artifacts(summary_path, detail_dir, expected)
            details = detail_documents(detail_dir, "stockId")
            previous_detail_dir = previous / "a-share-announcements" if previous else None
            previous_details = detail_documents(previous_detail_dir, "stockId") if previous_detail_dir else None
            previous_manifest = load_json(previous_detail_dir / MANIFEST_FILENAME, {}) if previous_detail_dir else {}
            difference = announcement_diff(details, previous_details, manifest.get("dateRange"), previous_manifest.get("dateRange"))
            if difference.get("unexpectedRemoved"):
                failures.append({"category": "unexpected_removal", "message": f"overlap-window announcement removals: {difference['unexpectedRemoved']}", "resolved": False})
            if difference.get("unverifiableRemoved"):
                failures.append({"category": "unverifiable_removal", "message": f"unverifiable announcement removals: {difference['unverifiableRemoved']}", "resolved": False})
            if difference.get("windowRisks"):
                failures.append({"category": "window_anomaly", "message": ", ".join(difference["windowRisks"]), "resolved": False})
            categories = Counter(item.get("category") for detail in details.values() for item in detail.get("announcements", []))
            metrics.update({"companyCoverage": manifest.get("totalCompanies", 0), "success": manifest.get("success", 0), "partial": manifest.get("partial", 0), "error": manifest.get("error", 0), "totalAnnouncements": manifest.get("totalAnnouncements", 0), "latestAnnouncementDate": (manifest.get("dateRange") or {}).get("end"), "categoryCounts": dict(sorted(categories.items())), "structuralValidationRate": 1 if not errors else 0, "detailFiles": len(details), "manifestChecksum": file_digest(detail_dir / MANIFEST_FILENAME), "artifactChecksum": tree_digest([summary_path, detail_dir], generated_root), "expectedWindowExpiryCount": difference.get("expectedExpired", 0), "unexpectedRemovalCount": difference.get("unexpectedRemoved", 0), "unverifiableRemovalCount": difference.get("unverifiableRemoved", 0), "windowShiftDays": difference.get("windowShiftDays")})
        for error in errors:
            category = "checksum_mismatch" if "checksum" in error else "manifest_mismatch" if "manifest" in error else "validation_failure"
            failures.append({"category": category, "message": error, "resolved": False})
        if metrics["companyCoverage"] < metrics["expectedCompanies"]:
            failures.append({"category": "coverage_drop", "message": f"company coverage {metrics['companyCoverage']}/{metrics['expectedCompanies']}", "resolved": False})
    except Exception as exc:
        failures.append({"category": classify_failure(str(exc)), "message": redact(str(exc)), "resolved": False})
    after_digest = tree_digest(PRODUCTION_PATHS, ROOT)
    after_status = git_status()
    production_unchanged = before_digest == after_digest
    worktree_unchanged = before_status == after_status
    if not production_unchanged: failures.append({"category": "atomicity_failure", "message": "production generated data changed during isolated observation", "resolved": False})
    status = "success" if process.returncode == 0 and not failures and metrics["companyCoverage"] == 56 and metrics["structuralValidationRate"] == 1 else "partial" if metrics["companyCoverage"] else "failed"
    record = redact({
        "schemaVersion": SCHEMA_VERSION, "runId": run_id, "providerId": provider_id, "providerVersion": provider_version,
        "domain": kind, "startedAt": started_at.isoformat().replace("+00:00", "Z"), "endedAt": ended_at.isoformat().replace("+00:00", "Z"),
        "timezone": "Asia/Shanghai", "durationSeconds": duration, "platform": platform.platform(), "pythonVersion": platform.python_version(),
        "nodeVersion": subprocess.run(["node", "--version"], text=True, capture_output=True).stdout.strip(), "command": recorded_command,
        "status": status, "exitCode": process.returncode, "metrics": metrics, "difference": difference, "failures": failures,
        "validation": {"passed": metrics["structuralValidationRate"] == 1}, "atomicity": {"productionUnchanged": production_unchanged, "beforeChecksum": before_digest, "afterChecksum": after_digest},
        "worktree": {"unchanged": worktree_unchanged}, "messages": messages,
        "artifacts": {"generatedRoot": generated_root.relative_to(observation_root).as_posix()}, "provenance": provenance,
    })
    append_run(observation_root, record)
    refresh_summary(observation_root)
    print(json.dumps(record, ensure_ascii=False, indent=2))
    return 0 if status == "success" else 1


def refresh_summary(observation_root: Path) -> dict[str, Any]:
    config = load_json(ROOT / "config/provider-stability-gate-v1.json")
    runs = load_runs(observation_root)
    current, provenance_failures = build_current_provenance(ROOT, config["providers"])
    summary = evaluate(
        runs,
        config,
        validate_production(ROOT),
        load_resolutions(observation_root),
        current_provenance=current,
        current_provenance_failures=provenance_failures,
        ledger_audit=audit_observation_ledger(observation_root, runs),
    )
    summary["generatedAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    atomic_write(observation_root / "provider-health-summary.json", json_bytes(summary))
    return summary


def main() -> int:
    options = args(); root = options.observations_dir.resolve()
    default_root = DEFAULT_ROOT.resolve()
    if root != default_root and default_root not in root.parents:
        print("observations directory must stay under .provider-observations", file=sys.stderr); return 2
    try:
        eligible_sample = observation_eligibility(git_status(), options.allow_dirty_debug)
    except DirtyWorktreeError as exc:
        print(json.dumps({"status": "preflight_failed", "reason": "dirty_worktree", "dirtyFiles": exc.paths}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 5
    kinds = ("financials", "announcements") if options.provider == "all" else (options.provider,)
    codes = [observe(kind, root, options.no_cache, options.timeout, options.run_id if len(kinds) == 1 else None, eligible_sample=eligible_sample) for kind in kinds]
    return max(codes)


if __name__ == "__main__": raise SystemExit(main())
