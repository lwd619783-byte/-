import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCommittedCompanyGuidanceArtifacts } from "../generate-company-guidance-expectations.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("committed-artifact check passes byte-for-byte without writing", () => withCommittedRoot((root) => {
  const before = treeDigest(root);
  const result = checkCommittedCompanyGuidanceArtifacts({ rootPath: root });
  assert.equal(result.status, "passed");
  assert.equal(result.expectedFileCount, 59);
  assert.deepEqual(result.mismatches, []);
  assert.equal(treeDigest(root), before);
}));

test("committed-artifact check rejects an upstream-only release epoch", () => withCommittedRoot((root) => {
  const file = path.join(root, "src/data/real/a-share-announcement-summaries.generated.json");
  const summary = readJson(file); summary.generatedAt = "2026-07-12T07:31:40Z"; writeJson(file, summary);
  assert.throws(() => checkCommittedCompanyGuidanceArtifacts({ rootPath: root }), /announcement source release epoch mismatch/u);
}));

for (const [label, mutate] of [
  ["lowerBound/upperBound", ({ announcement }) => { announcement.performanceForecastEvents[0].lowerBound += 1; announcement.performanceForecastEvents[0].upperBound += 1; }],
  ["sourceTextEvidence", ({ announcement }) => { announcement.performanceForecastEvents[0].sourceTextEvidence += "（重新解析）"; }],
  ["title", ({ announcement }) => { announcement.title += "（更正标题）"; }],
  ["companyName", ({ sourceDetail }) => { sourceDetail.companyName += "（新名称）"; }],
  ["stockCode", ({ sourceDetail, sourceEntry }) => { sourceDetail.stockCode = "999999"; sourceEntry.stockCode = "999999"; }],
  ["parseStatus", ({ announcement }) => { announcement.parseStatus = announcement.parseStatus === "parse_success" ? "parse_partial" : "parse_success"; }],
  ["reportPeriod", ({ announcement }) => { announcement.reportPeriod = "2026-06-30"; announcement.performanceForecastEvents[0].forecastPeriod = "2026-06-30"; }],
  ["corrected announcement references", ({ announcement }) => { announcement.correctedAnnouncementId = "9999999999"; announcement.performanceForecastEvents[0].previousForecastAnnouncementId = "9999999999"; }],
]) {
  test(`committed-artifact check rejects stale Provider after upstream ${label} changes`, () => withCommittedRoot((root) => {
    const context = reliableSourceContext(root);
    mutate(context);
    writeJson(context.sourceDetailPath, context.sourceDetail);
    writeJson(context.sourceManifestPath, context.sourceManifest);
    assertCheckFails(root);
  }));
}

test("committed-artifact check rejects a re-signed Provider sourceTitle edit", () => withCommittedRoot((root) => {
  const manifest = readJson(providerManifestPath(root));
  const entry = manifest.items.find((item) => item.snapshotCount > 0);
  mutateProviderDetailAndResign(root, (detail) => { detail.providerSnapshots[0].snapshot.sourceTitle += "（手工改写）"; }, entry.stockId);
  const result = checkCommittedCompanyGuidanceArtifacts({ rootPath: root });
  assert.equal(result.status, "failed");
  assert.ok(result.mismatches.some((item) => item.path.endsWith(`${entry.stockId}.json`) && item.mismatchTypes.includes("content_mismatch")));
}));

