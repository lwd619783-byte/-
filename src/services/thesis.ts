import { canonicalJson } from '../../shared/canonical-json.mjs';
import { isPreciseInstant } from '../utils/dateTime';
import type { ClaimRevision, ClaimReview } from '../types/verifiedClaim';
import type { ThesisData, ThesisRevision, ThesisOwners, ThesisPreview, VerifiedClaimRef, ThesisIdentity, ThesisClaimAssessment } from '../types/thesis';
import { claimRequire, cloneClaim, previewClaim, validateClaimData, validateResearchContext } from './verifiedClaim';
import validateSchema from './thesisValidator.generated.mjs';

export const emptyThesisData = (): ThesisData => ({ schemaVersion: 'thesis.v1', entries: [], revisions: [], confirmations: [] });
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const before = (a: string, b: string) => Date.parse(a) <= Date.parse(b);
const instant = (value: string) => claimRequire(isPreciseInstant(value), 'THESIS_TIME_INVALID');
const unique = (ids: string[]) => claimRequire(new Set(ids).size === ids.length, 'THESIS_DUPLICATE_ID');
const claimKey = (ref: VerifiedClaimRef) => `${ref.claimId}\u0000${ref.revisionId}\u0000${ref.reviewId}`;
export function pinVerifiedClaim(revision: ClaimRevision, review: ClaimReview): VerifiedClaimRef {
  claimRequire(review.claimId === revision.claimId && review.revisionId === revision.revisionId && review.decision === 'VERIFIED', 'THESIS_CLAIM_NOT_VERIFIED');
  return { claimId: revision.claimId, revisionId: revision.revisionId, reviewId: review.reviewId, revisionBytes: canonicalJson(revision), reviewBytes: canonicalJson(review) };
}
/** Structural/history validation never promotes a persisted draft or supplies missing owners. */
export function validateThesisData(value: unknown): asserts value is ThesisData {
  canonicalJson(value); claimRequire(validateSchema(value), 'THESIS_SCHEMA_INVALID_OR_FUTURE_VERSION');
  const data = value as ThesisData;
  unique(data.entries.map(e => e.thesisId)); unique(data.revisions.map(r => r.revisionId)); unique(data.confirmations.map(c => c.confirmationId));
  const heads = new Map<string, ThesisRevision>();
  data.entries.forEach(e => instant(e.createdAt));
  for (const revision of data.revisions) {
    instant(revision.createdAt); instant(revision.asOf);
    const entry = data.entries.find(e => e.thesisId === revision.thesisId), prior = heads.get(revision.thesisId);
    claimRequire(entry && entry.origin === revision.origin && before(entry.createdAt, revision.createdAt), 'THESIS_IDENTITY_OR_ORIGIN_DRIFT');
    claimRequire(before(revision.asOf, revision.createdAt), 'THESIS_TIME_ORDER');
    claimRequire((prior?.revisionId ?? null) === revision.supersedes, 'THESIS_REVISION_FORK_OR_FOREIGN');
    if (prior) claimRequire(before(prior.createdAt, revision.createdAt) && before(prior.asOf, revision.asOf), 'THESIS_REVISION_TIME');
    unique(revision.supportingClaims.map(claimKey)); unique(revision.relatedEntities.map(r => canonicalJson(r))); unique(revision.macroIndustry.map(r => r.relationshipId));
    for (const relationship of revision.macroIndustry) {
      instant(relationship.asOf); claimRequire(before(relationship.asOf, revision.asOf), 'THESIS_RELATIONSHIP_TIME');
      claimRequire(relationship.macroDriver.owner === 'MacroIndicator' && relationship.industry.owner === 'Industry', 'THESIS_RELATIONSHIP_IDENTITY_KIND');
      unique(relationship.supportingClaims.map(claimKey));
      claimRequire(relationship.supportingClaims.every(ref => revision.supportingClaims.some(p => equal(p, ref))), 'THESIS_RELATIONSHIP_FOREIGN_CLAIM');
    }
    revision.contexts.forEach(validateResearchContext);
    // Exact byte pins must be canonical and identify the referenced Claim objects.
    for (const ref of revision.supportingClaims) {
      const r = JSON.parse(ref.revisionBytes) as ClaimRevision, review = JSON.parse(ref.reviewBytes) as ClaimReview;
      claimRequire(canonicalJson(r) === ref.revisionBytes && canonicalJson(review) === ref.reviewBytes && r.claimId === ref.claimId && r.revisionId === ref.revisionId
        && review.claimId === ref.claimId && review.revisionId === ref.revisionId && review.reviewId === ref.reviewId && review.decision === 'VERIFIED', 'THESIS_CLAIM_PIN_INVALID');
    }
    heads.set(revision.thesisId, revision);
  }
  claimRequire(data.entries.every(e => heads.has(e.thesisId)), 'THESIS_ENTRY_WITHOUT_REVISION');
  const confirmed = new Set<string>();
  for (const confirmation of data.confirmations) {
    instant(confirmation.createdAt);
    const revision = data.revisions.find(r => r.revisionId === confirmation.revisionId);
    claimRequire(revision && revision.thesisId === confirmation.thesisId && before(revision.createdAt, confirmation.createdAt)
      && confirmation.userApprovalRef.approvalId === confirmation.confirmationId && !confirmed.has(confirmation.revisionId), 'THESIS_CONFIRMATION_FOREIGN_TIME_OR_DUPLICATE');
    claimRequire(!data.revisions.some(r => r.supersedes === confirmation.revisionId && before(r.createdAt, confirmation.createdAt)), 'THESIS_CONFIRMATION_SUPERSEDED');
    confirmed.add(confirmation.revisionId);
  }
}
function checkIdentity(ref: ThesisIdentity, owners: ThesisOwners): void {
  claimRequire(equal(owners.resolveIdentity(cloneClaim(ref)), ref), 'THESIS_IDENTITY_UNRESOLVED');
}
/** Reuses original Claim review and F2. Contexts are deliberately absent from this authority path. */
export function previewThesis(revision: ThesisRevision, owners: ThesisOwners): ThesisPreview {
  const copy = cloneClaim(revision), blockers: string[] = [], claims: ThesisClaimAssessment[] = [], relationships: ThesisPreview['relationships'] = [];
  const block = (error: unknown) => blockers.push(error instanceof Error ? error.message : 'THESIS_OWNER_UNAVAILABLE');
  try {
    // Validate one revision without inventing a predecessor or changing its stored bytes.
    validateThesisData({ schemaVersion: 'thesis.v1', entries: [{ thesisId: copy.thesisId, createdAt: copy.createdAt, origin: copy.origin }], revisions: [{ ...copy, supersedes: null }], confirmations: [] });
    if (!copy.supportingClaims.length) blockers.push('THESIS_NO_VERIFIED_CLAIM');
    if (!copy.relatedEntities.length) blockers.push('THESIS_NO_RESEARCH_IDENTITY');
    for (const ref of copy.relatedEntities) { try { checkIdentity(ref, owners); } catch (e) { block(e); } }
    const source = owners.claims(); validateClaimData(source.data);
    for (const ref of copy.supportingClaims) {
      const r = source.data.revisions.find(r => r.claimId === ref.claimId && r.revisionId === ref.revisionId) ?? null;
      const review = source.data.reviews.find(r => r.reviewId === ref.reviewId && r.claimId === ref.claimId && r.revisionId === ref.revisionId) ?? null;
      const errors: string[] = [];
      if (!r || !review || canonicalJson(r) !== ref.revisionBytes || canonicalJson(review) !== ref.reviewBytes) errors.push('THESIS_CLAIM_EXACT_REF_UNAVAILABLE');
      else {
        if (review.decision !== 'VERIFIED') errors.push('THESIS_CLAIM_NOT_VERIFIED');
        if (!before(r.asOf, copy.asOf) || !before(r.createdAt, copy.asOf) || !before(review.createdAt, copy.asOf)) errors.push('THESIS_CLAIM_NOT_AVAILABLE_ASOF');
        const gate = previewClaim(r, source.owners); if (!gate.verifiable) errors.push(...gate.blockers);
      }
      claims.push({ ref, revision: r, review, usable: errors.length === 0, blockers: errors }); blockers.push(...errors);
    }
    for (const relationship of copy.macroIndustry) {
      const errors: string[] = [];
      try { checkIdentity(relationship.macroDriver, owners); checkIdentity(relationship.industry, owners); } catch (e) { errors.push(e instanceof Error ? e.message : 'THESIS_IDENTITY_UNRESOLVED'); }
      for (const ref of relationship.supportingClaims) {
        const assessment = claims.find(c => equal(c.ref, ref));
        if (!assessment?.usable) errors.push('THESIS_RELATIONSHIP_EVIDENCE_BLOCKED');
        if (assessment?.review && !before(assessment.review.createdAt, relationship.asOf)) errors.push('THESIS_RELATIONSHIP_CLAIM_NOT_AVAILABLE_ASOF');
      }
      const unknown = !relationship.supportingClaims.length || relationship.exposure === 'unknown' || relationship.sensitivity === 'unknown';
      relationships.push({ relationshipId: relationship.relationshipId, status: errors.length ? 'blocked' : unknown ? 'unknown' : 'supported', blockers: errors }); blockers.push(...errors);
    }
  } catch (error) { block(error); }
  return { revision: copy, publishable: blockers.length === 0, blockers: [...new Set(blockers)].sort(), claims, relationships };
}
export function validateThesisOwners(data: ThesisData, owners: ThesisOwners): void {
  validateThesisData(data);
  for (const confirmation of data.confirmations) {
    const revision = data.revisions.find(r => r.revisionId === confirmation.revisionId)!;
    claimRequire(previewThesis(revision, owners).publishable, 'THESIS_FORMAL_SUPPORT_BLOCKED');
  }
}
export function thesisReadModel(data: ThesisData, owners: ThesisOwners, asOf: string) {
  validateThesisData(data); instant(asOf);
  return data.entries.filter(e => before(e.createdAt, asOf)).flatMap(entry => {
    const history = data.revisions.filter(r => r.thesisId === entry.thesisId && before(r.createdAt, asOf));
    if (!history.length) return [];
    const confirmations = data.confirmations.filter(c => c.thesisId === entry.thesisId && before(c.createdAt, asOf));
    const current = history.filter(r => confirmations.some(c => c.revisionId === r.revisionId)).at(-1) ?? null;
    const head = history.at(-1)!, draft = confirmations.some(c => c.revisionId === head.revisionId) ? null : head;
    return [{ entry, current, draft, history, confirmations, gate: current ? previewThesis(current, owners) : null }];
  });
}
export function thesisDiff(before: ThesisRevision | null, after: ThesisRevision) {
  return (Object.keys(after) as (keyof ThesisRevision)[]).filter(field => !before || !equal(before[field], after[field]))
    .map(field => ({ field, before: before?.[field] ?? null, after: after[field] }));
}
