# Phase 1B implementation alignment · 2026-09-08

状态：**PHASE 1B IMPLEMENTATION ALIGNMENT COMPLETE / PENDING INDEPENDENT FINAL AUDIT**。

本记录登记本地 implementation alignment 与可执行验证，不代替下一轮独立远端终局审计。未创建 PR、未运行本轮 PR CI、未修改或合并 main、未使用真实用户账户或迁移真实数据。

## 基线与历史边界

- 开工 `git fetch origin --prune` 后，`origin/main` 精确为 `de77ad872c4f91bac85f739d648f647f66b6d906`，原 implementation 远端为 `d1e343ce4334dc068287815f06e9d085f66de900`，工作区干净。
- 在原分支 `feat/v2-phase-1b-long-term-account-dca-core` 普通 merge `origin/main`，产生 `90670fd0ad022ce3e36992b52174ba6705dbf085`，即本轮实现基线。父提交分别是 `d1e343ce` 与 `de77ad872`。
- 原实现提交 `2968baaf9a595413bd414da32d883e7dba6b867a` 和修复提交 `d1e343ce4334dc068287815f06e9d085f66de900` 身份保留；没有 rebase、amend、cherry-pick 重建或 force push。
- Contract Clarification 审计提交 `829bae54a8bdffd76ea2edfa8195261a54123457`，PR #23 已合并、PR/main CI 通过及三个 CB 在 contract-definition level CLOSED，属于本轮用户明确提供的已完成状态；本轮 fetch 验证 merge SHA，没有重新宣称独立审计或 CI。
- 原 `d1e343ce` 状态为 IMPLEMENTED PARTIALLY / PREVIOUS IMPLEMENTATION REVIEW PASS；[原实现验证](investment-dashboard-v2-phase-1b-implementation-validation.md)、[原审查修复验证](investment-dashboard-v2-phase-1b-review-fixes-validation.md)和[合同澄清记录](investment-dashboard-v2-phase-1b-contract-clarification-v1.md)保留历史结论。
- merge 仅在执行索引发生文本冲突，保留历史和最新授权状态；合同文件合并后及交付前均与 `origin/main` 相同。Git 身份缺失通过单命令使用原实现提交的作者身份解决，未改全局配置。

## 本次实现

### CB-1 · HistoricalAssetImport

新增正式 metadata TypeScript 消费与 `AssetImportService.prepareHistorical` / `commitHistorical`，分别对应冻结的 historical operations。复用 V1 Bundle、Plan、CommitRequest、现有四类正式事实及 Account/Asset 身份依赖，复用同一 ledger、import plan、confirmed operation 和 Audit。

prepare 校验 importId、counts、uncommitted 状态、非空 sourceRefs、候选正式 schema、来源内容与候选身份/事实映射。Transaction.tradeDate、CashFlow.date、PositionSnapshot.snapshotDate 严格早于 2026-08-14；DCA 的全部 linked tradeDate 或无 links 时显式闭区间也须全部早于 baseline。Account/Asset 必须被有日期事实引用；baseline 当天、之后、混包与无支持的历史推算均不能提交。Transaction/Position 仍使用 `legacy_import`，没有新增 source enum。

内部 `ImportTrust` 是独立于 Bundle 的同步只读 Node port，由可信本地主机提供证据与用户批准记录。默认实现返回 unresolved，不能以 Bundle 中的质量标签自证。核心仅接受可解析的**结构化来源档案**：来源正文必须包含与 assertions 精确相同的现有候选事实及账户快照组成；同时检查 ref identity/type、内容摘要、assertions 摘要、verification status/version、候选 ID/type/payload 和引用关系。任意文本、原始截图、未经验证的 OCR 或“verified + 任意内容摘要”不能自动变成可信事实。

来源真实性核验和用户确认记录的产生是可信本地主机的职责，不能把这两个 port 暴露为 AI 写入口。本轮实现的是消费、验证、持久化和拒绝逻辑，没有创建 OCR、文件自动发现、真实来源采集、UI 确认或远程身份认证。可执行测试使用彼此独立的 synthetic 来源内容与候选；修改候选不会同步修改证据。

planDigest 绑定 operation、metadata、完整 bundle/candidates/observations、解析证据的内容摘要与验证状态/版本/摘要、候选映射、正式状态/Entity digest、reconciliation 与最终 preview。计划以 immutable payload 存储。新 prepare 会使同 importId 的旧计划 superseded；恢复以前的输入也产生新计划、需要新批准，同输入重复 prepare 保持确定性。

