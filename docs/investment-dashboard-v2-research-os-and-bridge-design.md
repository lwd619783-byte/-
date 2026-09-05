# 投资研究看板 V2：Top-down Research OS 与 Research Bridge / MCP V1 设计基线

> 状态：DESIGN BASELINE / NO IMPLEMENTATION  
> 基线：`main` @ `9a2c6364261ac4e305e06d8fac2eea2dbea1d0c5`  
> 日期：2026-09-05  
> 目的：将 2026-09-05 的完整产品审计、研究工作流调整与对外通信协议设计固化为后续开发、Codex 执行、独立审计和版本验收的统一决策基线。

---

## 1. 核心决策

### 1.1 产品主语调整

投资研究看板 V2 的研究主路径从：

`公司 / 个股 → 财务与公告 → 业绩预期 → ResearchEvent → 验证 → 复盘`

调整为：

`宏观环境 → Market Regime → 行业景气 → 投资逻辑 / Thesis → 投资表达（ETF / 指数 / 个股）→ 公司验证 → 持仓 / 组合 → 复盘`

公司研究不删除，而是从“主要研究入口”调整为：

1. 行业逻辑的微观验证层；
2. 投资表达选择层；
3. 业绩、公告、预期的事实核验层；
4. 持仓后的持续跟踪层。

### 1.2 开发资源调整

后续新增开发资源优先投入：

1. Market Regime / 牛熊温度计；
2. What Changed / Research Inbox；
3. Macro → Industry 传导；
4. Industry Metric Registry / Provider；
5. Industry Prosperity / Delta；
6. Research Thesis；
7. Investment Expression；
8. Portfolio Exposure。

暂缓继续扩张“公司详情丰富度”，除非某项行业研究或持仓验证明确需要。

### 1.3 Research Bridge 决策

项目建立一个独立的 **Research Bridge** 业务接口层，并在其上提供 **MCP Adapter**。

重要原则：

- MCP 不是数据库直连协议；
- ChatGPT / Agent 不获得数据库万能写权限；
- 所有读取与写入均通过受控 Domain Tool；
- Provider 事实数据与 AI / 用户研究判断严格分离；
- 低风险写入可以直接生成“AI 草稿”；
- 会改变正式研究状态的操作必须确认；
- 删除历史、篡改事实、修改权限、交易执行等操作禁止向 AI 暴露。

Research Bridge 是长期稳定的项目能力；MCP 只是其第一种客户端适配器。未来网站、移动端、Codex、其他 Agent 都可以复用同一业务接口，而不与某个模型或平台绑定。

---

## 2. 当前项目审计结论

### 2.1 当前成熟度明显“公司重、宏观行业轻”

当前已成熟的能力主要集中在：

- A 股财务 Provider；
- A 股公告 Provider；
- Company Guidance；
- Earnings Expectation Evidence；
- ResearchEvent；
- Earnings Verification；
- Watchlist Review；
- 数据真实性、时间语义与 Provider Stability。

这些能力应保留，不视为无价值冗余。

当前明显不足的是：

- 宏观指标正式 Metric Registry 与生产 Provider；
- 宏观变化检测；
- 宏观到行业的传导关系；
- 行业供需 / 库存 / 价格 / 产能 / 开工率 / CAPEX 等结构化指标；
- 行业历史变化、景气评分和 thesis 版本；
- 行业观点到 ETF / 指数 / 个股的表达映射；
- 研究结论到真实 Portfolio 的闭环。

### 2.2 当前 IndustryTab 的本质仍偏“分行业个股池”

行业页面虽然已有：

- 行业总览；
- 产业链；
- 细分板块；
- 需求来源；
- 供给格局；
- 竞争壁垒；
- 关键变量；

但上述大量内容仍为静态研究文本，缺少：

- `asOf`；
- source / evidence；
- observation date；
- release time；
- revision；
- historical series；
- delta；
- stale；
- 自动景气计算。

