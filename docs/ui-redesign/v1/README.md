# 投研工作台 UI V1.0｜获批设计事实源

设计 ID：**NEON-RC1-20260909**；版本：**V1.0**；状态：**APPROVED / FROZEN**。
用户已于 **2026-09-09** 在《投研工作台 UI V1.0｜D0 设计归档与范围冻结》任务中正式批准整包设计，无局部设计调整。本目录完成 D0 版本化归档，不表示 UI 已实现、业务回归通过或生产准入。

冻结方向是**一套共享产品骨架 + 三套皮肤 + 共用信息架构重构**：C「霓虹科技」（`neon`）为默认主题，A「深色专业」（`pro`）、B「明亮简洁」（`light`）为同构可切换主题。完整规则见 [01](01-design-contract.md) 与 [03](03-theme-and-charts.md)。

设计输入为 `origin/main @ bcca135530352ed9c85407e18acceed1dbf45690`。D0 开始时已 `git fetch origin` 并验证完全相等；该 SHA 是设计输入与本票基线，**不是永久 CURRENT main**。后续实施入口见[执行索引](execution-index.md)；D1–D5 尚未派发。

## 阅读与执行入口

| 文件 | 用途 |
| --- | --- |
| [01-design-contract.md](01-design-contract.md) | 整体方向、共享骨架与设计范围 |
| [02-page-blueprints.md](02-page-blueprints.md) | P01–P08 页面蓝图与五个公司研究标签 |
| [03-theme-and-charts.md](03-theme-and-charts.md) | A/B/C 身份、token、尺寸与图表规则 |
| [04-interaction-and-responsive.md](04-interaction-and-responsive.md) | 导航、上下文、表单、响应式与异常状态 |
| [05-migration-and-scope.md](05-migration-and-scope.md) | M01–M56 完整迁移映射；尚未执行迁移 |
| [06-codex-task-package.md](06-codex-task-package.md) | D0–D5 的 Contract + Delta 任务规划 |
| [07-audit-and-acceptance.md](07-audit-and-acceptance.md) | 54 项运行时审计标准与最终验收矩阵 |
| [08-handoff-and-decision.md](08-handoff-and-decision.md) | 原设计交付记录与本次批准记录 |
| [09-source-register.md](09-source-register.md) | 设计输入时点的来源与取证限制 |
| [execution-index.md](execution-index.md) | 当前派发状态、D0 停止点及 D1–D5 入口 |

本目录仅作为 UI 设计范围内的 Source of Truth，不提升为业务合同事实源。长期项目规则只引用[根 AGENTS.md](../../../AGENTS.md)、[PRODUCT.md](../../../PRODUCT.md)、[contracts/v1](../../../contracts/v1/README.md)及其指向的冻结决定；当前实现参见[架构](../../architecture.md)与[功能登记](../../feature-registry.md)。UI 工作流参见[项目 Skill](../../../.agents/skills/investment-dashboard-ui-workflow/SKILL.md)。

## 非生产设计资产

- [画板目录](design/README.md)与[机器索引](design/index.json)：保留 42 个图号、标题、主题和全部轻量 SVG，索引路径仅由原 PNG 改为对应 SVG。包含 24 张桌面主页面、10 张细节/流程、8 张窄屏稿，供 D1–D5 查阅布局与对照图号。
- [theme_tokens.json](design/theme_tokens.json)：原设计 token 原样保留，未安装为应用主题。
- [book-index.json](design/book-index.json)：原设计册 32 页页码索引原样保留。页码与 42 个画板编号是两套编号；`cover/index/themes/mobile_0/mobile_1/architecture/migration/checks/implementation/approval` 为册页组合或文字页，不是缺失画板。PDF 留在原交付包，不是仓库内链接目标。
- 代表 PNG：[C 首页](design/desktop/home_neon.png)、[A 首页](design/desktop/home_pro.png)、[B 首页](design/desktop/home_light.png)、[窄屏公司页](design/mobile/company_mobile.png)。保留[用户选定的 C 视觉参考](references/C_已选视觉参考.png)用于方向追溯。
- 其余重复 PNG、整册 PDF、拼图预览及原包 README 未归档。01–09 中 PNG/SVG、PDF 等原交付描述指原包；仓库实际保留范围以本页与清单为准。

全部图片和 SVG 均为**合成设计参考**，不是真实行情、研究数据、已实现能力或可运行组件。资产仅放在 `docs/ui-redesign/v1/`，不置于 `src/`、`public/` 或业务数据目录；当前应用没有导入这些文档资产，Vite 未配置将 docs 复制进生产输出。后续票通过文档查阅，不把完整画板导入应用 bundle。

## 可追溯性与校验

[归档清单](checks/archive-manifest.json)记录原 ZIP SHA-256、每个源成员与归档文件 SHA-256，以及状态/链接调整标记；原 ZIP 未被修改。01–09 除批准/派发状态及必要链接外保留原文，56 条迁移行须与原包逐行完全一致。完整归档文件清单见该清单的 `files` 与 `additional_files`。

[原设计静态检查说明](checks/README.md)区分原包检查证据与 D0 实际验证。[D0 校验记录](checks/d0-validation.md)列出实际运行内容与 NOT_RUN 项。新归档不会回写既有历史审计结论。
