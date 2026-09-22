import { canonicalJson } from '../../shared/canonical-json.mjs';
import { assessIndustryGraph, digest, type IndustrySignalClaims } from './industrySignalClaim.mjs';
import type { ClaimBinding, ClaimOwners } from '../types/verifiedClaim';
import { claimRequire, cloneClaim } from './verifiedClaim';

/** Original Industry owner remains authoritative. No editable graph or candidate copy is accepted. */
export async function createIndustryClaimOwners(result: IndustrySignalClaims): Promise<ClaimOwners & { bindings: ClaimBinding[] }> {
  const records = await Promise.all(result.derived.claims.map(async candidate => {
    const group = result.graphs.find(g => g.targetNodeId === candidate.id);
    claimRequire(group, 'CLAIM_INDUSTRY_GRAPH_MISSING');
    const graphBytes = canonicalJson(group!.graph);
    const node = group!.graph.nodes.find(n => n.nodeId === candidate.id && n.kind === 'claim');
    claimRequire(node && canonicalJson(result.resolvePin(node.ref)) === canonicalJson(candidate), 'CLAIM_INDUSTRY_CANDIDATE_PIN');
    const binding: ClaimBinding = { adapter: 'industry_claim_candidate', candidateRef: cloneClaim(node!.ref), graphId: group!.graph.graphId,
      graphRevision: group!.graph.revision, graphSha256: await digest(graphBytes), targetNodeId: candidate.id };
    const candidateBytes = canonicalJson(candidate);
    return { binding, candidate, group: group!, graphBytes, candidateBytes };
  }));
  return {
    bindings: records.map(r => cloneClaim(r.binding)),
    resolve(binding) {
      const record = records.find(r => canonicalJson(r.binding) === canonicalJson(binding));
      claimRequire(record, 'CLAIM_INDUSTRY_FOREIGN_BINDING');
      const { candidate, group, graphBytes, candidateBytes } = record!;
      claimRequire(canonicalJson(group.graph) === graphBytes && canonicalJson(result.resolvePin(binding.candidateRef)) === candidateBytes,
        'CLAIM_INDUSTRY_OWNER_DRIFT');
      claimRequire(candidate.id === binding.candidateRef.objectId && candidate.revision === binding.candidateRef.version
        && candidate.status === 'CANDIDATE' && candidate.origin === 'ai_draft' && candidate.generation === 'TEMPLATE', 'CLAIM_INDUSTRY_IDENTITY');
      return { binding: cloneClaim(record!.binding), statement: candidate.text, scope: candidate.industryId, origin: candidate.origin, generation: candidate.generation,
        graph: group.graph, resolvePin: result.resolvePin,
        assessOwner: asOf => assessIndustryGraph(group.graph, { asOf, targetNodeId: binding.targetNodeId }, result.resolvePin) };
    },
  };
}
