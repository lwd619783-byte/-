# Stage 4.3 / Slice 2.5 — AI Knowledge Ingestion Foundation V1

状态：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW；远程端到端状态 PARTIAL（owner/OAuth 八工具及 ChatGPT 账号连接未完成验收）。基线 `812e7551e67b0b8af4f673524e2578ecf2e19335`（Wiki Infrastructure V1 — independent review PASS）；分支 `codex/stage-4-3-slice-2-5-knowledge-ingestion-v1`。

## D0 Reuse / Delta / Architecture Map（实现前冻结）

| 现有事实源 | 复用 | 本轮最小增量 |
| --- | --- | --- |
| Slice 1 `ResearchSource` / `ResearchExtraction` / `ResearchSourceAdapter` | 公共 L0/L1 类型、引用、来源与不确定性语义 | 明确注册 browser-source adapter；文件原文归新 Browser Source Repository，Creator 原文仍归 Creator；不复制 Creator |
| Slice 2 `WikiEntry` / `WikiRevision` / `WikiReview` / `BrowserWikiRepository` | 唯一正式文章、完整版本、人工质量审核、追加与基线保护 | Contribution Proposal 是候选传输对象；接受时通过既有 append 一次追加完整 revision + review，不建立第二个 Current / Review 真源 |
| `createWikiOwners` / `resolveWikiRevision` | 精确 owner 回查与历史 cutoff | 组合 Creator 与 browser-source adapters；未注册 domain、缺失原件或损坏存储关闭解析 |
| `wikiProjection` / ZIP | 单向、可重建 Obsidian 投影 | 仅中文入口；不增 Markdown 回写或双向同步 |
| 现有研究记忆 UI / Evidence Drawer | 文章历史、原 Creator 下钻、证据与备份机制 | 原始资料 → AI 整理 → 待审核 → 我的知识库；手工编辑收进更多操作 |

架构链：浏览器文件/粘贴 → Browser Source Repository（IndexedDB：exact bytes + batch + metadata）→ 页/行解析结果 → 显式导出研究任务 → 用户交给 ChatGPT → 版本化 Contribution Bundle → 校验 + 待审核 → 用户接受 → 既有 Wiki Repository → 完整文章 / 版本演化 / 来源 → 单向 Obsidian。

**关键边界：浏览器 IndexedDB 不是远端 MCP 可读取的文件系统。** 本轮无远端可达端点、身份认证、授权原件传输或 MCP server/write。Future Research Bridge read port 必须由后续受控 transport 适配；本轮手工导出研究任务与原件、导入 JSON。未来 direct-submit port 只接相同 Bundle 导入服务，不能直接接受 Wiki。正式未来流程冻结为 OS 保存资料 → Bridge/MCP 读取获授权批次 → ChatGPT 分析 → Bundle → OS 待审核。

新增合同是独立 additive `knowledge-contribution.v1`，引用 Slice 1 公共 Extraction 和 Slice 2 Wiki 类型，既有 frozen contracts 不变。Structured findings 的唯一语义仍是 ResearchExtraction；knowledge atoms 只引用 extraction finding，不建第二套事实或图谱。

原文件先在一个 IndexedDB 事务中保存整批 exact bytes 和 metadata，再异步解析；解析失败不删除原件。SHA-256/ID/配额/重复/冲突/损坏均显式失败。Repository seam 支持未来替换；当前 origin/profile 本地存储，不声明跨浏览器同步或永久备份。

CREATE / UPDATE 必须带完整文章（核心判断、产业/主题结构、近期变化、关键环节、风险待验证、来源）与逐节变化摘要；UPDATE 精确引用上次 reviewed revision，陈旧建议不自动合并；原 Wiki 单链约束仍生效。LINK / CONFLICT 也以完整文章修订承载关联/冲突，NO_ACTION 不写 Wiki。AI origin 永久保留，质量审核不升级事实准入。

`KnowledgeAnalysisProvider` 只有 port，无默认实现。正常页面明确“AI 分析服务尚未连接”；fake 仅测试。PDF 使用本地打包 PDF.js 文本提取、页定位，无 OCR；MD/TXT 采用严格 UTF-8 与行定位，原件始终独立保留。新增 PDF parser dependency 的理由是需要可靠处理压缩 PDF 文本，不能用正则伪装 PDF 支持；worker 与资源不从 CDN 拉取。

审核桥不复制 Review authority：正式接受结果通过稳定 proposal 对应的原 WikiReview 派生；收件箱的拒绝/无需处理仅记录不可变投递处置，不表示正式 WikiReview。跨存储不声称原子事务；接受只写一次现有 Wiki append，重试从正式记录恢复，浏览器锁串行化同一建议的接受/拒绝。

## 验证与交付

已实现中文首用、稳定批次、IndexedDB exact bytes、PDF 页/UTF-8 行解析、贡献包 round-trip、建议队列与完整文章审核，更新追加完整历史、不新增重复 Wiki。Provider 正常运行未连接；测试 fixture 不进入真实流程。LINK / CONFLICT 沿用完整修订与原关联机制。

