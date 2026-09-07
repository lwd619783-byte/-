# Phase 1B Contract Clarification V1

日期：2026-09-07。合同增量状态：**READY FOR INDEPENDENT CONTRACT AUDIT**。

本轮只准备 CB-1 / CB-2 / CB-3 的向后兼容 V1 澄清，等待独立合同审计。没有自行作出审计通过结论，也没有解除 Phase 1B implementation 的 blocked 状态。2026-09-05 的终局审计、freeze decisions 和 addendum 保留原文件内容，其历史结论不覆盖本轮增量。

## 基线与证据

- Actual base：`87d33595a49dc99463333ad4637b44b7e33f68a9`，开工 fetch 后 `origin/main` 与预期一致，工作树干净。
- 合同分支：`docs/v2-phase-1b-contract-clarification-v1`，直接从该 main 基线创建。
- 只读参考 implementation branch `feat/v2-phase-1b-long-term-account-dca-core` 的 `docs/investment-dashboard-v2-phase-1b-implementation-validation.md` 与 `docs/investment-dashboard-v2-phase-1b-review-fixes-validation.md`。用户给定已实现 HEAD 为 `d1e343ce4334dc068287815f06e9d085f66de900`，独立实现审查状态为 `IMPLEMENTED PARTIALLY / BLOCKED / IMPLEMENTATION REVIEW PASS`；旧验证记录中的 pending 状态属于其记录时点。
- 领域事实源：`contracts/v1/README.md`、总 schema、asset-import schema、permissions、ledger-invariants、contract-test-cases，以及上述历史冻结文档。本轮未 merge/cherry-pick 业务代码。

## CB-1：baseline 以前的可信事实如何补录

原问题：2026-08-14 已冻结为正式 baseline，允许未来凭可信资料 historical_import，但没有可识别的正式 workflow metadata。实现分支因此拒绝早期记录，有证据也不能绕过合同缺口。

最终选择：总 schema 新增 `HistoricalAssetImport`，wire version 为 `historical-asset-import.v1`。字段为 `importId`、`sourceType`、非空 `sourceRefs`、固定 `baselineDate=2026-08-14`、`status`、`candidateCounts`，以及可选 `candidateRefs`、`warnings`、`userApprovalRef`。来源分类与 counts 复用 LegacyAssetImport 已有定义；`sourceType` 表示档案载体类别，historical workflow 由新 metadata 身份与 operation 表达。

它只承载流程元数据。准备时与同 `importId` 的 AssetImportBundle 配对，复用现有 Plan / CommitRequest 和唯一 ledger。没有新的 Transaction、CashFlow、Position 或 DCA 事实类型。

日期边界是严格早于 baseline：Transaction.tradeDate、CashFlow.date、PositionSnapshot.snapshotDate，以及 DCA 的可信交易日期或无交易时的完整显式周期。baseline 当日及以后仍用既有路径，不与历史事实混包；Account / Asset 只作为有日期历史事实的身份依赖。证据不足不能反推或自动生成历史。

prepare 只做预览，不改正式状态。sourceRefs 必须解析为支持候选的可信来源；无可信证据 blocked，验证尚未完成只能 needs_review。新 metadata 在 ready_to_commit/committed 状态下必须全为 quality=verified，且无 warning。quality 标签不等于验证凭证，commit 必须复核来源内容、关联和验证版本/摘要。

planDigest 绑定 operation、metadata、bundle、证据及其验证状态/摘要、候选映射与最终预览。counts 必须与 bundle 精确一致。证据变化、候选变化、operation 不匹配或旧 plan 均 fail closed，须重新 prepare 和确认。

权限新增 `historical_asset_import.prepare`（level1）与 `historical_asset_import.commit`（level2）。正式 commit 复用 `planDigest`、`idempotencyKey`、`userApprovalRef`；批准绑定整份计划与该 operation，metadata 的 committed approval 必须与请求一致。正式记录、confirmed operation、committed marker、Audit 在同一事务提交，任何失败整体回滚，相同已批准请求的幂等重试返回原结果。

不扩正式 source enum。历史档案导入的 Transaction / PositionSnapshot 沿用 `legacy_import`；Transaction / CashFlow 已有 sourceEvidenceRef 可以继续使用。DcaExecution / PositionSnapshot 的事实关联由 candidate evidence、plan、confirmed operation 和 Audit 保存。Audit.operation 使用 `historical_asset_import.commit` 并可追溯 importId。metadata 和 operation 已能明确区别 baseline migration 与更早补录，新增 ledger source enum 没有必要。

