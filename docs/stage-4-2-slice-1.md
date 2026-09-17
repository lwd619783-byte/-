# Stage 4.2 / Slice 1 — Industry Metric Foundation + Robotics Pilot

状态：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。基线 `d50e39fcea201b1c3f139881ba7ed83d2d6d4b38`；分支 `codex/stage-4-2-industry-metric-foundation-v1`。无 PR / merge / 本分支 Hosted CI PASS 声明；DATA / PRODUCTION **NOT_ADMITTED**。

## 2026-09-17 P1 remediation — reusable V1 foundation

独立审计指出初版 `industry-metric.v1` 把当前机器人 pilot 事实写成通用合同永久常量。本次从已审计 HEAD `04fb2419b7ca1e43db781d93361ed6c7da87f92d` 修复，**P1 IMPLEMENTATION FIXED / VERIFIED LOCALLY / PENDING INDEPENDENT RE-AUDIT**；仍在原功能分支，main 基线不变，不新增 V2。

- 通用 schema / TypeScript 支持 owner 自有 metric / industry / geography / source / unit / frequency / basis / window；期间可为年月或 ISO 日期，适用于不同频率。通用 completeness 使用既有 semantic coverage 的 `availableCount / targetCount`（允许 unknown=null）与 `missingPeriods`；原 monthly 字段组保留兼容且不能与通用组混用，不改写已留存 artifact。
- Entity 直接引用既有 EntityRef / semantic identity seam；TypeScript 复用 `BridgeAuditEvent['entity']`，不从 metricId 拼接实体。admission、allowed/forbidden uses、conditions、revision sequence/supersedes、release 时间复用现有 semantic/shared 合同；quality 对齐 `DataQualityMeta`。revision status 由 owner 的 revisionPolicy 定义，保留 unknown；PIT 沿用 owner/chart 的 PROVEN/UNPROVED 标记，不新增证明或准入算法。结构有效不证明 resolved、PIT、revision continuity 或 allowed use。
- `releaseAvailableAt` 可表达明确时间或 null，publication/acquired/generated 仍分离，不做填充。freshness 复用 semantic FRESH/STALE/UNKNOWN，保留初版小写 unknown；表格 column/rawRow 变为可选，JSON 等 acquisition 不再需要伪造表格定位。现有 audit projection 仅补可选字段读取，当前机器人显示行为不变。
- 机器人精确事实继续由 `nbs-robotics-pilot.v1.json`、builder、原 parser/replay 与专项测试约束。两个 builder 均核对 reviewed plan 的 SHA-256 `f1df61268372e3d435d8ede1c874aefef08e61e8b978ab74f06a3b14b779d664`；改变 owner 计划需要显式审查并同步此锚点，不能仅重新生成 artifact/binding pins 绕过。该锚点证明计划一致性，不冒充来源真实性或历史 PIT。
- 19 类“通用 schema 合法、当前 owner 非法”的 artifact 漂移被 exact replay 拒绝；8 类计划漂移在 artifact/binding 重封装前被拒绝。测试涵盖 identity/source/unit/frequency/basis/window/missing/denominator/entity/release/PIT/revision/admission/Evidence。新增 test-only synthetic 合同用例证明季度/日/周/年度、不同单位及未来 resolved/admitted/revised/proved 字段可表达；没有进入业务数据、UI、F1/F3 输入。

当前机器人 config、binding、7 份 raw、manifest、13-observation normalized artifact 与 `04fb2419` **字节不变**。`releaseAvailableAt=null`、PIT UNPROVED、revision continuity unknown、Entity UNRESOLVED、DATA/PRODUCTION NOT_ADMITTED、allowedUses=[]、Evidence candidate、chart linkage=null 全部保持。F1 binding VALID / NOT_READY，Macro normalization/backtest 各 READY 0 / BLOCKED 23；F3 reference 33/33 REFERENCE_ONLY，actual service 0/33、NOT_IMPLEMENTED 33/33。没有新增真实指标、PIT/Entity/revision closure 或 service implementation；通用合同能力不等于通用 history/UI adapter 已实现，当前运行路径仍为机器人 pilot。

