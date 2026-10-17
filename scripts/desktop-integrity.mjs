import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
if (execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim() === 'fix/tailwind4-security-no-deploy') {
  await import('./security-integrity.mjs');
} else {
  await import('./round-one-integrity.mjs');
  const base = '7cfcc0a4e5aae95e386beeaa0ab5d8b125a9a4b2';
  const unchanged = ['src/demo/round-one/simulation.ts', 'src/demo/round-one/SimulationWorkspace.tsx', 'src/demo/runtime.ts', 'src/demo/fixtures.ts', 'vercel.json', 'package.json', 'package-lock.json', '.github'];
  assert.equal(execFileSync('git', ['diff', base, '--', ...unchanged], { encoding: 'utf8' }), '');
  console.log(JSON.stringify({ status: 'passed', desktopBase: base, unchanged, meaning: 'UI-only change; simulation engine, workspace, runtime, dependencies and deployment/CI configuration unchanged' }, null, 2));
}
