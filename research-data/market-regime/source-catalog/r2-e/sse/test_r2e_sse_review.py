"""Negative checks for the R2-E SSE discovery artifact boundary; offline only."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.market_regime import r2e_sse_probe as probe


class SseReviewChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        out = root / 'research-data/market-regime/source-catalog/r2-e/sse'
        shutil.copytree(probe.OUT, out, ignore=shutil.ignore_patterns('__pycache__'))
        for relative in ['config/market-regime/sse-source-contract.v1.json',
                         'research-data/market-regime/source-catalog/sse-d1a/inventory.v1.json']:
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(probe.ROOT / relative, destination)
        self.out = out
        for name,value in [('ROOT',root),('OUT',out),('RAW',root/'research-data/market-regime/raw/r2-e-sse')]:
            patcher = patch.object(probe,name,value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def rewrite(self,path,data):
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')

    def test_identical_rebuild_preserves_existing_bytes(self):
        paths = [self.out/'candidates.v1.json',self.out/'evidence.v1.json']
        before = [(p.read_bytes(),p.stat().st_mtime_ns) for p in paths]
        probe.build_candidates()
        probe.build_evidence()
        self.assertEqual(before,[(p.read_bytes(),p.stat().st_mtime_ns) for p in paths])

    def test_changed_sealed_candidate_is_not_overwritten(self):
        path = self.out/'candidates.v1.json'
        original = path.read_bytes()
        altered = json.loads(original)
        altered['candidateCount'] += 1
        self.rewrite(path,altered)
        with self.assertRaisesRegex(ValueError,'SEALED_ARTIFACT_CHANGED'):
            probe.build_candidates()
        self.assertEqual(altered['candidateCount'],json.loads(path.read_bytes())['candidateCount'])

    def test_new_explicit_version_keeps_v1(self):
        before = (self.out/'evidence.v1.json').read_bytes()
        probe.build_candidates(version=2)
        probe.build_evidence(version=2)
        self.assertEqual(probe.replay(compact=True,version=2)['status'],'PASS')
        self.assertEqual(before,(self.out/'evidence.v1.json').read_bytes())

    def test_relabelled_official_url_and_resealed_inventory_rejected(self):
        path = self.out/'daily-2021-12-27.metadata.json'
        record = json.loads(path.read_bytes())
        record['url'] = record['url'].replace('2021-12-27','2021-12-28')
        self.rewrite(path,record)
        evidence_path = self.out/'evidence.v1.json'
        evidence = json.loads(evidence_path.read_bytes())
        evidence['artifacts'] = [record if a['requestId']==record['requestId'] else a for a in evidence['artifacts']]
        self.rewrite(evidence_path,evidence)
        with self.assertRaisesRegex(ValueError,'PINNED_METADATA_SET_MISMATCH'):
            probe.replay(compact=True)

    def test_relabelled_acquisition_time_rejected(self):
        path = self.out/'daily-2021-12-27.metadata.json'
        record = json.loads(path.read_bytes())
        record['attemptedAt'] = '2021-12-27T08:00:00+00:00'
        self.rewrite(path,record)
        with self.assertRaisesRegex(ValueError,'PINNED_METADATA_SET_MISMATCH'):
            probe.build_candidates(version=2)

    def test_sample_cannot_promote_full_era(self):
        path = self.out/'evidence.v1.json'
        record = json.loads(path.read_bytes())
        record['fieldAdmission'][0]['eras'][0]['familyApplicability'] = 'PROVEN'
        self.rewrite(path,record)
        with self.assertRaisesRegex(AssertionError,'UNPROVEN_ERA_PROMOTION'):
            probe.replay(compact=True)

    def test_empty_boundary_dates_cannot_become_closed_calendar(self):
        path = self.out/'evidence.v1.json'
        record = json.loads(path.read_bytes())
        record['fieldAdmission'][0]['eras'][2]['calendarStatus'] = 'OFFICIAL_CLOSED'
        self.rewrite(path,record)
        with self.assertRaisesRegex(AssertionError,'UNPROVEN_ERA_PROMOTION'):
            probe.replay(compact=True)

    def test_missing_output_version_does_not_pass_replay(self):
        with self.assertRaisesRegex(ValueError,'VERSIONED_ARTIFACT_PAIR_REQUIRED'):
            probe.replay(compact=True,version=999)

    def test_new_version_cannot_parse_relabelled_raw_value(self):
        path = self.out/'daily-2021-12-27.body'
        path.write_bytes(path.read_bytes()+b' ')
        with self.assertRaisesRegex(ValueError,'PINNED_SOURCE_BYTES_MISMATCH'):
            probe.build_candidates(version=2)


if __name__ == '__main__':
    unittest.main()
