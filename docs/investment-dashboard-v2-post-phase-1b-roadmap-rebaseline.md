# Investment Research Dashboard V2 · Post-Phase-1B Roadmap Rebaseline

> 状态：CURRENT ROADMAP REBASELINE V1（Master Audit 后更新）
> 日期：2026-09-09
> 已合入事实基线：`origin/main` @ `a6cbf108139a2af66273c5376288b83d54712f58`
> 作用：统一 Phase 1B、Stage 4.1 R2 当前实现、旧 Stage 4 历史基线和 V2 Top-down / Local-first 路线。Master Audit 修复只在当前分支，未合入；本文不授权新业务实现，也不定义 `Phase 1C`。

## 1. 当前正式事实

R2 Scope Freeze、R2-A CORE、R2-B PBC、CSRC C1/C1.1/C2A1/C2A2、SSE/SZSE/BSE D1 与 all-A D2 均已合入以上 main 基线。Git merge ancestry 对应 PR #26～#37（#29 为既有 CI hardening）；当前数据状态与离线验证见 §2.4。以下 Phase 1B SHA/CI 仍是该阶段的关闭证据。

Phase 1B — Long-term Account & DCA Core 的当前项目状态为 **CLOSED / MERGED / MAIN CI PASS**：

- PR：[#24](https://github.com/lwd619783-byte/-/pull/24)；
- final audited implementation HEAD：`9633130b772e8571bfd130c2b35317f2da1183b3`；
- merge/main：`2230265e727f0f2787de9e82d509f0c1d3a6230a`；
- PR CI：[34170387749](https://github.com/lwd619783-byte/-/actions/runs/34170387749)，`pull_request` / audited HEAD / completed / success；
- main CI：[34173206443](https://github.com/lwd619783-byte/-/actions/runs/34173206443)，`push` / merge SHA / completed / success。

原实施、修复、合同澄清与 alignment 文档中的 `BLOCKED`、`PENDING INDEPENDENT REVIEW` 等结论属于各自记录时点的历史事实，不回写、不删除。项目 CURRENT 状态由开发执行索引、Feature Registry、Architecture 与本文共同表达。

## 2. 事实源审计结论

### 2.1 CURRENT authority 与历史证据

| 事实源 | 审计前问题 | 本次处理 |
| --- | --- | --- |
| `docs/development-execution-plan-2026-09-07.md` | R2 仍停在 scope freeze 待审、整个数据集未实现 | 登记已合入切片及当前修复停止点；保留 Phase 1B 历史关闭证据 |
| `docs/feature-registry.md` | R2-B / CSRC / 三所 / D2 缺少当前登记 | 分开 IMPLEMENTED、VERIFIED、PARTIAL、NOT_ADMITTED、NOT_STARTED、DEFERRED |
| `docs/architecture.md` / `README.md` | 已有 Browser / Node-only 双边界 | 仅 Architecture 补当前 R2 导航；不进行架构重写 |

`docs/investment-dashboard-master-plan-2026-09.md`、Phase 1A / 1B / R2 implementation / validation / delivery / audit 文档及 `contracts/v1/README.md` 的带日期交付状态均保留原貌。当前 rebaseline 不回写旧 SHA、PENDING、BLOCKED，不修改冻结合同。

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

### 2.4 R2 已实现，但数据准入尚未闭合

| 切片 | 当前实现 / 验证 | 覆盖与准入 |
| --- | --- | --- |
| R2-A CORE | IMPLEMENTED / VERIFIED | plan、release、artifact、calendar、revision、coverage 与 fail-closed validation；不代替逐源准入 |
| R2-B PBC | IMPLEMENTED / VERIFIED | PARTIAL；M2 余额/同比各 256/260，AFRE 余额 129/140、同比 111/140（first-release 110/140）；894 observations；未证明全部目录与 revision 穷尽性 |
| CSRC C1/C1.1 | IMPLEMENTED / VERIFIED | PARTIAL；247/260 indexed，13 gaps，恢复 0/13；IPO field-ready 87、再融资 readiness 0 |
| CSRC C2A1/C2A2 | IMPLEMENTED / VERIFIED | NOT_ADMITTED；26 definition-compatible、61 归月未证明；26 月 PIT 成功 0/26、eligible=[]、formal observations=0 |
| SSE/SZSE/BSE D1 | IMPLEMENTED / VERIFIED | source contracts、bounded inventories、guarded adapters；历史数值 NOT_ADMITTED，完整日历 / release / 定义适用仍未闭合 |
| all-A D2 | IMPLEMENTED / VERIFIED | **NOT_ADMITTED / numericAggregateCount=0 / targetCount=null / coveragePercent=null**；2 eras × 3 fields 的完整未准入窗口保留 |

本次 VERIFIED 指离线专项和 committed D2 report validation；PBC/CSRC 数字来自提交的 final evidence，不宣称本轮重放 ignored raw 或建立 durable archive。具体事实源见 [Feature Registry](feature-registry.md) 与 [D2 report](../research-data/market-regime/source-catalog/all-a-d2/admission-report.v1.json)。

### 2.5 真正未开始的主要任务

- R2 未闭合源的后继证据 / 准入工作；须按 blocker 单独冻结，不把整个 R2 重新标为未实现；
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
| Stage 4.1 — Macro & Bull/Bear Foundation | R1、R2-A/B、CSRC、三所 D1、D2 已实现；R2 数据整体 PARTIAL / NOT_ADMITTED；normalization、backtest、formula admission、Engine / UI 仍 NOT_STARTED |
| Stage 4.2 — Portfolio & Valuation | Phase 1B 已提前完成其中 Account / Asset / Transaction / CashFlow / Position / DCA Local Core；Portfolio Exposure、thesis mapping、allocation、rebalance、attribution、UI 与 Valuation 仍未完成。Portfolio Exposure 在当前路线为 Stage 4.4，Advanced Valuation 后移 |
| Stage 4.3 — Cloud Persistence | 已被 Local-first freeze 覆盖；当前不以迁往 cloud business database 为默认路线。浏览器 LocalStorage 也没有因此自动迁入 SQLite |
| Stage 4.4 — Industry Data Platform | 在 V2 Top-down 路线前移为当前 Stage 4.2，正式 Metric Registry / Provider / prosperity 仍未开始 |
| Stage 4.5 — HK Full Coverage | 不再占用当前 Stage 4.5；保留为 Stage 4.6+ 后续能力，完整研究链仍未开始 |
| Stage 4.6 — Automation / Research Copilot | 保留为后续能力；必须建立在可信 What Changed / Market Regime / Research workflow 上 |

Phase 1B 对未来 Stage 4.4 的约束是：**不得重新建立第二套 Account、Asset、Transaction、CashFlow、Position 或 DCA。** Stage 4.4 必须复用 Local Core，重点补齐 thesis ↔ position、exposure、allocation、rebalance 和 UI / read model。

## 4. 冻结的后续开发顺序

以下是 Phase 1B 后唯一 CURRENT 顺序；各项仍须在开工前按其合同、数据与准入要求冻结具体 scope。本文不创造新的 Phase 编号，也不把任何任务命名为 `Phase 1C`。

1. **Stage 4.1 — Historical Observation Catalog R2 / PIT Dataset Expansion**
   现已完成 §2.4 列明的实现；剩余 PBC coverage/revision、CSRC historical release、沪深北定义/日历/release 等 blockers 保持原门禁，后继切片另行冻结。
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

## 5. 当前实际任务

**Master Audit Remediation V1**：MA-01 证据身份、MA-02 stale-write protection、MA-03 未来事实、MA-04 CI/discovery、MA-05 字段覆盖、MA-06 CURRENT rebaseline。结果与 residual limitations 见[验证记录](master-audit-remediation-v1.md)。

修复不提升 R2 admission，不启动 normalization / backtest / Market Temperature UI。完成独立审计前不把 remediation 写为 MAIN MERGED。后继业务任务仍处于 Stage 4.1 R2 未闭合的准入边界内，不在本轮擅定新 slice。

## 6. 停止点

本轮状态为 **MASTER AUDIT REMEDIATION V1 / PENDING INDEPENDENT REVIEW / NOT MAIN MERGED**。完成修复和验证后普通 commit + push，核验远端 SHA 后停止；不创建 PR、不 merge、不修改 main。未改变 contracts、sealed/raw 数据事实、Provider live refresh、依赖或数据库模型。
