# 投资研究看板 V2：ChatGPT 研究入库与资产管理补充设计

> 状态：DESIGN ADDENDUM / NO IMPLEMENTATION  
> 日期：2026-09-05  
> 适用基线：`docs/investment-dashboard-v2-research-os-and-bridge-design.md`  
> 目的：补充“网页端 ChatGPT 作为主要研究与推理入口”以及“资产管理 / 定投 / 持仓展示”需求，并将其转化为 Research Bridge / MCP 的正式业务契约。

---

## 1. 新增产品定位

V2 不再只定义为“投资研究看板”。长期产品目标调整为：

**Personal Investment Research & Asset OS（个人投资研究与资产操作系统）**。

系统承担两类相互关联、但必须严格分层的数据：

1. **Research Intelligence**：宏观、行业、Thesis、证据、投资表达、研究任务、复盘；
2. **Asset Management**：账户、持仓、交易、资金流、定投计划与执行、资产配置、绩效。

两者通过 Instrument / Industry / Theme / Macro Exposure 等统一身份层连接，但不得混为同一事实表。

---

## 2. 网页端 ChatGPT 的角色

### 2.1 核心假设

用户将网页端 ChatGPT 作为主要的：

- 联网搜索入口；
- 深度推理入口；
- 行业研究入口；
- 宏观推演入口；
- 研究复盘入口；
- 截图 / 表格 / 文本资料的理解入口。

Codex / Coding Agent 主要承担：

- 编码；
- 测试；
- 仓库维护；
- 数据管道与自动化实现；
- 工具执行。

产品不能要求用户为了“把研究结果写回看板”再复制给 Codex 或人工重新录入。

### 2.2 目标体验

理想流程：

```text
用户与 ChatGPT 完成研究
        ↓
用户：“把这次结论推送到投研看板”
        ↓
ChatGPT 生成 Structured Contribution Bundle
        ↓
Research Bridge 生成 Contribution Plan
        ↓
向用户展示：将写入 / 更新哪些模块
        ↓
用户一次确认
        ↓
Atomic Commit
        ↓
Dashboard 多模块立即出现结构化结果
```

核心要求：**不是把聊天原文复制到某一个富文本框，而是按看板 Domain Model 拆分入库。**

---

## 3. Structured Contribution Bundle

ChatGPT 每次向看板提交研究时，应生成一个结构化贡献包，而不是自由文本写入。

建议 V1 字段：

```text
schemaVersion
contributionId
subjectType
subjectId / subjectCandidates
asOf
researchQuestion
executiveConclusion
stance
confidence
macroDrivers[]
industryDrivers[]
keyMetrics[]
thesisPoints[]
evidence[]
catalysts[]
risks[]
invalidationConditions[]
instrumentMappings[]
companyValidationPoints[]
openQuestions[]
followUpTasks[]
sourceRefs[]
sourceConversationRef? / sourceDigest?
authorType = ai
sourceClient
```

### 3.1 Bundle 只是输入，不是数据库实体

Bundle 是一次“研究贡献”的传输格式。

服务器收到后不能机械地整包存入单表，而应通过 Domain Mapper 拆分为：

- Research Note；
- Thesis Revision Proposal；
- Evidence；
- Industry Driver；
- Macro Driver Link；
- Catalyst；
- Risk / Invalidation；
- Instrument Mapping Proposal；
- Company Validation Task；
- Research Task。

### 3.2 不强制每次字段齐全

不同研究任务可能只产生其中一部分。

缺失字段必须保持 `missing / not_applicable` 语义，不得用模型猜测填满结构。

---

## 4. 两阶段写入：Prepare → Commit

原始设计中的单工具 `research_draft.create` 不足以覆盖“一次确认，多模块拆分”。V1 应增加 Contribution Transaction。

### 4.1 `contribution.prepare`

输入：Structured Contribution Bundle。

服务器执行：

1. schema validation；
2. entity resolution；
3. duplicate detection；
4. current version read；
5. domain routing；
6. conflict check；
7. write classification；
8. 生成 Contribution Plan。

返回示例：

