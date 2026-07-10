from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
import uuid
from pathlib import Path, PurePosixPath
from typing import Any

from .core import PROVIDER, PROVIDER_VERSION, SCHEMA_VERSION, build_summary

SUMMARY_FILENAME = "a-share-financial-summaries.generated.json"
MANIFEST_FILENAME = "manifest.generated.json"
PUBLIC_RELATIVE_DIR = "data/a-share-financials"


def json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False, allow_nan=False) + "\n").encode("utf-8")


def detail_document(record: dict[str, Any]) -> dict[str, Any]:
    return {"schemaVersion": SCHEMA_VERSION, **record}


def build_financial_summary(record: dict[str, Any]) -> dict[str, Any]:
    latest = record.get("reports", [None])[0] if record.get("reports") else None
    single = (latest or {}).get("singleQuarter") or {}
    derived = (latest or {}).get("derived") or {}
    balance = (latest or {}).get("balanceSheet") or {}
    field_status = (latest or {}).get("fieldStatus") or {}
    def status_for(field: str, value: Any) -> str:
        return field_status.get(field) or ("available" if value is not None else "missing")
    change_fields = (
        "revenueYoY", "revenueQoQ", "parentNetProfitYoY", "parentNetProfitQoQ",
        "deductedNetProfitYoY", "deductedNetProfitQoQ",
    )
    return {
        "id": record["id"],
        "stockCode": record["stockCode"],
        "companyName": record["companyName"],
        "market": record["market"],
        "industryType": record.get("industryType", "general"),
        "status": record["status"],
        "errorCode": record.get("errorCode"),
        "errorMessage": record.get("errorMessage"),
        "provider": record["provider"],
        "providerVersion": record["providerVersion"],
        "fetchedAt": record["fetchedAt"],
        "generatedAt": record["generatedAt"],
        "lastSuccessfulFetchAt": record.get("lastSuccessfulFetchAt"),
        "currentFetchError": record.get("currentFetchError"),
        "quality": record["quality"],
        "latestReportPeriod": latest.get("reportPeriod") if latest else None,
        "latestReportType": latest.get("reportType") if latest else "unknown",
        "latestSingleQuarter": {
            "operatingRevenue": single.get("operatingRevenue"),
            "netProfitAttributableToParent": single.get("netProfitAttributableToParent"),
            "netProfitExcludingNonRecurring": single.get("netProfitExcludingNonRecurring"),
            "netOperatingCashFlow": single.get("netOperatingCashFlow"),
        },
        "latestChanges": {field: derived.get(field) for field in change_fields},
        "latestRatios": {
            "grossMargin": derived.get("grossMargin"),
            "netMargin": derived.get("netMargin"),
            "debtToAssetRatio": derived.get("debtToAssetRatio"),
            "researchExpenseRatio": derived.get("researchExpenseRatio"),
        },
        "latestBalanceSheet": {
            "accountsReceivable": balance.get("accountsReceivable"),
            "inventory": balance.get("inventory"),
        },
        "fieldStatus": {
            "operatingRevenue": status_for("operatingRevenue", single.get("operatingRevenue")),
            "netProfitAttributableToParent": status_for("netProfitAttributableToParent", single.get("netProfitAttributableToParent")),
            "netProfitExcludingNonRecurring": status_for("netProfitExcludingNonRecurring", single.get("netProfitExcludingNonRecurring")),
            "netOperatingCashFlow": status_for("netOperatingCashFlow", single.get("netOperatingCashFlow")),
            "grossMargin": status_for("grossMargin", derived.get("grossMargin")),
            "researchExpenseRatio": status_for("researchExpenseRatio", derived.get("researchExpenseRatio")),
            "accountsReceivable": status_for("accountsReceivable", balance.get("accountsReceivable")),
            "inventory": status_for("inventory", balance.get("inventory")),
        },
        "detailPath": f"{PUBLIC_RELATIVE_DIR}/{record['id']}.json",
    }


