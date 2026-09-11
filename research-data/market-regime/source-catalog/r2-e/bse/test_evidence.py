"""R2-E BSE replay integrity and fail-closed evidence regressions."""
import copy
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import probe
import derive


class EvidenceTests(unittest.TestCase):
    def test_sealed_replay(self):
        expected=json.loads((probe.HERE/'evidence.v1.json').read_text(encoding='utf-8'))
        self.assertEqual(expected,derive.derive())

    def test_recapture_does_not_expand_day_grid(self):
        out=derive.derive()
        self.assertEqual(out['counts']['combinedCaptureCandidateCount'],42)
        self.assertEqual(out['counts']['combinedUniqueDateFieldCandidateCount'],39)
        self.assertEqual(len(out['recaptureComparisons']),1)

    def test_raw_tamper_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            shutil.copyfile(probe.HERE/'request-plan.v1.json',root/'request-plan.v1.json')
            shutil.copytree(probe.HERE/'raw',root/'raw')
            p=root/'raw'/'rules-2021.body'
            p.write_bytes(p.read_bytes()+b' ')
            with patch.object(probe,'HERE',root),self.assertRaises(AssertionError):probe.replay()

    def test_gate_and_field_blocker_isolation(self):
        out=derive.derive()
        self.assertIsNone(out['calendar']['targetCount'])
        self.assertFalse(out['formalObservations'])
        self.assertFalse(out['releaseEvents'])
        for f,row in out['fieldAdmission'].items():
            self.assertEqual(row['formalCount'],0)
            self.assertEqual(row['strictPitCount'],0)
            self.assertEqual('NEGOTIABLE_NOT_PROVEN_FREE_FLOAT' in row['blockers'],f=='negotiableMarketCap')
            self.assertEqual('TRADE_MODE_AND_BLOCK_TRADE_INCLUSION_UNPROVEN' in row['blockers'],f=='turnoverValue')
            self.assertEqual(row['unadmittedWindows'],[dict(start='2021-11-15',end='2026-09-04')])

    def test_naive_archive_publication_cannot_be_daily_release(self):
        out=derive.derive()
        self.assertEqual(len(out['archive']),6)
        for row in out['archive']:
            self.assertIsNone(row['releaseAvailableAt'])
            self.assertIsNone(row['revisionSequence'])
            self.assertFalse(row['firstReleaseProven'])


if __name__=='__main__':unittest.main()
