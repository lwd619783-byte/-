# UI V1.0 · M01–M56 迁移核对

核对依据：[冻结迁移表](../05-migration-and-scope.md)、基线 `473289db6da79db5be892015bffc2c75b964abcb` 的组件及回调、D1–D4 实现及本轮 D5 修复工作树。逐项检查的是现有能力在新结构中的去向与可达操作；本文件不是 Provider 准入结论，也不是浏览器验收记录。

本轮 56 项均已定位到实现路径，未发现为简化页面而删除基线业务回调的项目。下表使用“源码已定位”语义，不将其等同于“运行时通过”。本轮发现的展示问题与修复状态列于文末；源码修复后仍需 D5 实测。测试列仅指仓库中可复核的测试定义，不能单独证明当前提交已运行通过。完整测试命令、结果、截图、窄屏及键盘证据由主任务的 D5 验收记录绑定实际提交。

## 1. 全站与研究页面

| ID | 实现去向与可达动作 | 保留的字段、范围与业务语义 | 源码 / 测试索引 |
| --- | --- | --- | --- |
| M01 | 紧凑首页的研究快捷入口；共享导航和品牌按钮均可返回首页。 | 首页之外的宏观、行业、个股池、观察清单、验证中心、预期证据六入口均保留。首页任务、行情、事件均来自已加载业务数据，没有样稿新闻或市场温度。 | [HomePage][home]、[App][app]；T01 |
| M02 | Header + Sidebar + DashboardLayout；移动导航“更多”展开其余入口。旧 RightRail 保留在可展开的“工作台概况与数据健康”中。 | 外壳不强制每页三列；行情关注公司和数据缺失公司仍可打开同一公司预览。右栏资料未被删除。 | [Header][header]、[Sidebar][sidebar]、[DashboardLayout][layout]、[RightRail][rail]、[App][app]；T01 |
| M03 | Header 的数据模式 select 与独立 AppearanceControl。 | mock / mixed / real 的原数据切换路径保留。主题只更新展示偏好；Store、Provider 选择及数据集的依赖中没有主题值。 | [Header][header]、[App][app]、[AppearanceControl][appearance]；T01 |
| M04 | 公司价格摘要、研究池行/卡片、首页行情和价格图附近的 QuoteTrust；首页来源明细及工作台健康详情可展开。 | 价格是否可用、行情质量、交易/采集时间及已有覆盖统计分别显示。数据包更新时间未伪装成所有模块市场时点。来源空值和正号修复已源码复查，见 F01/F02。 | [QuoteTrust][trust]、[HomePage][home]、[StockPool][pool]、[StockDetailDrawer][company]；T02、T04 |
| M05 | 宏观页前四分类按钮与“其他分类”select，选择后进入指标阅读区。 | `buildMacroGroups` 的全部九类可选；空分类显示待接入，不依据有无数据删除分类。 | [MacroTab][macro]；T03 |
| M06 | 宏观分类内指标 select → 来源与口径 details；底部完整指标表。 | 指标值、原始 key、来源、说明、更新信息与原行字段保留；未把暂未接入历史画成走势。 | [MacroTab][macro]；T03 |
| M07 | 宏观页当前限制文字及历史/模型未接入说明。 | 明示当前是宏观指标观测，模型尚未接入；不生成牛熊温度、方向分或隐含预测。 | [MacroTab][macro]；T03 |
| M08 | 行业选择 → “研究概览”。 | 景气文字、产业阶段、核心驱动、催化、主要风险、风格适配来自原 Industry；资料未提供来源/时间时明确说明，不生成景气分。 | [IndustryTab][industry]；T03 |
| M09 | 行业选择 → “产业链”子视图。 | ChainMap 保留上下游结构关系；没有将节点数或连线变成收入权重、市场份额。 | [IndustryTab][industry]；T03 |
| M10 | “细分比较” → 细分选择 → “逻辑与行情摘要 / 公司比较表 / 公司列表”。 | SegmentLogic 的需求、供给、壁垒、趋势、变量及原摘要字段保留；研究池数量条注明当前行业上市公司分母，未上市不计入、公司搜索不改变该分母。跨市场金额不可比时不混加。 | [IndustryTab][industry]；T03 |
| M11 | 机器人行业默认“全部”，并可选原细分；公司列表保留核心池及可展开观察池。 | AllRobotics 与 RoboticsStockSection 的原公司池、字段和公司操作保留；不将观察公司升级为确定供货事实。 | [IndustryTab][industry]、[RoboticsStockSection][robotics]；T03 |
| M12 | 机器人行业 → “产业链” → 未上市公司 / 待上市公司。 | PrivateCompanySection 独立于上市公司搜索结果可达；明确是产业链线索，不进入行情合并或上市研究池分母。 | [IndustryTab][industry]；T03 |
| M13 | 个股池基础：行业、细分、市场、数据质量、排序；更多：池内搜索、风险级别，可见激活计数并可清除。 | 原五个质量选项、六种排序全部保留；行业切换仍重置细分，全球搜索与池内搜索按既有匹配路径组合，没有加入全市场筛选。 | [StockPool][pool]、[filters][filters]；T04 |
| M14 | 默认研究表；“卡片”切换；窄屏 MobileCardList。行内“字段与研究摘要”展开其余字段。 | 表格与卡片共用 `visibleStocks`，顺序一致；原价格、涨跌、PE、市值、覆盖、质量、风险、研究摘要和定位等字段仍可查询。长公司名换行，QuoteTrust 未隐藏在悬浮提示中。 | [StockPool][pool]、[StockCard][stock-card]；T04 |
| M15 | 公司名/快速预览 → StockQuickPreview → “打开完整研究”；研究表也提供完整研究入口。 | `stock.id` 贯穿预览与公司路由；原回调兼容。预览不承担公司重数据请求，完整研究保留原业务回调。返回定位使用 `data-stock-id`。 | [StockQuickPreview][preview]、[App][app]、[useWorkspaceNavigation][navigation]；T04、T05 |

