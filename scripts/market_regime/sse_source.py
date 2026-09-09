"""SSE D1A source adapter. Acquisition evidence is not a historical observation.

The two official JSON families expose data dates, not release clocks. V1 parses
their original board rows into evidence candidates only. No implicit board sum,
publication clock, calendar interpolation or R2-A contract extension is made.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from .hashing import canonical_sha256, sha256_bytes
from .historical import canonical_order
from .historical_validator import require, safe_file


ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / 'config/market-regime/sse-source-contract.v1.json'
FIELDS = ('turnoverValue', 'totalMarketCap', 'negotiableMarketCap')
PARSER_VERSION = 'sse-daily-json-v1.0.0'


def strict_json(body: bytes):
    def pairs(items):
        out = {}
        for key, value in items:
            require(key not in out, 'DUPLICATE_JSON_KEY')
            out[key] = value
        return out

    def reject(value):
        raise ValueError('NONFINITE_JSON: ' + value)

    return json.loads(body.decode('utf-8'), object_pairs_hook=pairs, parse_constant=reject)


def locator(body: bytes, artifact_id: str, text: str) -> dict:
    token = text.encode('utf-8')
    require(bool(token) and body.count(token) == 1, 'AMBIGUOUS_BYTE_LOCATOR')
    return dict(artifactId=artifact_id, byteOffset=body.index(token), byteLength=len(token), text=text)


def replay_locator(loc: dict, artifacts: dict, root: Path) -> str:
    require(set(loc) == {'artifactId', 'byteOffset', 'byteLength', 'text'}, 'LOCATOR_KEYS')
    a = artifacts[loc['artifactId']]
    body = safe_file(root, a['localPath']).read_bytes()
    require(sha256_bytes(body) == a['sha256'] and len(body) == a['byteSize'], 'ARTIFACT_BYTES')
    offset, length = loc['byteOffset'], loc['byteLength']
    require(type(offset) is int and type(length) is int and offset >= 0 and length > 0, 'LOCATOR_BOUNDS')
    require(body[offset:offset + length] == loc['text'].encode('utf-8'), 'LOCATOR_REPLAY')
    return loc['text']


def result_spans(body: bytes) -> list[tuple[dict, str, int]]:
    """Decode top-level result rows and retain original text, never reserialize a locator."""
    text = body.decode('utf-8')
    document = strict_json(body)
    require(isinstance(document, dict) and isinstance(document.get('result'), list), 'RESULT_ARRAY_REQUIRED')
    decoder = json.JSONDecoder()
    pos = text.index('{') + 1
    while True:
        pos = re.compile(r'\s*').match(text, pos).end()
        if text[pos] == '}':
            raise ValueError('RESULT_ARRAY_REQUIRED')
        key, pos = decoder.raw_decode(text, pos)
        pos = re.compile(r'\s*:\s*').match(text, pos).end()
        value_start = pos
        _, end = decoder.raw_decode(text, pos)
        if key == 'result':
            pos = value_start + 1
            rows = []
            while True:
                pos = re.compile(r'\s*').match(text, pos).end()
                if text[pos] == ']':
                    return rows
                row, end = decoder.raw_decode(text, pos)
                require(isinstance(row, dict), 'ROW_OBJECT_REQUIRED')
                rows.append((row, text[pos:end], len(text[:pos].encode('utf-8'))))
                pos = re.compile(r'\s*').match(text, end).end()
                if text[pos] == ',':
                    pos += 1
                elif text[pos] != ']':
                    raise ValueError('INVALID_RESULT_ARRAY')
        pos = re.compile(r'\s*').match(text, end).end()
        if text[pos] == ',':
            pos += 1


def numeric_token(value):
    if value is None or value in ('', '-', '--'):
        return None
    require(isinstance(value, str) and re.fullmatch(r'\d+(?:\.\d+)?', value) is not None,
            'UNSUPPORTED_NUMERIC_TOKEN')
    require(Decimal(value).is_finite(), 'NONFINITE_VALUE')
    return value


def parse_daily(body: bytes, *, family: dict, requested_date: str, artifact_id: str) -> dict:
    date.fromisoformat(requested_date)
    document = strict_json(body)
    require(document.get('sqlId') == family['sqlId'], 'WRONG_SOURCE_FAMILY')
    require(not document.get('actionErrors') and not document.get('fieldErrors'), 'SOURCE_ERROR')
    require(document.get('isPagination') == 'false', 'PAGINATION_UNSUPPORTED')
    candidates, rejected = [], []
    for row, text, offset in result_spans(body):
        raw_date = row.get(family['dateKey'])
        require(isinstance(raw_date, str), 'DATA_DATE_MISSING')
        if family['familyId'] == 'legacy-day':
            require(re.fullmatch(r'\d{4}-\d{2}-\d{2} 00:00:00\.0', raw_date) is not None, 'DATA_DATE_FORMAT')
            trade_date = raw_date[:10]
        else:
            require(re.fullmatch(r'\d{8}', raw_date) is not None, 'DATA_DATE_FORMAT')
            trade_date = f'{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}'
        require(trade_date == requested_date, 'REQUEST_DATA_DATE_MISMATCH')
        code = row.get(family['boardKey'])
        scope = family['boardScopes'].get(code)
        row_locator = dict(artifactId=artifact_id, byteOffset=offset,
                           byteLength=len(text.encode('utf-8')), text=text)
        if scope not in ('SSE_MAIN_BOARD_A', 'SSE_STAR'):
            rejected.append(dict(boardCode=code, reason='MIXED_OR_NON_A_OR_UNKNOWN_SCOPE', locator=row_locator))
            continue
        if scope == 'SSE_STAR' and trade_date < '2019-07-22':
            raise ValueError('STAR_BEFORE_LAUNCH')
        for field in FIELDS:
            key = family['fieldKeys'][field]
            token = numeric_token(row.get(key))
            record = dict(familyId=family['familyId'], tradeDate=trade_date, boardCode=code,
                          scope=scope, field=field, rawFieldName=key, rawValueText=token,
                          rawUnit='亿元', parserVersion=PARSER_VERSION, locator=row_locator,
                          status='FIELD_MISSING' if token is None else 'CANDIDATE_ONLY')
            record['candidateId'] = 'sse-candidate-' + canonical_sha256(record)
            candidates.append(record)
    # Preserve duplicates as a conflict, even when values are identical. Fetch order is never truth.
    groups = {}
    for c in candidates:
        groups.setdefault((c['tradeDate'], c['scope'], c['field']), []).append(c)
    for group in groups.values():
        if len(group) > 1:
            for c in group:
                c['status'] = 'UNRESOLVED_RELEASE_CONFLICT'
    return dict(candidates=canonical_order(candidates), rejectedRows=canonical_order(rejected))


def calendar_inventory(artifacts: dict, config: dict, *, root: Path) -> dict:
    """Only the explicit 2020 exceptional closure/resumption window is enumerated.

    This is source inventory, not an invented full-year weekday calendar. R2-A
    currently requires ISO dates literally in its calendar evidence; Chinese
    notice text is retained here and is not relabelled as an R2 locator.
    """
    by_name = {a['fileName']: a for a in artifacts.values()}
    evidence = []
    for proof in config['proofs']:
        a = by_name[proof['fileName']]
        body = safe_file(root, a['localPath']).read_bytes()
        require(sha256_bytes(body) == a['sha256'], 'CALENDAR_BYTES')
        evidence.append(locator(body, a['artifactId'], proof['text']))
    # Normalized dates are a reviewed mapping of the exact cited Chinese notice,
    # not inferred by weekday, by a quote payload or by fetch time.
    closed = config['closedDates']
    opened = config['openDates']
    start, end = date.fromisoformat(config['start']), date.fromisoformat(config['end'])
    days = [(start + timedelta(days=i)).isoformat() for i in range((end-start).days + 1)]
    require(sorted(closed + opened) == days and len(set(closed + opened)) == len(days), 'CALENDAR_WINDOW_GAP')
    result = dict(calendarVersion=config['calendarVersion'], start=config['start'], end=config['end'],
                  openDates=opened, closedDates=closed, evidence=evidence,
                  supersedes=config['supersedes'], status='OFFICIAL_BOUNDED_WINDOW',
                  r2CalendarStatus='BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED')
    result['contentSha256'] = canonical_sha256(canonical_order(result))
    return result


def assess_day(trade_date: str, candidates: list[dict], calendar: dict | None, *, evidence_role='RAW_SOURCE') -> dict:
    date.fromisoformat(trade_date)
    result = {}
    for field in FIELDS:
        selected = [c for c in candidates if c['tradeDate'] == trade_date and c['field'] == field]
        blockers = []
        if evidence_role != 'RAW_SOURCE':
            blockers.append('NON_HISTORICAL_EVIDENCE')
        if not calendar or not calendar['start'] <= trade_date <= calendar['end']:
            blockers.append('OFFICIAL_CALENDAR_MISSING')
        elif trade_date not in calendar['openDates']:
            blockers.append('OFFICIAL_NON_TRADING_DAY')
        required_scopes = {'SSE_MAIN_BOARD_A'} | ({'SSE_STAR'} if trade_date >= '2019-07-22' else set())
        for scope in sorted(required_scopes):
            rows = [c for c in selected if c['scope'] == scope]
            if not rows or any(c['rawValueText'] is None for c in rows):
                blockers.append('FIELD_MISSING:' + scope)
            if len(rows) > 1 or any(c['status'] == 'UNRESOLVED_RELEASE_CONFLICT' for c in rows):
                blockers.append('UNRESOLVED_RELEASE_CONFLICT:' + scope)
        # These families have no audited official market-statistic release clock.
        # A date in a calendar announcement does not establish a market release.
        blockers.extend(['PIT_VINTAGE_UNPROVEN', 'FIELD_DEFINITION_APPLICABILITY_UNPROVEN'])
        if field == 'negotiableMarketCap':
            blockers.append('NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN')
        result[field] = dict(status='PARTIAL', blockers=sorted(set(blockers)),
                             candidateIds=sorted(c['candidateId'] for c in selected),
                             admittedObservationIds=[])
    return dict(tradeDate=trade_date, fields=result, status='PARTIAL')


def business_projection(inventory: dict) -> dict:
    return canonical_order({k: v for k, v in inventory.items() if k not in ('generatedAt', 'contentSha256')})


class SSEHistoricalMarketAdapter:
    """Concrete fail-closed R1 adapter with separately inspectable source inventory.

    V1 has no admitted historical release family. collect therefore returns None;
    callers must inspect field_status, never mistake parsed candidates for a
    VERIFIED ExchangeMarketObservation. Admission requires a reviewed successor
    source contract and existing R2-A build_dataset/validate_dataset, not a flag.
    """

    exchange = 'SSE'
    source_definition_id = 'sse-historical-source-v1-unadmitted'

    def __init__(self, inventory: dict):
        from .sse_inventory import validate_compact
        validate_compact(inventory)
        self._inventory = deepcopy(inventory)

    def field_status(self, trade_date: date | str) -> dict:
        day = trade_date.isoformat() if isinstance(trade_date, date) else trade_date
        return assess_day(day, self._inventory['candidates'], self._inventory['calendar'])

    def collect(self, trade_date: date):
        self.field_status(trade_date)
        return None
