import type {
  EarningsExpectationExportFile,
  EarningsExpectationImportIssue,
  EarningsExpectationImportRecord,
  EarningsExpectationSnapshot,
  EarningsExpectationStoreEnvelope,
  EarningsExpectationUnit,
  Market,
} from "../types";

export const EARNINGS_EXPECTATION_STORAGE_KEY = "investment-research-dashboard.earnings-expectation.v1";
export const EARNINGS_EXPECTATION_BACKUP_PREFIX = "investment-research-dashboard.earnings-expectation.backup.";
export const EARNINGS_EXPECTATION_SCHEMA_VERSION = 1 as const;
export const EARNINGS_EXPECTATION_MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const EARNINGS_EXPECTATION_MAX_IMPORT_RECORDS = 5_000;

export interface EarningsExpectationStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface EarningsExpectationLoadResult {
  data: EarningsExpectationStoreEnvelope;
  error: string | null;
  corruptedRaw: string | null;
}

export interface EarningsExpectationWriteResult {
  ok: boolean;
  error: string | null;
}

export interface EarningsExpectationImportPreview {
  ok: boolean;
  partial: boolean;
  schemaVersion: number | null;
  totalCount: number;
  validCount: number;
  addCount: number;
  skippedCount: number;
  duplicateCount: number;
  conflictCount: number;
  invalidCount: number;
  issues: EarningsExpectationImportIssue[];
  snapshots: EarningsExpectationSnapshot[];
}

export interface EarningsExpectationImportResult extends EarningsExpectationWriteResult {
  data: EarningsExpectationStoreEnvelope | null;
  preview: EarningsExpectationImportPreview;
  backupKey?: string;
}

export interface CsvImportOptions {
  fileName?: string | null;
  validStocks: EarningsExpectationStockIdentity[];
  now?: Date;
}

export interface EarningsExpectationStockIdentity {
  id: string;
  code: string;
  market: Market;
}

export interface JsonImportOptions {
  validStocks: EarningsExpectationStockIdentity[];
}

const DEFAULT_SETTINGS = {
  revisionReminderThreshold: 0.1,
  nearZeroThreshold: 1e-9,
  roundingTolerance: 1e-9,
};

const MARKETS = ["A股", "港股", "美股"] as const;
const PERIOD_SCOPES = ["single_quarter", "year_to_date", "half_year", "first_three_quarters", "full_year", "ttm"] as const;
const METRICS = ["revenue", "attributable_net_profit", "adjusted_net_profit", "eps", "operating_cash_flow"] as const;
const ESTIMATE_SHAPES = ["point", "range"] as const;
const CURRENCIES = ["CNY", "HKD", "USD"] as const;
const UNITS = ["yuan", "ten_thousand_yuan", "million_yuan", "hundred_million_yuan", "currency_per_share"] as const;
const ACCOUNTING_BASES = ["PRC_GAAP", "IFRS", "unknown"] as const;
const SOURCE_CATEGORIES = ["company_guidance", "institution_single", "institution_consensus", "user_estimate"] as const;
const INGESTION_METHODS = ["manual", "json_import", "csv_import"] as const;
const VERIFICATION_STATUSES = ["verified", "pending", "unverified", "invalid"] as const;
const TIME_PRECISIONS = ["date", "datetime"] as const;
const CORRECTION_SCOPES = ["value", "basis"] as const;

export function createEmptyEarningsExpectationEnvelope(now = new Date()): EarningsExpectationStoreEnvelope {
  return {
    schemaVersion: EARNINGS_EXPECTATION_SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    snapshots: [],
    settings: { ...DEFAULT_SETTINGS },
    importHistory: [],
  };
}

