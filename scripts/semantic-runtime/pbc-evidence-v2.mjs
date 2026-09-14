import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, bytes, read, sha256 } from './common.mjs';

export const PBC_CANARY_GRAPH = 'research-data/market-regime/source-catalog/pbc-canary-v2/graph.json';
export const PBC_CLOSURE_REPORT = 'research-data/market-regime/source-catalog/pbc-canary-v2/closure-report.json';
const SEAL = 'research-data/market-regime/source-catalog/pbc-final-evidence.v1.json';
const DEFAULT_CUTOFF = '2011-11-14T08:00:00+08:00';

/** Native Python R1/R2 validation; no network and no alternate Observation model. */
export function replayPbcCanary({ root = ROOT, cutoff = DEFAULT_CUTOFF } = {}) {
  const result = spawnSync(process.env.PYTHON ?? 'python', ['-m', 'scripts.market_regime.pbc_canary', '--root', root, '--cutoff', cutoff],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' }, windowsHide: true, timeout: 60_000, maxBuffer: 1024 * 1024 });
  if (result.status !== 0 || result.error) return { status: 'BLOCKED', code: 'PBC_NATIVE_REPLAY_UNAVAILABLE', observations: [], fullGraphReplay: 'BLOCKED', sourceAdmission: 'BLOCKED' };
  try { return JSON.parse(result.stdout); }
  catch { return { status: 'BLOCKED', code: 'PBC_NATIVE_REPLAY_INVALID_OUTPUT', observations: [], fullGraphReplay: 'BLOCKED', sourceAdmission: 'BLOCKED' }; }
}

/** Only already-visible native facts receive per-observation graph references. */
export function queryCanaryEvidence({ asOf, metricId, sourceDefinitionId, valueDate }, { root = ROOT } = {}) {
  const replay = replayPbcCanary({ root, cutoff: asOf ?? 'INVALID' });
  const observations = replay.status === 'PASS' ? replay.observations.filter((o) => o.metricId === metricId
    && o.sourceDefinitionId === sourceDefinitionId && o.valueDate === valueDate) : [];
  return { status: replay.status, observations, evidenceRefs: observations.flatMap((o) => [
    `${PBC_CANARY_GRAPH}#/catalog/observations/0`, `${PBC_CANARY_GRAPH}#/dataset/fieldExtractions/0`,
    `${PBC_CANARY_GRAPH}#/dataset/releaseEvents/0`, `${PBC_CANARY_GRAPH}#observation:${o.observationId}`]),
    fullGraphReplay: 'BLOCKED', sourceAdmission: 'BLOCKED' };
}

export function buildPbcEvidenceClosure({ root = ROOT } = {}) {
  const replay = replayPbcCanary({ root });
  const seal = read(SEAL, root);
  let graph;
  try { graph = read(PBC_CANARY_GRAPH, root); } catch { graph = null; }
  const owners = [SEAL, PBC_CANARY_GRAPH, 'config/market-regime/pbc-historical-plan.v1.json',
    'config/market-regime/pbc-historical-definitions.v1.json', 'config/market-regime/observation-catalog.schema.json',
    'config/market-regime/historical-dataset.schema.json', 'scripts/market_regime/pbc_canary.py',
    'scripts/market_regime/historical_validator.py', 'scripts/market_regime/pbc_parser.py',
    ...(graph?.relocations.map((r) => r.committedLocalPath) ?? [])];
  const supportingRefs = [], missingOwners = [];
  for (const owner of owners) {
    try { supportingRefs.push({ owner, sha256: sha256(bytes(owner, root)) }); }
    catch { missingOwners.push(owner); }
  }
  const fullMissing = [`${seal.sealedOutput}/input.json`, `${seal.sealedOutput}/dataset.json`,
    ...Object.values(seal.snapshotInputs).map((r) => r.path), 'research-data/market-regime/raw/pbc-r2b'];
  return { schemaVersion: '2.0.0', scope: 'PBC_RETAINED_CANARY_CAPABILITY_ONLY',
    positiveReplay: { status: replay.status, blockers: replay.status === 'PASS' ? [] : [replay.code ?? 'PBC_CANARY_EVIDENCE_INVALID'],
      missingOwners, supportingRefs, nativeObservationCount: replay.status === 'PASS' ? replay.eligibleObservationCount : 0,
      committedRawCount: replay.status === 'PASS' ? replay.committedRawCount : 0, cutoff: DEFAULT_CUTOFF },
    fullGraphReplay: { status: 'BLOCKED', blockers: ['PBC_FULL_GRAPH_NOT_COMMITTED', 'PBC_REVISION_INVENTORY_INCOMPLETE'],
      missingOwners: fullMissing, supportingRefs: supportingRefs.filter((r) => r.owner === SEAL),
      expectedObservationCount: seal.observationCount, committedCanaryObservationCount: replay.status === 'PASS' ? 1 : 0 },
    sourceAdmission: { status: 'BLOCKED', blockers: ['PBC_SOURCE_ADMISSION_PARTIAL'], supportingRefs: supportingRefs.filter((r) => r.owner === SEAL) },
    retention: { committedRaw: graph?.relocations.map((r) => r.committedLocalPath) ?? [],
      ignoredLocalArchive: 'R2-B registered worktree: verified during export; unavailable to clean-clone replay',
      externallyRetainedRaw: 'NOT_CONFIGURED', reacquiredSource: 'NONE', testFixture: 'EXCLUDED',
      acquisitionTimeMeaning: graph?.acquisitionTimeMeaning ?? null },
    productionAdmission: 'NOT_ADMITTED' };
}

export function validatePbcEvidenceClosure({ root = ROOT } = {}) {
  const expected = buildPbcEvidenceClosure({ root });
  if (!isDeepStrictEqual(expected, read(PBC_CLOSURE_REPORT, root))) throw new Error('PBC_CLOSURE_REPORT_MISMATCH');
  if (expected.positiveReplay.status !== 'PASS') throw new Error('PBC_COMMITTED_CANARY_REPLAY_FAILED');
  return expected;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--write')) writeFileSync(resolve(ROOT, PBC_CLOSURE_REPORT), JSON.stringify(buildPbcEvidenceClosure(), null, 2) + '\n');
  else {
    const report = validatePbcEvidenceClosure();
    console.log(`PBC retained canary ${report.positiveReplay.status}; full graph BLOCKED; source admission BLOCKED`);
  }
}
