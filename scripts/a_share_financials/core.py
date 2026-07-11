from __future__ import annotations

import math
from copy import deepcopy
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

SCHEMA_VERSION = "1.0.0"
PROVIDER = "Sina CompanyFinanceService"
PROVIDER_VERSION = "2022-openapi"

FLOW_FIELDS = (
    "operatingRevenue", "operatingCost", "operatingProfit", "totalProfit", "netProfit",
    "netProfitAttributableToParent", "netProfitExcludingNonRecurring",
    "researchAndDevelopmentExpense", "sellingExpense", "administrativeExpense", "financialExpense",
    "netOperatingCashFlow", "cashReceivedFromSales", "cashPaidForGoodsAndServices",
    "capitalExpenditure", "netInvestingCashFlow", "netFinancingCashFlow",
)
BALANCE_FIELDS = (
    "totalAssets", "totalLiabilities", "equityAttributableToParent", "cashAndCashEquivalents",
    "accountsReceivable", "notesReceivable", "contractAssets", "inventory", "accountsPayable",
    "contractLiabilities", "shortTermBorrowings", "longTermBorrowings", "goodwill",
)
CORE_FIELDS = (
    "operatingRevenue", "netProfitAttributableToParent", "netOperatingCashFlow",
    "totalAssets", "totalLiabilities", "equityAttributableToParent",
)

ALIASES: dict[str, tuple[str, ...]] = {
    "operatingRevenue": ("营业收入", "营业总收入"),
    "operatingCost": ("营业成本",),
    "operatingProfit": ("营业利润",),
    "totalProfit": ("利润总额",),
    "netProfit": ("净利润",),
    "netProfitAttributableToParent": ("归属于母公司所有者的净利润", "归属于母公司股东的净利润", "归母净利润"),
    "netProfitExcludingNonRecurring": ("扣除非经常性损益后的净利润", "扣非净利润"),
    "researchAndDevelopmentExpense": ("研发费用",),
    "sellingExpense": ("销售费用",),
    "administrativeExpense": ("管理费用",),
    "financialExpense": ("财务费用",),
    "totalAssets": ("资产总计",),
    "totalLiabilities": ("负债合计",),
    "equityAttributableToParent": ("归属于母公司股东权益合计", "归属于母公司所有者权益合计"),
    "cashAndCashEquivalents": ("货币资金",),
    "accountsReceivable": ("应收账款",),
    "notesReceivable": ("应收票据",),
    "contractAssets": ("合同资产",),
    "inventory": ("存货",),
    "accountsPayable": ("应付账款",),
    "contractLiabilities": ("合同负债",),
    "shortTermBorrowings": ("短期借款",),
    "longTermBorrowings": ("长期借款",),
    "goodwill": ("商誉",),
    "netOperatingCashFlow": ("经营活动产生的现金流量净额",),
    "cashReceivedFromSales": ("销售商品、提供劳务收到的现金",),
    "cashPaidForGoodsAndServices": ("购买商品、接受劳务支付的现金",),
    "capitalExpenditure": ("购建固定资产、无形资产和其他长期资产支付的现金",),
    "netInvestingCashFlow": ("投资活动产生的现金流量净额",),
    "netFinancingCashFlow": ("筹资活动产生的现金流量净额",),
}

FINANCIAL_KEYWORDS = ("银行", "证券", "保险", "金融", "信托", "期货")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_number(value: Any) -> int | float | None:
    if value is None or value == "" or value == "--":
        return None
    try:
        number = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, ValueError):
        return None
    if not number.is_finite():
        return None
    integral = number.to_integral_value()
    return int(integral) if number == integral else float(number)


def normalize_amount(value: Any, source_unit: str = "元") -> int | float | None:
    factors = {"元": Decimal(1), "万元": Decimal(10_000), "百万元": Decimal(1_000_000), "亿元": Decimal(100_000_000)}
    if source_unit not in factors:
        raise ValueError(f"unsupported source unit: {source_unit}")
    number = parse_number(value)
    if number is None:
        return None
    normalized = Decimal(str(number)) * factors[source_unit]
    return int(normalized) if normalized == normalized.to_integral_value() else float(normalized)


