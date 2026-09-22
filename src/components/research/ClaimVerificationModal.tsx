import { useState } from 'react';
import type { ClaimBinding, ClaimOwners, ClaimPreview, ResearchContext } from '../../types/verifiedClaim';
import { BrowserClaimRepository, type ClaimLoad, type ClaimImportPreview } from '../../services/verifiedClaimRepository';
import { claimIdentity, claimReadModel, draftClaim, previewClaim } from '../../services/verifiedClaim';
import { statusDisplayLabel } from '../../utils/displayLabels';
import { Modal } from '../common/Modal';
import { AdvancedAuditDetails } from '../common/AdvancedAuditDetails';

const field = 'w-full rounded border border-borderSoft bg-panel2 p-2 text-sm text-textStrong';
const stateLabels: Record<string, string> = { DRAFT: '草稿', VERIFIED: '已验证', REJECTED: '已拒绝', BLOCKED: '证据已不可用' };
function download(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'verified-claims-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ClaimVerificationModal({ binding, owners, repository, onEvidence, onClose }: {
  binding: ClaimBinding; owners: ClaimOwners; repository: BrowserClaimRepository; onEvidence: () => void; onClose: () => void;
}) {
  const [loaded, setLoaded] = useState<ClaimLoad>(() => repository.load());
  const [error, setError] = useState<string | null>(loaded.error);
  const [preview, setPreview] = useState<ClaimPreview | null>(null);
  const [note, setNote] = useState(''), [contextTitle, setContextTitle] = useState(''), [contextUrl, setContextUrl] = useState('');
  const [contextKind, setContextKind] = useState<ResearchContext['kind']>('web');
  const [backupOpen, setBackupOpen] = useState(false), [raw, setRaw] = useState(''), [importPreview, setImportPreview] = useState<ClaimImportPreview | null>(null);
  const [cutoff, setCutoff] = useState('');
  const model = claimReadModel(loaded.data, owners, new Date().toISOString()).find(row => row.entry.claimId === claimIdentity(binding));
  const current = model?.revision;
  const visibleHistory = model?.history.filter(r => !cutoff || Date.parse(r.createdAt) <= Date.parse(cutoff)) ?? [];
  const liveDraft = draftClaim(binding, owners, { revisionId: 'preview-only', createdAt: new Date().toISOString(), asOf: new Date().toISOString(), supersedes: current?.revisionId ?? null, reason: '预览', contexts: [] });
  const gate = preview ?? previewClaim(current ?? liveDraft, owners);
  const act = (action: () => void) => { try { action(); setError(null); } catch (cause) { setError(String(cause)); } };
  const saved = () => { setLoaded(repository.load()); setPreview(null); };
  return <Modal title="主张验证与历史" description="逐版本核对原始候选与证据。固定模板 / AI 来源会永久保留；用户确认不能覆盖证据阻断。" onClose={onClose} error={error}>
    <div className="space-y-4">
      <p className="text-sm leading-6 text-textStrong">{gate.revision.statement}</p>
      <p className="text-sm text-textMuted">当前主张：{model ? stateLabels[model.status] : '尚未保存草稿'} · {gate.revision.generation === 'TEMPLATE' ? '固定模板生成' : gate.revision.generation === 'AI' ? 'AI 草稿' : '用户判断'}</p>
      <button className="inbox-action" onClick={onEvidence}>查看原始证据</button>
      <section aria-label="主张证据门禁" className="rounded border border-borderSoft p-3">
        <p className="text-sm">证据门禁：{gate.verifiable ? '支持，可提交本人确认' : '阻断，不可确认为已验证'}</p>
        <ul className="mt-2 text-xs text-warning">{gate.blockers.filter(b => ['partial','stale','unknown','not_admitted','conflicted','missing_evidence'].includes(b)).map(b => <li key={b}>{statusDisplayLabel(b)}</li>)}</ul>
        <AdvancedAuditDetails><pre className="whitespace-pre-wrap break-all">{JSON.stringify({ binding: gate.revision.binding, assessment: gate.assessment, blockers: gate.blockers }, null, 2)}</pre></AdvancedAuditDetails>
      </section>
      {!loaded.error && <>
        <fieldset className="space-y-2"><legend className="text-sm">研究背景引用（可选，不参与证据验证）</legend>
          <label className="block text-xs">背景类型<select className={field} value={contextKind} onChange={e => setContextKind(e.target.value as ResearchContext['kind'])}><option value="web">网页</option><option value="notion">Notion</option><option value="drive">Drive</option><option value="report">研报</option></select></label>
          <label className="block text-xs">背景标题<input className={field} value={contextTitle} onChange={e => setContextTitle(e.target.value)} /></label>
          <label className="block text-xs">背景链接<input className={field} type="url" value={contextUrl} onChange={e => setContextUrl(e.target.value)} /></label>
        </fieldset>
        <label className="block text-xs">修订或审核说明<textarea className={field} value={note} onChange={e => setNote(e.target.value)} /></label>
        <button className="inbox-action" disabled={!note.trim()} onClick={() => act(() => {
          const now = new Date().toISOString();
          repository.saveDraft(loaded.data, draftClaim(binding, owners, { revisionId: crypto.randomUUID(), createdAt: now, asOf: now,
            supersedes: current?.revisionId ?? null, reason: note, contexts: contextTitle || contextUrl ? [{ kind: contextKind, title: contextTitle, url: contextUrl }] : current?.contexts ?? [] })); saved();
        })}>{current ? '保存新草稿版本' : '保存候选草稿'}</button>
        {current && !model?.reviews.some(r => r.revisionId === current.revisionId) && <button className="inbox-action ml-2" onClick={() => act(() => setPreview(repository.prepareReview(loaded.data, current.revisionId)))}>生成验证预览</button>}
        {preview && <section aria-label="本人确认预览" className="space-y-2 rounded border border-borderSoft p-3">
          <p className="text-sm">将确认上方保存版本的原文及其证据，不包含尚未保存的背景或说明修改。</p>
          <button className="inbox-action" disabled={!preview.verifiable || !note.trim()} onClick={() => act(() => { repository.confirmReview(preview, 'VERIFIED', note, true); saved(); })}>本人确认已验证</button>
          <button className="inbox-action ml-2" disabled={!note.trim()} onClick={() => act(() => { repository.confirmReview(preview, 'REJECTED', note, true); saved(); })}>本人确认拒绝</button>
        </section>}
      </>}
      <section aria-label="主张版本历史" className="space-y-2"><h3 className="text-sm font-semibold">版本与验证历史</h3>
        <label className="block text-xs">历史截止时间<input type="datetime-local" className={field} value={cutoff} onChange={e => setCutoff(e.target.value)} /></label>
        {!visibleHistory.length && <p className="text-xs text-textMuted">该时点尚无保存版本。</p>}
        {visibleHistory.map((revision, index) => <div key={revision.revisionId} className="space-y-1 border-t border-borderSoft pt-2 text-xs">
          <p>版本 {index + 1} · {revision.createdAt} · {revision.reason}</p><p>{revision.statement}</p>
          <p>{revision.origin === 'ai_draft' ? 'AI / 模板草稿来源' : '用户判断来源'}</p>
          {revision.contexts.map((context, i) => <p key={i}>研究背景：<a href={context.url} target="_blank" rel="noreferrer">{context.title}</a>（非验证依据）</p>)}
          {model?.reviews.filter(r => r.revisionId === revision.revisionId && (!cutoff || Date.parse(r.createdAt) <= Date.parse(cutoff))).map(review => <p key={review.reviewId}>{stateLabels[review.decision]} · {review.createdAt} · {review.note}</p>)}
        </div>)}
      </section>
      <div className="flex flex-wrap gap-2"><button className="inbox-action" disabled={!!loaded.error} onClick={() => act(() => download(repository.export(loaded.data)))}>导出主张 JSON 备份</button>
        <button className="inbox-action" disabled={loaded.recoveryStatus === 'unsupported_version' || loaded.recoveryStatus === 'unavailable'} onClick={() => setBackupOpen(!backupOpen)}>导入或恢复主张备份</button>
        <button className="inbox-action" onClick={() => { saved(); setError(null); }}>重新载入</button></div>
      {backupOpen && <section className="space-y-2"><label className="block text-xs">主张备份 JSON<textarea rows={5} className={field} value={raw} onChange={e => { setRaw(e.target.value); setImportPreview(null); }} /></label>
        <button className="inbox-action" onClick={() => act(() => setImportPreview(loaded.recoveryStatus === 'corrupt' ? repository.previewRecovery(raw, loaded.corruptedRaw!) : repository.previewImport(raw, loaded.data)))}>校验备份并预览</button>
        {importPreview && <><p className="text-xs">追加 {importPreview.addCount} 条，跳过 {importPreview.skipCount} 条；写入前保留当前原字节备份。</p><button className="inbox-action" onClick={() => act(() => {
          if (loaded.recoveryStatus === 'corrupt') repository.recoverCorrupt(raw, loaded.corruptedRaw!, true); else repository.import(loaded.data, raw, true);
          saved(); setImportPreview(null); setBackupOpen(false);
        })}>备份当前字节并确认导入</button></>}
      </section>}
    </div>
  </Modal>;
}
