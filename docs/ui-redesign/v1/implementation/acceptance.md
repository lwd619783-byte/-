# NEON-RC1-20260909 · UI V1.0 实现验收

输入基线：`473289db6da79db5be892015bffc2c75b964abcb`。开始前已 fetch 并核对真实 origin/main 完全相等，交付前再次核对远端。分支为 `codex/ui-v1-full-implementation-ultra`。本次用户明确授权 D1–D5 在同一分支持续实施、分别提交并普通 push；未授权 PR、合并或部署。

验收对象为本报告所在的 D5 提交。运行时报告中的 `headSha` 如为 `d7590aa8f676bfd39ef1026397b25148d66281c6`，表示运行当时 D4 HEAD 加 D5 工作树，不能当成 D4 原代码的验收。最终 `data-cache/ui-v1-acceptance/final-git.json` 与 `evidence-manifest.json` 绑定最终提交、实际测试源文件 blob、构建产物及证据摘要；没有在本文件编造自引用提交 SHA。

实现完成，已发现的本票阻断/高优先问题已修复。环境及现有 bundle 告警保留；通过本次 UI 验收不等于 Provider 生产准入或批准合并。冻结设计文档保持原状，本报告记录实现与运行结果。

## 实现与迁移

- 一个七入口外壳及公司研究组件树，默认 C 霓虹科技；A 深色专业、B 明亮简洁仅改变展示 token。外观使用独立偏好键。
- 个股池默认研究表格，窄屏显示卡片及可展开的筛选摘要；轻预览不加载完整公司历史。完整研究分为研究概览、经营与财务、价格与估值、预期与验证、证据与复盘，返回保持池内上下文。
- 首页由既有任务/事件/观察项组成；宏观保留九分类和全部快照/时间语义；行业区分池内比较、链条和未上市线索。
- 观察清单主从布局、验证中心三视图、预期证据比较/审计/导入历史，以及元数据、复盘、预期、导入、备份表单共用视觉与焦点规则；业务回调、历史和 validator 保留。
- [M01–M56 核对](migration-audit.md)共 56 项，全部有具体去向，无静默删除。源码核对与下述运行验证分开记录。F01–F04 已修复：正数正号、未知来源不误标 mock、两项信号原文独立展示、股本零值不当缺失。

## 实际门禁

本节日志均位于 `data-cache/ui-v1-acceptance/`，为本地验收证据，不进入生产 bundle。focused 的范围/每个测试文件及数量在对应日志中保留。

| 执行项 | 结果 | 证据 |
| --- | --- | --- |
| D1 layout/common/charts focused | PASS，7 文件 / 36 测试 | `d1-focused.log` |
| D1 Header focused | PASS，1 / 8 | `d1-header.log` |
| D2 stock/navigation/expectation/watchlist focused | PASS，9 / 84 | `d2-focused.log` |
| D2 navigation/modal focused | PASS，2 / 15 | `d2-nav-modal.log` |
| D3 Home/Macro/Industry/Company/navigation focused | PASS，5 / 45 | `d3-focused.log` |
| D3 Home focused | PASS，1 / 9 | `d3-home.log` |
| D4 review/expectation/provider/store/repository focused | PASS，13 / 289 | `d4-focused.log` |
| D4 forms/repository focused | PASS，5 / 123 | `d4-forms.log` |
| D4 最后观察流程补查 | PASS，5 / 43；并被终局完整测试覆盖 | [checkpoint 记录](checkpoints.md) |
| D5 CompanyResearch + ChartSemantics focused | PASS，2 / 15 | `d5-focused.log` |
| 完整 `npm test` | PASS，54 文件 / 720 测试，无缩小 discovery 范围 | `final-full-test.log` |
| `npm run build` | PASS，含 `tsc -b`、Local Core typecheck、Vite、bundle gate；保留 >500 kB chunk WARN | `final-build.log`；另有 baseline/D2/D3/D4 build 日志 |
| `npm run ui:audit` | 命令 PASS；静态扫描无已列高风险旧色类，不声称该命令执行浏览器验收 | `final-ui-audit.log`、`docs/ui-display-audit-report.md` |
| `npm run data:audit` | PASS，P0=0、P1=10、P2=14、errors=0、warnings=24 | `final-data-audit.log`、`docs/data-audit-v1.md` |
| `npm run data:validate:expectations:company-guidance` | PASS，既有数据 checksum/尺寸验证 | `final-guidance-integrity.log` |
| `npm run env:check` | READY WITH WARNINGS，提交前 48 PASS / 10 WARN / 0 FAIL / 4 SKIP，退出 0 | `final-env-check.log` |
| `npm run --silent env:check:json` | READY WITH WARNINGS，同上；JSON 可解析 | `final-env-check.json` |
| Impeccable 项目 wrapper `context` | PASS，使用已固定版本；未 init、升级或安装服务 | 本轮工具记录；只应用质量收尾路由 |
| `git diff --check` | PASS | 交付检查及 `final-git.json` |

