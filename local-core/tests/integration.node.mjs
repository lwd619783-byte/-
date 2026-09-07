import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';
import { isNodeOnlyModule, localCoreBoundary } from '../../scripts/local-core-boundary.mjs';
import { localCoreHealth } from '../../scripts/local-core-health.mjs';
import { projectRoot } from '../../.local-core-build/paths.js';
import { tempDirectory } from './fixtures.mjs';

test('CLI init/verify uses explicit temp path, redacted output, nonzero fail-closed exits', (t) => {
  const directory = tempDirectory(t);
  const filename = path.join(directory, 'fixture.sqlite');
  const sentinel = path.join(directory, 'must-not-create-default-root');
  const env = { ...process.env, INVESTMENT_DASHBOARD_DATA_DIR: sentinel };
  const run = (...args) => spawnSync(process.execPath, ['.local-core-build/cli.js', ...args], { cwd: projectRoot, env, encoding: 'utf8', windowsHide: true });
  for (const command of ['init', 'init', 'verify']) {
    const result = run(command, '--db', filename);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).schemaVersion, 2);
    assert(!result.stdout.includes(directory));
    assert(!existsSync(sentinel));
  }
  assert.equal(run('verify', '--db', path.join(directory, 'missing.sqlite')).status, 1);
  assert.equal(run('init', '--db', 'relative.sqlite').status, 1);
  assert.equal(run('init', '--unexpected').status, 1);
  assert.equal(run('verify', '--db', ':memory:').status, 1);
});
test('CLI environment override creates full local layout only during init; verify never creates it', (t) => {
  const root = path.join(tempDirectory(t), 'fixture-layout');
  const env = { ...process.env, INVESTMENT_DASHBOARD_DATA_DIR: root };
  const run = (command) => spawnSync(process.execPath, ['.local-core-build/cli.js', command], { cwd: projectRoot, env, encoding: 'utf8', windowsHide: true });
  assert.equal(run('verify').status, 1); assert(!existsSync(root));
  assert.equal(run('init').status, 0);
  for (const part of ['data/investment-dashboard.sqlite', 'archive', 'attachments', 'backup']) assert(existsSync(path.join(root, part)));
  assert.equal(run('verify').status, 0);
});
test('health checks enforce Node >=22, load native SQLite in memory and create no default root', (t) => {
  const sentinel = path.join(tempDirectory(t), 'must-not-create-user-root');
  const old = process.env.INVESTMENT_DASHBOARD_DATA_DIR;
  process.env.INVESTMENT_DASHBOARD_DATA_DIR = sentinel;
  try {
    const results = localCoreHealth(projectRoot);
    assert(results.every((item) => item.status === 'PASS'), JSON.stringify(results));
    assert.equal(localCoreHealth(projectRoot, '20.19.0')[0].status, 'FAIL');
    assert.equal(localCoreHealth(projectRoot, '24.0.0')[0].status, 'PASS');
    assert(!existsSync(sentinel));
  } finally { if (old === undefined) delete process.env.INVESTMENT_DASHBOARD_DATA_DIR; else process.env.INVESTMENT_DASHBOARD_DATA_DIR = old; }
});
test('boundary classifier rejects native deps, Ajv, builtins and Local Core paths', () => {
  for (const id of ['better-sqlite3', 'ajv', 'ajv/dist/2020.js', 'ajv-formats', 'node:fs', 'path', 'crypto', '../local-core/db/connection.ts', '/fixture/node_modules/ajv/dist/core.js', '__vite-browser-external:node:fs']) assert(isNodeOnlyModule(id), id);
  for (const id of ['react', './src/main.tsx', './src/fixture-ajv-note.ts']) assert(!isNodeOnlyModule(id), id);
});
test('real Vite builds reject forbidden static and dynamic imports, including a transitive import', async (t) => {
  const root = tempDirectory(t);
  const entry = path.join(root, 'entry.js');
  writeFileSync(path.join(root, 'transitive.js'), "import fs from 'node:fs'; export default fs;");
  for (const code of ["import 'better-sqlite3';", "import 'ajv';", "import('node:crypto');", "import './transitive.js';"]) {
    writeFileSync(entry, code);
    await assert.rejects(build({ configFile: false, root, logLevel: 'silent', plugins: [localCoreBoundary()], build: { write: false, rollupOptions: { input: entry } } }), /Node-only dependency/);
  }
  writeFileSync(entry, 'export const fixture = 1;');
  const result = await build({ configFile: false, root, logLevel: 'silent', plugins: [localCoreBoundary()], build: { write: false, rollupOptions: { input: entry } } });
  const report = result.output.find((item) => item.fileName === 'local-core-boundary.json');
  assert.equal(JSON.parse(report.source).forbiddenModules, 0);
  writeFileSync(entry, "import fs from 'node:fs'; export default fs;");
  const ssr = await build({ configFile: false, root, logLevel: 'silent', plugins: [localCoreBoundary()], build: { ssr: entry, write: false } });
  assert(ssr.output.some((item) => item.type === 'chunk'));
});
test('Git ignores only local DB artifacts and Node output; frozen contracts have no working diff', () => {
  const ignored = ['.local-data/fixture.sqlite', 'fixture.sqlite', 'fixture.sqlite-wal', 'fixture.sqlite-shm', 'fixture.db', 'fixture.db-wal', '.local-core-build/cli.js'];
  for (const file of ignored) {
    const result = spawnSync('git', ['check-ignore', '--no-index', '-q', file], { cwd: projectRoot, windowsHide: true });
    assert.equal(result.status, 0, file);
  }
  const tracked = spawnSync('git', ['ls-files', '-z', '*.sqlite', '*.db', '*.sqlite-wal', '*.sqlite-shm', '*.db-wal', '*.db-shm'], { cwd: projectRoot, encoding: 'utf8', windowsHide: true });
  assert.equal(tracked.stdout, '');
  const diff = spawnSync('git', ['diff', '--exit-code', 'HEAD', '--', 'contracts/v1'], { cwd: projectRoot, windowsHide: true });
  assert.equal(diff.status, 0);
});
