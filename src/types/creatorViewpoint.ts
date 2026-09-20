import type { ExternalResearchEvent } from './researchEvent';

/** External commentary only. Review means reviewed transcription, never a verified claim. */
export interface Creator { id: string; name: string; profileUrl: string | null; recordedAt: string }
export interface ViewpointTopic { id: string; name: string; recordedAt: string }
export type Coverage = 'FULL' | 'PARTIAL' | 'UNVERIFIED';
export type SourceKind = 'post' | 'article' | 'comment' | 'self_reply' | 'repost';
export interface CreatorSource {
  id: string; creatorId: string; kind: SourceKind; url: string | null;
  publishedAt: string | null; publishedAtLabel: string | null; capturedAt: string; recordedAt: string;
  content: string | null; parentSourceId: string | null; supersedesId: string | null;
  authorIdentity: 'verified_self' | 'unverified' | 'other'; identityEvidence: string | null;
  completeness: Coverage; commentCoverage: Coverage;
}
export type ViewpointStance = 'positive' | 'neutral' | 'cautious' | 'negative' | 'mixed' | 'unknown';
export interface ViewpointState {
  stance: ViewpointStance; conditional: 'yes' | 'no' | 'unknown'; horizon: string | null;
  trigger: string | null; confirmation: string | null; invalidation: string | null;
}
export interface ViewpointEventLink {
  eventId: string; relation: 'explicit' | 'inferred' | 'temporal'; explanation: string | null;
}
export interface ViewpointObservation extends ViewpointState {
  id: string; creatorId: string; topicId: string; sourceId: string; recordedAt: string;
  summary: string; reasoning: string | null; eventLinks: ViewpointEventLink[];
  supersedesId: string | null; revisionReason: string | null; important: boolean;
}
export interface ViewpointApproval {
  id: string; observationId: string; decision: 'reviewed' | 'rejected'; recordedAt: string; note: string;
}
export interface ViewpointReview {
  id: string; observationId: string; offsetDays: 5 | 20 | 60; recordedAt: string;
  status: 'pending' | 'completed' | 'inconclusive'; triggerOccurred: 'yes' | 'no' | 'unknown';
  invalidationOccurred: 'yes' | 'no' | 'unknown'; actualOutcome: string | null;
  evidence: string | null; evidenceUrl: string | null; supersedesId: string | null;
}
export interface CreatorViewpointData {
  schemaVersion: 1; semanticClass: 'external_commentary';
  creators: Creator[]; topics: ViewpointTopic[]; sources: CreatorSource[];
  events: ExternalResearchEvent[]; observations: ViewpointObservation[];
  approvals: ViewpointApproval[]; reviews: ViewpointReview[];
}
export interface ViewpointTransition {
  id: string; creatorId: string; topicId: string; recordedAt: string; effectiveAt: string;
  previous: ViewpointObservation | null; next: ViewpointObservation; approvalId: string;
}
export interface ViewpointCurrent {
  creatorId: string; topicId: string; observation: ViewpointObservation;
  effectiveAt: string; reviewedAt: string; lastTransition: ViewpointTransition | null; coverage: Coverage;
  /** Latest resolved state may be incomplete; capture is only an upper bound, never creator time. */
  chronologyHealth: 'resolved' | 'incomplete'; unresolvedObservationIds: string[];
}
export interface ViewpointReviewDue {
  observationId: string; offsetDays: 5 | 20 | 60; anchorAt: string | null;
  dueAt: string | null; chronology: 'resolved' | 'unresolved'; basis: 'calendar_days';
  result: ViewpointReview | null;
}
