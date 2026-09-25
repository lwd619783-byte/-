# 投资研究看板 Feature Registry

> 2026-09-25 CURRENT · **行业深度研究 Skill V1.1：Codex Evidence Builder → ChatGPT Final Writer；IMPLEMENTED / VERIFIED LOCALLY / PENDING CHATGPT AUDIT。** 本轮 Base `1b4e3c482798c1554477192b867890184c83fd4c`，fetch 确认 `origin/main @ fc0f23466777f32eb27037f6cbcbba627f5b2478` 未漂移。复用既有研究形成短父页及 A—E Research Handoff；真实 Pilot **Wiki V1.2 / L0 GAP / V2 BLOCKED / V3 NOT STARTED / Handoff READY_WITH_GAPS**，AI 草稿待人工审核、OS Promotion 未触发。L0 缺口不回退公司验证成熟度；未执行最终 Wiki 写作，仅更正错误状态标签。项目入口数量不变，无依赖/runtime/合同/UI/Domain MCP变更，私人身份/原件未入库。Skill check、24项测试及env检查无新增FAIL；[验证与限制](industry-research-skill-v1-validation.md)。Hosted CI NOT_RUN；既有 Preview READY 绑定 Base SHA；Production NOT_MODIFIED，未主动执行Production deployment。本轮普通commit/push后停等ChatGPT审计/synthesis，无PR/merge/main写入，不主动再次部署。本条 supersede 本任务旧状态与部署表述。

