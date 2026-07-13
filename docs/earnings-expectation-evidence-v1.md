# 业绩预期证据层 V1

## 目标与边界

V1 为人工录入或结构化导入的业绩预期建立可追溯、append-only 的证据链，并在真实财务或业绩快报出现后进行严格同口径比较。它不抓取商业数据库、不保存完整券商研报正文、不绕过登录或订阅限制，也不生成买卖建议。

自动机构一致预期 Provider 尚未实现，数据源注册表继续标记为 `not_implemented`。支持人工录入“有明确来源的机构一致预期”，不等于系统已经接入自动一致预期数据。

## 领域模型

`EarningsExpectationSnapshot` 是不可变事实快照，关键字段包括：

- 身份：`id`、`stockId`、`market`、`schemaVersion`；
- 口径：`reportPeriod`、`periodScope`、`metric`、`currency`、`unit`、`accountingBasis`；
- 数值：`estimateShape`、`value`、`lowerBound`、`upperBound`；
- 来源：`sourceCategory`、`sourceName`、`sourceTitle`、`sourceUrl`、`sourcePublishedAt`、`sourceVerificationStatus`；
- 时间：`asOfDate`、`createdAt`；
- 形成信息：`analystCount`、`institutionCount`、`ingestionMethod`、`createdBy`、`notes`；
- 纠错：`correctsSnapshotId`。

`EarningsExpectationComparison` 是派生结果，不写回真实财务、公告或快照。它保存实际事件 ID、预期值或区间、实际值、绝对差异、相对差异、事前有效性、比较方法和具体不可比较原因。

## 来源类别与录入方式

来源类别表示数字是谁形成的：

| `sourceCategory` | 含义 | 强制边界 |
| --- | --- | --- |
| `company_guidance` | 公司业绩指引 | 应关联公司公告或明确来源；缺少链接只能待核验 |
| `institution_single` | 单家机构预测 | 必须记录机构名称，不得包装成一致预期 |
| `institution_consensus` | 有明确来源的机构一致预期 | 必须有来源主体、标题和可打开链接 |
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

损坏 JSON 不会白屏或被静默覆盖。加载结果保留错误和原始文本，用户可导出损坏原文或明确重置。写入失败返回原状态。

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

只有同时满足以下条件，`isExAnte` 才为 `true`：

1. 快照来源状态为 `verified`；
2. `asOfDate` 不晚于同口径实际业绩首次公开披露时间；
3. 外部来源的 `sourcePublishedAt` 已知且不晚于首次披露时间；
4. 预期不是实际披露后的反推记录；
5. 公司、报告期、期间口径、指标、币种、单位和会计口径均可比较；
6. 实际值来自解析状态可靠的真实财务、快报或正式报告事件。

实际披露后录入的快照仍保留，但只作为事后参考，不参与事前判断。

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
- 外部来源发布日期缺失或晚于实际披露；
- 预期形成日期晚于实际披露；
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
    "roundingTolerance": 1e-9
  },
  "importHistory": [],
  "exportedAt": "2026-07-13T00:00:00.000Z"
}
```

导入先检查格式、版本、记录结构、重复和 ID 冲突。合并导入跳过稳定重复；替换导入要求二次确认并先保存当前数据备份。失败时保留原状态。

## CSV 模板与字段

英文模板字段：

```text
stockId,reportPeriod,periodScope,metric,estimateShape,value,lowerBound,upperBound,currency,unit,accountingBasis,sourceCategory,sourceName,sourceTitle,sourceUrl,sourcePublishedAt,asOfDate,analystCount,institutionCount,sourceVerificationStatus,notes
```

同时支持常用中文表头、UTF-8 BOM、空行、带引号千分位、`YYYY-MM-DD`、`YYYY/MM/DD`、`YYYYMMDD` 和中文日期。金额可用元、万元、百万元、亿元，导入后标准化为元；EPS 使用每股币值。

未知股票、无效报告期、未知指标或来源类别、口径不明确的行不生成有效快照。若文件同时包含有效行和口径不明行，有效行可原子导入，问题行写入 `importHistory.issues` 并在核验队列展示。

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

事件携带快照 ID、来源类别、来源名称、报告期、指标、预期值或区间、事前有效性、比较结果和来源核验状态。用户预测保持 `user_estimate`，不会转换成机构事件。只有严格可比较的结果生成 `comparison_available`；其他情况生成数据核验事件。

## ReviewTask 联动

只对已进入观察清单的公司生成稳定、幂等、只读任务，包括新增快照、明显上修/下修、实际比较可用和数据核验。任务可确认、忽略或暂缓，不自动修改 WatchItem、用户判断或主观状态。

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
