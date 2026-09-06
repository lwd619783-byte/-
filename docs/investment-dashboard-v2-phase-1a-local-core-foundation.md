# 投资研究看板 V2 Phase 1A：Local Core Foundation 实施基线

> 状态：IMPLEMENTATION BRIEF / READY FOR IMPLEMENTATION  
> 日期：2026-09-06  
> 基线：`main` @ `24f406bee7d7542244d1e2b19ea43328b409f695`  
> 上位事实源：`contracts/v1/**`、`docs/investment-dashboard-v2-final-contract-audit-v1.md`、`docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md`

本文件只关闭 **Phase 1A 的实现级选择、范围、边界和验收标准**。它不修改 `contracts/v1` 的业务语义，也不把后续 Asset / DCA / Contribution / Backup 功能提前实现。

历史设计文档中的 `NO IMPLEMENTATION` 表示其当时阶段状态；当前实现准入以 2026-09-05 的最终合同审计 `PASS FOR PHASE 1 IMPLEMENTATION` 为准。

---

## 1. Phase 1A 目标

Phase 1A 只搭建 V2 后续域都要依赖的本地核心基础设施：

1. `contracts/v1` 自动校验与可执行 contract tests；
2. Local-first 数据库最小可用层；
3. Entity Registry / Resolver；
4. append-only Audit Log；
5. Repository / Domain Service 基础接口与测试边界。

完成后应能证明：

- 合同可以被机器编译、校验并在 CI 中执行；
- 本地数据库可以初始化、迁移、验证、事务回滚；
- 正式实体拥有稳定 ID，并能按明确规则解析名称 / ticker / provider identifier；
- 低置信度、重名和冲突不会被自动写成正式实体；
- 审计事件只能追加，不能通过普通 repository 修改或删除；
- 后续 Phase 1B–1D 可以复用同一 Domain / Repository 边界，而不依赖浏览器 LocalStorage 或某个云数据库。

---

## 2. 明确不做什么

Phase 1A **不实现**：

- Portfolio / Account / Asset / Transaction / CashFlow / Position 正式业务流程；
- DCA Plan / Execution；
- Legacy 长期账户正式迁移；
- Screenshot / Asset Import；
- Industry 14 模块正式存储与 UI；
- Contribution prepare / plan / commit；
- Research Bridge HTTP / MCP 远程入口；
- Backup Provider、云盘上传、Restore 正式流程；
- XIRR / TWR / 年化收益；
- Authentication / multi-user / cloud database；
- 现有 Watchlist / Earnings Expectation LocalStorage 迁移；
- 页面重构或 V2 UI。

不要为了“顺手”扩大范围。

---

## 3. Local-first 实现形态

正式边界继续采用：

```text
Dashboard UI / Future MCP / Local CLI
              ↓
       Local Domain Service
              ↓
        Repository Ports
              ↓
          SQLite DB
```

### 3.1 数据库引擎

Phase 1A 选择 **SQLite** 作为 Local Database，并使用 Node 侧 `better-sqlite3` adapter。

理由：

- 当前产品是单用户、本地优先，不需要多租户数据库；
- SQLite 提供真实事务、外键、约束、WAL 和可验证的文件级备份基础；
- `better-sqlite3` 的同步事务模型适合当前低并发本地 Domain Service；
- 数据库能力只存在于 Node / Local Domain Service，不进入浏览器 bundle；
- Repository Port 隔离具体 driver，未来如更换 SQLite driver 或商业化迁移 PostgreSQL，不改变 V1 Domain Contract。

实现时：

- 增加并锁定 `better-sqlite3`；
- 项目 Node 基线设为 `>=22`；
- 不使用浏览器 SQLite / WASM 作为正式主库；
- 不把数据库文件放进 `public/`、`src/`、Git tracked path 或 Vercel 静态资产；
- 不让 React 组件直接 import SQLite adapter。

### 3.2 本地数据目录

默认运行数据放在仓库之外：

```text
~/.investment-research-dashboard/
  data/
    investment-dashboard.sqlite
  archive/
  attachments/
  backup/
```

允许通过 `INVESTMENT_DASHBOARD_DATA_DIR` 覆盖根目录。

测试必须使用临时目录 / `:memory:`，不得读取或覆盖真实用户数据库。

