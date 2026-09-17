import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { industryChartAudit, industryHistory, industryMetric } from '../../services/industryMetricProvider';
import type { IndustryMetricBasis, IndustryMetricDataset } from '../../types/industryMetric';
import { ChartPanel } from '../common/ChartPanel';
import { ChartAuditPanel } from '../charts/ChartAuditPanel';
import { chartColors, chartTickStyle, chartTooltipStyle, formatAxisNumber } from '../charts/theme';
import { EvidenceDrawer } from '../research/EvidenceDrawer';

const display = (value: number | null | undefined) => value === null || value === undefined ? '暂缺' : value.toLocaleString('zh-CN');
export function IndustryMetricPanel({ industryId }: { industryId: string }) {
  const owner = industryMetric(industryId);
  return owner ? <MetricContent key={owner.definition.id} owner={owner} /> : <section className="rounded-lg border border-borderSoft bg-panel p-4" aria-label="正式行业指标"><h2 className="font-semibold text-textStrong">正式行业指标</h2><p className="mt-2 text-sm text-textMuted">未实现 / not_implemented：当前行业没有正式 Industry Metric owner。</p></section>;
}

/** Exported for adversarial owner-state tests; the product receives only the committed provider artifact. */
export function MetricContent({ owner }: { owner: IndustryMetricDataset }) {
  const [basis, setBasis] = useState<IndustryMetricBasis>('monthly');
  const [showEvidence, setShowEvidence] = useState(false);
  const view = industryHistory(owner, basis), audit = industryChartAudit(owner, basis), d = owner.definition;
  const label = basis === 'monthly' ? '当月产量' : '年内累计产量';
  return <section className="min-w-0 space-y-3" aria-label="正式行业指标">
    <div className="rounded-lg border border-borderSoft bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-textStrong">正式行业指标 · {d.canonicalName}</h2><p className="mt-1 text-xs text-textMuted">{d.scope} · {d.unit}</p></div><button className="inbox-action" type="button" onClick={() => setShowEvidence(true)}>查看指标证据</button></div>
      <p className="mt-3 text-sm text-warning">官方留存样本 · 数据 / 生产 NOT_ADMITTED · 仅供来源核对</p>
      <p className="mt-1 text-xs leading-5 text-textMuted">PIT 与修订连续性未证明；freshness：{d.freshness}。最新值指已留存窗口末期，不保证为当前最新发布。</p>
      <label className="mt-3 block text-sm text-textMuted">指标口径<select className="ml-2 min-h-11 rounded-md border border-control bg-panel2 px-3 text-text" value={basis} onChange={e => setBasis(e.target.value as IndustryMetricBasis)}><option value="monthly">当月产量</option><option value="year_to_date">年内累计产量</option></select></label>
      <dl className="mt-3 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-textMuted">留存末期 · {view.latest?.period ?? '暂缺'}</dt><dd className="mt-1 text-xl tabular-nums text-textStrong">{display(view.latest?.value)} {d.unit}</dd></div><div><dt className="text-xs text-textMuted">相邻月留存值差额</dt><dd className="mt-1 text-xl tabular-nums text-textStrong">{basis === 'monthly' ? `${display(view.delta)} ${d.unit}` : '不比较累计口径'}</dd></div><div><dt className="text-xs text-textMuted">声明窗口数值覆盖</dt><dd className="mt-1 text-xl tabular-nums text-textStrong">{view.available} / {view.target}</dd></div></dl>
      <p className="mt-3 break-words text-xs text-warning">{view.states.join(' / ')}</p>
    </div>
    <ChartPanel title={`${d.canonicalName}历史 · ${label}`} description={`${d.window.start} 至 ${d.window.end} · 单位：${d.unit}`} empty={!view.available}
      summary="1—2 月仅公布合并累计，不拆月、不以累计差分填充当月；相邻月差额仅为留存读数差，不代表官方环比或同口径景气判断。"
      audit={<ChartAuditPanel audit={audit} />}
      dataTable={<table className="w-full text-left text-xs"><caption className="py-2 text-left">官方留存序列 · {label}</caption><thead><tr><th className="p-2">观测期</th><th className="p-2">产量（套）</th><th className="p-2">状态</th></tr></thead><tbody>{view.history.map(point => <tr className="border-t border-borderSoft" key={point.period}><td className="p-2">{point.period}</td><td className="p-2 tabular-nums">{display(point.value)}</td><td className="p-2">{point.states.join(' / ')}</td></tr>)}</tbody></table>}>
      <div className="h-64" role="img" aria-label={`工业机器人${label}历史图，缺失不连接，完整数值见原始数据表`}><ResponsiveContainer width="100%" height="100%"><LineChart data={view.history} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}><CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" /><XAxis dataKey="period" tick={chartTickStyle} minTickGap={30} /><YAxis tick={chartTickStyle} width={65} tickFormatter={formatAxisNumber} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [`${display(value)} 套`, label]} /><Line type="linear" dataKey="value" stroke={chartColors.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
    </ChartPanel>
    {showEvidence ? <EvidenceDrawer audit={audit} onClose={() => setShowEvidence(false)} /> : null}
  </section>;
}
