# 投资研究看板 Feature Registry

> 基线日期：2026-09-02  
> 代码基线：`main` @ `8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`

状态定义：

- `DONE`：功能和当前范围内验证已完成，可继续使用。
- `DONE / NOT ADMITTED`：实现已完成，但尚未满足生产准入条件。
- `CONTRACT V1`：研究 / 数据合同已经正式固化，但尚未进入 Provider / 评分 / UI 生产实现。
- `PARTIAL`：已有可用能力，但覆盖、数据源或工作流明显不完整。
- `PROBE ONLY`：只完成可行性 / 数据源探测，不能生产正式结果。
- `NOT STARTED`：尚未形成正式实现。
- `DEFERRED`：明确延后，不应被误认为缺陷。

## 1. 产品与研究界面

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| 研究终端 UI | DONE | 暗色终端、KPI、Card、Chart、Table、Filter、响应式 | 后续仅随新 Feature 演进 |
| 宏观看板 | PARTIAL | `MacroTab`、宏观静态/生成数据 | 接入 Stage 4.1 Metric Registry、频率/发布时间/修订/stale 体系 |
| 行业研究 | PARTIAL | 行业、细分行业、产业链、机器人专题 | 建行业指标库、行业 Provider、景气评分 |
| 个股池 | DONE | A/H 股研究池、筛选、排序、详情 | 后续扩 stock universe 与估值维度 |
| 个股详情 | DONE | 行情、财务、公告、研究事件、预期等聚合 | 后续加入估值、持仓、研究 thesis |
| 观察清单 | DONE | Watchlist V2、复盘、任务、备份 | 云同步、跨设备、账户化 |
| 验证中心 | DONE V1 | ResearchEvent + Earnings Verification | 后续扩行业/宏观判断验证 |
| 预期证据中心 | DONE V1 | 多类预期快照、修订、时间审计、导入 | 自动机构一致预期仍未实现 |

## 2. 行情与基础数据

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| A 股 Quote | DONE MVP | 真实生成数据 | 正式定义自动刷新 SLA / stale |
| A 股 Price History | DONE MVP | 真实历史价格 | 增加更长周期与 corporate action 规则 |
| 港股 Quote | DONE MVP | yfinance，当前少量研究池 | 扩覆盖、稳定性与正式 Provider contract |
| 港股 Price History | DONE MVP | 60 日历史 MVP | 扩展历史与数据治理 |
| 宏观数据 | PARTIAL | `data:fetch:macro` + `macroData.ts` | 按 Stage 4.1 Registry 重构官方源、native frequency、revision 与 release semantics |

## 3. A 股财务与公告

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| A 股财务 Provider V1 | DONE / NOT ADMITTED | 56/56、三表、summary/manifest/detail、lazy load、validator | 累积 Stability Gate 样本，单独 admission 后进入默认 refresh |
| A 股公告 Provider V1 | DONE / NOT ADMITTED | CNInfo、56/56 状态、两年窗口、PDF、lazy detail | Stability Gate；提高复杂 PDF 解析覆盖 |
| 公告结构化解析 | PARTIAL | 预告、修正、快报、定期报告关联 | OCR/复杂表格暂缺；不应为追求覆盖率降低证据标准 |
| 默认 Provider Refresh | PARTIAL | 基础行情/港股/宏观 | 财务和公告不得在 Gate 前加入 |

## 4. 业绩预期与证据

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| Earnings Expectation Evidence V1 | DONE | Snapshot、Correction、Business Revision、Temporal Audit、CSV/JSON/手工 | 云持久化 |
| Company Guidance Provider V2 | DONE | 基于 CNInfo 可靠区间，deterministic artifact | 覆盖受正式披露限制，不应伪补 |
| 单家机构预测模型 | DONE MODEL / MANUAL | 模型与录入工作流存在 | 缺自动可靠 Provider |
| Institution Consensus Model | DONE MODEL | 正式 schema / evidence semantics 已有 | 自动数据源未通过合同要求 |
| Institution Consensus Source Probe | PROBE ONLY | 东方财富/同花顺公开源 Probe + 65 offline tests | 保持 NO_GO，直到来源完整性/授权/可重算性满足 |
| Automatic Institution Consensus Provider | NOT STARTED | 无正式记录 | 不得以不完整公开明细拼装伪一致预期 |

