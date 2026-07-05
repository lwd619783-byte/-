from __future__ import annotations

import json
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"
DOCS_DIR = ROOT / "docs"
REPORT_PATH = DOCS_DIR / "a-stock-data-validation-report.md"
STOCK_UNIVERSE_PATH = REAL_DIR / "stock-universe.generated.json"

MARKETS = ["A股", "港股", "美股", "未上市"]
CORE_FINANCIAL_FIELDS = ["revenue", "netProfit", "roe"]
SIGNAL_FIELDS = [
    "mainFundFlow5d",
    "mainFundFlow20d",
    "latestMainFundFlow",
    "marginBalance",
    "dragonTigerCount30d",
    "holderChangePct",
    "upcomingLockupCount",
    "popularityRank",
    "hotReason",
    "latestInteraction",
]
MODULE_ALIASES = {
    "quote": "quotes",
    "history": "priceHistory",
    "financial": "financials",
    "profile": "profiles",
    "announcement": "announcements",
    "sector": "sectorMembership",
    "kline": "priceHistory",
    "f10": "profiles",
}
MISSING_REASONS = {
    "quotes": "行情接口未返回有效最新价",
    "priceHistory": "K 线数据不足或接口未返回",
    "financials": "核心财务字段不足",
    "profiles": "F10 / 公司资料缺失",
    "research": "当前数据源未获取到公开研报",
    "announcements": "当前公告数据源未返回结果",
    "signals": "信号字段为空",
    "sectorMembership": "板块归属缺失",
}
LEGACY_REASON_MAP = {
    "No public research report returned by current data source": MISSING_REASONS["research"],
    "Current announcement data source returned no result": MISSING_REASONS["announcements"],
}


class UniqueList:
    def __init__(self) -> None:
        self.items: "OrderedDict[str, str]" = OrderedDict()

    def add(self, key: str, text: str) -> None:
        self.items.setdefault(key, text)

    def values(self) -> list[str]:
        return list(self.items.values())

    def __len__(self) -> int:
        return len(self.items)


def load_json(name: str) -> dict[str, Any]:
    return json.loads((REAL_DIR / name).read_text(encoding="utf-8"))


def load_stock_universe() -> dict[str, Any]:
    if not STOCK_UNIVERSE_PATH.exists():
        raise FileNotFoundError("stock-universe.generated.json is missing; run `npm run data:universe` first")
    return json.loads(STOCK_UNIVERSE_PATH.read_text(encoding="utf-8"))


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_future(value: str | None) -> bool:
    dt = parse_dt(value)
    if not dt:
        return False
    return dt > datetime.now(dt.tzinfo or timezone.utc)


def is_stale(value: str | None) -> bool:
    dt = parse_dt(value)
    if not dt:
        return True
    return dt < datetime.now(dt.tzinfo or timezone.utc) - timedelta(days=7)


def status_of(item: dict[str, Any] | None) -> str:
    return ((item or {}).get("quality") or {}).get("status", "missing")


def normalize_module(module: str) -> str:
    return MODULE_ALIASES.get(module, module)


def quality_reason(item: dict[str, Any] | None, default: str, module: str | None = None) -> str:
    if module:
        normalized = normalize_module(module)
        if normalized in MISSING_REASONS:
            return MISSING_REASONS[normalized]
    if not item:
        return default
    reason = str(item.get("reason") or (item.get("quality") or {}).get("errorMessage") or default)
    return LEGACY_REASON_MAP.get(reason, reason)


def has_core_financial(financial: dict[str, Any]) -> bool:
    return sum(financial.get(field) is not None for field in CORE_FINANCIAL_FIELDS) >= 2


def has_f10(profile: dict[str, Any]) -> bool:
    return bool(profile.get("companyProfile") or profile.get("businessScope"))


def has_signal(signal: dict[str, Any]) -> bool:
    return any(signal.get(field) is not None for field in SIGNAL_FIELDS)


