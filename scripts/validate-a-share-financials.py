from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_financials.artifacts import MANIFEST_FILENAME, load_existing_split_items, validate_split_artifacts
from a_share_financials.core import SCHEMA_VERSION, build_summary, validate_dataset


def main() -> int:
    summary_path = ROOT / "src/data/real/a-share-financial-summaries.generated.json"
    legacy_path = ROOT / "src/data/real/a-share-financials.generated.json"
    detail_dir = ROOT / "public/data/a-share-financials"
    manifest_path = detail_dir / MANIFEST_FILENAME
    universe_path = ROOT / "src/data/real/stock-universe.generated.json"
    errors: list[str] = []
    try:
        universe = json.loads(universe_path.read_text(encoding="utf-8"))["items"]
        expected_ids = {item["id"] for item in universe if item.get("market") == "A股" and item.get("shouldFetchFinancials", True)}
        items = load_existing_split_items(detail_dir)
        summary = json.loads(summary_path.read_text(encoding="utf-8"), parse_constant=_reject_constant)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"Unable to load financial artifacts: {exc}", file=sys.stderr)
        return 2
    if legacy_path.exists():
        errors.append("legacy monolithic a-share-financials.generated.json must be removed")
    errors.extend(validate_split_artifacts(summary_path, manifest_path, detail_dir, expected_ids))
    dataset = {"items": items, "summary": build_summary(items)}
    errors.extend(validate_dataset(dataset, universe))
    if summary.get("summary") != dataset["summary"]:
        errors.append("summary coverage block does not match detail records")
    source_text = (ROOT / "src/services/providers/aStockDataProvider.ts").read_text(encoding="utf-8")
    if "a-share-financials.generated.json" in source_text or "public/data/a-share-financials" in source_text:
        errors.append("synchronous provider imports full financial history")
    if "a-share-financial-summaries.generated.json" not in source_text:
        errors.append("synchronous provider does not import the financial summary")
    raw = summary_path.read_text(encoding="utf-8").lower() + manifest_path.read_text(encoding="utf-8").lower()
    for forbidden in ('"mock"', '"sample"', '"placeholder"'):
        if forbidden in raw:
            errors.append(f"forbidden generated content: {forbidden}")
    if errors:
        print(f"Financial validation failed with {len(set(errors))} error(s):", file=sys.stderr)
        for error in sorted(set(errors)):
            print(f"- {error}", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    detail_files = list(detail_dir.glob("*.json"))
    detail_files = [path for path in detail_files if path.name != MANIFEST_FILENAME]
    detail_bytes = sum(path.stat().st_size for path in detail_files)
    print(json.dumps({
        "status": "passed", "schemaVersion": SCHEMA_VERSION, **dataset["summary"],
        "summaryBytes": summary_path.stat().st_size, "manifestBytes": manifest_path.stat().st_size,
        "detailFiles": len(detail_files), "detailBytes": detail_bytes,
        "averageDetailBytes": round(detail_bytes / len(detail_files), 2),
        "manifestTotal": manifest["total"],
    }, ensure_ascii=False, indent=2))
    return 0


def _reject_constant(value: str):
    raise ValueError(f"non-finite JSON constant: {value}")


if __name__ == "__main__":
    raise SystemExit(main())
