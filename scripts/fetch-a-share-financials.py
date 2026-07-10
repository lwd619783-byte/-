from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_financials.core import SCHEMA_VERSION, build_company_record, build_summary, utc_now, validate_dataset
from a_share_financials.provider import ProviderError, SinaFinancialProvider

UNIVERSE_PATH = ROOT / "src/data/real/stock-universe.generated.json"
OUTPUT_PATH = ROOT / "src/data/real/a-share-financials.generated.json"
CACHE_PATH = ROOT / "data-cache/a-share-financials-v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch normalized A-share financial statements")
    parser.add_argument("--stock", help="Fetch one six-digit stock code")
    parser.add_argument("--period", help="Keep one report period (YYYY-MM-DD or YYYYMMDD)")
    parser.add_argument("--missing-only", action="store_true", help="Reuse successful existing records")
    parser.add_argument("--no-cache", action="store_true", help="Ignore provider response cache")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and validate without writing generated JSON")
    parser.add_argument("--max-reports", type=int, default=12)
    parser.add_argument("--timeout", type=float, default=15)
    parser.add_argument("--retries", type=int, default=2)
    return parser.parse_args()


def load_json(path: Path, fallback=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback


def main() -> int:
    args = parse_args()
    universe = load_json(UNIVERSE_PATH, {}).get("items", [])
    stocks = [x for x in universe if x.get("market") == "A股" and x.get("shouldFetchFinancials", True)]
    if args.stock:
        stocks = [x for x in stocks if x.get("code") == args.stock]
        if not stocks:
            print(f"Unknown or non-A-share stock code: {args.stock}", file=sys.stderr)
            return 2
    old_dataset = load_json(OUTPUT_PATH, {}) or {}
    old_items = old_dataset.get("items", {})
    provider = SinaFinancialProvider(CACHE_PATH, timeout=args.timeout, retries=args.retries)
    generated_at = utc_now()
    started = time.monotonic()
    items = {} if not args.stock else dict(old_items)
    for index, stock in enumerate(stocks, 1):
        if args.missing_only and old_items.get(stock["id"], {}).get("status") == "success":
            items[stock["id"]] = old_items[stock["id"]]
            print(f"[{index}/{len(stocks)}] {stock['code']} {stock['name']}: reused success")
            continue
        request_started_at = utc_now()
        try:
            raw = provider.fetch(stock, max_reports=args.max_reports, use_cache=not args.no_cache)
            fetched_at = provider.last_fetched_at or request_started_at
            record = build_company_record(stock, raw, fetched_at=fetched_at, generated_at=generated_at)
            if args.period:
                target = args.period.replace("-", "")
                record["reports"] = [r for r in record["reports"] if r["reportPeriod"].replace("-", "") == target]
                if not record["reports"]:
                    record.update(status="partial", errorCode="period_not_found", errorMessage=f"Report period {args.period} not returned")
            items[stock["id"]] = record
            print(f"[{index}/{len(stocks)}] {stock['code']} {stock['name']}: {record['status']} ({len(record['reports'])} reports)")
        except ProviderError as exc:
            previous = old_items.get(stock["id"])
            if previous and previous.get("reports"):
                record = dict(previous)
                record.update(status="stale", generatedAt=generated_at, currentFetchError=str(exc), errorCode="current_fetch_failed", errorMessage=str(exc))
                record["quality"] = {**record.get("quality", {}), "status": "stale", "errorMessage": str(exc)}
            else:
                record = {"id": stock["id"], "stockCode": stock["code"], "market": stock.get("exchange"), "companyName": stock["name"], "industryType": "general", "status": "fetch_error", "errorCode": "provider_request_failed", "errorMessage": str(exc), "provider": "Sina CompanyFinanceService", "providerVersion": provider.version, "fetchedAt": request_started_at, "generatedAt": generated_at, "lastSuccessfulFetchAt": None, "currentFetchError": str(exc), "reports": [], "quality": {"source": "Sina CompanyFinanceService", "sourceLayer": "provider", "sourceEndpoint": "CompanyFinanceService.getFinanceReport2022", "updatedAt": request_started_at, "status": "error", "errorMessage": str(exc)}}
            items[stock["id"]] = record
            print(f"[{index}/{len(stocks)}] {stock['code']} {stock['name']}: {record['status']} - {exc}", file=sys.stderr)
    items = dict(sorted(items.items()))
    dataset = {"schemaVersion": SCHEMA_VERSION, "generatedAt": generated_at, "provider": "Sina CompanyFinanceService", "providerVersion": provider.version, "items": items}
    dataset["summary"] = build_summary(items)
    errors = validate_dataset(dataset, universe) if not args.stock else []
    if errors:
        print("Structural validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 3
    serialized = json.dumps(dataset, ensure_ascii=False, indent=2, sort_keys=False, allow_nan=False) + "\n"
    if not args.dry_run:
        OUTPUT_PATH.write_text(serialized, encoding="utf-8")
    elapsed = time.monotonic() - started
    print(json.dumps({"output": str(OUTPUT_PATH), "dryRun": args.dry_run, "elapsedSeconds": round(elapsed, 2), **dataset["summary"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
