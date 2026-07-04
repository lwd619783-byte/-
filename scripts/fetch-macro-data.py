from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable

import akshare as ak
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src" / "data" / "real" / "macro.generated.json"
REPORT = ROOT / "docs" / "macro-data-report.md"
CN_TZ = timezone(timedelta(hours=8))


def now_iso() -> str:
    return datetime.now(CN_TZ).replace(microsecond=0).isoformat()


def clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def fmt_num(value: Any, digits: int = 2, suffix: str = "") -> str:
    value = clean(value)
    if value is None:
        return "数据暂缺"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    text = f"{number:.{digits}f}".rstrip("0").rstrip(".")
    return f"{text}{suffix}"


def fmt_yi(value: Any, digits: int = 1) -> str:
    value = clean(value)
    if value is None:
        return "数据暂缺"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if abs(number) >= 10000:
        return f"{number / 10000:.{digits}f}".rstrip("0").rstrip(".") + " 万亿"
    return f"{number:.{digits}f}".rstrip("0").rstrip(".") + " 亿"


def parse_month(value: Any) -> datetime | None:
    text = str(value)
    match = re.search(r"(\d{4})年(\d{1,2})", text)
    if match:
        return datetime(int(match.group(1)), int(match.group(2)), 1)
    try:
        parsed = pd.to_datetime(value)
        if pd.isna(parsed):
            return None
        return parsed.to_pydatetime()
    except Exception:
        return None


def parse_quarter(value: Any) -> datetime | None:
    text = str(value)
    match = re.search(r"(\d{4})年第1-(\d)季度", text)
    if match:
        month = int(match.group(2)) * 3
        return datetime(int(match.group(1)), month, 1)
    match = re.search(r"(\d{4})年第(\d)季度", text)
    if match:
        month = int(match.group(2)) * 3
        return datetime(int(match.group(1)), month, 1)
    return parse_month(value)


def latest_row(df: pd.DataFrame, date_col: str, value_cols: list[str], parser: Callable[[Any], datetime | None] = parse_month) -> dict[str, Any]:
    work = df.copy()
    for col in value_cols:
        work = work[work[col].notna()]
    work["_parsed_date"] = work[date_col].map(parser)
    work = work[work["_parsed_date"].notna()].sort_values("_parsed_date", ascending=False)
    if work.empty:
        raise ValueError(f"no valid row for {date_col}/{value_cols}")
    return work.iloc[0].to_dict()


def metric(label: str, value: str, note: str, updated_at: str | None, source: str, status: str = "real") -> dict[str, str]:
    return {
        "label": label,
        "value": value,
        "note": note,
        "updatedAt": updated_at or "数据暂缺",
        "source": source,
        "status": status,
    }


