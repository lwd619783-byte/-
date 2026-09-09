# Stage 4.1 R2-D1C — BSE historical source contract V1

状态：**SOURCE DISCOVERED / PARSER WORKS / CANDIDATES AVAILABLE / INVENTORY PARTIAL**。正式 observation、strict PIT coverage 均为 **0**；完整官方交易日分母未知。该版本是待独立审查的 BSE evidence inventory，不是 R2 historical dataset 或 production admission。

固定基线 `origin/main @ aa1f5aff6fe1da1246be68376bcc4af9ef6ea8d2`，分支 `codex/stage-4-1-r2-d1c-bse`。固定窗口 `2021-11-15..2026-09-04`，`datasetAsOf=2026-09-07T08:00:00+08:00`。抓取发生于 2026-09-09；采集时间如实保留，不用它声明历史可见性。

事实源为 [Scope Freeze](observation-catalog-r2-scope-freeze-v1.md)、[R2-A Core](historical-dataset-r2a-core-v1.md) 及现有 schema/validator/locator/hashing。BSE 的 [机器合同](../../config/market-regime/bse-source-contract.v1.json)、[采集锚点](../../research-data/market-regime/source-catalog/bse-d1c/captures.v1.json) 和 [inventory](../../research-data/market-regime/source-catalog/bse-d1c/inventory.v1.json) 共同构成本轮审核输入。SSE/SZSE 只读参考；复用其已审计的 JSON/UTF-8 byte locator 原语，未改 sibling 合同、代码或证据。

## 1. 官方发现链与请求边界

24 个请求均保留原 URL、GET/POST、POST form、实际 UTC fetchedAt、HTTP 状态、Content-Type、完整 bytes SHA-256 和 size。原始响应合计 411097 bytes；raw 位于既有 ignored `research-data/market-regime/raw/bse-d1c/`。没有 URL 编号扫描或日期全量枚举。