## 2. 五标签公司研究

公司页主体仍复用 `StockDetailDrawer` 的共享内容层，支持整页 `presentation`；不是复制一套主题专用业务树。五标签是“研究概览 / 经营与财务 / 价格与估值 / 预期与验证 / 证据与复盘”。

| ID | 实现去向与可达动作 | 保留的字段、范围与业务语义 | 源码 / 测试索引 |
| --- | --- | --- | --- |
| M16 | 公司固定身份摘要；五标签均可从身份区返回。 | 名称、代码、市场、行业/细分、价格、涨跌、风险、字段/模块覆盖保留。币种无源字段时显示未提供；加入观察 / 开始复盘 / 恢复按当前观察项身份选择。 | [StockDetailDrawer][company] `ResearchHeader`；T05 |
| M17 | 研究概览 → 宏观与行业背景。 | MacroIndustrySection 的景气、阶段、驱动、风险仍来自既有行业资料；标注资料性质，不能据此推导实时宏观信号。 | [StockDetailDrawer][company]；T05 |
| M18 | 研究概览 → 展开“产业链位置与关联公司”。 | 原 IndustryChainMap 保留当前公司的产业链位置；结构关系独立展开，不为首屏简洁移除。 | [StockDetailDrawer][company]、[IndustryChainMap][company-chain]；T05 |
| M19 | 经营与财务 → 主营业务拆解。 | BusinessBreakdown 使用原主营资料与细分描述；未提供分部营收时不画份额图、不补分部数字。 | [StockDetailDrawer][company]；T05 |
| M20 | 研究概览的研究依据、风险、下一步验证，以及投资逻辑全文。 | 原 thesis、业务解释、投资假设、催化、风险、跟踪/验证指标保留；未调用 AI 改写成确定性结论。 | [StockDetailDrawer][company] `InvestmentLogic`；T05 |
| M21 | 固定身份区快捷动作；证据与复盘 → StockWatchlistPanel。 | 添加、编辑元数据、开始复盘、时间线新增纠正、恢复已归档观察项均接原 App / Store 回调；按当前公司的活动/归档项决定入口。 | [StockWatchlistPanel][stock-watch]、[App][app]；T05、T06 |
| M22 | 研究概览显示证据摘要并可转证据标签；证据与复盘 → EvidenceVerification。 | evidenceLevel、verificationStatus、themeTags、evidenceNotes 的证据标题、源名、日期、外链、说明可查；“待验证”仍不能解释为确定供货关系。 | [StockDetailDrawer][company]；T05 |
| M23 | 预期与验证 → EarningsVerificationPanel。 | 使用原 summary / detail / comparisons / chains；加载中、完整数据失败、仅摘要、缺链状态保留，不据 UI 布局补阶段。 | [EarningsVerificationPanel][verification-panel]、[StockDetailDrawer][company]；T05、T08 |
| M24 | 预期与验证 → StockEarningsExpectationPanel。 | 同一聚合器传入官方与本地身份、重复关系、冲突、可比较结果和 Provider 只读资格；官方记录不提供本地纠正写入口。 | [StockEarningsExpectationPanel][stock-expectation]、[App][app]；T09 |
| M25 | 研究概览 → 展开产业链与关联公司 → 点关联公司。 | CompanyRelationGraph 传出原 Stock，由公司页 `onOpenStock` 进入同一研究路由；关联关系不产生新实体 ID。 | [StockDetailDrawer][company]、[App][app]；T05 |
| M26 | 固定价格摘要；价格与估值 → 行情快照与口径八项。 | 价格、涨跌、成交额、换手、总市值、流通市值、涨停价、跌停价均在。缺失仍用缺失文案；涨跌幅正号修复已源码复查，见 F01。 | [StockDetailDrawer][company]、[QuoteTrust][trust]；T02、T05 |
| M27 | 概览“价格脉络”小图；价格与估值“60 日价格走势”、观察范围 select 及原始数据表。 | 只读 `priceHistory`，范围仅截取已加载的全部/最近 20 观测，不新增请求。交易日期不换成采集时间；`connectNulls=false`，末点与孤立点可见，零值保留，无数据有空态。币种及历史来源未独立提供时明确说明；范围状态按公司保留并由两章节共享。 | [StockPriceHistoryChart][price-chart]；T02、T05 |
| M28 | 经营与财务 → 财务快照，以及可切换口径的已有财务历史。 | `buildFinancialRows` 继续区分模拟数据、市场未接入、摘要、完整数据加载中/失败；现有 source/报告日期/fetchedAt 保留。缺失不补零。 | [StockDetailDrawer][company]、[CompanyFinancialHistory][finance-history]；T05 |
| M29 | 价格与估值 → 估值快照。 | PE、PB、PS、股息率仍读取原字段；明确历史估值序列与百分位未提供，不推算或构造历史。 | [StockDetailDrawer][company]；T05 |
| M30 | 经营与财务 → F10 / 公司基础资料。 | 全称、上市日期、原行业、总股本、流通股本、主营业务原始口径、公司简介保留。股本使用 finite-number 判断，零值显示为 `0.00 亿股`，缺失仍单独表达；修复见 F04。 | [StockDetailDrawer][company]；T05 |
| M31 | 证据与复盘 → 研报与观点。 | ArticleList 原标题、来源、日期、摘要、外链仍可达；无记录为空态，未添加自动研报 Provider。 | [StockDetailDrawer][company]；T05 |
| M32 | 证据与复盘 → 公告与业绩动态。 | AnnouncementPanel 原最新业绩摘要、公告清单、解析状态、仅元数据、部分解析、来源不可用及完整数据失败分支保留。列表内容来自 summary/detail，不按样稿补公告。 | [StockDetailDrawer][company] `AnnouncementPanel`；T05 |
| M33 | 价格与估值 → 信号雷达。 | 最新/5 日/20 日主力净流入、融资余额、龙虎榜次数、股东变化、解禁、人气保留；热点原因与最新互动分别呈现原文本，二者同时有值也都可读，修复见 F03。 | [StockDetailDrawer][company]；T05 |
| M34 | 研究概览 → 分类资料。 | 原行业板块、概念、地区名称从 sectorMembership 展示；主题标签仍来自 stock.themeTags，没有按主题外观改分类。原来源可在数据质量详细层追查。 | [StockDetailDrawer][company]；T05 |
| M35 | 证据与复盘 → 展开“来源与核验详细层”；各数据模块有就地状态。 | 来源、状态、行情采集时间、缺失字段数、财务更新时间、sourceLayer、sourceEndpoint 以及原 quality/missingFields 明细均可查。来源/状态缺失现显示未提供/未知；旧回退修复见 F02。 | [StockDetailDrawer][company]；T02、T05 |
| M36 | 公司共享内容层按公司身份请求完整财务/公告；摘要先显示。 | 原 A 股且非模拟的按需条件保留；请求 `stockId`、当前选择、effect active 同时校验。迟到响应不能覆盖新公司；主题与章节切换不作为重取数据的依赖。 | [StockDetailDrawer][company] `shouldLoad* / canApply*`；T05 |

