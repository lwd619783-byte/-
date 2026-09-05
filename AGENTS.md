# 投资研究看板 Agent 开发约定

本文件是 Coding Agent 的**项目地图、永久不变量和文档路由器**，不是完整产品说明书。不要把所有 `docs/` 一次性载入上下文；先判断任务类型，再读取与任务直接相关的事实源。

## 1. 项目定位

长期产品方向是 **Personal Investment Research & Asset OS（个人投资研究与资产操作系统）**。

当前仓库同时包含已经运行的研究看板能力，以及已经冻结、按阶段进入实现的 V2 设计与合同，覆盖：研究工作流、Market Regime / PIT 数据体系、Provider 与数据治理、Research Bridge / MCP、资产 / Portfolio / DCA、Local-first 数据、备份恢复和机器可读合同。

**合同通过不等于所有 V2 功能都已实现，也不等于所有能力都已获得生产准入。** 任何任务只实现当前明确授权的范围。

## 2. 事实源与优先级

发生冲突时，不要靠猜测消解。按下面的语义判断来源：

1. 用户在当前任务中的明确目标、范围和最新决定。
2. 本文件中的跨任务永久不变量，以及已经冻结的权限 / 安全 / 数据合同。
3. 最新且明确覆盖旧决定的 V2 freeze / audit 文档。
4. 当前任务对应的 machine-readable contract 和领域设计文档。
5. 当前代码、测试、`docs/feature-registry.md` 与 `docs/architecture.md`，用于判断**实际已经实现什么**。
6. README 和历史 Stage / audit 文档，作为导航、背景或其基线时点的证据。

后出的、明确写明“覆盖 / supersede / freeze”的决定只覆盖其声明范围，不自动改写其他历史事实。

特别注意：早期 V2 文档中的 `NO IMPLEMENTATION` 是合同冻结前的阶段门禁；`docs/investment-dashboard-v2-final-contract-audit-v1.md` 已允许其中列明的 **Phase 1 implementation**。这不是全量 V2 开工授权；仍被 deferred / hard deny / 尚需单独 probe 或安全审计的能力继续保持原边界。

历史文档中的固定 `main @ <sha>` 是该文档的快照基线，不代表当前 `main`。

## 3. 按任务读取文档

### V2 Research OS / Research Bridge / ChatGPT ingestion

优先读取：
- `docs/investment-dashboard-v2-research-os-and-bridge-design.md`
- `docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`
- `docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md`
- `docs/investment-dashboard-v2-final-contract-audit-v1.md`
- `contracts/v1/README.md` 与本任务相关 schema / permissions

### Asset / Portfolio / DCA / 资产导入

优先读取 V2 asset addendum、contract freeze、final contract audit，以及：
- `contracts/v1/asset-import.v1.schema.json`
- `contracts/v1/ledger-invariants.v1.json`
- `contracts/v1/research-asset-os.contracts.v1.schema.json`
- `contracts/v1/contract-test-cases.v1.json`

### Contract / Schema / Permission

读取 `contracts/v1/README.md`、目标 schema、`permissions.v1.json`、`contract-test-cases.v1.json`、V2 machine-readable contract design 和 final contract audit。V1 发生不兼容变化时，默认新增版本，不直接破坏历史 V1 语义。

### Backup / Restore / Local-first

读取 contract freeze / local-first backup 设计、相关独立审计闭环、restore contract、backup manifest / permissions。恢复属于高风险写操作，必须遵守预检查、pre-restore backup 和用户确认边界。

### Market Regime / Macro / PIT

读取 `docs/market-regime/` 下与任务相关的 registry / source audit / backtest / observation 文档，以及 `config/market-regime/` 对应 schema。只有任务跨到 V2 Research OS 集成时，才继续加载 V2 总设计。

### Provider / Data Source

读取目标 Provider 文档、`src/data/data-source-registry.ts`、`docs/data-audit-v1.md`、Provider Stability / admission 文档和相关测试。不要因“代码存在”就推断 Provider 已获得生产准入。

