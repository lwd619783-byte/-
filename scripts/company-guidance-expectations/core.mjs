import crypto from "node:crypto";

export const COMPANY_GUIDANCE_SCHEMA_VERSION = "2.0.0";
export const COMPANY_GUIDANCE_PROVIDER_ID = "cninfo-company-guidance";
export const COMPANY_GUIDANCE_PROVIDER_VERSION = "2.0.0";
export const COMPANY_GUIDANCE_PARSE_RULES_VERSION = "1.0.0";
export const COMPANY_GUIDANCE_GENERATOR = "scripts/generate-company-guidance-expectations.mjs";
export const COMPANY_GUIDANCE_TIME_NOTE = "公司内部形成时间未知，以公开披露时间作为可用时间";

const TARGET_CATEGORIES = new Set(["performance_forecast", "performance_forecast_revision"]);
const METRIC_MAP = new Map([
  ["netProfitAttributableToParent", "attributable_net_profit"],
  ["netProfitExcludingNonRecurring", "adjusted_net_profit"],
  ["operatingRevenue", "revenue"],
]);
const FINANCIAL_CONTENT_FIELDS = [
  "estimateShape", "value", "lowerBound", "upperBound", "currency", "unit", "accountingBasis",
  "sourcePublishedAt", "sourceTextEvidenceHash", "providerParseRulesVersion",
];

export function periodScopeFor(reportPeriod) {
  if (typeof reportPeriod !== "string") return null;
  if (reportPeriod.endsWith("-03-31")) return "single_quarter";
  if (reportPeriod.endsWith("-06-30")) return "half_year";
  if (reportPeriod.endsWith("-09-30")) return "first_three_quarters";
  if (reportPeriod.endsWith("-12-31")) return "full_year";
  return null;
}

export function parseOfficialCninfoAnnouncementUrl(value) {
  try {
    const url = new URL(value);
    const entries = [...url.searchParams.entries()];
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    if (url.hostname !== "www.cninfo.com.cn" || url.pathname !== "/new/disclosure/detail") return null;
    if (entries.length !== 1 || entries[0][0] !== "annoId" || !/^\d+$/u.test(entries[0][1])) return null;
    return { announcementId: entries[0][1], canonicalUrl: `https://www.cninfo.com.cn/new/disclosure/detail?annoId=${entries[0][1]}` };
  } catch { return null; }
}

export function parseOfficialCninfoPdfUrl(value, expectedAnnouncementId = null) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    if (url.hostname !== "static.cninfo.com.cn") return null;
    const match = url.pathname.match(/^\/finalpage\/(\d{4}-\d{2}-\d{2})\/(\d+)\.PDF$/u);
    if (!match || (expectedAnnouncementId && match[2] !== expectedAnnouncementId)) return null;
    return { sourceDate: match[1], announcementId: match[2], canonicalUrl: `https://static.cninfo.com.cn${url.pathname}` };
  } catch { return null; }
}

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

export function stableSourceArtifactChecksum(fields) {
  return sha256(canonicalJson(fields));
}

export function providerContentProjection(record) {
  const snapshot = record.snapshot ?? record;
  return {
    providerEvidenceIdentity: record.providerEvidenceIdentity ?? snapshot.providerEvidenceIdentity,
    estimateShape: snapshot.estimateShape,
    value: snapshot.value,
    lowerBound: snapshot.lowerBound,
    upperBound: snapshot.upperBound,
    currency: snapshot.currency,
    unit: snapshot.unit,
    accountingBasis: snapshot.accountingBasis,
    sourcePublishedAt: snapshot.sourcePublishedAt,
    sourceTextEvidenceHash: record.sourceTextEvidenceHash,
    providerParseRulesVersion: record.providerParseRulesVersion ?? snapshot.providerParseRulesVersion,
  };
}

export function computeProviderContentChecksum(record) {
  return sha256(canonicalJson(providerContentProjection(record)));
}

