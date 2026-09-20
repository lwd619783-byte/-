import { KnowledgeDocument } from './KnowledgeDocument';
import { useEffect, useMemo, useState } from 'react';
import type { WikiData, WikiOwners, WikiRevision, WikiReview } from '../../types/wiki';
import type { ResearchSourceAdapter, ResearchSourceRef, ResearchExtractionRef } from '../../types/researchExtraction';
import { WIKI_TYPES } from '../../types/wiki';
import { createBrowserCreatorViewpointRepository, type CreatorViewpointRepository } from '../../services/creatorViewpointRepository';
import { createCreatorResearchAdapter } from '../../services/creatorResearchAdapter';
import { BrowserWikiRepository, type WikiRepository, type WikiAdditions } from '../../services/wikiRepository';
import { createWikiOwners, type WikiEvidenceOption } from '../../services/wikiOwners';
import { loadIndustryMetrics, type IndustryProviderState } from '../../services/industryMetricProvider';
import { buildWikiReadModel, searchWiki, wikiRevisionStatus } from '../../services/wiki';
import { renderWikiVault, inspectWikiVault, type WikiVault } from '../../services/wikiProjection';
import { zip } from '../../utils/zip';
import { isPreciseInstant } from '../../utils/dateTime';
import { EvidenceDrawer } from '../research/EvidenceDrawer';
import type { CreatorEvidenceSelection } from '../creator/CreatorEvidence';
import type { ChartAuditView } from '../../services/chartAudit';
import { Modal } from '../common/Modal';
import { WikiRevisionForm, wikiInputClass, wikiTypeLabels } from './WikiRevisionForm';
import { WikiBackupModal, downloadWikiFile } from './WikiBackupModal';

