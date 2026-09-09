# Stage 4.1 R2-D2 — all-A completeness / admission V1

实现基线：`origin/main @ c731ec84be35ac91b0371ef294669203d78bc18d`。
分支：`codex/stage-4-1-r2-d2-all-a-admission`。

**D2 离线实现与专项验证完成；真实 dataset admission 为 NOT_ADMITTED，all-A numeric observations 为 0。**
三所 D1 source contract 已审计，不代表它们的历史数值已准入。本版本没有正式源准入窗口；没有修改任何 SSE/SZSE/BSE contract、inventory、adapter、historical CORE 或准入状态。

事实源：[Scope Freeze](observation-catalog-r2-scope-freeze-v1.md)、[R2-A Core](historical-dataset-r2a-core-v1.md)、[SSE](sse-historical-source-contract-r2d1a-v1.md)、[SZSE](szse-historical-source-contract-r2d1b-v1.md)、[BSE](bse-historical-source-contract-r2d1c-v1.md)，以及对应机器合同和 committed inventories。

## 真实报告与范围

[admission-report.v1.json](../../research-data/market-regime/source-catalog/all-a-d2/admission-report.v1.json) 是 D2 admission report，不冒充具有完整日频 grid 的 R2 historical dataset envelope。
固定 `datasetAsOf=2026-09-07T08:00:00+08:00`，日频目标末端 `2026-09-04`。

| era / marketScopeVersionId | required exchanges | turnoverValue | totalMarketCap | negotiableMarketCap |
| --- | --- | --- | --- | --- |
| 2005-01-01..2021-11-14 / `all-a-sse-szse-pre-bse` | SSE、SZSE | NOT_ADMITTED / 0 | NOT_ADMITTED / 0 | NOT_ADMITTED / 0 |
| 2021-11-15..2026-09-04 / `all-a-sse-szse-bse-v2` | SSE、SZSE、BSE | NOT_ADMITTED / 0 | NOT_ADMITTED / 0 | NOT_ADMITTED / 0 |

每个 era/field 的完整交易日分母和覆盖百分比均为 **unknown / null**。`dailyGrid=null`，`observations=[]`；六个完整未准入窗口均保留，没有利用 weekday、probe 日期、bounded calendar 子窗口或单所日历缩小分母。第二个 market scope 的语义自 2021-11-15 延续；本 dataset 的统计窗口仍止于固定末端。

BSE 开市前单列为 `OUTSIDE_REQUIRED_SCOPE`，`value=null`、`releaseAvailableAt=null`。它不是第一时代的 missing component，既不增加分母，也不作为零参与合计。

报告逐源绑定 inventory / contract hash，逐字段保留 blockers 和 D1 原始 unadmitted windows：

- 三所共有：没有正式 exchange observation、没有 market release、完整官方交易日历未闭合。
- SSE：API 字段定义/适用性与官方 release 未证明，R2 calendar literal ISO locator 门禁未闭合。
- SZSE：历史连续性、字段定义适用、首次发布/修订、PIT 未证明；secondary family 混合范围/缺少 response date，旧 response family 未准入；流通市值与 free-float 不建立等价。
- BSE：历史未穷举、字段 scope/era 适用、交易方式/大宗交易包含关系、首次发布/修订、市场 release 未证明；R2 calendar locator 门禁未闭合；不将流通市值解释为 free-float。

当前报告将公共原因保存在 `sourceInventories.sourceBlockers`，字段原因保存在 `sourceInventories.fields.*.blockers`；`admissionMatrix.blockers` 和未准入窗口中的 `sourceReasons` / `reasons` 分别传播两类原因。字段归属更正及当前 hash 见末节。

## 聚合与信任边界

新增独立模块 `scripts/market_regime/all_a_admission.py`，不注册生产 Provider，不计算 normalization、比例、formula、backtest、UI 或 production weights。

`aggregate_all_a` 输入是每所的 `{exchange, dataset, catalog, plans}`，不是 candidate 数组。逐分源调用现有 `validate_dataset`，重放 schema、原始 bytes/hash/size、release、extraction、definition、calendar、coverage、revision 和 conflict 图。任何伪 admitted flag、无 lineage、错误时间、错误原始 bytes 或未知输入字段均不能绕过 CORE。

CORE PASS 之后还须通过独立的源/字段准入身份：精确 dataset business hash、plan ID、source/definition、field、scopeVersion、A 股 security scope 和单位必须与外部审核登记一致。登记不是从输入 manifest 或 coverage 的 PASS 字段自动生成。**本版 `HISTORICAL_ADMISSIONS` 为空**；未来真实源数据准入需要独立审核的后继版本，不能改 generatedAt、reseal inventory/dataset 或复用测试登记来提升真实 admission。

