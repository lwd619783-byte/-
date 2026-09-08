"""Review blockers: all bytes, sources and Office callbacks here are synthetic."""
import copy
import json
import unittest
from contextlib import redirect_stdout
from io import BytesIO, StringIO
from unittest.mock import patch
from zipfile import ZipFile

from scripts.market_regime.historical import evidence_artifact_identity, plan_identity
from scripts.market_regime.historical_cli import main
from scripts.market_regime.historical_locators import replay_structured_locator
from scripts.market_regime.historical_validator import validate_locator_contract
from scripts.market_regime.hashing import sha256_bytes
from scripts.tests.test_market_regime_historical import FixtureCase
from scripts.tests.market_regime_historical_fixture import GENERATED


def office_contract(fmt):
    part = None
    if fmt == 'XLS_OLE':
        body = bytes.fromhex('d0cf11e0a1b11ae1') + b'\0' * 504
        mime = 'application/vnd.ms-excel'
    else:
        stream = BytesIO()
        part = 'xl/worksheets/sheet1.xml' if fmt == 'XLSX' else 'word/document.xml'
        with ZipFile(stream, 'w') as archive:
            archive.writestr('[Content_Types].xml', '<Types/>')
            if fmt == 'XLSX': archive.writestr('xl/workbook.xml', '<workbook/>')
            archive.writestr(part, '<controlled-contract-only/>')
        body = stream.getvalue()
        mime = ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if fmt == 'XLSX'
                else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    a = dict(artifactId='office-contract',sha256=sha256_bytes(body),contentType=mime)
    loc = dict(kind='STRUCTURED_CELL',artifactId=a['artifactId'],artifactSha256=a['sha256'],format=fmt,
               sheet=None if fmt=='DOCX_TABLE' else 'Statistics',table=2 if fmt=='DOCX_TABLE' else None,
               row=3,column=2,cell=None if fmt=='DOCX_TABLE' else 'B3',rowSpan=1,columnSpan=2,part=part,
               parserVersion='controlled-office-v1',text='M2 % 10.0')
    return a, body, loc


class StructuredLocatorTests(unittest.TestCase):
    def test_xls_xlsx_docx_addresses_machine_validate_without_office_parser(self):
        for fmt in ('XLS_OLE','XLSX','DOCX_TABLE'):
            with self.subTest(fmt=fmt):
                a, body, loc = office_contract(fmt)
                validate_locator_contract(loc,a,body)
                with self.assertRaisesRegex(ValueError,'REPLAYER_REQUIRED'):
                    replay_structured_locator(loc,body,{})

    def test_coordinate_address_span_and_format_adversaries(self):
        mutations=[('row',0),('column',0),('cell','C3'),('sheet',None),('table',1),
                   ('rowSpan',0),('columnSpan',16384),('row',1048577),('format','CSV'),
                   ('part','../xl/worksheets/sheet1.xml'),('part','xl/worksheets/absent.xml'),
                   ('artifactSha256','0'*64),('extra','invented')]
        for key,value in mutations:
            with self.subTest(key=key,value=value):
                a,body,loc=office_contract('XLSX'); loc[key]=value
                with self.assertRaises(ValueError): validate_locator_contract(loc,a,body)
        for key,value in [('table',None),('sheet','Sheet1'),('cell','B3'),('part','word/header1.xml')]:
            a,body,loc=office_contract('DOCX_TABLE'); loc[key]=value
            with self.assertRaises(ValueError): validate_locator_contract(loc,a,body)
        a,body,loc=office_contract('XLS_OLE'); loc.update(cell='IW3',column=257)
        with self.assertRaisesRegex(ValueError,'bounds'): validate_locator_contract(loc,a,body)

    def test_magic_mime_digest_and_mixed_locator_forms_rejected(self):
        for fmt in ('XLS_OLE','XLSX','DOCX_TABLE'):
            a,body,loc=office_contract(fmt)
            bad=b'not office'; a['sha256']=sha256_bytes(bad); loc['artifactSha256']=a['sha256']
            with self.assertRaises(ValueError): validate_locator_contract(loc,a,bad)
            a,body,loc=office_contract(fmt); a['contentType']='text/html'
            with self.assertRaisesRegex(ValueError,'MIME'): validate_locator_contract(loc,a,body)
        a,body,loc=office_contract('XLSX'); loc['byteOffset']=0
        with self.assertRaises(ValueError): validate_locator_contract(loc,a,body)

    def test_versioned_replayer_required_and_text_cannot_self_attest(self):
        a,body,loc=office_contract('XLSX')
        class ControlledReplayer:
            parser_version='controlled-office-v1'
            def replay(self, actual, address):
                if actual!=body or (address['sheet'],address['cell'],address['rowSpan'],address['columnSpan'])!=('Statistics','B3',1,2):
                    raise ValueError('unrecognized controlled coordinates')
                return 'M2 % 10.0'
        replayers={'controlled-office-v1':ControlledReplayer()}
        validate_locator_contract(loc,a,body)
        replay_structured_locator(loc,body,replayers)
        loc['text']='made-up value'
        with self.assertRaisesRegex(ValueError,'text mismatch'): replay_structured_locator(loc,body,replayers)
        loc['parserVersion']='unapproved-parser-v2'
        with self.assertRaisesRegex(ValueError,'REPLAYER_REQUIRED'): replay_structured_locator(loc,body,replayers)


