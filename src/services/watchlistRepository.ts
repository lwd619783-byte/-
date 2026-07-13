import type {
  ReviewEntry,
  ReviewTaskState,
  WatchItem,
  WatchlistExportFile,
  WatchlistStoreEnvelope,
} from "../types";

export const WATCHLIST_STORAGE_KEY = "investment-research-dashboard.watchlist.v2";
export const WATCHLIST_BACKUP_PREFIX = "investment-research-dashboard.watchlist.backup.";
export const WATCHLIST_SCHEMA_VERSION = 2 as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RepositoryLoadResult {
  data: WatchlistStoreEnvelope;
  error: string | null;
  corruptedRaw: string | null;
}

export interface RepositoryWriteResult {
  ok: boolean;
  error: string | null;
}

export interface ImportPreview {
  schemaVersion: number | null;
  watchItemCount: number;
  reviewEntryCount: number;
  taskStateCount: number;
  conflictCount: number;
  invalidRecordCount: number;
  addCount: number;
  skipCount: number;
  replaceCount: number;
}

export interface ImportValidationResult {
  ok: boolean;
  errors: string[];
  preview: ImportPreview;
  data: WatchlistStoreEnvelope | null;
}

export interface ImportWriteResult extends RepositoryWriteResult {
  data: WatchlistStoreEnvelope | null;
  preview: ImportPreview;
  backupKey?: string;
}

const DEFAULT_SETTINGS = { longUnreviewedDays: 90 };

