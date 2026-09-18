import { describe, expect, it } from 'vitest';
import { industryChartAudit, industryHistory, loadIndustryMetrics } from './industryMetricProvider';
import retained from '../data/real/industry-robotics.generated.json';
import growth from '../data/real/industry-robotics-yoy.generated.json';
import type { IndustryMetricDataset } from '../types/industryMetric';
const roboticsMetric = retained as IndustryMetricDataset;
const clone = () => structuredClone(roboticsMetric);
describe('formal Industry Metric read-only owner projection', () => {
  it('registry enumerates two exact metrics; non-robotics and wrong identity never substitute', async () => {
    const state = await loadIndustryMetrics(); expect(state.status).toBe('available');
    if (state.status !== 'available') throw new Error(state.reason);
    const provider = state.provider;
    expect(provider.list('robotics').map(m => m.entry.metricId)).toEqual([retained.definition.id, growth.definition.id]);
    expect(provider.get('robotics', retained.definition.id)?.owner).toEqual(roboticsMetric);
    for (const id of ['ai-computing', 'innovative-drug', 'oil-shipping', 'unknown', '']) {
      expect(provider.list(id)).toEqual([]); expect(provider.get(id, retained.definition.id)).toBeNull();
    }
    expect(provider.get('robotics', retained.definition.id + '_UNKNOWN')).toBeNull();
    expect(roboticsMetric.definition.entity).toBeNull();
  });
  it('official percentage series has independent values, basis, evidence, and no absolute delta', () => {
    const owner = growth as IndustryMetricDataset;
    const view = industryHistory(owner, 'monthly');
    expect(view.latest?.value).toBe(34.6); expect(view.delta).toBeNull();
    expect(view.history.slice(0, 2).map(p => p.value)).toEqual([null, null]);
    expect(industryHistory(owner, 'year_to_date').latest?.value).toBe(29);
    expect(industryChartAudit(owner, 'monthly').records[0].rows.find(r => r.label === '表格定位 / 列')?.value).toContain('/ 2');
  });
  it('retained real history and delta are deterministic under reversed/random order without mutation', () => {
    const owner = clone(), before = JSON.stringify(owner);
    const original = industryHistory(owner, 'monthly');
    expect(original.available).toBe(6); expect(original.target).toBe(8);
    expect(original.latest?.value).toBe(96174);
    expect(original.delta).toBe(original.latest!.value! - original.previous!.value!);
    for (let i = 0; i < owner.observations.length; i++) {
      const permuted = { ...owner, observations: [...owner.observations.slice(i), ...owner.observations.slice(0, i)].reverse() };
      expect(industryHistory(permuted, 'monthly')).toEqual(original);
      expect(industryChartAudit(permuted, 'monthly')).toEqual(industryChartAudit(owner, 'monthly'));
    }
    expect(JSON.stringify(owner)).toBe(before);
  });
  it('synthetic boundary mutation preserves zero, does not backfill missing latest, and never bridges a gap', () => {
    const owner = clone(), latest = owner.observations.find(o => o.valueDate === '2026-08' && o.basis === 'monthly')!;
    latest.value = 0; expect(industryHistory(owner, 'monthly').latest?.value).toBe(0);
    latest.value = null; const missing = industryHistory(owner, 'monthly');
    expect(missing.latest?.value).toBeNull(); expect(missing.delta).toBeNull(); expect(missing.states).toContain('missing');
    latest.value = 0; owner.observations = owner.observations.filter(o => o.valueDate !== '2026-07');
    expect(industryHistory(owner, 'monthly').delta).toBeNull();
  });
  it('cumulative/monthly remain distinct; February cumulative is never split or differenced', () => {
    const monthly = industryHistory(clone(), 'monthly'), ytd = industryHistory(clone(), 'year_to_date');
    expect(monthly.history.slice(0, 2).map(p => p.value)).toEqual([null, null]);
    expect(ytd.history[1].value).toBe(143608); expect(ytd.latest?.value).toBe(729352); expect(ytd.delta).toBeNull();
  });
  it('unknown revisions never overwrite each other or use acquisition time as ordering authority', () => {
    const owner = clone(), last = owner.observations.find(o => o.basis === 'monthly' && o.valueDate === '2026-08')!;
    owner.observations.push({ ...last, id: 'new-retained-vintage', value: 0, acquiredAt: '2030-01-01T00:00:00Z' });
    const result = industryHistory(owner, 'monthly');
    expect(result.latest?.records).toHaveLength(2); expect(result.latest?.value).toBeNull(); expect(result.delta).toBeNull(); expect(result.states).toContain('conflicted');
    owner.observations.reverse(); expect(industryHistory(owner, 'monthly')).toEqual(result);
  });
  it.each(['metricId', 'industryId', 'geography', 'scope', 'unit', 'frequency'] as const)('foreign %s fails closed in chart AND coverage', field => {
    const owner = clone(); owner.observations[1][field] = 'foreign';
    const view = industryHistory(owner, 'monthly');
    expect(view.rejectedCount).toBe(1); expect(view.available).toBe(0); expect(view.states).toContain('conflicted');
    expect(industryChartAudit(owner, 'monthly').quality).toContain('conflicted');
  });
  it('duplicate observation id, wrong period scope and provider identity are not silently accepted', () => {
    const owner = clone(); owner.observations.push(structuredClone(owner.observations[1]));
    expect(industryHistory(owner, 'monthly').history[2].value).toBeNull();
    owner.observations[0].referencePeriod.start = '2026-02';
    expect(industryHistory(owner, 'monthly').available).toBe(0);
    const foreign = clone(); foreign.observations[0].provenance.sourceId = 'proxy';
    expect(industryHistory(foreign, 'monthly').rejectedCount).toBe(1);
  });
  it('empty/partial/stale/conflicted/not_admitted/unknown states reach the same chart evidence projection', () => {
    const owner = clone(); owner.observations[0].quality.status = 'stale'; owner.observations[1].quality.status = 'stale'; owner.observations[2].conditions.push('conflicted');
    for (const state of ['missing', 'partial', 'stale', 'conflicted', 'not_admitted', 'unknown']) expect(industryChartAudit(owner, 'year_to_date').quality).toContain(state);
    expect(industryChartAudit(owner, 'monthly').quality).toContain('stale');
    owner.observations = []; expect(industryHistory(owner, 'monthly').latest?.value).toBeNull(); expect(industryHistory(owner, 'monthly').states).toContain('missing');
  });
  it('chart evidence preserves five separate time concepts and unknown proof without filling fields', () => {
    const audit = industryChartAudit(clone(), 'monthly');
    expect(audit.linkage).toBeNull();
    const rows = audit.records[0].rows;
    expect(rows.find(r => r.label.includes('releaseAvailableAt'))?.value).toBe('未提供 / unknown');
    expect(rows.find(r => r.label.includes('publicationDateTime'))?.value).not.toBe(rows.find(r => r.label.includes('acquiredAt'))?.value);
    expect(rows.find(r => r.label.includes('EvidenceRef'))?.value).toContain('candidate');
    expect(audit.quality).toContain('not_admitted');
  });
});
