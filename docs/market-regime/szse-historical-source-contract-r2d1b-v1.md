# Stage 4.1 R2-D1B — SZSE Historical Source Contract V1

状态：**PARTIAL / SOURCE INVENTORY ONLY**。本合同只允许官方来源发现、原始证据获取、候选解析和拒绝状态；三个字段的正式 observation / strict PIT coverage 均为 0，没有准入历史子窗口。实现的 `SZSEHistoricalMarketAdapter.collect()` 返回 `None`，`field_status()` 可检查逐字段 blockers。

本轮从 fetch 后精确核验的 `origin/main @ 9b8924daaadc498d704156952e14c89c36dc0cbd` 建立 `codex/stage-4-1-r2-d1b-szse`。事实源为 [R2 Scope Freeze](observation-catalog-r2-scope-freeze-v1.md)、[R2-A core](historical-dataset-r2a-core-v1.md)、当前 historical schema / validator / locator 和 `market_adapters.py`。SSE sibling 只提供结构参考，未修改 SSE 合同、代码或证据。

机器合同：`config/market-regime/szse-source-contract.v1.json`，identity `szse-historical-source-d1b-v1`。冻结目标：`EXCHANGE_MARKET_STATS` 的 `turnoverValue / totalMarketCap / negotiableMarketCap`，2005-01-01..2026-09-04，as-of `2026-09-07T08:00:00+08:00`。完整官方交易日分母未知，保持 null，不能用日历自然日、weekday、成功响应数或 0 代替。

## 1. 可重放的官方请求链

