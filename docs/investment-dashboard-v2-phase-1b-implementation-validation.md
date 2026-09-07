# Phase 1B 实施验证与合同阻塞记录

日期：2026-09-07。状态：**IMPLEMENTED PARTIALLY / BLOCKED**。这是已实现子集的本地验证记录，不是独立审查 PASS、PR CI PASS、MERGED、MAIN CI PASS 或 Production Admission。

Actual base：`87d33595a49dc99463333ad4637b44b7e33f68a9`。分支：`feat/v2-phase-1b-long-term-account-dca-core`。从 fetch 后一致且干净的 main / origin/main 创建；既有 worktree 保留。当前执行索引中的 Phase 1A / 1A.5 关闭状态已通过对应 main SHA 与 CI completed/success 核对，历史验证文件未回写。

## 实际交付

- 扩展同一 `LocalDatabase.transaction` repository set，保留 Entity/Audit、同步 immediate transaction、嵌套失败回滚和作用域过期防护；`LocalStore.ledger` 只提供读取。
- `AssetService`：Account / Asset create/read，manual Transaction、批量 CashFlow / internal transfer、PositionSnapshot、DCA Plan revision / Execution。正式 append 绑定批准的类型、ID、payload digest、revision、userApprovalRef、idempotencyKey 和 Audit。不能借旧 receipt 写另一类型或更改 payload。
- `AssetImportService`：合同候选二次校验、现有 Entity Resolver、确定性 preview、冻结计划持久化、confirmation request、stale-plan 拒绝、原子 commit / retry。Legacy 使用同一引擎加冻结 baseline / verified evidence / counts / provenance 校验，没有另一套账本。
- 非负绝对交易金额、CashFlow 账户视角符号、同币种双边转账零和及独立 fee；external contribution 只汇总该 type，不把 internal transfer / pending / proposal 计入。
- Position 缺流水数量或 mismatch 返回 warning，warning 保存在确认 receipt，并可按当前 ledger 重新读取核对；不改 Transaction。导入计划中的任何 warning 不允许正式 commit。
- DCA 原始计划、constraint payload 与执行记录保持历史版本；新 revision 只能从未来生效，不重写旧记录；未变的历史 constraint 可保留，新改 constraint 不能倒改旧周期。Execution 保存所用 revision，transaction links 有 FK/唯一约束；pending 只保存金额与 rollover 引用，不生成现金流或交易。
- 没有新增依赖、ORM、CLI 资产写入口、UI、cloud、MCP、broker、Provider refresh、OCR、真实迁移或绩效计算。

新增 `002-long-term-account.sql`，14 张独立表：accounts、assets、asset_tags、transactions、cash_flows、position_snapshots、dca_plans、dca_plan_revisions、dca_constraints、dca_executions、dca_execution_transactions、confirmed_operations、import_plans、import_fingerprints。各正式对象的 canonical V1 payload 配合 generated typed columns、CHECK、FK、索引与 append-only triggers；多值 tags / constraints / links 有子表并在读取时复核。不是单一无约束 generic JSON 账本。

Migration checksums（loader 仅将 CRLF 转 LF）：

| Migration | SHA-256 |
| --- | --- |
| 001-local-core，完全未修改 | `339bbd8b1cadb8196fb1b4ac9ab2a48d7fbb48c7452dcea89a3320c34166f1ef` |
| 002-long-term-account | `88512734008b604639d0b5bc667249d435ca3fecbabbe55c631607ea85f78406` |

001 开工与交付前原始字节 SHA-256 均为 `41456eea0c4db14f85559d5b6e8b194f3267cf9a5d23ac084318865ec4d5f67d`；测试同时核对其内容与 actual base。001、`contracts/v1/**`、package-lock、Provider 与真实 generated data 均无修改。

## 合同阻塞，未自行补字段

