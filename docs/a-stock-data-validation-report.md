# A Stock Data 数据校验报告

- 生成时间：2026-09-18T13:02:51
- 口径来源：`src/data/real/stock-universe.generated.json`
- 港股状态：第三步接入 yfinance quote / priceHistory MVP；港股行情单独统计，不纳入 A 股覆盖率分母。

## 1. Universe 口径

- Universe 总数：60
- 市场分布：{"A股": 57, "港股": 3, "美股": 0, "未上市": 0}
- 支持分布：{"A股": 57, "港股": 3, "美股": 0, "未上市": 0}
- 不支持分布：{"A股": 0, "港股": 0, "美股": 0, "未上市": 0}
- 未上市公司：0，单独维护，不进入行情覆盖率。

## 2. A 股覆盖率

- Universe 总数：60
- Universe 市场分布：{"A股": 57, "港股": 3, "美股": 0, "未上市": 0}
- Universe 支持分布：{"A股": 57, "港股": 3, "美股": 0, "未上市": 0}
- Universe 不支持分布：{"A股": 0, "港股": 0, "美股": 0, "未上市": 0}
- Manifest Universe 总数：60
- A 股 quotes 覆盖：57/57 (100.0%)
- A 股 priceHistory 覆盖：56/57 (98.2%)
- A 股 financials 覆盖：57/57 (100.0%)
- 财务报告期覆盖：57/57 (100.0%)
- A 股 profiles / F10 覆盖：57/57 (100.0%)
- 行业分类覆盖：57/57 (100.0%)
- A 股 research 覆盖：50/57 (87.7%)
- A 股 announcements 覆盖：56/57 (98.2%)
- A 股 signals 覆盖：57/57 (100.0%)
- A 股 sectorMembership 覆盖：57/57 (100.0%)
- HK quotes 覆盖：3/3 (100.0%)
- HK priceHistory 覆盖：3/3 (100.0%)
- HK financials 覆盖：0/3（暂未接入）
- HK research 覆盖：0/3（暂未接入）
- HK announcements 覆盖：0/3（暂未接入）
- 港股 unsupported：unsupported_market 0/0，不计入 A 股覆盖率
- stale 数据数量：0
- missing 明细数量：9

## 3. 港股行情覆盖

- lenovo | 联想集团 | 0992.HK | quote=real | priceHistory=real | financials=not_implemented | research=not_implemented | announcements=not_implemented | source=yfinance
- sunny-optical | 舜宇光学科技 | 2382.HK | quote=real | priceHistory=real | financials=not_implemented | research=not_implemented | announcements=not_implemented | source=yfinance
- ubtech | 优必选 | 9880.HK | quote=real | priceHistory=real | financials=not_implemented | research=not_implemented | announcements=not_implemented | source=yfinance
- 说明：本阶段只接入港股 quote 与 priceHistory；financials / research / announcements 继续标记为 not_implemented，不伪造数据。
- 港股行情单独统计，不计入 A 股覆盖率分母。

## 4. 缺失明细

- dongli | 宁波东力 | A股 | research | 当前数据源未获取到公开研报
- efort | 埃夫特 | A股 | research | 当前数据源未获取到公开研报
- nano | 纳微科技 | A股 | research | 当前数据源未获取到公开研报
- riying | 日盈电子 | A股 | research | 当前数据源未获取到公开研报
- siasun | 机器人 | A股 | research | 当前数据源未获取到公开研报
- siasun | 机器人 | A股 | announcements | 当前公告数据源未返回结果
- unitree | 宇树科技 | A股 | priceHistory | K 线数据不足或接口未返回
- wanxiang-qc | 万向钱潮 | A股 | research | 当前数据源未获取到公开研报
- zhaomin | 肇民科技 | A股 | research | 当前数据源未获取到公开研报

## 5. 异常值 / 警告

- kaidi: PE TTM 极端值：1261.17

## 阻断错误

- 无

## Stale 明细

- 无

## 6. 下一步建议

- research 缺失继续保留为真实缺口，不用 mock 研报填充。
- announcements 缺失继续保留为真实缺口，不用 mock 公告填充。
- 继续保持 A 股抓取串行限流，避免对东财端点高频请求。
- 港股财务、研报、公告等待后续 Provider 接入；当前保持 not_implemented。
