from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from .catalog import utc_now_iso
from .collectors import (
    DownloadFailure,
    artifact_from_download,
    decode_html,
    fetch_resource,
    parse_csrc_report_page,
    parse_pboc_afre_stock_page,
    parse_pboc_m2_page,
)
from .hashing import atomic_write_bytes
from .models import ParseStatus


def _relative_to_repo(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError as exc:
        raise ValueError("live probe 输出目录必须位于项目根目录内") from exc


def _save_resource(
    resource: Any,
    target: Path,
    *,
    repo_root: Path,
    source_id: str,
    publication_datetime: str | None,
    publication_date: str | None,
    release_available_at: str,
    release_confidence_class: str,
    parse_status: str,
) -> dict[str, Any]:
    atomic_write_bytes(target, resource.body)
    return artifact_from_download(
        resource,
        source_id=source_id,
        local_path=_relative_to_repo(target, repo_root),
        publication_datetime=publication_datetime,
        publication_date=publication_date,
        release_available_at=release_available_at,
        release_confidence_class=release_confidence_class,
        parse_status=parse_status,
    )


def _probe_pboc_pages(
    entries: list[dict[str, Any]],
    *,
    kind: str,
    parser: Callable[[str, str], dict[str, Any]],
    output_root: Path,
    repo_root: Path,
    artifacts: list[dict[str, Any]],
    failures: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    releases: list[dict[str, Any]] = []
    for entry in entries:
        sample_id = str(entry.get("sampleId", "unknown"))
        url = str(entry.get("pageUrl", ""))
        try:
            resource = fetch_resource(url)
            parsed = parser(decode_html(resource.body, resource.content_type), url)
            confidence_override = entry.get("releaseConfidenceClassOverride")
            if confidence_override:
                parsed["releaseConfidenceClass"] = confidence_override
                if confidence_override == "BACKCAST_RELEASED_LATER":
                    parsed["containsBackcast"] = True
            target = output_root / "raw" / kind / f"{sample_id}.html"
            artifact = _save_resource(
                resource,
                target,
                repo_root=repo_root,
                source_id=parsed["sourceId"],
                publication_datetime=parsed["publicationDateTime"],
                publication_date=parsed["publicationDate"],
                release_available_at=parsed["releaseAvailableAt"],
                release_confidence_class=parsed["releaseConfidenceClass"],
                parse_status=ParseStatus.PARSED.value,
            )
            artifacts.append(artifact)
            releases.append({**parsed, "rawArtifactId": artifact["artifactId"]})
        except (DownloadFailure, ValueError, OSError) as exc:
            failures.append(
                {
                    "sourceKind": kind,
                    "sampleId": sample_id,
                    "sourceUrl": url,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
    return releases


def _probe_csrc_reports(
    entries: list[dict[str, Any]],
    *,
    output_root: Path,
    repo_root: Path,
    artifacts: list[dict[str, Any]],
    failures: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    reports: list[dict[str, Any]] = []
    for entry in entries:
        sample_id = str(entry.get("sampleId", "unknown"))
        page_url = str(entry.get("pageUrl", ""))
        try:
            page_resource = fetch_resource(page_url)
            report = parse_csrc_report_page(
                decode_html(page_resource.body, page_resource.content_type),
                page_url,
                publication_date_fallback=entry.get("publicationDate"),
                expected_period=entry.get("reportPeriod"),
            )
            page_target = output_root / "raw" / "csrc-monthly" / f"{sample_id}.html"
            page_artifact = _save_resource(
                page_resource,
                page_target,
                repo_root=repo_root,
                source_id=report["sourceId"],
                publication_datetime=report["publicationDateTime"],
                publication_date=report["publicationDate"],
                release_available_at=report["releaseAvailableAt"],
                release_confidence_class=report["releaseConfidenceClass"],
                parse_status=ParseStatus.INDEXED.value,
            )
            artifacts.append(page_artifact)

            attachment_resource = fetch_resource(report["attachmentUrl"])
            extension = Path(report["fileName"]).suffix.lower() or ".bin"
            attachment_target = output_root / "raw" / "csrc-monthly" / f"{sample_id}{extension}"
            attachment_artifact = _save_resource(
                attachment_resource,
                attachment_target,
                repo_root=repo_root,
                source_id=report["sourceId"],
                publication_datetime=report["publicationDateTime"],
                publication_date=report["publicationDate"],
                release_available_at=report["releaseAvailableAt"],
                release_confidence_class=report["releaseConfidenceClass"],
                parse_status=ParseStatus.FIELD_SCHEMA_PROBE_REQUIRED.value,
            )
            artifacts.append(attachment_artifact)
            reports.append(
                {
                    **report,
                    "downloadStatus": "DOWNLOADED",
                    "pageArtifactId": page_artifact["artifactId"],
                    "rawArtifactId": attachment_artifact["artifactId"],
                    "sha256": attachment_artifact["sha256"],
                    "byteSize": attachment_artifact["byteSize"],
                    "contentType": attachment_artifact["contentType"],
                    "parseStatus": ParseStatus.FIELD_SCHEMA_PROBE_REQUIRED.value,
                }
            )
        except (DownloadFailure, ValueError, OSError) as exc:
            failures.append(
                {
                    "sourceKind": "csrc-monthly",
                    "sampleId": sample_id,
                    "sourceUrl": page_url,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )
    return reports


def run_live_probe(plan: dict[str, Any], *, output_root: Path, repo_root: Path) -> dict[str, Any]:
    artifacts: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    output_root.mkdir(parents=True, exist_ok=True)

    m2_releases = _probe_pboc_pages(
        plan.get("pbocM2Pages", []),
        kind="pboc-m2",
        parser=parse_pboc_m2_page,
        output_root=output_root,
        repo_root=repo_root,
        artifacts=artifacts,
        failures=failures,
    )
    afre_releases = _probe_pboc_pages(
        plan.get("pbocAfreStockPages", []),
        kind="pboc-afre-stock",
        parser=parse_pboc_afre_stock_page,
        output_root=output_root,
        repo_root=repo_root,
        artifacts=artifacts,
        failures=failures,
    )
    csrc_reports = _probe_csrc_reports(
        plan.get("csrcMonthlyReports", []),
        output_root=output_root,
        repo_root=repo_root,
        artifacts=artifacts,
        failures=failures,
    )

    expected_m2 = len(plan.get("pbocM2Pages", []))
    expected_afre = len(plan.get("pbocAfreStockPages", []))
    expected_csrc = len(plan.get("csrcMonthlyReports", []))
    return {
        "schemaVersion": "1.0.0",
        "generatedAt": utc_now_iso(),
        "sourceStatus": {
            "PBC_M2": "PASS" if expected_m2 > 0 and len(m2_releases) == expected_m2 else "PARTIAL",
            "PBC_AFRE_STOCK": "PARTIAL",
            "CSRC_MONTHLY_REPORTS": "PARTIAL",
            "SSE_SZSE_BSE_MARKET_STATS": "PARTIAL",
            "CSI300_HISTORICAL_TTM_PE": "NO_GO",
        },
        "probeCounts": {
            "m2": {"expected": expected_m2, "succeeded": len(m2_releases)},
            "afreStock": {"expected": expected_afre, "succeeded": len(afre_releases)},
            "csrcMonthlyReports": {"expected": expected_csrc, "succeeded": len(csrc_reports)},
        },
        "artifacts": sorted(artifacts, key=lambda item: item["artifactId"]),
        "m2Releases": sorted(m2_releases, key=lambda item: (item["valueDate"], item["sourceUrl"])),
        "afreStockReleases": sorted(afre_releases, key=lambda item: (item["valueDate"], item["sourceUrl"])),
        "csrcReports": sorted(csrc_reports, key=lambda item: (item["reportPeriod"], item["pageUrl"])),
        "failures": failures,
        "notes": [
            "live probe 与离线测试相互独立；网络失败不会进入普通测试。",
            "失败下载不生成 RawSourceArtifact。",
            "CSRC 附件仅保留并校验 hash；字段解析仍为 FIELD_SCHEMA_PROBE_REQUIRED。",
        ],
    }


def write_probe_result(path: Path, result: dict[str, Any]) -> None:
    payload = (json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n").encode("utf-8")
    atomic_write_bytes(path, payload)
