# 投资研究看板 V2：Contract Freeze 决策、Local-first 架构与备份设计

> 状态：CONTRACT FREEZE DECISIONS / NO IMPLEMENTATION  
> 日期：2026-09-05  
> 适用分支：`docs/v2-research-os-and-bridge-design`  
> 上位文档：
> - `docs/investment-dashboard-v2-research-os-and-bridge-design.md`
> - `docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`
> - `docs/investment-dashboard-v2-independent-architecture-audit.md`
>
> 本文用于冻结 2026-09-05 交流后已经由用户明确确认的产品与架构决策，并明确覆盖此前文档中与“最小云端 Research Store”有关的假设。

---

## 1. 已冻结的用户决策

### D-01 — 14 模块行业研究框架：同意泛化

保留历史 14 模块框架作为 Industry Research Taxonomy，并对部分名称做 V2 泛化：

0. 研究边界与投资假设
1. 行业认知
2. 宏观政策与产业地位
3. 需求侧分析
4. 供给侧分析
5. 生产 / 技术路径与关键瓶颈
6. 生命周期与周期位置
7. 产业链结构与利润池
8. 竞争格局与护城河
9. 商业经济模型、财务与关键指标
10. 投资表达与标的映射
11. 估值、预期差与投资结论
12. 催化剂、风险与证伪条件
13. 持续跟踪计划

历史名称保留 alias，避免老报告失配。

### D-02 — 14 模块不是 14 个必填框

后台始终保留 14 个模块槽位，但每个模块支持：

- `deep`
- `standard`
- `light`
- `not_applicable`
- `empty`

前端规则：

- 有内容的模块正常显示；
- `empty` / `not_applicable` 默认收起；
- 用户可主动展开查看“尚未研究 / 不适用”状态；
- 不允许为了填满 14 模块而生成无意义文本。

### D-03 — ChatGPT 一键推送采用 A 模式

正式流程：

`ChatGPT 生成 Bundle → contribution.prepare → Contribution Plan → 用户确认 → contribution.commit → 正式 Research Revision`

用户已经看过业务层 Diff 并点击“确认推送”后，不要求再进入看板二次发布。

仍然保留：

- append-only revision；
- evidence refs；
- actor / sourceClient；
- userApprovalRef；
- expectedVersion；
- idempotency；
- conflict fail-closed。

### D-04 — Asset V1 只迁移当前长期账户

V1 只覆盖现有“长期价值账户”体系。

不纳入当前独立 A 股股票账户，原因是该账户后续大概率低频或无新增操作，且不属于当前长期定投体系。

Schema 仍按照“未来全资产”设计，避免后续重构。

### D-05 — Asset Ledger 历史从 2026-08-14 开始

2026-08-14 作为正式长期账户首个基准日。

历史更早数据：

- 不强制反推；
- 后续若获得可信记录，可通过 `historical_import` 补录；
- 不允许模型为追求完整性而猜测历史交易。

### D-06 — 研究对话全文保留为 Markdown 归档

每次用户确认推送研究结论时，除结构化 Contribution 外，允许保存当次研究对话全文为 `.md` 文件，作为 provenance / 复核档案。

规则：

- 结构化 Research Entity 仍是业务事实源；
- Markdown 全文只作为审计与复核材料；
- Markdown 不直接驱动 Market Regime / Industry Signal / Portfolio 计算；
- 文件必须带 `conversationId / contributionId / asOf / digest`；
- 对话文件与结构化实体建立引用关系；
- 允许未来导出、全文检索与重建上下文。

### D-07 — 资产分类采用“主分类 + 多标签 + 用户自定义排序”

每个资产至少包含：

- `primaryCategory`
- `strategyBucket?`
- `tags[]`
- `displayOrder`
- `userOverrides`

示例：

- 黄金 ETF：主分类 `纯黄金`；标签 `防御 / 通胀 / 实物资产代理`
- 黄金股 ETF：主分类 `行业网格`；标签 `黄金 / 资源 / 通胀`

用户可以自定义：

- 分类；
- 标签；
- 资产顺序；
- 首页展示顺序；
- 组合分组。

Provider Metadata 与 User Classification 必须分离。

### D-08 — 长期目标为“全资产视图”

