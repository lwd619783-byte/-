# 投资研究看板 V2：合同终局审计 V1

> 状态：FINAL CONTRACT AUDIT  
> 日期：2026-09-05  
> 审计结论：**PASS FOR PHASE 1 IMPLEMENTATION（允许进入第一阶段实现）**
>
> 注意：这是“合同和边界通过”，不是“所有 V2 功能一次性全部开工”。绩效计算、真实远程 MCP 暴露和具体网盘 Provider 仍有各自的后续准入条件。

---

## 1. 用一句话说明结果

我们已经把“ChatGPT 怎么把研究写进看板、每周资产截图怎么记账、14 模块怎么长期更新、资产怎么分类、数据怎么备份和恢复、AI 能做什么不能做什么”写成了足够明确的统一规则。

后续 Codex 不需要再猜产品逻辑，可以开始按合同搭第一阶段基础设施。

---

## 2. 本次审计覆盖什么

### 研究

- 14 模块统一骨架；
- 空模块默认收起；
- 行业专属扩展；
- ChatGPT 研究贡献包；
- 一键推送预览；
- 一次确认正式提交；
- Markdown 对话全文归档；
- 名称识别、防重复实体。

### 资产

- 多账户 / 全资产预留；
- V1 只迁移长期价值账户；
- 交易流水；
- 资金流；
- 持仓快照；
- 定投计划；
- 定投执行；
- 每周截图候选导入；
- 历史 Excel / 策略文件迁移；
- 主分类 + 多标签 + 自定义排序。

### 安全与容灾

- AI 权限；
- 用户确认；
- 幂等、防重复；
- 版本冲突；
- 审计日志；
- 本地优先数据库；
- 加密备份；
- 多远端副本；
- 恢复前验证与当前数据库预备份。

---

## 3. 研究合同审计

### R-01 — 14 模块是否会变成死板模板

**PASS**

原因：

- M0-M13 固定为 taxonomy；
- 模块允许 deep / standard / light / not_applicable / empty；
- 行业专属数据使用 Extension；
- 空模块不要求生成填充文字。

### R-02 — 14 个模块是否有固定名称来源

**PASS**

已经增加 `industry-module-registry.v1.json`。

模块名称不能由 AI 每次自由发挥。

### R-03 — 是否真的能实现“一次聊天，多模块落库”

**PASS**

已经具备：

- ContributionBundle；
- ContributionPlan；
- ContributionCommitRequest；
- businessDiff；
- planDigest；
- expectedVersion；
- idempotencyKey；
- userApprovalRef。

实现时必须使用单个数据库事务或等价补偿机制，不能出现写一半。

### R-04 — 名称重复 / 错配风险

**PASS**

Entity Registry / Resolution 已补齐。

核心规则：

- stable ID；
- alias；
- ticker / exchange / provider identifier；
- 不确定就 needs_user_confirmation；
- allowAutoCreate 永远为 false；
- resolved 状态必须带 resolvedEntityId 和 confidence。

### R-05 — 聊天全文是否会污染正式事实

**PASS**

Markdown 只有 provenance / audit 用途。

正式页面和计算依赖结构化实体，不直接从 Markdown 推导生产数据。

---

## 4. 资产合同审计

### A-01 — V1 范围是否清楚

**PASS**

只迁移长期价值账户；数据结构为未来全资产预留。

### A-02 — 历史从哪里开始

**PASS**

2026-08-14 是正式基准日。

更早历史只有存在可信证据时才补录，不做模型反推。

### A-03 — 每周截图是否可能直接污染账本

**PASS**

已经单独增加：

- AssetImportBundle；
- AssetImportPlan；
- AssetImportCommitRequest。

流程固定为：

识别 → 候选 → 核对 → 预览 → 用户确认 → 正式入账。

### A-04 — 资金流正负号是否会算错

**PASS**

已经增加 `ledger-invariants.v1.json`。

统一为：

- 流入账户 = 正数；
- 流出账户 = 负数；
- 交易金额本身使用非负绝对值，由 buy / sell 等 side 表达方向。

### A-05 — 内部转账是否可能被算成新增本金

**PASS**

必须用相同 pairedTransferId 的两条 CashFlow：

- 转出账户负数；
- 转入账户正数；
- 同币种无费用时合计为 0；
- 不进入外部新增本金统计。

### A-06 — 定投规则变化是否改写历史

**PASS**

限购、最小交易单位等 constraint 带生效时间。

新规则只影响未来，不修改旧周记录。

### A-07 — 计划和实际是否会混在一起

**PASS**

Research / allocation proposal 不生成 Transaction。

只有真实发生、经过确认的记录才能进入正式账本。

---

## 5. 绩效审计

### P-01 — 是否已经可以正式显示 XIRR / TWR

