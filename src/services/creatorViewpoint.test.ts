import { describe, expect, it } from 'vitest';
import type { CreatorViewpointData, ViewpointObservation } from '../types/creatorViewpoint';
import { approveViewpoint, buildCreatorCurrentViews, buildViewpointReviews, buildViewpointTimeline, observationStatus, sourceCoverage, validateCreatorViewpointData, visibleViewpointObservations, creatorEffectiveAt, viewpointChronologyStatus } from './creatorViewpoint';
import { creatorViewpointFixture, fixtureTime as t } from './creatorViewpoint.fixture';

function appendObservation(data: CreatorViewpointData, patch: Partial<ViewpointObservation>, day = 4, approve = true) {
  const sourceId = patch.sourceId ?? (patch.supersedesId ? data.observations.find(x => x.id === patch.supersedesId)!.sourceId : `source-day-${day}`);
  if (!data.sources.some(x => x.id === sourceId)) data.sources.push({ ...data.sources[0], id: sourceId, publishedAt: t(day), capturedAt: t(day), recordedAt: t(day) });
  const observation = { ...data.observations[0], id: `observation-day-${day}`, sourceId, recordedAt: t(day), ...patch };
  data.observations.push(observation);
  if (approve) data.approvals.push({ id: `approval-day-${day}`, observationId: observation.id, decision: 'reviewed', recordedAt: t(day), note: '人工核对记录' });
  return observation;
}
describe('Creator Viewpoint domain and audit-time projection', () => {
  it('supports 3 independent creators, 5 extendable topics, one shared ResearchEvent and distinct relationships', () => {
    const data = creatorViewpointFixture(); validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data)).toHaveLength(3);
    expect(new Set(data.observations.map(x => x.eventLinks[0].eventId)).size).toBe(1);
    expect(data.observations.map(x => x.eventLinks[0].relation)).toEqual(['explicit', 'inferred', 'temporal']);
    data.topics.push({ id: 'custom', name: '自定义主题', recordedAt: t(1) });
    appendObservation(data, { topicId: 'custom', stance: 'negative' }); validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data).filter(x => x.creatorId === 'creator-1')).toHaveLength(2);
  });
  it('records a new reason without inventing a transition while current details reflect latest reviewed observation', () => {
    const data = creatorViewpointFixture(); appendObservation(data, { reasoning: '增加一条理由', summary: '仍谨慎' });
    validateCreatorViewpointData(data);
    expect(buildViewpointTimeline(data).filter(x => x.creatorId === 'creator-1')).toHaveLength(1);
    expect(buildCreatorCurrentViews(data)[0].observation.reasoning).toBe('增加一条理由');
  });
  it.each(['stance', 'conditional', 'horizon', 'trigger', 'confirmation', 'invalidation'] as const)('records state change in %s independently of summary', field => {
    const data = creatorViewpointFixture();
    appendObservation(data, { [field]: field === 'stance' ? 'positive' : field === 'conditional' ? 'no' : '条件发生变化' });
    validateCreatorViewpointData(data); const transitions = buildViewpointTimeline(data).filter(x => x.creatorId === 'creator-1');
    expect(transitions).toHaveLength(2); expect(transitions[1].previous?.id).toBe('observation-1'); expect(transitions[1].next.id).toBe('observation-day-4');
  });
  it('draft and rejected revisions never alter current view', () => {
    const data = creatorViewpointFixture(); const next = appendObservation(data, { stance: 'negative', supersedesId: 'observation-1', revisionReason: '待核对纠正' }, 4, false);
    expect(observationStatus(data, next.id)).toBe('draft'); expect(buildCreatorCurrentViews(data)[0].observation.id).toBe('observation-1');
    data.approvals.push(approveViewpoint(data, next.id, 'rejected', '来源不支持', new Date(t(5))));
    expect(observationStatus(data, next.id)).toBe('rejected'); expect(buildCreatorCurrentViews(data)[0].observation.id).toBe('observation-1');
  });
  it('as-of excludes future records and approvals without rewriting earlier current states', () => {
    const data = creatorViewpointFixture(); appendObservation(data, { stance: 'positive' }, 5, false);
    data.approvals.push(approveViewpoint(data, 'observation-day-5', 'reviewed', '审核', new Date(t(7))));
    expect(visibleViewpointObservations(data, t(4))).toHaveLength(3);
    expect(buildCreatorCurrentViews(data, t(2))).toHaveLength(0);
    expect(buildCreatorCurrentViews(data, t(6))[0].observation.stance).toBe('cautious');
    expect(buildCreatorCurrentViews(data, t(7))[0].observation.stance).toBe('positive');
    expect(buildViewpointTimeline(data, t(6))).toHaveLength(3);
  });
  it('retains complete reviewed revision history and earlier as-of after supersede', () => {
    const data = creatorViewpointFixture(); appendObservation(data, { stance: 'positive', supersedesId: 'observation-1', revisionReason: '原摘要纠正' });
    validateCreatorViewpointData(data);
    expect(data.observations.map(x => x.id)).toContain('observation-1');
    expect(buildViewpointTimeline(data).filter(x => x.creatorId === 'creator-1')).toHaveLength(1);
    expect(buildCreatorCurrentViews(data, t(3))[0].observation.id).toBe('observation-1');
    expect(buildCreatorCurrentViews(data, t(4)).find(x => x.creatorId === 'creator-1')!.observation.supersedesId).toBe('observation-1');
  });
  it('propagates PARTIAL from the parent and never verifies an unconfirmed self reply', () => {
    const data = creatorViewpointFixture();
    for (const kind of ['comment', 'self_reply', 'article', 'repost'] as const) data.sources.push({ ...data.sources[0], id: kind, kind, parentSourceId: 'source-1', commentCoverage: 'FULL', authorIdentity: 'unverified' });
    validateCreatorViewpointData(data);
    expect(sourceCoverage(data, 'self_reply')).toBe('PARTIAL');
    expect(data.sources.find(x => x.kind === 'self_reply')?.authorIdentity).toBe('unverified');
    data.sources[4].authorIdentity = 'verified_self'; expect(() => validateCreatorViewpointData(data)).toThrow(/身份核验/);
  });
  it('generates T+5/20/60 in UTC calendar days from creator publication, supports append-only results and as-of', () => {
    const data = creatorViewpointFixture(); const tasks = buildViewpointReviews(data, t(3));
    expect(tasks).toHaveLength(9); expect(tasks.slice(0, 3).map(x => x.dueAt)).toEqual([t(6), t(21), '2026-03-02T10:00:00.000Z']);
    data.reviews.push({ id: 'review-1', observationId: 'observation-1', offsetDays: 5, recordedAt: t(9), status: 'completed', triggerOccurred: 'yes', invalidationOccurred: 'no', actualOutcome: '合成后续表现', evidence: '人工核对合成证据', evidenceUrl: null, supersedesId: null });
    data.reviews.push({ ...data.reviews[0], id: 'review-2', recordedAt: t(10), status: 'inconclusive', triggerOccurred: 'unknown', supersedesId: 'review-1' });
    validateCreatorViewpointData(data);
    expect(buildViewpointReviews(data, t(8))[0].result).toBeNull();
    expect(buildViewpointReviews(data, t(9))[0].result?.id).toBe('review-1');
    expect(buildViewpointReviews(data, t(10))[0].result?.id).toBe('review-2'); expect(data.reviews).toHaveLength(2);
  });
  it('does not treat missing publication timezone as a precise instant', () => {
    const data = creatorViewpointFixture(); data.sources[0].publishedAt = null; data.sources[0].publishedAtLabel = '2026-01-01 18:00 时区未知';
    validateCreatorViewpointData(data); expect(visibleViewpointObservations(data, t(3))).toHaveLength(3);
    data.sources[0].publishedAt = '2026-01-01T18:00:00'; expect(() => validateCreatorViewpointData(data)).toThrow(/时刻/);
  });
  it('never uses audit append order to decide conflicting same-time creator states', () => {
    const data = creatorViewpointFixture(); appendObservation(data, { id: 'z', stance: 'positive' }, 4); appendObservation(data, { id: 'a', stance: 'negative' }, 4, false);
    data.approvals.push({ id: 'aaa', observationId: 'a', decision: 'reviewed', recordedAt: t(4), note: '第二次审核' });
    validateCreatorViewpointData(data); expect(buildCreatorCurrentViews(data).find(x => x.creatorId === 'creator-1')).toBeUndefined();
    expect(viewpointChronologyStatus(data, data.observations[data.observations.length - 1])).toBe('ambiguous_time');
  });
});

