# R2-B AFRE-2 historical table / vintage lineage 修复

Base/main：`4920e38830cfde887dab39e64673e7f30857e331`；审查 HEAD：`2ffab00c81013febaa788492ba892cbda848917f`。在原分支 `feat/stage-4-1-r2b-pbc-historical-vintage-dataset-v1` 追加修复。

事实源为 [Scope Freeze](observation-catalog-r2-scope-freeze-v1.md)、已合入 R2-A contract 和当前 PBC 实现。本报告更新[前批报告](pbc-historical-vintage-r2b-v1.md)中 AFRE historical rows 未准入的实现状态及 vintage 计数；前批封存文件、旧报告与证据保留为原基线。R1/R2-A schema、validator、selector 均未修改。数据集、inventory、revision 仍全部 **PARTIAL**。

## 修复内容

原实现虽识别 AFRE prose historical row，但 `resolve_definition` 无条件拒绝 2015 年以后的 AFRE BACKCAST，HTML 历史表也没有形成正式提取。现在机器读取三份原始 scope-change release 的 HTML 表，并对每份报告的余额、同比分别新增 period-applicable definitions，共六个：`pbc-afre-stock-{balance|yoy}-{2018-07|2018-09|2019-09}-backcast-v1`。

定义选择同时核对原官方 URL、报告统计期、精确 publication/release clock、scope evidence 和统计期适用范围。未知报告、改动时钟、无范围证据或越界行仍拒绝；不按 valueDate 复用旧 definition。Plan 升为 `1.1.0`，只扩展原窗口的定义列表，仍为 22 windows / 1112 cells。

每条历史数值的 locator 包含真实表头、期次、单位和原值；原始亿元按冻结 SCALE 规则转换为万亿元，同比保留原报值。表内组件同比、未知形状、合并单元格、空白/非数字值与冲突均有拒绝测试。正文当期值与 `tableCurrentRows` 分开，表中较高精度的当期余额不会替换原正文 first release。

每个 backcast 绑定实际后发事件，`revisionEvidence` 保存 scope note；observation 的 `supersedesObservationId`、递增 `revisionSequence` 与 extraction 的 predecessor IDs 一致。三次不同口径历史值不再被误判为无授权的数值冲突。未知替代关系仍 fail closed。

## 原始证据与增量

本轮 **0 次新增网络请求**。重用前批封存 physical journal/discovery 与完整 raw bytes，未重新抓取其他来源。三份 HTML 表实际提供 70 个历史 period-section、140 个字段：

