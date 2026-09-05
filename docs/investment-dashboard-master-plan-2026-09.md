# 投资研究看板总建设方案与现状审计（2026-09）

> 基线：`main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`（2026-07-29）
>
> 目的：替代 2026-07-02 仅针对 UI Terminal Upgrade 的阶段性 plan，形成后续开发、Codex 执行、独立审计和版本验收的统一项目基线。

## 1. 项目定位

投资研究看板的目标不是单纯行情终端，而是面向 A 股 / 港股的个人研究操作系统，覆盖：

1. 宏观环境与资产定价背景；
2. 行业与产业链景气研究；
3. 个股池、公司事实与核心变量；
4. 真实行情、财务、公告等 Provider；
5. 业绩预期与证据层；
6. 研究事件、业绩验证与复盘；
7. 观察清单与持续跟踪；
8. 数据真实性、时间语义、稳定性和审计；
9. 后续估值、组合、资产配置、主题研究和自动化投研工作流。

现阶段项目已经从“展示型 Dashboard”进入“有数据治理约束的研究工作台”阶段，但尚未成为完整的投研操作系统。

---

## 2. 当前技术架构

### 2.1 前端

- React 18
- Vite 6
- TypeScript strict
- Tailwind CSS 3
- Recharts
- Vitest
- Vercel SPA 部署

核心目录：

- `src/components/dashboard`：宏观看板
- `src/components/industry`：行业与产业链
- `src/components/stock`：个股池与个股详情
- `src/components/watchlist`：观察清单和复盘
- `src/components/research`：研究事件与业绩验证
- `src/components/expectation`：业绩预期证据工作流
- `src/services`：Provider、校验、加载、时间语义与工作流逻辑
- `src/data`：行业、个股、宏观、数据源注册表、生成数据
- `public/data`：按公司拆分的重数据详情文件
- `scripts`：真实数据抓取、生成、校验、健康检查、稳定性观测和审计
- `docs`：Provider 设计、审计报告、数据映射、工作流设计等

### 2.2 数据模式

前端支持：

- Mock Data
- Mixed Data
- Real Data

真实数据采取“离线生成标准化 JSON，前端只读”的安全模式，Provider Token / 网络抓取逻辑不进入前端。

### 2.3 数据治理

项目已经形成以下治理框架：

- Data Source Registry
- Data Audit V1
- Provider Stability Gate
- Provider Observation Ledger
- Resolution Ledger
- Developer Health Gate
- Generated artifact checksum / manifest
- 缺失值、partial、stale、not_implemented、conflicted 等显式状态
- 时间语义和审计时间约束
- 生产 bundle 体积门禁

这部分已经是当前项目最成熟的基础设施之一。

---

## 3. 已完成模块

### A. 基础 UI 与研究终端框架 —— 已完成

已具备：

- 暗色研究终端风格
- Header、Dashboard Card、KPI、图表面板、表格、筛选等通用组件
- 宏观 / 行业 / 个股 / 观察清单 / 预期 / 研究事件等页面结构
- 桌面和窄屏适配
- UI audit

旧的 `2026-07-02-investment-dashboard-terminal-upgrade` 计划已经基本被实际实现超越，不再适合作为总路线图。

### B. 股票与研究对象基础模型 —— 已完成

已具备：

- A 股 / 港股 stock universe
- 行业 / 细分行业 / 产业链结构
- 个股卡片与详情
- 私营公司补充模型
- 股票筛选、排序、跳转
- 56 只 A 股当前核心研究池
- 3 只港股行情 MVP

### C. A 股行情与基础真实数据层 —— 已完成 MVP

已具备：

- A 股行情与价格历史
- 港股行情与 60 日 K 线 MVP
- 标准化 JSON 生成
- 数据校验与 source/status/updatedAt 管理
- Real/Mixed 模式下禁止静默回退为伪造数据

### D. A 股财务 Provider V1 —— 已完成独立 Provider

