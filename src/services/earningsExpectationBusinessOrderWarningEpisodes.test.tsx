import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EarningsExpectationCenter } from "../components/expectation/EarningsExpectationCenter";
import { StockEarningsExpectationPanel } from "../components/expectation/StockEarningsExpectationPanel";
import type { EarningsExpectationSnapshot, ResearchEvent, Stock, WatchItem } from "../types";
import { buildEarningsExpectationComparisons } from "./earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "./earningsExpectationEventProvider";
import { createEmptyEarningsExpectationEnvelope, EarningsExpectationRepository } from "./earningsExpectationRepository";
import { buildReviewTasks } from "./reviewTaskProvider";

const NOW = new Date("2026-07-31T12:00:00.000Z");
const DISPLAY_ZONES = ["Asia/Shanghai", "UTC", "America/New_York"];

describe("business-order warning episodes", () => {
  it("keeps a valid actual comparison and an ambiguous predecessor warning for C at the same time", () => {
    const snapshots = ambiguousSnapshots();
    const comparisons = buildEarningsExpectationComparisons(snapshots, [actualEvent()]);
    const comparison = comparisons.find((item) => item.businessRootSnapshotId === "c");
    expect(comparison).toMatchObject({ comparabilityStatus: "comparable", comparisonResult: "above" });

    const events = buildEarningsExpectationResearchEvents(snapshots, comparisons, [stock()]);
    const warning = businessOrderWarning(events);
    expect(events.some((event) => event.eventType === "earnings_expectation_comparison_available" && event.expectation?.businessRootSnapshotId === "c")).toBe(true);
    expect(events.some((event) => event.eventType === "earnings_expectation_revision" && event.expectation?.businessRootSnapshotId === "c")).toBe(false);
    expect(warning.expectation).toMatchObject({
      warningFamily: "business_order",
      previousResolutionStatus: "ambiguous",
      businessRootSnapshotId: "c",
      effectiveSnapshotId: "c",
      structuredWarningCodes: ["business_order_ambiguous"],
      nonComparableReasonCodes: ["business_order_ambiguous"],
      previousCandidateIds: ["a", "b"],
      previousCandidateEffectiveSnapshotIds: ["a", "b"],
    });
    expect(warning.expectation?.availableAt).toBeDefined();
    const task = warningTask(events);
    expect(task).toMatchObject({ status: "pending", ruleType: "earnings_expectation_data_warning" });
    expect(task.description).toContain("候选 2 条");
    expect(task.description).toContain("共同预测源");
  });

  it("keeps payload candidate order and warning identity deterministic for shuffled inputs", () => {
    const snapshots = ambiguousSnapshots();
    const first = businessOrderWarning(buildEarningsExpectationResearchEvents(snapshots, buildEarningsExpectationComparisons(snapshots, [actualEvent()]), [stock()]));
    const shuffled = [snapshots[2], snapshots[0], snapshots[1]];
    const second = businessOrderWarning(buildEarningsExpectationResearchEvents(shuffled, buildEarningsExpectationComparisons(shuffled, [actualEvent()]), [stock()]));
    expect(second.id).toBe(first.id);
    expect(second.warningEpisodeKey).toBe(first.warningEpisodeKey);
    expect(second.expectation?.previousCandidateIds).toEqual(["a", "b"]);
    expect(second.expectation?.businessOrderCandidates?.map((candidate) => candidate.businessRootSnapshotId)).toEqual(["a", "b"]);
  });

  it("keeps one continuous warning, task and activation instant through an unrelated C value correction", () => {
    const originalSnapshots = ambiguousSnapshots();
    const originalEvents = buildEarningsExpectationResearchEvents(originalSnapshots, [], [stock()]);
    const original = businessOrderWarning(originalEvents);
    const originalTask = warningTask(originalEvents);
    const correctedSnapshots = [...originalSnapshots, correction(originalSnapshots[2], "c-value", {
      value: 125,
      correctionScope: "value",
      createdAt: "2026-01-04T00:00:00.000Z",
    })];
    const correctedEvents = buildEarningsExpectationResearchEvents(correctedSnapshots, [], [stock()]);
    const continued = businessOrderWarning(correctedEvents);
    const continuedTask = warningTask(correctedEvents, [{
      taskId: originalTask.id,
      status: "acknowledged",
      acknowledgedAt: "2026-01-04T08:00:00.000Z",
      dismissedAt: null,
      snoozedUntil: null,
      updatedAt: "2026-01-04T08:00:00.000Z",
    }]);
    expect(continued.id).toBe(original.id);
    expect(continued.warningEpisodeKey).toBe(original.warningEpisodeKey);
    expect(continued.stateActivatedAt).toBe(original.stateActivatedAt);
    expect(continuedTask).toMatchObject({ id: originalTask.id, status: "acknowledged" });
    expect(continued.expectation?.effectiveSnapshotId).toBe("c-value");
  });

  it("resolves and reactivates ambiguity as a new episode without inheriting the old task state", () => {
    const base = ambiguousSnapshots();
    const initialEvents = buildEarningsExpectationResearchEvents(base, [], [stock()]);
    const initialWarning = businessOrderWarning(initialEvents);
    const initialTask = warningTask(initialEvents);
    const resolved = [...base, correction(base[1], "b-after-c", {
      ...preciseFormation("2026-01-03T08:00:00.000Z", "2026-01-03"),
      correctionScope: "value",
      createdAt: "2026-01-04T00:00:00.000Z",
    })];
    expect(findBusinessOrderWarning(buildEarningsExpectationResearchEvents(resolved, [], [stock()]))).toBeUndefined();

    const reactivated = [...resolved, correction(resolved[3], "b-back-to-date", {
      asOfDate: "2026-01-01",
      formedAt: null,
      formedAtPrecision: "date",
      formedAtResolution: "date",
      formedAtTimeZone: null,
      formedAtCalendarDate: "2026-01-01",
      correctionScope: "value",
      createdAt: "2026-01-05T00:00:00.000Z",
    })];
    const nextEvents = buildEarningsExpectationResearchEvents(reactivated, [], [stock()]);
    const nextWarning = businessOrderWarning(nextEvents);
    const nextTask = warningTask(nextEvents, [{
      taskId: initialTask.id,
      status: "dismissed",
      acknowledgedAt: null,
      dismissedAt: "2026-01-03T12:00:00.000Z",
      snoozedUntil: null,
      updatedAt: "2026-01-03T12:00:00.000Z",
    }]);
    expect(nextWarning.id).not.toBe(initialWarning.id);
    expect(nextWarning.warningEpisodeKey).not.toBe(initialWarning.warningEpisodeKey);
    expect(nextWarning.expectation?.warningActivationEntityIds).toEqual(["b-back-to-date"]);
    expect(nextTask.id).not.toBe(initialTask.id);
    expect(nextTask.status).toBe("pending");
  });

  it.each([
    {
      label: "equal-time",
      expectedCode: "business_order_equal",
      initial: () => [
        snapshot("a", { ...preciseFormation("2026-01-01T08:00:00.000Z", "2026-01-01"), createdAt: "2026-01-01T09:00:00.000Z" }),
        snapshot("b", { ...preciseFormation("2026-01-01T08:00:00.000Z", "2026-01-01"), createdAt: "2026-01-02T09:00:00.000Z" }),
        snapshot("c", { ...preciseFormation("2026-01-02T08:00:00.000Z", "2026-01-02"), value: 120, createdAt: "2026-01-03T09:00:00.000Z" }),
      ],
      restore: preciseFormation("2026-01-01T08:00:00.000Z", "2026-01-01"),
    },
    {
      label: "unresolved legacy",
      expectedCode: "business_order_unresolved",
      initial: () => [
        snapshot("a", { ...preciseFormation("2026-01-01T08:00:00.000Z", "2026-01-01"), createdAt: "2026-01-01T09:00:00.000Z" }),
        snapshot("b", { ...legacyFormation("2026-01-01T09:00", "2026-01-01"), createdAt: "2026-01-02T09:00:00.000Z" }),
        snapshot("c", { ...preciseFormation("2026-01-02T08:00:00.000Z", "2026-01-02"), value: 120, createdAt: "2026-01-03T09:00:00.000Z" }),
      ],
      restore: legacyFormation("2026-01-01T10:00", "2026-01-01"),
    },
  ])("resolves and starts a new $label episode after the relationship is reintroduced", ({ expectedCode, initial, restore }) => {
    const base = initial();
    const first = businessOrderWarning(buildEarningsExpectationResearchEvents(base, [], [stock()]));
    expect(first.expectation?.structuredWarningCodes).toEqual([expectedCode]);
    expect(first.expectation?.previousCandidateIds).toEqual(expectedCode === "business_order_unresolved" ? ["b"] : ["a", "b"]);
    const resolved = [...base, correction(base[1], "b-resolved", {
      ...preciseFormation("2026-01-03T08:00:00.000Z", "2026-01-03"),
      correctionScope: "value",
      createdAt: "2026-01-04T00:00:00.000Z",
    })];
    expect(findBusinessOrderWarning(buildEarningsExpectationResearchEvents(resolved, [], [stock()]))).toBeUndefined();
    const reactivated = [...resolved, correction(resolved[3], "b-reactivated", {
      ...restore,
      correctionScope: "value",
      createdAt: "2026-01-05T00:00:00.000Z",
    })];
    const next = businessOrderWarning(buildEarningsExpectationResearchEvents(reactivated, [], [stock()]));
    expect(next.expectation?.structuredWarningCodes).toEqual([expectedCode]);
    expect(next.id).not.toBe(first.id);
    expect(next.expectation?.warningActivationEntityIds).toEqual(["b-reactivated"]);
  });

  it("keeps the business-order episode isolated from actual-value warning changes", () => {
    const snapshots = ambiguousSnapshots();
    const missingComparisons = buildEarningsExpectationComparisons(snapshots, []);
    const missingEvents = buildEarningsExpectationResearchEvents(snapshots, missingComparisons, [stock()]);
    const missingBusinessOrder = businessOrderWarning(missingEvents);
    expect(missingEvents.some((event) => event.expectation?.structuredWarningCodes?.includes("actual_value_unavailable"))).toBe(true);

    const comparableEvents = buildEarningsExpectationResearchEvents(snapshots, buildEarningsExpectationComparisons(snapshots, [actualEvent()]), [stock()]);
    const comparableBusinessOrder = businessOrderWarning(comparableEvents);
    expect(comparableBusinessOrder.id).toBe(missingBusinessOrder.id);
    expect(comparableBusinessOrder.warningEpisodeKey).toBe(missingBusinessOrder.warningEpisodeKey);
    expect(comparableEvents.some((event) => event.expectation?.structuredWarningCodes?.includes("actual_value_unavailable"))).toBe(false);
  });

  it("survives repository reload and display-zone changes and renders structured candidate guidance in both panels", () => {
    const snapshots = ambiguousSnapshots();
    const storage = new MemoryStorage();
    const repository = new EarningsExpectationRepository(storage, () => NOW);
    const envelope = { ...createEmptyEarningsExpectationEnvelope(NOW), snapshots, updatedAt: "2026-01-03T09:00:00.000Z" };
    expect(repository.save(envelope).ok).toBe(true);
    const reloaded = repository.load().data.snapshots;
    const identities = DISPLAY_ZONES.map((zone) => {
      const comparisons = buildEarningsExpectationComparisons(reloaded, [actualEvent()], { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: zone });
      const warning = businessOrderWarning(buildEarningsExpectationResearchEvents(reloaded, comparisons, [stock()], 0.1, zone));
      return { id: warning.id, key: warning.warningEpisodeKey, activatedAt: warning.stateActivatedAt };
    });
    expect(identities.every((identity) => JSON.stringify(identity) === JSON.stringify(identities[0]))).toBe(true);

    const comparisons = buildEarningsExpectationComparisons(reloaded, [actualEvent()]);
    const events = buildEarningsExpectationResearchEvents(reloaded, comparisons, [stock()]);
    const centerHtml = renderToStaticMarkup(<EarningsExpectationCenter
      snapshots={reloaded}
      comparisons={comparisons}
      researchEvents={events}
      importHistory={[]}
      stocks={[stock()]}
      industries={[]}
      watchItems={[]}
      onAdd={() => undefined}
      onCorrect={() => undefined}
      onImport={() => undefined}
      onOpenStock={() => undefined}
    />);
    const panelHtml = renderToStaticMarkup(<StockEarningsExpectationPanel
      stock={stock()}
      snapshots={reloaded}
      financialData={null}
      announcementData={null}
      financialLoadStatus="idle"
      announcementLoadStatus="idle"
    />);
    expect(centerHtml).toContain("当前预测可以与实际值比较");
    expect(centerHtml).toContain("候选前序 2 条");
    expect(centerHtml).toContain("共同预测源");
    expect(centerHtml).toContain("无法计算上修或下修");
    expect(panelHtml).toContain("候选前序 2 条");
    expect(panelHtml).toContain("稳定 ID 排序不作为业务先后依据");
  });
});

