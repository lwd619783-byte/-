# 当前开发执行索引 · 2026-09-07

本索引固化当前任务顺序，不重写历史审计结论，也不重命名已有 Phase 编号。产品保持**单用户 Local-first、全球研究视角**，继续复用已有证据、PIT、Provider Stability 与审计基础。全球视角不等于已覆盖全球行情。

## 冻结顺序与停止点

| 顺序 | 实现与验证门槛 | 独立审查 / 合入门槛 | 当前状态与停止点 |
| --- | --- | --- | --- |
| 独立 P0 可信展示纠偏 V1 | 移除条数评分和方向结论；来源、覆盖、时间分离；固定时钟边界及组件交互测试；环境检查、tests、data audit、build、UI 静态审计和浏览器验证，逐项记录限制 | 普通 push 后独立远端审查最终 HEAD；审查通过并获授权后才创建 PR，检查该 HEAD 的 CI，再决定合入 | 已实现，待独立审查/合入；本任务停在功能分支，不代表生产上线 |
| Phase 1A — Local Core Foundation | 按[实施基线](investment-dashboard-v2-phase-1a-local-core-foundation.md)落实合同校验、SQLite、Entity Registry / Resolver、append-only Audit、Repository / Domain 基础；通过专项与原有门禁 | 独立审查权限、事务、时间、历史与 bundle 边界；获授权后 PR / 精确 HEAD CI / 合入 | 本轮未实施。P0 审查合入后，另行授权开工；合入后才进入 1B |
| Phase 1B — Long-term Account & DCA Core | 按 1A 的下一阶段范围和冻结合同实现账户、资产、流水、持仓、DCA；真实迁移遵守 prepare / preview / confirm | 独立审查账本、幂等、审计与用户确认；获授权后 PR / 精确 HEAD CI / 合入 | 本轮未实施；完成后停止，后续域另行定范围 |

验证失败或工具阻塞须标明原因与受影响验收项；安全改动可推送待审查，但不得称验收通过。测试通过、独立审查、合入与生产准入是不同状态，任何一步不自动授权下一步。

## 后续共用边界

- 后续研究入库、行业 / Wiki、多 Agent 成果共用统一实体、版本、审计与 **prepare-plan-confirm-commit**，不建立平行系统。
- Phase 1A 开工时核对 **provider identifier 精确匹配**与 **resolver 合同输入**的衔接；本轮仅登记，不擅改 `contracts/v1`。
- 本轮不安装 / 升级 Skill，不做 `App.tsx` 大重构、首页视觉重做、SQLite、资产 / DCA、Research Bridge、Wiki、Agent 调度、备份或远程入口，不刷新真实 generated 数据、不扩行情覆盖。
- [Local-first 冻结决定](investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md)覆盖旧云端业务数据库假设；[Master Plan](investment-dashboard-master-plan-2026-09.md)中的 Stage 4 顺序保留为历史基线。当前执行顺序以本索引为准，业务语义与准入仍由冻结合同和专项审计决定。

## P0 展示口径与待办

- 宏观按展示条目计覆盖（重复指标未去重），来源状态保持原值；没有正式模型时不输出 0—100 方向分。月 / 季度报告期不补发布时间，含糊的来源日期标为语义待核验。
- 已核对 A / H 股生成脚本：行情 `updatedAt` 是采集运行时间；不替代市场观测时间。24 小时只划分采集时间窗口，不是统一失效规则；旧值可继续作为历史快照查看。
- 缺失、非法、未来时间不算正常新鲜；汇总保留完整分母。真实来源、价格覆盖与时效分别展示。当前未实现可靠交易日历或逐指标发布规则，故时效保守标为待核验。
- 本轮[验证记录及基线阻塞](p0-data-trust-display-v1-validation.md)单独列明；远端提交状态见任务交付记录。独立审查须核对最终 diff、测试、浏览器证据和最终远端 SHA，不沿用旧提交的 CI。
