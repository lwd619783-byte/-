# Stage 4.1-F · Macro Semantic Runtime / Readiness V1

2026-09-12。实现基线：`4601a1b2afe21380a415df393bff0963185b3964`。
功能分支：`codex/stage-4-1-f-semantic-runtime-readiness`。
实现与专项合同：IMPLEMENTED / VERIFIED（本文限定范围）；独立审计：PENDING REVIEW；production/data admission：NOT_ADMITTED。
当前为审计 HEAD `1b4b252209ae38fdfb3805411fbd875ab4195c9b` 上的三项 remediation；最新边界与验证见 §9。本文不是 MERGED / MAIN CI PASS 声明。

## 1. 合同与只读边界

复用 F1 `financial-semantic-binding.v2`、原 EntityRef、SourceDefinitionVersion、MetricObservationVintage 与原 quality projection。F1/F2/F3 发布包及 `contracts/v1` 不改写。新增 `contracts/stage-4-1/v1/` 只定义本切片的结果、owner 状态投影及 readiness 报告，既有模型继续拥有事实。

`scripts/semantic-runtime/` 是可执行的 Node-only 只读 Domain API，不接浏览器、Local Core DB、HTTP、MCP 或默认 Provider refresh。读取 repo-relative retained files；路径须在根目录内，raw 字节读取消解 symlink 后再次校验。没有采集、数据库写入、评分、normalization 数值或 backtest 执行。

F1 binding checker 的 `validateBinding` 用于校验字段与 pin。runtime 不调用 `checkCase` 或 synthetic retrieval oracle。纯 `selection.mjs` 测试中的准入 context 是明确的 synthetic test seam，公开入口 `queryMacro` 不接受调用者自报的 admission/authority/conditions。

## 2. API 与 owner adapter

```js
import { queryForDefinition, queryMacro } from './scripts/semantic-runtime/market-regime-adapter.mjs';
// Caller claim only: this is not a resolved Entity Registry identity.
const claimedEntity = { entityType: 'macro', entityId: 'caller-supplied-unresolved-id' };
const request = queryForDefinition(
  'pbc-m2-balance-2011-v2',
  { start: '2011-10-01', end: '2011-10-31' },
  '2011-11-12T00:00:00+08:00',
  'strict_pit',
  claimedEntity,
);
const result = queryMacro(request);
```

请求直接使用 F1 Query：entity、bindingId/bindingRef、scopeRef、definitionVersion/scopeVersion、period(start/end/scope)、asOf、use。`queryForDefinition` 只构造精确 metric/source 请求，必须显式传入调用者的 EntityRef claim；省略时抛出 `ENTITY_REGISTRY_UNRESOLVED`。它不生成、解析或创建 Entity，字符串相等不能移除此 blocker。

`config/market-regime/semantic-bindings.v2.json` 将 28 个已有 PBC definition 分别绑定，不合并统计口径。`semantic-owner-policy.v1.json` 的 policy revision 2 移除了由 metricId 自动拼接的 EntityRef，28 个 binding 的 entity 字段保持 null。scopeRef 只 pin 统计定义及版本，不包含正式 Entity。现有 Registry/Resolver 没有可供本 adapter 消费的 reviewed macro↔macro_metric mapping：registryEntryRef/reviewedMappingRef 均 null，status=UNRESOLVED、allowAutoCreate=false。`queryMacro` 对任何调用者 Entity claim 都保留 `ENTITY_REGISTRY_UNRESOLVED`，包括 entityId 恰好等于 metricId 的情况；继续输出的只是 metric/source 诊断。policy 允许只读资格查询，但 `admittedUses=[]`，不能由 allowedUses 推出真实数据准入。

adapter 验证 binding/policy/definition/scope 的归档 SHA、locator、object identity 和 version，并从真实 PBC final evidence 读取 PARTIAL 状态。PBC sourceId 只允许对应 HTTPS 官方域名；artifact 检查 retained bytes、SHA、size、角色、source、parse state 和同一 release event。`RAW_SOURCE` 与 `TEST_FIXTURE_EXCERPT` 明确分开；fetchedAt 不作为发布日期。完整 release/extraction graph 缺失继续阻断。

`queryMacro(request, {catalogPath})` 可读取原 catalog schema，逐 observation 使用上述 adapter 验证；默认读取 committed compact ledger 作诊断。CSV 缺少 release confidence、publication、transform/quality 等字段，不补成完整 MetricObservationVintage。诊断只返回当时可得行的 evidence refs、时间与 lineage 已知字段；缺字段保留 null，selectedRefs 为空，value/unit 为空。完整 catalog 的 selectedRefs 指截止前唯一 terminal revision；即使被选中，只要任何资格条件未满足也不输出可信数值。

