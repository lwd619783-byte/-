# A 股机构一致预期 Provider V1：公开源契约审计与终局设计

## 一句话结论

**最终源结论：`NO_GO`。** 截至 2026-07-22，东方财富与同花顺公开、免登录页面可以作为人工核验线索和 source-probe 对象，但不能共同满足正式 Provider 的不可绕过契约：高覆盖公司无法取得可重算的完整机构明细，东方财富明细均值与其聚合值不闭合，同花顺高覆盖明细只展示 10 家且页面“净利润”未证明为归母口径，跨源 EPS 还出现重大差异；公开可访问也不等于已取得自动抓取、派生存储和内部长期使用授权。

因此本轮不实现 Provider、不写入任何自动一致预期数字、不修改 App、数据源注册表、默认 `data:refresh` 或 Provider Stability Gate。后续只能在取得经授权的完整明细源、内部 CSV 导出或商业数据库适配器后，按本文契约重新过源准入门。

## 1. 审计范围与基线

- 仓库：`lwd619783-byte/-`
- 分支：`feat/a-share-institution-consensus-provider-v1`
- 起点：`origin/main@c1b11ccd0e746bd5e63a144e158b21f05ba667e2`
- 股票池：已提交 `stock-universe.generated.json` 中 56 家 A 股；港股 3 家不在范围内。
- 探测截止日：2026-07-22，时区 `Asia/Shanghai`。
- 只探测免登录、免 Cookie、免 Token、免付费订阅、无需绕过访问控制的公开页面和公开请求。
- 原始响应只保存在 gitignored `data-cache/a-share-institution-consensus-probe/`；不提交完整 HTML、完整 JSON 响应、研报正文、摘要、请求头、Cookie 或个人数据。
- source-probe 使用固定 UA、15 秒 timeout、最多 1 次重试、0.6 秒串行间隔；本轮 7 家 × 3 个请求共 21 个请求，全部 HTTP 200、全部首试成功。

## 2. 现有架构审阅

### 2.1 可以直接复用的 Provider 基础设施

| 能力 | 现有实现 | 可复用边界 |
|---|---|---|
| 通用预期事实模型 | `EarningsExpectationSnapshot`、不可变纠错链、Schema V2 时间语义 | 股票、报告期、期间口径、指标、币种、单位、来源、业务时间、本地纠错可复用 |
| Comparison | `earningsExpectationComparisonProvider.ts` | 同股票、同报告期、同 scope、同指标、同口径、事前有效性、近零/跨符号保护可复用 |
| ResearchEvent / ReviewTask / KPI | `earningsExpectationEventProvider.ts`、`reviewTaskProvider.ts`、`App.tsx` | 事件稳定身份、warning、阈值任务和 KPI 汇总框架可复用，但业务修订关系必须 Provider 化 |
| 本地证据隔离 | Repository / Store / JSON / CSV 校验 | `ingestionMethod=provider` 被 Store 拒绝，Provider 只在运行时聚合，不进入 LocalStorage |
| 只读 Provider Loader | 公司指引 manifest → workflow → detail Loader | checksum、byte size、allowlist、cache、in-flight、epoch、stale 请求防护、`allSettled` 隔离可复用 |
| 证据关系 | `aggregateEarningsExpectationEvidence` | Provider 与本地证据并存、Provider snapshot ID 集合、重复/冲突事件框架可复用 |
| 离线验证与审计 | generator/validator、`data-audit`、bundle check、CI | 事实源独立反算、正式产物确定性、失败关闭、生产 mock 与缺失转 0 门禁可复用 |
| 跨日稳定性观察 | `provider_observability/**`、`observe-providers.py` | 隔离生成、工作树/生产产物不变、run ledger、失败分类和资格评估思想可复用 |

### 2.2 仍与公司指引强耦合的契约

