import { describe, expect, it } from 'vitest';
import type { CreatorViewpointData } from '../types/creatorViewpoint';
import type { CreatorResearchExtraction as ResearchExtraction, ResearchSourceRef } from '../types/researchExtraction';
import { creatorViewpointFixture, fixtureTime as at } from './creatorViewpoint.fixture';
import { buildCreatorCurrentViews, buildViewpointReviews, buildViewpointTimeline, validateCreatorViewpointData } from './creatorViewpoint';
import { createCreatorResearchAdapter, creatorExtractionRef as er, creatorSourceRef as sr } from './creatorResearchAdapter';
import { BrowserCreatorViewpointRepository, CREATOR_VIEWPOINT_STORAGE_KEY } from './creatorViewpointRepository';
import { CreatorResearchExtractionRepository } from './researchExtractionRepository';

const end = at(30);
function revised(data = creatorViewpointFixture(), approved = true) {
  data.sources.push({ ...data.sources[0], id: 'source-revision', supersedesId: 'source-1',
    content: '合成来源修订', publishedAt: at(4), capturedAt: at(4), recordedAt: at(4) });
  data.observations.push({ ...data.observations[0], id: 'observation-revision', sourceId: 'source-revision', supersedesId: 'observation-1',
    summary: '合成观点修订', revisionReason: '合成纠错', recordedAt: at(4) });
  if (approved) data.approvals.push({ id: 'approval-revision', observationId: 'observation-revision', decision: 'reviewed', note: '合成审核', recordedAt: at(5) });
  return data;
}
class MemoryStorage {
  values = new Map<string, string>(); writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function persisted(data = creatorViewpointFixture()) {
  const storage = new MemoryStorage(); storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(data));
  const owner = new BrowserCreatorViewpointRepository(storage, () => new Date(end));
  return { storage, owner, repo: new CreatorResearchExtractionRepository(owner) };
}