> 2026-09-24 CURRENT · **Stage 4.5 — IMPLEMENTED / TARGETED FIX APPLIED / PENDING CHATGPT TARGETED RE-REVIEW**。Base `cb970497da40e7d20cdc991a8c39168f62650ddd`；同一功能分支定向修复：共享预览直接展示 snapshot 实际研究字段及逐个仓位，保留 unavailable；UI / OAuth 明确 24h 是访问有效期，不是物理删除 SLA。锁定 SDK 1.30.0 未可靠支持 tool-level `securitySchemes`，记为 NOT_APPLIED；8 tools / `os:read` / owner / staging / Legacy 边界不变。仅普通 commit/push 后等待 ChatGPT targeted re-review，无 PR/merge/main/Production 操作。[本轮修复与实际验证](stage-4-5-domain-mcp-readonly-v1.md#p1-targeted-fixes--2026-09-24-current)。本条 supersede 下方 Stage 4.5 旧停止点，不回写历史验证数字。

> 2026-09-24 CURRENT · **Stage 4.5 D0 Scope Freeze + Read-only OS Domain MCP V1 — IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。Base `e6a148d8e345e89cfbe4920d803265108e1b3e4c`（含已确认 Research Memory / Formal Decision 文档）；原本地正式 owner → 经校验的 canonical decision snapshot → 本人预览确认 → 独立私有暂存 → `os:read` Domain MCP。8 个有界只读工具、TTL/digest/generation/CAS/revoke、最小发布/撤销入口与既有 F3 tool-use 已实现。Notion = Research Memory；OS = Formal Decision System；Legacy Bridge 不扩建；Slice 1 = READ-ONLY；Stage 4.6 Agent 仍 NOT_IMPLEMENTED。Portfolio 仅复用真实 localhost projection 读取路径，Hosted 保持 unavailable；私人账本/真实 ChatGPT 账号验收 NOT_RUN。113 files / 1487 tests、build/contracts/discovery、专项与隔离浏览器验证通过；[D0、合同、验证与限制](stage-4-5-domain-mcp-readonly-v1.md)。普通 push 后停止等待独立综合审计，无 PR/merge/Production 操作。本条 supersede 下方旧 Stage 4.5 仅规划状态，不回写历史。

> 2026-09-24 CURRENT · **Stage 4.4 CLOSED；知识/决策职责重基线已冻结**。PR #80 / merge/main `68698ae7548aeb46fe9dd95fd0fdfcb4f13d1e4e`，PR CI `35985508556`、main CI `35986495424` success，Production `dpl_G8cjdpD9oT3E5sN9dCckptzkc77J` READY。Notion 是长期 Research Memory，OS 不再扩建行业/公司/宏观 Wiki、Notion 镜像或 Obsidian 主知识库；OS 聚焦 Structured Fact/Evidence/Verified Claim/Thesis/Investment Expression/Portfolio 与 PIT/admission/revision/Audit/calculation。Stage 4.5 Domain MCP CURRENT；旧 Research Bridge 仅 Legacy fallback。见 [投研知识与决策工作流 V1](research-knowledge-decision-workflow-v1.md)。


> 2026-09-24 CURRENT · Stage 4.4 docs-only closeout：**IMPLEMENTED / TARGETED RE-REVIEW PASS / READY FOR PR**。ChatGPT targeted re-review 绑定 `5d12c97cb0342176ec82196f39502668f5d9238f`，P0=0 / P1=0 / P2=0；full projection canonical integrity binding、Account lifecycle / denominator semantics、confirmation / Audit authority 与只读边界均 PASS。该 SHA 的 Preview deployment READY，用户已完成人工验收且无新增修改要求。PR NOT_CREATED / Hosted PR CI NOT_RUN / merge NOT_DONE / main NOT_MODIFIED / Production NOT_UPDATED、NOT_VERIFIED FOR STAGE 4.4；真实 Portfolio 对象不增加。下一停止点为 ChatGPT docs-only Final SHA 极轻量复核，之后由用户另行授权创建 PR。本条 supersede 下方旧 Stage 4.4 CURRENT / 停止点，历史记录与测试数字保留原时点含义。[精确事实与收口边界](stage-4-4-portfolio-exposure.md#docs-only-closeout--2026-09-24-current)。

> 2026-09-23 CURRENT · Stage 4.4 targeted audit fix：**IMPLEMENTED / PENDING TARGETED RE-REVIEW**。在已审计 `3bff8f1b52af26b812d633b9a1c66c4bad929ce6` 原分支定向修复 P1 全投影 canonical integrity binding 与 P2 Account lifecycle 传播；inactive/archived 仍计入已记录持仓分母并显式阻断/提示。冻结 Phase 1B、目标 universe、exact research pin、本机只读、交易与绩效边界不变。仅普通 commit/push，停止等待 ChatGPT targeted re-review；本条 supersede 上一条待独立审计状态，保留其历史验证数字。[定向修复与复验](stage-4-4-portfolio-exposure.md#targeted-audit-fix--2026-09-23)。

> 2026-09-23 CURRENT · Stage 4.4 Portfolio Exposure Integrated MVP：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。Base `9e363474abc22ebb6da391dbb2c45c9e8c9358e8`；A/B/C 同一功能分支连续完成。复用 Phase 1B 账本与 Stage 4.3 原研究 owner，新增本机只读 projection、六维结构暴露、exact 研究关联、定性研究暴露、本人确认的目标与再平衡复核、组合 Workspace/F3。真实对象本轮创建/核验均0，私人存储未盘点；不提供 FX、交易或绩效。仅普通 push 后待独立审计。[实现、验证、限制](stage-4-4-portfolio-exposure.md)。本条 supersede 旧 Stage 4.4 NEXT/NOT_IMPLEMENTED，历史审计保持原时点含义。

> 2026-09-23 Final Closeout / CURRENT — **Stage 4.3 CLOSED / IMPLEMENTED / INDEPENDENT AUDIT PASS / MERGED / PR CI PASS / MAIN CI PASS / Production READY**；R3 #77、Legacy Hardening #78 已核验。Stage 4.4 Portfolio Exposure MVP 为 **NEXT / PLANNED / NOT_IMPLEMENTED**。真实仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression**；代码关闭不制造研究对象、不升级 admission 或 Bridge authority。精确事实与限制见 [Final Closeout 与 Stage 4.4 handoff](stage-4-3-r3-investment-expression-closeout.md#final-closeout--2026-09-23-current)；supersede 下方旧 CURRENT/待审计状态，保留历史记录。本 docs-only 分支自身待独立审计。

> 2026-09-23 Bridge 专项增量 — **Pre-4.4 Legacy Hardening / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。基于 `c3b2892459827a8ac060ee38031def840b56a546` 选择性迁移 `58dc00a` 的配置分类、安全中文错误、环境中立提示与失败隔离/只读闭环测试；Research Bridge 继续 Legacy compatibility / read-only / fail-closed，R0 authority split 不变。无 Production / Preview / MCP / private store 真实配置写入，不宣称 Production Bridge 已启用。本条仅更新 Bridge 修复事实；已完成 R3 后的 Stage 4.3 CLOSED / Stage 4.4 NEXT 总状态同步留给下一步 B，不重做 closeout。[迁移与验证记录](research-bridge-readonly-v1.md#pre-44-legacy-hardening2026-09-23)。普通 push 后等待独立审计。

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

> 2026-09-21 CURRENT：**Slice 2 — Wiki Infrastructure V1 — independent review PASS；Slice 2.5 — AI Knowledge Ingestion Foundation V1 + authenticated Read-only Research Bridge，IMPLEMENTED / LOCAL VERIFIED / PENDING INDEPENDENT REVIEW**。沿用基线 `812e7551e67b0b8af4f673524e2578ecf2e19335` 的 Source/Extraction/Wiki/Revision/Review。中文首次使用、原件 IndexedDB、完整文章候选审核、用户选择后 private staging 与 OAuth 只读 MCP；贡献包仍人工回传。远程与 ChatGPT 账号连接按实际验收单列。[Slice 2.5 CURRENT](stage-4-3-slice-2-5-knowledge-ingestion.md)。后续旧条目只保留其时点；本次仅功能分支 commit/push 与 Preview，停止等待独立审计，不创建 PR/merge/Production。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 2 P1 remediation：IMPLEMENTED / VERIFIED LOCALLY / PENDING TARGETED RE-REVIEW**。原独立审计 HEAD `188f1adcd2a5662f24dc9a57c861ae6e95934394` 为 P0=0 / P1=1；固定 `research-wiki/index.md` / `research-wiki/manifest.json` 已统一预留，沿用 NFC / NFKC / case-insensitive 与文件/目录 collision fail-closed。Projection 29、全部 Wiki 78、全量 1136 tests、build、contracts、F3、261 Local Core、discovery PASS；本轮 90/90 browser checks、13 screenshots，0 runtime/console errors、0 external requests。正常 Markdown/manifest/ZIP 字节与审计 HEAD 相同。F3 actual deterministic service 仍 0/33 NOT_IMPLEMENTED，authority/PIT/admission 不变。Hosted CI NOT_RUN；仅原分支普通 commit/push 后等待针对性复审，不创建 PR/merge，不修改 main 或部署 Production。[P1 修复与本轮验证](stage-4-3-slice-2-llm-wiki.md#p1-remediation--固定-vault-路径保留2026-09-20)。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 2 LLM Wiki V1 + Markdown/Obsidian Projection：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。从 fetch 后精确 `origin/main @ 1d883414fe7828b682c8cd888223ccf7bd729834` 创建 `codex/stage-4-3-slice-2-llm-wiki-obsidian`。L2 Entry/append-only Revision/Review、historical Current、exact refs/trace、search/backlinks/orphans、Local-first Wiki JSON backup/recovery、`#/memory` 三视图与单向可重建 Vault 已实现；Markdown 不是真源，AI origin 不升级。70 Wiki 专项 / 1128 全量 Vitest、build、contracts、F3、261 Local Core tests、90 browser checks PASS。F3 actual service 仍 0/33，admission 不提升。Hosted CI NOT_RUN；本切片普通 commit/push 后停止等待独立审计，不创建 PR/merge/部署。[D0、验证及真实限制](stage-4-3-slice-2-llm-wiki.md)。

> Slice 2 初始交付及下方较早记录保留原时点；本次 CURRENT 状态以顶部 P1 remediation 条目及对应记录为准。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 1 Source + Extraction 正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 / Slice 2 — LLM Wiki V1 + Markdown/Obsidian Projection 进入 CURRENT PLAN / NOT_IMPLEMENTED。** Slice 1 初审 HEAD `b5b548a2e6308a2603d6603fbd0afca315cb1727` 为 P0=0/P1=1；第三方作者归因修复 HEAD `a716b2205d3056e99198852224bf56ad71026a36` 最终复审 PASS（P0=0/P1=0）；PR [#69](https://github.com/lwd619783-byte/-/pull/69) exact-head CI [35512099983](https://github.com/lwd619783-byte/-/actions/runs/35512099983) completed/success；merge/main `f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`，main push CI [35512366207](https://github.com/lwd619783-byte/-/actions/runs/35512366207) completed/success；Vercel Production `dpl_CmeXXfaEqc2BwXBBnuByMcZb7DNE` READY。Production 只表示应用部署成功，不提升 Provider/Data admission 或 strict PIT。Slice 2 冻结为“结构化 Wiki Domain 真源 → deterministic Markdown projection → Obsidian-compatible read-only Vault”；Obsidian 不成为数据库，生成 Markdown 不形成第二真源。详见 [Slice 2 冻结方案](stage-4-3-slice-2-llm-wiki.md)。

> 2026-09-20 CURRENT — **Stage 4.2.5 Creator Viewpoint Tracker V1 已正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 / Slice 1 Source + Extraction 已 IMPLEMENTED / VERIFIED LOCALLY / PENDING TARGETED RE-REVIEW；L2–L5 仍未实现。** Stage 4.2.5 独立审计最终 HEAD `025352f5bb7879ce6e1e2130fb9cd43788409928`（P0=0 / P1=0）；PR [#67](https://github.com/lwd619783-byte/-/pull/67) exact-head CI [35489459196](https://github.com/lwd619783-byte/-/actions/runs/35489459196) completed/success；merge/main `2cea477105d3e63242e65b7f3eec0b658a87ce17`，main push CI [35489619887](https://github.com/lwd619783-byte/-/actions/runs/35489619887) completed/success；Vercel Production `dpl_ExmoiCEYa2EXRfmuqnRxEAE5AfrE` READY。Production deployment 不提升 Provider/Data admission。Stage 4.3 最新冻结路线为 `L0 Raw Source/Evidence → L1 Structured Extraction → L2 Reviewed Research Memory/LLM Wiki → L3 Verified Claim → L4 Thesis → L5 Investment Expression`，Schema / Entity Identity / Provenance / PIT-asOf / Revision / Verification / Audit 贯穿全链；详见 [Stage 4.3 冻结方案](stage-4-3-research-memory-wiki-thesis-plan.md)。

> Feature 状态：Creator Viewpoint Tracker V1 已 CLOSED；Stage 4.3 / Slice 1 公共 L0/L1 合同、Creator adapter、精确反查与只读 Local-first seam 已本地验证；第三方作者误归因 P1 已定向修复，等待最终针对性复审。55 专项 / 1058 全量 tests、build、contracts、F3 PASS；Hosted CI NOT_RUN。没有原生 AI extraction store 或生产接线；LLM Wiki / Verified Claim / Thesis / Investment Expression 未实现。[Slice 1 设计与验收](stage-4-3-slice-1-source-extraction.md)。

> 2026-09-20 CURRENT · Stage 4.2.5 剩余 P1 修复：Current View 按 knowledge-visible、reviewed、active 的未知时间观点及 capturedAt 上界派生 chronologyHealth；Overview / Comparison / Excel 显示“最近可确定状态，当前状态不完整”。可靠时间修订审核后自动恢复确定，Creator time / audit time 不混用，无持久化 schema 变化。专项 113、全量 1003 tests / 80 files、build、329 browser checks、实际 Excel 独立读取 PASS；PENDING FINAL TARGETED RE-REVIEW，Hosted CI NOT_RUN。路线与分支边界不变。[当前交付](stage-4-2-5-creator-viewpoint-tracker.md)。

> 2026-09-19 CURRENT · Stage 4.2.5 独立审计修复：Creator 发布时间与本地 knowledge/audit 时间分离；历史回填不回退 Current View，T+ 使用来源锚点，未到期 completed/inconclusive 均拒绝。增加 exact corrupt bytes 保留、完整备份校验、显式确认和 reload 的受控灾难恢复；future schema 继续锁定。外部事件 verified 仅表示来源核对。124 项受影响测试、全量 997 tests / 80 files、build、321 browser checks、JSON recovery round-trip、Excel 独立读取 PASS；PENDING TARGETED RE-REVIEW，Hosted CI NOT_RUN。路线保持 Stage 4.2 CLOSED → Stage 4.2.5 CURRENT → Stage 4.3 NEXT。[当前语义与限制](stage-4-2-5-creator-viewpoint-tracker.md#独立审计修复与针对性复审2026-09-19)。

> 下方初始交付与更早记录保留原时点；本轮修复状态以上述条目为准。

> 2026-09-19 CURRENT — **Stage 4.2 CLOSED → Stage 4.2.5 Creator Viewpoint Tracker V1 CURRENT → Stage 4.3 NEXT**。本专项新增外部观点记录、独立 Topic 状态历史、人工审核/复盘、四视图 Workspace、JSON 完整恢复和 Excel 分析副本；Current View/Transition/到期项均为已审核历史投影。复用 ResearchEvent 公共 owner、Evidence Drawer、Workspace 导航和 PersistedBaseGuard；不接 SQLite/云，不提前实现 Claim/Thesis。精确开发基线 `8860c943919f90daa125934fde0f385707ea7028`。本地 959 tests / build / 287 browser checks / JSON round-trip / Excel 独立读取 PASS；IMPLEMENTED / VERIFIED LOCALLY。真实样本旧状态与明确失效条件仍未证明，未伪造转换。完整交付与限制见 [Stage 4.2.5 当前方案与交付](stage-4-2-5-creator-viewpoint-tracker.md)。独立审计 PENDING，Hosted CI NOT_RUN；仅功能分支普通 commit/push，不创建 PR/merge/部署。

> 以下 Stage 4.2 closeout 及更早 CURRENT 条目保留其记录时点；本轮顺序以上述 Stage 4.2.5 增量为准。

> 2026-09-19 CURRENT — **Stage 4.2 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。Slice 6 独立审计通过；最终 PR head `8cc62168681719e1eedfe3b1974f5b35844df2cb`，PR [#64](https://github.com/lwd619783-byte/-/pull/64) Hosted CI [35447795829](https://github.com/lwd619783-byte/-/actions/runs/35447795829) completed/success；merge/main `05ffb33ce4edee81f174253ccbad4ee697ed974a`，main push CI [35448015019](https://github.com/lwd619783-byte/-/actions/runs/35448015019) completed/success。六个既有 owners → 5 个 reviewed 相邻留存绝对差 → 5 个固定模板事实性候选 → 原 `evidence-graph.v1` 引用链 → Prosperity Eligibility；oil-shipping / robotics 均 **ABSTAIN / NOT_ELIGIBLE**。F3 独立 Industry 5-case suite 已进入 Hosted CI；Frozen Foundation 33-case 口径不合并分母。DATA / PRODUCTION admission、严格 PIT、release/revision continuity、正式景气评分/方向、Verified Claim、Thesis 均未提升。首次 PR CI 暴露的 generated-validator CRLF/LF source-digest 漂移已收敛；本次 closeout sync 将 compiler 输入换行标准化，不改变 F2 schema 或 validator 语义。详见 [Slice 6 冻结方案与验证](stage-4-2-slice-6-plan.md)。

> Slice 5 CURRENT 事实补齐（本次实时核验）：PR [#63](https://github.com/lwd619783-byte/-/pull/63) 已合入，PR branch head `dfc54f1d0437774387869e75696681a5791082cb`，merge/main `dc8f5ec36d9626e92acc3fc91088c1b8c42ce753`。PR CI [35442595473](https://github.com/lwd619783-byte/-/actions/runs/35442595473) 与 main CI [35442791153](https://github.com/lwd619783-byte/-/actions/runs/35442791153) 均 completed/success。此事实只适用于 Slice 5；以下较早交付状态保留其时点意义。

> 2026-09-18 CURRENT — Stage 4.2 Slice 5：**D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。独立版本化 exact dimension mapping + 多因子只读快照；新增 EIA 原油产量/出口/炼厂净投入 3 owners，总计 6 owners，oil-shipping 覆盖 supply/demand/trade_flow/inventory 四维，robotics 原双 owner 保持。原 21 文件字节与 3 Registry pins/entries 不变。8 Python / 63 Node / 87 Industry Vitest、全量887 tests、6-owner replay、build、contracts、1038 browser checks PASS；data audit 0 errors / 34 非阻断 warnings。PIT/Entity/F1/F2/F3/admission 不提升；不生成新 delta/score/trend/Claim/Thesis。只普通 commit/push 后停止；本切片 Hosted CI NOT_RUN，独立审计 PENDING。[冻结方案与实测证据](stage-4-2-slice-5-plan.md)。

> 2026-09-18 CURRENT 基线核验：PR [#62](https://github.com/lwd619783-byte/-/pull/62) 已 MERGED；main `8497ac9199def1fbec420eecc6ad7b7305ce160d`，PR CI [35335279897](https://github.com/lwd619783-byte/-/actions/runs/35335279897) / main CI [35335680417](https://github.com/lwd619783-byte/-/actions/runs/35335680417) completed/success。Vercel Production deployment `6522548855`（同一 main SHA）success / READY，核验于本轮；中文化切片与 Slice 4 均已合入。以下旧交付段落保留原时点，准入/PIT/F1/F3 不提升。当前 Slice 5 仅 Metric → Dimension → Multi-factor Snapshot，冻结方案见 [Slice 5](stage-4-2-slice-5-plan.md)，不授权 Prosperity/Regime/Claim/Thesis。

> 2026-09-18 中文化审计修复增量：从 `2fd51dba9b42fc99f7bf2b3415f5c831727edbec` 修复 Industry Change / Inbox / 证据摘要的 EIA 标题展示，以及复盘任务 pending 的“待处理”上下文翻译；全局 pending 仍为“待核验”，原始事件标题与任务状态不变。相关36 tests、全量875 tests、build PASS；PENDING INDEPENDENT RE-REVIEW。仅原分支普通 commit/push，不建 PR、不 merge。[记录](chinese-ui-evidence-display-2026-09-18.md#独立审计修复增量)。

> 2026-09-18 CURRENT — 中文化与证据展示降噪：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。精确基线 `01b246a25bbe304ceb9c121e92eb91bedbdcf478`；仅显示层中文标签、证据摘要与默认折叠高级审计信息。Evidence / Chart Audit / Inbox / Industry / 产业链及首页、宏观、个股、预期主要文案已同步；原始审计字段完整保留。869 Vitest、8 Industry Python、35 Industry Node、73 Industry Vitest、build、三主题三尺寸508 browser checks PASS。Provider / Registry / Contract / PIT / Evidence owner / pins / 原始数据无差异；准入不提升。本分支普通 commit/push 后停止，不创建 PR/merge；本切片 Hosted CI 未核验。[交付记录](chinese-ui-evidence-display-2026-09-18.md)。

> 2026-09-18 基线事实补齐：Stage 4.2 Slice 4（含 CLI P1 修复）已通过 PR [#61](https://github.com/lwd619783-byte/-/pull/61) 合入；merge/main `01b246a25bbe304ceb9c121e92eb91bedbdcf478`，main CI [35332262999](https://github.com/lwd619783-byte/-/actions/runs/35332262999) completed/success，本轮实时核验。该基线为 **MERGED / MAIN CI PASS**；下方原交付记录保留其时点状态，DATA/PRODUCTION/PIT/F1/F3 不提升。

> Slice 4 P1 CLI 兼容修复（2026-09-18）：无 `--metric` 恢复历史 NBS output 默认目标；显式 EIA / 未知目标仍按 exact Registry 处理，adapter dispatch 不变。仅 CLI、回归测试及状态补充，retained data / owners / pins / PIT / admission 无变化；等待独立复审。[修复记录](stage-4-2-slice-4.md#p1-remediation--public-build-cli-compatibility-2026-09-18)。

> 2026-09-18 CURRENT — Stage 4.2 / Slice 4：**D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。从 fetch 后精确基线 `2f2d707b8b222392a969327f10f9d5af5f021eab` 实施；EIA `WCESTUS1` 官方周末商业原油库存接入既有 `oil-shipping`，11/11 声明窗口读数；3 metric owners / 2 source families，显式 fail-closed Source Adapter 分派。EIA 1 Signal / 1 Event 复用 Inbox/Evidence；未知发布时间只在 Inbox 全部日期中出现。NBS 两个 owner 的原始/生成数据与 pins 未变。865 full tests、32 Node replay tests、73 Industry Vitest、8 freshness tests、build、data audit（0 errors；28 非阻断 warnings）、EIA 169 + NBS 277 browser checks PASS。DATA/PRODUCTION NOT_ADMITTED、PIT/revision unknown、F1 NOT_READY、F3 未提升。仅普通 commit/push，不创建 PR/merge；Hosted CI NOT_RUN，push 后停止等待独立审计。[交付与可重放证据](stage-4-2-slice-4.md)。

> 2026-09-18 Stage 4.2 / Slice 3 CLOSED：PR #59 已合入，merge/main `6a9aa233b4351938b39c247833d9e72d99854269`，PR CI `35318164694` 与 main CI `35320061290` 均 completed/success，Vercel production READY。Industry Signal/Event/Inbox、listing reconciliation、Unitree listed identity、cohort57 与 segment-first Architecture Industry Map 已 **MERGED / MAIN CI PASS**；准入/PIT/F1/F3未提升。下一主线为 [Stage 4.2 Slice 4 — Cross-source Industry Provider Proof](stage-4-2-slice-4-plan.md)。

> 2026-09-18 细分关系增量 CURRENT：机器人产业链按主要功能展示7个唯一细分（上4/中1/下1/横向1），移除阶段箭头，新增6条源自既有研究原文的细分功能连线；能力迁移为虚线，不表示公司供货事实。公司跨阶段原文保留，明细默认折叠。数据/Provider/PIT/cohort57/准入无变化。854 tests、build、三主题三尺寸331 browser checks PASS；[关系图与证据](stage-4-2-slice-3.md)。IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW；普通push后核验exact Preview，不建PR/merge。

> 2026-09-18 UI反馈增量（历史 b626be6）：产业链默认只显示上中下游、细分方向与阶段衔接；公司/覆盖率/Provider明细均点击节点展开，覆盖下面a0c1f64版默认展示细节的要求。原topology、数据、cohort57与准入不变。22项相关tests、build、三主题三尺寸298 browser checks PASS；[简图与证据](stage-4-2-slice-3.md)。普通push后等待独立审阅。

> 2026-09-18 Slice 3 final remediation CURRENT：**IMPLEMENTED / VERIFIED LOCALLY / PENDING THIRD INDEPENDENT REVIEW**。审计输入 `a1a4be2`、main仍`086521d`。产业链改为Architecture Canvas：3彩色Stage Groups → 10 Segment Nodes（7unique）→二级公司标签/完整展开数据，用户参考图仅供视觉方向；原topology和12家unresolved不变。Unitree保留688836.SH/A股/科创板。Stability单一受控cohort57与current generated universe精确核验，57/57候选可通过、56/57/extra/foreign拒绝，全部稳定阈值不变；0观察日导致默认refresh eligibility仍BLOCKED，不提升admission。261 observability、851 full tests、build、277 browser checks本地PASS；真实数据全部无diff，Guidance cross-epoch P2保留。普通push后核验exact Vercel SHA，停止等待第三次独立审计，不建PR/merge。[完整记录](stage-4-2-slice-3.md)、[delta](stage-4-2-slice-3-freshness.md)。

> 2026-09-18 Stage 4.2 / Slice 3：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。精确基线 `086521d6bd305ea73cb5d4a426b9d4138e4a824b`；分支 `codex/stage-4-2-slice-3-industry-events-chain-diagram`。非破坏式 NBS freshness probe、真实公司刷新验证、2 个 Derived Signal / 1 个 Industry Change Event / 4 项读数、原 Inbox 与 Industry 页、既有研究结构产业链图。NBS 最新仍为 2026-08，无新 capture；NOT_ADMITTED / F1 NOT_READY / F3 actual service 0/33 保持。交付与实际 freshness delta 见 [Slice 3](stage-4-2-slice-3.md)。本轮只普通 push，等待独立审计，不创建 PR / merge。

> 2026-09-18 Slice 2 CURRENT 事实补齐：PR [#58](https://github.com/lwd619783-byte/-/pull/58) 已合入；merge/main `086521d6bd305ea73cb5d4a426b9d4138e4a824b`。PR CI [35299972640](https://github.com/lwd619783-byte/-/actions/runs/35299972640) 与 main CI [35300272837](https://github.com/lwd619783-byte/-/actions/runs/35300272837) 均 completed/success，本轮已实时核验。Slice 2 Registry / 双 metric 为 **MERGED / MAIN CI PASS**，不代表生产准入；原 Slice 2 文档保留交付时点证据。

> Slice 1 已按 [closeout](stage-4-2-slice-1-closeout.md) 关闭：PR #56、merge/main `c664021d02a45aac79c1272d4c42f6061d3fbbf2`，PR CI `35230502534`、main CI `35230848333` completed/success，独立复审 PASS。此处补齐已发生的 CURRENT 状态；不改写原审计时点记录。

> 2026-09-17 CURRENT：Stage 4.1B 已通过 Slice 1–3 完成计划产品化收口，正式登记为 **CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。Slice 3 最终独立审计 HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`；PR #54 Hosted CI `35207107183` completed/success；merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`；main push CI `35207381240` completed/success。F3 两个 direct gates（`test:research-eval`、`research:eval:check`）已在 PR/main Hosted CI 实际执行通过。Frozen V1 33 cases/digests 不变；reference oracle 33/33 PASS（REFERENCE_ONLY），actual deterministic-service PASS 0/33、NOT_IMPLEMENTED 33/33。PRODUCTION / DATA ADMISSION 未提升；严格 PIT、正式 `releaseAvailableAt`、通用 F2 runtime、真实 service adapters、MCP/Agent 仍按各自边界未实现/未证明。CURRENT 主开发线进入 **Stage 4.2 — Industry Data Platform**；单 Provider、指标覆盖、PBC/CSRC/all-A admission、normalization/backtest 继续并行数据支线。详见 [Slice 3 closeout](stage-4-1b-slice-3.md) 与[机器报告](stage-4-1b-slice-3/eval-report.v1.json)。

> 2026-09-17 Slice 2 合入记录：Stage 4.1B / Slice 2 — Auditable Chart V1 + Product Shell V1 已完成独立审计、PR #52、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。audited HEAD `88f97a56d44c3d512c00444f650000d60af89e40`，merge/main `753073912356de00504ba97c221c7ac1b7c8b81d`，PR CI `35201231930` 与 main push CI `35201547659` 均 completed/success。PRODUCTION / DATA ADMISSION 未提升；严格 PIT、正式 `releaseAvailableAt`、report revision continuity、Evidence Graph closure 与 chart exact Evidence linkage 仍未证明。该段保留 Slice 2 收口时点事实。

> 2026-09-16 Slice 1 合入记录：Stage 4.1B / Slice 1 — Research Inbox + Evidence Drawer V1 已完成独立审计、PR #50、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。audited HEAD `3a94f1c78cdea95481e49ba77ae8464cc3c6b37c`，merge/main `38ffcbd44ecd2c4531b6ef737d4c6616ec197ca8`，PR CI `35071221955` 与 main push CI `35071457928` 均 completed/success。PRODUCTION / DATA ADMISSION 未提升；该段保留 Slice 1 收口时点事实。

> 2026-09-14 CURRENT 历史记录：Stage 4.1-G 已完成独立审计、PR #48、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**；DATA / PRODUCTION 仍 NOT_ADMITTED。当前主开发线进入 **Stage 4.1B Research Inbox / Evidence Surface / Product Shell**。当前能力与阻断见下方 Stage 4.1-G；以下 2026-09-12 段落保留 Stage F 合入时点记录。

> CURRENT 战略入口以 [2026-09-13 Development Direction](current-development-direction-2026-09-13.md) 为最新增量事实源，[2026-09-11 rebaseline](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md) 为其下层长期基线。Stage 4.1-G 与 Stage 4.1B 主线均已收口；不默认派生新的 4.1-H/I，不以全部 23 metrics READY 为 Stage 4.2 前提。未闭合单指标数据任务进入并行数据支线，重新列为主线 blocker 须满足最新方向 §1.1 的真实正确性/安全阻断条件。

> UI V1.0 设计入口：[NEON-RC1-20260909 获批事实源](ui-redesign/v1/README.md)与[D0–D5 执行索引](ui-redesign/v1/execution-index.md)。2026-09-09 APPROVED / FROZEN；D0 仅文档归档，D1–D5 未派发，不表示 UI 已实现或业务准入。

> 2026-09-12 CURRENT：已核对 `origin/main @ fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`。Financial Research Foundations V1 已由 PR #43 合入；Stage 4.1-F 已经独立审计通过并由 PR #45 合入：audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac`，PR CI run `34673260311` completed/success，main push CI run `34673371463` completed/success。当时的长期战略基线为 [Financial Research OS roadmap](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md)，进展见[执行索引](development-execution-plan-2026-09-07.md)。R2-E / D3 仍保持 NOT_ADMITTED；Stage 4.1-F 已合入，但 production/data 仍 NOT_ADMITTED。以下 remediation 基线与历史审计保留原时点意义。

> 基线日期：2026-09-09
> 本轮 remediation 的 pre-remediation / audit-input main baseline：`origin/main` @ `a6cbf108139a2af66273c5376288b83d54712f58`，不是永久 CURRENT main。
> Remediation 的实际 merge / CI 状态以包含本变更的 Git commit 是否成为 `main` ancestor、对应 PR 和 GitHub Actions 为准；静态 CURRENT 文档不预写 MAIN MERGED，也不自证 CI PASS。

状态定义：

- `IMPLEMENTED`：代码 / 合同 / artifact 已存在；不表示获得数据或生产准入。
- `VERIFIED`：已通过明确范围的验证；本次 R2 指离线专项 / committed report 校验，不冒称全量 raw 重放或远端 CI。
- `NOT_ADMITTED`：对应数据 / 生产能力未准入；可与 IMPLEMENTED、VERIFIED 同时成立。
- `NOT_STARTED`：尚无该项正式实现；旧条目中的 `NOT STARTED` 同义。

- `DONE`：功能和当前范围内验证已完成，可继续使用。
- `DONE V1 / LOCAL CORE`：V1 Node-only 核心与当前范围验证已完成；不表示浏览器 UI、远程入口、真实 adapter / migration 或 Production Admission 已完成。
- `DONE / NOT ADMITTED`：实现已完成，但尚未满足生产准入条件。
- `CONTRACT V1`：研究 / 数据合同已经正式固化，但尚未进入 Provider / 评分 / UI 生产实现。
- `PARTIAL`：已有可用能力，但覆盖、数据源或工作流明显不完整。
- `PROBE ONLY`：只完成可行性 / 数据源探测，不能生产正式结果。
- `NOT STARTED`：尚未形成正式实现。
- `DEFERRED`：明确延后，不应被误认为缺陷。

## 1. 产品与研究界面

### Stage 4.1B / Slice 3（2026-09-17 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；Stage 4.1B CLOSED；PRODUCTION / DATA ADMISSION 未提升。** Node-only、默认离线只读 Eval Harness：Frozen integrity → 审核 target → Actual Result schema → exact scalar/set diff → deterministic report。仅注册 reference oracle，明确 REFERENCE_ONLY；四 operation 的真实 Frozen-wire adapter 均 NOT_IMPLEMENTED。现有 Macro、earnings 和产品 read models 不因同名能力获得 F3 service PASS。Registry admission 拒绝 oracle wrapper/未注册 target 伪造服务覆盖；低层测试 seam 无 expected/caseId。最终独立审计 HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`；PR #54 CI `35207107183` completed/success；merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`；main push CI `35207381240` completed/success。两个 F3 direct gates 在 PR/main Hosted CI 均 success。reference 33/33 PASS、actual service 0/33、NOT_IMPLEMENTED 33/33。旧 browser 证据按验证时点保留；CI remediation 未重跑视觉验收。完整架构、能力矩阵与 closeout gate 见 [Slice 3](stage-4-1b-slice-3.md)。

### Stage 4.1B / Slice 2（2026-09-17 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION / DATA ADMISSION 未提升。** 基于 `63208ce038f5222d10bfa471bc5d0a868fe2905e` 实现，独立审计 HEAD `88f97a56d44c3d512c00444f650000d60af89e40`；PR #52 CI `35201231930` completed/success；merge/main `753073912356de00504ba97c221c7ac1b7c8b81d`；main push CI `35201547659` completed/success。Auditable Chart 接入首页/公司价格历史与公司分期财务；纯 owner → presentation projection 展示独立时间、来源、安全链接、质量/完整性与证明缺口。价格接线保留原 PriceHistorySeries 引用；不按来源字符串猜 lineage。Product Shell 复用首页和公司页的标题、对象、质量摘要与原证据/研究导航。当前两类 owner 均无正式 metric/revision evidence pin，图表 linkage 保持空；公司级相关证据不充作图表证明。未创建新 owner、业务持久化、Provider、F2 runtime 或 F3 harness。严格 PIT、正式 `releaseAvailableAt`、report revision continuity、Evidence Graph closure 与 chart exact Evidence linkage 仍未证明。测试、浏览器矩阵、准入边界及文件索引见 [Slice 2](stage-4-1b-slice-2.md)。

### Stage 4.1B / Slice 1（2026-09-16 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION / DATA ADMISSION 未提升。** 基于 `2829776f8ef4b7bcbf744c8edb37410bbd6ec67a` 实现，独立审计 HEAD `3a94f1c78cdea95481e49ba77ae8464cc3c6b37c`；PR #50 CI `35071221955` completed/success；merge/main `38ffcbd44ecd2c4531b6ef737d4c6616ec197ca8`；main push CI `35071457928` completed/success。首页 Research Inbox 只投影已有事件、任务、观察项与预期 owner；任务按 WatchItem 合并、关联事件去重，排序与日期窗口可解释。共享 Evidence Drawer V1 保留来源/时间/质量/数值和证据缺口，支持精确公司/事件与原复盘闭环。未接入的新 PIT/admission/graph/revision proof 仍明确未证明。没有新增 Provider、持久化模型、F2 runtime、评分或 Auditable Chart；没有改动冻结 F3 V1。验证及范围见 [Slice 1](stage-4-1b-slice-1.md)。

### Cross-cutting foundations（2026-09-17 CURRENT）

| 能力 | 本轮真实状态 | 合同边界 / 未实施范围 |
| --- | --- | --- |
| F1 Financial Semantic Registry V2 | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS | 现有 Registry 字段绑定、独立时间语义、deterministic request；Stage 4.1-F 已实现并合入 Node-only Macro 只读 runtime / adapter；完整跨域 retrieval 未实现 |
| F2 Evidence Graph V1 | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS | immutable pin、typed relation、状态传播；复用 Entity/Evidence/Audit/Position，通用 runtime / Graph DB / UI NOT_IMPLEMENTED |
| F3 Investment Research Eval Suite V1 | 合同 CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；Harness IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS | 八类 33 个 Frozen synthetic Golden Cases 不变；reference 33/33 PASS，actual service 0/33、33 NOT_IMPLEMENTED；真实 Agent runtime 未实现 |

三项 production 均 NOT_ADMITTED。范围与复用矩阵见 [Scope Freeze](financial-research-foundations-contract-v1.md)，命令与真实 PASS/WARN 见 [validation](financial-research-foundations-contract-v1-validation.md)。PR #43 以 audited HEAD `204176924b23ed5c1d480203d284c0b01a28f966` 合入，merge/main `4ad9ec286a6cb73485ebf0e88a28837c0ae8b3c0`；PR CI run `34621319869` 与 main push CI run `34621558359` 均 completed/success。Stage 4.1-F 由 PR #45 以 audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac` 合入，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`；PR CI run `34673260311` 与 main push CI run `34673371463` 均 completed/success。

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| 研究终端 UI | DONE | 暗色终端、KPI、Card、Chart、Table、Filter、响应式 | 后续仅随新 Feature 演进 |
| 宏观看板 | PARTIAL | `MacroTab`、宏观静态/生成数据 | 接入 Stage 4.1 Metric Registry、频率/发布时间/修订/stale 体系 |
| 行业研究 | PARTIAL | 既有研究资料、细分、产业链、公司池；Registry 驱动 6 owners，独立 Dimension mapping 与四维 EIA snapshot/history/审计 preview | **Slice 1–4 MERGED；Slice 5 VERIFIED LOCALLY / PENDING REVIEW；NOT_ADMITTED；prosperity 未实现** |
| 个股池 | DONE | A/H 股研究池、筛选、排序、详情 | 后续扩 stock universe 与估值维度 |
| 个股详情 | DONE | 行情、财务、公告、研究事件、预期等聚合 | 后续加入估值、持仓、研究 thesis |
| 观察清单 | DONE | Watchlist V2、复盘、任务、备份 | 云同步、跨设备、账户化 |
| 验证中心 | DONE V1 | ResearchEvent + Earnings Verification | 后续扩行业/宏观判断验证 |
| 预期证据中心 | DONE V1 | 多类预期快照、修订、时间审计、导入 | 自动机构一致预期仍未实现 |

## 2. 行情与基础数据

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| A 股 Quote | DONE MVP | 真实生成数据 | 正式定义自动刷新 SLA / stale |
| A 股 Price History | DONE MVP | 真实历史价格 | 增加更长周期与 corporate action 规则 |
| 港股 Quote | DONE MVP | yfinance，当前少量研究池 | 扩覆盖、稳定性与正式 Provider contract |
| 港股 Price History | DONE MVP | 60 日历史 MVP | 扩展历史与数据治理 |
| 宏观数据 | PARTIAL | `data:fetch:macro` + `macroData.ts` | 按 Stage 4.1 Registry 重构官方源、native frequency、revision 与 release semantics |

## 3. A 股财务与公告

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| A 股财务 Provider V1 | DONE / NOT ADMITTED | 56/56、三表、summary/manifest/detail、lazy load、validator | 累积 Stability Gate 样本，单独 admission 后进入默认 refresh |
| A 股公告 Provider V1 | DONE / NOT ADMITTED | CNInfo、56/56 状态、两年窗口、PDF、lazy detail | Stability Gate；提高复杂 PDF 解析覆盖 |
| 公告结构化解析 | PARTIAL | 预告、修正、快报、定期报告关联 | OCR/复杂表格暂缺；不应为追求覆盖率降低证据标准 |
| 默认 Provider Refresh | PARTIAL | 基础行情/港股/宏观 | 财务和公告不得在 Gate 前加入 |

## 4. 业绩预期与证据

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| Earnings Expectation Evidence V1 | DONE | Snapshot、Correction、Business Revision、Temporal Audit、CSV/JSON/手工 | 云持久化 |
| Company Guidance Provider V2 | DONE | 基于 CNInfo 可靠区间，deterministic artifact | 覆盖受正式披露限制，不应伪补 |
| 单家机构预测模型 | DONE MODEL / MANUAL | 模型与录入工作流存在 | 缺自动可靠 Provider |
| Institution Consensus Model | DONE MODEL | 正式 schema / evidence semantics 已有 | 自动数据源未通过合同要求 |
| Institution Consensus Source Probe | PROBE ONLY | 东方财富/同花顺公开源 Probe + 65 offline tests | 保持 NO_GO，直到来源完整性/授权/可重算性满足 |
| Automatic Institution Consensus Provider | NOT STARTED | 无正式记录 | 不得以不完整公开明细拼装伪一致预期 |

## 5. Research Event / Review Workflow

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| ResearchEvent | DONE V1 | 财务、公告、预期等事件聚合 | 扩到宏观、行业、估值、组合事件 |
| Earnings Verification | DONE V1 | 事前证据 vs 事后实际 | 增加更完整 KPI / 业绩口径 |
| ReviewTask | DONE | Watchlist + Event 生成任务 | 云同步、通知与跨设备 |
| Immutable Review History | DONE | append-only 复盘链 | 后续迁移云端仍需保留语义 |
| 数据警告任务 | DONE | data warning episode / task | 扩生产监控 |

## 6. 数据治理 / 工程基础设施

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| Data Source Registry | DONE V1 | 数据源、状态、覆盖、consumer、fallback | Stage 4 新数据源持续登记 |
| Data Audit | DONE V1 | P0 / blocking risk / mock fallback / zero coercion 等 | 随新 domain 扩规则 |
| Provider Stability Gate | DONE FRAMEWORK | observation / provenance / resolution / threshold | 当前样本不足，资格仍 NO_GO |
| Developer Health Gate | DONE V1 | env check / json output | 可逐步模块化 |
| GitHub Actions CI | DONE | 离线验证、tests、build、artifact checks；Stage 4.1-F/G 门禁、Stage 4.1B Slice 1/2 完整 workflow 均已在对应 PR/main CI 通过；Slice 3 F3 两个 direct gates 已在 PR #54 / main push completed/success | Slice 1 industry gates 已随 PR #56/main CI 通过；Slice 2 PR #58/main CI PASS；Slice 3 PR #59/main CI PASS；Slice 4 PR #61/main CI PASS；中文化 PR #62/main CI PASS；Slice 5 Hosted NOT_RUN |
| Bundle Gate | DONE | 财务等重数据不进入 initial bundle | 新重数据功能继续遵守 |
| UI Audit | DONE | UI 扫描 | 后续随页面扩展 |

## 7. 港股研究链

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| 港股财务 | NOT STARTED | 明确 `not_implemented` | 设计 HKEX / 合规数据源 Provider |
| 港股公告 | NOT STARTED | 明确 `not_implemented` | HKEX 公告 Provider |
| 港股公司指引 | NOT STARTED | 无自动 Provider | 需建立公告证据链 |
| 港股预期 | NOT STARTED | 无可靠自动源 | 与 A 股一致的 evidence contract |
| 港股 ResearchEvent 完整链 | PARTIAL | 行情可进入个股研究 | 等财务/公告/预期补齐 |

## 8. Stage 4 核心新增 Domain

| 能力 | 状态 | 优先级 | 当前结论 / 下一步 |
| --- | --- | ---: | --- |
| Macro / Market Regime Metric Registry V1 | CONTRACT V1 | P0 | 原始指标、native frequency、source/release/revision/stale contract 已固化 |
| 牛熊温度计数学定义 / Normalization V1 | CONTRACT V1 | P0 | 巴菲特、PE、社融、供给压力、缺失数据与 policy cap 已冻结为回测基线 |
| Historical PIT Backtest Dataset Design V1 | CONTRACT V1 | P0 | 周一08:00决策时钟、release vintage、coverage era、质量分层、immutable manifest 已冻结；R1 observation catalog skeleton 已落地 |
| Historical Observation Catalog R1 | IMPLEMENTED / VERIFIED | P0 | PR #13 已合并；strict PIT、provenance、统计口径版本与离线 validator；后续 R2 当前事实见下表 |
| 牛熊温度计 / Market Regime Engine | CONTRACT V1 | P0 | 已恢复 5 个基础模块 + 政策/盈利/结构泡沫 overlay；生产权重仍需历史回测 admission |
| Asset / Account Local Core | DONE V1 / LOCAL CORE | P0 | Phase 1B：Account、Asset、Transaction、CashFlow、PositionSnapshot、DCA Plan revision / Execution、rollover、append-only SQLite、confirmation、idempotency、Audit、HistoricalAssetImport、账户总额 reconciliation 与 DCA temporal binding；不是完整 Portfolio |
| Trusted Asset Import Core | DONE V1 / LOCAL CORE | P0 | ImportTrust seam、evidence validation、prepare/plan/confirm/commit、approval binding、幂等与原子写入已实现 |
| Trusted source adapter / OCR / confirmation UI / real historical migration | NOT STARTED | P0 | 当前只有 fail-closed core seam 与 synthetic/temp 验证；没有真实来源接入、截图解析、浏览器确认流程或真实账户迁移 |
| Portfolio aggregate / Exposure / read model / UI | CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY | P0 | Stage 4.4；AssetReads/Audit、local-only readonly seam，按币种/快照 cohort 的已记录仓位分母；全账户覆盖未证明 |
| Research Thesis ↔ Position Mapping | CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY | P0 | exact Position → Expression revision/confirmation → 原 Thesis/Claim/Evidence；研究关系仅定性 |
| Target Allocation / Rebalance Task | CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY | P0 | 本人确认、append-only history、确定性 current/target/delta、blocked 任务与复核；无 ledger 写入 |
| Performance Attribution / XIRR / TWR | NOT_ADMITTED / NOT_IMPLEMENTED | P0 | 不生成归因、年化、Alpha 或伪绩效 |
| Research Bridge / controlled remote access | LEGACY READ-ONLY IMPLEMENTED；DOMAIN MCP CURRENT | P0 | 旧 Slice 2.5 Bridge 保留 fallback，不再扩建 Wiki/知识代理；Stage 4.5 新 Domain MCP 只暴露 OS Formal Decision System，Slice 1 默认只读 |
| OS Domain MCP / Controlled Tool Layer | CURRENT / D0 NEXT | P0 | 候选域：Evidence、Verified Claim、Thesis、Investment Expression、Portfolio/Exposure、必要 Creator structured context；不代理 Drive/Notion，不提供 raw SQL/万能 query/write/交易 |
| Cloud business database / cross-device sync | DEFERRED | P0 | 当前 Local-first freeze 已覆盖旧 Cloud Store 假设；若未来改变方向须重新冻结 scope，不是现行 Stage 4 默认任务；Research Bridge 自身的 Auth / scope 仍属于 Stage 4.5 缺口 |
| Browser LocalStorage workflow migration | NOT STARTED | P0 | Watchlist / Expectation 仍使用 LocalStorage；迁往 Local Core 或其他目标尚无冻结实施范围，不得写成已迁移 |
| Valuation Center | NOT STARTED | P1 | 当前 V2 路线列入 Stage 4.6+ Advanced Valuation |
| Industry Metric Registry / Provider / Dimensions / Snapshot | Stage 4.2 CLOSED / MERGED / MAIN CI PASS | P1 | 6 owners / NBS + EIA；robotics 双指标与 oil-shipping 四维；独立 mapping + 只读 snapshot，exact pins/adapter/replay；Slice 6 增加 reviewed 相邻期绝对差与证据门禁，准入未提升 |
| Industry Signal / Change Event / Chain Diagram | Stage 4.2 CLOSED / MERGED / MAIN CI PASS | P1 | Slice 3–6 已形成 Signal / Event / Inbox / Evidence、研究结构图、描述型 Derived Signal、固定模板 Claim Candidate 与 F2 引用链；正式景气判断仍由资格门禁 fail-closed |
| Industry Prosperity Eligibility / Formal Score | ELIGIBILITY V1 DONE；FORMAL SCORE NOT STARTED | P1 | Stage 4.2 以 ABSTAIN / NOT_ELIGIBLE 门禁收口；正式 score/direction 延后，须先闭合 scope、PIT、release/revision continuity、Entity、evidence support 与正式方法准入 |
| Full HK Research Chain | NOT STARTED | P1 | Stage 4.6+ |
| Research Copilot / Auto Review | NOT STARTED | P2 | Stage 4.6+；先依赖可信 What Changed / Market Regime / Research workflow 输出 |

### Stage 4.1-G Identity / PBC Evidence / Readiness V2（2026-09-14 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；DATA / PRODUCTION NOT_ADMITTED。** 原始实现基线 `ee7f2e35d967f58812706c2ee06255cc82ea4094`；最终独立审计 HEAD `5489e3f77e284c69d492cfccb7242e2bd9e504d8`。PR #48 CI `34820778498` completed/success；merge/main `f1b85a28dbe83a1ae7875f0b7a80d8b56e25b123`；main push CI `34821083781` completed/success。新增版本化 reviewed identity mapping，核对原 Registry 当前 active/confirmed entry、完整 pin、revision/review 与 exact 1:1；无自动创建或 vocabulary 改名。真实 mapping resolved 0 / unresolved 23，默认 committed readiness 未接本机 Registry owner。原 R2-B sealed archive 已对账，提交 2 份完整 RAW_SOURCE 与 1 条原生 M2 YoY canary，positive replay PASS；完整 894 行 graph 仍 BLOCKED、PBC PARTIAL。V1 保留，V2 重评 23 metrics，normalization / PIT backtest / overall 均 READY 0 / BLOCKED 23；368 条 full-scope gate delta 无状态提升，单条 canary capability BLOCKED→PASS。all-A D3、CSRC 与全部 admission 边界不变。Stage G 专项 27 Node + 14 Python PASS，原 semantic 37 / 应用 725 PASS；PR/main Hosted CI 完整工作流均 completed/success。Stage G 已关闭，主开发线进入 **Stage 4.1B Research Inbox / Evidence Surface / Product Shell**。详见 [Stage 4.1-G design / validation](market-regime/identity-pbc-evidence-closure-v2.md) 与 [V2 report](../research-data/market-regime/semantic-readiness/report.v2.json)。

### Stage 4.1-F Semantic Runtime / Readiness（已合入的 V1 发布事实）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION/DATA NOT_ADMITTED。**

F1 的 28 个 PBC definition bindings、精确 Query、PIT revision selector 与只读 Market Regime adapter 已合入，复用原 EntityRef schema / Observation / Definition；正式 Entity Registry resolution 仍未实现。审计 remediation 移除 metricId→EntityRef 的自动拼接，entity binding=null、policy revision 2 的 reviewed mapping/Registry refs=null，全部查询保留 ENTITY_REGISTRY_UNRESOLVED，禁止自动创建实体。readiness 覆盖 23 个 metric，normalization / PIT backtest 按独立 15/16 gate 集计算，各 READY 0 / BLOCKED 23；progress 另列 PARTIAL 9 / NOT_PROVEN 14。三项 semantic gate 已在 PR #45 与 main push CI 实际执行并通过。PBC 894 行 committed ledger 与官方 retained excerpt 完成诊断重放；完整 RAW_SOURCE/catalog/extraction graph 不在 committed 输入中，不能声称完整正向 raw replay 或 eligible value。all-A D3 继续 NOT_ADMITTED，formal/strict=0，target/coverage=null。PR #45：audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac`，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`，PR CI `34673260311`、main CI `34673371463` 均 completed/success。详见 [Stage 4.1-F design / validation](market-regime/semantic-runtime-readiness-v1.md) 及 [机器报告](../research-data/market-regime/semantic-readiness/report.v1.json)。

### Stage 4.1 Metric Source / Formula 状态摘要

R2 当前实现已逐项合入；以下验证仅指本轮离线测试及 committed evidence 一致性，不提升原始数据、历史完整性或生产 admission。

| R2 切片 | 实现 / 验证 | 数据状态与证据 |
| --- | --- | --- |
| Scope Freeze / R2-A CORE | IMPLEMENTED / VERIFIED；PR #26 / #27 | plan / release / artifact identity、coverage、calendar、revision 与 fail-closed validator；[CORE](market-regime/historical-dataset-r2a-core-v1.md) |
| R2-B PBC | IMPLEMENTED / VERIFIED；PR #28 | PARTIAL；M2 余额与同比各 256/260，AFRE 余额 129/140、同比 111/140（first release 110）；894 observations；[final evidence](../research-data/market-regime/source-catalog/pbc-final-evidence.v1.json)，inventory / revision 穷尽性仍 PARTIAL |
| CSRC C1 / C1.1 | IMPLEMENTED / VERIFIED；PR #30 / #31 | PARTIAL；indexed 247/260，13 gaps；recovery 0/13；IPO field-ready 87，refinancing readiness 0；不是正式融资 observations |
| CSRC C2A1 / C2A2 | IMPLEMENTED / VERIFIED；PR #32 / #33 | NOT_ADMITTED；87 中 26 definition-compatible、61 归月未证明；26 月 PIT 调查成功 0/26，eligible=[]、formal observations=0；[provenance](market-regime/csrc-ipo-historical-release-provenance-r2c2a2-v1.md) |
| SSE / SZSE / BSE D1 | IMPLEMENTED / VERIFIED；PR #34 / #35 / #36 | 三所 source contract、bounded inventory 与 guarded adapter 已实现；历史数值均 NOT_ADMITTED，完整官方日历、定义适用及 release/vintage 仍有 blocker |
| all-A D2 | IMPLEMENTED / VERIFIED；PR #37 | **NOT_ADMITTED / numericAggregateCount=0 / targetCount=null / coveragePercent=null**；2 eras × 3 fields，完整未准入窗口保留；[committed report](../research-data/market-regime/source-catalog/all-a-d2/admission-report.v1.json) |
| R2-E Integrated / all-A D3 | IMPLEMENTED / VERIFIED；PR #42 | **MERGED / NOT_ADMITTED**；已补 official calendar/denominator evidence、release/PIT evidence、exchange field-era verification、expanded candidate observations 与 D3 rerun；完整 denominator/targetCount 在官方完整交易时段枚举未证明时仍未知，缺充分 release provenance 的 candidate 不进入 formal/strict-PIT observation |
| normalization / backtest / 正式 Market Temperature UI | NOT_STARTED | 没有因上述实现或测试获得授权 / admission |

| 指标 | 当前状态 | 说明 |
| --- | --- | --- |
| 融资余额 | FORMULA READY / SOURCE_READY | 融资余额÷A股流通市值，70%水平分位+30%20日动量；严格历史从2010启动期开始 |
| 权益 ETF 净流入 | FORMULA CANDIDATE / PROBE_REQUIRED | 20日净申赎÷期初权益ETF AUM；ETF虽自2005存在，但净申赎历史不得用成交额替代 |
| 北向资金 | FORMULA CANDIDATE / SOURCE_READY | 2014-11-17起沪股通；2016-12-05起沪深两通道；scope break 必须版本化 |
| A 股成交额 | FORMULA READY / NOT_ADMITTED | SSE/SZSE/BSE source contract 与 D2 已实现；统一日频数值仍 0、完整分母未知 |
| 新增投资者 | FORMULA CANDIDATE / PROBE_REQUIRED | 2014一码通存在语义断点；V1目标从2015可比口径开始，不拼接旧“新增股票账户” |
| 市场 PE 百分位 | FORMULA READY / NO_GO | V1主锚沪深300 TTM PE；官方连续可自动化历史估值序列仍未证明，严格 PIT Provider 保持 NO_GO |
| 中国版巴菲特指标 | FORMULA READY / NOT_ADMITTED | 全 A 总市值仍未准入；GDP revision 与北交所 scope 约束保留 |
| 股票供给压力 | FORMULA READY / NOT_ADMITTED | CSRC XLS probe、IPO definition/provenance gate 已实现，formal financing observations=0；再融资及减持/回购未完成 |
| M2 | FORMULA READY / PARTIAL | R2-B 余额、同比各 available 256/260；未证明目录 / revision 穷尽性 |
| 社融 | FORMULA READY / PARTIAL | R2-B 余额 available 129/140；同比 111/140、first-release 110/140；backcast 不倒填到早期 cutoff |
| 工业企业利润 | CLASSIFIER CANDIDATE / SOURCE_READY | 2005–2010按旧全国口径较低频使用；2011后全国月度、1月免报 |
| 上市公司盈利扩散 | NOT_READY | 当前56公司Provider不足以代表全A |
| 政策周期修正 | ARCHITECTURE READY | 总温度修正上限 ±5；初始 strict backtest 可先禁用，再独立建设历史政策事件集 |
| 结构性泡沫温度 | ARCHITECTURE READY | 独立0–100输出，V1不直接修改大盘温度 |

## 9. 明确延后 / 不应误做的事项

| 事项 | 状态 | 原因 |
| --- | --- | --- |
| 微信小程序 | DEFERRED | 当前先补足投研看板；未来可复用云端业务层 |
| 自动机构一致预期 Provider | DEFERRED / NO_GO | 当前公开源不满足生产合同 |
| A 股财务/公告直接加入默认 refresh | DEFERRED UNTIL ADMISSION | Stability Gate 尚未达标 |
| OCR 全量公告 | DEFERRED | 不是当前最优先能力，且不能牺牲证据可靠性 |
| 一次性重构整个 `App.tsx` | DEFERRED | 应在新增 Stage 4 Feature 时渐进拆分 |
| 未回测即输出正式牛熊温度 | DEFERRED / FORBIDDEN | 旧权重只是 seed；必须完成历史数据集、point-in-time 回测和公式版本 admission |

## 10. Stage 状态

### Stage 4.0 — PASS

- [x] 总建设方案存在并以当前代码为基线
- [x] 当前架构文档存在
- [x] Feature Registry 存在
- [x] README 已更新为当前项目入口
- [x] 已完成 / Partial / Not Started / NO_GO 边界明确
- [x] Stage 4.1–4.6 主路线明确
- [x] 文档分支与 `main` 已独立比较，未发现业务代码变更

### Stage 4.1 — MAINLINE CLOSED / PARALLEL DATA TRACK CONTINUES

已完成：

- [x] 找回并核对原牛熊温度计云端规则 / 模型 / 数据源资料
- [x] Market Regime Metric Registry V1
- [x] native-frequency-aware refresh contract
- [x] release / stale / revision 基础语义
- [x] 第一轮官方数据源审计
- [x] 冻结 V1 数学定义：融资、成交、沪深300 PE、巴菲特指标、净供给、M2、社融
- [x] point-in-time percentile normalization baseline
- [x] missing-data / historical-era reweight 规则
- [x] policy correction ±5 cap
- [x] Profit Cycle 与 Structural Bubble 独立 overlay 架构
- [x] 预声明 Candidate A–D，避免无约束过拟合
- [x] Historical Data Availability & Backtest Dataset Design V1
- [x] 确认主要指标结构性起点和定义断点
- [x] 冻结 Monday 08:00 Asia/Shanghai point-in-time 决策时钟
- [x] 定义 release-time confidence / PIT quality tier
- [x] 定义 2005–present coverage eras 与可比性标签
- [x] 定义 SourceDefinitionVersion / ObservationVintage / Weekly Manifest / Feature Matrix 数据结构
- [x] P0 Source Probe Pack V1：M2 PASS；AFRE/全市场统计/CSRC 月报 PARTIAL；CSI300 历史 TTM PE NO_GO
- [x] Task 4.1-R1 Historical Observation Catalog Skeleton：PR #13 合并，strict PIT / provenance / source-definition guards 完成
- [x] Stage 4.1-F Semantic Runtime / Readiness：PR #45 合入；F1 Macro 只读 runtime、PBC adapter 与独立 normalization/backtest readiness gate 已进入 main，仍保持 production/data NOT_ADMITTED
- [x] Stage 4.1-G Identity / PBC Evidence / Readiness V2：PR #48 合入并通过 PR/main CI；计划收口完成，DATA / PRODUCTION 仍 NOT_ADMITTED
- [x] Stage 4.1B / Slice 1 Research Inbox + Evidence Drawer V1：PR #50 合入并通过 PR/main CI
- [x] Stage 4.1B / Slice 2 Auditable Chart V1 + Product Shell V1：PR #52 合入并通过 PR/main CI
- [x] Stage 4.1B / Slice 3 F3 Research Eval Harness V1：最终审计 HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`；PR #54 / PR CI / main CI 全部通过；reference 33/33 PASS，actual service 0/33、NOT_IMPLEMENTED 33/33；Stage 4.1B 正式 CLOSED

R2 已实现切片与剩余工作：

- [x] R2-A CORE、R2-B PBC、CSRC C1/C1.1/C2A1/C2A2、SSE/SZSE/BSE D1、all-A D2 已合入上述基线
- [ ] R2 完整数据 / 逐源准入：继续保留上表 PARTIAL / NOT_ADMITTED，后继 evidence/contract 工作作为并行数据支线单独冻结范围
- Master Audit Remediation V1：修复与验证见版本化记录；实际 merge / CI 状态按本文顶部规则核对。
- [ ] P1 Source Probe：新增投资者、实际减持、实际回购、ETF净申赎
- [ ] 构建 2005–present weekly immutable manifests
- [ ] 执行 Candidate A–D 回测与参数选择
- [ ] 公式版本锁定后才进入 Provider / Engine / UI 实现

当前 Stage 4.1 核心文档：

- `docs/market-regime/metric-registry-v1.md`
- `docs/market-regime/source-audit-v1.md`
- `docs/market-regime/formula-normalization-v1.md`
- `docs/market-regime/backtest-dataset-design-v1.md`
- `docs/market-regime/p0-source-probe-v1.md`
- `docs/market-regime/observation-catalog-r1.md`（已随 PR #13 合入 `main`）


### Stage 4.2.5 — Creator Viewpoint Tracker V1（CLOSED）

- 状态：**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY**。
- final audited HEAD：`025352f5bb7879ce6e1e2130fb9cd43788409928`；PR #67；PR CI `35489459196` success；merge/main `2cea477105d3e63242e65b7f3eec0b658a87ce17`；main CI `35489619887` success。
- 正式能力：CreatorSource、ViewpointObservation、reviewed chronology/current、Transition、T+ Review、Event links、JSON recovery、Excel analysis copy。
- 语义边界：External Commentary；不自动晋升 Provider Fact / Verified Claim / Thesis。
- Stage 4.3 复用方式：作为第一条 L0/L1 Research Memory adapter，不复制第二套 Creator 真源。

### Stage 4.3 — External Knowledge + Research Decision（CLOSED）

Slice 1 CLOSED；Slice 2/2.5 代码已 MERGED / MAIN CI PASS；真实验收不等于代码关闭。R0–R3 已 CLOSED；R3 #77 与 A 阶段 #78 的独立审计、PR/main CI、合入和 Production READY 见 [Final Closeout](stage-4-3-r3-investment-expression-closeout.md#final-closeout--2026-09-23-current)。

| Capability | Classification / current status | Authority / boundary |
| --- | --- | --- |
| External Knowledge Lane | DEFAULT WORKFLOW；用户报告真实 POC 可用，OS API NOT_CONNECTED | Drive L0 durable archive → ChatGPT AI draft → Notion L2；来源/版本/变化原因/review；不是 Provider Fact/Verified Claim |
| ResearchSourceRef / ResearchExtraction / Creator adapters | KEEP / IMPLEMENTED | 复用原 Creator owner，unknown domain fail closed；不复制原文/Current View |
| Evidence / F2 Graph / Evidence Drawer | KEEP：既有 Evidence / Industry F2 实现 / Drawer；通用 F2 runtime 仍 NOT_IMPLEMENTED | 原 pins/PIT/admission/revision，不建立第二 Claim Graph |
| knowledge-contribution.v1 | KEEP / COMPATIBILITY INTERCHANGE | fallback transport；候选导入与正式审核分开 |
| Legacy Local Wiki / Bridge | FREEZE / LEGACY COMPATIBILITY / IMPLEMENTED / MERGED | WikiEntry/Revision/Review、JSON backup/recovery、Markdown/Obsidian、IndexedDB原件、PDF/MD/TXT解析、八个认证只读MCP、编辑/历史UI全部保留 |
| OS 自研 Wiki 默认阅读中心 / 浏览器上传→staging→JSON 日常链 / OS Wiki MCP 默认代理 | DEPRECATE AS PRIMARY WORKFLOW | 默认转外部知识路线；不删除已有能力、不退役 Bridge |
| Verified Claim V1 | R1 CLOSED / MERGED / MAIN CI PASS | 原 candidate pin + graph digest/target 精确绑定；双 F2/owner 校验、用户确认、append-only revision/rejection/history；0 real verified |
| Research Context | R1 IMPLEMENTED / LOCAL ONLY | kind/title/URL 非权威背景；不进入 F2、不保存外部正文或调用 API |
| Thesis V1 + Macro → Industry | R2 CLOSED / MERGED / MAIN CI PASS | scenario/drivers/catalysts/risks/invalidation/confidence/asOf/revision/用户确认 |
| Investment Expression + Closeout | R3 CLOSED / INDEPENDENT AUDIT PASS / MERGED / PR CI PASS / MAIN CI PASS / Production READY | exact Thesis revision、用户确认、append-only、trace、backup/recovery；ETF/Index/Equity 正向仅 synthetic；真实 0 formal |
| Pre-4.4 Research Bridge Legacy Hardening | INDEPENDENT AUDIT PASS / PR CI PASS / MERGED / MAIN CI PASS / Production READY | 配置分类、安全诊断、fail-before-store、HTTP → MCP 与 TTL/revoke/selection/tenant isolation 回归；仍 Legacy / read-only / fail-closed，私人验收未升级 |

两条 lane 可以引用，但 Notion/券商研报/AI Draft/Creator Commentary 不能单独产生 Verified Claim。OS 不建立 Notion 正文镜像或新的云业务库；V1 contracts、legacy storage/backup/review保持兼容。旧 Slice 3 不再独立建设 Creator Wiki；后续 Stage 4.5 提供 Creator context/Evidence/Claim/Thesis/Expression Domain Tools，不重复代理 Drive/Notion。

完整分类、源文件地图、真实验收缺口与新版关闭条件见 [R0 正式决定](stage-4-3-r0-external-knowledge-rebaseline.md)。
