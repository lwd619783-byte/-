# 投资研究看板架构基线

## 2026-09-19 Industry Slice 6 runtime 增量

Registry / Generic Provider 与 reviewed dimension mapping 仍是唯一发现/映射 owner。原 `industryHistory` 提取为共享纯模块（TS 页面与 Node 重放共用，行为不变）；`industrySignalClaim.mjs` 读取 immutable resources 与 reviewed `industry-signal-policy.v1`，计算相邻留存绝对差、输入 manifest 和固定模板 Claim Candidate。浏览器惰性加载，只读、无新 Store/数据库/事件持久化；离线保留 `research-data/industry/signal-claim-v1/derived.json` 与 `graphs.json`，校验重放且禁止同路径覆盖不同内容。

F2 核心从原 offline contract checker 提取到 `evidenceGraph.mjs`，原 checker 和 Industry runtime 共用 typed-edge、revision、condition union、cycle/dangling/pin 门禁。Industry adapter 额外核对 exact owner、formula/manifest、Evidence→Fact 对应关系、origin、不可丢弃的 owner conditions。浏览器校验器从**原 F2 schema**离线编译，完整保留格式/Unicode 校验；只 bundle standalone helper，不带 Ajv compiler 或 Node-only 依赖。`data:validate:industry` 检查生成物与原合同一致。F2 schema/relation policy/原33个Golden不改。

`Industry Workspace → IndustrySignalClaimPanel → 原 EvidenceDrawer/ChartAuditPanel`：Candidate → Signal → input pins → exact observation/EvidenceRef → capture/raw SHA/locator/official URL。`candidateGraph` 仅声明候选引用结构存在；原 chart linkage 仍 null，正式支持资格均 blocked，不伪造历史 Entity/revision/PIT closure。

Prosperity V1 只返回 eligibility/abstention + blocker refs，无 score/direction。固定必需维度及额外行业范围/判断方法准入门禁由同一 reviewed policy 持有。F3 独立 Industry suite 使用原 evaluateRequest/Result/semanticDiff 执行真实同一服务；新增5个向量与原Frozen33个分开报告。没有新 Provider、Thesis/Portfolio/Agent、业务写入或网络采集。实现/验证/独立审计与数据生产准入始终分开；[Slice 6 方案](stage-4-2-slice-6-plan.md)。

> UI V1.0 设计入口：[NEON-RC1-20260909 获批事实源](ui-redesign/v1/README.md)与[D0–D5 执行索引](ui-redesign/v1/execution-index.md)。2026-09-09 APPROVED / FROZEN；D0 仅文档归档，D1–D5 未派发，不表示 UI 已实现或业务准入。

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

### 7.3 Market Regime 数据集与 Industry Metric pilot

Market Regime Metric Registry、时间语义、公式与 Historical Observation Catalog R1 已形成合同 / 数据骨架，但 R2 历史 release / vintage 数据集、normalization、backtest、formula admission 和正式 Engine 尚未完成。

Stage 4.2 Slice 1 已关闭，合入与 CI 事实见 [closeout](stage-4-2-slice-1-closeout.md)。Slice 2 已经 PR #58 合入 `086521d6bd305ea73cb5d4a426b9d4138e4a824b`，PR/main CI completed/success（2026-09-18 核验）；正式 `IndustryMetricDataset` source owner 继续与 `Industry` qualitative research context 分层。

Industry owner 发现链现在为：`config/industry/industry-metric-registry.v1.json` → generic resource loader → exact-byte SHA-256/pointer/identity 校验 → `list(industryId)` / `get(industryId, metricId)` → history / chart audit → 原 IndustryTab / EvidenceDrawer。Registry 分别 pin definition、artifact、既有 F1 binding 和 policy；状态从 owner/policy 投影，Evidence 入口来自 artifact observations，不复制成第二套 admission 或 Entity/F1 Registry。资源顺序无语义，任何索引身份/引用错误整体 blocked；不可选择近似指标、按数组位置拼 owner，或用原 qualitative/行情替代。

浏览器 glob 仅收集 config、industry artifacts 与 capture manifests 的 UTF-8 原文；先校验完整 Registry，再暴露不可变只读结果。没有网络刷新或业务存储写入。通用校验只理解 Pin 与 V1 owner/binding 身份；国家统计局专属表头、capture roster、raw digest、官方列和历史限制由 source-specific offline replay 锁定，未把 NBS capture 结构变成新的通用合同限制。

