import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { industries } from "../../data/industries";
import { stocks } from "../../data/stocks";
import type { EarningsExpectationComparison, EarningsExpectationSnapshot, ResearchEvent, Stock, WatchItem } from "../../types";
import { buildEarningsExpectationResearchEvents } from "../../services/earningsExpectationEventProvider";
import { buildEarningsExpectationComparisons } from "../../services/earningsExpectationComparisonProvider";
import { buildReviewTasks } from "../../services/reviewTaskProvider";
import { EarningsExpectationCenter } from "./EarningsExpectationCenter";
import { EarningsExpectationFormModal, resolveFormationInput, resolveSourcePublishedInput } from "./EarningsExpectationFormModal";
import { EarningsExpectationImportActions, Preview } from "./EarningsExpectationImportModal";
import { StockEarningsExpectationPanel } from "./StockEarningsExpectationPanel";
import { StockDetailDrawer } from "../stock/StockDetailDrawer";

describe("earnings expectation UI and workflow linkage", () => {
  it("51 renders the add-expectation form", () => { const html = renderToStaticMarkup(<EarningsExpectationFormModal stocks={[stock()]} initialStockId="demo" onClose={() => undefined} onSubmit={() => undefined} />); expect(html).toContain("添加业绩预期"); expect(html).toContain("点预测"); });
  it("52 renders correction mode without editing history", () => { const html = renderToStaticMarkup(<EarningsExpectationFormModal stocks={[stock()]} correctionTarget={snapshot()} onClose={() => undefined} onSubmit={() => undefined} />); expect(html).toContain("创建纠正快照"); expect(html).toContain("保存纠正快照"); });
  it("53 renders append-only business revisions separately from data corrections", () => { const html = centerHtml([{ ...snapshot(), id: "s-0", asOfDate: "2026-05-01", value: 90 }, snapshot()]); expect(html).toContain("业务修订"); expect(html).toContain("业务预测较前值"); });
  it("54 displays the source category", () => expect(centerHtml([snapshot()])).toContain("用户个人预测"));
  it("55 displays ex-ante validity", () => expect(centerHtml([snapshot()], [comparison()])).toContain("事前有效"));
  it("56 displays explicit non-comparability reasons", () => expect(centerHtml([snapshot()], [{ ...comparison(), comparabilityStatus: "not_comparable", comparisonResult: "not_comparable", isExAnte: false, nonComparableReasons: ["会计口径不同或不明确"] }])).toContain("会计口径不同或不明确"));
  it("57 renders the stock-detail earnings expectation module", () => { const sourceStock = stocks[0]; const value = { ...snapshot(), stockId: sourceStock.id, market: sourceStock.market }; const html = renderToStaticMarkup(<StockDetailDrawer stock={sourceStock} stocks={stocks} industries={industries} earningsExpectationSnapshots={[value]} onClose={() => undefined} />); expect(html).toContain("业绩预期"); expect(html).toContain("当前有效预期"); });
  it("58 renders all expectation-center filters", () => { const html = centerHtml([snapshot()]); for (const label of ["公司", "行业", "报告期", "指标", "来源类别", "来源核验", "事前有效", "比较结果", "存在修订", "观察清单"]) expect(html).toContain(label); });
  it("59 generates deterministic full ResearchEvents without duplicates", () => { const first = buildEarningsExpectationResearchEvents([snapshot()], [{ ...comparison(), calculatedAt: "2026-07-02T00:00:00.000Z" }], [stock()]); const second = buildEarningsExpectationResearchEvents([snapshot()], [{ ...comparison(), calculatedAt: "2026-07-10T00:00:00.000Z" }], [stock()]); expect(first).toEqual(second); expect(new Set(first.map((event) => event.id)).size).toBe(first.length); });
  it("60 generates stable de-duplicated ReviewTask IDs", () => { const events = buildEarningsExpectationResearchEvents([snapshot()], [comparison()], [stock()]); const item = watchItem(); const first = buildReviewTasks({ watchItems: [item], events, chains: [], taskStates: [], now: new Date("2026-07-13") }); const second = buildReviewTasks({ watchItems: [item], events: [...events, ...events], chains: [], taskStates: [], now: new Date("2026-07-13") }); expect(first.map((task) => task.id)).toEqual(second.map((task) => task.id)); });
  it("61 never labels a user estimate as institution consensus", () => { const html = renderToStaticMarkup(<StockEarningsExpectationPanel stock={stock()} snapshots={[snapshot()]} financialData={null} announcementData={null} financialLoadStatus="idle" announcementLoadStatus="idle" />); expect(html).toContain("用户个人预测"); expect(html).not.toContain("机构一致预期差"); });
  it("62 never labels a single institution as consensus", () => { const value = { ...snapshot(), sourceCategory: "institution_single" as const, sourceName: "测试证券", sourceTitle: "盈利预测", sourceUrl: "https://example.com/report" }; const html = centerHtml([value]); expect(html).toContain("单家机构预测"); expect(html).not.toContain("机构一致预期差"); });
  it("63 does not emit unsupported institution-surprise wording", () => { const output = [centerHtml([snapshot()], [comparison()]), JSON.stringify(buildEarningsExpectationResearchEvents([snapshot()], [comparison()], [stock()]))].join("\n"); expect(output).not.toContain(["超", "机构", "预期"].join("")); });
  it("64 renders storage errors without a white screen", () => { const html = renderToStaticMarkup(<EarningsExpectationCenter {...centerProps()} snapshots={[]} comparisons={[]} storageError="本地数据已损坏，原始文本未覆盖" />); expect(html).toContain("本地数据已损坏"); expect(html).toContain("业绩预期证据中心"); });
  it("65 keeps narrow-screen layout card-based without page-level horizontal scrolling", () => { const html = centerHtml([snapshot()]); expect(html).toContain("min-w-0"); expect(html).not.toContain("overflow-x-auto"); });
  it("67 emits only a data-warning event for a non-comparable result", () => { const events = buildEarningsExpectationResearchEvents([snapshot()], [{ ...comparison(), comparabilityStatus: "not_comparable", comparisonResult: "not_comparable", isExAnte: false, nonComparableReasons: ["实际值缺失"] }], [stock()]); expect(events.some((event) => event.eventType === "earnings_expectation_data_warning")).toBe(true); expect(events.some((event) => event.eventType === "earnings_expectation_comparison_available")).toBe(false); });
  it("68 applies the configured revision reminder threshold to ReviewTask generation", () => { const first = { ...snapshot(), id: "s-0", value: 100, asOfDate: "2026-05-01", formedAtCalendarDate: "2026-05-01", createdAt: "2026-05-01T00:00:00.000Z" }; const second = { ...snapshot(), id: "s-2", value: 108, asOfDate: "2026-06-01", formedAtCalendarDate: "2026-06-01", createdAt: "2026-06-01T00:00:00.000Z" }; const events = buildEarningsExpectationResearchEvents([first, second], [], [stock()], 0.1); const strict = buildReviewTasks({ watchItems: [watchItem()], events, chains: [], taskStates: [], now: new Date("2026-07-13"), expectationRevisionThreshold: 0.1 }); const loose = buildReviewTasks({ watchItems: [watchItem()], events, chains: [], taskStates: [], now: new Date("2026-07-13"), expectationRevisionThreshold: 0.05 }); expect(strict.some((task) => task.ruleType === "earnings_expectation_revision_up")).toBe(false); expect(loose.some((task) => task.ruleType === "earnings_expectation_revision_up")).toBe(true); });
  it("83 disables both import actions when validation fails", () => { const html = renderToStaticMarkup(<EarningsExpectationImportActions preview={invalidPreview()} method="json_import" fileName={null} onImport={() => undefined} />); expect((html.match(/disabled=""/g) ?? [])).toHaveLength(2); expect(html).toContain("合并快照"); expect(html).toContain("替换快照"); });
  it("84 renders mixed CSV as a warning with explicit import and skip counts", () => { const html = renderToStaticMarkup(<Preview value={{ ...invalidPreview(), ok: true, partial: true, totalCount: 2, validCount: 1, addCount: 1, skippedCount: 1, invalidCount: 1 }} />); expect(html).toContain("部分可导入，需二次确认"); expect(html).toContain("将新增：1"); expect(html).toContain("将跳过：1"); });
  it("85 displays basis corrections without a misleading business revision rate", () => { const corrected = { ...snapshot(), id: "s-2", correctsSnapshotId: "s-1", correctionScope: "basis" as const, unit: "hundred_million_yuan" as const, value: 1 }; const html = centerHtml([snapshot(), corrected]); expect(html).toContain("口径纠正"); expect(html).toContain("数据更正"); expect(html).toContain("不跨口径计算差异"); });
  it("86 exposes disclosure timing separately from local parse success", () => { const html = centerHtml([snapshot()], [{ ...comparison(), actualDisclosureTimingStatus: "before", performanceDisclosureTimingStatus: "before" }]); expect(html).toContain("相对实际值披露：披露前"); expect(html).toContain("相对公司业绩信息披露：披露前"); expect(html).toContain("本地数值是否解析成功分别判断"); });
  it("91 keeps an acknowledged comparison task stable after reload and recalculation", () => { const item = watchItem(); const firstEvents = buildEarningsExpectationResearchEvents([snapshot()], [{ ...comparison(), calculatedAt: "2026-07-02T00:00:00.000Z" }], [stock()]); const first = buildReviewTasks({ watchItems: [item], events: firstEvents, chains: [], taskStates: [], now: new Date("2026-07-13") }).find((task) => task.ruleType === "earnings_expectation_comparison"); expect(first).toBeDefined(); const state = { taskId: first!.id, status: "acknowledged" as const, acknowledgedAt: "2026-07-03", dismissedAt: null, snoozedUntil: null, updatedAt: "2026-07-03" }; const reloadedEvents = buildEarningsExpectationResearchEvents([snapshot()], [{ ...comparison(), calculatedAt: "2026-07-10T00:00:00.000Z" }], [stock()]); const reloaded = buildReviewTasks({ watchItems: [item], events: reloadedEvents, chains: [], taskStates: [state], now: new Date("2026-07-13") }).find((task) => task.ruleType === "earnings_expectation_comparison"); expect(reloaded?.id).toBe(first?.id); expect(reloaded?.createdAt).toBe(first?.createdAt); expect(reloaded?.status).toBe("acknowledged"); });
  it("shows a conservative same-day uncertainty notice and no directional wording", () => { const html = centerHtml([{ ...snapshot(), id: "a" }, { ...snapshot(), id: "z", value: 110 }]); expect(html).toContain("同日存在多条仅日期精度的预测"); expect(html).toContain("当前不生成正式预期差"); expect(html).not.toContain("业务预测较前值 +"); });
  it("does not fabricate midnight for a date-only business time", () => { const html = centerHtml([snapshot()]); expect(html).toContain("2026-06-01 (date)"); expect(html).not.toContain("2026-06-01T00:00"); });
  it("keeps the original source display name after identity normalization", () => { const value = { ...snapshot(), sourceCategory: "institution_single" as const, sourceName: " ABC　Securities ", sourceTitle: "盈利预测", sourceUrl: "https://example.com/report" }; expect(centerHtml([value])).toContain(" ABC　Securities "); });
  it("renders the injected Tokyo workflow day and time zone in the form", () => { const html = renderToStaticMarkup(<EarningsExpectationFormModal stocks={[stock()]} initialStockId="demo" timeZone="Asia/Tokyo" now={new Date("2026-07-13T15:30:00.000Z")} onClose={() => undefined} onSubmit={() => undefined} />); expect(html).toContain("Asia/Tokyo"); expect(html).toContain("2026-07-14"); });
  it("blocks DST gaps and overlaps before form submission", () => { expect(resolveFormationInput("2026-03-08T02:30", "America/New_York").error).toContain("不存在"); expect(resolveFormationInput("2026-11-01T01:30", "America/New_York").error).toContain("两个可能时刻"); expect(resolveFormationInput("2026-07-14T00:30", "Asia/Tokyo")).toMatchObject({ formedAt: "2026-07-13T15:30:00.000Z", precision: "datetime", error: null }); });
  it("propagates uncertain business order through comparison, event, task and KPI inputs exactly once", () => {
    const values = [{ ...snapshot(), id: "a", value: 100 }, { ...snapshot(), id: "z", value: 110 }];
    const actual = { ...researchEvent("actual", "financial_update"), publishedAt: "2026-07-01", eventDate: "2026-07-01", metrics: [{ key: "operatingRevenue", label: "营业收入", value: 105, unit: "CNY" as const, periodBasis: "cumulative" as const, sourceAnnouncementId: null, sourceFinancialPeriod: "2026-06-30" }] };
    const comparisons = buildEarningsExpectationComparisons(values, [actual]);
    const events = buildEarningsExpectationResearchEvents(values, comparisons, [stock()]);
    const tasks = buildReviewTasks({ watchItems: [watchItem()], events, chains: [], taskStates: [], now: new Date("2026-07-13"), timeZone: "Asia/Shanghai" });
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0].comparabilityStatus).toBe("not_comparable");
    expect(["above", "within", "below"]).not.toContain(comparisons[0].comparisonResult);
    expect(events.filter((event) => event.eventType === "earnings_expectation_data_warning")).toHaveLength(1);
    expect(events.some((event) => event.eventType === "earnings_expectation_comparison_available" || event.eventType === "earnings_expectation_revision")).toBe(false);
    expect(tasks.filter((task) => task.ruleType === "earnings_expectation_data_warning")).toHaveLength(1);
    expect(tasks.some((task) => task.ruleType === "earnings_expectation_revision_up" || task.ruleType === "earnings_expectation_revision_down")).toBe(false);
    const html = centerHtml(values, comparisons);
    expect(html).toContain("当前不生成正式预期差");
    expect(html).not.toContain("高于用户个人预测");
    expect(html).not.toContain("低于用户个人预测");
  });
  it("restores a formal comparison after exact formation times establish business order", () => {
    const values = [{ ...snapshot(), id: "a", value: 100, asOfDate: "2026-06-01", formedAt: "2026-06-01T07:00:00.000Z", formedAtPrecision: "datetime" as const }, { ...snapshot(), id: "z", value: 110, asOfDate: "2026-06-01", formedAt: "2026-06-01T08:00:00.000Z", formedAtPrecision: "datetime" as const }];
    const actual = { ...researchEvent("actual", "financial_update"), publishedAt: "2026-07-01", eventDate: "2026-07-01", metrics: [{ key: "operatingRevenue", label: "营业收入", value: 105, unit: "CNY" as const, periodBasis: "cumulative" as const, sourceAnnouncementId: null, sourceFinancialPeriod: "2026-06-30" }] };
    const first = buildEarningsExpectationComparisons(values, [actual], undefined, "2026-07-02T00:00:00.000Z");
    const second = buildEarningsExpectationComparisons([...values].reverse(), [actual], undefined, "2026-07-02T00:00:00.000Z");
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({ snapshotId: "z", businessOrderStatus: "confirmed", comparisonResult: "below", comparabilityStatus: "comparable" });
  });
  it("disables only the correction-graph import mode that is unsafe", () => { const preview = { ...invalidPreview(), ok: true, mergeAllowed: false, replaceAllowed: true, issues: [{ row: 1, code: "correction_graph_merge_branch", message: "合并不可用：同一历史快照存在多个直接纠正者" }] }; const html = renderToStaticMarkup(<><Preview value={preview} /><EarningsExpectationImportActions preview={preview} method="json_import" fileName={null} onImport={() => undefined} /></>); expect(html).toContain("同一历史快照存在多个直接纠正者"); expect((html.match(/disabled=""/g) ?? [])).toHaveLength(1); expect(html).toContain("合并：禁止"); expect(html).toContain("替换：允许"); });
  it("resolves form source times with the workflow zone and blocks DST ambiguity", () => {
    expect(resolveSourcePublishedInput("2026-07-15T15:00", "Asia/Shanghai")).toMatchObject({ value: "2026-07-15T07:00:00.000Z", precision: "datetime", resolution: "workflow_time_zone", interpretedTimeZone: "Asia/Shanghai", error: null });
    expect(resolveSourcePublishedInput("2026-03-08T02:30", "America/New_York").error).toContain("不存在");
    expect(resolveSourcePublishedInput("2026-11-01T01:30", "America/New_York").error).toContain("两个可能时刻");
  });
  it("renders original business time and correction-recorded time in both expectation surfaces", () => {
    const original = { ...snapshot(), id: "a", asOfDate: "2026-06-01", createdAt: "2026-06-01T00:00:00.000Z" };
    const correction = { ...snapshot(), id: "c", correctsSnapshotId: "a", correctionScope: "value" as const, value: 110, asOfDate: "2026-06-01", createdAt: "2026-07-15T04:00:00.000Z", notes: "修正录入错误" };
    const center = centerHtml([original, correction]);
    const panel = renderToStaticMarkup(<StockEarningsExpectationPanel stock={stock()} snapshots={[correction, original]} financialData={null} announcementData={null} financialLoadStatus="idle" announcementLoadStatus="idle" timeZone="Asia/Shanghai" />);
    for (const html of [center, panel]) {
      expect(html).toContain("原记录业务时间");
      expect(html).toContain("2026-06-01");
      expect(html).toContain("纠正记录 2026-07-15T04:00:00.000Z");
      expect(html).toContain("a");
      expect(html).toContain("c");
    }
  });
  it("renders exact equal order and same-time disclosure without directional wording", () => {
    const first = { ...snapshot(), id: "a", formedAt: "2026-06-01T07:00:00.000Z", formedAtPrecision: "datetime" as const };
    const second = { ...snapshot(), id: "z", value: 110, formedAt: "2026-06-01T15:00:00+08:00", formedAtPrecision: "datetime" as const };
    const html = centerHtml([first, second], [{ ...comparison(), snapshotId: "z", actualDisclosureTimingStatus: "same_time", performanceDisclosureTimingStatus: "same_time", isExAnte: false, comparabilityStatus: "not_comparable", comparisonResult: "not_comparable", nonComparableReasons: ["预期可用时间与披露时间相同"] }]);
    expect(html).toContain("时间关系为 equal");
    expect(html).toContain("预测形成时间与披露时间相同，无法认定为披露前预测");
    expect(html).not.toContain("业务预测较前值 +");
  });
  it("uses the same declared record time zone in manual source and formedAt resolution", () => {
    expect(resolveSourcePublishedInput("2026-07-15T15:00", "Asia/Shanghai", false, "workflow_time_zone", "Asia/Tokyo")).toMatchObject({ value: "2026-07-15T06:00:00.000Z", resolution: "workflow_time_zone", interpretedTimeZone: "Asia/Tokyo", error: null });
    expect(resolveFormationInput("2026-07-15T00:30", "Asia/Shanghai", "2026-07-15", "workflow_time_zone", "Asia/Tokyo")).toMatchObject({ formedAt: "2026-07-14T15:30:00.000Z", resolution: "workflow_time_zone", interpretedTimeZone: "Asia/Tokyo", error: null });
  });
  it("renders import-time interpretation notes and record/workflow conflicts", () => {
    const html = renderToStaticMarkup(<Preview value={{ ...invalidPreview(), ok: true, mergeAllowed: true, replaceAllowed: true, invalidCount: 0, timeZoneNotes: [{ row: 2, field: "sourcePublishedAt", timeZone: "Asia/Tokyo", message: "使用记录时区 Asia/Tokyo 解释，而非当前工作流时区 Asia/Shanghai。" }] }} />);
    expect(html).toContain("sourcePublishedAt");
    expect(html).toContain("使用记录时区 Asia/Tokyo 解释");
    expect(html).toContain("Asia/Shanghai");
  });
  it("renders original and corrected temporal evidence plus the actual source interpretation zone", () => {
    const root = { ...snapshot(), id: "root-time", sourceCategory: "institution_single" as const, sourceName: "测试证券", sourceTitle: "盈利预测", sourceUrl: "https://example.com/report", sourcePublishedAt: "2026-06-01T07:00:00.000Z", sourcePublishedAtPrecision: "datetime" as const, sourcePublishedAtResolution: "absolute" as const, asOfDate: "2026-06-01", formedAt: "2026-06-01T08:00:00.000Z", formedAtPrecision: "datetime" as const, formedAtResolution: "absolute" as const };
    const correction = { ...root, id: "corrected-time", correctsSnapshotId: "root-time", correctionScope: "value" as const, sourcePublishedAt: "2026-06-01T06:00:00.000Z", sourcePublishedAtResolution: "workflow_time_zone" as const, sourcePublishedAtTimeZone: "Asia/Tokyo", formedAt: "2026-06-01T09:00:00.000Z", createdAt: "2026-07-15T04:00:00.000Z" };
    const html = renderToStaticMarkup(<EarningsExpectationCenter {...centerProps()} timeZone="Asia/Shanghai" snapshots={[root, correction]} comparisons={[]} />);
    expect(html).toContain("时间字段已纠正");
    expect(html).toContain("原记录业务时间");
    expect(html).toContain("纠正后有效业务时间");
    expect(html).toContain("来源时间实际按记录时区 Asia/Tokyo 解释");
  });
});

