import { canonicalJson } from '../../shared/canonical-json.mjs';
import { isPreciseInstant } from '../utils/dateTime';
import type { WikiData, WikiOwners, WikiPage, WikiReadModel, WikiRevision, WikiReview } from '../types/wiki';
import validateSchema from './wikiValidator.generated.mjs';

export const compareWikiText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export const wikiRequire = (condition: unknown, code: string): void => { if (!condition) throw new Error(code); };
const before = (a: string, b: string) => Date.parse(a) <= Date.parse(b);
const instant = (value: string) => wikiRequire(isPreciseInstant(value), 'WIKI_TIME_INVALID');
export const emptyWikiData = (): WikiData => ({ schemaVersion: 'wiki.v1', entries: [], revisions: [], reviews: [] });
export const emptyWikiRelatedRefs = () => ({ entities: [], industryIds: [], topicRefs: [], identityMapping: 'not_provided' as const });
export const cloneWiki = <T,>(value: T): T => JSON.parse(canonicalJson(value)) as T;
function unique<T>(rows: T[], id: (row: T) => string): Map<string, T> {
  const result = new Map(rows.map(row => [id(row), row]));
  wikiRequire(result.size === rows.length, 'WIKI_DUPLICATE_ID'); return result;
}

/** Shape + history semantics, independent of adapters being currently available. */
export function validateWikiData(value: unknown): asserts value is WikiData {
  canonicalJson(value);
  wikiRequire(validateSchema(value), 'WIKI_SCHEMA_INVALID_OR_FUTURE_VERSION');
  const data = value as WikiData;
  const entries = unique(data.entries, row => row.wikiId), revisions = unique(data.revisions, row => row.revisionId), reviews = unique(data.reviews, row => row.reviewId);
  data.entries.forEach(row => instant(row.createdAt));
  const successors = new Set<string>(), roots = new Set<string>(), reviewed = new Set<string>(), archiveHeads = new Set<string>();
  for (const revision of data.revisions) {
    instant(revision.createdAt); instant(revision.asOf);
    const entry = entries.get(revision.wikiId);
    wikiRequire(entry && before(entry.createdAt, revision.asOf) && before(revision.asOf, revision.createdAt), 'WIKI_REVISION_TIME_OR_ENTRY');
    if (revision.supersedes) {
      const prior = revisions.get(revision.supersedes);
      wikiRequire(prior && prior.wikiId === revision.wikiId && prior.revisionId !== revision.revisionId
        && before(prior.createdAt, revision.createdAt) && before(prior.asOf, revision.asOf) && !successors.has(prior.revisionId), 'WIKI_REVISION_FORK_OR_FOREIGN');
      successors.add(revision.supersedes);
    } else { wikiRequire(!roots.has(revision.wikiId), 'WIKI_REVISION_MULTIPLE_ROOTS'); roots.add(revision.wikiId); }
    const seen = new Set<string>(); let cursor: WikiRevision | undefined = revision;
    while (cursor) {
      wikiRequire(!seen.has(cursor.revisionId), 'WIKI_REVISION_CYCLE'); seen.add(cursor.revisionId);
      cursor = cursor.supersedes ? revisions.get(cursor.supersedes) : undefined;
    }
    for (const ref of revision.wikiRefs) {
      const target = entries.get(ref.wikiId);
      wikiRequire(target && target.wikiId !== revision.wikiId && before(target.createdAt, revision.asOf), 'WIKI_REF_MISSING_FOREIGN_OR_FUTURE');
    }
    wikiRequire(revision.relatedRefs.identityMapping !== 'not_provided' || (!revision.relatedRefs.entities.length && !revision.relatedRefs.industryIds.length), 'WIKI_IDENTITY_MAPPING');
  }
  for (const review of data.reviews) {
    instant(review.createdAt);
    const revision = revisions.get(review.revisionId);
    wikiRequire(revision && revision.wikiId === review.wikiId && before(revision.createdAt, review.createdAt), 'WIKI_REVIEW_FOREIGN_OR_TIME');
    wikiRequire(review.approvalRef.approvalId === review.reviewId, 'WIKI_APPROVAL_AUTHORITY');
    if (review.decision === 'archived') {
      const prior = review.supersedes ? reviews.get(review.supersedes) : undefined;
      wikiRequire(prior && prior.decision === 'reviewed' && prior.revisionId === review.revisionId && before(prior.createdAt, review.createdAt)
        && !archiveHeads.has(prior.reviewId), 'WIKI_ARCHIVE_INVALID');
      archiveHeads.add(prior!.reviewId);
    } else {
      wikiRequire(review.supersedes === null && !reviewed.has(review.revisionId), 'WIKI_REVIEW_ALREADY_DECIDED'); reviewed.add(review.revisionId);
      if (review.decision === 'reviewed') wikiRequire(revision!.sourceRefs.length + revision!.extractionRefs.length + revision!.evidenceRefs.length > 0, 'WIKI_GROUNDING_REQUIRED');
    }
  }
}

