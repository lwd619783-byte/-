"""SSE adversarial source tests. Fixtures never constitute historical coverage."""
import json
import unittest
from copy import deepcopy
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.market_regime.hashing import canonical_sha256, sha256_bytes
from scripts.market_regime.historical import artifact_identity, canonical_order, release_identity
from scripts.market_regime.sse_inventory import OUTPUT, load_contract, validate_compact
from scripts.market_regime.sse_source import (FIELDS, ROOT, SSEHistoricalMarketAdapter,
    assess_day, business_projection, calendar_inventory, parse_daily, replay_locator, strict_json)


FIXTURES = ROOT / 'scripts/tests/fixtures/market_regime'


class SSESourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = load_contract()
        cls.inventory = json.loads((ROOT / OUTPUT).read_text(encoding='utf-8'))
        cls.legacy = next(f for f in cls.contract['families'] if f['familyId'] == 'legacy-day')
        cls.daily = next(f for f in cls.contract['families'] if f['familyId'] == 'daily-day')

    def body(self, name='legacy-2020-02-03'):
        return (FIXTURES / ('sse-d1a-' + name + '.json')).read_bytes()

    def parse(self, body=None, family=None, day='2020-02-03'):
        return parse_daily(body or self.body(), family=family or self.legacy, requested_date=day, artifact_id='fixture')

    def mutate_rows(self, mutate):
        doc = strict_json(self.body())
        mutate(doc['result'])
        return json.dumps(doc, ensure_ascii=False).encode()

    def test_real_response_parser_keeps_a_and_star_separate(self):
        result = self.parse()
        self.assertEqual(len(result['candidates']), 6)
        self.assertEqual({c['scope'] for c in result['candidates']}, {'SSE_MAIN_BOARD_A','SSE_STAR'})
        self.assertEqual({r['boardCode'] for r in result['rejectedRows']}, {'2','12','40','43'})
        main = next(c for c in result['candidates'] if c['scope']=='SSE_MAIN_BOARD_A' and c['field']=='turnoverValue')
        self.assertEqual(main['rawValueText'], '2344.46')

    def test_mixed_total_alone_never_a(self):
        data = self.mutate_rows(lambda rows: rows.__setitem__(slice(None), [r for r in rows if r['PRODUCT_TYPE']=='40']))
        self.assertEqual(self.parse(data)['candidates'], [])

    def test_new_family_uses_named_keys_and_rejects_total_and_b(self):
        result = self.parse(self.body('daily-2026-09-04'), self.daily, '2026-09-04')
        self.assertEqual(len(result['candidates']), 6)
        self.assertEqual({r['boardCode'] for r in result['rejectedRows']}, {'02','11','17'})
        self.assertEqual({c['rawFieldName'] for c in result['candidates']}, {'TRADE_AMT','TOTAL_VALUE','NEGO_VALUE'})

    def test_early_response_has_no_invented_star_or_total(self):
        result = self.parse(self.body('legacy-2005-01-04'), day='2005-01-04')
        self.assertEqual(len(result['candidates']), 3)
        self.assertEqual({c['scope'] for c in result['candidates']}, {'SSE_MAIN_BOARD_A'})

    def test_missing_one_field_does_not_erase_two_other_candidates(self):
        data = self.mutate_rows(lambda rows: next(r for r in rows if r['PRODUCT_TYPE']=='1').pop('NEGOTIABLE_VALUE'))
        parsed = self.parse(data)
        status = assess_day('2020-02-03', parsed['candidates'], self.inventory['calendar'])
        self.assertIn('FIELD_MISSING:SSE_MAIN_BOARD_A', status['fields']['negotiableMarketCap']['blockers'])
        for f in ('turnoverValue','totalMarketCap'):
            self.assertFalse(any(b.startswith('FIELD_MISSING') for b in status['fields'][f]['blockers']))
        self.assertEqual(status['status'], 'PARTIAL')

    def test_no_fallback_from_negotiable_to_total_or_free_float(self):
        def change(rows):
            row = next(r for r in rows if r['PRODUCT_TYPE']=='1')
            del row['NEGOTIABLE_VALUE']
            row['FREE_FLOAT_VALUE'] = '100.00'
        parsed = self.parse(self.mutate_rows(change))
        c = next(c for c in parsed['candidates'] if c['scope']=='SSE_MAIN_BOARD_A' and c['field']=='negotiableMarketCap')
        self.assertIsNone(c['rawValueText'])
        self.assertEqual(c['status'], 'FIELD_MISSING')

    def test_zero_is_literal_but_dash_stays_missing(self):
        for token, expected in [('0','0'), ('-',None), ('',None), (None,None)]:
            with self.subTest(token=token):
                data = self.mutate_rows(lambda rows: next(r for r in rows if r['PRODUCT_TYPE']=='1').update(TX_AMOUNT=token))
                c = next(c for c in self.parse(data)['candidates'] if c['scope']=='SSE_MAIN_BOARD_A' and c['field']=='turnoverValue')
                self.assertEqual(c['rawValueText'], expected)

    def test_bad_numbers_fail_closed(self):
        for token in ['NaN','Infinity','-1','1,000','1e4',True,100]:
            with self.subTest(token=token), self.assertRaises(ValueError):
                self.parse(self.mutate_rows(lambda rows: next(r for r in rows if r['PRODUCT_TYPE']=='1').update(TX_AMOUNT=token)))

    def test_request_date_mismatch_is_not_latest_fallback(self):
        with self.assertRaisesRegex(ValueError, 'REQUEST_DATA_DATE_MISMATCH'):
            self.parse(day='2020-02-04')

    def test_monthly_wrong_family_and_pagination_rejected(self):
        for update in [dict(sqlId='MONTHLY'), dict(isPagination='true'), dict(actionErrors=['bad request'])]:
            doc = strict_json(self.body()); doc.update(update)
            with self.subTest(update=update), self.assertRaises(ValueError):
                self.parse(json.dumps(doc).encode())

    def test_duplicate_json_keys_and_nonfinite_rejected(self):
        for body in [b'{"result":[],"result":[]}', b'{"result":NaN}', b'<html>login</html>']:
            with self.subTest(body=body), self.assertRaises(ValueError):
                strict_json(body)

    def test_duplicate_or_conflicting_same_day_never_selects_first(self):
        for changed in [False,True]:
            doc = strict_json(self.body())
            row = deepcopy(next(r for r in doc['result'] if r['PRODUCT_TYPE']=='1'))
            if changed:
                row['TX_AMOUNT'] = '100'
            doc['result'].append(row)
            for rows in [doc['result'],list(reversed(doc['result']))]:
                doc['result'] = rows
                candidates = self.parse(json.dumps(doc).encode())['candidates']
                main = [c for c in candidates if c['scope']=='SSE_MAIN_BOARD_A']
                self.assertTrue(all(c['status']=='UNRESOLVED_RELEASE_CONFLICT' for c in main))

    def test_calendar_missing_holiday_and_nontrading_cannot_observe(self):
        parsed = self.parse()['candidates']
        for day, calendar, reason in [('2020-02-03',None,'OFFICIAL_CALENDAR_MISSING'),
                ('2020-01-31',self.inventory['calendar'],'OFFICIAL_NON_TRADING_DAY'),
                ('2020-02-01',self.inventory['calendar'],'OFFICIAL_NON_TRADING_DAY'),
                ('2020-02-02',self.inventory['calendar'],'OFFICIAL_NON_TRADING_DAY'),
                ('2026-09-04',self.inventory['calendar'],'OFFICIAL_CALENDAR_MISSING')]:
            for field in assess_day(day,parsed,calendar)['fields'].values():
                self.assertIn(reason,field['blockers'])
                self.assertEqual(field['admittedObservationIds'],[])

    def test_only_explicit_official_window_not_weekday_expansion(self):
        cfg = self.contract['calendar']
        with TemporaryDirectory() as directory:
            root = Path(directory); artifacts = {}
            for i,path in enumerate(sorted({p['fileName'] for p in cfg['proofs']})):
                body = ('OFFLINE SYNTHETIC CALENDAR\n'+'\n'.join(p['text'] for p in cfg['proofs'] if p['fileName']==path)).encode()
                (root/path).write_bytes(body)
                artifacts[str(i)] = dict(artifactId=str(i),fileName=path,localPath=path,sha256=sha256_bytes(body),byteSize=len(body))
            calendar = calendar_inventory(artifacts,cfg,root=root)
            self.assertEqual(calendar['openDates'],['2020-02-03'])
            self.assertEqual(calendar['closedDates'],['2020-01-31','2020-02-01','2020-02-02'])
            self.assertEqual(calendar['r2CalendarStatus'],'BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED')
            (root/cfg['proofs'][1]['fileName']).write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'CALENDAR_BYTES'):
                calendar_inventory(artifacts,cfg,root=root)

    def test_only_trade_date_never_strict_pit(self):
        status = assess_day('2020-02-03',self.parse()['candidates'],self.inventory['calendar'])
        for f in status['fields'].values():
            self.assertIn('PIT_VINTAGE_UNPROVEN',f['blockers'])
        adapter = SSEHistoricalMarketAdapter(self.inventory)
        self.assertIsNone(adapter.collect(date(2020,2,3)))
        self.assertEqual(self.inventory['releaseEvents'],[])

    def test_fixture_and_current_only_never_coverage(self):
        for role in ['TEST_FIXTURE_EXCERPT','CURRENT_ONLY']:
            result = assess_day('2020-02-03',self.parse()['candidates'],self.inventory['calendar'],evidence_role=role)
            self.assertTrue(all('NON_HISTORICAL_EVIDENCE' in f['blockers'] for f in result['fields'].values()))
        for p in json.loads((FIXTURES/'sse-d1a-fixtures.provenance.json').read_text()):
            self.assertFalse(p['historicalCoverageEligible'])
            self.assertEqual(sha256_bytes((ROOT/p['path']).read_bytes()),p['sha256'])

    def test_same_bytes_different_events_retain_identity(self):
        event = dict(sourceId='SSE_MARKET_STATS_OFFICIAL',landingUrl=self.legacy['landingUrl'],eventSection='first',
                     publicationDateTime='2020-02-03T18:00:00+08:00',publicationDate='2020-02-03',
                     releaseAvailableAt='2020-02-03T18:00:00+08:00',releaseConfidenceClass='EXACT_TIMESTAMP',
                     releaseKind='FIRST_RELEASE',coveredPeriods=['2020-02-03'])
        first = release_identity(event); event['eventSection']='second'
        second = release_identity(event)
        a = dict(sourceId=event['sourceId'],sourceUrl=event['landingUrl'],sha256=sha256_bytes(self.body()))
        self.assertNotEqual(first,second)
        self.assertNotEqual(artifact_identity(a,first),artifact_identity(a,second))

    def test_calendar_release_binding_extraction_scope_provenance_hash(self):
        baseline = canonical_sha256(business_projection(self.inventory))
        mutations = [lambda d:d['calendar'].update(openDates=['2020-01-31']),
                     lambda d:d['releaseEvents'].append({'test':'release'}),
                     lambda d:d['artifactBindings'][0].update(completeResponse=False),
                     lambda d:d['candidates'][0].update(rawValueText='999'),
                     lambda d:d['contract']['families'][0].update(boardScopes={'40':'A_ONLY'}),
                     lambda d:d['evidenceArtifacts'][0].update(fetchedAt='2026-09-10T00:00:00Z')]
        for change in mutations:
            copied=deepcopy(self.inventory);change(copied)
            self.assertNotEqual(canonical_sha256(business_projection(copied)),baseline)
        copied=deepcopy(self.inventory);copied['generatedAt']='2099-01-01T00:00:00Z'
        self.assertEqual(canonical_sha256(business_projection(copied)),baseline)
        for key in ('candidates','probes','evidenceArtifacts'):
            copied[key].reverse()
        self.assertEqual(canonical_sha256(business_projection(copied)),baseline)

    def test_tampered_calendar_or_coverage_cannot_be_resealed(self):
        for change in [lambda d:d['calendar'].update(openDates=['2020-01-31']),
                       lambda d:d['coverage']['fields']['turnoverValue'].update(availableCount=1),
                       lambda d:d['coverage'].update(officialTradingDayTargetCount=0),
                       lambda d:d.update(exchangeMarketObservations=[{'tradeDate':'2020-02-03'}])]:
            copied=deepcopy(self.inventory);change(copied)
            copied['contentSha256']=canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):validate_compact(copied)

    def test_resealed_false_calendar_and_summary_claims_are_rejected(self):
        for change in [lambda d:d['coverage'].update(status='PASS',unadmittedWindows=[]),
                       lambda d:d['coverage'].update(provenCalendarSubwindowTargetCount=999),
                       lambda d:d['calendar'].update(status='OFFICIAL_FULL_WINDOW',r2CalendarStatus='PASS'),
                       lambda d:d['coverage'].update(extraField='unknown')]:
            copied=deepcopy(self.inventory);change(copied)
            cal=copied['calendar']
            cal['contentSha256']=canonical_sha256(canonical_order({k:v for k,v in cal.items() if k!='contentSha256'}))
            copied['contentSha256']=canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):validate_compact(copied)

    def test_candidate_locator_replays_original_bytes_and_rejects_tamper(self):
        body=self.body();c=self.parse()['candidates'][0]
        with TemporaryDirectory() as directory:
            root=Path(directory);(root/'response.json').write_bytes(body)
            artifacts={'fixture':dict(localPath='response.json',sha256=sha256_bytes(body),byteSize=len(body))}
            self.assertIn(c['rawFieldName'],replay_locator(c['locator'],artifacts,root))
            (root/'response.json').write_bytes(body+b' ')
            with self.assertRaisesRegex(ValueError,'ARTIFACT_BYTES'):
                replay_locator(c['locator'],artifacts,root)

    def test_inventory_retains_full_frozen_target_with_unknown_denominator(self):
        validate_compact(self.inventory)
        coverage=self.inventory['coverage']
        self.assertEqual(coverage['fullTarget']['start'],'2005-01-01')
        self.assertEqual(coverage['fullTarget']['end'],'2026-09-04')
        self.assertIsNone(coverage['officialTradingDayTargetCount'])
        self.assertEqual(coverage['provenCalendarSubwindowTargetCount'],1)
        self.assertEqual(set(coverage['fields']),set(FIELDS))


if __name__ == '__main__':
    unittest.main()
