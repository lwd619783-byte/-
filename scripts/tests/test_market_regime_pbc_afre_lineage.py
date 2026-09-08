"""AFRE-2 protocol integration through the unchanged R2-A validator/selector.

Independent synthetic complete responses use reviewed representative values.
Real excerpt parser tests and full archived dataset validation are separate;
excerpt bytes are never relabelled RAW_SOURCE or stripped of their fixture tag.
"""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from scripts.market_regime.hashing import sha256_bytes
from scripts.market_regime.historical_validator import select_vintage, validate_dataset
from scripts.market_regime.pbc_dataset import assemble, AFRE
from scripts.market_regime.pbc_parser import parse_pbc_release
from scripts.tests.test_market_regime_pbc_dataset import small_plan, DEFS, GENERATED

FIXTURES = Path(__file__).parent / 'fixtures/market_regime'
NAMES = ['pbc-r2b-afre-2017-12-original.html', 'pbc-r2b-afre-2018-07-tables.html',
         'pbc-r2b-afre-2018-09-tables.html', 'pbc-r2b-afre-2019-09-tables.html',
         'pbc-r2b-afre-2019-12-attachments.html']

MODELS = [
    ('2017年社会融资规模存量统计数据报告','2018-01-12 16:00:00',
     '2017年末社会融资规模存量为174.64万亿元，同比增长12%。','当期数据为初步统计数，文内同比为可比口径。',None),
    ('2018年7月社会融资规模存量统计数据报告','2018-08-13 19:25:12',
     '7月末社会融资规模存量为187.45万亿元，同比增长10.3%。',
     '自2018年7月起，存款类金融机构资产支持证券和贷款核销纳入社会融资规模存量。文内同比为可比口径。',('1773872','12.5')),
    ('2018年9月社会融资规模存量统计数据报告','2018-10-17 16:00:01',
     '9月末社会融资规模存量为197.3万亿元，同比增长10.6%。',
     '自2018年9月起，地方政府专项债券纳入社会融资规模存量。文内同比为可比口径。',('1828692','13.4')),
    ('2019年9月社会融资规模存量统计数据报告','2019-10-15 16:30:02',
     '9月末社会融资规模存量为219.04万亿元，同比增长10.8%。',
     '自2019年9月起，交易所企业资产支持证券纳入社会融资规模存量，2017年以来可比口径见表。文内同比为可比口径。',('1832379','13.5')),
    ('2019年社会融资规模存量统计数据报告','2020-01-16 15:00:30',
     '2019年末社会融资规模存量为251.31万亿元，同比增长10.7%。',
     '自2019年12月起，国债、地方政府一般债券纳入社会融资规模存量，追溯到2017年1月份。文内同比为可比口径。',None),
]


def protocol_html(name):
    title,clock,prose,scope,pair=MODELS[NAMES.index(name)]
    html=f'<html><title>{title}</title><body><h1>{title}</h1><p>文章来源： {clock}</p><p>{prose}</p><p>注：{scope}</p>'
    if pair:
        html+=('<p>表1：完善后2017年以来社会融资规模存量可比口径</p><table>'
            '<tr><td>月份</td><td>2017年12月</td></tr>'
            f'<tr><td>存量（亿元）</td><td>{pair[0]}</td></tr>'
            f'<tr><td>存量增速（%）</td><td>{pair[1]}</td></tr></table>')
    if name==NAMES[4]:
        html+='<a href="https://www.pbc.gov.cn/unsupported.xls">社会融资规模存量统计表</a>'
    return html+'</body></html>'


