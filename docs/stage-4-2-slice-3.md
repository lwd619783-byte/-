# Stage 4.2 / Slice 3 — Freshness + Industry Signal/Event + Industry Chain Diagram

状态：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。2026-09-18。

开始前已执行 `git fetch origin`，确认 `origin/main = 086521d6bd305ea73cb5d4a426b9d4138e4a824b`，工作区干净；从该 SHA 创建 `codex/stage-4-2-slice-3-industry-events-chain-diagram`。本轮交付普通 push 后停止，不创建 PR、不合并、不提升 admission。

## 1. 获取结果与真实 delta

完整范围、逐公司 period/as-of、变化/未变化字段、失败与 artifact 清单见 [freshness delta](stage-4-2-slice-3-freshness.md)。机器人实际池为 **42 家上市公司（40 A + 2 H）与 1 家未上市研究线索**，不以 segment.stockIds 子集代替全部公司。

- NBS：官方最新仍为 **2026-08**；probe 返回 `LATEST_ALREADY_RETAINED`。官方原页 180835 bytes 与 retained SHA-256 `0f6d42bf7229268008f7970694d7295ec05cf0f509e23975daa36574651475e3` 一致。四读数保持 96174 套 / 34.6% / 729352 套 / 29.0%；没有新 capture，没有 9 月数据，没有两个 metric artifacts / Registry pins 的 diff。
- Robotics A 股财务：40 家 latestReportPeriod 从 2026-03-31 更新至 2026-06-30。行情、公告及公司指引详见上表链接；所有时间按原字段语义解释，不把脚本获取时钟当源报价 as-of。
- 用户指定 A/H 命令按现有完整 Universe 运行（56 A + 3 H），故同步的 artifact 包含其他行业；未改变池 membership、默认 refresh eligibility、Stability 或 admission。

`npm run data:probe:industry` 默认只读。读取官方 latest-release list，验证 HTTPS 官方 host/redirect、最大 body size、UTF-8、source/period/既有表头/两类官方列，比较 committed retained byte count/digest。返回 `LATEST_ALREADY_RETAINED` / `NEW_RELEASE_AVAILABLE` / `SOURCE_CHANGED` / `SOURCE_UNAVAILABLE`；同 period 改 bytes 不选新赢家。

显式 `--retain-new` 仅为经验证的新 period 创建独立 `nbs-capture.v1` 目录，以 exclusive mkdir/file creation 拒绝覆盖旧 raw；不修改旧 manifest、owner、Registry 或 F1。真实新 period 后仍须按现有 capture roster/owner/replay/Registry/F1/Evidence 体系同步两个 owner，本次无需执行。离线测试中的未来 period 是明确 synthetic fixture，不构成已发布数据。

## 2. Signal / Event 与已有 Inbox

`src/services/industrySignals.ts` 是 Registry 之后的 deterministic 只读投影，无额外 store/持久化/正式 ResearchEvent owner。正式 owner 指已登记 metric 的来源 owner，不等于生产或 PIT 准入。

| 层 | 当前数量 | 语义 |
| --- | ---: | --- |
| Registered metric | 2 | 绝对产量、官方原生同比 |
| DerivedIndustrySignal V1 | 2 | 每 metric 一个 latest retained period Signal，每个包含 monthly / year_to_date 两读数 |
| IndustryChangeEvent V1 | 1 | 同 source + period 的一次 release 汇总 |
| Event readings | 4 | 96174、729352、34.6、29.0，分别保留单位与口径 |

当前标题“国家统计局更新工业机器人 8 月产量数据”。输入携带 definition/artifact/binding/policy pins、原 observation IDs/records、period/asOf、transform version、DataQuality 与原 EvidenceRef；asOf 明示为观测期间。绝对当月差额沿用两相邻留存值 `96174 - 98677 = -2503`，保存两个 operands；累计与 official YoY 均无 delta，未解释成环比、景气改善或方向信号。

