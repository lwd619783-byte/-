from __future__ import annotations

import copy
import importlib.util
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_institution_consensus_probe.core import (
    USER_AGENT,
    PaginationContractError,
    ProbeContractError,
    calculate_statistics,
    collect_eastmoney_report_pages,
    extract_ths_contract,
    fetch_public,
    latest_by_institution,
    normalize_identity,
    normalize_ths_contract,
    parse_amount_to_yuan,
    parse_eastmoney_aggregate,
    parse_eastmoney_reports,
    parse_number,
    resolve_probe_date,
    shanghai_calendar_date,
    subtract_six_calendar_months,
    validate_cache_root,
    validate_probe_date,
)

FIXTURE = json.loads((ROOT / "scripts/tests/fixtures/a-share-institution-consensus-probe.minimal.json").read_text(encoding="utf-8"))
CLI_SPEC = importlib.util.spec_from_file_location("institution_consensus_probe_cli", ROOT / "scripts/probe-a-share-institution-consensus.py")
assert CLI_SPEC is not None and CLI_SPEC.loader is not None
CLI = importlib.util.module_from_spec(CLI_SPEC)
CLI_SPEC.loader.exec_module(CLI)


def make_page_fetcher(pages: list[dict[str, Any]], fail_on: int | None = None):
    calls: list[int] = []

    def fetch_page(page_no: int):
        calls.append(page_no)
        if page_no == fail_on:
            raise ProbeContractError("mock page failure")
        payload = copy.deepcopy(pages[page_no - 1])
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        return payload, {"httpStatus": 200, "attempts": 1}, raw

    return fetch_page, calls


def collect_fixture_pages(pages: list[dict[str, Any]] | None = None, **kwargs: Any):
    fetch_page, calls = make_page_fetcher(pages or FIXTURE["eastmoneyReportPages"])
    combined, artifacts = collect_eastmoney_report_pages(
        fetch_page,
        expected_code="600000",
        requested_page_size=kwargs.pop("requested_page_size", 2),
        sleeper=lambda _: None,
        **kwargs,
    )
    return combined, artifacts, calls


def institution_record(name: str, report_date: str, report_id: str | None, eps: float = 1.0) -> dict[str, Any]:
    return {
        "institution": name,
        "analyst": "分析师",
        "reportDate": report_date,
        "reportId": report_id,
        "epsByYear": {"2026": eps},
    }


class FakeResponse:
    def __init__(self, status_code: int, content: bytes = b"ok", *, url: str = "https://example.test/data", location: str = "") -> None:
        self.status_code = status_code
        self.content = content
        self.url = url
        self.headers = {"Content-Type": "application/json"}
        if location:
            self.headers["Location"] = location
        self.is_redirect = status_code in {301, 302, 303, 307, 308}
        self.is_permanent_redirect = status_code in {301, 308}


class SequenceGet:
    def __init__(self, outcomes: list[Any]) -> None:
        self.outcomes = list(outcomes)
        self.calls: list[dict[str, Any]] = []

    def __call__(self, url: str, **kwargs: Any):
        self.calls.append({"url": url, **kwargs})
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


class NumericContractTests(unittest.TestCase):
    def test_missing_values_remain_null(self):
        self.assertIsNone(parse_number("--"))
        self.assertIsNone(parse_number(""))
        self.assertIsNone(parse_number(None))

    def test_non_finite_fails_closed(self):
        with self.assertRaises(ProbeContractError):
            parse_number("Infinity")

    def test_amount_units_are_explicit(self):
        self.assertEqual(parse_amount_to_yuan("2.50亿"), 250_000_000)
        self.assertEqual(parse_amount_to_yuan("2.50", "亿元"), 250_000_000)

    def test_statistics_use_population_standard_deviation(self):
        stats = calculate_statistics([2.4, 2.5, 2.6])
        self.assertEqual(stats["median"], 2.5)
        self.assertAlmostEqual(stats["populationStdDev"], 0.08164965809277268)


