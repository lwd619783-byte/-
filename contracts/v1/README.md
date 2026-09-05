# 投资研究看板 V2 · 机器可读合同 V1

> 状态：CONTRACT V1 FROZEN / PHASE 1 IMPLEMENTATION ADMITTED
>
> 本目录不是业务代码，而是 Research Bridge、投研看板、资产账本和备份服务在 Phase 1 实现中共同遵守的数据标准。终局合同审计见 [`docs/investment-dashboard-v2-final-contract-audit-v1.md`](../../docs/investment-dashboard-v2-final-contract-audit-v1.md)。

## 为什么先做合同

我们希望以后网页端 ChatGPT、看板前端、本地数据库、备份程序使用同一套“说法”。

例如 ChatGPT 说“把焦煤研究推送到看板”，不能由每个模块各自猜字段；它必须先生成符合合同的研究包，由 Research Bridge 预览拆分，用户确认后再落库。

同理，截图识别出的交易不能直接记账，而要先形成候选导入包，经过核对后才写入正式账本。

## V1 文件

- `research-asset-os.contracts.v1.schema.json`
  - 行业 14 模块
  - 行业专属扩展
  - ChatGPT 研究贡献包
  - 一键推送预览计划
  - 账户、资产、交易、现金流、持仓快照
  - 定投计划与定投执行
  - 历史资产迁移
  - 备份清单与恢复计划
  - Research Bridge 审计记录
- `permissions.v1.json`
  - ChatGPT / Research Bridge 的权限边界
- `contract-test-cases.v1.json`
  - 实现时必须通过的关键业务测试场景

## 设计原则

1. **事实和观点分开。** AI 研究内容不能伪装成行情、财务、官方宏观数据。
2. **一次确认，多模块落库。** 使用 Contribution Plan，而不是让用户逐项批准多个底层动作。
3. **历史不可悄悄改写。** Thesis、Evidence、审计、备份记录以 revision / append-only 为优先。
4. **截图先核对再记账。** 图片识别结果只是候选事实。
5. **研究模板有骨架、无强迫。** 14 个模块始终存在，但可以为空、不适用或只做轻量研究。
6. **资产系统为未来全资产预留。** V1 只导入长期价值账户，但结构不写死为证券账户。
7. **本地优先。** 数据库保持本地；MCP/Research Bridge 只是受控入口。
8. **备份独立运行。** 备份不依赖 ChatGPT/MCP 在线。

## 版本规则

V1 合同使用稳定字符串标识，例如：

- `research-bridge.v1`
- `industry-research-module.v1`
- `asset-ledger.v1`
- `backup-manifest.v1`

后续如发生不兼容修改，新增 V2，不直接破坏 V1 历史数据。

## 当前实现准入

2026-09-05 的终局合同审计已经 **PASS FOR PHASE 1 IMPLEMENTATION**。Phase 1 可以按审计列明范围实现合同校验、本地数据库基础、Research Bridge contribution 流程、资产 / DCA 基础、导入、审计和本地备份 / 恢复骨架。

这不是全量 Production Admission。以下边界继续有效：

- XIRR / TWR / 年化收益正式值仍需后续验证；
- AI 真实交易继续 HARD DENY；
- 未完成 Probe 的网盘 Provider 不得作为正式生产能力上线；
- 未完成安全审计的公网 MCP 入口不得正式暴露；
- 长期账户正式迁移仍需要用户确认。

实现过程中如果发现合同无法表达真实场景，应先修改合同并重新审计，再修改业务代码；不得在业务代码中私自增加另一套字段语义或例外规则。