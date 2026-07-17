import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  COMPANY_GUIDANCE_PROVIDER_ID,
  COMPANY_GUIDANCE_PROVIDER_VERSION,
  COMPANY_GUIDANCE_SCHEMA_VERSION,
  validateBusinessRevisionGraph,
  validateCompanyGuidanceDetail,
  validateVersionGraph,
} from "./company-guidance-expectations/core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validateCommittedCompanyGuidanceArtifacts(rootPath = root) {
  const errors = [];
  const summaryPath = path.join(rootPath, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
  const outputDir = path.join(rootPath, "public/data/a-share-company-guidance-expectations");
  let summary; let manifest;
  try { summary = readJson(summaryPath); } catch (error) { return { errors: [`summary unreadable: ${error}`] }; }
  try { manifest = readJson(path.join(outputDir, "manifest.generated.json")); } catch (error) { return { errors: [`manifest unreadable: ${error}`] }; }
  for (const artifact of [summary, manifest]) {
    if (artifact.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION) errors.push("schemaVersion mismatch");
    if (artifact.providerId !== COMPANY_GUIDANCE_PROVIDER_ID) errors.push("providerId mismatch");
    if (artifact.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION) errors.push("providerVersion mismatch");
  }
  if (!Array.isArray(manifest.items) || manifest.items.length !== 56 || manifest.totalCompanies !== 56) errors.push("manifest must contain 56 companies");
  const records = []; const versions = []; let totalSnapshots = 0; let totalHistoricalVersions = 0;
  for (const entry of manifest.items ?? []) {
    if (!/^data\/a-share-company-guidance-expectations\/[A-Za-z0-9_-]+\.json$/u.test(entry.relativePath) || entry.relativePath.includes("..") || !entry.relativePath.endsWith(`/${entry.stockId}.json`)) { errors.push(`unsafe path: ${entry.stockId}`); continue; }
    const file = path.join(rootPath, "public", entry.relativePath);
    if (!fs.existsSync(file)) { errors.push(`missing detail: ${entry.stockId}`); continue; }
    const bytes = fs.readFileSync(file);
    if (bytes.byteLength !== entry.byteSize || sha256(bytes) !== entry.checksumSha256) errors.push(`checksum mismatch: ${entry.stockId}`);
    let detail; try { detail = JSON.parse(bytes.toString("utf8")); } catch { errors.push(`invalid json: ${entry.stockId}`); continue; }
    if (detail.stockId !== entry.stockId || detail.stockCode !== entry.stockCode) errors.push(`identity mismatch: ${entry.stockId}`);
    if (detail.providerSnapshots?.length !== entry.snapshotCount || detail.historicalProviderVersions?.length !== entry.historicalVersionCount) errors.push(`version count mismatch: ${entry.stockId}`);
    errors.push(...validateCompanyGuidanceDetail(detail).map((error) => `${entry.stockId}:${error}`));
    totalSnapshots += detail.providerSnapshots?.length ?? 0;
    totalHistoricalVersions += detail.historicalProviderVersions?.length ?? 0;
    records.push(...(detail.providerSnapshots ?? []));
    versions.push(...(detail.providerSnapshots ?? []), ...(detail.historicalProviderVersions ?? []));
  }
  errors.push(...validateVersionGraph(versions), ...validateBusinessRevisionGraph(records));
  const workflowPath = path.join(rootPath, "public", manifest.workflowIndexRelativePath ?? "");
  let workflow = null;
  if (manifest.workflowIndexRelativePath !== "data/a-share-company-guidance-expectations/workflow-index.generated.json" || !fs.existsSync(workflowPath)) errors.push("workflow index missing or unsafe");
  else {
    const bytes = fs.readFileSync(workflowPath);
    if (bytes.byteLength !== manifest.workflowIndexByteSize || sha256(bytes) !== manifest.workflowIndexChecksumSha256) errors.push("workflow index checksum mismatch");
    try { workflow = JSON.parse(bytes.toString("utf8")); } catch { errors.push("workflow index invalid json"); }
  }
  if (workflow) {
    if (workflow.schemaVersion !== COMPANY_GUIDANCE_SCHEMA_VERSION || workflow.providerId !== COMPANY_GUIDANCE_PROVIDER_ID || workflow.providerVersion !== COMPANY_GUIDANCE_PROVIDER_VERSION) errors.push("workflow index contract mismatch");
    if (!Array.isArray(workflow.records) || workflow.currentSnapshotCount !== workflow.records.length || workflow.currentSnapshotCount !== totalSnapshots) errors.push("workflow index count mismatch");
    const workflowIds = new Set((workflow.records ?? []).map((record) => record.providerSnapshotVersionId));
    if (workflowIds.size !== records.length || records.some((record) => !workflowIds.has(record.providerSnapshotVersionId))) errors.push("workflow index orphan/missing record");
    if ((workflow.records ?? []).some((record) => Object.hasOwn(record, "sourceTextEvidence") || Object.hasOwn(record, "originalUnitEvidence"))) errors.push("workflow index contains raw evidence fields");
  }
  if (totalSnapshots !== manifest.totalSnapshots || totalSnapshots !== summary.audit?.reliableSnapshotCount || totalSnapshots !== summary.workflowIndex?.currentSnapshotCount) errors.push("total snapshot count mismatch");
  if (totalHistoricalVersions !== manifest.totalHistoricalVersions || totalHistoricalVersions !== summary.audit?.historicalVersionCount) errors.push("historical version count mismatch");
  if (summary.workflowIndex?.byteSize !== manifest.workflowIndexByteSize || summary.workflowIndex?.checksumSha256 !== manifest.workflowIndexChecksumSha256) errors.push("summary workflow metadata mismatch");
  if (totalSnapshots <= 0) errors.push("no reliable provider snapshots");
  return { errors: [...new Set(errors)], totalCompanies: Array.isArray(manifest.items) ? manifest.items.length : null, totalSnapshots, totalHistoricalVersions, companiesWithSnapshots: Number.isInteger(manifest.companiesWithSnapshots) ? manifest.companiesWithSnapshots : null, workflowIndexBytes: Number.isInteger(manifest.workflowIndexByteSize) ? manifest.workflowIndexByteSize : null, audit: summary.audit };
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = validateCommittedCompanyGuidanceArtifacts();
  console.log(JSON.stringify({ status: result.errors.length ? "failed" : "passed", ...result }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
