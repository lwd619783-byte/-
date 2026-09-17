# Stage 4.2 / Slice 2 Plan — Industry Metric Registry + Generic Provider + Multi-Metric Proof

状态：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。前置事实源：`docs/stage-4-2-slice-1-closeout.md`、`docs/current-development-direction-2026-09-13.md`、已合入的 `industry-metric.v1` 与既有 F1/F3 contracts。

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

## 实施交付（2026-09-17）

开始前已 `git fetch origin`，确认精确 base `1859db0caa6df416add84740c4b4b76d2350ab4d`；在干净工作区创建 `codex/stage-4-2-industry-metric-registry-v1`。Slice 1 closeout 为本轮前置事实；本轮没有 PR、merge 或 Hosted CI PASS。

- 新增版本化 Registry/schema，分别 pin definition、artifact、既有 F1 binding、policy。状态/Evidence 入口复用 owner；不创建 Entity 或第二套 admission/readiness。
- Generic Provider 通过 Registry 枚举及精确 identity 查询，不再直接导入 robotics owner。Node 与浏览器共用原文 digest/pointer/identity 校验，资源与 entry 乱序不改变结果，重复/缺失/冲突/错误 pin 导致整体 blocked，不 silent substitution。通过显式 synthetic 第二行业测试证明发现逻辑不绑定 robotics；真实数据仍只覆盖机器人。
- 同一组 committed raw 新增独立 `CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YOY`，单位 `%`。同比仅从官方表头下的列 2/4 提取（1—2 月累计列 2）；绝对量仍读列 1/3。没有自行计算同比、累计差分或补缺；缺失标记不变，歧义解析 fail closed。
- Slice 1 原 `industry-robotics.generated.json`、pilot plan、F1 binding、manifest 和全部 7 份 raw 文件均无 diff；shared semantic vocabulary、industry-metric.v1、F1/F3 contracts 与 Frozen eval report 无改动。
- 原机器人正式指标区新增 selector，支持两个 metric 各自 monthly/year_to_date、动态单位、独立 chart/Evidence。切换重置 basis/drawer；百分比不展示 delta。绝对量保留原差额语义。非机器人 unavailable，未用旧 qualitative 字段或行情代填。

详见 [Registry 结构、Provider 边界与重放命令](industry-metric-registry-v1.md)。只读 schema/Provider 验证不构成数据、历史 PIT 或生产准入。

### 真实数据覆盖

同一批 **7 份** NBS 网页产生 **2 个独立 metric、各 13 个读数，共 26 个 observations**。共同声明窗口为 2026-01—2026-08；每个指标当月覆盖 **6/8**，累计覆盖 **7/8**。1—2 月无独立当月值；1 月无累计留存记录。

| 观测期 | 官方当月同比（%） | 官方年内累计同比（%） |
| --- | ---: | ---: |
| 2026-01 | missing | missing |
| 2026-02 | missing | 31.1 |
| 2026-03 | 24.4 | 33.2 |
| 2026-04 | 15.1 | 25.7 |
| 2026-05 | 27.9 | 28.1 |
| 2026-06 | 28.1 | 28.0 |
| 2026-07 | 30.2 | 28.5 |
| 2026-08 | 34.6 | 29.0 |

以上来自 retained raw 的直接官方读数；完整 rawRow、column、SHA-256、capture pin、source URL、独立 generatedAt 与 candidate Evidence 均保存在新 artifact。原绝对量末期仍为当月 96174 套、累计 729352 套，其数值和解释未改。

### 最终本地验证

