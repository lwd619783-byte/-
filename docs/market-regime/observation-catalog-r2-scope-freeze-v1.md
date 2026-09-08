# Stage 4.1 — Historical Observation Catalog R2 / PIT Dataset Expansion

> SCOPE FREEZE V1 / IMPLEMENTATION BRIEF
> 日期：2026-09-08
> 实际代码基线：`origin/main @ 1d22ab47800c30d0dfb737f0aac82449e9f00233`
> 交付状态：R2 SCOPE FREEZE IMPLEMENTED / PENDING INDEPENDENT REVIEW
> 本文冻结下一轮实施范围，不表示 R2 数据集已经实现、完整覆盖或获准回测。

## 1. 任务身份、事实源与基线

本任务是 Stage 4.1 的 docs-first scope freeze，不是 Phase 1C，也不是 Codex Experimental Context Management 实验。未启用实验模式、未修改 Codex 全局配置；未使用实验临时评审副本或旧 R2 worktree 的业务实现作为输入，未处理仓库外 Temp 副本。

修改前执行了 `git fetch origin --prune`、`git status --short --branch`、`git worktree list`、`git rev-parse origin/main`、`git log -1 --oneline origin/main`、`git branch -vv`，另查完整 refs 与当前 HEAD reflog：

- origin URL 为 `https://github.com/lwd619783-byte/-.git`，fetch 成功，origin/main 精确匹配上述 SHA；tip 为 `Merge pull request #25 from lwd619783-byte/docs/v2-post-phase-1b-rebaseline-v1`。
- 开工工作树干净，原分支为 `docs/v2-post-phase-1b-rebaseline-v1 @ a3a522e9d90e41b69b7608a63d5763095c371e1d`；local main 为 `87d33595a49dc99463333ad4637b44b7e33f68a9`、落后 10 commits。二者均未作为新任务基线。
- 从精确 origin/main 创建普通分支 `docs/stage-4-1-r2-pit-dataset-scope-freeze-v1`。现有另外两个 worktree 分别指向历史 `feat/stage-4-1-r2-historical-vintage-dataset @ 9a2c636`、`feat/v2-phase1-contract-db-entity-foundation @ 8594c54`，不切换、不复用、不改动其业务内容。
- 注册 worktree 未见 sample / detached 实验副本。完整 refs 中的 `refs/codex/turn-diffs/captures/.../base` 指向 tree `b393ab9e0fa6bb88f0c05b7a6ec1e2d98a1821f8`，与开工 HEAD tree 完全相同，不是业务 commit。未发现可归因于实验的新业务 branch/ref/commit；这一结论限于正式仓库 refs、worktree 登记与所查 reflog，不宣称已扫描或清除外部 Temp。
- 仓库无 `.codex` override 目录，定向检查未发现 `context_management` / `experimental_mode` 配置项。当前可见接口未提供读取或修改宿主 per-thread override 的能力，故不宣称已验证不可见宿主内部开关；本任务没有发起任何实验 override 或嵌套 Codex 命令。

已完整交叉阅读 `AGENTS.md`、`README.md`、[CURRENT roadmap](../investment-dashboard-v2-post-phase-1b-roadmap-rebaseline.md)、[Feature Registry](../feature-registry.md)、[开发执行索引](../development-execution-plan-2026-09-07.md)，以及 [Metric Registry](metric-registry-v1.md)、[formula / normalization](formula-normalization-v1.md)、[backtest dataset design](backtest-dataset-design-v1.md)、[R1](observation-catalog-r1.md)、[source audit](source-audit-v1.md)、[P0 probe](p0-source-probe-v1.md)。旧文件中的历史 SHA、source-ready 或较早 TBD 不覆盖后续明确冻结的公式身份与 CURRENT 实现状态。

实际检查范围包括全部 tracked `config/market-regime/**`、`scripts/market_regime/**`、`scripts/tests/test_market_regime*.py`、对应 HTML fixtures、`research-data/market-regime/**` 的 seed/sample/evidence、package scripts、ignore 与 artifact 换行规则。只读分析的实现证据如下：

| 位置 | 正式基线已实现 | R2 还必须补齐 |
| --- | --- | --- |
| `models.py` / `observation-catalog.schema.json` | V1 definition/artifact/vintage、scope、clock/manifest 类型；schemaVersion=1.0.0 | 历史枚举计划、逐期覆盖状态、多 artifact release 证据、分字段 lineage 的版本化合同 |
| `collectors.py` / `probe.py` | 对 plan 中少量页面进行下载与 M2/AFRE 正文解析；CSRC 取首个候选附件 | 完整索引分页、重复/冲突判定、所有目标附件消歧、格式与字段语义验证；不能把首个链接当作正确附件合同 |
| `catalog.py` / `hashing.py` / `validator.py` | 排序、canonical SHA-256、引用/时间/revision 检查、可选本地 bytes 校验 | 完整覆盖分母、first-release 证明、失败/缺失 sidecar、共享 bytes 不同 release event 的身份处理 |
| `time_semantics.py` | Monday 08:00、DATE_ONLY_SAFE、strict eligibility helper | 完整周度回放不属于 R2；helper 本身不验证 artifact role、字段完整度或全部源准入条件 |
| `market_adapters.py` | Protocol、market scope 与 BSE pre-launch null helper | 三个真实历史 adapter；现有 exchange observation 没有 rawArtifactId/revision lineage，不能直接作为历史准入凭据 |
| `providers.py` | CSI300 slot 调用即 fail closed，validator 同样强制 NO_GO | 本轮及下一轮无 PE Provider 实施权限 |
| tracked sample | 12 definitions、5 个受控 HTML 摘录 artifact、8 个 M2/AFRE 数值 observation、1 个 BSE structural marker | 不是完整 raw archive；不能把 fixture 测试通过算作历史 coverage PASS |

R1 live evidence 是 2026-09-02 的小型摘要，M2 3 个时代样本、AFRE 1 个 backcast 样本、CSRC 4 个附件样本。其可下载结论与 hash 只对应该次证据，不等于当前抓取成功，更不等于 IPO/再融资字段已解析。

## 2. 固定数据窗口与身份

本轮将模糊的 present 固定为首批实施计划，后续扩期必须产生新 plan / dataset version，不能让同一命令随系统日期改变输出：

```text
datasetAsOf = 2026-09-07T08:00:00+08:00
timezone = Asia/Shanghai
weekly decision clock = Monday 08:00（节假日不移动）
monthly target end = 2026-08
daily target window end = 2026-09-04
```

`datasetAsOf` 限制准入 release；抓取时间可以更晚，必须真实记录。窗口末端不是已发布保证，也不是自行认定交易日：日频分母来自版本化官方交易日历；月频 2026-08 若在 as-of 后才发布，只记 `NOT_YET_RELEASED`，不能回填。没有可靠发布证据时记 unresolved，不能凭通常发布日假定已发布或未发布。下一批允许另行显式延长窗口，须复核新的 source/definition break。

