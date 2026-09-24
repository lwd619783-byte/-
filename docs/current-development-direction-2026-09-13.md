# Investment Research Dashboard V2 · CURRENT Development Direction

> 2026-09-24 CURRENT · **Research Memory / Decision System 边界重基线；Stage 4.4 CLOSED → Stage 4.5 CURRENT**。PR #80 已 squash merge，PR head `056cca6bc4e83af5014dfb482b98e86e248d591e`，merge/main `68698ae7548aeb46fe9dd95fd0fdfcb4f13d1e4e`；PR CI `35985508556` success，main CI `35986495424` success，Production deployment `dpl_G8cjdpD9oT3E5sN9dCckptzkc77J` READY 且绑定同一 main SHA。长期边界正式冻结为：Google Drive=L0 原件；Notion=Research Memory / 长期 Wiki；OS=Formal Decision System（Structured Fact/Evidence/Verified Claim/Thesis/Investment Expression/Portfolio/Target/Review + PIT/admission/revision/Audit/calculation）；ChatGPT=Research Orchestrator。普通研究发现默认停在 Notion，仅满足正式证据/计算/决策/组合条件时晋升 OS。Stage 4.5 只建设 OS Domain MCP，不代理 Drive/Notion；旧 Local Wiki/Obsidian/Research Bridge 仅 Legacy compatibility / fallback。详见 [投研知识与决策工作流 V1](research-knowledge-decision-workflow-v1.md)。


> 2026-09-23 CURRENT · **Stage 4.4 Portfolio Exposure Integrated MVP — IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。以最新 `origin/main @ 9e363474abc22ebb6da391dbb2c45c9e8c9358e8` 开工，A/B/C 连续完成：原 AssetReads/Audit → 本机只读 projection → exact Position Research Link → 结构/定性研究暴露 → 本人确认 Target/Rebalance review → 组合 Workspace/F3。没有新账本、原研究 owner 替代、FX 猜算或交易/绩效能力；线上静态页面保持未连接私人账本。验证、真实数量和限制见 [Stage 4.4 交付](stage-4-4-portfolio-exposure.md)。本条 supersede 旧 Stage 4.4 NEXT/NOT_IMPLEMENTED；当前停止点为普通 push 后待独立审计，未进入后续阶段，不预写 PR/合入/Production。

> 2026-09-23 Final Closeout / CURRENT — **Stage 4.3 CLOSED / IMPLEMENTED / INDEPENDENT AUDIT PASS / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。#77 与 #78 已核验，当前 main/Production 绑定 `925b496e92ef7c338a248b1fb2eef5e9dabb0ee0`；主开发线转 **Stage 4.4 — Portfolio Exposure MVP：NEXT / PLANNED / NOT_IMPLEMENTED**。证据、双通道 authority、Phase 1B 复用与继承限制见 [Final Closeout 与 Stage 4.4 handoff](stage-4-3-r3-investment-expression-closeout.md#final-closeout--2026-09-23-current)。本条 supersede 下方旧 CURRENT/停止点，历史审计记录不回写；本 docs-only 分支仍待独立审计。

> 2026-09-23 CURRENT — R2 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。PR #76，merge/main `17a2e1929c1d7570e477a5e19aadbeee29aa04f5`；PR CI `35746157236`、main CI `35746962990`、同 SHA Production deployment `6594270082` 已实时核验 success。主线切换 **Stage 4.3-R3 Investment Expression V1 + Closeout：IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT**。真实 5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression；Stage 4.4–4.6 PLANNED / NOT_IMPLEMENTED。本条 supersede 下方较早 CURRENT，不回写历史审计。[R3 D0 与交付](stage-4-3-r3-investment-expression-closeout.md)。