## 3. 观察、复盘、验证与预期工作流

| ID | 实现去向与可达动作 | 保留的字段、范围与业务语义 | 源码 / 测试索引 |
| --- | --- | --- | --- |
| M37 | 观察清单工具条“添加观察项”；公司/状态/排序基础条件，更多内行业/优先级/标签，逾期/新事件/归档切换。 | 原优先级、下次复盘、事件、更新、公司五排序及筛选条件保留；筛选只改列表。无法匹配当前数据集公司的用户记录以警告和详情保留，不被静默删除。 | [WatchlistTab][watch]、[App][app]；T06 |
| M38 | 观察详情“更多”或公司证据面板 → 编辑元数据 Modal。 | 提交仅包含 reason、priority、tags、nextReviewAt；thesis/validationCriteria/riskCriteria 不在元数据更新 payload 内，核心判断必须走复盘。 | [WatchItemFormModal][watch-form]、[App][app]；T06、T07 |
| M39 | 观察项/任务/公司动作“开始复盘”；ReviewTimeline“新增纠正记录”。 | ReviewFormModal 保留当前判断只读快照、更新判断、条件、关联事件/任务、理由等；App 继续调用 completeReview，纠正目标 ID 保留，失败保留输入，成功才关闭。 | [ReviewFormModal][review-form]、[App][app]、[watchlistStore][watch-store]；T06、T07 |
| M40 | 观察详情更多“归档”，归档视图“恢复”；公司身份区可恢复已有归档项。 | 归档仍显式确认并走 archiveWatchItem；恢复调用原 Store，不删除复盘历史、不重建新观察项。 | [WatchlistTab][watch]、[App][app]；T06 |
| M41 | 观察详情待办 → 确认 / 暂缓 / 忽略；超过首组可展开全部。 | 原 acknowledged / snoozed / dismissed 与暂缓日期进入 setTaskState；与 completeReview 独立，页面明确提醒处理不会自动改变投资判断。 | [WatchlistTab][watch]、[App][app]；T06 |
| M42 | 观察详情展开复盘时间线；公司证据标签中同一 ReviewTimeline。 | 原稳定顺序，初始五条并可展开全部；before/after 判断与条件、原因、decision、下次复盘、事件/证据链接和纠正关系均保留。引用事件当前不可用时展示原 ID，不编造事件。 | [ReviewTimeline][timeline]、[StockWatchlistPanel][stock-watch]；T06 |
| M43 | 观察页默认关闭的示例模板 details；单项载入 / 载入全部。 | 只有显式回调调用 loadSample 后才进入用户数据。沿用重复公司跳过逻辑，未在首次进入、主题切换或重置时自动写入示例。 | [WatchlistTab][watch]、[App][app]；T06 |
| M44 | 观察页“备份与恢复” → JSON 下载、文件/原文预览、安全合并、替换、重置。 | 沿用 validateImport / mergeImport / replaceImport / reset；无效预览禁写，替换/重置保留确认，替换前备份仍由原 repository 完成。仅浏览器用户观察数据，不迁到 Node 账本。 | [WatchlistBackupModal][watch-backup]、[App][app]、[watchlistRepository][watch-repository]；T07 |
| M45 | 观察页持久错误/损坏状态 → 打开备份 → 导出损坏原始数据；预期存储错误亦有恢复入口。 | `storageError` 与 `corruptedRaw` 独立传递；损坏原文可下载，未用空数组覆盖并装作正常。文件读取失败保留已有输入；业务写失败在 Modal 内可见。 | [WatchlistTab][watch]、[WatchlistBackupModal][watch-backup]、[App][app]；T06、T07 |
| M46 | 验证中心基础公司/行业/事件类型/日期；更多内解析/数据状态与待复盘过滤。 | 原六类条件保持。事件列表先显示 80 条，可继续加载后续；点击详情保留完整 reviewReasons。深链 eventId 必须存在于当前 snapshot，否则显示明确空态。 | [ResearchEventCenter][events]、[App][app]；T08 |
| M47 | 验证中心 → “全局核验队列”。 | 始终 `snapshot.events.filter(needsDataReview)`，不受本页六过滤重定义；全局数量明示。初始 30 条可继续显示，详情仍有来源、公司、复盘操作。 | [ResearchEventCenter][events]；T08 |
| M48 | 验证中心 → “业绩验证链”；公司 → 预期与验证。 | 原链仅随公司/行业过滤并保留前 12 条范围说明；预告/修正/快报/定报缺链和差异仍来自现有 chain，不把缺少记录当作应披露义务，也不补阶段。 | [ResearchEventCenter][events]、[EarningsVerificationPanel][verification-panel]；T08 |
| M49 | 预期中心来源状态条、全局错误条和重试；公司预期标签保留相同资格。 | 官方索引失效由原 active-record selector 全局关闭官方分支；本地独立记录保留。单公司详情失败可部分成功，失败公司 ID/错误及重试均保留。请求 generation 防止数据模式变化后的迟到响应污染。 | [App][app]、[EarningsExpectationCenter][expectations]；T09 |
| M50 | 预期中心基础公司/报告期/指标/来源类别；更多内行业/来源核验/事前有效/比较结果/存在修订/观察清单。 | 共十类条件均可达，激活计数及清除只改 UI。对照组另外明确区分报告期、periodScope、币种与会计口径；不因视觉合并成一致预期。 | [EarningsExpectationCenter][expectations]；T09 |
| M51 | 来源与时间审计 → 本地与官方证据关系；快照卡显示官方版本/重复身份。 | duplicate / metadata difference 的本地记录与官方 ID 可查；聚合比较继续由原 relation selector 去重，本地记录保留，元数据变化不静默吞掉。关系区域注明全局已载入范围。 | [EarningsExpectationCenter][expectations]、[App][app]；T09 |
| M52 | 来源状态附近默认风险条；“查看冲突详情”及全局核验队列。 | 内容冲突字段、排除理由、Provider 警告仍可读；冲突保留本地值但不进入比较，缺可靠数值不画图区、不补 0。阻断原因不是只在悬浮提示可查。 | [EarningsExpectationCenter][expectations]；T09 |
| M53 | 预期中心“添加业绩预期”；本地快照“创建纠正”；公司标签沿原添加入口。 | 原表单、时间解析、不可变 snapshot 与纠正 ID 保留；Provider 卡无纠正按钮，App 再检查 providerSnapshotIds。失败保留表单而非关闭，未增加直接改写历史能力。 | [EarningsExpectationFormModal][expectation-form]、[EarningsExpectationCenter][expectations]、[App][app]；T07、T09 |
| M54 | “导出 / 快照导入” Modal；“导入记录”子视图。 | 原 JSON/CSV preview 和导入结果保留；部分 CSV 仍需原 partial 确认、替换仍需确认与备份、非法预览禁写。JSON 只导入 snapshots，不恢复设置/历史。批次的模式、原顺序、输入/新增/重复/冲突/无效计数、逐行问题全部可查，不受页面筛选缩小。 | [EarningsExpectationImportModal][expectation-import]、[EarningsExpectationCenter][expectations]、[App][app]；T07、T09 |
| M55 | “来源与时间审计”下的快照时间面板；对比视图有效快照 / 业务修订 / 数据纠错。 | 原始/有效业务时间、来源时间、精度、解释时区、前序候选、correction chain 与业务修订分别展示。同刻/不确定不得生成方向性上修下修；未解析历史时区不能证明事前。 | [EarningsExpectationCenter][expectations]、[ResearchEventCenter][events]；T08、T09 |
| M56 | 全局 workflow/storage 错误条，预期来源状态与重试，公司模块状态，工作台健康 details。 | 既有源服务错误仍传递；行情 partial/stale、财务/公告失败、官方全局关闭、局部详情失败、本地存储失败各有区别。金融详情失败保留真实摘要，不扩大首屏重数据获取。F02 缺失来源标签已修，异常运行验收由 D5 记录。 | [App][app]、[QuoteTrust][trust]、[StockDetailDrawer][company]、[EarningsExpectationCenter][expectations]；T02、T05、T07、T09 |

