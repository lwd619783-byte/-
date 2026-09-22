import type { EvidenceGraph } from './industrySignalClaim.mjs';
import type { IndustryMetricPin } from '../types/industryMetric';
import type { ClaimAssessment } from '../types/verifiedClaim';
export function assessEvidenceGraph(graph: EvidenceGraph, request: { asOf: string; targetNodeId: string }, dependencies: {
  validate(name: string, value: unknown): void; resolvePin(pin: IndustryMetricPin): unknown; policy: unknown;
}): ClaimAssessment;
