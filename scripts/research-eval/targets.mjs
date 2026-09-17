// Reviewed, offline target registry. No dynamic plugin loading or oracle fallback.
import { executeReference } from '../contracts/financial-research.mjs';

export const referenceTarget = Object.freeze({
  targetId: 'financial-research-contract-reference',
  targetVersion: '1',
  targetKind: 'reference_oracle',
  supportedOperations: Object.freeze(['assess_graph', 'qualify_earnings', 'recompute', 'retrieve']),
  execute: executeReference,
});

// Empty intentionally: existing runtime seams cannot consume Frozen V1 synthetic inputs
// without inventing owner authority, evidence or domain records. See capabilityAudit.
export const deterministicTargets = Object.freeze([]);
export const targets = Object.freeze([referenceTarget, ...deterministicTargets]);
export const capabilityAudit = Object.freeze([
  { operation: 'assess_graph', status: 'NOT_IMPLEMENTED', reason: 'NO_F2_RUNTIME',
    seams: ['src/services/researchInbox.ts', 'src/services/chartAudit.ts', 'src/components/research/ResearchEventEvidence.tsx'],
    limitation: 'Product read models do not execute immutable F2 graph closure or revision semantics.' },
  { operation: 'qualify_earnings', status: 'NOT_IMPLEMENTED', reason: 'FROZEN_INPUT_LACKS_DOMAIN_RECORDS',
    seams: ['src/services/earningsExpectationComparisonProvider.ts'],
    limitation: 'Boolean fixture summaries and generic pins cannot supply full Snapshot, ResearchEvent, measurement and disclosure-scope records.' },
  { operation: 'recompute', status: 'NOT_IMPLEMENTED', reason: 'FIXTURE_FORMULA_HAS_NO_PRODUCTION_OWNER',
    seams: ['scripts/semantic-runtime/readiness.mjs', 'scripts/semantic-runtime/readiness-v2.mjs'],
    limitation: 'Readiness evaluates gates; it does not implement the synthetic sum_divide_fixed_denominator formula as a production service.' },
  { operation: 'retrieve', status: 'NOT_IMPLEMENTED', reason: 'FROZEN_BINDING_HAS_NO_RUNTIME_OWNER',
    seams: ['scripts/semantic-runtime/market-regime-adapter.mjs', 'scripts/semantic-runtime/market-regime-adapter-v2.mjs', 'scripts/semantic-runtime/selection.mjs'],
    limitation: 'Macro entrypoints require owned bindings, identity and evidence context; fixture-macro is not a reviewed runtime binding. Supplying trusted selector context would invent authority.' },
].map((entry) => Object.freeze({ ...entry, seams: Object.freeze(entry.seams) })));

export function assertTargetBoundary(target) {
  if (!target) throw new Error('INVALID_TARGET');
  if ((target.targetId === referenceTarget.targetId || target.execute === executeReference || target.targetKind === 'reference_oracle') && target !== referenceTarget) {
    throw new Error('REFERENCE_TARGET_RELABEL');
  }
}