def write_staged_artifacts(items: dict[str, dict[str, Any]], generated_at: str, stage_root: Path) -> tuple[Path, Path, Path]:
    detail_dir = stage_root / "a-share-financials"
    detail_dir.mkdir(parents=True, exist_ok=False)
    summary_items: dict[str, dict[str, Any]] = {}
    manifest_items: list[dict[str, Any]] = []
    for stock_id, record in sorted(items.items()):
        if stock_id != record.get("id") or not stock_id.replace("-", "").replace("_", "").isalnum():
            raise ValueError(f"unsafe or mismatched stock id: {stock_id}")
        detail_path = detail_dir / f"{stock_id}.json"
        payload = json_bytes(detail_document(record))
        detail_path.write_bytes(payload)
        summary = build_financial_summary(record)
        summary_items[stock_id] = summary
        manifest_items.append({
            "id": stock_id,
            "stockCode": record["stockCode"],
            "relativePath": summary["detailPath"],
            "byteSize": len(payload),
            "checksumSha256": hashlib.sha256(payload).hexdigest(),
            "latestReportPeriod": summary["latestReportPeriod"],
            "status": record["status"],
        })
    summary_document = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "provider": PROVIDER,
        "providerVersion": PROVIDER_VERSION,
        "summary": build_summary(items),
        "items": summary_items,
    }
    status_counts = {
        "success": sum(record["status"] == "success" for record in items.values()),
        "partial": sum(record["status"] == "partial" for record in items.values()),
        "error": sum(record["status"] not in {"success", "partial"} for record in items.values()),
    }
    manifest_document = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": generated_at,
        "provider": PROVIDER,
        "providerVersion": PROVIDER_VERSION,
        "total": len(items),
        **status_counts,
        "items": manifest_items,
    }
    summary_path = stage_root / SUMMARY_FILENAME
    manifest_path = detail_dir / MANIFEST_FILENAME
    summary_path.write_bytes(json_bytes(summary_document))
    manifest_path.write_bytes(json_bytes(manifest_document))
    return summary_path, manifest_path, detail_dir


