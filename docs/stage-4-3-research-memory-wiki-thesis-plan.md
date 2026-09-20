# Stage 4.3 — Research Memory & Thesis Compiler V1

> 状态：CURRENT · SLICE 1 CLOSED / SLICE 2 NEXT DESIGN FROZEN  
> 日期：2026-09-20  
> Stage 4.3 正式起点：`main @ 2cea477105d3e63242e65b7f3eec0b658a87ce17`；CURRENT main：`f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`（Slice 1 CLOSED）  
> 目的：把 Research Memory / LLM Wiki、Evidence / Claim、Thesis 与 Investment Expression 统一成一条可审计、可修订、可回溯的研究编译链。

## 1. 核心决定

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

### Slice 1 — Research Source + Structured Extraction Contract（CLOSED）

状态：PR #69 / PR CI success / merge main `f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186` / main CI success / Production READY。目标：冻结 L0/L1 的稳定 Domain Contract 与 adapter seam。

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

### Slice 2 — LLM Wiki V1（NEXT / DESIGN FROZEN）

目标：建立可真正日常使用的 L2 长期知识层，并从第一版就具备开放、可移植的 Markdown / Obsidian 浏览能力。

**Authority 决策：**

```text
WikiEntry / WikiRevision（结构化 Domain Owner，唯一真源）
                    ↓ deterministic render
          Markdown Vault Projection
                    ↓
        Dashboard / Obsidian / VS Code
```

Markdown 与 Obsidian Vault 是派生视图，不是第二份业务真源。文件被手工修改后不得直接反向覆盖 WikiEntry / WikiRevision。未来需要把 Obsidian 手记带回系统时，应作为新的 L0 `user_note` Source 重新走 Source → Extraction → Wiki，而不是绕过审核改写 L2。

交付：

- WikiEntry / WikiRevision / WikiReview 最小 versioned contract；
- stable WikiRef / wikiId：标题、slug、文件名变化不得改变知识身份；
- sourceRefs / extractionRefs / evidenceRefs 与 relatedWikiRefs；
- AI 生成或 AI 作者的 Wiki 内容默认 draft；review/publish/reject/archive/revision 可审计；
- append-only revision + knowledge As-of；未来 revision/review 不泄漏到过去视图；
- Entity / Concept / Framework / Topic / Creator Framework / Industry / Macro 等有限 entry type；
- deterministic lexical search / filter / read model，V1 不依赖 Vector DB；
- Sources / Extractions / Wiki Workspace；
- Wiki → Extraction → Raw Source / Evidence 一键下钻；
- Local-first Wiki repository、JSON backup / preview / recovery；Markdown 不作为恢复权威；
- **Markdown-native projection**：每个 reviewed/publishable Wiki revision 可确定性渲染 UTF-8 Markdown；
- **Obsidian-compatible Vault export**：浏览器端导出可解压后直接作为 Vault 打开的 Markdown 包；
- YAML frontmatter 至少稳定表达 wikiId、revisionId、entryType、title/aliases、asOf、status、projectionVersion、source/extraction/evidence refs；
- explicit `relatedWikiRefs` 确定性渲染为 Obsidian `[[wikilinks]]`，支持 backlinks / Graph View；renderer 不从自由文本猜关系；
- Vault 文件路径以稳定 wikiId 为身份基础，不用可变 title 当主键；title 改名不能破坏链接；
- 生成 index / navigation Markdown，便于 Obsidian 与普通文件浏览器使用；
- deterministic renderer tests：同一 revision → byte-identical Markdown/Vault；frontmatter escaping、Unicode、path traversal、特殊字符和长文本安全；
- UI 明确标记 “Obsidian/Markdown 为只读投影”；V1 不做双向实时同步。

Obsidian V1 边界：

- 不要求安装 Obsidian 才能使用投研看板；
- 不向公共仓库提交用户真实 Vault、私有 Wiki 或大段版权原文；
- 不生成或管理用户个人 `.obsidian/` 配置作为业务状态；
- Browser SPA 不直接写用户任意本地目录；通过显式导出完成 Vault materialization；
- 不把 Markdown 文件修改时间当 Wiki revision/asOf/PIT；
- 不把 Obsidian backlink/Graph 推断当正式 Evidence、Claim 或 Thesis；
- 不实现 Markdown → Wiki 的无审核反向导入。

不得：

- 用 Wiki 反写 Provider Facts；
- 默认向量化所有资料；
- 无引用生成“孤儿知识”；
- 把 Markdown/Obsidian 变成第二业务数据库；
- 自动把 Wiki 晋升为 Verified Claim / Thesis。

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
- Research MCP Gateway / remote Domain Tools（Stage 4.5）；
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

Stage 4.3 的 **NEXT IMPLEMENTATION 固定为 Slice 2 — LLM Wiki V1（含 Markdown-native / Obsidian-compatible Vault projection）**。

Slice 2 开工前从最新 main 读取 `AGENTS.md`、本计划、CURRENT、Feature Registry、Execution Plan、Slice 1 contract/adapter、Creator Tracker、Evidence Drawer 与现有 Local-first browser persistence。先做 Reuse / Delta Map，明确 Wiki owner、revision/review、search、projection 与 backup seam；不得为 Obsidian 建第二套真源。