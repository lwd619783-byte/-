import path from 'node:path';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setImmediate } from 'node:timers/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { ROOT, read, bytes, sha256 } from '../semantic-runtime/common.mjs';
import { createIndustryMetricProvider } from '../../src/services/industryMetricRegistry.mjs';
import { validateIndustryMetric } from './metric-artifact.mjs';
import { sourceAdapter } from './source-adapters.mjs';
import { validateBinding } from '../contracts/financial-research.mjs';
export const REGISTRY = 'config/industry/industry-metric-registry.v1.json';
const ajv = new Ajv2020({ strict: true });
// Pin reuses the shared F1 wire vocabulary without loading unrelated definitions.
const shared = read('contracts/financial-research/v1/shared.schema.json');
ajv.addSchema({ $id: shared.$id, $defs: { Pin: shared.$defs.Pin } });
export const validateRegistry = ajv.compile(read('contracts/industry/industry-metric-registry.v1.schema.json'));
export function registryResources(registry = read(REGISTRY), root = ROOT) {
  const paths = new Set(registry.entries.flatMap(e => [e.definitionRef.owner, e.artifactRef.owner, e.bindingRef.owner, e.policyRef.owner]));
  for (const file of readdirSync(path.join(root, 'src/data/real'))) if (/^industry-.*\.generated\.json$/.test(file)) paths.add(`src/data/real/${file}`);
  for (const entry of registry.entries) for (const o of read(entry.artifactRef.owner, root).observations) paths.add(o.provenance.captureRef.owner);
  return [...paths].map(p => ({ path: p, raw: bytes(p, root).toString('utf8') }));
}
export async function checkRegistry(root = ROOT) {
  const registry = read(REGISTRY, root);
  if (!validateRegistry(registry)) throw new Error(`REGISTRY_SCHEMA: ${ajv.errorsText(validateRegistry.errors)}`);
  const provider = await createIndustryMetricProvider(registry, registryResources(registry, root), sha256);
  for (const entry of registry.entries) {
    const { owner, binding } = provider.get(entry.industryId, entry.metricId);
    if (!validateIndustryMetric(owner)) throw new Error('OWNER_SCHEMA');
    if (root === ROOT) validateBinding(binding);
  }
  // Reviewed source-specific invariants remain separate from the generic registry contract.
  const replay = [];
  for (const entry of registry.entries) {
    await setImmediate();
    const adapter = sourceAdapter(entry, provider.get(entry.industryId, entry.metricId).owner.definition);
    replay.push({ metricId: entry.metricId, adapter: adapter.id, ...adapter.check(root) });
  }
  return { status: 'PASS', metrics: registry.entries.length, replay };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(JSON.stringify(await checkRegistry(), null, 2));
