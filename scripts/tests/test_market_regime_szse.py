"""SZSE source adversaries: parsed candidates never establish historical coverage."""
import json
import unittest
from copy import deepcopy
from datetime import date
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from scripts.market_regime.hashing import canonical_sha256, sha256_bytes
from scripts.market_regime.historical import canonical_order
from scripts.market_regime.szse_inventory import RAW, OUTPUT, discovery, fetch, load_contract, validate_compact
from scripts.market_regime.szse_source import (
    FIELDS, ROOT, SZSEHistoricalMarketAdapter, assess_day, business_projection,
    parse_daily, replay_locator, strict_json,
)


FIXTURES = ROOT / 'scripts/tests/fixtures/market_regime'


class SZSESourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = load_contract()
        cls.family = cls.contract['families'][0]
        cls.inventory = json.loads((ROOT / OUTPUT).read_text(encoding='utf-8'))

    def body(self, day='2026-09-04'):
        return (FIXTURES / ('szse-d1b-daily-' + day + '.json')).read_bytes()

    def parse(self, body=None, day='2026-09-04', family=None):
        return parse_daily(self.body() if body is None else body,
                          family=self.family if family is None else family,
                          requested_date=day, artifact_id='fixture')

    def mutate(self, change):
        document = strict_json(self.body())
        change(document)
        return json.dumps(document, ensure_ascii=False).encode('utf-8')

    @staticmethod
    def tab(document):
        return next(t for t in document if t['metadata']['tabkey'] == 'tab1')

    def main(self, document):
        return next(r for r in self.tab(document)['data'] if r['lbmc'].endswith('主板A股'))

    @staticmethod
    def field(candidates, field):
        return next(c for c in candidates if c['scope'] == 'SZSE_MAIN_A' and c['field'] == field)

    def test_official_payload_keeps_main_and_chinext_separate(self):
        parsed = self.parse()
        self.assertEqual(len(parsed['candidates']), 6)
        self.assertEqual({c['scope'] for c in parsed['candidates']}, {'SZSE_MAIN_A', 'SZSE_CHINEXT_A'})
        self.assertEqual({c['field'] for c in parsed['candidates']}, set(FIELDS))
        self.assertTrue(all(c['status'] == 'CANDIDATE_ONLY' for c in parsed['candidates']))
        self.assertTrue(parsed['rejectedRows'])

    def test_mixed_stock_total_and_b_share_never_a_only(self):
        body = self.mutate(lambda d: self.tab(d).update(data=[
            r for r in self.tab(d)['data'] if r['lbmc'] == '股票' or r['lbmc'].endswith('主板B股')]))
        parsed = self.parse(body)
        self.assertEqual(parsed['candidates'], [])
        self.assertEqual(len(parsed['rejectedRows']), 2)

    def test_unknown_scope_is_rejected_without_silent_mapping(self):
        body = self.mutate(lambda d: self.main(d).update(lbmc='主板和创业板A股合计'))
        parsed = self.parse(body)
        self.assertNotIn('SZSE_MAIN_A', {c['scope'] for c in parsed['candidates']})
        self.assertGreater(len(parsed['rejectedRows']), 0)

    def test_missing_field_keeps_other_field_candidates(self):
        parsed = self.parse(self.mutate(lambda d: self.main(d).pop('ltsz')))
        self.assertIsNone(self.field(parsed['candidates'], 'negotiableMarketCap')['rawValueText'])
        self.assertEqual(self.field(parsed['candidates'], 'negotiableMarketCap')['status'], 'FIELD_MISSING')
        for field in ('turnoverValue', 'totalMarketCap'):
            self.assertEqual(self.field(parsed['candidates'], field)['status'], 'CANDIDATE_ONLY')
            self.assertIsNotNone(self.field(parsed['candidates'], field)['rawValueText'])

    def test_total_negotiable_and_free_float_never_substitute(self):
        def change(document):
            row = self.main(document)
            row.pop('ltsz')
            row['freeFloatMarketCap'] = '123.00'
        candidates = self.parse(self.mutate(change))['candidates']
        self.assertIsNone(self.field(candidates, 'negotiableMarketCap')['rawValueText'])
        self.assertIsNotNone(self.field(candidates, 'totalMarketCap')['rawValueText'])

    def test_literal_zero_and_missing_tokens_remain_distinct(self):
        for token in ('0', '0.00', '-', '--', '', None):
            with self.subTest(token=token):
                candidates = self.parse(self.mutate(lambda d: self.main(d).update(cjje=token)))['candidates']
                candidate = self.field(candidates, 'turnoverValue')
                self.assertEqual(candidate['status'], 'CANDIDATE_ONLY' if token in ('0', '0.00') else 'FIELD_MISSING')
                self.assertEqual(candidate['rawValueText'] is None, token not in ('0', '0.00'))

    def test_bad_numeric_tokens_fail_closed(self):
        for token in ('NaN', 'Infinity', '-1', '1e4', '1,23.00', '1,234,56', True, 100):
            with self.subTest(token=token), self.assertRaises(ValueError):
                self.parse(self.mutate(lambda d: self.main(d).update(cjje=token)))

    def test_same_day_duplicates_and_conflicts_never_choose_fetch_order(self):
        for changed in (False, True):
            document = strict_json(self.body())
            row = deepcopy(self.main(document))
            if changed:
                row['cjje'] = '100.00'
            self.tab(document)['data'].append(row)
            for reverse in (False, True):
                if reverse:
                    self.tab(document)['data'].reverse()
                candidates = self.parse(json.dumps(document, ensure_ascii=False).encode())['candidates']
                main = [c for c in candidates if c['scope'] == 'SZSE_MAIN_A']
                self.assertEqual(len(main), 6)
                self.assertTrue(all(c['status'] == 'UNRESOLVED_RELEASE_CONFLICT' for c in main))

    def test_requested_date_mismatch_rejects_latest_fallback(self):
        with self.assertRaises(ValueError):
            self.parse(day='2026-09-03')

    def test_invalid_requested_date_is_rejected(self):
        for day in ('2026-02-30', '20260904', '', '2026-09-04T00:00:00Z'):
            with self.subTest(day=day), self.assertRaises(ValueError):
                self.parse(day=day)

    def test_wrong_catalog_and_non_daily_tab_are_rejected(self):
        for key, value in [('catalogid', '1803_monthly'), ('tabkey', 'tab9')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.parse(self.mutate(lambda d: self.tab(d)['metadata'].update({key: value})))

    def test_response_error_malformed_payload_and_duplicate_tabs_rejected(self):
        for body in (b'{}', b'null', b'[]', b'<html>access denied</html>',
                     self.mutate(lambda d: self.tab(d).update(error='failed')),
                     self.mutate(lambda d: d.append(deepcopy(self.tab(d)))),
                     self.mutate(lambda d: self.tab(d).update(data={})),
                     self.mutate(lambda d: self.tab(d)['data'].append(None))):
            with self.subTest(body=body[:60]), self.assertRaises((ValueError, TypeError)):
                self.parse(body)

    def test_duplicate_json_keys_and_nonfinite_rejected(self):
        for body in (b'{"data":[],"data":[]}', b'{"data":NaN}', b'{"data":Infinity}'):
            with self.subTest(body=body), self.assertRaises(ValueError):
                strict_json(body)

    def test_pagination_cannot_claim_complete_payload(self):
        for key, value in [('pagecount', 2), ('pageno', 2), ('pagesize', 20)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.parse(self.mutate(lambda d: self.tab(d)['metadata'].update({key: value})))

    def test_field_header_semantics_and_units_cannot_drift(self):
        for key, value in [('ltsz', '自由流通市值<br>(亿元)'), ('sjzz', '流通市值<br>(亿元)'),
                           ('cjje', '成交金额<br>(万元)')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.parse(self.mutate(lambda d: self.tab(d)['metadata']['cols'].update({key: value})))

    def test_only_trade_date_never_creates_strict_pit(self):
        assessment = assess_day('2026-09-04', self.parse()['candidates'], self.inventory['calendar'])
        for field in assessment['fields'].values():
            self.assertIn('PIT_VINTAGE_UNPROVEN', field['blockers'])
            self.assertEqual(field['admittedObservationIds'], [])
        adapter = SZSEHistoricalMarketAdapter(self.inventory)
        self.assertIsNone(adapter.collect(date(2026, 9, 4)))
        self.assertEqual(self.inventory['releaseEvents'], [])
        self.assertEqual(self.inventory['exchangeMarketObservations'], [])

    def test_missing_calendar_never_admits(self):
        assessment = assess_day('2026-09-04', self.parse()['candidates'], None)
        for field in assessment['fields'].values():
            self.assertIn('OFFICIAL_CALENDAR_MISSING', field['blockers'])
            self.assertEqual(field['admittedObservationIds'], [])

    def test_calendar_closed_dates_never_admit(self):
        calendar = self.inventory['calendar']
        self.assertTrue(calendar['closedDates'])
        for day in calendar['closedDates']:
            for field in assess_day(day, [], calendar)['fields'].values():
                self.assertIn('OFFICIAL_NON_TRADING_DAY', field['blockers'])
                self.assertEqual(field['admittedObservationIds'], [])

    def test_fixture_and_current_only_never_historical_coverage(self):
        for role in ('TEST_FIXTURE_EXCERPT', 'CURRENT_ONLY'):
            assessment = assess_day('2026-09-04', self.parse()['candidates'], self.inventory['calendar'], evidence_role=role)
            for field in assessment['fields'].values():
                self.assertIn('NON_HISTORICAL_EVIDENCE', field['blockers'])
                self.assertEqual(field['admittedObservationIds'], [])

    def test_locator_replays_original_utf8_bytes_and_rejects_tamper(self):
        body = self.body()
        candidate = self.parse()['candidates'][0]
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'response.json').write_bytes(body)
            artifacts = {'fixture': dict(localPath='response.json', sha256=sha256_bytes(body), byteSize=len(body))}
            self.assertTrue(replay_locator(candidate['locator'], artifacts, root))
            (root / 'response.json').write_bytes(body + b' ')
            with self.assertRaises(ValueError):
                replay_locator(candidate['locator'], artifacts, root)

    def test_resealed_false_coverage_or_observation_is_rejected(self):
        mutations = [
            lambda d: d['coverage']['fields']['turnoverValue'].update(availableCount=1),
            lambda d: d['coverage']['fields']['totalMarketCap'].update(strictPitCount=1),
            lambda d: d['coverage'].update(officialTradingDayTargetCount=0),
            lambda d: d['coverage'].update(status='PASS'),
            lambda d: d['coverage'].update(extraField='unknown'),
            lambda d: d.update(exchangeMarketObservations=[{'tradeDate': '2026-09-04'}]),
            lambda d: d.update(releaseEvents=[{'releaseAvailableAt': '2026-09-04T18:00:00+08:00'}]),
        ]
        for mutate in mutations:
            copied = deepcopy(self.inventory)
            mutate(copied)
            copied['contentSha256'] = canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):
                validate_compact(copied)

    def test_resealed_calendar_cannot_override_external_contract(self):
        for mutate in (lambda c: c.update(openDates=['2005-01-01']),
                       lambda c: c.update(status='OFFICIAL_FULL_WINDOW', r2CalendarStatus='PASS')):
            copied = deepcopy(self.inventory)
            mutate(copied['calendar'])
            copied['calendar']['contentSha256'] = canonical_sha256(canonical_order({
                k: v for k, v in copied['calendar'].items() if k != 'contentSha256'}))
            copied['contentSha256'] = canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):
                validate_compact(copied)

    def test_business_hash_binds_data_and_excludes_generation_time(self):
        baseline = canonical_sha256(business_projection(self.inventory))
        copied = deepcopy(self.inventory)
        copied['generatedAt'] = '2099-01-01T00:00:00Z'
        copied['candidates'].reverse()
        self.assertEqual(canonical_sha256(business_projection(copied)), baseline)
        copied['candidates'][0]['rawValueText'] = '999'
        self.assertNotEqual(canonical_sha256(business_projection(copied)), baseline)

    def test_resealed_candidate_rejection_or_probe_cannot_override_replay(self):
        mutations = [
            lambda d: d['candidates'][0].update(rawValueText='999'),
            lambda d: d['candidates'][0].update(scope='SZSE_A_ONLY'),
            lambda d: d['candidates'][0].update(status='VERIFIED'),
            lambda d: d['candidates'].pop(),
            lambda d: d['candidates'].append(deepcopy(d['candidates'][0])),
            lambda d: d['rejectedRows'][0].update(reason='ACCEPTED_A_ONLY'),
            lambda d: d['rejectedRows'].pop(),
            lambda d: d['probes'][0].update(status='HISTORICAL_COVERAGE_PASS'),
            lambda d: d['probes'].pop(),
        ]
        for mutate in mutations:
            copied = deepcopy(self.inventory)
            mutate(copied)
            copied['contentSha256'] = canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):
                validate_compact(copied)

    def test_resealed_source_response_bytes_and_membership_are_checked(self):
        for mutate in (
            lambda d: d['sourceResponses'][0].update(bodyText=d['sourceResponses'][0]['bodyText'] + ' '),
            lambda d: d['sourceResponses'].pop(),
            lambda d: d['sourceResponses'].append(deepcopy(d['sourceResponses'][0])),
            lambda d: d['sourceResponses'][0].update(artifactId=d['sourceResponses'][1]['artifactId']),
        ):
            copied = deepcopy(self.inventory)
            mutate(copied)
            copied['contentSha256'] = canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):
                validate_compact(copied)

    def test_resealed_admission_summary_cannot_override_zero(self):
        for update in (dict(status='ADMITTED'), dict(formalCoverage=1), dict(strictPitCoverage=1),
                       dict(blockers=[]), dict(extraField='unknown')):
            copied = deepcopy(self.inventory)
            copied['admission'].update(update)
            copied['contentSha256'] = canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):
                validate_compact(copied)

    def test_resealed_binding_validation_and_locator_identity_are_checked(self):
        for mutate in (
            lambda d: d['artifactBindings'][0].update(contentValidation='ERROR_PAGE'),
            lambda d: d['artifactBindings'][0]['contentEvidence'].update(
                artifactId=d['artifactBindings'][1]['artifactId']),
            lambda d: d['artifactBindings'][0]['contentEvidence'].update(byteOffset=99999999),
        ):
            copied = deepcopy(self.inventory)
            mutate(copied)
            copied['contentSha256'] = canonical_sha256(business_projection(copied))
            with self.assertRaises(ValueError):
                validate_compact(copied)

    def test_historical_break_fixtures_preserve_observed_scope_partitions(self):
        for day, scopes in (
            ('2009-10-29', {'SZSE_MAIN_A', 'SZSE_SME_A'}),
            ('2009-10-30', {'SZSE_MAIN_A', 'SZSE_SME_A', 'SZSE_CHINEXT_A'}),
            ('2021-04-02', {'SZSE_MAIN_A', 'SZSE_SME_A', 'SZSE_CHINEXT_A'}),
            ('2021-04-06', {'SZSE_MAIN_A', 'SZSE_CHINEXT_A'}),
        ):
            with self.subTest(day=day):
                candidates = self.parse(self.body(day), day=day)['candidates']
                self.assertEqual({c['scope'] for c in candidates}, scopes)
                self.assertEqual(len(candidates), len(scopes) * len(FIELDS))

    def test_old_board_labels_are_not_independent_a_membership_proof(self):
        day = '2009-10-30'
        candidates = self.parse(self.body(day), day=day)['candidates']
        for candidate in candidates:
            expected = ('EXPLICIT_A_LABEL' if candidate['scope'] == 'SZSE_MAIN_A'
                        else 'BOARD_LABEL_ONLY_A_MEMBERSHIP_UNPROVEN')
            self.assertEqual(candidate['scopeEvidenceStatus'], expected)
        assessment = assess_day(day, candidates, self.inventory['calendar'])
        for field in assessment['fields'].values():
            for scope in ('SZSE_SME_A', 'SZSE_CHINEXT_A'):
                self.assertIn('UNPROVEN_A_MEMBERSHIP:' + scope, field['blockers'])
            self.assertEqual(field['admittedObservationIds'], [])
        current = self.parse()['candidates']
        self.assertTrue(all(c['scopeEvidenceStatus'] == 'EXPLICIT_A_LABEL' for c in current))

    def test_early_empty_response_is_not_an_invented_historical_day(self):
        parsed = self.parse(self.body('2005-01-04'), day='2005-01-04')
        self.assertEqual(parsed, dict(candidates=[], rejectedRows=[]))
        for field in assess_day('2005-01-04', [], self.inventory['calendar'])['fields'].values():
            self.assertEqual(field['admittedObservationIds'], [])
            self.assertIn('OFFICIAL_CALENDAR_MISSING', field['blockers'])

    def test_secondary_family_migration_is_retained_as_failure_not_reinterpreted(self):
        probes = {p['requestId']: p for p in self.inventory['probes']}
        responses = {r['requestId']: r for r in self.inventory['sourceResponses']}
        for name in ('stock-2005-01-04', 'stock-2021-04-02'):
            with self.subTest(request=name):
                self.assertEqual(probes[name]['status'], 'PARSER_FAILED')
                self.assertEqual(probes[name]['error'], 'WRONG_SOURCE_FAMILY')
                document = strict_json(responses[name]['bodyText'].encode('utf-8'))
                self.assertEqual(document[0]['metadata']['catalogid'], 'scsj_gprdgk')
                self.assertFalse(any(c['locator']['artifactId'] == responses[name]['artifactId']
                                     for c in self.inventory['candidates']))
        self.assertEqual(probes['stock-2021-04-06']['status'],
                         'EVIDENCE_ONLY_MIXED_SCOPE_AND_UNPROVEN_RESPONSE_DATE')
        self.assertIsNone(probes['stock-2021-04-06']['error'])

    def test_chinext_before_launch_and_sme_after_merger_fail_closed(self):
        for day, label in (('2009-10-29', '创业板'), ('2021-04-06', '中小板')):
            document = strict_json(self.body(day))
            row = deepcopy(self.main(document))
            row['lbmc'] = label
            self.tab(document)['data'].append(row)
            with self.subTest(day=day), self.assertRaises(ValueError):
                self.parse(json.dumps(document, ensure_ascii=False).encode(), day=day)

    def test_committed_fixture_provenance_never_claims_historical_eligibility(self):
        provenance = json.loads((FIXTURES / 'szse-d1b-fixtures.provenance.json').read_text(encoding='utf-8'))
        self.assertTrue(provenance)
        for fixture in provenance:
            self.assertEqual(fixture['historicalCoverage'], 0)
            self.assertEqual(fixture['artifactRole'], 'TEST_FIXTURE_EXCERPT')
            self.assertEqual(len((ROOT / fixture['path']).read_bytes()), fixture['byteSize'])
            self.assertEqual(sha256_bytes((ROOT / fixture['path']).read_bytes()), fixture['sha256'])

    def test_discovery_replays_parent_before_rejecting_date_and_pagination_tamper(self):
        contract = self.contract
        job = next(j for j in contract['requests'] if j['requestId'] == 'daily-2026-09-04')
        parent = next(r for r in self.inventory['sourceResponses'] if r['requestId'] == 'overview-current')
        artifact = next(a for a in self.inventory['evidenceArtifacts'] if a['artifactId'] == parent['artifactId'])
        parent_job = next(j for j in contract['requests'] if j['requestId'] == parent['requestId'])
        with TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / RAW
            folder.mkdir(parents=True)
            body = parent['bodyText'].encode('utf-8')
            (folder / 'overview-current.body').write_bytes(body)
            record = dict(url=parent_job['url'], finalUrl=parent_job['url'], status=200,
                          path=(RAW / 'overview-current.body').as_posix(),
                          sha256=sha256_bytes(body), byteSize=len(body), fetchedAt=artifact['fetchedAt'])
            (folder / 'overview-current.json').write_text(json.dumps(record), encoding='utf-8')
            discovery(job, contract, root)
            mutations = [
                dict(url=job['url'].replace('2026-09-04', '2026-09-03')),
                dict(requestedDate='2026-09-03'),
                dict(url=job['url'] + '&PAGENO=2'),
                dict(url=job['url'] + '&txtQueryDate=2026-09-04'),
                dict(url=job['url'].replace('1803_sczm', 'unknown_monthly')),
            ]
            for change in mutations:
                altered = {**job, **change}
                with self.subTest(change=change), self.assertRaises(ValueError):
                    discovery(altered, contract, root)
            (folder / 'overview-current.body').write_bytes(body + b' ')
            with self.assertRaises(ValueError):
                discovery(job, contract, root)

    def test_fetch_cache_preserves_original_network_acquisition_without_refetch(self):
        contract = deepcopy(self.contract)
        contract['requests'] = [contract['requests'][0]]
        job = contract['requests'][0]
        body = b'OFFLINE SYNTHETIC RESPONSE: no historical coverage'
        response = BytesIO(body)
        response.url = job['url']
        response.status = 200
        response.headers = {'Content-Type': 'text/html'}
        opener = Mock()
        opener.open.return_value = response
        with TemporaryDirectory() as directory, \
                patch('scripts.market_regime.szse_inventory.load_contract', return_value=contract), \
                patch('scripts.market_regime.szse_inventory.build_opener', return_value=opener):
            root = Path(directory)
            self.assertEqual(fetch(root=root)[0]['status'], 200)
            path = root / RAW / (job['requestId'] + '.json')
            first = path.read_bytes()
            self.assertEqual(fetch(root=root)[0]['status'], 'CACHE_VERIFIED')
            self.assertEqual(path.read_bytes(), first)
            self.assertEqual((root / RAW / (job['requestId'] + '.body')).read_bytes(), body)
            opener.open.assert_called_once()

    def test_http_error_keeps_failure_bytes_and_cache_never_refetches(self):
        contract = deepcopy(self.contract)
        contract['requests'] = [contract['requests'][0]]
        job = contract['requests'][0]
        body = b'OFFLINE SYNTHETIC 503 unavailable'
        error = HTTPError(job['url'], 503, 'Unavailable', {'Content-Type': 'text/html'}, BytesIO(body))
        opener = Mock()
        opener.open.side_effect = error
        with TemporaryDirectory() as directory, \
                patch('scripts.market_regime.szse_inventory.load_contract', return_value=contract), \
                patch('scripts.market_regime.szse_inventory.build_opener', return_value=opener):
            root = Path(directory)
            self.assertEqual(fetch(root=root)[0]['status'], 503)
            path = root / RAW / (job['requestId'] + '.json')
            first = path.read_bytes()
            record = json.loads(first)
            self.assertEqual(record['status'], 503)
            self.assertEqual(record['sha256'], sha256_bytes(body))
            self.assertEqual(record['byteSize'], len(body))
            self.assertEqual((root / RAW / (job['requestId'] + '.body')).read_bytes(), body)
            fetch(root=root)
            self.assertEqual(path.read_bytes(), first)
            opener.open.assert_called_once()

    def test_full_target_is_preserved_with_unknown_official_denominator(self):
        validate_compact(self.inventory)
        coverage = self.inventory['coverage']
        self.assertEqual(coverage['fullTarget']['start'], '2005-01-01')
        self.assertEqual(coverage['fullTarget']['end'], '2026-09-04')
        self.assertIsNone(coverage['officialTradingDayTargetCount'])
        self.assertEqual(set(coverage['fields']), set(FIELDS))
        for field in coverage['fields'].values():
            self.assertEqual(field['availableCount'], 0)
            self.assertEqual(field['strictPitCount'], 0)
            self.assertEqual(field['historicalAdmittedWindows'], [])


if __name__ == '__main__':
    unittest.main()
