import { queryMacro, replayCommittedPbc } from './market-regime-adapter.mjs';
import { read } from './common.mjs';

try {
  const [operation, filename, ...rest] = process.argv.slice(2);
  if (rest.length || !['query', 'replay-pbc'].includes(operation) || (operation === 'query' && !filename) || (operation === 'replay-pbc' && filename)) throw new Error('Usage: node scripts/semantic-runtime/cli.mjs query <repo-relative-request.json> | replay-pbc');
  console.log(JSON.stringify(operation === 'query' ? queryMacro(read(filename)) : replayCommittedPbc(), null, 2));
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
