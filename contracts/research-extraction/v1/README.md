# Research Source / Extraction V1

Additive L0/L1 **read contract**, PENDING TARGETED RE-REVIEW after the third-party author attribution fix. Does not modify `contracts/v1`, F2, permissions, Provider authority or frozen F3 V1.

- `research-extraction.schema.json`: owner-neutral, closed, versioned SourceRef / ExtractionRef / Source / Extraction shapes. Registry identity references the existing `RegistryEntry.entityType`, including `macro_metric`.
- `creator-projection.schema.json`: stricter profile for the first supported source domain; contract tests validate every actual projection against both schemas.
- `src/types/researchExtraction.ts`: typed read contract and adapter/repository ports.
- `src/services/creatorResearchAdapter.ts`: authoritative projection, exact owner dereference and owner-equivalence validation.
- `src/services/researchExtractionRepository.ts`: reads the original local-first Creator repository; no native store or write methods.

Validation has **two gates**: schema shape, then exact owner equivalence at an explicit knowledge cutoff. Schema-valid metadata alone is not provenance, review evidence, a retained byte pin or strict PIT certification. Only the Creator domain has an implemented adapter. Unknown domains fail closed; adding another domain needs its own reviewed owner mapping and contract. Arbitrary strings/blobs cannot self-register owners.

`ViewpointObservation` is the persisted immutable extraction. `ViewpointApproval` is the append-only review authority; absent approval means draft, rejection stays rejected. Re-review requires a new observation revision. `successor` denotes a visible structural revision, **not** approval or a replacement Current View. All original versions remain individually addressable. Source/Observation forks are rejected at this seam.

Tracked Creator context is separate from actual source authorship: `verified_self`/`unverified` keep the Creator author projection; `other` has L0 `authorRef=null` and L1 `author={type:unknown, ref:null, identity:other}`, without `author.creatorId`. Source `provenance.creatorId`, Extraction `creatorContext.creatorId` and the raw trace's `creator` retain the tracked discussion context. Both schemas constrain these combinations; owner-equivalence still rejects schema-valid identity relabeling. The original owner validator continues rejecting `other + reviewed`. No third-party author registry or inferred identity is introduced. Rebuild old serialized projections from their original owner before reuse.

Creator metadata does not contain extractor/model attribution; it stays `unknown`/null. The common contract provides an immutable `DRAFT_EXTRACTION_REVIEW` initial state and requires AI author/extractor output to retain `ai_draft` origin, including after quality review. Reviewed/rejected read models require an owner approval reference and exact review time; draft requires both to be null. AI/native extraction ingestion/storage is not implemented and cannot be injected into the Creator profile or mislabeled as reviewed Creator knowledge. No Provider Fact, Verified Claim or Thesis extraction output exists here.

Common V1 findings are a finite discriminated union: viewpoint, relationship, fact_candidate, driver, catalyst, risk, invalidation and open_question; statements are text, not arbitrary JSON. The Creator profile only emits what its owner actually contains: viewpoint (summary, reasoning, stance, horizon, trigger, confirmation, invalidation) and typed event relationship. No parser invents other findings. Entity/industry mapping is `not_provided` in Creator; topics, including macro topics, remain exact topic refs and are never auto-resolved to Entity IDs. Other adapters must establish and validate their own identity mapping, availability, byte digests and reference authority before use; common schema acceptance alone does none of these.

Run `npm run contracts:validate`, `npm run test:contracts`, `npm test`. Design, reuse/delta and acceptance evidence: [Slice 1](../../../docs/stage-4-3-slice-1-source-extraction.md).
