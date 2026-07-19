import { isStrictCalendarDate, isStrictPreciseInstant } from "../utils/strictDateTime.mjs";

const SCHEMA_VERSION = "2.0.0";
const PROVIDER_ID = "cninfo-company-guidance";
const PROVIDER_VERSION = "2.0.0";
const QUALITY_SOURCE_URL = "https://www.cninfo.com.cn/new/hisAnnouncement/query";
const DETAIL_BASE_PATH = "data/a-share-company-guidance-expectations";
const SAFE_STOCK_ID = /^[A-Za-z0-9_-]+$/u;
const ANNOUNCEMENT_ID = /^\d+$/u;
const SOURCE_TYPES = new Set(["earnings_preview", "earnings_preview_revision"]);
const PARSE_STATUSES = new Set(["parse_success", "parse_partial", "metadata_only", "parse_unavailable"]);
const PERIOD_SCOPES = new Set(["single_quarter", "half_year", "first_three_quarters", "full_year"]);
const WARNING_CODES = new Set(["revision_without_reliable_range", "revision_predecessor_ambiguous", "revision_predecessor_missing"]);
const EXCLUSION_REASONS = new Set([
  "report_period_missing", "period_scope_unclear", "source_date_missing", "official_source_invalid", "cancelled_announcement",
  "duplicate_announcement", "parsed_fields_unavailable", "no_reliable_revised_range", "no_reliable_forecast_range",
  "unsupported_metric", "forecast_period_mismatch", "range_incomplete", "range_order_invalid", "field_confidence_not_high",
  ...[...PARSE_STATUSES].map((status) => `parse_status_${status}`),
]);
const STATUS_VALUES = new Set(["generated_real", "partial", "missing"]);
const SCHEMA_ERROR_CODES = new Set([
  "detail_contract", "detail_target_contract", "detail_exclusion_contract", "detail_warning_contract", "detail_snapshot_contract",
  "detail_target_duplicate", "detail_generation_epoch", "detail_quality_contract",
]);

export function selectDefaultCompanyGuidanceStockIds(items) {
  return Object.values(items).filter((item) => item.snapshotCount > 0 || item.excludedAnnouncementCount > 0).map((item) => item.stockId);
}

export function deriveCompanyGuidanceDetailStatus(detail) {
  const result = analyzeCompanyGuidanceDetailRelations(detail);
  if (result.errors.length || !result.status) throw new TypeError(`invalid company-guidance detail relations: ${result.errors.join("; ")}`);
  return result.status;
}

export function analyzeCompanyGuidanceDetailRelations(detail) {
  const errors = [];
  const targets = requiredRelationArray(detail, "targetAnnouncements", "detail_target_contract", errors);
  const exclusions = requiredRelationArray(detail, "exclusions", "detail_exclusion_contract", errors);
  const current = requiredRelationArray(detail, "providerSnapshots", "detail_snapshot_contract", errors);
  const historical = requiredRelationArray(detail, "historicalProviderVersions", "detail_snapshot_contract", errors);
  const warnings = requiredRelationArray(detail, "warnings", "detail_warning_contract", errors);
  const targetById = new Map();

  for (const target of targets) {
    if (!isValidTarget(target)) add(errors, "detail_target_contract");
    const id = validAnnouncementId(target?.sourceAnnouncementId) ? target.sourceAnnouncementId : null;
    if (id) {
      if (targetById.has(id)) add(errors, "detail_target_duplicate");
      else targetById.set(id, target);
    }
    if (isObject(target) && target.stockId !== detail?.stockId) add(errors, "detail_projection_mismatch");
  }

  const exclusionCoverage = new Set();
  for (const exclusion of exclusions) {
    if (!isValidExclusion(exclusion)) add(errors, "detail_exclusion_contract");
    const target = targetById.get(exclusion?.sourceAnnouncementId);
    if (!target) add(errors, "detail_exclusion_orphan");
    else {
      exclusionCoverage.add(exclusion.sourceAnnouncementId);
      if (exclusion.stockId !== detail?.stockId || exclusion.companyName !== detail?.companyName || !sameTargetProjection(exclusion, target)) add(errors, "detail_projection_mismatch");
    }
  }

  const currentCoverage = validateSnapshotRelations(current, true, detail, targetById, errors);
  const historicalCoverage = validateSnapshotRelations(historical, false, detail, targetById, errors);

  for (const warning of warnings) {
    if (!isValidWarning(warning)) add(errors, "detail_warning_contract");
    if (!targetById.has(warning?.sourceAnnouncementId)) add(errors, "detail_warning_contract");
  }

  for (const [id, target] of targetById) {
    const hasCurrent = currentCoverage.has(id);
    const hasHistorical = historicalCoverage.has(id);
    const hasExclusion = exclusionCoverage.has(id);
    if (!hasCurrent && !hasHistorical && !hasExclusion) add(errors, "detail_target_uncovered");
    if (hasHistorical && !hasCurrent && !hasExclusion) add(errors, "detail_historical_only");
    if (targetNeedsExclusion(target) && !hasExclusion) add(errors, "detail_target_uncovered");
  }

  if (errors.length) return { errors, status: null };
  if (targets.length === 0) return { errors, status: "missing" };
  if (exclusions.length > 0 || targets.some((target) => target.parseStatus !== "parse_success")) return { errors, status: "partial" };
  if (targets.every((target) => currentCoverage.has(target.sourceAnnouncementId))) return { errors, status: "generated_real" };
  return { errors: ["detail_target_uncovered"], status: null };
}

