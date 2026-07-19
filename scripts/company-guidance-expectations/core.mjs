import crypto from "node:crypto";
import {
  deriveCompanyGuidanceDetailStatus as deriveValidatedDetailStatus,
  deriveCompanyGuidanceManifestMetadata as deriveValidatedManifestMetadata,
  deriveCompanyGuidanceSummaryStatusFromStatuses,
  validateCompanyGuidanceDetailContract,
} from "../../src/services/companyGuidanceExpectationSelection.mjs";
import { isStrictPreciseInstant } from "../../src/utils/strictDateTime.mjs";
import {
  COMPANY_GUIDANCE_PARSE_RULES_VERSION as SHARED_PARSE_RULES_VERSION,
  COMPANY_GUIDANCE_PROVIDER_ID as SHARED_PROVIDER_ID,
  COMPANY_GUIDANCE_PROVIDER_VERSION as SHARED_PROVIDER_VERSION,
  COMPANY_GUIDANCE_TIME_NOTE as SHARED_TIME_NOTE,
  parseOfficialCninfoAnnouncementUrl,
  parseOfficialCninfoPdfUrl,
  providerContentChangedFields,
  providerContentProjection as sharedProviderContentProjection,
  validateCompanyGuidanceBusinessRevisionSemantics,
  validateCompanyGuidanceCorrectionGraph,
  validateCompanyGuidanceProviderRecordContract,
} from "../../src/services/companyGuidanceExpectationRecordContract.mjs";
import { COMPANY_GUIDANCE_SOURCE_ARTIFACT, deriveCompanyGuidanceSummaryAudit } from "../../src/services/companyGuidanceExpectationAudit.mjs";

export const COMPANY_GUIDANCE_SCHEMA_VERSION = "2.0.0";
export const COMPANY_GUIDANCE_PROVIDER_ID = SHARED_PROVIDER_ID;
export const COMPANY_GUIDANCE_PROVIDER_VERSION = SHARED_PROVIDER_VERSION;
export const COMPANY_GUIDANCE_PARSE_RULES_VERSION = SHARED_PARSE_RULES_VERSION;
export const COMPANY_GUIDANCE_GENERATOR = "scripts/generate-company-guidance-expectations.mjs";
export const COMPANY_GUIDANCE_TIME_NOTE = SHARED_TIME_NOTE;

const TARGET_CATEGORIES = new Set(["performance_forecast", "performance_forecast_revision"]);
const METRIC_MAP = new Map([
  ["netProfitAttributableToParent", "attributable_net_profit"],
  ["netProfitExcludingNonRecurring", "adjusted_net_profit"],
  ["operatingRevenue", "revenue"],
]);
const COMPANY_GUIDANCE_DETAIL_BASE_PATH = "data/a-share-company-guidance-expectations";
const SAFE_PROVIDER_STOCK_ID = /^[A-Za-z0-9_-]+$/u;
export const COMPANY_GUIDANCE_MANIFEST_METADATA_FIELDS = Object.freeze([
  "stockId", "stockCode", "companyName", "relativePath", "status", "snapshotCount", "historicalVersionCount",
  "excludedAnnouncementCount", "latestReportPeriod", "latestSourceDate",
]);
export const COMPANY_GUIDANCE_SUMMARY_ITEM_FIELDS = Object.freeze([
  "stockId", "stockCode", "companyName", "status", "snapshotCount", "excludedAnnouncementCount",
  "latestReportPeriod", "latestSourceDate", "detailPath",
]);

export function periodScopeFor(reportPeriod) {
  if (typeof reportPeriod !== "string") return null;
  if (reportPeriod.endsWith("-03-31")) return "single_quarter";
  if (reportPeriod.endsWith("-06-30")) return "half_year";
  if (reportPeriod.endsWith("-09-30")) return "first_three_quarters";
  if (reportPeriod.endsWith("-12-31")) return "full_year";
  return null;
}

export { parseOfficialCninfoAnnouncementUrl, parseOfficialCninfoPdfUrl };

export function stableProviderEvidenceIdentity(fields) {
  return [COMPANY_GUIDANCE_PROVIDER_ID, String(fields.announcementId), fields.stockId, fields.reportPeriod, fields.periodScope, fields.metric].join("|");
}

/** Backward-compatible helper name; this is now the evidence identity, not a mutable content version. */
export function stableProviderSnapshotId(fields) {
  return `company-guidance-evidence-${sha256(stableProviderEvidenceIdentity(fields)).slice(0, 24)}`;
}

export function stableProviderSnapshotVersionId(contentChecksum) {
  return `company-guidance-version-${contentChecksum}`;
}