function centerHtml(values: EarningsExpectationSnapshot[], comparisons: EarningsExpectationComparison[] = []) { return renderToStaticMarkup(<EarningsExpectationCenter {...centerProps()} snapshots={values} comparisons={comparisons} />); }
function centerProps() { return { snapshots: [] as EarningsExpectationSnapshot[], comparisons: [] as EarningsExpectationComparison[], importHistory: [], stocks: [stock()], industries: [{ id: "tech", name: "科技", segments: [] }] as never[], watchItems: [watchItem()], onAdd: () => undefined, onCorrect: () => undefined, onImport: () => undefined, onOpenStock: () => undefined }; }
function stock() { return { id: "demo", name: "测试公司", code: "000001.SZ", market: "A股", industryId: "tech", segmentId: "segment", dataMode: "mixed" } as Stock; }
function snapshot(): EarningsExpectationSnapshot { return { id: "s-1", stockId: "demo", market: "A股", reportPeriod: "2026-06-30", periodScope: "half_year", metric: "revenue", estimateShape: "point", value: 100, lowerBound: null, upperBound: null, currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "user_estimate", sourceName: "用户个人预测", sourceTitle: "", sourceUrl: null, sourcePublishedAt: null, sourcePublishedAtPrecision: null, sourcePublishedAtResolution: null, sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: null, asOfDate: "2026-06-01", formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: "2026-06-01", analystCount: null, institutionCount: null, ingestionMethod: "manual", createdAt: "2026-06-01T00:00:00.000Z", createdBy: "local-user", sourceVerificationStatus: "verified", notes: null, correctsSnapshotId: null, correctionScope: null, schemaVersion: 2 }; }
function comparison(): EarningsExpectationComparison { return { id: "c-1", snapshotId: "s-1", actualEventId: "actual-1", stockId: "demo", reportPeriod: "2026-06-30", periodScope: "half_year", metric: "revenue", expectedValue: 100, expectedLowerBound: null, expectedUpperBound: null, actualValue: 120, absoluteDifference: 20, relativeDifference: 0.2, comparisonResult: "above", comparisonMethod: "点预测：实际值减预期值", isExAnte: true, beforeActualDisclosure: true, beforeAnyPerformanceDisclosure: true, actualDisclosureAt: "2026-07-01T08:00:00.000Z", performanceInformationCutoff: "2026-07-01T08:00:00.000Z", comparisonAvailableAt: "2026-07-01T08:00:00.000Z", comparabilityStatus: "comparable", nonComparableReasons: [], calculatedAt: "2026-07-01" }; }
function watchItem(): WatchItem { return { id: "watch-1", stockId: "demo", createdAt: "2026-05-01", updatedAt: "2026-05-01", status: "观察", priority: "high", tags: [], reason: "跟踪", thesis: "假设", validationCriteria: [], riskCriteria: [], nextReviewAt: null, lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 }; }
function researchEvent(id: string, eventType: ResearchEvent["eventType"]): ResearchEvent { return { id, stockId: "demo", stockName: "测试公司", stockCode: "000001.SZ", industryId: "tech", market: "A股", eventType, eventDate: "2026-07-01", publishedAt: "2026-07-01", reportPeriod: "2026-06-30", title: "正式财务", summary: "正式财务", sourceType: "financial_report", sourceName: "正式来源", sourceUrl: "https://example.com/actual", pdfUrl: null, verificationStatus: "verified", parseStatus: "not_applicable", materiality: "high", metrics: [], relatedAnnouncementIds: [], relatedFinancialPeriod: "2026-06-30", reviewStatus: "not_required", reviewReasons: [], isRestated: false, updatedAt: "2026-07-01" }; }
function invalidPreview() { return { ok: false, mergeAllowed: false, replaceAllowed: false, partial: false, schemaVersion: 1, totalCount: 0, validCount: 0, addCount: 0, skippedCount: 0, duplicateCount: 0, conflictCount: 0, invalidCount: 1, issues: [{ row: 0, code: "invalid", message: "无效" }], timeZoneNotes: [], snapshots: [] }; }
