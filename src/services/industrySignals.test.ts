import { describe, expect, it } from 'vitest';
import { loadIndustryMetrics } from './industryMetricProvider';
import type { IndustryMetricProvider, RegisteredIndustryMetric } from './industryMetricRegistry.mjs';
import { buildIndustryChanges, industryEventAudit } from './industrySignals';
import { buildResearchInbox } from './researchInbox';

async function setup() {
  const loaded = await loadIndustryMetrics();
  if (loaded.status !== 'available') throw new Error(loaded.reason);
  const metrics = structuredClone(loaded.provider.list('robotics'));
  return { metrics, provider: providerFor(metrics) };
}
const providerFor = (metrics: RegisteredIndustryMetric[]): IndustryMetricProvider => ({ list: id => metrics.filter(m => m.entry.industryId === id), get: (industry, metric) => metrics.find(m => m.entry.industryId === industry && m.entry.metricId === metric) ?? null });
const latest = (metric: RegisteredIndustryMetric) => metric.owner.observations.filter(o => o.valueDate === '2026-08');

describe('Industry Signal / release Event deterministic source projection', () => {
  it('projects two registered metrics, four readings and one latest release, without mutation or subjective judgments', async () => {
    const { metrics, provider } = await setup(), before = JSON.stringify(metrics);
    const result = buildIndustryChanges(provider, 'robotics');
    expect(result.signals).toHaveLength(2); expect(result.events).toHaveLength(1);
    expect(result.events[0].signals.flatMap(signal => signal.readings.map(reading => reading.value))).toEqual([96174, 729352, 34.6, 29]);
    expect(result.events[0].title).toBe('国家统计局更新工业机器人 8 月产量数据');
    expect(result.events[0].conditions).toEqual(expect.arrayContaining(['partial', 'not_admitted', 'unknown']));
    expect(JSON.stringify(result)).not.toMatch(/bullish|bearish|景气改善|利好|利空/);
    expect(JSON.stringify(metrics)).toBe(before);
    metrics.reverse(); metrics.forEach(metric => metric.owner.observations.reverse());
    expect(buildIndustryChanges(provider, 'robotics')).toEqual(result);
  });
  it('absolute delta retains both exact operands/pins; official YoY never has delta even under presentation mutation', async () => {
    const { metrics, provider } = await setup();
    metrics[1].entry.presentation.delta = 'absolute_difference';
    const { signals } = buildIndustryChanges(provider, 'robotics');
    const absolute = signals[0], growth = signals[1];
    const previous = absolute.inputs.find(input => input.role === 'previous')!;
    expect(absolute.readings[0].delta).toBe(96174 - previous.observation.value!);
    expect(previous.artifactRef).toEqual(metrics[0].entry.artifactRef);
    expect(previous.definitionRef).toEqual(metrics[0].entry.definitionRef);
    expect(previous.bindingRef).toEqual(metrics[0].entry.bindingRef);
    expect(previous.policyRef).toEqual(metrics[0].entry.policyRef);
    expect(absolute.readings[1].delta).toBeNull();
    expect(growth.readings.every(reading => reading.delta === null && reading.deltaSemantics === 'none')).toBe(true);
    expect(growth.inputs.every(input => input.role === 'current')).toBe(true);
  });
  it('unknown releaseAvailableAt is never replaced by period, publication, acquiredAt or generatedAt', async () => {
    const { provider } = await setup(); const { events, signals } = buildIndustryChanges(provider, 'robotics');
    expect(events[0].releaseAvailableAt).toBeNull(); expect(events[0].publicationDateTime).toBeTruthy();
    expect(signals.every(signal => signal.releaseAvailableAt === null && signal.asOf === '2026-08')).toBe(true);
    expect(industryEventAudit(events[0]).rows.find(row => row.label.includes('releaseAvailableAt'))?.value).toBe('未提供 / unknown');
    expect(events[0].evidence.every(ref => ref.quality === 'candidate')).toBe(true);
  });
  it('same-period changed raw / source metadata is one conflicted event with no display value or delta', async () => {
    const { metrics, provider } = await setup();
    latest(metrics[1]).forEach(o => { o.provenance.rawSha256 = 'a'.repeat(64); });
    const result = buildIndustryChanges(provider, 'robotics');
    expect(result.events).toHaveLength(1); expect(result.events[0].conditions).toContain('conflicted');
    expect(result.signals.flatMap(s => s.readings).every(r => r.value === null && r.delta === null)).toBe(true);
    expect(result.events[0].signals[1].inputs[0].observation.value).not.toBeNull();
  });
  it('duplicate observations are not chosen as a winner and do not generate extra cards', async () => {
    const { metrics, provider } = await setup();
    metrics[0].owner.observations.push(structuredClone(latest(metrics[0])[0]));
    const { events } = buildIndustryChanges(provider, 'robotics');
    expect(events).toHaveLength(1); expect(events[0].conditions).toContain('conflicted');
    expect(events[0].signals[0].readings[0].value).toBeNull();
  });
  it('missing latest never falls back to previous or zero; no owners or all records missing produce no event', async () => {
    const { metrics, provider } = await setup();
    latest(metrics[0])[0].value = 0;
    expect(buildIndustryChanges(provider, 'robotics').signals[0].readings[0].value).toBe(0);
    metrics[0].owner.observations = metrics[0].owner.observations.filter(o => o.valueDate !== '2026-08');
    const partial = buildIndustryChanges(provider, 'robotics');
    expect(partial.signals[0].readings.every(r => r.value === null && r.delta === null)).toBe(true);
    expect(partial.events[0].conditions).toContain('missing');
    expect(buildIndustryChanges(provider, 'ai-computing')).toEqual({ signals: [], events: [] });
    metrics[1].owner.observations = [];
    expect(buildIndustryChanges(provider, 'robotics').events).toEqual([]);
  });
  it('foreign observation identity fails closed; duplicate metric owners never inflate event count', async () => {
    const { metrics, provider } = await setup();
    latest(metrics[0])[0].industryId = 'foreign';
    expect(buildIndustryChanges(provider, 'robotics').events[0].conditions).toContain('conflicted');
    expect(buildIndustryChanges(provider, 'robotics').signals[0].readings.every(r => r.value === null)).toBe(true);
    metrics.push(structuredClone(metrics[0]));
    expect(buildIndustryChanges(provider, 'robotics')).toEqual({ signals: [], events: [] });
  });
  it('stale, missing Evidence and partial candidate status propagate with unchanged NOT_ADMITTED boundary', async () => {
    const { metrics, provider } = await setup();
    latest(metrics[0])[0].quality.status = 'stale';
    latest(metrics[0])[0].provenance.evidence.refId = '';
    latest(metrics[1])[0].provenance.evidence.quality = 'partial';
    const event = buildIndustryChanges(provider, 'robotics').events[0];
    expect(event.conditions).toEqual(expect.arrayContaining(['stale', 'missing_evidence', 'partial', 'not_admitted', 'unknown']));
  });
  it('Inbox de-duplicates latest release without tasks/company fallback and uses only the explicit publication date', async () => {
    const { provider } = await setup(), event = buildIndustryChanges(provider, 'robotics').events[0];
    const input = { events: [], tasks: [], watchItems: [], industryEvents: [event, structuredClone(event)], now: new Date('2026-09-18T00:00:00Z'), timeZone: 'Asia/Shanghai' };
    const rows = buildResearchInbox(input);
    expect(rows).toHaveLength(1); expect(rows[0].stockId).toBeNull(); expect(rows[0].events).toEqual([]); expect(rows[0].tasks).toEqual([]);
    expect(rows[0].date).toBe('2026-09-15');
    expect(buildResearchInbox({ ...input, industryEvents: [{ ...event, publicationDateTime: null }] })[0].date).toBeNull();
    expect(buildResearchInbox({ ...input, industryEvents: [] })).toEqual([]);
    const conflict = structuredClone(event); conflict.signals[0].readings[0].value = 0;
    const conflictInput = { ...input, industryEvents: [event, conflict] };
    const conflicted = buildResearchInbox(conflictInput);
    expect(conflicted).toHaveLength(1); expect(conflicted[0].industryEvent?.conditions).toContain('conflicted');
    expect(conflicted[0].industryEvent?.signals.flatMap(signal => signal.readings).every(reading => reading.value === null && reading.delta === null)).toBe(true);
    expect(buildResearchInbox({ ...conflictInput, industryEvents: [conflict, event] })).toEqual(conflicted);
  });
});
