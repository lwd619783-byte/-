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
  buildCompanyGuidanceArtifacts,
  canonicalJson,
  createWorkflowIndex,
  deriveCompanyGuidanceManifestMetadata,
  deriveCompanyGuidanceSummaryItem,
  validateBusinessRevisionGraph,
  validateCompanyGuidanceDetail,
  validateVersionGraph,
} from "./company-guidance-expectations/core.mjs";
import { validateCommittedCompanyGuidanceArtifacts } from "./validate-company-guidance-expectations.mjs";
import {
  COMPANY_GUIDANCE_SOURCE_ARTIFACT,
  deriveCompanyGuidanceSummaryAudit,
  validateCompanyGuidanceSummaryAuditManifestProjection,
} from "../src/services/companyGuidanceExpectationAudit.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowIndexName = "workflow-index.generated.json";
const manifestName = "manifest.generated.json";
const expectedCompanyCount = 56;
const SAFE_PROVIDER_DETAIL_PATH = /^data\/a-share-company-guidance-expectations\/[A-Za-z0-9_-]+\.json$/u;
const SAFE_ANNOUNCEMENT_DETAIL_PATH = /^data\/a-share-announcements\/[A-Za-z0-9_-]+\.json$/u;

export const ARTIFACT_TRANSACTION_STAGE = Object.freeze({
  OLD_DIRECTORY_BACKUP: "old_directory_backup",
  NEW_DIRECTORY_ACTIVATION: "new_directory_activation",
  OLD_SUMMARY_BACKUP: "old_summary_backup",
  NEW_SUMMARY_ACTIVATION: "new_summary_activation",
  BACKUP_CLEANUP: "backup_cleanup",
});

export class ArtifactTransactionCleanupError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "ArtifactTransactionCleanupError";
  }
}

