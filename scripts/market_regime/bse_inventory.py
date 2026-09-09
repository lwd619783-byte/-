"""Bounded official BSE acquisition and independently anchored compact/full replay."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

from .hashing import canonical_sha256, sha256_bytes, atomic_write_bytes
from .historical import canonical_order, evidence_artifact_identity
from .historical_validator import require, safe_file, schema_check
from .bse_source import (ROOT, FIELDS, load_contract, parse_daily, strict_json, unwrap,
                         assess_day, business_projection)

RAW = Path('research-data/market-regime/raw/bse-d1c')
OUTPUT = Path('research-data/market-regime/source-catalog/bse-d1c/inventory.v1.json')
CAPTURES = ROOT / OUTPUT.parent / 'captures.v1.json'
FIXTURES = ROOT / 'scripts/tests/fixtures/market_regime/bse-d1c-fixtures.provenance.json'


def official(url):
    p = urlsplit(url)
    return (p.scheme == 'https' and p.hostname == 'www.bse.cn' and p.port in (None,443)
            and not p.username and not p.password and not p.fragment)


def capture_records():
    return strict_json(CAPTURES.read_bytes())


def validate_request(job, contract):
    require(contract == load_contract(), 'EXTERNAL_CONTRACT_REQUIRED')
    require(job in contract['requests'] and official(job['url']), 'UNFROZEN_REQUEST')
    if job['familyId'] == 'daily-report':
        require(job['url'] == 'https://www.bse.cn/marketStatController/dailyReport.do'
                and job['method'] == 'POST' and job['form'] == 'HQJSRQ='+job['requestedDate'].replace('-',''),
                'DATE_FAMILY_OR_PAGINATION_REQUEST')


def metadata(job, root):
    m = strict_json(safe_file(root, (RAW/(job['requestId']+'.json')).as_posix()).read_bytes())
    require(m['url'] == job['url'] and m.get('method','GET') == job['method']
            and m.get('form') == job['form'], 'REQUEST_METADATA')
    if 'path' in m:
        require(m['path'] == (RAW/(job['requestId']+'.body')).as_posix(), 'ACQUISITION_PATH')
        b = safe_file(root,m['path']).read_bytes()
        require(len(b) == m['byteSize'] and sha256_bytes(b) == m['sha256'], 'ACQUISITION_BYTES')
        require(official(m['finalUrl']), 'NON_OFFICIAL_RESPONSE')
    return m


def discovery(job, contract, root):
    validate_request(job,contract)
    jobs = {j['requestId']:j for j in contract['requests']}
    for p in job['proofs']:
        m = metadata(jobs[p['requestId']],root)
        require(200 <= m.get('status',0) < 300, 'DISCOVERY_PARENT_UNAVAILABLE')
        b = safe_file(root,m['path']).read_bytes()
        require(b[p['byteOffset']:p['byteOffset']+p['byteLength']] == p['text'].encode(), 'DISCOVERY_BYTES')


class OfficialRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        require(official(newurl), 'REDIRECT_OUTSIDE_BSE')
        return super().redirect_request(req,fp,code,msg,headers,newurl)


def fetch(*, root=ROOT):
    contract = load_contract()
    require(len(contract['requests']) <= contract['acquisition']['maxRequests'], 'REQUEST_BOUND')
    folder = root/RAW
    folder.mkdir(parents=True,exist_ok=True)
    results = []
    for job in contract['requests']:
        path = folder/(job['requestId']+'.json')
        if path.exists():
            metadata(job,root)
            results.append(dict(requestId=job['requestId'],status='CACHE_VERIFIED'));continue
        # Stop dependent calls on a missing/refused parent; retain earlier failures.
        discovery(job,contract,root)
        m = dict(url=job['url'],fetchedAt=datetime.now(timezone.utc).isoformat(timespec='seconds'))
        if job['method'] == 'POST':m.update(method='POST',form=job['form'])
        try:
            response = build_opener(OfficialRedirect()).open(Request(job['url'],
                data=job['form'].encode() if job['form'] is not None else None,
                headers={'User-Agent':'investment-research-dashboard-bse-d1c/1.0'}),
                timeout=contract['acquisition']['timeoutSeconds'])
        except HTTPError as exc:response=exc
        except OSError as exc:response=None;m['error']=type(exc).__name__
        if response is not None:
            with response:
                require(official(response.url),'NON_OFFICIAL_RESPONSE')
                m.update(finalUrl=response.url,status=response.status,contentType=response.headers.get('Content-Type',''))
                try:
                    b=response.read(contract['acquisition']['maxResponseBytes']+1)
                    if len(b)>contract['acquisition']['maxResponseBytes']:
                        m['error']='RESPONSE_TOO_LARGE';b=None
                except OSError as exc:
                    m['error']=type(exc).__name__;b=None
                if b is not None:
                    raw=folder/(job['requestId']+'.body')
                    require(not raw.exists(),'UNINDEXED_RAW_EXISTS')
                    atomic_write_bytes(raw,b)
                    m.update(path=raw.relative_to(root).as_posix(),sha256=sha256_bytes(b),byteSize=len(b))
        atomic_write_bytes(path,(json.dumps(m,ensure_ascii=False,indent=2)+'\n').encode())
        results.append(dict(requestId=job['requestId'],status=m.get('error',m.get('status'))))
    return results


def derive(responses, records, generated_at):
    """Pure replay; never trust the inventory's derived candidate/admission claims."""
    c=load_contract()
    jobs={j['requestId']:j for j in c['requests']}
    require(len(records)==len(jobs) and {r['requestId'] for r in records}==set(jobs),'CAPTURE_SET')
    require(len(responses)==len({r['requestId'] for r in responses}), 'DUPLICATE_RESPONSE')
    response_map={r['requestId']:r for r in responses}
    require(set(response_map)=={j['requestId'] for j in jobs.values() if j['familyId']},'RESPONSE_SET')
    artifacts,attempts,probes,candidates,rejected=[],[],[],[],[]
    by_job={}
    for record in records:
        name=record['requestId'];m=record['metadata'];job=jobs[name]
        validate_request(job,c)
        require(m['url']==job['url'] and m.get('method','GET')==job['method'] and m.get('form')==job['form'],'CAPTURE_REQUEST')
        stored=dict(localPath=m['path'],sha256=m['sha256'],byteSize=m['byteSize']) if 'path' in m else None
        success=stored is not None and 200<=m['status']<300
        attempt=dict(attemptId='bse-acquire-'+name,sourceId=c['sourceId'],requestUrl=m['url'],
            finalUrl=m.get('finalUrl'),attemptedAt=m['fetchedAt'],httpStatus=m.get('status'),transportError=m.get('error'),
            storedBytes=stored,outcome='SUCCESS' if success else 'HTTP_ERROR' if stored else 'TRANSPORT_ERROR',
            reasonCode='BOUNDED_OFFICIAL_SOURCE_PROBE',candidateReleaseEventIds=[],
            handlingBasis='Request method/form are anchored in captures; acquisition is not market release.',
            verifiedAt=None,acquisitionAttemptId=None)
        schema_check(attempt,'retrievalAttempt');attempts.append(attempt)
        if not success:
            probes.append(dict(requestId=name,status=attempt['outcome'],error=m.get('error')));continue
        require(official(m['finalUrl']) and m['path']==(RAW/(name+'.body')).as_posix(),'CAPTURE_PATH_OR_ORIGIN')
        a=dict(sourceId=c['sourceId'],sourceUrl=m['finalUrl'],fetchedAt=m['fetchedAt'],contentType=m['contentType'],
            fileName=name+'.body',sha256=m['sha256'],byteSize=m['byteSize'],httpStatus=m['status'],artifactRole='RAW_SOURCE',
            localPath=m['path'],parseStatus='INDEXED',error=None,evidenceRole=job['role'])
        a['artifactId']=evidence_artifact_identity(a)
        by_job[name]=a;artifacts.append(a)
        if job['familyId']:
            r=response_map[name]
            require(set(r)=={'requestId','bodyText'},'RESPONSE_KEYS')
            b=r['bodyText'].encode()
            require(sha256_bytes(b)==a['sha256'] and len(b)==a['byteSize'],'RESPONSE_CAPTURE_DIGEST')
            try:
                if job['familyId']=='daily-report':
                    parsed=parse_daily(b,family=c['families'][0],requested_date=job['requestedDate'],artifact_id=a['artifactId'])
                    candidates.extend(parsed['candidates']);rejected.extend(parsed['rejectedRows'])
                    status='PARSED_CANDIDATES_ONLY' if parsed['candidates'] else 'EMPTY_RESPONSE_NOT_CALENDAR'
                else:
                    doc=strict_json(unwrap(b))
                    require(isinstance(doc,dict) and isinstance(doc.get('market'),list),'HOME_MARKET_SHAPE')
                    status='CURRENT_ONLY_NOT_HISTORICAL_CANDIDATE'
                error=None
            except (ValueError,KeyError,TypeError,IndexError) as exc:
                status,error='PARSER_FAILED',str(exc);a.update(parseStatus='FAILED',error=error)
            probes.append(dict(requestId=name,status=status,error=error))
        schema_check(a,'evidenceArtifact')
    def loc(p):
        a=by_job[p['requestId']]
        require(type(p['byteOffset']) is int and p['byteOffset']>=0 and p['byteLength']==len(p['text'].encode())
                and p['byteOffset']+p['byteLength']<=a['byteSize'],'PROOF_BOUNDS')
        return dict(artifactId=a['artifactId'],**{k:p[k] for k in ('byteOffset','byteLength','text')})
    discovery_proofs=[dict(requestId=j['requestId'],parentRequestId=p['requestId'],locator=loc(p)) for j in c['requests'] for p in j['proofs']]
    auxiliary=[dict(meaning=p['meaning'],locator=loc(p['proof'])) for p in c['auxiliaryProofs']]
    calendar={k:v for k,v in c['calendar'].items() if k!='windows'}
    calendar['windows']=[{**{k:v for k,v in w.items() if k!='proof'},'evidence':loc(w['proof'])} for w in c['calendar']['windows']]
    calendar['contentSha256']=canonical_sha256(canonical_order(calendar))
    days=sorted({j['requestedDate'] for j in jobs.values() if j['requestedDate']})
    coverage=dict(status='PARTIAL',fullTarget=c['targetWindow'],officialTradingDayTargetCount=None,
        provenCalendarSubwindowTargetCount=sum(len(w['openDates']) for w in calendar['windows']),
        unadmittedWindows=[dict(start=c['targetWindow']['start'],end=c['targetWindow']['end'],reason='FULL_CALENDAR_SCOPE_AND_PIT_UNPROVEN')],
        fields={f:dict(status='PARTIAL',candidateDateCount=len({x['tradeDate'] for x in candidates if x['field']==f and x['rawValueText'] is not None}),
                       availableCount=0,strictPitCount=0,historicalAdmittedWindows=[]) for f in FIELDS})
    out=dict(schemaVersion='1.0.0',kind='BSE_SOURCE_INVENTORY_NOT_R2_DATASET',contract=c,
        contractContentSha256=canonical_sha256(canonical_order(c)),captureContentSha256=canonical_sha256(canonical_order(records)),
        evidenceArtifacts=artifacts,retrievalAttempts=attempts,discoveryEvidence=discovery_proofs,auxiliaryEvidence=auxiliary,
        sourceResponses=responses,probes=probes,calendar=calendar,definitionBreaks=c['definitionBreaks'],
        candidates=candidates,rejectedRows=rejected,dayAssessments=[assess_day(d,candidates,calendar) for d in days],coverage=coverage,
        admission=dict(status='PARTIAL',sourceDiscovered=True,parserWorks=bool(candidates),candidateAvailableCount=len(candidates),
                       formalCoverage=0,strictPitCoverage=0,blockers=c['blockers']),
        releaseEvents=[],fieldExtractions=[],exchangeMarketObservations=[],generatedAt=generated_at)
    out=canonical_order(out);out['contentSha256']=canonical_sha256(business_projection(out))
    return out


