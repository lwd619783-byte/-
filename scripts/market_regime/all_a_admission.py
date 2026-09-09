"""R2-D2 field completeness and all-A admission. Offline; no calendar inference.

R2 validation proves replay consistency, not source admission. Historical admission
is an external reviewed allowlist, empty in D2 V1. Test-supplied admissions always
produce SYNTHETIC_ONLY results and cannot enter the committed real report.
"""
from __future__ import annotations

import argparse
import json
import math
from copy import deepcopy
from datetime import date
from decimal import Decimal, localcontext
from pathlib import Path

from . import bse_inventory, sse_inventory, szse_inventory
from .hashing import atomic_write_bytes, canonical_sha256
from .historical import canonical_order
from .historical_validator import Graph, require, resolve_plan, validate_dataset
from .market_adapters import market_scope_exchanges
from .sse_source import business_projection, strict_json
from .time_semantics import parse_aware_datetime

ROOT = Path(__file__).resolve().parents[2]
VERSION = 'all-a-basic-amounts-r2d2-v1'
AS_OF = '2026-09-07T08:00:00+08:00'
GENERATED = '2026-09-09T00:00:00Z'
END = '2026-09-04'
FIELDS = ('turnoverValue', 'totalMarketCap', 'negotiableMarketCap')
ERAS = (
    ('all-a-sse-szse-pre-bse', '2005-01-01', '2021-11-14'),
    ('all-a-sse-szse-bse-v2', '2021-11-15', END),
)
UNIT_CNY = {'CNY': Decimal(1), '元': Decimal(1),
            '亿元': Decimal(100000000), '百万元': Decimal(1000000)}
# No D1 source definition/window has formal admission. Changing this boundary
# requires a reviewed successor, not a dataset manifest flag or fresh seal.
HISTORICAL_ADMISSIONS = ()
INPUTS = {
    'SSE': ('sse-d1a', '5684419e14532c8fe5ca6df9c9dcb481a1a9d91fd900b3d3f1a2afbd7cde1a71', sse_inventory),
    'SZSE': ('szse-d1b', 'e34a6514e49ee5f59236d8a256761978fbddb697a3a68f52eee03957b362ed7c', szse_inventory),
    'BSE': ('bse-d1c', 'e04cea6e9943fdf07a96e9441ad1bdf81487075ad2e5f6090baae50ede673441', bse_inventory),
}
REPORT_PATH = ROOT / 'research-data/market-regime/source-catalog/all-a-d2/admission-report.v1.json'
# Attribution from the audited D1 assess_day field branches and source contracts.
# These are semantic restrictions, not missingness inferred from probe dates.
FIELD_BLOCKERS = {
    'SSE': {'negotiableMarketCap': ('NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN',)},
    'SZSE': {'negotiableMarketCap': ('NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN',)},
    'BSE': {'turnoverValue': ('TRADE_MODE_AND_BLOCK_TRADE_INCLUSION_UNPROVEN',),
            'negotiableMarketCap': ('NEGOTIABLE_NOT_PROVEN_FREE_FLOAT',)},
}


def scope_for(trade_date):
    require(isinstance(trade_date, str) and date.fromisoformat(trade_date).isoformat() == trade_date,
            'INVALID_TRADE_DATE')
    require('2005-01-01' <= trade_date, 'OUTSIDE_MARKET_SCOPE')
    return ERAS[0][0] if trade_date < '2021-11-15' else ERAS[1][0]


def seal(record):
    out = canonical_order(deepcopy(record))
    out['contentSha256'] = canonical_sha256({k: v for k, v in out.items()
                                           if k not in ('contentSha256', 'generatedAt')})
    return out


def _decimal_sum(values):
    # Preserve all decimal places; the default Decimal precision (28) can round
    # a large amount plus a small component before the audit text is produced.
    with localcontext() as ctx:
        ctx.prec = max(28, max(v.adjusted() for v in values)
                       - min(v.as_tuple().exponent for v in values) + len(str(len(values))) + 2)
        return sum(values, Decimal(0))


