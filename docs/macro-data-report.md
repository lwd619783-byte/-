# Macro Data Fetch Report

- Generated: 2026-07-04T19:22:16+08:00
- Output: `src\data\real\macro.generated.json`
- Sources: 21
- Indicators: 8
- Metrics: 27/31 real
- Errors: 1

## Missing / Failed Items
- 美元/人民币中间价: 日期：2021-05-13；当前接口仅返回旧数据，按 stale 处理 (AKShare macro_china_rmb)
- 美元/人民币中间价: 日期：2021-05-13；当前接口仅返回旧数据，按 stale 处理 (AKShare macro_china_rmb)
- 城镇调查失业率: 国家统计局接口当前返回异常，保留待接入 (AKShare macro_china_urban_unemployment)
- 美元/人民币中间价: 日期：2021-05-13；当前接口仅返回旧数据，按 stale 处理 (AKShare macro_china_rmb)

## Source Errors
- macro_china_urban_unemployment: JSONDecodeError: Expecting value: line 1 column 1 (char 0)
