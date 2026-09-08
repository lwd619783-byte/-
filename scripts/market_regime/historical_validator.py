"""Fail-closed R2 graph validation on local bytes; never retrieves URLs."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from jsonschema import Draft202012Validator, FormatChecker

from .catalog import catalog_content_projection
from .collectors import extract_html
from .hashing import canonical_sha256, sha256_bytes
from .historical import (SIDECARS, artifact_identity, canonical_order, coverage_summary,
                         dataset_content_projection, plan_identity, plan_projection,
                         release_identity, target_grid)
from .time_semantics import date_only_safe_available_at, is_observation_eligible, parse_aware_datetime
from .validator import _safe_relative_path, _value_date_bounds, validate_catalog


ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads((ROOT / "config/market-regime/historical-dataset.schema.json").read_text(encoding="utf-8"))
R1_SCHEMA = json.loads((ROOT / "config/market-regime/observation-catalog.schema.json").read_text(encoding="utf-8"))
OFFICIAL_DOMAINS = ("pbc.gov.cn", "csrc.gov.cn", "sse.com.cn", "szse.cn", "bse.cn")
FORMATS = FormatChecker()


@FORMATS.checks("date-time", raises=ValueError)
def rfc3339(value):
    if not isinstance(value, str):
        return True
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})", value):
        return False
    parse_aware_datetime(value)
    return True


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise ValueError(reason)


def schema_check(value, definition: str | None = None, *, r1=False) -> None:
    canonical_sha256(value)  # Reject NaN/Infinity even in free-form R1 metadata.
    schema = R1_SCHEMA if r1 else SCHEMA
    if definition:
        schema = {"$ref": f"#/$defs/{definition}", "$defs": schema["$defs"]}
    errors = list(Draft202012Validator(schema, format_checker=FORMATS).iter_errors(value))
    if errors:
        raise ValueError("schema: " + "; ".join(f"{'.'.join(map(str, e.absolute_path))}: {e.message}" for e in errors[:8]))


def index(records: list[dict], key: str) -> dict:
    result = {r[key]: r for r in records}
    require(len(result) == len(records), f"duplicate {key}")
    return result


def official_url(url: str, roots: list[str]) -> bool:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        return False
    return any(parsed.netloc == urlsplit(root).netloc and
               parsed.path.startswith(urlsplit(root).path) for root in roots)


def safe_file(root: Path, local_path: str) -> Path:
    require(_safe_relative_path(local_path) and "\\" not in local_path and ":" not in local_path
            and not any(c in local_path for c in ('\x00', '%', '?', '#'))
            and all(p and p not in (".", "..") and not p.endswith((".", " "))
                    for p in local_path.split("/")), "unsafe path")
    target = (root / local_path).resolve()
    require(target.is_relative_to(root.resolve()) and target.is_file(), "unsafe path or missing local bytes")
    return target


def resolve_plan(plan_id: str, plans: list[dict]) -> dict:
    require(isinstance(plans, list) and bool(plans), "plan registry missing")
    ids, versions = set(), set()
    for plan in plans:
        schema_check(plan, "plan")
        require(plan["planId"] == plan_identity(plan), "plan identity/content mismatch")
        version_key = (plan["planName"], plan["planVersion"])
        require(plan["planId"] not in ids and version_key not in versions, "duplicate/conflicting plan identity/version")
        ids.add(plan["planId"])
        versions.add(version_key)
        sources = index(plan["sources"], "sourceId")
        index(plan["targetWindows"], "windowId")
        for source in sources.values():
            pg = source["pagination"]
            require(pg["endPage"] >= pg["startPage"] and pg["requestLimit"] >= pg["endPage"] - pg["startPage"] + 1,
                    "invalid pagination bounds/request limit")
            for url in source["officialRoots"] + source["indexUrls"]:
                require(official_url(url, source["officialRoots"]), "source plan URL outside official roots")
                host = urlsplit(url).hostname or ""
                if plan["purpose"] == "HISTORICAL":
                    require(any(host == d or host.endswith('.' + d) for d in OFFICIAL_DOMAINS), "unadmitted official source root")
                else:
                    require(host.endswith(".invalid"), "synthetic plan must use reserved .invalid URLs")
        seen = set()
        for cell in target_grid(plan):
            require(cell["sourceId"] in sources, "target source missing from plan")
            require(cell["metricId"] not in ("VAL_CSI300_TTM_PE", "VAL_MARKET_PE_PERCENTILE"), "PE remains NO_GO")
            key = (cell["sourceId"], cell["metricId"], cell["field"], cell["period"])
            require(key not in seen, "overlapping target windows duplicate denominator")
            seen.add(key)
    matches = [p for p in plans if p["planId"] == plan_id]
    require(len(matches) == 1, "manifest plan reference does not resolve uniquely")
    return matches[0]


class Graph:
    def __init__(self, dataset, catalog, plan, root):
        self.d, self.c, self.p, self.root = dataset, catalog, plan, root
        self.artifacts = index(catalog["artifacts"], "artifactId")
        self.definitions = index(catalog["sourceDefinitions"], "sourceDefinitionId")
        self.observations = index(catalog["observations"], "observationId")
        self.exchanges = index(catalog["exchangeMarketObservations"], "observationId")
        require(not self.observations.keys() & self.exchanges.keys(), "cross-collection observation ID collision")
        self.sources = index(plan["sources"], "sourceId")
        self.windows = index(plan["targetWindows"], "windowId")
        self.events = index(dataset["releaseEvents"], "releaseEventId")
        self.bindings = index(dataset["artifactBindings"], "artifactId")
        self.extractions = index(dataset["fieldExtractions"], "extractionId")
        self.cells = index(dataset["coverageLedger"], "cellId")
        for collection, key in SIDECARS.items():
            index(dataset[collection], key)
        self.bytes = {}
        self.extraction_targets = {}

    def url(self, url, source_id):
        require(source_id in self.sources and official_url(url, self.sources[source_id]["officialRoots"]),
                "URL/source outside frozen plan roots")

    def stored(self, record):
        body = safe_file(self.root, record["localPath"]).read_bytes()
        require(len(body) == record["byteSize"], "byteSize mismatch")
        require(sha256_bytes(body) == record["sha256"], "sha256 bytes mismatch")
        return body

    def locator(self, loc, *, source=None):
        aid = loc["artifactId"]
        require(aid in self.bytes, "locator artifact missing")
        if source:
            require(self.artifacts[aid]["sourceId"] == source, "locator source mismatch")
        start, size = loc["byteOffset"], loc["byteLength"]
        require(self.bytes[aid][start:start + size] == loc["text"].encode("utf-8"), "locator bytes/text mismatch")
        return aid

    def raw(self, aid):
        a, b = self.artifacts[aid], self.bindings[aid]
        return (self.p["purpose"] == "HISTORICAL" and a["artifactRole"] == "RAW_SOURCE"
                and b["completeResponse"] and b["contentValidation"] == "VALIDATED"
                and a["parseStatus"] != "FAILED")

    def validate_artifacts(self):
        require(self.bindings.keys() == self.artifacts.keys(), "artifact binding set mismatch")
        for aid, a in self.artifacts.items():
            self.url(a["sourceUrl"], a["sourceId"])
            self.bytes[aid] = self.stored(a)
        for aid, a in self.artifacts.items():
            b = self.bindings[aid]
            require(b["releaseEventId"] in self.events, "artifact release reference missing")
            require(aid == artifact_identity(a, b["releaseEventId"]), "artifact event identity mismatch")
            require(self.locator(b["contentEvidence"], source=a["sourceId"]) == aid, "content evidence must bind own bytes")
            if a["artifactRole"] == "RAW_SOURCE":
                require(self.p["purpose"] == "HISTORICAL" and b["completeResponse"], "fixture cannot masquerade as RAW_SOURCE")
                require(not re.search(r"fixture|synthetic|controlled.test", a["localPath"], re.I)
                        and not re.search(rb"fixture|synthetic|controlled.test", self.bytes[aid], re.I),
                        "fixture excerpt cannot masquerade as RAW_SOURCE")
                require(b["contentValidation"] == "VALIDATED", "unvalidated raw content")
            if b["contentValidation"] == "VALIDATED":
                require(not re.search(rb"<title[^>]*>[^<]*(?:error|login|access denied|captcha)|<form[^>]*[^<]*login", self.bytes[aid], re.I),
                        "200 error/login page is not data")
            matching = [r for r in self.d["retrievalAttempts"] if r["outcome"] in ("SUCCESS", "CACHE_VERIFIED")
                        and r["sourceId"] == a["sourceId"] and r["finalUrl"] == a["sourceUrl"]
                        and r["storedBytes"] == {k: a[k] for k in ("localPath", "sha256", "byteSize")}
                        and r["attemptedAt"] == a["fetchedAt"] and r["httpStatus"] == a["httpStatus"]]
            require(bool(matching), "artifact requires matching successful retrieval evidence")

    def validate_retrievals(self):
        for r in self.d["retrievalAttempts"]:
            self.url(r["requestUrl"], r["sourceId"])
            if r["finalUrl"]:
                self.url(r["finalUrl"], r["sourceId"])
            require(set(r["candidateReleaseEventIds"]) <= self.events.keys(), "retrieval candidate missing")
            if r["storedBytes"]:
                self.stored(r["storedBytes"])
            status = r["httpStatus"]
            if r["outcome"] in ("SUCCESS", "CACHE_VERIFIED"):
                require(status is not None and 200 <= status < 300 and r["transportError"] is None
                        and r["storedBytes"] is not None and r["finalUrl"] is not None, "pseudo-success retrieval")
            elif r["outcome"] == "HTTP_ERROR":
                require(status is not None and not 200 <= status < 300 and r["transportError"] is None, "invalid HTTP failure")
            elif r["outcome"] == "TRANSPORT_ERROR":
                require(status is None and bool(r["transportError"]) and r["storedBytes"] is None, "invalid transport failure")
            else:
                require(status is not None and 200 <= status < 300 and r["storedBytes"] is not None
                        and r["transportError"] is None, "content rejection requires saved response bytes")

    def validate_events(self):
        for eid, e in self.events.items():
            require(eid == release_identity(e), "release event identity mismatch")
            self.url(e["landingUrl"], e["sourceId"])
            aids = {e["landingArtifactId"], *e["attachmentArtifactIds"]}
            require(aids <= self.artifacts.keys(), "release artifact reference missing")
            require(len(aids) == 1 + len(e["attachmentArtifactIds"]), "landing cannot be attachment")
            require(self.artifacts[e["landingArtifactId"]]["sourceUrl"] == e["landingUrl"], "landing URL mismatch")
            for aid in aids:
                a = self.artifacts[aid]
                require(self.bindings[aid]["releaseEventId"] == eid, "artifact reused across release events")
                require(all(a[k] == e[k] for k in ("sourceId", "publicationDateTime", "publicationDate",
                                                   "releaseAvailableAt", "releaseConfidenceClass")), "artifact release clock mismatch")
            require({aid for aid,b in self.bindings.items() if b["releaseEventId"] == eid} == aids,
                    "orphan event artifact")
            pub = e["publicationDateTime"]
            if e["releaseConfidenceClass"] in ("EXACT_TIMESTAMP", "BACKCAST_RELEASED_LATER", "DATE_ONLY_SAFE"):
                expected = pub or date_only_safe_available_at(e["publicationDate"])
                require(e["releaseAvailableAt"] == expected, "unsafe release availability")
            self.locator(e["publicationEvidence"], source=e["sourceId"])
            require(e["publicationEvidence"]["artifactId"] in aids, "publication locator outside event")
            publication_text = e["publicationEvidence"]["text"]
            raw_publication = pub or e["publicationDate"]
            require(raw_publication is not None and (raw_publication in publication_text or
                    (pub is not None and pub[:19].replace('T', ' ') in publication_text)), "publication time not in evidence")
            for period in e["coveredPeriods"]:
                errors = []
                require(_value_date_bounds(period, "coveredPeriod", errors) is not None and not errors, "invalid covered period")
            links = index(e["attachmentEvidence"], "artifactId")
            require(links.keys() == set(e["attachmentArtifactIds"]), "attachment links incomplete")
            for aid, link in links.items():
                require(self.locator(link["locator"]) == e["landingArtifactId"], "attachment link not on landing")
                text = link["locator"]["text"]
                hrefs = [href for href, _ in extract_html(text)[1]]
                require(link["url"] == self.artifacts[aid]["sourceUrl"] and
                        (link["url"] in text or any(urljoin(e["landingUrl"], href) == link["url"] for href in hrefs)),
                        "attachment href mismatch")
            for loc in e["firstReleaseEvidence"] + e["revisionEvidence"]:
                self.locator(loc, source=e["sourceId"])
            require(set(e["firstReleaseEvidenceArtifactIds"]) == {l["artifactId"] for l in e["firstReleaseEvidence"]},
                    "first-release evidence references mismatch")
            if e["releaseKind"] == "FIRST_RELEASE":
                require(bool(e["firstReleaseEvidence"]), "first release unproven")
                require(e["releaseConfidenceClass"] in ("EXACT_TIMESTAMP", "DATE_ONLY_SAFE"), "first release confidence inconsistent")
            else:
                require(not e["firstReleaseEvidence"], "non-first event cannot claim first-release evidence")
            if e["releaseKind"] == "BACKCAST":
                require(e["releaseConfidenceClass"] == "BACKCAST_RELEASED_LATER", "backcast confidence mismatch")
            if e["releaseConfidenceClass"] == "BACKCAST_RELEASED_LATER":
                require(e["releaseKind"] == "BACKCAST", "backcast event kind mismatch")
            if e["releaseKind"] == "REVISION":
                require(bool(e["revisionEvidence"]), "revision authority unproven")

    def validate_extractions(self):
        for xid, x in self.extractions.items():
            require(x["releaseEventId"] in self.events and x["rawArtifactId"] in self.artifacts
                    and x["sourceDefinitionId"] in self.definitions, "extraction reference missing")
            e = self.events[x["releaseEventId"]]
            a = self.artifacts[x["rawArtifactId"]]
            definition = self.definitions[x["sourceDefinitionId"]]
            require(self.bindings[x["rawArtifactId"]]["releaseEventId"] == e["releaseEventId"], "extraction event mismatch")
            require(a["sourceId"] == definition["sourceId"] == e["sourceId"], "extraction source mismatch")
            require(x["period"] in e["coveredPeriods"], "extraction period outside release")
            period_errors = []
            period = _value_date_bounds(x["period"], "extraction.period", period_errors)
            require(not period_errors and period is not None, "invalid extraction period")
            require(period[0] >= date.fromisoformat(definition["effectiveFrom"])
                    and (definition["effectiveTo"] is None or period[1] <= date.fromisoformat(definition["effectiveTo"])),
                    "extraction definition period mismatch")
            semantics = x["periodSemantics"]
            require((semantics == "DAY") == (len(x["period"]) == 10), "period semantics/date shape mismatch")
            if semantics == "YEAR_END":
                require(x["period"].endswith('-12'), "YEAR_END requires December")
            if semantics == "QUARTER_END":
                require(x["period"][-2:] in ('03','06','09','12'), "QUARTER_END requires quarter end")
            require(self.locator(x["locator"]) == x["rawArtifactId"], "field locator must bind raw artifact")
            self.locator(x["basisEvidence"], source=e["sourceId"])
            require(all(v in x["locator"]["text"] for v in (x["rawFieldName"], x["rawUnit"], x["rawValueText"])),
                    "raw field/unit/value missing from locator")
            require(re.search(r"(?<![\d.+-])" + re.escape(x["rawValueText"]) + r"(?![\d.])", x["locator"]["text"]) is not None,
                    "raw numeric token is only a substring of another value")
            require(bool(re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)", x["rawValueText"]))
                    and float(x["rawValueText"]) == x["rawValue"], "raw numeric text mismatch")
            conversion = x["unitConversion"]
            require(conversion["outputUnit"] == definition["unit"], "conversion output unit mismatch")
            if conversion["rule"] == "IDENTITY":
                require(conversion["factor"] == 1 and x["rawUnit"] == conversion["outputUnit"], "invalid identity conversion")
            require(not (x["observationId"] and x["exchangeObservationId"]), "extraction has two observation targets")
            oid = x["observationId"] or x["exchangeObservationId"]
            if oid is None:
                continue  # Evidence-only, e.g. YTD: no numeric monthly observation.
            require(any(cell["period"] == x["period"] and cell["field"] == x["field"]
                        and x["sourceDefinitionId"] in cell["sourceDefinitionIds"] for cell in target_grid(self.p)),
                    "numeric extraction outside frozen target grid")
            key = (oid, x["field"])
            require(key not in self.extraction_targets, "duplicate field extraction target")
            self.extraction_targets[key] = x
            o = (self.observations if x["observationId"] else self.exchanges).get(oid)
            require(o is not None, "extraction observation reference missing")
            require(o["sourceDefinitionId"] == x["sourceDefinitionId"] and o["releaseAvailableAt"] == e["releaseAvailableAt"],
                    "observation/extraction definition or release mismatch")
            if x["observationId"]:
                require(x["field"] == "value" and o["rawArtifactId"] == x["rawArtifactId"]
                        and o["valueDate"] == x["period"] and o["transformVersion"] == x["parserVersion"], "observation field lineage mismatch")
                require(o["releaseConfidenceClass"] == e["releaseConfidenceClass"], "extraction confidence mismatch")
                require(x["periodSemantics"] != "YTD", "YTD cannot become MONTH value")
                if e["releaseKind"] == "FIRST_RELEASE":
                    require(o["revisionSequence"] == 0 and o["supersedesObservationId"] is None
                            and o["qualityStatus"] in ("VERIFIED", "PROVISIONAL"), "invalid first-release lineage")
                if e["releaseKind"] == "REVISION":
                    require(o["supersedesObservationId"] is not None and o["qualityStatus"] == "REVISED", "revision lineage gap")
                if e["releaseKind"] == "BACKCAST":
                    require(o["qualityStatus"] == "BACKCAST", "backcast quality mismatch")
            else:
                require(x["field"] != "value" and o["tradeDate"] == x["period"] and x["periodSemantics"] == "DAY",
                        "exchange field/date semantics mismatch")
                require(parse_aware_datetime(e["releaseAvailableAt"]).date() >= date.fromisoformat(o["tradeDate"]),
                        "exchange trade date after release")
                errors = []
                period = _value_date_bounds(x["period"], "exchange.period", errors)
                require(not errors and period[0] >= date.fromisoformat(definition["effectiveFrom"])
                        and (definition["effectiveTo"] is None or period[1] <= date.fromisoformat(definition["effectiveTo"])),
                        "exchange definition period mismatch")
            require(o[x["field"]] == x["rawValue"] * conversion["factor"], "extracted value mismatch")
        for oid in self.observations:
            require((oid, "value") in self.extraction_targets, "numeric observation missing extraction")
        for oid,o in self.exchanges.items():
            for field in ("turnoverValue", "totalMarketCap", "negotiableMarketCap"):
                if o[field] is not None:
                    require((oid, field) in self.extraction_targets, "numeric exchange field missing extraction")
        for xid,x in self.extractions.items():
            parents = x["predecessorExtractionIds"]
            require(set(parents) <= self.extractions.keys() and xid not in parents, "broken/self extraction lineage")
            for parent in parents:
                previous = self.extractions[parent]
                require(previous["period"] == x["period"] and previous["field"] == x["field"]
                        and previous["releaseEventId"] != x["releaseEventId"], "extraction predecessor series mismatch")
                old_definition = self.definitions[previous["sourceDefinitionId"]]
                new_definition = self.definitions[x["sourceDefinitionId"]]
                require((old_definition["sourceId"], old_definition["metricId"]) ==
                        (new_definition["sourceId"], new_definition["metricId"]), "extraction lineage crosses source/metric")
                require(parse_aware_datetime(self.events[previous["releaseEventId"]]["releaseAvailableAt"])
                        < parse_aware_datetime(self.events[x["releaseEventId"]]["releaseAvailableAt"]), "extraction lineage cycle/time regression")
            if x["observationId"]:
                predecessor = self.observations[x["observationId"]]["supersedesObservationId"]
                expected = [self.extraction_targets[(predecessor, "value")]["extractionId"]] if predecessor else []
                require(parents == expected, "observation/extraction predecessor mismatch")
            elif x["exchangeObservationId"]:
                kind = self.events[x["releaseEventId"]]["releaseKind"]
                require((kind == "REVISION") == bool(parents), "exchange revision lineage gap")
        groups = defaultdict(list)
        for oid,o in self.observations.items():
            groups[(o["sourceId"],o["metricId"],o["valueDate"])].append(o)
        for group in groups.values():
            ordered = sorted(group, key=lambda o: o["revisionSequence"])
            require(ordered[0]["revisionSequence"] == 0, "collected lineage must start at zero (not proof of first release)")
            for previous,current in zip(ordered, ordered[1:]):
                require(current["revisionSequence"] == previous["revisionSequence"] + 1
                        and current["supersedesObservationId"] == previous["observationId"], "revision gap/branch/same-sequence conflict")
        exchange_groups = defaultdict(list)
        for x in self.extractions.values():
            if x["exchangeObservationId"]:
                o = self.exchanges[x["exchangeObservationId"]]
                exchange_groups[(o["exchange"], x["period"], x["field"])].append(x)
        for group in exchange_groups.values():
            ordered = sorted(group, key=lambda x:parse_aware_datetime(self.events[x["releaseEventId"]]["releaseAvailableAt"]))
            for previous,current in zip(ordered,ordered[1:]):
                require(current["predecessorExtractionIds"] == [previous["extractionId"]], "exchange revision branch/conflict")

    def admissible(self, x, cutoff):
        e = self.events[x["releaseEventId"]]
        o = self.observations.get(x["observationId"]) if x["observationId"] else self.exchanges.get(x["exchangeObservationId"])
        if o is None or e["releaseKind"] == "UNRESOLVED" or not is_observation_eligible(e, cutoff):
            return False
        evidence_ids = {e["landingArtifactId"], *e["attachmentArtifactIds"], x["rawArtifactId"],
                        x["basisEvidence"]["artifactId"], e["publicationEvidence"]["artifactId"],
                        *(l["artifactId"] for l in e["firstReleaseEvidence"] + e["revisionEvidence"])}
        return all(self.raw(aid) for aid in evidence_ids)

    def validate_coverage(self):
        grid = {c["cellId"]: c for c in target_grid(self.p)}
        require(grid.keys() == self.cells.keys(), "coverage denominator grid mismatch: missing/extra cell")
        admitted = set()
        for cid, expected in grid.items():
            r = self.cells[cid]
            require(all(r[k] == v for k,v in expected.items()), "coverage cell identity mismatch")
            require(set(r["sourceDefinitionIds"]) <= self.definitions.keys(), "plan definition reference missing")
            for did in r["sourceDefinitionIds"]:
                definition = self.definitions[did]
                require(definition["sourceId"] == r["sourceId"] and definition["metricId"] == r["metricId"], "plan definition mapping mismatch")
            require(set(r["candidateReleaseEventIds"]) <= self.events.keys()
                    and set(r["evidenceArtifactIds"]) <= self.artifacts.keys(), "coverage evidence/candidate missing")
            for eid in r["candidateReleaseEventIds"]:
                require(self.events[eid]["sourceId"] == r["sourceId"] and r["period"] in self.events[eid]["coveredPeriods"], "coverage candidate source/period mismatch")
            for loc in r["statusEvidence"]:
                require(self.locator(loc, source=r["sourceId"]) in r["evidenceArtifactIds"], "coverage status evidence mismatch")
            matches = [x for x in self.extractions.values() if x["period"] == r["period"] and x["field"] == r["field"]
                       and x["sourceDefinitionId"] in r["sourceDefinitionIds"]]
            require({x["releaseEventId"] for x in matches} <= set(r["candidateReleaseEventIds"]), "discovered vintage silently omitted")
            eligible = {x["observationId"] or x["exchangeObservationId"] for x in matches if self.admissible(x, self.p["datasetAsOf"])}
            unresolved = [c for c in self.d["conflicts"] if cid in c["cellIds"] and c["status"] == "UNRESOLVED"]
            if unresolved:
                require(r["status"] == "UNRESOLVED_RELEASE_CONFLICT", "unresolved conflict not propagated")
                eligible = set()
            require(set(r["admittedObservationIds"]) == eligible, "coverage admitted set differs from qualified vintages (fixture/proxy/gap)")
            require((r["status"] == "AVAILABLE") == bool(eligible), "AVAILABLE must contain qualified vintage; gap cannot manufacture zero")
            admitted.update(eligible)
            if r["status"] in ("STRUCTURALLY_UNAVAILABLE", "SOURCE_ABSENT_CONFIRMED", "NOT_YET_RELEASED"):
                require(bool(r["statusEvidence"]), "status requires official mechanism/absence/release evidence")
                if self.p["purpose"] == "HISTORICAL":
                    require(all(self.raw(l["artifactId"]) for l in r["statusEvidence"]), "status cannot use fixture evidence")
                if r["status"] == "NOT_YET_RELEASED":
                    require(bool(r["candidateReleaseEventIds"]) and all(parse_aware_datetime(self.events[eid]["releaseAvailableAt"])
                            > parse_aware_datetime(self.p["datasetAsOf"]) for eid in r["candidateReleaseEventIds"]), "not-yet requires proven later release")
            if r["status"] == "SOURCE_UNREACHABLE":
                require(any(a["sourceId"] == r["sourceId"] and a["outcome"] in ("HTTP_ERROR", "TRANSPORT_ERROR")
                            for a in self.d["retrievalAttempts"]), "unreachable requires failure record")
            if r["status"] == "UNRESOLVED_RELEASE_CONFLICT":
                require(bool(unresolved), "conflict status requires retained conflict record")
        for w in self.p["targetWindows"]:
            if w["calendar"]:
                for loc in w["calendar"]["evidence"]:
                    self.locator(loc, source=w["sourceId"])
                    if self.p["purpose"] == "HISTORICAL":
                        require(self.raw(loc["artifactId"]), "daily calendar cannot use fixture evidence")
                text = '\n'.join(l["text"] for l in w["calendar"]["evidence"])
                require(all(d in text for d in w["calendar"]["dates"]), "calendar dates not supported by frozen evidence")
        for scan in self.d["inventoryEvidence"]:
            require(scan["windowId"] in self.windows, "inventory window missing")
            w = self.windows[scan["windowId"]]
            for url in scan["scannedIndexUrls"]:
                self.url(url, w["sourceId"])
            for loc in scan["evidence"]:
                self.locator(loc, source=w["sourceId"])
                if self.p["purpose"] == "HISTORICAL":
                    require(self.raw(loc["artifactId"]), "inventory cannot use fixture evidence")
            if scan["paginationComplete"]:
                require(bool(scan["evidence"]) and set(self.sources[w["sourceId"]]["indexUrls"]) <= set(scan["scannedIndexUrls"]),
                        "inventory pagination evidence incomplete")
        return admitted

    def validate_conflicts(self):
        for c in self.d["conflicts"]:
            require(set(c["cellIds"]) <= self.cells.keys() and set(c["candidateReleaseEventIds"]) <= self.events.keys(), "conflict candidate/cell missing")
            for cid in c["cellIds"]:
                require(set(c["candidateReleaseEventIds"]) <= set(self.cells[cid]["candidateReleaseEventIds"]), "conflict candidate omitted from cell")
            for loc in c["evidence"]:
                self.locator(loc)
            eid = c["resolutionReleaseEventId"]
            if c["status"] == "UNRESOLVED":
                require(eid is None, "unresolved conflict cannot claim resolution")
            else:
                require(eid in self.events and self.events[eid]["releaseKind"] == "REVISION" and bool(c["evidence"]), "conflict requires official revision resolution")
                require(eid in c["candidateReleaseEventIds"], "resolution event not retained as candidate")


def validate_dataset(dataset, catalog, *, plans: list[dict], artifact_root: Path) -> list[str]:
    try:
        schema_check(dataset)
        schema_check(catalog, r1=True)
        m = dataset["manifest"]
        plan = resolve_plan(m["planId"], plans)
        require(m["planContentSha256"] == canonical_sha256(plan_projection(plan)) and m["datasetAsOf"] == plan["datasetAsOf"]
                and m["targetWindows"] == canonical_order(plan["targetWindows"]), "manifest frozen plan mismatch")
        graph = Graph(dataset, catalog, plan, Path(artifact_root))
        graph.validate_artifacts()  # Resolve containment before the unchanged R1 byte validator.
        r1_errors = validate_catalog(catalog, artifact_root=Path(artifact_root), verify_artifacts=True)
        require(not r1_errors, "R1: " + '; '.join(r1_errors))
        graph.validate_retrievals()
        graph.validate_events()
        graph.validate_extractions()
        graph.validate_conflicts()
        admitted = graph.validate_coverage()
        require(m["catalogContentSha256"] == canonical_sha256(catalog_content_projection(catalog)), "catalog business hash mismatch")
        require(m["sidecarContentHashes"] == {k:canonical_sha256(canonical_order(dataset[k])) for k in SIDECARS}, "sidecar hash mismatch")
        require(m["datasetContentSha256"] == canonical_sha256(dataset_content_projection(dataset)), "dataset content hash mismatch")
        summary = coverage_summary(dataset, plan, raw_admitted=admitted)
        require(m["coverageSummary"] == summary, "coverage summary/count mismatch")
        status = ("SYNTHETIC_ONLY" if plan["purpose"] == "SYNTHETIC_OFFLINE" else
                  "ADMITTED" if all(s["datasetCoverageStatus"] == "PASS" for s in summary) else "PARTIAL")
        require(m["admissionStatus"] == status, "admission status mismatch")
    except (ValueError, TypeError, KeyError, OSError, OverflowError) as exc:
        return [str(exc)]
    return []


def select_vintage(dataset, catalog, *, plans, artifact_root, cell_id, cutoff):
    """One-cell contract check, not a weekly manifest/backtest runtime."""
    errors = validate_dataset(dataset, catalog, plans=plans, artifact_root=artifact_root)
    require(not errors, '; '.join(errors))
    require(parse_aware_datetime(cutoff) <= parse_aware_datetime(dataset["manifest"]["datasetAsOf"]), "cutoff after sealed datasetAsOf")
    plan = resolve_plan(dataset["manifest"]["planId"], plans)
    graph = Graph(dataset, catalog, plan, Path(artifact_root))
    cell = graph.cells[cell_id]
    observations = [o for o in catalog["observations"] if o["observationId"] in cell["admittedObservationIds"]
                    and is_observation_eligible(o, cutoff)]
    return max(observations, key=lambda o:o["revisionSequence"], default=None)
