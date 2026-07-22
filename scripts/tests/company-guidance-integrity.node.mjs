import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildCompanyGuidanceArtifacts,
  computeProviderContentChecksum,
  createWorkflowIndex,
  deriveCompanyGuidanceDetailStatus,
  deriveCompanyGuidanceManifestMetadata,
  expectedProviderSnapshotVersionId,
  stableProviderEvidenceIdentity,
  validateCompanyGuidanceDetail,
  validateProviderRecord,
} from "../company-guidance-expectations/core.mjs";
import {
  classifyCompanyGuidanceProviderRecordErrors,
  validateCompanyGuidanceCorrectionGraph,
  validateCompanyGuidanceProviderRecordContract,
} from "../../src/services/companyGuidanceExpectationRecordContract.mjs";
import {
  classifyCompanyGuidanceDetailContractErrors,
  deriveCompanyGuidanceDetailStatus as deriveRuntimeCompanyGuidanceDetailStatus,
  selectDefaultCompanyGuidanceStockIds,
  validateCompanyGuidanceDetailContract,
} from "../../src/services/companyGuidanceExpectationSelection.mjs";
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
  createSourceReferenceArtifacts(root, bundle);
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
  createSourceReferenceArtifacts(root, bundle);
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

for (const [field, wrongValue] of [
  ["status", "missing"],
  ["excludedAnnouncementCount", 1],
  ["latestReportPeriod", "2024-12-31"],
  ["latestSourceDate", "2026-01-14"],
  ["historicalVersionCount", 1],
]) test(`offline validator rejects manifest ${field} drift from detail`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const manifestPath = path.join(resolveCompanyGuidancePaths(root).outputDir, "manifest.generated.json");
  const manifest = readJson(manifestPath);
  manifest.items[0][field] = wrongValue;
  writeJson(manifestPath, manifest);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.some((error) => error.startsWith(`manifest derived field mismatch: company-00.${field} `)), errors.join("\n"));
}));

for (const [field, wrongValue] of [
  ["status", "missing"],
  ["snapshotCount", 2],
  ["latestReportPeriod", "2024-12-31"],
  ["latestSourceDate", "2026-01-14"],
  ["detailPath", "data/a-share-company-guidance-expectations/wrong-company.json"],
]) test(`offline validator rejects summary ${field} drift from detail`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  summary.items["company-00"][field] = wrongValue;
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.some((error) => error.startsWith(`summary derived field mismatch: company-00.${field} `)), errors.join("\n"));
}));

for (const [field, wrongValue] of [
  ["generatedAt", "2026-07-10T07:31:40Z"],
  ["sourceGeneratedAt", "2026-07-10T07:31:40Z"],
  ["status", "partial"],
]) test(`offline validator rejects summary global ${field} drift`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  summary[field] = wrongValue;
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes(`summary global field mismatch: ${field}`), errors.join("\n"));
}));

for (const [field, mutate] of [
  ["workflowIndex.checksumSha256", (summary) => { summary.workflowIndex.checksumSha256 = "0".repeat(64); }],
  ["workflowIndex.byteSize", (summary) => { summary.workflowIndex.byteSize += 1; }],
  ["workflowIndex.currentSnapshotCount", (summary) => { summary.workflowIndex.currentSnapshotCount += 1; }],
]) test(`offline validator rejects summary global ${field} drift`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  mutate(summary);
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes(`summary global field mismatch: ${field}`), errors.join("\n"));
}));

test("exclusion-only company stays in the default load set and corrupted summary fails closed", () => withTempRoot((root) => {
  const result = buildMixedProviderBundle();
  assert.deepEqual(selectDefaultCompanyGuidanceStockIds(result.summary.items), ["company-00", "company-01"]);
  assert.equal(result.summary.items["company-01"].snapshotCount, 0);
  assert.equal(result.summary.items["company-01"].excludedAnnouncementCount, 1);
  writeBundle(root, result, 2);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  summary.items["company-01"].excludedAnnouncementCount = 0;
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 2 }).errors;
  assert.ok(errors.some((error) => error.startsWith("summary derived field mismatch: company-01.excludedAnnouncementCount ")), errors.join("\n"));
}));

test("Node and runtime detail status contracts agree on all four product states", () => {
  for (const [detail, expected] of [
    [buildSingle([announcement()]).companies[0], "generated_real"],
    [buildSingle([partialMetricAnnouncement()]).companies[0], "partial"],
    [buildSingle([excludedAnnouncement()]).companies[0], "partial"],
    [buildSingle([]).companies[0], "missing"],
  ]) {
    assert.equal(deriveCompanyGuidanceDetailStatus(detail), expected);
    assert.equal(deriveRuntimeCompanyGuidanceDetailStatus(detail), expected);
  }
  const malformed = structuredClone(buildSingle([announcement()]).companies[0]);
  malformed.targetAnnouncements.push({});
  assert.throws(() => deriveCompanyGuidanceDetailStatus(malformed), /detail_target_contract/u);
  assert.throws(() => deriveRuntimeCompanyGuidanceDetailStatus(malformed), /detail_target_contract/u);
});

