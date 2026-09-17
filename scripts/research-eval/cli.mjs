import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runResearchEval } from './harness.mjs';

const artifact = fileURLToPath(new URL('../../docs/stage-4-1b-slice-3/eval-report.v1.json', import.meta.url));
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !['--write', '--check'].includes(arg))) throw new Error('CLI_ARGUMENT');
  const report = await runResearchEval();
  const bytes = JSON.stringify(report, null, 2) + '\n';
  if (args.includes('--check') && readFileSync(artifact, 'utf8').replaceAll('\r\n', '\n') !== bytes) throw new Error('COMMITTED_REPORT_DRIFT');
  if (args.includes('--write')) writeFileSync(artifact, bytes);
  process.stdout.write(bytes);
  if (report.evaluationStatus === 'FAIL' || report.goldenContractHealth.status !== 'PASS') process.exitCode = 1;
} catch {
  // No success-shaped report after suite/input/registry failure; no leaking exception payloads.
  console.error(JSON.stringify({ schemaVersion: 'research-eval-run-error.v1', status: 'BLOCKED', code: 'EVAL_PREFLIGHT_OR_ARTIFACT_ERROR' }));
  process.exitCode = 1;
}