补录不改变正式 baseline，不回写旧研究/PIT 结论；事实日期、来源可得时间与本次提交时间保持分离。

## CB-2：截图账户总额如何核对

原问题：declaredExternalContribution 是新增本金声明，不能表达账户总资产；单资产 PositionSnapshot、notes 或 userOverrides 也不能代替账户总额。

asset-import schema 新增嵌套 `AccountValueObservation`：

| 字段 | 本轮口径 |
| --- | --- |
| accountId / snapshotDate | 账户与当期快照日期 |
| scope | 唯一值 `full_account_snapshot` |
| totalMarketValue | 复用当前 asset-import Money |
| sourceEvidenceRefs | 非空证据 ID 数组，与既有候选引用方式一致，必须可解析 |

Bundle 的 `accountValueObservations[]` 可选，以保持旧 payload schema-valid。它是核对证据，不是正式 Transaction/CashFlow，不产生本金，也不改变持仓或交易历史。

scope 是该 bundle 含有完整当期账户持仓的声明。parser 必须提供证据支持的完整 PositionSnapshot candidates，包括被总额计入的现金等组成。只能合计同 bundle、相同 accountId/snapshotDate 的 marketValue，不静默用旧 ledger snapshot 补候选。无匹配候选不能用空集总和 0 证明账户为空；无法验证完整性也不能因数值碰巧相等而 pass。

同一账户/日期的 Observation 应唯一。重复或冲突观察、重复/冲突持仓资产候选不能择一或重复计算，必须 warn。对重复导入中已在 ledger 存在的同包快照，可核对这份候选的事实；仍然不得从 ledger 增补缺失行。

Plan 新增可选 `accountValueReconciliations[]`，对应每项 Observation，包含 accountId、snapshotDate、observedTotal、可选 candidatePositionTotal / reconciliationDelta、status=pass|warn 及 warnings。数组可选不豁免业务提交前检查：screenshot financial candidates 缺账户总额证据也必须 warning/needs_review。

| 情形 | 结构化结果 | 提交边界 |
| --- | --- | --- |
| 同币种、完整候选、证据有效、精确一致 | pass；候选总额与零 delta 必须存在 | 仅本项通过，还需其余核对与确认 |
| 同币种完整候选但金额不一致 | warn；提供非零 delta 与原因 | 不可 commit |
| incomplete / 无法验证完整性 / currency conflict | warn；明确原因，无法形成完整可比合计时省略候选总额和 delta | 不可 commit，不补零或隐式换汇 |

`reconciliationDelta = candidatePositionTotal - observedTotal`，使用精确十进制口径，不以 epsilon 或四舍五入隐藏差异。例如 synthetic 观察值 20 CNY、完整候选 18 CNY，delta 为 -2 CNY。任何核对 warning 传播到 plan 的 needs_review/blocked，用户确认不能越过；planDigest 绑定 Observation、候选、证据与结果，commit 必须重新验证。

## CB-3：DCA 执行如何选择历史 revision

原问题：DcaExecution.period 只是 NonEmptyString。无可信交易日期时不能据此确定适用 revision，也不能默认最新 revision。

最终选择：保留 period 原字段，永远仅作展示。不解析 `2026-W36`、`第36周`、`9月第一周`、`Synthetic cycle` 或其他自由文本。新增可选 `periodStart` / `periodEnd`，必须成对，为有效 IsoDate 且 start <= end，区间包含两个端点。JSON Schema 检查成对和日期格式，registry 单 payload invariant 检查先后顺序。

- 非空 transactionIds：必须解析所有 linked transactions，每个 tradeDate 必须唯一映射到同一个 DcaPlan revision。未知 ID 或无效交易日期不能被忽略并回退 period。若同时给显式区间，每个 tradeDate 都必须在区间内，否则 fail closed。真实交易日期优先，无交易的区间部分不覆盖交易日期的版本选择。
- transactionIds 缺失/空数组：旧 payload 仍可做 schema 校验和历史读取；正式 commit 必须有显式日期对，整个闭区间唯一落入一个 revision。缺日期、空档、多解或跨 revision boundary 均 blocked/needs_review，不默认 latest。
- revision 的 activeFrom 包含当日，activeTo 如有也包含当日，但后一 revision.activeFrom 起只选后者，前一 revision 不再覆盖该日。同日起始冲突或覆盖空档 fail closed。此处只定义日期选择，不新增 revision wire version。
- Constraint.effectiveFrom/effectiveTo 和旧周期保持历史事实。新 revision 仅作用未来，不用最新 constraint 倒改旧执行。

