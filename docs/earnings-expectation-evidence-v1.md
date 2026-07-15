# 业绩预期证据层 V1

## 目标与边界

V1 为人工录入或结构化导入的业绩预期建立可追溯、append-only 的证据链，并在真实财务或业绩快报出现后进行严格同口径比较。它不抓取商业数据库、不保存完整券商研报正文、不绕过登录或订阅限制，也不生成买卖建议。

自动机构一致预期 Provider 尚未实现，数据源注册表继续标记为 `not_implemented`。支持人工录入“有明确来源的机构一致预期”，不等于系统已经接入自动一致预期数据。

## 领域模型

`EarningsExpectationSnapshot` 是不可变事实快照，关键字段包括：

- 身份：`id`、`stockId`、`market`、`schemaVersion`；
- 口径：`reportPeriod`、`periodScope`、`metric`、`currency`、`unit`、`accountingBasis`；
- 数值：`estimateShape`、`value`、`lowerBound`、`upperBound`；
- 来源：`sourceCategory`、`sourceName`、`sourceTitle`、`sourceUrl`、`sourcePublishedAt`、`sourcePublishedAtPrecision`、`sourcePublishedAtResolution`、`sourcePublishedAtTimeZone`、`sourceVerificationStatus`；
- 时间：日期口径 `asOfDate`、可选精确形成时间 `formedAt`、`formedAtPrecision`、`formedAtResolution`、`formedAtTimeZone` 和仅表示录入动作的 `createdAt`；
- 形成信息：`analystCount`、`institutionCount`、`ingestionMethod`、`createdBy`、`notes`；
- 纠错：`correctsSnapshotId`、`correctionScope`（`value` 或 `basis`）。

`EarningsExpectationComparison` 是派生结果，不写回真实财务、公告或快照。它分别保存实际值候选披露时间、任何同指标业绩信息首次披露时间、`actualDisclosureTimingStatus`、`performanceDisclosureTimingStatus`、披露范围不确定标记、`businessOrderStatus`、稳定的比较可用时间，以及预期值、实际值、差异、比较方法和具体不可比较原因。时间审计同时保存 `originalBusinessTime`、`effectiveBusinessTime`、`originalSourcePublishedAt`、`effectiveSourcePublishedAt`、`temporalCorrectionApplied`、`correctedTemporalFields` 与实际来源解释时区。旧布尔字段继续作为兼容视图，`unknown` 不会被强制转换成 `false` 后继续生成方向性结论。

## 来源类别与录入方式

来源类别表示数字是谁形成的：

| `sourceCategory` | 含义 | 强制边界 |
| --- | --- | --- |
| `company_guidance` | 公司业绩指引 | 标记为 `verified` 时必须有来源主体、标题、日期和安全 http(s) 链接 |
| `institution_single` | 单家机构预测 | 标记为 `verified` 时必须有来源主体、标题、日期和安全 http(s) 链接；不得包装成一致预期 |
| `institution_consensus` | 有明确来源的机构一致预期 | 标记为 `verified` 时必须有来源主体、标题、日期和安全 http(s) 链接 |
| `user_estimate` | 用户个人预测 | 显著标识，不得包装成机构预测 |

录入方式表示数字怎样进入本地系统：

- `manual`：表单人工录入；
- `json_import`：结构化 JSON 导入；
- `csv_import`：结构化 CSV 导入；
- `provider`：为未来接口预留。本轮没有自动 Provider，Repository 会拒绝真实 `provider` 记录。

来源类别与录入方式互相独立。通过 CSV 导入的单家机构预测仍是 `institution_single`，通过表单录入的一致预期也不能因此声称自动 Provider 已接入。

## 本地存储与不可变纠错

- LocalStorage key：`investment-research-dashboard.earnings-expectation.v1`
- `schemaVersion`：`1`
- 容器字段：`schemaVersion`、`updatedAt`、`snapshots`、`settings`、`importHistory`
- 替换导入备份前缀：`investment-research-dashboard.earnings-expectation.backup.`

