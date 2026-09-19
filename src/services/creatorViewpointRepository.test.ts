import { describe, expect, it } from 'vitest';
import type { CreatorViewpointData } from '../types/creatorViewpoint';
import type { StorageLike } from './watchlistRepository';
import { buildCreatorCurrentViews, buildViewpointReviews, buildViewpointTimeline, createEmptyCreatorViewpointData } from './creatorViewpoint';
import { BrowserCreatorViewpointRepository, CREATOR_VIEWPOINT_BACKUP_PREFIX, CREATOR_VIEWPOINT_STORAGE_KEY, migrateCreatorViewpointData } from './creatorViewpointRepository';

const at = '2026-09-01T08:00:00.000Z';
class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  failKey: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failKey && key.startsWith(this.failKey)) throw new Error('quota'); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function setup() {
  const storage = new MemoryStorage();
  const repo = new BrowserCreatorViewpointRepository(storage, () => new Date(at));
  return { storage, repo, base: repo.load().data };
}
function fixture(): CreatorViewpointData {
  const data = createEmptyCreatorViewpointData();
  data.creators = ['one', 'two', 'three'].map(id => ({ id, name: `Creator ${id}`, profileUrl: null, recordedAt: at }));
  data.sources = data.creators.map(creator => ({ id: `source-${creator.id}`, creatorId: creator.id, kind: 'post', url: null, publishedAt: at, publishedAtLabel: null, capturedAt: at, recordedAt: at, content: 'Synthetic short excerpt', parentSourceId: null, supersedesId: null, authorIdentity: 'unverified', identityEvidence: null, completeness: 'PARTIAL', commentCoverage: 'UNVERIFIED' }));
  data.events = [{ id: 'event-one', scope: 'external', eventType: 'macro_external', title: 'Synthetic policy event', summary: 'Synthetic fixture', publishedAt: at, eventOccurredAt: at, recordedAt: at, sourceName: 'fixture', sourceUrl: null, verificationStatus: 'unverified', supersedesId: null }];
  data.observations = data.creators.map(creator => ({ id: `observation-${creator.id}`, creatorId: creator.id, topicId: data.topics[0].id, sourceId: `source-${creator.id}`, recordedAt: at, stance: 'cautious', conditional: 'unknown', horizon: null, trigger: null, confirmation: null, invalidation: null, summary: 'Synthetic view', reasoning: null, eventLinks: [{ eventId: 'event-one', relation: 'temporal', explanation: null }], supersedesId: null, revisionReason: null, important: true }));
  data.approvals = data.observations.map(row => ({ id: `approval-${row.id}`, observationId: row.id, decision: 'reviewed', recordedAt: at, note: 'Manual transcription review' }));
  return data;
}

