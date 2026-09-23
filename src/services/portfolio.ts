import { z } from 'zod';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { positionIdentity, type PortfolioPosition, type PortfolioProjection } from '../../shared/portfolio.mjs';
import type { ExpressionData, ExpressionOwners, ExpressionRevision, ExpressionConfirmation } from '../types/investmentExpression';
import { validateExpressionData, validateExpressionScope, expressionTrace } from './investmentExpression';

const id = z.string().trim().min(1).max(2048), instant = z.string().datetime({ offset: true });
const approval = z.object({ actor: z.literal('user'), userApprovalRef: id, note: id }).strict();
const revision = { revisionId: id, supersedes: id.nullable(), createdAt: instant, asOf: instant, approval };
const expressionPin = z.object({ expressionId: id, revisionId: id, confirmationId: id, revisionBytes: z.string().min(1), confirmationBytes: z.string().min(1) }).strict();
export const researchLinkSchema = z.object({ ...revision, linkId: id, positionId: id, accountId: id, assetId: id, expression: expressionPin, rationale: id }).strict();
export type ResearchLink = z.infer<typeof researchLinkSchema>;
export interface PortfolioResearchOwners { scope: 'real' | 'synthetic'; expressions(): { data: ExpressionData; owners: ExpressionOwners } }
export function pinExpression(r: ExpressionRevision, c: ExpressionConfirmation): ResearchLink['expression'] {
  if (r.expressionId !== c.expressionId || r.revisionId !== c.revisionId) throw Error('PORTFOLIO_EXPRESSION_PIN_INVALID');
  return { expressionId: r.expressionId, revisionId: r.revisionId, confirmationId: c.confirmationId, revisionBytes: canonicalJson(r), confirmationBytes: canonicalJson(c) };
}
export function validateLink(link: ResearchLink) {
  researchLinkSchema.parse(link);
  if (Date.parse(link.asOf) > Date.parse(link.createdAt) || link.positionId !== positionIdentity(link.accountId, link.assetId) || link.linkId !== link.positionId) throw Error('PORTFOLIO_LINK_IDENTITY_OR_TIME');
  const r = JSON.parse(link.expression.revisionBytes) as ExpressionRevision, c = JSON.parse(link.expression.confirmationBytes) as ExpressionConfirmation;
  if (canonicalJson(pinExpression(r, c)) !== canonicalJson(link.expression)) throw Error('PORTFOLIO_EXPRESSION_PIN_INVALID');
}
/** Reuses original graph. Pins are integrity checks, never fallback authorities. */
export function researchExposure(position: PortfolioPosition, link: ResearchLink | null, owners: PortfolioResearchOwners, asOf: string) {
  instant.parse(asOf);
  const blockers: string[] = []; let trace: ReturnType<typeof expressionTrace> | null = null;
  let expressionUpdated = false, thesisUpdated = false;
  let authorityToken: string | null = null;
  if (!link) return { status: 'unresolved' as const, blockers: ['POSITION_UNLINKED'], trace, expressionUpdated, thesisUpdated, authorityToken, relationships: [] };
  try {
    validateLink(link);
    if (link.positionId !== position.positionId || Date.parse(link.createdAt) > Date.parse(asOf)) throw Error('PORTFOLIO_LINK_UNAVAILABLE_ASOF');
    const source = owners.expressions(); validateExpressionData(source.data); validateExpressionScope(source.data, source.owners);
    if (source.owners.scope !== owners.scope) throw Error('PORTFOLIO_RESEARCH_SCOPE');
    const r = source.data.revisions.find(r => r.expressionId === link.expression.expressionId && r.revisionId === link.expression.revisionId);
    const c = source.data.confirmations.find(c => c.confirmationId === link.expression.confirmationId);
    authorityToken = canonicalJson(source.data);
    if (!r || !c || canonicalJson(pinExpression(r,c)) !== canonicalJson(link.expression)) throw Error('PORTFOLIO_EXPRESSION_AUTHORITY_UNAVAILABLE');
    if ([r.createdAt, r.asOf, c.createdAt].some(t => Date.parse(t) > Date.parse(link.asOf))) throw Error('PORTFOLIO_EXPRESSION_NOT_AVAILABLE_ASOF');
    const history = source.data.revisions.filter(v => v.expressionId === r.expressionId);
    const successors = history.slice(history.findIndex(v => v.revisionId === r.revisionId) + 1);
    if (successors.some(v => Date.parse(v.createdAt) <= Date.parse(link.asOf))) blockers.push('EXPRESSION_SUPERSEDED_AT_LINK');
    expressionUpdated = successors.some(v => Date.parse(v.createdAt) <= Date.parse(asOf));
    trace = expressionTrace(r, source.owners); blockers.push(...trace.gate.blockers);
    const theses = source.owners.theses();
    thesisUpdated = !!r.thesis && theses.data.revisions.some(v => v.thesisId === r.thesis!.thesisId && v.supersedes === r.thesis!.revisionId && Date.parse(v.createdAt) <= Date.parse(asOf));
    if (expressionUpdated) blockers.push('EXPRESSION_UPDATED_REVIEW_REQUIRED');
    if (thesisUpdated) blockers.push('THESIS_UPDATED_REVIEW_REQUIRED');
    authorityToken = canonicalJson({ expression: authorityToken, upstream: trace.gate.authorityToken, gate: trace.gate });
  } catch (e) { blockers.push(e instanceof Error ? e.message : 'PORTFOLIO_RESEARCH_UNAVAILABLE'); }
  const relationships = (trace?.gate.thesis?.macroIndustry ?? []).map(r => ({ relationshipId: r.relationshipId, macroDriver: r.macroDriver, industry: r.industry, directness: r.exposure, sensitivity: r.sensitivity, rationale: r.rationale, conditions: r.conditions, status: trace?.gate.thesisGate?.relationships.find(x => x.relationshipId === r.relationshipId)?.status ?? 'unknown' }));
  return { status: blockers.length ? 'unresolved' as const : relationships.length && relationships.every(r => r.status === 'supported') ? 'known' as const : 'partial' as const, blockers: [...new Set(blockers)].sort(), trace, expressionUpdated, thesisUpdated, authorityToken, relationships };
}
export function linkAt(links: ResearchLink[], positionId: string, asOf: string): ResearchLink | null {
  return links.filter(l => l.positionId === positionId && Date.parse(l.createdAt) <= Date.parse(asOf)).at(-1) ?? null;
}
export function formalExpressionChoices(owners: PortfolioResearchOwners, asOf: string) {
  const s = owners.expressions(); validateExpressionData(s.data); validateExpressionScope(s.data, s.owners);
  return s.data.confirmations.filter(c => Date.parse(c.createdAt) <= Date.parse(asOf)).flatMap(c => {
    const r = s.data.revisions.find(r => r.revisionId === c.revisionId)!;
    const successor = s.data.revisions.some(x => x.supersedes === r.revisionId && Date.parse(x.createdAt) <= Date.parse(asOf));
    return !successor && expressionTrace(r, s.owners).gate.publishable ? [{ revision: r, pin: pinExpression(r, c) }] : [];
  });
}
export function validatePortfolioScope(projection: PortfolioProjection, scope: 'real' | 'synthetic') {
  if (projection.scope !== scope) throw Error('PORTFOLIO_SCOPE_MISMATCH');
}
