# Stage 4.3-R2 — Thesis V1 + Macro → Industry

2026-09-22 · IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT。Base 为 fetch 后的 `origin/main @ 1651aa7bbf3fcdf4a59d17e7ae6e6edaf057ef7d`；从该 Base 新建 `codex/stage-4-3-r2-thesis-v1`，未使用 R1 分支继续开发。仅普通 commit/push 后停止，等待 ChatGPT 独立审计；无 PR、merge、main 修改、Production 部署或 R3 实施。

## R1 已发生事实与本轮第一项同步

PR [#75](https://github.com/lwd619783-byte/-/pull/75) 于 `2026-09-22T13:33:13Z` merged，merge/main 为上述 Base；PR CI [35733395999](https://github.com/lwd619783-byte/-/actions/runs/35733395999)、main CI [35734221779](https://github.com/lwd619783-byte/-/actions/runs/35734221779) 均实时核验 success。GitHub Production deployment `6591911800` 绑定同一 SHA，状态 `success / Deployment has completed`，与用户确认的 Production READY 一致。R1 正式 **CLOSED**。

本轮第一项文档改动已将 CURRENT / Execution Plan / Feature Registry / Stage 4.3 CURRENT 补齐上述事实，并切换到 R2。未回写 R1/Slice 历史审计和 `data-audit-v1.md`。R3 仅 **PLANNED / NOT_IMPLEMENTED**，未扩展 Portfolio、MCP、Agent、Provider 或 data admission。

## D0 / 复用与新增边界

| 原事实源 | 本轮复用 | R2 新增 |
| --- | --- | --- |
| Verified Claim V1 + Industry adapter | 原 immutable revision/review、原 owner 解析与 `previewClaim` | Thesis exact Claim/review refs 与字节一致性核对 |
| Frozen F2 Evidence Graph | 原 graph、pin、release/PIT/admission/owner gate | 通过 Claim 重验 F2；不存新 graph 或 Evidence |
| MacroIndicator / Industry / Stock | 原应用 owner ID 唯一精确匹配，名称只展示 | 结构化引用与条件式 Macro → Industry 关系 |
| Research Workspace / Evidence Drawer | 现有「论点与观察」、原 Claim / Evidence 钻取 | Thesis panel，正式/草稿/情景/history/diff/confirmation |
| PersistedBaseGuard / Claim local-first pattern | loaded object + exact raw byte guard、预备份与恢复 | 独立 Thesis 业务 owner、append-only confirmations |
| Research Context | 原 kind/title/URL 安全约束 | 背景引用保留，永不进入 verification authority |

Additive L4 合同位于 `contracts/thesis/v1`；先定义 contract/types 再实现服务。新合同没有破坏冻结 F2、Claim V1 或 Phase 1 permissions；本轮新增合同与实现均等待独立审计，不借旧合同审计声明本轮审计已通过。

## 实现语义

`ThesisEntry` 持有 stable ID / origin；`ThesisRevision` 持有 statement、bull/base/bear、keyDrivers、catalysts、risks、invalidation、confidence、asOf、relatedEntities、supportingClaims、macroIndustry、contexts、reason。每次编辑追加新 revision，supersedes 必须是当前 head；origin 不可变化，时间不允许倒退。UI 新建内容来自用户输入，没有伪造 AI 生成结果；`ai_draft` wire origin 可在草稿/备份中表达，正式确认后仍保留 AI 来源。

`ThesisConfirmation` 是独立 append-only 用户确认记录，绑定 exact revision 和自指 `userApprovalRef`。prepare 绑定原 preview 对象、原基线和完整内容，confirm 拒绝未确认、clone/tamper/replay/stale preview，并重读原 Claim/F2。新 draft 不继承确认；current 保留最近已确认版本，draft 单独显示。历史正式记录不因当前 source 失效被删除，但支持状态变为 blocked。

Claim 引用同时包含 claimId/revisionId/reviewId 与 canonical revision/review bytes。字节只作为完整性核对 token，不能作为 fallback owner；解析必须从原 Claim repository 找到 exact 原对象、VERIFIED review、检查记录/审核时间不晚于 Thesis asOf 并通过原 F2。后继 Claim head 不自动替代旧引用；缺失历史 owner、内容变动、corrupt/future Claim storage 一律 fail closed。UI 钻取先显示固定的 Claim 原版本及 review，再打开 Evidence Drawer；如用户另行管理 Claim 当前状态，界面明确分开。

Macro → Industry 关系随 Thesis revision 不可变保存。macroDriver 必须为原 MacroIndicator、industry 必须为原 Industry，支持 Claim 必须为 Thesis 支持集合的精确子集，review 不晚于 relationship asOf，relationship asOf 不晚于 Thesis asOf。暴露只接受 direct/indirect/unknown，敏感性只接受 qualitative/unknown；无数值敏感度、宏观评分或行业方向。无支持或未知字段明确 unknown；无效 identity/evidence 为 blocked 并禁止正式确认。supported 仅说明引用的支持主张可用，关系 rationale 仍是用户定性判断，没有自动语义核验或被提升为 Provider Fact。

`thesisWorkspace.ts` 是组合层，不建立第二份 Entity registry。它使用应用 MacroIndicator/Industry/Stock owner 的既有身份，不隐式把 Local Core macro_metric 映射成 macro。所有身份解析均唯一精确匹配；身份缺失/歧义不自动修复。

LocalStorage 键 `investment-research-dashboard.thesis.v1`；JSON 备份键 format 为 `investment-research-dashboard.thesis-backup.v1`。导入仅追加、同 ID 不同内容拒绝；操作需要用户确认并先保留原始字节 backup。corrupt recovery 必须基于已观察且未变化的原坏字节；future schema 锁定恢复，不能用空数据覆盖。读模型/历史/preview 不写库。

## R1 非阻断测试增强

`scripts/verified-claim-browser-check.mjs` 已移除只读断言中的短路分支。每一次 candidate 打开、history 重开及其关闭前后，都比较 Claim LocalStorage exact raw string（包括 `null`）；不改变 R1 业务语义。

## 真实数据与 synthetic 分账

真实 bundled Industry owner 重新构建和复核：**5 candidates / 0 verifiable / 0 verified / 0 formal Thesis**。这是留存输入及隔离浏览器验收环境结果，不声称读取用户私人 profile。EIA 四项、NBS 机器人一项的 `not_admitted / partial / unknown`、PIT、releaseAvailableAt、revision continuity blockers 不变；没有刷新或修改真实数据。没有创建真实 VERIFIED Claim 或正式 Thesis。

正向 domain/UI/F3/browser 只使用 frozen F2 `closed-lineage` 的明确 synthetic fixture，通过原 `BrowserClaimRepository` 的显式 review 形成 synthetic VERIFIED，再通过 Thesis UI/服务的本人确认形成 synthetic formal revision。fixture 不进入 production import graph，不把这些覆盖计入真实数据。Foundation reference 33/33、deterministic service 0/33 和 Industry 独立 5/5 原分母不变；R2 独立 F3 分母为 10。

## 验证

| 验证 | 结果 |
| --- | --- |
| Thesis contract/domain/repository | PASS：26 tests；含真实留存单独 5/0/0/0 和 original owner/pins/F2/时间/确认/恢复对抗 |
| Thesis UI | PASS：5 tests；AI来源保留、正式确认/新草稿、exact旧Claim drill-down、未知与阻断、future schema、stale base |
| R2 独立 F3 | PASS：10/10；真实服务执行、独立 expected/semanticDiff；仅 synthetic 正向正式确认 |
| R1 Verified Claim regression | PASS：30 domain + 3 UI + 4 F3；业务代码无修改 |
| `npm run contracts:validate` | PASS；既有合同和新增 Thesis standalone validator 无 drift |
| `npm run test:contracts` | PASS：106 Local Core + 78 Financial Research Node + 116 Vitest |
| `npm run research:eval:check` | PASS；Foundation reference 33/33、service 0/33 NOT_IMPLEMENTED；Industry 5/5 |
| `npm run test:research-eval` | PASS：51 Node + R1 4 + R2 10 Vitest；原 expected/分母不改 |
| `npm run test:industry` / `data:validate:industry` | PASS：8 Python + 107 Node + 90 Vitest；registry/graph/source replay 保持 |
| `npm test -- --maxWorkers=2 --minWorkers=1` | PASS：103 files / 1,317 tests，无跳过/放宽 timeout；包含新旧全部 suite |
| `npm run build` | PASS：TypeScript、Local Core typecheck/boundary、Vite 和 financial bundle checks；0 forbidden模块、errors=[]。Thesis workspace lazy chunk，保留原大 chunk warning |
| `npm run test:discovery` | PASS：103 formal suite paths；control 复现3个嵌套checkout失败，正常路径全部保留 |
| `npm run data:audit -- --no-write` | exit 0：0 errors、40 warnings（P1=20 / P2=20）。新增2条P2为生成schema日期helper的 timezone `|| 0`；未改审计规则或增加豁免 |
| R2 real-retained browser | PASS：49/49、3截图；320/390/1536，实际5/0/0/0、unknown Macro、context、blocked确认、append/reload/history/raw bytes与布局 |
| R2 synthetic frozen browser | PASS：52/52、3截图；独立临时harness、原frozen Claim显式VERIFIED、UI本人确认、两版追加、旧版本不变、exact Claim/Evidence与reload；不计真实coverage |
| R1 browser exact-byte regression | PASS：130/130、3截图；每次 candidate/history打开及关闭前后精确原字节比较，移除短路 |

三组浏览器均为 0 page runtime errors；synthetic 临时 harness 控制台另有1条非运行时 resource 404消息，未影响检查，不宣称console完全无告警。全部使用隔离 Edge context，无真实profile。UI首轮浏览器暴露已填控件的label定位不明确，已补显式aria-label并在最终build和browser重验；未弱化断言。

本地详细日志、源码 SHA-256 与浏览器截图存于 gitignored `data-cache/stage-4-3-r2/`。报告中的source digest在提交前与staged Git字节再次核对；临时harness不进入生产bundle或提交。`docs/data-audit-v1.md` 保留历史原字节，本轮审计记录独立留存。

## 已知限制与交付边界

- LocalStorage 沿用 `PersistedBaseGuard` 的最终同步检查，不具备跨标签页原子 CAS / 多写者事务锁。
- 历史 Claim/F2 owner 失联时不构建镜像或替代证据。任一历史正式 Thesis 的支持失效会使仓库后续 append/import 保守阻断；记录仍可导出/查看，需要恢复原 owner 可用性，不能静默删除历史解除阻断。
- Identity 是现有应用 owner 精确 ID；不是新增 Local Core identity bridge、历史身份别名库或宏观准入。
- 自由 Thesis 文本和定性关系是用户研究判断；门禁核对支持引用与可得性，不证明文本因果关系或作投资评分。
- 不提供 AI runtime、自动 publish、远程正文读取、Provider admission、Portfolio、MCP、Agent 或 R3。R2 本地 PASS 不替代独立审计、Hosted CI 或 Production admission。


## P1 / P2 定向修复

基于已审计 `8505b607be998dc8313bfc2feeea3c004669ed57`，仅继续原功能分支。此段更新当前修复语义；前文原交付计数和历史记录保留原时点。

- 新 preview/confirmation 以 Thesis asOf 对 Claim revisions.createdAt（含相等时刻）选 head；若 pin 已由后继 draft/VERIFIED/REJECTED 版本替代，返回 `THESIS_CLAIM_SUPERSEDED_ASOF`，不能再作新正式支持。确认时重读原 Claim owner，再检查 head；preview 后变化不能绕过。
- successor 晚于 Thesis asOf 时，旧 Claim exact pin 继续合法。既存正式 Thesis 只读视图提示“支持主张已有后续版本/需复核”；不改变 pin、revision、confirmation 或存储字节。
- UI 当前支持数按 now，编辑 choices 按 editor.asOf；仅提供当时 head 且审核可得/F2通过的 VERIFIED revision。调整 asOf 后不合资格的已选旧 pin 明确显示阻断并允许用户从新草稿移除，不静默替换。
- 补齐 `current-development-direction-2026-09-13.md` 顶部 CURRENT：R1 CLOSED/merged/CI/Production；R2 IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT RE-REVIEW；R3 PLANNED / NOT_IMPLEMENTED。同步 Feature Registry 与 Execution Plan 的修复事实，不修改历史审计。

本轮修复验证（最终 runtime 源码与三组 browser 报告的16项 SHA-256 pins已按暂存区原字节核对）：

| 检查 | 结果 |
| --- | --- |
| Thesis domain/repository / UI / R2 F3 | 29 / 8 / 12 PASS；三种 successor 状态、相等 cutoff、晚于历史 cutoff、preview 后 head 改变、原字节与 choices 回归 |
| R1 domain / UI / F3 | 30 / 3 / 4 PASS；R1业务源码未改 |
| contracts validate / tests | PASS；106 Local Core + 78 Financial Research Node + 119 Vitest |
| research eval check / tests | PASS；Foundation reference 33/33、service 0/33，Industry 5/5 不变；51 Node + 16 Vitest |
| full `npm test -- --maxWorkers=1 --minWorkers=1` | PASS：103 files / 1,325 tests；无跳过、无 timeout/断言放宽 |
| build | PASS：TypeScript、Local Core boundary、Vite、financial bundle；保留原大 chunk warning |
| R2 real / synthetic browser，R1 browser | 49/49、76/76、130/130 PASS，均0 runtime errors，三种宽度；synthetic覆盖后继 draft/VERIFIED/REJECTED 后历史只读和新确认阻断 |
| data audit `--no-write` | exit 0，0 errors、40 warnings（P1=20 / P2=20），未新增豁免 |

最终边界收尾后，与 build/browser 并发的双 worker 全量运行出现既有 App.owner-state 的2个20秒timeout和1个后续dialog定位失败；停止辅助服务后，单 worker完整1,325项全部通过，未修改旧测试、断言或超时。失败运行与最终通过日志均保留于 `data-cache/stage-4-3-r2/fix-p1/`。synthetic harness仍有1条resource 404 console消息，不是page runtime error。

真实留存仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis**；synthetic 正向正式路径单独记账。没有改写历史 pin/history/confirmation，没有修改 Claim repository、Frozen F2、Provider、真实数据或 admission/PIT/release 配置。状态 **IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT RE-REVIEW**；普通 commit/push 原分支后停止，等待 ChatGPT 复审。
