import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../contracts/research-extraction/v1/creator-projection.schema.json';
import commonSchema from '../../contracts/research-extraction/v1/research-extraction.schema.json';
import entitySchema from '../../contracts/v1/entity-resolution.v1.schema.json';
import { DRAFT_EXTRACTION_REVIEW, type ResearchExtraction, type ResearchSource } from '../types/researchExtraction';
import { creatorViewpointFixture, fixtureTime as at } from './creatorViewpoint.fixture';
import { createCreatorResearchAdapter, creatorExtractionRef as er, creatorSourceRef as sr } from './creatorResearchAdapter';
import { validateCreatorViewpointData } from './creatorViewpoint';
import type { CreatorSource } from '../types/creatorViewpoint';

// Existing Entity schema uses parent declarations for conditional required fields, as in the V1 registry.
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, ownProperties: true });
addFormats(ajv); ajv.addSchema(entitySchema);
const common = ajv.compile(commonSchema); const validate = ajv.compile(schema);

function authorFixture(identity: CreatorSource['authorIdentity'], status: 'draft' | 'reviewed' | 'rejected') {
  const data = creatorViewpointFixture();
  const source = data.sources[0];
  // Synthetic third-party comment in a tracked Creator's discussion chain.
  data.sources.unshift({ ...source, id: 'discussion-parent' });
  source.kind = 'comment'; source.parentSourceId = 'discussion-parent'; source.authorIdentity = identity;
  source.identityEvidence = identity === 'verified_self' ? 'Synthetic self-identity check' : null;
  data.approvals = data.approvals.filter(row => row.observationId !== 'observation-1');
  if (status !== 'draft') data.approvals.push({ id: 'author-review', observationId: 'observation-1', decision: status, recordedAt: at(4), note: 'Synthetic review' });
  return data;
}

