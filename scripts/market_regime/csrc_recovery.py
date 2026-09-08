"""Bounded C1.1 official archive recovery. An additive sidecar, never a vintage."""
from __future__ import annotations

import argparse
import copy
import json
import math
import re
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, unquote, urljoin, urlsplit, urlunsplit

from .collectors import extract_html
from .csrc_field_map import disambiguate, field_map
from .csrc_inventory import (build as baseline_build, compact_probe, content_periods,
                             digest, publication, runs, write_evidence)
from .csrc_retrieval import Collector, anchors, official, parse_index, parse_landing, periods
from .csrc_schema import probe_bytes

RAW = "research-data/market-regime/raw/csrc-r2c1-1"
PLAN = "config/market-regime/csrc-recovery-plan.v1.json"
BASE = "research-data/market-regime/source-catalog/csrc-c1/inventory-evidence.v1.json"
OUT = "research-data/market-regime/source-catalog/csrc-c1/recovery-evidence.v1.json"
ANNUAL = "https://www.csrc.gov.cn/csrc/c101950/c1048063/content.shtml"
GAPS = ["2011-11"] + [f"2017-{m:02d}" for m in range(1, 13)]
SEARCH = "https://www.csrc.gov.cn/getSearch"
VERSION = "csrc-c1.1-recovery-1.0.0"


def text_body(c, row):
    # Decode the saved official response, never the console rendering.
    return c.html(row)


def search_page(c, row):
    if row.get("requestForm") is None or row["outcome"] != "SUCCESS":
        return None
    data = json.loads(c.bytes(row))["data"]
    form = row["requestForm"]
    page = int(form["page"])
    if (data["page"] != page or data["rows"] != 10 or type(data["total"]) is not int
            or not 0 <= data["total"] <= 10000 or not isinstance(data["results"], list)
            or len(data["results"]) != max(0, min(10, data["total"] - (page - 1) * 10))):
        raise ValueError("SEARCH_RESPONSE_BINDING_MISMATCH")
    entries = []
    for n, item in enumerate(data["results"]):
        title = extract_html(item["title"])[0]
        url = official(urljoin(row["finalUrl"], item["url"]))
        entries.append(dict(title=title, rawTitle=item["title"], url=url,
                            publicationDate=item.get("publishedTimeStr", "")[:10] or None,
                            jsonLocator=f"$.data.results[{n}]", periods=periods(title),
                            channelCode=item.get("channelCodeName")))
    return dict(attemptId=row["attemptId"], query=form["searchContent"], channelId=form["channelId"],
                page=page, total=data["total"], entries=entries)


def monthly(title):
    return bool(re.fullmatch(r"(?:19|20)\d{2}年\s*\d{1,2}月(?:份)?\s*(?:统计数据|证券市场月报|证券市场统计数据)", title))


def discovered_entries(c, row):
    page = search_page(c, row)
    if page:
        return page["entries"]
    if row["outcome"] != "SUCCESS" or "html" not in (row.get("contentType") or ""):
        return []
    return parse_index(text_body(c, row), row["finalUrl"])["entries"]


def locator(row, snippet):
    return dict(parentAttemptId=row["attemptId"], text=snippet)