export function resolveWikiRevision(revision: WikiRevision, owners: WikiOwners) {
  const adapter = revision.sourceRefs.length || revision.extractionRefs.length ? owners.research(revision.asOf) : null;
  wikiRequire(!adapter || adapter.asOf === revision.asOf, 'WIKI_ADAPTER_CUTOFF_MISMATCH');
  const sources = revision.sourceRefs.map(ref => {
    const source = adapter!.resolveSource(ref); adapter!.validateSource(source);
    wikiRequire(canonicalJson(source.ref) === canonicalJson(ref), 'WIKI_SOURCE_REF_MISMATCH'); return source;
  });
  const extractions = revision.extractionRefs.map(ref => {
    const extraction = adapter!.resolveExtraction(ref); adapter!.validateExtraction(extraction);
    wikiRequire(canonicalJson(extraction.ref) === canonicalJson(ref), 'WIKI_EXTRACTION_REF_MISMATCH');
    const rawSources = extraction.sourceRefs.map(sourceRef => {
      const source = adapter!.resolveSource(sourceRef); adapter!.validateSource(source);
      wikiRequire(canonicalJson(source.ref) === canonicalJson(sourceRef), 'WIKI_TRACE_REF_MISMATCH'); return source;
    });
    wikiRequire(rawSources.length > 0, 'WIKI_EXTRACTION_WITHOUT_SOURCE'); return { extraction, sources: rawSources };
  });
  const evidence = revision.evidenceRefs.map(ref => {
    const resolved = owners.evidence(ref, revision.asOf);
    wikiRequire(canonicalJson(resolved.ref) === canonicalJson(ref), 'WIKI_EVIDENCE_OWNER_MISMATCH');
    instant(resolved.availableAt); wikiRequire(before(resolved.availableAt, revision.asOf), 'WIKI_EVIDENCE_NOT_VISIBLE'); return resolved;
  });
  owners.related(revision.relatedRefs, revision.asOf);
  return { sources, extractions, evidence };
}

export function validateWikiReferences(data: WikiData, owners: WikiOwners, asOf?: string): void {
  validateWikiData(data);
  if (asOf) instant(asOf);
  for (const revision of data.revisions) if (!asOf || before(revision.createdAt, asOf)) resolveWikiRevision(revision, owners);
}
export function wikiRevisionStatus(data: WikiData, revisionId: string, asOf: string): 'draft' | WikiReview['decision'] {
  const reviews = data.reviews.filter(row => row.revisionId === revisionId && before(row.createdAt, asOf));
  return reviews.find(row => row.decision === 'archived')?.decision ?? reviews[0]?.decision ?? 'draft';
}

