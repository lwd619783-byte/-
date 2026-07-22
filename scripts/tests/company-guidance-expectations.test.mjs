import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  COMPANY_GUIDANCE_TIME_NOTE,
  buildCompanyGuidanceArtifacts,
  createWorkflowIndex,
  parseOfficialCninfoAnnouncementUrl,
  parseOfficialCninfoPdfUrl,
  periodScopeFor,
  stableProviderSnapshotId,
  validateBusinessRevisionGraph,
  validateVersionGraph,
} from "../company-guidance-expectations/core.mjs";

const CONTRACT_FIXTURES = JSON.parse(fs.readFileSync(new URL("../company-guidance-expectations/contract-fixtures.json", import.meta.url), "utf8"));
const APP_SOURCE = fs.readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");

const GENERATED_AT = "2026-07-11T07:31:40Z";

test("maps a reliable preview to company guidance", () => {
  const result = build([announcement()]);
  assert.equal(result.companies[0].providerSnapshots[0].snapshot.sourceCategory, "company_guidance");
});

test("maps attributable net profit", () => {
  assert.equal(snapshot(build([announcement()])).metric, "attributable_net_profit");
});

test("maps adjusted net profit", () => {
  assert.equal(snapshot(build([announcement({ event: { profitMetric: "netProfitExcludingNonRecurring" } })])).metric, "adjusted_net_profit");
});

test("maps operating revenue", () => {
  assert.equal(snapshot(build([announcement({ event: { profitMetric: "operatingRevenue" } })])).metric, "revenue");
});

test("excludes unsupported metrics", () => {
  const result = build([announcement({ event: { profitMetric: "other" } })]);
  assert.equal(result.audit.reliableSnapshotCount, 0);
  assert.ok(result.companies[0].exclusions[0].reasons.includes("unsupported_metric"));
});

test("preserves range bounds without midpoint promotion", () => {
  const value = snapshot(build([announcement({ event: { lowerBound: 120, upperBound: 180 } })]));
  assert.deepEqual({ shape: value.estimateShape, value: value.value, lower: value.lowerBound, upper: value.upperBound }, { shape: "range", value: null, lower: 120, upper: 180 });
});

test("preserves negative loss ranges", () => {
  const value = snapshot(build([announcement({ event: { lowerBound: -57000000, upperBound: -41000000 } })]));
  assert.deepEqual([value.lowerBound, value.upperBound], [-57000000, -41000000]);
});

test("turn-positive direction does not change disclosed numbers", () => {
  const value = snapshot(build([announcement({ event: { forecastType: "turn_positive", lowerBound: 10, upperBound: 20 } })]));
  assert.deepEqual([value.lowerBound, value.upperBound], [10, 20]);
});

test("normalizes floating point CNY noise without changing sign", () => {
  const value = snapshot(build([announcement({ event: { lowerBound: 42967504400.00001, upperBound: 46671599600 } })]));
  assert.deepEqual([value.lowerBound, value.upperBound], [42967504400, 46671599600]);
});

test("keeps missing bounds excluded instead of zero", () => {
  const result = build([announcement({ event: { lowerBound: null } })]);
  assert.equal(result.audit.reliableSnapshotCount, 0);
  assert.ok(result.companies[0].exclusions[0].reasons.includes("range_incomplete"));
});

test("allows field-level high-confidence events from parse_partial", () => {
  const result = build([announcement({ parseStatus: "parse_partial" })]);
  assert.equal(result.audit.reliableSnapshotCount, 1);
});

test("excludes metadata_only even if malformed input carries an event", () => {
  const result = build([announcement({ parseStatus: "metadata_only" })]);
  assert.equal(result.audit.reliableSnapshotCount, 0);
  assert.ok(result.companies[0].exclusions[0].reasons.includes("parsed_fields_unavailable"));
});

test("earnings flash never becomes company guidance", () => {
  const result = build([announcement({ category: "performance_express" })]);
  assert.equal(result.audit.targetAnnouncementCount, 0);
});

test("periodic report never becomes company guidance", () => {
  const result = build([announcement({ category: "annual_report" })]);
  assert.equal(result.audit.targetAnnouncementCount, 0);
});

