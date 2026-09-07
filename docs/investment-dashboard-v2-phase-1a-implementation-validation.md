# V2 Phase 1A — Local Core Foundation 实施验证记录

日期：2026-09-07。状态：实现完成，待独立远端终局审查；不是 production admitted。PR / 精确 HEAD CI / 合入均未进行。

- Actual base：`285ff87e8d109730956517edcaeadec501d79f4c`。
- Branch：`feat/v2-phase-1a-local-core-foundation`。
- 开工重新 fetch 后 origin/main 与任务快照一致；原工作区干净，同名分支不存在，从 origin/main 建立本分支。保留另外两个既有 worktree。
- `contracts/v1/**`、P0 页面与真实 generated 数据无修改。执行索引只更新 P0 / 1A / 1B 状态，历史设计和审计记录保留。

## 实现与依赖

```text
local-core/
  contracts/registry.ts           V1 schema 编译、静态 invariant
  db/connection.ts                Node SQLite 连接、共享同步事务
  db/migrations.ts                preflight / migrate / readonly verify
  db/migrations/001-local-core.sql
  db/entity-adapter.ts            EntityRepository
  db/audit-adapter.ts             AuditRepository
  domain/                        types / errors / normalization / resolver
                                 canonical JSON / audited EntityService
  ports/index.ts                 五个最小 ports，无任意 SQL
  paths.ts                       默认目录、显式路径与测试隔离
  cli.ts                         contracts / init / verify
  tests/                         纯虚构 fixture、临时 DB、进程退出测试
```

运行时精确锁定 `better-sqlite3@13.0.3`（正式 SQLite）、`ajv@8.20.0`（Draft 2020-12）、`ajv-formats@3.0.1`（date-time）。开发类型为 `@types/better-sqlite3@9.6.0`、`@types/node@22.20.1`。没有 ORM、额外 validation framework 或 Node polyfill；现有依赖未升级。`engines.node = >=22`。

`tsconfig.local-core.json` 独立 strict / noUncheckedIndexedAccess / exactOptionalPropertyTypes / noUnused 检查，NodeNext 输出到 gitignored `.local-core-build/`。前端 `tsconfig` 没有通过 exclude 绕过 Local Core；`build` 明确包含 `local:typecheck`。CLI runner 先严格编译再直接交给 Node，专项测试不经过 Vite 转译。

## 合同与实体

5 个 V1 schema root、全部 37 个 definition 编译成功，识别 27 个冻结版本标识。unknown ref、unknown format、非法 date-time、额外请求字段、错误版本均拒绝。Ajv 保留 strict；仅 `strictRequired=false` 兼容冻结 schema 中父层 properties 与条件 then.required 的结构，不放松 payload required 校验。

静态门禁检查 M0-M13 各一次、名称非空、ID 唯一、AI deny 与 allow/confirmedOnly 含 wildcard 的重叠、必要 hard-deny 保留、case ID 唯一及 allowAutoCreate=false。版本标识直接取合同 const，并有完整 27 项版本清单回归测试。

`contract-test-cases.v1.json` 的 21 个完整业务场景全部保留 `declared / not-yet-executable`。例如 S-001 的 deny 静态部分已验证，但未来 MCP 暴露部分尚不存在，因此不把整个场景标绿。当前专项测试单独执行；对未来域 sample 的校验明确只代表 schema-level validation，不代表业务 invariant 或域实现。

Entity Registry 存储冻结 enum、opaque UUID、独立 aliases/provider identifiers、revision 和本地存储时间。FK 与 DB enum CHECK 生效；provider 二元键全局唯一，alias 仅实体内按 normalized_alias 唯一。拒绝同一实体内归一后重复 alias，避免丢失 raw alias。rename 保留 ID；merge 保留来源行、aliases 和 provider 所有权，使用 merged/mergedIntoEntityId，不自动重定向或删除历史身份。merge 要求确认和 revision 匹配。

Resolver 仅使用 NFKC、trim、whitespace collapse、ASCII case normalization，保留请求原文。优先 exact exchange+ticker，再 expected types 内 canonical、alias。唯一 active 强匹配 resolved，多条 active 强匹配 conflicted；候选/归档/合并身份、只有 ticker 或 hint 不一致时 needs_user_confirmation；无匹配 not_found。无 fuzzy、embedding、LLM、first-match fallback 或自动创建。

