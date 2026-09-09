# Stage 4.1 R2-C2A2 — CSRC IPO Historical Release Provenance & PIT Admission V1

日期：2026-09-09。结果：**26/26 个月完成本次限定路径调查，strict PIT 证明成功 0/26；`eligiblePeriods=[]`，formal observations=0。** 全部保持 `PIT_VINTAGE_UNPROVEN`，不是生产准入。来源调查与实现结果等待普通 push 后的独立审计。

## 基线与范围

- 仓库：`lwd619783-byte/-`；开工 `git fetch origin --prune` 成功。
- 精确 actual base / 开工 origin/main：`bce9a3178a10057dbb39d3c57ae9776feb0786c7`；工作树干净。
- 新分支：`codex/r2-c2a2-csrc-ipo-historical-provenance`，直接从上述 origin/main 创建。
- Final SHA：以包含本报告的交付 commit 为准，在最终交付消息中给出完整 SHA 和 remote 核验，避免提交内自引用。
- 仅处理 C2A1 definition-compatible 的 26 个 `SUPPLY_IPO_FINANCING` 月份；本 slice 分母固定 26，原 CSRC 总分母仍为 260。其余 234 月不重判，原 C1/C1.1 ledger 不变。
- 停止点为普通 commit + push，核验 HEAD=remote SHA、ahead/behind=0/0、干净工作树。不创建 PR、不 merge、不开始 refinancing。

事实源：[Scope Freeze](observation-catalog-r2-scope-freeze-v1.md)、[R2-A](historical-dataset-r2a-core-v1.md)、[C1](csrc-attachment-inventory-schema-probe-r2c1-v1.md)、[C1.1](csrc-historical-archive-gap-recovery-r2c1-1-v1.md)、[C2A1](csrc-ipo-definition-vintage-admission-r2c2a1-v1.md)、原 definition/mapping config、C1/C1.1/C2A1 evidence，以及当前 R2-A schema、validator、structured locator、release/binding/extraction/lineage tests。旧 R2-A 文档描述其实现时点；本次读取当前已支持 structured locator 的代码，不回写旧报告。

## 独立 artifact 与准入边界

- [逐月来源审阅 V1](../../research-data/market-regime/source-catalog/csrc-c2a2/ipo-provenance-review.v1.json)：逐月引用实际 request/response、完整 findings hash、原 C2A1 row 与 IPO 注释；分别记录 historical version、binding、first/revision/backcast、availability、lineage 的未证明结论。
- [逐月 admission evidence V1](../../research-data/market-regime/source-catalog/csrc-c2a2/ipo-provenance-admission.v1.json)：完整 request plan、130 条 acquisition 和响应检查、26 个独立 decision、冻结输入 hash、严格空 eligible/formal 集合。
- `scripts/market_regime/csrc_ipo_provenance.py`：显式 bounded fetch 与离线 build/full validate/compact validate；复用 CSRC Collector、官方查询 discovery 校验、现有格式探测及 C2A1 full extraction replay。
- `scripts/tests/test_market_regime_csrc_ipo_provenance.py`：真实 sidecar 的拒绝准入测试及清楚标为 synthetic 的既有 R2-A graph 正反例。

本 artifact **不是 R2-A historical dataset**。本次没有找到可以审阅通过的历史 release-to-bytes 证据，因此没有构造虚假的 releaseEvent/RawSourceArtifact/fieldExtraction，也没有 numeric vintage writer；`r2a.releaseEvents/artifactBindings/fieldExtractions` 明确为空，状态 `NOT_CONSTRUCTED_NO_PROVEN_HISTORICAL_RELEASE`。不能把 evidence-only 的 C2A1 XLS witness 冒充已准入的 R2-A extraction。

V1 的拒绝决策只适用于这次固定、逐月审阅的来源快照。review 是本次调查者的判断记录，**不是官方证明，也不冒称独立审计通过**。其完整 hash 固定在代码；任何新增文档、bytes、获取 provenance 或 review 变化都不能静默沿用 V1。未来如果确有新的官方历史版本证据，应建立新版本、审阅其真实语义，再交给原 R2-A schema/validator 完整验证；本模块没有接受调用者 first/revision/backcast flag 的正向旁路。

## 实际调查与证据限度

