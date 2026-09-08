# 投资研究看板

面向 A 股 / 港股的个人投资研究系统。项目已经从早期 Mock Dashboard 演进为包含真实数据 Provider、证据工作流、研究事件、复盘任务、时间语义和数据治理的研究工作台；长期产品方向为：

**Personal Investment Research & Asset OS（个人投资研究与资产操作系统）**。

目标研究闭环：

`宏观 / Market Regime → 行业 → Thesis → 个股验证 → 真实数据与证据 → 投资表达 → Portfolio / DCA → 事件验证 → 复盘`

> Coding Agent 项目入口：[`AGENTS.md`](AGENTS.md)。Skill 路由、注册与固定版本：[`docs/agent-skills.md`](docs/agent-skills.md)。
> README 只做稳定导航；当前实现以代码、测试和 [`docs/feature-registry.md`](docs/feature-registry.md) 为准。

## 当前阶段

仓库同时包含：

1. **已经实现的研究看板与数据治理能力**：行情、财务 / 公告 Provider、预期证据、ResearchEvent、Watchlist Review、Provider Stability、Market Regime / PIT 基础等；
2. **已经冻结的 V2 Research & Asset OS 设计与合同**：Research Bridge / MCP、ChatGPT 研究入库、行业研究 taxonomy、资产 / Portfolio / DCA、Local-first、备份恢复和机器可读合同；
3. **Phase 1B 已实现的 Node-only Local Core**：单用户 Local-first SQLite、Entity Registry / Resolver、append-only Audit、Account / Asset ledger、Transaction / CashFlow / PositionSnapshot、DCA revisions / executions，以及受确认、幂等和证据约束的导入核心。

2026-09-05 V2 合同终局审计为 **PASS FOR PHASE 1 IMPLEMENTATION**。它只授权审计中明确列出的第一阶段实现范围，不表示所有 V2 功能已经实现或获得 Production Admission。