**Provider identifier 接口缝隙：** `lookupProviderIdentifier(providerId, providerIdentifier)` 是 Node 内部 repository 能力，精确匹配原值，重复键拒绝并回滚多表写入。外部 V1 ResolutionRequest 未添加任何字段，也不借用 rawName/contextText/tickerHint。以后若作为 Research Bridge 公共请求输入，必须先修改合同并重新审计。

**Audit EntityRef 类型缝隙：** RegistryEntry 允许 `macro_metric`，V1 Audit EntityRef 不允许该字符串。内部 Registry 完整支持现有 enum；附带审计的 EntityService 对该类型拒绝并回滚，不映射成 `macro`，也不省略审计 identity 伪装成功。未来如需该正式操作，先澄清合同并重新审计。本阶段未建立任何远程实体写入 API。

## 数据库、事务与审计

默认根目录 `~/.investment-research-dashboard/`，支持绝对路径 `INVESTMENT_DASHBOARD_DATA_DIR`；目录为 `data/investment-dashboard.sqlite`、`archive/`、`attachments/`、`backup/`。显式 `--db` 只初始化指定数据库；测试始终使用 OS temp / :memory:。路径检查在 stat/realpath 之前拒绝测试访问默认用户目录，检查真实路径并限制仓库内 DB 到最近 checkout 的 `.local-data/`。

Migration 版本 **1 / 001-local-core**，SHA-256：

```text
339bbd8b1cadb8196fb1b4ac9ab2a48d7fbb48c7452dcea89a3320c34166f1ef
```

checksum 以 UTF-8 SQL、仅 CRLF 转 LF 后计算，其他字节修改均会改变 checksum。新增结构必须新增 migration，不修改已应用 001。

仅创建 schema_migrations、entity_registry、entity_aliases、entity_provider_identifiers、audit_events。初始化先 preflight；写连接设置 foreign_keys=ON、journal_mode=WAL、synchronous=FULL、busy_timeout=5000，额外启用 recursive_triggers。:memory: 的 SQLite journal_mode 为 memory，文件模式为 WAL。迁移整体在 immediate transaction 中执行；未来版本、checksum/名称变化、无有效 metadata 的已有 DB、损坏 DB 均拒绝，不删库、不恢复为空、不回退 LocalStorage。

verify 使用 SQLite readonly + query_only，仅校验 schema version、checksum、integrity_check、foreign_key_check 和从迁移构建的 schema object 对照（含 index/trigger），不迁移、不修复。测试证明主 DB 字节不变；SQLite WAL 的运行时 sidecar 不属于正式数据修复。

五个 ports 不提供 SQL；SQLite driver 使用 ECMAScript private fields，运行时也不通过 repository.db 泄漏。Repository 多表写入与显式 transaction 共享同一连接。同步事务拒绝 async/thenable；事务作用域 repository 到期后拒绝调用。嵌套写入失败会将外层事务标记为必须回滚，即使调用方 catch audit 错误，也不能提交先前 mutation。

Audit append 先将纯 JSON 稳定序列化、合同校验并计算 SHA-256，再持久化完整 canonical payload 与可索引字段。V1 actor/client 是字符串，actor_json/client_json 存储对应 JSON 字符串；event_id/created_at 是存储元数据，没有增加 V1 字段。读取时复核 canonical JSON、digest 和索引字段。success=false 是有效事件。

Repository 无 update/delete；DB trigger 禁止 UPDATE/DELETE，另拦截 INSERT OR REPLACE。EntityService 要求 approved user context，正式 mutation 与其身份/版本 audit 在同一事务提交。事件仅接收 V1 元数据，拒绝额外字段和可识别凭据/SQL dump；调用方仍必须只提供引用和安全标识，不能把此检查当成任意文本的通用 DLP。

测试覆盖全部 11 类 typed error、初始和后续 migration 失败、多表回滚、FK、损坏数据库、重复身份、审计失败以及进程在 commit 前直接退出。回开后没有 half-write 或 false-success audit。

## 工程门禁和命令结果

健康检查新增 Node >=22、独立工程配置/入口、native addon 实际内存连接三项 PASS。检查不会创建默认目录或打开用户数据库；现有 WARN/SKIP 保持不变。

CI 在原有步骤基础上新增 `local:typecheck`、`contracts:validate`、`test:contracts`、`test:local-core` 四步。原有 Provider / PIT / artifact / data audit / unit / bundle gate 全保留，测试只用内存/临时 DB、无网络请求。依赖安装仍用 npm ci。远端 CI 尚未执行，需独立审查后授权 PR，并在干净环境核验最终 SHA。

