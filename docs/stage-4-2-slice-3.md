# Stage 4.2 / Slice 3 — Freshness + Industry Signal/Event + Industry Chain Diagram

## 2026-09-18 简化结构图 · CURRENT

根据用户最新反馈，默认画布只呈现上中下游、细分方向与阶段衔接；覆盖几家、代表股票、报告期、公告和研究定位全部收入**点击细分名称展开的下拉详情**。这覆盖上一版“默认展示公司标签/Provider覆盖”的视觉要求。未改变既有stage/segment归属：仍3组、10节点（7unique），12家待映射保持折叠。机器人组标题“核心零部件 / 模组与系统集成 / 整机与应用场景”是既有chain条目的研究层概括，箭头不新增供应/客户关系。

继续沿用已读 `diagram-design` 的 Architecture 分组规则；不叠加Skills、不改主题系统。公司精确导航、Unitree上市身份、Provider状态与时间边界保留在展开区。原始阶段构成、图谱说明也默认折叠；页面不再默认显示公司/节点数量。桌面图高≤820px，移动端纵向；所有summary可键盘操作。数据、cohort57、Stability门槛与admission完全未改。

验证：22项相关Vitest PASS；build/类型检查/预算PASS（已有大chunk warning）；三主题×1536/390/320共**298 browser checks / 22 screenshots / 0 runtime errors**，包括默认零可见股票/覆盖层、细分键盘展开/收起、exact company/segment导航与Inbox/Evidence回归。此小范围UI增量未重跑无变更的Provider实时获取/全套observability；上一轮全量结果仅代表对应输入时点。

[桌面简图](stage-4-2-slice-3/simple-chain/chain-neon-1536.png) · [light桌面](stage-4-2-slice-3/simple-chain/chain-light-1536.png) · [390纵向](stage-4-2-slice-3/simple-chain/chain-light-390.png) · [展开明细](stage-4-2-slice-3/simple-chain/segment-expanded-neon-1536.png) · [浏览器报告](stage-4-2-slice-3/simple-chain/browser-report.json)。普通push后核验新Final SHA对应Vercel Preview；既有Vercel登录保护保持，不以匿名远端UI矩阵为PASS。等待独立审阅，无PR/merge/admission提升。

---

## 上一版结构图与cohort修复记录（历史 a0c1f64）

**IMPLEMENTED / VERIFIED LOCALLY / PENDING THIRD INDEPENDENT REVIEW**。输入 `a1a4be2a6d126866eac00c1fc693ac6608728d28`；fetch 后本地/远端相等、main `086521d6bd305ea73cb5d4a426b9d4138e4a824b`、ahead 2 / behind 0、clean。只修 Segment 架构图与 Provider Stability cohort P1；下方第二次审计前记录及截图保留原时点。

### Segment-node Architecture Canvas

实际使用 `.agents/skills/diagram-design/SKILL.md`，按 `docs/agent-skills.md` 边界读取 style-guide 与 Architecture type reference。用户 MCO Runtime Architecture 图片**只作为 Visual Reference**，吸收画布网格、分组边界、节点层次与主轴；没有引入图中业务内容，没有调用 Archify、profile/updater，也没有修改全局设计系统。React/CSS runtime 复用原 Industry 页与 deep links；使用现有字体与三主题 tokens，不以静态 PNG/SVG 替代交互。Diagram Design 的独立 SVG helper 不适用此 React 交付；可访问性与布局由浏览器验收，不声称 SVG-only 检查 PASS。

- **3 Stage Groups → 10 Segment Nodes（7 个 unique segments）→ 公司标签 / 展开明细**。上游6、中游3、下游1节点；三组分别复用 `--ui-accent` / `--ui-secondary` / `--ui-warning`。细网格、边界、2条水平主轴箭头，移动端切换纵轴；不添加 company-to-company 关系。10个节点按已有分组完整保留，公司明细折叠控制密度，不为满足 Skill 默认9节点建议而删掉真实映射。
- 节点一级为 segment 名称、研究定位摘要（完整原文在展开区）、研究数量/验证标签；代表公司按原研究池顺序显示前3家，其余标 `+N`。股票涨幅、市值不参与排序、分组、定位。
- Provider 层独立显示行情/财务/公告**有留存**覆盖、逐状态数量与最新留存报告期。分母包含全部节点公司，缺失/H股能力限制不被剔除；`partial/stale/missing/conflicted` 不折叠为已验证。可键盘展开全部公司，再查看 exact owner 的日期/source/市值/unknown as-of。没有新增 Provider 数据或评分。
- topology 仍只来自 `Industry.chain`、exact `segmentId`、`company.chainPosition` 及既有 research context；25/4/5次公司挂接、12家位置待映射均不变。后者在画布外单列公司/细分/原位置/验证状态，明确“未自动分配 stage”。无可用结构时仍 unavailable。
- Unitree 仍位于**下游 → robot-oem（本体整机）→ 宇树科技标签**，`unitree / 688836.SH / A股 / SH / 科创板 / 2026-08-19`，当前不出现 private/待上市状态；上市正式来源和原历史 evidence 保留。当前研究验证等级仍“部分验证”。
- Structure / Research Context 与 Provider Fact 分层保持；箭头只表示产业结构阅读方向，不表示直接供货、收入权重或资金流向。Listing Context 来自此前 reviewed SSE identity，不填回 Provider profile.listDate。

