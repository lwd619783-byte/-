from __future__ import annotations

import copy
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from provider_observability import GATE_SCHEMA_VERSION, SCHEMA_VERSION
from provider_observability.core import (
    BLOCKING_FAILURES, DirtyWorktreeError, announcement_diff, append_resolution, append_run, atomic_write, audit_observation_ledger,
    audit_resolution_ledger,
    classify_failure, contains_sensitive, dirty_paths, evaluate, file_digest, financial_diff, json_bytes,
    load_resolutions, load_runs, make_resolution, observation_eligibility, percentile, redact,
    stable, summarize_provider, tree_digest, validate_config, validate_run,
)
from provider_observability.legacy import (
    EXPECTED_LEGACY_PROVIDERS,
    canonical_record_sha256,
    load_legacy_anchors,
    validate_legacy_anchor_config,
    validate_legacy_run,
)
from provider_observability.provenance import (
    UNAVAILABLE, cohort_id, recordable_provenance, unavailable_provenance, valid_provenance,
)
from provider_observability.production import (
    validate_announcement_production, validate_default_refresh, validate_financial_production, validate_production,
)
from provider_observability.root_state import (
    FRESH_V2,
    LEGACY_V1_MIGRATED,
    build_root_state,
    initial_evidence_checksum,
    initial_evidence_records,
    legacy_anchor_config_checksum,
    load_root_state,
    prepare_root_for_observation,
    root_state_path,
    validate_root_state,
    write_root_state,
)

PROVIDERS = ["a-share-financials", "a-share-announcements"]
HASH = "0" * 64


def config(**updates):
    value = {"schemaVersion": GATE_SCHEMA_VERSION, "timezone": "Asia/Shanghai", "minimumDistinctDays": 5, "minimumRunsPerProvider": 10, "minimumSuccessfulDaysPerProvider": 5, "minimumCompleteSuccessRate": .9, "minimumTotalSuccessRate": .95, "expectedCompanies": 56, "requireLatestSuccess": True, "providers": PROVIDERS}
    value.update(updates); return value


def production(passed=True, financial=True, announcements=True, audit=True, refresh=True, p0=0, errors=0):
    return {"passed": passed and financial and announcements and audit and refresh, "financials": {"passed": financial, "errorCount": int(not financial), "errors": [] if financial else ["bad financial"]}, "announcements": {"passed": announcements, "errorCount": int(not announcements), "errors": [] if announcements else ["bad announcement"]}, "dataAudit": {"passed": audit, "exitCode": int(not audit), "p0": p0, "errors": errors}, "defaultRefresh": {"passed": refresh, "unqualifiedProvidersIncluded": [] if refresh else ["data:fetch:financials:a"]}}


def failure(category, message="failure"):
    return {"category": category, "message": message, "resolved": False}


def provenance(**updates):
    value = {
        "sourceCommitSha": "a" * 40,
        "observationToolVersion": "2.0.0",
        "observationToolChecksum": "1" * 64,
        "providerCodeChecksum": "2" * 64,
        "fetchScriptChecksum": "3" * 64,
        "validatorChecksum": "4" * 64,
        "stockUniverseChecksum": "5" * 64,
        "stockUniverseIdentityCount": 56,
        "gateConfigChecksum": "6" * 64,
        "productionBaselineChecksum": "7" * 64,
        "dependencyFingerprint": "8" * 64,
    }
    value.update(updates)
    value["provenanceCohortId"] = cohort_id(value) if "unavailable" not in value.values() else "unavailable"
    return value