def pct(count: int, total: int) -> str:
    return f"{count}/{total} ({(count / total * 100 if total else 0):.1f}%)"


def count_by_market(items: list[dict[str, Any]], predicate=lambda item: True) -> dict[str, int]:
    counts = {market: 0 for market in MARKETS}
    for item in items:
        if predicate(item):
            market = str(item.get("market") or "unknown")
            counts[market] = counts.get(market, 0) + 1
    return counts


def format_stock(item: dict[str, Any] | None, stock_id: str) -> str:
    if not item:
        return f"{stock_id} | {stock_id} | unknown"
    return f"{stock_id} | {item.get('name') or stock_id} | {item.get('market') or 'unknown'}"


def main() -> int:
    errors = UniqueList()
    warnings = UniqueList()
    missing_items = UniqueList()
    stale_items = UniqueList()

    try:
        universe_payload = load_stock_universe()
    except Exception as exc:
        errors.add("universe:read", f"stock-universe.generated.json: 不可读取或不可解析：{exc}")
        write_report({}, {}, [], [], errors, warnings, missing_items, stale_items)
        return 1

    universe_items = universe_payload.get("items", [])
    if not isinstance(universe_items, list) or not universe_items:
        errors.add("universe:empty", "stock-universe.generated.json: items 为空")
        write_report({}, universe_payload, [], [], errors, warnings, missing_items, stale_items)
        return 1

    universe_by_id = {str(item.get("id")): item for item in universe_items if item.get("id")}
    a_share_items = [
        item
        for item in universe_items
        if item.get("dataStatus") == "supported" and item.get("dataProvider") == "aStockData" and item.get("shouldValidate", False)
    ]
    hk_items = [
        item
        for item in universe_items
        if item.get("dataStatus") == "supported" and item.get("dataProvider") == "yfinance" and item.get("shouldValidate", False)
    ]
    unsupported_items = [item for item in universe_items if item.get("dataStatus") == "unsupported_market"]
    a_share_ids = {str(item["id"]) for item in a_share_items}
    hk_ids = {str(item["id"]) for item in hk_items}
    unsupported_ids = {str(item["id"]) for item in unsupported_items}

    files = {
        "manifest": "data-manifest.generated.json",
        "profiles": "stocks.generated.json",
        "quotes": "quotes.generated.json",
        "priceHistory": "priceHistory.generated.json",
        "financials": "financials.generated.json",
        "research": "research.generated.json",
        "announcements": "announcements.generated.json",
        "signals": "signals.generated.json",
        "sectorMembership": "sectorMembership.generated.json",
    }

    data: dict[str, Any] = {}
    for key, filename in files.items():
        try:
            data[key] = load_json(filename)
        except Exception as exc:
            errors.add(f"file:{filename}", f"{filename}: JSON 不可读取或不可解析：{exc}")

    if len(errors):
        write_report({}, universe_payload, unsupported_items, [], errors, warnings, missing_items, stale_items)
        return 1

    manifest = data["manifest"]
    manifest_universe = manifest.get("universe") or {}
    expected_markets = count_by_market(universe_items)
    expected_supported = count_by_market(universe_items, lambda item: item.get("dataStatus") == "supported")
    expected_unsupported = count_by_market(universe_items, lambda item: item.get("dataStatus") != "supported")

    if is_future(manifest.get("updatedAt")):
        errors.add("manifest:future", "manifest.updatedAt 晚于当前时间")
    if manifest_universe.get("total") != len(universe_items):
        errors.add("manifest:total", f"manifest.universe.total 与 stock-universe 不一致：{manifest_universe.get('total')} != {len(universe_items)}")
    if manifest_universe.get("markets") != expected_markets:
        errors.add("manifest:markets", "manifest.universe.markets 与 stock-universe 不一致")
    if manifest_universe.get("supported") != expected_supported:
        errors.add("manifest:supported", "manifest.universe.supported 与 stock-universe 不一致")
    if manifest_universe.get("unsupported") != expected_unsupported:
        errors.add("manifest:unsupported", "manifest.universe.unsupported 与 stock-universe 不一致")

    profiles = data["profiles"].get("items", {})
    quotes = data["quotes"].get("items", {})
    histories = data["priceHistory"].get("items", {})
    financials = data["financials"].get("items", {})
    research_items = data["research"].get("items", {})
    announcement_items = data["announcements"].get("items", {})
    signals = data["signals"].get("items", {})
    sectors = data["sectorMembership"].get("items", {})

    def add_missing(stock_id: str, module: str, reason: str) -> None:
        normalized = normalize_module(module)
        missing_items.add(
            f"{stock_id}:{normalized}",
            f"{format_stock(universe_by_id.get(stock_id), stock_id)} | {normalized} | {reason}",
        )

    def add_stale(stock_id: str, module: str) -> None:
        normalized = normalize_module(module)
        stale_items.add(
            f"{stock_id}:{normalized}",
            f"{format_stock(universe_by_id.get(stock_id), stock_id)} | {normalized}",
        )

    for stock_id in sorted(a_share_ids | hk_ids | unsupported_ids):
        if stock_id not in profiles:
            errors.add(f"{stock_id}:profiles", f"{stock_id}: 缺少 profile")

    counters = {
        "quotes": 0,
        "priceHistory": 0,
        "financials": 0,
        "reportDates": 0,
        "profiles": 0,
        "industry": 0,
        "research": 0,
        "announcements": 0,
        "signals": 0,
        "sectorMembership": 0,
    }

    for stock_id in sorted(a_share_ids):
        profile = profiles.get(stock_id, {})
        quote = quotes.get(stock_id, {})
        history = histories.get(stock_id, {})
        financial = financials.get(stock_id, {})
        research = research_items.get(stock_id, {})
        announcement = announcement_items.get(stock_id, {})
        signal = signals.get(stock_id, {})
        sector = sectors.get(stock_id, {})

        code = str(profile.get("code") or universe_by_id.get(stock_id, {}).get("code") or "")
        if not (len(code) == 6 and code.isdigit()):
            errors.add(f"{stock_id}:code", f"{stock_id}: A 股代码不是 6 位数字：{code}")

        if status_of(quote) == "real" and isinstance(quote.get("latestPrice"), (int, float)) and quote["latestPrice"] > 0:
            counters["quotes"] += 1
        else:
            add_missing(stock_id, "quotes", quality_reason(quote, "行情接口未返回有效最新价", "quotes"))

        points = history.get("points") or []
        if status_of(history) == "real" and len(points) >= 30:
            counters["priceHistory"] += 1
        else:
            add_missing(stock_id, "priceHistory", quality_reason(history, "K 线数据不足或接口未返回", "priceHistory"))

        if has_core_financial(financial):
            counters["financials"] += 1
        else:
            add_missing(stock_id, "financials", quality_reason(financial, "核心财务字段不足", "financials"))
        if financial.get("reportDate"):
            counters["reportDates"] += 1
        else:
            warnings.add(f"{stock_id}:reportDate", f"{stock_id}: 财务 reportDate 缺失")

        if has_f10(profile):
            counters["profiles"] += 1
        else:
            add_missing(stock_id, "profiles", quality_reason(profile, "F10 / 公司资料缺失", "profiles"))
        if profile.get("industryName"):
            counters["industry"] += 1
        else:
            add_missing(stock_id, "profiles", "F10 / 公司资料缺失")

        if status_of(research) == "real" and research.get("reports"):
            counters["research"] += 1
        else:
            add_missing(stock_id, "research", quality_reason(research, "当前数据源未获取到公开研报", "research"))

        if status_of(announcement) == "real" and announcement.get("announcements"):
            counters["announcements"] += 1
        else:
            add_missing(stock_id, "announcements", quality_reason(announcement, "当前公告数据源未返回结果", "announcements"))

        if has_signal(signal):
            counters["signals"] += 1
        else:
            add_missing(stock_id, "signals", quality_reason(signal, "信号字段为空", "signals"))

        if sector.get("industry") or sector.get("concept") or sector.get("region") or profile.get("industryName"):
            counters["sectorMembership"] += 1
        else:
            add_missing(stock_id, "sectorMembership", quality_reason(sector, "板块归属缺失", "sectorMembership"))

        module_items = {
            "quotes": quote,
            "priceHistory": history,
            "financials": financial,
            "profiles": profile,
            "research": research,
            "announcements": announcement,
            "signals": signal,
            "sectorMembership": sector,
        }
        for module, item in module_items.items():
            quality = item.get("quality") or {}
            status = quality.get("status")
            if status in {"error", "stale"}:
                add_missing(stock_id, module, quality_reason(item, str(status)))
            if is_stale(quality.get("updatedAt")):
                add_stale(stock_id, module)

        pe = quote.get("peTtm") if quote.get("peTtm") is not None else quote.get("pe")
        pb = quote.get("pb")
        if isinstance(pe, (int, float)) and (pe < -200 or pe > 500):
            warnings.add(f"{stock_id}:pe", f"{stock_id}: PE TTM 极端值：{pe}")
        if isinstance(pb, (int, float)) and (pb < 0 or pb > 80):
            warnings.add(f"{stock_id}:pb", f"{stock_id}: PB 极端值：{pb}")

        for label, value in (("revenue", financial.get("revenue")), ("netProfit", financial.get("netProfit")), ("marketCap", quote.get("marketCap"))):
            if isinstance(value, (int, float)) and abs(value) > 1_000_000:
                warnings.add(f"{stock_id}:{label}:scale", f"{stock_id}: {label} 数量级可能异常，当前应为亿元：{value}")

        if is_future(quote.get("updatedAt")):
            errors.add(f"{stock_id}:quote:future", f"{stock_id}: quote.updatedAt 晚于当前时间")
        for point in points:
            if point.get("date") and point["date"] > datetime.now().date().isoformat():
                errors.add(f"{stock_id}:history:future:{point['date']}", f"{stock_id}: K 线日期晚于当前日期：{point['date']}")

    hk_counters = {
        "quotes": 0,
        "priceHistory": 0,
        "financials": 0,
        "research": 0,
        "announcements": 0,
    }
    hk_status_rows: list[str] = []
    for stock_id in sorted(hk_ids):
        stock = universe_by_id.get(stock_id, {})
        quote = quotes.get(stock_id, {})
        history = histories.get(stock_id, {})
        financial = financials.get(stock_id, {})
        research = research_items.get(stock_id, {})
        announcement = announcement_items.get(stock_id, {})

        quote_status = status_of(quote)
        history_status = status_of(history)
        financial_status = status_of(financial)
        research_status = status_of(research)
        announcement_status = status_of(announcement)

        if quote_status in {"real", "partial"} and isinstance(quote.get("latestPrice"), (int, float)) and quote["latestPrice"] > 0:
            hk_counters["quotes"] += 1
        else:
            add_missing(stock_id, "quotes", quality_reason(quote, "港股行情接口未返回有效最新价", "quotes"))

        points = history.get("points") or []
        if history_status in {"real", "partial"} and len(points) >= 30:
            hk_counters["priceHistory"] += 1
        else:
            add_missing(stock_id, "priceHistory", quality_reason(history, "港股 K 线数据不足或接口未返回", "priceHistory"))

        if financial_status not in {"not_implemented", "missing"} and has_core_financial(financial):
            hk_counters["financials"] += 1
        if research_status == "real" and research.get("reports"):
            hk_counters["research"] += 1
        if announcement_status == "real" and announcement.get("announcements"):
            hk_counters["announcements"] += 1

        hk_status_rows.append(
            f"{stock_id} | {stock.get('name') or stock_id} | {stock.get('standardSymbol')} | "
            f"quote={quote_status} | priceHistory={history_status} | financials={financial_status} | "
            f"research={research_status} | announcements={announcement_status} | source=yfinance"
        )

        if is_future(quote.get("updatedAt")):
            errors.add(f"{stock_id}:quote:future", f"{stock_id}: quote.updatedAt 晚于当前时间")
        for point in points:
            if point.get("date") and point["date"] > datetime.now().date().isoformat():
                errors.add(f"{stock_id}:history:future:{point['date']}", f"{stock_id}: K 线日期晚于当前日期：{point['date']}")

    unsupported_ok = 0
    for stock_id in unsupported_ids:
        profile_status = status_of(profiles.get(stock_id, {}))
        if profile_status == "unsupported_market":
            unsupported_ok += 1
        else:
            errors.add(f"{stock_id}:unsupported", f"{stock_id}: 应标记 unsupported_market，实际为 {profile_status}")

    total_a = len(a_share_ids)
    total_hk = len(hk_ids)
    coverage = {
        "Universe 总数": str(len(universe_items)),
        "Universe 市场分布": json.dumps(expected_markets, ensure_ascii=False),
        "Universe 支持分布": json.dumps(expected_supported, ensure_ascii=False),
        "Universe 不支持分布": json.dumps(expected_unsupported, ensure_ascii=False),
        "Manifest Universe 总数": str(manifest_universe.get("total")),
        "A 股 quotes 覆盖": pct(counters["quotes"], total_a),
        "A 股 priceHistory 覆盖": pct(counters["priceHistory"], total_a),
        "A 股 financials 覆盖": pct(counters["financials"], total_a),
        "财务报告期覆盖": pct(counters["reportDates"], total_a),
        "A 股 profiles / F10 覆盖": pct(counters["profiles"], total_a),
        "行业分类覆盖": pct(counters["industry"], total_a),
        "A 股 research 覆盖": pct(counters["research"], total_a),
        "A 股 announcements 覆盖": pct(counters["announcements"], total_a),
        "A 股 signals 覆盖": pct(counters["signals"], total_a),
        "A 股 sectorMembership 覆盖": pct(counters["sectorMembership"], total_a),
        "HK quotes 覆盖": pct(hk_counters["quotes"], total_hk),
        "HK priceHistory 覆盖": pct(hk_counters["priceHistory"], total_hk),
        "HK financials 覆盖": f"{hk_counters['financials']}/{total_hk}（暂未接入）",
        "HK research 覆盖": f"{hk_counters['research']}/{total_hk}（暂未接入）",
        "HK announcements 覆盖": f"{hk_counters['announcements']}/{total_hk}（暂未接入）",
        "港股 unsupported": f"unsupported_market {unsupported_ok}/{len(unsupported_ids)}，不计入 A 股覆盖率",
        "stale 数据数量": str(len(stale_items)),
        "missing 明细数量": str(len(missing_items)),
    }

    manifest_coverage = manifest.get("coverage") or {}
    for module, summary in manifest_coverage.items():
        if str(module).startswith("hk"):
            continue
        if isinstance(summary, dict) and summary.get("total") != total_a:
            errors.add(f"manifest:{module}:total", f"manifest.coverage.{module}.total 与 A 股支持分母不一致")
        if isinstance(summary, dict) and summary.get("unsupportedTotal") != len(unsupported_ids):
            errors.add(f"manifest:{module}:unsupported", f"manifest.coverage.{module}.unsupportedTotal 与 unsupported universe 不一致")

    if total_a == 0:
        errors.add("a-share:empty", "A 股 Universe 为空")
    else:
        thresholds = {
            "quotes": (0.9, "A 股行情覆盖率低于 90%"),
            "priceHistory": (0.9, "A 股 K 线覆盖率低于 90%"),
            "financials": (0.8, "A 股财务核心字段覆盖率低于 80%"),
            "profiles": (0.9, "F10 / 主营业务覆盖率低于 90%"),
            "signals": (0.7, "信号层覆盖率低于 70%"),
            "announcements": (0.7, "公告覆盖率低于 70%"),
        }
        for module, (threshold, message) in thresholds.items():
            if counters[module] / total_a < threshold:
                errors.add(f"coverage:{module}", message)

    write_report(coverage, universe_payload, unsupported_items, hk_status_rows, errors, warnings, missing_items, stale_items)
    print(f"Validation complete: errors={len(errors)}, warnings={len(warnings)}, report={REPORT_PATH}")
    return 1 if len(errors) else 0