React 组件不直接读写 LocalStorage。Repository 负责读取、迁移、校验、备份和原子写入；Store 只暴露新增快照与新增纠正快照，不提供原地编辑或删除 API。

纠错流程：

1. 保留原快照；
2. 新建快照并填写 `correctsSnapshotId`；
3. 原快照在时间线标记“已被纠正”；
4. 每条独立业务预测是一个业务根节点；根节点的纠正链终点是该节点当前有效的数据版本；
5. 下一条独立业务预测始终与上一业务根节点的当前纠正链终点比较，不与已经失效的根值比较；
6. 默认比较排除已被纠正的旧版本，并在同公司、同报告期、同期间口径、同指标、同来源组内使用最新有效业务节点；
7. 所有历史版本仍可查看。

纠正快照必须保持来源类别和标准化后的来源名称不变。预测形态、币种、单位或会计口径变化会标记为 `basis` 口径纠正，界面不计算或展示业务修订率；其余同口径数值纠正标记为 `value`。派生的 `correctionDelta` 始终相对 `correctsSnapshotId` 指向的快照，记录原值、更正值、数值差、可靠时的相对差、变更字段以及币种/单位/会计口径变化，不会改用时间线上相邻快照。

`businessRevisionDelta` 只描述当前独立业务预测相对上一条同来源、同报告期、同指标、同口径且业务顺序可确认的预测变化。其审计字段同时保存 `previousBusinessRootSnapshotId`、`previousEffectiveSnapshotId`、`currentSnapshotId`、实际使用的 `baselineValue` 以及是否经过纠正链解析。例：A=100、C 纠正 A=110、B=120 时，B 相对 C 为约 9.09%，不会相对已失效的 A 计算 20%。10% ReviewTask 与 KPI 阈值也使用 C。纠正快照、跨口径记录、`equal` 或 `uncertain` 记录均不生成方向性结构。

业务时间采用双轨模型。根快照的可用时间是只读审计值 `originalBusinessTime`；纠正链终点的形成时间与可靠来源发布时间共同决定 `effectiveBusinessTime`，当前排序、最新节点选择、事前判断和后续业务修订均使用有效时间。纠正链可更正 `asOfDate`、`formedAt`、来源发布时间及其精度、解释方式和 IANA 时区，变化汇总到 `correctedTemporalFields`。纠正快照自身不可变的 `createdAt` 才是 `correctionRecordedAt`，只决定纠正事件的 `eventDate`、`publishedAt` 及其是否晚于 `lastReviewedAt`；它不替代预测形成时间。纠正事件 payload 同时保留根快照、当前终点、完整纠正链、原始/有效业务时间、原始/有效来源时间、纠正记录时间、纠正原因和变化字段，绝不把纠正操作包装成新的业务预测。

Repository、Store、JSON 合并、JSON 替换和 CSV 导入共用同一套完整纠正图校验。图约束为：禁止自引用和任意长度循环；一个历史快照最多有一个直接纠正者；每条合法链必须有且只有一个末端。有效版本通过链末端解析，而不是依赖文件顺序。预览分别给出“合并允许”和“替换允许”；跨现有 Store 与导入批次形成的循环或分叉会显示具体节点原因，并原子拒绝对应模式，当前 Store 不写入任何部分链。

损坏 JSON 不会白屏或被静默覆盖。加载结果保留错误和原始文本，用户可导出损坏原文或明确重置。写入失败返回原状态。

V1 schema 仍为 `1`。本轮字段均为向后兼容的保守元数据：快照精度与解释字段可缺省，`settings.timeZone` 缺失时由迁移器补为确定性的 `Asia/Shanghai`；因此无需破坏性提升版本。迁移幂等，旧快照不会用 `createdAt` 推断形成时间：无精确值时按日期精度处理；已有但无偏移且没有原解释时区的 `formedAt` 或来源时间保留原字符串并标记 `unresolved_legacy`。已有快照和导入历史不清空。`snapshots` 缺失或不是数组属于损坏数据，不会迁移为空数组，也不会覆盖原始文本。

