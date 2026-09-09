# Master Audit Remediation V1

日期：2026-09-09。状态：**IMPLEMENTED / VERIFIED（本地验收）/ PENDING INDEPENDENT REVIEW / NOT MAIN MERGED**。

状态解释：本文是 versioned validation record；上述状态及交付描述属于 delivery-time / record-time status，后续 CURRENT 状态不由这些历史标签判断。下述精确 base 是本轮 remediation 的 pre-remediation / audit-input main baseline；实际 merge / CI 状态以包含本变更的 Git commit 是否成为 `main` ancestor、对应 PR 和 GitHub Actions 为准，静态文档不预写 MAIN MERGED，也不自证 CI PASS。

仓库 `lwd619783-byte/-`；精确 base `origin/main @ a6cbf108139a2af66273c5376288b83d54712f58`；分支 `codex/master-audit-remediation-v1`。开工 fetch 确认精确基线、工作树干净，直接从 origin/main 创建分支。最终 commit / remote SHA 在 push 后的交付消息中给出，避免提交自引用。

本记录只陈述本次修复与本地验证。未创建 PR、merge、修改 main、GitHub admin/ruleset 或 required checks。冻结 contracts、Stage 4.1 配置、sealed/raw、生成金融数据与迁移均无 diff；没有 Provider live refresh、历史抓取、依赖升级或第二套模型。

## Findings 与运行反证

| Finding | 结论 | 修复前运行证据 | 最终行为 / 直接覆盖 |
| --- | --- | --- | --- |
| MA-01 | FIXED | `npx vitest run src/data/stocks.test.ts src/services/stockProvider.test.ts` 的首轮 3 个反证均失败；其中高等级无来源 seed 返回“已验证” | 无来源只产生人工研究线索 / manual_unverified / 低 / 待验证；顶层徽标从具体证据派生；7 个 evidence tests |
| MA-02 | FIXED | `npx vitest run src/services/browserStaleWrite.test.ts` 首轮 10/10 反例失败；两个 Repository/Store 共用 Storage，S0 → A review/correction → stale B save 返回成功 | B 被拒绝、A 的 raw 和追加历史不变；新增 16 tests 覆盖同实例 reload、同时间戳变化、corrupt raw、import、reset、迁移和写失败 |
| MA-03 | FIXED | 固定 `2026-09-07T12:00:00Z` + temp SQLite，新增 19 场景：修复前 11 PASS / 8 FAIL；future completed/partial DCA import 实际可 `ready → commit`，各写 1 execution + 1 Audit | 手工 CashFlow/Position、混合 CashFlow 批次、手工和 import 的完整未来 completed/partial DCA 均拒绝；19/19 PASS |
| MA-04 | FIXED | 隔离目录内原标准命令扫描 3 个 nested checkout suites 并报 `No test suite found` | 当前标准命令只发现 43 个正式 suites；基线 39 个全部保留；离线 CI 新增 SSE/SZSE/BSE/all-A、D2 validate、discovery gate |
| MA-05 | FIXED | 上述首轮 3 个反证另有 unsupported=100、缺失 priceHistory 未记录 | 字段 numerator/denominator/N/A 与 8 模块状态分开；10 个覆盖率 tests + 6 个组件 tests |
| MA-06 | FIXED | CURRENT registry/index/roadmap 仍把 R2 整体当下一项未实现；Git ancestry 已包含 PR #26～#37 | 按当前 committed artifacts 登记 R2-A/B、CSRC、三所与 D2；保留 PARTIAL / NOT_ADMITTED，不回写历史审计 |

MA-03 反证中，已有 Transaction future guard 以及 Transaction/CashFlow/Position import future guard 均 **NOT_REPRODUCED**，沿用既有门禁。合法 future DCA Plan/revision、零成交 planned/deferred/cancelled、已发生 linked tradeDate 且 period 延伸未来的正例保持 PASS。

### MA-01 来源语义

seed 的 evidenceLevel、verificationStatus、核心池/观察池身份不构成来源证据。没有 evidenceItems 时，不推断年报、机构纪要、公开披露或已核验关系。显式 evidenceItems 的 HTTP(S) URL 必须可解析、无 userinfo/空白控制字符，日期须为严格 calendar date 或带时区 instant；满足定位条件时保留原显式核验状态，不自动提升 pending。缺失/非法定位信息降为待核验；不执行网络核验，不把“URL 存在”表述为本轮已验证原文内容。与 registry `evidence-items` 的 manual_unverified 治理边界一致。

### MA-02 persisted base 与限制

Repository 将 `load()` 时取得的完整原始字符串（包括未知合法字段和原序列化形式）绑定到该 envelope 的 WeakMap identity。普通 Store 保存传入原读取对象作为 base；写前比较当前 persisted raw，成功后仅为返回的新 envelope 绑定新 raw。另一次 load 不改变旧 envelope 的身份；时间戳不作为版本凭据。无绑定对象只允许 against Repository constructor 实际读到的 absent base 做首次初始化；已有 persisted data 不能用任意内存对象覆盖，读取失败也不获得写权限。

