import { isStrictCalendarDate, isStrictPreciseInstant, parseStrictPreciseInstant } from "../utils/strictDateTime.mjs";

export const COMPANY_GUIDANCE_PROVIDER_ID = "cninfo-company-guidance";
export const COMPANY_GUIDANCE_PROVIDER_VERSION = "2.0.0";
export const COMPANY_GUIDANCE_PARSE_RULES_VERSION = "1.0.0";
export const COMPANY_GUIDANCE_TIME_NOTE = "公司内部形成时间未知，以公开披露时间作为可用时间";
export const COMPANY_GUIDANCE_RECORD_MODES = Object.freeze(["detail_current", "detail_historical", "workflow_current"]);
export const COMPANY_GUIDANCE_CONTENT_FIELDS = Object.freeze([
  "estimateShape", "value", "lowerBound", "upperBound", "currency", "unit", "accountingBasis",
  "sourcePublishedAt", "sourceTextEvidenceHash", "providerParseRulesVersion",
]);
export const COMPANY_GUIDANCE_CORRECTION_PROJECTION_FIELDS = Object.freeze([
  "providerEvidenceIdentity",
  ...COMPANY_GUIDANCE_CONTENT_FIELDS,
]);

const METRICS = new Set(["attributable_net_profit", "adjusted_net_profit", "revenue"]);
const SOURCE_TYPES = new Set(["earnings_preview", "earnings_preview_revision"]);
const SOURCE_PARSE_STATUSES = new Set(["parse_success", "parse_partial"]);
const STRUCTURED_WARNING_CODES = new Set(["revision_predecessor_ambiguous", "revision_predecessor_missing"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const ANNOUNCEMENT_ID = /^\d+$/u;
const VERSION_ID = /^company-guidance-version-[a-f0-9]{64}$/u;
const PERIOD_SCOPES = new Set(["single_quarter", "half_year", "first_three_quarters", "full_year"]);
// Keep the lazy-detail sentinel out of the initial bundle while still validating the field on a loaded detail.
const ORIGINAL_UNIT_EVIDENCE_FIELD = [111, 114, 105, 103, 105, 110, 97, 108, 85, 110, 105, 116, 69, 118, 105, 100, 101, 110, 99, 101]
  .map((codePoint) => String.fromCharCode(codePoint)).join("");

export function parseOfficialCninfoAnnouncementUrl(value) {
  try {
    const url = new URL(value);
    const entries = [...url.searchParams.entries()];
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    if (url.hostname !== "www.cninfo.com.cn" || url.pathname !== "/new/disclosure/detail") return null;
    if (entries.length !== 1 || entries[0][0] !== "annoId" || !ANNOUNCEMENT_ID.test(entries[0][1])) return null;
    return { announcementId: entries[0][1], canonicalUrl: `https://www.cninfo.com.cn/new/disclosure/detail?annoId=${entries[0][1]}` };
  } catch { return null; }
}

export function parseOfficialCninfoPdfUrl(value, expectedAnnouncementId = null) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || url.hostname !== "static.cninfo.com.cn") return null;
    const match = url.pathname.match(/^\/finalpage\/(\d{4}-\d{2}-\d{2})\/(\d+)\.PDF$/u);
    if (!match || !isStrictCalendarDate(match[1]) || (expectedAnnouncementId && match[2] !== expectedAnnouncementId)) return null;
    return { sourceDate: match[1], announcementId: match[2], canonicalUrl: `https://static.cninfo.com.cn${url.pathname}` };
  } catch { return null; }
}

