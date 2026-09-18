import { useEffect, useState } from 'react';
import { loadIndustrySnapshot, SNAPSHOT_NOTICE, type IndustrySnapshot, type IndustrySnapshotState } from '../../services/industrySnapshot';
import type { IndustryDimension } from '../../services/industryDimensions.mjs';
import type { ChartAuditView } from '../../services/chartAudit';
import { auditDisplayText, statusDisplayLabel, unitDisplayLabel } from '../../utils/displayLabels';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';
import { EvidenceDrawer } from '../research/EvidenceDrawer';

const labels: Record<IndustryDimension, string> = { supply: '供给', demand: '需求 / 炼化', trade_flow: '贸易流', inventory: '库存', price: '价格', margin: '利润率', utilization: '利用率', capex: '资本开支', policy: '政策', valuation: '估值', trading_state: '交易状态' };
const order: IndustryDimension[] = ['supply', 'demand', 'trade_flow', 'inventory', 'price', 'margin', 'utilization', 'capex', 'policy', 'valuation', 'trading_state'];
export function IndustrySnapshotPanel({ industryId }: { industryId: string }) {
  const [state, setState] = useState<IndustrySnapshotState | null>(null);
  useEffect(() => { let active = true; setState(null); void loadIndustrySnapshot(industryId).then(value => { if (active) setState(value); }); return () => { active = false; }; }, [industryId]);
  if (state?.status === 'available') return <SnapshotContent key={industryId} snapshot={state.snapshot} />;
  return <section aria-label="多因子基本面快照" className="rounded-lg border border-borderSoft bg-panel p-4">
    <h2 className="font-semibold text-textStrong">多因子基本面快照</h2>
    <p className="mt-2 text-sm text-textMuted">{state ? '维度映射校验未通过，快照暂不可用。' : '正在校验基本面维度…'}</p>
    <p className="mt-2 text-xs text-warning">{SNAPSHOT_NOTICE}</p>
    {state?.status === 'blocked' ? <AdvancedAuditDetails>{state.reason}</AdvancedAuditDetails> : null}
  </section>;
}

export function SnapshotContent({ snapshot }: { snapshot: IndustrySnapshot }) {
  const [audit, setAudit] = useState<ChartAuditView | null>(null);
  const groups = order.map(d => snapshot.groups.find(g => g.dimension === d)!);
  const populated = groups.filter(g => g.rows.length), missing = groups.filter(g => !g.rows.length);
  return <section aria-label="多因子基本面快照" className="min-w-0 space-y-3 rounded-lg border border-borderSoft bg-panel p-4">
    <div><h2 className="text-lg font-semibold text-textStrong">多因子基本面快照</h2>
      <p className="mt-1 text-sm text-warning">{snapshot.notice}</p>
      <p className="mt-2 text-xs leading-5 text-textMuted">官方留存样本 · 数据 / 生产尚未准入 · 仅供来源核对。最新值指留存窗口末期，不保证为当前最新发布；各指标期间与口径独立，不合成方向。</p>
    </div>
    {!populated.length ? <p className="text-sm text-textMuted">当前行业尚无已映射的正式基本面指标。</p> : null}
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">{populated.map(group => <section key={group.dimension} aria-label={`${labels[group.dimension]}维度`} className="min-w-0 rounded-md border border-borderSoft bg-panel2 p-3">
      <h3 className="mb-3 font-semibold text-textStrong">{labels[group.dimension]}</h3>
      <div className="space-y-4">{group.rows.map(row => <article key={`${row.metricId}:${row.basis}`} className="min-w-0 space-y-2 break-words">
        <h4 className="text-sm font-medium text-textStrong">{row.name}</h4>
        <p className="text-xs text-textMuted">{row.basisLabel} · 观测期 {row.period ?? '暂缺'}</p>
        <p className="text-xl font-semibold tabular-nums text-textStrong">{row.value === null ? '暂缺' : row.value.toLocaleString('zh-CN')} <span className="text-xs font-normal text-textMuted">{unitDisplayLabel(row.unit)}</span></p>
        <p className="text-xs text-textMuted">{auditDisplayText(row.source)} · 留存窗口 {row.available} / {row.target} · 历史覆盖：{statusDisplayLabel(row.historicalCoverage)}</p>
        <p className="text-xs leading-5 text-textMuted">{auditDisplayText(row.scope)}</p>
        <p className="text-xs text-warning">{row.states.map(statusDisplayLabel).join(' / ')}</p>
        <p className="text-xs leading-5 text-textMuted">发布时间：{row.publicationDateTime ?? '未证明'}；公开可得时间：{row.releaseAvailableAt ?? '未证明'}；历史时点可得性：{statusDisplayLabel(row.pit)}。数据 / 生产：{statusDisplayLabel(row.dataAdmission)} / {statusDisplayLabel(row.productionAdmission)}。</p>
        <button type="button" className="inbox-action" aria-label={`查看${row.name}${row.basisLabel}证据`} onClick={() => setAudit({ ...row.audit, rows: [...row.audit.rows, { label: 'Dimension mapping', value: JSON.stringify({ schemaVersion: 'industry-dimension-mapping.v1', revision: snapshot.mappingRevision, ...row.mapping }) }] })}>查看来源与原始证据</button>
      </article>)}</div>
    </section>)}</div>
    {missing.length ? <p className="break-words text-xs leading-5 text-textMuted">未接入维度（缺失）：{missing.map(g => labels[g.dimension]).join('、')}。不使用行情或研究文字补齐。</p> : null}
    <AdvancedAuditDetails><p className="break-all">{snapshot.schemaVersion} · {snapshot.industryId} · industry-dimension-mapping.v1 / {snapshot.mappingRevision}</p></AdvancedAuditDetails>
    {audit ? <EvidenceDrawer audit={audit} onClose={() => setAudit(null)} /> : null}
  </section>;
}
