"""C2A1 IPO-only evidence gate. No catalog/vintage writer and no network command.

C1 proves present-day link/bytes/extraction, not historical byte visibility. This
slice cannot accept a caller's first-release flag as a replacement for R2-A.
"""
from __future__ import annotations

import argparse
import io
import json
import re
from collections import Counter
from copy import deepcopy
from decimal import Decimal
from pathlib import Path

from .csrc_field_map import clean, field_map, row_period
from .csrc_inventory import (build as replay_c1, content_periods, digest,
                             target_periods, write_evidence)
from .csrc_recovery import build as replay_recovery, validate_compact as validate_recovery
from .csrc_retrieval import Collector, now
from .csrc_schema import probe_bytes
from .time_semantics import date_only_safe_available_at

IPO = "SUPPLY_IPO_FINANCING"
VERSION = "csrc-ipo-admission-1.0.0"
BASE = "research-data/market-regime/source-catalog/csrc-c1/inventory-evidence.v1.json"
RECOVERY = "research-data/market-regime/source-catalog/csrc-c1/recovery-evidence.v1.json"
CONFIG = "config/market-regime/csrc-ipo-admission.v1.json"
OUT = "research-data/market-regime/source-catalog/csrc-c2a1/ipo-admission-evidence.v1.json"
C1_HASH = "28453963bf0a453d69a0277d9eabdc4cd3b393e4f663d3cb8922478b06a18d80"
RECOVERY_HASH = "9e76a9c0bb82fdf00571337c4c6daefc29bf8698c0a80db517d189eb048689ae"
LISTING_NOTE = "本表首发筹资金额以IPO上市首日为基础统计"
DEFINITION_ID = "csrc-ipo-a-share-listing-month-v1"
DEFINITION_SHA256 = "5523ea078a46c231af21a92a3256ba6df639802cf086510db6b39912cf5edd99"


def load(repo, path):
    return json.loads((Path(repo) / path).read_text(encoding="utf-8"))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def no_formal_observations(value):
    if isinstance(value, dict):
        for key, child in value.items():
            require(key != "formalObservations" or child == [], "FORMAL_OBSERVATIONS_FORBIDDEN")
            no_formal_observations(child)
    elif isinstance(value, list):
        for child in value:
            no_formal_observations(child)


def candidate_periods():
    ranges = [("2005-01", "2007-03"), ("2007-05", "2008-12"),
              ("2009-02", "2010-03"), ("2010-06", "2011-01"),
              ("2011-03", "2011-10"), ("2011-12", "2012-09")]
    return [p for start, end in ranges for p in target_periods(
        dict(targetStart=start, targetEnd=end, targetCount=(int(end[:4])-int(start[:4]))*12+int(end[5:])-int(start[5:])+1))]


def baseline_check(base, recovery):
    require(base["contentSha256"] == C1_HASH == digest({k: v for k, v in base.items()
            if k not in ("schemaVersion", "generatedAt", "contentSha256")}), "C1_BASELINE_DRIFT_STOP")
    require(recovery["contentSha256"] == RECOVERY_HASH == digest({k: v for k, v in recovery.items()
            if k != "contentSha256"}), "C1_1_BASELINE_DRIFT_STOP")
    require(recovery["baselineContentSha256"] == C1_HASH and
            recovery["baselineLedgerSha256"] == digest(base["ledger"]), "BASELINE_LEDGER_DRIFT_STOP")
    require([r["period"] for r in base["ledger"] if r["fields"][IPO] == "FIELD_CONDITIONS_READY"]
            == candidate_periods(), "C1_CANDIDATE_SUBSET_DRIFT_STOP")
    require(len(base["ledger"]) == len(recovery["ledger"]) == 260, "TARGET_DENOMINATOR_MISMATCH")


def numeric_evidence(cell):
    """Keep the parser's original token/state; never coerce missing to zero."""
    token = cell["text"]
    if cell["valueState"] in ("BLANK", "DASH", "ABSENT"):
        return dict(rawNumericToken=token, valueState=cell["valueState"], numericValue=None)
    if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", token.strip()):
        return dict(rawNumericToken=token, valueState=cell["valueState"], numericValue=None)
    value = Decimal(token.strip())
    require(value.is_finite(), "NON_FINITE_AMOUNT")
    require((value == 0) == (cell["valueState"] == "REPORTED_ZERO"), "ZERO_TOKEN_STATE_MISMATCH")
    return dict(rawNumericToken=token, valueState=cell["valueState"], numericValue=float(value))


