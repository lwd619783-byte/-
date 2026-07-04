from __future__ import annotations

import json
import math
import re
from datetime import datetime, timedelta, timezone
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
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
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


def parse_date(value: Any) -> datetime | None:
    if value is None:
        return None
    text = str(value)
    quarter_match = re.search(r"(\d{4})年第(\d)季度", text)
    if quarter_match:
        return datetime(int(quarter_match.group(1)), int(quarter_match.group(2)) * 3, 1)
    month_match = re.search(r"(\d{4})年\s*(\d{1,2})月", text)
    if month_match:
        return datetime(int(month_match.group(1)), int(month_match.group(2)), 1)
    compact_month_match = re.fullmatch(r"(\d{4})(\d{2})", text.strip())
    if compact_month_match:
        return datetime(int(compact_month_match.group(1)), int(compact_month_match.group(2)), 1)
    try:
        parsed = pd.to_datetime(value)
        if pd.isna(parsed):
            return None
        return parsed.to_pydatetime()
    except Exception:
        return None


def latest_row(
    df: pd.DataFrame | None,
    label: str,
    date_col: str,
    value_cols: list[str],
    errors: list[str],
) -> dict[str, Any] | None:
    if df is None:
        return None
    try:
        work = df.copy()
        for col in value_cols:
            if col not in work.columns:
                raise KeyError(f"missing column {col}")
            work = work[work[col].notna()]
        if date_col not in work.columns:
            raise KeyError(f"missing date column {date_col}")
        work["_parsed_date"] = work[date_col].map(parse_date)
        work = work[work["_parsed_date"].notna()].sort_values("_parsed_date", ascending=False)
        if work.empty:
            raise ValueError(f"no valid row for {date_col}/{value_cols}")
        return work.iloc[0].to_dict()
    except Exception as exc:
        errors.append(f"{label}: {type(exc).__name__}: {exc}")
        return None


def metric(
    label: str,
    value: str,
    note: str,
    updated_at: str | None,
    source: str,
    status: str = "real",
) -> dict[str, str]:
    return {
        "label": label,
        "value": value,
        "note": note,
        "updatedAt": updated_at or "数据暂缺",
        "source": source,
        "status": status,
    }


def missing_metric(label: str, source: str, reason: str) -> dict[str, str]:
    return metric(label, "数据暂缺", reason, None, source, "missing")


def status_for_date(updated_at: Any, max_age_days: int = 400) -> str:
    parsed = parse_date(updated_at)
    if parsed is None:
        return "missing"
    age = datetime.now().date() - parsed.date()
    return "stale" if age.days > max_age_days else "real"


def fetch_all() -> tuple[dict[str, pd.DataFrame | None], list[str], list[str]]:
    errors: list[str] = []
    sources: list[str] = []
    fetchers: dict[str, Callable[[], pd.DataFrame]] = {
        "macro_china_gdp": ak.macro_china_gdp,
        "macro_china_pmi": ak.macro_china_pmi,
        "macro_china_non_man_pmi": ak.macro_china_non_man_pmi,
        "macro_china_cpi": ak.macro_china_cpi,
        "macro_china_ppi": ak.macro_china_ppi,
        "macro_china_money_supply": ak.macro_china_money_supply,
        "macro_china_new_financial_credit": ak.macro_china_new_financial_credit,
        "macro_china_lpr": ak.macro_china_lpr,
        "macro_china_shibor_all": ak.macro_china_shibor_all,
        "macro_china_rmb": ak.macro_china_rmb,
        "macro_china_reserve_requirement_ratio": ak.macro_china_reserve_requirement_ratio,
        "macro_china_consumer_goods_retail": ak.macro_china_consumer_goods_retail,
        "macro_china_gyzjz": ak.macro_china_gyzjz,
        "macro_china_market_margin_sh": ak.macro_china_market_margin_sh,
        "macro_china_market_margin_sz": ak.macro_china_market_margin_sz,
        "macro_china_exports_yoy": ak.macro_china_exports_yoy,
        "macro_china_imports_yoy": ak.macro_china_imports_yoy,
        "macro_china_trade_balance": ak.macro_china_trade_balance,
        "macro_china_real_estate": ak.macro_china_real_estate,
        "macro_china_new_house_price": ak.macro_china_new_house_price,
        "macro_china_urban_unemployment": ak.macro_china_urban_unemployment,
        "macro_china_bank_financing": ak.macro_china_bank_financing,
    }

    data: dict[str, pd.DataFrame | None] = {}
    for name, fn in fetchers.items():
        try:
            data[name] = fn()
            sources.append(f"AKShare:{name}")
        except Exception as exc:
            data[name] = None
            errors.append(f"{name}: {type(exc).__name__}: {exc}")
    return data, sources, errors