function ambiguousSnapshots() {
  return [
    snapshot("a", { asOfDate: "2026-01-01", formedAtCalendarDate: "2026-01-01", value: 100, createdAt: "2026-01-01T09:00:00.000Z" }),
    snapshot("b", { asOfDate: "2026-01-01", formedAtCalendarDate: "2026-01-01", value: 130, createdAt: "2026-01-02T09:00:00.000Z" }),
    snapshot("c", { ...preciseFormation("2026-01-02T08:00:00.000Z", "2026-01-02"), value: 120, createdAt: "2026-01-03T09:00:00.000Z" }),
  ];
}

function snapshot(id: string, overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
  const value: EarningsExpectationSnapshot = {
    id,
    stockId: "demo",
    market: "A股",
    reportPeriod: "2026-06-30",
    periodScope: "half_year",
    metric: "revenue",
    estimateShape: "point",
    value: 100,
    lowerBound: null,
    upperBound: null,
    currency: "CNY",
    unit: "yuan",
    accountingBasis: "PRC_GAAP",
    sourceCategory: "user_estimate",
    sourceName: "共同预测源",
    sourceTitle: "内部预测记录",
    sourceUrl: "https://example.com/evidence",
    sourcePublishedAt: null,
    sourcePublishedAtPrecision: null,
    sourcePublishedAtResolution: null,
    sourcePublishedAtTimeZone: null,
    sourcePublishedAtCalendarDate: null,
    asOfDate: "2026-01-01",
    formedAt: null,
    formedAtPrecision: "date",
    formedAtResolution: "date",
    formedAtTimeZone: null,
    formedAtCalendarDate: "2026-01-01",
    analystCount: null,
    institutionCount: null,
    ingestionMethod: "manual",
    createdAt: "2026-01-01T09:00:00.000Z",
    createdBy: "local-user",
    sourceVerificationStatus: "verified",
    notes: null,
    correctsSnapshotId: null,
    correctionScope: null,
    schemaVersion: 2,
    ...overrides,
  };
  return value;
}