export function resolveCompanyGuidancePaths(rootPath = defaultRoot) {
  return {
    rootPath,
    announcementSummaryPath: path.join(rootPath, "src/data/real/a-share-announcement-summaries.generated.json"),
    announcementManifestPath: path.join(rootPath, "public/data/a-share-announcements/manifest.generated.json"),
    summaryPath: path.join(rootPath, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json"),
    outputDir: path.join(rootPath, "public/data/a-share-company-guidance-expectations"),
  };
}

export function generateCompanyGuidanceArtifacts({ dryRun = false, rootPath = defaultRoot, transactionHooks = null } = {}) {
  const paths = resolveCompanyGuidancePaths(rootPath);
  const sourceSummary = readJson(paths.announcementSummaryPath, "announcement summary");
  const sourceManifest = readJson(paths.announcementManifestPath, "announcement manifest");
  const details = readAnnouncementDetails(sourceManifest, rootPath);
  const previousDetails = readPreviousProviderDetails(paths, expectedCompanyCount);
  const result = buildCompanyGuidanceArtifacts({ announcementDetails: details, sourceGeneratedAt: sourceSummary.generatedAt, previousDetails });
  const renderedDetails = new Map(result.companies.map((company) => [company.stockId, renderJson(company)]));
  const workflowIndex = createWorkflowIndex(result.companies, sourceSummary.generatedAt);
  const renderedWorkflowIndex = renderJson(workflowIndex);
  const workflowIndexChecksumSha256 = sha256(renderedWorkflowIndex);
  result.summary.workflowIndex = {
    relativePath: `data/a-share-company-guidance-expectations/${workflowIndexName}`,
    byteSize: Buffer.byteLength(renderedWorkflowIndex),
    checksumSha256: workflowIndexChecksumSha256,
    currentSnapshotCount: workflowIndex.currentSnapshotCount,
  };
  const manifest = {
    schemaVersion: COMPANY_GUIDANCE_SCHEMA_VERSION,
    providerId: COMPANY_GUIDANCE_PROVIDER_ID,
    providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    generatedAt: sourceSummary.generatedAt,
    totalCompanies: result.companies.length,
    companiesWithSnapshots: result.audit.reliableCompanyCount,
    totalSnapshots: result.audit.reliableSnapshotCount,
    totalHistoricalVersions: result.audit.historicalVersionCount,
    workflowIndexRelativePath: result.summary.workflowIndex.relativePath,
    workflowIndexByteSize: result.summary.workflowIndex.byteSize,
    workflowIndexChecksumSha256,
    items: result.companies.map((company) => {
      const content = renderedDetails.get(company.stockId);
      const metadata = deriveCompanyGuidanceManifestMetadata(company);
      return {
        stockId: metadata.stockId,
        stockCode: metadata.stockCode,
        companyName: metadata.companyName,
        relativePath: metadata.relativePath,
        snapshotCount: metadata.snapshotCount,
        historicalVersionCount: metadata.historicalVersionCount,
        excludedAnnouncementCount: metadata.excludedAnnouncementCount,
        byteSize: Buffer.byteLength(content),
        checksumSha256: sha256(content),
        latestReportPeriod: metadata.latestReportPeriod,
        latestSourceDate: metadata.latestSourceDate,
        status: metadata.status,
      };
    }),
  };
  validateRendered(result, manifest, renderedDetails, workflowIndex, renderedWorkflowIndex, expectedCompanyCount);
  if (!dryRun) {
    writeArtifactsTransaction({
      rootPath,
      outputDir: paths.outputDir,
      summaryPath: paths.summaryPath,
      summary: result.summary,
      manifest,
      renderedDetails,
      renderedWorkflowIndex,
      expectedCompanyCount,
      sourceRootPath: rootPath,
      hooks: transactionHooks,
    });
  }
  return { ...result, manifest, workflowIndex, dryRun };
}

export function readPreviousProviderDetails(paths, requiredCompanyCount = expectedCompanyCount) {
  if (!fs.existsSync(paths.outputDir)) return [];
  if (!fs.statSync(paths.outputDir).isDirectory()) throw new Error(`existing provider output is not a directory: ${paths.outputDir}`);
  const validation = validateCommittedCompanyGuidanceArtifacts(paths.rootPath, { expectedCompanyCount: requiredCompanyCount });
  if (validation.errors.length) throw new Error(`existing provider artifacts are invalid: ${validation.errors.join("; ")}`);
  const manifest = readJson(path.join(paths.outputDir, manifestName), "existing provider manifest");
  const details = manifest.items.map((entry) => {
    assertProviderManifestEntry(entry);
    const file = path.join(paths.outputDir, path.basename(entry.relativePath));
    if (!fs.existsSync(file)) throw new Error(`existing provider detail missing: ${entry.stockId}`);
    const detail = readJson(file, `existing provider detail ${entry.stockId}`);
    if (detail.stockId !== entry.stockId || detail.stockCode !== entry.stockCode || detail.companyName !== entry.companyName) throw new Error(`existing provider detail identity mismatch: ${entry.stockId}`);
    return detail;
  });
  return details;
}

export function writeArtifactsTransaction({ rootPath, outputDir, summaryPath, summary, manifest, renderedDetails, renderedWorkflowIndex, expectedCompanyCount: requiredCompanyCount = expectedCompanyCount, sourceRootPath = rootPath, hooks = null }) {
  const transactionId = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const stageRoot = path.join(path.dirname(outputDir), `.company-guidance-staging-${transactionId}`);
  const stageOutputDir = path.join(stageRoot, "public/data/a-share-company-guidance-expectations");
  const stageSummaryPath = path.join(stageRoot, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
  const backupDir = `${outputDir}.backup-${transactionId}`;
  const summaryBackupPath = `${summaryPath}.backup-${transactionId}`;
  const state = {
    stagingCompleted: false,
    oldDirectoryBackedUp: false,
    newDirectoryActivated: false,
    oldSummaryBackedUp: false,
    newSummaryActivated: false,
    committed: false,
    cleanupCompleted: false,
  };

  ensureAbsent(stageRoot, "staging root");
  ensureAbsent(backupDir, "directory backup");
  ensureAbsent(summaryBackupPath, "summary backup");
  try {
    fs.mkdirSync(stageOutputDir, { recursive: true });
    fs.mkdirSync(path.dirname(stageSummaryPath), { recursive: true });
    for (const [stockId, content] of renderedDetails) fs.writeFileSync(path.join(stageOutputDir, `${stockId}.json`), content, "utf8");
    fs.writeFileSync(path.join(stageOutputDir, manifestName), renderJson(manifest), "utf8");
    fs.writeFileSync(path.join(stageOutputDir, workflowIndexName), renderedWorkflowIndex, "utf8");
    fs.writeFileSync(stageSummaryPath, renderJson(summary), "utf8");
    const stagedValidation = validateCommittedCompanyGuidanceArtifacts(stageRoot, { expectedCompanyCount: requiredCompanyCount, sourceRootPath });
    if (stagedValidation.errors.length) throw new Error(`staged provider artifacts are invalid: ${stagedValidation.errors.join("; ")}`);
    state.stagingCompleted = true;

    invokeTransactionHook(hooks, ARTIFACT_TRANSACTION_STAGE.OLD_DIRECTORY_BACKUP, state);
    if (fs.existsSync(outputDir)) {
      ensureAbsent(backupDir, "directory backup");
      fs.renameSync(outputDir, backupDir);
      state.oldDirectoryBackedUp = true;
    }

    invokeTransactionHook(hooks, ARTIFACT_TRANSACTION_STAGE.NEW_DIRECTORY_ACTIVATION, state);
    ensureAbsent(outputDir, "provider output activation target");
    fs.mkdirSync(path.dirname(outputDir), { recursive: true });
    fs.renameSync(stageOutputDir, outputDir);
    state.newDirectoryActivated = true;

    invokeTransactionHook(hooks, ARTIFACT_TRANSACTION_STAGE.OLD_SUMMARY_BACKUP, state);
    if (fs.existsSync(summaryPath)) {
      ensureAbsent(summaryBackupPath, "summary backup");
      fs.renameSync(summaryPath, summaryBackupPath);
      state.oldSummaryBackedUp = true;
    }

    invokeTransactionHook(hooks, ARTIFACT_TRANSACTION_STAGE.NEW_SUMMARY_ACTIVATION, state);
    ensureAbsent(summaryPath, "summary activation target");
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.renameSync(stageSummaryPath, summaryPath);
    state.newSummaryActivated = true;
    state.committed = true;

    try {
      invokeTransactionHook(hooks, ARTIFACT_TRANSACTION_STAGE.BACKUP_CLEANUP, state);
      if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
      if (fs.existsSync(summaryBackupPath)) fs.rmSync(summaryBackupPath, { force: true });
      if (fs.existsSync(stageRoot)) fs.rmSync(stageRoot, { recursive: true, force: true });
      state.cleanupCompleted = true;
    } catch (cleanupCause) {
      const cleanupError = new ArtifactTransactionCleanupError(`provider artifact transaction committed but backup cleanup failed; remove after inspection: ${[backupDir, summaryBackupPath, stageRoot].filter((item) => fs.existsSync(item)).join(", ")}`, { cause: cleanupCause });
      cleanupError.transactionState = structuredClone(state);
      cleanupError.cleanupPaths = [backupDir, summaryBackupPath, stageRoot].filter((item) => fs.existsSync(item));
      throw cleanupError;
    }
  } catch (error) {
    if (state.committed) throw error;
    const rollbackErrors = [];
    rollbackStep(rollbackErrors, "remove activated summary", () => { if (state.newSummaryActivated && fs.existsSync(summaryPath)) fs.rmSync(summaryPath, { force: true }); });
    rollbackStep(rollbackErrors, "restore summary", () => { if (state.oldSummaryBackedUp && fs.existsSync(summaryBackupPath)) { ensureAbsent(summaryPath, "summary rollback target"); fs.renameSync(summaryBackupPath, summaryPath); } });
    rollbackStep(rollbackErrors, "remove activated directory", () => { if (state.newDirectoryActivated && fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true }); });
    rollbackStep(rollbackErrors, "restore directory", () => { if (state.oldDirectoryBackedUp && fs.existsSync(backupDir)) { ensureAbsent(outputDir, "directory rollback target"); fs.renameSync(backupDir, outputDir); } });
    rollbackStep(rollbackErrors, "remove staging", () => { if (fs.existsSync(stageRoot)) fs.rmSync(stageRoot, { recursive: true, force: true }); });
    if (error && typeof error === "object") {
      error.transactionState = structuredClone(state);
      error.rollbackErrors = rollbackErrors;
    }
    throw error;
  }
}

function readAnnouncementDetails(sourceManifest, rootPath) {
  if (!sourceManifest || !Array.isArray(sourceManifest.items) || !sourceManifest.items.length) throw new Error("announcement manifest items must be a non-empty array");
  const stockIds = new Set(); const stockCodes = new Set(); const relativePaths = new Set();
  return sourceManifest.items.map((entry) => {
    if (!entry || typeof entry.stockId !== "string" || typeof entry.stockCode !== "string" || !SAFE_ANNOUNCEMENT_DETAIL_PATH.test(entry.relativePath ?? "") || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) throw new Error(`invalid announcement manifest entry: ${entry?.stockId ?? "unknown"}`);
    if (stockIds.has(entry.stockId) || stockCodes.has(entry.stockCode) || relativePaths.has(entry.relativePath)) throw new Error(`duplicate announcement manifest identity/path: ${entry.stockId}`);
    stockIds.add(entry.stockId); stockCodes.add(entry.stockCode); relativePaths.add(entry.relativePath);
    const detail = readJson(path.join(rootPath, "public", entry.relativePath), `announcement detail ${entry.stockId}`);
    if (detail.stockId !== entry.stockId || detail.stockCode !== entry.stockCode) throw new Error(`announcement detail identity mismatch: ${entry.stockId}`);
    return detail;
  });
}

function validateRendered(result, manifest, renderedDetails, workflowIndex, renderedWorkflowIndex, requiredCompanyCount) {
  if (result.companies.length !== requiredCompanyCount || manifest.items.length !== requiredCompanyCount) throw new Error(`expected ${requiredCompanyCount} companies, got ${result.companies.length}`);
  if (result.audit.reliableSnapshotCount <= 0) throw new Error("no reliable company-guidance snapshots; refusing to generate example data");
  if (result.summary.sourceArtifact !== COMPANY_GUIDANCE_SOURCE_ARTIFACT) throw new Error("summary sourceArtifact contract mismatch");
  const derivedAudit = deriveCompanyGuidanceSummaryAudit(result.companies);
  if (canonicalJson(result.audit) !== canonicalJson(derivedAudit) || canonicalJson(result.summary.audit) !== canonicalJson(derivedAudit)) throw new Error("summary audit does not exactly mirror detail records");
  const auditProjectionErrors = validateCompanyGuidanceSummaryAuditManifestProjection(result.summary.audit, manifest);
  if (auditProjectionErrors.length) throw new Error(`summary audit/manifest projection mismatch: ${auditProjectionErrors.join("; ")}`);
  const companyIds = result.companies.map((company) => company.stockId);
  const manifestIds = manifest.items.map((entry) => entry.stockId);
  const summaryIds = Object.keys(result.summary.items);
  const detailIds = [...renderedDetails.keys()];
  assertUniqueAndEqualSets("company/manifest stockId", companyIds, manifestIds);
  assertUniqueAndEqualSets("company/summary stockId", companyIds, summaryIds);
  assertUniqueAndEqualSets("company/detail stockId", companyIds, detailIds);
  assertUnique(manifest.items.map((entry) => entry.stockCode), "manifest stockCode");
  assertUnique(manifest.items.map((entry) => entry.relativePath), "manifest relativePath");
  const ids = result.companies.flatMap((company) => company.providerSnapshots.map((record) => record.snapshot.id));
  assertUnique(ids, "provider snapshot id");
  const allVersions = result.companies.flatMap((company) => [...company.providerSnapshots, ...company.historicalProviderVersions]);
  const detailErrors = result.companies.flatMap((company) => validateCompanyGuidanceDetail(company, { expectedGenerationEpoch: result.summary.generatedAt }).map((error) => `${company.stockId}:${error}`));
  const graphErrors = [...validateVersionGraph(allVersions), ...validateBusinessRevisionGraph(result.companies.flatMap((company) => company.providerSnapshots))];
  if (detailErrors.length || graphErrors.length) throw new Error(`deep provider validation failed: ${[...detailErrors, ...graphErrors].join("; ")}`);
  if (workflowIndex.currentSnapshotCount !== ids.length || workflowIndex.records.length !== ids.length) throw new Error("workflow index count mismatch");
  if (Buffer.byteLength(renderedWorkflowIndex) !== manifest.workflowIndexByteSize || sha256(renderedWorkflowIndex) !== manifest.workflowIndexChecksumSha256) throw new Error("workflow index checksum mismatch");
  for (const entry of manifest.items) {
    assertProviderManifestEntry(entry);
    const company = result.companies.find((candidate) => candidate.stockId === entry.stockId);
    if (!company) throw new Error(`manifest detail missing for ${entry.stockId}`);
    assertDerivedProjection("manifest", entry.stockId, entry, deriveCompanyGuidanceManifestMetadata(company), COMPANY_GUIDANCE_MANIFEST_METADATA_FIELDS);
    assertDerivedProjection("summary", entry.stockId, result.summary.items[entry.stockId], deriveCompanyGuidanceSummaryItem(company), COMPANY_GUIDANCE_SUMMARY_ITEM_FIELDS);
    const content = renderedDetails.get(entry.stockId);
    if (!content || Buffer.byteLength(content) !== entry.byteSize || sha256(content) !== entry.checksumSha256) throw new Error(`manifest mismatch for ${entry.stockId}`);
  }
}

function assertProviderManifestEntry(entry) {
  if (!entry || !SAFE_PROVIDER_DETAIL_PATH.test(entry.relativePath ?? "") || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) throw new Error(`unsafe provider path for ${entry?.stockId ?? "unknown"}`);
}
function assertDerivedProjection(label, stockId, actual, expected, fields) { for (const field of fields) if (!Object.is(actual?.[field], expected[field])) throw new Error(`${label} derived field mismatch: ${stockId}.${field} expected=${JSON.stringify(expected[field])} actual=${JSON.stringify(actual?.[field])}`); }
function assertUnique(values, label) { if (new Set(values).size !== values.length) throw new Error(`duplicate ${label}`); }
function assertUniqueAndEqualSets(label, left, right) { assertUnique(left, `${label} left`); assertUnique(right, `${label} right`); const leftSet = new Set(left); const rightSet = new Set(right); const missing = [...leftSet].filter((item) => !rightSet.has(item)); const extra = [...rightSet].filter((item) => !leftSet.has(item)); if (missing.length || extra.length) throw new Error(`${label} mismatch: missing=${missing.join(",")} extra=${extra.join(",")}`); }
function invokeTransactionHook(hooks, stage, state) { hooks?.beforeStage?.(stage, structuredClone(state)); }
function rollbackStep(errors, label, action) { try { action(); } catch (error) { errors.push(`${label}: ${String(error)}`); } }
function ensureAbsent(target, label) { if (fs.existsSync(target)) throw new Error(`${label} already exists: ${target}`); }
function readJson(file, label = file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { throw new Error(`${label} unreadable: ${error}`, { cause: error }); } }
function renderJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = generateCompanyGuidanceArtifacts({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify({ status: "passed", dryRun: result.dryRun, audit: result.audit }, null, 2));
}