def definition_gate(candidate, table, *, probe_blockers=()):
    """Economic equivalence needs scope, amount/unit, native MONTH and attribution.

    Literal matching deliberately does not extrapolate the listing-day note into
    earlier documents. Unreviewed notes/layouts are additionally rejected by the
    frozen mapping comparison in assemble().
    """
    blockers = set(probe_blockers) | set(candidate["blockers"])
    path = [clean(h["text"]) for h in candidate["headerPath"]]
    if path not in (["首发筹资", "A股(亿元)"], ["首次发行金额", "A股(亿元)"]):
        blockers.add("IPO_HEADER_SCOPE_AMOUNT_MISMATCH")
    if candidate["rawUnit"] != "亿元":
        blockers.add("RMB_UNIT_UNPROVEN")
    if candidate["periodSemantics"] != "MONTH":
        blockers.add("NATIVE_MONTH_UNPROVEN")
    headers = [clean(h["text"]) for c in table["headerColumns"] for h in c["headerPath"]]
    if not any("境内筹资合计" in h for h in headers):
        blockers.add("DOMESTIC_SCOPE_CONTEXT_UNPROVEN")
    siblings = [c for c in table["headerColumns"] if c["headerPath"][0] == candidate["headerPath"][0]]
    if not all(any(clean(c["headerPath"][-1]["text"]).startswith(scope) for c in siblings) for scope in ("B股(", "H股(")):
        blockers.add("NON_TARGET_SCOPE_EXCLUSION_UNPROVEN")
    notes = "\n".join(clean(n["text"]) for n in table["notes"])
    if LISTING_NOTE not in notes:
        blockers.add("IPO_MONTH_ATTRIBUTION_UNPROVEN")
    if re.search(r"批准|计划|非实际|(?:包括|包含|含)(?:B股|H股|境外)|统计范围变化", notes):
        blockers.add("OFFICIAL_NOTE_DEFINITION_CONFLICT")
    return dict(definitionCompatible=not blockers,
                definitionId=DEFINITION_ID if not blockers else None,
                blockers=sorted(blockers))


def vintage_gate(publication, acquisitions, *, attachment_sha):
    """Assess only the audited C1 input contract, which contains no R2 release proof.

    Publication is a page clock, acquisition is current byte visibility. Neither
    is a numeric vintage's releaseAvailableAt. This gate has no flag/clock override
    that can manufacture FIRST_RELEASE, REVISION or BACKCAST from these inputs.
    """
    blockers = {"HISTORICAL_ATTACHMENT_VERSION_UNPROVEN", "RELEASE_ARTIFACT_BINDING_UNPROVEN",
                "FIRST_RELEASE_UNPROVEN", "R2_A_LINEAGE_UNPROVEN"}
    safe = None
    if publication.get("date") and publication.get("evidence") and publication.get("status") in ("LANDING", "OFFICIAL_INDEX_FALLBACK"):
        safe = date_only_safe_available_at(publication["date"])
        require(safe == publication["dateOnlySafeAvailableAt"], "PUBLICATION_SAFE_CLOCK_MISMATCH")
    else:
        blockers.add("RELEASE_EVENT_UNPROVEN")
    hashes_by_url = {}
    for r in acquisitions:
        if r["outcome"] == "SUCCESS" and r.get("storedBytes"):
            hashes_by_url.setdefault(r["requestUrl"], set()).add(r["storedBytes"]["sha256"])
    conflict = any(len(hashes) > 1 for hashes in hashes_by_url.values())
    if conflict:
        blockers.add("SAME_URL_CHANGED_BYTES_REVISION_EVENT_UNPROVEN")
    require(any(attachment_sha in hashes for hashes in hashes_by_url.values()), "ATTACHMENT_ACQUISITION_MISSING")
    return dict(pageDateOnlySafeAvailableAt=safe, releaseAvailableAt=None,
                releaseKind="UNRESOLVED", historicalAttachmentVersionProven=False,
                releaseArtifactBindingProven=False, firstReleaseProven=False,
                lineageProven=False, eligibleForFutureC2A2=False,
                status="UNRESOLVED_RELEASE_CONFLICT" if conflict else "PIT_VINTAGE_UNPROVEN",
                blockers=sorted(blockers))


