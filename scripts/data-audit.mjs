import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_STATUSES = ["real", "generated_real", "manual_verified", "manual_unverified", "static_reference", "inferred", "mock", "placeholder", "stale", "conflicted", "partial", "not_implemented", "source_unavailable", "unknown"];
export const REQUIRED_IDS = ["a-share-quotes", "a-share-price-history", "hk-quotes", "hk-price-history", "a-share-financials", "hk-financials", "announcements", "earnings-preview", "earnings-flash", "expectation-company-guidance", "expectation-company-guidance-provider", "broker-research", "institution-consensus", "eps-net-profit-forecast", "valuation", "industry-prosperity", "customer-relations", "supplier-relations", "industry-chain-position", "technical-route", "risk-alerts", "evidence-items"];
export const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git", ".cache", "cache", "__pycache__", "test-fixtures", "fixtures"]);
const SCAN_ROOTS = ["src", "scripts", "public"];
const REGISTRY_FILE = "src/data/data-source-registry.ts";
const ZERO_RISK_WORDS = /revenue|operatingRevenue|netProfit|attributableNetProfit|deductedNetProfit|grossMargin|netMargin|operatingCashFlow|receivables|inventory|researchExpense|eps|pe|pb|ps|peg|ev\/ebitda|consensus|targetPrice|growth|yoy|qoq|forecast|valuation|marketCap|dividendYield|price|profit|financial|estimate|expectation|investment|customer|supplier|order/i;
const SAFE_ZERO_RULES = [
  {
    id: "audit-self-test-fixture",
    test: ({ relative, line }) => relative === "scripts/data-audit.mjs" && /fs\.writeFileSync\(file, "const revenue = input/.test(line),
    reason: "literal used by the audit implementation's built-in negative self-test",
    scope: "exact-audit-self-test-line",
  },
  { id: "array-length", test: ({ before }) => /\.length[^\n]{0,80}$/.test(before), reason: "array length/count fallback", scope: "count-only" },
  { id: "index-count", test: ({ before }) => /(?:page|index|offset|count|column|rowIndex)[A-Za-z]*[^\n]{0,80}$/i.test(before), reason: "layout/index/count fallback", scope: "layout-only" },
  { id: "counter-init", test: ({ before }) => /acc\[[^\]]+\][^\n]{0,80}$/.test(before), reason: "reduce/map counter initialization", scope: "counter-only" },
  {
    id: "sort-comparator",
    test: ({ line, before }) => /(?:\.sort\s*\(|sortValue|ranking|rankValue|orderValue|compareValue)/i.test(line) && /Math\.abs\([^)]*$/.test(before),
    reason: "explicit sort/ranking comparator fallback",
    scope: "non-rendered-ordering",
  },
];

export function walkFiles(root, roots = SCAN_ROOTS) {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory() && SKIP_DIRS.has(item.name)) continue;
      const full = path.join(directory, item.name);
      if (item.isDirectory()) visit(full);
      else if (!/\.(?:test|spec)\.(?:ts|tsx|js|mjs)$/.test(item.name) && (/\.(ts|tsx|js|mjs|json)$/.test(item.name) || item.name.endsWith(".generated.json"))) files.push(full);
    }
  };
  for (const rootPath of roots) visit(path.join(root, rootPath));
  return files.sort();
}

function literal(block, field) {
  return block.match(new RegExp(`${field}:\\s*"([^"]*)"`))?.[1] ?? null;
}

function nullableString(block, field) {
  const raw = block.match(new RegExp(`${field}:\\s*(null|"[^"]*")`))?.[1];
  return raw === undefined || raw === "null" ? null : raw.slice(1, -1);
}

function pathExpression(block, field) {
  const raw = block.match(new RegExp(`${field}:\\s*(null|(?:generated|source|publicData)\\("[^"]+"\\)|"[^"]+")`))?.[1];
  return raw === undefined || raw === "null" ? null : raw;
}

function numberOrInvalid(value) {
  if (value === undefined) return undefined;
  if (value === "null") return null;
  return /^-?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ? Number(value) : Number.NaN;
}

function parseCoverage(block) {
  const match = block.match(/coverage:\s*(null|\{([\s\S]*?)\})/);
  if (!match || match[1] === "null") return null;
  const body = match[2];
  const numeratorRaw = body.match(/numerator:\s*([^,}\s]+)/)?.[1];
  const denominatorRaw = body.match(/denominator:\s*([^,}\s]+)/)?.[1];
  return {
    numerator: numberOrInvalid(numeratorRaw),
    denominator: numberOrInvalid(denominatorRaw),
    note: nullableString(body, "note"),
    raw: body,
  };
}

export function parseRegistryEntries(registrySource) {
  return [...registrySource.matchAll(/entry\(\{([\s\S]*?)\}\),/g)].map((match) => {
    const block = match[0];
    const frontendMatch = block.match(/frontendConsumers:\s*\[([^\]]*)\]/s);
    return {
      id: literal(block, "id"),
      status: literal(block, "status"),
      sourceType: literal(block, "sourceType"),
      provider: nullableString(block, "provider"),
      storageLocation: pathExpression(block, "storageLocation"),
      summaryLocation: pathExpression(block, "summaryLocation"),
      manifestLocation: pathExpression(block, "manifestLocation"),
      detailLocationPattern: pathExpression(block, "detailLocationPattern"),
      generatedBy: nullableString(block, "generatedBy"),
      isDisplayed: block.match(/isDisplayed:\s*(true|false|null)/)?.[1] ?? "null",
      frontendConsumers: [...(frontendMatch?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((item) => item[1]),
      coverage: parseCoverage(block),
      block,
    };
  });
}

export function finding({ severity, blocking = severity === "P0", category, id, title, description = title, file = REGISTRY_FILE, line = null, registryIds = [], recommendation, resolved = false }) {
  return { id, severity, blocking: severity === "P0" ? true : blocking, category, title, description, file, line, registryIds, status: resolved ? "resolved" : "open", recommendation, resolved };
}

function add(findings, severity, category, id, title, registryIds, recommendation, options = {}) {
  findings.push(finding({ severity, category, id, title, registryIds, recommendation, ...options }));
}

function withinRoot(rootPath, candidate) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidate));
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolveStorage(rootPath, expression) {
  const helper = expression?.match(/(generated|source|publicData)\("([^"]+)"\)/);
  const raw = expression?.match(/^"([^"]+)"$/)?.[1];
  if (!helper && !raw) return null;
  const helperRoot = helper?.[1] === "generated" ? "src/data/real" : helper?.[1] === "publicData" ? "public/data" : "src";
  const relative = helper ? path.join(helperRoot, helper[2]) : raw;
  return path.resolve(rootPath, relative);
}