def write_report(
    coverage: dict[str, str],
    universe_payload: dict[str, Any],
    unsupported_items: list[dict[str, Any]],
    hk_status_rows: list[str],
    errors: UniqueList,
    warnings: UniqueList,
    missing_items: UniqueList,
    stale_items: UniqueList,
) -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    private_total = (universe_payload.get("privateCompanies") or {}).get("total", 0)
    lines = [
        "# A Stock Data 数据校验报告",
        "",
        f"- 生成时间：{datetime.now().replace(microsecond=0).isoformat()}",
        "- 口径来源：`src/data/real/stock-universe.generated.json`",
        "- 港股状态：第三步接入 yfinance quote / priceHistory MVP；港股行情单独统计，不纳入 A 股覆盖率分母。",
        "",
        "## 1. Universe 口径",
        "",
        f"- Universe 总数：{universe_payload.get('total', 'N/A')}",
        f"- 市场分布：{json.dumps(universe_payload.get('markets', {}), ensure_ascii=False)}",
        f"- 支持分布：{json.dumps(universe_payload.get('supported', {}), ensure_ascii=False)}",
        f"- 不支持分布：{json.dumps(universe_payload.get('unsupported', {}), ensure_ascii=False)}",
        f"- 未上市公司：{private_total}，单独维护，不进入行情覆盖率。",
        "",
        "## 2. A 股覆盖率",
        "",
    ]
    lines.extend([f"- {key}：{value}" for key, value in coverage.items()] or ["- 暂无"])
    lines.extend(["", "## 3. 港股行情覆盖", ""])
    lines.extend([f"- {item}" for item in hk_status_rows] or ["- 暂无港股 Provider 结果"])
    lines.extend(
        [
            "- 说明：本阶段只接入港股 quote 与 priceHistory；financials / research / announcements 继续标记为 not_implemented，不伪造数据。",
            "- 港股行情单独统计，不计入 A 股覆盖率分母。",
        ]
    )
    if unsupported_items:
        lines.extend(["", "## 3.1 仍未支持市场", ""])
        lines.extend(
            [
                f"- {item.get('id')} | {item.get('name')} | {item.get('standardSymbol')} | {item.get('dataStatus')}"
                for item in unsupported_items
            ]
        )
    lines.extend(["", "## 4. 缺失明细", ""])
    lines.extend([f"- {item}" for item in missing_items.values()] or ["- 无"])
    lines.extend(["", "## 5. 异常值 / 警告", ""])
    lines.extend([f"- {item}" for item in warnings.values()] or ["- 无"])
    lines.extend(["", "## 阻断错误", ""])
    lines.extend([f"- {item}" for item in errors.values()] or ["- 无"])
    lines.extend(["", "## Stale 明细", ""])
    lines.extend([f"- {item}" for item in stale_items.values()] or ["- 无"])
    lines.extend(
        [
            "",
            "## 6. 下一步建议",
            "",
            "- research 缺失继续保留为真实缺口，不用 mock 研报填充。",
            "- announcements 缺失继续保留为真实缺口，不用 mock 公告填充。",
            "- 继续保持 A 股抓取串行限流，避免对东财端点高频请求。",
            "- 港股财务、研报、公告等待后续 Provider 接入；当前保持 not_implemented。",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
