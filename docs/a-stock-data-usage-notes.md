# A Stock Data Skill 使用说明

## 目标

本看板第一阶段采用本地脚本接入 `a-stock-data` 技能思想：浏览器端只读取 `src/data/real/*.generated.json`，不直接请求行情接口，不暴露 token，不把失败数据伪装成真实数据。

## 已接入路径

- 报价与估值：腾讯 `qt.gtimg.cn`，用于最新价、涨跌幅、成交额、换手率、PE TTM、PB、总市值、流通市值、涨跌停价。
- 价格历史：腾讯 `fqkline`，生成最近最多 60 个交易日 OHLCV。
- 研报列表：东方财富 `reportapi`，只保存标题、机构、日期、评级与链接元数据。
- 公告列表：巨潮资讯 `hisAnnouncement`，只保存标题、日期、类型与 PDF 链接元数据，不解析 PDF 正文。
- 板块/概念补位：东方财富板块查询作为弱补位，失败时标记 `missing/error`。
- 信号层：第一阶段保留结构，资金流、龙虎榜、两融、股东户数、解禁等后续按 a-stock-data 技能端点逐步补齐。

## 访问纪律

- 东方财富端点必须串行访问，脚本内置不少于 1 秒的间隔和随机抖动。
- 单只股票任一数据层失败不阻断全量抓取。
- 新生成文件为空时保留旧缓存，并在 manifest / fetch log 写入提示。
- 港股/美股不在本 MVP 支持范围内，联想集团标记为 `unsupported_market`。

## 运行命令

```bash
npm run data:fetch:a-stock
npm run data:validate:a-stock
npm run data:refresh
```

## 生成文件

- `src/data/real/stocks.generated.json`
- `src/data/real/quotes.generated.json`
- `src/data/real/priceHistory.generated.json`
- `src/data/real/financials.generated.json`
- `src/data/real/research.generated.json`
- `src/data/real/announcements.generated.json`
- `src/data/real/signals.generated.json`
- `src/data/real/sectorMembership.generated.json`
- `src/data/real/data-manifest.generated.json`
- `data-cache/a-stock-data/raw/fetch-log-*.json`

## 暂不接入

- 不接入 AKShare、BaoStock、Tushare 作为默认路径。
- 不解析公告 PDF 正文。
- 不承诺实时分笔、全市场覆盖、登录接口或生产级稳定性。
- 不用港股/美股替代百济神州，百济神州优先使用 A 股 `688235.SH`。
