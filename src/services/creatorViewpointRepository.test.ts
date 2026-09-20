import { describe, expect, it } from 'vitest';
import type { CreatorViewpointData } from '../types/creatorViewpoint';
import type { StorageLike } from './watchlistRepository';
import { buildCreatorCurrentViews, buildViewpointReviews, buildViewpointTimeline, createEmptyCreatorViewpointData } from './creatorViewpoint';
import { BrowserCreatorViewpointRepository, CREATOR_VIEWPOINT_BACKUP_PREFIX, CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX, CREATOR_VIEWPOINT_STORAGE_KEY, migrateCreatorViewpointData } from './creatorViewpointRepository';

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

describe('Creator viewpoint explicit corrupt-store recovery', () => {
  function corruptSetup(raw = '{ broken\r\n  exact original bytes ') {
    const storage = new MemoryStorage();
    storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, raw);
    storage.values.set('unrelated.business.data', 'preserve me');
    const repo = new BrowserCreatorViewpointRepository(storage, () => new Date(at));
    const loaded = repo.load();
    const backup = repo.export(fixture());
    return { storage, repo, loaded, raw, backup };
  }

  it.each(['malformed JSON', 'valid JSON with invalid graph'])('recovers %s only after preview and confirmation, retaining exact corrupt bytes', kind => {
    const invalid = fixture(); invalid.observations[0].sourceId = 'missing-source';
    const original = kind === 'malformed JSON' ? '{ broken\r\n  exact original bytes ' : JSON.stringify(invalid, null, 2);
    const { storage, repo, loaded, raw, backup } = corruptSetup(original);
    expect(loaded.recoveryStatus).toBe('corrupt');
    const before = [...storage.values];
    const preview = repo.previewRecovery(backup, raw);
    expect(preview.data).toEqual(fixture());
    expect(preview.skipCount).toBe(0); expect(preview.addCount).toBeGreaterThan(0);
    expect([...storage.values]).toEqual(before);
    expect(() => repo.append(loaded.data, {})).toThrow();
    expect(() => repo.recoverCorrupt(backup, raw, false)).toThrow(/确认/);
    expect([...storage.values]).toEqual(before);
    const recovered = repo.recoverCorrupt(backup, raw, true);
    expect(recovered).toEqual(fixture());
    expect(repo.load().recoveryStatus).toBeNull();
    expect(storage.getItem('unrelated.business.data')).toBe('preserve me');
    const keys = [...storage.values.keys()].filter(key => key.startsWith(CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX));
    expect(keys).toHaveLength(1); expect(storage.getItem(keys[0])).toBe(original);
    expect(repo.append(recovered, {}).creators).toHaveLength(3);
  });

  it('rejects recovery without load, with invented corrupt bytes, and against an ordinary valid store', () => {
    const { storage, repo, raw, backup } = corruptSetup();
    const unseen = new BrowserCreatorViewpointRepository(storage);
    expect(() => unseen.previewRecovery(backup, raw)).toThrow(/实际读取/);
    expect(() => unseen.recoverCorrupt(backup, raw, true)).toThrow(/实际读取/);
    expect(() => repo.previewRecovery(backup, `${raw}tamper`)).toThrow(/实际读取/);
    storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, JSON.stringify(fixture()));
    const validLoad = repo.load(); expect(validLoad.recoveryStatus).toBeNull();
    expect(() => repo.recoverCorrupt(backup, JSON.stringify(fixture()), true)).toThrow(/实际读取/);
    expect([...storage.values.keys()].some(key => key.startsWith(CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX))).toBe(false);
  });

  it.each([0, 2, 99, '1', null])('does not recover unsupported stored schemaVersion %s, even if its graph is malformed', schemaVersion => {
    const unsupportedRaw = JSON.stringify({ schemaVersion, observations: 'also corrupt' });
    const { storage, repo, loaded, backup } = corruptSetup(unsupportedRaw);
    expect(loaded.recoveryStatus).toBe('unsupported_version');
    expect(() => repo.previewRecovery(backup, unsupportedRaw)).toThrow(/实际读取/);
    expect(() => repo.recoverCorrupt(backup, unsupportedRaw, true)).toThrow(/实际读取/);
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(unsupportedRaw);
    expect(storage.values.size).toBe(2);
  });

  it.each(['malformed', 'wrong-format', 'invalid-graph', 'future-schema'])('rejects %s recovery backups before any write', variant => {
    const { storage, repo, raw, backup } = corruptSetup();
    const parsed = JSON.parse(backup) as { format: string; data: CreatorViewpointData & { schemaVersion: number } };
    if (variant === 'wrong-format') parsed.format = 'not a tracker backup';
    if (variant === 'invalid-graph') parsed.data.observations[0].sourceId = 'missing';
    const invalidBackup = variant === 'malformed' ? '{broken' : variant === 'future-schema' ? JSON.stringify({ ...parsed, data: { ...parsed.data, schemaVersion: 99 } }) : JSON.stringify(parsed);
    const before = [...storage.values];
    expect(() => repo.previewRecovery(invalidBackup, raw)).toThrow();
    expect(() => repo.recoverCorrupt(invalidBackup, raw, true)).toThrow();
    expect([...storage.values]).toEqual(before);
  });

  it('rejects stale corruption after another tab changes it, including between preview and confirmation', () => {
    const { storage, repo, raw, backup } = corruptSetup();
    repo.previewRecovery(backup, raw);
    storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, '{new corruption}');
    expect(() => repo.recoverCorrupt(backup, raw, true)).toThrow(/已变化/);
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe('{new corruption}');
    // Restoring the old string does not resurrect the invalidated observation.
    storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, raw);
    expect(() => repo.previewRecovery(backup, raw)).toThrow(/实际读取/);
    expect(storage.values.size).toBe(2);
  });

  it('rechecks corruption after writing the pre-recovery backup, before touching the live key', () => {
    class ConcurrentStorage extends MemoryStorage {
      override setItem(key: string, value: string) {
        super.setItem(key, value);
        if (key.startsWith(CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX)) this.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, 'other-tab-write');
      }
    }
    const storage = new ConcurrentStorage(); const raw = '{corrupt';
    storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, raw);
    const repo = new BrowserCreatorViewpointRepository(storage); repo.load();
    expect(() => repo.recoverCorrupt(repo.export(fixture()), raw, true)).toThrow(/已变化/);
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe('other-tab-write');
  });

  it('stops on pre-backup quota errors and verifies backup readback before replacing live bytes', () => {
    const { storage, repo, raw, backup } = corruptSetup();
    storage.failKey = CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX;
    expect(() => repo.recoverCorrupt(backup, raw, true)).toThrow('quota');
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(raw);
    class SilentBackupStorage extends MemoryStorage {
      override setItem(key: string, value: string) { if (!key.startsWith(CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX)) super.setItem(key, value); }
    }
    const silent = new SilentBackupStorage(); silent.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, raw);
    const silentRepo = new BrowserCreatorViewpointRepository(silent); silentRepo.load();
    expect(() => silentRepo.recoverCorrupt(backup, raw, true)).toThrow(/备份校验失败/);
    expect(silent.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(raw);
  });

  it('retains the corrupt live bytes and their backup when replacement hits quota', () => {
    class ReplaceFailureStorage extends MemoryStorage {
      override setItem(key: string, value: string) { if (key === CREATOR_VIEWPOINT_STORAGE_KEY) throw new Error('replacement quota'); super.setItem(key, value); }
    }
    const storage = new ReplaceFailureStorage(); const raw = '{corrupt';
    storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, raw);
    const repo = new BrowserCreatorViewpointRepository(storage); const loaded = repo.load();
    expect(() => repo.recoverCorrupt(repo.export(fixture()), raw, true)).toThrow('replacement quota');
    expect(storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY)).toBe(raw);
    const backupKey = [...storage.values.keys()].find(key => key.startsWith(CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX))!;
    expect(storage.getItem(backupKey)).toBe(raw);
    expect(() => repo.append(loaded.data, {})).toThrow();
  });

  it('does not claim recovery success when live readback is corrupt or semantically different', () => {
    class CorruptingWriteStorage extends MemoryStorage {
      override setItem(key: string, value: string) { super.setItem(key, key === CREATOR_VIEWPOINT_STORAGE_KEY ? JSON.stringify(createEmptyCreatorViewpointData()) : value); }
    }
    const storage = new CorruptingWriteStorage(); const raw = '{corrupt'; storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, raw);
    const repo = new BrowserCreatorViewpointRepository(storage); repo.load();
    expect(() => repo.recoverCorrupt(repo.export(fixture()), raw, true)).toThrow(/重读校验失败/);
    expect([...storage.values.values()]).toContain(raw);
  });

  it('uses unique backup keys with a frozen clock and preserves JSON round-trip read models', () => {
    const { storage, repo, raw, backup } = corruptSetup();
    const first = repo.recoverCorrupt(backup, raw, true);
    const exportAfterRecovery = repo.export(first);
    expect(buildCreatorCurrentViews(first)).toEqual(buildCreatorCurrentViews(fixture()));
    expect(buildViewpointTimeline(first)).toEqual(buildViewpointTimeline(fixture()));
    expect(buildViewpointReviews(first)).toEqual(buildViewpointReviews(fixture()));
    const secondRaw = '{different corruption}'; storage.values.set(CREATOR_VIEWPOINT_STORAGE_KEY, secondRaw); repo.load();
    const second = repo.recoverCorrupt(exportAfterRecovery, secondRaw, true);
    expect(second).toEqual(first);
    const keys = [...storage.values.keys()].filter(key => key.startsWith(CREATOR_VIEWPOINT_RECOVERY_BACKUP_PREFIX));
    expect(keys).toHaveLength(2);
    expect(storage.getItem(keys[0])).toBe(raw); expect(storage.getItem(keys[1])).toBe(secondRaw);
  });

  it('keeps unavailable storage ineligible for recovery', () => {
    const repo = new BrowserCreatorViewpointRepository(null);
    expect(repo.load().recoveryStatus).toBe('unavailable');
    expect(() => repo.recoverCorrupt(repo.export(fixture()), '{corrupt', true)).toThrow(/实际读取/);
    class ReadFailureStorage extends MemoryStorage { override getItem(): string | null { throw new Error('read denied'); } }
    const denied = new BrowserCreatorViewpointRepository(new ReadFailureStorage());
    expect(denied.load().recoveryStatus).toBe('unavailable');
  });
});
