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
    announcement_diff, append_run, atomic_write, classify_failure, evaluate, financial_diff,
    json_bytes, load_json, load_runs, redact, tree_digest,
)

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


def prior_artifacts(observation_root: Path, provider_id: str) -> Path | None:
    candidates = [run for run in load_runs(observation_root) if run.get("providerId") == provider_id and run.get("status") in {"success", "partial"}]
    if not candidates: return None
    value = candidates[-1].get("artifacts", {}).get("generatedRoot")
    return observation_root / value if value else None


def observe(kind: str, observation_root: Path, no_cache: bool, timeout: float, explicit_id: str | None) -> int:
    provider_id = "a-share-financials" if kind == "financials" else "a-share-announcements"
    provider_version = FINANCIAL_VERSION if kind == "financials" else ANNOUNCEMENT_VERSION
    run_id = explicit_id or f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{provider_id}-{uuid.uuid4().hex[:8]}"
    artifact_root = observation_root / "artifacts" / run_id
    generated_root = artifact_root / "generated"
    cache_root = observation_root / "cache" / provider_id
    generated_root.mkdir(parents=True, exist_ok=False)
    before_digest = tree_digest(PRODUCTION_PATHS)
    before_status = git_status()
    started_at = datetime.now(timezone.utc).replace(microsecond=0)
    started = time.monotonic()
    command = [sys.executable, str(ROOT / "scripts" / f"fetch-a-share-{kind}.py"), "--output-root", str(generated_root), "--cache-dir", str(cache_root)]
    if no_cache: command.append("--no-cache")
    if kind == "financials": command += ["--timeout", str(timeout)]
    process = subprocess.run(command, cwd=ROOT, text=True, encoding="utf-8", errors="replace", capture_output=True)
    duration = round(time.monotonic() - started, 3)
    ended_at = datetime.now(timezone.utc).replace(microsecond=0)
    failures: list[dict[str, Any]] = []
    messages = []
    if process.returncode:
        message = (process.stderr or process.stdout or "provider command failed")[-2000:]
        failures.append({"category": classify_failure(message), "message": redact(message), "resolved": False})
        messages.append(redact(message))
    metrics: dict[str, Any] = {"expectedCompanies": 56, "companyCoverage": 0, "structuralValidationRate": 0, "cacheMode": "bypass" if no_cache else "isolated", "retryCount": None, "timeoutCount": int(any(f["category"] == "timeout" for f in failures)), "rateLimitCount": int(any(f["category"] == "rate_limited" for f in failures)), "httpStatusCounts": {}}
    difference: dict[str, Any] = {"baseline": True}
    previous = prior_artifacts(observation_root, provider_id)
    try:
        if kind == "financials":
            summary_path = generated_root / "a-share-financial-summaries.generated.json"
            detail_dir = generated_root / "a-share-financials"
            manifest = load_json(detail_dir / MANIFEST_FILENAME, {})
            summary = load_json(summary_path, {})
            universe = load_json(ROOT / "src/data/real/stock-universe.generated.json")["items"]
            expected = {item["id"] for item in universe if item.get("market") == "A股"}
            errors = validate_split_artifacts(summary_path, detail_dir / MANIFEST_FILENAME, detail_dir, expected)
            metrics.update({"companyCoverage": manifest.get("total", 0), "success": manifest.get("success", 0), "partial": manifest.get("partial", 0), "error": manifest.get("error", 0), "structuralValidationRate": 1 if not errors else 0, "detailFiles": len(list(detail_dir.glob("*.json"))) - 1, "manifestChecksum": tree_digest([detail_dir / MANIFEST_FILENAME]), "artifactChecksum": tree_digest([summary_path, detail_dir])})
            difference = financial_diff(summary, load_json(previous / summary_path.name) if previous else None)
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
            previous_details = detail_documents(previous / "a-share-announcements", "stockId") if previous else None
            difference = announcement_diff(details, previous_details)
            if difference.get("removed"):
                failures.append({"category": "unexpected_removal", "message": f"historical announcement removals: {difference['removed']}", "resolved": False})
            categories = Counter(item.get("category") for detail in details.values() for item in detail.get("announcements", []))
            metrics.update({"companyCoverage": manifest.get("totalCompanies", 0), "success": manifest.get("success", 0), "partial": manifest.get("partial", 0), "error": manifest.get("error", 0), "totalAnnouncements": manifest.get("totalAnnouncements", 0), "latestAnnouncementDate": (manifest.get("dateRange") or {}).get("end"), "categoryCounts": dict(sorted(categories.items())), "structuralValidationRate": 1 if not errors else 0, "detailFiles": len(details), "manifestChecksum": tree_digest([detail_dir / MANIFEST_FILENAME]), "artifactChecksum": tree_digest([summary_path, detail_dir])})
        for error in errors:
            category = "checksum_mismatch" if "checksum" in error else "manifest_mismatch" if "manifest" in error else "validation_failure"
            failures.append({"category": category, "message": error, "resolved": False})
        if metrics["companyCoverage"] < metrics["expectedCompanies"]:
            failures.append({"category": "coverage_drop", "message": f"company coverage {metrics['companyCoverage']}/{metrics['expectedCompanies']}", "resolved": False})
    except Exception as exc:
        failures.append({"category": classify_failure(str(exc)), "message": redact(str(exc)), "resolved": False})
    after_digest = tree_digest(PRODUCTION_PATHS)
    after_status = git_status()
    production_unchanged = before_digest == after_digest
    worktree_unchanged = before_status == after_status
    if not production_unchanged: failures.append({"category": "atomicity_failure", "message": "production generated data changed during isolated observation", "resolved": False})
    status = "success" if process.returncode == 0 and not failures and metrics["companyCoverage"] == 56 and metrics["structuralValidationRate"] == 1 else "partial" if metrics["companyCoverage"] else "failed"
    record = redact({
        "schemaVersion": SCHEMA_VERSION, "runId": run_id, "providerId": provider_id, "providerVersion": provider_version,
        "domain": kind, "startedAt": started_at.isoformat().replace("+00:00", "Z"), "endedAt": ended_at.isoformat().replace("+00:00", "Z"),
        "timezone": "Asia/Shanghai", "durationSeconds": duration, "platform": platform.platform(), "pythonVersion": platform.python_version(),
        "nodeVersion": subprocess.run(["node", "--version"], text=True, capture_output=True).stdout.strip(), "command": [Path(command[0]).name, *[str(x) for x in command[1:]]],
        "status": status, "exitCode": process.returncode, "metrics": metrics, "difference": difference, "failures": failures,
        "validation": {"passed": metrics["structuralValidationRate"] == 1}, "atomicity": {"productionUnchanged": production_unchanged},
        "worktree": {"unchanged": worktree_unchanged}, "messages": messages,
        "artifacts": {"generatedRoot": generated_root.relative_to(observation_root).as_posix()},
    })
    append_run(observation_root, record)
    refresh_summary(observation_root)
    print(json.dumps(record, ensure_ascii=False, indent=2))
    return 0 if status == "success" else 1


def refresh_summary(observation_root: Path) -> dict[str, Any]:
    config = load_json(ROOT / "config/provider-stability-gate-v1.json")
    summary = evaluate(load_runs(observation_root), config)
    summary["generatedAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    atomic_write(observation_root / "provider-health-summary.json", json_bytes(summary))
    return summary


def main() -> int:
    options = args(); root = options.observations_dir.resolve()
    default_root = DEFAULT_ROOT.resolve()
    if root != default_root and default_root not in root.parents:
        print("observations directory must stay under .provider-observations", file=sys.stderr); return 2
    kinds = ("financials", "announcements") if options.provider == "all" else (options.provider,)
    codes = [observe(kind, root, options.no_cache, options.timeout, options.run_id if len(kinds) == 1 else None) for kind in kinds]
    return max(codes)


if __name__ == "__main__": raise SystemExit(main())
