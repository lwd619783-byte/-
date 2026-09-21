import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { contributionContract, contributionInstructions } from './contribution-contract.mjs';

export const STAGING_TTL_MS = 24 * 60 * 60 * 1000;
export const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/);
const nonempty = z.string().min(1).max(200000);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const metadata = z.object({ sourceId: id, batchId: id, filename: z.string().min(1).max(300), mime: z.string().min(1).max(100), size: z.number().int().positive().max(25 * 1024 * 1024), sha256: hash,
  capturedAt: z.string().datetime({ offset: true }), kind: z.enum(['pdf', 'markdown', 'text']), parsedTextSha256: hash }).strict();
export const sourceInput = z.object({ metadata, segments: z.array(z.object({ locator: z.string().regex(/^(page|line):[1-9]\d*$/), label: z.string().min(1).max(100), text: z.string().max(1000000) }).strict()).min(1).max(50000) }).strict();
const revision = z.object({ revisionId: nonempty, title: nonempty, summary: z.string().max(200000), bodyMarkdown: nonempty, createdAt: z.string().datetime({ offset: true }), asOf: z.string().datetime({ offset: true }), sourceRefs: z.array(z.object({ schemaVersion: z.literal('research-source-ref.v1'), sourceDomain: nonempty, sourceId: nonempty }).strict()).max(1000), reviewId: nonempty }).strict();
export const knowledgeInput = z.object({ wikiId: z.string().min(1).max(500), currentRevisionId: nonempty, revisions: z.array(revision).min(1).max(100) }).strict();
export const beginInput = z.object({ batchId: id, title: z.string().min(1).max(500), sourceMetadata: z.array(metadata).min(1).max(30), knowledgeIds: z.array(z.string().min(1).max(500)).max(30), consent: z.literal('stage-selected-batch-and-knowledge') }).strict();
const keyId = value => createHash('sha256').update(value).digest('hex');

