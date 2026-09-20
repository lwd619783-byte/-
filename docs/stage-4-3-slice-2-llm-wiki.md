# Stage 4.3 / Slice 2 — LLM Wiki V1 + Markdown / Obsidian Projection

> 状态：CURRENT PLAN / DESIGN FROZEN / NOT IMPLEMENTED  
> 日期：2026-09-20  
> 起点：`main @ f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`（Slice 1 CLOSED）

## 1. 本 Slice 解决的问题

Slice 1 已冻结：

`L0 Raw Source / Evidence → L1 Structured Extraction`

Slice 2 只建立 L2：

`Reviewed Research Memory / LLM Wiki`

目标不是复制互联网 LLM Wiki 的“全 Markdown 就是真源”，而是保留本项目的审计/PIT/revision 边界，同时获得 Markdown 的可移植性和 Obsidian 的双链、backlink、graph 浏览体验。

正式架构：

```text
L0 Source owners
      ↓
L1 Structured Extraction
      ↓
L2 structured Wiki Domain authority
      ↓ deterministic projection
Markdown Vault
      ↓
Obsidian / GitHub / VS Code / text editor
```

**结构化 Wiki Domain 是 authority；Markdown/Obsidian 是 projection。**

## 2. Obsidian 兼容冻结

### 2.1 支持，但不依赖 Obsidian

兼容目标：

- UTF-8 Markdown；
- 文件顶部 YAML frontmatter / properties；
- 标准 Markdown headings/lists/tables；
- 标准 Markdown relative links，Obsidian 可识别并建立 backlinks/graph；
- 可使用 aliases/tags 等 Obsidian 原生 properties；
- 文件夹可直接作为 Vault 打开。

默认不要求：

- community plugins；
- Dataview；
- 自定义 Obsidian plugin；
- Obsidian Sync；
- 任何 cloud service；
- `.obsidian/` 配置进入项目 authority。

### 2.2 为什么默认标准 Markdown links

Obsidian 同时支持 `[[Wikilinks]]` 和标准 Markdown links；本项目默认输出标准 Markdown relative links，以同时兼容：

- Obsidian；
- GitHub；
- VS Code；
- 普通 Markdown reader；
- 后续 MCP/Agent 文本工具。

可选 Wikilink renderer 属于后续扩展，不是 V1 gate。

### 2.3 Frontmatter 只放扁平元数据

建议 frontmatter 只包含可稳定、原子化的数据：

- `wikiId`
- `type`
- `title`
- `revisionId`
- `status`
- `asOf`
- `createdAt`
- `tags`
- `aliases`
- generated/source-of-truth marker

sourceRefs / extractionRefs / evidenceRefs 等复杂结构仍以 Domain object 为 authority；Markdown 中可生成稳定的 references section，不把 nested domain graph 硬塞入 YAML。

## 3. Wiki Domain

先做 D0 Reuse / Delta Map，优先复用 Slice 1：

- `ResearchSourceRef`
- `ResearchExtractionRef`
- Creator adapter / trace
- existing Entity / Industry identity
- Evidence refs / F2 boundaries
- Local-first repository / backup patterns
- Workspace / Evidence Drawer / Modal

推荐最小对象：

### WikiEntry

稳定 identity，不因 title/path 改变：

- wikiId
- type
- createdAt
- related entity/topic refs
- immutable identity/path key（具体形式由实现审计后冻结）

### WikiRevision

append-only：

- revisionId
- wikiId
- title
- summary
- bodyMarkdown
- sourceRefs
- extractionRefs
- evidenceRefs
- wikiRefs
- tags / aliases
- authorType
- createdAt / asOf
- supersedes
- revisionReason

### WikiReview

review authority 与 revision 分离：

- draft / reviewed / rejected
- exact revision ref
- review time
- reviewer/approval ref

Current Wiki 页面必须从 reviewed revision history 派生，不维护会漂移的第二份 mutable current state。

Wiki review 只确认研究记忆质量，**不产生 Provider Fact / Verified Claim / Thesis authority**。

## 4. Entry types

V1 至少冻结：

- ENTITY
- CONCEPT
- FRAMEWORK
- TOPIC
- CREATOR_FRAMEWORK
- INDUSTRY_KNOWLEDGE
- MACRO_KNOWLEDGE
- RESEARCH_CONVENTION

不要为每一种内容创建独立数据库表；通过 type + closed shared contract 表达，只有出现真正不同的业务语义时再扩版本。

## 5. 引用与知识图

Wiki 必须保留：

- sourceRefs
- extractionRefs
- evidenceRefs
- wikiRefs

关键链路：

`Wiki → Extraction → Raw Source`

以及：

`Wiki → Evidence`

但：

