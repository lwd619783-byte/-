import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from '../../contracts/research-extraction/v1/creator-projection.schema.json';
import commonSchema from '../../contracts/research-extraction/v1/research-extraction.schema.json';
import entitySchema from '../../contracts/v1/entity-resolution.v1.schema.json';
import { DRAFT_EXTRACTION_REVIEW, type ResearchExtraction, type ResearchSource } from '../types/researchExtraction';
import { creatorViewpointFixture, fixtureTime as at } from './creatorViewpoint.fixture';
import { createCreatorResearchAdapter, creatorExtractionRef as er, creatorSourceRef as sr } from './creatorResearchAdapter';

// Existing Entity schema uses parent declarations for conditional required fields, as in the V1 registry.
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, ownProperties: true });
addFormats(ajv); ajv.addSchema(entitySchema);
const common = ajv.compile(commonSchema); const validate = ajv.compile(schema);

describe('versioned L0/L1 machine-readable contract', () => {
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