1. `EarningsExpectationProviderSnapshot` 不是 Provider 中立记录：顶层强制 `sourceAnnouncementId`、`sourceAnnouncementType`、`officialSourceUrl`、`officialPdfUrl`、`sourceDate`、公告解析状态、原文 hash、公告修正候选和公司指引 warning。
2. `EarningsExpectationSnapshot` 虽把公告字段声明为 optional，但 Provider 事件、PDF、关联公告和业务修订逻辑仍读取这些字段，类型 optional 不等于运行时中立。
3. `companyGuidanceExpectationRecordContract.mjs` 将 Provider ID、版本、指标、期间口径、公告类型、巨潮 URL、CNY/yuan/PRC_GAAP 区间、原文、原单位和公告业务修订全部固定为公司指引产品契约；它不能直接验证机构一致预期。
4. `companyGuidanceExpectationSelection.mjs` 的 target/exclusion/warning/manifest 投影以公告 ID 为集合主键；机构报告集合不能伪装成公告 target。
5. `deriveExpectationBusinessRevisionDelta` 对任何 `ingestionMethod=provider` 都要求 `sourceAnnouncementType=earnings_preview_revision` 且前序等于 `providerBusinessRevisionPredecessorSnapshotId`。未来一致预期若直接进入当前函数，会被错误当成业绩预告修正公告。
6. `buildProviderContentConflictEvents` 只识别 `company_guidance + 巨潮公告 URL`；未来本地 `institution_consensus` 与自动一致预期必须使用独立稳定身份，不能沿用公告关系公式。

### 2.3 App 中会复制第二套状态机的部分

`App.tsx` 当前直接持有公司指引 Loader、request generation、workflow、workflow status/error、details、detail status/error、failed stock IDs 和 retry token，并用两个 `useEffect` 分别加载 workflow 与按需 detail。若直接增加一致预期 Provider，会自然复制：

- Mock 隔离和模式切换清理；
- workflow 加载、错误、重试；
- 详情按需选择与失败隔离；
- generation/stale 防护；
- Provider records 合并和 snapshot ID 集合；
- 本地关系、内容冲突和 UI 状态投影。

这部分应在未来单独的 Provider 中立重构中抽为多 Provider runtime；本轮按用户边界不修改 App，也不提前实现该重构。

### 2.4 LocalStorage 与只读 Provider 的隔离边界

- 本地用户证据存放在 `investment-research-dashboard.earnings-expectation.v1`，容器 schema 为 V2；Provider 产物不属于该 envelope。
- `EarningsExpectationStore.appendSnapshot` 与 `appendCorrection` 明确拒绝 `ingestionMethod=provider`。
- JSON/CSV 导入、Repository 校验和纠错图不能成为 Provider 快照旁路；未来 Provider 记录也不得通过导入伪装成本地证据。
- 运行时聚合可同时展示本地和 Provider 快照，但 `comparisonSnapshots` 只能排除有稳定证据身份支持的重复项；公司名相同或数值接近不能作为重复依据。
- 本地 `correctsSnapshotId`、Provider extraction correction 和 Provider 业务修订必须是三条不同的图。

### 2.5 Comparison、ResearchEvent、ReviewTask、KPI 的修订假设

- Comparison 本身大体 Provider 中立，但仍要求 metric/unit/accounting basis 明确、实际值来源可靠、证据严格早于业绩信息披露；一致预期不能因“来源是 Provider”而自动获得可比资格。
- ResearchEvent 把 Provider 记录统一显示为 `parse_success`，并尝试附公告 ID/PDF；未来应由 Provider adapter 给出 parse/evidence 状态，通用事件层不得猜公告语义。
- ResearchEvent 当前从业务时间偏序推导唯一前序，再调用上述公司指引专属 Provider 分支；非公司指引 Provider 在没有显式、已验证业务前序关系时必须只生成 warning，不生成上调/下调。
- ReviewTask 和 KPI 依赖 `businessRevisionDelta` 及 10% 默认阈值。只要前序关系不可信，方向、幅度、任务和 KPI 都必须为空，不能用相邻抓取结果补造修订。
- 公司指引的 extraction correction 事件已经独立存在；一致预期也必须保持 parser correction、上游报告变化、无变化再发布和用户 correction 的分离。