/** No mutable Current object. History ordering is the revision chain, never array order. */
export function buildWikiReadModel(data: WikiData, owners: WikiOwners, asOf: string): WikiReadModel {
  instant(asOf); validateWikiReferences(data, owners, asOf);
  const revisions = data.revisions.filter(row => before(row.createdAt, asOf));
  const depth = (revision: WikiRevision): number => revision.supersedes ? 1 + depth(data.revisions.find(row => row.revisionId === revision.supersedes)!) : 0;
  const pages: WikiPage[] = [];
  for (const entry of [...data.entries].sort((a, b) => compareWikiText(a.wikiId, b.wikiId))) {
    const candidates = revisions.filter(row => row.wikiId === entry.wikiId && ['reviewed', 'archived'].includes(wikiRevisionStatus(data, row.revisionId, asOf))).sort((a, b) => depth(b) - depth(a));
    const revision = candidates[0];
    // A tombstone on the newest approved revision must not resurrect an older page.
    if (!revision || wikiRevisionStatus(data, revision.revisionId, asOf) === 'archived') continue;
    const review = data.reviews.find(row => row.revisionId === revision.revisionId && row.decision === 'reviewed')!;
    const trace = resolveWikiRevision(revision, owners);
    const material = [...trace.sources, ...trace.extractions.flatMap(row => [row.extraction, ...row.sources])];
    const uncertainty = [...new Set([...material.flatMap(row => row.uncertainty), ...trace.extractions.filter(row => row.extraction.review.status !== 'reviewed').map(() => 'extraction_not_reviewed'), ...trace.evidence.flatMap(row => row.audit.quality)])].sort(compareWikiText);
    const completeness = material.some(row => row.completeness === 'UNVERIFIED') || trace.evidence.some(row => row.evidence.quality !== 'verified') ? 'UNVERIFIED'
      : material.some(row => row.completeness === 'PARTIAL') || uncertainty.length ? 'PARTIAL' : 'FULL';
    pages.push({ entry, revision, review, status: 'reviewed', authority: 'research_memory', origin: revision.authorType === 'ai' ? 'ai_draft' : 'user_judgement', asOf, backlinks: [], orphan: false, completeness, uncertainty });
  }
  const ids = new Set(pages.map(page => page.entry.wikiId));
  for (const page of pages) {
    for (const ref of page.revision.wikiRefs) wikiRequire(ids.has(ref.wikiId), 'WIKI_TARGET_NOT_CURRENT_REVIEWED');
    page.backlinks = pages.filter(other => other.revision.wikiRefs.some(ref => ref.wikiId === page.entry.wikiId)).map(other => other.entry.wikiId).sort(compareWikiText);
    page.orphan = !page.backlinks.length && !page.revision.wikiRefs.length;
  }
  return cloneWiki({ schemaVersion: 'wiki-read.v1', asOf, pages, orphanWikiIds: pages.filter(page => page.orphan).map(page => page.entry.wikiId) });
}

/** AND tokens; weighted exact substring fields; ties use ordinal stable wikiId. */
export function searchWiki(model: WikiReadModel, query: string, type?: string): WikiPage[] {
  const tokens = [...new Set(query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean))];
  return model.pages.filter(page => !type || page.entry.type === type).map(page => {
    const r = page.revision;
    const fields = [[r.title, 8], [r.aliases.join(' '), 5], [r.tags.join(' '), 4], [r.summary, 3], [r.bodyMarkdown, 1], [page.entry.type, 2], [canonicalJson(r.relatedRefs), 1]] as const;
    const scores = tokens.map(token => fields.reduce((sum, [text, weight]) => sum + (text.normalize('NFKC').toLowerCase().includes(token) ? weight : 0), 0));
    return { page, score: scores.reduce((a, b) => a + b, 0), matches: scores.every(score => score > 0) };
  }).filter(row => row.matches).sort((a, b) => b.score - a.score || compareWikiText(a.page.entry.wikiId, b.page.entry.wikiId)).map(row => row.page);
}
