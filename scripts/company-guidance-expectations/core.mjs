import crypto from "node:crypto";

export const COMPANY_GUIDANCE_SCHEMA_VERSION = "1.0.0";
export const COMPANY_GUIDANCE_PROVIDER_ID = "cninfo-company-guidance";
export const COMPANY_GUIDANCE_PROVIDER_VERSION = "1.0.0";
export const COMPANY_GUIDANCE_GENERATOR = "scripts/generate-company-guidance-expectations.mjs";
export const COMPANY_GUIDANCE_TIME_NOTE = "公司内部形成时间未知，以公开披露时间作为可用时间";

const TARGET_CATEGORIES = new Set(["performance_forecast", "performance_forecast_revision"]);
const METRIC_MAP = new Map([
  ["netProfitAttributableToParent", "attributable_net_profit"],
  ["netProfitExcludingNonRecurring", "adjusted_net_profit"],
  ["operatingRevenue", "revenue"],
]);

export function periodScopeFor(reportPeriod) {
  if (typeof reportPeriod !== "string") return null;
  if (reportPeriod.endsWith("-03-31")) return "single_quarter";
  if (reportPeriod.endsWith("-06-30")) return "half_year";
  if (reportPeriod.endsWith("-09-30")) return "first_three_quarters";
  if (reportPeriod.endsWith("-12-31")) return "full_year";
  return null;
}

export function stableProviderSnapshotId(fields) {
  const identity = [
    "provider",
    fields.announcementId,
    fields.stockId,
    fields.reportPeriod,
    fields.periodScope,
    fields.metric,
  ].join("|");
  return `expectation-provider-${sha256(identity).slice(0, 24)}`;
}

export function stableSourceArtifactChecksum(fields) {
  return sha256(canonicalJson(fields));
}

