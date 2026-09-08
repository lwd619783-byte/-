"""Offline C1 denominator, publication provenance, and raw replay acceptance."""
from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.market_regime.csrc_inventory import PLAN, build, publication, runs, target_periods
from scripts.market_regime.csrc_retrieval import Collector, RAW, ROOT, dump, parse_index, parse_landing


LANDING = "https://www.csrc.gov.cn/csrc/c100120/synthetic/content.shtml"
STAMP = "2026-09-08T00:00:00Z"


class PublicationTests(unittest.TestCase):
    def landing(self, html, dates=("2005-02-18",)):
        return dict(attemptId="landing", **parse_landing(html, LANDING), indexEntries=[dict(indexAttemptId="index", publicationDate=day, entryHtml=f"<li>{day}</li>") for day in dates])

    def test_generated_pubdate_is_not_release_and_index_fallback_is_preserved(self):
        landing = self.landing('<h1>2005年1月统计数据</h1><meta name="PubDate" content="2026-09-08"><meta name="others" content="页面生成时间 2026-09-08 09:00:00">')
        self.assertEqual(landing["publicationDates"], [])
        self.assertEqual(landing["metaPubDates"], ["2026-09-08"])
        result = publication(landing)
        self.assertEqual(result["status"], "OFFICIAL_INDEX_FALLBACK")
        self.assertEqual(result["date"], "2005-02-18")
        self.assertEqual(result["dateOnlySafeAvailableAt"], "2005-02-19T00:00:00+08:00")
        self.assertEqual(result["evidence"][0]["attemptId"], "index")
        self.assertIn("FIRST_RELEASE_AND_ATTACHMENT_VERSION_TIME_UNPROVEN", result["blockers"])

    def test_visible_date_remains_distinct_from_generated_pubdate(self):
        landing = self.landing('<h1>2005年1月统计数据</h1><meta name="PubDate" content="2026-09-08"><meta name="others" content="页面生成时间 2026-09-08 09:00:00"><p>日期：2005-02-18</p>')
        self.assertEqual(landing["publicationBasis"], "VISIBLE_DATE")
        result = publication(landing)
        self.assertEqual(result["status"], "LANDING")
        self.assertEqual(result["date"], "2005-02-18")
        self.assertEqual(result["evidence"][0]["basis"], "VISIBLE_DATE")

    def test_index_or_visible_publication_conflicts_fail_closed(self):
        for html, dates in [('<p>日期：2005-02-19</p>', ("2005-02-18",)), ('', ("2005-02-18", "2005-02-19"))]:
            with self.subTest(html=html, dates=dates):
                result = publication(self.landing(html, dates))
                self.assertEqual(result["status"], "UNRESOLVED")
                self.assertIsNone(result["date"])
                self.assertIsNone(result["dateOnlySafeAvailableAt"])
                self.assertIn("PUBLICATION_DATE_CONFLICT", result["blockers"])

    def test_missing_publication_is_unresolved(self):
        result = publication(self.landing('', ()))
        self.assertEqual(result["blockers"], ["PUBLICATION_EVIDENCE_MISSING"])
        self.assertIsNone(result["date"])

    def test_invalid_publication_calendar_date_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "INVALID_PUBLICATION_DATE"):
            publication(self.landing('', ("2005-02-30",)))

    def test_date_only_safe_rolls_across_year_boundary(self):
        self.assertEqual(publication(self.landing('', ("2005-12-31",)))["dateOnlySafeAvailableAt"], "2006-01-01T00:00:00+08:00")


class InventoryReplayTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.plan = json.loads((Path(__file__).resolve().parents[2] / PLAN).read_text(encoding="utf-8"))
        dump(self.repo / PLAN, self.plan)
        # Never permit a unit test to create a physical network request.
        network = patch("scripts.market_regime.csrc_retrieval.requests.Session.get", side_effect=AssertionError("OFFLINE_TEST_NO_NETWORK"))
        network.start()
        self.addCleanup(network.stop)
        self.c = Collector(self.repo)
        script = b"param = i == 1 ? '' : '_' + i; pagePrefix + param + '.' + pageSuffix"
        self.add_raw("script", "https://www.csrc.gov.cn/csrc/xhtml/js/page.js", script, "PAGINATION_SCRIPT", "application/javascript")
        index_html = '<html>中国证券监督管理委员会<ul><li><a href="/csrc/c100120/synthetic/content.shtml">2005年1月统计数据</a><span>2005-02-18</span></li></ul><script src="/csrc/xhtml/js/page.js"></script><script>createPageHTML(\'page_div\',1, 1,\'common_list\',\'shtml\',1)</script></html>'
        self.add_raw("index", ROOT, index_html.encode(), "INDEX", "text/html;charset=utf-8")
        landing_html = '<html>中国证券监督管理委员会<h1>2005年1月统计数据</h1><meta name="PubDate" content="2026-09-08"><meta name="others" content="页面生成时间 2026-09-08 09:00:00"></html>'
        self.add_raw("landing", LANDING, landing_html.encode(), "LANDING", "text/html;charset=utf-8")
        page = dict(url=ROOT, attemptId="index", **parse_index(index_html, ROOT), blockers=[], paginationScriptAttemptId="script")
        landing = dict(url=LANDING, attemptId="landing", **parse_landing(landing_html, LANDING), indexEntries=[dict(indexAttemptId="index", **page["entries"][0])])
        self.source = dict(navigation=[dict(url=ROOT, attemptId="index", basis="FROZEN_OFFICIAL_ROOT")], pages=[page], landings=[landing], complete=True)
        self.save_source()

    def add_raw(self, attempt, url, body, role, mime):
        sha = hashlib.sha256(body).hexdigest()
        local = f"{RAW}/sha256/{sha}.bin"
        path = self.repo / local
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        self.c.append(dict(attemptId=attempt, requestUrl=url, discoveredUrl=url, finalUrl=url, role=role, attemptedAt=STAMP, httpStatus=200, contentType=mime,
                           storedBytes=dict(localPath=local, sha256=sha, byteSize=len(body)), outcome="SUCCESS", blocker=None, redirects=[], acquisitionAttemptId=None, verifiedAt=None))

    def save_source(self):
        dump(self.c.root / "inventory-source.json", self.source)

    def rebuild(self, stamp=STAMP):
        return build(self.repo, stamp, save_extracted=False)

    def test_all_260_targets_survive_missing_pages_and_fields(self):
        result = self.rebuild()
        ledger = result["ledger"]
        self.assertEqual(len(ledger), 260)
        self.assertEqual(ledger[0]["period"], "2005-01")
        self.assertEqual(ledger[-1]["period"], "2026-08")
        self.assertEqual(len({c["period"] for c in ledger}), 260)
        self.assertEqual(result["summary"]["indexedPeriods"], 1)
        self.assertEqual(len(result["summary"]["missingPeriods"]), 259)
        self.assertEqual(result["summary"]["formalObservationCount"], 0)
        self.assertTrue(all(set(c["fields"].values()) == {"PARTIAL"} for c in ledger))
        self.assertIn("MISSING_IN_INSPECTED_OFFICIAL_INDEXES", ledger[1]["blockers"])
        self.assertIn("ATTACHMENT_SELECTION_UNRESOLVED", ledger[0]["blockers"])

    def test_target_count_mismatch_rejected(self):
        with self.assertRaisesRegex(ValueError, "TARGET_DENOMINATOR_MISMATCH"):
            target_periods(dict(self.plan, targetCount=259))

    def test_replay_is_deterministic_and_generated_at_not_business_hash(self):
        first = self.rebuild()
        self.assertEqual(first, self.rebuild())
        later = self.rebuild("2026-09-09T00:00:00Z")
        self.assertNotEqual(first["generatedAt"], later["generatedAt"])
        self.assertEqual(first["contentSha256"], later["contentSha256"])

    def test_runs_preserve_gaps_and_reappearing_formats(self):
        ledger = [dict(period=p, formats=f) for p, f in [("2005-01", ["XLS"]), ("2005-02", ["XLS"]), ("2005-03", []), ("2005-04", ["XLS"]), ("2005-05", ["DOCX"])]]
        eras = runs(ledger, lambda c: c["formats"])
        self.assertEqual([x["periodCount"] for x in eras], [2, 1, 1, 1])
        self.assertEqual(eras[1]["value"], [])
        self.assertEqual(eras[2]["start"], "2005-04")

    def test_raw_one_byte_tamper_is_rejected(self):
        record = next(r for r in self.c.rows if r["attemptId"] == "landing")
        path = self.repo / record["storedBytes"]["localPath"]
        body = path.read_bytes()
        path.write_bytes(bytes([body[0] ^ 1]) + body[1:])
        with self.assertRaisesRegex(ValueError, "RAW_BYTES_MISMATCH"):
            self.rebuild()

    def test_duplicate_attempt_identity_is_rejected(self):
        self.c.append(copy.deepcopy(self.c.rows[0]))
        with self.assertRaisesRegex(ValueError, "DUPLICATE_RETRIEVAL_ATTEMPT"):
            self.rebuild()

    def test_landing_missing_from_enumerated_candidates_is_rejected(self):
        self.source["landings"] = []
        self.save_source()
        with self.assertRaisesRegex(ValueError, "LANDING_INVENTORY_NOT_EXACTLY_ENUMERATED_CANDIDATES"):
            self.rebuild()

    def test_tampered_index_entry_publication_date_is_rejected(self):
        self.source["landings"][0]["indexEntries"][0]["publicationDate"] = "2005-02-01"
        self.save_source()
        with self.assertRaises(ValueError):
            self.rebuild()

    def test_tampered_index_entry_period_is_rejected(self):
        self.source["landings"][0]["indexEntries"][0]["periods"] = ["2005-02"]
        self.save_source()
        with self.assertRaises(ValueError):
            self.rebuild()

    def test_duplicate_static_page_cannot_inflate_index_coverage(self):
        self.source["pages"].append(copy.deepcopy(self.source["pages"][0]))
        self.save_source()
        with self.assertRaises(ValueError):
            self.rebuild()

    def test_duplicate_landing_event_is_rejected(self):
        self.source["landings"].append(copy.deepcopy(self.source["landings"][0]))
        self.save_source()
        with self.assertRaises(ValueError):
            self.rebuild()

    def test_missing_static_root_cannot_be_reported_as_complete_inventory(self):
        self.source["pages"] = []
        self.source["landings"] = []
        self.save_source()
        with self.assertRaises(ValueError):
            self.rebuild()

    def test_tampered_landing_publication_basis_is_rejected(self):
        self.source["landings"][0]["publicationBasis"] = "VISIBLE_DATE"
        self.source["landings"][0]["pageGenerationDates"] = []
        self.save_source()
        with self.assertRaises(ValueError):
            self.rebuild()

    def test_landing_acquisition_url_cannot_be_rebound(self):
        rows = copy.deepcopy(self.c.rows)
        row = next(r for r in rows if r["attemptId"] == "landing")
        row.update(requestUrl="https://www.csrc.gov.cn/unrelated.shtml", discoveredUrl="https://www.csrc.gov.cn/unrelated.shtml", finalUrl="https://www.csrc.gov.cn/unrelated.shtml")
        self.c.journal.write_text(''.join(json.dumps(r) + '\n' for r in rows), encoding="utf-8")
        with self.assertRaises(ValueError):
            self.rebuild()

    def test_unofficial_journal_source_is_rejected_even_for_unreferenced_row(self):
        self.add_raw("external", "https://example.com/not-csrc", b"not official", "ATTACHMENT", "application/octet-stream")
        with self.assertRaises(ValueError):
            self.rebuild()


if __name__ == "__main__":
    unittest.main()
