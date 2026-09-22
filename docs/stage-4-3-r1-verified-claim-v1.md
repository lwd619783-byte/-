# Stage 4.3-R1 — Verified Claim V1

2026-09-22 · IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT。基线为本轮 fetch 的 `origin/main @ de2107571ae5ee2189b82f7ab05b6521a4457b75`；分支 `codex/stage-4-3-r1-verified-claim-v1`。普通 commit/push 后停止，不创建 PR、merge 或部署 Production。

## D0 — Reuse / Delta Map（实现前）

| 已有事实源 | 复用结论 | R1 增量 |
| --- | --- | --- |
| `evidence-graph.v1.schema.json`、`relation-policy.v1.json`、`evidenceGraph.mjs` | 原图、typed edges、origin、conditions、exact pins、历史图规则全部保持 | Claim revision 仅引用 exact candidate pin、graph identity/revision/digest、target；不存第二张图 |
| `industrySignalClaim.mjs`、`industrySignalClaimProvider.ts` | 保留已审查公式、模板、candidate owner、owner 解析与 Industry F2 加严验证 | 首个原 owner adapter；不改真实留存数据、admission、release 或 expected |
| `EvidenceDrawer.tsx`、`industryClaimAudit` | 原 observation / source / raw evidence 展示与折叠 audit | 原 Industry Candidate 卡片打开验证/历史，继续使用同一 Drawer |
| Wiki / Creator append-only 与 `PersistedBaseGuard` | 复用精确原字节 stale-base 检查、确认导入、pre-write backup、corrupt recovery/future-schema lock 模式 | 独立 Claim 业务 owner；无通用 graph/Evidence store，无 Legacy 扩建 |
| R0 External Knowledge Lane | 外部背景不具有 verification authority | 有限 title / URL / kind 引用；无正文/文件/API/自动 mapping，F2 不接收 context |
| F3 frozen Foundation / Industry suites | 历史 expected 与分母保持 | 新增 Claim 实际服务回归，supported 仅 synthetic fixture |

新增 owner 合同仅表达 master plan 已授权的 L3 identity/revision/review，不改变冻结 F2、Phase 1 permissions 或既有 owner 的字段语义。正式审计针对本 R1 additive owner 与实现；不借历史合同审计声称本轮已审计。

## 设计边界

稳定 identity 来自原 adapter + candidate object identity。每个 revision 绑定 exact 原 candidate pin、graph identity/revision/digest、target 和 asOf；statement、scope、origin、generation 从该 owner 取得，不能用自由正文替换。新 revision 不继承旧 VERIFIED；拒绝与验证均为 exact revision 的 append-only 用户决定。AI/template origin 永久保留。

F2 必须在 preview、confirm 与可验证读取时执行，结果为 supported 且 conditions 为空、selectedRefs 精确为 target 才可确认。原 owner 不可用、pin/graph/正文漂移、corrupt/future schema、历史分叉与 stale base 均 fail closed。用户确认与 Research Context 均不能覆盖 blocker。

Context 为非权威背景指针，保存在本地 Claim revision；仅回答研究背景来自哪里，不传入 F2。公共测试只使用显式 synthetic URL，不包含私人真实 ID、正文或文件。

## 实际实现

- Additive L3 owner：`contracts/verified-claim/v1/claim.schema.json` / `src/types/verifiedClaim.ts` / `verifiedClaim.ts`。candidate 原 identity 与 exact pin 分离：同一 candidate identity 的后继版本可追加，但 origin/generation 不可改写。每个 revision 的 terminal review 为 VERIFIED 或 REJECTED；改判必须创建新 revision，历史不覆盖。
- Gate：`industryVerifiedClaimAdapter.ts` 从已校验的真实原 owner 建立图 canonical SHA-256 和 candidate pin 绑定；`previewClaim` 同时要求原 F2 与 Industry owner evaluator supported、conditions 为空且 selectedRefs 恰为 target。保存时重新执行；preview WeakMap 绑定原对象和持久化基线，clone/tamper/replay/跨版本/stale-base 拒绝。
- Persistence：`BrowserClaimRepository` / `PersistedBaseGuard`，键 `investment-research-dashboard.claim.v1`。普通写入只追加；backup 保存 entries/revisions/reviews，导入拒绝同 ID 不同历史，恢复要求原字节预备份、明确确认和读回核验。未知 schema 锁定，不自动初始化覆盖。
- UI：原 Industry 的“指标与变化”→ Candidate 卡片“验证主张与历史”；原 Evidence Drawer、中文 blockers、折叠 exact pin、验证预览、本人确认/拒绝、按记录时间过滤历史、JSON 导出/预览导入/损坏恢复。按需加载；切换行业取消待完成的验证入口请求。不新增一级导航或外部平台 API。
- 历史：根据记录时间截止过滤版本与确认事件；新草稿覆盖当前 head 展示但不继承旧 VERIFIED。历史 owner 失联时保留 review 记录，但当前可用状态为 BLOCKED，不把旧决定当作现在证据仍可用。

