# UI V1.0 执行索引

设计 **NEON-RC1-20260909 / V1.0 / APPROVED / FROZEN**，用户批准日期 **2026-09-09**。批准依据、设计与资产导航见 [README](README.md)，机读状态见 [dispatch-status.json](tasks/dispatch-status.json)。

| 阶段 | 冻结交付范围与入口 | 当前状态 |
| --- | --- | --- |
| D0 | [设计归档与范围冻结](06-codex-task-package.md#d0设计归档与范围冻结已批准并派发) | 归档完成，待独立审查；本票普通 push 后停止 |
| D1 | [共享外壳、三主题与状态保留](06-codex-task-package.md#d1共享外壳三主题与状态保留) | NOT DISPATCHABLE；等待 D0 独立审查/合入及新票精确 base |
| D2 | [个股池、快速预览与完整研究页](06-codex-task-package.md#d2个股池快速预览与完整研究页) | NOT DISPATCHABLE；等待 D1 独立审查/合入及新票精确 base |
| D3 | [首页、宏观与行业重排](06-codex-task-package.md#d3首页宏观与行业重排) | NOT DISPATCHABLE；等待 D2 独立审查/合入及新票精确 base |
| D4 | [观察、验证、预期及复杂表单](06-codex-task-package.md#d4观察验证预期及复杂表单) | NOT DISPATCHABLE；等待 D3 独立审查/合入及新票精确 base |
| D5 | [全站视觉验收与边界修复](06-codex-task-package.md#d5全站视觉验收与边界修复) | NOT DISPATCHABLE；等待 D4 独立审查/合入及新票精确 base |

D0 精确 base：`bcca135530352ed9c85407e18acceed1dbf45690`；分支：`codex/ui-v1-design-freeze`；提交信息：`docs: freeze approved research UI v1 design`。本票仅归档设计文档、必要导航与非生产资产；普通 push 后立即停止，不创建 PR、不 merge、不部署、不执行 D1。

D1–D5 是获批的设计实施规划，不是本票的执行授权。各票按 [06 的基线刷新卡](06-codex-task-package.md#基线刷新卡每次派发都填不能预写)绑定前序审查/合入证据、真实完整 SHA、允许文件范围、验收与停止点，不复用 D0 SHA 冒充未来 main。长期流程与业务边界仅引用[根 AGENTS.md](../../../AGENTS.md)及[合同目录](../../../contracts/v1/README.md)。
