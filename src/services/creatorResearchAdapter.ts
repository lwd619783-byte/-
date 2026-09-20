import type { CreatorViewpointData, CreatorSource } from '../types/creatorViewpoint';
import type { CreatorResearchExtraction as ResearchExtraction, ResearchExtractionRef, ResearchRelatedRefs, CreatorResearchSource as ResearchSource,
  ResearchSourceAdapter, ResearchSourceRef, ResearchUncertainty } from '../types/researchExtraction';
import { DRAFT_EXTRACTION_REVIEW } from '../types/researchExtraction';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { isPreciseInstant } from '../utils/dateTime';
import { buildCreatorCurrentViews, creatorEffectiveAt, observationStatus, sourceCoverage,
  validateCreatorViewpointData, viewpointChronologyStatus, visibleCreatorSources, visibleViewpointObservations } from './creatorViewpoint';

const requireThat = (condition: unknown, code: string): void => { if (!condition) throw new Error(code); };
const before = (a: string, b: string) => Date.parse(a) <= Date.parse(b);
const sortIds = <T extends { id: string }>(rows: T[]): T[] => rows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const creatorSourceRef = (sourceId: string): ResearchSourceRef => ({ schemaVersion: 'research-source-ref.v1', sourceDomain: 'creator', sourceId });
export const creatorExtractionRef = (extractionId: string): ResearchExtractionRef => ({ schemaVersion: 'research-extraction-ref.v1', sourceDomain: 'creator', extractionId });
function refId(value: unknown, kind: 'source' | 'extraction'): string {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), 'RESEARCH_REF_INVALID');
  const ref = value as Record<string, unknown>;
  const key = kind === 'source' ? 'sourceId' : 'extractionId';
  requireThat(Object.keys(ref).length === 3 && Object.keys(ref).every(k => ['schemaVersion', 'sourceDomain', key].includes(k))
    && ref.schemaVersion === `research-${kind}-ref.v1` && ref.sourceDomain === 'creator'
    && typeof ref[key] === 'string' && !!ref[key].trim(), 'RESEARCH_REF_INVALID');
  return ref[key] as string;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function related(topicIds: string[]): ResearchRelatedRefs {
  return { entities: [], industryIds: [], topicRefs: [...new Set(topicIds)].sort().map(topicId => ({ owner: 'creator_viewpoint_topic', topicId })), identityMapping: 'not_provided' };
}
function noFork(rows: Array<{ id: string; supersedesId: string | null }>): void {
  const successors = new Set<string>();
  for (const row of rows) if (row.supersedesId) {
    requireThat(!successors.has(row.supersedesId), 'RESEARCH_REVISION_FORK');
    successors.add(row.supersedesId);
  }
}
function uncertainty(source: CreatorSource, coverage: ResearchSource['effectiveCoverage']): ResearchUncertainty[] {
  const flags: ResearchUncertainty[] = [];
  if (source.publishedAt === null) flags.push('unknown_publication');
  if (source.authorIdentity === 'unverified') flags.push('author_unverified');
  if (source.authorIdentity === 'other') flags.push('other_author');
  if (coverage === 'PARTIAL') flags.push('partial_source');
  if (coverage === 'UNVERIFIED') flags.push('unverified_source');
  return flags;
}

