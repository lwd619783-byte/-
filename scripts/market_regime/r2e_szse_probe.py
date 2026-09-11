"""Bounded public SZSE R2-E evidence acquisition and raw-byte replay.

This workstream produces evidence/candidates only; it cannot admit observations.
Run ``python -m scripts.market_regime.r2e_szse_probe fetch|validate``.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from datetime import date
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'research-data/market-regime/source-catalog/r2-e/szse'
RAW = ROOT / 'research-data/market-regime/raw/r2-e-szse'
JOBS = [
    ('overview', 'https://www.szse.cn/market/overview/index.html', 'FROZEN_D1B_ENTRY'),
    ('year-index', 'https://www.szse.cn/market/periodical/year/index.html', 'OFFICIAL_STATISTICS_NAVIGATION'),
    ('month-index', 'https://www.szse.cn/market/periodical/month/index.html', 'OFFICIAL_STATISTICS_NAVIGATION'),
    ('year-2023-explanations', 'https://docs.static.szse.cn/www/market/periodical/year/W020240814360443176703.pdf', 'WEB_SEARCH_OFFICIAL_RESULT'),
    ('year-2022-history', 'https://docs.static.szse.cn/www/market/periodical/year/W020230915392900565815.pdf', 'WEB_SEARCH_OFFICIAL_RESULT'),
    ('month-2026-06-overview', 'https://docs.static.szse.cn/www/market/periodical/month/W020260706503106637632.html', 'WEB_SEARCH_OFFICIAL_RESULT'),
    ('technical-history', 'https://www.szse.cn/marketServices/technicalservice/history/P020180328468109142706.pdf', 'WEB_SEARCH_OFFICIAL_RESULT'),
    ('month-2025-05-landing', 'https://www.szse.cn/market/periodical/month/t20250609_613960.html', 'WEB_SEARCH_OFFICIAL_RESULT'),
]
FOLLOWUPS = [
    ('csrc-2025-indicators', 'https://www.szse.cn/www/lawrules/csrcrules/notice/P020250519343090326948.pdf', 'WEB_SEARCH_OFFICIAL_RESULT'),
    ('year-2005', 'https://docs.static.szse.cn/www/market/periodical/year/W020250610540373805626.PDF', 'YEAR_INDEX_LINK_HTTPS_TRANSPORT_SAME_HOST_PATH'),
]


def stamp():
    return datetime.now(timezone.utc).isoformat()


def digest(body):
    return hashlib.sha256(body).hexdigest()


def sealed_write(path, body):
    if path.exists():
        assert path.read_bytes() == body, 'SEALED_CONTENT_DRIFT_NEW_VERSION_REQUIRED'
        return 'UNCHANGED'
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        stream.write(body)
    return 'CREATED'


def load_records():
    return [r for manifest in sorted(OUT.glob('acquisition*.v1.json'))
            for r in json.loads(manifest.read_text(encoding='utf-8'))['records']]


def source_path(record):
    path = (ROOT / record['path']).resolve()
    assert path.is_relative_to((OUT / 'raw').resolve()) or path.is_relative_to(RAW.resolve()), 'RAW_PATH_ESCAPE'
    return path


def official(url):
    p = urlsplit(url)
    return (p.scheme == 'https' and p.hostname in ('www.szse.cn', 'docs.static.szse.cn')
            and not p.username and not p.password and p.port in (None, 443))


def fetch_one(job):
    import requests
    key, url, discovery = job
    assert official(url)
    record = dict(evidenceId=key, url=url, discoveryKind=discovery, startedAt=stamp())
    try:
        response = requests.get(url, timeout=(10, 20), allow_redirects=False,
                                headers={'User-Agent': 'Mozilla/5.0', 'Accept': '*/*'})
        body = response.content
        if len(body) > 20000000:
            record.update(status='BLOCKED_RESPONSE_SIZE', statusCode=response.status_code,
                          receivedByteSize=len(body), receivedSha256=digest(body),
                          completedAt=stamp())
            return record
        path = (RAW if len(body) > 2000000 else OUT / 'raw') / (key + '.body')
        sealed_write(path, body)
        record.update(statusCode=response.status_code, finalUrl=response.url,
                      contentType=response.headers.get('Content-Type', ''),
                      sha256=digest(body), byteSize=len(body),
                      path=path.relative_to(ROOT).as_posix(),
                      status='RETRIEVED' if response.status_code == 200 else 'BLOCKED_HTTP')
    except requests.RequestException as exc:
        # No raw exception string: it can contain local proxy details.
        record.update(status='BLOCKED_NETWORK', errorType=type(exc).__name__)
    record['completedAt'] = stamp()
    return record


def fetch(followup=False):
    manifest = OUT / ('acquisition-followup.v1.json' if followup else 'acquisition.v1.json')
    if manifest.exists():
        validate(replay_text=False)
        print(json.dumps(dict(status='SEALED_REUSED_NO_NETWORK', manifest=manifest.name)))
        return
    (OUT / 'raw').mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(fetch_one, FOLLOWUPS if followup else JOBS))
    sealed_write(manifest, (json.dumps(dict(schemaVersion='1.0.0', sourceId='SZSE_MARKET_STATS_OFFICIAL',
        role='CANDIDATE_EVIDENCE_ONLY', acquisitionPolicy='BOUNDED_EXACT_URLS_NO_DATE_ENUMERATION',
        records=records), ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
    print(json.dumps({r['evidenceId']:r['status'] for r in records}))


def validate(replay_text=True, compact=False):
    records = load_records()
    assert len(records) == len(JOBS) + len(FOLLOWUPS), 'ACQUISITION_MANIFEST_INCOMPLETE'
    missing = []
    assert len({r['evidenceId'] for r in records}) == len(records)
    for record in records:
        assert official(record['url'])
        assert datetime.fromisoformat(record['completedAt']) >= datetime.fromisoformat(record['startedAt'])
        if 'path' in record:
            path = source_path(record)
            if not path.exists():
                assert compact and path.is_relative_to(RAW.resolve()), 'RAW_MISSING_FULL_REPLAY_NOT_RUN'
                missing.append(record['evidenceId'])
                continue
            body = path.read_bytes()
            assert digest(body) == record['sha256'] and len(body) == record['byteSize']
        else:
            assert record['status'] in ('BLOCKED_NETWORK', 'BLOCKED_RESPONSE_SIZE')
    artifacts = {r['evidenceId']:r for r in records}
    extracted = OUT / 'extractions.v1.json'
    if extracted.exists():
        from pypdf import PdfReader
        readers = {}
        for page in json.loads(extracted.read_text(encoding='utf-8'))['pages']:
            key = page['evidenceId']
            assert page['sourceSha256'] == artifacts[key]['sha256']
            if replay_text and key not in missing:
                readers.setdefault(key, PdfReader(ROOT / artifacts[key]['path']))
                assert readers[key].pages[page['pageNumber']-1].extract_text() == page['text']
            assert digest(page['text'].encode()) == page['textSha256']
    archive = OUT / 'archive-index.v1.json'
    if archive.exists():
        index = json.loads(archive.read_text(encoding='utf-8'))
        assert index['sourceSha256'] == artifacts['year-index']['sha256']
        body = (ROOT / artifacts['year-index']['path']).read_bytes()
        for entry in index['entries']:
            loc = entry['locator']
            assert body[loc['byteOffset']:loc['byteOffset']+loc['byteLength']] == loc['text'].encode()
            assert entry['url'] in loc['text'] and entry['releaseAvailableAt'] is None
            assert entry['firstRelease'] == entry['revisionArchive'] == 'UNPROVEN'
    validate_sidecars(artifacts)
    result = dict(status='PASS', replayed=sum('path' in r for r in records)-len(missing),
                          fullRawReplay='NOT_RUN_MISSING_RAW' if missing else 'PASS', missingRaw=missing,
                          pdfCellReplay='NOT_RUN_USE_REPLAY_CANDIDATES',
                          derivedTextReplay='PASS' if replay_text else 'NOT_RUN_SEPARATE_VALIDATE_COMMAND',
                          blocked=sum(r['status'] != 'RETRIEVED' for r in records))
    print(json.dumps(result))
    return result


def validate_sidecars(artifacts):
    path = OUT / 'yearbook-candidates.v1.json'
    if path.exists():
        artifact = json.loads(path.read_text(encoding='utf-8'))
        rows = artifact['candidates']
        assert artifact['role'] == 'CANDIDATE_ONLY_NOT_FORMAL_OBSERVATION'
        assert artifact['candidateCount'] == len(rows) == 484, 'CANDIDATE_COUNT'
        assert artifact['candidateDateCount'] == len({r['tradeDate'] for r in rows}) == 242, 'DATE_COUNT'
        assert artifact['formalCount'] == artifact['strictPitCount'] == 0, 'FORMAL_PROMOTION_FORBIDDEN'
        assert len({r['candidateId'] for r in rows}) == len(rows), 'DUPLICATE_CANDIDATE'
        for row in rows:
            identity = {k:v for k,v in row.items() if k != 'candidateId'}
            assert row['candidateId'] == 'szse-r2e-year-' + digest(json.dumps(identity,sort_keys=True,ensure_ascii=False).encode()), 'CANDIDATE_IDENTITY'
            assert row['sourceSha256'] == artifacts['year-2022-history']['sha256']
            assert row['formalEligible'] is False and row['releaseAvailableAt'] is None and row['provenFirstRelease'] is False
            field = row['field']
            assert field in ('turnoverValue','totalMarketCap')
            assert row['locator']['pageNumber'] == (219 if field == 'turnoverValue' else 223)
            assert row['rawUnit'] == ('亿元人民币' if field == 'turnoverValue' else '10亿元人民币')
            day = date.fromisoformat(row['tradeDate'])
            assert day.year == 2022 and int(row['locator']['dayText']) == day.day
    report_path = OUT / 'workstream-report.v1.json'
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding='utf-8'))
        assert report['calendar']['status'] == 'UNKNOWN' and report['calendar']['targetCount'] is None, 'MAX_A_B_IS_NOT_A_CALENDAR'
        assert report['counts']['newCandidateCount'] == 484
        assert report['counts']['formalCount'] == report['counts']['strictPitCount'] == 0
        for field in report['fieldMatrix']:
            assert field['status'] == 'NOT_ADMITTED' and field['formalCount'] == field['strictPitCount'] == 0
            assert field['candidateCount'] == (0 if field['field'] == 'negotiableMarketCap' else 242)


def year_candidates():
    """Read visually reviewed PDF table geometry, without inferring blank days."""
    import pdfplumber
    source = next(r for r in load_records() if r['evidenceId'] == 'year-2022-history')
    pdf = source_path(source)
    assert pdf.exists(), 'RAW_MISSING_FULL_REPLAY_NOT_RUN'
    pdf_sha = digest(pdf.read_bytes())
    assert pdf_sha == source['sha256'], 'SOURCE_BYTES_CHANGED'
    fields = [(219, 'turnoverValue', '每日成交金额表', '亿元人民币'),
              (223, 'totalMarketCap', '每日市价总值表', '10亿元人民币')]
    records = []
    with pdfplumber.open(pdf, pages=[11, 219, 223]) as doc:
        toc = doc.pages[0].extract_text()
        assert '创业板' in toc and '204' in toc and '208' in toc
        for page, (number, field, title, unit) in zip(doc.pages[1:], fields):
            text = page.extract_text()
            assert title in text and unit in text and '2022' in text
            words = page.extract_words(x_tolerance=1)
            months = ['Jan.','Feb.','Mar.','Apr.','May','Jun.','Jul.','Aug.','Sep.','Oct.','Nov.','Dec.']
            headers = []
            for month in months:
                found = [w for w in words if w['text'] == month]
                assert len(found) == 1
                headers.append(found[0])
            centers = [(h['x0'] + h['x1']) / 2 for h in headers]
            edges = [95] + [(a+b)/2 for a,b in zip(centers,centers[1:])] + [512]
            markers = [w for w in words if 75 < w['x0'] < 90 and
                       re.fullmatch(r'[1-9]|[12][0-9]|3[01]', w['text'])]
            assert sorted(int(w['text']) for w in markers) == list(range(1,32))
            for marker in markers:
                for month in range(1,13):
                    cell = sorted([w for w in words if abs(w['top']-marker['top']) < 0.2 and
                                   edges[month-1] < (w['x0']+w['x1'])/2 < edges[month]], key=lambda w:w['x0'])
                    if not cell:
                        continue
                    token = ' '.join(w['text'] for w in cell)
                    assert re.fullmatch(r'\d{1,3} \d{3}\.\d{2}', token), token
                    trade_date = date(2022, month, int(marker['text'])).isoformat()
                    record = dict(sourceFamily='SZSE_YEARBOOK_2022_CHINEXT', scope='SZSE_CHINEXT_BOARD_LABEL_ONLY',
                        tradeDate=trade_date, field=field, rawValueText=token, rawUnit=unit,
                        status='CANDIDATE_ONLY', releaseAvailableAt=None, provenFirstRelease=False,
                        historicalVintageStatus='UNPROVEN', formalEligible=False,
                        sourceArtifact='year-2022-history', sourceSha256=pdf_sha,
                        locator=dict(kind='PDF_PAGE_CELL', pageNumber=number, monthHeader=months[month-1],
                                     dayText=marker['text'], bbox=[round(min(w['x0'] for w in cell),3),
                                       round(min(w['top'] for w in cell),3),round(max(w['x1'] for w in cell),3),
                                       round(max(w['bottom'] for w in cell),3)]))
                    record['candidateId'] = 'szse-r2e-year-' + digest(json.dumps(record,sort_keys=True,ensure_ascii=False).encode())
                    records.append(record)
    return sorted(records, key=lambda r:(r['tradeDate'],r['field']))


def build_candidates():
    path = OUT / 'yearbook-candidates.v1.json'
    rows = year_candidates()
    out = dict(schemaVersion='1.0.0', role='CANDIDATE_ONLY_NOT_FORMAL_OBSERVATION',
               sourceFamily='SZSE_YEARBOOK_2022_CHINEXT',
               parserVersion='r2e-szse-yearbook-fixed-table-v1',
               candidateCount=len(rows), formalCount=0, strictPitCount=0,
               calendarInference='FORBIDDEN_BLANK_CELLS_NOT_CLOSED_DATES',
               candidateDateCount=len({r['tradeDate'] for r in rows}), candidates=rows)
    sealed_write(path, (json.dumps(out,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({k:v for k,v in out.items() if k != 'candidates'}))


def replay_candidates():
    validate(replay_text=False)
    artifact = json.loads((OUT / 'yearbook-candidates.v1.json').read_text(encoding='utf-8'))
    rows = year_candidates()
    assert rows == artifact['candidates']
    assert artifact['candidateCount'] == len(rows)
    assert artifact['formalCount'] == artifact['strictPitCount'] == 0
    assert artifact['candidateDateCount'] == len({r['tradeDate'] for r in rows})
    assert len({r['candidateId'] for r in rows}) == len(rows)
    assert all(r['formalEligible'] is False and r['releaseAvailableAt'] is None for r in rows)
    assert len(rows) == 484 and len({r['tradeDate'] for r in rows}) == 242
    # Independent printed monthly totals, PDF page 219, last table row.
    expected = ['47437.10','34230.63','52441.63','31469.59','28789.60','42453.78',
                '40909.58','47576.90','27746.35','25224.69','40155.72','32345.72']
    for month, total in enumerate(expected, 1):
        selected = [r for r in rows if r['field'] == 'turnoverValue' and int(r['tradeDate'][5:7]) == month]
        actual = sum(Decimal(r['rawValueText'].replace(' ', '')) for r in selected)
        assert abs(actual - Decimal(total)) <= Decimal('0.005') * (len(selected)+1), 'COLUMN_SUM_MISMATCH'
    assert not any(r['tradeDate'] == '2022-01-01' for r in rows)
    assert next(r for r in rows if r['tradeDate']=='2022-07-04' and r['field']=='turnoverValue')['rawValueText'] == '2 094.68'
    print(json.dumps(dict(status='PASS', candidateCount=len(rows), formalCount=0, strictPitCount=0)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['fetch', 'fetch-followup', 'validate', 'validate-compact', 'build-candidates', 'replay-candidates'])
    args = parser.parse_args()
    if args.command.startswith('fetch'):
        fetch(args.command == 'fetch-followup')
    elif args.command == 'build-candidates':
        build_candidates()
    elif args.command == 'replay-candidates':
        replay_candidates()
    elif args.command == 'validate-compact':
        validate(replay_text=False, compact=True)
    else:
        validate()