def run(provider="a-share-financials", index=0, status="success", failures=None, coverage=56, rate=1, eligible=True, same_day=False, provenance_value=None):
    start = datetime(2026, 7, 1, tzinfo=timezone.utc) + timedelta(days=0 if same_day else index // 2, minutes=index)
    domain = "financials" if provider == "a-share-financials" else "announcements"
    return {"schemaVersion": SCHEMA_VERSION, "runId": f"run-{provider}-{index}", "providerId": provider, "providerVersion": "v1", "domain": domain, "startedAt": start.isoformat().replace("+00:00", "Z"), "endedAt": (start + timedelta(seconds=2)).isoformat().replace("+00:00", "Z"), "timezone": "Asia/Shanghai", "durationSeconds": 2 + index, "platform": "test", "pythonVersion": "3.13", "nodeVersion": "v22", "command": ["python", "fixture"], "status": status, "exitCode": 0 if status != "failed" else 1, "metrics": {"companyCoverage": coverage, "expectedCompanies": 56, "structuralValidationRate": rate, "eligibleSample": eligible, "cacheMode": "isolated", "retryCount": None, "timeoutCount": 0, "rateLimitCount": 0, "httpStatusCounts": {}, "success": coverage, "partial": 0, "error": 0, "detailFiles": coverage, "manifestChecksum": HASH, "artifactChecksum": HASH}, "difference": {"baseline": True}, "failures": failures or [], "validation": {"passed": rate == 1}, "atomicity": {"productionUnchanged": True, "beforeChecksum": HASH, "afterChecksum": HASH}, "worktree": {"unchanged": True}, "messages": [], "artifacts": {"generatedRoot": f"artifacts/run-{provider}-{index}/generated"}, "provenance": provenance_value or provenance()}


def unavailable_run(provider="a-share-financials", index=0, **updates):
    value = run(
        provider,
        index,
        status="partial",
        failures=[failure("provenance_unavailable", "source commit SHA is unavailable")],
        eligible=False,
        provenance_value=provenance(sourceCommitSha=UNAVAILABLE),
    )
    value.update(updates)
    return value


def legacy_run(provider="a-share-financials", index=0, run_id=None):
    value = run(provider, index)
    value["schemaVersion"] = "1.0.0"
    if run_id is not None:
        value["runId"] = run_id
    value.pop("provenance")
    value["metrics"].pop("eligibleSample")
    value["atomicity"].pop("beforeChecksum")
    value["atomicity"].pop("afterChecksum")
    value["command"] = ["python", "D:\\historical-observation\\fixture.py"]
    return value


def anchors_for(*records):
    document = {
        "schemaVersion": "1.0.0",
        "records": [
            {
                "runId": record["runId"],
                "providerId": record["providerId"],
                "startedAt": record["startedAt"],
                "canonicalRecordSha256": canonical_record_sha256(record),
            }
            for record in records
        ],
    }
    return validate_legacy_anchor_config(document)


def ann(announcement_id, date_value, **updates):
    value = {"announcementId": announcement_id, "announcementDate": date_value, "title": "t", "category": "other", "officialUrl": "https://www.cninfo.com.cn/x", "pdfUrl": "https://static.cninfo.com.cn/x.pdf"}
    value.update(updates); return value


def details(*items): return {"stock": {"announcements": list(items)}}


def materialize_observation(root: Path, item: dict) -> None:
    generated = root / item["artifacts"]["generatedRoot"]
    detail_name = "a-share-financials" if item["providerId"] == "a-share-financials" else "a-share-announcements"
    summary_name = "a-share-financial-summaries.generated.json" if item["providerId"] == "a-share-financials" else "a-share-announcement-summaries.generated.json"
    detail = generated / detail_name
    detail.mkdir(parents=True, exist_ok=True)
    (generated / summary_name).write_text("{}\n", encoding="utf-8")
    manifest = detail / "manifest.generated.json"
    manifest.write_text("{}\n", encoding="utf-8")
    item["metrics"]["manifestChecksum"] = file_digest(manifest)
    item["metrics"]["artifactChecksum"] = tree_digest([generated], generated)


def write_observation_ledger(root: Path, items: list[dict]) -> None:
    (root / "runs").mkdir(parents=True, exist_ok=True)
    for item in items:
        (root / "runs" / f"{item['runId']}.json").write_bytes(json_bytes(item))
    (root / "provider-health-ledger.jsonl").write_bytes(
        b"".join(json.dumps(item, ensure_ascii=False, sort_keys=True).encode("utf-8") + b"\n" for item in items)
    )


class LedgerTests(unittest.TestCase):
    def test_01_valid_run(self): validate_run(run())
    def test_02_missing_core_field(self):
        value = run(); value.pop("difference")
        with self.assertRaises(ValueError): validate_run(value)
    def test_03_invalid_provider(self):
        value = run(); value["providerId"] = "bad"
        with self.assertRaises(ValueError): validate_run(value)
    def test_04_invalid_failure_category(self):
        value = run(failures=[failure("bad")])
        with self.assertRaises(ValueError): validate_run(value)
    def test_05_duplicate_run_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); append_run(root, run())
            with self.assertRaises(ValueError): append_run(root, run())
    def test_06_append_is_lf(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); append_run(root, run()); self.assertNotIn(b"\r\n", (root / "provider-health-ledger.jsonl").read_bytes())
    def test_07_append_load(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); append_run(root, run()); self.assertEqual(load_runs(root)[0]["runId"], run()["runId"])
    def test_08_atomic_replace(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x"; atomic_write(path, b"a"); atomic_write(path, b"b"); self.assertEqual(path.read_bytes(), b"b")
    def test_09_nan_rejected(self):
        with self.assertRaises(ValueError): json_bytes({"x": float("nan")})


class RedactionTests(unittest.TestCase):
    def test_10_token_key(self): self.assertEqual(redact({"token": "abc"})["token"], "[REDACTED]")
    def test_11_cookie_key(self): self.assertEqual(redact({"Cookie": "abc"})["Cookie"], "[REDACTED]")
    def test_12_bearer(self): self.assertIn("[REDACTED]", redact("Bearer abc.def"))
    def test_13_query(self): self.assertIn("token=[REDACTED]", redact("https://x?token=abc"))
    def test_14_sensitive_detected(self): self.assertTrue(contains_sensitive({"session": "raw"}))
    def test_15_redacted_allowed(self): self.assertFalse(contains_sensitive({"session": "[REDACTED]"}))


class WindowDifferenceTests(unittest.TestCase):
    previous_window = {"start": "2024-07-11", "end": "2026-07-11"}
    current_window = {"start": "2024-07-12", "end": "2026-07-12"}
    def test_16_one_day_shift(self): self.assertEqual(announcement_diff({}, {}, self.current_window, self.previous_window)["windowShiftDays"], 1)
    def test_17_expected_expiry(self):
        diff = announcement_diff({}, details(ann("old", "2024-07-11")), self.current_window, self.previous_window); self.assertEqual(diff["expectedExpiredIds"], ["old"])
    def test_18_expiry_not_blocking(self):
        diff = announcement_diff({}, details(ann("old", "2024-07-11")), self.current_window, self.previous_window); self.assertFalse(diff["unexpectedRemoved"] or diff["unverifiableRemoved"])
    def test_19_overlap_removal(self):
        diff = announcement_diff({}, details(ann("x", "2025-01-01")), self.current_window, self.previous_window); self.assertEqual(diff["unexpectedRemovedIds"], ["x"])
    def test_20_boundary_is_not_expired(self):
        diff = announcement_diff({}, details(ann("x", "2024-07-12")), self.current_window, self.previous_window); self.assertEqual(diff["unexpectedRemovedIds"], ["x"])
    def test_21_missing_date_unverifiable(self):
        diff = announcement_diff({}, details(ann("x", None)), self.current_window, self.previous_window); self.assertEqual(diff["unverifiableRemovedIds"], ["x"])
    def test_22_missing_window_unverifiable(self):
        diff = announcement_diff({}, details(ann("x", "2025-01-01")), None, self.previous_window); self.assertEqual(diff["unverifiableRemovedIds"], ["x"])
    def test_23_shortened_window_risk(self):
        diff = announcement_diff({}, details(ann("x", "2025-01-01")), {"start": "2025-01-01", "end": "2026-07-12"}, self.previous_window); self.assertIn("current_window_shortened", diff["windowRisks"])
    def test_24_backward_window_risk(self):
        diff = announcement_diff({}, {}, {"start": "2024-07-10", "end": "2026-07-12"}, self.previous_window); self.assertIn("window_start_moved_backward", diff["windowRisks"])
    def test_25_no_overlap_risk(self):
        diff = announcement_diff({}, {}, {"start": "2027-01-01", "end": "2028-01-01"}, self.previous_window); self.assertIn("windows_do_not_overlap", diff["windowRisks"])
    def test_26_addition_normal(self): self.assertEqual(announcement_diff(details(ann("new", "2026-07-12")), {}, self.current_window, self.previous_window)["added"], 1)
    def test_27_modified_title(self): self.assertEqual(announcement_diff(details(ann("x", "2025-01-01", title="new")), details(ann("x", "2025-01-01")), self.current_window, self.previous_window)["modifiedIds"], ["x"])
    def test_28_modified_url(self): self.assertEqual(announcement_diff(details(ann("x", "2025-01-01", officialUrl="https://www.cninfo.com.cn/new")), details(ann("x", "2025-01-01")), self.current_window, self.previous_window)["modified"], 1)


class ChecksumTests(unittest.TestCase):
    def make_tree(self, root: Path):
        (root / "nested").mkdir(parents=True); (root / "a.json").write_bytes(b"a\n"); (root / "nested/b.json").write_bytes(b"b\n")
    def test_29_same_tree_different_run_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            one, two = Path(tmp) / "run-a/generated", Path(tmp) / "run-b/generated"; self.make_tree(one); shutil.copytree(one, two)
            self.assertEqual(tree_digest([one], one), tree_digest([two], two))
    def test_30_content_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.make_tree(root); before = tree_digest([root], root); (root / "a.json").write_bytes(b"changed"); self.assertNotEqual(before, tree_digest([root], root))
    def test_31_file_added(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.make_tree(root); before = tree_digest([root], root); (root / "c").write_bytes(b"c"); self.assertNotEqual(before, tree_digest([root], root))
    def test_32_file_deleted(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.make_tree(root); before = tree_digest([root], root); (root / "a.json").unlink(); self.assertNotEqual(before, tree_digest([root], root))
    def test_33_file_renamed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); self.make_tree(root); before = tree_digest([root], root); (root / "a.json").rename(root / "renamed.json"); self.assertNotEqual(before, tree_digest([root], root))
    def test_34_path_separator_stable_contract(self): self.assertEqual(Path("a/b").as_posix(), "a/b")
    def test_35_outside_root_rejected(self):
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            path = Path(two) / "x"; path.write_bytes(b"x")
            with self.assertRaises(ValueError): tree_digest([path], Path(one))
    def test_36_manifest_digest_is_bytes_only(self):
        with tempfile.TemporaryDirectory() as one, tempfile.TemporaryDirectory() as two:
            a, b = Path(one) / "manifest.json", Path(two) / "manifest.json"; a.write_bytes(b"same"); b.write_bytes(b"same"); self.assertEqual(file_digest(a), file_digest(b))


class FinancialDriftTests(unittest.TestCase):
    def summary(self, period="2026-03-31", revenue=1, generated="a"):
        return {"items": {"stock": {"latestReportPeriod": period, "generatedAt": generated, "latestSingleQuarter": {"operatingRevenue": revenue, "netProfitAttributableToParent": 2, "netProfitExcludingNonRecurring": 3, "netOperatingCashFlow": 4}, "latestBalanceSheet": {"accountsReceivable": 5, "inventory": 6}, "latestRatios": {"grossMargin": .1, "netMargin": .2, "debtToAssetRatio": .3, "researchExpenseRatio": .4}}}}
    def test_37_same_period_drift_detail(self):
        diff = financial_diff(self.summary(revenue=2), self.summary(revenue=1), "new", "old"); row = diff["valueDrifts"][0]; self.assertEqual((row["stockId"], row["reportPeriod"], row["previousRunId"], row["currentRunId"]), ("stock", "2026-03-31", "old", "new"))
    def test_38_drift_is_blocking(self): self.assertIn("data_value_drift", BLOCKING_FAILURES)
    def test_39_new_period_not_drift(self): self.assertEqual(financial_diff(self.summary("2026-06-30", 2), self.summary("2026-03-31", 1))["valueDrifts"], [])
    def test_40_time_only_not_drift(self): self.assertEqual(financial_diff(self.summary(generated="b"), self.summary(generated="a"))["valueDrifts"], [])
    def test_41_numeric_equivalence(self): self.assertEqual(financial_diff(self.summary(revenue=1.0), self.summary(revenue=1))["valueDrifts"], [])
    def test_42_key_order_not_drift(self): self.assertEqual(financial_diff(json.loads(json.dumps(self.summary(), sort_keys=True)), self.summary())["valueDrifts"], [])
    def test_43_drift_blocks_evaluation(self):
        runs = [run(PROVIDERS[0], failures=[failure("data_value_drift")]), run(PROVIDERS[1])]; self.assertEqual(evaluate(runs, config(), production())["status"], "blocked")


class RateTests(unittest.TestCase):
    def test_44_complete_and_total_distinct(self):
        items = [run(status="success"), run(index=1, status="partial")]; summary = summarize_provider(items, "Asia/Shanghai"); self.assertEqual((summary["completeSuccessRate"], summary["totalSuccessRate"]), (.5, 1.0))
    def test_45_usable_partial_total_only(self):
        summary = summarize_provider([run(status="partial")], "Asia/Shanghai"); self.assertEqual((summary["completeSuccessRuns"], summary["usableRuns"]), (0, 1))
    def test_46_structural_partial_not_usable(self): self.assertEqual(summarize_provider([run(status="partial", rate=0)], "Asia/Shanghai")["usableRuns"], 0)
    def test_47_coverage_partial_not_usable(self): self.assertEqual(summarize_provider([run(status="partial", coverage=55)], "Asia/Shanghai")["usableRuns"], 0)
    def test_48_blocking_partial_not_usable(self): self.assertEqual(summarize_provider([run(status="partial", failures=[failure("schema_drift")])], "Asia/Shanghai")["usableRuns"], 0)
    def test_49_failed_count(self): self.assertEqual(summarize_provider([run(status="failed")], "Asia/Shanghai")["failedRuns"], 1)
    def test_50_company_partial_does_not_force_run_partial(self): self.assertEqual(summarize_provider([run(status="success")], "Asia/Shanghai")["completeSuccessRate"], 1)
    def test_50b_window_counts_in_health(self):
        item = run(PROVIDERS[1]); item["metrics"].update(expectedWindowExpiryCount=2, unexpectedRemovalCount=1, unverifiableRemovalCount=3, windowShiftDays=1); summary = summarize_provider([item], "Asia/Shanghai"); self.assertEqual((summary["expectedWindowExpiryCount"], summary["unexpectedRemovalCount"], summary["unverifiableRemovalCount"], summary["latestWindowShiftDays"]), (2, 1, 3, 1))


class ResolutionTests(unittest.TestCase):
    def failed_run(self): return run(failures=[failure("schema_drift")])
    def test_51_unknown_run_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            resolution = make_resolution(PROVIDERS[0], "missing", 0, "schema_drift", "reason", "evidence", "tester")
            with self.assertRaises(ValueError): append_resolution(Path(tmp), resolution, [])
    def test_52_category_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); append_run(root, item); resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "timeout", "reason", "evidence", "tester")
            with self.assertRaises(ValueError): append_resolution(root, resolution)
    def test_53_reason_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); append_run(root, item); resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "", "evidence", "tester")
            with self.assertRaises(ValueError): append_resolution(root, resolution)
    def test_54_evidence_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); append_run(root, item); resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "reason", "", "tester")
            with self.assertRaises(ValueError): append_resolution(root, resolution)
    def test_55_resolution_unblocks_failure(self):
        item = self.failed_run(); resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "verified", "official evidence", "tester"); self.assertNotEqual(evaluate([item], config(), production(), [resolution])["status"], "blocked")
    def test_56_resolution_does_not_modify_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); append_run(root, item); run_path = root / "runs" / f"{item['runId']}.json"; before = run_path.read_bytes(); append_resolution(root, make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "verified", "official evidence", "tester")); self.assertEqual(before, run_path.read_bytes())
    def test_57_duplicate_resolution_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); append_run(root, item); resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "verified", "evidence", "tester"); append_resolution(root, resolution)
            with self.assertRaises(ValueError): append_resolution(root, resolution)
    def test_58_resolution_ledger_lf(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); append_run(root, item); append_resolution(root, make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "verified", "evidence", "tester")); self.assertNotIn(b"\r\n", (root / "provider-health-resolutions.jsonl").read_bytes())
    def test_58b_unknown_replacement_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); append_run(root, item); resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "verified", "evidence", "tester", "missing-replacement")
            with self.assertRaises(ValueError): append_resolution(root, resolution)
    def test_cross_provider_replacement_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); replacement = run(PROVIDERS[1], 1); append_run(root, item); append_run(root, replacement)
            resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "verified", "evidence", "tester", replacement["runId"])
            with self.assertRaises(ValueError): append_resolution(root, resolution)
    def test_cross_cohort_replacement_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = self.failed_run(); replacement = run(PROVIDERS[0], 1, provenance_value=provenance(providerCodeChecksum="9" * 64)); append_run(root, item); append_run(root, replacement)
            resolution = make_resolution(PROVIDERS[0], item["runId"], 0, "schema_drift", "verified", "evidence", "tester", replacement["runId"])
            with self.assertRaises(ValueError): append_resolution(root, resolution)


