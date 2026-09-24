# Portfolio additive contract V1

状态：PENDING INDEPENDENT AUDIT。冻结 Phase 1B wire payload、permissions、迁移均保持。

机器可执行 input/read-model shape 位于 `shared/portfolio.mjs`，TypeScript shape 位于 `shared/portfolio.d.mts`；规划/研究关联 schema 位于 `src/services/portfolio.ts`，由专项 contract tests 校验。`methodology.json` 固定方法学，改变分母/可比性/时间语义需新版本。

新增对象只有可重建 Portfolio Projection，以及确认后的 Research Link / Target Allocation / Rebalance Review。Position identity 是原 accountId + assetId 的无歧义 tuple，不是第二个账本。Target 用同一币种、同一快照日期 cohort 的单一维度表达，比例为用户输入的 basis points，总和必须等于 10000；不混合多个维度重复计权。Rebalance 是按 exact target revision 与 projection bytes 确定性生成的读模型；review 追加，不伪装执行。

本机只读 seam 需要操作者显式设置 `PORTFOLIO_LOCAL_DB` 并先编译 Local Core。只能读取已有安全路径的 DB，read-only SQLite transaction 保证多表一致。仅 loopback、同源自定义 header GET；没有 CORS、任意文件参数、SQL、写接口或 hosted 部署路径。浏览器持仓不持久化；研究/规划本地 owner 不授予账本 authority。

## Targeted audit fix — integrity and account lifecycle

`projectPortfolio()` is the only binding producer. Every result (partial, unresolved, conflicted) includes `integrity = { version: "portfolio-integrity.v1", canonicalPayload }`. The payload is the existing canonical JSON representation of **all** projection fields except `integrity`, including positions, account lifecycle, all receipts/blockers, cohorts, status, scope and asOf. `validateProjection()` compares both the received payload and schema-parsed payload to this binding before the existing reconstruction checks, and additionally requires exact rebuilt positions/status. It never repairs or reseals data. Missing, corrupt or future bindings fail closed; old ephemeral projections must be reread through the projector.

This is deterministic content integrity, not a signature or an independent authority. The canonical payload duplicates the read-model bytes in transit to preserve synchronous validation without a dependency or hashing service. A party able to replace both payload and binding is outside this content-drift guarantee, just as with an unkeyed digest. The local-only read seam and original confirmation/Audit validation remain the trust boundary; no private ledger fields beyond the existing read model are exposed.

Phase 1B `Account.status` is copied verbatim to `positions[].accountStatus` with its original account receipt. V1 explicitly retains inactive/archived accounts' eligible recorded positions in the `recorded_positions_only` denominator: lifecycle is not a sale or zero-position fact. These positions carry `ACCOUNT_INACTIVE` / `ACCOUNT_ARCHIVED`; projection and cohort blockers include the account ID. UI displays active/inactive/archived and explicitly states non-active positions remain included and need review. Missing/unknown lifecycle rejects. No Account, ledger payload, permission, target-universe or execution semantics change.
