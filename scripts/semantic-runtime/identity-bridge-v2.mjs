import { isDeepStrictEqual } from 'node:util';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ROOT, read, resolve, refName, sha256, unique } from './common.mjs';
import { DEFINITIONS } from './bindings.mjs';

export const IDENTITY_POLICY = 'config/market-regime/semantic-identity-policy.v2.json';
export const MAPPING_SCHEMA = 'contracts/stage-4-1/v2/macro-identity-mapping.v1.schema.json';
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats(ajv);
for (const owner of ['contracts/v1/research-asset-os.contracts.v1.schema.json',
  'contracts/v1/entity-resolution.v1.schema.json', 'contracts/financial-research/v1/shared.schema.json',
  'config/market-regime/observation-catalog.schema.json', MAPPING_SCHEMA]) ajv.addSchema(read(owner));
const schemaId = read(MAPPING_SCHEMA).$id;
const validate = (id, value) => { if (!ajv.getSchema(id)(value)) throw new Error('IDENTITY_SCHEMA_INVALID'); };
const assert = (ok, code) => { if (!ok) throw new Error(code); };
const canonical = (value) => value !== null && typeof value === 'object'
  ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])])) : value;
export function mappingDigest(mapping) {
  const { reviewRef: _review, ...body } = mapping;
  return sha256(JSON.stringify(canonical(body)));
}
const entityKey = (entity) => `${entity.entityType}:${entity.entityId}`;
const identity = (m) => [entityKey(m.entity), m.metricId, m.registryEntryRef.objectId];

/** Governance-owned pins only; never accept mapping objects from a Query. */
export function checkIdentityPolicy({ root = ROOT } = {}) {
  const policy = read(IDENTITY_POLICY, root);
  validate(schemaId + '#/$defs/policy', policy);
  assert(policy.mappingRefs.length === 0 || policy.registryOwner !== null, 'REGISTRY_OWNER_MISSING');
  const mappings = [], refs = [IDENTITY_POLICY];
  function mappingAt(ref, seen = new Set()) {
    const key = refName(ref);
    assert(!seen.has(key), 'MAPPING_REVISION_CYCLE'); seen.add(key);
    const m = resolve(ref, root);
    validate(schemaId, m);
    assert(ref.objectId === m.mappingId && ref.version === String(m.revision), 'MAPPING_PIN_IDENTITY');
    refs.push(key, refName(m.registryEntryRef), refName(m.metricDefinitionRef), refName(m.reviewRef));
    const review = resolve(m.reviewRef, root);
    validate(schemaId + '#/$defs/review', review);
    assert(m.reviewRef.objectId === review.reviewId && m.reviewRef.version === String(review.revision)
      && review.mappingId === m.mappingId && review.mappingRevision === m.revision
      && review.mappingSha256 === mappingDigest(m) && review.decision === m.status, 'MAPPING_REVIEW_MISMATCH');
    const entry = resolve(m.registryEntryRef, root);
    validate('https://investment-dashboard.local/contracts/v1/entity-resolution.v1.schema.json#/$defs/RegistryEntry', entry);
    assert(entry.entityId === m.registryEntryRef.objectId && String(entry.revision) === m.registryEntryRef.version
      && entry.entityType === 'macro_metric', 'REGISTRY_PIN_IDENTITY');
    // The original definition owns metricId. No label or equal entity string is evidence.
    assert(m.metricDefinitionRef.owner === DEFINITIONS, 'METRIC_OWNER_UNSUPPORTED');
    const definition = resolve(m.metricDefinitionRef, root);
    validate('urn:investment-research-dashboard:market-regime:observation-catalog:v1#/$defs/sourceDefinitionVersion', definition);
    assert(definition.sourceDefinitionId === m.metricDefinitionRef.objectId && definition.version === m.metricDefinitionRef.version
      && definition.metricId === m.metricId, 'METRIC_PIN_IDENTITY');
    if (m.revision === 1) assert(m.previousRef === null, 'MAPPING_REVISION_ROOT');
    else {
      assert(m.previousRef !== null, 'MAPPING_PREDECESSOR_MISSING');
      const previous = mappingAt(m.previousRef, seen);
      assert(previous.mapping.mappingId === m.mappingId && previous.mapping.revision === m.revision - 1
        && isDeepStrictEqual(identity(previous.mapping), identity(m)), 'MAPPING_REVISION_IDENTITY');
      assert(Date.parse(previous.review.reviewedAt) <= Date.parse(review.reviewedAt), 'MAPPING_REVIEW_TIME_ORDER');
    }
    return { mapping: m, entry, definition, review };
  }
  const seen = [new Set(), new Set(), new Set(), new Set()];
  for (const ref of policy.mappingRefs) {
    const resolved = mappingAt(ref), m = resolved.mapping;
    [m.mappingId, ...identity(m)].forEach((key, i) => {
      assert(!seen[i].has(key), 'MAPPING_DUPLICATE_OR_CONFLICTING'); seen[i].add(key);
    });
    mappings.push(resolved);
  }
  return { policy, mappings, refs: unique(refs) };
}

/** Trusted host construction seam, not request authority. Port has list() only. */
export function createIdentityBridge({ root = ROOT, registry = null } = {}) {
  return Object.freeze({
    resolve(metricId, claimedEntity = null) {
      let refs = [IDENTITY_POLICY], code = 'MAPPING_MISSING';
      try {
        const checked = checkIdentityPolicy({ root }); refs = checked.refs;
        const match = checked.mappings.find(({ mapping }) => mapping.metricId === metricId);
        assert(Boolean(match), code);
        const { mapping, entry } = match;
        assert(mapping.status === 'reviewed', 'MAPPING_REVOKED');
        assert(claimedEntity === null || entityKey(claimedEntity) === entityKey(mapping.entity), 'ENTITY_CLAIM_MISMATCH');
        assert(registry !== null && registry.owner === checked.policy.registryOwner && typeof registry.list === 'function', 'CURRENT_REGISTRY_OWNER_UNAVAILABLE');
        // Read the actual owner on every resolution, never trust the retained export alone.
        const current = registry.list();
        assert(Array.isArray(current), 'CURRENT_REGISTRY_INVALID');
        const matches = current.filter((e) => e.entityId === entry.entityId);
        assert(matches.length === 1, 'CURRENT_REGISTRY_MISSING_OR_DUPLICATE');
        const live = matches[0];
        validate('https://investment-dashboard.local/contracts/v1/entity-resolution.v1.schema.json#/$defs/RegistryEntry', live);
        assert(live.status === 'active' && live.userConfirmed === true && !Object.hasOwn(live, 'mergedIntoEntityId'), 'REGISTRY_IDENTITY_INACTIVE_OR_UNCONFIRMED');
        assert(isDeepStrictEqual(live, entry), 'REGISTRY_REVISION_OR_CONTENT_DRIFT');
        return { status: 'RESOLVED', entity: { entityType: 'macro', entityId: mapping.entity.entityId }, registryEntityId: live.entityId,
          mappingId: mapping.mappingId, revision: mapping.revision, allowAutoCreate: false, refs, blockers: [] };
      } catch (error) { code = /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'IDENTITY_OWNER_EVIDENCE_INVALID'; }
      return { status: 'UNRESOLVED', entity: null, registryEntityId: null, mappingId: null, revision: null, allowAutoCreate: false, refs,
        blockers: [{ code: 'ENTITY_REGISTRY_UNRESOLVED', condition: 'unknown', refs },
          { code, condition: /DUPLICATE|CONFLICT|DRIFT/.test(code) ? 'conflicted' : 'unknown', refs }] };
    }
  });
}