function correction(target: EarningsExpectationSnapshot, id: string, overrides: Partial<EarningsExpectationSnapshot>) {
  return snapshot(id, { ...target, id, correctsSnapshotId: target.id, ...overrides });
}

function preciseFormation(instant: string, businessDate: string): Partial<EarningsExpectationSnapshot> {
  return { asOfDate: businessDate, formedAt: instant, formedAtPrecision: "datetime", formedAtResolution: "absolute", formedAtTimeZone: "UTC", formedAtCalendarDate: businessDate };
}

function legacyFormation(wallClock: string, businessDate: string): Partial<EarningsExpectationSnapshot> {
  return { asOfDate: businessDate, formedAt: wallClock, formedAtPrecision: "datetime", formedAtResolution: "unresolved_legacy", formedAtTimeZone: null, formedAtCalendarDate: businessDate };
}

function actualEvent(): ResearchEvent {
  return {
    id: "actual",
    stockId: "demo",
    stockName: "测试公司",
    stockCode: "000001.SZ",
    industryId: "tech",
    market: "A股",
    eventType: "periodic_report",
    eventDate: "2026-01-03",
    publishedAt: "2026-01-03T08:00:00.000Z",
    reportPeriod: "2026-06-30",
    title: "正式报告",
    summary: "正式披露",
    sourceType: "financial_report",
    sourceName: "交易所",
    sourceUrl: "https://example.com/filing",
    pdfUrl: null,
    verificationStatus: "verified",
    parseStatus: "parse_success",
    materiality: "high",
    metrics: [{ key: "operatingRevenue", label: "营业收入", value: 140, unit: "CNY", periodBasis: "cumulative", sourceAnnouncementId: "actual", sourceFinancialPeriod: "2026-06-30" }],
    performanceDisclosureScope: "all_metrics",
    relatedAnnouncementIds: ["actual"],
    relatedFinancialPeriod: "2026-06-30",
    reviewStatus: "pending",
    reviewReasons: [],
    isRestated: false,
    updatedAt: "2026-01-03T08:00:00.000Z",
  };
}

