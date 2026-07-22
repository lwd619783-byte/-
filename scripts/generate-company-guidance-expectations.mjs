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
import { isStrictPreciseInstant } from "../src/utils/strictDateTime.mjs";

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

export function renderCompanyGuidanceArtifacts({ rootPath = defaultRoot, validatePreviousArtifacts = true } = {}) {
  const paths = resolveCompanyGuidancePaths(rootPath);
  const sourceSummary = readJson(paths.announcementSummaryPath, "announcement summary");
  const sourceManifest = readJson(paths.announcementManifestPath, "announcement manifest");
  const details = readAnnouncementDetails(sourceManifest, rootPath);
  assertAnnouncementReleaseEpoch(sourceSummary, sourceManifest, details);
  const previousDetails = readPreviousProviderDetails(paths, expectedCompanyCount, { validateCommitted: validatePreviousArtifacts });
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
  const renderedManifest = renderJson(manifest);
  const renderedSummary = renderJson(result.summary);
  const artifacts = new Map([
    ...[...renderedDetails].map(([stockId, content]) => [`public/data/a-share-company-guidance-expectations/${stockId}.json`, Buffer.from(content, "utf8")]),
    [`public/data/a-share-company-guidance-expectations/${manifestName}`, Buffer.from(renderedManifest, "utf8")],
    [`public/data/a-share-company-guidance-expectations/${workflowIndexName}`, Buffer.from(renderedWorkflowIndex, "utf8")],
    ["src/data/real/a-share-company-guidance-expectation-summaries.generated.json", Buffer.from(renderedSummary, "utf8")],
  ].sort(([left], [right]) => left.localeCompare(right)));
  return { ...result, manifest, workflowIndex, renderedDetails, renderedWorkflowIndex, renderedManifest, renderedSummary, artifacts, sourceSummary, sourceManifest };
}

export function generateCompanyGuidanceArtifacts({ dryRun = false, rootPath = defaultRoot, transactionHooks = null } = {}) {
  const rendered = renderCompanyGuidanceArtifacts({ rootPath });
  const paths = resolveCompanyGuidancePaths(rootPath);
  if (!dryRun) {
    writeArtifactsTransaction({
      rootPath,
      outputDir: paths.outputDir,
      summaryPath: paths.summaryPath,
      summary: rendered.summary,
      manifest: rendered.manifest,
      renderedDetails: rendered.renderedDetails,
      renderedWorkflowIndex: rendered.renderedWorkflowIndex,
      expectedCompanyCount,
      sourceRootPath: rootPath,
      hooks: transactionHooks,
    });
  }
  return { ...rendered, dryRun };
}

export function checkCommittedCompanyGuidanceArtifacts({ rootPath = defaultRoot } = {}) {
  const paths = resolveCompanyGuidancePaths(rootPath);
  const fileSetMismatches = compareArtifactFileSet(rootPath, paths);
  const blockingInputMissing = fileSetMismatches.some((mismatch) => mismatch.mismatchTypes.includes("missing_file")
    && mismatch.path !== "src/data/real/a-share-company-guidance-expectation-summaries.generated.json"
    && !mismatch.path.endsWith(`/${workflowIndexName}`));
  if (blockingInputMissing) return { status: "failed", checked: false, mismatches: fileSetMismatches };
  const committedValidation = validateCommittedCompanyGuidanceArtifacts(rootPath, { expectedCompanyCount });
  const rendered = renderCompanyGuidanceArtifacts({ rootPath, validatePreviousArtifacts: false });
  const mismatches = [
    ...fileSetMismatches.filter((mismatch) => mismatch.mismatchTypes.includes("extra_or_orphan_file")),
    ...committedValidation.errors.map(validationMismatch),
    ...releaseEpochMismatches(rendered, rootPath),
    ...compareCommittedArtifactBytes(rendered.artifacts, rootPath),
  ];
  return {
    status: mismatches.length ? "failed" : "passed",
    checked: true,
    sourceGeneratedAt: rendered.sourceSummary.generatedAt,
    expectedFileCount: rendered.artifacts.size,
    mismatches,
    audit: rendered.audit,
  };
}

