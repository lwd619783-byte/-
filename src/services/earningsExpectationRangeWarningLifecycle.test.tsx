import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EarningsExpectationTemporalAudit } from "../components/expectation/EarningsExpectationTemporalAudit";
import type {
  EarningsExpectationComparison,
  EarningsExpectationSnapshot,
  ResearchEvent,
  ReviewTaskState,
  Stock,
  WatchItem,
} from "../types";
import { buildEarningsExpectationComparisons } from "./earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "./earningsExpectationEventProvider";
import {
  compareExpectationAvailability,
  getExpectationAvailability,
  getExpectationBusinessTime,
  resolveEffectiveBusinessHistory,
  resolveUniquePreviousBusinessNode,
  selectEffectiveEarningsExpectations,
  sortExpectationsByBusinessTime,
} from "./earningsExpectationIntegrity";
import { createEmptyEarningsExpectationEnvelope, EarningsExpectationRepository } from "./earningsExpectationRepository";
import { buildReviewTasks, getReviewTaskBoundaryInstant } from "./reviewTaskProvider";

const NOW = new Date("2026-07-31T12:00:00.000Z");
const SETTINGS = {
  revisionReminderThreshold: 0.1,
  nearZeroThreshold: 1e-9,
  roundingTolerance: 1e-9,
  timeZone: "Asia/Shanghai",
};

