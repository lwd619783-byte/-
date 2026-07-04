from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"
DOCS_DIR = ROOT / "docs"
REPORT_PATH = DOCS_DIR / "a-stock-data-validation-report.md"
STOCK_UNIVERSE_PATH = REAL_DIR / "stock-universe.generated.json"
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


def has_core_financial(financial: dict[str, Any]) -> bool:
    return sum(financial.get(field) is not None for field in CORE_FINANCIAL_FIELDS) >= 2


def has_f10(profile: dict[str, Any]) -> bool:
    return bool(profile.get("companyProfile") or profile.get("businessScope"))


def has_signal(signal: dict[str, Any]) -> bool:
    return any(signal.get(field) is not None for field in SIGNAL_FIELDS)


def pct(count: int, total: int) -> str:
    return f"{count}/{total} ({(count / total * 100 if total else 0):.1f}%)"


def count_by_market(items: list[dict[str, Any]], predicate=lambda item: True) -> dict[str, int]:
    counts: dict[str, int] = {"A股": 0, "港股": 0, "美股": 0, "未上市": 0}
    for item in items:
        if predicate(item):
            market = str(item.get("market") or "unknown")
            counts[market] = counts.get(market, 0) + 1
    return counts


def format_stock(item: dict[str, Any] | None, stock_id: str) -> str:
    if not item:
        return stock_id
    name = item.get("name") or stock_id
    market = item.get("market") or "unknown"
    return f"{stock_id} | {name} | {market}"


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    missing_items: list[str] = []
    stale_items: list[str] = []

    try:
        universe_payload = load_stock_universe()
    except Exception as exc:
        errors.append(f"stock-universe.generated.json: 不可读取或不可解析：{exc}")
        write_report({}, {}, [], errors, warnings, missing_items, stale_items)
        return 1

    universe_items = universe_payload.get("items", [])
    if not isinstance(universe_items, list) or not universe_items:
        errors.append("stock-universe.generated.json: items 为空")
        write_report({}, universe_payload, [], errors, warnings, missing_items, stale_items)
        return 1

    universe_by_id = {str(item.get("id")): item for item in universe_items if item.get("id")}
    a_share_items = [
        item
        for item in universe_items
        if item.get("dataStatus") == "supported" and item.get("shouldValidate", False)
    ]
    unsupported_items = [item for item in universe_items if item.get("dataStatus") == "unsupported_market"]
    a_share_ids = {str(item["id"]) for item in a_share_items}
    unsupported_ids = {str(item["id"]) for item in unsupported_items}

    files = {
        "manifest": "data-manifest.generated.json",
        "profiles": "stocks.generated.json",
        "quotes": "quotes.generated.json",
        "history": "priceHistory.generated.json",
        "financials": "financials.generated.json",
        "research": "research.generated.json",
        "announcements": "announcements.generated.json",
        "signals": "signals.generated.json",
        "sector": "sectorMembership.generated.json",
    }

    data: dict[str, Any] = {}
    for key, filename in files.items():
        try:
            data[key] = load_json(filename)
        except Exception as exc:
            errors.append(f"{filename}: JSON 不可读取或不可解析：{exc}")

    if errors:
        write_report({}, universe_payload, unsupported_items, errors, warnings, missing_items, stale_items)
        return 1

    manifest = data["manifest"]
    manifest_universe = manifest.get("universe") or {}
    expected_markets = count_by_market(universe_items)
    expected_supported = count_by_market(universe_items, lambda item: item.get("dataStatus") == "supported")
    expected_unsupported = count_by_market(universe_items, lambda item: item.get("dataStatus") != "supported")

    if is_future(manifest.get("updatedAt")):
        errors.append("manifest.updatedAt 晚于当前时间")
    if manifest_universe.get("total") != len(universe_items):
        errors.append(f"manifest.universe.total 与 stock-universe 不一致：{manifest_universe.get('total')} != {len(universe_items)}")
    if manifest_universe.get("markets") != expected_markets:
        errors.append("manifest.universe.markets 与 stock-universe 不一致")
    if manifest_universe.get("supported") != expected_supported:
        errors.append("manifest.universe.supported 与 stock-universe 不一致")
    if manifest_universe.get("unsupported") != expected_unsupported:
        errors.append("manifest.universe.unsupported 与 stock-universe 不一致")

    profiles = data["profiles"].get("items", {})
    quotes = data["quotes"].get("items", {})
    histories = data["history"].get("items", {})
    financials = data["financials"].get("items", {})
    research_items = data["research"].get("items", {})
    announcement_items = data["announcements"].get("items", {})
    signals = data["signals"].get("items", {})
    sectors = data["sector"].get("items", {})

    def add_missing(stock_id: str, module: str, reason: str) -> None:
        missing_items.append(f"{format_stock(universe_by_id.get(stock_id), stock_id)} | {module} | {reason}")

    for stock_id in sorted(a_share_ids | unsupported_ids):
        if stock_id not in profiles:
            errors.append(f"{stock_id}: 缺少 profile")

    quote_real = 0
    history_real = 0
    finance_core = 0
    report_dates = 0
    f10_text = 0
    industry_count = 0
    research_count = 0
    announcement_count = 0
    signal_count = 0
    sector_count = 0

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
            errors.append(f"{stock_id}: A 股代码不是 6 位数字：{code}")

        if status_of(quote) == "real" and isinstance(quote.get("latestPrice"), (int, float)) and quote["latestPrice"] > 0:
            quote_real += 1
        else:
            add_missing(stock_id, "quote", status_of(quote))

        points = history.get("points") or []
        if status_of(history) == "real" and len(points) >= 30:
            history_real += 1
        else:
            add_missing(stock_id, "priceHistory", f"{status_of(history)} / {len(points)} points")

        if has_core_financial(financial):
            finance_core += 1
        else:
            add_missing(stock_id, "financialCore", "核心财务字段不足")
        if financial.get("reportDate"):
            report_dates += 1
        else:
            warnings.append(f"{stock_id}: 财务 reportDate 缺失")

        if has_f10(profile):
            f10_text += 1
        else:
            add_missing(stock_id, "f10", "公司概况/经营范围缺失")
        if profile.get("industryName"):
            industry_count += 1
        else:
            add_missing(stock_id, "industryName", "行业分类缺失")

        if status_of(research) == "real" and research.get("reports"):
            research_count += 1
        else:
            add_missing(stock_id, "research", status_of(research))

        if status_of(announcement) == "real" and announcement.get("announcements"):
            announcement_count += 1
        else:
            add_missing(stock_id, "announcements", status_of(announcement))

        if has_signal(signal):
            signal_count += 1
        else:
            add_missing(stock_id, "signals", "信号字段为空")

        if sector.get("industry") or sector.get("concept") or sector.get("region") or profile.get("industryName"):
            sector_count += 1
        else:
            add_missing(stock_id, "sectorMembership", "板块归属缺失")

        for source_name, item in {
            "quote": quote,
            "history": history,
            "financial": financial,
            "profile": profile,
            "research": research,
            "announcement": announcement,
            "signal": signal,
            "sector": sector,
        }.items():
            quality = item.get("quality") or {}
            if quality.get("status") in {"missing", "error", "stale"}:
                add_missing(stock_id, source_name, str(quality.get("status")))
            if is_stale(quality.get("updatedAt")):
                stale_items.append(f"{format_stock(universe_by_id.get(stock_id), stock_id)} | {source_name}")

        pe = quote.get("peTtm") if quote.get("peTtm") is not None else quote.get("pe")
        pb = quote.get("pb")
        if isinstance(pe, (int, float)) and (pe < -200 or pe > 500):
            warnings.append(f"{stock_id}: PE TTM 极端值：{pe}")
        if isinstance(pb, (int, float)) and (pb < 0 or pb > 80):
            warnings.append(f"{stock_id}: PB 极端值：{pb}")

        revenue = financial.get("revenue")
        net_profit = financial.get("netProfit")
        market_cap = quote.get("marketCap")
        for label, value in (("revenue", revenue), ("netProfit", net_profit), ("marketCap", market_cap)):
            if isinstance(value, (int, float)) and abs(value) > 1_000_000:
                warnings.append(f"{stock_id}: {label} 数量级可能异常，当前应为亿元：{value}")

        if is_future(quote.get("updatedAt")):
            errors.append(f"{stock_id}: quote.updatedAt 晚于当前时间")
        for point in points:
            if point.get("date") and point["date"] > datetime.now().date().isoformat():
                errors.append(f"{stock_id}: K 线日期晚于当前日期：{point['date']}")

    unsupported_ok = 0
    for stock_id in unsupported_ids:
        profile_status = status_of(profiles.get(stock_id, {}))
        if profile_status == "unsupported_market":
            unsupported_ok += 1
        else:
            errors.append(f"{stock_id}: 应标记 unsupported_market，实际为 {profile_status}")

    total_a = len(a_share_ids)
    coverage = {
        "Universe 总数": str(len(universe_items)),
        "Universe 市场分布": json.dumps(expected_markets, ensure_ascii=False),
        "Universe 支持分布": json.dumps(expected_supported, ensure_ascii=False),
        "Universe 不支持分布": json.dumps(expected_unsupported, ensure_ascii=False),
        "Manifest Universe 总数": str(manifest_universe.get("total")),
        "A 股行情覆盖": pct(quote_real, total_a),
        "A 股 K 线覆盖": pct(history_real, total_a),
        "A 股财务覆盖": pct(finance_core, total_a),
        "财务报告期覆盖": pct(report_dates, total_a),
        "F10 覆盖": pct(f10_text, total_a),
        "行业分类覆盖": pct(industry_count, total_a),
        "研报覆盖": pct(research_count, total_a),
        "公告覆盖": pct(announcement_count, total_a),
        "信号覆盖": pct(signal_count, total_a),
        "板块归属覆盖": pct(sector_count, total_a),
        "港股支持": f"unsupported_market {unsupported_ok}/{len(unsupported_ids)}；A 股统计未计入港股",
        "stale 数据数量": str(len(stale_items)),
        "missing 字段数量": str(len(missing_items)),
    }

    manifest_coverage = manifest.get("coverage") or {}
    for module, summary in manifest_coverage.items():
        if isinstance(summary, dict) and summary.get("total") != total_a:
            errors.append(f"manifest.coverage.{module}.total 与 A 股支持分母不一致")
        if isinstance(summary, dict) and summary.get("unsupportedTotal") != len(unsupported_ids):
            errors.append(f"manifest.coverage.{module}.unsupportedTotal 与 unsupported universe 不一致")

    if total_a == 0:
        errors.append("A 股 Universe 为空")
    else:
        if quote_real / total_a < 0.9:
            errors.append("A 股行情覆盖率低于 90%")
        if history_real / total_a < 0.9:
            errors.append("A 股 K 线覆盖率低于 90%")
        if finance_core / total_a < 0.8:
            errors.append("A 股财务核心字段覆盖率低于 80%")
        if f10_text / total_a < 0.9:
            errors.append("F10 / 主营业务覆盖率低于 90%")
        if signal_count / total_a < 0.7:
            errors.append("信号层覆盖率低于 70%")
        if announcement_count / total_a < 0.7:
            errors.append("公告覆盖率低于 70%")

    write_report(coverage, universe_payload, unsupported_items, errors, warnings, missing_items, stale_items)
    print(f"Validation complete: errors={len(errors)}, warnings={len(warnings)}, report={REPORT_PATH}")
    return 1 if errors else 0


