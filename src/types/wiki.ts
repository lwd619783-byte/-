import type { ResearchRelatedRefs, ResearchSourceRef, ResearchExtractionRef, ResearchSourceAdapter } from './researchExtraction';
import type { IndustryMetricPin } from './industryMetric';
import type { EvidenceRef } from '../../local-core/domain/asset-types';
import type { ChartAuditView } from '../services/chartAudit';

export const WIKI_TYPES = ['ENTITY', 'CONCEPT', 'FRAMEWORK', 'TOPIC', 'CREATOR_FRAMEWORK', 'INDUSTRY_KNOWLEDGE', 'MACRO_KNOWLEDGE', 'RESEARCH_CONVENTION'] as const;
export type WikiType = typeof WIKI_TYPES[number];
/** Same owner/objectId/version/sha256/RFC6901 identity as F2. No Wiki Evidence store. */
export type WikiEvidenceRef = IndustryMetricPin;
export interface WikiEntry { schemaVersion: 'wiki-entry.v1'; wikiId: string; type: WikiType; createdAt: string }
export interface WikiRevision {
  schemaVersion: 'wiki-revision.v1'; wikiId: string; revisionId: string;
  title: string; summary: string; bodyMarkdown: string;
  sourceRefs: ResearchSourceRef[]; extractionRefs: ResearchExtractionRef[]; evidenceRefs: WikiEvidenceRef[];
  wikiRefs: Array<{ wikiId: string }>; relatedRefs: ResearchRelatedRefs;
  tags: string[]; aliases: string[]; authorType: 'user' | 'ai';
  createdAt: string; asOf: string; supersedes: string | null; revisionReason: string;
}
export interface WikiReview {
  schemaVersion: 'wiki-review.v1'; reviewId: string; wikiId: string; revisionId: string;
  decision: 'reviewed' | 'rejected' | 'archived'; reviewerType: 'user';
  approvalRef: { owner: 'WikiReview'; approvalId: string };
  createdAt: string; note: string; supersedes: string | null;
}
export interface WikiData { schemaVersion: 'wiki.v1'; entries: WikiEntry[]; revisions: WikiRevision[]; reviews: WikiReview[] }
export interface WikiResolvedEvidence { ref: WikiEvidenceRef; evidence: EvidenceRef; audit: ChartAuditView; availableAt: string }
/** Ports accept exact original identities; implementations must re-resolve against owners. */
export interface WikiOwners {
  research(asOf: string): ResearchSourceAdapter;
  evidence(ref: WikiEvidenceRef, asOf: string): WikiResolvedEvidence;
  related(refs: ResearchRelatedRefs, asOf: string): void;
}
export interface WikiPage {
  entry: WikiEntry; revision: WikiRevision; review: WikiReview;
  status: 'reviewed'; authority: 'research_memory'; origin: 'user_judgement' | 'ai_draft';
  asOf: string; backlinks: string[]; orphan: boolean;
  completeness: 'FULL' | 'PARTIAL' | 'UNVERIFIED'; uncertainty: string[];
}
export interface WikiReadModel { schemaVersion: 'wiki-read.v1'; asOf: string; pages: WikiPage[]; orphanWikiIds: string[] }
