import { describe, expect, it } from 'vitest';
import { BrowserWikiRepository, WIKI_STORAGE_KEY } from './wikiRepository';
import { wikiFixture, wikiFixtureOwners, wikiRevision, wikiReview, wikiTime as at } from './wiki.fixture';
import { buildWikiReadModel } from './wiki';
import type { StorageLike } from './watchlistRepository';
export class WikiTestStorage implements StorageLike {
  values = new Map<string, string>(); failPrefix: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failPrefix && key.startsWith(this.failPrefix)) throw new Error('quota'); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const setup = () => { const storage = new WikiTestStorage(), owners = wikiFixtureOwners(); const repo = new BrowserWikiRepository(storage, owners, () => new Date(at(10))); return { storage, owners, repo }; };
describe('Wiki local-first append/backup/recovery', () => {
  it('empty read has no writes or synthetic seeds; append survives repository restart', () => {
    const { storage, repo, owners } = setup(), base = repo.load().data;
    expect(storage.values.size).toBe(0); expect(base.entries).toEqual([]);
    const fixture = wikiFixture(), saved = repo.append(base, { entries: fixture.entries, revisions: fixture.revisions, reviews: fixture.reviews });
    const restarted = new BrowserWikiRepository(storage, owners).load(); expect(restarted.error).toBeNull(); expect(restarted.data).toEqual(saved);
    fixture.revisions[0].title = 'caller mutation'; expect(repo.load().data.revisions[0].title).not.toBe('caller mutation');
  });
  it('rejects mutation, duplicate history, stale baselines and forged detached baselines', () => {
    const { repo } = setup(), first = repo.load().data, second = repo.load().data;
    const f = wikiFixture(), saved = repo.append(first, { entries: f.entries, revisions: f.revisions, reviews: f.reviews });
    expect(() => repo.append(second, {})).toThrow(); expect(() => repo.append(JSON.parse(JSON.stringify(saved)), {})).toThrow();
    expect(() => repo.append(saved, { revisions: f.revisions })).toThrow();
    saved.revisions[0].title = 'changed'; expect(() => repo.append(saved, {})).toThrow(/MUTATED/);
  });
  it('full JSON backup/import preserves history and models, skips identical IDs, rejects conflicts', () => {
    const { repo, storage, owners } = setup(), f = wikiFixture();
    const base = repo.load().data, raw = repo.export(f), before = [...storage.values];
    const preview = repo.previewImport(raw, base); expect(preview.addCount).toBe(3); expect([...storage.values]).toEqual(before);
    expect(() => repo.import(base, raw, false)).toThrow(/CONFIRMATION/);
    const saved = repo.import(base, raw, true); expect(repo.previewImport(raw, saved).skipCount).toBe(3);
    expect(buildWikiReadModel(saved, owners, at(10))).toEqual(buildWikiReadModel(f, owners, at(10)));
    expect([...storage.values.keys()].some(key => key.includes('.pre-import.'))).toBe(true);
    f.revisions[0].title = 'conflicting owner history'; expect(() => repo.previewImport(repo.export(f), saved)).toThrow(/CONFLICT/);
  });
  it('appends revisions and reviews separately without replacing Current for draft/reject', () => {
    const { repo, owners } = setup(), f = wikiFixture(); let saved = repo.import(repo.load().data, repo.export(f), true);
    const next = { ...wikiRevision('wiki-one', 'revision-two', 6), supersedes: 'revision-one' };
    saved = repo.append(saved, { revisions: [next] }); expect(buildWikiReadModel(saved, owners, at(10)).pages[0].revision.revisionId).toBe('revision-one');
    saved = repo.append(saved, { reviews: [wikiReview(next, 7, 'rejected')] }); expect(buildWikiReadModel(saved, owners, at(10)).pages[0].revision.revisionId).toBe('revision-one');
    expect(() => repo.append(saved, { reviews: [wikiReview(next, 9)] })).toThrow(/ALREADY_DECIDED/);
  });
  it.each(['corrupt', 'future'])('%s storage stays locked and keeps exact raw bytes', kind => {
    const { repo, storage } = setup(), raw = kind === 'corrupt' ? '{corrupt' : '{"schemaVersion":"wiki.v9"}'; storage.setItem(WIKI_STORAGE_KEY, raw);
    const loaded = repo.load(); expect(loaded.error).toBeTruthy(); expect(loaded.corruptedRaw).toBe(raw);
    expect(() => repo.append(loaded.data, {})).toThrow(); expect(() => repo.import(loaded.data, repo.export(wikiFixture()), true)).toThrow();
    if (kind === 'future') expect(() => repo.recoverCorrupt(repo.export(wikiFixture()), raw, true)).toThrow(/NOT_OBSERVED/);
    expect(storage.getItem(WIKI_STORAGE_KEY)).toBe(raw);
  });
  it('recovery requires observed exact corrupt bytes, preview, explicit confirmation and retained raw backup', () => {
    const { repo, storage } = setup(), raw = '{exact corrupt bytes'; storage.setItem(WIKI_STORAGE_KEY, raw); const backup = repo.export(wikiFixture());
    expect(() => repo.previewRecovery(backup, raw)).toThrow(); repo.load();
    expect(repo.previewRecovery(backup, raw).addCount).toBe(3); expect(storage.values.size).toBe(1);
    expect(() => repo.recoverCorrupt(backup, raw, false)).toThrow(/CONFIRMATION/);
    const saved = repo.recoverCorrupt(backup, raw, true); expect(saved).toEqual(wikiFixture());
    expect([...storage.values].some(([key, value]) => key.includes('.pre-recovery.') && value === raw)).toBe(true);
    expect(() => repo.recoverCorrupt(backup, raw, true)).toThrow();
  });
  it('backup quota failure and changed corrupt baseline prevent any replacement', () => {
    const { repo, storage } = setup(), raw = '{bad'; storage.setItem(WIKI_STORAGE_KEY, raw); repo.load(); const backup = repo.export(wikiFixture());
    storage.failPrefix = WIKI_STORAGE_KEY + '.pre-recovery.'; expect(() => repo.recoverCorrupt(backup, raw, true)).toThrow(/quota/); expect(storage.getItem(WIKI_STORAGE_KEY)).toBe(raw);
    storage.failPrefix = null; storage.setItem(WIKI_STORAGE_KEY, '{different'); expect(() => repo.recoverCorrupt(backup, raw, true)).toThrow(/CHANGED/);
  });
  it('unsupported/extra schema fields and foreign refs fail import without writes', () => {
    const { repo, storage } = setup(), base = repo.load().data, raw = JSON.parse(repo.export(wikiFixture()));
    raw.data.schemaVersion = 'wiki.v9'; expect(() => repo.import(base, JSON.stringify(raw), true)).toThrow();
    raw.data.schemaVersion = 'wiki.v1'; raw.data.revisions[0].sourceRefs[0].sourceDomain = 'foreign'; expect(() => repo.import(base, JSON.stringify(raw), true)).toThrow();
    raw.extra = true; expect(() => repo.previewImport(JSON.stringify(raw), base)).toThrow(); expect(storage.values.size).toBe(0);
  });
  it('unavailable storage cannot initialize or recover', () => { const repo = new BrowserWikiRepository(null, wikiFixtureOwners()); const loaded = repo.load(); expect(loaded.recoveryStatus).toBe('unavailable'); expect(() => repo.append(loaded.data, {})).toThrow(); });
});
