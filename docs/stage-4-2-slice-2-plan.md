# Stage 4.2 / Slice 2 Plan — Industry Metric Registry + Generic Provider + Multi-Metric Proof

状态：**PLANNED / NOT_STARTED**。前置事实源：`docs/stage-4-2-slice-1-closeout.md`、`docs/current-development-direction-2026-09-13.md`、已合入的 `industry-metric.v1` 与既有 F1/F3 contracts。

## 目标

把 Slice 1 的“单个可信 owner”推进为真正可扩展的 Industry Data Platform seam：建立版本化 Industry Metric Registry 与通用只读 Provider，使同一行业能够枚举、按 metric identity 读取多个 owner；随后复用 Slice 1 已留存的国家统计局原始网页，把官方直接发布的工业机器人产量同比增长列作为第二个真实 metric owner，验证 registry/provider/UI 对多指标成立。

## Scope Freeze

1. **Industry Metric Registry V1**：唯一、版本化、可校验的 metric owner 索引；至少绑定 metric identity、industry、owner artifact/config、F1 binding 与状态/证据入口。拒绝重复 identity、悬空引用、owner/registry identity 漂移与 silent substitution。
2. **Generic Provider/read model**：移除当前 runtime 对单一 robotics owner 的硬编码发现方式，支持按 industry 列举指标、按 metric id 精确读取；missing / partial / stale / conflicted / not_admitted / unknown 继续 fail closed。不得把 schema representability 当成 admission。
3. **第二个真实指标**：仅使用已提交的 7 份国家统计局网页中表头明确的“同比增长（%）”官方读数，建立独立 metric identity / unit / provenance / binding。它是官方直接发布值，不由绝对量自行计算。若原始字节无法逐期无歧义证明，则保持 blocked，不以推算补齐。
4. **产品证明**：机器人“正式行业指标”能够在产量绝对值与官方同比指标之间明确切换/浏览，并复用 Auditable Chart / Evidence Drawer；非机器人行业仍不得出现代理正式数值。百分比指标如展示相邻期变化，只能明确标注为“百分点差”，不得称为同比增速、环比或景气变化。

## 明确 Deferred

本 Slice 不做 Entity/PIT/revision admission closure，不引入新的外部数据源，不做全历史扩展、自动刷新、Industry Prosperity/Regime/评分、F2 Claim/Thesis、Portfolio、MCP/Agent，也不提升 F3 actual service coverage。

## 验收

- Registry / Provider 必须有 adversarial tests：重复 metric、错误 industry、悬空/错误 pin、artifact/binding identity drift、乱序/重复 owner、缺失 owner 均 fail closed。
- 两个真实 metric owner 均从 committed raw bytes 确定性 replay；绝对量 Slice 1 artifact/语义不得被同比扩展改写或重新解释。
- F1 binding 对两个指标分别校验；当前 admission 边界保持真实，不新增 READY/allowed use。
- UI/browser 覆盖两个指标切换、单位与文案、Evidence Drawer、三主题/窄屏，以及非机器人 unavailable。
- 运行相关专项 gates、contracts/semantic/F3 regression、全量 tests、data audit、build、discovery、diff check，并记录非零 warnings。
- 交付时同步本计划、执行索引/Feature Registry 的真实进度；普通 commit/push 后停止，不创建 PR、不 merge，等待独立审计。
