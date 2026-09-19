import { useMemo, useState } from 'react';
import type { CreatorViewpointData, ViewpointCurrent, ViewpointObservation } from '../../types/creatorViewpoint';
import { buildCreatorCurrentViews, buildViewpointTimeline, buildViewpointReviews, observationStatus, sourceCoverage, visibleViewpointObservations } from '../../services/creatorViewpoint';
import { createBrowserCreatorViewpointRepository, type CreatorViewpointRepository } from '../../services/creatorViewpointRepository';
import { exportCreatorViewpointExcel } from '../../services/creatorViewpointExport';
import { EvidenceDrawer } from '../research/EvidenceDrawer';
import { Modal } from '../common/Modal';
import { CreatorEntryForm, type EntryRequest } from './CreatorEntryForm';
import { relationLabels, sourceLabels, stanceLabels, type CreatorEvidenceSelection } from './CreatorEvidence';

type View = 'overview' | 'timeline' | 'events' | 'comparison';
const viewLabels: Record<View, string> = { overview: '博主概览', timeline: '观点时间轴', events: '事件对照', comparison: '博主比较' };
const selectClass = 'min-h-11 w-full rounded border border-borderSoft bg-bg2 px-3 py-2 text-sm text-textStrong';
const stateFields = { stance: '立场', conditional: '条件性', horizon: '周期', trigger: 'Trigger', confirmation: 'Confirmation', invalidation: 'Invalidation' } as const;
function stateChanges(previous: ViewpointObservation, next: ViewpointObservation) {
  return (Object.keys(stateFields) as (keyof typeof stateFields)[]).filter(key => previous[key] !== next[key]).map(key => `${stateFields[key]}：${previous[key] ?? 'unknown'} → ${next[key] ?? 'unknown'}`).join('；');
}
function download(content: string | Uint8Array, name: string, type: string) {
  const bytes = typeof content === 'string' ? content : new Uint8Array(content).buffer;
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CreatorViewpointWorkspace({ repository: providedRepository, readOnly = false }: { repository?: CreatorViewpointRepository; readOnly?: boolean }) {
  const repository = useMemo(() => providedRepository ?? createBrowserCreatorViewpointRepository(), [providedRepository]);
  const loaded = useMemo(() => repository.load(), [repository]);
  const [data, setData] = useState(loaded.data);
  const [message, setMessage] = useState<string | null>(loaded.error);
  const [view, setView] = useState<View>('overview');
  const [creatorId, setCreatorId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [eventId, setEventId] = useState('');
  const [asOfInput, setAsOfInput] = useState('');
  const [entry, setEntry] = useState<EntryRequest | null>(null);
  const [evidence, setEvidence] = useState<Omit<CreatorEvidenceSelection, 'data'> | null>(null);
  const [importRaw, setImportRaw] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ReturnType<typeof repository.previewImport> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const asOfValid = !asOfInput || Number.isFinite(new Date(asOfInput).getTime());
  const asOf = asOfInput ? asOfValid ? new Date(asOfInput).toISOString() : '1970-01-01T00:00:00.000Z' : undefined;
  const current = useMemo(() => buildCreatorCurrentViews(data, asOf), [data, asOf]);
  const transitions = useMemo(() => buildViewpointTimeline(data, asOf), [data, asOf]);
  const observations = useMemo(() => visibleViewpointObservations(data, asOf), [data, asOf]);
  const reviews = useMemo(() => buildViewpointReviews(data, asOf), [data, asOf]);
  const creators = data.creators.filter(item => !asOf || new Date(item.recordedAt).getTime() <= new Date(asOf).getTime());
  const topics = data.topics.filter(item => !asOf || new Date(item.recordedAt).getTime() <= new Date(asOf).getTime());
  const events = data.events.filter(item => !asOf || (new Date(item.recordedAt).getTime() <= new Date(asOf).getTime() && (!item.publishedAt || new Date(item.publishedAt).getTime() <= new Date(asOf).getTime())));
  const selectedCreator = creators.find(item => item.id === creatorId) ?? creators[0];
  const selectedTopic = topics.find(item => item.id === topicId) ?? topics[0];
  const selectedEvent = events.find(item => item.id === eventId) ?? events[0];
  const blocked = !!loaded.error || readOnly;
  const append = (additions: Partial<CreatorViewpointData>) => {
    if (blocked) throw new Error('存储读取失败，已禁止写入。请先导出原始数据并核对。');
    setData(repository.append(data, additions)); setMessage('已追加保存；原历史保留。');
  };
  const action = (run: () => void) => { try { run(); } catch (failure) { setMessage(failure instanceof Error ? failure.message : String(failure)); } };
  const confirmImport = () => {
    if (importRaw === null || !importPreview || blocked) return;
    try {
      download(repository.export(data), 'creator-viewpoints-pre-restore.json', 'application/json');
      setData(repository.import(data, importRaw, true)); setImportRaw(null); setImportError(null);
      setMessage('JSON 恢复完成；原历史与恢复前备份均保留。');
    } catch (error) { setImportError(error instanceof Error ? error.message : String(error)); }
  };
  const openObservation = (observation: ViewpointObservation) => setEvidence({ observation, asOf });
  const pendingForState = (state: ViewpointCurrent) => reviews.filter(review => review.result?.status !== 'completed' && observations.some(observation => observation.id === review.observationId && observation.creatorId === state.creatorId && observation.topicId === state.topicId));
  const stateCard = (state: ViewpointCurrent | undefined) => state ? <>
    <p className="mt-2 font-semibold text-cyan">{stanceLabels[state.observation.stance]} · {state.observation.conditional === 'yes' ? '条件性判断' : state.observation.conditional === 'no' ? '非条件性判断' : '条件性 unknown'}</p>
    <button type="button" className="mt-2 text-left text-sm underline decoration-borderSoft underline-offset-4" onClick={() => openObservation(state.observation)}>{state.observation.summary}</button>
    <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-xs text-textMuted">核心理由</dt><dd className="whitespace-pre-wrap break-words">{state.observation.reasoning ?? 'unknown'}</dd></div><div><dt className="text-xs text-textMuted">Trigger / Confirmation</dt><dd className="whitespace-pre-wrap break-words">{state.observation.trigger ?? 'unknown'} / {state.observation.confirmation ?? 'unknown'}</dd></div><div><dt className="text-xs text-textMuted">Invalidation</dt><dd className="whitespace-pre-wrap break-words">{state.observation.invalidation ?? 'unknown'}</dd></div></dl>
    <p className="mt-3 text-xs text-textMuted">审核更新 {state.reviewedAt}<br />来源 / 评论覆盖 {state.coverage}</p>
    <p className="mt-2 text-xs text-textMuted">最近变化：{state.lastTransition ? `${state.lastTransition.previous ? `${stanceLabels[state.lastTransition.previous.stance]} → ${stanceLabels[state.lastTransition.next.stance]}` : '首次建立状态'} · ${state.lastTransition.recordedAt}` : '无状态变化'}</p>
    <p className="mt-2 text-xs text-warning">待复盘 {pendingForState(state).map(item => `T+${item.offsetDays}${item.result?.status === 'inconclusive' ? '（待继续核验）' : ''}`).join(' / ') || '无'} · 包含该主题历史观点</p>
  </> : <p className="mt-3 text-sm text-textMuted">尚无已审核观点 · unknown</p>;
  const observationCard = (observation: ViewpointObservation) => {
    const source = data.sources.find(item => item.id === observation.sourceId)!;
    const status = observationStatus(data, observation.id, asOf);
    const transition = transitions.find(item => item.next.id === observation.id);
    const superseded = observations.some(item => item.supersedesId === observation.id && observationStatus(data, item.id, asOf) === 'reviewed');
    return <article className="rounded border border-borderSoft bg-bg1 p-4" key={observation.id}>
      <div className="flex flex-wrap items-start justify-between gap-2"><p className="text-xs text-textMuted">{data.creators.find(item => item.id === observation.creatorId)?.name} / {data.topics.find(item => item.id === observation.topicId)?.name}<br />记录 {observation.recordedAt}</p><span className="text-xs text-warning">{status}{superseded ? ' · 已有后续修订，原历史保留' : ''}</span></div>
      <div className="mt-3 space-y-3 border-l-2 border-borderSoft pl-3">
        <div><p className="text-xs text-textMuted">01 外部事件</p>{observation.eventLinks.length ? observation.eventLinks.map(link => <p key={link.eventId} className="mt-1 text-sm"><button type="button" className="text-cyan underline" onClick={() => setEvidence({ event: data.events.find(item => item.id === link.eventId), asOf })}>{data.events.find(item => item.id === link.eventId)?.title}</button> · {relationLabels[link.relation]}<span className="block text-textMuted">{link.explanation ?? '关系依据 unknown'}</span></p>) : <p className="text-sm text-textMuted">unknown · 无已记录关联</p>}</div>
        <div><p className="text-xs text-textMuted">02 原始来源</p><button type="button" className="text-left text-sm text-cyan underline" onClick={() => setEvidence({ source, asOf })}>{sourceLabels[source.kind]} · {source.publishedAtLabel ?? source.publishedAt ?? '发布时间 unknown'}</button><p className="text-xs text-warning">来源 / 评论覆盖 {sourceCoverage(data, source.id)} · 身份 {source.authorIdentity}</p></div>
        <div><p className="text-xs text-textMuted">03 观点 · {stanceLabels[observation.stance]}</p><button className="text-left font-medium" type="button" onClick={() => openObservation(observation)}>{observation.summary}</button><p className="mt-1 whitespace-pre-wrap break-words text-sm text-textMuted">理由：{observation.reasoning ?? 'unknown'}</p></div>
        <div><p className="text-xs text-textMuted">04 状态历史</p><p className="text-sm">{transition ? `${transition.previous ? `${stanceLabels[transition.previous.stance]} → ${stanceLabels[transition.next.stance]}` : '首次建立状态'} · 审核 ${transition.recordedAt}` : status === 'draft' ? 'Draft · 不改变正式 Current View' : status === 'rejected' ? '记录已拒绝 · 不改变 Current View' : '状态未改变 · 新增观点记录'}</p>{transition?.previous && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-cyan">{stateChanges(transition.previous, transition.next)}</p>}{observation.supersedesId && <p className="text-xs text-warning">追加修订 · {observation.revisionReason ?? 'unknown'}</p>}</div>
        <div><p className="text-xs text-textMuted">05 待验证条件</p><p className="whitespace-pre-wrap break-words text-sm">Trigger：{observation.trigger ?? 'unknown'}<br />Confirmation：{observation.confirmation ?? 'unknown'}<br />Invalidation：{observation.invalidation ?? 'unknown'}</p></div>
        <div><p className="text-xs text-textMuted">06 后续 Review · 日历日</p>{reviews.filter(item => item.observationId === observation.id).map(item => <div key={item.offsetDays} className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span>T+{item.offsetDays} · {item.dueAt.slice(0, 10)} · {item.result?.status === 'inconclusive' ? 'inconclusive · 待继续核验' : item.result?.status ?? 'pending'}</span>{item.result && <button type="button" className="inbox-action" onClick={() => setEvidence({ observation, review: item.result!, asOf })}>复盘证据</button>}<button type="button" className="inbox-action" disabled={blocked || !!asOf} onClick={() => setEntry({ kind: 'review', observation, due: item })}>{item.result ? '追加复盘修订' : '填写复盘'}</button></div>)}{!reviews.some(item => item.observationId === observation.id) && <p className="text-sm text-textMuted">审核后的重要观点提供 T+5 / T+20 / T+60 复盘</p>}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="inbox-action" onClick={() => openObservation(observation)}>打开证据</button>{status === 'draft' && <button type="button" className="inbox-action" disabled={blocked || !!asOf} onClick={() => setEntry({ kind: 'approval', observation })}>审核记录</button>}<button type="button" className="inbox-action" disabled={blocked || !!asOf} onClick={() => setEntry({ kind: 'observation', observation })}>追加修订</button></div>
    </article>;
  };
  return <section className="min-w-0 space-y-4 text-textStrong" aria-label="观点追踪工作区">
    <header className="rounded border border-borderSoft bg-bg1 p-4"><p className="text-xs uppercase tracking-wider text-cyan">External Commentary / Creator Viewpoint</p><h1 className="mt-1 text-xl font-semibold">观点追踪</h1><p className="mt-2 text-sm text-textMuted">按博主与主题追踪观点演化。Current View 由已审核历史派生；来源缺失、条件未知和部分评论覆盖均保留。</p><p className="mt-2 text-xs text-warning">观点审核不代表事实核验。复盘采用 calendar days（日历日），不是交易日。不生成赢家排名或正式 Thesis。</p></header>
    {message && <p role={blocked ? 'alert' : 'status'} className="whitespace-pre-wrap break-words rounded border border-warning/40 p-3 text-sm text-warning">{message}</p>}
    {!asOfValid && <p role="alert" className="text-sm text-danger">As-of 时间无效，未展示当前观点；请修正或回到当前。</p>}
    {loaded.error && <div className="rounded border border-danger p-3 text-sm text-danger">存储失败：已禁止新增、审核和导入，原始存储未覆盖。{loaded.corruptedRaw && <button type="button" className="inbox-action ml-2" onClick={() => download(loaded.corruptedRaw!, 'creator-viewpoints-corrupted.txt', 'text/plain')}>导出损坏原文</button>}</div>}
    <div className="flex flex-wrap gap-2">{(['creator', 'topic', 'source', 'event', 'observation'] as const).map((kind, index) => <button key={kind} type="button" className="inbox-action" disabled={blocked || !!asOf} onClick={() => setEntry({ kind })}>{['新增博主', '新增主题', '新增来源', '新增外部事件', '记录观点'][index]}</button>)}<button type="button" className="inbox-action" disabled={blocked} onClick={() => action(() => download(repository.export(data), 'creator-viewpoints-backup.json', 'application/json'))}>JSON 完整备份</button><button type="button" className="inbox-action" disabled={blocked} onClick={() => { setImportRaw(''); setImportPreview(null); setImportError(null); }}>恢复 JSON</button><button type="button" className="inbox-action" disabled={blocked} onClick={() => action(() => download(exportCreatorViewpointExcel(data, asOf), 'creator-viewpoints.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))}>Excel 分析副本</button></div>
    <div className="grid gap-3 rounded border border-borderSoft p-3 md:grid-cols-3"><label className="text-xs text-textMuted">As-of 本地时间（按记录 / 审核可得时点）<input aria-label="As-of 本地时间（按记录 / 审核可得时点）" className={selectClass} type="datetime-local" value={asOfInput} onChange={event => setAsOfInput(event.target.value)} /></label><div className="self-end text-xs text-textMuted">{asOf ? `截止 ${asOf}；历史视图只读` : '当前视图 · 未审核 Draft 不改变正式状态'}</div><button type="button" className="inbox-action self-end" onClick={() => setAsOfInput('')}>回到当前</button></div>
    <nav className="flex flex-wrap gap-2" aria-label="观点追踪视图">{(Object.entries(viewLabels) as [View, string][]).map(([id, label]) => <button key={id} type="button" className="inbox-action" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}</nav>
    {!creators.length && <div className="rounded border border-dashed border-borderSoft p-5 text-sm leading-7 text-textMuted"><h2 className="font-semibold text-textStrong">从一个可信来源开始</h2><p>先新增博主，再录入原帖、评论或本人回复；同一来源可拆成多个主题。支持任意数量博主及至少三位并排比较。</p><p>冰冰小美的真实样本应通过运行时 JSON 导入；未自动填充历史。已知入口：<a className="text-cyan underline" href="https://xueqiu.com/7143769715/409823838" target="_blank" rel="noreferrer">查看原帖</a>。</p></div>}
    {view === 'overview' && <><label className="block text-sm">选择博主<select aria-label="选择博主" className={selectClass} value={selectedCreator?.id ?? ''} onChange={event => setCreatorId(event.target.value)}>{creators.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{topics.map(topic => <article className="min-w-0 rounded border border-borderSoft bg-bg1 p-4" key={topic.id}><h2 className="font-semibold">{topic.name}</h2>{stateCard(current.find(item => item.creatorId === selectedCreator?.id && item.topicId === topic.id))}</article>)}</div></>}
    {view === 'timeline' && <><div className="grid gap-3 md:grid-cols-2"><label className="text-sm">筛选博主<select aria-label="筛选博主" className={selectClass} value={creatorId} onChange={event => setCreatorId(event.target.value)}><option value="">全部博主</option>{creators.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm">筛选主题<select aria-label="筛选主题" className={selectClass} value={topicId} onChange={event => setTopicId(event.target.value)}><option value="">全部主题</option>{topics.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="space-y-3">{observations.filter(item => (!creatorId || item.creatorId === creatorId) && (!topicId || item.topicId === topicId)).slice().reverse().map(observationCard)}</div>{!observations.length && <p className="p-4 text-sm text-textMuted">暂无观点记录。新增来源后记录观点，Draft 会在时间轴中保留。</p>}</>}
    {view === 'events' && <><label className="block text-sm">同一外部事件<select aria-label="同一外部事件" className={selectClass} value={selectedEvent?.id ?? ''} onChange={event => setEventId(event.target.value)}>{events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{selectedEvent && <button className="inbox-action" type="button" onClick={() => setEvidence({ event: selectedEvent, asOf })}>核对事件来源</button>}<div className="grid gap-3 xl:grid-cols-3">{creators.map(creator => <section key={creator.id} className="min-w-0 space-y-3"><h2 className="font-semibold">{creator.name}</h2>{observations.filter(item => item.creatorId === creator.id && item.eventLinks.some(link => link.eventId === selectedEvent?.id)).map(observationCard)}{!observations.some(item => item.creatorId === creator.id && item.eventLinks.some(link => link.eventId === selectedEvent?.id)) && <p className="text-sm text-textMuted">未记录该事件相关观点；不代表该博主没有发表。</p>}</section>)}</div></>}
    {view === 'comparison' && <><label className="block text-sm">比较同一主题<select aria-label="比较同一主题" className={selectClass} value={selectedTopic?.id ?? ''} onChange={event => setTopicId(event.target.value)}>{topics.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{creators.map(creator => <article key={creator.id} className="min-w-0 rounded border border-borderSoft bg-bg1 p-4"><h2 className="font-semibold">{creator.name}</h2>{stateCard(current.find(item => item.creatorId === creator.id && item.topicId === selectedTopic?.id))}</article>)}</div></>}
    {entry && <CreatorEntryForm data={data} request={entry} onAppend={append} onClose={() => setEntry(null)} />}
    {evidence && <EvidenceDrawer creatorEvidence={{ data, ...evidence }} onClose={() => setEvidence(null)} />}
    {importRaw !== null && <Modal title="恢复 JSON 备份" description="先校验并预览合并；同 ID 不同内容会拒绝。确认时先下载当前完整备份，再追加恢复历史。" onClose={() => setImportRaw(null)} error={importError}><div className="space-y-3"><label className="block text-sm">选择备份文件<input className={selectClass} type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(raw => { setImportRaw(raw); setImportPreview(null); }); }} /></label><label className="block text-sm">JSON 内容<textarea className={`${selectClass} h-48 font-mono`} value={importRaw} onChange={event => { setImportRaw(event.target.value); setImportPreview(null); }} /></label><button type="button" className="inbox-action" onClick={() => { try { setImportPreview(repository.previewImport(importRaw, data)); setImportError(null); } catch (error) { setImportPreview(null); setImportError(error instanceof Error ? error.message : String(error)); } }}>校验并预览</button>{importPreview && <><p className="text-sm">追加 {importPreview.addCount} 条，跳过相同记录 {importPreview.skipCount} 条。当前历史保留。</p><button type="button" className="inbox-action" onClick={confirmImport}>备份当前数据并确认恢复</button></>}</div></Modal>}
  </section>;
}