/** Current-version migration is intentionally idempotent and preserves unknown legal fields. */
export function migrateEarningsExpectationEnvelope(value: unknown): EarningsExpectationStoreEnvelope {
  if (!isRecord(value) || value.schemaVersion !== EARNINGS_EXPECTATION_SCHEMA_VERSION) {
    const version = isRecord(value) ? String(value.schemaVersion ?? "缺失") : "缺失";
    throw new Error(`不支持的 schemaVersion：${version}`);
  }
  const cloned = cloneJson(value) as unknown as EarningsExpectationStoreEnvelope;
  if (!Array.isArray(cloned.snapshots)) throw new Error("snapshots 必须为数组，原始数据已保留且未被覆盖。");
  cloned.snapshots = cloned.snapshots.map(migrateEarningsExpectationSnapshot);
  const byId = new Map(cloned.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  cloned.snapshots = cloned.snapshots.map((snapshot) => {
    if (!snapshot.correctsSnapshotId || snapshot.correctionScope) return snapshot;
    const original = byId.get(snapshot.correctsSnapshotId);
    return {
      ...snapshot,
      correctionScope: original && correctionBasisChanged(snapshot, original) ? "basis" : "value",
    };
  });
  if (!Array.isArray(cloned.importHistory)) cloned.importHistory = [];
  cloned.settings = {
    ...DEFAULT_SETTINGS,
    ...(isRecord(cloned.settings) ? cloned.settings : {}),
  };
  return cloned;
}

/** Adds only conservative metadata; createdAt is never treated as the prediction formation time. */
export function migrateEarningsExpectationSnapshot(value: unknown): EarningsExpectationSnapshot {
  const clonedValue = cloneJson(value);
  if (!isRecord(clonedValue)) return clonedValue as unknown as EarningsExpectationSnapshot;
  const cloned = clonedValue as Record<string, unknown>;
  if (!("formedAt" in cloned)) cloned.formedAt = null;
  if (!("formedAtPrecision" in cloned)) cloned.formedAtPrecision = isExactDateTime(cloned.formedAt) ? "datetime" : "date";
  if (!("sourcePublishedAtPrecision" in cloned)) {
    cloned.sourcePublishedAtPrecision = cloned.sourcePublishedAt === null || cloned.sourcePublishedAt === undefined
      ? null
      : isExactDateTime(cloned.sourcePublishedAt) ? "datetime" : "date";
  }
  if (!("correctionScope" in cloned)) cloned.correctionScope = null;
  return cloned as unknown as EarningsExpectationSnapshot;
}

export class EarningsExpectationRepository {
  constructor(
    private readonly storage: EarningsExpectationStorageLike | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  load(): EarningsExpectationLoadResult {
    const empty = createEmptyEarningsExpectationEnvelope(this.now());
    if (!this.storage) return { data: empty, error: "当前环境不支持本地存储，业绩预期不会被保存。", corruptedRaw: null };
    let raw: string | null;
    try {
      raw = this.storage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY);
    } catch (error) {
      return { data: empty, error: `读取业绩预期失败：${errorMessage(error)}`, corruptedRaw: null };
    }
    if (raw === null) return { data: empty, error: null, corruptedRaw: null };
    try {
      const data = migrateEarningsExpectationEnvelope(JSON.parse(raw) as unknown);
      const errors = validateEarningsExpectationEnvelope(data);
      if (errors.length) throw new Error(errors.join("；"));
      return { data, error: null, corruptedRaw: null };
    } catch (error) {
      return {
        data: empty,
        error: `本地业绩预期数据已损坏，已安全回退为空状态；原始文本未被覆盖：${errorMessage(error)}`,
        corruptedRaw: raw,
      };
    }
  }

  save(data: EarningsExpectationStoreEnvelope): EarningsExpectationWriteResult {
    if (!this.storage) return { ok: false, error: "当前环境不支持本地存储，无法保存。" };
    const errors = validateEarningsExpectationEnvelope(data);
    if (errors.length) return { ok: false, error: `业绩预期校验失败：${errors.join("；")}` };
    try {
      this.storage.setItem(EARNINGS_EXPECTATION_STORAGE_KEY, JSON.stringify(data));
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: `保存业绩预期失败，原状态已保留：${errorMessage(error)}` };
    }
  }

  reset(): EarningsExpectationWriteResult {
    if (!this.storage) return { ok: false, error: "当前环境不支持本地存储，无法重置。" };
    try {
      this.storage.removeItem(EARNINGS_EXPECTATION_STORAGE_KEY);
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: `重置业绩预期失败：${errorMessage(error)}` };
    }
  }

  export(data: EarningsExpectationStoreEnvelope): string {
    const value: EarningsExpectationExportFile = {
      ...cloneJson(data),
      format: "investment-research-dashboard.earnings-expectation",
      exportedAt: this.now().toISOString(),
    };
    return JSON.stringify(value, null, 2);
  }

  previewJson(raw: string | unknown, current: EarningsExpectationStoreEnvelope, options: JsonImportOptions): EarningsExpectationImportPreview {
    if (typeof raw === "string" && new TextEncoder().encode(raw).byteLength > EARNINGS_EXPECTATION_MAX_IMPORT_BYTES) {
      return invalidPreview("文件超过 2MB 限制。", "file_too_large");
    }
    let parsed: unknown;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : cloneJson(raw);
    } catch (error) {
      return invalidPreview(`JSON 无法解析：${errorMessage(error)}`, "invalid_json");
    }
    if (!isRecord(parsed)) return invalidPreview("JSON 根节点必须是对象。", "invalid_root");
    if (parsed.format !== undefined && parsed.format !== "investment-research-dashboard.earnings-expectation") {
      return invalidPreview("JSON format 不受支持。", "invalid_format");
    }
    if (parsed.schemaVersion !== EARNINGS_EXPECTATION_SCHEMA_VERSION) {
      return { ...invalidPreview(`不支持的 schemaVersion：${String(parsed.schemaVersion ?? "缺失")}`, "unknown_schema"), schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : null };
    }
    if (!("snapshots" in parsed)) return invalidPreview("JSON 缺少 snapshots 字段，未写入任何数据。", "missing_snapshots");
    if (!Array.isArray(parsed.snapshots)) return invalidPreview("JSON snapshots 必须为数组，未写入任何数据。", "invalid_snapshots");
    if (parsed.snapshots.length === 0) return invalidPreview("JSON snapshots 为空；清空数据只能使用单独的重置操作。", "empty_snapshots");
    return buildImportPreview(parsed.snapshots, current, EARNINGS_EXPECTATION_SCHEMA_VERSION, options.validStocks, true);
  }

  previewCsv(raw: string, current: EarningsExpectationStoreEnvelope, options: CsvImportOptions): EarningsExpectationImportPreview {
    if (new TextEncoder().encode(raw).byteLength > EARNINGS_EXPECTATION_MAX_IMPORT_BYTES) return invalidPreview("CSV 文件超过 2MB 限制。", "file_too_large");
    const parsed = parseEarningsExpectationCsv(raw, options);
    const preview = buildImportPreview(parsed.snapshots, current, EARNINGS_EXPECTATION_SCHEMA_VERSION, options.validStocks, false);
    preview.totalCount = parsed.totalCount;
    preview.invalidCount += parsed.issues.length;
    preview.issues = [...parsed.issues, ...preview.issues];
    preview.ok = preview.validCount > 0 && preview.conflictCount === 0;
    preview.partial = preview.validCount > 0 && preview.invalidCount > 0;
    preview.skippedCount = Math.max(0, preview.totalCount - preview.addCount);
    return preview;
  }

  importPreview(
    preview: EarningsExpectationImportPreview,
    current: EarningsExpectationStoreEnvelope,
    method: "json_import" | "csv_import",
    mode: "merge" | "replace",
    fileName: string | null = null,
    partialConfirmed = false,
  ): EarningsExpectationImportResult {
    if (!preview.ok) return { ok: false, error: "导入预览包含无效或冲突记录，未写入任何数据。", data: null, preview };
    if (preview.snapshots.length === 0) return { ok: false, error: "导入快照为空；清空数据只能使用单独的重置操作。", data: null, preview };
    if (preview.partial && !partialConfirmed) return { ok: false, error: "部分记录无效并将被跳过，请在界面二次确认后再导入。", data: null, preview };
    if (!this.storage) return { ok: false, error: "当前环境不支持本地存储，无法导入。", data: null, preview };
    const timestamp = this.now().toISOString();
    const record: EarningsExpectationImportRecord = {
      id: `expectation-import-${stableHash(`${method}|${timestamp}|${fileName ?? "clipboard"}`)}`,
      importedAt: timestamp,
      ingestionMethod: method,
      mode,
      fileName,
      totalCount: preview.totalCount,
      addedCount: mode === "replace" ? preview.snapshots.length : preview.addCount,
      duplicateCount: preview.duplicateCount,
      conflictCount: preview.conflictCount,
      invalidCount: preview.invalidCount,
      issues: cloneJson(preview.issues),
    };
    const incoming = preview.snapshots.map((snapshot) => ({ ...cloneJson(snapshot), ingestionMethod: method }));
    let snapshots: EarningsExpectationSnapshot[];
    if (mode === "replace") snapshots = deduplicateSnapshots(incoming);
    else {
      const fingerprints = new Set(current.snapshots.map(earningsExpectationFingerprint));
      snapshots = [...current.snapshots, ...incoming.filter((snapshot) => !fingerprints.has(earningsExpectationFingerprint(snapshot)))];
    }
    const next: EarningsExpectationStoreEnvelope = {
      ...cloneJson(current),
      updatedAt: timestamp,
      snapshots,
      importHistory: [...current.importHistory, record],
    };
    let backupKey: string | undefined;
    if (mode === "replace") {
      backupKey = `${EARNINGS_EXPECTATION_BACKUP_PREFIX}${timestamp.replace(/[:.]/g, "-")}`;
      try {
        this.storage.setItem(backupKey, JSON.stringify(current));
      } catch (error) {
        return { ok: false, error: `替换前备份失败，已取消替换：${errorMessage(error)}`, data: null, preview };
      }
    }
    const saved = this.save(next);
    return { ...saved, data: saved.ok ? next : null, preview, backupKey };
  }
}