当前动态信息仍主要来自板块内公司的行情、财务更新时间和公司比较，因此 V2 必须把行业页升级为真正的行业状态研究台。

### 2.3 当前 MacroTab 存在“伪量化感”风险

现有宏观雷达分数不得作为正式 Market Regime 结果继续扩展。

正式 V2 中：

- 未通过历史 PIT 数据、Normalization、回测与版本 admission 的分数不得进入正式决策 UI；
- 当前 Stage 4.1 Market Regime 合同、Historical Observation Catalog 与回测路线继续保留；
- 旧的 fallback / 数据条数驱动分数应在正式 Engine 接管前下线或明确标为 demo。

### 2.4 历史专题不应继续形成产品特殊分支

机器人当前存在专用：

- `isRobotics` 分支；
- `RoboticsStockSection`；
- 核心池 / 观察池；
- 未上市公司区块。

这些研究能力本身有价值，但应逐步抽象为通用的 `Theme / Industry Research Template`，使焦煤、创新药、AI 算力、商业航天、地产更新等都能复用，而不继续新增行业特判。

### 2.5 工程层存在 App.tsx 过度集中

新增 V2 Feature 时不得继续把业务聚合堆入 `App.tsx`。

演进方向：

`App Shell → Feature/Page → Domain Service / Store → Repository / Provider`

不做一次性全仓大重构；每新增一个 V2 Feature 时同步完成所属域的渐进拆分。

---

## 3. V2 目标研究工作流

### 3.1 第一步：现在是什么环境？

Market Regime 至少覆盖：

- Growth；
- Inflation；
- Liquidity；
- Credit；
- Rates；
- USD / FX；
- Commodity；
- Fiscal / Policy；
- Property；
- Risk Appetite；
- Valuation / Leverage / Breadth（市场状态层）。

输出不是“堆指标”，而是：

- 当前状态；
- 变化方向；
- 置信度；
- 主要驱动；
- 反证条件；
- 上次变化时间。

### 3.2 第二步：What Changed？

Research Inbox 优先展示“变化”，而不是全部数据。

典型变化：

- 指标超出阈值；
- 趋势反转；
- 历史分位突破；
- 新数据相对前值明显变化；
- 政策 / 事件改变原 thesis；
- 行业关键变量改善 / 恶化；
- 数据质量变化。

Research Inbox 是 V2 的默认工作入口。

### 3.3 第三步：宏观变化传导到行业

新增 Macro Driver → Industry Exposure / Sensitivity 模型。

示例维度：

- 通胀；
- 利率；
- 信用；
- 美元；
- 油价；
- 财政；
- 地产；
- 出口；
- CAPEX；
- 风险偏好。

传导结果必须区分：

- 结构性关系；
- 当前周期方向；
- 证据强度；
- 是否已经反映在估值 / 交易拥挤度中。

### 3.4 第四步：行业二次验证

每个行业采用统一指标框架：

`需求 → 供给 → 库存 → 价格 → 利润 → 资本开支 → 政策 → 估值 → 市场交易状态`

允许行业缺少部分维度，但不得用公司涨跌替代行业基本面。

### 3.5 第五步：形成 Research Thesis

行业 Thesis 至少包含：

- thesis statement；
- bull / base / bear；
- 关键驱动；
- 已验证证据；
- 待验证证据；
- 反证条件；
- 催化剂；
- 风险；
- `asOf`；
- confidence；
- revision history；
- related macro drivers；
- related instruments。

### 3.6 第六步：选择投资表达

Investment Expression 不再默认等于股票。

统一支持：

- Index；
- ETF；
- Fund；
- A-share；
- HK-share；
- Commodity Proxy；
- Future Instrument（后续）。

对每个 thesis 显示：

- 最直接表达；
- 龙头；
- 高弹性；
- 防御性；
- 流动性；
- 估值；
- 与 thesis 的相关度；
- 特异性公司风险。