class ProductionGateTests(unittest.TestCase):
    def test_59_financial_damage_blocks(self): self.assertEqual(evaluate([], config(), production(financial=False))["status"], "blocked")
    def test_60_announcement_damage_blocks(self): self.assertEqual(evaluate([], config(), production(announcements=False))["status"], "blocked")
    def test_61_audit_p0_blocks(self): self.assertEqual(evaluate([], config(), production(audit=False, p0=1, errors=1))["status"], "blocked")
    def test_62_audit_error_blocks(self): self.assertEqual(evaluate([], config(), production(audit=False, errors=1))["status"], "blocked")
    def test_63_default_refresh_blocks(self): self.assertEqual(evaluate([], config(), production(refresh=False))["status"], "blocked")
    def test_64_missing_financial_fixture_fails(self):
        with tempfile.TemporaryDirectory() as tmp: self.assertFalse(validate_financial_production(Path(tmp))["passed"])
    def test_65_missing_announcement_fixture_fails(self):
        with tempfile.TemporaryDirectory() as tmp: self.assertFalse(validate_announcement_production(Path(tmp))["passed"])
    def test_66_default_refresh_detection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root / "package.json").write_text(json.dumps({"scripts": {"data:refresh": "npm run data:fetch:financials:a"}})); self.assertFalse(validate_default_refresh(root)["passed"])
    def test_67_current_production_passes(self): self.assertTrue(validate_production(ROOT)["passed"])
    def test_68_health_implementation_has_no_provider_network(self):
        source = (ROOT / "scripts/provider_observability/production.py").read_text(encoding="utf-8"); self.assertNotIn("requests", source); self.assertNotIn("SinaFinancialProvider", source); self.assertNotIn("CNInfoClient", source)


class EligibilityTests(unittest.TestCase):
    def test_69_first_day_insufficient(self): self.assertEqual(evaluate([run(PROVIDERS[0]), run(PROVIDERS[1])], config(), production())["status"], "insufficient_observation_window")
    def test_70_same_day_not_distinct(self):
        runs = [run(provider, index, same_day=True) for provider in PROVIDERS for index in range(10)]; self.assertEqual(evaluate(runs, config(), production())["observationDays"], 1)
    def test_71_two_days_observing(self): self.assertEqual(evaluate([run(provider, index) for provider in PROVIDERS for index in (0, 2)], config(), production())["status"], "observing")
    def test_72_qualified(self): self.assertEqual(evaluate([run(provider, index) for provider in PROVIDERS for index in range(10)], config(), production())["status"], "qualified")
    def test_73_debug_run_excluded(self): self.assertEqual(evaluate([run(PROVIDERS[0], eligible=False), run(PROVIDERS[1], eligible=False)], config(), production())["observationDays"], 0)
    def test_74_provider_unavailable(self): self.assertEqual(evaluate([run(PROVIDERS[0]), run(PROVIDERS[1], status="failed", failures=[failure("provider_unavailable")])], config(), production())["status"], "provider_unavailable")
    def test_75_bad_timezone(self):
        with self.assertRaises(Exception): validate_config(config(timezone="Mars/Olympus"))
    def test_76_threshold_not_weakened(self):
        actual = json.loads((ROOT / "config/provider-stability-gate-v1.json").read_text(encoding="utf-8")); self.assertEqual((actual["minimumDistinctDays"], actual["minimumRunsPerProvider"], actual["minimumCompleteSuccessRate"], actual["minimumTotalSuccessRate"]), (5, 10, .9, .95))
    def test_legacy_run_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); legacy = legacy_run()
            materialize_observation(root, legacy)
            anchors = anchors_for(legacy)
            write_observation_ledger(root, [legacy])
            audit = audit_observation_ledger(root, load_runs(root), anchors)
        summary = evaluate([legacy], config(), production(), current_provenance={provider: provenance() for provider in PROVIDERS}, ledger_audit=audit)
        self.assertEqual((summary["providers"][PROVIDERS[0]]["totalRuns"], summary["providers"][PROVIDERS[0]]["cohortAudit"]["legacyRuns"]), (0, 1))
    def test_current_compatible_cohort_included(self):
        summary = evaluate([run(PROVIDERS[0]), run(PROVIDERS[1])], config(), production(), current_provenance={provider: provenance() for provider in PROVIDERS})
        self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["currentEligibleRuns"], 1)
    def test_each_provenance_drift_excluded(self):
        fields = {
            "observationToolChecksum": "9" * 64,
            "providerCodeChecksum": "9" * 64,
            "fetchScriptChecksum": "9" * 64,
            "validatorChecksum": "9" * 64,
            "stockUniverseChecksum": "9" * 64,
            "stockUniverseIdentityCount": 55,
            "gateConfigChecksum": "9" * 64,
            "productionBaselineChecksum": "9" * 64,
            "dependencyFingerprint": "9" * 64,
        }
        targets = {provider: provenance() for provider in PROVIDERS}
        for field, value in fields.items():
            with self.subTest(field=field):
                item = run(PROVIDERS[0], provenance_value=provenance(**{field: value}))
                summary = evaluate([item], config(), production(), current_provenance=targets)
                self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["incompatibleRuns"], 1)
    def test_source_commit_unavailable_excluded(self):
        item = run(PROVIDERS[0], provenance_value=provenance(sourceCommitSha="unavailable"))
        summary = evaluate([item], config(), production(), current_provenance={provider: provenance() for provider in PROVIDERS})
        self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["incompatibleRuns"], 1)
    def test_current_provenance_failure_blocks(self):
        summary = evaluate([], config(), production(), current_provenance={}, current_provenance_failures={PROVIDERS[0]: ["source commit SHA is unavailable"]})
        self.assertEqual((summary["status"], summary["blockingFailures"]), ("blocked", ["provenance_unavailable"]))


class WorktreeTests(unittest.TestCase):
    def test_77_dirty_paths_only_names(self): self.assertEqual(dirty_paths(" M file.py\n?? new.txt\n"), ["file.py", "new.txt"])
    def test_78_dirty_rejected(self):
        with self.assertRaises(DirtyWorktreeError): observation_eligibility(" M file.py\n", False)
    def test_79_clean_eligible(self): self.assertTrue(observation_eligibility("", False))
    def test_80_dirty_debug_ineligible(self): self.assertFalse(observation_eligibility(" M file.py\n", True))
    def test_81_preflight_before_observe_contract(self):
        source = (ROOT / "scripts/observe-providers.py").read_text(encoding="utf-8"); self.assertLess(source.index("observation_eligibility(git_status()"), source.index("codes = [observe"))
    def test_agents_untracked_file_allowed(self): self.assertTrue(observation_eligibility("?? AGENTS.md\n", False))


class SchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads((ROOT / "config/provider-observation-run.schema.json").read_text(encoding="utf-8")); checker = FormatChecker()
        @checker.checks("date-time", raises=ValueError)
        def valid_datetime(value): datetime.fromisoformat(value.replace("Z", "+00:00")); return True
        @checker.checks("date", raises=ValueError)
        def valid_date(value): datetime.strptime(value, "%Y-%m-%d"); return True
        cls.validator = Draft202012Validator(cls.schema, format_checker=checker)
    def test_82_valid_fixture(self):
        fixture = json.loads((ROOT / "scripts/tests/fixtures/provider-observation-run.valid.json").read_text(encoding="utf-8")); self.assertEqual(list(self.validator.iter_errors(fixture)), [])
    def test_83_missing_metrics_rejected(self):
        value = run(); value.pop("metrics"); self.assertTrue(list(self.validator.iter_errors(value)))
    def test_84_bad_failure_rejected(self):
        value = run(); value["failures"] = [failure("bad")]; self.assertTrue(list(self.validator.iter_errors(value)))
    def test_85_bad_date_rejected(self):
        value = run(); value["startedAt"] = "not-a-date"; self.assertTrue(list(self.validator.iter_errors(value)))
    def test_86_additional_top_field_rejected(self):
        value = run(); value["extra"] = 1; self.assertTrue(list(self.validator.iter_errors(value)))
    def test_absolute_command_path_rejected(self):
        value = run(); value["command"] = ["python", "D:\\repo\\scripts\\fetch.py"]
        with self.assertRaises(ValueError): validate_run(value)
    def test_v2_provenance_is_complete(self): self.assertTrue(valid_provenance(provenance()))


class LedgerEvidenceTests(unittest.TestCase):
    def test_artifact_checksum_mismatch_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); item = run()
            generated = root / item["artifacts"]["generatedRoot"]; detail = generated / "a-share-financials"; detail.mkdir(parents=True)
            (generated / "a-share-financial-summaries.generated.json").write_text("{}\n", encoding="utf-8")
            (detail / "manifest.generated.json").write_text("{}\n", encoding="utf-8")
            append_run(root, item)
            audit = audit_observation_ledger(root, load_runs(root))
            self.assertIn(item["runId"], audit["invalidRunIds"])


class ProvenanceIntegrityTests(unittest.TestCase):
    def assert_tampered_invalid(self, field, value):
        candidate = provenance()
        stored_cohort_id = candidate["provenanceCohortId"]
        candidate[field] = value
        self.assertEqual(candidate["provenanceCohortId"], stored_cohort_id)
        self.assertFalse(valid_provenance(candidate))

    def test_tampered_cohort_id_rejected(self):
        self.assert_tampered_invalid("providerCodeChecksum", "9" * 64)

    def test_tampered_validator_checksum_rejected(self):
        self.assert_tampered_invalid("validatorChecksum", "9" * 64)

    def test_tampered_stock_universe_checksum_rejected(self):
        self.assert_tampered_invalid("stockUniverseChecksum", "9" * 64)

    def test_non_hex_source_commit_rejected(self):
        self.assertFalse(valid_provenance(provenance(sourceCommitSha="z" * 40)))

    def test_boolean_identity_count_rejected(self):
        self.assertFalse(valid_provenance(provenance(stockUniverseIdentityCount=True)))

    def test_incompatible_observation_tool_version_rejected(self):
        self.assertFalse(valid_provenance(provenance(observationToolVersion="1.0.0")))

    def test_recomputed_provenance_passes(self):
        candidate = provenance(providerCodeChecksum="9" * 64)
        self.assertEqual(candidate["provenanceCohortId"], cohort_id(candidate))
        self.assertTrue(valid_provenance(candidate))

    def test_damaged_current_provenance_blocks_gate(self):
        target = provenance()
        damaged = copy.deepcopy(target)
        damaged["providerCodeChecksum"] = "9" * 64
        summary = evaluate(
            [run(PROVIDERS[0], provenance_value=damaged)],
            config(),
            production(),
            current_provenance={provider: target for provider in PROVIDERS},
        )
        self.assertEqual(summary["status"], "blocked")
        self.assertIn("checksum_mismatch", summary["blockingFailures"])