def build_payload() -> dict[str, Any]:
    data, sources, errors = fetch_all()

    gdp_r = latest_row(data["macro_china_gdp"], "GDP", "季度", ["国内生产总值-同比增长"], errors)
    pmi_r = latest_row(data["macro_china_pmi"], "PMI", "月份", ["制造业-指数", "非制造业-指数"], errors)
    non_pmi_r = latest_row(data["macro_china_non_man_pmi"], "non-man PMI", "日期", ["今值"], errors)
    cpi_r = latest_row(data["macro_china_cpi"], "CPI", "月份", ["全国-同比增长"], errors)
    ppi_r = latest_row(data["macro_china_ppi"], "PPI", "月份", ["当月同比增长"], errors)
    money_r = latest_row(data["macro_china_money_supply"], "money supply", "月份", ["货币和准货币(M2)-同比增长"], errors)
    credit_r = latest_row(data["macro_china_new_financial_credit"], "new credit", "月份", ["当月"], errors)
    lpr_r = latest_row(data["macro_china_lpr"], "LPR", "TRADE_DATE", ["LPR1Y", "LPR5Y"], errors)
    shibor_r = latest_row(data["macro_china_shibor_all"], "SHIBOR", "日期", ["O/N-定价", "1W-定价"], errors)
    rmb_r = latest_row(data["macro_china_rmb"], "RMB", "日期", ["美元/人民币_中间价"], errors)
    rr_r = latest_row(data["macro_china_reserve_requirement_ratio"], "RRR", "公布时间", ["大型金融机构-调整后"], errors)
    retail_r = latest_row(data["macro_china_consumer_goods_retail"], "retail", "月份", ["同比增长"], errors)
    industrial_r = latest_row(data["macro_china_gyzjz"], "industrial", "月份", ["同比增长"], errors)
    export_r = latest_row(data["macro_china_exports_yoy"], "exports yoy", "日期", ["今值"], errors)
    import_r = latest_row(data["macro_china_imports_yoy"], "imports yoy", "日期", ["今值"], errors)
    trade_balance_r = latest_row(data["macro_china_trade_balance"], "trade balance", "日期", ["今值"], errors)
    estate_r = latest_row(data["macro_china_real_estate"], "real estate", "日期", ["最新值", "涨跌幅"], errors)
    house_price_r = latest_row(data["macro_china_new_house_price"], "new house price", "日期", ["新建商品住宅价格指数-同比", "新建商品住宅价格指数-环比"], errors)
    unemployment_r = latest_row(data["macro_china_urban_unemployment"], "urban unemployment", "月份", ["城镇调查失业率"], errors)
    bank_financing_r = latest_row(data["macro_china_bank_financing"], "bank financing", "日期", ["最新值", "涨跌幅"], errors)
    rmb_status = status_for_date(rmb_r.get("日期") if rmb_r else None)
    rmb_note_suffix = "" if rmb_status == "real" else "；当前接口仅返回旧数据，按 stale 处理"

    margin_value = "数据暂缺"
    margin_date = "数据暂缺"
    if data["macro_china_market_margin_sh"] is not None and data["macro_china_market_margin_sz"] is not None:
        try:
            sh = latest_row(data["macro_china_market_margin_sh"], "margin sh", "日期", ["融资融券余额"], errors)
            sz = latest_row(data["macro_china_market_margin_sz"], "margin sz", "日期", ["融资融券余额"], errors)
            if sh and sz:
                margin_value = fmt_yi(float(sh["融资融券余额"]) / 100000000 + float(sz["融资融券余额"]) / 100000000)
                margin_dates = [parse_date(sh["日期"]), parse_date(sz["日期"])]
                margin_date = str(max(item for item in margin_dates if item is not None).date())
        except Exception as exc:
            errors.append(f"margin aggregate: {type(exc).__name__}: {exc}")

    unemployment_metric = (
        metric(
            "城镇调查失业率",
            fmt_num(unemployment_r.get("城镇调查失业率"), 1, "%"),
            f"月份：{unemployment_r.get('月份')}",
            str(unemployment_r.get("月份")),
            "AKShare macro_china_urban_unemployment",
        )
        if unemployment_r
        else missing_metric("城镇调查失业率", "AKShare macro_china_urban_unemployment", "国家统计局接口当前返回异常，保留待接入")
    )

    indicators = [
        {
            "id": "macro-cycle",
            "category": "宏观环境",
            "name": "增长与价格组合",
            "currentStatus": f"GDP {fmt_num(gdp_r.get('国内生产总值-同比增长') if gdp_r else None, 1, '%')}；制造业 PMI {fmt_num(pmi_r.get('制造业-指数') if pmi_r else None, 1)}；CPI/PPI {fmt_num(cpi_r.get('全国-同比增长') if cpi_r else None, 1, '%')} / {fmt_num(ppi_r.get('当月同比增长') if ppi_r else None, 1, '%')}",
            "trend": "待验证",
            "marketImpact": "增长、价格、生产与消费数据用于判断盈利弹性是否从政策预期走向真实需求。",
            "trackingIndicators": ["GDP", "制造业 PMI", "非制造业 PMI", "CPI", "PPI", "工业增加值", "社零"],
            "metrics": [
                metric("GDP 同比", fmt_num(gdp_r.get("国内生产总值-同比增长") if gdp_r else None, 1, "%"), f"报告期：{gdp_r.get('季度') if gdp_r else '数据暂缺'}", str(gdp_r.get("季度")) if gdp_r else None, "AKShare macro_china_gdp"),
                metric("制造业 PMI", fmt_num(pmi_r.get("制造业-指数") if pmi_r else None, 1), f"月份：{pmi_r.get('月份') if pmi_r else '数据暂缺'}", str(pmi_r.get("月份")) if pmi_r else None, "AKShare macro_china_pmi"),
                metric("非制造业 PMI", fmt_num((pmi_r or {}).get("非制造业-指数", (non_pmi_r or {}).get("今值")), 1), f"月份：{(pmi_r or {}).get('月份', (non_pmi_r or {}).get('日期', '数据暂缺'))}", str((pmi_r or {}).get("月份", (non_pmi_r or {}).get("日期", ""))), "AKShare macro_china_pmi"),
                metric("CPI 同比", fmt_num(cpi_r.get("全国-同比增长") if cpi_r else None, 1, "%"), f"月份：{cpi_r.get('月份') if cpi_r else '数据暂缺'}", str(cpi_r.get("月份")) if cpi_r else None, "AKShare macro_china_cpi"),
                metric("PPI 同比", fmt_num(ppi_r.get("当月同比增长") if ppi_r else None, 1, "%"), f"月份：{ppi_r.get('月份') if ppi_r else '数据暂缺'}", str(ppi_r.get("月份")) if ppi_r else None, "AKShare macro_china_ppi"),
                metric("工业增加值", fmt_num(industrial_r.get("同比增长") if industrial_r else None, 1, "%"), f"月份：{industrial_r.get('月份') if industrial_r else '数据暂缺'}", str(industrial_r.get("月份")) if industrial_r else None, "AKShare macro_china_gyzjz"),
                metric("社零同比", fmt_num(retail_r.get("同比增长") if retail_r else None, 1, "%"), f"月份：{retail_r.get('月份') if retail_r else '数据暂缺'}", str(retail_r.get("月份")) if retail_r else None, "AKShare macro_china_consumer_goods_retail"),
            ],
        },
        {
            "id": "liquidity",
            "category": "流动性",
            "name": "资金与利率环境",
            "currentStatus": f"M2 {fmt_num(money_r.get('货币和准货币(M2)-同比增长') if money_r else None, 1, '%')}；LPR {fmt_num(lpr_r.get('LPR1Y') if lpr_r else None, 2, '%')} / {fmt_num(lpr_r.get('LPR5Y') if lpr_r else None, 2, '%')}；两融 {margin_value}",
            "trend": "震荡",
            "marketImpact": "流动性决定估值扩张空间，M2、信贷、短端利率和两融共同约束主题行情能否扩散。",
            "trackingIndicators": ["M2", "新增人民币贷款", "LPR", "SHIBOR", "人民币汇率", "融资融券余额"],
            "metrics": [
                metric("M2 同比", fmt_num(money_r.get("货币和准货币(M2)-同比增长") if money_r else None, 1, "%"), f"月份：{money_r.get('月份') if money_r else '数据暂缺'}", str(money_r.get("月份")) if money_r else None, "AKShare macro_china_money_supply"),
                metric("新增人民币贷款", fmt_yi(credit_r.get("当月") if credit_r else None), f"月份：{credit_r.get('月份') if credit_r else '数据暂缺'}", str(credit_r.get("月份")) if credit_r else None, "AKShare macro_china_new_financial_credit"),
                metric("LPR 1Y / 5Y", f"{fmt_num(lpr_r.get('LPR1Y') if lpr_r else None, 2, '%')} / {fmt_num(lpr_r.get('LPR5Y') if lpr_r else None, 2, '%')}", f"日期：{lpr_r.get('TRADE_DATE') if lpr_r else '数据暂缺'}", str(lpr_r.get("TRADE_DATE")) if lpr_r else None, "AKShare macro_china_lpr"),
                metric("SHIBOR O/N", fmt_num(shibor_r.get("O/N-定价") if shibor_r else None, 3, "%"), f"日期：{shibor_r.get('日期') if shibor_r else '数据暂缺'}", str(shibor_r.get("日期")) if shibor_r else None, "AKShare macro_china_shibor_all"),
                metric("美元/人民币中间价", fmt_num(rmb_r.get("美元/人民币_中间价") if rmb_r else None, 4), f"日期：{rmb_r.get('日期') if rmb_r else '数据暂缺'}{rmb_note_suffix}", str(rmb_r.get("日期")) if rmb_r else None, "AKShare macro_china_rmb", rmb_status),
                metric("沪深两融余额", margin_value, f"日期：{margin_date}", margin_date, "AKShare macro_china_market_margin_sh/sz"),
                metric("银行结售汇差额", fmt_yi(bank_financing_r.get("最新值") if bank_financing_r else None), f"月份：{bank_financing_r.get('日期') if bank_financing_r else '数据暂缺'}；环比：{fmt_num(bank_financing_r.get('涨跌幅') if bank_financing_r else None, 1, '%')}", str(bank_financing_r.get("日期")) if bank_financing_r else None, "AKShare macro_china_bank_financing"),
            ],
        },
        {
            "id": "policy",
            "category": "政策窗口",
            "name": "政策与信用脉冲",
            "currentStatus": f"大型机构存准率 {fmt_num(rr_r.get('大型金融机构-调整后') if rr_r else None, 2, '%')}；新增信贷 {fmt_yi(credit_r.get('当月') if credit_r else None)}",
            "trend": "待验证",
            "marketImpact": "政策窗口先用信用、消费、生产和准备金率验证，不替代政策原文解读。",
            "trackingIndicators": ["存款准备金率", "新增信贷", "社零", "工业增加值", "财政数据", "产业政策细则"],
            "metrics": [
                metric("大型机构存准率", fmt_num(rr_r.get("大型金融机构-调整后") if rr_r else None, 2, "%"), f"公布：{rr_r.get('公布时间') if rr_r else '数据暂缺'}；生效：{rr_r.get('生效时间') if rr_r else '数据暂缺'}", str(rr_r.get("公布时间")) if rr_r else None, "AKShare macro_china_reserve_requirement_ratio"),
                metric("新增人民币贷款", fmt_yi(credit_r.get("当月") if credit_r else None), f"月份：{credit_r.get('月份') if credit_r else '数据暂缺'}", str(credit_r.get("月份")) if credit_r else None, "AKShare macro_china_new_financial_credit"),
                metric("社零同比", fmt_num(retail_r.get("同比增长") if retail_r else None, 1, "%"), f"月份：{retail_r.get('月份') if retail_r else '数据暂缺'}", str(retail_r.get("月份")) if retail_r else None, "AKShare macro_china_consumer_goods_retail"),
            ],
        },
        {
            "id": "style",
            "category": "市场风格",
            "name": "市场风格与杠杆温度",
            "currentStatus": f"两融 {margin_value}；人民币中间价 {fmt_num(rmb_r.get('美元/人民币_中间价') if rmb_r else None, 4)}；短端 SHIBOR {fmt_num(shibor_r.get('O/N-定价') if shibor_r else None, 3, '%')}",
            "trend": "震荡",
            "marketImpact": "市场风格先用两融、汇率和短端利率观察风险偏好，后续可接 ETF 资金和风格指数相对强弱。",
            "trackingIndicators": ["沪深两融余额", "人民币汇率", "SHIBOR", "ETF 资金", "成长/价值相对强弱", "大小盘相对强弱"],
            "metrics": [
                metric("沪深两融余额", margin_value, f"日期：{margin_date}", margin_date, "AKShare macro_china_market_margin_sh/sz"),
                metric("美元/人民币中间价", fmt_num(rmb_r.get("美元/人民币_中间价") if rmb_r else None, 4), f"日期：{rmb_r.get('日期') if rmb_r else '数据暂缺'}{rmb_note_suffix}", str(rmb_r.get("日期")) if rmb_r else None, "AKShare macro_china_rmb", rmb_status),
                metric("SHIBOR 1W", fmt_num(shibor_r.get("1W-定价") if shibor_r else None, 3, "%"), f"日期：{shibor_r.get('日期') if shibor_r else '数据暂缺'}", str(shibor_r.get("日期")) if shibor_r else None, "AKShare macro_china_shibor_all"),
            ],
        },
        {
            "id": "trade",
            "category": "宏观环境",
            "name": "外贸需求与顺差",
            "currentStatus": f"出口同比 {fmt_num(export_r.get('今值') if export_r else None, 1, '%')}；进口同比 {fmt_num(import_r.get('今值') if import_r else None, 1, '%')}；贸易差额 {fmt_num(trade_balance_r.get('今值') if trade_balance_r else None, 1, ' 亿美元')}",
            "trend": "待验证",
            "marketImpact": "外贸数据用于验证海外需求、汇率压力和出口链盈利弹性。",
            "trackingIndicators": ["出口同比", "进口同比", "贸易差额", "海外需求"],
            "metrics": [
                metric("出口同比", fmt_num(export_r.get("今值") if export_r else None, 1, "%"), f"日期：{export_r.get('日期') if export_r else '数据暂缺'}；前值：{fmt_num(export_r.get('前值') if export_r else None, 1, '%')}", str(export_r.get("日期")) if export_r else None, "AKShare macro_china_exports_yoy"),
                metric("进口同比", fmt_num(import_r.get("今值") if import_r else None, 1, "%"), f"日期：{import_r.get('日期') if import_r else '数据暂缺'}；前值：{fmt_num(import_r.get('前值') if import_r else None, 1, '%')}", str(import_r.get("日期")) if import_r else None, "AKShare macro_china_imports_yoy"),
                metric("贸易差额", fmt_num(trade_balance_r.get("今值") if trade_balance_r else None, 1, " 亿美元"), f"日期：{trade_balance_r.get('日期') if trade_balance_r else '数据暂缺'}；前值：{fmt_num(trade_balance_r.get('前值') if trade_balance_r else None, 1, ' 亿美元')}", str(trade_balance_r.get("日期")) if trade_balance_r else None, "AKShare macro_china_trade_balance"),
            ],
        },
        {
            "id": "real-estate",
            "category": "宏观环境",
            "name": "地产销售与价格",
            "currentStatus": f"地产景气指数 {fmt_num(estate_r.get('最新值') if estate_r else None, 2)}；新房同比 {fmt_num(house_price_r.get('新建商品住宅价格指数-同比') if house_price_r else None, 1)}",
            "trend": "待验证",
            "marketImpact": "地产链数据用于判断信用扩张是否能传导到内需和周期资产。",
            "trackingIndicators": ["地产景气指数", "新房价格同比", "新房价格环比", "销售开工竣工"],
            "metrics": [
                metric("地产景气指数", fmt_num(estate_r.get("最新值") if estate_r else None, 2), f"日期：{estate_r.get('日期') if estate_r else '数据暂缺'}；月度变动：{fmt_num(estate_r.get('涨跌幅') if estate_r else None, 2, '%')}", str(estate_r.get("日期")) if estate_r else None, "AKShare macro_china_real_estate"),
                metric("新房价格同比", fmt_num(house_price_r.get("新建商品住宅价格指数-同比") if house_price_r else None, 1), f"城市：{house_price_r.get('城市') if house_price_r else '数据暂缺'}；日期：{house_price_r.get('日期') if house_price_r else '数据暂缺'}", str(house_price_r.get("日期")) if house_price_r else None, "AKShare macro_china_new_house_price"),
                metric("新房价格环比", fmt_num(house_price_r.get("新建商品住宅价格指数-环比") if house_price_r else None, 1), f"城市：{house_price_r.get('城市') if house_price_r else '数据暂缺'}；日期：{house_price_r.get('日期') if house_price_r else '数据暂缺'}", str(house_price_r.get("日期")) if house_price_r else None, "AKShare macro_china_new_house_price"),
            ],
        },
        {
            "id": "employment",
            "category": "宏观环境",
            "name": "就业与居民压力",
            "currentStatus": "就业数据用于校验消费修复质量，当前按接口状态展示。",
            "trend": "待验证",
            "marketImpact": "就业是消费和政策托底的重要约束，接口失败时只能保留缺口，不能用旧数替代。",
            "trackingIndicators": ["城镇调查失业率", "居民收入", "招聘景气"],
            "metrics": [unemployment_metric],
        },
        {
            "id": "risk",
            "category": "市场风格",
            "name": "风险因子与外部压力",
            "currentStatus": f"CPI/PPI {fmt_num(cpi_r.get('全国-同比增长') if cpi_r else None, 1, '%')} / {fmt_num(ppi_r.get('当月同比增长') if ppi_r else None, 1, '%')}；人民币 {fmt_num(rmb_r.get('美元/人民币_中间价') if rmb_r else None, 4)}；银行结售汇 {fmt_yi(bank_financing_r.get('最新值') if bank_financing_r else None)}",
            "trend": "震荡",
            "marketImpact": "风险因子用于观察通胀、汇率、外部需求和资金面是否压制估值。",
            "trackingIndicators": ["CPI", "PPI", "人民币汇率", "贸易差额", "银行结售汇"],
            "metrics": [
                metric("CPI 同比", fmt_num(cpi_r.get("全国-同比增长") if cpi_r else None, 1, "%"), f"月份：{cpi_r.get('月份') if cpi_r else '数据暂缺'}", str(cpi_r.get("月份")) if cpi_r else None, "AKShare macro_china_cpi"),
                metric("PPI 同比", fmt_num(ppi_r.get("当月同比增长") if ppi_r else None, 1, "%"), f"月份：{ppi_r.get('月份') if ppi_r else '数据暂缺'}", str(ppi_r.get("月份")) if ppi_r else None, "AKShare macro_china_ppi"),
                metric("美元/人民币中间价", fmt_num(rmb_r.get("美元/人民币_中间价") if rmb_r else None, 4), f"日期：{rmb_r.get('日期') if rmb_r else '数据暂缺'}{rmb_note_suffix}", str(rmb_r.get("日期")) if rmb_r else None, "AKShare macro_china_rmb", rmb_status),
                metric("银行结售汇差额", fmt_yi(bank_financing_r.get("最新值") if bank_financing_r else None), f"月份：{bank_financing_r.get('日期') if bank_financing_r else '数据暂缺'}；环比：{fmt_num(bank_financing_r.get('涨跌幅') if bank_financing_r else None, 1, '%')}", str(bank_financing_r.get("日期")) if bank_financing_r else None, "AKShare macro_china_bank_financing"),
            ],
        },
    ]

    quality = [{"source": source, "sourceLayer": "macro", "updatedAt": now_iso(), "status": "real"} for source in sorted(set(sources))]
    for error in errors:
        quality.append({"source": error.split(":", 1)[0], "sourceLayer": "macro", "updatedAt": now_iso(), "status": "error", "message": error})
    for indicator in indicators:
        indicator["dataQuality"] = quality

    return {
        "updatedAt": now_iso(),
        "sourceSummary": sorted(set(sources)),
        "errors": errors,
        "indicators": indicators,
    }