### 3.7 第七步：Portfolio 闭环

最终形成：

`Macro / Industry Thesis → Instrument → Position → Exposure → Review → Rebalance`

Portfolio 初期优先做“暴露”和“研究映射”，而不是先做复杂交易系统。

---

## 4. V2 一级导航建议

V2 默认导航建议调整为：

1. **今日变化 / Research Inbox**
2. **宏观与市场状态**
3. **行业雷达**
4. **研究工作流**
5. **标的库**
6. **组合**（Portfolio MVP 后出现）

### 4.1 Research Inbox

展示：

- 本周宏观变化；
- 行业景气升级 / 降级；
- Thesis 被验证 / 被反证；
- 新重大事件；
- 持仓相关高优先级变化；
- 待研究任务。

### 4.2 宏观与市场状态

内部包含：

- Market Regime；
- 牛熊温度；
- Macro Delta；
- 指标 Drill-down；
- 数据来源 / PIT / revision。

### 4.3 行业雷达

默认不是按行业静态浏览，而是按：

- 改善最快；
- 恶化最快；
- 高景气；
- 低估值；
- 宏观敏感；
- 当前持仓；
- 用户重点研究。

进行排序。

### 4.4 研究工作流

合并当前一级入口：

- 观察清单；
- 验证中心；
- 预期证据。

内部继续保留其成熟业务逻辑，但不再占三个独立一级入口。

### 4.5 标的库

原“个股池”升级为 `Instrument Library`。

公司详情继续保留，但由行业 / thesis / 持仓入口进入的比例应显著提高。

---

## 5. 明确保留、降级和抽象的模块

### 5.1 保留

- A 股 Financial Provider；
- A 股 Announcement Provider；
- Company Guidance；
- Earnings Expectation Evidence；
- ResearchEvent；
- Earnings Verification；
- Watchlist immutable review；
- Data Source Registry；
- Data Audit；
- Provider Stability Gate；
- PIT / provenance / fail-closed 原则。

### 5.2 降为二级 / 高级能力

- Company Guidance Provider 全局状态卡；
- Mock / Mixed / Real 切换；
- 数据缺失全局面板；
- 宏观原始字段全表；
- 公司级业绩预期 KPI 首页矩阵。

这些功能保留，但不占用默认研究决策空间。

### 5.3 抽象

- Robotics 专属核心池 / 观察池 → Theme / Industry Pool；
- Robotics 未上市公司 → Generic Private / Pre-IPO Entity；
- 行业静态 logic → Versioned Industry Thesis；
- 个股 Watchlist → Research Watchable Entity（后续支持行业 / thesis / instrument）。

---

## 6. Stage 路线重排

### Stage 4.1 — Market Regime Foundation（继续当前路线）

继续完成：

- PIT historical dataset；
- official source vintage；
- normalization；
- Candidate A–D backtest；
- formula admission；
- Market Regime Engine。

### Stage 4.1B — V2 Product Shell / Research Inbox

新增：

- V2 导航；
- What Changed 数据模型；
- Research Inbox；
- 移除旧宏观伪评分；
- App Shell 渐进拆分。

### Stage 4.2 — Industry Data Platform（由原 4.4 前移）

新增：

- Industry Metric Registry；
- Industry Provider contract；
- historical series；
- delta engine；
- Industry Prosperity；
- industry event。

### Stage 4.3 — Top-down Research Workflow

新增：

- Macro → Industry mapping；
- Industry Thesis；
- Thesis revision；
- Research Workflow 合并；
- Instrument / expression mapping。

### Stage 4.4 — Portfolio Exposure MVP

新增：

- Account / Portfolio / Position / Transaction 基础模型；
- thesis ↔ position；
- industry / macro exposure；
- target allocation；
- rebalance task。

### Stage 4.5 — Research Bridge / Cloud Write Path

建立：

- 最小云端 Research Store；
- Research Bridge API；
- OAuth / scope；
- Audit Log；
- MCP read adapter；
- AI draft write；
- confirmed write。