## 真实候选与准入

本轮通过真实 bundled Industry owner 重新构建、解析 exact pins 并测试全部五条：EIA 商业原油库存、原油出口、原油产量、炼厂原油投入，以及 NBS 工业机器人产量。**5 candidates / 0 verifiable / 0 verified**；这是当前留存输入与隔离验收环境的结果，不声称读取了用户私人浏览器存储。

全部 F2 blockers 仍包含 `not_admitted`、`partial`、`unknown`，并返回 `F2_NOT_SUPPORTED` 的确认阻断。原 `releaseAvailableAt=null`、PIT unproved、revision continuity unknown 不变；本轮未刷新、改写或猜测真实字段。两个行业仍 ABSTAIN；原行业范围、维度/Entity/正式方法等资格 blocker 不被 Claim 验证越过。未把“数学差值可复算”提升为正式景气判断。

原 `contracts/financial-research`、Industry frozen cases、`research-data`、`config/industry` 和真实 source 数据对 main 基线无 diff。Supported 只来自冻结 F2 `closed-lineage` 的明确 synthetic AI-origin 变体；测试中本地持久化/确认亦标记 synthetic，不向用户真实存储写示例。

## 本地验证

| 检查 | 结果 |
| --- | --- |
| `npm test -- --maxWorkers=2 --minWorkers=1` | PASS：100 files / 1,276 tests；完整 suite，无排除或放宽 timeout |
| Claim domain / repository / owner / context / F2 adversarial | PASS：30 tests，包含全部真实五条 fail-closed 回归 |
| Claim UI | PASS：3 tests；supported synthetic preview/confirm/reload、blocked rejection、future schema |
| R1 独立 F3 | PASS：4/4；原 evaluateRequest / Result / semanticDiff；supported confirmation、context isolation、release unknown、正文错绑 |
| `npm run build` / TypeScript / Local Core boundary / bundle checks | PASS；原大 chunk warning 保留，未改变预算 |
| `contracts:validate` / `test:contracts` | PASS；106 Local Core + 78 Financial Research + 90 Vitest；新 closed schema 与 standalone validator 一致 |
| `test:research-eval` / `research:eval:check` | PASS；原 51 Node tests + R1 4 tests；Foundation reference 33/33，service 0/33；Industry 独立5/5，不改 expected/分母 |
| `test:industry` / `data:validate:industry` | PASS；8 Python / 107 Node / 90 Vitest；6 owners 与图/派生重放 |
| `test:discovery` | PASS；100 formal suites；嵌套 checkout 排除规则未改 |
| `data:audit` | exit 0：0 errors，38 warnings（P1=20 / P2=18）；无新增豁免，无降级门禁 |
| Current Industry browser | PASS：729 checks；单浅色 × 320/390/1536，原 Snapshot/Metric/Graph/Drawer 回归 |
| R1 Claim browser | PASS：103 checks，3 screenshots；实际五条候选、两行业、三尺寸、Drawer、context 不改变 blocked、禁用 VERIFIED、拒绝及 reload history；0 runtime errors |

浏览器使用独立临时 Edge context，未使用真实 profile、外部 API 或个人存储。原脚本的三主题选择器/“研究概览”定位已不符合 UI V2 当前事实（AppearanceControl 为兼容空组件，指标移到“指标与变化”）；仅更新路由/外观定位和运行基线采集，原证据、只读、布局与事实断言保留。不沿用旧 2163 checks 数字。旧 favicon 404 warning 保留。

首轮 `npm test` 与多项重检查并发时一个既有 App 用例超过其原 20 秒 timeout；限制 worker 后完整1,276项通过，未修改该用例或 timeout。新 schema helper 采用非 minified 可读输出，避免整行金融标识使纯 timezone 默认值被误分类；静态审计规则不改，两处 helper 继续如实记为 P2 warning。历史 `docs/data-audit-v1.md` 不回写，本次报告保存在本地验收目录。

验收日志、浏览器报告/源码 SHA-256 与截图位于 gitignored `data-cache/stage-4-3-r1/`；提交后以 Final SHA/index 字节核对相同受测 runtime。CURRENT、Execution Plan、Feature Registry、Architecture、master plan 与 R0 已发生的 PR #74 / main CI 事实已同步。

## 限制与停止点

LocalStorage 沿用原 `PersistedBaseGuard`：拒绝最终同步读已变化的基线，但不是跨标签页原子 CAS；不声称有多写者事务锁。当前只注册 Industry 原 owner；历史 pin/graph 无法解析时，当前可用 VERIFIED、追加和恢复均 fail closed，需要保留对应原 owner 版本；没有自动修复或镜像历史 Evidence。

R1 本地验证不替代独立审计、Hosted CI、main merge 或 Production/data admission。正式停止点为当前功能分支普通 commit + push 后等待 ChatGPT 独立审计；不创建 PR、merge、部署或开始 R2。
