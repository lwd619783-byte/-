import { z } from 'zod';
import { canonicalJson } from './canonical-json.mjs';
import { isStrictCalendarDate, isStrictPreciseInstant } from '../src/utils/strictDateTime.mjs';

export const MAX_REVIEW_BYTES = 32768;
export const day = z.string().refine(isStrictCalendarDate, 'INVALID_DATE');
export const instant = z.string().refine(isStrictPreciseInstant, 'INVALID_INSTANT');
const text = z.string().trim().min(1).max(600), id = z.string().regex(/^[a-zA-Z0-9_.:-]{1,120}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const reviewStatus = z.enum(['AI_DRAFT', 'AI_PUBLISHED', 'USER_CONFIRMED', 'SUPERSEDED', 'WITHDRAWN']);
const source = z.object({ id, kind: z.enum(['os', 'notion', 'public']), title: text,
  locator: z.string().max(1000), revision: z.string().min(1).max(160).nullable(),
  sourceDate: day.nullable(), asOf: instant, availableAt: instant.nullable(),
  availability: z.enum(['available', 'missing', 'stale', 'conflicted', 'blocked']),
  relationToOS: z.enum(['os_state', 'external_unverified', 'external_conflict']),
}).strict();
const note = z.object({ text, sourceIds: z.array(id).max(12) }).strict();
const notes = z.array(note).max(8);
export const reviewContentSchema = z.object({ schemaVersion: z.literal('daily-review.v1'),
  subjectType: z.literal('industry'), subjectId: z.literal('oil-shipping'), reviewDate: day,
  asOf: instant, dataAsOf: instant, generatedAt: instant,
  generator: z.object({ type: z.literal('ai'), name: z.string().min(1).max(80) }).strict(),
  sources: z.array(source).min(1).max(20),
  previousReviewId: z.string().regex(/^industry:oil-shipping:\d{4}-\d{2}-\d{2}$/).nullable(), previousRevision: z.number().int().positive().nullable(),
  status: z.enum(['AI_DRAFT', 'AI_PUBLISHED']), summary: text,
  observations: z.array(note.extend({ kind: z.enum(['fact', 'derived', 'interpretation']) }).strict()).max(8),
  delta: notes, supports: notes, challenges: notes, risks: notes,
  watchNext: z.array(z.object({ condition: text, metric: text, currentState: text,
    direction: z.enum(['up', 'down', 'change', 'available', 'unknown']), horizon: text, sourceIds: z.array(id).max(12) }).strict()).max(6),
  confidence: z.enum(['low', 'medium', 'high', 'unknown']), uncertainty: z.array(text).min(1).max(6),
  formalDecisionImpact: z.enum(['none', 'review_required', 'candidate_for_formal_update']),
}).strict();
export const publishReviewSchema = z.object({ review: reviewContentSchema,
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/), expectedRevision: z.number().int().nonnegative(),
}).strict();
export const reviewQuerySchema = z.object({ reviewDate: day.optional(), revision: z.number().int().positive().optional(),
  asOf: instant.optional(), before: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(20).optional() }).strict();
export const reviewRecordSchema = z.object({ schemaVersion: z.literal('daily-review.v1'), reviewId: z.string(), revision: z.number().int().positive(),
  createdAt: instant, updatedAt: instant, status: reviewStatus, content: reviewContentSchema,
  contentDigest: digest, previousRevision: z.number().int().positive().nullable(),
  audit: z.object({ actor: z.enum(['ai', 'owner']), action: z.enum(['publish', 'confirm', 'withdraw']), owner: z.string(), workspace: z.string(), scope: z.enum(['real', 'synthetic']) }).strict(),
}).strict();
export const reviewId = review => `industry:oil-shipping:${review.reviewDate}`;
export function reviewRequire(ok, code) { if (!ok) throw Error(code); }
export function validateReview(input, now = Date.now()) {
  reviewRequire(new TextEncoder().encode(canonicalJson(input)).length <= MAX_REVIEW_BYTES, 'REVIEW_TOO_LARGE');
  const r = reviewContentSchema.parse(input), cutoff = Date.parse(r.asOf);
  reviewRequire(cutoff <= now && Date.parse(r.generatedAt) <= now && Date.parse(r.generatedAt) >= cutoff && Date.parse(r.dataAsOf) <= cutoff, 'REVIEW_FUTURE_TIME');
  const localDay = new Date(cutoff + 8 * 3600000).toISOString().slice(0, 10);
  reviewRequire(r.reviewDate === localDay, 'REVIEW_DATE_ASOF_MISMATCH');
  reviewRequire((r.previousReviewId === null) === (r.previousRevision === null), 'REVIEW_PREVIOUS_REF');
  reviewRequire(!r.delta.length || r.previousReviewId !== null, 'REVIEW_DELTA_PREVIOUS_REQUIRED');
  const refs = new Map(r.sources.map(s => [s.id, s]));
  reviewRequire(refs.size === r.sources.length, 'REVIEW_DUPLICATE_SOURCE');
  for (const s of r.sources) {
    reviewRequire(Date.parse(s.asOf) <= cutoff && (!s.availableAt || Date.parse(s.availableAt) <= cutoff) && (!s.sourceDate || s.sourceDate <= r.reviewDate), 'REVIEW_FUTURE_SOURCE');
    reviewRequire(!s.sourceDate || s.sourceDate <= new Date(Date.parse(s.asOf) + 8 * 3600000).toISOString().slice(0,10), 'REVIEW_SOURCE_DATE_ASOF');
    if (['available', 'stale'].includes(s.availability)) reviewRequire(s.availableAt !== null && s.sourceDate !== null, 'REVIEW_MISSING_SOURCE_TIME');
    if (s.kind === 'os') reviewRequire(s.locator.startsWith('os:') && s.locator.length > 3 && s.relationToOS === 'os_state' && s.revision !== null, 'REVIEW_OS_REF');
    else {
      let url; try { url = new URL(s.locator); } catch { throw Error('REVIEW_SOURCE_URL'); }
      reviewRequire(url.protocol === 'https:' && !url.username && !url.password && s.relationToOS !== 'os_state', 'REVIEW_SOURCE_URL');
      if (s.kind === 'notion') reviewRequire(url.hostname === 'notion.so' || url.hostname.endsWith('.notion.so') || url.hostname.endsWith('.notion.site'), 'REVIEW_NOTION_URL');
    }
  }
  for (const n of [...r.observations, ...r.delta, ...r.supports, ...r.challenges, ...r.risks, ...r.watchNext]) {
    reviewRequire(n.sourceIds.every(key => refs.has(key)), 'REVIEW_UNRESOLVED_SOURCE');
    if (n.kind === 'fact' || n.kind === 'derived') {
      reviewRequire(n.sourceIds.length > 0, 'REVIEW_FACT_SOURCE_REQUIRED');
      reviewRequire(n.sourceIds.every(key => refs.get(key).availability === 'available'), 'REVIEW_FACT_SOURCE_UNAVAILABLE');
    }
  }
  return r;
}