commit 先检查 operation、完整计划和摘要，再在同一 immediate transaction 内重验来源与全部核对。历史或带账户总额核对的计划，其 userApprovalRef 必须由可信 port 解析并精确绑定 operation、planId、planDigest、actor、client。任何 warning 都阻断，不允许确认覆盖。历史 committed metadata 使用同一 request approval，保存于 confirmed operation 的 importProvenance，与 importId/planId/planDigest 一起由 repository 二次校验。

正式 ledger appends、confirmed operation、committed metadata、import marker/fingerprints 和 Audit 全部同事务。Audit.operation 为 `historical_asset_import.commit`，entity 为该 importId 的 workflow，scope/idempotencyKey 保留批准和请求，关联 receipt/plan 可继续追溯全部 candidate evidence。任一步失败回滚全部；成功幂等重试返回原 receipt，不重复 ledger 或 Audit。重开后的成功重试无需重新产生来源或批准，不授予任何新写入。

### CB-2 · AccountValueObservation / Reconciliation

Bundle/Plan 内部类型与冻结嵌套字段一致。只选择 same bundle、相同 accountId/snapshotDate 的 PositionSnapshot；每项先经过正式 schema 和 Entity/domain 校验。已存在 ledger 的同包候选可以核对，但不从 ledger 补缺失候选。既有 position quantity reconciliation 仍保留，不能借账户总额核对消除其他 warning。

完整性来源 manifest 必须明确支持 full_account_snapshot，且逐项组成与本 bundle 完整相等，包括总额包含的现金。无 manifest、无匹配 positions、不完整、duplicate/conflicting observation、duplicate/conflicting asset candidate、currency conflict 或实体未验证都产生明确 warning；无法形成完整可比较合计时不输出 candidatePositionTotal/delta。不自动 FX，不创建账户总额 CashFlow/Transaction，不借 declaredExternalContribution、notes 或 userOverrides 表达总资产。

现有十进制 BigInt 运算计算 sum 和 delta，没有 epsilon/rounding；另外拒绝无法无损表达为 V1 number 的精确合计。完整同币种相等时必须输出候选合计和零 delta；不等时输出非零 delta 和 warning。截图 financial candidates 缺对应账户观察也会阻断计划。任何 reconciliation/candidate/item warning 都传播为 needs_review/blocked；commit 重验所有输入及输出摘要。

### CB-3 · DCA temporal binding

DcaExecution 类型添加可选 periodStart/periodEnd，canonical payload 原样保存。旧不带日期 payload 仍 schema-valid/readable，新的正式 admission 才要求跨对象条件。

非空 links 必须全部唯一解析且 tradeDate 有效，显式区间存在时检查每一笔 tradeDate；真实交易日期决定 revision，不因显式区间中无交易部分或 period 文案选版本。缺失/空 links 必须有有效、成对、有序的显式闭区间，整个区间落入唯一 revision。

revision 按有序连续历史验证，日期与 revision 顺序必须一致；同 activeFrom、无效/倒序 interval、历史序号歧义和落在 gap/跨 revision 的执行均拒绝。activeFrom 与 activeTo 包含当天，但后一 revision.activeFrom 当天起选后一版。新 revision 不得使已保存的无交易显式执行区间失效；旧无日期记录不能用来证明可安全重解释。

period 只作 display，不解析任何自由文本，不存在 latest 或单 revision 的无日期 fallback。Constraint effectiveFrom/effectiveTo 保留；linked transactions 只负责身份、方向、资产/分类与时间，不定义 executedAmount 与 gross/net/fees 的等式。pending rollover 不变成 external contribution，也没有冻结预算/限购/rollover 金额公式。

## Migration 与兼容

- 本轮未修改 001 或 002，也未新增 migration。`git log origin/main -- local-core/db/migrations/002-long-term-account.sql` 无记录；002 是原实现分支已有、尚未进入 main 的内容，本次无需改变它。
- 001 loader checksum 保持 `339bbd8b1cadb8196fb1b4ac9ab2a48d7fbb48c7452dcea89a3320c34166f1ef`，002 保持 `88512734008b604639d0b5bc667249d435ca3fecbabbe55c631607ea85f78406`。
- 新 metadata/evidence/reconciliation/plan lineage 保存在既有 import_plans canonical payload，committed provenance 在 confirmed_operations canonical payload；查询 latest plan 使用既有表，不增加平行数据库或 historical ledger。
- 28 wire versions 包含旧 27 个版本及已合入的 HistoricalAssetImport；5 schemas / 40 definitions。contracts/v1 与 origin/main 零差异。
- 真实文件型 temp SQLite 测试覆盖 prepare 后重开、commit 后重开、来源/总额字段与 receipt 完整保留、幂等重试、旧无日期 DCA payload 读取及新提交拒绝。只用 memory/temp DB，没有打开真实用户路径。

