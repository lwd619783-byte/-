import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildCompanyGuidanceArtifacts,
  createWorkflowIndex,
} from "../company-guidance-expectations/core.mjs";
import {
  ARTIFACT_TRANSACTION_STAGE,
  ArtifactTransactionCleanupError,
  generateCompanyGuidanceArtifacts,
  resolveCompanyGuidancePaths,
  writeArtifactsTransaction,
} from "../generate-company-guidance-expectations.mjs";
import { validateCommittedCompanyGuidanceArtifacts } from "../validate-company-guidance-expectations.mjs";

const GENERATED_AT = "2026-07-11T07:31:40Z";
const NEXT_GENERATED_AT = "2026-07-12T07:31:40Z";

test("first generation is allowed when no previous Provider directory exists", () => withTempRoot((root) => {
  createSourceArtifacts(root, 56);
  const paths = resolveCompanyGuidancePaths(root);
  assert.equal(fs.existsSync(paths.outputDir), false);
  const result = generateCompanyGuidanceArtifacts({ rootPath: root });
  assert.equal(result.manifest.items.length, 56);
  assert.deepEqual(validateCommittedCompanyGuidanceArtifacts(root).errors, []);
}));

test("generator reads the previous Provider manifest and rejects A-to-B replacement at the same count", () => withGeneratorRoot((root) => {
  const source = sourceManifest(root);
  const removed = source.items.shift();
  const added = sourceEntry(56);
  source.items.push(added);
  writeJson(sourceManifestPath(root), source);
  writeJson(path.join(root, "public", added.relativePath), sourceDetail(56, []));
  assert.equal(source.items.length, 56);
  assert.throws(() => generateCompanyGuidanceArtifacts({ rootPath: root, dryRun: true }), new RegExp(`previous provider companies disappeared: ${removed.stockId}`, "u"));
}));

test("generator rejects deletion to 55 companies", () => withGeneratorRoot((root) => {
  const source = sourceManifest(root);
  const removed = source.items.pop();
  writeJson(sourceManifestPath(root), source);
  assert.equal(source.items.length, 55);
  assert.throws(() => generateCompanyGuidanceArtifacts({ rootPath: root, dryRun: true }), new RegExp(`previous provider companies disappeared: ${removed.stockId}`, "u"));
}));

test("generator applies the explicit 56-company product rule to addition without deletion", () => withGeneratorRoot((root) => {
  const source = sourceManifest(root);
  const added = sourceEntry(56);
  source.items.push(added);
  writeJson(sourceManifestPath(root), source);
  writeJson(path.join(root, "public", added.relativePath), sourceDetail(56, []));
  assert.equal(source.items.length, 57);
  assert.throws(() => generateCompanyGuidanceArtifacts({ rootPath: root, dryRun: true }), /expected 56 companies, got 57/u);
}));

for (const [name, mutate, expected] of [
  ["corrupt previous manifest", (root) => fs.writeFileSync(path.join(resolveCompanyGuidancePaths(root).outputDir, "manifest.generated.json"), "{broken", "utf8"), /existing provider artifacts are invalid: manifest unreadable/u],
  ["structurally invalid previous manifest", (root) => { const file = path.join(resolveCompanyGuidancePaths(root).outputDir, "manifest.generated.json"); const manifest = readJson(file); manifest.items = null; writeJson(file, manifest); }, /existing provider artifacts are invalid:.*manifest items must be an array/u],
  ["missing previous detail", (root) => fs.rmSync(path.join(resolveCompanyGuidancePaths(root).outputDir, "company-55.json")), /existing provider artifacts are invalid:.*missing detail: company-55/u],
  ["mismatched previous detail identity", (root) => { const file = path.join(resolveCompanyGuidancePaths(root).outputDir, "company-55.json"); const detail = readJson(file); detail.stockId = "wrong-company"; writeJson(file, detail); }, /existing provider artifacts are invalid:.*identity mismatch: company-55/u],
]) test(`generator fails closed on ${name}`, () => withGeneratorRoot((root) => {
  mutate(root);
  assert.throws(() => generateCompanyGuidanceArtifacts({ rootPath: root, dryRun: true }), expected);
}));

