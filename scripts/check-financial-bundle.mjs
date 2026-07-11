import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const BASELINE_INITIAL_JS_BYTES = 4_841_746;
export const BASELINE_MAX_CHUNK_BYTES = 4_841_746;
export const BASELINE_INITIAL_GZIP_BYTES = 798_794;

export function scanFinancialBundleSource(rootPath) {
  const findings = [];
  const sourceRoot = path.join(rootPath, "src");
  for (const file of walk(sourceRoot).filter((item) => /\.(?:ts|tsx|js|jsx)$/.test(item) && !/\.(?:test|spec)\./.test(item))) {
    const relative = path.relative(rootPath, file).replaceAll("\\", "/");
    const text = fs.readFileSync(file, "utf8");
    if (/from\s+["'][^"']*a-share-financials\.generated\.json["']/.test(text)) findings.push(`${relative}: statically imports the legacy financial monolith`);
    if (/import\s+[^;]+from\s+["'][^"']*public\/data\/a-share-financials/.test(text)) findings.push(`${relative}: statically imports a full financial detail file`);
    if (/import\s+[^;]+from\s+["'][^"']*a-share-financials\/[^"']+\.json["']/.test(text)) findings.push(`${relative}: statically imports the per-company financial directory`);
  }
  return findings;
}

export function scanAnnouncementBundleSource(rootPath) {
  const findings = [];
  const sourceRoot = path.join(rootPath, "src");
  for (const file of walk(sourceRoot).filter((item) => /\.(?:ts|tsx|js|jsx)$/.test(item) && !/\.(?:test|spec)\./.test(item))) {
    const relative = path.relative(rootPath, file).replaceAll("\\", "/");
    const text = fs.readFileSync(file, "utf8");
    if (/from\s+["'][^"']*(?:a-share-)?announcements\.generated\.json["']/.test(text)) findings.push(`${relative}: statically imports a legacy announcement history file`);
    if (/import\s+[^;]+from\s+["'][^"']*public\/data\/a-share-announcements/.test(text)) findings.push(`${relative}: statically imports a full announcement detail file`);
    if (/import\s+[^;]+from\s+["'][^"']*a-share-announcements\/[^"']+\.json["']/.test(text)) findings.push(`${relative}: statically imports the per-company announcement directory`);
  }
  return findings;
}

export function collectFinancialBundleMetrics(rootPath) {
  const distPath = path.join(rootPath, "dist");
  const indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
  const entrySources = [...indexHtml.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/g)].map((match) => match[1]);
  const entryFiles = entrySources.map((source) => path.join(distPath, source.replace(/^\//, "")));
  const allJs = walk(path.join(distPath, "assets")).filter((file) => file.endsWith(".js"));
  const initialJsBytes = entryFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const initialGzipBytes = entryFiles.reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(file)).length, 0);
  const maxChunkBytes = Math.max(...allJs.map((file) => fs.statSync(file).size));
  const entryText = entryFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const summaryPath = path.join(rootPath, "src/data/real/a-share-financial-summaries.generated.json");
  const detailDir = path.join(rootPath, "public/data/a-share-financials");
  const detailFiles = fs.readdirSync(detailDir).filter((name) => name.endsWith(".json") && name !== "manifest.generated.json").map((name) => path.join(detailDir, name));
  const detailBytes = detailFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const announcementSummaryPath = path.join(rootPath, "src/data/real/a-share-announcement-summaries.generated.json");
  const announcementDetailDir = path.join(rootPath, "public/data/a-share-announcements");
  const announcementManifestPath = path.join(announcementDetailDir, "manifest.generated.json");
  const announcementDetailFiles = fs.readdirSync(announcementDetailDir).filter((name) => name.endsWith(".json") && name !== "manifest.generated.json").map((name) => path.join(announcementDetailDir, name));
  const announcementDetailBytes = announcementDetailFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  return {
    initialJsBytes,
    initialGzipBytes,
    maxChunkBytes,
    allJsBytes: allJs.reduce((sum, file) => sum + fs.statSync(file).size, 0),
    entryFiles: entryFiles.map((file) => path.basename(file)),
    summaryBytes: fs.statSync(summaryPath).size,
    detailFiles: detailFiles.length,
    detailBytes,
    averageDetailBytes: Math.round(detailBytes / detailFiles.length),
    initialReductionPct: Number(((1 - initialJsBytes / BASELINE_INITIAL_JS_BYTES) * 100).toFixed(2)),
    initialGzipReductionPct: Number(((1 - initialGzipBytes / BASELINE_INITIAL_GZIP_BYTES) * 100).toFixed(2)),
    containsFullHistoryMarker: entryText.includes("sourceIdentifier"),
    announcementSummaryBytes: fs.statSync(announcementSummaryPath).size,
    announcementManifestBytes: fs.statSync(announcementManifestPath).size,
    announcementDetailFiles: announcementDetailFiles.length,
    announcementDetailBytes,
    averageAnnouncementDetailBytes: Math.round(announcementDetailBytes / announcementDetailFiles.length),
    containsFullAnnouncementHistoryMarker: entryText.includes("announcementParsingResult"),
  };
}

export function checkFinancialBundle(rootPath) {
  const errors = [...scanFinancialBundleSource(rootPath), ...scanAnnouncementBundleSource(rootPath)];
  const legacy = path.join(rootPath, "src/data/real/a-share-financials.generated.json");
  if (fs.existsSync(legacy)) errors.push("legacy monolithic financial JSON still exists");
  const metrics = collectFinancialBundleMetrics(rootPath);
  if (metrics.entryFiles.length === 0) errors.push("no initial JavaScript entry found in dist/index.html");
  if (metrics.initialJsBytes >= BASELINE_INITIAL_JS_BYTES * 0.5) errors.push("initial JavaScript did not decrease by at least 50% from the recorded baseline");
  if (metrics.maxChunkBytes >= BASELINE_MAX_CHUNK_BYTES * 0.5) errors.push("maximum JavaScript chunk did not decrease by at least 50% from the recorded baseline");
  if (metrics.summaryBytes > 300_000) errors.push("financial summary exceeds the 300 kB synchronous-data budget");
  if (metrics.detailFiles !== 56) errors.push(`expected 56 company detail files, found ${metrics.detailFiles}`);
  if (metrics.containsFullHistoryMarker) errors.push("initial JavaScript still contains full financial-history markers");
  if (metrics.announcementSummaryBytes > 1_000_000) errors.push("announcement summary exceeds the 1 MB synchronous-data budget");
  if (metrics.announcementDetailFiles !== 56) errors.push(`expected 56 announcement detail files, found ${metrics.announcementDetailFiles}`);
  if (metrics.containsFullAnnouncementHistoryMarker) errors.push("initial JavaScript still contains full announcement-history markers");
  return { errors, metrics };
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = checkFinancialBundle(root);
  console.log(JSON.stringify({ status: result.errors.length ? "failed" : "passed", baseline: {
    initialJsBytes: BASELINE_INITIAL_JS_BYTES,
    initialGzipBytes: BASELINE_INITIAL_GZIP_BYTES,
    maxChunkBytes: BASELINE_MAX_CHUNK_BYTES,
  }, ...result.metrics, errors: result.errors }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
