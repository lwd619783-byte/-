import type { WikiData, WikiOwners } from '../types/wiki';
import type { StorageLike } from './watchlistRepository';
import { PersistedBaseGuard } from './persistedBaseGuard';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { buildWikiReadModel, cloneWiki, emptyWikiData, validateWikiData, validateWikiReferences, wikiRequire } from './wiki';
import { isPreciseInstant } from '../utils/dateTime';

export const WIKI_STORAGE_KEY = 'investment-research-dashboard.wiki.v1';
export const WIKI_BACKUP_FORMAT = 'investment-research-dashboard.wiki-backup.v1';
const keys = ['entries', 'revisions', 'reviews'] as const;
type Collection = typeof keys[number];
export type WikiAdditions = Partial<Pick<WikiData, Collection>>;
export interface WikiLoad { data: WikiData; error: string | null; corruptedRaw: string | null; recoveryStatus: 'corrupt' | 'unsupported_version' | 'unavailable' | null }
export interface WikiImportPreview { data: WikiData; addCount: number; skipCount: number }
export interface WikiRepository {
  load(): WikiLoad;
  append(base: WikiData, additions: WikiAdditions): WikiData;
  export(data: WikiData): string;
  previewImport(raw: string, base: WikiData): WikiImportPreview;
  import(base: WikiData, raw: string, confirmed: boolean): WikiData;
  previewRecovery(raw: string, corruptedRaw: string): WikiImportPreview;
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): WikiData;
}
const id = (row: WikiData[Collection][number]) => 'revisionId' in row && 'reviewId' in row ? row.reviewId : 'revisionId' in row ? row.revisionId : row.wikiId;

