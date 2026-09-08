"""Build/replay the PBC slice from an explicit, resumable official acquisition journal."""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
import json
from pathlib import Path
from urllib.parse import urlsplit

from .catalog import render_catalog, utc_now_iso
from .hashing import atomic_write_bytes, canonical_sha256
from .historical_cli import load
from .historical_validator import safe_file, validate_dataset
from .pbc_dataset import M2, AFRE, assemble

ROOT = Path(__file__).resolve().parents[2]
RAW = 'research-data/market-regime/raw/pbc-r2b'
PLAN = 'config/market-regime/pbc-historical-plan.v1.json'
DEFINITIONS = 'config/market-regime/pbc-historical-definitions.v1.json'


def source_view(identity, source):
    return 'view-' + canonical_sha256([identity, source])


def protocol_exclusions(journal):
    """Old HTTP receipts remain immutable in the physical journal, outside R2-A.

    The frozen envelope only accepts HTTPS. Never rewrite a past request URL to
    make it pass; a later real HTTPS acquisition is a separate receipt.
    """
    excluded={r['attempt']['attemptId'] for r in journal if any(r['attempt'][k] and urlsplit(r['attempt'][k]).scheme!='https' for k in ('requestUrl','finalUrl'))}
    excluded.update(r['attempt']['attemptId'] for r in journal if r['attempt']['acquisitionAttemptId'] in excluded)
    return excluded


def acquisition_inputs(root, journal, discovery):
    """Two metrics may reference one physical GET without inventing another GET.

    R2-A source-bound artifacts require source-bound retrieval views. The original
    physical ID is retained in handlingBasis; time, response and bytes are exact.
    """
    excluded=protocol_exclusions(journal)
    journal=[r for r in journal if r['attempt']['attemptId'] not in excluded]
    pages = {p['acquisitionAttemptId']:p for p in discovery['pages']}
    success = {r['attempt']['attemptId']:r for r in journal if r['attempt']['outcome']=='SUCCESS'}
    sources = {}
    for rid, row in success.items():
        r = row['attempt']
        if rid in pages or r['sourceId']=='PBC_STATISTICS_INDEX':
            sources[rid] = [M2,AFRE]
        elif 'AFRE' in r['sourceId']:
            sources[rid] = [AFRE]
        else:
            body = safe_file(root,r['storedBytes']['localPath']).read_bytes()
            sources[rid] = [M2] + ([AFRE] if '社会融资规模存量'.encode() in body else [])
    attempts = []
    for row in journal:
        r = row['attempt']
        physical = r['acquisitionAttemptId'] or r['attemptId']
        for source in sources.get(physical, [AFRE] if 'AFRE' in r['sourceId'] else [M2,AFRE] if 'INDEX' in r['sourceId'] else [M2]):
            v = deepcopy(r)
            v.update(sourceId=source,attemptId=source_view(r['attemptId'],source),
                     acquisitionAttemptId=source_view(r['acquisitionAttemptId'],source) if r['acquisitionAttemptId'] else None,
                     handlingBasis=r['handlingBasis']+'; physical acquisition journal ID='+r['attemptId']+'; source view, not an additional network request')
            attempts.append(v)
    views = {a['attemptId']:a for a in attempts}
    links = defaultdict(list)
    for page in discovery['pages']:
        for entry in page['entries']:
            for source in (M2,AFRE):
                links[(entry['url'],source)].append(dict(attemptId=source_view(page['acquisitionAttemptId'],source),text=entry['entryHtml']))
    records = []
    for rid, row in success.items():
        for source in sources[rid]:
            acquisition = views[source_view(rid,source)]
            records.append(dict(acquisition=acquisition,contentType=row['contentType'],
                role='INDEX' if rid in pages or row['attempt']['sourceId']=='PBC_STATISTICS_INDEX' else 'RELEASE',
                indexLinks=links.get((acquisition['finalUrl'],source),[])))
    return records, attempts


def sealed_write(path, content):
    if path.exists() and path.read_bytes()!=content:
        raise ValueError('sealed output differs; choose a new output directory/version')
    atomic_write_bytes(path,content)


