"""Correct V1 rule locators by binding full body paragraphs to retained bytes."""
import hashlib
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW_PINS = {
    'rules-2021': '9e2271bef634fd9337c4ee1cef8679a5cb99f813f6e1aae4d099b57d2a01ad18',
    'rules-2026': 'f15d8685e71e5686343600d68a7c8c8d11386bee54fc998b5638273c9ae1fbc4',
}


def require(condition, code):
    if not condition:
        raise ValueError(code)


def plain_text(paragraph):
    return re.sub(r'\s+', '', html.unescape(re.sub(r'<[^>]+>', '', paragraph)))


def paragraph_locator(body, required):
    matches = []
    # Whole <p> spans exclude share-link summaries even when the same phrase
    # appears earlier in an href. Offsets are calculated on original bytes.
    for match in re.finditer(rb'<p\b[^>]*>.*?</p>', body, re.S):
        raw = match.group()
        decoded = raw.decode('utf-8')
        text = plain_text(decoded)
        if all(fragment in text for fragment in required):
            matches.append(dict(byteOffset=match.start(), byteLength=len(raw),
                                text=decoded, normalizedText=text))
    require(len(matches) == 1, 'BODY_PARAGRAPH_NOT_UNIQUE_OR_MISSING')
    return matches[0]


def derive(*, bse_root=HERE.parent):
    rows=[]
    def add(name, meaning, fragments):
        raw=(bse_root/'raw'/(name+'.body')).read_bytes()
        require(hashlib.sha256(raw).hexdigest()==RAW_PINS[name], 'REVIEWED_RULE_BYTES_MISMATCH')
        locator=paragraph_locator(raw, fragments)
        locator.update(requestId=name, rawSha256=RAW_PINS[name],
                       rawPath='research-data/market-regime/source-catalog/r2-e/bse/raw/'+name+'.body')
        rows.append(dict(meaning=meaning, locator=locator, requiredTextFragments=fragments))
    for name in RAW_PINS:
        add(name, '2.3.1', ['2.3.1','本所交易日为每周一至周五'])
        add(name, '3.6.8', ['3.6.8','大宗交易不纳入即时行情和指数的计算','成交量在大宗交易结束后计入当日该证券成交总量'])
        add(name, '5.1.1', ['5.1.1','本所每个交易日发布证券交易即时行情','及时编制反映市场交易情况'])
    add('rules-2026','NEW_RULE_EFFECTIVE_DATE_WITH_EXCEPTIONS',
        ['为了进一步完善股票交易机制','除本公告特别说明的条款外','修订后的规则自2026年7月6日起施行'])
    add('rules-2026','DEFERRED_CLAUSES_NOT_ASSUMED_EFFECTIVE',
        ['考虑到市场业务和技术整体准备情况','第3.6.5条第二款和第三款','第3.7.1条至第3.7.10条',
         '第4.5.1条至第4.5.4条','具体施行时间','由本所另行通知','仍按照原规定执行'])
    add('rules-2021','INITIAL_RULE_EFFECTIVE_DATE',
        ['为了规范北京证券交易所','经中国证监会批准','自2021年11月15日起施行'])
    out=dict(version='r2-e-bse-rule-locator-supplement-3',kind='CORRECTED_BODY_PARAGRAPH_EVIDENCE',
        supersedes=dict(path='research-data/market-regime/source-catalog/r2-e/bse/evidence.v1.json',
            scope='ruleEvidence locators only; old V1 and V2 bytes and historical records are preserved',
            defect='V1 first-substring search matched share-link summaries for effective/deferred statements; the deferred locator omitted actual deferred clauses.'),
        rawInputs=[dict(requestId=k,sha256=v,path='research-data/market-regime/source-catalog/r2-e/bse/raw/'+k+'.body') for k,v in RAW_PINS.items()],
        ruleEvidence=rows,formalCount=0,strictPitCount=0,releaseEvents=[],
        status='EVIDENCE_CORRECTED_NOT_DATA_ADMISSION',
        limits=['These are rule publication/effectiveness paragraphs, not market statistical releases.',
            'Deferred clauses are not assumed effective on 2026-07-06.',
            'Block-trade volume wording does not prove all-mode hqcjje turnover amount inclusion.',
            'V3 does not create calendar sessions, new field-era admission, candidates or observations.'])
    out['contentSha256']=hashlib.sha256(json.dumps(out,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()
    return out


if __name__=='__main__':
    out=derive();path=HERE/'evidence.v3.json'
    if sys.argv[1:]==['build']:
        if path.exists():require(json.loads(path.read_text(encoding='utf-8'))==out,'SEALED_V3_DIFFERS')
        else:path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    elif sys.argv[1:]==['validate']:
        require(json.loads(path.read_text(encoding='utf-8'))==out,'V3_REPLAY_MISMATCH')
    else:raise SystemExit('usage: replay.py build|validate')
    print(json.dumps(dict(status='PASS',ruleLocatorCount=len(out['ruleEvidence']),contentSha256=out['contentSha256'])))