def report_type(period: str) -> tuple[str, int]:
    suffix = period[4:]
    return {"0331": ("Q1", 1), "0630": ("H1", 2), "0930": ("Q3", 3), "1231": ("FY", 4)}.get(suffix, ("unknown", 0))


def iso_date(value: Any) -> str | None:
    text = str(value or "").replace("-", "")[:8]
    if len(text) != 8 or not text.isdigit():
        return None
    try:
        return date(int(text[:4]), int(text[4:6]), int(text[6:])).isoformat()
    except ValueError:
        return None


def rows_to_map(report: dict[str, Any] | None) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for row in (report or {}).get("data", []):
        title = row.get("item_title")
        if title and title not in result:
            result[title] = row.get("item_value")
    return result


def value_for(rows: dict[str, Any], field: str) -> int | float | None:
    for alias in ALIASES[field]:
        if alias in rows:
            value = normalize_amount(rows[alias])
            if value is not None:
                return value
    return None


def is_financial_company(stock: dict[str, Any]) -> bool:
    text = " ".join(str(stock.get(key, "")) for key in ("name", "industryName", "industry"))
    return any(keyword in text for keyword in FINANCIAL_KEYWORDS)


def _statement_scope(*reports: dict[str, Any] | None) -> str:
    types = [str(report.get("rType", "")) for report in reports if report]
    if any("合并" in item for item in types):
        return "consolidated"
    if any("母公司" in item for item in types):
        return "parent"
    return "unknown"


def _source_updated_at(*reports: dict[str, Any] | None) -> str | None:
    epochs = [report.get("update_time") for report in reports if report and report.get("update_time")]
    if not epochs:
        return None
    try:
        return datetime.fromtimestamp(max(int(x) for x in epochs), timezone.utc).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OSError):
        return None


def build_reports(stock: dict[str, Any], raw: dict[str, dict[str, Any]], fetched_at: str, generated_at: str) -> list[dict[str, Any]]:
    periods = sorted(set().union(*(set(raw.get(source, {})) for source in ("lrb", "fzb", "llb", "gjzb"))))
    reports: list[dict[str, Any]] = []
    financial = is_financial_company(stock)
    for period in periods:
        income = raw.get("lrb", {}).get(period)
        balance = raw.get("fzb", {}).get(period)
        cash = raw.get("llb", {}).get(period)
        abstract = raw.get("gjzb", {}).get(period)
        income_rows, balance_rows, cash_rows, abstract_rows = map(rows_to_map, (income, balance, cash, abstract))
        cumulative = {field: value_for(income_rows, field) for field in FLOW_FIELDS[:11]}
        for field in FLOW_FIELDS[11:]:
            cumulative[field] = value_for(cash_rows, field)
        # The key-indicator source supplies deducted profit when statements omit it.
        abstract_deducted_profit = value_for(abstract_rows, "netProfitExcludingNonRecurring")
        if abstract_deducted_profit is not None:
            cumulative["netProfitExcludingNonRecurring"] = abstract_deducted_profit
        balance_metrics = {field: value_for(balance_rows, field) for field in BALANCE_FIELDS}
        r_type, quarter = report_type(period)
        available = sum(value is not None for value in [*cumulative.values(), *balance_metrics.values()])
        core_available = sum((cumulative | balance_metrics).get(field) is not None for field in CORE_FIELDS)
        announcement = max(filter(None, (iso_date(x.get("publish_date")) if x else None for x in (income, balance, cash, abstract))), default=None)
        field_status = {field: ("not_applicable" if financial and field in {"operatingCost"} else "available" if value is not None else "missing") for field, value in (cumulative | balance_metrics).items()}
        reports.append({
            "stockCode": stock["code"], "market": stock.get("exchange", "unknown"), "companyName": stock["name"],
            "reportPeriod": iso_date(period), "reportType": r_type, "fiscalYear": int(period[:4]), "fiscalQuarter": quarter,
            "announcementDate": announcement, "statementScope": _statement_scope(income, balance, cash),
            "currency": "CNY", "unit": "yuan", "sourceUnit": "元", "normalizedUnit": "元", "normalizationFactor": 1,
            "provider": PROVIDER, "providerVersion": PROVIDER_VERSION,
            "sourceDescription": "新浪财经公开财务报表接口：定期报告三表与关键指标",
            "sourceUrl": "https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.getFinanceReport2022",
            "sourceIdentifier": f"{stock['code']}:{period}:lrb,fzb,llb,gjzb", "fetchedAt": fetched_at,
            "sourceUpdatedAt": _source_updated_at(income, balance, cash, abstract), "generatedAt": generated_at,
            "status": "success" if core_available == len(CORE_FIELDS) else "partial",
            "errorCode": None, "errorMessage": None, "isRestated": None, "isDerived": False,
            "derivationMethod": None, "sourcePeriods": [iso_date(period)],
            "rawFieldCoverage": {"available": available, "total": len(FLOW_FIELDS) + len(BALANCE_FIELDS)},
            "coreFieldCoverage": {"available": core_available, "total": len(CORE_FIELDS)},
            "fieldStatus": field_status, "cumulative": cumulative, "singleQuarter": None,
            "balanceSheet": balance_metrics, "derived": {},
            "auditStatus": next((x.get("is_audit") for x in (income, balance, cash) if x and x.get("is_audit")), None),
        })
    return reports


