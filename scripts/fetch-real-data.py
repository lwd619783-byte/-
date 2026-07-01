from __future__ import annotations

import json
import math
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"

STOCKS = [
    {"id": "sugon", "name": "中科曙光", "code": "603019", "market": "A股", "exchange": "SH"},
    {"id": "fii", "name": "工业富联", "code": "601138", "market": "A股", "exchange": "SH"},
    {"id": "lenovo", "name": "联想集团", "code": "0992", "market": "港股", "yf": "0992.HK"},
    {"id": "eoptolink", "name": "新易盛", "code": "300502", "market": "A股", "exchange": "SZ"},
    {"id": "innolight", "name": "中际旭创", "code": "300308", "market": "A股", "exchange": "SZ"},
    {"id": "wus", "name": "沪电股份", "code": "002463", "market": "A股", "exchange": "SZ"},
    {"id": "victor-tech", "name": "胜宏科技", "code": "300476", "market": "A股", "exchange": "SZ"},
    {"id": "best", "name": "贝斯特", "code": "300580", "market": "A股", "exchange": "SZ"},
    {"id": "wuzhou", "name": "五洲新春", "code": "603667", "market": "A股", "exchange": "SH"},
    {"id": "leaderdrive", "name": "绿的谐波", "code": "688017", "market": "A股", "exchange": "SH"},
    {"id": "moons", "name": "鸣志电器", "code": "603728", "market": "A股", "exchange": "SH"},
    {"id": "topgroup", "name": "拓普集团", "code": "601689", "market": "A股", "exchange": "SH"},
    {"id": "wuxi", "name": "药明康德", "code": "603259", "market": "A股", "exchange": "SH"},
    {"id": "pharmaron", "name": "康龙化成", "code": "300759", "market": "A股", "exchange": "SZ"},
    {"id": "asymchem", "name": "凯莱英", "code": "002821", "market": "A股", "exchange": "SZ"},
    {"id": "nano", "name": "纳微科技", "code": "688690", "market": "A股", "exchange": "SH"},
    {"id": "hengrui", "name": "恒瑞医药", "code": "600276", "market": "A股", "exchange": "SH"},
    {"id": "beigene", "name": "百济神州", "code": "6160", "market": "港股", "yf": "6160.HK"},
    {"id": "cosco-energy", "name": "中远海能", "code": "600026", "market": "A股", "exchange": "SH"},
    {"id": "cm-energy", "name": "招商轮船", "code": "601872", "market": "A股", "exchange": "SH"},
    {"id": "cm-nanjing", "name": "招商南油", "code": "601975", "market": "A股", "exchange": "SH"},
]


def now_iso() -> str:
    return datetime.now(timezone(timedelta(hours=8))).replace(microsecond=0).isoformat()


def quality(source: str, status: str, updated_at: str | None = None, error: str | None = None) -> dict[str, Any]:
    item: dict[str, Any] = {"source": source, "status": status}
    if updated_at:
        item["updatedAt"] = updated_at
    if error:
        item["errorMessage"] = error[:300]
    return item


def safe_float(value: Any) -> float | None:
    if value in (None, "", "-", "--", "None", "nan"):
        return None
    try:
        val = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(val) or math.isinf(val):
        return None
    return val


def read_previous(filename: str) -> dict[str, Any]:
    path = REAL_DIR / filename
    if not path.exists():
        return {"items": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"items": {}}


def write_json_preserve(filename: str, payload: dict[str, Any]) -> None:
    path = REAL_DIR / filename
    previous = read_previous(filename)
    if not payload.get("items") and previous.get("items"):
        stale = previous
        for item in stale.get("items", {}).values():
            if isinstance(item, dict):
                q = item.get("quality")
                if isinstance(q, dict) and q.get("status") == "real":
                    q["status"] = "stale"
                    q["errorMessage"] = "本次刷新失败，保留上一次成功缓存"
        payload = stale
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def provider_prefix(code: str) -> str:
    if code.startswith(("6", "9")):
        return "sh"
    if code.startswith("8"):
        return "bj"
    return "sz"