function wildcardMatches(rootPath, expression) {
  const normalized = expression.replaceAll("\\", "/");
  if (!normalized.includes("*")) return fs.existsSync(path.resolve(rootPath, normalized)) ? [normalized] : [];
  const star = normalized.indexOf("*");
  const directory = path.resolve(rootPath, normalized.slice(0, star).replace(/\/$/, ""));
  if (!withinRoot(rootPath, directory) || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) return [];
  const suffix = normalized.slice(star + 1);
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((item) => item.isFile() && (!suffix || item.name.endsWith(suffix)))
    .map((item) => path.relative(rootPath, path.join(directory, item.name)).replaceAll("\\", "/"));
}

function generatorPaths(value) {
  return value?.match(/(?:scripts|src)\/[A-Za-z0-9_./-]+\.(?:py|mjs|js|ts|tsx)/g) ?? [];
}

function validateCoverage(entry, findings) {
  const coverage = entry.coverage;
  if (!coverage) return;
  const ids = [entry.id].filter(Boolean);
  const values = [coverage.numerator, coverage.denominator];
  if (values.some((value) => value === undefined || (value !== null && (!Number.isFinite(value) || value < 0)))) {
    add(findings, "P0", "coverage", "coverage-invalid-number", `Coverage must use non-negative numbers or null: ${entry.id}`, ids, "Use explicit non-negative numeric coverage values or null");
    return;
  }
  const { numerator, denominator } = coverage;
  if (numerator !== null && denominator === null) add(findings, "P0", "coverage", "coverage-denominator-missing", `Coverage denominator is required when numerator is set: ${entry.id}`, ids, "Declare the denominator or set coverage to null");
  if (denominator === 0 && ![0, null].includes(numerator)) add(findings, "P0", "coverage", "coverage-zero-denominator", `Zero denominator contradicts a positive numerator: ${entry.id}`, ids, "Use numerator 0/null with denominator 0");
  if (numerator !== null && denominator !== null && numerator > denominator) add(findings, "P0", "coverage", "coverage-overflow", `Coverage numerator exceeds denominator: ${entry.id}`, ids, "Correct the coverage counts");
  const positive = typeof numerator === "number" && numerator > 0;
  const full = typeof numerator === "number" && typeof denominator === "number" && denominator > 0 && numerator === denominator;
  if (entry.status === "not_implemented" && (positive || full)) add(findings, "P0", "coverage", "not-implemented-coverage", `not_implemented cannot claim positive coverage: ${entry.id}`, ids, "Set coverage to null/zero or correct the status");
  if (["real", "generated_real"].includes(entry.status) && numerator !== null && denominator !== null && denominator > 0 && !full) add(findings, "P0", "coverage", "real-coverage-incomplete", `${entry.status} claims incomplete coverage: ${entry.id}`, ids, "Use partial status or correct the coverage claim");
  if (entry.status === "partial" && full) add(findings, "P1", "coverage", "partial-full-coverage", `partial entry reports full coverage: ${entry.id}`, ids, "Explain the non-coverage limitation or use a consistent status", { blocking: false });
  const textClaimsFull = /\b(?:full|complete|100%)\b|全量|完整覆盖/i.test(`${coverage.note ?? ""} ${entry.block}`);
  if (textClaimsFull && !full) add(findings, "P0", "coverage", "coverage-text-conflict", `Coverage text claims full coverage but counts do not: ${entry.id}`, ids, "Align coverage text and counts");
  if (entry.status === "unknown" && (numerator !== null || denominator !== null)) add(findings, "P0", "coverage", "unknown-coverage-known", `unknown status must keep coverage null: ${entry.id}`, ids, "Set coverage to null or choose a known status");
}