V1 只导入长期价值账户，但数据模型必须支持未来：

- A 股 / 港股 / 海外证券账户；
- ETF / 基金；
- 实物黄金；
- 银行存款 / 现金；
- 工资与其他现金流；
- 保险；
- 虚拟货币；
- 其他大类资产。

因此 Account / Asset / Transaction / CashFlow 不得写死为证券账户模型。

---

# 2. 14 模块的正式 Contract 方向

## 2.1 Industry Research Module

建议对象：

```text
IndustryResearchModule
- industryId
- moduleId: M0..M13
- canonicalName
- historicalAliases[]
- depth: deep | standard | light | not_applicable | empty
- status: active | stale | needs_review | archived
- summary?
- thesisPoints[]
- evidenceRefs[]
- keyMetrics[]
- risks[]
- catalysts[]
- invalidationConditions[]
- updatedAt
- asOf
- revision
```

## 2.2 Industry-specific Extension

不同行业允许扩展专属 schema，例如：

```text
IndustryExtension
- extensionId
- industryId
- extensionType
- title
- payloadSchemaVersion
- payload
- evidenceRefs[]
```

示例：

- 焦煤：煤种、矿山安监、进口来源、港口库存、焦化开工、铁水；
- 创新药：靶点、临床分期、适应症、FDA/NMPA、BD、峰值销售；
- 航运：TCE、船龄、运力、订单簿、航线、绕航；
- 商业航天：发射频次、复飞、单位入轨成本、星座部署、付费用户。

14 模块是 taxonomy，不是硬编码业务字段集合。

---

# 3. Asset Domain：从既有 ChatGPT Library 迁移，而不是从零建账

## 3.1 既有可信来源

现有 Library 已包含：

- 《个人长期投资策略与每周定投再平衡纪律》；
- 《长期价值账户_周度跟踪与年报底稿》；
- 周度总览；
- 持仓明细；
- 资金与交易；
- 年度总结；
- 每周截图与用户确认记录。

这些应作为 Legacy Source，而不是废弃。

## 3.2 Migration 流程

```text
Legacy Files / ChatGPT Library
        ↓
legacy_asset_import.prepare
        ↓
Parse + Normalize
        ↓
Instrument Resolution
        ↓
Transaction / CashFlow / Position Reconciliation
        ↓
Migration Preview
        ↓
User Confirm
        ↓
legacy_asset_import.commit
        ↓
Local Asset Ledger
```

## 3.3 Constraint Revision

定投规则、基金限购、最小交易单位等不得写死在 Plan 上。

建议：

```text
PlanConstraintRevision
- planId
- constraintType
- value
- effectiveFrom
- effectiveTo?
- source
- evidenceRef
- revision
```

例如 006373 的日申购上限变化应形成 revision，而不是覆盖历史。

---

# 4. 架构重大修正：Local-first，不建设云端业务数据库

## 4.1 覆盖此前假设

此前文档中的：

> “真正的跨设备写入必须先有最小 Cloud Research Store”

以及：

> “Bridge 写入需要最小 Cloud Store”

从本文起被覆盖。

当前正式决策：

**项目长期采用 Local-first Database。**

原因：

- 单用户自用工具；
- 暂无商业化 / 多用户协作要求；
- 用户不计划把业务数据库迁移到云端；
- 本地数据主权与成本更符合当前场景；
- 未来商业化时再设计 Cloud / Multi-tenant。

## 4.2 推荐部署形态

```text
ChatGPT Web
    │
    │ MCP / Secure Tunnel（能力可用时）
    ▼
Research Bridge / MCP Adapter
    │
    ▼
Local Domain Service
    │
    ├─ Local Database
    ├─ Research Markdown Archive
    ├─ Generated Provider Artifacts
    ├─ Attachments / Screenshot Evidence
    └─ Audit Log

Local Backup Service
    │
    ├─ Local snapshot
    ├─ Cloud Backup Adapter A
    └─ Cloud Backup Adapter B
```

## 4.3 ChatGPT 不能直接访问 localhost

ChatGPT Web 不应被设计为直接调用 `localhost`。

连接方式必须经过受支持的远程入口 / Secure MCP Tunnel / 后续官方支持方式。