test("offline validator rejects detail status drift with current snapshots and no exclusions", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.status = "partial"; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_status"), errors.join("\n"));
}));

test("offline validator rejects detail quality status drift", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.quality.status = "partial"; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_quality_status"), errors.join("\n"));
}));

test("offline validator rejects missing status when target announcements exist without current snapshots", () => withTempRoot((root) => {
  writeBundle(root, buildStatusMatrixBundle(), 3);
  mutateCommittedDetail(root, "company-01", (detail) => { detail.status = "missing"; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 3 }).errors;
  assert.ok(errors.includes("company-01:detail_status"), errors.join("\n"));
}));

test("offline validator rejects partial status when neither current nor target announcements exist", () => withTempRoot((root) => {
  writeBundle(root, buildStatusMatrixBundle(), 3);
  mutateCommittedDetail(root, "company-02", (detail) => { detail.status = "partial"; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 3 }).errors;
  assert.ok(errors.includes("company-02:detail_status"), errors.join("\n"));
}));

test("offline validator rejects quality updatedAt drift", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.quality.updatedAt = NEXT_GENERATED_AT; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_quality_contract"), errors.join("\n"));
}));

for (const [name, mutate, expectedCode] of [
  ["generatedAt without an explicit offset", (detail) => { detail.generatedAt = "2026-07-11T07:31:40"; detail.quality.updatedAt = detail.generatedAt; }, "detail_generation_epoch"],
  ["quality source drift", (detail) => { detail.quality.source = "Other"; }, "detail_quality_contract"],
  ["quality sourceLayer drift", (detail) => { detail.quality.sourceLayer = "other_layer"; }, "detail_quality_contract"],
]) test(`offline validator rejects ${name}`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", mutate);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes(`company-00:${expectedCode}`), errors.join("\n"));
}));

test("offline validator rejects a jointly corrupted detail, manifest and summary status", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const artifact = mutateCommittedDetail(root, "company-00", (detail) => { detail.status = "partial"; detail.quality.status = "partial"; });
  artifact.manifest.items[0].status = "partial";
  writeJson(artifact.manifestPath, artifact.manifest);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  summary.items["company-00"].status = "partial";
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_status"), errors.join("\n"));
  assert.ok(errors.includes("company-00:detail_quality_status"), errors.join("\n"));
  assert.ok(errors.some((error) => error.startsWith("manifest derived field mismatch: company-00.status ")), errors.join("\n"));
  assert.ok(errors.some((error) => error.startsWith("summary derived field mismatch: company-00.status ")), errors.join("\n"));
}));

for (const [collection, expectedCode] of [["exclusions", "detail_exclusion_contract"], ["targetAnnouncements", "detail_target_contract"]]) {
  test(`offline validator rejects an empty object injected into ${collection} after all status/checksum claims are updated`, () => withTempRoot((root) => {
    writeBundle(root, buildSingle([announcement()]), 1);
    const artifact = mutateCommittedDetail(root, "company-00", (detail) => {
      detail[collection].push({});
      if (collection === "targetAnnouncements") detail.totalAnnouncementCount += 1;
      detail.status = "partial";
      detail.quality.status = "partial";
    });
    artifact.manifest.items[0].status = "partial";
    writeJson(artifact.manifestPath, artifact.manifest);
    const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
    const summary = readJson(summaryPath);
    summary.items["company-00"].status = "partial";
    summary.status = "partial";
    writeJson(summaryPath, summary);
    const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
    assert.ok(errors.includes(`company-00:${expectedCode}`), errors.join("\n"));
  }));
}

test("offline validator rejects a snapshot whose target announcement was removed", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.targetAnnouncements = []; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_snapshot_orphan"), errors.join("\n"));
}));

test("offline validator rejects deletion of a real partial-metric exclusion even after generated-real claims are synchronized", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([partialMetricAnnouncement()]), 1);
  const artifact = mutateCommittedDetail(root, "company-00", (detail) => {
    detail.exclusions = [];
    detail.status = "generated_real";
    detail.quality.status = "generated_real";
  });
  Object.assign(artifact.manifest.items[0], { status: "generated_real", excludedAnnouncementCount: 0 });
  writeJson(artifact.manifestPath, artifact.manifest);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  Object.assign(summary.items["company-00"], { status: "generated_real", excludedAnnouncementCount: 0 });
  summary.status = "generated_real";
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_status"), errors.join("\n"));
}));

test("offline validator rejects an orphan exclusion", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([partialMetricAnnouncement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { const orphan = structuredClone(detail.exclusions[0]); orphan.sourceAnnouncementId = "9999999"; detail.exclusions.push(orphan); });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_exclusion_orphan"), errors.join("\n"));
}));

test("offline validator rejects an orphan snapshot", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { const orphan = structuredClone(detail.providerSnapshots[0]); orphan.sourceAnnouncementId = "9999999"; orphan.snapshot.sourceAnnouncementId = "9999999"; detail.providerSnapshots.push(orphan); });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_snapshot_orphan"), errors.join("\n"));
}));

