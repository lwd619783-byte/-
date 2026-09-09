"""Explicit SSE discovery fetch/build/validate commands; no production refresh."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

from .hashing import canonical_sha256, sha256_bytes
from .historical import canonical_order, evidence_artifact_identity
from .historical_validator import require, safe_file, schema_check
from .sse_source import (CONTRACT_PATH, FIELDS, ROOT, assess_day, business_projection,
                         calendar_inventory, parse_daily, replay_locator, strict_json)


RAW = Path('research-data/market-regime/raw/sse-d1a')
OUTPUT = Path('research-data/market-regime/source-catalog/sse-d1a/inventory.v1.json')


def load_contract():
    return json.loads(CONTRACT_PATH.read_text(encoding='utf-8'))


def official(url):
    p = urlsplit(url)
    return (p.scheme == 'https' and p.hostname in ('www.sse.com.cn', 'query.sse.com.cn')
            and p.port in (None, 443) and not p.username and not p.password)


def coverage_for(contract, calendar):
    return dict(status='PARTIAL', fullTarget=contract['targetWindow'], officialTradingDayTargetCount=None,
                provenCalendarSubwindowTargetCount=len(calendar['openDates']),
                unadmittedWindows=[{'start':'2005-01-01','end':'2020-01-30','reason':'OFFICIAL_CALENDAR_MISSING'},
                                   {'start':'2020-01-31','end':'2020-02-03','reason':'RELEASE_AND_DEFINITION_UNPROVEN'},
                                   {'start':'2020-02-04','end':'2026-09-04','reason':'OFFICIAL_CALENDAR_MISSING'}],
                fields={f:dict(status='PARTIAL', availableCount=0, strictPitCount=0,
                               historicalAdmittedWindows=[]) for f in FIELDS})


def fetch(*, root=ROOT):
    """Bounded, exact externally frozen requests; existing acquisitions are immutable."""
    contract = load_contract()
    folder = root / RAW
    folder.mkdir(parents=True, exist_ok=True)
    results = []
    # Dependencies first. No URL iteration over the target calendar.
    jobs = sorted(contract['requests'], key=lambda r: (r['familyId'] is not None,
                  r['parentRequestId'] is not None, r['requestId']))
    for job in jobs:
        require(official(job['url']), 'NON_OFFICIAL_URL')
        metadata = folder / (job['requestId'] + '.json')
        if metadata.exists():
            old = json.loads(metadata.read_text(encoding='utf-8'))
            require(old['url'] == job['url'], 'CACHE_REQUEST_MISMATCH')
            if 'path' in old:
                body = safe_file(root, old['path']).read_bytes()
                require(sha256_bytes(body) == old['sha256'] and len(body) == old['byteSize'], 'CACHE_BYTES')
            results.append({'requestId': job['requestId'], 'status': 'CACHE_VERIFIED' if 'path' in old else 'RETAINED_FAILURE'})
            continue
        if job['parentRequestId']:
            parent = json.loads((folder / (job['parentRequestId'] + '.json')).read_text(encoding='utf-8'))
            text = safe_file(root, parent['path']).read_text(encoding='utf-8')
            if job['familyId']:
                params = parse_qs(urlsplit(job['url']).query)
                require(params['sqlId'][0] in text and 'commonQuery.do' in text, 'REQUEST_DISCOVERY_MISSING')
                date_key = 'searchDate' if job['familyId'] == 'legacy-day' else 'SEARCH_DATE'
                require(date_key in text and params[date_key] == [job['requestedDate']], 'REQUEST_DATE_PARAMETER')
            else:
                require(urlsplit(job['url']).path in text, 'SCRIPT_NOT_LINKED')
        at = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')
        record = dict(url=job['url'], fetchedAt=at)
        try:
            response = urlopen(Request(job['url'], headers={
                'User-Agent': 'investment-research-dashboard-sse-d1a/1.0',
                'Referer': 'https://www.sse.com.cn/market/stockdata/overview/day/index_his.shtml'}), timeout=15)
        except HTTPError as exc:
            response = exc  # Retain rejected bytes, without claiming successful evidence.
        except OSError as exc:
            record['error'] = type(exc).__name__
            response = None
        if response is not None:
            with response:
                require(official(response.url), 'REDIRECT_OUTSIDE_SSE')
                body = response.read()
                suffix = '.js' if job['requestId'].endswith('script') else '.html' if job['requestId'].startswith('overview-') else '.body'
                target = folder / (job['requestId'] + suffix)
                require(not target.exists(), 'UNINDEXED_BYTES_ALREADY_EXIST')
                target.write_bytes(body)
                record.update(finalUrl=response.url, status=response.status, contentType=response.headers.get('Content-Type', ''),
                              path=target.relative_to(root).as_posix(), sha256=sha256_bytes(body), byteSize=len(body))
        metadata.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        results.append({'requestId': job['requestId'], 'status': record.get('status', record.get('error'))})
    return results


def build(*, root=ROOT, generated_at=None):
    contract = load_contract()
    artifacts, bindings, attempts, candidates, rejected, probes, mappings = [], [], [], [], [], [], []
    by_job = {}
    for job in contract['requests']:
        m = json.loads((root / RAW / (job['requestId'] + '.json')).read_text(encoding='utf-8'))
        require(m['url'] == job['url'] and official(m.get('finalUrl', m['url'])), 'ACQUISITION_URL')
        success = 'path' in m and 200 <= m['status'] < 300
        stored = dict(localPath=m['path'], sha256=m['sha256'], byteSize=m['byteSize']) if 'path' in m else None
        attempt = dict(attemptId='sse-acquire-' + job['requestId'], sourceId=contract['sourceId'], requestUrl=m['url'],
                       finalUrl=m.get('finalUrl', m['url']) if stored else None, attemptedAt=m['fetchedAt'],
                       httpStatus=m.get('status'), transportError=m.get('error'), storedBytes=stored,
                       outcome='SUCCESS' if success else 'HTTP_ERROR' if stored else 'TRANSPORT_ERROR',
                       reasonCode='BOUNDED_OFFICIAL_SOURCE_PROBE', candidateReleaseEventIds=[],
                       handlingBasis='Original network acquisition; data date is not publication time.',
                       verifiedAt=None, acquisitionAttemptId=None)
        attempts.append(attempt)
        if not success:
            probes.append(dict(requestId=job['requestId'], status=attempt['outcome'], artifactId=None, rowCount=0))
            continue
        body = safe_file(root, m['path']).read_bytes()
        require(sha256_bytes(body) == m['sha256'] and len(body) == m['byteSize'], 'ACQUISITION_BYTES')
        a = dict(sourceId=contract['sourceId'], sourceUrl=m.get('finalUrl', m['url']), fetchedAt=m['fetchedAt'],
                 contentType=m['contentType'], fileName=Path(m['path']).name, sha256=m['sha256'], byteSize=len(body),
                 httpStatus=m['status'], artifactRole='RAW_SOURCE', localPath=m['path'], parseStatus='INDEXED',
                 error=None, evidenceRole=job['role'])
        a['artifactId'] = evidence_artifact_identity(a)
        artifacts.append(a)
        by_job[job['requestId']] = a
        content = body.decode('utf-8')
        # The complete bytes stay in the raw archive; the compact locator only
        # identifies the response header and is never a publication locator.
        content = content[:120]
        bindings.append(dict(artifactId=a['artifactId'], releaseEventId=None, completeResponse=True,
                             contentValidation='VALIDATED', contentEvidence=dict(artifactId=a['artifactId'],
                             byteOffset=0, byteLength=len(content.encode('utf-8')), text=content)))
        if job['familyId']:
            family = next(f for f in contract['families'] if f['familyId'] == job['familyId'])
            try:
                result = parse_daily(body, family=family, requested_date=job['requestedDate'], artifact_id=a['artifactId'])
                for c in result['candidates']:
                    c['mappingId'] = family['familyId']
                candidates.extend(result['candidates'])
                rejected.extend(result['rejectedRows'])
                probes.append(dict(requestId=job['requestId'], status='PARSED_CANDIDATES_ONLY' if result['candidates'] else 'EMPTY_RESPONSE',
                                   artifactId=a['artifactId'], rowCount=len(strict_json(body)['result'])))
            except (ValueError, TypeError, KeyError) as exc:
                bindings[-1]['contentValidation'] = 'UNSUPPORTED'
                a.update(parseStatus='FAILED', error=str(exc))
                probes.append(dict(requestId=job['requestId'], status='PARSER_FAILED', artifactId=a['artifactId'], rowCount=0))
    for family in contract['families']:
        key = 'historical-script' if family['familyId'] == 'legacy-day' else 'current-script'
        a = by_job[key]
        body = safe_file(root, a['localPath']).read_bytes()
        # Retain the exact active daily block including code -> board, raw key ->
        # label/unit, and parameter mappings, excluding monthly/yearly blocks.
        start_marker, end_marker = (('//日股票成交概况', '// 月股票成交概况') if key == 'historical-script'
                                    else ('var overviewDay = {', 'var overviewWeekly = {'))
        start, end = body.index(start_marker.encode()), body.index(end_marker.encode())
        loc = dict(artifactId=a['artifactId'], byteOffset=start, byteLength=end-start, text=body[start:end].decode())
        require(family['sqlId'] in loc['text'] and all(v in loc['text'] for v in family['fieldKeys'].values()), 'MAPPING_REPLAY')
        mappings.append(dict(mappingId=family['familyId'], scopeAndUnitEvidence=loc,
                             applicabilityStatus='API_DEFINITION_APPLICABILITY_UNPROVEN'))
    index = {a['artifactId']: a for a in artifacts}
    calendar = calendar_inventory(index, contract['calendar'], root=root)
    days = sorted({j['requestedDate'] for j in contract['requests'] if j['requestedDate']})
    assessments = [assess_day(d, candidates, calendar) for d in days]
    output = dict(schemaVersion='1.0.0', kind='SSE_SOURCE_INVENTORY_NOT_R2_DATASET',
                  contract=contract, contractContentSha256=canonical_sha256(canonical_order(contract)),
                  evidenceArtifacts=artifacts, artifactBindings=bindings, retrievalAttempts=attempts,
                  sourceMappings=mappings, calendar=calendar, candidates=candidates, rejectedRows=rejected,
                  probes=probes, dayAssessments=assessments, releaseEvents=[], fieldExtractions=[],
                  exchangeMarketObservations=[], coverage=coverage_for(contract, calendar),
                  generatedAt=generated_at or datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z'))
    output = canonical_order(output)
    output['contentSha256'] = canonical_sha256(business_projection(output))
    validate_compact(output)
    return output


def validate_compact(inventory):
    """Structural/hash verification only; validate command also replays raw bytes."""
    contract = load_contract()
    require(set(inventory) == {'schemaVersion','kind','contract','contractContentSha256','evidenceArtifacts',
            'artifactBindings','retrievalAttempts','sourceMappings','calendar','candidates','rejectedRows',
            'probes','dayAssessments','releaseEvents','fieldExtractions','exchangeMarketObservations',
            'coverage','generatedAt','contentSha256'}, 'INVENTORY_SCHEMA_KEYS')
    require(inventory['schemaVersion'] == '1.0.0', 'INVENTORY_SCHEMA_VERSION')
    require(inventory['kind'] == 'SSE_SOURCE_INVENTORY_NOT_R2_DATASET', 'INVENTORY_KIND')
    require(canonical_order(inventory['contract']) == canonical_order(contract), 'EXTERNAL_SOURCE_CONTRACT_MISMATCH')
    require(inventory['contractContentSha256'] == canonical_sha256(canonical_order(contract)), 'CONTRACT_HASH')
    require(inventory['contentSha256'] == canonical_sha256(business_projection(inventory)), 'INVENTORY_HASH')
    require(not inventory['releaseEvents'] and not inventory['fieldExtractions'] and not inventory['exchangeMarketObservations'],
            'UNADMITTED_RELEASE_OR_OBSERVATION')
    for key, definition, identity in [('evidenceArtifacts','evidenceArtifact','artifactId'),
                                      ('artifactBindings','artifactBinding','artifactId'),
                                      ('retrievalAttempts','retrievalAttempt','attemptId')]:
        require(len({r[identity] for r in inventory[key]}) == len(inventory[key]), 'DUPLICATE_ID')
        for row in inventory[key]:
            schema_check(row, definition)
    calendar = inventory['calendar']
    require(set(calendar) == {'calendarVersion','start','end','openDates','closedDates','evidence',
            'supersedes','status','r2CalendarStatus','contentSha256'}, 'CALENDAR_SCHEMA_KEYS')
    require(calendar['status'] == 'OFFICIAL_BOUNDED_WINDOW'
            and calendar['r2CalendarStatus'] == 'BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED', 'CALENDAR_ADMISSION_STATUS')
    for key in ('calendarVersion','start','end','openDates','closedDates','supersedes'):
        require(calendar[key] == canonical_order(contract['calendar'][key]), 'CALENDAR_CONTRACT_MISMATCH')
    require(sorted(l['text'] for l in calendar['evidence']) == sorted(p['text'] for p in contract['calendar']['proofs']),
            'CALENDAR_PROOF_MISMATCH')
    require(calendar['contentSha256'] == canonical_sha256(canonical_order({k:v for k,v in calendar.items() if k != 'contentSha256'})),
            'CALENDAR_HASH')
    require(inventory['coverage'] == canonical_order(coverage_for(contract, calendar)), 'COVERAGE_CONTRACT_MISMATCH')
    expected_dates = sorted(j['requestedDate'] for j in contract['requests'] if j['requestedDate'])
    require(inventory['dayAssessments'] == canonical_order([
        assess_day(d, inventory['candidates'], inventory['calendar']) for d in expected_dates]), 'FIELD_ASSESSMENT_MISMATCH')
    for f in FIELDS:
        c = inventory['coverage']['fields'][f]
        require(c == dict(status='PARTIAL', availableCount=0, strictPitCount=0, historicalAdmittedWindows=[]), 'FALSE_FIELD_ADMISSION')


def validate(inventory, *, root=ROOT):
    validate_compact(inventory)
    for a in inventory['evidenceArtifacts']:
        require(a['artifactId'] == evidence_artifact_identity(a) and official(a['sourceUrl']), 'EVIDENCE_IDENTITY')
    artifacts = {a['artifactId']:a for a in inventory['evidenceArtifacts']}
    for b in inventory['artifactBindings']:
        require(b['releaseEventId'] is None, 'DISCOVERY_CANNOT_BIND_RELEASE')
        replay_locator(b['contentEvidence'], artifacts, root)
    rebuilt = build(root=root, generated_at=inventory['generatedAt'])
    require(rebuilt == inventory, 'SOURCE_INVENTORY_REPLAY_MISMATCH')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['fetch','build','validate','validate-compact'])
    args = parser.parse_args()
    if args.command == 'fetch':
        print(json.dumps(fetch(), ensure_ascii=True))
        return
    path = ROOT / OUTPUT
    if args.command == 'build':
        old = json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
        result = build(generated_at=old['generatedAt'] if old else None)
        data = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
        if old:
            require(old == result, 'SEALED_INVENTORY_DIFFERS_USE_NEW_VERSION')
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(data, encoding='utf-8')
    else:
        result = json.loads(path.read_text(encoding='utf-8'))
        (validate if args.command == 'validate' else validate_compact)(result)
    print(json.dumps(dict(validation='PASS', admission='PARTIAL', formalObservations=0,
                          fullTradingDayDenominator=None, contentSha256=result['contentSha256'])))


if __name__ == '__main__':
    main()