关键原则：

- Local DB 不公开端口；
- Research Bridge 不暴露 raw DB；
- Tunnel 只暴露 MCP / Domain tools；
- Auth / scope / confirmation 在本地服务端再次校验；
- 不将数据库文件上传给 ChatGPT 作为日常交互方式。

## 4.4 客户端能力不可作为产品单点依赖

OpenAI MCP / Custom App 的套餐与写入能力仍可能变化。

因此：

- Domain API 独立于 ChatGPT；
- MCP Adapter 可替换；
- 若当前 ChatGPT 套餐暂不支持完整写入，项目仍可先完成 Local Research Bridge + Preview / Export；
- 后续能力开放时只补 Adapter，不改 Domain Model。

---

# 5. 备份不是 MCP 主职责

## 5.1 决策

**不建设“Backup MCP”作为主备份执行器。**

建立：

`Local Backup Service + Backup Provider Adapters`

MCP 最多暴露：

- `backup.get_status`
- `backup.list_snapshots`
- `backup.verify_latest`
- `backup.prepare_restore`
- `backup.run_now`（可选、需确认）

不得让模型：

- 改 retention policy；
- 删除所有历史快照；
- 读取备份密钥；
- 直接选择覆盖当前数据库；
- 执行无预览 restore。

## 5.2 为什么备份不能依赖 ChatGPT

备份必须满足：

- 无人值守；
- 定时执行；
- ChatGPT 未登录仍运行；
- MCP 断线仍运行；
- API 供应商故障时自动切换；
- 可验证、可恢复；
- 凭据与模型隔离。

因此这是基础设施，不是推理任务。

---

# 6. 推荐 3-2-1 Backup Policy

目标：

- 至少 3 份副本；
- 至少 2 种介质 / 存储位置；
- 至少 1 份异地副本。

建议 V1：

### Copy A — Primary

本机正式 Local Database + Research Archive。

### Copy B — Local Snapshot

同机独立 backup 目录；更理想是额外移动硬盘 / NAS（以后可增加）。

### Copy C — Cloud Backup 1

115 / 百度 / 华为中的一个官方接口目标。

### Copy D — Cloud Backup 2

另一家独立供应商。

不建议只备份到同一家云盘。

---

# 7. 备份内容

每个 Backup Snapshot 至少包含：

```text
manifest.json
schema-version.json
database/
research-markdown/
attachments/
config-export/
audit-log/
checksums.sha256
```

Secrets 不进入普通备份包。

如确需备份密钥材料，应单独加密并采用独立保管策略。

---

# 8. 本地加密后再上传

资产、交易、收入、保险、虚拟货币等都属于高敏感个人财务数据。

因此：

**任何云备份均先在本地生成加密快照，再上传加密文件。**

云盘供应商不应看到可直接读取的数据库明文。

Backup Service 需要：

- authenticated encryption；
- 每个 snapshot checksum；
- snapshot manifest；
- restore verification；
- 密钥不进入 Git；
- 密钥不进入 MCP Tool 参数；
- 密钥不写日志。

具体加密实现到实现阶段再冻结，不在本设计阶段绑定单一软件。

---

# 9. Retention Policy

推荐个人项目初版：

- Hourly：最近 24 小时（如果数据库写入频繁再启用）；
- Daily：最近 14 天；
- Weekly：最近 12 周；
- Monthly：最近 24 个月；
- Yearly：长期保留。

数据库有重要 migration / 大批量导入前，额外创建 immutable checkpoint。

---

# 10. Backup Provider 适配建议（2026-09-05 调研结论）

## 10.1 115

官方存在 115 开放平台，可提供文件存储、上传、下载、移动、删除等开放接口。

适合作为 Backup Adapter 候选。

注意：2026-08 官方公告显示 API 开放平台正在进行服务调整维护，第三方 API 可能有稳定性波动，因此不应成为唯一备份目标。

建议状态：`SUPPORTED_CANDIDATE / SECONDARY ONLY UNTIL STABILITY VERIFIED`

## 10.2 百度网盘 / PCS

百度官方仍有 Personal Cloud Storage（PCS）开放接口体系，可用于个人云存储、同步与文件能力。

建议状态：`SUPPORTED_CANDIDATE`

