import type {
  Coverage, CreatorSource, CreatorViewpointData, ViewpointApproval, ViewpointCurrent,
  ViewpointObservation, ViewpointReviewDue, ViewpointState, ViewpointTransition,
} from '../types/creatorViewpoint';
import { isPreciseInstant } from '../utils/dateTime';
import { safeEvidenceUrl } from '../utils/evidenceUrl';

const EPOCH = '1970-01-01T00:00:00.000Z';
export const DEFAULT_VIEWPOINT_TOPICS = [
  ['a-shares', 'A股整体'], ['technology', '科技成长'], ['inflation-commodities', '通胀 / 商品'],
  ['global-rates', '美债 / 全球利率'], ['china-liquidity-rmb', '中国流动性 / 人民币'],
] as const;
export function createEmptyCreatorViewpointData(): CreatorViewpointData {
  return { schemaVersion: 1, semanticClass: 'external_commentary', creators: [],
    topics: DEFAULT_VIEWPOINT_TOPICS.map(([id, name]) => ({ id, name, recordedAt: EPOCH })),
    sources: [], events: [], observations: [], approvals: [], reviews: [] };
}

function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`观点追踪校验失败：${message}`);
}
type RecordValue = Record<string, unknown>;
function object(value: unknown, keys: string, label: string): asserts value is RecordValue {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} 必须是对象`);
  const allowed = keys.split(' ');
  requireThat(Object.keys(value).length === allowed.length && allowed.every(key => Object.prototype.hasOwnProperty.call(value, key)), `${label} 字段缺失或包含未知字段`);
}
function text(value: unknown, name: string, nullable = false): void {
  requireThat((nullable && value === null) || (typeof value === 'string' && !!value.trim() && value.length <= 100_000), `${name} 必须是非空文字${nullable ? '或 null（unknown）' : ''}`);
}
function instant(value: unknown, name: string, nullable = false): void {
  requireThat((nullable && value === null) || (typeof value === 'string' && isPreciseInstant(value)), `${name} 必须是带时区的真实时刻${nullable ? '或 null' : ''}`);
}
function url(value: unknown, name: string): void {
  requireThat(value === null || (typeof value === 'string' && safeEvidenceUrl(value) !== null), `${name} 必须是无凭据 HTTP(S) URL 或 null`);
}
function oneOf(value: unknown, values: readonly unknown[], name: string): void { requireThat(values.includes(value), `${name} 不受支持`); }
const time = (value: string) => new Date(value).getTime();
const before = (a: string, b: string) => time(a) <= time(b);
function base(value: unknown, keys: string, label: string): asserts value is RecordValue {
  object(value, keys, label); text(value.id, `${label}.id`); instant(value.recordedAt, `${label}.recordedAt`);
}
function state(value: RecordValue) {
  oneOf(value.stance, ['positive', 'neutral', 'cautious', 'negative', 'mixed', 'unknown'], 'stance');
  oneOf(value.conditional, ['yes', 'no', 'unknown'], 'conditional');
  for (const key of ['horizon', 'trigger', 'confirmation', 'invalidation']) text(value[key], key, true);
}

/** Versioned browser domain schema, including graph invariants; no normalization or guessed defaults. */
export function validateCreatorViewpointData(value: unknown): asserts value is CreatorViewpointData {
  object(value, 'schemaVersion semanticClass creators topics sources events observations approvals reviews', 'envelope');
  requireThat(value.schemaVersion === 1 && value.semanticClass === 'external_commentary', '未知版本或语义类别');
  const ids = new Set<string>();
  for (const key of ['creators', 'topics', 'sources', 'events', 'observations', 'approvals', 'reviews']) {
    const rows = value[key]; requireThat(Array.isArray(rows) && rows.length <= 20_000, `${key} 必须是有限数组`);
    for (const row of rows) {
      requireThat(row && typeof row === 'object' && typeof row.id === 'string' && !ids.has(row.id), `${key} 重复或无效 id`);
      ids.add(row.id);
    }
  }
  for (const row of value.creators as unknown[]) {
    base(row, 'id name profileUrl recordedAt', 'creator'); text(row.name, 'name'); url(row.profileUrl, 'profileUrl');
  }
  for (const row of value.topics as unknown[]) {
    base(row, 'id name recordedAt', 'topic'); text(row.name, 'name');
  }
  for (const row of value.sources as unknown[]) {
    base(row, 'id creatorId kind url publishedAt publishedAtLabel capturedAt recordedAt content parentSourceId supersedesId authorIdentity identityEvidence completeness commentCoverage', 'source');
    text(row.creatorId, 'creatorId'); oneOf(row.kind, ['post', 'article', 'comment', 'self_reply', 'repost'], 'kind');
    url(row.url, 'url'); instant(row.publishedAt, 'publishedAt', true); text(row.publishedAtLabel, 'publishedAtLabel', true); instant(row.capturedAt, 'capturedAt');
    for (const key of ['content', 'parentSourceId', 'supersedesId', 'identityEvidence']) text(row[key], key, true);
    oneOf(row.authorIdentity, ['verified_self', 'unverified', 'other'], 'authorIdentity');
    oneOf(row.completeness, ['FULL', 'PARTIAL', 'UNVERIFIED'], 'completeness'); oneOf(row.commentCoverage, ['FULL', 'PARTIAL', 'UNVERIFIED'], 'commentCoverage');
    requireThat(row.authorIdentity !== 'verified_self' || (row.identityEvidence !== null && row.url !== null), '确认本人身份必须附身份核验依据与来源 URL');
    requireThat(!['comment', 'self_reply'].includes(row.kind as string) || row.parentSourceId !== null, '评论/本人回复必须关联父级来源');
    requireThat(row.kind !== 'self_reply' || row.authorIdentity !== 'other', '他人评论不能标为本人回复');
    requireThat(row.completeness !== 'FULL' || row.content !== null, '全文完整必须有原文或明确摘录');
    requireThat(before(row.capturedAt as string, row.recordedAt as string), '抓取不能晚于录入时间');
    requireThat(row.publishedAt === null || before(row.publishedAt as string, row.capturedAt as string), '精确发布时间不能晚于抓取时间');
  }
  for (const row of value.events as unknown[]) {
    base(row, 'id title summary publishedAt sourceName sourceUrl scope eventType eventOccurredAt recordedAt verificationStatus supersedesId', 'event');
    for (const key of ['title', 'summary', 'sourceName']) text(row[key], key);
    instant(row.publishedAt, 'event.publishedAt', true); instant(row.eventOccurredAt, 'eventOccurredAt', true); url(row.sourceUrl, 'event.sourceUrl');
    oneOf(row.scope, ['external'], 'event.scope'); oneOf(row.eventType, ['macro_external'], 'eventType');
    oneOf(row.verificationStatus, ['unverified', 'partial'], 'event.verificationStatus'); text(row.supersedesId, 'event.supersedesId', true);
  }
  for (const row of value.observations as unknown[]) {
    base(row, 'id creatorId topicId sourceId recordedAt summary reasoning eventLinks supersedesId revisionReason important stance conditional horizon trigger confirmation invalidation', 'observation');
    for (const key of ['creatorId', 'topicId', 'sourceId', 'summary']) text(row[key], key);
    for (const key of ['reasoning', 'supersedesId', 'revisionReason']) text(row[key], key, true);
    state(row); requireThat(typeof row.important === 'boolean', 'important 必须是 boolean');
    requireThat(row.supersedesId === null || row.revisionReason !== null, '修订必须注明原因');
    requireThat(Array.isArray(row.eventLinks), 'eventLinks 必须是数组');
    const eventIds = new Set<string>();
    for (const link of row.eventLinks) {
      object(link, 'eventId relation explanation', 'eventLink'); text(link.eventId, 'eventId');
      oneOf(link.relation, ['explicit', 'inferred', 'temporal'], 'relation'); text(link.explanation, 'explanation', true);
      requireThat(link.relation === 'temporal' || link.explanation !== null, '明确因果/研究者推断必须给出依据');
      requireThat(!eventIds.has(link.eventId as string), '同一观点不能重复关联同一事件'); eventIds.add(link.eventId as string);
    }
  }
  for (const row of value.approvals as unknown[]) {
    base(row, 'id observationId decision recordedAt note', 'approval'); text(row.observationId, 'observationId');
    oneOf(row.decision, ['reviewed', 'rejected'], 'decision'); text(row.note, 'note');
  }
  for (const row of value.reviews as unknown[]) {
    base(row, 'id observationId offsetDays recordedAt status triggerOccurred invalidationOccurred actualOutcome evidence evidenceUrl supersedesId', 'review');
    text(row.observationId, 'review.observationId'); oneOf(row.offsetDays, [5, 20, 60], 'offsetDays');
    oneOf(row.status, ['pending', 'completed', 'inconclusive'], 'review.status');
    for (const key of ['triggerOccurred', 'invalidationOccurred']) oneOf(row[key], ['yes', 'no', 'unknown'], key);
    for (const key of ['actualOutcome', 'evidence', 'supersedesId']) text(row[key], key, true); url(row.evidenceUrl, 'evidenceUrl');
    requireThat(row.status !== 'completed' || (row.actualOutcome !== null && row.evidence !== null), '完成复盘必须有实际表现和证据说明');
  }
  const data = value as unknown as CreatorViewpointData;
  const creators = new Map(data.creators.map(x => [x.id, x])); const topics = new Map(data.topics.map(x => [x.id, x]));
  const sources = new Map<string, CreatorSource>();
  for (const source of data.sources) {
    const creator = creators.get(source.creatorId); requireThat(creator && before(creator.recordedAt, source.recordedAt), '来源 Creator 缺失或尚未录入');
    if (source.parentSourceId) { const parent = sources.get(source.parentSourceId); requireThat(parent && parent.creatorId === source.creatorId && before(parent.recordedAt, source.recordedAt), '父级来源必须已存在且属于同一 Creator'); }
    if (source.supersedesId) { const prior = sources.get(source.supersedesId); requireThat(prior && prior.creatorId === source.creatorId && prior.kind === source.kind && before(prior.recordedAt, source.recordedAt), '来源修订引用无效'); }
    sources.set(source.id, source);
  }
  const events = new Map<string, CreatorViewpointData['events'][number]>();
  for (const event of data.events) {
    if (event.supersedesId) { const prior = events.get(event.supersedesId); requireThat(prior && before(prior.recordedAt, event.recordedAt), '事件修订引用无效'); }
    events.set(event.id, event);
  }
  const observations = new Map<string, ViewpointObservation>();
  for (const observation of data.observations) {
    const source = sources.get(observation.sourceId); const topic = topics.get(observation.topicId);
    requireThat(source && source.creatorId === observation.creatorId && before(source.recordedAt, observation.recordedAt), '观点来源缺失、跨作者或时间倒置');
    requireThat(topic && before(topic.recordedAt, observation.recordedAt), 'Topic 缺失或时间倒置');
    for (const link of observation.eventLinks) { const event = events.get(link.eventId); requireThat(event && before(event.recordedAt, observation.recordedAt), '关联事件不存在或在观点之后录入'); }
    if (observation.supersedesId) {
      const prior = observations.get(observation.supersedesId);
      requireThat(prior && prior.creatorId === observation.creatorId && prior.topicId === observation.topicId && before(prior.recordedAt, observation.recordedAt), '观点修订必须指向相同 Creator × Topic 的既有记录');
    }
    observations.set(observation.id, observation);
  }
  const decisions = new Map<string, ViewpointApproval>();
  let lastApprovalTime = EPOCH;
  for (const approval of data.approvals) {
    requireThat(before(lastApprovalTime, approval.recordedAt), '审批必须按录入顺序追加，不得回填过去的审批时间');
    lastApprovalTime = approval.recordedAt;
    const observation = observations.get(approval.observationId);
    requireThat(observation && before(observation.recordedAt, approval.recordedAt) && !decisions.has(approval.observationId), '审批必须晚于观点且每条观点只审核一次；重审请追加修订');
    const source = sources.get(observation.sourceId)!;
    requireThat(approval.decision !== 'reviewed' || source.authorIdentity !== 'other', '他人评论不能审核为该 Creator 本人的观点');
    requireThat(source.publishedAt === null || before(source.publishedAt, approval.recordedAt), '不能提前审核未来发表的观点');
    requireThat(observation.eventLinks.every(link => {
      const event = events.get(link.eventId)!;
      return event.publishedAt === null || before(event.publishedAt, approval.recordedAt);
    }), '不能使用未来发布的事件审核当前观点');
    // A late approval of an older revision must not undo an already reviewed successor.
    if (observation.supersedesId) {
      const priorDecision = decisions.get(observation.supersedesId);
      requireThat(!priorDecision || before(priorDecision.recordedAt, approval.recordedAt), '修订审批时间倒置');
    }
    let ancestor = observation.supersedesId;
    while (ancestor) {
      const priorDecision = decisions.get(ancestor);
      requireThat(!priorDecision || before(priorDecision.recordedAt, approval.recordedAt), '修订祖先审批时间倒置');
      ancestor = observations.get(ancestor)!.supersedesId;
    }
    requireThat(![...decisions.keys()].some(id => {
      let previous = observations.get(id)!.supersedesId;
      while (previous) { if (previous === observation.id) return true; previous = observations.get(previous)!.supersedesId; }
      return false;
    }), '已经审核后继修订，不能再审核旧版本');
    decisions.set(approval.observationId, approval);
  }
  const reviews = new Map<string, CreatorViewpointData['reviews'][number]>(); const reviewHeads = new Map<string, string>();
  for (const review of data.reviews) {
    const observation = observations.get(review.observationId); const approval = decisions.get(review.observationId);
    requireThat(observation?.important && approval?.decision === 'reviewed' && before(approval.recordedAt, review.recordedAt), '复盘必须关联重要的已审核观点');
    requireThat(observation.trigger !== null || review.triggerOccurred === 'unknown', '原成立条件未知，不能声明已触发或未触发');
    requireThat(observation.invalidation !== null || review.invalidationOccurred === 'unknown', '原失效条件未知，不能声明已触发或未触发');
    const key = JSON.stringify([review.observationId, review.offsetDays]);
    requireThat((reviewHeads.get(key) ?? null) === review.supersedesId, '复盘须追加到同一周期的当前修订，不得分叉或覆盖');
    if (review.supersedesId) { const prior = reviews.get(review.supersedesId); requireThat(prior && before(prior.recordedAt, review.recordedAt), '复盘修订时间倒置'); }
    requireThat(review.status !== 'completed' || time(review.recordedAt) >= time(approval.recordedAt) + review.offsetDays * 86_400_000, '观察周期未满，不能标记完成');
    reviews.set(review.id, review); reviewHeads.set(key, review.id);
  }
}

function cutoff(asOf?: string): string { const result = asOf ?? new Date().toISOString(); instant(result, 'asOf'); return result; }
function sourceVisible(data: CreatorViewpointData, source: CreatorSource, asOf: string): boolean {
  if (!before(source.recordedAt, asOf) || !before(source.capturedAt, asOf) || (source.publishedAt !== null && !before(source.publishedAt, asOf))) return false;
  const parent = source.parentSourceId ? data.sources.find(x => x.id === source.parentSourceId) : null;
  return !source.parentSourceId || (!!parent && sourceVisible(data, parent, asOf));
}
export function visibleViewpointObservations(data: CreatorViewpointData, asOf?: string): ViewpointObservation[] {
  const end = cutoff(asOf);
  return data.observations.filter(observation => {
    const source = data.sources.find(x => x.id === observation.sourceId);
    return before(observation.recordedAt, end) && !!source && sourceVisible(data, source, end)
      && data.creators.some(x => x.id === observation.creatorId && before(x.recordedAt, end))
      && data.topics.some(x => x.id === observation.topicId && before(x.recordedAt, end))
      && observation.eventLinks.every(link => data.events.some(x => x.id === link.eventId && before(x.recordedAt, end) && (!x.publishedAt || before(x.publishedAt, end))));
  });
}
export function observationStatus(data: CreatorViewpointData, observationId: string, asOf?: string): 'draft' | 'reviewed' | 'rejected' {
  const end = cutoff(asOf);
  if (!visibleViewpointObservations(data, end).some(x => x.id === observationId)) return 'draft';
  return data.approvals.find(x => x.observationId === observationId && before(x.recordedAt, end))?.decision ?? 'draft';
}
export function sourceCoverage(data: CreatorViewpointData, sourceId: string): Coverage {
  const weights: Coverage[] = ['FULL', 'PARTIAL', 'UNVERIFIED'];
  let worst = 0; let next: string | null = sourceId; const seen = new Set<string>();
  while (next) {
    if (seen.has(next)) return 'UNVERIFIED'; seen.add(next);
    const source = data.sources.find(x => x.id === next); if (!source) return 'UNVERIFIED';
    worst = Math.max(worst, weights.indexOf(source.completeness), weights.indexOf(source.commentCoverage)); next = source.parentSourceId;
  }
  return weights[worst];
}
function stateKey(observation: ViewpointState): string {
  return JSON.stringify([observation.stance, observation.conditional, observation.horizon, observation.trigger, observation.confirmation, observation.invalidation]);
}
function reviewed(data: CreatorViewpointData, asOf?: string) {
  const end = cutoff(asOf); const observations = new Map(visibleViewpointObservations(data, end).map(x => [x.id, x]));
  // Equal audit instants retain append order, independent of ids and publication time.
  return data.approvals.map((approval, index) => ({ approval, index, observation: observations.get(approval.observationId) }))
    .filter((row): row is typeof row & { observation: ViewpointObservation } => !!row.observation && row.approval.decision === 'reviewed' && before(row.approval.recordedAt, end))
    .sort((a, b) => time(a.approval.recordedAt) - time(b.approval.recordedAt) || a.index - b.index);
}
export function buildViewpointTimeline(data: CreatorViewpointData, asOf?: string): ViewpointTransition[] {
  const previous = new Map<string, ViewpointObservation>(); const transitions: ViewpointTransition[] = [];
  for (const { observation, approval } of reviewed(data, asOf)) {
    const key = JSON.stringify([observation.creatorId, observation.topicId]); const prior = previous.get(key) ?? null;
    if (!prior || stateKey(prior) !== stateKey(observation)) transitions.push({ id: `transition:${approval.id}`, creatorId: observation.creatorId, topicId: observation.topicId, recordedAt: approval.recordedAt, previous: prior, next: observation, approvalId: approval.id });
    previous.set(key, observation);
  }
  return transitions;
}
export function buildCreatorCurrentViews(data: CreatorViewpointData, asOf?: string): ViewpointCurrent[] {
  const transitions = buildViewpointTimeline(data, asOf); const views = new Map<string, ViewpointCurrent>();
  for (const { observation, approval } of reviewed(data, asOf)) {
    const key = JSON.stringify([observation.creatorId, observation.topicId]);
    const matchingTransitions = transitions.filter(x => x.creatorId === observation.creatorId && x.topicId === observation.topicId);
    views.set(key, { creatorId: observation.creatorId, topicId: observation.topicId, observation, reviewedAt: approval.recordedAt,
      lastTransition: matchingTransitions[matchingTransitions.length - 1] ?? null,
      coverage: sourceCoverage(data, observation.sourceId) });
  }
  return [...views.values()];
}
export function buildViewpointReviews(data: CreatorViewpointData, asOf?: string): ViewpointReviewDue[] {
  const end = cutoff(asOf);
  return reviewed(data, end).filter(x => x.observation.important).flatMap(({ observation, approval }) => ([5, 20, 60] as const).map(offsetDays => {
    const results = data.reviews.filter(x => x.observationId === observation.id && x.offsetDays === offsetDays && before(x.recordedAt, end));
    return { observationId: observation.id, offsetDays, dueAt: new Date(time(approval.recordedAt) + offsetDays * 86_400_000).toISOString(), basis: 'calendar_days' as const, result: results[results.length - 1] ?? null };
  }));
}
export function approveViewpoint(data: CreatorViewpointData, observationId: string, decision: ViewpointApproval['decision'], note: string, now = new Date()): ViewpointApproval {
  const approval: ViewpointApproval = { id: crypto.randomUUID(), observationId, decision, note, recordedAt: now.toISOString() };
  validateCreatorViewpointData({ ...data, approvals: [...data.approvals, approval] }); return approval;
}