### 2.6 数据审计、Bundle、CI、Developer Health 与 Stability Gate

- `data-source-registry.ts` 继续把 `institution-consensus` 与 `eps-net-profit-forecast` 标为 `not_implemented`、不展示；本轮不得提前改状态。
- `data-audit` 会阻断注册表结构/路径/来源错误、生产 mock、财务/估值/预测缺失转 0。source-probe 只在 `scripts/` 和 fixture 中，不产生正式数据源注册项。
- 正式 Provider 若存在，必须使用 summary/manifest/detail 或等价的可校验分层；bundle 只允许同步加载摘要/工作流所需最小记录，完整机构明细不能静态进入前端 bundle。
- CI 当前运行公司指引 generator check、validator、Provider tests、observability、data audit、全量测试和 build。未来一致预期正式接入前必须增加独立离线 validator/check；本轮不修改 CI。
- Developer Health Gate 会核对 package script、默认刷新、CI scripts、股票池与现有 Provider；不能为消除 warning 放宽门禁。
- `config/provider-stability-gate-v1.json` 当前正式 providers 只有财务和公告。本轮既不加入一致预期，也不宣称观察资格通过。

## 3. 候选公开源实测

### 3.1 样本覆盖

| 代码 | 公司 | 市场/板块覆盖 | 研究链条 | 覆盖角色 |
|---|---|---|---|---|
| 601138 | 工业富联 | 沪市主板 | AI 服务器/消费电子 | 高覆盖 |
| 002463 | 沪电股份 | 深市主板 | 高端 PCB | 高覆盖 |
| 300502 | 新易盛 | 创业板 | 光模块 | 高覆盖、跨源差异样本 |
| 688165 | 埃夫特 | 科创板 | 工业机器人 | 无预测样本 |
| 603259 | 药明康德 | 沪市主板 | CXO/创新药服务 | 高覆盖、跨行业 |
| 605288 | 凯迪股份 | 沪市主板 | 线性驱动 | 单机构低覆盖、可重算样本 |
| 603286 | 日盈电子 | 沪市主板 | 汽车电子/传感主题 | 无预测样本 |

样本同时覆盖沪市主板、深市主板、创业板、科创板，高覆盖、低覆盖和无预测三类状态；没有用池外热门股替代当前 56 家产品边界。

### 3.2 2026 年度关键观测

下表仅是 2026-07-22 当次契约审计结果，不是生产数据，不进入看板或长期投资结论。

| 代码 | 东财机构数 | 东财聚合 EPS | 东财六个月报告数/去重机构 | 东财明细重算均值 | 与聚合 3 位小数闭合 | 同花顺机构数/可见机构 | 同花顺聚合 EPS | 同花顺页面净利润 | 同花顺可重算 |
|---|---:|---:|---:|---:|---|---:|---:|---:|---|
| 601138 | 21 | 3.0761 | 8 / 5 | 3.1104 | 否 | 21 / 10 | 3.08 | 611.40 亿元，口径未限定 | 否，明细截断 |
| 002463 | 19 | 3.005789473684 | 6 / 6 | 2.973333333333333 | 否 | 22 / 10 | 3.00 | 57.64 亿元，口径未限定 | 否，明细截断 |
| 300502 | 19 | 18.316111111111 | 5 / 4 | 20.3125 | 否 | 20 / 10 | 13.77 | 188.25 亿元，口径未限定 | 否，明细截断 |
| 688165 | 0 | 空 | 0 / 0 | 空 | 不适用 | 0 / 0 | 空 | 空 | 页面明确“本年度暂无机构做出业绩预测” |
| 603259 | 30 | 5.951068965517 | 9 / 7 | 5.8585 | 否 | 30 / 10 | 5.97 | 177.99 亿元，口径未限定 | 否，明细截断 |
| 605288 | 1 | 1.15 | 1 / 1 | 1.15 | 是 | 1 / 1 | 0.82 | 0.81 亿元，口径未限定 | 是，但不足 3 家且跨源不同 |
| 603286 | 0 | 空 | 0 / 0 | 空 | 不适用 | 0 / 0 | 空 | 空 | 页面明确无预测 |

