import type { Stock } from '../types';
import type { IndustryMetricDataset } from '../types/industryMetric';
import { industryHistory } from './industryHistory.mjs';
export { freightCandidate } from '../../shared/oil-shipping-scope.mjs';

/** Disposable projections of existing owners. No persistence, admission or formal write. */
export interface ObservationPoint { date: string; value: number | null }
export interface ObservationSeries { points: ObservationPoint[]; states: string[]; publication: string | null }
export const observationStateLabels: Record<string, string> = {
  real: '正常', partial: '部分缺失 / 口径待核对', stale: '过期', conflicted: '数据冲突', missing: '数据不足',
  blocked: '不可用', unknown_basis: '复权口径未确认', calendar_unproven: '交易日覆盖未证明',
  unknown: '来源条件未闭合', not_admitted: '尚未准入', missing_evidence: '缺少证据',
};
const dayMs = 86400000;
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function observationWindow(asOf: string, days: number) {
  return { start: new Date(Date.parse(asOf) - (days - 1) * dayMs).toISOString().slice(0, 10), end: asOf };
}
export function shanghaiToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function canonicalPoints(points: ObservationPoint[]) {
  const dates = new Map<string, ObservationPoint[]>();
  for (const point of points) dates.set(point.date, [...(dates.get(point.date) ?? []), point]);
  return [...dates].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, value: values.length === 1 && numeric(values[0].value) ? values[0].value : null, conflict: values.length > 1 }));
}
export function observationChange(points: ObservationPoint[], periods: number): number | null {
  const segment = points.slice(-(periods + 1));
  if (segment.length !== periods + 1 || segment.some(p => !numeric(p.value)) || segment[0].value! <= 0) return null;
  return (segment.at(-1)!.value! / segment[0].value! - 1) * 100;
}
export function observationStreak(points: ObservationPoint[]) {
  let count = 0, direction = 0;
  for (let i = points.length - 1; i > 0; i--) {
    const current = points[i].value, prior = points[i - 1].value;
    if (!numeric(current) || !numeric(prior)) break;
    const next = Math.sign(current - prior);
    if (!next || (direction && next !== direction)) break;
    direction = next; count++;
  }
  return { direction, count };
}

function metricOwnerAtAsOf(owner: IndustryMetricDataset, asOf: string): IndustryMetricDataset | null {
  if (!validDate(asOf)) return null;
  const d = owner.definition;
  let end: string | null = null;
  if (d.nativeFrequency === 'monthly') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.window.start) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(d.window.end)) return null;
    const cutoff = asOf.slice(0, 7);
    end = d.window.end < cutoff ? d.window.end : cutoff;
    if (end < d.window.start) return null;
  } else if (d.nativeFrequency === 'weekly') {
    if (!validDate(d.window.start) || !validDate(d.window.end)) return null;
    const start = Date.parse(d.window.start), cutoff = Math.min(Date.parse(d.window.end), Date.parse(asOf));
    if (cutoff < start) return null;
    const step = 7 * dayMs;
    end = new Date(start + Math.floor((cutoff - start) / step) * step).toISOString().slice(0, 10);
  } else return null;
  const valueCutoff = d.nativeFrequency === 'monthly' ? asOf.slice(0, 7) : asOf;
  const observations = owner.observations.filter(observation => {
    const release = observation.releaseAvailableAt;
    const releaseDay = typeof release === 'string' && Number.isFinite(Date.parse(release)) ? release.slice(0, 10) : null;
    return observation.valueDate <= valueCutoff && releaseDay !== null && releaseDay <= asOf;
  });
  return { ...owner, definition: { ...d, window: { ...d.window, end } }, observations };
}

export function stockObservation(stock: Stock, asOf: string): ObservationSeries {
  const owner = stock.priceHistorySource;
  if (!owner || owner.id !== stock.id || owner.points !== stock.priceHistory || stock.dataMode === 'mock') return { points: [], states: ['blocked'], publication: null };
  if (!['real', 'partial', 'stale'].includes(owner.quality.status)) return { points: [], states: [owner.quality.status === 'conflicted' ? 'conflicted' : 'blocked'], publication: null };
  // Source timestamp is acquisition, never release. Exclude its entire local day;
  // even a closing-day bar fetched before market close must not become a close.
  const captured = owner.quality.updatedAt;
  if (stock.market !== 'A股' || !captured || !/[Zz]|[+-]\d{2}:\d{2}$/.test(captured) || !Number.isFinite(Date.parse(captured))) return { points: [], states: ['blocked'], publication: null };
  const capturedDay = new Date(Date.parse(captured) + 8 * 3600000).toISOString().slice(0, 10);
  const input = owner.points.filter(p => validDate(p.date) && p.date <= asOf && p.date < capturedDay);
  const points = canonicalPoints(input.map(p => ({ date: p.date, value: numeric(p.close) && p.close > 0 ? p.close : null })));
  const states = ['unknown_basis', 'calendar_unproven']; // Legacy owner has no actual adjustment / trading-calendar metadata.
  if (owner.quality.status !== 'real') states.push(owner.quality.status);
  if (points.some(p => p.conflict)) states.push('conflicted');
  if (points.some(p => p.value === null) || owner.points.some(p => !validDate(p.date))) states.push('partial');
  const latest = points.filter(p => p.value !== null).at(-1);
  if (!latest) states.push('missing');
  else if ((Date.parse(asOf) - Date.parse(latest.date)) / dayMs > 7) states.push('stale');
  return { points, states: [...new Set(states)], publication: null };
}

