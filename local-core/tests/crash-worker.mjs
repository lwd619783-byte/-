import { openLocalDatabase } from '../../.local-core-build/db/connection.js';
import { V1ContractRegistry } from '../../.local-core-build/contracts/registry.js';
import { entityFixture, auditFixture } from './fixtures.mjs';

const store = openLocalDatabase({ filename: process.argv[2], purpose: 'test', mode: 'readwrite' }, new V1ContractRegistry());
store.database.transaction(({ entities, audit }) => {
  entities.create(entityFixture());
  audit.append(auditFixture());
  // Terminate without returning, committing or closing the connection.
  process.exit(23);
});