export function validateRegistryEntries(entries, rootPath, { requireRequiredIds = true } = {}) {
  const findings = [];
  const packageJson = fs.existsSync(path.join(rootPath, "package.json")) ? JSON.parse(fs.readFileSync(path.join(rootPath, "package.json"), "utf8")) : { scripts: {} };
  for (const entry of entries) {
    const ids = [entry.id].filter(Boolean);
    if (!entry.id || !entry.status || !entry.sourceType) add(findings, "P0", "registry", "registry-shape", "Registry entry is missing id/status/sourceType", ids, "Add all required registry fields");
    if (!ALLOWED_STATUSES.includes(entry.status) || !ALLOWED_STATUSES.includes(entry.sourceType)) add(findings, "P0", "registry", "invalid-status", `Invalid registry status: ${entry.id ?? "unknown"}`, ids, "Use an allowed status enum");
    if (["real", "generated_real"].includes(entry.status) && !entry.provider) add(findings, "P0", "provenance", "provider-missing", `${entry.status} requires provider: ${entry.id}`, ids, "Declare the provider or downgrade status");
    if (entry.status === "generated_real" && !entry.generatedBy) add(findings, "P0", "provenance", "generator-missing", `generated_real requires generatedBy: ${entry.id}`, ids, "Point to an existing generator script");
    if (!["not_implemented", "source_unavailable", "unknown"].includes(entry.status) && !entry.storageLocation) add(findings, "P0", "path", "storage-missing", `Materialized data entry requires storageLocation: ${entry.id}`, ids, "Declare an existing source/data storage location or correct the status");

    if (entry.storageLocation) {
      const resolved = resolveStorage(rootPath, entry.storageLocation);
      if (!resolved || !withinRoot(rootPath, resolved) || /(^|[\\/])(?:dist|build|coverage)([\\/]|$)/i.test(resolved) || !fs.existsSync(resolved)) add(findings, "P0", "path", "storage-invalid", `storageLocation is missing, outside the project, or a build artifact: ${entry.id}`, ids, "Point to an existing source/data file inside the project");
    }
    for (const [field, expression] of [["summaryLocation", entry.summaryLocation], ["manifestLocation", entry.manifestLocation]]) {
      if (!expression) continue;
      const resolved = resolveStorage(rootPath, expression);
      if (!resolved || !withinRoot(rootPath, resolved) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) add(findings, "P0", "path", `${field}-invalid`, `${field} is missing or invalid: ${entry.id}`, ids, `Point ${field} to an existing project file`);
    }
    if (entry.detailLocationPattern) {
      const rawPattern = entry.detailLocationPattern.match(/publicData\("([^"]+)"\)/)?.[1] ?? entry.detailLocationPattern.match(/^"([^"]+)"$/)?.[1];
      const matches = rawPattern ? wildcardMatches(rootPath, rawPattern.startsWith("public/") ? rawPattern : `public/data/${rawPattern}`) : [];
      if (matches.length === 0) add(findings, "P0", "path", "detailLocationPattern-invalid", `detailLocationPattern has no files: ${entry.id}`, ids, "Point to the committed per-company detail directory");
    }

    if (entry.generatedBy) {
      const npmScript = entry.generatedBy.match(/^npm run ([\w:-]+)$/)?.[1];
      const paths = generatorPaths(entry.generatedBy);
      const invalidSyntax = /[*?{}]/.test(entry.generatedBy) || (!npmScript && paths.length === 0);
      if (npmScript && !packageJson.scripts?.[npmScript]) add(findings, "P0", "path", "generator-script-missing", `generatedBy npm script does not exist: ${entry.id}`, ids, "Reference an existing package.json script");
      if (npmScript && packageJson.scripts?.[npmScript]) {
        const scriptPaths = generatorPaths(packageJson.scripts[npmScript]);
        if (scriptPaths.length === 0 || scriptPaths.some((item) => { const resolved = path.resolve(rootPath, item); return !withinRoot(rootPath, resolved) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile(); })) add(findings, "P0", "path", "generator-script-target-invalid", `generatedBy npm script has no verifiable generator target: ${entry.id}`, ids, "Make the package script invoke an existing project generator file");
      }
      if (invalidSyntax || paths.some((item) => { const resolved = path.resolve(rootPath, item); return !withinRoot(rootPath, resolved) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile(); })) add(findings, "P0", "path", "generator-path-invalid", `generatedBy contains no verifiable existing generator path: ${entry.id}`, ids, "Use one or more existing project-relative script paths");
    }

    if (entry.isDisplayed === "true" && entry.frontendConsumers.length === 0) add(findings, "P0", "consumer", "consumer-missing", `Displayed entry has no frontendConsumers: ${entry.id}`, ids, "Declare a production frontend source consumer");
    if (new Set(entry.frontendConsumers).size !== entry.frontendConsumers.length) add(findings, "P2", "consumer", "consumer-duplicate", `Duplicate frontendConsumer: ${entry.id}`, ids, "Remove duplicate consumer declarations", { blocking: false });
    for (const consumer of new Set(entry.frontendConsumers)) {
      const matches = wildcardMatches(rootPath, consumer).filter((item) => /^src\//.test(item) && /\.(?:ts|tsx|js|jsx)$/.test(item) && !/(?:\.test\.|\.spec\.|__tests__)/.test(item));
      if (matches.length === 0) add(findings, "P0", "consumer", "consumer-path-invalid", `frontendConsumer is not a production frontend source: ${consumer}`, ids, "Point to at least one existing non-test frontend source file", { file: consumer });
    }

    const provenanceText = `${entry.provider ?? ""} ${entry.storageLocation ?? ""} ${entry.generatedBy ?? ""}`;
    if (["real", "generated_real"].includes(entry.status) && /mock|sample|placeholder|fixture/i.test(provenanceText)) add(findings, "P0", "provenance", "real-from-mock", `Real status points to mock/sample/placeholder provenance: ${entry.id}`, ids, "Use real provenance or downgrade the status");
    if (["mock", "placeholder"].includes(entry.status) && (entry.isDisplayed === "true" || entry.frontendConsumers.length > 0)) add(findings, "P0", "production-route", "mock-production-route", `Mock/placeholder data enters a production route: ${entry.id}`, ids, "Remove the production consumer or replace the data source");
    if (entry.status === "not_implemented" && /\b(?:available|valid|normal|complete|supported)\b|可用|已接入|完整覆盖/i.test(entry.block)) add(findings, "P0", "consistency", "not-implemented-available", `not_implemented is described as available: ${entry.id}`, ids, "Keep the entry explicitly unavailable");
    validateCoverage(entry, findings);
  }
  if (requireRequiredIds) for (const required of REQUIRED_IDS) if (!entries.some((entry) => entry.id === required)) add(findings, "P0", "registry", "registry-missing", `Missing required registry id: ${required}`, [required], "Add the required data category");
  const duplicates = entries.map((entry) => entry.id).filter((id, index, ids) => id && ids.indexOf(id) !== index);
  if (duplicates.length) add(findings, "P0", "registry", "duplicate-id", `Registry contains duplicate ids: ${[...new Set(duplicates)].join(", ")}`, [...new Set(duplicates)], "Make registry ids unique");
  return findings;
}

export function detectZeroFallbacks(files, rootPath) {
  const findings = [];
  const allowlisted = [];
  for (const file of files) {
    const relative = path.relative(rootPath, file).replaceAll("\\", "/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const matches = [...line.matchAll(/(?:\?\?|\|\|)\s*0|Number\([^\n]*(?:\?\?|\|\|)\s*0\)|parse(?:Float|Int)\([^\n]*\)\s*\|\|\s*0/g)];
      if (!matches.length) return;
      for (const match of matches) {
        const expression = match[0];
        const context = { relative, line, before: line.slice(0, match.index), after: line.slice(match.index + expression.length), expression };
        const safe = SAFE_ZERO_RULES.find((candidate) => candidate.test(context));
        if (safe) {
          allowlisted.push({ id: safe.id, file: relative, line: index + 1, expression, reason: safe.reason, scope: safe.scope });
          continue;
        }
        const financial = ZERO_RISK_WORDS.test(line);
        findings.push(finding({ severity: financial ? "P0" : "P2", blocking: financial, category: "missing-value", id: "missing-to-zero", title: `Missing value coercion: ${expression}`, file: relative, line: index + 1, recommendation: financial ? "Use an explicit missing/unavailable state; do not display zero" : "Document a narrow safe fallback or use a typed default" }));
      }
    });
  }
  return { findings, allowlisted };
}

export function detectFinancialArchitectureRisks(files, rootPath) {
  const findings = [];
  const productionSources = files.filter((file) => /^src[\\/]/.test(path.relative(rootPath, file)) && /\.(?:ts|tsx|js|jsx)$/.test(file));
  for (const file of productionSources) {
    const relative = path.relative(rootPath, file).replaceAll("\\", "/");
    const text = fs.readFileSync(file, "utf8");
    if (/from\s+["'][^"']*a-share-financials\.generated\.json["']/.test(text)) {
      add(findings, "P0", "bundle", "financial-history-static-import", `Production code statically imports full A-share financial history: ${relative}`, ["a-share-financials"], "Import only the generated summary and load detail files through the manifest", { file: relative });
    }
  }
  const providerPath = path.join(rootPath, "src/services/providers/aStockDataProvider.ts");
  const stockProviderPath = path.join(rootPath, "src/services/stockProvider.ts");
  const drawerPath = path.join(rootPath, "src/components/stock/StockDetailDrawer.tsx");
  const formatterPath = path.join(rootPath, "src/utils/financialDisplay.ts");
  const loaderPath = path.join(rootPath, "src/services/aShareFinancialLoader.ts");
  const requiredTexts = [providerPath, stockProviderPath, drawerPath, formatterPath, loaderPath];
  if (requiredTexts.some((file) => !fs.existsSync(file))) {
    add(findings, "P0", "financial-architecture", "financial-lazy-load-files-missing", "Financial lazy-load production files are incomplete", ["a-share-financials", "hk-financials"], "Add the summary provider, manifest loader, fallback resolver and drawer integration");
    return findings;
  }
  const provider = fs.readFileSync(providerPath, "utf8");
  const stockProvider = fs.readFileSync(stockProviderPath, "utf8");
  const drawer = fs.readFileSync(drawerPath, "utf8");
  const formatter = fs.readFileSync(formatterPath, "utf8");
  const loader = fs.readFileSync(loaderPath, "utf8");
  if (!provider.includes("a-share-financial-summaries.generated.json") || provider.includes("a-share-financials.generated.json")) add(findings, "P0", "bundle", "financial-summary-provider-invalid", "Synchronous data provider must load only the A-share financial summary", ["a-share-financials"], "Replace full-history imports with the generated summary", { file: path.relative(rootPath, providerPath).replaceAll("\\", "/") });
  if (!loader.includes("manifest.generated.json") || !loader.includes("entry.relativePath") || !loader.includes("inFlight")) add(findings, "P0", "financial-architecture", "financial-loader-contract-missing", "A-share financial loader lacks manifest allowlisting or request deduplication", ["a-share-financials"], "Resolve paths only through the validated manifest and cache in-flight requests", { file: path.relative(rootPath, loaderPath).replaceAll("\\", "/") });
  if (!stockProvider.includes("resolveFinancialDisplayValue") || !stockProvider.includes("aShareFinancialSummaries")) add(findings, "P0", "production-route", "financial-real-fallback-unsafe", "Real/Mixed financial display is not routed through the centralized no-mock resolver", ["a-share-financials", "hk-financials"], "Use financial summaries and explicit unavailable states", { file: path.relative(rootPath, stockProviderPath).replaceAll("\\", "/") });
  if (!drawer.includes("港股财务数据暂未接入") || !drawer.includes("shouldLoadAShareFinancial")) add(findings, "P0", "production-route", "hk-financial-unavailable-ui-missing", "HK financials can enter the A-share loader or lack an explicit unavailable state", ["hk-financials"], "Do not request A-share details for HK stocks and show the not-implemented label", { file: path.relative(rootPath, drawerPath).replaceAll("\\", "/") });
  if (!formatter.includes("denominator_zero") || !formatter.includes("baseSign === \"negative\"") || !formatter.includes("上期为负，需谨慎解读")) add(findings, "P0", "financial-semantics", "financial-change-base-warning-missing", "Financial change formatting does not disclose zero or negative comparison bases", ["a-share-financials"], "Format denominator_zero as not applicable and negative bases with a caution", { file: path.relative(rootPath, formatterPath).replaceAll("\\", "/") });

  const legacyPath = path.join(rootPath, "src/data/real/a-share-financials.generated.json");
  const summaryPath = path.join(rootPath, "src/data/real/a-share-financial-summaries.generated.json");
  const manifestPath = path.join(rootPath, "public/data/a-share-financials/manifest.generated.json");
  const detailDir = path.dirname(manifestPath);
  if (fs.existsSync(legacyPath)) add(findings, "P0", "bundle", "financial-monolith-present", "Legacy full-history financial JSON remains in the synchronous data directory", ["a-share-financials"], "Remove the monolith after publishing split artifacts", { file: path.relative(rootPath, legacyPath).replaceAll("\\", "/") });
  if (!fs.existsSync(summaryPath) || !fs.existsSync(manifestPath)) add(findings, "P0", "path", "financial-split-artifacts-missing", "Financial summary or manifest is missing", ["a-share-financials"], "Generate and commit both split artifacts");
  else {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const detailFiles = fs.readdirSync(detailDir).filter((name) => name.endsWith(".json") && name !== "manifest.generated.json");
      if (manifest.total !== 56 || manifest.items?.length !== 56 || Object.keys(summary.items ?? {}).length !== 56 || detailFiles.length !== 56) add(findings, "P0", "coverage", "financial-split-count-mismatch", "Financial summary, manifest and detail directory must each cover 56 companies", ["a-share-financials"], "Regenerate split artifacts and remove orphan/missing files");
    } catch {
      add(findings, "P0", "schema", "financial-split-json-invalid", "Financial summary or manifest JSON is invalid", ["a-share-financials"], "Regenerate valid UTF-8 JSON artifacts");
    }
  }
  return findings;
}

