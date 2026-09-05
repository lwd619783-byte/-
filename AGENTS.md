# 投资研究看板项目级 AGENTS.md

本文件只定义本仓库的**项目级事实源、永久不变量、任务路由和 Git 边界**，不重复全局 Codex 协作偏好。只读取完成当前任务所需的最小上下文，不要一次性加载全部 `docs/`、Contracts 或 Skills。

## 1. 项目定位与事实源

长期产品方向是 **Personal Investment Research & Asset OS（个人投资研究与资产操作系统）**。

用户当前任务中的明确指令决定本次目标、范围和允许的副作用；本文件及冻结合同中的安全、权限、数据真实性、PIT、历史完整性等 hard invariants 继续约束普通实现任务。若任务本身要求修改某项治理或合同规则，先修改对应事实源并完成其要求的审计 / 版本流程，再让业务实现依赖新规则。

判断事实时按语义而不是机械文件顺序处理：

- 最新且明确声明 `freeze` / `supersede` 的决定，只在其声明范围内覆盖旧决定；
- 当前任务相关的 machine-readable contract 与领域设计决定具体业务语义；
- 当前代码、测试、`docs/feature-registry.md` 与 `docs/architecture.md` 用于判断实际已经实现什么；
- README、历史 Stage / audit 文档主要用于导航、背景或其基线时点的证据；其中固定的 `main @ <sha>` 仅代表历史快照。

早期 V2 文档中的 `NO IMPLEMENTATION` 属于合同冻结前的阶段门禁；`docs/investment-dashboard-v2-final-contract-audit-v1.md` 只授权其中明确列出的 Phase 1 implementation。`contract passed`、`tests passed`、`implemented` 与 `production admitted` 始终是不同状态。

## 2. 按任务寻找项目上下文

### V2 Research OS / Research Bridge / ChatGPT ingestion / Asset OS

从以下入口开始，只继续读取当前任务真正涉及的部分：

- `docs/investment-dashboard-v2-research-os-and-bridge-design.md`
- `docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`
- `docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md`
- `docs/investment-dashboard-v2-final-contract-audit-v1.md`
- `contracts/v1/README.md` 与相关 schema / permissions / test cases

### Contract / Schema / Permission

以 `contracts/v1/README.md` 和当前任务涉及的目标 contract、schema、permissions、test cases 为准。V1 发生不兼容变化时，默认新增版本，不直接破坏既有 V1 语义。

### Backup / Restore / Local-first

读取对应 freeze / local-first backup 设计、restore contract、backup manifest 与 permissions。Restore 是高风险写操作，必须保留预检查、pre-restore backup 和合同要求的用户确认。

### Market Regime / Macro / PIT

读取 `docs/market-regime/` 与 `config/market-regime/` 中直接相关的 registry、source audit、backtest、observation 和 schema；只有任务跨到 V2 Research OS 集成时，才继续加载 V2 总设计。

### Provider / Data Source

读取目标 Provider 文档、`src/data/data-source-registry.ts`、`docs/data-audit-v1.md`、对应 Stability / admission 文档和相关测试。代码存在不等于 Provider 已获得生产准入；验证优先使用可重复的 fixture / validator，而不是默认依赖实时网络。

### UI / Existing Feature

优先读取 `README.md`、`docs/architecture.md`、`docs/feature-registry.md`、目标 feature 文档、相关代码和测试。只有重大 UI 创建、重构、视觉升级、响应式或质量审计任务，再读取 `docs/agent-skills.md` 和 `.agents/skills/investment-dashboard-ui-workflow/SKILL.md`。

## 3. 永久不变量

### 数据真实性与 provenance

- 不伪造缺失数据，不为了界面完整生成虚假事实；Real 模式不得用 mock 静默补真实字段，缺失不得无理由变成 `0`。
- `partial`、`stale`、`not_implemented`、`conflicted` 等状态必须按既有合同传播。
- Provider 事实、用户判断、AI 研究和派生结果必须保持来源区分与 provenance。

### Point-in-time / 时间语义

- 事后信息不得污染事前研究、历史回测或当时可得性判断。
- `observation`、`effective`、`publication`、`releaseAvailableAt` 等时间概念不得混用。
- provenance、source definition 与 revision history 不得靠猜测补齐。

### 历史与可审计性

- 需要 revision / correction / append-only 的 Thesis、Evidence、Review、Ledger、Audit 或备份记录不得静默覆盖。
- 截图、OCR 或 AI 推断得到的资产信息先是 candidate；正式记账必须经过合同规定的校验与确认。
- 已提交历史和审计结论不能为了让当前文档“看起来一致”而回写。

### 合同、权限与 AI 边界

- `contracts/v1` 是当前 Phase 1 实现的合同边界；业务代码不得私自创造第二套字段或权限语义。
- 真实场景无法由合同表达时，先调整合同并重新审计，再改业务实现。
- 不向 AI / Research Bridge 暴露 raw SQL、万能数据库写入口或 hard delete；AI 不得执行真实交易。
- 正式研究 Revision、正式资产账本写入、Restore 等需要用户确认或 `userApprovalRef` 时，不得绕过。

### Local-first / Production admission / 仓库安全

- 遵守已冻结的 Local-first、备份和 Research Bridge 边界。
- 未通过 Stability Gate、Provider Probe 或安全审计的能力不得被静默加入正式生产路径。
- 不提交 secret、token、credential、私钥、真实个人金融数据、非公开材料、本机绝对路径或无关生成产物。
- 不通过降低 TypeScript、schema、测试、数据审计或权限要求来“修复”失败。

## 4. Skills

Repo-local Skills 位于 `.agents/skills/<skill-name>/SKILL.md`。详细的 Skill 来源、版本、安装、升级、触发条件和 UI 调用顺序统一以 `docs/agent-skills.md` 为准，不在本文件重复维护。

Skill 是专业工作流，不是项目事实源；不得绕过本文件 hard invariants、冻结合同或当前任务未授权改变的业务语义。重大 Dashboard UI 工作使用 `investment-dashboard-ui-workflow` 作为项目级协调入口。

## 5. Git 边界

本项目默认开发流程：当前 `main` → 独立功能分支 → 实现与必要验证 → 普通 push → 基于远端真实差异进行独立审查 → 审查通过后才创建 PR / CI / 合并。

除非用户在当前任务明确授权：

- 不直接修改或合并 `main`；
- 不自行创建 PR；
- 不 force push，不重写已推送历史；
- 不删除或覆盖用户既有修改。