## 4. 测试索引及证据边界

以下是关联测试的可复核位置；本次迁移核对不重新执行全站测试，也不将测试文件存在当作结果。D1–D4 的 focused tests 由各 checkpoint 记录，D5 应再记录最终工作树的完整结果。

| 索引 | 已有测试定义覆盖的核对点 | 文件 |
| --- | --- | --- |
| T01 | 外壳导航、模式与外观独立、偏好及首页入口 | [Header.test.tsx](../../../../src/components/layout/Header.test.tsx)、[Appearance.test.tsx](../../../../src/components/layout/Appearance.test.tsx)、[HomePage.test.tsx](../../../../src/components/home/HomePage.test.tsx) |
| T02 | 行情信任、缺失状态、涨跌/图表语义、共享主题图表 token | [QuoteTrust.test.tsx](../../../../src/components/common/QuoteTrust.test.tsx)、[DataQualityBadge.test.ts](../../../../src/components/common/DataQualityBadge.test.ts)、[ChartSemantics.test.tsx](../../../../src/components/common/ChartSemantics.test.tsx)、[theme.test.ts](../../../../src/components/charts/theme.test.ts) |
| T03 | 九类宏观、行业深链与子视图、私企范围及机器人池 | [MacroTab.test.tsx](../../../../src/components/dashboard/MacroTab.test.tsx)、[IndustryTab.ui-v1.test.tsx](../../../../src/components/industry/IndustryTab.ui-v1.test.tsx) |
| T04 | 个股基础/高级过滤、六排序、表/卡一致、原字段和来源 | [StockPool.ui-v1.test.tsx](../../../../src/components/stock/StockPool.ui-v1.test.tsx)、[StockPool.trust.test.tsx](../../../../src/components/stock/StockPool.trust.test.tsx) |
| T05 | 五章节、深链/键盘、旧抽屉兼容、迟到财务/公告隔离、失败后摘要、切换主题不重取、空/零/单点图表、已加载价格范围；新增同时断言两种信号文本、零股本与未知来源 | [CompanyResearch.test.tsx](../../../../src/components/stock/CompanyResearch.test.tsx)、[StockDetailDrawer.test.ts](../../../../src/components/stock/StockDetailDrawer.test.ts)、[StockCoverage.test.tsx](../../../../src/components/stock/StockCoverage.test.tsx)、[StockDetailDrawer.watchlist.test.tsx](../../../../src/components/stock/StockDetailDrawer.watchlist.test.tsx)、[useWorkspaceNavigation.test.tsx](../../../../src/hooks/useWorkspaceNavigation.test.tsx) |
| T06 | 观察项身份与焦点、全部原动作、任务独立、模板主动载入、未匹配记录、完整历史/纠正 | [WatchlistInteraction.test.tsx](../../../../src/components/watchlist/WatchlistInteraction.test.tsx)、[WatchlistWorkflow.test.tsx](../../../../src/components/watchlist/WatchlistWorkflow.test.tsx)、[watchlistStore.test.ts](../../../../src/services/watchlistStore.test.ts) |
| T07 | 脏表单/失败输入/单次提交、无效导入禁写、原 Repository 备份导入规则 | [FormLifecycle.test.tsx](../../../../src/components/common/FormLifecycle.test.tsx)、[watchlistRepository.test.ts](../../../../src/services/watchlistRepository.test.ts)、[earningsExpectationRepository.test.ts](../../../../src/services/earningsExpectationRepository.test.ts) |
| T08 | 六筛选、全局队列分母、事件主从与深链、超过首组可达、12 条链范围、原比较 | [ResearchEventCenter.ui-v1.test.tsx](../../../../src/components/research/ResearchEventCenter.ui-v1.test.tsx)、[ResearchEventCenter.test.tsx](../../../../src/components/research/ResearchEventCenter.test.tsx)、[EarningsVerificationPanel.test.tsx](../../../../src/components/research/EarningsVerificationPanel.test.tsx) |
| T09 | 十筛选、独立资格、重复/冲突/只读、全局关闭与部分失败、图形只画有效比较、导入/审计历史及时间不变量 | [EarningsExpectationCenter.ui-v1.test.tsx](../../../../src/components/expectation/EarningsExpectationCenter.ui-v1.test.tsx)、[CompanyGuidanceExpectationWorkflow.test.tsx](../../../../src/components/expectation/CompanyGuidanceExpectationWorkflow.test.tsx)、[EarningsExpectationWorkflow.test.tsx](../../../../src/components/expectation/EarningsExpectationWorkflow.test.tsx)、[earningsExpectationInvariantMatrix.test.tsx](../../../../src/services/earningsExpectationInvariantMatrix.test.tsx) |

