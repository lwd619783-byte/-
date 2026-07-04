# A Stock Data 数据校验报告

- 生成时间：2026-07-05T00:47:19
- 口径：以 `src/data/real/stock-universe.generated.json` 为唯一 Universe 来源。
- 港股状态：第一阶段明确标记为 `unsupported_market`，不纳入 A 股覆盖率分母。

## Universe Overview

- Universe 总数：59
- 市场分布：{"A股": 56, "港股": 3, "美股": 0, "未上市": 0}
- 支持分布：{"A股": 56, "港股": 0, "美股": 0, "未上市": 0}
- 不支持分布：{"A股": 0, "港股": 3, "美股": 0, "未上市": 0}
- 未上市公司：1，不进入行情覆盖分母。

## A 股覆盖

- Universe 总数：59
- Universe 市场分布：{"A股": 56, "港股": 3, "美股": 0, "未上市": 0}
- Universe 支持分布：{"A股": 56, "港股": 0, "美股": 0, "未上市": 0}
- Universe 不支持分布：{"A股": 0, "港股": 3, "美股": 0, "未上市": 0}
- Manifest Universe 总数：59
- A 股行情覆盖：56/56 (100.0%)
- A 股 K 线覆盖：56/56 (100.0%)
- A 股财务覆盖：56/56 (100.0%)
- 财务报告期覆盖：56/56 (100.0%)
- F10 覆盖：56/56 (100.0%)
- 行业分类覆盖：56/56 (100.0%)
- 研报覆盖：50/56 (89.3%)
- 公告覆盖：55/56 (98.2%)
- 信号覆盖：56/56 (100.0%)
- 板块归属覆盖：56/56 (100.0%)
- 港股支持：unsupported_market 3/3；A 股统计未计入港股
- stale 数据数量：0
- missing 字段数量：14

## 港股 Unsupported List

- lenovo | 联想集团 | 0992.HK | unsupported_market
- ubtech | 优必选 | 9880.HK | unsupported_market
- sunny-optical | 舜宇光学科技 | 2382.HK | unsupported_market

## 阻断错误

- 无

## 异常数据 / 警告

- leaderdrive: PE TTM 极端值：654.21

## 缺失明细

- dongli | 宁波东力 | A股 | research | missing
- dongli | 宁波东力 | A股 | research | missing
- efort | 埃夫特 | A股 | research | missing
- efort | 埃夫特 | A股 | research | missing
- riying | 日盈电子 | A股 | research | missing
- riying | 日盈电子 | A股 | research | missing
- siasun | 机器人 | A股 | research | missing
- siasun | 机器人 | A股 | announcements | missing
- siasun | 机器人 | A股 | research | missing
- siasun | 机器人 | A股 | announcement | missing
- wanxiang-qc | 万向钱潮 | A股 | research | missing
- wanxiang-qc | 万向钱潮 | A股 | research | missing
- zhaomin | 肇民科技 | A股 | research | missing
- zhaomin | 肇民科技 | A股 | research | missing

## Stale 明细

- 无

## 下一步建议

- 继续保持 A 股抓取串行限流，避免对东财端点高频请求。
- 港股 Provider 接入前继续保持 `unsupported_market`，不得用 mock 数据伪装真实行情。
- 机器人未上市公司只进入研究池或私有公司清单，不进入上市股票行情覆盖分母。
