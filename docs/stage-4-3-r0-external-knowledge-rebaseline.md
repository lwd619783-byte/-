# Stage 4.3-R0 — External Knowledge Rebaseline

> 2026-09-22 · R0 架构与执行范围冻结；实现交付待独立审计。开工已 fetch，基线 `origin/main @ 9769c46789a6efc98999fe7fabeda750710cbbb5`。本轮仅功能分支普通 commit + push，不创建 PR、不 merge、不修改 main、不部署 Production。

## 1. 决定与 supersede 范围

用户已完成并确认真实 POC：`Google Drive → ChatGPT → Notion → 持续 Wiki revision`。这是本次路线决策的用户证据；R0 未重新访问私人 Drive、Notion 或真实浏览器存储，不把该证据扩写为本仓库已接通 API、已完成自动归档/迁移或正式事实验证。

本决定 supersede Stage 4.3 master plan、CURRENT、Execution Plan、2026-09-11 roadmap 中“OS 自研 Wiki 是默认长期知识中心”“旧 Slice 3 独立扩建 Creator Wiki”“Stage 4.5 默认代理 Wiki/原件”的规划。旧 Slice 1 / 2 / 2.5 编号、冻结 V1 wire contracts、历史审计与交付记录保持原时点，不追溯改写。

这是知识工作流 authority 分工的调整：外部 L0/L2 成为新资料的默认路线；OS 的 Provider / Creator / Evidence / 决策状态 / Asset / Audit 继续由原 owner 和 Local-first 合同管理。既有 Local Wiki authority 仅管理 Legacy lane 的本地对象（含经既有审核流程新增/修订），不转义为 Notion 的本地镜像。Phase 1 permissions、PIT、admission、revision、正式写入确认及 Restore/pre-restore backup 不变；不新增云业务库，也不改变 Stage 4.4。

## 2. 双通道与 authority

```text
External Knowledge Lane（默认，外部工具工作流）
Google Drive L0 原件 → ChatGPT analysis / extraction（AI draft）→ Notion L2 Wiki
                                  │ research context 引用
                                  ▼
Research Decision Lane（OS；R1–R3 尚未实现）
Provider / official Evidence / Creator structured owner
  → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression → Stage 4.4 Portfolio
```

图中的 Creator 是结构化原始 owner，不意味着 Creator Commentary 可单独通过 Evidence Gate。双通道可以互相引用，但引用不会转移 authority。

| 组件 | 默认职责 | 必须保留 | 不具有的 authority |
| --- | --- | --- | --- |
| Google Drive | 用户上传 PDF / MD / TXT / Excel / 图片等研究原件的 L0 durable archive | 不可改写原件、稳定 file identity / URL、文件名、大小、SHA-256、归档路径；新版本保留原件与版本关联 | Provider Fact / Verified Claim；文件存在或摘要匹配不证明内容真实、发布时间或 PIT |
| ChatGPT | 读取、结构化分析、跨来源比较、增量判断、Wiki 更新编排 | source refs、来源时间与不确定性、AI origin、变化原因 | 事实 authority；拥有读写权限不等于通过 Evidence Gate 或用户确认 |
| Notion | 默认人类可读 L2 Research Memory / Wiki authority | 稳定层级/页面 identity、统一 Wiki 模板、来源、版本、变化原因、AI 草稿 / 待审核 / 已审核 | Provider Fact / Verified Claim；知识审核不等于事实验证 |
| Research OS | structured research state、Evidence、Verified Claim、Thesis、Investment Expression，后续 Portfolio | 原 Provider / Creator / Evidence owners、F2/F3、asOf/PIT、admission、append-only revision、review、fail-closed | 不复制 Notion 正文成为第二真源，不默认代理 Drive/Notion 读取 |

Notion Wiki 模板约定：标题与稳定页面层级、研究范围/asOf、完整正文、逐项来源及原件 identity/digest、版本/前版引用、变化原因、AI origin、审核状态与审核记录、冲突/风险/待验证问题。未知字段显式标未知；AI-origin 内容即使质量审核通过也不改称 Provider Fact。此处是工作流约定，不声称 R0 已实现外部平台锁定原件、digest 自动生成或审计执行器。

