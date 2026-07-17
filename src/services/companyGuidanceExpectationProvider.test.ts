import { describe, expect, it, vi } from "vitest";
import type { CompanyGuidanceExpectationDetail, CompanyGuidanceExpectationManifest, EarningsExpectationProviderSnapshot, EarningsExpectationSnapshot, ResearchEvent, Stock, WatchItem } from "../types";
import { createEmptyEarningsExpectationEnvelope, EarningsExpectationRepository } from "./earningsExpectationRepository";
import { EarningsExpectationStore } from "./earningsExpectationStore";
import { CompanyGuidanceExpectationLoadError, aggregateEarningsExpectationEvidence, createCompanyGuidanceExpectationLoader, sourceAnnouncementId } from "./companyGuidanceExpectationProvider";
import { buildEarningsExpectationComparisons } from "./earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "./earningsExpectationEventProvider";
import { buildReviewTasks } from "./reviewTaskProvider";

describe("company guidance expectation provider", () => {
  it("aggregates provider and local snapshots without copying either", () => {
    const provider = providerRecord();
    const local = localSnapshot();
    const result = aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] });
    expect(result.snapshots.map((item) => item.id)).toEqual([provider.snapshot.id, local.id]);
  });

  it("recognizes a local duplicate by official announcement URL and business identity", () => {
    const provider = providerRecord();
    const local = localSnapshot({ sourceUrl: provider.officialSourceUrl });
    const result = aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] });
    expect(result.duplicateOfProviderByLocalId.get(local.id)).toBe(provider.snapshot.id);
  });

  it("keeps a duplicate local record visible for audit", () => {
    const provider = providerRecord();
    const local = localSnapshot({ sourceUrl: provider.officialSourceUrl });
    expect(aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] }).snapshots).toContain(local);
  });

  it("does not count the same official guidance twice in comparisons", () => {
    const provider = providerRecord();
    const local = localSnapshot({ sourceUrl: provider.officialSourceUrl });
    const result = aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] });
    expect(result.comparisonSnapshots.map((item) => item.id)).toEqual([provider.snapshot.id]);
  });

  it("does not collapse a different metric or announcement", () => {
    const provider = providerRecord();
    const local = localSnapshot({ metric: "revenue", sourceUrl: provider.officialSourceUrl });
    expect(aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] }).comparisonSnapshots).toHaveLength(2);
  });

  it("extracts only a numeric CNInfo announcement id", () => {
    expect(sourceAnnouncementId("https://www.cninfo.com.cn/new/disclosure/detail?annoId=1222448664")).toBe("1222448664");
    expect(sourceAnnouncementId("https://example.com/?annoId=not-a-number")).toBeNull();
  });

  it("caches a successful per-company lazy load", async () => {
    const { loader, fetchImpl } = loaderFixture();
    await loader.load("sample");
    await loader.load("sample");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(loader.cacheInfo().results).toBe(1);
  });

  it("deduplicates concurrent per-company requests", async () => {
    const { loader, fetchImpl } = loaderFixture();
    const [left, right] = await Promise.all([loader.load("sample"), loader.load("sample")]);
    expect(left).toBe(right);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed detail request as success", async () => {
    const { manifest, detail } = artifacts();
    let detailAttempts = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("manifest")) return response(manifest);
      detailAttempts += 1;
      return detailAttempts === 1 ? new Response("unavailable", { status: 404 }) : response(detail);
    }) as typeof fetch;
    const loader = createCompanyGuidanceExpectationLoader({ fetchImpl, baseUrl: "/", cryptoImpl: {} as Crypto, retries: 0 });
    await expect(loader.load("sample")).rejects.toMatchObject({ code: "http" });
    await expect(loader.load("sample")).resolves.toMatchObject({ stockId: "sample" });
    expect(loader.cacheInfo().results).toBe(1);
  });

  it("rejects unsafe manifest paths", async () => {
    const { manifest } = artifacts();
    manifest.items[0].relativePath = "data/a-share-company-guidance-expectations/../secret.json";
    const fetchImpl = vi.fn(async () => response(manifest)) as typeof fetch;
    const loader = createCompanyGuidanceExpectationLoader({ fetchImpl, baseUrl: "/", cryptoImpl: {} as Crypto, retries: 0 });
    await expect(loader.load("sample")).rejects.toBeInstanceOf(CompanyGuidanceExpectationLoadError);
  });

  it("rejects a detail identity mismatch", async () => {
    const { loader } = loaderFixture({ detailStockId: "other" });
    await expect(loader.load("sample")).rejects.toMatchObject({ code: "identity" });
  });

  it("verifies the per-company detail checksum when Web Crypto is available", async () => {
    const { manifest, detail } = artifacts();
    const bytes = new TextEncoder().encode(JSON.stringify(detail));
    manifest.items[0].checksumSha256 = await sha256Hex(bytes);
    const validFetch = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(manifest) : response(detail)) as typeof fetch;
    await expect(createCompanyGuidanceExpectationLoader({ fetchImpl: validFetch, baseUrl: "/", cryptoImpl: globalThis.crypto, retries: 0 }).load("sample")).resolves.toMatchObject({ stockId: "sample" });

    manifest.items[0].checksumSha256 = "0".repeat(64);
    const invalidFetch = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(manifest) : response(detail)) as typeof fetch;
    await expect(createCompanyGuidanceExpectationLoader({ fetchImpl: invalidFetch, baseUrl: "/", cryptoImpl: globalThis.crypto, retries: 0 }).load("sample")).rejects.toMatchObject({ code: "checksum" });
  });

  it("rejects a detail that attempts to lose the provider boundary", async () => {
    const { manifest, detail } = artifacts();
    detail.providerSnapshots[0].snapshot.ingestionMethod = "manual";
    manifest.items[0].byteSize = new TextEncoder().encode(JSON.stringify(detail)).byteLength;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(manifest) : response(detail)) as typeof fetch;
    const loader = createCompanyGuidanceExpectationLoader({ fetchImpl, baseUrl: "/", cryptoImpl: {} as Crypto, retries: 0 });
    await expect(loader.load("sample")).rejects.toMatchObject({ code: "schema" });
  });

  it("prevents the user Store API from writing provider data", () => {
    const envelope = createEmptyEarningsExpectationEnvelope(new Date("2026-07-17T00:00:00Z"));
    const store = new EarningsExpectationStore(new EarningsExpectationRepository(null), () => new Date("2026-07-17T00:00:00Z"), () => "local-id");
    const result = store.appendSnapshot(envelope, { ...providerRecord().snapshot, id: undefined, createdBy: undefined });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Provider 快照只读");
    expect(envelope.snapshots).toEqual([]);
  });

  it("keeps provider comparison unavailable when no reliable actual value exists", () => {
    const comparisons = buildEarningsExpectationComparisons([providerRecord().snapshot], [], undefined, "2026-07-17T00:00:00.000Z");
    expect(comparisons).toHaveLength(1);
    expect(comparisons[0]).toMatchObject({ comparabilityStatus: "insufficient_data", comparisonResult: "insufficient_data" });
    expect(comparisons[0].actualValue).toBeNull();
  });

  it("creates a formal range comparison against a later reliable actual disclosure", () => {
    const comparison = buildEarningsExpectationComparisons([providerRecord().snapshot], [actualEvent()], undefined, "2026-07-17T00:00:00.000Z")[0];
    expect(comparison).toMatchObject({ comparabilityStatus: "comparable", comparisonResult: "above", isExAnte: true, actualValue: 250, expectedLowerBound: 100, expectedUpperBound: 200 });
  });

  it("emits stable provider ResearchEvent and de-duplicated ReviewTask identities after reload", () => {
    const snapshot = providerRecord().snapshot;
    const firstComparisons = buildEarningsExpectationComparisons([snapshot], [], undefined, "2026-07-17T00:00:00.000Z");
    const secondComparisons = buildEarningsExpectationComparisons([{ ...snapshot }], [], undefined, "2026-07-18T00:00:00.000Z");
    const firstEvents = buildEarningsExpectationResearchEvents([snapshot], firstComparisons, [providerStock()]);
    const secondEvents = buildEarningsExpectationResearchEvents([{ ...snapshot }], secondComparisons, [providerStock()]);
    expect(secondEvents.map((event) => event.id)).toEqual(firstEvents.map((event) => event.id));
    expect(firstEvents[0].expectation).toMatchObject({ providerId: "cninfo-company-guidance", providerVersion: "1.0.0", sourceAnnouncementId: "1222448664" });

    const firstTasks = buildReviewTasks({ watchItems: [providerWatchItem()], events: firstEvents, chains: [], taskStates: [], now: new Date("2026-07-17T00:00:00.000Z") });
    const reloadedTasks = buildReviewTasks({ watchItems: [providerWatchItem()], events: [...secondEvents, ...secondEvents], chains: [], taskStates: [], now: new Date("2026-07-18T00:00:00.000Z") });
    expect(reloadedTasks.map((task) => task.id)).toEqual(firstTasks.map((task) => task.id));
    expect(new Set(reloadedTasks.map((task) => task.id)).size).toBe(reloadedTasks.length);
  });
});

