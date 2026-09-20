import type { Industry } from './index';
import type { RegistryEntry } from '../../local-core/domain/types';
import type { Coverage, CreatorSource, ViewpointState, ViewpointEventLink } from './creatorViewpoint';

/** Exact immutable owner IDs, not F2 byte pins or publication/PIT certification. */
export interface ResearchSourceRef {
  schemaVersion: 'research-source-ref.v1'; sourceDomain: string; sourceId: string;
}
export interface ResearchExtractionRef {
  schemaVersion: 'research-extraction-ref.v1'; sourceDomain: string; extractionId: string;
}
export interface ResearchTopicRef { owner: string; topicId: string }
export interface ResearchRelatedRefs {
  /** Original registry identity, including macro_metric; never inferred from Creator Topic labels. */
  entities: Array<Pick<RegistryEntry, 'entityId' | 'entityType'>>;
  industryIds: Industry['id'][];
  topicRefs: ResearchTopicRef[];
  identityMapping: 'not_provided' | 'owner_refs';
}
export type ResearchUncertainty = 'unknown_publication' | 'author_unverified' | 'other_author'
  | 'partial_source' | 'unverified_source' | 'extractor_unknown' | 'ambiguous_chronology' | 'incomplete_chronology';

export interface ResearchOwnerRef { owner: string; id: string }
export interface ResearchExtractionReview {
  status: 'draft' | 'reviewed' | 'rejected';
  approvalRef: { owner: string; approvalId: string } | null;
  reviewedAt: string | null;
}
/** Shared initial state, including AI extraction. Review needs an exact owner approval ref. */
export const DRAFT_EXTRACTION_REVIEW = Object.freeze({
  status: 'draft', approvalRef: null, reviewedAt: null,
} as const satisfies ResearchExtractionReview);

/** Owner-neutral L0 contract; concrete adapters must validate owner identity, types and refs. */
export interface ResearchSource {
  schemaVersion: 'research-source.v1'; ref: ResearchSourceRef; sourceType: string;
  semanticClass: 'source_material' | 'external_commentary' | 'user_judgement' | 'ai_draft';
  relatedRefs: ResearchRelatedRefs;
  provenance: { owner: string; authorRef: ResearchOwnerRef | null; url: string | null };
  publishedAt: string | null; capturedAt: string | null; recordedAt: string; asOf: string;
  completeness: Coverage; uncertainty: ResearchUncertainty[];
  contentRef: { sourceRef: ResearchSourceRef; field: string } | null;
  digest: { algorithm: 'sha256'; value: string } | null;
  revision: { supersedes: ResearchSourceRef | null; successor: ResearchSourceRef | null };
}

/** Ephemeral Creator metadata. Raw content is dereferenced through the original repository. */
export interface CreatorResearchSource extends ResearchSource {
  schemaVersion: 'research-source.v1'; ref: ResearchSourceRef; sourceType: CreatorSource['kind'];
  semanticClass: 'external_commentary'; relatedRefs: ResearchRelatedRefs;
  provenance: {
    owner: 'CreatorSource'; authorRef: ResearchOwnerRef; creatorId: string; url: string | null;
    authorIdentity: CreatorSource['authorIdentity']; identityEvidence: string | null;
  };
  publishedAt: string | null; publishedAtLabel: string | null; capturedAt: string; recordedAt: string;
  /** Query cutoff in local knowledge time, never a publication-time replacement. */
  asOf: string;
  completeness: Coverage; commentCoverage: Coverage; effectiveCoverage: Coverage;
  uncertainty: ResearchUncertainty[];
  contentRef: { sourceRef: ResearchSourceRef; field: 'content' } | null;
  /** CreatorSource has no retained-byte digest authority. */
  digest: null;
  parentRef: ResearchSourceRef | null;
  revision: { supersedes: ResearchSourceRef | null; successor: ResearchSourceRef | null };
}