Notion Wiki、券商研报、AI Draft 和 Creator Commentary 均只能提供 research context；它们不能单独产生 Verified Claim。未来 R1 必须通过既有 Evidence/F2、Provider、PIT、admission、revision 与用户确认语义；不以页面 reviewed 状态、URL、文件 SHA 或模型置信度替代。原件中的官方材料也须由原 Evidence owner 完成精确来源绑定，不能凭“存于 Drive”获得准入。

## 3. D0 — Reuse / Freeze / Deprecation Map

已按实现、合同和调用关系审查；分类不依赖文件名猜测。FREEZE 表示冻结功能范围、保留运行与安全修复能力，不表示删除、只读化原编辑器或否认历史实现。

| 分类 | 能力 / 现有入口 | R0 后职责与边界 |
| --- | --- | --- |
| KEEP | `contracts/research-extraction/v1`、`src/types/researchExtraction.ts`、`researchExtractionRepository.ts` | SourceRef / Extraction common read contracts；schema shape 与 owner resolution 分开；未知外部域 fail closed |
| KEEP | `creatorResearchAdapter.ts`、Creator Tracker / 原 repository | Creator structured owner、作者与 tracked context 分离；不复制 Current View、不降低 External Commentary 语义 |
| KEEP | `contracts/financial-research/v1/evidence-graph.v1.schema.json`、`evidenceGraph.mjs`、Industry F2、Evidence Drawer | 原 Evidence / F2 Graph、精确 pins、准入和不确定性；不建第二 Claim Graph |
| KEEP | provenance / asOf / revision / review / fail-closed | 两条 lane 均不得改写历史、缺失补零或用 capturedAt 冒充 releaseAvailableAt |
| KEEP | `contracts/knowledge-ingestion/v1/contribution.schema.json`、`knowledgeContribution.ts` / `knowledgeReview.ts` | `knowledge-contribution.v1` 为兼容 interchange / fallback transport；导入候选、接受仍走原 Wiki review；不是新的权威实体 |
| FREEZE / LEGACY COMPATIBILITY | `contracts/wiki/v1`、`src/types/wiki.ts`、`wiki.ts` / `wikiOwners.ts` / `wikiRepository.ts` | WikiEntry / WikiRevision / WikiReview V1 继续拥有原本地历史；未来 schema/corrupt/foreign refs 继续拒绝 |
| FREEZE / LEGACY COMPATIBILITY | Local Wiki JSON backup/recovery、`WikiBackupModal.tsx` | 原显式确认、pre-write 原字节备份、完整历史与 owner 校验；不把 JSON/Vault 当 Drive 原件备份 |
| FREEZE / LEGACY COMPATIBILITY | `wikiProjection.ts`、Markdown / Obsidian Vault | 单向确定性可重建投影；无 Markdown 回写/双向同步 |
| FREEZE / LEGACY COMPATIBILITY | `browserSourceRepository.ts`、`browserSourceAdapter.ts` | IndexedDB exact bytes、batch/sha256/owner/digest 校验保留；不自动上传 Drive、不注册虚构外部 adapter |
| FREEZE / LEGACY COMPATIBILITY | `knowledgePdf.ts`、Browser PDF/MD/TXT parser | 当前本地解析与下载原件能力保留；不因 Drive 接受 Excel/图片就声称浏览器支持这些格式 |
| FREEZE / LEGACY COMPATIBILITY | `server/research-bridge/*`、`api/mcp.mjs`、`api/research-bridge.mjs`、`BridgeStagingPanel.tsx` | transitional / fallback；显式选定 private staging、OAuth/PKCE、八个只读工具、TTL/revoke；无匿名、任意路径、SQL、delete 或 Wiki write |
| FREEZE / LEGACY COMPATIBILITY | `src/components/research-memory/*`（WikiLibrary / WikiRevisionForm / KnowledgeDocument 等） | 旧文章、历史、编辑、审核、备份、投影均继续可用；最小说明 External 默认 / Legacy 兼容 |
| KEEP（展示调整） | `#/memory` / `#/knowledge` / `#/sources`、Workspace navigation | 继续映射同一 workspace 与 repositories；旧深链不迁移、不改 object identity，无第二 store |
| DEPRECATE AS PRIMARY WORKFLOW | 浏览器上传 → Local Wiki → Obsidian → private staging → ChatGPT → JSON import | 保留 fallback，但不再作为日常知识工作流要求，不继续扩建 |
| DEPRECATE AS PRIMARY WORKFLOW | OS 自研 Wiki 作为最终阅读中心；未来 OS `search_wiki` / `get_wiki_entry` 默认职责 | 默认长期阅读中心改为外部 Notion；OS 聚焦决策领域 |

