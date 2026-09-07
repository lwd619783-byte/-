---
name: investment-dashboard-local-core-workflow
description: Route investment-dashboard SQLite, migrations, LocalDatabase, Entity/Audit repositories, synchronous transactions, CLI, local-first paths and Node-only persistence work to the existing Local Core. Excludes UI and standalone research diagrams.
---

# Investment Dashboard Local Core Workflow

复用已经合入的 Phase 1A Local Core，不设计第二套持久化。root `AGENTS.md`、冻结 contracts、当前代码和测试仍是事实源；本 Skill 只提示上下文和验证。Phase 1B 的 Account / Asset / DCA persistence 后续必须复用此基础；本 Skill 不包含或授权任何 Phase 1B 业务实现。

| 涉及部分 | 只读取对应实现及其测试 |
| --- | --- |
| 架构 / repository seam | `local-core/ports/index.ts`；`docs/investment-dashboard-v2-phase-1a-local-core-foundation.md` 的相关边界 |
| SQLite / transaction | `local-core/db/connection.ts`、目标 adapter；`local-core/tests/database.node.mjs`、`integration.node.mjs` 的相关用例 |
| migration / checksum | `local-core/db/migrations.ts`、目标 migration；现有迁移与 future-version / rollback 测试 |
| Entity / Audit persistence | `local-core/db/entity-adapter.ts` 或 `audit-adapter.ts`；`local-core/domain/entity-service.ts`；对应 `entities.node.mjs` / `audit.node.mjs` |
| CLI / path / Node boundary | `local-core/cli.ts`、`paths.ts`、`scripts/run-local-core.mjs`、`tsconfig.local-core.json`、`scripts/local-core-boundary.mjs` |
| Backup boundary / restore | `docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md` 的目标部分，加 restore contract、backup manifest、permissions；不加载所有 V2 文档 |

必须保留：

- Node-only；SQLite adapter、native addon、Local Core 不进入 browser graph。Repository port 不暴露 raw SQL，不绕开 EntityService / repository boundary。
- migration 只新增版本，不改写已应用 migration 或历史 checksum；checksum 不符、future version、未知 schema 均 fail closed。
- transaction 同步且原子；Entity mutation 和对应 Audit 同事务，失败不留 half-write / false-success audit。
- Audit append-only，identity / revision 与 digest 校验不丢失；DB corruption 不 silent reset、不删除或自动修复用户 DB。
- tests 只用 temp / memory，不读取真实用户 DB。遵守现有 Local-first path safety；CLI 验证不得默认打开用户路径。
- Backup / Restore 保留预检查、pre-restore backup 和合同要求的用户确认。合同无法表达时先改 contract + audit，不从底层绕过确认。

按影响选择 `npm run local:typecheck`、`npm run test:local-core`；合同相关再选 `npm run contracts:validate` / `npm run test:contracts`；Node/browser 边界相关必须 `npm run build` 并检查 boundary receipt。CLI init / verify 仅对明确 temp DB 演练。保留现有 CI 和 regression tests，不因“更少代码”降低正确性要求。
