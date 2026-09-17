# Stage 4.1B / Slice 2 — Auditable Chart V1 + Product Shell V1

基线：`origin/main @ 63208ce038f5222d10bfa471bc5d0a868fe2905e`，开始前 fetch 已核对。功能分支：`codex/stage-4-1b-auditable-chart-shell-v1`。

**CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS。** 独立审计锁定 HEAD `88f97a56d44c3d512c00444f650000d60af89e40`；PR #52 的 Hosted CI `35201231930` completed/success；merge/main `753073912356de00504ba97c221c7ac1b7c8b81d`；main push CI `35201547659` completed/success。PRODUCTION / DATA ADMISSION 未提升，Stage 4.1B 尚未整体关闭。

## 合入与独立审计收口（2026-09-17）

- 独立审计结论：PASS；P0/P1 blocker=0。审计确认 Auditable Chart 为只读 presentation projection，Product Shell 不成为业务 owner，不新增第二套 Metric/Evidence/ResearchEvent/持久化模型。
- PR #52 以精确 audited HEAD `88f97a56d44c3d512c00444f650000d60af89e40` 合入；PR Hosted CI run `35201231930` completed/success。
- merge/main 为 `753073912356de00504ba97c221c7ac1b7c8b81d`；对应 main push CI run `35201547659` completed/success，完整 workflow 的 contracts、Local Core、Providers、Stage F/G、data audit、unit tests、test discovery 与 build/bundle gate 均通过。
- 本切片没有获得新的 `releaseAvailableAt`、严格 PIT、正式 report revision continuity、Evidence Graph closure 或 chart exact Evidence linkage 证明；价格/财务 owner 的 data/production admission 仍为 unknown，既有 NOT_ADMITTED/BLOCKED 状态不变。
- 本页后续“验证与证据”保留实现分支在 PR 前的本地验证事实；其中 committed `verification-summary.json` 的 `hostedCI: NOT_RUN` 是 pre-PR 时点记录，不回写历史。正式 PR/main CI 收口事实以本节为准。
- Slice 2 已收口；Stage 4.1B 继续后续 F3 Research Eval service harness / closeout，不因本切片合入而整体关闭。

## 审计与 adoption

检查实际组件及消费者后选择两个已有场景，没有增加图表：

| 场景 | 消费页面 | owner 与选择理由 |
| --- | --- | --- |
| `StockPriceHistoryChart` 收盘价折线 | 首页；公司研究概览、价格与估值 | 原 `PriceHistorySeries` 有点值/日期/quality，缺正式时间与证明字段，覆盖 unknown/fail-closed |
| `CompanyFinancialHistory` 分期三指标柱形图 | 公司经营与财务 | 原 `AShareFinancialData/FinancialReport` 提供单位、期间、来源、采集/生成、覆盖、派生等较完整 metadata；仍没有正式 release/revision/admission proof |

`MiniLineChart.tsx` 已不存在。当前 `Sparkline` 仅被 StockCard/StockQuickPreview 使用，保留轻量价格入口；宏观 MacroTab 是快照读数及“历史未接入”提示；EarningsExpectationCenter 有既有预期/实际值 SVG 对照及资格流程；行业/公司关系图是结构关系展示。这些本轮均不迁移，也不为了审计抽象强加新图。

Product Shell adoption：**首页、公司研究页的共享 ResearchHeader（五个章节及原 drawer presentation）**。展示 section、标题、当前公司/研究范围、原质量摘要及主要研究动作。首页切换价格对象同步 shell；公司切换章节同步上下文。原 navigation/deep link、主题、QuoteTrust、DashboardCard、Evidence Drawer、复盘 owner 沿用；App.tsx 无改动。

## Owner → audit metadata

`ChartAuditView` 只有临时展示行、状态列表和逐期展示记录。`chartAudit.ts` 是纯函数；`ChartPanel.audit` 插槽与 `ChartAuditPanel` 负责披露，没有 Registry、业务 storage、Provider 调用或新 schema。

| owner 字段 | 展示语义 / 限制 |
| --- | --- |
| `PriceHistorySeries.id/points/quality` | stock id 必须精确相同；`Stock.priceHistorySource` 保留原 owner 引用，points 与原 stock points 同引用；当前窗口仅接受 owner 原点引用子集。来源不再依赖 source/endpoint 正则猜测 |
| `PricePoint.date/close` | 原观测日期与收盘读数；仅已加载窗口有限值计数，不声称完整交易日覆盖；0 有效，null/非有限值缺失 |
| `quality.source/sourceEndpoint/sourceUrl/status/updatedAt` | 来源身份/endpoint、安全 HTTP(S)、原质量与“数据更新时间（非发布）”；status 不提升为 admission |
| `AShareFinancialData.id/stockCode/status/quality/schemaVersion` | id/code 对当前公司；report code/market 对所属 detail、scope 对当前选择，且须来自 owner 原 reports。dataset 与 report 的质量并列，不合并成“正常” |
| `reportPeriod/reportType/statementScope` | 报告期、报告类型与报表范围；singleQuarter/cumulative 使用原选择，不补月末/季末精确业务时刻 |
| `announcementDate` | 报告记录标注的发布日期；不是正式 releaseAvailableAt 证明 |
| `fetchedAt/generatedAt/sourceUpdatedAt` | 采集、生成、来源更新分别展示，互不填补，也不补 publication |
| `provider/sourceIdentifier/sourceUrl` | 原身份/来源记录/可安全打开的原 HTTP(S)；URL 不证明 retained bytes、PIT 或 graph closure |
| `currency/normalizedUnit/sourceUnit/normalizationFactor` | 原币种、单位与转换；原生频率仅能展示 reportType，不推断固定频率 |
| `status/fieldStatus/rawFieldCoverage/coreFieldCoverage` | 原状态与分母保留；图表另计当前三字段 finite coverage；冲突报告保留原始内容，绘图值为空 |
| `providerVersion/isRestated/isDerived/derivationMethod/sourcePeriods/auditStatus` | Provider 版本、重述标记、派生/公式/来源期与审计原值；Provider version 和重述标记均不充当 report revision |

