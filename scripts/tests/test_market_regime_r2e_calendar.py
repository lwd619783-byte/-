from copy import deepcopy
import unittest

from scripts.market_regime import r2e_calendar as cal


class CalendarEvidenceTests(unittest.TestCase):
    def test_committed_full_replay_and_unknown_denominators(self):
        result = cal.build()
        self.assertEqual(result, cal.strict_json((cal.ROOT / cal.REPORT).read_bytes()))
        self.assertEqual([r['targetCount'] for r in result['eraDenominators']], [None, None])
        self.assertEqual(result['requestCount'], 104)
        self.assertEqual(len(result['officialNotices']), 83)
        self.assertIsNone(result['dailyGrid'])

    def test_bse_not_required_in_first_era(self):
        eras = cal.build()['eraDenominators']
        self.assertEqual(eras[0]['requiredExchanges'], ['SSE', 'SZSE'])
        self.assertEqual(set(eras[1]['requiredExchanges']), {'SSE', 'SZSE', 'BSE'})

    def journal(self):
        return deepcopy(cal.strict_json((cal.ROOT / cal.JOURNAL).read_bytes()))

    def reject(self, obj):
        with self.assertRaises(ValueError):
            cal.replay(cal.seal({k: v for k, v in obj.items() if k != 'contentSha256'}))

    def test_resealed_wrong_source_rejected(self):
        obj = self.journal()
        obj['attempts'][0]['exchange'] = 'SZSE'
        self.reject(obj)

    def test_redirect_to_third_party_rejected(self):
        obj = self.journal()
        obj['attempts'][0]['finalUrl'] = 'https://example.invalid/calendar'
        self.reject(obj)

    def test_naive_retrieval_time_rejected(self):
        obj = self.journal()
        obj['attempts'][0]['attemptedAt'] = '2026-09-10T00:00:00'
        self.reject(obj)

    def test_http_failure_cannot_be_success(self):
        obj = self.journal()
        obj['attempts'][3]['outcome'] = 'RETRIEVED'
        self.reject(obj)

    def test_fake_links_and_bytes_rejected(self):
        for key, value in [('links', ['https://www.sse.com.cn/fake']), ('storedBytes', dict(localPath='../escape', sha256='0'*64, byteSize=1))]:
            obj = self.journal()
            obj['attempts'][0][key] = value
            self.reject(obj)

    def test_future_expansion_cannot_change_fixed_cutoff(self):
        result = cal.build()
        self.assertEqual(result['datasetAsOf'], '2026-09-07T08:00:00+08:00')
        self.assertEqual(result['eraDenominators'][1]['end'], '2026-09-04')


if __name__ == '__main__':
    unittest.main()
