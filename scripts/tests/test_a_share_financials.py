from __future__ import annotations

import json
import math
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_financials.core import (
    BALANCE_FIELDS, FLOW_FIELDS, build_company_record, build_summary, derive_single_quarters,
    normalize_amount, parse_number, safe_change, select_report_versions, validate_dataset,
)
from a_share_financials.artifacts import publish_staged_artifacts, validate_split_artifacts, write_staged_artifacts
from a_share_financials.provider import ProviderError, SinaFinancialProvider


def raw_report(period: str, rows: dict[str, object], report_type="合并期末"):
    return {"rType": report_type, "rCurrency": "CNY", "data_source": "定期报告", "is_audit": "未审计", "publish_date": period, "update_time": "1700000000", "data": [{"item_title": key, "item_value": value} for key, value in rows.items()]}


def raw_period(period: str, revenue=100, cost=60, parent_profit=10, deducted=9, ocf=8):
    return {
        "lrb": {period: raw_report(period, {"营业收入": revenue, "营业成本": cost, "营业利润": 12, "利润总额": 11, "净利润": 10, "归属于母公司所有者的净利润": parent_profit, "研发费用": 5})},
        "fzb": {period: raw_report(period, {"资产总计": 1000, "负债合计": 400, "归属于母公司股东权益合计": 500, "应收账款": 20, "存货": 30})},
        "llb": {period: raw_report(period, {"经营活动产生的现金流量净额": ocf})},
        "gjzb": {period: raw_report(period, {"扣非净利润": deducted})},
    }


def merge_raw(*parts):
    merged = {source: {} for source in ("lrb", "fzb", "llb", "gjzb")}
    for part in parts:
        for source in merged:
            merged[source].update(part[source])
    return merged


