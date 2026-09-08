# Stage 4.1 — R2-C1 CSRC Attachment Inventory & Field Schema Probe V1

状态：C1 实现及本地验证完成，等待普通 push 后的独立审查。总窗口数据覆盖 PARTIAL；未发布融资 observations，未实施 C2。

实际 base：`origin/main @ c4b164da90cd0d070fa62ad4ca7eb4312be856f8`，开工 fetch 后精确核验，从该 commit 创建干净 sibling worktree。分支：`feat/stage-4-1-r2c1-csrc-attachment-inventory-schema-probe-v1`。没有修改原工作树、main 或已推送历史。最终 HEAD/remote SHA 由交付消息给出，不在本提交内制造自引用 SHA。

事实源为 AGENTS、[Scope Freeze §6 / CSRC-1～3](observation-catalog-r2-scope-freeze-v1.md)、已审计 R2-A 1.1 合同与 validator、[P0 probe](p0-source-probe-v1.md)及其原 evidence。旧 collector 未作为选附件规则。

## 交付与重放

- [版本化 C1 plan](../../config/market-regime/csrc-inventory-plan.v1.json)：固定 2005-01～2026-08、260 格，明确禁止 YTD 差分及正式 observations。
- [完整紧凑 evidence](../../research-data/market-regime/source-catalog/csrc-c1/inventory-evidence.v1.json)：260-period ledger、全部导航/分页/landing/attachment/retrieval、格式与字段矩阵、逐相邻期切换检查、source snapshot/plan/content hashes。
- [27 个代表期结构摘录](../../scripts/tests/fixtures/market_regime/csrc-c1-field-layout-excerpts.v1.json)：标为 TEST_FIXTURE_EXCERPT，不能证明完整 bytes、不能计入覆盖。包括 2005/2010/2015/2020/2025 年末、最新 2026-08、实际切换前后与改革邻期。
- `research-data/market-regime/raw/csrc-r2c1/` 保存完整响应及 append-only retrieval journal；`extracted/csrc-r2c1/` 保存每份完整 probe 的原始单元格、公式、cache、合并与字段定位。两者保持 ignored，不进前端或正式 dataset。

```sh
python -m pip install -r scripts/requirements-market-regime-csrc.txt
npm run test:market-regime:csrc-c1
# 显式联网；重跑校验缓存原 bytes，保留原 acquisition，并另记 CACHE_VERIFIED
npm run data:fetch:market-regime:csrc-c1
npm run data:build:market-regime:csrc-c1
# 离线，要求保留上述完整 raw 和 inventory-source.json
npm run data:validate:market-regime:csrc-c1
```

本次 C1 content hash：`28453963bf0a453d69a0277d9eabdc4cd3b393e4f663d3cb8922478b06a18d80`。generatedAt 不参与内容 hash；完整 retrieval、plan、source snapshot、ledger、field map 都参与。离线 validate 从 raw 重算索引条目、导航、全部附件、schema 与 260 格，再与提交 evidence 精确比较；改 raw byte、日期、期次、JSON locator、URL、删页/漏 landing、重复事件都会失败。重新联网会新增真实 retrieval/cache 记录，因而生成新的内容 hash，不冒称相同历史获取。

这是 **C1 inventory/schema sidecar**，不是新的融资 dataset 合同。它没有 R1 observations、没有正式 sourceDefinitionId，不能提交给 R2-A 当作已经准入的融资数据。二进制地址重放适配现有 R2-A `StructuredLocatorReplayer`；未修改 R1/R2-A/PBC 的 schema、枚举、validator 或已审计语义。

## 官方枚举与实际数量

| 官方入口 | 已枚举范围 | 声明记录数 | 本次用途 |
| --- | ---: | ---: | --- |
| c100120 月报 current index | 14/14 页 | 251 | 227 个目标月报；原页面参数及官方 page.js 模板一并留存 |
| c105936 证券市场统计 archive | 126/126 API 页 | 1260 | 包含日报/周报，按真实月报标题登记；补 17 个目标月份 |
| c101950 “其他”主题 archive | 48/48 API 页 | 475 | 由真实 landing 面包屑到达；补 3 个目标月份 |

归档路径由 acquired landing 的实际 href 导航；channel 来自归档 meta，GET 模板与 pageSize=10 来自其实际引用的官方 render.js。API channel/page/rows/total、每条月报 JSON locator 都可从完整响应重放。没有猜文件编号、没有把第三方搜索结果计入 index。c100120 官方 channel 映射/API 首页也确认 total=251，未为同一集合重复全抓 API。