同一批 7 份 retained HTML 分别解析绝对量列 1/3 与官方同比列 2/4（1—2 月仅累计列 1/2）。两个 metric 均保留 13 个读数，声明窗口 2026-01—08，当月覆盖 6/8、累计覆盖 7/8；绝对量 owner/raw/binding 原字节不变。同比独立 identity、unit=%、provenance/F1 binding，不从产量推算、不累计差分、不补缺、不展示 delta。非机器人行业没有正式 owner 时显示 unavailable。

Slice 4（PR #61 已 MERGED / MAIN CI PASS，2026-09-18 核验）将离线 build/replay 收口到 `scripts/industry/source-adapters.mjs` 的 `industry-source-adapters.v1` code-owned allowlist。Registry 仍是唯一 metric discovery；adapter 只接受已审核 adapter ID + owner plan/artifact/binding/policy 路径 + plan digest，不按 industry fallback，不动态执行配置。NBS 原 parser/replay 与新 EIA parser/replay 复用 `metric-artifact.mjs` 的原 V1 schema/F1 binding；EIA 不依赖 NBS builder。通用 Provider 增加 weekly/window/week_ending 历史槽位，单位由 definition 原样传播，没有 oil-shipping runtime 分支。EIA 当前历史 HTML → retained bytes/manifest → 11 个周末库存 observations → Registry → 原 chart/Evidence/Signal/Event/Inbox；XLS 仅留存旁证，不参与数值重放。未知 publication/release 不映射为采集时间；Inbox 只在全部日期包含此未知日期 Event。两个 NBS artifact 与 pins 不变，未增加业务 owner/存储/admission/景气语义。见 [Slice 4](stage-4-2-slice-4.md)。

Slice 5（2026-09-18，VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW）新增独立 `industry-dimension-mapping.v1` config/schema 与 `industryDimensions.mjs` 的 Node/browser 共用 fail-closed 校验边界。Registry 仍唯一发现 source-fact owner；mapping 只精确引用 industryId/metricId/definition pin（含 revision），附受控 dimension/subdimension。规范化 review digest 独立锁定映射，合法但未经审查的维度替换、pin reseal、重复/缺失映射均拒绝；不污染 `industry-metric.v1`。数据流为 `Registry → exact mapping → existing Provider/industryHistory → industrySnapshot → IndustrySnapshotPanel → existing EvidenceDrawer`。只读快照有独立版本、固定 11 维缺失表示，不生成 delta/趋势/score/Claim 或持久化。新 EIA reviewed owners（产量/出口/炼厂投入）复用原 parser/build/F1 seam，总计 6 metric owners，oil-shipping 覆盖供给/炼化需求/贸易流/库存。raw/source/manifest 分别留存，原 3 owners 的字节/pins 不变；准入/PIT/F1/F2/F3 不提升。见 [Slice 5 冻结与验收](stage-4-2-slice-5-plan.md)。


Slice 3 在 Registry provider 之后增加只读 `industrySignals.ts`：每 metric 的 latest retained period 投影一个 Signal（monthly / year_to_date 两读数），同 source/period 聚合一个 Change Event。输入保留 definition/artifact/binding/policy pins、原 observations、Evidence 和质量；差额仅为允许的相邻月留存绝对值差。Event 接入既有 Research Inbox 与 EvidenceDrawer，industry deep link 进入原 IndustryTab；不新建 persistence / ResearchEvent owner、任务或 admission 机制。App 仅在真实/混合 runtime 注入，UI review fixture 隔离不变。

Slice 3 `industryChainTopology()` 仅读取 Industry.chain 与既有 company.chainPosition/segmentId；按原条目在位置文字中的字面匹配挂接公司，跨环节保留全部匹配，未匹配/冲突不默认定位。`industryCompanyOverlay()` 独立读取 exact-ID quote、financial/announcement owner，拒绝 foreign owner 和 mock/未知 Provider Fact。行情 updatedAt 是采集时钟，交易所 as-of 未留存即 unknown。原 Industry 页面新增最新变化 → 正式指标 → 产业链图 → 既有研究模块，复用 company drawer / segment deep link，无第二套页面。

