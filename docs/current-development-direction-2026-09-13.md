# Investment Research Dashboard V2 · CURRENT Development Direction

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 1 Source + Extraction 正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 / Slice 2 — LLM Wiki V1 + Markdown/Obsidian Projection 进入 CURRENT PLAN / NOT_IMPLEMENTED。** Slice 1 初审 HEAD `b5b548a2e6308a2603d6603fbd0afca315cb1727` 为 P0=0/P1=1；第三方作者归因修复 HEAD `a716b2205d3056e99198852224bf56ad71026a36` 最终复审 PASS（P0=0/P1=0）；PR [#69](https://github.com/lwd619783-byte/-/pull/69) exact-head CI [35512099983](https://github.com/lwd619783-byte/-/actions/runs/35512099983) completed/success；merge/main `f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`，main push CI [35512366207](https://github.com/lwd619783-byte/-/actions/runs/35512366207) completed/success；Vercel Production `dpl_CmeXXfaEqc2BwXBBnuByMcZb7DNE` READY。Production 只表示应用部署成功，不提升 Provider/Data admission 或 strict PIT。Slice 2 冻结为“结构化 Wiki Domain 真源 → deterministic Markdown projection → Obsidian-compatible read-only Vault”；Obsidian 不成为数据库，生成 Markdown 不形成第二真源。详见 [Slice 2 冻结方案](stage-4-3-slice-2-llm-wiki.md)。

> 2026-09-20 CURRENT — **Stage 4.2.5 Creator Viewpoint Tracker V1 已正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 — Research Memory & Thesis Compiler V1 进入 CURRENT PLANNING / NOT_IMPLEMENTED。** 独立审计最终 HEAD `025352f5bb7879ce6e1e2130fb9cd43788409928`（P0=0 / P1=0）；PR [#67](https://github.com/lwd619783-byte/-/pull/67) exact-head CI [35489459196](https://github.com/lwd619783-byte/-/actions/runs/35489459196) completed/success；merge/main `2cea477105d3e63242e65b7f3eec0b658a87ce17`，main push CI [35489619887](https://github.com/lwd619783-byte/-/actions/runs/35489619887) completed/success；Vercel Production `dpl_ExmoiCEYa2EXRfmuqnRxEAE5AfrE` READY。Production deployment 不提升 Provider/Data admission。Stage 4.3 最新冻结路线为 `L0 Raw Source/Evidence → L1 Structured Extraction → L2 Reviewed Research Memory/LLM Wiki → L3 Verified Claim → L4 Thesis → L5 Investment Expression`，Schema / Entity Identity / Provenance / PIT-asOf / Revision / Verification / Audit 贯穿全链；详见 [Stage 4.3 冻结方案](stage-4-3-research-memory-wiki-thesis-plan.md)。

> 下方 Stage 4.2.5 功能分支及更早 CURRENT 记录保留其时点状态；本轮 CURRENT 以上述 2026-09-20 收口与 Stage 4.3 重基线为准。

> 2026-09-19 CURRENT — **Stage 4.2 CLOSED → Stage 4.2.5 Creator Viewpoint Tracker V1 CURRENT → Stage 4.3 NEXT**。本专项新增外部观点记录、独立 Topic 状态历史、人工审核/复盘、四视图 Workspace、JSON 完整恢复和 Excel 分析副本；Current View/Transition/到期项均为已审核历史投影。复用 ResearchEvent 公共 owner、Evidence Drawer、Workspace 导航和 PersistedBaseGuard；不接 SQLite/云，不提前实现 Claim/Thesis。精确开发基线 `8860c943919f90daa125934fde0f385707ea7028`。本地 959 tests / build / 287 browser checks / JSON round-trip / Excel 独立读取 PASS；IMPLEMENTED / VERIFIED LOCALLY。真实样本旧状态与明确失效条件仍未证明，未伪造转换。完整交付与限制见 [Stage 4.2.5 当前方案与交付](stage-4-2-5-creator-viewpoint-tracker.md)。独立审计 PENDING，Hosted CI NOT_RUN；仅功能分支普通 commit/push，不创建 PR/merge/部署。

> 以下 Stage 4.2 closeout 及更早 CURRENT 条目保留其记录时点；本轮顺序以上述 Stage 4.2.5 增量为准。

> 2026-09-19 CURRENT — **Stage 4.2 已正式 CLOSED / MERGED / MAIN CI PASS，主开发线进入 Stage 4.3**。Slice 6 独立审计通过；最终 PR head `8cc62168681719e1eedfe3b1974f5b35844df2cb`，PR [#64](https://github.com/lwd619783-byte/-/pull/64) CI [35447795829](https://github.com/lwd619783-byte/-/actions/runs/35447795829) completed/success；merge/main `05ffb33ce4edee81f174253ccbad4ee697ed974a`，main CI [35448015019](https://github.com/lwd619783-byte/-/actions/runs/35448015019) completed/success。Stage 4.2 最终交付包括 Industry Registry/Provider、跨来源 owners、Dimensions/Snapshot、描述型相邻期派生、固定模板事实性 Claim Candidate、F2 V1 引用链与 Prosperity Eligibility/ABSTAIN。正式景气 score/direction、Verified Claim、Thesis、Portfolio、Agent 以及 DATA/PRODUCTION admission、严格 PIT/release/revision closure 均未因此获得授权。详见 [Slice 6](stage-4-2-slice-6-plan.md)。

> 2026-09-18 CURRENT Slice 5 scope：Stage 4.1B 与 Stage 4.2 Slice 1–4 已合入；当前核验 main 为 `8497ac9199def1fbec420eecc6ad7b7305ce160d`（PR #62，PR/main CI success，Vercel Production READY）。本轮只完成 Metric → Industry Dimension → Multi-factor Snapshot，不进入 Prosperity/Regime/Claim/Thesis；具体冻结边界与验证见 [Slice 5 plan](stage-4-2-slice-5-plan.md)，较早阶段记录保留时点意义。

> 状态：CURRENT STRATEGIC DIRECTION ADDENDUM V1  
> 日期：2026-09-13  
> 记录基线：`origin/main @ ee7f2e35d967f58812706c2ee06255cc82ea4094`  
> 作用：固化 2026-09-13 对 Stage 4.1 收口、主线产品化、UI 演进、Research MCP Gateway、ChatGPT Web 与 LLM Wiki 的最新开发决策，保证后续更换对话、Agent 或执行窗口时能够从仓库恢复完整开发路径。

本文补充 `docs/investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md` 与 `docs/development-execution-plan-2026-09-07.md`。既有代码、合同、PR、CI、数据准入与历史审计事实不被本文改写。若本文与冻结合同、Local-first、PIT、Provider Admission、数据真实性 hard invariant 冲突，以后者为准。

## 1. 2026-09-13 核心战略决定

### 1.1 Stage 4.1 不再无限派生

Stage 4.1 已停留较久，后续不再以“把所有 23 个指标都做成 READY”作为进入产品主线的前置条件。

当前正在执行的 **Stage 4.1-G — Macro Entity Identity Bridge + PBC Evidence Graph Closure** 作为 Stage 4.1 的计划收口任务。其真实状态仍以最终远端交付、独立审计、PR/CI/merge 为准；本文不预写完成状态。

4.1-G 收口后，默认不再继续拆分 4.1-H / 4.1-I 等独立小任务。只有满足下列条件之一，才允许重新开 Stage 4.1 子任务：

1. 直接阻塞 Research Inbox、Evidence Surface、Industry、Thesis、Portfolio 或 MCP 主线；
2. 属于跨域共享的 P0 正确性 / 数据安全 / PIT / identity blocker；
3. 不修复会导致上层产品输出错误事实，而不是仅影响某个指标覆盖率。

单一 Provider、单一指标或某个历史覆盖率的边缘提升，默认降级为**数据支线**，不得继续阻塞主产品开发。

### 1.2 产品可用性优先级提升

新的主线原则：

> **数据不完整可以显式展示“不完整”，但产品不能因为部分数据未准入而长期不可用。**

上层产品必须正确传播 `missing / partial / stale / conflicted / not_admitted / unknown`，而不是等待所有底层数据完美后再开发。

Stage 4.1 形成的 F1 Semantic Runtime、PIT、Evidence、Admission、Readiness 与 Eval 能力，后续主要职责是保证上层产品“知道什么能用、什么不能用”，而不是无限延迟用户可见能力。

## 2. CURRENT 主开发路径

4.1-G 收口后的默认顺序：

```text
Stage 4.1-G  收口 Stage 4.1 基础设施
      ↓
Stage 4.1B   Product Shell / Research Inbox / Evidence Surface
      ↓
Stage 4.2    Industry Data Platform（CLOSED）
      ↓
Stage 4.2.5  Creator Viewpoint Tracker V1（CLOSED）
      ↓
Stage 4.3    Research Memory & Thesis Compiler V1（CURRENT）
      ↓
Stage 4.4    Portfolio Exposure MVP
      ↓
Stage 4.5    Research MCP Gateway / Controlled Tool Layer
      ↓
Stage 4.6    ChatGPT-connected Research Agent / Artifact / Global Coverage
```

Market Regime 数据完善、PBC / CSRC / all-A admission、Normalization、Backtest 等继续推进，但从 4.1-G 后原则上转为**与产品主线并行的数据支线**。当某个指标真实 READY 时接入产品；产品主线不等待所有指标 READY。

## 3. Stage 4.1B — 首个真正产品化阶段

目标：让看板从“页面集合 / Dashboard”开始变成每天可使用的研究工作台。

核心交付：

- **Research Inbox / What Changed**：默认回答“今天什么变了、哪些事项值得研究”；
- **Evidence Drawer V1**：数字、图表、Claim、Thesis 均可查看来源、时间、PIT、admission、revision、evidence；
- **Auditable Chart V1**：图表同时展示 as-of、PIT、完整性、freshness、计算与数据状态；
- **Product Shell / App Shell**：现有 UI V1.0 上逐步建立研究工作流入口；
- 复用已有 ResearchEvent、Watchlist、Expectation Evidence、Semantic Runtime、Provider data，不建立平行系统；
- 继续扩 F3 Eval，但不得为了 Inbox 完整度制造未准入数据或伪评分。

Stage 4.1B 完成后，用户应能完成：

`打开看板 → 看今天发生什么 → 查看证据 → 标记需要研究 / 复盘 → 进入相关行业或公司`

## 4. Stage 4.2 — Industry Data Platform

**状态（2026-09-19）：CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS。** 正式景气评分/方向没有作为 Stage 4.2 完成条件；本阶段以可审计的基础数据链、描述型派生、F2 Claim Candidate 与 fail-closed Eligibility/ABSTAIN 收口，未准入能力继续显式阻断。

目标：把行业研究从“股价和新闻展示”升级成正式的基本面景气研究。

交付方向：

- Industry Metric Registry / Provider；
- demand / supply / inventory / price / margin / capex / policy / valuation / trading-state 等正式指标；
- historical series / delta；
- Industry Prosperity / regime；
- industry event；
- F1 扩展到 Industry；
- F2 建立 `raw metric → derived signal → industry claim`；
- 全球细分行业横向比较逐步建立。

行业结论不得只用公司涨跌代理行业基本面。

## 5. Stage 4.3 — Research Memory & Thesis Compiler V1

**状态（2026-09-20）：CURRENT PLANNING / DESIGN FROZEN / NOT_IMPLEMENTED。** Stage 4.2.5 已 CLOSED，Creator Tracker 作为 Stage 4.3 的第一条真实 Research Memory 输入域继续复用，不复制第二套 Creator 原文或 Viewpoint 数据。

Stage 4.3 的正式研究编译链：

```text
L0 Raw Source / Evidence
        ↓
L1 Structured Extraction
        ↓
L2 Reviewed Research Memory / LLM Wiki
        ↓
L3 Verified Claim
        ↓
L4 Thesis
        ↓
L5 Investment Expression
```

横向治理平面贯穿所有层：Schema、Entity Identity、Provenance、PIT / asOf、Revision、Verification / Review、Audit，以及 missing / partial / stale / conflicted / unknown 传播。

关键边界：

- L0 保存或引用原始材料与 provenance；不被 AI 摘要覆盖。
- L1 是可持久化、可修订、可审核的结构化提取层；AI 输出默认 `AI_DRAFT`，不能自动晋升 Wiki / Claim / Thesis。
- L2 LLM Wiki 是显式、版本化、可检索的长期研究记忆；每个知识结论必须可反查 Extraction 与 Raw Source，Wiki 本身不是 Provider Fact。
- L3 Verified Claim 必须复用既有 Evidence / F2 Evidence Graph 语义，不建立平行 Claim Graph；Creator Commentary 单独不能把外部判断变成 Verified Claim。
- L4 Thesis 组合 Claims / Evidence，具备 bull/base/bear、drivers、catalysts、risks、invalidation、confidence、asOf 与 append-only revision。
- L5 Investment Expression 将 Thesis 映射到 ETF / Index / Fund / Equity 等表达，记录 directness / liquidity / valuation / thesis sensitivity / company-specific risk；不进入 Portfolio 或交易。

Stage 4.3 分六个 Slice：

1. **Source + Extraction Contract**：冻结统一 Research Source Reference / Adapter 与 ResearchExtraction，首个正式 adapter 复用 CreatorSource / ViewpointObservation。
2. **LLM Wiki V1**：版本化 Wiki Entry、引用链、搜索 / read model 与 Sources / Extractions / Wiki 工作区。
3. **Creator → Wiki + 三位真实博主**：用 4.2.5 的真实运行时数据形成第一批 Creator Framework Wiki；真实原文不提交公共仓库。
4. **Evidence → Verified Claim**：复用 F2 Evidence Graph，把 Research Memory 与正式可验证主张连接起来。
5. **Thesis + Macro → Industry**：建立 Macro Driver → Industry mapping、Thesis revision、catalyst / risk / invalidation。
6. **Investment Expression + Closeout**：Thesis → ETF / 指数 / 个股等表达，完成 L0→L5 可回溯闭环并收口 Stage 4.3。

前端最终形成 Research Memory Workspace，至少可在 Sources / Extractions / Wiki / Claim & Thesis 之间逐层下钻，并继续复用 Evidence Drawer。

Stage 4.3 不实施正式 MCP、Research Agent、Portfolio、自动交易、全量 Vector DB / Graph DB 迁移、cloud business DB 或自动网页爬虫。Slice 2 的 Obsidian 兼容仅是 Markdown 投影/导出契约，不引入 Obsidian 插件依赖、双向同步或第二写入口。Stage 4.5 负责把已稳定的 Wiki / Claim / Thesis Domain Tools 暴露给 MCP；Stage 4.6 的 Agent 消费这些能力并生成 / 修订 Research Artifact，而不是重新建设一套 Wiki。

完整字段边界、Slice 验收与非目标见 [Stage 4.3 冻结方案](stage-4-3-research-memory-wiki-thesis-plan.md)。

## 6. Stage 4.4 — Portfolio Exposure MVP

继续复用 Phase 1B Local Core，不建立第二套账户 / 交易 / 持仓账本。

交付：

- Portfolio aggregate / browser read model；
- thesis ↔ position；
- macro / industry exposure；
- target allocation；
- rebalance task；
- exposure / attribution methodology admission；
- Portfolio UI；
- Evidence / Thesis / Position drill-down。

目标是让系统能够回答：

> “我的仓位为什么存在、对应哪个 Thesis、暴露在哪些宏观和行业变量、哪些判断变化会影响仓位？”

## 7. 前端长期演进：Dashboard → Research Workspace

现有 UI V1.0 的视觉基因、组件、三主题体系暂不推翻。后续主要变化首先来自**信息架构和工作流**，不是先换颜色、圆角或重新做皮肤。

预期演进：

```text
UI V1.0 Dashboard
      ↓
4.1B  Research Inbox + Evidence Drawer
      ↓
4.2   Industry research workspace
      ↓
4.3   Evidence / Claim / Thesis workspace
      ↓
4.4   Portfolio workspace
      ↓
4.5/4.6 Evidence / Agent / Context integration
      ↓
UI V2.0 统一收口
```

目标 Workspace 布局倾向：

- 左侧：Navigation / Universe；
- 中间：Research Workspace；
- 右侧：Evidence / Context / Agent；
- 顶部：Global Search / as-of / Data Status。

**UI V2.0 的大规模视觉与信息架构收口默认放在 Stage 4.3～4.4 产品需求稳定后，而不是现在提前猜测 4.6 界面。**

## 8. Stage 4.5 — Research MCP Gateway

Stage 4.5 的正式方向从泛化的 Research Bridge 进一步收敛为：

> **Research MCP Gateway + Controlled Domain Tool Layer**

目标不是让模型直接访问数据库，而是把投研系统能力包装成稳定、可审计的 Domain Tools。

### 8.1 工具层原则

禁止向 LLM 暴露 raw DB / unrestricted SQL。

结构化事实使用 deterministic Domain API，例如：

- `search_entities()`；
- `get_metric(entity, metric, period, asOf)`；
- `get_macro_snapshot()`；
- `get_industry_snapshot()`；
- `get_company_snapshot()`；
- `get_portfolio_exposure()`；
- `get_evidence()`；
- `get_claim()`；
- `get_thesis()`；
- `search_wiki()`；
- `get_wiki_entry()`；
- `get_what_changed()`。

所有工具继续服从：

- F1 semantic validation；
- Entity / universe；
- unit / currency / period / basis；
- PIT / release；
- revision；
- provider / admission；
- stale / conflict / missing propagation；
- Audit。

### 8.2 写入工具

研究写回继续使用：

`prepare → preview → user confirm → commit`

例如：

- `prepare_wiki_entry()` / `commit_wiki_entry()`；
- `prepare_claim()` / `commit_claim()`；
- `prepare_thesis_revision()` / `commit_thesis_revision()`。

客户端或套餐暂不支持某类远程 write action 时，也不得破坏这一 Domain Contract；只需保持 write tools / confirmation seam 可用，在受支持客户端启用。

### 8.3 Local-first

Local-first 仍为正式边界。MCP 是受控适配层，不意味着迁移到 cloud business database。

本地 SQLite、Evidence Store、Wiki、Portfolio 等仍可作为事实与研究底座；对外只暴露经过认证、scope、confirmation、Audit 的 Research MCP Gateway。

## 9. Stage 4.6 — ChatGPT-connected Research Agent + Artifact Integration

Stage 4.6 不以“在投研看板里再造一个封闭聊天框”作为核心目标，也不重新建设 LLM Wiki Domain Model。LLM Wiki / Research Memory 已在 Stage 4.3 建立；本阶段只通过 Stage 4.5 的受控 MCP / Domain Tools 让 Research Agent 读取、研究、提出 revision，并生成 Research Artifact。

正式目标：

> **ChatGPT Web（以及未来兼容的高能力 LLM Client）作为主要推理 / Research Agent；投研看板作为可信事实、证据、研究记忆与组合底座；MCP 作为二者之间的受控能力接口。**

目标架构：

```text
                    ┌──────────────────────┐
                    │ ChatGPT Web / LLM    │
                    │ Research Agent       │
                    └──────────┬───────────┘
                               │
                    MCP Domain Tool Calls
                               │
              ┌────────────────▼────────────────┐
              │ Research MCP Gateway            │
              ├─────────────────────────────────┤
              │ Structured Facts                │
              │ Evidence                        │
              │ Claim / Thesis                  │
              │ Portfolio                       │
              │ LLM Wiki                        │
              └────────────────┬────────────────┘
                               │
       ┌───────────────────────▼────────────────────────┐
       │ Local-first Research OS                        │
       │ Registry / Providers / Evidence / SQLite /     │
       │ Research Memory / Portfolio / Audit / Evals    │
       └────────────────────────────────────────────────┘
```

### 9.1 MCP 与 Web Search 的职责分离

- **MCP**：读取用户私有投研上下文、历史研究、Portfolio、内部 Evidence、结构化事实；
- **Web Search**：获取看板之外的最新公开世界信息，例如新闻、公司最新公开信息、外部研究线索；
- **LLM**：融合两条信息链进行研究推理。

联网搜索不得替代 MCP 去猜用户私有数据，也不得自动成为内部事实源。外部信息进入正式研究对象时仍需 Evidence / provenance / time semantics。

### 9.2 Research Agent 典型闭环

用户在 ChatGPT 中提出：

> “为什么光模块最近下跌？结合我的历史研究和持仓，我是否应该调整？”

Agent 可以：

1. 通过 MCP 查询 Industry / Company / Valuation；
2. 查询 Portfolio Exposure；
3. 搜索 LLM Wiki 中历史 Thesis；
4. 拉取对应 Evidence；
5. 必要时使用 Web Search 查询最新外部事件；
6. 完成分析；
7. 用户确认后，把研究结果写入 LLM Wiki / Claim / Thesis revision。

形成：

`研究 → 沉淀 → 再检索 → 修订 → 再研究`

### 9.3 Wiki 写入语义

ChatGPT 生成的研究内容默认保存为 `AI_DRAFT`，并至少记录：

- original question / task；
- answer / research artifact；
- createdAt / asOf；
- related entity / industry；
- evidence refs；
- fact / derived / judgement 分层；
- claim refs；
- thesis refs；
- risk / invalidation；
- revision；
- verification status。

用户确认或后续验证后，才允许升级成 Verified Claim、User Judgment 或 Thesis revision。

## 10. Stage 4.6 完成后的目标产品能力

当 4.6 主线完成后，目标用户体验为：

```text
Research Inbox
今天发生了什么？
        ↓
Macro / Market Regime
全球宏观环境如何？
        ↓
Industry
哪些行业改善 / 恶化？
        ↓
Company
哪些全球龙头值得研究？
        ↓
Evidence / Claim / Thesis
为什么买？什么情况下判断失效？
        ↓
Portfolio
我的真实暴露在哪里？
        ↓
ChatGPT-connected Research Agent
自动查询、研究、验证、复盘、生成 Artifact
        ↓
LLM Wiki
沉淀为长期可检索、可修订的研究记忆
```

系统最终不是单纯股票 Dashboard，而是：

> **Personal Investment Research & Asset OS = 可信数据底座 + Research Workspace + Portfolio + Evidence/Thesis Memory + MCP + AI Research Agent。**

## 11. 4.6 之后仍可扩展但不阻塞当前主线

- Full HK / US / global research chain；
- Advanced Valuation；
- Commercial data entitlement adapter；
- Research Artifact Center 深化（Excel / Word / PPT / 周报 / 深度报告）；
- Notification / scheduled review；
- 更完整跨设备能力；
- 必要时的多用户能力。

这些能力可以按价值逐步增强，不重新阻塞 4.1B～4.6 的核心可用闭环。

## 12. 后续开发纪律

### 12.1 主线优先判断

以后准备新任务前优先问：

> “这个任务是否被至少三个后续核心模块共同依赖，或者直接阻塞用户可用主线？”

如果是，按主线处理；如果只是单一 Provider / 单一历史口径 / 覆盖率的局部完善，默认进入数据支线。

### 12.2 用户可见价值

从 4.1B 起，应明显提高每轮交付的用户可见能力比例。长期连续只交付 schema / validator / admission report 而没有 Research Workflow 能力，视为路线偏离信号。

### 12.3 真实性边界保持不变

产品化不意味着降低数据标准：

- 不因 UI 需要伪造 Market Regime 分数；
- 不把 missing 当 0；
- 不把 fetchedAt 当 releaseAvailableAt；
- 不把 AI Draft 当 Fact；
- 不用当前 revision 泄漏到历史 PIT；
- 不因 Agent 能调用工具就跳过 admission / Evidence / Eval。

## 13. 当前停止点与下一步

记录时点：`origin/main @ ee7f2e35d967f58812706c2ee06255cc82ea4094`。

已知正式事实：Stage 4.1-F 已 `IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS`，但 production/data 仍 NOT_ADMITTED；既有 source blocker 按当前 readiness 与专项 evidence 继续存在。

当前外部执行任务：Stage 4.1-G 已由用户交给 Codex 执行，本文只把它登记为**计划中的 Stage 4.1 收口任务**，不声明已实现、已验证或已合并。

4.1-G 最终交付后按既有流程：

`Codex push → ChatGPT 独立终局审计 → 用户授权 → PR / exact-head CI → merge → main CI → CURRENT sync`

若无新的 P0 主线阻断，**下一业务阶段固定进入 Stage 4.1B — Research Inbox + Evidence Surface MVP。**