export function stableProviderCorrectionVersionId({ providerEvidenceIdentity, providerCorrectsVersionId, providerContentChecksum }) {
  if (!providerEvidenceIdentity || !providerCorrectsVersionId || !providerContentChecksum) throw new Error("correction version identity requires evidence, predecessor and content checksum");
  return `company-guidance-version-${sha256(canonicalJson({ providerEvidenceIdentity, providerCorrectsVersionId, providerContentChecksum }))}`;
}

export function expectedProviderSnapshotVersionId(record) {
  const predecessor = record?.providerCorrectsVersionId ?? record?.snapshot?.providerCorrectsVersionId ?? null;
  const evidenceIdentity = record?.providerEvidenceIdentity ?? record?.snapshot?.providerEvidenceIdentity;
  const contentChecksum = record?.providerContentChecksum ?? record?.snapshot?.providerContentChecksum;
  return predecessor
    ? stableProviderCorrectionVersionId({ providerEvidenceIdentity: evidenceIdentity, providerCorrectsVersionId: predecessor, providerContentChecksum: contentChecksum })
    : stableProviderSnapshotVersionId(contentChecksum);
}

export function stableSourceArtifactChecksum(fields) {
  return sha256(canonicalJson(fields));
}

export function providerContentProjection(record) {
  return sharedProviderContentProjection(record);
}

export function computeProviderContentChecksum(record) {
  return sha256(canonicalJson(providerContentProjection(record)));
}

export function companyGuidanceDetailRelativePath(stockId) {
  if (typeof stockId !== "string" || !SAFE_PROVIDER_STOCK_ID.test(stockId)) throw new Error(`unsafe company-guidance stockId: ${String(stockId)}`);
  return `${COMPANY_GUIDANCE_DETAIL_BASE_PATH}/${stockId}.json`;
}

export function deriveCompanyGuidanceDetailStatus(detail) {
  return deriveValidatedDetailStatus(detail);
}

export function deriveCompanyGuidanceManifestMetadata(detail) {
  return deriveValidatedManifestMetadata(detail);
}

export function deriveCompanyGuidanceSummaryItem(detail) {
  const metadata = deriveCompanyGuidanceManifestMetadata(detail);
  return {
    stockId: metadata.stockId,
    stockCode: metadata.stockCode,
    companyName: metadata.companyName,
    status: metadata.status,
    snapshotCount: metadata.snapshotCount,
    excludedAnnouncementCount: metadata.excludedAnnouncementCount,
    latestReportPeriod: metadata.latestReportPeriod,
    latestSourceDate: metadata.latestSourceDate,
    detailPath: metadata.relativePath,
  };
}

export function deriveCompanyGuidanceSummaryStatus(details) {
  if (!Array.isArray(details)) throw new Error("company-guidance details must be an array");
  return deriveCompanyGuidanceSummaryStatusFromStatuses(details.map(deriveCompanyGuidanceDetailStatus));
}

export function buildCompanyGuidanceArtifacts({ announcementDetails, sourceGeneratedAt, previousDetails = [] }) {
  if (!Array.isArray(announcementDetails) || !announcementDetails.length) throw new Error("announcementDetails must be a non-empty array");
  if (!isStrictPreciseInstant(sourceGeneratedAt)) throw new Error("sourceGeneratedAt must be a precise instant");
  const duplicateInputStockIds = duplicates(announcementDetails.map((detail) => detail?.stockId));
  const duplicateInputStockCodes = duplicates(announcementDetails.map((detail) => detail?.stockCode));
  if (duplicateInputStockIds.length || duplicateInputStockCodes.length) throw new Error(`duplicate announcement company identity: stockIds=${duplicateInputStockIds.join(",")} stockCodes=${duplicateInputStockCodes.join(",")}`);
  const duplicatePreviousStockIds = duplicates((previousDetails ?? []).filter(Boolean).map((detail) => detail.stockId));
  if (duplicatePreviousStockIds.length) throw new Error(`duplicate previous provider company identity: ${duplicatePreviousStockIds.join(",")}`);
  const previousByStock = new Map((previousDetails ?? []).filter(Boolean).map((detail) => [detail.stockId, detail]));
  const inputStockIds = new Set(announcementDetails.map((detail) => detail.stockId));
  const removedStocks = [...previousByStock.keys()].filter((stockId) => !inputStockIds.has(stockId));
  if (removedStocks.length) throw new Error(`previous provider companies disappeared: ${removedStocks.join(",")}`);

  const companies = announcementDetails
    .map((detail) => buildCompany(detail, sourceGeneratedAt, previousByStock.get(detail.stockId)))
    .sort((left, right) => left.stockId.localeCompare(right.stockId));
  const allRecords = companies.flatMap((company) => company.providerSnapshots);
  attachBusinessRevisionChains(allRecords, companies);
  for (const company of companies) {
    const validationErrors = validateCompanyGuidanceDetail(company, { expectedGenerationEpoch: sourceGeneratedAt });
    if (validationErrors.length) throw new Error(`invalid generated company ${company.stockId}: ${validationErrors.join("; ")}`);
  }

  const audit = deriveCompanyGuidanceSummaryAudit(companies);

  const summary = {
    schemaVersion: COMPANY_GUIDANCE_SCHEMA_VERSION,
    providerId: COMPANY_GUIDANCE_PROVIDER_ID,
    providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    generatedAt: sourceGeneratedAt,
    sourceArtifact: COMPANY_GUIDANCE_SOURCE_ARTIFACT,
    sourceGeneratedAt,
    status: deriveCompanyGuidanceSummaryStatus(companies),
    audit,
    workflowIndex: { relativePath: "data/a-share-company-guidance-expectations/workflow-index.generated.json", byteSize: 0, checksumSha256: "", currentSnapshotCount: allRecords.length },
    items: Object.fromEntries(companies.map((company) => [company.stockId, deriveCompanyGuidanceSummaryItem(company)])),
  };
  return { companies, summary, audit };
}