def write_report(
    coverage: dict[str, str],
    universe_payload: dict[str, Any],
    unsupported_items: list[dict[str, Any]],
    errors: list[str],
    warnings: list[str],
    missing_items: list[str],
    stale_items: list[str],
) -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# A Stock Data 数据校验报告",
        "",
        f"- 生成时间：{datetime.now().replace(microsecond=0).isoformat()}",
        "- 口径：以 `src/data/real/stock-universe.generated.json` 为唯一 Universe 来源。",
        "- 港股状态：第一阶段明确标记为 `unsupported_market`，不纳入 A 股覆盖率分母。",
        "",
        "## Universe Overview",
        "",
        f"- Universe 总数：{universe_payload.get('total', 'N/A')}",
        f"- 市场分布：{json.dumps(universe_payload.get('markets', {}), ensure_ascii=False)}",
        f"- 支持分布：{json.dumps(universe_payload.get('supported', {}), ensure_ascii=False)}",
        f"- 不支持分布：{json.dumps(universe_payload.get('unsupported', {}), ensure_ascii=False)}",
        f"- 未上市公司：{(universe_payload.get('privateCompanies') or {}).get('total', 0)}，不进入行情覆盖分母。",
        "",
        "## A 股覆盖",
        "",
    ]
    lines.extend([f"- {key}：{value}" for key, value in coverage.items()] or ["- 暂无"])
    lines.extend(["", "## 港股 Unsupported List", ""])
    lines.extend(
        [
            f"- {item.get('id')} | {item.get('name')} | {item.get('standardSymbol')} | {item.get('dataStatus')}"
            for item in unsupported_items
        ]
        or ["- 暂无"]
    )
    lines.extend(["", "## 阻断错误", ""])
    lines.extend([f"- {item}" for item in errors] or ["- 无"])
    lines.extend(["", "## 异常数据 / 警告", ""])
    lines.extend([f"- {item}" for item in warnings] or ["- 无"])
    lines.extend(["", "## 缺失明细", ""])
    lines.extend([f"- {item}" for item in missing_items[:160]] or ["- 无"])
    lines.extend(["", "## Stale 明细", ""])
    lines.extend([f"- {item}" for item in stale_items[:80]] or ["- 无"])
    lines.extend(
        [
            "",
            "## 下一步建议",
            "",
            "- 继续保持 A 股抓取串行限流，避免对东财端点高频请求。",
            "- 港股 Provider 接入前继续保持 `unsupported_market`，不得用 mock 数据伪装真实行情。",
            "- 机器人未上市公司只进入研究池或私有公司清单，不进入上市股票行情覆盖分母。",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
