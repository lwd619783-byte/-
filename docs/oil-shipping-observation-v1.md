# 行业动态观察页 V1 · 油运

## 开工与范围（2026-09-27）

- 已 fetch `origin/main`；Base `0debad7f68ba28449cf7c0c0487f012e5d09ab9f`；正确 origin 为 `lwd619783-byte/-`，开放 PR 0，开工 tree clean。
- 后续只读核验Base对应main CI `36243574206` 为success；这是开工Base的既有CI，不是本轮功能分支的Hosted CI。
- 功能分支 `codex/oil-shipping-observation-v1`，复用当前 checkout；不修改 main、不创建 PR、不 merge、不手工部署、不改 Production 配置。
- 已读当前 AGENTS、PRODUCT、Feature Registry、architecture、Research Memory 中文入口及 `research-knowledge-decision-workflow-v1.md`。该页面属于只读确定性观察层，不写正式 Claim/Thesis/Portfolio，不复制 Research Memory 正文。
- 沿用 `IndustryTab` 默认概览、Stock/PriceHistorySeries、Industry Metric Registry、EvidenceDrawer、ChartAuditPanel 和 UI V2.1；没有新 Industry/Company/Evidence owner。

## A. 真实数据可行性（先于实现）

| 数据源 | 实测能力与覆盖 | 时间与历史 | 授权 / 成本 / 稳定性 | V1 决定 |
| --- | --- | --- | --- | --- |
| 上海航运交易所 CTFI | [公开单期页](https://www.sse.net.cn/index/singleIndex?indexType=ctfi) 能读取 2026-09-24 表格；CT1 中东湾—宁波 VLCC 270000MT、CT2 西非—宁波 VLCC 260000MT、CT4 美湾—宁波 VLCC 270000MT；WS、点、美元/吨、不同航速 TCE 不可互换 | [旧官方简介](https://www1.sse.net.cn/index/ctfiintronew.jsp)载明一般发布日 17:00 北京时间、节假日/停发例外；2013-11-28 正式发布不等于免费历史完整覆盖。[多期查询](https://www.sse.net.cn/index/ctfilist)只返回表单，未验证可批量历史。旧简介 CT1 为265000MT，不能跨新旧定义直接拼接 | [2026-06-18 版权声明](https://www.sse.net.cn/indexIntro?indexName=copyright)要求书面授权。公开查看不证明允许系统复制、派生及再发布；费用 unknown，不引用其他指数订价。仅单次公开页核验，无持续自动采集/SLA证明 | 候选 CT1 WS，未接入数值、未注册 admitted Provider；提供来源链接，授权/历史/定义版本待核验 |
| Baltic Exchange | [API portal](https://api.balticexchange.com/)需要登录；[数据订阅](https://www.balticexchange.com/en/apply-page.html)包含 tanker / API | 日频航线评估，实际历史覆盖与订阅有关；未登录、未探测付费数据 | [Non-Display usage](https://www.balticexchange.com/en/data-services/Non-Display.html)要求 data license，派生/指数另有许可；具体报价 unknown | 不注册、不付费、不接入 |
| OPEC / MARAD 免费公开资料 | [OPEC Tanker chapter](https://publications.opec.org/momr/chapter/145/2699)搜索可见月均 Worldscale 表格线索，正文直接读取失败；[MARAD](https://www.maritime.dot.gov/data-reports/data-statistics/data-statistics)为船队/靠港等统计 | OPEC 月频、路线不同，不能替代日频 CT1；MARAD 不是运价序列 | 未证明运价原始授权、自动持续获取或可分发派生数据 | 免费人工研究替代路径，留在研究背景；不包装成已接入运价 |
| 既有 A 股 Price History | 唯一原 owner `priceHistory.generated.json`：中远海能600026、招商轮船601872、招商南油601975；各60条，2026-06-29至09-18；Tencent fqkline | 最后采集 2026-09-18 11:48:05 +08:00，末条仍可能盘中；保守排除采集当地当日及之后数据，最后可用历史日09-17。按需采集，非实时/自动更新 | 原 fetcher 请求 qfq，但 `qfqday || day` 未保存实际分支，旧产物复权口径 unknown；不追认 qfq。来源使用边界继承现有 Provider，不新增许可/准入声明 | 显示留存 close 和数学变化，公开标识复权未确认、过期、历史交易日覆盖未证明；阻断关系结论 |
| 比较基准、H/美股 | 油运研究池只有三只 A 股；现有 stock Provider 没有匹配的宽基历史 owner | 基准 unavailable；不拿另一只股票冒充基准 | 不建设全球行情系统 | 图例/表格明确基准未接入、超额收益不可用；跨市场无证券不伪造 |
| EIA | 原 Registry 的库存、产量、出口、炼厂投入四项周频官方留存指标 | 保留每项原 window、freshness、publication/releaseAvailableAt unknown 和准入状态 | 继承原 Evidence、F2、Chart Audit | 次级辅助解释，不改名运价 |

CTFI 有可公开核对的候选路径，但系统使用授权未闭合。按用户“继续完成页面、合同及已有真实数据”要求交付受限版；不停止全部工程，也不把版权限制视作已获得许可。

## B. 页面 → 指标合同（V1 FROZEN，2026-09-27）

| 页面模块 | 指标 / 公式 | 时间窗口 / 单位 | 数据源 / 更新 | 状态与证据 |
| --- | --- | --- | --- | --- |
| 对象口径栏 | 油运；CT1 WS候选；当前选中研究样本、独立证券数 | 30/90/180自然日；以上海当地今日结束 | 原 Industry/Stock identity；每项分别显示截止日 | 总状态由子模块传播，不统一叫实时 |
| 运价卡/图 | 最新有效值；变化=(末值/前值−1)×100；5/20需6/21个有效观测；连续方向只数实际有效发布，显式缺口/冲突截断 | 原生发布频率；WS，不能转换为TCE或混合航线 | 原 IndustryMetric owner；当前无授权 owner | blocked；不以EIA/合成数据补齐；官方来源入口。接入前测试仅 synthetic |
| 股票卡 | 1/5/20期=(C末/C前n−1)×100；等权均值只在选中样本全部有值且窗口起止日一致时计算；涨跌按证券计数，0单列 | n为n个有效已收盘观测间隔，需n+1值；交易所日历未证明时称“有效交易观测”，非保证连续交易日 | 同一 Stock.priceHistorySource，原引用身份核验；无网络刷新 | missing不变0；盘中日保守排除；stale/partial/conflict传播，证据不足仍可核对历史数学值但不形成关系状态 |
| 关系卡 | 共同起止日、相同窗口；运价与样本等权变化符号：上/上、上/弱、弱/上、下/下、暂无方向 | 共享所选自然日期区间，至少2个值；同日端点，不向前填充；0精确为无方向 | 只读确定性计算，所有来源 fresh/real、数值完整且股票 basis已确认才允许 | 任一缺失/过期/部分/冲突/未知口径→数据不足；非因果、非正式判断 |
| 关注卡 | 当前来源阻断、缺失、过期及可计算方向背离 | 当前状态，不持久化“新触发”时间 | 上述派生状态；事件复用原 IndustryChangePanel | 没有问题则“暂无新增触发”；没有上次状态基线，不声称某条件“刚触发” |
| 股票图 | 每证券 C日期/C共同基日×100 | 所有选中证券共同首个有效日期；同一时间范围；日期并集上缺测=null，connectNulls=false | 原 close，保留其实际/未知复权口径；基准缺失明确说明 | 不同 basis不作关系结论；同图说明口径限制；原始表与原 Chart Audit/Evidence |
| 公司表 | 原证券、业务字段、最后有效close、1/5/20期、相对基准 | CNY仅对既有A股说明；最新日期逐项显示；unknown排序置后 | 原Stock/Industry/PriceHistory；复用 onOpenStock | 当前三家公司三个证券。未有跨上市company映射时，只计证券并显示公司数无法核对，禁止靠名字去重 |
| 辅助区 | EIA、事件、信号/Claim、原研究资料/产业链/研究池 | 各自原时间及准入语义 | 复用现有 owner/component | 渐进展开；没有可靠完整研究外链不创造链接 |

### 最小结构与约束

新增仅为纯计算 view model，不持久化、不增加数据库/schema owner。运价输入只能是原 `IndustryMetricDataset` 的只读引用；没有候选的正式注册 identity 时 runtime 固定为 blocked，不按模糊名称匹配指标。未来接入需先完成原 Registry/Provider 的定义、许可、留存、准入流程；本次不宣称未来 owner 已可直接生产运行。

运价时间序列投影复用原 `industryHistory` 的 exact owner / provenance / duplicate / revision 校验。该reader当前仅支持已存在的月/周频；日频输入明确blocked，不为预留CTFI另造日频读取authority。正常运价图形验收使用独立的 `SYNTHETIC ONLY` 周频测试对象，不改名或复用EIA真实数值。未来日频生产接入仍有原owner reader/Registry扩展待做。

相同日期多个价格/运价记录即 conflicted；冲突值不绘制。缺值不压缩成相邻交易日；收益需所选区段无显式缺口。日期晚于 asOf 不可参与。旧价格只在已知市场时区且 source.updatedAt有效时排除采集当地同日及以后，未知市场/采集时间 fail closed。stale为超过7自然日未有收盘观测的**页面提醒阈值**，非交易所逾期判断，也非 Provider admission 修改；未来交易日历接入前不声称精确漏发。

选样和排序不修改研究池。公司数量仅在本 Pilot 精确三个原身份范围内可核对；未来出现其他证券，返回 company count unknown。基准缺失、复权未知公开呈现，不藏进高级审计。所有正式写入/权限/合同冻结保持不变。

## C. 实现与验证

### 实际实现范围

- `src/components/industry/IndustryTab.tsx`：只对油运概览增加惰性加载入口和loading提示；油运上下文紧凑呈现，既有静态资料折叠。其他行业原概览、细分、比较、产业链行为保留。
- `OilShippingObservation.tsx` / `oil-observation.css`：对象/时间/数据状态栏、四卡、两图、公司表、辅助入口；复用UI V2.1 tokens、Recharts、原EvidenceDrawer/ChartAuditPanel。
- `src/services/industryObservation.ts`：只读投影、有效观测变化、缺口、同日冲突、已收盘观测保守筛选、公司/证券计数、共同基日、关系fail-closed。没有AI计算、评分、写入或新行情网络请求。
- `industryObservation.test.ts` / `OilShippingObservation.test.tsx` / `industryObservation.fixture.ts`：隔离合成语义及UI测试。fixture未进入runtime引用或Provider Registry。
- `scripts/oil-observation-browser-check.mjs`：临时空浏览器profile，实际App路由与隔离合成边界场景分开；不读取用户真实研究/资产状态，不扩展测试超时。
- CURRENT：Feature Registry、执行索引、architecture及本文。没有变更Provider配置、真实行情产物、contracts/v1、正式研究/资产状态、依赖、导航路由或Production配置。

### 数据分类与限制

**真实留存数据**：原三只A股历史close（本页最后可用为2026-09-17），原股票身份与已有研究池业务描述；后者为研究背景，非收入权重。原EIA四项及事件/信号仍由既有模块读取原留存数据、原状态。没有新“实时行情”采集。

**确定性派生**：可用历史点的1/5/20期数学变化、同日起止的样本等权均值/涨跌证券数、共同基日100、持续方向计数、当前质量提醒。它们不是正式Claim、基本面结论、可交易信号、复权总回报或生产准入。

**blocked / unavailable**：真实运价数值与日频历史、实际价格复权分支、严格连续交易日覆盖、宽基与相对基准、H/美股油运证券、当前运价—股价关系、自动增量触发追踪。运行时不可能用合成fixture切换这些状态。不为完整研究创建假Notion链接。

### 验证矩阵

| 验证 | 结果 / 范围 |
| --- | --- |
| 专项新增语义/UI + 原行业页回归 | 3 files / 27 tests PASS；其中新增14语义+5UI |
| 全量 unit | 115 files / 1508 tests PASS；单worker，无断言/timeout更改 |
| build | TypeScript、Local Core typecheck、Vite、bundle gate PASS |
| contracts:validate | PASS；无正式合同改变 |
| data:validate:industry | PASS；原Registry、pins、F2 validator和signal replay |
| test:industry | Python 8、Node 107、Vitest 90 PASS |
| data:audit | exit0 / errors0 / warnings42；未改门槛。较旧已提交报告新增的6条在既有生成Claim/Thesis/Expression校验器；本任务文件未出现审计finding。保留历史报告，不覆盖日期 |
| ui:audit | exit0；该命令不证明响应式，实际浏览器另验 |
| 浏览器 | 63/63 PASS，0 page runtime errors；1440×1000与390×1000，16张截图。真实页面与合成partial/short/conflict/stale/empty/long/freight分离。Tooltip、窗口、排序、勾选、Evidence、Chart Audit、公司快速预览→完整研究、辅助指标/产业链、无横向溢出均核验；另有1条console资源404，response监听未捕获对应路径，未归因，不伪称console全清 |
| Hosted CI / Preview | 本地验证不代替Hosted；本任务未主动启动Hosted CI或Preview。push产生的自动状态在最终交付报告按实际观察单列 |
| Production | NOT_RUN / NOT_MODIFIED；未改配置、未部署、未声明业务准入 |

浏览器首次脚本错误把原公司快速预览当作立即跳转；页面原行为正确，脚本修正为核验“快速预览→打开完整研究”，完整重跑。不删除断言、不延长timeout。最终可复现记录及截图见 `oil-shipping-observation-v1/`；完整本机日志在gitignored `data-cache/oil-observation/`。

最终添加资源诊断后有一次 `page.goto` 触发原30秒load超时（0项页面断言已执行）；本机保留 `browser-load-timeout.log/json`。在无并行测试/构建时按原配置、原超时完整重跑，63项通过。未将该次加载失败涂改为PASS；[最终报告](oil-shipping-observation-v1/browser-report.json)记录最终重跑。build后确认合成运价fixture标识未进入production bundle。

### 数据策略后续（未执行）

先明确CTFI系统使用/派生/展示的书面授权与历史服务范围，再沿原Industry Metric Owner补日频发布日历、定义版本、留存证据、稳定性和准入；不自动购买。股票需由原采集器记录实际qfqday/day分支及闭市语义，再补现有owner可表达的宽基历史。完成前保持现在的显式受限状态，不把页面交付称为实时油运业务验收。