test("offline validator rejects duplicate target announcement IDs", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.targetAnnouncements.push(structuredClone(detail.targetAnnouncements[0])); detail.totalAnnouncementCount += 1; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_target_duplicate"), errors.join("\n"));
}));

for (const [field, mutate] of [
  ["sourceAnnouncementId", (target) => { target.sourceAnnouncementId = ""; }],
  ["sourceAnnouncementType", (target) => { target.sourceAnnouncementType = "unsupported"; }],
  ["sourceDate", (target) => { target.sourceDate = "2026-02-30"; }],
  ["reportPeriod", (target) => { target.reportPeriod = "2025-02-30"; }],
  ["periodScope", (target) => { target.periodScope = "half_year"; }],
  ["parseStatus", (target) => { target.parseStatus = "unknown"; }],
  ["isDuplicate", (target) => { target.isDuplicate = "false"; }],
]) test(`offline validator rejects invalid target ${field}`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => mutate(detail.targetAnnouncements[0]));
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_target_contract"), errors.join("\n"));
}));

for (const [label, build, mutate] of [
  ["target", () => buildSingle([announcement()]), (detail) => { detail.targetAnnouncements[0].stockId = "other"; }],
  ["exclusion", () => buildSingle([partialMetricAnnouncement()]), (detail) => { detail.exclusions[0].stockId = "other"; }],
  ["snapshot", () => buildSingle([announcement()]), (detail) => { detail.providerSnapshots[0].snapshot.stockId = "other"; }],
]) test(`offline validator rejects ${label} stockId projection mismatch`, () => withTempRoot((root) => {
  writeBundle(root, build(), 1);
  mutateCommittedDetail(root, "company-00", mutate);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_projection_mismatch"), errors.join("\n"));
}));

for (const [field, mutate] of [
  ["companyName", (exclusion) => { exclusion.companyName = "Other Company"; }],
  ["sourceAnnouncementType", (exclusion) => { exclusion.sourceAnnouncementType = "earnings_preview_revision"; }],
  ["sourceDate", (exclusion) => { exclusion.sourceDate = "2026-01-16"; }],
  ["reportPeriod", (exclusion) => { exclusion.reportPeriod = "2026-06-30"; exclusion.periodScope = "half_year"; }],
  ["periodScope", (exclusion) => { exclusion.reportPeriod = "2026-06-30"; exclusion.periodScope = "half_year"; }],
  ["parseStatus", (exclusion) => { exclusion.parseStatus = "parse_success"; }],
]) test(`offline validator rejects exclusion/target ${field} mismatch`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([partialMetricAnnouncement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => mutate(detail.exclusions[0]));
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_projection_mismatch"), errors.join("\n"));
}));

for (const [field, mutate] of [
  ["sourceAnnouncementType", (detail) => { detail.providerSnapshots[0].sourceAnnouncementType = "earnings_preview_revision"; }],
  ["sourceDate", (detail) => { detail.providerSnapshots[0].sourceDate = "2026-01-16"; }],
  ["reportPeriod", (detail) => { detail.providerSnapshots[0].snapshot.reportPeriod = "2026-06-30"; }],
  ["periodScope", (detail) => { detail.providerSnapshots[0].snapshot.periodScope = "half_year"; }],
]) test(`offline validator rejects snapshot/target ${field} mismatch`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", mutate);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_projection_mismatch"), errors.join("\n"));
}));

test("offline validator rejects detail companyName drift after detail checksum is recomputed", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.companyName = "Forged Company"; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("identity mismatch: company-00"), errors.join("\n"));
}));

test("offline validator rejects a non-canonical quality source URL", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.quality.sourceUrl = "https://www.cninfo.com.cn/new/hisAnnouncement/query?forged=1"; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_quality_contract"), errors.join("\n"));
}));

test("offline validator rejects individually valid but cross-generation detail, manifest, workflow and summary epochs", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const artifact = mutateCommittedDetail(root, "company-00", (detail) => {
    detail.generatedAt = "2026-07-12T07:31:40Z";
    detail.quality.updatedAt = detail.generatedAt;
    for (const record of detail.providerSnapshots) { record.generatedAt = detail.generatedAt; record.snapshot.providerGeneratedAt = detail.generatedAt; }
  });
  artifact.manifest.generatedAt = "2026-07-13T07:31:40Z";
  const workflowPath = path.join(root, "public", artifact.manifest.workflowIndexRelativePath);
  const workflow = readJson(workflowPath);
  workflow.generatedAt = "2026-07-14T07:31:40Z";
  for (const record of workflow.records) { record.generatedAt = workflow.generatedAt; record.snapshot.providerGeneratedAt = workflow.generatedAt; }
  const workflowContent = renderJson(workflow);
  fs.writeFileSync(workflowPath, workflowContent, "utf8");
  artifact.manifest.workflowIndexByteSize = Buffer.byteLength(workflowContent);
  artifact.manifest.workflowIndexChecksumSha256 = sha256(workflowContent);
  writeJson(artifact.manifestPath, artifact.manifest);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  summary.generatedAt = "2026-07-15T07:31:40Z";
  summary.sourceGeneratedAt = "2026-07-16T07:31:40Z";
  summary.workflowIndex.byteSize = artifact.manifest.workflowIndexByteSize;
  summary.workflowIndex.checksumSha256 = artifact.manifest.workflowIndexChecksumSha256;
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_generation_epoch"), errors.join("\n"));
  assert.ok(errors.includes("workflow generation epoch mismatch"), errors.join("\n"));
  assert.ok(errors.includes("summary global field mismatch: generatedAt"), errors.join("\n"));
  assert.ok(errors.includes("summary global field mismatch: sourceGeneratedAt"), errors.join("\n"));
}));

