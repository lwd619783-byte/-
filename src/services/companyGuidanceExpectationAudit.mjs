import { isStrictCalendarDate } from "../utils/strictDateTime.mjs";

export const COMPANY_GUIDANCE_SOURCE_ARTIFACT = "CNInfo A-share announcement Provider V1 committed artifacts";
export const COMPANY_GUIDANCE_AUDIT_FIELDS = Object.freeze([
  "totalAnnouncementCount", "companyCount", "targetCompanyCount", "previewAnnouncementCount", "revisionAnnouncementCount",
  "targetAnnouncementCount", "targetWithReportPeriodCount", "targetWithRecognizedPeriodScopeCount", "parseStatusCounts",
  "reliableAnnouncementCount", "reliableSnapshotCount", "reliableCompanyCount", "historicalVersionCount", "metricCounts",
  "periodScopeCounts", "excludedTargetAnnouncementCount", "exclusionCount", "exclusionReasonCounts", "earliestSourceDate",
  "latestSourceDate", "duplicateAnnouncementCount", "linkedRevisionSnapshotCount", "unresolvedRevisionAnnouncementCount",
]);

const PARSE_STATUSES = new Set(["parse_success", "parse_partial", "metadata_only", "parse_unavailable"]);
const METRICS = new Set(["attributable_net_profit", "adjusted_net_profit", "revenue"]);
const PERIOD_SCOPES = new Set(["single_quarter", "half_year", "first_three_quarters", "full_year"]);
const EXCLUSION_REASONS = new Set([
  "report_period_missing", "period_scope_unclear", "source_date_missing", "official_source_invalid", "cancelled_announcement",
  "duplicate_announcement", "parsed_fields_unavailable", "no_reliable_revised_range", "no_reliable_forecast_range",
  "unsupported_metric", "forecast_period_mismatch", "range_incomplete", "range_order_invalid", "field_confidence_not_high",
  "source_text_evidence_missing", "original_unit_evidence_missing",
  ...[...PARSE_STATUSES].map((status) => `parse_status_${status}`),
]);

export function deriveCompanyGuidanceSummaryAudit(details) {
  if (!Array.isArray(details)) throw new TypeError("company-guidance details must be an array");
  const targets = details.flatMap((detail) => requiredArray(detail, "targetAnnouncements"));
  const current = details.flatMap((detail) => requiredArray(detail, "providerSnapshots"));
  const exclusions = details.flatMap((detail) => requiredArray(detail, "exclusions"));
  const targetDates = targets.map((record) => record.sourceDate).filter(isStrictCalendarDate).sort();
  return {
    totalAnnouncementCount: details.reduce((sum, detail) => sum + detail.totalAnnouncementCount, 0),
    companyCount: details.length,
    targetCompanyCount: new Set(targets.map((record) => record.stockId)).size,
    previewAnnouncementCount: targets.filter((record) => record.sourceAnnouncementType === "earnings_preview").length,
    revisionAnnouncementCount: targets.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision").length,
    targetAnnouncementCount: targets.length,
    targetWithReportPeriodCount: targets.filter((record) => record.reportPeriod).length,
    targetWithRecognizedPeriodScopeCount: targets.filter((record) => record.periodScope).length,
    parseStatusCounts: countBy(targets, (record) => record.parseStatus),
    reliableAnnouncementCount: new Set(current.map((record) => record.sourceAnnouncementId)).size,
    reliableSnapshotCount: current.length,
    reliableCompanyCount: new Set(current.map((record) => record.snapshot.stockId)).size,
    historicalVersionCount: details.reduce((sum, detail) => sum + requiredArray(detail, "historicalProviderVersions").length, 0),
    metricCounts: countBy(current, (record) => record.snapshot.metric),
    periodScopeCounts: countBy(current, (record) => record.snapshot.periodScope),
    excludedTargetAnnouncementCount: new Set(exclusions.map((record) => record.sourceAnnouncementId)).size,
    exclusionCount: exclusions.length,
    exclusionReasonCounts: countNested(exclusions, (record) => record.reasons),
    earliestSourceDate: targetDates[0] ?? null,
    latestSourceDate: targetDates.at(-1) ?? null,
    duplicateAnnouncementCount: targets.filter((record) => record.isDuplicate).length,
    linkedRevisionSnapshotCount: current.filter((record) => record.sourceAnnouncementType === "earnings_preview_revision" && record.providerBusinessRevisionPredecessorSnapshotId).length,
    unresolvedRevisionAnnouncementCount: targets.filter((target) => target.sourceAnnouncementType === "earnings_preview_revision")
      .filter((target) => !current.some((record) => record.sourceAnnouncementId === target.sourceAnnouncementId && record.providerBusinessRevisionPredecessorSnapshotId)).length,
  };
}

