import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, read, pin } from './common.mjs';
import { validateBinding } from '../contracts/financial-research.mjs';

export const DEFINITIONS = 'config/market-regime/pbc-historical-definitions.v1.json';
export const POLICY = 'config/market-regime/semantic-owner-policy.v1.json';
export const BINDINGS = 'config/market-regime/semantic-bindings.v2.json';
export const PBC_REPORT = 'research-data/market-regime/source-catalog/pbc-final-evidence.v1.json';
export function expectedPolicy() {
  const scopes = Object.fromEntries(read(DEFINITIONS).map((d, i) => [d.sourceDefinitionId, {
    id: d.sourceDefinitionId, version: d.version,
    // Explicit macro EntityRef equivalence to the existing metric registry key, not displayName.
    entity: { entityType: 'macro', entityId: d.metricId },
    definitionRef: pin(DEFINITIONS, `/${i}`, d.sourceDefinitionId, d.version),
    periodScope: 'native_statistical_period'
  }]));
  return { policy: { id: 'market-regime-semantic-owner-policy', revision: '1',
    authority: 'Stage 4.1-F read-only diagnostic policy; no data/provider promotion',
    allowedUses: ['strict_pit', 'research', 'display'], forbiddenUses: [],
    sourceOwners: { PBOC_M2_OFFICIAL_RELEASE: 'pbc.gov.cn', PBOC_AFRE_STOCK_OFFICIAL_RELEASE: 'pbc.gov.cn' },
    admissionOwner: PBC_REPORT, admissionPointer: '/admissionStatus',
    admittedUses: [], freshness: 'UNKNOWN' }, scopes };
}
export function expectedBindings() {
  const template = read('contracts/financial-research/v1/examples/pbc-binding.json');
  return read(DEFINITIONS).map((d, i) => {
    const binding = structuredClone(template);
    binding.bindingId = `${d.sourceDefinitionId}-runtime.v2`;
    binding.metricDefinitionRef = pin(DEFINITIONS, `/${i}`, d.sourceDefinitionId, d.version);
    binding.sourceDefinitionRef = binding.metricDefinitionRef;
    binding.policyRef = pin(POLICY, '/policy', 'market-regime-semantic-owner-policy', '1');
    for (const role of ['entity', 'universe', 'coverage', 'admission', 'conflict', 'freshness']) binding.fieldBindings[role] = {
      ownerContract: 'contracts/stage-4-1/v1/semantic-runtime.schema.json#/$defs/context', pointer: '/' + role
    };
    binding.allowedUses = ['strict_pit', 'research', 'display'];
    binding.forbiddenUses = [];
    return binding;
  });
}
export function checkBindings() {
  if (!isDeepStrictEqual(read(POLICY), expectedPolicy())) throw new Error('OWNER_POLICY_DRIFT');
  const bindings = read(BINDINGS);
  if (!isDeepStrictEqual(bindings, expectedBindings())) throw new Error('SEMANTIC_BINDING_DRIFT');
  for (const binding of bindings) validateBinding(binding);
  return bindings;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) {
    writeFileSync(path.join(ROOT, POLICY), JSON.stringify(expectedPolicy(), null, 2) + '\n');
    writeFileSync(path.join(ROOT, BINDINGS), JSON.stringify(expectedBindings(), null, 2) + '\n');
  }
  console.log(JSON.stringify({ status: 'PASS', bindingCount: checkBindings().length }));
}
