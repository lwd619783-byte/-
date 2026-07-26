from __future__ import annotations

import hmac
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from .provenance import canonical_bytes, sha256_bytes

LEGACY_ANCHOR_SCHEMA_VERSION = "1.0.0"
LEGACY_RUN_SCHEMA_VERSION = "1.0.0"
LEGACY_ANCHOR_PATH = Path(__file__).resolve().parents[2] / "config/provider-observation-legacy-v1-anchors.json"
LOWER_HEX_64 = re.compile(r"^[0-9a-f]{64}$")
SAFE_RUN_ID = re.compile(r"^[A-Za-z0-9._-]+$")
EXPECTED_LEGACY_PROVIDERS = {
    "20260712T035210Z-a-share-financials-7a8b6917": "a-share-financials",
    "20260712T035326Z-a-share-announcements-10d36e4e": "a-share-announcements",
}
ANCHOR_FIELDS = {"runId", "providerId", "startedAt", "canonicalRecordSha256"}


def canonical_record_sha256(record: dict[str, Any]) -> str:
    return sha256_bytes(canonical_bytes(record))


def _validate_started_at(value: Any) -> None:
    if not isinstance(value, str):
        raise ValueError("legacy anchor startedAt must be a string")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("legacy anchor startedAt is invalid") from exc
    if parsed.utcoffset() is None:
        raise ValueError("legacy anchor startedAt must be timezone-aware")


def validate_legacy_anchor_config(
    document: Any,
    expected_providers: dict[str, str] | None = None,
) -> dict[str, dict[str, str]]:
    if not isinstance(document, dict) or set(document) != {"schemaVersion", "records"}:
        raise ValueError("legacy anchor config fields are invalid")
    if document["schemaVersion"] != LEGACY_ANCHOR_SCHEMA_VERSION:
        raise ValueError("legacy anchor config schemaVersion mismatch")
    records = document["records"]
    if not isinstance(records, list) or not records:
        raise ValueError("legacy anchor records must be a non-empty array")

    anchors: dict[str, dict[str, str]] = {}
    for index, anchor in enumerate(records):
        if not isinstance(anchor, dict) or set(anchor) != ANCHOR_FIELDS:
            raise ValueError(f"legacy anchor {index} fields are invalid")
        run_id = anchor["runId"]
        provider_id = anchor["providerId"]
        digest = anchor["canonicalRecordSha256"]
        if not isinstance(run_id, str) or not SAFE_RUN_ID.fullmatch(run_id):
            raise ValueError(f"legacy anchor {index} runId is invalid")
        if run_id in anchors:
            raise ValueError(f"duplicate legacy anchor runId: {run_id}")
        if provider_id not in {"a-share-financials", "a-share-announcements"}:
            raise ValueError(f"legacy anchor {run_id} providerId is invalid")
        _validate_started_at(anchor["startedAt"])
        if not isinstance(digest, str) or not LOWER_HEX_64.fullmatch(digest):
            raise ValueError(f"legacy anchor {run_id} digest is invalid")
        anchors[run_id] = dict(anchor)

    if expected_providers is not None:
        if set(anchors) != set(expected_providers):
            raise ValueError("legacy anchor config does not contain the committed runId set")
        for run_id, provider_id in expected_providers.items():
            if anchors[run_id]["providerId"] != provider_id:
                raise ValueError(f"legacy anchor {run_id} providerId mismatch")
    return anchors


def load_legacy_anchors(path: Path = LEGACY_ANCHOR_PATH) -> dict[str, dict[str, str]]:
    try:
        document = json.loads(
            path.read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"legacy anchor config is unreadable: {exc}") from exc
    return validate_legacy_anchor_config(document, EXPECTED_LEGACY_PROVIDERS)


def validate_legacy_run(record: Any, anchors: dict[str, dict[str, str]]) -> None:
    if not isinstance(record, dict):
        raise ValueError("legacy run must be an object")
    if record.get("schemaVersion") != LEGACY_RUN_SCHEMA_VERSION:
        raise ValueError("legacy run schemaVersion mismatch")
    run_id = record.get("runId")
    anchor = anchors.get(run_id) if isinstance(run_id, str) else None
    if anchor is None:
        raise ValueError("unknown legacy runId")
    if record.get("providerId") != anchor["providerId"]:
        raise ValueError("legacy anchor providerId mismatch")
    if record.get("startedAt") != anchor["startedAt"]:
        raise ValueError("legacy anchor startedAt mismatch")
    actual_digest = canonical_record_sha256(record)
    if not hmac.compare_digest(actual_digest, anchor["canonicalRecordSha256"]):
        raise ValueError("legacy anchor canonicalRecordSha256 mismatch")


def looks_like_schema_downgrade(record: Any) -> bool:
    if not isinstance(record, dict) or record.get("schemaVersion") != LEGACY_RUN_SCHEMA_VERSION:
        return False
    metrics = record.get("metrics")
    atomicity = record.get("atomicity")
    return (
        "provenance" in record
        or (isinstance(metrics, dict) and "eligibleSample" in metrics)
        or (
            isinstance(atomicity, dict)
            and ("beforeChecksum" in atomicity or "afterChecksum" in atomicity)
        )
    )