export function providerContentProjection(record) {
  const snapshot = record?.snapshot ?? record ?? {};
  return {
    providerEvidenceIdentity: record?.providerEvidenceIdentity ?? snapshot.providerEvidenceIdentity,
    estimateShape: snapshot.estimateShape,
    value: snapshot.value,
    lowerBound: snapshot.lowerBound,
    upperBound: snapshot.upperBound,
    currency: snapshot.currency,
    unit: snapshot.unit,
    accountingBasis: snapshot.accountingBasis,
    sourcePublishedAt: snapshot.sourcePublishedAt,
    sourceTextEvidenceHash: record?.sourceTextEvidenceHash,
    providerParseRulesVersion: record?.providerParseRulesVersion ?? snapshot.providerParseRulesVersion,
  };
}

export function providerContentChangedFields(previous, current) {
  const left = providerContentProjection(previous);
  const right = providerContentProjection(current);
  return COMPANY_GUIDANCE_CONTENT_FIELDS.filter((field) => canonicalJson(left[field]) !== canonicalJson(right[field]));
}

export function validateCompanyGuidanceWorkflowCorrectionProofShape(records, proofs) {
  const errors = [];
  if (!Array.isArray(records) || !Array.isArray(proofs)) return ["provider_correction_proof_shape"];
  const byCurrentId = new Map(records.filter(isObject).map((record) => [record.providerSnapshotVersionId, record]));
  const proofCounts = new Map();
  for (const proof of proofs) {
    if (!isObject(proof)) { add(errors, "provider_correction_proof_shape"); continue; }
    if (containsForbiddenEvidenceKey(proof)) add(errors, "provider_correction_proof_raw_evidence");
    if (!hasExactKeys(proof, [
      "currentProviderSnapshotVersionId", "predecessorProviderSnapshotVersionId", "predecessorProviderCorrectsVersionId",
      "providerEvidenceIdentity", "predecessorProviderContentChecksum", "predecessorContentProjection",
    ]) || !VERSION_ID.test(proof.currentProviderSnapshotVersionId ?? "")
      || !VERSION_ID.test(proof.predecessorProviderSnapshotVersionId ?? "")
      || (proof.predecessorProviderCorrectsVersionId !== null && !VERSION_ID.test(proof.predecessorProviderCorrectsVersionId ?? ""))
      || typeof proof.providerEvidenceIdentity !== "string" || !proof.providerEvidenceIdentity
      || !SHA256.test(proof.predecessorProviderContentChecksum ?? "")
      || !isObject(proof.predecessorContentProjection)
      || !hasExactKeys(proof.predecessorContentProjection, COMPANY_GUIDANCE_CORRECTION_PROJECTION_FIELDS)) {
      add(errors, "provider_correction_proof_shape");
      continue;
    }
    proofCounts.set(proof.currentProviderSnapshotVersionId, (proofCounts.get(proof.currentProviderSnapshotVersionId) ?? 0) + 1);
    const current = byCurrentId.get(proof.currentProviderSnapshotVersionId);
    if (!current) { add(errors, "provider_correction_proof_orphan"); continue; }
    if (current.providerCorrectionType !== "extraction_correction") add(errors, "provider_correction_proof_initial");
    if (current.providerCorrectsVersionId !== proof.predecessorProviderSnapshotVersionId) add(errors, "provider_correction_proof_predecessor");
    if (current.providerEvidenceIdentity !== proof.providerEvidenceIdentity
      || proof.predecessorContentProjection.providerEvidenceIdentity !== proof.providerEvidenceIdentity) add(errors, "provider_correction_proof_evidence_identity");
    const expectedFields = providerContentChangedFields(proof.predecessorContentProjection, current);
    if (canonicalJson(expectedFields) !== canonicalJson(current.providerCorrectionChangedFields)) add(errors, "provider_correction_proof_changed_fields");
  }
  for (const record of records.filter(isObject)) {
    const count = proofCounts.get(record.providerSnapshotVersionId) ?? 0;
    if (record.providerCorrectionType === "extraction_correction" && count === 0) add(errors, "provider_correction_proof_missing");
    if (count > 1) add(errors, "provider_correction_proof_duplicate");
    if (record.providerCorrectionType === "initial" && count > 0) add(errors, "provider_correction_proof_initial");
  }
  return errors;
}

