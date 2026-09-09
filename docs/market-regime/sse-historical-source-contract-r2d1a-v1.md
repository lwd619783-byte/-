# Stage 4.1 R2-D1A — SSE Historical Market Source Contract & Adapter V1

本轮实现 SSE 分源 discovery contract、两套官方日频 JSON parser、版本化日历证据 inventory、逐字段候选及 fail-closed adapter。**交付状态为 PARTIAL；正式历史 observation、三个字段的 strict PIT coverage 均为 0，没有已准入历史子窗口。** `collect()` 当前返回 `None`，`field_status()` 返回具体阻断原因；不能将该接口描述为已经可用的历史数值 Provider。

基线经 `git fetch origin --prune` 核验为 `974bcbfdf95aff65908fce13c8a6bf1edcc34fe1`；分支 `codex/stage-4-1-r2-d1a-sse`。目标仍冻结为 2005-01-01..2026-09-04、as-of `2026-09-07T08:00:00+08:00`。完整官方交易日分母尚未建立，`officialTradingDayTargetCount=null`，不能报告为 0/0 或按探测样本缩小完整分母。

事实源为 [R2 scope freeze](observation-catalog-r2-scope-freeze-v1.md)、[R2-A](historical-dataset-r2a-core-v1.md) 及当前 1.1.0 schema/validator/locator、[冻结公式](formula-normalization-v1.md) 和现有 R1 exchange Protocol / tests。本轮只增加 SSE 配置、模块、测试、证据和显式 package commands；不修改 R2-A、PBC、CSRC、R1 及公式的合同语义。

## 官方 source family 与实际探测

原始获取于 2026-09-09；完整原始 bytes 与原始 acquisition metadata 保留在 ignored `research-data/market-regime/raw/sse-d1a/`，紧凑提交位于 `research-data/market-regime/source-catalog/sse-d1a/inventory.v1.json`。共 17 个成功响应：两个页面、两份页面直接引用的脚本、三份日历/业务衔接通知、十个定点日频响应。未扫描或声称穷尽所有历史日期与 revision。

