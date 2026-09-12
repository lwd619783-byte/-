import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { ROOT, bytes, read, pin, resolve, refName, sha256, unique, valid, QUERY, CATALOG, instant, periodBounds } from './common.mjs';
import { BINDINGS, DEFINITIONS, POLICY, PBC_REPORT, checkBindings } from './bindings.mjs';
import { selectVintage } from './selection.mjs';

const CSV = 'research-data/market-regime/source-catalog/pbc-final-vintages.v1.csv';
const PROVENANCE = 'scripts/tests/fixtures/market_regime/pbc-r2b-parser-fixtures.provenance.json';
const blocker = (code, condition, refs = []) => ({ code, condition, refs: unique(refs) });
// This is a compact CSV ledger reader, not a second Observation model or source parser.
function csvRows(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(cell.replace(/\r$/, '')); cell = ''; if (c === '\n') { rows.push(row); row = []; } }
    else cell += c;
  }
  if (quoted) throw new Error('CSV_QUOTE');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const header = rows.shift();
  if (!header || unique(header).length !== header.length || rows.some((r) => r.length !== header.length)) throw new Error('CSV_SHAPE');
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}
export function replayCommittedPbc({ root = ROOT } = {}) {
  const report = read(PBC_REPORT, root), definitions = read(DEFINITIONS, root);
  const rows = csvRows(bytes(CSV, root).toString('utf8'));
  const blockers = [blocker('FORMAL_CATALOG_NOT_COMMITTED', 'missing_evidence', [PBC_REPORT + '#/sealedOutput', CSV]),
    blocker('FIELD_EXTRACTION_GRAPH_NOT_COMMITTED', 'missing_evidence', [PBC_REPORT + '#/sidecarContentHashes']),
    blocker('RELEASE_CALENDAR_UNPROVEN', 'unknown', ['docs/market-regime/metric-registry-v1.md#native-frequency-release-calendar-and-stale-rules'])];
  // Real report state is read, never inferred from its validationStatus=PASS.
  const sourceAdmission = report.admissionStatus === 'PARTIAL' ? 'PARTIAL' : report.admissionStatus === 'NOT_ADMITTED' ? 'NOT_ADMITTED' : 'UNKNOWN';
  blockers.push(blocker(sourceAdmission === 'PARTIAL' ? 'SOURCE_PARTIAL' : sourceAdmission === 'NOT_ADMITTED' ? 'SOURCE_NOT_ADMITTED' : 'ADMISSION_UNKNOWN', sourceAdmission === 'PARTIAL' ? 'partial' : sourceAdmission === 'NOT_ADMITTED' ? 'not_admitted' : 'unknown', [PBC_REPORT + '#/admissionStatus']));
  if (rows.length !== report.observationCount || unique(rows.map((r) => r.observationId)).length !== rows.length) blockers.push(blocker('COMPACT_LEDGER_IDENTITY', 'conflicted', [CSV, PBC_REPORT]));
  const counts = {};
  for (const row of rows) {
    counts[row.metricId] = (counts[row.metricId] ?? 0) + 1;
    const defs = definitions.filter((d) => d.sourceDefinitionId === row.sourceDefinitionId);
    const bounds = periodBounds(row.valueDate);
    if (defs.length !== 1 || defs[0].metricId !== row.metricId || defs[0].unit !== row.unit || !bounds || bounds.start < defs[0].effectiveFrom || (defs[0].effectiveTo && bounds.end > defs[0].effectiveTo)) blockers.push(blocker('COMPACT_DEFINITION_MISMATCH', 'unknown', [CSV + '#' + row.observationId, DEFINITIONS]));
    if (!Number.isFinite(instant(row.releaseAvailableAt))) blockers.push(blocker('COMPACT_RELEASE_UNKNOWN', 'unknown', [row.observationId]));
    if (!/^\d+$/.test(row.revisionSequence)) blockers.push(blocker('COMPACT_REVISION_UNKNOWN', 'unknown', [row.observationId]));
  }
  for (const [metric, count] of Object.entries(counts)) {
    const extra = Object.values(report.sourceCoverage).flat().filter((window) => window.windowId.endsWith('-backcast-search') && definitions.some((d) => d.metricId === metric && window.windowId === d.sourceDefinitionId + '-backcast-search')).reduce((sum, window) => sum + window.counts.vintageCount, 0);
    if (report.metricCounts?.[metric]?.vintageCount + extra !== count) blockers.push(blocker('COMPACT_METRIC_COUNT_MISMATCH', 'conflicted', [metric, CSV, PBC_REPORT]));
  }
  const provenance = read(PROVENANCE, root);
  const selected = provenance.filter((p) => p.fixture === 'pbc-r2b-m2-2011-10.html');
  let excerpt = null;
  if (selected.length === 1) {
    const p = selected[0], owner = 'scripts/tests/fixtures/market_regime/' + p.fixture;
    const body = bytes(owner, root);
    const url = new URL(p.sourceUrl);
    const official = url.protocol === 'https:' && (url.hostname === 'pbc.gov.cn' || url.hostname.endsWith('.pbc.gov.cn'));
    if (!official || p.sourceId !== 'PBOC_M2_OFFICIAL_RELEASE' || p.artifactRole !== 'TEST_FIXTURE_EXCERPT' || sha256(body) !== p.fixtureSha256) blockers.push(blocker('PBC_EXCERPT_IDENTITY', 'missing_evidence', [PROVENANCE, owner]));
    else excerpt = { owner, sha256: p.fixtureSha256, sourceId: p.sourceId, sourceUrl: p.sourceUrl,
      artifactRole: p.artifactRole, originalRawSha256: p.rawSourceSha256, retainedBytesVerified: true,
      matchingObservationRefs: rows.filter((r) => r.valueDate === '2011-10' && r.metricId.startsWith('MACRO_M2_') && r.releaseAvailableAt === p.publicationDateTime).map((r) => r.observationId).sort() };
  }
  if (!excerpt) blockers.push(blocker('PBC_RETAINED_EVIDENCE_MISSING', 'missing_evidence', [PROVENANCE]));
  else blockers.push(blocker('EXCERPT_IS_NOT_RAW_SOURCE', 'missing_evidence', [excerpt.owner, PROVENANCE]));
  let bindingStatus = 'BLOCKED';
  try {
    if (path.resolve(root) === path.resolve(ROOT)) checkBindings();
    else {
      // Export replay verifies the retained pins and identity; root never falls back to this checkout.
      for (const b of read(BINDINGS, root)) {
        const d = resolve(b.sourceDefinitionRef, root);
        if (d.sourceDefinitionId !== b.sourceDefinitionRef.objectId || d.version !== b.sourceDefinitionRef.version) throw new Error('IDENTITY');
        resolve(b.policyRef, root);
      }
    }
    bindingStatus = 'PASS';
  } catch { blockers.push(blocker('SEMANTIC_BINDING_INVALID', 'unknown', [BINDINGS, POLICY])); }
  return { sourceAdmission, observationCount: rows.length, eligibleValueCount: 0,
    semanticBindingValidation: bindingStatus, semanticBindingCompleteness: 'BLOCKED',
    metricVintageCounts: counts, retainedEvidenceReplay: excerpt,
    // Missing aggregation/reporting/freshness owner bindings stay unknown.
    blockers: [...blockers, blocker('SEMANTIC_BINDING_INCOMPLETE', 'unknown', [BINDINGS])].sort((a, b) => a.code.localeCompare(b.code, 'en')) };
}

