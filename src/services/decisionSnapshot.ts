import { canonicalJson } from '../../shared/canonical-json.mjs';
import { validateDecisionSnapshot, type DecisionSnapshot, type DecisionRow, type DecisionDomain, type DecisionRef } from '../../shared/decision-snapshot.mjs';
import { validateProjection, type PortfolioProjection } from '../../shared/portfolio.mjs';
import { claimReadModel, previewClaim } from './verifiedClaim';
import { thesisReadModel } from './thesis';
import { expressionReadModel } from './investmentExpression';
import type { ExpressionWorkspaceRuntime } from './expressionWorkspace';

export async function decisionDigest(value: unknown): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value))))].map(b => b.toString(16).padStart(2, '0')).join('');
}
const unique = (v: string[]) => [...new Set(v)].sort();
const safeBlockers = (v: string[]) => unique(v.map(code => /^[a-zA-Z0-9_:-]{1,160}$/.test(code) ? code : 'OWNER_VALIDATION_BLOCKED'));
const state = (passed: boolean, blockers: string[], partial = false): DecisionRow['status'] => !passed ? blockers.some(b => /conflict/i.test(b)) ? 'conflicted' : 'blocked' : blockers.length ? 'stale' : partial ? 'partial' : 'confirmed';
function domain<T extends DecisionRow>(rows: T[]): DecisionDomain<T> {
  return { status: !rows.length ? 'missing' : rows.some(r => !['verified', 'confirmed'].includes(r.status)) ? 'partial' : 'available', blockers: unique(rows.flatMap(r => r.blockers)), rows };
}
async function ref(owner: DecisionRef['owner'], id: string, revisionId: string, approvalId: string, revisionBytes: string): Promise<DecisionRef> {
  return { owner, id, revisionId, approvalId, revisionDigest: await decisionDigest(JSON.parse(revisionBytes)) };
}