test("maps standard report periods to explicit scopes", () => {
  assert.deepEqual([periodScopeFor("2026-03-31"), periodScopeFor("2026-06-30"), periodScopeFor("2026-09-30"), periodScopeFor("2026-12-31")], ["single_quarter", "half_year", "first_three_quarters", "full_year"]);
});

test("rejects mismatched forecast period", () => {
  const result = build([announcement({ event: { forecastPeriod: "2025-06-30" } })]);
  assert.ok(result.companies[0].exclusions[0].reasons.includes("forecast_period_mismatch"));
});

test("evidence identity stays stable while immutable content version changes", () => {
  const first = snapshot(build([announcement()]));
  const second = snapshot(build([announcement({ title: "展示文案变化", sourceTextEvidence: "证据文案变化，单位万元" })]));
  assert.equal(first.providerEvidenceIdentity, second.providerEvidenceIdentity);
  assert.notEqual(first.id, second.id);
});

test("input order changes do not change provider ids", () => {
  const one = announcement({ id: "1001", reportPeriod: "2025-12-31" });
  const two = announcement({ id: "1002", reportPeriod: "2026-06-30", date: "2026-07-01" });
  const left = build([one, two]).companies[0].providerSnapshots.map((record) => record.snapshot.id).sort();
  const right = build([two, one]).companies[0].providerSnapshots.map((record) => record.snapshot.id).sort();
  assert.deepEqual(left, right);
});

test("links a revision to one explicit compatible predecessor", () => {
  const original = announcement({ id: "1001", date: "2026-01-01" });
  const revision = announcement({ id: "1002", date: "2026-01-02", category: "performance_forecast_revision", isCorrection: true, correctedAnnouncementId: "1001", event: { previousForecastAnnouncementId: "1001" } });
  const records = build([revision, original]).companies[0].providerSnapshots;
  const target = records.find((record) => record.sourceAnnouncementId === "1002");
  assert.equal(target.providerBusinessRevisionPredecessorSnapshotId, records.find((record) => record.sourceAnnouncementId === "1001").snapshot.id);
  assert.equal(target.snapshot.correctsSnapshotId, null);
});

test("links multiple revisions as one deterministic linear chain", () => {
  const original = announcement({ id: "1001", date: "2026-01-01" });
  const firstRevision = announcement({ id: "1002", date: "2026-01-02", category: "performance_forecast_revision", isCorrection: true, correctedAnnouncementId: "1001", event: { previousForecastAnnouncementId: "1001", lowerBound: 120, upperBound: 220 } });
  const secondRevision = announcement({ id: "1003", date: "2026-01-03", category: "performance_forecast_revision", isCorrection: true, correctedAnnouncementId: "1002", event: { previousForecastAnnouncementId: "1002", lowerBound: 140, upperBound: 240 } });
  const records = build([secondRevision, original, firstRevision]).companies[0].providerSnapshots;
  const byAnnouncement = new Map(records.map((record) => [record.sourceAnnouncementId, record]));
  assert.equal(byAnnouncement.get("1002").providerBusinessRevisionPredecessorSnapshotId, byAnnouncement.get("1001").snapshot.id);
  assert.equal(byAnnouncement.get("1003").providerBusinessRevisionPredecessorSnapshotId, byAnnouncement.get("1002").snapshot.id);
  assert.equal(new Set(records.map((record) => record.providerBusinessRevisionPredecessorSnapshotId).filter(Boolean)).size, 2);
});

test("does not link a revision across metrics", () => {
  const original = announcement({ id: "1001", date: "2026-01-01" });
  const revision = announcement({ id: "1002", date: "2026-01-02", category: "performance_forecast_revision", isCorrection: true, correctedAnnouncementId: "1001", event: { profitMetric: "operatingRevenue", previousForecastAnnouncementId: "1001" } });
  const target = build([original, revision]).companies[0].providerSnapshots.find((record) => record.sourceAnnouncementId === "1002");
  assert.equal(target.providerBusinessRevisionPredecessorSnapshotId, null);
  assert.ok(target.structuredWarnings.includes("revision_predecessor_missing"));
});

test("does not link a revision across report periods", () => {
  const original = announcement({ id: "1001", date: "2026-01-01", reportPeriod: "2025-12-31" });
  const revision = announcement({ id: "1002", date: "2026-07-01", reportPeriod: "2026-06-30", category: "performance_forecast_revision", isCorrection: true, correctedAnnouncementId: "1001", event: { forecastPeriod: "2026-06-30", previousForecastAnnouncementId: "1001" } });
  const target = build([original, revision]).companies[0].providerSnapshots.find((record) => record.sourceAnnouncementId === "1002");
  assert.equal(target.providerBusinessRevisionPredecessorSnapshotId, null);
});