export function buildCompanyGuidanceArtifacts({ announcementDetails, sourceGeneratedAt }) {
  if (!Array.isArray(announcementDetails) || !announcementDetails.length) throw new Error("announcementDetails must be a non-empty array");
  if (!isPreciseInstant(sourceGeneratedAt)) throw new Error("sourceGeneratedAt must be a precise instant");

  const companies = announcementDetails
    .map((detail) => buildCompany(detail, sourceGeneratedAt))
    .sort((left, right) => left.stockId.localeCompare(right.stockId));
  const allRecords = companies.flatMap((company) => company.providerSnapshots);
  attachRevisionChains(allRecords, companies);

  const allExclusions = companies.flatMap((company) => company.exclusions);
  const targetAnnouncements = companies.flatMap((company) => company.targetAnnouncements);
  const metricCounts = countBy(allRecords, (record) => record.snapshot.metric);
  const scopeCounts = countBy(allRecords, (record) => record.snapshot.periodScope);
  const parseStatusCounts = countBy(targetAnnouncements, (record) => record.parseStatus ?? "unknown");
  const exclusionReasonCounts = countNested(allExclusions, (record) => record.reasons);
  const previewCount = targetAnnouncements.filter((record) => record.sourceAnnouncementType === "earnings_preview").length;
  const revisionCount = targetAnnouncements.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision").length;
  const targetDates = targetAnnouncements.map((record) => record.sourceDate).filter(Boolean).sort();

  const audit = {
    totalAnnouncementCount: companies.reduce((sum, company) => sum + company.totalAnnouncementCount, 0),
    companyCount: companies.length,
    targetCompanyCount: new Set(targetAnnouncements.map((record) => record.stockId)).size,
    previewAnnouncementCount: previewCount,
    revisionAnnouncementCount: revisionCount,
    targetAnnouncementCount: targetAnnouncements.length,
    targetWithReportPeriodCount: targetAnnouncements.filter((record) => record.reportPeriod).length,
    targetWithRecognizedPeriodScopeCount: targetAnnouncements.filter((record) => record.periodScope).length,
    parseStatusCounts,
    reliableAnnouncementCount: new Set(allRecords.map((record) => record.sourceAnnouncementId)).size,
    reliableSnapshotCount: allRecords.length,
    reliableCompanyCount: new Set(allRecords.map((record) => record.snapshot.stockId)).size,
    metricCounts,
    periodScopeCounts: scopeCounts,
    excludedTargetAnnouncementCount: new Set(allExclusions.map((record) => record.sourceAnnouncementId)).size,
    exclusionCount: allExclusions.length,
    exclusionReasonCounts,
    earliestSourceDate: targetDates[0] ?? null,
    latestSourceDate: targetDates.at(-1) ?? null,
    duplicateAnnouncementCount: targetAnnouncements.filter((record) => record.isDuplicate).length,
    linkedRevisionSnapshotCount: allRecords.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision" && record.snapshot.correctsSnapshotId).length,
    unresolvedRevisionAnnouncementCount: targetAnnouncements.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision").filter((target) => !allRecords.some((record) => record.sourceAnnouncementId === target.sourceAnnouncementId && record.snapshot.correctsSnapshotId)).length,
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

function buildCompany(detail, sourceGeneratedAt) {
  if (!detail || typeof detail !== "object" || !Array.isArray(detail.announcements)) throw new Error("invalid announcement detail");
  const targetAnnouncements = [];
  const providerSnapshots = [];
  const exclusions = [];
  const warnings = [];

  for (const announcement of detail.announcements) {
    if (!TARGET_CATEGORIES.has(announcement.category)) continue;
    const sourceAnnouncementType = announcement.category === "performance_forecast_revision" ? "earnings_preview_revision" : "earnings_preview";
    const periodScope = periodScopeFor(announcement.reportPeriod);
    const target = {
      sourceAnnouncementId: String(announcement.announcementId),
      stockId: detail.stockId,
      sourceAnnouncementType,
      sourceDate: announcement.announcementDate ?? null,
      reportPeriod: announcement.reportPeriod ?? null,
      periodScope,
      parseStatus: announcement.parseStatus ?? "unknown",
      isDuplicate: Boolean(announcement.isDuplicate || announcement.duplicateOf),
    };
    targetAnnouncements.push(target);

    const baseReasons = [];
    if (!announcement.reportPeriod) baseReasons.push("report_period_missing");
    if (announcement.reportPeriod && !periodScope) baseReasons.push("period_scope_unclear");
    if (!announcement.announcementDate) baseReasons.push("source_date_missing");
    if (!announcement.officialUrl || !announcement.pdfUrl) baseReasons.push("official_source_missing");
    if (announcement.isCancelled) baseReasons.push("cancelled_announcement");
    if (announcement.isDuplicate || announcement.duplicateOf) baseReasons.push("duplicate_announcement");
    if (["metadata_only", "parse_unavailable"].includes(announcement.parseStatus)) baseReasons.push("parsed_fields_unavailable");

    const events = Array.isArray(announcement.performanceForecastEvents) ? announcement.performanceForecastEvents : [];
    if (!events.length) {
      exclusions.push(exclusionRecord(detail, announcement, sourceAnnouncementType, [
        ...baseReasons,
        sourceAnnouncementType === "earnings_preview_revision" ? "no_reliable_revised_range" : "no_reliable_forecast_range",
        `parse_status_${announcement.parseStatus ?? "unknown"}`,
      ]));
      if (sourceAnnouncementType === "earnings_preview_revision") {
        warnings.push({
          code: "revision_without_reliable_range",
          sourceAnnouncementId: String(announcement.announcementId),
          candidateAnnouncementIds: uniqueStrings([announcement.correctedAnnouncementId]),
          message: "修正公告身份已保留，但没有可靠新区间，未生成方向性修订快照。",
        });
      }
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
      if (reasons.length) {
        exclusions.push(exclusionRecord(detail, announcement, sourceAnnouncementType, reasons, event.profitMetric ?? null));
        continue;
      }
      const lowerBound = normalizeCny(event.lowerBound);
      const upperBound = normalizeCny(event.upperBound);
      const stableFields = {
        announcementId: String(announcement.announcementId),
        stockId: detail.stockId,
        reportPeriod: announcement.reportPeriod,
        periodScope,
        metric,
      };
      const evidence = {
        ...stableFields,
        sourceDate: announcement.announcementDate,
        officialUrl: announcement.officialUrl,
        pdfUrl: announcement.pdfUrl,
        lowerBound,
        upperBound,
        sourceTextEvidence: event.sourceTextEvidence,
      };
      const artifactChecksum = stableSourceArtifactChecksum(evidence);
      providerSnapshots.push({
        providerId: COMPANY_GUIDANCE_PROVIDER_ID,
        providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
        snapshot: {
          id: stableProviderSnapshotId(stableFields),
          stockId: detail.stockId,
          market: "A股",
          reportPeriod: announcement.reportPeriod,
          periodScope,
          metric,
          estimateShape: "range",
          value: null,
          lowerBound,
          upperBound,
          currency: "CNY",
          unit: "yuan",
          accountingBasis: "PRC_GAAP",
          sourceCategory: "company_guidance",
          sourceName: detail.companyName,
          sourceTitle: announcement.title,
          sourceUrl: announcement.officialUrl,
          sourcePublishedAt: announcement.announcementDate,
          sourcePublishedAtPrecision: "date",
          sourcePublishedAtResolution: "date",
          sourcePublishedAtTimeZone: null,
          sourcePublishedAtCalendarDate: announcement.announcementDate,
          asOfDate: announcement.announcementDate,
          formedAt: null,
          formedAtPrecision: "date",
          formedAtResolution: "date",
          formedAtTimeZone: null,
          formedAtCalendarDate: announcement.announcementDate,
          formationTimeBasis: "public_disclosure_proxy",
          providerId: COMPANY_GUIDANCE_PROVIDER_ID,
          providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
          providerGeneratedAt: sourceGeneratedAt,
          sourceAnnouncementId: String(announcement.announcementId),
          sourceAnnouncementType,
          officialPdfUrl: announcement.pdfUrl,
          artifactChecksum,
          analystCount: null,
          institutionCount: null,
          ingestionMethod: "provider",
          createdAt: sourceGeneratedAt,
          createdBy: COMPANY_GUIDANCE_PROVIDER_ID,
          sourceVerificationStatus: "verified",
          notes: COMPANY_GUIDANCE_TIME_NOTE,
          correctsSnapshotId: null,
          correctionScope: null,
          schemaVersion: 2,
        },
        sourceAnnouncementId: String(announcement.announcementId),
        sourceAnnouncementType,
        officialSourceUrl: announcement.officialUrl,
        officialPdfUrl: announcement.pdfUrl,
        sourceDate: announcement.announcementDate,
        generatedAt: sourceGeneratedAt,
        artifactChecksum,
        sourceParseStatus: announcement.parseStatus,
        sourceExtractionConfidence: event.extractionConfidence,
        sourceTextEvidence: event.sourceTextEvidence,
        originalUnitEvidence: extractUnitEvidence(event.sourceTextEvidence),
        correctionCandidateAnnouncementIds: uniqueStrings([announcement.correctedAnnouncementId, event.previousForecastAnnouncementId]),
        structuredWarnings: [],
      });
    }
  }

  const targetCount = targetAnnouncements.length;
  const status = providerSnapshots.length ? (exclusions.length ? "partial" : "generated_real") : targetCount ? "partial" : "missing";
  return {
    schemaVersion: COMPANY_GUIDANCE_SCHEMA_VERSION,
    providerId: COMPANY_GUIDANCE_PROVIDER_ID,
    providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    generatedAt: sourceGeneratedAt,
    stockId: detail.stockId,
    stockCode: detail.stockCode,
    companyName: detail.companyName,
    market: "A股",
    status,
    totalAnnouncementCount: detail.announcements.length,
    targetAnnouncements,
    providerSnapshots,
    exclusions,
    warnings,
    quality: {
      source: "CNInfo",
      sourceLayer: "company_guidance_expectations",
      sourceUrl: "https://www.cninfo.com.cn/new/hisAnnouncement/query",
      updatedAt: sourceGeneratedAt,
      status,
    },
  };
}

function attachRevisionChains(allRecords, companies) {
  const byGroup = new Map();
  for (const record of allRecords) {
    const key = [record.snapshot.stockId, record.snapshot.reportPeriod, record.snapshot.periodScope, record.snapshot.metric].join("|");
    const values = byGroup.get(key) ?? [];
    values.push(record);
    byGroup.set(key, values);
  }
  for (const values of byGroup.values()) {
    values.sort((left, right) => left.sourceDate.localeCompare(right.sourceDate) || left.sourceAnnouncementId.localeCompare(right.sourceAnnouncementId));
    for (const record of values.filter((item) => item.sourceAnnouncementType === "earnings_preview_revision")) {
      const earlier = values.filter((item) => item.sourceDate < record.sourceDate);
      const explicitIds = new Set(record.correctionCandidateAnnouncementIds);
      let candidates = explicitIds.size ? earlier.filter((item) => explicitIds.has(item.sourceAnnouncementId)) : [];
      if (!candidates.length && !explicitIds.size && earlier.length) {
        const latestDate = earlier.map((item) => item.sourceDate).sort().at(-1);
        candidates = earlier.filter((item) => item.sourceDate === latestDate);
      }
      if (candidates.length === 1) {
        record.snapshot.correctsSnapshotId = candidates[0].snapshot.id;
        record.snapshot.correctionScope = "value";
      } else {
        record.structuredWarnings.push(candidates.length ? "revision_predecessor_ambiguous" : "revision_predecessor_missing");
        record.correctionCandidateAnnouncementIds = uniqueStrings([...record.correctionCandidateAnnouncementIds, ...candidates.map((item) => item.sourceAnnouncementId)]);
        const company = companies.find((item) => item.stockId === record.snapshot.stockId);
        company?.warnings.push({
          code: candidates.length ? "revision_predecessor_ambiguous" : "revision_predecessor_missing",
          sourceAnnouncementId: record.sourceAnnouncementId,
          candidateAnnouncementIds: record.correctionCandidateAnnouncementIds,
          message: "无法唯一确认前一条公司指引，未建立猜测性 correctsSnapshotId。",
        });
      }
    }
  }
}

function exclusionRecord(detail, announcement, sourceAnnouncementType, reasons, metric = null) {
  return {
    stockId: detail.stockId,
    companyName: detail.companyName,
    sourceAnnouncementId: String(announcement.announcementId),
    sourceAnnouncementType,
    sourceTitle: announcement.title,
    sourceDate: announcement.announcementDate ?? null,
    reportPeriod: announcement.reportPeriod ?? null,
    periodScope: periodScopeFor(announcement.reportPeriod),
    metric,
    parseStatus: announcement.parseStatus ?? "unknown",
    officialSourceUrl: announcement.officialUrl ?? null,
    candidateAnnouncementIds: uniqueStrings([announcement.correctedAnnouncementId]),
    reasons: [...new Set(reasons)].sort(),
  };
}

function extractUnitEvidence(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/(?:人民币)?(?:元|万元|百万元|亿元)/u);
  return match?.[0] ?? null;
}

function normalizeCny(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return Math.abs(value - rounded) < 0.01 ? rounded : Number(value.toFixed(2));
}

function countBy(values, keyFn) {
  return Object.fromEntries([...new Set(values.map(keyFn))].sort().map((key) => [key, values.filter((value) => keyFn(value) === key).length]));
}

function countNested(values, keyFn) {
  const keys = [...new Set(values.flatMap(keyFn))].sort();
  return Object.fromEntries(keys.map((key) => [key, values.filter((value) => keyFn(value).includes(key)).length]));
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map(String))].sort();
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isPreciseInstant(value) {
  return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value));
}