实现前需实测当前开发者申请、OAuth、上传配额与文件大小限制。

## 10.3 华为云空间 / Drive

华为提供 Drive / 云空间 SDK 与相关数据管理接口，支持上传、下载、创建、更新、删除等能力；PC 云盘也支持同步文件夹。

建议状态：`SUPPORTED_CANDIDATE`

实现时需确认当前 Windows / Server 侧最合适的官方接入方式与账号授权流程。

## 10.4 夸克网盘

目前未找到可作为长期生产依赖的、面向个人网盘文件管理的明确官方公共 OpenAPI 文档。

网络上存在 Cookie / 私有接口封装与第三方 CLI，但不应作为个人财务数据库备份的正式基础设施。

建议状态：`MANUAL_OR_OFFICIAL_CLIENT_FALLBACK`

除非未来出现正式公开 API，否则不进入核心自动备份 Provider。

---

# 11. Backup Adapter Contract

```text
BackupProviderAdapter
- providerId
- capabilities
  - upload
  - download
  - list
  - checksum?
  - immutable/versioning?
- authenticate()
- upload(snapshot)
- verify(snapshot)
- listSnapshots()
- download(snapshotId)
- healthCheck()
```

Backup Core 不依赖某一家网盘。

Provider 异常不应影响本地数据库使用。

---

# 12. Backup Job 状态

```text
BackupJob
- jobId
- snapshotId
- startedAt
- finishedAt
- sourceDatabaseVersion
- manifestDigest
- encrypted
- targets[]
- targetResults[]
- status
- verificationStatus
- errorSummary
```

只有上传成功不等于备份成功。

必须至少完成：

- 文件存在；
- 大小合理；
- checksum / digest 可验证；
- manifest 完整；
- 定期恢复演练。

---

# 13. Restore 必须比 Backup 更严格

Restore 流程：

```text
backup.prepare_restore
    ↓
下载 / 校验 snapshot
    ↓
解密到 staging
    ↓
schema compatibility check
    ↓
生成 Restore Plan
    ↓
用户确认
    ↓
自动创建 restore-before checkpoint
    ↓
restore.commit
    ↓
post-restore validation
```

禁止：

`download → 覆盖 DB`

一步执行。

---

# 14. 全资产 Schema 预留

V1 AccountType 至少预留：

- brokerage
- fund
- bank
- cash
- physical_asset
- insurance
- crypto
- pension
- other

AssetType 至少预留：

- equity
- ETF
- mutual_fund
- bond
- cash
- deposit
- commodity
- physical_gold
- insurance_policy
- crypto
- other

注意：Insurance 不应简单等价成交易型资产，需要独立 Insurance Contract；本阶段只做类型预留。

---

# 15. 下一阶段 Contract Freeze 清单

在进入实现前，下一步需要形成机器可验证 contract：

1. `IndustryResearchModule.v1`
2. `IndustryExtension.v1`
3. `ContributionBundle.v1`
4. `ContributionPlan.v1`
5. `ContributionCommit.v1`
6. `LegacyAssetImportBundle.v1`
7. `Account.v1`
8. `Asset.v1`
9. `Transaction.v1`
10. `CashFlow.v1`
11. `PositionSnapshot.v1`
12. `DCAPlan.v1`
13. `DCAExecution.v1`
14. `PlanConstraintRevision.v1`
15. `UserAssetClassification.v1`
16. `BackupManifest.v1`
17. `BackupJob.v1`
18. `RestorePlan.v1`
19. `BridgeAuditEvent.v1`
20. OAuth / Scope Matrix

---

# 16. 当前冻结结论

截至 2026-09-05：

- 产品方向：冻结；
- 14 模块 taxonomy：冻结；
- 一键推送确认语义：冻结；
- Asset V1 范围：冻结；
- 历史基准日：冻结；
- Markdown 全文归档：冻结；
- 资产分类机制：冻结；
- 全资产长期 Schema 方向：冻结；
- Local-first 数据库方向：冻结；
- Backup 不作为 MCP 主执行器：冻结；
- 多 Provider 加密备份方向：冻结。

下一步进入 **Machine-readable Contract Design + Final Architecture Audit**，仍不进入业务功能实现。