describe('L0 / L1 Creator owner adapter', () => {
  it('projects metadata without raw content and preserves exact owner trace', () => {
    const data = creatorViewpointFixture(); const adapter = createCreatorResearchAdapter(data, end);
    const source = adapter.resolveSource(sr('source-1'));
    expect(source).toMatchObject({ ref: sr('source-1'), sourceType: 'post', semanticClass: 'external_commentary',
      publishedAt: at(1), capturedAt: at(1), recordedAt: at(1), completeness: 'FULL', commentCoverage: 'PARTIAL', effectiveCoverage: 'PARTIAL',
      contentRef: { sourceRef: sr('source-1'), field: 'content' }, digest: null,
      relatedRefs: { entities: [], industryIds: [], topicRefs: [{ owner: 'creator_viewpoint_topic', topicId: 'a-shares' }] } });
    expect(JSON.stringify(adapter.listSources())).not.toContain(data.sources[0].content);
    expect(adapter.traceSource(source.ref)).toEqual({ source: data.sources[0], creator: data.creators[0] });
    const extraction = adapter.resolveExtraction(er('observation-1'));
    expect(extraction).toMatchObject({ sourceRefs: [sr('source-1')], semanticClass: 'external_commentary', createdAt: at(2), effectiveAt: at(1),
      author: { creatorId: 'creator-1', type: 'external_creator', identity: 'unverified' }, extractor: { type: 'unknown', method: null, version: null },
      review: { status: 'reviewed', approvalRef: { owner: 'ViewpointApproval', approvalId: 'approval-1' }, reviewedAt: at(3) } });
    expect(extraction.findings[0]).toMatchObject({ kind: 'viewpoint', summary: data.observations[0].summary, reasoning: data.observations[0].reasoning,
      state: { trigger: data.observations[0].trigger, invalidation: data.observations[0].invalidation } });
    expect(adapter.traceExtraction(extraction.ref)).toEqual({ source: data.sources[0], observation: data.observations[0], creator: data.creators[0],
      topic: data.topics[0], approval: data.approvals[0], events: data.events });
    adapter.listSources().forEach(row => adapter.validateSource(row)); adapter.listExtractions().forEach(row => adapter.validateExtraction(row));
  });

  it('retains explicit / inferred / temporal relationships without promoting them to facts', () => {
    const adapter = createCreatorResearchAdapter(creatorViewpointFixture(), end);
    expect(adapter.listExtractions().map(row => row.findings[1])).toEqual(['explicit', 'inferred', 'temporal'].map(relation => ({
      kind: 'relationship', target: { owner: 'ExternalResearchEvent', eventId: 'event-1' }, relation, explanation: '合成关联依据' })));
  });

  it('retains unknown publication/effective time and unknown method after approval', () => {
    const data = creatorViewpointFixture(); data.sources[0].publishedAt = null; data.sources[0].publishedAtLabel = '昨天，无可靠时区';
    const adapter = createCreatorResearchAdapter(data, end);
    expect(adapter.resolveSource(sr('source-1'))).toMatchObject({ publishedAt: null, publishedAtLabel: '昨天，无可靠时区' });
    expect(adapter.resolveExtraction(er('observation-1'))).toMatchObject({ effectiveAt: null, review: { status: 'reviewed' },
      creatorContext: { chronology: 'unknown_time', chronologyHealth: null } });
    expect(adapter.resolveExtraction(er('observation-1')).uncertainty).toContain('unknown_publication');
  });

  it('does not infer identity from macro Topic labels or make empty content a digest', () => {
    const data = creatorViewpointFixture(); data.observations[0].topicId = 'global-rates';
    data.sources[0].content = null; data.sources[0].completeness = 'UNVERIFIED';
    const adapter = createCreatorResearchAdapter(data, end);
    expect(adapter.resolveSource(sr('source-1'))).toMatchObject({ contentRef: null, digest: null, effectiveCoverage: 'UNVERIFIED' });
    expect(adapter.resolveExtraction(er('observation-1')).relatedRefs).toEqual({ entities: [], industryIds: [],
      topicRefs: [{ owner: 'creator_viewpoint_topic', topicId: 'global-rates' }], identityMapping: 'not_provided' });
  });

  it('keeps detached read sessions immutable without changing original owners', () => {
    const data = creatorViewpointFixture(); const original = JSON.stringify(data);
    const adapter = createCreatorResearchAdapter(data, end);
    expect(() => { adapter.resolveExtraction(er('observation-1')).review.status = 'rejected'; }).toThrow();
    expect(() => { adapter.traceSource(sr('source-1')).source.content = 'replacement'; }).toThrow();
    expect(JSON.stringify(data)).toBe(original);
    data.observations[0].summary = 'caller mutation';
    expect(adapter.traceExtraction(er('observation-1')).observation.summary).toBe('合成观点 1');
  });

  it('is deterministic across repeated reads and unrelated owner ordering', () => {
    const data = creatorViewpointFixture(); const a = createCreatorResearchAdapter(data, end);
    data.creators.reverse(); data.topics.reverse(); data.sources.reverse(); data.observations.reverse();
    const b = createCreatorResearchAdapter(data, end);
    expect(b.listSources()).toEqual(a.listSources()); expect(b.listExtractions()).toEqual(a.listExtractions());
  });

  it.each(['source', 'extraction'] as const)('rejects malformed, foreign or missing %s refs', kind => {
    const adapter = createCreatorResearchAdapter(creatorViewpointFixture(), end);
    const resolve = (ref: unknown) => kind === 'source' ? adapter.resolveSource(ref as ResearchSourceRef) : adapter.resolveExtraction(ref as ResearchExtraction['ref']);
    const valid = kind === 'source' ? sr('source-1') : er('observation-1');
    for (const ref of [null, {}, { ...valid, schemaVersion: 'v2' }, { ...valid, sourceDomain: 'provider' }, { ...valid, injected: true },
      kind === 'source' ? sr('') : er(''), kind === 'source' ? sr('missing') : er('missing')]) expect(() => resolve(ref)).toThrow(/RESEARCH_/);
  });

  it.each(['source', 'creator', 'topic', 'event'] as const)('fails closed on missing %s owner', missing => {
    const data = creatorViewpointFixture();
    if (missing === 'source') data.sources.shift(); if (missing === 'creator') data.creators.shift();
    if (missing === 'topic') data.topics.shift(); if (missing === 'event') data.events = [];
    expect(() => createCreatorResearchAdapter(data, end)).toThrow();
  });

  it.each(['AI_DRAFT', 'ai_draft', 'provider_fact', 'verified_claim', 'thesis'])('rejects relabeling commentary to %s', semanticClass => {
    const adapter = createCreatorResearchAdapter(creatorViewpointFixture(), end);
    expect(() => adapter.validateExtraction({ ...adapter.resolveExtraction(er('observation-1')), semanticClass })).toThrow(/OWNER_MISMATCH/);
    expect(() => adapter.validateSource({ ...adapter.resolveSource(sr('source-1')), semanticClass })).toThrow(/OWNER_MISMATCH/);
  });

  it('rejects invented extractor attribution, changed text, fake review, identity mapping and PIT fields', () => {
    const data = creatorViewpointFixture(); data.approvals = []; const adapter = createCreatorResearchAdapter(data, end);
    const row = adapter.resolveExtraction(er('observation-1'));
    for (const delta of [{ extractor: { type: 'ai', method: 'llm', version: '1' } }, { findings: [] },
      { review: { status: 'reviewed', approvalRef: null, reviewedAt: at(3) } }, { relatedRefs: { entities: [{ entityId: 'guessed', entityType: 'macro_metric' }] } },
      { strictPit: true }, { verifiedClaim: true }]) expect(() => adapter.validateExtraction({ ...row, ...delta })).toThrow(/OWNER_MISMATCH/);
  });
});