export function buildCompanyGuidanceArtifacts({ announcementDetails, sourceGeneratedAt, previousDetails = [] }) {
  if (!Array.isArray(announcementDetails) || !announcementDetails.length) throw new Error("announcementDetails must be a non-empty array");
  if (!isPreciseInstant(sourceGeneratedAt)) throw new Error("sourceGeneratedAt must be a precise instant");
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
    const validationErrors = validateCompanyGuidanceDetail(company);
    if (validationErrors.length) throw new Error(`invalid generated company ${company.stockId}: ${validationErrors.join("; ")}`);
  }

  const allExclusions = companies.flatMap((company) => company.exclusions);
  const targetAnnouncements = companies.flatMap((company) => company.targetAnnouncements);
  const targetDates = targetAnnouncements.map((record) => record.sourceDate).filter(Boolean).sort();
  const audit = {
    totalAnnouncementCount: companies.reduce((sum, company) => sum + company.totalAnnouncementCount, 0),
    companyCount: companies.length,
    targetCompanyCount: new Set(targetAnnouncements.map((record) => record.stockId)).size,
    previewAnnouncementCount: targetAnnouncements.filter((record) => record.sourceAnnouncementType === "earnings_preview").length,
    revisionAnnouncementCount: targetAnnouncements.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision").length,
    targetAnnouncementCount: targetAnnouncements.length,
    targetWithReportPeriodCount: targetAnnouncements.filter((record) => record.reportPeriod).length,
    targetWithRecognizedPeriodScopeCount: targetAnnouncements.filter((record) => record.periodScope).length,
    parseStatusCounts: countBy(targetAnnouncements, (record) => record.parseStatus ?? "unknown"),
    reliableAnnouncementCount: new Set(allRecords.map((record) => record.sourceAnnouncementId)).size,
    reliableSnapshotCount: allRecords.length,
    reliableCompanyCount: new Set(allRecords.map((record) => record.snapshot.stockId)).size,
    historicalVersionCount: companies.reduce((sum, company) => sum + company.historicalProviderVersions.length, 0),
    metricCounts: countBy(allRecords, (record) => record.snapshot.metric),
    periodScopeCounts: countBy(allRecords, (record) => record.snapshot.periodScope),
    excludedTargetAnnouncementCount: new Set(allExclusions.map((record) => record.sourceAnnouncementId)).size,
    exclusionCount: allExclusions.length,
    exclusionReasonCounts: countNested(allExclusions, (record) => record.reasons),
    earliestSourceDate: targetDates[0] ?? null,
    latestSourceDate: targetDates.at(-1) ?? null,
    duplicateAnnouncementCount: targetAnnouncements.filter((record) => record.isDuplicate).length,
    linkedRevisionSnapshotCount: allRecords.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision" && record.providerBusinessRevisionPredecessorSnapshotId).length,
    unresolvedRevisionAnnouncementCount: targetAnnouncements.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision").filter((target) => !allRecords.some((record) => record.sourceAnnouncementId === target.sourceAnnouncementId && record.providerBusinessRevisionPredecessorSnapshotId)).length,
  };

  const summary = {
    schemaVersion: COMPANY_GUIDANCE_SCHEMA_VERSION,
    providerId: COMPANY_GUIDANCE_PROVIDER_ID,
    providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    generatedAt: sourceGeneratedAt,
    sourceArtifact: "CNInfo A-share announcement Provider V1 committed artifacts",
    sourceGeneratedAt,
    status: allRecords.length ? (allExclusions.length ? "partial" : "generated_real") : "missing",
    audit,
    workflowIndex: { relativePath: "data/a-share-company-guidance-expectations/workflow-index.generated.json", byteSize: 0, checksumSha256: "", currentSnapshotCount: allRecords.length },
    items: Object.fromEntries(companies.map((company) => [company.stockId, {
      stockId: company.stockId,
      stockCode: company.stockCode,
      companyName: company.companyName,
      status: company.status,
      snapshotCount: company.providerSnapshots.length,
      excludedAnnouncementCount: new Set(company.exclusions.map((record) => record.sourceAnnouncementId)).size,
      latestReportPeriod: company.providerSnapshots.map((record) => record.snapshot.reportPeriod).sort().at(-1) ?? null,
      latestSourceDate: company.providerSnapshots.map((record) => record.sourceDate).sort().at(-1) ?? null,
      detailPath: `data/a-share-company-guidance-expectations/${company.stockId}.json`,
    }])),
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
      if (reasons.length) { exclusions.push(exclusionRecord(detail, announcement, sourceAnnouncementType, reasons, event.profitMetric ?? null)); continue; }
      candidates.push(buildCandidate({ detail, announcement, event, announcementId, sourceAnnouncementType, periodScope, metric, sourceGeneratedAt, officialSource, officialPdf }));
    }
  }

  const { current, historical } = reconcileVersions(candidates, previousDetail, sourceGeneratedAt, detail.stockId);
  const status = current.length ? (exclusions.length ? "partial" : "generated_real") : targetAnnouncements.length ? "partial" : "missing";
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
  const sourceTextEvidenceHash = sha256(typeof sourceTextEvidence === "string" ? sourceTextEvidence : "");
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
      candidate.providerCorrectsVersionId = previous.providerCorrectsVersionId ?? null;
      candidate.providerCorrectionType = previous.providerCorrectionType ?? "initial";
      candidate.providerCorrectedAt = previous.providerCorrectedAt ?? null;
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
  copy.providerSnapshotVersionId = stableProviderSnapshotVersionId(copy.providerContentChecksum);
  copy.providerCorrectsVersionId = copy.providerCorrectsVersionId ?? null;
  copy.providerCorrectionType = copy.providerCorrectionType ?? "initial";
  copy.providerCorrectedAt = copy.providerCorrectedAt ?? null;
  copy.providerCorrectionChangedFields = copy.providerCorrectionChangedFields ?? [];
  copy.isCurrentVersion = isCurrentVersion;
  copy.providerBusinessRevisionPredecessorSnapshotId = copy.providerBusinessRevisionPredecessorSnapshotId ?? null;
  copy.artifactChecksum = copy.providerContentChecksum;
  copy.snapshot.id = copy.providerSnapshotVersionId;
  copy.snapshot.providerGeneratedAt = copy.generatedAt;
  syncVersionFields(copy);
  return copy;
}