describe("earnings expectation temporal range invariants", () => {
  it("proves a January 1 uncertain range is before a January 2 instant and selects the newer instant independent of IDs and input order", () => {
    const uncertain = externalDate("z-old", "2026-01-01", { value: 100 });
    const precise = externalInstant("a-current", "2026-01-02T03:00:00.000Z", "2026-01-02", { value: 120 });

    expect(compareExpectationAvailability(uncertain, precise)).toMatchObject({ status: "before", order: -1, uncertain: false });
    expect(compareExpectationAvailability(precise, uncertain)).toMatchObject({ status: "after", order: 1, uncertain: false });
    for (const input of [[uncertain, precise], [precise, uncertain]]) {
      const selection = selectEffectiveEarningsExpectations(input, "Asia/Shanghai")[0];
      expect(selection).toMatchObject({ snapshot: { id: "a-current" }, businessOrderStatus: "confirmed" });
      expect(selection.previousResolution).toMatchObject({ status: "unique", previousNode: { effectiveSnapshot: { id: "z-old" } } });
    }
  });

  it("orders two bounded uncertain ranges on different dates but preserves uncertainty for same-day overlap", () => {
    const first = externalDate("first", "2026-01-01");
    const second = externalDate("second", "2026-01-02");
    const sameDay = externalDate("same-day", "2026-01-01", { value: 130 });

    expect(compareExpectationAvailability(first, second).status).toBe("before");
    expect(compareExpectationAvailability(second, first).status).toBe("after");
    expect(compareExpectationAvailability(first, sameDay)).toMatchObject({ status: "uncertain", reason: "overlapping_date_precision" });
  });

  it("keeps mixed date/datetime precision on the same business date uncertain", () => {
    const dateRange = externalDate("range", "2026-01-01");
    const instant = externalInstant("instant", "2026-01-01T05:00:00.000Z", "2026-01-01");
    expect(compareExpectationAvailability(dateRange, instant)).toMatchObject({ status: "uncertain", reason: "overlapping_date_precision" });
    expect(selectEffectiveEarningsExpectations([dateRange, instant], "UTC")[0].businessOrderStatus).toBe("uncertain");
  });

  it("keeps unresolved legacy clocks unbounded and non-orderable against precise instants", () => {
    const legacy = externalDate("legacy", "2026-01-01", {
      sourcePublishedAt: "2026-01-01T09:00",
      sourcePublishedAtPrecision: "datetime",
      sourcePublishedAtResolution: "unresolved_legacy",
      sourcePublishedAtTimeZone: null,
      sourcePublishedAtCalendarDate: "2026-01-01",
    });
    const precise = externalInstant("precise", "2026-01-03T02:00:00.000Z", "2026-01-03");
    expect(getExpectationAvailability(legacy)).toMatchObject({ status: "uncertain", bounds: { bounded: false, uncertaintyReason: "legacy_time_zone_unknown" } });
    expect(compareExpectationAvailability(legacy, precise)).toMatchObject({ status: "uncertain", reason: "legacy_time_zone_unknown" });
  });

  it("keeps financial ordering stable across display zones and deterministic sorting permutations", () => {
    const old = externalDate("z", "2026-01-01");
    const current = externalInstant("a", "2026-01-02T00:30:00.000Z", "2026-01-02");
    const zones = ["Asia/Shanghai", "Asia/Tokyo", "UTC", "America/New_York", "Europe/London"];
    for (const zone of zones) {
      expect(selectEffectiveEarningsExpectations([current, old], zone)[0].snapshot.id).toBe("a");
      expect(sortExpectationsByBusinessTime([current, old], zone).map((item) => item.id)).toEqual(["z", "a"]);
    }
  });

  it("compares exact points by their standardized instant even when persisted business dates differ", () => {
    const left = externalInstant("left", "2026-01-01T16:00:00.000Z", "2026-01-01");
    const right = externalInstant("right", "2026-01-01T15:30:00.000Z", "2026-01-02");
    const equal = externalInstant("equal", "2026-01-01T16:00:00.000Z", "2026-01-02");
    expect(compareExpectationAvailability(left, right)).toMatchObject({ status: "after", order: 1 });
    expect(compareExpectationAvailability(left, equal)).toMatchObject({ status: "equal", order: 0 });
  });

  it("uses the correction terminal availability in range comparison and unique-predecessor resolution", () => {
    const root = externalDate("root", "2026-01-01");
    const terminal = externalInstant("terminal", "2026-01-02T03:00:00.000Z", "2026-01-02", {
      correctsSnapshotId: "root",
      correctionScope: "value",
      createdAt: "2026-07-15T02:00:00.000Z",
    });
    const current = externalInstant("current", "2026-01-03T03:00:00.000Z", "2026-01-03");
    const nodes = resolveEffectiveBusinessHistory([current, terminal, root], "Asia/Shanghai");
    const selected = nodes.find((node) => node.businessRootSnapshot.id === "current");

    expect(nodes.find((node) => node.businessRootSnapshot.id === "root")).toMatchObject({ effectiveSnapshot: { id: "terminal" } });
    expect(selected && resolveUniquePreviousBusinessNode(selected, nodes)).toMatchObject({ status: "unique", previousNode: { effectiveSnapshot: { id: "terminal" } } });
  });

  it("does not fabricate an effective available-time scalar and keeps formation evidence separately auditable", () => {
    const uncertain = externalDate("uncertain", "2026-01-01");
    const comparison = buildEarningsExpectationComparisons([uncertain], [], SETTINGS, NOW.toISOString())[0];
    const event = warningEventFor([uncertain], [comparison]);

    expect(getExpectationBusinessTime(uncertain, "Asia/Shanghai")).toBeNull();
    expect(comparison).toMatchObject({ effectiveBusinessTime: null, effectiveFormationTime: "2026-01-01", availabilityStatus: "uncertain" });
    expect(event.expectation).toMatchObject({ effectiveBusinessTime: null, effectiveFormationTime: "2026-01-01", availabilityStatus: "uncertain" });
    expect(event.expectation?.availabilityBounds).toMatchObject({ bounded: true, businessDateMin: "2026-01-01", businessDateMax: "2026-01-01" });
  });

  it("renders the availability range and uncertainty reason without a scalar fallback", () => {
    const uncertain = externalDate("uncertain-ui", "2026-01-01");
    const selection = selectEffectiveEarningsExpectations([uncertain], "Asia/Shanghai")[0];
    const markup = renderToStaticMarkup(<EarningsExpectationTemporalAudit snapshot={uncertain} selection={selection} displayTimeZone="Asia/Shanghai" />);
    expect(markup).toContain("2026-01-01");
    expect(markup).toContain("date_precision");
    expect(markup).toContain("Asia/Shanghai");
  });
});

