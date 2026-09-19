// Reviewed real Industry target. Uses the same services as the Workspace, never the oracle.
import { buildIndustrySignalClaims, retainedDifference, canonical, assessIndustryGraph } from '../../src/services/industrySignalClaim.mjs';
import { industrySignalContext } from '../industry/signal-claim.mjs';
const base = { outcome: 'blocked', selectedRefs: [], citationRefs: [], conditions: [], value: null, unit: null, exAnte: null, reproducible: null };
let loaded;
async function context() {
  return loaded ??= industrySignalContext().then(async input => ({ ...input, result: await buildIndustrySignalClaims(input) }));
}
export const industryTarget = Object.freeze({
  targetId: 'industry-signal-claim-service', targetVersion: '1', targetKind: 'deterministic_service',
  supportedOperations: Object.freeze(['recompute', 'assess_graph']),
  async execute({ operation, request, input }) {
    const { result, provider } = await context();
    if (input.kind === 'industry_difference' && operation === 'recompute') {
      const metric = provider.get(input.industryId, input.metricId);
      if (!metric || canonical(metric.entry.artifactRef) !== canonical(input.artifactRef)) throw new Error('F3_EXACT_METRIC_REQUIRED');
      const signal = result.derived.signals.find(s => s.metricId === input.metricId);
      const manifest = result.derived.manifests.find(m => m.id === signal?.manifestId);
      if (!signal || !manifest || canonical(signal.formulaRef) !== canonical(input.formulaRef)) throw new Error('F3_REVIEWED_FORMULA_REQUIRED');
      const calculation = retainedDifference(metric.owner, signal.basis);
      return { ...base, conditions: calculation.conditions, value: calculation.value, unit: signal.unit, reproducible: calculation.computable,
        selectedRefs: manifest.inputRefs.map(r => r.objectId).sort(), citationRefs: [signal.formulaRef.objectId, ...manifest.inputRefs.map(r => r.objectId)].sort() };
    }
    if (input.kind === 'industry_graph' && operation === 'assess_graph') {
      return assessIndustryGraph(input.graph, request, result.resolvePin);
    }
    if (input.kind === 'industry_eligibility' && operation === 'recompute') {
      const gate = result.gates.find(g => g.industryId === input.industryId);
      if (!gate || gate.policyVersion !== input.policyVersion) throw new Error('F3_GATE_IDENTITY');
      const graphs = result.graphs.filter(g => result.derived.signals.some(s => s.industryId === input.industryId && g.graph.nodes.some(n => n.nodeId === s.id)));
      return { ...base, outcome: gate.eligibility === 'ELIGIBLE' ? 'eligible' : 'blocked', conditions: [...new Set(graphs.flatMap(g => g.assessment.conditions))].sort(),
        selectedRefs: [], citationRefs: ['industry-prosperity-eligibility'], reproducible: true };
    }
    throw new Error('UNSUPPORTED_INDUSTRY_REQUEST');
  },
});
