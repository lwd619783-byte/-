import { useEffect, useState } from 'react';
import type { ThesisPreview, ThesisRevision, VerifiedClaimRef } from '../../types/thesis';
import type { ClaimBinding, ClaimRevision, ClaimReview } from '../../types/verifiedClaim';
import { canonicalJson } from '../../../shared/canonical-json.mjs';
import type { ChartAuditView } from '../../services/chartAudit';
import { thesisClaimChoices, previewThesis, thesisDiff, thesisReadModel } from '../../services/thesis';
import { draftClaim, previewClaim } from '../../services/verifiedClaim';
import { createThesisWorkspace, type ThesisWorkspaceDataset, type ThesisWorkspaceRuntime } from '../../services/thesisWorkspace';
import { ClaimVerificationModal } from './ClaimVerificationModal';
import { EvidenceDrawer } from './EvidenceDrawer';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';
import { Modal } from '../common/Modal';

const field = 'w-full min-w-0 rounded border border-borderSoft bg-panel2 p-2 text-sm text-textStrong';
const texts = [['statement', '论点陈述'], ['bull', '乐观情景 bull'], ['base', '基准情景 base'], ['bear', '悲观情景 bear']] as const;
const lists = [['keyDrivers', '关键驱动'], ['catalysts', '催化剂'], ['risks', '风险'], ['invalidation', '失效条件']] as const;
const confidenceLabels = { low: '低', medium: '中', high: '高', unknown: '未知' };
const identityKey = (ref: { owner: string; id: string }) => `${ref.owner}:${ref.id}`;
function blank(): ThesisRevision {
  const now = new Date().toISOString();
  return { thesisId: crypto.randomUUID(), revisionId: crypto.randomUUID(), supersedes: null, createdAt: now, asOf: now, origin: 'user_judgement',
    statement: '', bull: '', base: '', bear: '', keyDrivers: [], catalysts: [], risks: [], invalidation: [], confidence: 'unknown', supportingClaims: [], relatedEntities: [], macroIndustry: [], contexts: [], reason: '' };
}
function download(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'thesis-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function RevisionContent({ revision, runtime, onClaim }: { revision: ThesisRevision; runtime: ThesisWorkspaceRuntime; onClaim: (ref: VerifiedClaimRef) => void }) {
  const gate = previewThesis(revision, runtime.owners);
  return <div className="min-w-0 space-y-2 break-words text-sm">
    {texts.map(([key, label]) => <p key={key}><strong>{label}：</strong>{revision[key]}</p>)}
    {lists.map(([key, label]) => <p key={key}><strong>{label}：</strong>{revision[key].join('；') || '未填写'}</p>)}
    <p>信心：{confidenceLabels[revision.confidence]} · asOf：{revision.asOf}</p>
    <p>来源：{revision.origin === 'ai_draft' ? 'AI 草稿（来源永久保留）' : '用户判断'}</p>
    <p>关联对象：{revision.relatedEntities.map(ref => `${runtime.identities.find(row => identityKey(row.ref) === identityKey(ref))?.label ?? '身份未解析'} (${identityKey(ref)})`).join('；') || '无'}</p>
    <div aria-label="支持主张"><strong>支持主张（精确版本）</strong>{revision.supportingClaims.length ? revision.supportingClaims.map(ref => <div key={ref.revisionId} className="break-all"><button className="inbox-action" onClick={() => onClaim(ref)}>Claim → Evidence · {ref.revisionId}</button><p className="text-xs">Claim {ref.claimId} · Review {ref.reviewId}</p></div>) : <p className="text-warning">暂无已验证主张，正式确认阻断。</p>}</div>
    <section aria-label="Macro → Industry"><h4 className="font-semibold">Macro → Industry</h4>{!revision.macroIndustry.length && <p className="text-textMuted">尚无结构化关系；暴露与敏感性未知。</p>}{revision.macroIndustry.map(edge => <div key={edge.relationshipId} className="my-2 rounded border border-borderSoft p-2">
      <p>{edge.macroDriver.id} → {edge.industry.id} · {({ direct: '直接暴露', indirect: '间接暴露', unknown: '暴露未知' })[edge.exposure]} · {edge.sensitivity === 'unknown' ? '敏感性未知' : '定性敏感性'}</p>
      <p>{edge.rationale} · asOf：{edge.asOf}</p><p>成立条件：{edge.conditions.join('；') || '未提供'}</p>
      <p>关系状态：{({ supported: '支持主张可用', unknown: '未知', blocked: '阻断' })[gate.relationships.find(r => r.relationshipId === edge.relationshipId)?.status ?? 'blocked']}</p><p className="text-xs text-textMuted">用户定性关系；主张可用不等于关系理由已经得到独立验证。</p>
    </div>)}</section>
    <section aria-label="Research Context"><strong>Research Context（仅背景，不是验证依据）</strong>{revision.contexts.map((context, i) => <p key={i}><a className="underline" href={context.url} target="_blank" rel="noreferrer">{context.title}</a> · {context.kind}</p>)}</section>
    {gate.blockers.includes('THESIS_CLAIM_SUPERSEDED_ASOF') && <p className="text-warning">支持主张在论点 asOf 时已被后续版本替代，正式确认已阻断；原精确引用未改变。</p>}
    <p className={gate.publishable ? 'text-textMuted' : 'text-warning'}>当前证据支持：{gate.publishable ? '可供本人确认' : '阻断'}</p>
    <AdvancedAuditDetails><pre className="whitespace-pre-wrap break-all">{JSON.stringify({ revisionId: revision.revisionId, blockers: gate.blockers, claims: gate.claims, relationships: gate.relationships }, null, 2)}</pre></AdvancedAuditDetails>
  </div>;
}