## 业务时间、日期精度与工作流时区

应用保存并显示 `settings.timeZone`。业绩预期的人工录入、Store、JSON 与 CSV 时间解析不读取浏览器或 Node 机器时区；无效或缺失配置统一安全回退到 `Asia/Shanghai`。所有“今天”、跨日和同日判断都使用该确定工作流时区，不再把 `createdAt.slice(0, 10)` 当作用户日历日期。

- `formedAt`：预测实际形成的精确时刻。留空时保存 `null` 并使用日期精度的 `asOfDate`；带 `Z` 或偏移的值按绝对时刻处理，其工作流日历日期必须等于 `asOfDate`；无偏移值按记录声明时区、否则按工作流时区解释，且在实际解释时区的日历日期必须等于 `asOfDate`；
- `asOfDate`：只有日期精度时的业务日期，始终保持 `YYYY-MM-DD`，不转换为午夜 UTC；
- `sourcePublishedAt` 输入契约：`YYYY-MM-DD` 保持日期语义；带 `Z` 或明确 UTC 偏移的 ISO 时间按绝对时刻保存且不重新解释；不带偏移的本地精确时间优先按记录合法 `sourcePublishedAtTimeZone`，其次按导入文件或当前 envelope 的工作流时区，最后按确定性 `Asia/Shanghai` 解析为唯一绝对时刻；
- `createdAt`：数据进入本系统的审计时间，只记录系统动作，不参与当前预测、修订幅度、事件顺序或事前有效性判断。

表单、Store、JSON 和 CSV 导入共用上述来源与形成时间解析。无偏移时间禁止使用运行环境的裸 `Date.parse()`；例如工作流为上海、记录声明东京时，`2026-07-15T15:00` 必须解释为东京 15:00，预览明确展示实际解释时区及其与工作流时区的冲突。没有记录声明时才按上海 15:00 解释。任一无偏移精确时间遇到 DST gap 或 overlap 时拒绝写入，要求改用带偏移 ISO 或日期精度。`sourcePublishedAtResolution` / `formedAtResolution` 记录日期、绝对时刻、明确 IANA 时区解析或历史待核验状态；时区解析同时保存实际使用的 `sourcePublishedAtTimeZone` / `formedAtTimeZone`，保存元数据与实际解析时区必须一致。JSON 与 CSV 采用完全相同的优先级和结果。

同一逻辑分组先按业务日历日期排序；双方都有精确 `formedAt` 时再比较时刻。两个绝对时刻完全相同返回 `equal`，不是 `uncertain`；稳定 ID 只负责显示顺序，不能据此生成方向性修订、ReviewTask 或 KPI。若同日任一方只有日期精度，或双方都只有日期精度，返回带 `date_precision` 或 `mixed_precision` 原因的 `uncertain`。日期不同则即使只有日期精度也可以明确比较前后。

`datetime-local` 与无偏移来源时间按工作流 IANA 时区解析后必须完整 round-trip 年、月、日、时、分和秒。DST 春季跳时中的不存在时间返回 `nonexistent` 并阻止提交；秋季回拨的重复时间返回两个候选，V1 不猜测偏移并要求用户调整时间、改用带偏移 ISO 或日期精度。东京、上海等正常时间继续保存唯一 UTC 瞬时，旧 ISO 瞬时不重新解释。

V1 schema 继续为 `1`。历史快照若保存了无偏移精确来源时间或 `formedAt` 但没有原解释时区，迁移只保留原字符串并标记 `unresolved_legacy`，不会擅自解释成新的绝对时刻，不会借用 `createdAt`，也不会凭该时间证明事前有效；后续人工核验可通过追加纠正快照补齐。