export function detectAnnouncementArchitectureRisks(files, rootPath) {
  const findings = [];
  const productionSources = files.filter((file) => /^src[\\/]/.test(path.relative(rootPath, file)) && /\.(?:ts|tsx|js|jsx)$/.test(file));
  for (const file of productionSources) {
    const relative = path.relative(rootPath, file).replaceAll("\\", "/");
    const text = fs.readFileSync(file, "utf8");
    if (/from\s+["'][^"']*(?:a-share-)?announcements\.generated\.json["']/.test(text) || /from\s+["'][^"']*a-share-announcements\/[^"']+\.json["']/.test(text)) {
      add(findings, "P0", "bundle", "announcement-history-static-import", `Production code statically imports full A-share announcement history: ${relative}`, ["announcements"], "Import only the generated summary and resolve company details through the manifest", { file: relative });
    }
  }

  const providerPath = path.join(rootPath, "src/services/providers/aStockDataProvider.ts");
  const stockProviderPath = path.join(rootPath, "src/services/stockProvider.ts");
  const drawerPath = path.join(rootPath, "src/components/stock/StockDetailDrawer.tsx");
  const loaderPath = path.join(rootPath, "src/services/aShareAnnouncementLoader.ts");
  if ([providerPath, stockProviderPath, drawerPath, loaderPath].some((file) => !fs.existsSync(file))) {
    add(findings, "P0", "announcement-architecture", "announcement-lazy-load-files-missing", "Announcement lazy-load production files are incomplete", ["announcements", "earnings-preview", "earnings-flash"], "Add the summary provider, manifest loader and drawer integration");
    return findings;
  }
  const provider = fs.readFileSync(providerPath, "utf8");
  const stockProvider = fs.readFileSync(stockProviderPath, "utf8");
  const drawer = fs.readFileSync(drawerPath, "utf8");
  const loader = fs.readFileSync(loaderPath, "utf8");
  if (!provider.includes("a-share-announcement-summaries.generated.json") || provider.includes("announcements.generated.json")) add(findings, "P0", "bundle", "announcement-summary-provider-invalid", "Synchronous data provider must load only A-share announcement summaries", ["announcements"], "Remove legacy/full-history imports from the synchronous provider", { file: path.relative(rootPath, providerPath).replaceAll("\\", "/") });
  if (!loader.includes("manifest.generated.json") || !loader.includes("entry.relativePath") || !loader.includes("inFlight") || !loader.includes("SAFE_PATH")) add(findings, "P0", "announcement-architecture", "announcement-loader-contract-missing", "Announcement loader lacks manifest allowlisting or request deduplication", ["announcements"], "Resolve only validated manifest paths and deduplicate in-flight requests", { file: path.relative(rootPath, loaderPath).replaceAll("\\", "/") });
  if (!stockProvider.includes("aShareAnnouncementSummaries") || !stockProvider.includes("港股公告数据暂未接入")) add(findings, "P0", "production-route", "announcement-real-fallback-unsafe", "Real/Mixed announcements can fall back to static data or HK lacks an explicit unavailable state", ["announcements"], "Use real summaries only and retain mock announcements only in mock mode", { file: path.relative(rootPath, stockProviderPath).replaceAll("\\", "/") });
  if (!drawer.includes("shouldLoadAShareAnnouncements") || !drawer.includes("港股公告数据暂未接入") || !drawer.includes("不生成“超预期/不及预期”判断")) add(findings, "P0", "announcement-semantics", "announcement-ui-boundary-missing", "Announcement UI lacks A-share-only loading, HK unavailable state, or subjective-judgment boundary", ["announcements", "earnings-preview"], "Keep HK unavailable and show only disclosed facts without outperform/underperform judgments", { file: path.relative(rootPath, drawerPath).replaceAll("\\", "/") });

  const summaryPath = path.join(rootPath, "src/data/real/a-share-announcement-summaries.generated.json");
  const manifestPath = path.join(rootPath, "public/data/a-share-announcements/manifest.generated.json");
  const detailDir = path.dirname(manifestPath);
  if (!fs.existsSync(summaryPath) || !fs.existsSync(manifestPath)) add(findings, "P0", "path", "announcement-split-artifacts-missing", "Announcement summary or manifest is missing", ["announcements"], "Generate and commit the summary, manifest and company details");
  else {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const detailFiles = fs.readdirSync(detailDir).filter((name) => name.endsWith(".json") && name !== "manifest.generated.json");
      if (manifest.totalCompanies !== 56 || manifest.items?.length !== 56 || Object.keys(summary.items ?? {}).length !== 56 || detailFiles.length !== 56) add(findings, "P0", "coverage", "announcement-split-count-mismatch", "Announcement summary, manifest and detail directory must each cover 56 companies", ["announcements"], "Regenerate split artifacts and remove orphan/missing files");
    } catch {
      add(findings, "P0", "schema", "announcement-split-json-invalid", "Announcement summary or manifest JSON is invalid", ["announcements"], "Regenerate valid UTF-8 JSON artifacts");
    }
  }
  return findings;
}

