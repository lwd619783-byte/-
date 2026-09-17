"""Explicit one-shot acquisition. Never used by tests/CI; refuses to replace a capture."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'research-data/industry/nbs-robotics-v1'


def main():
    plan = json.loads((ROOT / 'config/industry/nbs-robotics-pilot.v1.json').read_text(encoding='utf-8'))
    if DEST.exists():
        raise RuntimeError('CAPTURE_ALREADY_EXISTS: use a new versioned capture; never overwrite')
    captures = []
    # Finish all reads before writing. Raw bytes are never cleaned or line-normalized.
    for release in plan['releases']:
        with urlopen(release['url'], timeout=45) as response:
            final_url = response.url
            if response.status != 200 or urlparse(final_url).hostname != 'www.stats.gov.cn':
                raise RuntimeError('OFFICIAL_SOURCE_REQUIRED')
            body = response.read()
        captures.append((release, final_url, body, datetime.now(timezone.utc).isoformat()))
    (DEST / 'raw').mkdir(parents=True)
    records = []
    for release, final_url, body, acquired_at in captures:
        digest = hashlib.sha256(body).hexdigest()
        raw = DEST / 'raw' / (digest + '.html')
        raw.write_bytes(body)
        records.append({**release, 'finalUrl': final_url, 'sha256': digest,
                        'path': raw.relative_to(ROOT).as_posix(), 'byteLength': len(body),
                        'acquiredAt': acquired_at, 'role': 'REACQUIRED_OFFICIAL_PAGE'})
    manifest = {'schemaVersion': 'nbs-capture.v1', 'id': 'nbs-robotics-capture-v1',
                'revision': '1', 'generatedAt': datetime.now(timezone.utc).isoformat(), 'captures': records}
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'Captured {len(records)} official pages; release-to-original-bytes UNPROVED')


if __name__ == '__main__':
    main()