来源身份键只做 NFKC Unicode 规范化、首尾空白去除、连续/全角空白压缩和英文大小写折叠；原始 `sourceName` 保留用于显示。系统不会把“中信”“中信证券”“中信证券股份有限公司”按简称或模糊匹配自动合并。

## 报告期与期间口径

`reportPeriod` 必须是可验证的季度末日期。`periodScope` 独立表达：

- `single_quarter`：单季度；
- `year_to_date`：年初至今累计；
- `half_year`：半年度，仅匹配 6 月 30 日；
- `first_three_quarters`：前三季度累计，仅匹配 9 月 30 日；
- `full_year`：全年度，仅匹配 12 月 31 日；
- `ttm`：滚动十二个月。

V1 的真实 ResearchEvent 尚无可靠 TTM 实际值，TTM 预期可保存，但比较结果明确为不可比较。单季度与累计值、年度与季度值绝不混用。

## 指标、币种、单位和会计口径

V1 指标：

- `revenue`：营业收入；
- `attributable_net_profit`：归母净利润；
- `adjusted_net_profit`：扣非净利润；
- `eps`：每股收益；
- `operating_cash_flow`：经营现金流。

金额单位支持元、万元、百万元、亿元；比较时统一换算为元。EPS 必须使用每股币值单位，不能与金额单位混用。真实 A 股财务事件当前为 CNY；没有可靠汇率证据时，HKD 或 USD 预期不做换算。

会计口径必须兼容。A 股正式财务和已解析公司披露按中国企业会计准则口径参与匹配；`IFRS` 或 `unknown` 不强行比较。

## 公司披露边界与事前有效性

`isExAnte` 的定义只对应时间事实：快照形成时间（外部来源还包括来源发布时间）必须严格早于任何同公司、同报告期、同指标的业绩信息首次公开披露。该字段等同于 `beforeAnyPerformanceDisclosure === true`，不等同于“来源已核验”或“数值可比较”；来源核验和结构可比性由独立字段展示。

- `actualValueCandidate` 只来自指标值非空、公司/报告期/期间/指标一致且本地解析可靠的快报、正式报告或真实披露型财务事件；普通本地摘要刷新不充当实际披露时间；
- `performanceInformationCutoff` 独立判断公司公开披露：正式报告和快报只要公司、报告期、类型和公开时间可确认，即使为 `metadata_only`、`parse_partial` 或目标指标为 `null` 也形成保守边界；
- 预告和预告修正按已列指标判断覆盖；覆盖范围无法确认的公告进入“可能披露”集合。预测同时严格早于最早已确认披露和最早可能披露时，仍可判为 `before` 且确定；已到达或晚于已确认披露时按 `same_time` / `after`；早于已确认披露但不能证明早于最早可能披露时为 `unknown` 且 `performanceDisclosureUncertain=true`；只有可能披露时，也只有严格早于全部可能边界才能判为 `before`，否则保持 `unknown`；
- 因此快照可能早于正式实际值，却晚于同指标业绩预告，此时 `beforeActualDisclosure=true`、`beforeAnyPerformanceDisclosure=false`、`isExAnte=false`；
- 日期不同可按自然日先后判断；同一天只有形成时间和披露时间双方均为精确日期时间，且形成时间严格更早，才可判定为事前；
- 预测可用时间与披露时间精确相同返回 `same_time`，`isExAnte=false`，UI 明确显示“无法认定为披露前预测”，不会降级成“时间未知”；
- 同日只知道日期、来源日期缺失或披露只有日期精度时，保守判定为不能证明事前；
- `createdAt` 只表示录入时间，永远不参与形成时间判断。

预告、快报或正式值披露后形成的快照仍保留，但只作为事后参考或口径核验，不得描述为“未受业绩信息影响”。

## 点预测与区间预测算法

点预测：

```text
absoluteDifference = actualValue - expectedValue
relativeDifference = (actualValue - expectedValue) / abs(expectedValue)
```

