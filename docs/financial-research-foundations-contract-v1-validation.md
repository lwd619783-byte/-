# Financial Research Foundations V1 · Validation

> 2026-09-11 · CONTRACT FROZEN / VERIFIED (offline scope) / PENDING REVIEW
> Runtime NOT_IMPLEMENTED；production/data NOT_ADMITTED。
> 此记录不声明 PR、merge、main CI 或独立审计 PASS。

## Preflight 与边界

先执行 `git fetch origin`，成功；`origin/main = 087c52a7962ed08c3f550d79987e0282be5607cf`；`origin/docs/financial-research-os-rebaseline-20260911 = 02a29ff25e05afa31aa44cf5ccbb12cdade6db02`；`git merge-base --is-ancestor` exit 0。重基线差异只有 AGENTS.md 与两份战略/进展文档，无业务代码。原工作区 clean。

从指定文档分支建立 `codex/financial-research-foundations-contract-v1`。本次只新增独立合同包、离线 checker/tests 和必要文档；原 `contracts/v1`、src、Local Core、migration、Provider、生产数据、roadmap 与 architecture 无语义变更。

## 最终验证

| 命令 / 检查 | 结果 | 证据范围 |
| --- | --- | --- |
| `npm run contracts:validate` | PASS | 原 V1 5 schemas / 40 definitions / 28 versions 保持；新增 F1/F2/F3 schema 与 33 cases / 8 categories 通过 |
| `npm run test:contracts` | PASS | 原 V1 106 tests + foundations 58 tests；0 fail |
| `npm test` | PASS | 55 test files / 725 tests；0 fail |
| `npm run build` | PASS with warning | TypeScript / Local Core typecheck / Vite / financial bundle gate 通过；既有大 chunk warning 保留 |
| `npm run data:audit`，随后 `npm run data:audit -- --no-write` | PASS with warnings | 319 scanned / 29 registry / errors 0 / warnings 24（P1=10、P2=14）；无 live refresh。首次生成的报告仅时间/扫描数变化，已清理，不回写历史审计 |
| `npm run env:check` | READY WITH WARNINGS | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `git diff --check` | PASS | 无 whitespace error |
| 暂存 Git blob 的 pin 摘要核验 | PASS | 225 个引用摘要与待提交字节一致；LF 归一后重跑 106 + 58 contract tests 全通过，避免只在本机 CRLF 字节上通过 |

环境 WARN 包含 Node/Python 版本提示、多个 Git 安装、4 个未固定 Python 依赖、pip check 问题、交付前未提交改动、ignore 覆盖提示、旧产物 schemaVersion 缺失、30 条 partial 公告、旧/未消费聚合产物。4 SKIP 为会写报告/状态的 A-stock validation、Provider health、UI audit，以及健康脚本跳过的 build:check；本次正式 build 已单独执行 bundle gate。上述状态不改写成零 warning。

首次 schema 编译发现原 V1 使用父级声明字段的 conditional required；checker 对齐现有 V1 registry 的 `strictRequired:false`，其余 strict/格式/ownProperties 保留。增加图版本条件时的 strictTypes 缺失已在 schema 中补齐 type，未放宽 strictTypes。最终命令均通过。

## 验收语义

- Reuse：EntityRef / EvidenceRef 直接 `$ref` 原合同，synthetic observation 直接 `$ref` MetricObservationVintage；图拒绝附带 `value` 等业务 payload。未新增 Entity、Metric、Evidence、Audit 或 Portfolio ledger 实体。
- Temporal/PIT：未来 revision 不进入历史查询；截止边界相等、DATE_ONLY_SAFE 次日边界、SCHEDULE_INFERRED 拒绝、独立 revision chain 冲突；observation/publication/release/effective 不能互为 alias，也不能使用 fetchedAt 冒充 release。
- Retrieval：精确实体/period/scope/definition/binding；displayName 不参与身份；未知/缺失、policy deny、状态降级不出可信数字。
- Evidence：digest/locator/identity/version、dangling edge、typed relation、cycle、future assertion、missing predecessor、unpinned revision 均有拒绝测试；无 Artifact ancestry、缺公式、candidate 原质量、AI 冒充 Fact 不能 supported。
- Propagation：partial/stale/conflicted/not_admitted 和反证均传到 Claim；额外测试传播到 Thesis/Expression/Position association/Review，不改变账本事实。
- Eval：篡改 expected value、selected refs、citations、outcome、conditions 被拒；同一 citation 集合只允许重排，不允许增删。无 SQL/prompt/文案比较。
- Earnings：必须早于所有相关披露，严格拒绝相等上界、未知 formation、较早 preview、unknown scope、measurement mismatch、未验证 source。
- Recompute：pin 公式/输入/manifest/calendar/scope/cutoff，固定分母；缺值/未知分母不能补零或缩分母。数值仅来自 synthetic arithmetic fixture，不是正式温度公式。

`.gitattributes` 对新增合同 JSON 与被 pin 的现有 PBC definition 指定 LF，以免 Windows checkout 的 CRLF 转换改变 byte digest。PBC definition 的 Git blob 内容未变；未更新任何历史数据值。

## CURRENT 与待审事项

同步 `feature-registry.md`、`development-execution-plan-2026-09-07.md` 的合同状态和范围；战略 scope、stage 顺序、runtime/data flow 未变化，不改 roadmap / architecture。完整 reuse / compatibility matrix 位于 [Scope Freeze §1](financial-research-foundations-contract-v1.md#1-existing--reuse--extend--new--reject先于-schema-的决策)。

本轮无待用户选择的冻结 blocker。仍须独立审查后才能进入后续授权实现。真实 owner adapter 的身份等价、原状态投影、权限/admission、证据语义与 retained bytes 必须另行实现和验收；当前 checker 只证明固定 synthetic 场景和引用合同，不能据此宣称真实 Provider、Agent 或跨域服务已通过。实际 Graph DB、Agent harness、真实公式 admission、业务 UI、migration 均 NOT_RUN / NOT_IMPLEMENTED。

交付停止点：普通 commit + push，核验 local HEAD = remote HEAD 后停止；最终 SHA 以 Git 提交及交付回复为准，避免在提交自身内部预写尚不存在的 SHA。
