import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read } from '../semantic-runtime/common.mjs';
import { OUTPUT_OWNER, YOY_OWNER, buildArtifact, checkArtifact } from './artifact.mjs';
import { buildBinding } from './metric-artifact.mjs';
import { EIA_OWNER, buildEiaArtifact, checkEiaArtifact } from './eia-artifact.mjs';

// Code-owned allowlist: no dynamic imports, arbitrary executables or inferred fallback.
export const SOURCE_ADAPTER_VERSION = 'industry-source-adapters.v1';
const adapters = new Map([
  ['nbs-industrial-production-html.v1', { owners: [OUTPUT_OWNER, YOY_OWNER], build: buildArtifact, check: checkArtifact }],
  ['eia-petroleum-history-html.v1', { owners: [EIA_OWNER], build: buildEiaArtifact, check: checkEiaArtifact }],
]);
export function sourceAdapter(entry, definition) {
  const adapter = adapters.get(definition.acquisitionAdapter);
  if (!adapter) throw new Error('SOURCE_ADAPTER_UNREGISTERED');
  const owner = adapter.owners.find(o => o.plan === entry.definitionRef.owner && o.artifact === entry.artifactRef.owner && o.binding === entry.bindingRef.owner);
  if (!owner || entry.policyRef.owner !== owner.plan || entry.metricId !== definition.id || entry.industryId !== definition.industryId || entry.definitionRef.sha256 !== owner.planHash) throw new Error('SOURCE_ADAPTER_OWNER_MISMATCH');
  return { version: SOURCE_ADAPTER_VERSION, id: definition.acquisitionAdapter,
    check: (root = ROOT) => adapter.check(root, owner),
    build: (generatedAt, root = ROOT) => ({ artifact: adapter.build(generatedAt, root, owner), binding: buildBinding(root, owner) }) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const registry = read('config/industry/industry-metric-registry.v1.json');
  const metricId = process.argv[process.argv.indexOf('--metric') + 1];
  const entry = process.argv.includes('--metric') && registry.entries.find(e => e.metricId === metricId);
  if (!entry) throw new Error('EXACT_REGISTERED_METRIC_REQUIRED');
  const adapter = sourceAdapter(entry, read(entry.definitionRef.owner).definition);
  if (process.argv.includes('--write')) {
    const result = adapter.build(new Date().toISOString());
    writeFileSync(path.join(ROOT, entry.artifactRef.owner), JSON.stringify(result.artifact, null, 2) + '\n');
    writeFileSync(path.join(ROOT, entry.bindingRef.owner), JSON.stringify(result.binding, null, 2) + '\n');
    // Registry pins intentionally remain stale until explicitly reviewed/resealed.
  }
  console.log(JSON.stringify(adapter.check(), null, 2));
}
