"""C2A1 adversaries. Synthetic scenarios and compact consistency, never live PIT proof."""
import copy
import json
import tempfile
import unittest
from jsonschema import Draft202012Validator
from pathlib import Path
from unittest.mock import patch

from scripts.market_regime.csrc_field_map import field_map
from scripts.market_regime.csrc_ipo_admission import (
    BASE, CONFIG, C1_HASH, DEFINITION_ID, LISTING_NOTE, OUT, RECOVERY, RECOVERY_HASH,
    assemble, baseline_check, build, candidate_periods, definition_gate, digest, load,
    no_formal_observations, numeric_evidence, validate_compact, vintage_gate,
)
from scripts.market_regime.historical_validator import select_vintage
from scripts.market_regime.csrc_schema import _cell as parsed_cell
from scripts.tests.test_market_regime_csrc_field_map import cell, fixture
from scripts.tests.test_market_regime_historical import FixtureCase

ROOT = Path(__file__).resolve().parents[2]
FX = load(ROOT, "scripts/tests/fixtures/market_regime/csrc-c2a1-adversarial.synthetic.v1.json")


def semantic_fixture(**kwargs):
    probe = fixture(note="注：" + LISTING_NOTE + "。", **kwargs)
    probe["sheets"][0]["cells"].append(cell(2, 6, "境内筹资合计(亿元)"))
    probe["sheets"][0]["columnCount"] = 6
    return probe


def gate(probe):
    mapping = field_map(probe, "2015-10")
    return definition_gate(mapping["fields"]["SUPPLY_IPO_FINANCING"]["candidates"][0], mapping["tables"][0],
                           probe_blockers=probe["blockers"])


class IpoDefinitionTests(unittest.TestCase):
    def test_titles_share_definition_only_with_complete_equivalent_context(self):
        for title in ("首发筹资", "首次发行金额"):
            probe = semantic_fixture()
            probe["sheets"][0]["cells"][2]["text"] = title
            self.assertEqual(gate(probe)["definitionId"], DEFINITION_ID)
            probe["sheets"][0]["cells"] = [c for c in probe["sheets"][0]["cells"] if not c["text"].startswith("注：")]
            self.assertIn("IPO_MONTH_ATTRIBUTION_UNPROVEN", gate(probe)["blockers"])

    def test_b_h_counts_shares_currency_plan_and_approval_rejected(self):
        for scope in FX["scopeRejects"]:
            with self.subTest(scope=scope):
                self.assertFalse(gate(semantic_fixture(scope=scope))["definitionCompatible"])

    def test_ytd_cannot_enter_month(self):
        self.assertFalse(gate(semantic_fixture(period_text="2015年1-10月累计"))["definitionCompatible"])

    def test_domestic_and_excluded_sibling_context_required(self):
        for text in ("境内筹资合计(亿元)", "B股(亿元)", "H股(亿元)"):
            probe = semantic_fixture()
            probe["sheets"][0]["cells"] = [c for c in probe["sheets"][0]["cells"] if c["text"] != text]
            self.assertFalse(gate(probe)["definitionCompatible"])

    def test_official_note_scope_conflict_rejected(self):
        probe = semantic_fixture()
        probe["sheets"][0]["cells"].append(cell(6, 1, "注：上述A股包含B股，金额为计划批准额。"))
        self.assertFalse(gate(probe)["definitionCompatible"])

    def test_all_format_formula_period_macro_external_blockers_fail_closed(self):
        for blocker in FX["probeBlockers"]:
            probe = semantic_fixture()
            probe["blockers"] = [blocker]
            with self.subTest(blocker=blocker):
                self.assertIn(blocker, gate(probe)["blockers"])
                self.assertIsNone(gate(probe)["definitionId"])

    def test_formula_no_cache_rejected_at_cell(self):
        probe = semantic_fixture()
        amount = next(c for c in probe["sheets"][0]["cells"] if (c["row"], c["column"]) == (4, 2))
        amount.update(formula={"kind": "BIFF"}, cache={"status": "MISSING_OR_ERROR"})
        self.assertFalse(gate(probe)["definitionCompatible"])

    def test_explicit_zero_missing_non_numeric_distinction(self):
        for token in ("0", "0.00", "+0", "-0"):
            self.assertEqual(numeric_evidence(parsed_cell(1, 1, token))["numericValue"], 0)
        for token in FX["missingTokens"]:
            with self.subTest(token=token):
                self.assertIsNone(numeric_evidence(cell(1, 1, token))["numericValue"])
        self.assertEqual(numeric_evidence(cell(1, 1, "0.001"))["numericValue"], .001)
        self.assertNotEqual(numeric_evidence(cell(1, 1, ""))["valueState"], numeric_evidence(cell(1, 1, "—"))["valueState"])

    def test_zero_state_cannot_disagree_with_numeric_token(self):
        wrong = cell(1, 1, "0")
        wrong["text"] = "123"
        with self.assertRaisesRegex(ValueError, "ZERO_TOKEN_STATE_MISMATCH"):
            numeric_evidence(wrong)