| 本次 remediation 验证 | 实际结果 |
| --- | --- |
| `test:industry` / `data:validate:industry` | 8 Node + 32 Vitest PASS；完整 schema/binding/raw replay/owner invariants PASS，7 captures / 13 observations / 月度 6/8 |
| `contracts:validate` / `test:contracts` | PASS；106 Local Core contract tests + 78 Financial Research tests |
| F1 bindings / runtime / readiness V1 | PASS；37 tests；未提升 readiness |
| Stage G / PBC Evidence / readiness V2 | PASS；27 Node + 14 Python；canary PASS，full graph/source admission BLOCKED |
| F3 tests / committed report check | 45 tests / replay PASS；Frozen service coverage 不变 |
| `npm test` / `test:discovery` | 63 files / 812 tests PASS；discovery PASS |
| `data:audit -- --no-write` | exit 0、errors=0、25 warnings（P1=11 / P2=14），不是零 warning |
| `npm run build` | PASS；typecheck、Local Core browser boundary 与 bundle checks PASS；保留 >500kB chunk warning |
| browser | 原脚本重跑 144 checks PASS、0 errors；三主题 × 1536/390/320，真实数据、basis、Evidence、navigation 与非机器人 unavailable；[P1 报告](stage-4-2-slice-1/p1-browser-report.json) |
| `git diff --check` | PASS |
| Hosted CI | NOT_RUN；既有 industry 离线 gate 自动包含新增测试；功能分支 push 不触发 PR/main workflow |

测试开发中首次连续 DOM replay 触及 Node heap limit；在每轮完整重放间等待 closed JSDOM 的队列清理后，以默认 heap 通过，未跳过 replay 或放宽断言。synthetic Pin 的 locator 初次不符合共享合同，已改为正确 JSON pointer；最终完整测试通过。下方原始实现验证表与浏览器证据保留 `04fb2419` 时点记录，不改写为本次证据。

## 范围与审计结论

仅建立工业机器人产量一项正式指标 owner，读取国家统计局公开工业生产表；Industry 原 `prosperity / stage / drivers / catalysts / risks / trend` 继续为 qualitative research context，未升级为 Provider Fact。没有评分、Regime、Thesis、组合、MCP、Agent 或第二套行业页面。

| 既有 seam | 本轮复用与边界 |
| --- | --- |
| `Industry` / `IndustryTab` | 保留研究概览、细分比较、产业链、公司池与 deep links；只在概览增加正式指标区 |
| Provider / `DataQualityMeta` / `data-source-registry.ts` | 在原来源注册表新增一项；source owner 为国家统计局，adapter 为本地 HTML parser，两者分开 |
| Evidence | 复用 Frozen V1 `EvidenceRef` wire/type，quality=candidate；原始字节与表格定位可重放，不伪造正式 Evidence/Graph |
| Auditable Chart / Product Shell | 复用 `ChartPanel`、`ChartAuditPanel`、`ProductShell`；`EvidenceDrawer` 增加只读 audit variant，原事件行为保留 |
| F1 Semantic Runtime | 复用现有 Pin/bytes/resolve、`financial-semantic-binding.v2` 和 `validateBinding`；行业 field binding 已校验，entity=null；未伪造 `MetricObservationVintage` 或新增 READY 算法 |
| F3 Research Eval | 原 Harness、target registry、33 个 Frozen cases/digests 与报告保持不变；本 parser 不冒充 Frozen retrieve/recompute adapter |

## 数据 owner 与可重放链路

```text
国家统计局 7 份官方工业生产发布网页
 → research-data/industry/nbs-robotics-v1/raw/<sha256>.html + manifest.json
 → scripts/industry/nbs-parser.mjs（惰性 DOM、表头/指标/单位/期间/统计范围校验）
 → scripts/industry/artifact.mjs（SHA-256 / roster / schema / F1 binding / exact replay）
 → src/data/real/industry-robotics.generated.json（IndustryMetricDataset owner）
 → industryMetricProvider.ts（history / delta / audit projection）
 → IndustryTab / IndustryMetricPanel / ChartAuditPanel / EvidenceDrawer
```

定义：`CN_NBS_INDUSTRIAL_ROBOT_OUTPUT`，industryId=`robotics`，geography=`CN`；全国规模以上工业企业，年主营业务收入 2000 万元及以上；单位“套”；nativeFrequency=`monthly`。统计范围按原网页文字保存。工业机器人不是人形机器人单独产量，也不是全机器人产业景气代理。