| Registry 业务 identity | R1 实际存储 identity / 字段 | 本轮冻结的 raw 范围 |
| --- | --- | --- |
| `MACRO_M2` | `MACRO_M2_YOY`、`MACRO_M2_BALANCE` | 主输入为官方当期发布 M2 同比（%），余额为审计配套，不计算 acceleration |
| `MACRO_SOCIAL_FINANCING` | `MACRO_AFRE_STOCK_YOY`、`MACRO_AFRE_STOCK_BALANCE`；slot 使用 `MACRO_AFRE_STOCK` | 主输入为官方可比社融存量同比；不是新建 MACRO_AFRE 指标，不以 flow 替代 |
| `SUPPLY_IPO_FINANCING`、`SUPPLY_REFINANCING` | 已有 `CSRC_MONTHLY_REPORT_ARTIFACT` 仅表示附件 | 目标为境内 A 股相关、实际筹资的当月 IPO / 权益再融资金额，字段可映射才输出上述 Registry ID |
| `SENT_A_SHARE_TURNOVER` 及既有公式所需市值基础项 | `EXCHANGE_MARKET_STATS`：`turnoverValue`、`totalMarketCap`、`negotiableMarketCap` | per-exchange A 股交易日成交金额、收盘总市值、流通市值；为 turnover、融资杠杆、Buffett numerator、供给分母提供基础字段 |
| `VAL_MARKET_PE_PERCENTILE` | slot `VAL_CSI300_TTM_PE` | 仅记录官方 CSI300 TTM PE 的 NO_GO 与新证据，不采集新 Provider |

以上是业务 identity 到现有 raw identity 的显式映射，不重命名 R1 字段，不新增并行评分指标。交易额不是换手率；流通市值不自动等于指数自由流通调整市值；GDP、融资余额、减持、回购、ETF、北向和其他依赖不在本批数据抓取范围。

## 3. R2-A 必须先实现的 dataset 合同

以下是未来实施要求，不是已经存在的字段/能力。保留 V1 schema、sample、含义与 tests 原样可验证；在 `config/market-regime/historical-dataset.schema.json` 新增独立、显式版本的 dataset envelope，以 `catalogContentSha256` 绑定现有 V1 catalog。不要把 unknown 字段塞进 V1 顶层；不兼容变更须新 schema/version 与审计，不修改 Phase 1B `contracts/v1/**`。

新增 envelope 最低结构冻结如下；每个集合稳定 ID 唯一、引用完整、未知枚举拒绝、数值有限、日期带语义、路径为安全相对路径：

| 对象 | 必需内容与检查 |
| --- | --- |
| dataset manifest | schemaVersion、datasetVersion、planId、datasetAsOf、targetWindows、catalogContentSha256、各 sidecar 内容 hash、datasetContentSha256、generatedAt、validationStatus；失败不发布 admitted dataset |
| source plan | sourceId、official source roots、目标 period/date、metric/field、native frequency era、definition mapping、calendar evidence、分页范围/停止条件、请求上限与超时、首次发布判定规则；只能枚举官方链接，不按猜测 URL 声称覆盖 |
| releaseEvents | releaseEventId、sourceId、publicationDateTime/null、publicationDate/null、releaseAvailableAt、confidence、landingArtifactId、attachmentArtifactIds、发布时点 evidence locator、release kind、coveredPeriods、firstReleaseEvidenceArtifactIds；附件与 landing 关系必须可重放 |
| fieldExtractions | extractionId、observationId 或 exchangeObservationId+field、releaseEventId、rawArtifactId、sourceDefinitionId、parserVersion、原文字段/单位/数值、sheet/table/row/column 或正文 locator、period semantics、单位转换规则、basis/comparability evidence、lineage predecessor IDs；每个准入数值必须有对应 extraction |
| coverage ledger | sourceId、metric/field、period/date、scopeVersion、状态、reasonCode、evidenceArtifactIds、candidate release IDs、admitted observation IDs；目标网格每格一条，失败不能从分母消失 |
| retrieval attempts / conflicts | request URL、attemptedAt、HTTP 状态或 transport error、已存 bytes 的 hash/size（若有）、原因、候选 ID、处理依据；网络失败不生成伪成功 RawSourceArtifact |

`release kind` 明确区分 `FIRST_RELEASE`、`REVISION`、`BACKCAST`、`UNRESOLVED`。它与 R1 的 `releaseConfidenceClass`、`qualityStatus` 不同：官方初步数可以是可信 first release，同时 `qualityStatus=PROVISIONAL`；采集器遇到的第一条不自动是 first release。无法证明首次发布身份时，不得计入 first-release coverage。

R1 的 artifact ID 当前由 source+bytes hash 构成。R2 必须能表达同 bytes 由不同官方 release event 重新发布：内容按完整 SHA-256 去重，artifact 身份同时绑定 source、URL 和已证明 release event。稳定 ID 不依赖抓取顺序，不覆盖旧记录；不能靠改 observation 时间继续引用旧 event artifact。同一份文档既含当期数又含回溯表时，须按已证明的 event/section 建立一致的 artifact 引用视图，保留相同 bytes hash，禁止把所有当期数都因正文出现“历史数据”一词标成 backcast。

### 3.1 PIT、revision、缺失与不可变性

