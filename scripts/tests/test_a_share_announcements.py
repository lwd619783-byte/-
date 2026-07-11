from __future__ import annotations

import json
import math
import tempfile
import unittest
from unittest import mock
from pathlib import Path
import requests

import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from a_share_announcements.artifacts import build_summary_item, publish, validate_artifacts, write_staged_artifacts
from a_share_announcements.core import (
    build_announcement, classify_announcement, extract_reason_items, infer_report_period,
    link_versions, normalize_amount, normalize_title, parse_announcement_date,
    parse_performance_express, parse_performance_forecast, reject_non_finite,
)
from a_share_announcements.provider import AnnouncementProviderError, CNInfoClient

STOCK = {"id": "fii", "code": "601138", "name": "工业富联", "exchange": "SH"}
FORECAST_TEXT = """2026年半年度实现归属于母公司所有者的净利润234亿元到244亿元，同比上升93%到101%。预计2026年半年度实现归属于母公司所有者的扣除非经常性损益的净利润227亿元到237亿元，同比上升94%到103%。三、本期业绩预增的主要原因 产品结构持续优化，AI服务器营业收入增长，客户需求持续释放。四、风险提示"""


def raw(announcement_id="1225417297", title="富士康工业互联网股份有限公司2026年半年度业绩预增公告"):
    return {"announcementId": announcement_id, "announcementTitle": title, "announcementTime": 1783612800000, "announcementTypeName": None, "adjunctUrl": f"finalpage/2026-07-10/{announcement_id}.PDF"}


