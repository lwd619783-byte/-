import { describe, expect, it } from 'vitest';
import { buildWikiReadModel, resolveWikiRevision, searchWiki, validateWikiData, validateWikiReferences, wikiRevisionStatus } from './wiki';
import { wikiFixture, wikiFixtureOwners, wikiRevision, wikiReview, wikiTime as at } from './wiki.fixture';
import { creatorViewpointFixture } from './creatorViewpoint.fixture';
import { createCreatorResearchAdapter } from './creatorResearchAdapter';

describe('Wiki identity, history and read authority', () => {
  it('retains stable identity and AI origin after quality review, never fact/claim/thesis authority', () => {
    const data = wikiFixture(), model = buildWikiReadModel(data, wikiFixtureOwners(), at(8));
    expect(model.pages[0]).toMatchObject({ authority: 'research_memory', origin: 'ai_draft', status: 'reviewed', entry: { wikiId: 'wiki-one' }, completeness: 'PARTIAL' });
    data.revisions[0].title = 'Renamed title';
    expect(buildWikiReadModel(data, wikiFixtureOwners(), at(8)).pages[0].entry.wikiId).toBe('wiki-one');
    expect(Object.keys(data)).toEqual(['schemaVersion', 'entries', 'revisions', 'reviews']);
  });
  it('draft/rejected descendants never displace reviewed Current; historical cutoff filters approval', () => {
    const data = wikiFixture(), owners = wikiFixtureOwners();
    const next = { ...wikiRevision('wiki-one', 'revision-two', 6), supersedes: 'revision-one', title: 'Later draft' }; data.revisions.push(next);
    expect(buildWikiReadModel(data, owners, at(4)).pages).toEqual([]);
    expect(buildWikiReadModel(data, owners, at(9)).pages[0].revision.revisionId).toBe('revision-one');
    data.reviews.push(wikiReview(next, 7, 'rejected'));
    expect(buildWikiReadModel(data, owners, at(9)).pages[0].revision.revisionId).toBe('revision-one');
    const third = { ...wikiRevision('wiki-one', 'revision-three', 8), supersedes: 'revision-two' }; data.revisions.push(third); data.reviews.push(wikiReview(third, 9));
    expect(buildWikiReadModel(data, owners, at(8)).pages[0].revision.revisionId).toBe('revision-one');
    expect(buildWikiReadModel(data, owners, at(10)).pages[0].revision.revisionId).toBe('revision-three');
  });
  it('archive is append-only and never resurrects an earlier revision', () => {
    const data = wikiFixture(), second = { ...wikiRevision('wiki-one', 'revision-two', 6), supersedes: 'revision-one' };
    data.revisions.push(second); const review = wikiReview(second, 7); data.reviews.push(review);
    data.reviews.push({ ...wikiReview(second, 8, 'archived'), supersedes: review.reviewId });
    expect(buildWikiReadModel(data, wikiFixtureOwners(), at(7)).pages[0].revision.revisionId).toBe('revision-two');
    expect(buildWikiReadModel(data, wikiFixtureOwners(), at(9)).pages).toEqual([]);
    expect(wikiRevisionStatus(data, second.revisionId, at(9))).toBe('archived');
  });
  it.each(['duplicate', 'fork', 'foreign', 'cycle', 'time', 'review', 'approval', 'shape', 'future', 'grounding'])('rejects %s violations', violation => {
    const data = wikiFixture();
    if (violation === 'duplicate') data.entries.push(data.entries[0]);
    if (violation === 'fork') data.revisions.push(...['two', 'three'].map(id => ({ ...wikiRevision('wiki-one', id, 6), supersedes: 'revision-one' })));
    if (violation === 'foreign') data.reviews[0].wikiId = 'unknown';
    if (violation === 'cycle') data.revisions[0].supersedes = 'revision-one';
    if (violation === 'time') data.revisions[0].asOf = at(9);
    if (violation === 'review') data.reviews.push(wikiReview(data.revisions[0], 8, 'rejected'));
    if (violation === 'approval') data.reviews[0].approvalRef.approvalId = 'unknown';
    if (violation === 'shape') Object.assign(data.revisions[0], { authority: 'provider_fact' });
    if (violation === 'future') Object.assign(data, { schemaVersion: 'wiki.v2' });
    if (violation === 'grounding') { data.revisions[0].sourceRefs = []; data.revisions[0].extractionRefs = []; }
    expect(() => validateWikiData(data)).toThrow();
  });
  it('traces exact Extraction to Raw Source at revision cutoff, without copying either owner', () => {
    const data = wikiFixture(), owner = creatorViewpointFixture(), original = JSON.stringify(owner);
    const owners = { ...wikiFixtureOwners(), research: (asOf: string) => createCreatorResearchAdapter(owner, asOf) };
    const trace = resolveWikiRevision(data.revisions[0], owners);
    expect(trace.extractions[0].extraction.ref.extractionId).toBe('observation-1');
    const raw = createCreatorResearchAdapter(owner, at(4)).traceExtraction(trace.extractions[0].extraction.ref);
    expect(raw.source.id).toBe('source-1'); expect(raw.source.content).toContain('合成测试摘录');
    expect(trace.extractions[0].sources[0].ref).toEqual(data.revisions[0].sourceRefs[0]);
    expect(JSON.stringify(data)).not.toContain(raw.source.content!); expect(JSON.stringify(owner)).toBe(original);
  });
  it.each(['missing-source', 'foreign-source', 'missing-extraction', 'broken-wiki', 'foreign-related', 'cutoff'])('fails closed on %s refs', problem => {
    const data = wikiFixture(), owners = wikiFixtureOwners();
    if (problem === 'missing-source') data.revisions[0].sourceRefs[0].sourceId = 'missing';
    if (problem === 'foreign-source') data.revisions[0].sourceRefs[0].sourceDomain = 'foreign';
    if (problem === 'missing-extraction') data.revisions[0].extractionRefs[0].extractionId = 'missing';
    if (problem === 'broken-wiki') data.revisions[0].wikiRefs.push({ wikiId: 'missing' });
    if (problem === 'foreign-related') data.revisions[0].relatedRefs.topicRefs.push({ owner: 'foreign', topicId: 'x' });
    if (problem === 'cutoff') owners.research = () => createCreatorResearchAdapter(creatorViewpointFixture(), at(9));
    expect(() => validateWikiReferences(data, owners)).toThrow();
  });
  it('derives backlinks and orphans only from formal refs; search sorts score then stable ID', () => {
    const data = wikiFixture();
    for (const id of ['wiki-two', 'wiki-three']) { data.entries.push({ ...data.entries[0], wikiId: id }); const r = wikiRevision(id, `revision-${id}`); data.revisions.push(r); data.reviews.push(wikiReview(r)); }
    data.revisions[1].wikiRefs = [{ wikiId: 'wiki-one' }]; data.revisions[2].bodyMarkdown += ' [fake](wiki-one.md)';
    const model = buildWikiReadModel(data, wikiFixtureOwners(), at(8));
    expect(model.pages[0].backlinks).toEqual(['wiki-two']); expect(model.orphanWikiIds).toEqual(['wiki-three']);
    expect(searchWiki(model, 'synthetic').map(page => page.entry.wikiId)).toEqual(['wiki-one', 'wiki-three', 'wiki-two']);
    for (const query of ['合成框架', 'summary', '测试框架', 'synthetic', 'body', 'framework', 'not_provided']) expect(searchWiki(model, query)).toHaveLength(3);
    expect(searchWiki(model, 'synthetic', 'TOPIC')).toEqual([]);
    data.entries.reverse(); data.revisions.reverse(); data.reviews.reverse();
    expect(buildWikiReadModel(data, wikiFixtureOwners(), at(8))).toEqual(model);
  });
  it('refuses current links to a target without an active reviewed page', () => {
    const data = wikiFixture(); data.entries.push({ ...data.entries[0], wikiId: 'draft-target' }); data.revisions[0].wikiRefs = [{ wikiId: 'draft-target' }];
    expect(() => buildWikiReadModel(data, wikiFixtureOwners(), at(8))).toThrow(/TARGET_NOT_CURRENT/);
  });
});
