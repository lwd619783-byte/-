import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  EarningsExpectationSnapshot,
  EarningsExpectationSourceCategory,
  ResearchEvent,
  Stock,
  WatchItem,
} from "../types";
import { EarningsExpectationTemporalAudit } from "../components/expectation/EarningsExpectationTemporalAudit";
import { buildEarningsExpectationComparisons, compareEarningsExpectation } from "./earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "./earningsExpectationEventProvider";
import {
  getExpectationAvailability,
  resolveEffectiveBusinessHistory,
  resolveUniquePreviousBusinessNode,
  selectEffectiveEarningsExpectations,
  validateEarningsExpectationCorrectionGraph,
} from "./earningsExpectationIntegrity";
import {
  EarningsExpectationRepository,
  createEmptyEarningsExpectationEnvelope,
  migrateEarningsExpectationEnvelope,
} from "./earningsExpectationRepository";
import { EarningsExpectationStore } from "./earningsExpectationStore";
import { buildReviewTasks } from "./reviewTaskProvider";

const ZONES = ["Asia/Shanghai", "Asia/Tokyo", "UTC", "America/New_York", "Europe/London"];
const NOW = new Date("2026-07-31T12:00:00.000Z");

describe("earnings expectation final invariant matrix", () => {
  it("keeps a Tokyo 00:30 record, current selection, event and acknowledged task stable across five display zones", () => {
    const tokyo = snapshot("tokyo", {
      asOfDate: "2026-07-15",
      formedAt: "2026-07-14T15:30:00.000Z",
      formedAtPrecision: "datetime",
      formedAtResolution: "workflow_time_zone",
      formedAtTimeZone: "Asia/Tokyo",
      formedAtCalendarDate: "2026-07-15",
    });
    const baselineEvents = buildEarningsExpectationResearchEvents([tokyo], [], [stock()], 0.1, ZONES[0]);
    const baselineTask = buildReviewTasks({ watchItems: [watchItem()], events: baselineEvents, chains: [], taskStates: [], now: NOW, timeZone: ZONES[0] })[0];
    expect(baselineTask).toBeDefined();
    for (const zone of ZONES) {
      const selection = selectEffectiveEarningsExpectations([tokyo], zone)[0];
      const events = buildEarningsExpectationResearchEvents([tokyo], [], [stock()], 0.1, zone);
      const tasks = buildReviewTasks({
        watchItems: [watchItem()],
        events,
        chains: [],
        taskStates: [{ taskId: baselineTask.id, status: "acknowledged", acknowledgedAt: "2026-07-16", dismissedAt: null, snoozedUntil: null, updatedAt: "2026-07-16" }],
        now: NOW,
        timeZone: zone,
      });
      expect(selection).toMatchObject({ snapshot: { id: "tokyo" }, formationTime: { instant: "2026-07-14T15:30:00.000Z", businessCalendarDate: "2026-07-15" } });
      expect(events.map(({ id, eventDate }) => ({ id, eventDate }))).toEqual(baselineEvents.map(({ id, eventDate }) => ({ id, eventDate })));
      expect(tasks[0]).toMatchObject({ id: baselineTask.id, status: "acknowledged" });
    }
  });

  it("keeps date-only business dates independent of every display zone", () => {
    const dated = snapshot("date-only", { asOfDate: "2026-07-15", formedAtCalendarDate: "2026-07-15" });
    const resolutions = ZONES.map((zone) => selectEffectiveEarningsExpectations([dated], zone)[0].availableAt);
    for (const resolution of resolutions) {
      expect(resolution).toMatchObject({
        status: "resolved",
        value: { businessCalendarDate: "2026-07-15", instant: null, status: "date_only" },
        decisiveSide: "formation",
        bounds: {
          businessDateMin: "2026-07-15",
          businessDateMax: "2026-07-15",
          earliest: { edge: "start", businessCalendarDate: "2026-07-15" },
          latest: { edge: "end", businessCalendarDate: "2026-07-15" },
        },
      });
    }
  });

  it("never reinterprets unresolved legacy wall clocks with a new workflow zone", () => {
    const legacy = externalSnapshot("legacy", "institution_single", {
      asOfDate: "2026-07-15",
      formedAt: "2026-07-15T09:00",
      formedAtPrecision: "datetime",
      formedAtResolution: "unresolved_legacy",
      formedAtTimeZone: null,
      formedAtCalendarDate: "2026-07-15",
      sourcePublishedAt: "2026-07-15T10:00",
      sourcePublishedAtPrecision: "datetime",
      sourcePublishedAtResolution: "unresolved_legacy",
      sourcePublishedAtTimeZone: null,
      sourcePublishedAtCalendarDate: "2026-07-15",
    });
    for (const zone of ZONES) {
      const selection = selectEffectiveEarningsExpectations([legacy], zone)[0];
      expect(selection.availableAt).toMatchObject({ status: "uncertain", reason: "legacy_time_zone_unknown" });
      expect(selection.snapshot.formedAt).toBe("2026-07-15T09:00");
    }
  });

  it.each([
    ["date/date", externalSnapshot("dd", "company_guidance", { asOfDate: "2026-07-14", formedAtCalendarDate: "2026-07-14", sourcePublishedAt: "2026-07-15", sourcePublishedAtPrecision: "date", sourcePublishedAtResolution: "date", sourcePublishedAtCalendarDate: "2026-07-15" }), "resolved", "source"],
    ["datetime/datetime", externalSnapshot("tt", "institution_single", preciseExternalTimes()), "resolved", "source"],
    ["date/datetime", externalSnapshot("dt", "institution_consensus", { asOfDate: "2026-07-15", formedAtCalendarDate: "2026-07-15", sourcePublishedAt: "2026-07-14T17:00:00.000Z", sourcePublishedAtPrecision: "datetime", sourcePublishedAtResolution: "workflow_time_zone", sourcePublishedAtTimeZone: "Asia/Tokyo", sourcePublishedAtCalendarDate: "2026-07-15" }), "uncertain", null],
    ["datetime/date", externalSnapshot("td", "company_guidance", { asOfDate: "2026-07-15", formedAt: "2026-07-14T15:30:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "workflow_time_zone", formedAtTimeZone: "Asia/Tokyo", formedAtCalendarDate: "2026-07-15", sourcePublishedAt: "2026-07-15", sourcePublishedAtPrecision: "date", sourcePublishedAtResolution: "date", sourcePublishedAtCalendarDate: "2026-07-15" }), "uncertain", null],
  ])("preserves %s availability precision", (_label, value, status, decisiveSide) => {
    const availability = getExpectationAvailability(value);
    expect(availability.status).toBe(status);
    if (availability.status === "resolved") expect(availability.decisiveSide).toBe(decisiveSide);
  });

  it.each(["company_guidance", "institution_single", "institution_consensus"] as EarningsExpectationSourceCategory[])("uses max(formedAt, sourcePublishedAt) for %s", (category) => {
    expect(getExpectationAvailability(externalSnapshot(category, category, preciseExternalTimes()))).toMatchObject({ status: "resolved", decisiveSide: "source", value: { instant: "2026-07-14T17:00:00.000Z", businessCalendarDate: "2026-07-15" } });
  });

  it("uses formedAt alone for a user estimate", () => {
    const value = snapshot("user", { asOfDate: "2026-07-15", formedAt: "2026-07-14T15:30:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "workflow_time_zone", formedAtTimeZone: "Asia/Tokyo", formedAtCalendarDate: "2026-07-15" });
    expect(getExpectationAvailability(value)).toMatchObject({ status: "resolved", decisiveSide: "formation", value: { instant: "2026-07-14T15:30:00.000Z" } });
  });

  it("does not choose a direction for A and B on the same date before C, regardless of input order or IDs", () => {
    const a = snapshot("a", { asOfDate: "2026-07-14", formedAtCalendarDate: "2026-07-14", value: 100 });
    const b = snapshot("z", { asOfDate: "2026-07-14", formedAtCalendarDate: "2026-07-14", value: 130 });
    const c = snapshot("c", { asOfDate: "2026-07-15", formedAtCalendarDate: "2026-07-15", value: 120 });
    const first = buildEarningsExpectationResearchEvents([a, b, c], [], [stock()]);
    const shuffled = buildEarningsExpectationResearchEvents([c, b, a], [], [stock()]);
    expect(first.map((event) => event.id)).toEqual(shuffled.map((event) => event.id));
    expect(first.some((event) => event.eventType === "earnings_expectation_revision")).toBe(false);
    expect(first.filter((event) => event.eventType === "earnings_expectation_data_warning")).toHaveLength(1);
  });

  it("finds the unique maximal predecessor and recovers a revision after exact times are supplied", () => {
    const a = snapshot("a", preciseFormation("2026-07-14T01:00:00.000Z", "2026-07-14", { value: 100 }));
    const b = snapshot("b", preciseFormation("2026-07-14T02:00:00.000Z", "2026-07-14", { value: 110 }));
    const c = snapshot("c", preciseFormation("2026-07-15T01:00:00.000Z", "2026-07-15", { value: 120 }));
    const nodes = resolveEffectiveBusinessHistory([c, a, b]);
    expect(resolveUniquePreviousBusinessNode(nodes[2], nodes)).toMatchObject({ status: "unique", previousNode: { businessRootSnapshot: { id: "b" } } });
    const revision = buildEarningsExpectationResearchEvents([c, b, a], [], [stock()]).find((event) => event.eventType === "earnings_expectation_revision" && event.expectation?.businessRootSnapshotId === "c");
    expect(revision?.expectation?.businessRevisionDelta).toMatchObject({ previousBusinessRootSnapshotId: "b", baselineValue: 110, direction: "up" });
  });

  it("keeps a multi-level correction terminal and its numerical baseline stable across zones", () => {
    const root = snapshot("root", { asOfDate: "2026-07-01", formedAtCalendarDate: "2026-07-01", value: 100, createdAt: "2026-07-01T01:00:00.000Z" });
    const correction = snapshot("correction", { ...root, id: "correction", correctsSnapshotId: "root", correctionScope: "value", value: 110, createdAt: "2026-07-02T01:00:00.000Z" });
    const terminal = snapshot("terminal", { ...correction, id: "terminal", correctsSnapshotId: "correction", value: 115, createdAt: "2026-07-03T01:00:00.000Z" });
    const next = snapshot("next", { asOfDate: "2026-07-10", formedAtCalendarDate: "2026-07-10", value: 125, createdAt: "2026-07-10T01:00:00.000Z" });
    for (const zone of ZONES) {
      const history = resolveEffectiveBusinessHistory([next, terminal, root, correction], zone);
      expect(history.map((node) => [node.businessRootSnapshot.id, node.effectiveSnapshot.id])).toEqual([["root", "terminal"], ["next", "next"]]);
      const revision = buildEarningsExpectationResearchEvents([terminal, next, correction, root], [], [stock()], 0.1, zone).find((event) => event.eventType === "earnings_expectation_revision");
      expect(revision?.expectation?.businessRevisionDelta).toMatchObject({ baselineValue: 115, previousEffectiveSnapshotId: "terminal" });
    }
  });

  it("keeps correction and comparison exact occurrences stable while deriving correction display dates from the chosen zone", () => {
    const root = snapshot("root", { ...preciseFormation("2026-06-01T08:00:00.000Z", "2026-06-01"), createdAt: "2026-06-01T09:00:00.000Z" });
    const correction = snapshot("correction", { ...root, id: "correction", correctsSnapshotId: "root", correctionScope: "value", value: 105, createdAt: "2026-07-03T23:30:00.000Z" });
    const actual = confirmedDisclosure("actual", "2026-06-20T23:30:00.000Z");
    const baseline = ZONES.map((zone) => {
      const comparisons = buildEarningsExpectationComparisons([root, correction], [actual], { revisionReminderThreshold: 0.1, nearZeroThreshold: 1e-9, roundingTolerance: 1e-9, timeZone: zone }, "2026-07-31T00:00:00.000Z");
      const events = buildEarningsExpectationResearchEvents([root, correction], comparisons, [stock()], 0.1, zone);
      return events.filter((event) => event.eventType === "earnings_expectation_correction" || event.eventType === "earnings_expectation_comparison_available").map((event) => ({ id: event.id, eventDate: event.eventDate, publishedAt: event.publishedAt }));
    });
    const eventIdentityAndOccurrence = baseline.map((events) => events.map(({ id, publishedAt }) => ({ id, publishedAt })));
    expect(eventIdentityAndOccurrence.every((value) => JSON.stringify(value) === JSON.stringify(eventIdentityAndOccurrence[0]))).toBe(true);
    expect(baseline[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventDate: "2026-07-04", publishedAt: "2026-07-03T23:30:00.000Z" }),
      expect.objectContaining({ eventDate: "2026-06-20", publishedAt: "2026-06-20T23:30:00.000Z" }),
    ]));
    expect(baseline[2]).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventDate: "2026-07-03", publishedAt: "2026-07-03T23:30:00.000Z" }),
    ]));
  });

  it("rejects future and backwards audit times with structured graph codes", () => {
    const root = snapshot("root", { createdAt: "2026-07-10T00:00:00.000Z" });
    const backwards = snapshot("backwards", { ...root, id: "backwards", correctsSnapshotId: "root", correctionScope: "value", value: 110, createdAt: "2026-07-09T00:00:00.000Z" });
    const future = snapshot("future", { createdAt: "2026-08-01T00:00:00.000Z" });
    expect(validateEarningsExpectationCorrectionGraph([root, backwards], { now: NOW }).issues.map((issue) => issue.code)).toContain("correction_time_before_target");
    expect(validateEarningsExpectationCorrectionGraph([future], { now: NOW }).issues.map((issue) => issue.code)).toContain("future_created_at");
  });

  it("keeps envelope updatedAt monotonic on an older manual business record", () => {
    const repository = new EarningsExpectationRepository(new MemoryStorage(), () => new Date("2026-07-15T00:00:00.000Z"));
    const store = new EarningsExpectationStore(repository, () => new Date("2026-07-15T00:00:00.000Z"), () => "older-business");
    const current = { ...createEmptyEarningsExpectationEnvelope(new Date("2026-07-20T00:00:00.000Z")), settings: { ...createEmptyEarningsExpectationEnvelope().settings, timeZone: "UTC" } };
    const result = store.appendSnapshot(current, createInput({ asOfDate: "2026-06-01", formedAtCalendarDate: "2026-06-01" }));
    expect(result.ok).toBe(true);
    expect(result.data.updatedAt).toBe("2026-07-20T00:00:00.000Z");
  });

  it("classifies exact duplicates, audit changes and content conflicts without silently losing verification upgrades", () => {
    const repository = new EarningsExpectationRepository(new MemoryStorage(), () => NOW);
    const pending = externalSnapshot("evidence", "institution_single", { ...preciseExternalTimes(), sourceVerificationStatus: "pending" });
    const current = { ...createEmptyEarningsExpectationEnvelope(NOW), snapshots: [pending] };
    const exact = repository.previewJson({ schemaVersion: 2, snapshots: [pending] }, current, importOptions());
    expect(exact).toMatchObject({ duplicateCount: 1, conflictCount: 0 });
    for (const change of [
      { id: "verified", sourceVerificationStatus: "verified" as const },
      { id: "analysts", analystCount: 2 },
      { id: "institutions", institutionCount: 1 },
      { id: "notes", notes: "补充核验" },
    ]) {
      const preview = repository.previewJson({ schemaVersion: 2, snapshots: [{ ...pending, ...change, createdAt: "2026-07-21T00:00:00.000Z" }] }, current, importOptions());
      expect(preview.conflictCount).toBe(1);
      expect(preview.issues.some((issue) => issue.code === "audit_metadata_changed")).toBe(true);
    }
    const content = repository.previewJson({ schemaVersion: 2, snapshots: [{ ...pending, id: "changed-value", value: 130, createdAt: "2026-07-21T00:00:00.000Z" }] }, current, importOptions());
    expect(content.issues.some((issue) => issue.code === "evidence_content_conflict")).toBe(true);
  });

  it("atomically rejects a failed future-time import and keeps the current envelope unchanged", () => {
    const storage = new MemoryStorage();
    const repository = new EarningsExpectationRepository(storage, () => NOW);
    const current = { ...createEmptyEarningsExpectationEnvelope(NOW), snapshots: [snapshot("existing")] };
    const preview = repository.previewJson({ schemaVersion: 2, snapshots: [snapshot("future", { createdAt: "2026-08-01T00:00:00.000Z" })] }, current, importOptions());
    const result = repository.importPreview(preview, current, "json_import", "merge");
    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(current.snapshots.map((item) => item.id)).toEqual(["existing"]);
  });

  it("keeps warning event and task identities stable when display reasons or their order change", () => {
    const value = externalSnapshot("warning", "institution_single", { ...preciseExternalTimes(), sourceVerificationStatus: "pending" });
    const comparison = compareEarningsExpectation(value, []);
    const variants = [
      { ...comparison, nonComparableReasons: ["原因甲", "原因乙"] },
      { ...comparison, nonComparableReasons: ["新的中文文案", "原因甲"] },
    ];
    const eventSets = variants.map((item) => buildEarningsExpectationResearchEvents([value], [item], [stock()]));
    const warnings = eventSets.map((events) => events.find((event) => event.eventType === "earnings_expectation_data_warning")!);
    expect(warnings[0].id).toBe(warnings[1].id);
    const firstTask = buildReviewTasks({ watchItems: [watchItem()], events: eventSets[0], chains: [], taskStates: [], now: NOW, timeZone: "UTC" }).find((task) => task.ruleType === "earnings_expectation_data_warning")!;
    const reloaded = buildReviewTasks({ watchItems: [watchItem()], events: eventSets[1], chains: [], taskStates: [{ taskId: firstTask.id, status: "dismissed", acknowledgedAt: null, dismissedAt: "2026-07-20", snoozedUntil: null, updatedAt: "2026-07-20" }], now: NOW, timeZone: "Asia/Tokyo" }).find((task) => task.id === firstTask.id);
    expect(reloaded?.status).toBe("dismissed");
  });

  it("keeps the same business event and ReviewTask identity when an earlier prediction is backfilled", () => {
    const current = snapshot("current", { asOfDate: "2026-07-15", formedAtCalendarDate: "2026-07-15", value: 120 });
    const earlier = snapshot("earlier", { asOfDate: "2026-07-10", formedAtCalendarDate: "2026-07-10", value: 100 });
    const firstEvents = buildEarningsExpectationResearchEvents([current], [], [stock()]);
    const nextEvents = buildEarningsExpectationResearchEvents([earlier, current], [], [stock()]);
    const firstBusiness = firstEvents.find((event) => event.expectation?.businessRootSnapshotId === "current")!;
    const nextBusiness = nextEvents.find((event) => event.expectation?.businessRootSnapshotId === "current")!;
    expect(firstBusiness.id).toBe(nextBusiness.id);
    expect(firstBusiness.expectation?.businessEventKey).toBe(nextBusiness.expectation?.businessEventKey);
    const firstTask = buildReviewTasks({ watchItems: [watchItem()], events: firstEvents, chains: [], taskStates: [], now: NOW })[0];
    const nextTask = buildReviewTasks({ watchItems: [watchItem()], events: nextEvents, chains: [], taskStates: [], now: NOW }).find((task) => task.relatedEventIds.includes(nextBusiness.id));
    expect(nextTask?.id).toBe(firstTask.id);
  });

  it("returns a confirmed decisive disclosure when confirmed evidence proves the prediction is after disclosure", () => {
    const value = snapshot("late", preciseFormation("2026-06-25T08:00:00.000Z", "2026-06-25"));
    const result = compareEarningsExpectation(value, [possibleDisclosure("possible", "2026-06-10T08:00:00.000Z"), confirmedDisclosure("confirmed", "2026-06-20T08:00:00.000Z")]);
    expect(result).toMatchObject({ performanceDisclosureTimingStatus: "after", decisiveDisclosureEvent: { eventId: "confirmed", category: "confirmed" }, earliestPossibleDisclosure: { eventId: "possible" }, earliestConfirmedDisclosure: { eventId: "confirmed" } });
  });

  it("keeps a prediction between possible and confirmed boundaries uncertain and labels possible evidence honestly in UI", () => {
    const value = snapshot("between", preciseFormation("2026-06-15T08:00:00.000Z", "2026-06-15"));
    const comparison = compareEarningsExpectation(value, [possibleDisclosure("possible", "2026-06-10T08:00:00.000Z"), confirmedDisclosure("confirmed", "2026-06-20T08:00:00.000Z")]);
    expect(comparison).toMatchObject({ performanceDisclosureTimingStatus: "unknown", performanceDisclosureUncertain: true, decisiveDisclosureEvent: { eventId: "possible", category: "possible" } });
    const html = renderToStaticMarkup(<EarningsExpectationTemporalAudit snapshot={value} comparison={comparison} displayTimeZone="UTC" />);
    expect(html).toContain("可能披露（范围待核验）");
    expect(html).not.toContain("已确认披露 · possible");
  });

  it("preserves null values through comparison, event payload and UI", () => {
    const value = snapshot("missing", { value: null });
    const comparison = compareEarningsExpectation(value, [confirmedDisclosure("confirmed", "2026-07-20T08:00:00.000Z", null)]);
    const events = buildEarningsExpectationResearchEvents([value], [comparison], [stock()]);
    expect(comparison.expectedValue).toBeNull();
    expect(comparison.actualValue).toBeNull();
    expect(events.find((event) => event.expectation)?.expectation?.expectedValue).toBeNull();
    expect(renderToStaticMarkup(<EarningsExpectationTemporalAudit snapshot={value} comparison={comparison} displayTimeZone="UTC" />)).not.toContain(">0<");
  });

  it("migrates V1 to V2 idempotently and LocalStorage reload preserves all derived identities", () => {
    const legacy = { ...createEmptyEarningsExpectationEnvelope(NOW), schemaVersion: 1, snapshots: [{ ...snapshot("legacy-date"), schemaVersion: 1, formedAtCalendarDate: undefined, sourcePublishedAtCalendarDate: undefined }] };
    const migrated = migrateEarningsExpectationEnvelope(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrateEarningsExpectationEnvelope(migrated)).toEqual(migrated);
    const storage = new MemoryStorage();
    const repository = new EarningsExpectationRepository(storage, () => NOW);
    expect(repository.save(migrated).ok).toBe(true);
    const reloaded = repository.load().data;
    const beforeEvents = buildEarningsExpectationResearchEvents(migrated.snapshots, [], [stock()]);
    const afterEvents = buildEarningsExpectationResearchEvents(reloaded.snapshots, [], [stock()]);
    expect(afterEvents).toEqual(beforeEvents);
  });
});

