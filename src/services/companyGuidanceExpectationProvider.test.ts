import { describe, expect, it, vi } from "vitest";
import contractFixtures from "../../scripts/company-guidance-expectations/contract-fixtures.json";
import type { CompanyGuidanceExpectationDetail, CompanyGuidanceExpectationDetailProviderRecord, CompanyGuidanceExpectationManifest, CompanyGuidanceExpectationSummary, CompanyGuidanceExpectationSummaryAudit, CompanyGuidanceExpectationWorkflowIndex, EarningsExpectationProviderSnapshot, EarningsExpectationSnapshot, ResearchEvent, Stock, WatchItem } from "../types";
import { createEmptyEarningsExpectationEnvelope, EarningsExpectationRepository } from "./earningsExpectationRepository";
import { EarningsExpectationStore } from "./earningsExpectationStore";
import { CompanyGuidanceExpectationLoadError, aggregateEarningsExpectationEvidence, buildProviderContentConflictEvents, createCompanyGuidanceExpectationLoader, parseOfficialCninfoAnnouncementUrl, parseOfficialCninfoPdfUrl, selectActiveCompanyGuidanceProviderRecords, sourceAnnouncementId } from "./companyGuidanceExpectationProvider";
import { buildEarningsExpectationComparisons } from "./earningsExpectationComparisonProvider";
import { buildEarningsExpectationResearchEvents } from "./earningsExpectationEventProvider";
import { buildReviewTasks } from "./reviewTaskProvider";

