"""Synthetic protocol fixtures only; temporary official-shaped tests are not data evidence."""
from copy import deepcopy
from pathlib import Path

from scripts.market_regime.catalog import build_catalog
from scripts.market_regime.hashing import sha256_bytes
from scripts.market_regime.historical import artifact_identity, plan_identity, release_identity, target_grid


AS_OF = "2026-09-07T08:00:00+08:00"
GENERATED = "2026-09-08T00:00:00Z"


def make_fixture(root: Path, *, historical=False):
    # historical=True models full HTTP-response contracts entirely in a temp dir.
    # The test never fetches, publishes, or claims these bytes are official evidence.
    host = "https://www.pbc.gov.cn" if historical else "https://source.invalid"
    local = "raw/response.html" if historical else "scripts/tests/fixtures/market_regime/r2a-synthetic-response.html"
    body = (("" if historical else "SYNTHETIC OFFLINE TEST FIXTURE\n") +
            '<html><title>Protocol report</title><body>\n'
            '2026-09-07T07:59:00+08:00 INITIAL RELEASE\n'
            '2026-09-07T08:00:00+08:00 OFFICIAL CORRECTION\n'
            '2026-09-07T08:01:00+08:00 LATER RELEASE\n'
            '2026-09-06 BACKCAST\n'
            '2026-01 M2 % 10.0 comparable basis\n'
            '2026-01 M2 % 11.0 comparable basis\n'
            '2026-02 M2 % 9.0 comparable basis\n'
            '2026-09-03 turnover CNY 20.0 A shares\n'
            'Calendar dates: 2026-09-03 2026-09-04\n'
            'Index pages 1..1 fully scanned; all candidates reconciled.\n'
            'Mechanism unavailable; archive absent.\n'
            '</body></html>\n').encode()
    path = root / local
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    definitions = []
    for did, source, metric, unit, frequency in [
        ('m2-v1','TEST_M2','MACRO_M2_YOY','%','MONTHLY'),
        ('exchange-v1','TEST_EXCHANGE','EXCHANGE_MARKET_STATS','CNY','DAILY')]:
        definitions.append(dict(sourceDefinitionId=did,sourceId=source,metricId=metric,version='1.0.0',
                                effectiveFrom='2026-01-01',effectiveTo=None,definitionSummary='Synthetic contract model',
                                unit=unit,nativeFrequency=frequency,releaseSemantics='Official event evidence required',
                                revisionPolicy='Append-only authoritative replacement',sourceUrlPattern=host+'/',createdAt=GENERATED))
    seed = dict(sourceDefinitions=definitions, artifacts=[], observations=[], exchangeMarketObservations=[],
                marketScopeVersions=[], providerSlots=[], generatedAt=GENERATED)
    payload = dict(planId='', datasetVersion='r2a-synthetic-offline-v1',releaseEvents=[],artifactBindings=[],
                   fieldExtractions=[],coverageLedger=[],retrievalAttempts=[],conflicts=[],inventoryEvidence=[])

    def loc(aid, text):
        encoded = text.encode()
        return dict(artifactId=aid,byteOffset=body.index(encoded),byteLength=len(encoded),text=text)

    def event(source, kind, period, instant, label, *, date_only=False):
        confidence = 'BACKCAST_RELEASED_LATER' if kind == 'BACKCAST' else ('DATE_ONLY_SAFE' if date_only else 'EXACT_TIMESTAMP')
        publication = None if date_only else instant
        publication_date = instant[:10]
        available = '2026-09-07T00:00:00+08:00' if date_only else instant
        e = dict(sourceId=source,landingUrl=host+'/report.html',eventSection=label,publicationDateTime=publication,
                 publicationDate=publication_date,releaseAvailableAt=available,releaseConfidenceClass=confidence,
                 releaseKind=kind,coveredPeriods=[period],attachmentArtifactIds=[],attachmentEvidence=[],
                 firstReleaseEvidenceArtifactIds=[],firstReleaseEvidence=[],revisionEvidence=[])
        eid = release_identity(e)
        a = dict(sourceId=source,sourceUrl=e['landingUrl'],publicationDateTime=publication,publicationDate=publication_date,
                 releaseAvailableAt=available,fetchedAt=GENERATED,contentType='text/html',fileName='response.html',
                 sha256=sha256_bytes(body),byteSize=len(body),httpStatus=200,releaseConfidenceClass=confidence,
                 artifactRole='RAW_SOURCE' if historical else 'TEST_FIXTURE_EXCERPT',localPath=local,parseStatus='PARSED',error=None)
        aid = artifact_identity(a,eid)
        a['artifactId'] = aid
        e.update(releaseEventId=eid,landingArtifactId=aid,publicationEvidence=loc(aid,instant))
        if kind == 'FIRST_RELEASE':
            e['firstReleaseEvidenceArtifactIds']=[aid]
            e['firstReleaseEvidence']=[loc(aid,'INITIAL RELEASE' if '07:59' in instant else label)]
        if kind == 'REVISION':
            e['revisionEvidence']=[loc(aid,'OFFICIAL CORRECTION')]
        seed['artifacts'].append(a)
        payload['releaseEvents'].append(e)
        payload['artifactBindings'].append(dict(artifactId=aid,releaseEventId=eid,completeResponse=historical,
                                               contentValidation='VALIDATED',contentEvidence=loc(aid,'<title>Protocol report</title>')))
        payload['retrievalAttempts'].append(dict(attemptId='attempt-'+str(len(seed['artifacts'])),sourceId=source,
            requestUrl=a['sourceUrl'],finalUrl=a['sourceUrl'],attemptedAt=GENERATED,httpStatus=200,transportError=None,
            storedBytes={k:a[k] for k in ('localPath','sha256','byteSize')},outcome='SUCCESS',reasonCode='OFFLINE_MODEL',
            candidateReleaseEventIds=[eid],handlingBasis='Synthetic protocol fixture, no network request'))
        return e,a

    first,a0 = event('TEST_M2','FIRST_RELEASE','2026-01','2026-09-07T07:59:00+08:00','INITIAL RELEASE')
    revision,a1 = event('TEST_M2','REVISION','2026-01','2026-09-07T08:00:00+08:00','OFFICIAL CORRECTION')
    backcast,ab = event('TEST_M2','BACKCAST','2026-02','2026-09-06','BACKCAST',date_only=True)
    later,al = event('TEST_M2','FIRST_RELEASE','2026-03','2026-09-07T08:01:00+08:00','LATER RELEASE')
    market,am = event('TEST_EXCHANGE','FIRST_RELEASE','2026-09-03','2026-09-07T07:59:00+08:00','INITIAL RELEASE')

    def extraction(e,a,oid,field,did,raw,value,period,*,sequence=0,previous=None):
        x = dict(extractionId='extract-'+oid,observationId=oid if field=='value' else None,
                 exchangeObservationId=oid if field!='value' else None,field=field,releaseEventId=e['releaseEventId'],
                 rawArtifactId=a['artifactId'],sourceDefinitionId=did,parserVersion='synthetic-parser-v1',
                 rawFieldName='M2' if field=='value' else 'turnover',rawUnit='%' if field=='value' else 'CNY',
                 rawValue=value,rawValueText=str(value),locator=loc(a['artifactId'],raw),period=period,
                 periodSemantics='MONTH' if field=='value' else 'DAY',unitConversion=dict(rule='IDENTITY',factor=1,
                 outputUnit='%' if field=='value' else 'CNY'),basisEvidence=loc(a['artifactId'],raw),
                 reportedComparableBasis=True,predecessorExtractionIds=['extract-'+previous] if previous else [])
        payload['fieldExtractions'].append(x)
        if field=='value':
            seed['observations'].append(dict(observationId=oid,metricId='MACRO_M2_YOY',valueDate=period,
                releaseDateTime=e['publicationDateTime'],releaseAvailableAt=e['releaseAvailableAt'],fetchedAt=GENERATED,
                value=value,unit='%',sourceId='TEST_M2',sourceDefinitionId=did,revisionSequence=sequence,
                supersedesObservationId=previous,releaseConfidenceClass=e['releaseConfidenceClass'],
                qualityStatus='REVISED' if sequence else 'BACKCAST' if e['releaseKind']=='BACKCAST' else 'PROVISIONAL',
                rawArtifactId=a['artifactId'],transformVersion=x['parserVersion'],metadata={'publicationDate':e['publicationDate']}))
        else:
            seed['exchangeMarketObservations'].append(dict(observationId=oid,exchange='SSE',tradeDate=period,
                totalMarketCap=None,negotiableMarketCap=None,turnoverValue=value,currency='CNY',sourceDefinitionId=did,
                releaseAvailableAt=e['releaseAvailableAt'],qualityStatus='VERIFIED'))
    extraction(first,a0,'jan-v0','value','m2-v1','2026-01 M2 % 10.0 comparable basis',10.0,'2026-01')
    extraction(revision,a1,'jan-v1','value','m2-v1','2026-01 M2 % 11.0 comparable basis',11.0,'2026-01',sequence=1,previous='jan-v0')
    extraction(backcast,ab,'feb-backcast','value','m2-v1','2026-02 M2 % 9.0 comparable basis',9.0,'2026-02')
    extraction(market,am,'sep-03','turnoverValue','exchange-v1','2026-09-03 turnover CNY 20.0 A shares',20.0,'2026-09-03')
    sources=[dict(sourceId=s,officialRoots=[host+'/'],indexUrls=[host+'/report.html'],pagination=dict(startPage=1,endPage=1,
             stopCondition='Last linked index page',requestLimit=10,timeoutSeconds=5,enumerationRule='OFFICIAL_LINKS_ONLY'),
             firstReleaseRule='Require retained initial-release evidence; collected sequence zero is insufficient')
             for s in ['TEST_M2','TEST_EXCHANGE']]
    plan=dict(schemaVersion='1.0.0',planName='r2a-offline-protocol',planVersion='1.0.0',planId='',
              purpose='HISTORICAL' if historical else 'SYNTHETIC_OFFLINE',datasetAsOf=AS_OF,timezone='Asia/Shanghai',
              decisionClock='MONDAY_0800',sources=sources,targetWindows=[
                  dict(windowId='monthly',sourceId='TEST_M2',metricId='MACRO_M2_YOY',field='value',frequency='MONTHLY',
                       start='2026-01',end='2026-03',scopeVersion='test-national-v1',nativeFrequencyEra='MONTHLY',
                       sourceDefinitionIds=['m2-v1'],calendar=None),
                  dict(windowId='daily',sourceId='TEST_EXCHANGE',metricId='EXCHANGE_MARKET_STATS',field='turnoverValue',
                       frequency='TRADING_DAY',start='2026-09-03',end='2026-09-04',scopeVersion='test-sse-a-v1',
                       nativeFrequencyEra='DAILY',sourceDefinitionIds=['exchange-v1'],calendar=dict(calendarVersion='test-calendar-v1',
                       dates=['2026-09-03','2026-09-04'],evidence=[loc(am['artifactId'],'Calendar dates: 2026-09-03 2026-09-04')]))])
    plan['planId']=plan_identity(plan)
    payload['planId']=plan['planId']
    for cell in target_grid(plan):
        candidates=[e['releaseEventId'] for e in payload['releaseEvents'] if e['sourceId']==cell['sourceId'] and cell['period'] in e['coveredPeriods']]
        admitted=[x['observationId'] or x['exchangeObservationId'] for x in payload['fieldExtractions']
                  if x['releaseEventId'] in candidates] if historical else []
        row={**cell,'status':'AVAILABLE' if admitted else 'PIT_VINTAGE_UNPROVEN','reasonCode':'SYNTHETIC_PROTOCOL',
             'evidenceArtifactIds':[],'statusEvidence':[],'candidateReleaseEventIds':candidates,'admittedObservationIds':admitted}
        if cell['period']=='2026-03':
            row.update(status='NOT_YET_RELEASED',evidenceArtifactIds=[al['artifactId']],statusEvidence=[later['publicationEvidence']])
        if cell['period']=='2026-09-04':
            row.update(status='SOURCE_UNREACHABLE',reasonCode='TIMEOUT')
        payload['coverageLedger'].append(row)
    payload['retrievalAttempts'].append(dict(attemptId='timeout',sourceId='TEST_EXCHANGE',requestUrl=host+'/index.html',
        finalUrl=None,attemptedAt=GENERATED,httpStatus=None,transportError='TimeoutError',storedBytes=None,
        outcome='TRANSPORT_ERROR',reasonCode='TIMEOUT',candidateReleaseEventIds=[],handlingBasis='Preserve gap; no pseudo-artifact'))
    for window,a in [('monthly',a0),('daily',am)]:
        payload['inventoryEvidence'].append(dict(windowId=window,scannedIndexUrls=[host+'/report.html'],paginationComplete=True,
            candidatesReconciled=True,revisionScanComplete=False,evidence=[loc(a['artifactId'],'Index pages 1..1 fully scanned; all candidates reconciled.')]))
    return {'catalog':build_catalog(seed),'dataset':payload},[plan]