def fixture_inputs(root, names=NAMES, mutate=None):
    metadata = {p['fixture']:p for p in json.loads(
        (FIXTURES/'pbc-r2b-afre-tables-fixtures.provenance.json').read_text(encoding='utf-8'))}
    records, attempts, entries = [], [], []
    (root/'raw').mkdir()
    for n,name in enumerate(names):
        html = protocol_html(name)
        url = metadata[name]['sourceUrl']
        if mutate:
            html,url = mutate(name,html,url)
        parsed = parse_pbc_release(html,url,source_id=AFRE)
        entry = f'<a href="{url}">{parsed["title"]}</a>{parsed["publicationDate"]}'
        entries.append(entry)
        body = html.encode('utf-8')
        local = f'raw/{n}.html'; (root/local).write_bytes(body)
        a = dict(attemptId=f'get-{n}',sourceId=AFRE,requestUrl=url,finalUrl=url,attemptedAt=GENERATED,
            httpStatus=200,transportError=None,storedBytes=dict(localPath=local,sha256=sha256_bytes(body),byteSize=len(body)),
            outcome='SUCCESS',reasonCode='OFFLINE_PROTOCOL_MODEL',candidateReleaseEventIds=[],
            handlingBasis='Synthetic complete response in temporary integration model; excluded from live journal',
            verifiedAt=None,acquisitionAttemptId=None)
        attempts.append(a)
        records.append(dict(acquisition=a,contentType='text/html',role='RELEASE',
            indexLinks=[dict(attemptId='index',text=entry)]))
    body = ('<html><title>Controlled dated archive</title>'+''.join(entries)+'</html>').encode('utf-8')
    (root/'raw/index.html').write_bytes(body)
    a = copy.deepcopy(attempts[0])
    a.update(attemptId='index',requestUrl='https://www.pbc.gov.cn/archive.html',finalUrl='https://www.pbc.gov.cn/archive.html',
        storedBytes=dict(localPath='raw/index.html',sha256=sha256_bytes(body),byteSize=len(body)))
    attempts.append(a); records.append(dict(acquisition=a,contentType='text/html',role='INDEX'))
    return records,attempts