function loaderFixture(options: { detailStockId?: string } = {}) {
  const { manifest, detail } = artifacts();
  if (options.detailStockId) {
    detail.stockId = options.detailStockId;
    manifest.items[0].byteSize = new TextEncoder().encode(JSON.stringify(detail)).byteLength;
  }
  const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(manifest) : response(detail)) as typeof fetch;
  return { loader: createCompanyGuidanceExpectationLoader({ fetchImpl, baseUrl: "/", cryptoImpl: {} as Crypto, retries: 0 }), fetchImpl };
}

function artifacts() {
  const record = providerRecord();
  const detail: CompanyGuidanceExpectationDetail = {
    schemaVersion: "1.0.0", providerId: "cninfo-company-guidance", providerVersion: "1.0.0", generatedAt: "2026-07-11T07:31:40Z",
    stockId: "sample", stockCode: "000001", companyName: "样本公司", market: "A股", status: "generated_real", totalAnnouncementCount: 1,
    providerSnapshots: [record], exclusions: [], warnings: [],
  };
  const rendered = JSON.stringify(detail);
  const manifest: CompanyGuidanceExpectationManifest = {
    schemaVersion: "1.0.0", providerId: "cninfo-company-guidance", providerVersion: "1.0.0", generatedAt: "2026-07-11T07:31:40Z",
    totalCompanies: 1, companiesWithSnapshots: 1, totalSnapshots: 1,
    items: [{ stockId: "sample", stockCode: "000001", companyName: "样本公司", relativePath: "data/a-share-company-guidance-expectations/sample.json", snapshotCount: 1, excludedAnnouncementCount: 0, byteSize: new TextEncoder().encode(rendered).byteLength, checksumSha256: "a".repeat(64), latestReportPeriod: "2025-12-31", latestSourceDate: "2026-01-15", status: "generated_real" }],
  };
  return { manifest, detail };
}

