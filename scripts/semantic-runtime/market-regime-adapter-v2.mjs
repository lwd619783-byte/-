import { queryMacro as queryMacroV1, queryForDefinition } from './market-regime-adapter.mjs';
import { createIdentityBridge } from './identity-bridge-v2.mjs';
import { ROOT, resolve, unique, valid, QUERY } from './common.mjs';
import { queryCanaryEvidence } from './pbc-evidence-v2.mjs';
import { selectVintage } from './selection.mjs';

export { queryForDefinition };
/** Node host wiring only. Query callers cannot provide mapping, policy or a Registry. */
export function createMacroRuntimeV2({ root = ROOT, registry = null } = {}) {
  const identityBridge = createIdentityBridge({ root, registry });
  return Object.freeze({
    queryMacro(request, options = {}) {
      let result = queryMacroV1(request, options);
      let identityResolution, definition;
      try {
        if (!valid(QUERY, request)) throw new Error('QUERY_SCHEMA_INVALID');
        const binding = resolve(request.bindingRef); definition = resolve(binding.sourceDefinitionRef);
        // A failed V1 owner/definition check cannot gain resolution through V2.
        if (result.blockers.some((b) => ['BINDING_IDENTITY', 'DEFINITION_IDENTITY', 'SCOPE_IDENTITY', 'PIN_OR_OWNER_INVALID'].includes(b.code))) throw new Error('PIN_OR_OWNER_INVALID');
        identityResolution = identityBridge.resolve(definition.metricId, request.entity);
      } catch {
        identityResolution = { status: 'UNRESOLVED', entity: null, registryEntityId: null, mappingId: null, revision: null,
          allowAutoCreate: false, refs: [], blockers: [] };
      }
      if (identityResolution.status === 'RESOLVED') result.blockers = result.blockers.filter((b) => b.code !== 'ENTITY_REGISTRY_UNRESOLVED');
      else result.blockers.push(...identityResolution.blockers);
      if (definition && !result.blockers.some((b) => /SCHEMA_INVALID|PIN_OR_OWNER_INVALID|BINDING_IDENTITY|DEFINITION_.*MISMATCH|SCOPE_IDENTITY|USE_FORBIDDEN/.test(b.code))) {
        const evidence = queryCanaryEvidence({ asOf: request.asOf, metricId: definition.metricId,
          sourceDefinitionId: definition.sourceDefinitionId, valueDate: request.period.start.slice(0, 7) });
        if (evidence.status === 'PASS' && evidence.observations.length) {
          const closedForCanary = new Set(['EXACT_OBSERVATION_MISSING', 'FORMAL_CATALOG_NOT_COMMITTED',
            'FIELD_EXTRACTION_GRAPH_NOT_COMMITTED', 'EXCERPT_IS_NOT_RAW_SOURCE']);
          result = selectVintage(evidence.observations, request, { definition,
            blockers: result.blockers.filter((b) => !closedForCanary.has(b.code)),
            admission: result.admission, coverage: result.coverage, conflict: result.conflict, freshness: result.freshness,
            verifyEvidence: () => ({ refs: evidence.evidenceRefs, blockers: [] }) });
        } else if (evidence.status !== 'PASS') {
          result.blockers.push({code: 'PBC_CANARY_REPLAY_BLOCKED', condition: 'missing_evidence', refs: []});
        }
      }
      result.blockers = [...new Map(result.blockers.map((b) => [JSON.stringify(b), b])).values()]
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
      result.conditions = unique(result.blockers.map((b) => b.condition));
      // This version does not promote source evidence, freshness, coverage or data admission.
      result.outcome = result.conditions.includes('conflicted') ? 'conflicted' : result.blockers.length ? 'blocked' : result.outcome;
      return { ...result, schemaVersion: 'macro-semantic-result.v2', identityResolution };
    }
  });
}
export const queryMacro = createMacroRuntimeV2().queryMacro;