class AnnouncementCoreTests(unittest.TestCase):
    def test_normalize_title(self): self.assertEqual(normalize_title("<em>工业富联</em>  公告"), "工业富联 公告")
    def test_parse_date(self): self.assertEqual(parse_announcement_date(1783612800000)[0], "2026-07-10")
    def test_classify_forecast(self): self.assertEqual(classify_announcement("2026年半年度业绩预增公告")["category"], "performance_forecast")
    def test_classify_forecast_revision(self): self.assertEqual(classify_announcement("2025年度业绩预告修正公告")["category"], "performance_forecast_revision")
    def test_classify_express(self): self.assertEqual(classify_announcement("2025年度业绩快报")["category"], "performance_express")
    def test_classify_periodic_reports(self):
        self.assertEqual(classify_announcement("2025年年度报告")["category"], "annual_report")
        self.assertEqual(classify_announcement("2025年半年度报告")["category"], "semi_annual_report")
        self.assertEqual(classify_announcement("2026年第一季度报告")["category"], "quarterly_report")
        self.assertEqual(classify_announcement("2025年年度报告摘要")["category"], "periodic_report_summary")
        self.assertEqual(classify_announcement("关于2025年年度报告问询函的回复公告")["category"], "regulatory")
        self.assertEqual(classify_announcement("关于变更2026年第一季度报告预约披露时间的公告")["category"], "other")
    def test_report_periods(self):
        self.assertEqual(infer_report_period("2026年半年度报告"), ("2026-06-30", "H1"))
        self.assertEqual(infer_report_period("2025年年度报告"), ("2025-12-31", "FY"))
    def test_unit_conversion_and_missing(self):
        self.assertEqual(normalize_amount("1.5", "亿元"), 150_000_000)
        self.assertEqual(normalize_amount("2", "万元"), 20_000)
        self.assertIsNone(normalize_amount("--", "元")); self.assertIsNone(normalize_amount("", "元"))
    def test_forecast_distinguishes_parent_and_deducted(self):
        events = parse_performance_forecast(FORECAST_TEXT, "2026年半年度业绩预增公告")
        by_metric = {event["profitMetric"]: event for event in events}
        self.assertEqual(by_metric["netProfitAttributableToParent"]["lowerBound"], 23_400_000_000)
        self.assertEqual(by_metric["netProfitExcludingNonRecurring"]["upperBound"], 23_700_000_000)
        self.assertEqual(by_metric["netProfitAttributableToParent"]["changeLowerPercent"], 0.93)
    def test_forecast_range_order(self):
        event = parse_performance_forecast(FORECAST_TEXT, "2026年半年度业绩预增公告")[0]
        self.assertLessEqual(event["lowerBound"], event["upperBound"])
        self.assertEqual(event["derivedMidpoint"], (event["lowerBound"] + event["upperBound"]) / 2)
    def test_forecast_decline_has_negative_change_and_parent_metric(self):
        text = "归属于上市公司股东的净利润盈利：85,000万元至105,000万元，比上年同期下降：54%至63%"
        event = parse_performance_forecast(text, "2024年年度业绩预告")[0]
        self.assertEqual(event["profitMetric"], "netProfitAttributableToParent")
        self.assertEqual((event["changeLowerPercent"], event["changeUpperPercent"]), (-0.63, -0.54))
    def test_forecast_selects_title_report_period_when_pdf_also_has_quarter(self):
        text = "2026年第二季度实现归属于母公司所有者的净利润128亿元到138亿元，同比上升86%到101%；2026年半年度实现归属于母公司所有者的净利润234亿元到244亿元，同比上升93%到101%。"
        event = parse_performance_forecast(text, "2026年半年度业绩预增公告")[0]
        self.assertEqual((event["lowerBound"], event["upperBound"]), (23_400_000_000, 24_400_000_000))
        self.assertEqual((event["changeLowerPercent"], event["changeUpperPercent"]), (0.93, 1.01))
    def test_reason_requires_evidence(self):
        reasons = extract_reason_items(FORECAST_TEXT)
        self.assertTrue(reasons); self.assertTrue(all(item["evidenceText"] for item in reasons))
    def test_express_parse(self):
        event = parse_performance_express("营业收入100万元，归属于上市公司股东的净利润20万元，总资产500万元", "2025年度业绩快报")
        self.assertEqual(event["operatingRevenue"], 1_000_000); self.assertEqual(event["netProfitAttributableToParent"], 200_000)
    def test_express_rejects_glued_table_columns(self):
        text = "单位：千元 营业总收入38,204,60127,213,955 营业利润2,562,102-4,161,996"
        event = parse_performance_express(text, "2025年度业绩快报")
        self.assertIsNone(event["operatingRevenue"])
        self.assertEqual(event["operatingProfit"], 2_562_102_000)
    def test_non_finite_rejected(self):
        with self.assertRaises(ValueError): reject_non_finite({"x": math.inf})
    def test_build_announcement_no_expectation_judgement(self):
        item = build_announcement(raw(), STOCK, "2026-07-11T00:00:00Z", FORECAST_TEXT, {"2026-06-30": "2026-07-10T00:00:00Z"})
        self.assertNotIn("超预期", json.dumps(item, ensure_ascii=False)); self.assertEqual(item["parseStatus"], "parse_success")
    def test_parse_unavailable_has_no_structured_values(self):
        item = build_announcement(raw(), STOCK, "2026-07-11T00:00:00Z", None, {})
        self.assertEqual(item["parseStatus"], "parse_unavailable"); self.assertEqual(item["performanceForecastEvents"], [])
    def test_periodic_financial_link(self):
        item = build_announcement(raw(title="2025年年度报告"), STOCK, "2026-07-11T00:00:00Z", None, {"2025-12-31": "2026-04-01T00:00:00Z"})
        self.assertEqual(item["periodicReportEvent"]["linkedFinancialStatus"], "matched")
    def test_correction_relation_preserves_original(self):
        original = build_announcement(raw("1", "2025年度业绩预告"), STOCK, "2026-01-01T00:00:00Z", FORECAST_TEXT.replace("2026", "2025"), {})
        correction = build_announcement(raw("2", "2025年度业绩预告修正公告"), STOCK, "2026-02-01T00:00:00Z", FORECAST_TEXT.replace("2026", "2025"), {})
        linked = link_versions([correction, original])
        self.assertEqual(linked[0]["correctedAnnouncementId"], "1"); self.assertEqual(linked[1]["supersededBy"], "2")
    def test_duplicate_pdf_relation(self):
        a = build_announcement(raw("1"), STOCK, "2026-07-11T00:00:00Z", FORECAST_TEXT, {})
        b = dict(a); b["announcementId"] = "2"
        link_versions([a, b]); self.assertTrue(b["isDuplicate"]); self.assertEqual(b["duplicateOf"], "1")