describe("company guidance expectation provider V2", () => {
  it("aggregates provider and local snapshots without copying either", () => {
    const provider = providerRecord(); const local = localSnapshot();
    expect(aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] }).snapshots.map((item) => item.id)).toEqual([provider.snapshot.id, local.id]);
  });

  it("classifies exact duplicate, metadata difference, content conflict and independent", () => {
    const provider = providerRecord();
    const exact = localSnapshot({ id: "exact", sourceName: provider.snapshot.sourceName, createdBy: provider.snapshot.createdBy, notes: provider.snapshot.notes });
    const metadata = localSnapshot({ id: "metadata" });
    const conflict = localSnapshot({ id: "conflict", lowerBound: 101 });
    const independent = localSnapshot({ id: "independent", sourceUrl: "https://example.com/?annoId=1222448664" });
    const result = aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [exact, metadata, conflict, independent] });
    expect([...result.relationByLocalId.values()].map((item) => item.relation)).toEqual(["exact_duplicate", "metadata_difference", "content_conflict", "independent"]);
    expect(result.relationByLocalId.get("conflict")?.conflictingFields).toContain("lowerBound");
    expect(result.comparisonSnapshots.map((item) => item.id)).toEqual([provider.snapshot.id, independent.id]);
    expect(result.snapshots).toContain(conflict);
  });

  it("does not collapse a different metric or announcement", () => {
    const provider = providerRecord();
    const local = localSnapshot({ metric: "revenue", sourceUrl: provider.officialSourceUrl });
    expect(aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] }).comparisonSnapshots).toHaveLength(2);
  });

  it("strictly accepts only canonical CNInfo announcement URLs", () => {
    expect(sourceAnnouncementId("https://www.cninfo.com.cn/new/disclosure/detail?annoId=1222448664")).toBe("1222448664");
    for (const bad of contractFixtures.invalidAnnouncementUrls) expect(parseOfficialCninfoAnnouncementUrl(bad)).toBeNull();
    expect(parseOfficialCninfoPdfUrl(contractFixtures.validPdfUrl, contractFixtures.announcementId)?.announcementId).toBe(contractFixtures.announcementId);
    for (const bad of contractFixtures.invalidPdfUrls) expect(parseOfficialCninfoPdfUrl(bad, contractFixtures.announcementId)).toBeNull();
  });

  it("loads and verifies the global workflow index independently of a stock detail", async () => {
    const fixture = await loaderFixture();
    await expect(fixture.loader.loadWorkflow()).resolves.toMatchObject({ currentSnapshotCount: 1 });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    expect(fixture.loader.cacheInfo().results).toBe(0);
  });

  it("caches a successful per-company lazy load", async () => {
    const { loader, fetchImpl } = await loaderFixture();
    await loader.load("sample"); await loader.load("sample");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(loader.cacheInfo().results).toBe(1);
  });

  it("deduplicates concurrent per-company requests", async () => {
    const { loader, fetchImpl } = await loaderFixture();
    const [left, right] = await Promise.all([loader.load("sample"), loader.load("sample")]);
    expect(left).toBe(right); expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed detail request as success", async () => {
    const fixture = await artifacts(); let attempts = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("manifest")) return response(fixture.manifest);
      attempts += 1; return attempts === 1 ? new Response("unavailable", { status: 404 }) : response(fixture.detail);
    }) as typeof fetch;
    const loader = providerLoader(fixture, fetchImpl);
    await expect(loader.load("sample")).rejects.toMatchObject({ code: "http" });
    await expect(loader.load("sample")).resolves.toMatchObject({ stockId: "sample" });
  });

  it("loadMany isolates one company failure and returns partial", async () => {
    const fixture = await artifacts();
    fixture.manifest.items.push({ ...fixture.manifest.items[0], stockId: "broken", stockCode: "000002", relativePath: "data/a-share-company-guidance-expectations/broken.json" });
    fixture.manifest.totalCompanies = 2; fixture.manifest.totalSnapshots = 2; fixture.manifest.companiesWithSnapshots = 2;
    fixture.summary = summaryFromManifest(fixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : String(url).includes("broken") ? new Response("bad", { status: 404 }) : response(fixture.detail)) as typeof fetch;
    const loader = providerLoader(fixture, fetchImpl);
    const result = await loader.loadMany(["sample", "broken"]);
    expect(result.status).toBe("partial"); expect(Object.keys(result.successes)).toEqual(["sample"]); expect(result.failures[0]).toMatchObject({ stockId: "broken", code: "http" });
  });

  it("rejects unsafe manifest paths", async () => {
    const fixture = await artifacts(); fixture.manifest.items[0].relativePath = "data/a-share-company-guidance-expectations/../secret.json";
    const loader = providerLoader(fixture, vi.fn(async () => response(fixture.manifest)) as typeof fetch);
    await expect(loader.load("sample")).rejects.toBeInstanceOf(CompanyGuidanceExpectationLoadError);
  });

  it("rejects detail checksum and identity mismatches", async () => {
    const checksumFixture = await loaderFixture({ manifestChecksum: "0".repeat(64) });
    await expect(checksumFixture.loader.load("sample")).rejects.toMatchObject({ code: "checksum" });
    const identityFixture = await loaderFixture({ detailStockId: "other" });
    await expect(identityFixture.loader.load("sample")).rejects.toMatchObject({ code: "identity" });
  });

  it("rejects jointly corrupted detail and manifest statuses from the runtime load path", async () => {
    const fixture = await artifacts();
    fixture.detail.status = "partial";
    fixture.detail.quality.status = "partial";
    fixture.manifest.items[0].status = "partial";
    fixture.summary = summaryFromManifest(fixture.manifest);
    await finalizeDetail(fixture);
    const loader = providerLoader(fixture, vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch);
    await expect(loader.load("sample")).rejects.toMatchObject({ code: "identity", message: expect.stringContaining("detail_status") });
  });

  it("rejects runtime detail quality timestamp drift with an explicit schema error", async () => {
    const fixture = await artifacts();
    fixture.detail.quality.updatedAt = "2026-07-12T07:31:40Z";
    await finalizeDetail(fixture);
    const loader = providerLoader(fixture, vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch);
    await expect(loader.load("sample")).rejects.toMatchObject({ code: "schema", message: expect.stringContaining("detail_quality_contract") });
  });

  for (const [label, mutate, code, errorCode] of [
    ["empty target member", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.targetAnnouncements.push({} as never); fixture.detail.totalAnnouncementCount += 1; }, "schema", "detail_target_contract"],
    ["empty exclusion member", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.exclusions.push({} as never); }, "schema", "detail_exclusion_contract"],
    ["snapshot orphaned by target deletion", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.targetAnnouncements = []; }, "identity", "detail_snapshot_orphan"],
    ["duplicate target announcement", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.targetAnnouncements.push(structuredClone(fixture.detail.targetAnnouncements[0])); fixture.detail.totalAnnouncementCount += 1; }, "schema", "detail_target_duplicate"],
    ["snapshot stock projection drift", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.providerSnapshots[0].snapshot.stockId = "other"; }, "identity", "detail_projection_mismatch"],
    ["cross-company warning", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.warnings.push({ code: "revision_without_reliable_range", sourceAnnouncementId: "9999999", candidateAnnouncementIds: [], message: "cross-company" }); }, "schema", "detail_warning_contract"],
    ["quality source URL drift", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.quality.sourceUrl += "?forged=1"; }, "schema", "detail_quality_contract"],
    ["Date.parse-tolerated invalid epoch", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.detail.generatedAt = "2026-02-30T07:31:40Z"; fixture.detail.quality.updatedAt = fixture.detail.generatedAt; }, "schema", "detail_generation_epoch"],
  ] as const) it(`runtime deep validation rejects ${label}`, async () => {
    const fixture = await artifacts();
    mutate(fixture);
    await finalizeDetail(fixture);
    fixture.summary = summaryFromManifest(fixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).load("sample")).rejects.toMatchObject({ code, message: expect.stringContaining(errorCode) });
  });

  for (const [label, expectedError, mutate] of [
    ["low extraction confidence", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.sourceExtractionConfidence = "low" as never; }],
    ["point-shaped values", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { Object.assign(record.snapshot, { estimateShape: "point", value: 150, lowerBound: null, upperBound: null }); }],
    ["USD currency", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.currency = "USD"; }],
    ["million-yuan unit", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.unit = "million_yuan" as never; }],
    ["IFRS accounting", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.accountingBasis = "IFRS" as never; }],
    ["EPS metric", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.metric = "eps" as never; }],
    ["operating-cash-flow metric", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.metric = "operating_cash_flow" as never; }],
    ["Hong Kong market", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.market = "港股"; }],
    ["snapshot providerId drift", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.providerId = "forged-provider"; }],
    ["snapshot providerVersion drift", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.providerVersion = "9.9.9"; }],
    ["published precision drift", "provider_snapshot_time_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.sourcePublishedAtPrecision = "datetime"; record.snapshot.sourcePublishedAtResolution = "absolute"; }],
    ["formed precision drift", "provider_snapshot_time_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.formedAtPrecision = "datetime"; record.snapshot.formedAtResolution = "absolute"; }],
    ["company sourceName drift", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.sourceName = "Forged Company"; }],
    ["createdBy drift", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.createdBy = "forged-user"; }],
    ["schemaVersion drift", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.schemaVersion = 1; }],
    ["analystCount drift", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.analystCount = 1; }],
    ["institutionCount drift", "provider_snapshot_product_contract", (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.snapshot.institutionCount = 1; }],
  ] as const) it(`rejects recomputed Provider product attack: ${label}`, async () => {
    const fixture = await artifacts();
    mutate(fixture.detail.providerSnapshots[0]);
    await recomputeProviderDerivations(fixture.detail.providerSnapshots[0]);
    await finalizeDetail(fixture);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).load("sample")).rejects.toMatchObject({ message: expect.stringContaining(expectedError) });
  });

  it("rejects snapshot artifact checksum drift after all outer detail checksums are recomputed", async () => {
    const fixture = await artifacts();
    fixture.detail.providerSnapshots[0].snapshot.artifactChecksum = "f".repeat(64);
    await finalizeDetail(fixture);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).load("sample")).rejects.toMatchObject({ code: "identity", message: expect.stringContaining("provider_snapshot_mirror_contract") });
  });

  for (const [label, mutate] of [
    ["deleted raw text with retained hash", async (record: CompanyGuidanceExpectationDetailProviderRecord) => { delete (record as Partial<CompanyGuidanceExpectationDetailProviderRecord>).sourceTextEvidence; }],
    ["deleted raw text with arbitrary recomputed hash", async (record: CompanyGuidanceExpectationDetailProviderRecord) => { delete (record as Partial<CompanyGuidanceExpectationDetailProviderRecord>).sourceTextEvidence; record.sourceTextEvidenceHash = "a".repeat(64); await recomputeProviderDerivations(record); }],
    ["raw text/hash mismatch", async (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.sourceTextEvidence = "forged evidence 万元"; }],
    ["empty raw text", async (record: CompanyGuidanceExpectationDetailProviderRecord) => { record.sourceTextEvidence = ""; record.sourceTextEvidenceHash = await sha256Hex(new Uint8Array()); await recomputeProviderDerivations(record); }],
  ] as const) it(`rejects detail evidence attack: ${label}`, async () => {
    const fixture = await artifacts();
    await mutate(fixture.detail.providerSnapshots[0]);
    await finalizeDetail(fixture);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).load("sample")).rejects.toMatchObject({ message: expect.stringContaining("provider_snapshot_evidence_contract") });
  });

  it("rejects raw evidence injected into the workflow projection", async () => {
    const fixture = await artifacts();
    Object.assign(fixture.workflow.records[0], { sourceTextEvidence: "forged evidence 万元" });
    await finalizeWorkflow(fixture);
    fixture.summary = summaryFromManifest(fixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.workflow)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).loadWorkflow()).rejects.toMatchObject({ message: expect.stringContaining("provider_snapshot_evidence_contract") });
  });

  it("rejects record/snapshot business-predecessor splits after detail and workflow checksums are recomputed", async () => {
    const fakePredecessor = `company-guidance-version-${"f".repeat(64)}`;
    const detailFixture = await artifacts();
    detailFixture.detail.providerSnapshots[0].snapshot.providerBusinessRevisionPredecessorSnapshotId = fakePredecessor;
    await finalizeDetail(detailFixture);
    const detailFetch = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(detailFixture.manifest) : response(detailFixture.detail)) as typeof fetch;
    await expect(providerLoader(detailFixture, detailFetch).load("sample")).rejects.toMatchObject({ code: "identity", message: expect.stringContaining("provider_business_revision_mirror") });

    const workflowFixture = await artifacts();
    workflowFixture.workflow.records[0].snapshot.providerBusinessRevisionPredecessorSnapshotId = fakePredecessor;
    await finalizeWorkflow(workflowFixture);
    workflowFixture.summary = summaryFromManifest(workflowFixture.manifest);
    const workflowFetch = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(workflowFixture.manifest) : response(workflowFixture.workflow)) as typeof fetch;
    await expect(providerLoader(workflowFixture, workflowFetch).loadWorkflow()).rejects.toMatchObject({ code: "identity", message: expect.stringContaining("provider_business_revision_mirror") });
  });

  for (const [field, mutate, expectedCode] of [
    ["stockCode", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].stockCode = "000002"; }, "manifest_stockCode"],
    ["companyName", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].companyName = "Forged Company"; }, "manifest_companyName"],
    ["status", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].status = "partial"; }, "manifest_status"],
    ["snapshotCount", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].snapshotCount = 2; fixture.manifest.totalSnapshots = 2; }, "manifest_snapshotCount"],
    ["historicalVersionCount", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].historicalVersionCount = 1; fixture.manifest.totalHistoricalVersions = 1; }, "manifest_historicalVersionCount"],
    ["excludedAnnouncementCount", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].excludedAnnouncementCount = 1; }, "manifest_excludedAnnouncementCount"],
    ["latestReportPeriod", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].latestReportPeriod = "2024-12-31"; }, "manifest_latestReportPeriod"],
    ["latestSourceDate", (fixture: Awaited<ReturnType<typeof artifacts>>) => { fixture.manifest.items[0].latestSourceDate = "2026-01-14"; }, "manifest_latestSourceDate"],
  ] as const) it(`runtime re-derives manifest ${field}`, async () => {
    const fixture = await artifacts();
    mutate(fixture);
    fixture.summary = summaryFromManifest(fixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).load("sample")).rejects.toMatchObject({ code: "identity", message: expect.stringContaining(expectedCode) });
  });

  it("runtime rejects a safe-looking summary projection that diverges from manifest", async () => {
    const fixture = await artifacts();
    fixture.summary.items.sample.companyName = "Forged Summary Company";
    const fetchImpl = vi.fn(async () => response(fixture.manifest)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).load("sample")).rejects.toMatchObject({ code: "identity", message: expect.stringContaining("summary projection mismatch") });
  });

  it("runtime rejects summary and manifest/detail cross-generation epochs even when each timestamp is individually valid", async () => {
    const summaryFixture = await artifacts();
    summaryFixture.summary.generatedAt = "2026-07-12T07:31:40Z";
    summaryFixture.summary.sourceGeneratedAt = summaryFixture.summary.generatedAt;
    await expect(providerLoader(summaryFixture, vi.fn(async () => response(summaryFixture.manifest)) as typeof fetch).load("sample")).rejects.toMatchObject({ code: "schema", message: expect.stringContaining("summary generation contract") });

    const manifestFixture = await artifacts();
    manifestFixture.manifest.generatedAt = "2026-07-12T07:31:40Z";
    manifestFixture.summary = summaryFromManifest(manifestFixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(manifestFixture.manifest) : response(manifestFixture.detail)) as typeof fetch;
    await expect(providerLoader(manifestFixture, fetchImpl).load("sample")).rejects.toMatchObject({ code: "schema", message: expect.stringContaining("detail_generation_epoch") });
  });

  it("runtime keeps all-targets-excluded semantics partial while allowing a higher-level generation gate to remain separate", async () => {
    const fixture = await artifacts();
    fixture.detail.providerSnapshots = [];
    fixture.detail.exclusions = [exclusionRecord()];
    fixture.detail.status = "partial";
    fixture.detail.quality.status = "partial";
    Object.assign(fixture.manifest.items[0], { snapshotCount: 0, excludedAnnouncementCount: 1, latestReportPeriod: null, latestSourceDate: null, status: "partial" });
    fixture.manifest.totalSnapshots = 0;
    fixture.manifest.companiesWithSnapshots = 0;
    fixture.workflow.records = [];
    fixture.workflow.currentSnapshotCount = 0;
    await finalizeDetail(fixture); await finalizeWorkflow(fixture);
    fixture.summary = summaryFromManifest(fixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : String(url).includes("workflow-index") ? response(fixture.workflow) : response(fixture.detail)) as typeof fetch;
    const loader = providerLoader(fixture, fetchImpl);
    await expect(loader.load("sample")).resolves.toMatchObject({ status: "partial" });
    await expect(loader.loadWorkflow()).resolves.toMatchObject({ currentSnapshotCount: 0 });
    expect(fixture.summary.status).toBe("partial");
  });

  it("runtime fails closed on a historical-only migration state", async () => {
    const fixture = await artifacts();
    const historical = fixture.detail.providerSnapshots.pop() as CompanyGuidanceExpectationDetailProviderRecord;
    historical.isCurrentVersion = false;
    historical.snapshot.isCurrentProviderVersion = false;
    fixture.detail.historicalProviderVersions.push(historical);
    fixture.detail.status = "partial";
    fixture.detail.quality.status = "partial";
    Object.assign(fixture.manifest.items[0], { snapshotCount: 0, historicalVersionCount: 1, latestReportPeriod: null, latestSourceDate: null, status: "partial" });
    fixture.manifest.totalSnapshots = 0;
    fixture.manifest.totalHistoricalVersions = 1;
    fixture.manifest.companiesWithSnapshots = 0;
    await finalizeDetail(fixture);
    fixture.summary = summaryFromManifest(fixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.detail)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).load("sample")).rejects.toMatchObject({ code: "identity", message: expect.stringContaining("detail_historical_only") });
  });

  it("runtime rejects a workflow from a different valid generation epoch", async () => {
    const fixture = await artifacts();
    fixture.workflow.generatedAt = "2026-07-12T07:31:40Z";
    for (const record of fixture.workflow.records) { record.generatedAt = fixture.workflow.generatedAt; record.snapshot.providerGeneratedAt = fixture.workflow.generatedAt; }
    await finalizeWorkflow(fixture);
    fixture.summary = summaryFromManifest(fixture.manifest);
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.workflow)) as typeof fetch;
    await expect(providerLoader(fixture, fetchImpl).loadWorkflow()).rejects.toMatchObject({ code: "identity", message: expect.stringContaining("workflow_generation_epoch") });
  });

  it("rejects a workflow checksum or current-version mismatch and closes the global workflow", async () => {
    const checksumFixture = await loaderFixture({ workflowChecksum: "0".repeat(64) });
    await expect(checksumFixture.loader.loadWorkflow()).rejects.toMatchObject({ code: "checksum" });
    const versionFixture = await loaderFixture({ workflowCurrent: false });
    await expect(versionFixture.loader.loadWorkflow()).rejects.toMatchObject({ code: "identity" });
  });

  it("mode selection prevents real records from leaking into mock and ignores navigation", () => {
    const workflow = workflowIndex();
    const counts = ["行业", "宏观", "个股池", "观察清单"].map(() => selectActiveCompanyGuidanceProviderRecords("mixed", "success", workflow).length);
    expect(counts).toEqual([1, 1, 1, 1]);
    expect(["mixed", "mock", "real", "mock"].map((mode) => selectActiveCompanyGuidanceProviderRecords(mode as "mixed" | "mock" | "real", "success", workflow).length)).toEqual([1, 0, 1, 0]);
    expect(selectActiveCompanyGuidanceProviderRecords("real", "error", workflow)).toEqual([]);
  });

  it("builds a structured conflict ResearchEvent and ReviewTask", () => {
    const provider = providerRecord(); const local = localSnapshot({ lowerBound: 101 });
    const aggregated = aggregateEarningsExpectationEvidence({ providerSnapshots: [provider], localSnapshots: [local] });
    const events = buildProviderContentConflictEvents(aggregated, [local], [providerStock()]);
    expect(events[0]).toMatchObject({ eventType: "data_warning", parseStatus: "error", verificationStatus: "error" });
    expect(events[0].reviewReasons.join(" ")).toContain("lowerBound");
    const tasks = buildReviewTasks({ watchItems: [providerWatchItem()], events, chains: [], taskStates: [], now: new Date("2026-07-17T00:00:00Z") });
    expect(tasks.some((task) => task.ruleType === "data_quality_warning")).toBe(true);
  });

  it("prevents the user Store API from writing provider data", () => {
    const envelope = createEmptyEarningsExpectationEnvelope(new Date("2026-07-17T00:00:00Z"));
    const store = new EarningsExpectationStore(new EarningsExpectationRepository(null), () => new Date("2026-07-17T00:00:00Z"), () => "local-id");
    expect(store.appendSnapshot(envelope, { ...providerRecord().snapshot, id: undefined, createdBy: undefined }).ok).toBe(false);
    expect(envelope.snapshots).toEqual([]);
  });

  it("keeps provider comparison unavailable without reliable actual value", () => {
    expect(buildEarningsExpectationComparisons([providerRecord().snapshot], [], undefined, "2026-07-17T00:00:00.000Z")[0]).toMatchObject({ comparabilityStatus: "insufficient_data", comparisonResult: "insufficient_data" });
  });

  it("creates a formal range comparison against a later reliable actual disclosure", () => {
    expect(buildEarningsExpectationComparisons([providerRecord().snapshot], [actualEvent()], undefined, "2026-07-17T00:00:00.000Z")[0]).toMatchObject({ comparabilityStatus: "comparable", comparisonResult: "above", isExAnte: true, actualValue: 250 });
  });

  it("emits stable Provider event/task identities after reload", () => {
    const snapshot = providerRecord().snapshot;
    const firstEvents = buildEarningsExpectationResearchEvents([snapshot], buildEarningsExpectationComparisons([snapshot], []), [providerStock()]);
    const secondEvents = buildEarningsExpectationResearchEvents([{ ...snapshot }], buildEarningsExpectationComparisons([{ ...snapshot }], []), [providerStock()]);
    expect(secondEvents.map((event) => event.id)).toEqual(firstEvents.map((event) => event.id));
    expect(firstEvents[0].expectation).toMatchObject({ providerId: "cninfo-company-guidance", providerVersion: "2.0.0", providerSnapshotVersionId: snapshot.id });
    const firstTasks = buildReviewTasks({ watchItems: [providerWatchItem()], events: firstEvents, chains: [], taskStates: [] });
    const secondTasks = buildReviewTasks({ watchItems: [providerWatchItem()], events: [...secondEvents, ...secondEvents], chains: [], taskStates: [] });
    expect(secondTasks.map((task) => task.id)).toEqual(firstTasks.map((task) => task.id));
  });

  it("emits extraction correction without a business revision direction", () => {
    const snapshot = providerRecord().snapshot;
    snapshot.providerCorrectsVersionId = `company-guidance-version-${"1".repeat(64)}`;
    snapshot.providerCorrectionType = "extraction_correction";
    snapshot.providerCorrectedAt = "2026-07-12T07:31:40Z";
    snapshot.providerCorrectionChangedFields = ["lowerBound"];
    const events = buildEarningsExpectationResearchEvents([snapshot], [], [providerStock()]);
    const correction = events.find((event) => event.eventType === "earnings_expectation_correction");
    expect(correction?.summary).toContain("不表示公司业务预测上调或下调");
    expect(events.some((event) => event.expectation?.businessRevisionDelta)).toBe(false);
  });

  it("keeps Provider correction event time and dismissed ReviewTask stable across no-op release epochs", () => {
    const snapshot = providerRecord().snapshot;
    snapshot.id = `company-guidance-version-${"2".repeat(64)}`;
    snapshot.providerSnapshotVersionId = snapshot.id;
    snapshot.providerCorrectsVersionId = `company-guidance-version-${"1".repeat(64)}`;
    snapshot.providerCorrectionType = "extraction_correction";
    snapshot.createdAt = "2026-07-12T07:31:40Z";
    snapshot.providerCorrectedAt = snapshot.createdAt;
    snapshot.providerGeneratedAt = "2026-07-13T07:31:40Z";
    snapshot.providerCorrectionChangedFields = ["lowerBound"];
    const refreshed = { ...snapshot, providerGeneratedAt: "2026-07-15T07:31:40Z" };
    const firstCorrection = buildEarningsExpectationResearchEvents([snapshot], [], [providerStock()])
      .find((event) => event.eventType === "earnings_expectation_correction");
    const refreshedCorrection = buildEarningsExpectationResearchEvents([refreshed], [], [providerStock()])
      .find((event) => event.eventType === "earnings_expectation_correction");
    expect(firstCorrection).toBeDefined();
    expect(refreshedCorrection).toMatchObject({
      id: firstCorrection?.id,
      eventDate: firstCorrection?.eventDate,
      publishedAt: firstCorrection?.publishedAt,
      eventOccurredAt: firstCorrection?.eventOccurredAt,
      eventBusinessDate: firstCorrection?.eventBusinessDate,
    });
    const firstTasks = buildReviewTasks({ watchItems: [providerWatchItem()], events: [firstCorrection!], chains: [], taskStates: [] });
    const firstTask = firstTasks.find((task) => task.ruleType === "earnings_expectation_correction");
    expect(firstTask).toBeDefined();
    const refreshedTasks = buildReviewTasks({
      watchItems: [providerWatchItem()],
      events: [refreshedCorrection!, refreshedCorrection!],
      chains: [],
      taskStates: [{ taskId: firstTask!.id, status: "dismissed", acknowledgedAt: null, dismissedAt: "2026-07-13T08:00:00Z", snoozedUntil: null, updatedAt: "2026-07-13T08:00:00Z" }],
    });
    const correctionTasks = refreshedTasks.filter((task) => task.ruleType === "earnings_expectation_correction");
    expect(correctionTasks).toHaveLength(1);
    expect(correctionTasks[0]).toMatchObject({ id: firstTask!.id, status: "dismissed", dismissedAt: "2026-07-13T08:00:00Z" });
  });

  it("validates an A1-to-B-to-A2 correction chain with repeated content but distinct event ids", async () => {
    const fixture = await correctionChainArtifacts();
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : String(url).includes("workflow-index") ? response(fixture.workflow) : response(fixture.detail)) as typeof fetch;
    const loader = providerLoader(fixture, fetchImpl);
    const detail = await loader.load("sample");
    const workflow = await loader.loadWorkflow();
    const [a1, b] = detail.historicalProviderVersions;
    const a2 = detail.providerSnapshots[0];
    expect(a1.providerContentChecksum).toBe(a2.providerContentChecksum);
    expect(new Set([a1.providerSnapshotVersionId, b.providerSnapshotVersionId, a2.providerSnapshotVersionId]).size).toBe(3);
    expect(b.providerCorrectsVersionId).toBe(a1.providerSnapshotVersionId);
    expect(a2.providerCorrectsVersionId).toBe(b.providerSnapshotVersionId);
    expect(workflow.records[0].providerSnapshotVersionId).toBe(a2.providerSnapshotVersionId);
  });

  it.each([
    ["predecessor with initial type", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectionType = "initial"; record.snapshot.providerCorrectionType = "initial";
    }],
    ["extraction correction without predecessor", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectsVersionId = null; record.snapshot.providerCorrectsVersionId = null;
    }],
    ["empty changedFields", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectionChangedFields = []; record.snapshot.providerCorrectionChangedFields = [];
    }],
    ["duplicate changedFields", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectionChangedFields = ["lowerBound", "lowerBound"]; record.snapshot.providerCorrectionChangedFields = ["lowerBound", "lowerBound"];
    }],
    ["non-content changedField", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectionChangedFields = ["sourceTitle"]; record.snapshot.providerCorrectionChangedFields = ["sourceTitle"];
    }],
    ["null correctedAt", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectedAt = null; record.snapshot.providerCorrectedAt = null;
    }],
    ["correctedAt differs from createdAt", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectedAt = "2026-07-14T07:31:40Z"; record.snapshot.providerCorrectedAt = record.providerCorrectedAt;
    }],
    ["record/snapshot correction metadata split", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      fixture.workflow.records[0].snapshot.providerCorrectionChangedFields = ["upperBound"];
    }],
  ])("workflow rejects local correction shape attack: %s", async (_label, mutate) => {
    const fixture = await correctionChainArtifacts();
    mutate(fixture);
    await expectRejectedWorkflowFixture(fixture);
  });

  it.each([
    ["forged changedFields", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => {
      const record = fixture.workflow.records[0]; record.providerCorrectionChangedFields = ["sourcePublishedAt"]; record.snapshot.providerCorrectionChangedFields = ["sourcePublishedAt"];
    }],
    ["modified predecessor projection", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => { const projection = fixture.workflow.correctionProofs[0].predecessorContentProjection; projection.lowerBound = (projection.lowerBound ?? 0) + 1; }],
    ["modified predecessor checksum", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => { fixture.workflow.correctionProofs[0].predecessorProviderContentChecksum = "0".repeat(64); }],
    ["different evidence identity", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => { fixture.workflow.correctionProofs[0].providerEvidenceIdentity = `${EVIDENCE_ID}:other`; }],
    ["missing proof", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => { fixture.workflow.correctionProofs = []; }],
    ["duplicate proof", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => { fixture.workflow.correctionProofs.push(structuredClone(fixture.workflow.correctionProofs[0])); }],
    ["raw evidence injected into proof", (fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) => { Object.assign(fixture.workflow.correctionProofs[0].predecessorContentProjection, { sourceTextEvidence: "forged raw evidence" }); }],
  ])("workflow rejects re-signed correction proof attack: %s", async (_label, mutate) => {
    const fixture = await correctionChainArtifacts();
    mutate(fixture);
    await expectRejectedWorkflowFixture(fixture);
  });

  it("clearCache prevents a stale detail request from caching or deleting the new in-flight request", async () => {
    const oldFixture = await artifacts();
    const newFixture = await artifacts();
    newFixture.detail.totalAnnouncementCount = 2;
    await finalizeDetail(newFixture);
    const oldDetail = deferred<Response>();
    const newDetail = deferred<Response>();
    let manifestCalls = 0; let detailCalls = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.includes("manifest")) return response((manifestCalls += 1) === 1 ? oldFixture.manifest : newFixture.manifest);
      detailCalls += 1;
      return detailCalls === 1 ? oldDetail.promise : newDetail.promise;
    }) as typeof fetch;
    const loader = providerLoader(oldFixture, fetchImpl);
    const first = loader.load("sample");
    await waitFor(() => detailCalls === 1);
    loader.clearCache();
    const second = loader.load("sample");
    await waitFor(() => detailCalls === 2);
    oldDetail.resolve(response(oldFixture.detail));
    await expect(first).rejects.toMatchObject({ code: "stale" });
    expect(loader.cacheInfo()).toMatchObject({ epoch: 1, results: 0, inFlight: 1 });
    newDetail.resolve(response(newFixture.detail));
    await expect(second).resolves.toMatchObject({ totalAnnouncementCount: 2 });
    expect(loader.cacheInfo()).toMatchObject({ epoch: 1, results: 1, inFlight: 0 });
    await expect(loader.load("sample")).resolves.toMatchObject({ totalAnnouncementCount: 2 });
    expect(detailCalls).toBe(2);
  });

  it("multiple retry generations commit only the latest detail result", async () => {
    const fixture = await artifacts();
    const requests = [deferred<Response>(), deferred<Response>(), deferred<Response>()];
    let detailCalls = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("manifest")) return response(fixture.manifest);
      const request = requests[detailCalls]; detailCalls += 1; return request.promise;
    }) as typeof fetch;
    const loader = providerLoader(fixture, fetchImpl);
    const first = loader.load("sample"); const firstResult = first.then(() => null, (error) => error); await waitFor(() => detailCalls === 1);
    loader.clearCache();
    const second = loader.load("sample"); const secondResult = second.then(() => null, (error) => error); await waitFor(() => detailCalls === 2);
    loader.clearCache();
    const third = loader.load("sample"); await waitFor(() => detailCalls === 3);
    requests[1].resolve(response(fixture.detail)); requests[0].resolve(response(fixture.detail));
    await expect(firstResult).resolves.toMatchObject({ code: "stale" });
    await expect(secondResult).resolves.toMatchObject({ code: "stale" });
    expect(loader.cacheInfo()).toMatchObject({ epoch: 2, results: 0, inFlight: 1 });
    requests[2].resolve(response(fixture.detail));
    await expect(third).resolves.toMatchObject({ stockId: "sample" });
    expect(loader.cacheInfo()).toMatchObject({ epoch: 2, results: 1, inFlight: 0 });
  });

  it("clearCache keeps the new manifest promise when the old manifest completes later", async () => {
    const fixture = await artifacts();
    const firstManifest = deferred<Response>(); const secondManifest = deferred<Response>();
    let manifestCalls = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.includes("manifest")) return (manifestCalls += 1) === 1 ? firstManifest.promise : secondManifest.promise;
      return response(fixture.workflow);
    }) as typeof fetch;
    const loader = providerLoader(fixture, fetchImpl);
    const first = loader.loadWorkflow();
    await waitFor(() => manifestCalls === 1);
    loader.clearCache();
    const second = loader.loadWorkflow();
    await waitFor(() => manifestCalls === 2);
    firstManifest.resolve(response(fixture.manifest));
    await expect(first).rejects.toMatchObject({ code: "stale" });
    expect(loader.cacheInfo()).toMatchObject({ epoch: 1, manifestLoaded: true, workflowLoaded: true });
    secondManifest.resolve(response(fixture.manifest));
    await expect(second).resolves.toMatchObject({ currentSnapshotCount: 1 });
  });

  it("clearCache keeps the new workflow promise when the old workflow completes later", async () => {
    const fixture = await artifacts();
    const firstWorkflow = deferred<Response>(); const secondWorkflow = deferred<Response>();
    let workflowCalls = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const value = String(url);
      if (value.includes("manifest")) return response(fixture.manifest);
      return (workflowCalls += 1) === 1 ? firstWorkflow.promise : secondWorkflow.promise;
    }) as typeof fetch;
    const loader = providerLoader(fixture, fetchImpl);
    const first = loader.loadWorkflow();
    await waitFor(() => workflowCalls === 1);
    loader.clearCache();
    const second = loader.loadWorkflow();
    await waitFor(() => workflowCalls === 2);
    firstWorkflow.resolve(response(fixture.workflow));
    await expect(first).rejects.toMatchObject({ code: "stale" });
    expect(loader.cacheInfo()).toMatchObject({ epoch: 1, workflowLoaded: true });
    secondWorkflow.resolve(response(fixture.workflow));
    await expect(second).resolves.toMatchObject({ currentSnapshotCount: 1 });
  });
});

