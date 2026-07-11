from __future__ import annotations

import hashlib
import json
import os
import shutil
import uuid
from pathlib import Path, PurePosixPath
from typing import Any

from . import PROVIDER, PROVIDER_VERSION, SCHEMA_VERSION
from .core import reject_non_finite

SUMMARY_FILENAME = "a-share-announcement-summaries.generated.json"
MANIFEST_FILENAME = "manifest.generated.json"
PUBLIC_RELATIVE_DIR = "data/a-share-announcements"


def json_bytes(value: Any) -> bytes:
    reject_non_finite(value)
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def build_summary_item(detail: dict[str, Any]) -> dict[str, Any]:
    announcements = detail.get("announcements", [])
    recent = announcements[:5]
    performance = [item for item in announcements if item.get("category") in {"performance_forecast", "performance_forecast_revision", "performance_express", "annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary"}]
    counts: dict[str, int] = {}
    for item in announcements:
        counts[item["category"]] = counts.get(item["category"], 0) + 1
    return {
        "stockId": detail["stockId"], "stockCode": detail["stockCode"], "companyName": detail["companyName"],
        "market": "A股", "status": detail["status"], "provider": detail["provider"], "providerVersion": detail["providerVersion"],
        "fetchedAt": detail["fetchedAt"], "generatedAt": detail["generatedAt"], "lastSuccessfulFetchAt": detail.get("lastSuccessfulFetchAt"),
        "currentFetchError": detail.get("currentFetchError"), "announcementCount": len(announcements), "categoryCounts": counts,
        "latestAnnouncementDate": recent[0].get("announcementDate") if recent else None,
        "latestPerformanceAnnouncementDate": performance[0].get("announcementDate") if performance else None,
        "recentAnnouncements": [{key: item.get(key) for key in ("announcementId", "title", "category", "announcementDate", "officialUrl", "pdfUrl", "status", "parseStatus")} for item in recent],
        "latestPerformanceAnnouncement": ({key: performance[0].get(key) for key in ("announcementId", "title", "category", "announcementDate", "reportPeriod", "officialUrl", "pdfUrl", "performanceForecastEvents", "performanceExpressEvent", "reasonSummary", "parseStatus")} if performance else None),
        "detailPath": f"{PUBLIC_RELATIVE_DIR}/{detail['stockId']}.json",
        "quality": detail["quality"],
    }


def write_staged_artifacts(items: dict[str, dict[str, Any]], stage_root: Path, generated_at: str) -> tuple[Path, Path, dict[str, Any]]:
    stage_summary = stage_root / SUMMARY_FILENAME
    stage_detail = stage_root / "a-share-announcements"
    stage_detail.mkdir(parents=True, exist_ok=True)
    summaries: dict[str, Any] = {}
    manifest_items: list[dict[str, Any]] = []
    total_announcements = 0
    all_dates: list[str] = []
    status_counts = {"success": 0, "partial": 0, "error": 0, "empty": 0}
    for stock_id in sorted(items):
        detail = {"schemaVersion": SCHEMA_VERSION, **items[stock_id]}
        payload = json_bytes(detail)
        path = stage_detail / f"{stock_id}.json"
        path.write_bytes(payload)
        summary = build_summary_item(detail)
        summaries[stock_id] = summary
        dates = [item["announcementDate"] for item in detail.get("announcements", []) if item.get("announcementDate")]
        all_dates.extend(dates)
        total_announcements += len(detail.get("announcements", []))
        status = detail.get("status") if detail.get("status") in status_counts else "error"
        status_counts[status] += 1
        performance_dates = [item["announcementDate"] for item in detail.get("announcements", []) if item.get("announcementDate") and item.get("category") in {"performance_forecast", "performance_forecast_revision", "performance_express", "annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary"}]
        manifest_items.append({"stockId": stock_id, "stockCode": detail["stockCode"], "relativePath": summary["detailPath"], "byteSize": len(payload), "checksumSha256": hashlib.sha256(payload).hexdigest(), "announcementCount": len(detail.get("announcements", [])), "latestAnnouncementDate": max(dates) if dates else None, "latestPerformanceAnnouncementDate": max(performance_dates) if performance_dates else None, "status": status})
    summary_doc = {"schemaVersion": SCHEMA_VERSION, "generatedAt": generated_at, "provider": PROVIDER, "providerVersion": PROVIDER_VERSION, "items": summaries}
    manifest = {"schemaVersion": SCHEMA_VERSION, "generatedAt": generated_at, "provider": PROVIDER, "providerVersion": PROVIDER_VERSION, "totalCompanies": len(items), "totalAnnouncements": total_announcements, "dateRange": {"start": min(all_dates) if all_dates else None, "end": max(all_dates) if all_dates else None}, **status_counts, "items": manifest_items}
    stage_summary.write_bytes(json_bytes(summary_doc))
    (stage_detail / MANIFEST_FILENAME).write_bytes(json_bytes(manifest))
    return stage_summary, stage_detail, manifest


