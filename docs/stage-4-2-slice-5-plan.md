# Stage 4.2 / Slice 5 — Industry Dimensions + Multi-factor Snapshot V1

状态：**FROZEN SOURCE OF TRUTH / D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。2026-09-18。

精确 fetch 基线：`8497ac9199def1fbec420eecc6ad7b7305ce160d`；分支 `codex/stage-4-2-slice-5-industry-dimensions-snapshot`。PR #62 已合入，PR CI 35335279897 / main CI 35335680417 success；同 SHA 的 Vercel Production deployment 6522548855 success / READY，已实时核验。CURRENT 文档补齐此事实，历史交付记录不回写。

## 1. 冻结范围及优先关系

本 Slice 唯一业务链为 **Metric → Industry Dimension → Multi-factor Snapshot**。本文件在 Slice 5 范围内 supersede Slice 4 plan §10 的 Prosperity / Regime follow-on 建议；战略 Stage 顺序不变。原 `industry-metric.v1` 与既有 3 个 source-fact owners（plan/artifact/binding/raw/manifest）保持原字节及语义。

- 新增独立 `industry-dimension-mapping.v1` config/schema，复用既有 F1 Pin 精确绑定 industryId、metricId、definitionRef（包含 revision/digest/locator）及受控 dimension / 可选 subdimension。
- 受控维度为 demand、supply、inventory、price、margin、utilization、capex、policy、valuation、trading_state、trade_flow。不按名字推断，不按 industry fallback。
- 原产量 → supply/output；官方同比 → supply/output_growth；商业库存 → inventory/crude_stocks。新增 EIA 候选只有 D0 GO 后才入 owner/Registry/mapping。
- code-reviewed mapping 内容锚点独立于 source-fact owner；未知/重复/foreign metric、industry、pin、dimension 或合法但未经审查的维度替换 fail closed。缺少映射或没有 owner 的维度显示缺失，不借指标补齐。
- 只读 snapshot 从 Registry Provider 精确发现并校验 mapping，沿用 `industryHistory` 的槽位、末期、状态、固定分母、冲突抑制及 `industryChartAudit`/EvidenceDrawer。不得用较早值填补缺失末期；保留 0。
- UI 按供给、需求/炼化、贸易流、库存等分组，中文默认展示；技术字段进入既有高级审计区。空维度明确缺失。原指标历史/证据界面与 robotics 保留。

## 2. D0 及来源计划

调查 EIA 官方 Petroleum history，已在官网发现 WCRFPUS2（美国原油产量）、WCREXUS2（美国原油出口）、WCRRIUS2（美国炼厂原油净投入）；均为 weekly、Thousand Barrels per Day。拟分别对应 supply/crude_production、trade_flow/crude_exports、demand/refinery_input。

只选择上述少量 series；进口、利用率不作为凑覆盖的替代项。每项必须通过官方 HTML 标题、精确 XLS 链接、weekly header、日期/数值解析与 retained bytes/manifest 重放后才能 GO；否则单列 NO_GO 并跳过。无需 API key 或非官方来源。

每项独立 plan/definition、artifact、F1 binding、Registry entry、manifest 与 reviewed adapter owner allowlist；共用既有 EIA parser/replay 架构，保持旧库存 owner 的默认接口和字节。新值的明确窗口为 2026-07-03 至 2026-09-11（11 个周末标签，须以 raw 支持为准）。流量为官方周频日均速率，不是周累计，不乘以 7，不代表海运量；炼厂投入只表示美国炼化用油这一需求子维度，不代理全球终端/油运需求。

HTML 是确定性数值重放输入，XLS 是同页官方留存旁证，不能宣称 XLS 已数值解析。Manifest 记录 URL/finalURL/status、raw 路径、SHA-256/长度、实际 acquiredAt。日期型页面 Release Date 不推导逐记录 publicationDateTime/releaseAvailableAt；null、UNPROVED、unknown、candidate、NOT_ADMITTED、F1 NOT_READY 均保留。新增 series 的 Registry presentation.delta 固定 none。

