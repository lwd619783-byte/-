# 公告 Observation 查询窗口纠正审计

审计日期：2026-07-28
范围：公告 Provider observation 查询窗口语义、历史 partial 离线重放、失败关闭、单次真实 observation 与 Gate 验收。

## 一句话结论

2026-07-28 的 46 条 `unverifiableRemoved` 来自观察器把 `manifest.dateRange` 的“实际公告数据范围”误当成 detail `dateRange` 的“请求查询窗口”。按两次运行的 56 家 detail 请求窗口重放后，46 条全部是窗口自然滚动产生的 `expectedExpired`，没有发现交集内真实 removal；修复仍保留请求窗口缩短、后移/回退、无交集、缺失/非法/不一致和交集内 removal 的阻断语义。

## 根因与语义边界

- `detail.dateRange`：每家公司向公告 Provider 发出的请求查询窗口。同一次运行的 56 家必须全部存在、是严格 ISO 日期、`start <= end` 且完全一致。
- `manifest.dateRange`：本次实际返回公告的最早/最晚日期。边界日期没有公告时，它可以窄于请求窗口，不能反推出请求窗口。
- 缺陷调用把 current/previous `manifest.dateRange` 直接传给 `announcement_diff`，因此把稀疏的实际数据范围误判成查询窗口缩短，并使所有 removal 落入 `unverifiableRemoved`。
- 修复后，查询窗口只从 56 家 detail 文档提取；manifest 范围仅以 `currentActualDataExtent` / `previousActualDataExtent` 诊断字段记录。

## 两次历史运行

| 字段 | 旧成功基线 | 2026-07-28 partial |
| --- | --- | --- |
| run ID | `20260726T122952Z-a-share-announcements-101d3bc6` | `20260728T143531Z-a-share-announcements-52079cf0` |
| 原状态 | `success` | `partial` |
| detail 数 | 56 | 56 |
| 非法/缺失 detail 窗口 | 0 | 0 |
| detail 请求窗口唯一值 | `2024-07-26` 至 `2026-07-26` | `2024-07-28` 至 `2026-07-28` |
| manifest 实际数据范围 | `2024-07-26` 至 `2026-07-25` | `2024-07-30` 至 `2026-07-28` |
| 公告数 | 15,652 | 15,629 |

两次请求窗口交集为 `2024-07-28` 至 `2026-07-26`，窗口起点自然前移 2 天；两个请求窗口长度相同。旧实现依据 manifest 得出起点前移 4 天和 `current_window_shortened`，该结论不代表真实请求窗口。

## 46 条 removal 离线重分类

重放结果：

| 分类 | 旧记录 | detail 请求窗口重放 |
| --- | ---: | ---: |
| `expectedExpired` | 0 | 46 |
| `unexpectedRemoved` | 0 | 0 |
| `unverifiableRemoved` | 46 | 0 |
| added | 23 | 23 |
| modified | 0 | 0 |
| window shift days | 4 | 2 |
| `current_window_shortened` | 是 | 否 |

按日期分组：

- `2024-07-26`：14 条，均早于新请求窗口 `start=2024-07-28`，重分类为 `expectedExpired`：
  `1220729862`、`1220729971`、`1220729972`、`1220730988`、`1220731030`、`1220731031`、`1220731135`、`1220731468`、`1220731469`、`1220739012`、`1220739013`、`1220740220`、`1220740362`、`1220740633`。
- `2024-07-27`：32 条，均早于新请求窗口 `start=2024-07-28`，重分类为 `expectedExpired`：
  `1220738191`、`1220738192`、`1220738193`、`1220738194`、`1220738195`、`1220738196`、`1220738197`、`1220738198`、`1220738199`、`1220738200`、`1220738649`、`1220738650`、`1220738651`、`1220738652`、`1220738653`、`1220738654`、`1220738655`、`1220739015`、`1220739016`、`1220739417`、`1220739457`、`1220739851`、`1220740251`、`1220740252`、`1220740468`、`1220740469`、`1220740470`、`1220740471`、`1220740472`、`1220740473`、`1220740474`、`1220740896`。

结论：没有发现位于 `2024-07-28` 至 `2026-07-26` 交集内却消失的公告，也没有日期缺失或无法分类的 removal。

## 历史不可变性与生产基线

- 2026-07-28 partial run 文件修复前 SHA-256：`2a0ba637a3177d1be0407fe32bd0d42d85fa1c5bc120b925186c7d1e72c080f5`。
- 该 run 的 artifact tree 修复前摘要：`a4b79f15c406446502353f9a89de7e4741854fd7817b314ca5e67a5d680060b9`。
- 正式生产树修复前摘要：`af8b9d0ee07f3f4b1ca9c830545e67cb80f50b621c632b6d5b8d3c68c74096d0`。
- 离线重放只读加载历史 run、ledger 和 artifact；未改写 run、ledger 或 artifact，未创建 resolution。

## 代码修复与失败关闭

- `scripts/provider_observability/core.py`
  - 新增严格 detail 查询窗口提取：验证所有预期公司、严格 ISO 日期、顺序和 56 家一致性。
  - `announcement_diff` 分开记录 query window 与 actual data extent。
  - removal 分类不再因其他窗口风险而全部降为 unverifiable；交集内 disappearance 仍归 `unexpectedRemoved`。
