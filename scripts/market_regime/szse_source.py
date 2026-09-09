"""SZSE source evidence parser. V1 admits no historical market observations."""
from __future__ import annotations

import html
import json
import re
from copy import deepcopy
from datetime import date
from pathlib import Path

from .hashing import canonical_sha256, sha256_bytes
from .historical import canonical_order
from .historical_validator import require, safe_file

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / 'config/market-regime/szse-source-contract.v1.json'
FIELDS = ('turnoverValue', 'totalMarketCap', 'negotiableMarketCap')
PARSER_VERSION = 'szse-security-category-json-v1.0.0'


def strict_json(body: bytes):
    def pairs(items):
        out = {}
        for key, value in items:
            require(key not in out, 'DUPLICATE_JSON_KEY')
            out[key] = value
        return out
    def reject(value):
        raise ValueError('NONFINITE_JSON:' + value)
    return json.loads(body.decode('utf-8'), object_pairs_hook=pairs, parse_constant=reject)


def json_spans(body: bytes):
    """Address JSON by structural path while retaining exact original UTF-8 bytes."""
    document = strict_json(body)
    text = body.decode('utf-8')
    decoder = json.JSONDecoder()
    spans = {}
    def ws(pos):
        return re.compile(r'\s*').match(text, pos).end()
    def walk(pos, path):
        pos = ws(pos)
        start = pos
        value, end = decoder.raw_decode(text, pos)
        spans[path] = (value, len(text[:start].encode()), text[start:end])
        if isinstance(value, dict):
            pos = ws(pos + 1)
            while text[pos] != '}':
                key, pos = decoder.raw_decode(text, pos)
                pos = ws(pos)
                require(text[pos] == ':', 'JSON_COLON')
                pos = ws(walk(pos + 1, path + (key,)))
                if text[pos] == ',':
                    pos = ws(pos + 1)
        elif isinstance(value, list):
            pos, i = ws(pos + 1), 0
            while text[pos] != ']':
                pos = ws(walk(pos, path + (i,)))
                i += 1
                if text[pos] == ',':
                    pos = ws(pos + 1)
        return end
    walk(0, ())
    return document, spans


def locator(body, artifact_id, text):
    token = text.encode('utf-8')
    require(bool(token) and body.count(token) == 1, 'AMBIGUOUS_BYTE_LOCATOR')
    return dict(artifactId=artifact_id, byteOffset=body.index(token), byteLength=len(token), text=text)


def replay_locator(loc, artifacts, root):
    require(set(loc) == {'artifactId','byteOffset','byteLength','text'}, 'LOCATOR_KEYS')
    a = artifacts[loc['artifactId']]
    body = safe_file(root, a['localPath']).read_bytes()
    require(sha256_bytes(body) == a['sha256'] and len(body) == a['byteSize'], 'ARTIFACT_BYTES')
    offset, length = loc['byteOffset'], loc['byteLength']
    require(type(offset) is int and type(length) is int and offset >= 0 and length > 0, 'LOCATOR_BOUNDS')
    require(body[offset:offset+length] == loc['text'].encode(), 'LOCATOR_REPLAY')
    return loc['text']


def numeric_token(value):
    if value is None or value in ('', '-', '--'):
        return None
    require(isinstance(value, str) and re.fullmatch(r'(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?', value),
            'UNSUPPORTED_NUMERIC_TOKEN')
    return value


def candidate_identity(record):
    return 'szse-candidate-' + canonical_sha256({k:v for k,v in record.items() if k != 'candidateId'})


