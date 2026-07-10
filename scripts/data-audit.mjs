import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_STATUSES = ["real", "generated_real", "manual_verified", "manual_unverified", "static_reference", "inferred", "mock", "placeholder", "stale", "conflicted", "partial", "not_implemented", "source_unavailable", "unknown"];
export const REQUIRED_IDS = ["a-share-quotes", "a-share-price-history", "hk-quotes", "hk-price-history", "a-share-financials", "hk-financials", "announcements", "earnings-preview", "earnings-flash", "broker-research", "institution-consensus", "eps-net-profit-forecast", "valuation", "industry-prosperity", "customer-relations", "supplier-relations", "industry-chain-position", "technical-route", "risk-alerts", "evidence-items"];
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
    const storageRaw = block.match(/storageLocation:\s*(null|generated\("[^"]+"\)|source\("[^"]+"\)|"[^"]+")/)?.[1];
    const frontendMatch = block.match(/frontendConsumers:\s*\[([^\]]*)\]/s);
    return {
      id: literal(block, "id"),
      status: literal(block, "status"),
      sourceType: literal(block, "sourceType"),
      provider: nullableString(block, "provider"),
      storageLocation: storageRaw === undefined || storageRaw === "null" ? null : storageRaw,
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
  const helper = expression?.match(/(generated|source)\("([^"]+)"\)/);
  const raw = expression?.match(/^"([^"]+)"$/)?.[1];
  if (!helper && !raw) return null;
  const relative = helper ? path.join(helper[1] === "generated" ? "src/data/real" : "src", helper[2]) : raw;
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
  const risks = [...validateRegistryEntries(entries, rootPath), ...zeroResult.findings, ...capabilityRisks(entries)];
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
  fs.writeFileSync(path.join(root, "docs", "data-audit-v1.md"), renderReport(result), "utf8");
  const riskCounts = Object.fromEntries(["P0", "P1", "P2", "P3"].map((severity) => [severity, result.risks.filter((item) => item.severity === severity && !item.resolved).length]));
  const exit = auditExitCode(result);
  console.log(JSON.stringify({ scanned: result.files.length, registry: result.entries.length, ...riskCounts, errors: result.errors.length, warnings: result.warnings.length, skipped: result.skipped, allowlisted: result.allowlisted.length, exit }, null, 2));
  if (exit) process.exitCode = exit;
}
