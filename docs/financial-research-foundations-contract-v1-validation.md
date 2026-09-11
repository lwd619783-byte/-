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

## 独立审计 remediation（审计输入 79c114d）

本节为后续差量记录，不回写上面的初次交付测试数字。已执行 `git fetch origin`，local/remote audited HEAD 均为 `79c114d896659b39d3c34808edffb7ae2f0cd693`；main 仍为 `087c52a7962ed08c3f550d79987e0282be5607cf` 且为 HEAD ancestor；工作区初始 clean。

两个 blocking finding 的本地关闭证据（PENDING INDEPENDENT RE-REVIEW）：

1. **F2 graph revision identity**：previous revision 必须恰为 current - 1；复用 nodeId 的七项 immutable semantic fields 不变；关系 JSON 及端点身份同时受保护。新增 12 项图版本测试：合法 immediate revision、七项 identity 字段篡改、跳 revision、relationId 不变但端点 ref 变化、允许 conditions 重投影，以及新节点必须使用新关系 revision。全部通过；无 Graph DB / Node business schema。
2. **F3 released suite immutability**：新增 `golden-suite.v1.json`，suiteId=`financial-research-foundations` / version=1，exact roster=33，case version 全部为 1。manifest byte digest 为 `d2b95cba7576174a576d4f7de19c0b168fc1e50accfae1f413929a84d4b63610`，由 checker 固定；逐 case 同时冻结 identity 和 canonical JSON digest。7 项 suite 回归覆盖 delete/add/version mutation/同数量替换/duplicate identity/同版本 expected 篡改/reorder pass。不依赖 case 数组顺序，不只检查 count。

**Synthetic pins**：owners 中 formula/manifest/calendar/scope/inputs/policy 均补齐 id/revision；formula.version 等原字段含义不变。scenarios/bindings 使用明确 fixture-level identity/version/locator 规则，原业务 schema 不扩字段。新增测试遍历全部 51 个不同 synthetic owner/locator，对 objectId、version、digest、locator 分别进行正向和负向验证。全部 225 个 pin（52 个不同 owner/locator，包含真实 PBC definition）重新核验摘要；暂存 Git blob 的摘要亦一致。与审计输入比较，golden-cases/scenarios/bindings/PBC example 除依赖 sha256 外 JSON 语义相同；caseId、version、expected、request 和 PBC allowed/forbidden uses 均未变。真实 owner identity equivalence 继续属于未来 domain adapter。

| 本轮命令 | 实际结果 |
| --- | --- |
| `npm run contracts:validate` | PASS；原 V1 registry 保持，33 cases / 8 categories |
| `npm run test:contracts` | PASS；106 existing + 78 foundations；0 fail |
| `npm test` | PASS；55 files / 725 tests |
| `npm run build` | PASS；保留既有大 chunk warning |
| `npm run data:audit -- --no-write` | PASS with warnings；319 scanned、0 errors、24 warnings |
| `npm run env:check` | READY WITH WARNINGS；48 PASS、10 WARN、0 FAIL、4 SKIP，exit 0 |
| `git diff --check` / staged diff check | PASS |
| 全部受影响 pin / 暂存字节 | PASS；225 references |

既有环境与数据 warnings 保留，不扩大本轮修复。Scope Freeze 与包 README 已同步规则；feature-registry / execution plan 的 CONTRACT FROZEN / VERIFIED / PENDING REVIEW、NOT_IMPLEMENTED / NOT_ADMITTED 状态与能力限制未变，按本次指令不机械修改。roadmap / architecture、contracts/v1、runtime/UI/Provider/Agent 均未修改。普通 commit/push 后核验 local=remote 并停止；不创建 PR、不 merge。
