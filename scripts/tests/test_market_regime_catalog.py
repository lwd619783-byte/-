from __future__ import annotations

import copy
import json
import tempfile
import unittest
from pathlib import Path

from scripts.market_regime.catalog import build_catalog, load_json, render_catalog
from scripts.market_regime.collectors import (
    DownloadedResource,
    artifact_from_download,
    parse_csrc_report_page,
    parse_pboc_afre_stock_page,
    parse_pboc_m2_page,
)
from scripts.market_regime.hashing import canonical_sha256, sha256_bytes
from scripts.market_regime.market_adapters import (
    market_scope_exchanges,
    structurally_unavailable_exchange_observation,
)
from scripts.market_regime.providers import (
    Csi300HistoricalTtmPeProviderSlot,
    ProviderNotAdmittedError,
)
from scripts.market_regime.time_semantics import (
    build_weekly_backtest_clock,
    date_only_safe_available_at,
    is_observation_eligible,
    weekly_backtest_cutoff,
)
from scripts.market_regime.validator import validate_catalog


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).resolve().parent / "fixtures" / "market_regime"
SEED = ROOT / "research-data" / "market-regime" / "source-catalog" / "catalog-seed.sample.v1.json"
SCHEMA = ROOT / "config" / "market-regime" / "observation-catalog.schema.json"


def seed_payload() -> dict:
    return load_json(SEED)


def built_catalog() -> dict:
    return build_catalog(seed_payload())


class CollectorFixtureTests(unittest.TestCase):
    def fixture_text(self, name: str) -> str:
        return (FIXTURES / name).read_text(encoding="utf-8")

    def test_pboc_m2_cross_era_official_fragments(self) -> None:
        cases = [
            ("pboc-m2-2005.html", "https://wuhan.pbc.gov.cn/example", "2005-11", 29.24, 18.3),
            ("pboc-m2-2015.html", "https://www.pbc.gov.cn/example", "2015-01", 124.27, 10.8),
            ("pboc-m2-2024.html", "https://www.pbc.gov.cn/example", "2024-07", 303.31, 6.3),
        ]
        for fixture, url, value_date, balance, yoy in cases:
            with self.subTest(fixture=fixture):
                parsed = parse_pboc_m2_page(self.fixture_text(fixture), url)
                self.assertEqual(parsed["valueDate"], value_date)
                self.assertEqual(parsed["m2Balance"], balance)
                self.assertEqual(parsed["m2YoY"], yoy)
                self.assertEqual(parsed["releaseConfidenceClass"], "EXACT_TIMESTAMP")

    def test_pboc_afre_backcast_keeps_later_release(self) -> None:
        parsed = parse_pboc_afre_stock_page(
            self.fixture_text("pboc-afre-2014-backcast.html"),
            "https://www.pbc.gov.cn/diaochatongjisi/example",
        )
        self.assertEqual(parsed["valueDate"], "2014-12")
        self.assertEqual(parsed["afreStock"], 122.86)
        self.assertEqual(parsed["releaseAvailableAt"], "2015-02-10T16:31:12+08:00")
        self.assertEqual(parsed["releaseConfidenceClass"], "BACKCAST_RELEASED_LATER")

    def test_csrc_date_only_release_and_attachment_index(self) -> None:
        parsed = parse_csrc_report_page(
            self.fixture_text("csrc-monthly-2015.html"),
            "https://www.csrc.gov.cn/csrc/c105936/c1004214/content.shtml",
            expected_period="2015-12",
        )
        self.assertEqual(parsed["reportPeriod"], "2015-12")
        self.assertEqual(parsed["releaseAvailableAt"], "2016-01-22T00:00:00+08:00")
        self.assertEqual(parsed["releaseConfidenceClass"], "DATE_ONLY_SAFE")
        self.assertTrue(parsed["xlsUrl"].endswith(".xls"))

    def test_downloaded_artifact_keeps_its_own_release_event(self) -> None:
        artifact = artifact_from_download(
            DownloadedResource(
                url="https://example.invalid/controlled-test-fixture.html",
                status=200,
                content_type="text/html",
                fetched_at="2026-09-02T00:00:00Z",
                body=b"controlled fixture",
            ),
            source_id="CONTROLLED_TEST_SOURCE",
            local_path="synthetic-fixtures/controlled-test-fixture.html",
            publication_datetime="2026-08-31T10:00:00+08:00",
            publication_date="2026-08-31",
            release_available_at="2026-08-31T10:00:00+08:00",
            release_confidence_class="EXACT_TIMESTAMP",
        )
        self.assertEqual(artifact["publicationDate"], "2026-08-31")
        self.assertEqual(artifact["releaseAvailableAt"], "2026-08-31T10:00:00+08:00")


