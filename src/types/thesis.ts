import type { ClaimData, ClaimOwners, ClaimRevision, ClaimReview, ResearchContext } from './verifiedClaim';

/** Existing application owner IDs, never labels, aliases or a new Entity registry. */
export interface ThesisIdentity { owner: 'MacroIndicator' | 'Industry' | 'Stock'; id: string }
/** Canonical bytes are integrity pins only; original Claim owner remains authoritative. */
export interface VerifiedClaimRef { claimId: string; revisionId: string; reviewId: string; revisionBytes: string; reviewBytes: string }
export interface MacroIndustryRelationship {
  relationshipId: string; macroDriver: ThesisIdentity; industry: ThesisIdentity;
  exposure: 'direct' | 'indirect' | 'unknown'; sensitivity: 'qualitative' | 'unknown';
  rationale: string; asOf: string; conditions: string[]; supportingClaims: VerifiedClaimRef[];
}
export interface ThesisRevision {
  thesisId: string; revisionId: string; supersedes: string | null; createdAt: string; asOf: string;
  origin: 'user_judgement' | 'ai_draft'; statement: string; bull: string; base: string; bear: string;
  keyDrivers: string[]; catalysts: string[]; risks: string[]; invalidation: string[];
  confidence: 'low' | 'medium' | 'high' | 'unknown'; supportingClaims: VerifiedClaimRef[];
  relatedEntities: ThesisIdentity[]; macroIndustry: MacroIndustryRelationship[]; contexts: ResearchContext[]; reason: string;
}
export interface ThesisEntry { thesisId: string; createdAt: string; origin: ThesisRevision['origin'] }
export interface ThesisConfirmation {
  confirmationId: string; thesisId: string; revisionId: string; createdAt: string;
  actor: 'user'; userApprovalRef: { owner: 'ThesisConfirmation'; approvalId: string }; note: string;
}
export interface ThesisData { schemaVersion: 'thesis.v1'; entries: ThesisEntry[]; revisions: ThesisRevision[]; confirmations: ThesisConfirmation[] }
/** Trusted in-process read ports. Claims must be freshly loaded on every call. */
export interface ThesisOwners {
  claims(): { data: ClaimData; owners: ClaimOwners };
  resolveIdentity(ref: ThesisIdentity): ThesisIdentity;
}
export interface ThesisClaimAssessment { ref: VerifiedClaimRef; revision: ClaimRevision | null; review: ClaimReview | null; usable: boolean; blockers: string[] }
export interface ThesisPreview { revision: ThesisRevision; publishable: boolean; blockers: string[]; claims: ThesisClaimAssessment[]; relationships: { relationshipId: string; status: 'supported' | 'unknown' | 'blocked'; blockers: string[] }[] }
