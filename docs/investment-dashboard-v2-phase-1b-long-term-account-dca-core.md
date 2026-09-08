# Phase 1B — Long-term Account & DCA Core

开工基线：`87d33595a49dc99463333ad4637b44b7e33f68a9`；分支：`feat/v2-phase-1b-long-term-account-dca-core`。fetch 后 main / origin/main 一致，工作区干净。本阶段只做 Node Local Core；不读取真实资产、文件或用户数据库，不做 UI、行情、绩效、MCP、云端或真实迁移。交付止于普通 push。

## 实施前设计核对

现有 `local-core/ports/index.ts` 定义 LocalDatabase / EntityRepository / AuditRepository / ContractRegistry / EntityResolver。`db/connection.ts` 使用 better-sqlite3、同步 immediate transaction、嵌套失败标记及过期 repository 防护；`migrations.ts` 检查序列、checksum、完整 schema objects、integrity / FK。Domain 与 SQL 分离；Node/browser gate 已存在。Phase 1B 扩展同一 transaction repository set，不增加数据库 abstraction 或依赖。

| 冻结定义 | persistence / domain mapping |
| --- | --- |
| Account | 独立 accounts 表，合同 enum / stable accountId / status；只 create / read，保留归档状态，不 hard delete |
| Asset | 独立 assets 表及 tags 表；instrumentId 引用现有 Entity；primaryCategory / displayOrder / userOverrides 与 Provider identity 分离 |
| Transaction | 独立 transactions 表；绝对量 / 金额、confirmed、账户 / 资产 FK；confirmation + operation receipt + Audit |
| CashFlow | 独立 cash_flows 表；有符号金额、pairedTransferId；同事务双记录配对验证；external contribution 只汇总该 type |
| PositionSnapshot | 独立 position_snapshots 表；long-only；读取时与截至 snapshotDate 的流水核对，缺少数量或 adjustment 方向不明时明确 warning |
| DcaPlan | dca_plans identity + append-only dca_plan_revisions + dca_constraints；revision 为存储元数据，原 V1 payload 保持不变；activeFrom 与 constraint effectiveFrom 保留日期含义 |
| DcaExecution | 独立 dca_executions + transaction links；保存当次 revision，不改旧执行；rollover reference 与 external contribution 无写入关系 |
| AssetImportBundle / Plan / CommitRequest | 独立 import_plans、import_fingerprints、confirmed_operations；原合同候选与计划作为版本化 workflow payload 保存，不是正式账本 |
| LegacyAssetImport | 保存原合同 legacy metadata，与同 importId 的 AssetImportBundle 组成 Node 内部 prepare 参数；不增加 wire version；baseline 固定 2026-08-14 |

新增 `002-long-term-account.sql`；001 文件不改（开工原始字节 SHA-256 `41456eea0c4db14f85559d5b6e8b194f3267cf9a5d23ac084318865ec4d5f67d`，loader LF checksum `339bbd8b1cadb8196fb1b4ac9ab2a48d7fbb48c7452dcea89a3320c34166f1ef`）。新增窄职责 ledger read / transaction-scoped write ports。正式表有 FK / CHECK / uniqueness 与 append-only 防护，canonical payload 用于完整保留合同 optional 字段，与索引字段一起校验，不使用单一 generic JSON 账本。

所有正式 create、DCA revision / execution、manual transaction / cashflow、recurring / legacy commit 必须同一 transaction 完成 Audit、confirmed operation receipt、正式记录与去重索引。receipt 持久化 userApprovalRef、idempotencyKey、request digest、Audit FK 和结果；相同 key / 相同请求返回原结果，key 复用到不同内容 fail closed。账本 writer 仅在 transaction 内提供，写入必须引用已批准且有对应 Audit 的 operation receipt；LocalStore 只暴露账本读取。

计划采用现有 canonical JSON + SHA-256，绑定完整 bundle、legacy metadata、正式状态及 Entity revision digest。候选按依赖类型和稳定 ID 排序，planId 由内容 digest 得到；不使用随机 ID / wall clock 生成计划。prepare 可存 preview 工作流，不改正式状态。commit 在 immediate transaction 中重新生成与核验计划；任何正式状态或实体变化使旧计划失效，重复成功请求优先返回原 receipt。

去重使用正式 ID、candidate fingerprint、source evidence 与日期 / 账户 / 标的 / 金额组合。相同证据可能包含多条不同流水，不能以整张截图引用直接吞掉不同交易；匹配 fingerprint 但内容冲突 fail closed。预览可标 skip_duplicate；warn / needs_resolution / blocked 不允许 commit，不能用 approval 绕过。

reconciliation 仅检查合同 invariant：现金流方向与转账配对、交易同币种金额恒等关系、声明 external contribution 与候选 external contribution、snapshot 与 ledger；不实现 performance。无法表达或缺少证据的核对不补零、不猜规则。DCA 不解析自由文本 period 为日期，不发明 constraintType 的执行算法；时间应用如无法由现有日期 / transactionIds 唯一决定，应明确拒绝而非猜测。较早 legacy 数据必须有 verified evidence；`historical_import` 在 V1 source enum 中的表达需单独核对，不能私添 enum。

拟转为 executable 的场景：A-001～A-008，逐项以真实 domain 测试证明；若其中部分遇到冻结合同缺口，保留 partial / blocked，不把整项标通过。P-001 保留 declared / not-yet-executable。完整验证、自审与最终限制另记验证文档。
