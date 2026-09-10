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


BUILDERS = {'release': release_report}


def validate_report(obj, kind, *, root=ROOT):
    require(obj == BUILDERS[kind](root=root), 'INTEGRATED_REPORT_REPLAY_MISMATCH')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'validate'])
    parser.add_argument('kind', choices=list(BUILDERS))
    args = parser.parse_args()
    path = ROOT / OUTPUT / (args.kind + '.v1.json')
    result = BUILDERS[args.kind]()
    if args.command == 'build':
        write_new(path, result)
    else:
        validate_report(strict_json(path.read_bytes()), args.kind)
    import json
    print(json.dumps(dict(validation='PASS', kind=args.kind, status=result['status'], contentSha256=result['contentSha256'])))


if __name__ == '__main__':
    main()
