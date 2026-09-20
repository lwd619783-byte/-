# Stage 4.3 / Slice 2.5 — AI Knowledge Ingestion Foundation V1

状态：D0 COMPLETE / IMPLEMENTATION IN PROGRESS。基线 `812e7551e67b0b8af4f673524e2578ecf2e19335`；分支 `codex/stage-4-3-slice-2-5-knowledge-ingestion-v1`。

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

待实施与验证后追加实际结果。独立审计 PENDING；无 PR / merge / Production 声明。
