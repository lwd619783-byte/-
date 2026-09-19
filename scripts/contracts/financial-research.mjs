// Offline contract checker only. No production retrieval, Provider or database integration.
import { assessEvidenceGraph } from '../../src/services/evidenceGraph.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const directory = 'contracts/financial-research/v1/';
const base = 'https://investment-dashboard.local/' + directory;
const read = (name) => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const unique = (items) => [...new Set(items)].sort();
const instant = (s) => s === null ? NaN : Date.parse(s);
// Match the existing V1 registry: conditional required fields are declared in parent schemas.
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, ownProperties: true });
addFormats(ajv);
ajv.addSchema(read('contracts/v1/research-asset-os.contracts.v1.schema.json'));
ajv.addSchema(read('config/market-regime/observation-catalog.schema.json'));
for (const file of readdirSync(path.join(root, directory)).filter((f) => f.endsWith('.schema.json'))) ajv.addSchema(read(directory + file));
export function validate(name, value) {
  const check = ajv.getSchema(base + name);
  requireThat(check && check(value), `SCHEMA_INVALID ${name}: ${ajv.errorsText(check?.errors)}`);
}
export function resolvePin(pin) {
  const filename = path.resolve(root, pin.owner);
  requireThat(filename.startsWith(root) && !path.isAbsolute(pin.owner) && !pin.owner.split(/[\\/]/).includes('..'), 'PIN_PATH');
  const bytes = readFileSync(filename);
  requireThat(createHash('sha256').update(bytes).digest('hex') === pin.sha256, 'PIN_DIGEST');
  const pointer = pin.locator.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  const document = JSON.parse(bytes);
  let value = document;
  for (const key of pointer) { requireThat(value !== null && typeof value === 'object' && Object.hasOwn(value, key), 'PIN_LOCATOR'); value = value[key]; }
  const ownerPath = path.relative(root, filename).replaceAll('\\', '/');
  if (ownerPath.startsWith(directory + 'fixtures/')) {
      // Synthetic fixtures have an explicit identity even where the reused business schema
      // cannot accept id/revision fields. Real owner equivalence remains adapter-owned.
      requireThat(value && typeof value === 'object', 'PIN_SYNTHETIC_IDENTITY');
      const scenario = ownerPath === directory + 'fixtures/scenarios.json';
      const binding = ownerPath === directory + 'fixtures/bindings.json';
      const graph = scenario && pointer.length === 2 && pointer[1] === 'graph' && value.schemaVersion === 'evidence-graph.v1';
      requireThat(graph || pointer.length === 1, 'PIN_LOCATOR');
      if (!scenario && !binding) requireThat(typeof value.id === 'string' && typeof value.revision === 'string', 'PIN_SYNTHETIC_IDENTITY');
      const identity = graph ? value.graphId : binding ? value.bindingId : scenario ? pointer[0] : value.id;
      const version = graph || (!scenario && !binding) ? String(value.revision) : '1';
      requireThat(identity === pin.objectId, 'PIN_IDENTITY');
      requireThat(version === pin.version, 'PIN_VERSION');
  }
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, 'id')) requireThat(value.id === pin.objectId, 'PIN_IDENTITY');
    // Industry observation.revision is source continuity metadata, not its retained
    // owner version. The exact artifact digest and observation locator pin that version.
    if (document.schemaVersion === 'industry-metric.v1' && /^\/observations\/\d+$/.test(pin.locator)) {
      requireThat(value.metricId === document.definition.id && value.industryId === document.definition.industryId
        && pin.version === document.definition.revision, 'PIN_INDUSTRY_OBSERVATION_VERSION');
    } else if (Object.hasOwn(value, 'revision')) requireThat(String(value.revision) === pin.version, 'PIN_VERSION');
  }
  // A pin identifies owner bytes + locator. Domain identity/version equivalence needs its owner adapter.
  return value;
}
export const vectors = read(directory + 'golden-cases.v1.json');
const policy = read(directory + 'relation-policy.v1.json');
const projectState = (owner, value) => policy.stateProjections[owner]?.[value] ?? ['unknown'];
function result(conditions = [], fields = {}) {
  const flags = unique(conditions);
  return { outcome: flags.includes('conflicted') ? 'conflicted' : flags.length ? 'blocked' : 'eligible', selectedRefs: [], citationRefs: [], conditions: flags, value: null, unit: null, exAnte: null, reproducible: null, ...fields };
}
export function validateBinding(binding) {
  validate('semantic-binding.v2.schema.json', binding);
  for (const ref of [binding.metricDefinitionRef, binding.sourceDefinitionRef, binding.policyRef]) resolvePin(ref);
  requireThat(!binding.allowedUses.some((use) => binding.forbiddenUses.includes(use)), 'POLICY_OVERLAP');
  for (const field of Object.values(binding.fieldBindings).filter(Boolean)) {
    const [file, definition] = field.ownerContract.split('#');
    let owner = read(file);
    for (const part of definition.split('/').slice(1)) owner = owner[part];
    requireThat(owner?.properties && Object.hasOwn(owner.properties, field.pointer.slice(1)), 'BINDING_FIELD_UNKNOWN');
  }
  // Temporal roles may be absent; present roles must never alias each other.
  const times = ['observationDate', 'publicationDate', 'releaseAvailableAt', 'effectiveDate'].map((r) => binding.fieldBindings[r]).filter(Boolean).map((x) => JSON.stringify(x));
  requireThat(unique(times).length === times.length, 'TEMPORAL_ALIAS');
  const timeFields = {
    observationDate: ['/valueDate', '/tradeDate', '/reportPeriod'],
    publicationDate: ['/releaseDateTime', '/publicationDate', '/publicationDateTime', '/sourcePublishedAt', '/publishedAt'],
    releaseAvailableAt: ['/releaseAvailableAt'],
    effectiveDate: ['/effectiveFrom', '/effectiveDate'],
  };
  for (const [role, allowed] of Object.entries(timeFields)) {
    if (binding.fieldBindings[role]) requireThat(allowed.includes(binding.fieldBindings[role].pointer), 'TEMPORAL_ROLE');
  }
}
function retrieve(input, request) {
  const binding = resolvePin(request.bindingRef);
  validateBinding(binding); resolvePin(request.scopeRef);
  requireThat(binding.bindingId === request.bindingId, 'BINDING_IDENTITY');
  requireThat(instant(request.asOf) === instant(request.asOf) && request.period.start <= request.period.end, 'QUERY_TIME');
  if (!input.allowedUses.includes(request.use) || !binding.allowedUses.includes(request.use) || binding.forbiddenUses.includes(request.use)) return result(['not_admitted']);
  if (input.conditions.length) return result(input.conditions);
  const matches = input.series.filter((s) => s.entity.entityType === request.entity.entityType && s.entity.entityId === request.entity.entityId && s.bindingId === request.bindingId && s.definitionVersion === request.definitionVersion && s.scopeVersion === request.scopeVersion && isDeepStrictEqual(s.period, request.period));
  if (!matches.length) return result([], { outcome: 'missing' });
  const observations = matches.flatMap((s) => s.observations);
  requireThat(unique(observations.map((o) => o.observationId)).length === observations.length, 'DUPLICATE_OBSERVATION');
  const available = observations.filter((o) => instant(o.releaseAvailableAt) <= instant(request.asOf));
  if (!available.length) return result(['unknown']);
  // A newer, available but inadmissible revision cannot silently fall back to an older trusted value.
  if (request.use === 'strict_pit' && available.some((o) => !['EXACT_TIMESTAMP', 'DATE_ONLY_SAFE'].includes(o.releaseConfidenceClass))) return result(['unknown']);
  const quality = available.flatMap((o) => [...projectState('MetricObservationVintage.qualityStatus', o.qualityStatus), ...(o.value === null ? ['partial'] : [])]);
  if (quality.length) return result(quality);
  const byId = new Map(available.map((o) => [o.observationId, o]));
  for (const o of available) {
    if (o.supersedesObservationId === null) { requireThat(o.revisionSequence === 0, 'REVISION_ROOT'); continue; }
    const prior = byId.get(o.supersedesObservationId);
    requireThat(prior && prior.revisionSequence < o.revisionSequence && instant(prior.releaseAvailableAt) <= instant(o.releaseAvailableAt), 'REVISION_LINEAGE');
    requireThat(['metricId', 'unit', 'sourceId', 'sourceDefinitionId', 'valueDate'].every((k) => prior[k] === o[k]), 'REVISION_KEY');
  }
  const superseded = new Set(available.map((o) => o.supersedesObservationId));
  const terminal = available.filter((o) => !superseded.has(o.observationId));
  if (terminal.length !== 1) return result(['conflicted']);
  const selected = terminal[0];
  try { requireThat(input.artifactRefs[selected.rawArtifactId], 'ARTIFACT_MISSING'); resolvePin(input.artifactRefs[selected.rawArtifactId]); } catch { return result(['missing_evidence']); }
  return result([], { selectedRefs: [selected.observationId], citationRefs: [selected.rawArtifactId], value: selected.value, unit: selected.unit });
}
export function assessGraph(graph, request) {
  return assessEvidenceGraph(graph, request, { validate, resolvePin, policy });
}

