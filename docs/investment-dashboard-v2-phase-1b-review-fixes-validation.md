# Phase 1B 独立审查修复验证

日期：2026-09-07。状态：**IMPLEMENTED PARTIALLY / BLOCKED / PENDING INDEPENDENT RE-REVIEW**。

本轮以已审查 HEAD `2968baaf9a595413bd414da32d883e7dba6b867a` 为增量基准，在原分支 `feat/v2-phase-1b-long-term-account-dca-core` 修复两个实现问题。开工时本地 HEAD 与远端分支一致、工作树干净；fetch 后 origin/main 仍为 `87d33595a49dc99463333ad4637b44b7e33f68a9`。独立审查输入结论为 `IMPLEMENTED PARTIALLY / BLOCKED / INDEPENDENT REVIEW CHANGES REQUIRED`。

[原实施验证](investment-dashboard-v2-phase-1b-implementation-validation.md)保留原时点记录；其中 baseline 和合同外假设的自审结论不代表本轮修复前已满足要求。本文件记录本轮增量及验证，不声明独立复审、CI、合并或生产准入通过。

## 实现增量

- 将 `2026-08-14` baseline 校验放入共享正式记录校验，覆盖直接 AssetService 与 import 的 Transaction.tradeDate、CashFlow.date、PositionSnapshot.snapshotDate。确定日期更早时拒绝写入；直接写入返回 `CONTRACT_GAP`。批量 CashFlow 中任一记录越界，整批无正式写入、receipt 或 Audit。baseline 当日合法。
- direct Transaction 仍只能 `source=manual`；manual 同样不能越过 baseline。direct Position 拒绝 `confirmed_screenshot` / `legacy_import`，分别要求 AssetImport / Legacy prepare-plan-commit；manual / calculated 的直接路径保留。CashFlow 没有增加 source 或其他 wire semantics。
- Legacy DcaExecution 没有 transactionIds（缺失或空数组）时返回 `CONTRACT_GAP`。未知 ID 仍需 resolution；存在的交易日期用于验证 baseline 和唯一适用 revision。日期样式的自由文本 period 也不解析，不充当历史日期证据。
- 删除 linked Transaction 必须有 netAmount 以及 `executedAmount == sum(netAmount)` 的要求；没有改用 grossAmount 等式。DCA executedAmount 与 Transaction amount 的关系当前**不作合同外假设**。后续严格核对须先 contract clarification。
- 保留引用存在性、execution 内及跨 execution 的重复链接拒绝、资产/主分类匹配、增加方向、日期选择唯一 revision、DCA 自身非负和状态要求，以及 approval、Audit、幂等和原子事务。未改既有 Transaction 自身的金额 reconciliation。

增量仅涉及 3 个 domain 文件、2 个测试文件、本验证文件及当前执行索引；没有修改持久化结构、依赖、权限或冻结合同。

## 仍未解决的合同阻塞

| 编号 | 本轮后仍存在的缺口与边界 |
| --- | --- |
| CB-1 / A-001 | `historical_import` 正式请求与 provenance 表达未冻结。fail-closed 已扩展到所有可确定日期的正式写入口；早于 baseline 的 manual 记录也拒绝。AssetImport 原来无 verified evidence 的 warn、有 verified evidence 的 CONTRACT_GAP/blocked 行为保留，均不可 commit。Legacy 无日期 DCA 不能证明位于 baseline 之后，归入现有 temporal/historical contract gap。 |
| CB-2 / A-002 | screenshot account-total reconciliation shape 仍缺失；ACCOUNT_TOTAL_CONTRACT_GAP 继续阻止截图 financial candidates commit。未借用 PositionSnapshot、external contribution、notes 或额外字段表达账户总额。 |
| CB-3 / A-005 | DCA period/revision temporal binding 仍未冻结。revision 后无 dated transaction links 的 execution 继续 CONTRACT_GAP；不能猜测自由文本 period，也不能默认绑定最新 revision。 |

这三个 blocker 继续阻塞完整 Phase 1B。本轮没有补字段、修改合同或解除准入限制。

## 回归证据

资产专项从已审查基准的 49 项增至 78 项，新增 29 项测试，全部使用 synthetic fixtures / memory / temp DB：