已具备：

- 新浪 CompanyFinanceService 数据源
- 56/56 公司覆盖
- 利润表、资产负债表、现金流、派生指标
- 累计值与单季度语义拆分
- summary + manifest + per-company lazy detail 架构
- checksum / schema / identity 校验
- 前端个股详情异步加载
- 专项测试与 CI

当前限制：尚未进入默认 `data:refresh`，需经过 Stability Gate 正式 admission。

### E. A 股公告 Provider V1 —— 已完成独立 Provider

已具备：

- 巨潮 CNInfo 公告元数据与官方 PDF
- 56/56 公司状态覆盖
- 两年滚动窗口
- per-company lazy detail
- 公告分类
- 业绩预告、修正、快报、定期报告等结构化解析
- metadata_only / parse_partial 等显式状态
- 官方链接保留
- checksum / manifest / validation

当前限制：

- 扫描版与复杂 PDF 未做 OCR
- 仍有大量 metadata_only / parse_partial
- 尚未进入默认刷新

### F. Provider Stability Gate / 数据真实性治理 —— 已完成框架，资格未达标

已具备：

- 跨日 Provider Observation
- provenance cohort
- append-only observation ledger
- resolution ledger
- checksum / drift / rolling-window removal 分类
- 56/56 coverage gate
- structural validation gate
- run success rate / successful day / observation day 门槛
- fail-closed admission

截至 2026-07-29：

- 新 cohort 每个 Provider 只有 1 个 eligible run
- 1 distinct day
- 1 successful day
- Gate = `insufficient_observation_window`
- Financial Provider = NO_GO
- Announcement Provider = NO_GO

因此这一层是“机制完成，生产资格未完成”。

### G. Research Event Center / Earnings Verification —— 已完成 V1

已具备：

- ResearchEvent 模型
- 财务 / 公告 / 预期数据聚合为研究事件
- Research Event Center
- Earnings Verification Panel
- 个股详情联动
- 数据状态传播
- 相关测试

### H. Watchlist Review Workflow V2 —— 已完成

已具备：

- 可编辑观察项
- 不可变 review history
- 确定性 review task
- next review 提醒
- ResearchEvent 联动
- LocalStorage Schema
- corruption recovery
- JSON import / export / merge / replace
- 股票详情内联动

当前限制：

- 仅本地浏览器持久化
- 无账号
- 无云同步
- 无跨设备同步
- 无多用户协作

### I. Earnings Expectation Evidence Layer V1 / Schema V2 —— 已完成

已具备：

- 公司指引
- 单家机构预测
- 机构一致预期模型
- 用户预测
- 不可变 snapshot
- correction chain
- business revision chain
- temporal audit
- CSV / JSON / 手工导入
- corruption-safe import
- actual vs ex-ante expectation comparison
- ResearchEvent / ReviewTask / KPI 联动

这一模块已经具备较严格的证据与时间语义约束。

### J. Company Guidance Expectation Provider V2 —— 已完成

已具备：

- 基于已提交 CNInfo 公告生成公司业绩指引
- 56 公司 universe
- 15 家当前存在可用 snapshot
- deterministic artifact generation
- committed artifact byte-for-byte check
- provider corrections / business revisions 分离
- workflow propagation

### K. Institution Consensus Provider —— 只完成 Source Probe，正式 Provider 未实现

已完成：

- 东方财富 / 同花顺公开源合同调研
- pagination / identity / schema / date / transport probe
- 65 项离线测试
- NO_GO 决策

未完成：

- 自动机构一致预期 Provider
- 正式 consensus snapshot
- 自动 production workflow

当前状态应继续保持 `not_implemented`，不能以不完整公开数据生成“伪一致预期”。

### L. Developer Health / CI / Build Gate —— 已完成

已具备：

- `npm run env:check`
- JSON health output
- Git / dependency / artifact / script / CI alignment 检查
- GitHub Actions 离线验证
- Provider 专项测试
- Data Audit
- build / bundle gate