export function createEmptyWatchlistEnvelope(now = new Date()): WatchlistStoreEnvelope {
  return {
    schemaVersion: WATCHLIST_SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    watchItems: [],
    reviewEntries: [],
    reviewTaskStates: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Current-version normalization is deliberately idempotent. No historical key or schema existed before V2. */
export function migrateWatchlistEnvelope(value: unknown): WatchlistStoreEnvelope {
  if (!isRecord(value) || value.schemaVersion !== WATCHLIST_SCHEMA_VERSION) {
    const version = isRecord(value) ? String(value.schemaVersion ?? "缺失") : "缺失";
    throw new Error(`不支持的 schemaVersion：${version}`);
  }
  const cloned = cloneJson(value) as unknown as WatchlistStoreEnvelope;
  if (!isRecord(cloned.settings)) cloned.settings = { ...DEFAULT_SETTINGS };
  if (typeof cloned.settings.longUnreviewedDays !== "number") cloned.settings.longUnreviewedDays = DEFAULT_SETTINGS.longUnreviewedDays;
  return cloned;
}

export class WatchlistRepository {
  constructor(
    private readonly storage: StorageLike | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  load(): RepositoryLoadResult {
    const empty = createEmptyWatchlistEnvelope(this.now());
    if (!this.storage) return { data: empty, error: "当前环境不支持本地存储，修改不会被保存。", corruptedRaw: null };
    let raw: string | null;
    try {
      raw = this.storage.getItem(WATCHLIST_STORAGE_KEY);
    } catch (error) {
      return { data: empty, error: `读取本地观察清单失败：${errorMessage(error)}`, corruptedRaw: null };
    }
    if (raw === null) return { data: empty, error: null, corruptedRaw: null };
    try {
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrateWatchlistEnvelope(parsed);
      const validation = validateEnvelope(migrated);
      if (validation.length) throw new Error(validation.join("；"));
      return { data: migrated, error: null, corruptedRaw: null };
    } catch (error) {
      return {
        data: empty,
        error: `本地观察清单已损坏，已安全回退为空状态；原始数据未被覆盖：${errorMessage(error)}`,
        corruptedRaw: raw,
      };
    }
  }

  save(data: WatchlistStoreEnvelope): RepositoryWriteResult {
    if (!this.storage) return { ok: false, error: "当前环境不支持本地存储，无法保存。" };
    const errors = validateEnvelope(data);
    if (errors.length) return { ok: false, error: `观察清单校验失败：${errors.join("；")}` };
    try {
      this.storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(data));
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: `保存本地观察清单失败，可能是存储空间不足或浏览器禁用了存储：${errorMessage(error)}` };
    }
  }

  reset(): RepositoryWriteResult {
    if (!this.storage) return { ok: false, error: "当前环境不支持本地存储，无法重置。" };
    try {
      this.storage.removeItem(WATCHLIST_STORAGE_KEY);
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: `重置本地观察清单失败：${errorMessage(error)}` };
    }
  }

  export(data: WatchlistStoreEnvelope): string {
    const exported: WatchlistExportFile = {
      ...cloneJson(data),
      format: "investment-research-dashboard.watchlist",
      exportedAt: this.now().toISOString(),
    };
    return JSON.stringify(exported, null, 2);
  }

  validateImport(raw: string | unknown, current = this.load().data): ImportValidationResult {
    const emptyPreview: ImportPreview = {
      schemaVersion: null,
      watchItemCount: 0,
      reviewEntryCount: 0,
      taskStateCount: 0,
      conflictCount: 0,
      invalidRecordCount: 0,
      addCount: 0,
      skipCount: 0,
      replaceCount: 0,
    };
    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : cloneJson(raw);
    } catch (error) {
      return { ok: false, errors: [`JSON 无法解析：${errorMessage(error)}`], preview: { ...emptyPreview, invalidRecordCount: 1 }, data: null };
    }
    if (!isRecord(parsed)) return { ok: false, errors: ["导入文件必须是 JSON 对象。"], preview: { ...emptyPreview, invalidRecordCount: 1 }, data: null };
    const preview = { ...emptyPreview, schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : null };
    if (parsed.format !== undefined && parsed.format !== "investment-research-dashboard.watchlist") {
      return { ok: false, errors: ["导入文件格式名称不受支持。"], preview: { ...preview, invalidRecordCount: 1 }, data: null };
    }
    let data: WatchlistStoreEnvelope;
    try {
      data = migrateWatchlistEnvelope(parsed);
    } catch (error) {
      return { ok: false, errors: [errorMessage(error)], preview: { ...preview, invalidRecordCount: 1 }, data: null };
    }
    preview.watchItemCount = Array.isArray(data.watchItems) ? data.watchItems.length : 0;
    preview.reviewEntryCount = Array.isArray(data.reviewEntries) ? data.reviewEntries.length : 0;
    preview.taskStateCount = Array.isArray(data.reviewTaskStates) ? data.reviewTaskStates.length : 0;
    const errors = validateEnvelope(data);
    preview.invalidRecordCount = errors.length;
    if (errors.length) return { ok: false, errors, preview, data: null };

    const currentWatchIds = new Set(current.watchItems.map((item) => item.id));
    const currentActiveStocks = new Set(current.watchItems.filter((item) => !item.archivedAt).map((item) => item.stockId));
    const currentReviewIds = new Set(current.reviewEntries.map((item) => item.id));
    const currentTaskIds = new Set(current.reviewTaskStates.map((item) => item.taskId));
    const watchConflicts = data.watchItems.filter((item) => currentWatchIds.has(item.id) || (!item.archivedAt && currentActiveStocks.has(item.stockId))).length;
    const reviewConflicts = data.reviewEntries.filter((item) => currentReviewIds.has(item.id)).length;
    const taskConflicts = data.reviewTaskStates.filter((item) => currentTaskIds.has(item.taskId)).length;
    preview.conflictCount = watchConflicts + reviewConflicts + taskConflicts;
    preview.skipCount = preview.conflictCount;
    preview.addCount = preview.watchItemCount + preview.reviewEntryCount + preview.taskStateCount - preview.skipCount;
    preview.replaceCount = current.watchItems.length + current.reviewEntries.length + current.reviewTaskStates.length;
    return { ok: true, errors: [], preview, data };
  }

  mergeImport(raw: string | unknown, current = this.load().data): ImportWriteResult {
    const validation = this.validateImport(raw, current);
    if (!validation.ok || !validation.data) {
      return { ok: false, error: validation.errors.join("；"), data: null, preview: validation.preview };
    }
    const imported = validation.data;
    const watchIds = new Set(current.watchItems.map((item) => item.id));
    const activeStocks = new Set(current.watchItems.filter((item) => !item.archivedAt).map((item) => item.stockId));
    const addedWatchItems = imported.watchItems.filter((item) => !watchIds.has(item.id) && (item.archivedAt !== null || !activeStocks.has(item.stockId)));
    const reviewIds = new Set(current.reviewEntries.map((item) => item.id));
    const taskIds = new Set(current.reviewTaskStates.map((item) => item.taskId));
    const next: WatchlistStoreEnvelope = {
      ...cloneJson(current),
      updatedAt: this.now().toISOString(),
      watchItems: [...current.watchItems, ...addedWatchItems],
      reviewEntries: [...current.reviewEntries, ...imported.reviewEntries.filter((item) => !reviewIds.has(item.id))],
      reviewTaskStates: [...current.reviewTaskStates, ...imported.reviewTaskStates.filter((item) => !taskIds.has(item.taskId))],
    };
    const saved = this.save(next);
    return { ...saved, data: saved.ok ? next : null, preview: validation.preview };
  }

  replaceImport(raw: string | unknown, current = this.load().data): ImportWriteResult {
    const validation = this.validateImport(raw, current);
    if (!validation.ok || !validation.data) {
      return { ok: false, error: validation.errors.join("；"), data: null, preview: validation.preview };
    }
    if (!this.storage) return { ok: false, error: "当前环境不支持本地存储，无法替换。", data: null, preview: validation.preview };
    const backupKey = `${WATCHLIST_BACKUP_PREFIX}${this.now().toISOString().replace(/[:.]/g, "-")}`;
    try {
      this.storage.setItem(backupKey, JSON.stringify(current));
    } catch (error) {
      return { ok: false, error: `替换前备份失败，已取消替换：${errorMessage(error)}`, data: null, preview: validation.preview };
    }
    const next = { ...cloneJson(validation.data), updatedAt: this.now().toISOString() };
    const saved = this.save(next);
    return { ...saved, data: saved.ok ? next : null, preview: validation.preview, backupKey };
  }
}