class EvidenceFixtureCase(FixtureCase):
    def evidence(self, role='ARCHIVE_INDEX', source='TEST_M2'):
        return next(a for a in self.seed['evidenceArtifacts'] if a['evidenceRole']==role and a['sourceId']==source)

    def eloc(self, a, text):
        body=(self.root/a['localPath']).read_bytes()
        return dict(artifactId=a['artifactId'],byteOffset=body.index(text.encode()),byteLength=len(text.encode()),text=text)

    def replan(self):
        self.plans[0]['planId']=plan_identity(self.plans[0]); self.seed['planId']=self.plans[0]['planId']

    def rewrite_evidence(self, a, *, body=None, changes=None):
        old=a['artifactId']; old_body=(self.root/a['localPath']).read_bytes()
        a.update(changes or {})
        if body is not None:
            (self.root/a['localPath']).write_bytes(body)
            a.update(sha256=sha256_bytes(body),byteSize=len(body))
        else: body=old_body
        new=evidence_artifact_identity(a)
        def rewrite(v):
            if isinstance(v,dict):
                if v.get('artifactId')==old and 'byteOffset' in v:
                    if v['text']==old_body.decode(): v['text']=body.decode()
                    if v['text'].encode() in body: v['byteOffset']=body.index(v['text'].encode())
                    v['byteLength']=len(v['text'].encode())
                if v.get('localPath')==a['localPath'] and 'sha256' in v:
                    v.update(sha256=a['sha256'],byteSize=a['byteSize'])
                return {k:rewrite(x) for k,x in v.items()}
            if isinstance(v,list): return [rewrite(x) for x in v]
            return new if v==old else v
        self.bundle=rewrite(self.bundle); self.plans=rewrite(self.plans)
        self.replan()
        return next(a for a in self.seed['evidenceArtifacts'] if a['artifactId']==new)


