# 投资研究看板架构基线

> 文档状态：CURRENT IMPLEMENTATION SNAPSHOT / NOT CURRENT PRODUCT ROADMAP  
> 基线日期：2026-09-08
> 代码基线：`main` @ `2230265e727f0f2787de9e82d509f0c1d3a6230a`
> 本文描述该代码基线下的已实现架构与技术边界；固定 SHA 是历史快照，不代表当前 `main`。当前实现状态还应核对 `docs/feature-registry.md`、当前代码和测试。  
> 2026-09-09 导航同步：R2-A/B、CSRC、SSE/SZSE/BSE、D2 已合入本轮 remediation 的 pre-remediation / audit-input main baseline `a6cbf108139a2af66273c5376288b83d54712f58`，该 SHA 不是永久 CURRENT main；当前实现 / 数据准入状态见 [Feature Registry](feature-registry.md) 和 [CURRENT roadmap](investment-dashboard-v2-post-phase-1b-roadmap-rebaseline.md)。[Master Audit 修复](master-audit-remediation-v1.md)记录保留记录时点状态；Browser / Node-only 边界保持。
> Remediation 的实际 merge / CI 状态以包含本变更的 Git commit 是否成为 `main` ancestor、对应 PR 和 GitHub Actions 为准；静态 CURRENT 文档不预写 MAIN MERGED，也不自证 CI PASS。
> 当前 V2 产品与目标架构决策见 `docs/investment-dashboard-v2-research-os-and-bridge-design.md`、`docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`、`docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md` 与 `docs/investment-dashboard-v2-final-contract-audit-v1.md`。`docs/investment-dashboard-master-plan-2026-09.md` 保留为 Stage 4 历史建设基线，不再是当前 V2 最高级路线图。

## 1. 系统定位

投资研究看板是面向 A 股 / 港股的个人投研工作台。当前系统已经不只是行情展示，而是由研究界面、真实数据 Provider、证据工作流、复盘工作流和数据治理共同组成。

当前产品闭环大致为：

`宏观 / 行业 / 个股信息 → 真实数据 → 业绩预期证据 → ResearchEvent → Earnings Verification → Watchlist Review`

Node-only Local Core 已经补齐资产事实账本，但浏览器组合闭环尚未完成。剩余目标闭环为：

`研究 → 估值 → 投资决策 → 持仓 / 组合 → 事件验证 → 复盘 → 再平衡`

## 2. 技术栈

- React 18
- Vite 6
- TypeScript strict
- Tailwind CSS 3
- Recharts
- Vitest
- Ajv V1 contract validation
- SQLite / better-sqlite3（Node-only Local Core）
- Python 数据脚本
- Node.js 数据生成 / 校验脚本
- GitHub Actions
- Vercel SPA

当前已有单用户 Local-first SQLite Local Core，但没有 cloud business database、Auth 或 cross-device sync。浏览器现有 Watchlist / Expectation 工作流仍按实际代码保存在 LocalStorage；不得把 Phase 1B Local Core 描述为所有浏览器工作流已经迁移。

## 3. 顶层模块

### 3.1 页面 / 业务域

当前 `App.tsx` 暴露 6 个主入口：

1. 宏观
2. 行业
3. 个股池
4. 观察清单
5. 验证中心
6. 预期证据

对应主要目录：

- `src/components/dashboard`：宏观研究
- `src/components/industry`：行业、细分行业、产业链
- `src/components/stock`：股票池、个股卡片、个股详情
- `src/components/watchlist`：观察清单、复盘、任务、备份
- `src/components/research`：ResearchEvent 与业绩验证
- `src/components/expectation`：业绩预期证据层
- `src/components/common`：通用研究终端组件
- `src/components/layout`：Header / Sidebar / RightRail / Layout

### 3.2 数据与服务

- `src/data`：研究静态数据、数据源注册表、生成数据摘要
- `src/data/real`：可同步加载的真实生成数据
- `public/data`：按公司拆分的重数据详情文件
- `src/services`：Provider 聚合、异步详情加载、校验、证据选择、事件生成、任务生成、持久化
- `scripts`：抓取、生成、校验、审计、环境健康、Provider 观测
- `config`：Provider Stability Gate 与 Observation Schema

### 3.3 Node-only Local Core

`local-core/` 与 Browser SPA 是两个清晰运行边界。它当前包括：

- `contracts/registry.ts`：`contracts/v1` schema / static invariant 校验；
- `db/`：单用户 SQLite、顺序 migration、完整性 / checksum / FK 校验和同步 immediate transaction；
- Entity Registry / Resolver；
- append-only Audit；
- Account / Asset ledger；
- Transaction / CashFlow / PositionSnapshot；
- DCA Plan revisions / Executions 与 rollover 历史；
- Asset Import / HistoricalAssetImport、账户总额 reconciliation；
- confirmation、approval binding、idempotency、deduplication 与原子 commit。

