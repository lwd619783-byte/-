# 当前开发执行索引 · 2026-09-07

本索引固化当前任务顺序，不重写历史审计结论，也不重命名已有 Phase 编号。产品保持**单用户 Local-first、全球研究视角**，继续复用已有证据、PIT、Provider Stability 与审计基础。全球视角不等于已覆盖全球行情。

## 冻结顺序与停止点

| 顺序 | 实现与验证门槛 | 独立审查 / 合入门槛 | 当前状态与停止点 |
| --- | --- | --- | --- |
| 独立 P0 可信展示纠偏 V1 | 移除条数评分和方向结论；source identity、quality status、value coverage、data time / freshness 分离；固定时钟边界及组件交互测试；环境检查、tests、data audit、build、UI 静态审计和浏览器验证，逐项记录限制 | 普通 push 后独立远端审查最终 HEAD；审查通过并获授权后才创建 PR，检查该 HEAD 的 CI，再决定合入 | 已合并并通过 main CI；本次核对 main 快照为 `285ff87e8d109730956517edcaeadec501d79f4c` |
| Phase 1A — Local Core Foundation | 按[实施基线](investment-dashboard-v2-phase-1a-local-core-foundation.md)落实合同校验、SQLite、Entity Registry / Resolver、append-only Audit、Repository / Domain 基础；通过专项与原有门禁 | 独立审查权限、事务、时间、历史与 bundle 边界；获授权后 PR / 精确 HEAD CI / 合入 | **CLOSED / MERGED / MAIN CI PASS**；合并快照 `41b3caa5e063805ec0ca42efc9c74ea17491ffc4`，对应 [main CI 34115340100](https://github.com/lwd619783-byte/-/actions/runs/34115340100) 已核对 completed/success；旧实施验证记录保留原时点结论 |
| Phase 1A.5 — Agent Skills Consolidation | 正式 [Skill Registry / Router](agent-skills.md)、固定上游审计、项目 Domain / Local Core / minimalism Skills、只读 check 和隔离 fixture 验证；Impeccable facade / vendor、LICENSE、副本写入三项修复已获用户确认独立复审通过 | 已完成 PR / 合并与 main CI 核验；历史验证文件保留 PR 前登记节点 | **CLOSED / MERGED / MAIN CI PASS**；合并快照 `87d33595a49dc99463333ad4637b44b7e33f68a9`，本轮核对 [main CI 34125472101](https://github.com/lwd619783-byte/-/actions/runs/34125472101) 为 completed/success，headSha 与合并快照一致 |
| Phase 1B — Long-term Account & DCA Core | 当前任务已明确授权；复用 Phase 1A Local Core，实现账户、资产、流水、持仓、DCA 和 deterministic import，测试仅用 synthetic/temp DB | 普通 push 后停止，等待独立远端复审；不创建 PR / 合并 / 进入下一 Phase；合同缺口须重新审计 | **IMPLEMENTED PARTIALLY / BLOCKED / PENDING INDEPENDENT RE-REVIEW**；[实施映射](investment-dashboard-v2-phase-1b-long-term-account-dca-core.md)、[原验证](investment-dashboard-v2-phase-1b-implementation-validation.md)及[本轮审查修复验证](investment-dashboard-v2-phase-1b-review-fixes-validation.md)；baseline/provenance 防护已补强，DCA 金额等式已删除；CB-1/2/3 仍未解决，未宣称独立复审或 CI 通过 |

验证失败或工具阻塞须标明原因与受影响验收项；安全改动可推送待审查，但不得称验收通过。测试通过、独立审查、合入与生产准入是不同状态，任何一步不自动授权下一步。

## 后续共用边界

- 后续研究入库、行业 / Wiki、多 Agent 成果共用统一实体、版本、审计与 **prepare-plan-confirm-commit**，不建立平行系统。
- Phase 1A 已落实 **provider identifier 精确匹配**与 **resolver 合同输入**的内部 seam；后续继续复用当前代码与[实施验证中的合同边界](investment-dashboard-v2-phase-1a-implementation-validation.md)，不擅改 `contracts/v1`。
- Phase 1A.5 的 Skill 治理范围已经关闭。当前 Phase 1B 只扩展本地资产核心；不改冻结 contracts / 001 migration、不加 UI / Provider refresh / performance / cloud / MCP / broker / 真实迁移，不升级依赖或 Skill；真实 generated 数据不进入本分支改动。
- [Local-first 冻结决定](investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md)覆盖旧云端业务数据库假设；[Master Plan](investment-dashboard-master-plan-2026-09.md)中的 Stage 4 顺序保留为历史基线。当前执行顺序以本索引为准，业务语义与准入仍由冻结合同和专项审计决定。

## P0 展示口径与待办

- 宏观按展示条目计覆盖（重复指标未去重），来源标识与质量状态分别保留原值；没有正式模型时不输出 0—100 方向分。月 / 季度报告期不补发布时间，含糊的来源日期标为语义待核验。
- 已核对 A / H 股生成脚本：行情 `updatedAt` 是采集运行时间；不替代市场观测时间。24 小时只划分采集时间窗口，不是统一失效规则；旧值可继续作为历史快照查看。
- 缺失、非法、未来时间不算正常新鲜；汇总保留完整分母。来源标识、质量状态、价格覆盖与时间/时效分别展示；status=real 的计数仅表示质量状态，不代表来源真实性。当前未实现可靠交易日历或逐指标发布规则，故时效保守标为待核验。
- Mock 数据包时间为空；非 Mock 的 manifest.updatedAt 仅显示“数据包更新时间”，不代表行情采集时间或所有模块同步刷新。
- 本轮[验证记录及基线阻塞](p0-data-trust-display-v1-validation.md)单独列明；远端提交状态见任务交付记录。独立审查须核对最终 diff、测试、浏览器证据和最终远端 SHA，不沿用旧提交的 CI。
