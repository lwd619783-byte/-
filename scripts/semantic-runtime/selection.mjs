// Pure selection over the existing MetricObservationVintage model. No fixture oracle import.
import { read, unique, instant, periodBounds, valid, CATALOG } from './common.mjs';

const qualityProjection = read('contracts/financial-research/v1/relation-policy.v1.json').stateProjections['MetricObservationVintage.qualityStatus'];
export function selectVintage(observations, request, context) {
  const blockers = [...context.blockers];
  const add = (code, condition, refs = []) => blockers.push({ code, condition, refs: unique(refs) });
  const output = { schemaVersion: 'macro-semantic-result.v1', outcome: 'blocked', value: null, unit: null,
    selectedRefs: [], evidenceRefs: [], conditions: [], blockers: [], temporal: [], lineage: [],
    quality: [], coverage: context.coverage, admission: context.admission, conflict: context.conflict,
    freshness: context.freshness };
  const finish = () => {
    output.blockers = [...new Map(blockers.map((b) => [JSON.stringify(b), b])).values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    output.conditions = unique(output.blockers.map((b) => b.condition));
    output.evidenceRefs = unique(output.evidenceRefs);
    output.outcome = output.conditions.includes('conflicted') ? 'conflicted' : output.blockers.length ? 'blocked' : output.selectedRefs.length ? 'eligible' : 'missing';
    return output;
  };
  if (!['ADMITTED', 'PARTIAL', 'NOT_ADMITTED'].includes(context.admission)) add('ADMISSION_UNKNOWN', 'unknown');
  else if (context.admission !== 'ADMITTED') add('SOURCE_' + context.admission, context.admission === 'PARTIAL' ? 'partial' : 'not_admitted');
  if (context.conflict !== 'CLEAR') add('OWNER_CONFLICT_' + (context.conflict === 'CONFLICTED' ? 'DETECTED' : 'UNKNOWN'), context.conflict === 'CONFLICTED' ? 'conflicted' : 'unknown');
  if (context.freshness !== 'FRESH') add('FRESHNESS_' + (context.freshness === 'STALE' ? 'STALE' : 'UNKNOWN'), context.freshness === 'STALE' ? 'stale' : 'unknown');
  if (context.coverage?.targetCount === null || !Number.isInteger(context.coverage?.targetCount) || context.coverage.targetCount <= 0) add('COVERAGE_DENOMINATOR_UNKNOWN', 'unknown');
  else if (context.coverage.availableCount !== context.coverage.targetCount) add('COVERAGE_PARTIAL', 'partial');
  if (!Number.isFinite(instant(request.asOf))) { add('AS_OF_INVALID', 'unknown'); return finish(); }
  if (!observations.every((o) => valid(CATALOG + '#/$defs/metricObservationVintage', o))) { add('OBSERVATION_SCHEMA_INVALID', 'unknown'); return finish(); }
  if (unique(observations.map((o) => o.observationId)).length !== observations.length) { add('DUPLICATE_OBSERVATION', 'conflicted'); return finish(); }
  const matches = observations.filter((o) => o.metricId === context.definition.metricId && o.sourceId === context.definition.sourceId && o.sourceDefinitionId === context.definition.sourceDefinitionId && o.unit === context.definition.unit && JSON.stringify(periodBounds(o.valueDate)) === JSON.stringify({ start: request.period.start, end: request.period.end }));
  if (!matches.length) {
    const otherwiseEligible = blockers.length === 0;
    add('EXACT_OBSERVATION_MISSING', 'unknown');
    const result = finish();
    if (otherwiseEligible) result.outcome = 'missing';
    return result;
  }
  if (matches.some((o) => !Number.isFinite(instant(o.releaseAvailableAt)))) add('RELEASE_UNKNOWN', 'unknown');
  const available = matches.filter((o) => instant(o.releaseAvailableAt) <= instant(request.asOf));
  if (!available.length) { add('NO_RELEASE_AT_AS_OF', 'unknown'); return finish(); }
  const byId = new Map(available.map((o) => [o.observationId, o]));
  for (const o of available) {
    const refs = [o.observationId];
    if (request.period.start < context.definition.effectiveFrom || (context.definition.effectiveTo !== null && request.period.end > context.definition.effectiveTo)) add('DEFINITION_PERIOD_MISMATCH', 'unknown', refs);
    if (request.use === 'strict_pit' && !['EXACT_TIMESTAMP', 'DATE_ONLY_SAFE'].includes(o.releaseConfidenceClass)) add('STRICT_RELEASE_CONFIDENCE', 'unknown', refs);
    for (const condition of qualityProjection[o.qualityStatus] ?? ['unknown']) add('QUALITY_' + o.qualityStatus, condition, refs);
    if (o.value === null) add('VALUE_MISSING', 'partial', refs);
    if (o.supersedesObservationId === null) {
      if (o.revisionSequence !== 0) add('REVISION_ROOT_INVALID', 'conflicted', refs);
    } else {
      const prior = byId.get(o.supersedesObservationId);
      if (!prior || prior.revisionSequence >= o.revisionSequence || instant(prior.releaseAvailableAt) > instant(o.releaseAvailableAt)) add('REVISION_LINEAGE_INVALID', 'conflicted', refs);
    }
    const evidence = context.verifyEvidence(o);
    blockers.push(...evidence.blockers);
    output.evidenceRefs.push(...evidence.refs);
  }
  const roots = available.filter((o) => o.supersedesObservationId === null);
  const superseded = new Set(available.map((o) => o.supersedesObservationId));
  const terminals = available.filter((o) => !superseded.has(o.observationId));
  if (roots.length !== 1 || terminals.length !== 1) add('REVISION_CHAINS_AMBIGUOUS', 'conflicted', available.map((o) => o.observationId));
  if (terminals.length === 1 && roots.length === 1 && !blockers.some((b) => b.condition === 'conflicted')) {
    const selected = terminals[0];
    output.selectedRefs = [selected.observationId];
    output.temporal = [{ observationDate: selected.valueDate, publicationDateTime: selected.releaseDateTime,
      publicationDate: selected.metadata.publicationDate ?? null, releaseAvailableAt: selected.releaseAvailableAt,
      releaseConfidenceClass: selected.releaseConfidenceClass, effectiveFrom: context.definition.effectiveFrom,
      effectiveTo: context.definition.effectiveTo, revisionSequence: selected.revisionSequence,
      supersedesObservationId: selected.supersedesObservationId }];
    output.lineage = [{ sourceId: selected.sourceId, sourceDefinitionId: selected.sourceDefinitionId,
      rawArtifactId: selected.rawArtifactId, transformVersion: selected.transformVersion }];
    output.quality = [selected.qualityStatus];
    if (!blockers.length) { output.value = selected.value; output.unit = selected.unit; }
  }
  return finish();
}