---

## 4. 部分完成模块

### 4.1 宏观看板 —— UI 已有，数据体系不完整

现有 `MacroTab` 和 `macroData.ts`，也有宏观抓取脚本，但当前宏观模块尚未达到与财务 Provider 同等级的数据治理成熟度。

需要补足：

- 宏观指标数据字典
- 每项数据的官方来源
- 更新频率（日 / 周 / 月 / 季）
- 发布时间 / observation date / effective date
- 修订机制
- 中国 / 美国 / 全球维度
- 利率、通胀、就业、信用、流动性、地产、财政、美元、商品等因子
- 自动 stale 判定
- 历史序列
- 宏观信号计算层

### 4.2 行业研究 —— 展示和少量专题已完成，体系化数据未完成

已具备行业、细分行业、产业链、机器人专题等结构。

需要补足：

- 全行业标准分类体系
- 行业景气指标库
- 高频 / 月度 / 季度数据源
- 供需、价格、库存、产能、开工率、资本开支等结构化数据
- 行业数据 Provider
- 行业事件与行业预期验证
- 行业景气评分

### 4.3 港股 —— 行情 MVP 已完成，研究数据链明显缺失

已完成：

- quote
- price history

未完成：

- 港股财务 Provider
- 港交所公告 Provider
- 公司指引
- 预期数据
- ResearchEvent 完整支持
- 港股行业 / 估值字段标准化

### 4.4 数据刷新 —— 独立脚本很多，统一生产刷新未完成

当前 `data:refresh` 仍主要覆盖基础行情 / 港股 / 宏观，不包含未正式 admission 的 A 股财务和公告 Provider。

后续需要：

- Provider Gate 达标
- 单独 admission PR
- default refresh orchestration
- 失败隔离
- retry policy
- stale policy
- refresh summary
- 定时任务
- 生产运行监控

---

## 5. 尚未建设的核心模块

### P0：决定项目能否从“研究看板”升级为“投研操作系统”

#### 5.1 云端数据库与账号体系

目前 Watchlist / Expectation 等用户数据仍在 LocalStorage。

需要建设：

- Supabase / PostgreSQL 后端
- 用户账户
- 云同步
- 跨设备
- schema migration
- append-only 审计表
- Row Level Security
- 本地数据迁移工具

#### 5.2 投资组合 / 持仓 / 交易记录

当前研究结论与真实资产配置没有形成闭环。

建议新增：

- Portfolio
- Account
- Position
- Transaction
- Cost basis
- P/L
- Allocation
- Target weight
- Rebalance task
- Research thesis ↔ position mapping

#### 5.3 估值中心

目前财务数据较强，但缺“从财务到估值”的正式层。

建议支持：

- PE / PB / PS / EV/EBITDA
- historical percentile
- peer comparison
- DCF / DDM / SOTP（可逐步建设）
- analyst assumptions
- bull / base / bear scenarios
- target price / expected return
- valuation evidence timestamp

#### 5.4 牛熊温度计 / 市场状态引擎

应作为新的独立模块建设，并最终汇总至总投研看板。

建议分层：

- 估值
- 流动性
- 趋势
- 市场广度
- 杠杆与情绪
- 宏观信用
- 资金流
- 风险偏好

所有指标必须记录：source、frequency、release lag、stale threshold、weight、normalization、historical percentile。

### P1：增强研究覆盖和自动化

#### 5.5 宏观数据 Provider V2

建立正式宏观数据 registry、frequency-aware refresh 和 revision-aware historical series。

#### 5.6 行业景气数据库

建立可扩展 IndustryMetric 模型和行业数据 Provider。

#### 5.7 港股全链路

补齐财务、公告、预期和事件。

#### 5.8 机构一致预期替代方案

如果公开网页无法满足 Provider contract，应评估：

