# A Stock Data 数据校验报告

- 生成时间：2026-07-05T10:46:12
- 口径来源：`src/data/real/stock-universe.generated.json`
- 港股状态：第一阶段统一为 `unsupported_market`，不纳入 A 股覆盖率分母。

## 1. Universe 口径

- Universe 总数：59
- 市场分布：{"A股": 56, "港股": 3, "美股": 0, "未上市": 0}
- 支持分布：{"A股": 56, "港股": 0, "美股": 0, "未上市": 0}
- 不支持分布：{"A股": 0, "港股": 3, "美股": 0, "未上市": 0}
- 未上市公司：1，单独维护，不进入行情覆盖率。

## 2. A 股覆盖率

- Universe 总数：59
- Universe 市场分布：{"A股": 56, "港股": 3, "美股": 0, "未上市": 0}
- Universe 支持分布：{"A股": 56, "港股": 0, "美股": 0, "未上市": 0}
- Universe 不支持分布：{"A股": 0, "港股": 3, "美股": 0, "未上市": 0}
- Manifest Universe 总数：59
- A 股 quotes 覆盖：56/56 (100.0%)
- A 股 priceHistory 覆盖：56/56 (100.0%)
- A 股 financials 覆盖：56/56 (100.0%)
- 财务报告期覆盖：56/56 (100.0%)
- A 股 profiles / F10 覆盖：56/56 (100.0%)
- 行业分类覆盖：56/56 (100.0%)
- A 股 research 覆盖：50/56 (89.3%)
- A 股 announcements 覆盖：55/56 (98.2%)
- A 股 signals 覆盖：56/56 (100.0%)
- A 股 sectorMembership 覆盖：56/56 (100.0%)
- 港股 unsupported：unsupported_market 3/3，不计入 A 股覆盖率
- stale 数据数量：0
- missing 明细数量：7

## 3. 港股状态

- lenovo | 联想集团 | 0992.HK | unsupported_market
- ubtech | 优必选 | 9880.HK | unsupported_market
- sunny-optical | 舜宇光学科技 | 2382.HK | unsupported_market
- 说明：港股 Provider 尚未接入，不纳入 A 股覆盖率，也不作为 A 股缺失项。

## 4. 缺失明细

- dongli | 宁波东力 | A股 | research | No public research report returned by current data source
- efort | 埃夫特 | A股 | research | No public research report returned by current data source
- riying | 日盈电子 | A股 | research | No public research report returned by current data source
- siasun | 机器人 | A股 | research | No public research report returned by current data source
- siasun | 机器人 | A股 | announcements | Current announcement data source returned no result
- wanxiang-qc | 万向钱潮 | A股 | research | No public research report returned by current data source
- zhaomin | 肇民科技 | A股 | research | No public research report returned by current data source

## 5. 异常值 / 警告

- leaderdrive: PE TTM 极端值：654.21

## 阻断错误

- 无

## Stale 明细

- 无

## 6. 下一步建议

- research 缺失继续保留为真实缺口，不用 mock 研报填充。
- announcements 缺失继续保留为真实缺口，不用 mock 公告填充。
- 继续保持 A 股抓取串行限流，避免对东财端点高频请求。
- 港股 Provider 接入前继续保持 `unsupported_market`。