def tencent_quotes(stocks: list[dict[str, str]], updated_at: str) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    a_stocks = [item for item in stocks if item["market"] == "A股"]
    prefixed = [f"{provider_prefix(item['code'])}{item['code']}" for item in a_stocks]
    if not prefixed:
        return {}, errors
    try:
        req = urllib.request.Request("https://qt.gtimg.cn/q=" + ",".join(prefixed), headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=15).read().decode("gbk", errors="ignore")
    except Exception as exc:  # noqa: BLE001
        return {}, [f"Tencent quote fallback failed: {exc}"]

    by_code = {item["code"]: item for item in a_stocks}
    rows: dict[str, Any] = {}
    for line in data.strip().split(";"):
        if not line.strip() or '"' not in line:
            continue
        key = line.split("=")[0].split("_")[-1]
        code = key[2:]
        stock = by_code.get(code)
        vals = line.split('"')[1].split("~")
        if not stock or len(vals) < 53:
            continue
        rows[stock["id"]] = {
            "id": stock["id"],
            "latestPrice": safe_float(vals[3]),
            "pctChange": safe_float(vals[32]),
            "amount": safe_float(vals[37]),
            "marketCap": safe_float(vals[44]),
            "floatMarketCap": safe_float(vals[45]),
            "pe": safe_float(vals[39]),
            "pb": safe_float(vals[46]),
            "ps": None,
            "dividendYield": None,
            "updatedAt": updated_at,
            "quality": quality("Tencent Finance fallback", "real", updated_at),
        }
    return rows, errors


def akshare_quotes(stocks: list[dict[str, str]], updated_at: str) -> tuple[dict[str, Any], list[str]]:
    try:
        import akshare as ak

        df = ak.stock_zh_a_spot_em()
    except Exception as exc:  # noqa: BLE001
        return {}, [f"AKShare spot failed: {exc}"]

    rows: dict[str, Any] = {}
    errors: list[str] = []
    for stock in stocks:
        if stock["market"] != "A股":
            continue
        try:
            row = df[df["代码"].astype(str) == stock["code"]].iloc[0]
            rows[stock["id"]] = {
                "id": stock["id"],
                "latestPrice": safe_float(row.get("最新价")),
                "pctChange": safe_float(row.get("涨跌幅")),
                "amount": safe_float(row.get("成交额")),
                "marketCap": yuan_to_yi(row.get("总市值")),
                "floatMarketCap": yuan_to_yi(row.get("流通市值")),
                "pe": safe_float(row.get("市盈率-动态")),
                "pb": safe_float(row.get("市净率")),
                "ps": None,
                "dividendYield": None,
                "updatedAt": updated_at,
                "quality": quality("AKShare stock_zh_a_spot_em", "real", updated_at),
            }
        except Exception as exc:  # noqa: BLE001
            errors.append(f"AKShare quote missing {stock['id']}: {exc}")
    return rows, errors


def yuan_to_yi(value: Any) -> float | None:
    val = safe_float(value)
    if val is None:
        return None
    return val / 100000000 if abs(val) > 1000000 else val


def build_profiles(stocks: list[dict[str, str]], updated_at: str) -> dict[str, Any]:
    rows = {}
    for stock in stocks:
        code = f"{stock['code']}.{stock.get('exchange', 'HK')}" if stock["market"] == "A股" else stock["yf"]
        rows[stock["id"]] = {
            "id": stock["id"],
            "name": stock["name"],
            "code": code,
            "market": stock["market"],
            "industryName": None,
            "listDate": None,
            "quality": quality("symbolMap/manual profile", "real", updated_at),
        }
    return rows