class EastmoneyPaginationTests(unittest.TestCase):
    def test_single_page_is_complete(self):
        page = copy.deepcopy(FIXTURE["eastmoneyReportPages"][0])
        page["data"] += copy.deepcopy(FIXTURE["eastmoneyReportPages"][1]["data"])
        page.update({"hits": 4, "size": 4, "TotalPage": 1, "pageNo": 1})
        combined, artifacts, calls = collect_fixture_pages([page], requested_page_size=100)
        self.assertEqual(combined["paginationStatus"], "complete")
        self.assertTrue(combined["complete"])
        self.assertEqual((combined["expectedPageCount"], combined["fetchedPageCount"]), (1, 1))
        self.assertEqual((combined["expectedRecordCount"], combined["fetchedRecordCount"]), (4, 4))
        self.assertEqual((len(artifacts), calls), (1, [1]))

    def test_multiple_pages_are_fetched_serially_and_complete(self):
        combined, artifacts, calls = collect_fixture_pages(delay=0.1)
        self.assertEqual(calls, [1, 2])
        self.assertEqual(len(artifacts), 2)
        self.assertEqual(combined["fetchedRecordCount"], 4)
        self.assertEqual(combined["pageRecordCounts"], [{"pageNo": 1, "recordCount": 2}, {"pageNo": 2, "recordCount": 2}])
        result = parse_eastmoney_reports(combined, "600000")
        self.assertEqual((result["reportCount"], result["distinctInstitutionCount"]), (4, 3))

    def test_second_page_failure_fails_closed_with_partial_counts(self):
        fetch_page, calls = make_page_fetcher(FIXTURE["eastmoneyReportPages"], fail_on=2)
        with self.assertRaises(PaginationContractError) as raised:
            collect_eastmoney_report_pages(fetch_page, expected_code="600000", requested_page_size=2, sleeper=lambda _: None)
        self.assertEqual(calls, [1, 2])
        self.assertFalse(raised.exception.details["complete"])
        self.assertEqual(raised.exception.details["fetchedPageCount"], 1)

    def test_total_page_count_change_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[1]["TotalPage"] = 3
        with self.assertRaises(PaginationContractError):
            collect_fixture_pages(pages)

    def test_total_record_count_change_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[1]["hits"] = 3
        pages[1]["size"] = 1
        pages[1]["data"] = pages[1]["data"][:1]
        with self.assertRaises(PaginationContractError):
            collect_fixture_pages(pages)

    def test_duplicate_page_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[1]["data"] = copy.deepcopy(pages[0]["data"])
        with self.assertRaisesRegex(PaginationContractError, "duplicate page"):
            collect_fixture_pages(pages)

    def test_duplicate_report_id_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[1]["data"][0]["infoCode"] = pages[0]["data"][0]["infoCode"]
        with self.assertRaisesRegex(PaginationContractError, "duplicate report ID"):
            collect_fixture_pages(pages)

    def test_declared_record_count_shortfall_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[1]["size"] = 1
        pages[1]["data"] = pages[1]["data"][:1]
        with self.assertRaises(PaginationContractError):
            collect_fixture_pages(pages)

    def test_empty_intermediate_page_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[0].update({"hits": 5, "TotalPage": 3})
        pages[1].update({"hits": 5, "TotalPage": 3, "size": 0, "data": []})
        with self.assertRaises(PaginationContractError):
            collect_fixture_pages(pages)

    def test_page_safety_limit_fails_closed(self):
        with self.assertRaisesRegex(PaginationContractError, "safety limit"):
            collect_fixture_pages(max_pages=1)

    def test_record_safety_limit_fails_closed(self):
        with self.assertRaisesRegex(PaginationContractError, "safety limit"):
            collect_fixture_pages(max_records=3)

    def test_cross_page_stock_identity_mismatch_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[1]["data"][0]["stockCode"] = "600001"
        with self.assertRaisesRegex(PaginationContractError, "identity mismatch"):
            collect_fixture_pages(pages)

    def test_missing_pagination_metadata_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        del pages[0]["pageNo"]
        with self.assertRaisesRegex(PaginationContractError, "metadata is missing"):
            collect_fixture_pages(pages)

    def test_cross_page_schema_drift_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[1]["data"][0]["unexpectedField"] = "drift"
        pages[1]["data"][1]["unexpectedField"] = "drift"
        with self.assertRaisesRegex(PaginationContractError, "schema drifted across pages"):
            collect_fixture_pages(pages)

    def test_legal_empty_result_is_complete_empty(self):
        page = {"hits": 0, "size": 0, "TotalPage": 0, "pageNo": 1, "currentYear": 2026, "data": []}
        combined, artifacts, calls = collect_fixture_pages([page], requested_page_size=100)
        self.assertEqual(combined["paginationStatus"], "complete_empty")
        self.assertEqual((combined["expectedPageCount"], combined["fetchedPageCount"]), (0, 1))
        self.assertEqual(parse_eastmoney_reports(combined, "600000")["availability"], "no_reports")
        self.assertEqual((len(artifacts), calls), (1, [1]))

    def test_partial_payload_cannot_be_parsed_as_complete(self):
        with self.assertRaisesRegex(ProbeContractError, "not proven complete"):
            parse_eastmoney_reports(FIXTURE["eastmoneyReportPages"][0], "600000")


