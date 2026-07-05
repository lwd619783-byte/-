from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"
STOCK_UNIVERSE_PATH = REAL_DIR / "stock-universe.generated.json"
CN_TZ = timezone(timedelta(hours=8))


def now_iso() -> str:
    return datetime.now(CN_TZ).replace(microsecond=0).isoformat()


def load_json(filename: str, default: dict[str, Any] | None = None) -> dict[str, Any]:
    path = REAL_DIR / filename
    if not path.exists():
        return default or {"updatedAt": None, "items": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(filename: str, payload: dict[str, Any]) -> None:
    REAL_DIR.mkdir(parents=True, exist_ok=True)
    (REAL_DIR / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def quality(status: str, layer: str, endpoint: str, updated_at: str, error: str | None = None) -> dict[str, Any]:
    item = {
        "source": "yfinance",
        "sourceLayer": layer,
        "sourceEndpoint": endpoint,
        "updatedAt": updated_at,
        "status": status,
    }
    if error:
        item["errorMessage"] = error
    return item


def not_implemented_quality(layer: str, updated_at: str) -> dict[str, Any]:
    return quality("not_implemented", layer, "HK provider MVP", updated_at, "港股该模块暂未接入")


def to_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        if value != value:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def round_or_none(value: Any, digits: int = 4) -> float | None:
    number = to_number(value)
    return round(number, digits) if number is not None else None


def hk_items(universe: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        item
        for item in universe
        if item.get("exchange") == "HK" and item.get("dataProvider") == "yfinance" and item.get("shouldFetchQuote")
    ]


def empty_quote(stock: dict[str, Any], updated_at: str, status: str, reason: str) -> dict[str, Any]:
    return {
        "id": stock["id"],
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
        "currency": "HKD",
        "quality": quality(status, "quote", "yfinance Ticker", updated_at, reason),
    }


def empty_history(stock: dict[str, Any], updated_at: str, status: str, reason: str) -> dict[str, Any]:
    return {
        "id": stock["id"],
        "points": [],
        "source": "yfinance",
        "updatedAt": updated_at,
        "quality": quality(status, "priceHistory", "yfinance history", updated_at, reason),
    }


def profile_for(stock: dict[str, Any], updated_at: str, status: str = "real", reason: str | None = None) -> dict[str, Any]:
    return {
        "id": stock["id"],
        "name": stock.get("name"),
        "code": stock.get("code"),
        "market": stock.get("market"),
        "fullName": stock.get("name"),
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
        "quality": quality(status, "profile", "stock-universe + yfinance", updated_at, reason),
    }


def financial_placeholder(stock_id: str, updated_at: str) -> dict[str, Any]:
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
        "quality": not_implemented_quality("financials", updated_at),
    }


def not_implemented_series(stock_id: str, key: str, layer: str, updated_at: str) -> dict[str, Any]:
    return {"id": stock_id, key: [], "quality": not_implemented_quality(layer, updated_at)}


def signal_placeholder(stock_id: str, updated_at: str) -> dict[str, Any]:
    return {
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
        "quality": not_implemented_quality("signals", updated_at),
    }


def sector_placeholder(stock_id: str, updated_at: str) -> dict[str, Any]:
    return {
        "id": stock_id,
        "industry": [],
        "concept": [],
        "region": [],
        "quality": not_implemented_quality("sectorMembership", updated_at),
    }


def fetch_one(stock: dict[str, Any], updated_at: str) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], list[str]]:
    import yfinance as yf

    ticker_symbol = stock.get("providerSymbol") or stock.get("standardSymbol")
    ticker = yf.Ticker(ticker_symbol)
    errors: list[str] = []

    try:
        fast_info = ticker.fast_info
        info = {}
        try:
            info = ticker.info or {}
        except Exception as exc:
            errors.append(f"{stock['id']} info partial: {exc}")

        latest_price = round_or_none(getattr(fast_info, "last_price", None) or info.get("currentPrice"))
        previous_close = round_or_none(getattr(fast_info, "previous_close", None) or info.get("previousClose"))
        market_cap_raw = to_number(getattr(fast_info, "market_cap", None) or info.get("marketCap"))
        change = round_or_none(latest_price - previous_close, 4) if latest_price is not None and previous_close else None
        pct_change = round_or_none(change / previous_close * 100, 4) if change is not None and previous_close else None
        status = "real" if latest_price is not None and pct_change is not None else ("partial" if latest_price is not None else "missing")
        reason = None if status == "real" else "yfinance 未返回完整最新价或涨跌幅"
        quote = {
            "id": stock["id"],
            "latestPrice": latest_price,
            "pctChange": pct_change,
            "change": change,
            "amount": None,
            "marketCap": round_or_none(market_cap_raw / 100_000_000, 4) if market_cap_raw is not None else None,
            "floatMarketCap": None,
            "pe": round_or_none(info.get("trailingPE")),
            "peTtm": round_or_none(info.get("trailingPE")),
            "pb": round_or_none(info.get("priceToBook")),
            "ps": round_or_none(info.get("priceToSalesTrailing12Months")),
            "dividendYield": round_or_none(to_number(info.get("dividendYield")) * 100) if info.get("dividendYield") is not None else None,
            "turnover": None,
            "volume": round_or_none(getattr(fast_info, "last_volume", None) or info.get("volume"), 0),
            "limitUp": None,
            "limitDown": None,
            "updatedAt": updated_at,
            "currency": "HKD",
            "quality": quality(status, "quote", "yfinance Ticker", updated_at, reason),
        }
    except Exception as exc:
        errors.append(f"{stock['id']} quote: {exc}")
        quote = empty_quote(stock, updated_at, "error", str(exc))

    try:
        frame = ticker.history(period="4mo", interval="1d", auto_adjust=False)
        points: list[dict[str, Any]] = []
        if frame is not None and not frame.empty:
            frame = frame.tail(60)
            previous_close: float | None = None
            for index, row in frame.iterrows():
                close = round_or_none(row.get("Close"))
                pct = round_or_none((close - previous_close) / previous_close * 100, 4) if close is not None and previous_close else None
                points.append(
                    {
                        "date": index.date().isoformat(),
                        "open": round_or_none(row.get("Open")),
                        "high": round_or_none(row.get("High")),
                        "low": round_or_none(row.get("Low")),
                        "close": close,
                        "volume": round_or_none(row.get("Volume"), 0),
                        "amount": None,
                        "turnover": None,
                        "pctChange": pct,
                    }
                )
                if close is not None:
                    previous_close = close
        history_status = "real" if len(points) >= 30 else ("partial" if points else "missing")
        reason = None if history_status == "real" else "yfinance K 线不足 30 条"
        history = {
            "id": stock["id"],
            "points": points,
            "source": "yfinance",
            "updatedAt": updated_at,
            "quality": quality(history_status, "priceHistory", "yfinance history(period=4mo, interval=1d)", updated_at, reason),
        }
    except Exception as exc:
        errors.append(f"{stock['id']} history: {exc}")
        history = empty_history(stock, updated_at, "error", str(exc))

    profile_status = "real" if quote["quality"]["status"] in {"real", "partial"} or history["quality"]["status"] in {"real", "partial"} else "missing"
    profile = profile_for(stock, updated_at, profile_status, None if profile_status == "real" else "港股行情未成功返回")
    return profile, quote, history, errors