def run() -> int:
    errors: list[str] = []
    sources: list[str] = []

    def fetch(name: str, fn: Callable[[], pd.DataFrame]) -> pd.DataFrame | None:
        try:
            df = fn()
            sources.append(f"AKShare:{name}")
            return df
        except Exception as exc:
            errors.append(f"{name}: {type(exc).__name__}: {exc}")
            return None

    gdp = fetch("macro_china_gdp", ak.macro_china_gdp)
    pmi = fetch("macro_china_pmi", ak.macro_china_pmi)
    non_pmi = fetch("macro_china_non_man_pmi", ak.macro_china_non_man_pmi)
    cpi = fetch("macro_china_cpi", ak.macro_china_cpi)
    ppi = fetch("macro_china_ppi", ak.macro_china_ppi)
    money = fetch("macro_china_money_supply", ak.macro_china_money_supply)
    credit = fetch("macro_china_new_financial_credit", ak.macro_china_new_financial_credit)
    lpr = fetch("macro_china_lpr", ak.macro_china_lpr)
    shibor = fetch("macro_china_shibor_all", ak.macro_china_shibor_all)
    rmb = fetch("macro_china_rmb", ak.macro_china_rmb)
    rr = fetch("macro_china_reserve_requirement_ratio", ak.macro_china_reserve_requirement_ratio)
    retail = fetch("macro_china_consumer_goods_retail", ak.macro_china_consumer_goods_retail)
    industrial = fetch("macro_china_gyzjz", ak.macro_china_gyzjz)
    margin_sh = fetch("macro_china_market_margin_sh", ak.macro_china_market_margin_sh)
    margin_sz = fetch("macro_china_market_margin_sz", ak.macro_china_market_margin_sz)

    def safe_latest(df: pd.DataFrame | None, label: str, date_col: str, value_cols: list[str], parser: Callable[[Any], datetime | None] = parse_month) -> dict[str, Any] | None:
        if df is None:
            return None
        try:
            return latest_row(df, date_col, value_cols, parser)
        except Exception as exc:
            errors.append(f"{label}: {type(exc).__name__}: {exc}")
            return None

    gdp_r = safe_latest(gdp, "GDP", "季度", ["国内生产总值-同比增长"], parse_quarter)
    pmi_r = safe_latest(pmi, "PMI", "月份", ["制造业-指数", "非制造业-指数"])
    non_pmi_r = safe_latest(non_pmi, "non-man PMI", "日期", ["今值"], parse_month)
    cpi_r = safe_latest(cpi, "CPI", "月份", ["全国-同比增长"])
    ppi_r = safe_latest(ppi, "PPI", "月份", ["当月同比增长"])
    money_r = safe_latest(money, "money supply", "月份", ["货币和准货币(M2)-同比增长"])
    credit_r = safe_latest(credit, "new credit", "月份", ["当月"])
    lpr_r = safe_latest(lpr, "LPR", "TRADE_DATE", ["LPR1Y", "LPR5Y"], parse_month)
    shibor_r = safe_latest(shibor, "SHIBOR", "日期", ["O/N-定价", "1W-定价"], parse_month)
    rmb_r = safe_latest(rmb, "RMB", "日期", ["美元/人民币_中间价"], parse_month)
    rr_r = safe_latest(rr, "RRR", "公布时间", ["大型金融机构-调整后"], parse_month)
    retail_r = safe_latest(retail, "retail", "月份", ["同比增长"])
    industrial_r = safe_latest(industrial, "industrial", "月份", ["同比增长"], parse_month)

    margin_value = "数据暂缺"
    margin_date = "数据暂缺"
    if margin_sh is not None and margin_sz is not None:
        try:
            sh = latest_row(margin_sh, "日期", ["融资融券余额"], parse_month)
            sz = latest_row(margin_sz, "日期", ["融资融券余额"], parse_month)
            margin_value = fmt_yi(float(sh["融资融券余额"]) / 100000000 + float(sz["融资融券余额"]) / 100000000)
            margin_date = str(max(parse_month(sh["日期"]), parse_month(sz["日期"])).date())
        except Exception as exc:
            errors.append(f"margin aggregate: {type(exc).__name__}: {exc}")

    indicators = [
        {
            "id": "macro-cycle",
            "category": "宏观环境",
            "name": "增长与价格组合",
            "currentStatus": f"GDP {fmt_num(gdp_r.get('国内生产总值-同比增长') if gdp_r else None, 1, '%')}；制造业 PMI {fmt_num(pmi_r.get('制造业-指数') if pmi_r else None, 1)}；CPI {fmt_num(cpi_r.get('全国-同比增长') if cpi_r else None, 1, '%')} / PPI {fmt_num(ppi_r.get('当月同比增长') if ppi_r else None, 1, '%')}",
            "trend": "待验证",
            "marketImpact": "增长、价格与生产端数据用于判断盈利弹性是否从政策预期走向真实需求；若 PMI 回升且 PPI 收窄，对顺周期和制造链更友好。",
            "trackingIndicators": ["GDP", "官方制造业 PMI", "非制造业 PMI", "CPI", "PPI", "工业增加值", "社零"],
            "metrics": [
                metric("GDP 同比", fmt_num(gdp_r.get("国内生产总值-同比增长") if gdp_r else None, 1, "%"), f"报告期：{gdp_r.get('季度') if gdp_r else '数据暂缺'}", str(gdp_r.get("季度")) if gdp_r else None, "AKShare macro_china_gdp"),
                metric("制造业 PMI", fmt_num(pmi_r.get("制造业-指数") if pmi_r else None, 1), f"月份：{pmi_r.get('月份') if pmi_r else '数据暂缺'}", str(pmi_r.get("月份")) if pmi_r else None, "AKShare macro_china_pmi"),
                metric("非制造业 PMI", fmt_num((pmi_r or {}).get("非制造业-指数", (non_pmi_r or {}).get("今值")), 1), f"月份：{(pmi_r or {}).get('月份', (non_pmi_r or {}).get('日期', '数据暂缺'))}", str((pmi_r or {}).get("月份", (non_pmi_r or {}).get("日期", ""))), "AKShare macro_china_pmi"),
                metric("CPI 同比", fmt_num(cpi_r.get("全国-同比增长") if cpi_r else None, 1, "%"), f"月份：{cpi_r.get('月份') if cpi_r else '数据暂缺'}", str(cpi_r.get("月份")) if cpi_r else None, "AKShare macro_china_cpi"),
                metric("PPI 同比", fmt_num(ppi_r.get("当月同比增长") if ppi_r else None, 1, "%"), f"月份：{ppi_r.get('月份') if ppi_r else '数据暂缺'}", str(ppi_r.get("月份")) if ppi_r else None, "AKShare macro_china_ppi"),
                metric("工业增加值", fmt_num(industrial_r.get("同比增长") if industrial_r else None, 1, "%"), f"月份：{industrial_r.get('月份') if industrial_r else '数据暂缺'}", str(industrial_r.get("月份")) if industrial_r else None, "AKShare macro_china_gyzjz"),
            ],
        },
        {
            "id": "liquidity",
            "category": "流动性",
            "name": "资金与利率环境",
            "currentStatus": f"M2 同比 {fmt_num(money_r.get('货币和准货币(M2)-同比增长') if money_r else None, 1, '%')}；LPR 1Y/5Y {fmt_num(lpr_r.get('LPR1Y') if lpr_r else None, 2, '%')} / {fmt_num(lpr_r.get('LPR5Y') if lpr_r else None, 2, '%')}；SHIBOR O/N {fmt_num(shibor_r.get('O/N-定价') if shibor_r else None, 3, '%')}",
            "trend": "震荡",
            "marketImpact": "流动性数据用于约束估值扩张空间；M2、信贷与短端利率组合决定主题行情能否扩散。",
            "trackingIndicators": ["M2", "新增人民币贷款", "LPR", "SHIBOR", "人民币汇率", "融资融券余额"],
            "metrics": [
                metric("M2 同比", fmt_num(money_r.get("货币和准货币(M2)-同比增长") if money_r else None, 1, "%"), f"月份：{money_r.get('月份') if money_r else '数据暂缺'}", str(money_r.get("月份")) if money_r else None, "AKShare macro_china_money_supply"),
                metric("新增人民币贷款", fmt_yi(credit_r.get("当月") if credit_r else None), f"月份：{credit_r.get('月份') if credit_r else '数据暂缺'}", str(credit_r.get("月份")) if credit_r else None, "AKShare macro_china_new_financial_credit"),
                metric("LPR 1Y / 5Y", f"{fmt_num(lpr_r.get('LPR1Y') if lpr_r else None, 2, '%')} / {fmt_num(lpr_r.get('LPR5Y') if lpr_r else None, 2, '%')}", f"日期：{lpr_r.get('TRADE_DATE') if lpr_r else '数据暂缺'}", str(lpr_r.get("TRADE_DATE")) if lpr_r else None, "AKShare macro_china_lpr"),
                metric("SHIBOR O/N", fmt_num(shibor_r.get("O/N-定价") if shibor_r else None, 3, "%"), f"日期：{shibor_r.get('日期') if shibor_r else '数据暂缺'}", str(shibor_r.get("日期")) if shibor_r else None, "AKShare macro_china_shibor_all"),
                metric("美元/人民币中间价", fmt_num(rmb_r.get("美元/人民币_中间价") if rmb_r else None, 4), f"日期：{rmb_r.get('日期') if rmb_r else '数据暂缺'}", str(rmb_r.get("日期")) if rmb_r else None, "AKShare macro_china_rmb"),
                metric("沪深两融余额", margin_value, f"日期：{margin_date}", margin_date, "AKShare macro_china_market_margin_sh/sz"),
            ],
        },
        {
            "id": "policy",
            "category": "政策窗口",
            "name": "政策与信用脉冲",
            "currentStatus": f"大型机构存准率 {fmt_num(rr_r.get('大型金融机构-调整后') if rr_r else None, 2, '%')}；社零同比 {fmt_num(retail_r.get('同比增长') if retail_r else None, 1, '%')}；新增信贷 {fmt_yi(credit_r.get('当月') if credit_r else None)}",
            "trend": "待验证",
            "marketImpact": "政策窗口以信用、消费和准备金率变化验证；只作为研究线索，不替代政策原文解读。",
            "trackingIndicators": ["存款准备金率", "新增信贷", "社零", "工业增加值", "财政数据", "产业政策细则"],
            "metrics": [
                metric("大型机构存准率", fmt_num(rr_r.get("大型金融机构-调整后") if rr_r else None, 2, "%"), f"公布：{rr_r.get('公布时间') if rr_r else '数据暂缺'}；生效：{rr_r.get('生效时间') if rr_r else '数据暂缺'}", str(rr_r.get("公布时间")) if rr_r else None, "AKShare macro_china_reserve_requirement_ratio"),
                metric("社零同比", fmt_num(retail_r.get("同比增长") if retail_r else None, 1, "%"), f"月份：{retail_r.get('月份') if retail_r else '数据暂缺'}", str(retail_r.get("月份")) if retail_r else None, "AKShare macro_china_consumer_goods_retail"),
                metric("工业增加值", fmt_num(industrial_r.get("同比增长") if industrial_r else None, 1, "%"), f"月份：{industrial_r.get('月份') if industrial_r else '数据暂缺'}", str(industrial_r.get("月份")) if industrial_r else None, "AKShare macro_china_gyzjz"),
            ],
        },
        {
            "id": "style",
            "category": "市场风格",
            "name": "市场风格与杠杆温度",
            "currentStatus": f"沪深两融余额 {margin_value}；人民币中间价 {fmt_num(rmb_r.get('美元/人民币_中间价') if rmb_r else None, 4)}；短端 SHIBOR {fmt_num(shibor_r.get('O/N-定价') if shibor_r else None, 3, '%')}",
            "trend": "震荡",
            "marketImpact": "市场风格用两融余额、汇率和短端利率做温度计；后续可接入 ETF 资金和风格指数相对强弱。",
            "trackingIndicators": ["沪深两融余额", "人民币汇率", "SHIBOR", "ETF 资金", "成长/价值相对强弱", "大小盘相对强弱"],
            "metrics": [
                metric("沪深两融余额", margin_value, f"日期：{margin_date}", margin_date, "AKShare macro_china_market_margin_sh/sz"),
                metric("美元/人民币中间价", fmt_num(rmb_r.get("美元/人民币_中间价") if rmb_r else None, 4), f"日期：{rmb_r.get('日期') if rmb_r else '数据暂缺'}", str(rmb_r.get("日期")) if rmb_r else None, "AKShare macro_china_rmb"),
                metric("SHIBOR 1W", fmt_num(shibor_r.get("1W-定价") if shibor_r else None, 3, "%"), f"日期：{shibor_r.get('日期') if shibor_r else '数据暂缺'}", str(shibor_r.get("日期")) if shibor_r else None, "AKShare macro_china_shibor_all"),
            ],
        },
    ]

    quality = [{"source": source, "sourceLayer": "macro", "updatedAt": now_iso(), "status": "real"} for source in sorted(set(sources))]
    for indicator in indicators:
        indicator["dataQuality"] = quality

    payload = {
        "updatedAt": now_iso(),
        "sourceSummary": sorted(set(sources)),
        "errors": errors,
        "indicators": indicators,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# Macro Data Fetch Report\n\n"
        f"- Generated: {payload['updatedAt']}\n"
        f"- Output: `{OUTPUT.relative_to(ROOT)}`\n"
        f"- Sources: {', '.join(payload['sourceSummary'])}\n"
        f"- Errors: {len(errors)}\n\n"
        + "\n".join(f"- {error}" for error in errors),
        encoding="utf-8",
    )

    print(f"macro data written: {OUTPUT}")
    print(f"errors={len(errors)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