def prove_request(c, request, prior, annual=ANNUAL):
    """Derive every non-seed URL from already saved official bytes, not IDs."""
    url = official(request["url"])
    form = request.get("form")
    if url == annual and form is None:
        return dict(basis="OFFICIAL_ANNUAL_DISCOVERY_HINT_ONLY")
    scripts = [(r, text_body(c, r)) for r in prior if r["outcome"] == "SUCCESS" and r["requestUrl"].endswith("/render.js")]
    for parent in prior:
        if parent["outcome"] != "SUCCESS":
            continue
        html = text_body(c, parent)
        if form is not None:
            match = re.search(r'<meta\s+name="channelid"\s+content="([a-f0-9]+)"', html)
            expected = dict(type="title", searchContent=form.get("searchContent"), channelId=match[1] if match else None,
                            isAgg="true", isIdentifier="true", page=form.get("page"), size="10")
            if url != SEARCH or not match or form != expected:
                continue
            if not isinstance(form["searchContent"], str) or not 1 <= len(form["searchContent"]) <= 80 or not re.fullmatch(r"[1-9]\d{0,2}", form["page"]):
                raise ValueError("BOUNDED_SEARCH_REQUIRED")
            script = next(((r, s) for r, s in scripts if all(x in s for x in
                          ("url: '/getSearch'", "type: 'post'", "searchContent: $('#content').val()",
                           "channelId: $('#channelid').val()", "size: pageInfo.page_size", "page_size: 10"))), None)
            if not script:
                continue
            n = int(form["page"])
            if n > 1:
                previous = next((r for r in reversed(prior) if r.get("requestForm") == dict(form, page=str(n-1)) and r["outcome"] == "SUCCESS"), None)
                if previous is None or n > math.ceil(search_page(c, previous)["total"] / 10):
                    raise ValueError("SEARCH_PAGE_NOT_DERIVED_FROM_METADATA")
            return dict(basis="OFFICIAL_SEARCH_FORM_AND_PAGINATION", **locator(parent, match[0]),
                        scriptAttemptId=script[0]["attemptId"], template="url: '/getSearch'", form=form)
        for a in anchors(html, parent["finalUrl"]):
            if a["url"] == url:
                return dict(basis="OFFICIAL_HREF", **locator(parent, a["anchorHtml"]))
        for m in re.finditer(r'<(?:script|form)\b[^>]*(?:src|action)=["\']([^"\']+)["\'][^>]*>', html, re.I):
            if official_safe(urljoin(parent["finalUrl"], m[1])) == url:
                return dict(basis="OFFICIAL_SCRIPT_OR_FORM_ENDPOINT", **locator(parent, m[0]))
        if urlsplit(url).path == "/getChannelList":
            params = parse_qs(urlsplit(url).query)
            if set(params) != {"channelCode"} or len(params["channelCode"]) != 1:
                continue
            code = params["channelCode"][0]
            literal = "'/getChannelList?channelCode=" + code + "'"
            if literal in html and parent["requestUrl"].endswith("/render.js"):
                return dict(basis="OFFICIAL_LITERAL_API", **locator(parent, literal))
            if any("'/getChannelList?channelCode=' + code" in s for _, s in scripts):
                try:
                    payload = json.loads(c.bytes(parent))
                    children = payload["results"]["children"]
                except (ValueError, KeyError, TypeError):
                    children = []
                for n, child in enumerate(children):
                    if child["channelCode"] == code:
                        return dict(basis="OFFICIAL_CHANNEL_JSON", parentAttemptId=parent["attemptId"],
                                    jsonLocator=f"$.results.children[{n}].channelCode", value=code,
                                    scriptAttemptId=next(r["attemptId"] for r,s in scripts if "'/getChannelList?channelCode=' + code" in s))
        try:
            payload = json.loads(c.bytes(parent))
        except (ValueError, UnicodeError):
            continue
        children = payload.get("results", {}).get("children", []) if isinstance(payload.get("results"), dict) else []
        for n, child in enumerate(children):
            if child.get("staticUrl") and official_safe(urljoin(parent["finalUrl"], child["staticUrl"])) == url:
                return dict(basis="OFFICIAL_CHANNEL_JSON", parentAttemptId=parent["attemptId"],
                            jsonLocator=f"$.results.children[{n}].staticUrl", value=child["staticUrl"])
        page = search_page(c, parent)
        for entry in page["entries"] if page else []:
            if entry["url"] == url:
                return dict(basis="OFFICIAL_SEARCH_RESULT", parentAttemptId=parent["attemptId"],
                            jsonLocator=entry["jsonLocator"], entry=entry)
    raise ValueError("UNOBSERVED_OR_GUESSED_URL_REJECTED")


def official_safe(url):
    try:
        return official(url)
    except ValueError:
        return None