Vite boundary plugin 检查 resolve、parsed module 与最终整个模块图/全部 chunk；不仅依赖源码 import 搜索。静态、动态和传递 Node import 的实际 Vite 负测试会失败；Node SSR/Vitest 明确保持可用。现有 tracked `vite.config.js` 同步其 TS 配置。生产构建检查 **2,291 graph modules / 1 chunk / 0 forbidden**，输出 `dist/local-core-boundary.json`。better-sqlite3、Ajv、Local Core、Node builtins 均未进入浏览器图。原预算通过：initial JS 2,332,952 bytes，gzip 533,113 bytes。

| 验证命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm run agent:skills:check` | 0 | 3 个 Skill 检查通过，未安装或升级 |
| `npm run env:check` | 0 | 39 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `npm run --silent env:check:json` | 0 | 同上，JSON 可解析 |
| `npm run local:typecheck`（亦由 build 执行） | 0 | 独立严格 Node TypeScript |
| `npm run contracts:validate` | 0 | 5 schemas / 37 definitions / 27 versions |
| `npm run test:contracts` | 0 | 36/36 |
| `npm run local:db:init -- --db <absolute-temp-db>` | 0 | OS temp 下初始化 schema 1 |
| `npm run local:db:verify -- --db <same-absolute-temp-db>` | 0 | checksum / integrity / FK / schema objects 通过 |
| `npm run test:local-core` | 0 | 44/44；fixture/temp DB 自动清理 |
| `npm test` | 1 | 本机 nested worktree 误扫描，2 个旧分支 Node test 文件没有 Vitest suite；100 suites / 1,637 tests 通过 |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前分支隔离验证：38 suites / 573 tests |
| `npm run data:audit` | 0 | errors=0，P0=0，既有 warnings=24 |
| `npm run build` | 0 | 前端 + Local Core typecheck + browser boundary + 原预算通过 |
| `git diff --check` | 0 | 无 whitespace error |

上述 temp CLI 测试已手工清理；未对真实默认用户 DB 执行 init。data:audit 产生的历史报告时间/行号变动已恢复，当前证据仅写本记录，没有重写历史报告。

## 环境限制与最终范围审查

- 原始 npm test 的两个失败文件分别位于旧 `stage-4-1-r2` / `v2-phase1` worktree。没有修改默认 glob、旧分支或测试要求。干净 PR CI 仍是待验收项。
- 既有 Company-guidance workflow-index 的 CRLF 差异仍在：工作树 244,979 bytes、base blob 240,254 bytes、4,725 个 CRLF；归一 LF 后与 actual base 完全相同。`core.autocrlf=true` 未改，generated 文件无 diff，未运行生成/刷新修复。
- 环境 WARN：Node/Python/Git 多安装路径、Python 未固定依赖与 mootdx/httpx 版本冲突、工作中未提交状态、既有 ignore 诊断、旧数据 metadata/partial/legacy 状态。npm 安装报告 8 个依赖漏洞，未扩大范围执行 audit fix。既有 Vite 大 chunk 提示仍在，正式 bundle budget 通过。
- 终局检查覆盖 contracts、migration/checksum/future schema、损坏 DB、事务/进程退出、Entity identity/冲突/provider seam/no-auto-create、Audit append-only/digest/atomicity、Node/browser、CI/health、数据安全及 Phase 1B 范围。
- `.gitignore` 覆盖 Local DB、WAL/SHM/journal 与编译输出；没有既有版本化 DB fixture 被误伤。所有 fixture 都是 Example / TEST / fixture-provider 构造，无真实资产、交易、凭据、本机绝对路径或数据库二进制。
- 未实现 Account/Portfolio/Asset/Transaction/CashFlow/Position、DCA、真实迁移、Screenshot/Asset Import、Contribution、Bridge HTTP/MCP、Backup/Restore 正式流程、Wiki、Agent 调度、认证、多用户、云 DB、LocalStorage 迁移、V2 UI、收益率计算、Provider 刷新或真实交易。合同中保留这些 schema/enum 不表示已实现这些域。
- 本次仅普通 commit/push 功能分支，停止在独立远端终局审查之前；不创建 PR、不合并 main、不 force push、不 rebase，不进入 Phase 1B。
