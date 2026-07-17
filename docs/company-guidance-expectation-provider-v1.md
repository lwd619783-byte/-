# A股公司指引预期 Provider V1

## 结论与边界

V1 已把当前提交的巨潮公告 Provider 中可可靠解析的 `earnings_preview` 与 `earnings_preview_revision` 转换为只读公司指引预期。生成过程完全离线，不调用巨潮网络，不修改既有公告或财务产物，不进入默认 `data:refresh`，也不代表自动机构一致预期已接入。

业绩快报、定期报告、普通财务更新、新闻转载、券商预测、用户推断、`metadata_only` 猜测字段均不得进入本 Provider。快报和正式报告只继续承担实际披露或披露边界角色。

## 数据来源与可行性审计

输入只来自已提交文件：

- `src/data/real/a-share-announcement-summaries.generated.json`；
- `public/data/a-share-announcements/manifest.generated.json`；
- `public/data/a-share-announcements/<stockId>.json` 共 56 个。

基于公告产物 `generatedAt=2026-07-11T07:31:40Z` 的审计结果：

| 项目 | 结果 |
| --- | ---: |
| 全部公告 | 15,674 |
| 业绩预告 / 修正 | 81 / 1 |
| 可识别报告期 / 期间口径 | 81 / 81 |
| `parse_success` / `parse_partial` | 31 / 51 |
| 可靠公告 / Provider 快照 / 公司 | 31 / 56 / 15 |
| 归母净利润 / 扣非净利润 / 营业收入 / EPS | 25 / 21 / 10 / 0 |
| 年度 / 半年度 / 前三季度 / 单季度 | 23 / 26 / 3 / 4 |
| 排除目标公告 | 51 |
| 最早 / 最晚公告日 | 2024-07-11 / 2026-07-11 |
| 重复目标公告 | 0 |

排除原因可叠加：50 条没有可靠预告区间，1 条修正公告没有可靠新范围，51 条均为 `parse_partial`，其中 1 条同时缺报告期。唯一修正公告 `1225404882` 可找到候选前序 `1225403602`，但新旧公告都没有可靠区间，因此仅保留结构化警告，不生成修订快照或方向性结论。真实输入没有可可靠生成的多次修正链。

## Provider 快照模型

`EarningsExpectationProviderSnapshot` 包装通用 `EarningsExpectationSnapshot`，额外保留：Provider ID/版本、公告 ID/类型、官方详情链接、官方 PDF、源公告日期、生成时间、产物 SHA-256、原文证据、原始单位证据、解析状态/置信度、修订候选与结构化警告。

快照固定边界：

- `sourceCategory=company_guidance`；
- `ingestionMethod=provider`；
- `sourceVerificationStatus=verified`；
- `accountingBasis=PRC_GAAP`，币种为 CNY；
- 金额统一为 `yuan`，同时保留原始单位证据；
- 区间保持 `estimateShape=range`，不把中点写成公司披露点预测；
- 缺失上下限、口径或单位时排除，不补 0；
- 负数与扭亏区间保留原符号。

V1 支持归母净利润、扣非净利润和营业收入。当前公告产物没有可靠 EPS Provider 记录，因此 EPS 覆盖为 0，不做猜测。

## 稳定身份与时间语义

快照 ID 对以下稳定业务字段做规范化后生成 SHA-256 摘要：

```text
providerId + announcementId + stockId + reportPeriod + periodScope + metric
```

ID 不含当前时间、数组下标、随机数、显示时区或中文文案。输入排序和重复生成不会改变 ID。

公司内部预测形成时刻未知，所以 `formedAt=null`、`formationTimeBasis=public_disclosure_proxy`。`sourcePublishedAt` 使用公告记录自身的公开日期，并作为该证据最早可用时间。UI 必须显示“公司内部形成时间未知，以公开披露时间作为可用时间”，不得把代理时间描述成公司内部真实形成时刻；当前显示时区不会二次解释已标准化日期。

## 预告修正链

修正只在同公司、同报告期、同 `periodScope`、同指标、时间明确且存在唯一兼容前序时设置 `correctsSnapshotId`。前序只能是 Provider 公司指引，不能指向快报、正式报告或用户快照。

无法唯一证明前序、同日顺序不明、跨指标/报告期/口径、缺可靠新旧区间时不连链；保留候选公告 ID 和结构化警告，不生成方向性修订。生成器和验证器同时检查循环、分叉与身份一致性。

## 生成产物与加载

```text
src/data/real/a-share-company-guidance-expectation-summaries.generated.json
public/data/a-share-company-guidance-expectations/
  manifest.generated.json
  <stockId>.json  # 56 个公司状态文件
```

摘要只包含按公司加载所需的状态与计数。Manifest 固定保存 allowlist 路径、公司身份、记录数量、字节数、SHA-256、最新报告期、最新来源日期和状态。详情按公司懒加载；成功结果缓存、并发请求去重、失败结果不缓存为成功，响应还会验证路径、身份、字节数、checksum 和 Provider 只读边界。初始 JS 不静态打入 56 个详情文件。

生成器先写入临时目录，完成全量验证后再替换目标产物。`--dry-run` 只完成内存生成与验证，不写文件。

## Provider 与用户证据边界

Provider 与用户 LocalStorage 快照在聚合层合并展示，但存储完全分开：

- Provider 不写入 `investment-research-dashboard.earnings-expectation.v1`；
- Store API 显式拒绝 `ingestionMethod=provider`；
- Provider 刷新不删除或覆盖 manual / JSON / CSV 记录；
- Provider 记录只读，不显示编辑或纠正按钮；
- 本地记录仍保持 append-only 纠错链和导入历史。

若本地记录与官方 Provider 的公告 ID/官方 URL 及业务身份一致，两条证据都保留，UI 标记“与官方 Provider 记录重复”。正式 Comparison、ResearchEvent 和 ReviewTask 只使用官方 Provider 快照一次，避免重复计数；本地记录继续用于审计。

## Comparison、ResearchEvent 与 ReviewTask

链路为：

```text
Provider snapshot -> Effective selection -> Comparison -> ResearchEvent -> ReviewTask/KPI
```

现有事前有效性、披露边界、唯一业务前序、口径一致和时间不变量继续生效。没有可靠实际值时只产生 `insufficient_data` / 数据核验，不输出正式预期差；业务顺序不确定时不输出方向性修订。事件 payload 传递 Provider 版本、公告 ID、官方链接/PDF 和解析状态。事件与任务 ID 不依赖运行时间、显示时区或输入顺序，页面重载不会反复生成重复任务。

## 命令与验证

```bash
npm run data:fetch:expectations:company-guidance
node scripts/generate-company-guidance-expectations.mjs --dry-run
npm run data:validate:expectations:company-guidance
npm run test:expectations:company-guidance
```

生成命令只读已提交公告产物；验证和测试完全离线。CI 只运行测试与验证，不调用外部网络。默认 `data:refresh`、Provider Stability Gate 和 Developer Health Gate 均未修改。

## 已知限制

- 当前只覆盖 56 家 A 股股票池及公告 Provider 已提交的最近两年窗口；15 家有可靠数值，属于 `partial`，不是完全覆盖。
- PDF 版式与解析能力使 51 条目标公告被排除；V1 不 OCR、不放宽置信度、不猜数字。
- 真实数据没有可生成的可靠修正链；修正算法由固定离线夹具覆盖。
- Provider 不包含机构一致预期、券商预测、估值或投资建议。
- 上市公司公告是公司披露证据，不代表机构观点，也不保证最终审计后业绩与预告一致。