export function validateCompanyGuidanceDetailContract(detail, { expectedGenerationEpoch = null } = {}) {
  const errors = [];
  if (!isObject(detail) || detail.schemaVersion !== SCHEMA_VERSION || detail.providerId !== PROVIDER_ID || detail.providerVersion !== PROVIDER_VERSION
    || !nonEmptyString(detail.stockId) || !SAFE_STOCK_ID.test(detail.stockId) || !nonEmptyString(detail.stockCode) || !nonEmptyString(detail.companyName)
    || detail.market !== "A股" || !Number.isInteger(detail.totalAnnouncementCount) || detail.totalAnnouncementCount < 0) add(errors, "detail_contract");

  const relation = analyzeCompanyGuidanceDetailRelations(detail);
  relation.errors.forEach((error) => add(errors, error));
  if (Array.isArray(detail?.targetAnnouncements) && Number.isInteger(detail?.totalAnnouncementCount) && detail.targetAnnouncements.length > detail.totalAnnouncementCount) add(errors, "detail_target_contract");

  if (!isStrictPreciseInstant(detail?.generatedAt) || (expectedGenerationEpoch !== null && detail.generatedAt !== expectedGenerationEpoch)) add(errors, "detail_generation_epoch");
  validateRecordEpochs(detail?.providerSnapshots, detail?.generatedAt, true, errors);
  validateRecordEpochs(detail?.historicalProviderVersions, detail?.generatedAt, false, errors);

  if (!isObject(detail?.quality) || detail.quality.source !== "CNInfo" || detail.quality.sourceLayer !== "company_guidance_expectations"
    || detail.quality.sourceUrl !== QUALITY_SOURCE_URL || !isStrictPreciseInstant(detail.quality.updatedAt) || detail.quality.updatedAt !== detail.generatedAt
    || (expectedGenerationEpoch !== null && detail.quality.updatedAt !== expectedGenerationEpoch)) add(errors, "detail_quality_contract");
  if (relation.status && detail?.status !== relation.status) add(errors, "detail_status");
  if (relation.status && isObject(detail?.quality) && detail.quality.status !== relation.status) add(errors, "detail_quality_status");
  return errors;
}

