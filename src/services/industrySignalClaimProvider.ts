import mapping from '../../config/industry/industry-dimension-mapping.v1.json';
import { createIndustryDimensions } from './industryDimensions.mjs';
import { loadIndustryMetrics, industryChartAudit } from './industryMetricProvider';
import { buildIndustrySignalClaims, type IndustrySignalClaims } from './industrySignalClaim.mjs';
import type { IndustryMetricProvider } from './industryMetricRegistry.mjs';
import type { ChartAuditView } from './chartAudit';
const bundled = import.meta.glob<string>(['/config/industry/*.json', '/src/data/real/industry-*.generated.json', '/research-data/industry/**/manifest.json'], { query: '?raw', import: 'default', eager: true });
export type IndustryClaimState = { status: 'available'; result: IndustrySignalClaims; provider: IndustryMetricProvider } | { status: 'blocked'; reason: string };
let loaded: Promise<IndustryClaimState> | undefined;
export function loadIndustrySignalClaims(): Promise<IndustryClaimState> {
  return loaded ??= (async () => {
    try {
      const state = await loadIndustryMetrics();
      if (state.status === 'blocked') return state;
      const dimensions = await createIndustryDimensions(mapping, state.provider);
      const result = await buildIndustrySignalClaims({ provider: state.provider, dimensions, resources: Object.entries(bundled).map(([path, raw]) => ({ path: path.slice(1), raw })) });
      return { status: 'available' as const, result, provider: state.provider };
    } catch (error) { return { status: 'blocked' as const, reason: error instanceof Error ? error.message : 'SIGNAL_CLAIM_UNAVAILABLE' }; }
  })();
}

export function industryClaimAudit(result: IndustrySignalClaims, provider: IndustryMetricProvider, signalId: string): ChartAuditView | null {
  const signal = result.derived.signals.find(s => s.id === signalId);
  if (!signal) return null;
  const metric = provider.get(signal.industryId, signal.metricId);
  const manifest = result.derived.manifests.find(m => m.id === signal.manifestId);
  const graph = result.graphs.find(g => g.graph.nodes.some(n => n.nodeId === signalId));
  const claim = result.derived.claims.find(c => c.signalId === signalId);
  if (!metric || !manifest || !graph) return null;
  const original = industryChartAudit(metric.owner, signal.basis, metric.entry);
  const rows = (values: Record<string, unknown>) => Object.entries(values).map(([label, value]) => ({ label, value: typeof value === 'string' ? value : JSON.stringify(value) }));
  return { title: '事实性候选结论与证据链', scope: signal.industryId, quality: signal.conditions,
    rows: rows({ '候选结论': claim?.text ?? '输入不完整，未生成候选结论。', '计算': '当前留存末期值 − 上一相邻留存期值；绝对差，不是官方增速或行业景气方向。',
      '证据链状态': '已建立留存来源引用链；支持资格未通过，候选未核实。', '使用边界': '数据 / 生产尚未准入；历史时点可得性和官方修订连续性未证明。',
      'F2 graph': graph.graph, 'F2 assessment': graph.assessment, 'Claim Candidate owner': claim ?? null,
      'Derived Signal owner': signal, 'Input manifest': manifest, 'Prosperity eligibility': result.gates.find(g => g.industryId === signal.industryId) }),
    records: [
      { title: '候选结论 → 派生信号', rows: rows({ '候选结论': claim?.text ?? '未生成', '值': signal.value, '公式 pin': signal.formulaRef, 'Input pins': manifest.inputRefs }) },
      ...original.records.filter(r => manifest.inputRefs.some(pin => r.title.endsWith(pin.objectId))),
    ], linkage: null, candidateGraph: true };
}
