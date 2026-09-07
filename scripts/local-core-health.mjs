import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export function localCoreHealth(root, nodeVersion = process.versions.node) {
  const checks = [];
  const add = (id, ok, message) => checks.push({ id, status: ok ? 'PASS' : 'FAIL', message });
  add('local-core.node-engine', Number(nodeVersion.split('.')[0]) >= 22, 'Local Core requires Node >=22');
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const config = JSON.parse(readFileSync(path.join(root, 'tsconfig.local-core.json'), 'utf8'));
    const needed = ['contracts:validate', 'test:contracts', 'test:local-core', 'local:typecheck', 'local:db:init', 'local:db:verify'];
    add('local-core.prerequisites', pkg.engines?.node === '>=22' && config.compilerOptions?.strict === true && config.compilerOptions?.rootDir === 'local-core' && needed.every((name) => pkg.scripts?.[name]) && ['better-sqlite3', 'ajv', 'ajv-formats'].every((name) => pkg.dependencies?.[name]) && ['local-core/cli.ts', 'local-core/db/migrations/001-local-core.sql', 'scripts/local-core-boundary.mjs'].every((name) => existsSync(path.join(root, name))), 'Local Core Node config, scripts, dependencies and migration source');
    const require = createRequire(path.join(root, 'package.json'));
    const Database = require('better-sqlite3');
    // Loading the JS entry alone does not load the native addon. Memory only.
    const db = new Database(':memory:');
    try { add('local-core.native', db.open, 'better-sqlite3 native addon loads with an in-memory connection'); }
    finally { db.close(); }
  } catch {
    add('local-core.native-or-config', false, 'Local Core prerequisite unavailable: use Node >=22 and npm ci to restore the locked native dependency; no user DB was inspected');
  }
  return checks;
}
