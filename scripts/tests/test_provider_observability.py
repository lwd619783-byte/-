from __future__ import annotations

import copy
import json
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from provider_observability import SCHEMA_VERSION
from provider_observability.core import (
    BLOCKING_FAILURES, DirtyWorktreeError, announcement_diff, append_resolution, append_run, atomic_write,
    classify_failure, contains_sensitive, dirty_paths, evaluate, file_digest, financial_diff, json_bytes,
    load_resolutions, load_runs, make_resolution, observation_eligibility, percentile, redact,
    stable, summarize_provider, tree_digest, validate_config, validate_run,
)
from provider_observability.production import (
    validate_announcement_production, validate_default_refresh, validate_financial_production, validate_production,
)

PROVIDERS = ["a-share-financials", "a-share-announcements"]
HASH = "0" * 64


def config(**updates):
    value = {"schemaVersion": SCHEMA_VERSION, "timezone": "Asia/Shanghai", "minimumDistinctDays": 5, "minimumRunsPerProvider": 10, "minimumSuccessfulDaysPerProvider": 5, "minimumCompleteSuccessRate": .9, "minimumTotalSuccessRate": .95, "expectedCompanies": 56, "requireLatestSuccess": True, "providers": PROVIDERS}
    value.update(updates); return value


def production(passed=True, financial=True, announcements=True, audit=True, refresh=True, p0=0, errors=0):
    return {"passed": passed and financial and announcements and audit and refresh, "financials": {"passed": financial, "errorCount": int(not financial), "errors": [] if financial else ["bad financial"]}, "announcements": {"passed": announcements, "errorCount": int(not announcements), "errors": [] if announcements else ["bad announcement"]}, "dataAudit": {"passed": audit, "exitCode": int(not audit), "p0": p0, "errors": errors}, "defaultRefresh": {"passed": refresh, "unqualifiedProvidersIncluded": [] if refresh else ["data:fetch:financials:a"]}}


def failure(category, message="failure"):
    return {"category": category, "message": message, "resolved": False}


def run(provider="a-share-financials", index=0, status="success", failures=None, coverage=56, rate=1, eligible=True, same_day=False):
    start = datetime(2026, 7, 1, tzinfo=timezone.utc) + timedelta(days=0 if same_day else index // 2, minutes=index)
    domain = "financials" if provider == "a-share-financials" else "announcements"
    return {"schemaVersion": SCHEMA_VERSION, "runId": f"run-{provider}-{index}", "providerId": provider, "providerVersion": "v1", "domain": domain, "startedAt": start.isoformat().replace("+00:00", "Z"), "endedAt": (start + timedelta(seconds=2)).isoformat().replace("+00:00", "Z"), "timezone": "Asia/Shanghai", "durationSeconds": 2 + index, "platform": "test", "pythonVersion": "3.13", "nodeVersion": "v22", "command": ["python", "fixture"], "status": status, "exitCode": 0 if status != "failed" else 1, "metrics": {"companyCoverage": coverage, "expectedCompanies": 56, "structuralValidationRate": rate, "eligibleSample": eligible, "cacheMode": "isolated", "retryCount": None, "timeoutCount": 0, "rateLimitCount": 0, "httpStatusCounts": {}, "success": coverage, "partial": 0, "error": 0, "detailFiles": coverage, "manifestChecksum": HASH, "artifactChecksum": HASH}, "difference": {"baseline": True}, "failures": failures or [], "validation": {"passed": rate == 1}, "atomicity": {"productionUnchanged": True, "beforeChecksum": HASH, "afterChecksum": HASH}, "worktree": {"unchanged": True}, "messages": [], "artifacts": {"generatedRoot": f"artifacts/run-{provider}-{index}/generated"}}


def ann(announcement_id, date_value, **updates):
    value = {"announcementId": announcement_id, "announcementDate": date_value, "title": "t", "category": "other", "officialUrl": "https://www.cninfo.com.cn/x", "pdfUrl": "https://static.cninfo.com.cn/x.pdf"}
    value.update(updates); return value


def details(*items): return {"stock": {"announcements": list(items)}}


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


class WorktreeTests(unittest.TestCase):
    def test_77_dirty_paths_only_names(self): self.assertEqual(dirty_paths(" M file.py\n?? new.txt\n"), ["file.py", "new.txt"])
    def test_78_dirty_rejected(self):
        with self.assertRaises(DirtyWorktreeError): observation_eligibility(" M file.py\n", False)
    def test_79_clean_eligible(self): self.assertTrue(observation_eligibility("", False))
    def test_80_dirty_debug_ineligible(self): self.assertFalse(observation_eligibility(" M file.py\n", True))
    def test_81_preflight_before_observe_contract(self):
        source = (ROOT / "scripts/observe-providers.py").read_text(encoding="utf-8"); self.assertLess(source.index("observation_eligibility(git_status()"), source.index("codes = [observe"))


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


class ContractTests(unittest.TestCase):
    def test_87_observation_ignored(self): self.assertIn(".provider-observations/", (ROOT / ".gitignore").read_text(encoding="utf-8"))
    def test_88_default_refresh_unchanged(self): self.assertTrue(validate_default_refresh(ROOT)["passed"])
    def test_89_resolution_command_present(self): self.assertIn("--resolve", (ROOT / "scripts/provider-health.py").read_text(encoding="utf-8"))
    def test_90_ci_offline(self):
        workflow = (ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"); self.assertIn("test:provider-observability", workflow); self.assertNotIn("data:observe:providers", workflow)


if __name__ == "__main__": unittest.main()