describe('knowledge As-of and append-only revision', () => {
  it('filters later capture, recording, observation and approvals independently', () => {
    const data = creatorViewpointFixture();
    data.sources[0].capturedAt = at(4); data.sources[0].recordedAt = at(5);
    data.observations[0].recordedAt = at(6); data.approvals = [{ ...data.approvals[0], recordedAt: at(7) }];
    for (const day of [2, 4]) {
      const adapter = createCreatorResearchAdapter(data, at(day));
      expect(() => adapter.resolveSource(sr('source-1'))).toThrow(/NOT_VISIBLE/);
      expect(() => adapter.traceExtraction(er('observation-1'))).toThrow(/NOT_VISIBLE/);
    }
    const sourceOnly = createCreatorResearchAdapter(data, at(5));
    expect(sourceOnly.resolveSource(sr('source-1')).relatedRefs.topicRefs).toEqual([]);
    expect(() => sourceOnly.resolveExtraction(er('observation-1'))).toThrow(/NOT_VISIBLE/);
    const draft = createCreatorResearchAdapter(data, at(6));
    expect(draft.resolveExtraction(er('observation-1')).review).toEqual({ status: 'draft', approvalRef: null, reviewedAt: null });
    expect(draft.traceExtraction(er('observation-1')).approval).toBeNull();
    expect(createCreatorResearchAdapter(data, at(7)).resolveExtraction(er('observation-1')).review.status).toBe('reviewed');
  });

  it('does not leak future event publication through findings or trace', () => {
    const data = creatorViewpointFixture(); data.events[0].publishedAt = at(8); data.approvals = [];
    const adapter = createCreatorResearchAdapter(data, at(7));
    expect(adapter.listExtractions()).toEqual([]); expect(adapter.resolveSource(sr('source-1')).relatedRefs.topicRefs).toEqual([]);
    expect(() => adapter.traceExtraction(er('observation-1'))).toThrow(/NOT_VISIBLE/);
  });

  it.each(['draft', 'rejected'] as const)('%s never becomes reviewed knowledge', status => {
    const data = creatorViewpointFixture(); data.approvals = status === 'draft' ? [] : data.approvals.map(row => ({ ...row, decision: 'rejected' }));
    const adapter = createCreatorResearchAdapter(data, end);
    expect(adapter.listExtractions().map(row => row.review.status)).toEqual([status, status, status]);
    expect(adapter.listExtractions().every(row => row.creatorContext.chronologyHealth === null)).toBe(true);
  });

  it('keeps precise revisions distinct and reveals successors only after knowledge cutoff', () => {
    const data = revised(); const old = createCreatorResearchAdapter(data, at(3));
    expect(old.resolveSource(sr('source-1')).revision.successor).toBeNull();
    expect(old.resolveExtraction(er('observation-1')).revision.successor).toBeNull();
    const draft = createCreatorResearchAdapter(data, at(4));
    expect(draft.resolveExtraction(er('observation-revision')).review.status).toBe('draft');
    expect(draft.resolveExtraction(er('observation-1')).creatorContext.chronology).toBe('resolved');
    const after = createCreatorResearchAdapter(data, end);
    expect(after.resolveExtraction(er('observation-1'))).toMatchObject({ creatorContext: { chronology: 'superseded' }, revision: { successor: er('observation-revision') } });
    expect(after.resolveExtraction(er('observation-revision'))).toMatchObject({ sourceRefs: [sr('source-revision')], revision: { supersedes: er('observation-1'), reason: '合成纠错' } });
    expect(after.resolveSource(sr('source-revision')).revision.supersedes).toEqual(sr('source-1'));
    expect(after.traceExtraction(er('observation-1')).source.id).toBe('source-1');
    expect(after.traceExtraction(er('observation-revision')).source.id).toBe('source-revision');
  });

  it('rejects missing visible predecessor instead of silently erasing revision history', () => {
    const data = revised(creatorViewpointFixture(), false); data.approvals = [];
    data.events[0].publishedAt = at(10); data.observations[3].eventLinks = [];
    expect(() => createCreatorResearchAdapter(data, at(5))).toThrow(/RESEARCH_REVISION_NOT_VISIBLE/);
  });

  it.each(['sources', 'observations'] as const)('rejects %s revision forks even when Creator permits storing them', collection => {
    const data = revised();
    if (collection === 'sources') data.sources.push({ ...data.sources[3], id: 'source-fork' });
    else data.observations.push({ ...data.observations[3], id: 'observation-fork' });
    validateCreatorViewpointData(data);
    expect(() => createCreatorResearchAdapter(data, end)).toThrow(/RESEARCH_REVISION_FORK/);
  });

  it('rejects cycles, duplicate IDs and duplicate approvals through the original validator', () => {
    for (const mutate of [
      (d: CreatorViewpointData) => { d.sources[0].supersedesId = 'source-1'; },
      (d: CreatorViewpointData) => { d.observations.push(d.observations[0]); },
      (d: CreatorViewpointData) => { d.approvals.push({ ...d.approvals[0], id: 'second-approval' }); },
    ]) { const data = creatorViewpointFixture(); mutate(data); expect(() => createCreatorResearchAdapter(data, end)).toThrow(); }
  });

  it('preserves unresolved Current View health, and only reviewed correction resolves it', () => {
    const data = creatorViewpointFixture();
    data.sources.push({ ...data.sources[0], id: 'unknown-source', publishedAt: null, capturedAt: at(4), recordedAt: at(4) });
    data.observations.push({ ...data.observations[0], id: 'unknown-view', sourceId: 'unknown-source', recordedAt: at(4) });
    data.approvals.push({ id: 'unknown-approval', observationId: 'unknown-view', recordedAt: at(5), decision: 'reviewed', note: 'synthetic' });
    const beforeReview = createCreatorResearchAdapter(data, at(4));
    expect(beforeReview.resolveExtraction(er('observation-1')).creatorContext.chronologyHealth).toBe('resolved');
    const unresolved = createCreatorResearchAdapter(data, at(5));
    expect(unresolved.resolveExtraction(er('observation-1')).creatorContext).toEqual({ chronology: 'resolved', chronologyHealth: 'incomplete', unresolvedExtractionRefs: [er('unknown-view')] });
    expect(unresolved.resolveExtraction(er('unknown-view')).creatorContext.chronology).toBe('unknown_time');
    data.sources.push({ ...data.sources[3], id: 'fixed-source', supersedesId: 'unknown-source', publishedAt: at(4), capturedAt: at(6), recordedAt: at(6) });
    data.observations.push({ ...data.observations[3], id: 'fixed-view', sourceId: 'fixed-source', supersedesId: 'unknown-view', revisionReason: 'synthetic time correction', recordedAt: at(6) });
    expect(createCreatorResearchAdapter(data, at(6)).resolveExtraction(er('observation-1')).creatorContext.chronologyHealth).toBe('incomplete');
    data.approvals.push({ id: 'fixed-approval', observationId: 'fixed-view', recordedAt: at(7), decision: 'reviewed', note: 'synthetic correction' });
    expect(createCreatorResearchAdapter(data, at(7)).resolveExtraction(er('fixed-view')).creatorContext.chronologyHealth).toBe('resolved');
    expect(createCreatorResearchAdapter(data, at(5)).listExtractions()).toEqual(unresolved.listExtractions());
  });

  it('retains ambiguous chronology and parent coverage; cannot manufacture a current state', () => {
    const data = creatorViewpointFixture();
    data.sources.push({ ...data.sources[0], id: 'reply', kind: 'self_reply', parentSourceId: 'source-1', completeness: 'FULL', commentCoverage: 'FULL' });
    data.observations.push({ ...data.observations[0], id: 'contradiction', sourceId: 'reply', stance: 'negative' });
    data.approvals.push({ id: 'contradiction-approval', observationId: 'contradiction', decision: 'reviewed', recordedAt: at(3), note: 'synthetic' });
    const adapter = createCreatorResearchAdapter(data, end);
    expect(adapter.resolveSource(sr('reply'))).toMatchObject({ parentRef: sr('source-1'), effectiveCoverage: 'PARTIAL' });
    expect(adapter.resolveExtraction(er('contradiction')).creatorContext).toMatchObject({ chronology: 'ambiguous_time', chronologyHealth: null });
    expect(adapter.resolveExtraction(er('contradiction')).uncertainty).toContain('ambiguous_chronology');
  });
});