describe('versioned L0/L1 machine-readable contract', () => {
  it.each(['draft', 'rejected'] as const)('leaves other + %s actual author unassigned while preserving tracked Creator context', status => {
    const data = authorFixture('other', status);
    const adapter = createCreatorResearchAdapter(data, at(10));
    const source = adapter.resolveSource(sr('source-1')); const extraction = adapter.resolveExtraction(er('observation-1'));
    expect(source.provenance).toMatchObject({ creatorId: 'creator-1', authorIdentity: 'other', authorRef: null });
    expect(extraction.author).toEqual({ type: 'unknown', ref: null, identity: 'other' });
    expect(extraction.creatorContext.creatorId).toBe('creator-1'); expect(extraction.review.status).toBe(status);
    expect(source.uncertainty).toContain('other_author'); expect(extraction.uncertainty).toContain('other_author');
    for (const row of [source, extraction]) { expect(common(row)).toBe(true); expect(validate(row)).toBe(true); }
    adapter.validateSource(source); adapter.validateExtraction(extraction);
    expect(adapter.traceExtraction(extraction.ref)).toMatchObject({ creator: { id: 'creator-1' }, source: { id: 'source-1', authorIdentity: 'other', parentSourceId: 'discussion-parent' } });
    for (const authorRef of [{ owner: 'Creator', id: 'creator-1' }, { owner: 'ThirdParty', id: 'invented' }]) {
      const forged = { ...source, provenance: { ...source.provenance, authorRef } };
      expect(common(forged)).toBe(false); expect(validate(forged)).toBe(false);
      expect(() => adapter.validateSource(forged)).toThrow(/OWNER_MISMATCH/);
    }
    for (const author of [
      { ...extraction.author, type: 'external_creator' },
      { ...extraction.author, ref: { owner: 'Creator', id: 'creator-1' } },
      { ...extraction.author, creatorId: 'creator-1' },
    ]) {
      const forged = { ...extraction, author };
      expect(common(forged)).toBe(false); expect(validate(forged)).toBe(false);
      expect(() => adapter.validateExtraction(forged)).toThrow(/OWNER_MISMATCH/);
    }
    // A coherent but forged identity can pass shape validation; the owner remains authoritative.
    const relabeledSource = { ...source, provenance: { ...source.provenance, authorIdentity: 'unverified', authorRef: { owner: 'Creator', id: 'creator-1' } } };
    const relabeledExtraction = { ...extraction, author: { type: 'external_creator', identity: 'unverified', creatorId: 'creator-1', ref: { owner: 'Creator', id: 'creator-1' } } };
    for (const row of [relabeledSource, relabeledExtraction]) { expect(common(row)).toBe(true); expect(validate(row)).toBe(true); }
    expect(() => adapter.validateSource(relabeledSource)).toThrow(/OWNER_MISMATCH/);
    expect(() => adapter.validateExtraction(relabeledExtraction)).toThrow(/OWNER_MISMATCH/);
    expect(() => adapter.validateExtraction({ ...extraction, creatorContext: { ...extraction.creatorContext, creatorId: 'creator-2' } })).toThrow(/OWNER_MISMATCH/);
  });

  it.each(['verified_self', 'unverified'] as const)('preserves %s author projection and rejects schema-valid identity forgery', identity => {
    const adapter = createCreatorResearchAdapter(authorFixture(identity, 'reviewed'), at(10));
    const source = adapter.resolveSource(sr('source-1')); const extraction = adapter.resolveExtraction(er('observation-1'));
    expect(source.provenance.authorRef).toEqual({ owner: 'Creator', id: 'creator-1' });
    expect(extraction.author).toEqual({ type: 'external_creator', ref: { owner: 'Creator', id: 'creator-1' }, creatorId: 'creator-1', identity });
    expect(extraction.creatorContext.creatorId).toBe('creator-1');
    for (const row of [source, extraction]) { expect(common(row)).toBe(true); expect(validate(row)).toBe(true); }
    for (const row of [{ ...source, provenance: { ...source.provenance, authorRef: null } }, { ...extraction, author: { ...extraction.author, type: 'unknown', ref: null } }]) {
      expect(common(row)).toBe(false); expect(validate(row)).toBe(false);
    }
    const forgedSource = { ...source, provenance: { ...source.provenance, authorRef: { owner: 'Creator', id: 'creator-2' } } };
    const forgedExtraction = { ...extraction, author: { ...extraction.author, ref: { owner: 'Creator', id: 'creator-2' } } };
    for (const row of [forgedSource, forgedExtraction]) { expect(common(row)).toBe(true); expect(validate(row)).toBe(true); }
    expect(() => adapter.validateSource(forgedSource)).toThrow(/OWNER_MISMATCH/);
    expect(() => adapter.validateExtraction(forgedExtraction)).toThrow(/OWNER_MISMATCH/);
  });

  it('retains owner rejection of other + reviewed and also rejects relabeled projection review', () => {
    const data = authorFixture('other', 'reviewed');
    expect(() => validateCreatorViewpointData(data)).toThrow(/他人评论不能审核/);
    expect(() => createCreatorResearchAdapter(data, at(10))).toThrow(/他人评论不能审核/);
    const adapter = createCreatorResearchAdapter(authorFixture('other', 'rejected'), at(10));
    const extraction = adapter.resolveExtraction(er('observation-1'));
    const forged = { ...extraction, review: { ...extraction.review, status: 'reviewed' } };
    expect(common(forged)).toBe(false); expect(validate(forged)).toBe(false);
    expect(() => adapter.validateExtraction(forged)).toThrow(/OWNER_MISMATCH/);
  });

  it('preserves other-author As-of, exact trace, parent source and immutable revisions', () => {
    const data = authorFixture('other', 'rejected');
    const source = data.sources.find(row => row.id === 'source-1')!;
    source.publishedAt = null;
    data.sources.push({ ...source, id: 'other-revision', supersedesId: source.id, capturedAt: at(5), recordedAt: at(5) });
    data.observations.push({ ...data.observations[0], id: 'other-extraction-revision', sourceId: 'other-revision', supersedesId: 'observation-1', revisionReason: 'Synthetic correction', recordedAt: at(5) });
    data.approvals.push({ id: 'other-revision-review', observationId: 'other-extraction-revision', decision: 'rejected', recordedAt: at(6), note: 'Synthetic rejection' });
    const before = JSON.stringify(data);
    const past = createCreatorResearchAdapter(data, at(3));
    expect(past.resolveExtraction(er('observation-1'))).toMatchObject({ author: { type: 'unknown', ref: null }, effectiveAt: null, review: { status: 'draft' }, revision: { successor: null } });
    expect(past.traceExtraction(er('observation-1')).approval).toBeNull();
    expect(() => past.traceSource(sr('other-revision'))).toThrow(/NOT_VISIBLE/);
    const draftRevision = createCreatorResearchAdapter(data, at(5));
    expect(draftRevision.resolveExtraction(er('other-extraction-revision')).review.status).toBe('draft');
    const current = createCreatorResearchAdapter(data, at(6));
    expect(current.resolveSource(sr('other-revision'))).toMatchObject({ parentRef: sr('discussion-parent'), revision: { supersedes: sr('source-1') }, provenance: { creatorId: 'creator-1', authorRef: null } });
    expect(current.resolveExtraction(er('other-extraction-revision'))).toMatchObject({ author: { type: 'unknown', ref: null }, review: { status: 'rejected' }, effectiveAt: null,
      revision: { supersedes: er('observation-1') }, creatorContext: { creatorId: 'creator-1' } });
    expect(current.traceExtraction(er('observation-1')).source.id).toBe('source-1');
    expect(current.traceExtraction(er('other-extraction-revision')).source.id).toBe('other-revision');
    expect(current.traceSource(sr('discussion-parent')).source.authorIdentity).toBe('unverified');
    for (const row of [...current.listSources(), ...current.listExtractions()]) { expect(common(row)).toBe(true); expect(validate(row)).toBe(true); }
    expect(JSON.stringify(data)).toBe(before);
  });

  it.each(['draft', 'reviewed', 'rejected'] as const)('validates actual %s owner projections', status => {
    const data = creatorViewpointFixture();
    data.approvals = status === 'draft' ? [] : data.approvals.map(row => ({ ...row, decision: status }));
    data.sources[0].publishedAt = null;
    const adapter = createCreatorResearchAdapter(data, at(10));
    for (const value of [...adapter.listSources(), ...adapter.listExtractions()]) {
      expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
      expect(common(value), JSON.stringify(common.errors)).toBe(true);
    }
  });

  it.each(['provider_fact', 'verified_claim', 'thesis', 'ai_draft'])('does not accept %s as Creator commentary authority', semanticClass => {
    const adapter = createCreatorResearchAdapter(creatorViewpointFixture(), at(10));
    expect(validate({ ...adapter.resolveExtraction(er('observation-1')), semanticClass })).toBe(false);
  });

  it('forbids arbitrary payloads, empty sources, extra raw text, fake identity mapping and mutable status', () => {
    const adapter = createCreatorResearchAdapter(creatorViewpointFixture(), at(10));
    const extraction = adapter.resolveExtraction(er('observation-1'));
    for (const delta of [{ schemaVersion: 'research-extraction.v2' }, { findings: [{ arbitraryJson: {} }] }, { sourceRefs: [] },
      { content: 'copied raw source' }, { status: 'reviewed' }, { relatedRefs: { ...extraction.relatedRefs, entities: [{ entityType: 'macro', entityId: 'a-shares' }] } },
      { extractor: { type: 'ai', method: 'guessed model', version: '1' } }, { createdAt: '2026-01-01' }]) expect(validate({ ...extraction, ...delta })).toBe(false);
    expect(validate({ ...adapter.resolveSource(sr('source-1')), digest: 'invented digest' })).toBe(false);
  });

  it('requires an append-only approval reference/time for review or rejection, and none for draft', () => {
    const row = createCreatorResearchAdapter(creatorViewpointFixture(), at(10)).resolveExtraction(er('observation-1'));
    for (const review of [
      { status: 'reviewed', approvalRef: null, reviewedAt: null }, { status: 'rejected', approvalRef: null, reviewedAt: at(3) },
      { status: 'draft', approvalRef: row.review.approvalRef, reviewedAt: at(3) },
    ]) expect(validate({ ...row, review })).toBe(false);
  });

  it('schema-valid forgery still fails exact owner re-resolution', () => {
    const adapter = createCreatorResearchAdapter(creatorViewpointFixture(), at(10));
    const row = adapter.resolveExtraction(er('observation-1'));
    const forged = { ...row, review: { ...row.review, approvalRef: { owner: 'ViewpointApproval', approvalId: 'invented' } } };
    expect(validate(forged)).toBe(true);
    expect(() => adapter.validateExtraction(forged)).toThrow(/OWNER_MISMATCH/);
  });

  it('common contract expresses a non-Creator source without copying Creator fields or registering a runtime owner', () => {
    const source: ResearchSource = {
      schemaVersion: 'research-source.v1', ref: { schemaVersion: 'research-source-ref.v1', sourceDomain: 'synthetic_note', sourceId: 'note-1' },
      sourceType: 'note', semanticClass: 'user_judgement', relatedRefs: { entities: [], industryIds: [], topicRefs: [], identityMapping: 'not_provided' },
      provenance: { owner: 'SyntheticNote', authorRef: null, url: null }, publishedAt: null, capturedAt: null, recordedAt: at(1), asOf: at(10),
      completeness: 'UNVERIFIED', uncertainty: ['unknown_publication'], contentRef: null, digest: null, revision: { supersedes: null, successor: null },
    };
    expect(common(source), JSON.stringify(common.errors)).toBe(true);
    expect(validate(source)).toBe(false);
    expect(() => createCreatorResearchAdapter(creatorViewpointFixture(), at(10)).resolveSource(source.ref)).toThrow(/REF_INVALID/);
  });

  it('AI uses the immutable default draft, supports bounded findings, and retains AI origin even after quality review', () => {
    const source = createCreatorResearchAdapter(creatorViewpointFixture(), at(10)).resolveExtraction(er('observation-1'));
    const { creatorContext: _context, ...core } = source;
    const draft: ResearchExtraction = { ...core,
      ref: { schemaVersion: 'research-extraction-ref.v1', sourceDomain: 'synthetic_extraction', extractionId: 'ai-1' },
      semanticClass: 'ai_draft', author: { type: 'ai', ref: null }, extractor: { type: 'ai', method: 'synthetic', version: '1' },
      adapterVersion: 'synthetic-contract-only.v1', review: DRAFT_EXTRACTION_REVIEW,
      findings: [
        { kind: 'fact_candidate', statement: 'Synthetic reported figure; not verified.' }, { kind: 'driver', statement: 'Synthetic proposed driver.' },
        { kind: 'catalyst', statement: 'Synthetic catalyst.' }, { kind: 'risk', statement: 'Synthetic risk.' },
        { kind: 'invalidation', statement: 'Synthetic invalidation.' }, { kind: 'open_question', statement: 'Synthetic unresolved question.' },
      ],
    };
    expect(draft.review).toEqual({ status: 'draft', approvalRef: null, reviewedAt: null });
    expect(Object.isFrozen(DRAFT_EXTRACTION_REVIEW)).toBe(true);
    expect(common(draft), JSON.stringify(common.errors)).toBe(true);
    const reviewed = { ...draft, review: { status: 'reviewed', approvalRef: { owner: 'SyntheticReview', approvalId: 'review-1' }, reviewedAt: at(3) } };
    expect(common(reviewed), JSON.stringify(common.errors)).toBe(true);
    for (const semanticClass of ['external_commentary', 'user_judgement', 'provider_fact', 'verified_claim', 'thesis']) {
      expect(common({ ...reviewed, semanticClass })).toBe(false);
    }
    expect(common({ ...draft, review: { ...draft.review, status: 'reviewed' } })).toBe(false);
    expect(validate(draft)).toBe(false);
    expect(() => createCreatorResearchAdapter(creatorViewpointFixture(), at(10)).validateExtraction(draft)).toThrow(/REF_INVALID/);
  });

  it('reuses RegistryEntry macro_metric identity instead of aliasing it to macro', () => {
    const source = createCreatorResearchAdapter(creatorViewpointFixture(), at(10)).resolveSource(sr('source-1'));
    const mapped = { ...source, relatedRefs: { ...source.relatedRefs, identityMapping: 'owner_refs', entities: [{ entityType: 'macro_metric', entityId: 'synthetic-only' }] } };
    expect(common(mapped), JSON.stringify(common.errors)).toBe(true);
    expect(validate(mapped)).toBe(false); // Creator has no such mapping authority.
    mapped.relatedRefs.entities[0].entityType = 'macro'; expect(common(mapped)).toBe(false);
  });
});