### Stability cohort P1

`config/provider-stability-gate-v1.json.expectedCompanies=57` 作为受控分母。`expected_company_cohort()` 同时核验 current generated A-share universe 的数量、唯一非空 IDs；financial/announcement production validators 与 observation 都使用该函数，同数量 foreign 替换亦被原 artifact exact-ID validators 拒绝。data-audit 移除旧硬编码56断言，改为配置对照 generated universe；历史56 ledger/fixtures不回写。

离线回放真实留存 artifacts：两个 Provider 57/57均可成为 complete coverage candidate；56/57、58、foreign identity 均 fail closed，旧56 provenance cohort不得借用。**候选完整不等于已达到稳定准入**。minimumDistinctDays=5、minimumRunsPerProvider=10、minimumSuccessfulDaysPerProvider=5、minimumCompleteSuccessRate=.9、minimumTotalSuccessRate=.95、requireLatestSuccess=true 全部不变；provenance、clean worktree、atomicity机制未改。

当前 production validators PASS，health `insufficient_observation_window`，观察0日/0runs，strict eligibility exit2；没有自动启用 financial/announcement 默认刷新，没有提高 admission。[health](stage-4-2-slice-3/segment-architecture/provider-health.json)、[cohort/unchanged-data delta](stage-4-2-slice-3/segment-architecture/remediation-delta.json)。Company Guidance cross-epoch P2 本轮未修。

### 最终验证与审阅入口

| Gate | 实际结果 |
| --- | --- |
| Provider observability | 261 Python PASS（含双Provider57/56/58/foreign与旧cohort回放） |
| data-audit tests | 54 PASS（在full tests中） |
| Listing / targeted A refresh | 14 Python + 6 Vitest / 7 Python PASS；未重新请求真实Provider |
| Industry | 8 Python + 28 Node + 62 Vitest PASS |
| Full tests / discovery | 851 tests / 69 files PASS；69 suites discovery PASS |
| financial / announcement / guidance validators | PASS；guidance generator `--check` PASS |
| data audit | 0 errors / 26 warnings（P1 12、P2 14），非新增准入 |
| build | PASS，Local Core typecheck / bundle预算 PASS；已有大chunk warning |
| browser | 277 checks / 22 screenshots / 0 runtime errors，neon/pro/light × 1536/390/320 |

Browser [report](stage-4-2-slice-3/segment-architecture/browser-report.json) 明确记录 `segment-node architecture`、`colored stage grouping`、`architecture-canvas visual hierarchy`、`Unitree exact listed identity`、`no company-card-as-primary-node`、`no guessed placement`、`no overflow`、`no runtime errors`；也覆盖keyboard focus/Enter、exact company/segment navigation、Evidence、Inbox→Industry→Chain及无业务存储写入。报告内 source digests 绑定源码；使用现有 isolated Playwright/Edge，无新增安装。

人工入口：[neon桌面](stage-4-2-slice-3/segment-architecture/chain-neon-1536.png)、[pro桌面](stage-4-2-slice-3/segment-architecture/chain-pro-1536.png)、[light桌面](stage-4-2-slice-3/segment-architecture/chain-light-1536.png)、[390纵向](stage-4-2-slice-3/segment-architecture/chain-light-390.png)、[320纵向](stage-4-2-slice-3/segment-architecture/chain-pro-320.png)、[完整Segment展开](stage-4-2-slice-3/segment-architecture/segment-expanded-neon-1536.png)、[宇树320明细](stage-4-2-slice-3/segment-architecture/unitree-pro-320.png)、[Inbox路径](stage-4-2-slice-3/segment-architecture/inbox-to-chain.png)、[静态审阅HTML](stage-4-2-slice-3/segment-architecture/robotics-chain.html)。静态HTML禁用应用导航，交互路由以runtime为准。

