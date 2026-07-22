from __future__ import annotations

import math
import json
import re
import statistics
import time
import unicodedata
from collections import Counter
from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests

PROBE_SCHEMA_VERSION = "1.1.0"
MISSING_TEXT = {"", "-", "--", "null", "none", "nan", "false"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
USER_AGENT = "investment-research-dashboard-consensus-contract-probe/1.0 (+public-source-audit; no-cookie)"
SHANGHAI_TIME_ZONE = ZoneInfo("Asia/Shanghai")
MAX_EASTMONEY_REPORT_PAGES = 20
MAX_EASTMONEY_REPORT_RECORDS = 2_000
MAX_THS_FORECAST_YEARS = 5
REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class ProbeContractError(ValueError):
    """The public response did not satisfy the minimum probe contract."""


class PaginationContractError(ProbeContractError):
    """Eastmoney pagination was not proven complete."""

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.details = details or {
            "paginationStatus": "failed",
            "complete": False,
        }


def normalize_identity(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip()).casefold()


def validate_probe_date(value: str) -> str:
    if not isinstance(value, str) or not DATE.fullmatch(value):
        raise ProbeContractError(f"invalid probe date: {value}")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ProbeContractError(f"invalid probe date: {value}") from None
    return value


def shanghai_calendar_date(clock: Callable[[ZoneInfo], datetime] | None = None) -> str:
    current = datetime.now(SHANGHAI_TIME_ZONE) if clock is None else clock(SHANGHAI_TIME_ZONE)
    if not isinstance(current, datetime) or current.tzinfo is None:
        raise ProbeContractError("probe clock must return a timezone-aware datetime")
    return current.astimezone(SHANGHAI_TIME_ZONE).date().isoformat()


def resolve_probe_date(value: str | None, clock: Callable[[ZoneInfo], datetime] | None = None) -> str:
    return validate_probe_date(value) if value is not None else shanghai_calendar_date(clock)


def subtract_six_calendar_months(value: str) -> str:
    parsed = date.fromisoformat(validate_probe_date(value))
    year, month = parsed.year, parsed.month - 6
    if month <= 0:
        year -= 1
        month += 12
    month_days = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(parsed.day, month_days[month - 1])).isoformat()


def validate_cache_root(cache_dir: Path, allowed_root: Path) -> Path:
    candidate = cache_dir.resolve()
    allowed = allowed_root.resolve()
    if candidate != allowed and allowed not in candidate.parents:
        raise ProbeContractError("cache directory must stay under gitignored data-cache/")
    return candidate


def fetch_public(
    url: str,
    *,
    timeout: float,
    retries: int,
    accept: str,
    get: Callable[..., Any] = requests.get,
    sleeper: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
) -> tuple[bytes, dict[str, Any]]:
    parsed_url = urlparse(url)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        raise ProbeContractError(f"only HTTPS public sources are allowed: {url}")
    if not isinstance(retries, int):
        raise ProbeContractError("retries must be an integer")
    maximum_retries = max(0, min(retries, 2))
    if not isinstance(timeout, (int, float)) or isinstance(timeout, bool) or not math.isfinite(float(timeout)) or timeout <= 0:
        raise ProbeContractError("timeout must be a positive finite number")
    if not isinstance(accept, str) or not accept.strip():
        raise ProbeContractError("Accept header is required")
    started = monotonic()
    failures: list[str] = []
    for attempt in range(maximum_retries + 1):
        try:
            response = get(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": accept},
                timeout=timeout,
                allow_redirects=False,
            )
            status_code = getattr(response, "status_code", None)
            if status_code in REDIRECT_STATUSES or bool(getattr(response, "is_redirect", False)) or bool(getattr(response, "is_permanent_redirect", False)):
                location = getattr(response, "headers", {}).get("Location", "")
                raise ProbeContractError(f"redirect refused: HTTP {status_code} -> {location}")
            if status_code == 429 or (isinstance(status_code, int) and status_code >= 500):
                failures.append(f"HTTP {status_code}")
                if attempt < maximum_retries:
                    sleeper(0.5 * (attempt + 1))
                    continue
            if status_code != 200:
                raise ProbeContractError(f"HTTP {status_code}")
            final_url = str(getattr(response, "url", url))
            if urlparse(final_url).scheme != "https":
                raise ProbeContractError(f"non-HTTPS final URL refused: {final_url}")
            content = bytes(getattr(response, "content", b""))
            headers = getattr(response, "headers", {})
            return content, {
                "httpStatus": status_code,
                "contentType": headers.get("Content-Type"),
                "byteSize": len(content),
                "attempts": attempt + 1,
                "durationSeconds": round(monotonic() - started, 3),
                "finalUrl": final_url,
                "failures": failures,
            }
        except (requests.Timeout, requests.ConnectionError) as exc:
            failures.append(type(exc).__name__)
            if attempt >= maximum_retries:
                raise ProbeContractError(f"network failure after {attempt + 1} attempts: {type(exc).__name__}") from exc
            sleeper(0.5 * (attempt + 1))
    raise ProbeContractError("public fetch exhausted without a response")