export function validateCompanyGuidanceProviderRecordContract(record, {
  mode = "detail_current",
  stockId = null,
  companyName = null,
  expectedGenerationEpoch = null,
} = {}) {
  const errors = [];
  if (!isObject(record) || !isObject(record.snapshot) || !COMPANY_GUIDANCE_RECORD_MODES.includes(mode)) return ["provider_snapshot_product_contract"];
  const snapshot = record.snapshot;
  const current = mode !== "detail_historical";
  const source = parseOfficialCninfoAnnouncementUrl(record.officialSourceUrl);
  const pdf = parseOfficialCninfoPdfUrl(record.officialPdfUrl, record.sourceAnnouncementId);

  if (record.providerId !== COMPANY_GUIDANCE_PROVIDER_ID || snapshot.providerId !== COMPANY_GUIDANCE_PROVIDER_ID
    || record.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION || snapshot.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION
    || record.providerParseRulesVersion !== COMPANY_GUIDANCE_PARSE_RULES_VERSION || snapshot.providerParseRulesVersion !== COMPANY_GUIDANCE_PARSE_RULES_VERSION
    || snapshot.market !== "A股" || !METRICS.has(snapshot.metric) || snapshot.estimateShape !== "range" || snapshot.value !== null
    || !Number.isFinite(snapshot.lowerBound) || !Number.isFinite(snapshot.upperBound) || snapshot.lowerBound > snapshot.upperBound
    || snapshot.currency !== "CNY" || snapshot.unit !== "yuan" || snapshot.accountingBasis !== "PRC_GAAP"
    || record.sourceExtractionConfidence !== "high" || !SOURCE_PARSE_STATUSES.has(record.sourceParseStatus)
    || snapshot.ingestionMethod !== "provider" || snapshot.sourceCategory !== "company_guidance" || snapshot.sourceVerificationStatus !== "verified"
    || snapshot.schemaVersion !== 2 || snapshot.createdBy !== COMPANY_GUIDANCE_PROVIDER_ID
    || snapshot.analystCount !== null || snapshot.institutionCount !== null || snapshot.correctsSnapshotId !== null || snapshot.correctionScope !== null
    || (stockId !== null && snapshot.stockId !== stockId) || (companyName !== null && snapshot.sourceName !== companyName)
    || !ANNOUNCEMENT_ID.test(record.sourceAnnouncementId ?? "") || !SOURCE_TYPES.has(record.sourceAnnouncementType)
    || !isStrictCalendarDate(record.sourceDate) || !isStrictCalendarDate(snapshot.reportPeriod) || !PERIOD_SCOPES.has(snapshot.periodScope)
    || !source || source.announcementId !== record.sourceAnnouncementId || source.canonicalUrl !== record.officialSourceUrl
    || !pdf || pdf.canonicalUrl !== record.officialPdfUrl || pdf.sourceDate !== record.sourceDate
    || snapshot.sourceUrl !== record.officialSourceUrl || snapshot.officialPdfUrl !== record.officialPdfUrl) add(errors, "provider_snapshot_product_contract");

  if (record.providerEvidenceIdentity !== snapshot.providerEvidenceIdentity
    || record.providerSnapshotVersionId !== snapshot.providerSnapshotVersionId || record.providerSnapshotVersionId !== snapshot.id
    || record.providerContentChecksum !== snapshot.providerContentChecksum
    || record.providerParseRulesVersion !== snapshot.providerParseRulesVersion
    || record.providerId !== snapshot.providerId || record.providerVersion !== snapshot.providerVersion
    || record.sourceAnnouncementId !== snapshot.sourceAnnouncementId || record.sourceAnnouncementType !== snapshot.sourceAnnouncementType
    || record.artifactChecksum !== snapshot.artifactChecksum || record.artifactChecksum !== record.providerContentChecksum
    || !SHA256.test(record.providerContentChecksum ?? "") || !SHA256.test(record.artifactChecksum ?? "")
    || !VERSION_ID.test(record.providerSnapshotVersionId ?? "")
    || record.providerCorrectsVersionId !== snapshot.providerCorrectsVersionId
    || record.providerCorrectionType !== snapshot.providerCorrectionType
    || record.providerCorrectedAt !== snapshot.providerCorrectedAt
    || canonicalJson(record.providerCorrectionChangedFields) !== canonicalJson(snapshot.providerCorrectionChangedFields)
    || record.isCurrentVersion !== snapshot.isCurrentProviderVersion || record.isCurrentVersion !== current) add(errors, "provider_snapshot_mirror_contract");

  if (record.providerBusinessRevisionPredecessorSnapshotId !== snapshot.providerBusinessRevisionPredecessorSnapshotId) add(errors, "provider_business_revision_mirror");

  const dateFieldsMatch = snapshot.sourcePublishedAt === record.sourceDate && snapshot.sourcePublishedAtCalendarDate === record.sourceDate
    && snapshot.asOfDate === record.sourceDate && snapshot.formedAtCalendarDate === record.sourceDate;
  const recordGeneratedTime = parseStrictPreciseInstant(record.generatedAt);
  const snapshotCreatedTime = parseStrictPreciseInstant(snapshot.createdAt);
  const preciseTimes = isStrictPreciseInstant(record.generatedAt) && isStrictPreciseInstant(snapshot.createdAt)
    && isStrictPreciseInstant(snapshot.providerGeneratedAt) && snapshot.providerGeneratedAt === record.generatedAt;
  const epochRelation = expectedGenerationEpoch === null || (isStrictPreciseInstant(expectedGenerationEpoch)
    && (current ? record.generatedAt === expectedGenerationEpoch : parseStrictPreciseInstant(record.generatedAt) <= parseStrictPreciseInstant(expectedGenerationEpoch)));
  if (!dateFieldsMatch || !preciseTimes || !epochRelation
    || snapshot.sourcePublishedAtPrecision !== "date" || snapshot.sourcePublishedAtResolution !== "date" || snapshot.sourcePublishedAtTimeZone !== null
    || snapshot.formedAt !== null || snapshot.formedAtPrecision !== "date" || snapshot.formedAtResolution !== "date" || snapshot.formedAtTimeZone !== null
    || snapshot.formationTimeBasis !== "public_disclosure_proxy" || snapshot.notes !== COMPANY_GUIDANCE_TIME_NOTE) add(errors, "provider_snapshot_time_contract");
  if (recordGeneratedTime !== null && snapshotCreatedTime !== null && snapshotCreatedTime > recordGeneratedTime) {
    add(errors, "provider_snapshot_creation_chronology");
  }

  const correctionFields = record.providerCorrectionChangedFields;
  if (record.providerCorrectionType === "initial") {
    if (record.providerCorrectsVersionId !== null || record.providerCorrectedAt !== null
      || !Array.isArray(correctionFields) || correctionFields.length !== 0) add(errors, "provider_correction_changed_fields");
  } else if (record.providerCorrectionType !== "extraction_correction"
    || !VERSION_ID.test(record.providerCorrectsVersionId ?? "")
    || !isStrictPreciseInstant(record.providerCorrectedAt)
    || record.providerCorrectedAt !== snapshot.createdAt
    || parseStrictPreciseInstant(record.providerCorrectedAt) > parseStrictPreciseInstant(record.generatedAt)
    || !uniqueStrings(correctionFields) || correctionFields.length === 0
    || correctionFields.some((field) => !COMPANY_GUIDANCE_CONTENT_FIELDS.includes(field))) {
    add(errors, "provider_correction_changed_fields");
  }

  if (!SHA256.test(record.sourceTextEvidenceHash ?? "")) add(errors, "provider_snapshot_evidence_contract");
  if (mode === "workflow_current") {
    if (Object.hasOwn(record, "sourceTextEvidence") || Object.hasOwn(record, ORIGINAL_UNIT_EVIDENCE_FIELD)) add(errors, "provider_snapshot_evidence_contract");
  } else if (typeof record.sourceTextEvidence !== "string" || !record.sourceTextEvidence.trim()
    || typeof record[ORIGINAL_UNIT_EVIDENCE_FIELD] !== "string" || !record[ORIGINAL_UNIT_EVIDENCE_FIELD].trim()
    || !record.sourceTextEvidence.includes(record[ORIGINAL_UNIT_EVIDENCE_FIELD])) add(errors, "provider_snapshot_evidence_contract");

  if (!uniqueAnnouncementIds(record.correctionCandidateAnnouncementIds)
    || !uniqueSupportedWarnings(record.structuredWarnings)) add(errors, "provider_structured_warning_contract");
  return errors;
}