早期失败已闭环：D2 最后测试选择器的 TypeScript 参数错误在 D3 正常提交修复，未重写已推送历史；D5 首次完整测试仍断言旧的“60 日价格走势”标题，改为真实可变区间标题后完整 720 项通过；D5 初次 data audit 找到正号表达式中的 `?? 0`，改用显式 number 检查后 P0 清零。没有放宽类型、validator、数据审计、bundle 或环境门禁。

环境 WARN 涉及多个 Node/Git 安装路径、4 项 Python 未固定依赖、pip check、未提交状态、部分 ignore 覆盖、gh 未登录、旧 schemaVersion、30 个公告 partial 与旧聚合物。提交后的只读环境复检单独记录于 `postcommit-env-check.log/json`；它仅消除本票工作树未提交 WARN，其他 WARN 不升级为 PASS。

## 浏览器证据与方法

Chromium 151.0.7922.34，项目现有 Vite 与本机已配备 Playwright runtime；未增加项目依赖。各脚本创建隔离浏览器存储，synthetic 内容明确标注；没有读写真实用户浏览器配置。

| 证据组 | 实际验证 |
| --- | --- |
| `matrix-summary.json`、`matrix-results.json`、32 张 `matrix-*.png` | 八页 × 三主题 1600×1000；八页霓虹 390×844。固定浏览器时点 2026-09-09 12:00 +08:00、空用户存储、仓库 Mixed 数据。每图有主题/视口/采集时点/SHA256。三主题业务文本、顺序、几何、存储相同，额外数据请求 0。 |
| `matrix-stock-interactions.json` | 390px 展开池筛选→港股/PE→收起→三主题→清除；条件摘要与公司结果正确。 |
| `d2-browser.json`、`d2-responsive.json` | 序列 A：筛选/排序→预览→Escape 原行焦点→完整公司→财务→主题→浏览器后退。筛选、排序、滚动、公司行焦点恢复；非法公司深链明确为空。 |
| `d3-browser.json` | 首页/宏观/行业三主题；行业→公司→返回、细分上下文、未上市线索可达；390/320px。 |
| `d4-browser.json` | 序列 B：synthetic 观察项→半填复盘→三主题→取消关闭及后退→继续提交一次；存储不被主题改写，追加一次 before/after 历史。无效导入保留输入并禁写；A/B 390px 导入截图。 |
| `provider-browser.json`、`provider-conflict-export.json`、11 张 `provider-*.png` | 序列 C/D 及单公司失败，共 9 项 PASS。官方事件/提醒各 4→0，本地仍可用；冲突可见且排除比较，实际导出等于本地输入；局部 35 成功/1 失败→重试 36/0，成功公司不重复请求。 |
| `late-browser.json`、10 张 `late-*.png`、损坏记录导出 | 5 项 PASS：A→B 与关闭后的财务/公告迟到响应；非法偏好/合法重载；外观写入失败的会话回退；损坏观察清单原始 85 bytes 真实下载一致，业务键零写入。 |
| `edge-results.json`、`edge-*.png`、`edge-export-*.json` | 序列 E：空价、单点、null 缺口、负值/大数、20 点范围、财务负值/零/缺值、长混排港股未知来源。7 场景 × 三主题，7 场景 320px；测试输入保持不变并经浏览器下载比对。测试 harness 导出输入用于验证，不宣称产品新增价格导出能力。 |
| `access-results.json`、`access-*.png` | 八页 320px；八页 HTML 实际字号/行高乘 2；800px 放大文字表单可输入/取消且 footer 可见；键盘七导航、More、五标签箭头/Home/End、预览 Tab 圈定/Escape/焦点返回；reduced-motion 活动过渡/动画为 0。 |
| `zoom-reflow.json`、`zoom-reflow-*.png` | 200% 页面缩放等效布局/栅格参数：1600×1000 物理画布、800×500 CSS 视口、DPR=2；八页和表单可用，无页面级横滚。与独立的实际文字放大检查互补。 |
| `context-browser.json` | 公司价格 20 点范围跨概览/估值/三主题；财务累计/报表范围跨章节与主题；三种数据模式和外观互不改写。 |
| `perf-browser.json`、`perf-fixture-bytes.json` | 精确 base 隔离源码与最终工作树同环境、同 raw 数据字节的实际加载/交互/请求观测。 |