class ArtifactTests(unittest.TestCase):
    def detail(self):
        item = build_announcement(raw(), STOCK, "2026-07-11T00:00:00Z", FORECAST_TEXT, {})
        return {"stockId": "fii", "stockCode": "601138", "companyName": "工业富联", "market": "A股", "provider": "CNInfo hisAnnouncement", "providerVersion": "2026-public-web", "generatedAt": "2026-07-11T00:00:00Z", "fetchedAt": "2026-07-11T00:00:00Z", "lastSuccessfulFetchAt": "2026-07-11T00:00:00Z", "currentFetchError": None, "status": "success", "dateRange": {"start": "2024-07-11", "end": "2026-07-11"}, "announcements": [item], "quality": {"source": "CNInfo", "status": "real"}}
    def test_summary_detail_latest_consistency(self):
        summary = build_summary_item({"schemaVersion": "1.0.0", **self.detail()})
        self.assertEqual(summary["latestAnnouncementDate"], "2026-07-10"); self.assertEqual(summary["announcementCount"], 1)
    def test_manifest_checksum_and_orphan_validation(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage = Path(tmp); summary, details, _ = write_staged_artifacts({"fii": self.detail()}, stage, "2026-07-11T00:00:00Z")
            self.assertEqual(validate_artifacts(summary, details, {"fii"}), [])
            (details / "orphan.json").write_text("{}", encoding="utf-8")
            self.assertIn("orphan or missing detail files", validate_artifacts(summary, details, {"fii"}))
    def test_path_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            stage = Path(tmp); summary, details, _ = write_staged_artifacts({"fii": self.detail()}, stage, "2026-07-11T00:00:00Z")
            manifest_path = details / "manifest.generated.json"; manifest = json.loads(manifest_path.read_text(encoding="utf-8")); manifest["items"][0]["relativePath"] = "data/a-share-announcements/../x.json"; manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            self.assertTrue(any("unsafe path" in error for error in validate_artifacts(summary, details, {"fii"})))
    def test_publish_rolls_back_both_artifacts_on_half_update(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); cache = root / "cache"; cache.mkdir()
            stage = root / "stage"; stage.mkdir()
            stage_summary, stage_detail, _ = write_staged_artifacts({"fii": self.detail()}, stage, "2026-07-11T00:00:00Z")
            output_summary = root / "summary.json"; output_summary.write_text("old-summary", encoding="utf-8")
            output_detail = root / "details"; output_detail.mkdir(); (output_detail / "old.json").write_text("old-detail", encoding="utf-8")
            real_replace = __import__("os").replace; calls = 0
            def fail_during_publish(source, target):
                nonlocal calls
                calls += 1
                if calls == 3: raise OSError("simulated replace failure")
                return real_replace(source, target)
            with mock.patch("a_share_announcements.artifacts.os.replace", side_effect=fail_during_publish):
                with self.assertRaises(OSError): publish(stage_summary, stage_detail, output_summary, output_detail, cache)
            self.assertEqual(output_summary.read_text(encoding="utf-8"), "old-summary")
            self.assertEqual((output_detail / "old.json").read_text(encoding="utf-8"), "old-detail")


class FakeResponse:
    status_code = 500
    def raise_for_status(self): raise requests.HTTPError("server error")


class FakeSession:
    headers = {}
    def post(self, *args, **kwargs): return FakeResponse()


class ProviderTests(unittest.TestCase):
    def test_provider_network_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            client = CNInfoClient(Path(tmp), retries=0, session=FakeSession())
            with self.assertRaises(AnnouncementProviderError): client.fetch_company(STOCK, "2026-01-01", "2026-07-11", use_cache=False)


if __name__ == "__main__": unittest.main()