**NOT YET ADMITTED（不是失败，而是有意延后）**

已经有 `PerformanceSnapshot` 保存结果，但具体计算方法还没有冻结。

因此第一阶段可以建设：

- 交易；
- 资金流；
- 持仓；
- 净投入；
- 基础账面盈亏数据；

但在正式 UI 宣称：

- XIRR；
- TWR；
- 年化收益；

之前，必须单独完成 `Performance Methodology V1`。

这是为了防止“页面有一个很漂亮的年化数字，但计算口径其实不对”。

---

## 6. 备份与恢复审计

### B-01 — 备份是否依赖 MCP / ChatGPT

**PASS**

不依赖。

由 LOCAL_SYSTEM / Local Backup Service 独立运行。

### B-02 — 备份是否包含完整性和加密信息

**PASS**

BackupManifest 已包含：

- 数据库版本；
- 备份对象；
- SHA-256；
- 大小；
- 加密算法；
- keyRef；
- 远端副本；
- 验证状态。

### B-03 — 恢复是否可能误覆盖当前数据库

**PASS**

已经具备：

- RestorePlan；
- checksum / decrypt / schema / staging 检查；
- currentDatabaseBackupRequired = true；
- RestoreCommitRequest；
- preRestoreBackupId；
- 用户确认；
- 幂等键。

### B-04 — 115 / 百度 / 华为具体 Adapter 是否现在就准入

**DEFERRED TO PROVIDER PROBE**

合同只定义“备份目标是什么样”，不把第三方网盘 API 写死进核心数据模型。

实现某个 Provider 前应单独验证：

- 官方接口仍可用；
- OAuth / Token 生命周期；
- 文件大小限制；
- 上传完整性；
- 下载恢复；
- 限流和错误重试。

这样某一家以后接口变化，不会破坏核心 Backup Contract。

---

## 7. 权限审计

### S-01 — AI 能否真实下单

**PASS / HARD DENY**

永远禁止。

### S-02 — AI 能否任意改数据库

**PASS / HARD DENY**

不暴露 raw SQL / raw database write / hard delete。

### S-03 — 研究权限是否自动暴露财务隐私

**PASS**

研究、资产、交易、现金流权限分开。

### S-04 — 正式写入是否需要用户确认

**PASS**

研究正式 Revision、资产正式账本、恢复数据库等操作都必须有 userApprovalRef。

---

## 8. JSON Schema 之外仍需程序校验的规则

有一类规则无法只靠简单 JSON Schema 完整表达，因此必须作为实现阶段的强制 validator，而不是让开发者自行决定。

包括：

1. 一个 IndustryResearchProfile 中必须 M0-M13 各出现且只出现一次；
2. Profile 的 industryId 与 14 个 Module 的 industryId 必须一致；
3. AssetImport Candidate.payload 必须根据 candidateType 再校验对应正式对象合同；
4. internal_transfer 的两条 CashFlow 必须正确配对；
5. DcaPlan 至少绑定 assetId 或 primaryCategory；
6. DCA 金额必须非负；
7. candidate / warning 资产数据不得进入正式绩效计算；
8. contribution.commit 必须原子执行；
9. restore.commit 前的 pre_restore 备份必须已验证成功。

这些规则已经写入 Registry / Invariants / Test Cases，因此实现时不是“可选建议”。

---

## 9. 第一阶段现在允许做什么

合同审计通过后，允许 Codex 实现以下基础能力：

### 可以进入实现

1. `contracts/` 自动校验脚本和测试；
2. 本地数据库最小 Schema；
3. Entity Registry / Resolver；
4. Industry Research Profile + 14 模块存储；
5. Markdown Conversation Archive；
6. Contribution prepare / plan / commit；
7. Asset Account / Asset / Transaction / CashFlow / Position；
8. DCA Plan / Execution；
9. Legacy 长期账户迁移 prepare / preview；
10. 每周 Asset Import prepare / preview / commit；
11. Audit Log；
12. Local Backup Manifest / Backup Service 骨架；
13. Restore prepare / commit 骨架。

### 暂时不能作为正式生产功能上线

1. XIRR / TWR / 年化收益正式值；
2. 自动真实交易；
3. 未完成 Probe 的网盘 Provider；
4. 未完成安全审计的公网 MCP 入口；
5. 未经过确认的长期账户正式迁移。

---

## 10. 最终结论

**PASS FOR PHASE 1 IMPLEMENTATION。**

这意味着我们已经从“产品讨论阶段”进入“可以开始搭地基”的阶段。

第一阶段实现必须以当前 `contracts/v1` 为唯一合同来源，不允许 Codex 自行创造另一套字段含义。

如果实现过程中发现合同无法表达真实场景，应先修改合同、重新审计，再修改业务代码；不得在业务代码里偷偷增加例外规则。