for (const value of ["2026-07-11Z", "2026-07-11 07:31:40Z", "2026-07-11T07:31:40", "2026-02-30T07:31:40Z", "2026-07-11T24:00:00Z", "2026-07-11T07:31:40Zextra"]) {
  test(`offline validator rejects loose precise-instant input ${value}`, () => withTempRoot((root) => {
    writeBundle(root, buildSingle([announcement()]), 1);
    mutateCommittedDetail(root, "company-00", (detail) => { detail.generatedAt = value; detail.quality.updatedAt = value; });
    const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
    assert.ok(errors.includes("company-00:detail_generation_epoch"), errors.join("\n"));
  }));
}

test("all-targets-excluded status remains partial even when the generation gate rejects zero reliable snapshots", () => {
  const result = buildSingle([excludedAnnouncement()]);
  assert.equal(result.companies[0].status, "partial");
  assert.equal(result.summary.status, "partial");
  assert.equal(result.companies[0].providerSnapshots.length, 0);
});

test("offline validator fails closed on a historical-only migration state", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const artifact = mutateCommittedDetail(root, "company-00", (detail) => {
    const historical = detail.providerSnapshots.pop();
    historical.isCurrentVersion = false;
    historical.snapshot.isCurrentProviderVersion = false;
    detail.historicalProviderVersions.push(historical);
    detail.status = "partial";
    detail.quality.status = "partial";
  });
  Object.assign(artifact.manifest.items[0], { snapshotCount: 0, historicalVersionCount: 1, latestReportPeriod: null, latestSourceDate: null, status: "partial" });
  artifact.manifest.totalSnapshots = 0;
  artifact.manifest.totalHistoricalVersions = 1;
  artifact.manifest.companiesWithSnapshots = 0;
  writeJson(artifact.manifestPath, artifact.manifest);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  Object.assign(summary.items["company-00"], { snapshotCount: 0, latestReportPeriod: null, latestSourceDate: null, status: "partial" });
  summary.status = "partial";
  summary.audit.reliableSnapshotCount = 0;
  summary.audit.reliableCompanyCount = 0;
  summary.audit.historicalVersionCount = 1;
  summary.workflowIndex.currentSnapshotCount = 0;
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_historical_only"), errors.join("\n"));
}));

for (const [label, mutate] of [
  ["empty warning", (detail) => { detail.warnings.push({}); }],
  ["cross-company warning", (detail) => { detail.warnings.push({ code: "revision_without_reliable_range", sourceAnnouncementId: "9999999", candidateAnnouncementIds: [], message: "invalid cross-company warning" }); }],
]) test(`offline validator rejects ${label}`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", mutate);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_warning_contract"), errors.join("\n"));
}));

for (const [label, mutate] of [
  ["duplicate exclusion reasons", (detail) => { detail.exclusions[0].reasons.push(detail.exclusions[0].reasons[0]); }],
  ["invalid exclusion candidate id", (detail) => { detail.exclusions[0].candidateAnnouncementIds = ["not-an-id"]; }],
]) test(`offline validator rejects ${label}`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([partialMetricAnnouncement()]), 1);
  mutateCommittedDetail(root, "company-00", mutate);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_exclusion_contract"), errors.join("\n"));
}));

test("Node validator and browser-safe contract return the same relation decision and error category", () => {
  const valid = buildSingle([announcement()]).companies[0];
  assert.deepEqual(validateCompanyGuidanceDetailContract(valid, { expectedGenerationEpoch: GENERATED_AT }), []);
  assert.deepEqual(validateCompanyGuidanceDetail(valid, { expectedGenerationEpoch: GENERATED_AT }), []);
  const invalid = structuredClone(valid);
  invalid.providerSnapshots[0].snapshot.stockId = "other";
  const runtimeErrors = validateCompanyGuidanceDetailContract(invalid, { expectedGenerationEpoch: GENERATED_AT });
  const nodeErrors = validateCompanyGuidanceDetail(invalid, { expectedGenerationEpoch: GENERATED_AT });
  assert.ok(runtimeErrors.includes("detail_projection_mismatch"));
  assert.ok(nodeErrors.includes("detail_projection_mismatch"));
  assert.equal(classifyCompanyGuidanceDetailContractErrors(runtimeErrors), "identity");
});

