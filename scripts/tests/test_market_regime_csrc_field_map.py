"""Offline C1 mappability tests: synthetic layouts never publish observations."""
from __future__ import annotations

import copy
import unittest

from scripts.market_regime.csrc_field_map import disambiguate, field_map, row_period

IPO = "SUPPLY_IPO_FINANCING"
REFINANCING = "SUPPLY_REFINANCING"


def cell(row, column, text, raw_type="1", **extra):
    state = "BLANK" if not text.strip() else "DASH" if text.strip() in ("-", "—", "–") else "REPORTED_ZERO" if text in ("0", "0.00") else "PRESENT"
    return dict(row=row, column=column, text=text, rawType=raw_type,
                valueState=state, formula=None, cache=None, **extra)


def fixture(period_text="2015年10月", value="0", scope="A股(亿元)", note=None, title="股票筹资统计", **period_extra):
    """Merged IPO parent covers A/B/H leaves, with separate refinancing column."""
    cells = [cell(1, 1, title), cell(2, 1, "时间"), cell(2, 2, "首发筹资"),
             cell(2, 5, "再筹资"), cell(3, 2, scope), cell(3, 3, "B股(亿元)"),
             cell(3, 4, "H股(亿元)"), cell(3, 5, "A股(亿元)"),
             cell(4, 1, period_text, **period_extra), cell(4, 2, value, "2"),
             cell(4, 3, "0", "2"), cell(4, 4, "0", "2"), cell(4, 5, "0", "2")]
    if note:
        cells.append(cell(5, 1, note))
    table = dict(index=1, name="筹资", cells=cells, rowCount=5 if note else 4, columnCount=5,
                 mergedCells=[dict(startRow=2, endRow=2, startColumn=2, endColumn=4)])
    return dict(actualFormat="XLS", sheets=[table], tables=[], blockers=[])


