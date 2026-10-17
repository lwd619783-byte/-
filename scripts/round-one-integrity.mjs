import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const baseline = 'f64b64a4d2c24a7f3ddc4d6a329091cc983f53ce';
const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
assert.equal(branch, 'feat/research-os-round1-no-deploy');
execFileSync('git', ['merge-base', '--is-ancestor', baseline, 'HEAD']);
const config = JSON.parse(await readFile('vercel.json', 'utf8'));
assert.equal(config.git.deploymentEnabled[branch], false);
assert.equal(await readFile('package-lock.json', 'utf8'), execFileSync('git', ['show', `${baseline}:package-lock.json`], { encoding: 'utf8', maxBuffer: 1024 * 1024 }));
const pkg = JSON.parse(await readFile('package.json', 'utf8')), prior = JSON.parse(execFileSync('git', ['show', `${baseline}:package.json`], { encoding: 'utf8' }));
assert.deepEqual(pkg.dependencies, prior.dependencies); assert.deepEqual(pkg.devDependencies, prior.devDependencies); assert.deepEqual(pkg.overrides, prior.overrides);
assert.equal(execFileSync('git', ['diff', baseline, '--', 'src/data', 'research-data', 'contracts', 'local-core', 'server', 'api', 'src/App.tsx', 'src/main.tsx', '.github'], { encoding: 'utf8' }), '');
const inventory = JSON.parse(await readFile('dist-demo/demo-asset-inventory.json', 'utf8'));
assert.equal(inventory.scope, 'synthetic-only'); assert.equal(inventory.forbiddenContentMatches, 0); assert.equal(inventory.secretPatternMatches, 0);
async function walk(root) { const files = await readdir(root, { withFileTypes: true }); return (await Promise.all(files.map(file => file.isDirectory() ? walk(path.join(root, file.name)) : path.join(root, file.name)))).flat(); }
let formalFiles = 0;
for (const file of await walk('dist')) {
  if (!/\.(?:js|html)$/.test(file)) continue;
  formalFiles++;
  const text = await readFile(file, 'utf8');
  assert(!/synthetic-oversold-backup-v1|synthetic-oversold-v1|OVERSOLD LAB/.test(text), 'simulation leaked into formal bundle');
}
assert(formalFiles > 0);
console.log(JSON.stringify({ status: 'passed', baseline, branch, deploymentEnabled: false, unchanged: ['dependencies', 'lockfile', 'formal-data', 'contracts', 'formal-runtime', 'CI-trigger-policy'], formalFilesChecked: formalFiles, demoGraphModules: inventory.checkedGraphModules, restrictedLiteralsChecked: inventory.restrictedLiteralsChecked, forbiddenContentMatches: 0, secretPatternMatches: 0 }, null, 2));
