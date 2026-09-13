"""Versioned retained PBC canary, using native R1 records and R2 Graph checks.

This is a bounded graph projection, not a new observation/dataset model or a
full-coverage envelope. Export requires the original seal and does no network IO.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import json
from pathlib import Path

from .catalog import build_catalog, catalog_content_projection, render_catalog
from .hashing import canonical_sha256, sha256_bytes
from .historical import SIDECARS, canonical_order, dataset_content_projection
from .historical_validator import Graph, require, resolve_plan, schema_check, safe_file
from .pbc_parser import parse_pbc_release
from .time_semantics import is_observation_eligible
from .validator import validate_catalog

ROOT = Path(__file__).resolve().parents[2]
BASE = 'research-data/market-regime/source-catalog/pbc-canary-v2'
GRAPH = BASE + '/graph.json'
SEAL = 'research-data/market-regime/source-catalog/pbc-final-evidence.v1.json'
PLAN = 'config/market-regime/pbc-historical-plan.v1.json'
DEFINITIONS = 'config/market-regime/pbc-historical-definitions.v1.json'
CUTOFF = '2011-11-14T08:00:00+08:00'


def load(root, owner):
    return json.loads(safe_file(root, owner).read_text(encoding='utf-8'))


def export(archive_root, root=ROOT):
    """Copy an authentic graph slice only after reconciling original sealed hashes."""
    seal = load(root, SEAL)
    source = seal['sealedOutput']
    bundle = load(archive_root, source + '/input.json')
    dataset = load(archive_root, source + '/dataset.json')
    require(canonical_sha256(catalog_content_projection(bundle['catalog'])) == seal['catalogContentSha256'], 'SEALED_CATALOG_DIGEST')
    require(canonical_sha256(dataset_content_projection(dataset)) == seal['datasetContentSha256'], 'SEALED_DATASET_DIGEST')
    for key, digest in seal['sidecarContentHashes'].items():
        require(canonical_sha256(canonical_order(dataset[key])) == digest, 'SEALED_SIDECAR_DIGEST')
    for ref in seal['snapshotInputs'].values():
        body = safe_file(archive_root, ref['path']).read_bytes()
        require(sha256_bytes(body) == ref['sha256'] and len(body) == ref['byteSize'], 'SEALED_SNAPSHOT_DIGEST')
    c = bundle['catalog']
    obs = [o for o in c['observations'] if o['metricId'] == 'MACRO_M2_YOY' and o['valueDate'] == '2011-10']
    require(len(obs) == 1 and obs[0]['revisionSequence'] == 0 and obs[0]['supersedesObservationId'] is None, 'CANARY_SCOPE')
    xs = [x for x in dataset['fieldExtractions'] if x['observationId'] == obs[0]['observationId']]
    events = [e for e in dataset['releaseEvents'] if e['releaseEventId'] in {x['releaseEventId'] for x in xs}]
    aids = {o['rawArtifactId'] for o in obs}
    evidence_ids = {loc['artifactId'] for e in events for loc in e['firstReleaseEvidence']}
    artifacts = [a for a in c['artifacts'] if a['artifactId'] in aids]
    evidence = [a for a in dataset['evidenceArtifacts'] if a['artifactId'] in evidence_ids]
    attempts = [r for r in dataset['retrievalAttempts'] if r['outcome'] == 'SUCCESS' and any(
        r['sourceId'] == a['sourceId'] and r['finalUrl'] == a['sourceUrl'] and r['attemptedAt'] == a['fetchedAt']
        and r['storedBytes'] == {k:a[k] for k in ('localPath','sha256','byteSize')} for a in artifacts + evidence)]
    graph = dict(schemaVersion='2.0.0', scope='SINGLE_NATIVE_OBSERVATION_CANARY',
        retentionClass='RETAINED_R2B_ACQUISITION', acquisitionTimeMeaning='Actual September 2026 retained acquisition; not a contemporaneous 2011 capture.',
        sourceSeal=dict(owner=SEAL, sha256=sha256_bytes(safe_file(root, SEAL).read_bytes()),
            catalogContentSha256=seal['catalogContentSha256'], datasetContentSha256=seal['datasetContentSha256'],
            verifiedSnapshotInputs=seal['snapshotInputs'], verifiedSidecarContentHashes=seal['sidecarContentHashes']),
        catalog={**{k:[] for k in ('marketScopeVersions','exchangeMarketObservations','providerSlots')},
            'sourceDefinitions':[d for d in c['sourceDefinitions'] if d['sourceDefinitionId']==obs[0]['sourceDefinitionId']],
            'artifacts':artifacts, 'observations':obs},
        dataset={**{k:[] for k in SIDECARS}, 'planId':dataset['manifest']['planId'],
            'releaseEvents':events, 'fieldExtractions':xs, 'evidenceArtifacts':evidence,
            'artifactBindings':[a for a in dataset['artifactBindings'] if a['artifactId'] in aids | evidence_ids],
            'retrievalAttempts':attempts}, relocations=[])
    graph = deepcopy(graph)
    for a in graph['catalog']['artifacts'] + graph['dataset']['evidenceArtifacts']:
        old = a['localPath']
        body = safe_file(archive_root, old).read_bytes()
        require(len(body)==a['byteSize'] and sha256_bytes(body)==a['sha256'], 'RETAINED_RAW_DIGEST')
        new = BASE + '/raw/' + a['sha256'] + '.html'
        dest = root / new
        dest.parent.mkdir(parents=True, exist_ok=True)
        require(not dest.exists() or dest.read_bytes()==body, 'SEALED_EXPORT_COLLISION')
        dest.write_bytes(body)
        graph['relocations'].append(dict(artifactId=a['artifactId'], originalLocalPath=old, committedLocalPath=new, sha256=a['sha256']))
        a['localPath'] = new
        for r in graph['dataset']['retrievalAttempts']:
            if r['storedBytes']['localPath']==old:
                r['storedBytes']['localPath']=new
    graph['catalog'] = build_catalog(graph['catalog'], generated_at='2026-09-13T00:00:00Z')
    (root/GRAPH).write_text(render_catalog(graph), encoding='utf-8')
    return replay(root)


def replay(root=ROOT, cutoff=CUTOFF):
    """Never output future observation identities/values; a canary grants no admission."""
    g = load(root, GRAPH)
    require(g['schemaVersion']=='2.0.0' and g['scope']=='SINGLE_NATIVE_OBSERVATION_CANARY', 'CANARY_SCOPE')
    require(g['retentionClass']=='RETAINED_R2B_ACQUISITION', 'REACQUIRED_IS_NOT_RETAINED')
    seal = load(root, SEAL)
    require(g['sourceSeal']['owner']==SEAL and g['sourceSeal']['sha256']==sha256_bytes(safe_file(root, SEAL).read_bytes()), 'SEAL_PIN')
    require(g['sourceSeal']['catalogContentSha256']==seal['catalogContentSha256'] and g['sourceSeal']['datasetContentSha256']==seal['datasetContentSha256'], 'SEAL_IDENTITY')
    require(g['sourceSeal']['verifiedSnapshotInputs']==seal['snapshotInputs'] and g['sourceSeal']['verifiedSidecarContentHashes']==seal['sidecarContentHashes'], 'SEAL_SIDECARS')
    c,d = g['catalog'],g['dataset']
    require(len(c['observations'])==len(c['sourceDefinitions'])==len(d['fieldExtractions'])==1, 'CANARY_SCOPE')
    definitions = load(root, DEFINITIONS)
    require(all(definition in definitions for definition in c['sourceDefinitions']), 'DEFINITION_OWNER_MISMATCH')
    schema_check(c,r1=True)
    for key, definition in [('releaseEvents','releaseEvent'),('artifactBindings','artifactBinding'),('fieldExtractions','fieldExtraction'),('retrievalAttempts','retrievalAttempt'),('evidenceArtifacts','evidenceArtifact')]:
        for record in d[key]:
            schema_check(record,definition)
    plan = resolve_plan(d['planId'],load(root, PLAN))
    graph = Graph(d,c,plan,root)
    graph.validate_artifacts()
    errors=validate_catalog(c,artifact_root=root,verify_artifacts=True)
    require(not errors, 'NATIVE_CATALOG: ' + '; '.join(errors))
    graph.validate_retrievals()
    graph.validate_events()
    graph.validate_extractions()
    graph.validate_conflicts()
    for a in graph.artifacts.values():
        require(a['artifactRole']=='RAW_SOURCE' and graph.raw(a['artifactId']), 'EXCERPT_IS_NOT_RAW_SOURCE')
        relocations = [r for r in g['relocations'] if r['artifactId']==a['artifactId']]
        require(len(relocations)==1 and relocations[0]['committedLocalPath']==a['localPath'] and relocations[0]['sha256']==a['sha256'], 'RAW_RELOCATION_IDENTITY')
    o=c['observations'][0]
    a=graph.artifacts[o['rawArtifactId']]
    parsed=parse_pbc_release(graph.bytes[a['artifactId']].decode('utf-8'),a['sourceUrl'],source_id=a['sourceId'],expected_period=o['valueDate'])
    rows=[r for r in parsed['rows'] if r['metricId']==o['metricId'] and r['valueDate']==o['valueDate']]
    require(len(rows)==1, 'PARSER_NATIVE_FIELD_MISSING')
    x=d['fieldExtractions'][0]
    require(rows[0]['originalValue']==x['rawValue'] and rows[0]['rawValueText']==x['rawValueText'] and rows[0]['originalUnit']==x['rawUnit'], 'PARSER_FIELD_VALUE_UNIT_MISMATCH')
    require(rows[0]['rawFieldName']==x['rawFieldName'] and rows[0]['locator']=={k:v for k,v in x['locator'].items() if k!='artifactId'}, 'PARSER_LOCATOR_MISMATCH')
    require(o['observationId']=='obs-pbc-'+canonical_sha256([x['releaseEventId'],o['metricId'],o['sourceDefinitionId']]), 'OBSERVATION_IDENTITY')
    require(x['extractionId']=='extract-'+canonical_sha256([x['releaseEventId'],o['metricId'],o['sourceDefinitionId']]), 'EXTRACTION_IDENTITY')
    eligible=is_observation_eligible(o,cutoff)
    return dict(status='PASS',scope=g['scope'],retentionClass=g['retentionClass'],cutoff=cutoff,
        eligibleObservationCount=int(eligible), observations=[o] if eligible else [],
        committedRawCount=len(graph.artifacts), fullGraphReplay='BLOCKED', sourceAdmission='BLOCKED')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,default=ROOT)
    parser.add_argument('--archive-root',type=Path)
    parser.add_argument('--cutoff',default=CUTOFF)
    args=parser.parse_args()
    try:
        result=export(args.archive_root,args.root) if args.archive_root else replay(args.root,args.cutoff)
    except (ValueError,KeyError,TypeError,OSError,IndexError) as exc:
        result=dict(status='BLOCKED',code='PBC_CANARY_EVIDENCE_INVALID',detail=str(exc),observations=[],fullGraphReplay='BLOCKED',sourceAdmission='BLOCKED')
    print(json.dumps(result,ensure_ascii=True,sort_keys=True))


if __name__=='__main__':
    main()
