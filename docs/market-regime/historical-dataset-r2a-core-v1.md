# STAGE 4.1 — R2-A Historical Dataset Contract & Validation Core V1

实现基线：`origin/main @ 4f309255d8bea776846d4b6443ae29d25ce95397`。
分支：`feat/stage-4-1-r2a-historical-dataset-contract-core-v1`。
状态：离线合同实现与验证完成，等待独立合同审查；未授权 R2-B/C/D、回测或生产准入。

Source of Truth 为 [R2 Scope Freeze V1](observation-catalog-r2-scope-freeze-v1.md)，本次未修改该文件、R1 schema/实现/sample、冻结公式或业务代码。

## 对象与信任边界

```text
外部 versioned plan registry ── planId / planContentSha256 ──┐
  source roots / pagination / target windows / calendar     │
                                                           ▼
R1 catalog ── catalogContentSha256 ──────────────── R2 manifest
  definitions / successful artifacts / numeric vintages     │
                                                           ├─ releaseEvents
                                                           ├─ artifactBindings
                                                           ├─ fieldExtractions
                                                           ├─ coverageLedger
                                                           ├─ retrievalAttempts
                                                           ├─ conflicts
                                                           └─ inventoryEvidence
```

R2 schema 位于 `config/market-regime/historical-dataset.schema.json`；Python TypedDict 位于 `scripts/market_regime/historical_models.py`。Python 直接运行该 JSON Schema，然后运行对象图、bytes、时间、lineage、coverage 与 manifest 检查；没有另建 schema 解释器。复用 R1 canonical hashing、atomic write、catalog validator、月度定义区间、PIT clock 与 HTML link helper。

所有 R2 对象拒绝额外字段，集合 ID 唯一，引用必须存在；locator 使用 artifact ID + UTF-8 byte offset/length + 原文，校验实际存档 bytes。R2 artifact binding 补充完整响应与内容检查状态，不向 R1 artifact 增加未知字段。失败下载仅进入 retrieval sidecar，支持保存被拒绝的 200 响应 bytes。校验失败返回 FAIL，builder 不发布或覆盖输出。

完整性与真实性的边界仍需独立审查：本核心检查存档内容与声明能否一致重放，不能替代官方来源、首次发布规则、字段口径、分页穷尽性或 parser 的独立审计。`HISTORICAL` plan 必须由后续已获授权的源切片提供并审查；plan 文件属于审核输入，不从 dataset 自我声明生成。源专用 XLS/DOCX parser、网络 collector、all-A aggregator 均未实现。证据 locator 采用 UTF-8 原文片段；后续二进制表格 parser 应在独立合同审查中明确其可重放定位方式，不能伪装成已通过本核心的 UTF-8 字段证据。

## Plan identity 与分母

```text
planId = planName + ":v" + planVersion + ":" +
         SHA256(canonical_order(all plan fields except planId))
```

registry 必须由调用者显式传入。每条 plan 同时校验结构、完整 SHA-256 identity、source roots、分页约束与目标窗口。空 registry、悬空引用、重复 ID、相同 name/version 的不同内容、旧 identity 配新窗口都会拒绝。manifest 的 plan hash、as-of、targetWindows 必须精确匹配解析后的 plan。

本次唯一提交的 registry 是 `config/market-regime/historical-dataset-plans.sample.v1.json`，内容为明确的 `SYNTHETIC_OFFLINE` plan：

```text
r2a-offline-protocol:v1.0.0:acf7f1d1272a548def30841fb313caeabfcea3692c31407f53cbb52853ee5234
```

样本 as-of 沿用 `2026-09-07T08:00:00+08:00`，仅模拟 2026-01..03 三个月度格、2026-09-03/04 两个交易日格；这是测试窗口，不是对冻结正式历史窗口的缩短。正式 M2/CSRC 260 月、AFRE 140 月的展开算法已离线测试；真实交易日分母和源计划需后续官方日历、定义与分页证据，未伪造生产 registry。

月频 grid 从窗口边界逐月展开；日频必须提供 versioned calendar 和可重放日期证据。ledger 必须与 grid 逐格相等，缺格、多格、重叠窗口拒绝。`availableCount` 按期间计，`vintageCount` 另计；互斥主计数为 available + not-yet + structural + unresolved，其和始终等于 targetCount。proven-first/backcast 是 available 的附加维度，不再次相加。

`AVAILABLE` 必须精确列出全部已知、在 as-of 前合格的 vintages。未知/缺失/不可达/结构性格不创建数值；schedule inferred、latest revised proxy 不准入 strict。backcast 按实际后发时间可见。fixture 全部排除正式覆盖。inventory、dataset coverage 和 revision coverage 分开计算，不能凭较多 revisions 提高期间覆盖。

## Hash projection 与 release identity

`dataset_content_projection` 明确包含：

- manifest 的 schemaVersion、datasetVersion、planId、planContentSha256、datasetAsOf、targetWindows、catalogContentSha256；
- 七个 sidecar 的完整业务内容，含 release links、coverage、parser version、retrieval provenance。

投影排除 generatedAt、datasetContentSha256 自身、派生 sidecar hashes、validation/admission/summary 字段；派生字段在 validator 中独立重算。R1 catalog hash 已绑定定义、数值、artifact metadata。fetchedAt 是输入 provenance，保留在业务哈希中。

所有 R2 arrays 定义为集合并递归 canonical 排序；有序的业务关系通过 revisionSequence/predecessor IDs 表达。沿用 R1 UTF-8、sort_keys、无空白 canonical JSON、`allow_nan=False`。固定 generatedAt 重建字节相同；仅改 generatedAt 不改业务 hash。CLI 对已生成输出只允许相同 bytes 的幂等重建，不覆盖不同的 sealed 输出。