test("a revision without a reliable new range becomes a warning only", () => {
  const revision = announcement({ id: "1002", category: "performance_forecast_revision", isCorrection: true, correctedAnnouncementId: "1001", events: [] });
  const result = build([revision]);
  assert.equal(result.audit.reliableSnapshotCount, 0);
  assert.equal(result.companies[0].warnings[0].code, "revision_without_reliable_range");
});

test("provider time semantics use disclosure proxy without fabricated formedAt", () => {
  const value = snapshot(build([announcement()]));
  assert.equal(value.formedAt, null);
  assert.equal(value.formationTimeBasis, "public_disclosure_proxy");
  assert.equal(value.notes, COMPANY_GUIDANCE_TIME_NOTE);
});

test("provider contract is verified and read-only by ingestion method", () => {
  const value = snapshot(build([announcement()]));
  assert.deepEqual([value.ingestionMethod, value.sourceVerificationStatus, value.currency, value.unit, value.accountingBasis], ["provider", "verified", "CNY", "yuan", "PRC_GAAP"]);
});

test("keeps upstream normalized yuan values and preserves original unit evidence", () => {
  const record = build([announcement({ event: { lowerBound: 1_000_000, upperBound: 2_000_000 }, sourceTextEvidence: "预计归母净利润100万元至200万元" })]).companies[0].providerSnapshots[0];
  assert.deepEqual([record.snapshot.lowerBound, record.snapshot.upperBound, record.snapshot.unit], [1_000_000, 2_000_000, "yuan"]);
  assert.equal(record.originalUnitEvidence, "万元");
});

test("stable id helper ignores current runtime and array index", () => {
  const fields = { announcementId: "1001", stockId: "sample", reportPeriod: "2025-12-31", periodScope: "full_year", metric: "revenue" };
  assert.equal(stableProviderSnapshotId(fields), stableProviderSnapshotId({ ...fields }));
});

test("no-op regeneration preserves version id and createdAt", () => {
  const first = build([announcement()]);
  const second = buildCompanyGuidanceArtifacts({ announcementDetails: [detail([announcement()])], sourceGeneratedAt: "2026-07-12T07:31:40Z", previousDetails: first.companies });
  assert.equal(second.companies[0].providerSnapshots[0].snapshot.id, first.companies[0].providerSnapshots[0].snapshot.id);
  assert.equal(second.companies[0].providerSnapshots[0].snapshot.createdAt, first.companies[0].providerSnapshots[0].snapshot.createdAt);
  assert.equal(second.companies[0].providerSnapshots[0].generatedAt, "2026-07-12T07:31:40Z");
  assert.equal(second.companies[0].providerSnapshots[0].snapshot.providerGeneratedAt, "2026-07-12T07:31:40Z");
  assert.equal(second.companies[0].historicalProviderVersions.length, 0);
});