Slice 3 细分关系增量（2026-09-18 CURRENT）将细分展示与公司跨阶段placement分离：`industryChainResearch.ts` 是既有 `Industry.chain` 与 segment `logic/demandSource` 的只读研究视图，7个唯一节点（上4/中1/下1/横向1）、6条有原文引用的功能关系。引用或identity失效则unavailable，不建立新的Provider/Entity owner，不声称企业供货关系。`IndustrySegmentMap` 用HTML节点与随ResizeObserver更新的SVG连线呈现；移动端显示源节点的关系目标短行。公司原始positions保持，展开区按exact ID合并，行情不改变结构。默认隐藏公司与Provider明细。验收与历史展示差异见[Slice 3](stage-4-2-slice-3.md)。

Slice 3 final remediation（2026-09-18，上一版展示记录）把上面投影的展示粒度改为 stage group → segment primary node → secondary company chips / expandable facts；当时仍无新的事实owner、关系或导航模型。节点覆盖分母是全部既有placement，公司研究状态与Provider质量分别呈现。Provider Stability使用配置expectedCompanies=57及current generated A股exact IDs，由`expected_company_cohort()`供observation和production validators共同核验；provenance cohort、历史56记录、门槛与default refresh准入不变，当前仍无足够观察窗口。

Slice 3 remediation（2026-09-18）保持上述投影，只将展示改为 stage → exact segment → company 的结构化React全景；桌面分区主轴、移动纵向，节点明细与公司/segment继续复用原路由。`listingIdentity.ts` 从已reviewed交易所披露映射匹配stock+唯一symbol后返回board/date/source，仅补正式上市身份上下文，不回填Provider profile或提升Entity/PIT/admission。`scripts/listing/probe_listing.py` 是手动只读seam：当前tracked private set的AST静态读取 → 显式官方source配置 → exact身份比对 → 五态结果；不会写Universe、扫描全市场或创建平行EntityRegistry。Unitree静态迁移由本轮reviewed代码完成，历史pre-IPO原文单独保留，当前private集合为空。

Provider局部增量：A composite fetch支持只刷新唯一已有A证券并保留其他公司/HK；腾讯quote总/流通市值按官方adapter列45/44解析，所有57 A真实response留存重放。公告每次refresh合并旧未覆盖ID，避免相等query window丢失旧留存。Guidance严格同epoch验证不变，跨epoch自动刷新seam仍未实现，本轮使用受控旧源验证与现有staged transaction。默认Provider refresh eligibility仍受原冻结56 roster约束而BLOCKED，未因Universe60自动扩大准入。

NBS `probe_nbs.py` 默认只读：官方 release list → 原 parser 校验期别/表头/原列 → retained hash 比较。显式 `--retain-new` 只新建 versioned capture；后续 owner/Registry/F1/Evidence replay 仍走现有体系，不自动入库或晋升。2026-09-18 官方最新与 retained 2026-08 bytes 相同，无新 capture。详见 [Slice 3](stage-4-2-slice-3.md)。

原 `data-source-registry.ts` 分别登记两个 source artifacts；共享 `DataQualityMeta`、Frozen `EvidenceRef`、F1 Pin、ChartPanel、ChartAuditPanel 和 EvidenceDrawer。两项 Entity unresolved，releaseAvailableAt=null，PIT UNPROVED、revision continuity unknown、Evidence candidate、chart linkage=null、data/production NOT_ADMITTED、allowedUses=[]。F1 binding 验证不构成 READY；F3 reference/actual service 分母、Frozen cases/report 不变。实现及验证见 [Registry V1](industry-metric-registry-v1.md) 与 [Slice 2](stage-4-2-slice-2-plan.md)。

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

## Stage 4.1-F Node-only semantic read path（2026-09-12 功能分支）

IMPLEMENTED / VERIFIED（本地限定范围） / PENDING INDEPENDENT REVIEW；原历史架构快照保留。`scripts/semantic-runtime/` 新增 F1 Query claim → exact metric/source binding → Market Regime adapter → PIT revision selector → fail-closed semantic result；正式 Entity Registry resolution 尚无 reviewed mapping，entity binding=null，全部查询保留 ENTITY_REGISTRY_UNRESOLVED，不将 metricId 等同 Entity identity，不连接/创建正式实体。readiness 从真实 committed artifacts 与 adapter replay 输出逐 metric 门槛，按独立 NORMALIZATION_GATES（15）/PIT_BACKTEST_GATES（16）计算，overall=BOTH_READY；readiness 与 progress 计数分离。原 EntityRef、SourceDefinitionVersion、MetricObservationVintage 及 F1 checker 继续拥有合同语义，不复制 Metric/Evidence/Entity/Audit 模型。

