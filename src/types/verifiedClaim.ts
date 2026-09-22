import type { IndustryMetricPin } from './industryMetric';
import type { EvidenceGraph } from '../services/industrySignalClaim.mjs';

export interface ResearchContext { kind: 'notion' | 'drive' | 'report' | 'web'; title: string; url: string }
export interface ClaimBinding {
  adapter: string; candidateRef: IndustryMetricPin; graphId: string; graphRevision: number; graphSha256: string; targetNodeId: string;
}
export interface ClaimEntry {
  claimId: string; adapter: string; candidateId: string; origin: 'ai_draft' | 'user_judgement'; generation: 'TEMPLATE' | 'AI' | 'USER'; createdAt: string;
}
export interface ClaimRevision {
  claimId: string; revisionId: string; supersedes: string | null; createdAt: string; asOf: string;
  statement: string; scope: string; origin: ClaimEntry['origin']; generation: ClaimEntry['generation'];
  binding: ClaimBinding; contexts: ResearchContext[]; reason: string;
}
export interface ClaimReview {
  reviewId: string; claimId: string; revisionId: string; decision: 'VERIFIED' | 'REJECTED'; reviewerType: 'user';
  userApprovalRef: { owner: 'ClaimReview'; approvalId: string }; createdAt: string; note: string;
}
export interface ClaimData { schemaVersion: 'verified-claim.v1'; entries: ClaimEntry[]; revisions: ClaimRevision[]; reviews: ClaimReview[] }
export interface ClaimAssessment { outcome: string; conditions: string[]; selectedRefs: string[]; citationRefs: string[] }
/** Trusted code port. Implementations own pins/graph digests and candidate semantics; never accepts context. */
export interface ClaimOwners {
  resolve(binding: ClaimBinding): {
    binding: ClaimBinding; statement: string; scope: string; origin: ClaimEntry['origin']; generation: ClaimEntry['generation'];
    graph: EvidenceGraph; resolvePin(pin: IndustryMetricPin): unknown;
    assessOwner(asOf: string): ClaimAssessment;
  };
}
export interface ClaimPreview { revision: ClaimRevision; assessment: ClaimAssessment; verifiable: boolean; blockers: string[] }
