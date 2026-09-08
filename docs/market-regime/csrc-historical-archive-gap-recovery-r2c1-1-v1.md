# Stage 4.1 R2-C1.1 — CSRC Historical Archive Gap Recovery & Format Boundary Closure

日期：2026-09-09（Asia/Shanghai）。状态：受控官方归档恢复及 sidecar 实现完成；恢复 **0/13**，覆盖 **247/260，PARTIAL**。**exact XLS→DOCX transition unresolved**。formal financing observations = **0**，`formalObservations` 精确为 `[]`。没有实施 C2。

## 基线与交付身份

- actual base：`8c1230d6a64e5b9b2f307ded6581c684e07c0816`。开工 `git fetch origin` 后精确匹配 `origin/main`，工作树干净。
- main CI：`34243786799`，`completed / success`，headSha 与上述 base 相同；这是基线 CI，不冒称新功能分支已获 CI 或独立审计通过。
- branch：`feat/stage-4-1-r2c1-1-csrc-archive-gap-recovery-v1`，从上述 commit 新建独立 sibling worktree，未复用已合并 C1 分支。
- final HEAD：以包含本报告的交付 commit 为准（`git rev-parse HEAD`）；最终完整 SHA、remote SHA 和 0/0 同步证据在交付消息中列出，避免在 commit 内制造自引用 SHA。
- 停止点：普通 commit + push，核验 local HEAD = remote branch SHA、ahead/behind 0/0、干净工作树后停止；不创建 PR、不 merge main、不开始 R2-C2。

依据：[Scope Freeze §6、§10、CSRC-1～4](observation-catalog-r2-scope-freeze-v1.md)、[R2-A 核心](historical-dataset-r2a-core-v1.md)、[已审计 C1](csrc-attachment-inventory-schema-probe-r2c1-v1.md)、C1 plan / inventory evidence 及既有 parser。永久规则未重新设计。

## 本次新增官方发现范围