def replay_graph(c, plan):
    prior, edges, pages = [], [], []
    ids = set()
    for row in c.rows:
        if row["attemptId"] in ids:
            raise ValueError("DUPLICATE_RECOVERY_ATTEMPT")
        ids.add(row["attemptId"])
        official(row["requestUrl"])
        discovered=official(row.get("discoveredUrl") or row["requestUrl"])
        parts=urlsplit(discovered)
        if row["requestUrl"]!=urlunsplit(("https",parts.netloc,parts.path,parts.query,"")):
            raise ValueError("RECOVERY_REQUEST_IDENTITY_MISMATCH")
        if row.get("requestMethod","GET") != ("POST" if row.get("requestForm") is not None else "GET"):
            raise ValueError("RECOVERY_REQUEST_METHOD_MISMATCH")
        if row.get("finalUrl"):
            official(row["finalUrl"])
        if row.get("storedBytes"):
            c.bytes(row)
        current=row["requestUrl"]
        for redirect in row["redirects"]:
            c.bytes(redirect)
            if redirect["url"]!=current:
                raise ValueError("RECOVERY_REDIRECT_CHAIN_MISMATCH")
            current=official(urljoin(current,redirect["location"]))
        if row["outcome"]=="SUCCESS" and (row["finalUrl"]!=current or not 200 <= row["httpStatus"] < 300
                                            or not row.get("storedBytes") or row["storedBytes"]["byteSize"] <= 0):
            raise ValueError("RECOVERY_SUCCESS_RESPONSE_MISMATCH")
        request = dict(url=row.get("discoveredUrl") or row["requestUrl"], form=row.get("requestForm"))
        edge = prove_request(c, request, prior, plan["annualHintUrl"])
        if row["outcome"] == "CACHE_VERIFIED":
            original = next((r for r in prior if r["attemptId"] == row["acquisitionAttemptId"]), None)
            if not original or original["outcome"] != "SUCCESS" or any(row.get(k) != original.get(k) for k in ("requestUrl", "requestForm", "storedBytes", "finalUrl")) or row["httpStatus"] is not None:
                raise ValueError("RECOVERY_CACHE_LINK_INVALID")
        else:
            parsed = search_page(c, row)
            if parsed:
                pages.append(parsed)
        edges.append(dict(attemptId=row["attemptId"], **edge))
        prior.append(row)
    return edges, pages


def probe_candidate(c, landing_row, entry):
    period = entry["periods"][0]
    landing = parse_landing(text_body(c, landing_row), landing_row["finalUrl"])
    blockers = []
    if landing_row["outcome"] != "SUCCESS" or landing["periods"] != [period] or not monthly(landing["title"]):
        blockers.append("LANDING_PERIOD_OR_TITLE_UNPROVEN")
    attachments = []
    acquired_links = [(link, r) for link in landing["attachments"] for r in
                      ([r for r in c.rows if r["outcome"] == "SUCCESS" and link["url"] in (r["requestUrl"], r.get("discoveredUrl"))] or [None])]
    for link, row in acquired_links:
        item = dict(link, attemptId=row["attemptId"] if row else None, sha256=None)
        if row:
            probe = probe_bytes(c.bytes(row), link["url"], row["contentType"])
            ps = content_periods(probe)
            if ps != [period] and (probe["sheets"] or probe["tables"]):
                probe["blockers"].append("CONTENT_REPORT_PERIOD_CONFLICT" if ps else "CONTENT_REPORT_PERIOD_UNPROVEN")
            item.update(sha256=row["storedBytes"]["sha256"], byteSize=row["storedBytes"]["byteSize"], finalUrl=row["finalUrl"],
                        filename=unquote(urlsplit(link["url"]).path.rsplit("/",1)[-1]), mime=row["contentType"],
                        contentReportPeriods=ps, probe=compact_probe(probe), fieldMap=field_map(probe, period))
        attachments.append(item)
    choice = disambiguate(attachments, period)
    if choice["status"] != "UNIQUE_BYTES_CANDIDATE":
        blockers.append("ATTACHMENT_BYTES_OR_SELECTION_UNPROVEN")
    selected = [a for a in attachments if a["attemptId"] in choice["selectedAttemptIds"]]
    for a in selected:
        # Format recovery does not require financing fields, but never admits a
        # masquerade, broken container, or period-unproven parsed table.
        if a["probe"]["actualFormat"] not in ("XLS", "DOCX", "DOC_OLE"):
            blockers.append("CONTAINER_UNSUPPORTED_FOR_RECOVERY")
        blockers.extend(b for b in a["probe"]["blockers"] if any(k in b for k in ("MISMATCH", "CONFLICT", "CORRUPT", "UNPROVEN", "PARSER_FAILED")))
    pub = publication(dict(landing, attemptId=landing_row["attemptId"], indexEntries=[dict(entry, indexAttemptId=entry["indexAttemptId"])]))
    return dict(reportPeriod=period, status="MISSING" if blockers else "RECOVERED", landingUrl=landing_row["requestUrl"],
                landingAttemptId=landing_row["attemptId"], indexEntry=entry, publication=pub,
                attachments=attachments, selection=choice, blockers=sorted(set(blockers)),
                firstRelease="UNPROVEN", historicalAttachmentVersion="UNPROVEN", revision="UNPROVEN", formalObservations=[])


