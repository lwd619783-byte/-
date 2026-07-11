from __future__ import annotations

import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from . import PROVIDER, PROVIDER_VERSION, SCHEMA_VERSION

ALLOWED_CATEGORIES = {
    "performance_forecast", "performance_forecast_revision", "performance_express",
    "annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary",
    "correction", "investor_relations", "major_contract", "share_repurchase",
    "shareholding_change", "equity_incentive", "financing", "merger_acquisition",
    "regulatory", "other", "unknown",
}

PERFORMANCE_CATEGORIES = {
    "performance_forecast", "performance_forecast_revision", "performance_express",
    "annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary",
}


def normalize_title(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", "", value or "")
    return re.sub(r"\s+", " ", text).strip()


def parse_announcement_date(value: Any) -> tuple[str | None, str | None]:
    if isinstance(value, (int, float)):
        dt = datetime.fromtimestamp(value / 1000, tz=timezone(timedelta(hours=8)))
        return dt.date().isoformat(), dt.time().replace(microsecond=0).isoformat()
    if isinstance(value, str) and value:
        text = value.strip().replace("/", "-")
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return dt.date().isoformat(), dt.time().replace(microsecond=0).isoformat()
        except ValueError:
            return (text[:10], None) if re.fullmatch(r"\d{4}-\d{2}-\d{2}.*", text) else (None, None)
    return None, None


def classify_announcement(title: str, platform_type: str | None = None) -> dict[str, Any]:
    text = normalize_title(title)
    evidence: list[str] = []
    category = "other"
    subcategory = platform_type or None
    rules = [
        ("performance_forecast_revision", ("业绩预告",), ("修正", "更正", "补充")),
        ("performance_forecast", ("业绩预告", "业绩预增", "业绩预减", "扭亏", "预盈", "预亏"), ()),
        ("performance_express", ("业绩快报",), ()),
        ("periodic_report_summary", ("年度报告摘要", "半年度报告摘要", "季度报告摘要"), ()),
        ("semi_annual_report", ("半年度报告", "半年报"), ()),
        ("annual_report", ("年度报告", "年报"), ()),
        ("quarterly_report", ("第一季度报告", "第三季度报告", "一季报", "三季报"), ()),
        ("share_repurchase", ("回购",), ()),
        ("shareholding_change", ("增持", "减持", "持股变动"), ()),
        ("equity_incentive", ("股权激励", "限制性股票", "股票期权"), ()),
        ("major_contract", ("重大合同", "中标", "订单"), ()),
        ("merger_acquisition", ("重大资产重组", "收购", "合并"), ()),
        ("financing", ("定向增发", "向特定对象发行", "可转换公司债券", "融资"), ()),
        ("investor_relations", ("投资者关系", "调研活动"), ()),
        ("regulatory", ("问询函", "监管", "处罚", "警示函"), ()),
    ]
    for candidate, primary, secondary in rules:
        primary_hit = next((token for token in primary if token in text), None)
        secondary_hit = next((token for token in secondary if token in text), None) if secondary else ""
        if primary_hit and (not secondary or secondary_hit):
            category = candidate
            evidence.append(f"title:{primary_hit}")
            if secondary_hit:
                evidence.append(f"title:{secondary_hit}")
            break
    if category == "other" and any(token in text for token in ("更正公告", "补充公告", "修订稿")):
        category, evidence = "correction", ["title:更正/补充/修订"]
    if category in {"annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary"} and any(token in text for token in ("问询函", "回复", "提示性公告", "预约披露", "披露时间", "信息披露制度")):
        category = "regulatory" if any(token in text for token in ("问询函", "监管")) else "other"
        evidence = ["title:report-reference-not-report"]
    confidence = "high" if len(evidence) >= 2 or category in PERFORMANCE_CATEGORIES else "medium" if evidence else "low"
    return {"category": category, "subcategory": subcategory, "classificationConfidence": confidence, "classificationEvidence": evidence or ["fallback:other"]}


def infer_report_period(title: str) -> tuple[str | None, str | None]:
    text = normalize_title(title)
    year_match = re.search(r"(20\d{2})\s*年", text)
    if not year_match:
        return None, None
    year = int(year_match.group(1))
    if "第一季度" in text or "一季" in text:
        return f"{year}-03-31", "Q1"
    if "半年度" in text or "半年" in text:
        return f"{year}-06-30", "H1"
    if "第三季度" in text or "三季" in text:
        return f"{year}-09-30", "Q3"
    if "年度" in text or "年报" in text:
        return f"{year}-12-31", "FY"
    return None, None


def normalize_amount(value: str | float | int | None, unit: str | None) -> float | None:
    if value is None or str(value).strip() in {"", "--", "—", "不适用"}:
        return None
    try:
        number = float(str(value).replace(",", "").strip())
    except ValueError:
        return None
    factors = {"元": 1, "千元": 1_000, "万元": 10_000, "百万元": 1_000_000, "亿元": 100_000_000}
    factor = factors.get(unit or "元")
    result = number * factor if factor else None
    return result if result is not None and math.isfinite(result) else None


def parse_performance_forecast(text: str, title: str) -> list[dict[str, Any]]:
    compact = re.sub(r"\s+", "", text or "")
    period, _ = infer_report_period(title)
    metrics = [
        ("netProfitExcludingNonRecurring", ("归属于母公司所有者的扣除非经常性损益的净利润", "扣除非经常性损益后的归属于上市公司股东的净利润", "扣除非经常性损益后的净利润")),
        ("netProfitAttributableToParent", ("归属于母公司所有者的净利润", "归属于上市公司股东的净利润")),
        ("operatingRevenue", ("营业收入", "营业总收入")),
    ]
    events: list[dict[str, Any]] = []
    for metric, phrases in metrics:
        phrase_pattern = "(?:" + "|".join(re.escape(phrase) for phrase in phrases) + ")"
        candidates = list(re.finditer(phrase_pattern + r"[^。；]{0,55}?(-?[\d,.]+)(亿元|百万元|万元|千元|元)(?:至|到|—|-)(-?[\d,.]+)(亿元|百万元|万元|千元|元)", compact))
        if not candidates:
            continue
        period_token = {"03-31": "第一季度", "06-30": "半年度", "09-30": "第三季度", "12-31": "年度"}.get(period[5:] if period else "")
        period_candidates = [candidate for candidate in candidates if period_token and period_token in compact[max(0, candidate.start() - 45):candidate.start()]]
        match = period_candidates[-1] if period_candidates else candidates[0]
        lower = normalize_amount(match.group(1), match.group(2))
        upper = normalize_amount(match.group(3), match.group(4))
        if lower is None or upper is None:
            continue
        lower, upper = sorted((lower, upper))
        evidence = compact[max(0, match.start() - 50):min(len(compact), match.end() + 180)]
        post_value = compact[match.end():min(len(compact), match.end() + 180)]
        yoy = re.search(r"(?:比上年同期|同比)(?:相比|，|,|将)?(上升|增长|增加|下降|减少)[:：]?(-?[\d.]+)%(?:至|到|—|-)(-?[\d.]+)%", post_value)
        direction = "increase" if yoy and yoy.group(1) in ("上升", "增长", "增加") else "decrease" if yoy else "turn_positive" if "扭亏" in evidence else "unknown"
        changes = None
        if yoy:
            values = [float(yoy.group(2)) / 100, float(yoy.group(3)) / 100]
            if direction == "decrease":
                values = [-abs(value) for value in values]
            changes = sorted(values)
        events.append({
            "forecastPeriod": period, "forecastType": direction, "profitMetric": metric,
            "lowerBound": lower, "upperBound": upper, "priorPeriodValue": None,
            "changeLowerPercent": changes[0] if changes else None,
            "changeUpperPercent": changes[1] if changes else None,
            "expectedDirection": direction, "turnPositive": "扭亏" in evidence,
            "turnNegative": "首亏" in evidence or "转亏" in evidence,
            "increaseLoss": "增亏" in evidence, "reduceLoss": "减亏" in evidence,
            "revisionType": "revision" if any(x in title for x in ("修正", "更正")) else None,
            "previousForecastAnnouncementId": None, "previousLowerBound": None, "previousUpperBound": None,
            "revisionDirection": None, "derivedMidpoint": (lower + upper) / 2,
            "sourceTextEvidence": evidence[:320], "extractionMethod": "pdf_text_rule", "extractionConfidence": "high",
        })
    return events


def extract_reason_items(text: str) -> list[dict[str, Any]]:
    compact = re.sub(r"\s+", "", text or "")
    match = re.search(r"(?:业绩预(?:增|告).*?主要原因|业绩变动的主要原因|主要原因)(.*?)(?:风险提示|其他说明|其他相关说明|四、|五、|特此公告)", compact)
    if not match:
        return []
    evidence = match.group(1)[:500]
    categories = [
        ("revenue_growth", ("收入增长", "营业收入", "需求")), ("product_mix", ("产品结构", "产品组合")),
        ("capacity_release", ("产能", "量产")), ("demand_change", ("需求", "市场")),
        ("customer_change", ("客户", "市场份额")), ("non_recurring_item", ("非经常性", "政府补助", "投资收益")),
        ("cost_reduction", ("降本", "成本")), ("impairment", ("减值",)),
    ]
    result = []
    for category, tokens in categories:
        if any(token in evidence for token in tokens):
            result.append({"category": category, "summary": evidence[:120], "evidenceText": evidence[:320], "sourcePage": None, "extractionMethod": "pdf_text_rule", "confidence": "medium"})
    return result or [{"category": "other", "summary": evidence[:120], "evidenceText": evidence[:320], "sourcePage": None, "extractionMethod": "pdf_text_rule", "confidence": "medium"}]


def parse_performance_express(text: str, title: str) -> dict[str, Any] | None:
    compact = re.sub(r"\s+", "", text or "")
    period, _ = infer_report_period(title)
    unit_match = re.search(r"(?:金额)?单位[:：]?(?:人民币)?(亿元|百万元|万元|千元|元)", compact)
    table_unit = unit_match.group(1) if unit_match else None
    labels = {
        "operatingRevenue": "营业总收入|营业收入", "operatingProfit": "营业利润", "totalProfit": "利润总额",
        "netProfitAttributableToParent": "归属于上市公司股东的净利润|归属于母公司所有者的净利润",
        "netProfitExcludingNonRecurring": "扣除非经常性损益后的归属于上市公司股东的净利润",
        "basicEPS": "基本每股收益", "totalAssets": "总资产",
        "equityAttributableToParent": "归属于上市公司股东的所有者权益|归属于母公司所有者权益",
    }
    values: dict[str, float | None] = {}
    evidence_parts: list[str] = []
    for key, label in labels.items():
        match = re.search(rf"(?:{label})[^\d-]{{0,25}}(-?[\d,.]+)(亿元|百万元|万元|千元|元)?", compact)
        if match:
            source_value = match.group(1)
            comma_grouping_valid = "," not in source_value or re.fullmatch(r"-?\d{1,3}(?:,\d{3})*(?:\.\d+)?", source_value) is not None
            unit = match.group(2) or ("元" if key == "basicEPS" else table_unit)
            raw_value = source_value.replace(",", "")
            if not comma_grouping_valid or (key != "basicEPS" and unit is None) or len(re.sub(r"\D", "", raw_value.split(".")[0])) > 13:
                continue
            try:
                parsed = float(raw_value) if key == "basicEPS" and raw_value.count(".") <= 1 else normalize_amount(raw_value, unit)
            except ValueError:
                parsed = None
            if parsed is not None:
                values[key] = parsed
                evidence_parts.append(compact[max(0, match.start() - 15):match.end() + 25])
    if not values:
        return None
    return {"reportPeriod": period, **{key: values.get(key) for key in labels}, "netProfit": None,
            "revenueYoY": None, "parentNetProfitYoY": None, "sourceUnit": "mixed_or_disclosed",
            "normalizedUnit": "CNY", "correctionStatus": "corrected" if "更正" in title else "original",
            "sourceTextEvidence": "；".join(evidence_parts)[:500], "extractionMethod": "pdf_text_rule", "extractionConfidence": "medium"}


def build_announcement(raw: dict[str, Any], stock: dict[str, str], fetched_at: str, pdf_text: str | None, financial_periods: dict[str, str]) -> dict[str, Any]:
    title = normalize_title(raw.get("announcementTitle"))
    classification = classify_announcement(title, raw.get("announcementTypeName"))
    date, time_value = parse_announcement_date(raw.get("announcementTime"))
    period, report_type = infer_report_period(title)
    adjunct = raw.get("adjunctUrl")
    announcement_id = str(raw.get("announcementId") or "")
    pdf_url = f"https://static.cninfo.com.cn/{adjunct}" if adjunct else None
    official_url = f"https://www.cninfo.com.cn/new/disclosure/detail?annoId={announcement_id}" if announcement_id else None
    forecast_events = parse_performance_forecast(pdf_text or "", title) if classification["category"] in {"performance_forecast", "performance_forecast_revision"} else []
    express = parse_performance_express(pdf_text or "", title) if classification["category"] == "performance_express" else None
    reasons = extract_reason_items(pdf_text or "") if forecast_events else []
    should_parse = classification["category"] in {"performance_forecast", "performance_forecast_revision", "performance_express"}
    express_complete = bool(express and express.get("operatingRevenue") is not None and express.get("netProfitAttributableToParent") is not None)
    parse_status = "parse_success" if (forecast_events or express_complete) else "parse_partial" if should_parse and pdf_text else "parse_unavailable" if should_parse else "metadata_only"
    linked_status = "matched" if period and period in financial_periods else "not_found" if period else "not_applicable"
    is_correction = classification["category"] in {"performance_forecast_revision", "correction"} or any(x in title for x in ("更正", "修订"))
    return {
        "schemaVersion": SCHEMA_VERSION, "announcementId": announcement_id, "stockId": stock["id"], "stockCode": stock["code"],
        "companyName": stock["name"], "market": "A股", "title": title, "rawTitle": raw.get("announcementTitle") or title,
        **classification, "announcementDate": date, "announcementTime": time_value, "reportPeriod": period,
        "sourceProvider": PROVIDER, "sourceDescription": "巨潮资讯公开公告检索；PDF 为法定披露文件",
        "officialUrl": official_url, "pdfUrl": pdf_url, "fetchedAt": fetched_at, "sourceUpdatedAt": date,
        "status": "success" if official_url and pdf_url else "partial", "parseStatus": parse_status,
        "parseErrorCode": None if parse_status not in {"parse_partial", "parse_unavailable"} else "structured_fields_unavailable",
        "parseErrorMessage": None if parse_status not in {"parse_partial", "parse_unavailable"} else "PDF text unavailable or no reliable structured match",
        "isCorrection": is_correction, "correctedAnnouncementId": None, "isCancelled": any(x in title for x in ("取消", "终止")),
        "isDuplicate": False, "duplicateOf": None, "supersededBy": None,
        "performanceForecastEvents": forecast_events, "performanceExpressEvent": express,
        "periodicReportEvent": {"reportPeriod": period, "reportType": report_type, "summaryUrl": pdf_url if "摘要" in title else None,
                                "linkedFinancialReportPeriod": period if linked_status == "matched" else None,
                                "linkedFinancialStatus": linked_status, "linkedFinancialGeneratedAt": financial_periods.get(period or "")}
                               if classification["category"] in {"annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary"} else None,
        "reasonSummary": reasons[0]["summary"] if reasons else None, "reasonItems": reasons,
        "announcementParsingResult": {"status": parse_status, "method": "pdf_text_rule" if pdf_text else "metadata_only", "confidence": "high" if parse_status == "parse_success" else "medium" if parse_status == "parse_partial" else "low", "evidenceCount": len(forecast_events) + len(reasons) + (1 if express else 0)},
    }


def link_versions(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen_ids: dict[str, dict[str, Any]] = {}
    pdfs: dict[str, str] = {}
    for item in items:
        announcement_id = item["announcementId"]
        if announcement_id in seen_ids:
            item["isDuplicate"] = True
            item["duplicateOf"] = announcement_id
        else:
            seen_ids[announcement_id] = item
        pdf = item.get("pdfUrl")
        if pdf and pdf in pdfs and pdfs[pdf] != announcement_id:
            item["isDuplicate"] = True
            item["duplicateOf"] = pdfs[pdf]
        elif pdf:
            pdfs[pdf] = announcement_id
    by_period: dict[tuple[str | None, str], list[dict[str, Any]]] = {}
    for item in reversed(items):
        if item["isCorrection"]:
            key = (item.get("reportPeriod"), item["category"].replace("_revision", ""))
            candidates = by_period.get(key, [])
            if candidates:
                original = candidates[-1]
                item["correctedAnnouncementId"] = original["announcementId"]
                original["supersededBy"] = item["announcementId"]
        key = (item.get("reportPeriod"), item["category"].replace("_revision", ""))
        by_period.setdefault(key, []).append(item)
    return items


def reject_non_finite(value: Any) -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("non-finite number")
    if isinstance(value, dict):
        for child in value.values(): reject_non_finite(child)
    elif isinstance(value, list):
        for child in value: reject_non_finite(child)