class RecordableProvenanceTests(unittest.TestCase):
    def test_recordable_complete_provenance_passes_both_contracts(self):
        candidate = provenance()
        self.assertTrue(valid_provenance(candidate))
        self.assertTrue(recordable_provenance(candidate))
        self.assertFalse(unavailable_provenance(candidate))

    def test_recordable_source_sha_unavailable(self):
        candidate = provenance(sourceCommitSha=UNAVAILABLE)
        self.assertFalse(valid_provenance(candidate))
        self.assertTrue(recordable_provenance(candidate))
        self.assertTrue(unavailable_provenance(candidate))

    def test_recordable_checksum_unavailable_requires_unavailable_cohort(self):
        candidate = provenance(providerCodeChecksum=UNAVAILABLE)
        self.assertEqual(candidate["provenanceCohortId"], UNAVAILABLE)
        self.assertFalse(valid_provenance(candidate))
        self.assertTrue(recordable_provenance(candidate))

    def test_recordable_zero_count_only_when_stock_identity_unavailable(self):
        candidate = provenance(stockUniverseChecksum=UNAVAILABLE, stockUniverseIdentityCount=0)
        self.assertTrue(recordable_provenance(candidate))
        self.assertFalse(recordable_provenance(provenance(stockUniverseIdentityCount=0)))
        self.assertTrue(recordable_provenance(provenance(stockUniverseChecksum=UNAVAILABLE)))

    def test_recordable_rejects_boolean_negative_and_non_integer_counts(self):
        for value in (True, -1, 1.5):
            with self.subTest(value=value):
                self.assertFalse(recordable_provenance(provenance(stockUniverseIdentityCount=value)))

    def test_recordable_rejects_arbitrary_non_hex_component(self):
        self.assertFalse(recordable_provenance(provenance(sourceCommitSha="not-unavailable")))
        self.assertFalse(recordable_provenance(provenance(validatorChecksum="g" * 64)))

    def test_recordable_rejects_partial_unavailable_with_sha_cohort(self):
        candidate = provenance(fetchScriptChecksum=UNAVAILABLE)
        candidate["provenanceCohortId"] = "9" * 64
        self.assertFalse(recordable_provenance(candidate))

    def test_recordable_rejects_complete_components_with_unavailable_cohort(self):
        candidate = provenance()
        candidate["provenanceCohortId"] = UNAVAILABLE
        self.assertFalse(recordable_provenance(candidate))


class ProvenanceUnavailableRunTests(unittest.TestCase):
    def test_validate_recordable_unavailable_run(self):
        validate_run(unavailable_run())

    def test_append_recordable_unavailable_writes_run_and_ledger(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            item = unavailable_run()
            append_run(root, item)
            self.assertEqual(load_runs(root), [item])
            ledger = [json.loads(line) for line in (root / "provider-health-ledger.jsonl").read_text(encoding="utf-8").splitlines()]
            self.assertEqual(ledger, [item])

    def test_audit_recordable_unavailable_is_not_invalid_v2(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            item = unavailable_run()
            materialize_observation(root, item)
            write_observation_ledger(root, [item])
            audit = audit_observation_ledger(root, load_runs(root))
            self.assertNotIn(item["runId"], audit["invalidV2RunIds"])
            self.assertFalse(audit["v2IntegrityFailure"])

    def test_evaluate_excludes_unavailable_from_all_denominators(self):
        item = unavailable_run()
        summary = evaluate(
            [item],
            config(),
            production(),
            current_provenance={provider: provenance() for provider in PROVIDERS},
        )
        provider = summary["providers"][PROVIDERS[0]]
        self.assertEqual((provider["totalRuns"], provider["distinctDays"], summary["observationDays"]), (0, 0, 0))
        self.assertEqual((provider["completeSuccessRate"], provider["totalSuccessRate"], provider["latestStatus"]), (0, 0, None))
        self.assertEqual(provider["cohortAudit"]["provenanceUnavailableRuns"], 1)
        self.assertEqual(provider["cohortAudit"]["incompatibleRuns"], 0)
        self.assertNotIn("provenance_unavailable", summary["blockingFailures"])

    def test_unavailable_provenance_with_eligible_sample_rejected(self):
        item = unavailable_run()
        item["metrics"]["eligibleSample"] = True
        with self.assertRaisesRegex(ValueError, "must be ineligible"):
            validate_run(item)

    def test_unavailable_provenance_with_success_status_rejected(self):
        item = unavailable_run(status="success")
        with self.assertRaisesRegex(ValueError, "cannot be successful"):
            validate_run(item)

    def test_unavailable_provenance_without_failure_rejected(self):
        item = unavailable_run(failures=[])
        with self.assertRaisesRegex(ValueError, "requires an unresolved"):
            validate_run(item)

    def test_unavailable_provenance_with_empty_failure_message_rejected(self):
        item = unavailable_run(failures=[failure("provenance_unavailable", "")])
        with self.assertRaisesRegex(ValueError, "requires an unresolved"):
            validate_run(item)

    def test_unavailable_provenance_with_resolved_failure_rejected(self):
        item = unavailable_run()
        item["failures"][0]["resolved"] = True
        with self.assertRaisesRegex(ValueError, "requires an unresolved"):
            validate_run(item)

    def test_schema_accepts_structured_unavailable_basic_union(self):
        schema = json.loads((ROOT / "config/provider-observation-run.schema.json").read_text(encoding="utf-8"))
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        self.assertEqual(list(validator.iter_errors(unavailable_run())), [])


class ObserverProvenanceRetentionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        script = ROOT / "scripts/observe-providers.py"
        spec = importlib.util.spec_from_file_location("observe_providers_retention_test", script)
        if spec is None or spec.loader is None:
            raise RuntimeError("cannot load observe-providers.py")
        cls.observer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.observer)

    def observe_with_unavailable_provenance(self, provider_returncode=0):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        observation_root = Path(temporary.name)
        write_root_state(
            observation_root,
            build_root_state(FRESH_V2, []),
            atomic_write,
            json_bytes,
        )
        calls = []

        def fake_run(command, *args, **kwargs):
            calls.append(command)
            if command[:2] == ["node", "--version"]:
                return SimpleNamespace(returncode=0, stdout="v22.15.0\n", stderr="")
            generated = Path(command[command.index("--output-root") + 1])
            detail = generated / "a-share-financials"
            detail.mkdir(parents=True, exist_ok=True)
            (generated / "a-share-financial-summaries.generated.json").write_text('{"items":{}}\n', encoding="utf-8")
            (detail / "manifest.generated.json").write_text(
                json.dumps({"total": 56, "success": 56, "partial": 0, "error": 0}) + "\n",
                encoding="utf-8",
            )
            return SimpleNamespace(
                returncode=provider_returncode,
                stdout="",
                stderr="provider timed out" if provider_returncode else "",
            )

        candidate = provenance(sourceCommitSha=UNAVAILABLE)
        with (
            patch.object(self.observer, "build_provenance", return_value=(candidate, ["source commit SHA is unavailable"])),
            patch.object(self.observer, "subprocess") as subprocess_mock,
            patch.object(self.observer, "validate_split_artifacts", return_value=[]),
            patch.object(self.observer, "git_status", return_value="?? AGENTS.md\n"),
            patch.object(self.observer, "refresh_summary", return_value={}) as refresh,
            patch("builtins.print"),
        ):
            subprocess_mock.run.side_effect = fake_run
            code = self.observer.observe(
                "financials",
                observation_root,
                False,
                20,
                f"retention-{provider_returncode}",
            )
        return observation_root, code, calls, refresh

    def test_observe_persists_provenance_failure_and_refreshes_summary(self):
        root, code, calls, refresh = self.observe_with_unavailable_provenance()
        runs = load_runs(root)
        self.assertEqual(code, 1)
        self.assertEqual(len(runs), 1)
        self.assertTrue(any("fetch-a-share-financials.py" in str(part) for part in calls[0]))
        self.assertEqual(runs[0]["status"], "partial")
        self.assertFalse(runs[0]["metrics"]["eligibleSample"])
        self.assertEqual([item["category"] for item in runs[0]["failures"]], ["provenance_unavailable"])
        self.assertTrue((root / "provider-health-ledger.jsonl").exists())
        refresh.assert_called_once_with(root)

    def test_observe_persisted_run_audits_and_remains_excluded(self):
        root, _, _, _ = self.observe_with_unavailable_provenance()
        runs = load_runs(root)
        audit = audit_observation_ledger(root, runs)
        summary = evaluate(
            runs,
            config(),
            production(),
            current_provenance={provider: provenance() for provider in PROVIDERS},
            ledger_audit=audit,
        )
        self.assertEqual(audit["invalidV2RunIds"], [])
        self.assertFalse(audit["v2IntegrityFailure"])
        self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["provenanceUnavailableRuns"], 1)
        self.assertEqual(summary["providers"][PROVIDERS[0]]["totalRuns"], 0)
        self.assertEqual(summary["observationDays"], 0)

    def test_observe_provider_failure_preserves_both_failure_categories(self):
        root, code, _, _ = self.observe_with_unavailable_provenance(provider_returncode=1)
        categories = {item["category"] for item in load_runs(root)[0]["failures"]}
        self.assertEqual(code, 1)
        self.assertEqual(categories, {"provenance_unavailable", "timeout"})


class ProvenanceRecoveryTests(unittest.TestCase):
    def test_recovery_keeps_unavailable_history_outside_denominator(self):
        unavailable = unavailable_run(PROVIDERS[0], 0)
        current = run(PROVIDERS[0], 2)
        peer = run(PROVIDERS[1], 2)
        summary = evaluate(
            [unavailable, current, peer],
            config(),
            production(),
            current_provenance={provider: provenance() for provider in PROVIDERS},
        )
        provider = summary["providers"][PROVIDERS[0]]
        self.assertEqual(provider["cohortAudit"]["provenanceUnavailableRuns"], 1)
        self.assertEqual(provider["cohortAudit"]["currentEligibleRuns"], 1)
        self.assertEqual((provider["totalRuns"], provider["distinctDays"]), (1, 1))
        self.assertNotIn("provenance_unavailable", summary["blockingFailures"])


