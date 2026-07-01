from __future__ import annotations

import json
from datetime import datetime, timezone
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


def load_json(name: str) -> dict[str, Any]:
    path = REAL_DIR / name
    return json.loads(path.read_text(encoding="utf-8"))


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
    now = datetime.now(dt.tzinfo or timezone.utc)
    return dt > now


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    infos: list[str] = []
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
        write_report(errors, warnings, infos)
        return 1

    manifest = data["manifest"]
    if is_future(manifest.get("updatedAt")):
        errors.append("manifest.updatedAt 晚于当前时间")

    profiles = data["profiles"].get("items", {})
    quotes = data["quotes"].get("items", {})
    histories = data["history"].get("items", {})
    financials = data["financials"].get("items", {})
    research = data["research"].get("items", {})
    announcements = data["announcements"].get("items", {})
    signals = data["signals"].get("items", {})
    sector = data["sector"].get("items", {})

    missing_profile = sorted((A_SHARE_IDS | UNSUPPORTED_IDS) - set(profiles))
    if missing_profile:
        errors.append(f"映射股票缺少 profile：{', '.join(missing_profile)}")

    for stock_id in A_SHARE_IDS:
        profile = profiles.get(stock_id)
        quote = quotes.get(stock_id)
        history = histories.get(stock_id)
        financial = financials.get(stock_id)
        if not profile:
            continue
        code = str(profile.get("code") or "")
        if not (len(code) == 6 and code.isdigit()):
            errors.append(f"{stock_id}: A 股代码不是 6 位数字：{code}")
        if profile.get("quality", {}).get("status") not in {"real", "stale", "missing", "error"}:
            errors.append(f"{stock_id}: profile 状态非法")

        if not quote:
            errors.append(f"{stock_id}: 缺少 quote")
        else:
            status = quote.get("quality", {}).get("status")
            price = quote.get("latestPrice")
            if status == "real" and (not isinstance(price, (int, float)) or price <= 0):
                errors.append(f"{stock_id}: 真实行情 latestPrice 非正")
            if status != "real":
                warnings.append(f"{stock_id}: quote 状态为 {status}")
            pe = quote.get("peTtm") if quote.get("peTtm") is not None else quote.get("pe")
            pb = quote.get("pb")
            if isinstance(pe, (int, float)) and (pe < -200 or pe > 500):
                warnings.append(f"{stock_id}: PE TTM 可能异常：{pe}")
            if isinstance(pb, (int, float)) and (pb < 0 or pb > 80):
                warnings.append(f"{stock_id}: PB 可能异常：{pb}")
            for field in ("marketCap", "floatMarketCap", "amount"):
                value = quote.get(field)
                if isinstance(value, (int, float)) and value < 0:
                    warnings.append(f"{stock_id}: {field} 为负值，单位或源字段需复核")
            if is_future(quote.get("updatedAt")):
                errors.append(f"{stock_id}: quote.updatedAt 晚于当前时间")

        if not history:
            errors.append(f"{stock_id}: 缺少 priceHistory")
        else:
            points = history.get("points") or []
            if history.get("quality", {}).get("status") == "real" and len(points) < 30:
                warnings.append(f"{stock_id}: K 线少于 30 条：{len(points)}")
            for point in points:
                if point.get("date") and point["date"] > datetime.now().date().isoformat():
                    errors.append(f"{stock_id}: K 线日期晚于当前日期：{point['date']}")
                close = point.get("close")
                if close is not None and close <= 0:
                    warnings.append(f"{stock_id}: K 线 close 非正：{point.get('date')}")

        if financial:
            revenue = financial.get("revenue")
            net_profit = financial.get("netProfit")
            for label, value in (("revenue", revenue), ("netProfit", net_profit)):
                if isinstance(value, (int, float)) and abs(value) > 1_000_000:
                    warnings.append(f"{stock_id}: {label} 数量级可能异常，当前按亿元口径检查：{value}")
        else:
            warnings.append(f"{stock_id}: 缺少 financials")

        for layer_name, bucket in (("research", research), ("announcements", announcements), ("signals", signals), ("sector", sector)):
            if stock_id not in bucket:
                warnings.append(f"{stock_id}: 缺少 {layer_name} 生成项")

    for stock_id in UNSUPPORTED_IDS:
        status = profiles.get(stock_id, {}).get("quality", {}).get("status")
        if status != "unsupported_market":
            errors.append(f"{stock_id}: 应标记 unsupported_market，实际为 {status}")

    quote_real = sum(1 for item in quotes.values() if item.get("quality", {}).get("status") == "real")
    history_real = sum(1 for item in histories.values() if item.get("quality", {}).get("status") == "real" and len(item.get("points") or []) >= 30)
    infos.append(f"A 股真实行情覆盖：{quote_real}/{len(A_SHARE_IDS)}")
    infos.append(f"最近 K 线 >=30 条覆盖：{history_real}/{len(A_SHARE_IDS)}")
    infos.append(f"暂不支持市场：{len(UNSUPPORTED_IDS)}")
    if quote_real < 5:
        errors.append("真实行情少于 5 只 A 股")
    if history_real < 5:
        errors.append("最近 60 日价格历史成功少于 5 只股票")

    write_report(errors, warnings, infos)
    print(f"Validation complete: errors={len(errors)}, warnings={len(warnings)}, report={REPORT_PATH}")
    return 1 if errors else 0


def write_report(errors: list[str], warnings: list[str], infos: list[str]) -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# A Stock Data 数据校验报告",
        "",
        f"- 生成时间：{datetime.now().replace(microsecond=0).isoformat()}",
        f"- 阻断错误：{len(errors)}",
        f"- 警告：{len(warnings)}",
        "",
        "## 覆盖概况",
        "",
    ]
    lines.extend([f"- {item}" for item in infos] or ["- 暂无"])
    lines.extend(["", "## 阻断错误", ""])
    lines.extend([f"- {item}" for item in errors] or ["- 无"])
    lines.extend(["", "## 警告 / 待核验", ""])
    lines.extend([f"- {item}" for item in warnings] or ["- 无"])
    lines.extend(
        [
            "",
            "## 校验口径",
            "",
            "- A 股代码必须为 6 位数字。",
            "- 港股/美股在本 MVP 中必须标记为 `unsupported_market`。",
            "- 真实 quote 的最新价必须大于 0。",
            "- 最近 K 线真实覆盖按不少于 30 条记录计算。",
            "- PE/PB、营收、净利润只做异常提示，不因缺失阻断前端构建。",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
