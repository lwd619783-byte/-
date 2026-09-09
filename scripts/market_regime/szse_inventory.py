"""Bounded SZSE source acquisition and sealed evidence replay, never R2 admission."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen, HTTPRedirectHandler, build_opener

from .hashing import canonical_sha256, sha256_bytes
from .historical import canonical_order, evidence_artifact_identity
from .historical_validator import require, safe_file, schema_check
from .szse_source import (ROOT, CONTRACT_PATH, FIELDS, assess_day, business_projection,
                         locator, parse_daily, replay_locator, strict_json)

RAW = Path('research-data/market-regime/raw/szse-d1b')
OUTPUT = Path('research-data/market-regime/source-catalog/szse-d1b/inventory.v1.json')


def load_contract():
    return json.loads(CONTRACT_PATH.read_text(encoding='utf-8'))


def official(url):
    p = urlsplit(url)
    return (p.scheme in ('http','https') and p.hostname in
            ('www.szse.cn','res.szse.cn','res.static.szse.cn','docs.static.szse.cn')
            and p.port in (None,80 if p.scheme == 'http' else 443)
            and not p.username and not p.password and not p.fragment)


def metadata(job, root):
    m = strict_json((root / RAW / (job['requestId']+'.json')).read_bytes())
    require(m['url'] == job['url'] and official(m.get('finalUrl',m['url'])), 'ACQUISITION_URL')
    if 'path' in m:
        require(m['path'] == (RAW / (job['requestId']+'.body')).as_posix(), 'ACQUISITION_PATH')
        body = safe_file(root,m['path']).read_bytes()
        require(sha256_bytes(body) == m['sha256'] and len(body) == m['byteSize'], 'ACQUISITION_BYTES')
    return m


def discovery(job, contract, root):
    """Replay frozen official entry/script/metadata dependencies before requesting data."""
    require(official(job['url']), 'NON_OFFICIAL_URL')
    jobs = {j['requestId']:j for j in contract['requests']}
    for p in job['proofs']:
        m = metadata(jobs[p['requestId']],root)
        require(200 <= m.get('status',0) < 300, 'DISCOVERY_PARENT_UNAVAILABLE')
        body = safe_file(root,m['path']).read_bytes()
        require(body.count(p['text'].encode()) == 1, 'REQUEST_DISCOVERY_MISSING')
    if job['discoveryKind'].startswith('API_'):
        p = urlsplit(job['url'])
        params = parse_qs(p.query,strict_parsing=True)
        family = contract['families'][0] if job['familyId'] == 'security-category' else contract['secondaryFamily']
        require(p.scheme == 'https' and p.hostname == 'www.szse.cn' and p.path == '/api/report/ShowReport/data', 'API_ENDPOINT')
        expected = dict(SHOWTYPE=['JSON'],CATALOGID=[family['catalogId']])
        if job['requestedDate']:
            expected['txtQueryDate'] = [job['requestedDate']]
            source = 'overview-current' if job['familyId'] == 'security-category' else 'stock-current'
            m = metadata(jobs[source],root)
            tab = strict_json(safe_file(root,m['path']).read_bytes())[0]
            require(tab['metadata']['catalogid'] == family['catalogId'], 'DISCOVERY_CATALOG')
            conditions = tab['metadata']['conditions']
            require(any(c['name']=='txtQueryDate' and c['inputType']=='date' for c in conditions), 'DISCOVERY_DATE')
            if job['familyId'] == 'security-category':
                expected['TABKEY'] = ['tab1']
            else:
                expected.update({c['name']:[c['defaultValue']] for c in conditions if c['hidden']=='1'})
        require(params == expected, 'REQUEST_PARAMETERS_OR_PAGINATION')


class OfficialRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        require(official(newurl), 'REDIRECT_OUTSIDE_SZSE')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch(*,root=ROOT):
    contract = load_contract()
    require(len(contract['requests']) <= contract['acquisition']['maxRequests'], 'REQUEST_BOUND')
    folder = root / RAW
    folder.mkdir(parents=True,exist_ok=True)
    results = []
    # Contract order is a dependency DAG, not a chronology or truth ordering.
    for job in contract['requests']:
        discovery(job,contract,root)
        path = folder/(job['requestId']+'.json')
        if path.exists():
            m = metadata(job,root)
            results.append(dict(requestId=job['requestId'],status='CACHE_VERIFIED' if 'path' in m else 'RETAINED_FAILURE'))
            continue
        m = dict(url=job['url'],fetchedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'))
        try:
            response = build_opener(OfficialRedirect()).open(Request(job['url'],headers={
                'User-Agent':'investment-research-dashboard-szse-d1b/1.0'}),timeout=contract['acquisition']['timeoutSeconds'])
        except HTTPError as exc:
            response = exc
        except OSError as exc:
            response = None
            m['error'] = type(exc).__name__
        if response is not None:
            with response:
                require(official(response.url),'REDIRECT_OUTSIDE_SZSE')
                body = response.read(contract['acquisition']['maxResponseBytes']+1)
                require(len(body) <= contract['acquisition']['maxResponseBytes'],'RESPONSE_TOO_LARGE')
                raw = folder/(job['requestId']+'.body')
                require(not raw.exists(),'UNINDEXED_BYTES_ALREADY_EXIST')
                raw.write_bytes(body)
                m.update(finalUrl=response.url,status=response.status,contentType=response.headers.get('Content-Type',''),
                         path=raw.relative_to(root).as_posix(),sha256=sha256_bytes(body),byteSize=len(body))
        path.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        results.append(dict(requestId=job['requestId'],status=m.get('status',m.get('error'))))
    return results


def coverage_for(contract,calendar):
    return dict(status='PARTIAL',fullTarget=contract['targetWindow'],officialTradingDayTargetCount=None,
                provenCalendarSubwindowTargetCount=len(calendar['openDates']),
                unadmittedWindows=[dict(start='2005-01-01',end='2020-01-30',reason='OFFICIAL_CALENDAR_MISSING'),
                                   dict(start='2020-01-31',end='2020-02-03',reason='RELEASE_DEFINITION_AND_R2_CALENDAR_UNPROVEN'),
                                   dict(start='2020-02-04',end='2026-09-04',reason='OFFICIAL_CALENDAR_MISSING')],
                fields={f:dict(status='PARTIAL',availableCount=0,strictPitCount=0,historicalAdmittedWindows=[]) for f in FIELDS})


def admission_for(contract,candidates):
    return dict(status='PARTIAL',sourceDiscovered=True,parserWorks=bool(candidates),formalCoverage=0,
                strictPitCoverage=0,blockers=contract['blockers'])


def expected_calendar(contract,evidence):
    c = contract['calendar']
    out = {k:c[k] for k in ('calendarVersion','start','end','closedDates','openDates','supersedes')}
    out.update(evidence=evidence,status='OFFICIAL_BOUNDED_WINDOW',r2CalendarStatus='BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED')
    out['contentSha256'] = canonical_sha256(canonical_order(out))
    return canonical_order(out)


def parse_response(job,body,artifact_id,contract):
    if not job['requestedDate']:
        # Metadata discovery is allowed to return the official missing-date error.
        doc = strict_json(body)
        require(isinstance(doc,list) and doc and isinstance(doc[0].get('metadata'),dict),'METADATA_SHAPE')
        expected = contract['families'][0]['catalogId'] if job['familyId']=='security-category' else contract['secondaryFamily']['catalogId']
        require(doc[0]['metadata']['catalogid']==expected,'WRONG_SOURCE_FAMILY')
        return dict(candidates=[],rejectedRows=[]), 'METADATA_ONLY'
    if job['familyId']=='security-category':
        result = parse_daily(body,family=contract['families'][0],requested_date=job['requestedDate'],artifact_id=artifact_id)
        return result, 'PARSED_CANDIDATES_ONLY' if result['candidates'] else 'EMPTY_RESPONSE'
    doc = strict_json(body)
    require(isinstance(doc,list) and len(doc)==1 and isinstance(doc[0],dict),'SECONDARY_SHAPE')
    tab=doc[0]
    require(tab['metadata']['catalogid']==contract['secondaryFamily']['catalogId'],'WRONG_SOURCE_FAMILY')
    require(tab['error'] is None and isinstance(tab['data'],list),'SOURCE_ERROR')
    m=tab['metadata']
    require(all(type(m.get(k)) is int and m[k]==v for k,v in
                {'pagesize':-1,'pageno':0,'pagecount':0,'recordcount':0}.items()),'PAGINATION_UNSUPPORTED')
    conditions=[c for c in m.get('conditions',[]) if c.get('name')=='txtQueryDate']
    require(len(conditions)==1 and conditions[0]['defaultValue']==job['requestedDate'],'REQUEST_DATA_DATE_MISMATCH')
    # This family cannot prove response date/A-only. Do not emit even A-labeled daily candidates.
    return dict(candidates=[],rejectedRows=[]), 'EVIDENCE_ONLY_MIXED_SCOPE_AND_UNPROVEN_RESPONSE_DATE'


def build(*,root=ROOT,generated_at=None):
    contract = load_contract()
    artifacts,bindings,attempts,responses,probes,candidates,rejected = [],[],[],[],[],[],[]
    by_job={}
    for job in contract['requests']:
        discovery(job,contract,root)
        m=metadata(job,root)
        stored = dict(localPath=m['path'],sha256=m['sha256'],byteSize=m['byteSize']) if 'path' in m else None
        success=stored is not None and 200 <= m['status'] < 300
        attempts.append(dict(attemptId='szse-acquire-'+job['requestId'],sourceId=contract['sourceId'],requestUrl=m['url'],
            finalUrl=m.get('finalUrl',m['url']) if stored else None,attemptedAt=m['fetchedAt'],httpStatus=m.get('status'),
            transportError=m.get('error'),storedBytes=stored,outcome='SUCCESS' if success else 'HTTP_ERROR' if stored else 'TRANSPORT_ERROR',
            reasonCode='BOUNDED_OFFICIAL_SOURCE_PROBE',candidateReleaseEventIds=[],handlingBasis='Acquisition is not market release evidence.',
            verifiedAt=None,acquisitionAttemptId=None))
        if not success:
            probes.append(dict(requestId=job['requestId'],artifactId=None,status=attempts[-1]['outcome'],error=m.get('error')))
            continue
        body=safe_file(root,m['path']).read_bytes()
        a=dict(sourceId=contract['sourceId'],sourceUrl=m.get('finalUrl',m['url']),fetchedAt=m['fetchedAt'],contentType=m['contentType'],
               fileName=Path(m['path']).name,sha256=m['sha256'],byteSize=len(body),httpStatus=m['status'],artifactRole='RAW_SOURCE',
               localPath=m['path'],parseStatus='INDEXED',error=None,evidenceRole=job['role'])
        a['artifactId']=evidence_artifact_identity(a)
        artifacts.append(a);by_job[job['requestId']]=a
        prefix=body[:32].decode('ascii')
        bindings.append(dict(artifactId=a['artifactId'],releaseEventId=None,completeResponse=True,contentValidation='VALIDATED',
                             contentEvidence=dict(artifactId=a['artifactId'],byteOffset=0,byteLength=len(prefix),text=prefix)))
        if job['familyId']:
            # Small complete JSON bytes are committed as replay evidence, not as observations.
            responses.append(dict(requestId=job['requestId'],artifactId=a['artifactId'],bodyText=body.decode('utf-8')))
            try:
                result,status=parse_response(job,body,a['artifactId'],contract)
                candidates.extend(result['candidates']);rejected.extend(result['rejectedRows'])
                error=None
            except (ValueError,KeyError,TypeError,IndexError) as exc:
                status,error='PARSER_FAILED',str(exc)
                a.update(parseStatus='FAILED',error=error)
                bindings[-1]['contentValidation']='UNSUPPORTED'
            probes.append(dict(requestId=job['requestId'],artifactId=a['artifactId'],status=status,error=error))
    def proof_locator(p):
        a=by_job[p['requestId']]
        return locator(safe_file(root,a['localPath']).read_bytes(),a['artifactId'],p['text'])
    proofs=[dict(requestId=j['requestId'],parentRequestId=p['requestId'],locator=proof_locator(p))
            for j in contract['requests'] for p in j['proofs']]
    calendar=expected_calendar(contract,[proof_locator(p) for p in contract['calendar']['proofs']])
    breaks=[dict(date=b['date'],kind=b['kind'],evidence=proof_locator(b['proof']) if b['proof'] else None)
            for b in contract['definitionBreaks']]
    auxiliary=[dict(meaning=p['meaning'],locator=proof_locator(p)) for p in contract['auxiliaryProofs']]
    days=sorted({j['requestedDate'] for j in contract['requests'] if j['requestedDate']})
    out=dict(schemaVersion='1.0.0',kind='SZSE_SOURCE_INVENTORY_NOT_R2_DATASET',contract=contract,
        contractContentSha256=canonical_sha256(canonical_order(contract)),evidenceArtifacts=artifacts,artifactBindings=bindings,
        retrievalAttempts=attempts,discoveryEvidence=proofs,sourceResponses=responses,definitionBreaks=breaks,
        auxiliaryEvidence=auxiliary,
        probes=probes,calendar=calendar,candidates=candidates,rejectedRows=rejected,
        dayAssessments=[assess_day(d,candidates,calendar) for d in days],coverage=coverage_for(contract,calendar),
        admission=admission_for(contract,candidates),
        releaseEvents=[],fieldExtractions=[],exchangeMarketObservations=[],
        generatedAt=generated_at or datetime.now(timezone.utc).isoformat(timespec='seconds'))
    out=canonical_order(out);out['contentSha256']=canonical_sha256(business_projection(out))
    validate_compact(out)
    return out


def validate_compact(inv):
    contract=load_contract()
    require(set(inv)=={'schemaVersion','kind','contract','contractContentSha256','evidenceArtifacts','artifactBindings','retrievalAttempts',
        'discoveryEvidence','sourceResponses','definitionBreaks','auxiliaryEvidence','probes','calendar','candidates','rejectedRows','dayAssessments','coverage',
        'admission','releaseEvents','fieldExtractions','exchangeMarketObservations','generatedAt','contentSha256'},'INVENTORY_SCHEMA_KEYS')
    require(inv['schemaVersion']=='1.0.0' and inv['kind']=='SZSE_SOURCE_INVENTORY_NOT_R2_DATASET','INVENTORY_KIND')
    require(inv['contract']==canonical_order(contract),'EXTERNAL_SOURCE_CONTRACT_MISMATCH')
    require(inv['contractContentSha256']==canonical_sha256(canonical_order(contract)),'CONTRACT_HASH')
    require(inv['contentSha256']==canonical_sha256(business_projection(inv)),'INVENTORY_HASH')
    require(inv['releaseEvents']==[] and inv['fieldExtractions']==[] and inv['exchangeMarketObservations']==[],'UNADMITTED_RELEASE_OR_OBSERVATION')
    for key,definition,identity in [('evidenceArtifacts','evidenceArtifact','artifactId'),('artifactBindings','artifactBinding','artifactId'),
                                    ('retrievalAttempts','retrievalAttempt','attemptId')]:
        require(len({r[identity] for r in inv[key]})==len(inv[key]),'DUPLICATE_ID')
        for row in inv[key]:schema_check(row,definition)
    artifacts={a['artifactId']:a for a in inv['evidenceArtifacts']}
    by_name={a['fileName']:a for a in inv['evidenceArtifacts']}
    require(len(by_name)==len(artifacts),'DUPLICATE_FILE_NAME')
    jobs={j['requestId']:j for j in contract['requests']}
    require({t['attemptId'] for t in inv['retrievalAttempts']}=={'szse-acquire-'+j for j in jobs},'RETRIEVAL_INVENTORY_GAP')
    for a in artifacts.values():
        name=a['fileName'].removesuffix('.body')
        require(name in jobs and a['sourceUrl']==jobs[name]['url'] and official(a['sourceUrl']),'EVIDENCE_SOURCE')
        require(a['artifactId']==evidence_artifact_identity(a) and a['artifactRole']=='RAW_SOURCE','EVIDENCE_IDENTITY')
        require(a['sourceId']==contract['sourceId'] and a['evidenceRole']==jobs[name]['role']
                and a['localPath']==(RAW/(name+'.body')).as_posix(),'EVIDENCE_ROLE_OR_PATH')
    for t in inv['retrievalAttempts']:
        name=t['attemptId'].removeprefix('szse-acquire-')
        require(t['sourceId']==contract['sourceId'] and t['requestUrl']==jobs[name]['url']
                and t['candidateReleaseEventIds']==[] and t['verifiedAt'] is None and t['acquisitionAttemptId'] is None,
                'RETRIEVAL_SOURCE_OR_LINEAGE')
        a=by_name.get(name+'.body')
        if a:
            require(t['outcome']=='SUCCESS' and t['transportError'] is None and t['httpStatus']==a['httpStatus']
                    and t['finalUrl']==a['sourceUrl'] and t['attemptedAt']==a['fetchedAt']
                    and t['storedBytes']=={k:a[k] for k in ('localPath','sha256','byteSize')},'RETRIEVAL_ARTIFACT_MISMATCH')
        else:
            require(t['outcome'] in ('HTTP_ERROR','TRANSPORT_ERROR'),'FALSE_RETRIEVAL_SUCCESS')
    def proof(p,loc):
        require(set(loc)=={'artifactId','byteOffset','byteLength','text'},'LOCATOR_KEYS')
        a=by_name[p['requestId']+'.body']
        require(loc['artifactId']==a['artifactId'] and loc['text']==p['text'],'PROOF_SOURCE_OR_TEXT')
        require(type(loc['byteOffset']) is int and loc['byteOffset']>=0 and type(loc['byteLength']) is int
                and loc['byteLength']==len(loc['text'].encode()) and loc['byteOffset']+loc['byteLength']<=a['byteSize'],'LOCATOR_BOUNDS')
    c=inv['calendar']
    require(len(c['evidence'])==len(contract['calendar']['proofs']),'CALENDAR_PROOF_COUNT')
    for p in contract['calendar']['proofs']:
        matches=[l for l in c['evidence'] if l['text']==p['text']]
        require(len(matches)==1,'CALENDAR_PROOF_MISSING');proof(p,matches[0])
    require(c==expected_calendar(contract,c['evidence']),'CALENDAR_CONTRACT_MISMATCH')
    require(inv['coverage']==canonical_order(coverage_for(contract,c)),'COVERAGE_CONTRACT_MISMATCH')
    expected_admission=admission_for(contract,inv['candidates'])
    require(inv['admission']==canonical_order(expected_admission),'FALSE_ADMISSION')
    expected_proofs=[(j['requestId'],p) for j in contract['requests'] for p in j['proofs']]
    require(len(inv['discoveryEvidence'])==len(expected_proofs),'DISCOVERY_PROOF_COUNT')
    for name,p in expected_proofs:
        matches=[e for e in inv['discoveryEvidence'] if e['requestId']==name and e['parentRequestId']==p['requestId'] and e['locator']['text']==p['text']]
        require(len(matches)==1 and set(matches[0])=={'requestId','parentRequestId','locator'},'DISCOVERY_PROOF_MISSING')
        proof(p,matches[0]['locator'])
    require(len(inv['definitionBreaks'])==len(contract['definitionBreaks']),'BREAK_COUNT')
    for b in contract['definitionBreaks']:
        matches=[e for e in inv['definitionBreaks'] if e['date']==b['date'] and e['kind']==b['kind']]
        require(len(matches)==1 and set(matches[0])=={'date','kind','evidence'},'BREAK_MISMATCH')
        if b['proof']:proof(b['proof'],matches[0]['evidence'])
        else:require(matches[0]['evidence'] is None,'UNPROVEN_BREAK')
    require(len(inv['auxiliaryEvidence'])==len(contract['auxiliaryProofs']),'AUXILIARY_PROOF_COUNT')
    for p in contract['auxiliaryProofs']:
        matches=[e for e in inv['auxiliaryEvidence'] if e['meaning']==p['meaning']]
        require(len(matches)==1 and set(matches[0])=={'meaning','locator'},'AUXILIARY_PROOF_MISSING')
        proof(p,matches[0]['locator'])
    require(len({r['requestId'] for r in inv['sourceResponses']})==len(inv['sourceResponses']),'DUPLICATE_RESPONSE')
    require({r['requestId'] for r in inv['sourceResponses']}=={j['requestId'] for j in contract['requests'] if j['familyId'] and j['requestId']+'.body' in by_name},'RESPONSE_INVENTORY_GAP')
    candidates,rejected,probes=[],[],[]
    for r in inv['sourceResponses']:
        require(set(r)=={'requestId','artifactId','bodyText'},'RESPONSE_KEYS')
        a=artifacts[r['artifactId']];job=jobs[r['requestId']];body=r['bodyText'].encode()
        require(a['fileName']==job['requestId']+'.body' and sha256_bytes(body)==a['sha256'] and len(body)==a['byteSize'],'RESPONSE_BYTES')
        try:
            result,status=parse_response(job,body,a['artifactId'],contract)
            candidates.extend(result['candidates']);rejected.extend(result['rejectedRows']);error=None
        except (ValueError,KeyError,TypeError,IndexError) as exc:
            status,error='PARSER_FAILED',str(exc)
        probes.append(dict(requestId=job['requestId'],artifactId=a['artifactId'],status=status,error=error))
    for job in contract['requests']:
        if job['requestId']+'.body' not in by_name:
            t=next(t for t in inv['retrievalAttempts'] if t['attemptId']=='szse-acquire-'+job['requestId'])
            probes.append(dict(requestId=job['requestId'],artifactId=None,status=t['outcome'],error=t['transportError']))
    require(inv['probes']==canonical_order(probes),'PROBE_REPLAY')
    require(inv['candidates']==canonical_order(candidates) and inv['rejectedRows']==canonical_order(rejected),'CANDIDATE_REPLAY')
    days=sorted({j['requestedDate'] for j in contract['requests'] if j['requestedDate']})
    require(inv['dayAssessments']==canonical_order([assess_day(d,candidates,c) for d in days]),'FIELD_ASSESSMENT_MISMATCH')
    require({b['artifactId'] for b in inv['artifactBindings']}==set(artifacts),'BINDING_INVENTORY_GAP')
    for b in inv['artifactBindings']:
        require(b['releaseEventId'] is None and b['completeResponse'] is True,'DISCOVERY_CANNOT_BIND_RELEASE')
        a=artifacts[b['artifactId']]
        parsed=next((p for p in probes if p['artifactId']==a['artifactId']),None)
        failed=parsed is not None and parsed['status']=='PARSER_FAILED'
        require(a['parseStatus']==('FAILED' if failed else 'INDEXED')
                and a['error']==(parsed['error'] if failed else None)
                and b['contentValidation']==('UNSUPPORTED' if failed else 'VALIDATED'),'CONTENT_VALIDATION_REPLAY')
        loc=b['contentEvidence']
        require(set(loc)=={'artifactId','byteOffset','byteLength','text'} and loc['artifactId']==a['artifactId']
                and type(loc['byteOffset']) is int and loc['byteOffset']==0 and type(loc['byteLength']) is int
                and loc['byteLength']==32 and len(loc['text'].encode())==32 and a['byteSize']>=32,'CONTENT_LOCATOR')
        response=next((r for r in inv['sourceResponses'] if r['artifactId']==a['artifactId']),None)
        if response:require(response['bodyText'].encode()[:32]==loc['text'].encode(),'CONTENT_LOCATOR_REPLAY')


def validate(inv,*,root=ROOT):
    validate_compact(inv)
    artifacts={a['artifactId']:a for a in inv['evidenceArtifacts']}
    for b in inv['artifactBindings']:replay_locator(b['contentEvidence'],artifacts,root)
    for e in inv['discoveryEvidence']:replay_locator(e['locator'],artifacts,root)
    for e in inv['calendar']['evidence']:replay_locator(e,artifacts,root)
    for e in inv['definitionBreaks']:
        if e['evidence']:replay_locator(e['evidence'],artifacts,root)
    for e in inv['auxiliaryEvidence']:replay_locator(e['locator'],artifacts,root)
    require(build(root=root,generated_at=inv['generatedAt'])==inv,'SOURCE_INVENTORY_REPLAY_MISMATCH')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['fetch','build','validate','validate-compact'])
    args=parser.parse_args()
    if args.command=='fetch':
        print(json.dumps(fetch()));return
    path=ROOT/OUTPUT
    if args.command=='build':
        old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else None
        inv=build(generated_at=old['generatedAt'] if old else None)
        if old:require(old==inv,'SEALED_INVENTORY_DIFFERS_USE_NEW_VERSION')
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(json.dumps(inv,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    else:
        inv=json.loads(path.read_text(encoding='utf-8'))
        (validate if args.command=='validate' else validate_compact)(inv)
    print(json.dumps(dict(validation='PASS',admission='PARTIAL',candidates=len(inv['candidates']),formalCoverage=0,
                         strictPitCoverage=0,fullTradingDayDenominator=None,contentSha256=inv['contentSha256'])))


if __name__=='__main__':
    main()