已确认现有 Vercel Git integration 绑定该项目/分支；本次普通 push 后在最终交付回复核验并提供 **Final SHA 对应 immutable Vercel deployment URL**（不把旧部署或localhost记为最终Preview）。Hosted GitHub CI 尚未运行，不能以本地PASS或Vercel build替代；无PR/merge。push后等待第三次独立审计。

数据与风险：本轮所有真实数据 artifacts 对输入a1a4be2无diff，NBS保留最新2026-08及前次`LATEST_ALREADY_RETAINED`结论，未重新probe/新capture；2 Signal→1 Event→4 readings、YoY no-delta、releaseAvailableAt unknown不变。12家位置未映射、32家公司公告partial、Unitree profile.listDate/PS/dividendYield/guidance缺失继续诚实呈现；Guidance cross-epoch P2仍保留。PIT/Provider/F1/F3/admission均未升级。

---

## 第二次审计输入交付记录（历史 a1a4be2）

**IMPLEMENTED / VERIFIED LOCALLY / PENDING SECOND INDEPENDENT REVIEW**。输入为已审计 `3edd80f228a2422a917f92f9e5d112b436f3fd84`；开始前 fetch 确认远端功能分支仍为该 SHA，`origin/main` 仍为 `086521d6bd305ea73cb5d4a426b9d4138e4a824b`。以下增量纠正旧实现；后文原交付记录及旧截图保留为历史证据，不代表当前 UI 或实际上市状态。

### 上市身份与只读 reconciliation

