"""Read-only reconciliation of configured, previously tracked private entities.

No broad IPO scan, Entity creation, provider refresh, admission or Universe mutation.
Default probes the current private set; --baseline rechecks the retained stale set;
--replay uses hash-checked official bytes with that same historical baseline.
"""
import argparse
import datetime as dt
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PLAN = ROOT / 'config/listing-status/tracked-pre-ipo.v1.json'


def official(url):
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != 'https' or parsed.hostname != 'www.sse.com.cn'
            or parsed.username or parsed.password or parsed.port not in (None, 443)
            or not parsed.path.startswith('/disclosure/announcement/')
            or parsed.query or parsed.fragment):
        raise ValueError('OFFICIAL_SUPPORTED_SOURCE_REQUIRED')
    return url


class OfficialRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        official(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_official(url):
    official(url)
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.build_opener(OfficialRedirect()).open(request, timeout=30) as response:
        official(response.url)
        if response.status != 200:
            raise ValueError('HTTP_STATUS_NOT_200')
        raw = response.read(2_000_001)
        if not raw or len(raw) > 2_000_000:
            raise ValueError('INVALID_SOURCE_SIZE')
        return response.url, raw


def read_plan():
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    tracked = plan['tracked']
    if plan['schemaVersion'] != 'listing-status-reconciliation.v1' or len({t['id'] for t in tracked}) != len(tracked):
        raise ValueError('INVALID_TRACKED_PLAN')
    return tracked


def parse_official(raw, target, as_of):
    # Limit extraction to the actual issuer announcement, excluding site navigation.
    html = raw.decode('utf-8', errors='strict')
    title = re.search(r'<span\s+id="searchTitle"[^>]*>(.*?)</span>', html, re.S)
    body = re.search(r'<div[^>]+class="[^\"]*article-infor[^\"]*"[^>]*>(.*?)(?:<div[^>]+class="[^\"]*feedback_slide|</article>)', html, re.S)
    if not title or not body:
        raise ValueError('ANNOUNCEMENT_STRUCTURE_UNAVAILABLE')
    title_text = unescape(re.sub(r'<[^>]+>', ' ', title.group(1))).strip()
    text = unescape(re.sub(r'<[^>]+>', ' ', body.group(1)))
    # Exact issuer binding, not abbreviation or substring matching against another company.
    issuer = re.search(r'^关于(.+?股份有限公司)(?:人民币普通股股票|首次公开发行|上市状态)', title_text)
    if not issuer or issuer.group(1) != target['legalName']:
        return 'IDENTITY_CONFLICT', None, 'EXACT_LEGAL_NAME_MISMATCH'
    publication = re.search(r'\b(\d{4}-\d{2}-\d{2})\b', text)
    if not publication:
        raise ValueError('PUBLICATION_DATE_UNAVAILABLE')
    dt.date.fromisoformat(publication.group(1))
    if dt.date.fromisoformat(publication.group(1)) > as_of:
        raise ValueError('FUTURE_PUBLICATION')
    listing_marker = '起上市交易' in text
    if not listing_marker:
        if re.search(re.escape(target['legalName']) + r'[^。]{0,60}(?:目前|仍为)未上市', text):
            return 'UNCHANGED_PRIVATE', None, 'EXPLICIT_OFFICIAL_PRIVATE_STATUS'
        if re.search(r'(?:首次公开发行|上市申请)[^。]{0,80}(?:已受理|审核中|注册生效)', text):
            return 'IPO_IN_PROGRESS', None, 'OFFICIAL_IPO_PROGRESS_NOT_LISTING'
        raise ValueError('NO_CONCLUSIVE_OFFICIAL_STATUS')
    codes = set(re.findall(r'证券代码为["“](\d{6})["”]', text))
    names = set(re.findall(r'证券简称为["“]([^"”]+)["”]', text))
    dates = set(re.findall(r'(\d{4})年(\d{1,2})月(\d{1,2})日起上市交易', text))
    if len(codes) != 1 or len(names) != 1 or len(dates) != 1:
        return 'IDENTITY_CONFLICT', None, 'LISTING_FIELDS_MISSING_OR_AMBIGUOUS'
    if f"{target['legalName']}A股股票将在本所科创板上市交易" not in text or '上海证券交易所' not in text:
        return 'IDENTITY_CONFLICT', None, 'EXCHANGE_OR_BOARD_MISMATCH'
    year, month, day = next(iter(dates))
    listing_date = dt.date(int(year), int(month), int(day))
    code = next(iter(codes))
    if not code.startswith('688'):
        return 'IDENTITY_CONFLICT', None, 'STAR_MARKET_CODE_MISMATCH'
    candidate = {'id': target['id'], 'legalName': target['legalName'], 'name': next(iter(names)),
                 'code': code, 'exchange': 'SH', 'market': 'A股', 'board': '科创板', 'listingDate': listing_date.isoformat()}
    if target.get('reviewedMapping') is not None and candidate != target['reviewedMapping']:
        return 'IDENTITY_CONFLICT', None, 'REVIEWED_IDENTITY_MAPPING_MISMATCH'
    if listing_date > as_of:
        return 'IPO_IN_PROGRESS', candidate, 'OFFICIAL_LISTING_SCHEDULED_NOT_YET_EFFECTIVE'
    return 'LISTED_MIGRATION_REQUIRED', candidate, 'OFFICIAL_LISTING_DIFFERS_FROM_PRIVATE_BASELINE'


def reconcile(target, fetcher=fetch_official, as_of=None):
    as_of = as_of or dt.datetime.now(dt.timezone.utc).date()
    result = {'id': target.get('id'), 'baselineStatus': target.get('baselineStatus'),
              'baselineRef': target.get('baselineRef'), 'status': 'SOURCE_UNAVAILABLE',
              'reason': None, 'candidate': None, 'sourceUrl': target.get('sourceUrl'),
              'releaseAvailableAt': None, 'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'asOf': as_of.isoformat(), 'readOnly': True, 'automaticMigration': False}
    try:
        if target.get('baselineStatus') not in ('未上市', '待上市') or not target.get('id') or not target.get('legalName'):
            raise ValueError('TRACKED_PRIVATE_IDENTITY_REQUIRED')
        official(target['sourceUrl'])
        final_url, raw = fetcher(target['sourceUrl'])
        official(final_url)
        if not raw or len(raw) > 2_000_000:
            raise ValueError('INVALID_SOURCE_SIZE')
        result.update(responseUrl=final_url, rawBytes=len(raw), rawSha256=hashlib.sha256(raw).hexdigest())
        status, candidate, reason = parse_official(raw, target, as_of)
        result.update(status=status, candidate=candidate, reason=reason)
    except (OSError, ValueError, KeyError, TypeError):
        # Deliberately omit exception payloads, network/proxy credentials and unsafe fallback.
        result.update(status='SOURCE_UNAVAILABLE', reason='OFFICIAL_SOURCE_OR_PARSE_UNAVAILABLE', candidate=None)
    return result


def replay_fetcher(target):
    provenance_path = (PLAN.parent / target['retainedProvenance']).resolve()
    if not provenance_path.is_relative_to(PLAN.parent.resolve()):
        raise ValueError('INVALID_RETAINED_PATH')
    provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
    raw_path = (provenance_path.parent / provenance['rawPath']).resolve()
    if not raw_path.is_relative_to(provenance_path.parent):
        raise ValueError('INVALID_RAW_PATH')
    raw = raw_path.read_bytes()
    if (provenance['entityId'] != target['id'] or provenance['sourceUrl'] != target['sourceUrl']
            or provenance['httpStatus'] != 200 or len(raw) != provenance['rawBytes']
            or hashlib.sha256(raw).hexdigest() != provenance['rawSha256']):
        raise ValueError('RETAINED_PROVENANCE_MISMATCH')
    return lambda _: (provenance['responseUrl'], raw)


def current_private_ids(source_path=None):
    completed = subprocess.run(['node', str(ROOT / 'scripts/listing/private-company-ids.mjs'),
                                str(source_path or ROOT / 'src/data/privateCompanies.ts')],
                               capture_output=True, text=True, encoding='utf-8', timeout=30, check=False)
    if completed.returncode:
        raise ValueError('CURRENT_PRIVATE_SOURCE_UNAVAILABLE')
    ids = json.loads(completed.stdout)
    if not isinstance(ids, list) or any(not isinstance(identity, str) for identity in ids):
        raise ValueError('CURRENT_PRIVATE_SOURCE_UNAVAILABLE')
    return set(ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--baseline', action='store_true', help='live probe of previously tracked stale private baseline')
    mode.add_argument('--replay', action='store_true', help='offline retained bytes against stale private baseline')
    args = parser.parse_args()
    tracked = read_plan()
    if not (args.baseline or args.replay):
        try:
            current_ids = current_private_ids()
        except (OSError, ValueError, subprocess.SubprocessError):
            print(json.dumps({'schemaVersion': 'listing-status-reconciliation.v1', 'mode': 'current', 'readOnly': True,
                              'results': [{'id': None, 'status': 'SOURCE_UNAVAILABLE', 'reason': 'CURRENT_PRIVATE_SOURCE_UNAVAILABLE'}]}))
            return 1
        configured = {target['id'] for target in tracked}
        targets = [target for target in tracked if target['id'] in current_ids]
        results = [{'id': identity, 'status': 'SOURCE_UNAVAILABLE', 'reason': 'NO_REVIEWED_SOURCE_CONFIGURATION',
                    'readOnly': True, 'automaticMigration': False} for identity in sorted(current_ids - configured)]
    else:
        targets, results = tracked, []
    for target in targets:
        try:
            results.append(reconcile(target, replay_fetcher(target) if args.replay else fetch_official))
        except (OSError, ValueError, KeyError):
            results.append({'id': target['id'], 'status': 'SOURCE_UNAVAILABLE', 'reason': 'RETAINED_REPLAY_UNAVAILABLE'})
    print(json.dumps({'schemaVersion': 'listing-status-reconciliation.v1', 'mode': 'replay' if args.replay else 'baseline' if args.baseline else 'current',
                      'scope': 'configured tracked private/pre-IPO entities only', 'readOnly': True, 'results': results}, ensure_ascii=False, indent=2))
    return int(any(result['status'] in ('SOURCE_UNAVAILABLE', 'IDENTITY_CONFLICT') for result in results))


if __name__ == '__main__':
    raise SystemExit(main())