export function queryForDefinition(sourceDefinitionId, period, asOf, use = 'strict_pit') {
  const bindings = checkBindings(), index = bindings.findIndex((b) => b.sourceDefinitionRef.objectId === sourceDefinitionId);
  if (index < 0) throw new Error('BINDING_NOT_FOUND');
  const b = bindings[index], scope = read(POLICY).scopes[sourceDefinitionId];
  return { entity: scope.entity, bindingId: b.bindingId, bindingRef: pin(BINDINGS, `/${index}`, b.bindingId, '2'),
    scopeRef: pin(POLICY, '/scopes/' + sourceDefinitionId, scope.id, scope.version),
    definitionVersion: b.sourceDefinitionRef.version, scopeVersion: scope.version,
    period: { ...period, scope: scope.periodScope }, asOf, use };
}

/** Public read-only domain entrypoint. All authority/conditions are owner-projected here. */
export function queryMacro(request, { catalogPath = null } = {}) {
  const context = { definition: {}, blockers: [], admission: 'UNKNOWN', coverage: {targetCount: null, availableCount: null}, conflict: 'UNKNOWN', freshness: 'UNKNOWN', verifyEvidence: () => ({refs: [], blockers: []}) };
  const deny = (code, condition = 'unknown', refs = []) => {
    context.blockers.push(blocker(code, condition, refs));
    return selectVintage([], { asOf: request?.asOf }, context);
  };
  if (!valid(QUERY, request)) return deny('QUERY_SCHEMA_INVALID');
  let binding, definition, scope, policy;
  try {
    const bindings = checkBindings();
    binding = resolve(request.bindingRef);
    if (request.bindingRef.owner !== BINDINGS || request.bindingRef.objectId !== binding.bindingId || request.bindingRef.version !== '2' || binding.bindingId !== request.bindingId || !bindings.some((b) => isDeepStrictEqual(b, binding))) return deny('BINDING_IDENTITY');
    definition = resolve(binding.sourceDefinitionRef); scope = resolve(request.scopeRef); policy = resolve(binding.policyRef);
    if (definition.sourceDefinitionId !== binding.sourceDefinitionRef.objectId || definition.version !== binding.sourceDefinitionRef.version) return deny('DEFINITION_IDENTITY');
    const expectedScope = read(POLICY).scopes[definition.sourceDefinitionId];
    if (request.scopeRef.owner !== POLICY || request.scopeRef.objectId !== expectedScope.id || request.scopeRef.version !== expectedScope.version || !isDeepStrictEqual(scope, expectedScope) || !isDeepStrictEqual(resolve(scope.definitionRef), definition)) return deny('SCOPE_IDENTITY');
  } catch { return deny('PIN_OR_OWNER_INVALID', 'missing_evidence', [request.bindingRef.owner, request.scopeRef.owner]); }
  context.definition = definition;
  if (request.entity.entityType !== scope.entity.entityType || request.entity.entityId !== scope.entity.entityId) return deny('ENTITY_IDENTITY');
  if (request.definitionVersion !== definition.version || request.scopeVersion !== scope.version || request.period.scope !== scope.periodScope || request.period.start > request.period.end) return deny('DEFINITION_SCOPE_PERIOD_MISMATCH');
  if (request.period.start < definition.effectiveFrom || (definition.effectiveTo && request.period.end > definition.effectiveTo)) return deny('DEFINITION_PERIOD_MISMATCH');
  if (!binding.allowedUses.includes(request.use) || binding.forbiddenUses.includes(request.use) || !policy.allowedUses.includes(request.use) || policy.forbiddenUses.includes(request.use)) return deny('USE_FORBIDDEN', 'not_admitted');
  let report, replay;
  try { report = read(PBC_REPORT); replay = replayCommittedPbc(); }
  catch { return deny('SOURCE_EVIDENCE_MISSING', 'missing_evidence', [PBC_REPORT, CSV, PROVENANCE]); }
  context.admission = replay.sourceAdmission;
  context.coverage = { targetCount: report.metricCounts[definition.metricId]?.targetCount ?? null, availableCount: report.metricCounts[definition.metricId]?.availableCount ?? null };
  // A compact historical conflict count is not current revision/exhaustiveness proof.
  context.conflict = report.conflictCount > 0 ? 'CONFLICTED' : 'UNKNOWN';
  context.blockers.push(...replay.blockers);
  if (!policy.admittedUses.includes(request.use)) context.blockers.push(blocker('OWNER_USE_NOT_ADMITTED', 'not_admitted', [refName(binding.policyRef)]));
  if (catalogPath === null) {
    const result = selectVintage([], request, context);
    // Compact ledger columns remain diagnostic evidence, never fabricated complete vintages.
    // Do not leak future values, IDs or temporal metadata into historical query output.
    const diagnosticRows = csvRows(bytes(CSV).toString('utf8')).filter((r) => r.metricId === definition.metricId && r.sourceDefinitionId === definition.sourceDefinitionId && r.unit === definition.unit && isDeepStrictEqual(periodBounds(r.valueDate), {start: request.period.start, end: request.period.end}) && instant(r.releaseAvailableAt) <= instant(request.asOf)).sort((a, b) => a.observationId.localeCompare(b.observationId, 'en'));
    result.evidenceRefs = unique([refName(binding.sourceDefinitionRef), refName(binding.policyRef), PBC_REPORT, ...diagnosticRows.map((r) => CSV + '#observation:' + r.observationId)]);
    result.temporal = diagnosticRows.map((r) => ({ observationId: r.observationId, observationDate: r.valueDate,
      publicationDateTime: null, publicationDate: null, releaseAvailableAt: r.releaseAvailableAt,
      releaseConfidenceClass: null, effectiveFrom: definition.effectiveFrom, effectiveTo: definition.effectiveTo,
      revisionSequence: /^\d+$/.test(r.revisionSequence) ? Number(r.revisionSequence) : null, supersedesObservationId: r.supersedesObservationId || null }));
    result.lineage = diagnosticRows.map((r) => ({ observationId: r.observationId, sourceId: definition.sourceId,
      sourceDefinitionId: r.sourceDefinitionId, rawArtifactId: r.rawArtifactId, transformVersion: null }));
    if (diagnosticRows.length) result.quality = ['UNKNOWN'];
    return result;
  }
  let catalog;
  try { catalog = read(catalogPath); } catch { return deny('CATALOG_MISSING', 'missing_evidence', [catalogPath]); }
  if (!valid(CATALOG, catalog)) return deny('CATALOG_SCHEMA_INVALID', 'unknown', [catalogPath]);
  const catalogDefs = catalog.sourceDefinitions.filter((d) => d.sourceDefinitionId === definition.sourceDefinitionId);
  if (catalogDefs.length !== 1 || !isDeepStrictEqual(catalogDefs[0], definition)) return deny('CATALOG_DEFINITION_IDENTITY');
  context.verifyEvidence = (o) => {
    const refs = [catalogPath + '#observation:' + o.observationId, PBC_REPORT, refName(binding.sourceDefinitionRef)], blockers = [];
    const artifacts = catalog.artifacts.filter((a) => a.artifactId === o.rawArtifactId);
    if (artifacts.length !== 1) return { refs, blockers: [blocker('ARTIFACT_MISSING_OR_AMBIGUOUS', 'missing_evidence', [o.rawArtifactId])] };
    const a = artifacts[0]; refs.push(catalogPath + '#artifact:' + a.artifactId);
    try {
      const raw = bytes(a.localPath), url = new URL(a.sourceUrl), host = policy.sourceOwners[o.sourceId];
      if (!host || url.protocol !== 'https:' || !(url.hostname === host || url.hostname.endsWith('.' + host)) || a.sourceId !== o.sourceId) blockers.push(blocker('SOURCE_AUTHORITY_MISMATCH', 'not_admitted', refs));
      if (sha256(raw) !== a.sha256 || raw.length !== a.byteSize || a.parseStatus !== 'PARSED' || a.error !== null) blockers.push(blocker('ARTIFACT_BYTES_OR_PARSE_INVALID', 'missing_evidence', refs));
      if (a.artifactRole !== 'RAW_SOURCE') blockers.push(blocker('EXCERPT_IS_NOT_RAW_SOURCE', 'missing_evidence', refs));
      if (a.releaseAvailableAt !== o.releaseAvailableAt || a.publicationDateTime !== o.releaseDateTime || a.releaseConfidenceClass !== o.releaseConfidenceClass) blockers.push(blocker('RELEASE_EVENT_MISMATCH', 'unknown', refs));
      const nextDay = a.publicationDate ? new Date(Date.parse(a.publicationDate + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10) + 'T00:00:00+08:00' : null;
      if ((a.releaseConfidenceClass === 'EXACT_TIMESTAMP' && a.releaseAvailableAt !== a.publicationDateTime) || (a.releaseConfidenceClass === 'DATE_ONLY_SAFE' && (a.publicationDateTime !== null || a.releaseAvailableAt !== nextDay))) blockers.push(blocker('RELEASE_PRECISION_INVALID', 'unknown', refs));
    } catch { blockers.push(blocker('ARTIFACT_EVIDENCE_MISSING', 'missing_evidence', refs)); }
    return { refs, blockers };
  };
  return selectVintage(catalog.observations, request, context);
}
