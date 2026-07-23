from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from provider_observability.core import (
    append_resolution, atomic_write, audit_observation_ledger, evaluate, json_bytes, load_json, load_resolutions, load_runs, make_resolution,
)
from provider_observability.production import validate_production
from provider_observability.provenance import build_current_provenance


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate offline provider health and default-refresh eligibility")
    parser.add_argument("--observations-dir", type=Path, default=ROOT / ".provider-observations")
    parser.add_argument("--strict-exit", action="store_true")
    parser.add_argument("--resolve", metavar="RUN_ID:FAILURE_INDEX")
    parser.add_argument("--reason")
    parser.add_argument("--evidence")
    parser.add_argument("--resolved-by", default="local-operator")
    parser.add_argument("--replacement-run-id")
    return parser.parse_args()


def resolve_failure(options: argparse.Namespace, runs: list[dict]) -> None:
    if not options.reason or not options.evidence: raise ValueError("--reason and --evidence are required with --resolve")
    run_id, separator, raw_index = options.resolve.rpartition(":")
    if not separator or not run_id: raise ValueError("--resolve must be RUN_ID:FAILURE_INDEX")
    index = int(raw_index)
    run = next((item for item in runs if item.get("runId") == run_id), None)
    if not run or index < 0 or index >= len(run.get("failures", [])): raise ValueError("resolution references unknown run or failure")
    failure = run["failures"][index]
    resolution = make_resolution(run["providerId"], run_id, index, failure["category"], options.reason, options.evidence, options.resolved_by, options.replacement_run_id)
    append_resolution(options.observations_dir, resolution, runs)


def main() -> int:
    options = parse_args(); runs = load_runs(options.observations_dir)
    try:
        if options.resolve: resolve_failure(options, runs)
        production = validate_production(ROOT)
        config = load_json(ROOT / "config/provider-stability-gate-v1.json")
        current, provenance_failures = build_current_provenance(ROOT, config["providers"])
        resolutions = load_resolutions(options.observations_dir)
        summary = evaluate(
            runs,
            config,
            production,
            resolutions,
            current_provenance=current,
            current_provenance_failures=provenance_failures,
            ledger_audit=audit_observation_ledger(options.observations_dir, runs),
        )
        atomic_write(options.observations_dir / "provider-health-summary.json", json_bytes(summary))
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return summary["exitCode"] if options.strict_exit else 0
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "error", "message": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__": raise SystemExit(main())