export function deriveCompanyGuidanceManifestMetadata(detail) {
  const relation = analyzeCompanyGuidanceDetailRelations(detail);
  if (relation.errors.length || !relation.status) throw new TypeError(`invalid company-guidance detail relations: ${relation.errors.join("; ")}`);
  if (!nonEmptyString(detail?.stockId) || !SAFE_STOCK_ID.test(detail.stockId)) throw new TypeError("invalid company-guidance detail stockId");
  return {
    stockId: detail.stockId,
    stockCode: detail.stockCode,
    companyName: detail.companyName,
    relativePath: `${DETAIL_BASE_PATH}/${detail.stockId}.json`,
    snapshotCount: detail.providerSnapshots.length,
    historicalVersionCount: detail.historicalProviderVersions.length,
    excludedAnnouncementCount: new Set(detail.exclusions.map((record) => record.sourceAnnouncementId)).size,
    latestReportPeriod: latestCalendarDate(detail.providerSnapshots.map((record) => record.snapshot.reportPeriod)),
    latestSourceDate: latestCalendarDate(detail.providerSnapshots.map((record) => record.sourceDate)),
    status: relation.status,
  };
}

export function deriveCompanyGuidanceSummaryStatusFromStatuses(statuses) {
  if (!Array.isArray(statuses) || statuses.some((status) => !STATUS_VALUES.has(status))) throw new TypeError("invalid company-guidance company statuses");
  if (statuses.includes("partial")) return "partial";
  if (statuses.includes("generated_real")) return "generated_real";
  return "missing";
}

export function classifyCompanyGuidanceDetailContractErrors(errors) {
  return errors.some((error) => SCHEMA_ERROR_CODES.has(error)) ? "schema" : "identity";
}

function validateSnapshotRelations(records, current, detail, targetById, errors) {
  const coverage = new Set();
  for (const record of records) {
    if (!isValidSnapshotRelationRecord(record)) { add(errors, "detail_snapshot_contract"); continue; }
    const target = targetById.get(record.sourceAnnouncementId);
    if (!target) { add(errors, "detail_snapshot_orphan"); continue; }
    coverage.add(record.sourceAnnouncementId);
    if (record.isCurrentVersion !== current || record.snapshot.isCurrentProviderVersion !== current || record.snapshot.stockId !== detail?.stockId
      || !sameTargetProjection(record, target) || record.snapshot.sourceAnnouncementId !== target.sourceAnnouncementId
      || record.snapshot.sourceAnnouncementType !== target.sourceAnnouncementType || record.snapshot.reportPeriod !== target.reportPeriod
      || record.snapshot.periodScope !== target.periodScope || record.sourceParseStatus !== target.parseStatus) add(errors, "detail_projection_mismatch");
  }
  return coverage;
}

function validateRecordEpochs(records, detailEpoch, current, errors) {
  if (!Array.isArray(records)) return;
  for (const record of records) {
    if (!isObject(record) || !isObject(record.snapshot)) continue;
    const validBase = isStrictPreciseInstant(record.generatedAt) && isStrictPreciseInstant(record.snapshot.createdAt)
      && isStrictPreciseInstant(record.snapshot.providerGeneratedAt) && record.snapshot.providerGeneratedAt === record.generatedAt;
    if (!validBase || (current && record.generatedAt !== detailEpoch)) add(errors, "detail_generation_epoch");
  }
}

function isValidTarget(target) {
  return isObject(target) && validAnnouncementId(target.sourceAnnouncementId) && nonEmptyString(target.stockId)
    && SOURCE_TYPES.has(target.sourceAnnouncementType) && nullableCalendarDate(target.sourceDate) && nullableCalendarDate(target.reportPeriod)
    && validPeriodProjection(target.reportPeriod, target.periodScope) && PARSE_STATUSES.has(target.parseStatus) && typeof target.isDuplicate === "boolean";
}

