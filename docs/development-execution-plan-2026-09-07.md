# 当前开发执行索引 · 2026-09-07

> 2026-09-23 CURRENT — R2 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。PR #76，merge/main `17a2e1929c1d7570e477a5e19aadbeee29aa04f5`；PR CI `35746157236`、main CI `35746962990`、同 SHA Production deployment `6594270082` 已实时核验 success。主线切换 **Stage 4.3-R3 Investment Expression V1 + Closeout：IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT**。真实 5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression；Stage 4.4–4.6 PLANNED / NOT_IMPLEMENTED。本条 supersede 下方较早 CURRENT，不回写历史审计。[R3 D0 与交付](stage-4-3-r3-investment-expression-closeout.md)。



> 2026-09-22 CURRENT 增量：R2 基于 `8505b607be998dc8313bfc2feeea3c004669ed57` 完成 superseded Claim asOf 定向修复；**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT RE-REVIEW**。新 Thesis 必须引用其 asOf 时的 Claim head；历史 pin 保持并提示后续版本需复核。R1 CLOSED、真实 5/0/0/0 与原 admission/PIT/release blockers 不变；R3 PLANNED / NOT_IMPLEMENTED。[修复与验证](stage-4-3-r2-thesis-v1.md#p1--p2-定向修复)，普通 commit/push 后等 ChatGPT 复审。

> 2026-09-22 CURRENT — **Stage 4.3-R2 Thesis V1 + Macro → Industry：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。真实 Base `1651aa7bbf3fcdf4a59d17e7ae6e6edaf057ef7d`，分支 `codex/stage-4-3-r2-thesis-v1`。R1 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**：PR [#75](https://github.com/lwd619783-byte/-/pull/75) 于 2026-09-22T13:33:13Z 合入上述 merge/main；PR CI [35733395999](https://github.com/lwd619783-byte/-/actions/runs/35733395999)、main CI [35734221779](https://github.com/lwd619783-byte/-/actions/runs/35734221779) 已实时核验 success；Production deployment `6591911800`（同一 Base SHA）已实时核验 `success / Deployment has completed`，与用户确认的 READY 一致。真实仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis**，data admission / PIT / release blockers 不变。R2 完成后仅普通 commit/push，等待 ChatGPT 独立审计；R3 **PLANNED / NOT_IMPLEMENTED**。本条 supersede 下方旧 CURRENT 与停止点，不回写历史审计。 R2 本地全量 1,317 tests、build、contracts、research/industry/data audit、discovery 均通过；R2 real browser 49/49、synthetic browser 52/52、R1 browser 130/130（均 0 runtime errors）。详见 [R2 实现与验证](stage-4-3-r2-thesis-v1.md)。


> 2026-09-22 CURRENT — **Stage 4.3-R1 Verified Claim V1：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。基于本轮 fetch 的 `origin/main @ de2107571ae5ee2189b82f7ab05b6521a4457b75`。复用原 Industry candidate / F2 Graph / Evidence Drawer；新增 exact revision 用户确认、append-only Claim/history、非权威 Research Context 与 Local-first JSON backup/recovery。真实留存 5 candidates / 0 verifiable / 0 verified；admission、PIT、release 与原始数据不变。普通 commit/push 后等待 ChatGPT 独立审计，无 PR/merge/Production；R2/R3仍未实现。[R1 D0、实现与验证](stage-4-3-r1-verified-claim-v1.md)。

> R0 已实时核验：PR [#74](https://github.com/lwd619783-byte/-/pull/74)，head `44ccdd01a6d65914f2a2a8f26384fd468a71ad3b`，2026-09-22T11:50:16Z 合入 `de2107571ae5ee2189b82f7ab05b6521a4457b75`；main CI [35723692280](https://github.com/lwd619783-byte/-/actions/runs/35723692280) completed/success。登记 R0 **IMPLEMENTED / MERGED / MAIN CI PASS**；不推导 Production、data admission 或旧私人验收状态。下方较早 CURRENT 记录仅代表原时点。


> 2026-09-22 CURRENT — **Stage 4.3-R0 External Knowledge Rebaseline**；默认 External Knowledge Lane（Drive → ChatGPT → Notion），OS 聚焦 Research Decision Lane；Local Wiki / Bridge 为冻结功能范围的兼容能力。下一任务 **Stage 4.3-R1 Verified Claim V1**。本轮功能分支待独立审计；普通 commit/push 后停止，无 PR/merge/Production。[Stage 4.3-R0 正式决定](stage-4-3-r0-external-knowledge-rebaseline.md) supersede 下方旧路线与 CURRENT 停止点，历史审计/验证数字仍仅代表原时点。

> 合入事实已于 2026-09-22 重新核验：Slice 2/2.5 经 PR [#72](https://github.com/lwd619783-byte/-/pull/72) 合入 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，main CI [35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441) success；UI V2.1 经 PR [#73](https://github.com/lwd619783-byte/-/pull/73) 合入开工基线 `9769c46789a6efc98999fe7fabeda750710cbbb5`，main CI [35690271399](https://github.com/lwd619783-byte/-/actions/runs/35690271399) success。代码已 MERGED / MAIN CI PASS；旧真人审核、UPDATE/history/revoke 验收仍 PENDING / NOT_VERIFIED，本轮私人数据 NOT_REVERIFIED，不能据此宣称 Slice 2.5 完整验收 CLOSED。

> 2026-09-22 CURRENT · UI21-P1-01 源码与交付证据复审通过（用户本轮确认）；32张图片保留原捕获绑定，不代表完整线上视觉验收。UI21-P2-01 仅补公司业绩预期的本地来源读取状态，健康官方快照继续可读。应用5f05c30：全量1,225 PASS、类型/构建PASS，完整App状态210/210、导航198/198；公司专项同82断言49 FAIL→82 PASS，六张新图片独立交付。受保护Preview eefa8b5：公司状态82/82、导航198/198，保护保留。实现及运行证据见 [本轮问题记录](ui-v2-1/ui21-p2-01/README.md)。合成验证不提升真实稿件/UPDATE/撤销验收，P2 等待独立复审。

> 2026-09-22 CURRENT · UI21-P1-01：操作错误与 owner 读取健康分离，真实锁定不再把未知当0，并传播至公司/辅助统计。应用 `e5c2dcb`：全量1,220 PASS，完整App同脚本基线33 FAIL→修后129/129，导航198、Wiki76、ingestion131通过。受保护Preview `0dd9bfb` 状态129/导航198通过；32张图片ZIP已交付，历史图保留原绑定。[修法/运行证据](ui-v2-1/ui21-p1-01/README.md)。仅普通功能分支交付，PENDING INDEPENDENT REVIEW；ChatGPT未完成全站视觉验收，真实旧稿/UPDATE/撤销缺口不升级。

> 2026-09-21 CURRENT · UI V2.1：用户确认后在原 UI 功能分支继续完成信息层级与空状态校正。暖灰/灰绿/深绿视觉保持；工作台、研究事件、三类任务、知识列表/完整正文、资料三分类、设置行和七个研究子页已接线。代码 `884192d`；1,211 项测试与 build 通过，本地及受保护 Preview 全站浏览器各 198/198，Wiki 76/76、ingestion 131/131（具体 runtime 分别记录）。[本轮审计与回滚](ui-v2-1/visual-audit.md)、[33 项迁移映射](ui-v2-1/migration-inventory.json)、[机器证据](ui-v2-1/acceptance-evidence.json)。仅普通功能分支 push / 受保护 Preview，PENDING INDEPENDENT AUDIT；无 PR/merge/main/Production 授权扩大，真实光通信人工验收状态不变。

> 2026-09-21 CURRENT — 原 Slice 2/2.5 代码已由 PR #72 合入 `main @ a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，exact main CI [35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441) success（本轮只读核实，非本任务执行 merge）。原光通信验收 13:48Z 实查仍待审核、正式 Wiki/Revision/Review 为0；真实 UPDATE/history/revoke 拒读按本次明确范围保留 PENDING/NOT_VERIFIED，不以旧延期条目或代码合入宣布完整验收PASS。Stage 4.3 后续3–6仍未实现。
>
> UI V2 作为跨模块增强插入本切片之后：从上述最新 main 建立 `codex/ui-v2-clear-research-workspace`，五入口、单浅色、旧路由兼容、共享网页阅读与原有模块接线已实现；最终验证/Preview绑定与人工缺口见 [UI V2交付](ui-v2/implementation.md) 和 [D0](ui-v2/d0.md)。仅功能分支普通push，PENDING INDEPENDENT AUDIT；不宣称本轮PR/merge/Production或后续阶段完成。以下历史CURRENT条目保留其时点，本条只覆盖当前范围及合入事实。


> 2026-09-21 CURRENT · Contract + Delta 最终收口：R1/R2/R3 @ `47612e1` 独立复审 PASS（用户确认）；本次共用正文 Markdown/GFM 安全阅读修复及其余新增差异 PENDING FINAL INDEPENDENT AUDIT。真实 ChatGPT MCP 首轮研究 / 8-source CREATE 为 PASS（用户确认并有真实贡献文件），正式 importer 与 reload 核验 PASS；本人审核仍 PENDING，正式 Wiki/Revision/Review 均0。真实 +2 UPDATE/full history 与 accepted UPDATE 后 ChatGPT revoke-denial 明确 DEFERRED / NOT_ATTEMPTED 至 Knowledge V2，不强迫接受或制造版本。安全切换只读复核 PASS；最终回归按交付 HEAD 单独绑定，不继承历史计数。详见[最终状态与验收边界](stage-4-3-slice-2-5-preview-cutover.md#currentcontract--delta-最终收口)。仅当前分支普通 commit/push 后停等独立审计，无 PR/merge/Production；Frontend V2 必须另开分支。


> 2026-09-21 CURRENT 安全切换：沿用已复审代码 `47612e1`（用户提供 PASS），新增验收辅助脚本仍待独立复审。两项密钥仅轮换本分支 Preview；6 个旧部署及分支 alias 的 21 次公网保护检查通过。最终 Preview 安全负向 6/6、远程 synthetic smoke 17/17、公开原件 UI 10/10 通过；首轮 8 份已发布，2 份未发送，持久 profile 已保留。当前停在 HUMAN_RESEARCH；真实 ChatGPT 调用与本人 CREATE / UPDATE 审核 PENDING。以[本轮切换记录](stage-4-3-slice-2-5-preview-cutover.md)为最新状态，下方旧记录保留原时点。无 PR / merge / Production。


> 2026-09-21 CURRENT 更新：独立审计 `81c7663` 为 REQUEST_CHANGES；本次 R1/R2/R3 定向修复、原生浏览器 OAuth 授权修正与正式回归见 [修复交付记录](stage-4-3-slice-2-5-audit-fixes.md)。保持同一功能分支，等待绑定新 SHA 的独立复审；远程 owner/OAuth 验收与 ChatGPT 账号连接分别记账，未取得证据不升级 PASS。下方原验收数字保留其历史时点。

> 2026-09-21 CURRENT — **Slice 2：Wiki Infrastructure V1 — independent review PASS；Slice 2.5：AI Knowledge Ingestion Foundation V1 + Research Bridge / Read-only MCP V1，IMPLEMENTED / LOCAL VERIFIED / PENDING INDEPENDENT REVIEW**。精确基线 `812e7551e67b0b8af4f673524e2578ecf2e19335`。中文四入口、多文件 exact bytes IndexedDB、页/行解析、贡献包候选、完整文章人工审核复用原 Wiki Revision/Review；用户明确发送后才进入 private Blob，八个 OAuth 只读 MCP 工具，人工 JSON 回传。真实远程部署与账号连接结果单独登记，不由本地测试推定。[本切片及验收](stage-4-3-slice-2-5-knowledge-ingestion.md)、[远程边界与连接](research-bridge-readonly-v1.md)。旧条目保留历史时点；当前停止点为 Slice 2.5 普通 commit/push 后等待独立审计，无 PR/merge/Production。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 2 P1 remediation：IMPLEMENTED / VERIFIED LOCALLY / PENDING TARGETED RE-REVIEW**。原独立审计 HEAD `188f1adcd2a5662f24dc9a57c861ae6e95934394` 为 P0=0 / P1=1；固定 `research-wiki/index.md` / `research-wiki/manifest.json` 已统一预留，沿用 NFC / NFKC / case-insensitive 与文件/目录 collision fail-closed。Projection 29、全部 Wiki 78、全量 1136 tests、build、contracts、F3、261 Local Core、discovery PASS；本轮 90/90 browser checks、13 screenshots，0 runtime/console errors、0 external requests。正常 Markdown/manifest/ZIP 字节与审计 HEAD 相同。F3 actual deterministic service 仍 0/33 NOT_IMPLEMENTED，authority/PIT/admission 不变。Hosted CI NOT_RUN；仅原分支普通 commit/push 后等待针对性复审，不创建 PR/merge，不修改 main 或部署 Production。[P1 修复与本轮验证](stage-4-3-slice-2-llm-wiki.md#p1-remediation--固定-vault-路径保留2026-09-20)。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 2 LLM Wiki V1 + Markdown/Obsidian Projection：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。从 fetch 后精确 `origin/main @ 1d883414fe7828b682c8cd888223ccf7bd729834` 创建 `codex/stage-4-3-slice-2-llm-wiki-obsidian`。L2 Entry/append-only Revision/Review、historical Current、exact refs/trace、search/backlinks/orphans、Local-first Wiki JSON backup/recovery、`#/memory` 三视图与单向可重建 Vault 已实现；Markdown 不是真源，AI origin 不升级。70 Wiki 专项 / 1128 全量 Vitest、build、contracts、F3、261 Local Core tests、90 browser checks PASS。F3 actual service 仍 0/33，admission 不提升。Hosted CI NOT_RUN；本切片普通 commit/push 后停止等待独立审计，不创建 PR/merge/部署。[D0、验证及真实限制](stage-4-3-slice-2-llm-wiki.md)。

> Slice 2 初始交付及下方较早记录保留原时点；本次 CURRENT 状态以顶部 Slice 2.5 条目为准。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 1 Source + Extraction 正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 / Slice 2 — LLM Wiki V1 + Markdown/Obsidian Projection 进入 CURRENT PLAN / NOT_IMPLEMENTED。** Slice 1 初审 HEAD `b5b548a2e6308a2603d6603fbd0afca315cb1727` 为 P0=0/P1=1；第三方作者归因修复 HEAD `a716b2205d3056e99198852224bf56ad71026a36` 最终复审 PASS（P0=0/P1=0）；PR [#69](https://github.com/lwd619783-byte/-/pull/69) exact-head CI [35512099983](https://github.com/lwd619783-byte/-/actions/runs/35512099983) completed/success；merge/main `f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`，main push CI [35512366207](https://github.com/lwd619783-byte/-/actions/runs/35512366207) completed/success；Vercel Production `dpl_CmeXXfaEqc2BwXBBnuByMcZb7DNE` READY。Production 只表示应用部署成功，不提升 Provider/Data admission 或 strict PIT。Slice 2 冻结为“结构化 Wiki Domain 真源 → deterministic Markdown projection → Obsidian-compatible read-only Vault”；Obsidian 不成为数据库，生成 Markdown 不形成第二真源。详见 [Slice 2 冻结方案](stage-4-3-slice-2-llm-wiki.md)。

> 2026-09-20 CURRENT — **Stage 4.2.5 Creator Viewpoint Tracker V1 已正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 / Slice 1 Source + Extraction 已 IMPLEMENTED / VERIFIED LOCALLY / INDEPENDENT REVIEW PASS / PENDING PR-HOSTED CI；L2–L5 仍未实现。** Stage 4.2.5 独立审计最终 HEAD `025352f5bb7879ce6e1e2130fb9cd43788409928`（P0=0 / P1=0）；PR [#67](https://github.com/lwd619783-byte/-/pull/67) exact-head CI [35489459196](https://github.com/lwd619783-byte/-/actions/runs/35489459196) completed/success；merge/main `2cea477105d3e63242e65b7f3eec0b658a87ce17`，main push CI [35489619887](https://github.com/lwd619783-byte/-/actions/runs/35489619887) completed/success；Vercel Production `dpl_ExmoiCEYa2EXRfmuqnRxEAE5AfrE` READY。Production deployment 不提升 Provider/Data admission。Stage 4.3 最新冻结路线为 `L0 Raw Source/Evidence → L1 Structured Extraction → L2 Reviewed Research Memory/LLM Wiki → L3 Verified Claim → L4 Thesis → L5 Investment Expression`，Schema / Entity Identity / Provenance / PIT-asOf / Revision / Verification / Audit 贯穿全链；详见 [Stage 4.3 冻结方案](stage-4-3-research-memory-wiki-thesis-plan.md)。

> 下方 Stage 4.2.5 功能分支验证与更早记录保留其时点意义；当前执行主线为 Stage 4.3 / Slice 1；第三方作者误归因 P1 已定向修复并通过最终针对性复审（P0=0 / P1=0），下一门禁为 PR / exact-head Hosted CI。

## CURRENT — Stage 4.3-R3 Investment Expression + Closeout

默认 External Knowledge Lane：Google Drive L0 → ChatGPT AI draft → Notion L2 Wiki。
OS Research Decision Lane：Provider / official Evidence / Creator structured owner → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression → Stage 4.4。

| 顺序 | 交付与状态 |
| --- | --- |
| 历史 Slice 1 | CLOSED；公共 Source/Extraction、Creator adapter 继续 KEEP |
| 历史 Slice 2 / 2.5 | 代码 MERGED / MAIN CI PASS；Local Wiki / backup / Obsidian / BrowserSource / parser / read-only Bridge / Wiki UI 转 FREEZE / LEGACY COMPATIBILITY；真人验收缺口保留 |
| R0（CLOSED） | 双通道 authority；PR #74 / main CI PASS，冻结边界继续有效 |
| R1（CLOSED） | Verified Claim V1；PR #75 / PR-main CI PASS / Production READY；真实仍 5/0/0 |
| R2（CLOSED） | Thesis V1 + Macro → Industry；PR #76 / PR-main CI PASS / Production READY |
| R3（CURRENT） | Investment Expression V1 + Closeout；IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT |

旧 Slice 3“Creator → Wiki + 三位真实博主”不再独立实施；Creator 保留 OS owner，长期 Wiki 交外部 Notion。旧 Slice 4–6 未实现范围由 R1–R3 承接，历史编号不改。R0 不接 Notion/Drive API、不存外部正文、不开发 Claim/Thesis/Expression、不修改 4.4；Stage 4.5 改为 OS Domain MCP，原 Bridge 仅 transitional/fallback，真实替代迁移通过前不退役。

**CURRENT STOP：R3 普通 commit/push 后等待 ChatGPT 独立审计；不创建 PR、merge、修改 main 或部署 Production。** [R0 正式决定与 Git/CI 证据](stage-4-3-r0-external-knowledge-rebaseline.md)。

> 2026-09-19 CURRENT · Stage 4.2.5 独立审计修复：Creator 发布时间与本地 knowledge/audit 时间分离；历史回填不回退 Current View，T+ 使用来源锚点，未到期 completed/inconclusive 均拒绝。增加 exact corrupt bytes 保留、完整备份校验、显式确认和 reload 的受控灾难恢复；future schema 继续锁定。外部事件 verified 仅表示来源核对。124 项受影响测试、全量 997 tests / 80 files、build、321 browser checks、JSON recovery round-trip、Excel 独立读取 PASS；PENDING TARGETED RE-REVIEW，Hosted CI NOT_RUN。路线保持 Stage 4.2 CLOSED → Stage 4.2.5 CURRENT → Stage 4.3 NEXT。[当前语义与限制](stage-4-2-5-creator-viewpoint-tracker.md#独立审计修复与针对性复审2026-09-19)。

> 下方初始交付与更早记录保留原时点；本轮修复状态以上述条目为准。

> 2026-09-19 CURRENT — **Stage 4.2 CLOSED → Stage 4.2.5 Creator Viewpoint Tracker V1 CURRENT → Stage 4.3 NEXT**。本专项新增外部观点记录、独立 Topic 状态历史、人工审核/复盘、四视图 Workspace、JSON 完整恢复和 Excel 分析副本；Current View/Transition/到期项均为已审核历史投影。复用 ResearchEvent 公共 owner、Evidence Drawer、Workspace 导航和 PersistedBaseGuard；不接 SQLite/云，不提前实现 Claim/Thesis。精确开发基线 `8860c943919f90daa125934fde0f385707ea7028`。本地 959 tests / build / 287 browser checks / JSON round-trip / Excel 独立读取 PASS；IMPLEMENTED / VERIFIED LOCALLY。真实样本旧状态与明确失效条件仍未证明，未伪造转换。完整交付与限制见 [Stage 4.2.5 当前方案与交付](stage-4-2-5-creator-viewpoint-tracker.md)。独立审计 PENDING，Hosted CI NOT_RUN；仅功能分支普通 commit/push，不创建 PR/merge/部署。

> 以下 Stage 4.2 closeout 及更早 CURRENT 条目保留其记录时点；本轮顺序以上述 Stage 4.2.5 增量为准。

> 2026-09-19 CURRENT — **Stage 4.2 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。Slice 6 独立审计通过；最终 PR head `8cc62168681719e1eedfe3b1974f5b35844df2cb`，PR [#64](https://github.com/lwd619783-byte/-/pull/64) Hosted CI [35447795829](https://github.com/lwd619783-byte/-/actions/runs/35447795829) completed/success；merge/main `05ffb33ce4edee81f174253ccbad4ee697ed974a`，main push CI [35448015019](https://github.com/lwd619783-byte/-/actions/runs/35448015019) completed/success。Stage 4.2 以 Registry/Provider → Dimensions/Snapshot → descriptive Derived Signal/Claim Candidate → F2 evidence chain → Prosperity Eligibility/ABSTAIN 收口；DATA / PRODUCTION admission、严格 PIT、正式景气 score/direction、Verified Claim/Thesis 均未提升。CURRENT 主开发线进入 **Stage 4.3 — Top-down Research Workflow**。

> Slice 5 CURRENT 事实补齐（本次实时核验）：PR [#63](https://github.com/lwd619783-byte/-/pull/63) 已合入，PR branch head `dfc54f1d0437774387869e75696681a5791082cb`，merge/main `dc8f5ec36d9626e92acc3fc91088c1b8c42ce753`。PR CI [35442595473](https://github.com/lwd619783-byte/-/actions/runs/35442595473) 与 main CI [35442791153](https://github.com/lwd619783-byte/-/actions/runs/35442791153) 均 completed/success。此事实只适用于 Slice 5；以下较早交付状态保留其时点意义。

> 2026-09-18 CURRENT — Stage 4.2 Slice 5：**D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。独立版本化 exact dimension mapping + 多因子只读快照；新增 EIA 原油产量/出口/炼厂净投入 3 owners，总计 6 owners，oil-shipping 覆盖 supply/demand/trade_flow/inventory 四维，robotics 原双 owner 保持。原 21 文件字节与 3 Registry pins/entries 不变。8 Python / 63 Node / 87 Industry Vitest、全量887 tests、6-owner replay、build、contracts、1038 browser checks PASS；data audit 0 errors / 34 非阻断 warnings。PIT/Entity/F1/F2/F3/admission 不提升；不生成新 delta/score/trend/Claim/Thesis。只普通 commit/push 后停止；本切片 Hosted CI NOT_RUN，独立审计 PENDING。[冻结方案与实测证据](stage-4-2-slice-5-plan.md)。

> 2026-09-18 CURRENT 基线核验：PR [#62](https://github.com/lwd619783-byte/-/pull/62) 已 MERGED；main `8497ac9199def1fbec420eecc6ad7b7305ce160d`，PR CI [35335279897](https://github.com/lwd619783-byte/-/actions/runs/35335279897) / main CI [35335680417](https://github.com/lwd619783-byte/-/actions/runs/35335680417) completed/success。Vercel Production deployment `6522548855`（同一 main SHA）success / READY，核验于本轮；中文化切片与 Slice 4 均已合入。以下旧交付段落保留原时点，准入/PIT/F1/F3 不提升。当前 Slice 5 仅 Metric → Dimension → Multi-factor Snapshot，冻结方案见 [Slice 5](stage-4-2-slice-5-plan.md)，不授权 Prosperity/Regime/Claim/Thesis。

> 2026-09-18 中文化审计修复增量：从 `2fd51dba9b42fc99f7bf2b3415f5c831727edbec` 修复 Industry Change / Inbox / 证据摘要的 EIA 标题展示，以及复盘任务 pending 的“待处理”上下文翻译；全局 pending 仍为“待核验”，原始事件标题与任务状态不变。相关36 tests、全量875 tests、build PASS；PENDING INDEPENDENT RE-REVIEW。仅原分支普通 commit/push，不建 PR、不 merge。[记录](chinese-ui-evidence-display-2026-09-18.md#独立审计修复增量)。

> 2026-09-18 CURRENT — 中文化与证据展示降噪：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。精确基线 `01b246a25bbe304ceb9c121e92eb91bedbdcf478`；仅显示层中文标签、证据摘要与默认折叠高级审计信息。Evidence / Chart Audit / Inbox / Industry / 产业链及首页、宏观、个股、预期主要文案已同步；原始审计字段完整保留。869 Vitest、8 Industry Python、35 Industry Node、73 Industry Vitest、build、三主题三尺寸508 browser checks PASS。Provider / Registry / Contract / PIT / Evidence owner / pins / 原始数据无差异；准入不提升。本分支普通 commit/push 后停止，不创建 PR/merge；本切片 Hosted CI 未核验。[交付记录](chinese-ui-evidence-display-2026-09-18.md)。

> 2026-09-18 基线事实补齐：Stage 4.2 Slice 4（含 CLI P1 修复）已通过 PR [#61](https://github.com/lwd619783-byte/-/pull/61) 合入；merge/main `01b246a25bbe304ceb9c121e92eb91bedbdcf478`，main CI [35332262999](https://github.com/lwd619783-byte/-/actions/runs/35332262999) completed/success，本轮实时核验。该基线为 **MERGED / MAIN CI PASS**；下方原交付记录保留其时点状态，DATA/PRODUCTION/PIT/F1/F3 不提升。

> Slice 4 P1 CLI 兼容修复（2026-09-18）：无 `--metric` 恢复历史 NBS output 默认目标；显式 EIA / 未知目标仍按 exact Registry 处理，adapter dispatch 不变。仅 CLI、回归测试及状态补充，retained data / owners / pins / PIT / admission 无变化；等待独立复审。[修复记录](stage-4-2-slice-4.md#p1-remediation--public-build-cli-compatibility-2026-09-18)。

> 2026-09-18 CURRENT — Stage 4.2 / Slice 4：**D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。从 fetch 后精确基线 `2f2d707b8b222392a969327f10f9d5af5f021eab` 实施；EIA `WCESTUS1` 官方周末商业原油库存接入既有 `oil-shipping`，11/11 声明窗口读数；3 metric owners / 2 source families，显式 fail-closed Source Adapter 分派。EIA 1 Signal / 1 Event 复用 Inbox/Evidence；未知发布时间只在 Inbox 全部日期中出现。NBS 两个 owner 的原始/生成数据与 pins 未变。865 full tests、32 Node replay tests、73 Industry Vitest、8 freshness tests、build、data audit（0 errors；28 非阻断 warnings）、EIA 169 + NBS 277 browser checks PASS。DATA/PRODUCTION NOT_ADMITTED、PIT/revision unknown、F1 NOT_READY、F3 未提升。仅普通 commit/push，不创建 PR/merge；Hosted CI NOT_RUN，push 后停止等待独立审计。[交付与可重放证据](stage-4-2-slice-4.md)。

> 2026-09-18 Stage 4.2 / Slice 3 CLOSED：独立审计最终 HEAD `910d66dff14b6c32da7aea07174dccaf97494a2c`；PR #59 Hosted CI `35318164694` completed/success；merge/main `6a9aa233b4351938b39c247833d9e72d99854269`；main push CI `35320061290` completed/success；Vercel production READY。正式登记为 **CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。保留 Company Guidance cross-epoch P2，Industry DATA/PRODUCTION、PIT/F1/F3、财务/公告默认 refresh admission 未提升。下一主线进入 **Stage 4.2 / Slice 4 — Cross-source Industry Provider Proof**，见 [Slice 3 closeout](stage-4-2-slice-3-closeout.md) 与 [Slice 4 plan](stage-4-2-slice-4-plan.md)。

> 2026-09-18 细分关系增量 CURRENT：机器人产业链按主要功能展示7个唯一细分（上4/中1/下1/横向1），移除阶段箭头，新增6条源自既有研究原文的细分功能连线；能力迁移为虚线，不表示公司供货事实。公司跨阶段原文保留，明细默认折叠。数据/Provider/PIT/cohort57/准入无变化。854 tests、build、三主题三尺寸331 browser checks PASS；[关系图与证据](stage-4-2-slice-3.md)。IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW；普通push后核验exact Preview，不建PR/merge。

> 2026-09-18 UI反馈增量（历史 b626be6）：产业链默认只显示上中下游、细分方向与阶段衔接；公司/覆盖率/Provider明细均点击节点展开，覆盖下面a0c1f64版默认展示细节的要求。原topology、数据、cohort57与准入不变。22项相关tests、build、三主题三尺寸298 browser checks PASS；[简图与证据](stage-4-2-slice-3.md)。普通push后等待独立审阅。

> 2026-09-18 Slice 3 final remediation CURRENT：**IMPLEMENTED / VERIFIED LOCALLY / PENDING THIRD INDEPENDENT REVIEW**。审计输入 `a1a4be2`、main仍`086521d`。产业链改为Architecture Canvas：3彩色Stage Groups → 10 Segment Nodes（7unique）→二级公司标签/完整展开数据，用户参考图仅供视觉方向；原topology和12家unresolved不变。Unitree保留688836.SH/A股/科创板。Stability单一受控cohort57与current generated universe精确核验，57/57候选可通过、56/57/extra/foreign拒绝，全部稳定阈值不变；0观察日导致默认refresh eligibility仍BLOCKED，不提升admission。261 observability、851 full tests、build、277 browser checks本地PASS；真实数据全部无diff，Guidance cross-epoch P2保留。普通push后核验exact Vercel SHA，停止等待第三次独立审计，不建PR/merge。[完整记录](stage-4-2-slice-3.md)、[delta](stage-4-2-slice-3-freshness.md)。

> 2026-09-18 Stage 4.2 / Slice 3：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。精确基线 `086521d6bd305ea73cb5d4a426b9d4138e4a824b`；分支 `codex/stage-4-2-slice-3-industry-events-chain-diagram`。非破坏式 NBS freshness probe、真实公司刷新验证、2 个 Derived Signal / 1 个 Industry Change Event / 4 项读数、原 Inbox 与 Industry 页、既有研究结构产业链图。NBS 最新仍为 2026-08，无新 capture；NOT_ADMITTED / F1 NOT_READY / F3 actual service 0/33 保持。交付与实际 freshness delta 见 [Slice 3](stage-4-2-slice-3.md)。本轮只普通 push，等待独立审计，不创建 PR / merge。

> 2026-09-18 Slice 2 CURRENT 事实补齐：PR [#58](https://github.com/lwd619783-byte/-/pull/58) 已合入；merge/main `086521d6bd305ea73cb5d4a426b9d4138e4a824b`。PR CI [35299972640](https://github.com/lwd619783-byte/-/actions/runs/35299972640) 与 main CI [35300272837](https://github.com/lwd619783-byte/-/actions/runs/35300272837) 均 completed/success，本轮已实时核验。Slice 2 Registry / 双 metric 为 **MERGED / MAIN CI PASS**，不代表生产准入；原 Slice 2 文档保留交付时点证据。

> Slice 1 已按 [closeout](stage-4-2-slice-1-closeout.md) 关闭：PR #56、merge/main `c664021d02a45aac79c1272d4c42f6061d3fbbf2`，PR CI `35230502534`、main CI `35230848333` completed/success，独立复审 PASS。此处补齐已发生的 CURRENT 状态；不改写原审计时点记录。

> 2026-09-17 CURRENT：Stage 4.1B 已完成计划产品化收口，正式登记为 **CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。Slice 3 最终独立审计 HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`；PR #54 Hosted CI `35207107183` completed/success；merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`；main push CI `35207381240` completed/success。F3 `test:research-eval` 与 `research:eval:check` 两个 direct gates 已在 PR/main Hosted CI 实际通过；Frozen V1 33-case 不变，reference 33/33 PASS（REFERENCE_ONLY），actual service 0/33、NOT_IMPLEMENTED 33/33。PRODUCTION / DATA ADMISSION 未提升。CURRENT 主开发线进入 **Stage 4.2 — Industry Data Platform**；未闭合单指标、Provider、PBC/CSRC/all-A admission、normalization/backtest 继续并行数据支线。详见 [Slice 3 closeout](stage-4-1b-slice-3.md)。

> 2026-09-17 Slice 2 合入记录：Stage 4.1B / Slice 2 — Auditable Chart V1 + Product Shell V1 已完成独立审计、PR #52、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**；audited HEAD `88f97a56d44c3d512c00444f650000d60af89e40`，merge/main `753073912356de00504ba97c221c7ac1b7c8b81d`，PR CI `35201231930` 与 main push CI `35201547659` 均 completed/success。PRODUCTION / DATA ADMISSION 未因本切片提升；严格 PIT、正式 `releaseAvailableAt`、report revision continuity、Evidence Graph closure 与 chart exact Evidence linkage 仍未证明。该段保留 Slice 2 收口时点记录。

> 2026-09-16 Slice 1 合入记录：Stage 4.1B / Slice 1 — Research Inbox + Evidence Drawer V1 已完成独立审计、PR #50、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**；audited HEAD `3a94f1c78cdea95481e49ba77ae8464cc3c6b37c`，merge/main `38ffcbd44ecd2c4531b6ef737d4c6616ec197ca8`，PR CI `35071221955` 与 main push CI `35071457928` 均 completed/success。PRODUCTION / DATA ADMISSION 未因本切片提升；该段保留 Slice 1 收口时点记录。

> 2026-09-14 CURRENT 历史记录：Stage 4.1-G 已完成独立审计、PR #48、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**；DATA / PRODUCTION 仍 NOT_ADMITTED。当前主开发线转入 **Stage 4.1B Research Inbox / Evidence Surface / Product Shell**。以下 2026-09-12 记录保留 Stage F 合入时点意义。

> CURRENT 战略路线入口：[`current-development-direction-2026-09-13.md`](current-development-direction-2026-09-13.md) 是最新增量事实源；[2026-09-11 rebaseline](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md) 作为其下层长期基线，继续提供未被覆盖的跨域架构与同步规则。本文负责 CURRENT 开发进展、停止点与已发生交付事实。

> UI V1.0 设计入口：[NEON-RC1-20260909 获批事实源](ui-redesign/v1/README.md)与[D0–D5 执行索引](ui-redesign/v1/execution-index.md)。2026-09-09 APPROVED / FROZEN；D0 仅文档归档，D1–D5 未派发，不表示 UI 已实现或业务准入。

本索引固化当前任务顺序，不重写历史审计结论，也不重命名已有 Phase 编号。产品保持**单用户 Local-first、全球研究视角**，继续复用已有证据、PIT、Provider Stability 与审计基础。全球视角不等于已覆盖全球行情。

> CURRENT 更新：2026-09-12。已核对 `origin/main @ fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`。Financial Research Foundations V1 已由 PR #43 合入；Stage 4.1-F 已由 PR #45 合入：audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac`，PR CI run `34673260311` completed/success，main push CI run `34673371463` completed/success。固定 SHA 仅代表本次记录时点，不是永久 CURRENT main。下表既有 Phase 的 SHA/CI 是相应关闭时点证据；R2 以 Git ancestry、当前代码、committed artifacts、专项验证与对应 PR 事实登记。
> PR、merge 与 CI 必须分别按真实状态登记；静态 CURRENT 文档不预写 MAIN MERGED，也不自证 CI PASS。

## Stage 4.1B / Slice 3 当前交付（2026-09-17 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；Stage 4.1B CLOSED；PRODUCTION / DATA ADMISSION 未提升。** 统一 Node/offline Harness、审核 target registry、严格 Result schema、结构化 exact/set diff 与确定性 eval artifact 已实现；真实服务覆盖保持 0/33，禁止 oracle fallback、expected/caseId 泄露和 reference wrapper 冒充服务；future MCP/Agent 仍须通过审核 adapter 接入同一 seam。最终独立审计锁定 HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`；PR #54 Hosted CI `35207107183` completed/success；merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`；main push CI `35207381240` completed/success。两个 F3 direct gates 在 PR/main Hosted CI 均 success；45 focused、788 全量应用 tests、contracts、discovery、data audit、build 与 report replay 均由对应本地/Hosted 证据覆盖。旧 browser 证据保留原验证时点；CI remediation 未重跑视觉验收。Slice 1/2、Frozen V1 与现有 Stage F/G 不回归。closeout acceptance 与剩余 NOT_IMPLEMENTED 见 [Slice 3](stage-4-1b-slice-3.md)。

## Stage 4.1B / Slice 2 当前交付（2026-09-17 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION / DATA ADMISSION 未提升。** 本轮交付两类 Auditable Chart（价格历史、财务历史）和首页/公司 Product Shell；保留 owner 数据身份、时间语义、unknown 证明与质量降级。原公司/章节/事件深链、Evidence Drawer 和研究工作流继续复用。独立审计锁定 HEAD `88f97a56d44c3d512c00444f650000d60af89e40`；PR #52 Hosted CI `35201231930` completed/success；merge/main `753073912356de00504ba97c221c7ac1b7c8b81d`；main push CI `35201547659` completed/success。严格 PIT、正式 `releaseAvailableAt`、report revision continuity、Evidence Graph closure 与 chart exact Evidence linkage 仍未证明；价格/财务 owner 的 data/production admission 仍 unknown，既有 NOT_ADMITTED/BLOCKED 状态不变。详情与验证见 [Slice 2](stage-4-1b-slice-2.md)。

## Stage 4.1B / Slice 1 当前交付（2026-09-16 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION / DATA ADMISSION 未提升。** 原实现基线 `origin/main @ 2829776f8ef4b7bcbf744c8edb37410bbd6ec67a`；实现分支 `codex/stage-4-1b-research-inbox-evidence-v1`；独立审计 HEAD `3a94f1c78cdea95481e49ba77ae8464cc3c6b37c`。

首页 Inbox → 共享 Evidence Drawer → 精确公司/事件或已有 ReviewFormModal/Store 已接线；projection 仅复用 owner，确定性排序/去重、历史日期窗口、缺证据与质量状态不提升准入。详见 [设计与验证](stage-4-1b-slice-1.md)。本次仅 Slice 1；Auditable Chart、F2 runtime、Claim/Thesis、评分和 F3 service harness 未实施。

独立审计 PASS（P0=0 / P1=0 / P2=0）；PR #50 以精确 audited HEAD 合入，PR CI run `35071221955` completed/success；merge/main `38ffcbd44ecd2c4531b6ef737d4c6616ec197ca8`；main push CI run `35071457928` completed/success。严格 PIT、正式 releaseAvailableAt、production/data admission、revision continuity 与 F2 Evidence Graph closure 仍保持未证明 / 未提供。

## 冻结顺序与停止点

| 顺序 | 实现与验证门槛 | 独立审查 / 合入门槛 | 当前状态与停止点 |
| --- | --- | --- | --- |
| 独立 P0 可信展示纠偏 V1 | 移除条数评分和方向结论；source identity、quality status、value coverage、data time / freshness 分离；固定时钟边界及组件交互测试；环境检查、tests、data audit、build、UI 静态审计和浏览器验证，逐项记录限制 | 普通 push 后独立远端审查最终 HEAD；审查通过并获授权后才创建 PR，检查该 HEAD 的 CI，再决定合入 | 已合并并通过 main CI；本次核对 main 快照为 `285ff87e8d109730956517edcaeadec501d79f4c` |
| Phase 1A — Local Core Foundation | 按[实施基线](investment-dashboard-v2-phase-1a-local-core-foundation.md)落实合同校验、SQLite、Entity Registry / Resolver、append-only Audit、Repository / Domain 基础；通过专项与原有门禁 | 独立审查权限、事务、时间、历史与 bundle 边界；获授权后 PR / 精确 HEAD CI / 合入 | **CLOSED / MERGED / MAIN CI PASS**；合并快照 `41b3caa5e063805ec0ca42efc9c74ea17491ffc4`，对应 [main CI 34115340100](https://github.com/lwd619783-byte/-/actions/runs/34115340100) 已核对 completed/success；旧实施验证记录保留原时点结论 |
| Phase 1A.5 — Agent Skills Consolidation | 正式 [Skill Registry / Router](agent-skills.md)、固定上游审计、项目 Domain / Local Core / minimalism Skills、只读 check 和隔离 fixture 验证；Impeccable facade / vendor、LICENSE、副本写入三项修复已获用户确认独立复审通过 | 已完成 PR / 合并与 main CI 核验；历史验证文件保留 PR 前登记节点 | **CLOSED / MERGED / MAIN CI PASS**；合并快照 `87d33595a49dc99463333ad4637b44b7e33f68a9`，本轮核对 [main CI 34125472101](https://github.com/lwd619783-byte/-/actions/runs/34125472101) 为 completed/success，headSha 与合并快照一致 |
| Phase 1B — Long-term Account & DCA Core | 复用 Phase 1A Local Core，完成 Account / Asset / Transaction / CashFlow / PositionSnapshot、DCA revision / execution、导入、确认、幂等与 Audit；按已合入合同完成 CB-1 / CB-2 / CB-3 implementation alignment | 独立终局审计通过；[PR #24](https://github.com/lwd619783-byte/-/pull/24) 以 audited HEAD `9633130b772e8571bfd130c2b35317f2da1183b3` 合入，PR CI [34170387749](https://github.com/lwd619783-byte/-/actions/runs/34170387749) 与 main CI [34173206443](https://github.com/lwd619783-byte/-/actions/runs/34173206443) 均 completed/success | **CLOSED / MERGED / MAIN CI PASS**；merge/main `2230265e727f0f2787de9e82d509f0c1d3a6230a`；[实现对齐验证](investment-dashboard-v2-phase-1b-implementation-alignment-validation.md)、[原实施与合同阻塞记录](investment-dashboard-v2-phase-1b-implementation-validation.md)、[历史修复验证](investment-dashboard-v2-phase-1b-review-fixes-validation.md)继续保留各自记录时点的结论 |
| Phase 1B Contract Clarification V1 | [合同澄清](investment-dashboard-v2-phase-1b-contract-clarification-v1.md)，审计提交 `829bae54`，PR #23 合并快照 `de77ad872` | 合同独立审计、PR CI 与 main CI 已通过；CB-1 / CB-2 / CB-3 随后由 Phase 1B implementation alignment 消费 | **CLOSED / MERGED / MAIN CI PASS**；本行只登记 contract-definition 交付，后续业务实现关闭状态见 Phase 1B 行；历史合同与实现记录均保留 |

验证失败或工具阻塞须标明原因与受影响验收项；安全改动可推送待审查，但不得称验收通过。测试通过、独立审查、合入与生产准入是不同状态，任何一步不自动授权下一步。

## 后续共用边界

- 后续研究入库、行业 / Wiki、多 Agent 成果共用统一实体、版本、审计与 **prepare-plan-confirm-commit**，不建立平行系统。
- Phase 1A 已落实 **provider identifier 精确匹配**与 **resolver 合同输入**的内部 seam；后续继续复用当前代码与[实施验证中的合同边界](investment-dashboard-v2-phase-1a-implementation-validation.md)，不擅改 `contracts/v1`。
- Phase 1B 已关闭，但只完成 Node-only Local Core；没有由此获得 Portfolio UI / Exposure、Research Bridge、可信来源 adapter、OCR、真实历史迁移或 cloud business database 的实现与准入。
- [Local-first 冻结决定](investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md)覆盖旧云端业务数据库假设；[Master Plan](investment-dashboard-master-plan-2026-09.md)中的 Stage 4 顺序保留为历史基线。
- Phase 1B 后的 CURRENT 战略顺序以[2026-09-13 Development Direction](current-development-direction-2026-09-13.md)为最新增量事实源，其下层长期基线为[Financial Research OS 重基线](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md)；业务语义与准入仍由冻结合同、Feature Registry、Architecture 和专项审计决定。
- Stage 4.1 R2 已进入逐源实现 / 准入未闭合阶段，不再是整体 NOT_STARTED；不得因为代码或证据闭环任务已合并就自动提升生产准入。Stage 4.1 主产品线已经关闭，R2 未闭合项以后按并行数据支线管理。

## Stage 4.1 R2 与当前停止点

| 切片 | 已合入事实 | 当前数据 / 执行状态 |
| --- | --- | --- |
| Scope Freeze / R2-A | PR #26 / #27 | IMPLEMENTED / VERIFIED（离线 CORE）；不是全部历史数据准入 |
| R2-B PBC | PR #28 | IMPLEMENTED / VERIFIED；数据 PARTIAL；既有 committed evidence 继续按专项报告解释 |
| CSRC C1 / C1.1 | PR #30 / #31 | IMPLEMENTED / VERIFIED；历史缺口与 field readiness 继续按专项报告解释 |
| CSRC C2A1 / C2A2 | PR #32 / #33 | IMPLEMENTED / VERIFIED；NOT_ADMITTED；不得把 definition-compatible candidate 提升为正式 PIT observation |
| SSE / SZSE / BSE D1 | PR #34 / #35 / #36 | IMPLEMENTED / VERIFIED；三所历史数值准入继续受 definition / calendar / release provenance 约束 |
| all-A D2 | PR #37 | IMPLEMENTED / VERIFIED；原 D2 记录保持其时点状态，不由后续工作回写 |
| R2-E Integrated / all-A D3 | PR #42，merge `087c52a7962ed08c3f550d79987e0282be5607cf` | **MERGED / NOT_ADMITTED**；已补官方 calendar/denominator evidence、release/PIT evidence、exchange field-era verification、expanded candidate observations 与 D3 rerun；完整 denominator/targetCount 在官方完整交易时段枚举未证明时仍保持未知，缺少充分 release provenance 的 candidate 不进入 formal/strict-PIT observation |
| normalization / backtest / formula admission / Market Regime UI | 无因 PR #42 自动获得的正式准入 | 仍须依据当前正式 admission / blocker 状态单独冻结与验收；不得从 evidence closure 直接跳到伪评分 UI |
| cloud business database / cross-device sync | Local-first freeze | DEFERRED |

`IMPLEMENTED / VERIFIED`、`MERGED` 与 `PRODUCTION ADMITTED` 是不同状态。R2 后继工作必须围绕仍未闭合的 source / definition / calendar / release / denominator 等真实 blocker 决定是否可以进入 normalization / backtest，不因路线重基线降低门槛。

## Financial Research OS 跨域重基线

从 2026-09-11 起，后续 Stage 4 在不改变既有编号主线的前提下增加三项 cross-cutting foundation：

| Foundation | 目的 | 当前状态 | 首次主要消费阶段 |
| --- | --- | --- | --- |
| F1 Financial Semantic Registry V2 | 统一 metric / entity / unit / temporal / lineage / quality / allowed-use 语义；复用既有 Data Source Registry 与领域 Metric Registry，不建立第二套同义 Registry | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；Stage 4.1-F Macro runtime IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS | Stage 4.1 / 4.2 |
| F2 Evidence Graph V1 | 统一 Source → Artifact → Evidence → Fact → Derived Metric → Claim → Thesis → Position → Review 的引用关系；不预设 Graph DB | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；runtime：Slice 6 Industry candidate read-only subset；通用跨域准入未实施 | Stage 4.1B / 4.3 |
| F3 Investment Research Eval Suite V1 | 用 Golden Cases 验证 PIT、检索、计算、Evidence、Claim 与未来 Agent tool use | 合同已合入；Harness IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；reference 33/33 PASS，actual service 0/33、NOT_IMPLEMENTED 33/33；真实 Agent runtime NOT_IMPLEMENTED | Stage 4.1B 起持续扩展 |

本轮 [F1/F2/F3 Scope Freeze](financial-research-foundations-contract-v1.md) 新增独立版本化合同包与八类 33 个 synthetic Golden Cases，保留 `contracts/v1` 的原 schema / 权限 / Local Core runtime registry。独立审计在 remediation 后 PASS；PR #43 以 audited HEAD `204176924b23ed5c1d480203d284c0b01a28f966` 合入，PR CI run `34621319869` completed/success，merge/main `4ad9ec286a6cb73485ebf0e88a28837c0ae8b3c0`，main push CI run `34621558359` completed/success。Stage 4.1-F 经独立审计 PASS 后由 PR #45 以 audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac` 合入，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`，PR CI run `34673260311` 与 main push CI run `34673371463` 均 completed/success。Stage 4.1B Slice 3 Harness 由 PR #54 以 audited HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea` 合入，merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`，PR CI `35207107183` 与 main CI `35207381240` 均 completed/success。production/data 仍 NOT_ADMITTED；Entity Registry mapping、完整 RAW_SOURCE replay 与 R2 source blockers 仍未闭合。

依据 [2026-09-13 最新增量方向](current-development-direction-2026-09-13.md)，CURRENT 战略顺序为：

1. **Stage 4.1-G — CLOSED / MERGED / MAIN CI PASS**：独立审计 HEAD `5489e3f77e284c69d492cfccb7242e2bd9e504d8`；PR #48 CI `34820778498` completed/success；merge/main `f1b85a28dbe83a1ae7875f0b7a80d8b56e25b123`；main push CI `34821083781` completed/success。数据 / production admission 仍未提升。未闭合的单指标、Provider、历史覆盖率及 normalization/backtest 等任务转为并行数据支线；仅当满足最新方向 §1.1 的主线正确性/安全阻断条件时重新评估。
2. **Stage 4.1B — CLOSED / MERGED / MAIN CI PASS**：Slice 1 PR #50、Slice 2 PR #52、Slice 3 PR #54 均已完成独立审计、PR/main CI 与合并。最终 Slice 3 audited HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`，merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`。Research Inbox / Evidence Drawer / Auditable Chart / Product Shell / F3 Eval Harness 均已进入 main；production/data admission 未因此提升。
3. **Stage 4.2 — CLOSED：Industry Data Platform**：Slice 1–6 已合入并通过独立审计、PR CI 与 main CI。已具备 Registry/Provider、Dimensions/Snapshot、描述型派生、事实性候选、F2 引用链与 Prosperity Eligibility/ABSTAIN；正式 score/direction、Verified Claim/Thesis 仍 deferred，数据准入未提升。
4. **Stage 4.3 — External Knowledge + Research Decision**：R0 → R1 Verified Claim → R2 Thesis → R3 Investment Expression；外部知识与 OS 决策 authority 分离。
5. **Stage 4.4 — Portfolio Exposure MVP**：复用 Phase 1B Local Core，补 thesis ↔ position、macro / industry exposure、target allocation、rebalance、read model / UI。
6. **Stage 4.5 — OS Domain MCP / Controlled Tool Layer**：Creator context / Evidence / Verified Claim / Thesis / Investment Expression；prepare/preview/confirm/commit；Local-first、Auth/scope/Audit；不默认代理 Notion/Drive，旧 Bridge 保留 fallback。
7. **Stage 4.6+ — Research Agent / Artifact / Global Coverage**

明确暂缓：cloud business database 全迁移、常驻 multi-agent 集群、强制 Graph DB、所有数据 Vector 化、企业 SSO/RBAC、自动交易、未授权商业数据抓取。

## P0 展示口径与待办

- 宏观按展示条目计覆盖（重复指标未去重），来源标识与质量状态分别保留原值；没有正式模型时不输出 0—100 方向分。月 / 季度报告期不补发布时间，含糊的来源日期标为语义待核验。
- 已核对 A / H 股生成脚本：行情 `updatedAt` 是采集运行时间；不替代市场观测时间。24 小时只划分采集时间窗口，不是统一失效规则；旧值可继续作为历史快照查看。
- 缺失、非法、未来时间不算正常新鲜；汇总保留完整分母。来源标识、质量状态、价格覆盖与时间/时效分别展示；status=real 的计数仅表示质量状态，不代表来源真实性。当前未实现可靠交易日历或逐指标发布规则，故时效保守标为待核验。
- Mock 数据包时间为空；非 Mock 的 manifest.updatedAt 仅显示“数据包更新时间”，不代表行情采集时间或所有模块同步刷新。
- 本轮[验证记录及基线阻塞](p0-data-trust-display-v1-validation.md)单独列明；远端提交状态见任务交付记录。独立审查须核对最终 diff、测试、浏览器证据和最终远端 SHA，不沿用旧提交的 CI。

## 每步交付后的同步要求

以后每个正式切片在普通 push 前都要把文档同步纳入同一交付：

- `docs/feature-registry.md`：实际 capability / coverage / admission；
- 本文：当前步骤、验证、停止点、下一步；
- 战略 roadmap：只有顺序 / scope / cross-stage dependency 真实变化时更新；
- `docs/architecture.md`：只有真实实现边界 / data flow / runtime 改变时更新。

分支上不得预写 merge / main CI / production admission；合入后若 CURRENT 文档因此已知过期，下一次项目同步优先补齐。

## Stage 4.1-G — Identity / PBC Evidence / Readiness V2（2026-09-14 CLOSED）

- 原始实现基线 `ee7f2e35d967f58812706c2ee06255cc82ea4094`；审计功能提交 `aad643872fb32abe92e7b8517fc6209f0948a249`；最终独立审计 HEAD `5489e3f77e284c69d492cfccb7242e2bd9e504d8`。
- **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；DATA / PRODUCTION NOT_ADMITTED。** PR #48 以精确 audited HEAD 合入；PR CI `34820778498` completed/success；merge/main `f1b85a28dbe83a1ae7875f0b7a80d8b56e25b123`；main push CI `34821083781` completed/success。
- 新增 exact reviewed mapping 合同与只读 current Registry 验证；真实 resolved 0 / unresolved 23，不创建实体，不修改 V1 vocabulary/permissions。
- R2-B 原 sealed archive 对账后提交一条原生 M2 YoY graph 和两份 RAW_SOURCE，positive replay PASS；full graph BLOCKED（1/894 committed），source/data/production 未提升。
- V1 发布内容与报告保留；V2 重新推导全部 23 metrics，normalization / PIT backtest / overall 各 READY 0 / BLOCKED 23。368 条 gate delta 保留原 full-scope 状态；独立 canary capability BLOCKED→PASS。all-A D3/CSRC 不变。
- 专项 27 Node + 14 Python、原 semantic 37、contracts 106+78、应用 725、build 与 validators 本地通过；PR/main Hosted CI 完整工作流均 completed/success。
- Stage G 已关闭；该段保留 2026-09-14 时点“主线进入 Stage 4.1B”的历史事实；CURRENT 主线见本文顶部，Stage 4.2 已关闭并进入 Stage 4.3。未闭合单指标数据任务继续作为并行数据支线，不重新成为产品主线 blocker，除非满足最新方向 §1.1 的真实正确性/安全阻断条件。

## Stage 4.1-F — Semantic Runtime / Readiness（2026-09-12 已合入的 V1 发布事实）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION/DATA NOT_ADMITTED。**

- 28 个 PBC F1 definition bindings、只读 Macro Semantic API、native vintage 截止前唯一 revision 选择与 owner adapter 已合入；EntityRef 仅为请求 claim，正式 Registry-backed mapping 尚不可用。审计 remediation 已去除 metricId 自动生成 EntityRef，entity binding=null，ENTITY_REGISTRY_UNRESOLVED 始终阻断，不创建实体。
- 23 metric normalization / PIT backtest readiness：分别按冻结 15/16 gate 集计算，各 READY 0 / BLOCKED 23；overall=BOTH_READY，progress 独立为 PARTIAL 9 / NOT_PROVEN 14。PBC PARTIAL 与 CSRC/all-A NOT_ADMITTED 保留；未知分母仍 null。
- PBC committed ledger 894 行及 retained official excerpt 诊断重放可复现；完整 raw/catalog/extraction graph 未 committed，正向 RAW_SOURCE replay 仍有真实 evidence blocker。
- PR/main CI workflow 已加入 bindings validate、semantic-runtime tests、readiness validate 三项直接门禁；PR #45 CI `34673260311` 与 main push CI `34673371463` 均 completed/success。
- PR #45 audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac`，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`。当前停止点：Stage 4.1-F 已关闭并合入；下一业务任务仍须服从 readiness 报告中的真实 blocker，不自动进入 normalization/backtest。
- 验证与具体限制：[Stage 4.1-F design / validation](market-regime/semantic-runtime-readiness-v1.md)。