桌面/窄屏主矩阵观察 13,186 次普通文本（包括 placeholder 与字段值），文字低于 4.5:1、必要字段边框低于 3:1、图表轴字/数据线采样低于目标均为 0；可见窄屏操作目标小于 44px 为 0。隐藏的 skip link 未当成可见触屏目标，其键盘可达单独实测。页面错误、数据 HTTP 错误与意外页面横滚均为 0。

矩阵结论是 **PASS_WITH_SAMPLING_LIMITATIONS**：透明层按实际 CSS 合成，渐变取端点及 25/50/75% 五样点，SVG/图表为颜色与人工截图检查，不是逐像素 WCAG 认证。截图前完成有限 CSS 过渡，避免把主题切换中间态当终态。

## 54 项逐项勾稽

以下 PASS 均限定于给定夹具/浏览器与实现范围；T09/T10 的采样限制、I11 的缩放方法及环境 WARN 按上文保留。完整核对项原文见 [07](../07-audit-and-acceptance.md)。

| ID | 结果与实际证据 |
| --- | --- |
| T01 | PASS：`late-browser` 默认/非法/三主题恢复。 |
| T02 | PASS：`context-browser` mock/real/mixed 与外观双向独立。 |
| T03 | PASS：`matrix`、`d4`、`provider`、`late` 比对 Store bytes 与真实导出。 |
| T04 | PASS：`d2`、`d3`、`context-browser` 筛选、排序、位置、对象与两个图表范围。 |
| T05 | PASS：`d4` 半填内容跨主题、取消离开、继续提交。 |
| T06 | PASS：`matrix` 同视口的组件几何/记录顺序逐主题相同。 |
| T07 | PASS：`ChartSemantics`、主题测试、`edge` 正负/图型/缺口不变。 |
| T08 | PASS：`late-browser` QuotaExceeded，独立外观键之外零写入。 |
| T09 | PASS（采样限定）：`matrix-summary` 真实背景文字/输入/placeholder；浅色 placeholder 已修。 |
| T10 | PASS（采样限定）：`matrix` 控件/图线；`access` 2px 焦点；文字/数值状态不只靠颜色。 |
| T11 | PASS：`edge` 长名混排、大正负数；`access` 放大文字；核心风险不靠 hover。 |
| T12 | PASS：`matrix` 实际命中/正文、`access` 动态停止；无新增持续 WebGL 或假行情动效。 |
| I01 | PASS：`access` 键盘七入口与公司，`matrix` 八页。 |
| I02 | PASS：M16–M36 逐项定位，`CompanyResearch` 五章节、原始报告/字段/动作。 |
| I03 | PASS：`d2` 与 `perf` 预览零重请求；`access` 关闭焦点回原触发器。 |
| I04 | PASS：`d2` 浏览器返回位置/筛选；`d3` 行业上下文。 |
| I05 | PASS：navigation/CompanyResearch/event focused；`d2` 非法公司 URL 不显示旧对象。 |
| I06 | PASS：`late-browser` 释放 A 的两类响应后 B 面板文本 hash 不变。 |
| I07 | PASS：M13/M38/M46/M52；StockPool、Watchlist、EventCenter、ExpectationCenter focused。 |
| I08 | PASS：EventCenter focused 验证事件筛选不缩小全局队列分母。 |
| I09 | PASS：`edge` 空/未接入，`matrix` 无用户记录，`provider` 错误/partial，`late` 损坏存储。 |
| I10 | PASS：`matrix` 八页 390px、`access` 八页 320px，无页面级意外横滚。 |
| I11 | PASS（方法限定）：`access` 实际文字字号/行高 2 倍；`zoom-reflow` 200% 等效参数。未调用浏览器工具栏缩放命令。 |
| I12 | PASS：`access` 导航/标签/预览/More；主题 select 与表单原生键盘控件。 |
| I13 | PASS：`d4` 脏输入确认、`access` Tab/Escape/原焦点，Modal focused。 |
| I14 | PASS：`access` reduced-motion=true，活动 transition/animation=0，内容仍可见。 |
| D01 | PASS：`edge` null/zero/undefined，CompanyResearch 零股本/未知来源断言，data audit P0=0。 |
| D02 | PASS：MacroTab focused 与 `d3`，观测期、生成和未知时点分开。 |
| D03 | PASS：宏观只显示已有快照与模型未接入说明，未引入分数/假历史。 |
| D04 | PASS：Industry focused 与 `d3`，池内分母/跨市场金额限制明确。 |
| D05 | PASS：CompanyResearch/ChartSemantics，`context-browser` 期间/范围；财务图和原始表保留单位。 |
| D06 | PASS：`edge` 单点/缺口；价格只画已有 close，无 OHLC/K 线。 |
| D07 | PASS：ExpectationCenter 与 invariant matrix，原四类来源，未生成机构共识。 |
| D08 | PASS：Event/Expectation focused 与 `provider`，来源/事前/可比三问分别展示。 |
| D09 | PASS：原 invariant matrix 与 `provider` 时间审计；同日/并列/未知未硬排。 |
| D10 | PASS：原重复/冲突测试；`provider` 内容冲突排除且本地记录保留。 |
| D11 | PASS：`provider` 官方全局校验失败传递到公司/首页/验证/观察/预期。 |
| D12 | PASS：`provider` 局部失败只重试失败公司，成功对象与本地数据保持。 |
| D13 | PASS：M50/M53 与官方只读测试，未新增纠改/删除官方记录入口。 |
| D14 | PASS：WatchlistInteraction/Store，确认/暂缓/忽略仍与复盘独立。 |
| D15 | PASS：`d4` 一次追加 before/after；Store/Repository 原纠正与业务修订测试全部通过。 |
| D16 | PASS：`d4` 无效导入保留原文/禁写，FormLifecycle 及原 validator/Repository 测试。 |
| D17 | PASS：WatchlistWorkflow/Repository 原备份、替换、重置确认；`late` 损坏原文真实导出。 |
| D18 | PASS：Industry focused/`d3` 未上市区可达且不入上市行情分母。 |
| D19 | PASS：`provider` 默认冲突/全局关闭，`late` 存储阻断，矩阵状态可见。 |
| D20 | PASS：原 Provider/比较服务无 diff；Macro/Industry/Event/Expectation focused 覆盖分母及去重语义。 |
| E01 | PASS：package/lock/Vite 无 diff，继续原 React/Tailwind/Recharts。 |
| E02 | PASS：build 整个浏览器模块图 Local Core forbidden=0。 |
| E03 | PASS：bundle 三类完整历史标记 false；`perf` summary/manifest/单公司 lazy 请求。 |
| E04 | PASS：`perf` 首屏无全公司历史；生产未引用 docs 设计资产。 |
| E05 | PASS_WITH_WARNINGS：上列全量实际命令完成，环境和既有数据 WARN 未消除或降级。 |
| E06 | PASS（观测限定）：精确 base 和最终同 fixture 的 bundle/浏览器观测，见下文与 `perf-browser.json`。 |
| E07 | PASS：精确 base、五个普通提交、最终 refs/ahead/behind/工作树由 `final-git.json` 核对。 |
| E08 | PASS：仅 checkpoint 普通 push；未创建 PR、合并 main、部署或重写历史。 |