export type WikiLibraryProps = { active?: boolean; repository?: WikiRepository; owners?: WikiOwners; creatorRepository?: CreatorViewpointRepository; evidenceOptions?: WikiEvidenceOption[]; onMaterial?: (ref: ResearchSourceRef | ResearchExtractionRef) => void; materialLabel?: (ref: ResearchSourceRef | ResearchExtractionRef) => string };
const messages = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);
export function WikiLibrary(props: WikiLibraryProps) {
  const creatorRepository = useMemo(() => props.creatorRepository ?? createBrowserCreatorViewpointRepository(), [props.creatorRepository]);
  const [industry, setIndustry] = useState<IndustryProviderState | null>(null);
  useEffect(() => { if (props.owners) return; let active = true; void loadIndustryMetrics().then(state => { if (active) setIndustry(state); }); return () => { active = false; }; }, [props.owners]);
  const defaultOwners = useMemo(() => createWikiOwners(creatorRepository, industry?.status === 'available' ? industry.provider : undefined), [creatorRepository, industry]);
  const owners = props.owners ?? defaultOwners;
  const repository = useMemo(() => {
    if (props.repository) return props.repository;
    let storage: Storage | null = null; try { storage = window.localStorage; } catch { /* repository reports unavailable */ }
    return new BrowserWikiRepository(storage, owners);
  }, [props.repository, owners]);
  const [loaded, setLoaded] = useState(() => repository.load());
  const [now, setNow] = useState(() => new Date().toISOString());
  const [asOfInput, setAsOfInput] = useState(''), [asOf, setAsOf] = useState('');
  const view = 'Wiki';
  const [showDrafts, setShowDrafts] = useState(false);
  const [selectedId, setSelectedId] = useState(''), [query, setQuery] = useState(''), [type, setType] = useState('');
  const [message, setMessage] = useState<string | null>(null), [form, setForm] = useState<{ previous?: WikiRevision } | null>(null);
  const [review, setReview] = useState<{ revision: WikiRevision; decision: WikiReview['decision'] } | null>(null), [reviewNote, setReviewNote] = useState('');
  const [backup, setBackup] = useState(false), [vault, setVault] = useState<WikiVault | null>(null), [projection, setProjection] = useState('尚未生成'), [busy, setBusy] = useState(false);
  const [creatorEvidence, setCreatorEvidence] = useState<CreatorEvidenceSelection | null>(null), [audit, setAudit] = useState<ChartAuditView | null>(null);
  const cutoff = asOf || now, data = loaded.data;
  const reload = () => { setLoaded(repository.load()); setNow(new Date().toISOString()); setVault(null); setProjection('需重新生成导出文件'); };
  useEffect(() => { if (props.active === false) return; setLoaded(repository.load()); setNow(new Date().toISOString()); setVault(null); setProjection('需重新生成导出文件'); }, [repository, props.active]);
  useEffect(() => { const changed = () => reload(); window.addEventListener('storage', changed); return () => { window.removeEventListener('storage', changed); }; }, [repository]);
  const read = useMemo(() => {
    try { if (loaded.error) throw new Error(loaded.error); return { model: buildWikiReadModel(data, owners, cutoff), error: null }; }
    catch (cause) { return { model: null, error: messages(cause) }; }
  }, [data, loaded.error, owners, cutoff]);
  const sourceRead = useMemo((): { adapter: ResearchSourceAdapter | null; error: string | null } => { try { return { adapter: owners.research(cutoff), error: null }; } catch (cause) { return { adapter: null, error: messages(cause) }; } }, [owners, cutoff, data]);
  const evidenceOptions = useMemo(() => props.evidenceOptions ?? defaultOwners.listEvidence(cutoff), [props.evidenceOptions, defaultOwners, cutoff]);
  const currentPages = read.model ? searchWiki(read.model, query, type) : [];
  const visibleEntries = data.entries.filter(entry => Date.parse(entry.createdAt) <= Date.parse(cutoff) && (!type || entry.type === type));
  const entries = !showDrafts || query.trim() ? currentPages.map(page => page.entry) : visibleEntries.sort((a, b) => a.wikiId < b.wikiId ? -1 : 1);
  const selected = entries.find(entry => entry.wikiId === selectedId) ?? entries[0];
  const history = data.revisions.filter(row => row.wikiId === selected?.wikiId && Date.parse(row.createdAt) <= Date.parse(cutoff)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || (a.revisionId < b.revisionId ? -1 : 1));
  const page = read.model?.pages.find(row => row.entry.wikiId === selected?.wikiId);
  const last = history.find(row => !history.some(other => other.supersedes === row.revisionId));
  const blocked = !!loaded.error || !!asOf;
  const saved = (next: WikiData) => { setLoaded({ data: next, error: null, corruptedRaw: null, recoveryStatus: null }); setNow(new Date().toISOString()); setVault(null); setProjection('文章已更新，需重新生成'); };
  const append = (additions: WikiAdditions) => {
    if (blocked) throw new Error('历史视图或锁定存储不能写入');
    saved(repository.append(data, additions));
    if (additions.revisions?.length) { setShowDrafts(true); setSelectedId(additions.revisions[0].wikiId); setQuery(''); setType(''); }
  };
  const act = (action: () => void) => { try { action(); setMessage(null); } catch (cause) { setMessage(messages(cause)); } };
  const openMaterial = (ref: ResearchSourceRef | ResearchExtractionRef, at = cutoff) => act(() => {
    if (ref.sourceDomain === 'browser-source') { if (!props.onMaterial) throw new Error('资料查看暂不可用'); props.onMaterial(ref); return; }
    const owner = creatorRepository.load(); if (owner.error) throw new Error(owner.error);
    const adapter = createCreatorResearchAdapter(owner.data, at);
    if ('sourceId' in ref) { const trace = adapter.traceSource(ref); setCreatorEvidence({ data: owner.data, source: trace.source, asOf: at }); }
    else { const trace = adapter.traceExtraction(ref); setCreatorEvidence({ data: owner.data, observation: trace.observation, source: trace.source, asOf: at }); }
  });
  const generate = async () => {
    setBusy(true); try { const result = await renderWikiVault(data, owners, cutoff); setVault(result); setProjection(`已生成 ${result.manifest.pages.length} 页 · 截至 ${cutoff}`);
      downloadWikiFile(zip(Object.entries(result.files).map(([name, content]) => ({ name, content }))), 'research-wiki.zip', 'application/zip'); setMessage(null);
    } catch (cause) { setMessage(messages(cause)); } finally { setBusy(false); }
  };
  const inspect = async (files: FileList | null) => {
    if (!files) return; setBusy(true);
    try {
      const expected = vault ?? await renderWikiVault(data, owners, cutoff); const actual: Record<string, string> = {};
      if ([...files].reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) throw new Error('校验目录超过 20 MiB；请分开保存个人附件');
      for (const file of files) {
        const path = file.webkitRelativePath;
        if (!path.startsWith('research-wiki/')) throw new Error('请选择解压后的 research-wiki 目录');
        if (path.includes('/.obsidian/')) continue;
        actual[path] = await file.text();
      }
      const result = await inspectWikiVault(expected, actual);
      setProjection(`${result.status} · 缺失 ${result.missing.length} / 改动 ${result.changed.length} / 额外 ${result.unexpected.length}；仅比较文件，未写回`);
    } catch (cause) { setMessage(messages(cause)); } finally { setBusy(false); }
  };

  return <section aria-label="知识库文章区" className="space-y-4 min-w-0">
    <details className="rounded border border-borderSoft bg-bg2 p-3"><summary className="min-h-11 cursor-pointer font-semibold">更多操作</summary><div className="flex flex-wrap gap-2"><button className="inbox-action" onClick={() => act(reload)}>刷新历史</button><button className="inbox-action" disabled={blocked} onClick={() => setForm({})}>手工新建文章</button><button className="inbox-action" onClick={() => setShowDrafts(!showDrafts)}>{showDrafts ? '只看已审核文章' : '查看手工草稿与归档'}</button></div>
      <label className="mt-3 block text-sm">历史查询时间（含时区，留空为当前）<input className={wikiInputClass} value={asOfInput} onChange={event => setAsOfInput(event.target.value)} /></label><button className="inbox-action mt-2" onClick={() => act(() => { if (asOfInput && !isPreciseInstant(asOfInput)) throw new Error('请使用含时区的完整时间'); setAsOf(asOfInput); setVault(null); })}>应用时间视图</button></details>
    {asOf && <p role="status" className="text-sm text-warning">历史只读视图 · {asOf}</p>}
    {(message || read.error) && <div role="alert" className="rounded border border-danger/40 p-3 text-sm text-danger break-words">{message ?? read.error}。引用或存储未通过核验时，当前文章与导出保持关闭。</div>}
    {sourceRead.error && <p role="status" className="text-xs text-warning break-words">原始资料暂不可用：{sourceRead.error}</p>}
    {view === 'Wiki' && <>
      <div className="grid gap-3 md:grid-cols-[1fr_15rem]"><label className="text-xs text-textMuted break-words">搜索知识库<input className={`${wikiInputClass} mt-1`} value={query} onChange={event => setQuery(event.target.value)} placeholder="标题、摘要、别名、标签、正文与关联" /></label><label className="text-xs text-textMuted break-words">类型筛选<select className={`${wikiInputClass} mt-1`} value={type} onChange={event => setType(event.target.value)}><option value="">全部类型</option>{WIKI_TYPES.map(value => <option key={value} value={value}>{wikiTypeLabels[value]}</option>)}</select></label></div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[15rem_minmax(0,1fr)]"><aside aria-label="文章列表" className="space-y-2">{entries.map(entry => { const current = read.model?.pages.find(row => row.entry.wikiId === entry.wikiId); return <button key={entry.wikiId} aria-pressed={selected?.wikiId === entry.wikiId} className={`w-full rounded border p-3 text-left ${selected?.wikiId === entry.wikiId ? 'border-cyan bg-cyan/5' : 'border-borderSoft bg-bg2'}`} onClick={() => setSelectedId(entry.wikiId)}><span className="block break-words font-semibold">{current?.revision.title ?? data.revisions.find(row => row.wikiId === entry.wikiId && Date.parse(row.createdAt) <= Date.parse(cutoff))?.title ?? entry.wikiId}</span><span className="mt-1 block text-xs text-textMuted">{wikiTypeLabels[entry.type]} · {current ? '已审核' : '尚未审核'}</span></button>; })}</aside>
        <article aria-label="文章详情" className="min-w-0 rounded-lg border border-borderSoft bg-bg2 p-4">{selected ? <>
          <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-semibold break-words">{page?.revision.title ?? last?.title ?? selected.wikiId}</h3><p className="mt-1 text-xs text-textMuted">{wikiTypeLabels[selected.type]}</p><details><summary className="text-xs text-textMuted">审计详情</summary><p className="break-all text-xs">wikiId · {selected.wikiId}</p></details></div><button className="inbox-action !whitespace-normal max-w-full" disabled={blocked || !last} onClick={() => setForm({ previous: last })}>追加修订</button></div>
          {page ? <div className="mt-4 space-y-4"><p className="text-sm text-cyan">当前已审核文章 · {page.origin === 'ai_draft' ? 'AI 整理，人工审核' : '用户整理'}</p><p className="text-xs text-warning">来源与结论仍需持续核验，审核不代表事实已证实。</p><details><summary className="text-xs text-textMuted">审计详情</summary><p className="text-xs break-all">{page.revision.revisionId} · {page.revision.asOf} · {page.completeness} · {page.origin} · {page.uncertainty.join(' / ')}</p></details><p className="whitespace-pre-wrap break-words text-sm">{page.revision.summary}</p><KnowledgeDocument text={page.revision.bodyMarkdown} />
            <section><h4 className="font-semibold">证据与来源</h4><div className="mt-2 flex flex-col items-start gap-2">{page.revision.sourceRefs.map(ref => <button key={ref.sourceId} className="inbox-action !whitespace-normal max-w-full break-all text-left" onClick={() => openMaterial(ref, page.revision.asOf)}>原始资料 · {props.materialLabel?.(ref) ?? '已保存原文'}</button>)}{page.revision.extractionRefs.map(ref => <button key={ref.extractionId} className="inbox-action !whitespace-normal max-w-full break-all text-left" onClick={() => openMaterial(ref, page.revision.asOf)}>提取内容 · {props.materialLabel?.(ref) ?? '已保存研究记录'}</button>)}{page.revision.evidenceRefs.map(ref => <button key={JSON.stringify(ref)} className="inbox-action !whitespace-normal max-w-full break-all text-left" onClick={() => act(() => setAudit(owners.evidence(ref, page.revision.asOf).audit))}>证据 · {ref.objectId}</button>)}</div></section>
            <section><h4 className="font-semibold">关联文章与引用关系</h4><div className="mt-2 flex flex-wrap gap-2">{page.revision.wikiRefs.map(ref => <button className="inbox-action !whitespace-normal max-w-full" key={`out-${ref.wikiId}`} onClick={() => { setQuery(''); setType(''); setSelectedId(ref.wikiId); }}>关联 · {read.model?.pages.find(row => row.entry.wikiId === ref.wikiId)?.revision.title}</button>)}{page.backlinks.map(id => <button className="inbox-action !whitespace-normal max-w-full" key={`in-${id}`} onClick={() => { setQuery(''); setType(''); setSelectedId(id); }}>反向引用 · {read.model?.pages.find(row => row.entry.wikiId === id)?.revision.title}</button>)}</div>{page.orphan && <p className="mt-2 text-xs text-textMuted">暂无关联文章。支持材料仍可单独反查。</p>}</section>
          </div> : <p className="mt-4 text-sm text-warning">尚未审核 Revision。草稿、拒绝或归档记录保留在下方历史。</p>}
          <section className="mt-5 border-t border-borderSoft pt-4"><h4 className="font-semibold">时间与版本演化</h4>{history.map(revision => { const status = wikiRevisionStatus(data, revision.revisionId, cutoff); return <details key={revision.revisionId} className="mt-2 rounded border border-borderSoft p-3"><summary className="min-h-11 cursor-pointer break-words text-sm">{revision.title} · {{ draft: '待审核', reviewed: '已审核', rejected: '已拒绝', archived: '已归档' }[status]} · {revision.authorType === 'ai' ? 'AI 整理' : '用户整理'} · {revision.createdAt}</summary><p className="mt-2 text-xs text-textMuted break-all">版本标识：{revision.revisionId}</p><p className="mt-2 text-sm">{revision.revisionReason}</p><p className="mt-2 text-xs text-textMuted break-words">截至 {revision.asOf} · {revision.summary}</p><p className="mt-2 text-sm whitespace-pre-wrap break-words">{revision.bodyMarkdown}</p><div className="mt-2 flex flex-wrap gap-2">{revision.sourceRefs.map(ref => <button key={ref.sourceId} className="inbox-action !whitespace-normal max-w-full break-all text-left" onClick={() => openMaterial(ref, revision.asOf)}>来源 · {props.materialLabel?.(ref) ?? '已保存原文'}</button>)}{revision.extractionRefs.map(ref => <button key={ref.extractionId} className="inbox-action !whitespace-normal max-w-full break-all text-left" onClick={() => openMaterial(ref, revision.asOf)}>提取 · {props.materialLabel?.(ref) ?? '已保存研究记录'}</button>)}{revision.evidenceRefs.map(ref => <button key={JSON.stringify(ref)} className="inbox-action !whitespace-normal max-w-full break-all text-left" onClick={() => act(() => setAudit(owners.evidence(ref, revision.asOf).audit))}>证据 · {ref.objectId}</button>)}</div><div className="mt-2 flex flex-wrap gap-2">{status === 'draft' && (['reviewed', 'rejected'] as const).map(decision => <button key={decision} className="inbox-action !whitespace-normal max-w-full" disabled={blocked} onClick={() => { setReview({ revision, decision }); setReviewNote(''); }}>{decision === 'reviewed' ? '审核此修订' : '拒绝此修订'}</button>)}{status === 'reviewed' && <button className="inbox-action !whitespace-normal max-w-full" disabled={blocked} onClick={() => { setReview({ revision, decision: 'archived' }); setReviewNote(''); }}>归档此修订</button>}</div>{data.reviews.filter(row => row.revisionId === revision.revisionId && Date.parse(row.createdAt) <= Date.parse(cutoff)).map(row => <p key={row.reviewId} className="mt-2 break-all text-xs text-textMuted">{{ reviewed: '已审核', rejected: '已拒绝', archived: '已归档' }[row.decision]} · {row.createdAt} · {row.note}</p>)}</details>; })}</section>
        </> : <div className="py-6"><h3 className="text-lg font-semibold">从可反查的材料建立研究记忆</h3><p className="mt-2 text-sm text-textMuted">先添加原始资料，再导入 AI 整理建议；审核通过后，完整文章会出现在这里。</p></div>}</article>
      </div>
    </>}
    <section aria-label="文章导出与备份" className="rounded border border-borderSoft bg-bg2 p-4"><h3 className="font-semibold">导出到 Obsidian</h3><p className="mt-2 break-words text-xs text-textMuted" role="status">{projection}</p><p className="mt-2 text-xs text-textMuted">解压 research-wiki.zip 后，可将 research-wiki 文件夹作为知识库打开。生成文件按只读视图使用；外部编辑只可校验或重新生成。</p><div className="mt-3 flex flex-wrap gap-2"><button className="inbox-action !whitespace-normal max-w-full" disabled={!!read.error || busy} onClick={() => void generate()}>导出到 Obsidian</button><label className="inbox-action !whitespace-normal max-w-full cursor-pointer">校验已导出的目录<input aria-label="校验 Markdown 目录" type="file" multiple {...{ webkitdirectory: '' }} className="sr-only" disabled={busy || !!read.error} onChange={event => void inspect(event.target.files)} /></label><button className="inbox-action !whitespace-normal max-w-full" disabled={!!loaded.error} onClick={() => act(() => downloadWikiFile(repository.export(data), 'wiki-full-backup.json', 'application/json'))}>备份全部文章历史</button><button className="inbox-action !whitespace-normal max-w-full" disabled={!!asOf || (loaded.recoveryStatus !== null && loaded.recoveryStatus !== 'corrupt')} onClick={() => setBackup(true)}>{loaded.recoveryStatus === 'corrupt' ? '恢复文章存储' : '导入文章备份'}</button>{loaded.corruptedRaw !== null && <button className="inbox-action !whitespace-normal max-w-full" onClick={() => downloadWikiFile(loaded.corruptedRaw!, 'wiki-locked-raw.txt', 'text/plain')}>导出锁定原字节</button>}</div></section>
    {form && <WikiRevisionForm data={data} previous={form.previous} adapter={sourceRead.adapter} evidenceOptions={evidenceOptions} onSave={append} onClose={() => setForm(null)} />}
    {review && <Modal title="确认文章审核" onClose={() => setReview(null)} error={message}><p className="text-sm">{review.revision.title}。此操作保留审核历史；只确认整理质量，不代表事实已证实。原作者来源保持不变。</p><label className="mt-4 block text-sm">审核说明<textarea className={`${wikiInputClass} mt-1`} value={reviewNote} onChange={event => setReviewNote(event.target.value)} /></label><button className="inbox-action !whitespace-normal max-w-full mt-3" disabled={!reviewNote.trim()} onClick={() => act(() => { const reviewId = `review-${crypto.randomUUID()}`; append({ reviews: [{ schemaVersion: 'wiki-review.v1', reviewId, wikiId: review.revision.wikiId, revisionId: review.revision.revisionId, decision: review.decision, reviewerType: 'user', approvalRef: { owner: 'WikiReview', approvalId: reviewId }, createdAt: new Date().toISOString(), note: reviewNote.trim(), supersedes: review.decision === 'archived' ? data.reviews.find(row => row.revisionId === review.revision.revisionId && row.decision === 'reviewed')!.reviewId : null }] }); setReview(null); })}>确认追加审核记录</button></Modal>}
    {backup && <WikiBackupModal repository={repository} data={data} corruptedRaw={loaded.recoveryStatus === 'corrupt' ? loaded.corruptedRaw! : undefined} onSaved={saved} onClose={() => setBackup(false)} />}
    {creatorEvidence && <EvidenceDrawer creatorEvidence={creatorEvidence} onClose={() => setCreatorEvidence(null)} />}
    {audit && <EvidenceDrawer audit={audit} onClose={() => setAudit(null)} />}
  </section>;
}