async function loaderFixture(options: { detailStockId?: string; manifestChecksum?: string; workflowChecksum?: string; workflowCurrent?: boolean } = {}) {
  const fixture = await artifacts();
  if (options.detailStockId) { fixture.detail.stockId = options.detailStockId; await finalizeDetail(fixture); }
  if (options.manifestChecksum) fixture.manifest.items[0].checksumSha256 = options.manifestChecksum;
  if (options.workflowCurrent === false) { fixture.workflow.records[0].isCurrentVersion = false; fixture.workflow.records[0].snapshot.isCurrentProviderVersion = false; await finalizeWorkflow(fixture); }
  if (options.workflowChecksum) fixture.manifest.workflowIndexChecksumSha256 = options.workflowChecksum;
  fixture.summary = summaryFromManifest(fixture.manifest);
  const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : String(url).includes("workflow-index") ? response(fixture.workflow) : response(fixture.detail)) as typeof fetch;
  return { ...fixture, loader: providerLoader(fixture, fetchImpl), fetchImpl };
}

async function artifacts() {
  const record = providerRecord();
  const detail: CompanyGuidanceExpectationDetail = { schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: "2026-07-11T07:31:40Z", stockId: "sample", stockCode: "000001", companyName: "样本公司", market: "A股", status: "generated_real", totalAnnouncementCount: 1, targetAnnouncements: [targetAnnouncement()], providerSnapshots: [record], historicalProviderVersions: [], exclusions: [], warnings: [], quality: detailQuality("2026-07-11T07:31:40Z", "generated_real") };
  const workflow = workflowIndex();
  const manifest: CompanyGuidanceExpectationManifest = { schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: "2026-07-11T07:31:40Z", totalCompanies: 1, companiesWithSnapshots: 1, totalSnapshots: 1, totalHistoricalVersions: 0, workflowIndexRelativePath: "data/a-share-company-guidance-expectations/workflow-index.generated.json", workflowIndexByteSize: 0, workflowIndexChecksumSha256: "", items: [{ stockId: "sample", stockCode: "000001", companyName: "样本公司", relativePath: "data/a-share-company-guidance-expectations/sample.json", snapshotCount: 1, historicalVersionCount: 0, excludedAnnouncementCount: 0, byteSize: 0, checksumSha256: "", latestReportPeriod: "2025-12-31", latestSourceDate: "2026-01-15", status: "generated_real" }] };
  const fixture = { manifest, detail, workflow, summary: summaryFromManifest(manifest) };
  await finalizeDetail(fixture); await finalizeWorkflow(fixture);
  fixture.summary = summaryFromManifest(manifest);
  return fixture;
}

