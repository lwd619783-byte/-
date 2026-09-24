# Stage 4.4 — Portfolio Exposure Integrated MVP

> 2026-09-24 FINAL CLOSEOUT / CURRENT — **CLOSED / IMPLEMENTED / TARGETED RE-REVIEW PASS / PR CI PASS / MERGED / MAIN CI PASS / Production READY**。最终 PR head `056cca6bc4e83af5014dfb482b98e86e248d591e`；PR #80 squash merge/main `68698ae7548aeb46fe9dd95fd0fdfcb4f13d1e4e`；PR CI `35985508556`、main CI `35986495424` completed/success；Production deployment `dpl_G8cjdpD9oT3E5sN9dCckptzkc77J` READY 且绑定同一 main SHA。Stage 4.4 正式关闭，下一主线 Stage 4.5 OS Domain MCP。Portfolio 仍保持 local-first、recorded_positions_only、no execution / Performance NOT_ADMITTED 等既有边界。


状态：**IMPLEMENTED / TARGETED RE-REVIEW PASS / READY FOR PR**。当前事实以本节为准；下方 A/B/C 与 2026-09-23 targeted fix 的状态、停止点及测试结果保留历史时点，不作为当前仍待 targeted re-review 的声明。

## Docs-only closeout — 2026-09-24 CURRENT

本次仅文档收口，未修改业务代码、tests、contracts、schema、依赖或 Stage 4.4 scope。开工确认原仓库、原分支 `codex/stage-4-4-portfolio-exposure-integrated-mvp`，本地 HEAD 与远端功能分支均为 `5d12c97cb0342176ec82196f39502668f5d9238f`，worktree clean；fetch 后 `origin/main` 为 `9e363474abc22ebb6da391dbb2c45c9e8c9358e8`，ahead 4 / behind 0，main 未漂移。没有 rebase 或 merge main。

### 审计与 Preview