## 可执行验证

A-001 / A-002 / A-005 的 Phase 1B 业务路径已由 historical-import、account-value、dca-temporal 和持久化 tests 执行。Registry 将 A-001～A-008 登记为 executable，指测试可运行，不缓存独立审计结论；其他未来研究、performance、backup/restore 与远程场景仍 declared。没有修改 contract-test-cases 合同本身。

| 命令 / 检查 | 退出码 | 实际结果 |
| --- | ---: | --- |
| `npm run agent:skills:check` | 0 | 9 项只读验证；没有安装/升级 |
| `npm run env:check` | 0 | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP；READY WITH WARNINGS |
| `npm run --silent env:check:json` | 0 | 同为 48 / 10 / 0 / 4 |
| `npm run contracts:validate` | 0 | 5 schemas / 40 definitions / 28 wire versions |
| `npm run test:contracts` | 0 | 106/106，含旧形状兼容、日期、permissions/static corruption |
| `node scripts/run-local-core.mjs test-assets` / 最终直接 Node 专项 | 0 | 198/198（原 78 项 + 本轮新增 120 项），synthetic/memory/temp |
| `npm run test:local-core` | 0 | 242/242，含全部资产专项及既有 Entity/Audit/migration/health/browser-boundary |
| `npm test` | 1 | 101 suites / 1,661 tests 通过；2 个既有 nested-worktree Node 文件被误扫描 |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前工作树隔离 39 suites / 597 tests 通过 |
| `npm run data:audit` | 0 | scanned=301 / P0=0 / errors=0 / warnings=24 / skipped=10 / allowlisted=31 |
| `npm run build` | 0 | frontend 与 Local Core strict typecheck；browser graph 2,291 / 1 chunk / 0 forbidden；bundle gate 无 errors |
| `git diff --check` | 0 | 无 whitespace errors |

默认 npm test 失败路径仅为 `data-cache/worktrees/stage-4-1-r2/scripts/tests/company-guidance-expectations.test.mjs` 和 `data-cache/worktrees/v2-phase1/scripts/tests/company-guidance-expectations.test.mjs`，报 No test suite found。没有改测试发现策略，也未将默认全套称为通过。

环境 warning 涉及版本标记、多 Git 安装、4 个未固定 Python 依赖、pip check、开发中 dirty tree、部分 ignore 覆盖、旧 schemaVersion、30 个公告 partial 和旧生成物。4 个 SKIP 是既有可写/依赖输出的检查；build 已另行验证 bundle。数据审计 24 条 warning 和 >500 kB 构建 chunk warning 保留。data:audit 自动报告按运行前原始字节恢复，不混入时间戳或真实生成数据改动。

新增测试初轮暴露共享 fixture EvidenceRef 被某一反例修改导致后续测试污染，已改为每个测试独立深拷贝；旧截图测试仍断言旧 CONTRACT_GAP 文案，已改为新的账户观察缺失阻断断言。没有降低类型或门禁。自审进一步增加正文/sidecar 不一致、plan output 篡改和 superseded input 恢复后的批准绑定反例。

## 终局自审

| 检查问题 | 本次结论与证据 |
| --- | --- |
| 无 evidence、仅 quality 或无关来源能否提交？ | 不能；解析内容、独立可信 verification、精确 candidate mapping 都须成立；missing/unsupported/rejected blocked，pending needs_review |
| 能否混入 baseline 当天/之后事实，或仅导入身份绕过？ | 不能；全部事实日期/区间严格检查，Account/Asset 须为事实依赖 |
| 能否用普通 plan/commit 换成 historical 或反向复用？ | 不能；operation 参与 digest、入口和批准绑定，双向误用 tests 拒绝 |
| prepare 后 evidence/metadata/candidate/output 改变是否 stale？ | 是；digest 重算及 immutable plan/最新计划检查；删除候选或恢复旧输入也不能复用批准 |
| historical commit 是否原子？retry 是否重复 Audit？ | 同事务；audit/operation/transaction/fingerprint 逐阶段注入失败全部回滚，重试只一份 ledger/Audit；file reopen 复验 |
| 账户总额是否只用 same-bundle positions，证明 full account？ | 是；来源完整组成逐项比对，含现金；即使证券合计碰巧相同，缺组成仍 warn |
| 是否补旧 ledger snapshot 或用 contribution 补总资产？ | 否；专门反例验证缺候选不补零、不补持仓、不生成本金 |
| duplicate/conflict/currency 是否关闭提交？ | 是；不择一、不重复加总、不隐式 FX；不可比较时无伪造合计/delta |
| 是否精确 decimal，warning 是否一定阻断？ | 是；0.1+0.2 精确核对，4e-17 mismatch 保留；所有 warning 阻断批准提交 |
| DCA 是否解析 period / 默认 latest / 忽略坏 ID？ | 均否；包括单 revision 也不能接受无日期新提交 |
| linked 日期与 explicit period 是否逐笔检查？ | 是；unknown/missing/invalid 日期拒绝，交易日期优先且须在显式区间内 |
| 无 links 是否强制 explicit period，能否跨 revision？ | 强制；跨 boundary/gap/歧义均拒绝，activeTo 包含当天、下一版 activeFrom 当天用新版 |
| 是否恢复 executedAmount 等式或更改 rollover/constraint 历史？ | 否；数量/gross-only/net fixtures 均保持非公式绑定，历史 constraints 和原 rollover tests 保留 |

