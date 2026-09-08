# Investment Research Dashboard V2 · Post-Phase-1B Roadmap Rebaseline

> 状态：CURRENT ROADMAP REBASELINE V1
> 日期：2026-09-08
> 事实基线：`main` @ `2230265e727f0f2787de9e82d509f0c1d3a6230a`
> 作用：在 Phase 1B 关闭后，统一当前实现事实、旧 Stage 4 历史基线和 V2 Top-down / Local-first 冻结路线。本文不授权任何业务实现，也不定义 `Phase 1C`。

## 1. 当前正式事实

Phase 1B — Long-term Account & DCA Core 的当前项目状态为 **CLOSED / MERGED / MAIN CI PASS**：

- PR：[#24](https://github.com/lwd619783-byte/-/pull/24)；
- final audited implementation HEAD：`9633130b772e8571bfd130c2b35317f2da1183b3`；
- merge/main：`2230265e727f0f2787de9e82d509f0c1d3a6230a`；
- PR CI：[34170387749](https://github.com/lwd619783-byte/-/actions/runs/34170387749)，`pull_request` / audited HEAD / completed / success；
- main CI：[34173206443](https://github.com/lwd619783-byte/-/actions/runs/34173206443)，`push` / merge SHA / completed / success。

原实施、修复、合同澄清与 alignment 文档中的 `BLOCKED`、`PENDING INDEPENDENT REVIEW` 等结论属于各自记录时点的历史事实，不回写、不删除。项目 CURRENT 状态由开发执行索引、Feature Registry、Architecture 与本文共同表达。

## 2. 事实源审计结论

### 2.1 需要纠正的 CURRENT 描述

| 事实源 | 审计前问题 | 本次处理 |
| --- | --- | --- |
| `docs/development-execution-plan-2026-09-07.md` | Phase 1B 仍停在 implementation alignment / pending final audit | 登记 PR #24、audited HEAD、merge/main、PR CI、main CI 与关闭状态；保留全部历史验证链接 |
| `docs/feature-registry.md` | 仍笼统把 Portfolio / Account / Position / Transaction 写为 NOT STARTED，且沿用旧 Stage 4 编号 | 拆分 Asset / Account Local Core、Trusted Import Core、Portfolio Exposure、真实 adapter / migration 与远程接入 |
| `docs/architecture.md` | 仍称“没有业务后端数据库”，并把 Account / Position / Transaction 列为未实现 | 更新为 Browser SPA 与 Node-only SQLite Local Core 双边界；只保留真实 Portfolio / Bridge / adapter 缺口 |
| `README.md` | 未登记 Phase 1B Local Core，容易把全部 V2 Local-first 能力继续理解为未实现 | 只补当前状态、运行边界和目录导航，不扩成长路线图 |

`docs/investment-dashboard-master-plan-2026-09.md` 明确保留为历史基线，不按当前事实回写。Phase 1A / 1B implementation / validation 文档和 `contracts/v1/README.md` 中带日期的 delivery / audit 状态也继续作为历史记录；它们不得覆盖 PR #24 之后的 CURRENT project-state，但本次 docs-only scope 不修改 `contracts/v1/**`。

### 2.2 Phase 1B 已实现的 Local Core

- contracts validation；
- 单用户 Local-first SQLite 与顺序 migration；
- Entity Registry / Resolver；
- append-only Audit；
- Account / Asset；
- Transaction / CashFlow / PositionSnapshot；
- DCA Plan revision / DCA Execution / rollover 历史；
- Asset Import / HistoricalAssetImport；
- 同 bundle 账户总额 reconciliation；
- DCA temporal binding；
- confirmation、approval binding、idempotency、deduplication 与 atomic commit。

这是 Node-only Local Core，不是完整 Portfolio 产品。Browser SPA 不直接 import SQLite / Node Local Core，现有 Watchlist / Expectation 仍使用 LocalStorage。

### 2.3 只完成 Core、尚未形成端到端能力

| 能力 | 已有 | 尚缺 |
| --- | --- | --- |
| Asset / Account | 合同、Domain Service、SQLite persistence、Audit、确认与幂等 | Portfolio aggregate / exposure read model、浏览器 UI |
| Trusted Import | `ImportTrust` seam、证据复核、approval binding、prepare / commit | real trusted source adapter、OCR / screenshot ingestion、用户确认 UI、真实历史账户 migration |
| Portfolio | 可复用的 Account / Asset / ledger / Position / DCA 事实层 | thesis ↔ position、macro / industry exposure、target allocation、rebalance、performance attribution |
| Remote access | 可复用的 Domain / permission / Audit 合同边界 | Research Bridge / MCP adapter、受控远程入口、Auth / scope / security admission |
| Persistence | Node-only local SQLite；浏览器 Watchlist / Expectation LocalStorage | 浏览器到 Local Core 的受控接入；没有 cloud business database 或 cross-device sync |

### 2.4 真正未开始的主要任务

- Historical Observation Catalog R2 的真实历史 release / vintage 数据集扩展；
- Stage 4.1 normalization / backtest / formula admission 及正式 Market Regime Engine / UI；
- V2 Product Shell / What Changed / Research Inbox；
- Industry Metric Registry / Provider / historical series / delta engine / prosperity；
- Macro → Industry、Industry Thesis / revision 与 Instrument mapping 的 Top-down workflow；
- Portfolio aggregate / exposure / allocation / rebalance / read model / UI；
- Research Bridge / controlled remote access；
- trusted import adapters、OCR、真实账户 migration；
- Research Bridge 的 Auth / scope / security admission 未开始；cloud business database 与 cross-device sync 也未实现，且在当前 Local-first freeze 下不是默认建设方向。

## 3. 旧 Stage 4 与当前 V2 路线的重叠

旧 Master Plan 是历史建设基线。后来的 V2 Top-down Design、Local-first freeze、合同审计和实际实现对其进行重排；不能用旧编号覆盖后来决定。

| 旧 Master Plan 项 | 当前事实 / 归属 |
| --- | --- |
| Stage 4.1 — Macro & Bull/Bear Foundation | Metric / formula / PIT 设计与 Historical Observation Catalog R1 已完成；R2 数据扩展、normalization、backtest、formula admission、Engine / UI 仍待完成，继续保留为当前 Stage 4.1 |
| Stage 4.2 — Portfolio & Valuation | Phase 1B 已提前完成其中 Account / Asset / Transaction / CashFlow / Position / DCA Local Core；Portfolio Exposure、thesis mapping、allocation、rebalance、attribution、UI 与 Valuation 仍未完成。Portfolio Exposure 在当前路线为 Stage 4.4，Advanced Valuation 后移 |
| Stage 4.3 — Cloud Persistence | 已被 Local-first freeze 覆盖；当前不以迁往 cloud business database 为默认路线。浏览器 LocalStorage 也没有因此自动迁入 SQLite |
| Stage 4.4 — Industry Data Platform | 在 V2 Top-down 路线前移为当前 Stage 4.2，正式 Metric Registry / Provider / prosperity 仍未开始 |
| Stage 4.5 — HK Full Coverage | 不再占用当前 Stage 4.5；保留为 Stage 4.6+ 后续能力，完整研究链仍未开始 |
| Stage 4.6 — Automation / Research Copilot | 保留为后续能力；必须建立在可信 What Changed / Market Regime / Research workflow 上 |

Phase 1B 对未来 Stage 4.4 的约束是：**不得重新建立第二套 Account、Asset、Transaction、CashFlow、Position 或 DCA。** Stage 4.4 必须复用 Local Core，重点补齐 thesis ↔ position、exposure、allocation、rebalance 和 UI / read model。

## 4. 冻结的后续开发顺序

以下是 Phase 1B 后唯一 CURRENT 顺序；各项仍须在开工前按其合同、数据与准入要求冻结具体 scope。本文不创造新的 Phase 编号，也不把任何任务命名为 `Phase 1C`。

1. **Stage 4.1 — Historical Observation Catalog R2 / PIT Dataset Expansion**
   扩展 M2、社融、证监会月报和沪深北统一口径等官方历史 release / vintage / definition 数据集；严格保留 PIT、provenance、冲突与结构性缺失语义。
2. **Stage 4.1 — normalization / backtest / formula admission**
   基于获准历史数据集生成 weekly immutable manifests，执行 Candidate A–D 回测，完成版本化公式 admission；之后才进入正式 Market Regime Engine / UI。
3. **Stage 4.1B — V2 Product Shell / Research Inbox**
   以可信 What Changed / Market Regime 输出建设导航、Inbox 与渐进 App Shell；不得建立在旧伪评分上。
4. **Stage 4.2 — Industry Data Platform**
   建设 Industry Metric Registry、Provider contract、historical series、delta engine、prosperity 与 industry event。
5. **Stage 4.3 — Top-down Research Workflow**
   建设 Macro → Industry mapping、Industry Thesis / revision、Research Workflow 合并与 Instrument / expression mapping。
6. **Stage 4.4 — Portfolio Exposure MVP**
   复用 Phase 1B Local Core，只补 thesis ↔ position、macro / industry exposure、target allocation、rebalance 与 Portfolio read model / browser UI；不重建资产账本。
7. **Stage 4.5 — Research Bridge / Cloud Write Path（按 Local-first freeze 重新解释）**
   原 V2 文档的 “Cloud Write Path” 名称不能推翻后来的 Local-first freeze。实施前须重新冻结受控远程入口、Auth / scope、confirmation 与 security admission；默认写入 Local Domain Service，不以 cloud business database 为前提，不暴露 raw DB。

## 5. 下一实际开发任务

下一项业务任务冻结为：

**STAGE 4.1 — HISTORICAL OBSERVATION CATALOG R2 / PIT DATASET EXPANSION**

理由：

- V2 产品设计把 Market Regime 放在第一开发优先级；
- Historical Observation Catalog R1 已完成并合入；
- Feature Registry 已明确 R2 是下一步；
- 未经过 PIT historical dataset、normalization、backtest 与 formula admission，不应直接建设正式牛熊温度 UI；
- Research Inbox 应消费可信的 What Changed / Market Regime 输出，不能建立在旧的条数驱动或伪量化评分上。

本次 rebaseline 只冻结任务身份、顺序和边界，**不实现 R2**。

## 6. 停止点

本轮完成后状态为：**POST-PHASE-1B REBASELINE COMPLETE / PENDING INDEPENDENT REVIEW**。

本轮不修改 `src/**`、`local-core/**`、`contracts/v1/**`、`scripts/**`、`config/**`、migration、依赖、CI、UI、Provider、Market Regime 数据、Portfolio 或 Research Bridge；不创建 PR，不修改 `main`。