def write_report(payload: dict[str, Any]) -> None:
    metrics = [metric for indicator in payload["indicators"] for metric in indicator["metrics"]]
    real_count = sum(1 for item in metrics if item.get("status") == "real" and item.get("value") != "数据暂缺")
    missing = [item for item in metrics if item.get("status") != "real" or item.get("value") == "数据暂缺"]
    lines = [
        "# Macro Data Fetch Report",
        "",
        f"- Generated: {payload['updatedAt']}",
        f"- Output: `{OUTPUT.relative_to(ROOT)}`",
        f"- Sources: {len(payload['sourceSummary'])}",
        f"- Indicators: {len(payload['indicators'])}",
        f"- Metrics: {real_count}/{len(metrics)} real",
        f"- Errors: {len(payload['errors'])}",
        "",
        "## Missing / Failed Items",
    ]
    if missing:
        lines.extend(f"- {item['label']}: {item.get('note', '数据暂缺')} ({item.get('source', 'unknown')})" for item in missing)
    else:
        lines.append("- None")
    lines.extend(["", "## Source Errors"])
    if payload["errors"]:
        lines.extend(f"- {error}" for error in payload["errors"])
    else:
        lines.append("- None")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run() -> int:
    payload = build_payload()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(payload)
    metrics = [metric for indicator in payload["indicators"] for metric in indicator["metrics"]]
    real_count = sum(1 for item in metrics if item.get("status") == "real" and item.get("value") != "数据暂缺")
    print(f"macro data written: {OUTPUT}")
    print(f"metrics={real_count}/{len(metrics)} errors={len(payload['errors'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
