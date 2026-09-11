"""Replay additive official BSE 2022-2026 holiday-notice discovery."""
import hashlib
import json
import re
import sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent))
import probe
probe.HERE=HERE


def derive():
    captures=probe.replay()
    b=(HERE/'raw/holiday-title-search.body').read_bytes()
    page=json.loads(b[5:-1])[0]['data']
    assert page['firstPage'] and page['lastPage'] and page['number']==0
    assert page['totalElements']==len(page['content'])==5 and page['totalPages']==1
    notices=[]
    for row in page['content']:
        year=int(re.search(r'20\d\d',row['title']).group())
        raw=(HERE/'raw'/('calendar-'+str(year)+'.body')).read_bytes()
        locators=[]
        for match in re.finditer(r'<p\b[^>]*>.*?</p>',raw.decode('utf-8'),re.S):
            text=match.group()
            if '休市' in text and any(t in text for t in ['元旦','春节','清明','劳动','端午','中秋','国庆']):
                token=text.encode('utf-8')
                locators.append(dict(byteOffset=raw.index(token),byteLength=len(token),text=text))
        assert locators
        notices.append(dict(year=year,title=row['title'],url='https://www.bse.cn'+row['htmlUrl'],
            indexPublicationText=row['publishDate'],publicationTimeZone=None,
            rawSha256=hashlib.sha256(raw).hexdigest(),holidayLocators=locators))
    out=dict(version='r2-e-bse-calendar-supplement-2',kind='OFFICIAL_HOLIDAY_NOTICES_NOT_COMPLETE_SESSION_CALENDAR',
        supersedes=['V1 bounded-search statement that direct official 2022-2024 annual notice URLs had not yet been recovered'],
        captures=captures,notices=notices,noticeYears=sorted(n['year'] for n in notices),
        targetCount=None,formalCount=0,strictPitCount=0,status='UNKNOWN',
        residualBlockers=['2021 launch-to-year-end exact session grid not established',
            'Annual notices plus general weekday rule do not enumerate every session or prove exceptional closure/revision completeness',
            'R2 literal ISO date locator gate unchanged'],
        disclosureIndexFinding='The separate vocational page states default latest-year company/disclosure filtering; it is not used as the annual holiday archive.',
        scopeLimit='Five returned annual notices exhaust this exact title query response, not all official notices or calendar revisions.')
    out['contentSha256']=hashlib.sha256(json.dumps(out,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return out


if __name__=='__main__':
    out=derive();p=HERE/'evidence.v2.json'
    if sys.argv[1:]==['build']:
        if p.exists():assert json.loads(p.read_text(encoding='utf-8'))==out
        else:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    elif sys.argv[1:]==['validate']:
        assert json.loads(p.read_text(encoding='utf-8'))==out
    else:raise SystemExit('usage: replay.py build|validate')
    print(json.dumps(dict(status='PASS',captureCount=len(out['captures']),noticeYears=out['noticeYears'],targetCount=None,contentSha256=out['contentSha256'])))
