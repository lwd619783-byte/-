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


if __name__ == '__main__':
    unittest.main()