def _subtract(current: dict[str, Any], prior: dict[str, Any]) -> dict[str, Any]:
    return {field: (round(current.get(field) - prior.get(field), 6) if current.get(field) is not None and prior.get(field) is not None else None) for field in FLOW_FIELDS}


def derive_single_quarters(reports: list[dict[str, Any]]) -> None:
    by_key = {(r["fiscalYear"], r["reportType"]): r for r in reports}
    prior_type = {"H1": "Q1", "Q3": "H1", "FY": "Q3"}
    methods = {"H1": "H1 cumulative - Q1 cumulative", "Q3": "Q3 cumulative - H1 cumulative", "FY": "FY cumulative - Q3 cumulative"}
    for report in reports:
        if report["reportType"] == "Q1":
            report["singleQuarter"] = deepcopy(report["cumulative"])
            report["isDerived"] = False
            report["derivationMethod"] = "Q1 cumulative equals Q1 single quarter"
            continue
        previous = by_key.get((report["fiscalYear"], prior_type.get(report["reportType"])))
        if not previous or report.get("isRestated") != previous.get("isRestated"):
            report["singleQuarter"] = None
            report["derivationMethod"] = "missing compatible preceding cumulative report"
            continue
        report["singleQuarter"] = _subtract(report["cumulative"], previous["cumulative"])
        report["isDerived"] = True
        report["derivationMethod"] = methods[report["reportType"]]
        report["sourcePeriods"] = [previous["reportPeriod"], report["reportPeriod"]]


def safe_change(current: Any, base: Any) -> dict[str, Any]:
    if current is None or base is None:
        return {"value": None, "changeAmount": None, "reason": "missing_value", "baseSign": None}
    change = round(current - base, 6)
    sign = "negative" if base < 0 else "zero" if base == 0 else "positive"
    if base == 0:
        return {"value": None, "changeAmount": change, "reason": "denominator_zero", "baseSign": sign}
    return {"value": change / abs(base), "changeAmount": change, "reason": None, "baseSign": sign}


def _ratio(numerator: Any, denominator: Any) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return numerator / denominator


