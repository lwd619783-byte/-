import { describe, expect, it } from "vitest";
import type { StorageLike } from "./watchlistRepository";
import {
  WATCHLIST_BACKUP_PREFIX,
  WATCHLIST_STORAGE_KEY,
  WatchlistRepository,
  createEmptyWatchlistEnvelope,
  migrateWatchlistEnvelope,
} from "./watchlistRepository";
import type { WatchItem, WatchlistStoreEnvelope } from "../types";

const NOW = new Date("2026-07-13T08:00:00.000Z");

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  failWrite = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error("quota exceeded"); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("WatchlistRepository", () => {
  it("initializes an empty versioned envelope without samples", () => {
    const result = repository(new MemoryStorage()).load();
    expect(result.error).toBeNull();
    expect(result.data.schemaVersion).toBe(2);
    expect(result.data.watchItems).toEqual([]);
  });

  it("saves and reads valid data", () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    const data = envelope([watch("watch-1", "sugon")]);
    expect(repo.save(data).ok).toBe(true);
    expect(repo.load().data.watchItems[0].stockId).toBe("sugon");
  });

  it("recovers safely from corrupted JSON without overwriting it", () => {
    const storage = new MemoryStorage();
    storage.values.set(WATCHLIST_STORAGE_KEY, "{broken");
    const result = repository(storage).load();
    expect(result.data.watchItems).toEqual([]);
    expect(result.error).toContain("安全回退为空状态");
    expect(result.corruptedRaw).toBe("{broken");
    expect(storage.getItem(WATCHLIST_STORAGE_KEY)).toBe("{broken");
  });

  it("rejects unsupported schema versions", () => {
    const result = repository(new MemoryStorage()).validateImport(JSON.stringify({ ...envelope(), schemaVersion: 99 }));
    expect(result.ok).toBe(false);
    expect(result.errors.join("")).toContain("不支持的 schemaVersion");
  });

  it("keeps current-version migration idempotent and preserves unknown legal fields", () => {
    const source = { ...envelope(), customLegal: { owner: "local-user" } };
    const once = migrateWatchlistEnvelope(source) as WatchlistStoreEnvelope & { customLegal: { owner: string } };
    const twice = migrateWatchlistEnvelope(once) as WatchlistStoreEnvelope & { customLegal: { owner: string } };
    expect(twice).toEqual(once);
    expect(twice.customLegal.owner).toBe("local-user");
  });

  it("returns an explicit error when storage writes fail", () => {
    const storage = new MemoryStorage();
    storage.failWrite = true;
    const result = repository(storage).save(envelope());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("存储空间不足或浏览器禁用了存储");
  });

  it("exports only the versioned workflow payload and imports it again", () => {
    const repo = repository(new MemoryStorage());
    const source = envelope([watch("watch-1", "sugon")]);
    const exported = repo.export(source);
    const parsed = JSON.parse(exported) as Record<string, unknown>;
    expect(parsed.format).toBe("investment-research-dashboard.watchlist");
    expect(parsed).not.toHaveProperty("quotes");
    expect(repo.validateImport(exported, envelope()).ok).toBe(true);
  });

  it("reports merge conflicts and safely skips duplicate IDs or active stocks", () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    const current = envelope([watch("watch-1", "sugon")]);
    const imported = envelope([watch("watch-1", "other"), watch("watch-2", "sugon"), watch("watch-3", "new-stock")]);
    const preview = repo.validateImport(imported, current).preview;
    expect(preview.conflictCount).toBe(2);
    const result = repo.mergeImport(imported, current);
    expect(result.ok).toBe(true);
    expect(result.data?.watchItems.map((item) => item.id)).toEqual(["watch-1", "watch-3"]);
  });

  it("creates a backup before replace import", () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    const current = envelope([watch("old", "sugon")]);
    const result = repo.replaceImport(envelope([watch("new", "new-stock")]), current);
    expect(result.ok).toBe(true);
    expect(result.backupKey?.startsWith(WATCHLIST_BACKUP_PREFIX)).toBe(true);
    expect(storage.getItem(result.backupKey as string)).toContain("old");
  });

  it("rejects invalid JSON", () => {
    const result = repository(new MemoryStorage()).validateImport("not-json");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("JSON 无法解析");
  });

  it("rejects invalid field types", () => {
    const invalid = envelope([watch("watch-1", "sugon")]) as unknown as { watchItems: Array<Record<string, unknown>> };
    invalid.watchItems[0].tags = "not-an-array";
    const result = repository(new MemoryStorage()).validateImport(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join("")).toContain("tags 必须为字符串数组");
  });

  it("reports primitive array records without throwing", () => {
    const invalid = { ...envelope(), watchItems: [null], reviewEntries: ["bad"], reviewTaskStates: [42] };
    const result = repository(new MemoryStorage()).validateImport(invalid);
    expect(result.ok).toBe(false);
    expect(result.errors.join("；")).toContain("watchItems[0]：必须为对象");
    expect(result.errors.join("；")).toContain("reviewEntries[0]：必须为对象");
    expect(result.errors.join("；")).toContain("reviewTaskStates[0]：必须为对象");
  });

  it("rejects duplicate IDs in one import file", () => {
    const result = repository(new MemoryStorage()).validateImport(envelope([watch("same", "one"), watch("same", "two")]));
    expect(result.ok).toBe(false);
    expect(result.errors.join("")).toContain("重复 ID");
  });

  it("does not treat sample templates as initialized user state", () => {
    const result = repository(new MemoryStorage()).load();
    expect(result.data.watchItems.some((item) => item.source === "sample")).toBe(false);
  });

  it("rejects sample templates in imported user envelopes", () => {
    const sample = { ...watch("sample", "sugon"), source: "sample" as const };
    const result = repository(new MemoryStorage()).validateImport(envelope([sample]));
    expect(result.ok).toBe(false);
    expect(result.errors.join("")).toContain("示例模板不能直接导入");
  });
});

function repository(storage: MemoryStorage) { return new WatchlistRepository(storage, () => NOW); }
function envelope(watchItems: WatchItem[] = []): WatchlistStoreEnvelope { return { ...createEmptyWatchlistEnvelope(NOW), watchItems }; }
function watch(id: string, stockId: string): WatchItem {
  return { id, stockId, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), status: "观察", priority: "medium", tags: [], reason: "关注", thesis: "假设", validationCriteria: ["验证"], riskCriteria: ["风险"], nextReviewAt: null, lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 };
}