export function detectCompanyGuidanceArchitectureRisks(files, rootPath) {
  const findings = [];
  const registryIds = ["expectation-company-guidance", "expectation-company-guidance-provider"];
  const productionSources = files.filter((file) => /^src[\\/]/.test(path.relative(rootPath, file)) && /\.(?:ts|tsx|js|jsx)$/.test(file));
  for (const file of productionSources) {
    const relative = path.relative(rootPath, file).replaceAll("\\", "/");
    const text = fs.readFileSync(file, "utf8");
    if (/from\s+["'][^"']*a-share-company-guidance-expectations\/[^"']+\.json["']/.test(text)) {
      add(findings, "P0", "bundle", "company-guidance-detail-static-import", `Production code statically imports a per-company guidance detail: ${relative}`, registryIds, "Import only the generated summary and resolve company details through the manifest", { file: relative });
    }
  }

  const loaderPath = path.join(rootPath, "src/services/companyGuidanceExpectationProvider.ts");
  const generatorPath = path.join(rootPath, "scripts/generate-company-guidance-expectations.mjs");
  const validatorPath = path.join(rootPath, "scripts/validate-company-guidance-expectations.mjs");
  const storePath = path.join(rootPath, "src/services/earningsExpectationStore.ts");
  const appPath = path.join(rootPath, "src/App.tsx");
  const summaryPath = path.join(rootPath, "src/data/real/a-share-company-guidance-expectation-summaries.generated.json");
  const manifestPath = path.join(rootPath, "public/data/a-share-company-guidance-expectations/manifest.generated.json");
  const workflowPath = path.join(rootPath, "public/data/a-share-company-guidance-expectations/workflow-index.generated.json");
  const detailDir = path.dirname(manifestPath);
  if ([loaderPath, generatorPath, validatorPath, storePath, appPath, summaryPath, manifestPath, workflowPath].some((file) => !fs.existsSync(file))) {
    add(findings, "P0", "company-guidance-architecture", "company-guidance-provider-files-missing", "Company guidance Provider production files or split artifacts are incomplete", registryIds, "Generate and commit the summary, manifest, details, loader and read-only Store guard");
    return findings;
  }

  const loader = fs.readFileSync(loaderPath, "utf8");
  const generator = fs.readFileSync(generatorPath, "utf8");
  const validator = fs.readFileSync(validatorPath, "utf8");
  const store = fs.readFileSync(storePath, "utf8");
  const app = fs.readFileSync(appPath, "utf8");
  if (!loader.includes("a-share-company-guidance-expectation-summaries.generated.json") || !loader.includes("manifest.generated.json") || !loader.includes("SAFE_DETAIL_PATH") || !loader.includes("inFlight") || !loader.includes("loadWorkflow") || !loader.includes("Promise.allSettled")) add(findings, "P0", "company-guidance-architecture", "company-guidance-loader-contract-missing", "Company guidance loader lacks workflow-index verification, detail allowlisting, all-settled isolation or in-flight deduplication", registryIds, "Verify the global workflow index and load per-company details with isolated failures", { file: path.relative(rootPath, loaderPath).replaceAll("\\", "/") });
  if (!loader.includes("parseOfficialCninfoAnnouncementUrl") || !loader.includes("content_conflict") || !loader.includes("providerCorrectsVersionId")) add(findings, "P0", "company-guidance-architecture", "company-guidance-evidence-contract-missing", "Provider strict URL, evidence relation or immutable version contracts are missing", registryIds, "Keep strict official URL parsing, four-way relations and provider version links in the shared loader", { file: path.relative(rootPath, loaderPath).replaceAll("\\", "/") });
  if (!loader.includes("let epoch = 0") || !loader.includes("requestEpoch !== epoch") || !loader.includes("inFlight.get(stockId) === guarded") || !loader.includes("manifestRequest?.promise === request") || !loader.includes("workflowRequest?.promise === request")) add(findings, "P0", "company-guidance-architecture", "company-guidance-loader-epoch-guard-missing", "Company guidance loader lacks deterministic stale-request isolation after clearCache", registryIds, "Guard detail, manifest and workflow requests with epoch and Promise identity checks", { file: path.relative(rootPath, loaderPath).replaceAll("\\", "/") });
  if (!generator.includes("readPreviousProviderDetails") || !generator.includes("existing provider manifest") || !generator.includes("writeArtifactsTransaction") || !generator.includes("ArtifactTransactionCleanupError") || !generator.includes("stagedValidation")) add(findings, "P0", "company-guidance-architecture", "company-guidance-generator-integrity-guard-missing", "Company guidance generator lacks previous-manifest fail-closed checks or recoverable staged activation", registryIds, "Read all prior details from the prior Provider manifest and activate detail/summary artifacts transactionally", { file: path.relative(rootPath, generatorPath).replaceAll("\\", "/") });
  if (!validator.includes("unexpected provider json") || !validator.includes("duplicate manifest stockId") || !validator.includes("summary stockId missing") || !validator.includes("workflow index does not exactly mirror")) add(findings, "P0", "company-guidance-architecture", "company-guidance-offline-reverse-audit-missing", "Company guidance offline validator does not reverse-enumerate directory, identity and summary/workflow sets", registryIds, "Reject orphan JSON, duplicate manifest identities, summary set drift and workflow/detail drift", { file: path.relative(rootPath, validatorPath).replaceAll("\\", "/") });
  if (!app.includes("selectActiveCompanyGuidanceProviderRecords") || !app.includes('dataMode === "mock"') || !app.includes("companyGuidanceRequestGeneration") || !app.includes("loadWorkflow")) add(findings, "P0", "company-guidance-architecture", "company-guidance-global-mode-guard-missing", "App does not prove navigation-independent global Provider loading and mock/request-generation isolation", registryIds, "Load the verified workflow index independently of navigation and close Provider in mock mode", { file: path.relative(rootPath, appPath).replaceAll("\\", "/") });
  if (!store.includes('ingestionMethod === "provider"')) add(findings, "P0", "production-route", "company-guidance-provider-write-guard-missing", "User expectation Store does not explicitly reject Provider writes", registryIds, "Reject Provider snapshots before any LocalStorage mutation", { file: path.relative(rootPath, storePath).replaceAll("\\", "/") });

  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const detailFiles = fs.readdirSync(detailDir).filter((name) => name.endsWith(".json") && name !== "manifest.generated.json" && name !== "workflow-index.generated.json");
    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
    if (summary.providerId !== "cninfo-company-guidance" || manifest.providerId !== "cninfo-company-guidance") add(findings, "P0", "schema", "company-guidance-provider-identity-mismatch", "Company guidance summary or manifest has an unexpected provider identity", registryIds, "Regenerate artifacts with the fixed V1 provider identity");
    if (manifest.totalCompanies !== 56 || manifest.items?.length !== 56 || Object.keys(summary.items ?? {}).length !== 56 || detailFiles.length !== 56) add(findings, "P0", "coverage", "company-guidance-split-count-mismatch", "Company guidance summary, manifest and detail directory must each cover 56 company states", registryIds, "Regenerate split artifacts and remove orphan/missing files");
    if (manifest.companiesWithSnapshots !== 15 || manifest.totalSnapshots !== 56 || summary.audit?.reliableCompanyCount !== 15 || summary.audit?.reliableSnapshotCount !== 56) add(findings, "P0", "coverage", "company-guidance-audit-count-mismatch", "Company guidance manifest and feasibility audit counts disagree", registryIds, "Regenerate artifacts from the committed announcement inputs and validate counts");
    if (manifest.schemaVersion !== "2.0.0" || workflow.schemaVersion !== "2.0.0" || workflow.currentSnapshotCount !== 56 || workflow.records?.length !== 56) add(findings, "P0", "schema", "company-guidance-workflow-contract-mismatch", "Company guidance V2 workflow index count/schema mismatch", registryIds, "Regenerate and deep-validate the V2 workflow index");
    if (workflow.records?.some((record) => !record.isCurrentVersion || record.snapshot?.id !== record.providerSnapshotVersionId || record.snapshot?.correctsSnapshotId !== null)) add(findings, "P0", "schema", "company-guidance-current-version-mismatch", "Workflow index contains a non-current, identity-mismatched or conflated correction record", registryIds, "Keep only current immutable Provider versions and separate business revisions from extraction corrections");
  } catch {
    add(findings, "P0", "schema", "company-guidance-split-json-invalid", "Company guidance summary or manifest JSON is invalid", registryIds, "Regenerate valid UTF-8 JSON artifacts");
  }
  return findings;
}

