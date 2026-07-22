from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_institution_consensus_probe.core import (
    PROBE_SCHEMA_VERSION,
    USER_AGENT,
    PaginationContractError,
    ProbeContractError,
    collect_eastmoney_report_pages,
    compare_rounding,
    extract_ths_contract,
    fetch_public,
    json_payload,
    normalize_ths_contract,
    parse_eastmoney_aggregate,
    parse_eastmoney_reports,
    resolve_probe_date,
    subtract_six_calendar_months,
    validate_cache_root,
)

DEFAULT_CODES = ["601138", "002463", "300502", "688165", "603259", "605288", "603286"]
DEFAULT_CACHE = ROOT / "data-cache" / "a-share-institution-consensus-probe"
EASTMONEY_REPORT_PAGE_SIZE = 100


def options(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe public A-share institution-consensus source contracts without producing provider data")
    parser.add_argument("--codes", nargs="+", default=DEFAULT_CODES)
    parser.add_argument("--as-of", default=None)
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--delay", type=float, default=0.6)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    return parser.parse_args(argv)


def load_universe() -> dict[str, dict[str, Any]]:
    payload = json.loads((ROOT / "src/data/real/stock-universe.generated.json").read_text(encoding="utf-8"))
    return {item["code"]: item for item in payload["items"] if item.get("market") == "A股"}


def write_cache(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def probe_one(code: str, company: dict[str, Any], as_of: str, args: argparse.Namespace, cache_root: Path) -> dict[str, Any]:
    start = subtract_six_calendar_months(as_of)
    aggregate_params = {
        "reportName": "RPT_WEB_RESPREDICT",
        "columns": "WEB_RESPREDICT",
        "pageNumber": "1",
        "pageSize": "20",
        "sortTypes": "-1",
        "sortColumns": "RATING_ORG_NUM",
        "filter": f'(SECURITY_CODE="{code}")',
    }
    report_params = {
        "industryCode": "*", "pageSize": str(EASTMONEY_REPORT_PAGE_SIZE), "industry": "*", "rating": "", "ratingChange": "",
        "beginTime": start, "endTime": as_of, "fields": "", "qType": "0", "orgCode": "", "code": code, "rcode": "",
    }
    aggregate_url = "https://datacenter-web.eastmoney.com/api/data/v1/get?" + urlencode(aggregate_params)
    ths_url = f"https://basic.10jqka.com.cn/{code}/worth.html"
    output: dict[str, Any] = {
        "stock": {key: company[key] for key in ("id", "name", "code", "exchange", "standardSymbol")},
        "window": {"startInclusive": start, "endInclusive": as_of, "semantics": "six calendar months, page statement independently checked"},
        "sourcePages": {"eastmoney": f"https://data.eastmoney.com/report/{code}.html", "ths": ths_url},
        "sources": {},
    }

    for source_name, url in (("eastmoneyAggregate", aggregate_url), ("ths", ths_url)):
        time.sleep(max(0.0, args.delay))
        suffix = "html" if source_name == "ths" else "json"
        try:
            content, transport = fetch_public(url, timeout=args.timeout, retries=args.retries, accept="text/html" if source_name == "ths" else "application/json")
            write_cache(cache_root / "raw" / f"{code}-{source_name}.{suffix}", content)
            if source_name == "eastmoneyAggregate":
                normalized = parse_eastmoney_aggregate(json_payload(content, source_name), code)
            else:
                html = content.decode("gbk", errors="replace")
                normalized = normalize_ths_contract(extract_ths_contract(html, code), code)
            output["sources"][source_name] = {"status": "success", "transport": transport, "normalized": normalized}
        except Exception as exc:
            output["sources"][source_name] = {"status": "failed", "errorType": type(exc).__name__, "message": str(exc)}

    time.sleep(max(0.0, args.delay))

    def fetch_report_page(page_no: int) -> tuple[Any, dict[str, Any], bytes]:
        page_params = {**report_params, "pageNo": str(page_no)}
        url = "https://reportapi.eastmoney.com/report/list?" + urlencode(page_params)
        content, transport = fetch_public(url, timeout=args.timeout, retries=args.retries, accept="application/json")
        return json_payload(content, f"eastmoneyReports page {page_no}"), transport, content

    try:
        combined_reports, report_pages = collect_eastmoney_report_pages(
            fetch_report_page,
            expected_code=code,
            requested_page_size=EASTMONEY_REPORT_PAGE_SIZE,
            delay=args.delay,
        )
        for page in report_pages:
            write_cache(cache_root / "raw" / f"{code}-eastmoneyReports-page-{page['pageNo']}.json", page["rawContent"])
        normalized = parse_eastmoney_reports(combined_reports, code)
        output["sources"]["eastmoneyReports"] = {
            "status": "success",
            "transport": {
                "pageCount": len(report_pages),
                "pages": [{"pageNo": page["pageNo"], **page["transport"]} for page in report_pages],
            },
            "normalized": normalized,
        }
    except PaginationContractError as exc:
        output["sources"]["eastmoneyReports"] = {
            "status": "failed",
            "errorType": type(exc).__name__,
            "message": str(exc),
            "pagination": exc.details,
        }
    except Exception as exc:
        output["sources"]["eastmoneyReports"] = {"status": "failed", "errorType": type(exc).__name__, "message": str(exc)}
    aggregate = output["sources"].get("eastmoneyAggregate", {}).get("normalized", {})
    reports = output["sources"].get("eastmoneyReports", {}).get("normalized", {})
    ths = output["sources"].get("ths", {}).get("normalized", {})
    year = str(ths.get("forecastYear") or reports.get("currentYear") or as_of[:4])
    east_eps = next((row for row in aggregate.get("forecasts", []) if str(row.get("year")) == year), None)
    east_detail_stats = reports.get("statisticsByYear", {}).get(year)
    output["crossChecks"] = {
        "targetYear": year,
        "eastmoneyAggregateVsLatestReportMeanRounded3": compare_rounding({"mean": east_eps.get("eps") if east_eps else None}, east_detail_stats or {}, 3),
        "eastmoneyAggregateInstitutionCount": aggregate.get("institutionCount"),
        "eastmoneyVisibleDistinctInstitutionCount": reports.get("distinctInstitutionCount"),
        "thsInstitutionCount": ths.get("institutionCount"),
        "thsVisibleDistinctInstitutionCount": ths.get("visibleDistinctInstitutionCount"),
        "thsVisibleDetailsRecomputeDisplay": ths.get("visibleDetailRecomputesDisplay"),
    }
    return output


def main() -> int:
    args = options()
    try:
        as_of = resolve_probe_date(args.as_of)
    except ProbeContractError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    universe = load_universe()
    unknown = sorted(set(args.codes) - set(universe))
    if unknown:
        print(f"codes are outside the committed A-share universe: {', '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        cache_root = validate_cache_root(args.cache_dir, ROOT / "data-cache")
    except ProbeContractError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    result = {
        "schemaVersion": PROBE_SCHEMA_VERSION,
        "probeOnly": True,
        "providerArtifactsProduced": False,
        "asOfDate": as_of,
        "userAgent": USER_AGENT,
        "requestPolicy": {"timeoutSeconds": args.timeout, "maximumRetries": max(0, min(args.retries, 2)), "serialDelaySeconds": max(0.0, args.delay), "cookies": False, "authentication": False},
        "samples": [probe_one(code, universe[code], as_of, args, cache_root) for code in args.codes],
    }
    result_path = cache_root / "probe-summary.json"
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 1 if any(source.get("status") != "success" for sample in result["samples"] for source in sample["sources"].values()) else 0


if __name__ == "__main__":
    raise SystemExit(main())