class CoreTests(unittest.TestCase):
    stock = {"id": "demo", "code": "300001", "name": "测试科技", "market": "A股", "exchange": "SZ"}

    def test_unit_and_null_normalization(self):
        self.assertEqual(normalize_amount("1.25", "亿元"), 125_000_000)
        self.assertEqual(normalize_amount("2", "万元"), 20_000)
        self.assertIsNone(parse_number(None))
        self.assertIsNone(parse_number("NaN"))
        self.assertEqual(parse_number("0"), 0)

    def test_stock_code_adapter(self):
        with tempfile.TemporaryDirectory() as folder:
            provider = SinaFinancialProvider(Path(folder))
            self.assertEqual(provider.paper_code(self.stock), "sz300001")
            self.assertEqual(provider.paper_code({**self.stock, "exchange": "SH"}), "sh300001")
            self.assertEqual(provider.paper_code({**self.stock, "exchange": "BJ"}), "bj300001")

    def test_chinese_mapping_and_q1(self):
        record = build_company_record(self.stock, raw_period("20250331"), "2025-04-30T00:00:00Z", "2025-04-30T00:00:00Z")
        report = record["reports"][0]
        self.assertEqual(report["cumulative"]["operatingRevenue"], 100)
        self.assertEqual(report["cumulative"]["netProfitExcludingNonRecurring"], 9)
        self.assertEqual(report["singleQuarter"]["operatingRevenue"], 100)
        self.assertFalse(report["isDerived"])

    def test_q2_q3_q4_derivation_and_balance_not_subtracted(self):
        raw = merge_raw(raw_period("20250331", 100), raw_period("20250630", 220), raw_period("20250930", 360), raw_period("20251231", 520))
        reports = build_company_record(self.stock, raw, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")["reports"]
        by_type = {r["reportType"]: r for r in reports}
        self.assertEqual(by_type["H1"]["singleQuarter"]["operatingRevenue"], 120)
        self.assertEqual(by_type["Q3"]["singleQuarter"]["operatingRevenue"], 140)
        self.assertEqual(by_type["FY"]["singleQuarter"]["operatingRevenue"], 160)
        self.assertTrue(set(by_type["FY"]["singleQuarter"]) == set(FLOW_FIELDS))
        self.assertTrue(all(field not in by_type["FY"]["singleQuarter"] for field in BALANCE_FIELDS))
        self.assertEqual(by_type["FY"]["balanceSheet"]["totalAssets"], 1000)

    def test_missing_predecessor_not_derived(self):
        report = build_company_record(self.stock, raw_period("20250630"), "2025-08-01T00:00:00Z", "2025-08-01T00:00:00Z")["reports"][0]
        self.assertIsNone(report["singleQuarter"])
        self.assertIn("missing", report["derivationMethod"])

    def test_yoy_qoq_same_basis(self):
        raw = merge_raw(raw_period("20240331", 50), raw_period("20250331", 100), raw_period("20250630", 250))
        reports = build_company_record(self.stock, raw, "2025-08-01T00:00:00Z", "2025-08-01T00:00:00Z")["reports"]
        q1 = next(r for r in reports if r["reportPeriod"] == "2025-03-31")
        h1 = next(r for r in reports if r["reportPeriod"] == "2025-06-30")
        self.assertEqual(q1["derived"]["revenueYoY"]["value"], 1)
        self.assertEqual(h1["derived"]["revenueQoQ"]["value"], 0.5)

    def test_zero_and_negative_denominator(self):
        zero = safe_change(10, 0)
        self.assertIsNone(zero["value"])
        self.assertEqual(zero["reason"], "denominator_zero")
        negative = safe_change(-5, -10)
        self.assertEqual(negative["value"], 0.5)
        self.assertEqual(negative["baseSign"], "negative")

    def test_financial_industry_not_applicable(self):
        bank = {**self.stock, "name": "测试银行"}
        report = build_company_record(bank, raw_period("20250331"), "2025-04-30T00:00:00Z", "2025-04-30T00:00:00Z")["reports"][0]
        self.assertIsNone(report["derived"]["grossMargin"])
        self.assertEqual(report["fieldStatus"]["grossMargin"], "not_applicable")

    def test_restatement_selection_and_conflict(self):
        base = build_company_record(self.stock, raw_period("20250331"), "2025-04-30T00:00:00Z", "2025-04-30T00:00:00Z")["reports"][0]
        parent = {**deepcopy(base), "statementScope": "parent", "announcementDate": "2025-05-01"}
        selected = select_report_versions([parent, base])
        self.assertEqual(selected[0]["statementScope"], "consolidated")
        duplicate = deepcopy(base)
        duplicate["cumulative"]["operatingRevenue"] = 999
        self.assertEqual(select_report_versions([base, duplicate])[0]["status"], "conflicted")

    def test_validator_rejects_nonfinite_and_summary_drift(self):
        record = build_company_record(self.stock, raw_period("20250331"), "2025-04-30T00:00:00Z", "2025-04-30T00:00:00Z")
        record["reports"][0]["cumulative"]["operatingRevenue"] = math.inf
        items = {"demo": record}
        dataset = {"items": items, "summary": build_summary(items)}
        errors = validate_dataset(dataset, [self.stock])
        self.assertTrue(any("non-finite" in error for error in errors))
        dataset["summary"]["successCompanies"] = 99
        self.assertTrue(any("summary" in error for error in validate_dataset(dataset, [self.stock])))


class ProviderFailureTests(unittest.TestCase):
    stock = {"id": "demo", "code": "600001", "name": "测试", "market": "A股", "exchange": "SH"}

    def provider_with_response(self, payload):
        session = Mock()
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = payload
        session.get.return_value = response
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        return SinaFinancialProvider(Path(folder.name), retries=0, delay=0, session=session)

    def test_empty_table_and_changed_schema(self):
        provider = self.provider_with_response({"result": {"data": {}}})
        with self.assertRaises(ProviderError):
            provider.fetch(self.stock)

    def test_network_failure(self):
        session = Mock()
        session.get.side_effect = __import__("requests").RequestException("offline")
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        provider = SinaFinancialProvider(Path(folder.name), retries=0, delay=0, session=session)
        with self.assertRaises(ProviderError):
            provider.fetch(self.stock)

    def test_cached_response_preserves_provider_fetch_time(self):
        provider = self.provider_with_response({"result": {"data": {"report_list": {}}}})
        provider.fetch(self.stock, use_cache=False)
        first_fetch_time = provider.last_fetched_at
        provider.fetch(self.stock, use_cache=True)
        self.assertEqual(provider.last_fetched_at, first_fetch_time)

    def test_stable_json_sorting_contract(self):
        payload = {"items": dict(sorted({"z": {}, "a": {}}.items()))}
        first = json.dumps(payload, ensure_ascii=False, indent=2)
        second = json.dumps(payload, ensure_ascii=False, indent=2)
        self.assertEqual(first, second)
        self.assertLess(first.index('"a"'), first.index('"z"'))


class SplitArtifactTests(unittest.TestCase):
    stock = {"id": "demo", "code": "300001", "name": "测试科技", "market": "A股", "exchange": "SZ"}

    def record(self):
        return build_company_record(self.stock, raw_period("20250331"), "2025-04-30T00:00:00Z", "2025-04-30T00:00:00Z")

    def test_summary_manifest_and_detail_are_consistent(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            summary, manifest, details = write_staged_artifacts({"demo": self.record()}, "2025-04-30T00:00:00Z", root)
            self.assertEqual(validate_split_artifacts(summary, manifest, details, {"demo"}), [])
            manifest_data = json.loads(manifest.read_text(encoding="utf-8"))
            self.assertEqual(manifest_data["total"], 1)
            self.assertEqual(manifest_data["items"][0]["relativePath"], "data/a-share-financials/demo.json")

    def test_checksum_or_orphan_file_fails_validation(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            summary, manifest, details = write_staged_artifacts({"demo": self.record()}, "2025-04-30T00:00:00Z", root)
            (details / "demo.json").write_text("{}\n", encoding="utf-8")
            (details / "orphan.json").write_text("{}\n", encoding="utf-8")
            errors = validate_split_artifacts(summary, manifest, details, {"demo"})
            self.assertTrue(any("checksum" in error for error in errors))
            self.assertTrue(any("orphan" in error for error in errors))

    def test_manifest_path_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            summary, manifest, details = write_staged_artifacts({"demo": self.record()}, "2025-04-30T00:00:00Z", root)
            value = json.loads(manifest.read_text(encoding="utf-8"))
            value["items"][0]["relativePath"] = "data/a-share-financials/../secret.json"
            manifest.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
            self.assertTrue(any("unsafe" in error for error in validate_split_artifacts(summary, manifest, details, {"demo"})))

    def test_publish_failure_restores_previous_detail_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            output_details = root / "public/data/a-share-financials"
            output_details.mkdir(parents=True)
            (output_details / "old.json").write_text("old", encoding="utf-8")
            output_summary = root / "src/data/real/summary.json"
            output_summary.parent.mkdir(parents=True)
            output_summary.write_text("old-summary", encoding="utf-8")
            stage_details = root / "stage-details"
            stage_details.mkdir()
            (stage_details / "new.json").write_text("new", encoding="utf-8")
            with self.assertRaises(FileNotFoundError):
                publish_staged_artifacts(root / "missing-summary.json", stage_details, output_summary, output_details, root)
            self.assertTrue((output_details / "old.json").exists())
            self.assertEqual(output_summary.read_text(encoding="utf-8"), "old-summary")


if __name__ == "__main__":
    unittest.main()
