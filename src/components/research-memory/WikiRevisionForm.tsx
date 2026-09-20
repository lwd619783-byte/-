import { useState, type FormEvent } from 'react';
import type { ResearchSourceAdapter } from '../../types/researchExtraction';
import { WIKI_TYPES, type WikiData, type WikiRevision, type WikiType } from '../../types/wiki';
import type { WikiAdditions } from '../../services/wikiRepository';
import type { WikiEvidenceOption } from '../../services/wikiOwners';
import { emptyWikiRelatedRefs } from '../../services/wiki';
import { Modal } from '../common/Modal';
import { FormField } from '../common/FormField';
import { canonicalJson } from '../../../shared/canonical-json.mjs';

export const wikiInputClass = 'min-h-11 w-full rounded border border-borderSoft bg-bg2 px-3 py-2 text-sm text-textStrong';
export const wikiTypeLabels: Record<WikiType, string> = { ENTITY: '实体', CONCEPT: '概念', FRAMEWORK: '框架', TOPIC: '主题', CREATOR_FRAMEWORK: '作者研究框架', INDUSTRY_KNOWLEDGE: '行业知识', MACRO_KNOWLEDGE: '宏观知识', RESEARCH_CONVENTION: '研究约定' };
export function WikiRevisionForm({ data, previous, adapter, evidenceOptions, onSave, onClose }: { data: WikiData; previous?: WikiRevision; adapter: ResearchSourceAdapter | null; evidenceOptions: WikiEvidenceOption[]; onSave: (additions: WikiAdditions) => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null), [dirty, setDirty] = useState(false);
  const close = () => { if (!dirty || window.confirm('有未保存的 文章草稿，确认丢弃？')) onClose(); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const text = (key: string) => String(fields.get(key) ?? '').trim();
    const selected = (key: string) => fields.getAll(key).map(String);
    const now = new Date().toISOString(), wikiId = previous?.wikiId ?? `wiki-${crypto.randomUUID()}`, revisionId = `revision-${crypto.randomUUID()}`;
    const sourceIds = selected('sources'), extractionIds = selected('extractions'), evidenceIds = selected('evidence');
    try {
      const revision: WikiRevision = { schemaVersion: 'wiki-revision.v1', wikiId, revisionId, title: text('title'), summary: text('summary'), bodyMarkdown: text('body'),
        sourceRefs: (adapter?.listSources() ?? []).filter(row => sourceIds.includes(row.ref.sourceId)).map(row => row.ref),
        extractionRefs: (adapter?.listExtractions() ?? []).filter(row => extractionIds.includes(row.ref.extractionId)).map(row => row.ref),
        evidenceRefs: evidenceOptions.filter((_, index) => evidenceIds.includes(String(index))).map(row => row.ref),
        wikiRefs: selected('wikiRefs').map(id => ({ wikiId: id })), relatedRefs: previous?.relatedRefs ?? emptyWikiRelatedRefs(),
        tags: [...new Set(text('tags').split(',').map(s => s.trim()).filter(Boolean))], aliases: [...new Set(text('aliases').split(',').map(s => s.trim()).filter(Boolean))],
        authorType: text('author') as 'user' | 'ai', createdAt: now, asOf: now, supersedes: previous?.revisionId ?? null, revisionReason: text('reason') };
      onSave({ ...(!previous ? { entries: [{ schemaVersion: 'wiki-entry.v1' as const, wikiId, type: text('type') as WikiType, createdAt: now }] } : {}), revisions: [revision] }); onClose();
    } catch (cause) { setError(String(cause)); }
  };
  return <Modal title={previous ? '修订文章' : '新建 文章草稿'} onClose={close} onDiscard={onClose} hasUnsavedChanges={dirty} error={error}>
    <form onSubmit={submit} onChange={() => setDirty(true)} className="space-y-4">
      <p className="text-sm text-textMuted">保存后进入待审核。人工审核只确认研究记忆的整理质量，AI 来源会永久保留。</p>
      <div className="grid gap-3 md:grid-cols-2"><FormField label="文章标题"><input name="title" required defaultValue={previous?.title} className={wikiInputClass} /></FormField>
        <FormField label="条目类型"><select name="type" disabled={!!previous} defaultValue={previous ? data.entries.find(row => row.wikiId === previous.wikiId)!.type : 'CONCEPT'} className={wikiInputClass}>{WIKI_TYPES.map(type => <option key={type} value={type}>{wikiTypeLabels[type]}</option>)}</select></FormField></div>
      <FormField label="摘要"><textarea name="summary" defaultValue={previous?.summary} className={wikiInputClass} /></FormField>
      <FormField label="完整正文"><textarea name="body" required rows={7} defaultValue={previous?.bodyMarkdown} className={wikiInputClass} /></FormField>
      <div className="grid gap-3 md:grid-cols-2"><FormField label="标签（逗号分隔）"><input name="tags" defaultValue={previous?.tags.join(', ')} className={wikiInputClass} /></FormField><FormField label="别名（逗号分隔）"><input name="aliases" defaultValue={previous?.aliases.join(', ')} className={wikiInputClass} /></FormField></div>
      <FormField label="作者来源"><select name="author" defaultValue={previous?.authorType ?? 'user'} className={wikiInputClass}><option value="user">用户整理</option><option value="ai">AI 整理 · 审核后仍保留 AI 来源</option></select></FormField>
      <FormField label="修订原因"><input name="reason" required defaultValue={previous ? '' : '初始整理'} className={wikiInputClass} /></FormField>
      <details open><summary className="min-h-11 font-semibold">支持材料与正式关联</summary><p className="mb-3 text-xs text-textMuted">审核前至少引用一条 原始资料、提取内容或证据。仅选择已保存且可核验的记录。</p>
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="min-w-0"><legend className="font-semibold">原始资料</legend><div className="max-h-44 overflow-auto">{(adapter?.listSources() ?? []).map(source => <label key={source.ref.sourceId} className="flex min-h-11 items-center gap-2 break-all text-xs"><input type="checkbox" name="sources" value={source.ref.sourceId} defaultChecked={previous?.sourceRefs.some(ref => ref.sourceId === source.ref.sourceId)} />资料 {source.ref.sourceId.slice(-8)} · 待核验</label>)}</div></fieldset>
          <fieldset className="min-w-0"><legend className="font-semibold">提取内容</legend><div className="max-h-44 overflow-auto">{(adapter?.listExtractions() ?? []).map(extraction => <label key={extraction.ref.extractionId} className="flex min-h-11 items-center gap-2 break-all text-xs"><input type="checkbox" name="extractions" value={extraction.ref.extractionId} defaultChecked={previous?.extractionRefs.some(ref => ref.extractionId === extraction.ref.extractionId)} />{extraction.findings.map(f => 'summary' in f ? f.summary : 'statement' in f ? f.statement : '关联内容').join('；')} · {extraction.review.status === 'reviewed' ? '已审核' : '待核验'}</label>)}</div></fieldset>
          <fieldset className="min-w-0"><legend className="font-semibold">证据</legend><div className="max-h-44 overflow-auto">{evidenceOptions.map((evidence, index) => <label key={canonicalJson(evidence.ref)} className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" name="evidence" value={index} defaultChecked={previous?.evidenceRefs.some(ref => canonicalJson(ref) === canonicalJson(evidence.ref))} />{evidence.label}</label>)}</div></fieldset>
          <fieldset className="min-w-0"><legend className="font-semibold">关联文章</legend>{data.entries.filter(row => row.wikiId !== previous?.wikiId).map(row => <label key={row.wikiId} className="flex min-h-11 items-center gap-2 break-all text-xs"><input type="checkbox" name="wikiRefs" value={row.wikiId} defaultChecked={previous?.wikiRefs.some(ref => ref.wikiId === row.wikiId)} />{data.revisions.find(revision => revision.wikiId === row.wikiId)?.title ?? row.wikiId}</label>)}</fieldset>
        </div></details>
      <button type="submit" className="inbox-action">保存文章草稿</button>
    </form>
  </Modal>;
}
