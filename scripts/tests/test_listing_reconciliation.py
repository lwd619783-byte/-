import copy
import datetime as dt
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from scripts.listing.probe_listing import PLAN, ROOT, OfficialRedirect, current_private_ids, official, read_plan, reconcile, replay_fetcher


class ListingReconciliationTest(unittest.TestCase):
    def setUp(self):
        self.target = read_plan()[0]
        self.fetcher = replay_fetcher(self.target)
        self.raw = self.fetcher(self.target['sourceUrl'])[1]
        self.date = dt.date(2026, 9, 18)

    def run_probe(self, raw=None, target=None, final_url=None):
        return reconcile(target or self.target, lambda _: (final_url or self.target['sourceUrl'], self.raw if raw is None else raw), self.date)

    def test_retained_positive_stale_private_detection_and_exact_identity(self):
        result = self.run_probe()
        self.assertEqual(result['status'], 'LISTED_MIGRATION_REQUIRED', result)
        self.assertEqual(result['candidate'], self.target['reviewedMapping'])
        self.assertEqual(result['candidate']['id'], 'unitree')
        self.assertEqual(result['candidate']['code'], '688836')
        self.assertEqual(result['candidate']['listingDate'], '2026-08-19')
        self.assertTrue(result['readOnly'])
        self.assertFalse(result['automaticMigration'])
        self.assertIsNone(result['releaseAvailableAt'])

    def test_probe_readonly_does_not_change_sources_or_universe(self):
        paths = [ROOT / 'src/data/privateCompanies.ts', ROOT / 'src/data/stocks.ts',
                 ROOT / 'src/utils/symbol.ts', ROOT / 'src/data/real/stock-universe.generated.json']
        before = [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths]
        self.run_probe()
        self.assertEqual(before, [hashlib.sha256(path.read_bytes()).hexdigest() for path in paths])

    def test_exact_legal_name_mismatch_does_not_bind_abbreviation(self):
        target = copy.deepcopy(self.target)
        target['legalName'] = '另一家宇树科技股份有限公司'
        result = self.run_probe(target=target)
        self.assertEqual(result['status'], 'IDENTITY_CONFLICT')
        self.assertIsNone(result['candidate'])

    def test_same_name_different_code_is_identity_conflict(self):
        result = self.run_probe(self.raw.replace(b'688836', b'688999'))
        self.assertEqual(result['status'], 'IDENTITY_CONFLICT')
        self.assertIsNone(result['candidate'])

    def test_date_or_exchange_mismatch_is_identity_conflict(self):
        for source, change in [('2026年8月19日', '2026年8月20日'), ('本所科创板', '本所主板'), ('证券简称为"宇树科技"', '证券简称为"其他公司"')]:
            result = self.run_probe(self.raw.replace(source.encode(), change.encode()))
            self.assertEqual(result['status'], 'IDENTITY_CONFLICT', result)
            self.assertIsNone(result['candidate'])

    def test_ambiguous_tickers_and_missing_field_fail_closed(self):
        for replacement in ['688836"; 证券代码为"688999'.encode(), b'']:
            self.assertEqual(self.run_probe(self.raw.replace(b'688836', replacement))['status'], 'IDENTITY_CONFLICT')

    def test_nonofficial_source_and_redirect_fail_closed(self):
        for url in ['http://www.sse.com.cn/disclosure/announcement/a', 'https://www.sse.com.cn.evil.test/disclosure/announcement/a',
                    'https://evil@www.sse.com.cn/disclosure/announcement/a', 'https://www.sse.com.cn:8443/disclosure/announcement/a']:
            with self.assertRaises(ValueError):
                official(url)
            target = dict(self.target, sourceUrl=url)
            self.assertEqual(self.run_probe(target=target)['status'], 'SOURCE_UNAVAILABLE')
            self.assertEqual(self.run_probe(final_url=url)['status'], 'SOURCE_UNAVAILABLE')
        with self.assertRaises(ValueError):
            OfficialRedirect().redirect_request(None, None, 302, '', {}, 'https://example.test/')

    def test_unavailable_incomplete_and_non_utf8_source_do_not_guess(self):
        def unavailable(_):
            raise OSError('unavailable')
        self.assertEqual(reconcile(self.target, unavailable, self.date)['status'], 'SOURCE_UNAVAILABLE')
        for raw in [b'', b'<html>captcha</html>', b'\xff', b'<html>not found</html>']:
            result = self.run_probe(raw)
            self.assertEqual(result['status'], 'SOURCE_UNAVAILABLE')
            self.assertIsNone(result['candidate'])

    def test_scheduled_listing_is_progress_before_effective_date(self):
        result = reconcile(self.target, self.fetcher, dt.date(2026, 8, 18))
        self.assertEqual(result['status'], 'IPO_IN_PROGRESS')
        self.assertIsNone(result['releaseAvailableAt'])

    def test_official_explicit_private_progress_and_inconclusive_states(self):
        for text, expected in [('宇树科技股份有限公司目前未上市。', 'UNCHANGED_PRIVATE'),
                               ('宇树科技股份有限公司首次公开发行申请已受理。', 'IPO_IN_PROGRESS'),
                               ('未检索到证券代码。', 'SOURCE_UNAVAILABLE')]:
            # Synthetic status snippets test parsing only; they are not real Unitree facts.
            raw = ('<span id="searchTitle">关于宇树科技股份有限公司上市状态的公告</span>'
                   '<div class="article-infor">2026-08-18 ' + text + '<div class="feedback_slide">').encode()
            self.assertEqual(self.run_probe(raw)['status'], expected)

    def test_retained_digest_and_source_metadata_match(self):
        provenance_path = PLAN.parent / self.target['retainedProvenance']
        provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
        self.assertEqual(len(self.raw), provenance['rawBytes'])
        self.assertEqual(hashlib.sha256(self.raw).hexdigest(), provenance['rawSha256'])
        self.assertEqual(provenance['sourceUrl'], self.target['sourceUrl'])
        self.assertIsNone(provenance['releaseAvailableAt'])

    def test_listed_or_unknown_input_is_out_of_scope(self):
        for status in ['A股', '港股', 'unknown', None]:
            self.assertEqual(self.run_probe(target=dict(self.target, baselineStatus=status))['status'], 'SOURCE_UNAVAILABLE')

    def test_current_ids_read_top_level_export_not_nested_evidence_or_comments(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'privateCompanies.ts'
            path.write_text('''// id: "comment-company"
            export const roboticsPrivateCompanies: PrivateCompany[] = [
              { id: "tracked-company", evidenceItems: [{ id: "evidence-only" }],
                note: 'id: "quoted-not-a-company"' },
            ];''', encoding='utf-8')
            self.assertEqual(current_private_ids(path), {'tracked-company'})

    def test_unknown_current_export_format_fails_closed(self):
        cases = ['export const roboticsPrivateCompanies = loadCompanies();',
                 'export const roboticsPrivateCompanies = [...more];',
                 'export const roboticsPrivateCompanies = [{ id: "unitree", ...override }];',
                 'export const roboticsPrivateCompanies = [{ id: companyId }];',
                 'export const roboticsPrivateCompanies = [{ id: "same" }, { id: "same" }];',
                 'export const otherCompanies = [];',
                 'export const roboticsPrivateCompanies = []; roboticsPrivateCompanies.push({id: "hidden"});',
                 'export const roboticsPrivateCompanies = [{ ["id"]: "hidden" }];',
                 'export const roboticsPrivateCompanies = [ malformed ;']
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'privateCompanies.ts'
            for case in cases:
                path.write_text(case, encoding='utf-8')
                with self.assertRaises(ValueError, msg=case):
                    current_private_ids(path)


if __name__ == '__main__':
    unittest.main()