def _component(graph, exchange, field, trade_date, cutoff, admissions):
    """Select only a field admitted in a replayed R2 coverage cell and pinned review.

    The caller has already validated the entire graph, including revision chains.
    Multiple qualified vintages can therefore be ordered by their release clock.
    """
    m = graph.d['manifest']
    require(parse_aware_datetime(cutoff) <= parse_aware_datetime(m['datasetAsOf']), 'CUTOFF_AFTER_DATASET_ASOF')
    rows = [o for o in graph.exchanges.values() if o['exchange'] == exchange and o['tradeDate'] == trade_date]
    require(bool(rows), 'SAME_DATE_COMPONENT_MISSING')
    require(any(o[field] is not None for o in rows), 'FIELD_MISSING')
    eligible = []
    reasons = []
    for o in rows:
        if o[field] is None:
            continue
        try:
            require(o['qualityStatus'] in ('VERIFIED', 'PROVISIONAL'), 'QUALITY_NOT_ADMITTED')
            require(o['currency'] == 'CNY', 'CURRENCY_MISMATCH')
            xs = [x for x in graph.extractions.values()
                  if x['exchangeObservationId'] == o['observationId'] and x['field'] == field]
            require(len(xs) == 1, 'FIELD_RELEASE_LINEAGE_MISSING')
            x = xs[0]
            event = graph.events[x['releaseEventId']]
            require(parse_aware_datetime(event['releaseAvailableAt']) <= parse_aware_datetime(cutoff),
                    'RELEASE_AFTER_CUTOFF')
            require(graph.admissible(x, cutoff), 'RAW_RELEASE_PIT_NOT_ADMITTED')
            cells = [c for c in graph.cells.values() if c['period'] == trade_date and c['field'] == field
                     and o['observationId'] in c['admittedObservationIds'] and c['status'] == 'AVAILABLE']
            require(len(cells) == 1, 'FIELD_COVERAGE_NOT_ADMITTED')
            cell = cells[0]
            definition = graph.definitions[x['sourceDefinitionId']]
            require(definition['metricId'] == 'EXCHANGE_MARKET_STATS'
                    and definition['nativeFrequency'] == 'DAILY' and x['periodSemantics'] == 'DAY',
                    'DEFINITION_FREQUENCY_MISMATCH')
            # Review identity binds the whole graph, plan and exact field mapping;
            # candidates cannot gain this identity by adding admitted=True.
            identity = dict(exchange=exchange, field=field, sourceId=definition['sourceId'],
                            sourceDefinitionId=definition['sourceDefinitionId'],
                            datasetContentSha256=m['datasetContentSha256'], planId=m['planId'],
                            scopeVersion=cell['scopeVersion'], securityScope='A_SHARES', unit=definition['unit'])
            require(any(a == identity for a in admissions), 'SOURCE_FIELD_ADMISSION_IDENTITY_MISSING')
            conversion = x['unitConversion']
            require(x['rawUnit'] in UNIT_CNY and definition['unit'] in UNIT_CNY, 'UNIT_NOT_CONVERTIBLE_TO_CNY')
            require(Decimal(str(conversion['factor'])) == UNIT_CNY[x['rawUnit']] / UNIT_CNY[definition['unit']],
                    'UNIT_SCALE_MISMATCH')
            raw = Decimal(x['rawValueText'])
            with localcontext() as ctx:
                ctx.prec = max(28, len(raw.as_tuple().digits) + 16)
                require(Decimal(str(o[field])) == raw * Decimal(str(conversion['factor'])), 'NUMERIC_REPLAY_MISMATCH')
                value = raw * UNIT_CNY[x['rawUnit']]
            require(value.is_finite() and value >= 0, 'INVALID_AMOUNT')
            # Preserve release, extraction and all direct evidence IDs, plus the
            # dataset pin containing full predecessor/revision/archive lineage.
            aids = {event['landingArtifactId'], *event['attachmentArtifactIds'], x['rawArtifactId'],
                    x['basisEvidence']['artifactId'], event['publicationEvidence']['artifactId'],
                    *(l['artifactId'] for l in event['firstReleaseEvidence'] + event['revisionEvidence']),
                    *(l['artifactId'] for l in event['indexEvidence'])}
            eligible.append(dict(**identity, observationId=o['observationId'], extractionId=x['extractionId'],
                                 releaseEventId=event['releaseEventId'], artifactIds=sorted(aids),
                                 releaseAvailableAt=event['releaseAvailableAt'], valueCnyText=str(value)))
        except ValueError as exc:
            reasons.append(str(exc))
    require(bool(eligible), ';'.join(sorted(set(reasons))))
    # R2 graph rejects branches, duplicate times and unproven replacement links.
    return max(eligible, key=lambda c: parse_aware_datetime(c['releaseAvailableAt']))


