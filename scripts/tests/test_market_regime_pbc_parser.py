from __future__ import annotations

import unittest
import hashlib
import json
from pathlib import Path

from scripts.market_regime.pbc_parser import AFRE_SOURCE, M2_SOURCE, definition_era, parse_pbc_release

FIXTURES = Path(__file__).parent / "fixtures" / "market_regime"
URL = "https://www.pbc.gov.cn/test-fixture-only/index.html"


def page(title: str, body: str, publication: str = "2018-02-12 17:00:05") -> str:
    return f'<html><head><title>{title}</title></head><body><h1>{title}</h1><p>文章来源： {publication}</p>{body}</body></html>'


def parse(html: str, source: str = M2_SOURCE, **kwargs):
    return parse_pbc_release(html, URL, source_id=source, **kwargs)


def values(result):
    return {(row["valueDate"], row["metricId"]): row["value"] for row in result["rows"]}


class PbcHistoricalParserTests(unittest.TestCase):
    def test_m2_ecny_scope_boundary_retains_whole_note_without_backcasting(self):
        result = parse((FIXTURES / "pbc-r2b-m2-2022-12.html").read_text(encoding="utf-8"))
        self.assertEqual(result["valueDate"], "2022-12")
        self.assertTrue(all(row["definitionEra"] == "M2_2022_12" for row in result["rows"]))
        self.assertEqual({row["valueDate"] for row in result["rows"]}, {"2022-12"})
        self.assertTrue(any(all(term in n["text"] for term in ("自2022年12月起", "数字人民币", "M2增速无明显变化")) for n in result["definitionNotes"]))
        self.assertEqual(definition_era(M2_SOURCE, "2022-11"), "M2_2018")

    def test_afre_nonbank_scope_boundary_and_comparable_stock_basis(self):
        result = parse((FIXTURES / "pbc-r2b-afre-2023-01.html").read_text(encoding="utf-8"), AFRE_SOURCE)
        self.assertEqual(values(result), {("2023-01", "MACRO_AFRE_STOCK_BALANCE"): 350.93, ("2023-01", "MACRO_AFRE_STOCK_YOY"): 9.4})
        self.assertTrue(all(row["definitionEra"] == "AFRE_2023_01" and row["temporalRole"] == "CURRENT" for row in result["rows"]))
        self.assertTrue(all(row["reportedComparableBasis"] for row in result["rows"]))
        self.assertTrue(any(all(term in n["text"] for term in ("自2023年1月起", "贷款核销", "消费金融公司", "文中数据均按可比口径计算")) for n in result["definitionNotes"]))
        self.assertEqual(definition_era(AFRE_SOURCE, "2022-12"), "AFRE_2019_12")

    def test_2025_m1_revision_does_not_create_m2_era_or_backcast(self):
        result = parse(page("2025年2月金融统计数据报告", "<p>2月末，M2余额320万亿元，同比增长7%。</p><p>注4：中国人民银行自统计2025年1月份数据起，启用新修订的狭义货币（M1）统计口径。修订后的M1包括流通中货币、单位活期存款、个人活期存款、非银行支付机构客户备付金。按可比口径回溯后，2024年各月末M1可比余额和增速分别为：</p>", "2025-03-14 16:00:00"))
        self.assertEqual({row["definitionEra"] for row in result["rows"]}, {"M2_2022_12"})
        self.assertEqual({row["valueDate"] for row in result["rows"]}, {"2025-02"})

    def test_m2_1_official_boundary_excerpt_provenance_and_values(self):
        provenance = json.loads((FIXTURES / "pbc-r2b-parser-fixtures.provenance.json").read_text(encoding="utf-8"))
        expected = {
            "pbc-r2b-m2-2005-01.html": ("2005-01", 25.78, 14.1, "M2_PRE_2011"),
            "pbc-r2b-m2-2011-09.html": ("2011-09", 78.74, 13.0, "M2_PRE_2011"),
            "pbc-r2b-m2-2011-10.html": ("2011-10", 81.68, 12.9, "M2_2011"),
            "pbc-r2b-m2-2017-12.html": ("2017-12", 167.68, 8.2, "M2_2011"),
            "pbc-r2b-m2-2018-01.html": ("2018-01", 172.08, 8.6, "M2_2018"),
        }
        for metadata in provenance:
            raw = (FIXTURES / metadata["fixture"]).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), metadata["fixtureSha256"])
            self.assertEqual(metadata["artifactRole"], "TEST_FIXTURE_EXCERPT")
            if metadata["fixture"] not in expected:
                continue
            with self.subTest(fixture=metadata["fixture"]):
                period, balance, yoy, era = expected[metadata["fixture"]]
                result = parse_pbc_release(raw.decode(), metadata["sourceUrl"], source_id=M2_SOURCE)
                current = [row for row in result["rows"] if row["temporalRole"] == "CURRENT"]
                self.assertEqual({row["metricId"]: row["value"] for row in current}, {"MACRO_M2_BALANCE": balance, "MACRO_M2_YOY": yoy})
                self.assertTrue(all(row["definitionEra"] == era and row["valueDate"] == period for row in current))
                self.assertEqual(result["publicationDateTime"], metadata["publicationDateTime"])
                self.assertEqual(result["blockers"], [])

    def test_afre_2_official_scope_boundaries(self):
        for period, balance, yoy, era in (
            ("2018-07", 187.45, 10.3, "AFRE_2018_07"),
            ("2018-09", 197.3, 10.6, "AFRE_2018_09"),
            ("2019-09", 219.04, 10.8, "AFRE_2019_09"),
            ("2019-12", 251.31, 10.7, "AFRE_2019_12"),
        ):
            with self.subTest(period=period):
                result = parse((FIXTURES / f"pbc-r2b-afre-{period}.html").read_text(encoding="utf-8"), AFRE_SOURCE)
                self.assertEqual(values(result), {(period, "MACRO_AFRE_STOCK_BALANCE"): balance, (period, "MACRO_AFRE_STOCK_YOY"): yoy})
                self.assertTrue(all(row["definitionEra"] == era and row["temporalRole"] == "CURRENT" for row in result["rows"]))
                self.assertTrue(result["definitionNotes"])
                self.assertEqual(result["blockers"], [f"AFRE_BACKCAST_TABLE_MISSING:{period}"])

    def test_afre_2_full_historical_tables_and_literal_locators(self):
        provenance = json.loads((FIXTURES / "pbc-r2b-afre-tables-fixtures.provenance.json").read_text(encoding="utf-8"))
        expected = {"2018-07": (36, "2018-06", 177.3872, 12.5),
                    "2018-09": (40, "2018-08", 182.8692, 13.4),
                    "2019-09": (64, "2019-08", 183.2379, 13.5)}
        for metadata in provenance:
            raw = (FIXTURES / metadata["fixture"]).read_bytes()
            self.assertEqual(hashlib.sha256(raw).hexdigest(), metadata["fixtureSha256"])
            self.assertEqual(metadata["artifactRole"], "TEST_FIXTURE_EXCERPT")
            result = parse_pbc_release(raw.decode(), metadata["sourceUrl"], source_id=AFRE_SOURCE)
            self.assertEqual(result["publicationDateTime"], metadata["publicationDateTime"])
            period = result["valueDate"]
            if period not in expected:
                continue
            count, last, balance, yoy = expected[period]
            historical = [r for r in result["rows"] if r["temporalRole"] == "BACKCAST"]
            self.assertEqual(len(historical), count)
            self.assertEqual(min(r["valueDate"] for r in historical), "2017-01")
            self.assertEqual(max(r["valueDate"] for r in historical), last)
            self.assertEqual(values(result)[("2017-12", "MACRO_AFRE_STOCK_BALANCE")], balance)
            self.assertEqual(values(result)[("2017-12", "MACRO_AFRE_STOCK_YOY")], yoy)
            for row in historical:
                self.assertEqual(row["definitionEra"], "AFRE_" + period.replace("-", "_") + "_BACKCAST")
                self.assertTrue(row["reportedComparableBasis"])
                for locator in (row["locator"], row["scopeEvidence"], row["comparabilityEvidence"]):
                    self.assertEqual(raw[locator["byteOffset"]:locator["byteOffset"] + locator["byteLength"]].decode(), locator["text"])
                self.assertTrue(all(token in row["locator"]["text"] for token in (row["rawFieldName"], row["rawValueText"], row["rawUnit"])))
            self.assertEqual(result["blockers"], [])

    def test_afre_2_current_table_precision_is_separate_from_first_release_prose(self):
        result = parse((FIXTURES / "pbc-r2b-afre-2018-07-tables.html").read_text(encoding="utf-8"), AFRE_SOURCE)
        self.assertEqual(values(result)[("2018-07", "MACRO_AFRE_STOCK_BALANCE")], 187.45)
        self.assertEqual({r["metricId"]: r["value"] for r in result["tableCurrentRows"]},
                         {"MACRO_AFRE_STOCK_BALANCE": 187.4504, "MACRO_AFRE_STOCK_YOY": 10.3})
        self.assertTrue(all(r["temporalRole"] == "CURRENT_TABLE" for r in result["tableCurrentRows"]))

    def test_afre_2_component_yoy_does_not_replace_aggregate(self):
        html = (FIXTURES / "pbc-r2b-afre-2019-09-tables.html").read_text(encoding="utf-8")
        changed = html.replace(">19.9</p>", ">999.9</p>")
        result = parse(changed, AFRE_SOURCE)
        self.assertEqual(values(result)[("2017-01", "MACRO_AFRE_STOCK_YOY")], 14.9)
        self.assertFalse(any(r["value"] == 999.9 for r in result["rows"]))

    def test_afre_2_merged_cells_are_not_positionally_guessed(self):
        html = (FIXTURES / "pbc-r2b-afre-2018-07-tables.html").read_text(encoding="utf-8")
        result = parse(html.replace('<td>', '<td colspan="2">'), AFRE_SOURCE)
        self.assertFalse(any(r["temporalRole"] == "BACKCAST" for r in result["rows"]))
        self.assertIn("AFRE_BACKCAST_MERGED_CELLS_UNSUPPORTED:2018-07", result["blockers"])

    def test_afre_2_invalid_and_future_table_months_fail_closed(self):
        html = (FIXTURES / "pbc-r2b-afre-2018-07-tables.html").read_text(encoding="utf-8")
        for bad, reason in (("2017年13月", "AFRE_BACKCAST_PERIOD_HEADER_INVALID:2018-07"),
                            ("2019年1月", "AFRE_BACKCAST_PERIOD_OUTSIDE_SCOPE:2019-01")):
            result = parse(html.replace("2017年1月", bad), AFRE_SOURCE)
            self.assertNotIn(("2017-01", "MACRO_AFRE_STOCK_BALANCE"), values(result))
            self.assertFalse(any(r["valueDate"] > "2018-07" for r in result["rows"]))
            self.assertIn(reason, result["blockers"])

    def test_afre_2_missing_numeric_table_cell_never_becomes_zero(self):
        html = (FIXTURES / "pbc-r2b-afre-2018-07-tables.html").read_text(encoding="utf-8")
        for invalid in ("—", "", "1,613,437"):
            result = parse(html.replace("1613437", invalid), AFRE_SOURCE)
            self.assertNotIn(("2017-01", "MACRO_AFRE_STOCK_BALANCE"), values(result))
            self.assertIn("AFRE_BACKCAST_NUMERIC_UNSUPPORTED:2017-01", result["blockers"])

    def test_afre_2_scope_change_note_is_required_even_with_table(self):
        html = (FIXTURES / "pbc-r2b-afre-2018-07-tables.html").read_text(encoding="utf-8")
        result = parse(html.replace("2018年7月起", "不明时期起"), AFRE_SOURCE)
        self.assertFalse(any(r["temporalRole"] == "BACKCAST" for r in result["rows"]))
        self.assertIn("AFRE_BACKCAST_SCOPE_EVIDENCE_MISSING:2018-07", result["blockers"])

    def test_afre_2_attachment_only_scope_change_keeps_explicit_blockers(self):
        result = parse((FIXTURES / "pbc-r2b-afre-2019-12-attachments.html").read_text(encoding="utf-8"), AFRE_SOURCE)
        self.assertEqual(result["releaseAvailableAt"], "2020-01-16T15:00:30+08:00")
        self.assertEqual(len(result["rows"]), 2)
        self.assertTrue(all(r["temporalRole"] == "CURRENT" for r in result["rows"]))
        self.assertEqual(len(result["blockers"]), 2)
        self.assertTrue(all(b.startswith("AFRE_BACKCAST_ATTACHMENT_UNSUPPORTED:2019-12:") for b in result["blockers"]))

    def test_m2_1_r1_cross_era_fixtures_and_literal_locators(self):
        for filename, period, balance, yoy, era in (
            ("pboc-m2-2005.html", "2005-11", 29.24, 18.3, "M2_PRE_2011"),
            ("pboc-m2-2015.html", "2015-01", 124.27, 10.8, "M2_2011"),
            ("pboc-m2-2024.html", "2024-07", 303.31, 6.3, "M2_2022_12"),
        ):
            with self.subTest(filename=filename):
                html = (FIXTURES / filename).read_text(encoding="utf-8")
                result = parse(html)
                self.assertEqual(values(result), {(period, "MACRO_M2_BALANCE"): balance, (period, "MACRO_M2_YOY"): yoy})
                self.assertTrue(all(row["definitionEra"] == era for row in result["rows"]))
                for locator in [result["publicationEvidenceLocator"], *(row["locator"] for row in result["rows"])]:
                    start, length = locator["byteOffset"], locator["byteLength"]
                    self.assertEqual(html.encode("utf-8")[start:start + length].decode("utf-8"), locator["text"])
                self.assertNotIn("releaseKind", result)

    def test_m2_2_current_previous_and_m1_are_not_substituted(self):
        html = page("2018年1月金融统计数据报告", "<p>1月末，广义货币(M2)余额172.08万亿元，同比增长8.6%，增速比上月末高0.5个百分点；狭义货币(M1)余额54.32万亿元，同比增长15%。</p>")
        self.assertEqual(values(parse(html)), {("2018-01", "MACRO_M2_BALANCE"): 172.08, ("2018-01", "MACRO_M2_YOY"): 8.6})

    def test_m2_2_dual_method_and_backcast_have_separate_identity(self):
        html = page("2018年1月金融统计数据报告", "<p>1月末，广义货币(M2)余额172.08万亿元，同比增长8.6%。</p><p>注：人民银行完善货币市场基金统计方法。完善后，本期M2余额扩大1.15万亿元，去年同期M2余额扩大8249亿元，数据可比；本期M2余额同比增长8.6%，2017年末M2余额同比增长8.1%。按完善前方法统计，2018年1月末M2增速为8.5%。</p>")
        result = parse(html)
        self.assertEqual(values(result)[("2018-01", "MACRO_M2_YOY")], 8.6)
        historical = [row for row in result["rows"] if row["valueDate"] == "2017-12"]
        self.assertEqual(len(historical), 1)
        self.assertEqual((historical[0]["value"], historical[0]["definitionEra"], historical[0]["temporalRole"]), (8.1, "M2_2018_BACKCAST", "BACKCAST"))
        self.assertEqual(result["alternativeMethodRows"][0]["rawValueText"], "8.5")
        self.assertTrue(all(row["reportedComparableBasis"] for row in result["rows"]))

    def test_m2_2_annual_is_december_and_duplicate_same_claim_is_one_cell(self):
        body = "<p>12月末，广义货币(M2)余额167.68万亿元，同比增长8.2%。</p>"
        result = parse(page("2017年金融统计数据报告", body + body, "2018-01-12 16:00:05"))
        self.assertEqual(len(result["rows"]), 2)
        self.assertEqual(result["valueDate"], "2017-12")

    def test_m2_2_conflicting_current_yoy_is_blocked(self):
        body = "<p>1月末，M2余额172.08万亿元，同比增长8.6%。</p><p>1月末，M2余额172.08万亿元，同比增长8.5%。</p>"
        result = parse(page("2018年1月金融统计数据报告", body))
        self.assertNotIn(("2018-01", "MACRO_M2_YOY"), values(result))
        self.assertTrue(any("FIELD_VALUE_CONFLICT" in blocker for blocker in result["blockers"]))

    def test_m2_2_old_method_balance_first_does_not_win(self):
        body = "<p>按完善前方法统计，2018年1月末M2余额170.93万亿元，同比增长8.5%。</p><p>完善后，2018年1月末M2余额172.08万亿元，同比增长8.6%。</p>"
        result = parse(page("2018年1月金融统计数据报告", body))
        self.assertEqual(values(result), {("2018-01", "MACRO_M2_BALANCE"): 172.08, ("2018-01", "MACRO_M2_YOY"): 8.6})
        self.assertEqual(result["alternativeMethodRows"][0]["rawValueText"], "170.93")

    def test_m2_2_current_method_note_disagreement_fails_closed(self):
        body = "<p>1月末，M2余额172.08万亿元，同比增长8.5%。</p><p>完善后，本期M2余额同比增长8.6%。</p>"
        result = parse(page("2018年1月金融统计数据报告", body))
        self.assertNotIn(("2018-01", "MACRO_M2_YOY"), values(result))
        self.assertIn("CURRENT_METHOD_YOY_CONFLICT:2018-01", result["blockers"])

    def test_m2_3_later_publication_kept_and_not_claimed_first(self):
        original = parse(page("2017年金融统计数据报告", "<p>12月末，M2余额167.68万亿元，同比增长8.2%。</p>", "2018-01-12 16:00:05"))
        later = parse(page("2017年金融统计数据报告", "<p>12月末，M2余额168.83万亿元，同比增长8.1%。</p>", "2026-09-01 16:00:05"))
        self.assertLess(original["releaseAvailableAt"], later["releaseAvailableAt"])
        self.assertEqual(values(original)[("2017-12", "MACRO_M2_YOY")], 8.2)
        self.assertNotIn("releaseKind", later)

    def test_afre_1_backcast_2014_release_clock_preserved(self):
        result = parse((FIXTURES / "pboc-afre-2014-backcast.html").read_text(encoding="utf-8"), AFRE_SOURCE)
        self.assertEqual(result["releaseAvailableAt"], "2015-02-10T16:31:12+08:00")
        self.assertTrue("2015-02-09T08:00:00+08:00" < result["releaseAvailableAt"] < "2015-02-16T08:00:00+08:00")
        self.assertTrue(all(row["temporalRole"] == "BACKCAST" for row in result["rows"]))
        self.assertEqual(len(result["rows"]), 2)

    def test_afre_2_current_not_backcast_merely_from_notes(self):
        html = page("2019年社会融资规模存量统计数据报告", "<p>初步统计，2019年末社会融资规模存量为251.31万亿元，同比增长10.7%。</p><p>注：2019年12月起，将国债和地方政府一般债券纳入统计，历史数据追溯至2017年1月。文内同比数据为可比口径。</p>", "2020-01-16 16:00:00")
        result = parse(html, AFRE_SOURCE)
        self.assertTrue(all(row["temporalRole"] == "CURRENT" and row["definitionEra"] == "AFRE_2019_12" for row in result["rows"]))
        self.assertEqual(len(result["rows"]), 2)
        self.assertTrue(all(row["reportedComparableBasis"] for row in result["rows"]))

    def test_afre_2_explicit_historical_row_uses_event_definition(self):
        html = page("2019年社会融资规模存量统计数据报告", "<p>2019年末社会融资规模存量为251.31万亿元，同比增长10.7%。</p><p>按可比口径回溯，2017年末社会融资规模存量为200万亿元，同比增长12%。</p><p>文内同比数据为可比口径。</p>", "2020-01-16 16:00:00")
        result = parse(html, AFRE_SOURCE)
        earlier = [row for row in result["rows"] if row["valueDate"] == "2017-12"]
        self.assertEqual(len(earlier), 2)
        self.assertTrue(all(row["temporalRole"] == "BACKCAST" and row["definitionEra"] == "AFRE_2019_12_BACKCAST" for row in earlier))

    def test_afre_3_flow_never_becomes_stock(self):
        html = page("2015年1月金融统计数据报告", "<p>1月社会融资规模增量为2.05万亿元，同比增长10%。</p>", "2015-02-13 16:58:58")
        result = parse(html, AFRE_SOURCE)
        self.assertEqual(result["rows"], [])
        self.assertIn("STOCK_FIELD_MISSING", result["blockers"])

    def test_afre_3_quarter_end_does_not_generate_months(self):
        result = parse(page("2015年上半年社会融资规模存量统计数据报告", "<p>6月末社会融资规模存量为131.58万亿元，同比增长11.9%。</p>", "2015-07-22 16:00:00"), AFRE_SOURCE)
        self.assertEqual({row["valueDate"] for row in result["rows"]}, {"2015-06"})
        self.assertEqual(len(result["rows"]), 2)

    def test_publication_unknown_conflict_and_nonofficial_rejected(self):
        body = "<p>1月末，M2余额100万亿元，同比增长10%。</p>"
        with self.assertRaisesRegex(ValueError, "PUBLICATION_EVIDENCE_MISSING"):
            parse("<h1>2018年1月金融统计数据报告</h1>" + body)
        with self.assertRaisesRegex(ValueError, "PUBLICATION_EVIDENCE_CONFLICT"):
            parse(page("2018年1月金融统计数据报告", body + "<p>发布日期：2026-01-01</p>"))
        with self.assertRaisesRegex(ValueError, "NON_PBC_SOURCE"):
            parse_pbc_release(page("2018年1月金融统计数据报告", body), "https://pbc.gov.cn.example.com/a", source_id=M2_SOURCE)

    def test_date_only_is_next_day_and_not_url_migration_date(self):
        result = parse(page("2018年1月金融统计数据报告", "<p>1月末，M2余额100万亿元，同比增长10%。</p>", "2018-02-12"))
        self.assertEqual(result["releaseAvailableAt"], "2018-02-13T00:00:00+08:00")

    def test_units_preserve_source_and_explicit_conversion(self):
        result = parse(page("2018年1月金融统计数据报告", "<p>1月末，M2余额1720800亿元，同比增长8.6%。</p>"))
        balance = next(row for row in result["rows"] if row["metricId"].endswith("BALANCE"))
        self.assertEqual((balance["value"], balance["originalValue"], balance["rawUnit"], balance["rawValueText"]), (172.08, 1720800, "亿元", "1720800"))

    def test_numeric_lexeme_outside_contract_is_blocked(self):
        result = parse(page("2018年1月金融统计数据报告", "<p>1月末，M2余额1,720,800亿元，同比增长8.6%。</p>"))
        self.assertIn("NUMERIC_LEXEME_UNSUPPORTED:2018-01", result["blockers"])
        self.assertNotIn(("2018-01", "MACRO_M2_BALANCE"), values(result))

    def test_decrease_has_positive_literal_and_negative_conversion(self):
        result = parse(page("2018年1月金融统计数据报告", "<p>1月末，M2余额172.08万亿元，同比下降8.6%。</p>"))
        yoy = next(row for row in result["rows"] if row["metricId"].endswith("YOY"))
        self.assertEqual((yoy["value"], yoy["originalValue"], yoy["conversionMultiplier"], yoy["rawValueText"]), (-8.6, 8.6, -1, "8.6"))

    def test_afre_dedicated_report_generic_comparability_note(self):
        result = parse(page("2018年1月社会融资规模存量统计数据报告", "<p>1月末社会融资规模存量为100万亿元，同比增长10%。</p><p>当期数据为初步统计数，同比增速为可比口径数据。</p>"), AFRE_SOURCE)
        self.assertTrue(all(row["reportedComparableBasis"] and row["qualityStatus"] == "PROVISIONAL" for row in result["rows"]))

    def test_comparability_not_inferred_from_unrelated_note(self):
        result = parse(page("2018年1月金融统计数据报告", "<p>1月末，M2余额172.08万亿元，同比增长8.6%。</p><p>人民币贷款同比按可比口径计算。</p>"))
        self.assertTrue(all(not row["reportedComparableBasis"] for row in result["rows"]))

    def test_m1_yoy_cannot_fill_missing_m2_yoy(self):
        result = parse(page("2018年1月金融统计数据报告", "<p>1月末，M2余额172.08万亿元；M1余额54.32万亿元，同比增长15%。</p>"))
        self.assertEqual(len(result["rows"]), 1)
        self.assertIn("YOY_FIELD_MISSING:2018-01", result["blockers"])

    def test_title_and_field_mismatch_rejected_without_period_relabel(self):
        with self.assertRaisesRegex(ValueError, "TITLE_PERIOD_CONFLICT"):
            parse(page("2018年1月金融统计数据报告", "<p>1月末，M2余额172.08万亿元，同比增长8.6%。</p>"), expected_period="2018-02")

    def test_inline_html_retains_replayable_locator(self):
        html = page("2018年1月金融统计数据报告", "<p>1月末，广义货币(<b>M2</b>)余额<span>172.08</span>万亿元，同比增长8.6%。</p>")
        result = parse(html)
        self.assertEqual(len(result["rows"]), 2)
        for row in result["rows"]:
            loc = row["locator"]
            self.assertEqual(html.encode()[loc["byteOffset"]:loc["byteOffset"] + loc["byteLength"]].decode(), loc["text"])

    def test_legacy_narrative_heading_uses_explicit_body_period(self):
        result = parse(page("货币供应快速增长，人民币贷款继续增加", "<p>2009年4月末，广义货币供应量(M2)余额为54.05万亿元，同比增长25.95%。</p>", "2009-05-11 16:00:00"))
        self.assertEqual(result["valueDate"], "2009-04")
        self.assertEqual(values(result)[("2009-04", "MACRO_M2_YOY")], 25.95)

    def test_source_layout_newlines_do_not_terminate_same_paragraph(self):
        html = page("2011年4月金融统计数据报告", "<p>4月末，广义货币\n (M2)余额\n 75.73\n 万亿元,\n 同比增长\n 15.3%。</p>", "2011-05-11 16:00:00")
        self.assertEqual(values(parse(html)), {("2011-04", "MACRO_M2_BALANCE"): 75.73, ("2011-04", "MACRO_M2_YOY"): 15.3})

    def test_afre_annual_title_anchors_year_without_end_character(self):
        result = parse(page("2017年社会融资规模存量统计数据报告", "<p>初步统计，2017年社会融资规模存量为174.64万亿元，同比增长12%。</p>", "2018-01-12 16:00:00"), AFRE_SOURCE)
        self.assertEqual(values(result), {("2017-12", "MACRO_AFRE_STOCK_BALANCE"): 174.64, ("2017-12", "MACRO_AFRE_STOCK_YOY"): 12.0})

    def test_m2_subscript_retains_literal_chinese_label(self):
        result = parse(page("2020年11月金融统计数据报告", "<p>11月末，广义货币(M<sub>2</sub>)余额217.2万亿元，同比增长10.7%。</p>", "2020-12-09 16:00:00"))
        self.assertEqual(len(result["rows"]), 2)
        self.assertTrue(all(row["rawFieldName"] == "广义货币" for row in result["rows"]))
        self.assertEqual(result["blockers"], [])


if __name__ == "__main__":
    unittest.main()
