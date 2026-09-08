"""PBC-only adapter to the frozen R2-A envelope. No network or R1 mutation.

Discovery inputs retain complete acquired responses. Source-specific decisions
are explicit here; the shared validator remains the final publication boundary.
"""
from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
import re
import io
import zipfile
from pathlib import Path

from .catalog import build_catalog, COLLECTIONS
from .collectors import extract_html
from .hashing import canonical_sha256
from .historical import SIDECARS, artifact_identity, evidence_artifact_identity, release_identity, target_grid, build_dataset, canonical_order
from .historical_validator import safe_file
from .time_semantics import parse_aware_datetime

M2 = 'PBOC_M2_OFFICIAL_RELEASE'
AFRE = 'PBOC_AFRE_STOCK_OFFICIAL_RELEASE'

# Audited original scope-change releases, not arbitrary later historical tables.
# Each method has independent period-applicable definitions in the PBC plan.
AFRE_BACKCAST_RELEASES = {
    'AFRE_2018_07_BACKCAST': ('2018-07', '2018-08-13T19:25:12+08:00', '2017-01', '2018-06'),
    'AFRE_2018_09_BACKCAST': ('2018-09', '2018-10-17T16:00:01+08:00', '2017-01', '2018-08'),
    'AFRE_2019_09_BACKCAST': ('2019-09', '2019-10-15T16:30:02+08:00', '2017-01', '2019-08'),
}


def locator(aid, body, text):
    raw = text.encode('utf-8')
    return dict(artifactId=aid, byteOffset=body.index(raw), byteLength=len(raw), text=text)


def parser_locator(aid, item):
    if 'startByte' in item:
        return dict(artifactId=aid, byteOffset=item['startByte'],
                    byteLength=item['endByte'] - item['startByte'], text=item['text'])
    return {**item, 'artifactId': aid}


def container_evidence(body, content_type):
    """Identify an acquired container, without claiming a field/schema parse.

    ASCII signatures (including the actual UTF-16LE OLE stream name) are valid
    UTF-8 byte locators. They establish container identity only, never numbers.
    """
    if body.startswith(b'%PDF-') and 'pdf' in content_type.lower():
        return '%PDF-'
    html = re.search(rb'<html\b[^>]*>',body,re.I)
    if html and 'html' in content_type.lower():
        return html.group().decode('ascii')
    if body.startswith(b'PK\x03\x04'):
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            if 'xl/workbook.xml' not in archive.namelist() or archive.testzip() is not None:
                raise ValueError('invalid XLSX inventory container')
        return 'PK\x03\x04'
    if body.startswith(bytes.fromhex('d0cf11e0a1b11ae1')) and len(body)>=512:
        for name in ('Workbook','Book'):
            marker=name.encode('utf-16le')
            if marker in body:
                return marker.decode('utf-8')
    raise ValueError('unsupported inventory container; retain acquisition journal')


def initial_release_proof(parsed, row, links):
    """An original dated statistical bulletin AND its dated archive entry.

    This does not use crawl ordering, revisionSequence, URL dates or mtime.
    A current historical table/repost, or a report with no dated archive link,
    remains UNRESOLVED. The archive cannot prove revision-scan exhaustiveness.
    """
    if row['temporalRole'] != 'CURRENT':
        return []
    title = parsed['title']
    if re.search(r'修订|更正|调整后|历史数据|转载|回溯|答记者问|解读|负责人', title):
        return []
    if not re.search(r'金融统计数据报告|金融运行|金融宏观调控|金融统计数据情况|社会融资规模存量统计数据报告|货币供应|广义货币|货币信贷|贷款增速|人民币贷款.*增加|人民币汇率.*稳定|居民储蓄存款.*增加|从紧货币政策成效(?:初显|显现)', title):
        return []
    publication = parsed['publicationDate']
    # A contemporaneous report is necessary, never sufficient on its own.
    year, month = map(int, row['valueDate'].split('-'))
    next_month = f'{year + (month == 12):04d}-{1 if month == 12 else month + 1:02d}'
    if not publication or publication[:7] != next_month:
        return []
    result = []
    for link in links:
        text = link['locator']['text']
        visible = re.sub(r'\s+','',extract_html(text)[0])
        if publication in text and re.sub(r'\s+','',title) in visible:
            result.append(link['locator'])
    return result