/** Port for a future transactional local adapter. No Markdown ingestion/write-back method. */
export class BrowserWikiRepository implements WikiRepository {
  private readonly guard: PersistedBaseGuard<WikiData>;
  private readonly snapshots = new WeakMap<WikiData, string>();
  private corrupt: string | null = null;
  constructor(private readonly storage: StorageLike | null, private readonly owners: WikiOwners, private readonly now: () => Date = () => new Date()) {
    this.guard = new PersistedBaseGuard(storage, WIKI_STORAGE_KEY);
  }
  private remember(data: WikiData, raw: string | null): WikiData {
    this.snapshots.set(data, canonicalJson(data)); return this.guard.remember(data, raw);
  }
  load(): WikiLoad {
    let raw: string | null = null; let status: WikiLoad['recoveryStatus'] = 'unavailable'; this.corrupt = null;
    try {
      wikiRequire(this.storage, 'WIKI_STORAGE_UNAVAILABLE'); raw = this.storage!.getItem(WIKI_STORAGE_KEY); status = 'corrupt';
      const parsed: unknown = raw === null ? emptyWikiData() : JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed && parsed.schemaVersion !== 'wiki.v1') {
        status = 'unsupported_version'; throw new Error('WIKI_FUTURE_SCHEMA_LOCKED');
      }
      validateWikiData(parsed);
      return { data: this.remember(cloneWiki(parsed), raw), error: null, corruptedRaw: null, recoveryStatus: null };
    } catch (error) {
      if (status === 'corrupt') this.corrupt = raw;
      return { data: emptyWikiData(), error: String(error), corruptedRaw: raw, recoveryStatus: status };
    }
  }
  private authoritative(base: WikiData): { data: WikiData; raw: string | null } {
    const snapshot = this.snapshots.get(base);
    wikiRequire(snapshot !== undefined && snapshot === canonicalJson(base), 'WIKI_BASE_UNBOUND_OR_MUTATED');
    const raw = this.guard.assertCurrent(base);
    const data: unknown = JSON.parse(raw ?? snapshot!); validateWikiData(data);
    return { data, raw };
  }
  append(base: WikiData, additions: WikiAdditions): WikiData {
    canonicalJson(additions);
    wikiRequire(Object.keys(additions).every(key => (keys as readonly string[]).includes(key)), 'WIKI_APPEND_COLLECTION');
    const next = this.authoritative(base).data;
    for (const key of keys) {
      const rows = additions[key] ?? []; wikiRequire(Array.isArray(rows), 'WIKI_APPEND_ARRAY');
      (next[key] as unknown[]) = [...next[key], ...cloneWiki(rows)];
    }
    validateWikiReferences(next, this.owners);
    buildWikiReadModel(next, this.owners, this.now().toISOString());
    this.guard.write(next, base); return this.remember(next, JSON.stringify(next));
  }
  export(data: WikiData): string {
    validateWikiData(data);
    return JSON.stringify({ format: WIKI_BACKUP_FORMAT, exportedAt: this.now().toISOString(), data }, null, 2) + '\n';
  }
  private parseBackup(raw: string): WikiData {
    const value: unknown = JSON.parse(raw);
    wikiRequire(value && typeof value === 'object' && !Array.isArray(value), 'WIKI_BACKUP_FORMAT');
    const envelope = value as Record<string, unknown>;
    wikiRequire(Object.keys(envelope).sort().join(',') === 'data,exportedAt,format' && envelope.format === WIKI_BACKUP_FORMAT
      && typeof envelope.exportedAt === 'string' && isPreciseInstant(envelope.exportedAt), 'WIKI_BACKUP_FORMAT');
    validateWikiData(envelope.data); validateWikiReferences(envelope.data, this.owners); return cloneWiki(envelope.data);
  }
  previewImport(raw: string, base: WikiData): WikiImportPreview {
    validateWikiData(base); const imported = this.parseBackup(raw), next = cloneWiki(base);
    let addCount = 0, skipCount = 0;
    for (const key of keys) {
      const prior = new Map(next[key].map(row => [id(row), row]));
      for (const row of imported[key]) {
        const existing = prior.get(id(row));
        if (existing) { wikiRequire(canonicalJson(existing) === canonicalJson(row), 'WIKI_IMPORT_HISTORY_CONFLICT'); skipCount++; }
        else { (next[key] as unknown[]).push(row); addCount++; }
      }
    }
    validateWikiReferences(next, this.owners); buildWikiReadModel(next, this.owners, this.now().toISOString()); return { data: next, addCount, skipCount };
  }
  private backup(kind: 'import' | 'recovery', raw: string, assertCurrent: () => void): void {
    const prefix = `${WIKI_STORAGE_KEY}.pre-${kind}.${this.now().toISOString()}`;
    let key = prefix, counter = 0;
    while (this.storage!.getItem(key) !== null) key = `${prefix}.${++counter}`;
    assertCurrent(); this.storage!.setItem(key, raw);
    wikiRequire(this.storage!.getItem(key) === raw, 'WIKI_PREWRITE_BACKUP_FAILED'); assertCurrent();
  }
  import(base: WikiData, raw: string, confirmed: boolean): WikiData {
    wikiRequire(confirmed, 'WIKI_IMPORT_CONFIRMATION_REQUIRED');
    const current = this.authoritative(base), { data } = this.previewImport(raw, current.data);
    this.backup('import', current.raw ?? JSON.stringify(current.data), () => { this.guard.assertCurrent(base); });
    this.guard.write(data, base); return this.remember(data, JSON.stringify(data));
  }
  private assertCorrupt(raw: string): void {
    wikiRequire(this.storage && this.corrupt !== null && this.corrupt === raw && this.storage.getItem(WIKI_STORAGE_KEY) === raw, 'WIKI_RECOVERY_NOT_OBSERVED_OR_CHANGED');
  }
  previewRecovery(raw: string, corruptedRaw: string): WikiImportPreview {
    this.assertCorrupt(corruptedRaw); const data = this.parseBackup(raw); buildWikiReadModel(data, this.owners, this.now().toISOString()); this.assertCorrupt(corruptedRaw);
    return { data, addCount: keys.reduce((sum, key) => sum + data[key].length, 0), skipCount: 0 };
  }
  recoverCorrupt(raw: string, corruptedRaw: string, confirmed: boolean): WikiData {
    wikiRequire(confirmed, 'WIKI_RECOVERY_CONFIRMATION_REQUIRED');
    const { data } = this.previewRecovery(raw, corruptedRaw);
    this.backup('recovery', corruptedRaw, () => this.assertCorrupt(corruptedRaw));
    const expected = JSON.stringify(data); this.storage!.setItem(WIKI_STORAGE_KEY, expected);
    const reloaded = this.load();
    wikiRequire(reloaded.error === null && this.storage!.getItem(WIKI_STORAGE_KEY) === expected && canonicalJson(reloaded.data) === canonicalJson(data), 'WIKI_RECOVERY_READBACK_FAILED');
    return reloaded.data;
  }
}