export function createBrowserWatchlistRepository() {
  let storage: StorageLike | null = null;
  try {
    storage = typeof window === "undefined" ? null : window.localStorage;
  } catch {
    storage = null;
  }
  return new WatchlistRepository(storage);
}

export function validateEnvelope(data: WatchlistStoreEnvelope): string[] {
  const errors: string[] = [];
  if (!isRecord(data) || data.schemaVersion !== WATCHLIST_SCHEMA_VERSION) return ["schemaVersion 必须为 2。"];
  if (typeof data.updatedAt !== "string") errors.push("updatedAt 必须为字符串。");
  if (!Array.isArray(data.watchItems)) errors.push("watchItems 必须为数组。");
  if (!Array.isArray(data.reviewEntries)) errors.push("reviewEntries 必须为数组。");
  if (!Array.isArray(data.reviewTaskStates)) errors.push("reviewTaskStates 必须为数组。");
  if (!isRecord(data.settings) || typeof data.settings.longUnreviewedDays !== "number") errors.push("settings.longUnreviewedDays 必须为数字。");
  if (errors.length) return errors;

  const watchIds = new Set<string>();
  const activeStocks = new Set<string>();
  data.watchItems.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`watchItems[${index}]：必须为对象。`);
      return;
    }
    const issue = validateWatchItem(item);
    if (issue) errors.push(`watchItems[${index}]：${issue}`);
    if (item.source !== "user") errors.push(`watchItems[${index}]：持久化用户数据的 source 必须为 user，示例模板不能直接导入。`);
    if (watchIds.has(item.id)) errors.push(`watchItems 存在重复 ID：${item.id}`);
    watchIds.add(item.id);
    if (!item.archivedAt) {
      if (activeStocks.has(item.stockId)) errors.push(`同一公司存在重复活跃观察项：${item.stockId}`);
      activeStocks.add(item.stockId);
    }
  });
  const reviewIds = new Set<string>();
  data.reviewEntries.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`reviewEntries[${index}]：必须为对象。`);
      return;
    }
    const issue = validateReviewEntry(item);
    if (issue) errors.push(`reviewEntries[${index}]：${issue}`);
    if (reviewIds.has(item.id)) errors.push(`reviewEntries 存在重复 ID：${item.id}`);
    reviewIds.add(item.id);
  });
  const taskIds = new Set<string>();
  data.reviewTaskStates.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`reviewTaskStates[${index}]：必须为对象。`);
      return;
    }
    const issue = validateTaskState(item);
    if (issue) errors.push(`reviewTaskStates[${index}]：${issue}`);
    if (taskIds.has(item.taskId)) errors.push(`reviewTaskStates 存在重复 taskId：${item.taskId}`);
    taskIds.add(item.taskId);
  });
  return errors;
}