## 5. 本轮发现与修复复查

这些问题已发送给主任务。均是当前 UI 中可以定位的具体分支，不推导为业务 Provider、数据模型或合同缺陷；本报告自身没有改动业务代码。

| 编号 | 涉及项 | 源码发现 | 本轮状态 |
| --- | --- | --- | --- |
| F01 | M04 / M26 / M56 | 发现 RightRail 的涨跌幅、App 工作台健康中的平均涨跌、公司行情八项中的涨跌幅使用不带正号的 `formatPercent`。金融正负不能仅靠颜色。 | 主任务已补显式正号；本轮已复查这三处源码。运行时与三主题结果由 D5 记录。 |
| F02 | M04 / M35 / M56 | 发现公司数据质量详细层以 `dataQuality?.map(...).join(...) || "mock"` 回退来源与状态；源信息缺失不能推出它属于 mock。该分支在冻结基线也存在。 | 主任务已改为“来源未提供 / 质量状态未知”；本轮已复查源码。缺失数据运行结果由 D5 记录。 |
| F03 | M33 | 发现基线 `hotReason ?? latestInteraction` 择一显示，两字段同时有值时互动文本没有独立呈现。 | 主任务已改成“热点原因 / 最新互动”两个原文段落；本轮已复查源码及 CompanyResearch 测试同时断言两个文本，源码问题已闭环。实际测试运行结果由 D5 记录。 |
| F04 | M30 | 发现基线 F10 总股本/流通股本 truthy 判定把 `0` 显示为缺失。 | 主任务已改为 `typeof === "number" && Number.isFinite`，两股本字段均保留零；本轮已复查源码及测试断言两个 `0.00 亿股`，源码问题已闭环。实际测试运行结果由 D5 记录。 |