/** Closed, source-grounded findings; reasoning is not silently upgraded to a causal driver. */
export type CreatorResearchFinding = {
  kind: 'viewpoint'; summary: string; reasoning: string | null; state: ViewpointState;
} | {
  kind: 'relationship'; target: { owner: 'ExternalResearchEvent'; eventId: string };
  relation: ViewpointEventLink['relation']; explanation: string | null;
};

/** A fact candidate is extracted text, never Provider Fact or Verified Claim authority. */
export type ResearchFinding = CreatorResearchFinding | {
  kind: 'fact_candidate' | 'driver' | 'catalyst' | 'risk' | 'invalidation' | 'open_question';
  statement: string;
};

/** Common L1 read contract. Persistence/review remain owned by the implementing domain. */
export interface ResearchExtraction {
  schemaVersion: 'research-extraction.v1'; ref: ResearchExtractionRef; sourceRefs: ResearchSourceRef[];
  semanticClass: 'external_commentary' | 'user_judgement' | 'ai_draft'; relatedRefs: ResearchRelatedRefs;
  author: { type: 'external_creator' | 'user' | 'ai' | 'unknown'; ref: ResearchOwnerRef | null };
  extractor: { type: 'human' | 'ai' | 'unknown'; method: string | null; version: string | null };
  adapterVersion: string; createdAt: string; effectiveAt: string | null; asOf: string;
  findings: ResearchFinding[]; completeness: Coverage; uncertainty: ResearchUncertainty[];
  review: ResearchExtractionReview;
  revision: { supersedes: ResearchExtractionRef | null; successor: ResearchExtractionRef | null; reason: string | null };
}

/** L1 projection of a persisted immutable ViewpointObservation, not a second business record. */
export interface CreatorResearchExtraction extends ResearchExtraction {
  schemaVersion: 'research-extraction.v1'; ref: ResearchExtractionRef; sourceRefs: ResearchSourceRef[];
  semanticClass: 'external_commentary'; relatedRefs: ResearchRelatedRefs;
  author: { type: 'external_creator'; ref: ResearchOwnerRef; creatorId: string; identity: CreatorSource['authorIdentity'] };
  /** The owner does not record human/AI attribution or extraction method. Do not guess. */
  extractor: { type: 'unknown'; method: null; version: null };
  adapterVersion: 'creator-research-adapter.v1';
  createdAt: string; effectiveAt: string | null; asOf: string;
  findings: CreatorResearchFinding[]; completeness: Coverage; uncertainty: ResearchUncertainty[];
  /** Derived from append-only owner approval; absent approval ALWAYS means draft. */
  review: { status: 'draft' | 'reviewed' | 'rejected';
    approvalRef: { owner: 'ViewpointApproval'; approvalId: string } | null; reviewedAt: string | null };
  revision: { supersedes: ResearchExtractionRef | null; successor: ResearchExtractionRef | null; reason: string | null };
  creatorContext: {
    chronology: 'resolved' | 'unknown_time' | 'ambiguous_time' | 'superseded';
    /** Null means the original Current View service cannot produce a resolved current state. */
    chronologyHealth: 'resolved' | 'incomplete' | null;
    unresolvedExtractionRefs: ResearchExtractionRef[];
  };
}

/** Explicit read-only adapter. Adding a source domain requires an audited implementation. */
export interface ResearchSourceAdapter {
  readonly adapterVersion: string;
  readonly sourceDomain: string;
  readonly asOf: string;
  listSources(): readonly ResearchSource[];
  resolveSource(ref: ResearchSourceRef): ResearchSource;
  listExtractions(): readonly ResearchExtraction[];
  resolveExtraction(ref: ResearchExtractionRef): ResearchExtraction;
  /** Re-resolve every field against the owner; a schema-valid export is not authority. */
  validateSource(value: unknown): void;
  validateExtraction(value: unknown): void;
}
export interface ResearchExtractionRepository {
  read(asOf: string): ResearchSourceAdapter;
}