逐 `tradeDate + field` 计算 required exchanges，全部满足以下条件才生成该字段 observation：

1. 当期 market scope 要求的每所都在输入中；重复所、额外的 scope 外 component、其他日期或缺一所均拒绝。BSE pre-launch marker 不传入 component 列表，若把它或补零值传入聚合则拒绝该请求。
2. 正式 observation 有该字段数值，存在合格的 AVAILABLE coverage cell 和同日 DAY extraction。Source definition 是 DAILY / EXCHANGE_MARKET_STATS，字段意义由审核过的精确 mapping 绑定。
3. 币种为 CNY，原单位和输出单位均有明确 CNY 尺度。本版接受 `CNY`、`元`、`亿元`、`百万元`；核验 R2 extraction 的转换 factor，并由原始数字 token 重放 CNY 值。其他单位、混合币种或不一致 factor 拒绝，不推断汇率。
4. 每个 component 满足严格 PIT，release 不晚于 cutoff；cutoff 不越过 datasetAsOf。使用 aware datetime 比较。仅 tradeDate 不构成发布时间。
5. 同字段多 vintage 先通过 CORE 的完整 revision/conflict 检查，再选择 cutoff 前合格的最新版本。失败保留 reason，不补零或结转前日数据。

成功记录 `aggregationVersion`、`marketScopeVersionId`、CNY 数值与精确十进制 `valueText`；每个 component 保存 observation/extraction/release IDs、原始及发布/定义依据 artifact IDs、dataset hash、plan ID、source definition 和转换后值。`releaseAvailableAt` 严格取所有 component 的最大实际时点。三个字段独立，一个字段缺失不阻断其他完整字段。

`validate_aggregation` 从同一外部输入重新计算数值、lineage 与状态；`validate_report` 从固定 D1 inputs 重建完整报告。两者均不把输出自身的 hash 视为审核凭据，重新 seal 伪数字、分母、状态或 lineage 仍失败。报告同时使用独立固定的 D1 inventory business hashes，保留 sibling compact validator 的能力边界。

真实报告执行 **compact replay + 固定审核身份核验**，不声称重放 ignored raw archive 内全部 HTML/脚本。SSE compact 的结构检查、SZSE/BSE 的 committed response 重放仍遵循各自 D1 合同；大原文缺失时 hash 本身不能证明其 bytes。D2 不刷新真实数据。

## 合成验证与可重放性

`scripts/tests/all_a_admission_fixture.py` 仅在临时目录构造明确命名的 synthetic admitted 协议模型。它沿用 R2-A `historical=True` 测试模式，模拟完整 RAW_SOURCE / HISTORICAL 图以经过原有正向门禁，不放宽 CORE 的 fixture 排除规则。这些 bytes 不是官方获取证据，模拟获取记录明确声明没有网络请求。

测试显式传入 `synthetic_admissions` 时，所有聚合结果强制为 `SYNTHETIC_ONLY` / `SYNTHETIC_ADMITTED`，`historicalCoverage=0`。真实 CLI 不接受合成输入或任意 admission registry；报告不导入测试模块。相同模型传入历史模式仍全部拒绝。

合成测试证明沪深时代及三所时代的正向合计、三个字段的独立性、CNY 单位换算、真实零 token、cutoff 等号、全部 component lineage 和 max release 可重放。反例覆盖 candidate 冒充、缺所、错日、缺字段、范围/单位/币种、晚发布、无 release/extraction、缺日历、pre-launch 补零、错误 bytes、fixture role、伪 ledger 与 generated/reseal promotion。

集合顺序 canonical 化；固定输入重复执行一致；generatedAt 不进入业务 hash。固定生成时间为 `2026-09-09T00:00:00Z`，用于确定性序列化，不冒充采集或执行时间。初次交付 `472df0f` 的真实报告 business hash（历史记录，已由末节更正取代）：

```text
f07113d96b0a95a00c15ac7f1acf67b88fc9dffc55f6a1dcaa37f754ff045a1a
```

显式离线复现命令：

```text
npm run test:market-regime:all-a
npm run data:build:market-regime:all-a
npm run data:validate:market-regime:all-a
```

build 对相同 sealed 报告幂等；不同内容报错，不覆盖已存在报告。

## 初次交付验收结果（472df0f）