export function createBrowserEarningsExpectationRepository() {
  let storage: EarningsExpectationStorageLike | null = null;
  try { storage = typeof window === "undefined" ? null : window.localStorage; } catch { storage = null; }
  return new EarningsExpectationRepository(storage);
}

export function validateEarningsExpectationEnvelope(data: EarningsExpectationStoreEnvelope): string[] {
  const errors: string[] = [];
  if (!isRecord(data) || data.schemaVersion !== 1) return ["schemaVersion 必须为 1。"];
  if (typeof data.updatedAt !== "string") errors.push("updatedAt 必须为字符串。");
  if (!Array.isArray(data.snapshots)) errors.push("snapshots 必须为数组。");
  if (!Array.isArray(data.importHistory)) errors.push("importHistory 必须为数组。");
  if (!isRecord(data.settings)) errors.push("settings 必须为对象。");
  if (errors.length) return errors;
  const ids = new Set<string>();
  data.snapshots.forEach((snapshot, index) => {
    const issues = validateEarningsExpectationSnapshot(snapshot);
    issues.forEach((issue) => errors.push(`snapshots[${index}]：${issue}`));
    if (ids.has(snapshot.id)) errors.push(`snapshots 存在重复 ID：${snapshot.id}`);
    ids.add(snapshot.id);
  });
  for (const snapshot of data.snapshots) {
    if (snapshot.correctsSnapshotId && !ids.has(snapshot.correctsSnapshotId)) errors.push(`纠正目标不存在：${snapshot.correctsSnapshotId}`);
    if (snapshot.correctsSnapshotId === snapshot.id) errors.push(`快照不能纠正自身：${snapshot.id}`);
    if (snapshot.correctsSnapshotId) {
      const original = data.snapshots.find((item) => item.id === snapshot.correctsSnapshotId);
      if (original && !sameCorrectionIdentity(snapshot, original)) errors.push(`纠正快照 ${snapshot.id} 改变了公司、报告期、指标或来源身份。`);
      if (original && snapshot.correctionScope !== null && snapshot.correctionScope !== undefined && snapshot.correctionScope !== (correctionBasisChanged(snapshot, original) ? "basis" : "value")) errors.push(`纠正快照 ${snapshot.id} 的 correctionScope 与实际口径变化不一致。`);
    }
  }
  if (![data.settings.revisionReminderThreshold, data.settings.nearZeroThreshold, data.settings.roundingTolerance].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
    errors.push("settings 阈值必须为非负有限数字。");
  }
  return errors;
}