function validateWatchItem(item: WatchItem): string | null {
  if (!isRecord(item)) return "必须为对象。";
  const strings = ["id", "stockId", "createdAt", "updatedAt", "status", "priority", "reason", "thesis", "source"];
  if (strings.some((key) => typeof item[key as keyof WatchItem] !== "string")) return "必填文本字段类型错误。";
  if (!Array.isArray(item.tags) || !item.tags.every((value) => typeof value === "string")) return "tags 必须为字符串数组。";
  if (!Array.isArray(item.validationCriteria) || !item.validationCriteria.every((value) => typeof value === "string")) return "validationCriteria 必须为字符串数组。";
  if (!Array.isArray(item.riskCriteria) || !item.riskCriteria.every((value) => typeof value === "string")) return "riskCriteria 必须为字符串数组。";
  if (![item.nextReviewAt, item.lastReviewedAt, item.archivedAt].every((value) => value === null || typeof value === "string")) return "日期字段必须为字符串或 null。";
  if (item.schemaVersion !== WATCHLIST_SCHEMA_VERSION) return "schemaVersion 必须为 2。";
  if (!['user', 'sample'].includes(item.source)) return "source 必须为 user 或 sample。";
  return null;
}

function validateReviewEntry(item: ReviewEntry): string | null {
  if (!isRecord(item)) return "必须为对象。";
  if ([item.id, item.watchItemId, item.createdAt, item.triggerType, item.summary, item.rationale, item.decision].some((value) => typeof value !== "string")) return "必填文本字段类型错误。";
  if (!Array.isArray(item.triggerEventIds) || !item.triggerEventIds.every((value) => typeof value === "string")) return "triggerEventIds 必须为字符串数组。";
  if (!Array.isArray(item.evidenceRefs)) return "evidenceRefs 必须为数组。";
  if (!isSnapshot(item.beforeSnapshot) || !isSnapshot(item.afterSnapshot)) return "beforeSnapshot/afterSnapshot 结构错误。";
  if (item.nextReviewAt !== null && typeof item.nextReviewAt !== "string") return "nextReviewAt 必须为字符串或 null。";
  if (item.correctsReviewEntryId !== null && typeof item.correctsReviewEntryId !== "string") return "correctsReviewEntryId 必须为字符串或 null。";
  return null;
}

function validateTaskState(item: ReviewTaskState): string | null {
  if (!isRecord(item) || typeof item.taskId !== "string" || typeof item.status !== "string" || typeof item.updatedAt !== "string") return "任务状态字段类型错误。";
  if (!["acknowledged", "dismissed", "snoozed"].includes(item.status)) return "任务状态值不受支持。";
  if (![item.acknowledgedAt, item.dismissedAt, item.snoozedUntil].every((value) => value === null || typeof value === "string")) return "任务状态日期必须为字符串或 null。";
  return null;
}

function isSnapshot(value: unknown): boolean {
  return isRecord(value)
    && typeof value.status === "string"
    && typeof value.thesis === "string"
    && Array.isArray(value.validationCriteria)
    && value.validationCriteria.every((item) => typeof item === "string")
    && Array.isArray(value.riskCriteria)
    && value.riskCriteria.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