1. 合法商业 API；
2. Wind / Choice / 同花顺 iFinD 导出接口；
3. 用户合法 CSV/Excel 导入；
4. 手工维护但有 evidence snapshot 的模式。

不得降低当前证据标准来“凑”一致预期数据。

#### 5.9 研究资料 / Evidence Library

需要支持：

- 研报
- 公告
- 电话会
- 产业资料
- 用户笔记
- 网页证据
- 文件哈希
- 来源日期
- thesis citation

### P2：效率与产品化

#### 5.10 全局搜索与 Command Palette

跨公司、行业、事件、预期、观察清单、资料搜索。

#### 5.11 通知与任务系统

- 财报临近
- 预期发生变化
- 观察清单到期
- thesis invalidation
- Provider stale
- 牛熊温度变化

#### 5.12 自动周报 / 复盘

自动汇总：

- 宏观变化
- 行业景气变化
- Watchlist 变化
- 业绩验证
- 组合变化
- 风险提示

---

## 6. 当前最重要的结构性问题

### 6.1 `App.tsx` 仍然过重

当前 `src/App.tsx` 超过 40KB，随着模块继续增加会成为维护瓶颈。

建议：

- 路由 / page 层拆分
- domain state 下沉
- feature module 边界明确
- lazy load 大模块

### 6.2 前端与用户数据仍以 LocalStorage 为核心

这限制了：

- 多设备
- 备份可靠性
- 长期数据增长
- 组合模块
- 自动任务
- 后续移动端 / 微信小程序

### 6.3 “数据 Provider”成熟度不均衡

财务 / 公告的数据治理远高于宏观、行业、港股。

后续要统一 Provider Contract，而不是每个模块继续各写一套临时数据逻辑。

### 6.4 数据更新时间频率尚未成为系统一级概念

宏观和行业数据不应该统一按“每周更新”。

建议在 DataSource / Metric 层新增：

- `nativeFrequency`
- `expectedReleaseCalendar`
- `releaseLag`
- `refreshPolicy`
- `staleAfter`
- `revisionPolicy`

UI 只展示“本周是否有新数据 / 当前最新数据是什么”，而不是强迫每个数据源每周产生新值。

### 6.5 缺少正式 Portfolio Layer

目前研究、验证、Watchlist 已经形成闭环，但没有把“研究判断”接到“实际持仓 / 目标仓位 / 组合风险”上。

这是下一阶段最值得补足的业务层之一。

---

## 7. 推荐开发路线

### Stage 4.0 — Project Baseline Reset

目标：把项目文档、架构和真实状态重新统一。

任务：

- [x] 完成本次 GitHub 全仓审计
- [x] 建立新的 Master Plan
- [ ] 更新 README，使其反映当前实际功能，不再描述成“第一版 mock Dashboard”
- [ ] 建立 `docs/architecture/` 总架构文档
- [ ] 建立 `docs/roadmap/` 状态表
- [ ] 建立 Feature Registry：每个功能的 status / owner / data source / persistence / test / production readiness

### Stage 4.1 — Macro & Bull/Bear Foundation

目标：先补宏观和牛熊温度计的数据底座。

任务：

- [ ] Macro Metric Registry V1
- [ ] frequency-aware refresh policy
- [ ] release / stale / revision semantics
- [ ] 中国 / 美国核心宏观数据集
- [ ] Bull/Bear Indicator Registry
- [ ] Score normalization / weighting
- [ ] Bull/Bear dashboard
- [ ] 历史回测与解释性验证

### Stage 4.2 — Portfolio & Valuation

目标：建立“研究 → 决策 → 持仓 → 复盘”闭环。

任务：

- [ ] Valuation Center V1
- [ ] Portfolio schema
- [ ] positions / transactions / target allocation
- [ ] thesis-to-position linking
- [ ] rebalance tasks
- [ ] performance attribution basic layer

### Stage 4.3 — Cloud Persistence

目标：摆脱 LocalStorage 单点。

任务：