```text
Plan #CP-20260905-001

CREATE  research_note        焦煤：供给收缩逻辑更新
APPEND  thesis_evidence      THESIS-COKING-COAL-001
PROPOSE thesis_revision      中性 → 看多
CREATE  catalyst             山西安监持续
CREATE  invalidation         进口煤显著放量
CREATE  workflow_task        跟踪港口库存
UPSERT? instrument_mapping   焦煤 ETF / 煤炭股表达
SKIP    macro_driver         已存在相同关系
```

`prepare` 不产生正式业务状态变更。

### 4.2 用户确认

客户端向用户显示：

- 新增什么；
- 修改什么；
- 哪些是 AI 草稿；
- 哪些会成为正式研究状态；
- 哪些发生冲突；
- 哪些被跳过；
- 关键字段 diff。

用户只需要对**整个 Plan 一次确认**，而不是逐个 Tool 点确认。

### 4.3 `contribution.commit`

输入至少包括：

```text
planId
planDigest
idempotencyKey
expectedVersions[]
userApprovalRef
```

服务器必须：

- 再次校验版本；
- 再次校验 scope；
- 原子提交；
- 任一关键 mutation 失败则整体回滚；
- 写 Bridge Audit Log；
- 返回每个目标实体的新版本。

### 4.4 为什么必须两阶段

这是“一键推送”同时满足可控性的关键：

- 一键 ≠ 无审核；
- 多模块写入 ≠ 多次人工确认；
- AI 不决定数据库最终结构；
- 用户看到的是业务层 Diff，而不是 SQL / JSON Diff。

---

## 5. 原始聊天内容如何保存

原则：**结构化结果是正式工作对象，聊天原文只是 provenance。**

推荐三档：

### Mode A — Digest only（默认）

只保存：

- conversation / turn reference（客户端可提供时）；
- hash / digest；
- research question；
- concise reasoning summary。

不复制整段聊天。

### Mode B — Selected excerpt

用户明确选择的关键原文作为 attachment / evidence 保存。

### Mode C — Full transcript archive

仅用户明确要求时保存完整聊天副本。

不得默认把所有 ChatGPT 对话全文同步至资产数据库。

---

## 6. Entity Resolution 是必需能力

ChatGPT 可能输出：

- 焦煤；
- 炼焦煤；
- coking coal；
- 煤炭；
- 山西焦煤；
- 煤炭 ETF。

服务器必须有统一 Resolver，避免生成重复实体。

至少需要：

- `industry_registry`；
- `theme_registry`；
- `instrument_registry`；
- alias；
- market / exchange / ticker identity；
- relationship type。

无法高置信匹配时：

- 返回 `needs_resolution`；
- 不自动创建正式实体；
- 可以创建临时 candidate。

---

# Part II — Asset Management

## 7. 为什么资产管理应进入 V2

研究系统最终需要回答的不只是“什么值得研究”，还包括：

- 我现在持有什么？
- 本周新增了多少资金？
- 本周买了什么？
- 某类资产实际占比是多少？
- 定投计划完成了多少？
- 哪些计划因限购 / 最小交易单位未执行？
- 待补金额是多少？
- 月度 / 年度净投入是多少？
- 实际收益来自市场涨跌还是新增资金？
- 当前组合与目标配置偏离多少？
- 某个宏观 / 行业观点对应多少真实资金暴露？

因此 Asset Management 不是附加小组件，而是 Research OS 的执行闭环。

---

## 8. Asset Domain 的事实层

### 8.1 Account

```text
accountId
accountType
broker / platform
currency
status
```

示例：证券账户、场外基金账户、现金账户。

### 8.2 Transaction

正式交易流水：

```text
transactionId
accountId
instrumentId
tradeDate
settleDate?
side
quantity
price
fees
amount
currency
source
sourceEvidenceRef
reconciliationStatus
```

### 8.3 Cash Flow

与证券盈亏分开的资金流：

```text
cashFlowId
accountId
date
type = contribution | withdrawal | dividend | interest | fee | transfer
amount
currency
```

内部账户之间的 transfer 必须能够配对，避免把转账误算成新增投入。

### 8.4 Position Snapshot

```text
snapshotDate
accountId
instrumentId
quantity
marketValue
costBasis?
unrealizedPnl?
source
```

Position Snapshot 不替代 Transaction Ledger；两者可用于 reconciliation。

### 8.5 DCA Plan

```text
planId
instrumentId / assetClassId
frequency
plannedAmount
constraints
priority
activeFrom
activeTo?
```