## 3. 明确禁止

不生成 weekly delta、趋势、综合方向、Prosperity Score/Regime、bullish/bearish、行业景气上行/下行 Claim、Thesis、交易结论。Snapshot 不输出 delta；原历史面板仅沿用原有正式 presentation policy。不得把新增 owner 数量、维度覆盖、parse/replay PASS 或 Vercel READY 当成 data/production admission。无新 Evidence Graph、Entity、事件存储、业务写入、调度刷新、MCP 或 Portfolio。

UI 必须逐字显示：**当前为多因子基本面快照，不构成行业景气评分或投资结论。**

## 4. 验收及交付

- source-specific replay/adversarial：原始 digest/manifest、series/title/unit/frequency、reviewed plan、adapter/owner/path、artifact/binding、missing/zero/conflict、pin 与合法维度替换；原 3 owners 对基线逐字节比较。
- dimension/snapshot：schema/version、精确 identity/pins、重复拒绝、Registry/mapping 顺序不敏感、非目标行业不借用、缺失维度不填补、missing/stale/conflicted/not_admitted/unknown 传播、无评分/Claim。
- `npm run test:industry`（Python/Node/Vitest）、`npm run data:validate:industry`、`npm test`、`npm run build`、`npm run data:audit`；合同验证与受影响 F1/F2 门禁。
- neon/pro/light × 320/390/1536 核心浏览器检查；snapshot/metric/EvidenceDrawer、中文/高级审计、official URL/raw SHA、空行业、robotics 回归、无业务写入/网络采集。
- 同步 feature registry / development execution CURRENT；因新增语义映射与只读投影边界补 architecture，战略路线仅同步本 Slice 范围收窄。
- 普通 commit + push，核验 Final SHA、ahead/behind、clean 后停止等待独立审计；不 PR、不 merge、不改 main。Hosted CI 未发生时记录 NOT_RUN。

## 5. D0 与最终验证记录

### D0：三项 GO，零项 NO_GO

