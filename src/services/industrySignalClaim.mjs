// Deterministic retained-snapshot preview; never an admission or judgement engine.
import { industryHistory } from './industryHistory.mjs';
import { assessEvidenceGraph } from './evidenceGraph.mjs';
import { validateGraph, policy as graphPolicy } from './evidenceGraphSchema.mjs';
export const SIGNAL_POLICY = 'config/industry/industry-signal-policy.v1.json';
export const SIGNAL_DOCUMENT = 'research-data/industry/signal-claim-v1/derived.json';
export const GRAPH_DOCUMENT = 'research-data/industry/signal-claim-v1/graphs.json';
export const SIGNAL_POLICY_REVIEWED_SHA256 = '73bb0c926a73c9f0e368aae21f139d1ec095810711a26817f160c42376b27f89';
export const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k])]));
  return value;
}
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const equal = (a, b) => canonical(a) === canonical(b);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const sorted = values => [...new Set(values)].sort();
export const digest = async raw => [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(b => b.toString(16).padStart(2, '0')).join('');
export const documentBytes = value => JSON.stringify(value, null, 2) + '\n';
const conditions = states => sorted(states.flatMap(s => s === 'missing' ? ['missing_evidence'] : s === 'STALE' ? ['stale'] : ['partial', 'stale', 'conflicted', 'not_admitted', 'unknown', 'missing_evidence'].includes(s) ? [s] : ['real', 'FRESH'].includes(s) ? [] : ['unknown']));

/** F2 semantics plus this domain's exact formula/manifest/owner binding. */
export function assessIndustryGraph(graph, request, resolvePin) {
  const assessment = assessEvidenceGraph(graph, request, { validate: validateGraph, resolvePin, policy: graphPolicy });
  const flags = [...assessment.conditions];
  try {
    const derivedNodes = graph.nodes.filter(n => n.kind === 'derived_metric');
    requireThat(derivedNodes.length === 1, 'INDUSTRY_DERIVED_OWNER');
    const n = derivedNodes[0], signal = resolvePin(n.ref), manifest = resolvePin(n.inputManifestRef);
    requireThat(signal.id === n.nodeId && signal.manifestId === manifest.id && equal(signal.formulaRef, n.formulaRef)
      && equal(manifest.formulaRef, n.formulaRef), 'FORMULA_MANIFEST_DRIFT');
    const incoming = graph.edges.filter(e => e.to === n.nodeId && e.type === 'input_to').map(e => graph.nodes.find(node => node.nodeId === e.from));
    requireThat(equal(incoming.map(node => canonical(node.ref)).sort(), manifest.inputRefs.map(canonical).sort()), 'MANIFEST_INPUT_DRIFT');
    for (const node of graph.nodes) {
      const value = resolvePin(node.ref);
      const origin = ['source', 'artifact', 'evidence'].includes(node.kind) ? 'source_material'
        : node.kind === 'fact' ? 'provider_fact' : node.kind === 'derived_metric' ? 'derived_result' : 'ai_draft';
      requireThat(node.origin === origin && node.releaseAvailableAt === null, 'OWNER_ORIGIN_OR_RELEASE_DRIFT');
      const ownerConditions = ['source', 'derived_metric'].includes(node.kind) ? signal.conditions
        : node.kind === 'claim' ? value.conditions
          : node.kind === 'fact' ? conditions([...value.conditions, value.quality.status])
            : conditions(manifest.inputRefs.flatMap(ref => {
              const o = resolvePin(ref);
              return (node.kind === 'artifact' && equal(o.provenance.captureRef, node.ref)) || (node.kind === 'evidence' && equal(o.provenance.evidence, value)) ? o.conditions : [];
            }));
      flags.push(...ownerConditions);
      requireThat(ownerConditions.every(c => node.conditions.includes(c)) && node.conditionSourceRefs.some(ref => equal(ref, node.ref)), 'OWNER_CONDITIONS_DROPPED');
      if (node.kind === 'fact') {
        requireThat(value.metricId === signal.metricId && value.industryId === signal.industryId && manifest.inputRefs.some(ref => equal(ref, node.ref)), 'FOREIGN_FACT');
        const upstream = graph.edges.filter(e => e.type === 'establishes' && e.to === node.nodeId).map(e => graph.nodes.find(n => n.nodeId === e.from));
        requireThat(upstream.length > 0 && upstream.every(n => equal(resolvePin(n.ref), value.provenance.evidence)), 'FACT_EVIDENCE_MISMATCH');
      }
      if (node.kind === 'source') requireThat(equal(node.ref, manifest.definitionRef), 'FOREIGN_SOURCE');
      if (node.kind === 'claim') requireThat(value.signalId === signal.id && value.status === 'CANDIDATE' && value.generation === 'TEMPLATE' && node.origin === value.origin, 'FOREIGN_CLAIM');
      if (node.kind === 'artifact') requireThat(manifest.inputRefs.some(ref => equal(resolvePin(ref).provenance.captureRef, node.ref)), 'FOREIGN_ARTIFACT');
      if (node.kind === 'evidence') {
        const matching = manifest.inputRefs.map(resolvePin).filter(o => equal(o.provenance.evidence, value));
        requireThat(matching.length > 0 && equal(node.nativeEvidenceRef, value), 'FOREIGN_EVIDENCE');
        const upstream = graph.edges.filter(e => e.type === 'locates' && e.to === node.nodeId).map(e => graph.nodes.find(n => n.nodeId === e.from));
        requireThat(upstream.length > 0 && upstream.every(n => matching.some(o => equal(o.provenance.captureRef, n.ref))), 'EVIDENCE_ARTIFACT_MISMATCH');
      }
    }
  } catch { flags.push('missing_evidence'); }
  const all = sorted(flags);
  return all.length ? { ...assessment, outcome: all.includes('conflicted') ? 'conflicted' : 'blocked', selectedRefs: [], citationRefs: [], conditions: all } : assessment;
}

/** Arithmetic kernel uses existing history identity/slot/conflict semantics. No fallback. */
export function retainedDifference(owner, basis) {
  const view = industryHistory(owner, basis), { latest, previous } = view;
  const flags = conditions([...view.states.filter(s => s !== 'missing'), ...[previous, latest].flatMap(p => p?.states ?? ['missing']),
    ...(owner.completeness.historicalCoverage === 'partial' ? ['partial'] : [])]);
  const comparable = basis === 'week_ending' && owner.definition.nativeFrequency === 'weekly'
    || basis === 'monthly' && owner.definition.nativeFrequency === 'monthly' && latest?.period.slice(0, 4) === previous?.period.slice(0, 4);
  // Historical gaps outside the operand pair remain partial; they must not erase usable operands.
  const pairPresent = comparable && owner.definition.unit !== '%' && !flags.includes('conflicted') && !flags.includes('missing_evidence') && latest?.value != null && previous?.value != null;
  const value = pairPresent ? latest.value - previous.value : null;
  return { value: Number.isFinite(value) ? value : null, previousPeriod: previous?.period ?? null, currentPeriod: latest?.period ?? null,
    conditions: sorted([...flags, ...(!pairPresent || !Number.isFinite(value) ? ['missing_evidence'] : [])]),
    inputs: [previous, latest].filter(Boolean).flatMap(p => p.records), computable: Boolean(pairPresent && Number.isFinite(value)) };
}

/** Exact archived-resource resolver. Bind identity via explicit pins registered by the owner adapter. */
async function resourcesContext(resources) {
  const files = new Map(), allowed = new Map();
  for (const resource of resources) {
    requireThat(!files.has(resource.path), 'DUPLICATE_RESOURCE_OWNER');
    files.set(resource.path, { raw: resource.raw, value: freeze(JSON.parse(resource.raw)), sha256: await digest(resource.raw) });
  }
  function resolveBytes(ref) {
    requireThat(ref && typeof ref.owner === 'string' && !/^(?:[A-Za-z]:|[/\\])|(?:^|[/\\])\.\.(?:[/\\]|$)/.test(ref.owner), 'PIN_OWNER');
    const file = files.get(ref.owner);
    requireThat(file && file.sha256 === ref.sha256 && /^[a-f0-9]{64}$/.test(ref.sha256), 'PIN_DIGEST');
    requireThat(typeof ref.locator === 'string' && ref.locator.startsWith('/') && !/~(?![01])/.test(ref.locator), 'PIN_LOCATOR');
    let value = file.value;
    for (const key of ref.locator.slice(1).split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'))) {
      requireThat(value && typeof value === 'object' && Object.hasOwn(value, key), 'PIN_LOCATOR'); value = value[key];
    }
    return value;
  }
  function register(ref, expected) {
    const value = resolveBytes(ref);
    requireThat(equal(value, expected), 'OWNER_VALUE_DRIFT');
    requireThat(typeof ref.objectId === 'string' && ref.objectId.length && typeof ref.version === 'string' && ref.version.length, 'PIN_IDENTITY');
    allowed.set(canonical(ref), value); return ref;
  }
  return { files, register, resolveBytes, resolvePin(ref) { requireThat(allowed.has(canonical(ref)), 'FOREIGN_OWNER_PIN'); return resolveBytes(ref); } };
}

/** Reviewed template only: the caller cannot provide text or a template body. */
function candidate(signal, definition, entry, templateRef) {
  if (signal.value === null || signal.conditions.some(c => ['conflicted', 'missing_evidence'].includes(c))) return null;
  const change = signal.value > 0 ? '增加' : signal.value < 0 ? '减少' : '持平，差额为';
  return { id: `${signal.id}:claim`, revision: '1', status: 'CANDIDATE', origin: 'ai_draft', generation: 'TEMPLATE',
    templateRef, signalId: signal.id, metricId: signal.metricId, industryId: signal.industryId,
    text: `当前留存快照中，${definition.canonicalName}在${signal.currentPeriod}较上一留存期${signal.previousPeriod}${change} ${Math.abs(signal.value)} ${entry.displayUnit}。`,
    conditions: signal.conditions, releaseAvailableAt: null, supportingSignalIds: [signal.id], contradictingSignalIds: [] };
}

export function prosperityEligibility(industryId, metrics, dimensions, graphs, gate) {
  const blockers = new Set(), reasons = [];
  const add = (code, refs) => { blockers.add(code); reasons.push({ code, refs: sorted(refs) }); };
  const required = gate.requiredDimensions[industryId] ?? [];
  const present = new Set(dimensions.list(industryId).map(m => m.mapping.dimension));
  const missingDimensions = required.filter(d => !present.has(d));
  if (!required.length || missingDimensions.length) add('DIMENSION_MISSING', missingDimensions);
  const observations = metrics.flatMap(m => m.owner.observations);
  if (!metrics.length || metrics.some(m => m.owner.policy.dataAdmission !== 'ADMITTED' || m.owner.policy.productionAdmission !== 'ADMITTED') || observations.some(o => o.dataAdmission !== 'ADMITTED' || o.productionAdmission !== 'ADMITTED')) add('DATA_NOT_ADMITTED', metrics.map(m => m.entry.metricId));
  if (!observations.length || observations.some(o => o.pit !== 'PROVEN')) add('PIT_UNPROVED', observations.filter(o => o.pit !== 'PROVEN').map(o => o.id));
  if (!observations.length || observations.some(o => !o.releaseAvailableAt || !Number.isFinite(Date.parse(o.releaseAvailableAt)))) add('RELEASE_TIME_UNKNOWN', observations.filter(o => !o.releaseAvailableAt).map(o => o.id));
  // No reviewed official revision-continuity proof adapter exists for these six owners.
  add('REVISION_CONTINUITY_UNKNOWN', metrics.map(m => m.entry.metricId));
  const states = metrics.flatMap(m => [...m.owner.definition.basis.flatMap(b => industryHistory(m.owner, b).states), ...(m.owner.completeness.historicalCoverage === 'partial' ? ['partial'] : [])]);
  if (states.includes('conflicted') || graphs.some(g => g.assessment.conditions.includes('conflicted'))) add('CONFLICTED_INPUT', metrics.map(m => m.entry.metricId));
  if (states.includes('missing') || states.includes('missing_evidence') || !graphs.length || graphs.some(g => g.assessment.conditions.includes('missing_evidence'))) add('MISSING_EVIDENCE', metrics.map(m => m.entry.metricId));
  if (states.includes('stale') || states.includes('STALE')) add('STALE_INPUT', metrics.map(m => m.entry.metricId));
  if (states.includes('partial')) add('PARTIAL_INPUT', metrics.map(m => m.entry.metricId));
  if (states.includes('unknown') || graphs.some(g => g.assessment.conditions.includes('unknown'))) add('UNKNOWN_INPUT', metrics.map(m => m.entry.metricId));
  if (metrics.some(m => m.owner.policy.entityResolution !== 'RESOLVED')) add('ENTITY_UNRESOLVED', metrics.map(m => m.entry.metricId));
  if (!gate.scopeCoverageProof) add('INDUSTRY_SCOPE_UNPROVED', [industryId]);
  if (gate.formalMethodAdmission !== 'ADMITTED') add('FORMAL_METHOD_NOT_ADMITTED', [gate.id]);
  if (!graphs.length || graphs.some(g => g.assessment.outcome !== 'supported')) add('EVIDENCE_NOT_SUPPORTED', graphs.map(g => g.graph.graphId));
  return { schemaVersion: 'industry-prosperity-eligibility.v1', policyVersion: gate.version, industryId,
    outcome: blockers.size ? 'ABSTAIN' : 'ELIGIBLE', eligibility: blockers.size ? 'NOT_ELIGIBLE' : 'ELIGIBLE',
    requiredDimensions: required, missingDimensions, blockers: [...blockers].sort(), reasons: reasons.sort((a, b) => a.code.localeCompare(b.code, 'en')) };
}

export async function buildIndustrySignalClaims({ provider, dimensions, resources }) {
  const context = await resourcesContext(resources), { files, register, resolveBytes } = context;
  const config = files.get(SIGNAL_POLICY)?.value;
  requireThat(config?.schemaVersion === 'industry-signal-policy.v1' && Array.isArray(config.entries), 'SIGNAL_POLICY_VERSION');
  const reviewed = { ...config, entries: [...config.entries].sort((a, b) => a.metricId.localeCompare(b.metricId, 'en')) };
  requireThat(await digest(canonical(reviewed)) === SIGNAL_POLICY_REVIEWED_SHA256, 'SIGNAL_POLICY_REVIEW_DRIFT');
  const configPin = (field, object) => register({ owner: SIGNAL_POLICY, locator: `/${field}`, objectId: object.id, version: object.revision, sha256: files.get(SIGNAL_POLICY).sha256 }, object);
  const formulaRef = configPin('formula', config.formula), templateRef = configPin('template', config.template);
  const entries = reviewed.entries, signals = [], manifests = [], claims = [], contexts = [];
  for (const entry of entries) {
    const metric = provider.get(entry.industryId, entry.metricId);
    requireThat(metric && equal(metric.entry.definitionRef, entry.definitionRef) && equal(metric.entry.artifactRef, entry.artifactRef), 'SIGNAL_EXACT_OWNER_REQUIRED');
    const { owner } = metric, d = owner.definition;
    requireThat(equal(files.get(entry.artifactRef.owner)?.value, owner), 'SIGNAL_OWNER_BYTES_DRIFT');
    register(entry.definitionRef, d); register(entry.artifactRef, d); register(metric.entry.policyRef, owner.policy);
    requireThat(d.id === entry.metricId && d.industryId === entry.industryId && d.unit === entry.unit && d.basis.includes(entry.basis), 'SIGNAL_IDENTITY_DRIFT');
    if (!entry.formulaId) continue;
    requireThat(entry.formulaId === config.formula.id && entry.formulaVersion === config.formula.version, 'FORMULA_DRIFT');
    const calculation = retainedDifference(owner, entry.basis);
    const inputRefs = calculation.inputs.map(o => {
      const index = owner.observations.findIndex(item => item === o);
      return register({ ...entry.artifactRef, locator: `/observations/${index}`, objectId: o.id, version: d.revision }, o);
    });
    for (const o of calculation.inputs) {
      const capture = resolveBytes(o.provenance.captureRef);
      requireThat(capture.path === o.provenance.rawPath && capture.sha256 === o.provenance.rawSha256 && capture.url === o.provenance.evidence.sourceUrl, 'CAPTURE_LINEAGE_DRIFT');
      register(o.provenance.captureRef, capture);
    }
    const id = `${entry.metricId}:${entry.basis}:${calculation.currentPeriod}:absolute-difference:v1`;
    const manifest = { id: `${id}:inputs`, revision: '1', formulaRef, definitionRef: entry.definitionRef,
      inputRefs, previousPeriod: calculation.previousPeriod, currentPeriod: calculation.currentPeriod, basis: entry.basis, fixedInputCount: 2 };
    const signal = { id, revision: '1', metricId: entry.metricId, industryId: entry.industryId, basis: entry.basis, unit: entry.unit,
      formulaRef, manifestId: manifest.id, value: calculation.value, previousPeriod: calculation.previousPeriod, currentPeriod: calculation.currentPeriod,
      conditions: calculation.conditions, dataAdmission: owner.policy.dataAdmission, productionAdmission: owner.policy.productionAdmission,
      pit: 'UNPROVED', releaseAvailableAt: null, revisionContinuity: 'unknown' };
    const claim = candidate(signal, d, entry, templateRef);
    signals.push(signal); manifests.push(manifest); if (claim) claims.push(claim);
    contexts.push({ metric, signal, manifest, claim, inputs: calculation.inputs, inputRefs });
  }
  for (const industry of Object.keys(config.gate.requiredDimensions)) requireThat(equal(provider.list(industry).map(m => m.entry.metricId).sort(), entries.filter(e => e.industryId === industry).map(e => e.metricId).sort()), 'SIGNAL_ROSTER_DRIFT');
  const derived = { schemaVersion: 'industry-derived-preview.v1', id: 'industry-derived-preview', revision: '1', assertedAt: config.assertedAt, signals, manifests, claims };
  const derivedRaw = documentBytes(derived), derivedSha = await digest(derivedRaw);
  files.set(SIGNAL_DOCUMENT, { raw: derivedRaw, value: freeze(derived), sha256: derivedSha });
  const derivedPin = (collection, object) => register({ owner: SIGNAL_DOCUMENT, objectId: object.id, version: object.revision, sha256: derivedSha, locator: `/${collection}/${derived[collection].indexOf(object)}` }, object);
  const graphs = [];
  for (const c of contexts) {
    const { metric, signal, manifest, claim, inputs, inputRefs } = c, nodes = [], edges = [];
    const node = (nodeId, kind, ref, origin, flags, extra = {}) => { nodes.push({ nodeId, kind, ref, origin, releaseAvailableAt: null, conditions: flags, conditionSourceRefs: [ref], ...extra }); return nodeId; };
    const edge = (from, to, type) => edges.push({ relationId: `${from}:${type}:${to}`, from, to, type, assertedAt: config.assertedAt, supersedesRelationId: null });
    const source = node(`${signal.id}:source`, 'source', metric.entry.definitionRef, 'source_material', signal.conditions,
      { conditionSourceRefs: [metric.entry.definitionRef, metric.entry.policyRef, metric.entry.artifactRef] });
    const derivedId = node(signal.id, 'derived_metric', derivedPin('signals', signal), 'derived_result', signal.conditions, { formulaRef, inputManifestRef: derivedPin('manifests', manifest) });
    inputs.forEach((o, i) => {
      const artifact = node(`${signal.id}:artifact:${i}`, 'artifact', o.provenance.captureRef, 'source_material', conditions([...o.conditions, o.quality.status]));
      const evidenceRef = register({ ...inputRefs[i], objectId: o.provenance.evidence.refId, locator: `${inputRefs[i].locator}/provenance/evidence` }, o.provenance.evidence);
      const evidence = node(`${signal.id}:evidence:${i}`, 'evidence', evidenceRef, 'source_material', conditions(o.conditions), { nativeEvidenceRef: o.provenance.evidence });
      const fact = node(`${signal.id}:fact:${i}`, 'fact', inputRefs[i], 'provider_fact', conditions([...o.conditions, o.quality.status]));
      edge(source, artifact, 'publishes'); edge(artifact, evidence, 'locates'); edge(evidence, fact, 'establishes'); edge(fact, derivedId, 'input_to');
    });
    if (claim) { node(claim.id, 'claim', derivedPin('claims', claim), 'ai_draft', claim.conditions); edge(derivedId, claim.id, 'supports'); }
    const graph = { schemaVersion: 'evidence-graph.v1', graphId: `${signal.id}:graph`, revision: 1, asOf: config.assertedAt, nodes, edges };
    const targetNodeId = claim?.id ?? signal.id;
    const assessment = assessIndustryGraph(graph, { asOf: config.assertedAt, targetNodeId }, context.resolvePin);
    graphs.push({ graph, targetNodeId, assessment });
  }
  const gates = Object.keys(config.gate.requiredDimensions).sort().map(industry => prosperityEligibility(industry, provider.list(industry), dimensions, graphs.filter(g => contexts.find(c => c.signal.id === g.graph.nodes.find(n => n.kind === 'derived_metric')?.nodeId)?.signal.industryId === industry), config.gate));
  return freeze({ derived, graphs, gates, resolvePin: context.resolvePin });
}
