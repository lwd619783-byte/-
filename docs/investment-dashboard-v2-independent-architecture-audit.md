# 投资研究看板 V2 独立架构审计

> 状态：INDEPENDENT DESIGN AUDIT  
> 日期：2026-09-05  
> 审计对象：
> - `docs/investment-dashboard-v2-research-os-and-bridge-design.md`
> - `docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`
> - 当前 `main` 产品与架构基线
>
> 审计结论：**CONDITIONAL PASS（方向通过，但存在必须在实现前修正的协议级问题）**

---

## 1. 总结结论

V2 的核心方向成立：

`Macro → Market Regime → Industry → Thesis → Instrument → Portfolio → Review`

并且建立独立 `Research Bridge + MCP Adapter` 的技术路线优于：

- ChatGPT 模拟浏览器点击；
- ChatGPT 直接写 Supabase；
- 把研究结果提交 Git；
- 让 Codex 作为研究内容中转站。

新增“网页端 ChatGPT 为主要研究推理入口”的需求后，原始设计仍然成立，但必须升级为 **Contribution Transaction Model**，否则无法真正实现“一次确认后，将同一段研究按业务逻辑拆到多个模块”。

新增“资产管理 / 每周定投 / 截图录入”需求后，Portfolio 不应继续被简单定义为 V1 READ ONLY；应改成：

- 真实交易执行：永远禁止；
- 个人资产账本：允许经用户确认写入；
- 截图 / 手工提取：candidate → preview → confirmed ledger write。

---

# 2. 审计等级

## PASS

设计正确，可直接保留。

## PASS WITH CHANGE

方向正确，但需要修改 contract。

## BLOCKER

如果不修改，不应进入代码实现。

---

# 3. 逐项审计

## A-01 — Product Repositioning

**结论：PASS**

将公司研究从主入口降级为行业与组合判断的验证层，是当前项目最重要的产品修正。

原因：

- 公司数据与验证基础设施已经明显成熟；
- 宏观与行业状态层明显薄弱；
- 新研究习惯更偏 top-down；
- 资产配置最终也需要宏观 / 行业而非公司页面作为入口。

无需反向恢复“公司详情为中心”的旧路线。

---

## A-02 — Research Bridge 与 MCP 分层

**结论：PASS**

`Research Bridge` 作为稳定业务 API，`MCP Adapter` 作为客户端协议适配层，是正确边界。

必须坚持：

- MCP 不直接访问数据库；
- MCP 不拥有 raw SQL；
- Dashboard 与 MCP 复用相同 Domain Service；
- 数据层使用 Repository Adapter；
- MCP 可替换，Domain Contract 不依赖某家 AI 客户端。

这一点不应在实现中简化掉。

---

## A-03 — 单一 `research_draft.create` 无法满足一键推送

**结论：BLOCKER**

原设计的 `research_draft.create` 只适合“创建一篇研究笔记”，不适合用户真实需求。

用户要的是：

> 一次 ChatGPT 研究成果，可以自动拆分到 Thesis、Evidence、Catalyst、Risk、Instrument、Task、Company Validation 等不同模块。

因此必须增加：

- `contribution.prepare`
- `contribution.get_plan`
- `contribution.commit`
- `contribution.cancel`

并以 **Contribution Plan** 作为确认对象。

不得让 ChatGPT 连续调用 6~10 个写工具后再分别确认。

---

## A-04 — 多模块写入必须原子化

**结论：BLOCKER**

如果一次研究推送产生：

- Thesis revision；
- 3 条 evidence；
- 2 条 risk；
- 1 个 task；
- 2 个 instrument mapping；

那么必须视为一个逻辑 Transaction。

不能出现：

- Thesis 写成功；
- Evidence 写了一半；
- Task 写失败；
- UI 却显示“导入完成”。

`contribution.commit` 必须支持：

- optimistic concurrency；
- transaction / compensation；
- plan digest；
- expected versions；
- idempotency；
- atomic result envelope。

---

## A-05 — 用户确认粒度应是业务 Plan，而不是 Tool

**结论：PASS WITH CHANGE**

原设计按工具等级定义确认是合理基础，但用户体验必须进一步抽象。

用户应看到：

```text
这次研究将：
- 新建 1 篇研究笔记
- 将焦煤 Thesis 从“中性”提议改为“看多”
- 新增 4 条证据
- 新增 2 条风险
- 新建 1 个跟踪任务
```

用户点击一次：**确认推送**。

服务器再执行内部多个 mutation。

用户不应理解 MCP Tool 数量，也不应逐条批准数据库动作。

