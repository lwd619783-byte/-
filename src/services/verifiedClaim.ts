import { canonicalJson } from '../../shared/canonical-json.mjs';
import { isPreciseInstant } from '../utils/dateTime';
import type { ClaimData, ClaimRevision, ClaimOwners, ClaimPreview, ClaimBinding, ResearchContext } from '../types/verifiedClaim';
import validateSchema from './verifiedClaimValidator.generated.mjs';
import { assessEvidenceGraph } from './evidenceGraph.mjs';
import { validateGraph, policy } from './evidenceGraphSchema.mjs';

export const claimRequire = (condition: unknown, code: string): void => { if (!condition) throw new Error(code); };
export const cloneClaim = <T,>(value: T): T => JSON.parse(canonicalJson(value)) as T;
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const before = (a: string, b: string) => Date.parse(a) <= Date.parse(b);
const instant = (value: string) => claimRequire(isPreciseInstant(value), 'CLAIM_TIME_INVALID');
export const emptyClaimData = (): ClaimData => ({ schemaVersion: 'verified-claim.v1', entries: [], revisions: [], reviews: [] });
export const claimIdentity = (binding: ClaimBinding) => `claim:${encodeURIComponent(binding.adapter)}:${encodeURIComponent(binding.candidateRef.objectId)}`;

/** Local, non-authoritative URL pointers only. No page body, owner resolution or F2 input. */
export function validateResearchContext(context: ResearchContext): void {
  const url = new URL(context.url);
  claimRequire(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'CLAIM_CONTEXT_URL');
}
export function validateClaimData(value: unknown): asserts value is ClaimData {
  canonicalJson(value); claimRequire(validateSchema(value), 'CLAIM_SCHEMA_INVALID_OR_FUTURE_VERSION');
  const data = value as ClaimData;
  for (const [rows, ids] of [[data.entries, data.entries.map(r => r.claimId)], [data.revisions, data.revisions.map(r => r.revisionId)], [data.reviews, data.reviews.map(r => r.reviewId)]] as const)
    claimRequire(new Set(ids).size === rows.length, 'CLAIM_DUPLICATE_ID');
  const entries = new Map(data.entries.map(r => [r.claimId, r]));
  const revisions = new Map<string, ClaimRevision>();
  const heads = new Map<string, string>();
  for (const entry of data.entries) instant(entry.createdAt);
  for (const revision of data.revisions) {
    instant(revision.createdAt); instant(revision.asOf);
    const entry = entries.get(revision.claimId);
    claimRequire(entry && entry.claimId === claimIdentity(revision.binding) && entry.adapter === revision.binding.adapter
      && entry.candidateId === revision.binding.candidateRef.objectId && entry.origin === revision.origin && entry.generation === revision.generation,
    'CLAIM_IDENTITY_OR_ORIGIN_DRIFT');
    claimRequire(before(entry!.createdAt, revision.createdAt) && before(revision.asOf, revision.createdAt), 'CLAIM_TIME_ORDER');
    claimRequire((heads.get(revision.claimId) ?? null) === revision.supersedes, 'CLAIM_REVISION_FORK_OR_FOREIGN');
    if (revision.supersedes) {
      const prior = revisions.get(revision.supersedes)!;
      claimRequire(before(prior.createdAt, revision.createdAt) && before(prior.asOf, revision.asOf), 'CLAIM_REVISION_TIME');
    }
    revision.contexts.forEach(validateResearchContext);
    revisions.set(revision.revisionId, revision); heads.set(revision.claimId, revision.revisionId);
  }
  claimRequire(data.entries.every(e => heads.has(e.claimId)), 'CLAIM_ENTRY_WITHOUT_REVISION');
  const decided = new Set<string>();
  for (const review of data.reviews) {
    instant(review.createdAt);
    const revision = revisions.get(review.revisionId);
    claimRequire(revision && revision.claimId === review.claimId && before(revision.createdAt, review.createdAt)
      && review.userApprovalRef.approvalId === review.reviewId && !decided.has(review.revisionId), 'CLAIM_REVIEW_FOREIGN_TIME_OR_DUPLICATE');
    // A review cannot be appended after a successor existed (including equal-time ties).
    claimRequire(!data.revisions.some(r => r.supersedes === review.revisionId && before(r.createdAt, review.createdAt)), 'CLAIM_REVIEW_SUPERSEDED');
    decided.add(review.revisionId);
  }
}

