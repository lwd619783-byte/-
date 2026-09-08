# STAGE 4.1 — R2-B PBC Historical First-Release & Vintage Dataset V1

实现基线：`origin/main @ 4920e38830cfde887dab39e64673e7f30857e331`。分支：`feat/stage-4-1-r2b-pbc-historical-vintage-dataset-v1`。从精确基线新建 sibling worktree；未修改原工作树或 main。

事实源为 [Scope Freeze](observation-catalog-r2-scope-freeze-v1.md) 和已合入的 [R2-A 1.1.0](historical-dataset-r2a-review-fixes-v1.md)。本次只新增 PBC adapter、正式 HISTORICAL plan、source definition records、离线 fixtures/tests 和紧凑证据。R1/R2-A schema、validator、历史 sample 与冻结公式均未修改。

实现与本地验证完成后交付独立审查；本批 M2、AFRE 均为 **PARTIAL**。未实现 CSRC、交易所、PE、normalization、backtest 或 UI，未进入默认 `data:refresh`。

## 数据链路与审计边界

- `pbc_retrieval.py`：只读取 PBC 官方 URL，按原始页面中的 href/分页调用枚举；1.1 秒最小请求间隔、20 秒 timeout、默认 900 次 physical request budget、最多一次重试。403/404/反爬不进行紧密重试。抓取及索引发现与离线构建分离。
- `pbc_parser.py`：按完整原 HTML 定位实际统计期、M2/AFRE stock 余额和同比、原单位、原始数值 token、正文与注释。受控摘录只用于测试，不能进入正式 coverage。
- `pbc_dataset.py`：使用冻结 R2-A identities、target grid、事件、提取、coverage/retrieval/conflict/inventory sidecars；全部实际 bytes 必须通过原 validator。正式窗口仍为 M2 260 月、AFRE 140 月，另登记 2002–2014 backcast 搜索网格 156 月；搜索网格不是月度发布事实。
- `pbc_historical_cli.py`：从 journal 形成受 R2-A 校验的 catalog + envelope，完成验证后才写入 ignored sealed 目录。已有输出只允许相同 bytes 重放；输入更新须使用新输出目录，不改写已封存样本。

同一次物理请求可同时支持 M2 与 AFRE。R2-A 要求 source-bound retrieval，因此两个来源使用稳定的 source view ID，`handlingBasis` 保留原始 physical acquisition ID；URL、时间、HTTP 状态、hash/size 不变。这不是第二次网络请求。完整 physical journal 与所有历史失败保存在 ignored raw 目录，紧凑报告分别列物理请求数与 formal envelope 对象数。

缓存每次复验实际路径、size、SHA-256，保留原网络 acquisition 并追加 `CACHE_VERIFIED`；缓存不携带伪造 HTTP 200，不改 artifact 的原 fetchedAt。最初遇到的旧 HTTP 表链接收据原样保留；R2-A 只接受 HTTPS，因此这些收据明确列为 `excludedProtocolAttempts`，不改 URL 冒充 HTTPS。后续对同 host/path 执行真实 HTTPS GET，其成功或404作为独立收据保留。

二进制表和非 UTF-8 HTML 仅登记独立 inventory artifact，其 container/header/stream-name byte locator 只证明文件格式身份，不证明字段、发布时间或 cadence。PDF/XLS/XLSX 不通过截取文本、OCR 或虚构 UTF-8 字段定位取得数值准入。所有表内容仍可供独立审查。

## First release、revision 与定义

FIRST_RELEASE 使用官方原始月报/季末年末报告（含已核对的早期货币信贷标题）、实际发布时间，以及另一份完整官方索引中同标题、同发布日期的唯一链接条目联合证明。统计期需为该当期报告的明确月末，发布在随后自然月；更正、修订、重刊、解读、答记者问、无独立索引证据或时点不一致均不能由“先抓到”提升为 first release。该规则不等于已穷尽所有历史修订；revision coverage 继续 PARTIAL。

相同发布时点、数值、定义的镜像只计一个 numeric vintage，其余事件与提取证据保留。没有官方替代关系的不同数值保留 conflict，严格数值排除。2018 年方法调整的 2017-12 M2 同比单独作为有明确方法证据的 BACKCAST；同页旧方法 8.5% 不能抢占 2018-01 新方法 8.6%。其他未获专属适用区间定义的历史行直接 `DEFINITION_UNRESOLVED`，不按 valueDate 套用旧定义。