所有请求 URL 均来自冻结 C2A1 landing/attachment 或 C1 官方 JSON 中真实的 `filePath` / resource `url`，没有猜测 content ID、附件名或 `_2.0`。官方 title search 复用 C1.1 已保存页面和 `render.js` 所证明的只读 `getSearch` 参数；发送前和 full replay 时均验证该发现路径。

| 检查路径 | 实际结果 | 能证明什么 |
| --- | --- | --- |
| 26 个 current landing | 均取得完整 HTML；正文仅提供该月报告与附件入口，未找到具体 historical attachment version/update event 绑定 | 当前页面内容，不证明旧日期时的附件版本 |
| 26 个原附件 URL | 26 个 XLS full-byte SHA-256 均与冻结 C1 完全相同 | 本次 acquisition 与旧 C1 snapshot 的 bytes 一致 |
| 26 个 CMS `filePath` 别名 | 26 个 XLS 均与对应原附件/C1 bytes 相同 | 当前不同 URL 指向相同 bytes，不证明 first release |
| 26 个 CMS `/repo/fs/version/..._1.0.xls` | 全部经 302/301 重定向至当前 CSRC 首页，最终为 HTML；保留完整 redirect 和最终响应，格式检查 REJECTED | 没有取回该历史版本；不能将 HTTP 200 或 `_1.0` 当成历史版本证明 |
| 26 个精确月份标题查询 | 每个 query total=1，均为已有 landing，无本 query 内独立修订入口 | 仅这 26 个标题查询完整；不证明全部历史修订已穷尽 |
| 冻结的每月 IPO 注释 | 每个月单独读取并引用其原始坐标、文本和 mapping hash | 不重新解释 C2A1 definition，不从注释猜 releaseAvailableAt |

26 个目标原 URL 本次未发现相对 C1 的 changed bytes；这不是“历史从未改动”的证明。代码对同一请求 URL 的多个不同 bytes 全部保留，并输出 `UNRESOLVED_RELEASE_CONFLICT`，不会按取得先后或当前值裁决。homepage HTML 作为被拒绝内容保留，transport `SUCCESS` 仅表示成功取得 HTTP 响应，绝不计作成功附件或历史覆盖。

本次物理请求 182（包含 52 次重定向），acquisition attempts 130；最终响应 79 个不同 SHA-256、按最终 hash 去重 2,168,655 bytes。首次 acquisition `2026-09-09T01:03:44.689780Z`，末次 `2026-09-09T01:06:53.998909Z`。这些真实时点不回填到 2010–2012，也没有把 HTTP Last-Modified、CMS 元数据、URL 年份或页面生成时间当作 release clock。

有限 web search 仅作为调查线索；未把搜索引擎日期、摘要或第三方内容纳入准入证据。官方精确标题查询可能漏掉更名、删除、未索引的更新，当前目录也不是不可变历史档案。因此结论是“本次已检查路径未找到足够证据”，不是“官方从未发布/从未修订”，revision enumeration 仍不完整。

## 26 月逐项 admission

下表的日期均是**冻结 C2A1 page/index date，仅供定位，不是 numeric releaseAvailableAt**。每行都具备独立 request IDs、source bytes hash、source findings hash、原 definition/extraction 引用；没有跨月外推。所有行：historical attachment version/binding 未证明，FIRST_RELEASE/REVISION/BACKCAST 均无法定性，`releaseKind=UNRESOLVED`、`releaseAvailableAt=null`、前后 lineage 未证明、formal observations=0。

注释判定 A：原注释涉及 2009 年 IPO 超额配售调整，没有证明该目标月附件的历史 release/binding。B：原注释说按 2010 年年报调整部分月份、粗体标示调整项，但没有给出当前附件的实际 revision 可见时间、前版 bytes 或该数值的完整修订链。C：归月说明已由 C2A1 冻结，未提供历史版本/release/lineage 证据；没有修订说明也不能证明从未修订。

