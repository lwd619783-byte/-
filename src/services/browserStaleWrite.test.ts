import { describe, expect, it } from "vitest";
import type { EarningsExpectationSnapshot } from "../types";
import { WatchlistRepository, WATCHLIST_STORAGE_KEY, createEmptyWatchlistEnvelope } from "./watchlistRepository";
import { WatchlistStore } from "./watchlistStore";
import { EarningsExpectationRepository, EARNINGS_EXPECTATION_STORAGE_KEY, createEmptyEarningsExpectationEnvelope } from "./earningsExpectationRepository";
import { EarningsExpectationStore } from "./earningsExpectationStore";

const NOW = new Date("2026-07-13T08:00:00.000Z");
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const watchInput = { stockId: "demo", reason: "synthetic", priority: "medium" as const, tags: [], nextReviewAt: null, thesis: "synthetic", validationCriteria: [], riskCriteria: [] };
const reviewInput = { triggerType: "manual" as const, triggerEventIds: [], handledTaskIds: [], summary: "A review", rationale: "synthetic", evidenceRefs: [], decision: "保持", thesis: "synthetic", validationCriteria: [], riskCriteria: [], status: "观察" as const, nextReviewAt: null };
function expectationInput() {
  return {
    stockId: "demo", market: "A股", reportPeriod: "2026-06-30", periodScope: "half_year", metric: "revenue", estimateShape: "point", value: 100, lowerBound: null, upperBound: null,
    currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "user_estimate", sourceName: "用户个人预测", sourceTitle: "", sourceUrl: null,
    sourcePublishedAt: null, sourcePublishedAtPrecision: null, sourcePublishedAtResolution: null, sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: null,
    asOfDate: "2026-06-01", formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: "2026-06-01",
    analystCount: null, institutionCount: null, ingestionMethod: "manual", sourceVerificationStatus: "verified", notes: null, correctionScope: null,
  } satisfies Omit<EarningsExpectationSnapshot, "id" | "createdAt" | "createdBy" | "correctsSnapshotId" | "schemaVersion">;
}

describe("browser persisted base protection", () => {
  it("Watchlist S0 → A review → stale B review preserves A history", () => {
    const storage = new MemoryStorage();
    const repoA = new WatchlistRepository(storage, () => NOW);
    const storeA = new WatchlistStore(repoA, () => NOW, (prefix) => `${prefix}-A`);
    expect(storeA.createWatchItem(repoA.load().data, watchInput).ok).toBe(true);
    const repoB = new WatchlistRepository(storage, () => NOW);
    const storeB = new WatchlistStore(repoB, () => NOW, (prefix) => `${prefix}-B`);
    const a = repoA.load().data;
    const b = repoB.load().data;
    expect(storeA.completeReview(a, a.watchItems[0].id, reviewInput).ok).toBe(true);
    const afterA = storage.getItem(WATCHLIST_STORAGE_KEY);
    const rejected = storeB.completeReview(b, b.watchItems[0].id, { ...reviewInput, summary: "B review" });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toContain("已变化");
    expect(rejected.data).toBe(b);
    expect(storage.getItem(WATCHLIST_STORAGE_KEY)).toBe(afterA);
    expect(repoA.load().data.reviewEntries.map((entry) => entry.summary)).toEqual(["A review"]);
  });

  it("Earnings S0 → A correction → stale B correction preserves A history", () => {
    const storage = new MemoryStorage();
    const repoA = new EarningsExpectationRepository(storage, () => NOW);
    const storeA = new EarningsExpectationStore(repoA, () => NOW, () => "A-correction");
    expect(storeA.appendSnapshot(repoA.load().data, { ...expectationInput(), id: "root" }).ok).toBe(true);
    const repoB = new EarningsExpectationRepository(storage, () => NOW);
    const storeB = new EarningsExpectationStore(repoB, () => NOW, () => "B-correction");
    const a = repoA.load().data;
    const b = repoB.load().data;
    expect(storeA.appendCorrection(a, "root", { ...expectationInput(), value: 120 }).ok).toBe(true);
    const afterA = storage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY);
    const rejected = storeB.appendCorrection(b, "root", { ...expectationInput(), value: 130 });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toContain("已变化");
    expect(rejected.data).toBe(b);
    expect(storage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)).toBe(afterA);
    expect(repoA.load().data.snapshots.map((entry) => entry.id)).toEqual(["root", "A-correction"]);
  });

  registerBaseCases("watchlist", WATCHLIST_STORAGE_KEY, (storage) => new WatchlistRepository(storage, () => NOW), () => createEmptyWatchlistEnvelope(NOW));
  registerBaseCases("earnings", EARNINGS_EXPECTATION_STORAGE_KEY, (storage) => new EarningsExpectationRepository(storage, () => NOW), () => createEmptyEarningsExpectationEnvelope(NOW));

  it("Watchlist import merge and replacement reject a stale reviewed base before backing it up", () => {
    const storage = new MemoryStorage();
    const repo = new WatchlistRepository(storage, () => NOW);
    const stale = repo.load().data;
    const current = { ...stale, otherPageHistory: ["A"] };
    expect(repo.save(current, stale).ok).toBe(true);
    const afterA = storage.getItem(WATCHLIST_STORAGE_KEY);
    expect(repo.mergeImport(createEmptyWatchlistEnvelope(NOW), stale).ok).toBe(false);
    expect(repo.replaceImport(createEmptyWatchlistEnvelope(NOW), stale).ok).toBe(false);
    expect(storage.values.size).toBe(1);
    expect(storage.getItem(WATCHLIST_STORAGE_KEY)).toBe(afterA);
    const replacement = repo.replaceImport(createEmptyWatchlistEnvelope(NOW), repo.load().data);
    expect(replacement.ok, replacement.error ?? "replacement").toBe(true);
    expect(storage.getItem(replacement.backupKey!)).toBe(afterA);
  });

  it("Earnings import merge and replacement reject stale base and preserve the latest backup", () => {
    const storage = new MemoryStorage();
    const repo = new EarningsExpectationRepository(storage, () => NOW);
    const stale = repo.load().data;
    const store = new EarningsExpectationStore(repo, () => NOW, () => "root");
    expect(store.appendSnapshot(stale, expectationInput()).ok).toBe(true);
    const afterA = storage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY);
    const incoming = { ...expectationInput(), id: "import", metric: "attributable_net_profit", value: 150, asOfDate: "2026-06-02", formedAtCalendarDate: "2026-06-02", createdAt: NOW.toISOString(), createdBy: "local-user", correctsSnapshotId: null, schemaVersion: 2 };
    const options = { validStocks: [{ id: "demo", code: "000001.SZ", market: "A股" as const }], now: NOW };
    const preview = repo.previewJson({ schemaVersion: 2, snapshots: [incoming] }, stale, options);
    expect(preview.ok).toBe(true);
    expect(repo.importPreview(preview, stale, "json_import", "merge").ok).toBe(false);
    expect(repo.importPreview(preview, stale, "json_import", "replace").ok).toBe(false);
    expect(storage.values.size).toBe(1);
    expect(storage.getItem(EARNINGS_EXPECTATION_STORAGE_KEY)).toBe(afterA);
    const current = repo.load().data;
    const refreshedPreview = repo.previewJson({ schemaVersion: 2, snapshots: [incoming] }, current, options);
    const replacement = repo.importPreview(refreshedPreview, current, "json_import", "replace");
    expect(replacement.ok, replacement.error ?? "replacement").toBe(true);
    expect(storage.getItem(replacement.backupKey!)).toBe(afterA);
  });
});