def resolve_definition(definitions, row, parsed=None):
    """Select a frozen era, including separately scoped later backcast methods."""
    metric, period = row['metricId'], row['valueDate']
    if metric.startswith('MACRO_M2'):
        family = 'balance' if metric.endswith('BALANCE') else 'yoy'
        era = ('pre-2011-v1' if period < '2011-10' else '2011-v2' if period < '2018-01' else '2018-v3' if period<'2022-12' else '2022-12-v4')
        if row['temporalRole'] == 'BACKCAST':
            if period == '2017-12' and row['method'] == 'M2_2018':
                era = '2018-backcast-2017-12-v1'
            else:
                return None
        identity = f'pbc-m2-{family}-{era}'
    else:
        family = 'balance' if metric.endswith('BALANCE') else 'yoy'
        era = ('2015-v1' if period < '2018-07' else '2018-07-v2' if period < '2018-09'
               else '2018-09-v3' if period < '2019-09' else '2019-09-v4' if period < '2019-12' else '2019-12-v5' if period<'2023-01' else '2023-01-v6')
        identity = f'pbc-afre-stock-{family}-{era}'
        # Only the audited event, literal scope evidence and applicable period
        # may use a separate backcast method. Never reuse the valueDate's era.
        if row['temporalRole'] == 'BACKCAST' and period >= '2015-01':
            scope = AFRE_BACKCAST_RELEASES.get(row['method'])
            if not scope or not parsed or not row.get('scopeEvidence'):
                return None
            report_period, clock, start, end = scope
            identity = f'pbc-afre-stock-{family}-{report_period}-backcast-v1'
            definition = next((d for d in definitions if d['sourceDefinitionId']==identity), None)
            if (not definition or parsed['valueDate']!=report_period or parsed['releaseAvailableAt']!=clock
                    or parsed['sourceUrl']!=definition['sourceUrlPattern'] or not start <= period <= end
                    or definition['effectiveFrom'][:7]!=start or definition['effectiveTo'][:7]!=end):
                return None
            return definition
    return next((d for d in definitions if d['sourceDefinitionId'] == identity), None)