class EvidenceGraphTests(EvidenceFixtureCase):
    def test_independent_index_calendar_and_inventory_need_no_release_clock(self):
        d=self.build()
        self.assertEqual(len(d['evidenceArtifacts']),3)
        for a in d['evidenceArtifacts']:
            self.assertNotIn('releaseAvailableAt',a)
            self.assertNotIn('publicationDateTime',a)
            b=next(b for b in d['artifactBindings'] if b['artifactId']==a['artifactId'])
            self.assertIsNone(b['releaseEventId'])
        a=self.evidence('CALENDAR','TEST_EXCHANGE')
        original=next(r for r in self.seed['retrievalAttempts'] if r['finalUrl']==a['sourceUrl'])
        original['attemptedAt']='2026-08-01T00:00:00Z'
        self.rewrite_evidence(a,changes={'fetchedAt':'2026-08-01T00:00:00Z'})
        self.assertEqual(self.build()['manifest']['validationStatus'],'PASS')
        # An independently retained inventory does not need an invented release.
        self.rewrite_evidence(self.evidence('CALENDAR','TEST_EXCHANGE'),changes={'evidenceRole':'INVENTORY'})
        self.assertEqual(self.build()['manifest']['validationStatus'],'PASS')

    def test_index_publication_fallback_binds_same_landing_entry(self):
        e=self.seed['releaseEvents'][0]
        e['publicationEvidence']=copy.deepcopy(e['indexEvidence'][0]['locator'])
        self.assertEqual(self.build()['manifest']['validationStatus'],'PASS')
        e['publicationEvidence']=copy.deepcopy(self.seed['releaseEvents'][1]['indexEvidence'][0]['locator'])
        self.assert_rejected('same landing entry')

    def test_missing_or_cross_source_index_link_and_clock_reuse_rejected(self):
        e=self.seed['releaseEvents'][0]; e['publicationEvidence']=copy.deepcopy(e['indexEvidence'][0]['locator'])
        e['indexEvidence']=[]
        self.assert_rejected('same landing entry')
        self.bundle,self.plans=__import__('scripts.tests.market_regime_historical_fixture',fromlist=['make_fixture']).make_fixture(self.root,historical=True)
        e=self.seed['releaseEvents'][0]
        e['indexEvidence']=copy.deepcopy(self.seed['releaseEvents'][-1]['indexEvidence'])
        self.assert_rejected('locator source mismatch')

    def test_index_publication_cannot_use_whole_page_with_multiple_release_entries(self):
        e=self.seed['releaseEvents'][0]; a=self.evidence()
        loc=self.eloc(a,(self.root/a['localPath']).read_text(encoding='utf-8'))
        e['indexEvidence'][0]['locator']=loc
        e['publicationEvidence']=copy.deepcopy(loc)
        self.assert_rejected('one landing entry')

    def test_independent_evidence_cannot_replace_release_landing(self):
        e=self.seed['releaseEvents'][0]; e['landingArtifactId']=self.evidence()['artifactId']
        self.assert_rejected('release artifact reference')
        self.bundle,self.plans=__import__('scripts.tests.market_regime_historical_fixture',fromlist=['make_fixture']).make_fixture(self.root,historical=True)
        b=next(b for b in self.seed['artifactBindings'] if b['releaseEventId'] is None)
        b['releaseEventId']=self.seed['releaseEvents'][0]['releaseEventId']
        self.assert_rejected('independent evidence must not invent')

    def test_index_to_landing_to_attachment_graph_replays(self):
        # Attach another controlled HTML response, without implementing any Office parser.
        from scripts.market_regime.historical import artifact_identity
        from scripts.tests.test_market_regime_historical import CORE2ArtifactTests
        body=(self.root/'raw/response.html').read_bytes()+b'<a href="attachment.html">attachment</a>'
        CORE2ArtifactTests.rebind_bytes(self,body)
        e=self.seed['releaseEvents'][0]
        landing=next(a for a in self.catalog['artifacts'] if a['artifactId']==e['landingArtifactId'])
        a=copy.deepcopy(landing); a['sourceUrl']=a['sourceUrl'].replace('report.html','attachment.html')
        a['artifactId']=artifact_identity(a,e['releaseEventId'])
        self.catalog['artifacts'].append(a)
        loc=self.eloc(landing,'<a href="attachment.html">attachment</a>')
        e['attachmentArtifactIds']=[a['artifactId']]
        e['attachmentEvidence']=[dict(artifactId=a['artifactId'],url=a['sourceUrl'],locator=loc)]
        binding=copy.deepcopy(next(b for b in self.seed['artifactBindings'] if b['artifactId']==landing['artifactId']))
        binding['artifactId']=a['artifactId']; binding['contentEvidence']['artifactId']=a['artifactId']
        self.seed['artifactBindings'].append(binding)
        r=copy.deepcopy(self.seed['retrievalAttempts'][0]); r.update(attemptId='attachment-acquisition',requestUrl=a['sourceUrl'],finalUrl=a['sourceUrl'])
        self.seed['retrievalAttempts'].append(r)
        e['publicationEvidence']=copy.deepcopy(e['indexEvidence'][0]['locator'])
        self.assertEqual(self.build()['manifest']['validationStatus'],'PASS')
        e['attachmentEvidence'][0]['url']='https://www.pbc.gov.cn/wrong.html'
        self.assert_rejected('attachment href mismatch')