---

## A-06 — 原始聊天不应成为核心数据库结构

**结论：PASS WITH CHANGE**

不能把聊天全文当作正式 Research Entity。

正式对象应该是结构化研究结果。

原聊天只作为 provenance：

- digest；
- turn ref；
- selected excerpt；
- full transcript（显式要求时）。

这可以避免：

- 数据库膨胀；
- 隐私边界模糊；
- 同一研究内容反复复制；
- 后续 UI 被聊天格式绑死。

---

## A-07 — AI 推理与 Provider Facts 隔离

**结论：PASS / MUST KEEP**

这是整个项目最重要的可信度规则之一。

必须继续禁止：

- AI 直接修改官方宏观值；
- AI 直接修改行情 / 财务 / 公告；
- AI 把网页推断直接 admission 为 Provider Fact；
- AI 修改 source / release time / revision metadata。

ChatGPT 可以生成：

- Evidence Candidate；
- Research Judgement；
- Thesis；
- Task。

Fact admission 仍由正式 Provider Contract 控制。

---

## A-08 — Entity Resolution 当前定义不足

**结论：BLOCKER**

一键推送前必须解决实体身份问题。

否则非常容易出现：

- “焦煤”与“炼焦煤”成为两个 Industry；
- 同一 ETF 因名称不同重复；
- A/H 同公司映射错误；
- Theme 与 Industry 混淆；
- 公司名称简称误识别。

实现 Bridge 写入前至少需要：

- Industry Registry；
- Theme Registry；
- Instrument Registry；
- Alias Registry；
- stable ID；
- exchange / ticker identity；
- candidate resolution workflow。

低置信度匹配必须 fail closed。

---

## A-09 — Industry 静态文本必须逐步迁出源码

**结论：PASS WITH CHANGE**

现有 `industries.ts` 中的静态：

- prosperity；
- stage；
- drivers；
- catalysts；
- risks；
- trend；

不能继续作为 V2 的长期“正式行业状态”。

这些内容应逐步迁移为：

- Thesis；
- Industry Snapshot；
- Evidence-backed Driver；
- Catalyst / Risk；
- revision history。

源码只保留 schema / default taxonomy / seed，不应承载不断变化的投资观点。

---

## A-10 — 当前 Macro Radar 不应进入 V2 正式决策台

**结论：BLOCKER FOR UI PROMOTION**

现有 fallback / 数据条数驱动的 radar score 不具备正式投资决策含义。

在 Stage 4.1 Market Regime Engine 通过 PIT / backtest / admission 前：

- 不得把旧 Radar 升格为首页核心信号；
- 应隐藏、降级为 demo，或明确显示 not admitted；
- 新首页只能引用正式 admitted regime。

---

# 4. Asset Management 独立审计

## B-01 — Asset Management 应进入一级 Domain

**结论：PASS**

资产管理不是普通附属功能。

它将研究闭环从：

`研究 → 观点`

扩展为：

`研究 → 观点 → 配置 → 实际执行记录 → 暴露 → 绩效 → 复盘`

因此“资产”应成为长期一级产品域。

---

## B-02 — Portfolio V1 完全只读已不符合需求

**结论：BLOCKER / REQUIRE POLICY CHANGE**

原设计 `Portfolio = READ ONLY` 是基于“防止 AI 交易”的安全考虑，但把两类写入混在了一起：

1. 写个人账本；
2. 执行真实交易。

它们风险完全不同。

新的正确边界：

### 允许经确认写入

- 已发生交易记录；
- 现金流；
- Position Snapshot；
- DCA execution；
- 手工修正记录；
- 目标配置 proposal。

### 永远禁止

- broker 下单；
- 自动买入；
- 自动卖出；
- 自动转账；
- 读取券商交易凭据。

---

## B-03 — 截图识别不得直接写账本

**结论：BLOCKER**

截图可能存在：

- 视觉识别错误；
- 标的简称歧义；
- 单价 / 金额小数点错误；
- 同一截图重复上传；
- 只看到持仓、看不到真实交易；
- 账户间转账被误判为新增资金。

必须采用：

`ChatGPT Parse → Candidate Import → Reconciliation Preview → User Confirm → Ledger Commit`

不得提供 `screenshot.parse_and_write` 一步工具。

---

## B-04 — Transaction 与 Position Snapshot 必须并存

**结论：PASS WITH CHANGE**

只记录“当前持仓”无法正确完成：

- 定投历史；
- 现金流；
- 成本；
- XIRR；
- TWR；
- 交易复盘。

