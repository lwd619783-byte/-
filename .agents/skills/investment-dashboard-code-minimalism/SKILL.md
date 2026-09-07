---
name: investment-dashboard-code-minimalism
description: Use only for an explicit investment-dashboard request to remove duplicate helpers, reduce boilerplate, or find a minimal safe implementation. Conservative, task-scoped simplification; does not activate on ordinary coding work or persist into unrelated tasks.
---

# Investment Dashboard Code Minimalism

这是项目自有的保守工作流，采用 Ponytail 经审计的复用原则，不加载其原始 broad trigger、持续模式或 runtime。来源与拒绝原版的依据见 `docs/agent-skills.md` 的 Ponytail 审计项。

仅在当前任务明确要求去重 / 最小实现时使用；默认 **conservative / lite**，不启用 full / ultra / aggressive，不延续到无关任务。先读目标代码、调用方和现有验证，判断确实需要实现什么，然后依次考虑：

1. 是否真的需要新增代码；不要跳过用户已经明确要求的能力。
2. 复用仓库已有能力。
3. 使用标准库。
4. 使用平台原生能力。
5. 使用已安装依赖。
6. 最后才新增满足实际需求的最少清晰代码，减少重复 helper、boilerplate 和没有实际用途的抽象。

**less code != less correctness**。不以行数替代可读性和可审计性；若简化会削弱历史完整性、数据真实性、correctness 或安全边界，则不做该简化。

下列区域不适用删减保障的简化：`contracts/v1/**`、schema validation、permissions、PIT / point-in-time、provenance、evidence integrity、Provider Stability / production admission、Audit append-only、transaction atomicity、migration history / checksum、Entity identity / revision、ledger invariants、financial calculations、idempotency、backup / restore safeguards、data authenticity checks、CI gates、regression tests、security / secret boundaries。

保护这些区域的 guard、错误传播、确认、校验和测试不能作为“冗余”删除。领域规则以 root `AGENTS.md`、冻结合同及目标事实源为准，不把本 Skill 当新业务合同。不自动增加依赖、修改 Agent 配置或启动 MCP / plugin / hooks / background service。

选择最小安全 diff，运行直接验证行为的现有检查；说明保留了什么保障和实际结果。不以更短实现掩盖未完成需求。
