# Investment Research Dashboard V2 · Financial Research OS Rebaseline

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

### 9.1 Research Memory V1

进入 Stage 4.3 后建设显式、版本化、可审计的 Research Memory，而不是隐藏模型记忆。可以记录：

- entity / industry metric mapping；
- research convention；
- caveat；
- historical correction；
- thesis / invalidation history；
- evidence-backed user judgement。

Memory 必须有来源、版本、修订与删除/归档语义，不能覆盖正式 Provider Fact。

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

### Stage 4.3 — Top-down Research Workflow

交付：

- Macro → Industry mapping；
- Industry Thesis / revision；
- Claim ↔ Evidence；
- Instrument / expression mapping；
- Research Workflow 合并；
- Research Memory V1。

此阶段开始形成完整：

`Evidence → Claim → Thesis → Investment Expression`

### Stage 4.4 — Portfolio Exposure MVP

继续复用 Phase 1B Local Core，不建立第二套账本。交付：

- Portfolio aggregate / read model；
- thesis ↔ position；
- macro / industry exposure；
- target allocation；
- rebalance task；
- exposure / attribution methodology 的独立 admission；
- Portfolio UI 与 Evidence / Thesis drill-down。

### Stage 4.5 — Research Bridge / Controlled Tool Layer

Local-first 继续是正式边界。交付：

- Local Domain Service 的受控 Research Bridge；
- Auth / scope / confirmation / Audit；
- structured / evidence / portfolio Domain Tools；
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