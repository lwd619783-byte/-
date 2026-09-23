import { useState } from 'react';
import { canonicalJson } from '../../../shared/canonical-json.mjs';
import type { ExpressionRevision, ExpressionPreview } from '../../types/investmentExpression';
import type { ExpressionWorkspaceRuntime } from '../../services/expressionWorkspace';
import { expressionContextFields, expressionDiff, expressionReadModel, expressionThesisChoices, expressionTrace, previewExpression } from '../../services/investmentExpression';
import type { ChartAuditView } from '../../services/chartAudit';
import { EvidenceDrawer } from './EvidenceDrawer';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';
import { Modal } from '../common/Modal';

const field = 'w-full min-w-0 rounded border border-borderSoft bg-panel2 p-2 text-sm text-textStrong';
const labels = { directness: '直接性理由', correlation: '相关性理由', liquidity: '流动性背景', valuation: '估值背景', sensitivity: '论点敏感性', idiosyncraticRisk: '个体风险' };
const roles = { direct: '直接表达', leader: '龙头表达', high_beta: '高弹性表达', defensive: '防御表达', unknown: '未知' };
function blank(scope: ExpressionRevision['scope']): ExpressionRevision {
  const now = new Date().toISOString(), unknown = () => ({ status: 'unknown' as const, rationale: '未知：尚无可引用的正式数据或研究判断。' });
  return { expressionId: crypto.randomUUID(), revisionId: crypto.randomUUID(), supersedes: null, createdAt: now, asOf: now, scope, origin: 'user_judgement', thesis: null, instrument: null, role: 'unknown',
    directness: unknown(), correlation: unknown(), liquidity: unknown(), valuation: unknown(), sensitivity: unknown(), idiosyncraticRisk: unknown(), contexts: [], reason: '' };
}
function Content({ revision, runtime, onTrace }: { revision: ExpressionRevision; runtime: ExpressionWorkspaceRuntime; onTrace: (r: ExpressionRevision) => void }) {
  const gate = previewExpression(revision, runtime.owners), option = runtime.instruments.find(o => canonicalJson(o.ref) === canonicalJson(revision.instrument));
  return <div className="min-w-0 space-y-2 break-words text-sm">
    <p><strong>{option?.label ?? '标的身份未解析'}</strong> · {revision.instrument?.type ?? '未选择类别'} · {roles[revision.role]}</p>
    <p>来源：{revision.origin === 'ai_draft' ? 'AI 草稿（来源永久保留）' : '用户研究判断'} · asOf：{revision.asOf}</p>
    {expressionContextFields.map(k => <p key={k}><strong>{labels[k]}：</strong>{revision[k].status === 'unknown' ? '未知' : '研究判断'} · {revision[k].rationale}</p>)}
    <p className={gate.publishable ? 'text-textMuted' : 'text-warning'}>正式确认资格：{gate.publishable ? '可供本人确认' : '阻断'}。未知项：{gate.unknowns.map(k => k === 'role' ? '表达角色' : labels[k as keyof typeof labels]).join('、') || '无'}。</p>
    {!revision.thesis && <p className="text-warning">缺少正式 Thesis 的精确版本；研究背景不能解除阻断。</p>}
    {gate.blockers.includes('EXPRESSION_THESIS_SUPERSEDED_ASOF') && <p className="text-warning">基础 Thesis 在此 asOf 已有后续版本，正式确认已阻断。</p>}
    {revision.thesis && <button className="inbox-action" onClick={() => onTrace(revision)}>Expression → Thesis → Claim → Evidence</button>}
    {!!revision.contexts.length && <p>Research Context（仅背景）：{revision.contexts.map(c => c.title).join('；')}</p>}
    <AdvancedAuditDetails><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify({ revisionId: revision.revisionId, instrument: revision.instrument, thesis: revision.thesis, blockers: gate.blockers }, null, 2)}</pre></AdvancedAuditDetails>
  </div>;
}
export function ExpressionWorkspacePanel({ runtime }: { runtime: ExpressionWorkspaceRuntime }) {
  const { repository } = runtime;
  const [loaded, setLoaded] = useState(() => repository.load()), [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ExpressionRevision | null>(null), [preview, setPreview] = useState<ExpressionPreview | null>(null), [note, setNote] = useState('');
  const [trace, setTrace] = useState<ReturnType<typeof expressionTrace> | null>(null), [audit, setAudit] = useState<ChartAuditView | null>(null);
  const [backupOpen, setBackupOpen] = useState(false), [raw, setRaw] = useState(''), [importReady, setImportReady] = useState(false);
  const now = new Date().toISOString(), rows = expressionReadModel(loaded.data, runtime.owners, now);
  let choiceError: string | null = null, choices: ReturnType<typeof expressionThesisChoices> = [];
  try { choices = expressionThesisChoices(runtime.owners, editor?.asOf ?? now); } catch (e) { choiceError = String(e); }
  const act = (f: () => void) => { try { f(); setError(null); } catch (e) { setError(String(e)); } };
  const refresh = () => { setLoaded(repository.load()); setPreview(null); setTrace(null); };
  const edit = <K extends keyof ExpressionRevision>(k: K, value: ExpressionRevision[K]) => { setEditor(old => old ? { ...old, [k]: value } : null); setPreview(null); };
  const onTrace = (r: ExpressionRevision) => act(() => setTrace(expressionTrace(r, runtime.owners)));
  return <section aria-label="Investment Expression V1" className="mb-5 min-w-0 space-y-4 rounded-lg border border-borderSoft bg-panel p-4">
    <h2 className="text-lg font-semibold text-textStrong">Investment Expression V1 · 投资表达</h2>
    <p className="text-xs leading-5 text-textMuted">Context / Sources → Claim → Thesis → Expression。表达如何承载论点；定性理由保留研究判断与未知状态，正式版本须本人确认。</p>
    <p data-testid="expression-counts" className="text-sm">{loaded.error ? '读取失败' : rows.filter(r => r.current).length} formal Expression</p>
    {!loaded.error && !rows.some(r => r.current) && <p className="text-warning">暂无正式 Expression。</p>}
    <p className="text-xs text-textMuted">ETF / Index / Fund / Commodity proxy 仅在已有正式 owner 可精确解析时可选；真实端无 owner 时保持空。外部知识仅作 Research Context。</p>
    {(error || loaded.error || choiceError) && <div role="alert" className="text-warning">读取或操作已阻断，未自动修复。<AdvancedAuditDetails>{error || loaded.error || choiceError}</AdvancedAuditDetails></div>}
    <div className="flex flex-wrap gap-2">
      <button className="inbox-action" disabled={!!loaded.error} onClick={() => { setEditor(blank(runtime.owners.scope)); setPreview(null); }}>新建 Expression 草稿</button>
      <button className="inbox-action" onClick={() => { refresh(); setEditor(null); }}>重新载入 Expression</button>
      <button className="inbox-action" disabled={!!loaded.error} onClick={() => act(() => { const url = URL.createObjectURL(new Blob([repository.export(loaded.data)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'investment-expression-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })}>导出 Expression JSON 备份</button>
      <button className="inbox-action" disabled={loaded.recoveryStatus === 'unsupported_version' || loaded.recoveryStatus === 'unavailable'} onClick={() => setBackupOpen(!backupOpen)}>导入或恢复 Expression 备份</button>
    </div>
    {rows.map(row => <article key={row.entry.expressionId} className="min-w-0 space-y-3 rounded border border-borderSoft p-3">
      <h3 className="font-semibold">{row.current ? '当前正式 Expression' : '尚无正式版本'}</h3>
      {row.thesisUpdated && <p className="text-warning">基础 Thesis 已有新版本 / 需复核；历史精确引用保持不变。</p>}
      {row.current && <Content revision={row.current} runtime={runtime} onTrace={onTrace} />}
      {row.draft && <section aria-label="当前 Expression 草稿" className="space-y-2"><h4>草稿 · 未确认</h4><Content revision={row.draft} runtime={runtime} onTrace={onTrace} /><button className="inbox-action" onClick={() => act(() => { setPreview(repository.prepareConfirmation(loaded.data, row.draft!.revisionId)); setNote(''); })}>生成 Expression 确认预览</button></section>}
      <button className="inbox-action" disabled={!!loaded.error} onClick={() => { const head = row.history.at(-1)!; setEditor({ ...head, revisionId: crypto.randomUUID(), supersedes: head.revisionId, createdAt: now, asOf: now, reason: '' }); setPreview(null); }}>修订 Expression 为新草稿</button>
      <details aria-label="Expression revision history"><summary>Expression 版本历史与 diff（{row.history.length}）</summary>{row.history.map((r, i) => <div className="my-3 min-w-0 space-y-2 border-t border-borderSoft pt-3" key={r.revisionId}>
        <h4>版本 {i + 1} · {r.createdAt}</h4><p className="text-xs">{r.reason} · {row.confirmations.some(c => c.revisionId === r.revisionId) ? '已由本人确认' : '未确认草稿'}</p><Content revision={r} runtime={runtime} onTrace={onTrace} />
        {row.confirmations.filter(c => c.revisionId === r.revisionId).map(c => <p className="text-xs" key={c.confirmationId}>本人确认：{c.createdAt} · {c.note}</p>)}
        <details><summary>Expression 版本差异</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(expressionDiff(row.history[i - 1] ?? null, r), null, 2)}</pre></details>
      </div>)}</details>
    </article>)}
    {preview && <section aria-label="Expression 本人确认预览" className="space-y-3 rounded border border-borderSoft p-3"><h3>本人确认保存的精确版本</h3><Content revision={preview.revision} runtime={runtime} onTrace={onTrace} /><label className="block text-xs">Expression 本人确认说明<textarea aria-label="Expression 本人确认说明" className={field} value={note} onChange={e => setNote(e.target.value)} /></label><button className="inbox-action" disabled={!preview.publishable || !note.trim() || !!loaded.error} onClick={() => act(() => { repository.confirm(preview, note, true); refresh(); })}>本人确认正式 Expression</button></section>}
    {editor && !loaded.error && <section aria-label="Expression 草稿编辑" className="min-w-0 space-y-3 rounded border border-borderSoft p-3">
      <label className="block text-xs">Expression asOf（ISO 时间）<input aria-label="Expression asOf（ISO 时间）" className={field} value={editor.asOf} onChange={e => edit('asOf', e.target.value)} /></label>
      <label className="block text-xs">正式 Thesis 精确版本<select aria-label="正式 Thesis 精确版本" className={field} value={editor.thesis?.revisionId ?? ''} onChange={e => edit('thesis', choices.find(c => c.ref.revisionId === e.target.value)?.ref ?? null)}><option value="">选择正式版本</option>{editor.thesis && !choices.some(c => c.ref.revisionId === editor.thesis!.revisionId) && <option value={editor.thesis.revisionId}>已存引用不可用 · {editor.thesis.revisionId}</option>}{choices.map(c => <option value={c.ref.revisionId} key={c.ref.revisionId}>{c.statement} · {c.ref.revisionId}</option>)}</select></label>
      {!choices.length && <p className="text-warning">无可用 formal Thesis；正式确认已阻断，可以保留草稿。</p>}
      <label className="block text-xs">投资标的<select aria-label="投资标的" className={field} value={editor.instrument ? canonicalJson(editor.instrument) : ''} onChange={e => edit('instrument', runtime.instruments.find(o => canonicalJson(o.ref) === e.target.value)?.ref ?? null)}><option value="">选择已有精确身份</option>{editor.instrument && !runtime.instruments.some(o => canonicalJson(o.ref) === canonicalJson(editor.instrument)) && <option value={canonicalJson(editor.instrument)}>已存身份不可解析</option>}{runtime.instruments.map((o, i) => <option key={i} value={canonicalJson(o.ref)}>{o.label} · {o.ref.type} · {o.ref.owner}:{o.ref.id}</option>)}</select></label>
      <label className="block text-xs">表达角色<select aria-label="表达角色" className={field} value={editor.role} onChange={e => edit('role', e.target.value as ExpressionRevision['role'])}>{Object.entries(roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <div className="grid min-w-0 gap-3 md:grid-cols-2">{expressionContextFields.map(k => <fieldset key={k} className="min-w-0 space-y-2"><legend className="text-sm">{labels[k]}</legend><select aria-label={labels[k] + '状态'} className={field} value={editor[k].status} onChange={e => edit(k, { ...editor[k], status: e.target.value as 'unknown' | 'research_judgement' })}><option value="unknown">未知</option><option value="research_judgement">研究判断（非 Provider Fact）</option></select><textarea aria-label={labels[k]} className={field} value={editor[k].rationale} onChange={e => edit(k, { ...editor[k], rationale: e.target.value })} /></fieldset>)}</div>
      <label className="block text-xs">Expression 修订说明<textarea aria-label="Expression 修订说明" className={field} value={editor.reason} onChange={e => edit('reason', e.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><button className="inbox-action" disabled={!editor.reason.trim()} onClick={() => act(() => { repository.saveDraft(loaded.data, { ...editor, createdAt: new Date().toISOString() }); refresh(); setEditor(null); })}>保存 Expression 草稿</button><button className="inbox-action" onClick={() => setEditor(null)}>取消 Expression 编辑</button></div>
    </section>}
    {backupOpen && <section className="space-y-2"><label className="block text-xs">Expression 备份 JSON<textarea aria-label="Expression 备份 JSON" className={field} rows={5} value={raw} onChange={e => { setRaw(e.target.value); setImportReady(false); }} /></label><button className="inbox-action" onClick={() => act(() => { if (loaded.recoveryStatus === 'corrupt') repository.previewRecovery(raw, loaded.corruptedRaw!); else repository.previewImport(raw, loaded.data); setImportReady(true); })}>校验 Expression 备份并预览</button>{importReady && <><p className="text-xs">已校验原始 Thesis / Claim / Evidence。确认后先备份当前原字节，再追加导入。</p><button className="inbox-action" onClick={() => act(() => { if (loaded.recoveryStatus === 'corrupt') repository.recoverCorrupt(raw, loaded.corruptedRaw!, true); else repository.import(loaded.data, raw, true); refresh(); setImportReady(false); setBackupOpen(false); })}>备份当前字节并确认导入 Expression</button></>}</section>}
    {trace && <Modal title="Expression 精确引用链" description="原始 owner 的精确历史版本；背景材料不参与验证。" onClose={() => setTrace(null)}><div className="space-y-3 break-words text-sm">
      <p className="break-all">Expression {trace.revisionId} → Thesis {trace.thesisRef?.revisionId}</p><p>{trace.gate.thesis?.statement ?? '原始 Thesis 不可用'}</p><p>Thesis 本人确认：{trace.gate.confirmation?.note ?? '不可用'}</p>
      {trace.claims.map(c => <section key={c.ref.revisionId} className="space-y-2 border-t border-borderSoft pt-2"><p className="break-all">Claim {c.ref.revisionId} · {c.review?.decision ?? '不可用'}</p><p>{c.revision?.statement}</p><p>原始支持：{c.usable ? '可用' : '阻断'}</p><button className="inbox-action" disabled={!c.evidenceBinding} onClick={() => act(() => { const fresh = expressionTrace(trace.gate.revision, runtime.owners); const claim = fresh.claims.find(row => row.ref.revisionId === c.ref.revisionId); if (!claim?.usable || !claim.evidenceBinding) throw Error('EXPRESSION_TRACE_ORIGINAL_OWNER_UNAVAILABLE'); const evidence = runtime.thesisRuntime.evidence(claim.evidenceBinding); if (!evidence) throw Error('EXPRESSION_EVIDENCE_UNAVAILABLE'); setAudit(evidence); })}>查看 Expression 原始 Evidence</button></section>)}
      <AdvancedAuditDetails><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(trace, null, 2)}</pre></AdvancedAuditDetails>
    </div></Modal>}
    {audit && <EvidenceDrawer audit={audit} onClose={() => setAudit(null)} />}
  </section>;
}
