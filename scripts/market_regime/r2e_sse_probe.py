"""R2-E bounded SSE evidence acquisition/replay. Never writes formal admission."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from .sse_source import parse_daily

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'research-data/market-regime/source-catalog/r2-e/sse'
RAW = ROOT / 'research-data/market-regime/raw/r2-e-sse'
# Reviewed acquisition batch identity: URL/final URL, acquisition timestamp and byte bindings.
# This pin is independent of mutable metadata; changing the acquisition batch needs code review.
METADATA_SET_SHA256 = '2f3eda9b5cdaeae71c2e942f2dc2cd9487b68a23fda7c3940799c135aa9985e8'


def sha(body):
    return hashlib.sha256(body).hexdigest()


def sealed_write(path, body):
    """Create once; exact reruns are harmless, changed bytes require a new version."""
    if path.exists():
        if path.read_bytes() != body:
            raise ValueError('SEALED_ARTIFACT_CHANGED: use a new explicit output version')
        return
    # Exclusive creation also protects against races after the initial existence check.
    with path.open('xb') as stream:
        stream.write(body)


def artifact_path(kind, version):
    if type(version) is not int or version < 1:
        raise ValueError('POSITIVE_OUTPUT_VERSION_REQUIRED')
    return OUT / f'{kind}.v{version}.json'


def sealed_json(path, value):
    sealed_write(path, (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))


def metadata_records():
    records = [json.loads(p.read_text(encoding='utf-8')) for p in sorted(OUT.glob('*.metadata.json'))]
    fingerprint = sha(json.dumps(records,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8'))
    if fingerprint != METADATA_SET_SHA256:
        raise ValueError('PINNED_METADATA_SET_MISMATCH')
    return records


def review_partitions():
    partitions = [dict(start='2005-01-01',end='2019-07-21',scopeToReview='MAIN_A',claimedApiFamily='legacy-day'),
        dict(start='2019-07-22',end='2021-12-24',scopeToReview='MAIN_A_AND_STAR',claimedApiFamily='legacy-day'),
        dict(start='2021-12-25',end='2021-12-26',scopeToReview='MAIN_A_AND_STAR',claimedApiFamily=None),
        dict(start='2021-12-27',end='2026-09-04',scopeToReview='MAIN_A_AND_STAR',claimedApiFamily='daily-day')]
    for partition in partitions:
        partition.update(role='REVIEW_PARTITION_NOT_PROVEN_ERA',familyApplicability='NOT_PROVEN',
                         definitionApplicability='NOT_PROVEN',calendarStatus='UNKNOWN')
    return partitions


def official(url):
    parsed = urlsplit(url)
    host = parsed.hostname or ''
    return (parsed.scheme == 'https' and (host == 'sse.com.cn' or host.endswith('.sse.com.cn'))
            and parsed.port in (None,443) and not parsed.username and not parsed.password)


def fetch(name, url):
    assert official(url), 'NON_OFFICIAL_URL'
    assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', name), 'SAFE_REQUEST_ID_REQUIRED'
    OUT.mkdir(parents=True, exist_ok=True)
    meta = OUT / (name + '.metadata.json')
    if meta.exists():
        record = json.loads(meta.read_text(encoding='utf-8'))
        assert record['url'] == url
        if record.get('path'):
            body = (ROOT / record['path']).read_bytes()
            assert sha(body) == record['sha256'] and len(body) == record['byteSize']
        return record
    record = dict(requestId=name, url=url, attemptedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'),
                  role='DISCOVERY_EVIDENCE_NOT_FORMAL_OBSERVATION')
    try:
        try:
            response = urlopen(Request(url, headers={'User-Agent':'investment-research-dashboard-r2e/1.0',
                'Referer':'https://www.sse.com.cn/market/stockdata/overview/day/'}), timeout=25)
        except HTTPError as error:
            response = error
        with response:
            assert official(response.url), 'NON_OFFICIAL_REDIRECT'
            body = response.read()
            is_pdf = body.startswith(b'%PDF-')
            if is_pdf:
                RAW.mkdir(parents=True, exist_ok=True)
            path = (RAW / (name + '.pdf')) if is_pdf else (OUT / (name + '.body'))
            sealed_write(path, body)
            record.update(status=response.status, finalUrl=response.url, path=path.relative_to(ROOT).as_posix(),
                          contentType=response.headers.get('Content-Type'), sha256=sha(body), byteSize=len(body))
            if is_pdf:
                record.update(archiveDistribution='LOCAL_IGNORED_FULL_BYTES',
                              cleanCloneRawReplay='NOT_RUN_RAW_NOT_DISTRIBUTED')
    except OSError as error:
        record.update(status='BLOCKED', errorType=type(error).__name__)
    sealed_json(meta, record)
    return record


def replay(*, compact=False, version=1):
    records = metadata_records()
    raw_not_run = []
    for r in records:
        assert official(r['url'])
        if r.get('path'):
            path = (ROOT / r['path']).resolve()
            assert path.is_relative_to(OUT.resolve()) or path.is_relative_to(RAW.resolve())
            if compact and path.is_relative_to(RAW.resolve()):
                raw_not_run.append(r['requestId'])
                continue
            body = path.read_bytes()
            assert sha(body) == r['sha256'] and len(body) == r['byteSize'], r['requestId']
    if not compact:
        from pypdf import PdfReader
        for excerpt_path in OUT.glob('annual-*.excerpts.json'):
            excerpt = json.loads(excerpt_path.read_text(encoding='utf-8'))
            source = next(r for r in records if r['sha256'] == excerpt['sourceSha256'])
            reader = PdfReader(ROOT / source['path'])
            for page in excerpt['pages']:
                assert reader.pages[page['pageIndex']].extract_text() == page['text'], 'PDF_EXCERPT_REPLAY'
    candidate_path = artifact_path('candidates', version)
    if not candidate_path.exists() or not artifact_path('evidence',version).exists():
        raise ValueError('VERSIONED_ARTIFACT_PAIR_REQUIRED')
    count = 0
    if candidate_path.exists():
        catalog = json.loads(candidate_path.read_text(encoding='utf-8'))
        by_id = {r['requestId']:r for r in records}
        contract = json.loads((ROOT/'config/market-regime/sse-source-contract.v1.json').read_text(encoding='utf-8'))
        families = {f['familyId']:f for f in contract['families']}
        for item in catalog['requests']:
            r = by_id[item['requestId']]
            parsed = parse_daily((ROOT/r['path']).read_bytes(), family=families[item['familyId']],
                                 requested_date=item['requestedDate'], artifact_id='sse-r2e-'+r['sha256'])
            assert parsed == item['parsed'], item['requestId']
            count += len(parsed['candidates'])
        assert count == catalog['candidateCount']
        assert catalog['formalCount'] == catalog['strictPitCount'] == 0
        assert catalog['formalObservations'] == []
    evidence_path = artifact_path('evidence', version)
    if evidence_path.exists():
        evidence = json.loads(evidence_path.read_text(encoding='utf-8'))
        assert evidence['artifacts'] == records, 'EVIDENCE_ARTIFACT_BINDINGS'
        assert evidence['artifactCount'] == len(records), 'EVIDENCE_ARTIFACT_COUNT'
        assert evidence['counts']['candidateCount'] == count, 'EVIDENCE_CANDIDATE_COUNT'
        assert evidence['counts']['formalCount'] == evidence['counts']['strictPitCount'] == 0
        assert evidence['officialTradingDayTargetCount'] is None
        assert not evidence['formalObservations'] and not evidence['transitions']
        for field in evidence['fieldAdmission']:
            assert field['status'] == 'NOT_ADMITTED' and not field['admittedWindows']
            assert field['eras'] == review_partitions(), 'UNPROVEN_ERA_PROMOTION'
        by_id = {r['requestId']:r for r in records}
        for loc in evidence['byteLocators']:
            r = by_id[loc['requestId']]
            assert loc['artifactSha256'] == r['sha256']
            body = (ROOT/r['path']).read_bytes()
            assert body[loc['byteOffset']:loc['byteOffset']+loc['byteLength']] == loc['text'].encode('utf-8')
    return dict(status='PASS', mode='COMPACT' if compact else 'FULL', artifactCount=len(records),
                replayedCandidateCount=count, rawReplayNotRun=raw_not_run)


def build_candidates(*, version=1):
    contract = json.loads((ROOT/'config/market-regime/sse-source-contract.v1.json').read_text(encoding='utf-8'))
    families = {f['familyId']:f for f in contract['families']}
    items = []
    for r in metadata_records():
        match = re.fullmatch(r'(legacy|daily)-(\d{4}-\d{2}-\d{2})', r['requestId'])
        if not match or r['status'] != 200:
            continue
        stem, day = match.groups()
        family = families[stem+'-day']
        script = (OUT/(stem+'-script.body')).read_text(encoding='utf-8')
        assert family['sqlId'] in script and 'commonQuery.do' in script, 'OFFICIAL_SCRIPT_FAMILY_REQUIRED'
        body = (ROOT/r['path']).read_bytes()
        if sha(body) != r['sha256'] or len(body) != r['byteSize']:
            raise ValueError('PINNED_SOURCE_BYTES_MISMATCH')
        parsed = parse_daily(body, family=family, requested_date=day,
                             artifact_id='sse-r2e-'+r['sha256'])
        items.append(dict(requestId=r['requestId'], familyId=family['familyId'], requestedDate=day, parsed=parsed))
    result = dict(schemaVersion='1.0.0', role='CANDIDATE_ONLY_NOT_ADMISSION', candidateUnit='board-field-request-row',
                  candidateCount=sum(len(i['parsed']['candidates']) for i in items), formalCount=0,
                  strictPitCount=0, formalObservations=[], requests=items)
    sealed_json(artifact_path('candidates',version),result)
    return dict(candidateCount=result['candidateCount'], requestCount=len(items))


def build_evidence(*, version=1):
    records = metadata_records()
    by_id = {r['requestId']:r for r in records}
    candidates = json.loads(artifact_path('candidates',version).read_text(encoding='utf-8'))
    old = json.loads((ROOT/'research-data/market-regime/source-catalog/sse-d1a/inventory.v1.json').read_text(encoding='utf-8'))
    def key(c):
        return (c['tradeDate'], c['scope'], c['field'])
    new_keys = {key(c) for r in candidates['requests'] for c in r['parsed']['candidates']}
    old_keys = {key(c) for c in old['candidates']}
    locators = []
    for rid, needle in [('daily-page','2021年12月24日之前的每日概况历史数据，请点击此处'),
                        ('monthly-index','每月15日披露。')]:
        r = by_id[rid]
        body = (ROOT/r['path']).read_bytes()
        token = needle.encode('utf-8')
        assert token in body
        # Some SSE pages repeat the same text for mobile/desktop; explicit byte offset identifies this instance.
        locators.append(dict(requestId=rid, artifactSha256=r['sha256'], byteOffset=body.index(token),
                             byteLength=len(token), text=needle))
    fields = ('turnoverValue','totalMarketCap','negotiableMarketCap')
    blockers = ['OFFICIAL_CALENDAR_MISSING','FIELD_DEFINITION_APPLICABILITY_UNPROVEN',
                'PIT_VINTAGE_UNPROVEN','CONTINUOUS_HISTORICAL_RELEASE_ARCHIVE_UNPROVEN']
    eras = review_partitions()
    result = dict(schemaVersion='1.0.0', workstream='SSE', role='VERSIONED_DISCOVERY_EVIDENCE_NOT_SOURCE_CONTRACT',
        sourceId='SSE_MARKET_STATS_OFFICIAL', datasetAsOf='2026-09-07T08:00:00+08:00',
        targetWindow=dict(start='2005-01-01',end='2026-09-04'), officialTradingDayTargetCount=None,
        artifactCount=len(records), artifacts=records, byteLocators=locators,
        calendar=dict(status='UNKNOWN', reason='No complete date-level official calendar and exception/revision history; annual counts cannot identify target days or establish exchange intersection.',
            annualCountCrossChecks=[dict(year=y,reportedCount=n,requestId=r,pageIndex=p) for y,n,r,p in
                [(2005,242,'annual-2006',5),(2012,243,'annual-2013',8),(2021,243,'annual-2022',13),(2022,242,'annual-2023',12)]],
            useAsOfficialDateCalendar=False),
        release=dict(status='BLOCKED',publicationDate=None,publicationDateTime=None,releaseAvailableAt=None,
            provenFirstReleaseCount=0, revisionCompleteness='UNPROVEN',scheduleEvidenceLocatorIndex=1,
            scheduleScope='Monthly publication schedule only; no actual release event constructed from schedule.',
            dailyPayloadEvidence='API observation date, request date, HTTP Date, script update and retrieval timestamp are not market release evidence.',
            dateOnlyRule='Actual market publication date unproven; frozen DATE_ONLY_SAFE cannot be applied.'),
        definitions=dict(status='PARTIAL_DISCOVERY_ONLY',apiDefinitionApplicability='UNPROVEN',
            publicationEvidence=[dict(requestId='annual-2006',pageIndex=4,explicitStatisticalWindow='2003-01-01..2003-12-31',
                conflict='Volume 2006 and 2005 market overview coexist with indicator page explicitly saying 2003; preserve conflict.'),
                dict(requestId='annual-2013',pageIndex=2,explicitStatisticalWindow='2012-01-01..2012-12-31'),
                dict(requestId='annual-2022',pageIndex=7,explicitStatisticalWindow='2021-01-01..2021-12-31'),
                dict(requestId='annual-2023',pageIndex=6,explicitStatisticalWindow='2022-01-01..2022-12-31',
                    termChange='Total share capital / total cap / non-restricted share capital / non-restricted cap. No API effective date inferred.')],
            fieldMeanings=dict(turnoverValue='Publications distinguish single-side turnover and double-side trading amount; API-era applicability unproven.',
                totalMarketCap='Publication market price times issued quantity, later total share capital; API closing-price/scope/currency applicability unproven.',
                negotiableMarketCap='Publication market price times tradable issued quantity, later non-restricted capital. No free-float identity inferred.')),
        history=dict(status='PARTIAL_DISCOVERY_ONLY',boundaryHintLocatorIndex=0,
            annualEnumerationStatus='Official annual index archived; four directly linked publications retrieved for definitions and annual counts. Index titles do not close daily vintage evidence.',
            probeGrid=dict(start='2021-12-20',end='2022-01-07',civilDateCount=19,families=['legacy-day','daily-day'],requestCount=38,
                reason='Every civil date around source boundary; empty or populated API response does not establish calendar.'),
            additionalProbeDates=['2005-01-04'],parsedRequestCount=len(candidates['requests']),
            nonEmptyRequestCount=sum(bool(r['parsed']['candidates']) for r in candidates['requests']),
            emptyRequestCount=sum(not bool(r['parsed']['candidates']) for r in candidates['requests']),
            fullTargetContinuousHistory='UNPROVEN',unadmittedWindows=[dict(start='2005-01-01',end='2026-09-04',
                reason='Calendar/definition/release gates incomplete for every target observation.')]),
        counts=dict(candidateCount=candidates['candidateCount'],candidateUnit='board-field-request-row',formalCount=0,strictPitCount=0,
            byField={f:sum(c['field']==f for r in candidates['requests'] for c in r['parsed']['candidates']) for f in fields},
            priorD1ACandidateCount=len(old['candidates']), repeatOldDateScopeFieldCount=len(new_keys & old_keys),
            combinedUniqueDateScopeFieldCount=len(new_keys | old_keys),
            countCaveat='Discovery deduplication by date/scope/field only; does not choose vintage truth.'),
        fieldAdmission=[dict(field=f,status='NOT_ADMITTED',definitionStatus='PARTIAL_DISCOVERY_ONLY',pitStatus='BLOCKED',eras=eras,
            remainingBlockers=blockers+(['NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN'] if f=='negotiableMarketCap' else []),
            formalCount=0,strictPitCount=0,admittedWindows=[]) for f in fields],
        transitions=[],formalObservations=[],
        limits=dict(allPotentialSourcesExhausted=False,cleanCloneRawReplay='NOT_RUN_RAW_NOT_DISTRIBUTED',
            fullArchiveReplay='Local raw PDF bytes required; compact replay does not claim full PDF replay.',
            officialNetwork='Recorded 51 bounded acquisitions succeeded.',
            notRun=['Full target daily API sweep: missing calendar/release/era gates; no exhaustive archive claim.',
                    'Historical first-release/revision completeness: no complete authoritative daily release index discovered.'],
            visualReview='PDFium-rendered indicator pages 2006/2013/2022 and annual-count table 2006 reviewed; PDF text is a derived excerpt, not raw source bytes.'))
    sealed_json(artifact_path('evidence',version),result)
    return result['counts']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['fetch','replay','build-candidates','build-evidence'])
    parser.add_argument('--name')
    parser.add_argument('--url')
    parser.add_argument('--compact', action='store_true')
    parser.add_argument('--version', type=int, default=1)
    args = parser.parse_args()
    result = (fetch(args.name,args.url) if args.command == 'fetch' else build_candidates(version=args.version)
              if args.command == 'build-candidates' else build_evidence(version=args.version) if args.command == 'build-evidence'
              else replay(compact=args.compact,version=args.version))
    print(json.dumps(result, ensure_ascii=False))
