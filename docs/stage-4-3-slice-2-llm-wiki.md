# Stage 4.3 / Slice 2 — LLM Wiki V1 + Markdown / Obsidian Projection

> 2026-09-21 CURRENT 阅读兼容增量：Slice 2.5 的 `KnowledgeDocument` 安全渲染 Markdown/GFM，供贡献审核、Wiki 当前文章及历史正文共用；长表格局部滚动。raw HTML/脚本/MDX不执行，远程图片不加载，危险链接协议过滤；正文原字节、Wiki模型/版本/Review、合同与单向投影保持不变。真实首轮CREATE仍待本人接受，真实增量双版本闭环延期至Knowledge V2；[最终收口及测试绑定](stage-4-3-slice-2-5-preview-cutover.md#currentcontract--delta-最终收口)。原基础设施独立复审PASS不覆盖此新增差异。


> 2026-09-21 CURRENT：**Wiki Infrastructure V1 — independent review PASS**。用户确认针对性独立复审通过的精确基线为 `812e7551e67b0b8af4f673524e2578ecf2e19335`；Slice 2.5 从该基线继续。未据此声明 Slice 2 MERGED 或 Production。以下保留修复时点记录，其 PENDING 不再代表当前复审状态。

> 状态：IMPLEMENTED / VERIFIED LOCALLY / P1 REMEDIATION / PENDING TARGETED RE-REVIEW
> 日期：2026-09-20  
> 实施基线：fetch 后 `origin/main @ 1d883414fe7828b682c8cd888223ccf7bd729834`（Slice 1 CLOSED）；分支 `codex/stage-4-3-slice-2-llm-wiki-obsidian`

## P1 remediation — 固定 Vault 路径保留（2026-09-20）

原独立审计 HEAD `188f1adcd2a5662f24dc9a57c861ae6e95934394`，结果 **P0=0 / P1=1**。本次仅修复 generated path collision；独立针对性复审仍 **PENDING**，本地验证不等于独立审计通过。

`renderWikiVault()` 在任何页面写入之前，把 `research-wiki/index.md` 与 `research-wiki/manifest.json` 统一加入 collision set；固定输出也复用同一组路径定义。沿用 NFC path normalization、NFKC + case-insensitive 比较以及双向文件/目录前缀碰撞规则，全部 fail closed，不静默改名或 repair。原 traversal / Windows reserved names / illegal chars / 层级 / 扩展名规则不变。

基线复核发现，该 HEAD 的 `parts.length >= 3` 已拒绝直接根级 `index.md`；实际可重现的缺口是固定文件未参与 collision gate，`index.md/child.md`、`manifest.json/child.md` 及其 portable 等价路径仍被接受。本次保留现有层级校验，并显式保留两个固定文件，不依赖 `.md` 扩展名间接保护 manifest。新增 6 组 fixed path / 大小写 / NFKC 及目录前缀回归，修复前 6 项失败，修复后全部通过；另新增默认/合法自定义路径的完整 `manifest.pages` / `manifest.files` 最终 UTF-8 字节独立 SHA-256 校验，并补充 page ↔ page NFKC collision。manifest 本身继续不包含在其 `files` 摘要列表内，schema 不变。

| 本轮 Gate | 结果 |
| --- | --- |
| Wiki projection 专项 | 29/29 PASS（原 21 + 新增 8） |
| 全部 Wiki 专项 | 78/78 tests，6/6 files PASS |
| `npm test` | 1136/1136 tests，88/88 files PASS |
| `npm run build` | PASS；Local Core browser boundary 2391 graph modules / 5 chunks / 0 forbidden；financial bundle gate PASS |
| `npm run contracts:validate` | PASS；既有 frozen contracts、Source/Extraction、Wiki standalone validator |
| `npm run test:contracts` | Local Core 106/106、financial 78/78、Slice 1/Wiki Vitest 29/29 PASS |
| `npm run research:eval:check` | PASS；F3 reference 33/33 REFERENCE_ONLY；actual deterministic service 0/33 NOT_IMPLEMENTED；Industry F3 5/5 |
| `npm run test:research-eval` | 51/51 PASS |
| `npm run test:local-core` | 261/261 PASS |
| `node scripts/wiki-browser-check.mjs` | 90/90 checks PASS，三主题 × 1536/1280/390/320，13 screenshots；0 runtime/console errors、0 external requests |
| `npm run test:discovery` | 1/1 PASS；88 正式 Vitest 路径，nested checkout 隔离保持 |
| 审计 HEAD → 修复后的 byte comparison | 默认路径与合法 Unicode 自定义路径的 Markdown、manifest 完全相同，ZIP SHA-256 相同；现有重复导出 deterministic 测试 PASS |

本轮日志与 byte comparison 位于 gitignored `data-cache/stage-4-3-slice-2/p1/`，浏览器报告在其 `browser/report.json`（含源文件 SHA-256）；验收数据仍为 synthetic。既有非阻断提示：Vite chunk >500 kB、favicon.ico 404、jsdom window.scrollTo。首次 build 发现新增测试的 `Object.hasOwn` 超出现有 TypeScript lib，已改用既有 `hasOwnProperty.call` 写法，复跑 projection / Wiki / 全量 / build 全部通过，未修改编译配置。

structured Wiki Domain 唯一 authority、schema、Entry/Revision/Review、owner/admission/PIT、Entity browser bridge、F3 结果均未改变；没有 Markdown ingestion/write-back 或双向 Obsidian sync。**Hosted CI NOT_RUN；PENDING TARGETED RE-REVIEW**。仅原功能分支普通 commit/push 后停止，不创建 PR、不 merge、不修改 main、不部署 Production，不提升 Production/Data admission。

下方 D0、初始交付验证和冻结设计保留原时点；当前 remediation 状态以上述记录为准。

## D0 — Reuse / Delta Map 与实现冻结

此表在实现前完成；下方原设计冻结继续生效。

| 层 | 直接复用 | 本 Slice 新增 / 不复制的 authority |
| --- | --- | --- |
| L0/L1 | `ResearchSourceRef`、`ResearchExtractionRef`、`CreatorResearchExtractionRepository`、Creator adapter 的精确 trace | 只存 refs；不复制 Raw Source、Extraction、Creator 原文/Current View/approval |
| Evidence / F2 | `IndustryMetricPin`、F2 shared `Pin` schema、已校验字节的 Industry Registry provider、`industryChartAudit` / Evidence Drawer | 原 owner/sha256/version/observationId/locator 精确引用；保留 native Evidence 与准入状态；不建立 Evidence/Claim graph |
| Identity | Slice 1 `ResearchRelatedRefs`、现有 Industry ID、Creator topic owner、Entity Registry 类型 | 不由字符串或 Topic 名推断 Entity。Node-only Entity Registry 未连接时 refs fail closed |
| L2 | precise instant、canonical finite JSON | 单一 `wiki.v1` envelope：Entry/Revision/Review；8 类型；Current、search、backlinks、orphan 都派生 |
| Local-first | `PersistedBaseGuard`、Creator append/import/recovery 模式 | WikiRepository seam 与 Browser adapter，独立 Wiki 历史 key；不新增 SQL/云/Bridge 写入口 |
| UI | Workspace hash navigation、Modal、Evidence Drawer、三主题/reduced-motion | `#/memory` 的 Sources/Extractions/Wiki；App 只增加导航和挂载 |
| Export | 原 Creator XLSX 的 ZIP STORE 算法提取到 `src/utils/zip.ts` | deterministic UTF-8 Markdown Vault 和 manifest；没有 MD ingestion/write-back |

### Path scheme

默认 `research-wiki/<type-folder>/<wikiId>.md`，目录固定：`entities/concepts/frameworks/topics/creators/industries/macro/conventions`，另有 `index.md` 与 `manifest.json`。标题改名不改变默认路径；显式 `paths[wikiId]` 覆盖仅改变投影。NFC 规范化；大小写/NFKC 和文件/目录前缀碰撞拒绝；traversal、绝对路径、反斜杠、保留名、非法符号、点目录、尾点/空格拒绝。默认无 Wikilink、`.obsidian`、插件或 Sync。

Manifest 保存 stable ID / revision / path / SHA-256，以及全部生成文件摘要。相同 Domain、cutoff 和路径输入产生相同 Markdown/manifest/ZIP 字节。frontmatter 属性顺序固定，只含字符串、布尔和字符串数组；复杂引用在正文 References。正式 backlink/orphan 只读 `wikiRefs`，正文 Markdown 链接不会反写 Domain。Obsidian 自己的图可识别正文链接，但不具有审核或领域引用 authority。

兼容依据：[Obsidian 原生 Markdown links](https://obsidian.md/help/links)、[扁平 Properties 与支持类型](https://obsidian.md/help/properties)。本地标准 YAML parser 与实际解压目录/相对链接测试通过；未宣称运行 Obsidian 桌面客户端。

### History / review / owner gates

Revision 为单根线性追加链；首次 quality review 为 reviewed/rejected，已审核记录可追加 archive；重新审核须追加新 Revision。Current 选 cutoff 可见的最新 approved chain member；Draft/Rejected 不取代 Current；最新 approved 被归档后不回退复活旧页。所有时间为本地 knowledge/audit 语义，不替代 publication 或 strict PIT。每个 revision 的外部 refs 按其自身 `asOf` 精确解析；历史查询不解析未来 revision 的外部材料。

Review 只产生 `research_memory`，作者为 AI 时 Current/Markdown 仍为 `ai_draft`。Source completeness/uncertainty、Extraction 未审核状态和 Evidence 质量状态向页面传播。审核至少要求 Source/Extraction/Evidence 中一项；Wiki orphan 表示没有正式 Wiki 邻接，不表示无支持材料。broken/foreign/missing refs 关闭 Current 与投影；不跳过坏引用拼出完整页面。

Slice 1 adapter 首次进入浏览器时，原 `local-core/domain/canonical-json.ts` 触发已有 Node-only 门禁。纯编码算法因此提取至 `shared/canonical-json.mjs`；Local Core 薄包装继续抛相同 `LocalCoreError`，浏览器不导入 Local Core。门禁本身未放宽，Local Core 全套测试与构建边界检查均通过。

### Repository / Workspace

`BrowserWikiRepository` 只追加 Entry/Revision/Review；闭合 schema、finite plain JSON、snapshot mutation check、exact persisted base guard、重复 ID/冲突拒绝。完整 Wiki JSON 包括 drafts/rejections/archives；普通 import 是相同 ID 跳过、不同内容拒绝、显式确认的追加合并。恢复限于本次实际观测的同一 corrupt raw bytes，先保留并读回 pre-recovery 原字节，再替换 Wiki key 并重读校验。未来 schema 永久锁定本版本的恢复入口。

Workspace 支持新建/追加草稿、独立审核/拒绝/归档、历史只读、稳定排序搜索、每版历史及原文/Evidence 下钻、ZIP 导出、目录漂移检查、完整 JSON 下载、预览导入和受控损坏恢复。目录选择只将不可信字节用于比较；当前文件可报告 current，旧 cutoff/domain 报 stale，改动/缺失/额外文件报 drift；不产生 Wiki write-back。跨页返回或显式刷新重新读取 owner；跨 tab storage event 失效缓存。

### 已知限制

- Browser `localStorage` 是同步且按 origin 共享配额，未测定一个通用可用容量。全历史和 pre-import/pre-recovery 备份会增长；quota error 拒绝写入，用户须保留外部完整 JSON。现有 guard 不提供跨 tab 原子 CAS；未来事务型 adapter 留在 `WikiRepository`，本轮没有实现 bridge/cloud migration。
- Wiki 完整备份仅覆盖 Wiki authority；Creator/其他 Source/Evidence 的原 owner 备份必须单独保留，缺失 owner 时 Wiki 导入/投影 fail closed。Vault 不替代任何正式备份。
- 当前浏览器 Source/Extraction adapter 只有 Creator；Evidence 接已注册的 Industry retained-byte owner，全部 pin 维度必须精确匹配。Entity 形状复用既有 Registry，但本浏览器无 Node Registry bridge，非空 Entity refs 拒绝；Industry/topic refs 由原 owner 校验。其他 owner 必须新增经审查 adapter。
- 没有 LLM runtime、自动维护、真实三位 Creator 灌入、Verified Claim、Thesis、Expression、MCP、Agent 或双向同步。Obsidian User Note 未来只能走 L0→L1→L2 review。
- Workspace 正文原样显示 Markdown 文本；Vault 可用 Markdown reader 渲染。目录校验最多读取 20 MiB，忽略用户 `.obsidian/` 配置。生成文件的 read-only 是应用/流程边界，用户仍可在外部编辑，随后被检测为 drift。
- public fixtures 全部 synthetic；`research-wiki/`、`.wiki-data/`、`.obsidian/` gitignored。浏览器验收使用临时 profile，未触碰用户实际 Wiki 或 Creator 资料。

### 本地验证与停止点

| Gate | 结果 |
| --- | --- |
| Wiki Domain / Repository / Projection / contract / owner / Workspace 专项 | 70/70 PASS（包含在全量 Vitest） |
| `npm test` | 1128/1128 tests，88/88 files PASS；含 Slice 1 / Creator / Evidence |
| `npm run build` | PASS；Local Core browser boundary 2391 graph modules、5 chunks、0 forbidden；金融数据 bundle gate PASS |
| `npm run contracts:validate` | PASS；既有 frozen contracts + Slice 1 + Wiki standalone validator drift check |
| `npm run test:contracts` | Local Core contracts 106/106、financial contracts 78/78、Slice 1/Wiki Vitest 29/29 PASS |
| `npm run research:eval:check` / `npm run test:research-eval` | PASS；51/51 Node tests；F3 reference 33/33、actual service 0/33 NOT_IMPLEMENTED 保持；Industry F3 5/5 |
| `npm run test:local-core` | 261/261 PASS，验证纯 JSON encoder 提取后 LocalCoreError/Node 边界不回归 |
| `node scripts/wiki-browser-check.mjs` | 90/90 checks，三主题 × 1536/1280/390/320，13 screenshots；0 runtime/console errors、0 external requests |
| `npm run ui:audit` | PASS（既有静态扫描；新界面以 browser evidence 为准；仅时间戳产物未纳入 diff） |
| `npm run test:discovery` | PASS；88 正式测试路径保持，nested checkout 隔离仍有效 |

浏览器在独立临时 profile 内真实执行创建 Draft→review→拒绝修订→审核改名→related/backlink→historical asOf→重复 ZIP 下载→解压并校验目录→外部编辑检测→JSON 完整备份→corrupt recovery→future schema lock。原 Creator key 字节在这些流程中保持不变；ZIP 经 Python `zipfile.testzip` 独立读取，两次输出字节相同。Refs 在 canonical persistence 后的修订表单中保留。复查修正了长 Evidence 标识的窄屏换行。

可重放入口：`scripts/wiki-browser-check.mjs`；使用既有 Playwright runtime（通过 `UI_REVIEW_PLAYWRIGHT_MODULE` 指定），不新增 browser runtime 依赖或用户 profile。本地报告与合成导出在 gitignored `data-cache/stage-4-3-slice-2/browser/`。源文件 SHA-256 保存在 report.json，真实个人资料未进入 Git。既有非阻断提示：Vite chunk >500 kB、favicon.ico 404、jsdom window.scrollTo 提示。

Hosted CI：**NOT_RUN**（检查当前 `.github/workflows/ci.yml`，仅 PR 与 main push 触发）；本功能分支未触发 PR/main workflow。独立审计 PENDING；普通 push 后停止；PR / merge / main CI / Production deploy / admission 均未在本切片发生。


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