function snapshot(id: string, overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
  const result: EarningsExpectationSnapshot = {
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
    sourceName: "用户个人预测",
    sourceTitle: "",
    sourceUrl: null,
    sourcePublishedAt: null,
    sourcePublishedAtPrecision: null,
    sourcePublishedAtResolution: null,
    sourcePublishedAtTimeZone: null,
    sourcePublishedAtCalendarDate: null,
    asOfDate: "2026-07-15",
    formedAt: null,
    formedAtPrecision: "date",
    formedAtResolution: "date",
    formedAtTimeZone: null,
    formedAtCalendarDate: "2026-07-15",
    analystCount: null,
    institutionCount: null,
    ingestionMethod: "manual",
    createdAt: "2026-07-20T00:00:00.000Z",
    createdBy: "local-user",
    sourceVerificationStatus: "verified",
    notes: null,
    correctsSnapshotId: null,
    correctionScope: null,
    schemaVersion: 2,
    ...overrides,
  };
  if (!("formedAtCalendarDate" in overrides)) result.formedAtCalendarDate = result.asOfDate;
  if (!("sourcePublishedAtCalendarDate" in overrides)) result.sourcePublishedAtCalendarDate = result.sourcePublishedAt?.slice(0, 10) ?? null;
  return result;
}

function externalSnapshot(id: string, category: EarningsExpectationSourceCategory, overrides: Partial<EarningsExpectationSnapshot> = {}) {
  return snapshot(id, {
    sourceCategory: category,
    sourceName: category === "company_guidance" ? "测试公司" : "测试机构",
    sourceTitle: "正式预测材料",
    sourceUrl: "https://example.com/evidence",
    ...overrides,
  });
}