> 2026-09-22 CURRENT — **Stage 4.3-R2 Thesis V1 + Macro → Industry：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT RE-REVIEW**。本轮在 `codex/stage-4-3-r2-thesis-v1` 基于已审计 `8505b607be998dc8313bfc2feeea3c004669ed57` 定向修复 Claim superseded-asOf 门禁与 UI 选项/复核提示；历史 exact pins、正式 revisions/confirmations 不回写。R1 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**：PR [#75](https://github.com/lwd619783-byte/-/pull/75)，merge/main `1651aa7bbf3fcdf4a59d17e7ae6e6edaf057ef7d`，PR CI [35733395999](https://github.com/lwd619783-byte/-/actions/runs/35733395999)、main CI [35734221779](https://github.com/lwd619783-byte/-/actions/runs/35734221779) success，绑定该 SHA 的 Production deployment `6591911800` success。真实仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis**，data admission / PIT / release blockers 不变；R3 **PLANNED / NOT_IMPLEMENTED**。本条覆盖下方旧 CURRENT，历史记录保持原时点；修复验证见 [R2 定向修复](stage-4-3-r2-thesis-v1.md#p1--p2-定向修复)。普通 commit/push 后停止等待 ChatGPT 复审，无 PR/merge/main 修改或 R3。

> 2026-09-22 CURRENT — **Stage 4.3-R1 Verified Claim V1：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。基于本轮 fetch 的 `origin/main @ de2107571ae5ee2189b82f7ab05b6521a4457b75`。复用原 Industry candidate / F2 Graph / Evidence Drawer；新增 exact revision 用户确认、append-only Claim/history、非权威 Research Context 与 Local-first JSON backup/recovery。真实留存 5 candidates / 0 verifiable / 0 verified；admission、PIT、release 与原始数据不变。普通 commit/push 后等待 ChatGPT 独立审计，无 PR/merge/Production；R2/R3仍未实现。[R1 D0、实现与验证](stage-4-3-r1-verified-claim-v1.md)。

> R0 已实时核验：PR [#74](https://github.com/lwd619783-byte/-/pull/74)，head `44ccdd01a6d65914f2a2a8f26384fd468a71ad3b`，2026-09-22T11:50:16Z 合入 `de2107571ae5ee2189b82f7ab05b6521a4457b75`；main CI [35723692280](https://github.com/lwd619783-byte/-/actions/runs/35723692280) completed/success。登记 R0 **IMPLEMENTED / MERGED / MAIN CI PASS**；不推导 Production、data admission 或旧私人验收状态。下方较早 CURRENT 记录仅代表原时点。


> 2026-09-22 CURRENT — **Stage 4.3-R0 External Knowledge Rebaseline**；默认 External Knowledge Lane（Drive → ChatGPT → Notion），OS 聚焦 Research Decision Lane；Local Wiki / Bridge 为冻结功能范围的兼容能力。下一任务 **Stage 4.3-R1 Verified Claim V1**。本轮功能分支待独立审计；普通 commit/push 后停止，无 PR/merge/Production。[Stage 4.3-R0 正式决定](stage-4-3-r0-external-knowledge-rebaseline.md) supersede 下方旧路线与 CURRENT 停止点，历史审计/验证数字仍仅代表原时点。

> 合入事实已于 2026-09-22 重新核验：Slice 2/2.5 经 PR [#72](https://github.com/lwd619783-byte/-/pull/72) 合入 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，main CI [35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441) success；UI V2.1 经 PR [#73](https://github.com/lwd619783-byte/-/pull/73) 合入开工基线 `9769c46789a6efc98999fe7fabeda750710cbbb5`，main CI [35690271399](https://github.com/lwd619783-byte/-/actions/runs/35690271399) success。代码已 MERGED / MAIN CI PASS；旧真人审核、UPDATE/history/revoke 验收仍 PENDING / NOT_VERIFIED，本轮私人数据 NOT_REVERIFIED，不能据此宣称 Slice 2.5 完整验收 CLOSED。

> 2026-09-21 CURRENT：**Slice 2 — Wiki Infrastructure V1 — independent review PASS；Slice 2.5 — AI Knowledge Ingestion Foundation V1 + authenticated Read-only Research Bridge，IMPLEMENTED / LOCAL VERIFIED / PENDING INDEPENDENT REVIEW**。沿用基线 `812e7551e67b0b8af4f673524e2578ecf2e19335` 的 Source/Extraction/Wiki/Revision/Review。中文首次使用、原件 IndexedDB、完整文章候选审核、用户选择后 private staging 与 OAuth 只读 MCP；贡献包仍人工回传。远程与 ChatGPT 账号连接按实际验收单列。[Slice 2.5 CURRENT](stage-4-3-slice-2-5-knowledge-ingestion.md)。后续旧条目只保留其时点；本次仅功能分支 commit/push 与 Preview，停止等待独立审计，不创建 PR/merge/Production。

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
Stage 4.3    R0 → R1 Verified Claim → R2 Thesis → R3 Expression（CLOSED）
      ↓
Stage 4.4    Portfolio Exposure MVP（CLOSED）
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

## 5. Stage 4.3 — External Knowledge + Research Decision

2026-09-22 冻结双通道：

- **External Knowledge Lane（默认）**：Google Drive L0 durable archive → ChatGPT analysis/extraction（AI draft）→ Notion L2 Wiki。原件 identity/URL/文件名/大小/SHA-256/归档路径和不可改写版本必须保留；Notion 保留来源、版本、变化原因、AI草稿/待审核/已审核状态。
- **Research Decision Lane**：Provider / official Evidence / Creator structured owner → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression → Stage 4.4 Portfolio。Creator Commentary、Wiki、券商研报与 AI Draft 仅为 context，不能单独产生 Verified Claim。

OS 不再扩建完整自研 Wiki，也不保存 Notion Wiki 正文副本。已有 Slice 1 公共 Source/Extraction 与 Creator adapters 保留；Slice 2/2.5 代码已合入并通过 main CI，其 Local Wiki/backup/Obsidian/parser/Bridge/UI 冻结为 Legacy compatibility，历史真人验收缺口继续如实保留。

执行顺序：**R0 External Knowledge Rebaseline → R1 Verified Claim V1 → R2 Thesis V1 + Macro → Industry → R3 Investment Expression + Closeout**。R1 复用 F2、revision/reject/supersede、unsupported fail closed；R2 保留 bull/base/bear、drivers/catalysts/risks/invalidation/confidence/asOf/revision/用户确认；R3 支持 ETF/Index/Fund/Equity 及 directness/liquidity/valuation context/thesis sensitivity/idiosyncratic risk，不进入 Portfolio/Position/Transaction。

旧 Slice 3 不再独立扩建 Creator Wiki；Creator Tracker 仍为 OS structured owner，长期 Wiki 在外部 Notion，未来 Stage 4.5 暴露 Creator context。Slice 1/2/2.5 历史编号不重写。R0–R3 已关闭，Stage 4.3 CLOSED；双通道决定见 [R0 正式决定](stage-4-3-r0-external-knowledge-rebaseline.md)，最终事实与未解决限制见 [Final Closeout](stage-4-3-r3-investment-expression-closeout.md#final-closeout--2026-09-23-current)。

## 6. Stage 4.4 — Portfolio Exposure MVP

状态：**NEXT / PLANNED / NOT_IMPLEMENTED**。复用 Phase 1B Account / Asset / Transaction / CashFlow / PositionSnapshot 及其正式 owner / repository / persistence / permissions，不建立第二套账户 / 交易 / 持仓账本。Expression 不等于 Position / Target Allocation / Transaction / Rebalance / Trade Instruction 或实际账户持仓；研究表达 → Portfolio Exposure 的受控连接尚待实现。关键 identity/账户 owner/价格/估值/交易单位不完整时 unknown / unresolved / blocked，不猜值或补 0。

计划交付（本轮不实现）：

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

## 8. Stage 4.5 — OS Domain MCP / Controlled Tool Layer

> 2026-09-24 scope clarification：Stage 4.5 只暴露 Formal Decision System 的受控 Domain Tools。Notion/Drive 继续由外部连接器负责；不新增 Wiki proxy / mirror。Slice 1 默认 READ-ONLY，优先 Evidence → Verified Claim → Thesis → Investment Expression → Portfolio/Exposure；未来任何写入必须另行经过 prepare → preview → explicit user confirm → commit。完整边界见 [投研知识与决策工作流 V1](research-knowledge-decision-workflow-v1.md)。

未来主要 tools 面向 OS 独有的 Creator context、Evidence、Verified Claim、Thesis、Investment Expression，并保留既有结构化事实与完成后的 Portfolio 领域入口。Notion Wiki、Google Drive 原件由其外部工具读取，OS 不默认代理 `search_wiki / get_wiki_entry`。

正式写入遵守 `prepare → preview → user confirm → commit`；F1/F2、Entity、unit/currency/period/basis、PIT/release/revision、Provider/admission、missing/stale/conflict、Auth/scope/Audit 一并保留，禁止 raw SQL / 任意写入 / 真实交易。

OS Local-first 边界不变。现有 authenticated read-only Research Bridge 为 transitional / fallback compatibility；只有 Domain MCP 替代完成且真实迁移通过，才另行讨论退役。本轮不移除、不新增 write tool。

## 9. Stage 4.6 — ChatGPT-connected Research Agent + Artifact Integration

Stage 4.6 通过 Stage 4.5 OS Domain Tools 消费结构化状态、Evidence、Claim/Thesis/Expression/Portfolio；通过外部知识工具使用 Drive 原件与 Notion Wiki。AI 研究和 Wiki revision 保留 draft/review 状态，不绕过 OS Evidence Gate 或正式用户确认。

正式目标：

> **ChatGPT Web（以及未来兼容的高能力 LLM Client）作为主要推理 / Research Agent；投研看板作为可信事实、证据、决策状态与组合底座；MCP 作为二者之间的受控能力接口。**

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
              │ Investment Expression           │
              └────────────────┬────────────────┘
                               │
       ┌───────────────────────▼────────────────────────┐
       │ Local-first Research OS                        │
       │ Registry / Providers / Evidence / SQLite /     │
       │ Decision State / Portfolio / Audit / Evals     │
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
3. 通过外部工具读取 Notion Wiki context，并通过 OS Domain Tools 查询正式 Thesis；
4. 拉取对应 Evidence；
5. 必要时使用 Web Search 查询最新外部事件；
6. 完成分析；
7. Wiki 建议经外部知识流程写入 Notion；正式 Claim/Thesis revision 经 OS Evidence Gate 和用户确认写入原领域。

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

Wiki 质量审核不能单独升级 Verified Claim 或 Thesis；正式对象必须另行通过对应 Evidence / F2 / Provider / PIT / admission / revision / 用户确认门禁。

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

2026-09-22：R0 普通 commit/push 后等待 ChatGPT 独立审计；下一任务 Stage 4.3-R1 Verified Claim V1。本任务无 PR、merge 或 Production。

### 历史停止点（2026-09-13，已被上述路线 supersede）

记录时点：`origin/main @ ee7f2e35d967f58812706c2ee06255cc82ea4094`。

已知正式事实：Stage 4.1-F 已 `IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS`，但 production/data 仍 NOT_ADMITTED；既有 source blocker 按当前 readiness 与专项 evidence 继续存在。

当前外部执行任务：Stage 4.1-G 已由用户交给 Codex 执行，本文只把它登记为**计划中的 Stage 4.1 收口任务**，不声明已实现、已验证或已合并。

4.1-G 最终交付后按既有流程：

`Codex push → ChatGPT 独立终局审计 → 用户授权 → PR / exact-head CI → merge → main CI → CURRENT sync`

若无新的 P0 主线阻断，**下一业务阶段固定进入 Stage 4.1B — Research Inbox + Evidence Surface MVP。**