1. strict 的必要条件始终为 `observation.releaseAvailableAt <= weeklyCutoff`；还必须通过 source/definition/完整度/原始 artifact 准入，不能只调用时间 helper 就放行。
2. exact release 使用官方实际时间。日期级发布保留 `releaseDateTime=null`、`metadata.publicationDate`，artifact 保留自己的 publicationDate；`releaseAvailableAt=publicationDate+1 day 00:00 Asia/Shanghai`。backcast 只有日期时也执行该保守规则，confidence 仍为 `BACKCAST_RELEASED_LATER`。
3. `fetchedAt` 是采集时间；URL 年份、文件系统 mtime、附件文件名、HTTP Last-Modified、报告统计月均不能替代官方发布证据。日期安全时点尚未到达的下载可以先保存 retrieval evidence，必须满足 R1 时间约束后才能形成 accepted artifact/observation，不伪造 fetchedAt。
4. `SourceDefinitionVersion.effectiveFrom/effectiveTo` 是统计期适用区间；月度 valueDate 为 `YYYY-MM`，按完整自然月比较。definition 的 createdAt 不决定 PIT 可见性。回溯定义可以适用于较早统计期，但只能由较晚真实 release 提供可见性。
5. 同 metric/valueDate 的 vintages 按实际 releaseAvailableAt、已证明的 revisionSequence 排序，supersedesObservationId 指向同一序列的前版，链无环且序号递增。先按 cutoff 过滤，再选择有权威替代关系的最新可用版本；保留所有前版。
6. 同时点多份数值冲突、同序号冲突、来源之间不一致且无官方更正关系时，状态 `UNRESOLVED_RELEASE_CONFLICT`，不按 URL 字母序、抓取先后、较新网页或最大数值裁决。稳定 ID 仅解决序列化排序，不解决事实冲突。
7. `revisionSequence=0` 只表示已收集链的起点，不能证明 first release；前序无法追回时，保留当前证据并标 first-release/lineage gap。sealed catalog 不原地重新编号，补获更早 release 需新 dataset version、明确差异及独立审计，不回写旧 catalog。
8. 后发可比历史值标 `BACKCAST_RELEASED_LATER`，最早在该 release 后使用；`SCHEDULE_INFERRED`、`LATEST_REVISED_PROXY`、`STRUCTURALLY_UNAVAILABLE` 均排除于 strict admission。没有后发日期证据的现今历史表是 `LATEST_REVISED_PROXY`/unresolved，不能给每行复制历史月份作为发布时间。
9. R1 数值 observations 不接受 MISSING/REJECTED/STRUCTURALLY_UNAVAILABLE marker，R2 缺口放 coverage ledger。BSE 原有专用 structural marker 保持三个数值和 releaseAvailableAt 为 null。不得放宽旧 validator 来装缺失值。
10. 原始 bytes 只追加保存，SHA-256、byteSize 与实际文件重算一致；复用缓存必须同时核验路径、size、hash，失败记错误/重新获取，不把缓存命中写成新网络成功。官方域名内容也必须校验，200 的登录/错误/反爬 HTML 不是数据。
11. canonical JSON 排序沿用 R1，`generatedAt` 排除于业务内容 hash；相同存档输入与固定 generatedAt 必须字节一致。fetchedAt 是输入 provenance，重新抓取产生新证据版本，不承诺不同抓取运行内容 hash 相同。coverage、release link、定义与解析版本均进入 R2 内容 hash。
12. `TEST_FIXTURE_EXCERPT` 可用于离线测试，不能进入正式历史 coverage；只有保留完整 bytes 且通过同 event 证据链的 `RAW_SOURCE` 可计入准入。仅有网上链接或旧 hash 摘要不能替代独立审计时的 artifact 校验。

缺失状态冻结为 coverage ledger vocabulary，不冒充旧 QualityStatus：

| 状态 / reason | 判定与影响 |
| --- | --- |
| `AVAILABLE` | 目标格存在已准入原始 vintage；另报是否 first-release 已证实 |
| `NOT_YET_RELEASED` | 有证据表明截至 datasetAsOf 尚不可见；与值缺失分开，不提前采入 |
| `STRUCTURALLY_UNAVAILABLE` | 官方证据证明机制/该定义/该发布频率尚不存在；value 不生成，不是 0 |
| `MISSING` / `RELEASE_NOT_LOCATED` | 应覆盖或尚不能解释的历史空格；不因找不到就断言未发布 |
| `SOURCE_UNREACHABLE` | 超时/拒绝连接/HTTP 失败，存在性未知或已知源当前不可达 |
| `SOURCE_ABSENT_CONFIRMED` | 官方明确证明目标来源/归档不存在，须保留证明；单次 404、超时或搜索未命中不满足此判定，也不自动等于统计机制不存在 |
| `AUTOMATION_UNPROVEN` | 页面可见，但可重复下载/分页/使用路径未证明 |
| `FIRST_RELEASE_UNPROVEN` / `PIT_VINTAGE_UNPROVEN` | 当前或历史值存在，首次发布/当时版本未证明 |
| `FIELD_MISSING` / `UNSUPPORTED_FORMAT` / `PARSER_FAILED` | 附件存在但目标字段无法得到；保留 artifact，不生成 observation |
| `DEFINITION_UNRESOLVED` / `UNRESOLVED_RELEASE_CONFLICT` | 口径或事实冲突；strict 排除，保留所有候选证据 |

`missing ≠ 0`；`structurally unavailable ≠ 0`；`not yet released ≠ missing historical value`；`latest revised value ≠ PIT first-release value`；`backcast historical value ≠ historically available observation`。官方明确报告的真实 0 可以保留，空白、破折号、缺行、停发或抓取失败不能转换为 0。

### 3.2 Coverage PASS 的可计算定义

每个 source/metric/definition era 单列 `targetCount`、`availableCount`、`provenFirstReleaseCount`、`backcastCount`、`notYetReleasedCount`、`structuralCount`、`unresolvedCount`，以及逐期缺口表。状态互斥的主计数之和必须等于目标格数；vintage 条数另计，重复 revision 不能提高期间覆盖率。

- inventory completeness PASS：目标 period/date 网格全部登记，分页证据与所有候选发布已核对；仅表示没有静默丢格。
- dataset coverage PASS：在明示非空准入窗口内，全部应有目标格存在 raw/source/definition/PIT 合格数值、first release 得到证明，已发现修订都保留且关系闭合、零 unresolved；结构性格和经证明的未发布格单列。不得靠把未知格移到 structural/not-yet-released 缩小分母。
- 整段月度 target 缺任何应有月度 vintage，最多 PARTIAL；可以审计通过较短且明确标出的连续子窗口，但总目标状态继续 PARTIAL。只有 backcast 的时期单列 C-tier，不声称 original first-release 全覆盖。
- “已发现修订均保留”不等于“所有可能的历史修订已穷尽”。须列扫描范围和官方索引完备性证据；无法证明穷尽的修订记录保持 revision coverage PARTIAL。
- 本轮 `GO` 仅表示有依据进入相应实施切片；不把新 GO 写入 R1 `SourceStatus` 枚举（其中使用 PASS），不把下载成功写成 normalization/backtest admission。

## 4. PBC M2

**实施 GO；当前历史 dataset coverage PARTIAL。** 目标 `2005-01..2026-08`，月频、月末存量与官方当月 YoY；期间目标 260 格，余额与同比各自计覆盖。以 PBC 调查统计司金融统计数据报告 / 历史金融运行发布正文为主，官方统计表作字段与定义交叉证据。不得由最新余额重算历史官方同比。

继承 R1 两个 identity、原单位和 definition 版本：2005-01..2011-09、2011-10..2017-12、2018-01 起；每份报告仍需读注释，开放末端不保证以后永无断点。余额通常为万亿元或亿元，保留原文单位，转换必须明确，不能改既有 definition 的 unit。

2011-10 的统计范围变化及可比同比由 [PBC 2015-01 报告](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2810678/index.html)支持。[PBC 2018-01 报告](https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/2025092212544998106/index.html)给出货币市场基金统计方法调整，并同时列新旧方法增速；R2 必须按明确方法选取，不能“取第一个百分比”。该页还包含后发重述的较早期数，须独立绑定其后发 event，不能改写此前 vintage。

逐月输出：正文 artifact、真实 publication 证据、两个字段 locator、definition notes、是否初步数、reported comparable basis 的原文依据、first/revision/backcast 身份。无原文可比性依据时不得统一写 `reportedComparableBasis=true`。历史原文可以通过官方迁移/分支域名到达，但镜像不独立构成更早发布证据；同一发布去重，冲突 fail closed。

