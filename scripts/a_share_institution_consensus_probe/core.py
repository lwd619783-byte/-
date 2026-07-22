from __future__ import annotations

import math
import re
import statistics
import unicodedata
from collections import Counter
from datetime import date
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any

PROBE_SCHEMA_VERSION = "1.0.0"
MISSING_TEXT = {"", "-", "--", "null", "none", "nan", "false"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ProbeContractError(ValueError):
    """The public response did not satisfy the minimum probe contract."""


def normalize_identity(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).strip()).casefold()


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
    selected: dict[str, dict[str, Any]] = {}
    for record in records:
        key = normalize_identity(str(record.get("institution", "")))
        if not key:
            raise ProbeContractError("institution name is required")
        current = selected.get(key)
        order = (str(record.get("reportDate", "")), str(record.get("reportId", "")))
        if current is None or order > (str(current.get("reportDate", "")), str(current.get("reportId", ""))):
            selected[key] = record
    return sorted(selected.values(), key=lambda item: (normalize_identity(item["institution"]), item["reportDate"], item.get("reportId", "")))


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
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise ProbeContractError("Eastmoney report-list data is missing")
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
        if not institution or not analyst or not report_id or not DATE.fullmatch(published):
            raise ProbeContractError("Eastmoney report-list required metadata is missing")
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
    institution_count = statement.get("institutionCount")
    forecast_year = statement.get("forecastYear")
    if not isinstance(institution_count, int) or institution_count < 0 or not isinstance(forecast_year, int):
        raise ProbeContractError("THS statement count/year is invalid")
    eps_aggregates = _aggregate_rows(tables[0], "CNY/share")
    profit_aggregates = _aggregate_rows(tables[1], "CNY 100m", amount=True)
    years = sorted(set(eps_aggregates) | set(profit_aggregates))
    details = []
    for row in rows:
        if not isinstance(row, list) or len(row) < 9 or not DATE.fullmatch(str(row[-1])):
            continue
        institution, analyst = str(row[0]).strip(), str(row[1]).strip()
        if not institution or not analyst:
            raise ProbeContractError("THS detail institution/analyst is missing")
        eps_by_year = {str(year): parse_number(row[2 + index]) if 2 + index < len(row) - 1 else None for index, year in enumerate(years[:3])}
        profit_by_year = {str(year): parse_amount_to_yuan(row[5 + index]) if 5 + index < len(row) - 1 else None for index, year in enumerate(years[:3])}
        details.append({"institution": institution, "analyst": analyst, "reportDate": row[-1], "epsByYear": eps_by_year, "netProfitYuanUnqualifiedByYear": profit_by_year})
    if not details and institution_count > 0:
        raise ProbeContractError("THS institution details are missing")
    latest = latest_by_institution([{**row, "reportId": ""} for row in details])
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


def _aggregate_rows(table: Any, raw_unit: str, amount: bool = False) -> dict[str, dict[str, Any]]:
    if not isinstance(table, list):
        raise ProbeContractError("THS aggregate table is invalid")
    output: dict[str, dict[str, Any]] = {}
    for row in table:
        if not isinstance(row, list) or len(row) < 5 or not re.fullmatch(r"\d{4}", str(row[0])):
            continue
        try:
            count = int(str(row[1]))
        except ValueError:
            raise ProbeContractError("THS aggregate institution count is invalid") from None
        convert = (lambda value: parse_amount_to_yuan(value, "亿元")) if amount else parse_number
        output[str(row[0])] = {
            "institutionCount": count,
            "minimum": convert(row[2]),
            "mean": convert(row[3]),
            "maximum": convert(row[4]),
            "rawUnit": raw_unit,
        }
    if not output:
        raise ProbeContractError("THS aggregate table has no forecast rows")
    return output


def compare_rounding(aggregate: dict[str, Any], detail_statistics: dict[str, Any], digits: int) -> bool | None:
    aggregate_mean = aggregate.get("mean") if isinstance(aggregate, dict) else None
    detail_mean = detail_statistics.get("mean") if isinstance(detail_statistics, dict) else None
    if aggregate_mean is None or detail_mean is None:
        return None
    return round(float(aggregate_mean), digits) == round(float(detail_mean), digits)


def validate_probe_date(value: str) -> str:
    if not DATE.fullmatch(value):
        raise ProbeContractError(f"invalid probe date: {value}")
    date.fromisoformat(value)
    return value
