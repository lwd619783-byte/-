# Stage 4.3 / Slice 2 — LLM Wiki V1 + Markdown / Obsidian Compatibility

> 状态：NEXT / DESIGN FROZEN / NOT IMPLEMENTED  
> 日期：2026-09-20  
> 基线：`main @ f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`（Slice 1 CLOSED）  
> 目标：建立 L2 Reviewed Research Memory / LLM Wiki，并从 V1 起提供可移植 Markdown 与 Obsidian read-first Vault，而不制造第二真源。

## 1. 核心架构

```text
L0 ResearchSource
        ↓
L1 ResearchExtraction
        ↓
Wiki Draft / Review
        ↓
WikiEntry + WikiRevision       ← 唯一 L2 业务真源
        ↓
deterministic Markdown renderer
        ↓
Obsidian-compatible Vault / plain Markdown
```

Wiki Domain Owner 决定知识身份、revision、review、asOf、refs 与当前状态。Markdown/Vault 只由某个确定 WikiRevision 生成，可以删除后重建；不得从文件修改时间、文件名或 Obsidian graph 反推业务状态。

## 2. Wiki V1 最小对象

先冻结最小合同，不做万能知识图谱。

至少表达：

- stable `WikiRef / wikiId`；
- entry type：ENTITY / CONCEPT / FRAMEWORK / TOPIC / CREATOR_FRAMEWORK / INDUSTRY_KNOWLEDGE / MACRO_KNOWLEDGE / RESEARCH_CONVENTION；
- title / aliases；
- structured body / sections 或受控 Markdown body（具体最小 owner 形式由 D0 决定）；
- sourceRefs / extractionRefs / evidenceRefs；
- relatedWikiRefs；
- authorType / createdAt / asOf；
- draft / reviewed(or published) / rejected / archived；
- append-only WikiRevision / supersedes；
- append-only review authority；
- completeness / uncertainty / caveat。

AI author/generator 默认只能形成 draft。review 代表 Wiki 内容质量与引用检查，不等于 Provider Fact / Verified Claim。

Reviewed/publishable Wiki 必须有可解析 provenance；不得生成无法回到 L1/L0 的“孤儿知识”。

## 3. As-of 与 revision

- Wiki current view 必须由 revision/review 历史派生，不存第二份可漂移 current state；
- 未来录入、未来 review、未来 revision 不得进入过去 knowledge As-of；
- source/extraction 在目标 As-of 不可见时，对应 Wiki projection 必须 fail closed 或显式 incomplete，不得引用未来知识；
- title/alias/path 修改属于 Wiki revision，不改变 wikiId；
- archive 不 hard-delete 历史；
- Markdown 文件 mtime 不能成为 createdAt/asOf/revision 时间。

## 4. Markdown-native projection

V1 必须提供纯函数式、确定性 renderer：

`WikiRevision + resolved refs + projectionVersion → Markdown bytes`

要求：

- UTF-8；
- YAML frontmatter；
- stable `wikiId` / `revisionId` / `entryType` / `title` / aliases / asOf / status / projectionVersion；
- sourceRefs / extractionRefs / evidenceRefs 在 frontmatter 或机器可解析 section 中保留；
- body 不复制 L0 大段原文，只写 L2 知识内容与受控引用；
- explicit `relatedWikiRefs` 渲染为 `[[wikilinks]]`；
- renderer 不从自由文本自动猜 wikilinks；
- 相同输入必须 byte-identical；
- YAML/Markdown 特殊字符、Unicode、长文本、公式样式文本、路径穿越与保留文件名安全；
- Markdown projection 不具备 commit/review/publish 权限。

## 5. Obsidian-compatible Vault

V1 目标是“无需 Obsidian 也可使用；有 Obsidian 时直接获得更好的知识浏览”。

建议 Vault projection：

```text
research-wiki-vault/
  index.md
  entries/
    <stable-wiki-id>.md
  README.md
```

可按 entry type 进一步分目录，但路径身份必须建立在 stable wikiId 上，而不是可变 title。页面显示标题由 frontmatter / H1 / alias 提供。

Obsidian 兼容要求：

- 解压导出包后可直接选择文件夹作为 Vault；
- `[[wikilinks]]` 可形成 backlinks / Graph View；
- index.md 可按类型或主题导航；
- 不依赖第三方 Obsidian plugin 才能读取核心知识；
- 不把 `.obsidian/` 用户偏好作为 Wiki 业务状态；默认不生成或覆盖用户个人 Obsidian 配置；
- Dashboard 中明确标记 “Markdown / Obsidian 为 read-first projection”。

