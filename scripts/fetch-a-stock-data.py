from __future__ import annotations

import json
import random
import re
import time
import gzip
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib import parse, request


ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"
LOG_DIR = ROOT / "data-cache" / "a-stock-data" / "raw"
STOCK_UNIVERSE_PATH = REAL_DIR / "stock-universe.generated.json"
CN_TZ = timezone(timedelta(hours=8))

def load_stock_universe() -> list[dict[str, Any]]:
    if not STOCK_UNIVERSE_PATH.exists():
        raise FileNotFoundError("stock-universe.generated.json is missing; run `npm run data:universe` first")
    payload = json.loads(STOCK_UNIVERSE_PATH.read_text(encoding="utf-8"))
    items = payload.get("items", [])
    if not isinstance(items, list) or not items:
        raise ValueError("stock-universe.generated.json has no items")
    return items



def now_iso() -> str:
    return datetime.now(CN_TZ).replace(microsecond=0).isoformat()


def quality(
    source: str,
    status: str,
    layer: str,
    endpoint: str,
    updated_at: str,
    url: str | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    item = {
        "source": source,
        "sourceLayer": layer,
        "sourceEndpoint": endpoint,
        "updatedAt": updated_at,
        "status": status,
    }
    if url:
        item["sourceUrl"] = url
    if error:
        item["errorMessage"] = error
    return item


def http_get(url: str, encoding: str = "utf-8", timeout: int = 12) -> str:
    req = request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://quote.eastmoney.com/",
        },
    )
    with request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
    return raw.decode(encoding, errors="replace")


def http_get_json(url: str, timeout: int = 15) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            req = request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://quote.eastmoney.com/",
                    "Accept-Encoding": "gzip",
                },
            )
            with request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
            if raw[:2] == b"\x1f\x8b":
                raw = gzip.decompress(raw)
            return json.loads(raw.decode("utf-8", errors="replace"))
        except Exception as exc:
            last_error = exc
            time.sleep(0.4 + attempt * 0.6)
    raise last_error or RuntimeError("JSON request failed")


def em_get(url: str) -> str:
    time.sleep(1.05 + random.random() * 0.35)
    return http_get(url)


def em_json(url: str) -> dict[str, Any]:
    time.sleep(1.05 + random.random() * 0.35)
    return http_get_json(url)


def market_prefix(stock: dict[str, str]) -> str:
    return ("sh" if stock["exchange"] == "SH" else "sz") + stock["code"]


def market_code(stock: dict[str, str]) -> str:
    return ("1." if stock["exchange"] == "SH" else "0.") + stock["code"]


def empty_bundle(stock_id: str, name: str, code: str, market: str, updated_at: str, status: str, message: str) -> dict[str, Any]:
    q = quality("A Stock Data", status, "symbol", "market-support", updated_at, error=message)
    return {
        "profile": {
            "id": stock_id,
            "name": name,
            "code": code,
            "market": market,
            "fullName": None,
            "industryName": None,
            "industryClassifications": [],
            "listDate": None,
            "totalShares": None,
            "floatShares": None,
            "companyProfile": None,
            "businessScope": None,
            "f10Summary": None,
            "revenueComposition": [],
            "mainProducts": [],
            "quality": q,
        },
        "quote": {
            "id": stock_id,
            "latestPrice": None,
            "pctChange": None,
            "amount": None,
            "marketCap": None,
            "floatMarketCap": None,
            "pe": None,
            "peTtm": None,
            "pb": None,
            "ps": None,
            "dividendYield": None,
            "turnover": None,
            "limitUp": None,
            "limitDown": None,
            "updatedAt": updated_at,
            "quality": q,
        },
        "financial": missing_financial(stock_id, updated_at, q),
        "history": {"id": stock_id, "points": [], "quality": q},
        "research": {"id": stock_id, "reports": [], "quality": q},
        "announcements": {"id": stock_id, "announcements": [], "quality": q},
        "signals": {
            "id": stock_id,
            "mainFundFlow5d": None,
            "mainFundFlow20d": None,
            "latestMainFundFlow": None,
            "marginBalance": None,
            "dragonTigerCount30d": None,
            "holderChangePct": None,
            "upcomingLockupCount": None,
            "popularityRank": None,
            "hotReason": None,
            "latestInteraction": None,
            "fieldSources": {},
            "quality": q,
        },
        "sector": {"id": stock_id, "industry": [], "concept": [], "region": [], "quality": q},
    }


def missing_financial(stock_id: str, updated_at: str, q: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": stock_id,
        "reportDate": None,
        "revenue": None,
        "revenueGrowth": None,
        "netProfit": None,
        "profitGrowth": None,
        "eps": None,
        "grossMargin": None,
        "netMargin": None,
        "roe": None,
        "debtRatio": None,
        "operatingCashFlow": None,
        "updatedAt": updated_at,
        "quality": q or quality("A Stock Data", "missing", "finance", "not-fetched", updated_at),
    }


def to_float(value: Any, scale: float = 1.0) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in {"-", "--", "None", "null"}:
        return None
    try:
        return float(text) / scale
    except ValueError:
        return None


def clean_text(value: Any, limit: int = 700) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text[:limit] if text else None