def validate_artifacts(summary_path: Path, detail_dir: Path, expected_ids: set[str]) -> list[str]:
    errors: list[str] = []
    try:
        summary = json.loads(summary_path.read_text(encoding="utf-8"), parse_constant=_reject_constant)
        manifest = json.loads((detail_dir / MANIFEST_FILENAME).read_text(encoding="utf-8"), parse_constant=_reject_constant)
    except Exception as exc:
        return [f"unable to load announcement artifacts: {exc}"]
    summary_items = summary.get("items", {})
    entries = manifest.get("items", [])
    if summary.get("schemaVersion") != SCHEMA_VERSION or manifest.get("schemaVersion") != SCHEMA_VERSION: errors.append("schemaVersion mismatch")
    if set(summary_items) != expected_ids: errors.append("summary company coverage mismatch")
    if manifest.get("totalCompanies") != len(expected_ids) or len(entries) != len(expected_ids): errors.append("manifest company count mismatch")
    ids = [entry.get("stockId") for entry in entries]; codes = [entry.get("stockCode") for entry in entries]; paths = [entry.get("relativePath") for entry in entries]
    if len(ids) != len(set(ids)) or len(codes) != len(set(codes)) or len(paths) != len(set(paths)): errors.append("duplicate manifest identity/path")
    if ids != sorted(ids): errors.append("manifest not stably sorted")
    referenced: set[str] = set(); total = 0
    for entry in entries:
        stock_id = entry.get("stockId"); relative = entry.get("relativePath")
        if not isinstance(stock_id, str) or not isinstance(relative, str): errors.append("invalid manifest entry"); continue
        pure = PurePosixPath(relative)
        if pure.is_absolute() or ".." in pure.parts or relative != f"{PUBLIC_RELATIVE_DIR}/{stock_id}.json": errors.append(f"unsafe path: {relative}"); continue
        detail_path = detail_dir / f"{stock_id}.json"; referenced.add(detail_path.name)
        if not detail_path.is_file(): errors.append(f"missing detail: {stock_id}"); continue
        payload = detail_path.read_bytes()
        if len(payload) != entry.get("byteSize"): errors.append(f"byteSize mismatch: {stock_id}")
        if hashlib.sha256(payload).hexdigest() != entry.get("checksumSha256"): errors.append(f"checksum mismatch: {stock_id}")
        try: detail = json.loads(payload, parse_constant=_reject_constant)
        except Exception as exc: errors.append(f"invalid detail {stock_id}: {exc}"); continue
        if detail.get("stockId") != stock_id or detail.get("stockCode") != entry.get("stockCode"): errors.append(f"identity mismatch: {stock_id}")
        anns = detail.get("announcements", []); total += len(anns)
        if entry.get("announcementCount") != len(anns): errors.append(f"announcement count mismatch: {stock_id}")
        expected_summary = build_summary_item(detail)
        if summary_items.get(stock_id) != expected_summary: errors.append(f"summary mismatch: {stock_id}")
        announcement_ids = [item.get("announcementId") for item in anns]
        if len(announcement_ids) != len(set(announcement_ids)): errors.append(f"duplicate announcement ids: {stock_id}")
        for item in anns:
            if item.get("category") not in {"performance_forecast", "performance_forecast_revision", "performance_express", "annual_report", "semi_annual_report", "quarterly_report", "periodic_report_summary", "correction", "investor_relations", "major_contract", "share_repurchase", "shareholding_change", "equity_incentive", "financing", "merger_acquisition", "regulatory", "other", "unknown"}: errors.append(f"invalid category: {stock_id}")
            if not item.get("officialUrl") or "cninfo.com.cn" not in item["officialUrl"]: errors.append(f"invalid official URL: {stock_id}")
            if item.get("parseStatus") == "parse_success" and item.get("announcementParsingResult", {}).get("evidenceCount", 0) <= 0: errors.append(f"parse_success without evidence: {stock_id}")
            if item.get("parseStatus") == "parse_unavailable" and (item.get("performanceForecastEvents") or item.get("performanceExpressEvent")): errors.append(f"unavailable parse has structured fields: {stock_id}")
            for event in item.get("performanceForecastEvents", []):
                if event.get("lowerBound") is not None and event.get("upperBound") is not None and event["lowerBound"] > event["upperBound"]: errors.append(f"invalid forecast range: {stock_id}")
                if not event.get("sourceTextEvidence"): errors.append(f"forecast evidence missing: {stock_id}")
            for reason in item.get("reasonItems", []):
                if reason.get("summary") and not reason.get("evidenceText"): errors.append(f"reason evidence missing: {stock_id}")
    actual = {path.name for path in detail_dir.glob("*.json") if path.name != MANIFEST_FILENAME}
    if actual != referenced: errors.append("orphan or missing detail files")
    if manifest.get("totalAnnouncements") != total: errors.append("manifest totalAnnouncements mismatch")
    return sorted(set(errors))


def publish(stage_summary: Path, stage_detail: Path, summary_output: Path, detail_output: Path, cache_root: Path) -> None:
    backup = cache_root / f"announcement-backup-{uuid.uuid4().hex}"
    old_summary = cache_root / f"announcement-summary-{uuid.uuid4().hex}.json"
    had_detail = detail_output.exists(); had_summary = summary_output.exists()
    detail_output.parent.mkdir(parents=True, exist_ok=True); summary_output.parent.mkdir(parents=True, exist_ok=True)
    try:
        if had_detail: os.replace(detail_output, backup)
        if had_summary: os.replace(summary_output, old_summary)
        os.replace(stage_detail, detail_output); os.replace(stage_summary, summary_output)
    except Exception:
        if detail_output.exists(): shutil.rmtree(detail_output)
        if summary_output.exists(): summary_output.unlink()
        if had_detail and backup.exists(): os.replace(backup, detail_output)
        if had_summary and old_summary.exists(): os.replace(old_summary, summary_output)
        raise
    finally:
        if backup.exists(): shutil.rmtree(backup)
        if old_summary.exists(): old_summary.unlink()


def _reject_constant(value: str):
    raise ValueError(f"non-finite JSON constant: {value}")