Browser SPA V1 不承诺静默写任意本地目录。优先做用户显式触发的 Vault ZIP / Markdown export；未来 Desktop / Local Core bridge 可以物化到固定目录，但不改变 Domain authority。

## 6. Obsidian 编辑与回流边界

Slice 2 **不做双向实时同步**。

如果用户在 Obsidian 中直接修改系统生成的 Wiki Markdown：

- 不自动视为 Wiki revision；
- 不自动覆盖结构化 Wiki owner；
- 再次导出时系统真源可以重新生成 projection。

未来如需接收 Obsidian 中用户原创笔记，正式语义应是：

`Obsidian user note → L0 user_note Source → L1 Extraction → L2 Wiki proposal`

而不是：

`edited .md → overwrite WikiEntry`

这保证 Obsidian 是开放编辑工具，但不会绕过 provenance/review 体系。

## 7. Local-first repository / backup

- 建立最小 WikiRepository seam；
- Browser V1 可复用现有 StorageLike / PersistedBaseGuard 模式，但不复制 Creator owner；
- append-only revision/review；
- strict schema/version validation；
- JSON 为完整 backup / restore authority；
- Markdown/Vault 是分析/阅读/迁移投影，不作为灾难恢复主格式；
- corruption / future schema fail closed；
- preview import + conflict detection + pre-import backup + explicit confirmation 继续采用项目既有模式；
- 不引入 cloud business DB、browser SQLite 或 Git 作为高频 Wiki 数据库。

## 8. Search / read model

V1 先做 deterministic search：

- title / aliases；
- entry type；
- related entity/topic；
- body text；
- source/extraction/evidence refs；
- relatedWikiRefs；
- status / asOf。

不要求 embeddings / Vector DB。未来 Vector/RAG 只能作为检索 adapter，不能成为 Wiki authority。

## 9. Workspace

Slice 2 最少完成 Research Memory Workspace：

- Sources；
- Extractions；
- Wiki。

Wiki 页面至少显示：

- title/type/status/asOf；
- 当前 reviewed revision；
- source/extraction/evidence refs；
- related wiki；
- revision history；
- incomplete/uncertainty；
- 下钻 Source / Extraction / Evidence；
- “导出 Markdown / Obsidian Vault”入口。

沿用现有三主题、responsive、reduced-motion、Modal/Evidence Drawer。不要把 domain/repository 逻辑继续堆进 `App.tsx`。

## 10. 验收

至少验证：

1. stable wikiId 不因 title/path 改名变化；
2. AI draft 不成为 reviewed Wiki；
3. reviewed Wiki 必须有有效 L0/L1 provenance；
4. revision append-only、旧 As-of 不变；
5. future source/extraction/review/revision no-leak；
6. missing/invalid ref fail closed；
7. Wiki 不晋升 Provider Fact / Verified Claim / Thesis；
8. deterministic lexical search；
9. JSON backup / conflict / recovery；
10. Markdown renderer byte-deterministic；
11. frontmatter 与 UTF-8 / Unicode / escaping 安全；
12. path traversal / reserved path 防护；
13. explicit relatedWikiRefs → 有效 Obsidian wikilinks；
14. title rename 不破坏稳定 wikilink target；
15. Vault export 可独立解包读取，index 可导航；
16. Markdown 不包含不应复制的 Raw Source 全文；
17. 手工修改 Markdown 不能直接写回 Wiki owner；
18. Creator L0/L1 adapter 与 4.2.5 chronology/recovery 无回归；
19. 320px / themes / reduced-motion / keyboard 基础可用；
20. full tests / build / contracts / relevant F3 PASS。

## 11. 非目标

- 三位真实 Creator 的批量 Wiki 数据（Slice 3）；
- Verified Claim（Slice 4）；
- Thesis（Slice 5）；
- Portfolio / MCP / autonomous Agent；
- Vector DB / Graph DB；
- Obsidian plugin 开发；
- Obsidian 双向实时 sync；
- 自动读取用户整个 Obsidian Vault；
- 用 Markdown/Git 代替 Wiki repository；
- 真实用户 Vault 或私有材料提交公共仓库。

## 12. 停止点

从最新 main 建独立功能分支实现 Slice 2。完成实现、验证和 CURRENT 文档同步后普通 push，停止等待独立审计；不创建 PR、不 merge、不修改 main、不手动部署 Production。