def compact_responses():
    responses=[]
    for f in strict_json(FIXTURES.read_bytes()):
        b=safe_file(ROOT,f['path']).read_bytes()
        require(sha256_bytes(b)==f['sha256'] and len(b)==f['byteSize'] and f['historicalCoverage']==0
                and f['artifactRole']=='TEST_FIXTURE_EXCERPT' and f['completeResponse'] is True,'FIXTURE_PROVENANCE')
        responses.append(dict(requestId=f['requestId'],bodyText=b.decode('utf-8')))
    return responses


def validate_compact(inv):
    require(isinstance(inv,dict) and 'generatedAt' in inv,'INVENTORY_SHAPE')
    require(datetime.fromisoformat(inv['generatedAt'].replace('Z','+00:00')).utcoffset() is not None,'GENERATION_TIMEZONE')
    require(inv==derive(compact_responses(),capture_records(),inv['generatedAt']), 'COMPACT_REPLAY_MISMATCH')


def build(*,root=ROOT,generated_at=None):
    c=load_contract();records=[];responses=[]
    for j in c['requests']:
        discovery(j,c,root)
        m=metadata(j,root);records.append(dict(requestId=j['requestId'],metadata=m))
        if j['familyId']:
            responses.append(dict(requestId=j['requestId'],bodyText=safe_file(root,m['path']).read_bytes().decode()))
    require(canonical_order(records)==canonical_order(capture_records()),'NEW_CAPTURE_REQUIRES_NEW_VERSION')
    inv=derive(responses,records,generated_at or datetime.now(timezone.utc).isoformat(timespec='seconds'))
    validate_compact(inv)
    return inv