> 注：如果 Research Bridge 需要提前用于研究协作，可以将其“只读 + AI 草稿”子阶段提前到 Stage 4.2 / 4.3；不需要等待完整 Portfolio 或完整 Cloud Persistence。

### Stage 4.6+

- Full HK Research Chain；
- Research Copilot；
- Notification；
- Multi-device / multi-user；
- Advanced Valuation。

---

# Part II — Research Bridge / MCP V1

## 7. 为什么不是“让 ChatGPT 直接访问网页”

目标不是让模型通过浏览器抓网页并模拟点击，而是让项目暴露正式、可审计、结构化的业务能力。

推荐架构：

```text
ChatGPT / Codex / Other Agent
            │
            │ MCP / REST client
            ▼
      MCP Adapter (/mcp)
            │
            ▼
      Research Bridge API
            │
     ┌──────┴────────┐
     ▼               ▼
 Auth / Policy    Domain Services
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   Generated Data  Research DB  Audit Log
         │           │
         └─────┬─────┘
               ▼
          Dashboard UI
```

核心原则：

- Dashboard UI 与 MCP 使用相同 Domain Service；
- MCP 不直接操作前端组件；
- MCP 不直接执行任意 SQL；
- REST / Domain contract 是稳定核心；
- MCP Adapter 可替换、可升级、可停用。

---

## 8. 技术边界

### 8.1 部署形式

Research Bridge 应为远程 HTTPS 服务。

推荐：

- TypeScript / Node；
- 标准 HTTP / JSON；
- 可部署于 Vercel Functions、独立 Node 服务或未来自有服务器；
- 数据层使用 repository adapter，避免与 Supabase 强绑定；
- 初期可使用 PostgreSQL / Supabase 作为持久化实现；
- MCP Adapter 与核心业务层分离。

### 8.2 当前前端限制

当前项目主要为 Vite SPA，没有正式业务后端数据库。

因此：

- 只读 MCP 可直接读取已有 generated artifacts / domain service；
- 真正的跨设备写入必须先有最小 Cloud Research Store；
- 不应把写入结果提交到 Git 仓库作为日常投研数据库；
- GitHub 继续承担代码与版本设计，不承担高频研究状态存储。

---

## 9. 数据分层与写权限原则

### Tier F — Provider Facts（事实层）

包括：

- 官方宏观数据；
- 行情；
- 财务；
- 公告；
- Provider observation；
- 原始行业指标。

AI 权限：**READ ONLY**。

禁止：

- 直接改值；
- 补缺失值；
- 把推断写成事实；
- 修改 source / timestamp；
- 修改 checksum / manifest。

### Tier D — Derived Signals（系统推导层）

包括：

- Market Regime；
- Industry Prosperity；
- Delta；
- percentile；
- standardized signal。

AI 权限：**READ ONLY**。

模型可以提出“重新计算 / 建议变更公式”的草稿，但不能直接覆盖生产计算结果。

### Tier R — Research Judgement（研究判断层）

包括：

- Research Note；
- Thesis；
- Bull / Base / Bear；
- 反证条件；
- 行业观点；
- Instrument mapping；
- confidence。

AI 权限：允许 **CREATE DRAFT / APPEND DRAFT EVIDENCE**。

正式 publish / change stance 需要确认。

### Tier W — Workflow（工作流层）

包括：

- research task；
- watch item；
- review task；
- reminder；
- research inbox acknowledgement。

AI 权限：部分可直接创建，状态修改按风险分级。

### Tier P — Portfolio（组合层）

包括：

- positions；
- transactions；
- target allocation；
- rebalance。

V1：**READ ONLY**。

后续即使开放写入，也只允许生成 proposal，不允许自动交易。

### Tier A — Administration（管理层）

包括：

- 用户权限；
- MCP scopes；
- Provider Registry；
- production admission；
- secrets；
- API keys；
- schema migration；
- hard delete。