export class ResearchStaging {
  constructor(store, subject, now = () => Date.now()) { this.store = store; this.subject = subject; this.now = now; this.root = `research-bridge/v1/${keyId(subject)}/`; }
  path(stageId, suffix) { id.parse(stageId); return `${this.root}stages/${stageId}/${suffix}.json`; }
  batchPath(batchId) { id.parse(batchId); return `${this.root}batches/${keyId(batchId)}/access.json`; }
  async batchAccess(batchId) {
    const row = await this.store.versioned(this.batchPath(batchId));
    if (row) requireValue(row.value.batchId === batchId && id.safeParse(row.value.generation).success, 'STAGING_ACCESS_INVALID');
    return row;
  }
  async batchRevoked(manifest) {
    const access = await this.batchAccess(manifest.batchId);
    return (manifest.accessGeneration ?? null) !== (access?.value.generation ?? null);
  }
  async begin(input) {
    const value = beginInput.parse(input);
    requireValue(new Set(value.sourceMetadata.map(s => s.sourceId)).size === value.sourceMetadata.length && new Set(value.knowledgeIds).size === value.knowledgeIds.length && value.sourceMetadata.every(s => s.batchId === value.batchId), 'STAGING_ID_CONFLICT');
    const stageId = `stage-${randomUUID()}`, createdAt = new Date(this.now()).toISOString(), expiresAt = new Date(this.now() + STAGING_TTL_MS).toISOString();
    const accessGeneration = (await this.batchAccess(value.batchId))?.value.generation ?? null;
    const manifest = { schemaVersion: 'research-staging.v1', stageId, ...value, accessGeneration, createdAt, expiresAt, authority: 'temporary_processing_copy', originalsCopied: false };
    await this.store.putNew(this.path(stageId, 'manifest'), manifest);
    await this.manifest(stageId, false);
    return { stageId, batchId: value.batchId, createdAt, expiresAt, status: 'uploading' };
  }
  async manifest(stageId, published = true) {
    const manifest = await this.store.get(this.path(stageId, 'manifest'));
    requireValue(manifest && manifest.stageId === stageId && Date.parse(manifest.expiresAt) > this.now(), 'STAGING_NOT_AVAILABLE');
    requireValue(!await this.store.get(this.path(stageId, 'revoked')), 'STAGING_NOT_AVAILABLE');
    requireValue(!await this.batchRevoked(manifest), 'STAGING_NOT_AVAILABLE');
    if (published) requireValue(await this.store.get(this.path(stageId, 'published')), 'STAGING_NOT_AVAILABLE');
    return manifest;
  }
  async putSource(stageId, input) {
    const manifest = await this.manifest(stageId, false), source = sourceInput.parse(input);
    requireValue(!await this.store.get(this.path(stageId, 'published')), 'STAGING_IMMUTABLE');
    const expected = manifest.sourceMetadata.find(s => s.sourceId === source.metadata.sourceId);
    requireValue(expected && JSON.stringify(expected) === JSON.stringify(source.metadata) && digest(source.segments) === expected.parsedTextSha256, 'STAGING_DIGEST_MISMATCH');
    requireValue(new Set(source.segments.map(s => s.locator)).size === source.segments.length && source.segments.every(s => s.locator.startsWith(source.metadata.kind === 'pdf' ? 'page:' : 'line:')), 'STAGING_LOCATOR_INVALID');
    await this.store.putNew(this.path(stageId, `sources/${keyId(source.metadata.sourceId)}`), source);
  }
  async putKnowledge(stageId, input) {
    const manifest = await this.manifest(stageId, false), document = knowledgeInput.parse(input);
    requireValue(!await this.store.get(this.path(stageId, 'published')), 'STAGING_IMMUTABLE');
    requireValue(manifest.knowledgeIds.includes(document.wikiId) && document.revisions.some(r => r.revisionId === document.currentRevisionId)
      && new Set(document.revisions.map(r => r.revisionId)).size === document.revisions.length, 'STAGING_KNOWLEDGE_INVALID');
    await this.store.putNew(this.path(stageId, `knowledge/${keyId(document.wikiId)}`), document);
  }
  async publish(stageId) {
    const m = await this.manifest(stageId, false);
    for (const source of m.sourceMetadata) requireValue(await this.store.get(this.path(stageId, `sources/${keyId(source.sourceId)}`)), 'STAGING_INCOMPLETE');
    for (const wikiId of m.knowledgeIds) requireValue(await this.store.get(this.path(stageId, `knowledge/${keyId(wikiId)}`)), 'STAGING_INCOMPLETE');
    await this.manifest(stageId, false);
    await this.store.putNew(this.path(stageId, 'published'), { at: new Date(this.now()).toISOString() });
    await this.manifest(stageId);
    return { stageId, batchId: m.batchId, createdAt: m.createdAt, expiresAt: m.expiresAt, status: 'readable' };
  }
  async revoke(stageId) {
    // Also allow revoking incomplete/expired stages; tombstone never removed/re-published.
    requireValue(await this.store.get(this.path(stageId, 'manifest')), 'STAGING_NOT_AVAILABLE');
    const key = this.path(stageId, 'revoked'); if (!await this.store.get(key)) await this.store.putNew(key, { at: new Date(this.now()).toISOString() });
    return { stageId, status: 'revoked' };
  }
  async revokeBatch(batchId) {
    // Bounded regardless of expired/revoked stage accumulation. CAS orders concurrent revokes.
    const key = this.batchPath(batchId);
    for (let attempt = 0; attempt < 8; attempt++) {
      const previous = await this.batchAccess(batchId), generation = `revoke-${randomUUID()}`;
      const event = { batchId, generation, previousGeneration: previous?.value.generation ?? null, revokedAt: new Date(this.now()).toISOString() };
      await this.store.putNew(`${this.root}batches/${keyId(batchId)}/events/${generation}.json`, event);
      if (await this.store.compareExchange(key, previous?.etag ?? null, event)) return { batchId, status: 'revoked', revokedAt: event.revokedAt, generation };
    }
    throw new Error('STAGING_REVOKE_CONFLICT');
  }
  async status(stageId) {
    const m = await this.store.get(this.path(stageId, 'manifest')); requireValue(m, 'STAGING_NOT_AVAILABLE');
    return { stageId, batchId: m.batchId, createdAt: m.createdAt, expiresAt: m.expiresAt, status: await this.store.get(this.path(stageId, 'revoked')) || await this.batchRevoked(m) ? 'revoked' : Date.parse(m.expiresAt) <= this.now() ? 'expired' : await this.store.get(this.path(stageId, 'published')) ? 'readable' : 'uploading' };
  }
  async list() {
    const rows = [];
    for (const key of await this.store.keys(`${this.root}stages/`)) if (key.endsWith('/manifest.json')) {
      const stageId = key.split('/').at(-2), status = await this.status(stageId);
      if (status.status === 'readable') { const m = await this.manifest(stageId); rows.push({ ...status, title: m.title, sourceCount: m.sourceMetadata.length }); }
    }
    return rows;
  }
  async source(stageId, sourceId) {
    id.parse(sourceId); const manifest = await this.manifest(stageId);
    requireValue(manifest.sourceMetadata.some(s => s.sourceId === sourceId), 'STAGING_NOT_AVAILABLE');
    const source = await this.store.get(this.path(stageId, `sources/${keyId(sourceId)}`));
    requireValue(source && digest(source.segments) === source.metadata.parsedTextSha256, 'STAGING_DIGEST_MISMATCH');
    await this.manifest(stageId); return source;
  }
  async knowledge(stageId, wikiId) {
    const manifest = await this.manifest(stageId); requireValue(manifest.knowledgeIds.includes(wikiId), 'STAGING_NOT_AVAILABLE');
    const doc = await this.store.get(this.path(stageId, `knowledge/${keyId(wikiId)}`)); requireValue(doc, 'STAGING_NOT_AVAILABLE');
    await this.manifest(stageId); return doc;
  }
}

