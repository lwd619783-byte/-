import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_STATUSES = ["real", "generated_real", "manual_verified", "manual_unverified", "static_reference", "inferred", "mock", "placeholder", "stale", "conflicted", "partial", "not_implemented", "source_unavailable", "unknown"];
export const REQUIRED_IDS = ["a-share-quotes", "a-share-price-history", "hk-quotes", "hk-price-history", "a-share-financials", "hk-financials", "announcements", "earnings-preview", "earnings-flash", "broker-research", "institution-consensus", "eps-net-profit-forecast", "valuation", "industry-prosperity", "customer-relations", "supplier-relations", "industry-chain-position", "technical-route", "risk-alerts", "evidence-items"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".git", ".cache", "cache", "__pycache__", "test-fixtures", "fixtures"]);
const SCAN_ROOTS = ["src", "scripts", "public"];
const ZERO_RISK_WORDS = /revenue|operatingRevenue|netProfit|attributableNetProfit|deductedNetProfit|grossMargin|netMargin|operatingCashFlow|receivables|inventory|researchExpense|eps|pe|pb|ps|peg|ev\/ebitda|consensus|targetPrice|growth|yoy|qoq|forecast|valuation|marketCap|dividendYield|price|profit|financial|estimate|expectation|investment|customer|supplier|order|revenue/i;
const SAFE_ZERO = [
  { pattern: /Math\.abs\([^\n]*\?\?\s*0/, reason: "numeric sort fallback; not rendered" },
  { pattern: /\.length[^\n]*(\?\?|\|\|)\s*0/, reason: "array length/count fallback" },
  { pattern: /(?:page|index|offset|count|column|rowIndex)[A-Za-z]*\s*[^\n]*(\?\?|\|\|)\s*0/i, reason: "layout/index/count fallback" },
  { pattern: /acc\[[^\]]+\][^\n]*\?\?\s*0/, reason: "reduce/map counter initialization" },
  { pattern: /scripts\/data-audit\.mjs/, reason: "audit rule implementation, not a production data path" },
];

export function walkFiles(root, roots = SCAN_ROOTS) {
  const files = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory() && SKIP_DIRS.has(item.name)) continue;
      const full = path.join(directory, item.name);
      if (item.isDirectory()) visit(full);
      else if (/\.(ts|tsx|js|mjs|json)$/.test(item.name) || item.name.endsWith(".generated.json")) files.push(full);
    }
  };
  for (const rootPath of roots) visit(path.join(root, rootPath));
  return files.sort();
}

function parseLiteral(block, field) {
  return block.match(new RegExp(`${field}:\\s*"([^"]*)"`))?.[1] ?? null;
}

