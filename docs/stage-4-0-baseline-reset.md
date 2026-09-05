# Stage 4.0 — Project Baseline Reset

> 执行日期：2026-09-02  
> 代码基线：`main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`  
> 工作分支：`docs/investment-dashboard-master-plan-2026-09`

## 目标

重新统一代码真实状态、项目说明、功能状态和后续路线，避免继续依赖 2026-07-02 的 UI Terminal Upgrade 阶段性方案。

## 已完成

- [x] 全面梳理 GitHub 当前 `main` 架构
- [x] 核对 2026-07-02 旧 Terminal Upgrade plan
- [x] 核对 PR #1–#12 的主要能力演进与已知边界
- [x] 建立 `docs/investment-dashboard-master-plan-2026-09.md`
- [x] 建立 `docs/architecture.md`
- [x] 建立 `docs/feature-registry.md`
- [x] 更新根目录 `README.md`
- [x] 明确 A 股财务 / 公告为 `DONE / NOT ADMITTED`
- [x] 明确自动机构一致预期为 `PROBE ONLY / NO_GO`
- [x] 明确 LocalStorage / 云端持久化边界
- [x] 明确 Stage 4.1–4.6 路线
- [x] 远端比较确认分支仅包含文档变更

## 文档职责

- `README.md`：仓库入口、当前能力、重要边界、常用命令、Stage 4 概览
- `docs/architecture.md`：当前真实架构、数据流、治理边界、目标架构原则
- `docs/feature-registry.md`：每项功能的 DONE / PARTIAL / NO_GO / NOT STARTED 状态
- `docs/investment-dashboard-master-plan-2026-09.md`：未来总建设路线和优先级

## 与初始 Stage 4.0 计划的微调

Master Plan 最初建议建立 `docs/architecture/` 和 `docs/roadmap/` 子目录。执行时为了避免当前文档数量较少时产生过深目录，采用：

- `docs/architecture.md`
- `docs/feature-registry.md`

作为同等职责的更扁平实现。

这不是范围缩减。后续文档数量明显增加时，再按主题迁移到子目录；迁移必须保持链接兼容或同步更新引用。

## 独立差异检查

与 `main` 比较结果：

- branch status：ahead
- behind：0
- 业务代码变更：0
- 配置变更：0
- 数据产物变更：0
- Provider 行为变更：0

只涉及：

- `README.md`
- `docs/architecture.md`
- `docs/feature-registry.md`
- `docs/investment-dashboard-master-plan-2026-09.md`
- 本执行记录

因此 Stage 4.0 不需要运行实时 Provider，不需要生成任何 production artifact。

## Stage 4.0 验收结论

**PASS — 文档基线已经建立。**

但当前分支仍应保持为独立远端分支，不自动创建 PR / 不自动合并。

下一业务阶段：

**Stage 4.1 — Macro Metric Registry V2 + Bull/Bear / Market Regime Engine**

Stage 4.1 的第一步不是直接画牛熊温度计 UI，而是把我们已经设计的指标方案转换成正式的 Metric Registry / Data Contract，包括每项指标的：

- source
- nativeFrequency
- expectedReleaseCalendar
- releaseLag
- refreshPolicy
- staleAfter
- revisionPolicy
- direction
- normalization
- weight
- historical window
- missing-data behavior

只有 Registry 和数据合同稳定后，才进入 Score Engine、历史回测和页面实现。