def coverage_for(items: dict[str, Any], stock_ids: list[str], min_points: int | None = None) -> dict[str, Any]:
    usable = 0
    missing: list[str] = []
    partial: list[str] = []
    for stock_id in stock_ids:
        item = items.get(stock_id) or {}
        status = ((item.get("quality") or {}).get("status")) or "missing"
        if min_points is not None and status in {"real", "partial"}:
            status = "real" if len(item.get("points") or []) >= min_points else "partial"
        if status in {"real", "partial"}:
            usable += 1
            if status == "partial":
                partial.append(stock_id)
        else:
            missing.append(stock_id)
    total = len(stock_ids)
    return {
        "real": usable,
        "total": total,
        "pct": round(usable / total * 100, 1) if total else 0,
        "missing": missing,
        "partial": partial,
        "unsupported": 0,
        "unsupportedTotal": 0,
    }


def not_implemented_coverage(stock_ids: list[str]) -> dict[str, Any]:
    return {
        "real": 0,
        "total": len(stock_ids),
        "pct": 0,
        "missing": stock_ids,
        "partial": [],
        "unsupported": 0,
        "unsupportedTotal": 0,
        "status": "not_implemented",
    }


def main() -> int:
    updated_at = now_iso()
    universe_payload = load_json("stock-universe.generated.json")
    universe = universe_payload.get("items", [])
    hk_stocks = hk_items(universe)
    errors: list[str] = []

    datasets = {
        "stocks.generated.json": load_json("stocks.generated.json"),
        "quotes.generated.json": load_json("quotes.generated.json"),
        "priceHistory.generated.json": load_json("priceHistory.generated.json"),
        "financials.generated.json": load_json("financials.generated.json"),
        "research.generated.json": load_json("research.generated.json"),
        "announcements.generated.json": load_json("announcements.generated.json"),
        "signals.generated.json": load_json("signals.generated.json"),
        "sectorMembership.generated.json": load_json("sectorMembership.generated.json"),
    }

    for payload in datasets.values():
        payload.setdefault("items", {})
        payload["updatedAt"] = updated_at

    try:
        import yfinance  # noqa: F401
    except Exception as exc:
        errors.append(f"yfinance unavailable: {exc}")
        for stock in hk_stocks:
            datasets["stocks.generated.json"]["items"][stock["id"]] = profile_for(stock, updated_at, "missing", "yfinance 未安装或不可用")
            datasets["quotes.generated.json"]["items"][stock["id"]] = empty_quote(stock, updated_at, "error", "yfinance 未安装或不可用")
            datasets["priceHistory.generated.json"]["items"][stock["id"]] = empty_history(stock, updated_at, "error", "yfinance 未安装或不可用")
    else:
        for index, stock in enumerate(hk_stocks, start=1):
            print(f"[HK {index}/{len(hk_stocks)}] fetching {stock['id']} {stock['providerSymbol']}", flush=True)
            profile, quote, history, stock_errors = fetch_one(stock, updated_at)
            errors.extend(stock_errors)
            datasets["stocks.generated.json"]["items"][stock["id"]] = profile
            datasets["quotes.generated.json"]["items"][stock["id"]] = quote
            datasets["priceHistory.generated.json"]["items"][stock["id"]] = history

    for stock in hk_stocks:
        stock_id = stock["id"]
        datasets["financials.generated.json"]["items"][stock_id] = financial_placeholder(stock_id, updated_at)
        datasets["research.generated.json"]["items"][stock_id] = not_implemented_series(stock_id, "reports", "research", updated_at)
        datasets["announcements.generated.json"]["items"][stock_id] = not_implemented_series(stock_id, "announcements", "announcements", updated_at)
        datasets["signals.generated.json"]["items"][stock_id] = signal_placeholder(stock_id, updated_at)
        datasets["sectorMembership.generated.json"]["items"][stock_id] = sector_placeholder(stock_id, updated_at)

    for filename, payload in datasets.items():
        write_json(filename, payload)

    manifest = load_json("data-manifest.generated.json", {"sourceSummary": [], "coverage": {}, "errors": []})
    manifest["generatedAt"] = updated_at
    manifest["updatedAt"] = updated_at
    manifest["status"] = "mixed"
    source_summary = list(dict.fromkeys([*(manifest.get("sourceSummary") or []), "yfinance HK quote/history"]))
    manifest["sourceSummary"] = source_summary
    manifest["universe"] = {
        "total": universe_payload.get("total", len(universe)),
        "markets": universe_payload.get("markets", {}),
        "supported": universe_payload.get("supported", {}),
        "unsupported": universe_payload.get("unsupported", {}),
        "privateCompanies": (universe_payload.get("privateCompanies") or {}).get("total"),
        "source": "src/data/real/stock-universe.generated.json",
    }
    manifest.setdefault("coverage", {})
    hk_ids = [stock["id"] for stock in hk_stocks]
    manifest["coverage"]["hkQuotes"] = coverage_for(datasets["quotes.generated.json"]["items"], hk_ids)
    manifest["coverage"]["hkPriceHistory"] = coverage_for(datasets["priceHistory.generated.json"]["items"], hk_ids, min_points=30)
    manifest["coverage"]["hkFinancials"] = not_implemented_coverage(hk_ids)
    manifest["coverage"]["hkResearch"] = not_implemented_coverage(hk_ids)
    manifest["coverage"]["hkAnnouncements"] = not_implemented_coverage(hk_ids)
    manifest["errors"] = [*(manifest.get("errors") or []), *errors]
    write_json("data-manifest.generated.json", manifest)

    quote_cov = manifest["coverage"]["hkQuotes"]
    hist_cov = manifest["coverage"]["hkPriceHistory"]
    print(f"HK fetch complete: quotes={quote_cov['real']}/{quote_cov['total']} histories={hist_cov['real']}/{hist_cov['total']} errors={len(errors)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