| 项目 | 本次结果 |
| --- | ---: |
| 目标月份 | 260 |
| 找到官方 landing 的月份 | 247 |
| 缺失且仍在分母的月份 | 13 |
| landing / attachment links / distinct attachment URLs | 247 / 247 / 247 |
| 成功取得附件 | 247 |
| distinct attachment SHA-256 | 246 |
| 附件响应 bytes（按 URL 获取计） | 18,024,517 |
| 正式采集日志的物理请求（含 redirect） | 694 |
| 获取 attempts / cache re-verifications | 692 / 229 |
| journal 全部响应 bytes（含失败/redirect） | 35,279,864 |
| SHA-256 raw archive 去重 bytes | 35,086,840 |
| 正式融资 observations | 0 |

13 个缺期：**2011-11、2017-01～2017-12**。已检查 source families 的分页与候选协调完整；这不证明全网归档穷尽或这些月份从未发布，因此全部保持 MISSING，不写 structural/not-yet。revision coverage、first release、attachment 历史版本时间仍未证明。

本次每个实际 landing 都只暴露一个附件候选；archive API 的 resource metadata 未发现遗漏的多附件。实现与合成回归覆盖首个附件错期、多个候选、不同 bytes 无法消歧、同 bytes 不同 URL、缺失/失败 bytes。不会把第一个链接当作权威；正文标题期次与 filename/landing 冲突也拒绝选择。2026-05 与 2026-06 两个 URL 当前返回相同 SHA，分别保留 URL、landing 与获取身份，不能据此证明修订或历史首发。

## 发布时间与 provenance

29 份 landing 使用可见“日期”；218 份使用保存的官方 index/API 同一条目作 publication fallback。源页 `PubDate` 同时被 meta others 明确标为“页面生成时间”，因此不把 2026 年页面生成日期误当成旧报告的发布日。原 meta、visible date、index entry 与 JSON locator 均留存。

例如 2026-08 landing 显示 2026-09-01，date-only safe clock 为 2026-09-02 00:00+08:00。此 clock 是页面发布证据的安全解释，不证明当前下载附件 bytes 自该日以来未发生变化；所有 first-release/attachment-version provenance 保持 UNPROVEN。

## 实际格式时代

| 观察窗口 | 实际格式 / 数量 | 字段结果与边界 |
| --- | --- | --- |
| 2005-01～2016-12（缺 2011-11） | XLS/OLE/BIFF：143 | 可解析 sheet、类型、dateMode、number format、合并与公式/cache；字段按每份表探测 |
| 2017-01～12 | 12 个缺期 | 无法确定 XLS→DOCX 的精确首月；2016-12 与 2018-01 是两侧证据，不能伪称相邻月份 |
| 2018-01～2020-05 | 真正 OOXML DOCX：29 | 原文表为境内主要股指涨跌幅、单位 %，没有目标融资字段；FIELD_MISSING |
| 2020-06～2026-08 | Word DOC/OLE：75 | 与前期真实 DOCX 的切换已核对 2020-05/06；不是 OOXML，无法执行本 slice 的 Word binary field probe，PARTIAL |

75 份 DOC/OLE 中，63 份名称与 MIME 声称 DOCX，12 份为 `.doc`；72 份容器含 macro/VBA 标记，未执行。后期 `.doc` / `.docx` 文件名反复切换，并不等于实际格式改变。逐期 filename+MIME+magic/container 与相邻期 evidence 见 `filenameFormatEras`、`transitionChecks`。

本次真实样本未发现 XLSX、PDF 或损坏 ZIP/OLE；这些格式、错扩展名、HTML 伪装、缺 part、损坏容器、公式无 cache、合并表头等由离线合成 fixture 覆盖。XLSX 与 DOCX 使用标准库 ZIP/XML；PDF 只识别并保持 unsupported，不 OCR。全部原始 bytes 保留。

## Field map 与 C2 条件

| 原字段层级 / 版式 | 原单位与时间轴 | C1 判断 |
| --- | --- | --- |
| XLS“首发筹资 → A股(亿元)” | 亿元；Excel typed date 或有明确日期列的原生月度标签；另列本年累计 | 唯一的境内 A 股当月金额候选可映射；B/H 股并列列不混入 |
| XLS“首次发行金额 → A股(亿元)” | 亿元；YYYY.MM（数值须有精确两位格式证据） | 保留原表头与格址；不把家数/批准/计划/非数值 token 当成实际金额 |
| XLS“再筹资 → A股 → 增发、配股、可转债” | 月度行及累计行共存 | 可转债混合，不能直接映射 Equity_Refinancing；不自行相加或扣除 |
| XLS“再筹资金额 → A股 → 公开增发、定向增发(现金)、配股、权证行权” | 月度；债券市场筹资另列 | 子项存在不等于冻结了权益再融资合计公式；专项 accounting map 仍未解决 |
| 真实 DOCX“境内主要股指涨跌幅” | %；MONTH 与年初累计范围、年值并存 | 原表完整探测，但 IPO/refinancing 缺字段，不能拿股指表补融资 |
| 后期 DOC/OLE | Word binary container | 表头/单位/period scope 未可靠探测，全部保持 unsupported/schema unavailable |