describe("earnings expectation event and review boundaries", () => {
  it("creates a new warning task from the warning activation instant even when the business date is historical", () => {
    const historical = userSnapshot("historical", {
      asOfDate: "2026-01-01",
      formedAtCalendarDate: "2026-01-01",
      sourceVerificationStatus: "pending",
      createdAt: "2026-07-15T07:00:00.000Z",
    });
    const event = warningEventFor([historical]);
    const tasks = buildReviewTasks({ watchItems: [watch("2026-07-01")], events: [event], chains: [], taskStates: [], now: NOW, timeZone: "Asia/Shanghai" });

    expect(event).toMatchObject({ eventBusinessDate: "2026-01-01", eventOccurredAt: null, stateActivatedAt: "2026-07-15T07:00:00.000Z", recordedAt: "2026-07-15T07:00:00.000Z" });
    expect(tasks.some((task) => task.ruleType === "earnings_expectation_data_warning")).toBe(true);
  });

  it("uses precise same-day instants before date fallbacks", () => {
    const snapshot = userSnapshot("afternoon", {
      ...formationInstant("2026-07-15T07:00:00.000Z", "2026-07-15"),
      createdAt: "2026-07-15T07:05:00.000Z",
    });
    const event = businessEventFor([snapshot]);
    const afterMorning = buildReviewTasks({ watchItems: [watch("2026-07-15T01:00:00.000Z")], events: [event], chains: [], taskStates: [], now: NOW, timeZone: "Asia/Shanghai" });
    const afterAfternoon = buildReviewTasks({ watchItems: [watch("2026-07-15T08:00:00.000Z")], events: [event], chains: [], taskStates: [], now: NOW, timeZone: "Asia/Shanghai" });

    expect(getReviewTaskBoundaryInstant(event)).toBe("2026-07-15T07:00:00.000Z");
    expect(afterMorning.some((task) => task.ruleType === "earnings_expectation_added")).toBe(true);
    expect(afterAfternoon.some((task) => task.ruleType === "earnings_expectation_added")).toBe(false);
  });

  it("uses the exact correctionRecordedAt across a UTC date boundary", () => {
    const root = userSnapshot("root", { ...formationInstant("2026-06-01T02:00:00.000Z", "2026-06-01"), createdAt: "2026-06-01T03:00:00.000Z" });
    const correction = userSnapshot("correction", {
      ...root,
      id: "correction",
      correctsSnapshotId: "root",
      correctionScope: "value",
      value: 110,
      createdAt: "2026-07-03T23:30:00.000Z",
    });
    const correctionEvent = buildEarningsExpectationResearchEvents([root, correction], [], [stock()], 0.1, "Asia/Shanghai")
      .find((event) => event.eventType === "earnings_expectation_correction");
    expect(correctionEvent).toMatchObject({ eventDate: "2026-07-04", eventOccurredAt: "2026-07-03T23:30:00.000Z" });
    expect(getReviewTaskBoundaryInstant(correctionEvent!)).toBe("2026-07-03T23:30:00.000Z");

    const before = buildReviewTasks({ watchItems: [watch("2026-07-03T23:00:00.000Z")], events: [correctionEvent!], chains: [], taskStates: [], now: NOW, timeZone: "Asia/Shanghai" });
    const after = buildReviewTasks({ watchItems: [watch("2026-07-04T00:00:00.000Z")], events: [correctionEvent!], chains: [], taskStates: [], now: NOW, timeZone: "Asia/Shanghai" });
    expect(before.some((task) => task.ruleType === "earnings_expectation_correction")).toBe(true);
    expect(after.some((task) => task.ruleType === "earnings_expectation_correction")).toBe(false);
  });
});

