# 投资研究看板项目级 AGENTS.md

本文件定义本仓库作为 **Personal Investment Research & Asset OS（个人投资研究与资产操作系统）** 的 Agent 协作边界、事实源、任务路由和安全规则。

不重复用户全局协作偏好；不把聊天上下文、AI 草稿或历史文档自动视为正式事实。

## 1. 产品定位

本项目不是普通投资展示 Dashboard，而是面向个人投资决策的研究基础设施：

- Research Memory：承载长期研究认知与知识沉淀。
- Formal Decision System：承载可审计、可验证、需要长期追踪的正式投资状态。
- Agent Layer：负责研究编排、证据整理、任务执行和审计辅助。

Agent 的目标不是替用户做投资决策，而是帮助建立可追溯的研究、验证和决策流程。

## 2. 数据与事实层级

必须区分以下对象：

1. L0 原始资料
   - 公告、研报、财报、政策、数据文件等原始来源。
   - 不允许用 AI 摘要替代原件。

2. Research Context
   - 行业研究、公司研究、宏观分析、Creator 观点、AI 草稿。
   - 用于辅助理解，不自动成为正式投资结论。

3. Formal Decision State
   - Evidence、Verified Claim、Thesis、Investment Expression、Portfolio、Review、Audit。
   - 必须具备来源、时间语义、状态和审计链。

判断事实时：

- 当前任务明确要求优先于普通说明文档；
- 当前 contracts/schema/test 是业务语义来源；
- 当前代码和测试证明实际实现状态；
- 历史文档只能作为背景，不代表当前能力。

## 3. Research OS 核心不变量

### 数据真实性

- 不生成不存在的数据。
- Real 数据模式不得使用 mock 静默填充真实字段。
- 缺失、过期、冲突状态必须显式传播。
- Provider、用户观点、AI 推理必须保持来源区分。

### 时间语义（PIT）

- 不允许未来信息污染历史研究。
- observation、effective、publication、releaseAvailableAt 等时间必须严格区分。
- 不通过推测补齐 provenance。

### 审计与历史

- Evidence、Claim、Thesis、Review、Ledger、Audit 默认不可静默覆盖。
- Revision 必须保留历史。
- AI OCR、截图识别、推断结果只能作为 candidate，不能直接进入正式资产状态。

### AI 边界

- AI 不执行真实交易。
- AI 不绕过权限写入正式决策状态。
- 不暴露 raw SQL、万能数据库写入口或敏感数据。
- 需要用户确认的写操作必须保留 approval 流程。

## 4. Agent 工作方式

执行任务时遵循：

1. 先识别任务类型：
   - 研究任务
   - 数据任务
   - 工程任务
   - 审计任务
   - UI任务

2. 只读取当前任务需要的最小上下文。

3. 优先复用已有实现，不创建平行系统。

4. 输出必须区分：
   - 已验证事实
   - 推断
   - 假设
   - 待确认事项

5. 完成工程修改后必须说明：
   - 修改范围
   - 验证方式
   - 未解决问题
   - 是否需要人工确认

## 5. Research OS 晋升边界

默认流程：

L0 原始资料 → Research Memory → Delta Research → 必要时进入 Formal Decision System

规则：

- 普通行业研究默认停留在 Research Memory。
- 只有满足以下条件才进入正式系统：
  - 改变正式 Verified Claim；
  - 影响 Thesis；
  - 需要正式计算；
  - 影响 Portfolio / Exposure / Target / Review；
  - 需要长期证伪跟踪。

不能因为“AI认为重要”自动升级。

AI-generated analysis is research context only. It cannot become Verified Claim, Thesis, Investment Expression, Portfolio state or other Formal Decision State without explicit promotion workflow and required evidence.

## 6. 工程与 Git 边界

默认流程：

main → 功能分支 → 实现 → 验证 → push → 独立审查 → PR / merge

除非用户明确授权：

- 不直接修改 main；
- 不自动创建 PR；
- 不 merge；
- 不 force push；
- 不覆盖用户修改。

报告中必须区分：

- implemented
- verified
- merged
- deployed
- production admitted

这些状态不能混用。

## 7. 当前阶段重点

后续 Agent 工作优先围绕：

- Research OS 与 Research Bridge；
- Notion / Markdown / Obsidian 兼容研究资料流；
- Evidence → Claim → Thesis → Expression 的正式链路；
- Provider、PIT、Audit、权限和数据真实性；
- AI Agent 协作但不削弱人工最终审核。

任何新增功能都必须先回答：

1. 它属于 Research Memory 还是 Formal Decision System？
2. 它是否需要正式合同/schema？
3. 它是否影响审计链？
4. 它是否引入新的权限或数据风险？

只有回答清楚后，才进入实现。