test("Node and browser-safe Provider record contracts reject the same fully recomputed product attack", () => {
  const detail = buildSingle([announcement()]).companies[0];
  const record = structuredClone(detail.providerSnapshots[0]);
  record.sourceExtractionConfidence = "low";
  recomputeRecordDerivations(record);
  const browserErrors = validateCompanyGuidanceProviderRecordContract(record, { mode: "detail_current", stockId: detail.stockId, companyName: detail.companyName, expectedGenerationEpoch: detail.generatedAt });
  const nodeErrors = validateProviderRecord(record, { mode: "detail_current", stockId: detail.stockId, companyName: detail.companyName, expectedGenerationEpoch: detail.generatedAt });
  assert.ok(browserErrors.includes("provider_snapshot_product_contract"), browserErrors.join("\n"));
  assert.ok(nodeErrors.includes("provider_snapshot_product_contract"), nodeErrors.join("\n"));
});

test("Node and browser-safe contracts reject future createdAt in all Provider record modes with the same graph classification", () => {
  const detail = buildSingle([announcement()]).companies[0];
  for (const mode of ["detail_current", "detail_historical", "workflow_current"]) {
    const record = structuredClone(detail.providerSnapshots[0]);
    record.snapshot.createdAt = "2030-01-01T00:00:00Z";
    if (mode === "detail_historical") {
      record.isCurrentVersion = false;
      record.snapshot.isCurrentProviderVersion = false;
    }
    if (mode === "workflow_current") {
      delete record.sourceTextEvidence;
      delete record.originalUnitEvidence;
    }
    const options = { mode, stockId: detail.stockId, companyName: detail.companyName, expectedGenerationEpoch: detail.generatedAt };
    const browserErrors = validateCompanyGuidanceProviderRecordContract(record, options);
    const nodeErrors = validateProviderRecord(record, options);
    assert.ok(browserErrors.includes("provider_snapshot_creation_chronology"), `${mode}: ${browserErrors.join("\n")}`);
    assert.ok(nodeErrors.includes("provider_snapshot_creation_chronology"), `${mode}: ${nodeErrors.join("\n")}`);
    assert.equal(classifyCompanyGuidanceProviderRecordErrors(browserErrors), "graph");
    assert.equal(classifyCompanyGuidanceProviderRecordErrors(nodeErrors), "graph");
  }
});

test("shared record contract rejects an invalid initial predecessor even when correction-relative chronology still looks valid", () => {
  const { records } = extractionCorrectionGraph();
  const predecessor = records.find((record) => record.providerCorrectionType === "initial");
  assert.ok(predecessor);
  predecessor.snapshot.createdAt = NEXT_GENERATED_AT;
  assert.deepEqual(validateCompanyGuidanceCorrectionGraph(records, { generationEpoch: "2026-07-13T07:31:40Z" }), []);
  const errors = validateProviderRecord(predecessor, {
    mode: "detail_historical",
    stockId: "company-00",
    companyName: "Company 0",
    expectedGenerationEpoch: "2026-07-13T07:31:40Z",
  });
  assert.ok(errors.includes("provider_snapshot_creation_chronology"), errors.join("\n"));
});

test("offline validator rejects a re-signed detail current initial record created after generatedAt", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.providerSnapshots[0].snapshot.createdAt = "2030-01-01T00:00:00Z"; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:9000001:provider_snapshot_creation_chronology"), errors.join("\n"));
}));

test("offline validator rejects a historical initial version with createdAt after its own generatedAt", () => withTempRoot((root) => {
  const initial = buildSingle([announcement()]);
  const corrected = buildCompanyGuidanceArtifacts({
    announcementDetails: [sourceDetail(0, [announcement({ lowerBound: 120, upperBound: 220 })])],
    sourceGeneratedAt: NEXT_GENERATED_AT,
    previousDetails: initial.companies,
  });
  writeBundle(root, corrected, 1);
  mutateCommittedDetail(root, "company-00", (detail) => {
    const predecessor = detail.historicalProviderVersions.find((record) => record.providerCorrectionType === "initial");
    predecessor.snapshot.createdAt = NEXT_GENERATED_AT;
  });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:9000001:provider_snapshot_creation_chronology"), errors.join("\n"));
}));

for (const [label, mutate] of [
  ["unrelated changed field", (record) => { setChangedFields(record, ["currency"]); }],
  ["missing changed field", (record) => { setChangedFields(record, ["lowerBound"]); }],
  ["extra changed field", (record) => { setChangedFields(record, ["lowerBound", "upperBound", "currency"]); }],
  ["duplicate changed field", (record) => { setChangedFields(record, ["lowerBound", "upperBound", "upperBound"]); }],
]) test(`correction graph rejects ${label}`, () => {
  const { records, current } = extractionCorrectionGraph();
  mutate(current);
  assert.ok(validateCompanyGuidanceCorrectionGraph(records, { generationEpoch: current.generatedAt }).includes("provider_correction_changed_fields"));
});

