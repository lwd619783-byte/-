import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  COMPANY_GUIDANCE_PROVIDER_ID,
  COMPANY_GUIDANCE_PROVIDER_VERSION,
  COMPANY_GUIDANCE_SCHEMA_VERSION,
  COMPANY_GUIDANCE_MANIFEST_METADATA_FIELDS,
  COMPANY_GUIDANCE_SUMMARY_ITEM_FIELDS,
  canonicalJson,
  createWorkflowIndex,
  deriveCompanyGuidanceManifestMetadata,
  deriveCompanyGuidanceSummaryItem,
  deriveCompanyGuidanceSummaryStatus,
  validateBusinessRevisionGraph,
  validateCompanyGuidanceDetail,
  validateCompanyGuidanceWorkflowCorrectionProofs,
  validateProviderRecord,
  validateVersionGraph,
} from "./company-guidance-expectations/core.mjs";
import { isStrictPreciseInstant } from "../src/utils/strictDateTime.mjs";
import {
  COMPANY_GUIDANCE_SOURCE_ARTIFACT,
  deriveCompanyGuidanceSummaryAudit,
  validateCompanyGuidanceSummaryAudit,
} from "../src/services/companyGuidanceExpectationAudit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_COMPANY_COUNT = 56;
const MANIFEST_NAME = "manifest.generated.json";
const WORKFLOW_NAME = "workflow-index.generated.json";
const WORKFLOW_RELATIVE_PATH = `data/a-share-company-guidance-expectations/${WORKFLOW_NAME}`;
const SAFE_DETAIL_PATH = /^data\/a-share-company-guidance-expectations\/[A-Za-z0-9_-]+\.json$/u;
const SAFE_ANNOUNCEMENT_DETAIL_PATH = /^data\/a-share-announcements\/[A-Za-z0-9_-]+\.json$/u;