同 release 聚合与排序不依赖输入顺序；相同重复事件 no-op；同 ID 不同内容合并为一个 `conflicted` 事件并清空显示值/delta、保留原始输入。foreign/重复 owner fail closed，无 owner 的行业不生成事件。missing / partial / stale / unknown / not_admitted 传播；原始冲突值只在证据核对中保留。`releaseAvailableAt=null` 未以 publication、acquiredAt、generatedAt 或 period 替代。

接线：App 真实/混合模式 → Registry → Signal/Event → 原 Research Inbox → 原 EvidenceDrawer / Industry deep link → robotics Industry → Metric / Evidence。Inbox 使用页面标注 publication 日期筛选近 30 天，并明确该日期不是公开可得时间；unknown 日期只在全部日期中显示。UI review 独立 fixture 入口不载入此 runtime，无行情/旧 qualitative fallback。

## 3. Diagram Design 与 topology 依据

实际使用 `.agents/skills/diagram-design/SKILL.md`，遵守 `docs/agent-skills.md` §4 Diagram Design 对默认 style-guide、局部输出、无 home profile/字体下载/全局 design 改动的边界。采用三阶段分组流向布局（tier/connection 视觉语法）：桌面 `fit` 横向、窄屏纵向；概览只含 3 个阶段节点与 2 条直角/直线连接，20 条既有环节文字全部保留。公司明细采用阶段折叠，不把 43 家公司强行画成概览节点。

图表使用 Skill 默认 paper/ink/muted/accent tokens，局部固定浅色图纸置于三种既有主题中；无新字体依赖，使用本机 `Microsoft YaHei` / sans-serif fallback，不声称已安装 Geist / Instrument Serif。Accessible SVG 的 title/desc/marker ID 分别带 React useId 与 responsive variant 前缀，4px 布局网格、≤2 accent、无阴影/发光/动画。供人工离线审查的自包含 [HTML](stage-4-2-slice-3/robotics-chain.html) 从实际图表 DOM 导出，保持当前结构；交互明细仍在原 Industry 页面。

| 字段/关系 | 事实来源 | 性质与限制 |
| --- | --- | --- |
| 上游 → 中游 → 下游、环节文字 | `src/data/industries.ts` 的 robotics `chain` 原顺序/条目 | Structure / Research Context；非资金流/收入权重/直接供货关系 |
| 公司挂接 | `src/data/stocks.ts` 的 `chainPosition` 含原 `chain.items` 字面；未上市明确 stage | Research Context；不做同义推断/默认中游，跨环节匹配完整保留 |
| segment navigation | exact `industryId + segmentId` | 复用既有 selection/deep link，无按名称或近似 ID 路由 |
| 公司名称、ticker、A/H、既有核验标签 | 既有研究池记录；`src/data/privateCompanies.ts` | 原 Research Context；原“已验证”等标签不升级为 Provider admission |
| 市值 | exact-ID `StockQuote.marketCap`，仅原合法数值状态 | Provider Fact；0 保留；缺失/mock/conflicted/unknown 不用 qualitative financial 补值 |
| 行情获取/更新时间 | 原 quote.updatedAt | Provider 采集时钟；exchange quote as-of 未留存即 unknown |
| 最新留存报告期、公告日期 | exact-ID/code 原 Financial/Announcement owner | Provider Fact；各自状态/source 保留，不互相替代时间 |

`industryChainTopology()` 与 `industryCompanyOverlay()` 分离；前者显式丢弃动态字段，报价更新不可能改变 topology。现有位置字面匹配产生上游 25、中游 4、下游 5 次公司挂接（含跨阶段重复），**12 家位置待映射**单列，不猜位置；无 chain 时显示 unavailable。公司节点复用 Stock drawer；private lead 保留未上市与 Provider unavailable。

## 4. 验证