for (const [label, mutate] of [
  ["correctedAt before predecessor", (record) => { setCorrectedAt(record, "2026-07-10T07:31:40Z"); }],
  ["correctedAt after release epoch", (record) => { setCorrectedAt(record, "2026-07-14T07:31:40Z"); record.generatedAt = "2026-07-14T07:31:40Z"; record.snapshot.providerGeneratedAt = record.generatedAt; }],
  ["correctedAt unequal to immutable snapshot.createdAt", (record) => { setCorrectedAt(record, "2026-07-12T12:00:00Z"); }],
]) test(`correction graph rejects ${label}`, () => {
  const { records, current } = extractionCorrectionGraph();
  mutate(current);
  assert.ok(validateCompanyGuidanceCorrectionGraph(records, { generationEpoch: "2026-07-13T07:31:40Z" }).includes("provider_correction_chronology"));
});

test("correction graph accepts immutable correctedAt before a later no-op release epoch", () => {
  const { records, current } = extractionCorrectionGraph();
  const immutableCreatedAt = current.snapshot.createdAt;
  const immutableCorrectedAt = current.providerCorrectedAt;
  current.generatedAt = "2026-07-14T07:31:40Z";
  current.snapshot.providerGeneratedAt = current.generatedAt;
  assert.equal(current.snapshot.createdAt, immutableCreatedAt);
  assert.equal(current.providerCorrectedAt, immutableCorrectedAt);
  assert.deepEqual(validateCompanyGuidanceCorrectionGraph(records, { generationEpoch: current.generatedAt }), []);
  assert.deepEqual(validateProviderRecord(current, { mode: "detail_current", stockId: "company-00", companyName: "Company 0", expectedGenerationEpoch: current.generatedAt }), []);
});

test("record/snapshot correction timestamp split is rejected", () => {
  const { current } = extractionCorrectionGraph();
  current.snapshot.providerCorrectedAt = "2026-07-12T07:31:40Z";
  assert.ok(validateProviderRecord(current, { mode: "detail_current", stockId: "company-00", companyName: "Company 0", expectedGenerationEpoch: current.generatedAt }).includes("provider_snapshot_mirror_contract"));
});

for (const [label, mutate] of [
  ["record-only business predecessor", (record, first) => { record.providerBusinessRevisionPredecessorSnapshotId = first.snapshot.id; }],
  ["snapshot-only business predecessor", (record, first) => { record.snapshot.providerBusinessRevisionPredecessorSnapshotId = first.snapshot.id; }],
  ["different plausible business predecessors", (record, first) => { record.providerBusinessRevisionPredecessorSnapshotId = first.snapshot.id; }],
]) test(`Provider mirror rejects ${label}`, () => {
  const { target, first } = businessRevisionRecords();
  mutate(target, first);
  assert.ok(validateProviderRecord(target, { mode: "detail_current", stockId: "company-00", companyName: "Company 0", expectedGenerationEpoch: GENERATED_AT }).includes("provider_business_revision_mirror"));
});

for (const [label, mutate] of [
  ["parseStatusCounts", (audit) => { audit.parseStatusCounts.parse_success += 1; }],
  ["metricCounts", (audit) => { audit.metricCounts.attributable_net_profit += 1; }],
  ["periodScopeCounts", (audit) => { audit.periodScopeCounts.full_year += 1; }],
  ["exclusionReasonCounts", (audit) => { audit.exclusionReasonCounts.forged_reason = 1; }],
  ["targetAnnouncementCount", (audit) => { audit.targetAnnouncementCount += 1; audit.previewAnnouncementCount += 1; audit.parseStatusCounts.parse_success += 1; }],
  ["reliableAnnouncementCount", (audit) => { audit.reliableAnnouncementCount = 0; }],
  ["linkedRevisionSnapshotCount", (audit) => { audit.linkedRevisionSnapshotCount = 1; }],
  ["earliestSourceDate", (audit) => { audit.earliestSourceDate = "2025-01-01"; }],
  ["latestSourceDate", (audit) => { audit.latestSourceDate = "2026-12-31"; }],
]) test(`offline validator re-derives summary audit ${label}`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  const summaryPath = resolveCompanyGuidancePaths(root).summaryPath;
  const summary = readJson(summaryPath);
  mutate(summary.audit);
  writeJson(summaryPath, summary);
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("detail_audit_projection"), errors.join("\n"));
}));

test("offline validator rejects a cross-company candidate announcement reference", () => withTempRoot((root) => {
  writeBundle(root, buildMixedProviderBundle(), 2);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.providerSnapshots[0].correctionCandidateAnnouncementIds = ["9000002"]; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 2 }).errors;
  assert.ok(errors.some((error) => error.includes("candidate announcement belongs to another company")), errors.join("\n"));
}));

