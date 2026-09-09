"""MARKET-3/5 and D2 CORE regressions. All positive amounts are synthetic."""
from copy import deepcopy
from contextlib import redirect_stdout
from decimal import Decimal
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest

from scripts.market_regime.all_a_admission import (
    AS_OF, ERAS, FIELDS, GENERATED, REPORT_PATH, aggregate_all_a, build_report,
    load_inventories, main, scope_for, seal, validate_aggregation, validate_report,
)
from scripts.market_regime.catalog import build_catalog, catalog_content_projection
from scripts.market_regime.hashing import canonical_sha256, canonical_json_bytes
from scripts.market_regime.historical import SIDECARS, canonical_order, dataset_content_projection
from scripts.market_regime.market_adapters import structurally_unavailable_exchange_observation
from scripts.market_regime.sse_source import business_projection
from scripts.tests.all_a_admission_fixture import make_bundle


def reseal_dataset(bundle):
    # Deliberately forge consistent hashes, without changing the external review.
    d = bundle['dataset']
    bundle['catalog'] = build_catalog(bundle['catalog'])
    d['manifest']['catalogContentSha256'] = canonical_sha256(catalog_content_projection(bundle['catalog']))
    d['manifest']['sidecarContentHashes'] = {k:canonical_sha256(canonical_order(d[k])) for k in SIDECARS}
    d['manifest']['datasetContentSha256'] = canonical_sha256(dataset_content_projection(d))


class AggregationTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.day = '2021-11-15'
        self.bundles, self.approvals = [], []
        for i, ex in enumerate(('SSE','SZSE','BSE')):
            b, a = make_bundle(self.root,ex,self.day,minute=i,amount=(i+1)*10)
            self.bundles.append(b)
            self.approvals.extend(a)

    def run_gate(self, **overrides):
        args = dict(trade_date=self.day,cutoff='2021-11-22T08:00:00+08:00',artifact_root=self.root,
                    synthetic_admissions=self.approvals)
        args.update(overrides)
        return aggregate_all_a(self.bundles, **args)

    def reject(self, reason=None, **overrides):
        result = self.run_gate(**overrides)
        self.assertEqual(result['observations'], [])
        self.assertTrue(all(d['status']=='NOT_ADMITTED' and d['blockers'] for d in result['decisions']))
        if reason:
            self.assertIn(reason, str(result['decisions']))
        return result

    def replace(self, index, **options):
        ex = self.bundles[index]['exchange']
        b, a = make_bundle(self.root, ex, options.pop('day',self.day), **options)
        self.bundles[index] = b
        self.approvals = [p for p in self.approvals if p['exchange'] != ex] + a

    def test_post_launch_three_fields_numeric_lineage_and_max_clock_replay(self):
        r = self.run_gate()
        self.assertEqual(r['kind'],'SYNTHETIC_ONLY')
        self.assertEqual(r['historicalCoverage'],0)
        self.assertEqual({o['field']:o['value'] for o in r['observations']},
                         dict(turnoverValue=60,totalMarketCap=120,negotiableMarketCap=180))
        for o in r['observations']:
            self.assertEqual(o['releaseAvailableAt'],'2021-11-15T16:02:00+08:00')
            self.assertEqual(len(o['components']),3)
            self.assertEqual(Decimal(o['valueText']),sum(Decimal(c['valueCnyText']) for c in o['components']))
            for c in o['components']:
                b = next(b for b in self.bundles if b['exchange']==c['exchange'])
                x = next(x for x in b['dataset']['fieldExtractions'] if x['extractionId']==c['extractionId'])
                self.assertEqual(x['exchangeObservationId'],c['observationId'])
                self.assertEqual(x['releaseEventId'],c['releaseEventId'])
                self.assertIn(x['rawArtifactId'],c['artifactIds'])
                self.assertEqual(c['datasetContentSha256'],b['dataset']['manifest']['datasetContentSha256'])

    def test_pre_launch_requires_only_sse_szse(self):
        self.day = '2021-11-12'
        self.bundles = self.bundles[:2]
        self.approvals = []
        for i in range(2): self.replace(i,minute=i)
        r = self.run_gate(cutoff='2021-11-15T08:00:00+08:00')
        self.assertEqual(set(r['requiredExchanges']),{'SSE','SZSE'})
        self.assertEqual(len(r['observations']),3)
        self.assertTrue(all(len(o['components'])==2 for o in r['observations']))

    def test_scope_exact_boundaries_without_weekday_inference(self):
        self.assertEqual(scope_for('2005-01-01'),ERAS[0][0])
        self.assertEqual(scope_for('2021-11-14'),ERAS[0][0])
        self.assertEqual(scope_for('2021-11-15'),ERAS[1][0])
        with self.assertRaises(ValueError): scope_for('2004-12-31')
        with self.assertRaises(ValueError): scope_for('20211115')

    def test_missing_exchange(self):
        self.bundles.pop()
        self.reject('REQUIRED_EXCHANGE_MISSING')

    def test_wrong_trade_date_does_not_carry_forward(self):
        self.replace(2,day='2021-11-16')
        self.reject('SAME_DATE_COMPONENT_MISSING')

    def test_field_missing_independent_for_each_of_three_fields(self):
        for field in FIELDS:
            with self.subTest(field=field):
                self.replace(2,missing=(field,))
                r = self.run_gate()
                self.assertEqual({o['field'] for o in r['observations']},set(FIELDS)-{field})
                d = next(d for d in r['decisions'] if d['field']==field)
                self.assertIn('FIELD_MISSING',str(d['blockers']))

    def test_candidate_with_admitted_flag_is_not_a_component(self):
        self.bundles[2] = dict(exchange='BSE',tradeDate=self.day,admitted=True,
                              turnoverValue=30,totalMarketCap=60,negotiableMarketCap=90)
        self.reject('COMPONENT_BUNDLE_REQUIRED')

    def test_core_valid_historical_model_still_needs_external_field_review(self):
        self.reject('SOURCE_FIELD_ADMISSION_IDENTITY_MISSING',synthetic_admissions=[])

    def test_synthetic_models_cannot_enter_real_coverage(self):
        r = self.reject('SOURCE_FIELD_ADMISSION_IDENTITY_MISSING',synthetic_admissions=None)
        self.assertEqual(r['kind'],'HISTORICAL')
        self.assertEqual(r['historicalCoverage'],0)

    def test_external_review_is_field_specific(self):
        self.approvals = [a for a in self.approvals if not(a['exchange']=='BSE' and a['field']=='totalMarketCap')]
        self.assertEqual({o['field'] for o in self.run_gate()['observations']},{'turnoverValue','negotiableMarketCap'})

    def test_incompatible_scope_even_with_test_review_is_rejected(self):
        self.replace(2,scope='bse-all-securities-including-non-a',security_scope='MIXED_A_B')
        self.reject('SOURCE_FIELD_ADMISSION_IDENTITY_MISSING')

    def test_scope_version_must_match_external_review(self):
        for a in self.approvals:
            if a['exchange']=='BSE': a['scopeVersion']='different-unreviewed-scope'
        self.reject('SOURCE_FIELD_ADMISSION_IDENTITY_MISSING')

    def test_unit_and_scale_inconsistency(self):
        self.replace(2,unit='USD',raw_unit='USD')
        self.reject('UNIT_NOT_CONVERTIBLE_TO_CNY')
        self.replace(2,unit='CNY',raw_unit='亿元',factor=1)
        self.reject('UNIT_SCALE_MISMATCH')

    def test_convertible_cny_units_are_replayed(self):
        self.replace(2,raw_unit='亿元',factor=100000000)
        r = self.run_gate()
        self.assertEqual(next(o['value'] for o in r['observations'] if o['field']=='turnoverValue'),1000000030)
        self.replace(2,unit='亿元',raw_unit='亿元')
        r2 = self.run_gate()
        self.assertEqual({o['field']:o['value'] for o in r['observations']},{o['field']:o['value'] for o in r2['observations']})

    def test_currency_mismatch(self):
        self.bundles[2]['catalog']['exchangeMarketObservations'][0]['currency']='USD'
        reseal_dataset(self.bundles[2])
        self.reject('R2_CORE_REJECTED')

    def test_release_after_cutoff_and_exact_cutoff_equality(self):
        self.reject('RELEASE_AFTER_CUTOFF',cutoff='2021-11-15T16:01:59+08:00')
        r = self.run_gate(cutoff='2021-11-15T16:02:00+08:00')
        self.assertEqual(len(r['observations']),3)

    def test_cutoff_uses_aware_instants(self):
        self.assertEqual(self.run_gate(cutoff='2021-11-15T08:02:00Z')['observations'],
                         self.run_gate(cutoff='2021-11-15T16:02:00+08:00')['observations'])
        with self.assertRaises(ValueError): self.run_gate(cutoff='2021-11-22T08:00:00')
        with self.assertRaises(ValueError): self.run_gate(cutoff='2026-09-08T08:00:00+08:00')

    def test_no_release_lineage(self):
        self.bundles[2]['dataset']['releaseEvents']=[]
        reseal_dataset(self.bundles[2])
        self.reject('R2_CORE_REJECTED')

    def test_no_extraction_lineage(self):
        self.bundles[2]['dataset']['fieldExtractions']=[]
        reseal_dataset(self.bundles[2])
        self.reject('R2_CORE_REJECTED')

    def test_no_calendar(self):
        self.bundles[2]['plans'][0]['targetWindows'][0]['calendar']=None
        self.reject('R2_CORE_REJECTED')

    def test_unknown_component_keys_duplicate_and_wrong_exchange(self):
        saved = deepcopy(self.bundles)
        self.bundles[2]['admitted']=True
        self.reject('COMPONENT_BUNDLE_REQUIRED')
        self.bundles=deepcopy(saved)+[saved[2]]
        self.reject('DUPLICATE_EXCHANGE_BUNDLE')
        self.bundles=deepcopy(saved)
        self.bundles[2]['catalog']['exchangeMarketObservations'][0]['exchange']='SSE'
        reseal_dataset(self.bundles[2])
        self.reject('EXCHANGE_IDENTITY_MISMATCH')

    def test_bse_prelaunch_zero_and_marker_cannot_be_extra_component(self):
        self.day='2021-11-12'
        self.bundles=self.bundles[:2]
        self.approvals=[]
        for i in range(2): self.replace(i)
        marker=structurally_unavailable_exchange_observation(exchange='BSE',trade_date=self.day,source_definition_id='test-bse')
        for value in (None,0):
            extra={**marker,**{f:value for f in FIELDS}}
            self.bundles.append(extra)
            self.reject('COMPONENT_OUTSIDE_MARKET_SCOPE')
            self.bundles.pop()

    def test_byte_tampering_is_rejected_without_changing_metadata(self):
        a=self.bundles[2]['catalog']['artifacts'][0]
        (self.root/a['localPath']).write_bytes(b'X'+(self.root/a['localPath']).read_bytes()[1:])
        self.reject('sha256 bytes mismatch')

    def test_generated_timestamp_does_not_grant_admission(self):
        for b in self.bundles: b['dataset']['manifest']['generatedAt']='2030-01-01T00:00:00Z'
        self.reject('SOURCE_FIELD_ADMISSION_IDENTITY_MISSING',synthetic_admissions=None)
        self.assertEqual(len(self.run_gate()['observations']),3)

    def test_reseal_core_valid_changed_definition_cannot_reuse_review(self):
        self.bundles[2]['catalog']['sourceDefinitions'][0]['definitionSummary']='changed security membership'
        reseal_dataset(self.bundles[2])
        self.reject('SOURCE_FIELD_ADMISSION_IDENTITY_MISSING')

    def test_fixture_role_is_not_raw_admission(self):
        self.bundles[2]['catalog']['artifacts'][0]['artifactRole']='TEST_FIXTURE_EXCERPT'
        reseal_dataset(self.bundles[2])
        self.reject('R2_CORE_REJECTED')

    def test_ledger_flag_does_not_manufacture_missing_field(self):
        self.replace(2,missing=('negotiableMarketCap',))
        b=self.bundles[2]
        c=next(c for c in b['dataset']['coverageLedger'] if c['field']=='negotiableMarketCap')
        c.update(status='AVAILABLE',admittedObservationIds=[b['catalog']['exchangeMarketObservations'][0]['observationId']])
        reseal_dataset(b)
        self.reject('R2_CORE_REJECTED')

    def test_order_and_fixed_inputs_are_deterministic(self):
        first=self.run_gate()
        self.bundles.reverse()
        self.approvals.reverse()
        self.assertEqual(canonical_json_bytes(first),canonical_json_bytes(self.run_gate()))

    def test_aggregate_reseal_does_not_replace_value_or_component_lineage(self):
        r=self.run_gate()
        args=dict(trade_date=self.day,cutoff='2021-11-22T08:00:00+08:00',artifact_root=self.root,
                  synthetic_admissions=self.approvals)
        validate_aggregation(r,self.bundles,**args)
        for key,value in [('value',999),('components',[]),('releaseAvailableAt','2021-11-15T16:00:00+08:00')]:
            bad=deepcopy(r)
            bad['observations'][0][key]=value
            with self.assertRaisesRegex(ValueError,'AGGREGATION_REPLAY_MISMATCH'):
                validate_aggregation(seal(bad),self.bundles,**args)

    def test_genuine_zero_is_retained(self):
        for i in range(3): self.replace(i,amount=0)
        self.assertEqual([o['value'] for o in self.run_gate()['observations']],[0,0,0])


