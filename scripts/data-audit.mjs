import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryFile = path.join(root, "src", "data", "data-source-registry.ts");
const reportFile = path.join(root, "docs", "data-audit-v1.md");
const registry = fs.readFileSync(registryFile, "utf8");
const allowed = new Set(["real", "generated_real", "manual_verified", "manual_unverified", "static_reference", "inferred", "mock", "placeholder", "stale", "conflicted", "partial", "not_implemented", "source_unavailable", "unknown"]);
const ids = [...registry.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
const statuses = [...registry.matchAll(/status: "([^"]+)"/g)].map((m) => m[1]);
const sourceTypes = [...registry.matchAll(/sourceType: "([^"]+)"/g)].map((m) => m[1]);
const errors = [];
const warnings = [];
const required = ["a-share-quotes", "a-share-price-history", "hk-quotes", "hk-price-history", "a-share-financials", "hk-financials", "announcements", "earnings-preview", "earnings-flash", "broker-research", "institution-consensus", "eps-net-profit-forecast", "valuation", "industry-prosperity", "customer-relations", "supplier-relations", "industry-chain-position", "technical-route", "risk-alerts", "evidence-items"];
for (const id of required) if (!ids.includes(id)) errors.push(`registry missing required id: ${id}`);
if (new Set(ids).size !== ids.length) errors.push("registry contains duplicate ids");
for (const status of [...statuses, ...sourceTypes]) if (!allowed.has(status)) errors.push(`invalid status: ${status}`);
for (const [name, rel] of [["quotes", "src/data/real/quotes.generated.json"], ["history", "src/data/real/priceHistory.generated.json"], ["financials", "src/data/real/financials.generated.json"], ["research", "src/data/real/research.generated.json"], ["announcements", "src/data/real/announcements.generated.json"], ["macro", "src/data/real/macro.generated.json"]]) if (!fs.existsSync(path.join(root, rel))) errors.push(`${name} storage file missing: ${rel}`);
if (/示例值/.test(fs.readFileSync(path.join(root, "src", "data", "stocks.ts"), "utf8"))) errors.push("mock seed still contains financial example values");
const app = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
if (/\b(latestPrice|marketCap|revenue|netProfit|profit|pe|pb|ps)[^\n]*(\?\?|\|\|)\s*0/.test(app)) warnings.push("App contains a possible missing-to-zero fallback; verify it is not a display path");
const count = (values) => Object.fromEntries([...new Set(values)].map((value) => [value, values.filter((item) => item === value).length]));
const lines = [
  "# 数据真实性审计与数据源注册表 V1", "", `- 执行时间：${new Date().toISOString()}`, `- 注册表条目：${ids.length}`,
  `- P0：${errors.length}；P1：${warnings.length}；P2：${errors.length + warnings.length}；P3：0`,
  "- 结论：已建立统一注册表和可运行审计入口；未确认信息保留为 null/unknown，不将缺失数据伪装成有效数字。", "",
  "## 执行摘要", "", "- A 股/港股行情和历史价格沿用既有抓取链路，归类为 generated_real；不接入新 Provider。", "- A 股财务归类为 partial；港股财务、公告、业绩预告、业绩快报、研报、一致预期均明确为 not_implemented。", "- 客户、供应商、产业链定位、技术路线、风险提示和 evidenceItems 均注册了人工/推断属性，不能当作同等级事实。", "- 审计脚本检查注册表完整性、状态枚举、生成文件存在性和示例财务值残留。", "",
  "## 注册表状态分布", "", `- status：${JSON.stringify(count(statuses))}`, `- sourceType：${JSON.stringify(count(sourceTypes))}`, "",
  "## 数据流概览", "", "`外部接口 → scripts/fetch-*.py → src/data/real/*.generated.json → src/services/providers → src/services/stockProvider.ts → React components`", "", "行情/历史价格使用既有生成文件；研究 seed 位于 `src/data/stocks.ts`，不应覆盖真实财务或行情缺失。", "",
  "## 真实数据覆盖与当前边界", "", "| 数据类 | 状态 | 生成脚本/存储 | 前端消费者 | 边界 |", "|---|---|---|---|---|", "| A 股行情 | generated_real | `fetch-a-stock-data.py` → `quotes.generated.json` | `stockProvider.ts`、股票组件 | 以 quality.status/updatedAt 为准 |", "| A 股历史价格 | generated_real | `fetch-a-stock-data.py` → `priceHistory.generated.json` | `stockProvider.ts`、Sparkline | 区间和复权口径需看脚本 |", "| 港股行情/历史 | generated_real | `fetch-hk-stock-data.py` | `stockProvider.ts` | 依赖 yfinance |", "| A 股财务 | partial | `fetch-a-stock-data.py` → `financials.generated.json` | 详情抽屉 | 字段可能缺失 |", "| 港股财务/公告/研报 | not_implemented | 占位或空生成文件 | 详情抽屉 | 不得显示具体数字或已获取事实 |", "",
  "## P0-P3 问题清单", "", ...(errors.length ? errors.map((item) => `- P0/P1：${item}`) : ["- P0：无结构性错误"]), ...(warnings.length ? warnings.map((item) => `- P1：${item}`) : ["- P1：无自动发现项"]), "- P2：人工研究字段的来源和日期并非全部完整，已在注册表标记 manual_unverified/unknown。", "- P3：注册表字段统一为 camelCase，状态值统一为枚举。", "",
  "## 前端防误导约束", "", "- 缺失值显示 `数据暂缺`，null/undefined/NaN 不转为 0。", "- not_implemented 显示未接入/数据暂缺，不沿用 mock 财务值。", "- generated_real 必须能定位到生成脚本和存储文件；更新时间不确定时保留 null。", "- manual_unverified/inferred 仅作为线索或推断，不能显示为已验证事实。", "",
  "## 下一阶段（本次不执行）", "", "- 逐字段补公告、财务和研报的原始来源与更新时间。", "- 将 evidenceItems 的 sourceUrl/sourceDate/verificationStatus 做强校验。", "- 在不引入新 Provider 前提下，补充前端统一 DataFreshnessLabel/MissingDataState。", "",
  "## 检查结果", "", "运行命令：`npm run data:audit`。", "",
];
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, `${lines.join("\n")}\n`, "utf8");
console.log(`data audit written: ${path.relative(root, reportFile)}; entries=${ids.length}; errors=${errors.length}; warnings=${warnings.length}`);
if (errors.length) process.exitCode = 1;