def fetch_a_history(stock: dict[str, str], updated_at: str) -> tuple[dict[str, Any] | None, list[str]]:
    errors: list[str] = []
    end = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=140)).strftime("%Y%m%d")
    try:
        import akshare as ak

        df = ak.stock_zh_a_hist(symbol=stock["code"], period="daily", start_date=start, end_date=end, adjust="")
        points = []
        for _, row in df.tail(60).iterrows():
            points.append(
                {
                    "date": str(row.get("日期"))[:10],
                    "close": safe_float(row.get("收盘")),
                    "amount": safe_float(row.get("成交额")),
                    "pctChange": safe_float(row.get("涨跌幅")),
                }
            )
        if points:
            return {"id": stock["id"], "points": points, "quality": quality("AKShare stock_zh_a_hist", "real", updated_at)}, errors
    except Exception as exc:  # noqa: BLE001
        errors.append(f"AKShare history failed {stock['id']}: {exc}")

    try:
        import baostock as bs

        bs.login()
        bs_code = f"{stock['exchange'].lower()}.{stock['code']}"
        rs = bs.query_history_k_data_plus(
            bs_code,
            "date,close,amount,pctChg",
            start_date=(datetime.now() - timedelta(days=140)).strftime("%Y-%m-%d"),
            end_date=datetime.now().strftime("%Y-%m-%d"),
            frequency="d",
            adjustflag="3",
        )
        points = []
        while rs.error_code == "0" and rs.next():
            row = rs.get_row_data()
            points.append({"date": row[0], "close": safe_float(row[1]), "amount": safe_float(row[2]), "pctChange": safe_float(row[3])})
        bs.logout()
        if points:
            return {"id": stock["id"], "points": points[-60:], "quality": quality("BaoStock query_history_k_data_plus", "real", updated_at)}, errors
    except Exception as exc:  # noqa: BLE001
        errors.append(f"BaoStock history failed {stock['id']}: {exc}")

    return None, errors


def fetch_hk_data(stock: dict[str, str], updated_at: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str]]:
    try:
        import yfinance as yf
    except Exception as exc:  # noqa: BLE001
        err = f"yfinance unavailable for {stock['id']}: {exc}"
        return missing_quote(stock, "yfinance", updated_at, err), missing_history(stock, "yfinance", updated_at, err), [err]

    errors: list[str] = []
    try:
        ticker = yf.Ticker(stock["yf"])
        hist = ticker.history(period="3mo")
        info = getattr(ticker, "fast_info", {}) or {}
        quote = {
            "id": stock["id"],
            "latestPrice": safe_float(info.get("last_price")) if hasattr(info, "get") else None,
            "pctChange": None,
            "amount": None,
            "marketCap": market_cap_to_yi(info.get("market_cap")) if hasattr(info, "get") else None,
            "floatMarketCap": None,
            "pe": None,
            "pb": None,
            "ps": None,
            "dividendYield": None,
            "updatedAt": updated_at,
            "quality": quality("yfinance", "real", updated_at),
        }
        points = [
            {
                "date": str(idx.date()),
                "close": safe_float(row.get("Close")),
                "amount": safe_float(row.get("Volume")),
                "pctChange": None,
            }
            for idx, row in hist.tail(60).iterrows()
        ]
        return quote, {"id": stock["id"], "points": points, "quality": quality("yfinance", "real", updated_at)}, errors
    except Exception as exc:  # noqa: BLE001
        err = f"yfinance fetch failed {stock['id']}: {exc}"
        return missing_quote(stock, "yfinance", updated_at, err), missing_history(stock, "yfinance", updated_at, err), [err]


def market_cap_to_yi(value: Any) -> float | None:
    val = safe_float(value)
    return None if val is None else val / 100000000


def missing_quote(stock: dict[str, str], source: str, updated_at: str, error: str) -> dict[str, Any]:
    return {
        "id": stock["id"],
        "latestPrice": None,
        "pctChange": None,
        "amount": None,
        "marketCap": None,
        "floatMarketCap": None,
        "pe": None,
        "pb": None,
        "ps": None,
        "dividendYield": None,
        "updatedAt": updated_at,
        "quality": quality(source, "missing", updated_at, error),
    }


def missing_history(stock: dict[str, str], source: str, updated_at: str, error: str) -> dict[str, Any]:
    return {"id": stock["id"], "points": [], "quality": quality(source, "missing", updated_at, error)}


