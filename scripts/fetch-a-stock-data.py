from __future__ import annotations

import json
import random
import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib import parse, request


ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"
LOG_DIR = ROOT / "data-cache" / "a-stock-data" / "raw"
CN_TZ = timezone(timedelta(hours=8))

UNIVERSE = [
    {"id": "sugon", "name": "中科曙光", "code": "603019", "exchange": "SH", "market": "A股"},
    {"id": "fii", "name": "工业富联", "code": "601138", "exchange": "SH", "market": "A股"},
    {"id": "lenovo", "name": "联想集团", "code": "0992", "exchange": "HK", "market": "港股"},
    {"id": "eoptolink", "name": "新易盛", "code": "300502", "exchange": "SZ", "market": "A股"},
    {"id": "innolight", "name": "中际旭创", "code": "300308", "exchange": "SZ", "market": "A股"},
    {"id": "wus", "name": "沪电股份", "code": "002463", "exchange": "SZ", "market": "A股"},
    {"id": "victor-tech", "name": "胜宏科技", "code": "300476", "exchange": "SZ", "market": "A股"},
    {"id": "shennan", "name": "深南电路", "code": "002916", "exchange": "SZ", "market": "A股"},
    {"id": "best", "name": "贝斯特", "code": "300580", "exchange": "SZ", "market": "A股"},
    {"id": "wuzhou", "name": "五洲新春", "code": "603667", "exchange": "SH", "market": "A股"},
    {"id": "leaderdrive", "name": "绿的谐波", "code": "688017", "exchange": "SH", "market": "A股"},
    {"id": "moons", "name": "鸣志电器", "code": "603728", "exchange": "SH", "market": "A股"},
    {"id": "topgroup", "name": "拓普集团", "code": "601689", "exchange": "SH", "market": "A股"},
    {"id": "wuxi", "name": "药明康德", "code": "603259", "exchange": "SH", "market": "A股"},
    {"id": "pharmaron", "name": "康龙化成", "code": "300759", "exchange": "SZ", "market": "A股"},
    {"id": "asymchem", "name": "凯莱英", "code": "002821", "exchange": "SZ", "market": "A股"},
    {"id": "nano", "name": "纳微科技", "code": "688690", "exchange": "SH", "market": "A股"},
    {"id": "hengrui", "name": "恒瑞医药", "code": "600276", "exchange": "SH", "market": "A股"},
    {"id": "beigene", "name": "百济神州", "code": "688235", "exchange": "SH", "market": "A股"},
    {"id": "cosco-energy", "name": "中远海能", "code": "600026", "exchange": "SH", "market": "A股"},
    {"id": "cm-energy", "name": "招商轮船", "code": "601872", "exchange": "SH", "market": "A股"},
    {"id": "cm-nanjing", "name": "招商南油", "code": "601975", "exchange": "SH", "market": "A股"},
]


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


def em_get(url: str) -> str:
    time.sleep(1.05 + random.random() * 0.35)
    return http_get(url)


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
            "industryName": None,
            "listDate": None,
            "totalShares": None,
            "floatShares": None,
            "companyProfile": None,
            "businessScope": None,
            "f10Summary": None,
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
        "signals": {"id": stock_id, "hotReason": None, "quality": q},
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
        "industryName": None,
        "listDate": None,
        "totalShares": total_shares_yi,
        "floatShares": float_shares_yi,
        "companyProfile": None,
        "businessScope": None,
        "f10Summary": "腾讯行情补齐价格、估值、市值与股本口径；公司介绍等待 F10 补位。",
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
        "latestMainFundFlow": None,
        "dragonTigerCount30d": None,
        "marginBalance": None,
        "holderChangePct": None,
        "upcomingLockupCount": None,
        "hotReason": None,
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
        return {"id": stock["id"], "reports": reports, "quality": quality("A Stock Data", status, "research", "Eastmoney reportapi", updated_at, url)}
    except Exception as exc:
        return {"id": stock["id"], "reports": [], "quality": quality("A Stock Data", "error", "research", "Eastmoney reportapi", updated_at, url, str(exc))}


def fetch_announcements(stock: dict[str, str], updated_at: str) -> dict[str, Any]:
    url = "http://www.cninfo.com.cn/new/hisAnnouncement/query"
    form = parse.urlencode(
        {
            "stock": f"{stock['code']},{stock['name']}",
            "tabName": "fulltext",
            "pageSize": 5,
            "pageNum": 1,
            "column": "szse" if stock["exchange"] == "SZ" else "sse",
            "category": "",
            "plate": "",
            "seDate": "",
            "searchkey": "",
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
            "Referer": "http://www.cninfo.com.cn/new/commonUrl/pageOfSearch",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
    )
    try:
        time.sleep(0.4 + random.random() * 0.2)
        with request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
        rows = data.get("announcements") or []
        announcements = []
        for row in rows:
            adjunct = row.get("adjunctUrl")
            announcements.append(
                {
                    "title": re.sub("<.*?>", "", row.get("announcementTitle") or ""),
                    "date": (row.get("announcementTime") and datetime.fromtimestamp(row["announcementTime"] / 1000, CN_TZ).date().isoformat()) or None,
                    "type": row.get("announcementTypeName"),
                    "url": f"http://static.cninfo.com.cn/{adjunct}" if adjunct else None,
                    "source": "巨潮资讯",
                }
            )
        status = "real" if announcements else "missing"
        return {"id": stock["id"], "announcements": announcements, "quality": quality("A Stock Data", status, "announcement", "CNInfo hisAnnouncement", updated_at, url)}
    except Exception as exc:
        return {"id": stock["id"], "announcements": [], "quality": quality("A Stock Data", "error", "announcement", "CNInfo hisAnnouncement", updated_at, url, str(exc))}


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


def write_json_preserve(filename: str, payload: dict[str, Any], errors: list[str]) -> None:
    REAL_DIR.mkdir(parents=True, exist_ok=True)
    path = REAL_DIR / filename
    has_items = isinstance(payload.get("items"), dict) and len(payload["items"]) > 0
    if not has_items and path.exists():
        errors.append(f"{filename}: 新数据为空，保留旧缓存")
        return
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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

    for stock in UNIVERSE:
        if stock["market"] != "A股":
            bundle = empty_bundle(stock["id"], stock["name"], stock["code"], stock["market"], updated_at, "unsupported_market", "A Stock Data MVP 暂不接入港股/美股")
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
            profiles[stock["id"]] = profile
            quotes[stock["id"]] = quote
            signals[stock["id"]] = signal
            stock_log["steps"].append({"quote": "real"})
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

        financials[stock["id"]] = missing_financial(stock["id"], updated_at)
        research[stock["id"]] = fetch_research(stock, updated_at)
        announcements[stock["id"]] = fetch_announcements(stock, updated_at)
        sectors[stock["id"]] = fetch_sector(stock, updated_at)
        stock_log["steps"].extend(
            [
                {"financial": financials[stock["id"]]["quality"]["status"]},
                {"research": research[stock["id"]]["quality"]["status"]},
                {"announcements": announcements[stock["id"]]["quality"]["status"]},
                {"sector": sectors[stock["id"]]["quality"]["status"]},
            ]
        )
        logs.append(stock_log)

    manifest = {
        "updatedAt": updated_at,
        "status": "mixed" if any(q["quality"]["status"] == "real" for q in quotes.values()) else "error",
        "sourceSummary": ["A Stock Data", "Tencent quote/kline", "Eastmoney serial fallback", "CNInfo metadata"],
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