test("A1-to-B-to-A2 correction keeps immutable correction time and proof across repeated no-op releases", () => {
  const a1 = build([announcement()]);
  const b = buildCompanyGuidanceArtifacts({
    announcementDetails: [detail([announcement({ event: { lowerBound: 120, upperBound: 220 } })])],
    sourceGeneratedAt: "2026-07-12T07:31:40Z",
    previousDetails: a1.companies,
  });
  const a2 = buildCompanyGuidanceArtifacts({
    announcementDetails: [detail([announcement()])],
    sourceGeneratedAt: "2026-07-13T07:31:40Z",
    previousDetails: b.companies,
  });
  const immutable = a2.companies[0].providerSnapshots[0];
  const noOpOne = buildCompanyGuidanceArtifacts({
    announcementDetails: [detail([announcement()])],
    sourceGeneratedAt: "2026-07-14T07:31:40Z",
    previousDetails: a2.companies,
  });
  const noOpTwo = buildCompanyGuidanceArtifacts({
    announcementDetails: [detail([announcement()])],
    sourceGeneratedAt: "2026-07-15T07:31:40Z",
    previousDetails: noOpOne.companies,
  });
  for (const refreshed of [noOpOne.companies[0].providerSnapshots[0], noOpTwo.companies[0].providerSnapshots[0]]) {
    assert.equal(refreshed.providerSnapshotVersionId, immutable.providerSnapshotVersionId);
    assert.equal(refreshed.providerContentChecksum, immutable.providerContentChecksum);
    assert.equal(refreshed.providerCorrectsVersionId, immutable.providerCorrectsVersionId);
    assert.deepEqual(refreshed.providerCorrectionChangedFields, immutable.providerCorrectionChangedFields);
    assert.equal(refreshed.snapshot.createdAt, immutable.snapshot.createdAt);
    assert.equal(refreshed.providerCorrectedAt, immutable.providerCorrectedAt);
  }
  const current = noOpTwo.companies[0].providerSnapshots[0];
  assert.equal(current.generatedAt, "2026-07-15T07:31:40Z");
  assert.equal(current.snapshot.providerGeneratedAt, "2026-07-15T07:31:40Z");
  assert.equal(noOpOne.companies[0].historicalProviderVersions.length, 2);
  assert.equal(noOpTwo.companies[0].historicalProviderVersions.length, 2);
  const workflow = createWorkflowIndex(noOpTwo.companies, noOpTwo.summary.generatedAt);
  assert.equal(workflow.correctionProofs.length, 1);
  assert.equal(workflow.correctionProofs[0].currentProviderSnapshotVersionId, current.providerSnapshotVersionId);
  assert.equal(workflow.correctionProofs[0].predecessorProviderSnapshotVersionId, b.companies[0].providerSnapshots[0].providerSnapshotVersionId);
});

test("content change appends an immutable extraction correction version", () => {
  const first = build([announcement()]);
  const changed = announcement({ event: { lowerBound: 120, upperBound: 220 } });
  const second = buildCompanyGuidanceArtifacts({ announcementDetails: [detail([changed])], sourceGeneratedAt: "2026-07-12T07:31:40Z", previousDetails: first.companies });
  const current = second.companies[0].providerSnapshots[0];
  assert.equal(second.companies[0].historicalProviderVersions.length, 1);
  assert.equal(current.providerCorrectsVersionId, first.companies[0].providerSnapshots[0].providerSnapshotVersionId);
  assert.equal(current.providerCorrectionType, "extraction_correction");
  assert.deepEqual(current.providerCorrectionChangedFields, ["lowerBound", "upperBound"]);
  assert.equal(current.snapshot.correctsSnapshotId, null);
});

test("generation blocks silent removal of prior evidence", () => {
  const first = build([announcement()]);
  assert.throws(() => buildCompanyGuidanceArtifacts({ announcementDetails: [detail([])], sourceGeneratedAt: "2026-07-12T07:31:40Z", previousDetails: first.companies }), /evidence disappeared/u);
});

test("version graph rejects cross-evidence predecessors and cycles", () => {
  const first = build([announcement({ id: "1001" }), announcement({ id: "1002" })]);
  const records = first.companies[0].providerSnapshots.map((record) => structuredClone(record));
  records[0].providerCorrectsVersionId = records[1].providerSnapshotVersionId;
  assert.ok(validateVersionGraph(records).some((error) => error.startsWith("invalid_version_predecessor")));
  records[1].providerEvidenceIdentity = records[0].providerEvidenceIdentity;
  records[1].providerCorrectsVersionId = records[0].providerSnapshotVersionId;
  assert.ok(validateVersionGraph(records).some((error) => error.startsWith("version_cycle")));
});

test("business revision graph rejects incompatible predecessors", () => {
  const result = build([announcement({ id: "1001" }), announcement({ id: "1002", category: "performance_forecast_revision", date: "2026-01-16", event: { profitMetric: "operatingRevenue" } })]);
  const records = result.companies[0].providerSnapshots;
  records[1].providerBusinessRevisionPredecessorSnapshotId = records[0].snapshot.id;
  assert.ok(validateBusinessRevisionGraph(records).some((error) => error.startsWith("incompatible_business_predecessor")));
});

