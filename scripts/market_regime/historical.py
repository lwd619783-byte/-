"""Offline R2 identities, frozen target grid and deterministic envelope builder.

No fetching, normalization or weekly replay. The external plan registry is required
at both build and validation boundaries; an envelope cannot invent its own plan.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date
from typing import Any

from .catalog import catalog_content_projection
from .hashing import canonical_sha256
from .historical_models import HistoricalDataset, Plan


SIDECARS = {
    "releaseEvents": "releaseEventId", "artifactBindings": "artifactId",
    "fieldExtractions": "extractionId", "coverageLedger": "cellId",
    "retrievalAttempts": "attemptId", "conflicts": "conflictId",
    "inventoryEvidence": "windowId",
    "evidenceArtifacts": "artifactId",
}


def canonical_order(value: Any) -> Any:
    """All R2 arrays are sets (revision order is explicit lineage), never byte order."""
    if isinstance(value, dict):
        return {k: canonical_order(v) for k, v in value.items()}
    if isinstance(value, list):
        from .hashing import canonical_json_bytes
        return sorted((canonical_order(v) for v in value), key=canonical_json_bytes)
    return value


def plan_projection(plan: Plan) -> dict:
    return canonical_order({k: v for k, v in plan.items() if k != "planId"})


def plan_identity(plan: Plan) -> str:
    return f"{plan['planName']}:v{plan['planVersion']}:{canonical_sha256(plan_projection(plan))}"


def release_identity(event: dict) -> str:
    # No artifact IDs here: artifacts in turn bind this identity, without a cycle.
    keys = ("sourceId", "landingUrl", "eventSection", "publicationDateTime",
            "publicationDate", "releaseAvailableAt", "releaseConfidenceClass",
            "releaseKind", "coveredPeriods")
    return "release-" + canonical_sha256(canonical_order({k: event[k] for k in keys}))


def artifact_identity(artifact: dict, release_event_id: str) -> str:
    return "artifact-r2-" + canonical_sha256({
        "sourceId": artifact["sourceId"], "sourceUrl": artifact["sourceUrl"],
        "releaseEventId": release_event_id, "sha256": artifact["sha256"],
    })


def evidence_artifact_identity(artifact: dict) -> str:
    return "evidence-r2-" + canonical_sha256({k: artifact[k] for k in
        ("sourceId", "sourceUrl", "fetchedAt", "sha256", "evidenceRole")})


def target_grid(plan: Plan) -> list[dict]:
    cells = []
    for window in plan["targetWindows"]:
        start, end = window["start"], window["end"]
        if start > end:
            raise ValueError("target window start after end")
        if window["frequency"] == "MONTHLY":
            date.fromisoformat(start + "-01")
            date.fromisoformat(end + "-01")
            year, month = map(int, start.split("-"))
            periods = []
            while f"{year:04d}-{month:02d}" <= end:
                periods.append(f"{year:04d}-{month:02d}")
                year, month = (year + 1, 1) if month == 12 else (year, month + 1)
            if window["calendar"] is not None:
                raise ValueError("monthly grid must not use trading calendar")
        else:
            date.fromisoformat(start)
            date.fromisoformat(end)
            calendar = window["calendar"]
            if not calendar or not calendar["evidence"]:
                raise ValueError("daily denominator requires versioned calendar evidence")
            periods = calendar["dates"]
            if any(not start <= p <= end for p in periods):
                raise ValueError("calendar date outside frozen target window")
        for period in periods:
            identity = {k: deepcopy(window[k]) for k in
                        ("windowId", "sourceId", "metricId", "field", "scopeVersion", "sourceDefinitionIds")}
            identity["period"] = period
            cells.append({"cellId": "cell-" + canonical_sha256(canonical_order(identity)), **identity})
    return canonical_order(cells)


def dataset_content_projection(dataset: HistoricalDataset) -> dict:
    """Explicit nonrecursive projection. All provenance, including fetchedAt, is bound.

    generatedAt, hashes of this projection and derived validation/coverage results
    are excluded. Sidecars appear once as content; their manifest hashes are checks.
    The R1 business hash binds definitions, observations and artifact bytes metadata.
    """
    m = dataset["manifest"]
    return canonical_order({
        **{k: m[k] for k in ("schemaVersion", "datasetVersion", "planId",
                            "planContentSha256", "datasetAsOf", "targetWindows", "catalogContentSha256")},
        **{k: dataset[k] for k in SIDECARS},
    })


def enumeration_complete(scan: dict, pagination: dict, *, revision=False) -> bool:
    pages = scan["revisionPages" if revision else "pages"]
    targets = pagination["revisionPageTargets" if revision else "pageTargets"]
    stop = scan["revisionStopEvidence" if revision else "stopEvidence"]
    rule = pagination["revisionStopRule" if revision else "stopRule"]
    return (bool(targets) and {(p['pageNumber'], p['url']) for p in pages}
            == {(p['pageNumber'], p['url']) for p in targets}
            and bool(stop) and stop['pageNumber'] == rule['pageNumber'])


def coverage_summary(dataset: dict, plan: Plan, *, raw_admitted: set[str]) -> list[dict]:
    events = {e["releaseEventId"]: e for e in dataset["releaseEvents"]}
    extractions = {(x["observationId"] or x["exchangeObservationId"], x["field"]): x
                   for x in dataset["fieldExtractions"]}
    result = []
    for w in plan["targetWindows"]:
        rows = [r for r in dataset["coverageLedger"] if r["windowId"] == w["windowId"]]
        counts = dict.fromkeys(("targetCount", "availableCount", "provenFirstReleaseCount",
                               "backcastCount", "notYetReleasedCount", "structuralCount",
                               "unresolvedCount", "vintageCount"), 0)
        counts["targetCount"] = len([r for r in target_grid(plan) if r["windowId"] == w["windowId"]])
        for row in rows:
            admitted = [oid for oid in row["admittedObservationIds"] if oid in raw_admitted]
            kinds = {events[x["releaseEventId"]]["releaseKind"] for oid in admitted
                     if (x := extractions.get((oid, row["field"]))) and x["releaseEventId"] in events}
            counts["vintageCount"] += len(admitted)
            if admitted:
                counts["availableCount"] += 1
                counts["provenFirstReleaseCount"] += int("FIRST_RELEASE" in kinds)
                counts["backcastCount"] += int("BACKCAST" in kinds)
            elif row["status"] == "NOT_YET_RELEASED":
                counts["notYetReleasedCount"] += 1
            elif row["status"] == "STRUCTURALLY_UNAVAILABLE":
                counts["structuralCount"] += 1
            else:
                counts["unresolvedCount"] += 1
        scan = next((s for s in dataset["inventoryEvidence"] if s["windowId"] == w["windowId"]), None)
        pagination = next(s['pagination'] for s in plan['sources'] if s['sourceId'] == w['sourceId'])
        inventory = bool(scan and scan["paginationComplete"] and scan["candidatesReconciled"]
                         and scan["evidence"] and enumeration_complete(scan, pagination))
        revisions = bool(inventory and scan["revisionScanComplete"] and enumeration_complete(scan, pagination, revision=True))
        complete = (plan["purpose"] == "HISTORICAL" and inventory and revisions
                    and counts["availableCount"] > 0 and counts["unresolvedCount"] == 0
                    and counts["provenFirstReleaseCount"] == counts["availableCount"])
        result.append({"windowId": w["windowId"], "counts": counts,
                       "inventoryStatus": "PASS" if inventory else "PARTIAL",
                       "revisionCoverageStatus": "PASS" if revisions else "PARTIAL",
                       "datasetCoverageStatus": "PASS" if complete else "PARTIAL"})
    return canonical_order(result)


def build_dataset(payload: dict, catalog: dict, *, plans: list[Plan], artifact_root,
                  generated_at: str, locator_replayers=None) -> HistoricalDataset:
    from .historical_validator import SCHEMA, resolve_plan, schema_check, validate_dataset
    plan = resolve_plan(payload["planId"], plans)
    if set(payload) != {"planId", "datasetVersion", *SIDECARS}:
        raise ValueError("dataset input requires exact fields; unknown/missing keys rejected")
    for name in SIDECARS:
        value = payload[name]
        if not isinstance(value, list):
            raise ValueError(f"{name} must be an array")
        definition = SCHEMA["properties"][name]["items"]["$ref"].split('/')[-1]
        for record in value:
            schema_check(record, definition)
    dataset = canonical_order({k: deepcopy(payload[k]) for k in SIDECARS})
    m = {
        "schemaVersion": "1.1.0", "datasetVersion": payload["datasetVersion"],
        "planId": plan["planId"], "planContentSha256": canonical_sha256(plan_projection(plan)),
        "datasetAsOf": plan["datasetAsOf"], "targetWindows": canonical_order(plan["targetWindows"]),
        "catalogContentSha256": canonical_sha256(catalog_content_projection(catalog)),
        "sidecarContentHashes": {k: canonical_sha256(dataset[k]) for k in SIDECARS},
        "generatedAt": generated_at, "validationStatus": "PASS",
        "admissionStatus": "SYNTHETIC_ONLY" if plan["purpose"] == "SYNTHETIC_OFFLINE" else "PARTIAL",
        "coverageSummary": [], "datasetContentSha256": "0" * 64,
    }
    dataset["manifest"] = m
    # Summary is recomputed from validated graph below; no candidate bypasses validation.
    claimed = {oid for r in dataset["coverageLedger"] for oid in r["admittedObservationIds"]}
    m["coverageSummary"] = coverage_summary(dataset, plan, raw_admitted=claimed)
    if plan["purpose"] == "HISTORICAL" and all(s["datasetCoverageStatus"] == "PASS" for s in m["coverageSummary"]):
        m["admissionStatus"] = "ADMITTED"
    m["datasetContentSha256"] = canonical_sha256(dataset_content_projection(dataset))
    errors = validate_dataset(dataset, catalog, plans=plans, artifact_root=artifact_root,
                              locator_replayers=locator_replayers)
    if errors:
        raise ValueError("\n".join(errors))
    return dataset