## 性能与已知限制

本票基线 JS 2,334,700 B / gzip 534,585 B，最终 JS 2,402,645 B / gzip 554,816 B，分别增加 2.91% / 3.78%。CSS 从日志 44.00 kB 降至 40.14 kB。实际入口 `index-Dulz8dDk.js`，仍为一个约 2.40 MB 应用 JS chunk；Vite >500 kB WARN 继续存在，未把数据 lazy-load 说成所有页面代码分包。

原 bundle checker 的历史 JS 基准是 4,841,746 B，当前减幅 50.38%，通过原“至少 50%”要求；该历史预算与本票基线明确分开。财务/公告/指引摘要与本票基线相同，完整历史标记全部 false，Local Core 2,301 graph modules / 1 chunk / 0 forbidden。设计 SVG/PNG 没有生产引用。

Windows 全局 CRLF 转换导致基线 checkout 的指引索引 byte-size 校验失败。本次只在 `.gitattributes` 增加与财务/公告同类的 `-text`；58 个 JSON 原始字节全部恢复并核对为原 Git blob，`public/data` 相对基线内容 diff 为空，没有改校验规则或 Provider 事实。性能实验中的基线归档也恢复同样 raw bytes，见 `checkout-byte-restoration.json` 与 `perf-fixture-bytes.json`。