F01–F04 的实现修复已完成本轮源码复查，没有遗留未修的本轮发现。本轮没有自行执行浏览器、截图、320px、200% zoom、reduced-motion、完整测试、build 或环境门禁；这些在本轮均为 **NOT_RUN（只读迁移核对的职责范围，主任务另跑运行时及最终验收）**。本轮读取了主任务现有构建日志及产物，复核结果如下；它不替代主任务最终运行证据与提交绑定。

## 6. D5 补充：业务与性能边界复核

比较对象为冻结基线 `473289db6da79db5be892015bffc2c75b964abcb` 到当前 D5 工作树，包含已经提交的 D1–D4 和本轮未提交修复；没有擅自替换基线。使用只读 `git diff --name-status/--numstat`、目标源码、主任务已存在的 `data-cache/ui-v1-acceptance/final-build.log` 与当前 `dist`。本轮不运行或改写门禁报告。

| 边界 | 实际复核结果 | 证据与限制 |
| --- | --- | --- |
| Store / Provider / 数据模型 | `src/services`、`src/data`、`src/types`、`src/types.ts` 相对基线无差异。原 repository、Store、聚合器、active-record selector、比较引擎仍由 App 调用。 | 只读限定路径 diff 为空；逐项回调映射见 M21、M37–M56。UI 数值呈现和来源资格的修复没有改业务数据。 |
| 合同 / Local Core / 配置 | `src/local-core`、`contracts`、`config` 及 TypeScript/Local Core 配置相对基线无差异。 | 当前 `dist/local-core-boundary.json` 记录 `passed`、2,301 graph modules、1 chunk、0 forbidden，检查范围包含整个浏览器图及 lazy/tree-shaken 模块。 |
| 依赖与框架 | `package.json`、`package-lock.json`、Vite 配置无差异，没有新增 UI 框架、图表库或 React/Tailwind 大版本迁移。 | 继续使用仓库已有 React 18、Tailwind 3、Recharts 2；未改变依赖或构建配置以放宽门禁。 |
| Provider 原始字节 | `public/data` 相对基线无内容差异。唯一相关配置增量是 `.gitattributes` 为公司指引 JSON 增加 `-text`，防止 Windows 自动换行破坏已有校验。 | 对公司指引目录全部 58 个文件逐一执行 `git hash-object --no-filters`，均与冻结基线 blob 相等，0 字节不匹配。该修复恢复既有内容字节，不生成新 Provider 事实。 |
| 门禁强度 | financial-bundle checker、data audit、env health 脚本与基线相同。`scripts/ui-audit.mjs` 仅扩大检查页面/token 文件并明确静态检查不构成运行时验收。 | 原扫描模式保留；build 体积、摘要预算、完整历史标记与 Local Core 边界阈值未降低。 |
| 主题与业务状态 | 新 AppearanceProvider 仅设置独立 `investment-dashboard.ui.v1.appearance` 偏好及根 `data-theme`；新 useSubmission 只串行化 UI 提交。 | App 原 Store memo 不依赖主题；表单仍通过原 Store/Repository 提交，主题没有增加业务写操作。 |
| 首屏重数据 | 首页及快速预览只读取既有摘要；完整公司页继续按公司、市场、dataMode、detailPath 加载财务/公告。全局指引索引仍走原 loadWorkflow；批量详情仅沿原验证/预期页条件。 | `StockDetailDrawer` 的 active + requestStockId + selectedStockId 检查保留。新 CompanyFinancialHistory 只接已加载 detail；价格范围只 slice 已有观测，没有 fetch。源码未发现重数据首屏范围扩大。 |
| 完整历史静态打包 | 当前构建 `containsFullHistoryMarker=false`、`containsFullAnnouncementHistoryMarker=false`、`containsFullCompanyGuidanceDetailMarker=false`；bundle checker `errors=[]`。 | 已读取主任务 final-build 日志，并独立对 `dist/assets` 搜索 `sourceIdentifier / announcementParsingResult / originalUnitEvidence`，均无命中。这是门禁定义的标记核对，不将其扩大为网络行为实测。 |
| 设计资产 | 生产源码未引用 `docs/ui-redesign`、`theme_tokens.json` 或 `design/index.json`；dist 未发现对应路径或内容引用。 | 冻结 token JSON 仅由 `theme.test.ts` 在测试时读取；生产使用手工映射的 CSS variables，没有把设计 SVG/PNG 打进 bundle。 |