def assemble(plan, definitions, records, attempts, *, root: Path, generated_at: str):
    """records: acquisition + contentType + role + optional parsed/indexLinks.

    Each indexLink supplies its retained index acquisition ID and exact one-link
    HTML entry. records with parser errors still produce independent evidence.
    """
    from .pbc_parser import parse_pbc_release, PARSER_VERSION
    seed = {k: [] for k in COLLECTIONS}
    seed.update(catalogVersion='pbc-historical-vintage-v1', sourceDefinitions=deepcopy(definitions))
    payload = {k: [] for k in SIDECARS}
    snapshot = canonical_sha256(canonical_order(dict(planId=plan['planId'], definitions=definitions,
        parserVersion=PARSER_VERSION,records=records,retrievalAttempts=attempts)))
    payload.update(planId=plan['planId'], datasetVersion='pbc-historical-v1-'+snapshot)
    payload['retrievalAttempts'] = deepcopy(attempts)
    evidence = {}
    record_bytes = {}
    diagnostics = []
    drafts = []
    grid = target_grid(plan)
    cells_by_period = defaultdict(list)
    for cell in grid:
        cells_by_period[(cell['sourceId'], cell['period'])].append(cell)
    # Every successful response has retained independent evidence, even if its
    # release clock/format cannot be parsed. This also anchors cache acquisitions.
    for record in records:
        r = record['acquisition']
        body = safe_file(root, r['storedBytes']['localPath']).read_bytes()
        record_bytes[r['attemptId']] = body
        try:
            html = body.decode('utf-8')
        except UnicodeDecodeError:
            html = container_evidence(body,record['contentType'])
        title = re.search(r'<title\b[^>]*>.*?</title>', html, re.S | re.I)
        proof = title.group() if title else html[:min(len(html), 200)]
        if not proof:
            raise ValueError('empty acquired response')
        a = dict(sourceId=r['sourceId'], sourceUrl=r['finalUrl'], fetchedAt=r['attemptedAt'],
                 contentType=record['contentType'], fileName=Path(r['storedBytes']['localPath']).name,
                 **r['storedBytes'], httpStatus=r['httpStatus'], artifactRole='RAW_SOURCE',
                 parseStatus='INDEXED' if record['role']=='INDEX' else 'FIELD_SCHEMA_PROBE_REQUIRED', error=None,
                 evidenceRole='ARCHIVE_INDEX' if record['role'] == 'INDEX' else 'INVENTORY')
        a['artifactId'] = evidence_artifact_identity(a)
        evidence[r['attemptId']] = a
        payload['evidenceArtifacts'].append(a)
        payload['artifactBindings'].append(dict(artifactId=a['artifactId'], releaseEventId=None,
            completeResponse=True, contentValidation='VALIDATED', contentEvidence=locator(a['artifactId'], body, proof)))
    for record in records:
        r = record['acquisition']
        if record['role'] != 'RELEASE' or r['attemptId'] not in evidence:
            continue
        body = record_bytes[r['attemptId']]
        try:
            html = body.decode('utf-8')
        except UnicodeDecodeError:
            diagnostics.append(dict(url=r['finalUrl'], sourceId=r['sourceId'], reason='UNSUPPORTED_FORMAT_NO_FIELD_OR_RELEASE_LOCATOR'))
            continue
        try:
            parsed = parse_pbc_release(html, r['finalUrl'], source_id=r['sourceId'])
        except ValueError as exc:
            diagnostics.append(dict(url=r['finalUrl'], sourceId=r['sourceId'], reason=str(exc)))
            continue
        diagnostics.extend(dict(url=r['finalUrl'], sourceId=r['sourceId'], period=parsed.get('valueDate'),reason=b) for b in parsed.get('blockers', []))
        links = []
        for link in record.get('indexLinks', []):
            a = evidence.get(link['attemptId'])
            if a and a['evidenceRole'] == 'ARCHIVE_INDEX':
                loc = locator(a['artifactId'], record_bytes[link['attemptId']], link['text'])
                links.append(dict(artifactId=a['artifactId'], url=r['finalUrl'], locator=loc))
        grouped = defaultdict(list)
        for row in parsed['rows']:
            if (r['sourceId'], row['valueDate']) in cells_by_period:
                grouped[(row['valueDate'], row['temporalRole'])].append(row)
        if (r['sourceId'],parsed.get('valueDate')) in cells_by_period and not any(period==parsed['valueDate'] for period,_ in grouped):
            grouped.setdefault((parsed['valueDate'],'CURRENT'),[])
        for (period, role), rows in grouped.items():
            first = initial_release_proof(parsed, rows[0], links) if rows else []
            kind = 'BACKCAST' if role == 'BACKCAST' else 'FIRST_RELEASE' if first else 'UNRESOLVED'
            e = dict(sourceId=r['sourceId'], landingUrl=r['finalUrl'], eventSection=role + ':' + period,
                publicationDateTime=parsed['publicationDateTime'], publicationDate=parsed['publicationDate'],
                releaseAvailableAt=parsed['releaseAvailableAt'],
                releaseConfidenceClass='BACKCAST_RELEASED_LATER' if kind == 'BACKCAST' else parsed['releaseConfidenceClass'],
                releaseKind=kind, coveredPeriods=[period], attachmentArtifactIds=[], attachmentEvidence=[],
                firstReleaseEvidenceArtifactIds=sorted({l['artifactId'] for l in first}),
                firstReleaseEvidence=first,
                revisionEvidence=[], indexEvidence=links)
            eid = release_identity(e)
            a = {k: v for k, v in evidence[r['attemptId']].items() if k != 'evidenceRole'}
            a.update({k: e[k] for k in ('publicationDateTime','publicationDate','releaseAvailableAt','releaseConfidenceClass')})
            a['artifactId'] = artifact_identity(a, eid)
            a['parseStatus'] = 'PARSED'
            aid = a['artifactId']
            e.update(releaseEventId=eid, landingArtifactId=aid,
                     publicationEvidence=parser_locator(aid, parsed['publicationEvidenceLocator']))
            if kind == 'BACKCAST':
                e['revisionEvidence'] = list({canonical_sha256(row['scopeEvidence']):
                    parser_locator(aid,row['scopeEvidence']) for row in rows if row.get('scopeEvidence')}.values())
            # Date-only evidence can be stored before its safe boundary, but cannot
            # be made into an R1 artifact by altering acquisition time.
            if parse_aware_datetime(a['fetchedAt']) < parse_aware_datetime(e['releaseAvailableAt']):
                diagnostics.append(dict(url=r['finalUrl'], sourceId=r['sourceId'], period=period, reason='SAFE_AVAILABILITY_NOT_REACHED'))
                continue
            if any(old['releaseEventId']==eid for old in payload['releaseEvents']):
                old = next(old for old in seed['artifacts'] if old['artifactId']==next(e['landingArtifactId'] for e in payload['releaseEvents'] if e['releaseEventId']==eid))
                if old['sha256'] != a['sha256']:
                    raise ValueError('same release identity has changed bytes; reconcile the retained acquisitions before sealing')
                continue
            seed['artifacts'].append(a)
            payload['releaseEvents'].append(e)
            content = payload['artifactBindings'][next(i for i,b in enumerate(payload['artifactBindings']) if b['artifactId'] == evidence[r['attemptId']]['artifactId'])]['contentEvidence']['text']
            payload['artifactBindings'].append(dict(artifactId=aid, releaseEventId=eid, completeResponse=True,
                contentValidation='VALIDATED', contentEvidence=locator(aid, body, content)))
            for row in rows:
                d = resolve_definition(definitions, row, parsed)
                if not d:
                    diagnostics.append(dict(url=r['finalUrl'], sourceId=r['sourceId'], period=period,
                                            metricId=row['metricId'], reason='DEFINITION_UNRESOLVED'))
                    continue
                raw_unit = row.get('rawUnit', row['originalUnit'])
                raw_value = row['originalValue']
                unit_factor = 1 if raw_unit == d['unit'] else 0.0001 if raw_unit == '亿元' and d['unit'] == '万亿元' else 1 if raw_unit == '％' and d['unit'] == '%' else None
                factor = row.get('conversionMultiplier',unit_factor)
                if unit_factor is None or factor not in (unit_factor,-unit_factor):
                    diagnostics.append(dict(url=r['finalUrl'], sourceId=r['sourceId'], period=period, reason='UNIT_UNRESOLVED'))
                    continue
                # R2-A freezes SCALE to a positive unit multiplier. A prose
                # decrease with an unsigned numeric token cannot be represented
                # as a negative admitted value in that contract.
                signed_language_unrepresentable = factor < 0
                if signed_language_unrepresentable:
                    diagnostics.append(dict(url=r['finalUrl'],sourceId=r['sourceId'],period=period,
                        metricId=row['metricId'],reason='SIGNED_LANGUAGE_CONVERSION_UNSUPPORTED'))
                    factor = unit_factor
                x = dict(extractionId='extract-' + canonical_sha256([eid,row['metricId'],d['sourceDefinitionId']]),
                    observationId=None, exchangeObservationId=None, field='value', releaseEventId=eid,
                    rawArtifactId=aid, sourceDefinitionId=d['sourceDefinitionId'], parserVersion=PARSER_VERSION,
                    rawFieldName=row['rawFieldName'], rawUnit=raw_unit, rawValue=raw_value,
                    rawValueText=row['rawValueText'], locator=parser_locator(aid,row['locator']), period=period,
                    periodSemantics=row['periodSemantics'],
                    unitConversion=dict(rule='IDENTITY' if raw_unit == d['unit'] and factor==1 else 'SCALE',factor=factor,outputUnit=d['unit']),
                    basisEvidence=parser_locator(aid,row.get('comparabilityEvidence') or row['locator']),
                    reportedComparableBasis=row['reportedComparableBasis'], predecessorExtractionIds=[])
                drafts.append(dict(event=e,artifact=a,row=row,extraction=x,definition=d,parsed=parsed,
                                   representable=not signed_language_unrepresentable))
    # Equal official mirrors are evidence-only duplicates; divergent unproven
    # releases retain all values as extractions and exclude the affected cell.
    groups = defaultdict(list)
    for item in drafts:
        x, e = item['extraction'], item['event']
        groups[(e['sourceId'], item['row']['metricId'], x['period'])].append(item)
    for key, items in sorted(groups.items()):
        items.sort(key=lambda i:(i['event']['releaseAvailableAt'], i['event']['releaseKind']!='FIRST_RELEASE', i['event']['releaseEventId']))
        # Within one proved release instant, prefer a dated original over an
        # unproven mirror. Repeated statements of the same fact stay evidence.
        representatives = []
        seen_facts = set()
        for i in items:
            fact = (i['extraction']['rawValue']*i['extraction']['unitConversion']['factor'],i['definition']['sourceDefinitionId'])
            if fact not in seen_facts:
                representatives.append(i)
                seen_facts.add(fact)
        distinct = {(i['extraction']['rawValue'] * i['extraction']['unitConversion']['factor'], i['definition']['sourceDefinitionId']) for i in items}
        authorized_backcast = (len(distinct)>1 and len(representatives)==2 and
            representatives[1]['event']['releaseKind']=='BACKCAST' and
            representatives[1]['row']['definitionEra']=='M2_2018_BACKCAST' and
            representatives[0]['event']['releaseAvailableAt'] < representatives[1]['event']['releaseAvailableAt'])
        afre_chain = (key[0]==AFRE and (
            representatives[0]['event']['releaseKind']=='FIRST_RELEASE' or
            (representatives[0]['event']['releaseKind']=='BACKCAST' and
             representatives[0]['row']['method'] in AFRE_BACKCAST_RELEASES)) and all(
            i['event']['releaseKind']=='BACKCAST' and i['row']['method'] in AFRE_BACKCAST_RELEASES
            for i in representatives[1:]) and all(
            a['event']['releaseAvailableAt'] < b['event']['releaseAvailableAt']
            and a['definition']['sourceDefinitionId'] != b['definition']['sourceDefinitionId']
            for a,b in zip(representatives,representatives[1:])))
        conflict = len(distinct) > 1 and not (authorized_backcast or afre_chain)
        if conflict:
            affected = [c['cellId'] for c in grid if (c['sourceId'],c['metricId'],c['period']) == key]
            payload['conflicts'].append(dict(conflictId='conflict-'+canonical_sha256(key), cellIds=affected,
                candidateReleaseEventIds=sorted({i['event']['releaseEventId'] for i in items}), status='UNRESOLVED',
                evidence=[i['extraction']['locator'] for i in items], resolutionReleaseEventId=None,
                reasonCode='UNRESOLVED_RELEASE_CONFLICT', handlingBasis='No proved authoritative replacement; retain every candidate, exclude strict values'))
        previous = None
        sequence = 0
        baseline_proved = any(i['event']['releaseKind']=='FIRST_RELEASE' and i['representable']
            and (key[1]!='MACRO_AFRE_STOCK_YOY' or i['row']['reportedComparableBasis']) for i in representatives)
        for n, item in enumerate(items):
            e,a,x,d,row = (item[k] for k in ('event','artifact','extraction','definition','row'))
            # Mere same-value republication does not create a fake revision chain.
            basis_ok = row['metricId']!='MACRO_AFRE_STOCK_YOY' or row['reportedComparableBasis']
            keep = not conflict and item in representatives and basis_ok and item['representable']
            if (key[0]==AFRE and key[2]>='2015-01' and e['releaseKind']=='BACKCAST'
                    and not baseline_proved):
                keep = False
                diagnostics.append(dict(url=e['landingUrl'],sourceId=AFRE,period=key[2],metricId=key[1],
                    reason='AFRE_BACKCAST_FIRST_RELEASE_LINEAGE_GAP'))
            if keep:
                oid = 'obs-pbc-' + canonical_sha256([e['releaseEventId'], row['metricId'], d['sourceDefinitionId']])
                x['observationId'] = oid
                if previous:
                    x['predecessorExtractionIds'] = [previous['extractionId']]
                seed['observations'].append(dict(observationId=oid, metricId=row['metricId'], valueDate=x['period'],
                    releaseDateTime=e['publicationDateTime'], releaseAvailableAt=e['releaseAvailableAt'], fetchedAt=a['fetchedAt'],
                    value=x['rawValue'] * x['unitConversion']['factor'], unit=d['unit'], sourceId=e['sourceId'],
                    sourceDefinitionId=d['sourceDefinitionId'], revisionSequence=sequence,
                    supersedesObservationId=previous['observationId'] if previous else None,
                    releaseConfidenceClass=e['releaseConfidenceClass'], qualityStatus=row['qualityStatus'],
                    rawArtifactId=a['artifactId'], transformVersion=PARSER_VERSION,
                    metadata=dict(publicationDate=e['publicationDate'], title=item['parsed']['title'],
                        reportedComparableBasis=x['reportedComparableBasis'], definitionNotes=item['parsed']['definitionNotes'],
                        releaseKind=e['releaseKind'], nativeFrequency=d['nativeFrequency'])))
                previous = x
                sequence += 1
            payload['fieldExtractions'].append(x)
    events = {e['releaseEventId']: e for e in payload['releaseEvents']}
    obs = {o['observationId']: o for o in seed['observations']}
    conflict_cells = {cid for c in payload['conflicts'] for cid in c['cellIds']}
    for c in grid:
        candidates = [e for e in events.values() if e['sourceId']==c['sourceId'] and c['period'] in e['coveredPeriods']]
        matches = [x for x in payload['fieldExtractions'] if x['period']==c['period'] and x['sourceDefinitionId'] in c['sourceDefinitionIds']]
        admitted = [x['observationId'] for x in matches if x['observationId'] in obs and
                    events[x['releaseEventId']]['releaseKind'] != 'UNRESOLVED' and
                    parse_aware_datetime(events[x['releaseEventId']]['releaseAvailableAt']) <= parse_aware_datetime(plan['datasetAsOf'])]
        status, reason = ('AVAILABLE','RAW_OFFICIAL_VINTAGE') if admitted else ('FIRST_RELEASE_UNPROVEN','DATED_INITIAL_RELEASE_PROOF_MISSING') if matches else ('MISSING','RELEASE_NOT_LOCATED')
        if candidates and not matches:
            status, reason = 'FIELD_MISSING', 'FIELD_OR_DEFINITION_UNRESOLVED'
        if matches and c['metricId']=='MACRO_AFRE_STOCK_YOY' and not any(x['reportedComparableBasis'] for x in matches):
            status, reason = 'DEFINITION_UNRESOLVED','COMPARABLE_STOCK_YOY_BASIS_UNPROVEN'
        initial_matches = [x for x in matches if events[x['releaseEventId']]['releaseKind']=='FIRST_RELEASE']
        if (not admitted and c['metricId']=='MACRO_AFRE_STOCK_YOY' and initial_matches
                and not any(x['reportedComparableBasis'] for x in initial_matches)):
            status, reason = 'DEFINITION_UNRESOLVED','COMPARABLE_STOCK_YOY_BASIS_UNPROVEN'
        issues = [d for d in diagnostics if d['sourceId']==c['sourceId'] and d.get('period')==c['period'] and d.get('metricId')==c['metricId']]
        if not admitted and any(d['reason']=='DEFINITION_UNRESOLVED' for d in issues):
            status,reason='DEFINITION_UNRESOLVED','BACKCAST_DEFINITION_NOT_PROVED'
        elif not admitted and any(d['reason']=='SIGNED_LANGUAGE_CONVERSION_UNSUPPORTED' for d in issues):
            status,reason='FIELD_MISSING','SIGNED_LANGUAGE_CONVERSION_UNSUPPORTED'
        if c['cellId'] in conflict_cells:
            status, reason, admitted = 'UNRESOLVED_RELEASE_CONFLICT', 'UNRESOLVED_RELEASE_CONFLICT', []
        future = candidates and all(parse_aware_datetime(e['releaseAvailableAt']) > parse_aware_datetime(plan['datasetAsOf']) for e in candidates)
        status_evidence = [e['publicationEvidence'] for e in candidates] if future else []
        if future and c['cellId'] not in conflict_cells:
            status, reason = 'NOT_YET_RELEASED', 'OFFICIAL_RELEASE_AFTER_AS_OF'
        payload['coverageLedger'].append(dict(**c,status=status,reasonCode=reason,
            evidenceArtifactIds=sorted({e['landingArtifactId'] for e in candidates}), statusEvidence=status_evidence,
            candidateReleaseEventIds=sorted(e['releaseEventId'] for e in candidates), admittedObservationIds=sorted(admitted)))
    for w in plan['targetWindows']:
        locs = [b['contentEvidence'] for b in payload['artifactBindings'] if b['releaseEventId'] is None and
                any(a['artifactId']==b['artifactId'] and a['sourceId']==w['sourceId'] and a['evidenceRole']=='ARCHIVE_INDEX' for a in payload['evidenceArtifacts'])]
        # The site's mixed-era JavaScript index is retained as independent raw
        # evidence. It cannot satisfy R2-A's per-window href/terminal-page proof.
        payload['inventoryEvidence'].append(dict(windowId=w['windowId'],scannedIndexUrls=[],paginationComplete=False,
            candidatesReconciled=False,revisionScanComplete=False,evidence=locs,pages=[],stopEvidence=None,
            revisionPages=[],revisionStopEvidence=None))
    catalog = build_catalog(seed, generated_at=generated_at)
    dataset = build_dataset(payload,catalog,plans=[plan],artifact_root=root,generated_at=generated_at)
    return dict(catalog=catalog,dataset=payload), dataset, diagnostics