function isValidExclusion(exclusion) {
  return isObject(exclusion) && nonEmptyString(exclusion.stockId) && nonEmptyString(exclusion.companyName) && validAnnouncementId(exclusion.sourceAnnouncementId)
    && SOURCE_TYPES.has(exclusion.sourceAnnouncementType) && nonEmptyString(exclusion.sourceTitle) && nullableCalendarDate(exclusion.sourceDate)
    && nullableCalendarDate(exclusion.reportPeriod) && validPeriodProjection(exclusion.reportPeriod, exclusion.periodScope)
    && (exclusion.metric === null || nonEmptyString(exclusion.metric)) && PARSE_STATUSES.has(exclusion.parseStatus)
    && (exclusion.officialSourceUrl === null || nonEmptyString(exclusion.officialSourceUrl))
    && uniqueStringArray(exclusion.candidateAnnouncementIds, true) && uniqueStringArray(exclusion.reasons, false)
    && exclusion.reasons.length > 0 && exclusion.reasons.every((reason) => EXCLUSION_REASONS.has(reason));
}

function isValidWarning(warning) {
  return isObject(warning) && WARNING_CODES.has(warning.code) && validAnnouncementId(warning.sourceAnnouncementId)
    && uniqueStringArray(warning.candidateAnnouncementIds, true) && nonEmptyString(warning.message);
}

function isValidSnapshotRelationRecord(record) {
  return isObject(record) && isObject(record.snapshot) && validAnnouncementId(record.sourceAnnouncementId)
    && SOURCE_TYPES.has(record.sourceAnnouncementType) && isStrictCalendarDate(record.sourceDate) && nonEmptyString(record.snapshot.stockId)
    && isStrictCalendarDate(record.snapshot.reportPeriod) && PERIOD_SCOPES.has(record.snapshot.periodScope)
    && validAnnouncementId(record.snapshot.sourceAnnouncementId) && SOURCE_TYPES.has(record.snapshot.sourceAnnouncementType)
    && PARSE_STATUSES.has(record.sourceParseStatus) && typeof record.isCurrentVersion === "boolean" && typeof record.snapshot.isCurrentProviderVersion === "boolean";
}

function sameTargetProjection(record, target) {
  const reportPeriod = Object.hasOwn(record, "reportPeriod") ? record.reportPeriod : record.snapshot?.reportPeriod;
  const periodScope = Object.hasOwn(record, "periodScope") ? record.periodScope : record.snapshot?.periodScope;
  const parseStatus = Object.hasOwn(record, "parseStatus") ? record.parseStatus : record.sourceParseStatus;
  return record.sourceAnnouncementType === target.sourceAnnouncementType && record.sourceDate === target.sourceDate
    && reportPeriod === target.reportPeriod && periodScope === target.periodScope && parseStatus === target.parseStatus;
}

function targetNeedsExclusion(target) {
  return target.isDuplicate || ["metadata_only", "parse_unavailable"].includes(target.parseStatus) || target.sourceDate === null || target.reportPeriod === null || target.periodScope === null;
}

function requiredRelationArray(detail, field, errorCode, errors) {
  if (!isObject(detail) || !Array.isArray(detail[field])) { add(errors, errorCode); return []; }
  return detail[field];
}

function validPeriodProjection(reportPeriod, periodScope) {
  if (reportPeriod === null) return periodScope === null;
  if (!isStrictCalendarDate(reportPeriod)) return false;
  return periodScopeFor(reportPeriod) === periodScope;
}

function periodScopeFor(reportPeriod) {
  if (reportPeriod.endsWith("-03-31")) return "single_quarter";
  if (reportPeriod.endsWith("-06-30")) return "half_year";
  if (reportPeriod.endsWith("-09-30")) return "first_three_quarters";
  if (reportPeriod.endsWith("-12-31")) return "full_year";
  return null;
}

function nullableCalendarDate(value) { return value === null || isStrictCalendarDate(value); }
function validAnnouncementId(value) { return typeof value === "string" && ANNOUNCEMENT_ID.test(value); }
function nonEmptyString(value) { return typeof value === "string" && value.trim().length > 0; }
function uniqueStringArray(value, announcementIds) { return Array.isArray(value) && value.every((item) => nonEmptyString(item) && (!announcementIds || validAnnouncementId(item))) && new Set(value).size === value.length; }
function isObject(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function latestCalendarDate(values) { return values.filter(isStrictCalendarDate).sort().at(-1) ?? null; }
function add(errors, error) { if (!errors.includes(error)) errors.push(error); }
