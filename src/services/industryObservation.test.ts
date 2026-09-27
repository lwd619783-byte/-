import { describe, expect, it } from 'vitest';
import { stocks } from '../data/stocks';
import type { Stock } from '../types';
import type { IndustryMetricDataset } from '../types/industryMetric';
import eia from '../data/real/industry-eia-exports.generated.json';
import { syntheticFreight } from './industryObservation.fixture';
import { freightObservation, normalizeObservationSeries, observationChange, observationRelationship, observationStreak, observedCompanyCount, samplePerformance, stockObservation, type ObservationSeries } from './industryObservation';

const series = (dates: string[], values: Array<number | null>, states = ['real']): ObservationSeries => ({ points: dates.map((date, i) => ({ date, value: values[i] })), states, publication: null });
const dates = ['2026-09-21', '2026-09-22', '2026-09-23'];
function stock() {
  const s: Stock = { ...stocks.find(s => s.id === 'cosco-energy')!, dataMode: 'real', priceHistory: dates.map((date, i) => ({ date, close: 10 + i, amount: null, pctChange: null })) };
  s.priceHistorySource = { id: s.id, points: s.priceHistory!, quality: { source: 'synthetic', status: 'real', updatedAt: '2026-09-23T11:48:00+08:00' } };
  return s;
}
describe('oil observation deterministic semantics', () => {
  it('requires n+1 observations; null, NaN and zero bases never become returns', () => {
    const points = Array.from({ length: 21 }, (_, i) => ({ date: String(i), value: 100 + i }));
    expect(observationChange(points, 5)).toBeCloseTo(120 / 115 * 100 - 100);
    expect(observationChange(points, 20)).toBeCloseTo(20);
    expect(observationChange(points.slice(1), 20)).toBeNull();
    for (const value of [null, NaN]) expect(observationChange([{ date: '1', value }, { date: '2', value: 10 }], 1)).toBeNull();
    expect(observationChange([{ date: '1', value: 0 }, { date: '2', value: 10 }], 1)).toBeNull();
    points[19].value = NaN; expect(observationChange(points, 5)).toBeNull();
  });
  it('counts actual publications, does not turn weekends into flat observations; gaps stop streaks', () => {
    const s = series(['2026-09-18', '2026-09-21', '2026-09-23'], [10, 11, 12]);
    expect(observationStreak(s.points)).toEqual({ count: 2, direction: 1 });
    s.points[1].value = null; expect(observationStreak(s.points).count).toBe(0);
  });
  it('uses one common base; union dates remain null across markets with no forward fill', () => {
    const result = normalizeObservationSeries([series(dates, [10, 20, 30]), series([dates[1], '2026-09-24'], [40, 80])], dates[0], '2026-09-24');
    expect(result.base).toBe(dates[1]);
    expect(result.rows.map(r => r.values)).toEqual([[100, 100], [150, null], [null, 200]]);
    expect(normalizeObservationSeries([series(dates, [null, null, null])], dates[0], dates[2]).base).toBeNull();
  });
  it('fails closed on missing, stale, partial, conflicted, unknown basis and mismatched endpoints', () => {
    const f = series(dates, [100, 110, 120]), s = series(dates, [10, 11, 12]);
    expect(observationRelationship(f, [s], dates[0], dates[2])).toBe('运价上行 / 股价上行');
    for (const state of ['missing', 'stale', 'partial', 'conflicted', 'unknown_basis']) expect(observationRelationship({ ...f, states: [state] }, [s], dates[0], dates[2])).toBe('数据不足');
    expect(observationRelationship(f, [series(dates.slice(1), [10, 11])], dates[0], dates[2])).toBe('数据不足');
    expect(observationRelationship(f, [series(dates, [10, null, 11])], dates[0], dates[2])).toBe('数据不足');
    expect(observationRelationship(f, [], dates[0], dates[2])).toBe('数据不足');
    // Weekly freight is not converted to daily; only equal actual endpoints compare.
    expect(observationRelationship(series([dates[0], dates[2]], [10, 12]), [s], dates[0], dates[2])).toBe('运价上行 / 股价上行');
  });
  it.each([
    [[10, 12], [10, 9], '运价上行 / 股价偏弱'], [[10, 9], [10, 12], '运价偏弱 / 股价上行'],
    [[10, 9], [10, 9], '运价下行 / 股价下行'], [[10, 10], [10, 10], '暂无明显方向'],
  ])('determines relation without scores', (f, s, expected) => {
    expect(observationRelationship(series(dates.slice(0, 2), f as number[]), [series(dates.slice(0, 2), s as number[])], dates[0], dates[2])).toBe(expected);
  });
  it('does not shrink sample denominator or aggregate different endpoint dates', () => {
    expect(samplePerformance([series(dates, [10, 10, 11]), series(dates, [10, 10, 9])], 1).mean).toBeCloseTo(0);
    expect(samplePerformance([series(dates, [10, 10, 11]), series(dates, [10, null, 9])], 1).mean).toBeNull();
    expect(samplePerformance([series(dates, [10, 10, 11]), series(dates.slice(0, 2), [10, 11])], 1).mean).toBeNull();
  });
  it('excludes captured-day intraday bar, retains unknown basis, flags stale without changing source', () => {
    const s = stock(), before = JSON.stringify(s);
    expect(stockObservation(s, '2026-09-23').points.map(p => p.date)).toEqual(dates.slice(0, 2));
    expect(stockObservation(s, '2026-10-10').states).toContain('stale');
    expect(stockObservation(s, '2026-09-23').states).toContain('unknown_basis');
    expect(JSON.stringify(s)).toBe(before);
    s.priceHistorySource!.quality.updatedAt = 'invalid'; expect(stockObservation(s, dates[2]).states).toEqual(['blocked']);
  });
  it('preserves quality and blocks foreign owners, mock and unsupported market', () => {
    for (const quality of ['partial', 'stale', 'conflicted'] as const) { const s = stock(); s.priceHistorySource!.quality.status = quality; expect(stockObservation(s, dates[2]).states).toContain(quality); }
    const s = stock(); s.priceHistorySource!.id = 'foreign'; expect(stockObservation(s, dates[2]).points).toEqual([]);
    expect(stockObservation({ ...stock(), market: '港股' }, dates[2]).states).toEqual(['blocked']);
    expect(stockObservation({ ...stock(), dataMode: 'mock' }, dates[2]).states).toEqual(['blocked']);
  });
  it('nulls duplicate dates instead of silently picking a close', () => {
    const s = stock(); s.priceHistory!.push({ ...s.priceHistory![0] });
    expect(stockObservation(s, dates[2]).states).toContain('conflicted');
    expect(stockObservation(s, dates[2]).points[0].value).toBeNull();
  });
  it('never counts cross-listed securities as separate confirmed companies', () => {
    const s = stock(); expect(observedCompanyCount([s, s])).toBe(1);
    expect(observedCompanyCount([s, { ...s, id: 'cosco-h', market: '港股', code: '01138' }])).toBeNull();
  });
  it('applies freight asOf before aggregating future revisions or conflicts', () => {
    const owner = syntheticFreight();
    owner.definition.freshness = 'FRESH'; owner.definition.staleAfter = '2026-10-02';
    const futureRevision = structuredClone(owner.observations[2]);
    futureRevision.id = 'synthetic-future-revision';
    futureRevision.value = 999;
    futureRevision.releaseAvailableAt = '2026-09-25T09:00:00Z';
    futureRevision.publicationDateTime = '2026-09-25T09:00:00Z';
    futureRevision.acquiredAt = '2026-09-25T10:00:00Z';
    futureRevision.generatedAt = '2026-09-25T11:00:00Z';
    owner.observations.push(futureRevision);

    const historical = freightObservation(owner, 'week_ending', '2026-09-18');
    expect(historical.points.at(-1)).toEqual({ date: '2026-09-18', value: 120 });
    expect(historical.states).not.toContain('conflicted');

    const afterRelease = freightObservation(owner, 'week_ending', '2026-09-25');
    expect(afterRelease.states).toContain('conflicted');
  });
  it('no freight owner is blocked; original metric conditions and frequency survive', () => {
    expect(freightObservation(null, 'daily', dates[2]).states).toEqual(['blocked']);
    const owner = structuredClone(eia) as IndustryMetricDataset;
    owner.policy.allowedUses = ['display']; owner.policy.forbiddenUses = ['strict_pit', 'research'];
    const r = freightObservation(owner, owner.definition.basis[0], '2026-09-27');
    expect(r.states).toContain('blocked');
    expect(r.states).toContain('stale');
    expect(owner.definition.nativeFrequency).toBe('weekly');
    owner.observations.push(structuredClone(owner.observations[0]));
    const unknownReleaseDuplicate = freightObservation(owner, owner.definition.basis[0], '2026-09-27');
    expect(unknownReleaseDuplicate.states).toContain('blocked');
    expect(unknownReleaseDuplicate.states).not.toContain('conflicted');
  });
});