class ReadTimeRunLedgerIntegrityTests(unittest.TestCase):
    def audit(self, item, legacy_anchors=None):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        materialize_observation(root, item)
        write_observation_ledger(root, [item])
        return audit_observation_ledger(root, load_runs(root), {} if legacy_anchors is None else legacy_anchors)

    def test_same_invalid_v2_in_run_file_and_ledger_detected(self):
        item = run()
        item["status"] = "forged"
        audit = self.audit(item)
        self.assertIn(item["runId"], audit["invalidV2RunIds"])
        self.assertTrue(audit["v2IntegrityFailure"])

    def test_absolute_command_path_invalid_at_read_time(self):
        item = run()
        item["command"] = ["python", "D:\\repo\\scripts\\fetch.py"]
        self.assertIn(item["runId"], self.audit(item)["invalidV2RunIds"])

    def test_sensitive_v2_run_invalid_at_read_time(self):
        item = run()
        item["messages"] = ["https://example.test/?token=raw-secret"]
        self.assertIn(item["runId"], self.audit(item)["invalidV2RunIds"])

    def test_bad_atomicity_checksum_invalid_at_read_time(self):
        item = run()
        item["atomicity"]["beforeChecksum"] = "BAD"
        self.assertIn(item["runId"], self.audit(item)["invalidV2RunIds"])

    def test_missing_provenance_invalid_at_read_time(self):
        item = run()
        item.pop("provenance")
        self.assertIn(item["runId"], self.audit(item)["invalidV2RunIds"])

    def test_damaged_failed_run_cannot_improve_denominator(self):
        target = provenance()
        items = [run(provider, index, provenance_value=copy.deepcopy(target)) for provider in PROVIDERS for index in range(10)]
        damaged = run(PROVIDERS[0], 99, status="failed", provenance_value=copy.deepcopy(target))
        damaged["provenance"]["validatorChecksum"] = "9" * 64
        items.append(damaged)
        summary = evaluate(
            items,
            config(),
            production(),
            current_provenance={provider: target for provider in PROVIDERS},
        )
        self.assertEqual(summary["status"], "blocked")

    def test_valid_legacy_run_remains_legacy(self):
        item = legacy_run()
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        materialize_observation(root, item)
        anchors = anchors_for(item)
        write_observation_ledger(root, [item])
        audit = audit_observation_ledger(root, load_runs(root), anchors)
        summary = evaluate(
            [item],
            config(),
            production(),
            current_provenance={provider: provenance() for provider in PROVIDERS},
            ledger_audit=audit,
        )
        self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["legacyRuns"], 1)
        self.assertNotEqual(summary["status"], "blocked")

    def test_legacy_checksum_mismatch_is_non_blocking(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            item = legacy_run()
            materialize_observation(root, item)
            anchors = anchors_for(item)
            generated = root / item["artifacts"]["generatedRoot"]
            (generated / "a-share-financial-summaries.generated.json").write_text('{"tampered":true}\n', encoding="utf-8")
            write_observation_ledger(root, [item])
            audit = audit_observation_ledger(root, load_runs(root), anchors)
            summary = evaluate(
                [item],
                config(),
                production(),
                current_provenance={provider: provenance() for provider in PROVIDERS},
                ledger_audit=audit,
            )
            self.assertFalse(audit["v2IntegrityFailure"])
            self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["legacyRuns"], 1)
            self.assertNotEqual(summary["status"], "blocked")