test("offline validator rejects unsupported structured warning code", () => withTempRoot((root) => {
  writeBundle(root, buildSingle([announcement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { detail.providerSnapshots[0].structuredWarnings = ["forged_warning"]; });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:9000001:provider_structured_warning_contract"), errors.join("\n"));
}));

for (const [label, mutate] of [
  ["external exclusion URL", (exclusion) => { exclusion.officialSourceUrl = "https://example.com/announcement/9000001"; }],
  ["null exclusion URL without reason", (exclusion) => { exclusion.officialSourceUrl = null; exclusion.reasons = exclusion.reasons.filter((reason) => reason !== "official_source_invalid"); }],
]) test(`offline validator rejects ${label}`, () => withTempRoot((root) => {
  writeBundle(root, buildSingle([partialMetricAnnouncement()]), 1);
  mutateCommittedDetail(root, "company-00", (detail) => { mutate(detail.exclusions[0]); });
  const errors = validateCommittedCompanyGuidanceArtifacts(root, { expectedCompanyCount: 1 }).errors;
  assert.ok(errors.includes("company-00:detail_exclusion_contract"), errors.join("\n"));
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
  writeJson(manifestFile, { generatedAt: GENERATED_AT, items });
}

function sourceEntry(index) {
  const stockId = `company-${String(index).padStart(2, "0")}`;
  return { stockId, stockCode: String(index).padStart(6, "0"), relativePath: `data/a-share-announcements/${stockId}.json` };
}
function sourceManifestPath(root) { return path.join(root, "public/data/a-share-announcements/manifest.generated.json"); }
function sourceManifest(root) { return readJson(sourceManifestPath(root)); }
function sourceDetail(index, announcements) { return { generatedAt: GENERATED_AT, stockId: `company-${String(index).padStart(2, "0")}`, stockCode: String(index).padStart(6, "0"), companyName: `Company ${index}`, announcements }; }

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
    performanceForecastEvents: [{ forecastPeriod: "2025-12-31", forecastType: "increase", profitMetric: "netProfitAttributableToParent", lowerBound, upperBound, extractionConfidence: "high", sourceTextEvidence: `预计区间${lowerBound}万元至${upperBound}万元`, previousForecastAnnouncementId: null }],
  };
}

function excludedAnnouncement() {
  return {
    ...announcement(),
    announcementId: "9000002",
    officialUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=9000002",
    pdfUrl: "https://static.cninfo.com.cn/finalpage/2026-01-15/9000002.PDF",
    parseStatus: "parse_partial",
    performanceForecastEvents: [],
  };
}

function partialMetricAnnouncement() {
  const value = announcement();
  value.parseStatus = "parse_partial";
  value.performanceForecastEvents.push({
    forecastPeriod: "2025-12-31", forecastType: "increase", profitMetric: "operatingRevenue",
    lowerBound: 300, upperBound: 400, extractionConfidence: "low", sourceTextEvidence: "revenue range requires review", previousForecastAnnouncementId: null,
  });
  return value;
}

function buildSingle(announcements) { return buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, announcements)], sourceGeneratedAt: GENERATED_AT }); }
function buildMixedProviderBundle() { return buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, [announcement()]), sourceDetail(1, [excludedAnnouncement()])], sourceGeneratedAt: GENERATED_AT }); }
function buildStatusMatrixBundle() { return buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, [announcement()]), sourceDetail(1, [excludedAnnouncement()]), sourceDetail(2, [])], sourceGeneratedAt: GENERATED_AT }); }

function extractionCorrectionGraph() {
  const initial = buildSingle([announcement()]);
  const correctedB = buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, [announcement({ lowerBound: 120, upperBound: 220 })])], sourceGeneratedAt: NEXT_GENERATED_AT, previousDetails: initial.companies });
  const correctedA = buildCompanyGuidanceArtifacts({ announcementDetails: [sourceDetail(0, [announcement()])], sourceGeneratedAt: "2026-07-13T07:31:40Z", previousDetails: correctedB.companies });
  const current = correctedA.companies[0].providerSnapshots[0];
  return { current, records: [...correctedA.companies[0].providerSnapshots, ...correctedA.companies[0].historicalProviderVersions] };
}

function businessRevisionRecords() {
  const original = announcement();
  const firstRevision = {
    ...announcement({ lowerBound: 120, upperBound: 220 }), announcementId: "9000002", category: "performance_forecast_revision",
    officialUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=9000002", pdfUrl: "https://static.cninfo.com.cn/finalpage/2026-01-16/9000002.PDF",
    announcementDate: "2026-01-16", isCorrection: true, correctedAnnouncementId: "9000001",
  };
  firstRevision.performanceForecastEvents[0].previousForecastAnnouncementId = "9000001";
  const secondRevision = {
    ...announcement({ lowerBound: 140, upperBound: 240 }), announcementId: "9000003", category: "performance_forecast_revision",
    officialUrl: "https://www.cninfo.com.cn/new/disclosure/detail?annoId=9000003", pdfUrl: "https://static.cninfo.com.cn/finalpage/2026-01-17/9000003.PDF",
    announcementDate: "2026-01-17", isCorrection: true, correctedAnnouncementId: "9000002",
  };
  secondRevision.performanceForecastEvents[0].previousForecastAnnouncementId = "9000002";
  const records = buildSingle([original, firstRevision, secondRevision]).companies[0].providerSnapshots;
  const byId = new Map(records.map((record) => [record.sourceAnnouncementId, record]));
  return { first: byId.get("9000001"), target: byId.get("9000003") };
}

