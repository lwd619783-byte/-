"""Offline CSRC-C1 retrieval/link evidence regressions; no financing extraction."""
from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import requests

from scripts.market_regime.csrc_retrieval import Collector, RAW, official, parse_index, parse_landing
from scripts.market_regime.csrc_archive import archive_template, parse_api, validate_archive


BASE = "https://www.csrc.gov.cn/csrc/c100120/common_list.shtml"
REPORT = "https://www.csrc.gov.cn/csrc/c100120/report.shtml"


class Response:
    def __init__(self, url, body=b"full attachment bytes", status=200, headers=None):
        self.url, self.content, self.status_code = url, body, status
        self.headers = headers or {"Content-Type": "application/octet-stream"}
        self.is_redirect = status in (301, 302, 303, 307, 308) and "Location" in self.headers


class Session:
    def __init__(self, factory=None):
        self.factory = factory or (lambda url: Response(url))
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.factory(url)


class LinkEvidenceTests(unittest.TestCase):
    def test_index_publication_fallback_scoped_to_same_entry(self):
        html = '''<ul><li><a href="/first.shtml">2018年1月统计数据</a></li>
        <li><a href="/second.shtml">2018年2月统计数据</a><span>2018-03-20</span></li>
        <li><a href="/third.shtml">2018年3月统计数据</a><span>2018-04-18</span></li></ul>'''
        entries = parse_index(html, BASE)["entries"]
        self.assertEqual([r["publicationDate"] for r in entries], [None, "2018-03-20", "2018-04-18"])
        self.assertNotIn("2018-03-20", entries[0]["entryHtml"])
        self.assertEqual(entries[1]["entryHtml"].count("href="), 1)
        self.assertEqual(parse_landing('<h1>2018年2月统计数据</h1>', REPORT)["publicationDates"], [])

    def test_index_ambiguous_dates_are_not_selected(self):
        html = '<li><a href="/report.shtml">2018年1月统计数据</a><span>2018-02-01</span><span>2018-02-02</span></li>'
        entry = parse_index(html, BASE)["entries"][0]
        self.assertIsNone(entry["publicationDate"])
        self.assertIn("2018-02-01", entry["entryHtml"])
        self.assertIn("2018-02-02", entry["entryHtml"])

    def test_no_li_cannot_borrow_other_report_date(self):
        html = '<a href="/a.shtml">2018年1月统计数据</a><span>2018-02-01</span><a href="/b.shtml">2018年2月统计数据</a>'
        self.assertEqual([e["publicationDate"] for e in parse_index(html, BASE)["entries"]], [None, None])

    def test_index_pagination_retains_official_template_evidence(self):
        marker = "createPageHTML('page_div',14, 2,'common_list','shtml',251)"
        result = parse_index('<script>' + marker + '</script>', BASE)
        self.assertEqual(result["pagination"], dict(totalPages=14, page=2, prefix="common_list", suffix="shtml", totalEntries=251, marker=marker))

    def test_landing_preserves_all_attachments_wrong_unknown_and_multiple_periods(self):
        html = '''<meta name="ArticleTitle" content="2018年2月统计数据">
        <meta name="PubDate" content="2018-03-20 09:00:00">
        <a href="/files/wrong.xls">2018年1月统计数据</a>
        <a href="/files/current.docx">2018年2月统计数据</a>
        <a href="/files/download?id=3&amp;type=original">附件</a>
        <a href="/files/combined.pdf">2018年1月及2018年2月统计数据</a>
        <a href="https://example.com/foreign.xlsx">外部附件</a>'''
        result = parse_landing(html, REPORT)
        self.assertEqual(result["periods"], ["2018-02"])
        self.assertEqual(result["publicationDates"], ["2018-03-20"])
        self.assertEqual(len(result["attachments"]), 4)
        self.assertEqual([a["namedPeriods"] for a in result["attachments"]], [["2018-01"], ["2018-02"], [], ["2018-01", "2018-02"]])
        self.assertIn("&type=original", result["attachments"][2]["url"])
        self.assertTrue(all(a["anchorHtml"] for a in result["attachments"]))
        self.assertNotIn("selectedAttachment", result)

    def test_attachment_period_in_decoded_filename_is_retained(self):
        html = '<h1>2018年2月统计数据</h1><a href="/files/2018%E5%B9%B41%E6%9C%88.xls">附件</a>'
        self.assertEqual(parse_landing(html, REPORT)["attachments"][0]["namedPeriods"], ["2018-01"])


