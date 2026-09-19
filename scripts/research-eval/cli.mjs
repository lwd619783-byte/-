import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runResearchEval } from './harness.mjs';
import { runIndustryEval } from './industry-suite.mjs';

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
  const industry = await runIndustryEval();
  const industryArtifact = fileURLToPath(new URL('../../docs/stage-4-2-slice-6/industry-eval-report.v1.json', import.meta.url));
  const industryBytes = JSON.stringify(industry, null, 2) + '\n';
  if (args.includes('--check') && readFileSync(industryArtifact, 'utf8').replaceAll('\r\n', '\n') !== industryBytes) throw new Error('INDUSTRY_REPORT_DRIFT');
  if (args.includes('--write')) writeFileSync(industryArtifact, industryBytes);
  // Preserve the released CLI's single-JSON stdout contract; the separate artifact
  // contains full Industry results and is checked by the same command.
  process.stderr.write(`Industry F3: ${industry.status} (${industry.passed}/${industry.count})\n`);
  if (industry.status !== 'PASS') process.exitCode = 1;
} catch {
  // No success-shaped report after suite/input/registry failure; no leaking exception payloads.
  console.error(JSON.stringify({ schemaVersion: 'research-eval-run-error.v1', status: 'BLOCKED', code: 'EVAL_PREFLIGHT_OR_ARTIFACT_ERROR' }));
  process.exitCode = 1;
}
