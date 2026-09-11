"""Replay the additive BSE evidence inventory; never create formal observations."""
import hashlib
import json
import re
import sys
from io import BytesIO
from pathlib import Path

from probe import HERE, replay

sys.path.insert(0, str(HERE.parents[4]))
from scripts.market_regime.bse_source import load_contract, parse_daily


def digest(b):
    return hashlib.sha256(b).hexdigest()


def derive():
    captures = replay()
    by_id = {m['request']['requestId']: m for m in captures}
    def body(name):
        return (HERE / by_id[name]['bodyPath']).read_bytes()
    def loc(name, start, end):
        raw = body(name)
        return dict(requestId=name, rawSha256=digest(raw), byteOffset=start,
                    byteLength=end-start, text=raw[start:end].decode('utf-8'))
    def token(name, text):
        b = body(name); t = text.encode(); i = b.index(t)
        return loc(name, i, i+len(t))
    def clause(name, text):
        b = body(name); i = b.index(text.encode()); j = b.index(b'</p>', i)
        return loc(name, i, j)
    proofs = []
    for name in ['rules-2021', 'rules-2026']:
        for section in ['2.3.1 ', '3.6.8 ', '5.1.1 ']:
            proofs.append(dict(meaning=section.strip(), locator=clause(name, section)))
    proofs += [dict(meaning='NEW_RULE_EFFECTIVE_DATE_WITH_EXCEPTIONS', locator=clause('rules-2026', '2026年7月6日')),
               dict(meaning='DEFERRED_CLAUSES_NOT_ASSUMED_EFFECTIVE', locator=clause('rules-2026', '考虑到市场业务')),
               dict(meaning='INITIAL_RULE_EFFECTIVE_DATE', locator=clause('rules-2021', '2021年11月15日'))]
    calendar_proofs = []
    for name in ['calendar-2025', 'calendar-2026']:
        b = body(name)
        for m in re.finditer(r'<p\b[^>]*>.*?</p>', b.decode(), re.S):
            text = m.group()
            if '休市' in text and ('元旦' in text or '春节' in text or '清明' in text or '劳动' in text or '端午' in text or '中秋' in text or '国庆' in text):
                calendar_proofs.append(token(name, text))
    archive = []
    for name, key in [('annual-list', 'data'), ('special-list', 'pageList')]:
        page = json.loads(body(name)[5:-1])[0][key]
        assert page['firstPage'] and page['lastPage'] and page['totalPages'] == 1
        assert len(page['content']) == page['totalElements']
        for row in page['content']:
            archive.append(dict(title=row['title'], fileUrl=row['fileUrl'],
                indexPublicationText=row['publishDate'], publicationTimeZone=None,
                releaseAvailableAt=None, firstReleaseProven=False, revisionSequence=None,
                publicationLocator=token(name, row['publishDate']),
                fileLocator=token(name, row['fileUrl']),
                role='ANNUAL_ARCHIVE_EVIDENCE_NOT_DAILY_OBSERVATION',
                reason='Index timestamp is timezone-naive and does not bind original released attachment bytes or daily releases.'))
    candidates=[]; rejected=[]
    for m in captures:
        j=m['request']
        if j.get('requestedDate') and m.get('status') == 200:
            parsed=parse_daily(body(j['requestId']),family=load_contract()['families'][0],requested_date=j['requestedDate'],artifact_id='bse-r2e-'+m['sha256'])
            candidates.extend(parsed['candidates']);rejected.extend(parsed['rejectedRows'])
    old=json.loads((HERE.parents[1]/'bse-d1c'/'inventory.v1.json').read_text(encoding='utf-8'))
    # Overlapping recapture is counted as evidence, not another trading date.
    keys={(c['tradeDate'],c['field']) for c in old['candidates']+candidates if c['rawValueText'] is not None}
    duplicate=[]
    for d in sorted({c['tradeDate'] for c in candidates} & {c['tradeDate'] for c in old['candidates']}):
        a={c['field']:c['rawValueText'] for c in old['candidates'] if c['tradeDate']==d}
        b={c['field']:c['rawValueText'] for c in candidates if c['tradeDate']==d}
        duplicate.append(dict(tradeDate=d,status='VALUES_UNCHANGED' if a==b else 'UNRESOLVED_RELEASE_CONFLICT',old=a,new=b,
                              historicalFirstReleaseProven=False))
    fields={}
    for f in load_contract()['targetWindow']['fields']:
        blockers=['FULL_OFFICIAL_CALENDAR_UNPROVEN','CONTINUOUS_HISTORY_NOT_ENUMERATED','FIELD_SCOPE_ERA_APPLICABILITY_UNPROVEN','MARKET_RELEASE_MISSING','FIRST_RELEASE_AND_REVISION_ARCHIVE_UNPROVEN','R2_CALENDAR_LITERAL_ISO_LOCATOR_UNAVAILABLE']
        if f=='turnoverValue':blockers.append('TRADE_MODE_AND_BLOCK_TRADE_INCLUSION_UNPROVEN')
        if f=='negotiableMarketCap':blockers.append('NEGOTIABLE_NOT_PROVEN_FREE_FLOAT')
        fields[f]=dict(status='NOT_ADMITTED',candidateCount=sum(c['field']==f for c in candidates),combinedUniqueCandidateDateCount=sum(k[1]==f for k in keys),formalCount=0,strictPitCount=0,blockers=blockers,unadmittedWindows=[dict(start='2021-11-15',end='2026-09-04')])
    out=dict(version='r2-e-bse-1',kind='ADDITIVE_EVIDENCE_NOT_FORMAL_DATASET',datasetAsOf='2026-09-07T08:00:00+08:00',
        captures=captures,ruleEvidence=proofs,calendarEvidence=calendar_proofs,
        calendar=dict(targetCount=None,status='UNKNOWN',annualNoticeYearsCaptured=[2025,2026],
            gaps=['2021 launch-to-year-end session enumeration absent','2022-2024 annual official notice direct URLs not recovered by bounded search','2025-2026 notices do not enumerate every session or prove exceptional-closure/revision completeness','Existing R2 literal ISO per-session locator gate remains unsatisfied']),
        archive=archive,candidates=candidates,rejectedRows=rejected,recaptureComparisons=duplicate,
        counts=dict(candidateCount=len(candidates),priorD1cCandidateCount=len(old['candidates']),
            combinedCaptureCandidateCount=len(old['candidates'])+len(candidates),combinedUniqueDateFieldCandidateCount=len(keys),formalCount=0,strictPitCount=0),
        fieldAdmission=fields,eraEvidence=[dict(start='2021-11-15',end='2026-07-05',rule='rules-2021',fieldDefinitionStatus='UNPROVEN',note='Initial rule effective date established; full interim amendment history is not established.'),
            dict(start='2026-07-06',end='2026-09-04',rule='rules-2026',fieldDefinitionStatus='UNPROVEN',note='General effective date with explicitly deferred clauses; hqcjje/zsz/ltsz applicability not independently established.')],
        releaseEvents=[],formalObservations=[],strictPitObservations=[],
        notRun=[dict(action='Full daily enumeration',status='BLOCKED',reason='Calendar, field eras and daily release provenance gates remain unproven; sparse new probes do not prove continuity.')])
    out['contentSha256']=digest(json.dumps(out,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode())
    return out


if __name__=='__main__':
    out=derive();p=HERE/'evidence.v1.json'
    if sys.argv[1:]==['build']:
        if p.exists():assert json.loads(p.read_text(encoding='utf-8'))==out,'SEALED_OUTPUT_DIFFERS'
        else:p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    elif sys.argv[1:]==['validate']:
        assert json.loads(p.read_text(encoding='utf-8'))==out,'EVIDENCE_REPLAY_MISMATCH'
    else:raise SystemExit('usage: derive.py build|validate')
    print(json.dumps(dict(status='PASS',**out['counts'],contentSha256=out['contentSha256'])))
