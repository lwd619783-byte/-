import json
import unittest
import replay


class CorrectedRuleEvidenceTests(unittest.TestCase):
    def test_sealed_original_byte_replay(self):
        out=replay.derive()
        expected=json.loads((replay.HERE/'evidence.v3.json').read_text(encoding='utf-8'))
        self.assertEqual(out,expected)
        self.assertEqual(len(out['ruleEvidence']),9)
        for row in out['ruleEvidence']:
            loc=row['locator'];raw=(replay.HERE.parent/'raw'/(loc['requestId']+'.body')).read_bytes()
            self.assertEqual(raw[loc['byteOffset']:loc['byteOffset']+loc['byteLength']],loc['text'].encode())
            self.assertTrue(loc['text'].startswith('<p '))
            self.assertTrue(loc['text'].endswith('</p>'))
            self.assertNotIn('&url=',loc['text'])

    def test_share_summary_does_not_count_as_body(self):
        raw=b'<a href="share?text=effective 2026">share</a><p>other</p>'
        with self.assertRaisesRegex(ValueError,'BODY_PARAGRAPH'):
            replay.paragraph_locator(raw,['effective 2026'])

    def test_duplicate_or_incomplete_clause_rejected(self):
        with self.assertRaisesRegex(ValueError,'BODY_PARAGRAPH'):
            replay.paragraph_locator(b'<p>effective</p><p>effective</p>',['effective'])
        with self.assertRaisesRegex(ValueError,'BODY_PARAGRAPH'):
            replay.paragraph_locator(b'<p>deferred section 3.7.1</p>',['3.7.1','3.7.10'])

    def test_full_deferred_range_and_dates_are_present(self):
        rows={r['meaning']:r for r in replay.derive()['ruleEvidence']}
        text=rows['DEFERRED_CLAUSES_NOT_ASSUMED_EFFECTIVE']['locator']['normalizedText']
        for token in ['第3.6.5条第二款和第三款','第3.7.1条至第3.7.10条','第4.5.1条至第4.5.4条','由本所另行通知']:
            self.assertIn(token,text)
        self.assertIn('2026年7月6日起施行',rows['NEW_RULE_EFFECTIVE_DATE_WITH_EXCEPTIONS']['locator']['normalizedText'])
        self.assertIn('2021年11月15日起施行',rows['INITIAL_RULE_EFFECTIVE_DATE']['locator']['normalizedText'])
        self.assertEqual(replay.derive()['releaseEvents'],[])


if __name__=='__main__':unittest.main()