- Wiki 不成为 Evidence；
- Creator Commentary 不因为进入 Wiki 而升级；
- Markdown link 不等于 Domain ref；
- file path / filename 不等于 wikiId；
- 删除/改名 projection 文件不能删除 Domain Entry。

Backlinks、related pages、orphan pages 均从 wikiRefs / stable IDs 派生，再投影成 Markdown links。

## 6. Markdown Projection

实现一个 deterministic renderer：

`Reviewed Wiki Read Model → Markdown files`

要求：

1. 同一 Domain input 产生 byte-stable 输出；
2. 排序稳定；
3. UTF-8；
4. 文件名/path 经过安全规范化，禁止 traversal；
5. collision fail closed；
6. title/path 改变不改变 wikiId；
7. generated file 含可识别 marker；
8. renderer 不读取 Markdown 再反写 Domain；
9. 可根据 Domain 全量重建；
10. stale/edited projection 可检测。

建议输出：

```text
research-wiki/
├── index.md
├── entities/
├── concepts/
├── frameworks/
├── creators/
├── industries/
├── macro/
└── conventions/
```

具体文件 path scheme 在 D0 后冻结，但必须保留 stable ID → path manifest/read model。

真实用户 Wiki/Vault 默认 runtime/gitignored；公共仓库只允许 synthetic fixture。

## 7. Obsidian 使用边界

推荐使用方式：

1. Research OS 生成/导出 Markdown Vault；
2. 用户用 Obsidian 打开该目录；
3. Obsidian 用于阅读、搜索、backlinks、graph、页面跳转；
4. generated Wiki 页面默认视为 read-only。

若用户在 Obsidian 中产生自己的研究笔记：

- 不直接修改 generated L2 authority；
- 后续作为 User Note / L0 Source 显式 ingest；
- 再经过 L1 Extraction → Wiki review；
- 不允许“修改 MD = 修改正式 Wiki”。

本 Slice 不实现双向 filesystem sync。

## 8. Search V1

不引入 Vector DB。

deterministic search 至少覆盖：

- title
- summary
- aliases
- tags
- bodyMarkdown
- type
- related refs

要求稳定排序与明确 tie-break；搜索结果显示 review/status/asOf/provenance，并可下钻。

## 9. Local-first / Backup

保持现有 Local-first：

- 定义 WikiRepository interface；
- 选择最小可行 Browser/local adapter；
- append-only revision/review；
- strict schema/version validation；
- JSON/full backup + recovery；
- future schema fail closed；
- Markdown projection 不替代 backup；
- 不因 Obsidian compatibility 引入 cloud DB。

如果当前浏览器存储规模存在明确容量限制，真实记录并留迁移 seam，不提前把 Stage 4.5/Local Core bridge 拉入本 Slice。

## 10. Workspace

新增/扩展 Research Memory Workspace，至少支持：

- Sources
- Extractions
- Wiki

Wiki 页面：

- title / type / current reviewed revision
- asOf / status / completeness
- supporting Sources / Extractions / Evidence
- Related Wiki
- revision history
- Markdown/Obsidian export/projection 状态

复用现有 Workspace、Evidence Drawer、Modal、三主题、reduced-motion；避免继续向 `App.tsx` 堆领域逻辑。

## 11. 验收

至少覆盖：

1. WikiEntry identity 与 filename/path 独立；
2. draft/rejected revision 不进入 current reviewed Wiki；
3. append-only revision / review / historical asOf；
4. Wiki → Extraction → Source 精确反查；
5. Wiki → Evidence 引用不改变 Evidence authority；
6. broken/missing refs fail closed；
7. AI-authored Wiki revision 保留 AI origin；
8. Wiki review 不产生 Verified Claim/Thesis；
9. backlinks / related pages 可确定性派生；
10. deterministic search；
11. deterministic Markdown bytes；
12. YAML frontmatter 可被标准 YAML parser 读取，并保持扁平原子字段；
13. Obsidian-compatible standard Markdown links 正确；
14. path traversal / reserved path / collision 拒绝；
15. title/path rename 不改变 wikiId；
16. edited/stale generated MD 不自动回写；
17. Vault 可从 Domain 完整重建；
18. public fixtures synthetic；真实 Vault 不进入 Git；
19. backup/recovery 与 future schema fail closed；
20. 全量 tests/build/contracts/F3 与 Creator/Slice 1 不回归。

## 12. 明确不做

- 三位真实 Creator 数据灌入（Slice 3）；
- 实际 LLM ingestion / autonomous Wiki maintenance；
- Verified Claim；
- Thesis；
- Portfolio；
- MCP；
- Agent；
- Vector DB / Graph DB；
- Obsidian community plugin；
- Obsidian 双向同步；
- Cloud DB；
- 自动网页抓取。

## 13. 停止点

实现、验证、文档同步后普通 push 功能分支，停止等待独立审计；不创建 PR、不 merge、不修改 main、不声明 Production admission。
