import { describe, expect, it } from "vitest";
import type { EarningsExpectationSnapshot, Stock, WatchItem } from "../types";
import {
  compareExpectationBusinessTime,
  deriveExpectationBusinessRevisionDelta,
  deriveExpectationCorrectionDelta,
  getEffectiveCorrectionTerminal,
  getEffectiveCorrectionTerminals,
  getExpectationGroupKey,
  normalizeSourceIdentity,
  resolveEffectiveBusinessHistory,
  selectEffectiveEarningsExpectations,
  sortExpectationsByBusinessTime,
  validateEarningsExpectationCorrectionGraph,
} from "./earningsExpectationIntegrity";
import {
  EarningsExpectationRepository,
  createEmptyEarningsExpectationEnvelope,
  migrateEarningsExpectationEnvelope,
} from "./earningsExpectationRepository";
import { EarningsExpectationStore } from "./earningsExpectationStore";
import { buildEarningsExpectationResearchEvents } from "./earningsExpectationEventProvider";
import { buildReviewTasks } from "./reviewTaskProvider";
import { getCalendarDateInTimeZone, isCalendarDate, isPreciseInstant, isValidTimeZone } from "../utils/dateTime";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("earnings expectation correction graph integrity", () => {
  it("migrates legacy V1 settings without clearing snapshots or inventing formedAt", () => {
    const legacy = { ...createEmptyEarningsExpectationEnvelope(FIXED_NOW), settings: { revisionReminderThreshold: 0.1, nearZeroThreshold: 1e-9, roundingTolerance: 1e-9 }, snapshots: [{ ...snapshot("legacy"), formedAt: undefined, formedAtPrecision: undefined }] };
    const migrated = migrateEarningsExpectationEnvelope(legacy);
    expect(migrated.snapshots[0].id).toBe("legacy");
    expect(migrated.snapshots[0].formedAt).toBeNull();
    expect(migrated.snapshots[0].formedAtPrecision).toBe("date");
    expect(isValidZone(migrated.settings.timeZone)).toBe(true);
    expect(migrateEarningsExpectationEnvelope(migrated)).toEqual(migrated);
  });
  it("rejects self references", () => expect(codes([snapshot("a", "a")])).toContain("self_reference"));
  it("rejects a two-node cycle", () => expect(codes([snapshot("a", "b"), snapshot("b", "a")])).toContain("cycle"));
  it("rejects a three-node cycle", () => expect(codes([snapshot("a", "c"), snapshot("b", "a"), snapshot("c", "b")])).toContain("cycle"));
  it("rejects two direct correctors of one snapshot", () => expect(codes([snapshot("a"), snapshot("b", "a"), snapshot("c", "a")])).toContain("branch"));
  it("accepts a legal two-level chain and resolves one terminal", () => {
    const values = [snapshot("a"), snapshot("b", "a")];
    expect(validateEarningsExpectationCorrectionGraph(values).ok).toBe(true);
    expect(getEffectiveCorrectionTerminal(values, "a")?.id).toBe("b");
    expect(getEffectiveCorrectionTerminals(values).map((item) => item.id)).toEqual(["b"]);
  });
  it("accepts a legal three-level chain", () => {
    const values = [snapshot("a"), snapshot("b", "a"), snapshot("c", "b")];
    expect(validateEarningsExpectationCorrectionGraph(values).ok).toBe(true);
    expect(getEffectiveCorrectionTerminal(values, "b")?.id).toBe("c");
  });
  it("is independent of legal chain input order", () => {
    const ordered = [snapshot("a"), snapshot("b", "a"), snapshot("c", "b")];
    const shuffled = [ordered[2], ordered[0], ordered[1]];
    expect(validateEarningsExpectationCorrectionGraph(shuffled)).toEqual(validateEarningsExpectationCorrectionGraph(ordered));
    expect(getEffectiveCorrectionTerminals(shuffled).map((item) => item.id)).toEqual(getEffectiveCorrectionTerminals(ordered).map((item) => item.id));
  });
  it("rejects a cross-store import branch in preview", () => {
    const repo = repository();
    const current = { ...createEmptyEarningsExpectationEnvelope(FIXED_NOW), settings: settings(), snapshots: [snapshot("a"), snapshot("b", "a")] };
    const preview = repo.previewJson({ schemaVersion: 1, snapshots: [snapshot("c", "a")] }, current, options());
    expect(preview.mergeAllowed).toBe(false);
    expect(preview.issues.some((item) => item.code.endsWith("branch"))).toBe(true);
  });
  it("atomically rejects a cycle import", () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    const current = { ...createEmptyEarningsExpectationEnvelope(FIXED_NOW), settings: settings(), snapshots: [snapshot("old")] };
    expect(repo.save(current).ok).toBe(true);
    const values = [snapshot("a", "b"), snapshot("b", "a")];
    const preview = repo.previewJson({ schemaVersion: 1, snapshots: values }, current, options());
    const result = repo.importPreview(preview, current, "json_import", "replace");
    expect(result.ok).toBe(false);
    expect(repo.load().data.snapshots.map((item) => item.id)).toEqual(["old"]);
  });
  it("atomically rejects a branch import", () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    const current = { ...createEmptyEarningsExpectationEnvelope(FIXED_NOW), settings: settings(), snapshots: [snapshot("old")] };
    expect(repo.save(current).ok).toBe(true);
    const values = [snapshot("a"), snapshot("b", "a"), snapshot("c", "a")];
    const preview = repo.previewJson({ schemaVersion: 1, snapshots: values }, current, options());
    expect(repo.importPreview(preview, current, "json_import", "replace").ok).toBe(false);
    expect(repo.load().data.snapshots.map((item) => item.id)).toEqual(["old"]);
  });
  it("prevents a second direct corrector through the Store API", () => {
    const store = new EarningsExpectationStore(repository(), () => FIXED_NOW, () => "c");
    const current = { ...createEmptyEarningsExpectationEnvelope(FIXED_NOW), settings: settings(), snapshots: [snapshot("a"), snapshot("b", "a")] };
    const result = store.appendCorrection(current, "a", input({ value: 130 }));
    expect(result.ok).toBe(false);
    expect(result.data).toBe(current);
  });
  it("keeps the effective terminal stable after repository reload", () => {
    const storage = new MemoryStorage();
    const repo = repository(storage);
    const current = { ...createEmptyEarningsExpectationEnvelope(FIXED_NOW), settings: settings(), snapshots: [snapshot("a"), snapshot("b", "a"), snapshot("c", "b")] };
    expect(repo.save(current).ok).toBe(true);
    expect(getEffectiveCorrectionTerminals(repo.load().data.snapshots).map((item) => item.id)).toEqual(["c"]);
  });
});