const stage = { stageId: id }, windowArgs = { start: z.number().int().min(1).default(1), count: z.number().int().min(1).max(5).default(1), offset: z.number().int().min(0).max(1000000).default(0) };
export const toolSchemas = {
  list_pending_batches: z.object({}).strict(), get_batch_manifest: z.object(stage).strict(),
  get_source_metadata: z.object({ ...stage, sourceId: id }).strict(),
  read_source_pages: z.object({ ...stage, sourceId: id, ...windowArgs }).strict(),
  search_source: z.object({ ...stage, sourceId: id, query: z.string().min(1).max(200), start: z.number().int().min(1).default(1) }).strict(),
  search_knowledge: z.object({ ...stage, query: z.string().min(1).max(200) }).strict(),
  get_knowledge_document: z.object({ ...stage, wikiId: z.string().min(1).max(500), revisionId: z.string().min(1).max(500).optional(), offset: z.number().int().min(0).max(200000).default(0) }).strict(),
  get_knowledge_history: z.object({ ...stage, wikiId: z.string().min(1).max(500) }).strict(),
};
export async function callReadTool(staging, name, args) {
  requireValue(Object.hasOwn(toolSchemas, name), 'TOOL_NOT_ALLOWED');
  const a = toolSchemas[name].parse(args);
  if (name === 'list_pending_batches') return { batches: await staging.list() };
  if (name === 'get_batch_manifest') return { ...await staging.manifest(a.stageId), contributionContract, contributionInstructions };
  if (name === 'get_source_metadata') { const s = await staging.source(a.stageId, a.sourceId); return { ...s.metadata, segmentCount: s.segments.length, originalsCopied: false }; }
  if (name === 'read_source_pages') {
    const s = await staging.source(a.stageId, a.sourceId), segments = s.segments.slice(a.start - 1, a.start - 1 + a.count);
    requireValue(segments.length > 0, 'PAGE_RANGE_INVALID');
    return { sourceId: a.sourceId, sha256: s.metadata.sha256, parsedTextSha256: s.metadata.parsedTextSha256, totalSegments: s.segments.length,
      segments: segments.map(p => ({ ...p, text: p.text.slice(a.offset, a.offset + 12000), offset: a.offset, totalCharacters: p.text.length, nextOffset: p.text.length > a.offset + 12000 ? a.offset + 12000 : null })) };
  }
  if (name === 'search_source') {
    const s = await staging.source(a.stageId, a.sourceId), hits = [];
    for (let i = a.start - 1; i < s.segments.length && hits.length < 20; i++) { const p = s.segments[i], at = p.text.toLocaleLowerCase().indexOf(a.query.toLocaleLowerCase()); if (at >= 0) hits.push({ locator: p.locator, label: p.label, segment: i + 1, offset: at, quote: p.text.slice(Math.max(0, at - 120), at + 300) }); }
    return { sourceId: a.sourceId, sha256: s.metadata.sha256, parsedTextSha256: s.metadata.parsedTextSha256, hits, nextStart: hits.length === 20 ? hits.at(-1).segment + 1 : null };
  }
  if (name === 'search_knowledge') {
    const m = await staging.manifest(a.stageId), matches = [];
    for (const wikiId of m.knowledgeIds) { const doc = await staging.knowledge(a.stageId, wikiId), r = doc.revisions.find(r => r.revisionId === doc.currentRevisionId); if (`${r.title} ${r.summary} ${r.bodyMarkdown}`.toLowerCase().includes(a.query.toLowerCase())) matches.push({ wikiId, revisionId: r.revisionId, title: r.title, summary: r.summary.slice(0, 1000) }); }
    return { matches };
  }
  const doc = await staging.knowledge(a.stageId, a.wikiId);
  if (name === 'get_knowledge_history') return { wikiId: doc.wikiId, currentRevisionId: doc.currentRevisionId, revisions: doc.revisions.map(({ bodyMarkdown, ...r }) => ({ ...r, bodyCharacters: bodyMarkdown.length })) };
  const r = doc.revisions.find(r => r.revisionId === (a.revisionId ?? doc.currentRevisionId)); requireValue(r, 'REVISION_NOT_STAGED');
  return { wikiId: doc.wikiId, ...r, bodyMarkdown: r.bodyMarkdown.slice(a.offset, a.offset + 20000), offset: a.offset, nextOffset: r.bodyMarkdown.length > a.offset + 20000 ? a.offset + 20000 : null, totalCharacters: r.bodyMarkdown.length };
}