2009 年使用“日期”列及 YYYYMM，保留与 YYYY.MM/Excel serial 不同的源标签；2009-01 时间轴表头为空，仍保持 TIME_AXIS_HEADER_MISSING。只有明确的 MONTH 行可用于候选定位；YTD 单独记录，没有差分、没有补零。真实 0、空白、破折号、字段不存在和非数值 token 分开记录。完整公式/cache 原文在 ignored probe 中，未求值外链或宏；有无 cache、外链及 macro 标记都继续产生保守 blocker。

三个 workbook 各 sheet 的头部期次互相矛盾：2011-02、2013-01、2013-02。原始不同标题全部记录，不能通过只取“正确那张表”的标题隐藏冲突。

**IPO 字段条件就绪共 87 期**，连续窗口如下（仅字段条件，不等于 PIT/生产准入）：

- 2005-01～2007-03：27；2007-05～2008-12：20。
- 2009-02～2010-03：14；2010-06～2011-01：8。
- 2011-03～2011-10：8；2011-12～2012-09：10。

主要阻断：2007-04、2010-04/05 的 workbook 公式缺 cache；2009-01 缺时间轴表头；2011-02 等跨 sheet 期次冲突；2012-10 后部分 workbook 的外链/macro；DOCX 缺融资字段；DOC/OLE unsupported；13 个缺期。字段矩阵逐份保留准确 reason，不把整个 XLS era 一刀切为 PASS。

**refinancing 字段条件就绪 0 期；没有完整双字段 C2-ready era。** 以上 IPO 子窗口可作为后续 C2 独立审查输入。C2 仍需正式 definition、revision/first-release 和当前 bytes 的历史可见性证明；其余 era 继续 PARTIAL。没有实施 C2、R2-D、normalization/backtest 或 UI。

## 依赖与验证

真实 2005-12 BIFF8 原始 hash/size 与 P0 锚点一致，证明标准库 ZIP/XML 无法承担该 XLS probe。仅新增 `xlrd==2.0.2` 专用 requirements，不升级公共 Python/Office 栈。运行时 Python 3.13.9；已使用 ignored `--target` 隔离安装验证。许可为包 LICENSE 中 BSD 三条款主体及历史四条款条文；requirements 保留 David Giffin acknowledgment，不简化标成纯 BSD-3。CI 只增加该专用安装与离线 C1 测试步骤，不抓取官方 live 数据。

| 验证 | 结果 |
| --- | --- |
| `npm run test:market-regime:historical` | PASS，66 tests |
| `npm run test:market-regime:pbc` | PASS，69 tests |
| `npm run test:market-regime:catalog` | PASS，48 tests |
| `npm run test:market-regime:csrc-c1` | PASS，97 tests；CSRC-1～3、代表期摘录、证据图篡改与去重回归 |
| C1 完整 raw build/validate replay | PASS，247 份附件全部重放、260 期逐格重算 |
| 专用 xlrd==2.0.2 隔离安装 | PASS；离线专项测试通过，测试不自动安装依赖 |
| `npm test` | PASS，39 suites / 597 tests，未调整发现规则 |
| `npm run build` | PASS，TypeScript/Local Core/Vite/browser boundary/bundle gate；既有 >500 kB chunk warning |
| `npm run env:check` | READY WITH WARNINGS，43 PASS / 15 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `git diff --check` | PASS |

env WARN 是现有多 runtime、未固定公共 Python 依赖/pip check、未安装的四个项目外部 Skill managed copies、提交前 dirty/upstream、ignore 提示、旧数据格式与公告 partial。没有为消除 WARN 修改治理/数据。build 产生的两个 Vite tracked 文件仅换行状态，经空内容 diff 验证后恢复。

本次仅新增 CSRC 模块、plan/evidence/fixtures/专项 requirements、显式 npm 命令与最小 CI 安装/测试配置、本文。R1、R2-A、PBC、contracts/v1、local-core、src/public、默认 data:refresh、账户数据均未修改。完成普通 commit + push 后停止；不创建 PR，不合并，不开始 C2 或其他 slice。
