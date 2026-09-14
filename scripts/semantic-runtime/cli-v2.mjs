import { queryMacro } from './market-regime-adapter-v2.mjs';
import { read } from './common.mjs';

try {
  const [filename, ...rest] = process.argv.slice(2);
  if (!filename || rest.length) throw new Error('Usage: cli-v2.mjs <repo-relative-F1-query.json>');
  console.log(JSON.stringify(queryMacro(read(filename)), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