| 检查 | 结果 |
| --- | --- |
| D2 专项 / MARKET-3、MARKET-5、相关 CORE | PASS，37 tests |
| historical CORE | PASS，66 tests |
| SSE / SZSE / BSE | PASS，22 / 37 / 25 tests |
| catalog 回归 | PASS，48 tests |
| D2 report build / validate | PASS；6 matrix rows；真实 numeric aggregate count=0；targetCount=null |
| `npm run build` | PASS；TypeScript、Local Core、Vite、financial bundle boundary；既有 >500 kB chunk warning |
| `npm run data:audit` | exit 0；errors=0，warnings=24（P1=10、P2=14）；自动重写的旧审计报告已恢复，不回写历史审计 |
| `npm run env:check` | exit 0；47 PASS / 11 WARN / 0 FAIL / 4 SKIP，READY WITH WARNINGS |
| `npm run env:check:json` | exit 0；47 PASS / 11 WARN / 0 FAIL / 4 SKIP，READY WITH WARNINGS |
| 标准 `npm test` | exit 1；仅 2 个已知 nested-worktree discovery 失败；101 files passed，1661 tests passed |
| `npm test -- --exclude 'data-cache/**'` | PASS；主仓 39 files / 597 tests |
| `git diff --check` | PASS |

标准测试两个失败均为 `data-cache/worktrees/{stage-4-1-r2,v2-phase1}/scripts/tests/company-guidance-expectations.test.mjs` 的 `No test suite found`。没有修改全局 test 配置或历史 worktree，主仓排除验证不代替标准命令的失败结论。

env warnings 涉及既有多运行时路径、4 个未固定 Python 依赖、pip check 问题、ignore/旧生成物/公告 partial，以及检查当时分支尚未 push、改动尚未 commit 的状态。没有为消除 warning 改环境、依赖、数据或治理。

交付范围仅 D2 模块、合成 fixture/专项 tests、真实紧凑 report、本说明及三个 package scripts。完成普通 commit + push 后停止；不创建 PR、不 merge，不授予 dataset / normalization / backtest / production admission。

## 独立审计修复：字段 blocker attribution

在 `472df0fcfabc434c435cecfdcbec165e65320776` 上追加修复，不重写此前提交。原 `build_report()` 将 source admission 的完整 blockers 列表复制到每个字段，造成字段语义污染；同时 SSE inventory 没有顶层 admission 列表，原报告遗漏了 D1 已明确限定于流通市值的原因。

本次逐一核对三所机器 contract 的 `fieldAdmission`、committed inventory 的 `dayAssessments.fields` 与已审计 `assess_day()` 分支，固定以下字段归属：

| 交易所 | 字段 | 专属 blocker |
| --- | --- | --- |
| SSE、SZSE | negotiableMarketCap | `NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN` |
| BSE | negotiableMarketCap | `NEGOTIABLE_NOT_PROVEN_FREE_FLOAT` |
| BSE | turnoverValue | `TRADE_MODE_AND_BLOCK_TRADE_INCLUSION_UNPROVEN` |

每字段同时保留对应 `contract.fieldAdmission[field].reason`。公共 source blockers 单列，包括没有正式 observation、没有 market release、完整日历未闭合，以及 D1 其余源级门禁；未明确归属到字段的 source reason 继续保留。矩阵与未准入窗口同时携带 `sourceReasons` 和字段 `reasons`，不将公共原因冒充字段专属原因。

上述语义映射由 D1 源实现证明，并校验与固定 inventory 中的逐字段原因一致；没有从 probe 缺失/休市日期推断整段历史缺失。没有修改 aggregator、任何 source admission gate、D1 contract/inventory 或历史证据，没有刷新数据。

更正后报告仍为 **NOT_ADMITTED / numericAggregateCount=0**，两个 era、三个字段均未准入；分母与 coveragePercent 均为 null。通过既有 builder 在临时输出重建并 validate 后替换当前报告文件；保留 CLI 的不同 sealed 内容拒绝覆盖规则。新业务内容自然产生新 hash：

```text
4ba8737f2dc9e0ba32a35249b36b07075253ea9a11270b67be78029f9ff3b3c1
```

本次验证：D2 **40 tests**（新增 3 项覆盖三所/三字段及矩阵/窗口）、historical CORE **66**、SSE **22**、SZSE **37**、BSE **25**、catalog **48** 全部通过；report build/validate、build 和 `git diff --check` 通过。data audit 为 0 errors / 24 warnings，其生成的旧审计文档已恢复。

两种 env check 均 exit 0、48 PASS / 10 WARN / 0 FAIL / 4 SKIP。标准 `npm test` 仍 exit 1，仅前述两个 nested-worktree `No test suite found`；101 files / 1661 tests 通过。排除 `data-cache/**` 后主仓 39 files / 597 tests 全部通过。既有 build chunk 与环境警告未通过范围外改动消除。