class CsrcFieldMapTests(unittest.TestCase):
    def test_explicit_month_selects_native_row_with_original_locator(self):
        result = field_map(fixture(), "2015-10")
        self.assertEqual(result["fields"][IPO]["status"], "FIELD_CONDITIONS_READY")
        candidate = next(c for c in result["fields"][IPO]["candidates"] if not c["blockers"])
        self.assertEqual(candidate["periodSemantics"], "MONTH")
        self.assertEqual(candidate["periodLocator"]["text"], "2015年10月")
        self.assertEqual(candidate["valueLocator"]["column"], 2)
        self.assertNotIn("text", candidate["valueLocator"])
        self.assertEqual(candidate["rawUnit"], "亿元")

    def test_merged_parent_header_does_not_mix_a_b_h_siblings(self):
        result = field_map(fixture(), "2015-10")["fields"][IPO]
        self.assertEqual(len(result["candidates"]), 3)
        ready = [c for c in result["candidates"] if not c["blockers"]]
        self.assertEqual(len(ready), 1)
        self.assertEqual([h["text"] for h in ready[0]["headerPath"]], ["首发筹资", "A股(亿元)"])
        for candidate in result["candidates"][1:]:
            self.assertIn("MIXED_OR_NON_ACTUAL_FINANCING_SCOPE", candidate["blockers"])

    def test_ooxml_merged_reference_has_same_header_meaning(self):
        probe = fixture()
        probe["sheets"][0]["mergedCells"] = ["B2:D2"]
        self.assertEqual(field_map(probe, "2015-10")["fields"], field_map(fixture(), "2015-10")["fields"])

    def test_ytd_only_stays_ytd_and_never_differences(self):
        result = field_map(fixture(period_text="2015年1-10月累计", value="123"), "2015-10")
        self.assertEqual(result["tables"][0]["periodSemantics"], ["YTD"])
        self.assertEqual(result["fields"][IPO]["status"], "PARTIAL")
        self.assertTrue(all(c["periodSemantics"] == "YTD" for c in result["fields"][IPO]["candidates"]))
        self.assertEqual(result["fields"][IPO]["formalObservations"], [])

    def test_month_and_ytd_coexist_without_using_ytd_value(self):
        probe = fixture()
        probe["sheets"][0]["cells"] += [cell(5, 1, "本年累计"), cell(5, 2, "999", "2")]
        probe["sheets"][0]["rowCount"] = 5
        result = field_map(probe, "2015-10")
        self.assertEqual(result["tables"][0]["periodSemantics"], ["MONTH", "YTD"])
        ready = next(c for c in result["fields"][IPO]["candidates"] if not c["blockers"])
        self.assertEqual(ready["valueLocator"]["row"], 4)
        self.assertEqual(ready["valueState"], "REPORTED_ZERO")

    def test_real_zero_blank_dash_and_missing_cell_are_distinct(self):
        for value, expected in [("0", "REPORTED_ZERO"), (" ", "BLANK"), ("—", "DASH")]:
            with self.subTest(value=value):
                field = field_map(fixture(value=value), "2015-10")["fields"][IPO]
                self.assertEqual(field["candidates"][0]["valueState"], expected)
                self.assertEqual(field["status"], "FIELD_CONDITIONS_READY" if value == "0" else "PARTIAL")
        probe = fixture()
        probe["sheets"][0]["cells"] = [c for c in probe["sheets"][0]["cells"] if (c["row"], c["column"]) != (4, 2)]
        field = field_map(probe, "2015-10")["fields"][IPO]
        self.assertEqual(field["status"], "PARTIAL")
        self.assertEqual(field["candidates"][0]["valueState"], "ABSENT")

    def test_non_numeric_placeholder_is_not_ready_amount(self):
        for value in ("N/A", "未公布", "待核实", "NaN", "Infinity"):
            with self.subTest(value=value):
                self.assertEqual(field_map(fixture(value=value), "2015-10")["fields"][IPO]["status"], "PARTIAL")

    def test_ipo_mixed_scope_or_wrong_unit_cannot_be_ready(self):
        for scope in ("A股及B股(亿元)", "境内外A股(亿元)", "A股(亿美元)", "A股(亿元)债券", "A股(亿元)批准额度", "A股(亿元)家数"):
            with self.subTest(scope=scope):
                self.assertEqual(field_map(fixture(scope=scope), "2015-10")["fields"][IPO]["status"], "PARTIAL")

    def test_contradictory_original_scope_note_blocks_apparent_a_share_header(self):
        for note in ("注：以上A股筹资包括B股和境外H股金额。", "注：上述金额为批准额度，不是当月实际筹资。", "注：统计范围包括债券筹资。"):
            with self.subTest(note=note):
                result = field_map(fixture(note=note), "2015-10")
                self.assertEqual(result["fields"][IPO]["status"], "PARTIAL")
                self.assertEqual(result["tables"][0]["notes"][0]["text"], note)

    def test_nonactual_title_blocks_apparent_a_share_header(self):
        self.assertEqual(field_map(fixture(title="股票发行批准额度统计"), "2015-10")["fields"][IPO]["status"], "PARTIAL")

    def test_refinancing_cash_directional_and_bonds_still_require_accounting_map(self):
        for header in ("再筹资", "再融资 定向增发 现金认购", "再筹资 可转债"):
            probe = fixture()
            next(c for c in probe["sheets"][0]["cells"] if (c["row"], c["column"]) == (2, 5))["text"] = header
            result = field_map(probe, "2015-10")["fields"][REFINANCING]
            self.assertEqual(result["status"], "PARTIAL")
            self.assertIn("DEFINITION_UNRESOLVED_ACCOUNTING_MAP_REQUIRED", result["blockers"])
            if "债" in header:
                self.assertIn("BOND_OR_OVERSEAS_SCOPE", result["candidates"][0]["blockers"])
            self.assertEqual(result["formalObservations"], [])

    def test_missing_ipo_field_does_not_reuse_refinancing(self):
        probe = fixture()
        next(c for c in probe["sheets"][0]["cells"] if (c["row"], c["column"]) == (2, 2))["text"] = "股票发行家数"
        result = field_map(probe, "2015-10")["fields"][IPO]
        self.assertEqual(result["status"], "PARTIAL")
        self.assertIn("FIELD_MISSING", result["blockers"])

    def test_missing_or_duplicate_requested_month_is_partial(self):
        self.assertEqual(field_map(fixture(), "2015-09")["fields"][IPO]["status"], "PARTIAL")
        probe = fixture()
        probe["sheets"][0]["cells"] += [cell(5, 1, "2015年10月"), cell(5, 2, "1", "2")]
        probe["sheets"][0]["rowCount"] = 5
        self.assertEqual(field_map(probe, "2015-10")["fields"][IPO]["status"], "PARTIAL")

    def test_competing_ready_tables_are_unresolved(self):
        probe = fixture()
        second = copy.deepcopy(probe["sheets"][0])
        second.update(name="另一表", index=2)
        probe["sheets"].append(second)
        result = field_map(probe, "2015-10")["fields"][IPO]
        self.assertEqual(result["status"], "PARTIAL")
        self.assertIn("DEFINITION_UNRESOLVED", result["blockers"])

    def test_probe_format_or_formula_blockers_propagate(self):
        probe = fixture()
        probe["blockers"] = ["EXTENSION_FORMAT_MISMATCH"]
        self.assertIn("EXTENSION_FORMAT_MISMATCH", field_map(probe, "2015-10")["fields"][IPO]["blockers"])
        probe = fixture()
        amount = next(c for c in probe["sheets"][0]["cells"] if (c["row"], c["column"]) == (4, 2))
        amount.update(formula={"kind": "BIFF"}, cache={"status": "MISSING_OR_ERROR"})
        self.assertIn("FORMULA_CACHE_UNVERIFIED", field_map(probe, "2015-10")["fields"][IPO]["candidates"][0]["blockers"])

    def test_numeric_year_month_requires_source_two_decimal_format(self):
        self.assertEqual(row_period(cell(4, 1, "2015.1", "2", numberFormat="0.00")), ("2015-10", "MONTH"))
        self.assertEqual(row_period(cell(4, 1, "2015.1", "n", numberFormat="0.00_ ")), ("2015-10", "MONTH"))
        for raw_type, fmt in (("1", "0.00"), ("2", "General"), ("2", "0.0"), ("1", None)):
            self.assertEqual(row_period(cell(4, 1, "2015.1", raw_type, numberFormat=fmt)), (None, "UNRESOLVED"))
        self.assertEqual(row_period(cell(4, 1, "2015.10", "1")), ("2015-10", "MONTH"))
        self.assertEqual(row_period(cell(4, 1, "2015.01", "1")), ("2015-01", "MONTH"))

    def test_date_iso_uses_probed_date_metadata_without_guessing_serial(self):
        self.assertEqual(row_period(cell(4, 1, "38353", "3", dateIso="2005-01-01")), ("2005-01", "MONTH"))
        self.assertEqual(row_period(cell(4, 1, "38353", "2")), (None, "UNRESOLVED"))
        self.assertEqual(row_period(cell(4, 1, "2015.2", "2", numberFormat="0.00")), (None, "UNRESOLVED"))

    def test_year_month_two_place_proof_rejects_other_display_semantics(self):
        for fmt in ("0.000", "0.00%", "0.00E+00", '"0.00"'):
            with self.subTest(number_format=fmt):
                self.assertEqual(row_period(cell(4, 1, "2015.1", "2", numberFormat=fmt)), (None, "UNRESOLVED"))

    def test_numeric_october_vs_ambiguous_text_affects_ready_status(self):
        numeric = field_map(fixture(period_text="2015.1", raw_type="2", numberFormat="0.00"), "2015-10")
        text = field_map(fixture(period_text="2015.1", raw_type="1", numberFormat="0.00"), "2015-10")
        self.assertEqual(numeric["fields"][IPO]["status"], "FIELD_CONDITIONS_READY")
        self.assertEqual(text["fields"][IPO]["status"], "PARTIAL")

    def test_schema_signature_preserves_scope_break_but_excludes_amount(self):
        baseline = field_map(fixture(value="0"), "2015-10")
        self.assertEqual(baseline["fieldSchemaSignature"], field_map(fixture(value="10"), "2015-10")["fieldSchemaSignature"])
        self.assertNotEqual(baseline["fieldSchemaSignature"], field_map(fixture(scope="A股及B股(亿元)"), "2015-10")["fieldSchemaSignature"])

    def test_all_fields_remain_without_formal_observations(self):
        for field in field_map(fixture(), "2015-10")["fields"].values():
            self.assertEqual(field["formalObservations"], [])
            self.assertIsNone(field["definitionId"])