### 8.6 DCA Execution

```text
executionId
planId
period
plannedAmount
executedAmount
pendingAmount
transactions[]
status
exceptionReason
```

`pendingAmount` 应支持滚动到后续周期。

---

## 9. 截图录入工作流

用户可能直接把证券账户、基金账户或交易截图发给 ChatGPT。

ChatGPT 可以负责：

1. 视觉理解；
2. 提取账户 / 标的 / 数量 / 金额 / 交易；
3. 归一化；
4. 发现疑点；
5. 生成表格；
6. 发送结构化 Import Bundle。

但截图识别结果必须按 **candidate fact** 处理，不能无确认成为正式交易流水。

### 9.1 `asset_import.prepare`

输入：

- parsed transactions；
- parsed positions；
- cash flows；
- screenshot evidence refs；
- extraction confidence；
- asOf。

服务器：

- resolve instruments；
- detect duplicates；
- detect impossible values；
- compare previous position；
- reconcile cash movement；
- calculate expected position delta；
- return preview。

### 9.2 Preview 示例

```text
新增资金             +1,150 元
场外基金留存          100 元
证券账户净转入       +1,050 元

识别交易 5 笔：
PASS  红利低波 ETF    买入 ...
PASS  黄金 ETF        买入 ...
WARN  某 ETF          成交金额与截图合计差 2.14 元
SKIP  重复截图         已存在 transaction fingerprint

定投执行：
计划 1,250 元
已执行 1,150 元
本期未执行 100 元
滚动待补 100 元
```

### 9.3 `asset_import.commit`

必须经用户确认。

提交后生成：

- transactions；
- cash flows；
- DCA executions；
- position reconciliation event；
- audit event。

仍然不涉及任何真实交易执行。

---

## 10. Asset 权限重新定义

原基线将 Portfolio V1 设为 READ ONLY。根据实际使用需求，调整为：

### Read

- `assets.read`
- `transactions.read`
- `cashflow.read`
- `dca.read`
- `performance.read`

### Prepare（低风险，不改正式账本）

- `asset_import.prepare`
- `dca_execution.prepare`
- `allocation_proposal.create`

### Confirmed Ledger Write

- `asset_import.commit`
- `transaction.manual_create`
- `cashflow.manual_create`
- `dca_execution.commit`

这些操作都只能写**用户自己的记录系统**，且必须用户确认。

### 永不提供

- broker credential read；
- broker order create；
- `trade.execute`；
- 自动买入 / 卖出；
- 自动转账；
- 删除审计历史。

---

## 11. 资产展示模块

建议新增一级产品域：**资产 / Portfolio**。

首页至少展示：

### 11.1 总资产

- 总市值；
- 现金；
- 累计净投入；
- 累计盈亏；
- 当期盈亏。

### 11.2 资产配置

按统一分类查看：

- 黄金；
- 红利；
- 全球科技；
- A 股宽基；
- 港股；
- 行业网格；
- 现金；
- 其他。

分类规则必须支持项目自定义，不完全依赖行情供应商的行业标签。

### 11.3 定投

- 本周计划；
- 本周实际；
- 待补；
- 本月净投入；
- 年度累计投入；
- 各计划完成率；
- 限购 / 最小交易单位等执行异常。

### 11.4 绩效

至少同时提供：

1. **账面收益 / Cost-basis P&L**：最直观；
2. **Money-weighted Return / XIRR**：考虑每次定投现金流，回答“我的钱实际赚了多少”；
3. **Time-weighted Return / TWR**：剥离资金进出，回答“这套投资组合本身表现如何”。

不能只用：

`当前资产 / 累计投入 - 1`

作为“年化收益”。

未满一年时必须明确显示：

- since inception return；
- annualized since inception（若计算）；
- 样本期长度。

### 11.5 研究暴露

把研究和资产连接起来：

- 当前看多行业实际持仓权重；
- 高景气但零持仓行业；
- thesis 已转弱但仍有较高持仓；
- 单一宏观因子暴露；
- 组合与目标配置偏离。

---

## 12. 研究数据与资产事实的边界

### 研究侧可以产生

- “建议将黄金目标权重维持在 X%”的 proposal；
- “焦煤逻辑增强”的 thesis；
- “增加红利资产研究优先级”的 task。

### 研究侧不能伪造

