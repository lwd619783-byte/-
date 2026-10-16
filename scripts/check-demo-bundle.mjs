import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { forbiddenDemoModule } from './demo-boundary.mjs';

const root = path.resolve('dist-demo');
const inventoryName = 'demo-asset-inventory.json';
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    assert(!entry.isSymbolicLink(), 'DEMO_SYMLINK');
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  }));
  return files.flat();
}
const files = (await walk(root)).filter(file => path.basename(file) !== inventoryName).sort();
assert(files.length > 2, 'DEMO_EMPTY_OUTPUT');
const assets = [];
const texts = [];
for (const file of files) {
  const name = path.relative(root, file).replaceAll('\\', '/');
  assert(/^(?:index\.html|demo-boundary\.json|assets\/[\w.-]+\.(?:js|css))$/.test(name), 'DEMO_UNEXPECTED_ASSET');
  const bytes = await readFile(file);
  texts.push(bytes.toString('utf8'));
  assets.push({ file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const boundary = JSON.parse(await readFile(path.join(root, 'demo-boundary.json'), 'utf8'));
assert.equal(boundary.status, 'passed');
assert.equal(boundary.scope, 'synthetic-only');
assert.equal(boundary.publicDir, false);
assert(boundary.modules.every(id => !forbiddenDemoModule(id)), 'DEMO_FORBIDDEN_GRAPH');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
assert(html.includes("connect-src 'none'") && html.includes("worker-src 'none'") && html.includes("form-action 'none'"), 'DEMO_NETWORK_POLICY_MISSING');
const combined = texts.join('\n');
assert(combined.includes('SYNTHETIC ONLY'), 'DEMO_LABEL_MISSING');
assert(!/-----BEGIN [\w ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}/.test(combined), 'DEMO_SECRET_PATTERN');

// Read originals for comparison only. Never log or copy their contents into output.
const restrictedSources = ['industries.ts', 'industryChainResearch.ts', 'stocks.ts', 'unitreeHistoricalResearch.ts', 'privateCompanies.ts', 'real/research.generated.json', 'real/signals.generated.json'];
const needles = new Set();
const collect = value => {
  if (typeof value === 'string' && value.trim().length >= 32) needles.add(value);
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === 'object') Object.values(value).forEach(collect);
};
for (const name of restrictedSources) {
  const raw = await readFile(path.join('src/data', name), 'utf8');
  if (name.endsWith('.json')) collect(JSON.parse(raw));
  else {
    const source = ts.createSourceFile(name, raw, ts.ScriptTarget.Latest, true);
    const visit = node => { if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) collect(node.text); ts.forEachChild(node, visit); };
    visit(source);
  }
}
assert([...needles].every(value => !combined.includes(value) && !combined.includes(JSON.stringify(value).slice(1, -1))), 'DEMO_RESTRICTED_CONTENT_MATCH');
const result = { scope: 'synthetic-only', status: 'passed', checkedGraphModules: boundary.modules.length,
  restrictedSourceFilesChecked: restrictedSources.length, restrictedLiteralsChecked: needles.size,
  forbiddenContentMatches: 0, secretPatternMatches: 0,
  inventoryExcludes: inventoryName, assets };
await writeFile(path.join(root, inventoryName), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