结果保留 value/unit、observation/publication/releaseAvailableAt/effective/revision、source/artifact/transform lineage、原 quality、coverage、admission、conflict、freshness、selected/evidence refs、conditions 与稳定 blocker codes。coverage 分母不明保持 null。

## 3. 选版与 fail-closed

先精确实体/定义/scope/period，再按 `releaseAvailableAt <= asOf` 过滤。只在可见集合内验证 predecessor、revision sequence 和唯一 root/terminal；独立链、分叉或重复 ID 不按字符串或数组顺序裁决。未来 revision 的数值、ID 与时间元数据不进入历史查询。

strict 模式遵守 F1 已冻结的保守 confidence/quality 子集。`SCHEDULE_INFERRED`、`LATEST_REVISED_PROXY` 与 F1 投影为 unknown 的 BACKCAST 不成为可信 eligible value；保留原 Market Regime backcast 时间与窗口，不修改 R1/R2 的源合同。较新的已可见坏 revision 不回退旧好值。missing/partial/conflicted/stale/not_admitted/unknown 均阻断可信 value。

source report 的 validation PASS、historical conflictCount=0、fixture 测试通过不等于正式准入、穷尽 revision 或当前 freshness。尚无正式 expected-release/grace policy 的 freshness 保持 UNKNOWN。

## 4. 真实 PBC 重放范围与限制

`replayCommittedPbc()` 校验真实 committed final ledger、definition identity、按源窗口分层的计数，以及 2011-10 PBC 官方页面 retained excerpt 的原 provenance、字节摘要与对应两条 vintage refs。ledger 为 894 行：M2 balance 256、M2 YoY 257、AFRE balance 200、AFRE YoY 181。

AFRE 主窗口 vintageCount 分别 199/180；2002–2014 backcast-search 各另有 1 条，故完整 CSV 为 200/181。不得把主窗口 availableCount、first-release count、vintageCount 和 backcast-search 合成同一 coverage 分母。

**完整真实 raw/catalog/extraction graph 重放未完成。** PBC final evidence 指向 ignored sealed output，当前 committed 输入没有完整 retained raw。现有 HTML 是保留官方原文的 TEST_FIXTURE_EXCERPT；校验它不等于 RAW_SOURCE replay。本切片返回明确 BLOCKED，不将其改名或修改历史数据使验收“通过”。若验收要求至少一个完整 RAW_SOURCE→field extraction→native observation 的正向重放，此项仍受上述真实证据缺口阻断。

## 5. Readiness Gate

`buildReadinessReport()` 从当前 committed PBC、CSRC C2A2、all-A D3 以及 frozen formula/backtest/metric 文档生成逐 metric 判断，并消费真实 adapter replay。`validateReadinessReport()` 校验版本化 schema、源引用、重新推导的报告与 committed 字节一致。手工删除 blocker、改变分母或自报 READY 不通过。

范围为原 registry 19 个 metric 加 4 个原 PBC native metric，共 23 项。normalization 与 PIT historical backtest 分别按冻结的 15/16 gate 集计算；overall 仅在两者都 READY 时 READY。三者目前均 READY 0 / BLOCKED 23。statusCounts 不再含不可达 PARTIAL；独立 progressCounts 为 PARTIAL 9 / NOT_PROVEN 14，不能用进度替代资格。

主要证据边界：PBC PARTIAL 且完整 observation graph 缺失；CSRC candidate 26、formal/strict 0、target 260；all-A D3 candidate 700 / unique keys 688、formal/strict 0、target/coverage null。其他指标尚未在这些输入中证明所需历史数据集、scope/universe、release/definition continuity 或固定分母。完整原因见 `research-data/market-regime/semantic-readiness/report.v1.json`。

## 6. 正式命令与验证

- `npm run data:validate:semantic-bindings`：F1 owner/pin/field binding 校验。
- `npm run data:query:macro -- query <repo-relative-request.json>`：只读查询；结果 blocked 是业务结果，不是命令失败。
- `npm run data:query:macro -- replay-pbc`：真实 committed PBC 证据诊断重放。
- `npm run test:semantic-runtime`：runtime 与 readiness 专项确定性测试。
- `npm run data:validate:semantic-readiness`：默认只读重推导和字节验证。
- `npm run data:build:semantic-bindings` / `npm run data:build:semantic-readiness`：显式生成本切片版本化 binding/report；未来语义变更须新版本并审计，不能自动重写已发布合同或 Golden expected。