merge import 同样检查 base；replace 是用户主动替换导入历史，仍要求已审阅 base 未变化，并先备份精确 persisted raw，再在正式写前复查。reset 是已有独立用户确认的删除操作；App reset 后重新 load 绑定后续保存基线。corrupt raw 不会被普通保存清空。

**Residual limitation：LocalStorage 没有跨标签页原子 CAS。** 本实现保证在最后一次同步 `getItem` 时已改变的 base 被拒绝；另一标签页恰在该读取与 `setItem` 之间写入仍存在理论竞态。没有把 storage event、时间戳或本地锁冒充强事务；不自动合并 append-only 历史，也没有迁移 IndexedDB/SQLite。

### MA-03 合同边界

共享 `requireObservedFactDate` 对手工事实使用 operator clock 的现有日粒度，对 import 使用经过既有校验的 `bundle.asOf`。拒绝失败保持 atomic transaction：无正式事实、成功 receipt 或 Audit。未改变 approval、idempotency、migration、append-only 与账户 reconciliation。

linked DCA 以已关联 Transaction tradeDate 为事实日期；unlinked completed/partial 只在整个 interval 位于未来时确定拒绝。不把 periodEnd 当成交时间，不解析 display-only period，不禁止合法计划，不引入金额公式。

**既有 CONTRACT_GAP 保留：** legacy undated DCA 仍按原门禁 blocked；无 linked transaction、横跨当前日的 interval 没有精确成交日字段，V1 无法进一步证明实际成交时刻，本轮不扩 contract、不回填日期。此限制不影响用户指定的“完全未来期间”场景已修复结论。

### MA-05 覆盖定义

`dataCoverage` 仅为当前已映射行情/财务数值字段的百分比，`dataCoverageDetails` 给出 numerator、denominator、excludedFields 和模块状态；不是全公司资料完整率、来源真实性或准入评分。

| 适用数据 | 当前映射字段 |
| --- | --- |
| A 股行情 6 项 | latestPrice、pctChange、marketCap、floatMarketCap、pe（优先 peTtm）、pb |
| 港股行情 7 项 | latestPrice、pctChange、marketCap、pe、pb、ps、dividendYield |
| A 股财务摘要 6 项 | revenue、netProfit、operatingCashFlow、grossMargin、netMargin、debtRatio |

分母由已有 Tencent/yfinance/财务 summary 映射定义，不按当次返回值删字段；无正式映射的 A 股 PS/dividend、摘要 ROE、港股 float cap 与未实现港股财务不硬塞分母。已实现行情/财务整个模块 missing 时，适用字段仍进入分母。unsupported / not_applicable / not_implemented / mock 排除并保留模块状态；分母 0 时 percent=null、UI=N/A。

有限真实数值（包括 0）可计入分子；null、非有限值、失败/冲突不计入。partial/stale 中可用真值仍可计字段覆盖，partial 与 freshness 分别展示。8 模块逐项状态涵盖 quotes/financials/profiles/priceHistory/research/announcements/signals/sectorMembership；UI 在 ratio 旁展示缺失/失败、部分、未适用/未接入数量。12/12 不代表其他模块完整或数据新鲜。排序按字段覆盖，N/A 放末尾。

## 最终本地验收

| 命令 / 验证 | 结果 |
| --- | --- |
| `npm run local:typecheck` | PASS |
| `npm run contracts:validate` | PASS：5 schema roots / 40 definitions；没有扩合同 |
| `npm run test:contracts` | PASS：106 tests |
| `npm run test:local-core` | PASS：261 tests；原 242 + 新 19，temp SQLite only |
| `npm run test:market-regime:catalog` | PASS：48 |
| `npm run test:market-regime:historical` | PASS：66 |
| `npm run test:market-regime:pbc` | PASS：69 |
| `npm run test:market-regime:csrc-c1` | PASS：183；原通配脚本覆盖 C1/recovery/C2A1/C2A2 |
| `npm run test:market-regime:sse` / `szse` / `bse` / `all-a` | PASS：22 / 37 / 25 / 40 |
| `npm run data:validate:market-regime:all-a` | PASS；6 matrix rows，NOT_ADMITTED / 0 / null；validate 以 frozen D1 inputs 重建比较，committed report 无 diff |
| 标准 `npm test` | PASS：43 suites / 636 tests；原 39 suites / 597 tests 全部保留，新增 4 suites / 39 tests |
| `npm run test:discovery` | PASS：1 隔离 integration check；原命令复现 3 nested failures，真实 package/config 的标准命令精确保留当前 43 suite paths |
| `npm run data:audit -- --no-write` | PASS：P0=0、errors=0、warnings=24（P1=10、P2=14）；使用既有 no-write 模式避免改写历史 audit 文档 |
| `npm run build` | PASS：browser graph 2293 modules / 1 chunk、forbiddenModules=0；financial/announcement/guidance bundle gates errors=[] |
| `npm run env:check` / `npm run env:check:json` | 均 exit 0；提交前各 48 PASS / 10 WARN / 0 FAIL / 4 SKIP；READY WITH WARNINGS |
| `git diff --check` | PASS |