export function validateCompanyGuidanceCorrectionGraph(records, { generationEpoch = null } = {}) {
  const errors = [];
  if (!Array.isArray(records)) return ["provider_correction_graph"];
  const byId = new Map(records.filter(isObject).map((record) => [record.providerSnapshotVersionId, record]));
  const releaseTime = parseStrictPreciseInstant(generationEpoch);
  for (const record of records) {
    if (!isObject(record) || !isObject(record.snapshot)) { add(errors, "provider_correction_graph"); continue; }
    const fields = record.providerCorrectionChangedFields;
    const initial = record.providerCorrectionType === "initial";
    if (initial) {
      if (record.providerCorrectsVersionId !== null || record.providerCorrectedAt !== null || !Array.isArray(fields) || fields.length !== 0) add(errors, "provider_correction_changed_fields");
      continue;
    }
    if (record.providerCorrectionType !== "extraction_correction" || typeof record.providerCorrectsVersionId !== "string") { add(errors, "provider_correction_graph"); continue; }
    const predecessor = byId.get(record.providerCorrectsVersionId);
    if (!predecessor || predecessor.providerEvidenceIdentity !== record.providerEvidenceIdentity || predecessor.providerSnapshotVersionId === record.providerSnapshotVersionId) {
      add(errors, "provider_correction_graph");
      continue;
    }
    const expectedFields = providerContentChangedFields(predecessor, record);
    if (!uniqueStrings(fields) || fields.length === 0 || fields.some((field) => !COMPANY_GUIDANCE_CONTENT_FIELDS.includes(field))
      || canonicalJson(fields) !== canonicalJson(expectedFields)) add(errors, "provider_correction_changed_fields");
    const correctedTime = parseStrictPreciseInstant(record.providerCorrectedAt);
    const recordTime = parseStrictPreciseInstant(record.generatedAt);
    const predecessorCreatedTime = parseStrictPreciseInstant(predecessor.snapshot?.createdAt);
    const correctionCreatedTime = parseStrictPreciseInstant(record.snapshot.createdAt);
    if (correctedTime === null || recordTime === null || predecessorCreatedTime === null || correctionCreatedTime === null
      || correctedTime !== correctionCreatedTime || predecessorCreatedTime > correctedTime
      || (releaseTime !== null && recordTime > releaseTime)) add(errors, "provider_correction_chronology");
  }
  return errors;
}