function buildCompany(detail, sourceGeneratedAt, previousDetail) {
  if (!detail || typeof detail !== "object" || !Array.isArray(detail.announcements)) throw new Error("invalid announcement detail");
  const targetAnnouncements = [];
  const candidates = [];
  const exclusions = [];
  const warnings = [];

  for (const announcement of [...detail.announcements].sort((a, b) => String(a.announcementId).localeCompare(String(b.announcementId)))) {
    if (!TARGET_CATEGORIES.has(announcement.category)) continue;
    const sourceAnnouncementType = announcement.category === "performance_forecast_revision" ? "earnings_preview_revision" : "earnings_preview";
    const announcementId = String(announcement.announcementId);
    const officialSource = parseOfficialCninfoAnnouncementUrl(announcement.officialUrl);
    const officialPdf = parseOfficialCninfoPdfUrl(announcement.pdfUrl, announcementId);
    const periodScope = periodScopeFor(announcement.reportPeriod);
    targetAnnouncements.push({
      sourceAnnouncementId: announcementId, stockId: detail.stockId, sourceAnnouncementType,
      sourceDate: announcement.announcementDate ?? null, reportPeriod: announcement.reportPeriod ?? null,
      periodScope, parseStatus: announcement.parseStatus ?? "unknown",
      isDuplicate: Boolean(announcement.isDuplicate || announcement.duplicateOf),
    });
    const baseReasons = [];
    if (!announcement.reportPeriod) baseReasons.push("report_period_missing");
    if (announcement.reportPeriod && !periodScope) baseReasons.push("period_scope_unclear");
    if (!announcement.announcementDate) baseReasons.push("source_date_missing");
    if (!officialSource || !officialPdf || officialSource?.announcementId !== announcementId || officialPdf?.sourceDate !== announcement.announcementDate) baseReasons.push("official_source_invalid");
    if (announcement.isCancelled) baseReasons.push("cancelled_announcement");
    if (announcement.isDuplicate || announcement.duplicateOf) baseReasons.push("duplicate_announcement");
    if (["metadata_only", "parse_unavailable"].includes(announcement.parseStatus)) baseReasons.push("parsed_fields_unavailable");
    const events = Array.isArray(announcement.performanceForecastEvents) ? announcement.performanceForecastEvents : [];
    if (!events.length) {
      exclusions.push(exclusionRecord(detail, announcement, sourceAnnouncementType, [...baseReasons, sourceAnnouncementType === "earnings_preview_revision" ? "no_reliable_revised_range" : "no_reliable_forecast_range", `parse_status_${announcement.parseStatus ?? "unknown"}`]));
      if (sourceAnnouncementType === "earnings_preview_revision") warnings.push({ code: "revision_without_reliable_range", sourceAnnouncementId: announcementId, candidateAnnouncementIds: uniqueStrings([announcement.correctedAnnouncementId]), message: "修正公告身份已保留，但没有可靠新区间，未生成方向性修订快照。" });
      continue;
    }
    for (const event of events) {
      const metric = METRIC_MAP.get(event.profitMetric) ?? null;
      const reasons = [...baseReasons];
      if (!metric) reasons.push("unsupported_metric");
      if (!event.forecastPeriod || event.forecastPeriod !== announcement.reportPeriod) reasons.push("forecast_period_mismatch");
      if (!Number.isFinite(event.lowerBound) || !Number.isFinite(event.upperBound)) reasons.push("range_incomplete");
      if (Number.isFinite(event.lowerBound) && Number.isFinite(event.upperBound) && event.lowerBound > event.upperBound) reasons.push("range_order_invalid");
      if (event.extractionConfidence !== "high") reasons.push("field_confidence_not_high");
      if (typeof event.sourceTextEvidence !== "string" || !event.sourceTextEvidence.trim()) reasons.push("source_text_evidence_missing");
      else if (!extractUnitEvidence(event.sourceTextEvidence)) reasons.push("original_unit_evidence_missing");
      if (reasons.length) { exclusions.push(exclusionRecord(detail, announcement, sourceAnnouncementType, reasons, event.profitMetric ?? null)); continue; }
      candidates.push(buildCandidate({ detail, announcement, event, announcementId, sourceAnnouncementType, periodScope, metric, sourceGeneratedAt, officialSource, officialPdf }));
    }
  }

  const { current, historical } = reconcileVersions(candidates, previousDetail, sourceGeneratedAt, detail.stockId);
  const status = deriveCompanyGuidanceDetailStatus({
    stockId: detail.stockId, companyName: detail.companyName, targetAnnouncements, providerSnapshots: current,
    historicalProviderVersions: historical, exclusions, warnings,
  });
  return {
    schemaVersion: COMPANY_GUIDANCE_SCHEMA_VERSION, providerId: COMPANY_GUIDANCE_PROVIDER_ID, providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    generatedAt: sourceGeneratedAt, stockId: detail.stockId, stockCode: detail.stockCode, companyName: detail.companyName, market: "A股", status,
    totalAnnouncementCount: detail.announcements.length, targetAnnouncements, providerSnapshots: current, historicalProviderVersions: historical,
    exclusions, warnings, quality: { source: "CNInfo", sourceLayer: "company_guidance_expectations", sourceUrl: "https://www.cninfo.com.cn/new/hisAnnouncement/query", updatedAt: sourceGeneratedAt, status },
  };
}