class AfreLineageIntegrationTests(unittest.TestCase):
    def build(self, *, names=NAMES, mutate=None, start='2017-12', end='2017-12', definitions=None):
        temp = tempfile.TemporaryDirectory(); self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        records,attempts = fixture_inputs(root,names,mutate)
        plan = small_plan(AFRE,start,end)
        bundle,dataset,diagnostics = assemble(plan,definitions or DEFS,records,attempts,
            root=root,generated_at=GENERATED)
        return root,plan,bundle,dataset,diagnostics

    def select(self, built, metric, cutoff):
        root,plan,bundle,dataset,_ = built
        cell = next(c for c in dataset['coverageLedger'] if c['metricId']==metric)
        return select_vintage(dataset,bundle['catalog'],plans=[plan],artifact_root=root,
            cell_id=cell['cellId'],cutoff=cutoff)

    def test_afre_2_table_protocol_selects_successive_versions_at_exact_cutoffs(self):
        built = self.build()
        _,_,bundle,dataset,_ = built
        before = self.select(built,'MACRO_AFRE_STOCK_BALANCE','2018-01-12T15:59:59+08:00')
        self.assertIsNone(before)
        checkpoints = [
            ('2018-01-12T16:00:00+08:00',174.64,12.0,0),
            ('2018-08-13T19:25:11+08:00',174.64,12.0,0),
            ('2018-08-13T19:25:12+08:00',177.3872,12.5,1),
            ('2018-10-17T16:00:00+08:00',177.3872,12.5,1),
            ('2018-10-17T16:00:01+08:00',182.8692,13.4,2),
            ('2019-10-15T16:30:01+08:00',182.8692,13.4,2),
            ('2019-10-15T16:30:02+08:00',183.2379,13.5,3),
            ('2020-01-16T15:00:30+08:00',183.2379,13.5,3),
        ]
        for cutoff,balance,yoy,sequence in checkpoints:
            for metric,value in [('MACRO_AFRE_STOCK_BALANCE',balance),('MACRO_AFRE_STOCK_YOY',yoy)]:
                with self.subTest(cutoff=cutoff,metric=metric):
                    selected = self.select(built,metric,cutoff)
                    self.assertAlmostEqual(selected['value'],value)
                    self.assertEqual(selected['revisionSequence'],sequence)
        for metric in ('MACRO_AFRE_STOCK_BALANCE','MACRO_AFRE_STOCK_YOY'):
            chain = sorted((o for o in bundle['catalog']['observations'] if o['metricId']==metric),key=lambda o:o['revisionSequence'])
            self.assertEqual(len({o['sourceDefinitionId'] for o in chain}),4)
            self.assertIsNone(chain[0]['supersedesObservationId'])
            self.assertEqual([o['supersedesObservationId'] for o in chain[1:]],[o['observationId'] for o in chain[:-1]])
        self.assertFalse(dataset['conflicts'])
        self.assertTrue(all(e['revisionEvidence'] for e in dataset['releaseEvents'] if e['releaseKind']=='BACKCAST'))
        for summary in dataset['manifest']['coverageSummary']:
            self.assertEqual(summary['counts']['targetCount'],1)
            self.assertEqual(summary['counts']['availableCount'],1)
            self.assertEqual(summary['counts']['provenFirstReleaseCount'],1)
            self.assertEqual(summary['counts']['vintageCount'],4)
            self.assertEqual(summary['datasetCoverageStatus'],'PARTIAL')

    def test_backcasts_cannot_fill_missing_first_release_in_this_repair(self):
        _,_,bundle,dataset,diagnostics = self.build(names=NAMES[1:])
        self.assertFalse(bundle['catalog']['observations'])
        self.assertEqual(len(dataset['fieldExtractions']),6)
        self.assertTrue(any(d['reason']=='AFRE_BACKCAST_FIRST_RELEASE_LINEAGE_GAP' for d in diagnostics))
        self.assertTrue(all(s['counts']['availableCount']==0 and s['counts']['vintageCount']==0
            for s in dataset['manifest']['coverageSummary']))

    def test_backcast_cannot_repair_unproved_original_comparable_yoy(self):
        def without_basis(name,html,url):
            if name==NAMES[0]:
                html=html.replace('可比口径','未注明口径')
            return html,url
        _,_,bundle,dataset,_ = self.build(mutate=without_basis)
        self.assertFalse(any(o['metricId']=='MACRO_AFRE_STOCK_YOY' for o in bundle['catalog']['observations']))
        cell=next(c for c in dataset['coverageLedger'] if c['metricId']=='MACRO_AFRE_STOCK_YOY')
        self.assertEqual(cell['status'],'DEFINITION_UNRESOLVED')
        self.assertEqual(len([o for o in bundle['catalog']['observations'] if o['metricId']=='MACRO_AFRE_STOCK_BALANCE']),4)

    def test_unknown_url_or_changed_publication_cannot_use_audited_backcast_definition(self):
        for change_url in (True,False):
            def mutate(name,html,url):
                if name==NAMES[1]:
                    if change_url: url='https://www.pbc.gov.cn/unproved-republication.html'
                    else: html=html.replace('2018-08-13','2018-08-14')
                return html,url
            built=self.build(names=NAMES[:2],mutate=mutate)
            self.assertEqual(len(built[2]['catalog']['observations']),2)
            self.assertTrue(any(d['reason']=='DEFINITION_UNRESOLVED' for d in built[4]))

    def test_wrong_period_applicability_never_reuses_old_definition(self):
        definitions=copy.deepcopy(DEFS)
        for d in definitions:
            if '2018-07-backcast' in d['sourceDefinitionId']: d['effectiveFrom']='2018-01-01'
        built=self.build(names=NAMES[:2],definitions=definitions)
        self.assertEqual(len(built[2]['catalog']['observations']),2)
        self.assertTrue(any(d['reason']=='DEFINITION_UNRESOLVED' for d in built[4]))

    def test_validator_rejects_early_clock_and_broken_multistep_lineage(self):
        root,plan,bundle,dataset,_=self.build()
        changed=copy.deepcopy(dataset)
        event=next(e for e in changed['releaseEvents'] if e['releaseKind']=='BACKCAST')
        event['releaseAvailableAt']='2017-12-31T00:00:00+08:00'
        self.assertTrue(validate_dataset(changed,bundle['catalog'],plans=[plan],artifact_root=root))
        catalog=copy.deepcopy(bundle['catalog'])
        next(o for o in catalog['observations'] if o['revisionSequence']==3)['revisionSequence']=1
        self.assertTrue(validate_dataset(dataset,catalog,plans=[plan],artifact_root=root))

    def test_current_rounded_prose_and_attachment_only_release_are_not_backcasts(self):
        built=self.build(names=NAMES[1:2],start='2018-07',end='2018-07')
        self.assertEqual({o['metricId']:o['value'] for o in built[2]['catalog']['observations']},
            {'MACRO_AFRE_STOCK_BALANCE':187.45,'MACRO_AFRE_STOCK_YOY':10.3})
        december=self.build(names=NAMES[4:],start='2019-12',end='2019-12')
        self.assertEqual(len(december[2]['catalog']['observations']),2)
        self.assertTrue(any(d['reason'].startswith('AFRE_BACKCAST_ATTACHMENT_UNSUPPORTED') for d in december[4]))
        self.assertFalse(any(e['releaseKind']=='BACKCAST' for e in december[3]['releaseEvents']))


if __name__=='__main__':
    unittest.main()