export function validateCommittedCompanyGuidanceArtifacts(rootPath = root, { expectedCompanyCount = EXPECTED_COMPANY_COUNT, sourceRootPath = rootPath } = {}) {
  const errors = [];
  const summaryPath = path.join(rootPath, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
  const outputDir = path.join(rootPath, "public/data/a-share-company-guidance-expectations");
  let summary; let manifest;
  try { summary = readJson(summaryPath); } catch (error) { return { errors: [`summary unreadable: ${error}`] }; }
  try { manifest = readJson(path.join(outputDir, MANIFEST_NAME)); } catch (error) { return { errors: [`manifest unreadable: ${error}`] }; }

  for (const [label, artifact] of [["summary", summary], ["manifest", manifest]]) {
    if (!isObject(artifact) || artifact.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION) errors.push(`${label} schemaVersion mismatch`);
    if (!isObject(artifact) || artifact.providerId !== COMPANY_GUIDANCE_PROVIDER_ID) errors.push(`${label} providerId mismatch`);
    if (!isObject(artifact) || artifact.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION) errors.push(`${label} providerVersion mismatch`);
    if (!isObject(artifact) || !isStrictPreciseInstant(artifact.generatedAt)) errors.push(`${label} generatedAt contract mismatch`);
  }
  if (!isStrictPreciseInstant(summary?.sourceGeneratedAt)) errors.push("summary sourceGeneratedAt contract mismatch");
  if (summary?.sourceArtifact !== COMPANY_GUIDANCE_SOURCE_ARTIFACT) errors.push("summary sourceArtifact contract mismatch");
  errors.push(...validateCompanyGuidanceSummaryAudit(summary?.audit));

  const sourceReferences = loadAnnouncementSourceReferences(sourceRootPath, errors);

  const items = Array.isArray(manifest?.items) ? manifest.items : [];
  if (!Array.isArray(manifest?.items)) errors.push("manifest items must be an array");
  if (items.length !== expectedCompanyCount || manifest?.totalCompanies !== expectedCompanyCount || manifest?.totalCompanies !== items.length) errors.push(`manifest must contain exactly ${expectedCompanyCount} companies`);

  const manifestStockIds = new Set();
  const manifestStockCodes = new Set();
  const manifestPaths = new Set();
  const allowedJsonNames = new Set([MANIFEST_NAME, WORKFLOW_NAME]);
  const records = [];
  const versions = [];
  const details = [];
  let totalSnapshots = 0;
  let totalHistoricalVersions = 0;

  for (const entry of items) {
    const stockId = typeof entry?.stockId === "string" ? entry.stockId : "<invalid>";
    if (!entry || !SAFE_DETAIL_PATH.test(entry.relativePath ?? "") || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) { errors.push(`unsafe path: ${stockId}`); continue; }
    if (manifestStockIds.has(entry.stockId)) errors.push(`duplicate manifest stockId: ${entry.stockId}`);
    if (manifestStockCodes.has(entry.stockCode)) errors.push(`duplicate manifest stockCode: ${entry.stockCode}`);
    if (manifestPaths.has(entry.relativePath)) errors.push(`duplicate manifest relativePath: ${entry.relativePath}`);
    manifestStockIds.add(entry.stockId);
    manifestStockCodes.add(entry.stockCode);
    manifestPaths.add(entry.relativePath);
    allowedJsonNames.add(path.basename(entry.relativePath));

    const file = path.join(rootPath, "public", entry.relativePath);
    if (!fs.existsSync(file)) { errors.push(`missing detail: ${entry.stockId}`); continue; }
    const bytes = fs.readFileSync(file);
    if (bytes.byteLength !== entry.byteSize || sha256(bytes) !== entry.checksumSha256) errors.push(`checksum mismatch: ${entry.stockId}`);
    let detail; try { detail = JSON.parse(bytes.toString("utf8")); } catch { errors.push(`invalid json: ${entry.stockId}`); continue; }
    if (detail.stockId !== entry.stockId || detail.stockCode !== entry.stockCode || detail.companyName !== entry.companyName) errors.push(`identity mismatch: ${entry.stockId}`);
    try {
      const expectedManifestMetadata = deriveCompanyGuidanceManifestMetadata(detail);
      errors.push(...projectionMismatchMessages("manifest", entry.stockId, entry, expectedManifestMetadata, COMPANY_GUIDANCE_MANIFEST_METADATA_FIELDS));
    } catch (error) { errors.push(`manifest metadata derivation failed: ${entry.stockId}: ${String(error)}`); }
    errors.push(...validateCompanyGuidanceDetail(detail, { expectedGenerationEpoch: manifest?.generatedAt }).map((error) => `${entry.stockId}:${error}`));
    errors.push(...validateCandidateAnnouncementReferences(detail, sourceReferences));
    totalSnapshots += detail.providerSnapshots?.length ?? 0;
    totalHistoricalVersions += detail.historicalProviderVersions?.length ?? 0;
    records.push(...(detail.providerSnapshots ?? []));
    versions.push(...(detail.providerSnapshots ?? []), ...(detail.historicalProviderVersions ?? []));
    details.push(detail);
  }

  if (fs.existsSync(outputDir)) {
    const actualJsonNames = fs.readdirSync(outputDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name);
    for (const name of actualJsonNames) if (!allowedJsonNames.has(name)) errors.push(`unexpected provider json: ${name}`);
    for (const name of allowedJsonNames) if (!actualJsonNames.includes(name)) errors.push(`declared provider json missing: ${name}`);
  } else errors.push("provider output directory missing");

  const summaryItems = isObject(summary?.items) ? summary.items : {};
  const summaryStockIds = new Set(Object.keys(summaryItems));
  const detailStockIds = new Set(details.map((detail) => detail.stockId));
  errors.push(...setDifferenceMessages("summary stockId missing", manifestStockIds, summaryStockIds));
  errors.push(...setDifferenceMessages("summary stockId extra", summaryStockIds, manifestStockIds));
  errors.push(...setDifferenceMessages("summary detail stockId missing", detailStockIds, summaryStockIds));
  errors.push(...setDifferenceMessages("summary detail stockId extra", summaryStockIds, detailStockIds));
  for (const detail of details) {
    const item = summaryItems[detail.stockId];
    if (!item) continue;
    try {
      const expectedSummaryItem = deriveCompanyGuidanceSummaryItem(detail);
      errors.push(...projectionMismatchMessages("summary", detail.stockId, item, expectedSummaryItem, COMPANY_GUIDANCE_SUMMARY_ITEM_FIELDS));
    } catch (error) { errors.push(`summary metadata derivation failed: ${detail.stockId}: ${String(error)}`); }
  }

  errors.push(...validateVersionGraph(versions), ...validateBusinessRevisionGraph(records));
  const workflowPath = path.join(rootPath, "public", manifest?.workflowIndexRelativePath ?? "");
  let workflow = null;
  if (manifest?.workflowIndexRelativePath !== WORKFLOW_RELATIVE_PATH || !fs.existsSync(workflowPath)) errors.push("workflow index missing or unsafe");
  else {
    const bytes = fs.readFileSync(workflowPath);
    if (bytes.byteLength !== manifest.workflowIndexByteSize || sha256(bytes) !== manifest.workflowIndexChecksumSha256) errors.push("workflow index checksum mismatch");
    try { workflow = JSON.parse(bytes.toString("utf8")); } catch { errors.push("workflow index invalid json"); }
  }
  if (workflow) {
    if (workflow.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION || workflow.providerId !== COMPANY_GUIDANCE_PROVIDER_ID || workflow.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION) errors.push("workflow index contract mismatch");
    if (!Array.isArray(workflow.records) || !Array.isArray(workflow.correctionProofs) || workflow.currentSnapshotCount !== workflow.records.length || workflow.currentSnapshotCount !== totalSnapshots) errors.push("workflow index count mismatch");
    if (!isStrictPreciseInstant(workflow.generatedAt) || workflow.generatedAt !== manifest.generatedAt) errors.push("workflow generation epoch mismatch");
    const expectedWorkflow = createWorkflowIndex(details, manifest.generatedAt);
    if (canonicalJson(workflow) !== canonicalJson(expectedWorkflow)) errors.push("workflow index does not exactly mirror current detail records");
    if ((workflow.records ?? []).some((record) => Object.hasOwn(record, "sourceTextEvidence") || Object.hasOwn(record, "originalUnitEvidence"))) errors.push("workflow index contains raw evidence fields");
    errors.push(...validateCompanyGuidanceWorkflowCorrectionProofs(workflow.records ?? [], workflow.correctionProofs ?? []));
    const companyNames = new Map(details.map((detail) => [detail.stockId, detail.companyName]));
    for (const record of workflow.records ?? []) errors.push(...validateProviderRecord(record, {
      mode: "workflow_current",
      stockId: record?.snapshot?.stockId,
      companyName: companyNames.get(record?.snapshot?.stockId) ?? null,
      expectedGenerationEpoch: manifest.generatedAt,
    }).map((error) => `workflow:${record?.sourceAnnouncementId ?? "<invalid>"}:${error}`));
  }

  try {
    const expectedAudit = deriveCompanyGuidanceSummaryAudit(details);
    if (canonicalJson(summary?.audit) !== canonicalJson(expectedAudit)) errors.push("detail_audit_projection");
  } catch (error) { errors.push(`summary audit derivation failed: ${String(error)}`); }

  const companiesWithSnapshots = details.filter((detail) => detail.providerSnapshots?.length > 0).length;
  if (totalSnapshots !== manifest?.totalSnapshots || totalSnapshots !== summary?.audit?.reliableSnapshotCount || totalSnapshots !== summary?.workflowIndex?.currentSnapshotCount) errors.push("total snapshot count mismatch");
  if (totalHistoricalVersions !== manifest?.totalHistoricalVersions || totalHistoricalVersions !== summary?.audit?.historicalVersionCount) errors.push("historical version count mismatch");
  if (companiesWithSnapshots !== manifest?.companiesWithSnapshots || companiesWithSnapshots !== summary?.audit?.reliableCompanyCount) errors.push("companies-with-snapshots count mismatch");
  if (summary?.audit?.companyCount !== items.length) errors.push("summary company count mismatch");
  if (summary?.generatedAt !== manifest?.generatedAt) errors.push("summary global field mismatch: generatedAt");
  if (summary?.sourceGeneratedAt !== manifest?.generatedAt) errors.push("summary global field mismatch: sourceGeneratedAt");
  if (summary?.sourceGeneratedAt !== sourceReferences.sourceGeneratedAt) errors.push("announcement/provider release epoch mismatch");
  if (summary?.workflowIndex?.relativePath !== manifest?.workflowIndexRelativePath) errors.push("summary global field mismatch: workflowIndex.relativePath");
  if (summary?.workflowIndex?.byteSize !== manifest?.workflowIndexByteSize) errors.push("summary global field mismatch: workflowIndex.byteSize");
  if (summary?.workflowIndex?.checksumSha256 !== manifest?.workflowIndexChecksumSha256) errors.push("summary global field mismatch: workflowIndex.checksumSha256");
  if (summary?.workflowIndex?.currentSnapshotCount !== manifest?.totalSnapshots) errors.push("summary global field mismatch: workflowIndex.currentSnapshotCount");
  try { if (summary?.status !== deriveCompanyGuidanceSummaryStatus(details)) errors.push("summary global field mismatch: status"); } catch (error) { errors.push(`summary status derivation failed: ${String(error)}`); }
  if (totalSnapshots <= 0) errors.push("no reliable provider snapshots");

  return {
    errors: [...new Set(errors)],
    totalCompanies: items.length,
    totalSnapshots,
    totalHistoricalVersions,
    companiesWithSnapshots,
    workflowIndexBytes: Number.isInteger(manifest?.workflowIndexByteSize) ? manifest.workflowIndexByteSize : null,
    audit: summary?.audit,
  };
}

function loadAnnouncementSourceReferences(sourceRootPath, errors) {
  const summaryPath = path.join(sourceRootPath, "src/data/real/a-share-announcement-summaries.generated.json");
  const manifestPath = path.join(sourceRootPath, "public/data/a-share-announcements/manifest.generated.json");
  const byStock = new Map();
  const ownerByAnnouncementId = new Map();
  const directReferencesBySourceId = new Map();
  let sourceSummary; let sourceManifest;
  try { sourceSummary = readJson(summaryPath); } catch (error) { errors.push(`announcement source summary unreadable: ${error}`); return { byStock, ownerByAnnouncementId, directReferencesBySourceId, sourceGeneratedAt: null }; }
  try { sourceManifest = readJson(manifestPath); } catch (error) { errors.push(`announcement source manifest unreadable: ${error}`); return { byStock, ownerByAnnouncementId, directReferencesBySourceId, sourceGeneratedAt: sourceSummary?.generatedAt ?? null }; }
  const sourceGeneratedAt = sourceSummary?.generatedAt ?? null;
  if (!isStrictPreciseInstant(sourceGeneratedAt) || sourceManifest?.generatedAt !== sourceGeneratedAt) errors.push("announcement source release epoch mismatch");
  if (!Array.isArray(sourceManifest?.items)) { errors.push("announcement source manifest items must be an array"); return { byStock, ownerByAnnouncementId, directReferencesBySourceId, sourceGeneratedAt }; }
  for (const entry of sourceManifest.items) {
    if (!entry || typeof entry.stockId !== "string" || typeof entry.relativePath !== "string"
      || !SAFE_ANNOUNCEMENT_DETAIL_PATH.test(entry.relativePath) || entry.relativePath.includes("..")
      || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) { errors.push("announcement source manifest entry invalid"); continue; }
    let detail;
    try { detail = readJson(path.join(sourceRootPath, "public", entry.relativePath)); } catch (error) { errors.push(`announcement source detail unreadable: ${entry.stockId}: ${error}`); continue; }
    if (detail?.stockId !== entry.stockId || !Array.isArray(detail?.announcements)) { errors.push(`announcement source detail identity invalid: ${entry.stockId}`); continue; }
    if (detail.generatedAt !== sourceGeneratedAt) errors.push(`announcement source detail release epoch mismatch: ${entry.stockId}`);
    const ids = byStock.get(entry.stockId) ?? new Set();
    for (const announcement of detail.announcements) {
      const id = typeof announcement?.announcementId === "string" ? announcement.announcementId : null;
      if (!id || !/^\d+$/u.test(id)) continue;
      const previousOwner = ownerByAnnouncementId.get(id);
      if (previousOwner && previousOwner !== entry.stockId) errors.push(`announcement source id has multiple company owners: ${id}`);
      ownerByAnnouncementId.set(id, entry.stockId); ids.add(id);
      const direct = new Set([announcement.correctedAnnouncementId,
        ...(Array.isArray(announcement.performanceForecastEvents) ? announcement.performanceForecastEvents.map((event) => event?.previousForecastAnnouncementId) : [])]
        .filter((candidate) => typeof candidate === "string" && /^\d+$/u.test(candidate)));
      directReferencesBySourceId.set(id, direct);
    }
    byStock.set(entry.stockId, ids);
  }
  return { byStock, ownerByAnnouncementId, directReferencesBySourceId, sourceGeneratedAt };
}

function validateCandidateAnnouncementReferences(detail, sourceReferences) {
  const errors = [];
  const sameCompanyIds = sourceReferences.byStock.get(detail.stockId) ?? new Set();
  const records = [...(detail.providerSnapshots ?? []), ...(detail.historicalProviderVersions ?? [])];
  const collections = [
    ...(detail.exclusions ?? []).map((record) => ({ sourceId: record.sourceAnnouncementId, candidates: record.candidateAnnouncementIds })),
    ...(detail.warnings ?? []).map((record) => ({ sourceId: record.sourceAnnouncementId, candidates: record.candidateAnnouncementIds })),
    ...records.map((record) => ({ sourceId: record.sourceAnnouncementId, candidates: record.correctionCandidateAnnouncementIds })),
  ];
  for (const { sourceId, candidates } of collections) {
    if (!Array.isArray(candidates) || candidates.length === 0) continue;
    if (!sameCompanyIds.has(sourceId)) { errors.push(`${detail.stockId}:candidate source announcement not backed by same-company source artifact: ${sourceId}`); continue; }
    const direct = sourceReferences.directReferencesBySourceId.get(sourceId) ?? new Set();
    for (const candidateId of candidates ?? []) {
      const owner = sourceReferences.ownerByAnnouncementId.get(candidateId);
      if (owner && owner !== detail.stockId) errors.push(`${detail.stockId}:candidate announcement belongs to another company: ${sourceId}->${candidateId}`);
      else if (!sameCompanyIds.has(candidateId) && !direct.has(candidateId)) errors.push(`${detail.stockId}:candidate announcement is not source-backed: ${sourceId}->${candidateId}`);
    }
  }
  return errors;
}

function setDifferenceMessages(label, left, right) { return [...left].filter((value) => !right.has(value)).sort().map((value) => `${label}: ${value}`); }
function projectionMismatchMessages(label, stockId, actual, expected, fields) { return fields.filter((field) => !Object.is(actual?.[field], expected[field])).map((field) => `${label} derived field mismatch: ${stockId}.${field} expected=${JSON.stringify(expected[field])} actual=${JSON.stringify(actual?.[field])}`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function isObject(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateCommittedCompanyGuidanceArtifacts();
  console.log(JSON.stringify({ status: result.errors.length ? "failed" : "passed", ...result }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
