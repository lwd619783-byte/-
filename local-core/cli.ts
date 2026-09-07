import { mkdirSync } from 'node:fs';
import { V1ContractRegistry } from './contracts/registry.js';
import { openLocalDatabase } from './db/connection.js';
import { LocalCoreError } from './domain/errors.js';
import { assertSafeDatabasePath, localDataLayout } from './paths.js';

try {
  const [command, ...args] = process.argv.slice(2);
  const contracts = new V1ContractRegistry();
  if (command === 'contracts' && args.length === 0) {
    console.log(JSON.stringify({ status: 'passed', schemas: contracts.schemaCount, definitions: contracts.definitionCount, versions: contracts.versions, businessCases: contracts.declaredCases }, null, 2));
  } else if (command === 'init' || command === 'verify') {
    if (args.length !== 0 && !(args.length === 2 && args[0] === '--db')) throw new LocalCoreError('CONTRACT_INVALID', 'Usage: init|verify [--db absolute-path|:memory:].');
    if (command === 'verify' && args[1] === ':memory:') throw new LocalCoreError('DATABASE_OPEN_FAILED', 'Read-only verify requires an existing file.');
    const layout = args.length ? undefined : localDataLayout();
    const filename = args[1] ?? layout!.database;
    assertSafeDatabasePath(filename, 'local');
    const store = openLocalDatabase({ filename, purpose: 'local', mode: command === 'init' ? 'initialize' : 'readonly' }, contracts);
    try {
      if (layout && command === 'init') for (const directory of layout.directories) mkdirSync(directory, { recursive: true });
      console.log(JSON.stringify({ status: 'passed', command, ...store.database.verify() }, null, 2));
    } finally { store.database.close(); }
  } else {
    throw new LocalCoreError('CONTRACT_INVALID', 'Usage: contracts | init [--db absolute-path] | verify [--db absolute-path].');
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', code: error instanceof LocalCoreError ? error.code : 'DATABASE_OPEN_FAILED', message: error instanceof LocalCoreError ? error.message : 'Local Core command failed; no recovery was attempted.' }));
  process.exitCode = 1;
}