function earnings(input, request) {
  resolvePin(input.expectationRef); resolvePin(input.actualRef);
  const availability = Math.max(instant(input.formationLatest), instant(input.sourceLatest));
  const earliest = Math.min(...input.disclosureEarliest.map(instant));
  const ok = input.disclosureEarliest.length > 0 && availability < earliest && earliest <= instant(request.asOf) && input.sourceVerified && input.sameMeasurementKey && !input.unknownDisclosureScope;
  return ok ? result([], { selectedRefs: [input.expectationRef.objectId, input.actualRef.objectId], citationRefs: [input.expectationRef.objectId, input.actualRef.objectId], exAnte: true }) : result(['unknown'], { exAnte: false });
}
function recompute(input, request) {
  const refs = [input.formulaRef, input.inputManifestRef, input.calendarRef, input.scopeRef, ...input.inputRefs];
  const [formula, manifest, , , ...values] = refs.map(resolvePin);
  if (input.conditions.length || input.values.some((v) => v === null) || input.fixedDenominator === null || input.fixedDenominator <= 0) return result([...input.conditions, 'partial'], { reproducible: false });
  requireThat(formula.synthetic === true && formula.operation === 'sum_divide_fixed_denominator' && formula.version === 'fixture-only.v1', 'UNFROZEN_FORMULA');
  requireThat(manifest.fixedDenominator === input.fixedDenominator && isDeepStrictEqual(manifest.inputs, input.inputRefs.map((r) => r.objectId)), 'MANIFEST_INPUTS');
  requireThat(isDeepStrictEqual(input.values, values.map((v) => v.value)), 'INPUT_VALUE_DRIFT');
  requireThat(manifest.calendar === input.calendarRef.objectId && manifest.scope === input.scopeRef.objectId && manifest.cutoff === input.cutoff && instant(input.cutoff) <= instant(request.asOf), 'MANIFEST_CONTEXT');
  if (values.some((v) => !(instant(v.releaseAvailableAt) <= instant(input.cutoff)))) return result(['unknown'], { reproducible: false });
  return result([], { selectedRefs: input.inputRefs.map((r) => r.objectId), citationRefs: refs.map((r) => r.objectId), value: input.values.reduce((sum, value) => sum + value, 0) / input.fixedDenominator, unit: input.unit, reproducible: true });
}
// Reference execution only: no case identity, rationale or expected result enters the oracle.
// Kept in the contract checker, never imported by production domain services.
export function executeReference({ operation, input, request }) {
  validate('test-input.v1.schema.json', input);
  requireThat(input.kind === operation, 'OPERATION_MISMATCH');
  requireThat(['retrieve', 'assess_graph', 'qualify_earnings', 'recompute'].includes(operation), 'OPERATION_UNKNOWN');
  return operation === 'retrieve' ? retrieve(input, request) : operation === 'assess_graph' ? assessGraph(input.graph, request) : operation === 'qualify_earnings' ? earnings(input, request) : recompute(input, request);
}
export function checkCase(vector) {
  validate('golden-case.v1.schema.json', vector);
  const input = resolvePin(vector.fixtureRef);
  validate('test-input.v1.schema.json', input);
  requireThat(input.kind === vector.operation, 'OPERATION_MISMATCH');
  const queryName = vector.operation === 'retrieve' ? 'Query' : null;
  if (queryName) requireThat(ajv.getSchema(base + 'shared.schema.json#/$defs/Query')(vector.request), 'REQUEST_SHAPE');
  else requireThat(typeof vector.request.asOf === 'string' && (vector.operation !== 'assess_graph' || typeof vector.request.targetNodeId === 'string'), 'REQUEST_SHAPE');
  const actual = executeReference({ operation: vector.operation, input, request: vector.request });
  requireThat(ajv.getSchema(base + 'shared.schema.json#/$defs/Result')(actual), 'RESULT_SCHEMA');
  const normalize = (r) => ({ ...r, selectedRefs: unique(r.selectedRefs), citationRefs: unique(r.citationRefs), conditions: unique(r.conditions) });
  requireThat(isDeepStrictEqual(normalize(actual), normalize(vector.expected)), `GOLDEN_MISMATCH ${vector.caseId}: ${JSON.stringify(actual)}`);
  return actual;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
export const releasedSuiteSha256 = 'd2b95cba7576174a576d4f7de19c0b168fc1e50accfae1f413929a84d4b63610';
export function checkSuite(cases) {
  const bytes = readFileSync(path.join(root, directory, 'golden-suite.v1.json'));
  requireThat(createHash('sha256').update(bytes).digest('hex') === releasedSuiteSha256, 'SUITE_MANIFEST_DRIFT');
  const suite = JSON.parse(bytes);
  const identities = cases.map((c) => `${c.caseId}@${c.version}`);
  requireThat(unique(identities).length === cases.length, 'SUITE_DUPLICATE_IDENTITY');
  requireThat(isDeepStrictEqual(unique(identities), suite.cases.map((c) => `${c.caseId}@${c.version}`).sort()), 'SUITE_ROSTER');
  for (const c of cases) {
    const frozen = suite.cases.find((entry) => entry.caseId === c.caseId && entry.version === c.version);
    requireThat(createHash('sha256').update(JSON.stringify(canonical(c))).digest('hex') === frozen.sha256, 'SUITE_CASE_DRIFT');
  }
  return suite;
}
export function checkAll() {
  checkSuite(vectors);
  validateBinding(read(directory + 'fixtures/bindings.json')['fixture-macro']);
  validateBinding(read(directory + 'examples/pbc-binding.json'));
  requireThat(unique(vectors.map((v) => v.caseId)).length === vectors.length, 'DUPLICATE_CASE');
  requireThat(unique(vectors.map((v) => v.category)).length === 8, 'CATEGORY_COVERAGE');
  for (const vector of vectors) checkCase(vector);
  return { status: 'PASS', cases: vectors.length, categories: 8, runtime: 'NOT_IMPLEMENTED', admission: 'NOT_ADMITTED' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(checkAll())); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
