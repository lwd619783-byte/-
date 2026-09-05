from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from .hashing import canonical_sha256


CATALOG_SCHEMA_VERSION = "1.0.0"
CATALOG_VERSION = "market-regime-observation-catalog-v1"

COLLECTIONS = (
    "sourceDefinitions",
    "artifacts",
    "observations",
    "marketScopeVersions",
    "exchangeMarketObservations",
    "providerSlots",
)
SORT_KEYS = {
    "sourceDefinitions": "sourceDefinitionId",
    "artifacts": "artifactId",
    "observations": "observationId",
    "marketScopeVersions": "marketScopeVersionId",
    "exchangeMarketObservations": "observationId",
    "providerSlots": "providerId",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _sorted_records(records: Iterable[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    return sorted((deepcopy(item) for item in records), key=lambda item: str(item.get(key, "")))


def catalog_content_projection(catalog: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": catalog.get("schemaVersion"),
        "catalogVersion": catalog.get("catalogVersion"),
        **{name: catalog.get(name, []) for name in COLLECTIONS},
    }


def derive_manifest(
    catalog: dict[str, Any],
    *,
    validation_status: str = "PASS",
    validation_errors: list[str] | None = None,
) -> dict[str, Any]:
    observations = catalog.get("observations", [])
    artifacts = catalog.get("artifacts", [])
    definitions = catalog.get("sourceDefinitions", [])
    value_dates = sorted(
        item["valueDate"] for item in observations if isinstance(item.get("valueDate"), str)
    )
    release_times = sorted(
        item["releaseAvailableAt"]
        for item in observations
        if isinstance(item.get("releaseAvailableAt"), str)
    )
    hashes = {
        "sourceDefinitionsSha256": canonical_sha256(definitions),
        "artifactsSha256": canonical_sha256(artifacts),
        "observationsSha256": canonical_sha256(observations),
        "catalogContentSha256": canonical_sha256(catalog_content_projection(catalog)),
    }
    return {
        "catalogVersion": catalog["catalogVersion"],
        "generatedAt": catalog["generatedAt"],
        "metricIds": sorted({item["metricId"] for item in observations if item.get("metricId")}),
        "sourceDefinitionIds": sorted(
            item["sourceDefinitionId"]
            for item in definitions
            if item.get("sourceDefinitionId")
        ),
        "observationCount": len(observations),
        "artifactCount": len(artifacts),
        "minValueDate": value_dates[0] if value_dates else None,
        "maxValueDate": value_dates[-1] if value_dates else None,
        "minReleaseAvailableAt": release_times[0] if release_times else None,
        "maxReleaseAvailableAt": release_times[-1] if release_times else None,
        "validationStatus": validation_status,
        "validationErrors": list(validation_errors or []),
        "contentHashes": hashes,
    }


def build_catalog(
    payload: dict[str, Any],
    *,
    generated_at: str | None = None,
) -> dict[str, Any]:
    catalog: dict[str, Any] = {
        "schemaVersion": CATALOG_SCHEMA_VERSION,
        "catalogVersion": payload.get("catalogVersion", CATALOG_VERSION),
        "generatedAt": generated_at or payload.get("generatedAt") or utc_now_iso(),
    }
    for name in COLLECTIONS:
        if name not in payload:
            raise ValueError(f"catalog input 缺少必需集合: {name}")
        value = payload[name]
        if not isinstance(value, list):
            raise ValueError(f"catalog input.{name} 必须是 array；拒绝静默替换为空集合")
        if any(not isinstance(item, dict) for item in value):
            raise ValueError(f"catalog input.{name} 的每个成员必须是 object")
        catalog[name] = _sorted_records(value, SORT_KEYS[name])

    catalog["manifest"] = derive_manifest(catalog)

    # 延迟导入，避免 validator 的 manifest 复算形成模块循环。
    from .validator import validate_catalog

    errors = validate_catalog(catalog, check_manifest=False)
    catalog["manifest"] = derive_manifest(
        catalog,
        validation_status="FAIL" if errors else "PASS",
        validation_errors=errors,
    )
    return catalog


def render_catalog(catalog: dict[str, Any]) -> str:
    return json.dumps(
        catalog,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
        allow_nan=False,
    ) + "\n"


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} 顶层必须是 JSON object")
    return value
