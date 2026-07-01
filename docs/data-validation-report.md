# 数据校验报告

- 生成时间：2026-06-30T23:32:09+08:00
- manifest 更新时间：2026-06-30T23:27:55+08:00
- 真实行情数量：19
- 有价格历史数量：19
- 财务缺失数量：2

## 阻断问题
- 无

## 警告 / 缺口
- lenovo: 行情缺失 - yfinance unavailable for lenovo: No module named 'yfinance'
- beigene: 行情缺失 - yfinance unavailable for beigene: No module named 'yfinance'
- lenovo: 价格历史为空
- beigene: 价格历史为空

## 验收提示
- 若真实行情或价格历史少于 5，只能视为数据源联通性不足，前端仍应以 mixed/missing 状态降级展示。
- 本报告不验证投资结论，只验证数据形态、更新时间和基本数量级。