test("A-to-B-to-A extraction corrections keep a linear event identity chain", () => withTempRoot((root) => {
  const initial = buildSingle([announcement()]);
  const correctedB = buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, [announcement({ lowerBound: 120, upperBound: 220 })])], sourceGeneratedAt: NEXT_GENERATED_AT, previousDetails: initial.companies });
  const correctedA = buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, [announcement()])], sourceGeneratedAt: "2026-07-13T07:31:40Z", previousDetails: correctedB.companies });
  const a1 = initial.companies[0].providerSnapshots[0];
  const b = correctedB.companies[0].providerSnapshots[0];
  const a2 = correctedA.companies[0].providerSnapshots[0];
  assert.equal(a1.providerContentChecksum, a2.providerContentChecksum);
  assert.notEqual(a1.providerSnapshotVersionId, a2.providerSnapshotVersionId);
  assert.notEqual(b.providerSnapshotVersionId, a2.providerSnapshotVersionId);
  assert.equal(b.providerCorrectsVersionId, a1.providerSnapshotVersionId);
  assert.equal(a2.providerCorrectsVersionId, b.providerSnapshotVersionId);
  assert.deepEqual(correctedA.companies[0].historicalProviderVersions.map((record) => record.providerSnapshotVersionId).sort(), [a1.providerSnapshotVersionId, b.providerSnapshotVersionId].sort());
  const noOp = buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, [announcement()])], sourceGeneratedAt: "2026-07-20T07:31:40Z", previousDetails: correctedA.companies });
  assert.equal(noOp.companies[0].providerSnapshots[0].providerSnapshotVersionId, a2.providerSnapshotVersionId);
  assert.equal(noOp.companies[0].historicalProviderVersions.length, 2);
  writeBundle(root, correctedA, 1);
  assert.deepEqual(validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors, []);
}));

for (const [name, stage] of [
  ["old directory backup failure", ARTIFACT_TRANSACTION_STAGE.OLD_DIRECTORY_BACKUP],
  ["staging directory activation failure", ARTIFACT_TRANSACTION_STAGE.NEW_DIRECTORY_ACTIVATION],
  ["old summary backup failure", ARTIFACT_TRANSACTION_STAGE.OLD_SUMMARY_BACKUP],
  ["new summary activation failure", ARTIFACT_TRANSACTION_STAGE.NEW_SUMMARY_ACTIVATION],
]) test(`artifact transaction rolls back byte-for-byte after ${name}`, () => withTempRoot((root) => {
  const bundle = bundleForOneCompany();
  const paths = resolveCompanyGuidancePaths(root);
  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(paths.summaryPath), { recursive: true });
  fs.writeFileSync(path.join(paths.outputDir, "old-marker.bin"), Buffer.from([0, 1, 2, 255]));
  fs.writeFileSync(paths.summaryPath, Buffer.from("old-summary\u0000bytes"));
  const oldDirectoryDigest = directoryDigest(paths.outputDir);
  const oldSummary = fs.readFileSync(paths.summaryPath);
  assert.throws(() => writeArtifactsTransaction({ ...bundle, rootPath: root, outputDir: paths.outputDir, summaryPath: paths.summaryPath, expectedCompanyCount: 1, hooks: { beforeStage(current) { if (current === stage) throw new Error(`injected ${stage}`); } } }), new RegExp(`injected ${stage}`, "u"));
  assert.equal(directoryDigest(paths.outputDir), oldDirectoryDigest);
  assert.deepEqual(fs.readFileSync(paths.summaryPath), oldSummary);
  assert.equal(transactionResidue(root).length, 0);
}));