function response(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }

async function sha256Hex(bytes: Uint8Array) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function providerRecord(): EarningsExpectationProviderSnapshot {
  const snapshot = localSnapshot({
    id: "expectation-provider-official",
    ingestionMethod: "provider",
    sourceName: "样本公司",
    sourceVerificationStatus: "verified",
    formedAt: null,
    formationTimeBasis: "public_disclosure_proxy",
    providerId: "cninfo-company-guidance",
    providerVersion: "1.0.0",
    providerGeneratedAt: "2026-07-11T07:31:40Z",
    sourceAnnouncementId: "1222448664",
    sourceAnnouncementType: "earnings_preview",
    officialPdfUrl: "https://static.cninfo.com.cn/finalpage/2026-01-15/1222448664.PDF",
    artifactChecksum: "b".repeat(64),
  });
  return {
    providerId: "cninfo-company-guidance", providerVersion: "1.0.0", snapshot, sourceAnnouncementId: "1222448664", sourceAnnouncementType: "earnings_preview",
    officialSourceUrl: snapshot.sourceUrl as string, officialPdfUrl: snapshot.officialPdfUrl as string, sourceDate: "2026-01-15", generatedAt: "2026-07-11T07:31:40Z", artifactChecksum: "b".repeat(64),
    sourceParseStatus: "parse_success", sourceExtractionConfidence: "high", sourceTextEvidence: "预计归母净利润100万元至200万元", originalUnitEvidence: "万元", correctionCandidateAnnouncementIds: [], structuredWarnings: [],
  };
}

function localSnapshot(overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
  return {
    id: "local-snapshot", stockId: "sample", market: "A股", reportPeriod: "2025-12-31", periodScope: "full_year", metric: "attributable_net_profit", estimateShape: "range", value: null, lowerBound: 100, upperBound: 200,
    currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "company_guidance", sourceName: "manual source", sourceTitle: "2025年度业绩预告", sourceUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=1222448664",
    sourcePublishedAt: "2026-01-15", sourcePublishedAtPrecision: "date", sourcePublishedAtResolution: "date", sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: "2026-01-15", asOfDate: "2026-01-15",
    formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: "2026-01-15", analystCount: null, institutionCount: null,
    ingestionMethod: "manual", createdAt: "2026-01-15T00:00:00Z", createdBy: "local-user", sourceVerificationStatus: "verified", notes: null, correctsSnapshotId: null, correctionScope: null, schemaVersion: 2,
    ...overrides,
  };
}

function providerStock() {
  return { id: "sample", name: "样本公司", code: "000001.SZ", market: "A股", industryId: "tech", segmentId: "segment", dataMode: "mixed" } as Stock;
}

function providerWatchItem(): WatchItem {
  return { id: "watch-provider", stockId: "sample", createdAt: "2025-01-01", updatedAt: "2025-01-01", status: "观察", priority: "high", tags: [], reason: "跟踪公司指引", thesis: "验证官方披露", validationCriteria: [], riskCriteria: [], nextReviewAt: null, lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 };
}

function actualEvent(): ResearchEvent {
  return {
    id: "actual-2025", stockId: "sample", stockName: "样本公司", stockCode: "000001.SZ", industryId: "tech", market: "A股", eventType: "periodic_report",
    eventDate: "2026-03-31", publishedAt: "2026-03-31", reportPeriod: "2025-12-31", title: "2025年年度报告", summary: "正式报告",
    sourceType: "financial_report", sourceName: "巨潮资讯", sourceUrl: "https://www.cninfo.com.cn/", pdfUrl: null, verificationStatus: "verified", parseStatus: "parse_success", materiality: "high",
    metrics: [{ key: "netProfitAttributableToParent", label: "归母净利润", value: 250, unit: "CNY", periodBasis: "cumulative", sourceAnnouncementId: "actual-anno", sourceFinancialPeriod: "2025-12-31" }],
    performanceDisclosureScope: "all_metrics", relatedAnnouncementIds: ["actual-anno"], relatedFinancialPeriod: "2025-12-31", reviewStatus: "pending", reviewReasons: [], isRestated: false, updatedAt: "2026-03-31",
  };
}