输入为本地版本化定义、binding/policy、catalog 或 compact evidence，默认只读；显式 build 命令仅生成本切片报告。该路径没有接入 SPA、Local Core 数据库、Provider refresh、Bridge 或生产评分。PBC 完整 raw/catalog/extraction graph 缺失时只返回诊断证据和 blocker，不能从 retained excerpt 或 source report PASS 获得 eligible value。新增结构与验证见 [Stage 4.1-F](market-regime/semantic-runtime-readiness-v1.md)。

## Stage 4.1-G versioned identity / retained evidence read path（2026-09-13）

IMPLEMENTED / VERIFIED（本地） / PENDING INDEPENDENT REVIEW；原 V1 路径保持发布语义。新增 `market-regime-adapter-v2.mjs`：F1 Query claim → exact reviewed mapping pins / review history → 原 EntityRepository 的 current read-only list 全量 entry 对账 → 原 metric/source adapter → native PBC graph validator / 原 PIT selector → V2 fail-closed result。trusted Node host 负责注入只读 Registry port，query 不接受 authority 自报；默认无 confirmed mapping、无本机 DB 接线，不创建第二套 Registry、不执行 mutation。

PBC V2 只把原 sealed R2-B 的一条 native catalog/sidecar slice 与两份真实 RAW_SOURCE 转为 committed replay owner；Python 继续使用原 R1 catalog / R2 Graph validator / PBC parser，Node 查询只收到截止前的原生 observation 与 extraction refs。完整 graph/source gate 不从该 canary 获得 PASS。Readiness V2 在保留并重验 V1 后重新评估同一 23 metrics 和 15/16 gate 集，输出 368 条 full-scope delta 及独立 canary capability delta；默认没有 live Registry owner，identity 仍 unresolved。未接入 SPA、Provider refresh、Bridge、normalization 或 backtest。详见 [Stage G](market-regime/identity-pbc-evidence-closure-v2.md)。

## Stage 4.1B / Slice 1 Browser Inbox read path（2026-09-14 功能分支）

新增只读数据流：原 Expectation/ResearchEvent 聚合与 `buildReviewTasks` → `buildResearchInbox` 临时投影 → HomePage / ResearchInbox → EvidenceDrawer。业务事实仍由原 ResearchEvent、WatchItem/ReviewTask、Expectation repository/store 拥有；投影无存储、Provider、网络或 Node Local Core 入口。App 复用分钟显示时钟更新当前任务，所有写入仍回到原 `ReviewFormModal` / `WatchlistStore.completeReview`，精确导航复用 `useWorkspaceNavigation`。

验证中心原 EventCard 抽为 `ResearchEventEvidence`，由验证中心及抽屉共同使用。Drawer 消费当前 owner 事件和精确匹配的预期快照，不建立 Evidence registry 或 F2 graph runtime；PIT/admission/revision/graph 缺少正式证明时显式未证明。原三主题/Modal/隔离 ui-review 路径继续复用。详见 [Slice 1](stage-4-1b-slice-1.md)。本段为分支实现，不宣称已合入或准入。


## Stage 4.1B / Slice 2 chart audit / product context read path（2026-09-16 功能分支）

基线 `63208ce038f5222d10bfa471bc5d0a868fe2905e`。IMPLEMENTED / PENDING INDEPENDENT REVIEW；本节不宣称已合入或准入。Slice 1 已在 PR #50 合入，merge/main `38ffcbd44ecd2c4531b6ef737d4c6616ec197ca8`，PR/main CI 收口事实见 [Slice 1 合入记录](stage-4-1b-slice-1.md)；上方 Slice 1 分支段保留其历史时点。