def aggregate_all_a(bundles, *, trade_date, cutoff, artifact_root,
                    synthetic_admissions=None):
    """Return three independent decisions; numeric observations only on completeness.

    bundles: [{exchange, dataset, catalog, plans}], never candidate observations.
    synthetic_admissions is an external test review registry. Supplying it always
    labels the result SYNTHETIC_ONLY with historicalCoverage=0, even if a fixture
    models an R2 HISTORICAL/RAW_SOURCE envelope to exercise the positive gates.
    No CLI accepts synthetic inputs or admissions for the real report.
    """
    scope = scope_for(trade_date)
    parse_aware_datetime(cutoff)
    require(parse_aware_datetime(cutoff) <= parse_aware_datetime(AS_OF), 'CUTOFF_AFTER_FROZEN_ASOF')
    require(trade_date <= END, 'OUTSIDE_DATASET_WINDOW')
    required = market_scope_exchanges(trade_date)
    admissions = HISTORICAL_ADMISSIONS if synthetic_admissions is None else synthetic_admissions
    kind = 'HISTORICAL' if synthetic_admissions is None else 'SYNTHETIC_ONLY'
    graphs, errors = {}, {}
    for exchange in {b.get('exchange') for b in bundles}:
        same = [b for b in bundles if b.get('exchange') == exchange]
        try:
            require(exchange in required, 'COMPONENT_OUTSIDE_MARKET_SCOPE')
            require(len(same) == 1, 'DUPLICATE_EXCHANGE_BUNDLE')
            b = same[0]
            require(set(b) == {'exchange', 'dataset', 'catalog', 'plans'}, 'COMPONENT_BUNDLE_REQUIRED')
            failures = validate_dataset(b['dataset'], b['catalog'], plans=b['plans'], artifact_root=Path(artifact_root))
            require(not failures, 'R2_CORE_REJECTED: ' + '; '.join(failures))
            plan = resolve_plan(b['dataset']['manifest']['planId'], b['plans'])
            graphs[exchange] = Graph(b['dataset'], b['catalog'], plan, Path(artifact_root))
            require(all(o['exchange'] == exchange for o in graphs[exchange].exchanges.values()), 'EXCHANGE_IDENTITY_MISMATCH')
        except (ValueError, TypeError, KeyError, OSError) as exc:
            errors[exchange] = str(exc)
            graphs.pop(exchange, None)
    observations, decisions = [], []
    for field in FIELDS:
        components, blockers = [], []
        for exchange in sorted(set(required) | set(errors), key=str):
            try:
                require(exchange not in errors, errors.get(exchange, ''))
                require(exchange in graphs, 'REQUIRED_EXCHANGE_MISSING')
                components.append(_component(graphs[exchange], exchange, field, trade_date, cutoff, admissions))
            except (ValueError, KeyError, TypeError) as exc:
                blockers.append(dict(exchange=exchange, reason=str(exc)))
        decision = dict(field=field, status='NOT_ADMITTED', blockers=blockers)
        if not blockers:
            total = _decimal_sum([Decimal(c['valueCnyText']) for c in components])
            numeric = int(total) if total == total.to_integral_value() else float(total)
            if isinstance(numeric, float) and not math.isfinite(numeric):
                decision['blockers'].append(dict(exchange='ALL_A', reason='NONFINITE_AGGREGATE'))
            else:
                observation = dict(kind=kind, aggregationVersion=VERSION, tradeDate=trade_date, field=field,
                                   marketScopeVersionId=scope, currency='CNY', unit='CNY', value=numeric,
                                   valueText=str(total), components=canonical_order(components),
                                   releaseAvailableAt=max(components, key=lambda c: parse_aware_datetime(c['releaseAvailableAt']))['releaseAvailableAt'])
                observation['observationId'] = 'all-a-' + canonical_sha256(canonical_order(observation))
                observations.append(observation)
                decision.update(status='ADMITTED' if kind == 'HISTORICAL' else 'SYNTHETIC_ADMITTED',
                                observationId=observation['observationId'])
        decisions.append(decision)
    return seal(dict(kind=kind, aggregationVersion=VERSION, tradeDate=trade_date, cutoff=cutoff,
                     marketScopeVersionId=scope, requiredExchanges=list(required), decisions=decisions,
                     observations=observations, historicalCoverage=len(observations) if kind == 'HISTORICAL' else 0))