/** Re-resolves exact owner and executes F2; caller-supplied assessment/status is never trusted. */
export function previewClaim(revision: ClaimRevision, owners: ClaimOwners): ClaimPreview {
  const copy = cloneClaim(revision);
  try {
    const source = owners.resolve(copy.binding);
    claimRequire(equal(source.binding, copy.binding), 'CLAIM_BINDING_DRIFT');
    claimRequire(source.statement === copy.statement && source.scope === copy.scope && source.origin === copy.origin
      && source.generation === copy.generation, 'CLAIM_STATEMENT_OR_ORIGIN_DRIFT');
    const graph = source.graph, target = graph.nodes.find(n => n.nodeId === copy.binding.targetNodeId);
    claimRequire(graph.graphId === copy.binding.graphId && graph.revision === copy.binding.graphRevision && target?.kind === 'claim'
      && equal(target.ref, copy.binding.candidateRef) && target.origin === copy.origin, 'CLAIM_TARGET_DRIFT');
    const request = { asOf: copy.asOf, targetNodeId: copy.binding.targetNodeId };
    const f2 = assessEvidenceGraph(graph, request, { validate: validateGraph, policy, resolvePin: source.resolvePin });
    const owner = source.assessOwner(copy.asOf);
    const blockers = [...new Set([...f2.conditions, ...owner.conditions,
      ...(f2.outcome === 'supported' && owner.outcome === 'supported' && equal(f2.selectedRefs, [request.targetNodeId])
        && equal(owner.selectedRefs, [request.targetNodeId]) ? [] : ['F2_NOT_SUPPORTED'])])].sort();
    const conditions = [...new Set([...f2.conditions, ...owner.conditions])].sort();
    return { revision: copy, assessment: { ...f2, conditions, outcome: conditions.includes('conflicted') ? 'conflicted' : blockers.length ? 'blocked' : 'supported',
      selectedRefs: blockers.length ? [] : f2.selectedRefs, citationRefs: blockers.length ? [] : f2.citationRefs }, blockers, verifiable: blockers.length === 0 };
  } catch (error) {
    return { revision: copy, assessment: { outcome: 'blocked', conditions: ['missing_evidence'], selectedRefs: [], citationRefs: [] },
      blockers: ['missing_evidence', error instanceof Error ? error.message : 'CLAIM_OWNER_UNAVAILABLE'], verifiable: false };
  }
}
export function draftClaim(binding: ClaimBinding, owners: ClaimOwners, input: {
  revisionId: string; createdAt: string; asOf: string; supersedes: string | null; reason: string; contexts: ResearchContext[];
}): ClaimRevision {
  const source = owners.resolve(binding);
  return cloneClaim({ ...input, claimId: claimIdentity(binding), binding, statement: source.statement, scope: source.scope,
    origin: source.origin, generation: source.generation });
}
export function validateClaimOwners(data: ClaimData, owners: ClaimOwners): void {
  validateClaimData(data);
  for (const revision of data.revisions) {
    const preview = previewClaim(revision, owners);
    // Drafts may be blocked by legitimate F2 conditions, but must remain exactly bound to their owner.
    const source = owners.resolve(revision.binding);
    claimRequire(equal(source.binding, revision.binding) && source.statement === revision.statement && source.scope === revision.scope
      && source.origin === revision.origin && source.generation === revision.generation, 'CLAIM_OWNER_BINDING_INVALID');
    if (data.reviews.some(r => r.revisionId === revision.revisionId && r.decision === 'VERIFIED')) claimRequire(preview.verifiable, 'CLAIM_VERIFIED_GATE_BLOCKED');
  }
}
export function claimReadModel(data: ClaimData, owners: ClaimOwners, asOf: string) {
  validateClaimData(data); instant(asOf);
  return data.entries.filter(e => before(e.createdAt, asOf)).flatMap(entry => {
    const history = data.revisions.filter(r => r.claimId === entry.claimId && before(r.createdAt, asOf));
    const revision = history.at(-1); if (!revision) return [];
    const reviews = data.reviews.filter(r => r.claimId === entry.claimId && before(r.createdAt, asOf));
    const review = reviews.find(r => r.revisionId === revision.revisionId);
    const gate = previewClaim(revision, owners);
    return [{ entry, revision, history, reviews, gate, status: review?.decision === 'VERIFIED' && !gate.verifiable ? 'BLOCKED' : review?.decision ?? 'DRAFT' }];
  });
}
