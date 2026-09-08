"""C1.1 adversarial recovery tests; temporary synthetic sources, no network."""
import copy
import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from scripts.market_regime.csrc_recovery import (
    ANNUAL, BASE, GAPS, OUT, PLAN, RAW, assemble, build, digest, monthly,
    prove_request, replay_graph, search_page, transition,
    validate_compact,
)
from scripts.market_regime.csrc_retrieval import Collector, dump
from scripts.tests.test_market_regime_csrc_field_map import cell, fixture
from scripts.market_regime.csrc_field_map import field_map

REPO = Path(__file__).resolve().parents[2]
FIXTURE = REPO / "scripts/tests/fixtures/market_regime/csrc-c1-1-recovery.synthetic.v1.json"
ORIGIN = "https://www.csrc.gov.cn"
STAMP = "2026-09-08T00:00:00Z"


def document(period="2017年1月", suffix=""):
    parts = {
        "[Content_Types].xml": '<Types><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        "word/document.xml": '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + period + '统计数据</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>境内主要股指涨跌幅</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' + suffix + '</w:body></w:document>',
    }
    sink=io.BytesIO()
    with zipfile.ZipFile(sink,"w") as z:
        for name,text in parts.items():
            z.writestr(zipfile.ZipInfo(name,date_time=(2000,1,1,0,0,0)),text.encode())
    return sink.getvalue()


class RecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base=json.loads((REPO/BASE).read_text(encoding="utf-8"))
        cls.fx=json.loads(FIXTURE.read_text(encoding="utf-8"))

    def setUp(self):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.repo=Path(tmp.name)
        dump(self.repo/BASE,self.base)
        self.plan=dict(annualHintUrl=ANNUAL,baselineContentSha256=self.base["contentSha256"],
                       requestBudget=200,allowNumericObservations=False,allowYtdDifference=False)
        dump(self.repo/PLAN,self.plan)
        self.c=Collector(self.repo,raw_directory=RAW)
        network=patch("scripts.market_regime.csrc_retrieval.requests.Session.request",side_effect=AssertionError("OFFLINE_ONLY"))
        network.start()
        self.addCleanup(network.stop)

    def raw(self,name,url,body,mime="text/html;charset=utf-8",**kwargs):
        body=body.encode() if isinstance(body,str) else body
        sha=hashlib.sha256(body).hexdigest()
        local=f"{RAW}/sha256/{sha}.bin"
        path=self.repo/local
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(body)
        row=dict(attemptId=name,requestUrl=url,discoveredUrl=url,finalUrl=url,role="SYNTHETIC",
                 attemptedAt=STAMP,httpStatus=200,contentType=mime,storedBytes=dict(localPath=local,sha256=sha,byteSize=len(body)),
                 outcome="SUCCESS",blocker=None,redirects=[],acquisitionAttemptId=None,verifiedAt=None,**kwargs)
        self.c.append(row)
        return row

    def chain(self,*,attachment=True,body=None,index=None,landing=None):
        self.raw("annual",ANNUAL,self.fx["annual"])
        self.raw("index",ORIGIN+"/synthetic-index.shtml",index or self.fx["index"])
        self.raw("landing",ORIGIN+"/synthetic-landing.shtml",landing or self.fx["landing" if attachment else "noAttachment"])
        if attachment:
            self.raw("attachment",ORIGIN+"/files/synthetic.docx",body or document(),
                     "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    def result(self):
        return build(self.repo,verify_baseline=False)

    def test_annual_hint_cannot_manufacture_twelve_recovered_periods(self):
        self.raw("annual",ANNUAL,self.fx["hintOnly"])
        r=self.result()
        self.assertEqual(r["summary"]["recoveredPeriods"],0)
        self.assertEqual([g["reportPeriod"] for g in r["gapResults"]],GAPS)
        self.assertTrue(all(g["status"]=="MISSING" for g in r["gapResults"]))

    def test_search_engine_and_third_party_urls_cannot_be_sources(self):
        self.raw("annual",ANNUAL,self.fx["annual"])
        for url in ["https://www.baidu.com/s?wd=csrc","https://news.example/monthly.docx","https://csrc.gov.cn.evil.test/report"]:
            with self.subTest(url=url),self.assertRaises(ValueError):
                prove_request(self.c,dict(url=url),self.c.rows)

    def test_guessed_content_and_attachment_ids_are_rejected(self):
        self.raw("annual",ANNUAL,self.fx["annual"])
        for path in ["/csrc/c100120/c123456/content.shtml","/files/123456.docx","/getChannelList?channelCode=c999999"]:
            with self.subTest(path=path),self.assertRaisesRegex(ValueError,"GUESSED_URL"):
                prove_request(self.c,dict(url=ORIGIN+path),self.c.rows)

    def test_real_official_index_landing_bytes_chain_recovers_only_one_month(self):
        self.chain()
        r=self.result()
        self.assertEqual(r["summary"]["recoveredPeriods"],1)
        self.assertEqual(r["summary"]["coveredPeriods"],248)
        recovered=next(g for g in r["gapResults"] if g["reportPeriod"]=="2017-01")
        self.assertEqual(recovered["status"],"RECOVERED")
        candidate=r["candidates"][0]
        self.assertEqual(candidate["publication"]["date"],"2017-02-20")
        self.assertEqual(candidate["historicalAttachmentVersion"],"UNPROVEN")
        self.assertEqual(candidate["attachments"][0]["probe"]["actualFormat"],"DOCX")
        self.assertEqual(r["formatTransition"]["status"],"CLOSED")

    def test_landing_without_attachment_cannot_recover(self):
        self.chain(attachment=False)
        r=self.result()
        self.assertEqual(r["summary"]["recoveredPeriods"],0)
        self.assertIn("ATTACHMENT_BYTES_OR_SELECTION_UNPROVEN",r["candidates"][0]["blockers"])

    def test_attachment_href_without_downloaded_bytes_cannot_recover(self):
        self.chain(attachment=False,landing=self.fx["landing"])
        self.assertEqual(self.result()["summary"]["recoveredPeriods"],0)

    def test_attachment_content_period_conflict_fails_closed(self):
        self.chain(body=document("2017年2月"))
        r=self.result()
        self.assertEqual(r["summary"]["recoveredPeriods"],0)
        self.assertEqual(r["candidates"][0]["selection"]["rejected"][0]["reason"],"ATTACHMENT_PERIOD_CONFLICT")

    def test_wrong_title_and_html_masquerade_cannot_recover(self):
        for body in [b"<html>not a docx</html>",b"PK\x03\x04broken"]:
            with self.subTest(body=body):
                probe_repo=self.repo
                self.chain(body=body)
                self.assertEqual(self.result()["summary"]["recoveredPeriods"],0)
                # Use a separate journal for the next isolated adversarial case.
                self.c.journal.unlink()
                self.c=Collector(probe_repo,raw_directory=RAW)

    def test_recovery_retains_month_ytd_separation_and_never_differences(self):
        probe=fixture(period_text="2017年1月")
        probe["sheets"][0]["cells"] += [cell(5,1,"本年累计"),cell(5,2,"999","2")]
        mapping=field_map(probe,"2017-01")
        self.assertEqual(mapping["tables"][0]["periodSemantics"],["MONTH","YTD"])
        self.assertTrue(all(f["formalObservations"]==[] for f in mapping["fields"].values()))
        self.chain()
        candidate=self.result()["candidates"][0]
        for field in candidate["attachments"][0]["fieldMap"]["fields"].values():
            self.assertEqual(field["formalObservations"],[])

    def test_formal_observations_remain_exactly_empty(self):
        self.chain()
        r=self.result()
        self.assertEqual(r["formalObservations"],[])
        self.assertEqual(r["summary"]["formalObservationCount"],0)
        self.assertTrue(all(x["formalObservations"]==[] for x in r["candidates"]))

    def test_same_inputs_and_hash_are_deterministic(self):
        self.chain()
        first=self.result()
        self.assertEqual(first,self.result())
        self.assertEqual(first["contentSha256"],digest({k:v for k,v in first.items() if k!="contentSha256"}))

    def test_provenance_change_changes_content_hash(self):
        self.chain()
        before=self.result()["contentSha256"]
        rows=copy.deepcopy(self.c.rows)
        rows[-1]["attemptedAt"]="2026-09-09T00:00:00Z"
        self.c.journal.write_text("".join(json.dumps(r)+"\n" for r in rows),encoding="utf-8")
        self.assertNotEqual(before,self.result()["contentSha256"])

    def test_valid_new_bytes_change_hash_and_unrecorded_tamper_is_rejected(self):
        self.chain()
        before=self.result()["contentSha256"]
        self.raw("replacement",ORIGIN+"/files/synthetic.docx",document(suffix="<!--new bytes-->") ,
                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        after=self.result()
        self.assertNotEqual(before,after["contentSha256"])
        self.assertEqual(after["summary"]["recoveredPeriods"],0)
        self.assertEqual(len(after["candidates"][0]["attachments"]),2)
        row=self.c.rows[-1]
        (self.repo/row["storedBytes"]["localPath"]).write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError,"RAW_BYTES_MISMATCH"):
            self.result()

    def test_old_247_months_and_shared_2026_hash_identity_do_not_drift(self):
        self.chain()
        ledger=self.result()["ledger"]
        self.assertEqual([r for r in ledger if r["period"] not in GAPS],
                         [r for r in self.base["ledger"] if r["period"] not in GAPS])

    def test_official_search_json_must_match_requested_pagination(self):
        form=dict(page="2",size="10")
        r=self.raw("search",ORIGIN+"/getSearch",json.dumps(dict(data=dict(page=1,rows=10,total=0,results=[]))),
                   "application/json",requestForm=form,requestMethod="POST")
        with self.assertRaisesRegex(ValueError,"SEARCH_RESPONSE_BINDING_MISMATCH"):
            search_page(self.c,r)

    def test_unobserved_search_form_and_page_id_rejected(self):
        self.raw("annual",ANNUAL,self.fx["annual"])
        with self.assertRaisesRegex(ValueError,"GUESSED_URL"):
            prove_request(self.c,dict(url=ORIGIN+"/getSearch",form=dict(page="999",channelId="guessed")),self.c.rows)

    def test_national_monthly_candidate_filter_excludes_other_source_titles(self):
        for title in ["2017年政府信息公开年度报告","2017年1月全国期货市场统计数据","2017年1月江西辖区统计数据","2017年1月16日证券市场快报"]:
            self.assertFalse(monthly(title))

    def test_wrong_final_url_cannot_borrow_another_official_response(self):
        self.chain()
        rows=copy.deepcopy(self.c.rows)
        rows[-1]["finalUrl"]=ORIGIN+"/files/unrelated.docx"
        self.c.journal.write_text("".join(json.dumps(r)+"\n" for r in rows),encoding="utf-8")
        with self.assertRaisesRegex(ValueError,"SUCCESS_RESPONSE_MISMATCH"):
            self.result()

    def test_collector_only_allows_read_only_title_search_post(self):
        with self.assertRaisesRegex(ValueError,"ONLY_READ_ONLY"):
            self.c.fetch(ORIGIN+"/other-action","DISCOVERY",form_data={"key":"value"})

    def test_post_cache_is_keyed_by_query_and_budget_counts_physical_calls(self):
        from scripts.tests.test_market_regime_csrc_retrieval import Response
        with patch.object(self.c.session,"post",side_effect=lambda url,**kw: Response(url,b'{"data":{}}')) as post, patch("scripts.market_regime.csrc_retrieval.time.sleep"):
            a=self.c.fetch(ORIGIN+"/getSearch","TITLE_SEARCH",form_data={"searchContent":"first"})
            b=self.c.fetch(ORIGIN+"/getSearch","TITLE_SEARCH",form_data={"searchContent":"second"})
            again=self.c.fetch(ORIGIN+"/getSearch","TITLE_SEARCH",form_data={"searchContent":"first"})
        self.assertEqual(post.call_count,2)
        self.assertNotEqual(a["attemptId"],b["attemptId"])
        self.assertEqual(a,again)
        self.assertEqual(a["physicalRequests"],1)


class TransitionTests(unittest.TestCase):
    def ledger(self,known):
        periods=["2016-12"]+[f"2017-{m:02d}" for m in range(1,13)]+["2018-01"]
        return [dict(period=p,formats=[known[p]] if p in known else [],attachmentAttemptIds=[p] if p in known else []) for p in periods]

    def test_baseline_unresolved(self):
        self.assertEqual(transition(self.ledger({"2016-12":"XLS","2018-01":"DOCX"}))["status"],"UNRESOLVED")

    def test_real_adjacent_months_close(self):
        r=transition(self.ledger({"2016-12":"XLS","2017-08":"XLS","2017-09":"DOCX","2018-01":"DOCX"}))
        self.assertEqual(r["status"],"CLOSED")
        self.assertEqual(r["boundaries"][0]["before"],"2017-08")
        self.assertEqual(r["boundaries"][0]["after"],"2017-09")

    def test_intermediate_missing_month_only_narrows(self):
        r=transition(self.ledger({"2016-12":"XLS","2017-08":"XLS","2017-10":"DOCX","2018-01":"DOCX"}))
        self.assertEqual(r["status"],"NARROWED")
        self.assertEqual(r["boundaries"][0]["interveningPeriods"],["2017-09"])


class CommittedEvidenceTests(unittest.TestCase):
    def test_committed_overlay_baseline_summary_and_content_integrity(self):
        validate_compact(REPO)
        r=json.loads((REPO/OUT).read_text(encoding="utf-8"))
        base=json.loads((REPO/BASE).read_text(encoding="utf-8"))
        self.assertEqual(r["baselineContentSha256"],"28453963bf0a453d69a0277d9eabdc4cd3b393e4f663d3cb8922478b06a18d80")
        self.assertEqual(r["contentSha256"],digest({k:v for k,v in r.items() if k!="contentSha256"}))
        self.assertEqual(r["formalObservations"],[])
        self.assertEqual(r["formatTransition"],transition(r["ledger"]))
        self.assertEqual(r["ledger"],base["ledger"])
        self.assertEqual(r["summary"]["coveredPeriods"],247)
        self.assertEqual(r["summary"]["recoveredPeriods"],0)
        self.assertEqual(r["summary"]["missingPeriods"],13)
        self.assertEqual(r["gapResults"],assemble(base,r["candidates"],[s["sourceId"] for s in r["searchChecks"]])[1])


if __name__ == "__main__":
    unittest.main()
