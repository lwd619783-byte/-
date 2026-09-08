"""Replayable C1 inventory sidecar, explicitly not an R2 financing dataset."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from copy import deepcopy
from datetime import date, timedelta
from pathlib import Path

from .csrc_field_map import clean, disambiguate, field_map, row_period
from .csrc_retrieval import Collector, ROOT, anchors, dump, now, official, parse_index, parse_landing
from .csrc_schema import probe_bytes
from .hashing import atomic_write_bytes

OUT = "research-data/market-regime/source-catalog/csrc-c1"
PLAN = "config/market-regime/csrc-inventory-plan.v1.json"


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def target_periods(plan):
    y, m = map(int, plan["targetStart"].split("-"))
    result = []
    while f"{y:04d}-{m:02d}" <= plan["targetEnd"]:
        result.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    if len(result) != plan["targetCount"]:
        raise ValueError("TARGET_DENOMINATOR_MISMATCH")
    return result


def acquired_url(row, url):
    if row["outcome"] != "SUCCESS":
        return
    if official(url) not in (row["requestUrl"], row.get("discoveredUrl")):
        raise ValueError("ACQUISITION_URL_BINDING_MISMATCH")


def validate_static(c, source, rows):
    for link in source["navigation"]:
        if link.get("basis") == "FROZEN_OFFICIAL_ROOT":
            if link["url"] != ROOT:
                raise ValueError("NAVIGATION_ROOT_MISMATCH")
            acquired_url(rows[link["attemptId"]], link["url"])
        else:
            parent = rows[link["parentAttemptId"]]
            found = anchors(c.html(parent), parent["finalUrl"])
            if not any(a["url"] == link["url"] and a["anchorHtml"] == link["anchorHtml"] for a in found):
                raise ValueError("NAVIGATION_ANCHOR_MISMATCH")
            if link.get("attemptId"):
                acquired_url(rows[link["attemptId"]], link["url"])
    pages = source["pages"]
    first = next((p for p in pages if p["url"] == ROOT), None)
    if first is None or not first["pagination"]:
        raise ValueError("STATIC_INDEX_ROOT_OR_PAGINATION_MISSING")
    expected = first["pagination"]
    actual_numbers = []
    for page in pages:
        row = rows[page["attemptId"]]
        acquired_url(row, page["url"])
        parsed = parse_index(c.html(row), page["url"])
        if any(parsed[k] != page[k] for k in ("entries", "pagination")):
            raise ValueError("INDEX_REPLAY_MISMATCH")
        paging = page["pagination"]
        if not paging or any(paging[k] != expected[k] for k in ("totalPages", "totalEntries", "prefix", "suffix")):
            raise ValueError("STATIC_PAGINATION_CHANGED_OR_INCOMPLETE")
        n = paging["page"]
        expected_url = ROOT.rsplit("/", 1)[0] + "/" + paging["prefix"] + ("_" + str(n) if n > 1 else "") + "." + paging["suffix"]
        if page["url"] != expected_url:
            raise ValueError("STATIC_PAGE_URL_NUMBER_MISMATCH")
        jsrow = rows[page["paginationScriptAttemptId"]]
        html = c.html(row)
        if not any(jsrow["requestUrl"].endswith(ref) for ref in re.findall(r'<script[^>]*src=["\']([^"\']+)', html, re.I)):
            raise ValueError("STATIC_SCRIPT_REFERENCE_MISMATCH")
        js = c.html(jsrow)
        if "param = i == 1 ? '' : '_' + i" not in js or "pagePrefix + param + '.' + pageSuffix" not in js:
            raise ValueError("STATIC_PAGINATION_SCRIPT_MISMATCH")
        actual_numbers.append(n)
    if sorted(actual_numbers) != list(range(1, expected["totalPages"] + 1)) or sum(len(p["entries"]) for p in pages) != expected["totalEntries"]:
        raise ValueError("STATIC_INDEX_SCAN_INCOMPLETE")


def publication(landing):
    own = landing["publicationDates"]
    indexes = sorted(set(e["publicationDate"] for e in landing["indexEntries"] if e.get("publicationDate")))
    all_dates = sorted(set(own + indexes))
    if len(all_dates) != 1:
        return dict(status="UNRESOLVED", date=None, dateOnlySafeAvailableAt=None,
                    blockers=["PUBLICATION_DATE_CONFLICT" if all_dates else "PUBLICATION_EVIDENCE_MISSING"], evidence=[])
    day = all_dates[0]
    try:
        available = (date.fromisoformat(day) + timedelta(days=1)).isoformat() + "T00:00:00+08:00"
    except ValueError:
        raise ValueError("INVALID_PUBLICATION_DATE") from None
    return dict(status="LANDING" if own else "OFFICIAL_INDEX_FALLBACK", date=day, dateOnlySafeAvailableAt=available,
                blockers=["FIRST_RELEASE_AND_ATTACHMENT_VERSION_TIME_UNPROVEN"],
                evidence=[dict(attemptId=landing["attemptId"], basis=landing.get("publicationBasis"), text=day)] if own else
                [dict(attemptId=e["indexAttemptId"], entryHtml=e.get("entryHtml"), jsonLocator=e.get("jsonLocator"), text=day)
                 for e in landing["indexEntries"] if e.get("publicationDate") == day])


def compact_probe(probe):
    return {k: probe[k] for k in ("parserVersion", "actualFormat", "extension", "mime", "magicHex", "blockers", "schemaSignature", "probeStatus")} | {
        "containerEntries": probe.get("containerEntries", []),
        "paragraphs": probe.get("paragraphs", []),
        "dateMode": probe.get("dateMode"),
        "tables": [dict(name=t.get("name"), index=t["index"], part=t.get("part"), rowCount=t["rowCount"],
                        columnCount=t["columnCount"], mergedCellCount=len(t["mergedCells"]),
                        labelCells=[{k: c[k] for k in ("row", "column", "text")} for c in t["cells"]
                                    if re.search(r"[A-Za-z\u3400-\u9fff]", c["text"]) and not c.get("formula")],
                        periodSemantics=sorted({row_period(c)[1] for c in t["cells"] if c["column"] == 1} - {"UNRESOLVED"}),
                        formulaCount=sum(bool(c.get("formula")) for c in t["cells"])) for t in probe["sheets"] + probe["tables"]]}


def content_periods(probe):
    headings = probe.get("paragraphs", []) + [c["text"] for t in probe["sheets"] + probe["tables"] for c in t["cells"] if c["row"] <= 2]
    results = set()
    for title in headings:
        for y, m in re.findall(r"((?:19|20)\d{2})年(?:\d{1,2}[-—－～])?(\d{1,2})月", clean(title)):
            if 1 <= int(m) <= 12:
                results.add(f"{y}-{int(m):02d}")
    return sorted(results)


def runs(ledger, key):
    eras = []
    for cell in ledger:
        value = key(cell)
        if eras and eras[-1]["value"] == value:
            eras[-1]["end"] = cell["period"]
            eras[-1]["periodCount"] += 1
        else:
            eras.append(dict(start=cell["period"], end=cell["period"], periodCount=1, value=value))
    return eras


def build(repo, generated_at, *, save_extracted=True):
    c = Collector(repo)
    plan = json.loads((c.repo / PLAN).read_text(encoding="utf-8"))
    source_path = c.root / "inventory-source.json"
    source = json.loads(source_path.read_text(encoding="utf-8"))
    if (len({l["url"] for l in source["landings"]}) != len(source["landings"])
            or len({l["attemptId"] for l in source["landings"]}) != len(source["landings"])):
        raise ValueError("DUPLICATE_LANDING_EVENT")
    rows = {r["attemptId"]: r for r in c.rows}
    if len(rows) != len(c.rows):
        raise ValueError("DUPLICATE_RETRIEVAL_ATTEMPT")
    for row in c.rows:
        official(row["requestUrl"])
        if row.get("finalUrl"):
            official(row["finalUrl"])
        if row.get("storedBytes"):
            c.bytes(row)
        for redirect in row["redirects"]:
            c.bytes({"storedBytes": redirect["storedBytes"]})
        if row["outcome"] == "CACHE_VERIFIED":
            original = rows.get(row["acquisitionAttemptId"])
            if not original or original["outcome"] != "SUCCESS" or row["httpStatus"] is not None or any(row[k] != original[k] for k in ("requestUrl", "storedBytes")):
                raise ValueError("INVALID_CACHE_ACQUISITION_LINK")
    validate_static(c, source, rows)
    known_urls = {e["url"] for p in source["pages"] for e in p["entries"] if any(plan["targetStart"] <= x <= plan["targetEnd"] for x in e["periods"])}
    # Supplemental archive entries carry independent official API artifacts.
    archive = source.get("archive", None)
    theme_archive = source.get("themeArchive", None)
    for current_archive in (archive, theme_archive):
        if not current_archive:
            continue
        from .csrc_archive import validate_archive
        validate_archive(c, current_archive)
        known_urls |= {e["url"] for p in current_archive["pages"] for e in p["entries"] if any(plan["targetStart"] <= x <= plan["targetEnd"] for x in e["periods"])}
    if known_urls != {l["url"] for l in source["landings"]}:
        raise ValueError("LANDING_INVENTORY_NOT_EXACTLY_ENUMERATED_CANDIDATES")
    expected_entries = {}
    for page in source["pages"]:
        for entry in page["entries"]:
            expected_entries.setdefault(entry["url"], []).append(dict(entry, indexAttemptId=page["attemptId"]))
    for current in (archive, theme_archive):
        for page in current["pages"] if current else []:
            for entry in page["entries"]:
                e = dict(entry, indexAttemptId=page["attemptId"], jsonLocator=entry["entryJsonLocator"])
                if e not in expected_entries.setdefault(entry["url"], []):
                    expected_entries[entry["url"]].append(e)
    attachments, field_schemas, landings = {}, {}, []
    for landing in sorted(source["landings"], key=lambda x: x["url"]):
        row = rows[landing["attemptId"]]
        acquired_url(row, landing["url"])
        if sorted(map(digest, landing["indexEntries"])) != sorted(map(digest, expected_entries[landing["url"]])):
            raise ValueError("INDEX_ENTRY_BINDING_MISMATCH")
        parsed = parse_landing(c.html(row), landing["url"])
        actual_links = [{k: a[k] for k in ("url", "title", "anchorHtml", "namedPeriods")} for a in landing["attachments"]]
        if parsed["attachments"] != actual_links or any(parsed[k] != landing[k] for k in parsed if k != "attachments"):
            raise ValueError("LANDING_ATTACHMENT_REPLAY_MISMATCH")
        indexed_periods = sorted({p for e in landing["indexEntries"] for p in e["periods"]})
        for entry in landing["indexEntries"]:
            if entry["url"] != landing["url"]:
                raise ValueError("INDEX_LANDING_URL_MISMATCH")
            if entry.get("entryHtml"):
                if entry["entryHtml"] not in c.html(rows[entry["indexAttemptId"]]):
                    raise ValueError("INDEX_ENTRY_BYTES_MISMATCH")
        period = indexed_periods[0] if len(indexed_periods) == 1 else None
        blockers = []
        if not period or landing["periods"] != [period]:
            blockers.append("INDEX_LANDING_PERIOD_CONFLICT")
        candidates = []
        for a in landing["attachments"]:
            ar = rows[a["attemptId"]]
            if ar["requestUrl"] != a["url"]:
                # Only an explicitly recorded http->https request upgrade allowed.
                if ar["discoveredUrl"] != a["url"]:
                    raise ValueError("ATTACHMENT_ACQUISITION_URL_MISMATCH")
            sha = ar["storedBytes"]["sha256"] if ar["outcome"] == "SUCCESS" and ar["storedBytes"] else None
            ca = dict(a, sha256=sha)
            candidates.append(ca)
            if sha:
                probe = probe_bytes(c.bytes(ar), a["url"], ar["contentType"])
                report_periods = content_periods(probe)
                ca["contentReportPeriods"] = report_periods
                if report_periods and report_periods != [period]:
                    probe["blockers"].append("CONTENT_REPORT_PERIOD_CONFLICT")
                elif not report_periods and (probe["sheets"] or probe["tables"]):
                    probe["blockers"].append("CONTENT_REPORT_PERIOD_UNPROVEN")
                probe["probeStatus"] = "PARTIAL" if probe["blockers"] else "PROBED"
                mapping = field_map(probe, period or "0000-00")
                if save_extracted:
                    dump(c.repo / f"research-data/market-regime/extracted/csrc-r2c1/{ar['attemptId']}.json", dict(probe=probe, fieldMap=mapping))
                shape_id = mapping["fieldSchemaSignature"]
                field_schemas.setdefault(shape_id, dict(fieldSchemaId=shape_id, tables=[{k: v for k, v in t.items() if k not in ("monthlyRows", "ytdRows", "titles")} for t in mapping["tables"]], exampleAttempts=[]))
                if len(field_schemas[shape_id]["exampleAttempts"]) < 3:
                    field_schemas[shape_id]["exampleAttempts"].append(ar["attemptId"])
                field_status = mapping["fields"]
                # Keep candidate headers in the deduplicated schema; per-artifact
                # field matrix carries the target cell/state and period evidence.
                for field in field_status.values():
                    for candidate in field["candidates"]:
                        candidate["headerCoordinates"] = [[h["row"], h["column"]] for h in candidate.pop("headerPath")]
                attachments[a["attemptId"]] = dict(attemptId=a["attemptId"], url=a["url"], sha256=sha,
                                                     contentReportPeriods=report_periods, probe=compact_probe(probe), fieldSchemaId=shape_id, fields=field_status)
            else:
                attachments[a["attemptId"]] = dict(attemptId=a["attemptId"], url=a["url"], sha256=None,
                                                     probe=None, fieldSchemaId=None, fields={}, blockers=["ATTACHMENT_RETRIEVAL_FAILED"])
        choice = disambiguate(candidates, period)
        landings.append(dict(url=landing["url"], attemptId=landing["attemptId"], periods=indexed_periods,
                             title=landing["title"], indexEntries=landing["indexEntries"], publication=publication(landing),
                             attachments=candidates, disambiguation=choice, blockers=blockers))
    ledger = []
    for period in target_periods(plan):
        releases = [l for l in landings if period in l["periods"]]
        chosen = [a for l in releases for a in l["disambiguation"]["selectedAttemptIds"]]
        available = [attachments[a] for a in chosen]
        all_attachments = [attachments[a["attemptId"]] for l in releases for a in l["attachments"]]
        blockers = sorted({b for l in releases for b in l["blockers"]})
        if not releases:
            blockers.append("MISSING_IN_INSPECTED_OFFICIAL_INDEXES")
        if any(l["disambiguation"]["status"] != "UNIQUE_BYTES_CANDIDATE" for l in releases):
            blockers.append("ATTACHMENT_SELECTION_UNRESOLVED")
        if len({a["sha256"] for a in available}) > 1:
            blockers.append("MULTIPLE_RELEASE_BYTES_REVISION_UNPROVEN")
        fields = {}
        for metric in plan["metrics"]:
            ready = bool(available) and not blockers and all(a["fields"].get(metric, {}).get("status") == "FIELD_CONDITIONS_READY" for a in available)
            fields[metric] = "FIELD_CONDITIONS_READY" if ready else "PARTIAL"
        ledger.append(dict(period=period, inventoryStatus="MISSING" if not releases else "INDEXED", landingAttemptIds=[l["attemptId"] for l in releases],
                           attachmentAttemptIds=[a["attemptId"] for l in releases for a in l["attachments"]],
                           formats=sorted({a["probe"]["actualFormat"] for a in all_attachments if a["probe"]}),
                           filenameFormats=sorted({a["probe"]["extension"] + ":" + a["probe"]["actualFormat"] for a in all_attachments if a["probe"]}),
                           fieldSchemaIds=sorted({a["fieldSchemaId"] for a in all_attachments if a["fieldSchemaId"]}), fields=fields, blockers=blockers))
    format_eras = runs(ledger, lambda c: c["formats"])
    field_eras = runs(ledger, lambda c: dict(schemaIds=c["fieldSchemaIds"], fields=c["fields"]))
    transitions = []
    for before, after in zip(ledger, ledger[1:]):
        if before["formats"] != after["formats"] or before["fieldSchemaIds"] != after["fieldSchemaIds"]:
            transitions.append(dict(before=before["period"], after=after["period"], beforeAttachments=before["attachmentAttemptIds"],
                                    afterAttachments=after["attachmentAttemptIds"], status="ADJACENT_PROBED" if before["formats"] and after["formats"] else "GAP_BOUNDARY_UNRESOLVED"))
    network = [r for r in c.rows if r["outcome"] != "CACHE_VERIFIED"]
    physical = len(network) + sum(len(r["redirects"]) for r in network)
    content = dict(plan=plan, planSha256=digest(plan), sourceSnapshotSha256=digest(source), navigation=source["navigation"],
                   pages=source["pages"], archive=archive, themeArchive=theme_archive, landings=landings, attachments=list(attachments.values()),
                   fieldSchemas=list(field_schemas.values()), ledger=ledger, formatEras=format_eras, fieldEras=field_eras,
                   filenameFormatEras=runs(ledger, lambda c: c["filenameFormats"]),
                   transitionChecks=transitions, retrievalAttempts=c.rows,
                   summary=dict(targetCount=len(ledger), indexedPeriods=sum(bool(c["landingAttemptIds"]) for c in ledger),
                                missingPeriods=[c["period"] for c in ledger if not c["landingAttemptIds"]],
                                landingCount=len(landings), attachmentLinkCount=sum(len(l["attachments"]) for l in landings),
                                uniqueAttachmentUrls=len({a["url"] for a in attachments.values()}),
                                uniqueAttachmentHashes=len({a["sha256"] for a in attachments.values() if a["sha256"]}),
                                attachmentBytes=sum(rows[a]["storedBytes"]["byteSize"] for a in attachments if rows[a]["storedBytes"]),
                                actualFormatCounts=dict(Counter(a["probe"]["actualFormat"] if a["probe"] else "RETRIEVAL_FAILED" for a in attachments.values())),
                                fieldReadyPeriodCounts={m: sum(c["fields"][m] == "FIELD_CONDITIONS_READY" for c in ledger) for m in plan["metrics"]},
                                physicalRequests=physical, acquisitionAttempts=len(network), cacheVerifications=len(c.rows)-len(network),
                                responseBytes=sum(r["storedBytes"]["byteSize"] if r["storedBytes"] else 0 for r in network) + sum(d["storedBytes"]["byteSize"] for r in network for d in r["redirects"]),
                                rawUniqueBytes=sum(p.stat().st_size for p in (c.root / "sha256").glob("*.bin")),
                                formalObservationCount=0, datasetCoverage="PARTIAL", revisionCoverage="PARTIAL", firstRelease="UNPROVEN"))
    return dict(schemaVersion="csrc-c1-probe-1.0.0", generatedAt=generated_at, contentSha256=digest(content), **content)


def write_evidence(path, result):
    # One compact JSON value per top-level record reduces repeated formatting;
    # remains a standard JSON document readable without a special tool.
    def encoded(v):
        return json.dumps(v, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    text = "{\n" + ",\n".join(json.dumps(k) + ":" + ("[\n" + ",\n".join(encoded(r) for r in v) + "\n]" if isinstance(v, list) else encoded(v)) for k, v in result.items()) + "\n}\n"
    atomic_write_bytes(path, text.encode())


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command", choices=["build", "validate"])
    p.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[2])
    p.add_argument("--generated-at")
    args = p.parse_args()
    output = args.repo_root / OUT / "inventory-evidence.v1.json"
    existing = json.loads(output.read_text(encoding="utf-8")) if output.exists() else None
    timestamp = args.generated_at or (existing["generatedAt"] if existing else now())
    result = build(args.repo_root, timestamp, save_extracted=args.command == "build")
    if args.command == "validate":
        if existing != result:
            raise ValueError("EVIDENCE_REPLAY_MISMATCH")
        print("PASS: all raw hashes, index/landing/attachment links, probes and 260 ledger cells replayed")
    else:
        write_evidence(output, result)
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
