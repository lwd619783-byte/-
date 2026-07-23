from __future__ import annotations

import hashlib
import hmac
import json
import re
import subprocess
from pathlib import Path
from typing import Any

OBSERVATION_TOOL_VERSION = "2.0.0"
UNAVAILABLE = "unavailable"
LOWER_HEX_40 = re.compile(r"^[0-9a-f]{40}$")
LOWER_HEX_64 = re.compile(r"^[0-9a-f]{64}$")

PROVIDER_FILES = {
    "a-share-financials": [
        "scripts/fetch-a-share-financials.py",
        "scripts/a_share_financials/__init__.py",
        "scripts/a_share_financials/artifacts.py",
        "scripts/a_share_financials/core.py",
        "scripts/a_share_financials/provider.py",
    ],
    "a-share-announcements": [
        "scripts/fetch-a-share-announcements.py",
        "scripts/a_share_announcements/__init__.py",
        "scripts/a_share_announcements/artifacts.py",
        "scripts/a_share_announcements/core.py",
        "scripts/a_share_announcements/provider.py",
    ],
}

FETCH_FILES = {
    "a-share-financials": ["scripts/fetch-a-share-financials.py"],
    "a-share-announcements": ["scripts/fetch-a-share-announcements.py"],
}

VALIDATOR_FILES = {
    "a-share-financials": [
        "scripts/validate-a-share-financials.py",
        "scripts/a_share_financials/artifacts.py",
    ],
    "a-share-announcements": [
        "scripts/validate-a-share-announcements.py",
        "scripts/a_share_announcements/artifacts.py",
    ],
}

PRODUCTION_FILES = {
    "a-share-financials": [
        "src/data/real/a-share-financial-summaries.generated.json",
        "public/data/a-share-financials",
    ],
    "a-share-announcements": [
        "src/data/real/a-share-announcement-summaries.generated.json",
        "public/data/a-share-announcements",
    ],
}

OBSERVATION_TOOL_FILES = [
    "scripts/observe-providers.py",
    "scripts/provider-health.py",
    "scripts/provider_observability/__init__.py",
    "scripts/provider_observability/core.py",
    "scripts/provider_observability/production.py",
    "scripts/provider_observability/provenance.py",
    "scripts/data-audit.mjs",
    "config/provider-observation-run.schema.json",
    "package.json",
]

DEPENDENCY_FILES = [
    "requirements-financial-test.txt",
    "requirements-announcement-provider.txt",
    "requirements-provider-observability-test.txt",
    "package-lock.json",
]

COHORT_FIELDS = (
    "observationToolVersion",
    "observationToolChecksum",
    "providerCodeChecksum",
    "fetchScriptChecksum",
    "validatorChecksum",
    "stockUniverseChecksum",
    "stockUniverseIdentityCount",
    "gateConfigChecksum",
    "productionBaselineChecksum",
    "dependencyFingerprint",
)
REQUIRED_PROVENANCE_FIELDS = set(COHORT_FIELDS) | {"sourceCommitSha", "provenanceCohortId"}
CHECKSUM_FIELDS = tuple(
    field for field in COHORT_FIELDS if field.endswith("Checksum") or field == "dependencyFingerprint"
)


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _files(root: Path, relative_paths: list[str]) -> list[Path]:
    result: list[Path] = []
    for relative in relative_paths:
        path = root / relative
        if not path.exists():
            raise FileNotFoundError(relative)
        if path.is_dir():
            result.extend(item for item in path.rglob("*") if item.is_file())
        else:
            result.append(path)
    return sorted(set(result), key=lambda path: path.relative_to(root).as_posix())


