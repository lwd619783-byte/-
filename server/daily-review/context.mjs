import retained from '../../src/data/real/priceHistory.generated.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { instant, reviewRequire as need } from '../../shared/daily-review.mjs';
import { freightCandidate, freightRuntime, oilShippingPilot } from '../../shared/oil-shipping-scope.mjs';
import { stockObservation, observationChange, samplePerformance, observationWindow, observationRelationship, observedCompanyCount } from '../../shared/oil-shipping-observation.mjs';

const digest = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
export const calculationRevision = 'oil-shipping-calculation.v1';
const sourceState = states => states.includes('conflicted') ? 'conflicted' : states.includes('missing') ? 'missing' : states.includes('blocked') ? 'blocked' : states.includes('stale') ? 'stale' : states.includes('partial') ? 'blocked' : 'available';

/** Pure bounded projection of retained owners; the test input is never an MCP argument. */
export function reviewContext(asOf, now = Date.now(), snapshot = retained) {
  instant.parse(asOf); const cutoff = Date.parse(asOf);
  need(cutoff <= now, 'REVIEW_FUTURE_CONTEXT');
  const day = new Date(cutoff + 8 * 3600000).toISOString().slice(0, 10);
  const window = observationWindow(day, 90);
  const refs = [{ id: 'freight', kind: 'os', title: '油运运价接入状态', locator: 'os:industry:oil-shipping:freight', revision: freightRuntime.revision, sourceDate: null,
    asOf, availableAt: null, availability: freightRuntime.availability, relationToOS: 'os_state' }];
  const rows = oilShippingPilot.map(identity => {
    const owner = snapshot.items?.[identity.id], captured = owner?.quality?.updatedAt;
    // A later snapshot cannot establish the earlier availability of its old bars.
    const readable = owner?.id === identity.id && instant.safeParse(captured).success && Date.parse(captured) <= cutoff;
    const series = readable ? stockObservation({ ...identity, dataMode: 'real', priceHistorySource: owner, priceHistory: owner.points }, day)
      : { points: [], states: ['missing', 'unknown_basis', 'calendar_unproven'], publication: null };
    const latest = series.points.filter(p => p.value !== null).at(-1), availability = sourceState(series.states);
    // Invisible owner values, metadata and digest must not leak into past context.
    const revision = digest(readable ? { id: identity.id, quality: owner.quality, points: series.points } : { id: identity.id, unavailableAtCutoff: true });
    const ref = { id: identity.id, kind: 'os', title: `${identity.name} 股票留存事实`, locator: `os:stock:${identity.id}:price-history`, revision,
      sourceDate: latest?.date ?? null, asOf, availableAt: readable ? captured : null, availability, relationToOS: 'os_state' };
    refs.push(ref);
    return { identity, series, ref, latest, source: readable ? owner.quality.source ?? null : null, sourceUrl: readable ? owner.quality.sourceUrl ?? null : null };
  });
  function result(id, locator, value, unit, periods, endpoints, states, sources) {
    const availability = value === null || value === 'unavailable' ? sourceState([...states, 'missing']) : sourceState(states);
    const record = { id, locator, value, unit, window: { periods, type: periods === null ? 'calendar_window' : 'valid_closed_observations' }, endpoints,
      states, availability, sourceIds: sources.map(s => s.id), calculationRevision };
    const revision = digest({ ...record, asOf, sourcePins: sources.map(s => ({ locator: s.locator, revision: s.revision })) });
    const times = sources.map(s => s.availableAt).filter(Boolean).sort((a,b) => Date.parse(a)-Date.parse(b));
    refs.push({ id, kind: 'os', title: `${id} · OS 确定性结果`, locator, revision, sourceDate: endpoints?.end ?? null, asOf,
      availableAt: times.at(-1) ?? null, availability, relationToOS: 'os_state' });
    return { ...record, calculationDigest: revision };
  }
  const stocks = rows.map(({ identity, series, ref, latest, source, sourceUrl }) => {
    const changes = [1,5,20].map(periods => result(`${identity.id}-return-${periods}p`, `os:industry:oil-shipping:stock:${identity.code}:return:${periods}p`,
      observationChange(series.points, periods), '%', periods,
      series.points.length >= periods + 1 ? { start: series.points.at(-(periods+1)).date, end: series.points.at(-1).date } : null, series.states, [ref]));
    return { stockId: identity.id, code: identity.code, name: identity.name, market: identity.market,
      latestValidDate: latest?.date ?? null, latestRetainedClose: latest?.value ?? null,
      onePeriodChange: changes[0], fivePeriodChange: changes[1], twentyPeriodChange: changes[2],
      states: series.states, availability: ref.availability, adjustmentBasis: 'unknown', sourceAvailableAt: ref.availableAt,
      sourceRevision: ref.revision, source, sourceUrl, sourceRef: ref.id };
  });
  const samples = [1,5,20].map(periods => {
    const value = samplePerformance(rows.map(r => r.series), periods);
    const calculation = result(`sample-return-${periods}p`, `os:industry:oil-shipping:sample:return:${periods}p`, value.mean, '%', periods,
      value.endpoints, value.states, rows.map(r => r.ref));
    return { ...calculation, up: value.up, down: value.down, flat: value.flat };
  });
  const freightSeries = { points: [], states: ['blocked'], publication: null };
  const relationship = observationRelationship(freightSeries, rows.map(r => r.series), window.start, window.end);
  const relation = result('freight-stock-relationship', 'os:industry:oil-shipping:relationship', 'unavailable', 'state', null,
    null, ['blocked'], [refs[0], ...rows.map(r => r.ref)]);
  return { schemaVersion: 'oil-shipping-observation-context.v1', subjectType: 'industry', subjectId: 'oil-shipping', asOf,
    effectiveDataCutoff: stocks.map(s => s.latestValidDate).filter(Boolean).sort().at(-1) ?? null,
    observationWindow: { ...window, days: 90 }, availability: 'partial', states: [...new Set(['freight_blocked', ...stocks.flatMap(s => s.states)])],
    stocks, selectedSample: { securityCount: rows.length, companyCount: observedCompanyCount(oilShippingPilot),
      onePeriod: samples[0], fivePeriod: samples[1], twentyPeriod: samples[2], availability: samples.every(s => s.availability === 'available') ? 'available' : 'insufficient' },
    freight: { availability: 'blocked', value: null, candidate: freightCandidate, sourceStatus: 'candidate_only', licenseStatus: 'unverified', formalAdmission: 'NOT_ADMITTED' },
    relationship: { ...relation, state: 'unavailable', label: relationship }, sourceReferences: refs,
    formalDecision: 'unchanged; use separately authorized os:read for exact formal snapshot references',
    limitation: 'OS facts and deterministic raw-close changes only, not total returns. Unknown adjustment/calendar coverage remain explicit. No full series. Read these mechanical values rather than searching or recalculating them. AI Review prose is interpretation, never verified OS data. Freight is NOT_ADMITTED.' };
}

/** New publications require exact context pins. Historical Review reads remain immutable. */
export function validateOSReferences(review, now = Date.now(), snapshot = retained) {
  const context = reviewContext(review.asOf, now, snapshot);
  need(review.sources.some(s => s.locator === context.sourceReferences[0].locator), 'REVIEW_FREIGHT_GAP_REQUIRED');
  for (const source of review.sources.filter(s => s.kind === 'os')) {
    const ref = context.sourceReferences.find(s => s.locator === source.locator);
    need(ref && ['revision','sourceDate','asOf','availableAt','availability','relationToOS'].every(k => source[k] === ref[k]), 'REVIEW_OS_REFERENCE_MISMATCH');
  }
  const deterministic = new Set(context.sourceReferences.filter(s => s.locator.startsWith('os:industry:oil-shipping:') && s.id !== 'freight').map(s => s.locator));
  for (const observation of review.observations.filter(o => o.kind === 'derived')) {
    need(observation.sourceIds.some(id => review.sources.some(s => s.id === id && s.kind === 'os' && deterministic.has(s.locator))), 'REVIEW_DETERMINISTIC_REF_REQUIRED');
  }
}