/** A detached immutable read session. Every subsequent repository read uses fresh owner bytes. */
export function createCreatorResearchAdapter(input: CreatorViewpointData, asOf: string) {
  requireThat(typeof asOf === 'string' && isPreciseInstant(asOf), 'RESEARCH_ASOF_INVALID');
  // Validate finite plain JSON before cloning; do not normalize malformed owner values.
  const data = JSON.parse(canonicalJson(input)) as CreatorViewpointData;
  validateCreatorViewpointData(data);
  noFork(data.sources); noFork(data.observations);
  freeze(data);
  const sources = new Map(data.sources.map(row => [row.id, row]));
  const visibleSources = sortIds(visibleCreatorSources(data, asOf));
  const visibleSourceIds = new Set(visibleSources.map(source => source.id));
  const observations = sortIds(visibleViewpointObservations(data, asOf));
  const visibleObservationIds = new Set(observations.map(row => row.id));
  for (const source of visibleSources) requireThat(!source.supersedesId || visibleSourceIds.has(source.supersedesId), 'RESEARCH_REVISION_NOT_VISIBLE');
  for (const observation of observations) requireThat(!observation.supersedesId || visibleObservationIds.has(observation.supersedesId), 'RESEARCH_REVISION_NOT_VISIBLE');
  const currentViews = buildCreatorCurrentViews(data, asOf);
  const sourceModels = new Map<string, ResearchSource>();
  for (const source of visibleSources) {
    const effectiveCoverage = sourceCoverage(data, source.id);
    const successor = visibleSources.find(row => row.supersedesId === source.id);
    const attribution = source.authorIdentity === 'other'
      ? { authorIdentity: 'other' as const, authorRef: null }
      : { authorIdentity: source.authorIdentity, authorRef: { owner: 'Creator' as const, id: source.creatorId } };
    sourceModels.set(source.id, freeze({
      schemaVersion: 'research-source.v1', ref: creatorSourceRef(source.id), sourceType: source.kind,
      semanticClass: 'external_commentary', relatedRefs: related(observations.filter(row => row.sourceId === source.id).map(row => row.topicId)),
      provenance: { owner: 'CreatorSource', ...attribution, creatorId: source.creatorId, url: source.url,
        identityEvidence: source.identityEvidence },
      publishedAt: source.publishedAt, publishedAtLabel: source.publishedAtLabel, capturedAt: source.capturedAt, recordedAt: source.recordedAt, asOf,
      completeness: source.completeness, commentCoverage: source.commentCoverage, effectiveCoverage,
      uncertainty: uncertainty(source, effectiveCoverage),
      contentRef: source.content === null ? null : { sourceRef: creatorSourceRef(source.id), field: 'content' }, digest: null,
      parentRef: source.parentSourceId ? creatorSourceRef(source.parentSourceId) : null,
      revision: { supersedes: source.supersedesId ? creatorSourceRef(source.supersedesId) : null,
        successor: successor ? creatorSourceRef(successor.id) : null },
    }));
  }
  const extractionModels = new Map<string, ResearchExtraction>();
  for (const observation of observations) {
    const source = sources.get(observation.sourceId)!;
    const sourceModel = sourceModels.get(source.id)!;
    const approval = data.approvals.find(row => row.observationId === observation.id && before(row.recordedAt, asOf));
    const chronology = viewpointChronologyStatus(data, observation, asOf);
    const current = currentViews.find(row => row.creatorId === observation.creatorId && row.topicId === observation.topicId);
    const successor = observations.find(row => row.supersedesId === observation.id);
    const flags: ResearchUncertainty[] = [...sourceModel.uncertainty, 'extractor_unknown'];
    if (chronology === 'ambiguous_time') flags.push('ambiguous_chronology');
    if (current?.chronologyHealth === 'incomplete') flags.push('incomplete_chronology');
    extractionModels.set(observation.id, freeze({
      schemaVersion: 'research-extraction.v1', ref: creatorExtractionRef(observation.id), sourceRefs: [sourceModel.ref],
      semanticClass: 'external_commentary', relatedRefs: related([observation.topicId]),
      author: source.authorIdentity === 'other' ? { type: 'unknown', ref: null, identity: 'other' }
        : { type: 'external_creator', ref: { owner: 'Creator', id: observation.creatorId }, creatorId: observation.creatorId, identity: source.authorIdentity },
      extractor: { type: 'unknown', method: null, version: null }, adapterVersion: 'creator-research-adapter.v1',
      createdAt: observation.recordedAt, effectiveAt: creatorEffectiveAt(data, observation), asOf,
      findings: [{ kind: 'viewpoint', summary: observation.summary, reasoning: observation.reasoning,
        state: { stance: observation.stance, conditional: observation.conditional, horizon: observation.horizon,
          trigger: observation.trigger, confirmation: observation.confirmation, invalidation: observation.invalidation } },
      ...observation.eventLinks.map(link => ({ kind: 'relationship' as const, target: { owner: 'ExternalResearchEvent' as const, eventId: link.eventId },
        relation: link.relation, explanation: link.explanation }))],
      completeness: sourceModel.effectiveCoverage, uncertainty: flags,
      review: approval ? { status: observationStatus(data, observation.id, asOf), approvalRef: { owner: 'ViewpointApproval', approvalId: approval.id },
        reviewedAt: approval.recordedAt } : { ...DRAFT_EXTRACTION_REVIEW },
      revision: { supersedes: observation.supersedesId ? creatorExtractionRef(observation.supersedesId) : null,
        successor: successor ? creatorExtractionRef(successor.id) : null, reason: observation.revisionReason },
      creatorContext: { creatorId: observation.creatorId, chronology, chronologyHealth: current?.chronologyHealth ?? null,
        unresolvedExtractionRefs: (current?.unresolvedObservationIds ?? []).map(creatorExtractionRef) },
    }));
  }
  function resolveSource(ref: ResearchSourceRef): ResearchSource {
    const row = sourceModels.get(refId(ref, 'source'));
    if (!row) throw new Error('RESEARCH_SOURCE_MISSING_OR_NOT_VISIBLE');
    return row;
  }
  function resolveExtraction(ref: ResearchExtractionRef): ResearchExtraction {
    const row = extractionModels.get(refId(ref, 'extraction'));
    if (!row) throw new Error('RESEARCH_EXTRACTION_MISSING_OR_NOT_VISIBLE');
    return row;
  }
  const adapter = {
    adapterVersion: 'creator-research-adapter.v1', sourceDomain: 'creator', asOf,
    listSources: () => Object.freeze([...sourceModels.values()]), resolveSource,
    listExtractions: () => Object.freeze([...extractionModels.values()]), resolveExtraction,
    validateSource(value: unknown) {
      requireThat(value !== null && typeof value === 'object' && 'ref' in value, 'RESEARCH_PROJECTION_INVALID');
      const model = value as ResearchSource;
      requireThat(canonicalJson(model) === canonicalJson(resolveSource(model.ref)), 'RESEARCH_PROJECTION_OWNER_MISMATCH');
    },
    validateExtraction(value: unknown) {
      requireThat(value !== null && typeof value === 'object' && 'ref' in value, 'RESEARCH_PROJECTION_INVALID');
      const model = value as ResearchExtraction;
      requireThat(canonicalJson(model) === canonicalJson(resolveExtraction(model.ref)), 'RESEARCH_PROJECTION_OWNER_MISMATCH');
    },
  } satisfies ResearchSourceAdapter;
  return Object.freeze({ ...adapter,
    /** Exact owner dereference, still cutoff-gated; never resolves to the latest revision instead. */
    traceSource(ref: ResearchSourceRef) {
      const source = sources.get(resolveSource(ref).ref.sourceId)!;
      return freeze({ source, creator: data.creators.find(row => row.id === source.creatorId)! });
    },
    traceExtraction(ref: ResearchExtractionRef) {
      const model = resolveExtraction(ref);
      const observation = observations.find(row => row.id === model.ref.extractionId)!;
      return freeze({ observation, source: sources.get(observation.sourceId)!,
        creator: data.creators.find(row => row.id === observation.creatorId)!, topic: data.topics.find(row => row.id === observation.topicId)!,
        approval: model.review.approvalRef ? data.approvals.find(row => row.id === model.review.approvalRef!.approvalId)! : null,
        events: observation.eventLinks.map(link => data.events.find(row => row.id === link.eventId)!) });
    },
  });
}

export type CreatorResearchAdapter = ReturnType<typeof createCreatorResearchAdapter>;
