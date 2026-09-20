# Stage 4.3 — Research Memory & Thesis Compiler V1

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