- direct manual Transaction、CashFlow、manual/calculated Position 在 baseline 前拒绝；baseline 当日接受；混合日期 CashFlow 整批回滚。
- direct import-only Position 拒绝；所有非 manual direct Transaction 继续拒绝。
- 无 netAmount 的 quantity-only、gross-only、quantity+gross 交易可关联 DCA；有 netAmount 时也可与 executedAmount 不相等，grossAmount 同样不构成等式。成功重试仅一条 Audit。
- 错误资产、主分类、方向、无适用 revision、跨 revision、未知 ID、重复 ID、跨 execution 复用 ID 继续拒绝；已有早期交易的 synthetic 状态不能用于绕过 baseline。
- Legacy transactionIds 缺失/空数组、普通或日期样式 period 均拒绝；未知 ID 不成为时间证据；baseline 当日的 dated legacy DCA 无 netAmount 仍可按流程提交。原 CB-1/2/3 测试保留并通过。

## 本轮验证

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm run agent:skills:check` | 0 | 9 项只读校验通过 |
| `npm run env:check` | 0 | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP，READY WITH WARNINGS |
| `npm run --silent env:check:json` | 0 | JSON 同为 48 / 10 / 0 / 4 |
| `npm run contracts:validate` | 0 | 5 schemas / 37 definitions / 27 frozen versions；partial 与 not-yet-executable 状态保留 |
| `npm run test:contracts` | 0 | 36/36 |
| `npm run local:typecheck` | 0 | 严格 TypeScript 通过 |
| `npm run test:local-core` | 0 | 122/122，含既有 Audit、事务、幂等、migration 和 Node/browser 边界测试 |
| `npm run test:assets` | 0 | 78/78 |
| `npm test` | 1 | 101 suites / 1,661 tests 通过；2 个既有 nested worktree 的 Node 文件被 Vitest 扫入，No test suite found |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前工作树隔离：39 suites / 597 tests |
| `npm run data:audit` | 0 | scanned 301 / P0 0 / errors 0 / warnings 24 / skipped 10 / allowlisted 31 |
| `npm run build` | 0 | browser graph 2,291 modules / 1 chunk / 0 forbidden；JS 2,332,952 bytes / gzip 533,113 bytes；bundle gate 通过 |
| `npm run local:db:init`，显式全新 temp data dir | 0 | schema 2；001/002 checksum、integrity、FK、schema objects 均通过 |
| `npm run local:db:verify`，同一 temp data dir | 0 | readonly verify 通过；未使用默认用户数据目录 |
| `git diff --check` | 0 | 无 whitespace error |
| `git diff --cached --check` | 0 | 最终 staged diff 无 whitespace error |

默认 npm test 的失败文件为 `data-cache/worktrees/v2-phase1/scripts/tests/company-guidance-expectations.test.mjs` 和 `data-cache/worktrees/stage-4-1-r2/scripts/tests/company-guidance-expectations.test.mjs`，与已审查基准的扫描问题相同。未修改 test 配置或移除既有 worktree。默认测试失败与隔离测试通过分别记录，不将全套门禁称为全绿。

环境的 10 WARN / 4 SKIP、数据审计的 24 WARN 及构建的超过 500 kB chunk warning 保留，未扩展到环境修复或 UI 拆包。data:audit 自动生成的时间、扫描数与行号差异已恢复，历史报告不回写。

## 冻结与范围核验

- `contracts/v1/**` 对 reviewed HEAD 及 origin/main 均无 diff；没有 CB-1/2/3 合同修订。
- `001-local-core.sql` 原始字节 SHA-256 仍为 `41456eea0c4db14f85559d5b6e8b194f3267cf9a5d23ac084318865ec4d5f67d`，loader checksum 仍为 `339bbd8b1cadb8196fb1b4ac9ab2a48d7fbb48c7452dcea89a3320c34166f1ef`。001 对 origin/main 无 diff；001/002 对 reviewed HEAD 均无 diff。
- 002 checksum 仍为 `88512734008b604639d0b5bc667249d435ca3fecbabbe55c631607ea85f78406`；未增加 migration。
- 没有真实用户金融数据、默认用户数据库操作、UI、MCP、cloud、broker、Provider refresh 或 performance 改动。未新增 wire version、source 字段、依赖或通用 SQL 写入口。
- 只普通 commit + push 到原功能分支；最终 local HEAD / remote SHA、相对 reviewed HEAD 的增量及 clean tree 在交付回复登记，避免提交内自引用 SHA。停止于待独立复审；未创建 PR、合并 main 或进入下一 Phase。