test("final backup cleanup failure keeps the committed artifacts internally consistent and reports cleanup paths", () => withTempRoot((root) => {
  const bundle = bundleForOneCompany();
  const paths = resolveCompanyGuidancePaths(root);
  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(paths.summaryPath), { recursive: true });
  fs.writeFileSync(path.join(paths.outputDir, "old.json"), "{}", "utf8");
  fs.writeFileSync(paths.summaryPath, "{}", "utf8");
  assert.throws(() => writeArtifactsTransaction({ ...bundle, rootPath: root, outputDir: paths.outputDir, summaryPath: paths.summaryPath, expectedCompanyCount: 1, hooks: { beforeStage(current) { if (current === ARTIFACT_TRANSACTION_STAGE.BACKUP_CLEANUP) throw new Error("injected cleanup failure"); } } }), (error) => {
    assert.ok(error instanceof ArtifactTransactionCleanupError);
    assert.equal(error.transactionState.committed, true);
    assert.ok(error.cleanupPaths.length > 0);
    return true;
  });
  assert.deepEqual(validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors, []);
}));

test("offline validator rejects orphan JSON", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  fs.writeFileSync(path.join(resolveCompanyGuidancePaths(root).outputDir, "orphan.json"), "{}", "utf8");
  assert.ok(validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors.includes("unexpected provider json: orphan.json"));
}));

test("offline validator rejects duplicate manifest identities", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const manifestPath = path.join(resolveCompanyGuidancePaths(root).outputDir, "manifest.generated.json");
  const manifest = readJson(manifestPath);
  manifest.items.push(structuredClone(manifest.items[0]));
  manifest.totalCompanies = 2;
  manifest.totalSnapshots = 2;
  writeJson(manifestPath, manifest);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 2 }).errors;
  assert.ok(errors.some((error) => error.startsWith("duplicate manifest stockId:")));
  assert.ok(errors.some((error) => error.startsWith("duplicate manifest stockCode:")));
  assert.ok(errors.some((error) => error.startsWith("duplicate manifest relativePath:")));
}));

test("offline validator rejects missing and extra summary items", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  delete summary.items["company-00"];
  summary.items.ghost = { stockId: "ghost" };
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("summary stockId missing: company-00"));
  assert.ok(errors.includes("summary stockId extra: ghost"));
}));

function withGeneratorRoot(run) {
  return withTempRoot((root) => {
    createSourceArtifacts(root, 56);
    generateCompanyGuidanceArtifacts({ rootPath: root });
    return run(root);
  });
}

function withTempRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "company-guidance-integrity-"));
  try { return run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function createSourceArtifacts(root, count) {
  const summaryFile = path.join(root, "src/data/real/a-share-announcement-summaries.generated.json");
  const manifestFile = sourceManifestPath(root);
  fs.mkdirSync(path.dirname(summaryFile), { recursive: true });
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  writeJson(summaryFile, { generatedAt: GENERATED_AT });
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const entry = sourceEntry(index);
    items.push(entry);
    writeJson(path.join(root, "public", entry.relativePath), sourceDetail(index, index === 0 ? [announcement()] : []));
  }
  writeJson(manifestFile, { items });
}

function sourceEntry(index) {
  const stockId = `company-${String(index).padStart(2, "0")}`;
  return { stockId, stockCode: String(index).padStart(6, "0"), relativePath: `data/a-share-announcements/${stockId}.json` };
}
function sourceManifestPath(root) { return path.join(root, "public/data/a-share-announcements/manifest.generated.json"); }
function sourceManifest(root) { return readJson(sourceManifestPath(root)); }
function sourceDetail(index, announcements) { return { stockId: `company-${String(index).padStart(2, "0")}`, stockCode: String(index).padStart(6, "0"), companyName: `Company ${index}`, announcements }; }

