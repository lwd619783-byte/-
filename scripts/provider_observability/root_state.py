from __future__ import annotations

import hmac
import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from jsonschema import Draft202012Validator, FormatChecker

from .legacy import LEGACY_ANCHOR_PATH, canonical_record_sha256
from .provenance import canonical_bytes, sha256_bytes

ROOT_STATE_FILENAME = "provider-observation-root.json"
ROOT_STATE_SCHEMA_VERSION = "1.0.0"
FRESH_V2 = "fresh_v2"
LEGACY_V1_MIGRATED = "legacy_v1_migrated"
ROOT_STATE_MODES = {FRESH_V2, LEGACY_V1_MIGRATED}
SAFE_RUN_ID = re.compile(r"^[A-Za-z0-9._-]+$")
LOWER_HEX_64 = re.compile(r"^[0-9a-f]{64}$")
UTC_TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
ROOT_STATE_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "config/provider-observation-root.schema.json"
ROOT_STATE_VALIDATOR = Draft202012Validator(
    json.loads(ROOT_STATE_SCHEMA_PATH.read_text(encoding="utf-8")),
    format_checker=FormatChecker(),
)


def root_state_path(root: Path) -> Path:
    return root / ROOT_STATE_FILENAME


def canonical_document_sha256(value: Any) -> str:
    return sha256_bytes(canonical_bytes(value))


def legacy_anchor_config_checksum(path: Path = LEGACY_ANCHOR_PATH) -> str:
    try:
        document = json.loads(
            path.read_text(encoding="utf-8"),
            parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"legacy anchor config is unreadable: {exc}") from exc
    return canonical_document_sha256(document)


def initial_evidence_records(runs: list[dict[str, Any]]) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    seen: set[str] = set()
    for run in runs:
        run_id = run.get("runId") if isinstance(run, dict) else None
        if not isinstance(run_id, str) or not SAFE_RUN_ID.fullmatch(run_id):
            raise ValueError("initial evidence contains an unsafe runId")
        if run_id in seen:
            raise ValueError(f"initial evidence contains duplicate runId: {run_id}")
        seen.add(run_id)
        records.append({
            "runId": run_id,
            "canonicalRecordSha256": canonical_record_sha256(run),
        })
    return sorted(records, key=lambda item: item["runId"])


def initial_evidence_checksum(records: list[dict[str, str]]) -> str:
    return canonical_document_sha256(records)


def build_root_state(
    mode: str,
    runs: list[dict[str, Any]],
    *,
    ledger_id: str | None = None,
    initialized_at: str | None = None,
    anchor_checksum: str | None = None,
) -> dict[str, Any]:
    if mode not in ROOT_STATE_MODES:
        raise ValueError("invalid root state mode")
    records = [] if mode == FRESH_V2 else initial_evidence_records(runs)
    if mode == LEGACY_V1_MIGRATED and not records:
        raise ValueError("legacy root state requires initial evidence")
    value = {
        "schemaVersion": ROOT_STATE_SCHEMA_VERSION,
        "ledgerId": ledger_id or str(uuid.uuid4()),
        "mode": mode,
        "initializedAt": initialized_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "legacyAnchorConfigChecksum": anchor_checksum or legacy_anchor_config_checksum(),
        "initialEvidenceRunIds": [record["runId"] for record in records],
        "initialEvidenceRecords": records,
        "initialEvidenceChecksum": initial_evidence_checksum(records),
    }
    validate_root_state(value, value["legacyAnchorConfigChecksum"])
    return value