| EIA exact series | D0 | 新增正式 Registry owner | Dimension / subdimension | 窗口首值 → 末值 | 官方来源 |
| --- | --- | --- | --- | --- | --- |
| `WCRFPUS2` | **GO** | `US_EIA_CRUDE_PRODUCTION` | supply / crude_production | 13860 → 13944 | [HTML](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=WCRFPUS2) · [XLS](https://www.eia.gov/dnav/pet/hist_xls/WCRFPUS2w.xls) |
| `WCREXUS2` | **GO** | `US_EIA_CRUDE_EXPORTS` | trade_flow / crude_exports | 3262 → 4831 | [HTML](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=WCREXUS2) · [XLS](https://www.eia.gov/dnav/pet/hist_xls/WCREXUS2w.xls) |
| `WCRRIUS2` | **GO** | `US_EIA_REFINERY_CRUDE_INPUT` | demand / refinery_input | 17024 → 17330 | [HTML](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=WCRRIUS2) · [XLS](https://www.eia.gov/dnav/pet/hist_xls/WCRRIUS2w.xls) |

三项均 weekly / U.S. / Thousand Barrels per Day，各 11/11 槽位，2026-07-03 → 2026-09-11。进口与炼厂利用率本轮未选用，属于 DEFERRED，不冒称 NO_GO。三个页面 Release Date 均为 2026-09-16；只保留日期标签，逐 observation publicationDateTime/releaseAvailableAt 仍 null。官方 HTML/XLS URL、scope、definition/policy/artifact/binding pins、manifest 与映射完整清单：[D0 机器记录](stage-4-2-slice-5/d0.json)。

| Series / retained role | 原始字节长度 | SHA-256 | 实际采集 UTC |
| --- | ---: | --- | --- |
| WCRFPUS2 / SERIES_HISTORY | 237357 | `69b993b68e7d49d0d675f066372357344176656b01b3d7e084d41cbbbbaf055a` | 2026-09-18T11:00:39.048032+00:00 |
| WCRFPUS2 / OFFICIAL_DOWNLOAD | 129024 | `8487f90eac9e970a4a7b4dead82f31d88c4451ad4966e7a3dd17882a984d9b53` | 2026-09-18T11:00:50.094286+00:00 |
| WCREXUS2 / SERIES_HISTORY | 190518 | `81bd962fbf947e9e1a0b79edd7955b35c62b435569fa786057f0b347416acdcd` | 2026-09-18T11:00:37.409491+00:00 |
| WCREXUS2 / OFFICIAL_DOWNLOAD | 105472 | `c7ead51f455b9be3a5573ad381e33f5e4447380dcfc497e07be5e1df82c1d555` | 2026-09-18T11:00:46.336719+00:00 |
| WCRRIUS2 / SERIES_HISTORY | 241511 | `5a574df59f0103966ea85777a7efc0851656c0f3e0d9d070595c6f82b9119678` | 2026-09-18T11:00:37.245926+00:00 |
| WCRRIUS2 / OFFICIAL_DOWNLOAD | 130048 | `828dc0779fd77fc75d2f4825dcf94a4c630a66a7aec65268b206a7fd5c97b780` | 2026-09-18T11:00:46.249586+00:00 |

每个 owner 独立留存两份 raw；HTML 使用原 `parseEiaPetroleum` 重放，XLS 仅校验文件格式并保留旁证。`eia-reviewed-owners.mjs` 固定三个 plan/manifest digest；`eia-artifact.mjs` 复用旧 builder 并接收显式审核 owner，默认旧库存接口不变。Manifest 的 exact series/frequency/双 capture roster/URL/role 也独立校验。没有动态执行配置、按行业 fallback 或近似替代。

### Dimension / Snapshot 实现

| Industry | Metric | Dimension | Subdimension |
| --- | --- | --- | --- |
| robotics | `CN_NBS_INDUSTRIAL_ROBOT_OUTPUT` | supply | output |
| robotics | `CN_NBS_INDUSTRIAL_ROBOT_OUTPUT_YOY` | supply | output_growth |
| oil-shipping | `US_EIA_COMMERCIAL_CRUDE_STOCKS` | inventory | crude_stocks |
| oil-shipping | `US_EIA_CRUDE_PRODUCTION` | supply | crude_production |
| oil-shipping | `US_EIA_CRUDE_EXPORTS` | trade_flow | crude_exports |
| oil-shipping | `US_EIA_REFINERY_CRUDE_INPUT` | demand | refinery_input |

`industry-dimension-mapping.v1.json` 是独立语义配置，schema 引用原 F1 Pin；不修改 `industry-metric.v1`。共享 Node/browser `createIndustryDimensions` 核对完整 definition pin、version、owner 身份、重复项、维度枚举，并校验排序规范化后的 reviewed 内容摘要。仅改变 Registry/config/JSON 字段顺序不改变结果；将 supply 改成合法的 demand、换 subdimension、重新封装一致的新 pin 或删除 mapping 仍拒绝，不能靠通过 schema 绕过 review。未来新增映射须 code/config review 后更新该锚点，不自动 reseal。

`industrySnapshot.ts` 为 `industry-multi-factor-snapshot.v1` 只读投影；按 11 维固定词表输出缺失维度，各 metric 的不同正式 basis 独立展示。来源、最新留存末期、单位、窗口覆盖、状态与时间/准入限制均取原 history/owner；快照无 delta/score/trend/direction/Claim 字段，无持久化。新增 EIA Registry delta=none；原 NBS history 的已授权差额行为不变。

Oil-shipping 最终 **4 个研究维度：supply / demand（仅美国炼化投入）/ trade_flow（美国原油出口）/ inventory**；4 个 EIA owners。Robotics 仍 2 个 NBS owners、supply 维度，展示各自 monthly / year_to_date。其他行业 11 维均显式 missing，不借 oil-shipping 数据。已有通用 Signal/Event 投影可枚举新增 owners，但没有新增计算、正式事件存储或综合结论。

默认 UI 是中文；默认折叠高级审计，EvidenceDrawer 保留 exact metric、全部 pins、candidate、raw SHA/locator/row 与官方 URL。已检查两行业、三主题和窄屏截图，未发现本次新增溢出；只读交互零 storage writes / external acquisition / downloads。

### 实际验证

| Gate | 结果 |
| --- | --- |
| Source-specific replay / adversarial | PASS；各新增 owner 的 raw/manifest/plan/artifact/binding、series/title/unit/date/header、0/missing、非法 adapter/foreign owner、数字/分母/时间/Evidence promotion 被拒绝 |
| Original owner 字节/pins | PASS；基线 fixture 固定 21 个原文件 SHA（包含两个 manifest、全部原 raw/旧 XLS、三个 plan/artifact/binding、原 V1 schema）与原 3 条 Registry entries，无意外变更 |
| `npm run test:industry` | PASS：8 Python + 63 Node + 87 Vitest（11 files） |
| `npm run data:validate:industry` | PASS：6 owners，2 sources；原 schema/F1 + exact replay + dimension schema/review checks |
| `npm test` | PASS：887 tests / 74 files |
| `npm run build` | PASS：TypeScript、Local Core typecheck、browser boundary、bundle budget；已有 >500kB chunk warning |
| `npm run data:audit` | exit 0；0 errors / 0 P0；34 非阻断 warnings（P1 20、P2 14），含新增 3 owners 的 partial/full declared-window 提示与准入限制，共新增 6 条 |
| `contracts:validate` / `test:contracts` | PASS；106 Local Core + 78 Financial Research contract tests；F1/F2 原合同不变 |
| `data:validate:semantic-bindings` | PASS：原 28 bindings；新增 Industry bindings 由每 owner replay 的原 validateBinding 校验；不提升 readiness |
| `test:discovery` / `ui:audit` | PASS；74 正式 suites 保留；静态 UI audit 无 high-risk legacy classes，不替代浏览器证据 |
| 浏览器 | PASS：1038 checks，neon/pro/light × 320/390/1536；0 runtime errors；既有 favicon.ico 404 warning |
| Hosted CI / independent audit | NOT_RUN / PENDING；本切片没有 PR 或 main push，不以本地检查代替 |

首次 UI fixture 误引入 node:crypto 被既有 browser-boundary gate 拒绝，已改为纯 UI fixture；未降低任何边界，随后专项及全量测试通过。浏览器报告源码摘要按 Git UTF-8/LF text blob 计算（原始 source raw 仍逐字节 hashing），避免 Windows CRLF 与 clean checkout 不一致。截图使用正常移动 viewport，避免 element 长截图把固定底栏拼入内容；数据和应用代码未为截图改动。

[浏览器报告与源码 hashes](stage-4-2-slice-5/report.json) · [oil 桌面](stage-4-2-slice-5/oil-shipping-neon-1536.png) · [oil 390](stage-4-2-slice-5/oil-shipping-light-390.png) · [robotics 320](stage-4-2-slice-5/robotics-pro-320.png)。复现：先 build / preview，配置 `UI_REVIEW_ORIGIN` 与已有 `UI_REVIEW_PLAYWRIGHT_MODULE`，运行 `node scripts/industry-snapshot-browser-check.mjs`；不安装依赖。

### 限制和停止点

仍明确禁止：新 weekly delta、趋势/综合方向、行业景气评分或上行/下行 Claim、bullish/bearish、Thesis、交易结论。DATA/PRODUCTION **NOT_ADMITTED**、PIT **UNPROVED**、Entity **UNRESOLVED**、F1 **NOT_READY**；F2 正式 Graph、F3 actual service、历史 vintages/revision continuity、自动刷新 SLA 未提升。本次“正式 owner”仅表示进入经审查 Registry 的来源事实对象，不表示生产准入。

实现与 CURRENT 文档同步完成；普通 commit/push 后即停止，等待独立审计。最终 SHA 与远端 ahead/behind/clean 由交付回复实时核验，本文不预写 merge 或 Hosted CI PASS。