function announcement({ lowerBound = 100, upperBound = 200 } = {}) {
  return {
    announcementId: "9000001",
    title: "2025 annual earnings preview",
    category: "performance_forecast",
    announcementDate: "2026-01-15",
    reportPeriod: "2025-12-31",
    officialUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=9000001",
    pdfUrl: "https://static.cninfo.com.cn/finalpage/2026-01-15/9000001.PDF",
    parseStatus: "parse_success",
    isCancelled: false,
    isDuplicate: false,
    duplicateOf: null,
    isCorrection: false,
    correctedAnnouncementId: null,
    performanceForecastEvents: [{ forecastPeriod: "2025-12-31", forecastType: "increase", profitMetric: "netProfitAttributableToParent", lowerBound, upperBound, extractionConfidence: "high", sourceTextEvidence: `forecast ${lowerBound}-${upperBound} yuan`, previousForecastAnnouncementId: null }],
  };
}

function buildSingle(announcements) { return buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, announcements)], sourceGeneratedAt: GENERATED_AT }); }

function bundleForOneCompany() { return createBundle(buildSingle([announcement()])); }
function createBundle(result) {
  const renderedDetails = new Map(result.companies.map((company) => [company.stockId, renderJson(company)]));
  const workflow = createWorkflowIndex(result.companies, result.summary.generatedAt);
  const renderedWorkflowIndex = renderJson(workflow);
  const manifest = {
    schemaVersion: result.summary.schemaVersion,
    providerId: result.summary.providerId,
    providerVersion: result.summary.providerVersion,
    generatedAt: result.summary.generatedAt,
    totalCompanies: result.companies.length,
    companiesWithSnapshots: result.audit.reliableCompanyCount,
    totalSnapshots: result.audit.reliableSnapshotCount,
    totalHistoricalVersions: result.audit.historicalVersionCount,
    workflowIndexRelativePath: "data/a-share-company-guidance-expectations/workflow-index.generated.json",
    workflowIndexByteSize: Buffer.byteLength(renderedWorkflowIndex),
    workflowIndexChecksumSha256: sha256(renderedWorkflowIndex),
    items: result.companies.map((company) => {
      const content = renderedDetails.get(company.stockId);
      return { stockId: company.stockId, stockCode: company.stockCode, companyName: company.companyName, relativePath: `data/a-share-company-guidance-expectations/${company.stockId}.json`, snapshotCount: company.providerSnapshots.length, historicalVersionCount: company.historicalProviderVersions.length, excludedAnnouncementCount: 0, byteSize: Buffer.byteLength(content), checksumSha256: sha256(content), latestReportPeriod: "2025-12-31", latestSourceDate: "2026-01-15", status: company.status };
    }),
  };
  result.summary.workflowIndex = { relativePath: manifest.workflowIndexRelativePath, byteSize: manifest.workflowIndexByteSize, checksumSha256: manifest.workflowIndexChecksumSha256, currentSnapshotCount: workflow.currentSnapshotCount };
  return { summary: result.summary, manifest, renderedDetails, renderedWorkflowIndex };
}
function writeBundle(root, result, companyCount) {
  const paths = resolveCompanyGuidancePaths(root);
  writeArtifactsTransaction({ ...createBundle(result), rootPath: root, outputDir: paths.outputDir, summaryPath: paths.summaryPath, expectedCompanyCount: companyCount });
}

function directoryDigest(directory) {
  const hash = crypto.createHash("sha256");
  for (const file of listFiles(directory)) { hash.update(path.relative(directory, file).replaceAll("\\", "/")); hash.update(fs.readFileSync(file)); }
  return hash.digest("hex");
}
function listFiles(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? listFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]).sort(); }
function transactionResidue(root) { const publicData = path.join(root, "public/data"); return fs.existsSync(publicData) ? fs.readdirSync(publicData).filter((name) => name.includes("staging") || name.includes("backup")) : []; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, renderJson(value), "utf8"); }
function renderJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