function recomputeRecordDerivations(record) {
  const identity = stableProviderEvidenceIdentity({ announcementId: record.sourceAnnouncementId, stockId: record.snapshot.stockId, reportPeriod: record.snapshot.reportPeriod, periodScope: record.snapshot.periodScope, metric: record.snapshot.metric });
  record.providerEvidenceIdentity = identity;
  record.snapshot.providerEvidenceIdentity = identity;
  const checksum = computeProviderContentChecksum(record);
  record.providerContentChecksum = checksum;
  record.snapshot.providerContentChecksum = checksum;
  record.artifactChecksum = checksum;
  record.snapshot.artifactChecksum = checksum;
  const versionId = expectedProviderSnapshotVersionId(record);
  record.providerSnapshotVersionId = versionId;
  record.snapshot.providerSnapshotVersionId = versionId;
  record.snapshot.id = versionId;
}

function setChangedFields(record, fields) {
  record.providerCorrectionChangedFields = fields;
  record.snapshot.providerCorrectionChangedFields = [...fields];
}

function setCorrectedAt(record, value) {
  record.providerCorrectedAt = value;
  record.snapshot.providerCorrectedAt = value;
}

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
      const metadata = deriveCompanyGuidanceManifestMetadata(company);
      return { stockId: metadata.stockId, stockCode: metadata.stockCode, companyName: metadata.companyName, relativePath: metadata.relativePath, snapshotCount: metadata.snapshotCount, historicalVersionCount: metadata.historicalVersionCount, excludedAnnouncementCount: metadata.excludedAnnouncementCount, byteSize: Buffer.byteLength(content), checksumSha256: sha256(content), latestReportPeriod: metadata.latestReportPeriod, latestSourceDate: metadata.latestSourceDate, status: metadata.status };
    }),
  };
  result.summary.workflowIndex = { relativePath: manifest.workflowIndexRelativePath, byteSize: manifest.workflowIndexByteSize, checksumSha256: manifest.workflowIndexChecksumSha256, currentSnapshotCount: workflow.currentSnapshotCount };
  return { summary: result.summary, manifest, renderedDetails, renderedWorkflowIndex };
}
function writeBundle(root, result, companyCount) {
  const paths = resolveCompanyGuidancePaths(root);
  const bundle = createBundle(result);
  createSourceReferenceArtifacts(root, bundle);
  writeArtifactsTransaction({ ...bundle, rootPath: root, outputDir: paths.outputDir, summaryPath: paths.summaryPath, expectedCompanyCount: companyCount });
}

function createSourceReferenceArtifacts(root, bundle) {
  const sourceGeneratedAt = bundle.summary.generatedAt;
  const items = [];
  for (const [stockId, content] of bundle.renderedDetails) {
    const detail = JSON.parse(content);
    const relativePath = `data/a-share-announcements/${stockId}.json`;
    items.push({ stockId, stockCode: detail.stockCode, relativePath });
    const candidateBySource = new Map();
    for (const item of [...(detail.exclusions ?? []), ...(detail.warnings ?? [])]) candidateBySource.set(item.sourceAnnouncementId, item.candidateAnnouncementIds ?? []);
    for (const item of [...(detail.providerSnapshots ?? []), ...(detail.historicalProviderVersions ?? [])]) candidateBySource.set(item.sourceAnnouncementId, [...new Set([...(candidateBySource.get(item.sourceAnnouncementId) ?? []), ...(item.correctionCandidateAnnouncementIds ?? [])])]);
    const sourceIds = new Set([...(detail.targetAnnouncements ?? []).map((item) => item.sourceAnnouncementId), ...candidateBySource.keys(), ...[...candidateBySource.values()].flat()]);
    const announcements = [...sourceIds].map((announcementId) => ({
      announcementId,
      correctedAnnouncementId: candidateBySource.get(announcementId)?.[0] ?? null,
      performanceForecastEvents: [],
    }));
    writeJson(path.join(root, "public", relativePath), { generatedAt: sourceGeneratedAt, stockId, stockCode: detail.stockCode, companyName: detail.companyName, announcements });
  }
  writeJson(path.join(root, "src/data/real/a-share-announcement-summaries.generated.json"), { generatedAt: sourceGeneratedAt });
  writeJson(sourceManifestPath(root), { generatedAt: sourceGeneratedAt, items });
}

function mutateCommittedDetail(root, stockId, mutate) {
  const paths = resolveCompanyGuidancePaths(root);
  const manifestPath = path.join(paths.outputDir, "manifest.generated.json");
  const manifest = readJson(manifestPath);
  const entry = manifest.items.find((item) => item.stockId === stockId);
  assert.ok(entry, `manifest entry missing for ${stockId}`);
  const detailPath = path.join(root, "public", entry.relativePath);
  const detail = readJson(detailPath);
  mutate(detail);
  const content = renderJson(detail);
  fs.writeFileSync(detailPath, content, "utf8");
  entry.byteSize = Buffer.byteLength(content);
  entry.checksumSha256 = sha256(content);
  writeJson(manifestPath, manifest);
  return { detail, detailPath, manifest, manifestPath };
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