async function correctionChainArtifacts() {
  const a1 = providerRecord();
  setVersion(a1, { current: false, predecessor: null, checksum: CONTENT_HASH, versionId: VERSION_ID, correctedAt: null, changedFields: [] });
  const b = structuredClone(a1);
  b.snapshot.lowerBound = 120; b.snapshot.upperBound = 220;
  const bChecksum = await providerChecksum(b);
  const bVersionId = await correctionVersionId(EVIDENCE_ID, VERSION_ID, bChecksum);
  setVersion(b, { current: false, predecessor: VERSION_ID, checksum: bChecksum, versionId: bVersionId, correctedAt: "2026-07-12T07:31:40Z", changedFields: ["lowerBound", "upperBound"] });
  setGeneration(b, "2026-07-12T07:31:40Z");
  const a2 = structuredClone(a1);
  const a2VersionId = await correctionVersionId(EVIDENCE_ID, bVersionId, CONTENT_HASH);
  setVersion(a2, { current: true, predecessor: bVersionId, checksum: CONTENT_HASH, versionId: a2VersionId, correctedAt: "2026-07-13T07:31:40Z", changedFields: ["lowerBound", "upperBound"] });
  setGeneration(a2, "2026-07-13T07:31:40Z");
  const detail: CompanyGuidanceExpectationDetail = { schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: "2026-07-13T07:31:40Z", stockId: "sample", stockCode: "000001", companyName: "样本公司", market: "A股", status: "generated_real", totalAnnouncementCount: 1, targetAnnouncements: [targetAnnouncement()], providerSnapshots: [a2], historicalProviderVersions: [a1, b], exclusions: [], warnings: [], quality: detailQuality("2026-07-13T07:31:40Z", "generated_real") };
  const { sourceTextEvidence: _sourceTextEvidence, originalUnitEvidence: _originalUnitEvidence, ...workflowRecord } = structuredClone(a2);
  const workflow: CompanyGuidanceExpectationWorkflowIndex = {
    schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: "2026-07-13T07:31:40Z", currentSnapshotCount: 1, records: [workflowRecord],
    correctionProofs: [{
      currentProviderSnapshotVersionId: a2.providerSnapshotVersionId,
      predecessorProviderSnapshotVersionId: b.providerSnapshotVersionId,
      predecessorProviderCorrectsVersionId: b.providerCorrectsVersionId,
      providerEvidenceIdentity: a2.providerEvidenceIdentity,
      predecessorProviderContentChecksum: b.providerContentChecksum,
      predecessorContentProjection: providerProjection(b),
    }],
    warnings: [],
  };
  const manifest: CompanyGuidanceExpectationManifest = { schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: "2026-07-13T07:31:40Z", totalCompanies: 1, companiesWithSnapshots: 1, totalSnapshots: 1, totalHistoricalVersions: 2, workflowIndexRelativePath: "data/a-share-company-guidance-expectations/workflow-index.generated.json", workflowIndexByteSize: 0, workflowIndexChecksumSha256: "", items: [{ stockId: "sample", stockCode: "000001", companyName: "样本公司", relativePath: "data/a-share-company-guidance-expectations/sample.json", snapshotCount: 1, historicalVersionCount: 2, excludedAnnouncementCount: 0, byteSize: 0, checksumSha256: "", latestReportPeriod: "2025-12-31", latestSourceDate: "2026-01-15", status: "generated_real" }] };
  const fixture = { manifest, detail, workflow, summary: summaryFromManifest(manifest) };
  await finalizeDetail(fixture); await finalizeWorkflow(fixture);
  fixture.summary = summaryFromManifest(manifest);
  return fixture;
}