class IpoVintageTests(unittest.TestCase):
    def setUp(self):
        self.publication = dict(status="LANDING", date="2005-02-11", dateOnlySafeAvailableAt="2005-02-12T00:00:00+08:00",
                                evidence=[dict(text="2005-02-11")])
        self.acquisitions = [dict(outcome="SUCCESS", requestUrl="https://www.csrc.gov.cn/synthetic.xls",
                                  attemptedAt="2026-09-08T00:00:00Z", storedBytes=dict(sha256="a"*64))]

    def result(self):
        return vintage_gate(self.publication, self.acquisitions, attachment_sha="a"*64)

    def test_old_landing_and_current_bytes_do_not_prove_first_release(self):
        result = self.result()
        self.assertFalse(result["firstReleaseProven"])
        self.assertFalse(result["historicalAttachmentVersionProven"])
        self.assertEqual(result["releaseKind"], "UNRESOLVED")
        self.assertIsNone(result["releaseAvailableAt"])
        self.assertEqual(result["pageDateOnlySafeAvailableAt"], "2005-02-12T00:00:00+08:00")

    def test_old_value_date_and_caller_proof_flags_do_not_create_available_at(self):
        self.publication.update(valueDate="2005-01", firstReleaseProven=True, historicalAttachmentVersionProven=True,
                                releaseAvailableAt="2005-01-01T00:00:00+08:00", releaseKind="FIRST_RELEASE")
        self.assertIsNone(self.result()["releaseAvailableAt"])
        self.assertFalse(self.result()["eligibleForFutureC2A2"])

    def test_missing_publication_locator_remains_unproven(self):
        self.publication["evidence"] = []
        self.assertIsNone(self.result()["pageDateOnlySafeAvailableAt"])
        self.assertIn("RELEASE_EVENT_UNPROVEN", self.result()["blockers"])

    def test_safe_clock_cannot_be_changed_to_statistical_month(self):
        self.publication["dateOnlySafeAvailableAt"] = "2005-01-01T00:00:00+08:00"
        with self.assertRaisesRegex(ValueError, "PUBLICATION_SAFE_CLOCK_MISMATCH"):
            self.result()

    def test_same_url_different_bytes_without_official_revision_is_conflict(self):
        changed = copy.deepcopy(self.acquisitions[0])
        changed["storedBytes"]["sha256"] = "b"*64
        self.acquisitions.append(changed)
        self.assertEqual(self.result()["status"], "UNRESOLVED_RELEASE_CONFLICT")
        self.assertIsNone(self.result()["releaseAvailableAt"])
        self.acquisitions.reverse()
        self.assertEqual(self.result()["status"], "UNRESOLVED_RELEASE_CONFLICT")

    def test_hash_must_be_acquired_not_invented(self):
        with self.assertRaisesRegex(ValueError, "ATTACHMENT_ACQUISITION_MISSING"):
            vintage_gate(self.publication, self.acquisitions, attachment_sha="c"*64)


class IpoCompactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base, cls.recovery, cls.config, cls.evidence = (load(ROOT, p) for p in (BASE, RECOVERY, CONFIG, OUT))

    def inputs(self):
        return [copy.deepcopy(x) for x in (self.base, self.recovery, self.config,
                [r["extractionEvidence"] for r in self.evidence["admissionMatrix"]])]

    def test_real_compact_is_consistent_not_a_pit_claim(self):
        with patch("requests.Session.request", side_effect=AssertionError("OFFLINE_ONLY")):
            self.assertEqual(validate_compact(ROOT), self.evidence)
        self.assertEqual(self.evidence["summary"]["candidateCount"], 87)
        self.assertEqual(self.evidence["summary"]["definitionCompatibleCount"], 26)
        self.assertEqual(self.evidence["summary"]["pitProvenCount"], 0)
        self.assertEqual(self.evidence["summary"]["eligiblePeriods"], [])

    def test_native_status_vocabulary_unchanged(self):
        schema = load(ROOT, "config/market-regime/historical-dataset.schema.json")
        statuses = schema["$defs"]["coverageCell"]["properties"]["status"]["enum"]
        self.assertTrue(all(r["admissionStatus"] in statuses for r in self.evidence["admissionMatrix"]))

    def test_versioned_definition_obeys_unchanged_r1_object_contract(self):
        schema = load(ROOT, "config/market-regime/observation-catalog.schema.json")
        validator = Draft202012Validator({"$defs": schema["$defs"], "$ref": "#/$defs/sourceDefinitionVersion"})
        validator.validate(self.config["definitions"][0])
        self.assertFalse(self.config["review"]["registeredInFormalCatalog"])

    def test_decoded_binary_value_cannot_disagree_with_c1_token(self):
        base, recovery, config, witnesses = self.inputs()
        witnesses[0]["decodedXlsValue"]["floatHex"] = float(123).hex()
        with self.assertRaisesRegex(ValueError, "DECODED_NUMBER_TOKEN_MISMATCH"):
            assemble(base, recovery, config, witnesses, "fixed")

    def test_full_260_denominator_and_known_exclusions_preserved(self):
        self.assertEqual([r["reportPeriod"] for r in self.evidence["coverageLedger"]], [r["period"] for r in self.base["ledger"]])
        for p, blocker in FX["knownExcludedPeriods"].items():
            row = next(r for r in self.evidence["coverageLedger"] if r["reportPeriod"] == p)
            self.assertFalse(row["candidate"])
            self.assertIsNone(row["admissionStatus"])
            self.assertIn(blocker, json.dumps(row))
        self.assertTrue(all(not r["candidate"] for r in self.evidence["coverageLedger"] if r["reportPeriod"] >= "2012-10"))
        self.assertEqual([r["c1Ledger"] for r in self.evidence["coverageLedger"]], self.base["ledger"])
        self.assertEqual([r["c1_1Ledger"] for r in self.evidence["coverageLedger"]], self.recovery["ledger"])

    def test_candidate_deletion_duplication_or_expansion_is_rejected(self):
        for mutation in (lambda w: w.pop(), lambda w: w.append(copy.deepcopy(w[0])), lambda w: w[0].update(reportPeriod="2007-04")):
            base, recovery, config, witnesses = self.inputs()
            mutation(witnesses)
            with self.assertRaisesRegex(ValueError, "CANDIDATE_MATRIX_NOT_EXACT"):
                assemble(base, recovery, config, witnesses, "fixed")

    def test_legacy_hashes_are_exact_and_ledger_changes_stop(self):
        self.assertEqual(self.base["contentSha256"], C1_HASH)
        self.assertEqual(self.recovery["contentSha256"], RECOVERY_HASH)
        for index in (0, 1):
            pair = [copy.deepcopy(self.base), copy.deepcopy(self.recovery)]
            pair[index]["ledger"][0]["period"] = "1999-01"
            with self.assertRaisesRegex(ValueError, "BASELINE_DRIFT_STOP"):
                baseline_check(*pair)

    def test_determinism_and_generated_at_exclusion(self):
        inputs = self.inputs()
        a = assemble(*inputs, "same")
        inputs[-1].reverse()
        self.assertEqual(a, assemble(*inputs, "same"))
        self.assertEqual(a["contentSha256"], assemble(*inputs, "different")["contentSha256"])

    def test_blocker_provenance_definition_and_numeric_changes_change_hash(self):
        original = {k: v for k, v in self.evidence.items() if k not in ("contentSha256", "generatedAt")}
        mutations = [lambda e: e["admissionMatrix"][0]["blockers"].append("TEST_BLOCKER"),
                     lambda e: e["admissionMatrix"][0]["attachment"].update(acquiredAt="2026-09-09T01:00:00Z"),
                     lambda e: e["definitionMappingEvidence"]["definitions"][0].update(definitionSummary="changed"),
                     lambda e: e["admissionMatrix"][0].update(rawNumericToken="123")]
        for mutation in mutations:
            changed = copy.deepcopy(original)
            mutation(changed)
            self.assertNotEqual(digest(changed), self.evidence["contentSha256"])

    def test_definition_rewrite_and_unreviewed_note_rejected(self):
        for mutate in (lambda c: c["definitions"][0].update(definitionSummary="批准金额"),
                       lambda c: c["mappings"][0]["tableEvidence"]["notes"].append({"text": "changed"})):
            base, recovery, config, witnesses = self.inputs()
            mutate(config)
            with self.assertRaisesRegex(ValueError, "DEFINITION_VERSION_MISMATCH|UNREVIEWED_MAPPING"):
                assemble(base, recovery, config, witnesses, "fixed")

    def test_period_cell_and_formula_cache_mutations_fail_closed(self):
        for mutate in (lambda w: w[0]["periodCell"].update(text="1999-01"),
                       lambda w: w[0]["valueCell"].update(formula={"kind": "BIFF"}, cache=None)):
            base, recovery, config, witnesses = self.inputs()
            mutate(witnesses)
            with self.assertRaisesRegex(ValueError, "PERIOD_SEMANTICS_CONFLICT|CELL_STATE_MISMATCH"):
                assemble(base, recovery, config, witnesses, "fixed")

    def test_formal_observations_are_empty_recursively_and_injection_rejected(self):
        no_formal_observations(self.evidence)
        base, recovery, config, witnesses = self.inputs()
        witnesses[0]["formalObservations"] = [{"value": 1}]
        with self.assertRaisesRegex(ValueError, "FORMAL_OBSERVATIONS_FORBIDDEN"):
            assemble(base, recovery, config, witnesses, "fixed")

    def test_full_build_requires_raw_and_cannot_relabel_compact_as_replay(self):
        with tempfile.TemporaryDirectory() as temp:
            repo = Path(temp)
            for path, value in ((BASE, self.base), (RECOVERY, self.recovery), (CONFIG, self.config)):
                target = repo / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaises(FileNotFoundError):
                build(repo, "fixed")


