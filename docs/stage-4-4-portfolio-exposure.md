# Stage 4.4 — Portfolio Exposure Integrated MVP

状态：IMPLEMENTATION IN PROGRESS / PENDING INDEPENDENT AUDIT。Base：`9e363474abc22ebb6da391dbb2c45c9e8c9358e8`；fetch 后开放 PR 为 0，原工作区 clean。从最新 origin/main 新建 `codex/stage-4-4-portfolio-exposure-integrated-mvp`，不改 main。

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
