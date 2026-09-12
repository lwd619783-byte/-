# 当前开发执行索引 · 2026-09-07

> CURRENT 战略路线入口：[`investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md`](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md)。该文档从 2026-09-11 起负责后续战略顺序、跨域基础设施与每步同步规则；本文继续负责 CURRENT 开发进展、停止点与已发生交付事实。

> UI V1.0 设计入口：[NEON-RC1-20260909 获批事实源](ui-redesign/v1/README.md)与[D0–D5 执行索引](ui-redesign/v1/execution-index.md)。2026-09-09 APPROVED / FROZEN；D0 仅文档归档，D1–D5 未派发，不表示 UI 已实现或业务准入。

本索引固化当前任务顺序，不重写历史审计结论，也不重命名已有 Phase 编号。产品保持**单用户 Local-first、全球研究视角**，继续复用已有证据、PIT、Provider Stability 与审计基础。全球视角不等于已覆盖全球行情。

> CURRENT 更新：2026-09-12。已核对 `origin/main @ 4ad9ec286a6cb73485ebf0e88a28837c0ae8b3c0`。Financial Research Foundations V1 已由 PR #43 合入：audited HEAD `204176924b23ed5c1d480203d284c0b01a28f966`，PR CI run `34621319869` completed/success，main push CI run `34621558359` completed/success。固定 SHA 仅代表本次记录时点，不是永久 CURRENT main。下表既有 Phase 的 SHA/CI 是相应关闭时点证据；R2 以 Git ancestry、当前代码、committed artifacts、专项验证与对应 PR 事实登记。
> PR、merge 与 CI 必须分别按真实状态登记；静态 CURRENT 文档不预写 MAIN MERGED，也不自证 CI PASS。

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
- 2026-09-11 起，Phase 1B 后的战略顺序与跨域基础设施以[Financial Research OS 重基线](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md)为 CURRENT 入口；业务语义与准入仍由冻结合同、Feature Registry、Architecture 和专项审计决定。
- Stage 4.1 R2 已进入逐源实现 / 准入未闭合阶段，不再是整体 NOT_STARTED；不得因为代码或证据闭环任务已合并就自动提升生产准入。

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
| F1 Financial Semantic Registry V2 | 统一 metric / entity / unit / temporal / lineage / quality / allowed-use 语义；复用既有 Data Source Registry 与领域 Metric Registry，不建立第二套同义 Registry | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；Stage 4.1-F Macro runtime 功能分支 IMPLEMENTED / PENDING REVIEW | Stage 4.1 / 4.2 |
| F2 Evidence Graph V1 | 统一 Source → Artifact → Evidence → Fact → Derived Metric → Claim → Thesis → Position → Review 的引用关系；不预设 Graph DB | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；runtime NOT_IMPLEMENTED | Stage 4.1B / 4.3 |
| F3 Investment Research Eval Suite V1 | 用 Golden Cases 验证 PIT、检索、计算、Evidence、Claim 与未来 Agent tool use | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；Agent/service harness NOT_IMPLEMENTED | Stage 4.1B 起持续扩展 |

本轮 [F1/F2/F3 Scope Freeze](financial-research-foundations-contract-v1.md) 新增独立版本化合同包与八类 33 个 synthetic Golden Cases，保留 `contracts/v1` 的原 schema / 权限 / Local Core runtime registry。独立审计在 remediation 后 PASS；PR #43 以 audited HEAD `204176924b23ed5c1d480203d284c0b01a28f966` 合入，PR CI run `34621319869` completed/success，merge/main `4ad9ec286a6cb73485ebf0e88a28837c0ae8b3c0`，main push CI run `34621558359` completed/success。该合同交付时三项 production 仍 NOT_ADMITTED，runtime/Agent harness 当时 NOT_IMPLEMENTED；该历史交付没有 runtime/data flow 或战略 scope 变化。当前 Stage 4.1-F 功能分支状态见下文，原合同交付记录保留。

重构后的 CURRENT 战略顺序为：

1. **Stage 4.1 — Market Regime Foundation**：先服从当前真实 admission / blocker；随后才进入 normalization / backtest / formula admission / Engine。Stage 4.1 Metric Registry 成为 F1 首个领域实现。
2. **Stage 4.1B — Product Shell / Research Inbox / Evidence Surface**：Research Inbox、Evidence Drawer、Auditable Chart、Eval harness。
3. **Stage 4.2 — Industry Data Platform**：Industry Metric Registry / Provider / history / delta / prosperity，并接入 F1/F2/F3。
4. **Stage 4.3 — Top-down Research Workflow**：Macro → Industry、Claim ↔ Evidence、Industry Thesis / revision、Investment Expression、Research Memory。
5. **Stage 4.4 — Portfolio Exposure MVP**：复用 Phase 1B Local Core，补 thesis ↔ position、macro / industry exposure、target allocation、rebalance、read model / UI。
6. **Stage 4.5 — Research Bridge / Controlled Tool Layer**：Local-first Domain Tools、Auth/scope/confirmation/Audit、MCP/其他 Adapter、Agent tool-use Evals；不暴露 raw DB / SQL。
7. **Stage 4.6+ — Research Agent / Artifact / Global Coverage**：Research Agent、Artifact Center、Notification、Full HK / global chain、Advanced Valuation、商业数据 entitlement；Agent production 受 F3 Eval 门槛约束。

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

## Stage 4.1-F — Semantic Runtime / Readiness（2026-09-12 功能分支）

IMPLEMENTED / VERIFIED（本地限定范围） / PENDING INDEPENDENT REVIEW；未登记 MERGED / MAIN CI PASS / PRODUCTION ADMITTED。

- 28 个 PBC F1 definition bindings、原 EntityRef 精确身份映射、只读 Macro Semantic API、native vintage 截止前唯一 revision 选择与 owner adapter。
- 23 metric normalization / PIT backtest readiness：当前均 BLOCKED，建设进度单列。PBC PARTIAL 与 CSRC/all-A NOT_ADMITTED 保留；未知分母仍 null。
- PBC committed ledger 894 行及 retained official excerpt 诊断重放可复现；完整 raw/catalog/extraction graph 未 committed，正向 RAW_SOURCE replay 仍有真实 evidence blocker。
- CURRENT feature-registry、architecture 已同步本分支实际 runtime/data flow。战略顺序未变，roadmap 不机械改写。
- 验证与具体限制：[Stage 4.1-F design / validation](market-regime/semantic-runtime-readiness-v1.md)。普通 push 后核对 HEAD，停止等待独立审计；不创建 PR、不 merge。