AI 权限：**NEVER EXPOSE**。

---

## 10. 默认权限 Scope

建议 OAuth scope：

### Read

- `research.read`
- `macro.read`
- `industry.read`
- `instrument.read`
- `workflow.read`
- `portfolio.read`（Portfolio 上线后）

### Low-risk Write

- `research.draft.write`
- `research.evidence.append`
- `workflow.task.create`

### Confirmed Write

- `research.publish`
- `research.thesis.update`
- `industry.stance.update`
- `watchlist.write`
- `workflow.state.write`

### 不提供给 ChatGPT 的 scope

- `provider.write`
- `admin.*`
- `auth.*`
- `secret.*`
- `schema.migrate`
- `portfolio.transaction.write`
- `trade.execute`

默认 ChatGPT 连接角色：`AI_RESEARCHER`。

`AI_RESEARCHER` 默认拥有所有 Read + Low-risk Write；Confirmed Write 必须经过用户确认，且服务器保留审计。

---

## 11. MCP V1 资源（Resources）

建议提供结构化资源 URI，而不是暴露文件系统：

- `dashboard://regime/latest`
- `dashboard://regime/history/{version}`
- `dashboard://macro/changes/latest`
- `dashboard://industries`
- `dashboard://industry/{industryId}`
- `dashboard://industry/{industryId}/metrics`
- `dashboard://industry/{industryId}/thesis`
- `dashboard://thesis/{thesisId}`
- `dashboard://instrument/{instrumentId}`
- `dashboard://workflow/inbox`
- `dashboard://portfolio/exposure`（后续）

Resources 主要用于读取上下文；写入统一通过 Tools。

---

## 12. MCP V1 Tools

### 12.1 读取工具

#### `research.search`

按关键词、行业、主题、标的、日期搜索已有研究。

#### `research.get_context`

一次返回某研究对象的最小完整上下文：

- macro drivers；
- industry snapshot；
- active thesis；
- latest changes；
- instruments；
- open tasks。

这是 ChatGPT 日常研究最重要的读取工具。

#### `macro.get_regime`

读取正式 Market Regime 版本与主要驱动。

#### `macro.get_changes`

读取指定时间窗口内的重要变化。

#### `industry.list`

列出行业及当前景气 / delta / confidence。

#### `industry.get_snapshot`

读取单行业当前完整状态。

#### `industry.get_metrics`

读取行业关键指标及历史。

#### `thesis.get`

读取 active thesis、revision history、证据与反证条件。

#### `instrument.list_for_thesis`

读取某 thesis 的 ETF / 指数 / 个股表达。

#### `workflow.get_inbox`

读取待研究 / 待复盘事项。

#### `portfolio.get_exposure`

后续读取真实持仓的行业 / 宏观暴露。

### 12.2 低风险写入工具

#### `research_draft.create`

创建 AI 研究草稿。

必须标记：

- `authorType = ai`；
- `status = draft`；
- `asOf`；
- confidence；
- evidenceRefs；
- reasoningSummary；
- createdAt。

#### `research_draft.append_evidence`

向草稿追加证据，不允许改写旧证据。

#### `workflow.create_task`

创建研究任务，例如：

- “跟踪焦煤港口库存”；
- “复核地产销售数据”；
- “等待公司中报验证”。

### 12.3 需要确认的写入工具

#### `thesis.propose_update`

生成 thesis diff，但不直接覆盖 active thesis。

#### `thesis.publish_revision`

发布正式 thesis revision。

要求：

- 用户确认；
- expectedVersion；
- append-only revision；
- evidenceRefs；
- changeReason。

#### `industry.update_stance`

修改“看多 / 中性 / 看空 / 观察”等正式状态。

必须确认。

#### `watchlist.propose_change`

可以直接产生 proposal；正式新增 / 归档 / 改优先级需要确认。

#### `workflow.set_state`

