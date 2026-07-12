from __future__ import annotations
import argparse, json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT / "scripts"))
from provider_observability.core import atomic_write, evaluate, json_bytes, load_json, load_runs

def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--observations-dir", type=Path, default=ROOT / ".provider-observations"); parser.add_argument("--strict-exit", action="store_true"); args = parser.parse_args()
    summary = evaluate(load_runs(args.observations_dir), load_json(ROOT / "config/provider-stability-gate-v1.json"))
    atomic_write(args.observations_dir / "provider-health-summary.json", json_bytes(summary)); print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary["exitCode"] if args.strict_exit else 0
if __name__ == "__main__": raise SystemExit(main())
