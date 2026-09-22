import fs from 'node:fs';
import assert from 'node:assert/strict';

const inventory = JSON.parse(fs.readFileSync('docs/ui-v2/migration-inventory.json', 'utf8'));
assert.equal(inventory.schemaVersion, 'ui-v2-migration-inventory.v1');
const ids = new Set();
for (const row of inventory.items) {
  assert(!ids.has(row.id), `duplicate migration identity ${row.id}`); ids.add(row.id);
  for (const key of ['entry', 'action', 'owner', 'persistence', 'newLocation', 'source']) assert(typeof row[key] === 'string' && row[key].length, `${row.id}: ${key}`);
  assert('oldRoute' in row && (row.oldRoute === null || typeof row.oldRoute === 'string'));
  assert.equal(typeof row.wired, 'boolean');
  assert(Array.isArray(row.regressionEvidence));
  assert(fs.existsSync(row.source), `${row.id}: missing original source ${row.source}`);
}
for (const route of ['home', 'macro', 'industry', 'stocks', 'watchlist', 'verification', 'expectations', 'creators', 'memory', 'company']) {
  assert(inventory.items.some(row => row.oldRoute?.startsWith(`#/${route}`)), `missing old route: ${route}`);
}
console.log(JSON.stringify({ schema: inventory.schemaVersion, entries: ids.size, wired: inventory.items.filter(row => row.wired).length, result: 'PASS', scope: 'inventory integrity only; runtime and real-user approval remain separate' }));
