# 投资研究看板 V2：Local-first 决策后的独立审计闭环

> 状态：INDEPENDENT AUDIT CLOSURE  
> 日期：2026-09-05  
> 审计对象：
> - `docs/investment-dashboard-v2-research-os-and-bridge-design.md`
> - `docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`
> - `docs/investment-dashboard-v2-independent-architecture-audit.md`
> - `docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md`
>
> 审计结论：**PASS FOR CONTRACT DESIGN / NO IMPLEMENTATION ADMISSION YET**

---

## 1. 结论

此前独立审计为 `CONDITIONAL PASS`，主要 Blocker 包括：

- 一键推送缺少 Contribution Transaction；
- 多模块写入缺少原子提交；
- Entity Resolution 未冻结；
- Asset Ledger 与真实交易权限边界不清；
- 截图识别可能直接污染账本；
- XIRR / TWR 口径未定义；
- Cloud Store 被误认为 MCP 写入的必要前提。

在本轮用户确认后，产品级决策已经足够清晰，可以进入机器可读 Contract 设计。

但仍不允许直接进入 Production 实现。

---

## 2. 本轮已关闭的问题

### C-01 — 14 模块是否过度模板化

**状态：CLOSED / PASS**

采用统一 taxonomy + 模块深度 + 行业专属 extension。

这解决：

- 不同行业不适用同样研究深度；
- 仍能保持研究完整性检查；
- 不需要为每个行业写独立页面特判。

### C-02 — 无内容模块如何展示

**状态：CLOSED / PASS**

后台保留，前端默认收起，不删除 schema slot。

### C-03 — 一键推送后是否需要二次发布

**状态：CLOSED / PASS**

用户选择 A：Contribution Plan 已展示正式业务 Diff 后，用户一次确认即可形成正式 Research Revision。

要求继续保留 audit / revision / conflict / idempotency。

### C-04 — Asset V1 范围

**状态：CLOSED / PASS**

V1 只覆盖长期价值账户；Schema 按全资产预留。

独立股票账户暂不迁移，不构成数据缺失。

### C-05 — 资产历史基线

**状态：CLOSED / PASS**

2026-08-14 作为正式基准；更早历史仅在存在可信证据时补录。

### C-06 — 原始聊天全文是否保存

**状态：CLOSED / PASS WITH GUARDRAIL**

允许保存 Markdown 全文，作为 provenance / audit archive。

必须坚持：

- Markdown 不是正式 structured fact store；
- 业务页面依赖 structured entity；
- Markdown 与 Contribution 通过 stable ID 关联；
- 不从历史 Markdown 自动覆写正式研究状态。

### C-07 — Asset 分类

**状态：CLOSED / PASS**

采用：主分类 + 多标签 + 用户覆盖 + 自定义顺序。

### C-08 — 长期资产范围

**状态：CLOSED / PASS**

长期目标明确为全资产视图，支持未来现金、存款、实物黄金、保险、虚拟货币及其他大类资产。

---

## 3. 对 Cloud Store 假设的重新审计

### 3.1 结论

**原 Cloud Store 前置假设被撤销，Local-first 更适合当前用户场景。**

当前项目：

- 单用户；
- 私人工具；
- 无多租户；
- 无商业化即时需求；
- 已存在本地数据库路线；
- 用户明确不计划当前上云。

因此为了 MCP 而迁移云数据库属于过度设计。

### 3.2 MCP 与 Local DB 并不冲突

ChatGPT Web 不能直接连接 localhost，但这不意味着数据库必须在云端。

正确分层：

```text
Remote MCP Client
      ↓
Secure Tunnel / Remote Entry
      ↓
Local Research Bridge
      ↓
Local Domain Service
      ↓
Local DB
```

只有协议入口需要满足 ChatGPT 连接要求，数据持久化仍可在本地。

### 3.3 风险

Local-first 把主要风险从：

- 云成本；
- 云权限；
- 多租户安全；

转移为：

- 本机损坏；
- 用户误删；
- 勒索软件；
- 数据库损坏；
- 设备遗失；
- 备份不可恢复。

因此 Backup / Restore 从“可选运维功能”升级为 V2 基础架构能力。

---

## 4. Backup 独立审计

### B-01 — 是否应该专门做 Backup MCP

**结论：NO / MUST NOT BE PRIMARY EXECUTOR**

原因：

