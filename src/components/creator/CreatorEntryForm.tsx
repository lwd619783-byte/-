import { useState, type FormEvent, type ReactNode } from 'react';
import type { CreatorViewpointData, ViewpointObservation, ViewpointReviewDue } from '../../types/creatorViewpoint';
import { approveViewpoint } from '../../services/creatorViewpoint';
import { Modal } from '../common/Modal';
import { relationLabels, sourceLabels, stanceLabels } from './CreatorEvidence';

export type EntryKind = 'creator' | 'topic' | 'source' | 'event' | 'observation' | 'approval' | 'review';
export interface EntryRequest { kind: EntryKind; observation?: ViewpointObservation; due?: ViewpointReviewDue }
const titles: Record<EntryKind, string> = { creator: '新增博主', topic: '新增主题', source: '新增来源', event: '新增外部事件', observation: '记录观点', approval: '审核观点记录', review: '记录后续复盘' };
const inputClass = 'mt-1 min-h-11 w-full rounded border border-borderSoft bg-bg2 px-3 py-2 text-textStrong';
function Field({ label, name, required, type = 'text', value = '', area = false }: { label: string; name: string; required?: boolean; type?: string; value?: string; area?: boolean }) {
  return <label className="block text-sm text-textMuted">{label}{area ? <textarea aria-label={label} className={inputClass} rows={3} name={name} required={required} defaultValue={value} /> : <input aria-label={label} className={inputClass} type={type} name={name} required={required} defaultValue={value} />}</label>;
}
function Select({ label, name, children, value = '' }: { label: string; name: string; children: ReactNode; value?: string }) { return <label className="block text-sm text-textMuted">{label}<select aria-label={label} className={inputClass} name={name} defaultValue={value}>{children}</select></label>; }
const unknownOption = <option value="">unknown / 未提供</option>;
const yesNoUnknown = <><option value="unknown">unknown</option><option value="yes">是</option><option value="no">否</option></>;
const coverageOptions = <><option value="UNVERIFIED">UNVERIFIED · 未核对</option><option value="PARTIAL">PARTIAL · 部分覆盖</option><option value="FULL">FULL · 完整覆盖</option></>;

