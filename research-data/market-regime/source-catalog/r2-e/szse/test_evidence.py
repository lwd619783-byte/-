"""Adversarial checks of the committed R2-E SZSE sidecars."""
import json
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from scripts.market_regime import r2e_szse_probe as subject


class SZSEEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='r2e-szse-test-')
        self.root = Path(self.temp.name).resolve()
        assert self.root.is_relative_to(Path(tempfile.gettempdir()).resolve())
        self.out = self.root / 'research-data/market-regime/source-catalog/r2-e/szse'
        self.out.mkdir(parents=True)
        for path in subject.OUT.glob('*.json'):
            shutil.copy2(path, self.out / path.name)
        (self.out / 'raw').mkdir()
        for path in (subject.OUT / 'raw').glob('*.body'):
            shutil.copy2(path, self.out / 'raw' / path.name)
        self.original_root, self.original_out, self.original_raw = subject.ROOT, subject.OUT, subject.RAW
        self.paths = patch.multiple(subject, ROOT=self.root, OUT=self.out,
                                    RAW=self.root / 'research-data/market-regime/raw/r2-e-szse')
        self.paths.start()

    def tearDown(self):
        self.paths.stop()
        self.temp.cleanup()

    def edit(self, name, change):
        path = self.out / name
        value = json.loads(path.read_text(encoding='utf-8'))
        change(value)
        path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    def compact(self):
        return subject.validate(replay_text=False, compact=True)

    def test_missing_ignored_raw_is_explicit_not_run(self):
        report = self.compact()
        self.assertEqual(report['fullRawReplay'], 'NOT_RUN_MISSING_RAW')
        self.assertEqual(len(report['missingRaw']), 4)

    def test_missing_raw_never_passes_full_replay(self):
        with self.assertRaisesRegex(AssertionError, 'RAW_MISSING'):
            subject.validate(replay_text=False)

    def test_candidate_count_tampering_rejected(self):
        self.edit('yearbook-candidates.v1.json', lambda x:x.update(candidateCount=485))
        with self.assertRaisesRegex(AssertionError, 'CANDIDATE_COUNT'):
            self.compact()

    def test_drop_candidate_and_recount_rejected(self):
        def change(x):
            x['candidates'].pop()
            x['candidateCount'] = len(x['candidates'])
        self.edit('yearbook-candidates.v1.json', change)
        with self.assertRaisesRegex(AssertionError, 'CANDIDATE_COUNT'):
            self.compact()

    def test_pdf_cell_location_tampering_rejected(self):
        self.edit('yearbook-candidates.v1.json', lambda x:x['candidates'][0]['locator']['bbox'].__setitem__(0, 999))
        with self.assertRaisesRegex(AssertionError, 'CANDIDATE_IDENTITY'):
            self.compact()

    def test_original_html_locator_tampering_rejected(self):
        self.edit('archive-index.v1.json', lambda x:x['entries'][0]['locator'].update(byteOffset=0))
        with self.assertRaises(AssertionError):
            self.compact()

    def test_max_a_b_total_cannot_create_a_denominator(self):
        self.edit('workstream-report.v1.json', lambda x:x['calendar'].update(status='OFFICIAL',targetCount=242))
        with self.assertRaisesRegex(AssertionError, 'MAX_A_B_IS_NOT_A_CALENDAR'):
            self.compact()

    def test_formal_promotion_rejected(self):
        self.edit('yearbook-candidates.v1.json', lambda x:x.update(formalCount=484,strictPitCount=484))
        with self.assertRaisesRegex(AssertionError, 'FORMAL_PROMOTION_FORBIDDEN'):
            self.compact()

    def test_sealed_write_idempotent_then_rejects_drift(self):
        path = self.out / 'seal-test.json'
        self.assertEqual(subject.sealed_write(path,b'{"value":1}'), 'CREATED')
        self.assertEqual(subject.sealed_write(path,b'{"value":1}'), 'UNCHANGED')
        with self.assertRaisesRegex(AssertionError, 'NEW_VERSION_REQUIRED'):
            subject.sealed_write(path,b'{"value":2}')
        self.assertEqual(path.read_bytes(), b'{"value":1}')

    def test_resealed_location_tampering_fails_real_pdf_replay(self):
        try:
            import pdfplumber  # noqa: F401
        except ImportError:
            self.skipTest('pdfplumber unavailable; run with bundled Python for PDF replay')
        if not (self.original_raw / 'year-2022-history.body').exists():
            self.skipTest('Ignored original PDF unavailable: full replay NOT_RUN')
        def change(x):
            row = x['candidates'][0]
            row['locator']['bbox'][0] += 1
            identity = {k:v for k,v in row.items() if k != 'candidateId'}
            row['candidateId'] = 'szse-r2e-year-' + subject.digest(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode())
        self.edit('yearbook-candidates.v1.json', change)
        def actual_source_path(record):
            relative = Path(record['path'])
            return (self.original_root if 'r2-e-szse' in relative.parts else self.root) / relative
        with patch.object(subject,'source_path',side_effect=actual_source_path):
            with self.assertRaises(AssertionError):
                subject.replay_candidates()


if __name__ == '__main__':
    unittest.main()
