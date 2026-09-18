import { auditDisplayText, statusDisplayLabel, unitDisplayLabel } from '../../utils/displayLabels';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { industryChartAudit, industryHistory, loadIndustryMetrics, type IndustryProviderState } from '../../services/industryMetricProvider';
import type { RegisteredIndustryMetric } from '../../services/industryMetricRegistry.mjs';
import type { IndustryMetricBasis, IndustryMetricDataset } from '../../types/industryMetric';
import { ChartPanel } from '../common/ChartPanel';
import { ChartAuditPanel } from '../charts/ChartAuditPanel';
import { chartColors, chartTickStyle, chartTooltipStyle, formatAxisNumber } from '../charts/theme';
import { EvidenceDrawer } from '../research/EvidenceDrawer';

const display = (value: number | null | undefined) => value === null || value === undefined ? '暂缺' : value.toLocaleString('zh-CN');
export function IndustryMetricPanel({ industryId }: { industryId: string }) {
  const [state, setState] = useState<IndustryProviderState | null>(null);
  useEffect(() => { let active = true; void loadIndustryMetrics().then(value => { if (active) setState(value); }); return () => { active = false; }; }, []);
  if (state?.status === 'available') {
    const metrics = state.provider.list(industryId);
    if (metrics.length) return <MetricSelection key={industryId} metrics={metrics} />;
  }
  return <section className="rounded-lg border border-borderSoft bg-panel p-4" aria-label="正式行业指标"><h2 className="font-semibold text-textStrong">正式行业指标</h2><p className="mt-2 break-words text-sm text-textMuted">{!state ? '正在校验指标目录…' : state.status === 'blocked' ? '正式指标暂不可用；校验未通过，详见高级审计信息。' : '当前行业尚未接入正式指标。'}</p>{state?.status === 'blocked' ? <AdvancedAuditDetails>{state.reason}</AdvancedAuditDetails> : null}</section>;
}
function MetricSelection({ metrics }: { metrics: RegisteredIndustryMetric[] }) {
  const [metricId, setMetricId] = useState(metrics[0].entry.metricId);
  const selected = metrics.find(m => m.entry.metricId === metricId);
  return <div className="min-w-0 space-y-3">
    <label className="block text-sm text-textMuted">正式指标<select aria-label="正式指标" className="mt-2 block min-h-11 w-full max-w-full rounded-md border border-control bg-panel2 px-3 text-text" value={metricId} onChange={e => setMetricId(e.target.value)}>{metrics.map(m => <option key={m.entry.metricId} value={m.entry.metricId}>{m.owner.definition.canonicalName}</option>)}</select></label>
    {selected ? <MetricContent key={metricId} owner={selected.owner} entry={selected.entry} /> : <p>指标缺失</p>}
  </div>;
}

/** Exported for adversarial owner-state tests; the product receives only the committed provider artifact. */
export function MetricContent({ owner, entry }: { owner: IndustryMetricDataset; entry?: RegisteredIndustryMetric['entry'] }) {
  const [basis, setBasis] = useState<IndustryMetricBasis>(owner.definition.basis[0]);
  const [showEvidence, setShowEvidence] = useState(false);
  const presentation = entry?.presentation;
  const view = industryHistory(owner, basis), audit = industryChartAudit(owner, basis, entry), d = owner.definition;
  const label = presentation?.basisLabels[basis] ?? (basis === 'monthly' ? '当月产量' : '年内累计产量');
  const showDelta = d.unit !== '%' && (presentation?.delta ?? 'absolute_difference') === 'absolute_difference';
  return <section className="min-w-0 space-y-3" aria-label="正式行业指标">
    <div className="rounded-lg border border-borderSoft bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-textStrong">正式行业指标 · {d.canonicalName}</h2><p className="mt-1 text-xs text-textMuted">{auditDisplayText(d.scope)} · {unitDisplayLabel(d.unit)}</p></div><button className="inbox-action" type="button" onClick={() => setShowEvidence(true)}>查看指标证据</button></div>
      <p className="mt-3 text-sm text-warning">官方留存样本 · 数据 / 生产尚未准入 · 仅供来源核对</p>
      <p className="mt-1 text-xs leading-5 text-textMuted">历史时点可得性（PIT）与修订连续性未证明；数据新鲜度：{statusDisplayLabel(d.freshness)}。最新值指已留存窗口末期，不保证为当前最新发布。</p>
      <label className="mt-3 block text-sm text-textMuted">指标口径<select aria-label="指标口径" className="ml-2 min-h-11 rounded-md border border-control bg-panel2 px-3 text-text" value={basis} onChange={e => setBasis(e.target.value as IndustryMetricBasis)}>{d.basis.map(b => <option key={b} value={b}>{presentation?.basisLabels[b] ?? (b === 'monthly' ? '当月产量' : '年内累计产量')}</option>)}</select></label>
      <dl className="mt-3 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-textMuted">留存末期 · {view.latest?.period ?? '暂缺'}</dt><dd className="mt-1 text-xl tabular-nums text-textStrong">{display(view.latest?.value)} {unitDisplayLabel(d.unit)}</dd></div>{showDelta ? <div><dt className="text-xs text-textMuted">相邻月留存值差额</dt><dd className="mt-1 text-xl tabular-nums text-textStrong">{basis === 'monthly' ? `${display(view.delta)} ${unitDisplayLabel(d.unit)}` : '不比较累计口径'}</dd></div> : null}<div><dt className="text-xs text-textMuted">声明窗口数值覆盖</dt><dd className="mt-1 text-xl tabular-nums text-textStrong">{view.available} / {view.target}</dd></div></dl>
      <p className="mt-3 break-words text-xs text-warning">{view.states.map(statusDisplayLabel).join(' / ')}</p>
    </div>
    <ChartPanel title={`${d.canonicalName}历史 · ${label}`} description={`${d.window.start} 至 ${d.window.end} · 单位：${unitDisplayLabel(d.unit)}`} empty={!view.available}
      summary={presentation?.note ?? '1—2 月仅公布合并累计，不拆月、不以累计差分填充当月；相邻月差额仅为留存读数差，不代表官方环比或同口径景气判断。'}
      audit={<ChartAuditPanel audit={audit} />}
      dataTable={<table className="w-full text-left text-xs"><caption className="py-2 text-left">官方留存序列 · {label}</caption><thead><tr><th className="p-2">观测期</th><th className="p-2">{d.canonicalName}（{unitDisplayLabel(d.unit)}）</th><th className="p-2">状态</th></tr></thead><tbody>{view.history.map(point => <tr className="border-t border-borderSoft" key={point.period}><td className="p-2">{point.period}</td><td className="p-2 tabular-nums">{display(point.value)}</td><td className="p-2">{point.states.map(statusDisplayLabel).join(' / ')}</td></tr>)}</tbody></table>}>
      <div className="h-64" role="img" aria-label={`${d.canonicalName} · ${label}历史图，缺失不连接，完整数值见原始数据表`}><ResponsiveContainer width="100%" height="100%"><LineChart data={view.history} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}><CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" /><XAxis dataKey="period" tick={chartTickStyle} minTickGap={30} /><YAxis tick={chartTickStyle} width={65} tickFormatter={formatAxisNumber} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`${display(value)} ${unitDisplayLabel(d.unit)}`, label]} /><Line type="linear" dataKey="value" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
    </ChartPanel>
    {showEvidence ? <EvidenceDrawer audit={audit} onClose={() => setShowEvidence(false)} /> : null}
  </section>;
}
