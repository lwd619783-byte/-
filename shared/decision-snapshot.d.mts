import type { ClaimBinding } from '../src/types/verifiedClaim';
import type { ThesisIdentity } from '../src/types/thesis';
import type { InstrumentRef, ExpressionContext } from '../src/types/investmentExpression';
import type { PortfolioProjection } from './portfolio.mjs';
export interface DecisionRef { owner: 'Claim' | 'Thesis' | 'Expression'; id: string; revisionId: string; approvalId: string; revisionDigest: string }
export interface DecisionRow { id: string; revisionId: string; approvalId: string; revisionDigest: string; asOf: string; createdAt: string; status: 'verified' | 'confirmed' | 'blocked' | 'stale' | 'conflicted' | 'partial'; blockers: string[]; citationRefs: string[]; lineage: DecisionRef[]; origin: 'ai_draft' | 'user_judgement' }
export interface DecisionClaim extends DecisionRow { authority: 'BrowserClaimRepository'; statement: string; scope: string; gate: { outcome: string; verifiable: boolean; conditions: string[] }; evidence: ClaimBinding }
export interface DecisionThesis extends DecisionRow { authority: 'BrowserThesisRepository'; statement: string; bull: string; base: string; bear: string; keyDrivers: string[]; catalysts: string[]; risks: string[]; invalidation: string[]; confidence: 'low' | 'medium' | 'high' | 'unknown'; relatedEntities: ThesisIdentity[]; gate: { publishable: boolean }; supportUpdates: string[] }
export interface DecisionExpression extends DecisionRow { authority: 'BrowserExpressionRepository'; instrument: InstrumentRef | null; role: 'direct' | 'leader' | 'high_beta' | 'defensive' | 'unknown'; directness: ExpressionContext; correlation: ExpressionContext; liquidity: ExpressionContext; valuation: ExpressionContext; sensitivity: ExpressionContext; idiosyncraticRisk: ExpressionContext; gate: { publishable: boolean; unknowns: string[] }; thesisUpdated: boolean }
export interface DecisionDomain<T> { status: 'available' | 'missing' | 'partial' | 'blocked' | 'stale' | 'conflicted'; blockers: string[]; rows: T[] }
export interface DecisionSnapshot {
 schemaVersion: 'decision-snapshot.v1'; snapshotId: string; generatedAt: string; asOf: string; scope: 'real' | 'synthetic'; authority: 'local-formal-owners'; semantics: 'current-published-state-only';
 claims: DecisionDomain<DecisionClaim>; theses: DecisionDomain<DecisionThesis>; expressions: DecisionDomain<DecisionExpression>;
 portfolio: { status: 'unavailable' | 'partial' | 'conflicted'; authority: 'localhost-portfolio-projection'; blockers: string[]; projection: PortfolioProjection | null };
}
export const MAX_SNAPSHOT_BYTES: number;
export const SNAPSHOT_TTL_MS: number;
export const PUBLISH_MAX_AGE_MS: number;
export const decisionSnapshotSchema: { parse(value: unknown): DecisionSnapshot };
export function validateDecisionSnapshot(value: unknown): DecisionSnapshot;
