# 投资研究看板 Feature Registry

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
| 行业研究 | PARTIAL | 既有研究资料、细分、产业链、公司池；Registry 驱动 NBS 双 metric + EIA weekly inventory/history/审计 preview | **Slice 3 CLOSED；Slice 4 VERIFIED LOCALLY / PENDING REVIEW；NOT_ADMITTED；prosperity 未实现** |
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
| GitHub Actions CI | DONE | 离线验证、tests、build、artifact checks；Stage 4.1-F/G 门禁、Stage 4.1B Slice 1/2 完整 workflow 均已在对应 PR/main CI 通过；Slice 3 F3 两个 direct gates 已在 PR #54 / main push completed/success | Slice 1 industry gates 已随 PR #56/main CI 通过；Slice 2 PR #58/main CI PASS；Slice 3 PR #59/main CI PASS；Slice 4 Hosted NOT_RUN |
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
| Portfolio aggregate / Exposure / read model / UI | NOT STARTED | P0 | Stage 4.4；复用 Phase 1B Local Core，补组合聚合、macro / industry exposure 与浏览器读模型，不重建账本 |
| Research Thesis ↔ Position Mapping | NOT STARTED | P0 | Stage 4.4 |
| Target Allocation / Rebalance Task / Performance Attribution | NOT STARTED | P0 | Stage 4.4；XIRR / TWR 等仍需独立 methodology / admission |
| Research Bridge / controlled remote access | NOT STARTED | P0 | Stage 4.5；须复用 Domain API、最小权限、确认与 Audit，不暴露 raw DB |
| Cloud business database / cross-device sync | DEFERRED | P0 | 当前 Local-first freeze 已覆盖旧 Cloud Store 假设；若未来改变方向须重新冻结 scope，不是现行 Stage 4 默认任务；Research Bridge 自身的 Auth / scope 仍属于 Stage 4.5 缺口 |
| Browser LocalStorage workflow migration | NOT STARTED | P0 | Watchlist / Expectation 仍使用 LocalStorage；迁往 Local Core 或其他目标尚无冻结实施范围，不得写成已迁移 |
| Valuation Center | NOT STARTED | P1 | 当前 V2 路线列入 Stage 4.6+ Advanced Valuation |
| Industry Metric Registry / Provider | Slice 2 MERGED；Slice 4 VERIFIED / PENDING REVIEW | P1 | 3 owners / NBS + EIA；robotics + oil-shipping；月度产量/官方同比 + 周度库存；显式 Source Adapter 分派、exact pins/replay；其他行业 unavailable，准入未提升 |
| Industry Signal / Change Event / Chain Diagram | Slice 3 MERGED / MAIN CI PASS；Slice 4 PENDING REVIEW | P1 | **Stage 4.2 Slice 3**：latest 双 Signal 聚合一个 release event、Inbox/Evidence 导航、研究结构图与独立 Provider overlay；freshness 见专项交付；不产生景气判断 |
| Industry Prosperity Score | NOT STARTED | P1 | Stage 4.2；先建立正式 metric/provider/history，再讨论评分/景气派生 |
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