关键事实：

1. 四个高覆盖样本的东财 report-list 只能得到 4-7 家去重机构，远少于聚合端 19-30 家；按“同机构取窗口内最新报告”重算后，4/4 均不能与聚合 EPS 在 3 位小数闭合。
2. 同花顺四个高覆盖样本均只在初始 HTML 中展示 10 家明细，聚合机构数为 20-30 家，故均值、最小值、最大值、未来要求的中位数和标准差无法从完整明细独立反算。
3. 单机构凯迪股份在各自源内可重算，但两个源的 2026 EPS 分别为 1.15 和 0.82；单机构本身也低于正式一致预期最低 3 家门槛。
4. 新易盛两个源的 2026 聚合 EPS 分别为 18.316111111111 和 13.77。当前公开字段不足以证明差异来自报告集合、复权/股本口径、更新时间还是字段错误，因此只能标为未解决冲突，不能择一写入生产。
5. 同花顺公开页面使用“预测年报净利润（元）/预测净利润”标签，没有稳定字段证明它必然等于 `attributable_net_profit`。本轮不得把它升级为“归母净利润”。

### 3.3 东方财富公开源契约

公开回溯页：`https://data.eastmoney.com/report/{code}.html`

本轮实际调用的两个免登录公开请求：

- 聚合：`https://datacenter-web.eastmoney.com/api/data/v1/get`，`reportName=RPT_WEB_RESPREDICT`、`columns=WEB_RESPREDICT`、按 `SECURITY_CODE` 过滤；
- 报告列表：`https://reportapi.eastmoney.com/report/list`，按代码、开始日、结束日查询。

字段能力：

| 字段 | 聚合请求 | report-list | 结论 |
|---|---|---|---|
| 股票代码/公司身份 | 有 | 有 | 可校验 |
| 预测年度 | `YEARn` | `currentYear` 相对字段 | 有，但两接口的年度映射需独立校验 |
| EPS | 有聚合值 | 有单报告值 | 可读，不代表聚合可重算 |
| 归母净利润 | 无 | 无 | 不可用 |
| 机构名称 | 只有机构数/评级数 | 有 | 明细集合不完整 |
| 分析师 | 无 | 有 | 明细集合不完整 |
| 报告日期 | 无 | 有 | 日期精度，无时分语义 |
| 同机构重复报告 | 聚合不可见 | 实测存在 | 必须去重；本轮 3 个样本出现重复机构 |
| 近六个月证明 | 页面文案声称“近六个月”，聚合响应本身无截止日 | 查询窗口由客户端传入 | 聚合值的精确窗口/截止版本无法由响应独立证明 |
| 聚合重算 | 不可 | 可重算可见子集 | 高覆盖样本全部不闭合 |
| 原始单位 | EPS/股 | EPS/股 | 可明确；无净利润单位 |
| 缺失 | `null` / 空 result / code 9201 | 空字符串、空列表 | 必须保留 null/no_forecast，不转 0 |
| 公开回溯链接 | 有股票研报页 | 报告有 ID，但本轮不保存正文链接 | 股票页可回溯 |

稳定性观测：本轮全部 HTTP 200、无重试、未遇到 429/验证码；但一次成功只证明当次可访问。聚合与报告列表集合不闭合属于结构性阻断，不能被“HTTP 成功”掩盖。

### 3.4 同花顺公开源契约

公开回溯页：`https://basic.10jqka.com.cn/{code}/worth.html`

字段能力：

