# 当前开发执行索引 · 2026-09-07

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
| F2 Evidence Graph V1 | 统一 Source → Artifact → Evidence → Fact → Derived Metric → Claim → Thesis → Position → Review 的引用关系；不预设 Graph DB | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；runtime NOT_IMPLEMENTED | Stage 4.1B / 4.3 |
| F3 Investment Research Eval Suite V1 | 用 Golden Cases 验证 PIT、检索、计算、Evidence、Claim 与未来 Agent tool use | 合同已合入；Harness IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；reference 33/33 PASS，actual service 0/33、NOT_IMPLEMENTED 33/33；真实 Agent runtime NOT_IMPLEMENTED | Stage 4.1B 起持续扩展 |

本轮 [F1/F2/F3 Scope Freeze](financial-research-foundations-contract-v1.md) 新增独立版本化合同包与八类 33 个 synthetic Golden Cases，保留 `contracts/v1` 的原 schema / 权限 / Local Core runtime registry。独立审计在 remediation 后 PASS；PR #43 以 audited HEAD `204176924b23ed5c1d480203d284c0b01a28f966` 合入，PR CI run `34621319869` completed/success，merge/main `4ad9ec286a6cb73485ebf0e88a28837c0ae8b3c0`，main push CI run `34621558359` completed/success。Stage 4.1-F 经独立审计 PASS 后由 PR #45 以 audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac` 合入，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`，PR CI run `34673260311` 与 main push CI run `34673371463` 均 completed/success。Stage 4.1B Slice 3 Harness 由 PR #54 以 audited HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea` 合入，merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`，PR CI `35207107183` 与 main CI `35207381240` 均 completed/success。production/data 仍 NOT_ADMITTED；Entity Registry mapping、完整 RAW_SOURCE replay 与 R2 source blockers 仍未闭合。

依据 [2026-09-13 最新增量方向](current-development-direction-2026-09-13.md)，CURRENT 战略顺序为：

1. **Stage 4.1-G — CLOSED / MERGED / MAIN CI PASS**：独立审计 HEAD `5489e3f77e284c69d492cfccb7242e2bd9e504d8`；PR #48 CI `34820778498` completed/success；merge/main `f1b85a28dbe83a1ae7875f0b7a80d8b56e25b123`；main push CI `34821083781` completed/success。数据 / production admission 仍未提升。未闭合的单指标、Provider、历史覆盖率及 normalization/backtest 等任务转为并行数据支线；仅当满足最新方向 §1.1 的主线正确性/安全阻断条件时重新评估。
2. **Stage 4.1B — CLOSED / MERGED / MAIN CI PASS**：Slice 1 PR #50、Slice 2 PR #52、Slice 3 PR #54 均已完成独立审计、PR/main CI 与合并。最终 Slice 3 audited HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`，merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`。Research Inbox / Evidence Drawer / Auditable Chart / Product Shell / F3 Eval Harness 均已进入 main；production/data admission 未因此提升。
3. **Stage 4.2 — CURRENT MAINLINE：Industry Data Platform**：Industry Metric Registry / Provider / history / delta / prosperity，并接入 F1/F2/F3。
4. **Stage 4.3 — Top-down Research Workflow**：Macro → Industry、Claim ↔ Evidence、Industry Thesis / revision、Investment Expression、Research Memory。
5. **Stage 4.4 — Portfolio Exposure MVP**：复用 Phase 1B Local Core，补 thesis ↔ position、macro / industry exposure、target allocation、rebalance、read model / UI。
6. **Stage 4.5 — Research MCP Gateway / Controlled Tool Layer**：Local-first Domain Tools、Auth/scope/confirmation/Audit、Agent tool-use Evals；不暴露 raw DB / SQL。
7. **Stage 4.6 — ChatGPT-connected Research Agent / LLM Wiki / Artifact / Global Coverage**：以 ChatGPT Web / LLM Client 与受控 MCP 连接本地研究底座，研究写回继续 prepare-preview-confirm-commit；具体范围及后续扩展以最新方向为准，Agent production 受 F3 Eval 门槛约束。

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
- Stage G 已关闭；该段保留 2026-09-14 时点“主线进入 Stage 4.1B”的历史事实；CURRENT 主线见本文顶部，现已进入 Stage 4.2。未闭合单指标数据任务继续作为并行数据支线，不重新成为产品主线 blocker，除非满足最新方向 §1.1 的真实正确性/安全阻断条件。

## Stage 4.1-F — Semantic Runtime / Readiness（2026-09-12 已合入的 V1 发布事实）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION/DATA NOT_ADMITTED。**

- 28 个 PBC F1 definition bindings、只读 Macro Semantic API、native vintage 截止前唯一 revision 选择与 owner adapter 已合入；EntityRef 仅为请求 claim，正式 Registry-backed mapping 尚不可用。审计 remediation 已去除 metricId 自动生成 EntityRef，entity binding=null，ENTITY_REGISTRY_UNRESOLVED 始终阻断，不创建实体。
- 23 metric normalization / PIT backtest readiness：分别按冻结 15/16 gate 集计算，各 READY 0 / BLOCKED 23；overall=BOTH_READY，progress 独立为 PARTIAL 9 / NOT_PROVEN 14。PBC PARTIAL 与 CSRC/all-A NOT_ADMITTED 保留；未知分母仍 null。
- PBC committed ledger 894 行及 retained official excerpt 诊断重放可复现；完整 raw/catalog/extraction graph 未 committed，正向 RAW_SOURCE replay 仍有真实 evidence blocker。
- PR/main CI workflow 已加入 bindings validate、semantic-runtime tests、readiness validate 三项直接门禁；PR #45 CI `34673260311` 与 main push CI `34673371463` 均 completed/success。
- PR #45 audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac`，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`。当前停止点：Stage 4.1-F 已关闭并合入；下一业务任务仍须服从 readiness 报告中的真实 blocker，不自动进入 normalization/backtest。
- 验证与具体限制：[Stage 4.1-F design / validation](market-regime/semantic-runtime-readiness-v1.md)。
