from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_institution_consensus_probe.core import (
    PROBE_SCHEMA_VERSION,
    ProbeContractError,
    compare_rounding,
    extract_ths_contract,
    normalize_ths_contract,
    parse_eastmoney_aggregate,
    parse_eastmoney_reports,
    validate_probe_date,
)

USER_AGENT = "investment-research-dashboard-consensus-contract-probe/1.0 (+public-source-audit; no-cookie)"
DEFAULT_CODES = ["601138", "002463", "300502", "688165", "603259", "605288", "603286"]
DEFAULT_CACHE = ROOT / "data-cache" / "a-share-institution-consensus-probe"


def options() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe public A-share institution-consensus source contracts without producing provider data")
    parser.add_argument("--codes", nargs="+", default=DEFAULT_CODES)
    parser.add_argument("--as-of", default=date.today().isoformat())
    parser.add_argument("--timeout", type=float, default=15.0)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--delay", type=float, default=0.6)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    return parser.parse_args()


def subtract_six_calendar_months(value: str) -> str:
    parsed = date.fromisoformat(validate_probe_date(value))
    year, month = parsed.year, parsed.month - 6
    if month <= 0:
        year -= 1
        month += 12
    month_days = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(parsed.day, month_days[month - 1])).isoformat()


def load_universe() -> dict[str, dict[str, Any]]:
    payload = json.loads((ROOT / "src/data/real/stock-universe.generated.json").read_text(encoding="utf-8"))
    return {item["code"]: item for item in payload["items"] if item.get("market") == "A股"}


def fetch_public(url: str, *, timeout: float, retries: int, accept: str) -> tuple[bytes, dict[str, Any]]:
    if not url.startswith("https://"):
        raise ProbeContractError(f"only HTTPS public sources are allowed: {url}")
    retries = max(0, min(retries, 2))
    started = time.monotonic()
    failures: list[str] = []
    for attempt in range(retries + 1):
        try:
            response = requests.get(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": accept},
                timeout=timeout,
                allow_redirects=False,
            )
            if response.is_redirect or response.is_permanent_redirect:
                raise ProbeContractError(f"redirect refused: HTTP {response.status_code} -> {response.headers.get('Location', '')}")
            if response.status_code == 429 or response.status_code >= 500:
                failures.append(f"HTTP {response.status_code}")
                if attempt < retries:
                    time.sleep(0.5 * (attempt + 1))
                    continue
            if response.status_code != 200:
                raise ProbeContractError(f"HTTP {response.status_code}")
            return response.content, {
                "httpStatus": response.status_code,
                "contentType": response.headers.get("Content-Type"),
                "byteSize": len(response.content),
                "attempts": attempt + 1,
                "durationSeconds": round(time.monotonic() - started, 3),
                "finalUrl": response.url,
                "failures": failures,
            }
        except (requests.Timeout, requests.ConnectionError) as exc:
            failures.append(type(exc).__name__)
            if attempt >= retries:
                raise ProbeContractError(f"network failure after {attempt + 1} attempts: {type(exc).__name__}") from exc
            time.sleep(0.5 * (attempt + 1))
    raise ProbeContractError("public fetch exhausted without a response")


def json_payload(content: bytes, label: str) -> Any:
    try:
        return json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProbeContractError(f"{label} did not return valid UTF-8 JSON") from exc


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
        "industryCode": "*", "pageSize": "100", "industry": "*", "rating": "", "ratingChange": "",
        "beginTime": start, "endTime": as_of, "pageNo": "1", "fields": "", "qType": "0", "orgCode": "", "code": code, "rcode": "",
    }
    urls = {
        "eastmoneyAggregate": "https://datacenter-web.eastmoney.com/api/data/v1/get?" + urlencode(aggregate_params),
        "eastmoneyReports": "https://reportapi.eastmoney.com/report/list?" + urlencode(report_params),
        "ths": f"https://basic.10jqka.com.cn/{code}/worth.html",
    }
    output: dict[str, Any] = {
        "stock": {key: company[key] for key in ("id", "name", "code", "exchange", "standardSymbol")},
        "window": {"startInclusive": start, "endInclusive": as_of, "semantics": "six calendar months, page statement independently checked"},
        "sourcePages": {"eastmoney": f"https://data.eastmoney.com/report/{code}.html", "ths": urls["ths"]},
        "sources": {},
    }
    for source_name, url in urls.items():
        time.sleep(max(0.0, args.delay))
        suffix = "html" if source_name == "ths" else "json"
        try:
            content, transport = fetch_public(url, timeout=args.timeout, retries=args.retries, accept="text/html" if source_name == "ths" else "application/json")
            write_cache(cache_root / "raw" / f"{code}-{source_name}.{suffix}", content)
            if source_name == "eastmoneyAggregate":
                normalized = parse_eastmoney_aggregate(json_payload(content, source_name), code)
            elif source_name == "eastmoneyReports":
                normalized = parse_eastmoney_reports(json_payload(content, source_name), code)
            else:
                html = content.decode("gbk", errors="replace")
                normalized = normalize_ths_contract(extract_ths_contract(html, code), code)
            output["sources"][source_name] = {"status": "success", "transport": transport, "normalized": normalized}
        except Exception as exc:
            output["sources"][source_name] = {"status": "failed", "errorType": type(exc).__name__, "message": str(exc)}
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
    as_of = validate_probe_date(args.as_of)
    universe = load_universe()
    unknown = sorted(set(args.codes) - set(universe))
    if unknown:
        print(f"codes are outside the committed A-share universe: {', '.join(unknown)}", file=sys.stderr)
        return 2
    cache_root = args.cache_dir.resolve()
    allowed_root = (ROOT / "data-cache").resolve()
    if cache_root != allowed_root and allowed_root not in cache_root.parents:
        print("cache directory must stay under gitignored data-cache/", file=sys.stderr)
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