describe('schema and graph fail closed', () => {
  const mutations: [string, (data: CreatorViewpointData) => void][] = [
    ['duplicate ids', d => { d.creators[1].id = d.creators[0].id; }],
    ['unknown schema', d => { Object.assign(d, { schemaVersion: 2 }); }],
    ['fact promotion', d => { Object.assign(d, { semanticClass: 'provider_fact' }); }],
    ['unknown fields', d => { Object.assign(d.observations[0], { claim: true }); }],
    ['foreign creator', d => { d.observations[0].creatorId = 'creator-2'; }],
    ['unknown topic', d => { d.observations[0].topicId = 'missing'; }],
    ['missing event', d => { d.observations[0].eventLinks[0].eventId = 'missing'; }],
    ['causal assertion without evidence', d => { d.observations[0].eventLinks[0].explanation = null; }],
    ['duplicate event links', d => { d.observations[0].eventLinks.push(d.observations[0].eventLinks[0]); }],
    ['source parent cycle', d => { d.sources[0].parentSourceId = d.sources[0].id; }],
    ['future capture', d => { d.sources[0].capturedAt = t(5); }],
    ['unsafe URL', d => { d.sources[0].url = 'javascript:alert(1)'; }],
    ['URL credentials', d => { d.sources[0].url = 'https://secret:password@example.com'; }],
    ['self reply without parent', d => { d.sources[0].kind = 'self_reply'; }],
    ['empty content marked full', d => { d.sources[0].content = null; }],
    ['revision absent', d => { d.observations[0].supersedesId = 'missing'; d.observations[0].revisionReason = 'change'; }],
    ['revision cycle', d => { d.observations[0].supersedesId = d.observations[0].id; d.observations[0].revisionReason = 'change'; }],
    ['revision reason missing', d => { appendObservation(d, { supersedesId: 'observation-1' }); }],
    ['cross-topic supersede', d => { appendObservation(d, { topicId: 'technology', supersedesId: 'observation-1', revisionReason: 'change' }); }],
    ['approval before observation', d => { d.approvals[0].recordedAt = t(1); }],
    ['future published linked event', d => { d.events[0].publishedAt = t(5); }],
    ['approval history reorder', d => { d.approvals[0].recordedAt = t(5); }],
    ['multiple approvals', d => { d.approvals.push({ ...d.approvals[0], id: 'duplicate-approval' }); }],
  ];
  it.each(mutations)('rejects %s', (_label, mutate) => { const data = creatorViewpointFixture(); mutate(data); expect(() => validateCreatorViewpointData(data)).toThrow(); });
  it('rejects future/early completion and unproven outcome, requires pending until horizon', () => {
    const data = creatorViewpointFixture(); data.reviews.push({ id: 'r', observationId: 'observation-1', offsetDays: 5, recordedAt: t(4), status: 'completed', triggerOccurred: 'unknown', invalidationOccurred: 'unknown', actualOutcome: null, evidence: null, evidenceUrl: null, supersedesId: null });
    expect(() => validateCreatorViewpointData(data)).toThrow(/实际表现/);
    data.reviews[0].actualOutcome = 'sample'; data.reviews[0].evidence = 'sample'; expect(() => validateCreatorViewpointData(data)).toThrow(/周期未满/);
    data.reviews[0].status = 'inconclusive'; expect(() => validateCreatorViewpointData(data)).toThrow(/周期未满/);
    data.reviews[0].status = 'pending'; validateCreatorViewpointData(data);
  });
  it('refuses late approval of a superseded draft', () => {
    const data = creatorViewpointFixture(); const draft = appendObservation(data, {}, 4, false);
    appendObservation(data, { supersedesId: draft.id, revisionReason: '修订', stance: 'positive' }, 5);
    expect(() => approveViewpoint(data, draft.id, 'reviewed', '误操作', new Date(t(6)))).toThrow(/旧版本/);
  });
  it('rejects attribution of another author and invented outcomes for unknown conditions', () => {
    const data = creatorViewpointFixture(); data.sources[0].authorIdentity = 'other';
    expect(() => validateCreatorViewpointData(data)).toThrow(/他人评论/);
    data.sources[0].authorIdentity = 'unverified'; data.observations[0].invalidation = null;
    data.reviews.push({ id: 'r', observationId: 'observation-1', offsetDays: 5, recordedAt: t(10), status: 'inconclusive', triggerOccurred: 'unknown', invalidationOccurred: 'no', actualOutcome: null, evidence: null, evidenceUrl: null, supersedesId: null });
    expect(() => validateCreatorViewpointData(data)).toThrow(/失效条件未知/);
    data.reviews[0].invalidationOccurred = 'unknown'; validateCreatorViewpointData(data);
  });
});