def json_payload(content: bytes, label: str) -> Any:
    try:
        return json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProbeContractError(f"{label} did not return valid UTF-8 JSON") from exc


def _strict_int(value: Any, label: str, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise PaginationContractError(f"Eastmoney {label} is invalid")
    return value


def _pagination_details(
    *,
    status: str,
    expected_pages: int | None,
    fetched_pages: int,
    expected_records: int | None,
    fetched_records: int,
    page_size: int,
) -> dict[str, Any]:
    return {
        "paginationStatus": status,
        "expectedPageCount": expected_pages,
        "fetchedPageCount": fetched_pages,
        "expectedRecordCount": expected_records,
        "fetchedRecordCount": fetched_records,
        "requestedPageSize": page_size,
        "complete": status in {"complete", "complete_empty"},
    }


def _validate_eastmoney_report_page(
    payload: Any,
    *,
    expected_code: str,
    expected_page_no: int,
    requested_page_size: int,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise PaginationContractError("Eastmoney report-list page is not an object")
    required = {"hits", "size", "TotalPage", "pageNo", "currentYear", "data"}
    missing = sorted(required - set(payload))
    if missing:
        raise PaginationContractError(f"Eastmoney pagination metadata is missing: {', '.join(missing)}")
    hits = _strict_int(payload["hits"], "hits")
    page_record_count = _strict_int(payload["size"], "size")
    total_pages = _strict_int(payload["TotalPage"], "TotalPage")
    page_no = _strict_int(payload["pageNo"], "pageNo", 1)
    current_year = _strict_int(payload["currentYear"], "currentYear", 2000)
    if current_year > 2100:
        raise PaginationContractError("Eastmoney currentYear is invalid")
    if page_no != expected_page_no:
        raise PaginationContractError(f"Eastmoney page number mismatch: expected {expected_page_no}, got {page_no}")
    rows = payload["data"]
    if not isinstance(rows, list):
        raise PaginationContractError("Eastmoney report-list data is missing")
    if page_record_count != len(rows):
        raise PaginationContractError("Eastmoney page size does not equal its data length")
    if hits == 0:
        if expected_page_no != 1 or total_pages != 0 or page_record_count != 0 or rows:
            raise PaginationContractError("Eastmoney empty-result pagination is inconsistent")
        return {
            "hits": hits,
            "pageRecordCount": page_record_count,
            "totalPages": total_pages,
            "pageNo": page_no,
            "currentYear": current_year,
            "rows": rows,
            "rowSchema": None,
        }
    calculated_pages = math.ceil(hits / requested_page_size)
    if total_pages != calculated_pages or total_pages < 1:
        raise PaginationContractError("Eastmoney TotalPage does not match hits and requested pageSize")
    expected_records_on_page = requested_page_size if page_no < total_pages else hits - requested_page_size * (total_pages - 1)
    if page_record_count != expected_records_on_page or not rows:
        raise PaginationContractError("Eastmoney page record count is inconsistent with pagination metadata")
    row_schema: tuple[str, ...] | None = None
    for row in rows:
        if not isinstance(row, dict):
            raise PaginationContractError("Eastmoney report-list row is not an object")
        if str(row.get("stockCode", "")) != expected_code:
            raise PaginationContractError("Eastmoney report-list stock identity mismatch")
        report_id = str(row.get("infoCode") or "").strip()
        if not report_id:
            raise PaginationContractError("Eastmoney report-list stable report ID is missing")
        keys = tuple(sorted(row))
        if row_schema is None:
            row_schema = keys
        elif keys != row_schema:
            raise PaginationContractError("Eastmoney report-list schema drifted within a page")
    return {
        "hits": hits,
        "pageRecordCount": page_record_count,
        "totalPages": total_pages,
        "pageNo": page_no,
        "currentYear": current_year,
        "rows": rows,
        "rowSchema": row_schema,
    }


def collect_eastmoney_report_pages(
    fetch_page: Callable[[int], tuple[Any, dict[str, Any], bytes]],
    *,
    expected_code: str,
    requested_page_size: int = 100,
    max_pages: int = MAX_EASTMONEY_REPORT_PAGES,
    max_records: int = MAX_EASTMONEY_REPORT_RECORDS,
    delay: float = 0.0,
    sleeper: Callable[[float], None] = time.sleep,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not isinstance(requested_page_size, int) or isinstance(requested_page_size, bool) or requested_page_size < 1:
        raise PaginationContractError("Eastmoney requested pageSize is invalid")
    if max_pages < 1 or max_records < 1:
        raise PaginationContractError("Eastmoney pagination safety limits are invalid")
    pages: list[dict[str, Any]] = []
    all_rows: list[dict[str, Any]] = []
    page_fingerprints: set[str] = set()
    report_ids: set[str] = set()
    expected_total_pages: int | None = None
    expected_hits: int | None = None
    expected_current_year: int | None = None
    expected_schema: tuple[str, ...] | None = None

    def fail(message: str) -> PaginationContractError:
        return PaginationContractError(
            message,
            _pagination_details(
                status="failed",
                expected_pages=expected_total_pages,
                fetched_pages=len(pages),
                expected_records=expected_hits,
                fetched_records=len(all_rows),
                page_size=requested_page_size,
            ),
        )

    page_no = 1
    while True:
        if page_no > 1:
            sleeper(max(0.0, delay))
        try:
            payload, transport, raw_content = fetch_page(page_no)
            page = _validate_eastmoney_report_page(
                payload,
                expected_code=expected_code,
                expected_page_no=page_no,
                requested_page_size=requested_page_size,
            )
        except PaginationContractError as exc:
            if exc.details.get("fetchedPageCount") is not None:
                raise
            raise fail(str(exc)) from exc
        except Exception as exc:
            raise fail(f"Eastmoney page {page_no} fetch failed: {type(exc).__name__}: {exc}") from exc

        if page_no == 1:
            expected_total_pages = page["totalPages"]
            expected_hits = page["hits"]
            expected_current_year = page["currentYear"]
            expected_schema = page["rowSchema"]
            if expected_total_pages > max_pages:
                raise fail(f"Eastmoney TotalPage exceeds safety limit {max_pages}")
            if expected_hits > max_records:
                raise fail(f"Eastmoney hits exceeds safety limit {max_records}")
        else:
            if page["totalPages"] != expected_total_pages:
                raise fail("Eastmoney TotalPage changed across pages")
            if page["hits"] != expected_hits:
                raise fail("Eastmoney hits changed across pages")
            if page["currentYear"] != expected_current_year:
                raise fail("Eastmoney currentYear changed across pages")
            if page["rowSchema"] != expected_schema:
                raise fail("Eastmoney report-list schema drifted across pages")

        fingerprint = json.dumps(page["rows"], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        if fingerprint in page_fingerprints:
            raise fail("Eastmoney returned a duplicate page")
        page_fingerprints.add(fingerprint)
        for row in page["rows"]:
            report_id = str(row["infoCode"]).strip()
            if report_id in report_ids:
                raise fail(f"Eastmoney duplicate report ID across pagination: {report_id}")
            report_ids.add(report_id)
        all_rows.extend(page["rows"])
        pages.append({"pageNo": page_no, "recordCount": page["pageRecordCount"], "transport": transport, "rawContent": raw_content})

        if expected_total_pages == 0 or page_no == expected_total_pages:
            break
        page_no += 1

    if expected_hits is None or expected_total_pages is None or expected_current_year is None:
        raise fail("Eastmoney pagination metadata was not established")
    if len(all_rows) != expected_hits:
        raise fail("Eastmoney fetched record count does not equal declared hits")
    status = "complete_empty" if expected_hits == 0 else "complete"
    combined = {
        "stockCode": expected_code,
        "currentYear": expected_current_year,
        "data": all_rows,
        "pageRecordCounts": [{"pageNo": page["pageNo"], "recordCount": page["recordCount"]} for page in pages],
        **_pagination_details(
            status=status,
            expected_pages=expected_total_pages,
            fetched_pages=len(pages),
            expected_records=expected_hits,
            fetched_records=len(all_rows),
            page_size=requested_page_size,
        ),
    }
    return combined, pages


def parse_number(value: Any) -> float | None:
    if value is None or value is False:
        return None
    text = unicodedata.normalize("NFKC", str(value)).strip().replace(",", "")
    if text.casefold() in MISSING_TEXT:
        return None
    try:
        result = float(Decimal(text))
    except (InvalidOperation, ValueError):
        raise ProbeContractError(f"invalid numeric value: {value!r}") from None
    if not math.isfinite(result):
        raise ProbeContractError(f"non-finite numeric value: {value!r}")
    return result


def parse_amount_to_yuan(value: Any, default_unit: str | None = None) -> float | None:
    if value is None or value is False:
        return None
    text = unicodedata.normalize("NFKC", str(value)).strip().replace(",", "")
    if text.casefold() in MISSING_TEXT:
        return None
    unit = default_unit
    for suffix in ("万亿元", "万亿", "亿元", "亿", "万元", "万", "元"):
        if text.endswith(suffix):
            text = text[: -len(suffix)].strip()
            unit = suffix
            break
    number = parse_number(text)
    if number is None:
        return None
    factors = {
        None: 1.0,
        "元": 1.0,
        "万": 10_000.0,
        "万元": 10_000.0,
        "亿": 100_000_000.0,
        "亿元": 100_000_000.0,
        "万亿": 1_000_000_000_000.0,
        "万亿元": 1_000_000_000_000.0,
    }
    if unit not in factors:
        raise ProbeContractError(f"unsupported amount unit: {unit!r}")
    result = number * factors[unit]
    if not math.isfinite(result):
        raise ProbeContractError(f"non-finite normalized amount: {value!r}")
    return result


def calculate_statistics(values: list[float]) -> dict[str, float | int | None]:
    finite = [float(value) for value in values if math.isfinite(float(value))]
    if not finite:
        return {"count": 0, "mean": None, "median": None, "populationStdDev": None, "minimum": None, "maximum": None}
    return {
        "count": len(finite),
        "mean": statistics.fmean(finite),
        "median": statistics.median(finite),
        "populationStdDev": statistics.pstdev(finite),
        "minimum": min(finite),
        "maximum": max(finite),
    }


def latest_by_institution(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        key = normalize_identity(str(record.get("institution", "")))
        if not key:
            raise ProbeContractError("institution name is required")
        report_date = str(record.get("reportDate", ""))
        validate_probe_date(report_date)
        grouped.setdefault(key, []).append(record)
    selected: list[dict[str, Any]] = []
    for key, institution_records in grouped.items():
        by_date: dict[str, list[dict[str, Any]]] = {}
        for record in institution_records:
            by_date.setdefault(str(record["reportDate"]), []).append(record)
        for report_date, same_day in by_date.items():
            if len(same_day) == 1:
                continue
            report_ids = [str(record.get("reportId") or "").strip() for record in same_day]
            if any(not report_id for report_id in report_ids):
                raise ProbeContractError(f"same-institution same-day reports lack stable report IDs: {key} {report_date}")
            if len(set(report_ids)) != len(report_ids):
                by_id: dict[str, list[str]] = {}
                for report_id, record in zip(report_ids, same_day, strict=True):
                    canonical = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                    by_id.setdefault(report_id, []).append(canonical)
                if any(len(set(contents)) > 1 for contents in by_id.values()):
                    raise ProbeContractError(f"duplicate report ID has conflicting content: {key} {report_date}")
                raise ProbeContractError(f"same-institution same-day report IDs are not unique: {key} {report_date}")
            raise ProbeContractError(f"same-institution same-day reports are ambiguous without upstream ordering semantics: {key} {report_date}")
        latest_date = max(by_date)
        selected.append(by_date[latest_date][0])
    return sorted(selected, key=lambda item: (normalize_identity(item["institution"]), item["reportDate"]))


def parse_eastmoney_aggregate(payload: Any, expected_code: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ProbeContractError("Eastmoney aggregate response is not successful")
    if payload.get("success") is False and payload.get("result") is None and payload.get("code") == 9201 and "数据为空" in str(payload.get("message", "")):
        return {"availability": "no_forecast", "stockCode": expected_code, "institutionCount": 0, "forecasts": []}
    if payload.get("success") is not True:
        raise ProbeContractError("Eastmoney aggregate response is not successful")
    result = payload.get("result")
    if result is None:
        return {"availability": "no_forecast", "stockCode": expected_code, "institutionCount": 0, "forecasts": []}
    if not isinstance(result, dict) or not isinstance(result.get("data"), list):
        raise ProbeContractError("Eastmoney aggregate result.data is missing")
    rows = result["data"]
    if not rows:
        return {"availability": "no_forecast", "stockCode": expected_code, "institutionCount": 0, "forecasts": []}
    if len(rows) != 1 or not isinstance(rows[0], dict):
        raise ProbeContractError("Eastmoney aggregate query did not return exactly one stock")
    row = rows[0]
    if str(row.get("SECURITY_CODE", "")) != expected_code or not str(row.get("SECURITY_NAME_ABBR", "")).strip():
        raise ProbeContractError("Eastmoney aggregate stock identity mismatch")
    institution_count = row.get("RATING_ORG_NUM")
    if not isinstance(institution_count, int) or institution_count < 0:
        raise ProbeContractError("Eastmoney RATING_ORG_NUM is invalid")
    forecasts = []
    for index in range(1, 5):
        year = row.get(f"YEAR{index}")
        if year is None:
            continue
        if not isinstance(year, int) or year < 2000 or year > 2100:
            raise ProbeContractError(f"Eastmoney YEAR{index} is invalid")
        forecasts.append({"year": year, "mark": row.get(f"YEAR_MARK{index}"), "eps": parse_number(row.get(f"EPS{index}")), "rawUnit": "CNY/share"})
    if not forecasts:
        raise ProbeContractError("Eastmoney aggregate has no forecast-year fields")
    return {
        "availability": "available",
        "stockCode": expected_code,
        "companyName": str(row["SECURITY_NAME_ABBR"]).strip(),
        "institutionCount": institution_count,
        "forecasts": forecasts,
    }


def parse_eastmoney_reports(payload: Any, expected_code: str) -> dict[str, Any]:
    if not isinstance(payload, dict) or payload.get("complete") is not True or payload.get("paginationStatus") not in {"complete", "complete_empty"}:
        raise ProbeContractError("Eastmoney report-list pagination is not proven complete")
    if not isinstance(payload.get("data"), list):
        raise ProbeContractError("Eastmoney report-list data is missing")
    expected_record_count = payload.get("expectedRecordCount")
    fetched_record_count = payload.get("fetchedRecordCount")
    if not isinstance(expected_record_count, int) or isinstance(expected_record_count, bool) or expected_record_count < 0:
        raise ProbeContractError("Eastmoney expectedRecordCount is invalid")
    if fetched_record_count != expected_record_count or len(payload["data"]) != expected_record_count:
        raise ProbeContractError("Eastmoney report-list pagination counts are inconsistent")
    current_year = payload.get("currentYear")
    if not isinstance(current_year, int) or current_year < 2000 or current_year > 2100:
        raise ProbeContractError("Eastmoney report-list currentYear is invalid")
    records = []
    for row in payload["data"]:
        if not isinstance(row, dict) or str(row.get("stockCode", "")) != expected_code:
            raise ProbeContractError("Eastmoney report-list stock identity mismatch")
        institution = str(row.get("orgSName") or row.get("orgName") or "").strip()
        analyst = str(row.get("researcher") or "").strip()
        report_id = str(row.get("infoCode") or "").strip()
        published = str(row.get("publishDate") or "")[:10]
        if not institution or not analyst or not report_id:
            raise ProbeContractError("Eastmoney report-list required metadata is missing")
        validate_probe_date(published)
        eps = {
            str(current_year - 1): parse_number(row.get("predictLastYearEps")),
            str(current_year): parse_number(row.get("predictThisYearEps")),
            str(current_year + 1): parse_number(row.get("predictNextYearEps")),
            str(current_year + 2): parse_number(row.get("predictNextTwoYearEps")),
        }
        records.append({
            "reportId": report_id,
            "stockCode": expected_code,
            "institution": institution,
            "analyst": analyst,
            "reportDate": published,
            "epsByYear": eps,
            "rawUnit": "CNY/share",
        })
    latest = latest_by_institution(records)
    duplicates = Counter(normalize_identity(record["institution"]) for record in records)
    year_values: dict[str, list[float]] = {}
    for record in latest:
        for year, value in record["epsByYear"].items():
            if value is not None:
                year_values.setdefault(year, []).append(value)
    return {
        "availability": "available" if records else "no_reports",
        "stockCode": expected_code,
        "currentYear": current_year,
        "paginationStatus": payload["paginationStatus"],
        "expectedPageCount": payload.get("expectedPageCount"),
        "fetchedPageCount": payload.get("fetchedPageCount"),
        "expectedRecordCount": expected_record_count,
        "fetchedRecordCount": fetched_record_count,
        "requestedPageSize": payload.get("requestedPageSize"),
        "pageRecordCounts": payload.get("pageRecordCounts"),
        "complete": True,
        "reportCount": len(records),
        "distinctInstitutionCount": len(latest),
        "institutionsWithDuplicateReports": sorted(key for key, count in duplicates.items() if count > 1),
        "latestReportsByInstitution": latest,
        "statisticsByYear": {year: calculate_statistics(values) for year, values in sorted(year_values.items())},
    }


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[list[list[str]]] = []
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self._table: list[list[str]] | None = None
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._in_title = False
        self._ignored_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in {"script", "style"}:
            self._ignored_depth += 1
            return
        if self._ignored_depth:
            return
        if tag == "title":
            self._in_title = True
        elif tag == "table":
            if self._table is None:
                self._table = []
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in {"th", "td"} and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self._ignored_depth:
            self._ignored_depth -= 1
            return
        if self._ignored_depth:
            return
        if tag == "title":
            self._in_title = False
        elif tag in {"th", "td"} and self._cell is not None and self._row is not None:
            self._row.append(_clean_text(" ".join(self._cell)))
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if any(self._row):
                self._table.append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None

    def handle_data(self, data: str) -> None:
        if self._ignored_depth:
            return
        text = _clean_text(data)
        if not text:
            return
        self.text_parts.append(text)
        if self._in_title:
            self.title_parts.append(text)
        if self._cell is not None:
            self._cell.append(text)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value)).strip()


def extract_ths_contract(html: str, expected_code: str) -> dict[str, Any]:
    parser = _TableParser()
    parser.feed(html)
    title = _clean_text(" ".join(parser.title_parts))
    title_match = re.search(r"([^()（）]+)[(（](\d{6})[)）].*盈利预测", title)
    if not title_match or title_match.group(2) != expected_code:
        raise ProbeContractError("THS page stock identity/title mismatch")
    company_name = title_match.group(1).strip()
    visible = _clean_text(" ".join(parser.text_parts))
    no_forecast = any(marker in visible for marker in ("暂无机构对该股做出业绩预测", "本年度暂无机构做出业绩预测"))
    if no_forecast:
        return {"availability": "no_forecast", "stockCode": expected_code, "companyName": company_name, "statement": None, "aggregateTables": [], "detailRows": []}
    statement_match = re.search(
        r"截至(\d{4}-\d{2}-\d{2}),?\s*6个月以内共有\s*(\d+)\s*家机构对(.+?)的(\d{4})年度业绩作出预测;?\s*预测\4年每股收益\s*([\d.\-]+)\s*元.*?预测\4年净利润\s*([\d.\-]+)\s*亿元",
        visible,
    )
    if not statement_match:
        raise ProbeContractError("THS six-month summary statement is missing")
    aggregate_tables: list[list[list[str]]] = []
    detail_rows: list[list[str]] = []
    for table in parser.tables:
        flat = "|".join(cell for row in table[:3] for cell in row)
        if all(label in flat for label in ("年度", "预测机构数", "最小值", "均值", "最大值")):
            aggregate_tables.append(table)
        if all(label in flat for label in ("机构名称", "研究员", "报告日期")):
            detail_rows = table
    if len(aggregate_tables) < 2 or not detail_rows:
        raise ProbeContractError("THS forecast tables are missing or structurally changed")
    return {
        "availability": "available",
        "stockCode": expected_code,
        "companyName": company_name,
        "statement": {
            "asOfDate": statement_match.group(1),
            "windowText": "6个月以内",
            "institutionCount": int(statement_match.group(2)),
            "companyName": statement_match.group(3).strip(),
            "forecastYear": int(statement_match.group(4)),
            "displayEps": statement_match.group(5),
            "displayNetProfitYi": statement_match.group(6),
        },
        "aggregateTables": aggregate_tables[:2],
        "detailRows": detail_rows,
    }


def normalize_ths_contract(contract: Any, expected_code: str) -> dict[str, Any]:
    if not isinstance(contract, dict) or contract.get("stockCode") != expected_code:
        raise ProbeContractError("THS structured contract identity mismatch")
    if contract.get("availability") == "no_forecast":
        return {"availability": "no_forecast", "stockCode": expected_code, "companyName": contract.get("companyName"), "institutionCount": 0, "aggregates": {}, "details": []}
    statement = contract.get("statement")
    tables = contract.get("aggregateTables")
    rows = contract.get("detailRows")
    if not isinstance(statement, dict) or not isinstance(tables, list) or len(tables) < 2 or not isinstance(rows, list):
        raise ProbeContractError("THS structured contract is incomplete")
    if statement.get("companyName") != contract.get("companyName") or not DATE.fullmatch(str(statement.get("asOfDate", ""))):
        raise ProbeContractError("THS statement identity/date mismatch")
    validate_probe_date(str(statement["asOfDate"]))
    institution_count = statement.get("institutionCount")
    forecast_year = statement.get("forecastYear")
    if not isinstance(institution_count, int) or institution_count < 0 or not isinstance(forecast_year, int):
        raise ProbeContractError("THS statement count/year is invalid")
    eps_aggregates, eps_years = _aggregate_rows(tables[0], "CNY/share")
    profit_aggregates, profit_years = _aggregate_rows(tables[1], "CNY 100m", amount=True)
    if eps_years != profit_years:
        raise ProbeContractError("THS EPS and net-profit aggregate year order differs")
    years = eps_years
    if str(forecast_year) not in years:
        raise ProbeContractError("THS statement forecast year is absent from aggregate tables")
    if any(not isinstance(row, list) for row in rows):
        raise ProbeContractError("THS detail table contains a non-row value")
    normalized_rows = [[_clean_text(str(cell)) for cell in row] for row in rows]
    if len(normalized_rows) < 3:
        raise ProbeContractError("THS detail table is incomplete")
    expected_primary_header = ["机构名称", "研究员", "预测年报每股收益(元)", "预测年报净利润(元)", "报告日期"]
    if normalized_rows[0] != expected_primary_header:
        raise ProbeContractError("THS detail primary header changed")
    expected_year_header = [f"{year}预测" for year in years] * 2
    if normalized_rows[1] != expected_year_header:
        raise ProbeContractError("THS detail year columns do not match aggregate year order")
    expected_detail_width = 2 + len(years) * 2 + 1
    details = []
    for row in normalized_rows[2:]:
        if len(row) != expected_detail_width:
            raise ProbeContractError("THS detail column count changed")
        validate_probe_date(row[-1])
        institution, analyst = row[0], row[1]
        if not institution or not analyst:
            raise ProbeContractError("THS detail institution/analyst is missing")
        eps_by_year = {year: parse_number(row[2 + index]) for index, year in enumerate(years)}
        profit_start = 2 + len(years)
        profit_by_year = {year: parse_amount_to_yuan(row[profit_start + index]) for index, year in enumerate(years)}
        details.append({"institution": institution, "analyst": analyst, "reportDate": row[-1], "epsByYear": eps_by_year, "netProfitYuanUnqualifiedByYear": profit_by_year})
    if not details and institution_count > 0:
        raise ProbeContractError("THS institution details are missing")
    latest = latest_by_institution([{**row, "reportId": None} for row in details])
    duplicate_counts = Counter(normalize_identity(row["institution"]) for row in details)
    stats_by_year: dict[str, dict[str, Any]] = {}
    for year in years:
        eps_values = [row["epsByYear"].get(str(year)) for row in latest]
        profit_values = [row["netProfitYuanUnqualifiedByYear"].get(str(year)) for row in latest]
        stats_by_year[str(year)] = {
            "eps": calculate_statistics([value for value in eps_values if value is not None]),
            "netProfitYuanUnqualified": calculate_statistics([value for value in profit_values if value is not None]),
        }
    target = str(forecast_year)
    eps_display = parse_number(statement.get("displayEps"))
    profit_display = parse_amount_to_yuan(statement.get("displayNetProfitYi"), "亿元")
    visible_eps_mean = stats_by_year.get(target, {}).get("eps", {}).get("mean")
    visible_profit_mean = stats_by_year.get(target, {}).get("netProfitYuanUnqualified", {}).get("mean")
    details_complete = len(latest) == institution_count
    return {
        "availability": "available",
        "stockCode": expected_code,
        "companyName": contract.get("companyName"),
        "asOfDate": statement["asOfDate"],
        "windowText": statement.get("windowText"),
        "forecastYear": forecast_year,
        "institutionCount": institution_count,
        "visibleDetailCount": len(details),
        "visibleDistinctInstitutionCount": len(latest),
        "detailCompleteness": "complete" if details_complete else "truncated_or_filtered",
        "upstreamReportIdentityStatus": "missing_stable_report_id",
        "providerAdmissionEligible": False,
        "institutionsWithDuplicateReports": sorted(key for key, count in duplicate_counts.items() if count > 1),
        "aggregates": {"eps": eps_aggregates, "netProfitYuanUnqualified": profit_aggregates},
        "display": {"eps": eps_display, "netProfitYuanUnqualified": profit_display},
        "visibleDetailStatisticsByYear": stats_by_year,
        "visibleDetailRecomputesDisplay": {
            "eps": details_complete and visible_eps_mean is not None and eps_display is not None and round(visible_eps_mean, 2) == round(eps_display, 2),
            "netProfitUnqualified": details_complete and visible_profit_mean is not None and profit_display is not None and round(visible_profit_mean / 100_000_000, 2) == round(profit_display / 100_000_000, 2),
        },
        "details": details,
    }


def _aggregate_rows(table: Any, raw_unit: str, amount: bool = False) -> tuple[dict[str, dict[str, Any]], list[str]]:
    if not isinstance(table, list) or len(table) < 2:
        raise ProbeContractError("THS aggregate table is invalid")
    if any(not isinstance(row, list) for row in table):
        raise ProbeContractError("THS aggregate table contains a non-row value")
    normalized = [[_clean_text(str(cell)) for cell in row] for row in table]
    expected_header = ["年度", "预测机构数", "最小值", "均值", "最大值", "行业平均数"]
    if not normalized or normalized[0] != expected_header:
        raise ProbeContractError("THS aggregate table header changed")
    output: dict[str, dict[str, Any]] = {}
    years: list[str] = []
    for row in normalized[1:]:
        if len(row) != len(expected_header) or not re.fullmatch(r"\d{4}", row[0]):
            raise ProbeContractError("THS aggregate row structure changed")
        year = row[0]
        if year in output:
            raise ProbeContractError("THS aggregate table contains a duplicate year")
        try:
            count = int(str(row[1]))
        except ValueError:
            raise ProbeContractError("THS aggregate institution count is invalid") from None
        if count < 0:
            raise ProbeContractError("THS aggregate institution count is invalid")
        convert = (lambda value: parse_amount_to_yuan(value, "亿元")) if amount else parse_number
        output[year] = {
            "institutionCount": count,
            "minimum": convert(row[2]),
            "mean": convert(row[3]),
            "maximum": convert(row[4]),
            "rawUnit": raw_unit,
        }
        years.append(year)
    if not output:
        raise ProbeContractError("THS aggregate table has no forecast rows")
    if len(years) > MAX_THS_FORECAST_YEARS:
        raise ProbeContractError("THS aggregate table exceeds the forecast-year safety limit")
    return output, years


def compare_rounding(aggregate: dict[str, Any], detail_statistics: dict[str, Any], digits: int) -> bool | None:
    aggregate_mean = aggregate.get("mean") if isinstance(aggregate, dict) else None
    detail_mean = detail_statistics.get("mean") if isinstance(detail_statistics, dict) else None
    if aggregate_mean is None or detail_mean is None:
        return None
    return round(float(aggregate_mean), digits) == round(float(detail_mean), digits)