class CsrcAttachmentDisambiguationTests(unittest.TestCase):
    def test_first_attachment_is_rejected_if_period_conflicts(self):
        result = disambiguate([dict(attemptId="first", namedPeriods=["2015-09"], sha256="a" * 64),
                               dict(attemptId="second", namedPeriods=["2015-10"], sha256="b" * 64)], "2015-10")
        self.assertEqual(result["selectedAttemptIds"], ["second"])
        self.assertEqual(result["rejected"][0]["reason"], "ATTACHMENT_PERIOD_CONFLICT")

    def test_same_bytes_multiple_urls_preserve_all_identities(self):
        candidates = [dict(attemptId="a", url="https://www.csrc.gov.cn/a.xls", sha256="a" * 64),
                      dict(attemptId="b", url="https://www.csrc.gov.cn/b.xls", sha256="a" * 64)]
        result = disambiguate(candidates, "2015-10")
        self.assertEqual(result["status"], "UNIQUE_BYTES_CANDIDATE")
        self.assertEqual(result["selectedAttemptIds"], ["a", "b"])
        self.assertEqual(result["candidateAttemptIds"], ["a", "b"])

    def test_different_bytes_or_failed_retrieval_never_select_first(self):
        for candidates in ([dict(attemptId="a", sha256="a" * 64), dict(attemptId="b", sha256="b" * 64)],
                           [dict(attemptId="a", sha256="a" * 64), dict(attemptId="b", sha256=None)], []):
            result = disambiguate(candidates, "2015-10")
            self.assertEqual(result["status"], "DEFINITION_UNRESOLVED")
            self.assertEqual(result["selectedAttemptIds"], [])

    def test_attachment_naming_multiple_periods_stays_conflicted(self):
        result = disambiguate([dict(attemptId="a", namedPeriods=["2015-09", "2015-10"], sha256="a" * 64)], "2015-10")
        self.assertEqual(result["status"], "DEFINITION_UNRESOLVED")
        self.assertEqual(result["selectedAttemptIds"], [])


if __name__ == "__main__":
    unittest.main()