function syncVersionFields(record) {
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

export function validateProviderRecord(record, { stockId = record?.snapshot?.stockId, current = true } = {}) {
  const errors = [];
  if (!record || typeof record !== "object" || !record.snapshot) return ["record_shape"];
  const snapshot = record.snapshot;
  const source = parseOfficialCninfoAnnouncementUrl(record.officialSourceUrl);
  const pdf = parseOfficialCninfoPdfUrl(record.officialPdfUrl, record.sourceAnnouncementId);
  if (!source || source.announcementId !== record.sourceAnnouncementId || source.canonicalUrl !== record.officialSourceUrl) errors.push("official_source_url");
  if (!pdf || pdf.canonicalUrl !== record.officialPdfUrl || pdf.sourceDate !== record.sourceDate) errors.push("official_pdf_url");
  if (snapshot.stockId !== stockId || snapshot.sourceUrl !== record.officialSourceUrl || snapshot.officialPdfUrl !== record.officialPdfUrl) errors.push("source_identity");
  if (record.providerId !== COMPANY_GUIDANCE_PROVIDER_ID || record.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION) errors.push("provider_contract");
  if (snapshot.ingestionMethod !== "provider" || snapshot.sourceCategory !== "company_guidance" || snapshot.sourceVerificationStatus !== "verified") errors.push("provider_boundary");
  if (snapshot.formationTimeBasis !== "public_disclosure_proxy" || snapshot.formedAt !== null || snapshot.sourcePublishedAt !== record.sourceDate) errors.push("time_contract");
  if (!isPreciseInstant(snapshot.createdAt) || !isPreciseInstant(record.generatedAt) || snapshot.asOfDate !== record.sourceDate || snapshot.sourcePublishedAtCalendarDate !== record.sourceDate) errors.push("instant_contract");
  if (snapshot.estimateShape === "range" && (!Number.isFinite(snapshot.lowerBound) || !Number.isFinite(snapshot.upperBound) || snapshot.lowerBound > snapshot.upperBound || snapshot.value !== null)) errors.push("range_contract");
  const identity = stableProviderEvidenceIdentity({ announcementId: record.sourceAnnouncementId, stockId: snapshot.stockId, reportPeriod: snapshot.reportPeriod, periodScope: snapshot.periodScope, metric: snapshot.metric });
  if (record.providerEvidenceIdentity !== identity || snapshot.providerEvidenceIdentity !== identity) errors.push("evidence_identity");
  if (!/^[a-f0-9]{64}$/u.test(record.sourceTextEvidenceHash ?? "") || (record.sourceTextEvidence !== undefined && sha256(record.sourceTextEvidence) !== record.sourceTextEvidenceHash)) errors.push("source_text_hash");
  const checksum = computeProviderContentChecksum(record);
  if (record.providerContentChecksum !== checksum || snapshot.providerContentChecksum !== checksum || record.artifactChecksum !== checksum) errors.push("content_checksum");
  const versionId = stableProviderSnapshotVersionId(checksum);
  if (record.providerSnapshotVersionId !== versionId || snapshot.providerSnapshotVersionId !== versionId || snapshot.id !== versionId) errors.push("version_identity");
  if (record.providerParseRulesVersion !== COMPANY_GUIDANCE_PARSE_RULES_VERSION || snapshot.providerParseRulesVersion !== COMPANY_GUIDANCE_PARSE_RULES_VERSION) errors.push("parse_rules_version");
  if (record.isCurrentVersion !== current || snapshot.isCurrentProviderVersion !== current) errors.push("current_version_flag");
  if (snapshot.correctsSnapshotId !== null) errors.push("correction_chain_conflation");
  if ((record.providerCorrectsVersionId === null) !== (record.providerCorrectionType === "initial")) errors.push("provider_correction_contract");
  return uniqueStrings(errors);
}

export function validateVersionGraph(records) {
  const errors = [];
  const byId = new Map();
  const currentByEvidence = new Map();
  for (const record of records) {
    if (byId.has(record.providerSnapshotVersionId)) errors.push(`duplicate_version:${record.providerSnapshotVersionId}`);
    byId.set(record.providerSnapshotVersionId, record);
    if (record.isCurrentVersion) {
      if (currentByEvidence.has(record.providerEvidenceIdentity)) errors.push(`multiple_current:${record.providerEvidenceIdentity}`);
      currentByEvidence.set(record.providerEvidenceIdentity, record);
    }
  }
  for (const record of records) if (record.providerCorrectsVersionId && (!byId.has(record.providerCorrectsVersionId) || byId.get(record.providerCorrectsVersionId).providerEvidenceIdentity !== record.providerEvidenceIdentity)) errors.push(`invalid_version_predecessor:${record.providerSnapshotVersionId}`);
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

export function validateCompanyGuidanceDetail(detail) {
  const errors = [];
  if (!detail || detail.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION || detail.providerId !== COMPANY_GUIDANCE_PROVIDER_ID || detail.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION) return ["detail_contract"];
  if (!Array.isArray(detail.providerSnapshots) || !Array.isArray(detail.historicalProviderVersions) || !Array.isArray(detail.exclusions) || !Array.isArray(detail.warnings)) return ["detail_arrays"];
  for (const record of detail.providerSnapshots) errors.push(...validateProviderRecord(record, { stockId: detail.stockId, current: true }).map((error) => `${record.sourceAnnouncementId}:${error}`));
  for (const record of detail.historicalProviderVersions) errors.push(...validateProviderRecord(record, { stockId: detail.stockId, current: false }).map((error) => `${record.sourceAnnouncementId}:${error}`));
  errors.push(...validateVersionGraph([...detail.providerSnapshots, ...detail.historicalProviderVersions]));
  errors.push(...validateBusinessRevisionGraph(detail.providerSnapshots));
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
  const left = providerContentProjection(previous); const right = providerContentProjection(current);
  return FINANCIAL_CONTENT_FIELDS.filter((field) => canonicalJson(left[field]) !== canonicalJson(right[field]));
}
function dedupeVersions(records) { return [...new Map(records.map((record) => [record.providerSnapshotVersionId, record])).values()]; }
function exclusionRecord(detail, announcement, sourceAnnouncementType, reasons, metric = null) { return { stockId: detail.stockId, companyName: detail.companyName, sourceAnnouncementId: String(announcement.announcementId), sourceAnnouncementType, sourceTitle: announcement.title, sourceDate: announcement.announcementDate ?? null, reportPeriod: announcement.reportPeriod ?? null, periodScope: periodScopeFor(announcement.reportPeriod), metric, parseStatus: announcement.parseStatus ?? "unknown", officialSourceUrl: announcement.officialUrl ?? null, candidateAnnouncementIds: uniqueStrings([announcement.correctedAnnouncementId]), reasons: uniqueStrings(reasons) }; }
function extractUnitEvidence(text) { if (typeof text !== "string") return null; return text.match(/(?:人民币)?(?:元|万元|百万元|亿元)/u)?.[0] ?? null; }
function normalizeCny(value) { if (!Number.isFinite(value)) return null; const rounded = Math.round(value); return Math.abs(value - rounded) < 0.01 ? rounded : Number(value.toFixed(2)); }
function countBy(values, keyFn) { return Object.fromEntries([...new Set(values.map(keyFn))].sort().map((key) => [key, values.filter((value) => keyFn(value) === key).length])); }
function countNested(values, keyFn) { const keys = [...new Set(values.flatMap(keyFn))].sort(); return Object.fromEntries(keys.map((key) => [key, values.filter((value) => keyFn(value).includes(key)).length])); }
function uniqueStrings(values) { return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map(String))].sort(); }
export function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function isPreciseInstant(value) { return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value)); }
