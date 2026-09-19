import type { CreatorViewpointData } from '../types/creatorViewpoint';
import { createEmptyCreatorViewpointData, validateCreatorViewpointData } from './creatorViewpoint';
import { PersistedBaseGuard } from './persistedBaseGuard';
import type { StorageLike } from './watchlistRepository';

export const CREATOR_VIEWPOINT_STORAGE_KEY = 'investment-research-dashboard.creator-viewpoint.v1';
export const CREATOR_VIEWPOINT_BACKUP_PREFIX = `${CREATOR_VIEWPOINT_STORAGE_KEY}.pre-import.`;
export const CREATOR_VIEWPOINT_EXPORT_FORMAT = 'investment-research-dashboard.creator-viewpoint';
const collections = ['creators', 'topics', 'sources', 'events', 'observations', 'approvals', 'reviews'] as const;
export type CreatorViewpointAdditions = Partial<Pick<CreatorViewpointData, typeof collections[number]>>;
export interface CreatorViewpointLoadResult { data: CreatorViewpointData; error: string | null; corruptedRaw: string | null }
export interface CreatorViewpointImportPreview { data: CreatorViewpointData; addCount: number; skipCount: number }
export interface CreatorViewpointRepository {
  load(): CreatorViewpointLoadResult;
  append(base: CreatorViewpointData, additions: CreatorViewpointAdditions): CreatorViewpointData;
  export(data: CreatorViewpointData): string;
  previewImport(raw: string, base: CreatorViewpointData): CreatorViewpointImportPreview;
  import(base: CreatorViewpointData, raw: string, confirmed: boolean): CreatorViewpointData;
}

/** Explicit migration seam. V1 has no earlier schema; unsupported versions never reset data. */
export function migrateCreatorViewpointData(value: unknown): CreatorViewpointData {
  validateCreatorViewpointData(value);
  return JSON.parse(JSON.stringify(value)) as CreatorViewpointData;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class BrowserCreatorViewpointRepository implements CreatorViewpointRepository {
  private readonly guard: PersistedBaseGuard<CreatorViewpointData>;
  private readonly snapshots = new WeakMap<CreatorViewpointData, string>();
  constructor(private readonly storage: StorageLike | null, private readonly now: () => Date = () => new Date()) {
    this.guard = new PersistedBaseGuard(storage, CREATOR_VIEWPOINT_STORAGE_KEY);
  }

  private remember(data: CreatorViewpointData, raw: string | null): CreatorViewpointData {
    this.snapshots.set(data, JSON.stringify(data));
    return this.guard.remember(data, raw);
  }

  load(): CreatorViewpointLoadResult {
    const empty = createEmptyCreatorViewpointData();
    let raw: string | null = null;
    try {
      if (!this.storage) throw new Error('当前环境不支持本地存储。');
      raw = this.storage.getItem(CREATOR_VIEWPOINT_STORAGE_KEY);
      const data = raw === null ? empty : migrateCreatorViewpointData(JSON.parse(raw) as unknown);
      return { data: this.remember(data, raw), error: null, corruptedRaw: null };
    } catch (error) {
      return { data: empty, error: `观点历史读取失败，写入已锁定；原始数据未被覆盖：${error instanceof Error ? error.message : String(error)}`, corruptedRaw: raw };
    }
  }

  private authoritative(base: CreatorViewpointData): { data: CreatorViewpointData; raw: string | null } {
    const snapshot = this.snapshots.get(base);
    if (snapshot === undefined) throw new Error('缺少读取时的观点历史基线，请重新载入。');
    const raw = this.guard.assertCurrent(base);
    if (canonical(base) !== canonical(JSON.parse(snapshot))) throw new Error('观点历史不能原地修改或覆盖，请追加新记录。');
    return { data: migrateCreatorViewpointData(JSON.parse(raw ?? snapshot) as unknown), raw };
  }

  append(base: CreatorViewpointData, additions: CreatorViewpointAdditions): CreatorViewpointData {
    const next = this.authoritative(base).data;
    if (Object.keys(additions).some(key => !(collections as readonly string[]).includes(key))) throw new Error('只能追加已定义的历史记录。');
    for (const key of collections) {
      const rows = additions[key] ?? [];
      if (!Array.isArray(rows)) throw new Error(`${key} 必须为数组。`);
      const ids = new Set(next[key].map(row => row.id));
      for (const row of rows) {
        if (!row || ids.has(row.id)) throw new Error(`${key} 存在重复 ID，不能覆盖历史。`);
        ids.add(row.id);
      }
      // JSON cloning severs caller-owned references before persisting history.
      (next[key] as unknown[]) = [...next[key], ...JSON.parse(JSON.stringify(rows)) as unknown[]];
    }
    validateCreatorViewpointData(next);
    this.guard.write(next, base);
    return this.remember(next, JSON.stringify(next));
  }

  export(data: CreatorViewpointData): string {
    validateCreatorViewpointData(data);
    return JSON.stringify({ format: CREATOR_VIEWPOINT_EXPORT_FORMAT, exportedAt: this.now().toISOString(), data }, null, 2);
  }

  previewImport(raw: string, base: CreatorViewpointData): CreatorViewpointImportPreview {
    validateCreatorViewpointData(base);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !('format' in parsed) || parsed.format !== CREATOR_VIEWPOINT_EXPORT_FORMAT || !('data' in parsed)) throw new Error('不支持的观点历史备份格式。');
    const imported = migrateCreatorViewpointData(parsed.data);
    const next = migrateCreatorViewpointData(base);
    let addCount = 0;
    let skipCount = 0;
    for (const key of collections) {
      const existing = new Map(next[key].map(row => [row.id, row]));
      for (const row of imported[key]) {
        const prior = existing.get(row.id);
        if (prior) {
          if (canonical(prior) !== canonical(row)) throw new Error(`${key} / ${row.id} 与已有历史冲突，导入已拒绝。`);
          skipCount++;
        } else {
          (next[key] as unknown[]).push(row);
          addCount++;
        }
      }
    }
    validateCreatorViewpointData(next);
    return { data: next, addCount, skipCount };
  }

  import(base: CreatorViewpointData, raw: string, confirmed: boolean): CreatorViewpointData {
    if (!confirmed) throw new Error('导入需要用户确认；历史将合并追加。');
    const authoritative = this.authoritative(base);
    const { data } = this.previewImport(raw, authoritative.data);
    // Never overwrite a prior pre-import backup, even with a frozen clock.
    const prefix = `${CREATOR_VIEWPOINT_BACKUP_PREFIX}${this.now().toISOString()}`;
    let backupKey = prefix;
    let suffix = 1;
    while (this.storage!.getItem(backupKey) !== null) backupKey = `${prefix}.${suffix++}`;
    this.guard.assertCurrent(base);
    this.storage!.setItem(backupKey, authoritative.raw ?? JSON.stringify(authoritative.data));
    this.guard.write(data, base);
    return this.remember(data, JSON.stringify(data));
  }
}

export function createBrowserCreatorViewpointRepository(): BrowserCreatorViewpointRepository {
  let storage: StorageLike | null = null;
  try { storage = typeof window === 'undefined' ? null : window.localStorage; } catch { /* load reports unavailable storage */ }
  return new BrowserCreatorViewpointRepository(storage);
}