release ID 由 source、landing URL、event section、publication/availability/confidence、kind、coveredPeriods 确定，不含 artifact 引用。artifact ID 使用 source + URL + releaseEventId + 完整 bytes SHA-256，因此没有身份自引用，也不会因相同 bytes 折叠独立事件。sample 的 5 个 event/artifact view 共用一个 bytes hash。

sample dataset business hash：

```text
7e0dc78008cc22d680d15b13cafb5c40f53f5bfc68251d1b723877372b8bc94d
```

## 验证结果

| 验收 | 结果 |
| --- | --- |
| CORE-1 | PASS：换序/固定时间确定性、generatedAt 排除、自引用拒绝、sidecar/definition/parser/provenance hash 绑定、plan identity/reference 对抗 |
| CORE-2 | PASS：单 byte、size、Windows/POSIX/ADS/UNC/编码路径、symlink/junction containment、非 2xx、200 错误页、伪 RAW_SOURCE、失败 bytes 保留、真实 zero token |
| CORE-3 | PASS：07:59/08:00 可用，08:01 不可用；Sunday/Monday date-only；节假日 Monday clock；无时区时间拒绝 |
| CORE-4 | PASS：first/revision cutoff 选择、断链/环/同序/跨源、旧 artifact 复用、first-release proof、相同 bytes 多事件、conflict 排除与伪 resolution |
| CORE-5 | PASS：missing/unreachable/structural/absence/not-yet 证据约束、proxy/schedule 排除、date-only backcast、R1 gap=0 拒绝、YTD evidence-only |
| CORE-6 | PASS：缺月/缺交易日/重复 vintage/fixture admission/计数篡改/日历缺失；inventory PASS 与 dataset PARTIAL 并存 |
| `npm run test:market-regime:historical` | PASS，46 tests；含 machine schema / TypedDict 字段同步与 CLI failure/idempotence |
| `npm run data:build:market-regime:historical` | PASS，SYNTHETIC_ONLY，正式 availableCount=0，dataset coverage PARTIAL |
| `npm run data:validate:market-regime:historical` | PASS，强制重算本地 bytes 与整个对象图，无跳过 artifacts 的入口 |
| `npm run test:market-regime:catalog` | PASS，原 48 tests |
| `npm run data:build:market-regime:catalog` | PASS，8 observations / 5 artifacts，原 content hash 不变 |
| `npm run data:validate:market-regime:catalog` | PASS，verify-artifacts，0 errors |
| `npm run env:check` | READY WITH WARNINGS，43 PASS / 15 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `npm test` | PASS，39 suites / 597 tests，exit 0 |
| `npm run build` | PASS，TypeScript / Local Core typecheck / Vite / bundle boundary；既有大 chunk warning |
| `git diff --check` | PASS；提交前再次检查 staged diff |

运行时：Node 22.23.2、Python 3.13.9；复用既有 `jsonschema`，未增加或升级依赖。标准运行环境为 4.26.0，另在 ignored 隔离目录验证仓库 `requirements-provider-observability-test.txt` 已固定的 4.25.1。日期格式检查显式注册，避免可选 format 包缺失时静默跳过 RFC 3339 验证。

env WARN 为运行时多路径、既有未固定 Python 依赖/pip check、sibling worktree 中未安装的 4 个外部 Skill managed copies、提交前未配置 upstream/dirty tree、ignore 提示、旧生成物与公告 partial。未为消除 WARN 修改环境治理或数据。复用既有 node_modules 的本地 junction，不提交该目录。R1 sample 与 Vite 配置的重建换行变动经确认没有内容 diff 后恢复。

本次 sibling worktree 不含历史 nested worktrees，标准 `npm test` 直接通过；未修改测试配置，也未把旧目录中的 discovery failure 宣称为已经修复。

R1 sample business hash 保持：`b7f9802eb46d44088adb75471c190af4c9b48d471a8865ef3b531d4c6b3bfec6`。

## 文件范围与复现

- `config/market-regime/historical-dataset.schema.json`
- `config/market-regime/historical-dataset-plans.sample.v1.json`
- `scripts/market_regime/historical.py`
- `scripts/market_regime/historical_models.py`
- `scripts/market_regime/historical_validator.py`
- `scripts/market_regime/historical_cli.py`
- `scripts/tests/market_regime_historical_fixture.py`
- `scripts/tests/test_market_regime_historical.py`
- `scripts/tests/fixtures/market_regime/r2a-synthetic-response.html`
- `scripts/tests/fixtures/market_regime/r2a-input.sample.v1.json`
- `scripts/tests/fixtures/market_regime/r2a-dataset.sample.v1.json`
- `scripts/tests/fixtures/market_regime/r2a-adversarial.v1.json`
- `package.json`：仅新增三个显式 offline commands
- 本验收说明

依次执行新增 test / build / validate。build 输出位于既有 ignored 路径 `research-data/market-regime/catalog/historical-dataset.sample.generated.json`；committed sample 为独立 replay fixture，避免 Git 换行转换改变 generated output 的幂等判定。无网络抓取；原有 raw HTML 的 `-text` 属性已覆盖新增 HTML fixture。

剩余门禁：本核心须独立合同审查通过后才供后续 slices 使用。真实首次发布/vintage、AFRE cadence、CSRC 格式/字段定位、官方日历与交易所 daily PIT、分页与修订穷尽性尚无本次数据准入；CSI300 PE 仍 NO_GO。本次到普通 commit + push 停止，不创建 PR、不合并 main、不开始 R2-B。