function setVersion(record: EarningsExpectationProviderSnapshot, { current, predecessor, checksum, versionId, correctedAt, changedFields }: { current: boolean; predecessor: string | null; checksum: string; versionId: string; correctedAt: string | null; changedFields: string[] }) {
  record.providerContentChecksum = checksum;
  record.providerSnapshotVersionId = versionId;
  record.providerCorrectsVersionId = predecessor;
  record.providerCorrectionType = predecessor ? "extraction_correction" : "initial";
  record.providerCorrectedAt = correctedAt;
  record.providerCorrectionChangedFields = changedFields;
  record.isCurrentVersion = current;
  record.artifactChecksum = checksum;
  Object.assign(record.snapshot, { id: versionId, providerContentChecksum: checksum, providerSnapshotVersionId: versionId, providerCorrectsVersionId: predecessor, providerCorrectionType: record.providerCorrectionType, providerCorrectedAt: correctedAt, providerCorrectionChangedFields: changedFields, isCurrentProviderVersion: current, artifactChecksum: checksum });
}
function setGeneration(record: EarningsExpectationProviderSnapshot, generatedAt: string) { record.generatedAt = generatedAt; record.snapshot.createdAt = generatedAt; record.snapshot.providerGeneratedAt = generatedAt; }

async function providerChecksum(record: EarningsExpectationProviderSnapshot) {
  return sha256Hex(new TextEncoder().encode(canonicalJson({ providerEvidenceIdentity: record.providerEvidenceIdentity, estimateShape: record.snapshot.estimateShape, value: record.snapshot.value, lowerBound: record.snapshot.lowerBound, upperBound: record.snapshot.upperBound, currency: record.snapshot.currency, unit: record.snapshot.unit, accountingBasis: record.snapshot.accountingBasis, sourcePublishedAt: record.snapshot.sourcePublishedAt, sourceTextEvidenceHash: record.sourceTextEvidenceHash, providerParseRulesVersion: record.providerParseRulesVersion })));
}
async function recomputeProviderDerivations(record: CompanyGuidanceExpectationDetailProviderRecord) {
  const evidenceIdentity = ["cninfo-company-guidance", record.sourceAnnouncementId, record.snapshot.stockId, record.snapshot.reportPeriod, record.snapshot.periodScope, record.snapshot.metric].join("|");
  record.providerEvidenceIdentity = evidenceIdentity;
  record.snapshot.providerEvidenceIdentity = evidenceIdentity;
  const checksum = await providerChecksum(record);
  const versionId = record.providerCorrectsVersionId
    ? await correctionVersionId(evidenceIdentity, record.providerCorrectsVersionId, checksum)
    : `company-guidance-version-${checksum}`;
  record.providerContentChecksum = checksum;
  record.providerSnapshotVersionId = versionId;
  record.artifactChecksum = checksum;
  Object.assign(record.snapshot, { id: versionId, providerContentChecksum: checksum, providerSnapshotVersionId: versionId, artifactChecksum: checksum });
}
async function correctionVersionId(providerEvidenceIdentity: string, providerCorrectsVersionId: string, providerContentChecksum: string) { return `company-guidance-version-${await sha256Hex(new TextEncoder().encode(canonicalJson({ providerEvidenceIdentity, providerCorrectsVersionId, providerContentChecksum })))}`; }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") { const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`; } return JSON.stringify(value); }

