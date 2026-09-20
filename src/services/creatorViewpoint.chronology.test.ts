import { describe, expect, it } from 'vitest';
import type { CreatorViewpointData, ViewpointReview } from '../types/creatorViewpoint';
import { buildCreatorCurrentViews, buildViewpointReviews, buildViewpointTimeline, creatorEffectiveAt, validateCreatorViewpointData, viewpointChronologyStatus, visibleViewpointObservations } from './creatorViewpoint';
import { creatorViewpointFixture } from './creatorViewpoint.fixture';

const newerTime = '2026-09-18T08:00:00.000Z';
const olderTime = '2026-08-29T08:00:00.000Z';
const backfillAt = '2026-09-19T08:00:00.000Z';
const backfillApproved = '2026-09-19T09:00:00.000Z';
const correctionAt = '2026-09-20T08:00:00.000Z';
function history(): CreatorViewpointData {
  const data = creatorViewpointFixture();
  const source = data.sources[0]; const observation = data.observations[0];
  data.sources = [
    { ...source, id: 'new-source', publishedAt: newerTime, capturedAt: newerTime, recordedAt: newerTime },
    { ...source, id: 'old-source', publishedAt: olderTime, capturedAt: backfillAt, recordedAt: backfillAt },
  ];
  data.observations = [
    { ...observation, id: 'new', sourceId: 'new-source', recordedAt: newerTime, stance: 'positive', summary: '9月18日较新观点' },
    { ...observation, id: 'old', sourceId: 'old-source', recordedAt: backfillAt, stance: 'cautious', summary: '8月29日补录旧观点' },
  ];
  data.approvals = [
    { id: 'new-approval', observationId: 'new', decision: 'reviewed', recordedAt: '2026-09-18T09:00:00.000Z', note: '先审核新帖' },
    { id: 'old-approval', observationId: 'old', decision: 'reviewed', recordedAt: backfillApproved, note: '随后补录并审核旧帖' },
  ];
  return data;
}
function review(observationId: string, status: ViewpointReview['status'], recordedAt = backfillApproved, offsetDays: 5 | 20 | 60 = 5): ViewpointReview {
  return { id: `review-${observationId}-${offsetDays}`, observationId, status, offsetDays, recordedAt,
    triggerOccurred: 'unknown', invalidationOccurred: 'unknown', actualOutcome: '人工记录的后续表现', evidence: '人工核对依据', evidenceUrl: null, supersedesId: null };
}
describe('Creator chronology vs local knowledge chronology', () => {
  it('marks latest resolved state incomplete when an active unknown-time viewpoint may be newer', () => {
    const data = history(); data.sources[1].publishedAt = null; validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data, backfillApproved)[0]).toMatchObject({ observation: { id: 'new' }, effectiveAt: newerTime, chronologyHealth: 'incomplete', unresolvedObservationIds: ['old'] });
    expect(creatorEffectiveAt(data, data.observations[1])).toBeNull();
    expect(buildViewpointTimeline(data, backfillApproved).map(x => x.next.id)).toEqual(['new']);
  });
  it('does not block a later resolved state when capture upper bound proves unknown-time source older', () => {
    const data = history(); data.sources[1].publishedAt = null; data.sources[1].capturedAt = olderTime; validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data, backfillApproved)[0]).toMatchObject({ observation: { id: 'new' }, chronologyHealth: 'resolved', unresolvedObservationIds: [] });
    data.sources[1].capturedAt = newerTime;
    expect(buildCreatorCurrentViews(data, backfillApproved)[0].chronologyHealth).toBe('resolved');
  });
  it('resolves uncertainty only after reviewed source-time correction and retains earlier knowledge health', () => {
    const data = history(); data.sources[1].publishedAt = null;
    data.sources.push({ ...data.sources[1], id: 'corrected-source', supersedesId: 'old-source', publishedAt: backfillAt, capturedAt: correctionAt, recordedAt: correctionAt });
    data.observations.push({ ...data.observations[1], id: 'corrected', sourceId: 'corrected-source', supersedesId: 'old', revisionReason: '核对来源时区和时间', recordedAt: correctionAt });
    validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data, correctionAt)[0].chronologyHealth).toBe('incomplete');
    data.approvals.push({ id: 'correction-approval', observationId: 'corrected', decision: 'reviewed', recordedAt: correctionAt, note: '来源时间已核对' });
    validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data, correctionAt)[0]).toMatchObject({ observation: { id: 'corrected' }, effectiveAt: backfillAt, chronologyHealth: 'resolved', unresolvedObservationIds: [] });
    expect(buildCreatorCurrentViews(data, backfillApproved)[0].chronologyHealth).toBe('incomplete');
    expect(data.observations).toHaveLength(3);
  });
  it('does not leak uncertainty from future capture, recording, approval or rejected observations', () => {
    const data = history(); data.sources[1].publishedAt = null;
    for (const asOf of [newerTime, '2026-09-18T23:00:00Z', backfillAt]) {
      expect(buildCreatorCurrentViews(data, asOf).every(row => row.chronologyHealth === 'resolved' && row.unresolvedObservationIds.length === 0)).toBe(true);
    }
    expect(buildCreatorCurrentViews(data, backfillApproved)[0].chronologyHealth).toBe('incomplete');
    data.approvals[1].decision = 'rejected'; validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data, correctionAt)[0].chronologyHealth).toBe('resolved');
  });
  it('backfills Aug29 after Sep18 approval without rolling Current View back', () => {
    const data = history(); validateCreatorViewpointData(data);
    const end = '2026-09-21T00:00:00Z';
    expect(visibleViewpointObservations(data, end).map(x => x.id)).toEqual(['old', 'new']);
    const transitions = buildViewpointTimeline(data, end);
    expect(transitions.map(x => x.next.id)).toEqual(['old', 'new']);
    expect(transitions[1].previous?.id).toBe('old');
    expect(transitions.map(x => x.effectiveAt)).toEqual([olderTime, newerTime]);
    expect(transitions[0].recordedAt).toBe(backfillApproved);
    expect(buildCreatorCurrentViews(data, end)[0]).toMatchObject({ effectiveAt: newerTime, observation: { id: 'new' }, reviewedAt: '2026-09-18T09:00:00.000Z' });
  });
  it('knowledge As-of excludes the later discovered old post; approval gates formal history separately', () => {
    const data = history();
    expect(visibleViewpointObservations(data, '2026-09-18T23:00:00Z').map(x => x.id)).toEqual(['new']);
    expect(buildViewpointTimeline(data, '2026-09-18T23:00:00Z').map(x => x.next.id)).toEqual(['new']);
    expect(buildViewpointTimeline(data, '2026-09-19T08:30:00Z').map(x => x.next.id)).toEqual(['new']);
    expect(buildViewpointReviews(data, '2026-09-19T08:30:00Z').every(x => x.observationId === 'new')).toBe(true);
    expect(buildViewpointTimeline(data, backfillApproved).map(x => x.next.id)).toEqual(['old', 'new']);
  });
  it('handles out-of-order observation arrays using creator time, not append order', () => {
    const data = history(); data.observations.reverse(); validateCreatorViewpointData(data);
    expect(buildCreatorCurrentViews(data)[0].observation.id).toBe('new');
    expect(buildViewpointTimeline(data).map(x => x.next.id)).toEqual(['old', 'new']);
  });
  it('revisions of an old post replace only its interpretation at that creator time and preserve audit history', () => {
    const data = history();
    data.observations.push({ ...data.observations[1], id: 'old-correction', stance: 'negative', supersedesId: 'old', revisionReason: '纠正旧帖摘录', recordedAt: correctionAt });
    expect(buildViewpointTimeline(data).map(x => x.next.id)).toEqual(['old', 'new']);
    data.approvals.push({ id: 'corrected-approval', observationId: 'old-correction', recordedAt: correctionAt, decision: 'reviewed', note: '仅修订旧记录' });
    validateCreatorViewpointData(data);
    expect(buildViewpointTimeline(data, correctionAt).map(x => x.next.id)).toEqual(['old-correction', 'new']);
    expect(buildViewpointTimeline(data, backfillApproved)[0].next.stance).toBe('cautious');
    expect(buildViewpointTimeline(data, correctionAt)[0].next.stance).toBe('negative');
    expect(buildCreatorCurrentViews(data, correctionAt)[0].observation.id).toBe('new');
    expect(visibleViewpointObservations(data, correctionAt).map(x => x.id)).toContain('old');
    expect(viewpointChronologyStatus(data, data.observations[1], correctionAt)).toBe('superseded');
    expect(data.approvals).toHaveLength(3);
  });
  it('source-time correction takes effect only when the linked observation revision is approved', () => {
    const data = history();
    data.sources.push({ ...data.sources[1], id: 'corrected-source', supersedesId: 'old-source', publishedAt: '2026-09-01T08:00:00.000Z', capturedAt: correctionAt, recordedAt: correctionAt });
    data.observations.push({ ...data.observations[1], id: 'corrected-date', sourceId: 'corrected-source', supersedesId: 'old', revisionReason: '精确来源时间校正', recordedAt: correctionAt });
    data.approvals.push({ id: 'date-approval', observationId: 'corrected-date', decision: 'reviewed', note: '核对原来源时间', recordedAt: correctionAt });
    validateCreatorViewpointData(data);
    expect(buildViewpointTimeline(data, backfillApproved)[0].effectiveAt).toBe(olderTime);
    expect(buildViewpointTimeline(data, correctionAt)[0].effectiveAt).toBe('2026-09-01T08:00:00.000Z');
    expect(buildCreatorCurrentViews(data, correctionAt)[0].effectiveAt).toBe(newerTime);
  });
  it('does not invent creator time from captured/recorded/approved or unzoned labels', () => {
    const data = history(); data.sources[1].publishedAt = null; data.sources[1].publishedAtLabel = '8月29日 16:00，时区未证实';
    validateCreatorViewpointData(data);
    expect(creatorEffectiveAt(data, data.observations[1])).toBeNull();
    expect(viewpointChronologyStatus(data, data.observations[1])).toBe('unknown_time');
    expect(buildViewpointTimeline(data).map(x => x.next.id)).toEqual(['new']);
    expect(buildCreatorCurrentViews(data)[0].observation.id).toBe('new');
    expect(buildViewpointReviews(data).filter(x => x.observationId === 'old')).toEqual([5, 20, 60].map(offsetDays => ({ observationId: 'old', offsetDays, anchorAt: null, dueAt: null, chronology: 'unresolved', basis: 'calendar_days', result: null })));
  });
});
describe('Historical T+ evaluation and external-event source verification', () => {
  it('historical backfill immediately has elapsed T+5/T+20 while retaining actual manual review time', () => {
    const data = history(); data.reviews = [review('old', 'completed', backfillApproved, 5), review('old', 'inconclusive', backfillApproved, 20)];
    validateCreatorViewpointData(data);
    const due = buildViewpointReviews(data).filter(x => x.observationId === 'old');
    expect(due.map(x => x.dueAt)).toEqual(['2026-09-03T08:00:00.000Z', '2026-09-18T08:00:00.000Z', '2026-10-28T08:00:00.000Z']);
    expect(due[0].result?.recordedAt).toBe(backfillApproved);
    expect(due[1].result?.recordedAt).toBe(backfillApproved);
    expect(buildViewpointReviews(data, '2026-09-18T23:00:00Z').every(x => x.result === null)).toBe(true);
  });
  it.each(['completed', 'inconclusive'] as const)('rejects early %s for a current new post, accepts pending only', status => {
    const data = history(); data.reviews.push(review('new', status));
    expect(() => validateCreatorViewpointData(data)).toThrow(/周期未满/);
    data.reviews[0].status = 'pending'; validateCreatorViewpointData(data);
  });
  it.each(['completed', 'inconclusive'] as const)('rejects %s with unresolved creator anchor even long after approval', status => {
    const data = history(); data.sources[1].publishedAt = null; data.reviews.push(review('old', status, '2027-01-01T00:00:00Z'));
    expect(() => validateCreatorViewpointData(data)).toThrow(/观点时间未知/);
    data.reviews[0].status = 'pending'; validateCreatorViewpointData(data);
  });
  it('accepts at the exact creator horizon boundary and rejects one millisecond before', () => {
    const data = history(); data.reviews.push(review('new', 'inconclusive', '2026-09-23T07:59:59.999Z'));
    expect(() => validateCreatorViewpointData(data)).toThrow(/周期未满/);
    data.reviews[0].recordedAt = '2026-09-23T08:00:00.000Z'; validateCreatorViewpointData(data);
  });
  it('allows source-level verified with explicit source without promoting commentary or claims', () => {
    const data = history(); data.events[0].verificationStatus = 'verified'; validateCreatorViewpointData(data);
    expect(data.semanticClass).toBe('external_commentary'); expect(data.events[0].eventType).toBe('macro_external');
    data.events[0].sourceUrl = null; expect(() => validateCreatorViewpointData(data)).toThrow(/来源级 verified/);
    Object.assign(data.events[0], { verificationStatus: 'provider_admitted' }); expect(() => validateCreatorViewpointData(data)).toThrow();
  });
});
