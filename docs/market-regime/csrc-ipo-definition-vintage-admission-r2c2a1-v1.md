# Stage 4.1 R2-C2A1 — CSRC IPO Definition & Vintage Admission Gate V1

状态：IPO definition/mapping 与 admission evidence 已实现，等待普通 push 后的独立远端审计。**正式融资 observations = 0；87 期严格 PIT eligible = 0。** 本文件不授予 C2A2、refinancing 或 production admission。

## 基线与交付身份

- Actual base：`cfe07bc36142e5f9a4ff793f3ff1758ad07510cd`。开工 `git fetch origin` 成功，`origin/main` 精确匹配；原工作树干净。
- main CI：[run 34253911672](https://github.com/lwd619783-byte/-/actions/runs/34253911672)，核验为 `completed / success`，headSha 与 actual base 相同。
- Branch：`feat/stage-4-1-r2c2a1-csrc-ipo-vintage-admission-gate-v1`；从 actual base 创建独立 sibling worktree，未切换或修改原工作树/main。
- Final HEAD：本提交的 commit SHA 在最终交付消息中报告，并与普通 push 后的远端分支 SHA 精确核验；不在该提交内写入自引用 SHA。独立审计应使用实际远端 tip 和 `git merge-base HEAD origin/main`，不要把本行当作 SHA 证明。
- 停止点：普通 commit + push，local HEAD = remote SHA、ahead/behind = 0/0、工作树干净。无 PR、merge、C2A2 或 refinancing。

事实源：AGENTS、[Scope Freeze §3、§6、§9～11 / CORE-1～6 / CSRC-3/4](observation-catalog-r2-scope-freeze-v1.md)、[R2-A](historical-dataset-r2a-core-v1.md)、[C1](csrc-attachment-inventory-schema-probe-r2c1-v1.md)、[C1.1](csrc-historical-archive-gap-recovery-r2c1-1-v1.md)、原 C1 plan/evidence、现有 field map/schema/inventory、R2-A schema/validator 与相关 tests。本次未修改这些已审计输入。

## 交付内容与结果

- [IPO versioned definition/mapping config](../../config/market-regime/csrc-ipo-admission.v1.json)：1 个 CSRC 专用 definition，29 个按完整 C1 schema signature 冻结的 mapping records；每个保留原始层级、坐标、合并单元格、同级列、单位、注释和精确候选月份。
- [87-period admission matrix / compact evidence](../../research-data/market-regime/source-catalog/csrc-c2a1/ipo-admission-evidence.v1.json)：逐月 extraction、publication、attachment acquisition、admission blockers；另有完整 260 月覆盖 overlay，保留 C1/C1.1 ledger。
- `scripts/market_regime/csrc_ipo_admission.py`：只接受已审计 C1/C1.1 输入，离线重放、definition gate、vintage evidence gate、确定性构建及完整/compact 两种验证。没有网络命令、正式 catalog/vintage writer 或接受调用者“已证明”标记的绕过入口。
- 31 个 C2A1 tests 和明确标为 synthetic 的 adversarial fixture；新增 4 个显式离线 npm commands。

| 指标 | 结果 |
| --- | ---: |
| 正式目标窗口 | 2005-01..2026-08，260 月 |
| C1 字段条件就绪 candidate subset | 87 |
| definition 版本 / mapping 版本 | 1 / 29 |
| definition-compatible candidates | 26 |
| definition 归月依据仍未证明 | 61 |
| historical PIT 可证明 / first release 可证明 | 0 / 0 |
| 仍 UNPROVEN candidates | 87 |
| 明确报告的零值 extraction | 20 |
| 未来 C2A2 eligible periods | `[]` |
| formal financing observations | **0** |

候选子集精确为 2005-01..2007-03（27）、2007-05..2008-12（20）、2009-02..2010-03（14）、2010-06..2011-01（8）、2011-03..2011-10（8）、2011-12..2012-09（10）。它不是完整 CSRC coverage，也没有改变原 247 个 indexed / 13 个 missing 的 C1/C1.1 结论。

## Definition 判定

旧 `csrc-monthly-artifact-v1` 的 metric 为 `CSRC_MONTHLY_REPORT_ARTIFACT`、unit 为 `artifact`，仅表达附件索引，不能表达 IPO 金额。没有将其改成金额 definition，也未强行复用。新 `csrc-ipo-a-share-listing-month-v1` 遵守现有 R1 SourceDefinitionVersion 对象结构，尚未注册到正式 catalog；其具体定义对象以完整 SHA-256 固定，改变同一版本对象会被拒绝。

新定义表达：境内 A 股实际首发筹资金额，按官方明确的 IPO 上市首日归属自然月，原单位人民币亿元，identity conversion factor=1。它不声明净额/费用扣除的新算法，不计算再融资，不把发行家数、股数、批准/计划金额或累计值用作本月筹资。

| 候选时期 | 期数 / mapping 数 | 原字段与依据 | 判定 |
| --- | ---: | --- | --- |
| 2005-01..2009-11 内的冻结候选 | 57 / 3 | `首发筹资 → A股(亿元)`；B/H 股独立同级列；MONTH 与累计行区分；无 IPO 归月注释 | 保留金额/scope/MONTH extraction，归月口径 UNPROVEN |
| 2009-12 | 1 / 1 | 改名 `首次发行金额 → A股(亿元)`；注释明确增加债券市场统计并细化股票再筹资 | 此注释没有证明 IPO 归月规则或改名前后连续，UNPROVEN |
| 2010-01..03 | 3 / 3 | 同一 IPO 标题；现有注释关于定向增发资产额 | 未证明 IPO 归月规则，UNPROVEN |
| 2010-06..11 | 6 / 6 | 明确 IPO 上市首日归月；同时注明因超额配售调整 2009 年 IPO 筹资金额 | definition-compatible；调整说明不是已证明的当前附件历史 release event |
| 2010-12 | 1 / 1 | 上市首日归月；另注明按 2010 年年报调整部分月份、粗体显示调整项 | definition-compatible；无法据此给当前 bytes 或本月值制造 revisionAvailableAt |
| 2011-01、03..10、12；2012-01..09 | 19 / 15 | 同一上市首日归月说明；完整保留其他原注释 | definition-compatible；不外推到被排除的期次 |

上述 29 个版本不是 29 种经济定义。C1 signature 包含坐标、同级列和原始注释，因此某些时期仅其他统计注释变化也产生独立 mapping；没有抹平这些变化。

**26 期 definition-compatible 精确清单**：2010-06、07、08、09、10、11、12；2011-01、03、04、05、06、07、08、09、10、12；2012-01、02、03、04、05、06、07、08、09。这些期次仍全部不具备 C2A2 strict PIT 准入资格。

61 期的 `IPO_MONTH_ATTRIBUTION_UNPROVEN` 是本次更窄 definition gate 的结论，未推翻 C1 的字段条件就绪结论，也不声称当年经济定义一定不同。没有用缺少注释证明口径变化；同样没有用缺少变化声明证明口径连续。尤其不能把 2010-06 表中的说明自动倒用于更早的附件。

原人民币单位由 A 股亿元叶子列、境内筹资上下文以及独立 B/H 股列共同定位；B/H 列的不同货币原文保留但不换汇、不加总。全部数字取对应 reportPeriod 的唯一原生 MONTH 行；Excel typed date 保留 dateMode/dateIso，YYYY.MM 保留原数字格式。累计、缺行、blank/dash 均不转零。

## Vintage / PIT 判定

每月 matrix 保存 C1 schema/locator、完整目标单元格及公式/cache状态、原 period cell、header path、table title、原 numeric token 与 state、attachment URL/SHA-256/size/actual format、真实 acquisition、index entry 与定位、landing attachment link、publication evidence，以及明确独立的 page clock 与 numeric release clock。

XLS 的 BIFF numeric cell 没有原始十进制字符串。`rawNumericToken` 保留 C1/xlrd 的 `.15g` 解码文本；`decodedXlsValue.valueRepr/floatHex` 额外保留可无损核对的解码浮点值。`tokenEncoding` 明确标识这种表示。原始 bytes 由 SHA-256、size、sheet/row/column 和完整 raw replay 绑定；没有把格式化文本冒充原文件中的十进制字节。`numericValue` 仅为 token 对应的 admission extraction evidence，不是正式 observation。

`pageDateOnlySafeAvailableAt` 仅为官方页面日期次日 00:00 Asia/Shanghai 的安全解释，复用原 R1 time helper。它不证明今天取得的 attachment bytes 在该日已经存在。当前 index/landing/attachment 路径可重放，因此 `currentLandingLinkProven=true`；历史 release-to-bytes binding 和 historical version 均未证明。

所有 87 期 `releaseAvailableAt=null`、`releaseKind=UNRESOLVED`、`historicalAttachmentVersionProven=false`、`firstReleaseProven=false`、`lineageProven=false`。当前 acquisition 保留真实 2026-09-08 时点，不倒写为旧 reportPeriod 或旧 page date；URL 中的 version/path/文件名也不构成 immutable 历史版本证明。

| Blocker | 候选期数 |
| --- | ---: |
| HISTORICAL_ATTACHMENT_VERSION_UNPROVEN | 87 |
| RELEASE_ARTIFACT_BINDING_UNPROVEN | 87 |
| FIRST_RELEASE_UNPROVEN | 87 |
| R2_A_LINEAGE_UNPROVEN | 87 |
| IPO_MONTH_ATTRIBUTION_UNPROVEN | 61 |

Blocker 计数可重叠。互斥主 admission status 为 `DEFINITION_UNRESOLVED=61`、`PIT_VINTAGE_UNPROVEN=26`，直接使用既有 R2-A coverage vocabulary；没有新增 QualityStatus 或方便放行的 status。其余 173 期本 slice 未评估，overlay 的 admissionStatus 为 null，原 ledger/blockers 原样保留。

C2A1 的输入是已审计 C1 snapshot，不含可证明历史 binding 的独立 release artifact。因此 gate 明确没有成功发布路径，也不接收任意调用者 first/revision/backcast 标记作为证明。未来若得到历史 bytes/release binding，仍须在独立授权与审计的 C2A2 中使用现有 R2-A releaseEvents、artifactBindings、structured locator、fieldExtractions、coverage/lineage 合同；不能把本 sidecar 当作已通过 R2-A 的 financing dataset。

同 URL 不同 bytes 无官方 revision event 时，测试确认返回 `UNRESOLVED_RELEASE_CONFLICT`，不按获取顺序挑选历史 truth。独立 R2-A synthetic regression 确认真实 revision event 的可见性从 revisionAvailableAt 起生效，并拒绝缺失修订依据和断链。本批 87 个真实候选没有可据此准入的完整 revision event/binding；保留的超额配售和年报调整注释不能证明当前附件的首次发布或本月 numeric token 的 revision 身份。

## 分母、已知排除与历史完整性

- 2007-04、2010-04/05 保留原 `FORMULA_CACHE_MISSING_OR_ERROR`；未计算公式或绕过 workbook 级 blocker。
- 2009-01 保留候选的 `TIME_AXIS_HEADER_MISSING`。
- 2011-02、2013-01/02 保留 `CONTENT_REPORT_PERIOD_CONFLICT`；2013-01/02 的外链 blocker 同样保留。
- 2012-10 之后的 macro/external-link/schema/format blockers 未修复，未扩大候选子集。
- 2011-11 与 2017 全年 13 个 gap 未删除、未补零、未改 structural/not-yet。没有实施 2017 archive recovery。
- C1/C1.1 evidence、ledger、source snapshot 与获取日志未重写。baseline hash/ledger/候选集合任一不一致，builder 以 STOP 错误退出，不重新认定 C1 readiness。

本次未修改 `src/**`、`public/**`、`local-core/**`、`contracts/v1/**`、migration、账户数据、Supabase/Vercel、默认 data:refresh、Scope Freeze、R1/R2-A/PBC schema/validator。没有 YTD 差分、宏执行、外链求值、Office/LibreOffice/OCR、Supply Composite、normalization、backtest、weekly manifest 或 UI。

## 重放与确定性

```sh
npm run test:market-regime:csrc-c2a1
npm run data:validate:market-regime:csrc-c2a1:compact
# 下列命令要求保有原 C1/C1.1 完整 ignored raw 和 journals；均不联网
npm run data:build:market-regime:csrc-c2a1
npm run data:validate:market-regime:csrc-c2a1
```

full build/validate 先从 `raw/csrc-r2c1/` 与 `raw/csrc-r2c1-1/` 重放并精确比较 C1/C1.1，再重读 87 个真实 XLS 单元格；没有信任已有 extracted JSON 的数字。raw 在本 sibling worktree 中独立复制，未改原 worktree，未把大 raw 提交 Git。本次没有新的来源网络请求。

compact validate 只验证提交内容、固定基线引用、完整候选集合、definition/mapping、token内部一致性及派生结果，不独立证明原始网络响应真实性。**干净 clone 没有 ignored raw，不能完成 full replay；compact PASS 不代表历史 PIT、first release 或 durable source archive。** 重新下载产生新 acquisition/snapshot，不保证恢复原 bytes/hash。

内容 hash 包含 definition/config、mapping/notes、87 月完整 provenance/blockers、numeric witness、260 月 ledger。仅 generatedAt 排除。固定输入与时间重放字节一致；更改生成时间不改业务 hash；既存 sealed output 只有完全相同结果可幂等 build，不覆盖不同版本。

| 内容 | SHA-256 |
| --- | --- |
| 原 C1，保持不变 | `28453963bf0a453d69a0277d9eabdc4cd3b393e4f663d3cb8922478b06a18d80` |
| 原 C1.1，保持不变 | `9e76a9c0bb82fdf00571337c4c6daefc29bf8698c0a80db517d189eb048689ae` |
| 新 definition 对象 | `5523ea078a46c231af21a92a3256ba6df639802cf086510db6b39912cf5edd99` |
| C2A1 compact content | `67b1dd4881850ae3e2a3846dafa0cda6d4ff6df3e763e8d7aaaa755d025f66ff` |

## 验证

| 检查 | 结果 |
| --- | --- |
| C2A1 专项 | PASS，31 tests；语义、scope/unit、MONTH/YTD、zero/blank、decode/token、provenance/clock、URL bytes conflict、R2-A revision/lineage、固定分母、hash、空 observations、旧 ledger/hash |
| historical | PASS，66 tests |
| PBC | PASS，69 tests |
| catalog | PASS，48 tests；另 validate-artifacts 0 errors |
| CSRC C1/C1.1 + C2A1 聚合 | PASS，152 tests（原 121 + 新 31） |
| C2A1 compact validate | PASS；仅内容一致性 |
| C2A1 full raw validate / sealed build 重放 | PASS；含原 C1/C1.1 完整 raw replay，旧 evidence 精确相等 |
| data audit | PASS，0 errors / 24 warnings / 10 skipped / 31 allowlisted |
| npm test | PASS，39 suites / 597 tests |
| build | PASS；TypeScript、Local Core typecheck、Vite、browser boundary/bundle gate；既有大 chunk warning |
| env:check / env:check:json | 两者 exit 0；43 PASS / 15 WARN / 0 FAIL / 4 SKIP |
| git diff --check | PASS；提交前再次核对 staged 范围 |

env WARN 为既有多 runtime、未固定 Python 依赖/pip check、4 个未安装外部 Skill managed copies、提交前 upstream/dirty 状态、ignore 提示、旧生成物和公告 partial。未为消除 warning 修改治理、环境依赖或数据。data audit 的时间/扫描计数/行号以及 Vite 生成文件换行状态经 diff 核对后，仅恢复本次产生的非目标变动。日志留在 ignored data-cache。

待独立审计的实质问题是 definition 证据解释与 historical raw durability；剩余数据 blocker 是 61 期归月规则以及全部 87 期的历史版本/release binding/first-release/lineage。**未来 C2A2 精确 eligible periods 仍为 `[]`，本次所有 formalObservations 精确为 `[]`。**