function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; }); return { promise, resolve, reject }; }
async function waitFor(predicate: () => boolean) { for (let attempt = 0; attempt < 100; attempt += 1) { if (predicate()) return; await new Promise((resolve) => setTimeout(resolve, 0)); } throw new Error("timed out waiting for deferred request"); }

async function finalizeDetail(fixture: { manifest: CompanyGuidanceExpectationManifest; detail: CompanyGuidanceExpectationDetail }) { const bytes = new TextEncoder().encode(JSON.stringify(fixture.detail)); fixture.manifest.items[0].byteSize = bytes.byteLength; fixture.manifest.items[0].checksumSha256 = await sha256Hex(bytes); }
async function finalizeWorkflow(fixture: { manifest: CompanyGuidanceExpectationManifest; workflow: CompanyGuidanceExpectationWorkflowIndex }) { const bytes = new TextEncoder().encode(JSON.stringify(fixture.workflow)); fixture.manifest.workflowIndexByteSize = bytes.byteLength; fixture.manifest.workflowIndexChecksumSha256 = await sha256Hex(bytes); }
async function expectRejectedWorkflowFixture(fixture: Awaited<ReturnType<typeof correctionChainArtifacts>>) {
  await finalizeWorkflow(fixture);
  fixture.summary = summaryFromManifest(fixture.manifest);
  const fetchImpl = vi.fn(async (url: RequestInfo | URL) => String(url).includes("manifest") ? response(fixture.manifest) : response(fixture.workflow)) as typeof fetch;
  await expect(providerLoader(fixture, fetchImpl).loadWorkflow()).rejects.toMatchObject({ code: expect.stringMatching(/graph|identity|schema/u) });
}
function response(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } }); }
async function sha256Hex(bytes: Uint8Array) { const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
function providerLoader(fixture: { summary: CompanyGuidanceExpectationSummary }, fetchImpl: typeof fetch) { return createCompanyGuidanceExpectationLoader({ fetchImpl, baseUrl: "/", cryptoImpl: globalThis.crypto, retries: 0, summary: fixture.summary }); }
function summaryFromManifest(manifest: CompanyGuidanceExpectationManifest): CompanyGuidanceExpectationSummary {
  const statuses = manifest.items.map((entry) => entry.status);
  const status = statuses.includes("partial") ? "partial" : statuses.includes("generated_real") ? "generated_real" : "missing";
  return {
    schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: manifest.generatedAt,
    sourceArtifact: "CNInfo A-share announcement Provider V1 committed artifacts", sourceGeneratedAt: manifest.generatedAt, status, audit: auditFromManifest(manifest),
    workflowIndex: { relativePath: manifest.workflowIndexRelativePath, byteSize: manifest.workflowIndexByteSize, checksumSha256: manifest.workflowIndexChecksumSha256, currentSnapshotCount: manifest.totalSnapshots },
    items: Object.fromEntries(manifest.items.map((entry) => [entry.stockId, {
      stockId: entry.stockId, stockCode: entry.stockCode, companyName: entry.companyName, status: entry.status,
      snapshotCount: entry.snapshotCount, excludedAnnouncementCount: entry.excludedAnnouncementCount,
      latestReportPeriod: entry.latestReportPeriod, latestSourceDate: entry.latestSourceDate, detailPath: entry.relativePath,
    }])),
  };
}

function auditFromManifest(manifest: CompanyGuidanceExpectationManifest): CompanyGuidanceExpectationSummaryAudit {
  const excluded = manifest.items.reduce((sum, entry) => sum + entry.excludedAnnouncementCount, 0);
  const targets = manifest.totalSnapshots + excluded;
  const sourceDates = manifest.items.map((entry) => entry.latestSourceDate).filter((value): value is string => value !== null).sort();
  return {
    totalAnnouncementCount: targets,
    companyCount: manifest.totalCompanies,
    targetCompanyCount: manifest.items.filter((entry) => entry.snapshotCount > 0 || entry.excludedAnnouncementCount > 0).length,
    previewAnnouncementCount: targets,
    revisionAnnouncementCount: 0,
    targetAnnouncementCount: targets,
    targetWithReportPeriodCount: manifest.totalSnapshots,
    targetWithRecognizedPeriodScopeCount: manifest.totalSnapshots,
    parseStatusCounts: targets ? { parse_success: targets } : {},
    reliableAnnouncementCount: manifest.totalSnapshots,
    reliableSnapshotCount: manifest.totalSnapshots,
    reliableCompanyCount: manifest.companiesWithSnapshots,
    historicalVersionCount: manifest.totalHistoricalVersions,
    metricCounts: manifest.totalSnapshots ? { attributable_net_profit: manifest.totalSnapshots } : {},
    periodScopeCounts: manifest.totalSnapshots ? { full_year: manifest.totalSnapshots } : {},
    excludedTargetAnnouncementCount: excluded,
    exclusionCount: excluded,
    exclusionReasonCounts: excluded ? { no_reliable_forecast_range: excluded } : {},
    earliestSourceDate: sourceDates[0] ?? null,
    latestSourceDate: sourceDates[sourceDates.length - 1] ?? null,
    duplicateAnnouncementCount: 0,
    linkedRevisionSnapshotCount: 0,
    unresolvedRevisionAnnouncementCount: 0,
  };
}

const TEXT_HASH = "a4142cc018faf38144b9134453fa03ef903239958e7988bdc32686a63b2f2c42";
const CONTENT_HASH = "2365860f063e68f4f5d38863a923c8d786e7aa20e87ddbbfb403718e29a9e009";
const VERSION_ID = `company-guidance-version-${CONTENT_HASH}`;
const EVIDENCE_ID = "cninfo-company-guidance|1222448664|sample|2025-12-31|full_year|attributable_net_profit";

function providerRecord(): CompanyGuidanceExpectationDetailProviderRecord {
  const snapshot = localSnapshot({ id: VERSION_ID, ingestionMethod: "provider", sourceName: "样本公司", createdAt: "2026-07-11T07:31:40Z", createdBy: "cninfo-company-guidance", sourceVerificationStatus: "verified", formationTimeBasis: "public_disclosure_proxy", notes: "公司内部形成时间未知，以公开披露时间作为可用时间", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", providerGeneratedAt: "2026-07-11T07:31:40Z", providerEvidenceIdentity: EVIDENCE_ID, providerSnapshotVersionId: VERSION_ID, providerContentChecksum: CONTENT_HASH, providerParseRulesVersion: "1.0.0", providerCorrectsVersionId: null, providerCorrectionType: "initial", providerCorrectedAt: null, providerCorrectionChangedFields: [], isCurrentProviderVersion: true, providerBusinessRevisionPredecessorSnapshotId: null, sourceAnnouncementId: "1222448664", sourceAnnouncementType: "earnings_preview", officialPdfUrl: "https://static.cninfo.com.cn/finalpage/2026-01-15/1222448664.PDF", artifactChecksum: CONTENT_HASH });
  return { providerId: "cninfo-company-guidance", providerVersion: "2.0.0", snapshot, providerEvidenceIdentity: EVIDENCE_ID, providerSnapshotVersionId: VERSION_ID, providerContentChecksum: CONTENT_HASH, providerParseRulesVersion: "1.0.0", providerCorrectsVersionId: null, providerCorrectionType: "initial", providerCorrectedAt: null, providerCorrectionChangedFields: [], isCurrentVersion: true, providerBusinessRevisionPredecessorSnapshotId: null, sourceAnnouncementId: "1222448664", sourceAnnouncementType: "earnings_preview", officialSourceUrl: snapshot.sourceUrl as string, officialPdfUrl: snapshot.officialPdfUrl as string, sourceDate: "2026-01-15", generatedAt: "2026-07-11T07:31:40Z", artifactChecksum: CONTENT_HASH, sourceParseStatus: "parse_success", sourceExtractionConfidence: "high", sourceTextEvidence: "evidence-100-200 万元", sourceTextEvidenceHash: TEXT_HASH, originalUnitEvidence: "万元", correctionCandidateAnnouncementIds: [], structuredWarnings: [] };
}
function workflowIndex(): CompanyGuidanceExpectationWorkflowIndex { const { sourceTextEvidence: _sourceTextEvidence, originalUnitEvidence: _originalUnitEvidence, ...record } = providerRecord(); return { schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: "2026-07-11T07:31:40Z", currentSnapshotCount: 1, records: [record], correctionProofs: [], warnings: [] }; }

function providerProjection(record: EarningsExpectationProviderSnapshot) {
  return {
    providerEvidenceIdentity: record.providerEvidenceIdentity,
    estimateShape: record.snapshot.estimateShape,
    value: record.snapshot.value,
    lowerBound: record.snapshot.lowerBound,
    upperBound: record.snapshot.upperBound,
    currency: record.snapshot.currency,
    unit: record.snapshot.unit,
    accountingBasis: record.snapshot.accountingBasis,
    sourcePublishedAt: record.snapshot.sourcePublishedAt as string,
    sourceTextEvidenceHash: record.sourceTextEvidenceHash,
    providerParseRulesVersion: record.providerParseRulesVersion,
  };
}
function targetAnnouncement() { return { sourceAnnouncementId: "1222448664", stockId: "sample", sourceAnnouncementType: "earnings_preview" as const, sourceDate: "2026-01-15", reportPeriod: "2025-12-31", periodScope: "full_year" as const, parseStatus: "parse_success" as const, isDuplicate: false }; }
function exclusionRecord() { return { stockId: "sample", companyName: "样本公司", sourceAnnouncementId: "1222448664", sourceAnnouncementType: "earnings_preview" as const, sourceTitle: "2025年度业绩预告", sourceDate: "2026-01-15", reportPeriod: "2025-12-31", periodScope: "full_year" as const, metric: null, parseStatus: "parse_success" as const, officialSourceUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=1222448664", candidateAnnouncementIds: [], reasons: ["no_reliable_forecast_range" as const] }; }
function detailQuality(updatedAt: string, status: "generated_real" | "partial" | "missing") { return { source: "CNInfo" as const, sourceLayer: "company_guidance_expectations" as const, sourceUrl: "https://www.cninfo.com.cn/new/hisAnnouncement/query", updatedAt, status }; }
function localSnapshot(overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot { return { id: "local-snapshot", stockId: "sample", market: "A股", reportPeriod: "2025-12-31", periodScope: "full_year", metric: "attributable_net_profit", estimateShape: "range", value: null, lowerBound: 100, upperBound: 200, currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "company_guidance", sourceName: "manual source", sourceTitle: "2025年度业绩预告", sourceUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=1222448664", sourcePublishedAt: "2026-01-15", sourcePublishedAtPrecision: "date", sourcePublishedAtResolution: "date", sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: "2026-01-15", asOfDate: "2026-01-15", formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: "2026-01-15", analystCount: null, institutionCount: null, ingestionMethod: "manual", createdAt: "2026-01-15T00:00:00Z", createdBy: "local-user", sourceVerificationStatus: "verified", notes: null, correctsSnapshotId: null, correctionScope: null, schemaVersion: 2, ...overrides }; }
function providerStock() { return { id: "sample", name: "样本公司", code: "000001.SZ", market: "A股", industryId: "tech", segmentId: "segment", dataMode: "mixed" } as Stock; }
function providerWatchItem(): WatchItem { return { id: "watch-provider", stockId: "sample", createdAt: "2025-01-01", updatedAt: "2025-01-01", status: "观察", priority: "high", tags: [], reason: "跟踪公司指引", thesis: "验证官方披露", validationCriteria: [], riskCriteria: [], nextReviewAt: null, lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 }; }
function actualEvent(): ResearchEvent { return { id: "actual-2025", stockId: "sample", stockName: "样本公司", stockCode: "000001.SZ", industryId: "tech", market: "A股", eventType: "periodic_report", eventDate: "2026-03-31", publishedAt: "2026-03-31", reportPeriod: "2025-12-31", title: "2025年年度报告", summary: "正式报告", sourceType: "financial_report", sourceName: "巨潮资讯", sourceUrl: "https://www.cninfo.com.cn/", pdfUrl: null, verificationStatus: "verified", parseStatus: "parse_success", materiality: "high", metrics: [{ key: "netProfitAttributableToParent", label: "归母净利润", value: 250, unit: "CNY", periodBasis: "cumulative", sourceAnnouncementId: "actual-anno", sourceFinancialPeriod: "2025-12-31" }], performanceDisclosureScope: "all_metrics", relatedAnnouncementIds: ["actual-anno"], relatedFinancialPeriod: "2025-12-31", reviewStatus: "pending", reviewReasons: [], isRestated: false, updatedAt: "2026-03-31" }; }
