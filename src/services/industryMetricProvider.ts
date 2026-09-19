import { industryHistory } from './industryHistory.mjs';
export { industryHistory } from './industryHistory.mjs';
import registry from '../../config/industry/industry-metric-registry.v1.json';
import { createIndustryMetricProvider } from './industryMetricRegistry.mjs';
import type { IndustryMetricProvider, IndustryMetricRegistryEntry } from './industryMetricRegistry.mjs';
import type { IndustryMetricBasis, IndustryMetricDataset } from '../types/industryMetric';
import { type ChartAuditView } from './chartAudit';
import { safeEvidenceUrl } from '../utils/evidenceUrl';

// Registry is the only discovery index. Glob resources are bytes, never positional owner matches.
const bundled = import.meta.glob<string>(['/config/industry/*.json', '/src/data/real/industry-*.generated.json', '/research-data/industry/**/manifest.json'], { query: '?raw', import: 'default', eager: true });
export type IndustryProviderState = { status: 'available'; provider: IndustryMetricProvider } | { status: 'blocked'; reason: string };
let loaded: Promise<IndustryProviderState> | undefined;
export function loadIndustryMetrics(): Promise<IndustryProviderState> {
  return loaded ??= createIndustryMetricProvider(registry, Object.entries(bundled).map(([path, raw]) => ({ path: path.slice(1), raw })))
    .then(provider => ({ status: 'available' as const, provider }), error => ({ status: 'blocked' as const, reason: error instanceof Error ? error.message : 'REGISTRY_UNAVAILABLE' }));
}

export function industryChartAudit(owner: IndustryMetricDataset, basis: IndustryMetricBasis, entry?: IndustryMetricRegistryEntry): ChartAuditView {
  const view = industryHistory(owner, basis), d = owner.definition;
  const row = (label: string, value: unknown) => ({ label, value: value === null || value === undefined ? '未提供 / unknown' : String(value) });
  return { title: `${d.canonicalName} · ${basis}`, scope: `${d.industryId} · ${d.geography} · ${d.scope}`, quality: view.states,
    rows: [row('Metric owner', d.id), row('Industry identity（非 Entity Registry 映射）', d.industryId), row('Entity Registry', owner.policy.entityResolution),
      row('单位 / 原生频率 / 口径', `${d.unit} / ${d.nativeFrequency} / ${basis}`), row('观测期间（非发布时间）', `${d.window.start} → ${d.window.end}`),
      row('窗口完整性', `${view.available}/${view.target}；仅声明窗口；缺失不补值`), row('历史覆盖', owner.completeness.historicalCoverage),
      row('freshness', d.freshness), row('包生成 generatedAt', owner.generatedAt), row('数据准入', owner.policy.dataAdmission), row('生产准入', owner.policy.productionAdmission),
      row('严格 PIT / 官方修订连续性', '未证明 / unknown'), row('F1', 'binding 已校验；Entity / vintage 未闭合，NOT_READY'),
      row('F3', 'Frozen service adapter NOT_IMPLEMENTED；未提升覆盖'), row('计算', entry?.presentation.note ?? (d.nativeFrequency === 'weekly' ? '官方周末留存读数；不展示相邻期变化；缺失不补值' : d.unit === '%' ? '官方直接发布同比增长（%）；不从绝对量计算、不作累计差分或补缺；不展示相邻期变化' : '当月绝对量直接读取；差额=同年相邻月留存值之差，非官方环比增速；累计值不作环比；缺失不连接')),
      row('不匹配记录数', view.rejectedCount), row('Definition pin', JSON.stringify(owner.definitionRef)),
      ...(entry ? [row('Registry', 'industry-metric-registry.v1'), row('Artifact pin', JSON.stringify(entry.artifactRef)), row('F1 binding pin', JSON.stringify(entry.bindingRef)), row('Policy pin', JSON.stringify(entry.policyRef))] : [])],
    records: view.history.flatMap(point => point.records.map(o => ({ title: `${o.valueDate} · ${o.basis} · ${o.id}`, rows: [
      row('参考期', `${o.referencePeriod.start} → ${o.referencePeriod.end}`), row('值', point.value), row('原始记录值（冲突时不绘制）', o.value), row('质量', point.states.join(' / ')),
      row('页面标注 publicationDateTime', o.publicationDateTime), row('公开可得 releaseAvailableAt', o.releaseAvailableAt),
      row('采集 acquiredAt（重取网页）', o.acquiredAt), row('生成 generatedAt', o.generatedAt), row('revision / continuity', JSON.stringify(o.revision)),
      row('source owner', o.provenance.sourceOwner), row('acquisition adapter', o.provenance.acquisitionAdapter),
      { ...row('官方来源', safeEvidenceUrl(o.provenance.evidence.sourceUrl) ? o.provenance.evidence.sourceUrl : '不可安全打开'), ...(safeEvidenceUrl(o.provenance.evidence.sourceUrl) ? { href: o.provenance.evidence.sourceUrl } : {}) },
      row('EvidenceRef（candidate，不代表正式 Evidence Graph）', JSON.stringify(o.provenance.evidence)),
      row('原始字节 SHA-256', o.provenance.rawSha256), row('Capture pin', JSON.stringify(o.provenance.captureRef)),
      row('表格定位 / 列', `${o.provenance.locator} / ${o.provenance.column ?? 'unknown'}`), row('原始行', o.provenance.rawRow?.join(' | ')),
      row('PIT / data / production', `${o.pit} / ${o.dataAdmission} / ${o.productionAdmission}`),
    ] }))), linkage: null };
}