class EastmoneyContractTests(unittest.TestCase):
    def test_aggregate_contract(self):
        result = parse_eastmoney_aggregate(FIXTURE["eastmoneyAggregate"], "600000")
        self.assertEqual(result["institutionCount"], 3)
        self.assertEqual(result["forecasts"][1]["eps"], 2.5)

    def test_report_list_deduplicates_by_latest_institution_report(self):
        combined, _, _ = collect_fixture_pages()
        result = parse_eastmoney_reports(combined, "600000")
        latest_by_name = {row["institution"]: row for row in result["latestReportsByInstitution"]}
        self.assertEqual(latest_by_name["甲证券"]["reportId"], "REPORT-A2")
        self.assertAlmostEqual(result["statisticsByYear"]["2026"]["mean"], 2.5)

    def test_report_list_missing_analyst_fails_closed(self):
        pages = copy.deepcopy(FIXTURE["eastmoneyReportPages"])
        pages[0]["data"][0]["researcher"] = ""
        combined, _, _ = collect_fixture_pages(pages)
        with self.assertRaises(ProbeContractError):
            parse_eastmoney_reports(combined, "600000")

    def test_stock_identity_mismatch_fails_closed(self):
        with self.assertRaises(ProbeContractError):
            parse_eastmoney_aggregate(FIXTURE["eastmoneyAggregate"], "600001")

    def test_documented_empty_response_is_no_forecast(self):
        payload = {"version": None, "result": None, "success": False, "message": "返回数据为空", "code": 9201}
        self.assertEqual(parse_eastmoney_aggregate(payload, "600000")["availability"], "no_forecast")


class InstitutionSelectionTests(unittest.TestCase):
    def test_different_dates_select_latest_calendar_date(self):
        selected = latest_by_institution([
            institution_record("甲证券", "2026-06-30", "A1"),
            institution_record("甲证券", "2026-07-01", "A2"),
        ])
        self.assertEqual(selected[0]["reportId"], "A2")

    def test_same_day_missing_report_id_fails_closed(self):
        with self.assertRaisesRegex(ProbeContractError, "lack stable report IDs"):
            latest_by_institution([
                institution_record("甲证券", "2026-07-01", None),
                institution_record("甲证券", "2026-07-01", None, 1.1),
            ])

    def test_same_day_duplicate_report_id_with_conflicting_content_fails_closed(self):
        with self.assertRaisesRegex(ProbeContractError, "conflicting content"):
            latest_by_institution([
                institution_record("甲证券", "2026-07-01", "A1", 1.0),
                institution_record("甲证券", "2026-07-01", "A1", 1.1),
            ])

    def test_same_day_distinct_ids_without_ordering_semantics_is_ambiguous(self):
        with self.assertRaisesRegex(ProbeContractError, "ambiguous"):
            latest_by_institution([
                institution_record("甲证券", "2026-07-01", "A1", 1.0),
                institution_record("甲证券", "2026-07-01", "A2", 1.1),
            ])

    def test_older_same_day_ambiguity_still_fails_closed(self):
        with self.assertRaisesRegex(ProbeContractError, "ambiguous"):
            latest_by_institution([
                institution_record("甲证券", "2026-06-01", "A1", 1.0),
                institution_record("甲证券", "2026-06-01", "A2", 1.1),
                institution_record("甲证券", "2026-07-01", "A3", 1.2),
            ])

    def test_prefix_similar_institutions_are_not_merged(self):
        selected = latest_by_institution([
            institution_record("中信", "2026-07-01", "A1"),
            institution_record("中信证券", "2026-07-01", "A2"),
            institution_record("中信证券股份有限公司", "2026-07-01", "A3"),
        ])
        self.assertEqual(len(selected), 3)

    def test_nfkc_full_width_whitespace_and_case_are_normalized(self):
        self.assertEqual(normalize_identity("  Foo　 Securities  "), normalize_identity("foo securities"))
        self.assertNotEqual(normalize_identity("中信"), normalize_identity("中信证券"))

    def test_invalid_calendar_date_fails_closed(self):
        with self.assertRaises(ProbeContractError):
            latest_by_institution([institution_record("甲证券", "2026-02-30", "A1")])