test("committed-artifact check rejects a fully re-signed Provider sourceTextEvidence edit", () => withCommittedRoot((root) => {
  const manifestPath = providerManifestPath(root);
  const manifest = readJson(manifestPath);
  const entry = manifest.items.find((item) => item.snapshotCount > 0 && item.historicalVersionCount === 0);
  const detailPath = path.join(root, "public", ...entry.relativePath.split("/"));
  const detail = readJson(detailPath);
  const record = detail.providerSnapshots.find((item) => item.providerCorrectionType === "initial");
  const oldVersionId = record.providerSnapshotVersionId;
  record.sourceTextEvidence += "（手工重签）";
  record.sourceTextEvidenceHash = sha256(record.sourceTextEvidence);
  resignProviderRecord(record);
  writeProviderDetailAndManifest(detailPath, detail, entry, manifestPath, manifest);

  const workflowPath = path.join(root, "public/data/a-share-company-guidance-expectations/workflow-index.generated.json");
  const workflow = readJson(workflowPath);
  const index = workflow.records.findIndex((item) => item.providerSnapshotVersionId === oldVersionId);
  const { sourceTextEvidence: _sourceTextEvidence, originalUnitEvidence: _originalUnitEvidence, ...workflowRecord } = structuredClone(record);
  workflow.records[index] = workflowRecord;
  const workflowBytes = Buffer.from(renderJson(workflow));
  fs.writeFileSync(workflowPath, workflowBytes);
  manifest.workflowIndexByteSize = workflowBytes.byteLength;
  manifest.workflowIndexChecksumSha256 = sha256(workflowBytes);
  writeJson(manifestPath, manifest);
  const summaryPath = path.join(root, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
  const summary = readJson(summaryPath);
  summary.workflowIndex.byteSize = manifest.workflowIndexByteSize;
  summary.workflowIndex.checksumSha256 = manifest.workflowIndexChecksumSha256;
  writeJson(summaryPath, summary);
  assertCheckFails(root);
}));

test("committed-artifact check rejects a jointly re-signed future createdAt attack", () => withCommittedRoot((root) => {
  const manifestPath = providerManifestPath(root);
  const manifest = readJson(manifestPath);
  const entry = manifest.items.find((item) => item.snapshotCount > 0);
  const detailPath = path.join(root, "public", ...entry.relativePath.split("/"));
  const detail = readJson(detailPath);
  const detailRecord = detail.providerSnapshots.find((record) => record.providerCorrectionType === "initial");
  detailRecord.snapshot.createdAt = "2030-01-01T00:00:00Z";
  writeProviderDetailAndManifest(detailPath, detail, entry, manifestPath, manifest);

  const workflowPath = path.join(root, "public/data/a-share-company-guidance-expectations/workflow-index.generated.json");
  const workflow = readJson(workflowPath);
  const workflowRecord = workflow.records.find((record) => record.providerSnapshotVersionId === detailRecord.providerSnapshotVersionId);
  workflowRecord.snapshot.createdAt = detailRecord.snapshot.createdAt;
  const workflowBytes = Buffer.from(renderJson(workflow));
  fs.writeFileSync(workflowPath, workflowBytes);
  manifest.workflowIndexByteSize = workflowBytes.byteLength;
  manifest.workflowIndexChecksumSha256 = sha256(workflowBytes);
  writeJson(manifestPath, manifest);

  const summaryPath = path.join(root, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
  const summary = readJson(summaryPath);
  summary.workflowIndex.byteSize = manifest.workflowIndexByteSize;
  summary.workflowIndex.checksumSha256 = manifest.workflowIndexChecksumSha256;
  writeJson(summaryPath, summary);

  let failure = "";
  try {
    const result = checkCommittedCompanyGuidanceArtifacts({ rootPath: root });
    failure = JSON.stringify(result.mismatches);
    assert.equal(result.status, "failed");
  } catch (error) { failure = String(error); }
  assert.match(failure, /provider_snapshot_creation_chronology/u);
}));

test("committed-artifact check rejects a re-signed Provider originalUnitEvidence deletion", () => withCommittedRoot((root) => {
  const manifest = readJson(providerManifestPath(root));
  const entry = manifest.items.find((item) => item.snapshotCount > 0);
  mutateProviderDetailAndResign(root, (detail) => { delete detail.providerSnapshots[0].originalUnitEvidence; }, entry.stockId);
  assertCheckFails(root);
}));

test("committed-artifact check rejects re-signed exclusion and warning deletions", () => withCommittedRoot((root) => {
  const manifest = readJson(providerManifestPath(root));
  const exclusionEntry = manifest.items.find((item) => item.excludedAnnouncementCount > 0);
  mutateProviderDetailAndResign(root, (detail) => { detail.exclusions[0].reasons = detail.exclusions[0].reasons.slice(1); }, exclusionEntry.stockId);
  assertCheckFails(root);
}));

test("committed-artifact check rejects a re-signed revision_without_reliable_range warning deletion", () => withCommittedRoot((root) => {
  const manifest = readJson(providerManifestPath(root));
  const entry = manifest.items.find((item) => {
    const detail = readJson(path.join(root, "public", ...item.relativePath.split("/")));
    return detail.warnings.some((warning) => warning.code === "revision_without_reliable_range");
  });
  assert.ok(entry);
  mutateProviderDetailAndResign(root, (detail) => { detail.warnings = detail.warnings.filter((warning) => warning.code !== "revision_without_reliable_range"); }, entry.stockId);
  assertCheckFails(root);
}));

test("committed-artifact check reports missing and extra Provider JSON", () => withCommittedRoot((root) => {
  const manifest = readJson(providerManifestPath(root));
  const detail = manifest.items[0].relativePath;
  fs.rmSync(path.join(root, "public", ...detail.split("/")));
  fs.writeFileSync(path.join(root, "public/data/a-share-company-guidance-expectations/orphan.json"), "{}\n", "utf8");
  const result = checkCommittedCompanyGuidanceArtifacts({ rootPath: root });
  assert.equal(result.checked, false);
  assert.ok(result.mismatches.some((item) => item.mismatchTypes.includes("missing_file") && item.path.endsWith(`${manifest.items[0].stockId}.json`)));
  assert.ok(result.mismatches.some((item) => item.mismatchTypes.includes("extra_or_orphan_file") && item.path.endsWith("orphan.json")));
}));

test("committed-artifact check reverse-enumerates an extra Provider JSON while still rebuilding", () => withCommittedRoot((root) => {
  fs.writeFileSync(path.join(root, "public/data/a-share-company-guidance-expectations/orphan.json"), "{}\n", "utf8");
  const result = checkCommittedCompanyGuidanceArtifacts({ rootPath: root });
  assert.equal(result.checked, true);
  assert.equal(result.expectedFileCount, 59);
  assert.ok(result.mismatches.some((item) => item.mismatchTypes.includes("extra_or_orphan_file") && item.path.endsWith("orphan.json")));
}));

test("committed-artifact check reports expected bytes for a missing derived workflow", () => withCommittedRoot((root) => {
  const workflowPath = path.join(root, "public/data/a-share-company-guidance-expectations/workflow-index.generated.json");
  fs.rmSync(workflowPath);
  const result = checkCommittedCompanyGuidanceArtifacts({ rootPath: root });
  assert.equal(result.checked, true);
  const mismatch = result.mismatches.find((item) => item.mismatchTypes.includes("missing_file") && item.path.endsWith("workflow-index.generated.json"));
  assert.ok(mismatch);
  assert.equal(mismatch.expectedByteSize, 240254);
  assert.equal(mismatch.expectedSha256, "a883ab1bee7da4e2bb7302445f0fa94f45bd39d190fa3060877a12e2c6db5676");
}));

function reliableSourceContext(root) {
  const providerManifest = readJson(providerManifestPath(root));
  const providerEntry = providerManifest.items.find((item) => item.snapshotCount > 0);
  const sourceManifestPath = path.join(root, "public/data/a-share-announcements/manifest.generated.json");
  const sourceManifest = readJson(sourceManifestPath);
  const sourceEntry = sourceManifest.items.find((item) => item.stockId === providerEntry.stockId);
  const sourceDetailPath = path.join(root, "public", ...sourceEntry.relativePath.split("/"));
  const sourceDetail = readJson(sourceDetailPath);
  const announcement = sourceDetail.announcements.find((item) => Array.isArray(item.performanceForecastEvents) && item.performanceForecastEvents.length > 0);
  assert.ok(announcement);
  return { sourceManifestPath, sourceManifest, sourceEntry, sourceDetailPath, sourceDetail, announcement };
}

function mutateProviderDetailAndResign(root, mutate, stockId = null) {
  const manifestPath = providerManifestPath(root);
  const manifest = readJson(manifestPath);
  const entry = stockId ? manifest.items.find((item) => item.stockId === stockId) : manifest.items.find((item) => item.snapshotCount > 0);
  const detailPath = path.join(root, "public", ...entry.relativePath.split("/"));
  const detail = readJson(detailPath);
  mutate(detail);
  writeProviderDetailAndManifest(detailPath, detail, entry, manifestPath, manifest);
}

function writeProviderDetailAndManifest(detailPath, detail, entry, manifestPath, manifest) {
  const detailBytes = Buffer.from(renderJson(detail));
  fs.writeFileSync(detailPath, detailBytes);
  entry.byteSize = detailBytes.byteLength;
  entry.checksumSha256 = sha256(detailBytes);
  writeJson(manifestPath, manifest);
}

function resignProviderRecord(record) {
  const projection = {
    providerEvidenceIdentity: record.providerEvidenceIdentity,
    estimateShape: record.snapshot.estimateShape,
    value: record.snapshot.value,
    lowerBound: record.snapshot.lowerBound,
    upperBound: record.snapshot.upperBound,
    currency: record.snapshot.currency,
    unit: record.snapshot.unit,
    accountingBasis: record.snapshot.accountingBasis,
    sourcePublishedAt: record.snapshot.sourcePublishedAt,
    sourceTextEvidenceHash: record.sourceTextEvidenceHash,
    providerParseRulesVersion: record.providerParseRulesVersion,
  };
  const checksum = sha256(canonicalJson(projection));
  const versionId = record.providerCorrectsVersionId
    ? `company-guidance-version-${sha256(canonicalJson({ providerEvidenceIdentity: record.providerEvidenceIdentity, providerCorrectsVersionId: record.providerCorrectsVersionId, providerContentChecksum: checksum }))}`
    : `company-guidance-version-${checksum}`;
  record.providerContentChecksum = checksum;
  record.providerSnapshotVersionId = versionId;
  record.artifactChecksum = checksum;
  Object.assign(record.snapshot, { id: versionId, providerContentChecksum: checksum, providerSnapshotVersionId: versionId, artifactChecksum: checksum });
}

function assertCheckFails(root) {
  try {
    const result = checkCommittedCompanyGuidanceArtifacts({ rootPath: root });
    assert.equal(result.status, "failed");
    assert.ok(result.mismatches.length > 0);
  } catch (error) {
    assert.match(String(error), /mismatch|disappeared|invalid|source-backed|release epoch/u);
  }
}

function withCommittedRoot(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "company-guidance-check-"));
  try {
    copyFile("src/data/real/a-share-announcement-summaries.generated.json", root);
    copyDirectory("public/data/a-share-announcements", root);
    copyFile("src/data/real/a-share-company-guidance-expectation-summaries.generated.json", root);
    copyDirectory("public/data/a-share-company-guidance-expectations", root);
    return run(root);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function copyFile(relativePath, root) {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, ...relativePath.split("/")), target);
}
function copyDirectory(relativePath, root) {
  const target = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, ...relativePath.split("/")), target, { recursive: true });
}
function providerManifestPath(root) { return path.join(root, "public/data/a-share-company-guidance-expectations/manifest.generated.json"); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, renderJson(value), "utf8"); }
function renderJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function treeDigest(root) { const hash = crypto.createHash("sha256"); for (const file of listFiles(root)) { hash.update(path.relative(root, file).replaceAll("\\", "/")); hash.update(fs.readFileSync(file)); } return hash.digest("hex"); }
function listFiles(directory) { return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? listFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]).sort(); }