function validationMismatch(message) {
  const pathHint = message.startsWith("summary") || message.includes("summary ")
    ? "src/data/real/a-share-company-guidance-expectation-summaries.generated.json"
    : message.startsWith("manifest")
      ? `public/data/a-share-company-guidance-expectations/${manifestName}`
      : message.startsWith("workflow") || message.includes("workflow ")
        ? `public/data/a-share-company-guidance-expectations/${workflowIndexName}`
        : "public/data/a-share-company-guidance-expectations";
  return {
    path: pathHint,
    mismatchTypes: ["committed_validation_error"],
    expectedByteSize: null,
    actualByteSize: null,
    expectedSha256: null,
    actualSha256: null,
    firstDifference: message,
  };
}

export function readPreviousProviderDetails(paths, requiredCompanyCount = expectedCompanyCount, { validateCommitted = true } = {}) {
  if (!fs.existsSync(paths.outputDir)) return [];
  if (!fs.statSync(paths.outputDir).isDirectory()) throw new Error(`existing provider output is not a directory: ${paths.outputDir}`);
  if (validateCommitted) {
    const validation = validateCommittedCompanyGuidanceArtifacts(paths.rootPath, { expectedCompanyCount: requiredCompanyCount });
    if (validation.errors.length) throw new Error(`existing provider artifacts are invalid: ${validation.errors.join("; ")}`);
  }
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

function assertAnnouncementReleaseEpoch(sourceSummary, sourceManifest, details) {
  const epoch = sourceSummary?.generatedAt;
  if (!isStrictPreciseInstant(epoch)) throw new Error("announcement summary generatedAt must be a precise instant");
  if (sourceManifest?.generatedAt !== epoch) throw new Error(`announcement source release epoch mismatch: summary=${String(epoch)} manifest=${String(sourceManifest?.generatedAt)}`);
  const drifted = details.filter((detail) => detail?.generatedAt !== epoch).map((detail) => `${detail?.stockId ?? "<invalid>"}:${String(detail?.generatedAt)}`);
  if (drifted.length) throw new Error(`announcement detail release epoch mismatch: expected=${epoch} actual=${drifted.join(",")}`);
}

function compareArtifactFileSet(rootPath, paths) {
  const sourceManifest = readJson(paths.announcementManifestPath, "announcement manifest");
  const expected = new Set([
    manifestName,
    workflowIndexName,
    ...(sourceManifest.items ?? []).map((entry) => `${entry.stockId}.json`),
  ]);
  const actual = fs.existsSync(paths.outputDir) && fs.statSync(paths.outputDir).isDirectory()
    ? new Set(fs.readdirSync(paths.outputDir, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name))
    : new Set();
  const mismatches = [];
  for (const name of [...expected].sort()) if (!actual.has(name)) mismatches.push(fileSetMismatch(
    `public/data/a-share-company-guidance-expectations/${name}`,
    "missing_file",
    null,
  ));
  for (const name of [...actual].sort()) if (!expected.has(name)) mismatches.push(fileSetMismatch(
    `public/data/a-share-company-guidance-expectations/${name}`,
    "extra_or_orphan_file",
    fs.readFileSync(path.join(paths.outputDir, name)),
  ));
  if (!fs.existsSync(paths.summaryPath)) mismatches.push(fileSetMismatch("src/data/real/a-share-company-guidance-expectation-summaries.generated.json", "missing_file", null));
  return mismatches;
}

function fileSetMismatch(relativePath, mismatchType, actualBytes) {
  return {
    path: relativePath,
    mismatchTypes: [mismatchType],
    expectedByteSize: null,
    actualByteSize: actualBytes?.byteLength ?? null,
    expectedSha256: null,
    actualSha256: actualBytes ? sha256(actualBytes) : null,
    firstDifference: null,
  };
}

function compareCommittedArtifactBytes(expectedArtifacts, rootPath) {
  const mismatches = [];
  for (const [relativePath, expectedBytes] of expectedArtifacts) {
    const file = path.join(rootPath, ...relativePath.split("/"));
    if (!fs.existsSync(file)) {
      mismatches.push({
        path: relativePath,
        mismatchTypes: ["missing_file"],
        expectedByteSize: expectedBytes.byteLength,
        actualByteSize: null,
        expectedSha256: sha256(expectedBytes),
        actualSha256: null,
        firstDifference: null,
      });
      continue;
    }
    const actualBytes = fs.readFileSync(file);
    if (expectedBytes.equals(actualBytes)) continue;
    const mismatchTypes = ["content_mismatch"];
    if (expectedBytes.byteLength !== actualBytes.byteLength) mismatchTypes.unshift("byte_mismatch");
    if (sha256(expectedBytes) !== sha256(actualBytes)) mismatchTypes.unshift("checksum_mismatch");
    mismatches.push({
      path: relativePath,
      mismatchTypes,
      expectedByteSize: expectedBytes.byteLength,
      actualByteSize: actualBytes.byteLength,
      expectedSha256: sha256(expectedBytes),
      actualSha256: sha256(actualBytes),
      firstDifference: firstJsonDifferenceFromBytes(expectedBytes, actualBytes),
    });
  }
  return mismatches;
}

function releaseEpochMismatches(rendered, rootPath) {
  const expected = rendered.sourceSummary.generatedAt;
  const checks = [
    ["src/data/real/a-share-company-guidance-expectation-summaries.generated.json", "generatedAt", rendered.summary.generatedAt],
    ["src/data/real/a-share-company-guidance-expectation-summaries.generated.json", "sourceGeneratedAt", rendered.summary.sourceGeneratedAt],
    [`public/data/a-share-company-guidance-expectations/${manifestName}`, "generatedAt", rendered.manifest.generatedAt],
    [`public/data/a-share-company-guidance-expectations/${workflowIndexName}`, "generatedAt", rendered.workflowIndex.generatedAt],
  ];
  return checks.flatMap(([relativePath, field, expectedRendered]) => {
    let actual = null;
    try { actual = readJson(path.join(rootPath, ...relativePath.split("/")), relativePath)?.[field]; } catch { return []; }
    return actual === expected && expectedRendered === expected ? [] : [{
      path: relativePath,
      mismatchTypes: ["release_epoch_mismatch"],
      field,
      expected,
      actual,
      expectedByteSize: null,
      actualByteSize: null,
      expectedSha256: null,
      actualSha256: null,
      firstDifference: `${field}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    }];
  });
}

function firstJsonDifferenceFromBytes(expectedBytes, actualBytes) {
  try { return firstJsonDifference(JSON.parse(expectedBytes.toString("utf8")), JSON.parse(actualBytes.toString("utf8"))); }
  catch { return "json_parse_mismatch"; }
}

function firstJsonDifference(expected, actual, location = "$") {
  if (Object.is(expected, actual)) return null;
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return `${location}: type expected=${typeName(expected)} actual=${typeName(actual)}`;
    if (expected.length !== actual.length) return `${location}.length: expected=${expected.length} actual=${actual.length}`;
    for (let index = 0; index < expected.length; index += 1) {
      const difference = firstJsonDifference(expected[index], actual[index], `${location}[${index}]`);
      if (difference) return difference;
    }
    return `${location}: content differs`;
  }
  if (expected && typeof expected === "object" || actual && typeof actual === "object") {
    if (!expected || !actual || typeof expected !== "object" || typeof actual !== "object") return `${location}: type expected=${typeName(expected)} actual=${typeName(actual)}`;
    const expectedKeys = Object.keys(expected).sort();
    const actualKeys = Object.keys(actual).sort();
    const missing = expectedKeys.find((key) => !Object.hasOwn(actual, key));
    if (missing) return `${location}.${missing}: missing`;
    const extra = actualKeys.find((key) => !Object.hasOwn(expected, key));
    if (extra) return `${location}.${extra}: extra`;
    for (const key of expectedKeys) {
      const difference = firstJsonDifference(expected[key], actual[key], `${location}.${key}`);
      if (difference) return difference;
    }
    return `${location}: content differs`;
  }
  return `${location}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`;
}

function typeName(value) { return Array.isArray(value) ? "array" : value === null ? "null" : typeof value; }

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
  const dryRun = process.argv.includes("--dry-run");
  const check = process.argv.includes("--check");
  if (dryRun && check) throw new Error("--dry-run and --check are mutually exclusive");
  if (check) {
    const result = checkCommittedCompanyGuidanceArtifacts();
    console.log(JSON.stringify({ mode: "check_committed_artifacts_read_only", ...result }, null, 2));
    if (result.status !== "passed") process.exitCode = 1;
  } else {
    const result = generateCompanyGuidanceArtifacts({ dryRun });
    console.log(JSON.stringify({
      status: "passed",
      mode: dryRun ? "dry_run_generate_and_validate_only_no_committed_comparison" : "generate_and_publish",
      dryRun: result.dryRun,
      audit: result.audit,
    }, null, 2));
  }
}