test("strict CNInfo URL parsers reject lookalikes and non-canonical URLs", () => {
  assert.equal(parseOfficialCninfoAnnouncementUrl(CONTRACT_FIXTURES.validAnnouncementUrl)?.announcementId, CONTRACT_FIXTURES.announcementId);
  for (const url of CONTRACT_FIXTURES.invalidAnnouncementUrls) assert.equal(parseOfficialCninfoAnnouncementUrl(url), null);
  assert.equal(parseOfficialCninfoPdfUrl(CONTRACT_FIXTURES.validPdfUrl, CONTRACT_FIXTURES.announcementId)?.announcementId, CONTRACT_FIXTURES.announcementId);
  for (const url of CONTRACT_FIXTURES.invalidPdfUrls) assert.equal(parseOfficialCninfoPdfUrl(url, CONTRACT_FIXTURES.announcementId), null);
});

test("App global workflow loading is independent from navigation", () => {
  assert.match(APP_SOURCE, /useEffect\(\(\) => \{[\s\S]*?companyGuidanceLoader\.loadWorkflow\(\)[\s\S]*?\}, \[companyGuidanceLoader, companyGuidanceRetryToken, dataMode\]\);/u);
  assert.ok(APP_SOURCE.includes("setCompanyGuidanceWorkflowStatus(\"success\")"));
  assert.ok(APP_SOURCE.includes("[companyGuidanceLoader, companyGuidanceRetryToken, dataMode]"));
  assert.ok(APP_SOURCE.indexOf("companyGuidanceLoader.loadWorkflow()") < APP_SOURCE.indexOf("companyGuidanceLoader.loadMany(missingIds)"));
  assert.ok(APP_SOURCE.includes("selectActiveCompanyGuidanceProviderRecords(dataMode, companyGuidanceWorkflowStatus, companyGuidanceWorkflow)"));
});

test("App mode and request-generation guards block stale Provider results", () => {
  assert.ok(APP_SOURCE.includes('if (dataMode === "mock")'));
  assert.ok(APP_SOURCE.includes("companyGuidanceRequestGeneration.current"));
  assert.ok(APP_SOURCE.includes("generation !== companyGuidanceRequestGeneration.current"));
  assert.ok(APP_SOURCE.includes("setCompanyGuidanceWorkflow(null)"));
});

test("App exposes isolated detail errors and explicit retry", () => {
  assert.ok(APP_SOURCE.includes("companyGuidanceFailedStockIds.includes(stockId)"));
  assert.ok(APP_SOURCE.includes("setCompanyGuidanceLoadStatus(result.status)"));
  assert.ok(APP_SOURCE.includes("companyGuidanceLoader.clearCache()"));
  assert.ok(APP_SOURCE.includes("providerDetailLoadError={companyGuidanceLoadError}"));
});

function build(announcements) {
  return buildCompanyGuidanceArtifacts({ announcementDetails: [detail(announcements)], sourceGeneratedAt: GENERATED_AT });
}

function snapshot(result) { return result.companies[0].providerSnapshots[0].snapshot; }

function detail(announcements) {
  return { stockId: "sample", stockCode: "000001", companyName: "样本公司", announcements };
}

function announcement(overrides = {}) {
  const reportPeriod = overrides.reportPeriod ?? "2025-12-31";
  const date = overrides.date ?? "2026-01-15";
  const eventOverrides = overrides.event ?? {};
  const events = overrides.events ?? [{
    forecastPeriod: reportPeriod,
    forecastType: "increase",
    profitMetric: "netProfitAttributableToParent",
    lowerBound: 100,
    upperBound: 200,
    extractionConfidence: "high",
    sourceTextEvidence: overrides.sourceTextEvidence ?? "预计归母净利润100万元至200万元",
    previousForecastAnnouncementId: null,
    ...eventOverrides,
  }];
  return {
    announcementId: overrides.id ?? "1001",
    title: overrides.title ?? "2025年度业绩预告",
    category: overrides.category ?? "performance_forecast",
    announcementDate: date,
    reportPeriod,
    officialUrl: `https://www.cninfo.com.cn/new/disclosure/detail?annoId=${overrides.id ?? "1001"}`,
    pdfUrl: `https://static.cninfo.com.cn/finalpage/${date}/${overrides.id ?? "1001"}.PDF`,
    parseStatus: overrides.parseStatus ?? "parse_success",
    isCancelled: false,
    isDuplicate: false,
    duplicateOf: null,
    isCorrection: overrides.isCorrection ?? false,
    correctedAnnouncementId: overrides.correctedAnnouncementId ?? null,
    performanceForecastEvents: events,
  };
}