| 编号 / case | 当前证据与拒绝行为 | 需要冻结合同澄清的内容 |
| --- | --- | --- |
| CB-1 / A-001 | 设计要求更早可信记录通过 `historical_import` 补录；Transaction.source 仅有 confirmed_screenshot / manual / legacy_import / provider_import，现有 LegacyAssetImport 也没有明确 historical-import 请求标记。本实现拒绝早于 2026-08-14 的提交；无 verified evidence 返回 warn，有 verified evidence 仍明确 CONTRACT_GAP | 更早历史补录的正式请求、provenance 与 baseline 关系；不将 historical_import 悄悄映射成普通 legacy_import |
| CB-2 / A-002 | AssetImportBundle 仅有 declaredExternalContribution，没有账户总额、总额所属账户 / 币种 / 时点及其证据字段；PositionSnapshot 是单资产状态，不能充当账户总额。多加 accountTotal 会被冻结 schema 拒绝。新 screenshot financial candidates 返回 ACCOUNT_TOTAL_CONTRACT_GAP warning，不能 commit | 账户总额的事实形状与 reconciliation 口径；不得用 external contribution、notes 或 userOverrides 借位 |
| CB-3 / A-005 | DcaExecution.period 是 NonEmptyString，没有生效日期语义；rule revision 后，既无 dated transactionIds 又要确认实际申购的 execution 无法唯一确定规则版本，返回 CONTRACT_GAP。带交易日期且落入同一有效 revision 的路径可执行 | execution period 的时间范围或显式 revision 绑定；不私自解析周字符串，也不默认套最新限购 |

这些是对完整 Phase 1B 的阻塞。已实现子集不自动升级为完整完成。未来只在合同重新审计后继续相关路径。DCA 不发明 constraintType 的执行算法、period 日期语法或 planned/executed/pending 的预算等式；这里只保存明确事实、版本、链接，并核对已明确的 invariant。

Legacy prepare 接收独立的、同 importId 的 LegacyAssetImport 与 AssetImportBundle 作为 **Node 内部服务参数**，不添加新的 V1 wire version。保存原 preview metadata，确认和最终 committed 状态由原子 receipt / import marker 表达；无 parser、真实文件读取或资产范围自动发现。V1 本轮只对 synthetic 长期账户迁移演练，未来全资产 enum 支持不代表自动扩大真实迁移范围。

## 确定性、幂等与核对

planDigest 使用现有 canonical JSON + SHA-256，绑定完整排序后的 bundle、legacy metadata、所有正式资产状态和 Entity registry/revision，以及最终 preview 内容。planId 从 digest 派生；没有随机数或当前时间参与计划 ID。任何正式状态或实体变化都保守地使旧 plan 失效；prepare 只保存 preview，commit 在同一 immediate transaction 内重算校验。成功请求的完全相同 key / payload / approval 重试返回原结果，不再追加 Audit。

重复检测覆盖 stable record ID、fingerprint 和 source-evidence + fact digest。完整内容与去重 fact digest 分开；日期、金额、side、账户、资产等实际值保留在去重事实中。单张截图 / 文档可以包含不同记录，不按整张图的 ref 直接吞掉所有行。只有日期 / 金额 / 标的相同但没有共同证据时，可能是两笔真实成交，返回 review warning；不静默合并。相同 fingerprint 但事实冲突直接 blocked。importId 还有独立 replay guard。

金额核对使用输入数字的十进制表示进行精确加法 / 乘法比较，不靠 epsilon 或擅定货币精度强制归零。不将缺少 fees 解释为 0；无法核对时 warning。这里只用于账本 invariant，不输出 XIRR / TWR / 年化收益。

## Executable cases

| Case | 可执行证据 | 完整状态 |
| --- | --- | --- |
| A-001 | baseline 固定、无证据早期数据拒绝、baseline legacy prepare/read 无正式副作用、confirmed atomic commit | partially executable / CB-1 |
| A-002 | 二次 schema 校验、gross/net/币种冲突 warning、声明 external contribution delta、缺 approval 拒绝、snapshot mismatch、截图总额缺口拒绝 | partially executable / CB-2 |
| A-003 | fingerprint / evidence 重复 skip、同证据不同行保留、重复不产生第二笔交易、冲突 blocked | executable |
| A-004 | 配对双记录、同币种零和、fee 独立、external contribution 排除转账、broken pair rollback | executable |
| A-005 | constraint effectiveFrom、未来 revision、旧周期保持、dated execution 版本选择、pending rollover 不生成本金 | partially executable / CB-3 |
| A-006 | candidate / warning / allocation proposal / future transaction 拒绝；执行记录不自动生成交易 | executable |
| A-007 | 黄金 ETF 与黄金股 ETF 的主分类 / 多标签 / 排序独立，Provider identity 不变 | executable |
| A-008 | 合同全部 8 类 Account 与 10 类 Asset，包括非证券资产持久化 | executable |