class LegacyAnchorAndDowngradeTests(unittest.TestCase):
    def audit_items(self, items, legacy_anchors):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        for item in items:
            materialize_observation(root, item)
        write_observation_ledger(root, items)
        loaded = load_runs(root)
        return root, loaded, audit_observation_ledger(root, loaded, legacy_anchors)

    def summary(self, runs, audit):
        return evaluate(
            runs,
            config(),
            production(),
            current_provenance={provider: provenance() for provider in PROVIDERS},
            ledger_audit=audit,
        )

    def assert_legacy_blocked(self, runs, audit):
        summary = self.summary(runs, audit)
        self.assertEqual(summary["status"], "blocked")
        self.assertIn("legacy_integrity_failure", summary["blockingFailures"])
        return summary

    # Anchored Legacy: 1-8
    def test_anchored_legacy_config_unique(self):
        anchors = load_legacy_anchors()
        self.assertEqual(set(anchors), set(EXPECTED_LEGACY_PROVIDERS))
        self.assertEqual(
            {run_id: anchor["providerId"] for run_id, anchor in anchors.items()},
            EXPECTED_LEGACY_PROVIDERS,
        )

    def test_canonical_digest_ignores_json_key_order_and_layout(self):
        item = legacy_run()
        reordered = {key: item[key] for key in reversed(list(item))}
        reparsed = json.loads(json.dumps(reordered, ensure_ascii=False, indent=4))
        self.assertEqual(canonical_record_sha256(item), canonical_record_sha256(reparsed))

    def test_exact_anchor_enters_trusted_legacy(self):
        item = legacy_run()
        root, runs, _ = self.audit_items([item], {})
        anchors = anchors_for(runs[0])
        audit = audit_observation_ledger(root, runs, anchors)
        summary = self.summary(runs, audit)
        self.assertEqual(audit["trustedLegacyRunIds"], [item["runId"]])
        self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["trustedLegacyRuns"], 1)
        self.assertNotEqual(summary["status"], "blocked")

    def test_anchor_provider_mismatch_rejected(self):
        item = legacy_run()
        anchors = anchors_for(item)
        item["providerId"] = PROVIDERS[1]
        item["domain"] = "announcements"
        with self.assertRaisesRegex(ValueError, "providerId mismatch"):
            validate_legacy_run(item, anchors)

    def test_anchor_started_at_mismatch_rejected(self):
        item = legacy_run()
        anchors = anchors_for(item)
        item["startedAt"] = "2026-07-02T00:00:00Z"
        with self.assertRaisesRegex(ValueError, "startedAt mismatch"):
            validate_legacy_run(item, anchors)

    def test_anchor_digest_mismatch_rejected(self):
        item = legacy_run()
        anchors = anchors_for(item)
        item["durationSeconds"] += 1
        with self.assertRaisesRegex(ValueError, "canonicalRecordSha256 mismatch"):
            validate_legacy_run(item, anchors)

    def test_duplicate_anchor_run_id_rejected(self):
        item = legacy_run()
        anchor = {
            "runId": item["runId"],
            "providerId": item["providerId"],
            "startedAt": item["startedAt"],
            "canonicalRecordSha256": canonical_record_sha256(item),
        }
        with self.assertRaisesRegex(ValueError, "duplicate legacy anchor"):
            validate_legacy_anchor_config({"schemaVersion": "1.0.0", "records": [anchor, copy.deepcopy(anchor)]})

    def test_invalid_anchor_sha256_rejected(self):
        item = legacy_run()
        anchor = {
            "runId": item["runId"],
            "providerId": item["providerId"],
            "startedAt": item["startedAt"],
            "canonicalRecordSha256": "BAD",
        }
        with self.assertRaisesRegex(ValueError, "digest is invalid"):
            validate_legacy_anchor_config({"schemaVersion": "1.0.0", "records": [anchor]})

    # Schema Downgrade: 9-16
    def test_schema_downgrade_only_version_blocked(self):
        item = run()
        item["schemaVersion"] = "1.0.0"
        _, runs, audit = self.audit_items([item], {})
        self.assertIn(item["runId"], audit["schemaDowngradeRunIds"])
        self.assert_legacy_blocked(runs, audit)

    def test_schema_downgrade_without_provenance_blocked(self):
        item = run()
        item["schemaVersion"] = "1.0.0"
        item.pop("provenance")
        _, runs, audit = self.audit_items([item], {})
        self.assertIn(item["runId"], audit["schemaDowngradeRunIds"])
        self.assert_legacy_blocked(runs, audit)

    def test_schema_downgrade_without_eligible_sample_blocked(self):
        item = run()
        item["schemaVersion"] = "1.0.0"
        item["metrics"].pop("eligibleSample")
        _, runs, audit = self.audit_items([item], {})
        self.assertIn(item["runId"], audit["schemaDowngradeRunIds"])
        self.assert_legacy_blocked(runs, audit)

    def test_failed_current_schema_downgrade_cannot_improve_qualified_denominator(self):
        items = [run(provider, index) for provider in PROVIDERS for index in range(10)]
        downgraded = run(PROVIDERS[0], 99, status="failed", failures=[failure("schema_drift")])
        downgraded["schemaVersion"] = "1.0.0"
        items.append(downgraded)
        _, runs, audit = self.audit_items(items, {})
        summary = self.assert_legacy_blocked(runs, audit)
        self.assertEqual(summary["providers"][PROVIDERS[0]]["totalRuns"], 10)
        self.assertIn(downgraded["runId"], summary["providers"][PROVIDERS[0]]["cohortAudit"]["incompatibleRunIds"])

    def test_schema_downgrade_spoofing_anchor_run_id_blocked(self):
        anchored = legacy_run(run_id="synthetic-legacy")
        anchors = anchors_for(anchored)
        forged = legacy_run(run_id=anchored["runId"])
        forged["durationSeconds"] += 1
        _, runs, audit = self.audit_items([forged], anchors)
        self.assertIn(forged["runId"], audit["invalidLegacyRunIds"])
        self.assert_legacy_blocked(runs, audit)

    def test_schema_downgrade_spoofing_anchor_provider_or_started_at_blocked(self):
        for field in ("providerId", "startedAt"):
            with self.subTest(field=field):
                anchored = legacy_run(run_id=f"synthetic-legacy-{field}")
                anchors = anchors_for(anchored)
                forged = copy.deepcopy(anchored)
                if field == "providerId":
                    forged["providerId"] = PROVIDERS[1]
                    forged["domain"] = "announcements"
                else:
                    forged["startedAt"] = "2026-07-02T00:00:00Z"
                    forged["endedAt"] = "2026-07-02T00:00:02Z"
                _, runs, audit = self.audit_items([forged], anchors)
                self.assertIn(forged["runId"], audit["invalidLegacyRunIds"])
                self.assert_legacy_blocked(runs, audit)

    def test_unknown_new_v1_run_blocked(self):
        item = legacy_run(run_id="unknown-new-v1")
        _, runs, audit = self.audit_items([item], {})
        self.assertEqual(audit["unknownLegacyRunIds"], [item["runId"]])
        self.assert_legacy_blocked(runs, audit)

    def test_non_anchor_v1_not_counted_as_legacy_runs(self):
        item = legacy_run(run_id="non-anchor-v1")
        _, runs, audit = self.audit_items([item], {})
        summary = self.assert_legacy_blocked(runs, audit)
        cohort = summary["providers"][PROVIDERS[0]]["cohortAudit"]
        self.assertEqual((cohort["trustedLegacyRuns"], cohort["legacyRuns"], cohort["incompatibleRuns"]), (0, 0, 1))

    # Ledger truncation: 17-22
    def prepared_established_ledger(self):
        legacy_financial = legacy_run(PROVIDERS[0], 20, "synthetic-legacy-financial")
        legacy_announcement = legacy_run(PROVIDERS[1], 21, "synthetic-legacy-announcement")
        current = run(PROVIDERS[0], 22)
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        for item in (legacy_financial, legacy_announcement, current):
            materialize_observation(root, item)
        anchors = anchors_for(legacy_financial, legacy_announcement)
        write_observation_ledger(root, [legacy_financial, legacy_announcement, current])
        return root, legacy_financial, legacy_announcement, current, anchors

    def test_missing_one_anchored_legacy_after_double_deletion_blocked(self):
        root, first, second, current, anchors = self.prepared_established_ledger()
        (root / "runs" / f"{first['runId']}.json").unlink()
        write_observation_ledger(root, [second, current])
        runs = load_runs(root)
        audit = audit_observation_ledger(root, runs, anchors)
        self.assertEqual(audit["missingLegacyAnchorRunIds"], [first["runId"]])
        self.assert_legacy_blocked(runs, audit)

    def test_ledger_double_deletion_detected(self):
        root, first, second, current, anchors = self.prepared_established_ledger()
        (root / "runs" / f"{first['runId']}.json").unlink()
        (root / "runs" / f"{second['runId']}.json").unlink()
        write_observation_ledger(root, [current])
        runs = load_runs(root)
        audit = audit_observation_ledger(root, runs, anchors)
        self.assertEqual(set(audit["missingLegacyAnchorRunIds"]), {first["runId"], second["runId"]})
        self.assert_legacy_blocked(runs, audit)

    def test_empty_observation_root_compatible(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            audit = audit_observation_ledger(root, load_runs(root))
        self.assertFalse(audit["evidenceIntegrityFailure"])
        self.assertEqual(audit["missingLegacyAnchorRunIds"], [])

    def test_empty_root_remains_insufficient_observation_window(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runs = load_runs(root)
            audit = audit_observation_ledger(root, runs)
        summary = self.summary(runs, audit)
        self.assertEqual((summary["status"], summary["observationDays"]), ("insufficient_observation_window", 0))

    def test_run_file_without_ledger_blocked(self):
        item = legacy_run(run_id="run-without-ledger")
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        materialize_observation(root, item)
        anchors = anchors_for(item)
        write_observation_ledger(root, [item])
        (root / "provider-health-ledger.jsonl").unlink()
        runs = load_runs(root)
        audit = audit_observation_ledger(root, runs, anchors)
        self.assert_legacy_blocked(runs, audit)

    def test_ledger_without_run_file_blocked(self):
        item = legacy_run(run_id="ledger-without-run")
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        materialize_observation(root, item)
        anchors = anchors_for(item)
        write_observation_ledger(root, [item])
        (root / "runs" / f"{item['runId']}.json").unlink()
        runs = load_runs(root)
        audit = audit_observation_ledger(root, runs, anchors)
        self.assert_legacy_blocked(runs, audit)

    # Historical compatibility: 23-27
    def legacy_artifact_mismatch(self):
        item = legacy_run(run_id="legacy-artifact-mismatch")
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        materialize_observation(root, item)
        anchors = anchors_for(item)
        write_observation_ledger(root, [item])
        generated = root / item["artifacts"]["generatedRoot"]
        (generated / "a-share-financial-summaries.generated.json").write_text('{"tampered":true}\n', encoding="utf-8")
        runs = load_runs(root)
        return runs, audit_observation_ledger(root, runs, anchors)

    def test_anchored_legacy_artifact_manifest_mismatch_remains_legacy_issue(self):
        runs, audit = self.legacy_artifact_mismatch()
        self.assertGreater(audit["legacyValidationIssueCount"], 0)
        self.assertTrue(any(issue["category"] == "artifact_checksum_mismatch" for issue in audit["issues"]))
        self.assertEqual(audit["trustedLegacyRunIds"], [runs[0]["runId"]])

    def test_anchored_legacy_mismatch_not_v2_integrity_failure(self):
        runs, audit = self.legacy_artifact_mismatch()
        summary = self.summary(runs, audit)
        self.assertFalse(audit["v2IntegrityFailure"])
        self.assertFalse(audit["legacyIntegrityFailure"])
        self.assertNotEqual(summary["status"], "blocked")

    def test_anchored_legacy_excluded_from_current_denominator(self):
        item = legacy_run(run_id="legacy-denominator")
        _, runs, _ = self.audit_items([item], {})
        anchors = anchors_for(runs[0])
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        materialize_observation(root, item)
        write_observation_ledger(root, [item])
        audit = audit_observation_ledger(root, load_runs(root), anchors)
        summary = self.summary([item], audit)
        provider = summary["providers"][PROVIDERS[0]]
        self.assertEqual((provider["totalRuns"], provider["cohortAudit"]["trustedLegacyRuns"]), (0, 1))

    def test_anchored_legacy_does_not_change_current_cohort_id(self):
        item = legacy_run(run_id="legacy-cohort")
        root, runs, _ = self.audit_items([item], {})
        anchors = anchors_for(runs[0])
        audit = audit_observation_ledger(root, runs, anchors)
        summary = self.summary(runs, audit)
        self.assertEqual(summary["providers"][PROVIDERS[0]]["cohortAudit"]["currentCohortId"], provenance()["provenanceCohortId"])

    def test_inventory_current_legacy_incompatible_debug_unavailable(self):
        target = provenance()
        current = run(PROVIDERS[0], 0, provenance_value=copy.deepcopy(target))
        incompatible = run(PROVIDERS[0], 1, provenance_value=provenance(providerCodeChecksum="9" * 64))
        debug = run(PROVIDERS[0], 2, eligible=False, provenance_value=copy.deepcopy(target))
        unavailable = unavailable_run(PROVIDERS[0], 3)
        legacy = legacy_run(PROVIDERS[0], 4, "legacy-inventory")
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        items = [current, incompatible, debug, unavailable, legacy]
        for item in items:
            materialize_observation(root, item)
        anchors = anchors_for(legacy)
        write_observation_ledger(root, items)
        runs = load_runs(root)
        audit = audit_observation_ledger(root, runs, anchors)
        summary = evaluate(
            runs,
            config(),
            production(),
            current_provenance={provider: copy.deepcopy(target) for provider in PROVIDERS},
            ledger_audit=audit,
        )
        cohort = summary["providers"][PROVIDERS[0]]["cohortAudit"]
        self.assertEqual(
            (
                cohort["currentEligibleRuns"],
                cohort["trustedLegacyRuns"],
                cohort["incompatibleRuns"],
                cohort["debugRuns"],
                cohort["provenanceUnavailableRuns"],
            ),
            (1, 1, 1, 1, 1),
        )


class ObservationRootStateTests(unittest.TestCase):
    def temporary_root(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        return Path(temporary.name)

    def persist_state(self, root, state):
        write_root_state(root, state, atomic_write, json_bytes)
        return state

    def materialize_items(self, root, items):
        for item in items:
            materialize_observation(root, item)
        write_observation_ledger(root, items)
        return load_runs(root)

    def legacy_candidate(self):
        root = self.temporary_root()
        legacy = legacy_run(PROVIDERS[0], 20, "root-state-legacy")
        current = run(PROVIDERS[1], 22)
        runs = self.materialize_items(root, [legacy, current])
        anchors = anchors_for(legacy)
        audit = audit_observation_ledger(root, runs, anchors)
        self.assertTrue(audit["rootStateMigrationPending"])
        return root, runs, anchors

    def migrate(self):
        root, runs, anchors = self.legacy_candidate()
        state = prepare_root_for_observation(root, runs, audit_observation_ledger(root, runs, anchors), atomic_write, json_bytes)
        return root, runs, anchors, state

    def test_fresh_root_first_observation(self):
        root = self.temporary_root()
        script = ROOT / "scripts/observe-providers.py"
        spec = importlib.util.spec_from_file_location("observe_providers_root_state_test", script)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        observer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(observer)

        def assert_initialized(*_args, **_kwargs):
            state = load_root_state(root)
            self.assertEqual(state["mode"], FRESH_V2)
            self.assertFalse((root / "artifacts").exists())
            self.assertFalse((root / "cache").exists())
            return 0

        options = SimpleNamespace(
            provider="financials",
            observations_dir=root,
            no_cache=False,
            timeout=20,
            run_id=None,
            allow_dirty_debug=False,
        )
        with (
            patch.object(observer, "args", return_value=options),
            patch.object(observer, "DEFAULT_ROOT", root),
            patch.object(observer, "git_status", return_value="?? AGENTS.md\n"),
            patch.object(observer, "observe", side_effect=assert_initialized) as observe_mock,
        ):
            self.assertEqual(observer.main(), 0)
        observe_mock.assert_called_once()

    def test_fresh_v2_does_not_require_legacy_anchors(self):
        root = self.temporary_root()
        self.persist_state(root, build_root_state(FRESH_V2, []))
        item = run()
        runs = self.materialize_items(root, [item])
        audit = audit_observation_ledger(root, runs, {"missing-anchor": {"providerId": PROVIDERS[0]}})
        self.assertFalse(audit["legacyIntegrityFailure"])
        self.assertEqual(audit["missingLegacyAnchorRunIds"], [])

    def test_fresh_first_v2_health_is_normal_no_go(self):
        root = self.temporary_root()
        self.persist_state(root, build_root_state(FRESH_V2, []))
        item = run(PROVIDERS[0], 0)
        runs = self.materialize_items(root, [item])
        audit = audit_observation_ledger(root, runs, {})
        summary = evaluate(
            runs,
            config(),
            production(),
            current_provenance={provider: provenance() for provider in PROVIDERS},
            ledger_audit=audit,
        )
        self.assertEqual(summary["status"], "insufficient_observation_window")
        self.assertNotIn("legacy_integrity_failure", summary["blockingFailures"])

    def test_fresh_financial_and_announcement_runs_are_counted(self):
        root = self.temporary_root()
        self.persist_state(root, build_root_state(FRESH_V2, []))
        items = [run(PROVIDERS[0], 0), run(PROVIDERS[1], 0)]
        runs = self.materialize_items(root, items)
        audit = audit_observation_ledger(root, runs, {})
        summary = evaluate(
            runs,
            config(),
            production(),
            current_provenance={provider: provenance() for provider in PROVIDERS},
            ledger_audit=audit,
        )
        self.assertEqual([summary["providers"][provider]["totalRuns"] for provider in PROVIDERS], [1, 1])

    def test_legacy_root_migration(self):
        root, runs, anchors, state = self.migrate()
        audit = audit_observation_ledger(root, runs, anchors)
        self.assertEqual(state["mode"], LEGACY_V1_MIGRATED)
        self.assertEqual(audit["rootStateMode"], LEGACY_V1_MIGRATED)
        self.assertFalse(audit["evidenceIntegrityFailure"])

    def test_health_read_migration_candidate_does_not_write_state(self):
        root, runs, anchors = self.legacy_candidate()
        audit = audit_observation_ledger(root, runs, anchors)
        self.assertEqual(audit["rootStateMode"], "legacy_v1_migration_pending")
        self.assertFalse(root_state_path(root).exists())

    def test_legacy_observation_migrates_before_provider_call(self):
        root, _, anchors = self.legacy_candidate()
        script = ROOT / "scripts/observe-providers.py"
        spec = importlib.util.spec_from_file_location("observe_providers_legacy_root_state_test", script)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        observer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(observer)

        def audit_with_test_anchors(value_root, value_runs):
            return audit_observation_ledger(value_root, value_runs, anchors)

        def assert_migrated(*_args, **_kwargs):
            state = load_root_state(root)
            self.assertEqual(state["mode"], LEGACY_V1_MIGRATED)
            self.assertEqual(len(state["initialEvidenceRunIds"]), 2)
            return 0

        options = SimpleNamespace(
            provider="financials",
            observations_dir=root,
            no_cache=False,
            timeout=20,
            run_id=None,
            allow_dirty_debug=False,
        )
        with (
            patch.object(observer, "args", return_value=options),
            patch.object(observer, "DEFAULT_ROOT", root),
            patch.object(observer, "git_status", return_value="?? AGENTS.md\n"),
            patch.object(observer, "audit_observation_ledger", side_effect=audit_with_test_anchors),
            patch.object(observer, "observe", side_effect=assert_migrated) as observe_mock,
        ):
            self.assertEqual(observer.main(), 0)
        observe_mock.assert_called_once()

    def test_nonempty_unidentified_root_blocked(self):
        root = self.temporary_root()
        item = run()
        runs = self.materialize_items(root, [item])
        audit = audit_observation_ledger(root, runs, {})
        summary = evaluate(runs, config(), production(), ledger_audit=audit)
        self.assertEqual(audit["rootStateMode"], "unidentified")
        self.assertIn("root_state_integrity_failure", summary["blockingFailures"])

    def test_initial_evidence_deletion_blocked(self):
        root, runs, anchors, _ = self.migrate()
        deleted = runs[-1]["runId"]
        (root / "runs" / f"{deleted}.json").unlink()
        remaining = [item for item in runs if item["runId"] != deleted]
        write_observation_ledger(root, remaining)
        audit = audit_observation_ledger(root, load_runs(root), anchors)
        self.assertEqual(audit["missingInitialEvidenceRunIds"], [deleted])
        self.assertTrue(audit["rootStateIntegrityFailure"])

    def test_empty_root_is_explicit_initialization_candidate(self):
        root = self.temporary_root()
        audit = audit_observation_ledger(root, [])
        self.assertEqual(audit["rootStateMode"], "empty")
        self.assertFalse(audit["evidenceIntegrityFailure"])

    def test_empty_root_initializes_fresh_state_atomically(self):
        root = self.temporary_root()
        audit = audit_observation_ledger(root, [])
        state = prepare_root_for_observation(root, [], audit, atomic_write, json_bytes)
        self.assertEqual(state["mode"], FRESH_V2)
        self.assertEqual(load_root_state(root), state)

    def test_existing_fresh_state_is_idempotent(self):
        root = self.temporary_root()
        expected = self.persist_state(root, build_root_state(FRESH_V2, []))
        audit = audit_observation_ledger(root, [])
        actual = prepare_root_for_observation(root, [], audit, atomic_write, json_bytes)
        self.assertEqual(actual, expected)

    def test_root_state_write_refuses_overwrite(self):
        root = self.temporary_root()
        state = self.persist_state(root, build_root_state(FRESH_V2, []))
        with self.assertRaisesRegex(ValueError, "already exists"):
            write_root_state(root, state, atomic_write, json_bytes)

    def test_root_state_rejects_extra_field(self):
        state = build_root_state(FRESH_V2, [])
        state["path"] = "cache"
        with self.assertRaisesRegex(ValueError, "Additional properties"):
            validate_root_state(state)

    def test_root_state_rejects_invalid_schema_version(self):
        state = build_root_state(FRESH_V2, [])
        state["schemaVersion"] = "2.0.0"
        with self.assertRaises(ValueError):
            validate_root_state(state)

    def test_root_state_rejects_invalid_uuid(self):
        state = build_root_state(FRESH_V2, [])
        state["ledgerId"] = "not-a-uuid"
        with self.assertRaises(ValueError):
            validate_root_state(state)

    def test_root_state_rejects_noncanonical_uuid(self):
        state = build_root_state(FRESH_V2, [])
        state["ledgerId"] = state["ledgerId"].upper()
        with self.assertRaisesRegex(ValueError, "canonical lowercase UUID"):
            validate_root_state(state)

    def test_root_state_rejects_noncanonical_time(self):
        state = build_root_state(FRESH_V2, [])
        state["initializedAt"] = "2026-07-26T20:00:00+08:00"
        with self.assertRaisesRegex(ValueError, "canonical UTC"):
            validate_root_state(state)

    def test_root_state_rejects_unknown_mode(self):
        state = build_root_state(FRESH_V2, [])
        state["mode"] = "unknown"
        with self.assertRaises(ValueError):
            validate_root_state(state)

    def test_root_state_rejects_anchor_checksum_mismatch(self):
        state = build_root_state(FRESH_V2, [])
        state["legacyAnchorConfigChecksum"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "anchor config checksum mismatch"):
            validate_root_state(state)

    def test_root_state_anchor_checksum_is_canonical_config_digest(self):
        state = build_root_state(FRESH_V2, [])
        self.assertEqual(state["legacyAnchorConfigChecksum"], legacy_anchor_config_checksum())

    def test_root_state_rejects_unsorted_initial_ids(self):
        state = build_root_state(LEGACY_V1_MIGRATED, [run(index=2), run(index=0)])
        state["initialEvidenceRunIds"] = list(reversed(state["initialEvidenceRunIds"]))
        with self.assertRaisesRegex(ValueError, "non-unique|sorted and unique"):
            validate_root_state(state)

    def test_root_state_rejects_duplicate_initial_ids(self):
        state = build_root_state(LEGACY_V1_MIGRATED, [run()])
        state["initialEvidenceRunIds"].append(state["initialEvidenceRunIds"][0])
        with self.assertRaisesRegex(ValueError, "non-unique|sorted and unique"):
            validate_root_state(state)

    def test_root_state_rejects_initial_identity_disagreement(self):
        state = build_root_state(LEGACY_V1_MIGRATED, [run()])
        state["initialEvidenceRunIds"] = ["different-run"]
        with self.assertRaisesRegex(ValueError, "identities disagree"):
            validate_root_state(state)

    def test_root_state_rejects_invalid_initial_digest(self):
        state = build_root_state(LEGACY_V1_MIGRATED, [run()])
        state["initialEvidenceRecords"][0]["canonicalRecordSha256"] = "BAD"
        with self.assertRaises(ValueError):
            validate_root_state(state)

    def test_root_state_rejects_initial_checksum_mismatch(self):
        state = build_root_state(LEGACY_V1_MIGRATED, [run()])
        state["initialEvidenceChecksum"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "initial evidence checksum mismatch"):
            validate_root_state(state)

    def test_fresh_mode_rejects_declared_initial_evidence(self):
        state = build_root_state(LEGACY_V1_MIGRATED, [run()])
        state["mode"] = FRESH_V2
        with self.assertRaisesRegex(ValueError, "fresh root state"):
            validate_root_state(state)

    def test_legacy_mode_requires_initial_evidence(self):
        state = build_root_state(FRESH_V2, [])
        state["mode"] = LEGACY_V1_MIGRATED
        with self.assertRaisesRegex(ValueError, "legacy root state requires"):
            validate_root_state(state)

    def test_unreadable_root_state_blocks(self):
        root = self.temporary_root()
        root_state_path(root).write_text("{", encoding="utf-8")
        audit = audit_observation_ledger(root, [])
        self.assertEqual(audit["rootStateMode"], "invalid")
        self.assertTrue(audit["rootStateIntegrityFailure"])

    def test_fresh_root_with_legacy_run_blocks(self):
        root = self.temporary_root()
        self.persist_state(root, build_root_state(FRESH_V2, []))
        item = legacy_run(run_id="legacy-in-fresh-root")
        runs = self.materialize_items(root, [item])
        audit = audit_observation_ledger(root, runs, anchors_for(item))
        self.assertTrue(audit["rootStateIntegrityFailure"])
        self.assertEqual(audit["rootStateIssues"][0]["category"], "fresh_root_contains_legacy_evidence")

    def test_fresh_root_with_legacy_ledger_only_blocks(self):
        root = self.temporary_root()
        self.persist_state(root, build_root_state(FRESH_V2, []))
        item = legacy_run(run_id="legacy-ledger-in-fresh-root")
        write_observation_ledger(root, [item])
        (root / "runs" / f"{item['runId']}.json").unlink()
        audit = audit_observation_ledger(root, [], anchors_for(item))
        self.assertTrue(audit["rootStateIntegrityFailure"])

    def test_initial_evidence_run_modification_blocks(self):
        root, runs, anchors, _ = self.migrate()
        changed = copy.deepcopy(runs[-1])
        changed["durationSeconds"] += 1
        (root / "runs" / f"{changed['runId']}.json").write_bytes(json_bytes(changed))
        audit = audit_observation_ledger(root, load_runs(root), anchors)
        self.assertEqual(audit["modifiedInitialEvidenceRunIds"], [changed["runId"]])

    def test_initial_evidence_ledger_modification_blocks(self):
        root, runs, anchors, _ = self.migrate()
        changed = copy.deepcopy(runs[-1])
        changed["durationSeconds"] += 1
        write_observation_ledger(root, [runs[0], changed])
        audit = audit_observation_ledger(root, load_runs(root), anchors)
        self.assertEqual(audit["modifiedInitialEvidenceRunIds"], [changed["runId"]])

    def test_appended_v2_evidence_does_not_change_initial_digest(self):
        root, runs, anchors, state = self.migrate()
        appended = run(PROVIDERS[0], 30)
        materialize_observation(root, appended)
        append_run(root, appended)
        audit = audit_observation_ledger(root, load_runs(root), anchors)
        self.assertFalse(audit["rootStateIntegrityFailure"])
        self.assertEqual(load_root_state(root)["initialEvidenceChecksum"], state["initialEvidenceChecksum"])

    def test_legacy_migration_captures_all_existing_runs(self):
        _, runs, _, state = self.migrate()
        self.assertEqual(state["initialEvidenceRunIds"], sorted(item["runId"] for item in runs))

    def test_initial_records_are_sorted_and_unique(self):
        records = initial_evidence_records([run(index=4), run(index=0), run(index=2)])
        self.assertEqual([item["runId"] for item in records], sorted(item["runId"] for item in records))
        self.assertEqual(len(records), len({item["runId"] for item in records}))

    def test_initial_digest_binds_full_canonical_object(self):
        item = run()
        before = initial_evidence_records([item])
        item["durationSeconds"] += 1
        after = initial_evidence_records([item])
        self.assertNotEqual(before[0]["canonicalRecordSha256"], after[0]["canonicalRecordSha256"])

    def test_initial_set_checksum_binds_sorted_records(self):
        records = initial_evidence_records([run(index=2), run(index=0)])
        self.assertEqual(initial_evidence_checksum(records), build_root_state(LEGACY_V1_MIGRATED, [run(index=2), run(index=0)])["initialEvidenceChecksum"])

    def test_stateless_v2_only_root_is_not_auto_fresh(self):
        root = self.temporary_root()
        runs = self.materialize_items(root, [run()])
        audit = audit_observation_ledger(root, runs, {})
        self.assertEqual(audit["rootStateMode"], "unidentified")
        self.assertTrue(audit["rootStateIntegrityFailure"])

    def test_residual_summary_root_is_not_auto_fresh(self):
        root = self.temporary_root()
        (root / "provider-health-summary.json").write_text("{}\n", encoding="utf-8")
        audit = audit_observation_ledger(root, [])
        self.assertEqual(audit["rootStateMode"], "unidentified")

    def test_residual_cache_root_is_not_auto_fresh(self):
        root = self.temporary_root()
        (root / "cache").mkdir()
        audit = audit_observation_ledger(root, [])
        self.assertEqual(audit["rootStateMode"], "unidentified")

    def test_prepare_refuses_integrity_failure(self):
        root = self.temporary_root()
        with self.assertRaisesRegex(ValueError, "integrity failure"):
            prepare_root_for_observation(
                root,
                [],
                {"rootStateIntegrityFailure": True, "evidenceIntegrityFailure": True},
                atomic_write,
                json_bytes,
            )

    def test_root_state_has_only_nonsecret_nonpath_fields(self):
        state = build_root_state(FRESH_V2, [])
        self.assertEqual(
            set(state),
            {
                "schemaVersion",
                "ledgerId",
                "mode",
                "initializedAt",
                "legacyAnchorConfigChecksum",
                "initialEvidenceRunIds",
                "initialEvidenceRecords",
                "initialEvidenceChecksum",
            },
        )
        self.assertFalse(contains_sensitive(state))

    def test_observation_tool_checksum_tracks_static_root_contract_only(self):
        source = (ROOT / "scripts/provider_observability/provenance.py").read_text(encoding="utf-8")
        self.assertIn('"scripts/provider_observability/root_state.py"', source)
        self.assertIn('"config/provider-observation-root.schema.json"', source)
        self.assertNotIn('".provider-observations/provider-observation-root.json"', source)

    def test_root_state_failure_blocks_gate(self):
        summary = evaluate(
            [],
            config(),
            production(),
            ledger_audit={
                "rootStateIntegrityFailure": True,
                "v2IntegrityFailure": False,
                "legacyIntegrityFailure": False,
            },
        )
        self.assertEqual(summary["status"], "blocked")
        self.assertIn("root_state_integrity_failure", summary["blockingFailures"])


class ReadTimeResolutionIntegrityTests(unittest.TestCase):
    def source(self):
        return run(failures=[failure("schema_drift")])

    def resolution(self, source, **updates):
        value = make_resolution(PROVIDERS[0], source["runId"], 0, "schema_drift", "verified", "official evidence", "tester")
        value.update(updates)
        return value

    def assert_forged_blocked(self, source, resolution, runs=None, ledger_audit=None):
        summary = evaluate(
            runs or [source],
            config(),
            production(),
            [resolution],
            ledger_audit=ledger_audit,
        )
        self.assertEqual(summary["status"], "blocked")
        self.assertIn(resolution.get("resolutionId", ""), summary["resolutionAudit"]["rejectedResolutionIds"])
        source_rows = [row for row in summary["historicalFailures"] if row["runId"] == source["runId"]]
        if source_rows:
            self.assertFalse(source_rows[0]["effectiveResolved"])
        return summary

    def test_forged_resolution_read_path_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, providerId=PROVIDERS[1]))

    def test_forged_resolution_category_mismatch_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, category="timeout"))

    def test_forged_resolution_failure_index_out_of_range_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, failureIndex=1))

    def test_forged_resolution_boolean_failure_index_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, failureIndex=True))

    def test_forged_resolution_reason_missing_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, reason=""))

    def test_forged_resolution_evidence_missing_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, evidence=""))

    def test_forged_resolution_resolved_by_missing_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, resolvedBy=""))

    def test_forged_resolution_schema_version_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, schemaVersion="1.0.0"))

    def test_forged_resolution_naive_time_blocked(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, resolvedAt="2026-07-23T12:00:00"))

    def test_duplicate_resolution_id_blocks(self):
        source = self.source()
        resolution = self.resolution(source)
        summary = evaluate([source], config(), production(), [resolution, copy.deepcopy(resolution)])
        self.assertEqual(summary["status"], "blocked")
        self.assertIn("resolution_integrity_failure", summary["blockingFailures"])

    def test_conflicting_resolutions_for_one_failure_block(self):
        source = self.source()
        first = self.resolution(source)
        second = self.resolution(source)
        summary = evaluate([source], config(), production(), [first, second])
        self.assertEqual(summary["status"], "blocked")
        self.assertTrue(any(issue["category"] == "resolution_conflict" for issue in summary["resolutionAudit"]["issues"]))

    def test_sensitive_resolution_blocks(self):
        source = self.source()
        self.assert_forged_blocked(source, self.resolution(source, evidence="https://example.test/?token=raw"))

    def test_non_object_resolution_blocks(self):
        source = self.source()
        audit = audit_resolution_ledger([["forged"]], [source])
        self.assertTrue(audit["integrityFailure"])

    def test_cross_provider_replacement_blocked_at_read_time(self):
        source = self.source()
        replacement = run(PROVIDERS[1], 1)
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        self.assert_forged_blocked(source, resolution, [source, replacement])

    def test_cross_cohort_replacement_blocked_at_read_time(self):
        source = self.source()
        replacement = run(PROVIDERS[0], 1, provenance_value=provenance(providerCodeChecksum="9" * 64))
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        self.assert_forged_blocked(source, resolution, [source, replacement])

    def test_legacy_replacement_blocked_at_read_time(self):
        source = self.source()
        replacement = run(PROVIDERS[0], 1)
        replacement["schemaVersion"] = "1.0.0"
        replacement.pop("provenance")
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        self.assert_forged_blocked(source, resolution, [source, replacement])

    def test_debug_replacement_blocked_at_read_time(self):
        source = self.source()
        replacement = run(PROVIDERS[0], 1, eligible=False)
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        self.assert_forged_blocked(source, resolution, [source, replacement])

    def test_earlier_replacement_blocked_at_read_time(self):
        source = run(PROVIDERS[0], 2, failures=[failure("schema_drift")])
        replacement = run(PROVIDERS[0], 1)
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        self.assert_forged_blocked(source, resolution, [source, replacement])

    def test_failed_replacement_blocked_at_read_time(self):
        source = self.source()
        replacement = run(PROVIDERS[0], 1, status="failed")
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        self.assert_forged_blocked(source, resolution, [source, replacement])

    def test_invalid_replacement_ledger_evidence_blocked(self):
        source = self.source()
        replacement = run(PROVIDERS[0], 1)
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        ledger_audit = {
            "invalidRunIds": [replacement["runId"]],
            "invalidV2RunIds": [replacement["runId"]],
            "v2IntegrityFailure": True,
        }
        self.assert_forged_blocked(source, resolution, [source, replacement], ledger_audit)

    def test_valid_replacement_resolution_behavior_preserved(self):
        source = self.source()
        replacement = run(PROVIDERS[0], 1)
        resolution = self.resolution(source, replacementRunId=replacement["runId"])
        summary = evaluate([source, replacement], config(), production(), [resolution])
        self.assertNotEqual(summary["status"], "blocked")
        self.assertEqual(summary["resolutionAudit"]["compatibleCount"], 1)
        self.assertTrue(next(row for row in summary["historicalFailures"] if row["runId"] == source["runId"])["effectiveResolved"])