本轮**没有冻结** purchase_limit 计算、plannedAmount+rollover 预算公式，以及 executedAmount 与 Transaction grossAmount、netAmount 或 fees-inclusive 的固定等式。原 A-005 关于 pending 与新增预算分离的意图保留，但不推出具体金额公式。pending rollover 不算 external contribution。未来严格金额核对必须另行冻结。

## 兼容性与验证分层

这是 additive V1 clarification：保留原 27 个 wire version、旧 required 字段、枚举和正式对象身份；新增一个 metadata version 和两个嵌套 definition。旧 payload 不带新字段仍然合法，没有原版本重命名或新强制字段。新增字段的约束只作用于选择使用它们的 payload。

| 层次 | 本轮实际完成 | 不能由此推导 |
| --- | --- | --- |
| JSON Schema | 5 schemas 全部编译；新 metadata、Observation/Reconciliation、DCA 日期对形状 | 证据真实、持仓完整、允许 commit |
| Registry/static invariants | 版本身份、固定 baseline、权限边界、scope、DCA 成对/顺序/展示语义防回退 | 跨对象业务场景已执行 |
| ledger-invariants / A-001/A-002/A-005 | 明确必须实施的证据、核对、时间选择和事务条件，原 case IDs/expected 保留 | Phase 1B blocker 已解除或合同已独立审计 |

Registry 仍把全部 21 个完整业务 case 标记为 `declared / not-yet-executable`，因为本分支没有 Phase 1B implementation。测试 fixture 中的 ready/committed 只是合法形状，未调用任何账本 commit。向后兼容指旧 payload 的验证与解释保持；不授予旧无日期/无证据 payload 新的正式提交权限，也不自动改写历史记录。

## 后续 implementation 如何消费

独立合同审计完成并合入后，再在另行授权的 Phase 1B 任务中：复用现有 Local Core、import plan/digest/confirmation/atomic commit；接入 Historical metadata 和 operation；把 source evidence verification、counts/日期边界纳入计划；对同包完整持仓进行结构化账户总额核对；在所有 DCA 正式写入路径执行日期与唯一 revision 选择。Candidate.payload 仍须按 candidateType 二次校验，不能只检查 Bundle 外壳。

应把 A-001 / A-002 / A-005 的声明场景转为真正的业务测试，特别覆盖未知引用、证据失效、incomplete/currency conflict、stale plan、跨 revision、区间冲突和幂等事务回滚。完成这些实现与独立验证前，Phase 1B 保持 `implementation reviewed; blocked pending contract clarification`。

本轮未修改 AssetService、AssetImportService、asset persistence adapter、migration、SQLite asset tables、UI、Provider、MCP、cloud、broker、backup、performance 或真实用户数据。未提前实现跨对象核对或 revision 选择引擎。

## 验证与交付记录

命令结果与兼容性证据在本节登记；最终 local HEAD / remote SHA 由交付回复记录，避免提交引用自身 SHA。交付仅普通 commit / push，停止等待独立合同审计，不创建 PR 或合并 main。