以下保留初始交付 / 审计 HEAD `1b4b252209ae38fdfb3805411fbd875ab4195c9b` 的本地验证记录，最新 remediation 验证见 §9：

| 验证 | 结果 |
| --- | --- |
| `npm run test:semantic-runtime` | PASS：29/29（runtime 21 + readiness 8） |
| `npm run data:validate:semantic-bindings` | PASS：28 bindings |
| `npm run data:validate:semantic-readiness` | PASS：确定性推导、schema、源引用、committed 字节一致 |
| `npm run contracts:validate` | PASS；原 F3 33 cases / 8 categories |
| `npm run test:contracts` | PASS：原 V1 106 + Foundations 78 |
| `npm test` | PASS：55 files / 725 tests |
| `npm run build` | PASS：TypeScript、Local Core typecheck、Vite、bundle gate |
| `npm run data:audit -- --no-write` | PASS with warnings：0 errors / 24 warnings / 10 skipped |
| `npm run env:check` | READY WITH WARNINGS：48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `git diff --check` | PASS |
| Git index LF export 中的 binding / readiness 验证 | PASS；不依赖工作区 CRLF 或 ignored raw（不是完整 Linux 环境认证） |
| 完整 PBC RAW_SOURCE → extraction → native observation 正向重放 | BLOCKED / NOT_RUN：完整证据不在 committed 输入中 |
| 新 normalization 数值、Candidate A–D、formula/production admission | NOT_RUN / NOT_GRANTED（任务边界） |

自审修复：空集在无其他准入阻断时返回 missing；两个 derived macro metric 不借用 native bindings 的 PASS；AFRE 主窗口和额外 backcast-search 按原 scope 分层对账。原 F3 suite roster/identity/expected、历史数据、既有合同保持不变。以上为本地实现验证，不替代远端独立审计或 MAIN CI。


## 7. 逐指标 readiness 摘要

normalization / PIT historical backtest / overall 各 READY 0 / BLOCKED 23；progress 独立为 PARTIAL 9 / NOT_PROVEN 14。以下保留 source/data 主要原因；此外全部 23 项均有 ENTITY_REGISTRY_UNRESOLVED，共 16 gateChecks 与全部 blockers/refs 以当前机器报告为准。

| Metric | 主要 blocker |
| --- | --- |
| `FLOW_MARGIN_BALANCE` | `MARGIN_PIT_DATASET_NOT_PROVEN` |
| `FLOW_EQUITY_ETF_NET_FLOW` | `ETF_NET_SUBSCRIPTION_HISTORY_NOT_PROVEN` |
| `FLOW_NORTHBOUND` | `NORTHBOUND_FIELD_AND_SCOPE_HISTORY_NOT_PROVEN` |
| `SENT_A_SHARE_TURNOVER` | `OFFICIAL_CALENDAR_DENOMINATOR_UNPROVEN` |
| `SENT_NEW_INVESTORS` | `CHINACLEAR_COMPARABLE_INVESTOR_HISTORY_NOT_PROVEN` |
| `VAL_MARKET_PE_PERCENTILE` | `CSI300_TTM_PE_HISTORY_NOT_PROVEN` |
| `VAL_BUFFETT_INDICATOR_CN` | `OFFICIAL_CALENDAR_DENOMINATOR_UNPROVEN` |
| `SUPPLY_IPO_FINANCING` | `HISTORICAL_ATTACHMENT_VERSION_UNPROVEN` |
| `SUPPLY_REFINANCING` | `REFINANCING_DEFINITION_AND_PIT_NOT_PROVEN` |
| `SUPPLY_REDUCTION` | `EXECUTED_REDUCTION_HISTORY_NOT_PROVEN` |
| `SUPPLY_BUYBACK` | `EXECUTED_CANCELLATION_BUYBACK_HISTORY_NOT_PROVEN` |
| `SUPPLY_PRESSURE_COMPOSITE` | `REQUIRED_COMPONENT_NOT_READY` |
| `MACRO_M2` | `PBC_COVERAGE_PARTIAL` |
| `MACRO_SOCIAL_FINANCING` | `PBC_COVERAGE_PARTIAL` |
| `PROFIT_INDUSTRIAL` | `PROFIT_COMPARABLE_VINTAGE_DATASET_NOT_PROVEN` |
| `PROFIT_LISTED_BREADTH` | `WHOLE_MARKET_EARNINGS_UNIVERSE_NOT_PROVEN` |
| `PROFIT_CYCLE_CLASSIFIER` | `REQUIRED_COMPONENT_NOT_READY` |
| `POLICY_CYCLE_CORRECTION` | `POLICY_EVENT_DATASET_AND_IMPACT_TAXONOMY_NOT_PROVEN` |
| `STRUCTURAL_BUBBLE_TEMPERATURE` | `STRUCTURAL_CROSS_SECTION_DATASET_NOT_PROVEN` |
| `MACRO_M2_BALANCE` | `PBC_COVERAGE_PARTIAL` |
| `MACRO_M2_YOY` | `PBC_COVERAGE_PARTIAL` |
| `MACRO_AFRE_STOCK_BALANCE` | `PBC_COVERAGE_PARTIAL` |
| `MACRO_AFRE_STOCK_YOY` | `PBC_COVERAGE_PARTIAL` |

