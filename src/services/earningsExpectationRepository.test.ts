import { describe, expect, it } from "vitest";
import type { EarningsExpectationSnapshot } from "../types";
import { EarningsExpectationStore } from "./earningsExpectationStore";
import {
  EARNINGS_EXPECTATION_STORAGE_KEY,
  EarningsExpectationRepository,
  createEmptyEarningsExpectationEnvelope,
  earningsExpectationFingerprint,
  exportEarningsExpectationCsv,
  migrateEarningsExpectationEnvelope,
  validateEarningsExpectationSnapshot,
} from "./earningsExpectationRepository";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("earnings expectation repository and validation", () => {
  it("1 initializes an empty state", () => expect(createEmptyEarningsExpectationEnvelope(new Date("2026-07-13Z")).snapshots).toEqual([]));
  it("2 saves and reads normal data", () => { const storage = new MemoryStorage(); const repo = new EarningsExpectationRepository(storage); const data = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [snapshot()] }; expect(repo.save(data).ok).toBe(true); expect(repo.load().data.snapshots[0].id).toBe("s-1"); });
  it("3 safely recovers corrupted JSON without overwriting it", () => { const storage = new MemoryStorage(); storage.setItem(EARNINGS_EXPECTATION_STORAGE_KEY, "{broken"); const result = new EarningsExpectationRepository(storage).load(); expect(result.data.snapshots).toEqual([]); expect(result.corruptedRaw).toBe("{broken"); expect(storage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)).toBe("{broken"); });
  it("4 rejects unknown schema versions", () => expect(() => migrateEarningsExpectationEnvelope({ schemaVersion: 2 })).toThrow("schemaVersion"));
  it("5 appends snapshots only", () => { const storage = new MemoryStorage(); const store = new EarningsExpectationStore(new EarningsExpectationRepository(storage), () => new Date("2026-07-13Z"), () => "s-new"); const result = store.appendSnapshot(createEmptyEarningsExpectationEnvelope(), input()); expect(result.ok).toBe(true); expect(result.data.snapshots).toHaveLength(1); });
  it("6 exposes no in-place update API", () => expect("updateSnapshot" in new EarningsExpectationStore(new EarningsExpectationRepository(new MemoryStorage()))).toBe(false));
  it("7 links a correction snapshot", () => { const storage = new MemoryStorage(); const store = new EarningsExpectationStore(new EarningsExpectationRepository(storage), () => new Date("2026-07-13Z"), () => "s-2"); const data = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [snapshot()] }; const result = store.appendCorrection(data, "s-1", { ...input(), value: 120 }); expect(result.ok).toBe(true); expect(result.snapshot?.correctsSnapshotId).toBe("s-1"); expect(result.data.snapshots).toHaveLength(2); });
  it("8 rolls back atomically on write failure", () => { const storage = new MemoryStorage(); storage.setItem = () => { throw new Error("quota"); }; const data = createEmptyEarningsExpectationEnvelope(); const result = new EarningsExpectationStore(new EarningsExpectationRepository(storage), () => new Date("2026-07-13Z"), () => "s-2").appendSnapshot(data, input()); expect(result.ok).toBe(false); expect(result.data).toBe(data); });
  it("9 preserves unknown legal fields during migration", () => { const migrated = migrateEarningsExpectationEnvelope({ ...createEmptyEarningsExpectationEnvelope(), futureField: { keep: true } }) as unknown as Record<string, unknown>; expect(migrated.futureField).toEqual({ keep: true }); });
  it("10 computes stable fingerprints and deduplicates identical append", () => { const storage = new MemoryStorage(); const store = new EarningsExpectationStore(new EarningsExpectationRepository(storage), () => new Date("2026-07-13Z"), () => "s-2"); const data = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [snapshot()] }; expect(earningsExpectationFingerprint(snapshot())).toBe(earningsExpectationFingerprint({ ...snapshot() })); expect(store.appendSnapshot(data, { ...input(), id: "s-2" }).ok).toBe(false); });
  it("11 accepts a point estimate", () => expect(validateEarningsExpectationSnapshot(snapshot())).toEqual([]));
  it("12 accepts a range estimate", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), estimateShape: "range", value: null, lowerBound: 90, upperBound: 110 })).toEqual([]));
  it("13 rejects lower bound above upper bound", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), estimateShape: "range", value: null, lowerBound: 120, upperBound: 110 })).toContain("区间下限不得大于上限。"));
  it("14 rejects point and range values together", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), lowerBound: 90, upperBound: 110 })).toContain("点预测不得同时填写区间。"));
  it("15 rejects consensus without verifiable source", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), sourceCategory: "institution_consensus", sourceName: "", sourceTitle: "", sourceUrl: null })).toContain("机构一致预期必须提供可核验的来源主体、标题和链接。"));
  it("16 keeps a single institution source distinct from consensus", () => { const value = { ...snapshot(), sourceCategory: "institution_single" as const, sourceName: "测试证券", sourceTitle: "盈利预测" }; expect(validateEarningsExpectationSnapshot(value)).toEqual([]); expect(value.sourceCategory).toBe("institution_single"); });
  it("17 preserves the user-estimate category", () => expect(snapshot().sourceCategory).toBe("user_estimate"));
  it("18 allows company guidance without a link only as pending verification", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), sourceCategory: "company_guidance", sourceName: "测试公司", sourceTitle: "业绩指引", sourceUrl: null, sourceVerificationStatus: "pending" })).toEqual([]));
  it("19 rejects invalid dates", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), asOfDate: "2026-02-30" })).toContain("预期形成日期无效。"));
  it("20 rejects NaN and Infinity", () => { expect(validateEarningsExpectationSnapshot({ ...snapshot(), value: Number.NaN }).some((item) => item.includes("有限"))).toBe(true); expect(validateEarningsExpectationSnapshot({ ...snapshot(), value: Infinity }).some((item) => item.includes("有限"))).toBe(true); });
  it("21 rejects incompatible units", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), unit: "currency_per_share" })).toContain("指标与单位不兼容。"));
  it("22 rejects negative analyst and institution counts", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), analystCount: -1, institutionCount: -2 })).toContain("分析师和机构数量必须为非负整数或 null。"));
  it("23 previews valid JSON imports", () => { const repo = new EarningsExpectationRepository(new MemoryStorage()); const preview = repo.previewJson(JSON.stringify({ schemaVersion: 1, snapshots: [snapshot()] }), createEmptyEarningsExpectationEnvelope()); expect(preview.ok).toBe(true); expect(preview.addCount).toBe(1); });
  it("24 rejects unknown JSON versions", () => expect(new EarningsExpectationRepository(new MemoryStorage()).previewJson('{"schemaVersion":9,"snapshots":[]}', createEmptyEarningsExpectationEnvelope()).issues[0].code).toBe("unknown_schema"));
  it("25 backs up before replacement import", () => { const storage = new MemoryStorage(); const repo = new EarningsExpectationRepository(storage, () => new Date("2026-07-13Z")); const current = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [{ ...snapshot(), id: "old" }] }; const preview = repo.previewJson({ schemaVersion: 1, snapshots: [snapshot()] }, current); const result = repo.importPreview(preview, current, "json_import", "replace", "in.json"); expect(result.ok).toBe(true); expect(result.backupKey).toContain("backup"); expect(storage.values.has(result.backupKey as string)).toBe(true); });
  it("26 handles an UTF-8 BOM in CSV", () => expect(csvPreview(`\uFEFF${csvHeader()}\n${csvRow()}`).validCount).toBe(1));
  it("27 maps Chinese headers", () => { const csv = "股票代码,报告期,期间口径,指标,预测形态,预测值,币种,单位,会计口径,来源类别,来源名称,来源标题,预期形成日期\ndemo,2026-06-30,半年度,营业收入,点预测,100,CNY,元,中国企业会计准则,用户个人预测,用户个人预测,,2026-06-01"; expect(csvPreview(csv).validCount).toBe(1); });
  it("28 parses quoted thousands separators", () => expect(csvPreview(`${csvHeader()}\n${csvRow('"1,234.5"')}`).snapshots[0].value).toBe(1234.5));
  it("29 standardizes yuan, ten-thousand, million and hundred-million units", () => { for (const [unit, expected] of [["元", 2], ["万元", 20_000], ["百万元", 2_000_000], ["亿元", 200_000_000]] as const) expect(csvPreview(`${csvHeader()}\n${csvRow("2", unit)}`).snapshots[0].value).toBe(expected); });
  it("30 imports point estimates", () => expect(csvPreview(`${csvHeader()}\n${csvRow()}`).snapshots[0].estimateShape).toBe("point"));
  it("31 imports range estimates", () => { const row = "demo,2026-06-30,half_year,revenue,range,,90,110,CNY,元,PRC_GAAP,user_estimate,用户个人预测,,https://example.com,,2026-06-01,,,verified,"; expect(csvPreview(`${csvHeader()}\n${row}`).snapshots[0].estimateShape).toBe("range"); });
  it("32 counts duplicate records", () => { const preview = csvPreview(`${csvHeader()}\n${csvRow()}\n${csvRow()}`); expect(preview.duplicateCount).toBe(1); });
  it("33 rejects invalid stock codes", () => expect(csvPreview(`${csvHeader()}\n${csvRow().replace(/^demo/, "unknown")}`).issues.some((item) => item.code === "invalid_stock")).toBe(true));
  it("34 rejects invalid report periods", () => expect(csvPreview(`${csvHeader()}\n${csvRow().replace("2026-06-30", "2026-05-31")}`).issues.some((item) => item.code === "invalid_report_period")).toBe(true));
  it("35 queues ambiguous period scopes instead of guessing", () => expect(csvPreview(`${csvHeader()}\n${csvRow().replace(",half_year,", ",,")}`).issues.some((item) => item.code === "ambiguous_period_scope")).toBe(true));
  it("36 prevents spreadsheet formula injection in CSV export", () => expect(exportEarningsExpectationCsv([{ ...snapshot(), notes: "=CMD()" }])).toContain("'=CMD()"));
});