function buildCandidate({ detail, announcement, event, announcementId, sourceAnnouncementType, periodScope, metric, sourceGeneratedAt, officialSource, officialPdf }) {
  const lowerBound = normalizeCny(event.lowerBound);
  const upperBound = normalizeCny(event.upperBound);
  const providerEvidenceIdentity = stableProviderEvidenceIdentity({ announcementId, stockId: detail.stockId, reportPeriod: announcement.reportPeriod, periodScope, metric });
  const sourceTextEvidence = event.sourceTextEvidence;
  const sourceTextEvidenceHash = sha256(sourceTextEvidence);
  const shell = { providerEvidenceIdentity, snapshot: { estimateShape: "range", value: null, lowerBound, upperBound, currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP", sourcePublishedAt: announcement.announcementDate }, sourceTextEvidenceHash, providerParseRulesVersion: COMPANY_GUIDANCE_PARSE_RULES_VERSION };
  const providerContentChecksum = computeProviderContentChecksum(shell);
  const providerSnapshotVersionId = stableProviderSnapshotVersionId(providerContentChecksum);
  const base = {
    providerId: COMPANY_GUIDANCE_PROVIDER_ID, providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    providerEvidenceIdentity, providerSnapshotVersionId, providerContentChecksum, providerParseRulesVersion: COMPANY_GUIDANCE_PARSE_RULES_VERSION,
    providerCorrectsVersionId: null, providerCorrectionType: "initial", providerCorrectedAt: null, providerCorrectionChangedFields: [], isCurrentVersion: true,
    providerBusinessRevisionPredecessorSnapshotId: null,
    snapshot: {
      id: providerSnapshotVersionId, stockId: detail.stockId, market: "A股", reportPeriod: announcement.reportPeriod, periodScope, metric,
      estimateShape: "range", value: null, lowerBound, upperBound, currency: "CNY", unit: "yuan", accountingBasis: "PRC_GAAP",
      sourceCategory: "company_guidance", sourceName: detail.companyName, sourceTitle: announcement.title,
      sourceUrl: officialSource.canonicalUrl, sourcePublishedAt: announcement.announcementDate, sourcePublishedAtPrecision: "date", sourcePublishedAtResolution: "date", sourcePublishedAtTimeZone: null, sourcePublishedAtCalendarDate: announcement.announcementDate,
      asOfDate: announcement.announcementDate, formedAt: null, formedAtPrecision: "date", formedAtResolution: "date", formedAtTimeZone: null, formedAtCalendarDate: announcement.announcementDate, formationTimeBasis: "public_disclosure_proxy",
      providerId: COMPANY_GUIDANCE_PROVIDER_ID, providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION, providerGeneratedAt: sourceGeneratedAt,
      providerEvidenceIdentity, providerSnapshotVersionId, providerContentChecksum, providerParseRulesVersion: COMPANY_GUIDANCE_PARSE_RULES_VERSION,
      providerCorrectsVersionId: null, providerCorrectionType: "initial", providerCorrectedAt: null, providerCorrectionChangedFields: [], isCurrentProviderVersion: true, providerBusinessRevisionPredecessorSnapshotId: null,
      sourceAnnouncementId: announcementId, sourceAnnouncementType, officialPdfUrl: officialPdf.canonicalUrl, artifactChecksum: providerContentChecksum,
      analystCount: null, institutionCount: null, ingestionMethod: "provider", createdAt: sourceGeneratedAt, createdBy: COMPANY_GUIDANCE_PROVIDER_ID,
      sourceVerificationStatus: "verified", notes: COMPANY_GUIDANCE_TIME_NOTE, correctsSnapshotId: null, correctionScope: null, schemaVersion: 2,
    },
    sourceAnnouncementId: announcementId, sourceAnnouncementType, officialSourceUrl: officialSource.canonicalUrl, officialPdfUrl: officialPdf.canonicalUrl,
    sourceDate: announcement.announcementDate, generatedAt: sourceGeneratedAt, artifactChecksum: providerContentChecksum,
    sourceParseStatus: announcement.parseStatus, sourceExtractionConfidence: event.extractionConfidence, sourceTextEvidence, sourceTextEvidenceHash,
    originalUnitEvidence: extractUnitEvidence(sourceTextEvidence), correctionCandidateAnnouncementIds: uniqueStrings([announcement.correctedAnnouncementId, event.previousForecastAnnouncementId]), structuredWarnings: [],
  };
  return base;
}

function reconcileVersions(candidates, previousDetail, sourceGeneratedAt, stockId) {
  const previousCurrent = new Map((previousDetail?.providerSnapshots ?? []).map((record) => [deriveEvidenceIdentity(record), record]));
  const previousHistorical = (previousDetail?.historicalProviderVersions ?? []).map((record) => normalizePreviousVersion(record, false));
  const candidateIds = new Set(candidates.map((record) => record.providerEvidenceIdentity));
  const removed = [...previousCurrent.keys()].filter((identity) => !candidateIds.has(identity));
  if (removed.length) throw new Error(`previous provider evidence disappeared for ${stockId}: ${removed.join(",")}`);
  const current = [];
  const historical = [...previousHistorical];
  for (const candidate of candidates.sort((a, b) => a.providerEvidenceIdentity.localeCompare(b.providerEvidenceIdentity))) {
    const previous = previousCurrent.get(candidate.providerEvidenceIdentity);
    if (!previous) { current.push(candidate); continue; }
    const previousChecksum = deriveContentChecksum(previous);
    if (previousChecksum === candidate.providerContentChecksum) {
      candidate.snapshot.createdAt = previous.snapshot.createdAt;
      candidate.providerSnapshotVersionId = previous.providerSnapshotVersionId;
      candidate.providerCorrectsVersionId = previous.providerCorrectsVersionId ?? null;
      candidate.providerCorrectionType = previous.providerCorrectionType ?? "initial";
      candidate.providerCorrectedAt = candidate.providerCorrectionType === "extraction_correction" ? sourceGeneratedAt : null;
      candidate.providerCorrectionChangedFields = previous.providerCorrectionChangedFields ?? [];
      syncVersionFields(candidate);
      current.push(candidate);
      continue;
    }
    const previousVersion = normalizePreviousVersion(previous, false);
    historical.push(previousVersion);
    candidate.providerCorrectsVersionId = previousVersion.providerSnapshotVersionId;
    candidate.providerCorrectionType = "extraction_correction";
    candidate.providerCorrectedAt = sourceGeneratedAt;
    candidate.providerCorrectionChangedFields = changedContentFields(previousVersion, candidate);
    candidate.providerSnapshotVersionId = expectedProviderSnapshotVersionId(candidate);
    syncVersionFields(candidate);
    current.push(candidate);
  }
  return { current, historical: dedupeVersions(historical).sort((a, b) => a.providerSnapshotVersionId.localeCompare(b.providerSnapshotVersionId)) };
}

function normalizePreviousVersion(record, isCurrentVersion) {
  const copy = structuredClone(record);
  copy.providerEvidenceIdentity = deriveEvidenceIdentity(copy);
  copy.sourceTextEvidenceHash = copy.sourceTextEvidenceHash ?? sha256(copy.sourceTextEvidence ?? "");
  copy.providerParseRulesVersion = copy.providerParseRulesVersion ?? COMPANY_GUIDANCE_PARSE_RULES_VERSION;
  copy.providerContentChecksum = deriveContentChecksum(copy);
  copy.providerCorrectsVersionId = copy.providerCorrectsVersionId ?? null;
  copy.providerCorrectionType = copy.providerCorrectionType ?? "initial";
  copy.providerCorrectedAt = copy.providerCorrectedAt ?? null;
  copy.providerCorrectionChangedFields = copy.providerCorrectionChangedFields ?? [];
  const expectedVersionId = expectedProviderSnapshotVersionId(copy);
  if (copy.providerSnapshotVersionId && copy.providerSnapshotVersionId !== expectedVersionId) throw new Error(`invalid previous provider version identity: ${copy.providerSnapshotVersionId}`);
  copy.providerSnapshotVersionId = expectedVersionId;
  copy.isCurrentVersion = isCurrentVersion;
  copy.providerBusinessRevisionPredecessorSnapshotId = copy.providerBusinessRevisionPredecessorSnapshotId ?? null;
  copy.artifactChecksum = copy.providerContentChecksum;
  copy.snapshot.id = copy.providerSnapshotVersionId;
  copy.snapshot.providerGeneratedAt = copy.generatedAt;
  syncVersionFields(copy);
  return copy;
}

function syncVersionFields(record) {
  record.snapshot.id = record.providerSnapshotVersionId;
  Object.assign(record.snapshot, {
    providerEvidenceIdentity: record.providerEvidenceIdentity, providerSnapshotVersionId: record.providerSnapshotVersionId,
    providerContentChecksum: record.providerContentChecksum, providerParseRulesVersion: record.providerParseRulesVersion,
    providerCorrectsVersionId: record.providerCorrectsVersionId, providerCorrectionType: record.providerCorrectionType,
    providerCorrectedAt: record.providerCorrectedAt, providerCorrectionChangedFields: record.providerCorrectionChangedFields,
    isCurrentProviderVersion: record.isCurrentVersion, providerBusinessRevisionPredecessorSnapshotId: record.providerBusinessRevisionPredecessorSnapshotId,
    artifactChecksum: record.providerContentChecksum,
  });
}

function attachBusinessRevisionChains(allRecords, companies) {
  const byGroup = new Map();
  for (const record of allRecords) {
    const key = [record.snapshot.stockId, record.snapshot.reportPeriod, record.snapshot.periodScope, record.snapshot.metric].join("|");
    const values = byGroup.get(key) ?? []; values.push(record); byGroup.set(key, values);
  }
  for (const values of byGroup.values()) {
    values.sort((left, right) => left.sourceDate.localeCompare(right.sourceDate) || left.sourceAnnouncementId.localeCompare(right.sourceAnnouncementId));
    for (const record of values.filter((item) => item.sourceAnnouncementType === "earnings_preview_revision")) {
      const earlier = values.filter((item) => item.sourceDate < record.sourceDate);
      const explicitIds = new Set(record.correctionCandidateAnnouncementIds);
      let candidates = explicitIds.size ? earlier.filter((item) => explicitIds.has(item.sourceAnnouncementId)) : [];
      if (!candidates.length && !explicitIds.size && earlier.length) { const latestDate = earlier.map((item) => item.sourceDate).sort().at(-1); candidates = earlier.filter((item) => item.sourceDate === latestDate); }
      if (candidates.length === 1) {
        record.providerBusinessRevisionPredecessorSnapshotId = candidates[0].snapshot.id;
        record.snapshot.providerBusinessRevisionPredecessorSnapshotId = candidates[0].snapshot.id;
      } else {
        const code = candidates.length ? "revision_predecessor_ambiguous" : "revision_predecessor_missing";
        record.structuredWarnings.push(code);
        record.correctionCandidateAnnouncementIds = uniqueStrings([...record.correctionCandidateAnnouncementIds, ...candidates.map((item) => item.sourceAnnouncementId)]);
        companies.find((item) => item.stockId === record.snapshot.stockId)?.warnings.push({ code, sourceAnnouncementId: record.sourceAnnouncementId, candidateAnnouncementIds: record.correctionCandidateAnnouncementIds, message: "无法唯一确认前一条公司指引，未建立猜测性业务修订链。" });
      }
    }
  }
}

export function validateProviderRecord(record, {
  stockId = record?.snapshot?.stockId,
  companyName = record?.snapshot?.sourceName,
  mode = "detail_current",
  expectedGenerationEpoch = null,
} = {}) {
  const errors = validateCompanyGuidanceProviderRecordContract(record, { stockId, companyName, mode, expectedGenerationEpoch });
  if (!record || typeof record !== "object" || !record.snapshot) return uniqueStrings(errors);
  const snapshot = record.snapshot;
  const identity = stableProviderEvidenceIdentity({ announcementId: record.sourceAnnouncementId, stockId: snapshot.stockId, reportPeriod: snapshot.reportPeriod, periodScope: snapshot.periodScope, metric: snapshot.metric });
  if (record.providerEvidenceIdentity !== identity || snapshot.providerEvidenceIdentity !== identity) errors.push("provider_snapshot_mirror_contract");
  if (mode !== "workflow_current" && sha256(record.sourceTextEvidence ?? "") !== record.sourceTextEvidenceHash) errors.push("provider_snapshot_evidence_contract");
  const checksum = computeProviderContentChecksum(record);
  if (record.providerContentChecksum !== checksum || snapshot.providerContentChecksum !== checksum
    || record.artifactChecksum !== checksum || snapshot.artifactChecksum !== checksum) errors.push("provider_snapshot_mirror_contract");
  const versionId = expectedProviderSnapshotVersionId({ ...record, providerContentChecksum: checksum });
  if (record.providerSnapshotVersionId !== versionId || snapshot.providerSnapshotVersionId !== versionId || snapshot.id !== versionId) errors.push("provider_snapshot_mirror_contract");
  return uniqueStrings(errors);
}

export function validateVersionGraph(records) {
  const errors = [];
  const byId = new Map();
  const currentByEvidence = new Map();
  const successorByPredecessor = new Map();
  for (const record of records) {
    if (byId.has(record.providerSnapshotVersionId)) errors.push(`duplicate_version:${record.providerSnapshotVersionId}`);
    byId.set(record.providerSnapshotVersionId, record);
    if (record.isCurrentVersion) {
      if (currentByEvidence.has(record.providerEvidenceIdentity)) errors.push(`multiple_current:${record.providerEvidenceIdentity}`);
      currentByEvidence.set(record.providerEvidenceIdentity, record);
    }
  }
  for (const record of records) if (record.providerCorrectsVersionId) {
    if (!byId.has(record.providerCorrectsVersionId) || byId.get(record.providerCorrectsVersionId).providerEvidenceIdentity !== record.providerEvidenceIdentity) errors.push(`invalid_version_predecessor:${record.providerSnapshotVersionId}`);
    if (successorByPredecessor.has(record.providerCorrectsVersionId)) errors.push(`multiple_version_successors:${record.providerCorrectsVersionId}`);
    successorByPredecessor.set(record.providerCorrectsVersionId, record.providerSnapshotVersionId);
  }
  for (const record of records) {
    const seen = new Set(); let cursor = record;
    while (cursor?.providerCorrectsVersionId) { if (seen.has(cursor.providerCorrectsVersionId)) { errors.push(`version_cycle:${record.providerSnapshotVersionId}`); break; } seen.add(cursor.providerCorrectsVersionId); cursor = byId.get(cursor.providerCorrectsVersionId); }
  }
  return uniqueStrings(errors);
}

export function validateBusinessRevisionGraph(records) {
  const errors = [];
  const byId = new Map(records.map((record) => [record.snapshot.id, record]));
  for (const record of records) {
    const predecessorId = record.providerBusinessRevisionPredecessorSnapshotId;
    if (!predecessorId) continue;
    const predecessor = byId.get(predecessorId);
    if (!predecessor || record.sourceAnnouncementType !== "earnings_preview_revision") { errors.push(`invalid_business_predecessor:${record.snapshot.id}`); continue; }
    const currentKey = [record.snapshot.stockId, record.snapshot.reportPeriod, record.snapshot.periodScope, record.snapshot.metric].join("|");
    const previousKey = [predecessor.snapshot.stockId, predecessor.snapshot.reportPeriod, predecessor.snapshot.periodScope, predecessor.snapshot.metric].join("|");
    if (currentKey !== previousKey || predecessor.sourceDate >= record.sourceDate) errors.push(`incompatible_business_predecessor:${record.snapshot.id}`);
  }
  return uniqueStrings(errors);
}

export function validateCompanyGuidanceDetail(detail, options = {}) {
  const errors = validateCompanyGuidanceDetailContract(detail, options);
  const current = Array.isArray(detail?.providerSnapshots) ? detail.providerSnapshots : [];
  const historical = Array.isArray(detail?.historicalProviderVersions) ? detail.historicalProviderVersions : [];
  for (const record of current) errors.push(...validateProviderRecord(record, { stockId: detail?.stockId, companyName: detail?.companyName, mode: "detail_current", expectedGenerationEpoch: detail?.generatedAt }).map((error) => `${record?.sourceAnnouncementId ?? "<invalid>"}:${error}`));
  for (const record of historical) errors.push(...validateProviderRecord(record, { stockId: detail?.stockId, companyName: detail?.companyName, mode: "detail_historical", expectedGenerationEpoch: detail?.generatedAt }).map((error) => `${record?.sourceAnnouncementId ?? "<invalid>"}:${error}`));
  if ([...current, ...historical].every((record) => record && typeof record === "object" && record.snapshot)) {
    errors.push(...validateVersionGraph([...current, ...historical]));
    errors.push(...validateCompanyGuidanceCorrectionGraph([...current, ...historical], { generationEpoch: detail?.generatedAt }));
    errors.push(...validateBusinessRevisionGraph(current));
    errors.push(...validateCompanyGuidanceBusinessRevisionSemantics(current, detail?.warnings ?? []));
  }
  return uniqueStrings(errors);
}

export function createWorkflowIndex(companies, generatedAt) {
  const records = companies.flatMap((company) => company.providerSnapshots).map((record) => {
    const copy = structuredClone(record);
    delete copy.sourceTextEvidence;
    delete copy.originalUnitEvidence;
    return copy;
  }).sort((a, b) => a.snapshot.id.localeCompare(b.snapshot.id));
  return {
    schemaVersion: COMPANY_GUIDANCE_SCHEMA_VERSION, providerId: COMPANY_GUIDANCE_PROVIDER_ID, providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    generatedAt, currentSnapshotCount: records.length, records,
    warnings: companies.flatMap((company) => company.warnings.map((warning) => ({ ...warning, stockId: company.stockId }))),
  };
}

function deriveEvidenceIdentity(record) {
  return record.providerEvidenceIdentity ?? stableProviderEvidenceIdentity({ announcementId: record.sourceAnnouncementId, stockId: record.snapshot.stockId, reportPeriod: record.snapshot.reportPeriod, periodScope: record.snapshot.periodScope, metric: record.snapshot.metric });
}
function deriveContentChecksum(record) {
  const normalized = { ...record, providerEvidenceIdentity: deriveEvidenceIdentity(record), sourceTextEvidenceHash: record.sourceTextEvidenceHash ?? sha256(record.sourceTextEvidence ?? ""), providerParseRulesVersion: record.providerParseRulesVersion ?? COMPANY_GUIDANCE_PARSE_RULES_VERSION };
  return computeProviderContentChecksum(normalized);
}
function changedContentFields(previous, current) {
  return providerContentChangedFields(previous, current);
}
function dedupeVersions(records) { return [...new Map(records.map((record) => [record.providerSnapshotVersionId, record])).values()]; }
function duplicates(values) { const seen = new Set(); const repeated = new Set(); for (const value of values) { if (typeof value !== "string" || !value) continue; if (seen.has(value)) repeated.add(value); seen.add(value); } return [...repeated].sort(); }
function exclusionRecord(detail, announcement, sourceAnnouncementType, reasons, metric = null) { const source = parseOfficialCninfoAnnouncementUrl(announcement.officialUrl); const announcementId = String(announcement.announcementId); return { stockId: detail.stockId, companyName: detail.companyName, sourceAnnouncementId: announcementId, sourceAnnouncementType, sourceTitle: announcement.title, sourceDate: announcement.announcementDate ?? null, reportPeriod: announcement.reportPeriod ?? null, periodScope: periodScopeFor(announcement.reportPeriod), metric, parseStatus: announcement.parseStatus ?? "unknown", officialSourceUrl: source?.announcementId === announcementId ? source.canonicalUrl : null, candidateAnnouncementIds: uniqueStrings([announcement.correctedAnnouncementId]), reasons: uniqueStrings(reasons) }; }
function extractUnitEvidence(text) { if (typeof text !== "string") return null; return text.match(/(?:人民币)?(?:元|万元|百万元|亿元)/u)?.[0] ?? null; }
function normalizeCny(value) { if (!Number.isFinite(value)) return null; const rounded = Math.round(value); return Math.abs(value - rounded) < 0.01 ? rounded : Number(value.toFixed(2)); }
function uniqueStrings(values) { return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map(String))].sort(); }
export function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
