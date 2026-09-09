"""SYNTHETIC admitted protocol models, temp-directory only; historical coverage=0.

Like the R2-A historical=True fixture, these model HISTORICAL/RAW_SOURCE gates
without claiming the bytes were fetched. Only the explicitly synthetic D2 entry
mode accepts the test registry. Nothing here is imported by the real reporter.
"""
from scripts.market_regime.catalog import build_catalog
from scripts.market_regime.hashing import sha256_bytes
from scripts.market_regime.historical import (
    artifact_identity, build_dataset, evidence_artifact_identity, plan_identity,
    release_identity, target_grid,
)
from scripts.market_regime.all_a_admission import AS_OF, FIELDS, GENERATED


def make_bundle(root, exchange, day, *, missing=(), unit='CNY', raw_unit='CNY', factor=1,
                scope=None, security_scope='A_SHARES', minute=0, amount=10):
    source = 'TEST_' + exchange
    host = {'SSE': 'https://www.sse.com.cn', 'SZSE': 'https://www.szse.cn', 'BSE': 'https://www.bse.cn'}[exchange]
    publication = day + f'T16:{minute:02}:00+08:00'
    scope = scope or exchange.lower() + '-a-shares-v1'
    did = source + '-definition'
    oid = source + '-observation'
    event = dict(sourceId=source, landingUrl=host+'/report.html', eventSection='INITIAL RELEASE',
                 publicationDateTime=publication, publicationDate=day, releaseAvailableAt=publication,
                 releaseConfidenceClass='EXACT_TIMESTAMP', releaseKind='FIRST_RELEASE', coveredPeriods=[day],
                 attachmentArtifactIds=[], attachmentEvidence=[], revisionEvidence=[], indexEvidence=[])
    event['releaseEventId'] = release_identity(event)
    payload = dict(planId='', datasetVersion='SYNTHETIC-ADMITTED-D2-v1', releaseEvents=[], artifactBindings=[],
                   fieldExtractions=[], coverageLedger=[], retrievalAttempts=[], conflicts=[], inventoryEvidence=[], evidenceArtifacts=[])
    artifacts = []
    bodies = {}

    def loc(a, text):
        data = text.encode()
        return dict(artifactId=a['artifactId'], byteOffset=bodies[a['artifactId']].index(data), byteLength=len(data), text=text)

    def artifact(name, text, role=None):
        body = text.encode()
        path = f'raw/{exchange}/{name}'
        target = root/path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        a = dict(sourceId=source, sourceUrl=host+'/'+name, fetchedAt=GENERATED, contentType='text/html', fileName=name,
                 sha256=sha256_bytes(body), byteSize=len(body), httpStatus=200, artifactRole='RAW_SOURCE',
                 localPath=path, parseStatus='PARSED', error=None)
        if role:
            a['evidenceRole'] = role
            a['artifactId'] = evidence_artifact_identity(a)
            payload['evidenceArtifacts'].append(a)
        else:
            a.update({k: event[k] for k in ('publicationDateTime', 'publicationDate', 'releaseAvailableAt', 'releaseConfidenceClass')})
            a['artifactId'] = artifact_identity(a, event['releaseEventId'])
            artifacts.append(a)
        bodies[a['artifactId']] = body
        payload['artifactBindings'].append(dict(artifactId=a['artifactId'], releaseEventId=None if role else event['releaseEventId'],
                                               completeResponse=True, contentValidation='VALIDATED', contentEvidence=loc(a, text)))
        payload['retrievalAttempts'].append(dict(attemptId=exchange+'-'+name, sourceId=source, requestUrl=a['sourceUrl'],
            finalUrl=a['sourceUrl'], attemptedAt=GENERATED, httpStatus=200, transportError=None,
            storedBytes={k:a[k] for k in ('localPath','sha256','byteSize')}, outcome='SUCCESS', reasonCode='OFFLINE_MODEL',
            candidateReleaseEventIds=[] if role else [event['releaseEventId']], handlingBasis='Synthetic protocol model; no network',
            verifiedAt=None, acquisitionAttemptId=None))
        return a

    values = {field: amount * (i+1) for i, field in enumerate(FIELDS)}
    lines = {f: f'{day} {f} {raw_unit} {v} A shares daily amount' for f, v in values.items() if f not in missing}
    a = artifact('report.html', '<html><title>Market report</title>\n'+publication+' INITIAL RELEASE\n'+'\n'.join(lines.values())+'</html>')
    calendar = artifact('calendar.html', '<html>Calendar '+day+'</html>', 'CALENDAR')
    entry = '<a href="report.html">'+publication+'</a>'
    archive = artifact('index.html', '<html>Page 1\n'+entry+'\nEND INDEX\nEND REVISION SCAN</html>', 'ARCHIVE_INDEX')
    event.update(landingArtifactId=a['artifactId'], publicationEvidence=loc(a, publication),
                 firstReleaseEvidenceArtifactIds=[a['artifactId']], firstReleaseEvidence=[loc(a, 'INITIAL RELEASE')],
                 indexEvidence=[dict(artifactId=archive['artifactId'], url=event['landingUrl'], locator=loc(archive, entry))])
    payload['releaseEvents'] = [event]
    definition = dict(sourceDefinitionId=did, sourceId=source, metricId='EXCHANGE_MARKET_STATS', version='1.0.0',
                      effectiveFrom='2005-01-01', effectiveTo=None, definitionSummary='Synthetic A-share daily field definition',
                      unit=unit, nativeFrequency='DAILY', releaseSemantics='Independent release proof',
                      revisionPolicy='Append-only', sourceUrlPattern=host+'/', createdAt=GENERATED)
    o = dict(observationId=oid, exchange=exchange, tradeDate=day, currency='CNY', sourceDefinitionId=did,
             releaseAvailableAt=publication, qualityStatus='VERIFIED',
             **{f: None if f in missing else v*factor for f,v in values.items()})
    for field, line in lines.items():
        payload['fieldExtractions'].append(dict(extractionId=oid+'-'+field, observationId=None, exchangeObservationId=oid,
            field=field, releaseEventId=event['releaseEventId'], rawArtifactId=a['artifactId'], sourceDefinitionId=did,
            parserVersion='synthetic-d2-v1', rawFieldName=field, rawUnit=raw_unit, rawValue=values[field], rawValueText=str(values[field]),
            locator=loc(a,line), period=day, periodSemantics='DAY',
            unitConversion=dict(rule='IDENTITY' if unit==raw_unit and factor==1 else 'SCALE', factor=factor, outputUnit=unit),
            basisEvidence=loc(a,line), reportedComparableBasis=True, predecessorExtractionIds=[]))
    pagination = dict(startPage=1, endPage=1, stopCondition='Last linked page', requestLimit=10, timeoutSeconds=5,
                      enumerationRule='OFFICIAL_LINKS_ONLY', pageTargets=[dict(pageNumber=1,url=archive['sourceUrl'],pageMarker='Page 1')],
                      revisionPageTargets=[dict(pageNumber=1,url=archive['sourceUrl'],pageMarker='Page 1')],
                      stopRule=dict(pageNumber=1,kind='LAST_PAGE_MARKER',markerText='END INDEX'),
                      revisionStopRule=dict(pageNumber=1,kind='LAST_PAGE_MARKER',markerText='END REVISION SCAN'),
                      candidateUrlPattern=r'/report\.html$')
    plan = dict(schemaVersion='1.1.0', planName='SYNTHETIC-ADMITTED-'+exchange, planVersion='1.0.0', planId='',
                purpose='HISTORICAL', datasetAsOf=AS_OF, timezone='Asia/Shanghai', decisionClock='MONDAY_0800',
                sources=[dict(sourceId=source,officialRoots=[host+'/'],indexUrls=[archive['sourceUrl']],pagination=pagination,
                              firstReleaseRule='Require retained initial release proof')],
                targetWindows=[dict(windowId=exchange+'-'+f,sourceId=source,metricId='EXCHANGE_MARKET_STATS',field=f,
                                    frequency='TRADING_DAY',start=day,end=day,scopeVersion=scope,nativeFrequencyEra='DAILY',
                                    sourceDefinitionIds=[did],calendar=dict(calendarVersion=exchange+'-calendar',dates=[day],
                                                                          evidence=[loc(calendar,day)])) for f in FIELDS])
    plan['planId'] = plan_identity(plan)
    payload['planId'] = plan['planId']
    for cell in target_grid(plan):
        payload['coverageLedger'].append(dict(**cell,status='FIELD_MISSING' if cell['field'] in missing else 'AVAILABLE',
            reasonCode='SYNTHETIC_PROTOCOL',evidenceArtifactIds=[],statusEvidence=[],candidateReleaseEventIds=[event['releaseEventId']],
            admittedObservationIds=[] if cell['field'] in missing else [oid]))
    catalog = build_catalog(dict(sourceDefinitions=[definition],artifacts=artifacts,observations=[],
                                 exchangeMarketObservations=[o],marketScopeVersions=[],providerSlots=[],generatedAt=GENERATED))
    dataset = build_dataset(payload,catalog,plans=[plan],artifact_root=root,generated_at=GENERATED)
    bundle = dict(exchange=exchange,catalog=catalog,dataset=dataset,plans=[plan])
    approvals = [dict(exchange=exchange,field=f,sourceId=source,sourceDefinitionId=did,
                      datasetContentSha256=dataset['manifest']['datasetContentSha256'],planId=plan['planId'],
                      scopeVersion=scope,securityScope=security_scope,unit=unit) for f in FIELDS]
    return bundle, approvals
