from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from provider_observability import SCHEMA_VERSION
from provider_observability.core import (
    announcement_diff, append_run, atomic_write, classify_failure, contains_sensitive, evaluate,
    financial_diff, json_bytes, load_runs, percentile, redact, stable, summarize_provider,
    tree_digest, validate_config, validate_run,
)

PROVIDERS = ["a-share-financials", "a-share-announcements"]


def config(**updates):
    value = {"schemaVersion": SCHEMA_VERSION, "timezone": "Asia/Shanghai", "minimumDistinctDays": 5, "minimumRunsPerProvider": 10, "minimumSuccessfulDaysPerProvider": 5, "minimumCompleteSuccessRate": .9, "minimumTotalSuccessRate": .95, "expectedCompanies": 56, "requireLatestSuccess": True, "providers": PROVIDERS}
    value.update(updates); return value


def run(provider="a-share-financials", index=0, status="success", failures=None, coverage=56, rate=1):
    start = datetime(2026, 7, 1, tzinfo=timezone.utc) + timedelta(days=index // 2, minutes=index)
    return {"schemaVersion": SCHEMA_VERSION, "runId": f"run-{provider}-{index}", "providerId": provider, "providerVersion": "v1", "domain": provider, "startedAt": start.isoformat().replace("+00:00", "Z"), "endedAt": (start + timedelta(seconds=2)).isoformat().replace("+00:00", "Z"), "timezone": "Asia/Shanghai", "durationSeconds": 2 + index, "status": status, "exitCode": 0 if status == "success" else 1, "metrics": {"companyCoverage": coverage, "expectedCompanies": 56, "structuralValidationRate": rate}, "failures": failures or []}


class LedgerTests(unittest.TestCase):
    def test_01_valid_run(self): validate_run(run())
    def test_02_missing_field(self):
        value = run(); value.pop("runId")
        with self.assertRaises(ValueError): validate_run(value)
    def test_03_bad_schema(self):
        value = run(); value["schemaVersion"] = "2"
        with self.assertRaises(ValueError): validate_run(value)
    def test_04_bad_status(self):
        value = run(); value["status"] = "ok"
        with self.assertRaises(ValueError): validate_run(value)
    def test_05_unsafe_id(self):
        value = run(); value["runId"] = "../bad"
        with self.assertRaises(ValueError): validate_run(value)
    def test_06_append_and_load(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); append_run(root, run()); self.assertEqual(len(load_runs(root)), 1)
    def test_07_duplicate_run_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); append_run(root, run())
            with self.assertRaises(ValueError): append_run(root, run())
    def test_08_ledger_lf(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); append_run(root, run()); payload = (root / "provider-health-ledger.jsonl").read_bytes(); self.assertNotIn(b"\r\n", payload)
    def test_09_atomic_replaces(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x"; atomic_write(path, b"a"); atomic_write(path, b"b"); self.assertEqual(path.read_bytes(), b"b")
    def test_10_json_rejects_nan(self):
        with self.assertRaises(ValueError): json_bytes({"x": float("nan")})
    def test_11_tree_digest_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x"; path.write_text("a"); one = tree_digest([path]); path.write_text("b"); self.assertNotEqual(one, tree_digest([path]))


class RedactionTests(unittest.TestCase):
    def test_12_redacts_token_key(self): self.assertEqual(redact({"token": "abc"})["token"], "[REDACTED]")
    def test_13_redacts_cookie_key(self): self.assertEqual(redact({"Cookie": "abc"})["Cookie"], "[REDACTED]")
    def test_14_redacts_bearer(self): self.assertIn("[REDACTED]", redact("Bearer abc.def"))
    def test_15_redacts_query(self): self.assertIn("token=[REDACTED]", redact("https://x?token=abc"))
    def test_16_detects_secret(self): self.assertTrue(contains_sensitive({"session": "raw"}))
    def test_17_allows_redacted(self): self.assertFalse(contains_sensitive({"session": "[REDACTED]"}))
    def test_18_validate_rejects_secret(self):
        value = run(); value["authorization"] = "secret"
        with self.assertRaises(ValueError): validate_run(value)


class FailureTests(unittest.TestCase):
    def test_19_timeout(self): self.assertEqual(classify_failure("Read timed out"), "timeout")
    def test_20_rate_limit(self): self.assertEqual(classify_failure("rate limited", 429), "rate_limited")
    def test_21_auth(self): self.assertEqual(classify_failure("Unauthorized", 401), "authentication_unexpected")
    def test_22_schema(self): self.assertEqual(classify_failure("schema changed"), "schema_drift")
    def test_23_empty(self): self.assertEqual(classify_failure("empty response"), "empty_response")
    def test_24_network(self): self.assertEqual(classify_failure("connection reset"), "network_transient")
    def test_25_provider_unavailable(self): self.assertEqual(classify_failure("bad gateway", 503), "provider_unavailable")
    def test_26_unknown(self): self.assertEqual(classify_failure("odd"), "unknown")


class DifferenceTests(unittest.TestCase):
    def test_27_financial_baseline(self): self.assertTrue(financial_diff({"items": {}}, None)["baseline"])
    def test_28_financial_ignores_timestamps(self):
        before = {"items": {"x": {"generatedAt": "a", "latestReportPeriod": "2025"}}}; after = {"items": {"x": {"generatedAt": "b", "latestReportPeriod": "2025"}}}
        self.assertEqual(financial_diff(after, before)["changedCompanies"], 0)
    def test_29_financial_detects_removal(self): self.assertEqual(financial_diff({"items": {}}, {"items": {"x": {}}})["removedCompanies"], ["x"])
    def test_30_financial_value_drift(self):
        before = {"items": {"x": {"latestReportPeriod": "2025", "latestSingleQuarter": {"a": 1}}}}; after = {"items": {"x": {"latestReportPeriod": "2025", "latestSingleQuarter": {"a": 2}}}}
        self.assertEqual(len(financial_diff(after, before)["valueDrifts"]), 1)
    def test_31_announcement_baseline(self): self.assertTrue(announcement_diff({}, None)["baseline"])
    def test_32_announcement_addition_normal(self): self.assertEqual(announcement_diff({"x": {"announcements": [{"announcementId": "2"}]}}, {"x": {"announcements": [{"announcementId": "1"}]}})["added"], 1)
    def test_33_announcement_removal(self): self.assertEqual(announcement_diff({}, {"x": {"announcements": [{"announcementId": "1"}]}})["removedIds"], ["1"])
    def test_34_stable_recursive(self): self.assertEqual(stable({"x": [{"fetchedAt": "a", "v": 1}]}), {"x": [{"v": 1}]})


class StatisticsTests(unittest.TestCase):
    def test_35_p50(self): self.assertEqual(percentile([1, 2, 3], .5), 2)
    def test_36_p95(self): self.assertEqual(percentile([1, 2, 3, 4], .95), 4)
    def test_37_empty_percentile(self): self.assertIsNone(percentile([], .5))
    def test_38_success_streak(self): self.assertEqual(summarize_provider([run(index=0), run(index=1), run(index=2, status="failed")], "Asia/Shanghai")["successStreak"], 0)
    def test_39_distinct_days_timezone(self): self.assertGreaterEqual(summarize_provider([run(index=0), run(index=2)], "Asia/Shanghai")["distinctDays"], 2)
    def test_40_failure_counts(self):
        item = run(failures=[{"category": "timeout", "resolved": True}]); self.assertEqual(summarize_provider([item], "Asia/Shanghai")["failureCounts"]["timeout"], 1)


class EligibilityTests(unittest.TestCase):
    def test_41_first_day_insufficient(self): self.assertEqual(evaluate([run(PROVIDERS[0]), run(PROVIDERS[1])], config())["status"], "insufficient_observation_window")
    def test_42_empty_insufficient(self): self.assertEqual(evaluate([], config())["exitCode"], 2)
    def test_43_qualified(self):
        runs = [run(provider, index) for provider in PROVIDERS for index in range(10)]
        self.assertEqual(evaluate(runs, config())["status"], "qualified")
    def test_44_latest_failure_disqualified(self):
        runs = [run(provider, index) for provider in PROVIDERS for index in range(10)]; runs[-1]["status"] = "failed"
        self.assertEqual(evaluate(runs, config())["status"], "disqualified")
    def test_45_blocking_schema_drift(self):
        failure = {"category": "schema_drift", "message": "x", "resolved": False}; self.assertEqual(evaluate([run(failures=[failure])], config())["status"], "blocked")
    def test_46_resolved_schema_not_blocking(self):
        failure = {"category": "schema_drift", "message": "x", "resolved": True}; self.assertEqual(evaluate([run(failures=[failure])], config())["status"], "insufficient_observation_window")
    def test_47_production_invalid_blocked(self): self.assertEqual(evaluate([], config(), production_valid=False)["status"], "blocked")
    def test_48_audit_error_blocked(self): self.assertEqual(evaluate([], config(), audit_errors=1)["status"], "blocked")
    def test_49_coverage_not_complete(self):
        runs = [run(provider, index, coverage=55) for provider in PROVIDERS for index in range(10)]; self.assertNotEqual(evaluate(runs, config())["status"], "qualified")
    def test_50_config_bad_timezone(self):
        with self.assertRaises(Exception): validate_config(config(timezone="Mars/Olympus"))
    def test_51_config_duplicate_provider(self):
        with self.assertRaises(ValueError): validate_config(config(providers=["x", "x"]))
    def test_52_config_bad_rate(self):
        with self.assertRaises(ValueError): validate_config(config(minimumTotalSuccessRate=2))
    def test_53_config_bad_days(self):
        with self.assertRaises(ValueError): validate_config(config(minimumDistinctDays=0))
    def test_54_two_days_observing(self):
        runs = [run(provider, index) for provider in PROVIDERS for index in (0, 2)]
        self.assertEqual(evaluate(runs, config())["status"], "observing")
    def test_55_provider_unavailable(self):
        failure = {"category": "provider_unavailable", "message": "503", "resolved": False}
        runs = [run(PROVIDERS[0]), run(PROVIDERS[1], status="failed", failures=[failure])]
        self.assertEqual(evaluate(runs, config())["status"], "provider_unavailable")


class IsolationContractTests(unittest.TestCase):
    def test_56_observation_dir_ignored(self): self.assertIn(".provider-observations/", (ROOT / ".gitignore").read_text(encoding="utf-8"))
    def test_57_financial_output_override(self): self.assertIn("--output-root", (ROOT / "scripts/fetch-a-share-financials.py").read_text(encoding="utf-8"))
    def test_58_announcement_output_override(self): self.assertIn("--output-root", (ROOT / "scripts/fetch-a-share-announcements.py").read_text(encoding="utf-8"))
    def test_59_default_refresh_unchanged(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8")); self.assertNotIn("financials:a", package["scripts"]["data:refresh"]); self.assertNotIn("announcements:a", package["scripts"]["data:refresh"])
    def test_60_gitattributes_narrow(self): self.assertNotIn("*.json -text", (ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines())
    def test_61_production_output_guard_financial(self): self.assertIn("must not target production", (ROOT / "scripts/fetch-a-share-financials.py").read_text(encoding="utf-8"))
    def test_62_production_output_guard_announcements(self): self.assertIn("must not target production", (ROOT / "scripts/fetch-a-share-announcements.py").read_text(encoding="utf-8"))


if __name__ == "__main__": unittest.main()
