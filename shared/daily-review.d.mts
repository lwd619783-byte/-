export interface ReviewSource { id: string; kind: 'os' | 'notion' | 'public'; title: string; locator: string; revision: string | null; sourceDate: string | null; asOf: string; availableAt: string | null; availability: 'available' | 'missing' | 'stale' | 'conflicted' | 'blocked'; relationToOS: 'os_state' | 'external_unverified' | 'external_conflict' }
export interface ReviewNote { text: string; sourceIds: string[] }
export type ReviewStatus = 'AI_DRAFT' | 'AI_PUBLISHED' | 'USER_CONFIRMED' | 'SUPERSEDED' | 'WITHDRAWN';
export interface DailyReview {
 schemaVersion: 'daily-review.v1'; subjectType: 'industry'; subjectId: 'oil-shipping'; reviewDate: string; asOf: string; dataAsOf: string; generatedAt: string;
 generator: { type: 'ai'; name: string }; sources: ReviewSource[]; previousReviewId: string | null; previousRevision: number | null;
 status: 'AI_DRAFT' | 'AI_PUBLISHED'; summary: string; observations: (ReviewNote & { kind: 'fact' | 'derived' | 'interpretation' })[];
 delta: ReviewNote[]; supports: ReviewNote[]; challenges: ReviewNote[]; risks: ReviewNote[];
 watchNext: { condition: string; metric: string; currentState: string; direction: 'up' | 'down' | 'change' | 'available' | 'unknown'; horizon: string; sourceIds: string[] }[];
 confidence: 'low' | 'medium' | 'high' | 'unknown'; uncertainty: string[]; formalDecisionImpact: 'none' | 'review_required' | 'candidate_for_formal_update';
}
export interface DailyReviewRecord { schemaVersion: 'daily-review.v1'; reviewId: string; revision: number; createdAt: string; updatedAt: string; status: ReviewStatus; content: DailyReview; contentDigest: string; previousRevision: number | null; audit: { actor: 'ai' | 'owner'; action: 'publish' | 'confirm' | 'withdraw'; owner: string; workspace: string; scope: 'real' | 'synthetic' } }
export interface ReviewRead { record: DailyReviewRecord | null; effectiveStatus: ReviewStatus | null; isCurrent: boolean; scope: 'real' | 'synthetic' }
export interface ReviewHistory { items: { reviewId: string; reviewDate: string; revision: number; createdAt: string; status: ReviewStatus; originalStatus: ReviewStatus }[]; next: number | null }
export const MAX_REVIEW_BYTES: number;
export const reviewRecordSchema: { parse(value: unknown): DailyReviewRecord };
export function validateReview(input: unknown, now?: number): DailyReview;
