import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { IndustryClaimState } from '../../services/industrySignalClaimProvider';
import type { ChartAuditView } from '../../services/chartAudit';
import { statusDisplayLabel, unitDisplayLabel } from '../../utils/displayLabels';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';
import { EvidenceDrawer } from '../research/EvidenceDrawer';
import type { BrowserClaimRepository } from '../../services/verifiedClaimRepository';
import type { ClaimBinding, ClaimOwners } from '../../types/verifiedClaim';
const ClaimVerificationModal = lazy(() => import('../research/ClaimVerificationModal').then(module => ({ default: module.ClaimVerificationModal })));

export const blockerLabels: Record<string, string> = {
  DATA_NOT_ADMITTED: '数据或生产尚未准入', PIT_UNPROVED: '历史时点可得性未证明', RELEASE_TIME_UNKNOWN: '公开可得时间未知',
  REVISION_CONTINUITY_UNKNOWN: '官方修订连续性未知', DIMENSION_MISSING: '必需研究维度缺失', CONFLICTED_INPUT: '输入或反证存在冲突',
  MISSING_EVIDENCE: '观测或证据缺失', STALE_INPUT: '输入已过期', PARTIAL_INPUT: '历史覆盖或输入不完整', UNKNOWN_INPUT: '输入仍有未知状态',
  ENTITY_UNRESOLVED: '研究对象身份尚未完成映射', INDUSTRY_SCOPE_UNPROVED: '指标尚不能证明完整行业范围',
  FORMAL_METHOD_NOT_ADMITTED: '正式景气判断方法尚未准入', EVIDENCE_NOT_SUPPORTED: '证据链尚不具备正式支持资格',
};
const dimensionLabels: Record<string, string> = { supply: '供给', demand: '需求', trade_flow: '贸易流', inventory: '库存', price: '价格', margin: '利润率' };
export function IndustrySignalClaimPanel({ industryId }: { industryId: string }) {
  const [state, setState] = useState<IndustryClaimState | null>(null);
  const [audit, setAudit] = useState<ChartAuditView | null>(null);
  const [verification, setVerification] = useState<{ binding: ClaimBinding; owners: ClaimOwners; repository: BrowserClaimRepository; signalId: string } | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const verificationRequest = useRef(0);
  useEffect(() => { setVerification(null); setVerificationError(null); return () => { verificationRequest.current++; }; }, [industryId]);
  useEffect(() => { let active = true; setState(null); setAudit(null); void import('../../services/industrySignalClaimProvider').then(m => m.loadIndustrySignalClaims()).then(value => { if (active) setState(value); }).catch(() => { if (active) setState({ status: 'blocked', reason: 'SIGNAL_CLAIM_UNAVAILABLE' }); }); return () => { active = false; }; }, [industryId]);
  const signals = state?.status === 'available' ? state.result.derived.signals.filter(s => s.industryId === industryId) : [];
  const gate = state?.status === 'available' ? state.result.gates.find(g => g.industryId === industryId) : null;
  async function openEvidence(id: string) {
    if (state?.status !== 'available') return;
    const { industryClaimAudit } = await import('../../services/industrySignalClaimProvider');
    setAudit(industryClaimAudit(state.result, state.provider, id));
  }
  async function openVerification(candidateId: string, signalId: string) {
    if (state?.status !== 'available') return;
    const request = ++verificationRequest.current;
    try {
      const [{ createIndustryClaimOwners }, { BrowserClaimRepository }] = await Promise.all([
        import('../../services/industryVerifiedClaimAdapter'), import('../../services/verifiedClaimRepository'),
      ]);
      const owners = await createIndustryClaimOwners(state.result);
      if (request !== verificationRequest.current) return;
      const binding = owners.bindings.find(b => b.candidateRef.objectId === candidateId);
      if (!binding) throw new Error('CLAIM_CANDIDATE_UNAVAILABLE');
      setVerification({ owners, binding, signalId, repository: new BrowserClaimRepository(window.localStorage, owners) }); setVerificationError(null);
    } catch (error) { if (request === verificationRequest.current) setVerificationError(String(error)); }
  }
  return <section aria-label="派生信号与景气判断资格" className="min-w-0 space-y-4 rounded-lg border border-borderSoft bg-panel p-4">
    <div><h2 className="text-lg font-semibold text-textStrong">派生信号与事实性候选结论</h2>
      <p className="mt-2 text-xs leading-5 text-textMuted">只比较当前留存快照中的相邻期数值。候选结论尚未核实，不构成行业景气方向或投资建议。</p></div>
    {!state ? <p className="text-sm text-textMuted">正在核对公式与证据引用…</p> : state.status === 'blocked' ? <><p className="text-warning">公式或证据核验未通过，暂不生成候选结论。</p><AdvancedAuditDetails>{state.reason}</AdvancedAuditDetails></> : <>
      {!signals.length ? <p className="text-sm text-textMuted">当前行业尚无已审查的派生公式。</p> : null}
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">{signals.map(signal => {
        const claim = state.result.derived.claims.find(c => c.signalId === signal.id);
        const metric = state.provider.get(industryId, signal.metricId);
        return <article key={signal.id} className="min-w-0 space-y-2 rounded-md border border-borderSoft bg-panel2 p-3">
          <h3 className="text-sm font-semibold text-textStrong">{metric?.owner.definition.canonicalName}</h3>
          <p className="text-xs text-textMuted">相邻留存期绝对差 · {signal.previousPeriod} → {signal.currentPeriod}</p>
          <p className="text-xl tabular-nums text-textStrong">{signal.value === null ? '暂缺' : signal.value.toLocaleString('zh-CN')} <span className="text-xs">{unitDisplayLabel(signal.unit)}</span></p>
          <p className="text-xs text-warning">{signal.conditions.map(statusDisplayLabel).join(' / ')}</p>
          <p className="text-sm leading-6 text-textStrong">{claim?.text ?? '输入缺失或存在冲突，未生成候选结论。'}</p>
          {claim ? <p className="text-xs text-textMuted">事实性候选 · 固定模板生成 · 未核实</p> : null}
          <button type="button" className="inbox-action" onClick={() => void openEvidence(signal.id)}>查看完整证据链</button>
          {claim && <button type="button" className="inbox-action ml-2" onClick={() => void openVerification(claim.id, signal.id)}>验证主张与历史</button>}
        </article>;
      })}</div>
      {industryId === 'robotics' ? <p className="text-xs text-textMuted">官方同比与累计值未登记派生公式，继续在原指标面板核对。</p> : null}
      <section aria-label="景气判断资格" className="rounded-md border border-warning/40 p-3">
        <h3 className="font-semibold text-textStrong">景气判断资格：{gate?.eligibility === 'ELIGIBLE' ? '具备证据条件' : '暂不具备条件'}</h3>
        <p className="mt-2 text-sm text-warning">当前暂不生成正式行业景气结论。</p>
        <ul className="mt-2 list-inside list-disc text-xs leading-6 text-textMuted">{gate ? gate.blockers.map(code => <li key={code}>{blockerLabels[code] ?? '资格核验尚未完成'}</li>) : <li>当前行业尚无已审查的资格策略与证据。</li>}</ul>
        {gate?.missingDimensions.length ? <p className="mt-2 text-xs text-textMuted">缺失维度：{gate.missingDimensions.map(d => dimensionLabels[d] ?? d).join('、')}</p> : null}
      </section>
      <AdvancedAuditDetails><pre className="whitespace-pre-wrap break-all">{JSON.stringify({ gate, signals }, null, 2)}</pre></AdvancedAuditDetails>
    </>}
    {verificationError && <><p role="alert" className="text-sm text-warning">原始候选核对失败，未打开主张验证。</p><AdvancedAuditDetails>{verificationError}</AdvancedAuditDetails></>}
    {verification && <Suspense fallback={<p className="text-sm text-textMuted">正在读取主张历史…</p>}><ClaimVerificationModal {...verification} onClose={() => setVerification(null)} onEvidence={() => void openEvidence(verification.signalId)} /></Suspense>}
    {audit ? <EvidenceDrawer audit={audit} onClose={() => setAudit(null)} /> : null}
  </section>;
}