class PointInTimeClockTests(unittest.TestCase):
    cutoff = "2026-09-07T08:00:00+08:00"

    @staticmethod
    def observation(release: str, confidence: str = "EXACT_TIMESTAMP") -> dict:
        return {
            "valueDate": "2005-01",
            "releaseAvailableAt": release,
            "releaseConfidenceClass": confidence,
        }

    def test_sunday_release_is_available_monday(self) -> None:
        self.assertTrue(is_observation_eligible(self.observation("2026-09-06T23:59:00+08:00"), self.cutoff))

    def test_monday_0759_is_available(self) -> None:
        self.assertTrue(is_observation_eligible(self.observation("2026-09-07T07:59:00+08:00"), self.cutoff))

    def test_monday_0801_is_not_available(self) -> None:
        self.assertFalse(is_observation_eligible(self.observation("2026-09-07T08:01:00+08:00"), self.cutoff))

    def test_holiday_does_not_move_clock(self) -> None:
        clock = build_weekly_backtest_clock("2026-10-05", latest_eligible_trading_date="2026-09-30")
        self.assertEqual(clock["runCutoff"], "2026-10-05T08:00:00+08:00")
        self.assertEqual(clock["latestEligibleTradingDate"], "2026-09-30")

    def test_old_value_date_does_not_override_late_release(self) -> None:
        old_value_late_release = self.observation("2026-09-07T08:01:00+08:00")
        old_value_late_release["valueDate"] = "2005-01"
        self.assertFalse(is_observation_eligible(old_value_late_release, self.cutoff))

    def test_backcast_is_visible_only_after_later_publication(self) -> None:
        backcast = self.observation("2015-02-10T16:31:12+08:00", "BACKCAST_RELEASED_LATER")
        backcast["valueDate"] = "2002-12"
        self.assertFalse(is_observation_eligible(backcast, "2010-01-04T08:00:00+08:00"))
        self.assertTrue(is_observation_eligible(backcast, "2015-02-16T08:00:00+08:00"))

    def test_latest_revised_proxy_is_excluded_from_strict_pit(self) -> None:
        revised = self.observation("2020-01-01T00:00:00+08:00", "LATEST_REVISED_PROXY")
        self.assertFalse(is_observation_eligible(revised, self.cutoff))
        self.assertTrue(is_observation_eligible(revised, self.cutoff, strict=False))

    def test_schedule_inferred_is_rejected_from_strict_pit(self) -> None:
        inferred = self.observation("2026-09-06T23:59:00+08:00", "SCHEDULE_INFERRED")
        self.assertFalse(is_observation_eligible(inferred, self.cutoff, strict=True))

    def test_schedule_inferred_is_allowed_for_sensitivity_after_release(self) -> None:
        inferred = self.observation("2026-09-06T23:59:00+08:00", "SCHEDULE_INFERRED")
        future = self.observation("2026-09-07T08:01:00+08:00", "SCHEDULE_INFERRED")
        self.assertTrue(is_observation_eligible(inferred, self.cutoff, strict=False))
        self.assertFalse(is_observation_eligible(future, self.cutoff, strict=False))

    def test_date_only_safe_is_next_day_midnight(self) -> None:
        self.assertEqual(date_only_safe_available_at("2026-09-06"), "2026-09-07T00:00:00+08:00")

    def test_weekly_cutoff_rejects_non_monday(self) -> None:
        with self.assertRaisesRegex(ValueError, "星期一"):
            weekly_backtest_cutoff("2026-09-08")

    def test_market_scope_adds_bse_only_after_launch(self) -> None:
        self.assertEqual(market_scope_exchanges("2021-11-14"), ("SSE", "SZSE"))
        self.assertEqual(market_scope_exchanges("2021-11-15"), ("SSE", "SZSE", "BSE"))

    def test_structural_bse_marker_contains_no_fake_zero(self) -> None:
        marker = structurally_unavailable_exchange_observation(
            exchange="BSE",
            trade_date="2015-01-01",
            source_definition_id="bse-market-stats-adapter-v1",
        )
        self.assertEqual(marker["qualityStatus"], "STRUCTURALLY_UNAVAILABLE")
        self.assertIsNone(marker["totalMarketCap"])
        self.assertIsNone(marker["turnoverValue"])

    def test_csi300_no_go_slot_cannot_collect(self) -> None:
        slot = Csi300HistoricalTtmPeProviderSlot()
        self.assertEqual(slot.status.value, "NO_GO")
        with self.assertRaises(ProviderNotAdmittedError):
            slot.collect()