def transition(ledger):
    window = [r for r in ledger if "2016-12" <= r["period"] <= "2018-01"]
    known = [r for r in window if r["formats"] in (["XLS"], ["DOCX"])]
    changes = []
    for before, after in zip(known, known[1:]):
        if before["formats"] == ["XLS"] and after["formats"] == ["DOCX"]:
            gap = [r["period"] for r in window if before["period"] < r["period"] < after["period"]]
            changes.append(dict(before=before["period"], after=after["period"], interveningPeriods=gap,
                                beforeAttachments=before["attachmentAttemptIds"], afterAttachments=after["attachmentAttemptIds"],
                                status="CLOSED" if not gap else "UNRESOLVED" if before["period"] == "2016-12" and after["period"] == "2018-01" else "NARROWED"))
    status = changes[0]["status"] if len(changes) == 1 else "UNRESOLVED"
    return dict(status=status, boundaries=changes, monthlyContainers=[dict(period=r["period"], formats=r["formats"]) for r in window],
                claim="Observed monthly container boundary only; not historical attachment immutability")


def assemble(base, candidates, checks):
    ledger = copy.deepcopy(base["ledger"])
    gaps = []
    for p in GAPS:
        found = [r for r in candidates if r["reportPeriod"] == p]
        recovered = [r for r in found if r["status"] == "RECOVERED"]
        hashes = {a["sha256"] for r in recovered for a in r["attachments"] if a["attemptId"] in r["selection"]["selectedAttemptIds"]}
        good = bool(recovered) and len(hashes) == 1 and len(recovered) == len(found)
        blockers = sorted({b for r in found for b in r["blockers"]})
        if not found:
            blockers.append("NO_MONTHLY_LANDING_IN_INSPECTED_DISCOVERY_PATHS")
        if len(hashes) > 1:
            blockers.append("MULTIPLE_RELEASE_BYTES_REVISION_UNPROVEN")
        gaps.append(dict(reportPeriod=p, status="RECOVERED" if good else "MISSING", blockers=blockers,
                         candidateLandingIds=sorted({r["landingAttemptId"] for r in found if r["landingAttemptId"]}), checkedSourceIds=checks))
        if good:
            row = next(r for r in ledger if r["period"] == p)
            selected = {a["attemptId"]:a for r in recovered for a in r["attachments"] if a["attemptId"] in r["selection"]["selectedAttemptIds"]}
            row.update(inventoryStatus="INDEXED", landingAttemptIds=sorted({r["landingAttemptId"] for r in recovered}),
                       attachmentAttemptIds=sorted(selected), formats=sorted({a["probe"]["actualFormat"] for a in selected.values()}),
                       filenameFormats=sorted({a["probe"]["extension"]+":"+a["probe"]["actualFormat"] for a in selected.values()}),
                       fieldSchemaIds=sorted({a["fieldMap"]["fieldSchemaSignature"] for a in selected.values()}), blockers=[])
            row["fields"] = {m:"FIELD_CONDITIONS_READY" if all(a["fieldMap"]["fields"][m]["status"] == "FIELD_CONDITIONS_READY" for a in selected.values()) else "PARTIAL" for m in row["fields"]}
    return ledger, gaps