| 字段 | 页面情况 | 结论 |
|---|---|---|
| 股票代码/公司身份 | title 与页面代码 | 可校验 |
| 截止日/窗口 | 明确显示“截至 YYYY-MM-DD，6个月以内” | 比东财聚合响应更清晰 |
| EPS | 聚合表与明细表 | 可读 |
| 净利润 | 聚合表与明细表，单位亿/元展示 | 有数值但未证明为归母口径 |
| 机构/分析师/报告日期 | 明细表有 | 高覆盖只展示 10 家 |
| 同机构重复报告 | 可见表中未出现；无法证明隐藏集合无重复 | 不能据此确认去重规则 |
| 聚合重算 | 1 家样本可闭合 | 高覆盖因明细截断不可重算 |
| 最小/均值/最大 | 聚合表有 | 是分布统计，不是预测区间 |
| 中位数/标准差 | 页面无 | 只有完整明细才能计算；当前不可得 |
| 缺失 | null、`--`、空表、明确“本年度暂无机构…” | 必须保留 no_forecast/null |
| 页面结构 | 服务器返回 GBK HTML，多表固定次序 | 能解析，但结构漂移风险高 |

补充风险：AKShare 当前 `/new/{code}/worth.html` 路径在本轮观测中重定向到 HTTP；直接使用 `https://basic.10jqka.com.cn/{code}/worth.html` 才保持 HTTPS。本 source-probe 拒绝重定向和非 HTTPS 最终地址。

### 3.5 AKShare 当前实现仅作结构参考

本机审计版本：AKShare `1.18.64`。

`stock_profit_forecast_em`：

- 直接包装 `RPT_WEB_RESPREDICT`，`symbol` 实际是行业板块名而不是股票代码；
- 输出聚合 EPS、评级机构数和评级数量，不提供机构/分析师/报告日期/净利润；
- 没有显式 timeout、有限重试或本项目 UA；
- 按固定列位置整体重命名，字段增删/顺序漂移风险高；
- 将部分评级缺失填为 0，不能照搬到本项目的证据缺失语义。

`stock_profit_forecast_ths`：

- 请求 `/new/{symbol}/worth.html`，设 GBK 后按固定 `read_html` 表序号读取；
- 没有显式 timeout、有限重试、身份校验、重定向安全或 schema fail-closed；
- 它能暴露页面聚合/明细表，不会补齐页面未返回的隐藏机构集合，也不会自动取得授权；
- AKShare 存在接口只说明有人封装了公开页面，不构成商用、稳定、完整或许可证明。

## 4. `NO_GO` 判定与替代方案

### 4.1 不可绕过的阻断项

| gate | 要求 | 当前结果 |
|---|---|---|
| 完整明细 | 可获得窗口内全部机构报告 | 失败：东财 report-list 少于聚合机构数；同花顺高覆盖只展示 10 家 |
| 聚合可重算 | 均值可由去重明细独立反算 | 失败：东财高覆盖 4/4 不闭合；同花顺高覆盖不可重算 |
| 指标口径 | EPS 与归母净利润定义可证明 | 失败：东财无净利润；同花顺仅“净利润”未证明归母 |
| 跨源一致性 | 重大差异可解释或有权威主源 | 失败：新易盛、凯迪股份出现显著差异且无足够字段解释 |
| 版本/截止语义 | 能确定具体报告集合和快照截止 | 失败：东财聚合响应无独立截止/成员集合；同花顺隐藏集合不可见 |
| 授权 | 允许自动抓取、派生保存、长期内部使用 | 未证明：公开可访问不等于授权 |
| 稳定性 | 跨日至少 5 天/10 次且字段不漂移 | 未开始：单次探测不得冒充资格 |

任一前三项失败就足以 `NO_GO`；本轮不是因为临时网络失败而保守停止，而是因为数据契约本身无法支持正式一致预期算法。

### 4.2 推荐替代方案

优先级从高到低：

1. 经授权的商业数据库适配器，要求可导出机构级明细、报告 ID、机构 ID、分析师、报告日期、预测年度、EPS、明确归母净利润口径、单位和版本/更正字段；
2. 已获授权的内部终端导出 CSV/JSON，由离线 adapter 导入 Provider staging；
3. 研究团队维护的内部 CSV，只接受可回溯来源与明确口径，继续标识为内部授权数据，不包装成公开网页 Provider；
4. 公开网页继续只做交叉核验与 source health，不作为生产一致预期事实源。

