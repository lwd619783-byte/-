from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from a_share_financials.core import SCHEMA_VERSION, validate_dataset


def main() -> int:
    dataset_path = ROOT / "src/data/real/a-share-financials.generated.json"
    universe_path = ROOT / "src/data/real/stock-universe.generated.json"
    try:
        dataset = json.loads(dataset_path.read_text(encoding="utf-8"), parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
        universe = json.loads(universe_path.read_text(encoding="utf-8"))["items"]
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"Unable to load financial dataset: {exc}", file=sys.stderr)
        return 2
    errors = ([] if dataset.get("schemaVersion") == SCHEMA_VERSION else [f"schemaVersion must be {SCHEMA_VERSION}"])
    errors.extend(validate_dataset(dataset, universe))
    raw = dataset_path.read_text(encoding="utf-8").lower()
    for forbidden in ('"mock"', '"sample"', '"placeholder"'):
        if forbidden in raw:
            errors.append(f"forbidden generated content: {forbidden}")
    if errors:
        print(f"Financial validation failed with {len(set(errors))} error(s):", file=sys.stderr)
        for error in sorted(set(errors)):
            print(f"- {error}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "passed", "schemaVersion": dataset["schemaVersion"], **dataset["summary"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
