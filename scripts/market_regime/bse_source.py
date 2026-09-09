"""BSE D1C: selected official daily rows are evidence candidates, never PIT admission."""
from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import date
from pathlib import Path

from .hashing import canonical_sha256
from .historical import canonical_order
from .historical_validator import require
from .market_adapters import BSE_LAUNCH_DATE, structurally_unavailable_exchange_observation
# Reuse the audited byte/JSON addressing primitives without changing sibling contracts.
from .szse_source import json_spans, strict_json, replay_locator

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = ROOT / 'config/market-regime/bse-source-contract.v1.json'
FIELDS = ('turnoverValue', 'totalMarketCap', 'negotiableMarketCap')
PARSER_VERSION = 'bse-daily-jsonp-v1.0.0'


def load_contract():
    return strict_json(CONTRACT_PATH.read_bytes())


def check_day(day):
    require(isinstance(day, str) and date.fromisoformat(day).isoformat() == day, 'DATE_FORMAT')
    return day


def unwrap(body):
    # Literal callback emitted when the official request has no callback parameter.
    # Never eval JSONP or accept arbitrary JavaScript, callback names or suffixes.
    require(body.startswith(b'null(') and body.endswith(b')'), 'UNSUPPORTED_JSONP_WRAPPER')
    return body[5:-1]


def parse_daily(body, *, family, requested_date, artifact_id):
    check_day(requested_date)
    require(requested_date >= BSE_LAUNCH_DATE.isoformat(), 'PRELAUNCH_NEEQ_SPLICE_REJECTED')
    require(requested_date <= load_contract()['targetWindow']['end'], 'OUTSIDE_FROZEN_TARGET')
    require(family == load_contract()['families'][0], 'WRONG_SOURCE_FAMILY')
    document, spans = json_spans(unwrap(body))
    require(isinstance(document, list), 'DAILY_ARRAY_REQUIRED_NO_PAGINATION_ENVELOPE')
    candidates, rejected = [], []
    for i, row in enumerate(document):
        require(isinstance(row, dict), 'ROW_OBJECT_REQUIRED')
        require(isinstance(row.get('xxzrlx'), str), 'SCOPE_REQUIRED')
        require(row.get('rq') == requested_date.replace('-', ''), 'RESPONSE_DATE_MISMATCH')
        _, offset, text = spans[(i,)]
        loc = dict(artifactId=artifact_id, byteOffset=offset + 5, byteLength=len(text.encode()), text=text)
        if row['xxzrlx'] != '2':
            rejected.append(dict(rowIndex=i, rawScope=row['xxzrlx'], locator=loc,
                                 reason='NON_TARGET_OR_UNPROVEN_SCOPE_NO_SUM'))
            continue
        allowed = {'xxzrlx','rq','zsz','ltsz','hqcjje','gpgsjs','xxzgb','hqcjzs',
                   'hqcjsl','drxzjs','xxfxsgb','hqcjbs'}
        require(set(row) <= allowed, 'UNREVIEWED_FIELD_OR_SCOPE_CHANGE')
        for field in FIELDS:
            key = family['fieldKeys'][field]
            value = row.get(key)
            token, value_loc = None, None
            if value is not None:
                _, off, raw = spans[(i, key)]
                require(type(value) in (int, float) and re.fullmatch(r'\d+(?:\.\d+)?', raw),
                        'INVALID_NUMERIC_TOKEN')
                token = raw
                value_loc = dict(artifactId=artifact_id, byteOffset=off+5, byteLength=len(raw.encode()), text=raw)
            candidates.append(dict(tradeDate=requested_date, field=field, familyId=family['familyId'],
                rawScope='2', scopeStatus='WEB_SELECTED_2_HISTORICAL_MEMBERSHIP_UNPROVEN',
                rawFieldName=key, rawUnit='元', rawValueText=token, locator=loc, valueLocator=value_loc,
                parserVersion=PARSER_VERSION, status='FIELD_MISSING' if token is None else 'CANDIDATE_ONLY'))
    for field in FIELDS:
        group = [c for c in candidates if c['field'] == field]
        if len(group) > 1:
            for c in group: c['status'] = 'UNRESOLVED_RELEASE_CONFLICT'
    for c in candidates: c['candidateId'] = 'bse-candidate-' + canonical_sha256(c)
    return canonical_order(dict(candidates=candidates, rejectedRows=rejected))


def assess_day(day, candidates, calendar, *, evidence_role='RAW_SOURCE'):
    check_day(day)
    require(day >= BSE_LAUNCH_DATE.isoformat(), 'PRELAUNCH_USE_STRUCTURAL_HELPER')
    fields = {}
    for field in FIELDS:
        rows = [c for c in candidates if c['tradeDate'] == day and c['field'] == field]
        blockers = ['FIELD_SCOPE_ERA_APPLICABILITY_UNPROVEN', 'MARKET_RELEASE_MISSING',
                    'FIRST_RELEASE_AND_REVISION_ARCHIVE_UNPROVEN']
        windows = [] if calendar is None else [w for w in calendar['windows'] if w['start'] <= day <= w['end']]
        if not windows: blockers.append('OFFICIAL_CALENDAR_MISSING')
        elif any(day in w['closedDates'] for w in windows): blockers.append('OFFICIAL_NON_TRADING_DAY')
        elif any(day in w['openDates'] for w in windows): blockers.append('R2_CALENDAR_LITERAL_ISO_LOCATOR_UNAVAILABLE')
        else: blockers.append('OFFICIAL_CALENDAR_MISSING')
        if not rows or any(c['rawValueText'] is None for c in rows): blockers.append('FIELD_MISSING')
        if len(rows) > 1 or any(c['status'] == 'UNRESOLVED_RELEASE_CONFLICT' for c in rows):
            blockers.append('UNRESOLVED_RELEASE_CONFLICT')
        if field == 'turnoverValue': blockers.append('TRADE_MODE_AND_BLOCK_TRADE_INCLUSION_UNPROVEN')
        if field == 'negotiableMarketCap': blockers.append('NEGOTIABLE_NOT_PROVEN_FREE_FLOAT')
        if evidence_role != 'RAW_SOURCE': blockers.append('NON_HISTORICAL_EVIDENCE')
        fields[field] = dict(status='PARTIAL', blockers=sorted(set(blockers)),
                             candidateIds=sorted(c['candidateId'] for c in rows), admittedObservationIds=[])
    return dict(tradeDate=day, status='PARTIAL', fields=fields)


def business_projection(inventory):
    return canonical_order({k:v for k,v in inventory.items() if k not in ('generatedAt','contentSha256')})


class BSEHistoricalMarketAdapter:
    exchange = 'BSE'
    source_definition_id = 'bse-market-stats-adapter-v1'

    def __init__(self, inventory):
        from .bse_inventory import validate_compact
        validate_compact(inventory)
        self._inventory = deepcopy(inventory)

    def collect(self, trade_date):
        day = trade_date.isoformat() if isinstance(trade_date, date) else check_day(trade_date)
        if day < BSE_LAUNCH_DATE.isoformat():
            return structurally_unavailable_exchange_observation(exchange='BSE', trade_date=day,
                source_definition_id=self.source_definition_id)
        self.field_status(day)
        return None

    def field_status(self, trade_date):
        day = trade_date.isoformat() if isinstance(trade_date, date) else check_day(trade_date)
        if day < BSE_LAUNCH_DATE.isoformat():
            return self.collect(day)
        return assess_day(day, self._inventory['candidates'], self._inventory['calendar'])
