import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import mapping from '../../config/industry/industry-dimension-mapping.v1.json';
import registry from '../../config/industry/industry-metric-registry.v1.json';
import { createIndustryDimensions } from './industryDimensions.mjs';
import { createIndustryMetricProvider, type IndustryMetricProvider, type RegisteredIndustryMetric } from './industryMetricRegistry.mjs';
import { industrySnapshot, loadIndustrySnapshot, SNAPSHOT_NOTICE } from './industrySnapshot';
const resources = import.meta.glob<string>(['/config/industry/*.json', '/src/data/real/industry-*.generated.json', '/research-data/industry/**/manifest.json'], { query: '?raw', import: 'default', eager: true });
const files = Object.entries(resources).map(([path, raw]) => ({ path: path.slice(1), raw }));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
let provider: IndustryMetricProvider;
beforeAll(async () => { provider = await createIndustryMetricProvider(registry, files, sha); });
async function snapshot(mutate?: (metrics: RegisteredIndustryMetric[]) => void) {
  const metrics = [...provider.list('robotics'), ...provider.list('oil-shipping')].map(m => structuredClone(m));
  mutate?.(metrics);
  const p: IndustryMetricProvider = { list: id => metrics.filter(m => m.entry.industryId === id), get: (id, metric) => metrics.find(m => m.entry.industryId === id && m.entry.metricId === metric) ?? null };
  return industrySnapshot('oil-shipping', await createIndustryDimensions(mapping, p, sha));
}
const production = (s: Awaited<ReturnType<typeof snapshot>>) => s.groups.find(g => g.dimension === 'supply')!.rows[0];
describe('exact dimension multi-factor read model', () => {
  it('four oil dimensions, explicit eleven-dimension denominator, retained values and evidence', async () => {
    const s = await snapshot(); expect(s.groups).toHaveLength(11);
    expect(s.groups.filter(g => g.rows.length).map(g => g.dimension)).toEqual(['demand', 'supply', 'inventory', 'trade_flow']);
    expect(production(s)).toMatchObject({ value: 13944, period: '2026-09-11', unit: 'Thousand Barrels per Day', available: 11, target: 11, publicationDateTime: null, releaseAvailableAt: null, pit: 'UNPROVED', dataAdmission: 'NOT_ADMITTED' });
    expect(production(s).states).toEqual(expect.arrayContaining(['partial', 'unknown', 'not_admitted']));
    expect(production(s).audit.records[0].rows.some(r => r.href?.includes('WCRFPUS2'))).toBe(true);
    expect(production(s).audit.records[0].rows.some(r => r.label === '原始字节 SHA-256' && /^[a-f0-9]{64}$/.test(r.value))).toBe(true);
    expect(s.notice).toBe(SNAPSHOT_NOTICE);
    for (const row of s.groups.flatMap(g => g.rows)) for (const key of ['score', 'delta', 'direction', 'trend', 'claim', 'thesis', 'bullish', 'bearish']) expect(row).not.toHaveProperty(key);
  });
  it('Registry, mapping, metric, basis and observation reordering leave snapshot identical', async () => {
    const r = structuredClone(registry); r.entries.reverse();
    const p = await createIndustryMetricProvider(r, [...files].reverse(), sha);
    const m = structuredClone(mapping); m.entries.reverse();
    expect(industrySnapshot('oil-shipping', await createIndustryDimensions(m, p, sha))).toEqual(await snapshot());
    expect(await snapshot(metrics => { metrics.reverse(); for (const m of metrics) { m.owner.observations.reverse(); m.owner.definition.basis.reverse(); } })).toEqual(await snapshot());
  });
  it('zero remains zero, missing末期 never falls back, denominator stays fixed', async () => {
    const change = (metrics: RegisteredIndustryMetric[]) => metrics.find(m => m.entry.metricId === 'US_EIA_CRUDE_PRODUCTION')!.owner;
    expect(production(await snapshot(ms => { change(ms).observations.at(-1)!.value = 0; })).value).toBe(0);
    const missing = production(await snapshot(ms => { change(ms).observations.pop(); }));
    expect(missing.value).toBeNull(); expect(missing.period).toBe('2026-09-11'); expect(missing.available).toBe(10); expect(missing.target).toBe(11);
    expect(missing.states).toContain('missing');
  });
  it('stale, conflicted, not_admitted and unknown propagate without replacement', async () => {
    const s = await snapshot(ms => { const o = ms.find(m => m.entry.metricId === 'US_EIA_CRUDE_PRODUCTION')!.owner;
      o.definition.freshness = 'STALE'; o.observations.at(-1)!.conditions.push('stale');
      o.observations.push({ ...structuredClone(o.observations.at(-1)!), id: 'conflicting-copy', value: 1 }); });
    const row = production(s); expect(row.value).toBeNull(); expect(row.available).toBe(10); expect(row.target).toBe(11);
    expect(row.states).toEqual(expect.arrayContaining(['stale', 'conflicted', 'not_admitted', 'unknown', 'missing']));
    expect(row.audit.records.filter(r => r.title.startsWith('2026-09-11'))).toHaveLength(2);
  });
  it.each(['industryId', 'metricId', 'unit', 'scope'] as const)('foreign observation %s suppresses values and coverage', async key => {
    const s = await snapshot(ms => { ms.find(m => m.entry.metricId === 'US_EIA_CRUDE_PRODUCTION')!.owner.observations[0][key] = 'FOREIGN'; });
    expect(production(s).value).toBeNull(); expect(production(s).available).toBe(0); expect(production(s).states).toContain('conflicted');
  });
  it('robotics remains exact supply; non-target industries have only missing dimensions', async () => {
    const d = await createIndustryDimensions(mapping, provider, sha);
    const robotics = industrySnapshot('robotics', d), rows = robotics.groups.flatMap(g => g.rows);
    expect(rows).toHaveLength(4); expect(rows.every(r => r.mapping.dimension === 'supply')).toBe(true);
    expect(rows.find(r => r.metricId === 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT' && r.basis === 'monthly')?.value).toBe(96174);
    expect(rows.find(r => r.metricId === 'CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YOY' && r.basis === 'monthly')?.value).toBe(34.6);
    for (const id of ['innovative-drug', 'foreign', 'Oil-shipping']) {
      const s = industrySnapshot(id, d); expect(s.groups.every(g => !g.rows.length && g.states.includes('missing'))).toBe(true);
    }
    expect((await loadIndustrySnapshot('oil-shipping')).status).toBe('available');
  });
});