def extract_witness(repo, base, period):
    row = next(r for r in base["ledger"] if r["period"] == period)
    require(len(row["attachmentAttemptIds"]) == 1, "C1_CANDIDATE_AMBIGUITY_STOP")
    aid = row["attachmentAttemptIds"][0]
    a = next(a for a in base["attachments"] if a["attemptId"] == aid)
    retrieval = next(r for r in base["retrievalAttempts"] if r["attemptId"] == aid)
    body = Collector(repo).bytes(retrieval)
    probe = probe_bytes(body, a["url"], retrieval["contentType"])
    require(content_periods(probe) == [period] and not probe["blockers"], "C1_REPLAY_BLOCKER_STOP")
    mapping = field_map(probe, period)
    require(mapping["fieldSchemaSignature"] == a["fieldSchemaId"], "C1_FIELD_SCHEMA_DRIFT_STOP")
    field = mapping["fields"][IPO]
    require(field["status"] == "FIELD_CONDITIONS_READY", "C1_FIELD_READINESS_DRIFT_STOP")
    candidate = next(c for c in field["candidates"] if not c["blockers"])
    table = next(t for t in probe["sheets"] if t["index"] == candidate["valueLocator"]["tableIndex"])
    def cell_at(loc):
        return next(c for c in table["cells"] if (c["row"], c["column"]) == (loc["row"], loc["column"]))
    table_map = next(t for t in mapping["tables"] if t["tableIndex"] == table["index"])
    # BIFF numeric cells have no original decimal string. Keep C1's .15g token
    # plus the lossless decoded value; do not call the token original text bytes.
    import xlrd
    book = xlrd.open_workbook(file_contents=body, on_demand=True, logfile=io.StringIO())
    try:
        loc = candidate["valueLocator"]
        stored = book.sheet_by_index(loc["tableIndex"] - 1).cell(loc["row"] - 1, loc["column"] - 1)
        decoded = dict(rawType=str(stored.ctype), valueRepr=repr(stored.value),
                       floatHex=stored.value.hex() if isinstance(stored.value, float) else None)
    finally:
        book.release_resources()
    return dict(reportPeriod=period, attachmentAttemptId=aid, candidate=candidate,
                valueCell=cell_at(candidate["valueLocator"]), periodCell=cell_at(candidate["periodLocator"]),
                tableTitles=table_map["titles"], parserVersion=probe["parserVersion"],
                dateMode=probe["dateMode"], probeBlockers=probe["blockers"], decodedXlsValue=decoded,
                tokenEncoding="C1_XLRD_DECODED_15G_NOT_ORIGINAL_DECIMAL_BYTES")


