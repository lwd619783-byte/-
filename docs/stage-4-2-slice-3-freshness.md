# Stage 4.2 Slice 3 — Freshness acquisition evidence

## 2026-09-18 final remediation · CURRENT delta against a1a4be2

本轮只做 Segment-node architecture 与 Stability cohort P1；**未重新请求NBS、行情、财务、公告，也未重新生成guidance**。保留上一轮真实刷新证据与完整历史记录，不把 validator 成功当新鲜度推进。

| 范围 | 输入a1a4be2 → 当前 |
| --- | --- |
| NBS | 2026-08；前次probe LATEST_ALREADY_RETAINED；无新capture、raw/双owner/Registry pins无diff |
| A/H行情及history/profile等 | 所有真实artifacts无diff；Unitree行情获取2026-09-18T13:02:03+08:00，source as-of仍unknown；H旧留存不宣称新鲜 |
| 专用财务 | 57家公司，最新留存报告期2026-06-30；无diff、没有新报告期 |
| 专用公告 | 17099条，25success/32partial；Unitree19条、latest2026-09-03；无diff |
| guidance | 57状态、16公司61snapshots、0历史修订；Unitree missing；全部无diff |
| Identity/研究池 | Universe60=57A+3H，robotics43=41A+2H，private0；无diff |
| Stability控制 | expectedCompanies56→57；配置分母与current generated A universe精确核验，非源数据刷新 |

[机器delta](stage-4-2-slice-3/segment-architecture/remediation-delta.json)记录对比路径及零数据diff，所有门槛除cohort数量外逐字段相等。57/57 production validation已PASS，56/57、extra58和foreign负例被拒绝；health仍0观察日、`insufficient_observation_window`、strict exit2，financial/announcement默认刷新和admission不提升。历史56 cohort不改写/不复用。

本轮只更新图表与cohort检查代码、专项tests、CURRENT docs、browser screenshots/报告和health/delta证据。财务/公告/guidance validators与guidance `--check` PASS；data audit0errors/26warnings。新UI保持Structure/Research Context和Provider Fact区分；Guidance cross-epoch P2本轮继续不修。完整验收见[Slice3 CURRENT](stage-4-2-slice-3.md)。

---

## 上一轮真实获取记录（历史 a1a4be2 delta against 3edd80f）

本增量覆盖本轮真实获取；后文原基线 `086521d` 的运行记录保持原样。旧“Unitree未上市”仅代表错误的静态池分类，不是当时上市事实。独立上交所核验确认 2026-08-19 上市，当前唯一 identity 为 `unitree → 688836.SH`。

| 项目 | committed 3edd80f | 本轮结果 / 新鲜度 |
| --- | --- | --- |
| Universe | 59 = 56 A + 3 H；private1 | 60 = 57 A + 3 H；private0；warnings0 |
| robotics pool | 42 listed（40 A+2 H）+1错误private | 43 listed（41 A+2 H）；总研究对象仍43 |
| Unitree quote | 不在 Universe，无正式 owner 数据 | `real`，499.30元，总市值2019.49亿元、流通市值150.23亿元；采集2026-09-18T13:02:03+08:00 |
| Unitree 源报价时间 | 无 | raw string `20260918130159`；原quote合同未单列源时钟，图表as-of仍unknown，不与updatedAt或releaseAvailableAt混用 |
| Unitree history | 无 | real，23条，2026-08-19—2026-09-18；仅最新留存日，不声称收盘终值 |
| Unitree profile | 无 | Eastmoney F10 real；`listDate=null`，未用上交所日期填入Provider缺失字段 |
| Unitree financial | 无 | Sina专用Provider success，9期，latestReportPeriod 2026-06-30；获取2026-09-18T04:56:39Z |
| Unitree announcement | 无 | CNInfo success，19条，latest2026-09-03；新source epoch2026-09-18T04:59:29Z |
| Unitree guidance | 无状态文件 | 状态missing、0 snapshots；19条公告未产生可靠指引输入，不填0预测 |
| A quote | 56家，采集11:48:05+08:00 | 57家真实重新请求；旧56 quote有diff。市值列语义纠正，见下文 |
| H quote及其他模块 | 3家，quote采集12:02:47+08:00 | 本轮无必要重抓，8 composite模块的H对象逐项完全不变 |
| 专用财务 | 56家success、最新均6/30 | 增Unitree为57家success；旧56 detail无diff |
| 专用公告 | 17080条；24success/32partial | 17099条，新增19、删除0；25success/32partial；旧56公司latest date无推进 |
| guidance | 56状态、16公司61snapshots | 57状态、仍16公司61snapshots、0历史修订；Unitree无可靠快照；epoch/pins更新 |
| NBS | 2026-08 LATEST_ALREADY_RETAINED | 保留前轮正式probe事实；本轮未重新抓取/未新capture，raw/owner/Registry无diff |