替代源必须先用本文第 5-8 节契约重新审计；不得因换成 CSV 就跳过身份、时间、去重、版本和授权门禁。

## 5. 解锁后的精确 V1 范围

当前 `NO_GO` 下允许生产的自动一致预期记录数量为 **0**。只有阻断项全部解除后，候选 V1 才允许：

- 市场：当前已提交 56 家 A 股；每家公司必须有状态记录，允许 `no_forecast`，不要求每家都有数值。
- 期间：仅 `full_year`，`reportPeriod` 固定对应年度 `YYYY-12-31`。
- 指标：只允许 `eps`。
- 归母净利润：**不进入 V1**。必须等新源以稳定字段明确证明 `attributable_net_profit`，且机构级明细、原单位和聚合重算全部闭合后另开范围审计。
- 明确排除：港股、季度/单季/累计期、收入、扣非净利润、目标价、评级、研报正文/摘要、投资建议。
- 正式一致预期最少 3 家不同机构；1-2 家只保留 coverage/status，不生成 consensus snapshot。

## 6. 一致预期算法契约

### 6.1 窗口与截止日

- 工作时区固定 `Asia/Shanghai`。
- `cutoffDate` 是 Provider 本次快照的业务截止日，不等于抓取时刻。
- 窗口为 `[cutoffDate 往前 6 个日历月的同日, cutoffDate]`，两端包含；月底使用目标月最后一个有效日。
- 只有上游 `reportDate` 明确且落入窗口的记录才能参与；日期为空、未来日期、非法日期均排除并记录原因。
- 上游若只给日期精度，不得伪造时分秒，也不得用抓取时间替代报告日期。

### 6.2 同机构去重与名称规范化

- 最优身份是上游稳定 `institutionId`；没有稳定 ID 的源不通过正式准入。
- 显示名保留原文；身份名只做 NFKC、首尾空白去除、连续/全角空白压缩和英文大小写折叠。
- 不把“中信”“中信证券”“中信证券股份有限公司”模糊合并；别名映射必须是独立、版本化、人工审计表。
- 同一机构、同一股票、同一年度、同一指标在窗口内只取报告日期最新记录；同日用稳定 report ID 决胜。
- 同日多条且无稳定 report ID，整个机构-指标单元失败关闭，不能任意取数组最后一条。

### 6.3 统计量、舍入和单位

- 去重后有效机构数 `N >= 3` 才生成正式快照。
- 计算 `mean`、`median`、总体标准差 `populationStdDev`、`minimum`、`maximum`；所有统计量都来自同一去重集合。
- EPS 原始单位必须明确为 `CNY/share`，以十进制定点数归一；归一前保留原始文本/原单位 hash，但不保存研报正文。
- 统计在未舍入 Decimal 上计算；canonical checksum 使用规范十进制字符串，不使用二进制浮点展示串。
- 正式通用 Snapshot 的 `value=mean`，`estimateShape=point`；UI 默认最多显示 4 位小数并保留“源展示舍入值 vs 重算值”的审计字段。
- `minimum`、`maximum`、`median`、`populationStdDev` 属于共识分布元数据，不能写入 `lowerBound` / `upperBound`。通用 range 表示一个预测本身的区间，不表示机构横截面的极值范围。

### 6.4 异常值与空值

- `null`、空字符串、`--`、`-`、false、NaN、Infinity 保持缺失；绝不转 0。
- 非数字、单位缺失、年度错位、股票身份错配、报告日期非法、指标口径不明：排除单条并记录结构化 reason。
- 合法有限数值不做静默 winsorize 或截尾；极端值保留在候选集合并产生 warning。
- EPS 与净利润/股本关系出现大幅矛盾、公司发生送转/拆并股而源未给 denominator basis、跨源差异无法解释时，整条 metric snapshot 进入 quarantine，不生成正式点值。
- 排除后 `N < 3` 时状态为 `insufficient_institutions`，不降低阈值。