describe("earnings expectation business chronology and source identity", () => {
  it("orders exact formation times without using inverted createdAt", () => {
    const early = snapshot("early", null, { formedAt: "2026-07-14T09:00:00+09:00", formedAtPrecision: "datetime", asOfDate: "2026-07-14", createdAt: "2026-07-14T09:00:00.000Z" });
    const late = snapshot("late", null, { formedAt: "2026-07-14T15:00:00+09:00", formedAtPrecision: "datetime", asOfDate: "2026-07-14", createdAt: "2026-07-14T07:00:00.000Z" });
    expect(sortExpectationsByBusinessTime([late, early], "Asia/Tokyo").map((item) => item.id)).toEqual(["early", "late"]);
    expect(selectEffectiveEarningsExpectations([late, early], "Asia/Tokyo")[0].snapshot.id).toBe("late");
  });
  it("does not let an old prediction win merely because it was entered later", () => {
    const old = snapshot("old", null, { asOfDate: "2026-07-01", createdAt: "2026-07-14T12:00:00.000Z" });
    const current = snapshot("current", null, { asOfDate: "2026-07-10", createdAt: "2026-07-10T01:00:00.000Z" });
    expect(selectEffectiveEarningsExpectations([current, old], "Asia/Tokyo")[0].snapshot.id).toBe("current");
  });
  it("uses stable IDs for two date-only records on the same day and marks uncertainty", () => {
    const selection = selectEffectiveEarningsExpectations([snapshot("a"), snapshot("z")], "Asia/Tokyo")[0];
    expect(selection.snapshot.id).toBe("z");
    expect(selection.businessOrderUncertain).toBe(true);
  });
  it("uses a stable fallback for mixed date and datetime precision on the same calendar day", () => {
    const exact = snapshot("a", null, { formedAt: "2026-07-14T09:01:00+09:00", formedAtPrecision: "datetime" });
    const dateOnly = snapshot("z");
    const first = selectEffectiveEarningsExpectations([exact, dateOnly], "Asia/Tokyo")[0];
    const second = selectEffectiveEarningsExpectations([dateOnly, exact], "Asia/Tokyo")[0];
    expect(first.snapshot.id).toBe("z");
    expect(second).toEqual(first);
    expect(first.businessOrderUncertain).toBe(true);
  });
  it("keeps the selected candidate uncertain when any same-day candidate lacks comparable precision", () => {
    const dateOnly = snapshot("a");
    const morning = snapshot("b", null, { formedAt: "2026-07-14T09:00:00+09:00", formedAtPrecision: "datetime" });
    const afternoon = snapshot("z", null, { formedAt: "2026-07-14T15:00:00+09:00", formedAtPrecision: "datetime", value: 120 });
    const selection = selectEffectiveEarningsExpectations([afternoon, dateOnly, morning], "Asia/Tokyo")[0];
    expect(selection.snapshot.id).toBe("z");
    expect(selection.businessOrderUncertain).toBe(true);
    const events = buildEarningsExpectationResearchEvents([afternoon, dateOnly, morning], [], [stock()], 0.1, "Asia/Tokyo");
    expect(events.find((event) => event.expectation?.snapshotId === "z")?.eventType).toBe("earnings_expectation_added");
    expect(events.find((event) => event.expectation?.snapshotId === "z")?.expectation?.businessRevisionDelta).toBeNull();
  });
  it("uses stable IDs for identical exact instants", () => {
    const left = snapshot("a", null, { formedAt: "2026-07-14T09:00:00+09:00", formedAtPrecision: "datetime" });
    const right = snapshot("z", null, { formedAt: "2026-07-14T00:00:00Z", formedAtPrecision: "datetime" });
    expect(compareExpectationBusinessTime(left, right, "Asia/Tokyo").order).toBe(-1);
    expect(selectEffectiveEarningsExpectations([right, left], "Asia/Tokyo")[0].snapshot.id).toBe("z");
  });
  it("normalizes safe whitespace, full-width spaces, Unicode width and English case", () => {
    expect(normalizeSourceIdentity("  ＡＢＣ　 Securities   LLC ")).toBe("abc securities llc");
  });
  it("keeps distinct Chinese organization names distinct", () => {
    expect(normalizeSourceIdentity("中信")).not.toBe(normalizeSourceIdentity("中信证券股份有限公司"));
  });
  it("uses normalized identities for grouping without changing display names", () => {
    const original = snapshot("a", null, { sourceCategory: "institution_single", sourceName: " ABC　Securities ", sourceTitle: "预测", sourceUrl: "https://example.com/a", sourcePublishedAt: "2026-07-14", sourcePublishedAtPrecision: "date" });
    const revision = snapshot("b", "a", { sourceCategory: "institution_single", sourceName: "abc securities", sourceTitle: "预测修订", sourceUrl: "https://example.com/b", sourcePublishedAt: "2026-07-14", sourcePublishedAtPrecision: "date" });
    expect(getExpectationGroupKey(original)).toBe(getExpectationGroupKey(revision));
    expect(validateEarningsExpectationCorrectionGraph([original, revision]).ok).toBe(true);
    expect(original.sourceName).toBe(" ABC　Securities ");
  });
  it("generates event revision order from the same formation chronology", () => {
    const old = snapshot("old", null, { asOfDate: "2026-07-13", createdAt: "2026-07-15T00:00:00.000Z", value: 100 });
    const current = snapshot("current", null, { asOfDate: "2026-07-14", createdAt: "2026-07-14T01:00:00.000Z", value: 120 });
    const events = buildEarningsExpectationResearchEvents([current, old], [], [stock()], 0.1, "Asia/Tokyo");
    const currentEvent = events.find((event) => event.expectation?.snapshotId === "current" && event.eventType === "earnings_expectation_revision");
    expect(currentEvent?.expectation?.revisionMagnitude).toBeCloseTo(0.2);
    expect(events.filter((event) => event.eventType === "earnings_expectation_added" || event.eventType === "earnings_expectation_revision").map((event) => event.expectation?.snapshotId)).toEqual(["current", "old"]);
  });
  it("sorts same-day user events by exact formedAt rather than createdAt", () => {
    const morning = snapshot("morning", null, { formedAt: "2026-07-14T09:00:00+09:00", formedAtPrecision: "datetime", createdAt: "2026-07-14T10:00:00.000Z" });
    const afternoon = snapshot("afternoon", null, { formedAt: "2026-07-14T15:00:00+09:00", formedAtPrecision: "datetime", createdAt: "2026-07-14T07:00:00.000Z" });
    const events = buildEarningsExpectationResearchEvents([afternoon, morning], [], [stock()], 0.1, "Asia/Tokyo");
    expect(events.map((event) => event.expectation?.snapshotId)).toEqual(["afternoon", "morning"]);
    expect(events[0].publishedAt).toBe("2026-07-14T06:00:00.000Z");
  });
  it("uses an external source publication date without fabricating an hour", () => {
    const external = snapshot("external", null, { sourceCategory: "institution_single", sourceName: "ABC Securities", sourceTitle: "盈利预测", sourceUrl: "https://example.com/report", sourcePublishedAt: "2026-07-13", sourcePublishedAtPrecision: "date", sourceVerificationStatus: "verified" });
    external.asOfDate = "2026-07-12";
    external.formedAtCalendarDate = "2026-07-12";
    const event = buildEarningsExpectationResearchEvents([external], [], [stock()], 0.1, "Asia/Tokyo")[0];
    expect(event.eventDate).toBe("2026-07-13");
    expect(event.publishedAt).toBe("2026-07-13");
    expect(event.expectation?.businessTimePrecision).toBe("date");
  });
  it("marks a same-day date-only event order as uncertain but deterministic", () => {
    const first = buildEarningsExpectationResearchEvents([snapshot("a"), snapshot("z", null, { value: 110 })], [], [stock()], 0.1, "Asia/Tokyo");
    const second = buildEarningsExpectationResearchEvents([snapshot("z", null, { value: 110 }), snapshot("a")], [], [stock()], 0.1, "Asia/Tokyo");
    expect(second).toEqual(first);
    expect(first.some((event) => event.expectation?.businessOrderUncertain)).toBe(true);
    expect(first.some((event) => event.eventType === "earnings_expectation_revision")).toBe(false);
    expect(first.every((event) => event.expectation?.businessRevisionDelta == null)).toBe(true);
  });
  it("keeps correction deltas target-directed and separate from business revisions", () => {
    const original = snapshot("a", null, { asOfDate: "2026-07-10", value: 100 });
    const businessRevision = snapshot("b", null, { asOfDate: "2026-07-11", value: 120 });
    const correction = snapshot("c", "a", { asOfDate: "2026-07-12", value: 105, correctionScope: "value" });
    expect(deriveExpectationBusinessRevisionDelta(businessRevision, original)).toMatchObject({ previousBusinessSnapshotId: "a", relativeDelta: 0.2, direction: "up" });
    expect(deriveExpectationCorrectionDelta(correction, original)).toMatchObject({ correctionTargetId: "a", previousValue: 100, correctedValue: 105, valueDelta: 5, relativeDelta: 0.05, basisChanged: false, unitChanged: false, currencyChanged: false, accountingScopeChanged: false });
    expect(deriveExpectationBusinessRevisionDelta(correction, businessRevision)).toBeNull();
    const events = buildEarningsExpectationResearchEvents([correction, businessRevision, original], [], [stock()], 0.1, "Asia/Shanghai");
    const revisionEvent = events.find((event) => event.eventType === "earnings_expectation_revision");
    const correctionEvent = events.find((event) => event.eventType === "earnings_expectation_correction");
    expect(revisionEvent?.expectation?.businessRevisionDelta).toMatchObject({ previousBusinessSnapshotId: "b", previousBusinessRootSnapshotId: "b", previousEffectiveSnapshotId: "b" });
    expect(correctionEvent?.expectation?.correctionDelta?.correctionTargetId).toBe("a");
    expect(correctionEvent?.expectation?.correctsSnapshotId).toBe("a");
    expect(correctionEvent?.expectation?.businessRevisionDelta).toBeNull();
    expect(events.some((event) => event.eventType === "earnings_expectation_revision" && event.expectation?.snapshotId === "c" && event.expectation?.businessRootSnapshotId === "a")).toBe(true);
    const correctionOnlyEvents = buildEarningsExpectationResearchEvents([correction, original], [], [stock()], 0.1, "Asia/Shanghai");
    const correctionOnlyTasks = buildReviewTasks({ watchItems: [watchItem()], events: correctionOnlyEvents, chains: [], taskStates: [], now: FIXED_NOW, timeZone: "Asia/Shanghai" });
    expect(correctionOnlyTasks.filter((task) => task.ruleType === "earnings_expectation_correction")).toHaveLength(1);
    expect(correctionOnlyTasks.some((task) => task.ruleType === "earnings_expectation_revision_up" || task.ruleType === "earnings_expectation_revision_down")).toBe(false);
  });
  it("never derives a business revision when order is uncertain", () => {
    expect(deriveExpectationBusinessRevisionDelta(snapshot("z", null, { value: 120 }), snapshot("a", null, { value: 100 }), "uncertain")).toBeNull();
  });
  it("uses the correction terminal as the next business revision baseline and its 10% threshold", () => {
    const original = snapshot("a", null, { asOfDate: "2026-06-01", value: 100, createdAt: "2026-06-01T01:00:00.000Z" });
    const correction = snapshot("c", "a", { asOfDate: "2026-06-01", value: 110, createdAt: "2026-07-15T03:00:00.000Z" });
    const next = snapshot("b", null, { asOfDate: "2026-06-10", value: 120, createdAt: "2026-06-10T01:00:00.000Z" });
    const history = resolveEffectiveBusinessHistory([next, correction, original], "Asia/Shanghai");
    expect(history.map((node) => [node.businessRootSnapshot.id, node.effectiveSnapshot.id])).toEqual([["a", "c"], ["b", "b"]]);
    const events = buildEarningsExpectationResearchEvents([next, correction, original], [], [stock()], 0.1, "Asia/Shanghai");
    const revision = events.find((event) => event.eventType === "earnings_expectation_revision")?.expectation?.businessRevisionDelta;
    expect(revision).toMatchObject({ previousBusinessRootSnapshotId: "a", previousEffectiveSnapshotId: "c", currentSnapshotId: "b", baselineValue: 110, resolvedThroughCorrectionChain: true, absoluteDelta: 10, direction: "up" });
    expect(revision?.relativeDelta).toBeCloseTo(10 / 110);
    const tasks = buildReviewTasks({ watchItems: [{ ...watchItem(), createdAt: "2026-05-01", lastReviewedAt: "2026-05-01" }], events, chains: [], taskStates: [], now: new Date("2026-07-20T00:00:00.000Z"), expectationRevisionThreshold: 0.1, timeZone: "Asia/Shanghai" });
    expect(tasks.some((task) => task.ruleType === "earnings_expectation_revision_up")).toBe(false);
  });
  it("resolves a shuffled multi-level correction chain and keeps derived revision IDs stable when its terminal changes", () => {
    const a = snapshot("a", null, { asOfDate: "2026-06-01", value: 100, createdAt: "2026-06-01T01:00:00.000Z" });
    const c = snapshot("c", "a", { asOfDate: "2026-06-01", value: 110, createdAt: "2026-07-10T01:00:00.000Z" });
    const d = snapshot("d", "c", { asOfDate: "2026-06-01", value: 115, createdAt: "2026-07-15T01:00:00.000Z" });
    const b = snapshot("b", null, { asOfDate: "2026-06-20", value: 130 });
    const firstEvents = buildEarningsExpectationResearchEvents([b, c, a], [], [stock()], 0.1, "Asia/Shanghai");
    const nextEvents = buildEarningsExpectationResearchEvents([d, b, a, c], [], [stock()], 0.1, "Asia/Shanghai");
    const firstRevision = firstEvents.find((event) => event.eventType === "earnings_expectation_revision");
    const nextRevision = nextEvents.find((event) => event.eventType === "earnings_expectation_revision");
    expect(resolveEffectiveBusinessHistory([d, b, a, c], "Asia/Shanghai")[0].effectiveSnapshot.id).toBe("d");
    expect(nextRevision?.expectation?.businessRevisionDelta).toMatchObject({ previousEffectiveSnapshotId: "d", baselineValue: 115, currentSnapshotId: "b" });
    expect(nextRevision?.expectation?.businessRevisionDelta?.relativeDelta).toBeCloseTo(15 / 115);
    expect(nextRevision?.id).toBe(firstRevision?.id);
    expect(nextEvents.find((event) => event.id === "expectation-event:c:earnings_expectation_correction")?.expectation?.effectiveSnapshotId).toBe("d");
  });
  it("dates correction audit events by createdAt while preserving the original business time and stable task IDs", () => {
    const original = snapshot("a", null, { asOfDate: "2026-06-01", createdAt: "2026-06-01T00:00:00.000Z" });
    const correction = snapshot("c", "a", { asOfDate: "2026-06-01", value: 110, createdAt: "2026-07-15T04:00:00.000Z" });
    const events = buildEarningsExpectationResearchEvents([correction, original], [], [stock()], 0.1, "Asia/Shanghai");
    const event = events.find((candidate) => candidate.eventType === "earnings_expectation_correction");
    expect(event).toMatchObject({ eventDate: "2026-07-15", publishedAt: "2026-07-15T04:00:00.000Z" });
    expect(event?.expectation).toMatchObject({ originalBusinessTime: "2026-06-01", correctionRecordedAt: "2026-07-15T04:00:00.000Z", businessRootSnapshotId: "a", effectiveSnapshotId: "c" });
    const before = buildReviewTasks({ watchItems: [{ ...watchItem(), lastReviewedAt: "2026-07-01" }], events, chains: [], taskStates: [], now: new Date("2026-07-20T00:00:00.000Z"), timeZone: "Asia/Shanghai" }).find((task) => task.ruleType === "earnings_expectation_correction");
    const reloaded = buildReviewTasks({ watchItems: [{ ...watchItem(), lastReviewedAt: "2026-07-01" }], events: buildEarningsExpectationResearchEvents([original, correction], [], [stock()], 0.1, "Asia/Shanghai"), chains: [], taskStates: [], now: new Date("2026-07-21T00:00:00.000Z"), timeZone: "Asia/Shanghai" }).find((task) => task.ruleType === "earnings_expectation_correction");
    const after = buildReviewTasks({ watchItems: [{ ...watchItem(), lastReviewedAt: "2026-07-16" }], events, chains: [], taskStates: [], now: new Date("2026-07-20T00:00:00.000Z"), timeZone: "Asia/Shanghai" });
    expect(before?.id).toBe(reloaded?.id);
    expect(after.some((task) => task.ruleType === "earnings_expectation_correction")).toBe(false);
  });
  it("treats identical exact business instants as equal and emits only a stable data warning", () => {
    const left = snapshot("a", null, { formedAt: "2026-07-14T09:00:00+09:00", formedAtPrecision: "datetime", value: 100 });
    const right = snapshot("z", null, { formedAt: "2026-07-14T00:00:00Z", formedAtPrecision: "datetime", value: 120 });
    const selection = selectEffectiveEarningsExpectations([right, left], "Asia/Tokyo")[0];
    expect(selection.businessOrderStatus).toBe("equal");
    const first = buildEarningsExpectationResearchEvents([left, right], [], [stock()], 0.1, "Asia/Tokyo");
    const reloaded = buildEarningsExpectationResearchEvents([right, left], [], [stock()], 0.1, "Asia/Tokyo");
    expect(first.some((event) => event.eventType === "earnings_expectation_revision")).toBe(false);
    expect(first.some((event) => event.eventType === "earnings_expectation_data_warning" && event.expectation?.businessOrderStatus === "equal")).toBe(true);
    expect(first.map((event) => event.id)).toEqual(reloaded.map((event) => event.id));
    const tasks = buildReviewTasks({ watchItems: [{ ...watchItem(), createdAt: "2026-07-01", lastReviewedAt: "2026-07-01" }], events: first, chains: [], taskStates: [], now: FIXED_NOW, timeZone: "Asia/Tokyo" });
    expect(tasks.some((task) => task.ruleType === "earnings_expectation_revision_up" || task.ruleType === "earnings_expectation_revision_down")).toBe(false);
  });
  it("does not create a new ReviewTask from a late system entry for an older business event", () => {
    const lateEntry = snapshot("late-entry", null, { asOfDate: "2026-06-01", createdAt: "2026-07-14T12:00:00.000Z" });
    const events = buildEarningsExpectationResearchEvents([lateEntry], [], [stock()], 0.1, "Asia/Tokyo");
    const tasks = buildReviewTasks({ watchItems: [watchItem()], events, chains: [], taskStates: [], now: FIXED_NOW, timeZone: "Asia/Tokyo" });
    expect(tasks.some((task) => task.ruleType === "earnings_expectation_added")).toBe(false);
  });
  it("uses the correction terminal formedAt for current ordering while preserving the root audit time", () => {
    const root = snapshot("a", null, { asOfDate: "2026-07-10", formedAt: "2026-07-10T02:00:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "absolute" });
    const other = snapshot("b", null, { asOfDate: "2026-07-11", formedAt: "2026-07-11T02:00:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "absolute", value: 120 });
    const correction = snapshot("c", "a", { asOfDate: "2026-07-12", formedAt: "2026-07-12T02:00:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "absolute", value: 105, createdAt: "2026-07-15T04:00:00.000Z" });
    const history = resolveEffectiveBusinessHistory([correction, other, root], "Asia/Shanghai");
    expect(history.map((node) => node.businessRootSnapshot.id)).toEqual(["b", "a"]);
    expect(history[1]).toMatchObject({ originalBusinessTime: { value: "2026-07-10T02:00:00.000Z" }, effectiveBusinessTime: { value: "2026-07-12T02:00:00.000Z" }, correctionRecordedAt: "2026-07-15T04:00:00.000Z", temporalCorrectionApplied: true });
    expect(history[1].correctedTemporalFields).toEqual(expect.arrayContaining(["asOfDate", "formedAt"]));
    expect(selectEffectiveEarningsExpectations([root, correction, other], "Asia/Shanghai")[0]).toMatchObject({ snapshot: { id: "c" }, businessRootSnapshot: { id: "a" }, originalBusinessTime: { value: "2026-07-10T02:00:00.000Z" }, effectiveBusinessTime: { value: "2026-07-12T02:00:00.000Z" } });
    const events = buildEarningsExpectationResearchEvents([root, correction, other], [], [stock()], 0.1, "Asia/Shanghai");
    const revision = events.find((event) => event.eventType === "earnings_expectation_revision" && event.expectation?.businessRootSnapshotId === "a");
    expect(revision?.expectation).toMatchObject({ originalBusinessTime: "2026-07-10T02:00:00.000Z", effectiveBusinessTime: "2026-07-12T02:00:00.000Z", temporalCorrectionApplied: true });
    expect(events.find((event) => event.eventType === "earnings_expectation_correction")?.publishedAt).toBe("2026-07-15T04:00:00.000Z");
  });
  it("lets a corrected formedAt move a business node earlier instead of leaving root chronology active", () => {
    const root = snapshot("a", null, { asOfDate: "2026-07-12", formedAt: "2026-07-12T02:00:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "absolute" });
    const correction = snapshot("c", "a", { asOfDate: "2026-07-10", formedAt: "2026-07-10T02:00:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "absolute", createdAt: "2026-07-15T04:00:00.000Z" });
    const other = snapshot("b", null, { asOfDate: "2026-07-11", formedAt: "2026-07-11T02:00:00.000Z", formedAtPrecision: "datetime", formedAtResolution: "absolute", value: 120 });
    const selection = selectEffectiveEarningsExpectations([root, correction, other], "Asia/Shanghai")[0];
    expect(selection.snapshot.id).toBe("b");
    expect(resolveEffectiveBusinessHistory([other, correction, root], "Asia/Shanghai").map((node) => node.businessRootSnapshot.id)).toEqual(["a", "b"]);
  });
  it("uses corrected external source time and the terminal of a multi-level chain for availability ordering", () => {
    const external = (id: string, correctsSnapshotId: string | null, sourcePublishedAt: string, overrides: Partial<EarningsExpectationSnapshot> = {}) => snapshot(id, correctsSnapshotId, { sourceCategory: "institution_single", sourceName: "ABC Securities", sourceTitle: "盈利预测", sourceUrl: "https://example.com/report", sourcePublishedAt, sourcePublishedAtPrecision: "datetime", sourcePublishedAtResolution: "absolute", asOfDate: sourcePublishedAt.slice(0, 10), formedAt: `${sourcePublishedAt.slice(0, 10)}T00:00:00.000Z`, formedAtPrecision: "datetime", formedAtResolution: "absolute", ...overrides });
    const root = external("a", null, "2026-07-10T06:00:00.000Z", { createdAt: "2026-07-10T07:00:00.000Z" });
    const firstCorrection = external("c", "a", "2026-07-12T06:00:00.000Z", { createdAt: "2026-07-14T01:00:00.000Z" });
    const terminal = external("d", "c", "2026-07-09T06:00:00.000Z", { createdAt: "2026-07-15T01:00:00.000Z" });
    const other = external("b", null, "2026-07-11T06:00:00.000Z", { value: 120 });
    const history = resolveEffectiveBusinessHistory([firstCorrection, other, terminal, root], "Asia/Shanghai");
    expect(history.map((node) => node.businessRootSnapshot.id)).toEqual(["a", "b"]);
    expect(history[0]).toMatchObject({ effectiveSnapshot: { id: "d" }, correctionRecordedAt: "2026-07-15T01:00:00.000Z", temporalCorrectionApplied: true });
    expect(history[0].correctedTemporalFields).toContain("sourcePublishedAt");
    expect(history[0].originalSourcePublishedAt?.value).toBe("2026-07-10T06:00:00.000Z");
    expect(history[0].effectiveSourcePublishedAt?.value).toBe("2026-07-09T06:00:00.000Z");
    expect(selectEffectiveEarningsExpectations([terminal, root, other, firstCorrection], "Asia/Shanghai")[0].snapshot.id).toBe("b");
  });
});

const FIXED_NOW = new Date("2026-07-14T12:00:00.000Z");

function snapshot(id: string, correctsSnapshotId: string | null = null, overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
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
    sourceName: "用户个人预测",
    sourceTitle: "",
    sourceUrl: null,
    sourcePublishedAt: null,
    sourcePublishedAtPrecision: null,
    sourcePublishedAtResolution: null,
    sourcePublishedAtTimeZone: null,
    sourcePublishedAtCalendarDate: null,
    asOfDate: "2026-07-14",
    formedAt: null,
    formedAtPrecision: "date",
    formedAtResolution: "date",
    formedAtTimeZone: null,
    formedAtCalendarDate: "2026-07-14",
    analystCount: null,
    institutionCount: null,
    ingestionMethod: "manual",
    createdAt: "2026-07-14T12:00:00.000Z",
    createdBy: "local-user",
    sourceVerificationStatus: "verified",
    notes: null,
    correctsSnapshotId,
    correctionScope: correctsSnapshotId ? "value" : null,
    schemaVersion: 2,
    ...overrides,
  };
  if (!("formedAtCalendarDate" in overrides)) value.formedAtCalendarDate = value.asOfDate;
  if (!("sourcePublishedAtCalendarDate" in overrides)) {
    value.sourcePublishedAtCalendarDate = isCalendarDate(value.sourcePublishedAt)
      ? value.sourcePublishedAt
      : isPreciseInstant(value.sourcePublishedAt) && isValidTimeZone(value.sourcePublishedAtTimeZone)
        ? getCalendarDateInTimeZone(value.sourcePublishedAt, value.sourcePublishedAtTimeZone)
        : value.sourcePublishedAt ? String(value.sourcePublishedAt).slice(0, 10) : null;
  }
  return value;
}

function input(overrides: Partial<EarningsExpectationSnapshot> = {}) {
  const { id: _id, createdAt: _createdAt, createdBy: _createdBy, correctsSnapshotId: _corrects, schemaVersion: _schemaVersion, ...value } = snapshot("input", null, overrides);
  return value;
}

function codes(values: EarningsExpectationSnapshot[]) { return validateEarningsExpectationCorrectionGraph(values).issues.map((item) => item.code); }
function settings() { return { revisionReminderThreshold: 0.1, nearZeroThreshold: 1e-9, roundingTolerance: 1e-9, timeZone: "Asia/Tokyo" }; }
function options() { return { now: FIXED_NOW, timeZone: "Asia/Tokyo", validStocks: [{ id: "demo", code: "000001.SZ", market: "A股" as const }] }; }
function repository(storage = new MemoryStorage()) { return new EarningsExpectationRepository(storage, () => FIXED_NOW); }
function stock() { return { id: "demo", name: "测试公司", code: "000001.SZ", market: "A股", industryId: "tech" } as Stock; }
function watchItem(): WatchItem { return { id: "watch", stockId: "demo", createdAt: "2026-07-01", updatedAt: "2026-07-01", status: "观察", priority: "medium", tags: [], reason: "跟踪", thesis: "假设", validationCriteria: [], riskCriteria: [], nextReviewAt: null, lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 }; }
function isValidZone(value: string) { try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(FIXED_NOW); return true; } catch { return false; } }