报告、状态、字段状态键、来源期间排序确定；原 owner 不排序写回、不去重覆盖、不创建 Evidence/ResearchEvent。价格 owner 错公司时，图表和 stock module coverage 都拒绝该记录，避免空图却显示 real。

## Fail-closed matrix

| 条件 | 行为 |
| --- | --- |
| owner/身份缺失或不匹配 | owner metadata unknown；不借总体 dataQuality、其他公司/报告记录；没有精确 linkage |
| 0 / null / 非有限值 | 0 保留；null/NaN/Infinity 不计可用数值，财务图不绘制非有限值 |
| missing / partial / stale / conflicted | 原状态独立传播；数值缺失增加 missing/partial 提示，不覆盖 owner 状态；财务 conflict 不进入柱图 |
| parse 状态不存在 / freshness 不能证明 | unknown，不因 parse success、provider 名称或数值存在补“正常” |
| `releaseAvailableAt` / PIT / revision / graph 缺少正式字段 | 未提供 / 未证明；updated、acquired、报告期、URL 均不能补值 |
| data/production admission | 所选价格/财务 owner 没有正式 admission 字段，显示 unknown；不把 F1/F2 package 或 Macro NOT_ADMITTED 移植为这些 Provider 的准入事实 |
| NOT_ADMITTED / not_admitted 展示 | 通用展示层原样保留；浏览器状态样例仅在隔离 `ui-review=1&chart-audit-states=1` 显式开启，不注册或修改业务 owner |
| unsafe/含凭据 URL | 投影与 UI 均拒绝生成链接；原始报告的“查看来源”也复用原 Slice 1 安全规则 |

## Exact evidence linkage 边界

当前两类 chart owner 均没有可证明 metric/entity/revision 的正式证据引用，所以 **linkage=null，显示“当前图表没有可验证的 Evidence linkage”**，不显示图表 Evidence action。

现有 `financialReportToResearchEvent` 的 ID 为 `financial:${stock.id}:${report.reportPeriod}`，不能区分 statementScope、sourceIdentifier 或正式报告 revision。相同公司、期间、指标、数值或 URL 都不足以证明同一版本。财务 report 的 `providerVersion` 不是 report revision。价格 points 没有原生 Evidence/ResearchEvent pin。本轮不创造 matcher 所需的业务字段，不建立 F2 runtime。

Shell 的“公司相关证据”是独立的公司研究导航：只打开唯一 event ID 且 stockId/stockCode/market 全部匹配的当前 owner 事件，复用 Evidence Drawer；重复 ID、错公司/代码/市场拒绝。它没有声称图表 metric/revision linkage，页面有明确说明。可以选择已有事件再打开对应 event route 或公司工作流，不生成事件。

F1/F2/F3 直接相关约束来自 `contracts/financial-research/v1/README.md`、shared/binding/graph schema、relation-policy 和 `scripts/contracts/financial-research.mjs`。原 Entity/Metric/Evidence owners、immutable pin/revision/quality propagation 继续约束；冻结 F3 33-case roster 未修改，未实现 Agent/service harness。

## 验证与证据

以下为实现分支在 PR 前完成的本地检查，不等于 Hosted CI 或生产准入。正式 Hosted PR/main CI 收口见本文顶部“合入与独立审计收口”。没有 Provider refresh、依赖安装、治理文件改动。

