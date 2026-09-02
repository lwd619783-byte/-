# 投资研究看板架构基线

> 基线日期：2026-09-02  
> 代码基线：`main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`  
> 本文描述“当前真实架构”，不是未来理想架构。未来规划见 `docs/investment-dashboard-master-plan-2026-09.md`。

## 1. 系统定位

投资研究看板是面向 A 股 / 港股的个人投研工作台。当前系统已经不只是行情展示，而是由研究界面、真实数据 Provider、证据工作流、复盘工作流和数据治理共同组成。

当前产品闭环大致为：

`宏观 / 行业 / 个股信息 → 真实数据 → 业绩预期证据 → ResearchEvent → Earnings Verification → Watchlist Review`

尚未完成的目标闭环为：

`研究 → 估值 → 投资决策 → 持仓 / 组合 → 事件验证 → 复盘 → 再平衡`

## 2. 技术栈

- React 18
- Vite 6
- TypeScript strict
- Tailwind CSS 3
- Recharts
- Vitest
- Python 数据脚本
- Node.js 数据生成 / 校验脚本
- GitHub Actions
- Vercel SPA

当前没有业务后端数据库，用户工作流数据主要保存在浏览器 LocalStorage。

## 3. 顶层模块

### 3.1 页面 / 业务域

当前 `App.tsx` 暴露 6 个主入口：

1. 宏观
2. 行业
3. 个股池
4. 观察清单
5. 验证中心
6. 预期证据

对应主要目录：

- `src/components/dashboard`：宏观研究
- `src/components/industry`：行业、细分行业、产业链
- `src/components/stock`：股票池、个股卡片、个股详情
- `src/components/watchlist`：观察清单、复盘、任务、备份
- `src/components/research`：ResearchEvent 与业绩验证
- `src/components/expectation`：业绩预期证据层
- `src/components/common`：通用研究终端组件
- `src/components/layout`：Header / Sidebar / RightRail / Layout

### 3.2 数据与服务

- `src/data`：研究静态数据、数据源注册表、生成数据摘要
- `src/data/real`：可同步加载的真实生成数据
- `public/data`：按公司拆分的重数据详情文件
- `src/services`：Provider 聚合、异步详情加载、校验、证据选择、事件生成、任务生成、持久化
- `scripts`：抓取、生成、校验、审计、环境健康、Provider 观测
- `config`：Provider Stability Gate 与 Observation Schema

## 4. 数据读取架构

### 4.1 前端数据模式

系统支持：

- `Mock Data`
- `Mixed Data`
- `Real Data`

原则：真实模式下缺失数据必须显式显示缺失 / partial / stale / not_implemented 等状态，禁止把缺失值偷偷替换成 mock 或 0。

### 4.2 轻数据与重数据拆分

A 股财务、A 股公告、公司指引等数据采用：

`summary → manifest → per-company detail`

架构。

目的：

- 首屏只同步加载摘要；
- 打开个股详情时再按公司加载完整历史；
- manifest 约束允许路径、文件大小、checksum 和身份；
- 避免完整历史进入初始 JavaScript bundle。

### 4.3 Provider 生产边界

Provider 网络访问只发生在本地 / 运行脚本层，不进入浏览器前端。

典型链路：

`外部公开源 → fetch/generate script → validation → generated artifact → dataProvider/service → UI`

当前正式存在的独立 Provider / 数据链包括：

- A 股行情 / 历史价格
- 港股行情 / 历史价格 MVP
- A 股财务 Provider V1
- A 股公告 Provider V1
- Company Guidance Expectation Provider V2

A 股财务和公告目前仍未通过 Stability Gate 的生产 admission，因此没有纳入默认 `data:refresh`。

## 5. 数据真实性与治理架构

### 5.1 Data Source Registry

`src/data/data-source-registry.ts` 是数据能力总登记表，记录：

- category
- market
- status
- sourceType
- provider
- sourceUrl
- storage location
- generator
- refresh method / frequency
- coverage
- frontend consumers
- fallback behavior
- verification status
- known limitations

它是判断“数据是否真的已接入”的第一权威入口。

### 5.2 Data Audit

`npm run data:audit`

负责检查：

- mock / placeholder 是否错误进入 production route；
- 缺失值是否被转换为 0；
- registry 与实际文件 / consumer 是否一致；
- blocking risk / P0 是否存在；
- 生成路径、覆盖率与状态是否自洽。

### 5.3 Provider Stability Gate

财务和公告 Provider 使用独立的跨日稳定性资格体系，包括：

- Provider Observation
- provenance cohort
- append-only observation ledger
- resolution ledger
- checksum / identity / schema
- rolling-window removal 分类
- data drift
- coverage / validation
- run 数、成功日、自然日门槛