export function validateCompanyGuidanceSummaryAudit(audit) {
  const errors = [];
  if (!isObject(audit) || canonicalJson(Object.keys(audit).sort()) !== canonicalJson([...COMPANY_GUIDANCE_AUDIT_FIELDS].sort())) return ["summary_audit_contract"];
  const scalarFields = COMPANY_GUIDANCE_AUDIT_FIELDS.filter((field) => !["parseStatusCounts", "metricCounts", "periodScopeCounts", "exclusionReasonCounts", "earliestSourceDate", "latestSourceDate"].includes(field));
  if (scalarFields.some((field) => !nonNegativeInteger(audit[field]))
    || !validCountMap(audit.parseStatusCounts, PARSE_STATUSES) || !validCountMap(audit.metricCounts, METRICS)
    || !validCountMap(audit.periodScopeCounts, PERIOD_SCOPES) || !validCountMap(audit.exclusionReasonCounts, EXCLUSION_REASONS)
    || !nullableDate(audit.earliestSourceDate) || !nullableDate(audit.latestSourceDate)
    || (audit.earliestSourceDate !== null && audit.latestSourceDate !== null && audit.earliestSourceDate > audit.latestSourceDate)
    || audit.previewAnnouncementCount + audit.revisionAnnouncementCount !== audit.targetAnnouncementCount
    || sumMap(audit.parseStatusCounts) !== audit.targetAnnouncementCount
    || sumMap(audit.metricCounts) !== audit.reliableSnapshotCount || sumMap(audit.periodScopeCounts) !== audit.reliableSnapshotCount
    || audit.targetCompanyCount > audit.companyCount || audit.reliableCompanyCount > audit.targetCompanyCount
    || audit.reliableAnnouncementCount > audit.targetAnnouncementCount || audit.excludedTargetAnnouncementCount > audit.targetAnnouncementCount
    || audit.targetWithRecognizedPeriodScopeCount > audit.targetWithReportPeriodCount || audit.targetWithReportPeriodCount > audit.targetAnnouncementCount
    || audit.linkedRevisionSnapshotCount > audit.reliableSnapshotCount || audit.unresolvedRevisionAnnouncementCount > audit.revisionAnnouncementCount) errors.push("summary_audit_contract");
  return errors;
}

export function validateCompanyGuidanceSummaryAuditManifestProjection(audit, manifest) {
  const errors = validateCompanyGuidanceSummaryAudit(audit);
  if (!isObject(manifest) || audit?.companyCount !== manifest.totalCompanies || audit?.reliableSnapshotCount !== manifest.totalSnapshots
    || audit?.reliableCompanyCount !== manifest.companiesWithSnapshots || audit?.historicalVersionCount !== manifest.totalHistoricalVersions) errors.push("summary_audit_manifest_projection");
  return [...new Set(errors)];
}

function requiredArray(detail, field) { if (!isObject(detail) || !Array.isArray(detail[field])) throw new TypeError(`company-guidance detail ${field} must be an array`); return detail[field]; }
function countBy(values, keyFn) { const keys = [...new Set(values.map(keyFn))].sort(); return Object.fromEntries(keys.map((key) => [key, values.filter((value) => keyFn(value) === key).length])); }
function countNested(values, keyFn) { const keys = [...new Set(values.flatMap(keyFn))].sort(); return Object.fromEntries(keys.map((key) => [key, values.filter((value) => keyFn(value).includes(key)).length])); }
function validCountMap(value, allowedKeys) { return isObject(value) && Object.entries(value).every(([key, count]) => allowedKeys.has(key) && nonNegativeInteger(count)); }
function sumMap(value) { return Object.values(value ?? {}).reduce((sum, count) => sum + count, 0); }
function nonNegativeInteger(value) { return Number.isInteger(value) && value >= 0; }
function nullableDate(value) { return value === null || isStrictCalendarDate(value); }
function isObject(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value); }
