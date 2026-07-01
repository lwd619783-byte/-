# A Stock Data 字段映射

## 股票代码

- 标准代码：`603019.SH` / `300502.SZ` / `0992.HK`。
- A Stock Data 代码：A 股使用 6 位数字，腾讯端点转换为 `sh603019` / `sz300502`。
- 港股/美股：第一阶段写入 `unsupported_market`，不生成假行情。

## 行情字段

| 看板字段 | 生成 JSON | 来源层 | 源字段/口径 | 单位 |
| --- | --- | --- | --- | --- |
| `latestPrice` | `quotes` | Tencent quote | `~3` | 元 |
| `pctChange` | `quotes` | Tencent quote | `~32` | % |
| `amount` | `quotes` | Tencent quote | `~37` | 亿元 |
| `turnover` | `quotes` | Tencent quote | `~38` | % |
| `pe` / `peTtm` | `quotes` | Tencent quote | `~39` | 倍 |
| `marketCap` | `quotes` | Tencent quote | `~44` | 亿元 |
| `floatMarketCap` | `quotes` | Tencent quote | `~45` | 亿元 |
| `pb` | `quotes` | Tencent quote | `~46` | 倍 |
| `limitUp` / `limitDown` | `quotes` | Tencent quote | `~47` / `~48` | 元 |

## 价格历史

| 看板字段 | 生成 JSON | 来源层 | 说明 |
| --- | --- | --- | --- |
| `priceHistory[].date` | `priceHistory` | Tencent fqkline | 交易日 |
| `open/high/low/close` | `priceHistory` | Tencent fqkline | 元 |
| `volume` | `priceHistory` | Tencent fqkline | 源口径 |
| `amount` | `priceHistory` | Tencent fqkline | 源口径 |
| `pctChange` | `priceHistory` | 本地计算 | 用相邻 close 计算 |

## 财务字段

当前实现使用新浪财报三表直连接口。金额统一换算为亿元，百分比字段以 `12.3` 表示 `12.3%`。

| 看板字段 | 生成 JSON | 来源层 | 源字段/口径 | 单位 |
| --- | --- | --- | --- | --- |
| `reportDate` | `financials` | Sina lrb | 最新报告期 | YYYY-MM-DD |
| `revenue` | `financials` | Sina lrb | 利润表第 0/1 行营业收入 | 亿元 |
| `revenueGrowth` | `financials` | Sina lrb | 营业收入同比 | % |
| `netProfit` | `financials` | Sina lrb | 归母净利润 | 亿元 |
| `profitGrowth` | `financials` | Sina lrb | 归母净利润同比 | % |
| `eps` | `financials` | Sina lrb | 基本每股收益 | 元 |
| `grossMargin` | `financials` | 本地计算 | `(revenue - cost) / revenue` | % |
| `netMargin` | `financials` | 本地计算 | `netProfit / revenue` | % |
| `roe` | `financials` | 本地计算 | `netProfit / parentEquity` | % |
| `debtRatio` | `financials` | 本地计算 | `liability / asset` | % |
| `operatingCashFlow` | `financials` | Sina llb | 经营活动现金流量净额 | 亿元 |

缺失时保持 `null`，并在 `quality.status` 或校验报告中标记 `missing/error`。

## F10 / 公司资料

| 看板字段 | 生成 JSON | 来源 | 策略 |
| --- | --- | --- | --- |
| `fullName` | `stocks` | 东财 HSF10 CompanySurvey | 公司全称 |
| `industryName` | `stocks` | 东财 HSF10 / push2 | 优先东财行业，缺失时用证监会行业 |
| `listDate` | `stocks` | 东财 push2 stock/get | 上市日期 |
| `totalShares` / `floatShares` | `stocks` | 东财 push2 / 腾讯市值反推 | 亿股 |
| `companyProfile` | `stocks` | 东财 HSF10 | 公司简介 |
| `businessScope` | `stocks` | 东财 HSF10 | 主营业务 / 经营范围 |

## 研究、公告、信号、板块

| 看板字段 | 生成 JSON | 来源 | 策略 |
| --- | --- | --- | --- |
| 研报列表 | `research` | 东方财富 reportapi | 只存元数据 |
| 公告列表 | `announcements` | 巨潮资讯 | 只存标题、日期、链接 |
| 资金/信号摘要 | `signals` | 东方财富 push2his / datacenter | 资金流、两融、龙虎榜、股东户数、解禁，字段级来源写入 `fieldSources` |
| 板块/概念 | `sectorMembership` | 东方财富板块补位 + HSF10 行业兜底 | 失败时至少保留行业分类 |

## 数据质量

每个生成项都必须包含：

- `source`：固定为 `A Stock Data` 或具体外部源名称。
- `sourceLayer`：`quote`、`kline`、`finance`、`research`、`announcement`、`signals`、`sector`。
- `sourceEndpoint`：便于追溯的端点名称。
- `updatedAt`：脚本运行时间。
- `status`：`real`、`stale`、`missing`、`error`、`unsupported_market`。

前端规则：

- `real/stale` 可参与真实覆盖。
- `missing/error/unsupported_market` 显示“数据暂缺”或明确状态。
- 不用 mock 数字冒充真实行情。