- Previous audited SHA：`3bff8f1b52af26b812d633b9a1c66c4bad929ce6`。
- Targeted fix / ChatGPT targeted re-review PASS SHA：`5d12c97cb0342176ec82196f39502668f5d9238f`。根据本轮用户提供的已确认复审结论，P0 阻断 0 / P1 重要 0 / P2 轻微 0，未发现新的阻断、重要或轻微代码问题。
- P1 full projection canonical integrity binding：**PASS**。
- P2 Account lifecycle active / inactive / archived propagation / denominator semantics：**PASS**。
- 原 confirmation / Audit authority 与本机只读边界保持：**PASS**。
- Vercel Preview deployment：**READY**；本轮只读查询 Vercel deployment 元数据确认 `dpl_87XodK5xJJsSiRkvtrMHUH28YpHo` 对应上述完整 SHA、原功能分支，`target=null`（非 Production）。[Preview](https://investment-research-dashboard-hamjg4gz9-lkdmkl.vercel.app) / [部署记录](https://vercel.com/lkdmkl/investment-research-dashboard/87XodK5xJJsSiRkvtrMHUH28YpHo)。该 READY 仅绑定已审计代码 SHA，不是 docs-only 新 Final SHA 的部署或 Production 验证。
- 用户已完成该 Preview 人工验收，当前无新增产品修改要求；此项依据用户本轮确认，不宣称本轮重新执行人工验收。

### 当前真实边界

| 项目 | 当前状态与口径 |
| --- | --- |
| Stage 4.4 | IMPLEMENTED / TARGETED RE-REVIEW PASS / **READY FOR PR** |
| PR | **NOT_CREATED**；本轮按功能分支查询全部状态 PR，结果为空 |
| Hosted GitHub PR CI | **NOT_RUN**；已审计 SHA 的 GitHub Actions runs 查询为 0，本轮不触发正式 PR CI |
| merge | **NOT_DONE** |
| main | **NOT_MODIFIED**；本轮只提交原功能分支 |
| Production | **NOT_UPDATED / NOT_VERIFIED FOR STAGE 4.4**；Preview READY 不代表 Production READY |
| 私人真实 Portfolio ledger 实接 | 本轮仍 **NOT_RUN**，未作为独立审计证据运行；未读取私人 ledger |
| 真实 Portfolio 对象 | 本次 docs-only 创建/核验均 **0**；既有交付口径仍为 0 real Portfolio Projection / 0 real Position / 0 real Research Link / 0 real Target Allocation / 0 real Rebalance Task；私人存储未盘点部分仍 UNKNOWN |
| 本地验证 | 下方 110 files / 1456 tests 等为已审计代码 SHA 的既有本地证据；本轮未重跑全量测试，不写成 Hosted CI |

### 文档验证与下一停止点

只更新本文件、`docs/development-execution-plan-2026-09-07.md`、`docs/feature-registry.md` 的 Stage 4.4 CURRENT / 执行计划 / 交付状态；不回写历史审计。`git diff --check`、docs-only 文件允许清单、非文档零变化与状态边界一致性检查通过；未新增校验脚本。

本轮普通 commit/push 后停止：**READY FOR PR**。下一步由 ChatGPT 对 **docs-only Final SHA** 做极轻量复核，通过后再由用户授权创建 PR；本次不创建 PR、不运行正式 Hosted PR CI、不 merge、不修改 main、不部署 Production。新 Final SHA 以实际 Git 提交和最终报告为准，避免文档自引用 hash。

---

初始 A/B/C 交付时状态：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。Base：`9e363474abc22ebb6da391dbb2c45c9e8c9358e8`；fetch 后开放 PR 为 0，原工作区 clean。从最新 origin/main 新建 `codex/stage-4-4-portfolio-exposure-integrated-mvp`，不改 main。

## D0 · Reuse / Delta Map

| 原 owner | 复用 | 最小增量 |
| --- | --- | --- |
| Phase 1B AssetReads / SQLite | Account、Asset、PositionSnapshot、fingerprint、confirmed operation、Audit；只读打开，原 schema 不变 | 可删除重建的 Portfolio Projection；快照与入账时间双 cutoff；不从 Transaction 推算仓位 |
| Phase 1B Transaction / CashFlow / DCA | 保留正式账本及原确认、幂等、审计 | 无写入、迁移、复制 owner |
| Expression / Thesis / Claim / Evidence | exact revision + confirmation，原 preview / trace / 原 Evidence Drawer | Position Research Link；引用原 authority，每次读取重新校验，历史 pin 不替换 |
| Workspace / PersistedBaseGuard | 组合路由、当前统一浅色设计、本地持久化基线保护 | 组合页面；独立的研究关联和规划 owner，无持仓账本写权限 |
| F3 / Eval | 原分母和服务保留 | Portfolio 独立 synthetic suite；真实对象分账 |

D0 未发现要求破坏冻结资产合同、建立第二账本或无法安全隔离浏览器的阻断。新增 additive Portfolio 合同与实现等待本轮独立审计，不借用 Phase 1B 历史审计作为本轮准入。

## 方法学 V1

- `asOf` 为精确 UTC instant；PositionSnapshot.snapshotDate 是日级事实，保守使用该日 UTC 日终；Audit.timestamp 是入账可得时间，两者必须不晚于 cutoff。Account / Asset 同样按原确认回执可得时间过滤。
- 每个 exact Account + Asset 选择 cutoff 内最新快照；同 identity/date 多份快照无论数值是否相同均 conflict，损坏/未知版本/无法追溯确认 fail closed。缺快照不推算仓位，未来追加不影响历史结果。
- 分母只包含已记录且合法的快照仓位，**不声称覆盖全部账户资产**。只在相同 currency + snapshotDate cohort 内给出金额与 share；不同币种无 FX 不加总，不同时点不声称当前总资产。缺维度单独 unresolved，未知不归零。
- 结构暴露按 Account / Asset / assetType / primaryCategory / strategyBucket / currency 聚合。研究暴露仅定性 relationships、direct/indirect、sensitivity、blockers，不提供研究暴露百分比。
- exact Expression/Thesis 后继不自动替换；asOf 前已 supersede 阻断新关联，历史关联仍保留且在当前标记待复核。原 owner 缺失或不合法即传播 blocker。
- Target / Rebalance 是用户确认的规划，不是交易。当前数量、价格、交易单位、完整账户覆盖不能证明时，保持 blocked；不生成 Transaction、不改快照、不计算正式绩效。
- 浏览器只读 seam 仅本机 Vite 开发服务、显式指定已有本地 DB 后启用；默认不访问用户 DB。生产静态页面没有该端口，显示未连接。Synthetic 仅测试注入，不进入真实 runtime。

## 交付边界

本轮只普通 commit/push，等待独立审计；不创建 PR、不 merge、不修改 main、不手工部署 Production。没有读取真实券商账户、真实私人 ledger、调用券商 API/MCP 或配置真实比例。真实对象数量只能报告本轮创建/核验的对象，不推测用户私人存储。

## A / B / C 实际实现

- A：`shared/portfolio.mjs` 从最小 DTO 计算可重建只读结果；`local-core/domain/portfolio-projection.ts` 只消费原 AssetReads/Audit，核验 schema、payload digest、确认、actor/client/operation/scope。`LocalStore.readAssetSnapshot` 仅 readonly 模式允许同步 SQLite read transaction；原写合同、migration、业务权限不变。A checkpoint `c36c56a`。
- B：`portfolio.ts` 保存 exact Position tuple → Expression revision/confirmation 的 pin；原 `expressionTrace` 重读 Thesis/Claim/F2/Evidence。关联表达用户选择的持有依据，不声称不同 owner 的 instrument 同一，不按名称匹配。Macro/Industry relationships 保留原定性表达和 blocker。B checkpoint `9c65645`。
- C：`PortfolioRepository` 只持久化 append-only Link/Target/Review，复用 PersistedBaseGuard、原读取对象、exact bytes、bound preview、防篡改/过期/重放、显式本人确认。未知版本与损坏锁写且可导出原始字节。Target 同一 scope/维度比例以 basis points 校验，总和 10000，无默认比例；Rebalance 从 exact projection + target 确定性重建，包含 current/target/delta、lineage、research context、blockers 与 review history。Review 不解除执行阻断。
- UI：原组合路由接入独立 lazy Workspace，App 只做接线；中文界面沿用当前单浅色，不恢复旧三主题。结构暴露六维、持仓、原 Evidence Drawer、研究关联、目标配置与复核任务完整接入；工程诊断折叠。320/390/1536 与 reduced motion 验证。

## 验证与证据

本地日志与截图保存在 gitignored `data-cache/stage-4-4/`，不提交私人数据或临时 harness。

| 检查 | 本地结果 |
| --- | --- |
| contracts validation | PASS；原 V1/研究合同及 additive Portfolio methodology/input/projection 检查 |
| contract regression | 106 Local Core + 78 Financial Research Node + 162 Vitest PASS |
| Local Core | 261 PASS；另 4 Portfolio Node integration PASS，包括 readonly transaction、无 mutation、回执漂移与历史 cutoff |
| Portfolio projection/seam | 10 Node PASS：币种分组、分母、未来/补录 no-leak、重复/冲突、无快照、损坏/未知版本、精度、loopback/同源权限 |
| 本机 HTTP negative checks | 4/4 PASS：未配置、无自定义读取标识、跨源、POST；响应 no-store，不回显路径或原始错误 |
| Portfolio research/planning/UI | 6 + 11 + 5 = 22 Vitest PASS：exact trace、supersede、不猜研究比例、目标历史/确认、preview drift、损坏锁定、确定性任务与复核 |
| F3 / Eval | 原 51 Node + 42 Vitest PASS，其中新增独立 Portfolio synthetic 分母 4/4；原 Foundation/Industry/Claim/Thesis/Expression 分母不变；research:eval:check PASS |
| 全量 npm test | 110 files / 1427 tests PASS，单 worker；无 skip/断言删除/timeout 放宽 |
| build | PASS：TypeScript、Local Core、Vite、financial bundle errors=[]；保留原 chunk-size warning |
| data audit --no-write | PASS：0 errors / 42 warnings（P0=0 / P1=20 / P2=22），与本轮基线已有记录一致；未改审计规则或刷新数据 |
| Portfolio browser | 47 checks PASS / 0 page runtime errors；真实隔离空状态 + synthetic 完整目标/关联/Evidence/复核流程；刷新保留 exact upstream 和规划历史；future schema 锁定、preview 后上游变化阻断 |
| Thesis / Expression browser regression | 49/49 + 43/43 PASS / 0 runtime errors；原正式研究数量和未知状态保持 |
| browser boundary / fixture isolation | PASS：整个 browser graph 0 forbidden Node modules；生产 bundle 无 Portfolio fixture、Node CLI 或环境读取实现；规划无 ledger mutation 调用 |
| diff | git diff --check PASS；旧冻结 V1、migration、原 Claim/Thesis/Expression 实现无修改 |

浏览器最终重跑曾在全量测试并行、文件换行规范化触发 Vite restart 后发生一次 `page.goto` 30 秒加载超时；保留 `browser/report-load-timeout.json`。停止文件修改并等待全量测试结束后，按原断言/timeout 单独重跑；不以失败前的部分检查冒充完整 PASS。`ui:audit` 仅静态扫描，不替代本轮浏览器结果；生成报告留在 data-cache，原历史报告未回写。

## 真实数量、NOT_RUN 与限制

本轮创建或核验的真实对象：**0 real Portfolio Projection / 0 real Position / 0 real Research Link / 0 real Target Allocation / 0 real Rebalance Task**。没有连接私人 DB；这不是对用户已有私人存储的全局盘点，未读取部分仍 UNKNOWN。Synthetic SQLite/Browser/F3 对象均不计入真实数量。

- NOT_RUN：真实私人 ledger 接入、真实券商/真实账户迁移、Hosted CI、独立审计、PR、merge、Production 部署。没有这些操作的授权扩展或成功声明。
- 本机 seam 可用性仅面向显式启用的本地开发服务；静态 production 不会连接 SQLite。端到端有数据浏览器验证使用明确 synthetic fixture；原 SQLite 读取/回执/只读 transaction 在独立 Node integration 中验证。没有声称私人实盘接入已验收。
- 结构分母为已记录仓位，不证明全部资产覆盖。目标仅针对已有合法快照中可解析的维度值；新增未持有资产、未来快照、FX、实时价格、trade unit 不猜值。目标按币种/日期/account scope 固定，改变 scope 需独立确认。
- 新 Link/Target/Review 为本地浏览器规划 owner；无云同步或恢复/合并导入入口。可导出完整原始历史；损坏/未来版本不会自动修复。LocalStorage 继承非原子跨标签页 CAS 限制。
- 历史 research pin 原 owner 丢失后保持不可用；正式关联不能靠嵌入 bytes 恢复成真源。原 Stage 4.3 data admission、ETF/Index/Fund owner、私人知识验收缺口不升级。
- 所有任务为规划复核，缺价格/交易单位/完整覆盖时 `blocked`；没有买卖数量、成交状态或正式绩效值。

最终停止点：**普通 push 完成后等待独立审计**。Final SHA 以 Git/最终报告绑定，避免文档自引用 hash；本分支不预写 MERGED、MAIN CI PASS、Production READY 或 Stage 4.4 CLOSED。


## Targeted audit fix — 2026-09-23

本节是原 A/B/C 交付之后的定向增量，以上审计与验证数字保留原时点含义。Previous audited SHA：`3bff8f1b52af26b812d633b9a1c66c4bad929ce6`；继续 `codex/stage-4-4-portfolio-exposure-integrated-mvp`，不重做 A/B/C、不扩 scope。状态：**IMPLEMENTED / PENDING TARGETED RE-REVIEW**；修复 commit / Final SHA 由最终 Git 报告绑定。

- **P1**：仅 `projectPortfolio()` 的私有封装产生 `portfolio-integrity.v1`，绑定除 integrity 自身之外的全部 canonical read-model 内容。浏览器 `validateProjection()` 核验收到的原内容及 schema parse 后的内容，避免 trim 等规范化掩盖漂移；随后保留原 cohort/identity/lineage/time 检查，并增加完整 rebuilt Position 与 status 一致性。空结果、冲突结果同样绑定，缺失、损坏或未来版本拒绝。UI 读取入口也先验证再展示，损坏数据不产生持仓/规划表单，不进行自动修复。
- **P2**：从原 Phase 1B `Account.status` 直接传播 `positions[].accountStatus` 与原 account receipt；active/inactive/archived 均明确展示。V1 方法学冻结：合法已记录持仓不因停用/归档被视作清仓，继续计入相同币种/快照分母；非 active 在 Position、cohort、projection 与规划中有明确 blocker，UI 说明仍计入且需复核。缺失或未知 lifecycle 拒绝，无 active 默认值。
- **边界**：canonical binding 复用既有 exact-pin 工具，传输量增加一份 canonical read-model 内容；它与无密钥 digest 一样是内容完整性检查，并非签名，也不能认证可同时替换内容与 binding 的攻击者。真实性仍由原 Local Core confirmation/Audit 和本机只读 seam 建立。没有引入新服务、依赖、authority、账本或持久化投影；没有修改 frozen ledger contract、Account owner、target universe、FX/price/trade unit、execution/Performance admission 或 exact research pin。

新增负向回归覆盖 quantity、snapshotId、accountName、assetName、instrumentId、accountStatus、Position/global blocker 删除或伪造、三类 receipt 的 recordedAt/operationKey/auditEventId/payloadDigest、status、schema/binding 缺失/损坏/future、规范化前漂移，以及 self-consistent forged binding 下的 rebuilt status 不一致。所有 mutation 检查保留 cohort 金额不变。生命周期分别覆盖正式确认回执读取、只读不改 ledger、Node 投影、Vitest planning/UI 与浏览器；真实对象数量仍为 0，浏览器 seam 篡改仅为隔离 synthetic transport fixture，不连接私人 DB。

本轮实际 changed files（相对 Previous audited SHA）：

- `shared/portfolio.mjs`、`shared/portfolio.d.mts`
- `local-core/domain/portfolio-projection.ts`、`local-core/tests/portfolio.node.mjs`
- `src/components/portfolio/PortfolioWorkspace.tsx`、`src/components/portfolio/PortfolioWorkspace.test.tsx`
- `src/services/portfolio.fixture.ts`、`src/services/portfolioPlanning.test.ts`
- `scripts/tests/portfolio-projection.node.mjs`、`scripts/portfolio-browser-check.mjs`、`scripts/contracts/portfolio.mjs`
- `contracts/portfolio/v1/README.md`、`contracts/portfolio/v1/methodology.json`
- `docs/feature-registry.md`、`docs/development-execution-plan-2026-09-07.md`、`docs/stage-4-4-portfolio-exposure.md`

完整复验结果与证据见本节下表（本机日志：`data-cache/stage-4-4/targeted-fix/`，不提交生成产物）。


| 本轮复验 | 实际结果 |
| --- | --- |
| Portfolio Local Core integration | 7/7 PASS；三种原 Account status 与原 confirmation/Audit receipt，ledger 字节不变 |
| Projection / local seam Node | 44/44 PASS；最终日志 `projection-final.log` |
| Portfolio domain / planning / UI | 51/51 PASS（6 + 36 + 9）；无删除原测试或降低断言 |
| Portfolio F3 | 4/4 PASS；原冻结分母不变，synthetic-only |
| Local Core 全套 | 261/261 PASS |
| Thesis / Expression regression | 49/49 + 71/71 PASS |
| npm test（最终单 worker 完整运行） | 110 files / 1456 tests PASS |
| npm run build | PASS；browser graph 2702 modules / 16 chunks / 0 forbidden；既有 chunk-size warning |
| contracts validation | PASS；包括新增 Portfolio binding/lifecycle 方法学断言；Phase 1B frozen contract 未变 |
| data audit --no-write | PASS；0 errors / 42 warnings（P0=0 / P1=20 / P2=22），未刷新数据或回写报告 |
| Portfolio browser | 114 checks PASS / 0 page runtime errors；包含原流程与 27 种不改变 cohort 的响应篡改、三种 lifecycle 展示/分母/手机宽度 |
| browser boundary / fixture isolation | PASS；生产 bundle 无 fixture / Node CLI / ledger write 路径 |
| Thesis / Expression browser | 49/49 + 43/43 PASS；两者均 0 page runtime errors |
| git diff --check | PASS；16 个 changed files，frozen ledger / Account owner / 原 Research 实现未变 |

首轮默认并发 `npm test` 与 Local Core/编译等验证并行时，`App.owner-state.test.tsx` 的 A/D 用例在原 20 秒 timeout 下失败（其他 1455 项通过）；失败证据保留于 `npm-test.log`。其他验证结束后以 `npm test -- --maxWorkers=1 --minWorkers=1` 独立完整重跑，110 files / 1456 tests 全通过（221.71s）。原 timeout 与所有断言保持，未以局部重跑替代全量证据。

停止点：普通 commit/push 当前分支后等待 **ChatGPT targeted re-review**。不创建 PR、merge、修改 main 或部署 Production。Hosted CI / Production / 私人 ledger 实接仍 NOT_RUN，本轮真实 Portfolio 对象创建/核验仍为 0。
