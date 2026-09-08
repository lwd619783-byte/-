"""Offline structured excerpts of the inspected official eras; never coverage."""
import json
import unittest
from pathlib import Path

from scripts.market_regime.csrc_field_map import field_map, row_period


FIXTURES = Path(__file__).parent / "fixtures/market_regime/csrc-c1-field-layout-excerpts.v1.json"


class CsrcEraFixtureTests(unittest.TestCase):
    def test_explicit_compact_month_and_missing_axis_remain_distinct(self):
        self.assertEqual(row_period(dict(text="200902", rawType="2")), ("2009-02", "MONTH"))
        self.assertEqual(row_period(dict(text="200913", rawType="2")), (None, "UNRESOLVED"))
        self.assertEqual(row_period(dict(text="2009年1-5月", rawType="1")), (None, "YTD"))

    def test_representatives_and_adjacent_format_boundaries(self):
        fixtures = json.loads(FIXTURES.read_text(encoding="utf-8"))["fixtures"]
        periods = {f["period"] for f in fixtures}
        self.assertTrue({"2005-12", "2010-12", "2015-12", "2016-12", "2018-01", "2020-05", "2020-06", "2020-12", "2025-12", "2026-08"} <= periods)
        # Missing 2017 is not a synthetic fixture or an invented exact boundary.
        self.assertFalse(any(p.startswith("2017-") for p in periods))
        for f in fixtures:
            with self.subTest(period=f["period"]):
                self.assertEqual(f["fixtureRole"], "TEST_FIXTURE_EXCERPT")
                self.assertRegex(f["sourceSha256"], r"^[a-f0-9]{64}$")
                self.assertTrue(f["sourceUrl"].startswith("https://www.csrc.gov.cn/"))
                result = field_map(f["probeExcerpt"], f["period"])
                self.assertEqual({k: v["status"] for k, v in result["fields"].items()}, f["expectedFields"])
                self.assertTrue(all(v["formalObservations"] == [] for v in result["fields"].values()))

    def test_real_docx_has_index_returns_not_financing_and_later_ole_is_blocked(self):
        fs = {f["period"]: f for f in json.loads(FIXTURES.read_text(encoding="utf-8"))["fixtures"]}
        before, after = fs["2020-05"]["probeExcerpt"], fs["2020-06"]["probeExcerpt"]
        self.assertEqual(before["actualFormat"], "DOCX")
        self.assertIn("单位：%", before["paragraphs"])
        self.assertTrue(any("股指" in s for s in before["paragraphs"]))
        self.assertEqual(after["actualFormat"], "DOC_OLE")
        self.assertIn("UNSUPPORTED_FORMAT", after["blockers"])


if __name__ == "__main__":
    unittest.main()
