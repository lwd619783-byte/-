import { useEffect, useState } from 'react';
import { loadIndustryMetrics, type IndustryProviderState } from '../../services/industryMetricProvider';
import { buildIndustryChanges, industryEventAudit, type IndustryChangeEvent } from '../../services/industrySignals';
import { EvidenceDrawer } from '../research/EvidenceDrawer';

export function IndustryChangeSummary({ event, onOpenEvidence }: { event: IndustryChangeEvent; onOpenEvidence: () => void }) {
  return <div className="min-w-0">
    <h3 className="break-words font-semibold text-textStrong">{event.title}</h3>
    <p className="mt-2 text-xs leading-5 text-textMuted">留存期间：{event.period} · 页面标注发布：{event.publicationDateTime?.slice(0, 10) ?? 'unknown'} · 公开可得时间：{event.releaseAvailableAt ?? 'unknown'}</p>
    <p className="mt-2 break-words text-xs leading-5 text-warning">{event.conditions.join(' / ')} · 仅供来源核对，不代表生产准入。</p>
    <dl className="mt-3 grid gap-3 sm:grid-cols-2">{event.signals.flatMap(signal => signal.readings.map(reading => <div key={`${signal.id}:${reading.basis}`} className="min-w-0"><dt className="text-xs text-textMuted">{reading.label}</dt><dd className="mt-1 text-sm tabular-nums text-textStrong">{reading.value === null ? '暂缺' : reading.value.toLocaleString('zh-CN')} {reading.unit}</dd></div>))}</dl>
    <button type="button" className="inbox-action mt-3" onClick={onOpenEvidence}>查看行业变化证据</button>
  </div>;
}

export function IndustryChangePanel({ industryId }: { industryId: string }) {
  const [state, setState] = useState<IndustryProviderState | null>(null);
  const [selected, setSelected] = useState<IndustryChangeEvent | null>(null);
  useEffect(() => { let active = true; void loadIndustryMetrics().then(value => { if (active) setState(value); }); return () => { active = false; }; }, []);
  useEffect(() => { setSelected(null); }, [industryId]);
  const events = state?.status === 'available' ? buildIndustryChanges(state.provider, industryId).events : [];
  return <section aria-label="行业最新变化" className="min-w-0 rounded-lg border border-borderSoft bg-panel p-4">
    <h2 className="mb-3 text-lg font-semibold text-textStrong">最新变化</h2>
    {events.map(event => <IndustryChangeSummary key={event.id} event={event} onOpenEvidence={() => setSelected(event)} />)}
    {!events.length ? <p className="break-words text-sm text-textMuted">{!state ? '正在校验正式指标…' : state.status === 'blocked' ? `行业变化不可用 / blocked：${state.reason}` : '行业变化 unavailable：没有可投影的正式 Industry Metric 留存记录。'}</p> : null}
    {selected ? <EvidenceDrawer audit={industryEventAudit(selected)} onClose={() => setSelected(null)} /> : null}
  </section>;
}
