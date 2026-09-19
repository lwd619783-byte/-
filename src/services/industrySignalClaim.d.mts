import type { IndustryMetricPin, IndustryMetricCondition } from '../types/industryMetric';
import type { IndustryMetricProvider } from './industryMetricRegistry.mjs';
import type { IndustryDimensions } from './industryDimensions.mjs';
export const SIGNAL_POLICY: string;
export interface DerivedIndustryChange {
  id: string; revision: string; metricId: string; industryId: string; basis: string; unit: string;
  formulaRef: IndustryMetricPin; manifestId: string; value: number | null; previousPeriod: string | null; currentPeriod: string | null;
  conditions: IndustryMetricCondition[]; dataAdmission: string; productionAdmission: string; pit: string; releaseAvailableAt: null; revisionContinuity: string;
}
export interface FactualClaimCandidate {
  id: string; revision: string; status: 'CANDIDATE'; origin: 'ai_draft'; generation: 'TEMPLATE';
  templateRef: IndustryMetricPin; signalId: string; metricId: string; industryId: string; text: string;
  conditions: IndustryMetricCondition[]; releaseAvailableAt: null; supportingSignalIds: string[]; contradictingSignalIds: string[];
}
/** Mirrors the existing F2 V1 wire contract; no second graph schema. */
export interface EvidenceGraph {
  schemaVersion: 'evidence-graph.v1'; graphId: string; revision: number; asOf: string;
  nodes: { nodeId: string; kind: string; ref: IndustryMetricPin; origin: string; releaseAvailableAt: string | null;
    conditions: IndustryMetricCondition[]; conditionSourceRefs: IndustryMetricPin[]; formulaRef?: IndustryMetricPin; inputManifestRef?: IndustryMetricPin }[];
  edges: { relationId: string; from: string; to: string; type: string; assertedAt: string; supersedesRelationId: string | null }[];
}
export interface IndustryGraphResult { graph: EvidenceGraph; targetNodeId: string; assessment: { outcome: string; conditions: IndustryMetricCondition[] } }
export interface ProsperityEligibility {
  schemaVersion: 'industry-prosperity-eligibility.v1'; policyVersion: string; industryId: string; outcome: 'ABSTAIN' | 'ELIGIBLE'; eligibility: 'NOT_ELIGIBLE' | 'ELIGIBLE';
  requiredDimensions: string[]; missingDimensions: string[]; blockers: string[]; reasons: { code: string; refs: string[] }[];
}
export interface IndustrySignalClaims {
  derived: { schemaVersion: string; id: string; revision: string; assertedAt: string; signals: DerivedIndustryChange[]; claims: FactualClaimCandidate[];
    manifests: { id: string; revision: string; formulaRef: IndustryMetricPin; definitionRef: IndustryMetricPin; inputRefs: IndustryMetricPin[]; previousPeriod: string | null; currentPeriod: string | null; basis: string; fixedInputCount: number }[] };
  graphs: IndustryGraphResult[]; gates: ProsperityEligibility[]; resolvePin: (pin: IndustryMetricPin) => unknown;
}
export function buildIndustrySignalClaims(input: { provider: IndustryMetricProvider; dimensions: IndustryDimensions; resources: { path: string; raw: string }[] }): Promise<IndustrySignalClaims>;