只记录 Transaction 又可能无法及时纠正缺失 / 外部变动。

因此需要：

- Transaction Ledger 作为事件事实；
- Position Snapshot 作为状态事实；
- Reconciliation Event 连接两者。

---

## B-05 — 定投必须单独建模

**结论：PASS**

不能简单从交易流水反推全部 DCA 逻辑。

必须存在：

- DCA Plan；
- DCA Execution；
- plannedAmount；
- executedAmount；
- pendingAmount；
- rollover；
- exceptionReason。

否则无法表达：

- 限购；
- 最小交易单位；
- 本周没买成；
- 下周补回；
- 某类资产主动少投。

---

## B-06 — 年化收益必须定义计算口径

**结论：BLOCKER FOR PERFORMANCE UI**

不能只显示“收益率”三个字。

至少区分：

### Cost-basis P&L

回答当前账面赚 / 亏多少。

### XIRR / Money-weighted Return

考虑每次资金投入时间，回答投资者实际资金回报。

### TWR / Time-weighted Return

剥离资金进出影响，回答组合策略本身表现。

任何 Annualized 指标必须明确：

- 计算方法；
- inception date；
- measurement period；
- benchmark（若有）；
- 是否满一年。

---

## B-07 — Cash Flow 分类必须解决内部转账

**结论：BLOCKER**

例如：

银行卡 → 证券账户 1,150 元

如果以后再把证券账户 → 场外基金账户 100 元记录一次，系统不能把它算成总投入 1,250 元，除非真实外部净投入就是 1,250 元。

必须区分：

- external contribution；
- external withdrawal；
- internal transfer；
- dividend；
- fee；
- interest。

内部转账最好具备 paired transfer id。

---

## B-08 — 资产数据权限应独立于研究权限

**结论：PASS WITH CHANGE**

不能因为一个 ChatGPT Client 获得 `research.read` 就自动获得全部持仓数据。

建议独立 scopes：

- `assets.read`
- `transactions.read`
- `cashflow.read`
- `performance.read`
- `asset_import.prepare`
- `asset_import.commit`

Research 与 Asset 权限可由同一用户授权，但服务端必须独立检查。

---

# 5. Cross-domain 审计

## C-01 — Research × Portfolio 是 V2 的核心差异化能力

**结论：PASS / HIGH VALUE**

真正有价值的不是单独显示持仓饼图，而是让资产和研究互相驱动。

建议优先支持：

- 高景气但零持仓；
- Thesis 转弱但持仓仍高；
- 某行业研究优先级按真实仓位提升；
- 宏观因子暴露；
- 目标配置 vs 实际配置；
- 研究结论变化后的“需要复核持仓”，但不是自动交易。

---

## C-02 — 投资建议与真实资产事实必须分层

**结论：PASS / MUST KEEP**

例如：

> “建议未来增加黄金权重”

应写入 allocation proposal / research judgement。

只有用户实际买入后，才能进入：

- Transaction；
- Position；
- DCA execution。

不能把“计划买”显示成“已经买”。

---

## C-03 — Asset Classification 需要用户自定义层

**结论：PASS WITH CHANGE**

行情 Provider 的行业分类不足以支撑个人资产管理。

例如某资产可能需要被用户定义为：

- 黄金；
- 黄金股；
- 行业网格；
- 红利低波；
- 全球科技；
- 防御资产。

应建立：

`User Asset Classification / Strategy Bucket`

并与官方 instrument metadata 分离。

---

# 6. 工程与数据架构审计

## D-01 — 不应在现有 `App.tsx` 继续叠加 Bridge / Asset 状态

**结论：BLOCKER FOR IMPLEMENTATION STYLE**

V2 新增：

- Research Inbox；
- Contribution Plan Preview；
- Asset Dashboard；
- DCA；
- Performance；

如果全部继续塞进 `App.tsx`，会让现有架构问题恶化。

实现必须遵守：

```text
App Shell
  ├─ DecisionDeskFeature
  ├─ MacroFeature
  ├─ IndustryFeature
  ├─ ResearchWorkflowFeature
  └─ AssetFeature
        ↓
Domain Service / Store
        ↓
Repository / Bridge Client
```

不要求先做全仓重构，但新功能不能新增中央耦合。

---

## D-02 — Bridge 写入需要最小 Cloud Store

**结论：PASS**

当前 SPA / generated artifacts 架构不足以承接跨设备实时写入。

研究一键推送进入实现阶段前，必须先具备最小云端 store。

但不要求一次性把所有历史 Provider 数据迁移数据库。

正确做法：