| 链 | 已存档的实际证据 | 结论 |
| --- | --- | --- |
| [BSE 首页](https://www.bse.cn/) → `myhead.html` → [定期统计](https://www.bse.cn/static/statisticdata.html) → `marketData/daily.min.js` | iframe、导航 href、script src 的原始 byte offset/length/text | 日报 API、日期格式、选行和显示映射已发现 |
| 首页 → `main.min.js` / `index/index.min.js` → `components/common/util.min.js` → `/bseHome/index.do` | RequireJS base/compress/path 与 `getp` 调用 | 首页当前市场总貌；没有已发现的历史日期参数，不把此接口扩展为历史 API |
| header → [市场日历](https://www.bse.cn/disclosure/tradingtips.html) → `marketData/trade_notice.min.js` | `tradingtipsController/tradingtipsExPage.do`、公司/事件筛选参数 | 实际是公司交易提示事件流，未发现完整交易 session 日历；没有调用事件分页来反推分母 |
| header → [休市安排](https://www.bse.cn/disclosure/Rest_arrangement.html) → `rest_arrangement.min.js` | 页面正文、脚本 | 当前休市说明；不是完整历史日历档案 |
| 官方页面搜索 → [2026 休市公告](https://www.bse.cn/important_news/200027428.html) | URL 来自搜索命中，已独立下载官方完整 HTML；查询词在机器合同保存 | 可定位元旦小窗口，不能据此补全 2021–2026 |
| header → [本所简介](https://www.bse.cn/company/introduce.html)；官方页面搜索 → [2021 上市规则发布公告](https://www.bse.cn/important_news/200010914.html) | 完整官方正文与选定原文 byte locator | 证明开市与精选层迁移的身份边界 |

实际历史调用冻结为 `POST https://www.bse.cn/marketStatController/dailyReport.do`，form 为 `HQJSRQ=YYYYMMDD`。该参数、去掉日期连字符的转换和 `2021-11-15` 下限均来自日报脚本；没有加入 `latestDate`、分页、板块或未知参数。

原请求未传 callback，官方返回字面 `null(JSON)`；parser 只拆这一层，不执行 JavaScript，不容许任意 callback、尾随脚本、JSON 重复键、非有限值或分页 envelope。非空响应的每一行必须回显请求的 `rq`，不能用请求日期代替响应日期。固定 source family、单位映射或参数发生变化必须新版本审查。

首先核验开市日、下一日期及目标末日。接口提供日期选择机制且三次均返回对应日期后，限定补查 `2026-08-31..09-04` 五个相邻日期及官方元旦小窗口的两日。合同请求上限 30、单次超时 12 秒、响应上限 2000000 bytes。缺少 scope/PIT/完整 calendar 的情况下停止扩展；这 8 个非空日期不证明完整历史连续性。

## 2. 字段、市场范围与断点

| 目标字段 | 日报原字段 | 当前网页显示证据 | 正式适用状态 |
| --- | --- | --- | --- |
| `turnoverValue` | `hqcjje` | `unitAdjust(R.hqcjje,2)`，标签成交金额；与 `hqcjsl` 成交股数分开 | candidate；交易方式范围、大宗成交包含关系、历史币种/口径适用未闭合 |
| `totalMarketCap` | `zsz` | 总市值（亿元），`C(R.zsz)`；`C` 除以 100000000 | candidate；原值保留为元，不执行显示舍入；历史收盘时点/证券范围定义未闭合 |
| `negotiableMarketCap` | `ltsz` | 流通市值（亿元），`C(R.ltsz)` | candidate；不能解释为指数 free-float，历史适用未闭合 |

金额保留完整 JSON 数字 token 和 byte locator，不经 float 重格式化、汇总或换算产生正式值。真实数字 `0` 可以作为开市后候选，缺字段/null 保持 `FIELD_MISSING`；公司数、股本、成交股数和换手率均不能替代金额或市值。字段注释和单位映射的证据位于官方脚本，不能伪装成 R2 同一 locator 中已有 field/unit/value 的正式 extraction。

日报响应同时包含 `XJX / X / M / C / B / 2 / 1 / 0` 等代码。官网代码明确只以 `xxzrlx="2"` 选日报主行，以 `XJX` 显示另一注释。V1 只解析代码 `2` 的三字段为候选，其余 56 行逐行保留为 rejected evidence；不猜其他代码含义，不把 `B` 与 `2` 重复相加，不因金额相同断言它们同义，也不把大宗交易注释自行加到成交额。

代码 `2` 被网页使用只是选行证明，**不构成全 era A 股证券 membership 的独立证明**。每日范围适用、非目标证券排除、市场扩容/退市与交易方式变化仍按字段保留 blocker，没有新增正式 `SourceDefinitionVersion`。

`2021-11-15` 是开市身份断点。官方上市规则允许精选层公司的上市时间连续计算，不能由公司上市日期推导 BSE 开市前市场统计。日报脚本还明确拒绝下限之前的日期，所以本轮没有绕开前端下限发送 pre-launch 日报请求；离线对抗样本检验即使收到代码 `2` 和数字零也拒绝拼接。

同一脚本的周报年累计注释明确包含 2021 年开市前精选层平移公司的数据；因此周/月/年报不能充当本轮日频缺口补丁。脚本中的 2025 年 7 月股权激励增发口径说明属于发行统计，不把它冒充日报三字段的实际生效断点。除已证明的开市身份边界外，其他每日字段断点仍为 unknown。

既有 R1 seed/schema/validator 均未改变。`BSEHistoricalMarketAdapter.collect(2021-11-14)` 复用既有 helper：三字段 null、`releaseAvailableAt=null`、`STRUCTURALLY_UNAVAILABLE`。开市后本版本返回 None，并提供逐字段 blocker。

## 3. Calendar、release 与 revision

独立官方 calendar 事实仅有：

- 本所简介明确 `2021-11-15` 开市；只证明这一日，不外推次日。
- 2026 官方休市公告正文证明 `2026-01-01..01-04` 休市、`01-05` 开市。定位到完整 HTML 正文段落，保留标签分隔的原 bytes。

这两个独立小窗口合计只有 **2 个被证明的开市日期**。完整窗口的交易日分母是 null，不是 0；其余范围既不删掉，也不按工作日补齐。datepicker 的 weekday 过滤不是官方历史日历；日报有返回或为空也不是 calendar 证据。

中文日期/HTML 分隔的正文没有满足现有 R2 calendar gate 的 literal ISO 日期定位要求，本轮不放宽共享 validator，也不造一个规范化 HTML 当原始证据。所以该 calendar 仅供 inventory 定位与 blocker 分析，R2 calendar admission 仍 BLOCKED。

日报 `rq`、首页“更新日期”、请求日期、fetchedAt、当前历史接口和其他公告发布日期都不能证明市场统计 release。当前下载的历史值可重放，但 first-release、历史 vintage 和 revision archive 均未证明；没有市场 release event，不倒填 `releaseAvailableAt`，不把现在重述的历史值放入早期 cutoff。重复代码 `2` 行无论数值相同或冲突都标记 `UNRESOLVED_RELEASE_CONFLICT`，不按获取顺序选择。

## 4. 覆盖与 admission ledger

| 状态 | V1 实际结果 |
| --- | --- |
| source discovered | 是；24 个有来源链的限定请求，全为 HTTP 200 |
| parser works | 是；8 个非空日报响应，24 个字段候选 |
| candidate dates | `2021-11-15/16`、`2026-01-05`、`2026-08-31..09-04` |
| 空响应 | `2026-01-01` 返回 `null([])`；单独保留，不记 source absent |
| current-only | `/bseHome/index.do` 的 `rq=20260908`，窗口外，仅存档，不计候选 |
| 各字段候选日期数 | turnover / total cap / negotiable cap 各 8 |
| 各字段正式 available / strict PIT | 各 **0 / 0** |
| 完整目标交易日分母 | **unknown / null**；不能计算全窗覆盖百分比 |
| 已证明 calendar 子窗口开市日数 | 2；不是完整分母，也没有获得 R2 calendar 准入 |
| `releaseEvents / fieldExtractions / exchangeMarketObservations` | 全空 |

`coverage.fullTarget` 保留完整原窗口；`unadmittedWindows` 保留整个窗口，不能把离散 probes 当 target grid。没有日历就不伪造 R2 source plan/dataset。`dayAssessments` 仅表示九个被探测日期的字段状态，不宣称枚举过所有交易日。

全部 blocker：

1. `FULL_OFFICIAL_CALENDAR_UNPROVEN`：完整官方交易日证据及其版本/修订尚未闭合。
2. `CONTINUOUS_HISTORY_NOT_ENUMERATED`：离散样本及五个相邻日期不足以证明全窗口历史连续性。
3. `FIELD_SCOPE_ERA_APPLICABILITY_UNPROVEN`：各字段历史证券范围、货币及收盘/存量语义需独立证明；代码 `2` 不足以提供这些证据。
4. `TRADE_MODE_AND_BLOCK_TRADE_INCLUSION_UNPROVEN`：成交额与大宗注释及其他交易方式的范围关系未证明。
5. `MARKET_RELEASE_MISSING`：没有市场统计 release 的可定位证明。
6. `FIRST_RELEASE_AND_REVISION_ARCHIVE_UNPROVEN`：没有可审计的首次发布/修订档案；现今历史返回不能回填 PIT。
7. `NEGOTIABLE_NOT_PROVEN_FREE_FLOAT`：不建立流通市值与 free-float 的等价关系；每日历史定义本身也待证明。
8. `R2_CALENDAR_LITERAL_ISO_LOCATOR_UNAVAILABLE`：实际官方中文/HTML 日期不能通过现有 R2 literal ISO calendar locator 门禁。

## 5. 可重放性与信任边界

`captures.v1.json` 是独立于 inventory 的采集锚点，绑定 24 个请求的 method/form 与原 bytes hash/size。机器合同固定 discovery、字段映射及 calendar/身份原文定位。10 个小型完整 JSONP 响应作为 fixtures 提交，provenance 明确 fixture role、completeResponse 和 historicalCoverage=0；`.gitattributes` 禁止其换行转换。大 HTML/脚本 raw 继续 ignored。

`validate-compact` 从外部合同、采集锚点及完整 committed response fixtures 重新解析全部 candidates/rejected rows，并重新推导 probes、coverage、calendar、admission 和整个 envelope。不能只修改 inventory 并重新 seal 就改变数据、分母、来源、locator 或准入状态。business hash 排除 generatedAt，保留所有业务内容和 acquisition provenance，集合顺序 canonical 化。

compact 可以离线验证完整小响应及固定的原始证据定位声明；**仅靠 hash 无法在缺少 raw 时证明大 HTML/脚本原文**。`validate` 另要求全部原 bytes 与 metadata，核对 safe path、size、hash、全部 discovery/auxiliary/calendar/value locators，再重建 inventory 比较。当前工作区已通过 full replay；fresh checkout 若未随附 ignored archive，只能执行 compact，不能声称完成 full replay。

`fetch` 严格执行固定请求与父证据，保留已有成功/失败 metadata，不重写采集时间；parent 失败则停止依赖请求。HTTP 失败 bytes、连接/读取超时和响应上限失败保留 retrieval metadata；HTTP 200 错误页不能通过 parser。新抓取的 bytes、页面定位或 metadata 变化要求新版本，不能覆盖 V1 sealed evidence。`--raw-root` 可将重抓放入独立 archive 根，但重抓不是原采集证明。

```text
npm run test:market-regime:bse
npm run data:validate:market-regime:bse:compact
npm run data:build:market-regime:bse
npm run data:validate:market-regime:bse
```

后两条需要本轮 ignored raw archive。`data:fetch:market-regime:bse` 为显式 bounded live 命令，普通测试不联网，不安装依赖。

V1 inventory hash：`e04cea6e9943fdf07a96e9441ad1bdf81487075ad2e5f6090baae50ede673441`。
capture hash：`ac362b5cff3dd1c1f8e83dbba32b6a771e32418494b66a263a54583adfb81556`。
contract hash：`f22d5231e89a840d55b5204c9044c11b6443d5928d575694e12276a61eb53e1c`。

验收与 Git 交付见 [D1C delivery](bse-r2d1c-delivery-v1.md)。本任务未开始 R2-D2/all-A aggregation，未修改 normalization/backtest/formula/UI/production data admission。