class ScanEvidenceTests(EvidenceFixtureCase):
    def scan(self): return next(s for s in self.seed['inventoryEvidence'] if s['windowId']=='monthly')
    def pagination(self): return next(s for s in self.plans[0]['sources'] if s['sourceId']=='TEST_M2')['pagination']

    def two_page_plan(self):
        a=self.evidence(); link='<a href="index-page2.html">Next</a>'
        a=self.rewrite_evidence(a,body=(self.root/a['localPath']).read_bytes()+link.encode())
        pg=self.pagination(); pg['endPage']=2
        pg['pageTargets'].append(dict(pageNumber=2,url='https://www.pbc.gov.cn/index-page2.html',pageMarker='Page 2'))
        pg['stopRule']['pageNumber']=2
        scan=self.scan(); scan['pages'][0]['nextPageEvidence']=self.eloc(a,link); scan['stopEvidence']=None
        self.replan()

    def test_plan_requires_two_pages_but_one_self_reported_complete_fails(self):
        self.two_page_plan()
        self.assert_rejected('claimed complete scan missing planned page')
        self.scan().update(paginationComplete=False,candidatesReconciled=False)
        d=self.build()
        self.assertEqual(next(s for s in d['manifest']['coverageSummary'] if s['windowId']=='monthly')['inventoryStatus'],'PARTIAL')

    def test_two_page_inventory_pass_requires_both_acquisitions_and_terminal_evidence(self):
        self.two_page_plan()
        first=self.evidence()
        a=copy.deepcopy(first)
        body=b'<html><title>Archive</title>Page 2 END INDEX</html>'
        a.update(sourceUrl=self.pagination()['pageTargets'][1]['url'],localPath='raw/index-page2.html',
                 fileName='index-page2.html',sha256=sha256_bytes(body),byteSize=len(body))
        a['artifactId']=evidence_artifact_identity(a)
        (self.root/a['localPath']).write_bytes(body)
        self.seed['evidenceArtifacts'].append(a)
        binding=copy.deepcopy(next(b for b in self.seed['artifactBindings'] if b['artifactId']==first['artifactId']))
        binding.update(artifactId=a['artifactId'],contentEvidence=self.eloc(a,body.decode()))
        self.seed['artifactBindings'].append(binding)
        r=copy.deepcopy(next(r for r in self.seed['retrievalAttempts'] if r['finalUrl']==first['sourceUrl']))
        r.update(attemptId='index-page2-acquisition',requestUrl=a['sourceUrl'],finalUrl=a['sourceUrl'],
                 storedBytes={k:a[k] for k in ('localPath','sha256','byteSize')},candidateReleaseEventIds=[])
        self.seed['retrievalAttempts'].append(r)
        self.scan()['pages'].append(dict(pageNumber=2,url=a['sourceUrl'],artifactId=a['artifactId'],
            retrievalAttemptId=r['attemptId'],pageIdentityEvidence=self.eloc(a,'Page 2'),entryEvidence=[],
            candidateReleaseEventIds=[],nextPageEvidence=None))
        self.scan()['scannedIndexUrls'].append(a['sourceUrl'])
        self.scan()['stopEvidence']=dict(pageNumber=2,locator=self.eloc(a,'END INDEX'))
        d=self.build()
        self.assertEqual(next(s for s in d['manifest']['coverageSummary'] if s['windowId']=='monthly')['inventoryStatus'],'PASS')
        self.scan()['pages'][1]['artifactId']=first['artifactId']
        self.assert_rejected('scan page URL/source')

    def test_forged_page_number_acquisition_or_stopping_condition_rejected(self):
        for field,value in [('retrievalAttemptId','timeout'),('pageNumber',2),('url','https://www.pbc.gov.cn/absent.html')]:
            original=copy.deepcopy(self.scan()['pages'])
            self.scan()['pages'][0][field]=value
            self.assert_rejected('scan page|outside frozen plan')
            self.scan()['pages']=original
        self.pagination()['stopRule']['markerText']='UNOBSERVED END MARKER'; self.replan()
        self.assert_rejected('stopping condition')

    def test_additional_real_page_link_cannot_be_omitted_from_declared_inventory(self):
        a=self.evidence()
        self.rewrite_evidence(a,body=(self.root/a['localPath']).read_bytes()+b'<a href="other-report.html">another</a>')
        self.pagination()['candidateUrlPattern']=r'/[^/]*report\.html$'; self.replan()
        self.assert_rejected('actual page candidate links')

    def test_revision_complete_requires_scanned_pages_stop_and_all_retained_events(self):
        scan=self.scan(); scan['revisionScanComplete']=True
        self.assert_rejected('claimed complete scan missing planned page')
        scan['revisionPages']=copy.deepcopy(scan['pages'])
        scan['revisionStopEvidence']=dict(pageNumber=1,locator=self.eloc(self.evidence(),'END REVISION SCAN'))
        self.assertEqual(next(s for s in self.build()['manifest']['coverageSummary'] if s['windowId']=='monthly')['revisionCoverageStatus'],'PASS')
        scan['revisionPages'][0]['candidateReleaseEventIds'].remove(next(e['releaseEventId'] for e in self.seed['releaseEvents'] if e['releaseKind']=='REVISION'))
        self.assert_rejected('omits discovered release/revision')

    def test_revision_stop_cannot_reuse_inventory_stop_marker(self):
        scan=self.scan(); scan.update(revisionScanComplete=True,revisionPages=copy.deepcopy(scan['pages']),revisionStopEvidence=copy.deepcopy(scan['stopEvidence']))
        self.assert_rejected('stopping condition')


