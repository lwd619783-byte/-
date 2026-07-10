from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_financials.artifacts import (
    load_existing_split_items,
    publish_staged_artifacts,
    validate_split_artifacts,
    write_staged_artifacts,
)
from a_share_financials.core import build_company_record, build_summary, utc_now, validate_dataset
from a_share_financials.provider import ProviderError, SinaFinancialProvider

UNIVERSE_PATH = ROOT / "src/data/real/stock-universe.generated.json"
LEGACY_OUTPUT_PATH = ROOT / "src/data/real/a-share-financials.generated.json"
SUMMARY_OUTPUT_PATH = ROOT / "src/data/real/a-share-financial-summaries.generated.json"
DETAIL_OUTPUT_DIR = ROOT / "public/data/a-share-financials"
CACHE_PATH = ROOT / "data-cache/a-share-financials-v1"
STAGE_ROOT = ROOT / "data-cache"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch and atomically publish normalized A-share financial statements")
    parser.add_argument("--stock", help="Fetch one six-digit stock code while preserving every other company artifact")
    parser.add_argument("--period", help="Inspect one report period (YYYY-MM-DD or YYYYMMDD); requires --dry-run")
    parser.add_argument("--missing-only", action="store_true", help="Reuse successful existing records and refresh only missing/error records")
    parser.add_argument("--no-cache", action="store_true", help="Ignore provider response cache")
    parser.add_argument("--dry-run", action="store_true", help="Fetch, build and validate staged artifacts without replacing generated files")
    parser.add_argument("--max-reports", type=int, default=12)
    parser.add_argument("--timeout", type=float, default=15)
    parser.add_argument("--retries", type=int, default=2)
    return parser.parse_args()


def load_json(path: Path, fallback=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback


def load_existing_items() -> dict[str, dict]:
    split = load_existing_split_items(DETAIL_OUTPUT_DIR)
    if split:
        return split
    legacy = load_json(LEGACY_OUTPUT_PATH, {}) or {}
    return legacy.get("items", {})


def error_record(stock: dict, provider: SinaFinancialProvider, fetched_at: str, generated_at: str, message: str) -> dict:
    return {
        "id": stock["id"], "stockCode": stock["code"], "market": stock.get("exchange"), "companyName": stock["name"],
        "industryType": "general", "status": "fetch_error", "errorCode": "provider_request_failed", "errorMessage": message,
        "provider": "Sina CompanyFinanceService", "providerVersion": provider.version, "fetchedAt": fetched_at,
        "generatedAt": generated_at, "lastSuccessfulFetchAt": None, "currentFetchError": message, "reports": [],
        "quality": {"source": "Sina CompanyFinanceService", "sourceLayer": "provider", "sourceEndpoint": "CompanyFinanceService.getFinanceReport2022", "updatedAt": fetched_at, "status": "error", "errorMessage": message},
    }


def main() -> int:
    args = parse_args()
    if args.period and not args.dry_run:
        print("--period is an inspection filter and requires --dry-run to avoid truncating committed history", file=sys.stderr)
        return 2
    universe = load_json(UNIVERSE_PATH, {}).get("items", [])
    all_stocks = [x for x in universe if x.get("market") == "A股" and x.get("shouldFetchFinancials", True)]
    selected_stocks = all_stocks
    if args.stock:
        selected_stocks = [x for x in all_stocks if x.get("code") == args.stock]
        if not selected_stocks:
            print(f"Unknown or non-A-share stock code: {args.stock}", file=sys.stderr)
            return 2

    old_items = load_existing_items()
    provider = SinaFinancialProvider(CACHE_PATH, timeout=args.timeout, retries=args.retries)
    generated_at = utc_now()
    started = time.monotonic()
    # Single-stock and missing-only runs always preserve all existing companies.
    items = dict(old_items) if args.stock or args.missing_only else {}

    for index, stock in enumerate(selected_stocks, 1):
        existing = old_items.get(stock["id"])
        if args.missing_only and existing and existing.get("status") == "success":
            items[stock["id"]] = existing
            print(f"[{index}/{len(selected_stocks)}] {stock['code']} {stock['name']}: reused success")
            continue
        request_started_at = utc_now()
        try:
            raw = provider.fetch(stock, max_reports=args.max_reports, use_cache=not args.no_cache)
            fetched_at = provider.last_fetched_at or request_started_at
            record = build_company_record(stock, raw, fetched_at=fetched_at, generated_at=generated_at)
            if args.period:
                target = args.period.replace("-", "")
                record["reports"] = [report for report in record["reports"] if report["reportPeriod"].replace("-", "") == target]
                if not record["reports"]:
                    record.update(status="partial", errorCode="period_not_found", errorMessage=f"Report period {args.period} not returned")
            items[stock["id"]] = record
            print(f"[{index}/{len(selected_stocks)}] {stock['code']} {stock['name']}: {record['status']} ({len(record['reports'])} reports)")
        except ProviderError as exc:
            if existing and existing.get("reports"):
                record = dict(existing)
                record.update(status="stale", generatedAt=generated_at, currentFetchError=str(exc), errorCode="current_fetch_failed", errorMessage=str(exc))
                record["quality"] = {**record.get("quality", {}), "status": "stale", "errorMessage": str(exc)}
            else:
                record = error_record(stock, provider, request_started_at, generated_at, str(exc))
            items[stock["id"]] = record
            print(f"[{index}/{len(selected_stocks)}] {stock['code']} {stock['name']}: {record['status']} - {exc}", file=sys.stderr)

    items = dict(sorted(items.items()))
    expected_ids = {stock["id"] for stock in all_stocks}
    dataset = {"items": items, "summary": build_summary(items)}
    structural_errors = validate_dataset(dataset, universe)
    if structural_errors:
        print("Structural validation failed:", file=sys.stderr)
        for error in structural_errors:
            print(f"- {error}", file=sys.stderr)
        return 3

    stage_root = STAGE_ROOT / f"a-share-financial-stage-{uuid.uuid4().hex}"
    stage_root.mkdir(parents=True, exist_ok=False)
    artifact_metrics: dict[str, int | float] = {}
    try:
        summary_path, manifest_path, detail_dir = write_staged_artifacts(items, generated_at, stage_root)
        split_errors = validate_split_artifacts(summary_path, manifest_path, detail_dir, expected_ids)
        if split_errors:
            print("Split artifact validation failed:", file=sys.stderr)
            for error in split_errors:
                print(f"- {error}", file=sys.stderr)
            return 4
        detail_files = [path for path in detail_dir.glob("*.json") if path.name != "manifest.generated.json"]
        detail_bytes = sum(path.stat().st_size for path in detail_files)
        artifact_metrics = {
            "summaryBytes": summary_path.stat().st_size,
            "detailFiles": len(detail_files),
            "detailBytes": detail_bytes,
            "averageDetailBytes": round(detail_bytes / len(detail_files), 2) if detail_files else 0,
        }
        if not args.dry_run:
            publish_staged_artifacts(summary_path, detail_dir, SUMMARY_OUTPUT_PATH, DETAIL_OUTPUT_DIR, STAGE_ROOT)
    finally:
        if stage_root.exists():
            shutil.rmtree(stage_root)

    elapsed = time.monotonic() - started
    print(json.dumps({
        "summaryOutput": str(SUMMARY_OUTPUT_PATH), "detailOutput": str(DETAIL_OUTPUT_DIR), "dryRun": args.dry_run,
        "elapsedSeconds": round(elapsed, 2), **artifact_metrics,
        **dataset["summary"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