- `scripts/observe-providers.py`
  - current/previous 查询窗口均从 detail 文档提取。
  - 缺失、非法或不一致以 `window_anomaly` 失败关闭。
  - manifest 范围只作为 data extent 传入差异诊断。
- `scripts/tests/test_provider_observability.py`
  - 覆盖真实 helper、diff、observer 传参、稀疏 data extent、异常窗口、交集 removal 和历史文件不变性。
- `scripts/data-audit.mjs`
  - 增加 P0 静态契约，禁止 manifest data extent 回流为 query window，并要求完整回归测试集合。

保留的阻断规则包括：请求窗口真实缩短、结束日期回退、起点异常回退、无交集、缺失/非法/不一致、交集内 removal 和无法验证的 removal。`expectedExpired` 本身不阻断。

## 验证结果

代码提交 `5bee7a9583998d8f92507814163161bf0ac66c13` 前后的验收：

- `npm run test:provider-observability`：254/254 通过。
- `npm run data:audit`：P0=0，errors=0，warnings=24，退出码 0。
- 使用新 helper 对两次真实历史 artifact 只读重放：23 added、0 modified、46 expected expiry、0 unexpected removal、0 unverifiable removal、无 window risk。
- 公告 Provider：26/26 测试通过，正式 validator 通过。
- 财务 Provider：18/18 测试通过，正式 validator 通过。
- 公司指引：Node 173/173、Vitest 102/102 通过；committed-artifact `--check` 无 mismatch；正式 validator 通过。
- 机构一致预期探针：65/65 通过；只验证探针，不执行 Prompt 2。
- 全量 Vitest：498/498 通过。
- `npm run build`：TypeScript、Vite build 与 bundle budget 通过。
- 环境检查：37 PASS、9 WARN、0 FAIL、4 SKIP，状态 `READY WITH WARNINGS`；WARN 为既有环境、未配置新分支 upstream、任务中工作树及未登录 `gh`。
- `git diff --check` 通过；正式 committed artifacts 无差异。

## 单次真实 Observation 与 Gate

`npm run data:observe:providers` 只调用一次，命令退出码为 1。严格工作树预检在 Provider 启动前拒绝了未跟踪的本审计文档：

```json
{
  "status": "preflight_failed",
  "reason": "dirty_worktree",
  "dirtyFiles": [
    "?? docs/announcement-observation-query-window-v1-audit.md"
  ]
}
```

按照“失败后不重试”约束，没有再次调用命令。此次结果必须区分：

- observation 命令调用：1 次；
- 财务 Provider 真实执行：0 次；
- 公告 Provider 真实执行：0 次；
- 数据源访问：0 次；
- 新财务 run ID / status / exitCode：未产生；
- 新公告 run ID / status / exitCode：未产生；
- 新 run 文件与 ledger 行：未产生，仍为 14/14。

代码提交后的 observation-tool checksum 为：

`c0128f0dab6a535edf0384dbfdeccc97608640453cb99d6c9f6551ac9c76fc95`

当前 cohort 与 inventory：

| Provider | current cohort | current | trusted legacy | incompatible | debug | unavailable |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 财务 | `8b49ffdff195486d3df22d54f4aa235b30a6f5000a61fccbc53d49d95e414fd6` | 0 | 1 | 6 | 0 | 0 |
| 公告 | `f64479ea8f8b0b37acc8b4e6228f6bbd1508bbf03a36194ac8624ec579fb6d90` | 0 | 1 | 6 | 0 | 0 |

2026-07-28 的旧 partial 未被自动 resolve；由于 observation-tool checksum 改变，它自然进入公告 incompatible inventory。

strict eligibility 结果：

| 字段 | 结果 |
| --- | --- |
| npm 退出码 | 1 |
| Gate exitCode | 2 |
| Gate 状态 | `insufficient_observation_window` |
| blocking failures | 0 |
| observation days | 0 |
| 每家仍缺 distinct days | 5 |
| 每家仍缺 runs | 10 |
| 每家仍缺 successful days | 5 |

完整性与生产状态：

- root-state mode：`legacy_v1_migrated`。
- root-state integrity failure：`false`。
- evidence integrity failure：`false`。
- invalid V2 run：0；duplicate/orphan/mismatch 新增：0。
- production validation：通过。
- default refresh validation：通过，未加入财务、公告或 observation Provider。
- 正式生产树 before/after 摘要均为 `af8b9d0ee07f3f4b1ca9c830545e67cb80f50b621c632b6d5b8d3c68c74096d0`。
- 2026-07-28 partial run 修复后 SHA-256 仍为 `2a0ba637a3177d1be0407fe32bd0d42d85fa1c5bc120b925186c7d1e72c080f5`。
- 该 run 的 artifact tree 修复后摘要仍为 `a4b79f15c406446502353f9a89de7e4741854fd7817b314ca5e67a5d680060b9`。
- `.provider-observations/` 仍被 Git 忽略。
- 自动机构一致预期注册状态仍为 `not_implemented`，正式自动记录仍为 0。

## 明确边界

- 不改写或删除历史 observation。
- 不创建 resolution，不以 resolution 掩盖历史失败。
- 不修改正式生产数据、默认刷新链或 Gate 门槛。
- 不执行机构一致预期 Prompt 2。
- 不创建 PR，不合并 `main`，仅普通 push 功能分支。
- 不重试 observation；没有将 preflight failure 表述为真实 Provider 采样。