完成 / dismiss / snooze 任务属于可逆操作，可以确认后执行。

---

## 13. 严格禁止的 MCP Tool

V1 不得提供：

- `sql.execute`；
- `database.write_raw`；
- `database.delete_raw`；
- `provider.override`；
- `provider.publish`；
- `registry.update`；
- `auth.change_role`；
- `secret.read`；
- `secret.write`；
- `git.push_main`；
- `portfolio.add_transaction`；
- `trade.buy`；
- `trade.sell`；
- 任何任意 shell / URL fetch / file write 工具。

如果未来确实需要这些能力，应另建独立运维 / 开发连接器，不与 Research Bridge 混用。

---

## 14. 写入协议

### 14.1 所有写入必须具备

```text
schemaVersion
requestId
idempotencyKey
actor
actorType
asOf
createdAt
entityType
entityId
operation
expectedVersion (需要并发保护时)
content / patch
reason
evidenceRefs
confidence
sourceClient
```

### 14.2 Idempotency

同一 `idempotencyKey` 重试不得生成重复记录。

### 14.3 Optimistic Concurrency

正式 revision 必须携带 `expectedVersion`。

如果用户在网站中已经修改 thesis，而 ChatGPT 仍基于旧版本提交：

- server 返回 conflict；
- 不自动 merge；
- 重新读取后再生成新 proposal。

### 14.4 Append-only

以下对象默认 append-only：

- Thesis Revision；
- Evidence；
- Review History；
- Bridge Audit Event；
- Publication Event。

禁止“改掉过去让历史看起来正确”。

---

## 15. AI 内容与事实的强制隔离

任何由 ChatGPT / Agent 写入的内容必须带：

- `authorType = ai`；
- `modelProvider`（客户端可提供时）；
- `sourceClient`；
- `confidence`；
- `asOf`；
- `evidenceRefs`；
- `status = draft | published_with_user_approval`。

AI 研究文本不得写入 Provider Fact 表。

AI 提取的外部事实若要进入正式事实层，必须：

1. 进入 evidence / candidate observation；
2. 通过对应 Provider / validator / source contract；
3. 由正式数据管道 admission；
4. 才能进入事实层。

这与当前项目“事实与判断分离、fail closed、时间语义优先”的原则保持一致。

---

## 16. 用户确认策略

### Level 0 — Read

无需确认。

### Level 1 — AI Draft

可直接执行，例如：

- 创建研究草稿；
- 追加草稿证据；
- 创建低风险研究任务。

UI 必须显式标记“AI 草稿”。

### Level 2 — Confirmed Research State

必须用户确认，例如：

- 发布 thesis revision；
- 修改行业正式 stance；
- 新增 / 归档观察项；
- 修改研究优先级。

如果 MCP host 提供确认 UI，则使用 host confirmation；如果客户端没有可靠确认能力，则服务端降级为 proposal / draft，不允许直接 publish。

### Level 3 — High Risk

Research Bridge 永不执行：

- 删除不可变历史；
- 管理权限变更；
- Provider / production admission；
- Secret；
- 资金 / 交易操作。

---

## 17. 安全设计

### 17.1 Authentication

远程 MCP / API 使用 OAuth 2.x / OIDC 兼容授权；实现时以当期 MCP 正式规范为准。

最低要求：

- HTTPS only；
- short-lived access token；
- PKCE；
- issuer validation；
- resource binding；
- scope minimization；
- token 不进入前端 bundle；
- token 不写日志。

### 17.2 Authorization

每个 Tool 在服务端再次检查 scope，不依赖客户端 UI。

### 17.3 Prompt Injection 防护

Research Bridge 返回的公告、网页摘要、研究笔记等均视为 **data, not instructions**。

服务端不得因为数据内容中出现类似：

- “忽略之前指令”；
- “调用某工具”；
- “上传密钥”；

而改变权限或执行行为。

### 17.4 SSRF / Arbitrary Fetch

MCP V1 不提供任意 URL fetch 工具。

