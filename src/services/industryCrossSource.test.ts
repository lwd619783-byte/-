import { describe, expect, it } from 'vitest';
import { industryHistory, industryChartAudit, loadIndustryMetrics } from './industryMetricProvider';
import { buildIndustryChanges } from './industrySignals';
import { buildResearchInbox } from './researchInbox';
import retained from '../data/real/industry-eia-commercial-crude-stocks.generated.json';
import type { IndustryMetricDataset } from '../types/industryMetric';
import type { RegisteredIndustryMetric, IndustryMetricProvider } from './industryMetricRegistry.mjs';
const clone = () => structuredClone(retained) as IndustryMetricDataset;
const providerFor = (m: RegisteredIndustryMetric): IndustryMetricProvider => ({ list: id => id === m.entry.industryId ? [m] : [], get: (id, metric) => id === m.entry.industryId && metric === m.entry.metricId ? m : null });

describe('cross-source weekly inventory through existing generic surfaces', () => {
  it('discovers EIA in oil-shipping only and preserves original two NBS owners', async () => {
    const state = await loadIndustryMetrics(); if (state.status !== 'available') throw new Error(state.reason);
    expect(state.provider.list('robotics')).toHaveLength(2);
    expect(state.provider.list('oil-shipping')).toHaveLength(4);
    expect(state.provider.get('oil-shipping', retained.definition.id)?.owner).toEqual(retained);
    expect(state.provider.get('robotics', retained.definition.id)).toBeNull();
    expect(state.provider.list('innovative-drug')).toEqual([]);
  });
  it('uses 11 exact weekly slots, original unit, deterministic order, no monthly notes or delta', () => {
    const owner = clone(), result = industryHistory(owner, 'week_ending');
    expect(result.available).toBe(11); expect(result.target).toBe(11); expect(result.latest?.value).toBe(423429); expect(result.delta).toBeNull();
    owner.observations.reverse(); expect(industryHistory(owner, 'week_ending')).toEqual(result);
    const audit = industryChartAudit(owner, 'week_ending');
    expect(JSON.stringify(audit.rows)).not.toMatch(/1—2|当月|累计/);
    expect(JSON.stringify(audit)).toContain('Thousand Barrels');
    expect(audit.quality).toEqual(expect.arrayContaining(['not_admitted','unknown']));
  });
  it('missing and zero remain distinct; fixed denominator never shrinks or interpolates', () => {
    const owner = clone(); owner.observations.at(-1)!.value = 0;
    expect(industryHistory(owner,'week_ending').latest?.value).toBe(0);
    owner.observations = owner.observations.filter(o => o.valueDate !== '2026-08-14');
    const result = industryHistory(owner,'week_ending'); expect(result.available).toBe(10); expect(result.target).toBe(11);
    expect(result.history.find(p => p.period === '2026-08-14')?.value).toBeNull(); expect(result.states).toContain('partial');
    owner.observations.at(-1)!.value = null; expect(industryHistory(owner,'week_ending').latest?.value).toBeNull();
  });
  it.each(['unit','frequency','scope','geography','metricId','industryId'] as const)('foreign weekly %s blocks values and coverage', field => {
    const owner = clone(); owner.observations[0][field] = 'foreign';
    const result = industryHistory(owner,'week_ending'); expect(result.available).toBe(0); expect(result.states).toContain('conflicted');
  });
  it('wrong week/reference and unknown revisions fail closed; unsupported frequency yields no proxy', () => {
    const owner = clone(); owner.observations[0].referencePeriod.start = '2026-07-01';
    expect(industryHistory(owner,'week_ending').available).toBe(0);
    const duplicate = clone(); duplicate.observations.push({...duplicate.observations.at(-1)!, id:'later-acquisition', acquiredAt:'2030-01-01T00:00:00Z',value:0});
    const view = industryHistory(duplicate,'week_ending'); expect(view.latest?.value).toBeNull(); expect(view.latest?.records).toHaveLength(2); expect(view.states).toContain('conflicted');
    const invalid = clone(); invalid.definition.nativeFrequency = 'daily'; expect(industryHistory(invalid,'week_ending').available).toBe(0);
  });
  it('existing Signal/Event/Inbox retain exact EIA input and unknown publication date without an investment conclusion', async () => {
    const state = await loadIndustryMetrics(); if (state.status !== 'available') throw new Error(state.reason);
    const metric = structuredClone(state.provider.list('oil-shipping')[0]), provider = providerFor(metric);
    const {signals,events} = buildIndustryChanges(provider,'oil-shipping');
    expect(signals).toHaveLength(1); expect(events).toHaveLength(1);
    expect(signals[0].readings[0]).toMatchObject({period:'2026-09-11',value:423429,unit:'Thousand Barrels',delta:null,deltaSemantics:'none'});
    expect(signals[0].inputs).toHaveLength(1); expect(signals[0].inputs[0].artifactRef).toEqual(metric.entry.artifactRef);
    expect(events[0].title).toContain('2026-09-11 周末'); expect(events[0].title).not.toContain('NaN');
    expect(events[0].publicationDateTime).toBeNull(); expect(events[0].releaseAvailableAt).toBeNull();
    expect(JSON.stringify(events)).not.toMatch(/bullish|bearish|景气改善|景气恶化|油运需求上升|利好|利空/);
    const rows = buildResearchInbox({events:[],tasks:[],watchItems:[],industryEvents:[events[0],structuredClone(events[0])],now:new Date('2026-09-18T00:00:00Z'),timeZone:'Asia/Shanghai'});
    expect(rows).toHaveLength(1); expect(rows[0].date).toBeNull(); expect(rows[0].stockId).toBeNull(); expect(rows[0].tasks).toEqual([]);
    metric.owner.observations.at(-1)!.quality.status = 'stale';
    expect(buildIndustryChanges(provider,'oil-shipping').events[0].conditions).toContain('stale');
    metric.owner.observations.push({...metric.owner.observations.at(-1)!,id:'conflict',provenance:{...metric.owner.observations.at(-1)!.provenance,rawSha256:'a'.repeat(64)}});
    const conflict = buildIndustryChanges(provider,'oil-shipping').events[0]; expect(conflict.conditions).toContain('conflicted'); expect(conflict.signals[0].readings[0].value).toBeNull();
  });
});