定义沿用 R1 的既有记录并新增 SourceDefinitionVersion，不修改 R1 baseline：

| 来源 | 统计期起点 | 依据与处理 |
| --- | --- | --- |
| M2 | 2005-01、2011-10、2018-01 | 沿用冻结 eras；原发布同比保留，不从最新余额重算 |
| M2 | 2022-12 | [2022 年报告](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/568387ff70be457590732b5e044f8e18/index.html)明确 M0 含流通中数字人民币，并说明修订后 2022 年 M1/M2 增速“无明显变化”。新增 current definition；“无明显变化”不能推为精确不变，不重建较早月份 backcast |
| AFRE | 2018-07、2018-09、2019-09、2019-12 | 分别处理 ABS/核销、专项债、交易所企业 ABS、政府债券范围变化；按实际原报告保存当期值，不把今日历史表当作当时 release |
| AFRE | 2023-01 | [2023-01 报告](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/b18b9809242245ebbd594f3380862d5b/index.html)明确三类银行业非存款类金融机构相关人民币贷款和贷款核销调整。新增 current definition，较早历史回溯仍须自己的真实 event |

2025 年 M1 统计口径变化不被误认为另一项 M2 变化。每份报告的 definition notes 与原 HTML locator 随提取保存；definition 已识别不自动证明该份 AFRE 同比的 comparable basis。没有 stock 专属可比性依据的同比只保留 evidence-only extraction，状态为 `DEFINITION_UNRESOLVED`；同份报告的余额独立计数。

AFRE 2014-12 的 122.86 万亿元/14.3% 绑定 [2015-02-10 16:31:12 官方事件](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/2810586/index.html)，在 2015-02-09 cutoff 排除、2015-02-16 可见。2002–2013 未取得可准入的逐字段后发证据，保留缺口。

## Inventory 与未准入证据

两个报告栏目原始索引共 56 页、1098 条 entry：数据解读 38 页/742 条，调查分析 18 页/356 条。原始计数与本次枚举核对一致，但其分页是 JavaScript，且一个页面混合多个 era 和非目标报告。R2-A 的 per-window PageEvidence 要求 literal next href、该窗口所有 candidate URL 及末页证据；本次不伪造该链。原始索引保存为 independent ARCHIVE_INDEX，inventory completeness 与 revision completeness 均仍为 PARTIAL。

另枚举官方统计表栏目、年度目录及真实表链接，全部作为独立 inventory/retrieval evidence。当前历史表缺少能够绑定当前 bytes 的原始/后发 release event，因此不填补月度 vintage。

2015 AFRE 当前官方 HTML 表只列 Q1–Q4，年末为 138.28/12.5，与原始报告 138.14/12.4 不同。这证明存在 revision/proxy 风险，不证明当前表何时替代原值；原发布保留。PBC 2014 年报第75页说明 2015 起按季公布，可作 native cadence discovery，但不能把其他目标月改成 structural、插值或从 flow 补 stock。2016 起报告序列的缺页仍按实际缺口列出，不承诺月度完整过渡。

2026-08 在固定 as-of 前尚未取得可靠发布/未发布证据，保持 `MISSING / RELEASE_NOT_LOCATED`，不按惯例假定 `NOT_YET_RELEASED`。所有 denominator 均保留。

## 本批实际覆盖与封存

固定 dataset as-of 为 `2026-09-07T08:00:00+08:00`；实际 acquisition 为 `2026-09-08T11:03:33.369946Z` 至 `2026-09-08T11:34:25.402166Z`。共 689 次物理网络请求：662 SUCCESS、17 CONTENT_REJECTED、10 HTTP_ERROR；另有 792 次 CACHE_VERIFIED。共保存 648 个不同 hash、30,082,765 bytes（包括被拒绝响应），全部路径、大小与 SHA-256 已重新核验。抓取时间不替代历史 publication/releaseAvailableAt。