def stock_secid(stock: dict[str, str]) -> str:
    return ("1." if stock["exchange"] == "SH" else "0.") + stock["code"]


def eastmoney_datacenter(report_name: str, filter_str: str = "", page_size: int = 30, sort_columns: str = "", sort_types: str = "-1") -> list[dict[str, Any]]:
    params = {
        "reportName": report_name,
        "columns": "ALL",
        "filter": filter_str,
        "pageNumber": "1",
        "pageSize": str(page_size),
        "sortColumns": sort_columns,
        "sortTypes": sort_types,
        "source": "WEB",
        "client": "WEB",
    }
    url = "https://datacenter-web.eastmoney.com/api/data/v1/get?" + parse.urlencode(params)
    data = em_json(url)
    return data.get("result", {}).get("data", []) or []


def fetch_eastmoney_f10(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    east_code = f"{stock['code']}.{stock['exchange']}"
    url = f"https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code={east_code}"
    try:
        data = em_json(url)
        item = (data.get("jbzl") or [{}])[0]
        industries = [
            {"scheme": "Eastmoney industry", "name": item.get("EM2016")},
            {"scheme": "CSRC industry", "name": item.get("INDUSTRYCSRC1")},
        ]
        industries = [row for row in industries if row.get("name")]
        profile = {
            "fullName": item.get("ORG_NAME"),
            "industryName": item.get("EM2016") or item.get("INDUSTRYCSRC1"),
            "industryClassifications": industries,
            "companyProfile": clean_text(item.get("ORG_PROFILE"), 900),
            "businessScope": clean_text(item.get("BUSINESS_SCOPE"), 900),
            "f10Summary": clean_text(
                " | ".join(
                    filter(
                        None,
                        [
                            item.get("ORG_NAME"),
                            item.get("SECURITY_TYPE"),
                            item.get("TRADE_MARKET"),
                            item.get("ORG_WEB"),
                        ],
                    )
                ),
                500,
            ),
            "revenueComposition": [],
            "mainProducts": [],
            "quality": quality("A Stock Data", "real", "f10", "Eastmoney HSF10 CompanySurvey", updated_at, url),
        }
        if not profile["companyProfile"] and not profile["businessScope"]:
            profile["quality"] = quality("A Stock Data", "missing", "f10", "Eastmoney HSF10 CompanySurvey", updated_at, url)
        return profile
    except Exception as exc:
        return {
            "fullName": None,
            "industryName": None,
            "industryClassifications": [],
            "companyProfile": None,
            "businessScope": None,
            "f10Summary": None,
            "revenueComposition": [],
            "mainProducts": [],
            "quality": quality("A Stock Data", "error", "f10", "Eastmoney HSF10 CompanySurvey", updated_at, url, str(exc)),
        }


def fetch_eastmoney_stock_info(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    params = {
        "fltt": "2",
        "invt": "2",
        "fields": "f57,f58,f84,f85,f127,f116,f117,f189,f43",
        "secid": stock_secid(stock),
    }
    url = "https://push2.eastmoney.com/api/qt/stock/get?" + parse.urlencode(params)
    try:
        data = em_json(url).get("data", {}) or {}
        list_date = str(data.get("f189") or "")
        return {
            "name": data.get("f58"),
            "industryName": data.get("f127"),
            "listDate": f"{list_date[:4]}-{list_date[4:6]}-{list_date[6:8]}" if len(list_date) == 8 else None,
            "totalShares": to_float(data.get("f84"), 100000000),
            "floatShares": to_float(data.get("f85"), 100000000),
            "quality": quality("A Stock Data", "real", "profile", "Eastmoney push2 stock/get", updated_at, url),
        }
    except Exception as exc:
        return {"quality": quality("A Stock Data", "error", "profile", "Eastmoney push2 stock/get", updated_at, url, str(exc))}


def sina_report(stock: dict[str, str], report_type: str, num: int = 2) -> list[dict[str, Any]]:
    prefix = "sh" if stock["exchange"] == "SH" else "sz"
    params = {
        "paperCode": f"{prefix}{stock['code']}",
        "source": report_type,
        "type": "0",
        "page": "1",
        "num": str(num),
    }
    url = "https://quotes.sina.cn/cn/api/openapi.php/CompanyFinanceService.getFinanceReport2022?" + parse.urlencode(params)
    data = http_get_json(url)
    report_list = data.get("result", {}).get("data", {}).get("report_list", {}) or {}
    rows = []
    for period in sorted(report_list.keys(), reverse=True)[:num]:
        source_rows = report_list[period].get("data", []) or []
        rows.append(
            {
                "period": f"{period[:4]}-{period[4:6]}-{period[6:8]}",
                "rows": source_rows,
                "url": url,
            }
        )
    return rows


def row_value(rows: list[dict[str, Any]], index: int) -> float | None:
    if index >= len(rows):
        return None
    return to_float(rows[index].get("item_value"))


def row_yoy(rows: list[dict[str, Any]], index: int) -> float | None:
    if index >= len(rows):
        return None
    value = to_float(rows[index].get("item_tongbi"))
    return value * 100 if value is not None else None


def fetch_financial(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    try:
        lrb = sina_report(stock, "lrb", 2)
        fzb = sina_report(stock, "fzb", 1)
        llb = sina_report(stock, "llb", 1)
        if not lrb:
            raise ValueError("Sina income statement is empty")
        income_rows = lrb[0]["rows"]
        balance_rows = fzb[0]["rows"] if fzb else []
        cash_rows = llb[0]["rows"] if llb else []

        revenue_raw = row_value(income_rows, 0) or row_value(income_rows, 1)
        cost_raw = row_value(income_rows, 8)
        net_profit_raw = row_value(income_rows, 50)
        eps = row_value(income_rows, 75)
        asset_raw = row_value(balance_rows, 66)
        liability_raw = row_value(balance_rows, 121)
        equity_raw = row_value(balance_rows, 137) or row_value(balance_rows, 139)
        cash_flow_raw = row_value(cash_rows, 25)

        revenue = revenue_raw / 100000000 if revenue_raw is not None else None
        net_profit = net_profit_raw / 100000000 if net_profit_raw is not None else None
        operating_cash_flow = cash_flow_raw / 100000000 if cash_flow_raw is not None else None
        gross_margin = ((revenue_raw - cost_raw) / revenue_raw * 100) if revenue_raw and cost_raw is not None else None
        net_margin = (net_profit_raw / revenue_raw * 100) if revenue_raw and net_profit_raw is not None else None
        debt_ratio = (liability_raw / asset_raw * 100) if asset_raw and liability_raw is not None else None
        roe = (net_profit_raw / equity_raw * 100) if equity_raw and net_profit_raw is not None else None

        q_status = "real" if sum(value is not None for value in [revenue, net_profit, roe, operating_cash_flow]) >= 2 else "missing"
        return {
            "id": stock["id"],
            "reportDate": lrb[0]["period"],
            "revenue": revenue,
            "revenueGrowth": row_yoy(income_rows, 0) or row_yoy(income_rows, 1),
            "netProfit": net_profit,
            "profitGrowth": row_yoy(income_rows, 50),
            "eps": eps,
            "grossMargin": gross_margin,
            "netMargin": net_margin,
            "roe": roe,
            "debtRatio": debt_ratio,
            "operatingCashFlow": operating_cash_flow,
            "updatedAt": updated_at,
            "quality": quality("A Stock Data", q_status, "finance", "Sina financial statements", updated_at, lrb[0]["url"]),
        }
    except Exception as exc:
        return missing_financial(
            stock["id"],
            updated_at,
            quality("A Stock Data", "error", "finance", "Sina financial statements", updated_at, error=str(exc)),
        )


def fetch_fund_flow(stock: dict[str, str], updated_at: str) -> tuple[dict[str, Any], dict[str, Any]]:
    params = {
        "secid": stock_secid(stock),
        "fields1": "f1,f2,f3,f7",
        "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65",
        "lmt": "120",
    }
    url = "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?" + parse.urlencode(params)
    data = em_json(url)
    rows = []
    for line in data.get("data", {}).get("klines", []) or []:
        parts = line.split(",")
        if len(parts) >= 6:
            rows.append({"date": parts[0], "main_net": to_float(parts[1])})
    recent = [row["main_net"] for row in rows if isinstance(row.get("main_net"), (int, float))]
    source = quality("A Stock Data", "real" if recent else "missing", "signals", "Eastmoney push2his fund flow", updated_at, url)
    return {
        "latestMainFundFlow": recent[-1] / 100000000 if recent else None,
        "mainFundFlow5d": sum(recent[-5:]) / 100000000 if len(recent) >= 5 else None,
        "mainFundFlow20d": sum(recent[-20:]) / 100000000 if len(recent) >= 20 else None,
    }, source


def fetch_margin(stock: dict[str, str], updated_at: str) -> tuple[float | None, dict[str, Any]]:
    try:
        rows = eastmoney_datacenter("RPTA_WEB_RZRQ_GGMX", f'(SCODE="{stock["code"]}")', 5, "DATE", "-1")
        value = to_float(rows[0].get("RZRQYE"), 100000000) if rows else None
        return value, quality("A Stock Data", "real" if value is not None else "missing", "signals", "Eastmoney datacenter margin", updated_at)
    except Exception as exc:
        return None, quality("A Stock Data", "error", "signals", "Eastmoney datacenter margin", updated_at, error=str(exc))


def fetch_dragon_tiger_count(stock: dict[str, str], updated_at: str) -> tuple[int | None, dict[str, Any]]:
    try:
        end = datetime.now(CN_TZ).date()
        begin = end - timedelta(days=30)
        rows = eastmoney_datacenter(
            "RPT_DAILYBILLBOARD_DETAILSNEW",
            f'(TRADE_DATE>="{begin.isoformat()}")(TRADE_DATE<="{end.isoformat()}")(SECURITY_CODE="{stock["code"]}")',
            50,
            "TRADE_DATE",
            "-1",
        )
        return len(rows), quality("A Stock Data", "real", "signals", "Eastmoney datacenter dragon tiger", updated_at)
    except Exception as exc:
        return None, quality("A Stock Data", "error", "signals", "Eastmoney datacenter dragon tiger", updated_at, error=str(exc))


def fetch_holder_change(stock: dict[str, str], updated_at: str) -> tuple[float | None, dict[str, Any]]:
    try:
        rows = eastmoney_datacenter("RPT_HOLDERNUMLATEST", f'(SECURITY_CODE="{stock["code"]}")', 5, "END_DATE", "-1")
        value = to_float(rows[0].get("HOLDER_NUM_RATIO")) if rows else None
        return value, quality("A Stock Data", "real" if value is not None else "missing", "signals", "Eastmoney datacenter holder count", updated_at)
    except Exception as exc:
        return None, quality("A Stock Data", "error", "signals", "Eastmoney datacenter holder count", updated_at, error=str(exc))


def fetch_lockup_count(stock: dict[str, str], updated_at: str) -> tuple[int | None, dict[str, Any]]:
    try:
        begin = datetime.now(CN_TZ).date()
        end = begin + timedelta(days=90)
        rows = eastmoney_datacenter(
            "RPT_LIFT_STAGE",
            f'(SECURITY_CODE="{stock["code"]}")(FREE_DATE>="{begin.isoformat()}")(FREE_DATE<="{end.isoformat()}")',
            20,
            "FREE_DATE",
            "1",
        )
        return len(rows), quality("A Stock Data", "real", "signals", "Eastmoney datacenter lockup", updated_at)
    except Exception as exc:
        return None, quality("A Stock Data", "error", "signals", "Eastmoney datacenter lockup", updated_at, error=str(exc))


def fetch_signals(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    fields: dict[str, Any] = {
        "id": stock["id"],
        "mainFundFlow5d": None,
        "mainFundFlow20d": None,
        "latestMainFundFlow": None,
        "marginBalance": None,
        "dragonTigerCount30d": None,
        "holderChangePct": None,
        "upcomingLockupCount": None,
        "popularityRank": None,
        "hotReason": None,
        "latestInteraction": None,
        "fieldSources": {},
    }
    source_items: list[dict[str, Any]] = []

    for name, getter in [
        ("fundFlow", lambda: fetch_fund_flow(stock, updated_at)),
        ("marginBalance", lambda: fetch_margin(stock, updated_at)),
        ("dragonTigerCount30d", lambda: fetch_dragon_tiger_count(stock, updated_at)),
        ("holderChangePct", lambda: fetch_holder_change(stock, updated_at)),
        ("upcomingLockupCount", lambda: fetch_lockup_count(stock, updated_at)),
    ]:
        try:
            value, q = getter()
            if isinstance(value, dict):
                fields.update(value)
                for key, item_value in value.items():
                    if item_value is not None:
                        fields["fieldSources"][key] = q
            else:
                fields[name] = value
                if value is not None:
                    fields["fieldSources"][name] = q
            source_items.append(q)
        except Exception as exc:
            source_items.append(quality("A Stock Data", "error", "signals", name, updated_at, error=str(exc)))

    non_empty = sum(
        fields.get(key) is not None
        for key in [
            "mainFundFlow5d",
            "mainFundFlow20d",
            "latestMainFundFlow",
            "marginBalance",
            "dragonTigerCount30d",
            "holderChangePct",
            "upcomingLockupCount",
        ]
    )
    statuses = [item["status"] for item in source_items]
    if non_empty:
        status = "real"
    elif "error" in statuses:
        status = "error"
    else:
        status = "missing"
    fields["quality"] = quality("A Stock Data", status, "signals", "Eastmoney multi-source signals", updated_at)
    return fields


def generate_signals_from_real_data(
    stock: dict[str, str],
    updated_at: str,
    quote: dict[str, Any],
    history: dict[str, Any],
    financial: dict[str, Any],
    research: dict[str, Any],
    announcements: dict[str, Any],
) -> dict[str, Any]:
    notes: list[str] = []
    field_sources: dict[str, Any] = {}

    pct_change = quote.get("pctChange")
    if isinstance(pct_change, (int, float)) and abs(pct_change) >= 5:
        notes.append(f"price move signal: {pct_change:.2f}%")
        field_sources["pctChangeSignal"] = quote.get("quality")

    points = history.get("points") or []
    if len(points) >= 20:
        latest_amount = points[-1].get("amount")
        previous_amounts = [point.get("amount") for point in points[-20:-1] if isinstance(point.get("amount"), (int, float))]
        if isinstance(latest_amount, (int, float)) and previous_amounts:
            avg_amount = sum(previous_amounts) / len(previous_amounts)
            if avg_amount > 0 and latest_amount / avg_amount >= 1.8:
                notes.append(f"amount expansion: {latest_amount / avg_amount:.1f}x")
                field_sources["amountExpansion"] = history.get("quality")

    revenue_growth = financial.get("revenueGrowth")
    profit_growth = financial.get("profitGrowth")
    if isinstance(revenue_growth, (int, float)) and revenue_growth >= 20:
        notes.append(f"revenue growth: {revenue_growth:.1f}%")
        field_sources["revenueGrowth"] = financial.get("quality")
    if isinstance(profit_growth, (int, float)) and profit_growth >= 20:
        notes.append(f"profit growth: {profit_growth:.1f}%")
        field_sources["profitGrowth"] = financial.get("quality")

    pe = quote.get("peTtm") if quote.get("peTtm") is not None else quote.get("pe")
    pb = quote.get("pb")
    if isinstance(pe, (int, float)) and pe > 80:
        notes.append(f"valuation risk: PE TTM {pe:.1f}x")
        field_sources["valuationRisk"] = quote.get("quality")
    elif isinstance(pe, (int, float)) and 0 < pe < 15 and isinstance(pb, (int, float)) and pb < 2:
        notes.append(f"valuation low: PE {pe:.1f}x / PB {pb:.1f}x")
        field_sources["valuationLow"] = quote.get("quality")

    reports = research.get("reports") or []
    if reports:
        latest_report = reports[0]
        title = latest_report.get("title")
        if title:
            notes.append(f"latest research: {title}")
            field_sources["research"] = research.get("quality")

    ann_list = announcements.get("announcements") or []
    latest_announcement = ann_list[0].get("title") if ann_list else None
    if latest_announcement:
        notes.append(f"announcement: {latest_announcement}")
        field_sources["announcement"] = announcements.get("quality")

    missing = []
    for label, item in {
        "quote": quote,
        "history": history,
        "financial": financial,
        "research": research,
        "announcement": announcements,
    }.items():
        if (item.get("quality") or {}).get("status") in {"missing", "error", "unsupported_market"}:
            missing.append(label)
    if missing:
        notes.append(f"missing data: {', '.join(missing)}")

    status = "real" if notes else "missing"
    return {
        "id": stock["id"],
        "mainFundFlow5d": None,
        "mainFundFlow20d": None,
        "latestMainFundFlow": None,
        "marginBalance": None,
        "dragonTigerCount30d": None,
        "holderChangePct": None,
        "upcomingLockupCount": None,
        "popularityRank": None,
        "hotReason": " | ".join(notes[:4]) if notes else None,
        "latestInteraction": latest_announcement,
        "fieldSources": field_sources,
        "quality": quality("A Stock Data", status, "signals", "Derived from quote/history/financial/research/announcements", updated_at),
    }


def fetch_tencent_quote(stock: dict[str, str], updated_at: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    url = f"https://qt.gtimg.cn/q={market_prefix(stock)}"
    text = http_get(url, encoding="gbk")
    payload = text.split("=", 1)[1].strip().strip('";')
    fields = payload.split("~")
    if len(fields) < 49:
        raise ValueError("Tencent quote payload is incomplete")

    latest_price = to_float(fields[3])
    pct_change = to_float(fields[32])
    amount_yi = to_float(fields[37], 10000)
    turnover = to_float(fields[38])
    pe_ttm = to_float(fields[39])
    market_cap_yi = to_float(fields[44])
    float_market_cap_yi = to_float(fields[45])
    pb = to_float(fields[46])
    limit_up = to_float(fields[47])
    limit_down = to_float(fields[48])
    total_shares_yi = market_cap_yi / latest_price if market_cap_yi and latest_price else None
    float_shares_yi = float_market_cap_yi / latest_price if float_market_cap_yi and latest_price else None
    q = quality("A Stock Data", "real", "quote", "Tencent qt.gtimg.cn", updated_at, url)

    profile = {
        "id": stock["id"],
        "name": fields[1] or stock["name"],
        "code": stock["code"],
        "market": stock["market"],
        "fullName": None,
        "industryName": None,
        "industryClassifications": [],
        "listDate": None,
        "totalShares": total_shares_yi,
        "floatShares": float_shares_yi,
        "companyProfile": None,
        "businessScope": None,
        "f10Summary": "Tencent quote fallback; company profile waits for F10 enrichment.",
        "revenueComposition": [],
        "mainProducts": [],
        "quality": q,
    }
    quote = {
        "id": stock["id"],
        "latestPrice": latest_price,
        "pctChange": pct_change,
        "amount": amount_yi,
        "marketCap": market_cap_yi,
        "floatMarketCap": float_market_cap_yi,
        "pe": pe_ttm,
        "peTtm": pe_ttm,
        "pb": pb,
        "ps": None,
        "dividendYield": None,
        "turnover": turnover,
        "limitUp": limit_up,
        "limitDown": limit_down,
        "updatedAt": updated_at,
        "quality": q,
    }
    signal = {
        "id": stock["id"],
        "mainFundFlow20d": None,
        "mainFundFlow5d": None,
        "latestMainFundFlow": None,
        "dragonTigerCount30d": None,
        "marginBalance": None,
        "holderChangePct": None,
        "upcomingLockupCount": None,
        "popularityRank": None,
        "hotReason": None,
        "latestInteraction": None,
        "fieldSources": {},
        "quality": quality("A Stock Data", "missing", "signals", "Eastmoney optional signals", updated_at),
    }
    return profile, quote, signal


def fetch_tencent_history(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    symbol = market_prefix(stock)
    url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},day,,,80,qfq"
    text = http_get(url)
    payload = json.loads(text)
    stock_data = payload.get("data", {}).get(symbol, {})
    rows = stock_data.get("qfqday") or stock_data.get("day") or []
    points = []
    for row in rows[-60:]:
        close = to_float(row[2])
        prev_close = points[-1]["close"] if points else None
        pct_change = ((close - prev_close) / prev_close * 100) if close and prev_close else None
        points.append(
            {
                "date": row[0],
                "open": to_float(row[1]),
                "close": close,
                "high": to_float(row[3]),
                "low": to_float(row[4]),
                "volume": to_float(row[5]),
                "amount": to_float(row[6]) if len(row) > 6 else None,
                "pctChange": pct_change,
            }
        )
    status = "real" if points else "missing"
    return {
        "id": stock["id"],
        "points": points,
        "quality": quality("A Stock Data", status, "kline", "Tencent fqkline", updated_at, url),
    }


def fetch_research(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    end = datetime.now(CN_TZ).date()
    begin = end - timedelta(days=365)
    params = {
        "pageSize": 5,
        "beginTime": begin.isoformat(),
        "endTime": end.isoformat(),
        "code": stock["code"],
        "qType": 0,
        "pageNo": 1,
        "sortType": 4,
        "sortRule": -1,
    }
    url = "https://reportapi.eastmoney.com/report/list?" + parse.urlencode(params)
    try:
        data = json.loads(em_get(url))
        rows = data.get("data") or []
        reports = [
            {
                "title": row.get("title"),
                "org": row.get("orgSName"),
                "analyst": row.get("researcher"),
                "date": (row.get("publishDate") or "")[:10] or None,
                "rating": row.get("emRatingName") or row.get("rating"),
                "epsForecast": row.get("predictThisYearEps"),
                "url": f"https://data.eastmoney.com/report/zw_stock.jshtml?encodeUrl={row.get('encodeUrl')}" if row.get("encodeUrl") else None,
            }
            for row in rows
            if row.get("title")
        ]
        status = "real" if reports else "missing"
        reason = None if reports else "当前数据源未获取到公开研报"
        return {
            "id": stock["id"],
            "reports": reports,
            "reason": reason,
            "quality": quality("A Stock Data", status, "research", "Eastmoney reportapi", updated_at, url, reason),
        }
    except Exception as exc:
        return {
            "id": stock["id"],
            "reports": [],
            "reason": str(exc),
            "quality": quality("A Stock Data", "error", "research", "Eastmoney reportapi", updated_at, url, str(exc)),
        }


def fetch_announcements(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    url = "https://www.cninfo.com.cn/new/hisAnnouncement/query"
    form = parse.urlencode(
        {
            "stock": "",
            "tabName": "fulltext",
            "pageSize": 5,
            "pageNum": 1,
            "column": "szse" if stock["exchange"] == "SZ" else "sse",
            "category": "",
            "plate": "",
            "seDate": "",
            "searchkey": stock["code"],
            "secid": "",
            "sortName": "",
            "sortType": "",
            "isHLtitle": "true",
        }
    ).encode("utf-8")
    req = request.Request(
        url,
        data=form,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.cninfo.com.cn/new/disclosure",
            "Origin": "https://www.cninfo.com.cn",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    )
    try:
        time.sleep(0.4 + random.random() * 0.2)
        with request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        rows = [row for row in (data.get("announcements") or []) if str(row.get("secCode") or "") == stock["code"]]
        announcements = []
        for row in rows:
            adjunct = row.get("adjunctUrl")
            announcements.append(
                {
                    "title": re.sub("<.*?>", "", row.get("announcementTitle") or ""),
                    "date": (row.get("announcementTime") and datetime.fromtimestamp(row["announcementTime"] / 1000, CN_TZ).date().isoformat()) or None,
                    "type": row.get("announcementTypeName"),
                    "url": f"http://static.cninfo.com.cn/{adjunct}" if adjunct else None,
                    "source": "CNInfo",
                }
            )
        status = "real" if announcements else "missing"
        reason = None if announcements else "当前公告数据源未返回结果"
        return {
            "id": stock["id"],
            "announcements": announcements,
            "reason": reason,
            "quality": quality("A Stock Data", status, "announcements", "CNInfo hisAnnouncement", updated_at, url, reason),
        }
    except Exception as exc:
        return {
            "id": stock["id"],
            "announcements": [],
            "reason": str(exc),
            "quality": quality("A Stock Data", "error", "announcements", "CNInfo hisAnnouncement", updated_at, url, str(exc)),
        }


def fetch_sector(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    url = (
        "https://push2.eastmoney.com/api/qt/slist/get?"
        + parse.urlencode(
            {
                "pn": 1,
                "pz": 20,
                "po": 1,
                "np": 1,
                "fltt": 2,
                "invt": 2,
                "fid": "f3",
                "fs": f"b:{market_code(stock)}",
                "fields": "f12,f14,f3,f100,f102",
            }
        )
    )
    try:
        data = json.loads(em_get(url))
        rows = data.get("data", {}).get("diff") or []
        concept = [
            {"name": row.get("f14"), "changePct": to_float(row.get("f3")), "code": row.get("f12"), "description": row.get("f100")}
            for row in rows
            if row.get("f14")
        ][:8]
        status = "real" if concept else "missing"
        return {"id": stock["id"], "industry": [], "concept": concept, "region": [], "quality": quality("A Stock Data", status, "sector", "Eastmoney block membership", updated_at, url)}
    except Exception as exc:
        return {"id": stock["id"], "industry": [], "concept": [], "region": [], "quality": quality("A Stock Data", "error", "sector", "Eastmoney block membership", updated_at, url, str(exc))}


def merge_sector_profile_fallback(sector: dict[str, Any], profile: dict[str, Any], updated_at: str) -> dict[str, Any]:
    industry_name = profile.get("industryName")
    if industry_name and not sector.get("industry"):
        sector["industry"] = [{"name": industry_name, "changePct": None, "code": None, "description": "Eastmoney HSF10 industry fallback"}]
    if sector.get("industry") or sector.get("concept") or sector.get("region"):
        if sector.get("quality", {}).get("status") in {"missing", "error"}:
            sector["quality"] = quality("A Stock Data", "real", "sector", "Eastmoney HSF10 industry fallback", updated_at)
    return sector


def write_json_preserve(filename: str, payload: dict[str, Any], errors: list[str]) -> None:
    REAL_DIR.mkdir(parents=True, exist_ok=True)
    path = REAL_DIR / filename
    has_items = isinstance(payload.get("items"), dict) and len(payload["items"]) > 0
    if not has_items and path.exists():
        errors.append(f"{filename}: new payload is empty; kept previous cache")
        return
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def count_items_by_market(universe: list[dict[str, Any]], predicate) -> dict[str, int]:
    counts: dict[str, int] = {"A股": 0, "港股": 0, "美股": 0, "未上市": 0}
    for item in universe:
        if predicate(item):
            market = item.get("market", "unknown")
            counts[market] = counts.get(market, 0) + 1
    return counts


def module_coverage(items: dict[str, Any], universe: list[dict[str, Any]], status_key: str = "quality") -> dict[str, Any]:
    supported_ids = [item["id"] for item in universe if item.get("shouldValidate") and item.get("dataStatus") == "supported"]
    unsupported_ids = [item["id"] for item in universe if item.get("dataStatus") != "supported"]
    real = 0
    missing: list[str] = []
    unsupported = 0
    for stock_id in supported_ids:
        status = ((items.get(stock_id) or {}).get(status_key) or {}).get("status")
        if status == "real":
            real += 1
        else:
            missing.append(stock_id)
    for stock_id in unsupported_ids:
        status = ((items.get(stock_id) or {}).get(status_key) or {}).get("status")
        if status == "unsupported_market":
            unsupported += 1
    total = len(supported_ids)
    return {
        "real": real,
        "total": total,
        "pct": round(real / total * 100, 1) if total else 0,
        "missing": missing,
        "unsupported": unsupported,
        "unsupportedTotal": len(unsupported_ids),
    }


def main() -> int:
    updated_at = now_iso()
    profiles: dict[str, Any] = {}
    quotes: dict[str, Any] = {}
    financials: dict[str, Any] = {}
    histories: dict[str, Any] = {}
    research: dict[str, Any] = {}
    announcements: dict[str, Any] = {}
    signals: dict[str, Any] = {}
    sectors: dict[str, Any] = {}
    errors: list[str] = []
    logs: list[dict[str, Any]] = []

    universe = load_stock_universe()

    for index, stock in enumerate(universe, start=1):
        print(f"[{index}/{len(universe)}] fetching {stock['id']} {stock['code']} {stock['exchange']}", flush=True)
        if not stock.get("shouldFetchQuote", False):
            status = stock.get("dataStatus", "unsupported_market")
            message = "A Stock Data MVP 暂不接入该市场"
            bundle = empty_bundle(stock["id"], stock["name"], stock["code"], stock["market"], updated_at, status, message)
            profiles[stock["id"]] = bundle["profile"]
            quotes[stock["id"]] = bundle["quote"]
            financials[stock["id"]] = bundle["financial"]
            histories[stock["id"]] = bundle["history"]
            research[stock["id"]] = bundle["research"]
            announcements[stock["id"]] = bundle["announcements"]
            signals[stock["id"]] = bundle["signals"]
            sectors[stock["id"]] = bundle["sector"]
            logs.append({"id": stock["id"], "status": "unsupported_market"})
            continue

        stock_log: dict[str, Any] = {"id": stock["id"], "code": stock["code"], "steps": []}
        try:
            profile, quote, signal = fetch_tencent_quote(stock, updated_at)
            stock_info = fetch_eastmoney_stock_info(stock, updated_at)
            f10 = fetch_eastmoney_f10(stock, updated_at)
            profile.update(
                {
                    "name": stock_info.get("name") or profile.get("name"),
                    "fullName": f10.get("fullName"),
                    "industryName": f10.get("industryName") or stock_info.get("industryName") or profile.get("industryName"),
                    "industryClassifications": f10.get("industryClassifications", []),
                    "listDate": stock_info.get("listDate") or profile.get("listDate"),
                    "totalShares": stock_info.get("totalShares") or profile.get("totalShares"),
                    "floatShares": stock_info.get("floatShares") or profile.get("floatShares"),
                    "companyProfile": f10.get("companyProfile"),
                    "businessScope": f10.get("businessScope"),
                    "f10Summary": f10.get("f10Summary") or profile.get("f10Summary"),
                    "revenueComposition": f10.get("revenueComposition", []),
                    "mainProducts": f10.get("mainProducts", []),
                }
            )
            profile["quality"] = f10.get("quality") if f10.get("quality", {}).get("status") == "real" else stock_info.get("quality", profile["quality"])
            profiles[stock["id"]] = profile
            quotes[stock["id"]] = quote
            stock_log["steps"].append({"quote": "real", "profile": profile["quality"]["status"]})
        except Exception as exc:
            msg = f"{stock['id']} quote: {exc}"
            errors.append(msg)
            bundle = empty_bundle(stock["id"], stock["name"], stock["code"], stock["market"], updated_at, "error", msg)
            profiles[stock["id"]] = bundle["profile"]
            quotes[stock["id"]] = bundle["quote"]
            signals[stock["id"]] = bundle["signals"]
            stock_log["steps"].append({"quote": "error", "message": str(exc)})

        try:
            histories[stock["id"]] = fetch_tencent_history(stock, updated_at)
            stock_log["steps"].append({"history": histories[stock["id"]]["quality"]["status"]})
        except Exception as exc:
            msg = f"{stock['id']} history: {exc}"
            errors.append(msg)
            histories[stock["id"]] = {"id": stock["id"], "points": [], "quality": quality("A Stock Data", "error", "kline", "Tencent fqkline", updated_at, error=msg)}
            stock_log["steps"].append({"history": "error", "message": str(exc)})

        financials[stock["id"]] = fetch_financial(stock, updated_at)
        research[stock["id"]] = fetch_research(stock, updated_at)
        announcements[stock["id"]] = fetch_announcements(stock, updated_at)
        signals[stock["id"]] = generate_signals_from_real_data(
            stock,
            updated_at,
            quotes.get(stock["id"], {}),
            histories.get(stock["id"], {}),
            financials.get(stock["id"], {}),
            research.get(stock["id"], {}),
            announcements.get(stock["id"], {}),
        )
        sectors[stock["id"]] = merge_sector_profile_fallback(fetch_sector(stock, updated_at), profiles[stock["id"]], updated_at)
        stock_log["steps"].extend(
            [
                {"financial": financials[stock["id"]]["quality"]["status"]},
                {"signals": signals[stock["id"]]["quality"]["status"]},
                {"research": research[stock["id"]]["quality"]["status"]},
                {"announcements": announcements[stock["id"]]["quality"]["status"]},
                {"sector": sectors[stock["id"]]["quality"]["status"]},
            ]
        )
        logs.append(stock_log)

    manifest = {
        "generatedAt": updated_at,
        "updatedAt": updated_at,
        "status": "mixed" if any(q["quality"]["status"] == "real" for q in quotes.values()) else "error",
        "sourceSummary": ["A Stock Data", "Tencent quote/kline", "Eastmoney serial fallback", "CNInfo metadata"],
        "universe": {
            "total": len(universe),
            "markets": count_items_by_market(universe, lambda item: True),
            "supported": count_items_by_market(universe, lambda item: item.get("dataStatus") == "supported"),
            "unsupported": count_items_by_market(universe, lambda item: item.get("dataStatus") != "supported"),
            "source": "src/data/real/stock-universe.generated.json",
        },
        "coverage": {
            "quotes": module_coverage(quotes, universe),
            "priceHistory": module_coverage(histories, universe),
            "financials": module_coverage(financials, universe),
            "profiles": module_coverage(profiles, universe),
            "research": module_coverage(research, universe),
            "announcements": module_coverage(announcements, universe),
            "signals": module_coverage(signals, universe),
            "sectorMembership": module_coverage(sectors, universe),
        },
        "errors": errors,
    }

    write_errors: list[str] = []
    write_json_preserve("stocks.generated.json", {"updatedAt": updated_at, "items": profiles}, write_errors)
    write_json_preserve("quotes.generated.json", {"updatedAt": updated_at, "items": quotes}, write_errors)
    write_json_preserve("priceHistory.generated.json", {"updatedAt": updated_at, "items": histories}, write_errors)
    write_json_preserve("financials.generated.json", {"updatedAt": updated_at, "items": financials}, write_errors)
    write_json_preserve("research.generated.json", {"updatedAt": updated_at, "items": research}, write_errors)
    write_json_preserve("announcements.generated.json", {"updatedAt": updated_at, "items": announcements}, write_errors)
    write_json_preserve("signals.generated.json", {"updatedAt": updated_at, "items": signals}, write_errors)
    write_json_preserve("sectorMembership.generated.json", {"updatedAt": updated_at, "items": sectors}, write_errors)
    manifest["errors"].extend(write_errors)
    (REAL_DIR / "data-manifest.generated.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"fetch-log-{datetime.now(CN_TZ).strftime('%Y%m%d-%H%M%S')}.json"
    log_path.write_text(json.dumps({"updatedAt": updated_at, "errors": errors, "logs": logs}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"A Stock Data fetch complete: quotes={len(quotes)}, histories={len(histories)}, errors={len(errors)}")
    print(f"log={log_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
