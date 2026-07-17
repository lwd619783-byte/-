import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EarningsExpectationProviderSnapshot, EarningsExpectationSnapshot, Industry, Stock } from "../../types";
import { EarningsExpectationCenter } from "./EarningsExpectationCenter";
import { StockEarningsExpectationPanel } from "./StockEarningsExpectationPanel";

describe("company guidance expectation workflow UI", () => {
  it("shows the official company-guidance provider status", () => {
    const html = renderCenter();
    expect(html).toContain("公司官方指引 · 巨潮官方公告");
    expect(html).toContain("不写入用户 LocalStorage");
  });

  it("labels generated snapshots as read-only official guidance", () => {
    const html = renderCenter();
    expect(html).toContain("公司官方指引");
    expect(html).toContain("Provider 只读");
  });

  it("does not render a correction button for a provider snapshot", () => {
    expect(renderCenter()).not.toContain(">创建纠正<");
  });

  it("keeps a user snapshot editable", () => {
    const local = snapshot({ id: "local", ingestionMethod: "manual", providerId: undefined, providerVersion: undefined, providerGeneratedAt: undefined, sourceAnnouncementId: undefined, sourceAnnouncementType: undefined, officialPdfUrl: undefined, artifactChecksum: undefined, formationTimeBasis: "actual" });
    expect(renderCenter({ snapshots: [local], providerIds: new Set() })).toContain(">创建纠正<");
  });

  it("marks retained local evidence that duplicates the official provider", () => {
    const provider = record();
    const local = snapshot({ id: "local-duplicate", ingestionMethod: "manual" });
    expect(renderCenter({ snapshots: [provider.snapshot, local], duplicateMap: new Map([[local.id, provider.snapshot.id]]) })).toContain("与官方 Provider 记录重复");
  });

  it("shows the public-disclosure proxy time warning", () => {
    expect(renderCenter()).toContain("公司内部形成时间未知，以公开披露时间作为可用时间");
  });

  it("shows an explicit provider-empty state in stock detail", () => {
    const html = renderToStaticMarkup(<StockEarningsExpectationPanel stock={stock} snapshots={[]} financialData={null} announcementData={null} financialLoadStatus="idle" announcementLoadStatus="idle" providerLoadStatus="success" />);
    expect(html).toContain("尚无可靠公司指引");
    expect(html).not.toContain("Mock");
  });

  it("shows provider version and official links in stock detail", () => {
    const provider = record();
    const html = renderToStaticMarkup(<StockEarningsExpectationPanel stock={stock} snapshots={[provider.snapshot]} financialData={null} announcementData={null} financialLoadStatus="idle" announcementLoadStatus="idle" providerLoadStatus="success" providerSnapshotIds={new Set([provider.snapshot.id])} providerRecordBySnapshotId={new Map([[provider.snapshot.id, provider]])} />);
    expect(html).toContain("Provider 2.0.0");
    expect(html).toContain(`href="${provider.officialSourceUrl.replace(/&/g, "&amp;")}"`);
    expect(html).toContain(`href="${provider.officialPdfUrl}"`);
  });

  it("keeps the stock-detail provider snapshot read-only", () => {
    const provider = record();
    const html = renderToStaticMarkup(<StockEarningsExpectationPanel stock={stock} snapshots={[provider.snapshot]} financialData={null} announcementData={null} financialLoadStatus="idle" announcementLoadStatus="idle" providerSnapshotIds={new Set([provider.snapshot.id])} providerRecordBySnapshotId={new Map([[provider.snapshot.id, provider]])} onCorrect={vi.fn()} />);
    expect(html).not.toContain("创建纠正快照");
  });

  it("uses shrinkable layout primitives at a 390px viewport", () => {
    const html = renderCenter();
    expect(html).toContain("min-w-0 space-y-4");
    expect(html).not.toContain("min-w-[");
  });
});