export function validateEarningsExpectationSnapshot(snapshot: EarningsExpectationSnapshot, validStocks?: EarningsExpectationStockIdentity[]): string[] {
  const errors: string[] = [];
  if (!isRecord(snapshot)) return ["快照必须为对象。"];
  const textFields = ["id", "stockId", "market", "reportPeriod", "periodScope", "metric", "estimateShape", "currency", "unit", "accountingBasis", "sourceCategory", "sourceName", "sourceTitle", "asOfDate", "ingestionMethod", "createdAt", "createdBy", "sourceVerificationStatus"];
  if (textFields.some((key) => typeof snapshot[key as keyof EarningsExpectationSnapshot] !== "string")) errors.push("必填文本字段类型错误。");
  const sourceName = typeof snapshot.sourceName === "string" ? snapshot.sourceName.trim() : "";
  const sourceTitle = typeof snapshot.sourceTitle === "string" ? snapshot.sourceTitle.trim() : "";
  if (snapshot.schemaVersion !== 1) errors.push("快照 schemaVersion 必须为 1。");
  if (!hasAllowedValue(MARKETS, snapshot.market)) errors.push("market 不受支持。");
  if (!hasAllowedValue(PERIOD_SCOPES, snapshot.periodScope)) errors.push("periodScope 不受支持。");
  if (!hasAllowedValue(METRICS, snapshot.metric)) errors.push("metric 不受支持。");
  if (!hasAllowedValue(ESTIMATE_SHAPES, snapshot.estimateShape)) errors.push("estimateShape 不受支持。");
  if (!hasAllowedValue(CURRENCIES, snapshot.currency)) errors.push("currency 不受支持。");
  if (!hasAllowedValue(UNITS, snapshot.unit)) errors.push("unit 不受支持。");
  if (!hasAllowedValue(ACCOUNTING_BASES, snapshot.accountingBasis)) errors.push("accountingBasis 不受支持。");
  if (!hasAllowedValue(SOURCE_CATEGORIES, snapshot.sourceCategory)) errors.push("sourceCategory 不受支持。");
  if (!hasAllowedValue(INGESTION_METHODS, snapshot.ingestionMethod)) errors.push("ingestionMethod 不受支持；本轮未实现自动 Provider。");
  if (!hasAllowedValue(VERIFICATION_STATUSES, snapshot.sourceVerificationStatus)) errors.push("sourceVerificationStatus 不受支持。");
  if (!hasAllowedValue(TIME_PRECISIONS, snapshot.formedAtPrecision ?? "date")) errors.push("formedAtPrecision 不受支持。");
  if (snapshot.sourcePublishedAtPrecision !== null && snapshot.sourcePublishedAtPrecision !== undefined && !hasAllowedValue(TIME_PRECISIONS, snapshot.sourcePublishedAtPrecision)) errors.push("sourcePublishedAtPrecision 不受支持。");
  if (snapshot.correctionScope !== null && snapshot.correctionScope !== undefined && !hasAllowedValue(CORRECTION_SCOPES, snapshot.correctionScope)) errors.push("correctionScope 不受支持。");
  if (!isReportPeriod(snapshot.reportPeriod)) errors.push("报告期必须是有效季度末日期。");
  if (!isExactDate(snapshot.asOfDate)) errors.push("预期形成日期必须是 YYYY-MM-DD。");
  if (!isExactDateTime(snapshot.createdAt)) errors.push("录入时间必须是有效 ISO 日期时间。");
  const formedAt = snapshot.formedAt ?? null;
  const formedPrecision = snapshot.formedAtPrecision ?? "date";
  if (formedAt !== null && !isExactDateTime(formedAt)) errors.push("精确预期形成时间必须是有效 ISO 日期时间。");
  if (formedPrecision === "datetime" && !formedAt) errors.push("datetime 精度必须提供 formedAt。");
  if (formedPrecision === "date" && formedAt) errors.push("date 精度不得伪装为精确 formedAt。");
  if (snapshot.sourcePublishedAt !== null && snapshot.sourcePublishedAt !== undefined && !isExactDate(snapshot.sourcePublishedAt) && !isExactDateTime(snapshot.sourcePublishedAt)) errors.push("来源发布日期必须是 YYYY-MM-DD 或 ISO 日期时间。");
  const sourcePrecision = snapshot.sourcePublishedAtPrecision ?? (snapshot.sourcePublishedAt ? (isExactDateTime(snapshot.sourcePublishedAt) ? "datetime" : "date") : null);
  if (sourcePrecision === "datetime" && !isExactDateTime(snapshot.sourcePublishedAt)) errors.push("来源 datetime 精度必须提供精确日期时间。");
  if (sourcePrecision === "date" && snapshot.sourcePublishedAt !== null && snapshot.sourcePublishedAt !== undefined && !isExactDate(snapshot.sourcePublishedAt)) errors.push("来源 date 精度只能保存 YYYY-MM-DD。");
  if (sourcePrecision !== null && !snapshot.sourcePublishedAt) errors.push("来源时间精度存在但发布日期缺失。");
  if (typeof snapshot.sourcePublishedAt === "string" && validDate(snapshot.createdAt) && Date.parse(snapshot.sourcePublishedAt) > Date.parse(snapshot.createdAt)) errors.push("来源发布日期不得晚于录入时间。");
  if (formedAt && isExactDateTime(snapshot.createdAt) && Date.parse(formedAt) > Date.parse(snapshot.createdAt)) errors.push("预期形成时间不得晚于录入时间。");
  if (isExactDate(snapshot.asOfDate) && isExactDateTime(snapshot.createdAt) && snapshot.asOfDate > snapshot.createdAt.slice(0, 10)) errors.push("预期形成日期不得晚于录入日期。");
  if (!([snapshot.value, snapshot.lowerBound, snapshot.upperBound] as Array<number | null>).every(nullableFinite)) errors.push("预测数字必须为有限数值或 null。");
  if (snapshot.estimateShape === "point") {
    if (snapshot.value === null) errors.push("点预测必须填写 value。");
    if (snapshot.lowerBound !== null || snapshot.upperBound !== null) errors.push("点预测不得同时填写区间。");
  } else if (snapshot.estimateShape === "range") {
    if (snapshot.value !== null) errors.push("区间预测不得同时填写点预测值。");
    if (snapshot.lowerBound === null || snapshot.upperBound === null) errors.push("区间预测必须填写上下限。");
    if (snapshot.lowerBound !== null && snapshot.upperBound !== null && snapshot.lowerBound > snapshot.upperBound) errors.push("区间下限不得大于上限。");
  } else errors.push("estimateShape 不受支持。");
  if (!([snapshot.analystCount, snapshot.institutionCount] as Array<number | null>).every(nullableNonNegativeInteger)) errors.push("分析师和机构数量必须为非负整数或 null。");
  if (!isMetricUnitCompatible(snapshot.metric, snapshot.unit)) errors.push("指标与单位不兼容。");
  const externalVerified = snapshot.sourceCategory !== "user_estimate" && snapshot.sourceVerificationStatus === "verified";
  if (externalVerified && (!sourceName || !sourceTitle || !snapshot.sourcePublishedAt || !safeSourceUrl(snapshot.sourceUrl))) errors.push("已核验的外部预期必须提供来源主体、标题、发布日期和安全 http(s) 链接。");
  if (snapshot.sourceUrl !== null && snapshot.sourceUrl !== undefined && !safeSourceUrl(snapshot.sourceUrl)) errors.push("来源链接必须使用安全的 http(s) 协议。");
  if (snapshot.sourceCategory === "institution_single" && !sourceName) errors.push("单家机构预测必须填写机构名称。");
  if (snapshot.sourceCategory !== "user_estimate" && !sourceTitle) errors.push("非用户预测必须填写来源标题。");
  if (!periodScopeMatchesReportPeriod(snapshot.reportPeriod, snapshot.periodScope)) errors.push("报告期与期间口径不匹配。");
  if (validStocks) {
    const stock = typeof snapshot.stockId === "string" ? resolveStock(snapshot.stockId, validStocks) : undefined;
    if (!stock) errors.push("stockId 不在当前股票主数据中。");
    else if (stock.market !== snapshot.market) errors.push("快照 market 与股票主数据不一致。");
  }
  return errors;
}