1. [市场总貌](https://www.szse.cn/market/overview/index.html) 在 HTML 中声明 `data-s-catalog-id="1803_sczm"`，并引用 `szsePath.js`、`concatversion.js` 和 report module。
2. [szsePath.js](https://www.szse.cn/szsePath.js) 定义资源域；[concatversion.js](https://res.szse.cn/common/js/concatversion.js) 定义 `/api/report`、资源域选择、版本 `1.2.221`，并在非开发模式把 `.js` 改成 `.min.js`。
3. 实际 [report_new.min.js](https://res.static.szse.cn/modules/report/js/report_new.min.js?version=1.2.221) 定义 `/ShowReport/data?SHOWTYPE=JSON&CATALOGID=...`、tab / 查询条件及编码规则。
4. 不含日期的 `1803_sczm` 响应返回“所校验的日期为空”，同时在 metadata 中明确 `txtQueryDate` 日频日期条件及 `tab1`。它仅用于发现参数，不作为市场值或发布日期。
5. 日期请求严格使用该调用链，固定 `SHOWTYPE=JSON / CATALOGID=1803_sczm / txtQueryDate=<bounded probe> / TABKEY=tab1`。不按日期或文件编号猜测归档 URL，不遍历目标窗口。

fetch 最多 30 个已冻结请求、单请求 12 秒、响应上限 2 MB；本版本实际 26 个请求，依赖顺序固定。网络获取时间/HTTP 状态/最终 URL/full SHA-256/size/路径单独留存。缓存必须校验真实 bytes，不改原 fetchedAt、不伪装为新 HTTP 成功；错误 HTTP bytes 保留为 retrieval evidence。重定向必须仍处于明确 SZSE 官方域。

探索早期直接取未压缩资源出现 404，后从官方版本加载器证明 `.min.js` 和资源域规则后才构造 API 请求。没有用第三方接口代码作为来源合同。

## 2. 独立字段与 scope 审计

`security-category` 只解析 `tab1 / 证券类别统计`，按列名和原文单位精确匹配：

| 冻结字段 | JSON key / 原始表头 | 当前结论 |
| --- | --- | --- |
| `turnoverValue` | `cjje` / 成交金额、亿元 | 可保留候选，不等于换手率；跨期交易范围、币种适用与 release 未证明 |
| `totalMarketCap` | `sjzz` / 总市值、亿元 | 可保留候选；收盘口径和跨期适用未证明，不用其他市值替代 |
| `negotiableMarketCap` | `ltsz` / 流通市值、亿元 | 可保留候选；不等同于自由流通调整市值，定义和跨期适用未证明 |

候选保持原始千分位数字字符串和原单位，不执行 CNY 换算、不合计板块、不生成 all-A。空白、null、破折号为 FIELD_MISSING；只有原始 `0` / `0.00` 才是零。缺一列只令该字段 missing；列存在但单位或含义漂移、未知表下注释、畸形数值则拒绝该响应。

| 原始行标签 | 候选标识及限制 |
| --- | --- |
| 主板A股 | `SZSE_MAIN_A`，明确 A 标签，但不证明全历史定义适用 |
| 创业板A股 | `SZSE_CHINEXT_A`，明确 A 标签 |
| 中小板 | `SZSE_SME_A` 只是目标候选标识；`BOARD_LABEL_ONLY_A_MEMBERSHIP_UNPROVEN`，不可据此宣称已证明 A-only |
| 旧“创业板” | 同样保留标签本身及 A membership 未证明状态，不能静默把无 A 标签升级为 A-only |
| 股票、主板B股、基金、债券、期权及未知/混合标签 | `MIXED_OR_NON_A_OR_UNKNOWN_SCOPE`，不生成目标候选 |

同日同 scope/field 的重复行，即使值相同，也全部标 `UNRESOLVED_RELEASE_CONFLICT`。candidate identity 在最终状态确定后计算，绑定原文 locator；fetch 顺序和 JSON 行先后不能选择 truth。`field_status` 同时检查同日跨响应重复。

## 3. 分源断点与 bounded probes

| 日期 | `1803_sczm` 实际结果 | 不能据此推断的事项 |
| --- | --- | --- |
| 2005-01-04 | 空表，无独立 response date | 不等于休市、source absent 或该日市场值为零 |
| 2009-10-29 | 主板A、主板B、中小板；无创业板 | 仅定点响应 |
| 2009-10-30 | 新增旧“创业板”标签 | 标签未明确 A membership；不建立连续窗 |
| 2020-01-31 | 空表 | 休市结论来自公告，不能来自空表 |
| 2020-02-03 | 主板A、中小板、创业板A候选 | 无市场统计 release clock |
| 2021-04-02 | 主板A、中小板、创业板A分别列示 | 不能外推整个合并前时代 |
| 2021-04-06 | 主板A、创业板A；中小板消失 | 不能再另加中小板，或与“股票”合计重复累加 |
| 2026-09-04 | 主板A、创业板A候选 | 当前可查历史，不等于历史原始 vintage |

[2009 年创业板交易通知](https://www.szse.cn/disclosure/notice/general/t20091026_500286.html) 明确首批股票于 2009-10-30 上市；[2021 年两板合并说明](https://www.szse.cn/aboutus/trends/news/t20210406_585442.html) 明确 4 月 6 日实施。两份公告完整 bytes 和原文 paragraph locator 均保留。parser 拒绝创业板上市前出现创业板、两板合并后仍带中小板的响应。

发现的第二请求 family 来自页面直接链接的 [股票日度概况](https://www.szse.cn/market/stock/situation/daily/index.html)：`scsj_gprdgk_after`。metadata 显示日频参数以及主板/创业板/深市合计，其 footer 明确统计范围含存托凭证。2005-01-04、2021-04-02、2021-04-06、2026-09-04 四个定点响应有成交金额，两个市值字段不存在；合并前列为 `zg / eb / cy / gp`，合并后为 `xz / cy / gp`。尤其前两个响应实际返回旧 catalogid `scsj_gprdgk`，与请求 family 不同，parser 严格标 `PARSER_FAILED / WRONG_SOURCE_FAMILY`，不因有数值而接收；已将 2021-04-06 前后 response family 迁移证据冻结为 break。后两个响应保留 `EVIDENCE_ONLY_MIXED_SCOPE_AND_UNPROVEN_RESPONSE_DATE`。主板未单列 A/B，`gp` 与板块不能重复相加，响应 subname 为空、日期条件只是请求回显；这四个响应均不产生日频候选。

未定位的 breaks：`1803_sczm` 最早可用边界、旧“创业板”改为“创业板A股”的日期、旧/新 family 跨期完整性与字段适用性。定点成功不证明相邻日、窗口或 revision 穷尽。

[2025 年 7 月统计月报](https://www.szse.cn/www/market/periodical/month/t20250805_615341.html) 直接链接的市场总貌作为术语/单位 cross-check，完整 bytes 原编码保留。英文 ASCII locator 区分 Total Market Capitalization、Total Negotiable Market Capitalization 和 Total Turnover（RMB Mil.）；该文件为非 UTF-8 中文报表，不伪造 UTF-8 中文 locator，也不当作 daily API 定义证明。月报数值不拆成日频。

## 4. SZSE 日历与 PIT

独立保存 [全年安排](https://www.szse.cn/disclosure/notice/general/t20191220_572766.html)、[春节原安排](https://www.szse.cn/disclosure/notice/general/t20200116_573576.html)、[春节延长修订](https://www.szse.cn/disclosure/notice/t20200127_573917.html)。原安排包含 1 月 31 日开市；修订明确延长休市至 2 月 2 日、2 月 3 日开市。calendar version `szse-2020-spring-revision-bounded-v1` 仅映射 2020-01-31..2020-02-03，closedDates 为前三天、openDates 仅 2 月 3 日；受控子窗口分母为 1。

源公告日期由 HTML 标签分隔，保留真实 paragraph bytes，不把人工规范化日期塞入原文。现有 `historical_validator.Graph.validate_coverage` 要求 calendar ISO 日期字面出现在 locator text，因此 `r2CalendarStatus=BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED`。该源日历不能冒充已准入的 R2 日历；其余目标日期均缺完整官方 calendar inventory。

所有 market-statistic releaseEvents / fieldExtractions / exchangeMarketObservations 保持空。tradeDate、metadata 条件、URL、抓取时间、HTTP metadata、日历公告发布时间均不充当市场统计 release。PIT、first-release、revision archive 始终未证明。将来准入需要独立审计的合同后继版本和既有 R2-A builder/validator；不能改一个 admission flag 使 V1 输出 VERIFIED observation。

## 5. 实现与证据重放边界

- `szse_source.py`：独立 JSON parser、结构路径到原始 byte span、字段/单位/scope/date/pagination 校验、候选与冲突状态、fail-closed adapter。
- `szse_inventory.py`：bounded fetch、原始 acquisition 验证、R2 evidenceArtifact/artifactBinding/retrievalAttempt schema、确定性 build、compact 与完整 replay。
- 完整 raw 和获取 metadata 位于 ignored `research-data/market-regime/raw/szse-d1b/`。提交的 compact inventory 位于 `research-data/market-regime/source-catalog/szse-d1b/inventory.v1.json`；较小 JSON 响应的完整原文作为 sourceResponses 保留，可离线重新解析并核对 full SHA/size。
- compact validator 精确匹配外部 contract，重算 candidates/rejections/probes/field assessments/coverage/calendar/admission，检查 IDs、获取关联、binding 状态、locator 引用和边界。仅重 seal business hash 不能提升 coverage 或改写派生状态。
- full validate 还逐项重放页面/脚本/公告/月报 locator、原始获取 bytes、request dependency 和完整 build。fresh checkout 的 compact PASS 不能被称为已重放所有 ignored HTML/脚本 raw；重新获取网站若发生漂移，不能覆盖已 sealed 输出，必须新证据版本。
- 独立 parser fixtures 始终为 `TEST_FIXTURE_EXCERPT`，来源 URL/hash/size/fetchedAt 另存 provenance，历史 coverage 为 0。
- 业务 hash 包含 contract、provenance、原始摘要、parser version、所有 sidecars 和拒绝/准入声明，仅排除 generatedAt/hash 本身。无 formal release，故不虚构 release identity；共享 R2 event identity 语义保持不变。

本轮测试、最终统计和停止点见 [交付报告](szse-r2d1b-delivery-v1.md)。
