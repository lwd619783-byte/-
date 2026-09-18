"""Manual official acquisition to a NEW capture directory; never updates owners or pins."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--capture-name', required=True)
    args = parser.parse_args()
    if not args.capture_name.startswith('eia-petroleum-') or not all(c.isalnum() or c == '-' for c in args.capture_name):
        raise ValueError('VERSIONED_CAPTURE_NAME_REQUIRED')
    dest = ROOT / 'research-data/industry' / args.capture_name
    if dest.exists():
        raise RuntimeError('CAPTURE_ALREADY_EXISTS')
    plan = json.loads((ROOT / 'config/industry/eia-commercial-crude-stocks.v1.json').read_text(encoding='utf8'))
    captures = []
    for url, ext, role in [(plan['source']['url'], 'html', 'SERIES_HISTORY'), (plan['source']['downloadUrl'], 'xls', 'OFFICIAL_DOWNLOAD')]:
        if urlparse(url).scheme != 'https' or urlparse(url).hostname != 'www.eia.gov':
            raise RuntimeError('OFFICIAL_EIA_SOURCE_REQUIRED')
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=45) as response:
            if response.status != 200 or response.url != url:
                raise RuntimeError('EXACT_OFFICIAL_SOURCE_REQUIRED')
            body = response.read()
        if (ext == 'html' and plan['source']['title'].encode() not in body) or (ext == 'xls' and not body.startswith(bytes.fromhex('d0cf11e0a1b11ae1'))):
            raise RuntimeError('SOURCE_FORMAT_MISMATCH')
        digest = hashlib.sha256(body).hexdigest()
        captures.append((body, dict(url=url, finalUrl=url, status=200, path=(dest / 'raw' / f'{digest}.{ext}').relative_to(ROOT).as_posix(), sha256=digest, byteLength=len(body), acquiredAt=datetime.now(timezone.utc).isoformat(), role=role)))
    # Exclusive directory creation prevents overwrite even if another capture won the race.
    dest.mkdir()
    (dest / 'raw').mkdir()
    for body, capture in captures:
        (ROOT / capture['path']).write_bytes(body)
    manifest = dict(schemaVersion='eia-petroleum-capture.v1', id=args.capture_name, revision='1', series=plan['source']['series'], frequency='W', captures=[c for _, c in captures])
    (dest / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8', newline='\n')
    print('Retained official bytes; explicit review/replay required; no admission or release-time proof.')


if __name__ == '__main__':
    main()
