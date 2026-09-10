"""Bounded, append-only BSE R2-E public evidence acquisition and byte replay."""
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

HERE = Path(__file__).resolve().parent


def official(url):
    return urlsplit(url).scheme == 'https' and urlsplit(url).hostname == 'www.bse.cn'


class Redirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not official(newurl):
            raise ValueError('NON_OFFICIAL_REDIRECT')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def replay():
    plan = json.loads((HERE / 'request-plan.v1.json').read_text(encoding='utf-8'))
    rows = []
    for job in plan['requests']:
        m = json.loads((HERE / 'raw' / (job['requestId'] + '.json')).read_text(encoding='utf-8'))
        assert m['request'] == job
        assert datetime.fromisoformat(m['attemptedAt']).utcoffset() is not None
        if 'bodyPath' in m:
            path = (HERE / m['bodyPath']).resolve()
            assert path.is_relative_to((HERE / 'raw').resolve())
            body = path.read_bytes()
            assert len(body) == m['byteSize']
            assert hashlib.sha256(body).hexdigest() == m['sha256']
        if 'byteOffset' in job:
            parent = HERE / 'raw' / (job['parent'] + '.body')
            token = job['text'].encode('utf-8')
            assert parent.read_bytes()[job['byteOffset']:job['byteOffset'] + len(token)] == token
        rows.append(m)
    return rows


def fetch():
    plan = json.loads((HERE / 'request-plan.v1.json').read_text(encoding='utf-8'))
    assert len(plan['requests']) <= plan['maxRequests']
    assert len({j['requestId'] for j in plan['requests']}) == len(plan['requests'])
    (HERE / 'raw').mkdir(exist_ok=True)
    for job in plan['requests']:
        path = HERE / 'raw' / (job['requestId'] + '.json')
        if path.exists():
            continue
        assert official(job['url'])
        m = {'request': job, 'attemptedAt': datetime.now(timezone.utc).isoformat(timespec='seconds')}
        try:
            try:
                response = build_opener(Redirect()).open(Request(job['url'],
                    data=job.get('form', '').encode() if job['method'] == 'POST' else None,
                    headers={'User-Agent': 'investment-research-r2e-bse/1.0'}), timeout=plan['timeoutSeconds'])
            except HTTPError as exc:
                response = exc
            with response:
                assert official(response.url)
                m.update(status=response.status, finalUrl=response.url, contentType=response.headers.get('Content-Type', ''))
                b = response.read(plan['maxResponseBytes'] + 1)
                if len(b) > plan['maxResponseBytes']:
                    raise ValueError('RESPONSE_SIZE_LIMIT')
                body = HERE / 'raw' / (job['requestId'] + '.body')
                with body.open('xb') as output:
                    output.write(b)
                m.update(bodyPath=body.relative_to(HERE).as_posix(), byteSize=len(b), sha256=hashlib.sha256(b).hexdigest())
        except (OSError, ValueError) as exc:
            m['error'] = type(exc).__name__
        with path.open('x', encoding='utf-8', newline='\n') as output:
            output.write(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
        print(job['requestId'], m.get('status'), m.get('error'), flush=True)
    replay()


if __name__ == '__main__':
    if sys.argv[1:] == ['fetch']:
        fetch()
    elif sys.argv[1:] == ['replay']:
        rows = replay()
        print(json.dumps({'status': 'PASS', 'captureCount': len(rows), 'httpSuccess': sum(200 <= r.get('status', 0) < 300 for r in rows)}))
    else:
        raise SystemExit('usage: probe.py fetch|replay')