当前产物入口是 `index-Dulz8dDk.js`，CSS 是 `index-2tAJh91k.css`；文件名与读取到的 final-build 日志一致。对实际输入基线的增量与仓库历史预算分别如下，避免把“低于旧预算”说成“比本票基线更小”：

| 指标 | 本票基线构建 | 当前 D5 构建 | 相对本票基线 |
| --- | ---: | ---: | ---: |
| 初始 / 最大 JS chunk | 2,334,700 B | 2,402,645 B | +67,945 B（+2.91%） |
| 初始 JS gzip | 534,585 B | 554,816 B | +20,231 B（+3.78%） |
| CSS | 构建日志 44.00 kB | 40,143 B（日志 40.14 kB） | 减少 |

仓库 checker 的历史 JS 基准仍是 4,841,746 B，当前保留 50.38% 缩减，超过原“至少 50%”门槛；这是该门禁的原始定义，未因本次改版修改。财务摘要 172,943 B、公告摘要 257,629 B、指引摘要 21,900 B，三个完整详情目录各 56 家；这些同步摘要均与本票基线相同。指引 workflow 240,254 B 在原 500 kB 按需预算内；日志中早期 CRLF 字节差异已由上述原始 blob 核对解释。

**保留限制：** 当前仍是一个约 2.40 MB 的应用 JS chunk，Vite 的 `>500 kB` warning 仍存在；没有把 WARNING 描述成不存在，也没有调高阈值。本轮确认的是数据按需边界和既有预算未破坏，不能据此声称全部页面已实现代码分包、初始 JS 零增长或低端设备性能已实测。最终浏览器请求、交互、截图与环境 WARN 由主任务的 D5 验收记录报告。