describe("earnings expectation warning episode lifecycle", () => {
  it("keeps a continuous warning episode stable through unrelated corrections, wording changes, code order and display zones", () => {
    const root = userSnapshot("root", { sourceVerificationStatus: "pending", createdAt: "2026-07-15T01:00:00.000Z" });
    const correction = userSnapshot("correction", {
      ...root,
      id: "correction",
      correctsSnapshotId: "root",
      correctionScope: "value",
      value: 101,
      createdAt: "2026-07-16T01:00:00.000Z",
    });
    const original = warningEventFor([root]);
    const continued = warningEventFor([root, correction]);
    const alternateZone = warningEventFor([correction, root], [], "America/New_York");

    expect(continued.id).toBe(original.id);
    expect(continued.warningEpisodeKey).toBe(original.warningEpisodeKey);
    expect(continued.stateActivatedAt).toBe("2026-07-15T01:00:00.000Z");
    expect(alternateZone.id).toBe(original.id);
    expect({ ...continued, summary: "changed", reviewReasons: [...continued.reviewReasons].reverse() }.id).toBe(original.id);

    const comparison = buildEarningsExpectationComparisons([externalDate("range-codes", "2026-01-01")], [], SETTINGS, NOW.toISOString())[0];
    const reversed = { ...comparison, structuredWarningCodes: [...(comparison.structuredWarningCodes ?? [])].reverse(), nonComparableReasonCodes: [...(comparison.nonComparableReasonCodes ?? [])].reverse() };
    expect(warningEventFor([externalDate("range-codes", "2026-01-01")], [comparison]).id)
      .toBe(warningEventFor([externalDate("range-codes", "2026-01-01")], [reversed]).id);
  });

  it("ends a resolved episode and creates a new warning and task after reactivation", () => {
    const root = userSnapshot("root", { sourceVerificationStatus: "pending", createdAt: "2026-07-15T01:00:00.000Z" });
    const resolved = userSnapshot("resolved", {
      ...root,
      id: "resolved",
      correctsSnapshotId: "root",
      correctionScope: "value",
      sourceVerificationStatus: "verified",
      createdAt: "2026-07-16T01:00:00.000Z",
    });
    const reactivated = userSnapshot("reactivated", {
      ...resolved,
      id: "reactivated",
      correctsSnapshotId: "resolved",
      sourceVerificationStatus: "pending",
      createdAt: "2026-07-17T01:00:00.000Z",
    });
    const firstEvent = warningEventFor([root]);
    const resolvedEvents = buildEarningsExpectationResearchEvents([root, resolved], [], [stock()], 0.1, "Asia/Shanghai");
    const secondEvent = warningEventFor([root, resolved, reactivated]);

    expect(resolvedEvents.some((event) => event.eventType === "earnings_expectation_data_warning")).toBe(false);
    expect(secondEvent.id).not.toBe(firstEvent.id);
    expect(secondEvent.warningEpisodeKey).not.toBe(firstEvent.warningEpisodeKey);
    expect(secondEvent.stateActivatedAt).toBe("2026-07-17T01:00:00.000Z");

    const watched = watch("2026-07-01");
    const firstTask = warningTaskFor(watched, firstEvent);
    const state: ReviewTaskState = { taskId: firstTask.id, status: "acknowledged", acknowledgedAt: "2026-07-16T00:00:00.000Z", dismissedAt: null, snoozedUntil: null, updatedAt: "2026-07-16T00:00:00.000Z" };
    expect(warningTaskFor(watched, firstEvent, [state]).status).toBe("acknowledged");
    expect(warningTaskFor(watched, secondEvent, [state])).toMatchObject({ status: "pending" });
    expect(warningTaskFor(watched, secondEvent, [state]).id).not.toBe(firstTask.id);
  });

  it("starts a new episode when the decisive actual or disclosure event changes", () => {
    const expectation = externalInstant("expectation", "2026-01-01T01:00:00.000Z", "2026-01-01");
    const disclosureA = disclosureWithoutMetric("actual-a", "2026-02-01T01:00:00.000Z");
    const disclosureB = disclosureWithoutMetric("actual-b", "2026-02-02T01:00:00.000Z");
    const comparisonA = buildEarningsExpectationComparisons([expectation], [disclosureA], SETTINGS, NOW.toISOString())[0];
    const comparisonB = buildEarningsExpectationComparisons([expectation], [disclosureB], SETTINGS, NOW.toISOString())[0];
    const eventA = warningEventFor([expectation], [comparisonA]);
    const eventB = warningEventFor([expectation], [comparisonB]);

    expect(eventA.expectation?.structuredWarningCodes).toContain("actual_value_unavailable");
    expect(eventB.expectation?.structuredWarningCodes).toContain("actual_value_unavailable");
    expect(eventA.id).not.toBe(eventB.id);
    expect(eventA.warningEpisodeKey).not.toBe(eventB.warningEpisodeKey);
  });

  it("recomputes the same episode and task IDs after repository persistence and reload", () => {
    const root = userSnapshot("persisted", { sourceVerificationStatus: "pending", createdAt: "2026-07-15T01:00:00.000Z" });
    const storage = new MemoryStorage();
    const repository = new EarningsExpectationRepository(storage, () => NOW);
    const envelope = { ...createEmptyEarningsExpectationEnvelope(NOW), snapshots: [root], settings: SETTINGS };
    expect(repository.save(envelope)).toMatchObject({ ok: true });
    const beforeEvent = warningEventFor(envelope.snapshots);
    const beforeTask = warningTaskFor(watch("2026-07-01"), beforeEvent);

    const loaded = repository.load();
    expect(loaded.error).toBeNull();
    const afterEvent = warningEventFor(loaded.data.snapshots);
    const afterTask = warningTaskFor(watch("2026-07-01"), afterEvent);
    expect(afterEvent.id).toBe(beforeEvent.id);
    expect(afterEvent.warningEpisodeKey).toBe(beforeEvent.warningEpisodeKey);
    expect(afterEvent.detectedAt).toBe(beforeEvent.detectedAt);
    expect(afterTask.id).toBe(beforeTask.id);
  });
});

function userSnapshot(id: string, overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
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
    sourceName: "local-user",
    sourceTitle: "",
    sourceUrl: null,
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
    createdAt: "2026-07-15T01:00:00.000Z",
    createdBy: "local-user",
    sourceVerificationStatus: "verified",
    notes: null,
    correctsSnapshotId: null,
    correctionScope: null,
    schemaVersion: 2,
    ...overrides,
  };
  if (!("formedAtCalendarDate" in overrides)) result.formedAtCalendarDate = result.asOfDate;
  return result;
}