function preciseExternalTimes(): Partial<EarningsExpectationSnapshot> {
  return {
    asOfDate: "2026-07-15",
    formedAt: "2026-07-14T15:30:00.000Z",
    formedAtPrecision: "datetime",
    formedAtResolution: "workflow_time_zone",
    formedAtTimeZone: "Asia/Tokyo",
    formedAtCalendarDate: "2026-07-15",
    sourcePublishedAt: "2026-07-14T17:00:00.000Z",
    sourcePublishedAtPrecision: "datetime",
    sourcePublishedAtResolution: "workflow_time_zone",
    sourcePublishedAtTimeZone: "Asia/Tokyo",
    sourcePublishedAtCalendarDate: "2026-07-15",
  };
}

function preciseFormation(instant: string, businessDate: string, extra: Partial<EarningsExpectationSnapshot> = {}): Partial<EarningsExpectationSnapshot> {
  return { asOfDate: businessDate, formedAt: instant, formedAtPrecision: "datetime", formedAtResolution: "absolute", formedAtTimeZone: "UTC", formedAtCalendarDate: businessDate, ...extra };
}

function confirmedDisclosure(id: string, occurredAt: string, value: number | null = 120): ResearchEvent {
  return {
    id,
    stockId: "demo",
    stockName: "测试公司",
    stockCode: "000001.SZ",
    industryId: "tech",
    market: "A股",
    eventType: "periodic_report",
    eventDate: occurredAt.slice(0, 10),
    publishedAt: occurredAt,
    reportPeriod: "2026-06-30",
    title: "正式报告",
    summary: "正式披露",
    sourceType: "announcement",
    sourceName: "交易所",
    sourceUrl: "https://example.com/filing",
    pdfUrl: null,
    verificationStatus: "verified",
    parseStatus: value === null ? "metadata_only" : "parse_success",
    materiality: "high",
    metrics: value === null ? [] : [{ key: "operatingRevenue", label: "营业收入", value, unit: "CNY", periodBasis: "cumulative", sourceAnnouncementId: id, sourceFinancialPeriod: "2026-06-30" }],
    relatedAnnouncementIds: [id],
    relatedFinancialPeriod: "2026-06-30",
    reviewStatus: "pending",
    reviewReasons: [],
    isRestated: false,
    updatedAt: occurredAt,
    performanceDisclosureScope: "all_metrics",
  };
}

function possibleDisclosure(id: string, occurredAt: string): ResearchEvent {
  return { ...confirmedDisclosure(id, occurredAt, null), eventType: "earnings_preview", title: "业绩预告元数据", verificationStatus: "metadata_only", parseStatus: "metadata_only", performanceDisclosureScope: "unknown" };
}

function stock(): Stock {
  return { id: "demo", name: "测试公司", code: "000001.SZ", market: "A股", industryId: "tech" } as Stock;
}

function watchItem(): WatchItem {
  return { id: "watch", stockId: "demo", createdAt: "2026-07-14", updatedAt: "2026-07-14", status: "观察", priority: "medium", tags: [], reason: "跟踪", thesis: "假设", validationCriteria: [], riskCriteria: [], nextReviewAt: null, lastReviewedAt: "2026-07-14", archivedAt: null, source: "user", schemaVersion: 2 };
}

function createInput(overrides: Partial<EarningsExpectationSnapshot> = {}) {
  const { id: _id, createdAt: _createdAt, createdBy: _createdBy, correctsSnapshotId: _corrects, schemaVersion: _schemaVersion, ...input } = snapshot("input", overrides);
  return input;
}

function importOptions() {
  return { validStocks: [stock()], now: NOW, timeZone: "UTC" };
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