interface TestRepository<T> {
  load(): { data: T };
  save(data: T, base?: T): { ok: boolean };
  reset(): { ok: boolean };
}
function registerBaseCases<T extends object>(kind: string, key: string, createRepo: (storage: MemoryStorage) => TestRepository<T>, empty: () => T) {
    function setup() {
      const storage = new MemoryStorage();
      return { storage, key, repo: createRepo(storage), empty };
    }
    it(`${kind} binds raw bytes even when updatedAt is unchanged`, () => {
      const { storage, key, repo } = setup();
      const base = repo.load().data;
      // Both workflow envelopes support unknown legal fields; timestamp is deliberately unchanged.
      storage.setItem(key, JSON.stringify({ ...base, otherPageHistory: ["A"] }));
      expect(repo.save(base).ok).toBe(false);
      expect(JSON.parse(storage.getItem(key)!).otherPageHistory).toEqual(["A"]);
    });
    it(`${kind} reloading does not bless an older envelope in the same repository`, () => {
      const { repo } = setup();
      const old = repo.load().data;
      const next = { ...old, otherPageHistory: ["A"] };
      expect(repo.save(next, old).ok).toBe(true);
      repo.load();
      expect(repo.save(old).ok).toBe(false);
    });
    it(`${kind} rejects unbound memory after a persisted base exists`, () => {
      const { repo, empty } = setup();
      expect(repo.save(empty()).ok).toBe(true);
      expect(repo.save(empty()).ok).toBe(false);
    });
    it(`${kind} preserves corrupt raw on ordinary save; explicit reset permits a fresh load`, () => {
      const { storage, key, repo } = setup();
      storage.setItem(key, "{broken");
      const broken = repo.load();
      expect(repo.save(broken.data).ok).toBe(false);
      expect(storage.getItem(key)).toBe("{broken");
      expect(repo.reset().ok).toBe(true);
      expect(repo.save(repo.load().data).ok).toBe(true);
    });
    it(`${kind} migration keeps the exact original raw identity`, () => {
      const { storage, repo } = setup();
      const raw = JSON.stringify(empty(), null, 2);
      storage.setItem(key, raw);
      expect(repo.save(repo.load().data).ok).toBe(true);
    });
    it(`${kind} failed writes do not advance the remembered base`, () => {
      const { storage, repo } = setup();
      const base = repo.load().data;
      const setItem = storage.setItem.bind(storage);
      storage.setItem = () => { throw new Error("quota"); };
      expect(repo.save({ ...base }, base).ok).toBe(false);
      storage.setItem = setItem;
      expect(repo.save({ ...base }, base).ok).toBe(true);
    });
}