class RealReportTests(unittest.TestCase):
    def test_current_d1_report_replays_exactly_with_six_unadmitted_cells(self):
        r=build_report()
        validate_report(r)
        self.assertEqual(r,json.loads(REPORT_PATH.read_text(encoding='utf-8')))
        self.assertEqual(r['numericAggregateCount'],0)
        self.assertEqual(r['observations'],[])
        self.assertIsNone(r['dailyGrid'])
        self.assertIsNone(r['targetCount'])
        self.assertIsNone(r['coveragePercent'])
        self.assertEqual(len(r['admissionMatrix']),6)
        self.assertEqual(len(r['unadmittedWindows']),6)
        for row in r['admissionMatrix']:
            self.assertEqual(row['status'],'NOT_ADMITTED')
            self.assertIsNone(row['targetCount'])
            self.assertIsNone(row['coveragePercent'])
            self.assertEqual({b['exchange'] for b in row['blockers']},set(row['requiredExchanges']))
            if row['end']=='2021-11-14': self.assertNotIn('BSE',{b['exchange'] for b in row['blockers']})
            self.assertTrue(all('NO_FORMAL_EXCHANGE_OBSERVATIONS' in b['reasons'] for b in row['blockers']))
        self.assertEqual(r['syntheticValidation'],dict(included=False,historicalCoverage=0))

    def test_missing_inventory_cannot_shrink_scope(self):
        inv=load_inventories()
        del inv['BSE']
        with self.assertRaisesRegex(ValueError,'REQUIRED_D1_INVENTORY_SET'): build_report(inventories=inv)

    def test_candidate_and_resealed_inventory_cannot_promote_admission(self):
        for exchange in ('SSE','SZSE','BSE'):
            inv=load_inventories()
            inv[exchange]['exchangeMarketObservations']=[{**inv[exchange]['candidates'][0],'admitted':True}]
            inv[exchange]['contentSha256']=canonical_sha256(business_projection(inv[exchange]))
            with self.assertRaises(ValueError): build_report(inventories=inv)

    def test_d1_review_pin_rejects_resealed_unrelated_business_change(self):
        inv=load_inventories()
        inv['SSE']['probes'][0]['injected']='resealed'
        inv['SSE']['contentSha256']=canonical_sha256(business_projection(inv['SSE']))
        with self.assertRaises(ValueError): build_report(inventories=inv)

    def test_report_reseal_cannot_forge_numbers_denominator_or_status(self):
        r=build_report()
        for k,v in [('numericAggregateCount',1),('observations',[dict(value=1)]),('targetCount',5000),
                    ('dailyGrid',['2021-11-15']),('coveragePercent',100),('status','ADMITTED'),('invented',True)]:
            bad=deepcopy(r)
            bad[k]=v
            with self.assertRaisesRegex(ValueError,'REPORT_REPLAY_MISMATCH'): validate_report(seal(bad))
        bad=deepcopy(r)
        bad['admissionMatrix'][0]['requiredExchanges']=['SSE']
        with self.assertRaises(ValueError): validate_report(seal(bad))

    def test_report_business_hash_excludes_generation_only(self):
        r=build_report()
        other=build_report(generated_at='2030-01-01T00:00:00Z')
        self.assertEqual(r['contentSha256'],other['contentSha256'])
        validate_report(other)
        self.assertEqual(build_report(),r)

    def test_cli_idempotent_and_does_not_overwrite_changed_seal(self):
        with TemporaryDirectory() as temp, redirect_stdout(StringIO()):
            output=Path(temp)/'report.json'
            args=['--output',str(output)]
            self.assertEqual(main(['build',*args]),0)
            body=output.read_bytes()
            self.assertEqual(main(['build',*args]),0)
            self.assertEqual(main(['validate',*args]),0)
            self.assertEqual(body,output.read_bytes())
            output.write_text('{}',encoding='utf-8')
            self.assertEqual(main(['build',*args]),1)
            self.assertEqual(output.read_text(),'{}')


if __name__ == '__main__':
    unittest.main()
