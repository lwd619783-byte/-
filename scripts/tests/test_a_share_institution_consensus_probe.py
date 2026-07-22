from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_institution_consensus_probe.core import (
    ProbeContractError,
    calculate_statistics,
    extract_ths_contract,
    normalize_identity,
    normalize_ths_contract,
    parse_amount_to_yuan,
    parse_eastmoney_aggregate,
    parse_eastmoney_reports,
    parse_number,
)

FIXTURE = json.loads((ROOT / "scripts/tests/fixtures/a-share-institution-consensus-probe.minimal.json").read_text(encoding="utf-8"))


class NumericContractTests(unittest.TestCase):
    def test_missing_values_remain_null(self):
        self.assertIsNone(parse_number("--")); self.assertIsNone(parse_number("")); self.assertIsNone(parse_number(None))

    def test_non_finite_fails_closed(self):
        with self.assertRaises(ProbeContractError): parse_number("Infinity")

    def test_amount_units_are_explicit(self):
        self.assertEqual(parse_amount_to_yuan("2.50亿"), 250_000_000)
        self.assertEqual(parse_amount_to_yuan("2.50", "亿元"), 250_000_000)

    def test_statistics_use_population_standard_deviation(self):
        stats = calculate_statistics([2.4, 2.5, 2.6])
        self.assertEqual(stats["median"], 2.5); self.assertAlmostEqual(stats["populationStdDev"], 0.08164965809277268)


class EastmoneyContractTests(unittest.TestCase):
    def test_aggregate_contract(self):
        result = parse_eastmoney_aggregate(FIXTURE["eastmoneyAggregate"], "600000")
        self.assertEqual(result["institutionCount"], 3); self.assertEqual(result["forecasts"][1]["eps"], 2.5)

    def test_report_list_deduplicates_by_latest_institution_report(self):
        result = parse_eastmoney_reports(FIXTURE["eastmoneyReports"], "600000")
        self.assertEqual((result["reportCount"], result["distinctInstitutionCount"]), (4, 3))
        latest_by_name = {row["institution"]: row for row in result["latestReportsByInstitution"]}
        self.assertEqual(latest_by_name["甲证券"]["reportId"], "REPORT-A2")
        self.assertAlmostEqual(result["statisticsByYear"]["2026"]["mean"], 2.5)

    def test_report_list_missing_analyst_fails_closed(self):
        payload = copy.deepcopy(FIXTURE["eastmoneyReports"]); payload["data"][0]["researcher"] = ""
        with self.assertRaises(ProbeContractError): parse_eastmoney_reports(payload, "600000")

    def test_stock_identity_mismatch_fails_closed(self):
        with self.assertRaises(ProbeContractError): parse_eastmoney_aggregate(FIXTURE["eastmoneyAggregate"], "600001")

    def test_documented_empty_response_is_no_forecast(self):
        payload = {"version": None, "result": None, "success": False, "message": "返回数据为空", "code": 9201}
        self.assertEqual(parse_eastmoney_aggregate(payload, "600000")["availability"], "no_forecast")


class ThsContractTests(unittest.TestCase):
    def test_structured_contract_recomputes_complete_display(self):
        result = normalize_ths_contract(FIXTURE["thsStructured"], "600000")
        self.assertEqual(result["detailCompleteness"], "complete")
        self.assertEqual(result["display"]["netProfitYuanUnqualified"], 2_500_000_000)
        self.assertEqual(result["visibleDetailRecomputesDisplay"], {"eps": True, "netProfitUnqualified": True})

    def test_truncated_details_do_not_claim_recomputation(self):
        contract = copy.deepcopy(FIXTURE["thsStructured"]); contract["detailRows"].pop()
        result = normalize_ths_contract(contract, "600000")
        self.assertEqual(result["detailCompleteness"], "truncated_or_filtered")
        self.assertFalse(result["visibleDetailRecomputesDisplay"]["eps"])

    def test_minimal_html_parser_has_no_report_body_dependency(self):
        html = """
        <html><head><title>示例公司(600000) 盈利预测_F10_同花顺金融服务网</title></head><body>
        <p>截至2026-07-22，6个月以内共有 <strong>3</strong> 家机构对示例公司的2026年度业绩作出预测；
        预测2026年每股收益 <strong>2.50</strong> 元，预测2026年净利润 <strong>25.00</strong> 亿元</p>
        <table><tr><th>年度</th><th>预测机构数</th><th>最小值</th><th>均值</th><th>最大值</th></tr><tr><td>2026</td><td>3</td><td>2.4</td><td>2.5</td><td>2.6</td></tr></table>
        <table><tr><th>年度</th><th>预测机构数</th><th>最小值</th><th>均值</th><th>最大值</th></tr><tr><td>2026</td><td>3</td><td>24</td><td>25</td><td>26</td></tr></table>
        <table><tr><th>机构名称</th><th>研究员</th><th>报告日期</th></tr><tr><td>甲证券</td><td>甲分析师</td><td>2.4</td><td>2.9</td><td>3.3</td><td>24亿</td><td>29亿</td><td>33亿</td><td>2026-07-01</td></tr></table>
        </body></html>
        """
        contract = extract_ths_contract(html, "600000")
        self.assertEqual(contract["statement"]["institutionCount"], 3)
        self.assertEqual(len(contract["aggregateTables"]), 2)

    def test_missing_tables_fail_closed(self):
        html = "<title>示例公司(600000) 盈利预测</title><p>截至2026-07-22，6个月以内共有 3 家机构对示例公司的2026年度业绩作出预测；预测2026年每股收益 2.50 元，预测2026年净利润 25.00 亿元</p>"
        with self.assertRaises(ProbeContractError): extract_ths_contract(html, "600000")

    def test_explicit_no_forecast_page_is_not_schema_failure(self):
        html = "<title>示例公司(600000) 盈利预测</title><p>本年度暂无机构做出业绩预测</p>"
        self.assertEqual(normalize_ths_contract(extract_ths_contract(html, "600000"), "600000")["availability"], "no_forecast")

    def test_identity_normalization_is_not_fuzzy(self):
        self.assertEqual(normalize_identity(" 甲　证券 "), normalize_identity("甲 证券"))
        self.assertNotEqual(normalize_identity("中信"), normalize_identity("中信证券"))


if __name__ == "__main__":
    unittest.main()
