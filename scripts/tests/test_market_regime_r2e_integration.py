"""R2-E pinned evidence and refusal-to-promote regressions."""
import json
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path

from scripts.market_regime import r2e_integration as r2e
from scripts.market_regime.hashing import canonical_sha256
from scripts.market_regime.time_semantics import date_only_safe_available_at, is_observation_eligible


class IntegratedEvidenceTests(unittest.TestCase):
    def test_release_report_replay(self):
        obj = r2e.release_report()
        r2e.validate_report(obj, 'release')
        self.assertEqual(len(obj['rows']), 3)
        self.assertEqual(obj['releaseEvents'], [])
        for row in obj['rows']:
            self.assertIsNone(row['releaseAvailableAt'])
            self.assertEqual(row['strictPitCount'], 0)

    def test_resealed_market_release_promotion_rejected(self):
        obj = r2e.release_report()
        obj['rows'][0]['releaseAvailableAt'] = '2005-01-04T15:00:00+08:00'
        obj['rows'][0]['provenFirstReleaseCount'] = 1
        with self.assertRaises(ValueError):
            r2e.validate_report(r2e.d2.seal(obj), 'release')

    def test_new_evidence_never_changes_historical_allowlist(self):
        self.assertEqual(r2e.d2.HISTORICAL_ADMISSIONS, ())
        self.assertEqual(r2e.release_report()['formalObservations'], [])

    def test_resealed_source_snapshot_cannot_change_reviewed_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name, path in r2e.INPUT_PATHS.items():
                target = root / r2e.FOLDER / path
                target.parent.mkdir(parents=True, exist_ok=True)
                obj = r2e.strict_json((r2e.ROOT / r2e.FOLDER / path).read_bytes())
                if name == 'calendar':
                    obj['targetCount'] = 5000
                    obj = r2e.d2.seal(obj)
                target.write_text(json.dumps(obj, ensure_ascii=False), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'REVIEWED_INPUT_IDENTITY_MISMATCH'):
                r2e.release_report(root=root)

    def test_real_date_only_rule_boundary_not_trade_date_guess(self):
        available = date_only_safe_available_at('2026-09-04')
        self.assertEqual(available, '2026-09-05T00:00:00+08:00')
        synthetic = dict(releaseAvailableAt=available, releaseConfidenceClass='DATE_ONLY_SAFE')
        self.assertFalse(is_observation_eligible(synthetic, '2026-09-04T23:59:59+08:00'))
        self.assertTrue(is_observation_eligible(synthetic, available))
        self.assertFalse(is_observation_eligible(dict(releaseAvailableAt=None), available))
        synthetic['releaseConfidenceClass'] = 'SCHEDULE_INFERRED'
        self.assertFalse(is_observation_eligible(synthetic, available))

    def test_definition_era_matrix_covers_all_nine_cells(self):
        obj = r2e.definition_report()
        self.assertEqual({(r['exchange'], r['field']) for r in obj['matrix']},
                         {(e, f) for e in ('SSE', 'SZSE', 'BSE') for f in r2e.d2.FIELDS})
        for row in obj['matrix']:
            self.assertEqual(row['status'], 'NOT_ADMITTED')
            self.assertEqual(row['admittedWindows'], [])
            self.assertEqual(row['unadmittedWindows'][0]['end'], '2026-09-04')

    def test_field_specific_blockers_do_not_leak(self):
        for row in r2e.definition_report()['matrix']:
            combined = row['fieldBlockers'] + row['sourceBlockers']
            self.assertEqual(any('FREE_FLOAT' in r for r in combined), row['field'] == 'negotiableMarketCap')
            self.assertEqual(any('BLOCK_TRADE' in r for r in combined),
                             row['exchange'] == 'BSE' and row['field'] == 'turnoverValue')

    def test_resealed_definition_era_promotion_rejected(self):
        obj = r2e.definition_report()
        obj['matrix'][0]['eraStatus'] = 'PROVEN'
        obj['matrix'][0]['admittedWindows'] = obj['matrix'][0]['unadmittedWindows']
        with self.assertRaises(ValueError):
            r2e.validate_report(r2e.d2.seal(obj), 'definitions')

    def test_candidate_capture_and_unique_counts_separate(self):
        obj = r2e.history_report()
        self.assertEqual((obj['candidateCount'], obj['newCandidateCount'], obj['priorCandidateCount']), (700, 589, 111))
        self.assertEqual(obj['uniqueCandidateKeyCount'], 688)
        self.assertEqual(len(obj['recaptureComparisons']), 12)
        self.assertEqual((obj['formalCount'], obj['strictPitCount']), (0, 0))
        self.assertEqual(obj['eligibleObservations'], [])

    def test_resealed_candidate_cannot_be_formal(self):
        obj = r2e.history_report()
        obj['candidates'][0]['formalEligible'] = True
        obj['formalObservations'] = [obj['candidates'][0]]
        with self.assertRaises(ValueError):
            r2e.validate_report(r2e.d2.seal(obj), 'history')

    def test_repeated_capture_never_selects_vintage_truth(self):
        obj = r2e.history_report()
        self.assertTrue(all(r['truthSelection'] is None for r in obj['recaptureComparisons']))
        self.assertTrue(all(r['releaseAvailableAt'] is None for r in obj['candidates']))

    def test_yearbook_dates_never_become_calendar(self):
        obj = r2e.history_report()
        candidates = [r for r in obj['candidates'] if r['family'] == 'SZSE_YEARBOOK_2022_CHINEXT']
        self.assertEqual(len(candidates), 484)
        self.assertEqual(len({r['tradeDate'] for r in candidates}), 242)
        self.assertIsNone(r2e.inputs()['calendar']['targetCount'])

    def test_d3_complete_six_row_refusal_and_unknown_coverage(self):
        obj = r2e.admission_report()
        self.assertEqual(len(obj['admissionMatrix']), 6)
        self.assertEqual(len(obj['unadmittedWindows']), 6)
        self.assertEqual(obj['numericAggregateCount'], 0)
        self.assertEqual(obj['formalAdmissionTransitions'], [])
        for row in obj['admissionMatrix']:
            self.assertIsNone(row['targetCount'])
            self.assertIsNone(row['coveragePercent'])
            self.assertEqual(set(row['requiredExchanges']), {'SSE', 'SZSE'} | ({'BSE'} if row['start'] == '2021-11-15' else set()))

    def test_d3_resealed_numeric_or_denominator_injection_rejected(self):
        for key, value in [('numericAggregateCount', 1), ('targetCount', 5000), ('coveragePercent', 0)]:
            obj = r2e.admission_report()
            obj[key] = value
            with self.assertRaises(ValueError):
                r2e.validate_report(r2e.d2.seal(obj), 'admission')

    def test_d3_preserves_d2_and_bse_null_structural_marker(self):
        obj = r2e.admission_report()
        self.assertEqual(obj['previousReport']['contentSha256'], '4ba8737f2dc9e0ba32a35249b36b07075253ea9a11270b67be78029f9ff3b3c1')
        self.assertIsNone(obj['excludedStructuralComponents'][0]['value'])
        self.assertIsNone(obj['excludedStructuralComponents'][0]['releaseAvailableAt'])
        self.assertEqual(obj['excludedStructuralComponents'][0]['status'], 'OUTSIDE_REQUIRED_SCOPE')

    def test_d3_retains_bse_annual_notice_recovery_without_admission(self):
        obj = r2e.admission_report()
        progress = next(r for r in obj['evidenceProgress'] if r['item'].startswith('BSE'))
        self.assertEqual(progress['status'], 'VERIFIED_DISCOVERY')
        for row in obj['sourceInventories']:
            self.assertFalse(any('2022-2024' in b for b in row['sourceBlockers']))
            self.assertEqual(row['datasetAdmission'], 'NOT_ADMITTED')

    def test_d3_rejects_stale_or_tampered_committed_checkpoint(self):
        paths = {r2e.FOLDER / p for p in r2e.INPUT_PATHS.values()}
        paths.update([r2e.BSE_RULE_CORRECTION, r2e.OUTPUT / 'definitions.v2.json'])
        paths.update(r2e.OUTPUT / (name + '.v1.json') for name in ('release', 'definitions', 'history'))
        paths.add(Path('research-data/market-regime/source-catalog/all-a-d2/admission-report.v1.json'))
        for exchange, (folder, _, _) in r2e.d2.INPUTS.items():
            paths.add(Path(f'research-data/market-regime/source-catalog/{folder}/inventory.v1.json'))
            paths.add(Path('config/market-regime') / (exchange.lower() + '-source-contract.v1.json'))
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for path in paths:
                (root / path).parent.mkdir(parents=True, exist_ok=True)
                (root / path).write_bytes((r2e.ROOT / path).read_bytes())
            path = root / r2e.OUTPUT / 'history.v1.json'
            obj = r2e.strict_json(path.read_bytes())
            obj['formalCount'] = 1
            path.write_text(json.dumps(r2e.d2.seal(obj)), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'CHECKPOINT_ARTIFACT_REPLAY_MISMATCH'):
                r2e.admission_report(root=root)

    def test_definition_v2_changes_only_bse_locators_and_references(self):
        old = r2e.definition_report()
        new = r2e.definition_report_v2()
        for before, after in zip(old['matrix'], new['matrix']):
            restored = dict(after)
            if before['exchange'] == 'BSE':
                self.assertNotEqual(before['officialDefinitionEvidence'], after['officialDefinitionEvidence'])
                restored['officialDefinitionEvidence'] = before['officialDefinitionEvidence']
                restored['evidenceReferences'] = before['evidenceReferences']
            self.assertEqual(before, restored)
        self.assertEqual(new['supersedes']['contentSha256'], old['contentSha256'])
        self.assertEqual(r2e.strict_json((r2e.ROOT / r2e.OUTPUT / 'definitions.v1.json').read_bytes()), old)

    def test_d3_binds_corrected_definition_artifact(self):
        obj = r2e.admission_report()
        ref = next(r for r in obj['checkpointReferences'] if r['path'].endswith('definitions.v2.json'))
        self.assertEqual(ref['contentSha256'], r2e.definition_report_v2()['contentSha256'])
        bse = next(r for r in obj['sourceInventories'] if r['exchange'] == 'BSE')
        self.assertTrue(all(any(ref['contentSha256'] == r2e.BSE_RULE_CORRECTION_PIN
                                for ref in row['evidenceReferences']) for row in bse['fieldAdmission']))

    def test_definition_v2_resealed_rule_correction_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for path in [r2e.FOLDER / p for p in r2e.INPUT_PATHS.values()] + [r2e.BSE_RULE_CORRECTION]:
                (root / path).parent.mkdir(parents=True, exist_ok=True)
                (root / path).write_bytes((r2e.ROOT / path).read_bytes())
            for exchange in ('SSE', 'SZSE', 'BSE'):
                path = Path('config/market-regime') / (exchange.lower() + '-source-contract.v1.json')
                (root / path).parent.mkdir(parents=True, exist_ok=True)
                (root / path).write_bytes((r2e.ROOT / path).read_bytes())
            path = root / r2e.BSE_RULE_CORRECTION
            obj = r2e.strict_json(path.read_bytes())
            obj['ruleEvidence'][0]['locator']['byteOffset'] = 0
            path.write_text(json.dumps(r2e.d2.seal(obj)), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'BSE_RULE_CORRECTION_IDENTITY_MISMATCH'):
                r2e.definition_report_v2(root=root)


if __name__ == '__main__':
    unittest.main()
