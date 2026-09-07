---
name: investment-dashboard-domain-workflow
description: Route non-UI investment-dashboard Provider, PIT, Entity/Resolver, Evidence, Research Event, Thesis, provenance, ingestion and Research OS domain work to minimal project sources and checks. Pure SQLite/repository mechanics use local-core-workflow.
---

# Investment Dashboard Domain Workflow

这是上下文和验证路由，不是第二套业务合同。事实由 root `AGENTS.md`、冻结 contracts、目标 Provider / feature 文档和当前代码、测试决定。先按任务选择一行，再读取直接涉及的部分，不一次加载所有 V2 或 Provider 文档。

| 任务 | 最小上下文 | 相应验证 |
| --- | --- | --- |
| Provider、新数据源、expectations、公司 / 行业研究数据、source admission | 目标 Provider 文档；`src/data/data-source-registry.ts`；`docs/data-audit-v1.md` 的相关项；对应 Stability / admission 和现有 tests | 对应 fixture tests、validator；涉及来源传播时 `npm run data:audit`；不默认刷新 Provider |
| PIT、data quality、时间 / provenance | `docs/market-regime/`、`config/market-regime/` 中目标 registry / source audit / observation / schema；目标代码和测试 | 对应 PIT / catalog fixture；验证 observation、effective、publication、releaseAvailableAt 没有混用 |
| Contract / schema / permissions | `contracts/v1/README.md` 加目标 schema、`permissions.v1.json` 中目标 operation 及相关 cases | `npm run contracts:validate`、`npm run test:contracts` 和受影响领域测试 |
| Entity / Resolver、Evidence、Research Event、Thesis、research ingestion | `docs/investment-dashboard-v2-research-os-and-bridge-design.md` 的目标域；目标 V1 contract；当前实现，例如 `local-core/domain/` 与其测试 | 目标域用例；涉及 Entity identity / revision 时覆盖歧义、确认、审计和失败状态 |
| Research OS / Bridge 的明确集成工作 | 上述 V2 设计的直接相关章节；仅 ingestion / Asset 输入需要时补 `docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`；冻结或实施范围有疑问时查 `docs/investment-dashboard-v2-final-contract-audit-v1.md` | 目标合同、permissions、provenance 和边界检查；不把 Skill 触发当成 Bridge 实施授权 |

新 Provider 可以主动研究公开 API / 官方数据入口，但 **discovery != production admission**；数据源仍需 provenance、许可 / 可持续性、schema、稳定性、PIT 和 admission 审计。不安装 `public-apis` 仓库，不把搜索结果直接注册为正式生产来源。

沿用真实缺失、partial、stale、conflicted 等状态；不猜数据，不把未知补成 0。来源事实、用户判断、AI 研究和派生结果分别保留 provenance；不让事后信息进入历史 PIT。Entity 歧义 fail closed，不自动创建或合并；需要 revision / correction / append-only 的记录不能覆盖。

合同无法表达真实场景时先提出合同版本调整并完成 audit，再依赖新语义；不创造平行字段、权限或正式数据系统。Skill 不硬编码当前覆盖数字，不替代生产准入。

纯持久化底层任务直接选 `investment-dashboard-local-core-workflow`；领域任务确实跨到 SQLite / repository 实现时才补读它。验证随影响选择，保留原有门禁，不把 tests passed 写成 production admitted。