| reportPeriod | page/index date | 当次附件 vs C1 | 注释判定 | admission | formal observations |
| --- | --- | --- | --- | --- | ---: |
| 2010-06 | 2010-07-29 | bytes 相同，仅当前一致性 | A | PIT_VINTAGE_UNPROVEN | 0 |
| 2010-07 | 2010-08-20 | bytes 相同，仅当前一致性 | A | PIT_VINTAGE_UNPROVEN | 0 |
| 2010-08 | 2010-09-27 | bytes 相同，仅当前一致性 | A | PIT_VINTAGE_UNPROVEN | 0 |
| 2010-09 | 2010-10-28 | bytes 相同，仅当前一致性 | A | PIT_VINTAGE_UNPROVEN | 0 |
| 2010-10 | 2010-12-06 | bytes 相同，仅当前一致性 | A | PIT_VINTAGE_UNPROVEN | 0 |
| 2010-11 | 2010-12-30 | bytes 相同，仅当前一致性 | A | PIT_VINTAGE_UNPROVEN | 0 |
| 2010-12 | 2011-01-26 | bytes 相同，仅当前一致性 | B | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-01 | 2011-03-02 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-03 | 2011-04-29 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-04 | 2011-06-02 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-05 | 2011-07-06 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-06 | 2011-08-02 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-07 | 2011-08-29 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-08 | 2011-09-21 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-09 | 2011-12-08 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-10 | 2011-12-08 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2011-12 | 2012-01-16 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-01 | 2012-03-16 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-02 | 2012-03-16 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-03 | 2012-04-23 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-04 | 2012-05-22 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-05 | 2012-06-20 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-06 | 2012-07-25 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-07 | 2012-08-24 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-08 | 2012-09-14 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |
| 2012-09 | 2012-10-17 | bytes 相同，仅当前一致性 | C | PIT_VINTAGE_UNPROVEN | 0 |

共同 blockers 为 `HISTORICAL_ATTACHMENT_VERSION_UNPROVEN`、`RELEASE_ARTIFACT_BINDING_UNPROVEN`、`RELEASE_KIND_UNPROVEN`、`RELEASE_AVAILABLE_AT_UNPROVEN`、`R2_A_LINEAGE_UNPROVEN`。每月 first/revision/backcast 的独立未证明判定见 review。实际 PIT 成功月份：**无**；正式 observations 总数：**0**；`eligiblePeriods=[]`。原 247/260 indexed、13 gap、87 field-ready、26 definition-compatible 的冻结结论未变。

## 重放、hash 与 durability

```sh
npm run test:market-regime:csrc-c2a2
npm run data:validate:market-regime:csrc-c2a2:compact
# 要求保留原 C1/C1.1 和本次 C2A2 完整 ignored raw/journals，离线执行：
npm run data:build:market-regime:csrc-c2a2
npm run data:validate:market-regime:csrc-c2a2
```

full build/validate 先完整重放原 C1/C1.1，并重放 C2A1 的 87 个 frozen witnesses（这只是核验冻结输入，26 之外不做本轮准入调查），逐对象精确比较旧 evidence；再核验 C2A2 所有 acquisition、失败/拒绝内容和重定向的完整 bytes/hash/size，重新解析现存响应并核对独立 review snapshot。未修改旧 hash、ledger、definition、mapping 或原证据。

compact validation 不读取 ignored raw，只验证提交的冻结内容、review pin、26 月集合和确定性派生结果。专项测试把所需 committed inputs 导出到无 raw 的临时目录，确认 compact 可通过而 full replay 拒绝。**这代表 clean-clone compact consistency，不独立证明原始响应真实性、历史首次发布或 immutable archive。** 保有原 raw 的 full replay 可以重算 bytes/extraction，但仍不能证明未取得的 historical release-to-bytes 事实。重新下载是新的 acquisition，不保证恢复相同 bytes，不能恢复本次快照的证明链。

raw 保留在 ignored `research-data/market-regime/raw/csrc-r2c1/`、`csrc-r2c1-1/`、`csrc-r2c2a2/`；前两者从保有原 acquisition 的本地既有 worktree 独立复制，并已 full replay 核验，未修改来源 worktree。raw 没有进 Git、`src`、`public` 或 Local Core。没有把 ignored 本地存档描述为已完成 durable archive。

hash 覆盖完整冻结输入引用、request plan、acquisition 时间/URL/全部 bytes metadata、查询与页面检查、原注释引用、每月 decision 和 R2 sidecar 内容；仅 `generatedAt` 和 self hash 排除。既有 R2-A 的真实 synthetic release/binding/extraction/retrieval 任一改变也会改变原 dataset business hash，专项测试分别验证。固定输入/时间重建确定，sealed 输出只接受相同结果；新网络获取不能追加到已 sealed 的 V1。