当前状态：机制已经完成，但截至代码基线仍为 `insufficient_observation_window / NO_GO`。

### 5.4 Developer Health / CI

开发环境门禁：

- `npm run env:check`
- `npm run --silent env:check:json`

CI 主要执行离线校验，不依赖实时 Provider 网络访问。

## 6. 研究工作流架构

### 6.1 ResearchEvent

`researchEventProvider` 将财务、公告、业绩预期等事实标准化为研究事件。

ResearchEvent 用于连接：

`事实变化 → 待验证事项 → Watchlist Review / Earnings Verification`

### 6.2 Earnings Verification

验证中心承担“事前判断与事后事实”的对账，而不是只展示最新财报。

核心原则：

- 只有可靠的事前证据才能产生正式比较；
- 数据发布时间、形成时间、披露时间与审计时间不能混用；
- 缺失证据不能输出“超预期 / 不及预期”的伪结论。

### 6.3 Earnings Expectation Evidence

预期证据层包含：

- 公司指引
- 单家机构预测
- 机构一致预期模型
- 用户预测
- immutable snapshot
- correction chain
- business revision chain
- temporal audit
- CSV / JSON / 手工录入

当前自动机构一致预期 Provider 仍是 `not_implemented`。

### 6.4 Watchlist Review

Watchlist V2 已从静态清单升级为研究工作流：

- WatchItem
- immutable Review History
- ReviewTask
- next review
- ResearchEvent reminder
- JSON backup / import / merge / replace
- corruption recovery

当前数据边界：LocalStorage，仅单浏览器 / 单 origin。

## 7. 当前架构缺口

### 7.1 App 过度集中

`src/App.tsx` 已承担大量：

- 页面导航
- Provider workflow load
- LocalStorage repository / store 初始化
- ResearchEvent 聚合
- ReviewTask 聚合
- Expectation workflow 聚合
- dashboard KPI 计算
- 多个 Modal 状态

继续增加牛熊温度计、估值、Portfolio 后会进一步放大耦合。

Stage 4 应逐步转为：

`App Shell → Feature/Page module → Domain service/store`

### 7.2 无云端业务后端

当前没有：

- Auth
- PostgreSQL / Supabase persistence
- cross-device sync
- multi-user
- server-side scheduled jobs

这将成为后续 Portfolio、小程序和长期用户数据的主要约束。

### 7.3 宏观与行业没有统一 Metric Registry

财务 / 公告已经有较强 Provider contract，但宏观和行业数据仍没有统一定义：

- source
- nativeFrequency
- releaseLag
- observationDate
- effectiveDate
- revisionPolicy
- staleAfter
- normalization

因此牛熊温度计必须先建立 Metric Registry，而不能直接在 UI 中堆一批指标。

### 7.4 缺估值与 Portfolio Domain

当前没有正式的：

- Valuation Snapshot
- Scenario
- Target Price
- Account
- Portfolio
- Position
- Transaction
- Target Allocation
- Rebalance Task

这是从“研究工作台”升级成“投研操作系统”的核心缺口。

## 8. 推荐目标架构

Stage 4 后的目标结构建议逐步演化为：

```text
src/
  app/                 # App shell / router / global composition
  features/
    macro/
    market-regime/
    industry/
    stocks/
    expectations/
    research-events/
    watchlist/
    valuation/
    portfolio/
  domain/              # 稳定业务模型与纯逻辑
  services/            # Provider adapters / repositories / orchestration
  data/                # generated summaries / static reference
  components/          # 真正跨 feature 的通用 UI
```

不要求一次性重构。原则是：每新增一个 Stage 4 功能，就尽量避免继续扩张 `App.tsx`。

## 9. 架构原则

后续开发必须继续遵循：

1. **事实与判断分离**：Provider 数据、用户判断、推导结果必须有明确来源。
2. **缺失不是 0**：缺失 / 不适用 / 未实现必须显式建模。
3. **时间语义优先**：禁止使用事后数据污染事前判断。
4. **Provider fail closed**：来源或 schema 不可靠时宁可不生产结果。
5. **重数据 lazy load**：避免全量历史进入 initial bundle。
6. **用户历史 append-only**：Review、Expectation correction 等保留可审计历史。
7. **研究结论可追溯**：未来 Valuation / Portfolio 也必须能追到证据与时间。
8. **新自动化必须可降级**：自动 Provider / AI 分析失败不能破坏已有手工工作流。
9. **先 contract 后 UI**：牛熊温度计、行业指标、Portfolio 等先定义模型和数据合同，再做页面。
10. **Stage 验收以可验证状态为准**：不能因为“代码写了”就把能力标记为生产完成。
