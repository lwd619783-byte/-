import { canonicalJson } from '../../shared/canonical-json.mjs';
import { isPreciseInstant } from '../utils/dateTime';
import type { ThesisRevision, ThesisConfirmation } from '../types/thesis';
import type { ExpressionData, ExpressionRevision, ExpressionOwners, ExpressionPreview, FormalThesisRef } from '../types/investmentExpression';
import { claimRequire as require, cloneClaim, validateResearchContext } from './verifiedClaim';
import { previewThesis, validateThesisData } from './thesis';
import validateSchema from './expressionValidator.generated.mjs';

export const expressionContextFields = ['directness', 'correlation', 'liquidity', 'valuation', 'sensitivity', 'idiosyncraticRisk'] as const;
export const emptyExpressionData = (): ExpressionData => ({ schemaVersion: 'investment-expression.v1', entries: [], revisions: [], confirmations: [] });
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const before = (a: string, b: string) => Date.parse(a) <= Date.parse(b);
const instant = (value: string) => require(isPreciseInstant(value), 'EXPRESSION_TIME_INVALID');
const unique = (values: string[]) => require(new Set(values).size === values.length, 'EXPRESSION_DUPLICATE_ID');
export function pinFormalThesis(revision: ThesisRevision, confirmation: ThesisConfirmation): FormalThesisRef {
  require(confirmation.thesisId === revision.thesisId && confirmation.revisionId === revision.revisionId && confirmation.actor === 'user', 'EXPRESSION_THESIS_NOT_FORMAL');
  return { thesisId: revision.thesisId, revisionId: revision.revisionId, confirmationId: confirmation.confirmationId,
    revisionBytes: canonicalJson(revision), confirmationBytes: canonicalJson(confirmation) };
}
export function validateExpressionData(value: unknown): asserts value is ExpressionData {
  canonicalJson(value); require(validateSchema(value), 'EXPRESSION_SCHEMA_INVALID_OR_FUTURE_VERSION');
  const data = value as ExpressionData;
  unique(data.entries.map(e => e.expressionId)); unique(data.revisions.map(r => r.revisionId)); unique(data.confirmations.map(c => c.confirmationId));
  const heads = new Map<string, ExpressionRevision>();
  data.entries.forEach(e => instant(e.createdAt));
  for (const r of data.revisions) {
    instant(r.createdAt); instant(r.asOf);
    const entry = data.entries.find(e => e.expressionId === r.expressionId), prior = heads.get(r.expressionId);
    require(entry && entry.origin === r.origin && entry.scope === r.scope && before(entry.createdAt, r.createdAt), 'EXPRESSION_IDENTITY_OR_ORIGIN_DRIFT');
    require(before(r.asOf, r.createdAt), 'EXPRESSION_TIME_ORDER');
    require((prior?.revisionId ?? null) === r.supersedes, 'EXPRESSION_REVISION_FORK_OR_FOREIGN');
    if (prior) require(before(prior.createdAt, r.createdAt) && before(prior.asOf, r.asOf), 'EXPRESSION_REVISION_TIME');
    require(r.reason.trim().length > 0 && expressionContextFields.every(k => r[k].rationale.trim().length > 0), 'EXPRESSION_EMPTY_REASON');
    r.contexts.forEach(validateResearchContext);
    if (r.thesis) {
      const pinned = JSON.parse(r.thesis.revisionBytes) as ThesisRevision, c = JSON.parse(r.thesis.confirmationBytes) as ThesisConfirmation;
      require(equal(pinFormalThesis(pinned, c), r.thesis), 'EXPRESSION_THESIS_PIN_INVALID');
    }
    heads.set(r.expressionId, r);
  }
  require(data.entries.every(e => heads.has(e.expressionId)), 'EXPRESSION_ENTRY_WITHOUT_REVISION');
  const confirmed = new Set<string>();
  for (const c of data.confirmations) {
    instant(c.createdAt); const r = data.revisions.find(r => r.revisionId === c.revisionId);
    require(r && r.expressionId === c.expressionId && before(r.createdAt, c.createdAt) && c.userApprovalRef.approvalId === c.confirmationId
      && !confirmed.has(c.revisionId) && c.note.trim().length > 0, 'EXPRESSION_CONFIRMATION_FOREIGN_TIME_OR_DUPLICATE');
    require(r!.thesis !== null && r!.instrument !== null, 'EXPRESSION_FORMAL_REFERENCES_REQUIRED');
    require(!data.revisions.some(r => r.supersedes === c.revisionId && before(r.createdAt, c.createdAt)), 'EXPRESSION_CONFIRMATION_SUPERSEDED');
    confirmed.add(c.revisionId);
  }
}
export function validateExpressionScope(data: ExpressionData, owners: ExpressionOwners) {
  require(data.entries.every(e => e.scope === owners.scope) && data.revisions.every(r => r.scope === owners.scope), 'EXPRESSION_SCOPE_MISMATCH');
}
/** Original owners only. Canonical pins never become fallback Thesis/Claim/Evidence stores. */
export function previewExpression(revision: ExpressionRevision, owners: ExpressionOwners): ExpressionPreview {
  const copy = cloneClaim(revision), blockers: string[] = [], unknowns: string[] = [];
  let thesis: ThesisRevision | null = null, confirmation: ThesisConfirmation | null = null;
  let thesisGate: ExpressionPreview['thesisGate'] = null, authorityToken: string | null = null;
  const block = (e: unknown) => blockers.push(e instanceof Error ? e.message : 'EXPRESSION_OWNER_UNAVAILABLE');
  try {
    validateExpressionData({ schemaVersion: 'investment-expression.v1', entries: [{ expressionId: copy.expressionId, createdAt: copy.createdAt, origin: copy.origin, scope: copy.scope }], revisions: [{ ...copy, supersedes: null }], confirmations: [] });
    require(copy.scope === owners.scope, 'EXPRESSION_SCOPE_MISMATCH');
    if (copy.role === 'unknown') unknowns.push('role');
    expressionContextFields.forEach(k => { if (copy[k].status === 'unknown') unknowns.push(k); });
    if (!copy.instrument) blockers.push('EXPRESSION_INSTRUMENT_UNRESOLVED');
    else { try { require(equal(owners.resolveInstrument(cloneClaim(copy.instrument)), copy.instrument), 'EXPRESSION_INSTRUMENT_UNRESOLVED_OR_AMBIGUOUS'); } catch (e) { block(e); } }
    if (!copy.thesis) blockers.push('EXPRESSION_NO_FORMAL_THESIS');
    else {
      const source = owners.theses(); validateThesisData(source.data);
      const ref = copy.thesis;
      authorityToken = canonicalJson({ revisions: source.data.revisions.filter(r => r.thesisId === ref.thesisId), confirmations: source.data.confirmations.filter(c => c.thesisId === ref.thesisId) });
      thesis = source.data.revisions.find(r => r.thesisId === ref.thesisId && r.revisionId === ref.revisionId) ?? null;
      confirmation = source.data.confirmations.find(c => c.thesisId === ref.thesisId && c.revisionId === ref.revisionId && c.confirmationId === ref.confirmationId) ?? null;
      if (!thesis || !confirmation || !equal(pinFormalThesis(thesis, confirmation), ref)) blockers.push('EXPRESSION_THESIS_EXACT_FORMAL_REF_UNAVAILABLE');
      else {
        if (!before(thesis.asOf, copy.asOf) || !before(thesis.createdAt, copy.asOf) || !before(confirmation.createdAt, copy.asOf)) blockers.push('EXPRESSION_THESIS_NOT_AVAILABLE_ASOF');
        const head = source.data.revisions.filter(r => r.thesisId === ref.thesisId && before(r.createdAt, copy.asOf)).at(-1);
        if (head && head.revisionId !== ref.revisionId) blockers.push('EXPRESSION_THESIS_SUPERSEDED_ASOF');
        thesisGate = previewThesis(thesis, source.owners);
        blockers.push(...thesisGate.blockers);
      }
    }
  } catch (e) { block(e); }
  return { revision: copy, publishable: blockers.length === 0, blockers: [...new Set(blockers)].sort(), unknowns, thesis, confirmation, thesisGate, authorityToken };
}
export function validateExpressionOwners(data: ExpressionData, owners: ExpressionOwners) {
  validateExpressionData(data); validateExpressionScope(data, owners);
  for (const c of data.confirmations) require(previewExpression(data.revisions.find(r => r.revisionId === c.revisionId)!, owners).publishable, 'EXPRESSION_FORMAL_SUPPORT_BLOCKED');
}
export function expressionThesisChoices(owners: ExpressionOwners, asOf: string) {
  instant(asOf); const source = owners.theses(); validateThesisData(source.data);
  return source.data.confirmations.filter(c => before(c.createdAt, asOf)).flatMap(c => {
    const r = source.data.revisions.filter(r => r.thesisId === c.thesisId && before(r.createdAt, asOf)).at(-1);
    return r?.revisionId === c.revisionId && before(r.asOf, asOf) && previewThesis(r, source.owners).publishable ? [{ ref: pinFormalThesis(r, c), statement: r.statement }] : [];
  });
}
export function expressionReadModel(data: ExpressionData, owners: ExpressionOwners, asOf: string) {
  validateExpressionData(data); validateExpressionScope(data, owners); instant(asOf);
  return data.entries.filter(e => before(e.createdAt, asOf)).flatMap(entry => {
    const history = data.revisions.filter(r => r.expressionId === entry.expressionId && before(r.createdAt, asOf));
    if (!history.length) return [];
    const confirmations = data.confirmations.filter(c => c.expressionId === entry.expressionId && before(c.createdAt, asOf));
    const current = history.filter(r => confirmations.some(c => c.revisionId === r.revisionId)).at(-1) ?? null;
    const head = history.at(-1)!, draft = confirmations.some(c => c.revisionId === head.revisionId) ? null : head;
    let thesisUpdated = false;
    try {
      const source = owners.theses(); validateThesisData(source.data);
      thesisUpdated = !!current?.thesis && source.data.revisions.some(r => r.thesisId === current.thesis!.thesisId && r.supersedes === current.thesis!.revisionId && before(r.createdAt, asOf));
    } catch { /* The gate exposes original authority errors. Never invent a successor. */ }
    return [{ entry, history, confirmations, current, draft, thesisUpdated, gate: current ? previewExpression(current, owners) : null }];
  });
}
export function expressionDiff(before: ExpressionRevision | null, after: ExpressionRevision) {
  return (Object.keys(after) as (keyof ExpressionRevision)[]).filter(k => !before || !equal(before[k], after[k])).map(field => ({ field, before: before?.[field] ?? null, after: after[field] }));
}
/** Ordered exact trace; callers receive unavailable blockers instead of substituting current heads. */
export function expressionTrace(revision: ExpressionRevision, owners: ExpressionOwners) {
  const gate = previewExpression(revision, owners);
  return { expressionId: revision.expressionId, revisionId: revision.revisionId, thesisRef: revision.thesis, gate,
    claims: (gate.thesisGate?.claims ?? []).map(c => ({ ref: c.ref, revision: c.revision, review: c.review, usable: c.usable, blockers: c.blockers, evidenceBinding: c.revision?.binding ?? null })) };
}