- 已买入金额；
- 实际持仓；
- 实际成交价格；
- 真实账户余额。

### 资产侧事实来源

按可信度可分：

1. broker / fund API（未来）；
2. statement / exported file；
3. screenshot + user confirmation；
4. manual entry + user confirmation。

所有资产事实保留 `source` 与 `reconciliationStatus`。

---

## 13. V2 导航建议更新

产品开始具备资产域后，长期一级导航建议调整为：

1. **决策台** — What Changed / Market Regime / 当前优先研究；
2. **宏观** — Regime + Macro Metrics；
3. **行业 / 主题** — Industry State + Thesis；
4. **资产** — Holdings / DCA / Allocation / Performance；
5. **研究工作流** — Evidence / Watch / Verification / Tasks / History。

“标的库”可以成为跨域搜索入口，不必继续与宏观、行业并列占据最高层。

---

## 14. Research Bridge 工具集补充

### Research Contribution

- `contribution.prepare`
- `contribution.get_plan`
- `contribution.commit`
- `contribution.cancel`

### Asset

- `asset.get_summary`
- `asset.get_positions`
- `asset.get_transactions`
- `asset.get_cashflows`
- `asset.get_dca_status`
- `asset.get_performance`
- `asset_import.prepare`
- `asset_import.commit`
- `dca_execution.prepare`
- `dca_execution.commit`

### Cross-domain

- `exposure.get_by_industry`
- `exposure.get_by_thesis`
- `research.get_unowned_opportunities`
- `research.get_position_risks`

所有 cross-domain 输出均为分析结果，不执行交易。

---

## 15. 实施优先级调整建议

### Bridge Phase 0 — Contract only

- Contribution Bundle schema；
- Contribution Plan schema；
- Asset Import Bundle schema；
- scope matrix；
- entity resolver contract；
- audit contract。

### Bridge Phase 1 — Read-only

- 读取 Market Regime；
- 读取 Industry / Thesis；
- Research Context；
- 读取 Asset Summary（资产域上线后）。

### Bridge Phase 2 — Research one-click write

- `contribution.prepare`；
- preview；
- `contribution.commit`；
- AI draft / confirmed thesis write。

这是最符合用户核心价值的首个写入里程碑。

### Bridge Phase 3 — Asset screenshot ingestion

- screenshot → ChatGPT parse；
- asset import prepare；
- reconciliation preview；
- user confirmed commit；
- DCA execution roll-forward。

### Bridge Phase 4 — Research × Portfolio

- thesis exposure；
- target vs actual；
- research priority driven by holdings；
- performance / attribution。

---

## 16. Acceptance Criteria

Research Bridge V1 的“一键推送”只有满足以下条件才算完成：

1. 用户在 ChatGPT 完成研究后无需复制粘贴；
2. 一次 `prepare` 能给出跨模块 write plan；
3. 用户能读懂计划，而非阅读原始 JSON；
4. 一次确认可原子提交整份计划；
5. 不重复写入相同 evidence / task；
6. 不覆盖旧 Thesis history；
7. AI 内容和 Provider Facts 严格分层；
8. 所有写入可追溯到 contribution / actor / evidence；
9. 冲突时 fail closed；
10. 任何流程都不能触发真实证券交易。

Asset V1 只有满足以下条件才算完成：

1. 可记录多账户；
2. 可记录资金转入 / 转出与内部转账；
3. 可记录交易与 Position Snapshot；
4. 截图识别必须先 preview 后确认；
5. 可识别重复交易；
6. 可记录每期 DCA 的计划 / 实际 / 待补；
7. 待补可滚动；
8. 可计算净投入与账面盈亏；
9. 明确定义 XIRR 与 TWR；
10. 可把资产暴露映射回行业 / thesis。

---

## 17. 最终原则

V2 的终局不是“一个很多卡片的财经网站”，而是：

> **ChatGPT 负责高质量研究与理解，Research Bridge 负责把研究变成受控、结构化、可审计的业务状态，Dashboard 负责长期展示、跟踪、验证和资产闭环。**

任何新模块都应优先回答三个问题：

1. 它是否帮助发现重要变化？
2. 它是否帮助形成 / 验证投资判断？
3. 它是否能与真实资产决策和复盘形成闭环？

如果三者都不能回答，应谨慎新增。