export function detectProviderObservabilityRisks(rootPath) {
  const findings = [];
  const configPath = path.join(rootPath, "config/provider-stability-gate-v1.json");
  const runnerPath = path.join(rootPath, "scripts/observe-providers.py");
  const healthPath = path.join(rootPath, "scripts/provider-health.py");
  const corePath = path.join(rootPath, "scripts/provider_observability/core.py");
  const provenancePath = path.join(rootPath, "scripts/provider_observability/provenance.py");
  const productionPath = path.join(rootPath, "scripts/provider_observability/production.py");
  const schemaPath = path.join(rootPath, "config/provider-observation-run.schema.json");
  const testPath = path.join(rootPath, "scripts/tests/test_provider_observability.py");
  const packagePath = path.join(rootPath, "package.json");
  const ignorePath = path.join(rootPath, ".gitignore");
  const ciPath = path.join(rootPath, ".github/workflows/ci.yml");
  if ([configPath, runnerPath, healthPath, corePath, provenancePath, productionPath, schemaPath, testPath].some((file) => !fs.existsSync(file))) {
    add(findings, "P0", "provider-observability", "provider-observability-files-missing", "Provider stability gate files are incomplete", ["a-share-financials", "announcements"], "Add the config, isolated runner, health evaluator and offline tests");
    return findings;
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.schemaVersion !== "1.0.0" || config.minimumDistinctDays < 5 || config.minimumRunsPerProvider < 10 || config.minimumSuccessfulDaysPerProvider < 5 || config.expectedCompanies !== 56) add(findings, "P0", "provider-observability", "provider-eligibility-config-invalid", "Provider eligibility config weakens the V1 minimum window", ["a-share-financials", "announcements"], "Restore the documented minimum observation thresholds");
  } catch {
    add(findings, "P0", "provider-observability", "provider-eligibility-config-invalid", "Provider eligibility config is invalid JSON", ["a-share-financials", "announcements"], "Commit valid UTF-8 JSON config");
  }
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const scripts = packageJson.scripts ?? {};
  for (const name of ["data:observe:providers", "data:observe:financials:a", "data:observe:announcements:a", "data:health:providers", "data:refresh:eligibility", "test:provider-observability"]) {
    if (!scripts[name]) add(findings, "P0", "provider-observability", "provider-observability-command-missing", `Missing provider observability command: ${name}`, ["a-share-financials", "announcements"], "Restore the offline-safe observation command contract");
  }
  if (/financials:a|announcements:a|observe:providers/.test(scripts["data:refresh"] ?? "")) add(findings, "P0", "production-route", "unqualified-provider-in-default-refresh", "Default data:refresh includes an unqualified provider", ["a-share-financials", "announcements"], "Keep providers independent until the eligibility gate qualifies them");
  if (!fs.readFileSync(ignorePath, "utf8").split(/\r?\n/).includes(".provider-observations/")) add(findings, "P0", "credentials", "provider-observation-output-not-ignored", "Local provider observation output is not ignored", ["a-share-financials", "announcements"], "Ignore .provider-observations/");
  const runner = fs.readFileSync(runnerPath, "utf8");
  if (!runner.includes("--output-root") || !runner.includes("productionUnchanged") || !runner.includes("redact")) add(findings, "P0", "provider-observability", "provider-observation-isolation-missing", "Observation runner lacks isolated output, production checksum, or redaction", ["a-share-financials", "announcements"], "Write only under the ignored observation root and verify production remains unchanged");
  if (!runner.includes("observation_eligibility(git_status()") || !runner.includes("preflight_failed")) add(findings, "P0", "provider-observability", "provider-observation-dirty-preflight-missing", "Default provider observation does not reject a dirty worktree before network execution", ["a-share-financials", "announcements"], "Run the clean-worktree preflight before calling either provider");
  const core = fs.readFileSync(corePath, "utf8");
  const provenance = fs.readFileSync(provenancePath, "utf8");
  if (!core.includes("expectedExpired") || !core.includes("unexpectedRemoved") || !core.includes("unverifiableRemoved") || !core.includes("windowShiftDays")) add(findings, "P0", "provider-observability", "announcement-window-diff-incomplete", "Announcement diff does not distinguish expiry, overlap removal and unverifiable removal", ["announcements"], "Classify removals against the previous/current window overlap");
  if (!core.includes("def tree_digest(paths: list[Path], relative_to: Path)") || !core.includes("PurePosixPath") || !core.includes("path.relative_to(root)")) add(findings, "P0", "provider-observability", "artifact-checksum-unstable", "Artifact checksum is not rooted in stable logical relative paths", ["a-share-financials", "announcements"], "Hash normalized relative paths and raw bytes, never absolute run directories");
  if (!core.includes('"data_value_drift"') || !core.match(/BLOCKING_FAILURES\s*=\s*\{[\s\S]*?"data_value_drift"/)) add(findings, "P0", "provider-observability", "financial-drift-not-blocking", "Same-period financial data drift is not a blocking failure", ["a-share-financials"], "Keep data_value_drift blocking until explicitly resolved");
  if (!core.includes("completeSuccessRate") || !core.includes("totalSuccessRate") || !core.includes("completeSuccessRuns") || !core.includes("usableRuns")) add(findings, "P0", "provider-observability", "provider-success-rates-aliased", "Complete and total success rates are not independently derived", ["a-share-financials", "announcements"], "Compute complete success from success runs and total success from usable success/partial runs");
  if (!core.includes("append_resolution") || !core.includes("provider-health-resolutions.jsonl") || !fs.readFileSync(healthPath, "utf8").includes("--resolve")) add(findings, "P0", "provider-observability", "provider-resolution-ledger-missing", "Controlled append-only failure resolution is missing", ["a-share-financials", "announcements"], "Resolve referenced failures through the separate resolution ledger CLI");
  if (!runner.includes("build_provenance") || !core.includes("legacyRuns") || !core.includes("incompatibleRuns") || !provenance.includes("stockUniverseChecksum") || !provenance.includes("provenanceCohortId")) add(findings, "P0", "provider-observability", "provider-provenance-cohort-missing", "Provider observation V2 lacks deterministic provenance cohorts or legacy separation", ["a-share-financials", "announcements"], "Fingerprint provider code, validators, stock identities, gate, dependencies and production baseline; count only the current compatible cohort");
  const production = fs.readFileSync(productionPath, "utf8");
  const health = fs.readFileSync(healthPath, "utf8");
  if (!production.includes("validate_split_artifacts") || !production.includes("validate_artifacts") || !production.includes('scripts/data-audit.mjs') || !production.includes("validate_default_refresh") || !health.includes("validate_production(ROOT)")) add(findings, "P0", "provider-observability", "provider-production-gate-hardcoded", "Provider health does not perform real offline production validation", ["a-share-financials", "announcements"], "Reuse committed artifact validators and structured data audit output");
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const required = new Set(schema.required ?? []);
    if (schema.properties?.schemaVersion?.const !== "2.0.0" || schema.additionalProperties !== false || ["metrics", "difference", "failures", "validation", "atomicity", "worktree", "artifacts", "provenance"].some((field) => !required.has(field)) || !schema.properties?.failures?.items?.properties?.category?.enum) add(findings, "P0", "provider-observability", "provider-observation-schema-incomplete", "Provider observation JSON Schema lacks V2 provenance or core constraints", ["a-share-financials", "announcements"], "Constrain V2 provenance, core objects, dates, metrics and failure categories");
  } catch {
    add(findings, "P0", "provider-observability", "provider-observation-schema-incomplete", "Provider observation JSON Schema is invalid", ["a-share-financials", "announcements"], "Commit valid Draft 2020-12 JSON Schema");
  }
  const test = fs.readFileSync(testPath, "utf8");
  if (!test.includes("first_day_insufficient") || !test.includes("sensitive_detected") || !test.includes("default_refresh_unchanged") || !test.includes("expected_expiry") || !test.includes("resolution_unblocks_failure") || !test.includes("legacy_run_excluded") || !test.includes("cross_cohort_replacement_rejected")) add(findings, "P0", "provider-observability", "provider-observability-negative-tests-missing", "Provider observability lacks mandatory window, secret, refresh, provenance-cohort or resolution tests", ["a-share-financials", "announcements"], "Restore the mandatory offline negative tests");
  if (!fs.existsSync(ciPath) || !fs.readFileSync(ciPath, "utf8").includes("test:provider-observability")) add(findings, "P0", "ci", "provider-observability-ci-missing", "CI does not run offline provider observability tests", ["a-share-financials", "announcements"], "Run test:provider-observability without live network access");
  return findings;
}

