# 数据真实性审计与数据源注册表 V1

- 执行时间：2026-07-22T04:06:13.067Z
- 扫描文件：291
- 注册表条目：29
- P0：0；P1：10；P2：14；P3：0
- errors：0；warnings：24；skipped 目录：10；allowlist 命中：31
- 退出码：0

## 结论

审计门禁以未解决的 blocking 风险为唯一失败依据。所有 P0、注册表结构/路径/来源错误、coverage 矛盾、生产 mock 路由以及财务/估值/预测字段缺失转零均阻断并返回非零退出码。已知能力缺口和证据治理事项保留为非阻断 warning。

## 执行范围

- 递归扫描 src、scripts、public 中的 TS/TSX/JS/MJS/JSON，并排除依赖、构建、缓存、coverage 和 fixture 目录。
- 校验 21 个必需注册表类别、状态枚举、provider、storageLocation、generatedBy、frontendConsumers 与 coverage。
- Math.abs 仅允许出现在显式 sort/ranking/compare 上下文；普通渲染或计算不再享受宽泛豁免。

## 状态与风险统计

- 状态分布：{"generated_real":6,"not_implemented":4,"partial":6,"manual_unverified":9,"manual_verified":1,"static_reference":1,"inferred":2}
- 风险分布：{"P0":0,"P1":10,"P2":14,"P3":0}
- 阻断风险：0
- 非阻断风险：24

## 风险清单

| id | severity | blocking | category | title | file | line | registryIds |
|---|---|---|---|---|---|---:|---|
| missing-to-zero | P2 | no | missing-value | Missing value coercion: Number(match[1]), minor: Number(match[2] ?? 0), patch: Number(match[3] ?? 0) | scripts/dev-health.mjs | 228 | - |
| missing-to-zero | P2 | no | missing-value | Missing value coercion: Number(manifest.partial ?? 0) | scripts/dev-health.mjs | 745 | - |
| missing-to-zero | P2 | no | missing-value | Missing value coercion: Number(manifest.error ?? 0) | scripts/dev-health.mjs | 746 | - |
| capability-gap | P1 | no | capability | Capability not implemented: hk-financials | src/data/data-source-registry.ts | - | hk-financials |
| data-limitation | P1 | no | limitation | Data limitation: announcements | src/data/data-source-registry.ts | - | announcements |
| data-limitation | P1 | no | limitation | Data limitation: earnings-preview | src/data/data-source-registry.ts | - | earnings-preview |
| data-limitation | P1 | no | limitation | Data limitation: earnings-flash | src/data/data-source-registry.ts | - | earnings-flash |
| capability-gap | P1 | no | capability | Capability not implemented: broker-research | src/data/data-source-registry.ts | - | broker-research |
| data-limitation | P1 | no | limitation | Data limitation: expectation-company-guidance | src/data/data-source-registry.ts | - | expectation-company-guidance |
| data-limitation | P1 | no | limitation | Data limitation: expectation-company-guidance-provider | src/data/data-source-registry.ts | - | expectation-company-guidance-provider |
| evidence-governance | P2 | no | evidence | Evidence requires verification: expectation-institution-single | src/data/data-source-registry.ts | - | expectation-institution-single |
| evidence-governance | P2 | no | evidence | Evidence requires verification: expectation-institution-consensus-manual | src/data/data-source-registry.ts | - | expectation-institution-consensus-manual |
| evidence-governance | P2 | no | evidence | Evidence requires verification: expectation-manual-ingestion | src/data/data-source-registry.ts | - | expectation-manual-ingestion |
| evidence-governance | P2 | no | evidence | Evidence requires verification: expectation-json-ingestion | src/data/data-source-registry.ts | - | expectation-json-ingestion |
| evidence-governance | P2 | no | evidence | Evidence requires verification: expectation-csv-ingestion | src/data/data-source-registry.ts | - | expectation-csv-ingestion |
| capability-gap | P1 | no | capability | Capability not implemented: institution-consensus | src/data/data-source-registry.ts | - | institution-consensus |
| capability-gap | P1 | no | capability | Capability not implemented: eps-net-profit-forecast | src/data/data-source-registry.ts | - | eps-net-profit-forecast |
| data-limitation | P1 | no | limitation | Data limitation: valuation | src/data/data-source-registry.ts | - | valuation |
| evidence-governance | P2 | no | evidence | Evidence requires verification: customer-relations | src/data/data-source-registry.ts | - | customer-relations |
| evidence-governance | P2 | no | evidence | Evidence requires verification: supplier-relations | src/data/data-source-registry.ts | - | supplier-relations |
| evidence-governance | P2 | no | evidence | Evidence requires verification: industry-chain-position | src/data/data-source-registry.ts | - | industry-chain-position |
| evidence-governance | P2 | no | evidence | Evidence requires verification: technical-route | src/data/data-source-registry.ts | - | technical-route |
| evidence-governance | P2 | no | evidence | Evidence requires verification: risk-alerts | src/data/data-source-registry.ts | - | risk-alerts |
| evidence-governance | P2 | no | evidence | Evidence requires verification: evidence-items | src/data/data-source-registry.ts | - | evidence-items |

## 门禁契约

- `blockingRisks = risks.filter(risk => risk.blocking && !risk.resolved)`。
- errors 等于 blockingRisks；warnings 等于未解决的非阻断风险。
- errors 非空时 `npm run data:audit` 返回 1，否则返回 0。
- 新增豁免必须包含 id、文件、表达式、原因和适用范围，禁止按目录或宽泛 Math.abs 模式整体放行。

## 当前能力边界

- 港股财务、公告、业绩预告/快报、券商研报和一致预期仍未接入，继续显示 unavailable/数据暂缺。
- 客户、供应商、产业链、技术路线、风险提示和 evidenceItems 中的人工或推断内容仍需逐条核验。
- 本次不新增金融数据 Provider，不改变股票池，不自动合并 PR。
