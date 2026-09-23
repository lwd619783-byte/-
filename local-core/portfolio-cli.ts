import { openLocalDatabase } from './db/connection.js';
import { V1ContractRegistry } from './contracts/registry.js';
import { readPortfolio } from './domain/portfolio-projection.js';

// Invoked only by the opt-in loopback seam, never a public API or browser import.
const [filename, asOf, ...extra] = process.argv.slice(2);
try {
  if (!filename || !asOf || extra.length) throw Error('PORTFOLIO_EXPLICIT_PATH_AND_ASOF_REQUIRED');
  const contracts = new V1ContractRegistry();
  const store = openLocalDatabase({ filename, purpose: 'local', mode: 'readonly' }, contracts);
  try { process.stdout.write(JSON.stringify(store.readAssetSnapshot((reads, audit) => readPortfolio(reads, audit, contracts, asOf)))); }
  finally { store.database.close(); }
} catch { process.stderr.write('PORTFOLIO_LOCAL_READ_BLOCKED'); process.exitCode = 1; }