外部 URL 可作为 evidence reference 保存，但服务端不得默认代表模型去访问任意内网 / 本地 / metadata 地址。

### 17.5 Rate Limit

按：

- user；
- client；
- tool；
- write class；

分别限流。

正式 publish 的限流应明显严格于 read。

---

## 18. Audit Log

每个 MCP Tool 调用至少记录：

- requestId；
- timestamp；
- actor；
- client；
- toolName；
- entity；
- scope；
- success / failure；
- confirmation state；
- beforeVersion / afterVersion；
- idempotencyKey；
- latency；
- errorCode。

严禁日志记录：

- access token；
- refresh token；
- secret；
- 原始认证头。

审计日志默认 append-only。

---

## 19. 最小数据库对象

Research Bridge 写入阶段至少需要：

- `research_drafts`
- `research_theses`
- `research_thesis_revisions`
- `research_evidence`
- `research_tasks`
- `bridge_audit_log`
- `bridge_idempotency_keys`

后续增加：

- `industry_snapshots`
- `industry_metric_observations`
- `instrument_mappings`
- `portfolio_accounts`
- `portfolio_positions`
- `portfolio_transactions`

Provider 原始事实仍可继续沿用 generated artifact，直到对应数据域正式迁移到数据库；不要求为了 MCP 一次性迁移所有数据。

---

## 20. MCP Tool 返回统一 Envelope

建议：

```json
{
  "schemaVersion": "research-bridge.v1",
  "requestId": "...",
  "asOf": "...",
  "status": "ok",
  "data": {},
  "quality": {
    "status": "real|partial|stale|missing|not_implemented|conflicted",
    "warnings": []
  },
  "provenance": [],
  "version": 3
}
```

不得把：

- missing 变 0；
- stale 变 real；
- partial 变 complete；
- inference 变 fact。

---

## 21. ChatGPT 侧理想使用体验

### 场景 A：行业研究

用户：

> 帮我研究焦煤当前的投资逻辑。

ChatGPT：

1. `research.get_context(coking-coal)`；
2. 读取当前宏观驱动、行业 thesis、指标和历史研究；
3. 联网补充最新公开研究；
4. 给出结论；
5. 用户说“把这次结论记到看板”；
6. `research_draft.create`；
7. 看板立刻出现新的“AI 研究草稿”。

### 场景 B：更新正式 Thesis

用户：

> 我同意把焦煤从中性改为看多，把刚才的逻辑写进去。

流程：

1. `thesis.propose_update`；
2. 返回 diff；
3. 用户确认；
4. `thesis.publish_revision(expectedVersion=...)`；
5. 旧 thesis 不删除，新 revision 成为 active；
6. Research Inbox 生成 thesis-change event。

### 场景 C：反向读取

用户：

> 我现在看板里有哪些行业是高景气但还没有持仓？

ChatGPT：

1. `industry.list`；
2. `portfolio.get_exposure`；
3. 合并输出；
4. 必要时生成研究任务，而不是自动买入。

---

## 22. 客户端兼容性与 OpenAI 外部依赖

本协议必须设计为 client-agnostic，不依赖某个 ChatGPT 套餐或某一版 MCP host UI。

截至 2026-09-05，需要特别注意：

- OpenAI 的 custom app / MCP 能力仍在快速演进；
- 读取、写入、开发者模式、确认 UI 的可用性可能因套餐和 rollout 不同；
- 完整写入能力在部分 workspace plan 上开放程度更高；
- 因此项目不得把“ChatGPT 当前是否允许直接 write”作为 Research Bridge 核心业务逻辑。

如果某客户端当前只能 Read：

- 仍可使用全部读取 Tools；
- 写入退化为导出 proposal / draft payload；
- 待客户端支持 write 后无需修改 Domain Contract。

正式接入 ChatGPT 前必须重新核对当期 OpenAI 官方文档与 MCP 正式规范。

参考：