`LocalStore` 只向普通调用方暴露 ledger reads，正式写入经 transaction-scoped repository 与 Domain Service 完成。前端不得直接 import `better-sqlite3`、Node built-ins 或 `local-core/**`；Vite browser-boundary gate 负责阻断直接、动态和传递导入。当前也没有把 Local Core 暴露成 HTTP / MCP / raw SQL 服务。

## 4. 数据读取架构

### 4.1 前端数据模式

系统支持：

- `Mock Data`
- `Mixed Data`
- `Real Data`

Real Data 模式把缺失、`partial`、`stale`、`not_implemented` 等作为显式状态；以 mock 或 `0` 静默替代真实缺失属于合同不允许的语义。跨任务数据不变量以根 `AGENTS.md` 和对应 Contracts 为准。

### 4.2 轻数据与重数据拆分

A 股财务、A 股公告、公司指引等数据采用：

`summary → manifest → per-company detail`

架构。

目的：

- 首屏只同步加载摘要；
- 打开个股详情时再按公司加载完整历史；
- manifest 约束允许路径、文件大小、checksum 和身份；
- 避免完整历史进入初始 JavaScript bundle。

### 4.3 Provider 生产边界

Provider 网络访问只发生在本地 / 运行脚本层，不进入浏览器前端。

典型链路：

`外部公开源 → fetch/generate script → validation → generated artifact → dataProvider/service → UI`

当前正式存在的独立 Provider / 数据链包括：

- A 股行情 / 历史价格
- 港股行情 / 历史价格 MVP
- A 股财务 Provider V1
- A 股公告 Provider V1
- Company Guidance Expectation Provider V2

A 股财务和公告目前仍未通过 Stability Gate 的生产 admission，因此没有纳入默认 `data:refresh`。

## 5. 数据真实性与治理架构

### 5.1 Data Source Registry

`src/data/data-source-registry.ts` 是数据能力总登记表，记录：

- category
- market
- status
- sourceType
- provider
- sourceUrl
- storage location
- generator
- refresh method / frequency
- coverage
- frontend consumers
- fallback behavior
- verification status
- known limitations

它是判断“数据是否真的已接入”的第一权威入口。

### 5.2 Data Audit

`npm run data:audit`

负责检查：

- mock / placeholder 是否错误进入 production route；
- 缺失值是否被转换为 0；
- registry 与实际文件 / consumer 是否一致；
- blocking risk / P0 是否存在；
- 生成路径、覆盖率与状态是否自洽。

### 5.3 Provider Stability Gate

财务和公告 Provider 使用独立的跨日稳定性资格体系，包括：

- Provider Observation
- provenance cohort
- append-only observation ledger
- resolution ledger
- checksum / identity / schema
- rolling-window removal 分类
- data drift
- coverage / validation
- run 数、成功日、自然日门槛

当前状态：机制已经完成，但截至代码基线仍为 `insufficient_observation_window / NO_GO`。

### 5.4 Developer Health / CI

开发环境门禁：

- `npm run env:check`
- `npm run --silent env:check:json`

CI 主要执行离线校验，不依赖实时 Provider 网络访问。

## 6. 研究工作流架构

### 6.1 ResearchEvent

`researchEventProvider` 将财务、公告、业绩预期等事实标准化为研究事件。

ResearchEvent 用于连接：

`事实变化 → 待验证事项 → Watchlist Review / Earnings Verification`

### 6.2 Earnings Verification

验证中心承担“事前判断与事后事实”的对账，而不是只展示最新财报。

当前比较语义要求可靠的事前证据，并区分数据发布时间、形成时间、披露时间与审计时间；缺失事前证据时不产生“超预期 / 不及预期”的正式比较。

### 6.3 Earnings Expectation Evidence

预期证据层包含：

- 公司指引
- 单家机构预测
- 机构一致预期模型
- 用户预测
- immutable snapshot
- correction chain
- business revision chain
- temporal audit
- CSV / JSON / 手工录入

当前自动机构一致预期 Provider 仍是 `not_implemented`。

### 6.4 Watchlist Review

Watchlist V2 已从静态清单升级为研究工作流：

- WatchItem
- immutable Review History
- ReviewTask
- next review
- ResearchEvent reminder
- JSON backup / import / merge / replace
- corruption recovery

当前数据边界：LocalStorage，仅单浏览器 / 单 origin。

### 6.5 Asset / DCA Local Core

Phase 1B 已在 Node-only Local Core 实现账户、资产、交易、现金流、持仓快照和 DCA 历史。正式 mutation 必须绑定 confirmation、idempotency receipt 与 Audit；导入使用 prepare-plan-confirm-commit，并在 commit 前重新验证证据、计划摘要与当前状态。

