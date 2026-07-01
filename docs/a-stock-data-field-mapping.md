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

第一阶段保留 `financials.generated.json` 结构，但不伪造财务值。未抓取到可信财务快照时写入 `null + sourceStatus: missing`。

| 看板字段 | 目标来源 | 缺失策略 |
| --- | --- | --- |
| `revenue` / `revenueGrowth` | 新浪三表 / 东方财富财务 / F10 补位 | `null` |
| `netProfit` / `profitGrowth` | 同上 | `null` |
| `eps` / `roe` | 同上 | `null` |
| `grossMargin` / `netMargin` | 本地计算或源字段 | `null` |
| `debtRatio` / `operatingCashFlow` | 财报三表 | `null` |

## 研究、公告、信号、板块

| 看板字段 | 生成 JSON | 来源 | 策略 |
| --- | --- | --- | --- |
| 研报列表 | `research` | 东方财富 reportapi | 只存元数据 |
| 公告列表 | `announcements` | 巨潮资讯 | 只存标题、日期、链接 |
| 资金/信号摘要 | `signals` | 预留东方财富资金流、龙虎榜、两融等 | 缺失不阻断 |
| 板块/概念 | `sectorMembership` | 东方财富板块补位 | 失败写 `missing/error` |

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
