"""Adversarial retained-byte canary tests; no synthetic observation is admitted."""
from copy import deepcopy
import json
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
import unittest

from scripts.market_regime.pbc_canary import BASE, ROOT, GRAPH, PLAN, DEFINITIONS, SEAL, load, replay


class PbcCanaryV2Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        shutil.copytree(ROOT/BASE, self.root/BASE)
        for owner in [PLAN, DEFINITIONS, SEAL]:
            (self.root/owner).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT/owner, self.root/owner)
        self.graph = load(self.root, GRAPH)

    def write(self):
        (self.root/GRAPH).write_text(json.dumps(self.graph, ensure_ascii=False), encoding='utf-8')

    def blocked(self):
        self.write()
        with self.assertRaises((ValueError, KeyError)):
            replay(self.root)

    def test_authentic_native_positive_replay(self):
        result = replay(self.root)
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(result['observations'][0]['value'], 12.9)
        self.assertEqual(result['committedRawCount'], 2)
        self.assertEqual(result['observations'][0]['fetchedAt'], '2026-09-08T11:06:07.128856Z')

    def test_fixture_role_cannot_be_promoted(self):
        self.graph['catalog']['artifacts'][0]['artifactRole'] = 'TEST_FIXTURE_EXCERPT'
        self.blocked()

    def test_reacquired_is_not_retained(self):
        self.graph['retentionClass'] = 'REACQUIRED_SOURCE'
        self.blocked()

    def test_bytes_digest_mismatch(self):
        artifact = self.graph['catalog']['artifacts'][0]
        (self.root/artifact['localPath']).write_bytes(b'<html>substituted raw</html>')
        self.blocked()

    def test_locator_mismatch(self):
        self.graph['dataset']['fieldExtractions'][0]['locator']['byteOffset'] += 1
        self.blocked()

    def test_release_mismatch(self):
        self.graph['dataset']['releaseEvents'][0]['releaseAvailableAt'] = '2011-11-01T00:00:00+08:00'
        self.blocked()

    def test_definition_mismatch(self):
        self.graph['catalog']['sourceDefinitions'][0]['unit'] = '亿元'
        self.blocked()

    def test_source_identity_mismatch(self):
        self.graph['catalog']['artifacts'][0]['sourceUrl'] = 'https://pbc.gov.cn.attacker.example/index.html'
        self.blocked()

    def test_unverified_future_revision_never_leaks(self):
        future = deepcopy(self.graph['catalog']['observations'][0])
        future.update(observationId='future-private-id', releaseAvailableAt='2099-01-01T00:00:00Z', value=999)
        self.graph['catalog']['observations'].append(future)
        self.blocked()

    def test_before_release_returns_no_future_identity_or_value(self):
        result = replay(self.root, '2011-11-07T08:00:00+08:00')
        self.assertEqual(result['observations'], [])
        self.assertNotIn('obs-pbc-', json.dumps(result))
        self.assertNotIn('12.9', json.dumps(result))

    def test_cutoff_boundary(self):
        self.assertEqual(replay(self.root, '2011-11-11T15:05:05+08:00')['eligibleObservationCount'], 0)
        self.assertEqual(replay(self.root, '2011-11-11T15:05:06+08:00')['eligibleObservationCount'], 1)

    def test_canary_cannot_promote_full_graph_or_admission(self):
        self.graph['fullGraphReplay'] = 'PASS'
        self.graph['sourceAdmission'] = 'PASS'
        self.write()
        result = replay(self.root)
        self.assertEqual(result['fullGraphReplay'], 'BLOCKED')
        self.assertEqual(result['sourceAdmission'], 'BLOCKED')

    def test_fetched_at_cannot_replace_release_time(self):
        self.graph['catalog']['artifacts'][0]['publicationDateTime'] = self.graph['catalog']['artifacts'][0]['fetchedAt']
        self.blocked()

    def test_missing_archive_owner_is_blocked(self):
        (self.root/self.graph['dataset']['evidenceArtifacts'][0]['localPath']).unlink()
        self.blocked()


if __name__ == '__main__':
    unittest.main()