class IpoR2ALineageContractTests(FixtureCase):
    """Delegate time/lineage to unchanged R2-A using its synthetic event fixture.

    These tests do not manufacture a real CSRC proof from an official-looking URL.
    """
    def test_official_revision_visible_only_at_revision_available_at(self):
        dataset = self.build()
        cell_id = self.row("2026-01")["cellId"]
        def at(clock):
            return select_vintage(dataset, self.catalog, plans=self.plans, artifact_root=self.root,
                                  cell_id=cell_id, cutoff="2026-09-07T" + clock + "+08:00")
        self.assertEqual(at("07:59:59")["observationId"], "jan-v0")
        self.assertEqual(at("08:00:00")["observationId"], "jan-v1")

    def test_unproved_revision_event_rejected_by_unchanged_r2a(self):
        event = next(e for e in self.seed["releaseEvents"] if e["releaseKind"] == "REVISION")
        event["revisionEvidence"] = []
        self.assert_rejected("revision authority unproven")

    def test_broken_revision_lineage_rejected_by_unchanged_r2a(self):
        observation = next(o for o in self.catalog["observations"] if o["observationId"] == "jan-v1")
        observation["supersedesObservationId"] = None
        self.assert_rejected("revision|lineage|supersedes")


if __name__ == "__main__":
    unittest.main()
