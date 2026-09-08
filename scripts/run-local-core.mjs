import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [command, ...args] = process.argv.slice(2);
const targets = {
  contracts: ['.local-core-build/cli.js', 'contracts'],
  init: ['.local-core-build/cli.js', 'init'],
  verify: ['.local-core-build/cli.js', 'verify'],
  'test-contracts': ['--test', 'local-core/tests/contracts.node.mjs'],
  'test-local-core': ['--test', 'local-core/tests/database.node.mjs', 'local-core/tests/entities.node.mjs', 'local-core/tests/audit.node.mjs', 'local-core/tests/integration.node.mjs', 'local-core/tests/assets.node.mjs', 'local-core/tests/asset-import.node.mjs', 'local-core/tests/asset-database.node.mjs', 'local-core/tests/historical-import.node.mjs', 'local-core/tests/account-value.node.mjs', 'local-core/tests/dca-temporal.node.mjs'],
  'test-assets': ['--test', 'local-core/tests/assets.node.mjs', 'local-core/tests/asset-import.node.mjs', 'local-core/tests/asset-database.node.mjs', 'local-core/tests/historical-import.node.mjs', 'local-core/tests/account-value.node.mjs', 'local-core/tests/dca-temporal.node.mjs'],
};
if (!targets[command] || (!['init', 'verify'].includes(command) && args.length)) {
  console.error('Unknown Local Core command or arguments.');
  process.exitCode = 1;
} else if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Local Core requires Node >=22.');
  process.exitCode = 1;
} else {
  const compile = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.local-core.json'], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const run = spawnSync(process.execPath, [...targets[command], ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
    process.exitCode = run.status ?? 1;
  }
}
