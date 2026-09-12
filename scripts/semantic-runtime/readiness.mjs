import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import Ajv from 'ajv';
import { replayCommittedPbc } from './market-regime-adapter.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORT_PATH = 'research-data/market-regime/semantic-readiness/report.v1.json';
const SCHEMA_PATH = 'contracts/stage-4-1/v1/readiness.schema.json';
const PBC = 'research-data/market-regime/source-catalog/pbc-final-evidence.v1.json';
const CSRC = 'research-data/market-regime/source-catalog/csrc-c2a2/ipo-provenance-admission.v1.json';
const ALL_A = 'research-data/market-regime/source-catalog/all-a-d3/admission-report.v1.json';
const REGISTRY = 'docs/market-regime/metric-registry-v1.md';
const FORMULA = 'docs/market-regime/formula-normalization-v1.md';
const BACKTEST = 'docs/market-regime/backtest-dataset-design-v1.md';
const RUNTIME_INPUTS = [
  'config/market-regime/pbc-historical-definitions.v1.json',
  'config/market-regime/semantic-bindings.v2.json',
  'config/market-regime/semantic-owner-policy.v1.json',
  'research-data/market-regime/source-catalog/pbc-final-vintages.v1.csv',
  'scripts/tests/fixtures/market_regime/pbc-r2b-parser-fixtures.provenance.json',
  'scripts/tests/fixtures/market_regime/pbc-r2b-m2-2011-10.html',
];
const GATES = [
  'SEMANTIC_BINDING_VALIDATION', 'SEMANTIC_BINDING_COMPLETENESS', 'SOURCE_DATA_ADMISSION',
  'VERSIONED_SOURCE_CONTRACT', 'OFFICIAL_CALENDAR_OR_NATIVE_PERIOD_GRID',
  'RELEASE_AVAILABLE_AT_DATE_SAFE', 'RELEASE_ARTIFACT_BINDING',
  'ORIGINAL_REVISION_OR_KNOWN_BACKCAST_LINEAGE', 'CANONICAL_SCOPE_AND_UNIT',
  'DEFINITION_CONTINUITY_ERA_BREAKS', 'REQUIRED_DENOMINATOR_AND_UNIVERSE',
  'COMPLETE_OBSERVATION_GRAPH_REPLAY', 'PIT_SELECTOR_AT_WEEKLY_CUTOFF',
  'HISTORICAL_COVERAGE', 'HISTORY_MATURITY_AND_MISSINGNESS',
];
const read = (root, path) => readFileSync(resolve(root, path));
const json = (root, path) => JSON.parse(read(root, path));
const reference = (root, path) => ({ path, sha256: createHash('sha256').update(read(root, path)).digest('hex') });