export function CreatorEntryForm({ request, data, onAppend, onClose }: { request: EntryRequest; data: CreatorViewpointData; onAppend: (additions: Partial<CreatorViewpointData>) => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const close = () => { if (!dirty || window.confirm('有未保存的内容，确认丢弃？')) onClose(); };
  const { kind, observation, due } = request;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    const nullable = (name: string) => text(name) || null;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    try {
      let additions: Partial<CreatorViewpointData>;
      if (kind === 'creator') additions = { creators: [{ id, name: text('name'), profileUrl: nullable('url'), recordedAt: now }] };
      else if (kind === 'topic') additions = { topics: [{ id, name: text('name'), recordedAt: now }] };
      else if (kind === 'source') additions = { sources: [{ id, creatorId: text('creatorId'), kind: text('sourceKind') as 'post', url: nullable('url'), publishedAt: nullable('publishedAt'), publishedAtLabel: nullable('publishedAtLabel'), capturedAt: text('capturedAt') || now, recordedAt: now, content: nullable('content'), parentSourceId: nullable('parentSourceId'), supersedesId: nullable('supersedesId'), authorIdentity: text('identity') as 'unverified', identityEvidence: nullable('identityEvidence'), completeness: text('completeness') as 'UNVERIFIED', commentCoverage: text('commentCoverage') as 'UNVERIFIED' }] };
      else if (kind === 'event') additions = { events: [{ id, scope: 'external', eventType: 'macro_external', title: text('title'), summary: text('summary'), sourceName: text('sourceName') || 'unknown', sourceUrl: nullable('url'), eventOccurredAt: nullable('eventOccurredAt'), publishedAt: nullable('publishedAt'), recordedAt: now, verificationStatus: text('verificationStatus') as 'unverified', supersedesId: nullable('supersedesId') }] };
      else if (kind === 'observation') {
        const source = data.sources.find(item => item.id === text('sourceId'));
        if (!source) throw new Error('先录入该观点的来源。');
        const eventIds = form.getAll('eventIds').map(String);
        additions = { observations: [{ id, creatorId: source.creatorId, topicId: text('topicId'), sourceId: source.id, recordedAt: now, summary: text('summary'), reasoning: nullable('reasoning'), stance: text('stance') as 'unknown', conditional: text('conditional') as 'unknown', horizon: nullable('horizon'), trigger: nullable('trigger'), confirmation: nullable('confirmation'), invalidation: nullable('invalidation'), eventLinks: eventIds.map(eventId => ({ eventId, relation: text(`relation-${eventId}`) as 'temporal', explanation: nullable(`explanation-${eventId}`) })), important: form.get('important') === 'on', supersedesId: observation?.id ?? null, revisionReason: nullable('revisionReason') }] };
      } else if (kind === 'approval' && observation) additions = { approvals: [approveViewpoint(data, observation.id, text('decision') as 'reviewed', text('note'), new Date(now))] };
      else if (kind === 'review' && due) additions = { reviews: [{ id, observationId: due.observationId, offsetDays: due.offsetDays, recordedAt: now, status: text('status') as 'completed', triggerOccurred: text('triggerOccurred') as 'unknown', invalidationOccurred: text('invalidationOccurred') as 'unknown', actualOutcome: nullable('actualOutcome'), evidence: nullable('evidence'), evidenceUrl: nullable('url'), supersedesId: due.result?.id ?? null }] };
      else throw new Error('记录对象不存在。');
      onAppend(additions);
      onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); }
  };
  return <Modal title={titles[kind]} description="留空即 unknown。新增与修订均追加保存；审核不验证观点正确性。" onClose={close} onDiscard={onClose} hasUnsavedChanges={dirty} error={error}>
    <form className="space-y-4" onSubmit={submit} onChange={() => setDirty(true)}>
      {(kind === 'creator' || kind === 'topic') && <Field name="name" label={kind === 'creator' ? '博主名称' : '主题名称'} required />}
      {kind === 'creator' && <Field name="url" label="个人主页 URL（可留空）" type="url" />}
      {kind === 'source' && <>
        <Select label="所属博主" name="creatorId">{data.creators.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select label="来源类型" name="sourceKind" value="post">{Object.entries(sourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Field name="url" label="来源 URL" type="url" />
        <Field name="publishedAtLabel" label="页面发布时间原文（未知时区保留原文）" />
        <Field name="publishedAt" label="精确发布时间（ISO，必须带时区；未知留空）" />
        <Field name="capturedAt" label="抓取 / 录入时间（ISO，带时区）" value={new Date().toISOString()} required />
        <Field name="content" label="原文或摘录（未知留空）" area />
        <Select label="父级来源（评论 / 回复必须关联）" name="parentSourceId">{unknownOption}{data.sources.map(item => <option key={item.id} value={item.id}>{sourceLabels[item.kind]} · {item.content?.slice(0, 45) ?? item.id}</option>)}</Select>
        <Select label="修订已有来源（保留原记录）" name="supersedesId">{unknownOption}{data.sources.map(item => <option key={item.id} value={item.id}>{item.content?.slice(0, 45) ?? item.id}</option>)}</Select>
        <Select label="作者身份状态" name="identity" value="unverified"><option value="unverified">未确认本人</option><option value="verified_self">已核对本人身份</option><option value="other">他人</option></Select>
        <Field name="identityEvidence" label="本人身份核对依据（仅选“本人回复”不算已核对）" area />
        <Select label="来源完整性" name="completeness" value="UNVERIFIED">{coverageOptions}</Select>
        <Select label="评论区覆盖（没有抓到不代表没有发表）" name="commentCoverage" value="UNVERIFIED">{coverageOptions}</Select>
      </>}
      {kind === 'event' && <>
        <Field name="title" label="事件名称" required /><Field name="summary" label="事件摘要" area required /><Field name="sourceName" label="事件来源名称" /><Field name="url" label="事件来源 URL" type="url" />
        <Field name="eventOccurredAt" label="事件发生时间（带时区 ISO；未知留空）" /><Field name="publishedAt" label="发布时间（带时区 ISO；未知留空）" />
        <Select label="核验状态" name="verificationStatus" value="unverified"><option value="unverified">unverified · 未核验</option><option value="partial">partial · 部分核验</option></Select>
        <Select label="修订已有事件（保留原记录）" name="supersedesId">{unknownOption}{data.events.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select>
      </>}
      {kind === 'observation' && <>
        {observation && <p className="text-sm text-warning">追加修订：{observation.summary}。原记录与审核历史保留。</p>}
        <Select label="观点来源（决定所属博主）" name="sourceId" value={observation?.sourceId ?? ''}>{data.sources.map(item => <option key={item.id} value={item.id}>{data.creators.find(creator => creator.id === item.creatorId)?.name} · {sourceLabels[item.kind]} · {item.content?.slice(0, 45) ?? item.id}</option>)}</Select>
        <Select label="主题（同一来源可重复录入多个主题）" name="topicId" value={observation?.topicId ?? ''}>{data.topics.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select label="立场" name="stance" value={observation?.stance ?? 'unknown'}>{Object.entries(stanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select label="是否条件性判断" name="conditional" value={observation?.conditional ?? 'unknown'}>{yesNoUnknown}</Select>
        <Field name="horizon" label="时间周期" value={observation?.horizon ?? ''} /><Field name="summary" label="观点摘要" required area value={observation?.summary ?? ''} /><Field name="reasoning" label="核心理由 / 为什么改变" area value={observation?.reasoning ?? ''} />
        <Field name="trigger" label="Trigger · 成立条件" area value={observation?.trigger ?? ''} /><Field name="confirmation" label="Confirmation · 确认条件" area value={observation?.confirmation ?? ''} /><Field name="invalidation" label="Invalidation · 失效条件" area value={observation?.invalidation ?? ''} />
        <fieldset className="space-y-3 rounded border border-borderSoft p-3"><legend className="text-sm">关联外部事件（可多选；逐条区分因果关系）</legend>{data.events.length === 0 && <p className="text-sm text-textMuted">尚无事件，可先保存观点，再通过追加修订补充关联。</p>}{data.events.map(item => { const link = observation?.eventLinks.find(link => link.eventId === item.id); return <div key={item.id}><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="eventIds" value={item.id} defaultChecked={!!link} />{item.title}</label><Select label={`${item.title}：关系类型`} name={`relation-${item.id}`} value={link?.relation ?? 'temporal'}>{Object.entries(relationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select><Field label={`${item.title}：关系依据`} name={`explanation-${item.id}`} value={link?.explanation ?? ''} /></div>; })}</fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="important" defaultChecked={observation?.important} />重要观点：审核后安排 T+5 / T+20 / T+60 日历日复盘</label>
        {observation && <Field name="revisionReason" label="修订原因" required area />}
      </>}
      {kind === 'approval' && observation && <><p className="text-sm">{observation.summary}</p><p className="text-sm text-warning">请核对原文、作者身份与条件。通过后参与 Current View 派生；不会成为已验证事实。</p><Select label="审核决定" name="decision" value="reviewed"><option value="reviewed">通过记录审核</option><option value="rejected">拒绝记录</option></Select><Field name="note" label="审核依据 / 备注" required area /></>}
      {kind === 'review' && due && <><p className="text-sm">T+{due.offsetDays} · calendar days · 到期 {due.dueAt}</p><p className="text-sm">原观点：{observation?.summary ?? 'unknown'}</p><p className="text-sm">成立条件：{observation?.trigger ?? 'unknown'}；失效条件：{observation?.invalidation ?? 'unknown'}</p><Select label="复盘状态" name="status" value="completed"><option value="completed">completed · 已完成</option><option value="inconclusive">inconclusive · 无法判断</option><option value="pending">pending · 待复盘</option></Select><Select label="成立条件是否触发" name="triggerOccurred" value={due.result?.triggerOccurred ?? 'unknown'}>{yesNoUnknown}</Select><Select label="失效条件是否触发" name="invalidationOccurred" value={due.result?.invalidationOccurred ?? 'unknown'}>{yesNoUnknown}</Select><Field name="actualOutcome" label="后续实际表现" area value={due.result?.actualOutcome ?? ''} /><Field name="evidence" label="后续验证证据" area value={due.result?.evidence ?? ''} /><Field name="url" label="证据 URL" type="url" value={due.result?.evidenceUrl ?? ''} /></>}
      <button className="inbox-action" type="submit">{kind === 'approval' ? '确认审核决定' : kind === 'observation' ? '保存为 Draft' : '追加保存'}</button>
    </form>
  </Modal>;
}
