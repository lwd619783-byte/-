import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REGISTRY, registryResources } from './registry.mjs';
import { ROOT, read, bytes, sha256 } from '../semantic-runtime/common.mjs';
import { createIndustryMetricProvider } from '../../src/services/industryMetricRegistry.mjs';
import { createIndustryDimensions } from '../../src/services/industryDimensions.mjs';
import { buildIndustrySignalClaims, documentBytes, SIGNAL_POLICY, SIGNAL_DOCUMENT, GRAPH_DOCUMENT } from '../../src/services/industrySignalClaim.mjs';
import { assessGraph } from '../contracts/financial-research.mjs';

export async function industrySignalContext(root = ROOT) {
  const resources = [...registryResources(read(REGISTRY, root), root), { path: SIGNAL_POLICY, raw: bytes(SIGNAL_POLICY, root).toString('utf8') }];
  const provider = await createIndustryMetricProvider(read(REGISTRY, root), resources, sha256);
  const dimensions = await createIndustryDimensions(read('config/industry/industry-dimension-mapping.v1.json', root), provider, sha256);
  return { provider, dimensions, resources };
}
export async function checkIndustrySignalClaims(root = ROOT, write = false) {
  const result = await buildIndustrySignalClaims(await industrySignalContext(root));
  for (const [file, value] of [[SIGNAL_DOCUMENT, result.derived], [GRAPH_DOCUMENT, { graphs: result.graphs, gates: result.gates }]]) {
    const raw = documentBytes(value), target = path.join(root, file);
    if (write) {
      if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== raw) throw new Error('RETAINED_PREVIEW_OVERWRITE_REQUIRES_NEW_VERSION');
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, raw);
    }
    else if (fs.readFileSync(target, 'utf8') !== raw) throw new Error('INDUSTRY_SIGNAL_REPLAY_DRIFT');
  }
  // Independent frozen contract entrypoint resolves committed pins from disk.
  if (root === ROOT) for (const g of result.graphs) {
    const actual = assessGraph(g.graph, { asOf: g.graph.asOf, targetNodeId: g.targetNodeId });
    if (documentBytes(actual) !== documentBytes(g.assessment)) throw new Error('F2_CONTRACT_PARITY');
  }
  return { status: 'PASS', signals: result.derived.signals.map(s => ({ metricId: s.metricId, value: s.value, conditions: s.conditions })), candidates: result.derived.claims.length, graphs: result.graphs.length,
    gates: result.gates.map(g => ({ industryId: g.industryId, outcome: g.outcome, blockers: g.blockers })) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(JSON.stringify(await checkIndustrySignalClaims(ROOT, process.argv.includes('--write')), null, 2));