/** Compact evidence assessment only: no acquisition, normalization, score or admission writes. */
export function buildReadinessReport({ root = ROOT } = {}) {
  const pbc = json(root, PBC);
  const csrc = json(root, CSRC);
  const allA = json(root, ALL_A);
  const runtimeReplay = replayCommittedPbc({ root });
  const registry = read(root, REGISTRY).toString('utf8');
  const ids = [...registry.matchAll(/^###\s+`([A-Z][A-Z0-9_]+)`/gm)].map((match) => match[1]);
  if (ids.length < 18 || new Set(ids).size !== ids.length) throw new Error('METRIC_REGISTRY_SCOPE_INVALID');
  const refs = [REGISTRY, FORMULA, BACKTEST, PBC, CSRC, ALL_A, ...RUNTIME_INPUTS].map((path) => reference(root, path));
  const evidence = (...paths) => refs.filter((ref) => paths.includes(ref.path));
  const blocker = (code, detail, paths = [FORMULA, BACKTEST]) => ({ code, detail, evidenceReferences: evidence(...paths) });
  const unknown = () => ({ candidateCount: null, formalCount: null, strictPitCount: null, targetCount: null, coveragePercent: null });
  const row = (metricId, dependencies, blockers, progress = 'NOT_PROVEN', counts = unknown(), paths = [REGISTRY, FORMULA, BACKTEST]) => {
    blockers = [...blockers];
    const isPbc = paths.includes(PBC), isCsrc = paths.includes(CSRC), isAllA = paths.includes(ALL_A);
    const nativeDefinitionIds = new Set(json(root, RUNTIME_INPUTS[0]).filter((definition) => definition.metricId === metricId).map((definition) => definition.sourceDefinitionId));
    const nativeBinding = isPbc && Object.hasOwn(pbc.metricCounts, metricId)
      && json(root, RUNTIME_INPUTS[1]).some((binding) => nativeDefinitionIds.has(binding.sourceDefinitionRef.objectId));
    const provenDefinition = nativeBinding && runtimeReplay.semanticBindingValidation === 'PASS'
      && !runtimeReplay.blockers.some((item) => item.code === 'COMPACT_DEFINITION_MISMATCH');
    const statuses = Object.fromEntries(GATES.map((gate) => [gate, 'UNKNOWN']));
    if (isPbc) {
      statuses.SEMANTIC_BINDING_VALIDATION = nativeBinding ? runtimeReplay.semanticBindingValidation === 'PASS' ? 'PASS' : 'BLOCKED' : 'UNKNOWN';
      statuses.SEMANTIC_BINDING_COMPLETENESS = runtimeReplay.semanticBindingCompleteness === 'PASS' ? 'PASS' : 'BLOCKED';
      statuses.VERSIONED_SOURCE_CONTRACT = provenDefinition ? 'PASS' : nativeBinding ? 'BLOCKED' : 'UNKNOWN';
      statuses.CANONICAL_SCOPE_AND_UNIT = provenDefinition ? 'PASS' : nativeBinding ? 'BLOCKED' : 'UNKNOWN';
      const coverageMetric = pbc.metricCounts[metricId] ? metricId : metricId === 'MACRO_M2' ? 'MACRO_M2_YOY' : 'MACRO_AFRE_STOCK_YOY';
      statuses.HISTORICAL_COVERAGE = pbc.metricCounts[coverageMetric]?.unresolvedCount > 0 ? 'BLOCKED' : 'UNKNOWN';
    }
    if (isPbc || isCsrc || isAllA) {
      // These compact snapshots prove impediments, but do not supply an admissible full graph.
      statuses.SOURCE_DATA_ADMISSION = 'BLOCKED';
      statuses.RELEASE_AVAILABLE_AT_DATE_SAFE = 'BLOCKED';
      statuses.RELEASE_ARTIFACT_BINDING = 'BLOCKED';
      statuses.ORIGINAL_REVISION_OR_KNOWN_BACKCAST_LINEAGE = 'BLOCKED';
      statuses.COMPLETE_OBSERVATION_GRAPH_REPLAY = 'BLOCKED';
    }
    if (isCsrc && counts.targetCount > 0 && counts.strictPitCount === 0) statuses.HISTORICAL_COVERAGE = 'BLOCKED';
    const codePatterns = {
      SEMANTIC_BINDING_VALIDATION: /SEMANTIC_BINDING_INVALID/,
      SEMANTIC_BINDING_COMPLETENESS: /SEMANTIC_BINDING_INCOMPLETE/,
      SOURCE_DATA_ADMISSION: /SOURCE_PARTIAL|SOURCE_NOT_ADMITTED|ADMISSION_UNKNOWN|NO_FORMAL/,
      VERSIONED_SOURCE_CONTRACT: /DEFINITION/,
      OFFICIAL_CALENDAR_OR_NATIVE_PERIOD_GRID: /CALENDAR/,
      RELEASE_AVAILABLE_AT_DATE_SAFE: /RELEASE_AVAILABLE|RELEASE_UNKNOWN/,
      RELEASE_ARTIFACT_BINDING: /RELEASE.*BINDING|HISTORICAL_ATTACHMENT|EXCERPT/,
      ORIGINAL_REVISION_OR_KNOWN_BACKCAST_LINEAGE: /LINEAGE|REVISION|RELEASE_KIND/,
      CANONICAL_SCOPE_AND_UNIT: /DEFINITION|SCOPE/,
      DEFINITION_CONTINUITY_ERA_BREAKS: /DEFINITION.*ERA|DEFINITION|REVISION/,
      REQUIRED_DENOMINATOR_AND_UNIVERSE: /DENOMINATOR|UNIVERSE|NORMALIZATION_INPUT/,
      COMPLETE_OBSERVATION_GRAPH_REPLAY: /GRAPH|CATALOG|RAW_REPLAY/,
      PIT_SELECTOR_AT_WEEKLY_CUTOFF: /PIT/,
      HISTORICAL_COVERAGE: /COVERAGE|DENOMINATOR|NO_FORMAL/,
      HISTORY_MATURITY_AND_MISSINGNESS: /MATURITY/,
    };
    const gateChecks = GATES.map((gate) => {
      const matching = blockers.filter((item) => codePatterns[gate].test(item.code));
      if (statuses[gate] !== 'PASS' && matching.length === 0) {
        const item = blocker(`${gate}_NOT_PROVEN`, `Committed evidence does not establish ${gate} for this metric; this is an unknown prerequisite, not a source fact.`, paths);
        matching.push(item); blockers.push(item);
      }
      return { gate, status: statuses[gate], evidenceReferences: evidence(...paths, ...(isPbc ? RUNTIME_INPUTS : [])),
        blockerCodes: statuses[gate] === 'PASS' ? [] : [...new Set(matching.map((item) => item.code))].sort() };
    });
    const readiness = gateChecks.every((check) => check.status === 'PASS') ? 'READY' : 'BLOCKED';
    return { metricId, readiness, normalizationReadiness: readiness, pitBacktestReadiness: readiness, progress, dependencies, counts,
      requiredGates: GATES, gateChecks, blockers, evidenceReferences: evidence(...paths) };
  };
  const allABlockers = [
    blocker('OFFICIAL_CALENDAR_DENOMINATOR_UNPROVEN', 'Both full All-A era denominators remain unknown; candidates are not sessions.', [ALL_A, BACKTEST]),
    blocker('HISTORICAL_RELEASE_BINDING_UNPROVEN', 'Historical daily release-to-bytes and first/revision lineage remain unproven.', [ALL_A]),
    blocker('NO_FORMAL_ALL_A_OBSERVATIONS', 'D3 has no admitted numeric aggregate or PIT observations.', [ALL_A]),
    blocker('DAILY_DEFINITION_ERA_UNPROVEN', 'Publication labels do not prove daily source applicability for the requested era.', [ALL_A]),
  ];
  const pbcBlockers = [
    blocker('PBC_COVERAGE_PARTIAL', 'Available native periods and proven first releases are different counts; keep missing periods.', [PBC]),
    blocker('REVISION_INVENTORY_PARTIAL', pbc.inventoryBlocker, [PBC]),
    blocker('FULL_OBSERVATION_GRAPH_NOT_COMMITTED', 'Compact final evidence and CSV do not contain the complete R2-A observation/release/binding graph.', [PBC]),
    blocker('FULL_RAW_REPLAY_NOT_AVAILABLE_IN_COMMITTED_INPUTS', 'Ignored sealed datasets/raw cannot establish clean-clone full replay; compact consistency is not admission.', [PBC]),
    ...runtimeReplay.blockers.map((item) => blocker(item.code, `Real adapter condition: ${item.condition}. Original refs: ${item.refs.join(', ')}`,
      [PBC, ...RUNTIME_INPUTS.filter((path) => item.refs.some((ref) => ref.split('#')[0] === path))])),
  ];
  const sourceCounts = {};
  for (const [id, counts] of Object.entries(pbc.metricCounts)) sourceCounts[id] = { ...counts };
  const metrics = ids.map((id) => {
    if (id === 'MACRO_M2' || id === 'MACRO_SOCIAL_FINANCING') {
      const rawId = id === 'MACRO_M2' ? 'MACRO_M2_YOY' : 'MACRO_AFRE_STOCK_YOY';
      return row(id, [rawId], pbcBlockers, 'PARTIAL', unknown(), [PBC, FORMULA, BACKTEST]);
    }
    if (id === 'SUPPLY_IPO_FINANCING') return row(id, [], [
      ...[...new Set(csrc.admissionMatrix.flatMap((item) => item.blockers))].sort().map((code) => blocker(code, 'C2A2 per-month decision remains unproven; current bytes do not establish historical availability.', [CSRC])),
      blocker('FULL_RAW_REPLAY_NOT_AVAILABLE_IN_COMMITTED_INPUTS', 'C2A2 compact evidence excludes ignored historical acquisition bytes.', [CSRC]),
    ], 'PARTIAL', { candidateCount: csrc.candidatePeriods.length, formalCount: csrc.formalObservations.length, strictPitCount: csrc.eligiblePeriods.length, targetCount: csrc.summary.targetCount, coveragePercent: csrc.summary.targetCount > 0 ? 100 * csrc.eligiblePeriods.length / csrc.summary.targetCount : null }, [CSRC, BACKTEST]);
    if (id === 'SENT_A_SHARE_TURNOVER' || id === 'VAL_BUFFETT_INDICATOR_CN') return row(id,
      id === 'SENT_A_SHARE_TURNOVER' ? ['ALL_A_TURNOVER_VALUE', 'ALL_A_NEGOTIABLE_MARKET_CAP'] : ['ALL_A_TOTAL_MARKET_CAP', 'NOMINAL_GDP_VINTAGES'],
      [...allABlockers, ...(id === 'VAL_BUFFETT_INDICATOR_CN' ? [blocker('GDP_VINTAGE_DATASET_NOT_PROVEN', 'A nominal GDP PIT denominator has not been established by these committed readiness inputs.')] : [])],
      'PARTIAL', unknown(), [ALL_A, FORMULA, BACKTEST]);
    const dependencies = {
      FLOW_MARGIN_BALANCE: ['ALL_A_NEGOTIABLE_MARKET_CAP'],
      FLOW_NORTHBOUND: ['ALL_A_NEGOTIABLE_MARKET_CAP'],
      FLOW_EQUITY_ETF_NET_FLOW: ['EQUITY_ETF_UNIVERSE', 'EQUITY_ETF_WINDOW_START_AUM'],
      PROFIT_LISTED_BREADTH: ['ELIGIBLE_REPORTING_UNIVERSE'],
      SUPPLY_PRESSURE_COMPOSITE: ['SUPPLY_IPO_FINANCING', 'SUPPLY_REFINANCING', 'SUPPLY_REDUCTION', 'SUPPLY_BUYBACK', 'ALL_A_TOTAL_MARKET_CAP'],
      PROFIT_CYCLE_CLASSIFIER: ['PROFIT_INDUSTRIAL', 'PROFIT_LISTED_BREADTH'],
    }[id] ?? [];
    const codes = {
      FLOW_MARGIN_BALANCE: ['MARGIN_PIT_DATASET_NOT_PROVEN', 'ALL_A_NORMALIZATION_INPUT_NOT_ADMITTED'],
      FLOW_EQUITY_ETF_NET_FLOW: ['ETF_NET_SUBSCRIPTION_HISTORY_NOT_PROVEN'],
      FLOW_NORTHBOUND: ['NORTHBOUND_FIELD_AND_SCOPE_HISTORY_NOT_PROVEN', 'ALL_A_NORMALIZATION_INPUT_NOT_ADMITTED'],
      SENT_NEW_INVESTORS: ['CHINACLEAR_COMPARABLE_INVESTOR_HISTORY_NOT_PROVEN'],
      VAL_MARKET_PE_PERCENTILE: ['CSI300_TTM_PE_HISTORY_NOT_PROVEN'],
      SUPPLY_REFINANCING: ['REFINANCING_DEFINITION_AND_PIT_NOT_PROVEN'],
      SUPPLY_REDUCTION: ['EXECUTED_REDUCTION_HISTORY_NOT_PROVEN'],
      SUPPLY_BUYBACK: ['EXECUTED_CANCELLATION_BUYBACK_HISTORY_NOT_PROVEN'],
      SUPPLY_PRESSURE_COMPOSITE: ['REQUIRED_COMPONENT_NOT_READY'],
      PROFIT_INDUSTRIAL: ['PROFIT_COMPARABLE_VINTAGE_DATASET_NOT_PROVEN'],
      PROFIT_LISTED_BREADTH: ['WHOLE_MARKET_EARNINGS_UNIVERSE_NOT_PROVEN'],
      PROFIT_CYCLE_CLASSIFIER: ['REQUIRED_COMPONENT_NOT_READY'],
      POLICY_CYCLE_CORRECTION: ['POLICY_EVENT_DATASET_AND_IMPACT_TAXONOMY_NOT_PROVEN'],
      STRUCTURAL_BUBBLE_TEMPERATURE: ['STRUCTURAL_CROSS_SECTION_DATASET_NOT_PROVEN'],
    }[id] ?? ['FORMULA_OR_DATASET_NOT_PROVEN'];
    return row(id, dependencies, codes.map((code) => blocker(code, 'The frozen contract requires source-specific proof; registry source readiness and synthetic fixtures are not real dataset admission.')));
  });
  for (const [id, counts] of Object.entries(sourceCounts)) metrics.push(row(id, [], pbcBlockers, 'PARTIAL', {
    candidateCount: null, formalCount: null, strictPitCount: null, targetCount: counts.targetCount, coveragePercent: null,
  }, [PBC, BACKTEST]));
  const statusCounts = { READY: 0, PARTIAL: 0, BLOCKED: 0 };
  for (const metric of metrics) statusCounts[metric.readiness]++;
  return {
    schemaVersion: '1.0.0', reportKind: 'STAGE_4_1_SEMANTIC_READINESS', assessmentScope: 'COMMITTED_COMPACT_EVIDENCE_ONLY',
    datasetAsOf: pbc.datasetAsOf, overallStatus: statusCounts.BLOCKED === 0 ? 'READY' : 'BLOCKED', statusCounts, productionAdmitted: false,
    historyMaturityMinimum: { dailyObservations: 252, weeklyObservations: 52, monthlyObservations: 24, quarterlyObservations: 12 },
    interpretation: 'Source counts describe preserved evidence progress. They do not prove complete observation graph replay, scoring readiness or production admission.',
    inputReferences: refs, metrics, sourceEvidence: {
      pbc: { admissionStatus: pbc.admissionStatus, observationCount: pbc.observationCount, metricCounts: sourceCounts, sourceCoverage: pbc.sourceCoverage, runtimeReplay },
      csrc: { candidateCount: csrc.candidatePeriods.length, targetCount: csrc.summary.targetCount, formalCount: csrc.formalObservations.length, strictPitCount: csrc.eligiblePeriods.length },
      allA: { candidateCount: allA.candidateCount, uniqueCandidateKeyCount: allA.uniqueCandidateKeyCount, formalCount: allA.formalCount, strictPitCount: allA.strictPitCount, targetCount: allA.targetCount, coveragePercent: allA.coveragePercent },
    },
    verification: { compactConsistency: 'DERIVED_FROM_COMMITTED_INPUTS', fullRawReplay: 'NOT_RUN', normalization: 'NOT_RUN', backtest: 'NOT_RUN', productionAdmission: 'NOT_GRANTED' },
  };
}

export function validateReadinessReport(report, { root = ROOT } = {}) {
  const validate = new Ajv({ allErrors: true, strict: true }).compile(json(root, SCHEMA_PATH));
  if (!validate(report)) throw new Error(`READINESS_SCHEMA_INVALID: ${JSON.stringify(validate.errors)}`);
  if (!isDeepStrictEqual(report, buildReadinessReport({ root }))) throw new Error('READINESS_EVIDENCE_MISMATCH');
  return true;
}

export const serializeReadinessReport = (report) => `${JSON.stringify(report, null, 2)}\n`;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write') || args.length > 1) throw new Error('Usage: node scripts/semantic-runtime/readiness.mjs [--write]');
    const report = buildReadinessReport();
    validateReadinessReport(report);
    const expected = serializeReadinessReport(report);
    if (args.includes('--write')) {
      mkdirSync(dirname(resolve(ROOT, REPORT_PATH)), { recursive: true });
      writeFileSync(resolve(ROOT, REPORT_PATH), expected);
    } else if (read(ROOT, REPORT_PATH).toString('utf8') !== expected) throw new Error('READINESS_REPORT_BYTES_STALE');
    console.log(JSON.stringify({ status: 'PASS', assessment: report.overallStatus, metrics: report.metrics.length, fullRawReplay: 'NOT_RUN' }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