export function earningsExpectationFingerprint(snapshot: EarningsExpectationSnapshot) {
  return [snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric, snapshot.estimateShape, snapshot.value, snapshot.lowerBound, snapshot.upperBound, snapshot.currency, snapshot.unit, snapshot.accountingBasis, snapshot.sourceCategory, snapshot.sourceName.trim(), snapshot.sourceTitle.trim(), snapshot.sourceUrl ?? "", snapshot.sourcePublishedAt ?? "", snapshot.sourcePublishedAtPrecision ?? "", snapshot.asOfDate, snapshot.formedAt ?? "", snapshot.formedAtPrecision ?? "date", snapshot.correctsSnapshotId ?? "", snapshot.correctionScope ?? ""].join("|");
}

export function effectiveEarningsExpectationSnapshots(snapshots: EarningsExpectationSnapshot[]) {
  const corrected = new Set(snapshots.map((snapshot) => snapshot.correctsSnapshotId).filter((value): value is string => Boolean(value)));
  const latest = new Map<string, EarningsExpectationSnapshot>();
  for (const snapshot of snapshots.filter((item) => !corrected.has(item.id))) {
    const key = [snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric, snapshot.sourceCategory, snapshot.sourceName].join("|");
    const current = latest.get(key);
    if (!current || snapshot.asOfDate > current.asOfDate || (snapshot.asOfDate === current.asOfDate && snapshot.createdAt > current.createdAt) || (snapshot.asOfDate === current.asOfDate && snapshot.createdAt === current.createdAt && snapshot.id > current.id)) latest.set(key, snapshot);
  }
  return [...latest.values()];
}

export function parseEarningsExpectationCsv(raw: string, options: CsvImportOptions) {
  const rows = parseCsvRows(raw.replace(/^\uFEFF/, "")).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (rows.length < 2) return { snapshots: [] as EarningsExpectationSnapshot[], issues: [{ row: 1, code: "empty_csv", message: "CSV 必须包含表头和至少一条记录。" }], totalCount: Math.max(0, rows.length - 1) };
  if (rows.length - 1 > EARNINGS_EXPECTATION_MAX_IMPORT_RECORDS) return { snapshots: [] as EarningsExpectationSnapshot[], issues: [{ row: 1, code: "too_many_records", message: "CSV 超过 5000 条记录限制。" }], totalCount: rows.length - 1 };
  const headers = rows[0].map(normalizeHeader);
  const snapshots: EarningsExpectationSnapshot[] = [];
  const issues: EarningsExpectationImportIssue[] = [];
  const now = options.now ?? new Date();
  rows.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const record: Record<string, string> = Object.fromEntries([
      "id", "stockId", "reportPeriod", "periodScope", "metric", "estimateShape", "value", "lowerBound", "upperBound",
      "currency", "unit", "accountingBasis", "sourceCategory", "sourceName", "sourceTitle", "sourceUrl",
      "sourcePublishedAt", "asOfDate", "formedAt", "analystCount", "institutionCount", "sourceVerificationStatus", "notes",
      "correctsSnapshotId", "createdAt", "createdBy",
    ].map((key) => [key, ""]));
    headers.forEach((header, index) => { if (header) record[header] = cells[index]?.trim() ?? ""; });
    const stock = resolveStock(record.stockId, options.validStocks);
    const periodScope = periodScopeValue(record.periodScope);
    const metric = metricValue(record.metric);
    const sourceCategory = sourceCategoryValue(record.sourceCategory);
    const shape = estimateShapeValue(record.estimateShape, record.value, record.lowerBound, record.upperBound);
    const currency = record.currency ? currencyValue(record.currency) : "CNY";
    const accountingBasis = accountingBasisValue(record.accountingBasis);
    const verification = record.sourceVerificationStatus ? verificationValue(record.sourceVerificationStatus) : null;
    if (!stock) issues.push({ row: rowNumber, code: "invalid_stock", message: "股票代码或 stockId 无效。", raw: record });
    if (!isReportPeriod(normalizeDate(record.reportPeriod))) issues.push({ row: rowNumber, code: "invalid_report_period", message: "报告期无效。", raw: record });
    if (!periodScope) issues.push({ row: rowNumber, code: "ambiguous_period_scope", message: "期间口径缺失或不明确，已进入人工核验队列。", raw: record });
    if (!metric) issues.push({ row: rowNumber, code: "unknown_metric", message: "财务指标不受支持。", raw: record });
    if (!sourceCategory) issues.push({ row: rowNumber, code: "unknown_source_category", message: "来源类别不受支持。", raw: record });
    if (!shape) issues.push({ row: rowNumber, code: "unknown_estimate_shape", message: "预测形态不受支持或无法可靠推断。", raw: record });
    if (!currency) issues.push({ row: rowNumber, code: "unknown_currency", message: "币种不受支持。", raw: record });
    if (!accountingBasis) issues.push({ row: rowNumber, code: "unknown_accounting_basis", message: "会计口径不受支持。", raw: record });
    if (record.sourceVerificationStatus && !verification) issues.push({ row: rowNumber, code: "unknown_verification_status", message: "来源核验状态不受支持。", raw: record });
    if (record.unit && !knownImportedUnit(record.unit, metric)) issues.push({ row: rowNumber, code: "unknown_unit", message: "单位不受支持。", raw: record });
    if (!stock || !periodScope || !metric || !sourceCategory || !shape || !currency || !accountingBasis || (record.sourceVerificationStatus && !verification) || (record.unit && !knownImportedUnit(record.unit, metric)) || !isReportPeriod(normalizeDate(record.reportPeriod))) return;
    const parsedValue = parseImportedNumber(record.value, record.unit, metric);
    const parsedLower = parseImportedNumber(record.lowerBound, record.unit, metric);
    const parsedUpper = parseImportedNumber(record.upperBound, record.unit, metric);
    const unit: EarningsExpectationUnit = metric === "eps" ? "currency_per_share" : "yuan";
    const sourceVerificationStatus = verification ?? (sourceCategory === "user_estimate" ? "verified" : "pending");
    const sourcePublishedAt = record.sourcePublishedAt ? normalizeTemporal(record.sourcePublishedAt) : null;
    const formedAt = record.formedAt ? normalizeDateTime(record.formedAt) : null;
    const snapshot: EarningsExpectationSnapshot = {
      id: record.id || `expectation-${stableHash(`${stock.id}|${normalizeDate(record.reportPeriod)}|${metric}|${record.asOfDate}|${rowNumber}`)}`,
      stockId: stock.id,
      market: stock.market,
      reportPeriod: normalizeDate(record.reportPeriod),
      periodScope,
      metric,
      estimateShape: shape,
      value: shape === "point" ? parsedValue : null,
      lowerBound: shape === "range" ? parsedLower : null,
      upperBound: shape === "range" ? parsedUpper : null,
      currency,
      unit,
      accountingBasis,
      sourceCategory,
      sourceName: sourceCategory === "user_estimate" ? (record.sourceName || "用户个人预测") : record.sourceName,
      sourceTitle: record.sourceTitle,
      sourceUrl: record.sourceUrl || null,
      sourcePublishedAt,
      sourcePublishedAtPrecision: sourcePublishedAt ? (isExactDateTime(sourcePublishedAt) ? "datetime" : "date") : null,
      asOfDate: normalizeDate(record.asOfDate),
      formedAt,
      formedAtPrecision: formedAt ? "datetime" : "date",
      analystCount: parseOptionalInteger(record.analystCount),
      institutionCount: parseOptionalInteger(record.institutionCount),
      ingestionMethod: "csv_import",
      createdAt: record.createdAt ? normalizeDateTime(record.createdAt) : now.toISOString(),
      createdBy: record.createdBy || "local-user",
      sourceVerificationStatus,
      notes: record.notes || null,
      correctsSnapshotId: record.correctsSnapshotId || null,
      correctionScope: null,
      schemaVersion: 1,
    };
    const rowIssues = validateEarningsExpectationSnapshot(snapshot, options.validStocks);
    if (rowIssues.length) rowIssues.forEach((message) => issues.push({ row: rowNumber, code: "invalid_snapshot", message, raw: record }));
    else snapshots.push(snapshot);
  });
  return { snapshots, issues, totalCount: rows.length - 1 };
}