实际枚举 56 页报告索引、1098 条 entry，以及 37 个统计表分类页、10 个年度目录页、91 条文件链接；表文件范围覆盖 M2 2005–2026 和 AFRE stock 2015–2026。表文件被获取不代表其中历史值已准入。下列计数来自正式 sidecar，分母没有因网络失败或季度发布而缩小。

表中 first-release coverage 与本批主窗口的 available period coverage 数量相同；余额、同比各自计数。每一行的 inventory completeness、revision coverage、dataset coverage status 都是 **PARTIAL**。即使某时代数值达到全部目标月份，索引与修订链未穷尽，dataset 仍不能 PASS。

| 来源 / definition era 的实际窗口 | 余额 first release / 目标 | 官方（AFRE 为 comparable-basis）同比 first release / 目标 | Inventory | Revision | Dataset |
| --- | --- | --- | --- | --- | --- |
| M2 2005-01～2011-09 | 79/81 | 79/81 | PARTIAL | PARTIAL | PARTIAL |
| M2 2011-10～2017-12 | 75/75 | 75/75 | PARTIAL | PARTIAL | PARTIAL |
| M2 2018-01～2022-11 | 59/59 | 59/59 | PARTIAL | PARTIAL | PARTIAL |
| M2 2022-12～2026-08 | 43/45 | 43/45 | PARTIAL | PARTIAL | PARTIAL |
| **M2 主窗口合计** | **256/260** | **256/260** | **PARTIAL** | **PARTIAL** | **PARTIAL** |
| AFRE 2015-01～2018-06 | 33/42 | 32/42 | PARTIAL | PARTIAL | PARTIAL |
| AFRE 2018-07～2018-08 | 2/2 | 2/2 | PARTIAL | PARTIAL | PARTIAL |
| AFRE 2018-09～2019-08 | 12/12 | 12/12 | PARTIAL | PARTIAL | PARTIAL |
| AFRE 2019-09～2019-11 | 3/3 | 3/3 | PARTIAL | PARTIAL | PARTIAL |
| AFRE 2019-12～2022-12 | 37/37 | 37/37 | PARTIAL | PARTIAL | PARTIAL |
| AFRE 2023-01～2026-08 | 42/44 | 24/44 | PARTIAL | PARTIAL | PARTIAL |
| **AFRE 主窗口合计** | **129/140** | **110/140** | **PARTIAL** | **PARTIAL** | **PARTIAL** |

AFRE 2002-01～2014-12 backcast 搜索窗口另计：余额与同比各 **1/156**，只准入 2014-12；first-release count 为 0，inventory/revision/dataset 均 PARTIAL。M2 2017-12 另有一条 2018-02-12 后发的 8.1% backcast，原发布 8.2% 保留；它不增加已覆盖月份数。本批没有准入 `REVISION` 数值事件，不能据此推论历史没有修订。2015 AFRE 当前表与原发布的差异仍停留在未获事件证明的 proxy evidence。

逐期 blockers（完整 1112 个 metric-period cells 见 [coverage CSV](../../research-data/market-regime/source-catalog/pbc-historical-coverage.v1.csv)）：

- M2 余额与同比：2006-12、2025-01、2026-08 为 `MISSING / RELEASE_NOT_LOCATED`；2011-05 原官方页面缺少数值正文，为 `FIELD_MISSING / FIELD_OR_DEFINITION_UNRESOLVED`。
- AFRE 余额与同比共同缺口：2015-01、2015-02、2015-04、2015-05、2015-07、2015-08、2015-10、2015-11、2016-02、2025-01、2026-08。2015 的 native quarterly 证据不被转换成逐月 stock，也不擅自改变冻结网格状态。
- AFRE 同比额外 19 个月：2017-02，以及 2025-02～2026-07 的每个月，缺少 stock 专属 comparable-basis 证据，保留 `DEFINITION_UNRESOLVED`。这些月份的余额独立准入。
- AFRE backcast 搜索：2002-01～2014-11 每个月均无准入值，共 155 个月；不使用年末值、flow、最新重述表或计算值补齐。
- 所有窗口：未证明符合冻结 per-window contract 的完整索引扫描与完整 revision 链；二进制/非 UTF-8 档案缺少受冻结合同支持的逐字段定位与发布事件证明，继续只作 inventory evidence。