## 4. 实施顺序与关闭条件

历史 Slice 1 / Slice 2 / Slice 2.5 已交付代码；原 Slice 3–6 规划保留历史编号，未实现内容由下列 Rebaseline 序列 supersede，不能倒写为历史 Slice 已完成。

| 阶段 | 当前状态 | 范围与验收 |
| --- | --- | --- |
| Stage 4.3-R0 External Knowledge Rebaseline | 本轮；PENDING INDEPENDENT AUDIT | D0、正式决定、CURRENT 同步、最小 UI 定位、兼容和 authority 回归；commit/push 后停止 |
| Stage 4.3-R1 Verified Claim V1 | NEXT / NOT_IMPLEMENTED | 复用 F2 Evidence Graph；context/verification authority 分离；claim revision / reject / supersede；unsupported fail closed；不得建立第二 Claim Graph |
| Stage 4.3-R2 Thesis V1 + Macro → Industry | PLANNED / NOT_IMPLEMENTED | bull/base/bear、drivers、catalysts、risks、invalidation、confidence、asOf、revision、正式用户确认 seam |
| Stage 4.3-R3 Investment Expression + Stage 4.3 Closeout | PLANNED / NOT_IMPLEMENTED | ETF / Index / Fund / Equity；directness、liquidity、valuation context、thesis sensitivity、idiosyncratic risk；不得提前进入 Portfolio / Position / Transaction |

旧 Slice 3“Creator → Wiki + 三位真实博主”不再独立建设自研 Wiki。Creator Tracker 保留 OS structured owner；长期 Creator Wiki 由 Notion knowledge lane 承担，未来 Stage 4.5 暴露 Creator context。本轮不导入真实 Creator 数据、不完成外部迁移。

Stage 4.3 closeout 改为：R1–R3 完成且可从 Expression → Thesis → Claim → 原 Evidence/owner 追溯，context 引用与验证依据可区分；PIT/状态/revision/确认与测试完整；遗留读取兼容保留；独立审查、PR、merge、main CI 事实发生后再登记。三位 Creator 自研 Wiki、扩建 Local Wiki 和清空旧真人验收账单不再是新主线的前置条件，但缺口必须如实保留，不能记 PASS。Stage 4.3 整体尚未 CLOSED。

## 5. Stage 4.5 Domain MCP

以 OS 独有的 Creator context、Evidence、Verified Claim、Thesis、Investment Expression 为核心（其他既有结构化/Portfolio tools 仍须对应阶段完成）。正式写入沿用 `prepare → preview → confirm → commit`、Auth/scope、Audit、幂等与并发门禁。Notion Wiki 与 Google Drive 原件读取由各自外部工具承担，OS 不重复做代理。

现有八个 read-only Bridge tools 保留为 transitional / fallback compatibility。本轮不改变端点、认证、权限或 deploy 配置。只有 Stage 4.5 Domain MCP 完成替代、真实迁移验证通过后，才允许另行讨论退役；R0 没有退役授权。Stage 4.6 消费这些 OS tools 并通过外部知识工具读写 Notion/Drive，不重新建设 OS Wiki。

## 6. 已核验的合入事实与未完成验收