function externalDate(id: string, date: string, overrides: Partial<EarningsExpectationSnapshot> = {}) {
  return userSnapshot(id, {
    sourceCategory: "institution_single",
    sourceName: "same-institution",
    sourceTitle: "dated evidence",
    sourceUrl: "https://example.com/evidence",
    asOfDate: date,
    formedAt: date,
    formedAtPrecision: "date",
    formedAtResolution: "date",
    formedAtCalendarDate: date,
    sourcePublishedAt: date,
    sourcePublishedAtPrecision: "date",
    sourcePublishedAtResolution: "date",
    sourcePublishedAtTimeZone: null,
    sourcePublishedAtCalendarDate: date,
    ...overrides,
  });
}

function externalInstant(id: string, instant: string, businessDate: string, overrides: Partial<EarningsExpectationSnapshot> = {}) {
  return userSnapshot(id, {
    sourceCategory: "institution_single",
    sourceName: "same-institution",
    sourceTitle: "precise evidence",
    sourceUrl: "https://example.com/evidence",
    ...formationInstant(instant, businessDate),
    sourcePublishedAt: instant,
    sourcePublishedAtPrecision: "datetime",
    sourcePublishedAtResolution: "absolute",
    sourcePublishedAtTimeZone: "UTC",
    sourcePublishedAtCalendarDate: businessDate,
    ...overrides,
  });
}

function formationInstant(instant: string, businessDate: string): Partial<EarningsExpectationSnapshot> {
  return {
    asOfDate: businessDate,
    formedAt: instant,
    formedAtPrecision: "datetime",
    formedAtResolution: "absolute",
    formedAtTimeZone: "UTC",
    formedAtCalendarDate: businessDate,
  };
}

function stock(): Stock {
  return { id: "demo", name: "Demo Company", code: "000001.SZ", market: "A股", industryId: "tech" } as Stock;
}

function watch(lastReviewedAt: string): WatchItem {
  return {
    id: "watch",
    stockId: "demo",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    status: "观察",
    priority: "medium",
    tags: [],
    reason: "track",
    thesis: "test",
    validationCriteria: [],
    riskCriteria: [],
    nextReviewAt: null,
    lastReviewedAt,
    archivedAt: null,
    source: "user",
    schemaVersion: 2,
  };
}

function businessEventFor(snapshots: EarningsExpectationSnapshot[]) {
  const event = buildEarningsExpectationResearchEvents(snapshots, [], [stock()], 0.1, "Asia/Shanghai")
    .find((candidate) => candidate.eventType === "earnings_expectation_added" || candidate.eventType === "earnings_expectation_revision");
  if (!event) throw new Error("business event missing");
  return event;
}

function warningEventFor(snapshots: EarningsExpectationSnapshot[], comparisons: EarningsExpectationComparison[] = [], timeZone = "Asia/Shanghai") {
  const event = buildEarningsExpectationResearchEvents(snapshots, comparisons, [stock()], 0.1, timeZone)
    .find((candidate) => candidate.eventType === "earnings_expectation_data_warning");
  if (!event) throw new Error("warning event missing");
  return event;
}

function warningTaskFor(item: WatchItem, event: ResearchEvent, taskStates: ReviewTaskState[] = []) {
  const result = buildReviewTasks({ watchItems: [item], events: [event], chains: [], taskStates, now: NOW, timeZone: "Asia/Shanghai" })
    .find((task) => task.ruleType === "earnings_expectation_data_warning");
  if (!result) throw new Error("warning task missing");
  return result;
}

function disclosureWithoutMetric(id: string, occurredAt: string): ResearchEvent {
  return {
    id,
    stockId: "demo",
    stockName: "Demo Company",
    stockCode: "000001.SZ",
    industryId: "tech",
    market: "A股",
    eventType: "periodic_report",
    eventDate: occurredAt.slice(0, 10),
    publishedAt: occurredAt,
    reportPeriod: "2026-06-30",
    title: "Periodic report metadata",
    summary: "No parsed metric",
    sourceType: "announcement",
    sourceName: "exchange",
    sourceUrl: "https://example.com/filing",
    pdfUrl: null,
    verificationStatus: "metadata_only",
    parseStatus: "metadata_only",
    materiality: "high",
    metrics: [],
    relatedAnnouncementIds: [id],
    relatedFinancialPeriod: "2026-06-30",
    reviewStatus: "pending",
    reviewReasons: [],
    isRestated: false,
    updatedAt: occurredAt,
    performanceDisclosureScope: "all_metrics",
  };
}

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
