import { describe, expect, it } from 'vitest';
import { createWikiOwners } from './wikiOwners';
import { loadIndustryMetrics } from './industryMetricProvider';
import { creatorViewpointFixture } from './creatorViewpoint.fixture';
import { wikiFixture, wikiTime } from './wiki.fixture';
import { buildWikiReadModel, emptyWikiRelatedRefs } from './wiki';

describe('Wiki exact original owners', () => {
  const owner = { load: () => ({ data: creatorViewpointFixture(), error: null, corruptedRaw: null }) };
  it('retains actual Registry Evidence authority and all Pin identity dimensions', async () => {
    const state = await loadIndustryMetrics(); expect(state.status).toBe('available'); if (state.status !== 'available') throw new Error(state.reason);
    const owners = createWikiOwners(owner, state.provider), cutoff = '2027-01-01T00:00:00.000Z';
    const evidence = owners.listEvidence(cutoff)[0]; expect(evidence).toBeDefined(); const original = JSON.stringify(evidence.evidence);
    expect(owners.evidence(evidence.ref, cutoff).evidence).toBe(evidence.evidence); expect(evidence.audit.records).toHaveLength(1);
    const data = wikiFixture(); data.revisions[0].asOf = cutoff; data.revisions[0].createdAt = cutoff; data.reviews[0].createdAt = cutoff; data.revisions[0].evidenceRefs.push(evidence.ref);
    const page = buildWikiReadModel(data, owners, cutoff).pages[0]; expect(page.authority).toBe('research_memory'); expect(page.uncertainty.length).toBeGreaterThan(0);
    expect(JSON.stringify(evidence.evidence)).toBe(original);
    for (const key of ['owner', 'objectId', 'version', 'sha256', 'locator'] as const) expect(() => owners.evidence({ ...evidence.ref, [key]: 'foreign' }, cutoff)).toThrow(/MISSING_FOREIGN/);
    expect(() => owners.evidence(evidence.ref, wikiTime(1))).toThrow(/NOT_VISIBLE/);
  });
  it('does not infer Entity from topic labels and rejects unavailable owners', () => {
    const owners = createWikiOwners(owner);
    expect(() => owners.related({ ...emptyWikiRelatedRefs(), entities: [{ entityId: 'macro-name', entityType: 'macro_metric' }], identityMapping: 'owner_refs' }, wikiTime(8))).toThrow(/ENTITY_OWNER/);
    expect(() => owners.related({ ...emptyWikiRelatedRefs(), industryIds: ['foreign'], identityMapping: 'owner_refs' }, wikiTime(8))).toThrow(/INDUSTRY_REF/);
    expect(() => owners.related({ ...emptyWikiRelatedRefs(), topicRefs: [{ owner: 'foreign', topicId: 'a-shares' }] }, wikiTime(8))).toThrow(/TOPIC_REF/);
    expect(() => owners.related({ ...emptyWikiRelatedRefs(), topicRefs: [{ owner: 'creator_viewpoint_topic', topicId: 'a-shares' }] }, wikiTime(8))).not.toThrow();
    const unavailable = createWikiOwners({ load: () => ({ data: creatorViewpointFixture(), error: 'locked', corruptedRaw: 'bad' }) });
    expect(() => unavailable.research(wikiTime(8))).toThrow(/OWNER_UNAVAILABLE/);
  });
});
