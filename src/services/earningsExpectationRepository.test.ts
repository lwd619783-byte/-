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
  it("4 rejects unknown schema versions", () => expect(() => migrateEarningsExpectationEnvelope({ schemaVersion: 3 })).toThrow("schemaVersion"));
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
  it("15 rejects verified consensus without verifiable source", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), sourceCategory: "institution_consensus", sourceName: "", sourceTitle: "", sourceUrl: null })).toContain("已核验的外部预期必须提供来源主体、标题、发布日期和安全 http(s) 链接。"));
  it("16 keeps a single institution source distinct from consensus", () => { const value = { ...snapshot(), sourceCategory: "institution_single" as const, sourceName: "测试证券", sourceTitle: "盈利预测", sourceVerificationStatus: "pending" as const }; expect(validateEarningsExpectationSnapshot(value)).toEqual([]); expect(value.sourceCategory).toBe("institution_single"); });
  it("17 preserves the user-estimate category", () => expect(snapshot().sourceCategory).toBe("user_estimate"));
  it("18 allows company guidance without a link only as pending verification", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), sourceCategory: "company_guidance", sourceName: "测试公司", sourceTitle: "业绩指引", sourceUrl: null, sourceVerificationStatus: "pending" })).toEqual([]));
  it("19 rejects invalid dates", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), asOfDate: "2026-02-30" })).toContain("预期形成日期必须是 YYYY-MM-DD。"));
  it("20 rejects NaN and Infinity", () => { expect(validateEarningsExpectationSnapshot({ ...snapshot(), value: Number.NaN }).some((item) => item.includes("有限"))).toBe(true); expect(validateEarningsExpectationSnapshot({ ...snapshot(), value: Infinity }).some((item) => item.includes("有限"))).toBe(true); });
  it("21 rejects incompatible units", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), unit: "currency_per_share" })).toContain("指标与单位不兼容。"));
  it("22 rejects negative analyst and institution counts", () => expect(validateEarningsExpectationSnapshot({ ...snapshot(), analystCount: -1, institutionCount: -2 })).toContain("分析师和机构数量必须为非负整数或 null。"));
  it("23 previews valid JSON imports", () => { const preview = jsonPreview(JSON.stringify({ schemaVersion: 1, snapshots: [snapshot()] })); expect(preview.ok).toBe(true); expect(preview.addCount).toBe(1); });
  it("24 rejects unknown JSON versions", () => expect(jsonPreview('{"schemaVersion":9,"snapshots":[]}').issues[0].code).toBe("unknown_schema"));
  it("25 backs up before replacement import while preserving settings and history", () => { const storage = new MemoryStorage(); const repo = new EarningsExpectationRepository(storage, () => new Date("2026-07-13Z")); const current = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [{ ...snapshot(), id: "old" }], settings: { revisionReminderThreshold: 0.25, nearZeroThreshold: 1e-9, roundingTolerance: 1e-9, timeZone: "UTC" }, importHistory: [{ id: "old-import", importedAt: "2026-01-01T00:00:00.000Z", ingestionMethod: "json_import" as const, mode: "merge" as const, fileName: null, totalCount: 1, addedCount: 1, duplicateCount: 0, conflictCount: 0, invalidCount: 0, issues: [] }] }; const preview = repo.previewJson({ schemaVersion: 1, snapshots: [snapshot()] }, current, jsonOptions()); const result = repo.importPreview(preview, current, "json_import", "replace", "in.json"); expect(result.ok).toBe(true); expect(result.backupKey).toContain("backup"); expect(storage.values.has(result.backupKey as string)).toBe(true); expect(result.data?.settings.revisionReminderThreshold).toBe(0.25); expect(result.data?.importHistory.map((item) => item.id)).toContain("old-import"); });
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
  it("69 preserves non-array stored snapshots as corrupted raw instead of coercing to empty", () => { const storage = new MemoryStorage(); const raw = JSON.stringify({ ...createEmptyEarningsExpectationEnvelope(), snapshots: "forged" }); storage.setItem(EARNINGS_EXPECTATION_STORAGE_KEY, raw); const result = new EarningsExpectationRepository(storage).load(); expect(result.corruptedRaw).toBe(raw); expect(storage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)).toBe(raw); });
  it.each([[{}, "missing_snapshots"], [{ snapshots: "x" }, "invalid_snapshots"], [{ snapshots: {} }, "invalid_snapshots"], [{ snapshots: [] }, "empty_snapshots"]])("70 rejects missing, non-array and empty JSON snapshots", (payload, code) => { const preview = jsonPreview({ schemaVersion: 1, ...payload }); expect(preview.ok).toBe(false); expect(preview.issues[0].code).toBe(code); expect(preview.snapshots).toEqual([]); });
  it("71 failed JSON import never clears the current state", () => { const current = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [snapshot()] }; const repo = new EarningsExpectationRepository(new MemoryStorage()); const result = repo.importPreview(repo.previewJson({ schemaVersion: 1, snapshots: [] }, current, jsonOptions()), current, "json_import", "replace"); expect(result.ok).toBe(false); expect(current.snapshots).toHaveLength(1); expect(result.data).toBeNull(); });
  it("72 canonicalizes stock codes and rejects orphan or market-mismatched JSON snapshots", () => { expect(jsonPreview({ schemaVersion: 1, snapshots: [{ ...snapshot(), stockId: "000001.SZ" }] }).snapshots[0].stockId).toBe("demo"); expect(jsonPreview({ schemaVersion: 1, snapshots: [{ ...snapshot(), stockId: "orphan" }] }).ok).toBe(false); expect(jsonPreview({ schemaVersion: 1, snapshots: [{ ...snapshot(), market: "港股" }] }).ok).toBe(false); });
  it("73 rejects forged enums and provider ingestion at runtime", () => { for (const [field, value] of [["market", "A"], ["periodScope", "quarter"], ["metric", "profit"], ["estimateShape", "guess"], ["currency", "RMB"], ["unit", "tons"], ["accountingBasis", "forged"], ["sourceCategory", "web"], ["ingestionMethod", "provider"], ["sourceVerificationStatus", "success"]] as const) expect(validateEarningsExpectationSnapshot({ ...snapshot(), [field]: value } as EarningsExpectationSnapshot).length).toBeGreaterThan(0); });
  it("74 requires complete evidence for every verified external source and rejects unsafe URLs", () => { for (const sourceCategory of ["company_guidance", "institution_single", "institution_consensus"] as const) { const valid = { ...snapshot(), sourceCategory, sourceName: "正式主体", sourceTitle: "正式材料", sourceUrl: "https://example.com/source", sourcePublishedAt: "2026-05-31", sourcePublishedAtPrecision: "date" as const }; expect(validateEarningsExpectationSnapshot(valid)).toEqual([]); expect(validateEarningsExpectationSnapshot({ ...valid, sourcePublishedAt: null })).toContain("已核验的外部预期必须提供来源主体、标题、发布日期和安全 http(s) 链接。"); expect(validateEarningsExpectationSnapshot({ ...valid, sourceUrl: "javascript:alert(1)" }).some((item) => item.includes("http(s)"))).toBe(true); } });
  it("75 requires an explicit confirmation for partial CSV and retains skipped-row evidence", () => { const storage = new MemoryStorage(); const repo = new EarningsExpectationRepository(storage, () => new Date("2026-07-13Z")); const preview = repo.previewCsv(`${csvHeader()}\n${csvRow()}\n${csvRow().replace(/^demo/, "unknown")}`, createEmptyEarningsExpectationEnvelope(), { ...jsonOptions(), now: new Date("2026-07-13Z") }); expect(preview.ok).toBe(true); expect(preview.partial).toBe(true); expect(preview.validCount).toBe(1); expect(preview.invalidCount).toBe(1); expect(repo.importPreview(preview, createEmptyEarningsExpectationEnvelope(), "csv_import", "merge").ok).toBe(false); const confirmed = repo.importPreview(preview, createEmptyEarningsExpectationEnvelope(), "csv_import", "merge", "mixed.csv", true); expect(confirmed.ok).toBe(true); expect(confirmed.data?.snapshots).toHaveLength(1); expect(confirmed.data?.importHistory[0].issues[0].raw?.stockId).toBe("unknown"); });
  it("76 keeps correction source identity stable and labels basis corrections", () => { const store = new EarningsExpectationStore(new EarningsExpectationRepository(new MemoryStorage()), () => new Date("2026-07-13Z"), () => "s-2"); const current = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [snapshot()] }; expect(store.appendCorrection(current, "s-1", { ...input(), sourceName: "伪造来源", value: 120 }).ok).toBe(false); const basis = store.appendCorrection(current, "s-1", { ...input(), unit: "hundred_million_yuan", value: 1 }); expect(basis.ok).toBe(true); expect(basis.snapshot?.correctionScope).toBe("basis"); });
  it("87 rejects forged correction chains during JSON preview", () => { const forged = { ...snapshot(), id: "s-2", correctsSnapshotId: "s-1", sourceName: "伪造来源", value: 120 }; const preview = jsonPreview({ schemaVersion: 1, snapshots: [snapshot(), forged] }); expect(preview.ok).toBe(false); expect(preview.issues.some((item) => item.code === "invalid_correction_chain")).toBe(true); });
  it("88 migrates legacy date-only snapshots conservatively without borrowing createdAt", () => { const migrated = migrateEarningsExpectationEnvelope({ ...createEmptyEarningsExpectationEnvelope(), snapshots: [snapshot()] }).snapshots[0]; expect(migrated.formedAt).toBeNull(); expect(migrated.formedAtPrecision).toBe("date"); expect(migrated.sourcePublishedAtPrecision).toBeNull(); expect(migrated.createdAt).toBe(snapshot().createdAt); });
  it("92 converts forged runtime field types into invalid records without throwing", () => { const forged = { ...snapshot(), stockId: 123, reportPeriod: {}, sourceName: 456, sourceTitle: [], sourceUrl: { protocol: "javascript:" } }; expect(() => jsonPreview({ schemaVersion: 1, snapshots: [forged] })).not.toThrow(); expect(jsonPreview({ schemaVersion: 1, snapshots: [forged] }).ok).toBe(false); });
  it("93 resolves manual unzoned source time with the envelope workflow zone and preserves it after reload", () => {
    const storage = new MemoryStorage();
    const repo = new EarningsExpectationRepository(storage, () => new Date("2026-07-16T00:00:00.000Z"));
    const store = new EarningsExpectationStore(repo, () => new Date("2026-07-16T00:00:00.000Z"), () => "source-local");
    const data = { ...createEmptyEarningsExpectationEnvelope(), settings: { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: "Asia/Shanghai" } };
    const result = store.appendSnapshot(data, { ...input(), asOfDate: "2026-07-15", sourcePublishedAt: "2026-07-15T15:00", sourcePublishedAtPrecision: "datetime" });
    expect(result.ok).toBe(true);
    expect(result.snapshot).toMatchObject({ sourcePublishedAt: "2026-07-15T07:00:00.000Z", sourcePublishedAtResolution: "workflow_time_zone", sourcePublishedAtTimeZone: "Asia/Shanghai" });
    expect(repo.load().data.snapshots[0].sourcePublishedAt).toBe("2026-07-15T07:00:00.000Z");
  });
  it("94 resolves JSON and CSV unzoned source times with the explicit import workflow zone", () => {
    const repo = new EarningsExpectationRepository(new MemoryStorage());
    const current = { ...createEmptyEarningsExpectationEnvelope(), settings: { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: "Asia/Shanghai" } };
    const json = repo.previewJson({ schemaVersion: 1, snapshots: [{ ...snapshot(), id: "json-local", asOfDate: "2026-07-15", sourcePublishedAt: "2026-07-15T15:00", sourcePublishedAtPrecision: "datetime" }] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    expect(json.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T07:00:00.000Z", sourcePublishedAtResolution: "workflow_time_zone", sourcePublishedAtTimeZone: "Asia/Shanghai" });
    const csv = `${csvHeader()}\n${csvRow().replace("https://example.com,,2026-06-01", "https://example.com,2026-07-15T15:00,2026-07-15")}`;
    const csvResult = repo.previewCsv(csv, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    expect(csvResult.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T07:00:00.000Z", sourcePublishedAtResolution: "workflow_time_zone", sourcePublishedAtTimeZone: "Asia/Shanghai" });
  });
  it("95 rejects imported New York source-time DST gaps and overlaps", () => {
    const repo = new EarningsExpectationRepository(new MemoryStorage());
    const current = { ...createEmptyEarningsExpectationEnvelope(), settings: { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: "America/New_York" } };
    for (const sourcePublishedAt of ["2026-03-08T02:30", "2026-11-01T01:30"]) {
      const preview = repo.previewJson({ schemaVersion: 1, snapshots: [{ ...snapshot(), id: `dst-${sourcePublishedAt}`, asOfDate: sourcePublishedAt.slice(0, 10), sourcePublishedAt, sourcePublishedAtPrecision: "datetime" }] }, current, { ...jsonOptions(), now: new Date("2026-12-01T00:00:00.000Z"), timeZone: "America/New_York" });
      expect(preview.ok).toBe(false);
      expect(preview.issues.some((issue) => issue.code.includes("source_published_at"))).toBe(true);
    }
  });
  it("96 preserves historical unzoned source time as unresolved instead of reinterpreting it", () => {
    const legacy = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [{ ...snapshot(), sourcePublishedAt: "2026-07-15T15:00", sourcePublishedAtPrecision: undefined, sourcePublishedAtResolution: undefined, sourcePublishedAtTimeZone: undefined }] };
    const migrated = migrateEarningsExpectationEnvelope(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T15:00", sourcePublishedAtPrecision: "datetime", sourcePublishedAtResolution: "unresolved_legacy", sourcePublishedAtTimeZone: null });
    expect(migrateEarningsExpectationEnvelope(migrated)).toEqual(migrated);
  });
  it("97 records a new correction at the store clock instead of copying the original timestamp", () => {
    const store = new EarningsExpectationStore(new EarningsExpectationRepository(new MemoryStorage()), () => new Date("2026-07-15T09:00:00.000Z"), () => "correction-now");
    const data = { ...createEmptyEarningsExpectationEnvelope(), snapshots: [snapshot()] };
    const result = store.appendCorrection(data, "s-1", { ...input(), value: 110 });
    expect(result.ok).toBe(true);
    expect(result.snapshot?.createdAt).toBe("2026-07-15T09:00:00.000Z");
    expect(data.snapshots[0].createdAt).toBe("2026-07-13T00:00:00.000Z");
  });
  it("98 gives a valid record-declared source time zone precedence in both JSON and CSV previews", () => {
    const repo = new EarningsExpectationRepository(new MemoryStorage());
    const current = { ...createEmptyEarningsExpectationEnvelope(), settings: { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: "Asia/Shanghai" } };
    const value = { ...snapshot(), id: "tokyo-source", asOfDate: "2026-07-15", formedAtCalendarDate: "2026-07-15", sourcePublishedAt: "2026-07-15T15:00", sourcePublishedAtPrecision: "datetime" as const, sourcePublishedAtResolution: "workflow_time_zone" as const, sourcePublishedAtTimeZone: "Asia/Tokyo", sourcePublishedAtCalendarDate: "2026-07-15" };
    const json = repo.previewJson({ schemaVersion: 1, snapshots: [value] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    const csv = repo.previewCsv(exportEarningsExpectationCsv([value]), current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    for (const preview of [json, csv]) {
      expect(preview.ok).toBe(true);
      expect(preview.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T06:00:00.000Z", sourcePublishedAtResolution: "workflow_time_zone", sourcePublishedAtTimeZone: "Asia/Tokyo" });
      expect(preview.timeZoneNotes.some((note) => note.field === "sourcePublishedAt" && note.timeZone === "Asia/Tokyo" && note.message.includes("而非当前工作流时区 Asia/Shanghai"))).toBe(true);
    }
  });
  it("99 uses envelope or explicit workflow time zone only when a source record does not declare one", () => {
    const repo = new EarningsExpectationRepository(new MemoryStorage());
    const current = { ...createEmptyEarningsExpectationEnvelope(), settings: { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: "Asia/Shanghai" } };
    const raw = { ...snapshot(), id: "workflow-source", asOfDate: "2026-07-15", formedAtCalendarDate: "2026-07-15", sourcePublishedAt: "2026-07-15T15:00", sourcePublishedAtPrecision: "datetime" as const, sourcePublishedAtResolution: undefined, sourcePublishedAtTimeZone: undefined, sourcePublishedAtCalendarDate: undefined };
    const envelope = repo.previewJson({ schemaVersion: 1, settings: { timeZone: "Asia/Tokyo" }, snapshots: [raw] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z") });
    expect(envelope.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T06:00:00.000Z", sourcePublishedAtResolution: "workflow_time_zone", sourcePublishedAtTimeZone: "Asia/Tokyo" });
    const explicit = repo.previewJson({ schemaVersion: 1, settings: { timeZone: "Asia/Tokyo" }, snapshots: [raw] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    expect(explicit.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T07:00:00.000Z", sourcePublishedAtTimeZone: "Asia/Shanghai" });
    const tokyoCurrent = { ...current, settings: { ...current.settings, timeZone: "Asia/Tokyo" } };
    const csv = repo.previewCsv(exportEarningsExpectationCsv([raw as EarningsExpectationSnapshot]), tokyoCurrent, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z") });
    expect(csv.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T06:00:00.000Z", sourcePublishedAtTimeZone: "Asia/Tokyo" });
  });
  it("100 preserves absolute source instants without reinterpretation and rejects declared-zone DST gaps", () => {
    const repo = new EarningsExpectationRepository(new MemoryStorage());
    const current = createEmptyEarningsExpectationEnvelope();
    for (const rawTime of ["2026-07-15T15:00:00+08:00", "2026-07-15T07:00:00Z"]) {
      const preview = repo.previewJson({ schemaVersion: 1, snapshots: [{ ...snapshot(), id: `absolute-${rawTime}`, asOfDate: "2026-07-15", sourcePublishedAt: rawTime, sourcePublishedAtPrecision: "datetime", sourcePublishedAtResolution: "absolute", sourcePublishedAtTimeZone: "Asia/Tokyo" }] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
      expect(preview.snapshots[0]).toMatchObject({ sourcePublishedAt: "2026-07-15T07:00:00.000Z", sourcePublishedAtResolution: "absolute", sourcePublishedAtTimeZone: "Asia/Tokyo", sourcePublishedAtCalendarDate: "2026-07-15" });
    }
    for (const rawTime of ["2026-03-08T02:30", "2026-11-01T01:30"]) {
      const preview = repo.previewJson({ schemaVersion: 1, snapshots: [{ ...snapshot(), id: `declared-dst-${rawTime}`, asOfDate: rawTime.slice(0, 10), sourcePublishedAt: rawTime, sourcePublishedAtPrecision: "datetime", sourcePublishedAtResolution: "workflow_time_zone", sourcePublishedAtTimeZone: "America/New_York" }] }, current, { ...jsonOptions(), now: new Date("2026-12-01T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
      expect(preview.ok).toBe(false);
      expect(preview.issues.some((issue) => issue.code.includes("source_published_at"))).toBe(true);
    }
  });
  it("101 applies the same declared-zone formedAt contract to JSON, CSV and direct Store writes", () => {
    const repo = new EarningsExpectationRepository(new MemoryStorage(), () => new Date("2026-07-16T00:00:00.000Z"));
    const current = { ...createEmptyEarningsExpectationEnvelope(), settings: { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: "Asia/Shanghai" } };
    const value = { ...snapshot(), id: "tokyo-formed", asOfDate: "2026-07-15", formedAt: "2026-07-15T00:30", formedAtPrecision: "datetime" as const, formedAtResolution: "workflow_time_zone" as const, formedAtTimeZone: "Asia/Tokyo", formedAtCalendarDate: "2026-07-15" };
    const json = repo.previewJson({ schemaVersion: 1, snapshots: [value] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    const csv = repo.previewCsv(exportEarningsExpectationCsv([value]), current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    for (const preview of [json, csv]) expect(preview.snapshots[0]).toMatchObject({ formedAt: "2026-07-14T15:30:00.000Z", formedAtResolution: "workflow_time_zone", formedAtTimeZone: "Asia/Tokyo" });
    const store = new EarningsExpectationStore(repo, () => new Date("2026-07-16T00:00:00.000Z"), () => "store-tokyo");
    const stored = store.appendSnapshot(current, { ...input(), id: "store-tokyo", asOfDate: "2026-07-15", formedAt: "2026-07-15T00:30", formedAtPrecision: "datetime", formedAtResolution: "workflow_time_zone", formedAtTimeZone: "Asia/Tokyo" });
    expect(stored.snapshot).toMatchObject({ formedAt: "2026-07-14T15:30:00.000Z", formedAtResolution: "workflow_time_zone", formedAtTimeZone: "Asia/Tokyo" });
  });
  it("102 validates absolute formedAt in the workflow zone and rejects date mismatch plus DST ambiguity", () => {
    const repo = new EarningsExpectationRepository(new MemoryStorage());
    const current = createEmptyEarningsExpectationEnvelope();
    const absolute = repo.previewJson({ schemaVersion: 1, snapshots: [{ ...snapshot(), id: "absolute-formed", asOfDate: "2026-07-15", formedAt: "2026-07-15T00:30:00Z", formedAtPrecision: "datetime", formedAtResolution: "absolute" }] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    expect(absolute.ok).toBe(true);
    const mismatch = repo.previewJson({ schemaVersion: 1, snapshots: [{ ...snapshot(), id: "mismatch-formed", asOfDate: "2026-07-14", formedAt: "2026-07-15T00:30:00Z", formedAtPrecision: "datetime", formedAtResolution: "absolute" }] }, current, { ...jsonOptions(), now: new Date("2026-07-16T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    expect(mismatch.ok).toBe(false);
    for (const formedAt of ["2026-03-08T02:30", "2026-11-01T01:30"]) {
      const dst = repo.previewJson({ schemaVersion: 1, snapshots: [{ ...snapshot(), id: `formed-dst-${formedAt}`, asOfDate: formedAt.slice(0, 10), formedAt, formedAtPrecision: "datetime", formedAtResolution: "workflow_time_zone", formedAtTimeZone: "America/New_York" }] }, current, { ...jsonOptions(), now: new Date("2026-12-01T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
      expect(dst.ok).toBe(false);
      expect(dst.issues.some((issue) => issue.code.includes("formed_at"))).toBe(true);
    }
  });
  it("103 preserves legacy unzoned formedAt as unresolved and never substitutes createdAt", () => {
    const migrated = migrateEarningsExpectationEnvelope({ ...createEmptyEarningsExpectationEnvelope(), snapshots: [{ ...snapshot(), formedAt: "2026-07-15T15:00", formedAtPrecision: undefined, formedAtResolution: undefined, formedAtTimeZone: undefined, createdAt: "2026-07-20T00:00:00.000Z" }] });
    expect(migrated.snapshots[0]).toMatchObject({ formedAt: "2026-07-15T15:00", formedAtPrecision: "datetime", formedAtResolution: "unresolved_legacy", formedAtTimeZone: null, createdAt: "2026-07-20T00:00:00.000Z" });
  });
});

function snapshot(): EarningsExpectationSnapshot { return { id: "s-1", stockId: "demo", market: "A股", reportPeriod: "2026-06-30", periodScope: "half_year", metric: "revenue", estimateShape: "point", value: 100, lowerBound: null, upperBound: null, currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "user_estimate", sourceName: "用户个人预测", sourceTitle: "", sourceUrl: null, sourcePublishedAt: null, sourcePublishedAtPrecision: null, sourcePublishedAtResolution: null, sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: null, asOfDate: "2026-06-01", formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: "2026-06-01", analystCount: null, institutionCount: null, ingestionMethod: "manual", createdAt: "2026-07-13T00:00:00.000Z", createdBy: "local-user", sourceVerificationStatus: "verified", notes: null, correctsSnapshotId: null, correctionScope: null, schemaVersion: 2 }; }
function input() { const { id: _id, createdAt: _createdAt, createdBy: _createdBy, correctsSnapshotId: _corrects, schemaVersion: _version, ...value } = snapshot(); return value; }
function csvHeader() { return "stockId,reportPeriod,periodScope,metric,estimateShape,value,lowerBound,upperBound,currency,unit,accountingBasis,sourceCategory,sourceName,sourceTitle,sourceUrl,sourcePublishedAt,asOfDate,analystCount,institutionCount,sourceVerificationStatus,notes"; }
function csvRow(value = "100", unit = "元") { return `demo,2026-06-30,half_year,revenue,point,${value},,,CNY,${unit},PRC_GAAP,user_estimate,用户个人预测,,https://example.com,,2026-06-01,,,verified,`; }
function csvPreview(csv: string) { return new EarningsExpectationRepository(new MemoryStorage()).previewCsv(csv, createEmptyEarningsExpectationEnvelope(), { validStocks: [{ id: "demo", code: "000001.SZ", market: "A股" }], now: new Date("2026-07-13Z") }); }
function jsonOptions() { return { validStocks: [{ id: "demo", code: "000001.SZ", market: "A股" as const }] }; }
function jsonPreview(raw: string | unknown) { return new EarningsExpectationRepository(new MemoryStorage()).previewJson(raw, createEmptyEarningsExpectationEnvelope(), jsonOptions()); }