- `GeneratedRealDataBundle.priceHistory[stock.id]` → 精确 id 校验 → `Stock.priceHistorySource` 保留原 `PriceHistorySeries` 引用，`Stock.priceHistory` 保留同一 points 引用 → `priceChartAudit`；chart 窗口必须是 owner 原点引用的子集。它不是新事实 owner，也不单独持久化。
- `loadAShareFinancial` / 现有隔离 presentation seam → 原 `AShareFinancialData` 与所属 `FinancialReport` → 公司 id/code、report code/market/scope 校验 → `financialChartAudit`。UI 不修改报告、不补发布时间、不生成事件。scope、原始字段状态、派生/单位转换与 Provider 版本均为只读展示。
- 两个投影 → `ChartPanel.audit` → `ChartAuditPanel`；React state 只控制范围/展开。PIT、releaseAvailableAt、正式 revision、data/production admission 没有 owner 字段时保持未提供/未证明；未连接 Node-only Macro Semantic Runtime 或 F2 Graph runtime。
- `ProductShell` 由首页/公司 ResearchHeader 消费既有上下文/动作；`RelatedResearchEvidence` 只选择唯一事件 ID 且 company id/code/market 匹配的当前事件，调用原 Evidence Drawer。公司相关事件不构成 chart metric/revision exact linkage。App/navigation/Store 不改，业务写入仍由既有 owner 负责。

专项映射、证据边界和验证见 [Slice 2](stage-4-1b-slice-2.md)。

## Stage 4.1B / Slice 3 Node-only Research Eval path（2026-09-17 功能分支）

IMPLEMENTED / VERIFIED（本地） / PENDING INDEPENDENT REVIEW。Frozen Golden V1 → 原 suite/case digest 与 fixture pin preflight → `scripts/research-eval/harness.mjs` → `targets.mjs` 审核注册表 → `execute({operation,request,input})` → 原 Result schema / exact semantic diff → deterministic report。Harness 持有 expected，target 只接 detached frozen 输入；正式报告拒绝未注册对象及 oracle wrapper，测试 double 仅能使用低层 comparison seam。默认 CLI 离线、不写文件，显式 `--write` 仅生成 synthetic eval artifact。

Oracle dispatch 仍在原 `scripts/contracts/financial-research.mjs`，唯一 reference target 明确 REFERENCE_ONLY；四 oracle 算法不变，不进入 production domain。实际 Macro runtime / earnings comparison 继续自己的 owner/identity/Evidence authority 边界，当前与 Frozen V1 fixtures 无兼容 reviewed adapter，故 actual service coverage=0/33、NOT_IMPLEMENTED=33，而 reference health=33/33 PASS。Inbox/Chart/Evidence/Shell 仍为原 owner 的产品 read models，不被当作通用 graph/retrieval service。

future MCP/Agent 需审核并注册 adapter 后复用同一 Harness/Result，当前无真实模型、MCP、网络、Provider refresh 或 Local Core/business storage 接线。没有新业务 owner、准入或持久化路径，前端 bundle/route 无变更。边界、capability matrix 和本地回归见 [Slice 3](stage-4-1b-slice-3.md)；Slice 1/2 合入事实以上方 CURRENT 文档及各 Slice 收口记录为准。


## Stage 4.2.5 Creator Viewpoint Browser workspace

`#/creators → CreatorViewpointWorkspace → CreatorViewpointRepository → Browser adapter / PersistedBaseGuard → localStorage`。只存不可变 Creator/Topic/Source/ExternalResearchEvent/Observation/Approval/Review 记录；Current View、State Transition、T+5/20/60 calendar-day 到期项通过纯函数派生，无第二份 current/task 状态存储。严格版本/图校验、corruption锁写、JSON确认与pre-import备份构成恢复边界。Excel六表为无写回分析副本。

`ResearchEventCore` 从既有 `src/types/researchEvent.ts` 提取，保留公司ResearchEvent原字段；ExternalResearchEvent用external scope独立表达宏观背景，不伪造stockId，不建立第二个Provider。它由tracker envelope拥有，一次存储、多Observation引用。原ResearchInbox的公司WatchItem/ReviewTask owner不变；本功能没有伪造观察清单以挂接博主复盘。Timeline/Comparison节点复用原EvidenceDrawer（外部commentary分支）与Modal，来源链接走safeEvidenceUrl。App沿用Workspace导航，ui-review使用内存adapter隔离业务存储。

Node-only Local Core / SQLite / Research Bridge / contracts/v1 / F2 Evidence Graph无新增写入口或准入；External Commentary不能自动晋升为Provider Fact、Verified Claim、User Judgment、Thesis。As-of按本地记录/审核可得时点，不声称外部strict PIT。详细接口、历史/恢复语义和限制见[当前交付](stage-4-2-5-creator-viewpoint-tracker.md)。


### Stage 4.2.5 audit remediation: chronology and recovery