export function validateCompanyGuidanceBusinessRevisionSemantics(records, warnings = []) {
  const errors = [];
  if (!Array.isArray(records) || !Array.isArray(warnings)) return ["provider_structured_warning_contract"];
  const byGroup = new Map();
  for (const record of records.filter((item) => isObject(item) && isObject(item.snapshot))) {
    const key = [record.snapshot.stockId, record.snapshot.reportPeriod, record.snapshot.periodScope, record.snapshot.metric].join("|");
    const values = byGroup.get(key) ?? []; values.push(record); byGroup.set(key, values);
  }
  const expectedWarnings = new Map();
  for (const values of byGroup.values()) {
    values.sort((left, right) => left.sourceDate.localeCompare(right.sourceDate) || left.sourceAnnouncementId.localeCompare(right.sourceAnnouncementId));
    for (const record of values) {
      if (record.sourceAnnouncementType !== "earnings_preview_revision") {
        if (record.providerBusinessRevisionPredecessorSnapshotId !== null || record.structuredWarnings.length) add(errors, "provider_structured_warning_contract");
        continue;
      }
      const earlier = values.filter((item) => item.sourceDate < record.sourceDate);
      const explicitIds = new Set(record.correctionCandidateAnnouncementIds);
      let candidates = explicitIds.size ? earlier.filter((item) => explicitIds.has(item.sourceAnnouncementId)) : [];
      if (!candidates.length && !explicitIds.size && earlier.length) {
        const latestDate = earlier.map((item) => item.sourceDate).sort().at(-1);
        candidates = earlier.filter((item) => item.sourceDate === latestDate);
      }
      if (candidates.length === 1) {
        if (record.providerBusinessRevisionPredecessorSnapshotId !== candidates[0].snapshot.id || record.structuredWarnings.length) add(errors, "provider_structured_warning_contract");
      } else {
        const code = candidates.length ? "revision_predecessor_ambiguous" : "revision_predecessor_missing";
        if (record.providerBusinessRevisionPredecessorSnapshotId !== null || canonicalJson(record.structuredWarnings) !== canonicalJson([code])) add(errors, "provider_structured_warning_contract");
        expectedWarnings.set(`${record.sourceAnnouncementId}|${code}`, canonicalJson(record.correctionCandidateAnnouncementIds));
      }
    }
  }
  const actualWarnings = warnings.filter((warning) => ["revision_predecessor_ambiguous", "revision_predecessor_missing"].includes(warning?.code));
  const actualWarningKeys = actualWarnings.map((warning) => `${warning.sourceAnnouncementId}|${warning.code}`);
  if (new Set(actualWarningKeys).size !== actualWarningKeys.length
    || canonicalJson([...expectedWarnings.keys()].sort()) !== canonicalJson([...actualWarningKeys].sort())
    || actualWarnings.some((warning) => expectedWarnings.get(`${warning.sourceAnnouncementId}|${warning.code}`) !== canonicalJson(warning.candidateAnnouncementIds))) add(errors, "provider_structured_warning_contract");
  return errors;
}