/** Reads formal owners and gates, never serializes raw localStorage or pinned canonical bytes. */
export async function buildDecisionSnapshot(runtime: ExpressionWorkspaceRuntime, portfolio: PortfolioProjection | null, now = new Date(), portfolioBlocker = 'PORTFOLIO_NOT_CONNECTED'): Promise<DecisionSnapshot> {
  const asOf = now.toISOString(), tr = runtime.thesisRuntime;
  const claimLoad = tr.claimRepository.load(), thesisLoad = tr.repository.load(), expressionLoad = runtime.repository.load();
  if (claimLoad.error || thesisLoad.error || expressionLoad.error) throw Error('DECISION_OWNER_UNAVAILABLE_OR_SCHEMA_BLOCKED');
  const authorityBytes = canonicalJson([claimLoad.data, thesisLoad.data, expressionLoad.data]);
  const claims = await Promise.all(claimReadModel(claimLoad.data, tr.claimOwners, asOf).filter(row => row.reviews.some(r => r.revisionId === row.revision.revisionId && r.decision === 'VERIFIED')).map(async row => {
    const r = row.revision, review = row.reviews.find(c => c.revisionId === r.revisionId)!;
    return { id: r.claimId, revisionId: r.revisionId, approvalId: review.reviewId, revisionDigest: await decisionDigest(r), asOf: r.asOf, createdAt: r.createdAt,
      status: row.status === 'VERIFIED' && row.gate.verifiable ? 'verified' as const : state(false, row.gate.blockers), blockers: safeBlockers(row.gate.blockers), origin: r.origin,
      authority: 'BrowserClaimRepository' as const, statement: r.statement, scope: r.scope, gate: { outcome: row.gate.assessment.outcome, verifiable: row.gate.verifiable, conditions: safeBlockers(row.gate.assessment.conditions) },
      evidence: r.binding, citationRefs: row.gate.assessment.citationRefs, lineage: [] };
  }));
  const theses = await Promise.all(thesisReadModel(thesisLoad.data, tr.owners, asOf).filter(row => row.current).map(async row => {
    const r = row.current!, gate = row.gate!, confirmation = row.confirmations.find(c => c.revisionId === r.revisionId)!;
    const blockers = safeBlockers([...gate.blockers, ...(row.supportUpdates.length ? ['CLAIM_UPDATED_REVIEW_REQUIRED'] : []), ...(row.draft ? ['THESIS_DRAFT_SUCCESSOR'] : [])]);
    return { id: r.thesisId, revisionId: r.revisionId, approvalId: confirmation.confirmationId, revisionDigest: await decisionDigest(r), asOf: r.asOf, createdAt: r.createdAt,
      authority: 'BrowserThesisRepository' as const, status: state(gate.publishable, blockers), blockers, origin: r.origin,
      statement: r.statement, bull: r.bull, base: r.base, bear: r.bear, keyDrivers: r.keyDrivers, catalysts: r.catalysts, risks: r.risks, invalidation: r.invalidation, confidence: r.confidence, relatedEntities: r.relatedEntities,
      gate: { publishable: gate.publishable }, supportUpdates: row.supportUpdates.map(r => r.revisionId),
      lineage: await Promise.all(r.supportingClaims.map(c => ref('Claim', c.claimId, c.revisionId, c.reviewId, c.revisionBytes))),
      citationRefs: unique(gate.claims.flatMap(c => c.revision ? previewClaim(c.revision, tr.claimOwners).assessment.citationRefs : [])) };
  }));
  const expressions = await Promise.all(expressionReadModel(expressionLoad.data, runtime.owners, asOf).filter(row => row.current).map(async row => {
    const r = row.current!, gate = row.gate!, confirmation = row.confirmations.find(c => c.revisionId === r.revisionId)!;
    const blockers = safeBlockers([...gate.blockers, ...(theses.find(t => t.revisionId === r.thesis?.revisionId)?.blockers ?? []), ...(row.thesisUpdated ? ['THESIS_UPDATED_REVIEW_REQUIRED'] : []), ...(row.draft ? ['EXPRESSION_DRAFT_SUCCESSOR'] : [])]);
    return { id: r.expressionId, revisionId: r.revisionId, approvalId: confirmation.confirmationId, revisionDigest: await decisionDigest(r), asOf: r.asOf, createdAt: r.createdAt,
      authority: 'BrowserExpressionRepository' as const, status: state(gate.publishable, blockers, !!gate.unknowns.length), blockers, origin: r.origin,
      instrument: r.instrument, role: r.role, directness: r.directness, correlation: r.correlation, liquidity: r.liquidity, valuation: r.valuation, sensitivity: r.sensitivity, idiosyncraticRisk: r.idiosyncraticRisk,
      gate: { publishable: gate.publishable, unknowns: gate.unknowns }, thesisUpdated: row.thesisUpdated,
      lineage: r.thesis ? [await ref('Thesis', r.thesis.thesisId, r.thesis.revisionId, r.thesis.confirmationId, r.thesis.revisionBytes)] : [],
      citationRefs: unique((gate.thesisGate?.claims ?? []).flatMap(c => c.revision ? previewClaim(c.revision, tr.claimOwners).assessment.citationRefs : [])) };
  }));
  const p = portfolio ? validateProjection(portfolio) : null;
  const snapshot = validateDecisionSnapshot({ schemaVersion: 'decision-snapshot.v1', snapshotId: crypto.randomUUID(), generatedAt: asOf, asOf, scope: runtime.owners.scope,
    authority: 'local-formal-owners', semantics: 'current-published-state-only', claims: domain(claims), theses: domain(theses), expressions: domain(expressions),
    portfolio: { status: p ? p.status === 'conflicted' ? 'conflicted' : 'partial' : 'unavailable', authority: 'localhost-portfolio-projection', blockers: p?.blockers ?? safeBlockers([portfolioBlocker]), projection: p } });
  const reloads = [tr.claimRepository.load(), tr.repository.load(), runtime.repository.load()];
  if (reloads.some(r => r.error) || canonicalJson(reloads.map(r => r.data)) !== authorityBytes) throw Error('DECISION_OWNER_CHANGED');
  return snapshot;
}