[中国证监会2017年政府信息公开工作年度报告](https://www.csrc.gov.cn/csrc/c101950/c1048063/content.shtml)确实称当年证券市场月报发布 12 期。本次保存完整官方响应，只将其作为 discovery hint；它不能建立任一月份的 landing、attachment、发布时间或历史版本事实。

所有非 seed 请求在发送和离线重放时，均从已保存的官方父页面 href、script/form tag、JSON 字段或真实分页参数推导。没有按 content ID / attachment ID 猜 URL。外部搜索仅发现线索，搜索引擎及第三方结果没有进入 source coverage。

| 新检查的 source family / path | 保存的依据与本次结果 | 完整性边界 |
| --- | --- | --- |
| 官方年度报告 → 当前统计信息 `tjsj/index.shtml` | 报告导航真实 href；当前栏目未列目标缺期 | 只检查此页面，不称历史索引穷尽 |
| 官方“归档数据” `c105974/common_list.shtml` | 报告真实 href，响应返回首页内容，无历史分页 | `ARCHIVE_ROOT_RETURNS_HOME_NOT_HISTORICAL_ENUMERATION`；不是归档覆盖 PASS |
| 机构概况 → 证监会年报 `c100024/common_list.shtml` | 保存导航和年报列表，包含 2017/2011 年报的实际链接 | 年报 PDF 链接只作线索，未下载/解析成月报，不计恢复 |
| 官方主题目录 `c101793`、主动公开 `c100035` | 页面 meta channelId + 引用的 `render.js`；真实 `getChannelList` 模板 | 子栏目代码来自官方 JSON，非猜测 |
| 按体裁分类 `c101951` → 统计信息 `c101970` | 官方 children JSON 的 channelCode/staticUrl；保存目录及目标页 | 与原 C1 的 `c105936`/`c101950` 搜索族分别记录 |
| `c100035` 下标题查询“统计数据” | `getSearch` 的 POST 参数来自保存的官方 `doSearch()`；**29/29 页、284 条**全部检查 | 完整的是该查询响应集合，不是全站历史档案 |
| `c100035` 下 13 个缺期的精确标题查询 | `2011年11月统计数据`、`2017年1月统计数据`～`2017年12月统计数据` 均返回 total=0 | 查询未命中不能证明从未发布 |
| `c101970` 标题查询“2017” | **7/7 页、63 条**；没有目标全国证券月报 | 保留期货月报/周报等其他结果，不混作证券月报 |
| `c101970` 查询“2011年11月”及“月报” | 前者 1 条期货统计，后者 0 条 | 期货统计不能替代全国证券月报 |
| `c101793` 与 `c100035` 查询“证券市场月报”“白皮书” | 均 total=0；另检查主题目录的两个精确缺期标题 | 只是已检查的标题检索路径 |
| 初期探索：`c101793` 查询“2017年”/“统计数据” | 分别 total=1904/271，各保存第 1 页 | 两项明确 `complete=false`；未为扩大抓取穷尽大范围年份查询，后续完整扫描更宽父目录“统计数据”集合 |
| 页面实际 form action `/guestweb4/s` | 仅 GET 端点探测，保存 200 空响应及官方 redirect 链；未提交该表单 | 空响应不能证明 POST 搜索不可用；本次采用另一个已验证的 `getSearch` 官方标题接口 |

关键词检索可能漏掉更名、未索引或迁移失败的条目，本站搜索也不能证明历史附件版本穷尽。以上阴性结果只支持“此次受控路径未恢复”，不支持 `SOURCE_ABSENT_CONFIRMED`、STRUCTURAL 或“月报从未发布”。

## 原 13 个缺口逐月结果

所有月份都留在 260 月分母中。共同 blocker 为 `NO_MONTHLY_LANDING_IN_INSPECTED_DISCOVERY_PATHS`；逐月 `checkedSourceIds` 绑定实际查询、分页与 retrieval IDs，见 compact evidence。没有仅凭年报或搜索标题创建 recovered landing。

| reportPeriod | 结果 | 本次取得月报附件 bytes | 实际 container |
| --- | --- | ---: | --- |
| 2011-11 | MISSING | 0 | 未知 |
| 2017-01 | MISSING | 0 | 未知 |
| 2017-02 | MISSING | 0 | 未知 |
| 2017-03 | MISSING | 0 | 未知 |
| 2017-04 | MISSING | 0 | 未知 |
| 2017-05 | MISSING | 0 | 未知 |
| 2017-06 | MISSING | 0 | 未知 |
| 2017-07 | MISSING | 0 | 未知 |
| 2017-08 | MISSING | 0 | 未知 |
| 2017-09 | MISSING | 0 | 未知 |
| 2017-10 | MISSING | 0 | 未知 |
| 2017-11 | MISSING | 0 | 未知 |
| 2017-12 | MISSING | 0 | 未知 |

上表 0 是本次实际下载文件的字节计数，绝不是融资值。`candidates=[]`、recovered=0；没有可列的 recovered month provenance chain 或新 field/schema evidence。

## 格式时代和业务边界

| 观察窗口 | 实际 container | 月份数 |
| --- | --- | ---: |
| 2005-01～2016-12，缺 2011-11 | XLS / OLE / BIFF | 143 |
| 2017-01～12 | MISSING，实际格式未知 | 12 |
| 2018-01～2020-05 | OOXML DOCX | 29 |
| 2020-06～2026-08 | Word DOC / OLE | 75 |

XLS→DOCX 两侧仍是 **2016-12 XLS / 2018-01 DOCX**，中间 12 个月全部缺失，结论 `UNRESOLVED`，没有收窄或闭合。逐月窗口和两侧 attachment attempt IDs 已写入 `formatTransition`；只有真实相邻月出现格式变化时才允许 `CLOSED`，有中间缺月只能 `NARROWED`。既有 2020-05/06 DOCX→DOC/OLE 事实未改。

旧 247 月 ledger 与原 C1 evidence 原样保留；C1 content hash 仍为：

`28453963bf0a453d69a0277d9eabdc4cd3b393e4f663d3cb8922478b06a18d80`

IPO 87-period field-conditions readiness 未变，refinancing readiness 仍为 0。2026-05/06 相同当前 bytes、不同 URL / landing / acquisition 身份继续保留。first release、historical attachment version 与 revision provenance 均未因此得到证明。

恢复 parser 复用 C1 的 MIME + magic + container 联合判断、XLS `xlrd==2.0.2` 和 DOCX ZIP/XML；DOC/OLE 字段仍 unsupported。宏不执行，外链不求值，无可信缓存不产字段就绪结果；扩展名/MIME 冲突、HTML 伪装、损坏容器、期次冲突不能恢复为合格附件。多个已取得的同 URL 不同 bytes 全部保留并 fail closed，不选择“最新下载”覆盖旧版本。

没有增加依赖、Office/LibreOffice/OCR 转换、融资 numeric vintage、accounting formula、YTD→MONTH 差分、normalization、backtest、Supply Composite、UI、R1/R2-A/PBC 合同或 validator、Local Core、migration 或真实账户数据。

## Artifact、determinism 与 durability

- [Recovery plan](../../config/market-regime/csrc-recovery-plan.v1.json)：74 个固定请求规格，真实官方路径、查询/分页、200 次物理请求预算。query 的 POST 仅用于只读 `getSearch`。
- [Recovery compact evidence](../../research-data/market-regime/source-catalog/csrc-c1/recovery-evidence.v1.json)：绑定原 C1 hash 和 plan hash，保存发现图、查询条目及 JSON locator、全部 retrieval、13-gap ledger、260-month overlay、format era/boundary、明确空 formal observations。
- `scripts/market_regime/csrc_recovery.py`：发送前校验发现依据；离线从 raw 重建同样的图、candidate/冲突、覆盖与格式结论。固定输入的 build 与 hash 稳定；真实新增 retrieval/cache provenance 会形成新 hash。
- `scripts/market_regime/csrc_retrieval.py`：保持 C1 默认行为，增加隔离 raw 目录和只读标题 POST；缓存 identity 包含完整 query form，避免同 endpoint 不同查询错用缓存。
- 新合成 fixture 明确 `SYNTHETIC_OFFLINE_ONLY_NOT_SOURCE_COVERAGE`。旧 C1 fixtures 不修改。

本次 recovery content SHA-256：

`9e76a9c0bb82fdf00571337c4c6daefc29bf8698c0a80db517d189eb048689ae`

| 本次 recovery sidecar acquisition 统计 | 数量 |
| --- | ---: |
| 物理请求（包含 redirect；不包含 cache verification） | 79 |
| acquisition attempts | 77 |
| SUCCESS / HTTP_ERROR attempts | 73 / 4 |
| cache re-verifications | 74 |
| response bytes（包含失败/redirect） | 3,352,736 |
| distinct final-response SHA-256 | 55 |
| 按 final-response SHA-256 去重的 bytes | 3,351,060 |
| 新月报 landing / attachment / bytes | 0 / 0 / 0 |
| 原 C1 attachment URLs / distinct attachment hashes / bytes | 247 / 246 / 18,024,517 |
| formal financing observations | 0 |

首次 acquisition 为 `2026-09-08T15:26:48.485299Z`，最后新增 acquisition 为 `2026-09-08T16:13:23.347941Z`。执行配置化 fetch 时验证缓存并再次记录空端点失败；这些不是虚报的附件成功下载。所有实际请求的 final URL、MIME、byte size、SHA-256、redirect 和时间见 retrievalAttempts。上表是本地 Collector 可审计统计，不把搜索引擎连接器、Git fetch 或 CI 查询的不可见底层请求算入其中。

完整 raw 位于 ignored `research-data/market-regime/raw/csrc-r2c1/` 和 `raw/csrc-r2c1-1/`，未进入 Git、src/public 或 SQLite。旧 C1 raw 在新 worktree 独立复制后完整重放验证；没有改动原 worktree。

**Durability 限制：ignored historical raw bytes 不等于 Git 中永久可重放的 source archive。** 只有保有该次完整 raw 和 retrieval journal 才能从字节重放本次证据。干净 clone 的 compact validate 只能验证提交内容、引用与派生结论一致，不能独立证明原始响应真实性或历史 PIT/immutability。重新联网得到的是新的来源快照，不保证恢复同样历史 bytes 或同样 content hash。

## 验证结果

显式联网 acquisition 与离线 validation 分开执行：此前受控 Collector 探索保留同一 journal，随后 `npm run data:fetch:market-regime:csrc-recovery` 按已保存官方路径复验；测试及所有 build/validate 不联网抓取来源。

| 命令 / 检查 | 结果 |
| --- | --- |
| `npm run test:market-regime:historical` | PASS，66 tests |
| `npm run test:market-regime:pbc` | PASS，69 tests |
| `npm run test:market-regime:catalog` | PASS，48 tests |
| `npm run test:market-regime:csrc-c1` | PASS，121 tests，含原 97 + recovery 24 |
| Recovery 专项回归 | 年度 hint/第三方/猜 URL、无 attachment/bytes、期次冲突、真实相邻与中间缺月、MONTH/YTD、空 observations、deterministic/hash、旧 247 月不漂移；另含同 URL bytes 变化、final URL 冒用、POST query cache 隔离 |
| `npm run data:build:market-regime:csrc-recovery` | PASS，0 recovered、13 missing、247/260；确定性 compact evidence |
| `npm run data:validate:market-regime:csrc-recovery` | PASS，从完整 raw 重放旧 C1 247 份附件及本次 discovery，精确匹配 committed evidence |
| `npm run data:validate:market-regime:csrc-recovery:compact` | PASS；不依赖 ignored raw，仅检查提交内容及派生结论 |
| 原 C1 full raw validate | PASS，原 content hash、247 月事实不变 |
| `npm run data:validate:market-regime:catalog` | PASS，verify-artifacts，0 errors |
| `npm run data:audit` | PASS，0 errors / 24 warnings / 10 skipped / 31 allowlisted |
| `npm test` | PASS，39 suites / 597 tests，未更改 test discovery |
| `npm run build` | PASS，TypeScript / Local Core typecheck / Vite / browser boundary / bundle gate；既有 >500 kB chunk warning |
| `npm run env:check` | READY WITH WARNINGS，43 PASS / 15 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `npm run --silent env:check:json` | READY WITH WARNINGS，43 PASS / 15 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `git diff --check` | PASS；提交前再次核对 staged 范围 |

运行时 Node 22.23.2、npm 10.9.8、Python 3.13.9、xlrd 2.0.2。未安装或升级依赖。env warnings 为既有多 runtime、未固定公共 Python 依赖/pip check、四个未安装外部 Skill managed copies、提交前 dirty/upstream、ignore 提示、旧数据格式与公告 partial。没有为消除 WARN 改治理/业务数据。

data audit 产生的审计时间/行号更新及 build 产生的 Vite 换行状态，经 diff 确认后仅恢复本次生成的非目标文件；验证日志保持 ignored。后续独立远端审计仍需核验 source provenance 和 durability 边界，本次 tests PASS 不构成 C2 或生产准入。

未解决 blockers：13 个月的官方月报 landing/attachment 链、XLS→DOCX 的真实相邻月迁移点、历史 first-release/attachment-version/revision provenance。它们保持 MISSING / UNRESOLVED / UNPROVEN，不阻止本次如实交付受控阴性恢复结果。
