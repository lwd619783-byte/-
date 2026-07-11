from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from datetime import date, timedelta, timezone, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_announcements import PROVIDER, PROVIDER_VERSION
from a_share_announcements.artifacts import MANIFEST_FILENAME, publish, validate_artifacts, write_staged_artifacts
from a_share_announcements.core import PERFORMANCE_CATEGORIES, build_announcement, link_versions
from a_share_announcements.provider import CNInfoClient

UNIVERSE_PATH = ROOT / "src/data/real/stock-universe.generated.json"
SUMMARY_OUTPUT = ROOT / "src/data/real/a-share-announcement-summaries.generated.json"
DETAIL_OUTPUT = ROOT / "public/data/a-share-announcements"
CACHE_ROOT = ROOT / "data-cache/a-share-announcements-v1"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_args() -> argparse.Namespace:
    today = date.today()
    parser = argparse.ArgumentParser(description="Fetch and generate A-share announcement Provider V1 artifacts")
    parser.add_argument("--stock", help="single 6-digit stock code or stock id")
    parser.add_argument("--start", default=(today - timedelta(days=730)).isoformat())
    parser.add_argument("--end", default=today.isoformat())
    parser.add_argument("--incremental", action="store_true")
    parser.add_argument("--missing-only", action="store_true")
    parser.add_argument("--performance-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--delay", type=float, default=0.35)
    return parser.parse_args()


def load_universe() -> list[dict[str, str]]:
    doc = json.loads(UNIVERSE_PATH.read_text(encoding="utf-8"))
    return [item for item in doc["items"] if item.get("market") == "A股"]


def load_existing() -> dict[str, dict[str, Any]]:
    manifest_path = DETAIL_OUTPUT / MANIFEST_FILENAME
    if not manifest_path.exists(): return {}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    result: dict[str, dict[str, Any]] = {}
    for entry in manifest.get("items", []):
        path = DETAIL_OUTPUT / f"{entry.get('stockId')}.json"
        if path.exists():
            value = json.loads(path.read_text(encoding="utf-8")); value.pop("schemaVersion", None); result[value["stockId"]] = value
    return result


def financial_periods(stock_id: str) -> dict[str, str]:
    path = ROOT / "public/data/a-share-financials" / f"{stock_id}.json"
    if not path.exists(): return {}
    detail = json.loads(path.read_text(encoding="utf-8"))
    return {report["reportPeriod"]: detail.get("generatedAt") or report.get("generatedAt") for report in detail.get("reports", []) if report.get("reportPeriod")}


def raw_category(raw: dict[str, Any]) -> str:
    from a_share_announcements.core import classify_announcement, normalize_title
    return classify_announcement(normalize_title(raw.get("announcementTitle")), raw.get("announcementTypeName"))["category"]