function stock() {
  return { id: "demo", name: "测试公司", code: "000001.SZ", market: "A股", industryId: "tech" } as Stock;
}

function watchItem(): WatchItem {
  return { id: "watch", stockId: "demo", createdAt: "2025-12-01", updatedAt: "2025-12-01", status: "观察", priority: "medium", tags: [], reason: "跟踪", thesis: "假设", validationCriteria: [], riskCriteria: [], nextReviewAt: null, lastReviewedAt: "2025-12-01", archivedAt: null, source: "user", schemaVersion: 2 };
}

function findBusinessOrderWarning(events: ResearchEvent[]) {
  return events.find((event) => event.eventType === "earnings_expectation_data_warning" && event.expectation?.warningFamily === "business_order");
}

function businessOrderWarning(events: ResearchEvent[]) {
  const warning = findBusinessOrderWarning(events);
  expect(warning).toBeDefined();
  return warning as ResearchEvent;
}

function warningTask(events: ResearchEvent[], taskStates: Parameters<typeof buildReviewTasks>[0]["taskStates"] = []) {
  const task = buildReviewTasks({ watchItems: [watchItem()], events, chains: [], taskStates, now: NOW })
    .find((candidate) => candidate.ruleType === "earnings_expectation_data_warning" && candidate.relatedEventIds.some((id) => id === findBusinessOrderWarning(events)?.id));
  expect(task).toBeDefined();
  return task!;
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
