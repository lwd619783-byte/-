# 中文化与证据展示降噪 · 2026-09-18

状态：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW。

基线：`origin/main = 01b246a25bbe304ceb9c121e92eb91bedbdcf478`；分支：`codex/chinese-ui-evidence-details`。普通 commit + push，停止于分支；不创建 PR、不 merge。此切片未声明 Hosted CI、独立审查或生产准入。

## 实现范围

- 复用 `src/utils/displayLabels.ts`，集中补齐状态、期间、单位、财务简称与审计显示词汇；`unknown` 显示“未确认”，未准入、缺失、过期、冲突分别保留。
- Evidence Drawer 默认展开可读摘要；Chart Audit 沿用来源入口，展开后优先显示数值、期间、来源机构、官方链接、完整性及使用限制。
- 新增共用 `AdvancedAuditDetails`。原始审计行、标题与范围、SHA-256、pins、内部 owner/metric/event ID、adapter、locator、raw row、schema/version、完整 observation JSON、F1/F3、纠正链及诊断均可展开核对。
- 行业事件从既有审计载荷提取显示字段；不选取新 owner、不推导修订、不改变冲突压制后的读数。原始载荷完整保留在高级区。
- Research Inbox、Industry Metric / Change、产业链结构与来源数据状态中文化；补齐首页、宏观、个股卡片/估值/财务、预期证据与表单的明显英文文案。保留机构/公司名称、股票代码和专业缩写；千桶仅翻译单位名称，不换算数值。
- 原始英文审计载荷有意保留；用户研究原文、固有名称及技术导入格式名称不作批量改写。

## 边界与验证

`src/services`、`src/data`、`src/types`、`config`、`contracts`、`local-core`、`public`、`research-data` 均无差异。无新数据请求、采集、写回或权限变化。公开可得时间、页面标注时间、观测期与采集时间保持区分；中文“尚未准入”不改变 admission。缺失不补零、冲突不消失、未知不升级。

| 验证 | 结果 |
| --- | --- |
| `npm test` | 72 files / 869 tests PASS |
| `npm run test:industry` | Python 8、Node 35、Vitest 73 PASS |
| `npm run build` | TypeScript、Local Core typecheck、Vite、bundle check PASS |
| `node scripts/chinese-ui-browser-check.mjs` | 508 checks PASS；0 runtime errors；无外部采集/下载 |
| 浏览器矩阵 | 320 / 390 / 1536px × neon / pro / light；EIA、NBS、事件证据、图表审计、Inbox full/empty/degraded；补充主要导航页烟雾检查 |
| 审计/只读回归 | 默认隐藏内部字段、展开后原值可见；官方链接保留、0 保留、原始对象不变、交互无业务存储写入、Escape 与焦点恢复 PASS |

浏览器复现：先构建并启动本地 `npm run preview -- --host 127.0.0.1`，设置 `UI_REVIEW_ORIGIN` 指向该预览；如未在项目安装 Playwright，令 `UI_REVIEW_PLAYWRIGHT_MODULE` 指向已有安装，再运行上述脚本。输出在 gitignored `data-cache/chinese-ui-browser/`（报告与18张截图）。本轮视觉检查覆盖专业深色320、明亮390、霓虹1536截图，未发现布局回归。

本轮不改变 runtime/data flow/architecture boundary，故未机械修改架构与战略文档。CURRENT 功能登记、执行索引同步本切片，并补齐已发生的基线 PR #61 merge/main CI 事实；旧审计记录不回写。

## 独立审计修复增量

输入：`main 01b246a25bbe304ceb9c121e92eb91bedbdcf478`，分支 `2fd51dba9b42fc99f7bf2b3415f5c831727edbec`；fetch 后均精确一致。状态：VERIFIED LOCALLY / PENDING INDEPENDENT RE-REVIEW。

- Industry Change 与 Inbox 共用的标题展示接入 `auditDisplayText`，该 formatter 同时用于证据摘要。EIA 显示“美国能源信息署（EIA）更新油运行业 2026-09-11 周末指标数据”；NBS/机器人中文标题保留。`IndustryChangeEvent.title`、`industrySignals.ts`、原始事件及 Provider 数据未修改；高级审计仍展示原始英文标题。
- `reviewTaskStatusDisplayLabel` 仅在复盘任务上下文将 pending 显示为“待处理”，其余三个状态沿用“已确认 / 已忽略 / 稍后处理”。全局 `statusDisplayLabel("pending")` 仍为“待核验”；底层任务未修改。
- 新增6项回归：EIA行业页/Inbox默认标题中文化、证据摘要中文化、原始标题折叠保留且展开可见；4种任务状态中文显示与原对象不变。既有NBS标题及全局pending测试继续通过。
- 相关5文件36 tests PASS；`npm test` 72文件875 tests PASS；`npm run build` PASS（TypeScript / Local Core typecheck / Vite / bundle check）。未运行数据生成，未重复无关浏览器矩阵；无Provider/Registry/Contract/PIT/Evidence owner/pins/原始数据差异。
- CURRENT仅追加本修复事实；原分支普通commit/push，不创建PR、不merge，等待独立复审。