def validate_split_artifacts(summary_path: Path, manifest_path: Path, detail_dir: Path, expected_ids: set[str]) -> list[str]:
    errors: list[str] = []
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"), parse_constant=_reject_constant)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"), parse_constant=_reject_constant)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return [f"unable to load split artifacts: {exc}"]
    summary_items = summary.get("items", {})
    manifest_items = manifest.get("items", [])
    if summary.get("schemaVersion") != SCHEMA_VERSION or manifest.get("schemaVersion") != SCHEMA_VERSION:
        errors.append("split artifact schemaVersion mismatch")
    if set(summary_items) != expected_ids:
        errors.append(f"summary coverage mismatch: expected {len(expected_ids)}, got {len(summary_items)}")
    if manifest.get("total") != len(expected_ids) or len(manifest_items) != len(expected_ids):
        errors.append("manifest total does not match expected company count")
    ids = [entry.get("id") for entry in manifest_items]
    codes = [entry.get("stockCode") for entry in manifest_items]
    paths = [entry.get("relativePath") for entry in manifest_items]
    if len(ids) != len(set(ids)) or len(codes) != len(set(codes)) or len(paths) != len(set(paths)):
        errors.append("manifest contains duplicate id, stockCode, or relativePath")
    if ids != sorted(ids):
        errors.append("manifest items are not stably sorted by id")
    referenced_files: set[str] = set()
    status_counts = {"success": 0, "partial": 0, "error": 0}
    for entry in manifest_items:
        stock_id = entry.get("id")
        relative = entry.get("relativePath")
        if not isinstance(stock_id, str) or not isinstance(relative, str):
            errors.append("manifest entry lacks string id/relativePath")
            continue
        pure_path = PurePosixPath(relative)
        expected_relative = f"{PUBLIC_RELATIVE_DIR}/{stock_id}.json"
        if pure_path.is_absolute() or ".." in pure_path.parts or relative != expected_relative:
            errors.append(f"unsafe or unexpected manifest path: {relative}")
            continue
        detail_path = detail_dir / f"{stock_id}.json"
        referenced_files.add(detail_path.name)
        if not detail_path.is_file():
            errors.append(f"missing detail file: {stock_id}")
            continue
        payload = detail_path.read_bytes()
        if entry.get("byteSize") != len(payload):
            errors.append(f"byteSize mismatch: {stock_id}")
        if entry.get("checksumSha256") != hashlib.sha256(payload).hexdigest():
            errors.append(f"checksum mismatch: {stock_id}")
        try:
            detail = json.loads(payload, parse_constant=_reject_constant)
        except (ValueError, json.JSONDecodeError) as exc:
            errors.append(f"invalid detail JSON {stock_id}: {exc}")
            continue
        summary_item = summary_items.get(stock_id, {})
        latest = detail.get("reports", [None])[0] if detail.get("reports") else None
        identity_valid = detail.get("schemaVersion") == SCHEMA_VERSION and detail.get("id") == stock_id and detail.get("stockCode") == entry.get("stockCode")
        if not identity_valid:
            errors.append(f"detail identity/schema mismatch: {stock_id}")
            continue
        if summary_item.get("stockCode") != detail.get("stockCode") or summary_item.get("detailPath") != relative:
            errors.append(f"summary identity/path mismatch: {stock_id}")
        if summary_item.get("latestReportPeriod") != (latest or {}).get("reportPeriod") or entry.get("latestReportPeriod") != (latest or {}).get("reportPeriod"):
            errors.append(f"latest report period mismatch: {stock_id}")
        expected_summary = build_financial_summary(detail)
        if summary_item != expected_summary:
            errors.append(f"summary latest values mismatch: {stock_id}")
        status = detail.get("status")
        status_counts[status if status in {"success", "partial"} else "error"] += 1
    actual_files = {path.name for path in detail_dir.glob("*.json") if path.name != MANIFEST_FILENAME}
    if actual_files != referenced_files:
        errors.append(f"orphan or missing detail files: actual={len(actual_files)} referenced={len(referenced_files)}")
    for key, value in status_counts.items():
        if manifest.get(key) != value:
            errors.append(f"manifest {key} count mismatch")
    for value in _walk_values({"summary": summary, "manifest": manifest}):
        if isinstance(value, float) and not math.isfinite(value):
            errors.append("non-finite value in summary or manifest")
    return sorted(set(errors))


def publish_staged_artifacts(stage_summary: Path, stage_detail_dir: Path, summary_output: Path, detail_output: Path, cache_root: Path) -> None:
    backup_dir = cache_root / f"a-share-financial-backup-{uuid.uuid4().hex}"
    detail_output.parent.mkdir(parents=True, exist_ok=True)
    summary_output.parent.mkdir(parents=True, exist_ok=True)
    had_existing_detail = detail_output.exists()
    try:
        if had_existing_detail:
            os.replace(detail_output, backup_dir)
        os.replace(stage_detail_dir, detail_output)
        os.replace(stage_summary, summary_output)
    except Exception:
        if detail_output.exists():
            shutil.rmtree(detail_output)
        if had_existing_detail and backup_dir.exists():
            os.replace(backup_dir, detail_output)
        raise
    finally:
        if backup_dir.exists():
            shutil.rmtree(backup_dir)


def load_existing_split_items(detail_dir: Path) -> dict[str, dict[str, Any]]:
    manifest_path = detail_dir / MANIFEST_FILENAME
    if not manifest_path.exists():
        return {}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    items: dict[str, dict[str, Any]] = {}
    for entry in manifest.get("items", []):
        stock_id = entry.get("id")
        if not isinstance(stock_id, str):
            continue
        detail_path = detail_dir / f"{stock_id}.json"
        if detail_path.is_file():
            detail = json.loads(detail_path.read_text(encoding="utf-8"))
            detail.pop("schemaVersion", None)
            items[stock_id] = detail
    return items


def _reject_constant(value: str):
    raise ValueError(f"non-finite JSON constant: {value}")


def _walk_values(value: Any):
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk_values(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_values(child)
    else:
        yield value
