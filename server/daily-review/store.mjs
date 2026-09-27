import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { validateReview, publishReviewSchema, reviewQuerySchema, reviewRecordSchema, reviewId, reviewRequire as need } from '../../shared/daily-review.mjs';
import { validateOSReferences } from './context.mjs';

export const hashReview = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const entrySchema = z.object({ object: z.string().uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/), id: z.string(), revision: z.number().int().positive(), date: z.string(), at: z.string(), asOf: z.string() }).strict();
const manifestSchema = z.object({ version: z.literal(1), epoch: z.number().int().nonnegative(), entries: z.array(entrySchema).max(4096),
  accessAudits: z.array(z.object({ object: z.string().uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict()).max(4096).default([]),
  receipts: z.array(z.object({ key: z.string(), request: z.string(), object: z.string().uuid() }).strict()).max(8192) }).strict();

/** Permanent Review authority. Only the manifest is mutable; content and audit are immutable.
 * CAS of the manifest is the commit point. An orphan from a failed CAS is never readable.
 * Revocation shares that commit point, so a write cannot race past a committed revocation.
 */
export class DailyReviewStore {
  constructor(store, { owner = 'personal-owner', workspace, scope = 'real', now = Date.now } = {}) {
    need(typeof workspace === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(workspace), 'REVIEW_WORKSPACE_REQUIRED');
    need(['real', 'synthetic'].includes(scope), 'REVIEW_SCOPE_REQUIRED');
    this.store = store; this.owner = owner; this.workspace = workspace; this.scope = scope; this.now = now;
    this.prefix = `daily-review/v1/${scope}/${hashReview({ owner, workspace })}/oil-shipping/`;
    this.key = `${this.prefix}manifest.json`;
  }
  async state() {
    const found = await this.store.versioned(this.key);
    return { value: found ? manifestSchema.parse(found.value) : { version: 1, epoch: 0, entries: [], receipts: [], accessAudits: [] }, etag: found?.etag ?? null };
  }
  authorize(state, grant) {
    need(grant && grant.owner === this.owner && grant.workspace === this.workspace && grant.scope === this.scope, 'REVIEW_IDENTITY_REJECTED');
    if (grant.actor === 'owner') return;
    need(grant.actor === 'ai' && Number.isSafeInteger(grant.epoch) && grant.epoch === state.epoch && grant.expiresAt > this.now(), 'REVIEW_ACCESS_REVOKED_OR_EXPIRED');
  }
  async load(entry) {
    const raw = await this.store.get(`${this.prefix}revisions/${entry.object}.json`);
    need(raw && hashReview(raw) === entry.digest, 'REVIEW_INTEGRITY_FAILED');
    const r = reviewRecordSchema.parse(raw);
    validateReview(r.content, this.now());
    need(r.reviewId === entry.id && r.revision === entry.revision && r.createdAt === entry.at && r.content.asOf === entry.asOf
      && r.content.reviewDate === entry.date && r.contentDigest === hashReview(r.content)
      && r.audit.owner === this.owner && r.audit.workspace === this.workspace && r.audit.scope === this.scope, 'REVIEW_INTEGRITY_FAILED');
    return r;
  }
  async checkedState(grant) { const s = await this.state(); this.authorize(s.value, grant); return s; }
  async recheck(grant) { await this.checkedState(grant); }
  async read(query, grant) {
    const q = reviewQuerySchema.parse(query), s = await this.checkedState(grant);
    need(!q.revision || !!q.reviewDate, 'REVIEW_EXACT_DATE_REQUIRED');
    need(!q.asOf || Date.parse(q.asOf) <= this.now(), 'REVIEW_FUTURE_CONTEXT');
    const visible = s.value.entries.filter(e => (!q.reviewDate || e.date === q.reviewDate) && (!q.asOf || (Date.parse(e.asOf) <= Date.parse(q.asOf) && Date.parse(e.at) <= Date.parse(q.asOf))));
    const sorted = visible.toSorted((a,b) => b.date.localeCompare(a.date) || b.revision - a.revision);
    const entry = q.revision ? sorted.find(e => e.revision === q.revision) : sorted[0];
    const record = entry ? await this.load(entry) : null;
    const current = entry ? sorted.find(e => e.id === entry.id)?.revision === entry.revision : false;
    await this.recheck(grant);
    return { record, effectiveStatus: record ? current ? record.status : 'SUPERSEDED' : null, isCurrent: current, scope: this.scope };
  }
  async history(query, grant) {
    const q = reviewQuerySchema.parse(query), s = await this.checkedState(grant);
    need(!q.revision && (!q.asOf || Date.parse(q.asOf) <= this.now()), 'REVIEW_HISTORY_QUERY');
    const entries = s.value.entries.filter(e => (!q.reviewDate || e.date === q.reviewDate) && (!q.asOf || (Date.parse(e.asOf) <= Date.parse(q.asOf) && Date.parse(e.at) <= Date.parse(q.asOf))))
      .toSorted((a,b) => b.date.localeCompare(a.date) || b.revision - a.revision);
    const start = q.before ?? 0, page = entries.slice(start, start + (q.limit ?? 20));
    const items = await Promise.all(page.map(async entry => {
      const r = await this.load(entry), current = entries.find(e => e.id === entry.id)?.object === entry.object;
      return { reviewId: r.reviewId, reviewDate: r.content.reviewDate, revision: r.revision, createdAt: r.createdAt, status: current ? r.status : 'SUPERSEDED', originalStatus: r.status };
    }));
    await this.recheck(grant);
    return { items, next: start + page.length < entries.length ? start + page.length : null };
  }
  async prepare(input, grant) {
    const p = publishReviewSchema.parse(input), review = validateReview(p.review, this.now());
    const s = await this.checkedState(grant);
    need(grant.actor === 'ai', 'REVIEW_AI_LANE_REQUIRED');
    const request = hashReview(p), key = hashReview(p.idempotencyKey), replay = s.value.receipts.find(r => r.key === key);
    if (replay) { need(replay.request === request, 'REVIEW_IDEMPOTENCY_CONFLICT'); return { p, s, review, request, key, replay }; }
    validateOSReferences(review, this.now());
    const id = reviewId(review), current = s.value.entries.findLast(e => e.id === id);
    const currentRecord = current ? await this.load(current) : null;
    if (currentRecord && currentRecord.contentDigest === hashReview(review) && currentRecord.status === review.status) {
      need(p.expectedRevision <= current.revision, 'REVIEW_CAS_CONFLICT');
      return { p, s, review, request, key, current };
    }
    need((current?.revision ?? 0) === p.expectedRevision, 'REVIEW_CAS_CONFLICT');
    if (review.previousReviewId) {
      const previous = s.value.entries.find(e => e.id === review.previousReviewId && e.revision === review.previousRevision);
      need(previous && Date.parse(previous.asOf) <= Date.parse(review.asOf) && Date.parse(previous.at) <= Date.parse(review.asOf), 'REVIEW_PREVIOUS_NOT_AVAILABLE_ASOF');
    }
    if (current) need(review.previousReviewId === current.id && review.previousRevision === current.revision, 'REVIEW_PREVIOUS_EXACT_REQUIRED');
    if (current) need(Date.parse(review.asOf) >= Date.parse(current.asOf), 'REVIEW_ASOF_REGRESSION');
    return { p, s, review, request, key, current };
  }
  async preview(input, grant) {
    const p = await this.prepare(input, grant);
    return { review: p.review, contentDigest: hashReview(p.review), requestDigest: p.request, expectedRevision: p.p.expectedRevision, replay: !!p.replay, formalDecisionWrite: false };
  }
  async publish(input, grant) {
    const p = await this.prepare(input, grant), { s, review, key, request } = p;
    if (p.replay) { const record = await this.load(s.value.entries.find(e => e.object === p.replay.object)); await this.recheck(grant); return { record, replay: true }; }
    need(s.value.receipts.length < 8192, 'REVIEW_CAPACITY_REACHED');
    // New keys for the same current content bind a receipt without another revision.
    if (p.current) {
      const current = await this.load(p.current);
      if (current.contentDigest === hashReview(review) && current.status === review.status) {
        const value = { ...s.value, receipts: [...s.value.receipts, { key, request, object: p.current.object }] };
        this.authorize(value, grant);
        need(await this.store.compareExchange(this.key, s.etag, value), 'REVIEW_CAS_CONFLICT');
        return { record: current, replay: true };
      }
    }
    return this.append(s, review, p.current, grant, 'publish', review.status, { key, request });
  }
  async append(s, content, current, grant, action, status, receipt = null) {
    need(s.value.entries.length < 4096, 'REVIEW_CAPACITY_REACHED');
    const now = new Date(this.now()).toISOString(), today = now.slice(0,10);
    need(s.value.entries.filter(e => e.at.startsWith(today)).length < 24, 'REVIEW_DAILY_LIMIT');
    const record = reviewRecordSchema.parse({ schemaVersion: 'daily-review.v1', reviewId: reviewId(content), revision: (current?.revision ?? 0) + 1,
      createdAt: now, updatedAt: now, status, content, contentDigest: hashReview(content), previousRevision: current?.revision ?? null,
      audit: { actor: grant.actor, action, owner: this.owner, workspace: this.workspace, scope: this.scope } });
    const object = randomUUID();
    await this.store.putNew(`${this.prefix}revisions/${object}.json`, record);
    const value = { ...s.value, entries: [...s.value.entries, { object, digest: hashReview(record), id: record.reviewId, revision: record.revision, date: content.reviewDate, at: now, asOf: content.asOf }],
      receipts: receipt ? [...s.value.receipts, { ...receipt, object }] : s.value.receipts };
    this.authorize(value, grant);
    need(await this.store.compareExchange(this.key, s.etag, value), 'REVIEW_CAS_CONFLICT');
    return { record, replay: false };
  }
  async ownerTransition(input, grant) {
    const p = z.object({ reviewDate: reviewQuerySchema.shape.reviewDate.unwrap(), expectedRevision: z.number().int().positive(), action: z.enum(['confirm', 'withdraw']),
      confirmation: z.literal('confirm-exact-review-only') }).strict().parse(input);
    const s = await this.checkedState(grant); need(grant.actor === 'owner', 'REVIEW_OWNER_REQUIRED');
    const current = s.value.entries.findLast(e => e.date === p.reviewDate);
    need(current && current.revision === p.expectedRevision, 'REVIEW_CAS_CONFLICT');
    const old = await this.load(current);
    need(old.status !== 'WITHDRAWN' && (p.action !== 'confirm' || old.status !== 'USER_CONFIRMED'), 'REVIEW_INVALID_TRANSITION');
    return this.append(s, old.content, current, grant, p.action, p.action === 'confirm' ? 'USER_CONFIRMED' : 'WITHDRAWN');
  }
  async revoke(grant) {
    const s = await this.checkedState(grant); need(grant.actor === 'owner', 'REVIEW_OWNER_REQUIRED');
    need(s.value.accessAudits.length < 4096, 'REVIEW_CAPACITY_REACHED');
    const object = randomUUID(), audit = { action: 'revoke-writers', actor: 'owner', owner: this.owner, workspace: this.workspace, scope: this.scope, at: new Date(this.now()).toISOString(), epoch: s.value.epoch + 1 };
    await this.store.putNew(`${this.prefix}access/${object}.json`, audit);
    need(await this.store.compareExchange(this.key, s.etag, { ...s.value, epoch: s.value.epoch + 1, accessAudits: [...s.value.accessAudits, { object, digest: hashReview(audit) }] }), 'REVIEW_CAS_CONFLICT');
    return { revoked: true, epoch: s.value.epoch + 1 };
  }
}