export function earningsExpectationCsvTemplate() {
  return "stockId,reportPeriod,periodScope,metric,estimateShape,value,lowerBound,upperBound,currency,unit,accountingBasis,sourceCategory,sourceName,sourceTitle,sourceUrl,sourcePublishedAt,asOfDate,formedAt,analystCount,institutionCount,sourceVerificationStatus,notes\n";
}

export function exportEarningsExpectationCsv(snapshots: EarningsExpectationSnapshot[]) {
  const headers = earningsExpectationCsvTemplate().trimEnd();
  const rows = snapshots.map((snapshot) => [snapshot.stockId, snapshot.reportPeriod, snapshot.periodScope, snapshot.metric, snapshot.estimateShape, snapshot.value, snapshot.lowerBound, snapshot.upperBound, snapshot.currency, snapshot.unit, snapshot.accountingBasis, snapshot.sourceCategory, snapshot.sourceName, snapshot.sourceTitle, snapshot.sourceUrl, snapshot.sourcePublishedAt, snapshot.asOfDate, snapshot.formedAt, snapshot.analystCount, snapshot.institutionCount, snapshot.sourceVerificationStatus, snapshot.notes].map(csvCell).join(","));
  return `\uFEFF${headers}\n${rows.join("\n")}`;
}

function buildImportPreview(
  values: unknown[],
  current: EarningsExpectationStoreEnvelope,
  schemaVersion: number,
  validStocks: EarningsExpectationStockIdentity[],
  strict: boolean,
): EarningsExpectationImportPreview {
  if (values.length > EARNINGS_EXPECTATION_MAX_IMPORT_RECORDS) return { ...invalidPreview("导入记录超过 5000 条限制。", "too_many_records"), schemaVersion, totalCount: values.length };
  const snapshots: EarningsExpectationSnapshot[] = [];
  const issues: EarningsExpectationImportIssue[] = [];
  let invalidCount = 0;
  values.forEach((value, index) => {
    const snapshot = migrateEarningsExpectationSnapshot(value);
    const stock = isRecord(snapshot) && typeof snapshot.stockId === "string" ? resolveStock(snapshot.stockId, validStocks) : undefined;
    if (stock) snapshot.stockId = stock.id;
    const errors = validateEarningsExpectationSnapshot(snapshot, validStocks);
    if (errors.length) {
      invalidCount += 1;
      errors.forEach((message) => issues.push({ row: index + 1, code: "invalid_snapshot", message, raw: cloneJson(value) as Record<string, unknown> }));
    }
    else snapshots.push(snapshot);
  });
  const candidateById = new Map([...current.snapshots, ...snapshots].map((snapshot) => [snapshot.id, snapshot]));
  const linkedSnapshots = snapshots.filter((snapshot, index) => {
    if (!snapshot.correctsSnapshotId) return true;
    const original = candidateById.get(snapshot.correctsSnapshotId);
    let message: string | null = null;
    if (!original) message = `纠正目标不存在：${snapshot.correctsSnapshotId}`;
    else if (!sameCorrectionIdentity(snapshot, original)) message = "纠正快照必须保持公司、报告期、期间口径、指标、来源类别和来源名称一致。";
    else {
      const expectedScope = correctionBasisChanged(snapshot, original) ? "basis" : "value";
      if (snapshot.correctionScope !== null && snapshot.correctionScope !== undefined && snapshot.correctionScope !== expectedScope) message = "correctionScope 与实际口径变化不一致。";
      else snapshot.correctionScope = expectedScope;
    }
    if (!message) return true;
    invalidCount += 1;
    issues.push({ row: index + 1, code: "invalid_correction_chain", message, raw: cloneJson(snapshot) as unknown as Record<string, unknown> });
    return false;
  });
  const currentById = new Map(current.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const currentFingerprints = new Set(current.snapshots.map(earningsExpectationFingerprint));
  const seen = new Set<string>();
  let duplicateCount = 0;
  let conflictCount = 0;
  for (const snapshot of linkedSnapshots) {
    const fingerprint = earningsExpectationFingerprint(snapshot);
    const sameId = currentById.get(snapshot.id);
    if (currentFingerprints.has(fingerprint) || seen.has(fingerprint)) duplicateCount += 1;
    else if (sameId && earningsExpectationFingerprint(sameId) !== fingerprint) {
      conflictCount += 1;
      issues.push({ row: linkedSnapshots.indexOf(snapshot) + 1, code: "id_conflict", message: `快照 ID ${snapshot.id} 与现有记录冲突。` });
    }
    seen.add(fingerprint);
  }
  const unique = deduplicateSnapshots(linkedSnapshots);
  const addCount = unique.filter((snapshot) => !currentFingerprints.has(earningsExpectationFingerprint(snapshot)) && !currentById.has(snapshot.id)).length;
  return {
    ok: (strict ? invalidCount === 0 : snapshots.length > 0) && conflictCount === 0,
    partial: linkedSnapshots.length > 0 && invalidCount > 0,
    schemaVersion,
    totalCount: values.length,
    validCount: linkedSnapshots.length,
    addCount,
    skippedCount: Math.max(0, values.length - addCount),
    duplicateCount,
    conflictCount,
    invalidCount,
    issues,
    snapshots: unique,
  };
}

function deduplicateSnapshots(snapshots: EarningsExpectationSnapshot[]) {
  const selected = new Map<string, EarningsExpectationSnapshot>();
  snapshots.forEach((snapshot) => { if (!selected.has(earningsExpectationFingerprint(snapshot))) selected.set(earningsExpectationFingerprint(snapshot), snapshot); });
  return [...selected.values()];
}

function invalidPreview(message: string, code: string): EarningsExpectationImportPreview {
  return { ok: false, partial: false, schemaVersion: null, totalCount: 0, validCount: 0, addCount: 0, skippedCount: 0, duplicateCount: 0, conflictCount: 0, invalidCount: 1, issues: [{ row: 0, code, message }], snapshots: [] };
}

function parseCsvRows(raw: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') {
      if (quoted && raw[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && raw[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); rows.push(row);
  return rows;
}

const HEADER_MAP: Record<string, string> = {
  id: "id", stockid: "stockId", 股票id: "stockId", 股票代码: "stockId", 公司代码: "stockId",
  reportperiod: "reportPeriod", 报告期: "reportPeriod", periodscope: "periodScope", 期间口径: "periodScope",
  metric: "metric", 指标: "metric", estimateshape: "estimateShape", 预测形态: "estimateShape",
  value: "value", 预测值: "value", lowerbound: "lowerBound", 下限: "lowerBound", upperbound: "upperBound", 上限: "upperBound",
  currency: "currency", 币种: "currency", unit: "unit", 单位: "unit", accountingbasis: "accountingBasis", 会计口径: "accountingBasis",
  sourcecategory: "sourceCategory", 来源类别: "sourceCategory", sourcename: "sourceName", 来源名称: "sourceName", 来源主体: "sourceName",
  sourcetitle: "sourceTitle", 来源标题: "sourceTitle", sourceurl: "sourceUrl", 来源链接: "sourceUrl",
  sourcepublishedat: "sourcePublishedAt", 来源发布日期: "sourcePublishedAt", asofdate: "asOfDate", 预期形成日期: "asOfDate",
  formedat: "formedAt", 精确形成时间: "formedAt", 预期形成时间: "formedAt",
  analystcount: "analystCount", 分析师数量: "analystCount", institutioncount: "institutionCount", 机构数量: "institutionCount",
  sourceverificationstatus: "sourceVerificationStatus", 来源核验状态: "sourceVerificationStatus", notes: "notes", 备注: "notes",
  correctssnapshotid: "correctsSnapshotId", 纠正快照id: "correctsSnapshotId", createdat: "createdAt", createdby: "createdBy",
};

function normalizeHeader(value: string) { const key = value.trim().replace(/[\s_-]/g, "").toLowerCase(); return HEADER_MAP[key] ?? ""; }
function resolveStock(value: string, stocks: CsvImportOptions["validStocks"]) { const normalized = value.trim().toLowerCase(); return stocks.find((stock) => stock.id.toLowerCase() === normalized || stock.code.toLowerCase() === normalized || stock.code.replace(/\.(sh|sz|bj)$/i, "") === normalized); }
function metricValue(value: string) { const key = value.trim().toLowerCase(); return ({ revenue: "revenue", 营业收入: "revenue", attributable_net_profit: "attributable_net_profit", 归母净利润: "attributable_net_profit", adjusted_net_profit: "adjusted_net_profit", 扣非净利润: "adjusted_net_profit", eps: "eps", 每股收益: "eps", operating_cash_flow: "operating_cash_flow", 经营现金流: "operating_cash_flow" } as Record<string, EarningsExpectationSnapshot["metric"]>)[key] ?? null; }
function periodScopeValue(value: string) { const key = value.trim().toLowerCase(); return ({ single_quarter: "single_quarter", 单季度: "single_quarter", year_to_date: "year_to_date", 年初至今: "year_to_date", half_year: "half_year", 半年度: "half_year", first_three_quarters: "first_three_quarters", 前三季度累计: "first_three_quarters", full_year: "full_year", 全年度: "full_year", ttm: "ttm" } as Record<string, EarningsExpectationSnapshot["periodScope"]>)[key] ?? null; }
function sourceCategoryValue(value: string) { const key = value.trim().toLowerCase(); return ({ company_guidance: "company_guidance", 公司指引: "company_guidance", institution_single: "institution_single", 单家机构预测: "institution_single", institution_consensus: "institution_consensus", 机构一致预期: "institution_consensus", user_estimate: "user_estimate", 用户预测: "user_estimate", 用户个人预测: "user_estimate" } as Record<string, EarningsExpectationSnapshot["sourceCategory"]>)[key] ?? null; }
function estimateShapeValue(value: string, point: string, lower: string, upper: string): EarningsExpectationSnapshot["estimateShape"] | null { const key = value.trim().toLowerCase(); if (["range", "区间"].includes(key)) return "range"; if (["point", "点预测"].includes(key)) return "point"; if (key) return null; return lower || upper ? "range" : point ? "point" : null; }
function currencyValue(value: string) { const key = value.trim().toUpperCase(); return (["CNY", "HKD", "USD"] as const).find((item) => item === key) ?? null; }
function accountingBasisValue(value: string) { const key = value.trim().toUpperCase(); if (["PRC_GAAP", "中国企业会计准则"].includes(key)) return "PRC_GAAP" as const; if (["IFRS", "国际财务报告准则"].includes(key)) return "IFRS" as const; if (["UNKNOWN", "未知", ""].includes(key)) return "unknown" as const; return null; }
function verificationValue(value: string) { const key = value.trim().toLowerCase(); return ({ verified: "verified", 已核验: "verified", pending: "pending", 待核验: "pending", unverified: "unverified", 无法核验: "unverified", invalid: "invalid", 无效: "invalid" } as Record<string, EarningsExpectationSnapshot["sourceVerificationStatus"]>)[key] ?? null; }

function parseImportedNumber(raw: string, unitRaw: string, metric: EarningsExpectationSnapshot["metric"]): number | null {
  if (!raw.trim()) return null;
  if (raw.includes("%")) return Number.NaN;
  const valueText = raw.trim().replace(/,/g, "");
  const match = valueText.match(/^([-+]?\d+(?:\.\d+)?)\s*(亿元|百万元|万元|元)?$/);
  if (!match) return Number.NaN;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return Number.NaN;
  if (metric === "eps") return value;
  const unit = match[2] || unitRaw.trim();
  const factor = ({ 元: 1, yuan: 1, 万元: 10_000, ten_thousand_yuan: 10_000, 百万元: 1_000_000, million_yuan: 1_000_000, 亿元: 100_000_000, hundred_million_yuan: 100_000_000 } as Record<string, number>)[unit] ?? (unit ? Number.NaN : 1);
  return value * factor;
}

function normalizeDate(value: string) {
  const input = value.trim();
  if (/^\d{8}$/.test(input)) return `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`;
  const chinese = input.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (chinese) return `${chinese[1]}-${chinese[2].padStart(2, "0")}-${chinese[3].padStart(2, "0")}`;
  const slash = input.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
  return input.slice(0, 10);
}
function normalizeDateTime(value: string) { const timestamp = Date.parse(value); return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString(); }
function normalizeTemporal(value: string) { const input = value.trim(); return /[T\s]\d{1,2}:\d{2}/.test(input) ? normalizeDateTime(input) : normalizeDate(input); }
function parseOptionalInteger(value: string) { if (!value.trim()) return null; const parsed = Number(value); return Number.isInteger(parsed) ? parsed : Number.NaN; }
function isReportPeriod(value: unknown): value is string { if (!validDate(value)) return false; return ["03-31", "06-30", "09-30", "12-31"].includes(value.slice(5)); }
function validDate(value: unknown): value is string { if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) return false; const dateOnly = value.slice(0, 10); const parsed = new Date(`${dateOnly}T00:00:00Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateOnly; }
function isExactDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && validDate(value); }
function isExactDateTime(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value)); }
function periodScopeMatchesReportPeriod(period: unknown, scope: unknown) { if (typeof period !== "string" || !hasAllowedValue(PERIOD_SCOPES, scope)) return false; const suffix = period.slice(5); if (scope === "half_year") return suffix === "06-30"; if (scope === "first_three_quarters") return suffix === "09-30"; if (scope === "full_year") return suffix === "12-31"; if (scope === "year_to_date") return ["03-31", "06-30", "09-30", "12-31"].includes(suffix); return true; }
function nullableFinite(value: number | null) { return value === null || (typeof value === "number" && Number.isFinite(value)); }
function nullableNonNegativeInteger(value: number | null) { return value === null || (Number.isInteger(value) && value >= 0); }
function isMetricUnitCompatible(metric: EarningsExpectationSnapshot["metric"], unit: EarningsExpectationSnapshot["unit"]) { return metric === "eps" ? unit === "currency_per_share" : unit !== "currency_per_share"; }
function knownImportedUnit(value: string, metric: EarningsExpectationSnapshot["metric"] | null) { const key = value.trim(); if (!metric) return false; return metric === "eps" ? ["currency_per_share", "每股", "元/股"].includes(key) : ["yuan", "元", "ten_thousand_yuan", "万元", "million_yuan", "百万元", "hundred_million_yuan", "亿元"].includes(key); }
function safeSourceUrl(value: unknown) { if (typeof value !== "string" || !value) return false; try { const parsed = new URL(value); return parsed.protocol === "https:" || parsed.protocol === "http:"; } catch { return false; } }
function hasAllowedValue(values: readonly string[], value: unknown): value is string { return typeof value === "string" && values.includes(value); }
function correctionBasisChanged(current: EarningsExpectationSnapshot, previous: EarningsExpectationSnapshot) { return current.currency !== previous.currency || current.unit !== previous.unit || current.accountingBasis !== previous.accountingBasis; }
function sameCorrectionIdentity(current: EarningsExpectationSnapshot, previous: EarningsExpectationSnapshot) { return current.stockId === previous.stockId && current.reportPeriod === previous.reportPeriod && current.periodScope === previous.periodScope && current.metric === previous.metric && current.sourceCategory === previous.sourceCategory && typeof current.sourceName === "string" && typeof previous.sourceName === "string" && current.sourceName.trim() === previous.sourceName.trim(); }
function csvCell(value: unknown) { let text = value === null || value === undefined ? "" : String(value); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; }
function cloneJson<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
function stableHash(value: string) { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