本轮无剩余 implementation blocker。可信来源核验主机、原始 OCR/parser、UI 用户确认与远程入口没有在本任务中实现或准入；缺这些适配器时核心保持关闭，不把 synthetic 验证表述为真实迁移或生产准入。独立远端终局审计仍待执行。

## Git 交付

普通 commit / push 到原 implementation 分支。最终 implementation commit、HEAD/remote SHA、ahead/behind、clean tree 与相对 origin/main 的完整 files/LOC/commits 在任务交付回复登记，避免文件自引用其提交 SHA。相对 main 的差异包含原 2968baa/d1e343ce 实现和本轮 alignment，不能把旧 002/原依赖配置误报为本轮新增改动。没有 PR、main merge、force push 或后续 Phase。

## 相对 origin/main 的完整文件差异

下表包含原 Phase 1B 实现与本轮 alignment；contracts/v1 无差异。

| 文件 | additions | deletions |
| --- | ---: | ---: |
| `docs/development-execution-plan-2026-09-07.md` | 4 | 4 |
| `docs/investment-dashboard-v2-phase-1b-implementation-alignment-validation.md` | 149 | 0 |
| `docs/investment-dashboard-v2-phase-1b-implementation-validation.md` | 153 | 0 |
| `docs/investment-dashboard-v2-phase-1b-long-term-account-dca-core.md` | 31 | 0 |
| `docs/investment-dashboard-v2-phase-1b-review-fixes-validation.md` | 70 | 0 |
| `local-core/contracts/registry.ts` | 6 | 4 |
| `local-core/db/asset-adapter.ts` | 188 | 0 |
| `local-core/db/connection.ts` | 39 | 4 |
| `local-core/db/migrations.ts` | 2 | 1 |
| `local-core/db/migrations/002-long-term-account.sql` | 186 | 0 |
| `local-core/domain/asset-import-service.ts` | 222 | 0 |
| `local-core/domain/asset-invariants.ts` | 208 | 0 |
| `local-core/domain/asset-service.ts` | 158 | 0 |
| `local-core/domain/asset-types.ts` | 130 | 0 |
| `local-core/domain/errors.ts` | 2 | 0 |
| `local-core/domain/import-evidence.ts` | 103 | 0 |
| `local-core/ports/asset-ports.ts` | 29 | 0 |
| `local-core/ports/import-trust.ts` | 12 | 0 |
| `local-core/ports/index.ts` | 4 | 1 |
| `local-core/tests/account-value.node.mjs` | 106 | 0 |
| `local-core/tests/asset-database.node.mjs` | 149 | 0 |
| `local-core/tests/asset-fixtures.mjs` | 29 | 0 |
| `local-core/tests/asset-import.node.mjs` | 220 | 0 |
| `local-core/tests/assets.node.mjs` | 293 | 0 |
| `local-core/tests/audit.node.mjs` | 1 | 1 |
| `local-core/tests/contracts.node.mjs` | 5 | 4 |
| `local-core/tests/database.node.mjs` | 8 | 8 |
| `local-core/tests/dca-temporal.node.mjs` | 86 | 0 |
| `local-core/tests/historical-import.node.mjs` | 181 | 0 |
| `local-core/tests/import-alignment-fixtures.mjs` | 43 | 0 |
| `local-core/tests/integration.node.mjs` | 1 | 1 |
| `package.json` | 2 | 1 |
| `scripts/run-local-core.mjs` | 2 | 1 |

整体差异：33 files / +2822 / -30。仅本轮 alignment：22 files / +928 / -79（不含普通 merge 的历史整合）。
