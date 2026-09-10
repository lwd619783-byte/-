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


if __name__ == '__main__':
    unittest.main()
