import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  COMPANY_GUIDANCE_PROVIDER_ID,
  COMPANY_GUIDANCE_PROVIDER_VERSION,
  COMPANY_GUIDANCE_SCHEMA_VERSION,
  buildCompanyGuidanceArtifacts,
} from "./company-guidance-expectations/core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const announcementSummaryPath = path.join(root, "src/data/real/a-share-announcement-summaries.generated.json");
const announcementManifestPath = path.join(root, "public/data/a-share-announcements/manifest.generated.json");
const summaryPath = path.join(root, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
const outputDir = path.join(root, "public/data/a-share-company-guidance-expectations");

export function generateCompanyGuidanceArtifacts({ dryRun = false } = {}) {
  const sourceSummary = readJson(announcementSummaryPath);
  const sourceManifest = readJson(announcementManifestPath);
  const details = sourceManifest.items.map((entry) => readJson(path.join(root, "public", entry.relativePath)));
  const result = buildCompanyGuidanceArtifacts({ announcementDetails: details, sourceGeneratedAt: sourceSummary.generatedAt });
  const renderedDetails = new Map(result.companies.map((company) => [company.stockId, renderJson(company)]));
  const manifest = {
    schemaVersion: COMPANY_GUIDANCE_SCHEMA_VERSION,
    providerId: COMPANY_GUIDANCE_PROVIDER_ID,
    providerVersion: COMPANY_GUIDANCE_PROVIDER_VERSION,
    generatedAt: sourceSummary.generatedAt,
    totalCompanies: result.companies.length,
    companiesWithSnapshots: result.audit.reliableCompanyCount,
    totalSnapshots: result.audit.reliableSnapshotCount,
    items: result.companies.map((company) => {
      const content = renderedDetails.get(company.stockId);
      return {
        stockId: company.stockId,
        stockCode: company.stockCode,
        companyName: company.companyName,
        relativePath: `data/a-share-company-guidance-expectations/${company.stockId}.json`,
        snapshotCount: company.providerSnapshots.length,
        excludedAnnouncementCount: new Set(company.exclusions.map((record) => record.sourceAnnouncementId)).size,
        byteSize: Buffer.byteLength(content),
        checksumSha256: sha256(content),
        latestReportPeriod: company.providerSnapshots.map((record) => record.snapshot.reportPeriod).sort().at(-1) ?? null,
        latestSourceDate: company.providerSnapshots.map((record) => record.sourceDate).sort().at(-1) ?? null,
        status: company.status,
      };
    }),
  };
  validateRendered(result, manifest, renderedDetails);
  if (!dryRun) writeArtifacts(result.summary, manifest, renderedDetails);
  return { ...result, manifest, dryRun };
}

function writeArtifacts(summary, manifest, renderedDetails) {
  const stageDir = `${outputDir}.tmp-${process.pid}`;
  const backupDir = `${outputDir}.backup-${process.pid}`;
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  for (const [stockId, content] of renderedDetails) fs.writeFileSync(path.join(stageDir, `${stockId}.json`), content, "utf8");
  fs.writeFileSync(path.join(stageDir, "manifest.generated.json"), renderJson(manifest), "utf8");
  const summaryTemp = `${summaryPath}.tmp-${process.pid}`;
  fs.writeFileSync(summaryTemp, renderJson(summary), "utf8");
  try {
    if (fs.existsSync(outputDir)) fs.renameSync(outputDir, backupDir);
    fs.renameSync(stageDir, outputDir);
    fs.renameSync(summaryTemp, summaryPath);
    fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(outputDir) && fs.existsSync(backupDir)) fs.renameSync(backupDir, outputDir);
    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.rmSync(summaryTemp, { force: true });
    throw error;
  }
}

function validateRendered(result, manifest, renderedDetails) {
  if (result.companies.length !== 56 || manifest.items.length !== 56) throw new Error(`expected 56 companies, got ${result.companies.length}`);
  if (result.audit.reliableSnapshotCount <= 0) throw new Error("no reliable company-guidance snapshots; refusing to generate example data");
  const ids = result.companies.flatMap((company) => company.providerSnapshots.map((record) => record.snapshot.id));
  if (new Set(ids).size !== ids.length) throw new Error("duplicate provider snapshot ids");
  for (const entry of manifest.items) {
    const content = renderedDetails.get(entry.stockId);
    if (!content || Buffer.byteLength(content) !== entry.byteSize || sha256(content) !== entry.checksumSha256) throw new Error(`manifest mismatch for ${entry.stockId}`);
    if (!/^data\/a-share-company-guidance-expectations\/[A-Za-z0-9_-]+\.json$/u.test(entry.relativePath) || entry.relativePath.includes("..")) throw new Error(`unsafe path for ${entry.stockId}`);
  }
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function renderJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = generateCompanyGuidanceArtifacts({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify({ status: "passed", dryRun: result.dryRun, audit: result.audit }, null, 2));
}
