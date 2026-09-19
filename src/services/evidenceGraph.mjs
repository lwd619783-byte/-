// Shared F2 execution. No filesystem, oracle, mutation or domain payloads.
// Callers supply schema validation and exact owner resolution; semantics remain F2 V1.
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const unique = values => [...new Set(values)].sort();
const instant = value => value === null ? NaN : Date.parse(value);
const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k])]));
  return value;
}
const isDeepStrictEqual = (a, b) => canonical(a) === canonical(b);
function result(conditions = [], fields = {}) {
  const flags = unique(conditions);
  return { outcome: flags.includes('conflicted') ? 'conflicted' : flags.length ? 'blocked' : 'eligible', selectedRefs: [], citationRefs: [], conditions: flags, value: null, unit: null, exAnte: null, reproducible: null, ...fields };
}
export function assessEvidenceGraph(graph, request, { validate, resolvePin, policy }) {
  const projectState = (owner, value) => policy.stateProjections[owner]?.[value] ?? ['unknown'];
  validate('evidence-graph.v1.schema.json', graph);
  requireThat(instant(graph.asOf) <= instant(request.asOf), 'GRAPH_ASOF');
  const nodes = new Map(graph.nodes.map((n) => [n.nodeId, n]));
  const previous = graph.previousGraphRef ? resolvePin(graph.previousGraphRef) : null;
  if (previous) {
    validate('evidence-graph.v1.schema.json', previous);
    requireThat(previous.graphId === graph.graphId && previous.revision === graph.revision - 1 && instant(previous.asOf) <= instant(graph.asOf), 'GRAPH_REVISION');
    const immutableFields = ['kind', 'ref', 'origin', 'releaseAvailableAt', 'nativeEvidenceRef', 'formulaRef', 'inputManifestRef'];
    for (const node of graph.nodes) {
      const prior = previous.nodes.find((n) => n.nodeId === node.nodeId);
      if (prior) requireThat(immutableFields.every((field) => isDeepStrictEqual(prior[field], node[field])), 'NODE_IDENTITY_OVERWRITE');
    }
  }
  requireThat(nodes.size === graph.nodes.length, 'DUPLICATE_NODE');
  requireThat(unique(graph.edges.map((e) => e.relationId)).length === graph.edges.length, 'DUPLICATE_RELATION');
  for (const edge of graph.edges) {
    requireThat(nodes.has(edge.from) && nodes.has(edge.to), 'DANGLING_EDGE');
    requireThat(policy.edgeTypes[edge.type].some(([a, b]) => nodes.get(edge.from).kind === a && nodes.get(edge.to).kind === b), 'EDGE_TYPE');
    requireThat(instant(edge.assertedAt) <= instant(graph.asOf), 'FUTURE_RELATION');
    requireThat(edge.supersedesRelationId !== edge.relationId, 'RELATION_SELF_REVISION');
    if (edge.supersedesRelationId !== null) requireThat(previous?.edges.some((p) => p.relationId === edge.supersedesRelationId), 'RELATION_PREDECESSOR');
    const existing = previous?.edges.find((p) => p.relationId === edge.relationId);
    if (existing) requireThat(isDeepStrictEqual(existing, edge), 'RELATION_OVERWRITE');
  }
  // Cycle detection checks the entire manifest, even unrelated branches.
  const visiting = new Set(), complete = new Set();
  function acyclic(id) {
    requireThat(!visiting.has(id), 'GRAPH_CYCLE');
    if (complete.has(id)) return;
    visiting.add(id);
    for (const edge of graph.edges.filter((e) => e.to === id)) acyclic(edge.from);
    visiting.delete(id); complete.add(id);
  }
  for (const id of nodes.keys()) acyclic(id);
  requireThat(nodes.has(request.targetNodeId), 'TARGET_MISSING');
  const flags = [], citations = new Set();
  // An unrelated broken pin is still a broken graph, not an ignorable branch.
  for (const node of graph.nodes) {
    try {
      resolvePin(node.ref);
      for (const ref of node.conditionSourceRefs) resolvePin(ref);
      if (node.formulaRef) resolvePin(node.formulaRef);
      if (node.inputManifestRef) resolvePin(node.inputManifestRef);
    } catch { flags.push('missing_evidence'); }
  }
  function walk(id) {
    if (citations.has(id)) return;
    citations.add(id);
    const node = nodes.get(id), incoming = graph.edges.filter((e) => e.to === id);
    try {
      resolvePin(node.ref);
      for (const ref of node.conditionSourceRefs) resolvePin(ref);
      if (node.conditions.length && !node.conditionSourceRefs.length) flags.push('unknown');
    } catch { flags.push('missing_evidence'); }
    flags.push(...node.conditions);
    if (node.nativeEvidenceRef) flags.push(...projectState('EvidenceRef.quality', node.nativeEvidenceRef.quality));
    if (['source', 'artifact', 'evidence'].includes(node.kind) && node.origin !== 'source_material') flags.push('not_admitted');
    if (!(instant(node.releaseAvailableAt) <= instant(request.asOf))) flags.push('unknown');
    if (node.kind === 'fact' && node.origin !== 'provider_fact') flags.push('not_admitted');
    if (node.kind === 'derived_metric' && node.origin !== 'derived_result') flags.push('not_admitted');
    if (['claim', 'thesis'].includes(node.kind) && !['user_judgement', 'ai_draft'].includes(node.origin)) flags.push('not_admitted');
    const needed = { artifact: 'publishes', evidence: 'locates', fact: 'establishes', derived_metric: 'input_to', claim: 'supports', thesis: 'supports', investment_expression: 'expresses', position: 'motivates', review: 'reviews' }[node.kind];
    if (needed && !incoming.some((e) => e.type === needed)) flags.push('missing_evidence');
    if (node.kind === 'derived_metric') {
      try { requireThat(node.formulaRef && node.inputManifestRef, 'DERIVED_REFS'); resolvePin(node.formulaRef); resolvePin(node.inputManifestRef); } catch { flags.push('missing_evidence'); }
    }
    if (incoming.some((e) => e.type === 'contradicts')) flags.push('conflicted');
    for (const edge of incoming) walk(edge.from);
  }
  walk(request.targetNodeId);
  if (flags.length) return result(flags);
  return result([], { outcome: 'supported', selectedRefs: [request.targetNodeId], citationRefs: [...citations] });
}