Registry 的 executable 指测试可运行，不表示缓存的 PASS；A-001/A-002/A-005 明确 partial。P-001 与未实施的研究、备份、恢复、远程权限场景继续 declared / not-yet-executable。

## 验证命令与真实结果

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm run agent:skills:check` | 0 | 9 项只读校验通过，未安装或升级 Skill |
| `npm run env:check` | 0 | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP，READY WITH WARNINGS |
| `npm run --silent env:check:json` | 0 | 同一环境状态，JSON 输出 |
| `npm run contracts:validate` | 0 | 5 schemas / 37 definitions / 27 frozen versions，case availability 区分 partial |
| `npm run test:contracts` | 0 | 36/36 |
| `npm run local:typecheck` | 0 | 严格 Node TypeScript；build 再次包含此门禁 |
| `npm run test:local-core` | 0 | 93/93，包含既有 Entity/Audit/migration/Node boundary 和新增资产专项 |
| `npm run test:assets` | 0 | 49/49，全部 synthetic / temp / memory |
| `npm test` | 1 | 仅 2 个既有 nested worktree 的 company-guidance Node 文件被 Vitest 扫描，No test suite found；101 suites / 1,661 tests 通过 |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前工作树隔离验证：39 suites / 597 tests；未修改默认 test 配置 |
| `npm run data:audit` | 0 | P0=0 / errors=0 / warnings=24 / skipped=10 / allowlisted=31 |
| `npm run build` | 0 | browser graph 2,291 modules / 1 chunk / 0 forbidden；JS 2,332,952 bytes / gzip 533,113 bytes；原 bundle gate 通过 |
| `npm run local:db:init`，显式 temp `INVESTMENT_DASHBOARD_DATA_DIR` | 0 | 全新隔离数据库 schema 2，无默认用户目录 mutation |
| `npm run local:db:verify`，同一 temp 目录 | 0 | readonly checksum / integrity / FK / schema objects PASS |
| `git diff --check` | 0 | 无 whitespace error |
| `git diff --cached --check` | 0 | 最终 staged diff 无 whitespace error |

实施中曾出现 2 个新测试 fixture 断言错误（排序预期与 generated column 的替换测试语句），已修复测试以验证真实 append-only trigger；既有 Audit 测试另有 2 个 schemaVersion=1 的预期已随 schema 2 升级。没有降低断言或删除失败场景。最终通过记录不覆盖默认 npm test 的本地扫描失败。

## Warning 与未测试项

- Developer Health 的 10 WARN：Node / Python 版本检查标记、两个 Git 安装、4 个未固定 Python 依赖、pip check 问题、开发中 dirty tree、部分敏感/生成目录 ignore 覆盖、旧 schemaVersion 缺失、30 个公告 partial、旧/未消费生成物。未顺手升级依赖或修改 ignore。4 SKIP 分别是会写报告/股票池的数据校验、Provider health、UI audit，以及依赖 dist 的 build:check；后者由实际 build 的 bundle gate 覆盖。
- data:audit 保留 24 条既有 warning；报告的当前时间 / 扫描数 / 历史行号改动已恢复，结果只记本文件。build 的 500 kB chunk warning 保留，没有扩到 UI 拆包。
- Windows Git 的 LF→CRLF 提示保留；001 原始字节未变，migration checksum 仅规范化 CRLF。
- 提交前 fetch 曾发生一次 TLS unexpected EOF；普通重试退出码 0，origin/main 仍为 actual base，未修改 TLS、代理或凭据配置。
- 未运行真实用户 Excel / screenshot / 基金账户 / 资产记录读取、真实 DB 迁移、用户默认目录 init、OCR、云端、broker、网络 Provider、正式 performance、跨平台 native binary 部署或正式资产 UI 浏览器验收。这些均不在本任务范围；Node/browser 图门禁与实际 Vite 负测试已运行。
- 未运行本分支独立远端审查、PR CI 或 main CI；未创建 PR / merge / 下一 Phase。已核验的 1A/1A.5 main CI 只对应各自历史 SHA。
- userApprovalRef 在当前受信任本机 domain service 中是必须绑定并审计的引用；没有把任意字符串当作远程认证方案。未来 MCP / HTTP 必须通过实际用户确认流程提供该引用，不能直接暴露 repository。

## 终局自审（20 项）

| 项 | 结论与证据 |
| --- | --- |
| 1 复用 Local Core | 是，同一 connection / transaction / ports，未新建数据库 abstraction |
| 2 001 未改 | 是，base 内容比对与两种 checksum 均一致 |
| 3 正式 mutation 同事务 + Audit | 是，receipt、Audit、正式表与 fingerprints 同一 transaction |
| 4 Audit 失败回滚 | 是，失败注入、caught nested failure、late storage failure 均验证无 partial write |
| 5 approval 不可省略 | 是，commit request 合同及本地 confirmation 非空校验，receipt 绑定 approved audit |
| 6 幂等防重复 | 是，全局唯一 key + request digest + import identity + fingerprints；跨连接/重开 DB 重试覆盖 |
| 7 转账不计新增本金 | 是，只汇总 external_contribution |
| 8 candidate/warning 不进正式账本 | 是，transaction 仅 confirmed，import 非 ready 拒绝；手工 snapshot mismatch 仅是核对警告，不变成交易 |
| 9 snapshot mismatch 不改历史 | 是，返回/保存 warning，原 transactions 比对不变 |
| 10 revision 只影响未来 | 可表达路径通过，旧执行固定 revision；无日期新执行 CB-3 拒绝 |
| 11 pending 与新增本金分离 | 是，Execution 不生成 CashFlow |
| 12 deterministic plan | 是，重复 prepare / 候选顺序 / object key 顺序测试 |
| 13 changed/stale digest fail closed | 是，planId / digest / Entity / ledger 变化测试 |
| 14 baseline | 是，2026-08-14；更早 CB-1 拒绝 |
| 15 未用真实用户数据 | 是，仅代码生成 synthetic fixtures 与 OS temp / memory |
| 16 未实现 XIRR/TWR | 是，P-001 仍未执行 |
| 17 未加 UI/cloud/MCP/broker | 是，diff 仅本地核心 / 测试 / 当前文档 / runner |
| 18 未暴露 raw SQL/raw write | 是，无通用 SQL 或 AI DB tool；内部 writer 必须有批准的准确 append receipt |
| 19 Node/browser boundary | 是，整图 0 forbidden，已有正/负构建测试保留 |
| 20 有无私自补合同语义 | 未补第二套字段；发现 CB-1/2/3 并明确拒绝，故整体 BLOCKED，不能视为完整完成 |

Git 交付采用普通 commit / push；最终 local HEAD、remote SHA、ahead/behind、clean tree 与 main 并发变化在任务最终回复登记，避免在提交自身内写循环引用的 HEAD。无 PR / 合并授权扩展。

## Changed files

新增：

- `local-core/db/asset-adapter.ts`
- `local-core/db/migrations/002-long-term-account.sql`
- `local-core/domain/asset-types.ts`
- `local-core/domain/asset-invariants.ts`
- `local-core/domain/asset-service.ts`
- `local-core/domain/asset-import-service.ts`
- `local-core/ports/asset-ports.ts`
- `local-core/tests/asset-fixtures.mjs`
- `local-core/tests/assets.node.mjs`
- `local-core/tests/asset-import.node.mjs`
- `local-core/tests/asset-database.node.mjs`
- `docs/investment-dashboard-v2-phase-1b-long-term-account-dca-core.md`
- 本验证文件。

扩展：

- `local-core/ports/index.ts`、`local-core/db/connection.ts`：原 transaction set 增加受限 ledger port。
- `local-core/db/migrations.ts`：按既有约定加载 002。
- `local-core/domain/errors.ts`：新增 typed asset / confirmation / import errors。
- `local-core/contracts/registry.ts`、`local-core/tests/contracts.node.mjs`：case availability，冻结 schema 未改。
- `local-core/tests/database.node.mjs`、`local-core/tests/audit.node.mjs`、`local-core/tests/integration.node.mjs`：schema 2 的当前预期，保留专门的 001 历史测试。
- `scripts/run-local-core.mjs`、`package.json`：专项接入既有 test:local-core，并新增 test:assets；无 dependency 变动。
- `docs/development-execution-plan-2026-09-07.md`：当前关闭状态与 Phase 1B BLOCKED 状态。

## 2026-09-08 后续实现对齐记录

以上保持原实现时点的验证及合同阻塞结论。本轮用户已授权消费合入 `de77ad872` 的合同；新增实现、可执行业务测试、当前限制与 Git 边界见[implementation alignment 验证](investment-dashboard-v2-phase-1b-implementation-alignment-validation.md)。旧 `d1e343ce` 的历史状态不回写为本轮结果。
