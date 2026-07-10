# 数据真实性审计与数据源注册表 V1

- 执行时间：2026-07-10T04:57:30.308Z
- 注册表条目：21
- P0：0；P1：0；P2：0；P3：0
- 结论：已建立统一注册表和可运行审计入口；未确认信息保留为 null/unknown，不将缺失数据伪装成有效数字。

## 执行摘要

- A 股/港股行情和历史价格沿用既有抓取链路，归类为 generated_real；不接入新 Provider。
- A 股财务归类为 partial；港股财务、公告、业绩预告、业绩快报、研报、一致预期均明确为 not_implemented。
- 客户、供应商、产业链定位、技术路线、风险提示和 evidenceItems 均注册了人工/推断属性，不能当作同等级事实。
- 审计脚本检查注册表完整性、状态枚举、生成文件存在性和示例财务值残留。

## 注册表状态分布

- status：{"generated_real":5,"partial":2,"not_implemented":7,"static_reference":1,"manual_unverified":4,"inferred":2}
- sourceType：{"generated_real":7,"not_implemented":7,"static_reference":1,"manual_unverified":4,"inferred":2}

## 数据流概览

`外部接口 → scripts/fetch-*.py → src/data/real/*.generated.json → src/services/providers → src/services/stockProvider.ts → React components`

行情/历史价格使用既有生成文件；研究 seed 位于 `src/data/stocks.ts`，不应覆盖真实财务或行情缺失。

## 真实数据覆盖与当前边界

| 数据类 | 状态 | 生成脚本/存储 | 前端消费者 | 边界 |
|---|---|---|---|---|
| A 股行情 | generated_real | `fetch-a-stock-data.py` → `quotes.generated.json` | `stockProvider.ts`、股票组件 | 以 quality.status/updatedAt 为准 |
| A 股历史价格 | generated_real | `fetch-a-stock-data.py` → `priceHistory.generated.json` | `stockProvider.ts`、Sparkline | 区间和复权口径需看脚本 |
| 港股行情/历史 | generated_real | `fetch-hk-stock-data.py` | `stockProvider.ts` | 依赖 yfinance |
| A 股财务 | partial | `fetch-a-stock-data.py` → `financials.generated.json` | 详情抽屉 | 字段可能缺失 |
| 港股财务/公告/研报 | not_implemented | 占位或空生成文件 | 详情抽屉 | 不得显示具体数字或已获取事实 |

## P0-P3 问题清单

- P0：无结构性错误
- P1：无自动发现项
- P2：人工研究字段的来源和日期并非全部完整，已在注册表标记 manual_unverified/unknown。
- P3：注册表字段统一为 camelCase，状态值统一为枚举。

## 前端防误导约束

- 缺失值显示 `数据暂缺`，null/undefined/NaN 不转为 0。
- not_implemented 显示未接入/数据暂缺，不沿用 mock 财务值。
- generated_real 必须能定位到生成脚本和存储文件；更新时间不确定时保留 null。
- manual_unverified/inferred 仅作为线索或推断，不能显示为已验证事实。

## 下一阶段（本次不执行）

- 逐字段补公告、财务和研报的原始来源与更新时间。
- 将 evidenceItems 的 sourceUrl/sourceDate/verificationStatus 做强校验。
- 在不引入新 Provider 前提下，补充前端统一 DataFreshnessLabel/MissingDataState。

## 检查结果

运行命令：`npm run data:audit`。