PASS 必须满足 3.2，另需覆盖 2005 初期、2011-09/10、2017-12/2018-01 的跨界 fixture，年报 12 月与月报去重；官方后发更正不能进入更早 cutoff。当前三个跨时代样本 PASS 只能证明 parser 的已有能力，不能预先声称 260 月已齐。

## 5. PBC AFRE / 社融

**PARTIAL。** 本批只收 stock balance 与官方 comparable stock YoY。flow 可以在原始文件中存在，允许作为定义证据保留；不单独构建 flow dataset、不推导 Credit Impulse、不实施 Candidate D。

- 主目标：`2015-01..2026-08` 的逐月 inventory（140 月）；月度 first release 是覆盖目标而非事实断言。R1 定义仍写 `QUARTERLY_TRANSITION`，没有完整证明转为月报的首期。下一切片必须找到官方发布序列/频率说明，在此之前不得把年末/季末存量插值成月度。
- 过渡历史：保留 2015 首次发布事件所明确提供的 2002–2014 原生统计期 backcast，至少保持 R1 `2014-12` 样本；不得将 2002–2014 叙述视为每月每项字段均已证明。源只列年末时就只收年末 observation，其他月不补。
- [2014 年末存量报告](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2810586/index.html)实际发布时间为 `2015-02-10T16:31:12+08:00`。该样本在 2015-02-09 Monday cutoff 不可见，在 2015-02-16 才可见；2014 valueDate 不产生 2014 可见性。更早全段 backcast 是否同 event、每格是否列明值，仍须附件证据。
- 2015 发布前的 V1 stock signal 为结构性不可用；2015 后某月档案找不到通常是 MISSING/first-release gap，只有官方证明当时未发布该频率才可记结构性不可用。缺当时月度版本但后来有回溯值时，前者仍缺，后者单列 backcast。

必须核对的 definition breaks：

| 统计起点 | 需要保留的口径变化 | 如何处理历史可比值 |
| --- | --- | --- |
| 2015 首次 stock 信息集 | R1 2015-backcast 定义，统计期可早于首次 release | 本批无月度完备保证；只承认原始发布实际列出的期间 |
| 2018-07 | 存款类金融机构 ABS、贷款核销纳入 | 区分当期数和后来发布的 2017 起可比历史 |
| 2018-09 | 地方政府专项债券纳入 | 新 definition/event，旧统计期不能复制新发布时间前的值 |
| 2019-09 | 企业债券统计纳入交易所企业 ABS | 核对具体 release 和回溯范围，不仅按年份切表 |
| 2019-12 | 国债、地方政府一般债与专项债合并为政府债券 | 回溯至 2017-01 的表只能按实际后发 event 可见 |

