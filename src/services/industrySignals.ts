import type { EvidenceRef } from '../../local-core/domain/asset-types';
import type { DataQualityMeta } from '../types/dataSource';
import type { IndustryMetricObservation, IndustryMetricPin } from '../types/industryMetric';
import type { IndustryMetricProvider, RegisteredIndustryMetric } from './industryMetricRegistry.mjs';
import { industryHistory } from './industryMetricProvider';
import { orderedStates, type ChartAuditView } from './chartAudit';
import { safeEvidenceUrl } from '../utils/evidenceUrl';

/** Read-only diagnostic projections, never admitted ResearchEvent/Evidence/Entity records. */
export interface IndustrySignalInput {
  role: 'current' | 'previous'; observationId: string; artifactRef: IndustryMetricPin;
  definitionRef: IndustryMetricPin; bindingRef: IndustryMetricPin; policyRef: IndustryMetricPin;
  observation: IndustryMetricObservation;
}
export interface IndustrySignalReading {
  basis: string; label: string; period: string; value: number | null; unit: string;
  delta: number | null; deltaSemantics: 'retained_absolute_difference' | 'none'; conditions: string[];
}
export interface DerivedIndustrySignal {
  schemaVersion: 'derived-industry-signal.v1'; id: string; industryId: string; metricId: string;
  name: string; sourceId: string; sourceOwner: string; period: string; asOf: string;
  transformVersion: 'industry-retained-readings.v1'; readings: IndustrySignalReading[];
  inputs: IndustrySignalInput[]; quality: DataQualityMeta[]; conditions: string[]; evidence: EvidenceRef[];
  publicationDateTime: string | null; releaseAvailableAt: string | null;
}
export interface IndustryChangeEvent {
  schemaVersion: 'industry-change-event.v1'; id: string; industryId: string; title: string;
  sourceId: string; period: string; asOf: string; publicationDateTime: string | null; releaseAvailableAt: string | null;
  transformVersion: 'industry-release-group.v1'; signals: DerivedIndustrySignal[];
  quality: DataQualityMeta[]; conditions: string[]; evidence: EvidenceRef[];
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const unique = <T,>(values: T[]): T[] => [...new Map(values.map(value => [JSON.stringify(value), value])).entries()].sort(([a], [b]) => compare(a, b)).map(([, value]) => value);
const consensus = (values: Array<string | null>) => values.length && values.every(value => value !== null && value === values[0]) ? values[0] : null;
const key = (...parts: string[]) => parts.map(encodeURIComponent).join(':');
const currentRecords = (signal: DerivedIndustrySignal) => signal.inputs.filter(input => input.role === 'current').map(input => input.observation);

function derive(metric: RegisteredIndustryMetric, period: string): DerivedIndustrySignal {
  const { owner, entry } = metric, d = owner.definition;
  const inputs: IndustrySignalInput[] = [];
  const addInput = (observation: IndustryMetricObservation, role: IndustrySignalInput['role']) => inputs.push({ role, observationId: observation.id,
    artifactRef: entry.artifactRef, definitionRef: entry.definitionRef, bindingRef: entry.bindingRef, policyRef: entry.policyRef, observation });
  const readings = d.basis.map(basis => {
    const view = industryHistory(owner, basis), point = view.history.find(row => row.period === period);
    const deltaEnabled = entry.presentation.delta === 'absolute_difference' && d.unit !== '%' && basis === 'monthly';
    point?.records.forEach(record => addInput(record, 'current'));
    const delta = deltaEnabled && point === view.latest ? view.delta : null;
    // A derived difference retains both operands and their pins, never just the latest value.
    if (delta !== null) view.previous?.records.forEach(record => addInput(record, 'previous'));
    return { basis, label: entry.presentation.basisLabels[basis], period, value: point?.value ?? null, unit: d.unit,
      delta, deltaSemantics: deltaEnabled ? 'retained_absolute_difference' as const : 'none' as const,
      conditions: orderedStates([...view.states, ...(point?.states ?? ['missing', 'partial']), ...(d.window.end < period ? ['stale'] : [])]) };
  });
  const sortedInputs = unique(inputs), records = sortedInputs.map(input => input.observation), current = sortedInputs.filter(input => input.role === 'current').map(input => input.observation);
  const publicationDateTime = consensus(current.map(o => o.publicationDateTime));
  const releaseAvailableAt = consensus(current.map(o => o.releaseAvailableAt));
  const conditions = orderedStates([...readings.flatMap(reading => reading.conditions),
    ...(!releaseAvailableAt ? ['unknown'] : []),
    ...records.flatMap(o => ['partial', 'stale', 'unknown'].includes(o.provenance.evidence?.quality ?? 'unknown') ? [o.provenance.evidence?.quality ?? 'unknown'] : []),
    ...(records.some(o => !o.provenance.evidence?.refId) ? ['missing_evidence', 'partial'] : []),
    ...(records.some(o => o.provenance.evidence?.quality !== 'verified') ? ['unknown'] : [])]);
  return { schemaVersion: 'derived-industry-signal.v1', id: key('industry-signal', d.industryId, d.id, period), industryId: d.industryId,
    metricId: d.id, name: d.canonicalName, sourceId: d.sourceId, sourceOwner: d.sourceOwner, period, asOf: period,
    transformVersion: 'industry-retained-readings.v1', readings, inputs: sortedInputs, quality: unique(records.map(o => o.quality)), conditions,
    evidence: unique(records.flatMap(o => o.provenance.evidence ? [o.provenance.evidence] : [])), publicationDateTime, releaseAvailableAt };
}

/** Registry provider is the sole input: quotes and qualitative Industry fields cannot enter. */
export function buildIndustryChanges(provider: IndustryMetricProvider, industryId: string): { signals: DerivedIndustrySignal[]; events: IndustryChangeEvent[] } {
  const candidates = provider.list(industryId);
  // Do not silently choose among duplicate or cross-owner inputs from a malformed provider.
  if (candidates.some(m => m.entry.industryId !== industryId || m.owner.definition.industryId !== industryId || m.entry.metricId !== m.owner.definition.id)
    || new Set(candidates.map(m => m.entry.metricId)).size !== candidates.length) return { signals: [], events: [] };
  const period = candidates.map(m => m.owner.definition.window.end).sort(compare).at(-1);
  if (!period) return { signals: [], events: [] };
  const signals = candidates.map(metric => derive(metric, period)).sort((a, b) => compare(a.id, b.id));
  const sources = [...new Set(signals.map(signal => signal.sourceId))].sort(compare);
  const events = sources.flatMap(sourceId => {
    const group = signals.filter(signal => signal.sourceId === sourceId), records = group.flatMap(currentRecords);
    if (!records.length) return [];
    // Same source/period is one release group. Distinct retained bytes or release metadata are
    // a conflict in that group, not several cards or a guessed revision winner.
    const conflicted = new Set(records.map(o => o.provenance.rawSha256)).size > 1
      || new Set(records.map(o => o.provenance.evidence?.sourceUrl ?? null)).size > 1
      || new Set(records.map(o => o.publicationDateTime)).size > 1
      || new Set(records.map(o => o.releaseAvailableAt)).size > 1;
    const conditions = orderedStates([...group.flatMap(signal => signal.conditions), ...(conflicted ? ['conflicted'] : [])]);
    const eventSignals = conflicted ? group.map(signal => ({ ...signal, conditions: orderedStates([...signal.conditions, 'conflicted']),
      readings: signal.readings.map(reading => ({ ...reading, value: null, delta: null, conditions: orderedStates([...reading.conditions, 'conflicted']) })) })) : group;
    const subject = industryId === 'robotics' ? '工业机器人' : industryId;
    return [{ schemaVersion: 'industry-change-event.v1' as const, id: key('industry-change', industryId, sourceId, period), industryId,
      title: `${group[0].sourceOwner}更新${subject} ${Number(period.slice(5))} 月${industryId === 'robotics' ? '产量' : '指标'}数据`,
      sourceId, period, asOf: period, publicationDateTime: consensus(records.map(o => o.publicationDateTime)), releaseAvailableAt: consensus(records.map(o => o.releaseAvailableAt)),
      transformVersion: 'industry-release-group.v1' as const, signals: eventSignals, quality: unique(group.flatMap(signal => signal.quality)), conditions,
      evidence: unique(group.flatMap(signal => signal.evidence)) }];
  });
  return { signals: signals.map(signal => events.flatMap(event => event.signals).find(projected => projected.id === signal.id) ?? signal), events };
}

export function industryEventAudit(event: IndustryChangeEvent): ChartAuditView {
  const row = (label: string, value: unknown) => ({ label, value: value == null ? '未提供 / unknown' : typeof value === 'object' ? JSON.stringify(value) : String(value) });
  return { title: event.title, scope: `${event.industryId} · ${event.period}`, quality: event.conditions, linkage: null,
    rows: [row('Event projection ID', event.id), row('Signal / Event transform', `${event.signals[0]?.transformVersion} / ${event.transformVersion}`),
      row('期间 / asOf（观测期间，非公开可得时间）', event.asOf), row('页面标注 publicationDateTime', event.publicationDateTime), row('公开可得 releaseAvailableAt', event.releaseAvailableAt),
      row('使用边界', '只读来源核对；沿用 Metric 准入和候选 Evidence，不创建正式 Evidence / ResearchEvent / Entity；无景气或交易判断')],
    records: event.signals.flatMap(signal => [
      { title: `${signal.name} · ${signal.metricId}`, rows: signal.readings.map(reading => row(reading.label, { value: reading.value, unit: reading.unit, delta: reading.delta, deltaSemantics: reading.deltaSemantics, conditions: reading.conditions })) },
      ...signal.inputs.map(input => { const o = input.observation, url = safeEvidenceUrl(o.provenance.evidence?.sourceUrl); return {
        title: `${input.role} · ${o.id}`, rows: [row('input pins', { artifact: input.artifactRef, definition: input.definitionRef, binding: input.bindingRef, policy: input.policyRef }),
          row('原始 observation（冲突值仅核对）', o), row('EvidenceRef（保留原质量）', o.provenance.evidence),
          { ...row('官方来源', url), ...(url ? { href: url } : {}) }] }; }),
    ]) };
}

/** Identical re-delivery is a no-op; divergent copies retain every input and suppress values. */
export function deduplicateIndustryEvents(events: IndustryChangeEvent[]): IndustryChangeEvent[] {
  return [...new Set(events.map(event => event.id))].sort(compare).flatMap(id => {
    const variants = unique(events.filter(event => event.id === id)), first = variants[0];
    if (variants.length === 1) return [first];
    if (variants.some(event => event.industryId !== first.industryId || event.sourceId !== first.sourceId || event.period !== first.period)) return [];
    const signals = [...new Set(variants.flatMap(event => event.signals.map(signal => signal.id)))].sort(compare).map(signalId => {
      const copies = variants.flatMap(event => event.signals).filter(signal => signal.id === signalId), signal = copies[0];
      return { ...signal, conditions: orderedStates([...copies.flatMap(copy => copy.conditions), 'conflicted']),
        readings: signal.readings.map(reading => ({ ...reading, value: null, delta: null, conditions: orderedStates([...reading.conditions, 'conflicted']) })),
        inputs: unique(copies.flatMap(copy => copy.inputs)), evidence: unique(copies.flatMap(copy => copy.evidence)), quality: unique(copies.flatMap(copy => copy.quality)),
        publicationDateTime: consensus(copies.map(copy => copy.publicationDateTime)), releaseAvailableAt: consensus(copies.map(copy => copy.releaseAvailableAt)) };
    });
    return [{ ...first, signals, conditions: orderedStates([...variants.flatMap(event => event.conditions), 'conflicted']),
      quality: unique(variants.flatMap(event => event.quality)), evidence: unique(variants.flatMap(event => event.evidence)),
      publicationDateTime: consensus(variants.map(event => event.publicationDateTime)), releaseAvailableAt: consensus(variants.map(event => event.releaseAvailableAt)) }];
  });
}