同一 envelope 保持 append-only；knowledge As-of 先过滤本地可见历史，再按来源 publishedAt 派生 Creator Timeline/Current View/Transition，T+ 也使用该来源锚点。未知或冲突 chronology 不以审批时间冒充，UI/Excel 分开显示两类时间。ExternalResearchEvent 的来源级 verified 复用 ResearchVerificationStatus，不改变正式事实/Claim/Thesis 准入。

Browser repository 新增受控灾难恢复 seam：观测并绑定损坏原字节、导出、完整校验备份、显式确认、独立 pre-recovery 原字节备份与读回校验、最终基线检查、仅替换 tracker key、reload/semantic validation。普通 append/import 在 corruption 下继续锁定；显式未知/future schema 不可走该恢复入口。现有 PersistedBaseGuard、Local-first/Node-only 边界不变，不增加云或 SQLite 写入口。

## Stage 4.3 Research Memory & Thesis Compiler boundary（2026-09-20 设计冻结）

Stage 4.3 不建立“一个万能 Wiki 数据库”，而是在既有 owner 之上增加稳定 adapter / domain contract。统一研究链为：

```text
L0 Raw Source / Evidence
  → L1 Structured Extraction
  → L2 Reviewed Research Memory / LLM Wiki
  → L3 Verified Claim
  → L4 Thesis
  → L5 Investment Expression
```

治理平面 Schema / Entity Identity / Provenance / PIT-asOf / Revision / Verification / Audit 横跨各层。Source owner 继续拥有原始内容：CreatorSource、Provider Evidence、未来 PDF/Article/User Note 等不迁入一张通用表；Stage 4.3 只定义 `ResearchSourceRef/Adapter` 供统一引用。Structured Extraction 是独立一等对象，保存 extractor/author type、source refs、entity/topic refs、结构化输出、uncertainty、status 与 revision；AI 默认 draft。

Creator Tracker 是首个真实 adapter：`CreatorSource` 对应 L0，`ViewpointObservation` 对应 L1 的 creator-specific extraction，Transition/Review 提供时间演化与事后验证；Wiki 通过 ID 引用这些对象，不复制原文或维护第二份 Current View。

LLM Wiki 属于 L2 Research Memory：Entry / revision 必须保留 sourceRefs / extractionRefs / evidenceRefs；可检索和综合，但不能变成 Provider Fact authority。L3 Verified Claim 继续复用既有 F2 Evidence Graph / Evidence Drawer，不建立第二个 Claim Graph。L4 Thesis 与 L5 Investment Expression 均为 revision-aware research objects；Portfolio、MCP 和 Agent 分别留在 Stage 4.4、4.5、4.6+。

Browser/Local-first 边界继续有效；Stage 4.3 不因 Wiki 引入 cloud business DB、浏览器直连 SQLite、Vector DB/Graph DB 强制迁移或自动网页抓取。详细计划见 [Stage 4.3 冻结方案](stage-4-3-research-memory-wiki-thesis-plan.md)。


### Stage 4.3 Slice 2 runtime boundary（2026-09-20 分支实现）

`#/memory` → ResearchMemoryWorkspace → WikiRepository (`wiki.v1` localStorage envelope)；Wiki authority 仅 Entry/append-only Revision/Review。`WikiOwners` 在 revision cutoff 上复用 Slice 1 Creator adapter 与 Industry Registry retained-byte Evidence；不存 Raw Source/Extraction/Evidence 副本。Current/search/backlinks/orphans 从历史派生；Node-only Entity Registry 无浏览器 bridge，未知 owner 拒绝。

`Reviewed Wiki read model → wikiProjection → ZIP STORE / research-wiki/*.md + manifest.json` 是单向可重建投影。目录校验只比较外部字节与 Domain 输出，repository 无 Markdown 写回方法。Wiki JSON 为完整 Wiki 历史备份，原 owner 仍独立备份。Future schema/corrupt lock、显式恢复确认、pre-write byte backup 和 PersistedBaseGuard 沿用既有边界。

Pure canonical JSON 算法提取至 `shared/canonical-json.mjs` 供 Node/browser 共同使用；Local Core wrapper 保留原错误类型，原 browser boundary 插件未放宽。ZIP STORE 通用编码从 Creator XLSX 提取，原导出格式不变。无 Local Core browser bridge、云 DB、Claim/Thesis 或 Agent runtime。详见 [Slice 2 D0、合同与限制](stage-4-3-slice-2-llm-wiki.md)。
