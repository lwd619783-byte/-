// Independent, versioned semantic overlay. Never modifies Industry Metric source facts.
export const INDUSTRY_DIMENSIONS = Object.freeze(['demand', 'supply', 'inventory', 'price', 'margin', 'utilization', 'capex', 'policy', 'valuation', 'trading_state', 'trade_flow']);
export const DIMENSION_MAPPING_REVIEWED_SHA256 = 'e11448f157a9dd1444b68eb7650476e95ec3dc7594249405e98e8aac958ec8df';
const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const canonical = value => JSON.stringify(normalize(value));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k])]));
  return value;
}
export function dimensionReviewPayload(mapping) {
  return canonical({ ...mapping, entries: [...mapping.entries].sort((a, b) => a.metricId.localeCompare(b.metricId, 'en')) });
}
const digest = async raw => [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))].map(b => b.toString(16).padStart(2, '0')).join('');
/** Validate the whole reviewed map before exposing any row. No partial fallback on failure. */
export async function createIndustryDimensions(mapping, provider, hash = digest) {
  requireThat(mapping?.schemaVersion === 'industry-dimension-mapping.v1' && mapping.id === 'industry-dimension-mapping' && mapping.revision === '1' && Array.isArray(mapping.entries), 'DIMENSION_MAPPING_VERSION');
  const byMetric = new Map();
  for (const entry of mapping.entries) {
    requireThat(typeof entry.metricId === 'string' && typeof entry.industryId === 'string', 'DIMENSION_IDENTITY');
    requireThat(!byMetric.has(entry.metricId), 'DIMENSION_DUPLICATE_MAPPING');
    requireThat(INDUSTRY_DIMENSIONS.includes(entry.dimension), 'DIMENSION_UNKNOWN');
    const metric = provider.get(entry.industryId, entry.metricId);
    requireThat(metric && metric.entry.metricId === entry.metricId && metric.entry.industryId === entry.industryId
      && metric.owner.definition.id === entry.metricId && metric.owner.definition.industryId === entry.industryId, 'DIMENSION_EXACT_OWNER_REQUIRED');
    requireThat(canonical(entry.definitionRef) === canonical(metric.entry.definitionRef)
      && canonical(entry.definitionRef) === canonical(metric.owner.definitionRef)
      && entry.definitionRef.objectId === metric.owner.definition.id && entry.definitionRef.version === metric.owner.definition.revision, 'DIMENSION_DEFINITION_PIN_DRIFT');
    const copy = structuredClone(entry);
    Object.freeze(copy.definitionRef); Object.freeze(copy);
    byMetric.set(copy.metricId, copy);
  }
  // A valid-but-foreign dimension/subdimension or resealed pin is still unreviewed.
  // Hash canonical content, not config ordering; only a reviewed code change can update it.
  requireThat(await hash(dimensionReviewPayload(mapping)) === DIMENSION_MAPPING_REVIEWED_SHA256, 'DIMENSION_REVIEW_DRIFT');
  return Object.freeze({
    schemaVersion: 'industry-dimension-mapping.v1', revision: mapping.revision,
    list(industryId) {
      const metrics = provider.list(industryId);
      requireThat(metrics.every(m => byMetric.get(m.entry.metricId)?.industryId === industryId), 'DIMENSION_MAPPING_MISSING');
      return metrics.map(metric => ({ metric, mapping: byMetric.get(metric.entry.metricId) }))
        .sort((a, b) => a.mapping.metricId < b.mapping.metricId ? -1 : 1);
    },
  });
}