| Family | 官方入口 / 页面直接调用 | 解析映射与范围 |
| --- | --- | --- |
| `legacy-day` | [历史股票每日概况](https://www.sse.com.cn/market/stockdata/overview/day/index_his.shtml) → [search_addhsl.js](https://www.sse.com.cn/xhtml/home/public/querySearch/search_addhsl.js) → `https://query.sse.com.cn/commonQuery.do`，`sqlId=COMMON_SSE_SJ_GPSJ_CJGK_DAYCJGK_C`、`stockType=90`、`searchDate` | `CAL_DATE` 为数据日期；`PRODUCT_TYPE=1` 主板 A、`48` 科创板；`TX_AMOUNT` / `MKT_VALUE` / `NEGOTIABLE_VALUE` 对应三个字段。只解析页面显示字段，不偷换成 `_FULL`。 |
| `daily-day` | [当前股票每日概况](https://www.sse.com.cn/market/stockdata/overview/day/) → [search_stockData_2021.js](https://www.sse.com.cn/xhtml/home/2021public/querySearch/search_stockData_2021.js) → 同一官方 endpoint，`sqlId=COMMON_SSE_SJ_GPSJ_CJGK_MRGK_C`、`PRODUCT_CODE=01,02,03,11,17`、`type=inParams`、`SEARCH_DATE` | `TRADE_DATE` 为数据日期；`01` 主板 A、`03` 科创板；`TRADE_AMT` / `TOTAL_VALUE` / `NEGO_VALUE`。当前页面的日期参数实际可返回指定历史行，但不证明原始 vintage。 |

请求 URL 由留存的官方页面/脚本参数产生；没有根据日期拼造文件路径。日期是受控能力探测输入，不能据此认定其为交易日。parser 保留主板 A、科创板分别的候选，不执行板块或交易所合计。脚本映射证据保留原始 byte locator，包含原单位“亿元”；API 跨期完整证券 scope、CNY 适用性和字段定义仍须证明，候选不进入正式 CNY observation。

| 实际请求日期 | 接口 | 结果 |
| --- | --- | --- |
| 2005-01-04 | legacy | 3 行，有主板 A 三字段；另有 B 股、未证明的 `PRODUCT_TYPE=12` 合计 |
| 2019-07-19 / 2019-07-22 | legacy | 分别 5 / 6 行；断点两侧有主板 A，后者有科创板 |
| 2020-01-31 | legacy | 空结果；官方修订已明确休市 |
| 2020-02-03 | legacy | 6 行；主板 A / 科创板三字段均有候选，官方已明确开市 |
| 2020-04-30 / 2020-05-06 | legacy | 各 6 行；仅作为 rate 注释断点两侧探测 |
| 2021-12-31 | legacy | 空结果；不能因旧脚本宣称截止 2022-01-03 而补齐该日 |
| 2022-01-04 | daily | 3 行，主板 A、主板 B、科创板 |
| 2026-09-04 | daily | 5 行，另含股票回购与股票合计 |

以上是 **8 个可返回字段的离散日期**，不是 2005..2026 连续窗口。产生 42 个板块/字段候选、26 个拒绝的非 A 或未明 scope 行；候选数量不是 SSE 日频 coverage。没有把月报、年鉴拆成日频，没有插值、缺日补值或按获取顺序选择 truth。

## 版本化官方日历证据

留存下列完整公告 bytes、文号、正文日期和实际休市/开市原文 locator：

- [上证公告〔2019〕65号，2019-12-20](https://www.sse.com.cn/disclosure/announcement/general/c/c_20191220_4969627.shtml)：原全年安排中的春节后开市日为 2020-01-31。
- [上证公告〔2020〕6号，2020-01-27](https://www.sse.com.cn/disclosure/announcement/general/c/c_20200127_4991582.shtml)：春节休市延长至 2 月 2 日，2 月 3 日开市；正文直接调整的春节专门公告为〔2020〕3号，本轮未声称已归档该专门公告或所有例外通知。
- [2020-02-02 业务衔接通知](https://www.sse.com.cn/aboutus/mediacenter/hotandd/c/c_20200202_4991648.shtml)：部分原接口文件日期仍保持 1 月 31 日，进一步证明“接口含日期”不等于当天交易。

`sse-2020-holiday-revision-6-bounded-v1` 仅映射公告明确覆盖的 **2020-01-31..2020-02-03**：前三天休市、2 月 3 日开市，已证明子窗口交易日分母为 **1**。没有用 weekday 算法扩展到全年；旧的 1 月 31 日开市安排保留在 evidence 并由修订覆盖。

这一 source calendar 使用公告的中文日期原文定位。现有 R2-A 日历 validator 要求 ISO 日期字面出现在 locator 原文中，因此它**尚不能直接成为 R2-A calendar**：`r2CalendarStatus=BLOCKED_LITERAL_ISO_LOCATOR_REQUIRED`。未伪造含 ISO 日期的官方原文、未修改共享 validator。source 受控日历窗口成立，不等于 R2 历史 dataset 准入成立。未来若需要中文日历重放能力，应另行审计兼容扩展，而非绕过现有合同。

完整目标未准入区间：2005-01-01..2020-01-30、2020-02-04..2026-09-04 缺完整官方版本日历；中间受控窗口仍缺市场统计 release 与字段适用性。完整目标的交易日数保持未知。

## 逐字段定义、scope 与 PIT

| 目标字段 | 已有 evidence | 当前 coverage / PIT |
| --- | --- | --- |
| `turnoverValue` | 官方脚本将 `TX_AMOUNT` / `TRADE_AMT` 显示为成交金额、亿元；明确板块列 | PARTIAL；正式 0，strict PIT 0；不合计板块，日历以外还缺跨期 scope/币种/定义适用证明与 release |
| `totalMarketCap` | `MKT_VALUE` / `TOTAL_VALUE` 显示为市价总值、亿元 | PARTIAL；正式 0，strict PIT 0；不能用 negotiable 或合计列替代 |
| `negotiableMarketCap` | `NEGOTIABLE_VALUE` / `NEGO_VALUE` 显示为流通市值、亿元 | PARTIAL；正式 0，strict PIT 0；API 对应的非限售/可流通定义适用性未闭合，不能当作 free-float |

定义线索另登记于 contract 的 `definitionReferences`，角色是 discovery-only，未计入正式 evidence 覆盖：[SSE 2020-12 统计月报](https://star.sse.com.cn/aboutus/publication/monthly/documents/c/10061130/files/ad36978c88b94bf789a19df338d99416.pdf) 区分发行数量与可流通数量；[SSE 2020/2019 年度概观](https://www.sse.com.cn/aboutus/publication/yearly/documents/c/10061073/files/3434d1799d1145dc826c16c34bd097bf.pdf) 有非限售市值与 `Negotiable Cap` 对应。它们支持自身报表术语，不自动证明目标 API 跨期适用，更不提供日频观测。

已记录的 breaks / 未证明事项：

1. 2019-07-22 官方脚注明确股票合计为主板 A + 主板 B + 科创板，并排除回购。`40` / `17` 合计、B 股、回购和未知 `12` 均不能冒充 A-only；基金/债券/未知产品码也不会被接收为 A 行。
2. 2020-05-01 官方脚注针对换手率口径，**不据此声称三个金额字段发生定义变化**，也不计算任何比率。
3. legacy 脚本声明历史截止 2022-01-03，实际 2021-12-31 空返回，new family 在 2022-01-04 有响应。迁移相邻日完整性、最早/最晚可用日期和两套字段跨期一致性仍未证明。
4. `CAL_DATE` / `TRADE_DATE` 只有统计数据日期；两套响应无已审计的官方发布时间字段。获取时间、URL 日期、页面 metadata、HTTP Last-Modified 和日历公告发布时间均不借给市场统计。没有创建假的 R2 `releaseEvents`、`fieldExtractions` 或正式 `ExchangeMarketObservation`。
5. 同日重复/冲突行全部保留并标记 conflict，不按第一行/最后一行取 truth；缺字段只阻断相应字段。正式 first-release、revision archive 完整性、定义适用性及完整日历仍是 blockers。

## 实现、重放与验证

- `sse_source.py`：严格 JSON（拒绝重复 key、非有限值、非 JSON）、接口/date/产品码校验、原始 row byte locator、逐字段候选、冲突与 missing、source calendar、只读 `SSEHistoricalMarketAdapter`。
- `sse_inventory.py`：显式 bounded fetch、原始获取记录与 immutable 缓存检查、确定性 build、完整 bytes 重放 validate、compact 结构/ID 唯一性/hash/派生状态检查。artifact identity 重算与官方 URL 检查在 full validate 中。artifact/binding/retrieval 使用既有 R2-A schema；无 release 的 raw 响应使用独立 `INVENTORY` evidence，不能伪装为 event artifact。
- `sse-source-contract.v1.json`：外部审查输入，固定完整目标、官方请求、两个 parser family、日历 proof、字段阻断与 source breaks。候选不是另一套正式 observation 合同。
- business hash 绑定完整 contract、calendar/proof、release/binding/extraction sidecar（当前 release/extraction 为空）、源映射、候选、scope、原始 SHA 与获取 provenance；仅排除生成时间和 hash 自身。复用 R2 release/artifact identity 的测试确认相同 bytes 不折叠不同 release event。
- committed 三份官方响应复制件具有独立 `TEST_FIXTURE_EXCERPT` provenance，仅用于 parser regression，不从 fixture 路径构建正式历史 coverage。

```text
npm run data:fetch:market-regime:sse
npm run data:build:market-regime:sse
npm run data:validate:market-regime:sse
npm run data:validate:market-regime:sse:compact
npm run test:market-regime:sse
```

完整 validate 必须拥有本次留存的 ignored 原始 bytes 和 acquisition metadata。fresh checkout 的 compact 验证仅校验提交快照，不宣称已经重新获取/重放原始网页。网页后续改变时，重新抓取不保证重建相同 artifact；不得覆盖 sealed inventory 来隐藏变化，需新版本。fetch 对既有获取只核验缓存 bytes，不改写原获取时间、不把缓存伪装成新 HTTP 200。

| 必要验证 | 结果 |
| --- | --- |
| SSE 专项 | PASS，22 tests；包含 scope 混合、total/negotiable/free-float 混淆、节假日/缺日历、tradeDate 非 release、同日冲突、相同 bytes 不同 event、逐字段 missing、hash 敏感性、fixture/current-only 排除，以及重算 hash 后伪造 coverage/calendar 状态的拒绝 |
| SSE build / full validate / compact | PASS；原始响应、locator、外部 contract 与全部输出重建一致；admission 仍 PARTIAL |
| historical | PASS，66 tests |
| PBC | PASS，69 tests |
| 全部 CSRC（`test_market_regime_csrc*.py`） | PASS，183 tests |
| catalog | PASS，48 tests |
| 标准 `npm test` | FAIL，两个既有 nested-worktree discovery 文件 `No test suite found`；101 suites / 1661 tests PASS |
| `npm test -- --exclude 'data-cache/**'` | PASS，主仓 39 suites / 597 tests；未修改标准 discovery 规则 |
| `npm run build` | PASS，TypeScript / Local Core / Vite / financial bundle gate；既有 chunk warning |
| `npm run data:audit` | PASS，errors 0、warnings 24；生成的旧审计文档日期/扫描数/行号变动已恢复，不回写历史审计 |
| 两种 env checks | READY WITH WARNINGS，48 PASS / 10 WARN / 0 FAIL / 4 SKIP；既有 runtime 多路径、依赖、ignore、旧生成物和公告 partial 等警告 |
| `git diff --check` | PASS |

本地独立审查发现 compact validator 可被重封 hash 的虚假 coverage/calendar 摘要绕过，已修复为完整 coverage、子窗口计数、未准入窗口和日历状态精确校验，并新增反例。没有因此降低现有测试或 R2 门禁。

停止点：普通 commit + push，核验 local HEAD / remote SHA、一致的 0/0 ahead/behind 和干净工作树后结束。不创建 PR，不 merge，不开始 SZSE/BSE/D2；无 all-A、normalization、backtest 或 UI。