性能观测以同机、同依赖、相同 Mixed raw 数据、空用户存储比较精确 base 和最终代码，预热后 3 次记录首屏及同一公司完整详情。指标及端点定义保留在 `perf-browser.json`。它是开发服务观测，不能推断低端机器/移动网络或生产性能统计显著改善；早期冷启动 baseline-browser 另保留，未与预热数混算。

| 同机观测中位数 | 精确 base | 最终实现 |
| --- | ---: | ---: |
| 首页就绪端点 | 1133.66 ms | 1150.47 ms |
| 个股池端点 | 530.47 ms | 529.20 ms |
| 中科曙光完整详情端点 | 766.49 ms | 741.22 ms |
| 浏览器 FCP | 564 ms | 544 ms |

上述 UI 端点包括明确的 500ms 网络静默及两个 animation frames，不能当作纯渲染耗时；base 是独立 landing，进入原终端的额外时间另列，完整详情也从长 drawer 变为研究页。两边每次均 7 个 JSON 请求、877,419 解码字节；首页只有指引 manifest/workflow，公司详情新增财务/公告 manifest 和选中 `sugon` 三类明细。所有响应 HTTP 200 且原始内容哈希相同，无其他公司历史预取。最终 3 次轻预览、9 次主题切换均增加 0 个数据请求。

## NOT_RUN 与停止边界

- 浏览器工具栏原生缩放命令：NOT_RUN，当前使用 headless Chromium；已实际执行 200% HTML 文字放大及 800×500 CSS / DPR2 等效页面缩放重排，方法未混称原生命令。
- 人工屏幕阅读器、全设备/跨浏览器、低端设备/移动网络性能与逐像素 WCAG 认证：NOT_RUN，超出本轮给定浏览器矩阵；没有声称认证通过。
- env 自带的四项 SKIP 如实保留：会重写真实数据的 `data:validate:a-stock`、会写健康摘要的 `data:health:providers` 未执行；`ui:audit` 和依赖 dist 的 bundle 检查已在独立授权命令实际运行。
- Hosted CI/PR/main merge/deploy：NOT_RUN，按本任务最终停止点有意不执行。

无剩余本票功能 blocker。现存数据 partial/stale/缺失、环境 WARN、单 JS chunk、采样和缩放方法限制已披露。其他 worktree 未被本票编辑或切换；其当前状态仅在最终本地 Git 证据中只读记录。五个 checkpoint push 完成后停止，不延伸 V1.0 之外功能。