| 原 scope-change release | 实际 releaseAvailableAt（上海时间） | 独立定义适用期 | 新 extraction | 准入余额 / 同比 vintages |
| --- | --- | --- | ---: | ---: |
| [2018-07](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/352836472d1a48c19be8b9d19f2d9473/index.html) | 2018-08-13 19:25:12 | 2017-01～2018-06 | 36 | 18 / 17 |
| [2018-09](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/031b9fe3f0e84f10ab01c564d8c8b43b/index.html) | 2018-10-17 16:00:01 | 2017-01～2018-08 | 40 | 20 / 19 |
| [2019-09](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/1cd1f9ef49a44b02ab96992fe75f9758/index.html) | 2019-10-15 16:30:02 | 2017-01～2019-08 | 64 | 32 / 31 |
| [2019-12](https://www.pbc.gov.cn/diaochatongjisi/116219/116225/4e41ac139d6b4e18b28488005f5fce7b/index.html) | 2020-01-16 15:00:30 | 未准入附件数值 | 0 | 0 / 0 |

新增 **137 条准入 vintages**，另 3 条是 2017-02 同比，保留 extraction-only 与 `AFRE_BACKCAST_FIRST_RELEASE_LINEAGE_GAP`。本次只扩充已有合格当期字段的 lineage；不能用后发可比表补成原时点已经具备 comparable-basis 证据。因此 2017-02 原同比缺口不变。这里不将“缺 first release”解释为 backcast 数值错误，而是按本轮不提高期间覆盖率的边界暂不准入。

2019-12 官方 landing 只有两个 XLS href：`2020011614581297750.xls`、`2020011614581918343.xls`。原 HTML 已保存并验证发布时钟与链接；本轮未请求附件 bytes，当前 parser 没有能够满足冻结字段定位合同的 XLS 路径，分别记录 `AFRE_BACKCAST_ATTACHMENT_UNSUPPORTED`。不声称附件缺失、下载失败或已证明其内容；不猜值，也不预造无已准入字段的 definition。该项仍为显式 PARTIAL blocker。

正式 releaseEvents 由 **412 → 482**，其中 BACKCAST sections **4 → 74**；这不是 70 次额外网络发布。Field extractions **813 → 953**，observations **754 → 891**。Conflict sidecar 仍为 0，不代表未知 revisions 已穷尽。

## Coverage 与 vintageCount

逐格比较前后 1112 cells：`status`、`reasonCode`、`firstRelease` 全部不变。原有 754 observations 的身份、值、valueDate、releaseAvailableAt、definition、revisionSequence、supersedes 与 rawArtifactId 全部保留在新版本中。旧封存 bytes 未改写。

| AFRE 主窗口 | 余额覆盖 / 同比覆盖（前后相同） | 余额 vintageCount 前→后 | 同比 vintageCount 前→后 |
| --- | --- | ---: | ---: |
| 2015-01～2018-06 | 33/42、32/42 | 33→87 | 32→83 |
| 2018-07～2018-08 | 2/2、2/2 | 2→6 | 2→6 |
| 2018-09～2019-08 | 12/12、12/12 | 12→24 | 12→24 |
| 2019-09～2019-11 | 3/3、3/3 | 3→3 | 3→3 |
| 2019-12～2022-12 | 37/37、37/37 | 37→37 | 37→37 |
| 2023-01～2026-08 | 42/44、24/44 | 42→42 | 24→24 |
| 合计 | **129/140、110/140** | **129→199** | **110→177** |

各时代 inventory / revision / dataset 均为 **PARTIAL**。AFRE 2002–2014 搜索窗口仍是余额、同比各 1/156，仅 2014-12 后发值；M2 余额、同比覆盖仍各 256/260，vintageCount 分别 256、257。所有既有逐期 blockers 仍见[前批 coverage CSV](../../research-data/market-regime/source-catalog/pbc-historical-coverage.v1.csv)，本次只增加历史版本数和相应 backcastCount，不提高 period coverage。

## 2017-12 cutoff 验证

未修改的 R2-A `select_vintage` 在完整原始官方 bytes 构成的 2017-12 验证切片上执行 18 次选择，并独立通过模型 integration/adversarial tests。先验证 whole graph，再按 cutoff 过滤，最后选择当时可用的最高 revisionSequence。

| cutoff 起点（上海时间，含该秒） | 余额（万亿元） | 官方同比 | revisionSequence |
| --- | ---: | ---: | ---: |
| 2018-01-12 16:00:00 原发布 | 174.64 | 12.0% | 0 |
| 2018-08-13 19:25:12 | 177.3872 | 12.5% | 1 |
| 2018-10-17 16:00:01 | 182.8692 | 13.4% | 2 |
| 2019-10-15 16:30:02 | 183.2379 | 13.5% | 3 |

原发布前一秒返回空；三次后发事件前一秒均返回前一版本。2020-01-16 的 XLS 尚未准入，所以当时仍选 sequence 3，不能凭附件链接制造下一版。原始 raw 切片封存于 ignored `research-data/market-regime/vintages/pbc-r2b-afre2-cutoff-check`。

## 门禁与复现

- PBC **68 tests PASS**：40 parser、11 原 dataset、10 retrieval、7 新 lineage integration/adversarial；包含错误 URL/clock/适用期、断链、缺 first release、缺同比 basis、附件拒绝。Controlled excerpts 保留 fixture 标记；它们不被 relabel 为 raw，集成测试另构造临时完整协议模型，正式验收使用原始完整 bytes。
- R2-A **66 tests PASS**；R1 **48 tests PASS**；两套 schema/validator/测试基线未修改。
- 项目 **39 suites / 597 tests PASS**；build、TypeScript、Local Core/browser boundary、bundle gate PASS，保留既有大 chunk warning。
- env：**READY WITH WARNINGS，44 PASS / 14 WARN / 0 FAIL / 4 SKIP**。无依赖或环境配置变更。
- 正式 build PASS，独立 validate 复核同一封存 dataset；准入仍 PARTIAL。`git diff --check` 纳入交付前门禁。

正式输出为 ignored `research-data/market-regime/vintages/pbc-r2b-afre2-v1`，`generatedAt = 2026-09-08T12:20:59Z`，dataset SHA-256：`de42c2bcf35dcaef845d1526517c60ace2e0ce9a7c333a0dd52820ddfd567fc0`。

```powershell
npm run data:build:market-regime:pbc -- --output research-data/market-regime/vintages/<new-afre2-replay> --journal research-data/market-regime/vintages/pbc-r2b-v1-review/snapshot-retrieval-journal.jsonl --discovery research-data/market-regime/vintages/pbc-r2b-v1-review/snapshot-discovery.json --generated-at 2026-09-08T12:20:59Z
npm run data:validate:market-regime:pbc -- --output research-data/market-regime/vintages/<new-afre2-replay>
```

[紧凑修复证据](../../research-data/market-regime/source-catalog/pbc-afre2-evidence.v1.json)包含前后各窗口计数、输入/输出 hashes、原 raw cutoff 结果和附件/lineage blockers；[新增 vintages CSV](../../research-data/market-regime/source-catalog/pbc-afre2-vintages.v1.csv)列出 137 条新增 observation 与 predecessor。只克隆 Git 不包含完整 raw archive，复验需要对应 hash 匹配的本地存档。

交付止于同分支普通 commit + push，等待复审；不创建 PR、不实施 R2-C。整体库存分页证明、修订穷尽性、既有逐期缺口及 2019-12 XLS 字段证明仍是 PARTIAL。
