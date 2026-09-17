# Industry Metric Registry V1

Stage 4.2 Slice 2 的正式 owner 发现索引是 `config/industry/industry-metric-registry.v1.json`，结构由 `contracts/industry/industry-metric-registry.v1.schema.json` 校验。它不替代已有 Data Source Registry、Entity Registry 或 F1 semantic binding，不赋予 production/data admission。

每条 entry 具有唯一 `metricId`、精确 `industryId`，以及复用 F1 Pin 的四项引用：

| 引用 | locator | objectId / version |
| --- | --- | --- |
| definitionRef | `/definition` | metric id / definition revision |
| artifactRef | `/definition` | metric id / definition revision；SHA-256 覆盖整个 artifact |
| bindingRef | `/bindingId` | binding id / 所绑定的 definition revision；SHA-256 覆盖整个既有 F1 binding |
| policyRef | `/policy` | policy id / policy revision |

`artifactRef` 同时提供 observations/provenance/Evidence 入口；`policyRef` 提供真实状态入口。Registry 不复制 status 或 coverage。`presentation` 仅保存口径标签、计算说明及 delta 展示策略，不包含数值、准入或研究判断。百分比 entry 的 delta 必须为 `none`；本版不展示百分点差。

`createIndustryMetricProvider` 是 Node 验证与浏览器共用的只读边界。它校验原始 UTF-8 bytes digest、JSON pointer、definition/artifact/industry/binding/policy identity 与 pins，拒绝重复资源、重复 metric、重复 artifact/binding owner、缺失 owner、错配引用和未登记的冲突 artifact。任何失败拒绝整个索引，UI 显示 blocked。成功后固定为不可变快照；`list(industryId)` 按 metric id 排序；`get(industryId, metricId)` 只返回精确匹配，未知 metric/industry 返回 null。顺序变化不改变结果。

浏览器的 glob 是资源装载器，不是 owner 发现索引；只有 Registry entry 能被列为正式 metric。全量结构 schema、F1 原 validator、官方 raw/Evidence 语义与 owner 精确重放由 `data:validate:industry` 校验；浏览器验证不能替代该门禁。source-specific reviewed plan pins 与 replay 分别锁定两个 NBS owners，通用 Registry 不内置 robotics 或 NBS 文件选择规则。

扩展 owner 需先提交符合既有 V1 的 artifact/config/binding、可重放的 source-specific validator、Registry entry 和独立审计证据；不得只修改 digest 以绕过 owner review。Registry 本身新增不兼容语义时新增版本；本轮未改既有 industry-metric.v1/shared/F1/F3 contracts。

本轮两个 owner 共用 Slice 1 的 7 份 raw，仅增加官方同比 owner。离线命令：

- `npm run data:validate:industry`：Registry schema、所有 pins/identity、双 owner 原字节 replay、V1 schema、F1 与 Evidence 校验。
- `npm run test:industry`：真实 replay、对抗性 mutations、Provider/history/UI tests。
- `node scripts/industry/artifact.mjs --yoy`：只校验同比 owner；加 `--write` 才显式重建同比 artifact/binding，之后 Registry pin 不匹配会 blocked，必须审查并同步，不自动 reseal。
- 原 `data:build:industry` 仍只显式重建 Slice 1 绝对量，未在本轮执行。原 raw/manifest 不重取、不覆盖。

F1 仍 NOT_READY；Entity/PIT/revision/production admission 与 F3 actual service 均未闭合。完整数据、验证与停止点见 [Slice 2](stage-4-2-slice-2-plan.md)。
