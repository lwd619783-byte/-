"""R2-E calendar evidence inventory; never synthesizes exchange sessions."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

from .all_a_admission import AS_OF, END, ERAS, ROOT, seal
from .hashing import atomic_write_bytes, sha256_bytes, canonical_sha256
from .historical_validator import require, safe_file
from .sse_source import strict_json

FOLDER = Path('research-data/market-regime/source-catalog/r2-e/calendar')
JOURNAL = FOLDER / 'retrieval.v1.json'
REPORT = FOLDER / 'foundation.v1.json'
JOURNALS = ('retrieval.v1.json', 'archive-retrieval.v1.json', 'pagination-retrieval.v1.json',
            'pagination-runtime.v1.json', 'archive-navigation.v1.json', 'archive-renderer.v1.json',
            'archive-utils.v1.json', 'archive-others.v1.json', 'archive-menu.v1.json',
            'archive-common.v1.json', 'archive-pages.v1.json', 'archive-notices.v1.json',
            'archive-legacy-notices.v1.json')
REVIEWED_HASHES = (
    '0949591c75ef7670b92a9f394a4f9564351b6a1bf5cca16dbe92a214f14efe22',
    'b56c4ca5d2ceac6acb7ca49048736e305c6b9335a784f7aa8fd86e647c95b961',
    'c94f863efd2414bba9ecaa18b50ee8b7dcbaaeca0e32e8365210a769a476878d',
    'e8ba1f539359b261a359e19a7a997ae3c924627356c1351c1b91f336eaeec7c1',
    '750b1691042bc03d8102f6a40b02e3f4808a628cc35d5e7fba31d47c1a977a5d',
    'b26d05a7a537eea375b6ca78d0b73e46dc0a00dc00a42d398c68c50f856b9f22',
    '6441ce5e3b872ca95b69d5d67961f90ad90d4031ce3d4b8370de71d1ea90b30f',
    '07c030cf7a06ce2081f0211617e279ed170341fab6ba2c7b795b00fa55120fdb',
    'ce7bc2b77950410a62c9fbcfa1b20c2c342faa47cf7e5769e2e4acfd544900bf',
    '82b49fd4eb3dfc5d3932c5d046b8074b22e71699f765d3a8952231505b1dde16',
    'ee89afce66c3734cd6f4c9d5d250018d74432f5f0b19cbf808ddf904192f2751',
    '37ddbc48d04f03af80f612a9abd35222960901c6397740369004784da6aa816a',
    'eccc3ac5ffdf00e91f124ca691b406c01fb9552ebd2c13650ecfd42b5729fd51',
)
SEEDS = (
    ('SSE', 'https://www.sse.com.cn/disclosure/dealinstruc/closed/'),
    ('SZSE', 'https://investor.szse.cn/English/services/trading/calendar/index.html'),
    ('SZSE', 'https://www.szse.cn/disclosure/index/'),
    ('BSE', 'https://www.bse.cn/disclosure/tradingtips.html'),
)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value:
                self.links.append(value)


def links(body, url):
    parser = Links()
    parser.feed(body.decode('utf-8', errors='replace'))
    return sorted({urljoin(url, link) for link in parser.links
                   if urlsplit(urljoin(url, link)).scheme in ('https', 'http')})


def official_url(exchange, url):
    u = urlsplit(url)
    require(u.scheme in ('https', 'http') and not u.username and not u.password
            and (u.hostname or '').endswith({'SSE': '.sse.com.cn', 'SZSE': '.szse.cn', 'BSE': '.bse.cn'}[exchange]), 'NON_OFFICIAL_HOST')


class OfficialRedirect(HTTPRedirectHandler):
    def __init__(self, exchange):
        super().__init__()
        self.exchange = exchange

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        official_url(self.exchange, newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def capture(exchange, url, discovery, *, root=ROOT):
    official_url(exchange, url)
    row = dict(exchange=exchange, requestedUrl=url, discovery=discovery,
               attemptedAt=datetime.now(timezone.utc).isoformat(), httpStatus=None,
               finalUrl=None, storedBytes=None, outcome='BLOCKED')
    try:
        request = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': url})
        try:
            response = build_opener(OfficialRedirect(exchange)).open(request, timeout=18)
        except HTTPError as exc:
            response = exc
        with response:
            official_url(exchange, response.url)
            row.update(httpStatus=response.status, finalUrl=response.url)
            body = response.read(4_000_001)
        require(len(body) <= 4_000_000, 'RESPONSE_SIZE_LIMIT')
        digest = sha256_bytes(body)
        path = FOLDER / 'raw' / (digest + '.body')
        if (root / path).exists():
            require((root / path).read_bytes() == body, 'ARCHIVE_COLLISION')
        else:
            atomic_write_bytes(root / path, body)
        row['storedBytes'] = dict(localPath=path.as_posix(), sha256=digest, byteSize=len(body))
        row['outcome'] = 'RETRIEVED' if row['httpStatus'] == 200 else 'HTTP_ERROR'
        row['links'] = links(body, row['finalUrl']) if row['httpStatus'] == 200 else []
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        # Error classes are enough for failure attribution; no proxy/config values.
        row['errorClass'] = type(exc).__name__
    return row


def write_new(path, obj):
    data = (json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
    if path.exists():
        require(strict_json(path.read_bytes()) == obj, 'SEALED_EVIDENCE_EXISTS')
    else:
        atomic_write_bytes(path, data)


def fetch(*, root=ROOT):
    require(not (root / JOURNAL).exists(), 'SEALED_RETRIEVAL_EXISTS')
    rows = [capture(e, u, dict(kind='OFFICIAL_SEARCH_DISCOVERY', parent=None), root=root) for e, u in SEEDS]
    # Only explicit links on the captured current closure page, no guessed years/IDs.
    for parent in list(rows):
        if parent['exchange'] != 'SSE':
            continue
        for url in parent.get('links', []):
            if '/disclosure/announcement/general/c/' in url:
                rows.append(capture('SSE', url, dict(kind='SAVED_PARENT_LINK', parent=parent['requestedUrl']), root=root))
    write_new(root / JOURNAL, seal(dict(kind='R2_E_CALENDAR_RETRIEVAL', version='v1', attempts=rows)))


def replay(journal, *, root=ROOT, parents=None):
    require(journal == seal({k: v for k, v in journal.items() if k != 'contentSha256'}), 'JOURNAL_HASH')
    rows = journal['attempts']
    require(len({r['requestedUrl'] for r in rows}) == len(rows), 'DUPLICATE_REQUEST')
    for r in rows:
        official_url(r['exchange'], r['requestedUrl'])
        require(datetime.fromisoformat(r['attemptedAt']).tzinfo is not None, 'NAIVE_RETRIEVAL_TIME')
        if r['finalUrl']:
            official_url(r['exchange'], r['finalUrl'])
        require(r['outcome'] in ('BLOCKED', 'HTTP_ERROR', 'RETRIEVED'), 'INVALID_OUTCOME')
        require((r['outcome'] == 'RETRIEVED') == (r['httpStatus'] == 200 and r['storedBytes'] is not None), 'HTTP_OUTCOME_MISMATCH')
        if r['storedBytes']:
            s = r['storedBytes']
            b = safe_file(root, s['localPath']).read_bytes()
            require(sha256_bytes(b) == s['sha256'] and len(b) == s['byteSize'], 'RAW_BYTES_MISMATCH')
            if r['outcome'] == 'RETRIEVED':
                require(r['links'] == links(b, r['finalUrl']), 'LINK_REPLAY_MISMATCH')
        parent = r['discovery']['parent']
        if parent:
            matches = [p for p in (parents or rows) if p['requestedUrl'] == parent]
            require(len(matches) == 1, 'DISCOVERY_PARENT_MISSING')
            kind = r['discovery']['kind']
            if kind == 'SAVED_PARENT_LINK':
                require(r['requestedUrl'] in matches[0]['links'], 'DISCOVERY_LINK_MISSING')
            else:
                body = safe_file(root, matches[0]['storedBytes']['localPath']).read_text(encoding='utf-8')
                token = r['discovery']['text']
                if kind == 'SAVED_SCRIPT_URL_ATTRIBUTE':
                    require('url="' + token + '"' in body and r['requestedUrl'] == urljoin(parent, token), 'SCRIPT_URL_MISMATCH')
                elif kind in ('REQUIREJS_DATA_MAIN', 'REQUIREJS_MODULE'):
                    require('"' + token + '"' in body and r['requestedUrl'] == urljoin(parent, token + '.js'), 'MODULE_URL_MISMATCH')
                elif kind == 'SAVED_PAGINATION_RULE':
                    runtime = next(p for p in parents if p['requestedUrl'] == r['discovery']['script'])
                    script = safe_file(root, runtime['storedBytes']['localPath']).read_text(encoding='utf-8')
                    total = int(re.search(r"createPageHTML\('paging',(\d+),", body)[1])
                    first = re.search(r'id="pageParam" data="[^"]+" url="([^"]+)"', body)[1]
                    n = r['discovery']['page']
                    require(token == '(page == 1 ? "" : "_" + page)' and token in script and 2 <= n <= total, 'PAGINATION_RULE_MISMATCH')
                    require(r['requestedUrl'] == urljoin(parent, first.removesuffix('.shtml') + '_' + str(n) + '.shtml'), 'PAGINATION_URL_MISMATCH')
                else:
                    raise ValueError('UNKNOWN_DISCOVERY')


def build(*, root=ROOT):
    journals = []
    for filename, expected in zip(JOURNALS, REVIEWED_HASHES, strict=True):
        extra = strict_json((root / FOLDER / filename).read_bytes())
        require(extra['contentSha256'] == expected, 'REVIEWED_CALENDAR_IDENTITY_MISMATCH')
        replay(extra, root=root, parents=[r for j in journals for r in j['attempts']] + extra['attempts'])
        journals.append(extra)
    inputs = []
    for exchange, folder in [('SSE', 'sse-d1a'), ('SZSE', 'szse-d1b'), ('BSE', 'bse-d1c')]:
        p = Path('config/market-regime') / (exchange.lower() + '-source-contract.v1.json')
        c = strict_json((root / p).read_bytes())
        inputs.append(dict(exchange=exchange, path=p.as_posix(), contentSha256=canonical_sha256(c),
                           boundedSourceCalendar=c.get('calendar', c.get('calendars')),
                           fullOfficialCalendarStatus='UNKNOWN', officialTradingDayTargetCount=None,
                           r2CalendarStatus='BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED',
                           unprovenWindow=dict(start='2021-11-15' if exchange == 'BSE' else '2005-01-01', end=END)))
    captures = [r for j in journals for r in j['attempts']]
    notices = []
    for r in captures:
        if r['exchange'] == 'SSE' and '/c/' in r['requestedUrl'] and r['outcome'] == 'RETRIEVED':
            b = safe_file(root, r['storedBytes']['localPath']).read_bytes()
            title = re.search(r'<title[^>]*>(.*?)</title>', b.decode('utf-8'), re.S)
            if title:
                notices.append(dict(url=r['requestedUrl'], title=title[1].strip(), rawSha256=r['storedBytes']['sha256']))
    return seal(dict(kind='R2_E_CALENDAR_FOUNDATION', version='v1', datasetAsOf=AS_OF,
                     retrievalSha256=[j['contentSha256'] for j in journals], inputs=inputs,
                     officialNotices=notices,
                     requestCount=len(captures), retrievedCount=sum(r['outcome'] == 'RETRIEVED' for r in captures),
                     blockedRetrievals=[r for r in captures if r['outcome'] != 'RETRIEVED'],
                     status='UNKNOWN', targetCount=None, dailyGrid=None,
                     eraDenominators=[dict(marketScopeVersionId=e, start=s, end=t,
                         requiredExchanges=['SSE', 'SZSE'] + (['BSE'] if s == '2021-11-15' else []),
                         targetCount=None, status='UNKNOWN',
                         reasons=['COMPLETE_OFFICIAL_SESSION_ENUMERATION_UNPROVEN',
                                  'CALENDAR_REVISION_ENUMERATION_UNPROVEN',
                                  'R2_LITERAL_DATE_LOCATOR_NOT_SATISFIED']) for e, s, t in ERAS],
                     evidenceLimit='Current official pages and explicitly linked notices are retrieval evidence only. No weekday, annual-count, daily-response or cross-exchange inference. Full historical archive enumeration remains incomplete.'))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['fetch', 'build', 'validate'])
    a = p.parse_args()
    if a.command == 'fetch':
        fetch()
    else:
        result = build()
        if a.command == 'build':
            write_new(ROOT / REPORT, result)
        else:
            require(strict_json((ROOT / REPORT).read_bytes()) == result, 'FOUNDATION_REPLAY_MISMATCH')
        print(json.dumps(dict(validation='PASS', targetCount=result['targetCount'], eras=len(result['eraDenominators']))))


if __name__ == '__main__':
    main()