def validate_root_state(value: Any, expected_anchor_checksum: str | None = None) -> None:
    errors = sorted(ROOT_STATE_VALIDATOR.iter_errors(value), key=lambda error: list(error.absolute_path))
    if errors:
        first = errors[0]
        location = ".".join(str(part) for part in first.absolute_path) or "$"
        raise ValueError(f"root state schema validation failed at {location}: {first.message}")
    if not isinstance(value, dict):
        raise ValueError("root state must be an object")

    ledger_id = value["ledgerId"]
    try:
        parsed_uuid = uuid.UUID(ledger_id)
    except (ValueError, AttributeError) as exc:
        raise ValueError("root state ledgerId is invalid") from exc
    if str(parsed_uuid) != ledger_id:
        raise ValueError("root state ledgerId must be canonical lowercase UUID")

    if not UTC_TIMESTAMP.fullmatch(value["initializedAt"]):
        raise ValueError("root state initializedAt must use canonical UTC second precision")
    try:
        initialized_at = datetime.fromisoformat(value["initializedAt"].replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("root state initializedAt is invalid") from exc
    if initialized_at.utcoffset() != timezone.utc.utcoffset(initialized_at):
        raise ValueError("root state initializedAt must use UTC")

    anchor_checksum = value["legacyAnchorConfigChecksum"]
    if not LOWER_HEX_64.fullmatch(anchor_checksum):
        raise ValueError("root state legacy anchor checksum is invalid")
    expected_anchor_checksum = expected_anchor_checksum or legacy_anchor_config_checksum()
    if not hmac.compare_digest(anchor_checksum, expected_anchor_checksum):
        raise ValueError("root state legacy anchor config checksum mismatch")

    run_ids = value["initialEvidenceRunIds"]
    records = value["initialEvidenceRecords"]
    record_ids = [record["runId"] for record in records]
    if run_ids != sorted(run_ids) or len(run_ids) != len(set(run_ids)):
        raise ValueError("root state initialEvidenceRunIds must be sorted and unique")
    if record_ids != sorted(record_ids) or len(record_ids) != len(set(record_ids)):
        raise ValueError("root state initialEvidenceRecords must be sorted and unique")
    if record_ids != run_ids:
        raise ValueError("root state initial evidence identities disagree")
    if any(
        not SAFE_RUN_ID.fullmatch(record["runId"])
        or not LOWER_HEX_64.fullmatch(record["canonicalRecordSha256"])
        for record in records
    ):
        raise ValueError("root state initial evidence record is invalid")
    if not hmac.compare_digest(value["initialEvidenceChecksum"], initial_evidence_checksum(records)):
        raise ValueError("root state initial evidence checksum mismatch")
    if value["mode"] == FRESH_V2 and (run_ids or records):
        raise ValueError("fresh root state cannot declare initial evidence")
    if value["mode"] == LEGACY_V1_MIGRATED and not records:
        raise ValueError("legacy root state requires initial evidence")


def load_root_state(root: Path) -> dict[str, Any] | None:
    path = root_state_path(root)
    if not path.exists():
        return None
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            parse_constant=lambda item: (_ for _ in ()).throw(ValueError(item)),
        )
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        raise ValueError(f"root state is unreadable: {exc}") from exc
    validate_root_state(value)
    return value


def root_is_truly_empty(root: Path) -> bool:
    if not root.exists():
        return True
    if not root.is_dir():
        return False
    try:
        next(root.iterdir())
    except StopIteration:
        return True
    return False


def write_root_state(
    root: Path,
    state: dict[str, Any],
    atomic_writer: Callable[[Path, bytes], None],
    json_encoder: Callable[[Any], bytes],
) -> None:
    validate_root_state(state)
    path = root_state_path(root)
    if path.exists():
        raise ValueError("root state already exists")
    atomic_writer(path, json_encoder(state))


def prepare_root_for_observation(
    root: Path,
    runs: list[dict[str, Any]],
    audit: dict[str, Any],
    atomic_writer: Callable[[Path, bytes], None],
    json_encoder: Callable[[Any], bytes],
) -> dict[str, Any]:
    if audit.get("rootStateIntegrityFailure") or audit.get("evidenceIntegrityFailure"):
        raise ValueError("observation root integrity failure")
    existing = audit.get("rootState")
    if isinstance(existing, dict):
        return existing
    if audit.get("rootStateMode") == "empty":
        state = build_root_state(FRESH_V2, [])
    elif audit.get("rootStateMigrationPending") is True:
        state = build_root_state(LEGACY_V1_MIGRATED, runs)
    else:
        raise ValueError("nonempty unidentified observation root")
    write_root_state(root, state, atomic_writer, json_encoder)
    return state