class CatalogValidationTests(unittest.TestCase):
    def test_schema_exposes_weekly_and_backtest_manifest_contracts(self) -> None:
        schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        self.assertIn("weeklyBacktestClock", schema["$defs"])
        self.assertIn("backtestInputManifest", schema["$defs"])
        self.assertIn("sourceDefinitionVersion", schema["$defs"])
        self.assertIn("metricObservationVintage", schema["$defs"])
        artifact_required = schema["$defs"]["rawSourceArtifact"]["required"]
        self.assertIn("publicationDate", artifact_required)
        self.assertIn("releaseAvailableAt", artifact_required)

    def test_sample_catalog_and_artifact_hashes_pass(self) -> None:
        catalog = built_catalog()
        self.assertEqual(catalog["manifest"]["validationStatus"], "PASS")
        self.assertEqual(
            validate_catalog(catalog, artifact_root=ROOT, verify_artifacts=True),
            [],
        )

    def test_build_rejects_missing_required_collection(self) -> None:
        source = seed_payload()
        del source["artifacts"]
        with self.assertRaisesRegex(ValueError, "缺少必需集合: artifacts"):
            build_catalog(source)

    def test_build_rejects_non_array_collection(self) -> None:
        source = seed_payload()
        source["observations"] = {}
        with self.assertRaisesRegex(ValueError, "拒绝静默替换为空集合"):
            build_catalog(source)

    def test_validator_reports_non_object_without_mutating_input(self) -> None:
        catalog = built_catalog()
        catalog["observations"] = ["not-an-object"]
        before = copy.deepcopy(catalog)
        errors = validate_catalog(catalog)
        self.assertTrue(any("observations[0] 必须是 object" in error for error in errors))
        self.assertEqual(catalog, before)

    def test_market_observation_requires_existing_definition(self) -> None:
        source = seed_payload()
        source["exchangeMarketObservations"][0]["sourceDefinitionId"] = "missing-definition"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("sourceDefinitionId 不存在" in error for error in errors))

    def test_deterministic_build_ignores_input_order(self) -> None:
        first_input = seed_payload()
        second_input = copy.deepcopy(first_input)
        second_input["observations"].reverse()
        second_input["artifacts"].reverse()
        first = build_catalog(first_input)
        second = build_catalog(second_input)
        self.assertEqual(render_catalog(first), render_catalog(second))

    def test_runtime_generated_at_does_not_change_content_hash(self) -> None:
        source = seed_payload()
        first = build_catalog(source, generated_at="2026-09-02T00:00:00Z")
        second = build_catalog(source, generated_at="2026-09-03T00:00:00Z")
        self.assertNotEqual(first["generatedAt"], second["generatedAt"])
        self.assertEqual(
            first["manifest"]["contentHashes"]["catalogContentSha256"],
            second["manifest"]["contentHashes"]["catalogContentSha256"],
        )

    def test_duplicate_artifact_fails_closed(self) -> None:
        source = seed_payload()
        source["artifacts"].append(copy.deepcopy(source["artifacts"][0]))
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("artifactId 重复" in error for error in errors))

    def test_corrupted_fixture_fails_hash_validation(self) -> None:
        catalog = built_catalog()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for artifact in catalog["artifacts"]:
                target = root / artifact["localPath"]
                target.parent.mkdir(parents=True, exist_ok=True)
                source = ROOT / artifact["localPath"]
                target.write_bytes(source.read_bytes())
            corrupt = root / catalog["artifacts"][0]["localPath"]
            corrupt.write_bytes(corrupt.read_bytes() + b"corrupt")
            errors = validate_catalog(catalog, artifact_root=root, verify_artifacts=True)
        self.assertTrue(any("sha256 与本地文件不一致" in error for error in errors))

    def test_failed_download_cannot_be_pseudo_artifact(self) -> None:
        source = seed_payload()
        source["artifacts"][0]["httpStatus"] = 503
        source["artifacts"][0]["parseStatus"] = "FAILED"
        source["artifacts"][0]["error"] = "upstream unavailable"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("失败抓取不得进入 artifact catalog" in error for error in errors))

    def test_duplicate_observation_fails(self) -> None:
        source = seed_payload()
        source["observations"].append(copy.deepcopy(source["observations"][0]))
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("observationId 重复" in error for error in errors))

    def test_missing_source_definition_fails(self) -> None:
        source = seed_payload()
        source["observations"][0]["sourceDefinitionId"] = "missing-definition"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("sourceDefinitionId 不存在" in error for error in errors))

    def test_2005_observation_cannot_use_2018_definition(self) -> None:
        source = seed_payload()
        observation = next(
            item for item in source["observations"]
            if item["observationId"] == "m2-balance-2005-11-v0"
        )
        observation["sourceDefinitionId"] = "pbc-m2-balance-2018-v3"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("统计期有效范围" in error for error in errors))

    def test_afre_backcast_definition_covers_value_period_but_not_release_time(self) -> None:
        source = seed_payload()
        definition = next(
            item for item in source["sourceDefinitions"]
            if item["sourceDefinitionId"] == "pbc-afre-stock-balance-2015-v1"
        )
        observation = next(
            item for item in source["observations"]
            if item["observationId"] == "afre-stock-balance-2014-12-backcast-v0"
        )
        self.assertEqual(definition["effectiveFrom"], "2002-01-01")
        self.assertEqual(observation["valueDate"], "2014-12")
        self.assertEqual(observation["releaseAvailableAt"], "2015-02-10T16:31:12+08:00")
        self.assertEqual(build_catalog(source)["manifest"]["validationErrors"], [])

    def test_observation_artifact_source_mismatch_fails(self) -> None:
        source = seed_payload()
        source["artifacts"][0]["sourceId"] = "OTHER_OFFICIAL_SOURCE"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("sourceId 与 raw artifact 不一致" in error for error in errors))

    def test_observation_artifact_confidence_mismatch_fails(self) -> None:
        source = seed_payload()
        source["observations"][0]["releaseConfidenceClass"] = "SCHEDULE_INFERRED"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("releaseConfidenceClass 与 raw artifact 不一致" in error for error in errors))

    def test_exact_timestamp_release_mismatch_fails(self) -> None:
        source = seed_payload()
        observation = source["observations"][0]
        observation["releaseDateTime"] = "2005-12-13T10:00:00+08:00"
        observation["releaseAvailableAt"] = "2005-12-13T10:00:00+08:00"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("releaseDateTime 与 raw artifact" in error for error in errors))
        self.assertTrue(any("releaseAvailableAt 与 raw artifact" in error for error in errors))

    def test_date_only_observation_must_share_artifact_release_event(self) -> None:
        source = seed_payload()
        artifact = source["artifacts"][0]
        artifact.update({
            "publicationDateTime": None,
            "publicationDate": "2005-12-12",
            "releaseAvailableAt": "2005-12-13T00:00:00+08:00",
            "releaseConfidenceClass": "DATE_ONLY_SAFE",
        })
        for observation in source["observations"][:2]:
            observation.update({
                "releaseDateTime": None,
                "releaseAvailableAt": "2005-12-14T00:00:00+08:00",
                "releaseConfidenceClass": "DATE_ONLY_SAFE",
            })
            observation["metadata"]["publicationDate"] = "2005-12-13"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("releaseAvailableAt 与 raw artifact" in error for error in errors))
        self.assertTrue(any("metadata.publicationDate 与 raw artifact" in error for error in errors))

    def test_broken_revision_chain_fails(self) -> None:
        source = seed_payload()
        source["observations"][0]["supersedesObservationId"] = "missing-observation"
        source["observations"][0]["revisionSequence"] = 1
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("supersedesObservationId 不存在" in error for error in errors))

    def test_revision_cycle_is_detected(self) -> None:
        source = seed_payload()
        first = source["observations"][0]
        second = copy.deepcopy(first)
        second["observationId"] = "m2-balance-2005-11-v1"
        first["supersedesObservationId"] = second["observationId"]
        first["revisionSequence"] = 2
        second["supersedesObservationId"] = first["observationId"]
        second["revisionSequence"] = 1
        source["observations"].append(second)
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("revision 链存在环" in error for error in errors))

    def test_later_revision_reusing_earlier_artifact_fails(self) -> None:
        source = seed_payload()
        original = next(
            item for item in source["observations"]
            if item["observationId"] == "m2-balance-2015-01-v0"
        )
        revision = copy.deepcopy(original)
        revision.update({
            "observationId": "m2-balance-2015-01-v1",
            "releaseDateTime": "2015-03-01T10:00:00+08:00",
            "releaseAvailableAt": "2015-03-01T10:00:00+08:00",
            "revisionSequence": 1,
            "supersedesObservationId": original["observationId"],
            "qualityStatus": "REVISED",
        })
        source["observations"].append(revision)
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("releaseDateTime 与 raw artifact" in error for error in errors))
        self.assertTrue(any("releaseAvailableAt 与 raw artifact" in error for error in errors))

    def test_later_revision_with_matching_new_artifact_passes(self) -> None:
        source = seed_payload()
        original = next(
            item for item in source["observations"]
            if item["observationId"] == "m2-balance-2015-01-v0"
        )
        old_artifact = next(
            item for item in source["artifacts"]
            if item["artifactId"] == original["rawArtifactId"]
        )
        fixture_bytes = (
            "CONTROLLED TEST FIXTURE: 2015-03-01T10:00:00+08:00 "
            "M2 2015-01 revised value 124.28"
        ).encode("utf-8")
        fixture_path = "synthetic-fixtures/pboc-m2-2015-revision.html"
        revision_artifact = copy.deepcopy(old_artifact)
        revision_artifact.update({
            "artifactId": "fixture-pboc-m2-2015-revision",
            "sourceUrl": "https://example.invalid/controlled-test-fixture/pboc-m2-2015-revision.html",
            "publicationDateTime": "2015-03-01T10:00:00+08:00",
            "publicationDate": "2015-03-01",
            "releaseAvailableAt": "2015-03-01T10:00:00+08:00",
            "fileName": "pboc-m2-2015-revision.html",
            "sha256": sha256_bytes(fixture_bytes),
            "byteSize": len(fixture_bytes),
            "localPath": fixture_path,
        })
        source["artifacts"].append(revision_artifact)
        revision = copy.deepcopy(original)
        revision.update({
            "observationId": "m2-balance-2015-01-v1",
            "releaseDateTime": "2015-03-01T10:00:00+08:00",
            "releaseAvailableAt": "2015-03-01T10:00:00+08:00",
            "value": 124.28,
            "revisionSequence": 1,
            "supersedesObservationId": original["observationId"],
            "qualityStatus": "REVISED",
            "rawArtifactId": revision_artifact["artifactId"],
        })
        source["observations"].append(revision)
        catalog = build_catalog(source)
        self.assertEqual(catalog["manifest"]["validationStatus"], "PASS")

        with tempfile.TemporaryDirectory() as temporary:
            artifact_root = Path(temporary)
            for artifact in catalog["artifacts"]:
                target = artifact_root / artifact["localPath"]
                target.parent.mkdir(parents=True, exist_ok=True)
                if artifact["localPath"] == fixture_path:
                    target.write_bytes(fixture_bytes)
                else:
                    target.write_bytes((ROOT / artifact["localPath"]).read_bytes())
            errors = validate_catalog(
                catalog,
                artifact_root=artifact_root,
                verify_artifacts=True,
            )
        self.assertEqual(errors, [])
        ids = {item["observationId"] for item in catalog["observations"]}
        self.assertIn("m2-balance-2015-01-v0", ids)
        self.assertIn("m2-balance-2015-01-v1", ids)

    def test_manifest_count_mismatch_fails(self) -> None:
        catalog = built_catalog()
        catalog["manifest"]["observationCount"] += 1
        errors = validate_catalog(catalog)
        self.assertIn("manifest.observationCount 与 catalog 实际内容不一致", errors)

    def test_manifest_content_hash_is_recomputable(self) -> None:
        catalog = built_catalog()
        self.assertEqual(
            catalog["manifest"]["contentHashes"]["observationsSha256"],
            canonical_sha256(catalog["observations"]),
        )

    def test_missing_is_not_zero(self) -> None:
        source = seed_payload()
        source["observations"][0]["qualityStatus"] = "MISSING"
        source["observations"][0]["value"] = 0
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("不得用 0 代替 missing" in error for error in errors))

    def test_legitimate_zero_is_not_automatically_missing(self) -> None:
        source = seed_payload()
        source["observations"][0]["value"] = 0
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertFalse(any("不得用 0 代替 missing" in error for error in errors))

    def test_pre_bse_zero_is_rejected(self) -> None:
        source = seed_payload()
        marker = source["exchangeMarketObservations"][0]
        marker["totalMarketCap"] = 0
        marker["negotiableMarketCap"] = 0
        marker["turnoverValue"] = 0
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("不得伪造 BSE=0" in error for error in errors))

    def test_date_only_observation_requires_conservative_available_time(self) -> None:
        source = seed_payload()
        observation = source["observations"][0]
        observation["releaseConfidenceClass"] = "DATE_ONLY_SAFE"
        observation["releaseDateTime"] = None
        observation["releaseAvailableAt"] = "2005-12-12T00:00:00+08:00"
        observation["metadata"]["publicationDate"] = "2005-12-12"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("发布日次日 00:00" in error for error in errors))

    def test_csi300_provider_slot_remains_no_go(self) -> None:
        source = seed_payload()
        slot = next(item for item in source["providerSlots"] if item["metricId"] == "VAL_CSI300_TTM_PE")
        slot["status"] = "PASS"
        errors = build_catalog(source)["manifest"]["validationErrors"]
        self.assertTrue(any("当前必须保持 NO_GO" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
