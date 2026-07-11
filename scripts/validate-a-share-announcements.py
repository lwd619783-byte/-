from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from a_share_announcements.artifacts import validate_artifacts


def main() -> int:
    universe = json.loads((ROOT / "src/data/real/stock-universe.generated.json").read_text(encoding="utf-8"))
    expected = {item["id"] for item in universe["items"] if item.get("market") == "A股"}
    summary_path = ROOT / "src/data/real/a-share-announcement-summaries.generated.json"
    detail_dir = ROOT / "public/data/a-share-announcements"
    errors = validate_artifacts(summary_path, detail_dir, expected)
    provider_source = (ROOT / "src/services/providers/aStockDataProvider.ts").read_text(encoding="utf-8")
    if "a-share-announcement-summaries.generated.json" not in provider_source: errors.append("synchronous provider does not import announcement summaries")
    if "announcements.generated.json" in provider_source: errors.append("synchronous provider still imports legacy announcement history")
    if errors:
        print(f"Announcement validation failed with {len(errors)} error(s):", file=sys.stderr)
        for error in errors: print(f"- {error}", file=sys.stderr)
        return 1
    manifest = json.loads((detail_dir / "manifest.generated.json").read_text(encoding="utf-8"))
    parse_counts = Counter(); category_counts = Counter(); official = 0; linked = 0
    for entry in manifest["items"]:
        detail = json.loads((detail_dir / f"{entry['stockId']}.json").read_text(encoding="utf-8"))
        for item in detail["announcements"]:
            parse_counts[item["parseStatus"]] += 1; category_counts[item["category"]] += 1
            official += bool(item.get("officialUrl") and item.get("pdfUrl"))
            linked += bool((item.get("periodicReportEvent") or {}).get("linkedFinancialStatus") == "matched")
    output = {"status": "passed", **{key: manifest[key] for key in ("totalCompanies", "totalAnnouncements", "dateRange", "success", "partial", "error", "empty")}, "categoryCounts": dict(category_counts), "parseCounts": dict(parse_counts), "officialLinkCoverage": f"{official}/{manifest['totalAnnouncements']}", "financialLinksMatched": linked}
    print(json.dumps(output, ensure_ascii=False, indent=2)); return 0


if __name__ == "__main__": raise SystemExit(main())