相对差异仅在预期值远离 0、实际值与预期值没有正负号跨越且指标适合时计算。预期值为 0、接近 0、正负号跨越或经营现金流指标只展示绝对差异。

区间预测：

- 实际值高于上限：`above`；
- 实际值处于区间：`within`；
- 实际值低于下限：`below`。

舍入容差由 `settings.roundingTolerance` 集中配置，不散落在 UI。展示文案按来源类别分别使用“高于公司指引”“高于单家机构预测”“高于机构一致预期”或“高于用户个人预测”。

## 不可比较与数据核验

以下情况不强行比较，并保留具体原因：

- 公司、报告期、期间口径或指标不同；
- 单季度与累计、年度与季度或 TTM 口径混用；
- 币种不能可靠换算；
- 单位不能标准化；
- 会计口径不同或不明确；
- 实际值缺失、解析状态不足或来源不可靠；
- 来源待核验；
- 外部来源发布日期缺失、不早于业绩信息披露，或同日缺少精确时间；
- 预期形成时间不早于业绩信息披露，或同日缺少精确时间；
- 点预测值为 0、接近 0 或正负号跨越时，百分比差异不可用。

缺失值始终保持 `null`，不转换成 0。

## JSON 格式

导出文件使用：

```json
{
  "format": "investment-research-dashboard.earnings-expectation",
  "schemaVersion": 1,
  "updatedAt": "2026-07-13T00:00:00.000Z",
  "snapshots": [],
  "settings": {
    "revisionReminderThreshold": 0.1,
    "nearZeroThreshold": 1e-9,
    "roundingTolerance": 1e-9,
    "timeZone": "Asia/Shanghai"
  },
  "importHistory": [],
  "exportedAt": "2026-07-13T00:00:00.000Z"
}
```

导出的 JSON 是完整备份，包含快照、设置和导入历史；V1 导入器明确只是“快照导入”，不提供整库恢复。JSON 的 `snapshots` 必须存在、必须是数组且不能为空；空状态只能通过单独的重置操作产生。合并或替换快照都保留当前设置和导入历史；替换快照要求二次确认并先保存当前完整状态备份。失败时保留原状态。

JSON 导入会执行全部枚举白名单和完整纠正图校验，拒绝 `provider`、伪造值、循环、分叉或不唯一末端；并根据当前股票主数据把合法代码映射为 stock ID，拒绝孤儿股票和 market 不一致记录。无效记录保留原始问题载荷，不会写入有效快照。纠正快照即使数值完全相同，也不会在图校验前因内容指纹去重而隐藏竞争分支。

## CSV 模板与字段

英文模板字段：

```text
stockId,reportPeriod,periodScope,metric,estimateShape,value,lowerBound,upperBound,currency,unit,accountingBasis,sourceCategory,sourceName,sourceTitle,sourceUrl,sourcePublishedAt,sourcePublishedAtResolution,sourcePublishedAtTimeZone,asOfDate,formedAt,formedAtResolution,formedAtTimeZone,analystCount,institutionCount,sourceVerificationStatus,notes
```

同时支持常用中文表头、UTF-8 BOM、空行、带引号千分位、`YYYY-MM-DD`、`YYYY/MM/DD`、`YYYYMMDD` 和中文日期。金额可用元、万元、百万元、亿元，导入后标准化为元；EPS 使用每股币值。

未知股票、无效报告期、未知指标或来源类别、伪造枚举、口径不明确的行不生成有效快照。若 CSV 同时包含有效行和无效行，预览明确显示“部分可导入”、有效/跳过计数和问题清单；用户必须再次确认后才写入有效行。问题行的原始字段写入 `importHistory.issues` 并在核验队列展示。JSON 采用严格模式，只要包含无效行就整体拒绝。

导出 CSV 对以 `=`、`+`、`-`、`@` 开头的文本加安全前缀，防止电子表格公式注入。文件限制为 2MB、5000 条记录。

## 页面与联动

