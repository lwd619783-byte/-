from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path
from typing import get_type_hints

from scripts.market_regime import historical_models
from scripts.market_regime.catalog import build_catalog, render_catalog
from scripts.market_regime.hashing import canonical_sha256
from scripts.market_regime.historical import (SIDECARS, build_dataset, canonical_order,
    dataset_content_projection, plan_identity, release_identity, target_grid)
from scripts.market_regime.historical_cli import load
from scripts.market_regime.historical_validator import (SCHEMA, resolve_plan, safe_file,
    schema_check, select_vintage, validate_dataset)
from scripts.market_regime.time_semantics import date_only_safe_available_at, is_observation_eligible, weekly_backtest_cutoff
from scripts.tests.market_regime_historical_fixture import AS_OF, GENERATED, make_fixture


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'scripts/tests/fixtures/market_regime'


class FixtureCase(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bundle, self.plans = make_fixture(self.root, historical=True)

    @property
    def seed(self):
        return self.bundle['dataset']

    @property
    def catalog(self):
        return self.bundle['catalog']

    def build(self, *, generated_at=GENERATED):
        self.bundle['catalog'] = build_catalog(self.catalog)
        return build_dataset(self.seed,self.catalog,plans=self.plans,artifact_root=self.root,generated_at=generated_at)

    def errors(self, dataset):
        return validate_dataset(dataset,self.catalog,plans=self.plans,artifact_root=self.root)

    def row(self, period):
        return next(r for r in self.seed['coverageLedger'] if r['period']==period)

    def assert_rejected(self, pattern):
        with self.assertRaisesRegex((ValueError, KeyError),pattern):
            self.build()


class CORE1HashAndContractTests(FixtureCase):
    def test_CORE1_fixed_time_permuted_inputs_byte_identical(self):
        first=self.build()
        for k in SIDECARS:
            self.seed[k].reverse()
        for r in self.seed['coverageLedger']:
            r['admittedObservationIds'].reverse()
            r['candidateReleaseEventIds'].reverse()
        self.plans[0]['sources'].reverse()
        self.plans[0]['targetWindows'].reverse()
        for key in ('artifacts','observations','sourceDefinitions'):
            self.catalog[key].reverse()
        self.assertEqual(render_catalog(first),render_catalog(self.build()))

    def test_CORE1_generated_at_excluded_without_self_reference(self):
        first=self.build()
        second=self.build(generated_at='2026-09-09T00:00:00Z')
        self.assertNotEqual(render_catalog(first),render_catalog(second))
        self.assertEqual(first['manifest']['datasetContentSha256'],second['manifest']['datasetContentSha256'])
        projection=dataset_content_projection(first)
        self.assertNotIn('generatedAt',projection)
        self.assertNotIn('datasetContentSha256',projection)
        original=canonical_sha256(projection)
        first['manifest']['datasetContentSha256']='f'*64
        self.assertEqual(original,canonical_sha256(dataset_content_projection(first)))
        self.assertIn('dataset content hash mismatch',';'.join(self.errors(first)))

    def test_CORE1_coverage_link_definition_parser_and_fetched_at_bound(self):
        first=self.build()['manifest']['datasetContentSha256']
        for section,field,value in [('coverageLedger','reasonCode','NEW_REASON'),
                                    ('releaseEvents','firstReleaseEvidenceArtifactIds',[]),
                                    ('fieldExtractions','parserVersion','parser-v2'),
                                    ('retrievalAttempts','attemptedAt','2026-09-09T00:00:00Z')]:
            d=self.build()
            d[section][0][field]=value
            self.assertNotEqual(first,canonical_sha256(dataset_content_projection(d)))
        self.catalog['sourceDefinitions'][0]['definitionSummary']='Additional audited definition note'
        self.assertNotEqual(first,self.build()['manifest']['datasetContentSha256'])

    def test_plan_registry_missing_unknown_duplicate_conflicting_and_tampered(self):
        p=self.plans[0]
        for plans,identity in [([],p['planId']),(self.plans,'absent'),([p,p],p['planId'])]:
            with self.subTest(identity=identity, count=len(plans)):
                with self.assertRaises(ValueError): resolve_plan(identity,plans)
        changed=copy.deepcopy(p)
        changed['targetWindows'][0]['end']='2026-02'
        with self.assertRaisesRegex(ValueError,'identity'): resolve_plan(p['planId'],[changed])
        changed['planId']=plan_identity(changed)
        with self.assertRaisesRegex(ValueError,'conflicting'): resolve_plan(p['planId'],[p,changed])
        self.assertNotEqual(changed['planId'],p['planId'])

    def test_manifest_cannot_override_frozen_plan(self):
        d=self.build()
        for key,value in [('planId','missing-plan'),('planContentSha256','0'*64),
                          ('datasetAsOf','2026-09-14T08:00:00+08:00')]:
            mutated=copy.deepcopy(d); mutated['manifest'][key]=value
            self.assertTrue(self.errors(mutated))

    def test_nan_infinity_nested_and_bool_numbers_rejected(self):
        for value in (float('nan'),float('inf'),float('-inf'),True):
            d=self.build(); d['fieldExtractions'][0]['rawValue']=value
            self.assertTrue(self.errors(d))
        d=self.build(); self.catalog['observations'][0]['metadata']['unexpected']=float('nan')
        self.assertTrue(self.errors(d))

    def test_unknown_fields_enums_types_and_missing_collections(self):
        cases=json.loads((FIXTURES/'r2a-adversarial.v1.json').read_text())
        for case in cases:
            with self.subTest(case=case['name']):
                d=self.build()
                target=d
                for part in case['path'][:-1]: target=target[part]
                target[case['path'][-1]]=case['value']
                self.assertTrue(self.errors(d))
        d=self.build(); del d['conflicts']
        self.assertTrue(self.errors(d))
        self.seed['unexpected']=True
        self.assert_rejected('exact fields')

    def test_python_contract_required_fields_match_machine_schema(self):
        for name,definition in SCHEMA['$defs'].items():
            model=getattr(historical_models,name[0].upper()+name[1:])
            if name == 'locator':
                from typing import get_args
                self.assertEqual(set(get_args(model)),{historical_models.ByteTextLocator,historical_models.StructuredLocator})
                continue
            self.assertEqual(set(get_type_hints(model)),set(definition['required']),name)
        self.assertEqual(set(get_type_hints(historical_models.HistoricalDataset)),set(SCHEMA['required']))

    def test_json_duplicate_keys_and_nonfinite_loader_rejected(self):
        path=self.root/'bad.json'
        for raw in ('{"a":1,"a":2}','{"a":NaN}','{"a":Infinity}'):
            path.write_text(raw)
            with self.assertRaises(ValueError): load(path)


class CORE2ArtifactTests(FixtureCase):
    def test_explicit_zero_requires_its_own_numeric_token(self):
        o=next(o for o in self.catalog['observations'] if o['observationId']=='jan-v0')
        x=next(x for x in self.seed['fieldExtractions'] if x['observationId']=='jan-v0')
        o['value']=0.0; x['rawValue']=0.0; x['rawValueText']='0.0'
        self.assert_rejected('numeric token')
        body=(self.root/'raw/response.html').read_bytes().replace(b'M2 % 10.0',b'M2 % 0.0')
        for loc in (x['locator'],x['basisEvidence']):
            loc['text']=loc['text'].replace('M2 % 10.0','M2 % 0.0')
        self.rebind_bytes(body)
        self.assertEqual(self.build()['manifest']['validationStatus'],'PASS')
        self.assertEqual(next(o for o in self.catalog['observations'] if o['observationId']=='jan-v0')['value'],0.0)

    def test_content_rejection_keeps_failed_bytes_without_pseudo_artifact(self):
        from scripts.market_regime.hashing import sha256_bytes
        error=b'<html><title>Access denied</title></html>'
        (self.root/'raw/error.html').write_bytes(error)
        r=copy.deepcopy(self.seed['retrievalAttempts'][0])
        r.update(attemptId='error-response',outcome='CONTENT_REJECTED',reasonCode='ERROR_PAGE',
                 storedBytes=dict(localPath='raw/error.html',sha256=sha256_bytes(error),byteSize=len(error)),
                 candidateReleaseEventIds=[])
        self.seed['retrievalAttempts'].append(r)
        d=self.build()
        self.assertEqual(len(d['retrievalAttempts']),10)
        self.assertEqual(len(self.catalog['artifacts']),5)

    def test_CORE2_one_byte_corruption_and_size_mismatch(self):
        dataset=self.build(); path=self.root/'raw/response.html'
        body=path.read_bytes(); path.write_bytes(b'X'+body[1:])
        self.assertIn('sha256',';'.join(self.errors(dataset)))
        path.write_bytes(body+b'X')
        self.assertIn('byteSize',';'.join(self.errors(dataset)))

    def test_CORE2_paths_windows_posix_ads_unc_encoded_and_symlink(self):
        for path in ('../escape','/etc/passwd','C:/secret','C:relative','\\\\server\\share','raw/../escape',
                     'raw/response.html:stream','raw/%2e%2e/file','raw/./response.html','raw/file.','raw//response.html'):
            with self.subTest(path=path):
                with self.assertRaisesRegex(ValueError,'unsafe'): safe_file(self.root,path)
        with tempfile.TemporaryDirectory() as outside:
            other=Path(outside)/'secret'; other.write_text('outside')
            link=self.root/'escape'
            try: link.symlink_to(other)
            except OSError:
                # Windows developer mode may disable symbolic links; junctions still
                # exercise the same resolved containment check without elevation.
                import subprocess
                script=f"New-Item -ItemType Junction -Path '{self.root / 'junction'}' -Target '{outside}' | Out-Null"
                subprocess.run(['powershell','-NoProfile','-Command',script],check=True,capture_output=True)
                with self.assertRaisesRegex(ValueError,'unsafe'): safe_file(self.root,'junction/secret')
            else:
                with self.assertRaisesRegex(ValueError,'unsafe'): safe_file(self.root,'escape')

    def test_CORE2_failed_download_not_artifact_and_retained_retrieval(self):
        self.assertEqual(len(self.build()['retrievalAttempts']),9)
        self.catalog['artifacts'][0]['httpStatus']=503
        self.assert_rejected('schema|retrieval|失败')

    def test_CORE2_http_200_error_page_and_forged_complete_fixture(self):
        dataset=self.build()
        self.catalog['artifacts'][0]['artifactRole']='TEST_FIXTURE_EXCERPT'
        self.bundle['catalog']=build_catalog(self.catalog)
        self.assertTrue(self.errors(dataset))
        bundle,plans=make_fixture(self.root)
        bundle['catalog']['artifacts'][0]['artifactRole']='RAW_SOURCE'
        with self.assertRaisesRegex(ValueError,'fixture'):
            build_dataset(bundle['dataset'],build_catalog(bundle['catalog']),plans=plans,artifact_root=self.root,generated_at=GENERATED)

    def test_CORE2_error_page_with_correct_bytes_hash_still_rejected(self):
        # Change bytes and every identity/reference/hash legitimately, so the
        # rejection must come from content inspection rather than checksum drift.
        body=(self.root/'raw/response.html').read_bytes()
        replacement=body.replace(b'<title>Protocol report</title>',b'<title>Access denied</title>')
        self.rebind_bytes(replacement)
        self.assert_rejected('200 error/login page')

    def rebind_bytes(self, body):
        from scripts.market_regime.historical import artifact_identity
        from scripts.market_regime.hashing import sha256_bytes
        (self.root/'raw/response.html').write_bytes(body)
        mapping={}
        for a in self.catalog['artifacts']:
            old=a['artifactId']; binding=next(b for b in self.seed['artifactBindings'] if b['artifactId']==old)
            a['sha256']=sha256_bytes(body); a['byteSize']=len(body)
            a['artifactId']=artifact_identity(a,binding['releaseEventId']); mapping[old]=a['artifactId']
        def update(v):
            if isinstance(v,dict):
                if set(('byteOffset','byteLength','text'))<=v.keys() and v.get('artifactId') in mapping:
                    if 'Protocol report' in v['text'] and b'<title>Access denied</title>' in body:
                        v['text']='<title>Access denied</title>'
                    v['byteOffset']=body.index(v['text'].encode()); v['byteLength']=len(v['text'].encode())
                if set(('localPath','sha256','byteSize'))<=v.keys() and v['localPath']=='raw/response.html':
                    v['sha256']=sha256_bytes(body); v['byteSize']=len(body)
                return {k:update(x) for k,x in v.items()}
            if isinstance(v,list): return [update(x) for x in v]
            return mapping.get(v,v) if isinstance(v,str) else v
        self.bundle=update(self.bundle); self.plans=update(self.plans)
        self.plans[0]['planId']=plan_identity(self.plans[0]); self.seed['planId']=self.plans[0]['planId']
        for row,new in zip(sorted(self.seed['coverageLedger'],key=lambda r:(r['windowId'],r['period'])),
                           sorted(target_grid(self.plans[0]),key=lambda r:(r['windowId'],r['period']))):
            row.update(new)

    def test_locator_parser_conversion_and_field_mismatch(self):
        for field,value in [('rawValueText','-'),('rawFieldName','M1'),('rawUnit','USD'),('periodSemantics','YTD')]:
            original=copy.deepcopy(self.seed['fieldExtractions'])
            self.seed['fieldExtractions'][0][field]=value
            self.assert_rejected('raw|YTD|mismatch')
            self.seed['fieldExtractions']=original
        self.seed['fieldExtractions'][0]['unitConversion']['factor']=100
        self.assert_rejected('identity conversion')

    def test_failed_and_cache_attempt_contracts(self):
        for outcome,status,error in [('SUCCESS',503,None),('TRANSPORT_ERROR',200,'timeout'),('HTTP_ERROR',200,None)]:
            original=copy.deepcopy(self.seed['retrievalAttempts'][-1])
            self.seed['retrievalAttempts'][-1].update(outcome=outcome,httpStatus=status,transportError=error)
            self.assert_rejected('retrieval|failure')
            self.seed['retrievalAttempts'][-1]=original
        self.seed['retrievalAttempts'][0]['outcome']='CACHE_VERIFIED'
        self.assert_rejected('cache requires original network acquisition|matching successful retrieval')


class CORE3ClockTests(FixtureCase):
    def test_CORE3_exact_boundary_0759_0800_0801(self):
        d=self.build(); cid=self.row('2026-01')['cellId']
        for cutoff,expected in [('2026-09-07T07:58:59+08:00',None),('2026-09-07T07:59:00+08:00','jan-v0'),(AS_OF,'jan-v1')]:
            result=select_vintage(d,self.catalog,plans=self.plans,artifact_root=self.root,cell_id=cid,cutoff=cutoff)
            self.assertEqual(result['observationId'] if result else None,expected)
        later=next(e for e in d['releaseEvents'] if '08:01' in e['releaseAvailableAt'])
        self.assertFalse(is_observation_eligible(later,AS_OF))

    def test_CORE3_date_only_sunday_monday_and_holiday_clock(self):
        for day,expected in [('2026-09-06',True),('2026-09-07',False)]:
            release=dict(releaseAvailableAt=date_only_safe_available_at(day),releaseConfidenceClass='DATE_ONLY_SAFE')
            self.assertEqual(is_observation_eligible(release,AS_OF),expected)
        self.assertEqual(weekly_backtest_cutoff('2026-10-05'),'2026-10-05T08:00:00+08:00')

    def test_CORE3_date_only_backcast_uses_safe_time(self):
        d=self.build(); cid=self.row('2026-02')['cellId']
        for cutoff,expected in [('2026-09-06T23:59:59+08:00',None),(AS_OF,'feb-backcast')]:
            o=select_vintage(d,self.catalog,plans=self.plans,artifact_root=self.root,cell_id=cid,cutoff=cutoff)
            self.assertEqual(o['observationId'] if o else None,expected)

    def test_unknown_naive_dates_rejected(self):
        for time in ('2026-09-07T08:00:00','2026-13-07T08:00:00+08:00'):
            d=self.build(); d['manifest']['generatedAt']=time
            self.assertTrue(self.errors(d))


class CORE4RevisionTests(FixtureCase):
    def test_release_attachment_missing_reference_and_unreplayable_link(self):
        e=self.seed['releaseEvents'][0]
        e['attachmentArtifactIds']=['missing-attachment']
        self.assert_rejected('release artifact reference')
        e['attachmentArtifactIds']=[self.catalog['artifacts'][1]['artifactId']]
        self.assert_rejected('reused across|clock mismatch|landing cannot|reference')

    def test_CORE4_same_bytes_different_release_events_not_collapsed(self):
        d=self.build()
        self.assertEqual(len({a['sha256'] for a in self.catalog['artifacts']}),1)
        self.assertEqual(len({a['artifactId'] for a in self.catalog['artifacts']}),5)
        self.assertEqual(len(d['releaseEvents']),5)
        self.assertNotEqual(self.catalog['observations'][0]['rawArtifactId'],self.catalog['observations'][1]['rawArtifactId'])

    def test_CORE4_broken_cyclic_same_sequence_cross_source_chains(self):
        for field,value in [('supersedesObservationId','missing'),('supersedesObservationId','jan-v1'),('revisionSequence',0),('revisionSequence',2),('sourceId','OTHER')]:
            original=copy.deepcopy(self.catalog['observations'])
            next(o for o in self.catalog['observations'] if o['observationId']=='jan-v1')[field]=value
            self.assert_rejected('R1|revision|source')
            self.catalog['observations']=original

    def test_CORE4_later_observation_cannot_reuse_earlier_artifact(self):
        prev=next(o for o in self.catalog['observations'] if o['observationId']=='jan-v0')
        rev=next(o for o in self.catalog['observations'] if o['observationId']=='jan-v1')
        rev['rawArtifactId']=prev['rawArtifactId']
        self.assert_rejected('R1|lineage')

    def test_CORE4_first_release_requires_evidence_not_sequence_zero(self):
        e=next(e for e in self.seed['releaseEvents'] if e['releaseKind']=='FIRST_RELEASE')
        e['firstReleaseEvidence']=[]; e['firstReleaseEvidenceArtifactIds']=[]
        self.assert_rejected('first release unproven')

    def test_CORE4_revision_authority_and_extraction_lineage_required(self):
        e=next(e for e in self.seed['releaseEvents'] if e['releaseKind']=='REVISION')
        evidence=e['revisionEvidence']; e['revisionEvidence']=[]
        self.assert_rejected('revision authority')
        e['revisionEvidence']=evidence
        self.seed['fieldExtractions'][1]['predecessorExtractionIds']=[]
        self.assert_rejected('predecessor mismatch')

    def test_CORE4_conflict_retained_and_excluded_then_forged_resolution_rejected(self):
        row=self.row('2026-01')
        row['status']='UNRESOLVED_RELEASE_CONFLICT'; row['admittedObservationIds']=[]
        self.seed['conflicts']=[dict(conflictId='conflict-1',cellIds=[row['cellId']],candidateReleaseEventIds=row['candidateReleaseEventIds'],
            status='UNRESOLVED',evidence=[],resolutionReleaseEventId=None,reasonCode='UNRESOLVED_RELEASE_CONFLICT',handlingBasis='No authoritative resolution accepted')]
        d=self.build()
        self.assertIsNone(select_vintage(d,self.catalog,plans=self.plans,artifact_root=self.root,cell_id=row['cellId'],cutoff=AS_OF))
        self.seed['conflicts'][0]['status']='RESOLVED_BY_OFFICIAL_REVISION'
        self.seed['conflicts'][0]['resolutionReleaseEventId']=row['candidateReleaseEventIds'][0]
        self.assert_rejected('official revision')

    def test_CORE4_conflict_cannot_hide_candidate(self):
        row=self.row('2026-01'); row['candidateReleaseEventIds'].pop()
        self.assert_rejected('vintage silently omitted')


class CORE5MissingTests(FixtureCase):
    def test_CORE5_missing_unreachable_structural_never_zero(self):
        row=self.row('2026-09-04')
        for status in ('MISSING','SOURCE_UNREACHABLE','FIELD_MISSING','PARSER_FAILED','DEFINITION_UNRESOLVED'):
            row['status']=status
            d=self.build(); self.assertEqual(self.row('2026-09-04')['admittedObservationIds'],[])
            self.assertEqual(next(s for s in d['manifest']['coverageSummary'] if s['windowId']=='daily')['counts']['targetCount'],2)
        row['status']='STRUCTURALLY_UNAVAILABLE'
        self.assert_rejected('status requires')

    def test_CORE5_source_absence_not_proven_by_timeout_or_404(self):
        self.row('2026-09-04')['status']='SOURCE_ABSENT_CONFIRMED'
        self.assert_rejected('status requires')
        self.seed['retrievalAttempts'][-1].update(outcome='HTTP_ERROR',httpStatus=404,transportError=None)
        self.assert_rejected('status requires')

    def test_CORE5_not_yet_requires_actual_later_evidence(self):
        row=self.row('2026-03'); row['candidateReleaseEventIds']=[]
        self.assert_rejected('not-yet')

    def test_CORE5_gap_value_in_r1_rejected(self):
        self.catalog['observations'][0].update(value=0,qualityStatus='MISSING')
        self.assert_rejected('R1')

    def test_CORE5_proxy_schedule_inferred_excluded(self):
        from scripts.market_regime.historical import artifact_identity
        for confidence in ('LATEST_REVISED_PROXY','SCHEDULE_INFERRED'):
            bundle,plans=make_fixture(self.root,historical=True)
            self.bundle,self.plans=bundle,plans
            # Make the backcast an unresolved proxy; rewrite identity references.
            e=next(e for e in self.seed['releaseEvents'] if e['releaseKind']=='BACKCAST')
            old_eid=e['releaseEventId']; old_aid=e['landingArtifactId']
            e['releaseKind']='UNRESOLVED'; e['releaseConfidenceClass']=confidence
            new_eid=release_identity(e)
            a=next(a for a in self.catalog['artifacts'] if a['artifactId']==old_aid)
            a['releaseConfidenceClass']=confidence
            new_aid=artifact_identity(a,new_eid)
            mapping={old_eid:new_eid,old_aid:new_aid}
            def replace(v):
                if isinstance(v,dict): return {k:replace(x) for k,x in v.items()}
                if isinstance(v,list): return [replace(x) for x in v]
                return mapping.get(v,v) if isinstance(v,str) else v
            self.bundle=replace(self.bundle)
            o=next(o for o in self.catalog['observations'] if o['observationId']=='feb-backcast')
            o.update(releaseConfidenceClass=confidence,qualityStatus='VERIFIED')
            self.row('2026-02').update(status='PIT_VINTAGE_UNPROVEN',admittedObservationIds=[])
            d=self.build()
            self.assertEqual(next(s for s in d['manifest']['coverageSummary'] if s['windowId']=='monthly')['counts']['availableCount'],1)
            self.row('2026-02').update(status='AVAILABLE',admittedObservationIds=['feb-backcast'])
            self.assert_rejected('qualified vintages')


class CORE6CoverageTests(FixtureCase):
    def test_complete_offline_protocol_window_can_pass_with_all_revisions_retained(self):
        # Only an in-memory contract simulation, never a committed official dataset.
        p=self.plans[0]
        p['targetWindows']=[w for w in p['targetWindows'] if w['windowId']=='monthly']
        p['targetWindows'][0]['end']='2026-01'
        p['planVersion']='2.0.0'; p['planId']=plan_identity(p); self.seed['planId']=p['planId']
        self.seed['coverageLedger']=[self.row('2026-01')]
        self.seed['inventoryEvidence']=[s for s in self.seed['inventoryEvidence'] if s['windowId']=='monthly']
        self.seed['inventoryEvidence'][0]['revisionScanComplete']=True
        scan=self.seed['inventoryEvidence'][0]
        scan['pages'][0]['candidateReleaseEventIds']=self.row('2026-01')['candidateReleaseEventIds'][:]
        scan['revisionPages']=copy.deepcopy(scan['pages'])
        a=next(a for a in self.seed['evidenceArtifacts'] if a['artifactId']==scan['pages'][0]['artifactId'])
        body=(self.root/a['localPath']).read_bytes(); text='END REVISION SCAN'
        scan['revisionStopEvidence']=dict(pageNumber=1,locator=dict(artifactId=a['artifactId'],byteOffset=body.index(text.encode()),byteLength=len(text),text=text))
        self.catalog['observations']=[o for o in self.catalog['observations'] if o['valueDate']=='2026-01']
        self.catalog['exchangeMarketObservations']=[]
        self.seed['fieldExtractions']=[x for x in self.seed['fieldExtractions'] if x['period']=='2026-01']
        d=self.build()
        self.assertEqual(d['manifest']['admissionStatus'],'ADMITTED')
        self.assertEqual(d['manifest']['coverageSummary'][0]['counts']['vintageCount'],2)

    def test_ytd_evidence_only_does_not_create_monthly_observation(self):
        x=copy.deepcopy(self.seed['fieldExtractions'][0])
        x.update(extractionId='ytd-evidence-only',observationId=None,periodSemantics='YTD')
        self.seed['fieldExtractions'].append(x)
        before=len(self.catalog['observations'])
        self.build()
        self.assertEqual(len(self.catalog['observations']),before)

    def test_CORE6_missing_month_day_and_duplicate_vintage_do_not_shrink_denominator(self):
        for period in ('2026-02','2026-09-04'):
            original=copy.deepcopy(self.seed['coverageLedger'])
            self.seed['coverageLedger'].remove(self.row(period))
            self.assert_rejected('denominator')
            self.seed['coverageLedger']=original
        summary=next(s for s in self.build()['manifest']['coverageSummary'] if s['windowId']=='monthly')
        self.assertEqual(summary['counts']['targetCount'],3)
        self.assertEqual(summary['counts']['availableCount'],2)
        self.assertEqual(summary['counts']['vintageCount'],3)
        self.row('2026-01')['admittedObservationIds'].append('jan-v0')
        self.assert_rejected('schema')

    def test_CORE6_sample_fixture_zero_historical_coverage_inventory_pass(self):
        self.bundle,self.plans=make_fixture(self.root)
        d=self.build()
        self.assertEqual(d['manifest']['admissionStatus'],'SYNTHETIC_ONLY')
        for s in d['manifest']['coverageSummary']:
            self.assertEqual(s['counts']['availableCount'],0)
            self.assertEqual(s['inventoryStatus'],'PASS')
            self.assertEqual(s['datasetCoverageStatus'],'PARTIAL')
            c=s['counts']
            self.assertEqual(c['targetCount'],c['availableCount']+c['notYetReleasedCount']+c['structuralCount']+c['unresolvedCount'])
        self.row('2026-01').update(status='AVAILABLE',admittedObservationIds=['jan-v0','jan-v1'])
        self.assert_rejected('fixture|qualified')

    def test_CORE6_calendar_missing_or_mutated_no_denominator(self):
        plan=self.plans[0]
        daily=next(w for w in plan['targetWindows'] if w['frequency']=='TRADING_DAY')
        daily['calendar']=None; plan['planId']=plan_identity(plan); self.seed['planId']=plan['planId']
        self.assert_rejected('calendar')

    def test_CORE6_claimed_count_or_status_cannot_override_computation(self):
        d=self.build(); d['manifest']['coverageSummary'][0]['counts']['targetCount']-=1
        self.assertIn('coverage summary',';'.join(self.errors(d)))
        d=self.build(); d['manifest']['admissionStatus']='ADMITTED'
        self.assertIn('admission status',';'.join(self.errors(d)))

    def test_CORE6_full_frozen_month_range_expands_to_260_without_fetch(self):
        p=copy.deepcopy(self.plans[0]); w=p['targetWindows'][0]
        p['targetWindows']=[w]; w['start']='2005-01'; w['end']='2026-08'
        self.assertEqual(len(target_grid(p)),260)
        w['start']='2015-01'; self.assertEqual(len(target_grid(p)),140)

    def test_CORE6_numeric_field_requires_extraction_and_matching_grid(self):
        self.seed['fieldExtractions'].pop()
        self.assert_rejected('missing extraction')


class R1CompatibilityTests(unittest.TestCase):
    def test_cli_idempotent_and_failed_build_never_overwrites_sealed_output(self):
        from contextlib import redirect_stdout
        from io import StringIO
        from unittest.mock import patch
        from scripts.market_regime.historical_cli import main
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            bundle,plans=make_fixture(root)
            (root/'input.json').write_text(json.dumps(bundle),encoding='utf-8')
            (root/'plans.json').write_text(json.dumps(plans),encoding='utf-8')
            args=['build','--generated-at',GENERATED,'--input','input.json','--plans','plans.json','--output','out.json']
            with patch('scripts.market_regime.historical_cli.ROOT',root),redirect_stdout(StringIO()):
                self.assertEqual(main(args),0)
                original=(root/'out.json').read_bytes()
                self.assertEqual(main(args),0)
                self.assertEqual(main([*args,'--generated-at','2026-09-09T00:00:00Z']),1)
                self.assertEqual((root/'out.json').read_bytes(),original)
                bundle['dataset']['coverageLedger'].pop()
                (root/'input.json').write_text(json.dumps(bundle),encoding='utf-8')
                self.assertEqual(main(args),1)
                self.assertEqual((root/'out.json').read_bytes(),original)
                args[-1]='new.json'
                self.assertEqual(main(args),1)
                self.assertFalse((root/'new.json').exists())

    def test_R1_content_hash_fixed_and_unknown_envelope_keys_not_injected(self):
        source=json.loads((ROOT/'research-data/market-regime/source-catalog/catalog-seed.sample.v1.json').read_text(encoding='utf-8'))
        catalog=build_catalog(source)
        self.assertEqual(catalog['manifest']['contentHashes']['catalogContentSha256'],
                         'b7f9802eb46d44088adb75471c190af4c9b48d471a8865ef3b531d4c6b3bfec6')
        catalog['releaseEvents']=[]
        with self.assertRaisesRegex(ValueError,'schema'): schema_check(catalog,r1=True)

    def test_committed_synthetic_bundle_envelope_and_plan_replay(self):
        bundle=load(FIXTURES/'r2a-input.sample.v2.json')
        plans=load(ROOT/'config/market-regime/historical-dataset-plans.sample.v2.json')
        dataset=load(FIXTURES/'r2a-dataset.sample.v2.json')
        self.assertEqual(validate_dataset(dataset,bundle['catalog'],plans=plans,artifact_root=ROOT),[])
        self.assertEqual(render_catalog(dataset),render_catalog(build_dataset(bundle['dataset'],bundle['catalog'],
                         plans=plans,artifact_root=ROOT,generated_at=GENERATED)))


if __name__=='__main__':
    unittest.main()