def fetch_financial(stock: dict[str, str], updated_at: str) -> tuple[dict[str, Any], list[str]]:
    if stock["market"] != "A股":
        err = "港股财务第一阶段暂不接入"
        return missing_financial(stock, "yfinance", updated_at, err), [f"{stock['id']}: {err}"]
    try:
        import akshare as ak

        df = ak.stock_financial_analysis_indicator(symbol=stock["code"], start_year=str(datetime.now().year - 2))
        row = df.iloc[-1] if len(df) else {}
        return {
            "id": stock["id"],
            "reportDate": str(row.get("日期", ""))[:10] or None,
            "revenue": None,
            "revenueGrowth": safe_float(row.get("主营业务收入增长率(%)")),
            "netProfit": None,
            "profitGrowth": safe_float(row.get("净利润增长率(%)")),
            "grossMargin": safe_float(row.get("销售毛利率(%)")),
            "netMargin": safe_float(row.get("销售净利率(%)")),
            "roe": safe_float(row.get("净资产收益率(%)")),
            "debtRatio": safe_float(row.get("资产负债率(%)")),
            "operatingCashFlow": None,
            "updatedAt": updated_at,
            "quality": quality("AKShare stock_financial_analysis_indicator", "real", updated_at),
        }, []
    except Exception as exc:  # noqa: BLE001
        return missing_financial(stock, "AKShare stock_financial_analysis_indicator", updated_at, str(exc)), [
            f"AKShare financial failed {stock['id']}: {exc}"
        ]


def missing_financial(stock: dict[str, str], source: str, updated_at: str, error: str) -> dict[str, Any]:
    return {
        "id": stock["id"],
        "reportDate": None,
        "revenue": None,
        "revenueGrowth": None,
        "netProfit": None,
        "profitGrowth": None,
        "grossMargin": None,
        "netMargin": None,
        "roe": None,
        "debtRatio": None,
        "operatingCashFlow": None,
        "updatedAt": updated_at,
        "quality": quality(source, "missing", updated_at, error),
    }


def main() -> int:
    REAL_DIR.mkdir(parents=True, exist_ok=True)
    updated_at = now_iso()
    errors: list[str] = []
    profiles = build_profiles(STOCKS, updated_at)

    quotes, quote_errors = akshare_quotes(STOCKS, updated_at)
    errors.extend(quote_errors)
    if len(quotes) < 5:
        fallback_quotes, fallback_errors = tencent_quotes(STOCKS, updated_at)
        errors.extend(fallback_errors)
        quotes.update({key: value for key, value in fallback_quotes.items() if key not in quotes or quotes[key]["quality"]["status"] != "real"})

    price_history: dict[str, Any] = {}
    financials: dict[str, Any] = {}
    for stock in STOCKS:
        if stock["market"] == "A股":
            history, history_errors = fetch_a_history(stock, updated_at)
            errors.extend(history_errors)
            price_history[stock["id"]] = history or missing_history(stock, "AKShare/BaoStock", updated_at, "历史行情未获取")
            fin, fin_errors = fetch_financial(stock, updated_at)
            errors.extend(fin_errors)
            financials[stock["id"]] = fin
        else:
            quote, history, hk_errors = fetch_hk_data(stock, updated_at)
            errors.extend(hk_errors)
            if quote:
                quotes[stock["id"]] = quote
            if history:
                price_history[stock["id"]] = history
            financials[stock["id"]] = missing_financial(stock, "yfinance", updated_at, "港股财务第一阶段暂缺")
        time.sleep(0.25)

    for stock in STOCKS:
        quotes.setdefault(stock["id"], missing_quote(stock, "AKShare/yfinance", updated_at, "行情未获取"))

    write_json_preserve("stocks.generated.json", {"items": profiles})
    write_json_preserve("quotes.generated.json", {"items": quotes})
    write_json_preserve("financials.generated.json", {"items": financials})
    write_json_preserve("priceHistory.generated.json", {"items": price_history})

    real_quotes = sum(1 for item in quotes.values() if item.get("quality", {}).get("status") == "real")
    real_history = sum(1 for item in price_history.values() if item.get("points"))
    manifest = {
        "updatedAt": updated_at,
        "status": "mixed" if errors else "real",
        "sourceSummary": sorted(
            set(
                item.get("quality", {}).get("source", "")
                for group in (quotes, financials, price_history)
                for item in group.values()
                if item.get("quality", {}).get("source")
            )
        ),
        "errors": errors[:80],
        "stats": {"realQuotes": real_quotes, "realHistory": real_history, "stocks": len(STOCKS)},
    }
    (REAL_DIR / "data-manifest.generated.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest["stats"], ensure_ascii=False))
    if real_quotes < 5 or real_history < 5:
        print("warning: fewer than 5 real quote/history records were fetched; see generated manifest errors", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
