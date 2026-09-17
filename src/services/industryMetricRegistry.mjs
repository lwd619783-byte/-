// Shared offline/browser boundary. Pins hash the exact UTF-8 resources, not reserialized JSON.
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const equal = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
};
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export async function createIndustryMetricProvider(registry, resources, digest = async raw => {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}) {
  requireThat(registry?.schemaVersion === 'industry-metric-registry.v1' && registry.id === 'industry-metric-registry' && registry.revision === '1' && Array.isArray(registry.entries), 'REGISTRY_VERSION');
  const files = new Map();
  for (const resource of resources) {
    requireThat(!files.has(resource.path), 'DUPLICATE_RESOURCE_OWNER');
    files.set(resource.path, { value: JSON.parse(resource.raw), sha256: await digest(resource.raw) });
  }
  const resolve = ref => {
    requireThat(ref && typeof ref.owner === 'string' && !/^(?:[A-Za-z]:|[/\\])|(?:^|[/\\])\.\.(?:[/\\]|$)/.test(ref.owner), 'PIN_OWNER');
    const file = files.get(ref.owner);
    requireThat(file, 'MISSING_OWNER');
    requireThat(/^[a-f0-9]{64}$/.test(ref.sha256) && file.sha256 === ref.sha256, 'PIN_DIGEST');
    requireThat(typeof ref.locator === 'string' && /^\//.test(ref.locator) && !/~(?![01])/.test(ref.locator), 'PIN_LOCATOR');
    let value = file.value;
    for (const key of ref.locator.slice(1).split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'))) {
      requireThat(value && typeof value === 'object' && Object.hasOwn(value, key), 'PIN_LOCATOR'); value = value[key];
    }
    requireThat(typeof ref.objectId === 'string' && ref.objectId.length && typeof ref.version === 'string' && ref.version.length, 'PIN_IDENTITY');
    return value;
  };
  const byId = new Map(), artifacts = new Set(), bindings = new Set();
  for (const entry of registry.entries) {
    requireThat(typeof entry.metricId === 'string' && entry.metricId.length && typeof entry.industryId === 'string' && entry.industryId.length, 'METRIC_IDENTITY');
    requireThat(!byId.has(entry.metricId), 'DUPLICATE_METRIC_IDENTITY');
    requireThat(!artifacts.has(entry.artifactRef?.owner) && !bindings.has(entry.bindingRef?.owner), 'DUPLICATE_METRIC_OWNER');
    const definition = resolve(entry.definitionRef), artifactDefinition = resolve(entry.artifactRef), bindingId = resolve(entry.bindingRef), policy = resolve(entry.policyRef);
    const owner = files.get(entry.artifactRef.owner).value, binding = files.get(entry.bindingRef.owner).value;
    requireThat(entry.definitionRef.locator === '/definition' && entry.artifactRef.locator === '/definition' && entry.bindingRef.locator === '/bindingId' && entry.policyRef.locator === '/policy', 'OWNER_LOCATOR');
    requireThat(definition.id === entry.metricId && definition.industryId === entry.industryId && equal(definition, artifactDefinition), 'ARTIFACT_IDENTITY_DRIFT');
    requireThat([entry.definitionRef, entry.artifactRef].every(r => r.objectId === definition.id && r.version === definition.revision), 'DEFINITION_PIN_IDENTITY');
    requireThat(owner.schemaVersion === 'industry-metric.v1' && equal(owner.definitionRef, entry.definitionRef) && equal(owner.policy, policy), 'OWNER_IDENTITY_DRIFT');
    requireThat(policy.id === entry.policyRef.objectId && policy.revision === entry.policyRef.version, 'POLICY_PIN_IDENTITY');
    requireThat(binding.schemaVersion === 'financial-semantic-binding.v2' && binding.domain === 'industry' && bindingId === entry.bindingRef.objectId && entry.bindingRef.version === definition.revision, 'BINDING_IDENTITY_DRIFT');
    requireThat(equal(binding.metricDefinitionRef, entry.definitionRef) && equal(binding.sourceDefinitionRef, entry.definitionRef) && equal(binding.policyRef, entry.policyRef), 'BINDING_IDENTITY_DRIFT');
    requireThat(equal(binding.allowedUses, policy.allowedUses) && equal(binding.forbiddenUses, policy.forbiddenUses), 'BINDING_POLICY_DRIFT');
    requireThat(Array.isArray(owner.observations), 'OBSERVATIONS_REQUIRED');
    for (const o of owner.observations) {
      requireThat(o.metricId === definition.id && o.industryId === definition.industryId && o.unit === definition.unit, 'OBSERVATION_IDENTITY_DRIFT');
      // Generic Pin only: source-specific capture identity/row semantics are checked by
      // the owner's offline exact replay. Do not impose the NBS manifest shape on V1.
      resolve(o.provenance.captureRef);
    }
    const presentation = entry.presentation;
    requireThat(presentation && ['absolute_difference', 'none'].includes(presentation.delta) && typeof presentation.note === 'string'
      && definition.basis.every(b => typeof presentation.basisLabels?.[b] === 'string') && (definition.unit !== '%' || presentation.delta === 'none'), 'PRESENTATION_SEMANTICS');
    artifacts.add(entry.artifactRef.owner); bindings.add(entry.bindingRef.owner);
    byId.set(entry.metricId, freeze({ entry: structuredClone(entry), owner, binding }));
  }
  // A second bundled owner cannot be ignored in favour of a convenient match.
  for (const [path, file] of files) if (file.value.schemaVersion === 'industry-metric.v1') requireThat(artifacts.has(path), 'UNREGISTERED_OR_CONFLICTING_OWNER');
  return Object.freeze({
    list: industryId => [...byId.values()].filter(x => x.entry.industryId === industryId).sort((a, b) => a.entry.metricId < b.entry.metricId ? -1 : 1),
    get: (industryId, metricId) => {
      const match = byId.get(metricId);
      return match?.entry.industryId === industryId ? match : null;
    },
  });
}