def parse_daily(body: bytes, *, family: dict, requested_date: str, artifact_id: str):
    require(date.fromisoformat(requested_date).isoformat() == requested_date, 'REQUEST_DATE_FORMAT')
    frozen = json.loads(CONTRACT_PATH.read_text(encoding='utf-8'))['families'][0]
    require(family == frozen and family['familyId'] == 'security-category', 'WRONG_SOURCE_FAMILY')
    doc, spans = json_spans(body)
    require(isinstance(doc, list) and 1 <= len(doc) <= 2, 'TAB_ARRAY_REQUIRED')
    tabs = []
    for i, tab in enumerate(doc):
        require(isinstance(tab, dict) and set(tab) == {'metadata','data','error'}, 'TAB_SCHEMA')
        m = tab['metadata']
        require(isinstance(m, dict) and m.get('catalogid') == family['catalogId'], 'WRONG_SOURCE_FAMILY')
        require(m.get('tabkey') in ('tab1','tab2') and m['tabkey'] not in tabs, 'DUPLICATE_OR_UNKNOWN_TAB')
        require(isinstance(tab['data'], list), 'DATA_ARRAY_REQUIRED')
        tabs.append(m['tabkey'])
    require('tab1' in tabs, 'TARGET_TAB_MISSING')
    ti = tabs.index('tab1')
    tab = doc[ti]
    m = tab['metadata']
    require(tab['error'] is None, 'SOURCE_ERROR')
    require(all(type(m.get(k)) is int and m[k] == v for k,v in
                {'pagesize':-1,'pageno':0,'pagecount':0,'recordcount':0}.items()), 'PAGINATION_UNSUPPORTED')
    require(m.get('name') == '证券类别统计' and m.get('pagetype') == 'tabs', 'TARGET_TABLE_IDENTITY')
    require(m.get('header') == '' and m.get('footer') == '' and m.get('notes') is None,
            'UNREVIEWED_TABLE_DEFINITION_NOTE')
    cond = [c for c in m.get('conditions',[]) if isinstance(c,dict) and c.get('name') == 'txtQueryDate']
    require(len(cond) == 1 and cond[0].get('inputType') == 'date', 'DATE_CONDITION_REQUIRED')
    if not tab['data']:
        require(m.get('subname') in ('',requested_date) and cond[0].get('defaultValue') in ('',requested_date),
                'REQUEST_DATA_DATE_MISMATCH')
        return dict(candidates=[], rejectedRows=[])
    require(m.get('subname') == requested_date and cond[0].get('defaultValue') == requested_date,
            'REQUEST_DATA_DATE_MISMATCH')
    cols = m.get('cols')
    require(isinstance(cols,dict) and cols.get('lbmc') == '证券类别', 'COLUMN_SCHEMA')
    for field, key in family['fieldKeys'].items():
        require(key not in cols or cols[key] == family['columnLabels'][key], 'FIELD_UNIT_OR_SEMANTICS_CHANGED')
    candidates, rejected = [], []
    for ri, row in enumerate(tab['data']):
        require(isinstance(row,dict) and isinstance(row.get('lbmc'),str), 'ROW_SCHEMA')
        label = html.unescape(row['lbmc']).strip()
        require('<' not in label and '>' not in label, 'UNSUPPORTED_SCOPE_MARKUP')
        _, offset, text = spans[(ti,'data',ri)]
        loc = dict(artifactId=artifact_id, byteOffset=offset, byteLength=len(text.encode()), text=text)
        scope = family['rowScopes'].get(label)
        if scope is None:
            rejected.append(dict(rowIndex=ri, rawScopeLabel=row['lbmc'],
                                 reason='MIXED_OR_NON_A_OR_UNKNOWN_SCOPE', locator=loc))
            continue
        require(not (scope == 'SZSE_SME_A' and requested_date >= '2021-04-06'), 'SME_AFTER_MERGER')
        require(not (scope == 'SZSE_CHINEXT_A' and requested_date < '2009-10-30'), 'CHINEXT_BEFORE_LAUNCH')
        for field in FIELDS:
            key = family['fieldKeys'][field]
            token = numeric_token(row.get(key)) if key in cols else None
            candidates.append(dict(familyId=family['familyId'], tradeDate=requested_date, rowIndex=ri,
                scope=scope, rawScopeLabel=row['lbmc'], field=field, rawFieldName=key, rawValueText=token,
                scopeEvidenceStatus='EXPLICIT_A_LABEL' if label.endswith('A股') else 'BOARD_LABEL_ONLY_A_MEMBERSHIP_UNPROVEN',
                rawUnit='亿元', parserVersion=PARSER_VERSION, locator=loc,
                status='FIELD_MISSING' if token is None else 'CANDIDATE_ONLY'))
    groups = {}
    for c in candidates:
        groups.setdefault((c['scope'],c['field']), []).append(c)
    for group in groups.values():
        if len(group) > 1:
            for c in group:
                c['status'] = 'UNRESOLVED_RELEASE_CONFLICT'
    for c in candidates:
        c['candidateId'] = candidate_identity(c)
    return dict(candidates=canonical_order(candidates), rejectedRows=canonical_order(rejected))


def assess_day(trade_date, candidates, calendar, *, evidence_role='RAW_SOURCE'):
    require(date.fromisoformat(trade_date).isoformat() == trade_date, 'REQUEST_DATE_FORMAT')
    scopes = {'SZSE_MAIN_A'}
    if trade_date < '2021-04-06':
        scopes.add('SZSE_SME_A')
    if trade_date >= '2009-10-30':
        scopes.add('SZSE_CHINEXT_A')
    fields = {}
    for field in FIELDS:
        rows = [c for c in candidates if c['tradeDate'] == trade_date and c['field'] == field]
        blockers = ['PIT_VINTAGE_UNPROVEN','FIELD_DEFINITION_APPLICABILITY_UNPROVEN']
        if evidence_role != 'RAW_SOURCE':
            blockers.append('NON_HISTORICAL_EVIDENCE')
        if not calendar or not calendar['start'] <= trade_date <= calendar['end']:
            blockers.append('OFFICIAL_CALENDAR_MISSING')
        elif trade_date not in calendar['openDates']:
            blockers.append('OFFICIAL_NON_TRADING_DAY')
        else:
            blockers.append('BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED')
        for scope in sorted(scopes):
            selected = [c for c in rows if c['scope'] == scope]
            if not selected or any(c['rawValueText'] is None for c in selected):
                blockers.append('FIELD_MISSING:' + scope)
            if len(selected) > 1 or any(c['status'] == 'UNRESOLVED_RELEASE_CONFLICT' for c in selected):
                blockers.append('UNRESOLVED_RELEASE_CONFLICT:' + scope)
            if any(c['scopeEvidenceStatus'] != 'EXPLICIT_A_LABEL' for c in selected):
                blockers.append('UNPROVEN_A_MEMBERSHIP:' + scope)
        if field == 'negotiableMarketCap':
            blockers.append('NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN')
        fields[field] = dict(status='PARTIAL', blockers=sorted(set(blockers)),
            candidateIds=sorted(c['candidateId'] for c in rows), admittedObservationIds=[])
    return dict(tradeDate=trade_date, status='PARTIAL', fields=fields)


def business_projection(inventory):
    return canonical_order({k:v for k,v in inventory.items() if k not in ('generatedAt','contentSha256')})


class SZSEHistoricalMarketAdapter:
    exchange = 'SZSE'
    source_definition_id = 'szse-historical-source-v1-unadmitted'

    def __init__(self, inventory):
        from .szse_inventory import validate_compact
        validate_compact(inventory)
        self._inventory = deepcopy(inventory)

    def field_status(self, trade_date):
        day = trade_date.isoformat() if isinstance(trade_date,date) else trade_date
        return assess_day(day,self._inventory['candidates'],self._inventory['calendar'])

    def collect(self, trade_date):
        self.field_status(trade_date)
        return None