describe('Creator viewpoint browser repository', () => {
  it('initializes five extensible topics without injecting sample creators or writing storage', () => {
    const { storage, base } = setup();
    expect(base.topics).toHaveLength(5);
    expect(base.creators).toHaveLength(0);
    expect(storage.values.size).toBe(0);
    expect(migrateCreatorViewpointData(migrateCreatorViewpointData(base))).toEqual(base);
  });

  it('persists independent creators and complete history with read-model equivalent JSON round-trip', () => {
    const { repo, base } = setup();
    const source = fixture();
    const saved = repo.append(base, { creators: source.creators, sources: source.sources, events: source.events, observations: source.observations, approvals: source.approvals });
    const target = setup();
    const restored = target.repo.import(target.base, repo.export(saved), true);
    expect(restored).toEqual(saved);
    expect(buildCreatorCurrentViews(restored)).toEqual(buildCreatorCurrentViews(saved));
    expect(buildViewpointTimeline(restored)).toEqual(buildViewpointTimeline(saved));
    expect(buildViewpointReviews(restored)).toEqual(buildViewpointReviews(saved));
    expect(restored.creators).toHaveLength(3);
    expect(target.repo.load().data).toEqual(restored);
  });

  it.each(['{broken', JSON.stringify({ ...createEmptyCreatorViewpointData(), schemaVersion: 99 })])('locks corrupted or future-schema storage without erasing raw bytes', raw => {
    const storage = new MemoryStorage(); storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, raw);
    const repo = new BrowserCreatorViewpointRepository(storage);
    const result = repo.load();
    expect(result.error).toBeTruthy(); expect(result.corruptedRaw).toBe(raw);
    expect(() => repo.append(result.data, {})).toThrow();
    expect(() => repo.import(result.data, repo.export(createEmptyCreatorViewpointData()), true)).toThrow();
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(raw);
  });

  it('rejects duplicates, changes to caller-owned history, and unbound bases', () => {
    const { repo, base, storage } = setup();
    const saved = repo.append(base, { creators: fixture().creators });
    const bytes = storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY);
    expect(() => repo.append(saved, { creators: [saved.creators[0]] })).toThrow(/重复/);
    expect(() => repo.append(structuredClone(saved), {})).toThrow(/基线/);
    saved.creators[0].name = 'tampered';
    expect(() => repo.append(saved, {})).toThrow(/不能原地修改/);
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(bytes);
  });

  it('also refuses tampering with an initially empty base', () => {
    const { repo, base, storage } = setup(); base.creators.push(fixture().creators[0]);
    expect(() => repo.append(base, {})).toThrow(/不能原地修改/);
    expect(storage.values.size).toBe(0);
  });

  it('rejects already changed cross-tab bases for append and import', () => {
    const { repo, base, storage } = setup();
    const second = new BrowserCreatorViewpointRepository(storage); const secondBase = second.load().data;
    repo.append(base, { creators: fixture().creators });
    expect(() => second.append(secondBase, {})).toThrow(/已变化/);
    expect(() => second.import(secondBase, repo.export(fixture()), true)).toThrow(/已变化/);
  });

  it('requires confirmation and stores exact pre-import bytes before merging', () => {
    const { repo, base, storage } = setup();
    const saved = repo.append(base, { creators: fixture().creators.slice(0, 1) });
    const oldRaw = storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY);
    const raw = repo.export(fixture());
    expect(() => repo.import(saved, raw, false)).toThrow(/确认/);
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(oldRaw);
    const imported = repo.import(saved, raw, true);
    const backupKey = [...storage.values.keys()].find(key => key.startsWith(CREATOR_VIEWPOINT_BACKUP_PREFIX))!;
    expect(storage.getItem(backupKey)).toBe(oldRaw);
    const preview = repo.previewImport(raw, imported);
    expect(preview.addCount).toBe(0);
    expect(preview.skipCount).toBeGreaterThan(0);
    repo.import(imported, raw, true);
    expect([...storage.values.keys()].filter(key => key.startsWith(CREATOR_VIEWPOINT_BACKUP_PREFIX))).toHaveLength(2);
    expect(storage.getItem(backupKey)).toBe(oldRaw);
  });

  it('refuses conflicting same-ID history even when import is confirmed', () => {
    const { repo, base, storage } = setup();
    const saved = repo.append(base, { creators: fixture().creators });
    const conflict = fixture(); conflict.creators[0].name = 'silently changed';
    const before = storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY);
    expect(() => repo.previewImport(repo.export(conflict), saved)).toThrow(/冲突/);
    expect(() => repo.import(saved, repo.export(conflict), true)).toThrow(/冲突/);
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(before);
  });

  it('does not mutate business storage when pre-backup or atomic setItem fails', () => {
    const { repo, base, storage } = setup();
    storage.failKey = CREATOR_VIEWPOINT_BACKUP_PREFIX;
    expect(() => repo.import(base, repo.export(fixture()), true)).toThrow('quota');
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBeNull();
    storage.failKey = CREATOR_VIEWPOINT_STORAGE_KEY;
    expect(() => repo.append(base, { creators: fixture().creators })).toThrow('quota');
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBeNull();
  });

  it('preserves old observation and source when revised history is appended and restored', () => {
    const { repo, base } = setup(); const data = fixture();
    const original = repo.import(base, repo.export(data), true);
    const later = '2026-09-02T08:00:00.000Z';
    const revisedSource = { ...data.sources[0], id: 'source-revision', recordedAt: later, capturedAt: later, supersedesId: data.sources[0].id, content: 'Synthetic correction' };
    const revised = { ...data.observations[0], id: 'observation-revision', sourceId: revisedSource.id, recordedAt: later, supersedesId: data.observations[0].id, revisionReason: 'Correct transcription', summary: 'Revised synthetic view' };
    const next = repo.append(original, { sources: [revisedSource], observations: [revised], approvals: [{ id: 'approval-revision', observationId: revised.id, decision: 'reviewed', recordedAt: later, note: 'Review correction' }] });
    const target = setup(); const restored = target.repo.import(target.base, repo.export(next), true);
    expect(restored.sources).toContainEqual(data.sources[0]);
    expect(restored.observations).toContainEqual(data.observations[0]);
    expect(restored.observations).toContainEqual(revised);
    expect(buildCreatorCurrentViews(restored, at)).toEqual(buildCreatorCurrentViews(original, at));
  });

  it('fails closed when storage is unavailable', () => {
    const repo = new BrowserCreatorViewpointRepository(null); const result = repo.load();
    expect(result.error).toBeTruthy(); expect(() => repo.append(result.data, {})).toThrow();
  });
});