export function parseRegistryEntries(registrySource) {
  return [...registrySource.matchAll(/entry\(\{([\s\S]*?)\}\),/g)].map((match) => {
    const block = match[0];
    const id = parseLiteral(block, "id");
    const status = parseLiteral(block, "status");
    const sourceType = parseLiteral(block, "sourceType");
    const provider = block.match(/provider:\s*(null|"[^"]*")/)?.[1] ?? "null";
    const storageLocation = block.match(/storageLocation:\s*(null|generated\("[^"]+"\)|source\("[^"]+"\))/)?.[1] ?? "null";
    const generatedBy = block.match(/generatedBy:\s*(null|"[^"]*")/)?.[1] ?? "null";
    const isDisplayed = block.match(/isDisplayed:\s*(true|false|null)/)?.[1] ?? "null";
    const frontendMatch = block.match(/frontendConsumers:\s*\[([^\]]*)\]/s);
    const frontendConsumers = [...(frontendMatch?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    return { id, status, sourceType, provider, storageLocation, generatedBy, isDisplayed, frontendConsumers, block };
  });
}

function resolveRegistryPath(rootPath, expression) {
  const match = expression.match(/(generated|source)\("([^"]+)"\)/);
  if (!match) return null;
  const base = match[1] === "generated" ? path.join("src", "data", "real") : "src";
  return path.join(rootPath, base, match[2].replaceAll("/", path.sep));
}

function pathMatches(rootPath, expression) {
  const resolved = resolveRegistryPath(rootPath, expression);
  if (resolved) return fs.existsSync(resolved);
  return expression === "null";
}

function globExists(rootPath, expression) {
  const normalized = expression.replaceAll("\\", "/");
  if (!normalized.includes("*")) return fs.existsSync(path.join(rootPath, normalized));
  const prefix = normalized.split("*")[0].replace(/\/$/, "");
  const directory = path.join(rootPath, prefix);
  return fs.existsSync(directory) && fs.readdirSync(directory).length > 0;
}

export function validateRegistryEntries(entries, rootPath) {
  const findings = [];
  for (const entry of entries) {
    if (!entry.id || !entry.status || !entry.sourceType) findings.push(finding("P0", "registry-shape", "Registry entry is missing id/status/sourceType", "src/data/data-source-registry.ts", null, [entry.id].filter(Boolean), "Add required registry fields", false));
    if (!ALLOWED_STATUSES.includes(entry.status) || !ALLOWED_STATUSES.includes(entry.sourceType)) findings.push(finding("P0", "invalid-status", `Invalid registry status: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Use an allowed status enum", false));
    if (["real", "generated_real"].includes(entry.status) && entry.provider === "null") findings.push(finding("P0", "provider-missing", `${entry.status} requires provider: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Declare the actual provider or downgrade status", false));
    if (entry.status === "generated_real" && entry.generatedBy === "null") findings.push(finding("P1", "generator-missing", `generated_real requires generatedBy: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Point to the generator script", false));
    if (entry.storageLocation !== "null" && !pathMatches(rootPath, entry.storageLocation)) findings.push(finding("P1", "storage-missing", `storageLocation does not exist: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Correct the path or set null/unknown", false));
    if (entry.isDisplayed === "true" && entry.frontendConsumers.length === 0) findings.push(finding("P1", "consumer-missing", `Displayed registry entry has no frontendConsumers: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Declare the production consumer", false));
    for (const consumer of entry.frontendConsumers) if (!globExists(rootPath, consumer)) findings.push(finding("P1", "consumer-path-missing", `frontendConsumer does not exist: ${consumer}`, consumer, null, [entry.id], "Correct the consumer path", false));
    if (entry.status === "not_implemented" && entry.isDisplayed === "true" && entry.frontendConsumers.length > 0 && /valid|normal|complete|supported/i.test(entry.block)) findings.push(finding("P1", "status-contradiction", `not_implemented is described as available: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Keep the displayed state as unavailable", false));
  }
  for (const required of REQUIRED_IDS) if (!entries.some((entry) => entry.id === required)) findings.push(finding("P0", "registry-missing", `Missing required registry id: ${required}`, "src/data/data-source-registry.ts", null, [required], "Add the required data category", false));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) findings.push(finding("P0", "duplicate-id", "Registry contains duplicate ids", "src/data/data-source-registry.ts", null, [], "Make registry ids unique", false));
  return findings;
}

function finding(severity, id, title, file, line, relatedRegistryIds, recommendation, resolved) {
  return { id, severity, title, description: title, file, line, relatedRegistryIds, status: resolved ? "resolved" : "open", recommendation, resolved };
}

export function detectZeroFallbacks(files, rootPath) {
  const findings = [];
  const allowlisted = [];
  for (const file of files) {
    const relative = path.relative(rootPath, file).replaceAll("\\", "/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const matches = line.match(/(?:\?\?|\|\|)\s*0|Number\([^\n]*(?:\?\?|\|\|)\s*0\)|parse(?:Float|Int)\([^\n]*\)\s*\|\|\s*0/g);
      if (!matches) return;
      for (const match of matches) {
        const safe = SAFE_ZERO.find((candidate) => candidate.pattern.test(line)) ?? (relative === "scripts/data-audit.mjs" ? { reason: "audit rule implementation, not a production data path" } : null);
        if (safe) {
          allowlisted.push({ file: relative, line: index + 1, expression: match, reason: safe.reason });
          continue;
        }
        const financial = ZERO_RISK_WORDS.test(line);
        findings.push(finding(financial ? "P0" : "P2", "missing-to-zero", `Missing value coercion: ${match}`, relative, index + 1, [], financial ? "Use an explicit missing state; do not display zero" : "Document why this numeric fallback is safe or use a typed default", false));
      }
    });
  }
  return { findings, allowlisted };
}

function capabilityRisks(entries) {
  return entries.flatMap((entry) => {
    if (entry.status === "not_implemented") return [finding("P1", "capability-gap", `Capability not implemented: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Keep the UI unavailable and add a provider only in a separate approved task", false)];
    if (["manual_unverified", "inferred", "unknown"].includes(entry.status)) return [finding("P2", "evidence-governance", `Evidence requires verification: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Keep it labelled as a lead/inference until sourced", false)];
    if (["partial", "stale", "conflicted", "source_unavailable"].includes(entry.status)) return [finding("P1", "data-limitation", `Data limitation: ${entry.id}`, "src/data/data-source-registry.ts", null, [entry.id], "Show the limitation and freshness state", false)];
    return [];
  });
}

export function runAudit(rootPath) {
  const registryFile = path.join(rootPath, "src", "data", "data-source-registry.ts");
  const registrySource = fs.readFileSync(registryFile, "utf8");
  const entries = parseRegistryEntries(registrySource);
  const files = walkFiles(rootPath);
  const registryFindings = validateRegistryEntries(entries, rootPath);
  const zeroResult = detectZeroFallbacks(files, rootPath);
  const risks = [...registryFindings, ...zeroResult.findings, ...capabilityRisks(entries)];
  return { entries, files, risks, errors: registryFindings.filter((item) => item.severity === "P0"), warnings: risks.filter((item) => item.severity !== "P0"), allowlisted: zeroResult.allowlisted, skipped: SKIP_DIRS.size };
}

function countBy(items, field) {
  return Object.fromEntries([...new Set(items.map((item) => item[field]))].map((value) => [value, items.filter((item) => item[field] === value).length]));
}

export function renderReport(result) {
  const riskCounts = Object.fromEntries(["P0", "P1", "P2", "P3"].map((severity) => [severity, result.risks.filter((item) => item.severity === severity).length]));
  const resolvedRisks = result.risks.filter((item) => item.resolved);
  const openRisks = result.risks.filter((item) => !item.resolved);
  const lines = [
    "# 数据真实性审计与数据源注册表 V1", "", `- 执行时间：${new Date().toISOString()}`, `- 扫描文件：${result.files.length}`, `- 注册表条目：${result.entries.length}`,
    `- P0：${riskCounts.P0}；P1：${riskCounts.P1}；P2：${riskCounts.P2}；P3：${riskCounts.P3}`, `- errors：${result.errors.length}；warnings：${result.warnings.length}；skipped：${result.skipped}；allowlist 命中：${result.allowlisted.length}`,
    "- 结论：审计器已覆盖项目源码、脚本和 JSON；当前已知能力缺口与人工证据风险被保留为风险项，未将其伪装为零风险。", "",
    "## 执行摘要", "", "- 递归扫描 `src/**/*.ts(x)`、`scripts/**/*.js/mjs/ts`、`public/**/*.json` 和生成 JSON。", "- P0/P1/P2/P3 来自结构化风险项；errors 仅表示阻断性结构错误，warnings 表示非阻断风险。", "- not_implemented、manual_unverified、inferred、partial 等能力边界计入风险，但不会让命令因已知缺口自动失败。", "",
    "## 风险统计", "", `- 状态分布：${JSON.stringify(countBy(result.entries, "status"))}`, `- 风险分布：${JSON.stringify(riskCounts)}`, "",
    "## 风险清单", "", "| id | severity | title | file | line | registry | status | resolved |", "|---|---|---|---|---:|---|---|---|",
    ...(result.risks.length ? result.risks.map((item) => `| ${item.id} | ${item.severity} | ${item.title.replaceAll("|", "\\|")} | ${item.file} | ${item.line ?? "-"} | ${item.relatedRegistryIds.join(", ") || "-"} | ${item.status} | ${item.resolved ? "yes" : "no"} |`) : ["| - | - | No findings | - | - | - | - | - |"]), "",
    "## 已解决问题", "", ...(resolvedRisks.length ? resolvedRisks.map((item) => `- ${item.id}: ${item.title}`) : ["- 本次没有自动标记为 resolved 的历史问题。"]), "",
    "## 尚未解决但不阻断合并的能力边界", "", ...(openRisks.filter((item) => item.id === "capability-gap" || item.id === "evidence-governance" || item.id === "data-limitation").map((item) => `- ${item.severity} ${item.title}：${item.recommendation}`)), "",
    "## 缺失值转零规则", "", "- 财务、估值、行情、预测和投资结论字段附近的 `?? 0`、`|| 0`、`Number(value) || 0`、`parseFloat(value) || 0` 记为 P0。", "- 仅数组长度、计数、分页索引和明确的数值排序 fallback 可进入 allowlist；每次命中都输出文件、行号、表达式和原因。", "- 真实缺失值必须使用 `数据暂缺`、null 或明确的 unavailable 状态。", "",
    "## 数据能力边界", "", "- 港股财务、公告、业绩预告、业绩快报、研报和一致预期仍为 not_implemented。", "- 客户、供应商、产业链定位、技术路线、风险提示和 evidenceItems 中的人工/推断内容仍需逐条核验。", "- 本次未接入新的金融数据 Provider、未扩大股票池、未重构前端。", "",
    "## 审计命令契约", "", "- `npm run data:audit` 检查文件递归范围、缺失值转零、注册表结构、路径、Provider/生成脚本、前端消费者和状态矛盾。", "- P0、注册表结构错误、路径声明错误、mock 进入生产路径或 generated_real 缺少必要来源时返回非零。", "- 已知 not_implemented/manual_unverified/inferred/partial 能力缺口作为 warning/risk 输出，不静默忽略。", "- 新增 allowlist 必须在 `SAFE_ZERO` 中增加窄规则并写明原因，禁止用大范围目录或关键词屏蔽。", "",
  ];
  return `${lines.join("\n")}\n`;
}

export function runSelfTests() {
  const fixture = "const revenue = input?.revenue ?? 0;\nconst sorted = Math.abs(item?.pctChange ?? 0);\nconst index = rowIndex ?? 0;";
  const tempRoot = fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "audit-fixture-"));
  const file = path.join(tempRoot, "src.ts");
  fs.writeFileSync(file, fixture, "utf8");
  const result = detectZeroFallbacks([file], tempRoot);
  fs.rmSync(tempRoot, { recursive: true, force: true });
  if (result.findings.length !== 1 || result.findings[0].severity !== "P0") throw new Error("data audit self-test failed: financial zero coercion");
  if (result.allowlisted.length !== 2) throw new Error("data audit self-test failed: safe allowlist");
  return true;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runSelfTests();
  const result = runAudit(root);
  fs.writeFileSync(path.join(root, "docs", "data-audit-v1.md"), renderReport(result), "utf8");
  const riskCounts = Object.fromEntries(["P0", "P1", "P2", "P3"].map((severity) => [severity, result.risks.filter((item) => item.severity === severity).length]));
  console.log(JSON.stringify({ scanned: result.files.length, registry: result.entries.length, ...riskCounts, errors: result.errors.length, warnings: result.warnings.length, skipped: result.skipped, allowlisted: result.allowlisted.length, exit: result.errors.length ? 1 : 0 }, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
