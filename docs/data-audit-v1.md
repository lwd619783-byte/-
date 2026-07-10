# 数据真实性审计与数据源注册表 V1

- 执行时间：2026-07-10T06:11:17.386Z
- 扫描文件：78
- 注册表条目：21
- P0：0；P1：9；P2：6；P3：0
- errors：0；warnings：15；skipped：10；allowlist 命中：28
- 结论：审计器已覆盖项目源码、脚本和 JSON；当前已知能力缺口与人工证据风险被保留为风险项，未将其伪装为零风险。

## 执行摘要

- 递归扫描 `src/**/*.ts(x)`、`scripts/**/*.js/mjs/ts`、`public/**/*.json` 和生成 JSON。
- P0/P1/P2/P3 来自结构化风险项；errors 仅表示阻断性结构错误，warnings 表示非阻断风险。
- not_implemented、manual_unverified、inferred、partial 等能力边界计入风险，但不会让命令因已知缺口自动失败。

## 风险统计

- 状态分布：{"generated_real":5,"partial":2,"not_implemented":7,"static_reference":1,"manual_unverified":4,"inferred":2}
- 风险分布：{"P0":0,"P1":9,"P2":6,"P3":0}

## 风险清单

| id | severity | title | file | line | registry | status | resolved |
|---|---|---|---|---:|---|---|---|
| data-limitation | P1 | Data limitation: a-share-financials | src/data/data-source-registry.ts | - | a-share-financials | open | no |
| capability-gap | P1 | Capability not implemented: hk-financials | src/data/data-source-registry.ts | - | hk-financials | open | no |
| capability-gap | P1 | Capability not implemented: announcements | src/data/data-source-registry.ts | - | announcements | open | no |
| capability-gap | P1 | Capability not implemented: earnings-preview | src/data/data-source-registry.ts | - | earnings-preview | open | no |
| capability-gap | P1 | Capability not implemented: earnings-flash | src/data/data-source-registry.ts | - | earnings-flash | open | no |
| capability-gap | P1 | Capability not implemented: broker-research | src/data/data-source-registry.ts | - | broker-research | open | no |
| capability-gap | P1 | Capability not implemented: institution-consensus | src/data/data-source-registry.ts | - | institution-consensus | open | no |
| capability-gap | P1 | Capability not implemented: eps-net-profit-forecast | src/data/data-source-registry.ts | - | eps-net-profit-forecast | open | no |
| data-limitation | P1 | Data limitation: valuation | src/data/data-source-registry.ts | - | valuation | open | no |
| evidence-governance | P2 | Evidence requires verification: customer-relations | src/data/data-source-registry.ts | - | customer-relations | open | no |
| evidence-governance | P2 | Evidence requires verification: supplier-relations | src/data/data-source-registry.ts | - | supplier-relations | open | no |
| evidence-governance | P2 | Evidence requires verification: industry-chain-position | src/data/data-source-registry.ts | - | industry-chain-position | open | no |
| evidence-governance | P2 | Evidence requires verification: technical-route | src/data/data-source-registry.ts | - | technical-route | open | no |
| evidence-governance | P2 | Evidence requires verification: risk-alerts | src/data/data-source-registry.ts | - | risk-alerts | open | no |
| evidence-governance | P2 | Evidence requires verification: evidence-items | src/data/data-source-registry.ts | - | evidence-items | open | no |

## 已解决问题

- 本次没有自动标记为 resolved 的历史问题。

## 尚未解决但不阻断合并的能力边界

- P1 Data limitation: a-share-financials：Show the limitation and freshness state
- P1 Capability not implemented: hk-financials：Keep the UI unavailable and add a provider only in a separate approved task
- P1 Capability not implemented: announcements：Keep the UI unavailable and add a provider only in a separate approved task
- P1 Capability not implemented: earnings-preview：Keep the UI unavailable and add a provider only in a separate approved task
- P1 Capability not implemented: earnings-flash：Keep the UI unavailable and add a provider only in a separate approved task
- P1 Capability not implemented: broker-research：Keep the UI unavailable and add a provider only in a separate approved task
- P1 Capability not implemented: institution-consensus：Keep the UI unavailable and add a provider only in a separate approved task
- P1 Capability not implemented: eps-net-profit-forecast：Keep the UI unavailable and add a provider only in a separate approved task
- P1 Data limitation: valuation：Show the limitation and freshness state
- P2 Evidence requires verification: customer-relations：Keep it labelled as a lead/inference until sourced
- P2 Evidence requires verification: supplier-relations：Keep it labelled as a lead/inference until sourced
- P2 Evidence requires verification: industry-chain-position：Keep it labelled as a lead/inference until sourced
- P2 Evidence requires verification: technical-route：Keep it labelled as a lead/inference until sourced
- P2 Evidence requires verification: risk-alerts：Keep it labelled as a lead/inference until sourced
- P2 Evidence requires verification: evidence-items：Keep it labelled as a lead/inference until sourced

## 缺失值转零规则

- 财务、估值、行情、预测和投资结论字段附近的 `?? 0`、`|| 0`、`Number(value) || 0`、`parseFloat(value) || 0` 记为 P0。
- 仅数组长度、计数、分页索引和明确的数值排序 fallback 可进入 allowlist；每次命中都输出文件、行号、表达式和原因。
- 真实缺失值必须使用 `数据暂缺`、null 或明确的 unavailable 状态。

## 数据能力边界

- 港股财务、公告、业绩预告、业绩快报、研报和一致预期仍为 not_implemented。
- 客户、供应商、产业链定位、技术路线、风险提示和 evidenceItems 中的人工/推断内容仍需逐条核验。
- 本次未接入新的金融数据 Provider、未扩大股票池、未重构前端。

## 审计命令契约

- `npm run data:audit` 检查文件递归范围、缺失值转零、注册表结构、路径、Provider/生成脚本、前端消费者和状态矛盾。
- P0、注册表结构错误、路径声明错误、mock 进入生产路径或 generated_real 缺少必要来源时返回非零。
- 已知 not_implemented/manual_unverified/inferred/partial 能力缺口作为 warning/risk 输出，不静默忽略。
- 新增 allowlist 必须在 `SAFE_ZERO` 中增加窄规则并写明原因，禁止用大范围目录或关键词屏蔽。