describe('Local-first read repository', () => {
  it('reloads owner changes without new keys or duplicate persisted Source/Extraction', () => {
    const { storage, owner, repo } = persisted(); const writes = storage.writes;
    const first = repo.read(end);
    expect(storage.writes).toBe(writes);
    const revisions = revised(); const base = owner.load().data;
    owner.append(base, { sources: [revisions.sources[3]], observations: [revisions.observations[3]], approvals: [revisions.approvals[3]] });
    const second = repo.read(end);
    expect(second.listExtractions()).toHaveLength(4); expect(first.listExtractions()).toHaveLength(3);
    expect([...storage.values.keys()]).toEqual([CREATOR_VIEWPOINT_STORAGE_KEY]);
    expect(JSON.parse(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)!).observations).toEqual(revisions.observations);
  });

  it('preserves references across duplicate import, conflict rejection and export/reload', () => {
    const { owner, repo } = persisted(revised()); const original = repo.read(end);
    const base = owner.load().data; const raw = owner.export(base);
    expect(owner.previewImport(raw, base).addCount).toBe(0);
    const imported = owner.import(base, raw, true);
    const conflicting = JSON.parse(raw); conflicting.data.observations[0].summary = 'conflict';
    expect(() => owner.import(imported, JSON.stringify(conflicting), true)).toThrow(/冲突/);
    expect(repo.read(end).listExtractions()).toEqual(original.listExtractions());
    expect(repo.read(end).listSources()).toEqual(original.listSources());
    const clean = new BrowserCreatorViewpointRepository(new MemoryStorage());
    clean.import(clean.load().data, raw, true);
    expect(new CreatorResearchExtractionRepository(clean).read(end).traceExtraction(er('observation-revision'))).toEqual(original.traceExtraction(er('observation-revision')));
  });

  it.each(['{broken', '{"schemaVersion":2}'])('fails closed on corrupt/unsupported owner storage %s', raw => {
    const { storage, repo } = persisted(); storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, raw); const writes = storage.writes;
    expect(() => repo.read(end)).toThrow(/RESEARCH_OWNER_UNAVAILABLE/);
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(raw); expect(storage.writes).toBe(writes);
  });

  it('only exposes recovered records after original confirmed recovery succeeds', () => {
    const { storage, owner, repo } = persisted(); const backup = owner.export(owner.load().data);
    storage.setItem(CREATOR_VIEWPOINT_STORAGE_KEY, '{broken');
    expect(() => repo.read(end)).toThrow();
    owner.recoverCorrupt(backup, '{broken', true);
    expect(repo.read(end).listExtractions()).toHaveLength(3);
    expect([...storage.values.values()]).toContain('{broken');
  });

  it('leaves original chronology, Current View and T+ Review behavior unchanged', () => {
    const data = revised(); const before = [buildCreatorCurrentViews(data, end), buildViewpointTimeline(data, end), buildViewpointReviews(data, end)];
    const { repo, owner } = persisted(data); repo.read(end);
    const loaded = owner.load().data;
    expect([buildCreatorCurrentViews(loaded, end), buildViewpointTimeline(loaded, end), buildViewpointReviews(loaded, end)]).toEqual(before);
  });

  it('rejects invalid cutoffs and unavailable storage', () => {
    const { repo } = persisted();
    for (const asOf of ['', '2026-01-01', '2026-02-30T00:00:00Z']) expect(() => repo.read(asOf)).toThrow(/RESEARCH_ASOF_INVALID/);
    expect(() => new CreatorResearchExtractionRepository(new BrowserCreatorViewpointRepository(null)).read(end)).toThrow(/RESEARCH_OWNER_UNAVAILABLE/);
  });
});