def build(repo, *, verify_baseline=True):
    repo = Path(repo)
    plan = json.loads((repo / PLAN).read_text(encoding="utf-8"))
    if (plan["annualHintUrl"] != ANNUAL or plan["allowNumericObservations"] is not False
            or plan["allowYtdDifference"] is not False or plan["requestBudget"] != 200):
        raise ValueError("RECOVERY_SCOPE_CHANGED")
    base = json.loads((repo / BASE).read_text(encoding="utf-8"))
    if base["contentSha256"] != plan["baselineContentSha256"] or base["summary"]["missingPeriods"] != GAPS:
        raise ValueError("BASELINE_C1_IDENTITY_MISMATCH")
    if verify_baseline and baseline_build(repo, base["generatedAt"], save_extracted=False) != base:
        raise ValueError("BASELINE_RAW_REPLAY_MISMATCH")
    c = Collector(repo, raw_directory=RAW)
    edges, pages = replay_graph(c, plan)
    candidates, seen = [], set()
    for source_row in c.rows:
        if source_row["outcome"] == "CACHE_VERIFIED":
            continue
        for entry in discovered_entries(c, source_row):
            if not monthly(entry["title"]) or len(entry["periods"]) != 1 or entry["periods"][0] not in GAPS:
                continue
            key = (source_row["attemptId"], entry["url"])
            if key in seen:
                continue
            seen.add(key)
            landing_rows = [r for r in c.rows if r["requestUrl"] == entry["url"] and r["outcome"] != "CACHE_VERIFIED"]
            if not landing_rows:
                candidates.append(dict(reportPeriod=entry["periods"][0], status="MISSING", landingAttemptId=None,
                                       indexEntry=entry, blockers=["OFFICIAL_CANDIDATE_LANDING_NOT_ACQUIRED"]))
            for row in landing_rows:
                candidates.append(probe_candidate(c, row, dict(entry, indexAttemptId=source_row["attemptId"])))
    groups = {}
    for page in pages:
        key = (page["channelId"],page["query"])
        groups.setdefault(key, []).append(page)
    searches = []
    for (channel,q), items in sorted(groups.items()):
        totals = {p["total"] for p in items}
        if len(totals) != 1:
            raise ValueError("SEARCH_TOTAL_CHANGED_REQUIRES_NEW_SNAPSHOT")
        total = items[0]["total"]
        page_numbers = sorted({p["page"] for p in items})
        complete = page_numbers == list(range(1,max(1,math.ceil(total/10))+1))
        searches.append(dict(sourceId=digest([channel,q]),channelId=channel,query=q,total=total,pages=page_numbers,
                             complete=complete,blocker=None if complete else "BOUNDED_EXPLORATORY_QUERY_NOT_EXHAUSTED",
                             attemptIds=[p["attemptId"] for p in items]))
    ledger,gaps = assemble(base,candidates,[s["sourceId"] for s in searches])
    navigation_checks = []
    for r in c.rows:
        if r["outcome"] == "CACHE_VERIFIED" or r.get("requestForm"):
            continue
        html = text_body(c,r)
        name = re.search(r'<meta\s+name="ColumnName"\s+content="([^"]*)"',html)
        navigation_checks.append(dict(attemptId=r["attemptId"],url=r["requestUrl"],outcome=r["outcome"],
                                      columnName=name[1] if name else None,
                                      monthlyTargetEntries=[e for e in discovered_entries(c,r) if monthly(e["title"]) and any(p in GAPS for p in e["periods"])],
                                      blocker="ARCHIVE_ROOT_RETURNS_HOME_NOT_HISTORICAL_ENUMERATION" if "/c105974/" in r["requestUrl"] and "createPageHTML" not in html else r.get("blocker")))
    annual = next(r for r in c.rows if r["requestUrl"] == ANNUAL and r["outcome"] == "SUCCESS")
    hint = "《证券市场月报》12期"
    if hint not in text_body(c,annual):
        raise ValueError("ANNUAL_DISCOVERY_HINT_BYTES_MISMATCH")
    network = [r for r in c.rows if r["outcome"] != "CACHE_VERIFIED"]
    physical = sum(r.get("physicalRequests",1+len(r["redirects"])) for r in network)
    if physical > plan["requestBudget"]:
        raise ValueError("RECOVERY_REQUEST_BUDGET_EXCEEDED")
    recovered = sum(r["status"] == "RECOVERED" for r in gaps)
    content = dict(schemaVersion=VERSION, plan=plan, planSha256=digest(plan), baselineContentSha256=base["contentSha256"],
                   baselineLedgerSha256=digest(base["ledger"]), discoveryEdges=edges, retrievalAttempts=c.rows,
                   annualHint=dict(**locator(annual,hint),use="DISCOVERY_ONLY_NEVER_MONTH_COVERAGE"),
                   navigationChecks=navigation_checks, searchChecks=searches, searchPages=pages, candidates=candidates, gapResults=gaps, ledger=ledger,
                   formatEras=runs(ledger,lambda r:r["formats"]), formatTransition=transition(ledger), formalObservations=[],
                   summary=dict(targetCount=260, coveredPeriods=247+recovered, recoveredPeriods=recovered, missingPeriods=13-recovered,
                                formatDistribution=dict(Counter(f for r in ledger for f in r["formats"])),
                                physicalRequests=physical, acquisitionAttempts=len(network), cacheVerifications=len(c.rows)-len(network),
                                responseBytes=sum(r["storedBytes"]["byteSize"] if r.get("storedBytes") else 0 for r in network)+sum(d["storedBytes"]["byteSize"] for r in network for d in r["redirects"]),
                                distinctResponseHashes=len({r["storedBytes"]["sha256"] for r in network if r.get("storedBytes")}),
                                formalObservationCount=0, firstRelease="UNPROVEN", revisionCoverage="PARTIAL", datasetCoverage="PARTIAL"))
    return dict(contentSha256=digest(content),**content)


