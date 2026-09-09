"""C2A2 negative source admission + unchanged R2-A synthetic positive lineage.

Synthetic R2-A events test the contract, never count as the 26 real CSRC months.
"""
from copy import deepcopy
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from scripts.market_regime import csrc_ipo_provenance as p
from scripts.market_regime.csrc_ipo_admission import load
from scripts.market_regime.historical import dataset_content_projection
from scripts.market_regime.hashing import canonical_sha256
from scripts.market_regime.historical_validator import select_vintage
from scripts.tests.test_market_regime_historical import FixtureCase

ROOT = Path(__file__).resolve().parents[2]


class ProvenanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _, cls.rows = p.frozen(ROOT)
        cls.evidence = load(ROOT, p.OUT)
        cls.review = load(ROOT, p.REVIEW)

    def test_compact_offline_reconstructs_reviewed_result(self):
        with patch("requests.Session.request", side_effect=AssertionError("OFFLINE")):
            self.assertEqual(p.validate_compact(ROOT), self.evidence)

    def test_all_26_months_remain_in_denominator(self):
        self.assertEqual(len(p.PERIODS), 26)
        self.assertEqual(self.evidence["candidatePeriods"], p.PERIODS)
        self.assertEqual([r["reportPeriod"] for r in self.evidence["admissionMatrix"]], p.PERIODS)
        self.assertEqual(self.evidence["summary"]["targetCount"], 260)

    def test_current_bytes_and_old_landing_date_never_first_release(self):
        for row in self.rows:
            with self.subTest(period=row["reportPeriod"]):
                self.assertLess(row["publicationEvidence"]["date"], "2013")
                self.assertGreater(row["attachment"]["acquiredAt"], "2026")
                decision = p.decision(row, [])
                self.assertIsNone(decision["releaseAvailableAt"])
                self.assertFalse(decision["firstReleaseProven"])
                self.assertFalse(decision["eligible"])

    def test_cms_version_path_is_discovery_only(self):
        plan = p.request_plan(ROOT)
        versions = [r for r in plan if r["role"] == "RESOURCE" and "_1.0" in r["url"]]
        self.assertEqual(len(versions), 26)
        self.assertTrue(all(r["basis"]["kind"] == "C1_RESOURCE_DISCOVERY_ONLY" for r in versions))
        for row in self.evidence["admissionMatrix"]:
            self.assertIsNone(row["historicalAttachmentVersion"])
            self.assertIsNone(row["releaseArtifactBinding"])

    def test_injected_first_revision_backcast_flags_do_not_admit(self):
        for kind in ("FIRST_RELEASE", "REVISION", "BACKCAST"):
            row = deepcopy(self.rows[0])
            row.update(releaseKind=kind, firstReleaseProven=True,
                       historicalAttachmentVersionProven=True, releaseAvailableAt="2010-07-30T00:00:00+08:00")
            result = p.decision(row, [])
            self.assertEqual(result["releaseKind"], "UNRESOLVED")
            self.assertFalse(result["eligible"])
            with self.assertRaises(TypeError):
                p.decision(row, [], releaseKind=kind)

    def test_last_modified_and_acquisition_cannot_supply_release_clock(self):
        row = deepcopy(self.rows[0])
        row["attachment"]["lastModified"] = "2010-07-29T00:00:00Z"
        row["attachment"]["acquiredAt"] = "2010-07-29T00:00:00Z"
        self.assertIsNone(p.decision(row, [])["releaseAvailableAt"])

    def changed_acquisitions(self):
        a = deepcopy(self.rows[0]["attachment"]["acquisitionEvidence"])
        a["storedBytes"]["sha256"] = "e" * 64
        a["attemptedAt"] = "2026-09-09T00:00:00Z"
        return [dict(request=dict(role="ATTACHMENT"), acquisition=a)]

    def test_same_url_changed_bytes_without_event_conflicts(self):
        result = p.decision(self.rows[0], self.changed_acquisitions())
        self.assertEqual(result["status"], "UNRESOLVED_RELEASE_CONFLICT")
        self.assertFalse(result["eligible"])
        self.assertEqual(len(result["conflicts"][0]["sha256s"]), 2)

    def test_acquisition_order_never_resolves_truth(self):
        found = self.changed_acquisitions()
        found.append(dict(request=dict(role="ATTACHMENT"), acquisition=self.rows[0]["attachment"]["acquisitionEvidence"]))
        self.assertEqual(p.decision(self.rows[0], found), p.decision(self.rows[0], found[::-1]))

    def test_each_month_has_its_own_review_and_requests(self):
        for row in self.review["periodReviews"]:
            period = row["reportPeriod"]
            findings = [f for f in self.evidence["investigation"]["findings"] if f["request"]["reportPeriod"] == period]
            self.assertTrue(findings)
            self.assertEqual(row["findingsSha256"], p.digest(findings))
            self.assertEqual({f["request"]["role"] for f in findings}, {"LANDING", "ATTACHMENT", "RESOURCE", "SEARCH"})

    def test_generated_at_excluded_fixed_input_deterministic(self):
        a = p.assemble(ROOT, self.evidence["investigation"], self.review, "2026-09-09T00:00:00Z")
        b = p.assemble(ROOT, self.evidence["investigation"], self.review, "2026-09-09T01:00:00Z")
        self.assertEqual(a["contentSha256"], b["contentSha256"])
        self.assertEqual(a, p.assemble(ROOT, self.evidence["investigation"], self.review, a["generatedAt"]))

    def test_any_provenance_binding_release_extraction_changes_business_hash(self):
        for collection in ("releaseEvents", "artifactBindings", "fieldExtractions"):
            changed = deepcopy(self.evidence)
            changed["r2a"][collection].append({"SYNTHETIC_MUTATION": True})
            self.assertNotEqual(p.content_hash(changed), self.evidence["contentSha256"])
        for key in ("releaseAvailableAt", "historicalAttachmentVersion", "releaseArtifactBinding", "extractionEvidenceSha256"):
            changed = deepcopy(self.evidence)
            changed["admissionMatrix"][0][key] = "SYNTHETIC_MUTATION"
            self.assertNotEqual(p.content_hash(changed), self.evidence["contentSha256"])
        changed = deepcopy(self.evidence)
        changed["investigation"]["retrievalJournal"][0]["attemptedAt"] = "2026-09-10T00:00:00Z"
        self.assertNotEqual(p.content_hash(changed), self.evidence["contentSha256"])

    def test_forged_review_cannot_replace_official_evidence(self):
        review = deepcopy(self.review)
        review["reviewedHistoricalReleaseProofs"] = [{"period": p.PERIODS[0], "releaseKind": "FIRST_RELEASE"}]
        with self.assertRaisesRegex(ValueError, "UNREVIEWED"):
            p.assemble(ROOT, self.evidence["investigation"], review, self.evidence["generatedAt"])

    def test_new_bytes_need_new_review_not_silent_readmission(self):
        investigation = deepcopy(self.evidence["investigation"])
        investigation["findings"][0]["acquisition"]["storedBytes"]["sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "SNAPSHOT_MISMATCH"):
            p.assemble(ROOT, investigation, self.review, self.evidence["generatedAt"])

    def test_removed_month_cannot_reduce_denominator(self):
        changed = deepcopy(self.evidence)
        changed["admissionMatrix"].pop()
        with self.assertRaisesRegex(ValueError, "DENOMINATOR"):
            p.validate_correspondence(changed)

    def test_duplicate_month_rejected(self):
        changed = deepcopy(self.evidence)
        changed["admissionMatrix"][-1] = changed["admissionMatrix"][0]
        with self.assertRaisesRegex(ValueError, "DENOMINATOR"):
            p.validate_correspondence(changed)

    def test_formal_observation_outside_eligible_rejected(self):
        changed = deepcopy(self.evidence)
        changed["formalObservations"] = [dict(valueDate=p.PERIODS[0], metricId="SUPPLY_IPO_FINANCING", observationId="forged")]
        with self.assertRaisesRegex(ValueError, "ONE_TO_ONE"):
            p.validate_correspondence(changed)

    def test_eligible_period_without_observation_rejected(self):
        changed = deepcopy(self.evidence)
        changed["eligiblePeriods"] = [p.PERIODS[0]]
        changed["admissionMatrix"][0]["eligible"] = True
        with self.assertRaisesRegex(ValueError, "ONE_TO_ONE"):
            p.validate_correspondence(changed)

    def test_duplicate_formal_observations_rejected(self):
        changed = deepcopy(self.evidence)
        changed["eligiblePeriods"] = [p.PERIODS[0]]
        changed["admissionMatrix"][0]["eligible"] = True
        changed["formalObservations"] = [dict(valueDate=p.PERIODS[0])] * 2
        with self.assertRaisesRegex(ValueError, "ONE_TO_ONE"):
            p.validate_correspondence(changed)

    def test_arbitrary_output_flags_rejected_even_with_recomputed_hash(self):
        changed = deepcopy(self.evidence)
        changed["admissionMatrix"][0]["firstReleaseProven"] = True
        changed["contentSha256"] = p.content_hash(changed)
        original = p.c2a1.load
        def fake_load(repo, path):
            return changed if path == p.OUT else original(repo, path)
        with patch.object(p.c2a1, "load", side_effect=fake_load):
            with self.assertRaisesRegex(ValueError, "COMPACT_EVIDENCE_MISMATCH"):
                p.validate_compact(ROOT)

    def test_compact_does_not_open_ignored_source_raw(self):
        with patch.object(p.Collector, "bytes", side_effect=AssertionError("NO_RAW_IN_COMPACT")):
            self.assertEqual(p.validate_compact(ROOT), self.evidence)

    def test_raw_free_export_validates_compact_but_cannot_full_replay(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            for name in (p.OUT, p.REVIEW, p.c2a1.OUT, p.c2a1.CONFIG, p.c2a1.BASE,
                         p.c2a1.RECOVERY, "config/market-regime/csrc-recovery-plan.v1.json",
                         "config/market-regime/csrc-inventory-plan.v1.json"):
                path = target / name
                path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, path)
            self.assertFalse((target / "research-data/market-regime/raw").exists())
            self.assertEqual(p.validate_compact(target), self.evidence)
            with self.assertRaisesRegex(FileNotFoundError, "inventory-source.json"):
                p.build(target, self.evidence["generatedAt"])

    def test_sealed_fetch_refuses_before_network(self):
        with patch("sys.argv", ["c2a2", "fetch", "--repo-root", str(ROOT)]):
            with patch("requests.Session.request", side_effect=AssertionError("NO_NETWORK")):
                with self.assertRaisesRegex(ValueError, "SEALED_OUTPUT"):
                    p.main()


class R2AContractTests(FixtureCase):
    """Existing R2-A synthetic evidence graph; never a real CSRC admission."""
    def test_revision_cutoff_selects_predecessor_then_revision(self):
        dataset = self.build()
        def at(clock):
            return select_vintage(dataset, self.catalog, plans=self.plans, artifact_root=self.root,
                cell_id=self.row("2026-01")["cellId"], cutoff="2026-09-07T" + clock + "+08:00")
        self.assertEqual(at("07:59:59")["observationId"], "jan-v0")
        self.assertEqual(at("08:00:00")["observationId"], "jan-v1")

    def test_backcast_only_visible_at_actual_later_release(self):
        dataset = self.build()
        def at(cutoff):
            return select_vintage(dataset, self.catalog, plans=self.plans, artifact_root=self.root,
                cell_id=self.row("2026-02")["cellId"], cutoff=cutoff)
        self.assertIsNone(at("2026-09-06T23:59:59+08:00"))
        self.assertEqual(at("2026-09-07T00:00:00+08:00")["observationId"], "feb-backcast")

    def test_missing_revision_event_evidence_rejected(self):
        next(e for e in self.seed["releaseEvents"] if e["releaseKind"] == "REVISION")["revisionEvidence"] = []
        self.assert_rejected("revision authority unproven")

    def test_missing_first_release_evidence_rejected(self):
        e = next(e for e in self.seed["releaseEvents"] if e["releaseKind"] == "FIRST_RELEASE")
        e["firstReleaseEvidence"], e["firstReleaseEvidenceArtifactIds"] = [], []
        self.assert_rejected("first release unproven")

    def test_broken_observation_lineage_rejected(self):
        next(o for o in self.catalog["observations"] if o["observationId"] == "jan-v1")["supersedesObservationId"] = None
        self.assert_rejected("lineage|supersedes")

    def test_missing_extraction_lineage_rejected(self):
        next(x for x in self.seed["fieldExtractions"] if x["observationId"] == "jan-v1")["predecessorExtractionIds"] = []
        self.assert_rejected("predecessor")

    def test_missing_artifact_binding_rejected(self):
        self.seed["artifactBindings"].pop(0)
        self.assert_rejected("binding|artifact|missing")

    def test_forged_r2_proof_flag_rejected_by_existing_schema(self):
        self.seed["releaseEvents"][0]["historicalAttachmentVersionProven"] = True
        self.assert_rejected("schema")

    def test_actual_r2_release_binding_extraction_provenance_all_hashed(self):
        dataset = self.build()
        baseline = canonical_sha256(dataset_content_projection(dataset))
        for collection, field in (("releaseEvents", "eventSection"), ("artifactBindings", "contentValidation"),
                                  ("fieldExtractions", "parserVersion"), ("retrievalAttempts", "handlingBasis")):
            changed = deepcopy(dataset)
            changed[collection][0][field] = "SYNTHETIC_MUTATION"
            self.assertNotEqual(canonical_sha256(dataset_content_projection(changed)), baseline)


if __name__ == "__main__":
    unittest.main()