后四项在本轮读取的 [PBC 官方历史存量表注释](https://www.pbc.gov.cn/diaochatongjisi/attachDir/2025/11/2025110511314347909.pdf)中可核对。该附件是当前可访问的后发/迁移历史表，**未证明其 bytes 在 2019 年即以当前版本可见**；这里只作 definition discovery，不导入数值、不从 URL 推断 release。未来逐月报告和每个修订事件必须另行获取真实发布证据。

旧 sample 的 pre-2018 definition 不能用于 2018-07 以后。新口径回溯到更早 valueDate 时，须建立有官方适用范围证据的 backcast definition，不能为了通过 validator 擅改旧 effectiveFrom。后续任何新定义都按相同规则审核。

验收：每月 stock/YoY、频率 era、first-release 状态、revision/backcast 完整记录；同文当前数和历史表分别提取；官方注释称初步数则保留 PROVISIONAL。完整月度 vintage 不足仍 PARTIAL；不得以 flow、年度值、最新 stock 序列或公式推算补齐。

## 6. CSRC 月报 / IPO 与再融资

**PARTIAL；先附件与字段 schema，再历史数值。** 目标 `2005-01..2026-08`，月频，260 期 inventory。来源从 [CSRC 月报索引](https://www.csrc.gov.cn/csrc/c100120/common_list.shtml)及其官方归档入口导航，不根据编号猜附件。

### 6.1 格式 era 与 attachment evidence

| 样本/era | 已有证据 | 后续必须完成 |
| --- | --- | --- |
| 2005-12 / 2010-12 / 2015-12 | tracked R1 evidence：三个 `.xls`，均未准入融资字段 | 对每个版式记录 sheet、合并表头、cell、单位、累计/当月、备注；不能按固定行号跨 era |
| 2016..2024 | 不能由前后样本推断每期格式；P0 要求代表样本 2020-12 | 枚举实际扩展名、MIME、magic bytes、schema；发现所有格式变化与字段断点 |
| 2025-12 / 2026-07 / 2026-08 | 2026-07 为 R1 DOCX 名称/MIME 样本；本轮 2025-12、2026-08 landing 均链接 `.docx` | 定位 XLS→DOCX 实际迁移首期及前后相邻期；未知前不得写一个猜测切换月 |

R1 已记录的附件 byte/hash 锚点（历史证据，下一轮需重新校验实际 bytes）：

| reportPeriod | byteSize | SHA-256 |
| --- | ---: | --- |
| 2005-12 | 34304 | `a884e180f1079223d670fadc50dea4965b96ecd26af0384e5af8552f10471a3a` |
| 2010-12 | 45568 | `d6f039d1a120ef9d8b9656661a65529feba72ee10f10f20cb733b19ed8cd6222` |
| 2015-12 | 101888 | `ca46a1d8f7aa417c499324f01f664ba09fb57e2cdd97ec30983414f9708f7240` |
| 2026-07 | 147456 | `8835a9b984803593ef05126c95a5cd78249f4d4809cb6ba84dcd313d73947a06` |

完整 URL、MIME、publicationDate 见 `research-data/market-regime/source-catalog/p0-live-probe-evidence.v1.json`。本轮读取 [2025-12 landing](https://www.csrc.gov.cn/csrc/c100120/c7607103/content.shtml)与 [2026-08 landing](https://www.csrc.gov.cn/csrc/c100120/c7656955/content.shtml)，后者发布日期 2026-09-01，日期安全可见性为 2026-09-02 00:00。未下载其附件，不能给它们借用 2026-07 的 hash/size。

每个报告建立 `index artifact → landing artifact → attachment artifact → field extraction` 链，两个页面若都承担 release 证明均需保存。记录原始 URL、最终响应来源、href/locator、内容类型与 bytes；publication fallback 只接受留存的官方 index 证据，不接受手填日期当证据。附件发布继承 landing 日期，必须能证明其属于该次 release；同 URL 后来换 bytes 时，只有新的发布/更新证据才能确定修订时点，不能自动沿用旧日期。

XLS/OLE、OOXML ZIP、DOCX、实际 XLSX、HTML 伪装文件须按 MIME+magic+内部结构联合辨识。文件名 `.docx` 不证明是 OOXML，扩展名和内容冲突时保留 bytes、标 unsupported/schema probe failure，不重命名后假装解析成功。宏不执行，外链不求值，公式没有可信 cached value 时 fail closed。OCR、Office UI 自动转换和第三方整理表不属于默认范围。

### 6.2 字段与 definition gate

正式目标仅 `SUPPLY_IPO_FINANCING`、`SUPPLY_REFINANCING` 的**当月实际筹资金额**，保留原始人民币单位及可核验转换。不能使用发行数量、获批额度、计划金额、筹资家数、IPO 企业数替代金额。必须从表注确定 A 股/境内外/板块/现金权益等 scope；汇总含 H/B 股、债券或非现金资产且无法拆解时不输出正式目标值。

每个 era 建 field map：原字段名/层级、sheet/table 坐标、金额单位、MONTH/YTD、包含/排除项、是否存在可转债/配股/公开或定向增发/资产认购、官方注释、definitionId。**只凭“再融资”标题不能断定等于既有公式 Equity_Refinancing。** 可转债等混合项目不能私自纳入或扣除；原始子项作为 extraction evidence 保留，无法由已冻结语义唯一映射的 era 为 `DEFINITION_UNRESOLVED`，先冻结专项 accounting mapping 并审计，再产正式指标。此 blocker 是执行规则，不允许下一轮猜公式。

若只有年初累计，本批只保存 `periodSemantics=YTD` extraction，**不执行相邻月相减来产正式月度指标**。后续如要做 YTD→MONTH，须单独冻结同口径/同可见信息集/修订一致性/跨年规则和依赖 lineage；不能把此转换混在 parser 中。本切片也不计算 `SUPPLY_PRESSURE_COMPOSITE`，没有减持/回购并不等于二者为 0。

IPO / refinancing definition break 按字段与官方注释识别；必须检查 2005、2010、2015、2020、2025 年末、最新 2026-08、每个格式切换相邻期，以及板块/注册制/北交所纳入前后是否发生范围变化。改革日期是待核对线索，不自动等于本统计字段变化日期。若早期定义不兼容，不为了长覆盖与现代字段拼接。

### 6.3 parser 与依赖停止条件

- 缺字段：`FIELD_MISSING`；多个候选表/附件无法唯一映射：`DEFINITION_UNRESOLVED`；不支持格式：`UNSUPPORTED_FORMAT`；解析异常：`PARSER_FAILED`。下载成功的 artifact 保留，失败字段不生成 numeric observation。
- R1 parseStatus 只有 INDEXED/PARSED/FIELD_SCHEMA_PROBE_REQUIRED/FAILED；详细 reason 写 R2 sidecar，不能直接往旧 enum 塞新值。一个字段成功不把整份报告两字段都标 PASS。
- 本轮不新增依赖。后续 OLE XLS 如标准库/既有依赖无法可靠解析，才可提出最小 `xlrd` 固定版本；DOCX 优先已有 ZIP/XML 能力，只有具体合并表格/解析能力缺口被 fixture 证明才增加 DOCX library；XLSX 不因可能出现就预装包。
- 新依赖必须在对应 slice 提交前明确版本、许可、必要性、运行时兼容和离线 fixture、专用 requirements 与安装/CI 可重复路径，独立审查；不升级公共依赖栈，不让测试运行时自动安装。依赖未批准/不可用就维持字段 PARTIAL。

## 7. SSE / SZSE / BSE 市场统计

**各源 PARTIAL；统一 strict 日频 aggregate 当前 NO_GO。** 采用 per-exchange source + 后续独立 aggregation 验收，当前无已证明的三所统一 2005–2026 官方 PIT 日频序列。

| 交易所 | 目标日期窗口 | 官方 source family | 必须证明的 source/definition |
| --- | --- | --- | --- |
| SSE | 2005-01-01..2026-09-04 的官方交易日 | 股票成交概况 daily/history 与官方月年报核对 | A 股字段、主板/科创板、2019-07-22 股票合计范围变化、2020-05-01 换手率定义变化；日频原始值与 release |
| SZSE | 同 SSE | 官方市场总貌及其历史日/月统计入口 | A 股与 B 股、主板/原中小板/创业板避免重算，板块合并和字段定义的实际生效证据；月报存在不能证明日频历史可用 |
| BSE | 2021-11-15..2026-09-04 的官方交易日 | 北交所官方市场统计及归档 | 从开市日起符合全 A scope 的上市股票；与新三板/精选层历史不混接，市场扩容与字段范围版本化 |

三个原生基础字段各自保留：`turnoverValue` 为交易日累计成交金额，`totalMarketCap`/`negotiableMarketCap` 为对应交易日市场统计时点的存量。统一人民币单位需存原单位与转换。缺流通市值不能拿总市值替换；不能把自由流通调整市值直接当流通市值；成交笔数、成交股数、换手率和金额严格区分。

本轮重新读取的 [SSE 历史股票概况](https://www.sse.com.cn/market/stockdata/overview/day/index_his.shtml)说明股票合计包含主板 A、主板 B、科创板，且有回购/换手率说明。因此不能直接取“股票合计”当 A 股；要证明 A 股子项直接相加且不重复。若原始交易方式/回购排除口径不能统一，保留 per-era series，跨断点 aggregate 不准入。字段改名不必然是经济定义变更，反之名称不变也不证明经济定义不变。

市场 scope 继承 R1：

```text
all-a-sse-szse-v1      : 2005-01-01..2021-11-14, required={SSE,SZSE}
all-a-sse-szse-bse-v2  : 2021-11-15 onward, required={SSE,SZSE,BSE}
BSE before 2021-11-15  : STRUCTURALLY_UNAVAILABLE, all values=null
```

源日历必须保留年度交易/休市公告 evidence 与 calendarVersion，星期一即使休市仍 08:00 决策。tradeDate、publicationDate、releaseAvailableAt 各自保留，不能假定收盘即已发布或套用融资余额“次日开盘前披露”的规则到所有市场字段。只有官方 release 日期时采用 DATE_ONLY_SAFE；只有交易日标签无发布证据，PIT 未证明，不能把 tradeDate+1 人工定成 DATE_ONLY_SAFE。历史下载接口返回的重述数据缺原始 vintage 时仍非 strict。

未来 aggregation 的必要条件（R2 可做基础金额合计，不做强度/比例/评分）：

1. required exchanges 必须按该 tradeDate 的 scope 计算；所有该字段的必需分源都已通过相同日期、单位、A 股范围、统计定义、PIT、完整度校验。
2. `aggregate.releaseAvailableAt=max(component.releaseAvailableAt)`；保留全部 component observation/release/artifact IDs、marketScopeVersionId 和 aggregationVersion；每个 component 都必须在 cutoff 前可见。
3. 缺一个当时应在 scope 的交易所，**该字段不生成 all-A numeric aggregate**。允许保留 per-exchange 数值和 PARTIAL report，不允许把 SSE+SZSE 子集在 BSE 缺失时标成全 A。
4. 2021-11-15 前 aggregate 只要求沪深，BSE 是未进入 scope 的结构性 marker，不是值为 0 的 component。
5. 不把各所“最新日期”混在一起。若交易日不一致或某所休市，没有冻结的官方估值/结转政策则该日 aggregate 不可用；不自行带入上一日市值、不把休市成交写成 0。
6. 分字段合计：三所成交额齐而某所流通市值缺失，可报告成交额完整、流通市值缺失；依赖两者的 turnover intensity 仍未就绪，不把整行标为全部字段 PASS。
7. 月/年数据只作独立 native-frequency 证据与交叉核对，不能拆为日频。P0 的 SLOW_MONTHLY_MARKET 是后续独立 challenger，不能替换当前日频 baseline。

## 8. CSI 300 historical TTM PE

**NO_GO，保持 R1 slot 和 validator 不变。** 研究目标仍是 2005 起的官方连续历史 CSI300 TTM PE，但本批不承诺构建该数据集；CSI300 发布/基日及 factsheet 当前 PE 存在，不构成历史 vintage 连续性的证明。

本轮 [CSI 官网](https://www.csindex.com.cn/)返回 JavaScript 应用提示，未获得新的完整历史/PIT 证据。该限制不证明数据不存在。官方 chart、今天下载的修订表、factsheet PE/PB 单点均不足以解除 NO_GO。不得切换第三方 Provider，不以当前成分股重建历史，不采购/接入新 feed。新官方证据最多登记 continuity、automation/use path、TTM methodology、release/revision 与原始 artifact 是否满足；解除 NO_GO 需要新的明确范围及独立 source admission，不属于这些 slices。

## 9. R2 Dataset Admission Matrix

以下两表以 source key 一一对应，合起来是完整矩阵。`拟议 R2` 表示本 brief 允许推进的目标，不是已完成状态。

| key / metric | institution / official source family | target coverage / native frequency | definition versions | first-release / revision availability | artifact format |
| --- | --- | --- | --- | --- | --- |
| M2 / MACRO_M2_YOY + BALANCE | PBC / 金融统计发布与货币供应量表 | 2005-01..2026-08 / MONTHLY | pre-2011、2011-10、2018-01；新断点逐份审核 | R1 三期 first-release 样本；全索引/修订未齐 | HTML 为主，官方表附件仅按已核验格式 |
| AFRE / MACRO_AFRE_STOCK_YOY + BALANCE | PBC / 社融存量报告与表 | 2015-01..2026-08；2002–2014 已证明原生 backcast / 月频目标，早期发布频率过渡 | 2015、2018-07/09、2019-09/12，回溯适用区间另列 | R1 2014-12 后发事件；完整月度 first release/全修订未齐 | HTML、官方 XLS/PDF 等；表型分别准入 |
| CSRC / SUPPLY_IPO_FINANCING + SUPPLY_REFINANCING | CSRC / 月报 current+archive、landing+attachments | 2005-01..2026-08 / MONTHLY；YTD 单列 | field map / statistical scope / format era 均待逐版证明 | page 发布日期已有样本，字段 first-release 与修订仍未证明 | 老 XLS、新 DOCX 名称；实际格式须 magic 验证 |
| SSE / EXCHANGE_MARKET_STATS | SSE / 日历史与月年核对 | 2005..2026-09-04 trading days | A 股子项、2019-07-22、2020-05-01 等 | 历史入口存在；逐日 release/vintage 未证明 | HTML/官方响应及附件，schema probe |
| SZSE / EXCHANGE_MARKET_STATS | SZSE / 市场总貌、日/月历史 | 同 SSE / TRADING_DAY target | A/B 与板块变迁待版本化 | R1 月频 source 证据；日频 vintage 未证明 | 官方页面/统计附件；日频 payload 未冻结 |
| BSE / EXCHANGE_MARKET_STATS | BSE / 官方市场统计 | 2021-11-15..2026-09-04 / TRADING_DAY target | post-launch；pre-launch structural | 当前字段 source 证据；历史 release/vintage 未证明 | 官方页面/响应，待历史 schema probe |
| ALL_A / SENT_A_SHARE_TURNOVER 及市值基础字段 | 三所官方分源 / 后续聚合 | 按两个 market scopes / 同日 | all-a-sse-szse-v1 / all-a-sse-szse-bse-v2 | 取所有必需 component 最晚 release，现未有完备组合 | derived aggregate+全 component lineage |
| PE / VAL_CSI300_TTM_PE | CSI / index valuation、factsheet | 2005 起研究目标 / 日周历史未获准 | CSI300 TTM methodology 尚需历史合同 | snapshot 不等于连续 PIT；未证明 | factsheet、网站导航，非 admitted history |

| key | parser status / current R1 status | proposed R2 status | blocking issue | acceptance test | 本轮 GO / PARTIAL / NO_GO |
| --- | --- | --- | --- | --- | --- |
| M2 | 正文 parser、3 样本 / PASS source probe | 建月度 first-release/vintage，满足 3.2 才 dataset PASS | 全月枚举、冲突、first-release 与 definition 证据 | M2-1..3、CORE-1..6 | GO 实施；coverage PARTIAL |
| AFRE | stock parser、backcast 样本 / PARTIAL | 分 frequency/definition era 的 vintage dataset | 首次月度发布首期、早期缺月、后发回溯/修订 | AFRE-1..3、CORE | PARTIAL |
| CSRC | 仅 landing/attachment index / PARTIAL | 先索引+schema，再可映射字段的正式月度子窗口 | 实际文件格式、MONTH/YTD、equity refinancing scope | CSRC-1..4、CORE | PARTIAL |
| SSE | adapter Protocol / PARTIAL（历史 probe 的组件 source PASS 不等于已实现） | 独立日频 adapter 与明确准入窗口 | A/B 混合、定义断点、historical PIT | MARKET-1..4、CORE | PARTIAL |
| SZSE | adapter Protocol / PARTIAL | 独立日频 adapter；无法证明则只留分源 evidence | 日频连续性、scope/PIT、本轮访问超时 | MARKET-1..4、CORE | PARTIAL |
| BSE | adapter Protocol+structural helper / PARTIAL | post-launch 独立 adapter | 历史连续性/scope/PIT、本轮访问超时 | MARKET-1..4、CORE | PARTIAL |
| ALL_A | 无实际 aggregator / PARTIAL source family | 所有必需分源通过后才合计基础金额 | 缺任何必需 component 则 aggregate 阻断 | MARKET-3..5 | NO_GO 当前统一日频准入 |
| PE | collect() 拒绝 / NO_GO | 保持 NO_GO，仅评估新官方证据 | 连续、可自动化、历史 PIT 和方法证据不足 | PE-1 | NO_GO |

## 10. 正式 implementation slices 与停止点

按实际耦合拆分：共享 catalog/validator 只在基础切片建立；PBC 两个正文 parser 共用发布机制；CSRC 下载与金融字段语义不能一次混做；交易所 adapter 与全市场 completeness 必须分别验收。每次只实施一个 slice，普通 push 后独立审计，不因上一 slice PASS 自动开工下一 slice。

所有切片的共同禁止目录/操作：`src/**`、`public/**`、`local-core/**`、`contracts/v1/**`、Phase 1B、migration、Auth/cloud/Supabase/Vercel 行为、全局 Codex 配置；禁止修改 formula/normalization/backtest 设计与运行时、production weights、默认 data:refresh、UI、真实账户数据。下表未列入允许范围的文件一律不顺手修改。文档只可更新目标 slice 的 `docs/market-regime/` 验收说明；历史 R1 基线文件不重写。

| slice | 输入 / 依赖 | 允许修改 | 输出 artifact | tests / admission condition |
| --- | --- | --- | --- | --- |
| R2-A：历史 dataset 合同与验证核心 | 本文、正式 R1 / 无前置数据采集 | `config/market-regime/` 新 envelope schema/plan；`scripts/market_regime/` 兼容核心或独立历史模块；专项 tests/fixtures；必要的显式离线 package scripts | 版本化合同、release/coverage/lineage sidecar、合成成功/失败 sample、deterministic manifest；不抓全历史 | CORE 全部；V1 48 tests 与旧 sample hash 不变；R2 schema 与 Python 同步，独立合同审计通过才给 B/C/D 使用 |
| R2-B：PBC release/vintage 历史目录 | 已审计 A、PBC 官方索引/原文/表、已冻结目标 plan | PBC collectors/历史 builder、PBC 配置/definition mapping、专项 fixtures/tests、紧凑 research-data sample/evidence；只追加显式 fetch/build/validate scripts | M2/AFRE 分源 inventory、完整原始下载（ignored）、vintages、coverage 与冲突报告 | M2、AFRE、CORE；按源/era 单独给 PASS/PARTIAL；不因 AFRE 缺口拖成虚假 M2 coverage，也不因 M2 PASS 提升 AFRE |
| R2-C1：CSRC 全期附件目录与字段 schema probe | A；无需依赖 B | CSRC index/downloader/schema probe、格式配置、CSRC fixtures/tests、小型证据；有具体 XLS 缺口时才按 6.3 新专用 requirements/最小测试安装配置 | 260 期 inventory、landing/attachment 链、bytes/MIME/magic、跨 era field map、无法映射清单 | CSRC-1..3；代表时期/迁移相邻期可重放；明确哪些字段具备 MONTH+scope 证据；无正式融资数值批量发布 |
| R2-C2：CSRC 月度融资字段 vintage | A + C1 独立审计通过的 field maps；无法唯一映射的 era 先专项 accounting freeze | 已审计 CSRC parser/mappings、专项 tests/fixtures、紧凑 sample；不改共享 R1 schema，不顺便加 YTD 转换 | 仅已证明 definition/window 的 IPO、再融资 vintages；其余明确缺口，完整 raw 保留在 ignored 目录 | CSRC-4 + CORE；字段逐格可回溯、真实 zero/缺字段区分、修订事件匹配；未解决映射的字段保持 PARTIAL |
| R2-D1：per-exchange 历史 source 合同与 adapter | A；无需依赖 B/C；每家交易所一次独立闭环 | `market_adapters.py` 或对应分源模块、exchange/calendar 配置、专项 tests/fixtures、紧凑 evidence | SSE、SZSE、BSE 分别的历史 source/definition/calendar inventory、准入子窗口、字段 lineage；不生成全 A 合计 | MARKET-1..4 + CORE；某所无法证明日频则只交 PARTIAL evidence，不构造统一序列；后续交易所不得改动已审计分源合同 |
| R2-D2：all-A 基础字段合计与 dataset admission report | A + D1 所有该 era 必需交易所审核通过；B/C 报告可引用而非阻塞依赖 | 独立基础金额 aggregator / completeness validator、专项 tests、小型 sample/admission report | 分字段同日合计+component lineage、scope break 与未准入窗口矩阵；无 normalization/周度评分 | MARKET-3..5 + CORE；缺所/错日/错单位/晚发布均 fail closed；只声明已覆盖且审计通过窗口 |

`research-data/market-regime/raw/`、`extracted/`、`vintages/` 的大数据保持 ignored；只提交 schema、代码、必要的受控 fixtures、紧凑样本与 evidence。不得为追求“immutable”把大数据复制进 `src`、`public` 或 Phase 1B SQLite。

## 11. 下一轮可执行验收用例

下面是未来各 slice 必须实现的测试规格，不把尚未编写的测试算成本轮 PASS。

| ID | 输入/触发 | 必须得到的结果 |
| --- | --- | --- |
| CORE-1 | 同一 fixture 输入换序、固定时间重复构建；只改 generatedAt | 固定时间字节一致；业务内容 hash 不随 generatedAt 改变；任一 coverage/release link/definition 改变均影响 R2 hash |
| CORE-2 | bytes 改 1 byte、size 错误、路径越界、非2xx、200 错误页、伪 RAW_SOURCE 摘录 | 不计入 admitted dataset；保留失败记录；旧 sample 校验能力不削弱 |
| CORE-3 | 周一 07:59 / 08:00 / 08:01、周一 date-only、周日 date-only、节假日周一 | 前两 exact 可用、08:01 不可用；周一仅日期发布次日才可用；周日日期可进周一；clock 不移 |
| CORE-4 | 同月 first/revision、断链/环/同序冲突、改 observation 时间复用旧 artifact、相同 bytes 不同事件 | 正确链在 cutoff 逐版选择；异常拒绝；独立 release event 不因 bytes 去重丢失；first-release 未证实不得冒称 |
| CORE-5 | missing、not-yet、structural、latest revised、schedule inferred、backcast | 分别记账，前五不制造 strict 数值；backcast 仅在实际 release 后可用；gap 行不塞 R1 observations |
| CORE-6 | 目标窗口中缺一月/一交易日、重复两条 vintage、只有 TEST_FIXTURE_EXCERPT | 分母不减、期间数不增、fixture 不计覆盖；inventory PASS 与 dataset coverage PARTIAL 可同时存在 |
| M2-1 | 2005/2015/2024 已有 fixture + 2011-09/10、2017-12/2018-01 原始证据 | 期次与两个字段精确匹配；definition effective range 正确；原单位/可比性可追溯 |
| M2-2 | 一页同时有 M2/M1、当期/上期、完善前后同比；annual 与月末标题 | 取明确期次/定义的 M2 当期数，歧义拒绝；年末=12月，不多计一次 |
| M2-3 | 今日修订表与原 release 同期但值不同 | 不覆盖 first release；缺 revision event 则 conflict/proxy，早期 cutoff 不得见未来修订 |
| AFRE-1 | 2014-12 backcast，cutoff=2015-02-09 / 2015-02-16 | 前者排除、后者可见；更早历史表缺字段不生成月度插值 |
| AFRE-2 | 2018/2019 scope 变化文件含当期与回溯历史 | 当前数与历史行区分；backcast 绑定后发事件；旧定义不能覆盖新口径；不用全文关键词一刀切 |
| AFRE-3 | 早期仅季末/年末发布、后期月度缺页或仅 flow | 保留 native cadence，月度 target PARTIAL；有官方未发布机制证据才 structural；flow 不填 stock |
| CSRC-1 | 同 landing 多附件/不同 reportPeriod、日期只在官方 index、换 URL 同 bytes | 正确选择并记录所有关联证据，日期可回溯；期次冲突拒绝；首链接不是默认权威 |
| CSRC-2 | XLS、真实 DOCX、错误扩展名、损坏 ZIP/OLE、公式无 cache、合并表头 | 只有经 fixture 验证格式可解析，其他保留 raw+错误，不 OCR/猜数 |
| CSRC-3 | 缺 IPO 字段、空格/破折号、明确 0、含债券/境外或仅 YTD | 缺值不为 0；真实 0 有 locator；混合定义和 YTD 不写正式 MONTH 指标 |
| CSRC-4 | format/definition 切换前后、同月后来更换附件 | 每字段原文与结果可核对；新 artifact/release/definition lineage，历史数据不被后发文件覆盖 |
| MARKET-1 | A+B 合计、主板+子板重复、negotiable/free-float 含义不一 | scope/单位不匹配拒绝；不能只因字段叫“总计”就导入 |
| MARKET-2 | BSE 2021-11-14 / 15 | 前者 null structural且无 release，后者按正式 source 可见性；不能 pre-launch BSE=0 |
| MARKET-3 | 三所一所缺失、一所日期错、一所晚于 cutoff | 不生成该字段 all-A 合计；保留分源与缺口；availableAt 取最大 component release |
| MARKET-4 | 节假日、官方交易日历缺失、只有 tradeDate 无发布日期、只有月报 | 日历缺失/PIT 未证实为 PARTIAL；不伪造当天发布，不把月数据拆日 |
| MARKET-5 | 成交额全齐但流通市值缺；BSE pre-launch 完整沪深 | 分字段状态；前者依赖比例不可用；后者合法沪深 scope 合计但不把 BSE 数值补0 |
| PE-1 | factsheet/current chart 存在或第三方提供长历史 | slot 和 validator 仍拒绝正式采集；只有新 source admission 才能另立任务 |

## 12. normalization / backtest 的后续门禁

本 brief 或任一 slice 的 tests PASS 都不授权计算 Candidate A–D。本轮不修改 `MarketTemperature`、normalization/backtest runtime、formula admission、production weight、Market Regime/牛熊温度计 UI、Product Shell、Research Inbox、Industry Data Platform、Portfolio、Account/Asset/Transaction/Position/DCA、Research Bridge、Auth、cloud business database、LocalStorage migration、Supabase、Vercel 或真实账户数据。

只有后续独立任务满足以下全部要求才允许开始相应研究计算：

- 明确选择已审计 datasetVersion/content hash、metric/window/definition/quality tier；included cells 为 A_STRICT_PIT、B_PIT_WITH_SCOPE_BREAK 或 C_BACKCAST_KNOWN_AT_TIME；D proxy、未知来源与结构性缺失排除。
- 明确 AFRE 准入窗口/排除时代；all-A daily 数据满足候选依赖所需 scope 和连续性；CSRC 不足时 Supply 明确 unavailable，PE 继续 NO_GO 或另行通过新 source admission。
- 单独完成 Monday 08:00 weekly immutable manifest builder，exact observation IDs 可追溯；日历、latest eligible tradeDate、no-look-ahead reference window 均通过测试。
- 继承已有 minimum maturity（daily 252、weekly 52、monthly 24、quarterly 12）、module coverage/reweighting、base-weight coverage 与 era comparability；不能因为 R2 某几个字段覆盖多就声称整个候选已满足。
- 没有采入的减持/回购/融资余额/GDP 等依赖不得补 0；Candidate D 的 flow/credit-impulse 仍需额外定义/数据范围，不由 stock 数据自动获得运行资格。
- dataset admission、normalization/backtest 实现、formula admission、Engine/UI 与 production admission 分开记录并分别获得任务授权。本轮到普通 commit+push 即停止，不创建 PR、merge、tag 或开始任何 R2 slice。

## 13. 本轮验证与限制

运行环境：Node 22.23.2、npm 10.9.8、Python 3.13.9。验证时未调用 `data:refresh`、live production refresh 或完整 P0 probe。

| 命令 | 结果 |
| --- | --- |
| `npm run test:market-regime:catalog` | PASS，48 tests |
| `npm run data:build:market-regime:catalog` | PASS，8 observations / 5 artifacts；content hash `b7f9802eb46d44088adb75471c190af4c9b48d471a8865ef3b531d4c6b3bfec6` 与 tracked baseline 相同 |
| `npm run data:validate:market-regime:catalog` | PASS，verify-artifacts 启用，0 errors |
| `npm run env:check` | READY WITH WARNINGS，47 PASS / 11 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `npm run --silent env:check:json` | READY WITH WARNINGS，48 PASS / 10 WARN / 0 FAIL / 4 SKIP，exit 0；第二次 gh 登录探测成功 |
| `npm test` | EXISTING FAILURE，2 nested-worktree Node test 文件被 Vitest 扫入而报 No test suite found；101 suites / 1661 tests PASS，exit 1；发生于文档编辑前的精确代码基线，不是本任务 regression |
| `npm test -- --exclude 'data-cache/**'` | PASS，主仓 39 suites / 597 tests，exit 0；不改 test discovery 配置来隐藏原始失败 |
| `npm run build` | PASS，TypeScript、Local Core typecheck、Vite、browser boundary 与 bundle gate；现有 chunk >500 kB WARN |
| `git diff --check` | PASS；提交前另核对 staged diff，仅本文与 CURRENT 索引的最小导航变动 |

环境 WARN 包括多 runtime 路径、4 个未固定 Python 数据依赖、现有 mootdx/httpx 依赖不匹配、ignore 规则检查、旧生成物/schemaVersion、30 个公告 partial。健康检查还观察到 catalog 重建带来的换行工作区状态；已确认 `git diff` 无内容差异、hash 不变后，只恢复本任务生成的 sample 换行。两个健康检查 gh 状态不同属于探测时点差异，不用于证明 Git push 能否成功。

本轮有限网络核验：PBC 2015 M2/2014 stock/2018 M2、PBC 后发历史表注释、CSRC index 与两期 landing、SSE 历史页可读取；SZSE 市场总貌和 BSE 首页超时；CSI 首页需 JavaScript。未进行全历史抓取、官方附件解析或新 PE source 实施。网页读取是 scope discovery，非完整字节存档，也不新增 dataset coverage。未用第三方结果填补任何来源。

未解决的是后续数据准入 blockers：M2 完整 first-release/vintage、AFRE 发布频率过渡与缺月、CSRC 文件迁移边界与权益/月度 field mapping、交易所日频历史/PIT/单位与市场范围一致性、CSI300 连续历史 PIT PE。它们必须出现在下一轮逐源报告，不阻止本 docs-only brief 在如实保持 PARTIAL/NO_GO 后交付独立审查。