| 内容 | SHA-256 |
| --- | --- |
| 原 C1，未变 | `28453963bf0a453d69a0277d9eabdc4cd3b393e4f663d3cb8922478b06a18d80` |
| 原 C1.1，未变 | `9e76a9c0bb82fdf00571337c4c6daefc29bf8698c0a80db517d189eb048689ae` |
| 原 C2A1，未变 | `67b1dd4881850ae3e2a3846dafa0cda6d4ff6df3e763e8d7aaaa755d025f66ff` |
| 新 review | `dc2a310249cb733e530fd9bab7df3a4b211843a79fa8a9f8315801afa0e0fafc` |
| 新 investigation | `cf516f00db298de6ab087dc6906dcbc14237ce4566a82e3af15290e10d159838` |
| 新 admission business content | `eed2126f442104403911cb9b9af855c4b5fb567b1f4c3e732174be4e6996868b` |

## 验证结果

| 检查 | 结果 |
| --- | --- |
| C2A2 专项 | PASS，31 tests |
| 全部 CSRC（C1/C1.1/C2A1/C2A2） | PASS，183 tests |
| historical | PASS，66 tests |
| PBC | PASS，69 tests |
| catalog | PASS，48 tests；validate-artifacts 0 errors |
| C2A2 full build / full validate | PASS，旧 C1/C1.1/C2A1 精确重放、新响应及 redirect bytes 重放；0 admitted |
| C2A2 compact / 无 raw 的 committed-input export | PASS；full replay 因缺少 ignored inventory-source.json 明确拒绝 |
| `npm test` | **FAIL**，2 nested-worktree suites 无 test suite；101 suites / 1661 tests PASS，exit 1 |
| `npm test -- --exclude 'data-cache/**'` | PASS，主仓 39 suites / 597 tests，exit 0；不替代上一行 |
| `npm run build` | PASS，TypeScript / Local Core typecheck / Vite / browser boundary 和 bundle gate；既有大 chunk warning |
| `npm run data:audit` | PASS，0 errors / 24 warnings / 10 skipped / 31 allowlisted |
| `env:check`、`env:check:json` | 两者 exit 0；48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `git diff --check` | PASS，提交前再次检查 staged 范围 |

专项覆盖：当前 bytes+旧日期、CMS/version-like URL、HTTP/acquisition 伪 clock、同 URL changed bytes/获取顺序、逐月独立引用、26 月分母缺格/重复、注入 first/revision/backcast flag、篡改 review/response/输出后重算 hash、正式 observation 与明确 eligible 一一对应，以及既有 R2-A synthetic 官方 revision cutoff、实际 backcast 可见时间、missing/broken lineage、缺 binding、伪 first/revision evidence、额外 schema flag、业务 hash 敏感性。Synthetic 成功例仅证明现有 R2-A 合同的行为，不计入真实 CSRC 覆盖。

标准 `npm test` 的两项失败位于开工前已存在的 `data-cache/worktrees/stage-4-1-r2/` 和 `data-cache/worktrees/v2-phase1/` 的 `company-guidance-expectations.test.mjs`，错误均为 `No test suite found`。本次没有改变这两个目录、测试发现规则或 default npm test，也不把附加 exclude PASS 写成标准命令 PASS。

env 的 warning 为当前多 runtime、既有 Python 依赖/pip check、提交前 dirty tree、ignore 与旧数据/公告 partial 等检查；未为消除 warning 改治理、依赖或业务数据。build 仍有既有大 chunk warning。data audit 只产生时间、扫描计数和行号变化，确认后恢复该非目标生成文档；完整日志保留在 ignored `data-cache/c2a2-*.log`。

本次未修改共享 R1/R2-A/PBC schema/validator、冻结 C1/C1.1/C2A1 artifacts、`src/**`、`public/**`、`local-core/**`、`contracts/v1/**`、default refresh 或 CI 配置；原全部 CSRC test glob 自动包含新增专项。没有 refinancing、YTD→MONTH、Supply Composite、normalization/backtest、UI、其他数据源实施或远端生产操作。
