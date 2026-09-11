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

- `docs/investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md`（当前战略路线与跨域架构入口）
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

按当前任务选择一个主要入口，只加载其 `SKILL.md` 和任务直接需要的引用；不机械加载所有 Skills、整个 Registry、全部 V2 docs 或所有 Provider 文档。

| 当前任务 | 入口 `.agents/skills/<name>/SKILL.md` |
| --- | --- |
| 重大 Dashboard UI 创建、redesign、响应式、视觉质量 | `investment-dashboard-ui-workflow`；重大现有页面 redesign 才按需 Taste `redesign-existing-projects`，由 UI workflow 判断需要后才进入 `investment-dashboard-impeccable-workflow` facade |
| 工程架构、source-grounded system map、跨模块数据流、Before / Delta / After | `archify` |
| 产业链、投资逻辑、宏观传导、商业模式、研究流程、报告图表 | `diagram-design` |
| Provider / PIT / Entity / Evidence / Research OS 领域语义 | `investment-dashboard-domain-workflow` |
| SQLite / migration / transaction / Audit / Repository 持久化底层 | `investment-dashboard-local-core-workflow` |
| 明确要求去重或最小安全实现 | `investment-dashboard-code-minimalism` |
| 小幅文案、spacing、孤立代码修改 | 不要求加载外部 Skill |

以交付物和实际改动层选择路由，不凭单个关键词叠加。工程图选 Archify，研究表达选 Diagram Design，默认不同时运行；纯持久化审计选 Local Core，只有领域合同也受影响才补 Domain。普通 coding task 不自动加载图表或 minimalism Skills。

Impeccable 原版只存于非 Skill 发现目录 `.agents/vendor/impeccable`；`.agents/skills/` 中的项目 facade 仅接受 UI workflow 对重大 UI 质量收尾的路由，普通 copy / spacing / 小 CSS 修改不能自行触发。不得恢复原版的 discoverable 入口。

外部 Skill 调用前只读取 `docs/agent-skills.md` 的对应使用边界。Archify / Impeccable 的 shell 命令通过 `scripts/run-codex-skill.mjs`，禁用更新检查与 telemetry；禁止直接启动 updater、自动下载 launcher、hooks、MCP 或 background service。Archify `examples` 会写回 managed copy，项目入口禁止执行。Diagram Design 使用包内默认样式，仅作用于输出图表；不执行 first-run / profile 的全局读写，不改变 PRODUCT / DESIGN 或 Dashboard 设计系统。

来源、immutable pin、安装、升级和审计统一登记于 `docs/agent-skills.md`。Skill 是 workflow，不是事实源；project hard invariants 与冻结合同优先于外部 Skill，当前任务明确指令优先于非 hard Skill 建议。Skill recommendation 不自动授权 dependency、framework、hook、MCP、外部服务或治理文件改动。

## 5. 项目方案与进展同步

每个正式开发切片都必须把“实现交付”和“CURRENT 文档同步”视为同一交付的一部分；具体矩阵见 `docs/investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md` §12。

- 完成实现与必要验证、准备普通 push 前，按实际影响同步 `docs/feature-registry.md` 与 `docs/development-execution-plan-2026-09-07.md`。
- 只有战略顺序、跨阶段依赖或 scope 改变时才更新当前战略 roadmap；只有真实 runtime / data flow / architecture boundary 改变时才更新 `docs/architecture.md`，避免为“看起来同步”机械改文档。
- 分支上可登记 `IMPLEMENTED / VERIFIED / PENDING REVIEW` 等已发生事实，但不得预写 `MERGED`、`MAIN CI PASS` 或 `PRODUCTION ADMITTED`。
- PR、merge SHA、main CI 与 admission 必须在事实发生并核验后再登记；历史审计记录不回写。
- 若合入后 CURRENT 文档仍缺少已知 merge / CI / capability 状态，下一次项目同步必须优先补齐，不得长期保留已知过期的 current 状态。

## 6. Git 边界

本项目默认开发流程：当前 `main` → 独立功能分支 → 实现与必要验证 → 普通 push → 基于远端真实差异进行独立审查 → 审查通过后才创建 PR / CI / 合并。

除非用户在当前任务明确授权：

- 不直接修改或合并 `main`；
- 不自行创建 PR；
- 不 force push，不重写已推送历史；
- 不删除或覆盖用户既有修改。