def validate_compact(repo):
    """Check committed content and derived claims; does not claim raw replay."""
    repo=Path(repo)
    result=json.loads((repo/OUT).read_text(encoding="utf-8"))
    base=json.loads((repo/BASE).read_text(encoding="utf-8"))
    plan=json.loads((repo/PLAN).read_text(encoding="utf-8"))
    if (result["contentSha256"] != digest({k:v for k,v in result.items() if k!="contentSha256"})
            or result["plan"] != plan or result["planSha256"] != digest(plan)
            or result["baselineContentSha256"] != base["contentSha256"]
            or result["baselineLedgerSha256"] != digest(base["ledger"])):
        raise ValueError("COMPACT_CONTENT_BINDING_MISMATCH")
    ledger,gaps=assemble(base,result["candidates"],[s["sourceId"] for s in result["searchChecks"]])
    if (result["ledger"] != ledger or result["gapResults"] != gaps or result["formatTransition"] != transition(ledger)
            or result["formatEras"] != runs(ledger,lambda r:r["formats"])):
        raise ValueError("COMPACT_DERIVED_CLAIM_MISMATCH")
    def no_observations(value):
        if isinstance(value,dict):
            for key,child in value.items():
                if key=="formalObservations" and child!=[]:
                    raise ValueError("FORMAL_OBSERVATIONS_FORBIDDEN")
                no_observations(child)
        elif isinstance(value,list):
            for child in value:
                no_observations(child)
    no_observations(result)
    recovered=sum(g["status"]=="RECOVERED" for g in gaps)
    summary=result["summary"]
    expected=dict(targetCount=260,coveredPeriods=247+recovered,recoveredPeriods=recovered,missingPeriods=13-recovered,
                  formalObservationCount=0,formatDistribution=dict(Counter(f for r in ledger for f in r["formats"])))
    if any(summary[k]!=v for k,v in expected.items()):
        raise ValueError("COMPACT_COVERAGE_MISMATCH")
    for row in result["retrievalAttempts"]:
        official(row["requestUrl"])
        if row.get("finalUrl"):
            official(row["finalUrl"])
    return result


def fetch(repo):
    plan=json.loads((repo/PLAN).read_text(encoding="utf-8"))
    c=Collector(repo,raw_directory=RAW,budget=plan["requestBudget"])
    for request in plan["requests"]:
        prove_request(c,request,c.rows,plan["annualHintUrl"])
        c.fetch(request["url"],request["role"],form_data=request.get("form"))
    # Only observed official query records can introduce a candidate landing.
    for row in list(c.rows):
        for entry in discovered_entries(c,row):
            if monthly(entry["title"]) and any(p in GAPS for p in entry["periods"]):
                prove_request(c,dict(url=entry["url"]),c.rows)
                landing=c.fetch(entry["url"],"LANDING")
                for a in parse_landing(text_body(c,landing),entry["url"])["attachments"]:
                    prove_request(c,dict(url=a["url"]),c.rows)
                    c.fetch(a["url"],"ATTACHMENT")


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("command",choices=["fetch","build","validate","validate-compact"])
    p.add_argument("--repo-root",type=Path,default=Path(__file__).resolve().parents[2])
    args=p.parse_args()
    if args.command=="fetch":
        fetch(args.repo_root)
        return
    if args.command=="validate-compact":
        result=validate_compact(args.repo_root)
        print("PASS: committed compact integrity (not a full raw archive replay); " + result["contentSha256"])
        return
    result=build(args.repo_root)
    if args.command=="build":
        write_evidence(args.repo_root/OUT,result)
    elif json.loads((args.repo_root/OUT).read_text(encoding="utf-8"))!=result:
        raise ValueError("RECOVERY_EVIDENCE_REPLAY_MISMATCH")
    print(json.dumps(result["summary"],indent=2))
    print("PASS: full C1 and recovery raw replay; " + result["contentSha256"])


if __name__=="__main__":
    main()