缺失字段还包括 Unitree quote.PS / dividendYield；HK 财务/公告仍按现有能力边界未实现。provider success 并不表示每个字段完整，也不构成 Stability/Admission 通过。完整机器差分、Unitree字段和旧源逐文件SHA见 [freshness-delta.json](stage-4-2-slice-3/remediation/freshness-delta.json)。

### 获取路径及本轮暴露的两项正确性修复

1. `npm run data:universe` 后对 Unitree 执行 `python scripts/fetch-a-stock-data.py --stock 688836`，专用财务 `--stock 688836 --no-cache`、公告 `--stock 688836 --no-cache`。新增 A composite `--stock` 只接受唯一已有 A identity，保留其他公司与HK所有模块并对完整Universe重算coverage；不扩Universe、不改变默认refresh。Universe seed parser排除嵌套Evidence.id，避免误认额外证券。
2. 真实 Unitree quote 暴露旧腾讯总/流通市值字段反向。腾讯[官方HS前端bundle](https://st.gtimg.com/quotes/hs-fund/bundle.13362df9.js) 的 `ltz:t[44], zsz:t[45]` 确认**44是流通、45是总市值**。修复现有parser后重新请求全部57 A quote；57份原始GBK响应、byte count/hash及官方JS摘录/整源hash保存在 `research-data/provider-probes/tencent-market-cap/2026-09-18/`。离线逐项重放与当前quotes完全一致；没有凭比例交换旧数值。
3. 旧56 A profiles中55条仅更新同quote派生的totalShares/floatShares，F10主体及其采集clock不动；这些派生字段的本轮来源由上述quote capture记录，不能把profile的F10时间当股本观测时间。旧公司 history/legacy financial/research/announcement/signal/sector 六模块对象全部不变；仅新增Unitree对象。H全不变。
4. 单公司公告刷新后，Guidance严格同epoch guard阻止混合epoch；为不弱化门禁，再执行现有完整57家公司CNInfo刷新。由此发现旧逻辑只在query start前进时保留历史：equal start但已留存更早公告会丢1314条。现改为每次保留旧未覆盖announcementId，新返回同ID走既有版本关联；增加equal-window专项测试。最终17099条中1314个窗口前历史对象与3edd80f逐项完全相等，窗口仍覆盖2024-07-11—2026-09-18。
5. Guidance cross-epoch P2 **未重构**：从3edd80f提取58个旧公告源文件并逐一核对Git原始bytes/hash；旧56家公司guidance对该旧epoch校验0errors，保持旧guidance输入未变；再用现有render/staged transaction APIs生成并校验57家公司新epoch。仅跳过错误epoch下的重复旧源检查，版本图/新源/新输出完整性仍验证。当前generator `--check` PASS。61个可靠业务快照数量/值不变，source pins与workflow epoch更新，workflow bytes261595、SHA-256 `1d16143f604b64a98dbc5c1ff77cc5a1b131c8eee3ffe4e3103a6baa04b59568`。

### Artifact diff 与没有变化的范围

- 更新：Universe/manifest；八个composite文件新增Unitree，quotes和派生股本另有上述纠正；专用financial summary/manifest+Unitree detail；公告57 detail/summary/manifest（旧主体新获取时钟、保留历史）；guidance57状态/summary/manifest/workflow（同epoch pins重放）；Registry当前覆盖说明。
- 没有diff：NBS全部raw、双metric artifacts和pins；Signal/Event实现；旧56专用financial detail；旧公司六类composite对象；H全部八类composite对象。没有新9月NBS指标。
- 验证：综合行情validator0errors/1warning；财务/公告/guidance validators与guidance `--check` PASS；7 targeted quote tests、27 announcement tests、173 guidance Node tests PASS；data audit0errors/26warnings。
- 默认 eligibility **BLOCKED**（frozen expectedCompanies56 vs actual57、观察runs=0），未修改冻结配置、默认financial/announcement eligibility、Stability或admission。P2自动cross-epoch gap、缺失profile.listDate/guidance、32公告partial保持明确；没有为新增证券虚构字段。

---

## 原始 Slice 3 获取记录（输入086521d，当前差分以上述remediation为准）

基线：`086521d6bd305ea73cb5d4a426b9d4138e4a824b`。本文件记录 2026-09-18 的显式获取与 committed 基线之差；执行成功、数据更新与 production admission 分别记录。

## NBS 官方 freshness probe

命令：`python scripts/industry/probe_nbs.py`。默认只读；`--retain-new` 仅在 `NEW_RELEASE_AVAILABLE` 时新建独立目录，以现有 `nbs-capture.v1` 格式保留原字节。原始留存、Registry、两个正式 owner、F1 binding 与 admission 不由 probe 静默改写。新 capture 需要经过既有 owner/replay/Registry/F1/Evidence 检查后才能用于指标；本次没有新 period，因此未发生这条写入路径。

发现入口：[国家统计局最新发布](https://www.stats.gov.cn/sj/zxfb/)。实际列表最新工业生产发布为 **2026-08**，页面标题“2026年8月份规模以上工业增加值增长5.2%”。列表提供 `/sj/zxfb/202609/t20260915_1965308.html` 别名；仅在同 period、精确相同文档文件名时使用 committed 的原始 URL 比较 bytes：[原始留存来源](https://www.stats.gov.cn/zwfwck/sjfb/202609/t20260915_1965308.html)。

结果：**`LATEST_ALREADY_RETAINED` / `EXACT_RETAINED_BYTES`**。当前与 committed retained capture 均为 180835 bytes、SHA-256 `0f6d42bf7229268008f7970694d7295ec05cf0f509e23975daa36574651475e3`。同一份既有 `nbs-parser.mjs` 对期间、统计范围、绝对量/同比表头及 raw row 完成校验：

| 正式读数 | committed | 官方当前 | delta |
| --- | ---: | ---: | --- |
| 2026-08 当月产量（套） | 96174 | 96174 | unchanged |
| 2026-08 当月官方同比（%） | 34.6 | 34.6 | unchanged；不计算同比差额 |
| 2026-01—08 累计产量（套） | 729352 | 729352 | unchanged |
| 2026-01—08 累计官方同比（%） | 29.0 | 29.0 | unchanged；不计算同比差额 |

页面 publication 为 `2026-09-15T10:00:00+08:00`；`releaseAvailableAt` 仍为 `null`，不得以 publication/acquiredAt/probe time 替代。probe 只说明检查时官方可发现的最新发布，未推定未来发布时间或刷新承诺。两 owner 仍 `NOT_ADMITTED`、PIT `UNPROVED`、revision continuity `unknown`、Entity `UNRESOLVED`。

**无新 capture。** `research-data/industry/nbs-robotics-v1/**`、两个 `src/data/real/industry-robotics*.generated.json`、两个 owner plan/F1 binding 和 Registry 均没有由此次获取产生 diff。

Acquisition 验证：`python -m unittest scripts.tests.test_industry_freshness` 8 tests PASS；覆盖相同最新原字节 no-op、相同 period 改 bytes 显式 `SOURCE_CHANGED`、表头改变 fail closed、无法访问/非官方 source/redirect fail closed、原留存 digest 漂移、合成新 period 只读探测及排他新目录写入。合成 September fixture 仅为离线测试，未声明 9 月已发布。

`npm run data:validate:industry` PASS：2 metrics、7 retained captures、每 owner 13 observations；Registry/F1/Evidence 原始 replay 通过，F1 仍 `VALID / NOT_READY`。

## Robotics pool 与刷新范围

从 `src/data/stocks.ts` 的既有 `robotStock` 实际公司记录、`src/utils/symbol.ts` 与生成 Universe 精确对账：**42 家上市公司 = 40 A 股 + 2 港股**；另有 `src/data/privateCompanies.ts` 的 **unitree / 宇树科技**，未上市，无行情/财务 Provider。`industries.ts` 的 segment `stockIds` 是结构研究映射子集，不能代替完整公司池。

用户指定既有 A/H 行情命令使用完整 Universe（56 A + 3 H），不支持单行业过滤；此次沿用既有链，未改 Universe membership。财务/公告同样运行现有全量链，以保持摘要/manifest/detail 与公司指引一致。刷新成功没有改变默认 `data:refresh` eligibility、Stability Gate 或 admission。

实际命令：

```text
npm run data:fetch:a-stock
npm run data:fetch:hk
npm run data:fetch:financials:a -- --no-cache
npm run data:fetch:announcements:a -- --no-cache
```

财务/公告采用现有 `--no-cache` 参数显式请求实时端点；公告已留存 PDF 文本仍按原 Provider 的 cache 规则复用，未改变 parser 或完整性规则。

## 真实 freshness delta

NBS 最后实测时间：`2026-09-18T03:55:02.867889+00:00`。行情文件 generation 由 `2026-07-05T17:40:20+08:00` → `2026-09-18T12:02:47+08:00`。既有 quote `updatedAt` 是 Provider 刷新时钟，未单独保存交易所报价时间；source quote as-of 为 **unknown**，不能将刷新时钟宣传成交易所时间。priceHistory 的真实最新 date 单独列于下表。

财务：`2026-07-10T15:58:30Z` → `2026-09-18T03:48:04Z`；全部56家及 robotics 40家 A股正式最新报告期均从 2026-03-31 → 2026-06-30，56/56 success，核心财务字段与原值真实改变，0 partial/error。

公告：`2026-07-11T07:31:40Z` → `2026-09-18T03:50:45Z`；保留窗口 `2024-07-11—2026-07-11` → `2024-07-11—2026-09-18`；全量条数 15674 → 17080；当前 success/partial/error/empty = 24/32/0/0。逐 company + announcementId 对账确认 **新增 1406、删除 0**，其中 robotics 新增 932；既有历史保留。partial 32 家表示部分目标正文解析不完整，不是虚构缺失字段；全量 source 最新公告日见逐公司表。

| 公司 / ticker / market | 行情价格 committed → refreshed | 当前 quote status | 最新历史交易日 committed → refreshed | 财务 report period | 最新公告日 committed → refreshed | 公告 status |
| --- | --- | --- | --- | --- | --- | --- |
| 机器人 / 300024 / A股 (`siasun`) | 18.31 → 13.14 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-05-18 → 2026-08-24 | partial |
| 埃斯顿 / 002747 / A股 (`estun`) | 44.77 → 29.79 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-08 | partial |
| 埃夫特 / 688165 / A股 (`efort`) | 23.26 → 14.96 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-11 → 2026-09-12 | partial |
| 绿的谐波 / 688017 / A股 (`leaderdrive`) | 488.0 → 294.96 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-18 | partial |
| 中大力德 / 002896 / A股 (`zhongda-lide`) | 85.62 → 61.25 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-01 → 2026-08-26 | success |
| 双环传动 / 002472 / A股 (`shuanghuan`) | 47.01 → 36.34 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-04 → 2026-09-16 | partial |
| 斯菱股份 / 301550 / A股 (`siling`) | 109.09 → 96.15 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-01 → 2026-09-11 | success |
| 北特科技 / 603009 / A股 (`beite`) | 53.34 → 48.92 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-05-22 → 2026-09-02 | success |
| 贝斯特 / 300580 / A股 (`best`) | 25.96 → 18.47 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-06 → 2026-09-12 | success |
| 五洲新春 / 603667 / A股 (`wuzhou`) | 76.15 → 51.03 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-09 → 2026-09-02 | success |
| 金沃股份 / 300984 / A股 (`jinwo`) | 61.2 → 30.63 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-06 → 2026-09-14 | partial |
| 三花智控 / 002050 / A股 (`sanhua`) | 48.99 → 35.39 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-08 → 2026-09-16 | partial |
| 拓普集团 / 601689 / A股 (`topgroup`) | 62.43 → 45.02 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-01 → 2026-09-10 | partial |
| 恒立液压 / 601100 / A股 (`hengli-hydraulic`) | 121.66 → 93.21 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-03 → 2026-08-25 | success |
| 汇川技术 / 300124 / A股 (`inovance`) | 72.15 → 52.43 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-01 → 2026-09-16 | partial |
| 雷赛智能 / 002979 / A股 (`leisai`) | 69.55 → 55.1 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-15 | partial |
| 鸣志电器 / 603728 / A股 (`moons`) | 68.02 → 50.1 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-06-12 → 2026-08-26 | success |
| 奥比中光 / 688322 / A股 (`orbbec`) | 147.33 → 92.65 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-09 → 2026-09-16 | partial |
| 汉威科技 / 300007 / A股 (`hanwei`) | 43.27 → 30.4 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-06-17 → 2026-08-29 | partial |
| 恒帅股份 / 300969 / A股 (`hengshuai`) | 117.0 → 81.69 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-01 → 2026-09-14 | success |
| 峰岹科技 / 688279 / A股 (`fortior`) | 241.35 → 210.48 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-17 | partial |
| 信捷电气 / 603416 / A股 (`xinje`) | 60.88 → 47.11 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-17 | success |
| 浙江荣泰 / 603119 / A股 (`rongtai`) | 74.81 → 55.36 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-09 → 2026-09-10 | success |
| 凌云光 / 688400 / A股 (`luster`) | 71.41 → 47.39 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-11 → 2026-09-12 | partial |
| 长盈精密 / 300115 / A股 (`everwin`) | 33.18 → 24.65 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-14 | partial |
| 旭升集团 / 603305 / A股 (`xusheng`) | 13.03 → 11.13 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-09 → 2026-09-17 | success |
| 恒勃股份 / 301225 / A股 (`hengbo`) | 96.25 → 60.33 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-03 → 2026-09-17 | success |
| 新泉股份 / 603179 / A股 (`xinquan`) | 53.47 → 39.78 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-03 → 2026-09-17 | success |
| 科博达 / 603786 / A股 (`keboda`) | 44.28 → 37.79 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-09 → 2026-09-12 | success |
| 均胜电子 / 600699 / A股 (`joyson`) | 23.45 → 20.2 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-11 → 2026-09-05 | partial |
| 星宇股份 / 601799 / A股 (`xingyu`) | 100.31 → 72.22 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-10 | success |
| 日盈电子 / 603286 / A股 (`riying`) | 56.96 → 44.5 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-04 → 2026-09-18 | success |
| 岱美股份 / 603730 / A股 (`daimei`) | 13.0 → 9.67 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-11 → 2026-09-18 | success |
| 模塑科技 / 000700 / A股 (`molding-tech`) | 17.6 → 11.9 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-03 → 2026-09-12 | partial |
| 万向钱潮 / 000559 / A股 (`wanxiang-qc`) | 14.22 → 10.99 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-11 → 2026-09-11 | success |
| 铁流股份 / 603926 / A股 (`tieliu`) | 19.21 → 17.19 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-02 → 2026-08-26 | success |
| 肇民科技 / 301000 / A股 (`zhaomin`) | 35.53 → 24.71 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-10 → 2026-09-09 | partial |
| 宁波东力 / 002164 / A股 (`dongli`) | 12.91 → 10.39 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-03 → 2026-09-17 | success |
| 凯迪股份 / 605288 / A股 (`kaidi`) | 95.18 → 69.19 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-06-27 → 2026-08-25 | partial |
| 恒辉安防 / 300952 / A股 (`henghui`) | 20.24 → 16.05 | real | 2026-07-03 → 2026-09-18 | 2026-03-31 → 2026-06-30 | 2026-07-09 → 2026-09-12 | success |
| 优必选 / 9880 / 港股 (`ubtech`) | 108.9 → 80.35 | real | 2026-07-03 → 2026-09-18 | not_implemented | not_implemented | not_implemented |
| 舜宇光学科技 / 2382 / 港股 (`sunny-optical`) | 60.05 → 67.45 | real | 2026-07-03 → 2026-09-18 | not_implemented | not_implemented | not_implemented |

unitree / 宇树科技：未上市；Provider quote、financial、announcement 均 unavailable/not_implemented；保留既有 Research Context，不生成证券价格或财务事实。

Company guidance：公告新输入通过既有 validator 后运行现有生成链；sourceGeneratedAt `2026-07-11T07:31:40Z` → `2026-09-18T03:50:45Z`。audit 的 reliableAnnouncementCount/reliableSnapshotCount/reliableCompanyCount/historicalVersionCount：`{'reliableAnnouncementCount': 31, 'reliableSnapshotCount': 56, 'reliableCompanyCount': 15, 'historicalVersionCount': 0}` → `{'reliableAnnouncementCount': 34, 'reliableSnapshotCount': 61, 'reliableCompanyCount': 16, 'historicalVersionCount': 0}`。仍为公司正式披露的只读 guidance，不是机构一致预期或 admission。

## Artifact diff 与验证

- `src/data/real/`：13 files changed：`a-share-announcement-summaries.generated.json`, `a-share-company-guidance-expectation-summaries.generated.json`, `a-share-financial-summaries.generated.json`, `announcements.generated.json`, `data-manifest.generated.json`, `financials.generated.json`, `priceHistory.generated.json`, `quotes.generated.json`, `research.generated.json`, `sectorMembership.generated.json`, `signals.generated.json`, `stock-universe.generated.json`, `stocks.generated.json`
- `public/data/a-share-financials/`：57 files changed。
- `public/data/a-share-announcements/`：57 files changed。
- `public/data/a-share-company-guidance-expectations/`：58 files changed。
- `research-data/industry/`：0 files changed。
- `config/industry/`：0 files changed。

### 实际验证及恢复记录

| 检查 | 最终结果 |
| --- | --- |
| NBS acquisition adversarial tests | PASS，8 tests |
| `data:validate:industry` | PASS，2 owner Registry / replay / F1 / Evidence；准入状态保持原值 |
| A 股原刷新链 | 56/56 quote、56/56 history；初次 legacy financial 22 个 HTTP 456，见下述恢复 |
| 港股刷新链 | 初次 lenovo timeout，quote 2/3；一次相同链重试后 quote/history 3/3，全为 real |
| `data:validate:a-stock` | **PASS，errors=0 / warnings=1**；A quote/history/legacy financial 56/56，H quote/history 3/3 |
| `data:validate:financials:a` | PASS，专用 Provider 56/56 success，最新报告 2026-06-30 |
| `data:validate:announcements:a` | PASS，56 companies / 17080 announcements；24 success / 32 partial，0 error/empty |
| `data:validate:expectations:company-guidance` | PASS，61 snapshots / 16 companies |
| `generate-company-guidance-expectations.mjs --check` | PASS，59 files，0 mismatch |
| company-guidance regression | PASS：173 Node tests + 102 Vitest tests；静态 workflow hash 更新后专项 check 19 tests 再次 PASS |
| `data:audit` | PASS，0 errors / 26 warnings；旧 guidance 15-company / 56-snapshot 固定门槛更新为本次完整验证的 16 / 61，保留相等断言 |

保留 warning：凯迪股份（`kaidi`）实际 PE TTM 1259.35，被既有 validator 标为极端值；没有截断或替换。A 股旧研报 49/56、旧公告入口 55/56 的 missing 仍如实保留；港股 financial/research/announcements 与未上市 Provider 仍 `not_implemented`。这不影响专用公告 Provider 的 56 家状态覆盖，也不等同于所有 PDF 可结构化。

初次 `data:fetch:a-stock` 的 legacy `financials.generated.json` 发生连续 22 个 HTTP 456，原记录都是 real / 2026-03-31，新失败记录全部核心字段 null/error；原脚本只在整个 payload 空时保留旧文件，没有 per-company stale retention。未关闭门禁，未借用专用财务 Provider 数值。只对这 22 家使用现有 `fetch_financial` 做一次间隔串行重试，原 endpoint、parser、网络设置不变；**22/22 真正成功，period=2026-06-30**。每家公司记录其实际重试采集时间（2026-09-18 12:06:18—12:06:54 +08:00），使用既有 `generate_signals_from_real_data` 更新它们依赖的 signals，使用 `module_coverage` 重算 financial/signals manifest 覆盖。其他公司记录未重抓，quote bytes 保持完全不变。初次阻断的 34/56=60.7% 核心财务覆盖恢复为 56/56；最终综合 validator 0 errors。

### Company guidance 跨 source epoch 的受控重放

原始命令 `npm run data:fetch:expectations:company-guidance` 首次 **WARN / 未写入**：`existing provider artifacts are invalid: announcement/provider release epoch mismatch`。它尝试以新公告 epoch 校验旧 guidance；未修改生成器/validator，没有忽略错误继续发布。

实际使用既有公开 API 的单次受控编排：

1. 从 exact base `086521d6bd305ea73cb5d4a426b9d4138e4a824b` 的 Git committed bytes 导出旧公告 summary、manifest、56 detail（共58文件）到独立临时 `oldSourceRoot`；逐文件核对 Git bytes，并核对 manifest byteSize/SHA-256。旧 source epoch 为 `2026-07-11T07:31:40Z`，没有替换工作区的新公告。
2. 使用 `validateCommittedCompanyGuidanceArtifacts(rootPath, { expectedCompanyCount: 56, sourceRootPath: oldSourceRoot })` 对当前旧 guidance 做完整验证，必须 0 errors；同时记住旧 guidance 全59文件 hash。
3. 使用下面既有 API 重放。`validatePreviousArtifacts: false` 仅避免将刚通过旧来源完整验证的旧包再次错误地与新 source epoch 比较；render 的 history/version graph、source、输出结构和 transaction 的新来源完整校验仍然执行。写入前确认旧59文件 hash 未变化。

```js
const rendered = renderCompanyGuidanceArtifacts({ rootPath, validatePreviousArtifacts: false });
const paths = resolveCompanyGuidancePaths(rootPath);
// Assert all 59 previously validated guidance file hashes remain unchanged.
writeArtifactsTransaction({
  rootPath, outputDir: paths.outputDir, summaryPath: paths.summaryPath,
  summary: rendered.summary, manifest: rendered.manifest,
  renderedDetails: rendered.renderedDetails,
  renderedWorkflowIndex: rendered.renderedWorkflowIndex,
  expectedCompanyCount: 56, sourceRootPath: rootPath,
});
```

4. 对新包重新运行完整 validator、只读 `--check` 与相关回归测试，全部 PASS。snapshot 56→61、reliable company 15→16、historical versions 0→0；旧已记录历史未删除。新增公告被原规则排除/部分解析时仍保留原状态。测试仅将固定 workflow 原始字节期望更新为本次可重放的 261595 bytes / SHA-256 `a47a4fdee15033e641fa572ef97d52cb15659f20a0a34a07402efc4251f1ebfd`，保留精确 bytes/hash 断言。

未重新定义默认 refresh eligibility，未提升 production/PIT/Entity admission。本轮获取最终无未解决的阻断；上述来源/解析缺失与 warning 保留。