- MCP 依赖客户端可用性；
- Backup 必须无人值守；
- 模型不是确定性调度器；
- 密钥不应进入模型工具上下文；
- 备份不能因 ChatGPT 套餐 / rollout / 网络状态中断。

正确形态：

`Local Backup Service + Provider Adapters`

MCP 仅作为状态与人工控制入口。

### B-02 — 是否需要多云

**结论：YES / PASS**

至少两个独立云目标，不能把“上传成功”视为容灾。

### B-03 — 上传前是否加密

**结论：MUST**

未来数据库包含：

- 持仓；
- 交易；
- 工资 / 现金流；
- 保险；
- 虚拟货币；

属于高度敏感个人财务数据。

必须本地加密后上传。

### B-04 — Restore 是否需要独立 Contract

**结论：MUST**

没有验证恢复流程的备份不能算完成容灾设计。

---

## 5. 网盘 Provider 审计

### 115

**结论：候选，但不能单点依赖。**

官方开放平台能力存在，但 2026-08 官方公告显示第三方 API 平台处于维护调整期。

因此可以实现 Adapter，但上线前必须 health test。

### 百度 PCS

**结论：候选。**

官方 Personal Cloud Storage 接口体系适合文件备份，但需实现前做开发者准入与限额实测。

### 华为 Drive / 云空间

**结论：候选。**

官方能力和 SDK 存在，PC 云盘也有同步能力；可作为第二/第三目标。

### 夸克

**结论：当前不建议作为核心自动备份 Provider。**

未找到足够明确的官方个人网盘 OpenAPI 作为长期依赖；网络上的 Cookie / 私有 API 封装不适合作为财务数据容灾底座。

可作为人工/客户端额外副本，但不进入 V1 核心 adapter。

---

## 6. ChatGPT / MCP 外部依赖审计

截至 2026-09-05，OpenAI 官方文档明确：

- ChatGPT 不能直接连接本地 MCP Server；
- 本地 / 私网 Server 需要 Secure MCP Tunnel 或受支持的远程连接方案；
- 完整 MCP 写入能力仍受套餐与 rollout 影响；
- Deep Research 对 custom app 仍主要是 read/fetch。

因此：

**本项目绝不能把某个 ChatGPT 套餐当前是否支持 full write MCP 当成核心架构前提。**

Domain Contract 必须可独立测试，并支持：

- MCP；
- REST；
- 本地 CLI；
- Dashboard 自身调用；
- 后续其他 Agent。

---

## 7. 仍未关闭、但已从“产品 Blocker”转为“Contract Design Work”的事项

以下不再需要用户重新做产品方向确认，但必须在下一阶段正式写 contract：

1. Entity Registry / Resolver 具体 stable ID 规则；
2. Contribution Bundle schema；
3. Contribution Plan Diff schema；
4. Atomic Commit transaction boundary；
5. Markdown Archive manifest；
6. Legacy Asset Migration schema；
7. Account / Asset 全资产 schema；
8. Insurance 独立对象边界；
9. Crypto transaction / wallet 是否在 V1 只预留；
10. Backup Manifest；
11. Backup encryption implementation；
12. Restore compatibility / migration policy；
13. Provider Adapter interface；
14. OAuth / MCP Scope Matrix；
15. Local DB engine 选择与 transactional guarantees。

---

## 8. Final Admission Gate

进入 Codex 业务实现前必须同时满足：

- machine-readable schemas committed；
- schema tests；
- conflict tests；
- duplicate tests；
- low-confidence entity resolution tests；
- asset import reconciliation tests；
- internal transfer tests；
- XIRR / TWR semantic tests；
- backup manifest tests；
- encrypted snapshot test；
- restore dry-run test；
- local DB crash / partial-write strategy documented；
- MCP capability fallback documented。

满足以上门禁后才能把状态从：

`PASS FOR CONTRACT DESIGN`

升级为：

`ADMITTED FOR IMPLEMENTATION`

---

## 9. 本轮审计最终结论

**PASS FOR CONTRACT DESIGN / NO IMPLEMENTATION ADMISSION YET**

当前无需继续进行产品方向头脑风暴才能前进。

下一阶段应集中完成：

1. 14 模块 machine-readable research contract；
2. Contribution Transaction contract；
3. Legacy Asset Migration contract；
4. 全资产基础 schema；
5. Local Backup / Restore contract；
6. Entity Registry；
7. Scope / Permission Matrix。

完成后再进行一次终局式 Contract Audit。
