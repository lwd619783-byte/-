import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const nodeSuite = 'scripts/tests/company-guidance-expectations.test.mjs';
const packageJson = JSON.parse(readFileSync(path.join(repository, 'package.json'), 'utf8'));

test('standard npm test preserves every formal suite and excludes nested checkout copies', { timeout: 120_000 }, (t) => {
  // Mirror paths, not business tests: this checks discovery in isolation and never
  // executes or changes a real nested worktree. Include newly added local suites too.
  const formalSuites = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: repository, encoding: 'utf8',
  }).split('\0').filter((name) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name) && name !== nodeSuite).sort();
  assert.ok(formalSuites.length > 0);
  assert.ok(process.env.npm_execpath, 'Run this check using npm run test:discovery.');

  const root = mkdtempSync(path.join(tmpdir(), 'vitest-discovery-'));
  const dependencyLink = path.join(root, 'node_modules');
  const write = (name, contents) => {
    const target = path.join(root, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  const copy = (name) => {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    copyFileSync(path.join(repository, name), path.join(root, name));
  };
  const run = (label) => {
    const reportPath = path.join(root, `${label}.json`);
    const result = spawnSync(process.execPath, [process.env.npm_execpath, 'test', '--',
      '--maxWorkers=2', '--minWorkers=1', '--reporter=json', `--outputFile=${reportPath}`], {
      cwd: root, encoding: 'utf8', timeout: 90_000,
    });
    assert.ifError(result.error);
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const discovered = report.testResults.map(({ name }) => path.relative(root, name).replaceAll('\\', '/')).sort();
    return { result, report, discovered };
  };

  try {
    symlinkSync(path.join(repository, 'node_modules'), dependencyLink, process.platform === 'win32' ? 'junction' : 'dir');
    for (const name of ['vite.config.ts', 'vite.config.js', 'scripts/local-core-boundary.mjs']) copy(name);
    for (const name of formalSuites) write(name, "import { it } from 'vitest'; it('current checkout sentinel', () => {});\n");
    write(nodeSuite, "throw new Error('Node-only suite must use its dedicated runner');\n");
    const nestedSuites = [
      `data-cache/worktrees/legacy/${nodeSuite}`,
      `data-cache/worktrees/legacy/${formalSuites[0]}`,
      `.worktrees/legacy/${formalSuites[0]}`,
    ].sort();
    for (const name of nestedSuites) write(name, 'export const nestedWorktree = true;\n');

    // The former standard command reproduces the real "No test suite found"
    // failure; all formal paths still appear in that failed run.
    write('package.json', JSON.stringify({ ...packageJson, scripts: {
      test: `vitest run --exclude ${nodeSuite}`,
    } }));
    const control = run('control');
    assert.notEqual(control.result.status, 0);
    assert.match(JSON.stringify(control.report), /No test suite found/);
    assert.deepEqual(control.discovered, [...formalSuites, ...nestedSuites].sort());

    // Use the actual package script/config with no caller-supplied exclusions.
    copy('package.json');
    copy('vitest.config.ts');
    const fixed = run('fixed');
    assert.equal(fixed.result.status, 0, `${fixed.result.stdout}\n${fixed.result.stderr}`);
    assert.equal(fixed.report.success, true);
    assert.deepEqual(fixed.discovered, formalSuites);
    assert.equal(fixed.report.numPassedTests, formalSuites.length);
    t.diagnostic(`Preserved ${formalSuites.length} formal Vitest suite paths; control reproduced ${nestedSuites.length} nested checkout failures; standard npm test passed.`);
  } finally {
    // Remove only the dependency link, never its installed-package target.
    try { unlinkSync(dependencyLink); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('vitest-discovery-'));
    rmSync(root, { recursive: true, force: true });
  }
});
