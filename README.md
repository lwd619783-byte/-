# 投资研究看板

面向 A 股 / 港股的个人投研工作台。项目已经从早期的 Mock Dashboard 演进为包含真实数据 Provider、证据工作流、研究事件、复盘任务和数据真实性治理的研究系统。

当前目标不是单纯展示行情，而是逐步形成：

`宏观 / 行业 / 个股研究 → 真实数据 → 预期证据 → ResearchEvent → 验证与复盘 → 估值 → Portfolio`

> 当前代码基线：`main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`（2026-07-29）。  
> Stage 4 总路线见 `docs/investment-dashboard-master-plan-2026-09.md`。

## 当前主功能

前端目前有 6 个主入口：

- 宏观
- 行业
- 个股池
- 观察清单
- 验证中心
- 预期证据

已经建设的核心能力包括：

- A 股 / 港股行情与价格历史 MVP
- A 股财务 Provider V1
- A 股公告 Provider V1
- Company Guidance Expectation Provider V2
- Earnings Expectation Evidence Layer V1 / Schema V2
- ResearchEvent + Earnings Verification V1
- Watchlist Review Workflow V2
- Data Source Registry + Data Audit
- Provider Observation + Stability Gate
- Developer Health Gate + GitHub Actions + Bundle Gate

详细状态见：`docs/feature-registry.md`。

## 重要生产边界

### A 股财务与公告 Provider

财务和公告 Provider 本身已经实现并通过专项校验，但截至当前代码基线仍未满足跨日 Stability Gate 的正式生产准入条件。

因此：

- 财务 Provider：`DONE / NOT ADMITTED`
- 公告 Provider：`DONE / NOT ADMITTED`
- 两者都不能因为“代码已经存在”就直接加入默认 `data:refresh`

截至 2026-07-29 的新 provenance cohort 每个 Provider 只有 1 个 eligible run、1 个 distinct day、1 个 successful day，Gate 仍为 `insufficient_observation_window / NO_GO`。

### 自动机构一致预期

只完成公开数据源 Source Probe，正式 Provider **未实现**。

当前状态必须继续保持 `not_implemented / NO_GO`，禁止用不完整机构明细拼装“伪一致预期”。

### 用户数据

Watchlist 和 Earnings Expectation 等用户工作流当前主要保存在浏览器 LocalStorage：

- 无账号体系
- 无云同步
- 无跨设备同步
- 无多用户协作

云端持久化属于 Stage 4.3。

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
  components/
    common/          通用研究终端组件
    dashboard/       宏观看板
    industry/        行业 / 产业链
    stock/           股票池 / 个股详情
    watchlist/       观察清单 / Review Workflow
    research/        ResearchEvent / Earnings Verification
    expectation/     业绩预期证据工作流
    layout/          页面布局
  data/              研究数据、Data Source Registry、同步生成数据
  services/          Provider / loader / evidence / event / task / repository
  types/             数据模型
  utils/             时间、标准化、筛选等纯逻辑
public/data/          按公司 lazy-load 的重数据详情
scripts/              抓取、生成、验证、审计、健康、Provider Observation
config/               Stability Gate / Observation Schema
docs/                 设计、审计、Provider 与项目基线文档
```

系统架构详见：`docs/architecture.md`。

## 数据模式

Header 可切换：

- `Mock Data`
- `Mixed Data`
- `Real Data`

核心原则：

- 真实模式下不得用 mock 静默补真实字段；
- 缺失值不得转换为 0；
- `partial`、`stale`、`not_implemented`、`conflicted` 等状态必须显式传播；
- 重数据采用 summary + manifest + per-company detail，避免完整历史进入初始 bundle。

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

## Provider 与数据命令

基础行情 / 港股 / 宏观：

```bash
npm run data:fetch
npm run data:validate
npm run data:refresh
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

注意：`data:observe:providers` 会执行真实 Provider 观测；普通 CI 和代码审查不应以实时网络访问代替离线验证。

## 数据真实性原则

新增数据能力时应遵循：

1. 先在 `src/data/data-source-registry.ts` 登记能力与状态；
2. 明确 Provider、来源、生成器、刷新方式、coverage、fallback 和 known limitations；
3. 真实数据只通过 service / Provider 层进入 UI，组件不直接绑定外部源；
4. 缺失 / 失败 / 未实现显式建模；
5. 重要生成数据具备 schema / identity / checksum / validation；
6. 事后数据不能污染事前预期和研究判断；
7. 未通过生产准入的 Provider 不进入默认刷新。

## Stage 4 路线

### Stage 4.0 — Project Baseline Reset

- 更新总建设方案
- 更新 Architecture
- 建 Feature Registry
- 更新 README

### Stage 4.1 — Macro Metric Registry V2 + 牛熊温度计

建立每项宏观 / 市场指标的：

- source
- nativeFrequency
- release calendar / release lag
- observation date / effective date
- revision policy
- stale threshold
- normalization
- weight

在此基础上建设可解释、可回测、可审计的 Market Regime / 牛熊温度计。

### Stage 4.2 — Valuation + Portfolio

建立：

- 估值中心
- Account / Portfolio / Position / Transaction
- Target Allocation / Rebalance Task
- Research Thesis ↔ Position

### Stage 4.3 — Cloud Persistence

建立 Auth、Supabase / PostgreSQL、LocalStorage Migration 和跨设备同步。

### Stage 4.4 — Industry Data Platform

建设行业指标 Registry、供需 / 价格 / 库存 / 产能 / 开工率等 Provider 与景气评分。

### Stage 4.5 — 港股完整研究链

补齐财务、公告、指引、预期和 ResearchEvent。

### Stage 4.6 — Research Copilot / 自动复盘

建立在可信数据、稳定工作流和云端持久化之上。

## 核心项目文档

- `docs/investment-dashboard-master-plan-2026-09.md`：总建设方案与路线图
- `docs/architecture.md`：当前真实架构与边界
- `docs/feature-registry.md`：功能状态总登记表
- `docs/data-audit-v1.md`：数据真实性审计
- `docs/provider-stability-gate-v1.md`：Provider 稳定性准入
- `docs/earnings-expectation-evidence-v1.md`：业绩预期证据层
- `docs/watchlist-review-workflow-v2.md`：观察清单与复盘
- `docs/research-event-center-v1.md`：研究事件与验证中心

## 开发原则

后续新增功能默认遵循：

- 先数据合同 / domain model，后 UI；
- 先可靠性，后覆盖率；
- 不伪造缺失数据；
- 不把“已实现”误写为“已生产准入”；
- 每个 Stage 使用独立功能分支；
- 功能分支先推远端，不直接创建 PR；
- 基于远端分支与 `main` 做独立审查；
- 审查通过后再创建 PR / CI / 合并。
