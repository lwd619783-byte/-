import { describe, expect, it } from "vitest";
import type { StorageLike } from "./watchlistRepository";
import { WatchlistRepository, createEmptyWatchlistEnvelope } from "./watchlistRepository";
import { WatchlistStore, snapshot } from "./watchlistStore";
import type { ReviewEntry, WatchItem, WatchlistStoreEnvelope } from "../types";

const NOW = new Date("2026-07-13T08:00:00.000Z");

class Storage implements StorageLike {
  values = new Map<string, string>();
  fail = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error("write failed"); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("WatchlistStore", () => {
  it("prevents duplicate active watch items for the same stock", () => {
    const { store } = setup();
    const data = envelope([watch("existing", "sugon")]);
    const result = store.createWatchItem(data, createInput("sugon"));
    expect(result.ok).toBe(false);
    expect(result.data.watchItems).toHaveLength(1);
  });

  it("restores an archived item instead of creating a duplicate", () => {
    const { store } = setup();
    const archived = { ...watch("archived", "sugon"), archivedAt: "2026-07-01T00:00:00.000Z" };
    const result = store.createWatchItem(envelope([archived]), createInput("sugon"));
    expect(result.ok).toBe(true);
    expect(result.restored).toBe(true);
    expect(result.data.watchItems).toHaveLength(1);
    expect(result.data.watchItems[0].archivedAt).toBeNull();
  });

  it("copies a sample into a new user item only after explicit load", () => {
    const { store } = setup();
    const sample = { ...watch("sample", "sugon"), source: "sample" as const, tags: ["示例"] };
    const result = store.loadSample(envelope(), sample);
    expect(result.ok).toBe(true);
    expect(result.watchItem?.id).toBe("watch-id-1");
    expect(result.watchItem?.source).toBe("user");
    expect(result.watchItem?.tags).not.toContain("示例");
  });

  it("edits only non-core metadata", () => {
    const { store } = setup();
    const item = watch("watch-1", "sugon");
    const result = store.updateWatchItemMetadata(envelope([item]), item.id, { reason: "新理由", priority: "high", tags: ["核心"], nextReviewAt: "2026-08-01" });
    expect(result.watchItem?.reason).toBe("新理由");
    expect(result.watchItem?.thesis).toBe(item.thesis);
    expect(result.watchItem?.status).toBe(item.status);
  });

  it("appends a review and never overwrites existing history", () => {
    const { store } = setup();
    const item = watch("watch-1", "sugon");
    const old = entry("old", item);
    const result = store.completeReview({ ...envelope([item]), reviewEntries: [old] }, item.id, reviewInput());
    expect(result.ok).toBe(true);
    expect(result.data.reviewEntries).toHaveLength(2);
    expect(result.data.reviewEntries[0]).toEqual(old);
  });

  it("creates corrections as new entries referencing the old record", () => {
    const { store } = setup();
    const item = watch("watch-1", "sugon");
    const old = entry("old", item);
    const result = store.appendCorrection({ ...envelope([item]), reviewEntries: [old] }, item.id, old.id, reviewInput());
    expect(result.ok).toBe(true);
    expect(result.data.reviewEntries[1].correctsReviewEntryId).toBe("old");
    expect(result.data.reviewEntries[0]).toEqual(old);
  });

  it("captures complete before and after snapshots", () => {
    const { store } = setup();
    const item = watch("watch-1", "sugon");
    const result = store.completeReview(envelope([item]), item.id, { ...reviewInput(), thesis: "新假设", status: "等业绩验证" });
    expect(result.reviewEntry?.beforeSnapshot).toEqual(snapshot(item));
    expect(result.reviewEntry?.afterSnapshot).toEqual({ status: "等业绩验证", thesis: "新假设", validationCriteria: ["新验证"], riskCriteria: ["新风险"] });
  });

  it("atomically updates item, appends entry, and acknowledges handled tasks", () => {
    const { store } = setup();
    const item = watch("watch-1", "sugon");
    const result = store.completeReview(envelope([item]), item.id, { ...reviewInput(), handledTaskIds: ["task-1"] });
    expect(result.ok).toBe(true);
    expect(result.data.watchItems[0].lastReviewedAt).toBe(NOW.toISOString());
    expect(result.data.reviewEntries).toHaveLength(1);
    expect(result.data.reviewTaskStates[0]).toMatchObject({ taskId: "task-1", status: "acknowledged" });
  });

  it("leaves no partial state when the atomic save fails", () => {
    const { store, storage } = setup();
    const item = watch("watch-1", "sugon");
    const previous = envelope([item]);
    storage.fail = true;
    const result = store.completeReview(previous, item.id, reviewInput());
    expect(result.ok).toBe(false);
    expect(result.data).toBe(previous);
    expect(result.data.reviewEntries).toEqual([]);
    expect(result.data.watchItems[0].lastReviewedAt).toBeNull();
  });

  it("preserves missing values as null rather than converting them to zero", () => {
    const { store } = setup();
    const item = watch("watch-1", "sugon");
    const result = store.completeReview(envelope([item]), item.id, { ...reviewInput(), nextReviewAt: null, evidenceRefs: [{ eventId: "warning", reportPeriod: undefined }] });
    expect(result.data.watchItems[0].nextReviewAt).toBeNull();
    expect(result.reviewEntry?.nextReviewAt).toBeNull();
    expect(result.reviewEntry?.evidenceRefs[0].reportPeriod).toBeUndefined();
  });

  it("persists acknowledged, dismissed and snoozed task state without changing WatchItem", () => {
    const { store } = setup();
    const item = watch("watch-1", "sugon");
    const source = envelope([item]);
    const result = store.setTaskState(source, "task-1", "snoozed", "2026-07-20");
    expect(result.ok).toBe(true);
    expect(result.data.reviewTaskStates[0]).toMatchObject({ status: "snoozed", snoozedUntil: "2026-07-20" });
    expect(result.data.watchItems[0]).toEqual(item);
  });
});

function setup() {
  const storage = new Storage();
  let id = 0;
  const repository = new WatchlistRepository(storage, () => NOW);
  return { storage, store: new WatchlistStore(repository, () => NOW, (prefix) => `${prefix}-id-${++id}`) };
}
function envelope(watchItems: WatchItem[] = []): WatchlistStoreEnvelope { return { ...createEmptyWatchlistEnvelope(NOW), watchItems }; }
function watch(id: string, stockId: string): WatchItem { return { id, stockId, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", status: "观察", priority: "medium", tags: [], reason: "理由", thesis: "旧假设", validationCriteria: ["旧验证"], riskCriteria: ["旧风险"], nextReviewAt: "2026-07-13", lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 }; }
function createInput(stockId: string) { return { stockId, reason: "理由", priority: "medium" as const, tags: [], nextReviewAt: null, thesis: "假设", validationCriteria: ["验证"], riskCriteria: ["风险"] }; }
function reviewInput() { return { triggerType: "manual" as const, triggerEventIds: ["event-1"], handledTaskIds: [], summary: "新证据", rationale: "判断依据", evidenceRefs: [{ eventId: "event-1", sourceUrl: "https://example.com/official" }], decision: "保持原判断", thesis: "新假设", validationCriteria: ["新验证"], riskCriteria: ["新风险"], status: "观察" as const, nextReviewAt: "2026-08-01", correctsReviewEntryId: null }; }
function entry(id: string, item: WatchItem): ReviewEntry { return { id, watchItemId: item.id, createdAt: "2026-07-02T00:00:00.000Z", triggerType: "manual", triggerEventIds: [], beforeSnapshot: snapshot(item), afterSnapshot: snapshot(item), summary: "旧记录", rationale: "旧理由", evidenceRefs: [], decision: "保持", nextReviewAt: item.nextReviewAt, correctsReviewEntryId: null }; }