`ImportTrust` 目前只是由可信本地主机提供的只读 seam，默认实现 fail closed。仓库尚无真实可信来源 adapter、OCR / screenshot parser、浏览器确认 UI 或真实历史账户 migration runner，因此 synthetic/temp 验证不能表述为真实迁移或生产准入。

## 7. 当前架构缺口

### 7.1 App 过度集中

`src/App.tsx` 已承担大量：

- 页面导航
- Provider workflow load
- LocalStorage repository / store 初始化
- ResearchEvent 聚合
- ReviewTask 聚合
- Expectation workflow 聚合
- dashboard KPI 计算
- 多个 Modal 状态

继续增加牛熊温度计、估值、Portfolio 后会进一步放大耦合。

该架构快照当时建议逐步转为：

`App Shell → Feature/Page module → Domain service/store`

### 7.2 Local-first 已落地，远程与浏览器接入仍缺失

当前已经有单用户 SQLite Local Core；仍没有：

- Auth
- cloud business database / PostgreSQL / Supabase persistence
- cross-device sync
- multi-user
- server-side scheduled jobs
- 浏览器到 Local Core 的受控 read model / API
- Research Bridge / MCP adapter

Local-first freeze 明确覆盖旧“先建设最小 Cloud Research Store”的假设。远程访问未来必须经过受控 Domain API / Research Bridge、最小权限、确认与 Audit；不得将 Local DB 或 raw SQL 直接暴露。是否改变为 cloud business database 需要新的 scope freeze。

### 7.3 Market Regime 数据集与 Industry Metric Registry 仍未完成

Market Regime Metric Registry、时间语义、公式与 Historical Observation Catalog R1 已形成合同 / 数据骨架，但 R2 历史 release / vintage 数据集、normalization、backtest、formula admission 和正式 Engine 尚未完成。Industry 仍没有正式 Metric Registry / Provider。

后续正式数据能力继续统一表达：

- source
- nativeFrequency
- releaseLag
- observationDate
- effectiveDate
- revisionPolicy
- staleAfter
- normalization

正式牛熊温度 UI 必须等待 PIT historical dataset、normalization、backtest 与 formula admission；不得回退到旧的条数驱动或伪量化分数。

### 7.4 Portfolio Exposure 与估值缺口

Phase 1B 已经实现 Account / Asset / Transaction / CashFlow / PositionSnapshot 与 DCA Local Core，后续不得再建立第二套同义账本。当前仍没有正式的：

- Valuation Snapshot
- Scenario
- Target Price
- Portfolio aggregate / exposure
- thesis ↔ position mapping
- macro / industry exposure
- Target Allocation
- Rebalance Task
- performance attribution methodology / admitted calculation
- Portfolio read model / browser UI

这些才是从当前资产事实层进入 Portfolio Exposure MVP 的真实缺口；Local Core 完成不等于 Portfolio MVP 完成。

## 8. 原 Stage 4 目标架构记录

以下结构是本架构快照形成时的演进建议，保留用于理解现有代码的重构方向；当前 V2 产品和目标架构决策以本文顶部列出的 V2 freeze / audit 文档为准。

```text
src/
  app/                 # App shell / router / global composition
  features/
    macro/
    market-regime/
    industry/
    stocks/
    expectations/
    research-events/
    watchlist/
    valuation/
    portfolio/
  domain/              # 稳定业务模型与纯逻辑
  services/            # Provider adapters / repositories / orchestration
  data/                # generated summaries / static reference
  components/          # 真正跨 feature 的通用 UI
```

该快照的演进方向是避免 `App.tsx` 继续扩张，并逐步形成 feature / domain 边界；不要求为了匹配目录草案一次性重构，具体目标结构以当前冻结架构和任务范围为准。

## 9. 架构约束摘要

跨任务的数据真实性、PIT、审计、权限、Production Admission 与 Git 不变量统一由根 `AGENTS.md` 和对应 Contracts 维护，本架构快照不再重复一套 Agent 指令。与当前实现结构直接相关的约束包括：

1. **Provider fail closed**：adapter / artifact 的来源、identity 或 schema 不可靠时不生产看似有效的正式结果。
2. **重数据 lazy load**：继续使用 `summary → manifest → per-company detail`，避免全量历史进入 initial bundle。
3. **自动化可降级**：Provider / AI 自动能力失败时保留既有手工研究工作流的可用性。
4. **控制 App 耦合**：新增功能优先形成 feature / domain 边界，避免继续把 orchestration 和业务状态堆入 `App.tsx`。
5. **结构性新域先表达模型**：Market Regime、Valuation、Portfolio 等新域在接入复杂 UI 前先形成可验证的数据 / domain contract。
6. **Browser / Node 边界**：Browser SPA 不直接依赖 SQLite、Node Local Core 或 raw DB；通过后续受控 read model / Domain API 接入。