def calculate_derived(reports: list[dict[str, Any]], financial: bool) -> None:
    by_key = {(r["fiscalYear"], r["reportType"]): r for r in reports}
    ordered = sorted(reports, key=lambda r: r["reportPeriod"] or "")
    for index, report in enumerate(ordered):
        single = report.get("singleQuarter") or {}
        cumulative = report["cumulative"]
        previous_year = by_key.get((report["fiscalYear"] - 1, report["reportType"]))
        previous_single = (previous_year.get("singleQuarter") or {}) if previous_year else {}
        previous_quarter = ordered[index - 1] if index > 0 else None
        adjacent = previous_quarter and _is_adjacent(previous_quarter, report)
        qoq_base = (previous_quarter.get("singleQuarter") or {}) if adjacent else {}
        revenue = single.get("operatingRevenue")
        parent_profit = single.get("netProfitAttributableToParent")
        deducted = single.get("netProfitExcludingNonRecurring")
        report["derived"] = {
            "revenueYoY": safe_change(revenue, previous_single.get("operatingRevenue")),
            "revenueQoQ": safe_change(revenue, qoq_base.get("operatingRevenue")),
            "parentNetProfitYoY": safe_change(parent_profit, previous_single.get("netProfitAttributableToParent")),
            "parentNetProfitQoQ": safe_change(parent_profit, qoq_base.get("netProfitAttributableToParent")),
            "deductedNetProfitYoY": safe_change(deducted, previous_single.get("netProfitExcludingNonRecurring")),
            "deductedNetProfitQoQ": safe_change(deducted, qoq_base.get("netProfitExcludingNonRecurring")),
            "grossMargin": None if financial else _ratio(None if revenue is None or single.get("operatingCost") is None else revenue - single["operatingCost"], revenue),
            "netMargin": _ratio(parent_profit, revenue),
            "operatingCashFlowToNetProfit": _ratio(single.get("netOperatingCashFlow"), parent_profit),
            "receivablesToRevenue": None if financial else _ratio(report["balanceSheet"].get("accountsReceivable"), cumulative.get("operatingRevenue")),
            "inventoryToRevenue": None if financial else _ratio(report["balanceSheet"].get("inventory"), cumulative.get("operatingRevenue")),
            "debtToAssetRatio": _ratio(report["balanceSheet"].get("totalLiabilities"), report["balanceSheet"].get("totalAssets")),
            "researchExpenseRatio": None if financial else _ratio(single.get("researchAndDevelopmentExpense"), revenue),
        }
        if financial:
            report["fieldStatus"]["grossMargin"] = "not_applicable"
            report["fieldStatus"]["receivablesToRevenue"] = "not_applicable"
            report["fieldStatus"]["inventoryToRevenue"] = "not_applicable"


def _is_adjacent(previous: dict[str, Any], current: dict[str, Any]) -> bool:
    return (previous["fiscalYear"] == current["fiscalYear"] and previous["fiscalQuarter"] + 1 == current["fiscalQuarter"]) or (
        previous["fiscalYear"] + 1 == current["fiscalYear"] and previous["fiscalQuarter"] == 4 and current["fiscalQuarter"] == 1
    )