### UI / Existing Feature

优先读取 `README.md`、`docs/architecture.md`、`docs/feature-registry.md`、目标 feature 文档、相关代码和测试。除非功能碰到合同边界，不必加载全部 V2 contracts / Provider 文档。

## 4. 永久不变量

### 数据真实性

- 不伪造缺失数据，不为了界面完整生成虚假事实。
- Real 模式不得用 mock 静默补真实字段；缺失不得无理由变成 `0`。
- `partial`、`stale`、`not_implemented`、`conflicted` 等状态必须按既有合同显式传播。
- Provider 事实、用户判断、AI 研究和派生结果必须保持来源区分与 provenance。

### Point-in-time / 时间语义

- 事后信息不得污染事前研究、历史回测或当时可得性判断。
- `observation`、`effective`、`publication`、`releaseAvailableAt` 等时间概念不得混用。
- provenance、source definition 和 revision history 不得靠猜测补齐。

### 历史与可审计性

- 不悄悄覆盖需要 revision / correction / append-only 的 Thesis、Evidence、Review、Ledger、Audit 或备份记录。
- 截图 / OCR / AI 推断得到的资产信息先是 candidate；正式记账必须经过合同要求的校验与确认。
- 已提交历史和审计结论不能为了让当前文档“看起来一致”而回写。

### 合同与权限

- `contracts/v1` 是 Phase 1 实现的合同边界；业务代码不得私自创造另一套字段语义。
- 如果真实场景无法由合同表达，先调整合同并重新审计，再改业务实现。
- 不暴露 raw SQL、万能数据库写入口或 hard delete 给 AI / Research Bridge。
- AI 不得执行真实交易。
- 正式研究 Revision、正式资产账本写入、恢复等需要合同规定的用户确认 / `userApprovalRef` 时，不得绕过。

### Local-first / Production admission

- 遵守已经冻结的 Local-first、备份和 Research Bridge 边界。
- `implemented`、`contract passed`、`tests passed` 与 `production admitted` 是不同状态。
- 未通过 Stability Gate / Provider Probe / 安全审计的能力不得被静默加入正式生产路径。

### 仓库安全

- 不提交 secret、token、credential、私钥、真实个人金融数据、非公开材料、本机绝对路径或无关生成产物。
- 不以降低 TypeScript、schema、测试、数据审计或权限约束的方式“修复”失败。

## 5. Agent 工作方式

- 采用 **outcome-first**：围绕任务目标、验收标准和不变量工作，自行定位最小实现路径。
- 不要求也不要默认按固定步骤机械执行；先理解现有代码和合同，再决定实现方案。
- 只加载与任务相关的文档，避免把历史路线图和所有专业文档同时塞入上下文。
- 不做任务外重构，不因为看到相邻问题就自动扩大产品范围。
- 如果两个权威来源存在无法安全判断的产品语义冲突，保留现状并在交付报告中指出，不自行发明折中规则。

## 6. Validation

验证按改动风险选择，而不是所有任务无差别跑全套：

- 纯文档：检查 diff、引用路径、Markdown 明显问题和 `git diff --check`。
- 普通代码：运行与改动直接相关的 lint / typecheck / tests；按影响范围决定是否 build。
- 依赖、安全、合同、数据模型或跨模块改动：扩大到对应专项门禁和回归测试。
- Provider 任务优先使用离线 fixture / validator；除非任务明确要求，不用实时网络访问代替可重复验证。
- 必要检查通过且没有新的风险信号后，不为“更彻底”反复扩大验证范围。

## 7. Git 与交付边界

默认开发流程：当前 `main` → 独立功能分支 → 实现与验证 → 普通 push → 远端独立审查 → 审查通过后才创建 PR / CI / 合并。

除非用户在当前任务明确授权：
- 不直接修改或合并 `main`；
- 不自行创建 PR；
- 不 force push、不重写已推送历史；
- 不删除或覆盖用户既有修改。

交付时报告实际改动、验证证据、commit / 远端状态、风险和未完成项。