class ThsContractTests(unittest.TestCase):
    def test_structured_contract_recomputes_complete_display(self):
        result = normalize_ths_contract(FIXTURE["thsStructured"], "600000")
        self.assertEqual(result["detailCompleteness"], "complete")
        self.assertEqual(result["display"]["netProfitYuanUnqualified"], 2_500_000_000)
        self.assertEqual(result["visibleDetailRecomputesDisplay"], {"eps": True, "netProfitUnqualified": True})
        self.assertEqual(result["upstreamReportIdentityStatus"], "missing_stable_report_id")
        self.assertFalse(result["providerAdmissionEligible"])

    def test_truncated_details_do_not_claim_recomputation(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"])
        contract["detailRows"].pop()
        result = normalize_ths_contract(contract, "600000")
        self.assertEqual(result["detailCompleteness"], "truncated_or_filtered")
        self.assertFalse(result["visibleDetailRecomputesDisplay"]["eps"])

    def test_same_institution_same_day_without_report_id_fails_closed(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"])
        duplicate = copy.deepcopy(contract["detailRows"][2])
        duplicate[2] = "2.41"
        contract["detailRows"].append(duplicate)
        with self.assertRaisesRegex(ProbeContractError, "lack stable report IDs"):
            normalize_ths_contract(contract, "600000")

    def test_same_institution_different_dates_selects_latest_but_remains_ineligible(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"])
        older = copy.deepcopy(contract["detailRows"][2])
        older[-1] = "2026-06-01"
        contract["detailRows"].append(older)
        result = normalize_ths_contract(contract, "600000")
        self.assertEqual(result["visibleDetailCount"], 4)
        self.assertEqual(result["visibleDistinctInstitutionCount"], 3)
        self.assertEqual(result["upstreamReportIdentityStatus"], "missing_stable_report_id")
        self.assertFalse(result["providerAdmissionEligible"])

    def test_aggregate_year_order_mismatch_fails_closed(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"])
        contract["aggregateTables"][1][1:] = list(reversed(contract["aggregateTables"][1][1:]))
        with self.assertRaisesRegex(ProbeContractError, "year order differs"):
            normalize_ths_contract(contract, "600000")

    def test_detail_year_header_misalignment_fails_closed(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"])
        contract["detailRows"][1][0], contract["detailRows"][1][1] = contract["detailRows"][1][1], contract["detailRows"][1][0]
        with self.assertRaisesRegex(ProbeContractError, "year columns"):
            normalize_ths_contract(contract, "600000")

    def test_detail_column_count_drift_fails_closed(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"])
        contract["detailRows"][2].insert(2, "unexpected")
        with self.assertRaisesRegex(ProbeContractError, "column count"):
            normalize_ths_contract(contract, "600000")

    def test_aggregate_header_drift_fails_closed(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"])
        contract["aggregateTables"][0][0][3] = "平均"
        with self.assertRaisesRegex(ProbeContractError, "header changed"):
            normalize_ths_contract(contract, "600000")

    def test_minimal_html_parser_has_no_report_body_dependency(self):
        html = """
        <html><head><title>示例公司(600000) 盈利预测_F10_同花顺金融服务网</title></head><body>
        <p>截至2026-07-22，6个月以内共有 <strong>3</strong> 家机构对示例公司的2026年度业绩作出预测；
        预测2026年每股收益 <strong>2.50</strong> 元，预测2026年净利润 <strong>25.00</strong> 亿元</p>
        <table><tr><th>年度</th><th>预测机构数</th><th>最小值</th><th>均值</th><th>最大值</th><th>行业平均数</th></tr><tr><td>2026</td><td>3</td><td>2.4</td><td>2.5</td><td>2.6</td><td>1.0</td></tr></table>
        <table><tr><th>年度</th><th>预测机构数</th><th>最小值</th><th>均值</th><th>最大值</th><th>行业平均数</th></tr><tr><td>2026</td><td>3</td><td>24</td><td>25</td><td>26</td><td>10</td></tr></table>
        <table><tr><th>机构名称</th><th>研究员</th><th>预测年报每股收益（元）</th><th>预测年报净利润（元）</th><th>报告日期</th></tr><tr><th>2026预测</th><th>2026预测</th></tr><tr><td>甲证券</td><td>甲分析师</td><td>2.4</td><td>24亿</td><td>2026-07-01</td></tr></table>
        </body></html>
        """
        contract = extract_ths_contract(html, "600000")
        self.assertEqual(contract["statement"]["institutionCount"], 3)
        result = normalize_ths_contract(contract, "600000")
        self.assertEqual(result["aggregates"]["eps"]["2026"]["mean"], 2.5)

    def test_missing_tables_fail_closed(self):
        html = "<title>示例公司(600000) 盈利预测</title><p>截至2026-07-22，6个月以内共有 3 家机构对示例公司的2026年度业绩作出预测；预测2026年每股收益 2.50 元，预测2026年净利润 25.00 亿元</p>"
        with self.assertRaises(ProbeContractError):
            extract_ths_contract(html, "600000")

    def test_explicit_no_forecast_page_is_not_schema_failure(self):
        html = "<title>示例公司(600000) 盈利预测</title><p>本年度暂无机构做出业绩预测</p>"
        result = normalize_ths_contract(extract_ths_contract(html, "600000"), "600000")
        self.assertEqual(result["availability"], "no_forecast")


class TimeContractTests(unittest.TestCase):
    def test_cli_as_of_default_is_not_frozen_at_import_time(self):
        self.assertIsNone(CLI.options([]).as_of)

    def test_cli_preserves_explicit_as_of_argument(self):
        self.assertEqual(CLI.options(["--as-of", "2026-06-30"]).as_of, "2026-06-30")

    def test_shanghai_date_uses_timezone_boundary_not_host_date(self):
        fixed_utc = datetime(2026, 1, 1, 16, 30, tzinfo=timezone.utc)
        self.assertEqual(shanghai_calendar_date(lambda _: fixed_utc), "2026-01-02")

    def test_default_date_uses_shanghai_clock(self):
        fixed_utc = datetime(2026, 7, 21, 16, 30, tzinfo=timezone.utc)
        self.assertEqual(resolve_probe_date(None, lambda _: fixed_utc), "2026-07-22")

    def test_explicit_as_of_takes_priority_without_calling_clock(self):
        def forbidden_clock(_):
            raise AssertionError("clock must not be called")

        self.assertEqual(resolve_probe_date("2026-06-30", forbidden_clock), "2026-06-30")

    def test_january_31_minus_six_months(self):
        self.assertEqual(subtract_six_calendar_months("2026-01-31"), "2025-07-31")

    def test_march_31_minus_six_months_falls_back_to_month_end(self):
        self.assertEqual(subtract_six_calendar_months("2026-03-31"), "2025-09-30")

    def test_leap_day_minus_six_months(self):
        self.assertEqual(subtract_six_calendar_months("2024-02-29"), "2023-08-29")

    def test_target_leap_february_month_end(self):
        self.assertEqual(subtract_six_calendar_months("2024-08-31"), "2024-02-29")

    def test_cross_year_window(self):
        self.assertEqual(subtract_six_calendar_months("2026-05-31"), "2025-11-30")

    def test_invalid_date_fails_closed(self):
        for value in ("2026-02-30", "2026-2-3", "not-a-date"):
            with self.subTest(value=value), self.assertRaises(ProbeContractError):
                validate_probe_date(value)


class HttpSafetyTests(unittest.TestCase):
    def fetch(self, getter: SequenceGet, retries: int = 1):
        return fetch_public(
            "https://example.test/data",
            timeout=2,
            retries=retries,
            accept="application/json",
            get=getter,
            sleeper=lambda _: None,
            monotonic=lambda: 1.0,
        )

    def test_non_https_is_rejected_before_transport(self):
        getter = SequenceGet([FakeResponse(200)])
        with self.assertRaisesRegex(ProbeContractError, "only HTTPS"):
            fetch_public("http://example.test/data", timeout=2, retries=1, accept="application/json", get=getter)
        self.assertEqual(len(getter.calls), 0)

    def test_redirect_statuses_are_rejected_without_following(self):
        for status in (301, 302, 307, 308):
            with self.subTest(status=status):
                getter = SequenceGet([FakeResponse(status, location="http://example.test/other")])
                with self.assertRaisesRegex(ProbeContractError, "redirect refused"):
                    self.fetch(getter)
                self.assertFalse(getter.calls[0]["allow_redirects"])

    def test_429_retries_with_finite_attempts(self):
        getter = SequenceGet([FakeResponse(429), FakeResponse(200)])
        _, metadata = self.fetch(getter)
        self.assertEqual((len(getter.calls), metadata["attempts"]), (2, 2))

    def test_retryable_server_errors(self):
        for status in (500, 502, 503):
            with self.subTest(status=status):
                getter = SequenceGet([FakeResponse(status), FakeResponse(200)])
                _, metadata = self.fetch(getter)
                self.assertEqual(metadata["attempts"], 2)

    def test_ordinary_4xx_does_not_retry(self):
        getter = SequenceGet([FakeResponse(404), FakeResponse(200)])
        with self.assertRaisesRegex(ProbeContractError, "HTTP 404"):
            self.fetch(getter)
        self.assertEqual(len(getter.calls), 1)

    def test_timeout_fails_after_finite_retries(self):
        getter = SequenceGet([requests.Timeout(), requests.Timeout()])
        with self.assertRaisesRegex(ProbeContractError, "network failure after 2 attempts"):
            self.fetch(getter)
        self.assertEqual(len(getter.calls), 2)

    def test_connection_error_fails_after_finite_retries(self):
        getter = SequenceGet([requests.ConnectionError(), requests.ConnectionError()])
        with self.assertRaisesRegex(ProbeContractError, "ConnectionError"):
            self.fetch(getter)
        self.assertEqual(len(getter.calls), 2)

    def test_retry_count_is_capped_at_two(self):
        getter = SequenceGet([requests.Timeout(), requests.Timeout(), requests.Timeout(), FakeResponse(200)])
        with self.assertRaisesRegex(ProbeContractError, "after 3 attempts"):
            self.fetch(getter, retries=99)
        self.assertEqual(len(getter.calls), 3)

    def test_headers_exclude_cookie_and_authorization(self):
        getter = SequenceGet([FakeResponse(200)])
        self.fetch(getter)
        headers = getter.calls[0]["headers"]
        self.assertEqual(headers, {"User-Agent": USER_AGENT, "Accept": "application/json"})
        self.assertNotIn("Cookie", headers)
        self.assertNotIn("Authorization", headers)

    def test_cache_path_must_stay_under_data_cache(self):
        allowed = ROOT / "data-cache"
        child = validate_cache_root(allowed / "a-share-institution-consensus-probe", allowed)
        self.assertEqual(child, (allowed / "a-share-institution-consensus-probe").resolve())
        with self.assertRaisesRegex(ProbeContractError, "must stay under"):
            validate_cache_root(ROOT / "public", allowed)


if __name__ == "__main__":
    unittest.main()