def file_set_checksum(root: Path, relative_paths: list[str]) -> str:
    digest = hashlib.sha256()
    for path in _files(root, relative_paths):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def source_commit_sha(root: Path) -> str:
    process = subprocess.run(
        ["git", "rev-parse", "--verify", "HEAD"],
        cwd=root,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    value = process.stdout.strip().lower()
    return value if process.returncode == 0 and len(value) == 40 and all(char in "0123456789abcdef" for char in value) else UNAVAILABLE


def stock_universe_identity(root: Path) -> tuple[str, int]:
    document = json.loads((root / "src/data/real/stock-universe.generated.json").read_text(encoding="utf-8"))
    identities = [
        {
            "id": item.get("id"),
            "code": item.get("code"),
            "exchange": item.get("exchange"),
            "market": item.get("market"),
            "shouldFetchFinancials": item.get("shouldFetchFinancials", True),
            "shouldFetchAnnouncements": item.get("shouldFetchAnnouncements", True),
        }
        for item in document.get("items", [])
        if item.get("market") == "A股"
    ]
    identities.sort(key=lambda item: (str(item["id"]), str(item["code"]), str(item["exchange"])))
    if any(not item["id"] or not item["code"] or not item["exchange"] for item in identities):
        raise ValueError("stock universe contains incomplete A-share identity")
    return sha256_bytes(canonical_bytes(identities)), len(identities)


def cohort_id(provenance: dict[str, Any]) -> str:
    return sha256_bytes(canonical_bytes({field: provenance.get(field) for field in COHORT_FIELDS}))


def build_provenance(root: Path, provider_id: str) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    values: dict[str, Any] = {
        "sourceCommitSha": source_commit_sha(root),
        "observationToolVersion": OBSERVATION_TOOL_VERSION,
    }
    if values["sourceCommitSha"] == UNAVAILABLE:
        errors.append("source commit SHA is unavailable")

    operations = {
        "observationToolChecksum": lambda: file_set_checksum(root, OBSERVATION_TOOL_FILES),
        "providerCodeChecksum": lambda: file_set_checksum(root, PROVIDER_FILES[provider_id]),
        "fetchScriptChecksum": lambda: file_set_checksum(root, FETCH_FILES[provider_id]),
        "validatorChecksum": lambda: file_set_checksum(root, VALIDATOR_FILES[provider_id]),
        "gateConfigChecksum": lambda: file_set_checksum(root, ["config/provider-stability-gate-v1.json"]),
        "productionBaselineChecksum": lambda: file_set_checksum(root, PRODUCTION_FILES[provider_id]),
        "dependencyFingerprint": lambda: file_set_checksum(root, DEPENDENCY_FILES),
    }
    for field, operation in operations.items():
        try:
            values[field] = operation()
        except (OSError, ValueError, KeyError) as exc:
            values[field] = UNAVAILABLE
            errors.append(f"{field}: {exc}")

    try:
        values["stockUniverseChecksum"], values["stockUniverseIdentityCount"] = stock_universe_identity(root)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        values["stockUniverseChecksum"] = UNAVAILABLE
        values["stockUniverseIdentityCount"] = 0
        errors.append(f"stockUniverseChecksum: {exc}")

    values["provenanceCohortId"] = cohort_id(values) if not errors else UNAVAILABLE
    return values, errors


def build_current_provenance(root: Path, provider_ids: list[str]) -> tuple[dict[str, dict[str, Any]], dict[str, list[str]]]:
    values: dict[str, dict[str, Any]] = {}
    failures: dict[str, list[str]] = {}
    for provider_id in provider_ids:
        provenance, errors = build_provenance(root, provider_id)
        values[provider_id] = provenance
        if errors:
            failures[provider_id] = errors
    return values, failures


def valid_provenance(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    if REQUIRED_PROVENANCE_FIELDS - value.keys():
        return False
    if value.get("observationToolVersion") != OBSERVATION_TOOL_VERSION:
        return False
    if not isinstance(value.get("sourceCommitSha"), str) or not LOWER_HEX_40.fullmatch(value["sourceCommitSha"]):
        return False
    identity_count = value.get("stockUniverseIdentityCount")
    if isinstance(identity_count, bool) or not isinstance(identity_count, int) or identity_count <= 0:
        return False
    checksum_fields = [*CHECKSUM_FIELDS, "provenanceCohortId"]
    if any(
        not isinstance(value.get(field), str)
        or value[field] == UNAVAILABLE
        or not LOWER_HEX_64.fullmatch(value[field])
        for field in checksum_fields
    ):
        return False
    return hmac.compare_digest(value["provenanceCohortId"], cohort_id(value))


def recordable_provenance(value: Any) -> bool:
    """Accept either complete V2 provenance or a structured unavailable snapshot."""
    if valid_provenance(value):
        return True
    if not isinstance(value, dict) or set(value) != REQUIRED_PROVENANCE_FIELDS:
        return False
    if value.get("observationToolVersion") != OBSERVATION_TOOL_VERSION:
        return False

    source_sha = value.get("sourceCommitSha")
    if not isinstance(source_sha, str) or (
        source_sha != UNAVAILABLE and not LOWER_HEX_40.fullmatch(source_sha)
    ):
        return False
    for field in CHECKSUM_FIELDS:
        checksum = value.get(field)
        if not isinstance(checksum, str) or (
            checksum != UNAVAILABLE and not LOWER_HEX_64.fullmatch(checksum)
        ):
            return False

    identity_count = value.get("stockUniverseIdentityCount")
    if isinstance(identity_count, bool) or not isinstance(identity_count, int) or identity_count < 0:
        return False
    stock_universe_unavailable = value["stockUniverseChecksum"] == UNAVAILABLE
    if identity_count == 0 and not stock_universe_unavailable:
        return False

    component_unavailable = source_sha == UNAVAILABLE or any(
        value[field] == UNAVAILABLE for field in CHECKSUM_FIELDS
    )
    cohort = value.get("provenanceCohortId")
    if component_unavailable:
        return cohort == UNAVAILABLE
    return False


def unavailable_provenance(value: Any) -> bool:
    return recordable_provenance(value) and not valid_provenance(value)