- OpenAI Developer Mode / MCP Apps 文档；
- Model Context Protocol 当前正式 Specification；
- OAuth / authorization 相关正式规范。

---

## 23. Research Bridge 实施分期

### Bridge R0 — Contract Only

- 本设计文档；
- JSON Schema；
- Tool Registry；
- Scope Matrix；
- Threat Model；
- offline contract tests。

**禁止部署写接口。**

### Bridge R1 — Read-only

实现：

- `research.get_context`；
- `macro.get_regime`；
- `macro.get_changes`；
- `industry.list`；
- `industry.get_snapshot`；
- `industry.get_metrics`；
- `thesis.get`；
- `workflow.get_inbox`。

R1 不改变生产数据。

### Bridge R2 — AI Draft Write

实现最小 Cloud Research Store：

- `research_draft.create`；
- `research_draft.append_evidence`；
- `workflow.create_task`；
- audit / idempotency。

AI 只能写草稿。

### Bridge R3 — Confirmed Research Write

实现：

- `thesis.propose_update`；
- `thesis.publish_revision`；
- `industry.update_stance`；
- `watchlist.propose_change`；
- optimistic concurrency；
- confirmation fallback。

### Bridge R4 — ChatGPT End-to-end Admission

要求：

- remote MCP endpoint；
- OAuth；
- scope tests；
- prompt-injection tests；
- unauthorized-write tests；
- duplicate-call tests；
- conflict tests；
- audit verification；
- production rate limit；
- independent security review。

通过后才将其作为正式 ChatGPT 研究入口。

---

## 24. Bridge V1 验收门槛

### Read Gate

- [ ] 所有 read Tool 不泄露 secret；
- [ ] missing / stale / partial 语义不丢失；
- [ ] provenance 可追踪；
- [ ] 不允许通过参数读取任意文件；
- [ ] 不允许通过参数执行任意 URL fetch；
- [ ] resource / entity 权限正确。

### Draft Write Gate

- [ ] AI 内容永不写入 Provider Fact；
- [ ] idempotency 生效；
- [ ] append-only evidence；
- [ ] audit 完整；
- [ ] draft 标签无法绕过。

### Publish Gate

- [ ] 用户确认机制存在；
- [ ] 无确认能力时 fail closed；
- [ ] expectedVersion conflict fail closed；
- [ ] old revision 保留；
- [ ] source / evidence / asOf 必填；
- [ ] rollback 通过新 revision 完成，不物理删除历史。

### Security Gate

- [ ] OAuth / token scope；
- [ ] token redaction；
- [ ] rate limit；
- [ ] SSRF 防护；
- [ ] prompt injection adversarial tests；
- [ ] admin / provider / trade tool 不存在。

---

## 25. 后续开发的强制顺序

1. 本文档独立审查；
2. 决策 V2 导航与 Stage 重排是否通过；
3. 决策 Research Bridge permission matrix 是否通过；
4. 仅在上述设计通过后创建 Bridge R0 contract 分支；
5. 先 Schema / Tool Registry / Threat Model；
6. 再 Read-only；
7. 再 AI Draft；
8. 最后 Confirmed Write；
9. Portfolio / Transaction 永不作为 V1 自动写目标。

不得从“直接做一个能写数据库的 MCP server”开始。

---

## 26. 最终目标

投资研究看板 V2 的目标不是更多页面，而是让每一次研究都形成统一闭环：

```text
宏观发生变化
      ↓
影响哪些行业
      ↓
行业数据是否验证
      ↓
Thesis 是否升级 / 降级
      ↓
用什么资产表达
      ↓
当前是否已有暴露
      ↓
后续需要验证什么
      ↓
事实变化再次进入 Research Inbox
```

Research Bridge 的作用是让 ChatGPT / Agent 成为这条链路中的正式研究参与者，但永远遵守：

**事实不可伪造、判断必须标注、历史不可擦除、正式状态需确认、权限最小化。**