仓库内若需要开发态临时目录，只能使用明确 gitignored 的 `.local-data/`，并不得把真实资产或研究数据写入测试 fixture。

---

## 4. SQLite 安全与持久化基线

数据库连接初始化至少启用：

```text
PRAGMA foreign_keys = ON
PRAGMA journal_mode = WAL
PRAGMA synchronous = FULL
PRAGMA busy_timeout = 5000
```

要求：

- migration 必须事务化；
- migration 失败时不得留下半迁移状态；
- repository 多表写入必须通过显式 transaction boundary；
- 数据库打开后必须验证 schema version；
- 不支持的未来 schema version 必须 fail closed；
- 不通过 silent reset、自动删库或自动重建来“修复”损坏数据库；
- 损坏 / migration failure 应返回明确诊断并保留原文件。

---

## 5. Migration 与 Schema Metadata

建议目录：

```text
src/local-core/
  db/
    connection.ts
    migrations/
    migrate.ts
    verify.ts
  contracts/
  entities/
  audit/
  ports/
```

也可以采用等价、清晰且不增加 `App.tsx` 耦合的目录结构；不要把 V2 domain logic 塞进现有页面组件。

Phase 1A 至少建立：

### `schema_migrations`

```text
version INTEGER PRIMARY KEY
name TEXT NOT NULL
checksum TEXT NOT NULL
applied_at TEXT NOT NULL
```

规则：

- migration 文件不可在已应用后静默改写；
- checksum 不一致必须报错；
- 未来结构变化新增 migration，不重写 `001`；
- migration 只由 Local System / operator path 执行，不作为 AI Domain Tool 暴露。

---

## 6. Entity Registry 最小 Schema

`entity-resolution.v1.schema.json` 是业务合同；数据库表只是持久化映射，不得创造第二套实体语义。

### 6.1 `entity_registry`

至少保存：