2026-09-22 只读查询 GitHub PR / Actions 并核对本地 Git：

| 范围 | 精确 PR head | merge/main | CI |
| --- | --- | --- | --- |
| [PR #72](https://github.com/lwd619783-byte/-/pull/72) Slice 2 / 2.5；2026-09-21T13:10:34Z MERGED | `675fb43b65c5f08122efdcfd6548c45ac1fbc8b0` | `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d` | [PR 35603285714](https://github.com/lwd619783-byte/-/actions/runs/35603285714) / [main 35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441)，均 completed/success |
| [PR #73](https://github.com/lwd619783-byte/-/pull/73) UI V2.1；2026-09-22T05:19:43Z MERGED | `35bcb198965df6d3209d4cccd4ceaa01175d18ff` | `9769c46789a6efc98999fe7fabeda750710cbbb5` | [PR 35689880211](https://github.com/lwd619783-byte/-/actions/runs/35689880211) / [main 35690271399](https://github.com/lwd619783-byte/-/actions/runs/35690271399)，均 completed/success |

两组 PR head 与其 squash merge 的 tree diff 均为空。#72 PR body 记录 Contract + Delta 独立审查无阻断问题；GitHub reviews 数组为空，不表述为平台 APPROVED review。本轮没有核验或变更 Production。

纠正旧 CURRENT 的分支未合入/PENDING 停止点，仅登记 **代码 IMPLEMENTED / MERGED / MAIN CI PASS**。不由此宣布 Slice 2.5 全部真人验收 CLOSED：

- 真实 ChatGPT MCP 首轮研究、8-source CREATE、importer/reload 是历史已记录证据；R0 不重做、不扩大结论。
- 本人 WikiReview 的最后仓库记录为 `2026-09-21 13:48Z` 仍 PENDING，WikiEntry/Revision/Review 为 0；本轮未访问该存储，现况为 **NOT_REVERIFIED**，不能称“当前仍为 0”。
- 同 Wiki 真实 UPDATE、完整 history、accepted UPDATE 后真实 ChatGPT revoke-denial：**PENDING / NOT_VERIFIED**。UI V2 D0 已覆盖旧 cutover 的“延期至 Knowledge V2”口径；R0 仅冻结旧路径扩建，不把缺口升级为 PASS。
- 用户报告的新外部 POC 成功与旧 Bridge 验收账单是不同证据。Synthetic/local tests、Hosted CI、真人外部 POC、独立审查、Production/data admission 分别报告。

## 7. 本轮实现与验证约束

运行时仅展示层定位；不新增 Notion/Drive API、外部配置、存储、自动同步、Notion 正文镜像、迁移或 Verified Claim/Thesis/Expression 业务。保留全部现有 contracts/persistence，新增测试直接调用既有 schema/owner/repository 门禁验证：外部 context 不升级 authority、未知外部域不自注册、Legacy Wiki 可读取、没有 mirror 字段/自动写入、Creator/Evidence pins 与 asOf 保持 fail closed。

必要验证为 `npm test`、`npm run build`、`npm run contracts:validate`、`npm run test:contracts`、Research Memory/Wiki/Bridge/navigation 定向测试及 F2 边界回归与 F3 research-eval。所有 Final SHA 测试在最终 commit 后重新执行，结果与 SHA、tree、命令/退出码分别保存于本地 gitignored 验收目录并在交付中报告；不借用上表历史 CI 计数。

双真源评估：R0 不产生 Notion 正文 store 或 sync，Local Wiki 仍只管理 Legacy lane 的本地数据，因此没有新增软件双真源。用户手工复制外部正文后独立编辑两处仍存在流程层漂移风险；该风险靠明确所属 lane、来源/版本引用和不自动合并控制，本轮未声称完成真实数据去重或迁移。Legacy/Bridge 的本地 fixture 读取与真实 HTTP/OAuth 回归不代表线上部署或用户私有数据已复验。

下一任务固定为 **Stage 4.3-R1 — Verified Claim V1**；R0 普通 push 后停止，等待 ChatGPT 独立审计。
