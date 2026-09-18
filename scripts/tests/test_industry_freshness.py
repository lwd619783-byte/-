import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.industry.probe_nbs import INDEX, MANIFEST, ROOT, OfficialRedirect, official, probe, retain_new


class NbsFreshnessTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        original = json.loads((ROOT / MANIFEST).read_text(encoding='utf-8'))
        self.capture = original['captures'][-1]
        self.raw = (ROOT / self.capture['path']).read_bytes()
        destination = self.root / self.capture['path']
        destination.parent.mkdir(parents=True)
        destination.write_bytes(self.raw)
        (self.root / MANIFEST).write_text(json.dumps({'schemaVersion': 'nbs-capture.v1', 'captures': [self.capture]}), encoding='utf-8')

    def fetcher(self, body=None, period='2026-08', target=None):
        url = target or self.capture['url']
        year, month = period.split('-')
        listing = f'<a href="{url}" title="{year}年{int(month)}月份规模以上工业增加值增长5.2%">release</a>'.encode()
        return lambda requested: (requested, listing if requested == INDEX else self.raw if body is None else body)

    def snapshot(self):
        return {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob('*') if p.is_file()}

    def synthetic(self, month=9, growth_header='同比增长（%）'):
        return f'''<html><body>2026年{month}月份规模以上工业生产主要数据
        统计范围为年主营业务收入2000万元及以上的工业企业
        <table><tr><td>指标</td><td>{month}月</td><td>1—{month}月</td></tr>
        <tr><td>绝对量</td><td>{growth_header}</td><td>绝对量</td><td>{growth_header}</td></tr>
        <tr><td>工业机器人（套）</td><td>1</td><td>2</td><td>3</td><td>4</td></tr></table>
        </body></html>'''.encode()

    def test_same_latest_noop_and_exact_four_readings(self):
        before = self.snapshot()
        result, body = probe(self.root, self.fetcher())
        self.assertEqual(result['status'], 'LATEST_ALREADY_RETAINED')
        self.assertIsNone(retain_new(result, body, self.root))
        self.assertEqual(before, self.snapshot())
        self.assertEqual([v['value'] for v in result['readings']['absolute']['values']], [96174, 729352])
        self.assertEqual([v['value'] for v in result['readings']['officialYoY']['values']], [34.6, 29])
        self.assertIsNone(result['releaseAvailableAt'])

    def test_same_period_changed_bytes_is_source_change_even_same_readings(self):
        before = self.snapshot()
        result, body = probe(self.root, self.fetcher(self.raw + b'<!-- revision -->'))
        self.assertEqual(result['status'], 'SOURCE_CHANGED')
        self.assertIn('REVISION', result['reason'])
        self.assertIsNone(retain_new(result, body, self.root))
        self.assertEqual(before, self.snapshot())

    def test_new_period_readonly_then_exclusive_versioned_capture(self):
        # Synthetic September fixture only; never a claim that September is published.
        new_raw = self.synthetic()
        target = 'https://www.stats.gov.cn/sj/zxfb/202610/synthetic-fixture.html'
        before = self.snapshot()
        result, body = probe(self.root, self.fetcher(new_raw, '2026-09', target))
        self.assertEqual(result['status'], 'NEW_RELEASE_AVAILABLE', result)
        self.assertEqual(before, self.snapshot())
        manifest_path = retain_new(result, body, self.root)
        captured = json.loads((self.root / manifest_path).read_text(encoding='utf-8'))
        self.assertEqual(captured['schemaVersion'], 'nbs-capture.v1')
        self.assertEqual(captured['captures'][0]['sha256'], hashlib.sha256(new_raw).hexdigest())
        self.assertEqual((self.root / captured['captures'][0]['path']).read_bytes(), new_raw)
        for name, raw in before.items():
            self.assertEqual((self.root / name).read_bytes(), raw)
        with self.assertRaises(FileExistsError):
            retain_new(result, body, self.root)

    def test_unavailable_no_write(self):
        before = self.snapshot()
        def fail(_):
            raise OSError('network unavailable')
        self.assertEqual(probe(self.root, fail)[0]['status'], 'SOURCE_UNAVAILABLE')
        self.assertEqual(before, self.snapshot())

    def test_nonofficial_source_and_redirect_fail_closed(self):
        for url in ['http://www.stats.gov.cn/a', 'https://stats.gov.cn/a', 'https://www.stats.gov.cn.evil.test/a', 'https://user@www.stats.gov.cn/a']:
            with self.assertRaises(ValueError):
                official(url)
        self.assertEqual(probe(self.root, self.fetcher(target='https://example.test/a'))[0]['status'], 'SOURCE_UNAVAILABLE')
        result, _ = probe(self.root, lambda _: ('https://example.test/a', self.raw))
        self.assertEqual(result['reason'], 'OFFICIAL_SOURCE_REQUIRED')
        with self.assertRaises(ValueError):
            OfficialRedirect().redirect_request(None, None, 302, '', {}, 'https://example.test/a')

    def test_duplicate_index_links_deduplicate_but_conflicts_do_not(self):
        fetcher = self.fetcher()
        def duplicate(url):
            final_url, body = fetcher(url)
            return final_url, body + body if url == INDEX else body
        self.assertEqual(probe(self.root, duplicate)[0]['status'], 'LATEST_ALREADY_RETAINED')
        def conflict(url):
            final_url, body = fetcher(url)
            return final_url, body + body.replace(b't20260915_1965308', b'another-document') if url == INDEX else body
        self.assertEqual(probe(self.root, conflict)[0]['reason'], 'LATEST_RELEASE_CONFLICTED')

    def test_source_period_regression_is_not_fresh(self):
        result, body = probe(self.root, self.fetcher(self.synthetic(7), '2026-07'))
        self.assertEqual(result['status'], 'SOURCE_CHANGED')
        self.assertEqual(result['reason'], 'LATEST_PERIOD_REGRESSED')
        self.assertIsNone(body)

    def test_header_period_or_retained_digest_drift_fail_closed(self):
        wrong_header = self.synthetic(8, '环比增长（%）')
        result, body = probe(self.root, self.fetcher(wrong_header))
        self.assertEqual(result['status'], 'SOURCE_CHANGED')
        self.assertIn('TABLE_INVALID', result['reason'])
        self.assertIsNone(body)
        self.assertEqual(probe(self.root, self.fetcher(period='2026-09'))[0]['status'], 'SOURCE_UNAVAILABLE')
        (self.root / self.capture['path']).write_bytes(b'drift')
        self.assertEqual(probe(self.root, self.fetcher())[0]['reason'], 'RETAINED_BYTES_DRIFT')


if __name__ == '__main__':
    unittest.main()