| 检查 | 结果 |
| --- | --- |
| Acquisition 专项 | 8 tests PASS；no-op、新目录、不覆盖、revision/source-change、非官方/redirect、缺失与损坏 |
| `npm run test:industry` | 8 Python + 28 Node + 60 Vitest PASS |
| `npm run data:validate:industry` | PASS；2 owners、7 captures、各13 observations、F1 binding VALID / NOT_READY |
| `npm run contracts:validate` / `test:contracts` | PASS；冻结合同未改 |
| `npm run data:validate:semantic-bindings` | PASS；28 bindings |
| F3 `test:research-eval` / `research:eval:check` | PASS；reference 33/33，actual service 0/33，未修改 F3 |
| `npm run test:discovery` | PASS |
| Browser | **141 checks PASS / 0 runtime errors**；3 themes × 1536/390/320；15 张截图及[机器报告](stage-4-2-slice-3/browser-report.json) |
| `npm test` | **840/840 PASS，67 files**；包含原 UI review 隔离 |
| `npm run build` | PASS；Local Core boundary / financial bundle budgets PASS；保留大 chunk warning |
| `npm run data:audit` | PASS；0 errors / 26 warnings |
| Company refresh validators | 全部 PASS；综合 0 errors / 1 warning；专用财务56/56；公告32 partial；guidance61 snapshots |
| Diagram Skill self-check | PASS；自包含 HTML 的 accessibility / safety 检查 |

全量 Vitest 首轮 839 PASS / 1 FAIL：旧 provider 测试固定报告期 2026-03-31，真实刷新后为 2026-06-30。仅将该精确快照期望更新至实际新 artifact，保留56公司与summary-only断言；该测试重跑 PASS。最终 840/840 全量 PASS。公司指引测试的静态 workflow bytes/hash 同步本次真实 artifact；data audit 的原 15/56 静态快照断言更新为已完整核验的 16/61，仍使用精确相等校验，未放宽任何完整性门禁。

专项还覆盖 exact company/segment deep link、foreign owner、duplicate/conflict、无结构 unavailable、YoY 无 delta、unknown releaseAvailableAt、零值、页面/抽屉无水平溢出、Evidence focus/Escape 与图表流程无业务存储写入。截图过程仅临时隐藏 fixed 移动导航，避免长元素截图把导航烙在图中央；页面与导航验收使用未修改 UI。

## 5. 边界、warnings 与停止点

- 数据/生产 `NOT_ADMITTED`、PIT `UNPROVED`、revision continuity `unknown`、Entity unresolved、F1 `NOT_READY`、F3 actual service 0/33 不变；本轮不是这些问题的 closure。
- 已留存窗口仍存在1—2月当月值缺失；历史 coverage partial。事件是一次官方留存来源变化核对，不是实时新闻承诺。
- 公司行情/财务/公告的 partial/unavailable 与生成器 epoch 限制按 [freshness delta](stage-4-2-slice-3-freshness.md) 逐项记录；不得把脚本 exit 0 等同完整 fresh coverage。
- Scope Freeze：无第三个正式 metric、Prosperity Score / Regime、AI Claim / Thesis、外部新行业源、Admission/PIT/Entity closure、F3 service、Portfolio/MCP/Agent 或 UI V2 redesign。
- CURRENT 同步 feature-registry / execution plan / architecture，并补齐 Slice 2 已发生的 PR #58 与 main CI 事实；战略顺序未改，未机械修改 roadmap；历史审计文件未回写。
- 本轮 source 获取错误已恢复，无未解决 implementation blocker；保留的限制包括公告解析 partial、unknown 源报价时间、研究位置待映射与上述准入未证明。
- 本分支待独立审计。Hosted CI **NOT_RUN**；没有本轮 PR、merge、生产准入声称。

人工审查入口：[桌面产业链](stage-4-2-slice-3/chain-neon-1536.png)、[390 纵向图](stage-4-2-slice-3/chain-light-390.png)、[320 Provider overlay](stage-4-2-slice-3/overlay-pro-320.png)、[最新变化](stage-4-2-slice-3/event-neon-1536.png)。