上述不同正式测试入口合计 1494 tests/checks：Vitest 636 + Local Core 261 + contracts 106 + Market Regime 490 + discovery 1；不重复累加前述定向复跑或 fixture sentinel。没有把本地验证写成远端 CI PASS；当前 CI 仅在 PR 或 main push 触发，本分支普通 push 不构成 CI 运行证明。

## Warnings 分类

| 分类 | 既有事项 | 处理 |
| --- | --- | --- |
| ACTIONABLE | env `security.ignore-rules`：`.ssh-private` / `.provider-observations` 未匹配 ignore | 范围外遗留规则建议；本次 diff/暂存检查无这些目录或敏感材料，不扩充治理文件 |
| ACCEPTED | audit 6 项 partial/source limitations：announcements、earnings-preview、earnings-flash、expectation-company-guidance、expectation-company-guidance-provider、valuation；11 项 evidence-governance | 保留诚实缺失/人工证据状态，不为清 warning 伪造已核验或扩大准入 |
| ACCEPTED | audit 3 项 dev-health `missing-to-zero`：版本 minor/patch 与 manifest partial/error 统计 | 非金融数值，属于工程计数；不新增宽泛 allowlist |
| ACCEPTED | env 公告 30 partial；build 既有 >500 kB chunk 提示 | 数据覆盖与性能边界已显式存在；bundle gate PASS，不进行 scope 外拆分 |
| ENVIRONMENTAL | Node/Python/Git 多路径、mootdx/httpx 的 pip check 不匹配；Git LF→CRLF 提示 | 当前使用 Node 22 / Python 3.13，要求的离线验收全部通过；不改本机环境或依赖 |
| DEFERRED | audit 4 项 capability-gap：hk-financials、broker-research、institution-consensus、eps-net-profit-forecast | 缺正式 Provider / 来源或现有 NO_GO，保持 NOT_STARTED / 未接入 |
| DEFERRED | env 4 个未固定 Python 数据依赖、旧 generated schemaVersion 缺口、未消费 announcements.generated.json | 原始生成链/依赖/数据不在本次范围；未删除历史产物 |
| OBSOLETE（交付后以 Git 实测为准） | env 提交前 `git.worktree` WARN；历史 nested-worktree 标准测试失败 | 本轮必要 diff 将正常 commit；discovery 已由标准 npm test + fixture 实测修复。历史报告中的旧失败不回写 |

env 4 SKIP 保留其原检查定义：可能写数据的 validator/health/UI audit，以及依赖 dist 的 build:check；本轮另外执行完整 build 和 bundle gate，不能将这四项伪写成 env 已执行。

## 当前 R2 与交付文件

当前 R2 计数从 committed final evidence 与 Git ancestry 复核：PBC 894 observations、主窗口 M2 256/260、AFRE 余额 129/140/同比 111/140；整体仍 PARTIAL。CSRC indexed 247/260、13 gaps、recovery 0/13、87 field-ready、26 definition-compatible、PIT 0/26、formal observations=0。三所 D1 历史数值仍未准入。

all-A 六个 era/field 均 **NOT_ADMITTED / numericAggregateCount=0 / targetCount=null / coveragePercent=null**，observations=[]、dailyGrid=null；business hash 保持 `4ba8737f2dc9e0ba32a35249b36b07075253ea9a11270b67be78029f9ff3b3c1`。未提升 R2 admission，未授权 normalization/backtest/Market Temperature UI。

| 范围 | 修改文件 |
| --- | --- |
| MA-01 | `src/data/stocks.ts`、`src/data/stocks.test.ts` |
| MA-02 | `src/services/persistedBaseGuard.ts`、`watchlistRepository.ts`、`watchlistStore.ts`、`earningsExpectationRepository.ts`、`earningsExpectationStore.ts`、`browserStaleWrite.test.ts`；`src/App.tsx` 仅 reset reload |
| MA-03 | `local-core/domain/asset-invariants.ts`、`asset-service.ts`、`asset-import-service.ts`；`local-core/tests/assets.node.mjs` |
| MA-04 | `.github/workflows/ci.yml`、`package.json` 的 test/test:discovery、`vitest.config.ts`、`scripts/tests/test-discovery.node.mjs` |
| MA-05 | `src/utils/stockCoverage.ts`、`src/types/index.ts`、`src/services/stockProvider.ts`、`stockProvider.test.ts`、`dataProvider.test.ts`；`src/components/stock/StockCard.tsx`、`StockPool.tsx`、`StockDetailDrawer.tsx`、`StockCoverage.test.tsx` |
| MA-06 | `docs/feature-registry.md`、`development-execution-plan-2026-09-07.md`、`investment-dashboard-v2-post-phase-1b-roadmap-rebaseline.md`、`architecture.md` 的导航及本记录 |

MA-02 另经独立子任务只读复核：16/16 tests 与 5 个额外 constructor/旧对象基线断言通过。三个 stock TSX 的 React Skill 精简检查没有发现新增 hooks/effects/请求或 Node-only import。以上属于本地协作验证，不能替代 push 后的独立远端审计。
