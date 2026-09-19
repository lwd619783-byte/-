import mapping from '../../config/industry/industry-dimension-mapping.v1.json';
import { createIndustryDimensions, INDUSTRY_DIMENSIONS, type IndustryDimensions } from './industryDimensions.mjs';
import { industryChartAudit, industryHistory, loadIndustryMetrics } from './industryMetricProvider';
import { orderedStates } from './chartAudit';

export const SNAPSHOT_NOTICE = '当前为多因子基本面快照，不构成行业景气评分或投资结论。';
/** Ephemeral read model: exact reviewed mapping -> existing provider/history. No new facts or deltas. */
export function industrySnapshot(industryId: string, dimensions: IndustryDimensions) {
  const members = dimensions.list(industryId);
  const groups = INDUSTRY_DIMENSIONS.map(dimension => {
    const rows = members.filter(m => m.mapping.dimension === dimension).flatMap(({ metric, mapping: entry }) =>
      [...metric.owner.definition.basis].sort().map(basis => {
        const { owner } = metric, d = owner.definition, view = industryHistory(owner, basis);
        return { metricId: d.id, industryId, name: d.canonicalName, basis,
          basisLabel: metric.entry.presentation.basisLabels[basis], mapping: entry,
          value: view.latest?.value ?? null, period: view.latest?.period ?? null,
          unit: d.unit, source: d.sourceOwner, scope: d.scope,
          available: view.available, target: view.target, historicalCoverage: owner.completeness.historicalCoverage,
          states: orderedStates([...view.states, ...(owner.completeness.historicalCoverage === 'partial' ? ['partial'] : [])]),
          publicationDateTime: view.latest?.records.length === 1 ? view.latest.records[0].publicationDateTime : null,
          releaseAvailableAt: view.latest?.records.length === 1 ? view.latest.records[0].releaseAvailableAt : null,
          pit: view.latest?.records.length === 1 ? view.latest.records[0].pit : 'UNPROVED',
          dataAdmission: owner.policy.dataAdmission, productionAdmission: owner.policy.productionAdmission,
          audit: industryChartAudit(owner, basis, metric.entry),
        };
      }));
    return { dimension, rows, states: rows.length ? orderedStates(rows.flatMap(r => r.states)) : ['missing'] };
  });
  return { schemaVersion: 'industry-multi-factor-snapshot.v1' as const, industryId, notice: SNAPSHOT_NOTICE,
    mappingRevision: dimensions.revision, groups, states: orderedStates(groups.flatMap(g => g.states)) };
}
export type IndustrySnapshot = ReturnType<typeof industrySnapshot>;
export type IndustrySnapshotState = { status: 'available'; snapshot: IndustrySnapshot } | { status: 'blocked'; reason: string };
let loaded: Promise<IndustryDimensions> | undefined;
export async function loadIndustrySnapshot(industryId: string): Promise<IndustrySnapshotState> {
  try {
    loaded ??= loadIndustryMetrics().then(state => {
      if (state.status === 'blocked') throw new Error(state.reason);
      return createIndustryDimensions(mapping, state.provider);
    });
    return { status: 'available', snapshot: industrySnapshot(industryId, await loaded) };
  } catch (error) { return { status: 'blocked', reason: error instanceof Error ? error.message : 'DIMENSION_SNAPSHOT_UNAVAILABLE' }; }
}
