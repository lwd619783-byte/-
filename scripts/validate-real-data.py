from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REAL_DIR = ROOT / "src" / "data" / "real"
DOCS_DIR = ROOT / "docs"
REPORT = DOCS_DIR / "data-validation-report.md"


def load(name: str) -> dict[str, Any]:
    path = REAL_DIR / name
    if not path.exists():
        return {"items": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return date if date.tzinfo else date.replace(tzinfo=timezone.utc)
    except ValueError:
        try:
            return datetime.fromisoformat(value[:10]).replace(tzinfo=timezone.utc)
        except ValueError:
            return None


def main() -> int:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load("data-manifest.generated.json")
    quotes = load("quotes.generated.json").get("items", {})
    financials = load("financials.generated.json").get("items", {})
    history = load("priceHistory.generated.json").get("items", {})

    issues: list[str] = []
    warnings: list[str] = []
    now = datetime.now(timezone.utc)

    for stock_id, quote in quotes.items():
      if quote.get("quality", {}).get("status") in {"missing", "error"}:
          warnings.append(f"{stock_id}: 行情缺失 - {quote.get('quality', {}).get('errorMessage', '')}")
      for key in ("pe", "pb"):
          val = quote.get(key)
          if isinstance(val, (int, float)) and (val < 0 or val > 1000):
              warnings.append(f"{stock_id}: {key} 数值异常 {val}")
      updated = parse_date(quote.get("updatedAt"))
      if updated and updated > now:
          issues.append(f"{stock_id}: 行情更新时间晚于当前时间 {quote.get('updatedAt')}")

    for stock_id, item in history.items():
        points = item.get("points", [])
        if not points:
            warnings.append(f"{stock_id}: 价格历史为空")
        for point in points:
            d = parse_date(point.get("date"))
            if d and d > now:
                issues.append(f"{stock_id}: 价格历史存在未来日期 {point.get('date')}")

    for stock_id, fin in financials.items():
        for key in ("revenue", "netProfit", "operatingCashFlow"):
            val = fin.get(key)
            if isinstance(val, (int, float)) and abs(val) > 10000000:
                warnings.append(f"{stock_id}: {key} 疑似单位异常 {val}")
        for key in ("grossMargin", "netMargin", "roe", "debtRatio"):
            val = fin.get(key)
            if isinstance(val, (int, float)) and abs(val) > 500:
                warnings.append(f"{stock_id}: {key} 百分比异常 {val}")

    real_quotes = sum(1 for item in quotes.values() if item.get("quality", {}).get("status") == "real")
    real_history = sum(1 for item in history.values() if item.get("points"))
    missing_financial = sum(1 for item in financials.values() if item.get("quality", {}).get("status") != "real")

    lines = [
        "# 数据校验报告",
        "",
        f"- 生成时间：{datetime.now().astimezone().isoformat(timespec='seconds')}",
        f"- manifest 更新时间：{manifest.get('updatedAt', 'N/A')}",
        f"- 真实行情数量：{real_quotes}",
        f"- 有价格历史数量：{real_history}",
        f"- 财务缺失数量：{missing_financial}",
        "",
        "## 阻断问题",
        *(f"- {item}" for item in issues),
        *(["- 无"] if not issues else []),
        "",
        "## 警告 / 缺口",
        *(f"- {item}" for item in warnings[:120]),
        *(["- 无"] if not warnings else []),
        "",
        "## 验收提示",
        "- 若真实行情或价格历史少于 5，只能视为数据源联通性不足，前端仍应以 mixed/missing 状态降级展示。",
        "- 本报告不验证投资结论，只验证数据形态、更新时间和基本数量级。",
    ]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {REPORT}")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
