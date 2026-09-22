import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import entitySchema from '../../contracts/v1/entity-resolution.v1.schema.json';
import commonSchema from '../../contracts/research-extraction/v1/research-extraction.schema.json';
import type { ResearchSource, ResearchExtraction } from '../types/researchExtraction';
import type { StorageLike } from './watchlistRepository';
import { creatorViewpointFixture } from './creatorViewpoint.fixture';
import { createCreatorResearchAdapter, creatorExtractionRef, creatorSourceRef } from './creatorResearchAdapter';
import { composeResearchAdapters } from './browserSourceAdapter';
import { BrowserWikiRepository, WIKI_STORAGE_KEY, WIKI_BACKUP_FORMAT } from './wikiRepository';
import { createWikiOwners } from './wikiOwners';
import { buildWikiReadModel, emptyWikiRelatedRefs } from './wiki';
import { wikiFixture, wikiRevision, wikiReview, wikiTime as at } from './wiki.fixture';
import { loadIndustryMetrics } from './industryMetricProvider';

const ajv = new Ajv2020({ strict: true, strictRequired: false, ownProperties: true });
addFormats(ajv); ajv.addSchema(entitySchema);
const common = ajv.compile(commonSchema);
const externalDomains = ['synthetic_notion', 'synthetic_drive', 'synthetic_broker_report', 'synthetic_ai'] as const;
const creatorOwner = { load: () => ({ data: creatorViewpointFixture(), error: null, corruptedRaw: null }) };
class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function externalSource(domain: string): ResearchSource {
  return {
    schemaVersion: 'research-source.v1', ref: { schemaVersion: 'research-source-ref.v1', sourceDomain: domain, sourceId: 'synthetic-1' },
    sourceType: 'note', semanticClass: 'source_material', relatedRefs: emptyWikiRelatedRefs(),
    provenance: { owner: domain, authorRef: null, url: `https://example.invalid/${domain}/synthetic-1` },
    publishedAt: null, capturedAt: at(2), recordedAt: at(2), asOf: at(10), completeness: 'UNVERIFIED',
    uncertainty: ['unknown_publication', 'unverified_source'], contentRef: null, digest: null, revision: { supersedes: null, successor: null },
  };
}