- 已独立获取[上交所正式上市公告](https://www.sse.com.cn/disclosure/announcement/listing/ipo/c/c_20260818_10829204.shtml)：宇树科技股份有限公司，证券简称宇树科技，`688836.SH`，科创板，2026-08-19 上市。27,651 原始 bytes 与 SHA-256 `8c831ef39ccb5216e113a80ae351a065ee2b1e2ec3efdc96bf3ce38be5763d64` 留存在 `config/listing-status/retained/`。
- `unitree` identity 不变，迁入 listed stock/symbol seeds、退出当前 private 集。当前 Universe **60 = 57 A + 3 H**，robotics **43 = 41 A + 2 H**，private **0**。旧记录的“宇树未上市”是需纠正的静态身份错误，不能解释为 2026-09-18 当时真实未上市。
- 原产品/IPO claims、原状态及未记录 source date 的事实保存在 `unitreeHistoricalResearch.ts`；当前证据明确标为迁移前 pre-IPO 研究原文，不能据此证明历史观察时点。当前 thesis、risk、tracking 不再以 IPO 为未来催化。
- `npm run data:probe:listing` 默认只读当前 private/pre-IPO 集，不写 Universe、不扫描全市场、不新建 Entity Registry。五状态为 `UNCHANGED_PRIVATE / IPO_IN_PROGRESS / LISTED_MIGRATION_REQUIRED / IDENTITY_CONFLICT / SOURCE_UNAVAILABLE`；exact legalName/code/exchange/listingDate 验证、官方 HTTPS/redirect、结构/身份歧义均 fail closed。
- [Live baseline](stage-4-2-slice-3/remediation/listing-probe-live.json) 与[原始 bytes replay](stage-4-2-slice-3/remediation/listing-probe-replay.json) 均检测旧 private Unitree 为 `LISTED_MIGRATION_REQUIRED`；[当前模式](stage-4-2-slice-3/remediation/listing-probe-current.json) 因 private 集为空返回 0 条，不重复告警。V1 仅解析显式配置的 SSE 科创板公告，未来其他 tracked entity 无 reviewed source 时 unavailable，不承诺自动 IPO 搜索。

### 产业链全景与事实边界

主要使用 `.agents/skills/diagram-design/SKILL.md`，读取 `docs/agent-skills.md` 对应边界及 style-guide / 分组流向参考；未运行 Archify、updater、profiles 或外部服务。按本轮明确要求，将图表局部语义色映射至现有三主题 tokens；未修改主题系统、字体、Skill 治理。

桌面以连续主轴、阶段背景区、**10 个 exact stage/segment groups** 与 10 个直接可见代表公司挂接组成全景（跨阶段公司重复，非 unique 公司统计）；其余 24 次公司挂接按原顺序展开。上游采用双列细分，中/下游单列，所有七类既有 robotics segment 均可直接识别。宇树上市节点局部强调，展示 `688836.SH · A股 / 科创板`；市值与财报/公告状态在节点上，完整日期/source/unknown as-of/上市原公告在可键盘展开的明细中。没有公司供应链连线，也没有按市值排名或重定位。390/320 改成纵向 stage → segment → company。

保留 `industryChainTopology()` 原规则和全部源条目：上游25/中游4/下游5次挂接、12家待映射不变。未定位公司仍单列原位置与 exact segment，不能为图形完整性补位置。公司/segment 按原 identity 导航。`officialListingContext()` 只呈现人工核验的交易所身份映射，严格匹配 stock 与唯一 symbol；不替代 Provider profile.listDate，不充作通用 Entity owner。

| 展示信息 | 来源与性质 |
| --- | --- |
| stage/segment/company position、research verification | 原 Industry.chain、segmentId、chainPosition 与研究标签；仍为 Research Context |
| Unitree code/exchange/board/listing date | 上交所正式披露 + reviewed mapping；历史上市身份事实，非研究判断、非 PIT 准入 |
| quote/marketCap/report period/announcement date/status | exact 原 Provider owner；实时字段只覆盖节点，不进入 topology |

Provider 获取结果与额外发现的腾讯市值映射、公告历史保留修复见 [CURRENT freshness delta](stage-4-2-slice-3-freshness.md)。NBS raw/两个 owner/Registry pins、2 Signal → 1 Event / 4 readings、Inbox/Evidence、YoY no-delta、unknown releaseAvailableAt 均未改变。

### 本轮验证与人工入口

- `test:listing`：14 Python + 6 Vitest PASS；targeted quote/raw replay：7 Python PASS；announcement：27 Python PASS；guidance Node：173 PASS。
- Industry：8 Python + 28 Node + 60 Vitest PASS；Registry/F1 retained replay PASS，仍 `NOT_READY / NOT_ADMITTED`。
- Full Vitest：846 tests / 69 files PASS；build、Local Core 类型边界、bundle budgets PASS；保留大 chunk warning。56→57 的 artifact 数量断言按实际 Universe 更新为严格57，未放宽比较或预算。
- 综合行情/财务/公告/guidance validators 与 guidance `--check` PASS；数据审计 0 errors / 26 warnings；综合行情 validator 1 warning（既有凯迪股份高 PE）。默认 refresh eligibility **BLOCKED**：冻结 expectedCompanies=56 vs 当前57，且无观察 runs；配置和 admission 不变。
- 浏览器 **223 checks / 0 runtime errors**，三主题 × 1536/390/320；19 张截图，[报告](stage-4-2-slice-3/remediation/browser-report.json)。覆盖节点直接可见、精确 Unitree/company/segment 路由、Evidence、Inbox → Industry → Chain、keyboard focus/展开、reduced motion、无横向溢出及无业务存储写入。
- 本轮交付是结构化 React/HTML，旧 Skill SVG-only self-check 不适用：它报告“缺 accessible SVG”和正式 SSE 外链（其单图规则禁止 remote href）。未修改/放宽该脚本，也不声称此检查 PASS；实际可访问性、链接、布局由上列浏览器断言与截图验收。

人工入口：[桌面全景](stage-4-2-slice-3/remediation/chain-neon-1536.png)、[light全景](stage-4-2-slice-3/remediation/chain-light-1536.png)、[390纵向图](stage-4-2-slice-3/remediation/chain-light-390.png)、[320宇树明细](stage-4-2-slice-3/remediation/unitree-pro-320.png)、[Inbox导航](stage-4-2-slice-3/remediation/inbox-to-chain.png)、[自包含静态审阅HTML](stage-4-2-slice-3/remediation/robotics-chain.html)。本地应用 Preview：`http://127.0.0.1:4173/#/industry?industry=robotics&segment=__all__`，产业链 tab 复用原页面。

Remaining：Unitree profile.listDate、PS/dividendYield 缺失，guidance missing；32家公司公告 partial，12家研究位置待映射；Guidance cross-epoch 自动刷新 seam 仍是 non-blocking operational gap。本轮使用旧 epoch 精确验证 + 现有 staged transaction 完成，不重构 P2。上市事实不提升公司研究、Provider admission 或 PIT。普通 commit/push 后等待第二次独立审计；本轮 Hosted CI NOT_RUN，无 PR/merge。

---

## 原始 Slice 3 交付记录（3edd80f 时点，已由上述 remediation 纠正当前身份与视觉）

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
