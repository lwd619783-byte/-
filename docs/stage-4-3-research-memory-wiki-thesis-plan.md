# Stage 4.3 — Research Memory & Thesis Compiler V1

> 2026-09-23 CURRENT — R2 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。PR #76，merge/main `17a2e1929c1d7570e477a5e19aadbeee29aa04f5`；PR CI `35746157236`、main CI `35746962990`、同 SHA Production deployment `6594270082` 已实时核验 success。主线切换 **Stage 4.3-R3 Investment Expression V1 + Closeout：IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT**。真实 5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression；Stage 4.4–4.6 PLANNED / NOT_IMPLEMENTED。本条 supersede 下方较早 CURRENT，不回写历史审计。[R3 D0 与交付](stage-4-3-r3-investment-expression-closeout.md)。


> 2026-09-22 CURRENT — **Stage 4.3-R2 Thesis V1 + Macro → Industry：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。真实 Base `1651aa7bbf3fcdf4a59d17e7ae6e6edaf057ef7d`，分支 `codex/stage-4-3-r2-thesis-v1`。R1 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**：PR [#75](https://github.com/lwd619783-byte/-/pull/75) 于 2026-09-22T13:33:13Z 合入上述 merge/main；PR CI [35733395999](https://github.com/lwd619783-byte/-/actions/runs/35733395999)、main CI [35734221779](https://github.com/lwd619783-byte/-/actions/runs/35734221779) 已实时核验 success；Production deployment `6591911800`（同一 Base SHA）已实时核验 `success / Deployment has completed`，与用户确认的 READY 一致。真实仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis**，data admission / PIT / release blockers 不变。R2 完成后仅普通 commit/push，等待 ChatGPT 独立审计；R3 **PLANNED / NOT_IMPLEMENTED**。本条 supersede 下方旧 CURRENT 与停止点，不回写历史审计。 R2 本地全量 1,317 tests、build、contracts、research/industry/data audit、discovery 均通过；R2 real browser 49/49、synthetic browser 52/52、R1 browser 130/130（均 0 runtime errors）。详见 [R2 实现与验证](stage-4-3-r2-thesis-v1.md)。


> 2026-09-22 CURRENT — **Stage 4.3-R1 Verified Claim V1：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。基于本轮 fetch 的 `origin/main @ de2107571ae5ee2189b82f7ab05b6521a4457b75`。复用原 Industry candidate / F2 Graph / Evidence Drawer；新增 exact revision 用户确认、append-only Claim/history、非权威 Research Context 与 Local-first JSON backup/recovery。真实留存 5 candidates / 0 verifiable / 0 verified；admission、PIT、release 与原始数据不变。普通 commit/push 后等待 ChatGPT 独立审计，无 PR/merge/Production；R2/R3仍未实现。[R1 D0、实现与验证](stage-4-3-r1-verified-claim-v1.md)。

> R0 已实时核验：PR [#74](https://github.com/lwd619783-byte/-/pull/74)，head `44ccdd01a6d65914f2a2a8f26384fd468a71ad3b`，2026-09-22T11:50:16Z 合入 `de2107571ae5ee2189b82f7ab05b6521a4457b75`；main CI [35723692280](https://github.com/lwd619783-byte/-/actions/runs/35723692280) completed/success。登记 R0 **IMPLEMENTED / MERGED / MAIN CI PASS**；不推导 Production、data admission 或旧私人验收状态。下方较早 CURRENT 记录仅代表原时点。


> 2026-09-22 CURRENT — **Stage 4.3-R0 External Knowledge Rebaseline**；默认 External Knowledge Lane（Drive → ChatGPT → Notion），OS 聚焦 Research Decision Lane；Local Wiki / Bridge 为冻结功能范围的兼容能力。下一任务 **Stage 4.3-R1 Verified Claim V1**。本轮功能分支待独立审计；普通 commit/push 后停止，无 PR/merge/Production。[Stage 4.3-R0 正式决定](stage-4-3-r0-external-knowledge-rebaseline.md) supersede 下方旧路线与 CURRENT 停止点，历史审计/验证数字仍仅代表原时点。

> 合入事实已于 2026-09-22 重新核验：Slice 2/2.5 经 PR [#72](https://github.com/lwd619783-byte/-/pull/72) 合入 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，main CI [35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441) success；UI V2.1 经 PR [#73](https://github.com/lwd619783-byte/-/pull/73) 合入开工基线 `9769c46789a6efc98999fe7fabeda750710cbbb5`，main CI [35690271399](https://github.com/lwd619783-byte/-/actions/runs/35690271399) success。代码已 MERGED / MAIN CI PASS；旧真人审核、UPDATE/history/revoke 验收仍 PENDING / NOT_VERIFIED，本轮私人数据 NOT_REVERIFIED，不能据此宣称 Slice 2.5 完整验收 CLOSED。

## R0 冻结架构 / R3 CURRENT — 双通道、执行与关闭边界

正式新事实源为 [Stage 4.3-R0 External Knowledge Rebaseline](stage-4-3-r0-external-knowledge-rebaseline.md)。本节与该决定 supersede 下方旧规划 §1/2 的默认本地 L0/L2 路线、§5 的未来 Slice 3–6 执行顺序、§6 的默认自研 Wiki 阅读中心、§7 的旧关闭前置条件、§8 的默认 Wiki MCP 与 §9 的停止点；安全、PIT、review、revision、权限和历史实现合同保持。

- External Knowledge Lane（默认）：Drive durable 原件 → ChatGPT draft analysis/extraction → Notion 人类可读 L2 Wiki，保留来源/版本/变化原因/审核状态。
- Research Decision Lane：原 Provider / official Evidence / Creator owner → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression → Stage 4.4；外部 context 不单独验证 claim。
- KEEP：公共 Source/Extraction、Creator adapters、Evidence/F2/Drawer、provenance/asOf/revision/review/fail-closed、knowledge-contribution.v1 interchange。
- FREEZE / LEGACY：Wiki V1 local authority、JSON backup/recovery、Markdown/Obsidian、BrowserSource/parser、只读 Bridge、Wiki editor。数据和功能保留，OS 不镜像 Notion 正文。
- 新序列：**R0（已合入）→ R1 Verified Claim V1（CLOSED）→ R2 Thesis V1 + Macro → Industry（CLOSED）→ R3 Investment Expression + Closeout（CURRENT / PENDING INDEPENDENT AUDIT）**。R2 实现和验收见新交付文档。旧 Slice 1/2/2.5 历史不改；旧 Slice 3不再独立扩建，Creator Wiki外置，Stage 4.5提供Creator context。
- Stage 4.5 聚焦 OS Domain MCP 和 prepare/preview/confirm/commit；不重复代理 Drive/Notion。Bridge 只有替代完成且真实迁移通过才讨论退役。
- 新关闭条件见 R0 §4；Stage 4.3未CLOSED，旧真实验收缺口不记PASS。本轮commit/push后等待独立审计，无PR/merge/Production。

## 历史冻结与交付记录（2026-09-20～21）

以下保留旧 Slice 编号、字段约束、审计与实现事实；其中 CURRENT/PENDING 是记录时点，新主线以上方 R0 为准。

> 2026-09-21 CURRENT 更新：独立审计 `81c7663` 为 REQUEST_CHANGES；本次 R1/R2/R3 定向修复与正式回归见 [修复交付记录](stage-4-3-slice-2-5-audit-fixes.md)。保持同一功能分支，等待绑定新 SHA 的独立复审；远程 owner/OAuth 验收与 ChatGPT 账号连接分别记账，未取得证据不升级 PASS。下方原验收数字保留其历史时点。

> 状态：Slice 1 CLOSED / Slice 2 Wiki Infrastructure V1 — independent review PASS / Slice 2.5 CURRENT，IMPLEMENTED / LOCAL VERIFIED / PENDING INDEPENDENT REVIEW
> 日期：2026-09-20  
> 当前基线：`main @ f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`（Stage 4.3 Slice 1 CLOSED）  
> 目的：把 Research Memory / LLM Wiki、Evidence / Claim、Thesis 与 Investment Expression 统一成一条可审计、可修订、可回溯的研究编译链。

## 1. 核心决定

2026-09-21 增量冻结：从独立复审通过的 `812e7551e67b0b8af4f673524e2578ecf2e19335` 插入 [Slice 2.5](stage-4-3-slice-2-5-knowledge-ingestion.md)，完成中文资料摄取、完整文章建议审核与版本历史。按用户追加授权，Stage 4.5 的远程能力仅提前 **selected private staging + authenticated read-only MCP V1**；不提前 MCP write、Agent、全库同步或云业务真源迁移。其余下文原切片设计保持；旧基线是历史记录。

Stage 4.3 不把 LLM Wiki 定义成“AI 总结文章集合”，也不把所有原文迁入一张万能数据库。正式链路为：

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

治理平面横跨 L0–L5：

- Schema / semantic class；
- Entity Identity；
- Provenance / source ownership；
- published / captured / recorded / asOf / PIT；
- Revision / supersede / archive；
- Verification / review；
- Audit；
- missing / partial / stale / conflicted / unknown 传播。

任何一层都不得因为 AI 输出“看起来正确”而自动跨级。

## 2. 各层正式语义

### L0 — Raw Source / Evidence

职责：保存或稳定引用“当时看到了什么”。

来源可包括：

- Provider / official evidence；
- Creator post / article / comment / reply；
- PDF / 研报 / 网页；
- user note；
- ChatGPT research artifact / selected conversation excerpt；
- 后续其他 source domain。

原则：

1. 原文与 provenance 不被 AI 摘要覆盖；
2. source owner 继续拥有自己的原始对象，不强制迁入统一表；
3. Stage 4.3 只冻结 `ResearchSourceRef / ResearchSourceAdapter`，至少表达 sourceDomain、sourceId、sourceType、entity/topic refs、publishedAt、capturedAt、content/attachment ref、completeness、digest、provenance；
4. 全文归档服从版权、entitlement 与用户明确选择；公共仓库不提交私有研究材料或大段版权原文。

### L1 — Structured Extraction

职责：保存“这段材料表达了什么”。

`ResearchExtraction` 是一等、可持久化对象，而不是一次性 prompt 中间结果。至少支持：

- sourceRefs；
- related entity / industry / macro topic；
- extracted facts / viewpoints / drivers / relationships；
- catalysts / risks / invalidation；
- open questions；
- uncertainty / completeness；
- extractor / authorType / model or method version；
- createdAt / asOf；
- status：AI_DRAFT / REVIEWED / REJECTED；
- revision / supersedes。

AI Extraction 默认只能进入 draft；review 只确认提取与归纳质量，不把内容升级为 Provider Fact。

### L2 — Reviewed Research Memory / LLM Wiki

职责：保存“长期来看我们从这些材料中学到了什么”。

Wiki V1 至少支持以下 Entry 类型：

- ENTITY；
- CONCEPT；
- FRAMEWORK；
- TOPIC；
- CREATOR_FRAMEWORK；
- INDUSTRY_KNOWLEDGE；
- MACRO_KNOWLEDGE；
- RESEARCH_CONVENTION。

每个 Wiki Entry / Revision 必须保留：

- sourceRefs；
- extractionRefs；
- evidenceRefs（如有）；
- related entities / topics；
- authorType；
- createdAt / asOf；
- revision / supersedes；
- verification / review status。

重要知识陈述必须能反查：

`Wiki statement → Extraction → Raw Source`。

Wiki 可综合多个来源，但不是 Provider Fact authority；Wiki 结论被后续材料推翻时追加 revision，不静默改写过去。

### L3 — Verified Claim

职责：把 Research Memory 与正式 Evidence 连接成可验证主张。

要求：

- 复用 Stage 4.1B / 4.2 已有 Evidence、Evidence Drawer 与 F2 Evidence Graph；
- 不建立第二个 Claim Graph；
- statement、scope、asOf、evidenceRefs、verification status、revision 可审计；
- Creator Commentary / Wiki / AI_DRAFT 单独不能成为 Verified Claim；
- 需要 Provider / official / admitted evidence 时继续服从原 admission / PIT / revision 边界。

### L4 — Thesis

职责：把 Claims / Evidence 组织成正式研究判断。

Thesis V1 至少包含：

- statement；
- bull / base / bear；
- key drivers；
- claimRefs / evidenceRefs；
- catalysts；
- risks；
- invalidation；
- confidence；
- asOf；
- related macro drivers；
- related industries / companies；
- append-only revision history；
- formal publish / stance change confirmation seam。

AI 可以生成 Thesis Draft / proposal；正式 revision 需要用户确认。

### L5 — Investment Expression

职责：回答“这个 Thesis 如何表达”，不是“自动交易”。

统一支持：

- Index；
- ETF；
- Fund；
- A-share；
- HK-share；
- US / global equity；
- Commodity proxy；
- Future instrument（后续）。

至少记录：

- thesisRef；
- instrumentRef；
- directness / correlation rationale；
- liquidity；
- valuation context；
- thesis sensitivity；
- company-specific risk；
- expression role（direct / leader / high-beta / defensive 等）。

Portfolio / Position / Transaction 不属于 Stage 4.3，留给 Stage 4.4。

## 3. Creator Tracker 的正式定位

Stage 4.2.5 已经提供第一条生产级 Research Memory ingestion pipeline：

```text
CreatorSource
   ↓
ViewpointObservation
   ↓
StateTransition / Current View
   ↓
T+ Review
```

Stage 4.3 不重新创建 Creator Raw Source 或 Creator Extraction：

- `CreatorSource` 通过 ResearchSourceAdapter 投影到 L0；
- `ViewpointObservation` 作为 creator-specific Structured Extraction 接入 L1；
- Transition / Current View / Review 为 Wiki Framework 提供状态演化与验证引用；
- Wiki 保存 refs 与知识 revision，不复制原文、不维护第二份 Current View。

这样未来 Article / PDF / User Note / ChatGPT Artifact 可新增 adapter，而不是复制 Creator 模型。

## 4. 与现有 ChatGPT ingestion 设计的关系

既有 `Structured Contribution Bundle` 继续作为“研究贡献传输格式”，不是数据库实体。

Stage 4.3 负责接收/映射到 Source / Extraction / Wiki / Claim / Thesis 等 Domain Objects；后续 Stage 4.5 再通过 controlled tool / MCP 暴露 prepare → preview → user confirm → commit。

聊天原文仍按既有三档语义：

- Digest only（默认）；
- Selected excerpt；
- Full transcript archive（仅用户明确要求）。

不得默认把全部聊天全文复制进 Research Memory。

## 5. Stage 4.3 六个 Slice

### Slice 1 — Research Source + Structured Extraction Contract

目标：冻结 L0/L1 的稳定 Domain Contract 与 adapter seam。

交付：

- D0 Reuse / Delta Map；
- ResearchSourceRef / Adapter；
- ResearchExtraction V1；
- review / reject / revision 语义；
- source/extraction provenance 与时间语义；
- CreatorSource / ViewpointObservation 首个 adapter；
- fail-closed validation / deterministic read model；
- Local-first repository seam；
- 对应 F3 / domain tests；
- 文档与 feature registry 同步。

不得：

- 搬迁 Creator 真源；
- 引入 cloud DB；
- 调真实 LLM 作为通过测试的必要条件；
- 自动生成 Wiki / Claim / Thesis。

### Slice 2 — LLM Wiki V1 + Markdown / Obsidian Projection

目标：建立可真正日常使用的 L2 长期知识层，同时保持结构化 Research OS authority 与 Markdown/Obsidian 可移植浏览能力。

权威边界：

- `WikiEntry / WikiRevision / WikiReview`（或等价 append-only domain objects）是正式 L2 authority；
- Markdown 文件是由当前 reviewed Wiki projection **确定性生成**的可重建视图，不是第二真源；
- Obsidian 是可选的 read-only 人类浏览器，不是数据库、review authority 或同步服务；
- 人工若未来在 Obsidian 中写新笔记，应作为新的 L0 User Note 显式 ingestion，不能直接改写 L2 authority。

交付：

- WikiEntry identity + append-only WikiRevision / review / archive 语义；
- sourceRefs / extractionRefs / evidenceRefs 与 Wiki-to-Wiki refs；
- Entity / Concept / Framework / Topic / Creator Framework / Industry / Macro / Research Convention 等 entry type；
- deterministic current/read model、backlinks、orphan/ref validation；
- deterministic keyword search / filter，不依赖 Vector DB；
- Sources / Extractions / Wiki Workspace，并能从 Wiki 下钻 Extraction / Raw Source / Evidence；
- Local-first repository + backup/recovery；不建立 cloud DB；
- **Markdown-native projection**：每个 reviewed Wiki page 可确定性渲染为 UTF-8 `.md`；
- **YAML frontmatter** 使用扁平、原子、可移植字段（例如 wikiId/type/title/revision/status/asOf/tags/aliases），复杂 nested domain object 不塞进 frontmatter；
- **链接兼容**：authority 使用 wikiId/ref；Markdown 默认生成标准相对 Markdown links（Obsidian 可识别，且跨 GitHub/VS Code/普通 Markdown 更可移植），不得让文件名成为实体 identity；
- **Obsidian-compatible Vault projection**：生成 index + typed folders/pages；不要求任何 community plugin，不生成或提交用户的 `.obsidian/` 配置；
- generated file 带明确 marker / manifest，使编辑漂移可检测；外部编辑不得自动回写 Domain；
- 文件路径/标题变化不得改变 wikiId；碰撞、非法路径、path traversal fail closed；
- public repo 只保存 synthetic fixture；真实个人 Wiki/Vault 默认运行时/gitignored。

参考兼容行为：Obsidian 原生识别 YAML properties、标准 Markdown links 与 Wikilinks；本项目默认选择标准 Markdown links 以兼顾 Obsidian 与其他 Markdown 工具。

不得：

- 用 Wiki 反写 Provider Facts；
- Markdown/Obsidian 与结构化 repository 双向自动同步；
- 把手工改过的 generated MD 当 authority；
- 默认向量化所有资料；
- 无引用生成“孤儿知识”；
- 在本 Slice 引入真实 LLM runtime、MCP、Agent、Claim/Thesis 或 Obsidian plugin。

### Slice 3 — Creator → Wiki + 三位真实博主

目标：用真实业务数据验证 Raw → Extraction → Wiki。

交付：

- 至少三位 Creator 的运行时资料流程；
- 主帖 / 评论 / 本人回复等 Source；
- Reviewed Viewpoint / Transition / Review；
- Creator Framework Wiki V1；
- 当前观点引用 Creator Current View，不复制；
- 核心观察变量 / 决策框架 / 观点演化；
- insufficient evidence 时标 PROVISIONAL / incomplete；
- 跨 Creator 同 Topic / Event 比较可链接 Wiki。

真实数据边界：

- 用户私有/运行时数据不提交公共仓库；
- 测试 fixture 必须 synthetic；
- 大段版权原文不进入 Git。

### Slice 4 — Evidence → Verified Claim

目标：建立 L2 → L3 的正式门禁。

交付：

- Claim V1 / revision；
- Wiki / Extraction 只作为 research context；
- Evidence refs 复用 F2 Evidence Graph；
- Provider Fact / Derived Signal / External Commentary / User Judgment / AI Draft 分类不混淆；
- claim verification / rejection / supersede；
- Evidence Drawer 完整 drill-down；
- unsupported claim fail closed。

### Slice 5 — Thesis + Macro → Industry

目标：把正式 Claim 组织成可修订投资 Thesis。

交付：

- Macro Driver → Industry exposure / sensitivity mapping；
- Industry / Company Thesis V1；
- bull / base / bear；
- catalysts / risks / invalidation；
- confidence / asOf；
- claim/evidence refs；
- Thesis revision diff / history；
- user confirmation seam；
- Research Memory / Wiki ↔ Thesis 双向引用但 authority 分离。

### Slice 6 — Investment Expression + Stage 4.3 Closeout

目标：完成研究到资产表达的闭环，但不进入持仓。

交付：

- Thesis → Instrument mapping；
- ETF / Index / Fund / Equity 表达；
- direct / leader / high-beta / defensive 角色；
- liquidity / valuation / thesis sensitivity / idiosyncratic risk；
- Research Workspace 最终信息架构；
- 端到端 trace：Expression → Thesis → Claim → Evidence / Wiki → Extraction → Raw Source；
- Stage 4.3 docs / eval / closeout。

## 6. Research Memory Workspace

Stage 4.3 最终前端至少提供：

1. **Sources**：原始材料、provenance、时间与完整性；
2. **Extractions**：AI/人工从原文提取了什么，draft/review/revision；
3. **Wiki**：长期知识、framework、revision、支持来源；
4. **Claim & Thesis**：正式研究主张与投资逻辑；
5. **Expression**：Thesis 的资产表达。

继续复用 Evidence Drawer / Modal / Workspace navigation / themes / reduced-motion。不得继续把核心业务逻辑堆进 `App.tsx`。

## 7. Stage 4.3 关闭条件

Stage 4.3 只有同时满足下列条件才能 CLOSED：

1. L0 Source 与 L1 Extraction 有稳定 versioned contract / adapter；
2. Raw Source 不被 Extraction/Wiki 覆盖；
3. AI Extraction 默认 draft，review/revision 可审计；
4. Wiki Entry 可版本化、搜索、修订和反查 Source；
5. Creator Tracker 通过 adapter 接入且无数据复制/双真源；
6. 三位真实 Creator 的运行时工作流可用，且公共仓库无私有/大段版权原文；
7. Wiki / Creator Commentary 不能自动晋升 Verified Claim；
8. Verified Claim 复用既有 Evidence / F2 Graph；
9. Thesis 具备 revision / catalyst / risk / invalidation / confidence；
10. Macro → Industry mapping 与 Thesis 可连接；
11. Investment Expression 支持至少 ETF/Index/Equity 类表达；
12. Expression 可一路回溯到 Thesis / Claim / Source；
13. unknown / partial / stale / conflict 语义在 UI / export 中传播；
14. Local-first backup / recovery 可验证；
15. 核心 domain / repository / UI / asOf / revision / no-leak tests 完整；
16. Hosted CI / merge / main CI 事实完成后才登记 CLOSED。

## 8. 非目标与后续阶段

Stage 4.3 明确不做：

- Portfolio / Position / Transaction（Stage 4.4）；
- 完整 Research MCP Gateway / remote write Domain Tools（Stage 4.5）；Slice 2.5 仅提前用户授权的 staging 只读工具；
- ChatGPT-connected autonomous Research Agent（Stage 4.6+）；
- 自动交易；
- cloud business DB 全迁移；
- 浏览器直接 SQLite；
- 全量 Vector DB / Graph DB 强制迁移；
- 默认抓取全部互联网内容；
- AI 自动 publish Wiki / Claim / Thesis；
- 用 AI 生成内容补齐 Provider 缺失事实。

Stage 4.5 应暴露 `search_wiki / get_wiki_entry / get_claim / get_thesis` 等受控 Domain Tools；Stage 4.6+ 的 Agent 读取与修订 Stage 4.3 已建立的 Research Memory，而不是再造第二套 Wiki。

## 9. 下一停止点

Stage 4.3 的 **CURRENT 为 Slice 2.5 — AI Knowledge Ingestion Foundation V1 + Read-only Research Bridge**。Slice 2 已 independent review PASS。Slice 2.5 完成必要验证、CURRENT 同步与普通 commit/push 后停止等待独立审计；无 PR/merge/Production，后续 Slice 3–6 尚未实现。
