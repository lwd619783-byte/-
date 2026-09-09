"""C2A2 bounded official provenance investigation; no caller-authored PIT flags.

This evidence sidecar is not an R2 dataset. V1 has no reviewed historical
release-to-bytes proof. It therefore cannot publish financing observations.
Any later positive evidence requires a new reviewed version and the existing
R2-A graph validator, never promotion of these present-day retrievals.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin

from . import csrc_ipo_admission as c2a1
from .collectors import extract_html
from .csrc_inventory import digest, write_evidence
from .csrc_recovery import prove_request, search_page
from .csrc_retrieval import Collector, now, official, parse_landing

RAW = "research-data/market-regime/raw/csrc-r2c2a2"
OUT = "research-data/market-regime/source-catalog/csrc-c2a2/ipo-provenance-admission.v1.json"
REVIEW = "research-data/market-regime/source-catalog/csrc-c2a2/ipo-provenance-review.v1.json"
VERSION = "csrc-ipo-historical-provenance-1.0.0"
C2A1_HASH = "67b1dd4881850ae3e2a3846dafa0cda6d4ff6df3e763e8d7aaaa755d025f66ff"
PERIODS = ([f"2010-{m:02d}" for m in range(6, 13)] +
           [f"2011-{m:02d}" for m in (1, 3, 4, 5, 6, 7, 8, 9, 10, 12)] +
           [f"2012-{m:02d}" for m in range(1, 10)])
# Filled only after the bounded source investigation; immutable reviewed input.
REVIEW_HASH = "dc2a310249cb733e530fd9bab7df3a4b211843a79fa8a9f8315801afa0e0fafc"
BLOCKERS = ["HISTORICAL_ATTACHMENT_VERSION_UNPROVEN", "RELEASE_ARTIFACT_BINDING_UNPROVEN",
            "RELEASE_KIND_UNPROVEN", "RELEASE_AVAILABLE_AT_UNPROVEN", "R2_A_LINEAGE_UNPROVEN"]
require = c2a1.require


def frozen(repo):
    evidence = c2a1.validate_compact(repo)
    require(evidence["contentSha256"] == C2A1_HASH, "C2A1_FROZEN_INPUT_DRIFT_STOP")
    rows = [r for r in evidence["admissionMatrix"] if r["definitionCompatible"]]
    require([r["reportPeriod"] for r in rows] == PERIODS and len(rows) == 26,
            "C2A2_DENOMINATOR_DRIFT_STOP")
    return evidence, rows


def request_plan(repo):
    """Every URL is an actual frozen official href/JSON field; never enumerate IDs."""
    _, rows = frozen(repo)
    result = []
    for row in rows:
        p = row["reportPeriod"]
        def add(url, role, basis):
            result.append(dict(reportPeriod=p, url=official(url), role=role, basis=basis))
        add(row["landingEvidence"]["url"], "LANDING", dict(kind="C2A1_LANDING", rowSha256=digest(row)))
        add(row["attachment"]["url"], "ATTACHMENT", dict(kind="C2A1_ATTACHMENT", rowSha256=digest(row)))
        for entry in row["indexEntries"]:
            for resource in entry.get("resourceCandidates", []):
                for key in ("filePath", "url"):
                    add(urljoin(row["landingEvidence"]["url"], resource[key]), "RESOURCE",
                        dict(kind="C1_RESOURCE_DISCOVERY_ONLY", indexAttemptId=entry["indexAttemptId"],
                             jsonLocator=entry["jsonLocator"], resource=resource, resourceKey=key))
    # Reuse the exact official title-search mechanism proved in frozen C1.1.
    recovery = c2a1.load(repo, c2a1.RECOVERY)
    template = next(r for r in recovery["retrievalAttempts"] if r.get("requestForm", {}).get("searchContent") == "2011年11月统计数据")
    for p in PERIODS:
        form = dict(template["requestForm"], searchContent=f"{int(p[:4])}年{int(p[5:])}月统计数据", page="1")
        result.append(dict(reportPeriod=p, url=template["requestUrl"], role="SEARCH", form=form,
                           basis=dict(kind="C1_1_OFFICIAL_TITLE_SEARCH", templateAttemptId=template["attemptId"])))
    return result


def fetch(repo):
    plan = request_plan(repo)
    prior = Collector(repo, raw_directory="research-data/market-regime/raw/csrc-r2c1-1")
    c = Collector(repo, raw_directory=RAW, budget=300, timeout=15)
    for request in plan:
        if request.get("form"):
            prove_request(prior, request, prior.rows)
        row = c.fetch(request["url"], request["role"], form_data=request.get("form"))
        print(request["reportPeriod"], request["role"], row["outcome"], flush=True)
    print("Physical requests this invocation:", c.count)


def finding(c, request, acquisition):
    result = dict(request=request, acquisition=acquisition)
    if acquisition["outcome"] != "SUCCESS":
        return dict(result, inspection=None)
    body = c.bytes(acquisition)
    if request["role"] == "LANDING":
        html = c.html(acquisition)
        parsed = parse_landing(html, acquisition["finalUrl"])
        # Keep original visible text for independent review, not keyword proof.
        main = re.search(r'<div[^>]+class=["\'][^"\']*Custom_UnionStyle[^"\']*["\'][^>]*>(.*?)</div>', html, re.S | re.I)
        text = extract_html(main[1] if main else html)[0]
        return dict(result, inspection=dict(kind="CURRENT_LANDING", parsed=parsed, visibleText=text,
                                            historicalBindingProven=False))
    if request["role"] == "SEARCH":
        page = search_page(c, acquisition)
        data = json.loads(body)["data"]
        # Full returned entries (including resource metadata) are evidence-only.
        return dict(result, inspection=dict(kind="CURRENT_TITLE_SEARCH", page=page,
            rawResults=data["results"], queryComplete=data["total"] <= 10,
            historicalRevisionEnumerationComplete=False))
    from .csrc_schema import probe_bytes
    probe = probe_bytes(body, acquisition["finalUrl"], acquisition["contentType"])
    return dict(result, inspection=dict(kind="CURRENT_ATTACHMENT_BYTES", actualFormat=probe["actualFormat"],
        contentAdmission="REJECTED" if probe["blockers"] else "FORMAT_PROBED_NOT_HISTORICAL_ADMISSION",
        parserVersion=probe["parserVersion"], blockers=probe["blockers"]))


def investigate(repo):
    """Offline reconstruction retains *all* acquisitions, including changed bytes."""
    c = Collector(repo, raw_directory=RAW)
    results = []
    plan = request_plan(repo)
    prior = Collector(repo, raw_directory="research-data/market-regime/raw/csrc-r2c1-1")
    for acquisition in c.rows:
        for response in [acquisition, *acquisition["redirects"]]:
            if response.get("storedBytes"):
                c.bytes(response)  # Include rejected, cached and redirect responses.
    for request in plan:
        if request.get("form"):
            prove_request(prior, request, prior.rows)
        matching = [r for r in c.rows if r["requestUrl"] == request["url"] and
                    r.get("requestForm") == request.get("form") and r["outcome"] != "CACHE_VERIFIED"]
        require(bool(matching), "REQUEST_NOT_ATTEMPTED: " + request["reportPeriod"] + ":" + request["role"])
        results.extend(finding(c, request, r) for r in matching)
    return dict(requestPlan=plan, findings=results, retrievalJournal=c.rows)


def conflicts(row, findings):
    by_url = {}
    acquisitions = [row["attachment"]["acquisitionEvidence"]] + [f["acquisition"] for f in findings
                    if f["request"]["role"] in ("ATTACHMENT", "RESOURCE")]
    for a in acquisitions:
        if a["outcome"] == "SUCCESS" and a["storedBytes"]:
            by_url.setdefault(a["requestUrl"], set()).add(a["storedBytes"]["sha256"])
    return [dict(url=url, sha256s=sorted(hashes), resolution="UNRESOLVED_NO_OFFICIAL_REVISION_EVENT")
            for url, hashes in sorted(by_url.items()) if len(hashes) > 1]


def decision(row, findings):
    """Only factual present-day evidence accepted here; no release flag arguments.

    This is the negative decision for V1's reviewed sources, NOT a general R2
    positive gate. The separately pinned review prevents new official documents
    from silently passing through this parser without independent examination.
    """
    collisions = conflicts(row, findings)
    blockers = BLOCKERS + (["SAME_URL_CHANGED_BYTES_REVISION_EVENT_UNPROVEN"] if collisions else [])
    return dict(reportPeriod=row["reportPeriod"], definitionId=row["definitionId"],
        definitionCompatible=True, c2a1RowSha256=digest(row),
        extractionEvidenceSha256=digest(row["extractionEvidence"]),
        historicalAttachmentVersion=None, releaseArtifactBinding=None,
        releaseKind="UNRESOLVED", firstReleaseProven=False, releaseAvailableAt=None,
        predecessorReleaseEventIds=None, supersedesObservationId=None, successorReleaseEventIds=None,
        lineageStatus="UNPROVEN", releaseEventIds=[], artifactBindingIds=[], fieldExtractionIds=[],
        status="UNRESOLVED_RELEASE_CONFLICT" if collisions else "PIT_VINTAGE_UNPROVEN",
        blockers=blockers, conflicts=collisions, eligible=False, admittedObservationIds=[])


def content_hash(value):
    return digest({k: v for k, v in value.items() if k not in ("generatedAt", "contentSha256")})


def validate_correspondence(value):
    matrix = value["admissionMatrix"]
    require([r["reportPeriod"] for r in matrix] == PERIODS, "C2A2_DENOMINATOR_NOT_EXACT")
    eligible = [r["reportPeriod"] for r in matrix if r["eligible"]]
    require(value["eligiblePeriods"] == eligible, "ELIGIBLE_PERIODS_MISMATCH")
    observations = value["formalObservations"]
    require(sorted(o["valueDate"] for o in observations) == eligible,
            "FORMAL_OBSERVATIONS_NOT_ONE_TO_ONE")
    require(all(o["metricId"] == c2a1.IPO for o in observations), "OUT_OF_SCOPE_OBSERVATION")
    for r in matrix:
        require(r["admittedObservationIds"] == [o["observationId"] for o in observations if o["valueDate"] == r["reportPeriod"]],
                "OBSERVATION_IDS_MISMATCH")


def assemble(repo, investigation, review, generated_at):
    evidence, rows = frozen(repo)
    require(digest(review) == REVIEW_HASH, "UNREVIEWED_PROVENANCE_INPUT_USE_NEW_VERSION")
    require(review["investigationSha256"] == digest(investigation), "REVIEW_SOURCE_SNAPSHOT_MISMATCH")
    require(review["candidatePeriods"] == PERIODS and review["reviewedHistoricalReleaseProofs"] == [],
            "V1_HAS_NO_REVIEWED_HISTORICAL_RELEASE_PROOF")
    require([r["reportPeriod"] for r in review["periodReviews"]] == PERIODS, "REVIEW_DENOMINATOR_NOT_EXACT")
    for r in review["periodReviews"]:
        require(r["findingsSha256"] == digest([f for f in investigation["findings"]
            if f["request"]["reportPeriod"] == r["reportPeriod"]]), "PER_MONTH_REVIEW_BINDING_MISMATCH")
    matrix = [decision(r, [f for f in investigation["findings"] if f["request"]["reportPeriod"] == r["reportPeriod"]]) for r in rows]
    result = dict(schemaVersion=VERSION, purpose="HISTORICAL_PROVENANCE_ADMISSION_EVIDENCE_ONLY",
        datasetAsOf="2026-09-07T08:00:00+08:00", candidatePeriods=PERIODS,
        frozenInputs=dict(c1=evidence["baselineContentSha256"], c1_1=evidence["recoveryContentSha256"],
            c2a1=C2A1_HASH, definitionMapping=evidence["configSha256"],
            c1Ledger=evidence["baselineLedgerSha256"], c1_1Ledger=evidence["recoveryLedgerSha256"]),
        investigation=investigation, provenanceReview=review, provenanceReviewSha256=REVIEW_HASH,
        admissionMatrix=matrix, eligiblePeriods=[], formalObservations=[],
        r2a=dict(releaseEvents=[], artifactBindings=[], fieldExtractions=[],
                 status="NOT_CONSTRUCTED_NO_PROVEN_HISTORICAL_RELEASE"),
        summary=dict(targetCount=260, candidateCount=26, pitProvenCount=0, formalObservationCount=0,
            unresolvedCount=26, statusCounts=dict(Counter(r["status"] for r in matrix))), generatedAt=generated_at)
    validate_correspondence(result)
    return dict(result, contentSha256=content_hash(result))


def validate_compact(repo):
    result = c2a1.load(repo, OUT)
    review = c2a1.load(repo, REVIEW)
    expected = assemble(repo, result["investigation"], review, result["generatedAt"])
    require(expected == result, "C2A2_COMPACT_EVIDENCE_MISMATCH")
    return result


def build(repo, generated_at):
    old = c2a1.load(repo, c2a1.OUT)
    require(c2a1.build(repo, old["generatedAt"]) == old, "C2A1_FULL_REPLAY_DRIFT_STOP")
    return assemble(repo, investigate(repo), c2a1.load(repo, REVIEW), generated_at)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("fetch", "build", "validate", "validate-compact"))
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--generated-at")
    args = parser.parse_args()
    if args.command == "fetch":
        require(not (args.repo_root / OUT).exists(), "SEALED_OUTPUT_USE_NEW_VERSION_FOR_NEW_ACQUISITION")
        fetch(args.repo_root)
        return
    if args.command == "validate-compact":
        result = validate_compact(args.repo_root)
        print("PASS compact: pinned submitted content only; no source bytes or historical PIT proof")
    else:
        path = args.repo_root / OUT
        timestamp = args.generated_at or (c2a1.load(args.repo_root, OUT)["generatedAt"] if path.exists() else now())
        result = build(args.repo_root, timestamp)
        if args.command == "validate":
            require(result == c2a1.load(args.repo_root, OUT), "C2A2_FULL_REPLAY_MISMATCH")
        else:
            require(not path.exists() or result == c2a1.load(args.repo_root, OUT), "SEALED_OUTPUT_USE_NEW_VERSION")
            path.parent.mkdir(parents=True, exist_ok=True)
            write_evidence(path, result)
        print("PASS full: frozen C1/C1.1/C2A1 and new acquisition bytes replay; no historical PIT admitted")
    print(json.dumps(result["summary"]))


if __name__ == "__main__":
    main()