function snapshot(): EarningsExpectationSnapshot { return { id: "s-1", stockId: "demo", market: "A股", reportPeriod: "2026-06-30", periodScope: "half_year", metric: "revenue", estimateShape: "point", value: 100, lowerBound: null, upperBound: null, currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "user_estimate", sourceName: "用户个人预测", sourceTitle: "", sourceUrl: null, sourcePublishedAt: null, asOfDate: "2026-06-01", analystCount: null, institutionCount: null, ingestionMethod: "manual", createdAt: "2026-07-13T00:00:00.000Z", createdBy: "local-user", sourceVerificationStatus: "verified", notes: null, correctsSnapshotId: null, schemaVersion: 1 }; }
function input() { const { id: _id, createdAt: _createdAt, createdBy: _createdBy, correctsSnapshotId: _corrects, schemaVersion: _version, ...value } = snapshot(); return value; }
function csvHeader() { return "stockId,reportPeriod,periodScope,metric,estimateShape,value,lowerBound,upperBound,currency,unit,accountingBasis,sourceCategory,sourceName,sourceTitle,sourceUrl,sourcePublishedAt,asOfDate,analystCount,institutionCount,sourceVerificationStatus,notes"; }
function csvRow(value = "100", unit = "元") { return `demo,2026-06-30,half_year,revenue,point,${value},,,CNY,${unit},PRC_GAAP,user_estimate,用户个人预测,,https://example.com,,2026-06-01,,,verified,`; }
function csvPreview(csv: string) { return new EarningsExpectationRepository(new MemoryStorage()).previewCsv(csv, createEmptyEarningsExpectationEnvelope(), { validStocks: [{ id: "demo", code: "000001.SZ", market: "A股" }], now: new Date("2026-07-13Z") }); }
