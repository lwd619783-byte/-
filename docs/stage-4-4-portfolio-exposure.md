# Stage 4.4 — Portfolio Exposure Integrated MVP

状态：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。Base：`9e363474abc22ebb6da391dbb2c45c9e8c9358e8`；fetch 后开放 PR 为 0，原工作区 clean。从最新 origin/main 新建 `codex/stage-4-4-portfolio-exposure-integrated-mvp`，不改 main。

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