/** Only original IndustryMetricDataset facts; currently no freight owner is admitted. */
export function freightObservation(owner: IndustryMetricDataset | null, basis: string, asOf: string): ObservationSeries {
  if (!owner) return { points: [], states: ['blocked'], publication: null };
  const d = owner.definition;
  if (d.industryId !== 'oil-shipping' || !d.basis.includes(basis)) return { points: [], states: ['blocked'], publication: null };
  // Reuse original exact owner, dimension, duplicate and revision validation.
  // Daily freight is not supported by that owner reader yet: never create a
  // parallel daily parser to bypass its Registry/admission requirements.
  const ownerAsOf = metricOwnerAtAsOf(owner, asOf);
  if (!ownerAsOf) return { points: [], states: ['blocked'], publication: null };
  // Cut the owner to records actually available by asOf before industryHistory
  // aggregates duplicates, revision state, missing periods or conflicts.
  const view = industryHistory(ownerAsOf, basis);
  const states = view.states.filter(s => s !== 'FRESH');
  if (!owner.policy.allowedUses.includes('display') || owner.policy.forbiddenUses.includes('display') || owner.policy.dataAdmission !== 'ADMITTED' || !view.history.length) states.push('blocked');
  if (d.freshness !== 'FRESH' || !d.staleAfter || d.staleAfter.slice(0, 10) < asOf) states.push('stale');
  const points = view.history.map(p => {
    const available = p.records.length === 1 && p.records[0].releaseAvailableAt;
    if (!available || available.slice(0, 10) > asOf) states.push('blocked');
    return { date: p.period, value: available && available.slice(0, 10) <= asOf ? p.value : null };
  });
  return { points, states: [...new Set(states)], publication: view.history.find(p => p.period === points.at(-1)?.date)?.records[0]?.publicationDateTime ?? null };
}

export function normalizeObservationSeries(series: ObservationSeries[], start: string, end: string) {
  const dates = [...new Set(series.flatMap(s => s.points.map(p => p.date)))].filter(d => d >= start && d <= end).sort();
  const base = series.length ? dates.find(date => series.every(s => s.points.some(p => p.date === date && numeric(p.value) && p.value > 0))) ?? null : null;
  const rows = dates.filter(date => base !== null && date >= base).map(date => ({ date, values: series.map(s => {
    const point = s.points.find(p => p.date === date), first = s.points.find(p => p.date === base);
    return numeric(point?.value) && numeric(first?.value) ? point.value / first.value * 100 : null;
  }) }));
  return { base, rows };
}

export function samplePerformance(series: ObservationSeries[], periods: number) {
  const returns = series.map(s => observationChange(s.points, periods));
  const ends = series.map(s => `${s.points.at(-(periods + 1))?.date}/${s.points.at(-1)?.date}`);
  const available = series.length > 0 && returns.every(numeric) && new Set(ends).size === 1;
  return { mean: available ? (returns as number[]).reduce((a, b) => a + b, 0) / returns.length : null,
    up: available ? returns.filter(v => v! > 0).length : null, down: available ? returns.filter(v => v! < 0).length : null,
    flat: available ? returns.filter(v => v === 0).length : null };
}
export function observationRelationship(freight: ObservationSeries, stocks: ObservationSeries[], start: string, end: string) {
  const insufficient = '数据不足';
  const series = [freight, ...stocks];
  if (!stocks.length || series.some(s => s.states.some(state => state !== 'real'))) return insufficient;
  const slices = series.map(s => s.points.filter(p => p.date >= start && p.date <= end));
  if (slices.some(p => p.length < 2 || p.some(v => v.value === null)) || new Set(slices.map(p => `${p[0].date}/${p.at(-1)!.date}`)).size !== 1) return insufficient;
  const values = slices.map(p => observationChange(p, p.length - 1));
  if (!values.every(numeric)) return insufficient;
  const f = values[0]!, s = (values.slice(1) as number[]).reduce((a, b) => a + b, 0) / stocks.length;
  if (f > 0 && s > 0) return '运价上行 / 股价上行';
  if (f > 0 && s <= 0) return '运价上行 / 股价偏弱';
  if (f <= 0 && s > 0) return '运价偏弱 / 股价上行';
  if (f < 0 && s < 0) return '运价下行 / 股价下行';
  return '暂无明显方向';
}
export function observedCompanyCount(stocks: Stock[]): number | null {
  // Exact existing pilot identities only, not a new general company/security registry.
  const known = new Map([['cosco-energy', '600026'], ['cm-energy', '601872'], ['cm-nanjing', '601975']]);
  if (stocks.some(s => s.market !== 'A股' || known.get(s.id) !== s.code)) return null;
  return new Set(stocks.map(s => s.id)).size;
}