class CacheAndClockTests(FixtureCase):
    def cache(self):
        origin=self.seed['retrievalAttempts'][0]
        r=copy.deepcopy(origin)
        r.update(attemptId='cache-check',outcome='CACHE_VERIFIED',httpStatus=None,attemptedAt='2026-09-09T00:00:00Z',
                 verifiedAt='2026-09-09T00:00:01Z',acquisitionAttemptId=origin['attemptId'])
        self.seed['retrievalAttempts'].append(r)
        return r

    def test_cache_own_verification_time_preserves_original_fetched_at_and_network_evidence(self):
        original=copy.deepcopy(self.catalog)
        acquisition=copy.deepcopy(self.seed['retrievalAttempts'][0])
        cache=self.cache(); self.build()
        self.assertEqual(self.catalog,original)
        self.assertEqual(self.seed['retrievalAttempts'][0],acquisition)
        self.assertNotEqual(cache['verifiedAt'],acquisition['attemptedAt'])

    def test_cache_no_acquisition_http_claim_clock_regression_and_changed_bytes_rejected(self):
        cache=self.cache()
        for key,value in [('acquisitionAttemptId','absent'),('acquisitionAttemptId','cache-check'),
                          ('httpStatus',200),('verifiedAt',None),('verifiedAt','2026-09-01T00:00:00Z'),
                          ('finalUrl','https://www.pbc.gov.cn/other.html')]:
            old=cache[key]; cache[key]=value
            self.assert_rejected('cache')
            cache[key]=old
        cache['storedBytes']['sha256']='0'*64
        self.assert_rejected('sha256')

    def test_cache_cannot_replace_network_record_or_rewrite_artifact_fetch_time(self):
        cache=self.cache(); origin_id=cache['acquisitionAttemptId']
        self.seed['retrievalAttempts']=[r for r in self.seed['retrievalAttempts'] if r['attemptId']!=origin_id]
        self.assert_rejected('cache requires original network|matching successful retrieval')
        a=self.catalog['artifacts'][0]; a['fetchedAt']=cache['verifiedAt']
        self.assert_rejected('matching successful retrieval')

    def test_historical_cli_default_is_current_utc_and_fixed_time_is_explicit(self):
        (self.root/'input.json').write_text(json.dumps(self.bundle),encoding='utf-8')
        (self.root/'plans.json').write_text(json.dumps(self.plans),encoding='utf-8')
        args=['build','--input','input.json','--plans','plans.json','--output','current.json']
        with patch('scripts.market_regime.historical_cli.ROOT',self.root),redirect_stdout(StringIO()),patch('scripts.market_regime.historical_cli.utc_now_iso',return_value='2027-01-02T03:04:05Z') as clock:
            self.assertEqual(main(args),0)
            self.assertEqual(json.loads((self.root/'current.json').read_text())['manifest']['generatedAt'],'2027-01-02T03:04:05Z')
            clock.assert_called_once()
            args[-1]='fixed.json'
            self.assertEqual(main([*args,'--generated-at',GENERATED]),0)
            self.assertEqual(json.loads((self.root/'fixed.json').read_text())['manifest']['generatedAt'],GENERATED)


if __name__=='__main__': unittest.main()