Phase 1B 已通过 [PR #24](https://github.com/lwd619783-byte/-/pull/24) 合入并通过 main CI。该关闭状态只覆盖 Local Core，不表示 Portfolio Exposure / UI、Research Bridge、cloud business database、可信来源 adapter、OCR 或真实账户迁移已经实现。

## Source of Truth

### V2 产品与架构决策

- [`docs/investment-dashboard-v2-research-os-and-bridge-design.md`](docs/investment-dashboard-v2-research-os-and-bridge-design.md)：Research OS 与 Research Bridge / MCP 设计基线
- [`docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`](docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md)：ChatGPT 入库、资产管理与 DCA 补充设计
- [`docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md`](docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md)：冻结决策、Local-first 与备份恢复边界
- [`docs/investment-dashboard-v2-final-contract-audit-v1.md`](docs/investment-dashboard-v2-final-contract-audit-v1.md)：终局审计与 Phase 1 准入范围
- [`docs/investment-dashboard-v2-post-phase-1b-roadmap-rebaseline.md`](docs/investment-dashboard-v2-post-phase-1b-roadmap-rebaseline.md)：Phase 1B 后 CURRENT 开发顺序与 Stage 4 重叠判断

### 机器可读合同

- [`contracts/v1/README.md`](contracts/v1/README.md)：合同目录、版本规则和实现准入说明
- `contracts/v1/*.json`：Research Bridge、行业研究、资产账本、导入、权限、恢复和测试场景

### 当前实现

- [`docs/feature-registry.md`](docs/feature-registry.md)：功能状态登记
- [`docs/architecture.md`](docs/architecture.md)：已实现架构快照与现有技术边界
- 当前代码和测试：判断某项能力是否真实存在的实现证据

### Agent Skills

- [`AGENTS.md`](AGENTS.md)：项目事实源路由、hard invariants 与 Git 边界
- [`docs/agent-skills.md`](docs/agent-skills.md)：UI / Domain / Local Core / minimalism 与工程图 / 研究图路由，外部 Skill 固定版本、审计、安装与升级规则
- `.agents/skills/investment-dashboard-ui-workflow/SKILL.md`：重大 Dashboard UI 协调入口；按需路由到 tracked Impeccable facade，上游实现隔离于 `.agents/vendor/impeccable/`

### 历史基线

[`docs/investment-dashboard-master-plan-2026-09.md`](docs/investment-dashboard-master-plan-2026-09.md) 保留为 Stage 4 历史建设基线。历史文档中的固定 SHA 表示记录时点，不代表当前 `main`。

## 当前主功能

- 宏观研究
- 行业 / 产业链研究
- 个股池与个股详情
- 观察清单与 Review Workflow
- ResearchEvent / Earnings Verification
- 业绩预期证据中心
- A 股 / 港股行情与价格历史
- A 股财务 Provider V1
- A 股公告 Provider V1
- Company Guidance Expectation Provider V2
- Data Source Registry + Data Audit
- Provider Observation + Stability Gate
- Market Regime / PIT observation catalog 基础
- Local-first SQLite Local Core：Entity / Audit、Account / Asset ledger、DCA 与 trusted-import seam
- Developer Health Gate + GitHub Actions + Bundle Gate

详细功能状态和 Production Admission 以 `docs/feature-registry.md`、对应 Provider admission 文档和实际代码为准。

## 重要运行边界

**Provider 实现与生产准入是不同状态。** A 股财务和公告 Provider 已有独立实现，但只有通过对应 Stability / Admission Gate 后才能进入默认正式刷新路径。

**自动机构一致预期仍受 evidence / temporal / provenance 合同约束。** 当前缺失的正式能力保持 `not_implemented` / NO_GO，不能用不完整机构明细拼装“伪一致预期”。

**浏览器工作流与 Node-only Local Core 要区分。** Watchlist / Expectation 等浏览器功能仍按当前代码使用 LocalStorage；Phase 1B 的资产账本运行在单用户 Local-first SQLite Local Core 中，前端没有直接接入该数据库。Research Bridge、备份恢复正式流程与真实账户迁移仍须各自实现和准入；cloud business database 与跨设备同步不是当前 Local-first freeze 下的默认建设方向。

跨任务的数据真实性、PIT、权限、历史完整性和 AI 写入边界统一见 `AGENTS.md` 与对应 Contracts，本 README 不重复维护。

## 技术栈

- React 18
- Vite 6
- TypeScript strict
- Tailwind CSS 3
- Recharts
- Vitest
- SQLite / better-sqlite3（Node-only Local Core）
- Ajv（V1 contract validation）
- Python / Node 数据脚本
- GitHub Actions
- Vercel SPA

## 目录结构

```text
.agents/skills/        Repo-local Coding Agent Skills
src/
  components/         当前研究终端与 feature UI
  data/               研究数据、Data Source Registry、生成数据
  services/           Provider / loader / evidence / event / repository
  types/              数据模型
  utils/              时间、标准化、筛选等纯逻辑
public/data/           按公司 lazy-load 的重数据详情
scripts/               抓取、生成、验证、审计、健康、Provider Observation、Skill bootstrap
config/                Stability Gate / Market Regime / Observation Schema
contracts/v1/          V2 Phase 1 机器可读合同
local-core/             Node-only Local-first SQLite、Domain、Ports 与测试
docs/                  架构、V2 设计、Skill Registry、Provider、审计与历史基线
```

## 常用开发命令

安装与本地开发：

```bash
npm ci
npm run dev
```

环境健康：

```bash
npm run env:check
npm run --silent env:check:json
```

项目 Skill：

```bash
npm run agent:skills:check
npm run agent:skills:setup
```

`agent:skills:setup` 用于首次配置或明确恢复；固定来源、版本和详细规则见 `docs/agent-skills.md`。

基础测试与构建：

```bash
npm run test
npm run data:audit
npm run build
```

A 股财务：

```bash
npm run data:fetch:financials:a
npm run data:validate:financials:a
npm run test:financials:a
```

A 股公告：

```bash
npm run data:fetch:announcements:a
npm run data:validate:announcements:a
npm run test:announcements:a
```

公司指引：

```bash
npm run data:fetch:expectations:company-guidance
npm run data:validate:expectations:company-guidance
npm run test:expectations:company-guidance
```

Provider Stability：

```bash
npm run data:observe:providers
npm run data:health:providers
npm run data:refresh:eligibility
npm run test:provider-observability
```

`data:observe:providers` 会访问真实 Provider；离线 CI 与普通审查仍以可重复验证为主。

Coding Agent 的任务路由、项目不变量、Skill 入口与 Git 流程统一见根目录 `AGENTS.md`。
