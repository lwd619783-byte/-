import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  COMPANY_GUIDANCE_PROVIDER_ID,
  COMPANY_GUIDANCE_PROVIDER_VERSION,
  COMPANY_GUIDANCE_SCHEMA_VERSION,
  stableProviderSnapshotId,
} from "./company-guidance-expectations/core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validateCommittedCompanyGuidanceArtifacts(rootPath = root) {
  const errors = [];
  const summaryPath = path.join(rootPath, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
  const outputDir = path.join(rootPath, "public/data/a-share-company-guidance-expectations");
  const manifestPath = path.join(outputDir, "manifest.generated.json");
  let summary;
  let manifest;
  try { summary = readJson(summaryPath); } catch (error) { return { errors: [`summary unreadable: ${error}`] }; }
  try { manifest = readJson(manifestPath); } catch (error) { return { errors: [`manifest unreadable: ${error}`] }; }
  if (summary.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION || manifest.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION) errors.push("schemaVersion mismatch");
  if (summary.providerId !== COMPANY_GUIDANCE_PROVIDER_ID || manifest.providerId !== COMPANY_GUIDANCE_PROVIDER_ID) errors.push("providerId mismatch");
  if (summary.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION || manifest.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION) errors.push("providerVersion mismatch");
  if (!Array.isArray(manifest.items) || manifest.items.length !== 56 || manifest.totalCompanies !== 56) errors.push("manifest must contain 56 companies");
  const ids = new Set();
  let totalSnapshots = 0;
  for (const entry of manifest.items ?? []) {
    if (!/^data\/a-share-company-guidance-expectations\/[A-Za-z0-9_-]+\.json$/u.test(entry.relativePath) || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) { errors.push(`unsafe path: ${entry.stockId}`); continue; }
    const file = path.join(rootPath, "public", entry.relativePath);
    if (!fs.existsSync(file)) { errors.push(`missing detail: ${entry.stockId}`); continue; }
    const bytes = fs.readFileSync(file);
    if (bytes.byteLength !== entry.byteSize || sha256(bytes) !== entry.checksumSha256) errors.push(`checksum mismatch: ${entry.stockId}`);
    let detail;
    try { detail = JSON.parse(bytes.toString("utf8")); } catch { errors.push(`invalid json: ${entry.stockId}`); continue; }
    if (detail.stockId !== entry.stockId || detail.stockCode !== entry.stockCode || detail.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION) errors.push(`identity mismatch: ${entry.stockId}`);
    if (!Array.isArray(detail.providerSnapshots) || detail.providerSnapshots.length !== entry.snapshotCount) errors.push(`snapshot count mismatch: ${entry.stockId}`);
    totalSnapshots += detail.providerSnapshots?.length ?? 0;
    for (const record of detail.providerSnapshots ?? []) {
      const snapshot = record.snapshot;
      const expectedId = stableProviderSnapshotId({ announcementId: record.sourceAnnouncementId, stockId: snapshot.stockId, reportPeriod: snapshot.reportPeriod, periodScope: snapshot.periodScope, metric: snapshot.metric });
      if (snapshot.id !== expectedId || ids.has(snapshot.id)) errors.push(`unstable or duplicate id: ${snapshot.id}`);
      ids.add(snapshot.id);
      if (snapshot.ingestionMethod !== "provider" || snapshot.sourceCategory !== "company_guidance" || snapshot.sourceVerificationStatus !== "verified") errors.push(`provider boundary mismatch: ${snapshot.id}`);
      if (snapshot.value !== null || snapshot.estimateShape !== "range" || !Number.isFinite(snapshot.lowerBound) || !Number.isFinite(snapshot.upperBound)) errors.push(`range contract mismatch: ${snapshot.id}`);
      if (snapshot.currency !== "CNY" || snapshot.unit !== "yuan" || snapshot.accountingBasis !== "PRC_GAAP") errors.push(`unit contract mismatch: ${snapshot.id}`);
      if (snapshot.formationTimeBasis !== "public_disclosure_proxy" || snapshot.formedAt !== null || snapshot.sourcePublishedAt !== record.sourceDate) errors.push(`time contract mismatch: ${snapshot.id}`);
      if (!/^https:\/\/www\.cninfo\.com\.cn\/new\/disclosure\/detail\?annoId=\d+$/u.test(record.officialSourceUrl) || !/^https:\/\/static\.cninfo\.com\.cn\/finalpage\//u.test(record.officialPdfUrl)) errors.push(`official source mismatch: ${snapshot.id}`);
    }
  }
  if (totalSnapshots !== manifest.totalSnapshots || totalSnapshots !== summary.audit?.reliableSnapshotCount) errors.push("total snapshot count mismatch");
  if (totalSnapshots <= 0) errors.push("no reliable provider snapshots");
  return { errors, totalCompanies: manifest.items?.length ?? 0, totalSnapshots, companiesWithSnapshots: manifest.companiesWithSnapshots ?? 0, audit: summary.audit };
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateCommittedCompanyGuidanceArtifacts();
  console.log(JSON.stringify({ status: result.errors.length ? "failed" : "passed", ...result }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