## 7. 时间与历史语义

必须分别保存：

- `upstreamReportDate`：机构报告日期，通常 date precision；
- `providerFetchedAt`：HTTP 响应取得的精确时刻；
- `firstObservedAt`：本系统第一次看见该上游报告/该快照版本的精确时刻，不随 no-op 重跑更新；
- `providerGeneratedAt`：本轮正式产物发布时刻，可在 no-op 发布时更新；
- `consensusCutoffDate`：一致预期集合的业务截止日；
- `snapshotFormedAt`：只有上游能提供可验证精确形成时刻才填写，否则为 null；`asOfDate=consensusCutoffDate`。

不允许反向补造历史一致预期：今天第一次看到的当前网页不能证明网页在一个月前包含相同报告集合和值。系统只能从 `firstObservedAt` 开始向前追加真实观测快照；历史导入必须来自带原始截止日和版本证明的经授权导出，并使用独立 migration/audit 流程。

## 8. 身份、版本与修订语义

### 8.1 建议身份公式

```text
providerSeriesIdentity = sha256(canonicalJson({
  providerId, stockId, sourceCategory: "institution_consensus",
  reportPeriod, periodScope: "full_year", metric,
  currency: "CNY", unit: "currency_per_share", accountingBasis,
  windowPolicyVersion, institutionNormalizationVersion
}))

upstreamReportIdentity = sha256(canonicalJson({
  providerId, stockId, upstreamInstitutionId, upstreamReportId,
  upstreamReportDate, reportPeriod, metric
}))

providerEvidenceIdentity = sha256(canonicalJson({
  providerSeriesIdentity, consensusCutoffDate,
  sortedUpstreamReportIdentitiesAfterDedup
}))

providerContentChecksum = sha256(canonicalJson({
  providerEvidenceIdentity,
  sortedNormalizedInstitutionForecasts,
  mean, median, populationStdDev, minimum, maximum,
  institutionCount, parserRulesVersion
}))

providerSnapshotVersionId = "institution-consensus-version-" + sha256(canonicalJson({
  providerEvidenceIdentity, providerCorrectsVersionId, providerContentChecksum
}))

providerVersionEventId = sha256(canonicalJson({
  providerId, providerEvidenceIdentity,
  providerCorrectsVersionId, providerSnapshotVersionId
}))
```

`providerSeriesIdentity` 表示业务系列，`providerEvidenceIdentity` 表示某个截止日和成员集合，`providerContentChecksum` 表示规范内容，`providerVersionEventId` 表示不可变版本事件；四者不能压成一个 ID。

### 8.2 四类变化

1. **上游业务变化**：新增/到期报告改变去重集合，或机构发布新的明确 report ID；形成新的 consensus business snapshot，可在业务顺序唯一时指向前一 snapshot。
2. **Provider extraction correction**：同一证据集合因 parser/单位/映射修复改变规范内容；使用 `providerCorrectsVersionId`，不产生上调/下调业务修订。
3. **上游 source correction**：同一 upstream report ID 被源站改值但没有新业务报告身份；单独标记 `source_correction`，保留前后内容和首次观测时间，也不默认当业务修订。
4. **无变化重新发布**：成员集合和内容 checksum 不变，保留 version ID、firstObservedAt、纠错关系；只更新本轮 `providerGeneratedAt`，不产生事件。

只有 Provider adapter 提供经验证的业务前序关系，通用层才允许生成方向性 `businessRevisionDelta`。按抓取时间相邻、数值相近或同公司相同年度都不足以证明业务修订。

## 9. 未来正式产物与运行时接入要求

在授权源解锁后，正式实现至少需要：

```text
staging/raw/                     # gitignored/受控，禁止进入前端
normalized/institution-records  # 机构级规范记录与 reason，不含研报正文
public/data/a-share-institution-consensus/
  manifest.generated.json
  workflow-index.generated.json
  <stockId>.json
src/data/real/a-share-institution-consensus-summaries.generated.json
```