## 8. 初始交付变更文件（审计输入 HEAD）

- `.gitattributes`
- `config/market-regime/semantic-bindings.v2.json`
- `config/market-regime/semantic-owner-policy.v1.json`
- `contracts/stage-4-1/v1/README.md`
- `contracts/stage-4-1/v1/readiness.schema.json`
- `contracts/stage-4-1/v1/semantic-runtime.schema.json`
- `docs/architecture.md`
- `docs/development-execution-plan-2026-09-07.md`
- `docs/feature-registry.md`
- `docs/market-regime/semantic-runtime-readiness-v1.md`
- `package.json`
- `research-data/market-regime/semantic-readiness/report.v1.json`
- `scripts/semantic-runtime/bindings.mjs`
- `scripts/semantic-runtime/cli.mjs`
- `scripts/semantic-runtime/common.mjs`
- `scripts/semantic-runtime/market-regime-adapter.mjs`
- `scripts/semantic-runtime/readiness.mjs`
- `scripts/semantic-runtime/selection.mjs`
- `scripts/tests/semantic-readiness.node.mjs`
- `scripts/tests/semantic-runtime.node.mjs`

`.gitattributes` 仅为本切片 pin 的文本输入固定 LF；原始 HTML 保持 -text，历史 JSON/CSV/docs 在 Git 中的内容未变。最终 SHA 与远端相等性在 push 后交付消息中报告；本文不预写远端事件。

## 9. 三项独立审计 remediation（CURRENT）

Audit input HEAD：`1b4b252209ae38fdfb3805411fbd875ab4195c9b`；直接 main 基线：`4601a1b2afe21380a415df393bff0963185b3964`。仅修复 Hosted CI、Entity identity、两套 readiness policy；不新增 source evidence，不改变历史准入，不实施 normalization 数值/backtest/UI/acquisition/Agent。

### CI 与 Entity 边界

`.github/workflows/ci.yml` 在已有 Market Regime D2 校验后、sample catalog build 前直接运行三项：`data:validate:semantic-bindings` → `test:semantic-runtime` → `data:validate:semantic-readiness`。PR 与 main push 共用；无条件跳过、continue-on-error 或生成 semantic artifacts。checkout + npm ci 后读取 committed bytes，任何非零退出都会使 job 失败。

F1 冻结合同要求实体解析到原 Registry。现有 `contracts/v1/entity-resolution.v1.schema.json` 和 `local-core/domain/resolver.ts` 定义真实 Registry/Resolver，但没有 reviewed macro↔macro_metric mapping 可用于本 adapter；`local-core/domain/entity-service.ts` 本身禁止机械转换。没有读取本机私有 DB、创建正式实体或第二套 Registry。Schema-valid EntityRef、metricId 相等、displayName 均不证明 resolution；当前仅 UNRESOLVED。未来真实 mapping 必须另行评审并 pin owner identity/status/version，不能改 policy status 来绕过。

### 两套 gate 集

以下 15 项明确属于 `NORMALIZATION_GATES`，并作为 normalized score 的前置条件显式列入 `PIT_BACKTEST_GATES`：

1. SEMANTIC_BINDING_VALIDATION
2. SEMANTIC_BINDING_COMPLETENESS
3. ENTITY_REGISTRY_RESOLUTION
4. SOURCE_DATA_ADMISSION
5. VERSIONED_SOURCE_CONTRACT
6. OFFICIAL_CALENDAR_OR_NATIVE_PERIOD_GRID
7. RELEASE_AVAILABLE_AT_DATE_SAFE
8. RELEASE_ARTIFACT_BINDING
9. ORIGINAL_REVISION_OR_KNOWN_BACKCAST_LINEAGE
10. CANONICAL_SCOPE_AND_UNIT
11. DEFINITION_CONTINUITY_ERA_BREAKS
12. REQUIRED_DENOMINATOR_AND_UNIVERSE
13. COMPLETE_OBSERVATION_GRAPH_REPLAY
14. PIT_SELECTOR_AT_WEEKLY_CUTOFF
15. HISTORY_MATURITY_AND_MISSINGNESS

