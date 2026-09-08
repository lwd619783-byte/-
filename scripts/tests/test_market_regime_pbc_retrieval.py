from __future__ import annotations

import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from scripts.market_regime.pbc_retrieval import Collector, OfficialRedirect, official_url, parse_index, content_rejection, collect_statistical_tables


class Response(io.BytesIO):
    def __init__(self, body='<html><title>中国人民银行</title></html>'.encode(), code=200):
        super().__init__(body)
        self.code = code
        self.url = 'https://www.pbc.gov.cn/report.html'
        self.headers = {'Content-Type': 'text/html; charset=utf-8'}


class Opener:
    def __init__(self, factory=Response):
        self.factory, self.calls = factory, 0

    def open(self, request, timeout):
        self.calls += 1
        return self.factory()


class RetrievalTests(unittest.TestCase):
    def collector(self, root, opener):
        return Collector(Path(root), opener=opener, retries=0)

    def test_official_host_and_redirect_boundary(self):
        for url in ['https://pbc.gov.cn.evil.test/a', 'https://evilpbc.gov.cn/a',
                    'file:///data', 'https://user:pass@www.pbc.gov.cn/a']:
            with self.assertRaises(ValueError):
                official_url(url)
        self.assertEqual(official_url('https://wuhan.pbc.gov.cn/a#fragment'), 'https://wuhan.pbc.gov.cn/a')
        with self.assertRaises(ValueError):
            OfficialRedirect().redirect_request(None, None, 302, '', {}, 'https://example.com/a')

    def test_observed_http_link_requires_new_physical_https_request(self):
        requested = []
        class HttpsOpener:
            def open(self, request, timeout):
                requested.append(request.full_url)
                response = Response()
                response.url = request.full_url
                return response
        with tempfile.TemporaryDirectory() as root:
            collector = self.collector(root, HttpsOpener())
            url = 'http://www.pbc.gov.cn/eportal/2005S14.htm'
            legacy = {'attempt': {'outcome': 'SUCCESS', 'sourceId': 'PBC_M2', 'requestUrl': url}, 'contentType': 'text/html'}
            collector._append(legacy)
            before = collector.journal_path.read_bytes()
            row = collector.fetch('PBC_M2', url)
            self.assertEqual(requested, ['https://www.pbc.gov.cn/eportal/2005S14.htm'])
            self.assertEqual(row['attempt']['requestUrl'], requested[0])
            self.assertEqual(row['attempt']['finalUrl'], requested[0])
            self.assertEqual(row['discoveredUrl'], url)
            self.assertTrue(collector.journal_path.read_bytes().startswith(before))
            self.assertEqual(collector.rows[0], legacy)

    def test_cache_preserves_original_acquisition_and_verifies_bytes(self):
        with tempfile.TemporaryDirectory() as root:
            opener = Opener()
            collector = self.collector(root, opener)
            original = collector.fetch('PBC_M2', 'https://www.pbc.gov.cn/report.html')
            resumed = self.collector(root, opener)
            self.assertEqual(resumed.fetch('PBC_M2', original['attempt']['requestUrl']), original)
            cache = resumed.rows[-1]['attempt']
            self.assertEqual(opener.calls, 1)
            self.assertEqual(cache['outcome'], 'CACHE_VERIFIED')
            self.assertIsNone(cache['httpStatus'])
            self.assertEqual(cache['acquisitionAttemptId'], original['attempt']['attemptId'])
            self.assertGreaterEqual(cache['verifiedAt'], original['attempt']['attemptedAt'])
            self.assertEqual(resumed.rows[0], original)

    def test_corrupt_cache_refetches_instead_of_claiming_success(self):
        with tempfile.TemporaryDirectory() as root:
            opener = Opener()
            collector = self.collector(root, opener)
            row = collector.fetch('PBC_M2', 'https://www.pbc.gov.cn/report.html')
            (Path(root) / row['attempt']['storedBytes']['localPath']).write_bytes(b'changed')
            resumed = self.collector(root, opener)
            result = resumed.fetch('PBC_M2', row['attempt']['requestUrl'])
            self.assertEqual(opener.calls, 2)
            self.assertEqual(result['attempt']['outcome'], 'SUCCESS')
            self.assertNotEqual(result['attempt']['attemptId'], row['attempt']['attemptId'])

    def test_http_and_content_failure_bytes_retained(self):
        with tempfile.TemporaryDirectory() as root:
            for code, body, outcome in [(404, b'not found', 'HTTP_ERROR'),
                                        (200, b'<title>Access Denied</title>', 'CONTENT_REJECTED')]:
                collector = self.collector(root, Opener(lambda: Response(body, code)))
                row = collector.fetch('PBC_M2', 'https://www.pbc.gov.cn/report.html')
                self.assertEqual(row['attempt']['outcome'], outcome)
                self.assertEqual((Path(root) / row['attempt']['storedBytes']['localPath']).read_bytes(), body)

    def test_transport_error_sanitized_no_fabricated_bytes(self):
        def fail():
            raise URLError('https://secret:credential@proxy.invalid')
        with tempfile.TemporaryDirectory() as root:
            row = self.collector(root, Opener(fail)).fetch('PBC_M2', 'https://www.pbc.gov.cn/report.html')
            self.assertEqual(row['attempt']['outcome'], 'TRANSPORT_ERROR')
            self.assertIsNone(row['attempt']['storedBytes'])
            self.assertNotIn('credential', json.dumps(row))

    def test_budget_and_throttle(self):
        with tempfile.TemporaryDirectory() as root:
            collector = Collector(Path(root), opener=Opener(), budget=2, retries=0)
            with patch('scripts.market_regime.pbc_retrieval.time.sleep') as sleep:
                collector.fetch('PBC_M2', 'https://www.pbc.gov.cn/one.html')
                collector.fetch('PBC_M2', 'https://www.pbc.gov.cn/two.html')
                sleep.assert_called_once()
                self.assertGreater(sleep.call_args.args[0], 0)
            with self.assertRaisesRegex(RuntimeError, 'REQUEST_BUDGET_EXHAUSTED'):
                collector.fetch('PBC_M2', 'https://www.pbc.gov.cn/three.html')

    def test_index_preserves_unique_entry_and_explicit_next_evidence(self):
        html = '''<a href="/report.html">2018年1月金融统计数据报告</a><span>2018-02-12</span>
        <a onclick="queryArticleByCondition(this,'/index/11871-2.html')">下一页</a>
        <input totalpage="38">'''
        result = parse_index(html, 'https://www.pbc.gov.cn/index.html')
        self.assertEqual(len(result['entries']), 1)
        self.assertEqual(result['entries'][0]['publicationDate'], '2018-02-12')
        self.assertEqual(result['entries'][0]['entryHtml'].count('href='), 1)
        self.assertEqual(result['pagination'][0]['url'], 'https://www.pbc.gov.cn/index/11871-2.html')
        self.assertEqual(result['declaredTotalPages'], 38)

    def test_official_table_response_need_not_have_site_navigation(self):
        body = '<html><table><tr><td>货币供应量</td><td>Money Supply</td></tr></table></html>'.encode()
        self.assertIsNone(content_rejection(body, 'text/html'))
        self.assertEqual(content_rejection(b'<html><table>unknown</table></html>', 'text/html'), 'UNRECOGNIZED_HTML_CONTENT')

    def test_table_discovery_does_not_fetch_flow_or_claim_release_identity(self):
        root = 'https://www.pbc.gov.cn/diaochatongjisi/116219/116319/index.html'
        bodies = {
            root: '<html>中国人民银行<a href="/stats/2025/index.html">2025年统计数据</a><a href="/stats/2025/afre.html">社会融资规模</a><a href="/stats/2025/m2.html">货币统计概览</a></html>',
            'https://www.pbc.gov.cn/stats/2025/afre.html': '<html>中国人民银行<table><tr><td>社会融资规模增量</td><td><a href="/flow.pdf">pdf</a></td></tr><tr><td>社会融资规模存量</td><td><a href="/stock.pdf">pdf</a></td></tr></table></html>',
            'https://www.pbc.gov.cn/stats/2025/m2.html': '<html>中国人民银行<table><tr><td>货币供应量</td><td><a href="/money.pdf">pdf</a></td></tr></table></html>',
        }
        requested = []
        class TableOpener:
            def open(self, request, timeout):
                requested.append(request.full_url)
                response = Response(bodies.get(request.full_url, '<html>中国人民银行</html>').encode())
                response.url = request.full_url
                return response
        with tempfile.TemporaryDirectory() as directory, patch('scripts.market_regime.pbc_retrieval.time.sleep'):
            result = collect_statistical_tables(self.collector(directory, TableOpener()))
            self.assertNotIn('https://www.pbc.gov.cn/flow.pdf', requested)
            self.assertIn('https://www.pbc.gov.cn/stock.pdf', requested)
            self.assertEqual(result['releaseIdentity'], 'UNPROVEN_CURRENT_TABLES')
            self.assertEqual(sum(len(p['tables']) for p in result['categoryPages']), 2)


if __name__ == '__main__':
    unittest.main()