- generator 必须原子发布、确定性、支持 `--check`，并从上游授权文件/缓存独立重建。
- validator 必须反向枚举文件集合、重算 byte size/checksum/统计量/身份/版本图，不信任 summary 自报计数。
- workflow index 只带当前工作流所需最小记录；机构级明细按公司懒加载，完整原始导出不进 bundle。
- 多 Provider runtime 统一管理 workflow、status/error/retry、Mock 隔离、cache/epoch/stale、records 合并和冲突；App 不增加第二套平行 `useEffect`。
- 公司指引 Manifest/Workflow/Detail/checksum/cache/epoch/stale 契约不得退化，现有 59 个正式产物不得因重构产生字节变化。

## 10. Provider Stability Gate 候选观察方案

本轮只设计，不修改 `config/provider-stability-gate-v1.json`，不加入默认刷新，也不宣称资格通过。

授权源和正式离线 validator 完成后，候选观察应：

1. 使用独立 gitignored observation root，不修改生产产物和工作树；
2. 每次覆盖 56 家状态文件，`no_forecast` 是有效状态但不是数值成功；
3. 至少沿用当前门槛：5 个不同自然日、每 Provider 10 次、5 个成功日、完整成功率 ≥ 90%、总成功率 ≥ 95%、最新一次成功；
4. 额外记录：HTTP 状态、timeout/429/验证码、redirect、schema drift、字段缺失、授权导出版本、56 家身份覆盖、报告集合增删、同机构重复、完整明细率、聚合重算率、跨源差异、单位/口径 quarantine、artifact checksum、运行时长；
5. 任一公司身份错配、完整明细率 < 100%、正式统计不可重算、归母口径不明、版本图断裂或生产产物被观察任务修改，均为 blocking failure；
6. 观察通过后仍需独立产品准入评审，不能自动把 Provider 加入默认 `data:refresh`。

## 11. Source-probe 工具与离线测试

新增内容：

- `scripts/probe-a-share-institution-consensus.py`：只做公开源契约探测，不生成 Provider 产物；
- `scripts/a_share_institution_consensus_probe/core.py`：字段解析、单位归一、去重、统计、THS 最小表格抽取和失败关闭契约；
- `scripts/tests/fixtures/a-share-institution-consensus-probe.minimal.json`：最小化、脱敏、结构化、无研报正文 fixture；
- `scripts/tests/test_a_share_institution_consensus_probe.py`：离线测试缺失、非有限数、单位、统计、同机构去重、身份错配、字段缺失、THS 完整/截断/no_forecast 和结构漂移。

安全边界：

- 仅 HTTPS；拒绝重定向，不跟随 `/new/` 到 HTTP；
- 固定 UA；timeout；最多 2 次有限重试，默认 1 次；串行 delay；
- 不设置 Cookie/Authorization，不处理验证码，不并发；
- 原始缓存必须位于 gitignored `data-cache/`；
- 输出明确 `probeOnly=true`、`providerArtifactsProduced=false`；
- 正式提交只含结构化 fixture，不含真实完整响应和报告正文。

## 12. 下一阶段允许实施的精确范围

由于结论是 `NO_GO`，当前下一阶段**不允许**实现自动机构一致预期 Provider，也不允许执行以 `GO/GO_WITH_LIMITS` 为前提的 Prompt 2。

允许的后续工作只有：

1. 用户/合规负责人确认公开源使用授权，或提供经授权导出/商业数据库访问边界；
2. 对新源重新运行完整明细、聚合重算、指标口径、版本、稳定性和授权审计；
3. 若新设计报告明确升级为 `GO` 或 `GO_WITH_LIMITS`，再单独审阅并启动 Provider 中立架构重构；
4. 在此之前保持注册表 `not_implemented`、不显示自动数字、不修改默认刷新和正式 Stability Gate providers。

本报告只做工程与数据源契约审计，不构成投资建议。