## 5. Research Event / Review Workflow

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| ResearchEvent | DONE V1 | 财务、公告、预期等事件聚合 | 扩到宏观、行业、估值、组合事件 |
| Earnings Verification | DONE V1 | 事前证据 vs 事后实际 | 增加更完整 KPI / 业绩口径 |
| ReviewTask | DONE | Watchlist + Event 生成任务 | 云同步、通知与跨设备 |
| Immutable Review History | DONE | append-only 复盘链 | 后续迁移云端仍需保留语义 |
| 数据警告任务 | DONE | data warning episode / task | 扩生产监控 |

## 6. 数据治理 / 工程基础设施

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| Data Source Registry | DONE V1 | 数据源、状态、覆盖、consumer、fallback | Stage 4 新数据源持续登记 |
| Data Audit | DONE V1 | P0 / blocking risk / mock fallback / zero coercion 等 | 随新 domain 扩规则 |
| Provider Stability Gate | DONE FRAMEWORK | observation / provenance / resolution / threshold | 当前样本不足，资格仍 NO_GO |
| Developer Health Gate | DONE V1 | env check / json output | 可逐步模块化 |
| GitHub Actions CI | DONE | 离线验证、tests、build、artifact checks | 后续新增 Stage 4 gate |
| Bundle Gate | DONE | 财务等重数据不进入 initial bundle | 新重数据功能继续遵守 |
| UI Audit | DONE | UI 扫描 | 后续随页面扩展 |

## 7. 港股研究链

| 能力 | 状态 | 当前实现 | 主要缺口 / 下一步 |
| --- | --- | --- | --- |
| 港股财务 | NOT STARTED | 明确 `not_implemented` | 设计 HKEX / 合规数据源 Provider |
| 港股公告 | NOT STARTED | 明确 `not_implemented` | HKEX 公告 Provider |
| 港股公司指引 | NOT STARTED | 无自动 Provider | 需建立公告证据链 |
| 港股预期 | NOT STARTED | 无可靠自动源 | 与 A 股一致的 evidence contract |
| 港股 ResearchEvent 完整链 | PARTIAL | 行情可进入个股研究 | 等财务/公告/预期补齐 |

## 8. Stage 4 核心新增 Domain

| 能力 | 状态 | 优先级 | 当前结论 / 下一步 |
| --- | --- | ---: | --- |
| Macro / Market Regime Metric Registry V1 | CONTRACT V1 | P0 | 原始指标、native frequency、source/release/revision/stale contract 已固化 |
| 牛熊温度计数学定义 / Normalization V1 | CONTRACT V1 | P0 | 巴菲特、PE、社融、供给压力、缺失数据与 policy cap 已冻结为回测基线；下一步历史数据集设计 |
| 牛熊温度计 / Market Regime Engine | CONTRACT V1 | P0 | 已恢复 5 个基础模块 + 政策/盈利/结构泡沫 overlay；生产权重仍需历史回测 admission |
| Valuation Center | NOT STARTED | P0 | Stage 4.2 |
| Portfolio / Account / Position / Transaction | NOT STARTED | P0 | Stage 4.2 |
| Research Thesis ↔ Position Mapping | NOT STARTED | P0 | Stage 4.2 |
| Cloud Persistence / Auth | NOT STARTED | P0 | Stage 4.3 |
| LocalStorage → Cloud Migration | NOT STARTED | P0 | Stage 4.3 |
| Industry Metric Registry / Provider | NOT STARTED | P1 | Stage 4.4 |
| Industry Prosperity Score | NOT STARTED | P1 | Stage 4.4 |
| Full HK Research Chain | NOT STARTED | P1 | Stage 4.5 |
| Research Copilot / Auto Review | NOT STARTED | P2 | Stage 4.6，建立在可信数据与云端数据之上 |

### Stage 4.1 Metric Source / Formula 状态摘要