def compact_report(dataset,bundle,diagnostics,journal,discovery):
    physical = [r['attempt'] for r in journal]
    successful = [a for a in physical if a['outcome']=='SUCCESS']
    dates = sorted(a['attemptedAt'] for a in physical)
    events = {e['releaseEventId']:e for e in dataset['releaseEvents']}
    by_source = {}
    for source in (M2,AFRE):
        summaries = [s for s in dataset['manifest']['coverageSummary'] if next(w for w in dataset['manifest']['targetWindows'] if w['windowId']==s['windowId'])['sourceId']==source]
        by_source[source] = summaries
    return dict(actualBase='4920e38830cfde887dab39e64673e7f30857e331',
        generatedAt=dataset['manifest']['generatedAt'],datasetAsOf=dataset['manifest']['datasetAsOf'],
        planId=dataset['manifest']['planId'],datasetContentSha256=dataset['manifest']['datasetContentSha256'],
        catalogContentSha256=dataset['manifest']['catalogContentSha256'],validationStatus='PASS',
        admissionStatus=dataset['manifest']['admissionStatus'],sourceCoverage=by_source,
        acquisition=dict(firstAttemptAt=dates[0] if dates else None,lastAttemptAt=dates[-1] if dates else None,
            outcomes=dict(Counter(a['outcome'] for a in physical)),physicalSuccessCount=len(successful),
            uniqueResponseHashes=len({a['storedBytes']['sha256'] for a in successful}),
            uniqueBytes=sum({a['storedBytes']['sha256']:a['storedBytes']['byteSize'] for a in successful}.values()),
            indexPageCount=len(discovery['pages']),indexEntryCount=sum(len(p['entries']) for p in discovery['pages'])),
        excludedProtocolAttempts=[dict(attemptId=a['attemptId'],requestUrl=a['requestUrl'],outcome=a['outcome'],
            reason='R2A_HTTPS_REQUIRED_ORIGINAL_RECEIPT_RETAINED_IN_JOURNAL') for a in physical if a['attemptId'] in protocol_exclusions(journal)],
        releaseKinds=dict(Counter(e['releaseKind'] for e in events.values())),
        observationCount=len(bundle['catalog']['observations']),extractionCount=len(dataset['fieldExtractions']),
        conflictCount=len(dataset['conflicts']),parserDiagnostics=diagnostics,
        inventoryBlocker='Retained mixed-era official index uses JavaScript next-page navigation. R2-A requires per-window reconciled candidate URLs and a literal href chain; no complete scan claim. Revision exhaustiveness remains unproven.',
        backcastPolicy='2002-2014 search grid remains 156 months per field; only literally released native periods qualify, never interpolation.',
        cells=[dict(sourceId=c['sourceId'],metricId=c['metricId'],period=c['period'],windowId=c['windowId'],
            status=c['status'],reasonCode=c['reasonCode'],
            firstRelease=any(events[eid]['releaseKind']=='FIRST_RELEASE' for eid in c['candidateReleaseEventIds']) and bool(c['admittedObservationIds']),
            admittedCount=len(c['admittedObservationIds'])) for c in dataset['coverageLedger']])


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('command',choices=['build','validate'])
    p.add_argument('--output',required=True,help='New ignored vintages directory; sealed outputs are never replaced')
    p.add_argument('--generated-at',help='Reuse the reported timestamp for byte-identical offline replay')
    p.add_argument('--journal',default=RAW+'/retrieval-journal.jsonl')
    p.add_argument('--discovery',default=RAW+'/discovery.json')
    args=p.parse_args(argv)
    try:
        output=(ROOT/args.output).resolve()
        permitted=(ROOT/'research-data/market-regime/vintages').resolve()
        if not output.is_relative_to(permitted) or output==permitted:
            raise ValueError('output must be a child of ignored research-data/market-regime/vintages')
        plans=load(safe_file(ROOT,PLAN))
        if args.command=='validate':
            bundle=load(safe_file(ROOT,args.output+'/input.json'))
            dataset=load(safe_file(ROOT,args.output+'/dataset.json'))
            errors=validate_dataset(dataset,bundle['catalog'],plans=plans,artifact_root=ROOT)
            if errors: raise ValueError('\n'.join(errors))
        else:
            journal=[json.loads(line) for line in safe_file(ROOT,args.journal).read_text(encoding='utf-8').splitlines() if line]
            discovery=load(safe_file(ROOT,args.discovery))
            records,attempts=acquisition_inputs(ROOT,journal,discovery)
            generated=args.generated_at or utc_now_iso()
            bundle,dataset,diagnostics=assemble(plans[0],load(safe_file(ROOT,DEFINITIONS)),records,attempts,root=ROOT,generated_at=generated)
            report=compact_report(dataset,bundle,diagnostics,journal,discovery)
            # Build/validate the whole graph before publishing any output.
            for name,value in [('input.json',bundle),('dataset.json',dataset),('report.json',report)]:
                content=render_catalog(value).encode()
                if (output/name).exists() and (output/name).read_bytes()!=content:
                    raise ValueError('sealed output differs; choose a new output directory/version')
            for name,value in [('input.json',bundle),('dataset.json',dataset),('report.json',report)]:
                sealed_write(output/name,render_catalog(value).encode())
        print(json.dumps(dict(status='PASS',datasetContentSha256=dataset['manifest']['datasetContentSha256'],
            admissionStatus=dataset['manifest']['admissionStatus'],coverageSummary=dataset['manifest']['coverageSummary']),ensure_ascii=False,indent=2))
        return 0
    except (ValueError,OSError,KeyError,TypeError) as exc:
        print(json.dumps(dict(status='FAIL',errors=[str(exc)]),ensure_ascii=False))
        return 1


if __name__=='__main__':
    raise SystemExit(main())