- [ ] Supabase schema
- [ ] Auth
- [ ] Watchlist cloud migration
- [ ] Expectation cloud migration
- [ ] Research review cloud migration
- [ ] Portfolio persistence
- [ ] RLS / backup / migration

### Stage 4.4 — Industry Data Platform

目标：将行业研究从静态研究文本升级为景气跟踪系统。

任务：

- [ ] IndustryMetric schema
- [ ] Industry Provider contract
- [ ] 首批 3–5 个重点行业上线
- [ ] 景气评分
- [ ] 产业链事件
- [ ] 业绩映射

### Stage 4.5 — HK Full Coverage

目标：港股从 quote MVP 升级为完整研究资产。

### Stage 4.6 — Automation / Research Copilot

目标：自动生成复盘、提醒、数据变化摘要和研究任务。

---

## 8. Provider Admission 后续任务

财务和公告 Provider 不需要重新开发，当前最重要的是补足真实稳定性样本。

Admission 前必须继续遵守当前 Gate，不应绕过：

- >= 5 distinct Asia/Shanghai natural days
- >= 10 runs
- >= 5 successful days
- 56/56 coverage
- structural validation = 100%
- latest run success
- success-rate threshold
- no unresolved blocking drift / removal / checksum / schema / audit risk

当 Gate 达到 qualified 后：

1. 单独创建 admission 分支；
2. 修改 default refresh wiring；
3. 独立审计；
4. PR / CI；
5. 合并后再正式视为 production provider。

---

## 9. 项目状态总表

| 模块 | 状态 | 备注 |
|---|---|---|
| UI Terminal | 已完成 | 已超过旧 UI plan |
| A 股行情 | 已完成 MVP | 真实数据 |
| 港股行情 | 已完成 MVP | 当前 3 只 |
| A 股财务 Provider | Provider 完成 / Production NO_GO | 等 Stability Gate |
| A 股公告 Provider | Provider 完成 / Production NO_GO | 等 Stability Gate |
| Data Audit | 已完成 | 核心治理层 |
| Provider Stability Gate | 框架完成 | 观测样本不足 |
| Developer Health Gate | 已完成 | CI / 本地检查 |
| Research Event Center | 已完成 V1 | 已联动真实数据 |
| Earnings Verification | 已完成 V1 | 已联动事件 |
| Watchlist | 已完成 V2 | LocalStorage |
| Earnings Expectation Evidence | 已完成 V1 / Schema V2 | 较成熟 |
| Company Guidance Provider | 已完成 V2 | 15 家当前有 snapshot |
| Institution Consensus | 未实现 | Source Probe NO_GO |
| Macro | 部分完成 | 缺正式 Provider/频率治理 |
| Industry Research | 部分完成 | 缺景气数据库 |
| HK Financial / Filing | 未完成 | 高优先级后续 |
| Valuation Center | 未完成 | P0/P1 |
| Portfolio | 未完成 | P0 |
| Cloud Persistence | 未完成 | P0 |
| Bull/Bear Thermometer | 未完成 | 建议 Stage 4.1 |
| Evidence Library | 未完成 | P1 |
| Automation / Weekly Review | 未完成 | P2 |

---

## 10. 下一步执行建议

不建议立即大规模继续加零散页面。

建议下一轮按以下顺序推进：

1. Stage 4.0：先把 README / architecture / feature registry 与当前真实代码统一；
2. Stage 4.1：把已经讨论过的牛熊温度计正式纳入仓库，并先做 Macro Metric Registry；
3. 并行继续积累 Financial / Announcement Provider Stability Gate 的真实跨日样本；
4. 之后进入 Portfolio + Valuation；
5. 再做 Supabase 云端持久化；
6. 最后逐步扩行业和港股。

原则：后续任何新增数据能力都尽量复用当前已经建立的 Data Source Registry、Provider Contract、时间语义、审计和 Stability Gate，而不是重新形成一套宽松的数据路径。