| 指标 | 当前状态 | 说明 |
| --- | --- | --- |
| 融资余额 | FORMULA READY / SOURCE_READY | 融资余额÷A股流通市值，70%水平分位+30%20日动量 |
| 权益 ETF 净流入 | FORMULA CANDIDATE / PROBE_REQUIRED | 20日净申赎÷期初权益ETF AUM；不得以成交额替代 |
| 北向资金 | FORMULA CANDIDATE / SOURCE_READY | 优先20日净流入÷A股流通市值；需锁定HKEX现行字段语义 |
| A 股成交额 | FORMULA READY / SOURCE_READY | 5日平均成交额÷A股流通市值，75%水平+25%动量 |
| 新增投资者 | FORMULA CANDIDATE / PROBE_REQUIRED | 月新增投资者÷上月末投资者总数 |
| 市场 PE 百分位 | FORMULA READY / SOURCE PROBE | V1 主锚定沪深300 TTM PE，10年 point-in-time 分位 |
| 中国版巴菲特指标 | FORMULA READY | 全部A股总市值÷TTM名义GDP，10年 point-in-time 分位 |
| 股票供给压力 | FORMULA READY / SOURCE PARTIAL | (IPO+再融资+实际减持-符合口径实际回购)3个月滚动÷A股总市值 |
| M2 | FORMULA READY / SOURCE_READY | M2同比70% + 3个月增速加速度30% |
| 社融 | FORMULA READY / SOURCE_READY | 社融存量同比70% + 3个月加速度30%；Credit Impulse 为挑战模型 |
| 工业企业利润 | CLASSIFIER CANDIDATE / SOURCE_READY | 单月利润同比优先于仅使用累计同比 |
| 上市公司盈利扩散 | NOT_READY | 当前56公司Provider不足以代表全A |
| 政策周期修正 | ARCHITECTURE READY | 总温度修正上限 ±5；事件分类与衰减规则待单独合同 |
| 结构性泡沫温度 | ARCHITECTURE READY | 独立0–100输出，V1不直接修改大盘温度 |

## 9. 明确延后 / 不应误做的事项

| 事项 | 状态 | 原因 |
| --- | --- | --- |
| 微信小程序 | DEFERRED | 当前先补足投研看板；未来可复用云端业务层 |
| 自动机构一致预期 Provider | DEFERRED / NO_GO | 当前公开源不满足生产合同 |
| A 股财务/公告直接加入默认 refresh | DEFERRED UNTIL ADMISSION | Stability Gate 尚未达标 |
| OCR 全量公告 | DEFERRED | 不是当前最优先能力，且不能牺牲证据可靠性 |
| 一次性重构整个 `App.tsx` | DEFERRED | 应在新增 Stage 4 Feature 时渐进拆分 |
| 未回测即输出正式牛熊温度 | DEFERRED / FORBIDDEN | 旧权重只是 seed；必须完成历史数据集、point-in-time 回测和公式版本 admission |

## 10. Stage 状态

### Stage 4.0 — PASS

- [x] 总建设方案存在并以当前代码为基线
- [x] 当前架构文档存在
- [x] Feature Registry 存在
- [x] README 已更新为当前项目入口
- [x] 已完成 / Partial / Not Started / NO_GO 边界明确
- [x] Stage 4.1–4.6 主路线明确
- [x] 文档分支与 `main` 已独立比较，未发现业务代码变更

### Stage 4.1 — IN PROGRESS

已完成：

- [x] 找回并核对原牛熊温度计云端规则 / 模型 / 数据源资料
- [x] Market Regime Metric Registry V1
- [x] native-frequency-aware refresh contract
- [x] release / stale / revision 基础语义
- [x] 第一轮官方数据源审计
- [x] 冻结 V1 数学定义：融资、成交、沪深300 PE、巴菲特指标、净供给、M2、社融
- [x] point-in-time percentile normalization baseline
- [x] missing-data / historical-era reweight 规则
- [x] policy correction ±5 cap
- [x] Profit Cycle 与 Structural Bubble 独立 overlay 架构
- [x] 预声明 Candidate A–D，避免无约束过拟合

下一步：

- [ ] Historical Data Availability & Backtest Dataset Design V1
- [ ] 确认各指标最早可靠历史日期与定义断点
- [ ] 为 PROBE_REQUIRED 指标执行 Source Probe
- [ ] 设计 point-in-time vintage 数据存储 / manifest
- [ ] 构建 2005–present 回测数据集
- [ ] 执行 Candidate A–D 回测与参数选择
- [ ] 公式版本锁定后才进入 Provider / Engine / UI 实现

当前 Stage 4.1 核心文档：

- `docs/market-regime/metric-registry-v1.md`
- `docs/market-regime/source-audit-v1.md`
- `docs/market-regime/formula-normalization-v1.md`
