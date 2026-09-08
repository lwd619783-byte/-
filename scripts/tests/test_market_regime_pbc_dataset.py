"""PBC adapter integration: synthetic complete responses live only in temp dirs."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from scripts.market_regime.hashing import sha256_bytes
from scripts.market_regime.historical import plan_identity, target_grid
from scripts.market_regime.pbc_dataset import assemble, container_evidence, M2, AFRE
from scripts.market_regime.time_semantics import is_observation_eligible

ROOT=Path(__file__).resolve().parents[2]
PLAN=json.loads((ROOT/'config/market-regime/pbc-historical-plan.v1.json').read_text(encoding='utf-8'))[0]
DEFS=json.loads((ROOT/'config/market-regime/pbc-historical-definitions.v1.json').read_text(encoding='utf-8'))
GENERATED='2026-09-08T12:00:00Z'


def inputs(root, source, reports):
    """reports contain (title, official stamp, prose, indexed flag). No network."""
    records,attempts=[],[]
    (root/'raw').mkdir(exist_ok=True)
    entries=[]
    for n,(title,stamp,prose,indexed) in enumerate(reports):
        url=f'https://www.pbc.gov.cn/report-{n}.html'
        entry=f'<a href="{url}">{title}</a>{stamp[:10]}'
        if indexed: entries.append(entry)
        text=f'<html><title>{title}</title><body><h1>{title}</h1><p>文章来源： {stamp}</p><p>{prose}</p></body></html>'
        body=text.encode()
        local=f'raw/response-{n}.html'; (root/'raw').mkdir(exist_ok=True); (root/local).write_bytes(body)
        a=dict(attemptId=f'get-{n}',sourceId=source,requestUrl=url,finalUrl=url,attemptedAt=GENERATED,
            httpStatus=200,transportError=None,storedBytes=dict(localPath=local,sha256=sha256_bytes(body),byteSize=len(body)),
            outcome='SUCCESS',reasonCode='OFFLINE_PROTOCOL_MODEL',candidateReleaseEventIds=[],handlingBasis='Temporary protocol model, no network',
            verifiedAt=None,acquisitionAttemptId=None)
        attempts.append(a)
        records.append(dict(acquisition=a,contentType='text/html',role='RELEASE',
            indexLinks=[dict(attemptId='index',text=entry)] if indexed else []))
    body=('<html><title>Official archive</title>'+''.join(entries)+'</html>').encode()
    local='raw/index.html'; (root/local).write_bytes(body)
    a=dict(attemptId='index',sourceId=source,requestUrl='https://www.pbc.gov.cn/archive.html',finalUrl='https://www.pbc.gov.cn/archive.html',
        attemptedAt=GENERATED,httpStatus=200,transportError=None,storedBytes=dict(localPath=local,sha256=sha256_bytes(body),byteSize=len(body)),
        outcome='SUCCESS',reasonCode='OFFLINE_PROTOCOL_MODEL',candidateReleaseEventIds=[],handlingBasis='Temporary protocol model, no network',verifiedAt=None,acquisitionAttemptId=None)
    attempts.append(a);records.insert(0,dict(acquisition=a,contentType='text/html',role='INDEX'))
    return records,attempts


def small_plan(source,start,end):
    p=copy.deepcopy(PLAN)
    p['targetWindows']=[w for w in p['targetWindows'] if w['sourceId']==source and w['start']<=end and w['end']>=start]
    for w in p['targetWindows']:
        w['start']=max(start,w['start']);w['end']=min(end,w['end'])
    p['planId']=plan_identity(p)
    return p


class PbcDatasetTests(unittest.TestCase):
    def run_reports(self,source,reports,start,end):
        temporary=tempfile.TemporaryDirectory();self.addCleanup(temporary.cleanup)
        root=Path(temporary.name);records,attempts=inputs(root,source,reports)
        return assemble(small_plan(source,start,end),DEFS,records,attempts,root=root,generated_at=GENERATED)

    def test_frozen_denominators_and_r1_definitions_unchanged(self):
        grid=target_grid(PLAN)
        for metric,count in [('MACRO_M2_YOY',260),('MACRO_M2_BALANCE',260),('MACRO_AFRE_STOCK_YOY',296),('MACRO_AFRE_STOCK_BALANCE',296)]:
            self.assertEqual(sum(c['metricId']==metric for c in grid),count)
        r1=json.loads((ROOT/'research-data/market-regime/source-catalog/catalog-seed.sample.v1.json').read_text(encoding='utf-8'))
        for d in r1['sourceDefinitions']:
            if d['sourceId'] in (M2,AFRE):self.assertIn(d,DEFS)

    def test_dated_initial_report_and_index_prove_first_not_crawl_order(self):
        reports=[('2015年1月金融统计数据报告','2015-02-13 16:58:58','1月末，广义货币(M2)余额124.27万亿元，同比增长10.8%。当期数据为初步数。',True)]
        bundle,dataset,_=self.run_reports(M2,reports,'2015-01','2015-02')
        self.assertEqual(len(bundle['catalog']['observations']),2)
        self.assertEqual(sum(c['status']=='AVAILABLE' for c in dataset['coverageLedger']),2)
        self.assertEqual(sum(c['status']=='MISSING' for c in dataset['coverageLedger']),2)
        self.assertTrue(all(s['inventoryStatus']=='PARTIAL' for s in dataset['manifest']['coverageSummary']))
        reports[0]=(*reports[0][:3],False)
        _,unproven,_=self.run_reports(M2,reports,'2015-01','2015-01')
        self.assertTrue(all(c['status']=='FIRST_RELEASE_UNPROVEN' for c in unproven['coverageLedger']))

    def test_m2_3_unproved_revised_table_conflicts_without_overwriting(self):
        reports=[('2015年1月金融统计数据报告','2015-02-13 16:58:58','1月末，广义货币(M2)余额124.27万亿元，同比增长10.8%。',True),
            ('2015年1月金融统计数据报告修订','2015-03-15 10:00:00','1月末，广义货币(M2)余额125万亿元，同比增长11%。',True)]
        bundle,dataset,_=self.run_reports(M2,reports,'2015-01','2015-01')
        self.assertEqual(len(dataset['releaseEvents']),2)
        self.assertEqual(len(dataset['fieldExtractions']),4)
        self.assertTrue(all(c['status']=='UNRESOLVED_RELEASE_CONFLICT' for c in dataset['coverageLedger']))
        self.assertFalse(bundle['catalog']['observations'])
        self.assertEqual(len(dataset['conflicts']),2)

    def test_legacy_bulletin_uses_matching_dated_index_despite_heading_spaces(self):
        reports=[('广义货币增速减缓 人民币汇率灵活性增强','2006-09-14 15:02:00','8月末，广义货币(M2)余额32万亿元，同比增长17%。',True)]
        _,dataset,_=self.run_reports(M2,reports,'2006-08','2006-08')
        self.assertTrue(all(c['status']=='AVAILABLE' for c in dataset['coverageLedger']))

    def test_m2_2018_backcast_and_equal_mirror_keep_authoritative_chain(self):
        reports=[('2017年金融统计数据报告','2018-01-12 10:00:00','2017年末，广义货币(M2)余额167.68万亿元，同比增长8.2%。',True),
            ('2017年金融统计数据报告','2018-01-12 10:00:00','2017年末，广义货币(M2)余额167.68万亿元，同比增长8.2%。',False),
            ('2018年1月金融统计数据报告','2018-02-12 17:00:05','1月末，广义货币(M2)余额172.08万亿元，同比增长8.6%。注：2018年1月完善货币市场基金统计方法，完善后本期M2余额同比增长8.6%，2017年末M2余额同比增长8.1%。',True)]
        bundle,dataset,_=self.run_reports(M2,reports,'2017-12','2018-01')
        observations=[o for o in bundle['catalog']['observations'] if o['valueDate']=='2017-12' and o['metricId']=='MACRO_M2_YOY']
        self.assertEqual(sorted(o['value'] for o in observations),[8.1,8.2])
        backcast=next(o for o in observations if o['value']==8.1)
        self.assertFalse(is_observation_eligible(backcast,'2018-02-12T08:00:00+08:00'))
        self.assertTrue(is_observation_eligible(backcast,'2018-02-19T08:00:00+08:00'))
        self.assertIsNotNone(backcast['supersedesObservationId'])
        self.assertFalse(dataset['conflicts'])

    def test_afre_1_backcast_at_actual_event_and_no_interpolation(self):
        reports=[('2014年社会融资规模存量统计数据报告','2015-02-10 16:31:12','初步统计，2014年末社会融资规模存量为122.86万亿元，同比增长14.3%。注：当期数据为初步统计数，同比增速为可比口径数据。',True)]
        bundle,dataset,_=self.run_reports(AFRE,reports,'2014-11','2014-12')
        self.assertEqual(len(bundle['catalog']['observations']),2)
        for o in bundle['catalog']['observations']:
            self.assertFalse(is_observation_eligible(o,'2015-02-09T08:00:00+08:00'))
            self.assertTrue(is_observation_eligible(o,'2015-02-16T08:00:00+08:00'))
            self.assertEqual(o['qualityStatus'],'BACKCAST')
        self.assertEqual(sum(c['status']=='MISSING' for c in dataset['coverageLedger']),2)

    def test_afre_3_flow_and_unproved_comparability_cannot_fill_stock(self):
        reports=[('2015年一季度社会融资规模存量统计数据报告','2015-04-15 10:00:00','3月末社会融资规模存量为127万亿元，同比增长13%。',True)]
        bundle,dataset,_=self.run_reports(AFRE,reports,'2015-01','2015-03')
        self.assertEqual(len(bundle['catalog']['observations']),1)
        self.assertEqual(sum(c['status']=='MISSING' for c in dataset['coverageLedger']),4)
        self.assertEqual(sum(c['status']=='DEFINITION_UNRESOLVED' for c in dataset['coverageLedger']),1)
        reports=[('2015年1月社会融资规模增量统计数据报告','2015-02-13 10:00:00','1月社会融资规模增量为2.05万亿元。',True)]
        bundle,dataset,_=self.run_reports(AFRE,reports,'2015-01','2015-01')
        self.assertFalse(bundle['catalog']['observations'])
        self.assertTrue(all(c['status']=='MISSING' for c in dataset['coverageLedger']))

    def test_literal_decrease_cannot_bypass_positive_r2a_unit_factor(self):
        reports=[('2015年1月金融统计数据报告','2015-02-13 10:00:00','1月末，广义货币(M2)余额124.27万亿元，同比下降8.6%。',True)]
        bundle,_,diagnostics=self.run_reports(M2,reports,'2015-01','2015-01')
        self.assertFalse(any(o['metricId']=='MACRO_M2_YOY' for o in bundle['catalog']['observations']))
        self.assertTrue(any(d['reason']=='SIGNED_LANGUAGE_CONVERSION_UNSUPPORTED' for d in diagnostics))

    def test_unproved_m2_backcast_method_never_uses_old_period_definition(self):
        reports=[('2023年1月金融统计数据报告','2023-02-10 10:00:00','按可比口径回溯，2021年末M2余额240万亿元，同比增长10%。',True)]
        bundle,dataset,_=self.run_reports(M2,reports,'2021-12','2021-12')
        self.assertFalse(bundle['catalog']['observations'])
        self.assertTrue(all(c['status']=='DEFINITION_UNRESOLVED' for c in dataset['coverageLedger']))

    def test_same_inputs_reordered_are_deterministic_and_generated_time_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            records,attempts=inputs(root,M2,[('2015年1月金融统计数据报告','2015-02-13 10:00:00','1月末M2余额124.27万亿元，同比增长10.8%。',True)])
            p=small_plan(M2,'2015-01','2015-01')
            _,a,_=assemble(p,DEFS,records,attempts,root=root,generated_at=GENERATED)
            _,b,_=assemble(p,DEFS,list(reversed(records)),list(reversed(attempts)),root=root,generated_at=GENERATED)
            self.assertEqual(a,b)
            _,c,_=assemble(p,DEFS,records,attempts,root=root,generated_at='2026-09-09T12:00:00Z')
            self.assertEqual(a['manifest']['datasetContentSha256'],c['manifest']['datasetContentSha256'])

    def test_binary_inventory_signature_does_not_create_field_extraction(self):
        self.assertEqual(container_evidence(b'%PDF-1.7\n\xff','application/pdf'),'%PDF-')
        with self.assertRaises(ValueError):container_evidence(b'wrong content','application/pdf')
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);records,attempts=inputs(root,M2,[])
            body=b'<html>'+ '货币供应量'.encode('gb18030')+b'</html>'
            local='raw/table.htm';(root/local).write_bytes(body)
            a=copy.deepcopy(attempts[0]);a.update(attemptId='table',requestUrl='https://www.pbc.gov.cn/table.htm',finalUrl='https://www.pbc.gov.cn/table.htm',
                storedBytes=dict(localPath=local,byteSize=len(body),sha256=sha256_bytes(body)))
            cache=copy.deepcopy(a);cache.update(attemptId='cache-table',httpStatus=None,outcome='CACHE_VERIFIED',verifiedAt=GENERATED,acquisitionAttemptId='table')
            records.append(dict(acquisition=a,role='RELEASE',contentType='text/html'))
            attempts.extend([a,cache])
            bundle,dataset,_=assemble(small_plan(M2,'2015-01','2015-01'),DEFS,records,attempts,root=root,generated_at=GENERATED)
            self.assertFalse(bundle['catalog']['observations'])
            self.assertFalse(dataset['fieldExtractions'])
            self.assertEqual(len(dataset['evidenceArtifacts']),2)


if __name__=='__main__':unittest.main()
