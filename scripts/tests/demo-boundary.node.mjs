import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { demoBoundary, forbiddenDemoModule } from '../demo-boundary.mjs';

test('demo rejects real data, formal entrypoints, Node and service modules', () => {
  for (const id of ['src/data/industries.ts', '/fixture/src/data/real/research.generated.json?raw', '/fixture/src/App.tsx', 'research-data/private.json', '/fixture/public/real.json', '/fixture/server/review.mjs', '/fixture/api/os-domain.ts', 'node:fs', 'better-sqlite3', '/fixture/.local-data/user.sqlite']) assert(forbiddenDemoModule(id), id);
  for (const id of ['/fixture/src/demo/runtime.ts', '/fixture/src/services/thesis.ts', '/fixture/contracts/financial-research/v1/fixtures/owners.json']) assert(!forbiddenDemoModule(id), id);
});

test('actual builds reject static, lazy, transitive and tree-shaken data imports', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'os-demo-boundary-'));
  try {
    await mkdir(path.join(root, 'src/data'), { recursive: true });
    await writeFile(path.join(root, 'src/data/forbidden.js'), 'export const privateValue = "SYNTHETIC_NEGATIVE_TEST_ONLY";');
    await writeFile(path.join(root, 'transitive.js'), 'export { privateValue } from "./src/data/forbidden.js";');
    const entry = path.join(root, 'entry.js');
    const run = () => build({ configFile: false, root, logLevel: 'silent', plugins: [demoBoundary()],
      build: { write: false, rollupOptions: { input: entry, output: { entryFileNames: 'assets/[name].js' } } } });
    for (const code of ['import "./src/data/forbidden.js";', 'import("./src/data/forbidden.js");', 'import { privateValue } from "./transitive.js"; console.log(privateValue);', 'import { privateValue } from "./src/data/forbidden.js"; console.log("unused import");']) {
      await writeFile(entry, code);
      await assert.rejects(run(), /DEMO_FORBIDDEN/);
    }
    await writeFile(entry, 'export const value = "SYNTHETIC ONLY";');
    const result = await run();
    assert(result.output.some(output => output.fileName === 'demo-boundary.json'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
