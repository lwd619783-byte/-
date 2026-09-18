"""Explicit Slice 5 D0 capture. New directory only; never updates metric owners/pins."""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[2]
# Identities discovered on EIA official Petroleum history pages, reviewed in Slice 5.
SERIES = {
    'WCRFPUS2': 'Weekly U.S. Field Production of Crude Oil (Thousand Barrels per Day)',
    'WCREXUS2': 'Weekly U.S. Exports of Crude Oil (Thousand Barrels per Day)',
    'WCRRIUS2': 'Weekly U.S. Refiner Net Input of Crude Oil (Thousand Barrels per Day)',
}


class Downloads(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None
        self.text = ''
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href = dict(attrs).get('href')
            self.text = ''

    def handle_data(self, data):
        if self.href:
            self.text += data

    def handle_endtag(self, tag):
        if tag == 'a':
            if self.text.strip() == 'Download Data (XLS File)':
                self.links.append(self.href)
            self.href = None


def acquire(series, capture_name):
    if series not in SERIES or not re.fullmatch(r'eia-petroleum-[a-z0-9-]+', capture_name):
        raise ValueError('REVIEWED_SERIES_AND_VERSIONED_CAPTURE_REQUIRED')
    dest = ROOT / 'research-data/industry' / capture_name
    if dest.exists():
        raise RuntimeError('CAPTURE_ALREADY_EXISTS')
    url = f'https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s={series}'
    captures = []

    def fetch(source, ext, role):
        with urlopen(Request(source, headers={'User-Agent': 'Mozilla/5.0'}), timeout=45) as response:
            if response.status != 200 or response.url != source:
                raise RuntimeError('EXACT_OFFICIAL_SOURCE_REQUIRED')
            body = response.read()
        if ext == 'xls' and not body.startswith(bytes.fromhex('d0cf11e0a1b11ae1')):
            raise RuntimeError('SOURCE_FORMAT_MISMATCH')
        digest = hashlib.sha256(body).hexdigest()
        captures.append((body, dict(url=source, finalUrl=source, status=200,
            path=(dest / 'raw' / f'{digest}.{ext}').relative_to(ROOT).as_posix(),
            sha256=digest, byteLength=len(body), acquiredAt=datetime.now(timezone.utc).isoformat(), role=role)))
        return body

    raw = fetch(url, 'html', 'SERIES_HISTORY')
    html = raw.decode('utf8')
    titles = re.findall(r'<title>(.*?)</title>', html, re.I | re.S)
    if len(titles) != 1 or ' '.join(titles[0].split()) != SERIES[series]:
        raise RuntimeError('EXACT_TITLE_REQUIRED')
    parser = Downloads()
    parser.feed(html)
    if len(parser.links) != 1:
        raise RuntimeError('EXACT_DOWNLOAD_REQUIRED')
    download = urljoin(url, parser.links[0])
    if download != f'https://www.eia.gov/dnav/pet/hist_xls/{series}w.xls':
        raise RuntimeError('OFFICIAL_SERIES_DOWNLOAD_REQUIRED')
    fetch(download, 'xls', 'OFFICIAL_DOWNLOAD')
    dest.mkdir()
    (dest / 'raw').mkdir()
    for body, capture in captures:
        (ROOT / capture['path']).write_bytes(body)
    manifest = dict(schemaVersion='eia-petroleum-capture.v1', id=capture_name,
                    revision='1', series=series, frequency='W', captures=[c for _, c in captures])
    (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8', newline='\n')
    print(json.dumps(dict(series=series, title=SERIES[series], download=download,
                         release=re.findall(r'(?<!Next )Release Date: \d+/\d+/\d+', html), captures=manifest['captures'])))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--series', required=True, choices=SERIES)
    parser.add_argument('--capture-name', required=True)
    args = parser.parse_args()
    acquire(args.series, args.capture_name)
