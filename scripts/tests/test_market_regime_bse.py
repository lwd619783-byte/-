"""BSE adversaries: identity, scope, date/family, PIT, calendar and anchored replay."""
import json
import unittest
from copy import deepcopy
from datetime import date
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from scripts.market_regime.bse_source import (
    ROOT, FIELDS, BSEHistoricalMarketAdapter, load_contract, parse_daily,
    assess_day, unwrap, strict_json, replay_locator, business_projection,
)
from scripts.market_regime.bse_inventory import OUTPUT, RAW, validate_compact, fetch, discovery, validate_request
from scripts.market_regime.hashing import canonical_sha256, sha256_bytes
from scripts.market_regime.validator import validate_catalog


class BSETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract=load_contract()
        cls.inv=strict_json((ROOT/OUTPUT).read_bytes())

    def body(self, day='2026-09-04'):
        return (ROOT/f'scripts/tests/fixtures/market_regime/bse-d1c-daily-{day}.jsonp').read_bytes()

    def parse(self, body=None, day='2026-09-04', family=None):
        return parse_daily(self.body() if body is None else body,requested_date=day,artifact_id='fixture',
                           family=self.contract['families'][0] if family is None else family)

    def changed(self, change):
        doc=strict_json(unwrap(self.body()));change(doc)
        return b'null('+json.dumps(doc,ensure_ascii=False).encode()+b')'

    def selected(self, doc):return next(r for r in doc if r['xxzrlx']=='2')

    def test_official_daily_preserves_exact_three_tokens_and_no_scope_sum(self):
        p=self.parse()
        self.assertEqual(len(p['candidates']),3)
        self.assertEqual(len(p['rejectedRows']),7)
        self.assertEqual({c['rawScope'] for c in p['candidates']},{'2'})
        self.assertEqual({c['field']:c['rawValueText'] for c in p['candidates']},
                         dict(turnoverValue='20618345986.47',totalMarketCap='867557008082.1',negotiableMarketCap='484437181103.89'))

    def test_launch_and_next_day_are_candidates_without_release(self):
        for day in ('2021-11-15','2021-11-16'):
            with self.subTest(day=day):
                p=self.parse(self.body(day),day)
                self.assertEqual(len(p['candidates']),3)
                self.assertTrue(all(c['status']=='CANDIDATE_ONLY' for c in p['candidates']))
                self.assertIsNone(BSEHistoricalMarketAdapter(self.inv).collect(day))

    def test_prelaunch_zero_and_selected_layer_splice_rejected(self):
        for day in ('2021-11-14','2021-11-12','2020-07-27'):
            with self.subTest(day=day),self.assertRaisesRegex(ValueError,'PRELAUNCH'):
                self.parse(b'null([{"xxzrlx":"2","rq":"'+day.replace('-','').encode()+
                           b'","hqcjje":0,"zsz":0,"ltsz":0}])',day)

    def test_structural_marker_is_r1_compatible_null_no_release(self):
        marker=BSEHistoricalMarketAdapter(self.inv).collect(date(2021,11,14))
        self.assertEqual(marker['qualityStatus'],'STRUCTURALLY_UNAVAILABLE')
        self.assertTrue(all(marker[f] is None for f in FIELDS))
        self.assertIsNone(marker['releaseAvailableAt'])
        catalog=strict_json((ROOT/'research-data/market-regime/catalog/observation-catalog.sample.v1.json').read_bytes())
        for f in FIELDS:
            copied=deepcopy(catalog)
            copied['exchangeMarketObservations'][0][f]=0
            self.assertTrue(any('不得伪造 BSE=0' in e for e in validate_catalog(copied)))

    def test_non_target_codes_and_total_labels_never_substitute(self):
        for scope in ('0','1','B','M','C','X','XJX','NEEQ','精选层','总计','BSE+NEEQ'):
            p=self.parse(self.changed(lambda d:self.selected(d).update(xxzrlx=scope)))
            self.assertEqual(p['candidates'],[])

    def test_missing_field_remains_missing_without_other_field_substitution(self):
        for key,field in [('hqcjje','turnoverValue'),('zsz','totalMarketCap'),('ltsz','negotiableMarketCap')]:
            p=self.parse(self.changed(lambda d:self.selected(d).pop(key)))
            missing=next(c for c in p['candidates'] if c['field']==field)
            self.assertEqual(missing['status'],'FIELD_MISSING')
            self.assertIsNone(missing['rawValueText'])
            self.assertEqual(sum(c['status']=='CANDIDATE_ONLY' for c in p['candidates']),2)

    def test_free_float_turnover_rate_security_count_not_target_field(self):
        for key in ('freeFloatMarketCap','turnoverRate','securityCount','total','pageNo'):
            with self.subTest(key=key),self.assertRaises(ValueError):
                self.parse(self.changed(lambda d:self.selected(d).update({key:100})))

    def test_literal_zero_differs_from_missing_and_invalid_numeric(self):
        for value in (0,None):
            p=self.parse(self.changed(lambda d:self.selected(d).update(ltsz=value)))
            c=next(c for c in p['candidates'] if c['field']=='negotiableMarketCap')
            self.assertEqual(c['rawValueText'],'0' if value==0 else None)
        for value in (-1,True,'0','NaN','Infinity','-',float('nan'),float('inf')):
            with self.subTest(value=value),self.assertRaises(ValueError):
                self.parse(self.changed(lambda d:self.selected(d).update(ltsz=value)))

    def test_duplicate_rows_or_revisions_never_select_by_order(self):
        for different in (False,True):
            def change(doc):
                row=deepcopy(self.selected(doc))
                if different:row['ltsz']=1
                doc.append(row)
            p=self.parse(self.changed(change))
            self.assertEqual(len(p['candidates']),6)
            self.assertTrue(all(c['status']=='UNRESOLVED_RELEASE_CONFLICT' for c in p['candidates']))
            for field in assess_day('2026-09-04',p['candidates'],None)['fields'].values():
                self.assertIn('UNRESOLVED_RELEASE_CONFLICT',field['blockers'])
                self.assertEqual(field['admittedObservationIds'],[])

    def test_wrong_response_date_and_unselected_row_date_reject(self):
        for change in (lambda d:self.selected(d).update(rq='20260903'),lambda d:d[0].update(rq='20260903')):
            with self.assertRaisesRegex(ValueError,'RESPONSE_DATE_MISMATCH'):
                self.parse(self.changed(change))

    def test_invalid_requested_dates_and_outside_window_reject(self):
        for day in ('20260904','2026-02-30','2026-09-05','2026-09-04T00:00:00Z'):
            with self.subTest(day=day),self.assertRaises(ValueError):self.parse(day=day)

    def test_wrong_family_or_units_or_scope_contract_reject(self):
        for change in (dict(familyId='weekly-report'),dict(selectedScope='B'),dict(rawUnit='万元'),
                       dict(fieldKeys=dict(turnoverValue='hqcjsl',totalMarketCap='zsz',negotiableMarketCap='zsz'))):
            with self.assertRaises(ValueError):self.parse(family={**self.contract['families'][0],**change})

    def test_jsonp_errors_duplicate_keys_and_pagination_fail_closed(self):
        for body in (b'<html>Access denied</html>',b'null({"page":0,"data":[]})',
                     b'null({"error":"timeout"})',b'callback([])',b'null([]);alert(1)',
                     b'null([{"rq":"20260904","rq":"20260903"}])',b'null([NaN])'):
            with self.subTest(body=body),self.assertRaises(ValueError):self.parse(body)

    def test_empty_holiday_response_is_not_calendar_or_source_absence(self):
        p=self.parse(self.body('2026-01-01'),'2026-01-01')
        self.assertEqual(p,dict(candidates=[],rejectedRows=[]))
        status=assess_day('2026-01-01',[],self.inv['calendar'])
        for f in status['fields'].values():self.assertIn('OFFICIAL_NON_TRADING_DAY',f['blockers'])
        for f in assess_day('2026-01-01',[],None)['fields'].values():
            self.assertIn('OFFICIAL_CALENDAR_MISSING',f['blockers'])

    def test_calendar_missing_and_release_missing_block_independently(self):
        for calendar in (None,self.inv['calendar']):
            status=assess_day('2021-11-15',self.parse(self.body('2021-11-15'),'2021-11-15')['candidates'],calendar)
            for f in status['fields'].values():
                self.assertIn('MARKET_RELEASE_MISSING',f['blockers'])
                self.assertIn('FIRST_RELEASE_AND_REVISION_ARCHIVE_UNPROVEN',f['blockers'])
                self.assertIn('OFFICIAL_CALENDAR_MISSING' if calendar is None else 'R2_CALENDAR_LITERAL_ISO_LOCATOR_UNAVAILABLE',f['blockers'])
                self.assertEqual(f['admittedObservationIds'],[])

    def test_fixture_current_data_cannot_count_as_historical(self):
        for role in ('TEST_FIXTURE_EXCERPT','CURRENT_ONLY'):
            for f in assess_day('2026-09-04',self.parse()['candidates'],None,evidence_role=role)['fields'].values():
                self.assertIn('NON_HISTORICAL_EVIDENCE',f['blockers'])
        self.assertEqual(next(p['status'] for p in self.inv['probes'] if p['requestId']=='home-data'),
                         'CURRENT_ONLY_NOT_HISTORICAL_CANDIDATE')

    def test_byte_locators_replay_and_reject_size_hash_bounds_path_tamper(self):
        body=self.body();candidate=self.parse()['candidates'][0]
        with TemporaryDirectory() as d:
            root=Path(d);(root/'r').write_bytes(body)
            artifacts={'fixture':dict(localPath='r',sha256=sha256_bytes(body),byteSize=len(body))}
            for key in ('locator','valueLocator'):self.assertTrue(replay_locator(candidate[key],artifacts,root))
            for delta in (dict(byteOffset=-1),dict(byteLength=0),dict(text='0')):
                with self.assertRaises(ValueError):replay_locator({**candidate['locator'],**delta},artifacts,root)
            for delta in (dict(localPath='../escape'),dict(byteSize=1),dict(sha256='0'*64)):
                with self.assertRaises(ValueError):replay_locator(candidate['locator'],{'fixture':{**artifacts['fixture'],**delta}},root)
            (root/'r').write_bytes(body+b' ')
            with self.assertRaises(ValueError):replay_locator(candidate['locator'],artifacts,root)

    def test_reseal_cannot_forge_any_derived_evidence_or_admission(self):
        mutations=[
            lambda d:d['coverage'].update(officialTradingDayTargetCount=0),
            lambda d:d['coverage']['fields']['turnoverValue'].update(availableCount=1),
            lambda d:d['coverage']['fields']['totalMarketCap'].update(strictPitCount=1),
            lambda d:d['candidates'][0].update(rawValueText='0'),
            lambda d:d['candidates'][0].update(scopeStatus='VERIFIED_BSE'),
            lambda d:d['candidates'].pop(),lambda d:d['rejectedRows'].pop(),
            lambda d:d['probes'][0].update(status='PASS'),
            lambda d:d['sourceResponses'][0].update(bodyText='null([]) '),
            lambda d:d['sourceResponses'].pop(),
            lambda d:d['sourceResponses'].append(deepcopy(d['sourceResponses'][0])),
            lambda d:d['admission'].update(blockers=[],formalCoverage=1),
            lambda d:d['calendar']['windows'][0].update(openDates=['2021-11-14']),
            lambda d:d['calendar'].update(status='PASS',officialTradingDayTargetCount=1200),
            lambda d:d['retrievalAttempts'][0].update(attemptedAt='2021-11-15T15:00:00+08:00'),
            lambda d:d['evidenceArtifacts'][0].update(artifactRole='TEST_FIXTURE_EXCERPT'),
            lambda d:d['discoveryEvidence'][0]['locator'].update(byteOffset=0),
            lambda d:d['auxiliaryEvidence'][0]['locator'].update(text='BSE=NEEQ'),
            lambda d:d['definitionBreaks'].pop(),
            lambda d:d.update(releaseEvents=[dict(releaseAvailableAt='2021-11-15T15:00:00+08:00')]),
            lambda d:d.update(exchangeMarketObservations=[dict(tradeDate='2021-11-14',turnoverValue=0)]),
            lambda d:d.update(fieldExtractions=[dict(field='turnoverValue')]),
            lambda d:d.update(unknown=True),
        ]
        for i,mutate in enumerate(mutations):
            copied=deepcopy(self.inv);mutate(copied)
            copied['contentSha256']=canonical_sha256(business_projection(copied))
            with self.subTest(mutation=i),self.assertRaises(ValueError):validate_compact(copied)

    def test_coordinated_reseal_cannot_replace_external_capture_anchor(self):
        copied=deepcopy(self.inv)
        for a in copied['evidenceArtifacts']:a['sha256']='0'*64
        copied['captureContentSha256']='0'*64
        copied['contract']['calendar']['officialTradingDayTargetCount']=1000
        copied['contractContentSha256']=canonical_sha256(copied['contract'])
        copied['contentSha256']=canonical_sha256(business_projection(copied))
        with self.assertRaises(ValueError):validate_compact(copied)

    def test_generation_time_excluded_and_business_arrays_order_independent(self):
        copied=deepcopy(self.inv);copied['generatedAt']='2030-01-01T00:00:00Z';copied['candidates'].reverse()
        self.assertEqual(canonical_sha256(business_projection(copied)),self.inv['contentSha256'])
        copied['candidates'][0]['rawValueText']='9'
        self.assertNotEqual(canonical_sha256(business_projection(copied)),self.inv['contentSha256'])

    def test_frozen_request_rejects_dates_pagination_family_and_neeq_url(self):
        j=next(j for j in self.contract['requests'] if j['requestId']=='daily-2026-09-04')
        for delta in (dict(form='HQJSRQ=20260903'),dict(form=j['form']+'&page=2'),dict(requestedDate='2026-09-03'),
                      dict(url=j['url'].replace('dailyReport','weeklyReport')),dict(url='https://www.neeq.com.cn/'),
                      dict(method='GET')):
            with self.subTest(delta=delta),self.assertRaises(ValueError):validate_request({**j,**delta},self.contract)

    def test_discovery_replays_actual_parent_bytes(self):
        j=next(j for j in self.contract['requests'] if j['requestId']=='daily-2026-09-04')
        with TemporaryDirectory() as d:
            root=Path(d);(root/RAW).mkdir(parents=True)
            proof_body=bytearray(b' '*max(p['byteOffset']+p['byteLength'] for p in j['proofs']))
            for p in j['proofs']:proof_body[p['byteOffset']:p['byteOffset']+p['byteLength']]=p['text'].encode()
            parent=next(j for j in self.contract['requests'] if j['requestId']=='daily-js')
            m=dict(url=parent['url'],finalUrl=parent['url'],status=200,path=(RAW/'daily-js.body').as_posix(),
                   sha256=sha256_bytes(proof_body),byteSize=len(proof_body))
            (root/RAW/'daily-js.body').write_bytes(proof_body)
            (root/RAW/'daily-js.json').write_text(json.dumps(m),encoding='utf-8')
            discovery(j,self.contract,root)
            (root/RAW/'daily-js.body').write_bytes(proof_body+b'x')
            with self.assertRaises(ValueError):discovery(j,self.contract,root)

    def test_fetch_retains_http_and_transport_failure_no_source_absent(self):
        for kind in ('http','transport','error-page'):
            c=deepcopy(self.contract);c['requests']=[c['requests'][0]];j=c['requests'][0]
            opener=Mock();body=b'<html>Access denied: SYNTHETIC TEST</html>'
            if kind=='http':opener.open.side_effect=HTTPError(j['url'],503,'Unavailable',{'Content-Type':'text/html'},BytesIO(body))
            elif kind=='transport':opener.open.side_effect=TimeoutError('synthetic')
            else:
                r=BytesIO(body);r.url=j['url'];r.status=200;r.headers={'Content-Type':'text/html'};opener.open.return_value=r
            with TemporaryDirectory() as d,patch('scripts.market_regime.bse_inventory.load_contract',return_value=c),patch('scripts.market_regime.bse_inventory.build_opener',return_value=opener):
                root=Path(d);fetch(root=root)
                p=root/RAW/'home.json';before=p.read_bytes();m=json.loads(before)
                if kind=='transport':self.assertEqual(m['error'],'TimeoutError');self.assertNotIn('path',m)
                else:self.assertEqual(m['status'],503 if kind=='http' else 200);self.assertEqual(m['sha256'],sha256_bytes(body))
                fetch(root=root);self.assertEqual(before,p.read_bytes());opener.open.assert_called_once()

    def test_inventory_replay_preserves_unknown_denominator_and_zero_admission(self):
        validate_compact(self.inv)
        self.assertEqual(self.inv['coverage']['fullTarget']['start'],'2021-11-15')
        self.assertEqual(self.inv['coverage']['fullTarget']['end'],'2026-09-04')
        self.assertIsNone(self.inv['coverage']['officialTradingDayTargetCount'])
        self.assertEqual(self.inv['coverage']['provenCalendarSubwindowTargetCount'],2)
        for f in self.inv['coverage']['fields'].values():
            self.assertEqual(f['candidateDateCount'],8);self.assertEqual(f['availableCount'],0);self.assertEqual(f['strictPitCount'],0)
        self.assertEqual(self.inv['releaseEvents'],[])

    def test_mid_response_timeout_and_size_bound_preserve_retrieval_failure(self):
        c=deepcopy(self.contract);c['requests']=[c['requests'][0]];c['acquisition']['maxResponseBytes']=10
        for reason in ('TimeoutError','RESPONSE_TOO_LARGE'):
            r=Mock();r.url=c['requests'][0]['url'];r.status=200;r.headers={'Content-Type':'text/html'}
            r.__enter__=Mock(return_value=r);r.__exit__=Mock(return_value=False)
            if reason=='TimeoutError':r.read.side_effect=TimeoutError('synthetic')
            else:r.read.return_value=b'x'*11
            opener=Mock();opener.open.return_value=r
            with TemporaryDirectory() as d,patch('scripts.market_regime.bse_inventory.load_contract',return_value=c),patch('scripts.market_regime.bse_inventory.build_opener',return_value=opener):
                root=Path(d);result=fetch(root=root)
                m=json.loads((root/RAW/'home.json').read_text())
                self.assertEqual(result[0]['status'],reason);self.assertEqual(m['error'],reason)
                self.assertEqual(m['status'],200);self.assertNotIn('path',m)
                self.assertFalse((root/RAW/'home.body').exists())


if __name__=='__main__':unittest.main()