function capabilityRisks(entries) {
  return entries.flatMap((entry) => {
    const base = { file: REGISTRY_FILE, registryIds: [entry.id], blocking: false };
    if (entry.status === "not_implemented") return [finding({ ...base, severity: "P1", category: "capability", id: "capability-gap", title: `Capability not implemented: ${entry.id}`, recommendation: "Keep the UI unavailable until a provider is approved" })];
    if (["manual_unverified", "inferred", "unknown"].includes(entry.status)) return [finding({ ...base, severity: "P2", category: "evidence", id: "evidence-governance", title: `Evidence requires verification: ${entry.id}`, recommendation: "Keep it labelled as a lead/inference until sourced" })];
    if (["partial", "stale", "conflicted", "source_unavailable"].includes(entry.status)) return [finding({ ...base, severity: "P1", category: "limitation", id: "data-limitation", title: `Data limitation: ${entry.id}`, recommendation: "Show the limitation and freshness state" })];
    return [];
  });
}

export function classifyRisks(risks) {
  const blockingRisks = risks.filter((risk) => risk.blocking && !risk.resolved);
  return { blockingRisks, errors: blockingRisks, warnings: risks.filter((risk) => !risk.blocking && !risk.resolved) };
}

export function auditExitCode(result) {
  return result.errors.length > 0 ? 1 : 0;
}