def fetch_one(client: CNInfoClient, stock: dict[str, str], start: str, end: str, generated_at: str, use_cache: bool, performance_only: bool, previous: dict[str, Any] | None) -> dict[str, Any]:
    fetched_at = now_iso()
    try:
        raw_items = client.fetch_company(stock, start, end, use_cache=use_cache)
        if performance_only: raw_items = [item for item in raw_items if raw_category(item) in PERFORMANCE_CATEGORIES]
        records = []
        periods = financial_periods(stock["id"])
        for raw in raw_items:
            category = raw_category(raw)
            pdf_text = None
            adjunct = raw.get("adjunctUrl")
            if category in {"performance_forecast", "performance_forecast_revision", "performance_express"} and adjunct:
                pdf_text = client.extract_pdf_text(str(raw.get("announcementId")), f"https://static.cninfo.com.cn/{adjunct}")
            records.append(build_announcement(raw, stock, fetched_at, pdf_text, periods))
        if previous and start > (previous.get("dateRange", {}).get("start") or start):
            existing = {item["announcementId"]: item for item in previous.get("announcements", [])}
            existing.update({item["announcementId"]: item for item in records})
            records = sorted(existing.values(), key=lambda item: (item.get("announcementDate") or "", item.get("announcementId") or ""), reverse=True)
        records = link_versions(records)
        parse_failures = [item for item in records if item.get("parseStatus") in {"parse_partial", "parse_unavailable"}]
        status = "empty" if not records else "partial" if parse_failures else "success"
        return {
            "stockId": stock["id"], "stockCode": stock["code"], "companyName": stock["name"], "market": "A股",
            "provider": PROVIDER, "providerVersion": PROVIDER_VERSION, "generatedAt": generated_at, "fetchedAt": fetched_at,
            "lastSuccessfulFetchAt": fetched_at, "currentFetchError": None, "status": status,
            "dateRange": {"start": start, "end": end}, "announcements": records,
            "quality": {"source": "CNInfo", "sourceLayer": "announcements", "sourceEndpoint": "CNInfo hisAnnouncement", "sourceUrl": "https://www.cninfo.com.cn/new/hisAnnouncement/query", "updatedAt": fetched_at, "status": "partial" if status == "partial" else "real" if status == "success" else "missing"},
        }
    except Exception as exc:
        if previous:
            stale = dict(previous); stale.update({"generatedAt": generated_at, "status": "partial", "currentFetchError": str(exc), "quality": {**previous.get("quality", {}), "status": "stale", "errorMessage": str(exc)}}); return stale
        return {"stockId": stock["id"], "stockCode": stock["code"], "companyName": stock["name"], "market": "A股", "provider": PROVIDER, "providerVersion": PROVIDER_VERSION, "generatedAt": generated_at, "fetchedAt": fetched_at, "lastSuccessfulFetchAt": None, "currentFetchError": str(exc), "status": "error", "dateRange": {"start": start, "end": end}, "announcements": [], "quality": {"source": "CNInfo", "sourceLayer": "announcements", "sourceEndpoint": "CNInfo hisAnnouncement", "sourceUrl": "https://www.cninfo.com.cn/new/hisAnnouncement/query", "updatedAt": fetched_at, "status": "error", "errorMessage": str(exc)}}


def main() -> int:
    args = parse_args(); started = time.monotonic(); universe = load_universe(); expected = {item["id"] for item in universe}; existing = load_existing()
    selected = universe
    if args.stock:
        selected = [item for item in universe if item["id"] == args.stock or item["code"] == args.stock]
        if not selected: print(f"Unknown A-share stock: {args.stock}", file=sys.stderr); return 2
    if args.missing_only: selected = [item for item in universe if item["id"] not in existing or existing[item["id"]].get("status") in {"error", "empty"}]
    start = args.start
    if args.incremental: start = max(start, (date.today() - timedelta(days=30)).isoformat())
    generated_at = now_iso(); client = CNInfoClient(CACHE_ROOT / "raw", delay=args.delay); result = dict(existing)
    for index, stock in enumerate(selected, 1):
        detail = fetch_one(client, stock, start, args.end, generated_at, not args.no_cache, args.performance_only, existing.get(stock["id"]))
        result[stock["id"]] = detail
        print(f"[{index}/{len(selected)}] {stock['code']} {stock['name']}: {detail['status']} ({len(detail['announcements'])} announcements)")
    for stock in universe:
        if stock["id"] not in result:
            result[stock["id"]] = fetch_one(client, stock, start, args.end, generated_at, not args.no_cache, args.performance_only, None)
    stage_root = CACHE_ROOT / f"stage-{int(time.time())}"
    if stage_root.exists(): shutil.rmtree(stage_root)
    stage_root.mkdir(parents=True)
    try:
        stage_summary, stage_detail, manifest = write_staged_artifacts(result, stage_root, generated_at)
        errors = validate_artifacts(stage_summary, stage_detail, expected)
        if errors:
            print("\n".join(errors), file=sys.stderr); return 1
        if not args.dry_run: publish(stage_summary, stage_detail, SUMMARY_OUTPUT, DETAIL_OUTPUT, CACHE_ROOT)
        elapsed = round(time.monotonic() - started, 2)
        print(json.dumps({"dryRun": args.dry_run, "elapsedSeconds": elapsed, "summaryOutput": str(SUMMARY_OUTPUT), "detailOutput": str(DETAIL_OUTPUT), **{key: manifest[key] for key in ("totalCompanies", "totalAnnouncements", "dateRange", "success", "partial", "error", "empty")}}, ensure_ascii=False, indent=2))
    finally:
        if stage_root.exists(): shutil.rmtree(stage_root)
    return 0


if __name__ == "__main__": raise SystemExit(main())