def assemble(base, recovery, config, witnesses, generated_at):
    baseline_check(base, recovery)
    no_formal_observations(config)
    no_formal_observations(witnesses)
    require(config["metricId"] == IPO and config["formalObservations"] == [] and
            config["targetWindow"] == dict(start="2005-01", end="2026-08", targetCount=260) and
            config["candidatePeriods"] == candidate_periods(), "C2A1_SCOPE_MISMATCH")
    require(sorted(w["reportPeriod"] for w in witnesses) == candidate_periods(), "CANDIDATE_MATRIX_NOT_EXACT")
    require(len({m["fieldSchemaId"] for m in config["mappings"]}) == len(config["mappings"]), "DUPLICATE_MAPPING")
    definitions = config["definitions"]
    require(len(definitions) == 1 and definitions[0]["sourceDefinitionId"] == DEFINITION_ID and
            definitions[0]["metricId"] == IPO and definitions[0]["unit"] == "亿元" and
            definitions[0]["nativeFrequency"] == "MONTHLY", "DEFINITION_CONTRACT_MISMATCH")
    require(digest(definitions[0]) == DEFINITION_SHA256, "IMMUTABLE_DEFINITION_VERSION_MISMATCH")
    require(sorted(p for m in config["mappings"] for p in m["candidatePeriods"]) == candidate_periods(), "MAPPING_PERIODS_NOT_EXACT")
    attachments = {a["attemptId"]: a for a in base["attachments"]}
    retrievals = {r["attemptId"]: r for r in base["retrievalAttempts"]}
    rows = []
    for witness in sorted(witnesses, key=lambda w: w["reportPeriod"]):
        p, aid = witness["reportPeriod"], witness["attachmentAttemptId"]
        ledger = next(r for r in base["ledger"] if r["period"] == p)
        require(ledger["attachmentAttemptIds"] == [aid], "EXTRACTION_PERIOD_ARTIFACT_MISMATCH")
        a, acquisition = attachments[aid], retrievals[aid]
        candidate = witness["candidate"]
        compact_candidate = deepcopy(candidate)
        compact_candidate["headerCoordinates"] = [[h["row"], h["column"]] for h in compact_candidate.pop("headerPath")]
        require(compact_candidate in a["fields"][IPO]["candidates"] and not candidate["blockers"], "C1_LOCATOR_STATE_MISMATCH")
        schema = next(s for s in base["fieldSchemas"] if s["fieldSchemaId"] == a["fieldSchemaId"])
        table = next(t for t in schema["tables"] if t["tableIndex"] == candidate["valueLocator"]["tableIndex"])
        header = next(c["headerPath"] for c in table["headerColumns"] if c["column"] == candidate["valueLocator"]["column"])
        require(candidate["headerPath"] == header, "C1_HEADER_PATH_MISMATCH")
        mapping = next(m for m in config["mappings"] if m["fieldSchemaId"] == a["fieldSchemaId"])
        require(mapping["tableEvidence"] == table and p in mapping["candidatePeriods"], "UNREVIEWED_MAPPING_OR_NOTES")
        for name, loc in (("valueCell", candidate["valueLocator"]), ("periodCell", candidate["periodLocator"])):
            cell = witness[name]
            require((cell["row"], cell["column"]) == (loc["row"], loc["column"]), "CELL_COORDINATE_MISMATCH")
        require(witness["periodCell"]["text"] == candidate["periodLocator"]["text"] and
                row_period(witness["periodCell"]) == (p, "MONTH"), "PERIOD_SEMANTICS_CONFLICT")
        require(witness["parserVersion"] == a["probe"]["parserVersion"] and
                witness["dateMode"] == a["probe"]["dateMode"] and witness["probeBlockers"] == a["probe"]["blockers"], "PARSER_PROVENANCE_MISMATCH")
        actual_titles = [c for t in a["probe"]["tables"] if t["index"] == table["tableIndex"] for c in t["labelCells"]]
        require(all({k: title[k] for k in ("row", "column", "text")} in actual_titles for title in witness["tableTitles"]), "TITLE_EVIDENCE_MISMATCH")
        require(witness["valueCell"]["valueState"] == candidate["valueState"] and
                bool(witness["valueCell"]["formula"]) == candidate["formulaPresent"], "CELL_STATE_MISMATCH")
        decoded = witness["decodedXlsValue"]
        require(decoded["rawType"] == witness["valueCell"]["rawType"] and
                witness["tokenEncoding"] == "C1_XLRD_DECODED_15G_NOT_ORIGINAL_DECIMAL_BYTES", "NUMERIC_ENCODING_MISMATCH")
        if decoded["rawType"] == "2":
            require(isinstance(decoded["floatHex"], str), "DECODED_BINARY_VALUE_MISSING")
            number = float.fromhex(decoded["floatHex"])
            require(repr(number) == decoded["valueRepr"] and format(number, ".15g") == witness["valueCell"]["text"], "DECODED_NUMBER_TOKEN_MISMATCH")
        numeric = numeric_evidence(witness["valueCell"])
        decision = definition_gate(candidate, table, probe_blockers=witness["probeBlockers"])
        require(decision == mapping["definitionDecision"], "FROZEN_MAPPING_DECISION_MISMATCH")
        blockers = set(decision["blockers"])
        if numeric["numericValue"] is None:
            blockers.add("FIELD_MISSING")
        elif numeric["numericValue"] < 0:
            blockers.add("NEGATIVE_ACTUAL_AMOUNT_UNPROVEN")
        if witness["valueCell"].get("formula") and (witness["valueCell"].get("cache") or {}).get("status") != "PRESENT_NOT_RECALCULATED":
            blockers.add("FORMULA_CACHE_UNVERIFIED")
        landing = next(l for l in base["landings"] if l["attemptId"] in ledger["landingAttemptIds"])
        acquisitions = [r for r in base["retrievalAttempts"] if r["requestUrl"] == acquisition["requestUrl"]]
        vintage = vintage_gate(landing["publication"], acquisitions, attachment_sha=a["sha256"])
        blockers.update(vintage["blockers"])
        status = "DEFINITION_UNRESOLVED" if not decision["definitionCompatible"] else vintage["status"]
        if "FIELD_MISSING" in blockers:
            status = "FIELD_MISSING"
        rows.append(dict(reportPeriod=p, metricId=IPO, fieldSchemaId=a["fieldSchemaId"],
            mappingVersion=mapping["mappingVersion"], definitionId=decision["definitionId"],
            definitionCompatible=decision["definitionCompatible"], extractionEvidence=witness,
            **numeric, unitConversion=dict(rule="IDENTITY", factor=1, outputUnit="亿元"),
            attachment=dict(attemptId=aid, url=a["url"], sha256=a["sha256"], byteSize=acquisition["storedBytes"]["byteSize"],
                actualFormat=a["probe"]["actualFormat"], acquiredAt=acquisition["attemptedAt"],
                acquisitionEvidence=acquisition, currentLandingLinkProven=True),
            publicationEvidence=landing["publication"], indexEntries=landing["indexEntries"],
            landingEvidence=dict(attemptId=landing["attemptId"], url=landing["url"], attachments=landing["attachments"]),
            vintageAdmission=vintage, admissionStatus=status, blockers=sorted(blockers), formalObservations=[]))
    # Preserve every original gap/blocker and the full denominator, without
    # interpreting or repairing fields outside the explicitly frozen 87 subset.
    overlay = []
    for cell in base["ledger"]:
        result = next((r for r in rows if r["reportPeriod"] == cell["period"]), None)
        overlay.append(dict(reportPeriod=cell["period"], candidate=result is not None,
            c1Ledger=cell, c1_1Ledger=next(r for r in recovery["ledger"] if r["period"] == cell["period"]),
            c1IpoBlockers={aid: dict(status=field.get("status"), blockers=field.get("blockers", []),
                                    candidateBlockers=[c["blockers"] for c in field.get("candidates", [])])
                          for aid in cell["attachmentAttemptIds"]
                          for field in [attachments[aid]["fields"].get(IPO, {})]},
            admissionStatus=result["admissionStatus"] if result else None,
            admittedObservationIds=[]))
    summary = dict(targetCount=260, candidateCount=len(rows), definitionVersionCount=len(definitions),
        mappingVersionCount=len(config["mappings"]), definitionCompatibleCount=sum(r["definitionCompatible"] for r in rows),
        pitProvenCount=0, firstReleaseProvenCount=0, unprovenCount=len(rows), eligiblePeriods=[],
        candidateAdmissionStatusCounts=dict(sorted(Counter(r["admissionStatus"] for r in rows).items())),
        blockerCounts=dict(sorted(Counter(b for r in rows for b in r["blockers"]).items())),
        reportedZeroCount=sum(r["numericValue"] == 0 for r in rows), formalObservationCount=0)
    content = dict(schemaVersion=VERSION, purpose="IPO_ADMISSION_EVIDENCE_ONLY",
        baselineContentSha256=C1_HASH, recoveryContentSha256=RECOVERY_HASH,
        baselineLedgerSha256=digest(base["ledger"]), recoveryLedgerSha256=digest(recovery["ledger"]),
        configSha256=digest(config), definitionMappingEvidence=config,
        admissionMatrix=rows, coverageLedger=overlay, formalObservations=[], summary=summary)
    return dict(generatedAt=generated_at, contentSha256=digest(content), **content)