| 验证 | 结果 |
| --- | --- |
| `npm test` | 60 files / 788 tests PASS；新增投影 27、UI/Shell 5、owner/coverage 1 |
| focused | 8 files / 89 tests PASS；投影、面板、Shell、原 Drawer/Home/navigation/Company/ui-review 均纳入正式测试；含输入顺序、0/null、时间分离、unsafe URL、错 entity/metric/revision 不借证据、无业务写入 |
| `npm run test:discovery` | PASS；保留 60 个正式 suite，负向对照重现 3 个 nested-checkout failure |
| `npm run data:audit -- --no-write` | PASS；P0=0、errors=0，24 warnings（P1=10 / P2=14）、10 skipped、35 allowlisted |
| `npm run build` | PASS；TypeScript / Local Core / Vite / bundle gate；保留 >500 kB chunk WARN |
| 其余 CI 离线 gates | 30 条命令全部 exit 0，见 [offline gates](stage-4-1b-slice-2/offline-gates.md)；catalog 构建到隔离 data-cache，同时验证 committed catalog，未覆盖 committed artifacts |
| `npm run ui:audit` | PASS；仅生成时间变化已恢复，不回写历史 audit |
| Impeccable pinned detector | PASS，changed targets 返回 `[]`；经项目 wrapper，未运行 updater/hooks/init |
| Slice 2 浏览器 | 1214 checks PASS、0 page errors；见 [browser validation](stage-4-1b-slice-2/browser-validation.json) |
| 原全站 UI / Slice 1 browser | 144 route/profile/width 组合 PASS；Slice 1 257 checks PASS |
| `git diff --check` | PASS |

浏览器使用已安装 Playwright + Edge；本机没有 agent-browser CLI，未安装工具。矩阵为 1536/1280/390/320 × full/empty/degraded × neon/pro/light，覆盖首页、公司财务、公司估值；核对审计展开、审计标签/数值/summary 三主题对比度 ≥4.5:1、完整 owner metadata、missing/unknown、合成 NOT_ADMITTED、公司相关 Evidence、焦点陷阱/Escape/恢复、上下文切换、event/company deep link、tooltip 与移动表格滚动、reduced-motion、零业务 storage writes/数据请求/downloads。公司“相关证据”首项可为预期事件，exact event 测试先显式选择目标事件再核对 route，不假设列表第一项。

代表截图：[桌面财务审计](stage-4-1b-slice-2/financial-audit-1536.png)、[手机财务审计](stage-4-1b-slice-2/financial-audit-390.png)、[320 退化价格](stage-4-1b-slice-2/price-degraded-320-light.png)、[隔离 NOT_ADMITTED](stage-4-1b-slice-2/synthetic-not-admitted-320.png)。Slice 2 报告内源码 digest 使用 UTF-8 / LF 归一，已对最终工作区核对，避免跨平台 CRLF 产生伪漂移。完整本地结果在忽略目录 `data-cache/stage-4-1b-slice-2/`，远端仅保留合成截图及按检查类别统计的精简验证记录（每项明细留在本地报告，可用脚本重放）。

UI 收尾：延续研究终端 tokens、密度与已有主题，审计默认折叠、逐期继续披露；原生 summary/button 支持键盘，无新动画。Impeccable scoped review：Accessibility 3/4（键盘/语义/焦点已测，未做全站 WCAG 认证）、Performance 3/4（无新依赖，既有大 chunk warning 保留）、Responsive 4/4（本轮矩阵内）、Theming 4/4（复用 tokens/三主题）、Integrity 4/4（detector 无命中），18/20；分数为本地有限范围质量评价，不是独立审计结论。React review 未引入 effect 数据加载、状态 owner 或持久化副作用。工具提示 PRODUCT context schema 较旧，但治理改动在本轮范围外，未修改 PRODUCT/DESIGN。

## 未实现与未证明

没有新 Provider/source acquisition、admission 提升、Market Regime 评分/normalization/backtest、F2 Graph runtime/Graph DB、Claim/Thesis、Portfolio、LocalStorage migration、MCP、F3 Agent/service harness、新 AI ranking 或 0–100 投资重要性评分；没有全站 App Shell 重写。

严格 `releaseAvailableAt`、PIT、正式 report revision/continuity、graph closure、chart exact evidence linkage 仍未证明；所选 owner 的 data/production admission 仍 unknown。原 Stage G/readiness、all-A D3 等 NOT_ADMITTED/BLOCKED 语义不变。离线 gates 的 readiness V2 仍 normalization/backtest 各 READY 0 / BLOCKED 23、identity resolved 0 / unresolved 23；canary positive replay 不提升全量准入。

## 变更文件索引

- 投影与 owner 接线：`src/services/chartAudit.ts`、`stockProvider.ts`、`src/types/index.ts`、`src/utils/stockCoverage.ts`、`evidenceUrl.ts`。
- UI：`src/components/charts/ChartAuditPanel.tsx`、`common/ChartPanel.tsx`、`layout/ProductShell.tsx`、`research/RelatedResearchEvidence.tsx`、`ResearchEventEvidence.tsx`、`home/HomePage.tsx`、`stock/StockPriceHistoryChart.tsx`、`CompanyFinancialHistory.tsx`、`StockDetailDrawer.tsx`。
- 测试/隔离验收：`src/services/chartAudit.test.ts`、`stockProvider.test.ts`、`src/components/charts/ChartAuditPanel.test.tsx`、`src/ui-review/ChartAuditStateReview.tsx`、`fixtures.ts`、`UiReviewApp.tsx`、`scripts/auditable-chart-browser-check.mjs`。
- 文档：feature registry、execution plan、architecture、本文及同名证据目录。冻结战略文件、App.tsx、package/lockfile、contracts、业务 Store/repository 均未修改。