export function classifyCompanyGuidanceProviderRecordErrors(errors) {
  if (errors.some((error) => ["provider_snapshot_creation_chronology", "provider_correction_graph", "provider_correction_changed_fields", "provider_correction_chronology"].includes(error) || error.startsWith("provider_correction_proof_"))) return "graph";
  if (errors.some((error) => ["provider_snapshot_mirror_contract", "provider_business_revision_mirror"].includes(error))) return "identity";
  return "schema";
}

function uniqueAnnouncementIds(value) { return Array.isArray(value) && value.every((item) => typeof item === "string" && ANNOUNCEMENT_ID.test(item)) && new Set(value).size === value.length; }
function uniqueSupportedWarnings(value) { return Array.isArray(value) && value.every((item) => typeof item === "string" && STRUCTURED_WARNING_CODES.has(item)) && new Set(value).size === value.length; }
function uniqueStrings(value) { return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim()) && new Set(value).size === value.length; }
function isObject(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function hasExactKeys(value, expectedKeys) { return canonicalJson(Object.keys(value).sort()) === canonicalJson([...expectedKeys].sort()); }
function containsForbiddenEvidenceKey(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenEvidenceKey);
  if (!isObject(value)) return false;
  return Object.keys(value).some((key) => key === "sourceTextEvidence" || key === ORIGINAL_UNIT_EVIDENCE_FIELD || containsForbiddenEvidenceKey(value[key]));
}
function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function add(errors, error) { if (!errors.includes(error)) errors.push(error); }