export function runAudit(rootPath) {
  const registryFile = path.join(rootPath, REGISTRY_FILE);
  const entries = parseRegistryEntries(fs.readFileSync(registryFile, "utf8"));
  const files = walkFiles(rootPath);
  const zeroResult = detectZeroFallbacks(files, rootPath);
  const risks = [...validateRegistryEntries(entries, rootPath), ...zeroResult.findings, ...detectFinancialArchitectureRisks(files, rootPath), ...detectAnnouncementArchitectureRisks(files, rootPath), ...detectCompanyGuidanceArchitectureRisks(files, rootPath), ...detectProviderObservabilityRisks(rootPath), ...capabilityRisks(entries)];
  return { entries, files, risks, ...classifyRisks(risks), allowlisted: zeroResult.allowlisted, skipped: SKIP_DIRS.size };
}

function countBy(items, field) {
  return Object.fromEntries([...new Set(items.map((item) => item[field]))].map((value) => [value, items.filter((item) => item[field] === value).length]));
}

export function renderReport(result) {
  const severities = Object.fromEntries(["P0", "P1", "P2", "P3"].map((severity) => [severity, result.risks.filter((item) => item.severity === severity && !item.resolved).length]));
  const rows = result.risks.length ? result.risks.map((risk) => `| ${risk.id} | ${risk.severity} | ${risk.blocking ? "yes" : "no"} | ${risk.category} | ${risk.title.replaceAll("|", "\\|")} | ${risk.file} | ${risk.line ?? "-"} | ${risk.registryIds.join(", ") || "-"} |`) : ["| - | - | - | - | No findings | - | - | - |"];
  return `# 数据真实性审计与数据源注册表 V1

- 执行时间：${new Date().toISOString()}
- 扫描文件：${result.files.length}
- 注册表条目：${result.entries.length}
- P0：${severities.P0}；P1：${severities.P1}；P2：${severities.P2}；P3：${severities.P3}
- errors：${result.errors.length}；warnings：${result.warnings.length}；skipped 目录：${result.skipped}；allowlist 命中：${result.allowlisted.length}
- 退出码：${auditExitCode(result)}

## 结论

审计门禁以未解决的 blocking 风险为唯一失败依据。所有 P0、注册表结构/路径/来源错误、coverage 矛盾、生产 mock 路由以及财务/估值/预测字段缺失转零均阻断并返回非零退出码。已知能力缺口和证据治理事项保留为非阻断 warning。

## 执行范围

- 递归扫描 src、scripts、public 中的 TS/TSX/JS/MJS/JSON，并排除依赖、构建、缓存、coverage 和 fixture 目录。
- 校验 21 个必需注册表类别、状态枚举、provider、storageLocation、generatedBy、frontendConsumers 与 coverage。
- Math.abs 仅允许出现在显式 sort/ranking/compare 上下文；普通渲染或计算不再享受宽泛豁免。

## 状态与风险统计

- 状态分布：${JSON.stringify(countBy(result.entries, "status"))}
- 风险分布：${JSON.stringify(severities)}
- 阻断风险：${result.errors.length}
- 非阻断风险：${result.warnings.length}

## 风险清单

| id | severity | blocking | category | title | file | line | registryIds |
|---|---|---|---|---|---|---:|---|
${rows.join("\n")}

## 门禁契约

- \`blockingRisks = risks.filter(risk => risk.blocking && !risk.resolved)\`。
- errors 等于 blockingRisks；warnings 等于未解决的非阻断风险。
- errors 非空时 \`npm run data:audit\` 返回 1，否则返回 0。
- 新增豁免必须包含 id、文件、表达式、原因和适用范围，禁止按目录或宽泛 Math.abs 模式整体放行。

## 当前能力边界

- 港股财务、公告、业绩预告/快报、券商研报和一致预期仍未接入，继续显示 unavailable/数据暂缺。
- 客户、供应商、产业链、技术路线、风险提示和 evidenceItems 中的人工或推断内容仍需逐条核验。
- 本次不新增金融数据 Provider，不改变股票池，不自动合并 PR。
`;
}

export function runSelfTests() {
  const root = fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "audit-fixture-"));
  const file = path.join(root, "fixture.ts");
  fs.writeFileSync(file, "const revenue = input?.revenue ?? 0;\nitems.sort((a,b) => Math.abs(a.sortValue ?? 0));\nconst plain = Math.abs(item.value ?? 0);", "utf8");
  const result = detectZeroFallbacks([file], root);
  fs.rmSync(root, { recursive: true, force: true });
  if (result.findings.length !== 2 || result.findings[0].severity !== "P0" || result.allowlisted.length !== 1) throw new Error("data audit self-test failed");
  return true;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runSelfTests();
  const result = runAudit(root);
  if (!process.argv.includes("--no-write")) fs.writeFileSync(path.join(root, "docs", "data-audit-v1.md"), renderReport(result), "utf8");
  const riskCounts = Object.fromEntries(["P0", "P1", "P2", "P3"].map((severity) => [severity, result.risks.filter((item) => item.severity === severity && !item.resolved).length]));
  const exit = auditExitCode(result);
  console.log(JSON.stringify({ scanned: result.files.length, registry: result.entries.length, ...riskCounts, errors: result.errors.length, warnings: result.warnings.length, skipped: result.skipped, allowlisted: result.allowlisted.length, exit }, null, process.argv.includes("--json") ? 0 : 2));
  if (exit) process.exitCode = exit;
}