def build(repo, generated_at):
    base, recovery, config = (load(repo, p) for p in (BASE, RECOVERY, CONFIG))
    baseline_check(base, recovery)
    require(replay_c1(repo, base["generatedAt"], save_extracted=False) == base, "C1_FULL_RAW_REPLAY_DRIFT_STOP")
    require(replay_recovery(repo) == recovery, "C1_1_FULL_RAW_REPLAY_DRIFT_STOP")
    return assemble(base, recovery, config, [extract_witness(repo, base, p) for p in candidate_periods()], generated_at)


def validate_compact(repo):
    validate_recovery(repo)
    result = load(repo, OUT)
    witnesses = [r["extractionEvidence"] for r in result["admissionMatrix"]]
    expected = assemble(load(repo, BASE), load(repo, RECOVERY), load(repo, CONFIG), witnesses, result["generatedAt"])
    require(expected == result, "C2A1_COMPACT_EVIDENCE_MISMATCH")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "validate", "validate-compact"))
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--generated-at")
    args = parser.parse_args()
    if args.command == "validate-compact":
        result = validate_compact(args.repo_root)
        print("PASS: compact consistency only; full source bytes and historical visibility are not proved")
    else:
        timestamp = args.generated_at or (load(args.repo_root, OUT)["generatedAt"] if (args.repo_root / OUT).exists() else now())
        result = build(args.repo_root, timestamp)
        if args.command == "validate":
            require(result == load(args.repo_root, OUT), "C2A1_FULL_REPLAY_MISMATCH")
        else:
            path = args.repo_root / OUT
            require(not path.exists() or load(args.repo_root, OUT) == result, "SEALED_EVIDENCE_DIFFERENT_USE_NEW_VERSION")
            write_evidence(path, result)
        print("PASS: full C1/C1.1 bytes replay and 87 IPO extractions; no historical vintage admitted")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
