"""Read-only official freshness probe; --retain-new creates a separate capture only.

Acquisition is not admission. New captures must be reviewed and replayed through
both existing metric owners before becoming Registry inputs.
"""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, build_opener

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path('research-data/industry/nbs-robotics-v1/manifest.json')
INDEX = 'https://www.stats.gov.cn/sj/zxfb/'


def official(url):
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname != 'www.stats.gov.cn' or parsed.port not in (None, 443) or parsed.username or parsed.password:
        raise ValueError('OFFICIAL_SOURCE_REQUIRED')
    return url


class OfficialRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        official(newurl)  # Reject before following a redirect, not after disclosure.
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url):
    official(url)
    with build_opener(OfficialRedirect).open(url, timeout=30) as response:
        official(response.url)
        if response.status != 200:
            raise OSError('HTTP_STATUS_UNAVAILABLE')
        body = response.read(4_000_001)
        if not body or len(body) > 4_000_000:
            raise OSError('SOURCE_BYTES_UNAVAILABLE')
        return response.url, body


class ReleaseLinks(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base, self.releases = base, set()

    def handle_starttag(self, tag, attrs):
        if tag != 'a':
            return
        attrs = dict(attrs)
        match = re.fullmatch(r'(\d{4})年(1[—-])?(\d{1,2})月份规模以上工业增加值增长.*', attrs.get('title', '').strip())
        if match:
            month = int(match[3])
            if not 2 <= month <= 12 or (match[2] and month != 2):
                raise ValueError('INDEX_PERIOD_INVALID')
            self.releases.add((f'{match[1]}-{month:02d}', official(urljoin(self.base, attrs.get('href', '')))))


def parse(body, period):
    # Reuse the exact reviewed parser for period, scope, table and both native columns.
    result = subprocess.run(['node', str(ROOT / 'scripts/industry/probe-parse.mjs'), period],
                            input=body, capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError('SOURCE_TABLE_INVALID')
    return json.loads(result.stdout)


def probe(root=ROOT, fetcher=fetch, parser=parse):
    checked_at = datetime.now(timezone.utc).isoformat()
    base = {'schemaVersion': 'nbs-freshness-probe.v1', 'checkedAt': checked_at,
            'discoveryUrl': INDEX, 'retainedManifest': MANIFEST.as_posix(),
            'releaseAvailableAt': None, 'productionAdmission': 'NOT_ADMITTED'}
    try:
        manifest = json.loads((root / MANIFEST).read_text(encoding='utf-8'))
        if manifest.get('schemaVersion') != 'nbs-capture.v1':
            raise ValueError('RETAINED_MANIFEST_INVALID')
        retained = max(manifest['captures'], key=lambda item: item['period'])
        official(retained['url'])
        if retained.get('finalUrl') != retained['url'] or retained.get('role') != 'REACQUIRED_OFFICIAL_PAGE':
            raise ValueError('RETAINED_SOURCE_IDENTITY')
        base['retainedPeriod'] = retained['period']
        base['retainedSha256'] = retained['sha256']
        raw_path = (root / retained['path']).resolve()
        if not raw_path.is_relative_to((root / 'research-data/industry').resolve()):
            raise ValueError('RETAINED_PATH_INVALID')
        raw = raw_path.read_bytes()
        if len(raw) != retained['byteLength'] or hashlib.sha256(raw).hexdigest() != retained['sha256']:
            raise ValueError('RETAINED_BYTES_DRIFT')
        index_url, index_body = fetcher(INDEX)
        official(index_url)
        index = ReleaseLinks(index_url)
        index.feed(index_body.decode('utf-8', errors='strict'))
        if not index.releases:
            raise ValueError('LATEST_RELEASE_NOT_DISCOVERED')
        period = max(p for p, _ in index.releases)
        links = sorted(url for p, url in index.releases if p == period)
        # Duplicate responsive links are deduplicated; distinct releases fail closed.
        if len(links) != 1:
            raise ValueError('LATEST_RELEASE_CONFLICTED')
        url = links[0]
        base.update(sourcePeriod=period, discoveredUrl=url, indexSha256=hashlib.sha256(index_body).hexdigest())
        # NBS publishes aliases of one document. Compare the retained URL itself
        # only when the discovered exact document filename is identical.
        if period == retained['period'] and Path(urlparse(url).path).name == Path(urlparse(retained['url']).path).name:
            url = retained['url']
        final_url, body = fetcher(url)
        official(final_url)
        if final_url != url:
            raise ValueError('SOURCE_LOCATION_CHANGED')
        digest = hashlib.sha256(body).hexdigest()
        base.update(sourceUrl=url, finalUrl=final_url, sourceSha256=digest,
                    byteLength=len(body))
        try:
            readings = parser(body, period)
            publication = readings['absolute']['publicationDateTime']
            if publication and datetime.fromisoformat(publication) > datetime.fromisoformat(checked_at):
                raise ValueError('PUBLICATION_AFTER_ACQUISITION')
        except ValueError as exc:
            if period == retained['period'] and digest != retained['sha256']:
                return {**base, 'status': 'SOURCE_CHANGED', 'reason': 'SAME_PERIOD_BYTES_CHANGED_TABLE_INVALID'}, None
            raise exc
        base['readings'] = readings
        if period < retained['period']:
            return {**base, 'status': 'SOURCE_CHANGED', 'reason': 'LATEST_PERIOD_REGRESSED'}, None
        if period == retained['period']:
            same = digest == retained['sha256'] and url == retained['url']
            return {**base, 'status': 'LATEST_ALREADY_RETAINED' if same else 'SOURCE_CHANGED',
                    'reason': 'EXACT_RETAINED_BYTES' if same else 'SAME_PERIOD_REVISION_OR_SOURCE_CHANGE'}, None
        return {**base, 'status': 'NEW_RELEASE_AVAILABLE', 'reason': 'NEW_PERIOD_VALIDATED'}, body
    except (ValueError, KeyError, OSError, subprocess.SubprocessError) as exc:
        # Do not serialize transport exception URLs/proxy details into artifacts.
        code = str(exc) if isinstance(exc, ValueError) and re.fullmatch('[A-Z_]+', str(exc)) else type(exc).__name__
        return {**base, 'status': 'SOURCE_UNAVAILABLE', 'reason': code}, None


def retain_new(result, body, root=ROOT):
    if result['status'] != 'NEW_RELEASE_AVAILABLE' or body is None:
        return None
    if not re.fullmatch(r'\d{4}-(0[2-9]|1[0-2])', result['sourcePeriod']):
        raise ValueError('PERIOD_INVALID')
    official(result['sourceUrl'])
    if result['finalUrl'] != result['sourceUrl']:
        raise ValueError('SOURCE_LOCATION_CHANGED')
    digest = hashlib.sha256(body).hexdigest()
    if digest != result['sourceSha256'] or len(body) != result['byteLength']:
        raise ValueError('PROBED_BYTES_DRIFT')
    folder = root / 'research-data/industry' / f"nbs-robotics-{result['sourcePeriod']}-{digest[:12]}"
    # Exclusive mkdir, then exclusive files: existing raw can never be replaced.
    folder.mkdir(exist_ok=False)
    (folder / 'raw').mkdir()
    raw_path = folder / 'raw' / f'{digest}.html'
    with raw_path.open('xb') as stream:
        stream.write(body)
    capture = {'period': result['sourcePeriod'], 'url': result['sourceUrl'],
               'finalUrl': result['finalUrl'], 'sha256': digest,
               'path': raw_path.relative_to(root).as_posix(), 'byteLength': len(body),
               'acquiredAt': result['checkedAt'], 'role': 'REACQUIRED_OFFICIAL_PAGE'}
    manifest = {'schemaVersion': 'nbs-capture.v1', 'id': folder.name, 'revision': '1',
                'generatedAt': result['checkedAt'], 'captures': [capture]}
    with (folder / 'manifest.json').open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    return (folder / 'manifest.json').relative_to(root).as_posix()


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--retain-new', action='store_true', help='Retain a validated new period in a new directory; never update owners/admission')
    parsed = args.parse_args()
    result, body = probe()
    result['newCapture'] = retain_new(result, body) if parsed.retain_new else None
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 1 if result['status'] in {'SOURCE_CHANGED', 'SOURCE_UNAVAILABLE'} else 0


if __name__ == '__main__':
    raise SystemExit(main())
