import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT, read, bytes, sha256, pin } from '../semantic-runtime/common.mjs';
export const SCHEMA = 'contracts/industry/industry-metric.v1.schema.json';
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(read('contracts/v1/research-asset-os.contracts.v1.schema.json'));
ajv.addSchema(read('contracts/financial-research/v1/shared.schema.json'));
ajv.addSchema(read('contracts/stage-4-1/v1/semantic-runtime.schema.json'));
ajv.addSchema(read('contracts/stage-4-1/v2/semantic-runtime.schema.json'));
// Structural validation only. The pilot additionally requires its reviewed plan and exact replay.
export const validateIndustryMetric = ajv.compile(read(SCHEMA));

export function buildBinding(root = ROOT, owner) {
  // Reuse the existing F1 binding contract and validator; no alternate registry or readiness algorithm.
  requireThat(sha256(bytes(owner.plan, root)) === owner.planHash, 'PILOT_PLAN_DRIFT');
  const plan = read(owner.plan, root);
  const fields = Object.fromEntries(Object.keys(read('contracts/financial-research/v1/examples/pbc-binding.json', root).fieldBindings).map(k => [k, null]));
  const observationFields = { metricId: 'metricId', value: 'value', unit: 'unit', reportingBasis: 'basis', observationDate: 'valueDate', publicationDate: 'publicationDateTime', releaseAvailableAt: 'releaseAvailableAt', revision: 'revision', source: 'provenance', provider: 'quality', artifact: 'provenance', transform: 'provenance', quality: 'quality', admission: 'dataAdmission' };
  for (const [role, property] of Object.entries(observationFields)) fields[role] = { ownerContract: `${SCHEMA}#/$defs/observation`, pointer: `/${property}` };
  for (const [role, property] of Object.entries({ canonicalName: 'canonicalName', nativeFrequency: 'nativeFrequency', revisionPolicy: 'revisionPolicy', freshness: 'freshness', staleAfter: 'staleAfter' })) fields[role] = { ownerContract: `${SCHEMA}#/$defs/definition`, pointer: `/${property}` };
  return { schemaVersion: 'financial-semantic-binding.v2', bindingId: owner.bindingId, domain: 'industry',
    metricDefinitionRef: pin(owner.plan, '/definition', plan.definition.id, '1', root), sourceDefinitionRef: pin(owner.plan, '/definition', plan.definition.id, '1', root),
    fieldBindings: fields, policyRef: pin(owner.plan, '/policy', plan.policy.id, '1', root), allowedUses: [], forbiddenUses: plan.policy.forbiddenUses };
}
