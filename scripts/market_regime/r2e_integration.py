"""Versioned R2-E investigation reports. No new historical admission authority.

Inputs are independently pinned reviewed snapshots, not caller-supplied admitted
flags. D2 and its historical allowlist remain untouched. Reports never constitute
an R2 historical dataset or manufacture release events from retrieval metadata.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from pathlib import Path

from . import all_a_admission as d2
from .hashing import canonical_sha256
from .historical_validator import require
from .r2e_calendar import write_new
from .sse_source import strict_json

ROOT = d2.ROOT
BASE = '1179c0992881e01ab71bc409641e46acf129a408'
FOLDER = Path('research-data/market-regime/source-catalog/r2-e')
OUTPUT = FOLDER / 'integration'
BSE_RULE_CORRECTION = FOLDER / 'bse/supplement-v3/evidence.v3.json'
BSE_RULE_CORRECTION_PIN = '18938ada45e9aaa5f56b73cb3beb6cbf1ac3a9a852ed9c24ff90fa8dbd98f6ad'
INPUT_PATHS = {
    'calendar': 'calendar/foundation.v1.json',
    'sse': 'sse/evidence.v1.json',
    'sseCandidates': 'sse/candidates.v1.json',
    'szse': 'szse/workstream-report.v1.json',
    'szseCandidates': 'szse/yearbook-candidates.v1.json',
    'szseArchive': 'szse/archive-index.v1.json',
    'szseExtractions': 'szse/extractions.v1.json',
    'szseAcquisition': 'szse/acquisition.v1.json',
    'szseAcquisitionFollowup': 'szse/acquisition-followup.v1.json',
    'bse': 'bse/evidence.v1.json',
    'bseCalendar': 'bse/supplement-v2/evidence.v2.json',
    'bsePdf': 'bse/pdf-audit.v1.json',
}
# Filled once after independent workstream replay; a successor needs new pins.
INPUT_PINS = {
    'calendar': '39809ade673fb6faa301a0f5ae7f74f05dc2796e013f7b4f216942c1017dcac1',
    'sse': '4deeb0a2da204ef24490dfd65b9a86a10be6c3f54145c8475fe225fcb3a4c15a',
    'sseCandidates': '4fe277345cfee112bf0abc62e3054a120112e7cc2540bf60db5be929c13672f6',
    'szse': 'bf86e9c1f2a4e7546decfee2d93abce72b3ef852637889e275a02a450e0013b2',
    'szseCandidates': '64ecc0ad6d4e8dfbd0a64c95c762b7830b201670fba284bb15a7239d2e151125',
    'szseArchive': '4c1abd1be6e4585866e799d324ca2aa076f893ff6f38f72c9563a5089e5691aa',
    'szseExtractions': '547c6ded0bbcf74f0765ae65c2c6e2c57c005fc8f867bf387f9616a2f6ff9f9b',
    'szseAcquisition': 'd86c6e6f30a374af89ed57ad65a9b9eda54ee16ee27e4fb4c233691aa65fac6d',
    'szseAcquisitionFollowup': '5cc5bd1ce224dcd1e6ab58a489d6a87491290c3814d5cbb9b057ca3f8b7033b3',
    'bse': 'b8f17dca2a6484b331380de497c80c507b30da702bfb31c62ac7fa1e7523c65a',
    'bseCalendar': 'f00039ca7ade2483ca25955aff46a20d3699a7f37a9f6b7c2934fdeecad4912c',
    'bsePdf': '966e176c4c9fd0a2013beca368b27bb9db5096e8b366ace6e3fca72981f77776',
}


def inputs(*, root=ROOT):
    require(set(INPUT_PINS) == set(INPUT_PATHS), 'INTEGRATION_INPUTS_NOT_FROZEN')
    out = {}
    for name, relative in INPUT_PATHS.items():
        obj = strict_json((root / FOLDER / relative).read_bytes())
        require(canonical_sha256(obj) == INPUT_PINS[name], 'REVIEWED_INPUT_IDENTITY_MISMATCH:' + name)
        out[name] = obj
    return out


def references(names):
    return [dict(name=n, path=(FOLDER / INPUT_PATHS[n]).as_posix(), contentSha256=INPUT_PINS[n]) for n in names]


def report(kind, **values):
    return d2.seal(dict(schemaVersion='1.0.0', reportVersion='r2-e-integrated-v1',
                       kind=kind, baseline=BASE, datasetAsOf=d2.AS_OF,
                       inputReferences=references(INPUT_PATHS), **values))


def release_report(*, root=ROOT):
    evidence = inputs(root=root)
    descriptions = {
        'SSE': ('Trade-date payloads and a monthly publication schedule have been replayed; neither supplies actual daily market release time or historical bytes binding.', ['sse', 'sseCandidates']),
        'SZSE': ('Official yearbook index, publication descriptions and historical tables establish source discovery; no actual dated daily release-to-bytes or first-release lineage is proven.', ['szse', 'szseArchive', 'szseCandidates']),
        'BSE': ('Annual index publication text is timezone-naive and not bound to historical daily release bytes. Trading-rule publication and holiday announcements cannot supply a market release clock.', ['bse', 'bsePdf']),
    }
    rows = []
    for exchange, (reason, refs) in descriptions.items():
        rows.append(dict(exchange=exchange, status='NOT_ADMITTED', observationDateMeaning='STATISTICAL_DATE_ONLY',
                         publicationDate=None, publicationDateTime=None, releaseAvailableAt=None,
                         dateOnlySafeStatus='NOT_APPLICABLE_NO_PROVEN_MARKET_PUBLICATION_DATE',
                         provenFirstReleaseCount=0, revisionCoverage='UNPROVEN', marketReleaseCount=0,
                         formalCount=0, strictPitCount=0, reason=reason, evidenceReferences=references(refs),
                         unadmittedWindow=dict(start='2021-11-15' if exchange == 'BSE' else '2005-01-01', end=d2.END),
                         blockers=['MARKET_RELEASE_MISSING', 'HISTORICAL_RELEASE_BYTES_BINDING_UNPROVEN',
                                   'FIRST_RELEASE_UNPROVEN', 'REVISION_ARCHIVE_UNPROVEN']))
    require(evidence['sse']['formalObservations'] == []
            and evidence['bse']['releaseEvents'] == evidence['bse']['formalObservations'] == evidence['bse']['strictPitObservations'] == []
            and all(evidence[key]['counts']['formalCount'] == evidence[key]['counts']['strictPitCount'] == 0
                    for key in ('sse', 'szse', 'bse')), 'UNEXPECTED_FORMAL_INPUT')
    return report('R2_E_RELEASE_PIT_REVIEW', rows=rows, releaseEvents=[], formalObservations=[],
                  strictPitObservations=[], status='NOT_ADMITTED', validationMode='PINNED_INPUT_OBJECT_REPLAY_RAW_REPLAY_SEPARATE',
                  ruleReference='docs/market-regime/observation-catalog-r2-scope-freeze-v1.md#31-pitrevision缺失与不可变性')


def definition_report(*, root=ROOT):
    evidence = inputs(root=root)
    releases = {r['exchange']: r for r in release_report(root=root)['rows']}
    rows = []
    for exchange in ('SSE', 'SZSE', 'BSE'):
        data = evidence[exchange.lower()]
        for field in d2.FIELDS:
            contract = strict_json((root / 'config/market-regime' / (exchange.lower() + '-source-contract.v1.json')).read_bytes())
            anchor = next(r for r in evidence['calendar']['inputs'] if r['exchange'] == exchange)
            require(canonical_sha256(contract) == anchor['contentSha256'], 'FROZEN_SOURCE_CONTRACT_CHANGED')
            blockers = ['DAILY_API_FIELD_DEFINITION_ERA_APPLICABILITY_UNPROVEN']
            if field == 'negotiableMarketCap':
                blockers.append('NEGOTIABLE_NOT_PROVEN_FREE_FLOAT' if exchange == 'BSE' else 'NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN')
            if exchange == 'SSE':
                source_row = next(r for r in data['fieldAdmission'] if r['field'] == field)
                eras = source_row['eras']
                definition = dict(meaning=data['definitions']['fieldMeanings'][field],
                                  publications=data['definitions']['publicationEvidence'])
                blockers.append('DAILY_API_SCOPE_CURRENCY_AND_CLOSE_BASIS_UNPROVEN')
            elif exchange == 'SZSE':
                source_row = next(r for r in data['fieldMatrix'] if r['field'] == field)
                eras = [dict(**w, applicability='NOT_PROVEN_REVIEW_PARTITION_ONLY') for w in source_row['unadmittedWindows']]
                definition = dict(evidenceIds=source_row['definitionEvidenceIds'],
                                  meaning='Publication definitions are evidence for their own reports; the 2022 daily table is a separate ChiNext candidate family, not all SZSE A shares.')
                blockers.append('A_MEMBERSHIP_FOR_BOARD_ONLY_LABEL_UNPROVEN')
            else:
                eras = data['eraEvidence']
                definition = dict(ruleEvidence=data['ruleEvidence'],
                                  meaning='Trading-rule publication/effectiveness and annual-report terminology do not establish daily API field scope/close basis for every historical era.')
                if field == 'turnoverValue':
                    blockers.append('TRADE_MODE_AND_BLOCK_TRADE_INCLUSION_UNPROVEN')
                blockers.append('DAILY_API_SCOPE_AND_CLOSE_BASIS_UNPROVEN')
            rows.append(dict(exchange=exchange, field=field, status='NOT_ADMITTED',
                definitionStatus='OFFICIAL_EVIDENCE_FOUND_APPLICABILITY_UNPROVEN', eraStatus='NOT_PROVEN', pitStatus='NOT_ADMITTED',
                mappingEvidence=contract['families'], officialDefinitionEvidence=definition,
                eraReviewPartitions=eras, fieldBlockers=sorted(blockers),
                sourceBlockers=sorted(set(releases[exchange]['blockers'] + ['FULL_OFFICIAL_CALENDAR_UNPROVEN',
                    'R2_CALENDAR_LITERAL_ISO_LOCATOR_UNAVAILABLE', 'CONTINUOUS_DAILY_HISTORY_UNPROVEN', 'NO_FORMAL_EXCHANGE_OBSERVATIONS'])),
                evidenceReferences=references([exchange.lower()] + (['szseExtractions'] if exchange == 'SZSE' else ['bsePdf'] if exchange == 'BSE' else [])),
                formalCount=0, strictPitCount=0, admittedWindows=[],
                unadmittedWindows=[dict(start='2021-11-15' if exchange == 'BSE' else '2005-01-01', end=d2.END)]))
    return report('R2_E_FIELD_DEFINITION_ERA_REVIEW', status='NOT_ADMITTED', matrix=rows,
                  formalAdmissionTransitions=[],
                  semantics='Review partitions and publication definitions never create admitted SourceDefinitionVersions. Frozen D1 source contracts remain unchanged.')


def definition_report_v2(*, root=ROOT):
    original = definition_report(root=root)
    correction = strict_json((root / BSE_RULE_CORRECTION).read_bytes())
    require(canonical_sha256(correction) == BSE_RULE_CORRECTION_PIN,
            'BSE_RULE_CORRECTION_IDENTITY_MISMATCH')
    reference = dict(path=BSE_RULE_CORRECTION.as_posix(), contentSha256=BSE_RULE_CORRECTION_PIN)
    result = deepcopy(original)
    result['reportVersion'] = 'r2-e-integrated-definitions-v2'
    result['supersedes'] = dict(path=(OUTPUT / 'definitions.v1.json').as_posix(),
        contentSha256=original['contentSha256'],
        scope='BSE ruleEvidence byte locators only; V1 records and every admission/blocker result preserved.')
    result['inputReferences'].append(reference)
    for row in result['matrix']:
        if row['exchange'] == 'BSE':
            row['officialDefinitionEvidence']['ruleEvidence'] = correction['ruleEvidence']
            row['evidenceReferences'].append(reference)
    return d2.seal(result)


def historical_inputs(*, root=ROOT):
    inventories = {ex: strict_json((root / f'research-data/market-regime/source-catalog/{folder}/inventory.v1.json').read_bytes())
                   for ex, (folder, _, _) in d2.INPUTS.items()}
    baseline = d2.build_report(inventories=inventories)
    require(strict_json((root / 'research-data/market-regime/source-catalog/all-a-d2/admission-report.v1.json').read_bytes()) == baseline,
            'FROZEN_D2_CHANGED')
    return inventories, baseline


def history_report(*, root=ROOT):
    evidence = inputs(root=root)
    old, baseline = historical_inputs(root=root)
    definitions = definition_report(root=root)
    gates = {(r['exchange'], r['field']): r for r in definitions['matrix']}
    rows = []

    def add(exchange, candidate, path, pointer, phase):
        field = candidate['field']
        family = candidate.get('familyId', candidate.get('sourceFamily'))
        scope = candidate.get('scope', candidate.get('rawScope'))
        require(field in d2.FIELDS and family and scope and candidate['rawValueText'] is not None, 'CANDIDATE_IDENTITY_INCOMPLETE')
        row = dict(exchange=exchange, field=field, family=family, scope=scope,
                   tradeDate=candidate['tradeDate'], rawValueText=candidate['rawValueText'], rawUnit=candidate['rawUnit'],
                   evidencePhase=phase, sourcePath=path, jsonPointer=pointer, candidateContentSha256=canonical_sha256(candidate),
                   status='CANDIDATE_ONLY', publicationDate=None, publicationDateTime=None, releaseAvailableAt=None,
                   formalEligible=False, strictPitEligible=False,
                   fieldBlockers=gates[(exchange, field)]['fieldBlockers'], sourceBlockers=gates[(exchange, field)]['sourceBlockers'])
        row['captureCandidateId'] = 'r2e-candidate-' + canonical_sha256(row)
        rows.append(row)

    for exchange, inv in old.items():
        folder = d2.INPUTS[exchange][0]
        for i, candidate in enumerate(inv['candidates']):
            add(exchange, candidate, f'research-data/market-regime/source-catalog/{folder}/inventory.v1.json', f'/candidates/{i}', 'D1')
    for i, request in enumerate(evidence['sseCandidates']['requests']):
        for j, candidate in enumerate(request['parsed']['candidates']):
            add('SSE', candidate, (FOLDER / INPUT_PATHS['sseCandidates']).as_posix(), f'/requests/{i}/parsed/candidates/{j}', 'R2_E')
    for key, exchange in [('szseCandidates', 'SZSE'), ('bse', 'BSE')]:
        for i, candidate in enumerate(evidence[key]['candidates']):
            add(exchange, candidate, (FOLDER / INPUT_PATHS[key]).as_posix(), f'/candidates/{i}', 'R2_E')
    require(len({r['captureCandidateId'] for r in rows}) == len(rows), 'DUPLICATE_CAPTURE_CANDIDATE')

    def series_key(r):
        return (r['exchange'], r['family'], r['scope'], r['tradeDate'], r['field'])

    counts = []
    for exchange in ('SSE', 'SZSE', 'BSE'):
        selected = [r for r in rows if r['exchange'] == exchange]
        counts.append(dict(exchange=exchange, candidateCount=len(selected),
                           newCandidateCount=sum(r['evidencePhase'] == 'R2_E' for r in selected),
                           priorCandidateCount=sum(r['evidencePhase'] == 'D1' for r in selected),
                           uniqueCandidateKeyCount=len({series_key(r) for r in selected}), formalCount=0, strictPitCount=0,
                           fields=[dict(field=f, candidateCount=sum(r['field'] == f for r in selected),
                                        newCandidateCount=sum(r['field'] == f and r['evidencePhase'] == 'R2_E' for r in selected),
                                        uniqueCandidateKeyCount=len({series_key(r) for r in selected if r['field'] == f}),
                                        formalCount=0, strictPitCount=0) for f in d2.FIELDS]))
    repeated = []
    for key in sorted({series_key(r) for r in rows}):
        group = [r for r in rows if series_key(r) == key]
        if len(group) > 1:
            same = len({(r['rawValueText'], r['rawUnit']) for r in group}) == 1
            repeated.append(dict(exchange=key[0], family=key[1], scope=key[2], tradeDate=key[3], field=key[4],
                                 captureCandidateIds=[r['captureCandidateId'] for r in group],
                                 status='CAPTURE_TOKENS_UNCHANGED_NOT_FIRST_RELEASE_PROOF' if same else 'RAW_TOKEN_OR_UNIT_DIFFERENCE_REQUIRES_REVIEW',
                                 truthSelection=None))
    return report('R2_E_CANDIDATE_ELIGIBILITY_LEDGER', status='NOT_ADMITTED',
        candidateCount=len(rows), newCandidateCount=sum(r['evidencePhase'] == 'R2_E' for r in rows),
        priorCandidateCount=sum(r['evidencePhase'] == 'D1' for r in rows),
        uniqueCandidateKeyCount=len({series_key(r) for r in rows}), candidateCountUnit='FIELD_SCOPE_FAMILY_CAPTURE_ROWS',
        countCaveat='Repeated acquisitions retained; unique keys are discovery counts, never selected vintages or trading-day coverage.',
        formalCount=0, strictPitCount=0, candidates=rows, sourceCounts=counts, recaptureComparisons=repeated,
        eligibleObservations=[], formalObservations=[], strictPitObservations=[],
        baselineD2ContentSha256=baseline['contentSha256'],
        historyEvidence=dict(SSE=evidence['sse']['history'], SZSE=evidence['szse']['archive'], BSE=evidence['bse']['archive']),
        notRun=[dict(exchange='SZSE', action='Other 25 index-discovered yearbook PDFs', status='NOT_RUN',
                     reason='Discovered links retained; no claim of full historical archive/revision exhaustion.'),
                dict(exchange='ALL', action='Full target daily release/vintage enumeration', status='BLOCKED',
                     reason='Complete official calendar, source definition eras and release-to-bytes evidence remain unproven.'),
                dict(exchange='SSE/SZSE', action='Clean-clone full large-PDF replay', status='NOT_RUN_WITHOUT_LOCAL_RAW',
                     reason='Eight large complete PDFs retained in ignored local raw; compact input replay does not replace them.')])


def admission_report(*, root=ROOT):
    evidence = inputs(root=root)
    _, previous = historical_inputs(root=root)
    definitions = definition_report_v2(root=root)
    history = history_report(root=root)
    release = release_report(root=root)
    checkpoints = [('release.v1', release), ('definitions.v1', definition_report(root=root)),
                   ('definitions.v2', definitions), ('history.v1', history)]
    for name, expected in checkpoints:
        stored = strict_json((root / OUTPUT / (name + '.json')).read_bytes())
        require(stored == expected, 'CHECKPOINT_ARTIFACT_REPLAY_MISMATCH:' + name)
    require(history['eligibleObservations'] == history['formalObservations'] == history['strictPitObservations'] == [],
            'R2_E_V1_HAS_NO_ELIGIBLE_COMPONENTS')
    require(d2.HISTORICAL_ADMISSIONS == (), 'UNREVIEWED_ADMISSION_AUTHORITY_CHANGE')
    fields = {(r['exchange'], r['field']): r for r in definitions['matrix']}
    matrix = []
    for scope, start, end in d2.ERAS:
        required = list(d2.market_scope_exchanges(start))
        for field in d2.FIELDS:
            matrix.append(dict(marketScopeVersionId=scope, start=start, end=end, field=field,
                requiredExchanges=required, status='NOT_ADMITTED', numericAggregateCount=0,
                targetCount=None, coveragePercent=None, denominatorStatus='UNKNOWN_OFFICIAL_CALENDAR',
                blockers=[dict(exchange=e, sourceReasons=fields[(e, field)]['sourceBlockers'],
                               reasons=fields[(e, field)]['fieldBlockers'],
                               evidenceReferences=fields[(e, field)]['evidenceReferences']) for e in required]))
    sources = []
    for counts in history['sourceCounts']:
        exchange = counts['exchange']
        sources.append(dict(**counts, datasetAdmission='NOT_ADMITTED', officialTradingDayTargetCount=None,
            sourceBlockers=fields[(exchange, d2.FIELDS[0])]['sourceBlockers'],
            fieldAdmission=[fields[(exchange, f)] for f in d2.FIELDS],
            unadmittedWindows=[dict(start='2021-11-15' if exchange == 'BSE' else '2005-01-01', end=d2.END)]))
    return report('ALL_A_DATASET_ADMISSION_REPORT', status='NOT_ADMITTED',
        admissionVersion='all-a-basic-amounts-r2d3-v1',
        previousReport=dict(path='research-data/market-regime/source-catalog/all-a-d2/admission-report.v1.json',
                            contentSha256=previous['contentSha256'], preserved=True),
        checkpointReferences=[dict(path=(OUTPUT / (name + '.json')).as_posix(), contentSha256=obj['contentSha256'])
                              for name, obj in checkpoints] +
                             [dict(path=(FOLDER / INPUT_PATHS['calendar']).as_posix(), contentSha256=evidence['calendar']['contentSha256'])],
        numericAggregateCount=0, targetCount=None, coveragePercent=None, observations=[], dailyGrid=None,
        candidateCount=history['candidateCount'], newCandidateCount=history['newCandidateCount'],
        priorCandidateCount=history['priorCandidateCount'], uniqueCandidateKeyCount=history['uniqueCandidateKeyCount'],
        candidateCountUnit=history['candidateCountUnit'], formalCount=0, strictPitCount=0,
        sourceInventories=sources, admissionMatrix=matrix, eraDenominators=evidence['calendar']['eraDenominators'],
        unadmittedWindows=[{k: r[k] for k in ('marketScopeVersionId', 'start', 'end', 'field', 'blockers')} for r in matrix],
        excludedStructuralComponents=previous['excludedStructuralComponents'],
        evidenceProgress=[
            dict(item='SSE current holiday archive traversal', status='VERIFIED_DISCOVERY',
                 result='6/6 pages and 83/83 listed notices retained and replayed; full session/revision coverage unproven.', references=references(['calendar'])),
            dict(item='BSE 2022-2026 annual holiday notice retrieval', status='VERIFIED_DISCOVERY',
                 result='5/5 notices from the exact official title query retained. V2 supersedes only V1 unrecovered 2022-2024 notice URLs.', references=references(['bseCalendar'])),
            dict(item='SSE local source migration investigation', status='VERIFIED_DISCOVERY',
                 result='Two-family civil-date probe grid replayed; global API era applicability remains unproven.', references=references(['sse', 'sseCandidates'])),
            dict(item='SZSE yearbook link inventory and daily-table candidates', status='VERIFIED_DISCOVERY',
                 result='28 official annual links; 484 replayed ChiNext field cells in a separate candidate family. No formal observations.', references=references(['szseArchive', 'szseCandidates'])),
        ], formalAdmissionTransitions=[], notRun=history['notRun'],
        investigationLimit='Bounded official-source investigation; neither all potentially obtainable archives nor all historical revisions are claimed exhausted.',
        validationMode='PINNED_INPUT_AND_D1_D2_COMPACT_REPLAY_RAW_VALIDATORS_SEPARATE',
        rawArchiveDurability='Small raw responses committed; eight large PDFs retained only in local ignored raw. No remote durable archive claimed.',
        syntheticValidation=dict(included=False, historicalCoverage=0))


BUILDERS = {'release': release_report, 'definitions': definition_report, 'definitions-v2': definition_report_v2,
            'history': history_report, 'admission': admission_report}


def output_path(kind):
    if kind == 'definitions-v2':
        return OUTPUT / 'definitions.v2.json'
    return Path('research-data/market-regime/source-catalog/all-a-d3/admission-report.v1.json') if kind == 'admission' else OUTPUT / (kind + '.v1.json')


def validate_report(obj, kind, *, root=ROOT):
    require(obj == BUILDERS[kind](root=root), 'INTEGRATED_REPORT_REPLAY_MISMATCH')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'validate'])
    parser.add_argument('kind', choices=list(BUILDERS))
    args = parser.parse_args()
    path = ROOT / output_path(args.kind)
    result = BUILDERS[args.kind]()
    if args.command == 'build':
        write_new(path, result)
    else:
        validate_report(strict_json(path.read_bytes()), args.kind)
    import json
    print(json.dumps(dict(validation='PASS', kind=args.kind, status=result['status'], contentSha256=result['contentSha256'])))


if __name__ == '__main__':
    main()