`PIT_BACKTEST_GATES` 另含 `HISTORICAL_COVERAGE`（共 16 项）：评估整个目标回测时代的覆盖，区别于单次 normalization 所需的成熟窗口。冻结 formula-normalization-v1 §3.2–3.3 要求 PIT percentile 和最小历史；因此 release/lineage/cutoff/maturity 明确共享，不能为了制造 normalization READY 放松它们。机器 `gatePolicy` pin 两份方法论文档并记录两集合及理由。

每个 verdict 只检查自己的 gate set：全部 PASS 才 READY；缺失、UNKNOWN、BLOCKED 均拒绝。overall 规则为 BOTH_READY；无 readiness PARTIAL。回归证明只阻断 HISTORICAL_COVERAGE 时 normalization 可 READY、backtest BLOCKED；任何共同 gate 不合格则各自阻断。此证明只使用 synthetic gate 状态，不修改真实数据。

### Remediation 验证与当前停止点

本轮本地验证（2026-09-12）：

| 验证 | 结果 |
| --- | --- |
| `npm run data:validate:semantic-bindings` | PASS，28 个 binding，entity=null，policy revision 2 |
| `npm run test:semantic-runtime` | PASS，37/37（runtime/CI 26 + readiness 11）；包含原 29 项 |
| `npm run data:validate:semantic-readiness` | PASS，committed 报告重新推导一致 |
| `npm run contracts:validate` | PASS；F3 33 cases / 8 categories 不回归 |
| `npm run test:contracts` | PASS，106 + 78 |
| `npm test` | PASS，55 files / 725 tests |
| `npm run build` | PASS，TypeScript / Local Core / Vite / bundle gate |
| `npm run data:audit -- --no-write` | PASS with warnings，0 errors / 24 warnings / 10 skipped |
| `npm run env:check` | READY WITH WARNINGS，48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| CI YAML、PR/main trigger、顺序、失败传播配置 | PASS；三项均为直接 run，未新增生成步骤或失败忽略 |
| Git index committed-byte export 的三门禁 | PASS；37 tests；没有 ignored raw，使用同一已安装的 package 依赖，不声称完整 Linux/Hosted 环境认证 |
| 临时 export 的 binding/report/test 故障注入 | PASS，三项各 exit 1；伪造 mapping status/ref/allowAutoCreate 均拒绝 |
| `git diff --check` / staged diff check | PASS |
| 与审计 HEAD 的真实证据/计数对账 | PASS；历史 source-catalog、F1/V1 合同和 Local Core 无 diff |

真实状态维持：PBC ledger=894，all-A D3 NOT_ADMITTED、formal/strict=0、target/coverage=null，完整 RAW_SOURCE replay BLOCKED/NOT_RUN。当前新增 ENTITY_REGISTRY_UNRESOLVED；两个 consumer 各 READY 0 / BLOCKED 23，overall 同为 0/23，progress 9 PARTIAL / 14 NOT_PROVEN。

此功能分支尚无 PR/main Hosted CI 运行结论，CI wiring 本地验证不能写成 MAIN CI PASS。普通 commit/push 后核验 local/remote HEAD，停止等待复审，不创建 PR、不 merge。战略 roadmap 不变。

### 本次 remediation 变更文件

- `.github/workflows/ci.yml`
- `config/market-regime/semantic-bindings.v2.json`
- `config/market-regime/semantic-owner-policy.v1.json`
- `contracts/stage-4-1/v1/readiness.schema.json`
- `docs/architecture.md`
- `docs/development-execution-plan-2026-09-07.md`
- `docs/feature-registry.md`
- `docs/market-regime/semantic-runtime-readiness-v1.md`
- `research-data/market-regime/semantic-readiness/report.v1.json`
- `scripts/semantic-runtime/bindings.mjs`
- `scripts/semantic-runtime/market-regime-adapter.mjs`
- `scripts/semantic-runtime/readiness.mjs`
- `scripts/tests/semantic-readiness.node.mjs`
- `scripts/tests/semantic-runtime.node.mjs`
