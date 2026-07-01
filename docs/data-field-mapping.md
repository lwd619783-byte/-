# 数据字段映射

## 代码映射

统一由 `src/utils/symbol.ts` 管理：

- A 股内部标准：`603019.SH` / `300502.SZ`
- AKShare：`603019`
- BaoStock：`sh.603019` / `sz.300502`
- yfinance 港股：`0992.HK` / `6160.HK`
- Tushare：`603019.SH`

组件不得直接拼接第三方代码格式。

## 个股基础与行情

| 当前字段 | 数据源字段 | 数据源 | 转换逻辑 | 单位 | 缺失处理 |
| --- | --- | --- | --- | --- | --- |
| `name` | 名称 / symbolMap | AKShare / 手工映射 | 优先真实名称，否则手工名称 | 文本 | 保留 mock |
| `code` | 代码 / symbolMap | 手工映射 | 标准化为 `XXXXXX.SH/SZ` 或 `XXXX.HK` | 文本 | 校验报告提示 |
| `market` | symbolMap | 手工映射 | A 股 / 港股 / 美股 | 文本 | 校验报告提示 |
| `latestPrice` | 最新价 / last_price | AKShare / Tencent fallback / yfinance | 数值直出 | 元 / 港元 / 美元 | `null` + `missing` |
| `pctChange` | 涨跌幅 | AKShare / Tencent fallback | 百分比数值 | % | `null` + `missing` |
| `marketCap` | 总市值 / market_cap | AKShare / Tencent fallback / yfinance | 元转亿元；腾讯已为亿元 | 亿元 | `null` + `missing` |
| `floatMarketCap` | 流通市值 | AKShare / Tencent fallback | 元转亿元；腾讯已为亿元 | 亿元 | `null` + `missing` |
| `pe` | 市盈率-动态 / PE TTM | AKShare / Tencent fallback | 数值直出 | 倍 | `null` + `missing` |
| `pb` | 市净率 | AKShare / Tencent fallback | 数值直出 | 倍 | `null` + `missing` |
| `ps` | 暂缺 | 后续 Tushare/yfinance | 第一阶段不强求 | 倍 | `null` + `missing` |
| `dividendYield` | 暂缺 | 后续 Tushare/yfinance | 第一阶段不强求 | % | `null` + `missing` |

## 财务概览

| 当前字段 | 数据源字段 | 数据源 | 转换逻辑 | 单位 | 缺失处理 |
| --- | --- | --- | --- | --- | --- |
| `revenue` | 暂缺 / 后续三表营业收入 | 后续 AKShare/Sina/Tushare | 元转亿元 | 亿元 | `null` + `missing` |
| `revenueGrowth` | 主营业务收入增长率(%) | AKShare 财务指标 | 数值直出 | % | `null` + `missing` |
| `netProfit` | 暂缺 / 后续归母净利润 | 后续 AKShare/Sina/Tushare | 元转亿元 | 亿元 | `null` + `missing` |
| `profitGrowth` | 净利润增长率(%) | AKShare 财务指标 | 数值直出 | % | `null` + `missing` |
| `grossMargin` | 销售毛利率(%) | AKShare 财务指标 | 数值直出 | % | `null` + `missing` |
| `netMargin` | 销售净利率(%) | AKShare 财务指标 | 数值直出 | % | `null` + `missing` |
| `roe` | 净资产收益率(%) | AKShare 财务指标 | 数值直出 | % | `null` + `missing` |
| `debtRatio` | 资产负债率(%) | AKShare 财务指标 | 数值直出 | % | `null` + `missing` |
| `operatingCashFlow` | 暂缺 / 后续现金流量表 | 后续 AKShare/Sina/Tushare | 元转亿元 | 亿元 | `null` + `missing` |

## 价格历史

| 当前字段 | 数据源字段 | 数据源 | 转换逻辑 | 单位 | 缺失处理 |
| --- | --- | --- | --- | --- | --- |
| `priceHistory[].date` | 日期 / date | AKShare / BaoStock / yfinance | ISO 日期字符串 | 日期 | 空数组 |
| `priceHistory[].close` | 收盘 / close / Close | AKShare / BaoStock / yfinance | 数值直出 | 元 / 港元 / 美元 | `null` |
| `priceHistory[].amount` | 成交额 / amount / Volume | AKShare / BaoStock / yfinance | 数值直出 | 元或股数，按源记录 | `null` |
| `priceHistory[].pctChange` | 涨跌幅 / pctChg | AKShare / BaoStock | 数值直出 | % | `null` |

## 数据质量

每条真实数据必须带：

```ts
{
  source: string,
  updatedAt?: string,
  status: "mock" | "real" | "stale" | "missing" | "error",
  errorMessage?: string
}
```

前端展示规则：

- `real`：展示真实值和来源。
- `missing`：展示“数据暂缺”。
- `stale`：展示上次成功缓存，并提示过期。
- `error`：展示“数据暂缺”和错误摘要。
- `mock`：保留示例数据，不得标成真实。
