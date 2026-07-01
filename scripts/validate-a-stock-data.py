from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"
DOCS_DIR = ROOT / "docs"
REPORT_PATH = DOCS_DIR / "a-stock-data-validation-report.md"

A_SHARE_IDS = {
    "sugon",
    "fii",
    "eoptolink",
    "innolight",
    "wus",
    "victor-tech",
    "shennan",
    "best",
    "wuzhou",
    "leaderdrive",
    "moons",
    "topgroup",
    "wuxi",
    "pharmaron",
    "asymchem",
    "nano",
    "hengrui",
    "beigene",
    "cosco-energy",
    "cm-energy",
    "cm-nanjing",
}

UNSUPPORTED_IDS = {"lenovo"}
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


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    missing_items: list[str] = []
    stale_items: list[str] = []
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
        write_report({}, errors, warnings, missing_items, stale_items)
        return 1

    manifest = data["manifest"]
    if is_future(manifest.get("updatedAt")):
        errors.append("manifest.updatedAt 晚于当前时间")

    profiles = data["profiles"].get("items", {})
    quotes = data["quotes"].get("items", {})
    histories = data["history"].get("items", {})
    financials = data["financials"].get("items", {})
    signals = data["signals"].get("items", {})
    sectors = data["sector"].get("items", {})

    for stock_id in sorted(A_SHARE_IDS | UNSUPPORTED_IDS):
        if stock_id not in profiles:
            errors.append(f"{stock_id}: 缺少 profile")

    quote_real = 0
    history_real = 0
    finance_core = 0
    report_dates = 0
    f10_text = 0
    industry_count = 0
    signal_count = 0
    sector_count = 0

    for stock_id in sorted(A_SHARE_IDS):
        profile = profiles.get(stock_id, {})
        quote = quotes.get(stock_id, {})
        history = histories.get(stock_id, {})
        financial = financials.get(stock_id, {})
        signal = signals.get(stock_id, {})
        sector = sectors.get(stock_id, {})

        code = str(profile.get("code") or "")
        if not (len(code) == 6 and code.isdigit()):
            errors.append(f"{stock_id}: A 股代码不是 6 位数字：{code}")

        if status_of(quote) == "real" and isinstance(quote.get("latestPrice"), (int, float)) and quote["latestPrice"] > 0:
            quote_real += 1
        else:
            missing_items.append(f"{stock_id}.quote")

        points = history.get("points") or []
        if status_of(history) == "real" and len(points) >= 30:
            history_real += 1
        else:
            missing_items.append(f"{stock_id}.priceHistory")

        if has_core_financial(financial):
            finance_core += 1
        else:
            missing_items.append(f"{stock_id}.financialCore")
        if financial.get("reportDate"):
            report_dates += 1
        else:
            warnings.append(f"{stock_id}: 财务 reportDate 缺失")

        if has_f10(profile):
            f10_text += 1
        else:
            missing_items.append(f"{stock_id}.f10")
        if profile.get("industryName"):
            industry_count += 1
        else:
            missing_items.append(f"{stock_id}.industryName")

        if has_signal(signal):
            signal_count += 1
        else:
            missing_items.append(f"{stock_id}.signals")

        if sector.get("industry") or sector.get("concept") or sector.get("region") or profile.get("industryName"):
            sector_count += 1
        else:
            missing_items.append(f"{stock_id}.sectorMembership")

        for source_name, item in {
            "quote": quote,
            "history": history,
            "financial": financial,
            "profile": profile,
            "signal": signal,
            "sector": sector,
        }.items():
            quality = item.get("quality") or {}
            if quality.get("status") in {"missing", "error", "stale"}:
                missing_items.append(f"{stock_id}.{source_name}:{quality.get('status')}")
            if is_stale(quality.get("updatedAt")):
                stale_items.append(f"{stock_id}.{source_name}")

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
    for stock_id in UNSUPPORTED_IDS:
        profile_status = status_of(profiles.get(stock_id, {}))
        if profile_status == "unsupported_market":
            unsupported_ok += 1
        else:
            errors.append(f"{stock_id}: 应标记 unsupported_market，实际为 {profile_status}")

    total_a = len(A_SHARE_IDS)
    coverage = {
        "A 股行情覆盖": pct(quote_real, total_a),
        "A 股 K 线覆盖": pct(history_real, total_a),
        "A 股财务覆盖": pct(finance_core, total_a),
        "财务报告期覆盖": pct(report_dates, total_a),
        "F10 覆盖": pct(f10_text, total_a),
        "行业分类覆盖": pct(industry_count, total_a),
        "信号覆盖": pct(signal_count, total_a),
        "板块归属覆盖": pct(sector_count, total_a),
        "港股支持": f"unsupported_market {unsupported_ok}/{len(UNSUPPORTED_IDS)}；A 股统计未计入港股",
        "stale 数据数量": str(len(stale_items)),
        "missing 字段数量": str(len(missing_items)),
    }

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

    write_report(coverage, errors, warnings, missing_items, stale_items)
    print(f"Validation complete: errors={len(errors)}, warnings={len(warnings)}, report={REPORT_PATH}")
    return 1 if errors else 0


def write_report(
    coverage: dict[str, str],
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
        "",
        "## 覆盖概况",
        "",
    ]
    if coverage:
        lines.extend([f"- {key}：{value}" for key, value in coverage.items()])
    else:
        lines.append("- 暂无")
    lines.extend(["", "## 阻断错误", ""])
    lines.extend([f"- {item}" for item in errors] or ["- 无"])
    lines.extend(["", "## 警告", ""])
    lines.extend([f"- {item}" for item in warnings] or ["- 无"])
    lines.extend(["", "## stale/error/missing 数据项", ""])
    lines.extend([f"- stale: {item}" for item in stale_items[:80]] or ["- stale: 无"])
    lines.extend([f"- missing/error: {item}" for item in missing_items[:120]] or ["- missing/error: 无"])
    lines.extend(
        [
            "",
            "## 下一步建议",
            "",
            "- 将资金流、人气榜、互动易等高频信号拆成可选刷新，避免完整刷新耗时过长。",
            "- 接入港股 Provider 后再统计港股覆盖率；当前港股保持 unsupported_market。",
            "- 财务字段已按新浪三表口径统一为亿元和百分比，后续可用年报原文交叉校验。",
            "- F10 目前采用东财 HSF10 公司概况；主营收入构成如需更细，可继续接入经营分析端点。",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