“预期证据”是顶层页面，并可从首页行动按钮和个股详情进入。页面提供来源不混同的 KPI、公司/行业/报告期/指标/来源/核验/事前有效/比较结果/修订/观察清单筛选、修订时间线和数据核验队列。

个股详情“业绩预期”模块按需复用该公司的真实财务与公告详情，展示当前有效预期、来源、形成时间、修订历史、实际值、比较方法和不可比较原因。

## ResearchEvent 联动

V1 新增稳定、幂等事件：

- `earnings_expectation_added`；
- `earnings_expectation_correction`；
- `earnings_expectation_revision`；
- `earnings_expectation_comparison_available`；
- `earnings_expectation_data_warning`。

事件携带业务根快照 ID、当前纠正链终点 ID、纠正链、来源类别、来源名称、报告期、指标、预期值或区间、原始/有效业务时间、原始/有效来源发布时间、实际解释时区、时间纠正标记与字段、纠正记录时间、业务时间精度、`before/after/equal/uncertain` 关系、披露时间状态、`correctionDelta`、`businessRevisionDelta`、比较结果和来源核验状态。纠正事件明确引用直接目标并只使用该纠正快照自己的 `createdAt` 作为 `correctionRecordedAt`；业务修订明确引用上一业务根及其有效终点，二者不混用。只有业务顺序确认且严格可比较的结果生成 `comparison_available`；其他情况生成稳定的数据核验事件。

## ReviewTask 联动

只对已进入观察清单的公司生成稳定、幂等、只读任务，包括新增快照、数据更正、明显业务上修/下修、实际比较可用和数据核验。数据更正任务只使用 `correctionDelta`，并以 `correctionRecordedAt` 与 `lastReviewedAt` 比较；上修/下修任务只使用业务顺序已确认的 `businessRevisionDelta`，并列出上一业务根、当前有效基准终点和当前快照。旧预测的晚录入不会误触发新业务任务，7 月 15 日新记录的纠正则能在 7 月 1 日复盘边界之后触发纠正任务。稳定任务 ID 只由观察项、规则和事件 ID 构成，不包含运行时计算时间。

`settings.revisionReminderThreshold` 默认 `0.1`。这是 10% 工作流提醒阈值，不是投资结论或行业标准。

## 数据与安全边界

- 不保存密钥、Cookie、登录信息或完整券商研报正文；
- 用户文本只按普通 React 文本渲染；
- 不执行 CSV 内容；
- 不修改真实财务、公告或原始 ResearchEvent 数据；
- 不新增外部数据源；
- 不修改默认 `data:refresh`、Provider Stability Gate 或 Developer Health Gate；
- Real/Mixed 模式不使用 mock 财务或 mock 公告作为实际值。

## 未来统一 Evidence Layer 的迁移边界

现有 `EvidenceItem`、ResearchEvent 来源字段和 ReviewEntry 证据引用存在相近语义，但 LocalStorage V2 和既有事件结构已经稳定。V1 不做全量重构。

未来可在保持适配器兼容的前提下抽取 `EvidenceSourceRef`、`EvidenceMetricRef`、`EvidencePeriodRef`。迁移必须先覆盖：旧 EvidenceItem 到共享来源引用、ResearchEvent 到共享指标/期间引用、ReviewEntry 到只读来源引用，并保持现有 JSON 与 LocalStorage schema 可读取。

## 后续合规 Provider 接口

未来自动 Provider 至少需要实现：

```ts
interface EarningsExpectationProvider {
  id: string;
  sourceCategory: "company_guidance" | "institution_single" | "institution_consensus";
  fetchSnapshots(stockIds: string[], asOfDate: string): Promise<EarningsExpectationSnapshot[]>;
  verifySource(snapshot: EarningsExpectationSnapshot): Promise<"verified" | "pending" | "unverified" | "invalid">;
}
```

接入前仍需单独完成授权、来源可追溯、访问限制、字段口径、历史快照、审计和稳定性门禁；不能因 V1 支持人工导入而跳过这些要求。