class ArchiveEvidenceTests(unittest.TestCase):
    def payload(self, rows):
        return json.dumps(dict(data=dict(channelId="abc123", page=1, rows=10, total=len(rows), results=rows))).encode()

    def test_template_requires_observed_script_and_channel_binding(self):
        html = '<meta name="channelid" content="abc123"><script src="/csrc/xhtml/js/render.js"></script>'
        script = "url: '/searchList/' + _id + '?_isAgg=true&_isJson=true&_pageSize=' + pageSize + '&_template=index&_rangeTimeGte=&_channelName=&page=' + curPage; page_size: 10; _id = $('meta[name=\"channelid\"]').attr('content');"
        result = archive_template(html, script, BASE)
        self.assertEqual(result["channelId"], "abc123")
        self.assertEqual(result["pageSize"], 10)
        self.assertIn("_rangeTimeGte=&_channelName=&page=", result["templateEvidence"])
        for altered in [script.replace("_isAgg=true", "_isAgg=false"), script.replace("page_size: 10", "page_size: 20"), script.replace("meta[name=", "meta[unknown=")]:
            with self.subTest(altered=altered), self.assertRaises(ValueError):
                archive_template(html, altered, BASE)
        with self.assertRaises(ValueError):
            archive_template(html.replace("/render.js", "/unrelated.js"), script, BASE)

    def test_api_monthly_entries_keep_json_pointer_and_date_on_same_record(self):
        rows = [dict(title="2018年1月统计数据", url="/a.shtml", publishedTimeStr="2018-02-20 08:00:00"),
                dict(title="2018年2月统计数据", url="/b.shtml"),
                dict(title="2018年2月统计数据", url="/replacement.shtml", publishedTimeStr="2018-04-01 09:00:00")]
        result = parse_api(self.payload(rows), BASE, "abc123", 1)
        entries = result["entries"]
        self.assertEqual(len(entries), 3)
        self.assertEqual([x["publicationDate"] for x in entries], ["2018-02-20", None, "2018-04-01"])
        self.assertEqual([x["entryJsonLocator"] for x in entries], ["$.data.results[0]", "$.data.results[1]", "$.data.results[2]"])
        self.assertEqual(entries[0]["entryJson"]["publishedTimeStr"], "2018-02-20 08:00:00")
        self.assertNotEqual(entries[1]["url"], entries[2]["url"])
        self.assertNotIn("entryHtml", entries[0])

    def test_api_daily_weekly_reports_do_not_become_monthly_candidates(self):
        rows = [dict(title="2018年2月1日证券市场统计数据", url="/daily.shtml"),
                dict(title="2018年2月证券市场周报", url="/weekly.shtml"),
                dict(title="2018年2月统计数据", url="/monthly.shtml", resList=[dict(fileName="one.xls", filePath="/files/one.xls"), dict(fileName="two.docx", filePath="/files/two.docx")])]
        result = parse_api(self.payload(rows), BASE, "abc123", 1)
        self.assertEqual(result["responseEntries"], 3)
        self.assertEqual(len(result["entries"]), 1)
        self.assertEqual(result["entries"][0]["entryJsonLocator"], "$.data.results[2]")
        self.assertEqual(len(result["entries"][0]["resourceCandidates"]), 2)

    def test_api_channel_and_page_mismatch_fail_closed(self):
        body = self.payload([])
        for channel, page in [("other", 1), ("abc123", 2)]:
            with self.subTest(channel=channel, page=page), self.assertRaisesRegex(ValueError, "BINDING_MISMATCH"):
                parse_api(body, BASE, channel, page)

    def test_api_short_page_cannot_claim_declared_inventory_complete(self):
        payload = json.loads(self.payload([]))
        payload["data"]["total"] = 1260
        with self.assertRaisesRegex(ValueError, "COUNT_MISMATCH"):
            parse_api(json.dumps(payload).encode(), BASE, "abc123", 1)

    def test_archive_validator_replays_navigation_template_and_full_page_evidence(self):
        root_url = "https://www.csrc.gov.cn/archive.shtml"
        anchor = '<a href="/archive.shtml">证券市场统计</a>'
        html = '<meta name="channelid" content="abc123"><script src="/csrc/xhtml/js/render.js"></script>'
        script = "url: '/searchList/' + _id + '?_isAgg=true&_isJson=true&_pageSize=' + pageSize + '&_template=index&_rangeTimeGte=&_channelName=&page=' + curPage; page_size: 10; _id = $('meta[name=\"channelid\"]').attr('content');"
        template = archive_template(html, script, root_url)
        api_url = "https://www.csrc.gov.cn/searchList/abc123?_isAgg=true&_isJson=true&_pageSize=10&_template=index&_rangeTimeGte=&_channelName=&page=1"
        body = self.payload([dict(title="2018年1月统计数据", url="/report.shtml", publishedTimeStr="2018-02-20 08:00:00")])
        bodies = {"parent": anchor.encode(), "root": html.encode(), "script": script.encode(), "api": body}
        urls = {"parent": REPORT, "root": root_url, "script": template["scriptUrl"], "api": api_url}

        class RawCollector:
            rows = [dict(attemptId=key, requestUrl=url, finalUrl=url, outcome="SUCCESS") for key, url in urls.items()]

            def bytes(self, row):
                return bodies[row["attemptId"]]

        archive = dict(navigation=dict(parentAttemptId="parent", anchorHtml=anchor, url=root_url, attemptId="root"), scriptAttemptId="script", **template,
                       pages=[dict(page=1, url=api_url, attemptId="api", **parse_api(body, root_url, "abc123", 1))], complete=True, blockers=[])
        self.assertIsNone(validate_archive(RawCollector(), archive))
        mutated = []
        bad = copy.deepcopy(archive)
        bad["navigation"]["anchorHtml"] = '<a href="/unobserved.shtml">伪造入口</a>'
        mutated.append(bad)
        bad = copy.deepcopy(archive)
        bad["pages"][0]["entries"][0]["publicationDate"] = "2017-02-20"
        mutated.append(bad)
        bad = copy.deepcopy(archive)
        bad["pages"][0]["entries"][0]["entryJsonLocator"] = "$.data.results[9]"
        mutated.append(bad)
        bad = copy.deepcopy(archive)
        bad["channelEvidence"] = '<meta name="channelid" content="different">'
        mutated.append(bad)
        bad = copy.deepcopy(archive)
        bad["pages"] = []
        mutated.append(bad)
        for bad in mutated:
            with self.subTest(archive=bad), self.assertRaises(ValueError):
                validate_archive(RawCollector(), bad)


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        sleep = patch("scripts.market_regime.csrc_retrieval.time.sleep")
        self.sleep = sleep.start()
        self.addCleanup(sleep.stop)

    def collector(self, session=None, **kwargs):
        session = session or Session()
        with patch("scripts.market_regime.csrc_retrieval.requests.Session", return_value=session):
            return Collector(self.repo, **kwargs)

    def test_official_url_boundary(self):
        for url in ["https://csrc.gov.cn.evil.test/a", "https://evilcsrc.gov.cn/a", "https://example.com/a", "file:///a", "ftp://csrc.gov.cn/a", "https://user:pass@csrc.gov.cn/a", "https://csrc.gov.cn:8080/a"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                official(url)
        self.assertEqual(official("https://regional.csrc.gov.cn/a#fragment"), "https://regional.csrc.gov.cn/a")

    def test_http_discovery_requires_physical_https_request(self):
        session = Session()
        row = self.collector(session).fetch("http://www.csrc.gov.cn/files/report.xls", "ATTACHMENT")
        self.assertEqual(row["discoveredUrl"], "http://www.csrc.gov.cn/files/report.xls")
        self.assertEqual(row["requestUrl"], "https://www.csrc.gov.cn/files/report.xls")
        self.assertEqual(row["finalUrl"], session.calls[0][0])
        self.assertFalse(session.calls[0][1]["allow_redirects"])

    def test_identical_bytes_at_two_urls_do_not_fold_acquisition_identity(self):
        session = Session()
        collector = self.collector(session)
        first = collector.fetch("https://www.csrc.gov.cn/files/first.xls", "ATTACHMENT")
        second = collector.fetch("https://www.csrc.gov.cn/files/replacement.xls", "ATTACHMENT")
        self.assertEqual(len(session.calls), 2)
        self.assertEqual(first["storedBytes"], second["storedBytes"])
        self.assertNotEqual(first["attemptId"], second["attemptId"])
        self.assertNotEqual(first["requestUrl"], second["requestUrl"])
        self.assertEqual([r["outcome"] for r in collector.rows], ["SUCCESS", "SUCCESS"])

    def test_cache_verifies_bytes_and_preserves_original_acquisition(self):
        session = Session()
        collector = self.collector(session)
        original = collector.fetch(REPORT, "ATTACHMENT")
        before = collector.journal.read_bytes()
        resumed = self.collector(session)
        self.assertEqual(resumed.fetch(REPORT, "ATTACHMENT"), original)
        cache = resumed.rows[-1]
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(cache["outcome"], "CACHE_VERIFIED")
        self.assertEqual(cache["acquisitionAttemptId"], original["attemptId"])
        self.assertNotEqual(cache["attemptId"], original["attemptId"])
        self.assertIsNone(cache["httpStatus"])
        self.assertGreaterEqual(cache["verifiedAt"], original["attemptedAt"])
        self.assertEqual(resumed.rows[0], original)
        self.assertTrue(resumed.journal.read_bytes().startswith(before))

    def test_cache_verification_checks_hash_size_and_path(self):
        collector = self.collector()
        original = collector.fetch(REPORT, "ATTACHMENT")
        for field, value, error in [("sha256", "0" * 64, "RAW_BYTES_MISMATCH"), ("byteSize", 0, "RAW_BYTES_MISMATCH"), ("localPath", "outside.bin", "RAW_PATH_ESCAPE")]:
            bad = copy.deepcopy(original)
            bad["storedBytes"][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, error):
                collector.bytes(bad)

    def test_same_size_byte_corruption_forces_refetch(self):
        session = Session()
        collector = self.collector(session)
        original = collector.fetch(REPORT, "ATTACHMENT")
        raw = self.repo / original["storedBytes"]["localPath"]
        body = raw.read_bytes()
        raw.write_bytes(bytes([body[0] ^ 1]) + body[1:])
        resumed = self.collector(session)
        fresh = resumed.fetch(REPORT, "ATTACHMENT")
        self.assertEqual(len(session.calls), 2)
        self.assertEqual(fresh["outcome"], "SUCCESS")
        self.assertNotEqual(fresh["attemptId"], original["attemptId"])
        self.assertFalse(any(r["outcome"] == "CACHE_VERIFIED" for r in resumed.rows))

    def test_complete_http_error_body_is_retained_with_hash_mime_and_size(self):
        body = b"<title>Not found</title>" + bytes(range(256)) * 1024
        collector = self.collector(Session(lambda url: Response(url, body, 404, {"Content-Type": "text/html"})))
        row = collector.fetch(REPORT, "ATTACHMENT")
        self.assertEqual(row["outcome"], "HTTP_ERROR")
        self.assertEqual(row["httpStatus"], 404)
        self.assertEqual(row["contentType"], "text/html")
        self.assertEqual(collector.bytes(row), body)
        self.assertEqual(row["storedBytes"]["byteSize"], len(body))
        self.assertEqual(row["storedBytes"]["sha256"], hashlib.sha256(body).hexdigest())
        self.assertTrue(row["storedBytes"]["localPath"].startswith(RAW + "/"))

    def test_error_html_200_is_not_success_and_keeps_full_body(self):
        body = '<html><title>错误</title>中国证券监督管理委员会</html>'.encode()
        collector = self.collector(Session(lambda url: Response(url, body, 200, {"Content-Type": "text/html;charset=utf-8"})))
        row = collector.fetch(REPORT, "LANDING")
        self.assertEqual(row["outcome"], "CONTENT_REJECTED")
        self.assertEqual(collector.bytes(row), body)
        self.assertEqual(collector.html(row), "")

    def test_official_redirect_preserves_every_response_body(self):
        destination = "https://www.csrc.gov.cn/files/new.xls"
        session = Session(lambda url: Response(url, b"redirect evidence", 302, {"Location": destination}) if url == REPORT else Response(url, b"new attachment"))
        collector = self.collector(session)
        row = collector.fetch(REPORT, "ATTACHMENT")
        self.assertEqual(row["outcome"], "SUCCESS")
        self.assertEqual(row["finalUrl"], destination)
        self.assertEqual(collector.bytes(row), b"new attachment")
        redirect = row["redirects"][0]
        self.assertEqual(collector.bytes(redirect), b"redirect evidence")
        self.assertEqual(redirect["location"], destination)

    def test_external_redirect_not_requested_and_error_bytes_remain(self):
        session = Session(lambda url: Response(url, b"redirect body", 302, {"Location": "https://example.com/data.xls"}))
        collector = self.collector(session)
        row = collector.fetch(REPORT, "ATTACHMENT")
        self.assertTrue(all(url == REPORT for url, _ in session.calls))
        self.assertEqual(row["outcome"], "TRANSPORT_ERROR")
        self.assertEqual(collector.bytes(row), b"redirect body")
        self.assertEqual(len(row["redirects"]), 1)

    def test_transport_failure_does_not_invent_bytes_or_leak_exception_text(self):
        def fail(url):
            raise requests.ConnectionError("secret:credential@proxy.invalid")
        collector = self.collector(Session(fail))
        row = collector.fetch(REPORT, "ATTACHMENT")
        self.assertEqual(row["outcome"], "TRANSPORT_ERROR")
        self.assertIsNone(row["storedBytes"])
        self.assertEqual(row["blocker"], "ConnectionError")
        self.assertNotIn("credential", json.dumps(collector.rows))

    def test_budget_bounds_physical_requests(self):
        session = Session()
        collector = self.collector(session, budget=1)
        collector.fetch(REPORT, "ATTACHMENT")
        row = collector.fetch("https://www.csrc.gov.cn/files/two.xls", "ATTACHMENT")
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(row["outcome"], "TRANSPORT_ERROR")
        self.assertIsNone(row["storedBytes"])


if __name__ == "__main__":
    unittest.main()
