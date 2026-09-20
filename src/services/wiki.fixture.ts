/** Synthetic acceptance data only. Never imported by the production Workspace. */
import type { WikiData, WikiOwners, WikiRevision, WikiReview } from '../types/wiki';
import { createCreatorResearchAdapter, creatorSourceRef, creatorExtractionRef } from './creatorResearchAdapter';
import { creatorViewpointFixture, fixtureTime } from './creatorViewpoint.fixture';
import { emptyWikiData, emptyWikiRelatedRefs, wikiRequire } from './wiki';
export const wikiTime = fixtureTime;
export function wikiRevision(wikiId = 'wiki-one', revisionId = 'revision-one', day = 4): WikiRevision {
  return { schemaVersion: 'wiki-revision.v1', wikiId, revisionId, title: '合成框架', summary: 'Synthetic summary', bodyMarkdown: 'Synthetic body. No investment claim.',
    sourceRefs: [creatorSourceRef('source-1')], extractionRefs: [creatorExtractionRef('observation-1')], evidenceRefs: [], wikiRefs: [], relatedRefs: emptyWikiRelatedRefs(),
    tags: ['synthetic'], aliases: ['测试框架'], authorType: 'ai', createdAt: wikiTime(day), asOf: wikiTime(day), supersedes: null, revisionReason: 'Synthetic initial revision' };
}
export function wikiReview(revision: WikiRevision, day = 5, decision: WikiReview['decision'] = 'reviewed'): WikiReview {
  const reviewId = `review-${revision.revisionId}-${day}`;
  return { schemaVersion: 'wiki-review.v1', reviewId, wikiId: revision.wikiId, revisionId: revision.revisionId, decision,
    reviewerType: 'user', approvalRef: { owner: 'WikiReview', approvalId: reviewId }, createdAt: wikiTime(day), note: 'Synthetic quality review', supersedes: null };
}
export function wikiFixture(): WikiData {
  const data = emptyWikiData(); data.entries.push({ schemaVersion: 'wiki-entry.v1', wikiId: 'wiki-one', type: 'FRAMEWORK', createdAt: wikiTime(4) });
  data.revisions.push(wikiRevision()); data.reviews.push(wikiReview(data.revisions[0])); return data;
}
export const wikiFixtureOwners = (): WikiOwners => ({
  research: asOf => createCreatorResearchAdapter(creatorViewpointFixture(), asOf),
  evidence() { throw new Error('SYNTHETIC_EVIDENCE_MISSING'); },
  related(refs) { wikiRequire(!refs.entities.length && !refs.industryIds.length && !refs.topicRefs.length, 'SYNTHETIC_RELATED_REF_MISSING'); },
});
