/** Synthetic acceptance data only; never loaded by the production app. */
import type { CreatorViewpointData, ViewpointObservation } from '../types/creatorViewpoint';
import { createEmptyCreatorViewpointData } from './creatorViewpoint';

export const fixtureTime = (day: number) => `2026-01-${String(day).padStart(2, '0')}T10:00:00.000Z`;
export function creatorViewpointFixture(): CreatorViewpointData {
  const data = createEmptyCreatorViewpointData();
  for (let i = 1; i <= 3; i++) {
    data.creators.push({ id: `creator-${i}`, name: `合成研究者 ${i}`, profileUrl: null, recordedAt: fixtureTime(1) });
    data.sources.push({ id: `source-${i}`, creatorId: `creator-${i}`, kind: 'post', url: `https://example.com/post/${i}`,
      publishedAt: fixtureTime(1), publishedAtLabel: null, capturedAt: fixtureTime(1), recordedAt: fixtureTime(1),
      content: '合成测试摘录，不是任何真实博主观点。', parentSourceId: null, supersedesId: null,
      authorIdentity: 'unverified', identityEvidence: null, completeness: 'FULL', commentCoverage: i === 1 ? 'PARTIAL' : 'UNVERIFIED' });
  }
  data.events.push({ id: 'event-1', scope: 'external', eventType: 'macro_external', title: '合成政策事件', summary: '仅用于结构验证',
    publishedAt: fixtureTime(1), eventOccurredAt: fixtureTime(1), recordedAt: fixtureTime(1), sourceName: '合成来源',
    sourceUrl: 'https://example.com/event/1', verificationStatus: 'unverified', supersedesId: null });
  for (let i = 1; i <= 3; i++) {
    const observation: ViewpointObservation = { id: `observation-${i}`, creatorId: `creator-${i}`, topicId: 'a-shares', sourceId: `source-${i}`,
      recordedAt: fixtureTime(2), stance: i === 1 ? 'cautious' : i === 2 ? 'neutral' : 'positive', conditional: 'yes', horizon: null,
      summary: `合成观点 ${i}`, reasoning: '合成理由', trigger: '合成条件成立', confirmation: null, invalidation: '合成条件失效',
      eventLinks: [{ eventId: 'event-1', relation: (['explicit', 'inferred', 'temporal'] as const)[i - 1], explanation: '合成关联依据' }],
      supersedesId: null, revisionReason: null, important: true };
    data.observations.push(observation);
    data.approvals.push({ id: `approval-${i}`, observationId: observation.id, decision: 'reviewed', recordedAt: fixtureTime(3), note: '合成审核' });
  }
  return data;
}