正式封存目录为 `research-data/market-regime/vintages/pbc-r2b-v1-review`（ignored），`generatedAt = 2026-09-08T11:41:06Z`。Dataset version 由 plan、definitions、parser version、records 与 retrieval inputs 的规范化内容生成，排序和 generatedAt 不改变版本身份。

- Dataset content SHA-256：`bd5036e28c5b7123eb72780c7491fd97666af99cb252d915aa8a3e2b5c6b83d2`。
- Catalog content SHA-256：`5920325a4b00e10c01601a7f7f6ef1ef44f2e00e5b5c3ad76de999b84ccfd25a`。
- 封存 physical journal SHA-256：`4628ffbcc09a45f8948331f0a9b4a71dc2788ed27df1e6e54f0619d854b3f390`。
- 正式对象：412 release events、813 field extractions、754 observations、1112 coverage cells、22 inventory windows、1788 source-bound retrieval views。Conflict sidecar 为 0；未获准入的重述表不因此变成已解决 revision。

[紧凑 evidence](../../research-data/market-regime/source-catalog/pbc-historical-evidence.v1.json) 保存逐窗口状态、sidecar hashes、封存输入路径/hash、排除的旧 HTTP 收据及门禁结果；[retrieval CSV](../../research-data/market-regime/source-catalog/pbc-historical-retrieval.v1.csv) 保存全部 689 次物理网络请求。完整 bytes 与完整 journal 保留本地，未纳入 Git；其他机器仅克隆仓库不能复验这些 raw bytes，需同时取得 hash 匹配的存档。

## 复现与门禁

```powershell
npm run data:fetch:market-regime:pbc
npm run data:fetch:market-regime:pbc -- --tables-only
npm run test:market-regime:pbc
npm run data:build:market-regime:pbc -- --output research-data/market-regime/vintages/<new-version>
npm run data:validate:market-regime:pbc -- --output research-data/market-regime/vintages/<new-version>
```

确定性重放时传入 compact evidence 中记录的 `--generated-at`，并使用其中封存的 journal/discovery 文件。首次历史下载不保证官站以后仍提供相同 bytes；hash 是本批存档证据，不是未来联网重抓成功保证。

| 验证 | 结果 |
| --- | --- |
| PBC M2-1～3、AFRE-1～3 + retrieval/builder adversarial tests | PASS，53 tests；覆盖真实边界摘录、正文/旧方法/当前与历史行、未来回溯排除、flow 拒绝、basis 缺失、完整分母、原 acquisition/cache、HTTP/反爬保留 |
| 本批 PBC 正式 build + 独立 validate | PASS；admissionStatus = PARTIAL，固定 22 windows / 1112 cells |
| R2-A CORE-1～6 与 blocker tests | PASS，66 tests |
| R1 catalog tests | PASS，原 48 tests |
| R1 build + verify-artifacts validate | PASS；原 content hash `b7f9802eb46d44088adb75471c190af4c9b48d471a8865ef3b531d4c6b3bfec6` 不变 |
| R2-A synthetic build + validate | PASS，原 v2 content hash `851c81e5e2a0f9f7037f64e6ac88a9abb27028c3b0de854d6ca069b496bb2366` 不变 |
| `npm test` | PASS，39 suites / 597 tests |
| `npm run build` | PASS，TypeScript、Local Core typecheck、Vite、browser boundary、bundle gate；保留既有大 chunk warning |
| `npm run env:check` | READY WITH WARNINGS，43 PASS / 15 WARN / 0 FAIL / 4 SKIP |

Node 22.23.2、Python 3.13.9，无依赖变更。首次 `npm ci` 的 better-sqlite3 构建因本机缺 Visual Studio 失败，随后 `npm ci --ignore-scripts` 安装同一 lockfile；env 实际 native in-memory connection 检查通过，项目 tests/build 通过。未安装编译工具或调整全局环境。env WARN 包括原有多 runtime、未固定 Python 依赖/pip check、未安装的外部 Skill managed copies、提交前 upstream/dirty 状态、旧生成物与公告 partial。

完整 raw archive、physical journal、正式 catalog/envelope 保持 ignored。Git 只包含实现、plan/definitions、必要受控 fixtures、紧凑 evidence 与逐期 coverage CSV。交付止于普通 commit + push，等待独立审查；不创建 PR 或开始 R2-C。