export function ThesisWorkspace({ dataset }: { dataset: ThesisWorkspaceDataset }) {
  const [runtime, setRuntime] = useState<ThesisWorkspaceRuntime | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; setRuntime(null); setError(null); void createThesisWorkspace(dataset, window.localStorage).then(value => { if (active) setRuntime(value); }).catch(cause => { if (active) setError(String(cause)); }); return () => { active = false; }; }, [dataset]);
  if (!runtime) return <section aria-label="Thesis V1" className="mb-4 rounded border border-borderSoft p-4"><h2>Thesis V1</h2><p>{error ? '原始证据读取失败，论点工作区已阻断。' : '正在读取论点与原始主张…'}</p>{error && <AdvancedAuditDetails>{error}</AdvancedAuditDetails>}</section>;
  return <ThesisWorkspacePanel runtime={runtime} />;
}

export function ThesisWorkspacePanel({ runtime }: { runtime: ThesisWorkspaceRuntime }) {
  const { repository } = runtime;
  const [loaded, setLoaded] = useState(() => repository.load()), [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ThesisRevision | null>(null), [preview, setPreview] = useState<ThesisPreview | null>(null), [note, setNote] = useState('');
  const [claimBinding, setClaimBinding] = useState<ClaimBinding | null>(null), [audit, setAudit] = useState<ChartAuditView | null>(null);
  const [pinnedClaim, setPinnedClaim] = useState<{ ref: VerifiedClaimRef; revision: ClaimRevision; review: ClaimReview } | null>(null);
  const [backupOpen, setBackupOpen] = useState(false), [raw, setRaw] = useState(''), [importReady, setImportReady] = useState(false);
  const [macroId, setMacroId] = useState(''), [industryId, setIndustryId] = useState(''), [rationale, setRationale] = useState(''), [conditions, setConditions] = useState('');
  const [exposure, setExposure] = useState<'direct' | 'indirect' | 'unknown'>('unknown'), [sensitivity, setSensitivity] = useState<'qualitative' | 'unknown'>('unknown');
  const [contextTitle, setContextTitle] = useState(''), [contextUrl, setContextUrl] = useState('');
  const now = new Date().toISOString();
  const rows = thesisReadModel(loaded.data, runtime.owners, now);
  let claimError: string | null = null, choiceError: string | null = null;
  let currentChoices: ReturnType<typeof thesisClaimChoices> = [], choices: ReturnType<typeof thesisClaimChoices> = [];
  try {
    currentChoices = thesisClaimChoices(runtime.owners, now);
  } catch (cause) { claimError = String(cause); }
  try { choices = editor ? thesisClaimChoices(runtime.owners, editor.asOf) : currentChoices; }
  catch (cause) { choiceError = String(cause); }
  const verifiable = runtime.bindings.filter(binding => { try { return previewClaim(draftClaim(binding, runtime.claimOwners, { revisionId: 'readonly-preview', createdAt: now, asOf: now, supersedes: null, reason: 'read-only', contexts: [] }), runtime.claimOwners).verifiable; } catch { return false; } }).length;
  const act = (action: () => void) => { try { action(); setError(null); } catch (cause) { setError(String(cause)); } };
  const refresh = () => { setLoaded(repository.load()); setPreview(null); };
  const edit = <K extends keyof ThesisRevision>(key: K, value: ThesisRevision[K]) => setEditor(old => old ? { ...old, [key]: value } : old);
  const openClaim = (ref: VerifiedClaimRef) => act(() => {
    const { data } = runtime.owners.claims(), revision = data.revisions.find(r => r.claimId === ref.claimId && r.revisionId === ref.revisionId);
    const review = data.reviews.find(r => r.reviewId === ref.reviewId && r.claimId === ref.claimId && r.revisionId === ref.revisionId);
    if (!revision || !review || canonicalJson(revision) !== ref.revisionBytes || canonicalJson(review) !== ref.reviewBytes) throw new Error('THESIS_CLAIM_EXACT_REF_UNAVAILABLE');
    setPinnedClaim({ ref, revision, review });
  });
  return <section aria-label="Thesis V1" className="mb-5 min-w-0 space-y-4 rounded-lg border border-borderSoft bg-panel p-4">
    <div><h2 className="text-lg font-semibold text-textStrong">Thesis V1 · 研究论点</h2><p className="mt-1 text-xs leading-5 text-textMuted">精确引用已验证主张；正式版本须本人确认。研究背景不参与验证，未知宏观关系不产生评分或行业方向。</p></div>
    <p className="text-sm" data-testid="thesis-counts">{runtime.bindings.length} candidates / {verifiable} verifiable / {claimError ? '读取失败' : currentChoices.length} verified / {loaded.error ? '读取失败' : rows.filter(row => row.current).length} formal Thesis</p>
    {!loaded.error && !rows.some(row => row.current) && <p className="text-warning">暂无正式 Thesis。{!choices.length && !claimError && '暂无可用 Verified Claim，正式确认已阻断；可以保留研究草稿。'}</p>}
    {(error || loaded.error || claimError || choiceError) && <div role="alert" className="text-sm text-warning">操作或读取已阻断，未自动修复。<AdvancedAuditDetails>{error || loaded.error || claimError || choiceError}</AdvancedAuditDetails></div>}
    <div className="flex flex-wrap gap-2"><button className="inbox-action" disabled={!!loaded.error} onClick={() => { setEditor(blank()); setPreview(null); }}>新建 Thesis 草稿</button><button className="inbox-action" onClick={() => { refresh(); setEditor(null); }}>重新载入 Thesis</button><button className="inbox-action" disabled={!!loaded.error} onClick={() => act(() => download(repository.export(loaded.data)))}>导出 Thesis JSON 备份</button><button className="inbox-action" disabled={loaded.recoveryStatus === 'unsupported_version' || loaded.recoveryStatus === 'unavailable'} onClick={() => setBackupOpen(!backupOpen)}>导入或恢复 Thesis 备份</button></div>
    {rows.map(row => <article key={row.entry.thesisId} className="min-w-0 space-y-3 rounded border border-borderSoft p-3">
      <h3 className="font-semibold">{row.current ? '当前正式 Thesis' : '尚无正式版本'}</h3>
      {!!row.supportUpdates.length && <p className="text-warning">支持主张已有后续版本/需复核；历史 Thesis 的精确引用保持不变。</p>}
      {row.current && <RevisionContent revision={row.current} runtime={runtime} onClaim={openClaim} />}
      {row.draft && <section aria-label="当前 Thesis 草稿"><h3 className="mb-2 font-semibold">当前草稿 · 未确认</h3><RevisionContent revision={row.draft} runtime={runtime} onClaim={openClaim} /><button className="inbox-action mt-2" disabled={!!loaded.error} onClick={() => act(() => { setPreview(repository.prepareConfirmation(loaded.data, row.draft!.revisionId)); setNote(''); })}>生成 Thesis 确认预览</button></section>}
      <button className="inbox-action" disabled={!!loaded.error} onClick={() => { const head = row.history[row.history.length - 1]; setEditor({ ...head, supersedes: head.revisionId, revisionId: crypto.randomUUID(), createdAt: new Date().toISOString(), asOf: new Date().toISOString(), reason: '' }); setPreview(null); }}>修订为新草稿</button>
      <details className="min-w-0" aria-label="Thesis revision history"><summary className="cursor-pointer text-sm">Thesis 版本历史与 diff（{row.history.length}）</summary>{row.history.map((revision, index) => <div key={revision.revisionId} className="my-3 min-w-0 space-y-2 border-t border-borderSoft pt-3">
        <h4 className="text-sm font-semibold">版本 {index + 1} · {revision.createdAt}</h4><p className="text-xs">{revision.reason} · {row.confirmations.some(c => c.revisionId === revision.revisionId) ? '已由本人确认' : '未确认草稿'}</p>
        <RevisionContent revision={revision} runtime={runtime} onClaim={openClaim} />
        {row.confirmations.filter(c => c.revisionId === revision.revisionId).map(c => <p key={c.confirmationId} className="text-xs">本人确认：{c.createdAt} · {c.note}</p>)}
        <details><summary className="text-xs">版本差异</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(thesisDiff(row.history[index - 1] ?? null, revision), null, 2)}</pre></details>
      </div>)}</details>
    </article>)}
    {preview && <section aria-label="Thesis 本人确认预览" className="space-y-3 rounded border border-borderSoft p-3"><h3 className="font-semibold">本人确认保存的精确版本</h3><p className="text-xs">以下为待确认原文；尚未保存的编辑不会进入正式版本。</p><RevisionContent revision={preview.revision} runtime={runtime} onClaim={openClaim} /><label className="block text-xs">本人确认说明<textarea aria-label="本人确认说明" className={field} value={note} onChange={e => setNote(e.target.value)} /></label><button className="inbox-action" disabled={!preview.publishable || !note.trim() || !!loaded.error} onClick={() => act(() => { repository.confirm(preview, note, true); refresh(); })}>本人确认正式 Thesis</button></section>}
    {editor && !loaded.error && <section aria-label="Thesis 草稿编辑" className="min-w-0 space-y-3 rounded border border-borderSoft p-3"><h3 className="font-semibold">编辑研究草稿</h3>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">{texts.map(([key, label]) => <label className="block min-w-0 text-xs" key={key}>{label}<textarea aria-label={label} className={field} value={editor[key]} onChange={e => edit(key, e.target.value)} /></label>)}{lists.map(([key, label]) => <label className="block min-w-0 text-xs" key={key}>{label}（每行一条）<textarea aria-label={label + '（每行一条）'} className={field} value={editor[key].join('\n')} onChange={e => edit(key, e.target.value.split('\n'))} /></label>)}</div>
      <label className="block text-xs">信心<select aria-label="信心" className={field} value={editor.confidence} onChange={e => edit('confidence', e.target.value as ThesisRevision['confidence'])}>{Object.entries(confidenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-xs">论点 asOf（ISO 时间）<input aria-label="论点 asOf（ISO 时间）" className={field} value={editor.asOf} onChange={e => edit('asOf', e.target.value)} /></label>
      <fieldset className="space-y-2"><legend className="text-sm">选择支持主张的精确版本</legend><p className="text-xs text-textMuted">仅列出论点 asOf 时仍为当前版本且已验证的主张。</p>{editor.supportingClaims.filter(ref => !choices.some(c => c.ref.revisionId === ref.revisionId)).map(ref => <p key={ref.revisionId} className="break-all text-xs text-warning">已保存引用在此 asOf 不可作为当前支持：{ref.revisionId}；不会自动替换。<button className="inbox-action" onClick={() => edit('supportingClaims', editor.supportingClaims.filter(r => r.revisionId !== ref.revisionId))}>从新草稿移除此主张</button></p>)}{choices.length ? choices.map(choice => <label className="block break-words text-xs" key={choice.ref.revisionId}><input type="checkbox" checked={editor.supportingClaims.some(ref => ref.revisionId === choice.ref.revisionId)} onChange={e => edit('supportingClaims', e.target.checked ? [...editor.supportingClaims, choice.ref] : editor.supportingClaims.filter(ref => ref.revisionId !== choice.ref.revisionId))} /> {choice.statement} · {choice.ref.revisionId}</label>) : <p className="text-xs text-warning">无可用已验证主张；背景链接不能解除阻断。</p>}</fieldset>
      <fieldset className="space-y-2"><legend className="text-sm">关联宏观 / 行业 / 公司</legend><div className="grid gap-2 md:grid-cols-3">{runtime.identities.map(option => <label key={identityKey(option.ref)} className="min-w-0 break-words text-xs"><input type="checkbox" checked={editor.relatedEntities.some(ref => identityKey(ref) === identityKey(option.ref))} onChange={e => edit('relatedEntities', e.target.checked ? [...editor.relatedEntities, option.ref] : editor.relatedEntities.filter(ref => identityKey(ref) !== identityKey(option.ref)))} /> {option.label} ({identityKey(option.ref)})</label>)}</div></fieldset>
      <fieldset className="space-y-2"><legend className="text-sm">Macro → Industry 关系</legend>
        {editor.macroIndustry.map(edge => <p key={edge.relationshipId} className="text-xs">{edge.macroDriver.id} → {edge.industry.id}：{edge.rationale} <button className="inbox-action" onClick={() => edit('macroIndustry', editor.macroIndustry.filter(e => e.relationshipId !== edge.relationshipId))}>从新草稿移除此关系</button></p>)}
        <label className="block text-xs">宏观驱动<select aria-label="宏观驱动" className={field} value={macroId} onChange={e => setMacroId(e.target.value)}><option value="">选择已有宏观身份</option>{runtime.identities.filter(o => o.ref.owner === 'MacroIndicator').map(o => <option key={o.ref.id} value={o.ref.id}>{o.label} · {o.ref.id}</option>)}</select></label>
        <label className="block text-xs">关联行业<select aria-label="关联行业" className={field} value={industryId} onChange={e => setIndustryId(e.target.value)}><option value="">选择已有行业身份</option>{runtime.identities.filter(o => o.ref.owner === 'Industry').map(o => <option key={o.ref.id} value={o.ref.id}>{o.label} · {o.ref.id}</option>)}</select></label>
        <label className="block text-xs">暴露类型<select aria-label="暴露类型" className={field} value={exposure} onChange={e => setExposure(e.target.value as typeof exposure)}><option value="unknown">未知</option><option value="direct">直接</option><option value="indirect">间接</option></select></label>
        <label className="block text-xs">敏感性<select aria-label="敏感性" className={field} value={sensitivity} onChange={e => setSensitivity(e.target.value as typeof sensitivity)}><option value="unknown">未知</option><option value="qualitative">仅定性</option></select></label>
        <label className="block text-xs">关系理由<textarea aria-label="关系理由" className={field} value={rationale} onChange={e => setRationale(e.target.value)} /></label><label className="block text-xs">关系成立条件（每行一条）<textarea aria-label="关系成立条件（每行一条）" className={field} value={conditions} onChange={e => setConditions(e.target.value)} /></label>
        <p className="text-xs text-textMuted">新关系沿用上方 asOf 与所选支持主张的精确版本；无支持时明确保留为未知。</p>
        <button className="inbox-action" disabled={!macroId || !industryId || !rationale.trim()} onClick={() => { edit('macroIndustry', [...editor.macroIndustry, { relationshipId: crypto.randomUUID(), macroDriver: { owner: 'MacroIndicator', id: macroId }, industry: { owner: 'Industry', id: industryId }, exposure, sensitivity, rationale, asOf: editor.asOf, conditions: conditions.split('\n').filter(Boolean), supportingClaims: [...editor.supportingClaims] }]); setRationale(''); setConditions(''); }}>添加结构化关系</button>
      </fieldset>
      <fieldset className="space-y-2"><legend className="text-sm">Research Context（非验证依据）</legend>{editor.contexts.map((context, i) => <p key={i} className="break-all text-xs">{context.title} · {context.url} <button className="inbox-action" onClick={() => edit('contexts', editor.contexts.filter((_, j) => i !== j))}>从新草稿移除背景</button></p>)}<label className="block text-xs">Thesis 背景标题<input aria-label="Thesis 背景标题" className={field} value={contextTitle} onChange={e => setContextTitle(e.target.value)} /></label><label className="block text-xs">Thesis 背景链接<input aria-label="Thesis 背景链接" className={field} value={contextUrl} onChange={e => setContextUrl(e.target.value)} /></label><button className="inbox-action" disabled={!contextTitle.trim() || !contextUrl.trim()} onClick={() => { edit('contexts', [...editor.contexts, { kind: 'web', title: contextTitle, url: contextUrl }]); setContextTitle(''); setContextUrl(''); }}>添加研究背景</button></fieldset>
      <label className="block text-xs">Thesis 修订说明<textarea aria-label="Thesis 修订说明" className={field} value={editor.reason} onChange={e => edit('reason', e.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><button className="inbox-action" disabled={!editor.statement.trim() || !editor.reason.trim()} onClick={() => act(() => { repository.saveDraft(loaded.data, { ...editor, createdAt: new Date().toISOString(), ...Object.fromEntries(lists.map(([key]) => [key, editor[key].map(s => s.trim()).filter(Boolean)])) }); refresh(); setEditor(null); })}>保存 Thesis 草稿</button><button className="inbox-action" onClick={() => setEditor(null)}>取消编辑</button></div>
    </section>}
    {backupOpen && <section className="space-y-2"><label className="block text-xs">Thesis 备份 JSON<textarea aria-label="Thesis 备份 JSON" rows={5} className={field} value={raw} onChange={e => { setRaw(e.target.value); setImportReady(false); }} /></label><button className="inbox-action" onClick={() => act(() => { if (loaded.recoveryStatus === 'corrupt') repository.previewRecovery(raw, loaded.corruptedRaw!); else repository.previewImport(raw, loaded.data); setImportReady(true); })}>校验 Thesis 备份并预览</button>{importReady && <><p className="text-xs">已校验历史与原始主张。写入前保存当前原字节备份，不替换已有历史。</p><button className="inbox-action" onClick={() => act(() => { if (loaded.recoveryStatus === 'corrupt') repository.recoverCorrupt(raw, loaded.corruptedRaw!, true); else repository.import(loaded.data, raw, true); refresh(); setEditor(null); setImportReady(false); setBackupOpen(false); })}>备份当前字节并确认导入 Thesis</button></>}</section>}
    {pinnedClaim && <Modal title="Thesis 支持主张精确版本" description="仅显示本 Thesis 固定引用的原始主张版本与审核记录，不替换为较新主张。" onClose={() => setPinnedClaim(null)}>
      <div className="space-y-3 break-words text-sm"><p>{pinnedClaim.revision.statement}</p><p>主张版本：{pinnedClaim.revision.revisionId} · asOf：{pinnedClaim.revision.asOf}</p><p>审核记录：{pinnedClaim.review.reviewId} · {pinnedClaim.review.decision} · {pinnedClaim.review.createdAt}</p><p>审核说明：{pinnedClaim.review.note}</p><p>当前原始证据门禁：{previewClaim(pinnedClaim.revision, runtime.claimOwners).verifiable ? '支持' : '阻断'}</p>
        <button className="inbox-action" onClick={() => act(() => { const source = runtime.owners.claims(); const revision = source.data.revisions.find(r => r.revisionId === pinnedClaim.ref.revisionId); const review = source.data.reviews.find(r => r.reviewId === pinnedClaim.ref.reviewId); if (!revision || !review || canonicalJson(revision) !== pinnedClaim.ref.revisionBytes || canonicalJson(review) !== pinnedClaim.ref.reviewBytes) throw new Error('THESIS_CLAIM_EXACT_REF_UNAVAILABLE'); const evidence = runtime.evidence(revision.binding); if (!evidence) throw new Error('THESIS_EVIDENCE_UNAVAILABLE'); setAudit(evidence); })}>查看原始证据</button>
        <button className="inbox-action" onClick={() => setClaimBinding(pinnedClaim.revision.binding)}>管理 Claim 当前状态与全部历史（独立于此引用）</button>
        <AdvancedAuditDetails><pre className="whitespace-pre-wrap break-all">{JSON.stringify(pinnedClaim, null, 2)}</pre></AdvancedAuditDetails>
      </div>
    </Modal>}
    {claimBinding && <ClaimVerificationModal binding={claimBinding} owners={runtime.claimOwners} repository={runtime.claimRepository} onClose={() => { setClaimBinding(null); refresh(); }} onEvidence={() => act(() => { const evidence = runtime.evidence(claimBinding); if (!evidence) throw new Error('THESIS_EVIDENCE_UNAVAILABLE'); setAudit(evidence); })} />}
    {audit && <EvidenceDrawer audit={audit} onClose={() => setAudit(null)} />}
  </section>;
}
