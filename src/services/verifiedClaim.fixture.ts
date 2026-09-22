/** Test-only frozen F2 supported fixture + explicit synthetic mutations. Never imported by production. */
import { digest } from './industrySignalClaim.mjs';
import scenarios from '../../contracts/financial-research/v1/fixtures/scenarios.json';
import rawOwners from '../../contracts/financial-research/v1/fixtures/owners.json?raw';
import type { ClaimBinding, ClaimOwners } from '../types/verifiedClaim';
import type { EvidenceGraph } from './industrySignalClaim.mjs';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { assessEvidenceGraph } from './evidenceGraph.mjs';
import { validateGraph, policy } from './evidenceGraphSchema.mjs';
import { claimRequire, cloneClaim, draftClaim } from './verifiedClaim';
export const claimTime = (day: number) => `2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`;

export async function claimFixture(mutate?: (graph: EvidenceGraph) => void) {
  const graph = cloneClaim(scenarios['closed-lineage'].graph) as EvidenceGraph;
  // Explicit synthetic AI-origin variant; frozen source fixture is never edited.
  graph.nodes.find(n => n.kind === 'claim')!.origin = 'ai_draft'; mutate?.(graph);
  const raw = rawOwners.replace(/\r\n/g, '\n');
  const values = JSON.parse(raw) as Record<string, { id: string; revision: string; text: string }>;
  const rawSha = await digest(raw), graphBytes = canonicalJson(graph);
  const target = graph.nodes.find(n => n.nodeId === 'claim')!;
  const binding: ClaimBinding = { adapter: 'synthetic_frozen_f2', candidateRef: cloneClaim(target.ref), graphId: graph.graphId, graphRevision: graph.revision, graphSha256: await digest(graphBytes), targetNodeId: target.nodeId };
  const owners: ClaimOwners = { resolve(input) {
    claimRequire(canonicalJson(input) === canonicalJson(binding) && canonicalJson(graph) === graphBytes, 'FIXTURE_BINDING_DRIFT');
    const resolvePin = (pin: ClaimBinding['candidateRef']) => {
      const value = values[pin.objectId];
      claimRequire(pin.owner === target.ref.owner && pin.sha256 === rawSha && pin.locator === `/${pin.objectId}` && value?.revision === pin.version, 'FIXTURE_PIN');
      return value;
    };
    return { binding: cloneClaim(binding), statement: values.claim.text, scope: 'synthetic-only', origin: 'ai_draft', generation: 'TEMPLATE', graph, resolvePin,
      assessOwner: asOf => assessEvidenceGraph(graph, { asOf, targetNodeId: binding.targetNodeId }, { validate: validateGraph, policy, resolvePin }) };
  } };
  const revision = draftClaim(binding, owners, { revisionId: 'synthetic-revision-1', createdAt: claimTime(6), asOf: claimTime(6), supersedes: null, reason: 'synthetic initial', contexts: [] });
  return { graph, binding, owners, revision };
}
export function claimStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
