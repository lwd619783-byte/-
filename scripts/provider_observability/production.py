from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from a_share_announcements.artifacts import validate_artifacts
from a_share_financials.artifacts import MANIFEST_FILENAME, load_existing_split_items, validate_split_artifacts
from a_share_financials.core import build_summary, validate_dataset

from .core import load_json


def validate_financial_production(root: Path) -> dict[str, Any]:
    errors: list[str] = []
    summary_path = root / "src/data/real/a-share-financial-summaries.generated.json"
    detail_dir = root / "public/data/a-share-financials"
    manifest_path = detail_dir / MANIFEST_FILENAME
    try:
        universe = load_json(root / "src/data/real/stock-universe.generated.json")["items"]
        expected = {item["id"] for item in universe if item.get("market") == "A股" and item.get("shouldFetchFinancials", True)}
        items = load_existing_split_items(detail_dir)
        summary = load_json(summary_path)
        errors.extend(validate_split_artifacts(summary_path, manifest_path, detail_dir, expected))
        dataset = {"items": items, "summary": build_summary(items)}
        errors.extend(validate_dataset(dataset, universe))
        if summary.get("summary") != dataset["summary"]: errors.append("summary coverage block does not match detail records")
        if len(expected) != 56: errors.append(f"expected A-share universe 56, got {len(expected)}")
    except Exception as exc:
        errors.append(f"unable to validate financial production: {exc}")
    errors = sorted(set(errors))
    return {"passed": not errors, "errorCount": len(errors), "errors": errors}


def validate_announcement_production(root: Path) -> dict[str, Any]:
    errors: list[str] = []
    try:
        universe = load_json(root / "src/data/real/stock-universe.generated.json")["items"]
        expected = {item["id"] for item in universe if item.get("market") == "A股"}
        errors.extend(validate_artifacts(root / "src/data/real/a-share-announcement-summaries.generated.json", root / "public/data/a-share-announcements", expected))
        if len(expected) != 56: errors.append(f"expected A-share universe 56, got {len(expected)}")
    except Exception as exc:
        errors.append(f"unable to validate announcement production: {exc}")
    errors = sorted(set(errors))
    return {"passed": not errors, "errorCount": len(errors), "errors": errors}


def validate_data_audit(root: Path) -> dict[str, Any]:
    process = subprocess.run(["node", "scripts/data-audit.mjs", "--json", "--no-write"], cwd=root, text=True, encoding="utf-8", errors="replace", capture_output=True)
    try:
        payload = json.loads(process.stdout)
    except Exception as exc:
        return {"passed": False, "exitCode": process.returncode, "p0": None, "errors": 1, "messages": [f"invalid structured audit output: {exc}"]}
    return {"passed": process.returncode == 0 and payload.get("P0") == 0 and payload.get("errors") == 0, "exitCode": process.returncode, "p0": payload.get("P0"), "errors": payload.get("errors"), "warnings": payload.get("warnings"), "messages": []}


def validate_default_refresh(root: Path) -> dict[str, Any]:
    package = load_json(root / "package.json")
    command = str(package.get("scripts", {}).get("data:refresh", ""))
    forbidden = [name for name in ("data:fetch:financials:a", "data:fetch:announcements:a", "data:observe:providers", "fetch-a-share-financials.py", "fetch-a-share-announcements.py") if name in command]
    return {"passed": not forbidden, "unqualifiedProvidersIncluded": forbidden}


def validate_production(root: Path) -> dict[str, Any]:
    financials = validate_financial_production(root)
    announcements = validate_announcement_production(root)
    audit = validate_data_audit(root)
    default_refresh = validate_default_refresh(root)
    return {"passed": all(item["passed"] for item in (financials, announcements, audit, default_refresh)), "financials": financials, "announcements": announcements, "dataAudit": audit, "defaultRefresh": default_refresh}