| 验证 | 实际结果 |
| --- | --- |
| `test:industry` | PASS：28 Node tests；4 files / 35 应用 tests |
| `data:validate:industry` | PASS：Registry schema/pins/identity、两个 owner 各 7 raw / 13 observations 的 deterministic replay、V1 schema / owner invariant / 原 F1 validator / Evidence |
| `contracts:validate` / `test:contracts` | PASS；106 Local Core contract tests + 78 Financial Research tests |
| `data:validate:semantic-bindings` / `test:semantic-runtime` / `data:validate:semantic-readiness` | PASS；37 tests；readiness assessment 仍 BLOCKED，23 metrics；full macro raw replay NOT_RUN |
| `test:stage-4-1-g` / `data:validate:pbc-evidence-v2` / `data:validate:semantic-readiness:v2` | PASS；27 Node + 14 Python；normalization / backtest 各 READY 0 / BLOCKED 23，PBC canary 与 full graph/admission 边界不变 |
| `test:research-eval` / `research:eval:check` | PASS；45 tests、committed report replay；reference 33/33 REFERENCE_ONLY，actual service 0/33、NOT_IMPLEMENTED 33/33 |
| `npm test` | PASS：63 files / 815 tests |
| `test:discovery` | PASS；1 test，未削弱 discovery 配置 |
| `data:audit -- --no-write` | exit 0、errors=0、26 warnings（P1=12 / P2=14）；新增同比 partial source 单独登记造成 1 条 data-limitation warning，原 warning 未消除 |
| `ui:audit` | PASS：静态扫描未发现目标 legacy classes；不把静态结果冒充浏览器验收；仅时间戳变化的旧报告已恢复 |
| `build` | PASS：TypeScript、Local Core typecheck/browser boundary、bundle gate；保留 >500kB chunk warning |
| browser | PASS：279 checks，两个 metric × 三主题 × 1536/390/320；真实 SVG、basis/单位、缺口、来源、Evidence/column、focus、零指标操作 storage writes、非机器人 unavailable、原 deep links/公司导航；0 功能/runtime errors，1 条既有 favicon.ico 404 warning |
| `git diff --check` | PASS |
| Hosted CI / 独立审计 | NOT_RUN / PENDING；本轮不预写 PR、merge、main CI 或 admission |

专项对抗测试包含 duplicate metric identity、wrong industry、dangling/wrong pins（digest/objectId/version/locator）、artifact/binding/policy substitution、resealed identity drift、乱序/重复 resource owner、missing owner、未登记冲突 owner、百分比错误 delta 策略，以及未准入/历史可得性/Evidence promotion。真实 parser 校验官方同比表头，synthetic mutations 单独验证负值、0、missing、歧义与无绝对量推导；不作为业务真实数据。

实现期修正了测试 HTML mutation 未命中原表头、UI 测试 Node-only crypto 进入 browser graph 的 fixture 问题、以及正式指标 selector 的可访问名称；最终上述 gates 均通过，未放宽现有 boundary 或验证要求。UI fixture 只用于组件测试，浏览器矩阵使用实际生产 bundle + Web Crypto pins。

浏览器证据：[report](stage-4-2-slice-2/browser-report.json)、[desktop YOY](stage-4-2-slice-2/neon-1536-yoy.png)、[light 390](stage-4-2-slice-2/light-390-yoy.png)、[pro 320](stage-4-2-slice-2/pro-320-yoy.png)，同目录保留三份绝对量截图。

### 保留的 blocker 与停止点

两个 metric 均保持 `releaseAvailableAt=null`、PIT UNPROVED、revision continuity unknown、Entity UNRESOLVED、DATA/PRODUCTION NOT_ADMITTED、allowedUses=[]、Evidence candidate、chart linkage=null。F1 仍 NOT_READY；F3 actual deterministic service 未增加。窗口外历史、自动刷新、外部 Provider、Industry Prosperity/Regime/评分、F2 Claim/Thesis、Portfolio、MCP/Agent 与 admission closure 全部 deferred。

交付仅普通 commit + push 到指定分支，核验 local HEAD=remote HEAD、干净工作区与相对 base 的 ahead/behind 后停止，等待独立审计。Final SHA/remote 同步事实在 push 后的交付消息报告，不提前写入本文件。