def load_inventories():
    return {ex: strict_json((ROOT / f'research-data/market-regime/source-catalog/{folder}/inventory.v1.json').read_bytes())
            for ex, (folder, _, _) in INPUTS.items()}


def validate_aggregation(result, bundles, **inputs):
    """Recompute values, lineage and admission; a matching self-seal is insufficient."""
    require(result == aggregate_all_a(bundles, **inputs), 'AGGREGATION_REPLAY_MISMATCH')


def build_report(*, inventories=None, generated_at=GENERATED):
    """Replay frozen D1 identities; never derive a date grid from their probes."""
    parse_aware_datetime(generated_at)
    inventories = load_inventories() if inventories is None else inventories
    require(set(inventories) == set(INPUTS), 'REQUIRED_D1_INVENTORY_SET')
    sources = []
    for exchange, (folder, pin, module) in INPUTS.items():
        inv = inventories[exchange]
        module.validate_compact(inv)
        # Use independently frozen input hashes, not the inventory's own seal.
        require(inv['contentSha256'] == pin == canonical_sha256(business_projection(inv)), 'D1_REVIEW_IDENTITY_MISMATCH')
        require(all(inv[k] == [] for k in ('exchangeMarketObservations', 'releaseEvents', 'fieldExtractions')),
                'D1_V1_HAS_NO_FORMAL_COMPONENTS')
        require(inv['coverage']['officialTradingDayTargetCount'] is None, 'D1_CALENDAR_NOT_CLOSED')
        attributed = FIELD_BLOCKERS[exchange]
        field_only = {reason for reasons in attributed.values() for reason in reasons}
        source_blockers = {'NO_FORMAL_EXCHANGE_OBSERVATIONS', 'MARKET_RELEASE_MISSING',
                           'FULL_OFFICIAL_CALENDAR_UNPROVEN'}
        # Retain all other source gates, including reasons without field attribution.
        source_blockers.update(set(inv.get('admission', {}).get('blockers', [])) - field_only)
        if inv['calendar'].get('r2CalendarStatus'):
            source_blockers.add(inv['calendar']['r2CalendarStatus'])
        fields = {}
        for field in FIELDS:
            c = inv['coverage']['fields'][field]
            require(c['availableCount'] == c['strictPitCount'] == 0 and c['historicalAdmittedWindows'] == [],
                    'D1_V1_FIELD_NOT_ADMITTED')
            blockers = set(attributed.get(field, ()))
            require(inv['dayAssessments'] and all(blockers <= set(day['fields'][field]['blockers'])
                                                 for day in inv['dayAssessments']),
                    'D1_FIELD_BLOCKER_ATTRIBUTION_MISMATCH')
            field_gate = inv['contract'].get('fieldAdmission', {}).get(field, {})
            if field_gate.get('reason'):
                blockers.add(field_gate['reason'])
            fields[field] = dict(formalCount=0, strictPitCount=0, blockers=sorted(blockers))
        sources.append(dict(exchange=exchange, inventoryPath=f'research-data/market-regime/source-catalog/{folder}/inventory.v1.json',
                            inventoryContentSha256=pin, contractContentSha256=inv['contractContentSha256'],
                            validationMode='COMPACT_REPLAY_WITH_FROZEN_IDENTITY',
                            rawArchiveReplay='NOT_PERFORMED_BY_D2_REPORT', datasetAdmission='NOT_ADMITTED',
                            fields=fields, sourceBlockers=sorted(source_blockers), officialTradingDayTargetCount=None,
                            unadmittedWindows=deepcopy(inv['coverage']['unadmittedWindows'])))
    matrix = []
    for scope, start, end in ERAS:
        required = market_scope_exchanges(start)
        for field in FIELDS:
            matrix.append(dict(marketScopeVersionId=scope, start=start, end=end, field=field,
                               requiredExchanges=list(required), status='NOT_ADMITTED', numericAggregateCount=0,
                               targetCount=None, coveragePercent=None, denominatorStatus='UNKNOWN_OFFICIAL_CALENDAR',
                               blockers=[dict(exchange=s['exchange'], reasons=s['fields'][field]['blockers'],
                                              sourceReasons=s['sourceBlockers'])
                                         for s in sources if s['exchange'] in required]))
    return seal(dict(schemaVersion='1.0.0', kind='ALL_A_DATASET_ADMISSION_REPORT', reportVersion=VERSION,
                     baseline='c731ec84be35ac91b0371ef294669203d78bc18d', datasetAsOf=AS_OF,
                     generatedAt=generated_at, status='NOT_ADMITTED', numericAggregateCount=0,
                     observations=[], dailyGrid=None, targetCount=None, coveragePercent=None,
                     sourceInventories=sources, admissionMatrix=matrix,
                     unadmittedWindows=[{k: row[k] for k in ('marketScopeVersionId', 'start', 'end', 'field', 'blockers')}
                                        for row in matrix],
                     excludedStructuralComponents=[dict(exchange='BSE', start=ERAS[0][1], end=ERAS[0][2],
                                                        status='OUTSIDE_REQUIRED_SCOPE', value=None, releaseAvailableAt=None)],
                     syntheticValidation=dict(included=False, historicalCoverage=0)))


def validate_report(report, *, inventories=None):
    require(report == build_report(inventories=inventories, generated_at=report['generatedAt']), 'REPORT_REPLAY_MISMATCH')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('build', 'validate'))
    parser.add_argument('--output', type=Path, default=REPORT_PATH)
    args = parser.parse_args(argv)
    try:
        if args.command == 'build':
            report = build_report()
            data = (json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
            if args.output.exists():
                require(strict_json(args.output.read_bytes()) == report, 'SEALED_REPORT_EXISTS_WITH_DIFFERENT_CONTENT')
            else:
                atomic_write_bytes(args.output, data)
        else:
            report = strict_json(args.output.read_bytes())
            validate_report(report)
        print(json.dumps(dict(validation='PASS', admission=report['status'], numericAggregateCount=report['numericAggregateCount'],
                              matrixRows=len(report['admissionMatrix']), targetCount=report['targetCount'],
                              contentSha256=report['contentSha256'])))
        return 0
    except (ValueError, TypeError, KeyError, OSError) as exc:
        print(json.dumps(dict(validation='FAIL', reason=str(exc))))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