class ExactAgentsWorktreeTests(unittest.TestCase):
    def test_exact_untracked_root_agents_allowed(self):
        self.assertTrue(observation_eligibility("?? AGENTS.md\n", False))

    def test_tracked_agents_rejected(self):
        with self.assertRaises(DirtyWorktreeError):
            observation_eligibility(" M AGENTS.md\n", False)

    def test_staged_agents_rejected(self):
        with self.assertRaises(DirtyWorktreeError):
            observation_eligibility("M  AGENTS.md\n", False)

    def test_nested_agents_rejected(self):
        with self.assertRaises(DirtyWorktreeError):
            observation_eligibility("?? subdir/AGENTS.md\n", False)

    def test_other_untracked_file_rejected(self):
        with self.assertRaises(DirtyWorktreeError):
            observation_eligibility("?? other.txt\n", False)

    def test_allow_dirty_debug_still_ineligible(self):
        self.assertFalse(observation_eligibility(" M AGENTS.md\n", True))


class ContractTests(unittest.TestCase):
    def test_87_observation_ignored(self): self.assertIn(".provider-observations/", (ROOT / ".gitignore").read_text(encoding="utf-8"))
    def test_88_default_refresh_unchanged(self): self.assertTrue(validate_default_refresh(ROOT)["passed"])
    def test_89_resolution_command_present(self): self.assertIn("--resolve", (ROOT / "scripts/provider-health.py").read_text(encoding="utf-8"))
    def test_90_ci_offline(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"); self.assertIn("test:provider-observability", workflow); self.assertNotIn("data:observe:providers", workflow)


if __name__ == "__main__": unittest.main()
