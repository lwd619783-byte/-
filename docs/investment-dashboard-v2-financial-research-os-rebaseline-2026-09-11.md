# Investment Research Dashboard V2 · Financial Research OS Rebaseline

> 2026-09-23 CURRENT — R2 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。PR #76，merge/main `17a2e1929c1d7570e477a5e19aadbeee29aa04f5`；PR CI `35746157236`、main CI `35746962990`、同 SHA Production deployment `6594270082` 已实时核验 success。主线切换 **Stage 4.3-R3 Investment Expression V1 + Closeout：IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT**。真实 5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression；Stage 4.4–4.6 PLANNED / NOT_IMPLEMENTED。本条 supersede 下方较早 CURRENT，不回写历史审计。[R3 D0 与交付](stage-4-3-r3-investment-expression-closeout.md)。


> 2026-09-22 CURRENT — **Stage 4.3-R2 Thesis V1 + Macro → Industry：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。真实 Base `1651aa7bbf3fcdf4a59d17e7ae6e6edaf057ef7d`，分支 `codex/stage-4-3-r2-thesis-v1`。R1 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**：PR [#75](https://github.com/lwd619783-byte/-/pull/75) 于 2026-09-22T13:33:13Z 合入上述 merge/main；PR CI [35733395999](https://github.com/lwd619783-byte/-/actions/runs/35733395999)、main CI [35734221779](https://github.com/lwd619783-byte/-/actions/runs/35734221779) 已实时核验 success；Production deployment `6591911800`（同一 Base SHA）已实时核验 `success / Deployment has completed`，与用户确认的 READY 一致。真实仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis**，data admission / PIT / release blockers 不变。R2 完成后仅普通 commit/push，等待 ChatGPT 独立审计；R3 **PLANNED / NOT_IMPLEMENTED**。本条 supersede 下方旧 CURRENT 与停止点，不回写历史审计。 R2 本地全量 1,317 tests、build、contracts、research/industry/data audit、discovery 均通过；R2 real browser 49/49、synthetic browser 52/52、R1 browser 130/130（均 0 runtime errors）。详见 [R2 实现与验证](stage-4-3-r2-thesis-v1.md)。


> 2026-09-22 CURRENT — **Stage 4.3-R0 External Knowledge Rebaseline**；默认 External Knowledge Lane（Drive → ChatGPT → Notion），OS 聚焦 Research Decision Lane；Local Wiki / Bridge 为冻结功能范围的兼容能力。下一任务 **Stage 4.3-R1 Verified Claim V1**。本轮功能分支待独立审计；普通 commit/push 后停止，无 PR/merge/Production。[Stage 4.3-R0 正式决定](stage-4-3-r0-external-knowledge-rebaseline.md) supersede 下方旧路线与 CURRENT 停止点，历史审计/验证数字仍仅代表原时点。

> 合入事实已于 2026-09-22 重新核验：Slice 2/2.5 经 PR [#72](https://github.com/lwd619783-byte/-/pull/72) 合入 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，main CI [35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441) success；UI V2.1 经 PR [#73](https://github.com/lwd619783-byte/-/pull/73) 合入开工基线 `9769c46789a6efc98999fe7fabeda750710cbbb5`，main CI [35690271399](https://github.com/lwd619783-byte/-/actions/runs/35690271399) success。代码已 MERGED / MAIN CI PASS；旧真人审核、UPDATE/history/revoke 验收仍 PENDING / NOT_VERIFIED，本轮私人数据 NOT_REVERIFIED，不能据此宣称 Slice 2.5 完整验收 CLOSED。

> 2026-09-21 CURRENT 增量：Slice 2/2.5 代码已由 PR #72 合入 main `a029b1e`（CI35603915441 success）；真实原范围验收仍保留本人CREATE审核、同Wiki UPDATE/history/revoke拒读的PENDING账单，不据此关闭整个Stage4.3。按用户本次指令，在当前切片后插入跨模块 **UI V2 Clear Research Workspace**：重组访问路径与统一阅读，领域owner、公式、PIT、权限、只读Bridge及正式版本规则不变。后续Slice3–6、4.4 Portfolio Exposure MVP、4.5 Research Bridge / Controlled Tool Layer、4.6+ Research Agent / Artifact / Global Coverage保持下文原名/顺序/范围；不以导航预留宣布实现。[UI V2冻结与迁移](ui-v2/implementation.md)。


> 状态：CURRENT STRATEGIC ROADMAP REBASELINE V1  
> 日期：2026-09-11  
> 设计输入：`origin/main @ 087c52a7962ed08c3f550d79987e0282be5607cf`  
> 作用：在不推翻既有 V2、Local-first、PIT、Provider Admission、Phase 1A/1B 与已冻结 UI 事实源的前提下，把“可信数据 → 证据 → 研究判断 → 投资表达 → 组合 → 复盘”收敛为统一的 Personal Investment Research & Asset OS 路线。
>
> 本文是战略路线与跨域架构重基线，不自行授权任何未冻结的业务实现、Provider 准入、合同破坏性变更、云端数据库迁移或 AI 自动交易。实际实现状态仍以当前代码、测试、`docs/feature-registry.md`、`docs/architecture.md`、对应合同与专项审计为准。

## 1. Authority 与覆盖范围

本文吸收并重排以下既有方向，但不回写其历史时点结论：

- `docs/investment-dashboard-v2-research-os-and-bridge-design.md`：Top-down Research OS、Research Inbox、Thesis、Investment Expression、Portfolio、Research Bridge；
- `docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md`：Local-first、受控 Bridge、备份与用户确认边界；
- `docs/investment-dashboard-v2-post-phase-1b-roadmap-rebaseline.md`：Phase 1B 后的 Stage 4 顺序与实际缺口；
- `docs/ui-redesign/v1/`：已批准 UI V1.0 事实源；
- `contracts/v1`：当前已实现 Phase 1 合同语义。

从本文起，**后续战略开发顺序与跨阶段基础设施以本文为优先路线入口**；旧 roadmap 中的实现事实、历史 SHA、PR、CI、准入结论继续保留其证据意义。若本文与 Local-first freeze、现行 machine-readable contract 或数据真实性 hard invariant 冲突，以后者为准。

## 2. 核心产品决策

长期产品不再以“数据看板”或“公司详情聚合器”为目标，而明确收敛为：

`Macro / Market Regime → Industry → Evidence → Claim / Thesis → Investment Expression → Position / Exposure → Event Verification → Review`

平台的核心价值从“展示更多数据”升级为“让每个重要结论都能沿证据链回溯，并让研究结论最终进入组合与复盘”。

因此后续优先级不是继续横向堆 Provider 或页面，而是优先补齐三项跨域基础设施：

1. **Financial Semantic Registry V2**：统一“数据是什么、口径是什么、什么时候可用、如何计算、什么情况下不能用”；
2. **Evidence Graph V1**：统一 Source / Artifact / Evidence / Fact / Derived Metric / Claim / Thesis / Position / Review 的引用关系；
3. **Investment Research Eval Suite V1**：把 PIT、检索、计算、比较、研究与未来 Agent 的正确性变成可重复验收，而不是只靠人工观感。

Research Memory、Artifact Center、Research Agent 与外部 Bridge 在上述三项基础能力稳定后逐步接入，不建立平行语义层。

## 3. 目标架构

```text
┌──────────────────────────────────────────────────────┐
│ Product UI                                           │
│ Research Inbox / Macro / Industry / Company /       │
│ Verification / Portfolio / Evidence                 │
├──────────────────────────────────────────────────────┤
│ Research Workflow / Orchestrator                     │
│ deterministic tools first; Agent later              │
├──────────────────────────────────────────────────────┤
│ Claim / Thesis / Research Memory / Artifact          │
├──────────────────────────────────────────────────────┤
│ Evidence Graph                                       │
├──────────────────────────────────────────────────────┤
│ Financial Semantic Registry                         │
├──────────────────────────────────────────────────────┤
│ Structured Fact Retrieval | Document Evidence       │
├──────────────────────────────────────────────────────┤
│ Provider / Filings / Macro / Market / Local Core    │
├──────────────────────────────────────────────────────┤
│ PIT / Provenance / Admission / Audit / Evals        │
└──────────────────────────────────────────────────────┘
```

这是一套逻辑架构，不预设必须使用图数据库、Vector DB、云数据库或特定 Agent Runtime。

## 4. Cross-cutting Foundation F1 — Financial Semantic Registry V2

### 4.1 目标

现有 Data Source Registry 与 Stage 4.1 Metric Registry 继续保留。F1 不另建第二套同义 Registry，而是形成共享语义能力，使 Macro、Industry、Company、Valuation、Portfolio 等 Domain 可以在各自合同内复用统一语义字段。

推荐最小语义维度：

```text
identity
- domain
- entity / universe
- metricId
- canonicalName

measurement
- unit
- currency?
- nativeFrequency
- aggregation
- reportingBasis?

temporal
- observationDate
- publicationDate?
- releaseAvailableAt?
- effectiveDate?
- revisionPolicy
- staleAfter?

lineage
- source
- provider
- rawField / artifactRef
- transformation / normalization
- formulaVersion?

quality
- coverage
- admissionStatus
- conflictStatus
- caveats

agent / consumer policy
- allowedUses
- forbiddenUses
- preferredTool?
```

具体字段是否进入 `contracts/v1`、新增 V2 contract 或只作为领域 registry 扩展，必须在实施切片前单独 scope freeze；本文不直接改合同。

### 4.2 检索原则

金融结构化事实优先走 deterministic structured retrieval，例如：

`get_metric(entity, metric, period, asOf)`

公告、财报、政策、研报、新闻等非结构化材料进入 Document Evidence 路径，可采用关键词、embedding、metadata filter 与文档结构联合检索。

**不得把所有结构化金融事实统一塞入 Vector RAG，再让模型猜最终数值。**

## 5. Cross-cutting Foundation F2 — Evidence Graph V1

### 5.1 目标

Evidence Graph 是统一引用与可追溯语义，不要求使用 Graph DB。V1 可由现有实体、immutable refs、manifest、SQLite relation 或版本化 JSON 实现，只要能稳定表达：

```text
Source
  ↓
Artifact
  ↓
Evidence
  ↓
Fact
  ↓
Derived Metric
  ↓
Claim
  ↓
Thesis
  ↓
Investment Expression / Decision
  ↓
Position
  ↓
Review
```

### 5.2 原则

- Provider Fact、Derived Signal、User Judgement、AI Draft 必须保持 actor / tier / provenance 区分；
- 重要 Claim 必须能引用 Evidence；
- Derived Metric 必须能回溯输入、公式版本与时间语义；
- Thesis revision 不静默覆盖旧 Evidence / Claim；
- Position 可以关联 Thesis，但资产事实账本继续由 Phase 1B Local Core 负责；
- Evidence Graph 不得成为第二套 Account / Transaction / Position Ledger；
- 缺证据、冲突、stale、not_admitted 必须可传播到上层 Claim / Thesis，而不是被 AI 文本隐藏。

## 6. Cross-cutting Foundation F3 — Investment Research Eval Suite V1

Eval Suite 在 Research Agent 上线之前就开始建设，优先测试系统真正重要的金融语义，而不是比较模型文案。

首批 Golden Cases 至少覆盖：

1. **PIT**：在指定历史时点，只能使用当时已经可得的数据；
2. **Temporal Semantics**：observation / publication / releaseAvailableAt / effective 不混用；
3. **Earnings Verification**：缺少合格事前证据时不得生成正式“超预期 / 不及预期”；
4. **Structured Retrieval**：单位、币种、报告期、实体、口径正确；
5. **Derived Metric**：公式版本、输入与缺失传播正确；
6. **Evidence Retrieval**：结论能定位到正确 Artifact / Evidence，而不是只给泛化 URL；
7. **Research Claim**：事实、派生结果、用户判断、AI 草稿不混层；
8. **Portfolio Exposure**（进入 Stage 4.4 后）：直接与间接暴露口径稳定、可复算。

未来模型、Prompt、Tool 或 Agent Runtime 升级均应通过相应 Eval 门槛后再进入 production path。

## 7. 前端方向：不是仿金融版界面，而是把可信链产品化

已冻结 UI V1.0 的共享骨架和三主题不推翻。后续在现有页面上增加横向能力。

### 7.1 Research Inbox 作为默认工作入口

Research Inbox 优先回答“今天什么变了、什么需要研究”，而不是罗列全部指标。输入只来自已准入或明确标注状态的 Market Regime、Industry Event、ResearchEvent、ReviewTask、Portfolio Event 等。

### 7.2 Evidence Drawer

建立统一 Evidence Drawer / Detail Surface。任何支持该能力的数字、图表点位、比较结论、Claim 或 Thesis 可以展开：

- Source / Provider / Artifact；
- observation / publication / releaseAvailableAt / effective；
- PIT / freshness / revision / admission / conflict；
- raw value / normalized value / formula；
- related Evidence / Claim / Thesis / Position。

完整技术 provenance 可以二级展开，不要求首屏堆满元数据。

### 7.3 Auditable Chart

正式量化图表必须能回答：

- 图上这个值是什么；
- 数据截至何时；
- 当时是否可得；
- 如何计算；
- 输入是否完整；
- 当前是否 stale / conflicted / not_admitted。

例如 Market Regime / 牛熊温度在 formula admission 之前不得仅为界面完整显示伪分数。

### 7.4 Company / Industry / Portfolio

- Company：逐步从“信息聚合”升级为 Evidence → Claim → Thesis → Verification；
- Industry：所有景气判断必须连接正式 metric / evidence / delta，而不是用公司涨跌代理行业基本面；
- Portfolio：展示 Thesis ↔ Position、Macro / Industry Exposure 与 Review，不重新建立资产事实账本。

## 8. 后端与算法方向

### 8.1 Structured Fact Store 与 Document Evidence Store 分工

- 行情、财务、宏观、估值、组合、Market Regime 等结构化事实：deterministic query；
- 公告、财报文本、政策、研报、新闻、研究全文：document retrieval；
- 两条路径统一输出 Evidence Ref，再由上层 workflow / Agent 消费。

### 8.2 Orchestrator first，Multi-Agent later

默认采用一个 Research Orchestrator + 少量清晰 Domain Tools：

- macro tools；
- industry tools；
- company tools；
- evidence tools；
- valuation tools；
- portfolio tools。

只有明确可以并行、且结果可独立验证的大规模任务才临时拆 subagent。禁止为了“智能感”建立长期互相对话的 Agent 集群。

### 8.3 Validation loop

未来 Research Agent 每次取数后至少校验：

- entity / universe；
- coverage；
- period；
- currency / unit；
- reporting basis；
- release time / PIT；
- provider / admission；
- revision / staleness / conflict。

异常时优先返回 `partial / stale / conflicted / not_admitted`，必要时重查；不得把 0 rows、Provider 失败或权限不足直接解释成“没有事实”。

## 9. Research Memory、Artifact 与 Entitlement

### 9.1 External Knowledge / Research Decision

Stage 4.3-R0 冻结两条独立 authority 路线：

- External Knowledge Lane：Google Drive L0 durable archive → ChatGPT analysis/extraction（AI draft）→ Notion L2 Wiki；保留原件 identity/digest/path、知识来源/版本/变化原因/审核状态。
- Research Decision Lane：Provider / official Evidence / Creator structured owner → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression → 后续 Portfolio。

Notion/券商研报/AI Draft/Creator Commentary 只作为 context，不能单独验证 Claim。OS 不复制 Notion 正文；公共 Source/Extraction、Creator adapters、原 Evidence/F2、PIT/admission/revision/review 继续复用。Legacy Local Wiki/Bridge、原件/解析、JSON backup、Obsidian projection 保留兼容，不继续扩建。细则见 [R0](stage-4-3-r0-external-knowledge-rebaseline.md)。

### 9.2 Research Artifact Center

进入 Research Agent / workflow 成熟阶段后支持从已验证研究对象生成：

- 个股深度报告；
- 行业深度报告；
- 宏观 / 周末复盘；
- 业绩跟踪；
- Portfolio Review；
- Excel / Word / PPT 等模板化 Artifact。

Artifact 是研究输出，不反向成为事实源；如需回写 Research Entity，仍走 prepare-plan-confirm-commit。

### 9.3 Entitlement / License 预留

未来接入商业数据源时，Provider metadata 应预留：

- license / usageScope；
- redistributionAllowed；
- storageAllowed；
- cacheTTL；
- userEntitlementRequired；
- citationRequired。

当前个人项目不因此建设企业 RBAC / SSO，也不假设已经拥有任何商业数据授权。

## 10. 重构后的开发顺序

### Stage 4.1 — Market Regime Foundation（继续当前路线）

目标不变：完成剩余历史 PIT 数据闭环、normalization、backtest、formula admission 与正式 Market Regime Engine。任何新路线都不能绕过现有数据准入门槛。

**新增约束**：Stage 4.1 的 Metric Registry 作为 F1 的首个正式领域实现；Market Regime 派生结果必须能输出可复算 lineage / evidence refs，为后续 Evidence Drawer 与 Eval 奠定基础。

### Stage 4.1B — Product Shell / Research Inbox / Evidence Surface

交付：

- V2 Product Shell / 导航；
- What Changed / Research Inbox；
- Evidence Drawer V1；
- Auditable Chart 基础交互；
- App Shell 渐进拆分；
- Eval Suite V1 基础 harness 与首批 Market Regime / PIT golden cases。

不得为了 Inbox 完整度引入未准入指标或旧伪评分。

### Stage 4.2 — Industry Data Platform

交付：

- Industry Metric Registry / Provider；
- historical series / delta；
- Industry Prosperity；
- industry event；
- F1 语义字段扩到 Industry；
- F2 连接 raw metric → derived signal → industry claim；
- 对应 Eval cases。

### Stage 4.2.5 — Creator Viewpoint Tracker V1（CLOSED）

2026-09-20 收口事实：独立审计最终 HEAD `025352f5bb7879ce6e1e2130fb9cd43788409928`；PR #67 CI `35489459196` success；merge/main `2cea477105d3e63242e65b7f3eec0b658a87ce17`；main CI `35489619887` success；Vercel Production READY。Creator Tracker 继续作为 External Commentary / Research Memory 输入域，不产生正式 Claim/Thesis 或数据准入。

### Stage 4.3-R0 External Knowledge Rebaseline

默认 External Knowledge Lane：Google Drive L0 → ChatGPT AI draft → Notion L2 Wiki。
OS Research Decision Lane：Provider / official Evidence / Creator structured owner → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression → Stage 4.4。

| 顺序 | 交付与状态 |
| --- | --- |
| 历史 Slice 1 | CLOSED；公共 Source/Extraction、Creator adapter 继续 KEEP |
| 历史 Slice 2 / 2.5 | 代码 MERGED / MAIN CI PASS；Local Wiki / backup / Obsidian / BrowserSource / parser / read-only Bridge / Wiki UI 转 FREEZE / LEGACY COMPATIBILITY；真人验收缺口保留 |
| R0（CLOSED） | 双通道 authority；PR #74 merged、main CI PASS |
| R1（CLOSED） | Verified Claim V1；PR #75 merged、PR/main CI PASS、Production READY；真实 5/0/0，admission 不变 |
| R2（CLOSED） | Thesis V1 + Macro → Industry；PR #76 / main CI / Production 已实时核验；exact Claim revision、append-only、Local-first |
| R3（CURRENT） | Investment Expression V1 + Closeout；IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT；只普通 push 后独立审计 |

旧 Slice 3“Creator → Wiki + 三位真实博主”不再独立实施；Creator 保留 OS owner，长期 Wiki 交外部 Notion。旧 Slice 4–6 未实现范围由 R1–R3 承接，历史编号不改。R0 不接 Notion/Drive API、不存外部正文、不开发 Claim/Thesis/Expression、不修改 4.4；Stage 4.5 改为 OS Domain MCP，原 Bridge 仅 transitional/fallback，真实替代迁移通过前不退役。

**CURRENT STOP：R2 普通 commit/push 后等待 ChatGPT 独立审计；不创建 PR、merge、修改 main 或部署 Production，不开始 R3。** [R0 正式决定与 Git/CI 证据](stage-4-3-r0-external-knowledge-rebaseline.md)。

### Stage 4.4 — Portfolio Exposure MVP

继续复用 Phase 1B Local Core，不建立第二套账本。交付：

- Portfolio aggregate / read model；
- thesis ↔ position；
- macro / industry exposure；
- target allocation；
- rebalance task；
- exposure / attribution methodology 的独立 admission；
- Portfolio UI 与 Evidence / Thesis drill-down。

### Stage 4.5 — OS Domain MCP / Controlled Tool Layer

Local-first 继续是正式边界。交付：

- Local Domain Service 的受控 Research Bridge；
- Auth / scope / confirmation / Audit；
- Creator context / Evidence / Verified Claim / Thesis / Investment Expression，以及已完成的 structured / portfolio Domain Tools；
- prepare / preview / confirm / commit；
- 不默认代理 Notion Wiki 或 Drive 原件；既有 read-only Bridge 为 transitional/fallback，替代完成且真实迁移通过前不退役；
- MCP 或其他 Adapter；
- 不暴露 raw DB / raw SQL；
- Agent tool-use Eval。

Agent Runtime 可评估 OpenAI Agents API、Codex harness 或其他实现，但 Adapter / runtime 不能反向决定 Domain Model。

### Stage 4.6+ — Research Agent / Artifact / Global Coverage

依赖 F1/F2/F3 与 Stage 4.5 工具层稳定后再进入：

- Research Agent V1；
- Research Artifact Center；
- Notification；
- Full HK / global research chain；
- Advanced Valuation；
- 商业数据 entitlement adapter；
- 必要时的跨设备 / 多用户能力。

Research Agent 进入 production 前必须通过计划、tool use、PIT、hallucination / unsupported claim、evidence citation 等 Eval 门槛。

## 11. 明确不做的“过早复杂化”

当前不因为本次重基线而启动：

- cloud business database 全迁移；
- multi-agent 常驻集群；
- 图数据库强制迁移；
- 所有数据 Vector 化；
- 企业 SSO / RBAC；
- 自动交易；
- 未授权商业数据抓取；
- 以 AI 生成内容补齐 Provider 缺失事实。

## 12. 每一步完成后的项目同步规则

从本重基线开始，每个正式开发切片都必须把“代码/数据交付”和“项目状态同步”视为同一项交付的一部分。

### 12.1 同分支必须同步

完成实现与必要验证、准备普通 push 前，按实际影响更新：

1. `docs/feature-registry.md`：能力状态、覆盖、准入、主要缺口；
2. `docs/development-execution-plan-2026-09-07.md`：当前步骤、验证、停止点与下一步；
3. 本文：只有当开发顺序、战略架构、跨阶段依赖或 scope 发生变化时更新；普通实现完成不机械改写战略正文；
4. `docs/architecture.md`：只有真实实现边界 / 数据流 / runtime 发生变化时更新；
5. 专项 contract / validation / delivery 文档：按对应任务要求更新。

### 12.2 状态真实性

- 在功能分支上可以写 `IMPLEMENTED / VERIFIED / PENDING REVIEW` 等真实状态，但不得预写 `MERGED` 或 `MAIN CI PASS`；
- PR、merge SHA、main CI 只能在事实发生并核验后登记；
- `implemented`、`verified`、`merged`、`production admitted` 始终分开；
- 固定 SHA 是记录时点证据，不是永久 CURRENT main；
- 历史审计文档不为了当前一致性而回写。

### 12.3 独立审查与合入后的同步

独立审查以远端真实 diff 为准。审查通过后才按既有流程创建 PR / CI / merge。合入后若 merge / CI 事实会改变 CURRENT 状态，必须立即在下一次项目同步中补齐对应事实源；不得长期让 `feature-registry` / execution plan 停留在已知过期状态。

## 13. 下一规划停止点

本次只完成战略路线重基线与进展同步规则，不启动业务代码、合同 schema、数据库 migration、Provider、Agent 或 UI 实现。

后续工程任务仍先服从当前 Stage 4.1 的真实 admission / blocker 状态。进入第一个新增跨域实现前，应单独冻结：

**F1 Financial Semantic Registry V2 + F2 Evidence Graph V1 的最小合同边界，以及 F3 Eval Suite V1 的 Golden Case 格式。**

该冻结任务应优先复用现有 Metric Registry、Evidence、ResearchEvent、Expectation、Audit 与 Local Core 语义，禁止复制出第二套同义模型。