function renderCenter(options: { snapshots?: EarningsExpectationSnapshot[]; providerIds?: Set<string>; duplicateMap?: Map<string, string> } = {}) {
  const provider = record();
  const snapshots = options.snapshots ?? [provider.snapshot];
  return renderToStaticMarkup(<EarningsExpectationCenter
    snapshots={snapshots}
    comparisons={[]}
    researchEvents={[]}
    importHistory={[]}
    stocks={[stock]}
    industries={[industry]}
    watchItems={[]}
    providerLoadStatus="success"
    providerSummary={{ schemaVersion: "2.0.0", providerId: "cninfo-company-guidance", providerVersion: "2.0.0", generatedAt: "2026-07-11T07:31:40Z", sourceArtifact: "committed", sourceGeneratedAt: "2026-07-11T07:31:40Z", status: "generated_real", audit: {}, workflowIndex: { relativePath: "data/a-share-company-guidance-expectations/workflow-index.generated.json", byteSize: 1, checksumSha256: "a".repeat(64), currentSnapshotCount: 1 }, items: {} }}
    providerSnapshotIds={options.providerIds ?? new Set(snapshots.filter((item) => item.ingestionMethod === "provider").map((item) => item.id))}
    duplicateOfProviderByLocalId={options.duplicateMap ?? new Map()}
    providerRecordBySnapshotId={new Map([[provider.snapshot.id, provider]])}
    providerExclusions={[]}
    providerWarnings={[]}
    timeZone="Asia/Shanghai"
    onAdd={vi.fn()}
    onCorrect={vi.fn()}
    onImport={vi.fn()}
    onOpenStock={vi.fn()}
  />);
}

const stock = { id: "sample", code: "000001", name: "样本公司", market: "A股", industryId: "industry", segmentId: "segment" } as Stock;
const industry = { id: "industry", name: "样本行业", segments: [] } as unknown as Industry;

function record(): EarningsExpectationProviderSnapshot {
  const value = snapshot();
  return {
    providerId: "cninfo-company-guidance", providerVersion: "2.0.0", snapshot: value, providerEvidenceIdentity: "evidence", providerSnapshotVersionId: value.id, providerContentChecksum: "a".repeat(64), providerParseRulesVersion: "1.0.0", providerCorrectsVersionId: null, providerCorrectionType: "initial", providerCorrectedAt: null, providerCorrectionChangedFields: [], isCurrentVersion: true, providerBusinessRevisionPredecessorSnapshotId: null, sourceAnnouncementId: "1222448664", sourceAnnouncementType: "earnings_preview",
    officialSourceUrl: value.sourceUrl as string, officialPdfUrl: value.officialPdfUrl as string, sourceDate: "2026-01-15", generatedAt: "2026-07-11T07:31:40Z", artifactChecksum: "a".repeat(64),
    sourceParseStatus: "parse_success", sourceExtractionConfidence: "high", sourceTextEvidence: "预计归母净利润100万元至200万元", sourceTextEvidenceHash: "b".repeat(64), originalUnitEvidence: "万元", correctionCandidateAnnouncementIds: [], structuredWarnings: [],
  };
}

function snapshot(overrides: Partial<EarningsExpectationSnapshot> = {}): EarningsExpectationSnapshot {
  return {
    id: "provider-snapshot", stockId: "sample", market: "A股", reportPeriod: "2025-12-31", periodScope: "full_year", metric: "attributable_net_profit", estimateShape: "range", value: null, lowerBound: 100, upperBound: 200,
    currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourceCategory: "company_guidance", sourceName: "样本公司", sourceTitle: "2025年度业绩预告", sourceUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=1222448664",
    sourcePublishedAt: "2026-01-15", sourcePublishedAtPrecision: "date", sourcePublishedAtResolution: "date", sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: "2026-01-15", asOfDate: "2026-01-15",
    formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: "2026-01-15", formationTimeBasis: "public_disclosure_proxy",
    providerId: "cninfo-company-guidance", providerVersion: "2.0.0", providerGeneratedAt: "2026-07-11T07:31:40Z", sourceAnnouncementId: "1222448664", sourceAnnouncementType: "earnings_preview", officialPdfUrl: "https://static.cninfo.com.cn/finalpage/2026-01-15/1222448664.PDF", artifactChecksum: "a".repeat(64),
    analystCount: null, institutionCount: null, ingestionMethod: "provider", createdAt: "2026-07-11T07:31:40Z", createdBy: "cninfo-company-guidance", sourceVerificationStatus: "verified", notes: "公司内部形成时间未知，以公开披露时间作为可用时间", correctsSnapshotId: null, correctionScope: null, schemaVersion: 2,
    ...overrides,
  };
}