| 命令 / 检查 | 退出码 | 实际结果 |
| --- | ---: | --- |
| `npm run agent:skills:check` | 0 | 9 项只读校验通过，无安装/升级 |
| `npm run env:check` | 0 | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP，READY WITH WARNINGS |
| `npm run --silent env:check:json` | 0 | JSON 同为 48 / 10 / 0 / 4 |
| `npm run contracts:validate` | 0 | 5 schemas / 40 definitions / 28 wire versions；21 whole business cases 仍 declared |
| `npm run test:contracts` | 0 | 106/106；涵盖兼容性、合法/非法 metadata、Observation/Reconciliation、DCA 单边/倒序/非法日期及权限/static corruption |
| `node --test --test-name-pattern='static invariant\|registry rejects\|backward compatibility\|DCA contract invariant\|HistoricalAssetImport\|AccountValue' local-core/tests/contracts.node.mjs` | 0 | 在 contracts:validate 编译后运行，83/83 专项通过 |
| `npm test` | 1 | 101 suites / 1,661 tests 通过；仅 2 个既有 nested-worktree Node 文件被 Vitest 扫入，No test suite found |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前工作树隔离：39 suites / 597 tests |
| `npm run data:audit` | 0 | scanned=301 / P0=0 / errors=0 / warnings=24 / skipped=10 / allowlisted=31 |
| `npm run build` | 0 | 含严格 frontend 与 Local Core typecheck；browser graph 2,291 modules / 1 chunk / 0 forbidden；JS 2,332,952 bytes / gzip 533,113 bytes，bundle gate 通过 |
| `git diff --check` / `git diff --cached --check` | 0 / 0 | 工作区及最终暂存区无 whitespace error |
| 与 actual base 的只读 schema 投影对照 | 0 | 5 份 JSON Schema 剔除本轮明确新增定义/字段及 DCA 新注释/成对规则后，与 base 深比较完全相同；27 个旧 wire version 未变 |
| 旧/新双重 fixture 校验 | 0 | 用 `git show <actual-base>:contracts/v1/<schema>` 编译旧 Ajv registry；11 份旧 V1 形状 synthetic fixtures 同时通过旧 schema 与当前 registry |
| 受保护内容与 diff 范围 | 0 | 三份历史审计/冻结/addendum 文档与 001 migration 的 Git blob 与 actual base 一致；无业务实现、migration、依赖或真实用户数据 diff |

双重 fixture 包括 Account、Asset、Transaction、CashFlow、PositionSnapshot、DcaPlan、无 period 日期的旧 DcaExecution、LegacyAssetImport、AssetImportBundle、Plan、CommitRequest。专项还验证原 Account/Asset 类型枚举与 Transaction/Position source 枚举全部保留，CashFlow/DcaExecution 没有新增 source 字段。测试均为 synthetic schema/registry 校验，不读取真实账户，也没有创建资产数据库。

初次新 schema 测试遇到 Ajv strictTypes：`format` 与 `$ref` 同用时需要显式 string type。已在新增 periodStart/periodEnd 字段补 `type=string`，保留 strict 模式和既有 IsoDate 定义，随后 106 项通过。没有降低验证要求。

默认 npm test 的两个失败路径为 `data-cache/worktrees/stage-4-1-r2/scripts/tests/company-guidance-expectations.test.mjs` 与 `data-cache/worktrees/v2-phase1/scripts/tests/company-guidance-expectations.test.mjs`；与只读实施验证记录的既有问题一致。未改默认测试配置、删除 worktree 或把默认全套测试称为通过。

环境 10 条 WARN 涉及 Node/Python 版本标记、两个 Git 安装、4 个未固定 Python 依赖、pip check、开发中的 dirty tree、部分 ignore 覆盖、旧 schemaVersion 缺失、30 个公告 partial、旧/未消费生成物。4 项 SKIP 为会写入的数据验证、Provider health、UI audit 和依赖 dist 的 build:check；实际 build 已运行后者的 bundle gate。数据审计的 24 条既有 warning 与构建 >500 kB chunk warning 保留。data:audit 写出的历史报告已按运行前原始字节恢复，未把时间戳或扫描差异混入提交。Windows LF→CRLF 提示不等于 whitespace failure。

Changed files 共 11 个：

- `contracts/v1/README.md`
- `contracts/v1/research-asset-os.contracts.v1.schema.json`
- `contracts/v1/asset-import.v1.schema.json`
- `contracts/v1/permissions.v1.json`
- `contracts/v1/ledger-invariants.v1.json`
- `contracts/v1/contract-test-cases.v1.json`
- `local-core/contracts/registry.ts`
- `local-core/tests/contracts.node.mjs`
- `local-core/tests/contract-clarification-fixtures.mjs`
- `docs/development-execution-plan-2026-09-07.md`
- 本文件。

未运行本分支独立合同审计、PR CI、main CI、业务导入/E2E 或真实数据迁移；没有 PR、main merge 或后续 implementation。当前合同增量只进入 **READY FOR INDEPENDENT CONTRACT AUDIT**，Phase 1B 实现继续 blocked。
