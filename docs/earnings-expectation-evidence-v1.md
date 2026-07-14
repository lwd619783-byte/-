# 业绩预期证据层 V1

## 目标与边界

V1 为人工录入或结构化导入的业绩预期建立可追溯、append-only 的证据链，并在真实财务或业绩快报出现后进行严格同口径比较。它不抓取商业数据库、不保存完整券商研报正文、不绕过登录或订阅限制，也不生成买卖建议。

自动机构一致预期 Provider 尚未实现，数据源注册表继续标记为 `not_implemented`。支持人工录入“有明确来源的机构一致预期”，不等于系统已经接入自动一致预期数据。

## 领域模型

`EarningsExpectationSnapshot` 是不可变事实快照，关键字段包括：

- 身份：`id`、`stockId`、`market`、`schemaVersion`；
- 口径：`reportPeriod`、`periodScope`、`metric`、`currency`、`unit`、`accountingBasis`；
- 数值：`estimateShape`、`value`、`lowerBound`、`upperBound`；
- 来源：`sourceCategory`、`sourceName`、`sourceTitle`、`sourceUrl`、`sourcePublishedAt`、`sourcePublishedAtPrecision`、`sourceVerificationStatus`；
- 时间：日期口径 `asOfDate`、可选精确形成时间 `formedAt`、`formedAtPrecision` 和仅表示录入动作的 `createdAt`；
- 形成信息：`analystCount`、`institutionCount`、`ingestionMethod`、`createdBy`、`notes`；
- 纠错：`correctsSnapshotId`、`correctionScope`（`value` 或 `basis`）。

`EarningsExpectationComparison` 是派生结果，不写回真实财务、公告或快照。它分别保存实际值候选披露时间、任何同指标业绩信息首次披露时间、`beforeActualDisclosure`、`beforeAnyPerformanceDisclosure`、稳定的比较可用时间，以及预期值、实际值、差异、比较方法和具体不可比较原因。

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
4. 默认比较排除已被纠正的快照，并在同公司、同报告期、同期间口径、同指标、同来源组内使用最新有效快照；
5. 所有历史版本仍可查看。

纠正快照必须保持来源类别和标准化后的来源名称不变。币种、单位或会计口径变化会标记为 `basis` 口径纠正，界面不计算或展示修订率；其余同口径数值纠正标记为 `value`。

Repository、Store、JSON 合并、JSON 替换和 CSV 导入共用同一套完整纠正图校验。图约束为：禁止自引用和任意长度循环；一个历史快照最多有一个直接纠正者；每条合法链必须有且只有一个末端。有效版本通过链末端解析，而不是依赖文件顺序。预览分别给出“合并允许”和“替换允许”；跨现有 Store 与导入批次形成的循环或分叉会显示具体节点原因，并原子拒绝对应模式，当前 Store 不写入任何部分链。

损坏 JSON 不会白屏或被静默覆盖。加载结果保留错误和原始文本，用户可导出损坏原文或明确重置。写入失败返回原状态。

V1 schema 仍为 `1`。本轮字段均为向后兼容的保守元数据：快照精度字段可缺省，`settings.timeZone` 可由迁移器补为实际可用的浏览器 IANA 时区；因此无需破坏性提升版本。迁移幂等，旧快照不会用 `createdAt` 推断形成时间，缺少精确时间的旧记录统一按日期精度处理，已有快照和导入历史不清空。`snapshots` 缺失或不是数组属于损坏数据，不会迁移为空数组，也不会覆盖原始文本。

## 业务时间、日期精度与工作流时区

应用保存并显示 `settings.timeZone`，默认取用户浏览器实际解析到的 IANA 时区；无效或缺失配置安全回退到运行环境的有效时区，最终才回退 `UTC`。所有“今天”、跨日和同日判断都使用该工作流时区，不再把 `createdAt.slice(0, 10)` 当作用户日历日期。

- `formedAt`：预测实际形成的精确时刻，必须是带时区的 ISO 8601；其工作流日历日期必须等于 `asOfDate`；
- `asOfDate`：只有日期精度时的业务日期，始终保持 `YYYY-MM-DD`，不转换为午夜 UTC；
- `sourcePublishedAt`：来源实际发布时间，可为带时区精确时刻或 `YYYY-MM-DD`；日期精度不伪造小时；
- `createdAt`：数据进入本系统的审计时间，只记录系统动作，不参与当前预测、修订幅度、事件顺序或事前有效性判断。

同一逻辑分组先按业务日历日期排序；双方都有精确 `formedAt` 时再比较时刻。若同日任一方只有日期精度，或双方都只有日期精度，业务先后未知，系统使用稳定 ID 固定选择与展示顺序，并明确标记“同日业务顺序不确定”，不得称为已经确认的最新预测。东京跨 UTC 日期和 `America/New_York` DST 边界均由固定时钟测试覆盖。

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

## 事前有效性

`isExAnte` 的定义只对应时间事实：快照形成时间（外部来源还包括来源发布时间）必须严格早于任何同公司、同报告期、同指标的业绩信息首次公开披露。该字段等同于 `beforeAnyPerformanceDisclosure === true`，不等同于“来源已核验”或“数值可比较”；来源核验和结构可比性由独立字段展示。

- 任何业绩信息包括相关指标的业绩预告、预告修正、快报、正式报告和财务更新；
- 实际值候选仍只来自解析可靠的快报、正式报告或财务更新；
- 因此快照可能早于正式实际值，却晚于同指标业绩预告，此时 `beforeActualDisclosure=true`、`beforeAnyPerformanceDisclosure=false`、`isExAnte=false`；
- 日期不同可按自然日先后判断；同一天只有形成时间和披露时间双方均为精确日期时间，且形成时间严格更早，才可判定为事前；
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
stockId,reportPeriod,periodScope,metric,estimateShape,value,lowerBound,upperBound,currency,unit,accountingBasis,sourceCategory,sourceName,sourceTitle,sourceUrl,sourcePublishedAt,asOfDate,formedAt,analystCount,institutionCount,sourceVerificationStatus,notes
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
- `earnings_expectation_revision`；
- `earnings_expectation_comparison_available`；
- `earnings_expectation_data_warning`。

事件携带快照 ID、来源类别、来源名称、报告期、指标、预期值或区间、业务时间精度、同日顺序不确定标记、两类披露前状态、事前有效性、比较结果和来源核验状态。用户个人预测以 `formedAt`（否则 `asOfDate`）作为事件业务时间；外部来源优先使用 `sourcePublishedAt`，缺失时仅把形成时间作为待核验参考，不包装成已确认的机构发布时间；日期精度不伪造 `00:00`。比较事件使用实际结果首次可靠披露并可比较的时间，不使用 `calculatedAt`、`createdAt` 或当前时间，因此相同业务输入在刷新和重载后生成相同 ID、日期、排序和完整事件。用户预测保持 `user_estimate`，不会转换成机构事件。只有严格可比较的结果生成 `comparison_available`；其他情况生成数据核验事件。

## ReviewTask 联动

只对已进入观察清单的公司生成稳定、幂等、只读任务，包括新增快照、明显上修/下修、实际比较可用和数据核验。任务边界与创建时间来自事件业务时间；晚录入的旧预测不会因为 `createdAt` 较新而重复生成任务，`calculatedAt` 变化也不会改变任务 ID。任务可确认、忽略或暂缓，不自动修改 WatchItem、用户判断或主观状态。

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