```text
entity_id TEXT PRIMARY KEY
entity_type TEXT NOT NULL
canonical_name TEXT NOT NULL
status TEXT NOT NULL
market TEXT NULL
exchange TEXT NULL
ticker TEXT NULL
parent_entity_id TEXT NULL
merged_into_entity_id TEXT NULL
user_confirmed INTEGER NOT NULL DEFAULT 0
revision INTEGER NOT NULL
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

数据库层约束必须覆盖当前 contract enum，并为 `parent_entity_id` / `merged_into_entity_id` 建立可验证引用关系。

### 6.2 `entity_aliases`

至少保存：

```text
entity_id TEXT NOT NULL
alias TEXT NOT NULL
normalized_alias TEXT NOT NULL
created_at TEXT NOT NULL
PRIMARY KEY (entity_id, normalized_alias)
```

不同实体允许存在相同 alias；冲突由 Resolver fail closed，不通过全局唯一约束强行吞掉真实歧义。

### 6.3 `entity_provider_identifiers`

至少保存：

```text
entity_id TEXT NOT NULL
provider_id TEXT NOT NULL
provider_identifier TEXT NOT NULL
created_at TEXT NOT NULL
PRIMARY KEY (provider_id, provider_identifier)
```

同一 provider identifier 不得映射到两个正式实体。

### 6.4 Stable ID

正式 Entity ID 使用一次生成后永久保存的 opaque UUID；实现可使用 `crypto.randomUUID()`。

禁止：

- 用 canonical name / ticker hash 直接生成可变业务主键；
- 因名称变化生成新的正式 entity；
- Resolver `not_found` 时自动创建正式 entity。

实体 merge 通过 `status=merged` + `mergedIntoEntityId` 表达，不 hard delete 历史实体。

---

## 7. Entity Resolver V1 行为

Resolver 输入 / 输出必须符合 `entity-resolution.v1.schema.json`。

### 7.1 Normalization

仅做确定性、可解释 normalization：

- Unicode NFKC；
- trim；
- 连续空白折叠；
- ASCII case normalization；
- 保留原始输入用于 audit。

不要在 Phase 1A 引入黑盒 embedding / LLM entity matching。

### 7.2 匹配优先级

从高到低：

1. exact provider identifier；
2. exact `exchange + ticker` / 可表达的 market identity；
3. expected entity type 内 exact canonical name；
4. expected entity type 内 exact alias；
5. 其余情况不自动 resolve。

结果规则：

- 唯一强匹配：`resolved`；
- 多个合法匹配：`conflicted`；
- 存在候选但不足以唯一确认：`needs_user_confirmation`；
- 无候选：`not_found`；
- `allowAutoCreate` 永远为 `false`。

Phase 1A 可以返回 candidate list，但不得用模糊分数绕过人工确认。

---

## 8. Audit Log 最小实现

`BridgeAuditEvent` 继续是上层审计事件合同。Phase 1A 建立 append-only persistence。

### `audit_events`

建议至少保存可索引字段与完整 canonical payload：

```text
event_id TEXT PRIMARY KEY
request_id TEXT NOT NULL
timestamp TEXT NOT NULL
actor_json TEXT NOT NULL
client_json TEXT NOT NULL
operation TEXT NOT NULL
success INTEGER NOT NULL
payload_json TEXT NOT NULL
payload_sha256 TEXT NOT NULL
created_at TEXT NOT NULL
```

规则：

- append 前先通过 V1 contract validator；
- `payload_json` 使用稳定 JSON serialization 后计算 SHA-256；
- repository 不提供 update / delete；
- 数据库增加防御性 trigger，阻止普通 `UPDATE` / `DELETE` 修改审计历史；
- 失败操作也可形成审计事件，不把 `success=false` 当成无效记录；
- audit 中不得写 secret、token、credential、raw database dump 或备份密钥。

Phase 1A 不需要建立公网 Audit API。

---

## 9. Contract Validation

采用 JSON Schema Draft 2020-12 validator；Node 实现建议使用 `ajv` + `ajv-formats`，并锁定到 `package-lock.json`。

至少提供：

```text
npm run contracts:validate
npm run test:contracts
```

### 9.1 Schema-level validation

必须：

- 加载并编译 `contracts/v1/*.schema.json`；
- 校验 schema 自身可编译；
- 正确处理 `date-time` format；
- schema 编译失败直接非零退出；
- 不在 validator 中静默忽略 unknown `$ref` / format error。

### 9.2 Registry / invariant validation

程序 validator 至少检查：

- `industry-module-registry.v1.json` 恰好存在 M0-M13，各一次；
- module ID 无重复，canonical name 非空；
- `permissions.v1.json` 中 AI hard-deny 操作不能同时进入 AI allow / confirmedOnly；
- contract test case ID 唯一；
- `entity-resolution` 的 `allowAutoCreate` 语义保持 false；
- 已冻结 schemaVersion / contractVersion 不被实现代码另起一套别名。

### 9.3 Contract tests 分层

`contract-test-cases.v1.json` 是全 Phase 1 测试注册表，不要求 Phase 1A 伪造尚未实现的 Asset / DCA / Restore 功能。

Phase 1A 只把以下可执行能力落地：

- schema compilation / invalid fixture rejection；
- Entity Registry / Resolver 的 low-confidence、duplicate、conflict、no-auto-create；
- Audit append-only；
- migration / transaction / crash-partial-write 基础策略；
- Registry / permissions 静态 invariants。

后续 Domain 的测试 case 保留为 declared / not-yet-executable，不应写假实现只为把它们标绿。

---

## 10. Repository / Domain 边界

Phase 1A 建立最小 ports：

```text
ContractRegistry
LocalDatabase
EntityRepository
EntityResolver
AuditRepository
```

要求：

- Domain Service 不依赖 React；
- React 不直接依赖 SQLite driver；
- repository 返回 domain result / typed error，不向上泄漏任意 SQL；
- SQL 只存在于 DB adapter / migration 层；
- tests 可替换 temp / in-memory adapter；
- future MCP / REST 只能调用 Domain Service，不绕过 repository。

不要在 Phase 1A 为未来所有 Domain 设计庞大 generic ORM。

---

## 11. 错误与 Fail-closed 语义

至少定义可测试的错误类别：

```text
CONTRACT_INVALID
SCHEMA_VERSION_UNSUPPORTED
MIGRATION_CHECKSUM_MISMATCH
DATABASE_OPEN_FAILED
DATABASE_INTEGRITY_FAILED
ENTITY_NOT_FOUND
ENTITY_NEEDS_CONFIRMATION
ENTITY_CONFLICTED
ENTITY_DUPLICATE_IDENTIFIER
AUDIT_APPEND_FAILED
TRANSACTION_ROLLED_BACK
```

错误可以映射为 TypeScript discriminated union 或等价机制。

禁止：

- catch 后返回空数组伪装成功；
- 数据库失败时回退到 LocalStorage 并继续正式写入；
- entity conflict 时任选第一条；
- audit append 失败后仍把受审计 mutation 标记成功。

---

## 12. CLI / Script 入口

Phase 1A 至少提供可重复的本地入口：

```text
npm run contracts:validate
npm run local:db:init
npm run local:db:verify
npm run test:contracts
npm run test:local-core
```

`local:db:init`：

- 只创建 / 迁移指定 Local DB；
- 默认路径按本文件 §3.2；
- 输出不得泄漏用户数据；
- 已是最新 schema 时幂等退出。

`local:db:verify`：

- 只读验证 schema version、migration checksum、foreign key / integrity check；
- 不自动修复或重建数据库。

---

## 13. 测试要求

至少覆盖：

### Contract

- 所有 V1 schema 可编译；
- valid fixture PASS；
- invalid fixture fail closed；
- registry / permissions invariants。

### Database

- 空数据库初始化；
- 重复初始化幂等；
- migration checksum mismatch 拒绝；
- future schema version 拒绝；
- transaction 中途失败整体 rollback；
- foreign key 生效；
- integrity / foreign-key check 可执行。

### Entity

- canonical exact match；
- alias exact match；
- provider identifier exact match；
- exchange+ticker exact match；
- alias collision → conflicted；
- weak / ambiguous candidate → needs_user_confirmation；
- no match → not_found；
- `allowAutoCreate=false`；
- merge entity 不 hard delete。

### Audit

- valid event append；
- invalid event reject；
- update denied；
- delete denied；
- payload digest deterministic；
- transaction failure does not create false-success audit history。

所有数据库测试使用临时 DB，不依赖网络、Vercel 或真实用户数据。

---

## 14. CI 与现有工程集成

Phase 1A 实现完成后：

- `npm test` 继续通过；
- `npm run data:audit` 继续通过；
- `npm run build` 继续通过；
- 新增 `contracts:validate` 与 `test:local-core` 进入 GitHub Actions 的离线门禁；
- CI 只使用 temp / in-memory DB；
- SQLite native dependency 不得进入 Vite browser bundle；
- bundle gate 不因 Local Core 增大初始前端包。

如新增 Node engine 要求，Developer Health Gate 应同步验证，而不是只在 README 里声明。

---

## 15. Git / 数据安全

Phase 1A 不提交任何真实本地数据库。

实现时同步更新 `.gitignore`，至少覆盖：

```text
.local-data/
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.db
```

但不要使用过宽规则误伤仓库中未来明确需要版本控制的测试 fixture；测试 fixture 优先采用程序生成的临时数据库。

任何 sample entity / audit fixture 必须完全虚构，不包含用户真实持仓、账户、交易、收入、文件路径或其他个人金融数据。

---

## 16. 验收标准

Phase 1A 只有同时满足以下条件才算完成：

- [ ] V1 schemas / registries 有自动 validator；
- [ ] contract validator 与相关 tests 在 CI PASS；
- [ ] SQLite Local DB 可初始化、迁移、verify；
- [ ] migration checksum 与 future-version fail-closed 生效；
- [ ] Entity Registry / Resolver 实现并通过冲突 / 低置信度测试；
- [ ] Audit Log append-only，update / delete 在 repository 与 DB 两层均不可作为普通操作；
- [ ] transaction rollback 测试证明不存在 half-write；
- [ ] Local Core 不被打进浏览器 bundle；
- [ ] Developer Health Gate 能验证新增 Node / Local Core 前提；
- [ ] 无真实用户数据、secret、本机绝对路径进入仓库；
- [ ] 原有 tests / data audit / build 全绿；
- [ ] 独立远端审计确认实现没有扩到 Phase 1B+。

---

## 17. Phase 1A 完成后的下一阶段

Phase 1A 通过并合并后，进入 **Phase 1B — Long-term Account & DCA Core**：

```text
Account
→ Asset
→ Transaction / CashFlow
→ Position Snapshot
→ DcaPlan / Constraint Revision
→ DcaExecution
```

Phase 1B 才开始承接长期价值账户；正式历史基准仍为 `2026-08-14`。真实迁移继续留到 prepare / preview / confirm 流程，不在 Phase 1A 自动导入任何真实资产数据。
