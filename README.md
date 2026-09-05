# 投资研究看板

面向 A 股 / 港股的个人投资研究系统。项目已经从早期 Mock Dashboard 演进为包含真实数据 Provider、证据工作流、研究事件、复盘任务、时间语义和数据真实性治理的研究工作台；长期产品方向已经进一步冻结为：

**Personal Investment Research & Asset OS（个人投资研究与资产操作系统）**。

长期目标不是单纯展示行情，而是形成：

`宏观 / Market Regime → 行业 → Thesis → 个股验证 → 真实数据与证据 → 投资表达 → Portfolio / DCA → 事件验证 → 复盘`

> Agent / Codex 开发入口：先读根目录 [`AGENTS.md`](AGENTS.md)，再按任务类型读取相关事实源。  
> README 是稳定导航页，不使用某个固定 `main` SHA 充当长期“当前状态”。当前实现以代码、测试和 [`docs/feature-registry.md`](docs/feature-registry.md) 为准。

## 当前阶段

仓库同时包含两类内容，必须区分：

1. **当前已经实现的研究看板与数据治理能力**：行情、财务 / 公告 Provider、预期证据、ResearchEvent、Watchlist Review、Provider Stability、Market Regime/PIT 基础等；
2. **已经冻结、按阶段进入实现的 V2 Research & Asset OS 设计和合同**：Research Bridge / MCP、ChatGPT 研究入库、行业研究 taxonomy、资产 / Portfolio / DCA、Local-first、备份恢复和机器可读合同。

2026-09-05 V2 合同终局审计已经 **PASS FOR PHASE 1 IMPLEMENTATION**。这表示第一阶段基础设施可以按冻结合同进入实现，**不表示所有 V2 功能已经实现，也不表示所有能力都获得 Production Admission**。

## Source of Truth

### 当前产品与 V2 架构决策

- [`docs/investment-dashboard-v2-research-os-and-bridge-design.md`](docs/investment-dashboard-v2-research-os-and-bridge-design.md)：Top-down Research OS 与 Research Bridge / MCP 设计基线
- [`docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md`](docs/investment-dashboard-v2-chatgpt-ingestion-and-asset-management-addendum.md)：ChatGPT 研究入库、资产管理与 DCA 补充设计
- [`docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md`](docs/investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md)：已冻结用户决策、Local-first 与备份恢复边界
- [`docs/investment-dashboard-v2-final-contract-audit-v1.md`](docs/investment-dashboard-v2-final-contract-audit-v1.md)：V2 合同终局审计与 Phase 1 实现准入范围

### 机器可读合同

- [`contracts/v1/README.md`](contracts/v1/README.md)：合同目录说明、版本规则和当前实现准入
- `contracts/v1/*.json`：Research Bridge、行业研究、资产账本、导入、权限、恢复和测试场景的 V1 合同

Phase 1 实现必须以当前 `contracts/v1` 为合同边界。若真实场景无法表达，应先修改合同并重新审计，不在业务代码中私自建立第二套字段语义。

### 当前实现状态

- [`docs/feature-registry.md`](docs/feature-registry.md)：功能状态登记
- [`docs/architecture.md`](docs/architecture.md)：已实现系统的架构快照与现有边界
- 当前代码与测试：判断某项能力是否真的存在的最终实现证据

### 历史路线与审计基线

- [`docs/investment-dashboard-master-plan-2026-09.md`](docs/investment-dashboard-master-plan-2026-09.md)：Stage 4 历史建设基线，保留用于实施历史和审计参考；当前 V2 产品 / 架构决策以更新的 V2 freeze / audit 文档为准

历史文档中的固定 SHA 表示其记录时点，不代表当前 `main`。

## 当前主功能

当前研究看板主要包含：

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
- Developer Health Gate + GitHub Actions + Bundle Gate

详细状态与是否已生产准入，以 `docs/feature-registry.md`、相关 Provider admission 文档和实际代码为准。

## 重要生产边界

### Provider 实现不等于生产准入

A 股财务和公告 Provider 已有独立实现，但只有通过对应 Stability / Admission Gate 后才能进入默认正式刷新路径。不得因为代码、测试或生成 artifact 已存在就自动视为 Production Admitted。

### 自动机构一致预期

机构一致预期的数据源与正式 Provider 必须满足既有 evidence / temporal / provenance 合同。不能用不完整机构明细拼装“伪一致预期”；缺失能力保持显式 `not_implemented` / NO_GO，直到正式实现和验证完成。

### 用户数据与 V2 Local-first

现有 Watchlist / Expectation 等工作流仍以当前代码的实际持久化方式为准。V2 已冻结 Local-first、资产账本、Research Bridge 和备份恢复合同，但这些设计只有在对应 Phase 1 任务实现后才成为运行能力。

## 技术栈

- React 18
- Vite 6
- TypeScript strict
- Tailwind CSS 3
- Recharts
- Vitest
- Python / Node 数据脚本
- GitHub Actions
- Vercel SPA

## 目录结构

```text
src/
  components/         当前研究终端与 feature UI
  data/               研究数据、Data Source Registry、生成数据
  services/           Provider / loader / evidence / event / repository
  types/              数据模型
  utils/              时间、标准化、筛选等纯逻辑
public/data/           按公司 lazy-load 的重数据详情
scripts/               抓取、生成、验证、审计、健康、Provider Observation
config/                Stability Gate / Market Regime / Observation Schema
contracts/v1/          V2 Phase 1 机器可读合同
docs/                  架构、V2 设计、Provider、审计与历史基线
```

## 数据真实性原则

新增数据能力默认遵循：

1. Provider 事实、用户判断、AI 研究和派生结果保持来源分离；
2. Real 模式不得用 mock 静默补真实字段；
3. 缺失值不得无理由转换为 `0`；
4. `partial`、`stale`、`not_implemented`、`conflicted` 等状态显式传播；
5. 重要生成数据具备 schema / identity / checksum / validation；
6. 事后数据不得污染事前预期、历史研究和 PIT 回测；
7. 未通过生产准入的 Provider 不进入默认正式刷新；
8. 需要 revision / append-only 的研究、证据、账本和审计历史不得被静默覆盖。

完整跨任务不变量见 `AGENTS.md`。

## 常用开发命令

安装：

```bash
npm ci
```

本地开发：

```bash
npm run dev
```

开发环境健康检查：

```bash
npm run env:check
npm run --silent env:check:json
```

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

`data:observe:providers` 会访问真实 Provider。普通 CI、代码审查和不相关任务不应以实时网络访问代替离线、可重复验证。

## 开发与审查原则

- 先合同 / domain model，后 UI；
- 先可靠性与时间语义，后覆盖率；
- 不伪造缺失数据；
- 不把“已实现”误写为“已生产准入”；
- 每个任务使用独立功能分支；
- 功能分支先普通 push，不在独立审查前创建 PR；
- 基于远端分支与 `main` 的真实差异做独立审查；
- 审查通过后再进入 PR / CI / 合并；
- 验证按改动风险选择，不要求所有任务无差别执行全套检查。

Coding Agent 的具体工作方式、文档路由、永久不变量和 Git 边界统一见根目录 `AGENTS.md`。