- Provider Facts 可继续 generated artifacts；
- Research / Workflow / Asset Ledger 进入 Cloud Store；
- Bridge 通过统一 Repository 读取两者。

---

## D-03 — GitHub 不应作为研究数据库

**结论：PASS / MUST KEEP**

Git 用于：

- 代码；
- schema；
- contract；
- 文档；
- seed / generated immutable research artifacts（必要时）。

不用于：

- 每周定投写入；
- 高频 Research Note；
- 持仓快照；
- ChatGPT 日常同步。

---

## D-04 — Audit Log 与业务 revision 必须分开

**结论：PASS WITH CHANGE**

Thesis revision 不是 Audit Log。

Asset transaction 也不是 Audit Log。

需要同时保留：

1. Domain Event / Revision；
2. Bridge Audit Event。

这样既能看业务历史，也能回答“谁通过什么客户端调用了哪个工具”。

---

# 7. 建议的最终 Domain Map

```text
Shared Identity
├─ Industry Registry
├─ Theme Registry
├─ Instrument Registry
└─ Alias / Relationship

Research Intelligence
├─ Macro / Regime
├─ Industry Snapshot
├─ Thesis
├─ Evidence
├─ Catalyst / Risk / Invalidation
├─ Research Note
├─ Instrument Mapping
└─ Research Workflow

Asset Management
├─ Account
├─ Transaction
├─ Cash Flow
├─ Position Snapshot
├─ DCA Plan
├─ DCA Execution
├─ Allocation
└─ Performance

Cross Domain
├─ Exposure
├─ Research Priority
├─ Thesis × Position
└─ Review / Attribution

Platform
├─ Research Bridge API
├─ MCP Adapter
├─ Auth / Scope
├─ Audit
├─ Idempotency
└─ Version / Concurrency
```

---

# 8. 必须在编码前冻结的 Contract

以下项目未冻结前，不建议让 Codex 开始写 Bridge production code：

1. `ContributionBundle v1`；
2. `ContributionPlan v1`；
3. `contribution.prepare / commit`；
4. Entity Registry / Resolver；
5. Research / Asset Scope Matrix；
6. Asset Import Bundle；
7. Transaction / CashFlow / Position / DCA 模型；
8. XIRR / TWR 计算语义；
9. Bridge Audit Event；
10. conflict / idempotency / atomicity contract。

---

# 9. 推荐实施顺序

## Phase 1 — Product / Contract Freeze

只写：

- schema；
- ADR；
- contracts；
- examples；
- permission matrix；
- acceptance tests design。

不做 UI 大改。

## Phase 2 — Shared Identity + Minimal Cloud Store

先解决：

- entity identity；
- research writable store；
- auth / audit。

## Phase 3 — Read-only Research Bridge

先证明 ChatGPT 可以稳定读取：

- Regime；
- Industry；
- Thesis；
- Research Inbox。

## Phase 4 — Contribution Prepare / Preview / Commit

完成网页端 ChatGPT 一键推送最小闭环。

这是 Bridge 的第一价值里程碑。

## Phase 5 — Asset Ledger MVP

先支持：

- accounts；
- cash flows；
- transactions；
- position snapshots；
- DCA plan / execution。

## Phase 6 — Screenshot Import

完成：

`screenshot → ChatGPT → prepare → preview → confirm → ledger`

## Phase 7 — Asset UI + Performance

- total asset；
- allocation；
- monthly / annual contribution；
- DCA status；
- cost P&L；
- XIRR；
- TWR。

## Phase 8 — Research × Portfolio

最后连接：

- thesis exposure；
- research priority；
- target vs actual；
- position review。

---

# 10. 最终审计判定

## 可以冻结的方向

- Top-down V2；
- Research Bridge；
- MCP Adapter；
- Facts / AI Judgement 分离；
- append-only Thesis；
- no raw SQL；
- no trade execution；
- Cloud Store 只承接需要写入的业务状态；
- Asset Management 进入产品闭环。

## 编码前必须修正的 Blockers

1. `research_draft.create` 升级为 Contribution Transaction；
2. 多模块 commit 原子化；
3. Entity Resolver；
4. Portfolio 从“全只读”改为“账本可确认写、交易执行永禁”；
5. 截图录入必须 preview / reconcile；
6. Cash Flow / Internal Transfer 定义；
7. Performance 的 XIRR / TWR 口径；
8. 新功能不得继续堆进 App.tsx；
9. 未 admission 的旧 Macro Radar 不得进入 V2 决策层。

**审计结果：CONDITIONAL PASS。完成上述合同冻结后，可以进入实现阶段。**