describe('R0 external context cannot acquire Dashboard authority (local synthetic regression)', () => {
  it('rejects Provider Fact and Verified Claim labels on every external source shape', () => {
    for (const domain of externalDomains) {
      const source = externalSource(domain);
      expect(common(source)).toBe(true);
      for (const semanticClass of ['provider_fact', 'verified_claim']) expect(common({ ...source, semanticClass })).toBe(false);
    }
  });

  it('keeps reviewed AI extraction as ai_draft and refuses authority relabeling', () => {
    const source = externalSource('synthetic_ai');
    const extraction: ResearchExtraction = {
      schemaVersion: 'research-extraction.v1', ref: { schemaVersion: 'research-extraction-ref.v1', sourceDomain: 'synthetic_ai', extractionId: 'synthetic-1' },
      sourceRefs: [source.ref], semanticClass: 'ai_draft', relatedRefs: emptyWikiRelatedRefs(), author: { type: 'ai', ref: null },
      extractor: { type: 'ai', method: 'synthetic', version: '1' }, adapterVersion: 'synthetic-only.v1', createdAt: at(3), effectiveAt: null, asOf: at(10),
      findings: [{ kind: 'fact_candidate', statement: 'Synthetic external claim; no verified fact.' }], completeness: 'UNVERIFIED', uncertainty: ['unknown_publication'],
      review: { status: 'reviewed', approvalRef: { owner: 'SyntheticReview', approvalId: 'synthetic-1' }, reviewedAt: at(4) },
      revision: { supersedes: null, successor: null, reason: null },
    };
    expect(common(extraction)).toBe(true);
    for (const semanticClass of ['provider_fact', 'verified_claim', 'user_judgement']) expect(common({ ...extraction, semanticClass })).toBe(false);
    const adapter = composeResearchAdapters([createCreatorResearchAdapter(creatorViewpointFixture(), at(10))], at(10));
    expect(() => adapter.validateExtraction(extraction)).toThrow(/未知资料来源/);
  });

  it('rejects shape-valid unregistered external refs at composite resolution and Wiki import without writes', () => {
    const storage = new MemoryStorage(), owners = createWikiOwners(creatorOwner);
    const repo = new BrowserWikiRepository(storage, owners, () => new Date(at(10))), base = repo.load().data;
    const adapter = composeResearchAdapters([owners.research(at(10))], at(10));
    for (const domain of externalDomains) {
      const source = externalSource(domain), data = wikiFixture();
      expect(common(source)).toBe(true);
      expect(() => adapter.resolveSource(source.ref)).toThrow(/未知资料来源/);
      data.revisions[0].sourceRefs = [source.ref]; data.revisions[0].extractionRefs = [];
      const backup = repo.export(data); // Schema validity does not register an owner.
      expect(() => repo.import(base, backup, true)).toThrow(/REF_INVALID/);
      expect(storage.values.size).toBe(0);
    }
  });

  it('preserves reviewed legacy Wiki as research_memory and ai_draft', () => {
    const data = wikiFixture(), before = JSON.stringify(data), owners = createWikiOwners(creatorOwner);
    const page = buildWikiReadModel(data, owners, at(10)).pages[0];
    expect(page).toMatchObject({ status: 'reviewed', authority: 'research_memory', origin: 'ai_draft' });
    expect(page.revision).toEqual(data.revisions[0]);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('reads legacy version history and exports backup without rewriting exact storage bytes or creating another store', () => {
    const data = wikiFixture(), next = { ...wikiRevision('wiki-one', 'revision-two', 6), supersedes: 'revision-one' };
    data.revisions.push(next); data.reviews.push(wikiReview(next, 7));
    const raw = JSON.stringify(data, null, 2) + '\n', storage = new MemoryStorage(), owners = createWikiOwners(creatorOwner);
    storage.setItem(WIKI_STORAGE_KEY, raw);
    const repo = new BrowserWikiRepository(storage, owners, () => new Date(at(10)));
    const loaded = repo.load(); expect(loaded.error).toBeNull(); expect(loaded.data).toEqual(data);
    const backup = repo.export(loaded.data), envelope = JSON.parse(backup);
    expect(envelope).toMatchObject({ format: WIKI_BACKUP_FORMAT, data: { schemaVersion: 'wiki.v1' } });
    expect(envelope.data).toEqual(data);
    expect(repo.previewImport(backup, loaded.data)).toMatchObject({ addCount: 0, skipCount: 5 });
    expect(buildWikiReadModel(loaded.data, owners, at(5)).pages[0].revision.revisionId).toBe('revision-one');
    expect(buildWikiReadModel(loaded.data, owners, at(10)).pages[0].revision.revisionId).toBe('revision-two');
    expect(new BrowserWikiRepository(storage, owners).load().data).toEqual(data);
    expect([...storage.values]).toEqual([[WIKI_STORAGE_KEY, raw]]);
  });

  it('refuses external mirror bodies and extra authority fields in the existing backup contract', () => {
    const storage = new MemoryStorage(), repo = new BrowserWikiRepository(storage, createWikiOwners(creatorOwner), () => new Date(at(10)));
    const base = repo.load().data;
    for (const target of ['envelope', 'revision', 'sourceRef']) {
      const envelope = JSON.parse(repo.export(wikiFixture()));
      const row = target === 'envelope' ? envelope : target === 'revision' ? envelope.data.revisions[0] : envelope.data.revisions[0].sourceRefs[0];
      row.externalMirrorBody = { url: 'https://example.invalid/mirror', body: 'Synthetic external page', authority: 'verified_claim' };
      expect(() => repo.import(base, JSON.stringify(envelope), true)).toThrow(/WIKI_BACKUP_FORMAT|WIKI_SCHEMA/);
    }
    expect(storage.values.size).toBe(0);
  });

  it('retains exact Creator owner attribution and rejects unavailable owners and future refs', () => {
    const owners = createWikiOwners(creatorOwner), adapter = owners.research(at(10));
    const original = adapter.resolveExtraction(creatorExtractionRef('observation-1'));
    const forged = { ...original, author: { ...original.author, creatorId: 'creator-2', ref: { owner: 'Creator', id: 'creator-2' } } };
    expect(common(forged)).toBe(true);
    expect(() => adapter.validateExtraction(forged)).toThrow(/OWNER_MISMATCH/);
    const past = createCreatorResearchAdapter(creatorViewpointFixture(), '2025-12-31T00:00:00.000Z');
    expect(() => past.resolveSource(creatorSourceRef('source-1'))).toThrow(/NOT_VISIBLE/);
    const unavailable = createWikiOwners({ load: () => ({ data: creatorViewpointFixture(), error: 'synthetic locked owner', corruptedRaw: 'synthetic' }) });
    expect(() => buildWikiReadModel(wikiFixture(), unavailable, at(10))).toThrow(/OWNER_UNAVAILABLE/);
  });

  it('retains Provider Evidence pin identity and time gates without promoting legacy Wiki authority', async () => {
    const state = await loadIndustryMetrics(); expect(state.status).toBe('available');
    if (state.status !== 'available') throw new Error(state.reason);
    const owners = createWikiOwners(creatorOwner, state.provider), cutoff = '2027-01-01T00:00:00.000Z';
    const evidence = owners.listEvidence(cutoff)[0]; expect(evidence).toBeDefined();
    expect(owners.evidence(evidence.ref, cutoff).evidence).toBe(evidence.evidence);
    for (const key of ['owner', 'objectId', 'version', 'sha256', 'locator'] as const) {
      expect(() => owners.evidence({ ...evidence.ref, [key]: key === 'sha256' ? '0'.repeat(64) : 'synthetic-foreign' }, cutoff)).toThrow(/MISSING_FOREIGN/);
    }
    expect(() => owners.evidence(evidence.ref, at(1))).toThrow(/NOT_VISIBLE/);
    expect(() => createWikiOwners(creatorOwner).evidence(evidence.ref, cutoff)).toThrow(/MISSING_FOREIGN/);
  });

  it('runs existing F2 owner and PIT gates: broken pins or unavailable release time cannot yield supported', () => {
    // Invoke the existing offline F2 checker in Node; no new policy or Verified Claim runtime.
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { assessGraph, resolvePin, vectors } from './scripts/contracts/financial-research.mjs';
      const original = resolvePin(vectors.find(v => v.caseId === 'closed-lineage').fixtureRef).graph;
      const request = { targetNodeId: 'claim', asOf: '2026-01-05T00:00:00Z' };
      assert.equal(assessGraph(original, request).outcome, 'supported');
      for (const mutate of [
        g => { g.nodes[0].ref.sha256 = '0'.repeat(64); },
        g => { g.nodes[0].releaseAvailableAt = null; },
        g => { g.nodes[0].releaseAvailableAt = '2026-01-06T00:00:00Z'; },
        g => { g.nodes.find(n => n.kind === 'fact').origin = 'ai_draft'; },
      ]) {
        const graph = structuredClone(original); mutate(graph);
        const result = assessGraph(graph, request);
        assert.equal(result.outcome, 'blocked'); assert.equal(result.selectedRefs.length, 0);
      }
      process.stdout.write('F2 boundary checks passed');
    `], { encoding: 'utf8' });
    expect(output).toBe('F2 boundary checks passed');
  });
});