def validate(inv,*,root=ROOT):
    validate_compact(inv)
    require(build(root=root,generated_at=inv['generatedAt'])==inv,'FULL_REPLAY_MISMATCH')
    artifacts={a['artifactId']:a for a in inv['evidenceArtifacts']}
    from .bse_source import replay_locator
    for row in inv['discoveryEvidence']+inv['auxiliaryEvidence']:replay_locator(row['locator'],artifacts,root)
    for w in inv['calendar']['windows']:replay_locator(w['evidence'],artifacts,root)
    for row in inv['candidates']+inv['rejectedRows']:
        replay_locator(row['locator'],artifacts,root)
        if row.get('valueLocator'):replay_locator(row['valueLocator'],artifacts,root)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['fetch','build','validate','validate-compact'])
    parser.add_argument('--raw-root',type=Path,default=ROOT,help='New captures use a separate archive root; never replace sealed V1.')
    args=parser.parse_args()
    if args.command=='fetch':print(json.dumps(fetch(root=args.raw_root)));return
    path=ROOT/OUTPUT
    old=strict_json(path.read_bytes()) if path.exists() else None
    if args.command=='build':
        inv=build(root=args.raw_root,generated_at=old['generatedAt'] if old else None)
        if old:require(old==inv,'SEALED_INVENTORY_DIFFERS')
        else:atomic_write_bytes(path,(json.dumps(inv,ensure_ascii=False,indent=2)+'\n').encode())
    else:
        inv=old
        if args.command=='validate':validate(inv,root=args.raw_root)
        else:validate_compact(inv)
    print(json.dumps(dict(validation='PASS',admission='PARTIAL',candidates=len(inv['candidates']),formalCoverage=0,
                         strictPitCoverage=0,fullTradingDayDenominator=None,contentSha256=inv['contentSha256'])))


if __name__=='__main__':main()