| 本地验证 | 实际结果 |
| --- | --- |
| Ingestion + 原 Wiki UI 专项 | 26/26（21 domain/repository + 5 UI） |
| MCP contract / 真实本地 HTTP + 官方 client | 6/6，包括认证、PKCE、单次码、发布、分页、digest、未授权隔离、过期、撤销、拒写 |
| 全量 Vitest | 1157/89 files PASS（含配额回滚与引用隔离） |
| build / TypeScript / Local Core typecheck / bundle gate | PASS；PDF worker 惰性本地打包；原大 chunk 警告保留 |
| contracts validate / test:contracts | PASS；additive knowledge contract 引用原 Source/Extraction；原 frozen contracts 不变 |
| F3 check / research-eval tests | PASS；reference 33/33，actual deterministic service 仍 0/33；Industry 5/5，未提高 admission |
| discovery / UI audit | PASS；无新增未登记测试 |
| 原 Wiki 浏览器回归 | 99/99：手工文章、审核/拒绝、稳定身份、历史查询、引用、Evidence Drawer、ZIP 字节一致、Markdown 禁止回写、完整备份、reload、损坏恢复前备份、未来 schema 锁定、三主题四宽四入口；0 runtime/console errors / 0外部请求，13截图；已知 favicon 404 单列警告 |
| 新首用浏览器验收 | 81/81：空 profile、10文件同批、PDF两页及内嵌中文 Unicode 映射/MD/TXT、reload、10个 digest、下载原件字节一致、无假 AI、导入前后权限、修改后接受 UPDATE 单 Wiki 双完整版本、三主题 × 1536/1280/390/320 × 四入口无横向溢出；0 runtime errors / 0未授权外部请求，12截图 |

原件上限25 MiB/份、100 MiB/批、30份；PDF普通文本最多500页，不做 OCR/密码解锁/复杂字体资源下载；MD/TXT 严格 UTF-8。浏览器清理站点数据、换 profile/origin 会失去该处本地资料；Wiki backup 不含 IndexedDB 原件，原件需单独下载保留。贡献包导入上限10 MiB，完整文章六章仅结构校验，内容正确性仍需人工审核。尚无全库原件备份或语义检索。

Vercel private Blob 与当前分支认证配置已完成，真实 SDK 写/读/禁止覆盖通过；Preview 公网 OAuth discovery 200、匿名 owner/MCP 401 已验证。只为指定 Preview 设置访问例外，没有关闭项目保护。owner/OAuth 八工具与 ChatGPT 账号连接仍 PENDING，因此远程端到端为 PARTIAL，不能由6个离线测试推定通过。[Bridge 连接/限制/验收](research-bridge-readonly-v1.md)、[贡献合同](../contracts/knowledge-ingestion/v1/README.md)、[中文产品冻结](research-memory-chinese-first-use-v1.md)。独立审计 PENDING；无 PR / merge / Production 声明。

## D0 增量决定：Read-only Research Bridge（2026-09-21）

用户追加授权覆盖上文“本轮无远端端点”的范围限制；原 Local-first authority、贡献包人工回传、人工审核和无 MCP write 保持。继续同一实现与分支。

- 用户点击“交给 ChatGPT 整理”后，仅发送选定批次的元数据与逐页/逐行解析文本；本轮 MCP 文本研究无需复制大原件，原件 exact bytes 仍仅在浏览器。远端带本地原件 SHA-256 作为身份绑定，不能声称远端保存了未经复制的原件。
- staging 使用 Vercel **private** Blob；拒绝 public store/public fallback。批次显式 publish 前不可读，部分上传不可见；只读请求每次重新核验 publication、TTL 与撤销 tombstone（`useCache: false`）。24 小时逻辑 TTL；撤销不删除本地原件，也无法收回 ChatGPT 已读取内容。
- 既有知识由用户在发送面板逐项选择；只上传选定文章的 reviewed 完整版本快照和其 reviewed 历史。无默认全库同步。它们是临时 read model，不是远端 Wiki authority。
- Vercel Node Functions + MCP 官方 SDK Streamable HTTP，严格八个只读工具。固定实体 ID 与有界页/文本窗口；无通用路径、SQL、写工具或任意查询。
- 单用户 V1：部署环境提供 owner secret、OAuth signing secret、固定 OAuth client ID 与回调白名单。ChatGPT OAuth authorization-code + S256 PKCE；显式 owner 登录及同意，短期 access token 严格核验 issuer/resource/scope/expiry。环境未配置则 503 fail closed；不提供匿名 MCP。
- 所有 secret 仅环境配置，UI owner secret 仅页面内存、不落 browser storage；请求不输出原文/凭据日志。代码与 synthetic integration tests 可完成，真实远程可达性仍取决于 Vercel 配置权限、private store 与 ChatGPT connector 授权。

依赖检查：npm audit 报告9项（最高 critical，Vitest），相关既有工具链版本与基线相同；未擅自扩大范围升级。新增 PDF/Blob/MCP 包未列入该报告。没有将本地测试、Preview READY 或独立复审状态提升为 Production admission。