[app]: ../../../../src/App.tsx
[home]: ../../../../src/components/home/HomePage.tsx
[header]: ../../../../src/components/layout/Header.tsx
[sidebar]: ../../../../src/components/layout/Sidebar.tsx
[layout]: ../../../../src/components/layout/DashboardLayout.tsx
[rail]: ../../../../src/components/layout/RightRail.tsx
[appearance]: ../../../../src/components/layout/Appearance.tsx
[trust]: ../../../../src/components/common/QuoteTrust.tsx
[macro]: ../../../../src/components/dashboard/MacroTab.tsx
[industry]: ../../../../src/components/industry/IndustryTab.tsx
[robotics]: ../../../../src/components/industry/RoboticsStockSection.tsx
[pool]: ../../../../src/components/stock/StockPool.tsx
[stock-card]: ../../../../src/components/stock/StockCard.tsx
[filters]: ../../../../src/utils/filters.ts
[preview]: ../../../../src/components/stock/StockQuickPreview.tsx
[navigation]: ../../../../src/hooks/useWorkspaceNavigation.ts
[company]: ../../../../src/components/stock/StockDetailDrawer.tsx
[company-chain]: ../../../../src/components/stock/IndustryChainMap.tsx
[price-chart]: ../../../../src/components/stock/StockPriceHistoryChart.tsx
[finance-history]: ../../../../src/components/stock/CompanyFinancialHistory.tsx
[stock-watch]: ../../../../src/components/watchlist/StockWatchlistPanel.tsx
[watch]: ../../../../src/components/watchlist/WatchlistTab.tsx
[watch-form]: ../../../../src/components/watchlist/WatchItemFormModal.tsx
[review-form]: ../../../../src/components/watchlist/ReviewFormModal.tsx
[timeline]: ../../../../src/components/watchlist/ReviewTimeline.tsx
[watch-backup]: ../../../../src/components/watchlist/WatchlistBackupModal.tsx
[watch-store]: ../../../../src/services/watchlistStore.ts
[watch-repository]: ../../../../src/services/watchlistRepository.ts
[events]: ../../../../src/components/research/ResearchEventCenter.tsx
[verification-panel]: ../../../../src/components/research/EarningsVerificationPanel.tsx
[stock-expectation]: ../../../../src/components/expectation/StockEarningsExpectationPanel.tsx
[expectations]: ../../../../src/components/expectation/EarningsExpectationCenter.tsx
[expectation-form]: ../../../../src/components/expectation/EarningsExpectationFormModal.tsx
[expectation-import]: ../../../../src/components/expectation/EarningsExpectationImportModal.tsx
