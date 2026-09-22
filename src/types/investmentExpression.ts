import type { ThesisData, ThesisOwners, ThesisRevision, ThesisConfirmation, ThesisPreview } from './thesis';
import type { ResearchContext } from './verifiedClaim';

/** References existing owners; never a registry or ticker-based resolver. */
export interface InstrumentRef {
  owner: 'Stock' | 'Entity' | 'Asset'; id: string;
  type: 'Index' | 'ETF' | 'Fund' | 'Equity' | 'CommodityProxy';
  market: 'A' | 'H' | 'US' | 'global' | 'unknown';
}
export interface FormalThesisRef {
  thesisId: string; revisionId: string; confirmationId: string;
  revisionBytes: string; confirmationBytes: string;
}
/** V1 has no immutable quote/valuation adapter: qualitative judgement or explicit unknown only. */
export interface ExpressionContext {
  status: 'unknown' | 'research_judgement'; rationale: string;
}
export interface ExpressionRevision {
  expressionId: string; revisionId: string; supersedes: string | null; createdAt: string; asOf: string;
  scope: 'real' | 'synthetic'; origin: 'user_judgement' | 'ai_draft';
  thesis: FormalThesisRef | null; instrument: InstrumentRef | null;
  role: 'direct' | 'leader' | 'high_beta' | 'defensive' | 'unknown';
  directness: ExpressionContext; correlation: ExpressionContext; liquidity: ExpressionContext;
  valuation: ExpressionContext; sensitivity: ExpressionContext; idiosyncraticRisk: ExpressionContext;
  contexts: ResearchContext[]; reason: string;
}
export interface ExpressionEntry { expressionId: string; createdAt: string; origin: ExpressionRevision['origin']; scope: ExpressionRevision['scope'] }
export interface ExpressionConfirmation {
  confirmationId: string; expressionId: string; revisionId: string; createdAt: string; actor: 'user';
  userApprovalRef: { owner: 'ExpressionConfirmation'; approvalId: string }; note: string;
}
export interface ExpressionData {
  schemaVersion: 'investment-expression.v1'; entries: ExpressionEntry[]; revisions: ExpressionRevision[]; confirmations: ExpressionConfirmation[];
}
export interface ExpressionOwners {
  scope: ExpressionRevision['scope'];
  theses(): { data: ThesisData; owners: ThesisOwners };
  resolveInstrument(ref: InstrumentRef): InstrumentRef;
}
export interface ExpressionPreview {
  revision: ExpressionRevision; publishable: boolean; blockers: string[]; unknowns: string[];
  thesis: ThesisRevision | null; confirmation: ThesisConfirmation | null; thesisGate: ThesisPreview | null;
  /** In-process integrity token only. Always reconstructed from the original owner. */
  authorityToken: string | null;
}