def select_report_versions(reports: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Prefer consolidated, then latest announcement; exact ties become conflicted."""
    selected: dict[str, dict[str, Any]] = {}
    for report in reports:
        key = report["reportPeriod"]
        existing = selected.get(key)
        if existing is None:
            selected[key] = report
            continue
        rank = (report["statementScope"] == "consolidated", report.get("announcementDate") or "")
        existing_rank = (existing["statementScope"] == "consolidated", existing.get("announcementDate") or "")
        if rank > existing_rank:
            selected[key] = report
        elif rank == existing_rank and report != existing:
            existing["status"] = "conflicted"
            existing["errorCode"] = "duplicate_unresolved"
            existing["errorMessage"] = "Multiple indistinguishable versions for the same report period"
    return sorted(selected.values(), key=lambda r: r["reportPeriod"], reverse=True)


def build_company_record(stock: dict[str, Any], raw: dict[str, dict[str, Any]], fetched_at: str | None = None, generated_at: str | None = None) -> dict[str, Any]:
    fetched_at, generated_at = fetched_at or utc_now(), generated_at or utc_now()
    reports = select_report_versions(build_reports(stock, raw, fetched_at, generated_at))
    derive_single_quarters(reports)
    calculate_derived(reports, is_financial_company(stock))
    latest = reports[0] if reports else None
    status = "success" if latest and latest["status"] == "success" else "partial" if reports else "source_unavailable"
    return {
        "id": stock["id"], "stockCode": stock["code"], "market": stock.get("exchange", "unknown"), "companyName": stock["name"],
        "industryType": "financial" if is_financial_company(stock) else "general", "status": status,
        "errorCode": None if reports else "empty_report_list", "errorMessage": None if reports else "Provider returned no financial reports",
        "provider": PROVIDER, "providerVersion": PROVIDER_VERSION, "fetchedAt": fetched_at, "generatedAt": generated_at,
        "lastSuccessfulFetchAt": fetched_at if reports else None, "currentFetchError": None, "reports": reports,
        "quality": {"source": PROVIDER, "sourceLayer": "provider", "sourceEndpoint": "CompanyFinanceService.getFinanceReport2022", "sourceUrl": "https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.getFinanceReport2022", "updatedAt": fetched_at, "status": "real" if status == "success" else status},
    }


def build_summary(items: dict[str, dict[str, Any]]) -> dict[str, Any]:
    records = list(items.values())
    latest = [record["reports"][0] for record in records if record.get("reports")]
    def covered(path: tuple[str, str]) -> int:
        section, field = path
        return sum(report.get(section, {}).get(field) is not None for report in latest)
    return {
        "totalCompanies": len(records), "statusRecords": len(records),
        "successCompanies": sum(x["status"] == "success" for x in records),
        "partialCompanies": sum(x["status"] == "partial" for x in records),
        "errorCompanies": sum(x["status"] not in {"success", "partial"} for x in records),
        "latestReportCoverage": len(latest),
        "operatingRevenueCoverage": covered(("cumulative", "operatingRevenue")),
        "parentNetProfitCoverage": covered(("cumulative", "netProfitAttributableToParent")),
        "deductedNetProfitCoverage": covered(("cumulative", "netProfitExcludingNonRecurring")),
        "operatingCashFlowCoverage": covered(("cumulative", "netOperatingCashFlow")),
        "balanceSheetCoverage": sum(all(r.get("balanceSheet", {}).get(f) is not None for f in ("totalAssets", "totalLiabilities", "equityAttributableToParent")) for r in latest),
        "singleQuarterCoverage": sum(r.get("singleQuarter") is not None for r in latest),
        "yoyCoverage": sum(r.get("derived", {}).get("revenueYoY", {}).get("value") is not None for r in latest),
        "qoqCoverage": sum(r.get("derived", {}).get("revenueQoQ", {}).get("value") is not None for r in latest),
        "traceableSourceCoverage": sum(bool(r.get("sourceUrl") and r.get("sourceIdentifier")) for r in latest),
        "financialIndustryCompanies": sum(x.get("industryType") == "financial" for x in records),
    }


def validate_dataset(dataset: dict[str, Any], universe: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    expected = {x["id"] for x in universe if x.get("market") == "A股" and x.get("shouldFetchFinancials", True)}
    items = dataset.get("items", {})
    if set(items) != expected:
        errors.append(f"company status coverage mismatch: expected {len(expected)}, got {len(items)}")
    if list(items) != sorted(items):
        errors.append("items are not stably sorted by id")
    for stock_id, record in items.items():
        if record.get("status") not in {"success", "partial", "not_applicable", "source_unavailable", "fetch_error", "validation_error", "stale"}:
            errors.append(f"{stock_id}: invalid status")
        if record.get("status") not in {"success", "partial"} and not record.get("errorMessage"):
            errors.append(f"{stock_id}: error status lacks errorMessage")
        reports = record.get("reports", [])
        periods = [report.get("reportPeriod") for report in reports]
        if len(periods) != len(set(periods)):
            errors.append(f"{stock_id}: duplicate report periods")
        if record.get("status") == "success" and (not reports or any((reports[0].get("cumulative", {}) | reports[0].get("balanceSheet", {})).get(field) is None for field in CORE_FIELDS)):
            errors.append(f"{stock_id}: success status lacks latest core fields")
        by_key = {(r.get("fiscalYear"), r.get("reportType")): r for r in reports}
        for report in reports:
            if not report.get("provider") or not report.get("fetchedAt") or not report.get("sourceUrl"):
                errors.append(f"{stock_id}: missing provenance")
            if report.get("reportPeriod") and report["reportPeriod"] > date.today().isoformat():
                errors.append(f"{stock_id}: future report period {report['reportPeriod']}")
            if report.get("announcementDate") and report["announcementDate"] > report["fetchedAt"][:10]:
                errors.append(f"{stock_id}: announcementDate is after fetchedAt")
            if report.get("unit") != "yuan" or report.get("normalizationFactor") != 1:
                errors.append(f"{stock_id}: non-normalized amount unit")
            if report.get("reportType") != report_type(report["reportPeriod"].replace("-", ""))[0]:
                errors.append(f"{stock_id}: reportType does not match period")
            for coverage_name in ("rawFieldCoverage", "coreFieldCoverage"):
                coverage = report.get(coverage_name, {})
                if not isinstance(coverage.get("available"), int) or not isinstance(coverage.get("total"), int) or coverage.get("available", 1) > coverage.get("total", 0):
                    errors.append(f"{stock_id}: invalid {coverage_name}")
            if report.get("singleQuarter") is not None and set(report["singleQuarter"]) != set(FLOW_FIELDS):
                errors.append(f"{stock_id}: singleQuarter includes non-flow fields")
            if report.get("reportType") == "Q1" and report.get("singleQuarter") != report.get("cumulative"):
                errors.append(f"{stock_id}: Q1 single quarter must equal cumulative")
            predecessor_type = {"H1": "Q1", "Q3": "H1", "FY": "Q3"}.get(report.get("reportType"))
            predecessor = by_key.get((report.get("fiscalYear"), predecessor_type)) if predecessor_type else None
            if report.get("singleQuarter") is not None and predecessor_type:
                if not predecessor or not report.get("isDerived") or len(report.get("sourcePeriods", [])) != 2:
                    errors.append(f"{stock_id}: derived quarter lacks complete source chain")
                elif report["singleQuarter"] != _subtract(report["cumulative"], predecessor["cumulative"]):
                    errors.append(f"{stock_id}: derived quarter does not equal cumulative difference")
            gross = report.get("derived", {}).get("grossMargin")
            sq = report.get("singleQuarter") or {}
            if gross is not None and (sq.get("operatingRevenue") in (None, 0) or sq.get("operatingCost") is None):
                errors.append(f"{stock_id}: grossMargin generated without valid revenue/cost")
            for value in _walk_values(report):
                if isinstance(value, float) and not math.isfinite(value):
                    errors.append(f"{stock_id}: non-finite numeric value")
            for section in ("cumulative", "singleQuarter", "balanceSheet"):
                for value in (report.get(section) or {}).values():
                    if value is not None and (not isinstance(value, (int, float)) or isinstance(value, bool)):
                        errors.append(f"{stock_id}: non-numeric placeholder in {section}")
            if record.get("industryType") == "financial" and report.get("fieldStatus", {}).get("grossMargin") != "not_applicable":
                errors.append(f"{stock_id}: financial-company grossMargin must be not_applicable")
    actual_summary = build_summary(items)
    if dataset.get("summary") != actual_summary:
        errors.append("dataset summary does not match actual records")
    return sorted(set(errors))


def _walk_values(value: Any):
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_values(child)
    else:
        yield value