声明窗口 **2026-01 至 2026-08**。7 份网页留存了 13 个读数：3—8 月的 6 个当月绝对量，以及 1—2 至 1—8 月的 7 个累计量。月度声明窗口完整性 6/8；1、2 月保留 missing，不按累计差分/插值拆月。累计与月度的 basis、referencePeriod 单独保存。窗口外历史尚未获取，不声称全历史或自动最新。

| 观测期 | 当月（套） | 年内累计（套） | 官方来源 |
| --- | ---: | ---: | --- |
| 2026-01 | missing | missing | 无独立一月发布记录 |
| 2026-02 | missing | 143608 | [1—2 月](https://www.stats.gov.cn/sj/zxfbhjd/202603/t20260316_1962782.html) |
| 2026-03 | 91954 | 237554 | [3 月](https://www.stats.gov.cn/sj/zxfb/202604/t20260416_1963329.html) |
| 2026-04 | 93246 | 323009 | [4 月](https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963731.html) |
| 2026-05 | 101150 | 424368 | [5 月](https://www.stats.gov.cn/sj/zxfbhjd/202606/t20260616_1963953.html) |
| 2026-06 | 110702 | 537689 | [6 月](https://www.stats.gov.cn/sj/zxfbhjd/202607/t20260715_1964123.html) |
| 2026-07 | 98677 | 635056 | [7 月](https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260817_1965055.html) |
| 2026-08 | 96174 | 729352 | [8 月](https://www.stats.gov.cn/zwfwck/sjfb/202609/t20260915_1965308.html) |

8 月与 7 月**留存当月读数差**为 -2503 套；不是官方季调环比增长、同口径增长率或景气判断。官网解释统计单位范围变化以及跨地区重复统计剔除会造成口径差异，因此不以累计相减替换发布的当月值，不自行推导同比。累计口径不作相邻月 delta。

`industryHistory` 按 owner 的 metric / industry / geography / scope / unit / frequency / source / referencePeriod 全键校验；外来记录使绘图及 coverage 同时 fail closed。对乱序输入稳定排序；缺失末期不回退旧值；中间缺口不跨期计算；非有限数值不绘图，0 保留。同一期多留存/重复 id 均保留记录并报 conflicted，不按 acquiredAt 猜修订先后；revision 未知时不选择“最新修订”。

## 时间、Evidence 与 admission

| 语义 | 当前真实状态 |
| --- | --- |
| observation / reference period | 原网页表头确认；月度与年内累计分离 |
| publicationDateTime | 保存页面标注的日期和时分，使用 +08:00；7 月网页为 2026-08-17 15:00，未按通用 10:00 发布日程改写 |
| releaseAvailableAt | 全部 null：本次重取网页不证明发布当时的具体字节；不复制 publication / acquired / generated / 月末 / 日程 |
| acquiredAt | 每份网络响应读完后的真实本次采集时间；不是历史首次公开时间 |
| generatedAt | normalized artifact 的实际生成时间；离线 check 使用该明确时间重算，不修改 artifact |
| revision | retainedVintage 为 raw SHA-256；sequence / supersedes=null，official continuity=unknown；内容寻址不代表官方修订号 |
| quality / completeness | 原网页有限读数 real；history partial；missing / stale / conflicted / not_admitted / unknown 从 owner 投影；freshness=unknown，无伪造官方日程 |
| Evidence | 原 Frozen `EvidenceRef` 指向 source row/column，quality=candidate；Capture Pin + raw digest 仅证明 committed replay 一致性 |
| chart linkage | null：没有可证明的 Entity / official revision 精确 Evidence Graph linkage；来源核对链不冒充正式图谱闭合 |
| data / production admission | 全部 NOT_ADMITTED；页面明确为来源核对 preview；原正式 F1 display/research/strict_pit uses 均禁止 |

F1 行业 binding 是有效合同接线，不是 READY 或可返回 eligible 数值的 industry query adapter。Entity Registry reviewed mapping、正式 vintage、release-to-specific-bytes、revision continuity 与 source admission 仍未闭合；没有新增 Registry entry。原 Macro readiness 23 metrics 的 normalization / PIT backtest 仍各 READY 0 / BLOCKED 23，未将行业 pilot 强塞进 Macro 分母。

F3 reference 仍 **33/33 PASS / REFERENCE_ONLY**；actual service **0/33 PASS、33/33 NOT_IMPLEMENTED**。新增 focused tests 是 parser/owner/UI 验证，不计入 Frozen service coverage。F2 通用 runtime 与正式 Graph 不在本轮实现范围。

## 重放与验证

- `npm run data:fetch:industry` 是显式网络采集工具；capture 目录存在即拒绝，禁止覆盖已留存字节。需要新 capture 时先新增版本化路径/计划，保留旧 manifest；当前没有自动刷新调度。
- `npm run data:build:industry` 从已留存网页生成 normalized artifact 与 F1 binding。
- `npm run data:validate:industry` 仅离线读取，校验完整 roster、URL/身份、raw SHA-256/长度、采集时间、表格、schema、normalized 全字段、Evidence pin 和原 F1 binding validator。不会自动修补不匹配 artifact。
- `.gitattributes` 对 raw 禁止换行转换，对 JSON pins 固定 LF；无新增 npm/pip 依赖。
- Hosted CI 已接入两个离线步骤：`test:industry`、`data:validate:industry`。当前仅证明本地同命令通过；workflow 触发条件仍是 PR/main push，功能分支普通 push 不会触发，**本分支 Hosted CI NOT_RUN**。

| 本地验证 | 结果 |
| --- | --- |
| authentic parser/provider Node tests | 6 PASS；全部真实原网页重放；0/missing/错误值为显式 synthetic mutation，未作为业务 fixture |
| focused owner / UI / 原 Industry UI | 25 PASS（14 + 3 + 8） |
| `npm test` | 62 files / 805 tests PASS |
| `npm run test:discovery` | PASS |
| F1 bindings / semantic runtime / readiness V1 | PASS；37 Node tests；不提升 readiness |
| Stage G tests / PBC Evidence / readiness V2 | PASS；27 Node + 14 Python tests；PBC canary PASS、full graph/source admission BLOCKED |
| F3 tests / committed eval report check | 45 PASS / replay PASS；service coverage 未提升 |
| `contracts:validate` / `test:contracts` | PASS（包括 78 项 financial-research contract tests） |
| `npm run data:audit -- --no-write` | exit 0；P0=0、errors=0；25 warnings（P1=11 / P2=14），包含新增 pilot partial 限制；非零 warning 不写成零风险 |
| `npm run build` | PASS；Local Core browser boundary、data bundle checks PASS；保留既有 >500kB chunk warning |
| browser | 144 checks PASS；Edge/Playwright，三主题 × 1536/390/320，reduced motion；真实 SVG、两种 basis、缺口、审计/来源、drawer/focus、deep links、公司导航、非机器人 unavailable；0 page errors |
| `git diff --check` | PASS |

浏览器矩阵使用全新隔离 context，不触碰用户浏览器数据。指标口径/证据操作零 storage write；外观偏好仍走原机制。空数据、冲突、0 与其他 adversarial states 由组件/owner tests 覆盖，浏览器只检验真实留存 pilot 与非机器人 unavailable，不宣称覆盖全部降级浏览器状态。证据见 [browser-report.json](stage-4-2-slice-1/browser-report.json)、[desktop](stage-4-2-slice-1/neon-1536.png)、[mobile](stage-4-2-slice-1/light-390.png)、[narrow](stage-4-2-slice-1/pro-320.png)。

## 文件与停止点

- Owner / schema：`src/types/industryMetric.ts`、`contracts/industry/industry-metric.v1.schema.json`、`config/industry/*.json`。
- Sources / normalized：`research-data/industry/nbs-robotics-v1/manifest.json`、`raw/*.html`、`src/data/real/industry-robotics.generated.json`。
- Acquisition / parser / validator：`scripts/industry/{fetch_nbs.py,nbs-parser.mjs,artifact.mjs}`。
- Runtime / UI：`industryMetricProvider.ts`、`IndustryMetricPanel.tsx`、原 `IndustryTab`、`EvidenceDrawer`、`ChartAuditPanel`、来源注册表。
- Tests / CI：`industry-metric.node.mjs`、owner/UI tests、原 Industry UI 环境补齐、`industry-metric-browser-check.mjs`、package scripts、CI、`.gitattributes`。
- CURRENT：本文及 feature registry、执行索引、architecture；附浏览器报告与 3 份截图。

普通 commit/push 后核对 local HEAD=remote HEAD 与工作区干净，停等独立审计；不创建 PR、不 merge、不修改 main。后续真实 blocker 为正式 Entity 映射、vintage/release/revision 证明与 Provider admission，不是数字显示或 parser correctness。其他指标、全历史扩展、自动刷新、行业评分/Regime 均 deferred。
