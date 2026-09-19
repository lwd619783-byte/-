# Stage 4.2 Slice 6 — Industry Signal / Claim Candidate / Eligibility

状态：**FROZEN PLAN / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。2026-09-19。

开始前 fetch 核验 `origin/main = dc8f5ec36d9626e92acc3fc91088c1b8c42ce753`，从该提交创建 `codex/stage-4-2-slice-6-industry-signal-claim-gate`。不修改 main，不创建 PR，不 merge；普通 commit/push 后停止。

## 冻结范围

唯一新增链路：Industry Metric → Derived Signal → factual Claim Candidate → 既有 `evidence-graph.v1` → Prosperity Eligibility / Abstention。复用六个 Registry owners、维度 mapping、原始留存与 F3 Harness，无 Provider 获取、Entity 映射、业务数据库或新事件模型。

本文件仅在本 Slice 的独立派生预览中 supersede Slice 5 对 delta / Claim / F2 follow-on 的暂缓；原 Snapshot、Metric presentation policy、source-fact 文件不变。来源事实仍只允许显式 NOT_ADMITTED 核对预览；这里的数学重算和候选文字不构成正式 research/display admission。

公式 `retained-absolute-difference.v1`：固定窗口末期减紧邻前一期，必须同一 exact metric / industry / unit / scope / geography / basis；weekly 7 日相邻，monthly 同年相邻月。四个 EIA week_ending owners 和 NBS absolute monthly owner 显式登记。NBS YoY、year_to_date 不登记，禁止百分比、累计差分、连续方向、季调或行业方向推断。missing 不回填；0 保留；conflict 不选胜者、不计算。配置内容摘要由代码 review 锚定，绑定 formula/version、definition/artifact pins 与输入 manifest；禁止 eval、动态算法、名称推断和重新封装绕过审查。

候选仅从上述 reviewed formula 与模板产生，文本包含“当前留存快照”、两个观测期、差值、单位。没有自由文本入口。候选状态永远 CANDIDATE，F2 claim origin 使用冻结词表 ai_draft（自动模板草稿，不表示调用 LLM），不伪造 provider_fact / user_judgement。文本生成方式在候选 owner 中明确 TEMPLATE；不存在 Verified Claim promotion。

F2 沿原 typed edges 与 Pin 规则接线，图只含引用，业务内容留在各自 owner。Source definition → capture locator → native EvidenceRef → exact observation → derived_metric → claim。复用冻结 F2 语义实现 revision、origin、conditions、反证并集、cycle/dangling/pin 检查。任何反证保留并使 conflicted；没有新 graph schema。图建立时间独立记录，不回填历史发布时间。source release=null 向上传播；结构闭合不等于 supported。

资格策略 `industry-prosperity-eligibility.v1`：oil-shipping 必需 supply/demand/trade_flow/inventory/price，robotics 必需 supply/demand/price/margin。仅已有 mapping 能满足覆盖，缺失显式列出；美国炼化投入不扩充为全球需求覆盖。首版还要求行业范围覆盖证明（当前无）、已准入、PIT、release、revision continuity、非冲突、完整证据、freshness、Entity 映射与已审查正式判断方法。没有正式判断方法准入时必须 abstain。至少返回 DATA_NOT_ADMITTED、PIT_UNPROVED、RELEASE_TIME_UNKNOWN、REVISION_CONTINUITY_UNKNOWN、DIMENSION_MISSING、CONFLICTED_INPUT 对应 blocker；不生成 0–100 score、综合方向或投资结论。

## 验收与交付

重排不改输出；缺失/0/conflict/stale/not_admitted/unknown 传播；foreign identity/pins/formula 拒绝；公式与模板 roster 固定；F2 反证、cycle、dangling、缺 Evidence、版本与身份变更对抗测试；候选可经原 EvidenceDrawer 查到 exact observation / official URL / raw SHA / locator。六个来源 owner 及 Slice 5 回归。

新增独立真实 Industry F3 suite，复用 evaluateRequest 与 Result 比较，不修改 Frozen 33 cases/分母/历史报告，不把 reference oracle 冒充 actual service。至少 deterministic derived signal、unsupported claim、conflict propagation、missing evidence、prosperity abstention；负例清楚标记真实输入的 synthetic mutation。

执行用户列出的全部十项命令和相关专项测试；三主题 × 320/390/1536 核心浏览器检查。同步 CURRENT execution / feature registry；新增 runtime 数据流更新 architecture，当前路线仅同步本 Slice 的 scope。分支不预写 CLOSED / MERGED / MAIN CI PASS / production admitted。

## 实际交付与审计入口

公式 roster：一个固定算法 `retained-absolute-difference` / version `1`，五条显式 metric/basis 绑定；模板 `retained-absolute-change-zh` / version `1`；资格策略 `industry-prosperity-eligibility` / version `1`。配置 reviewed canonical digest 为 `73bb0c926a73c9f0e368aae21f139d1ec095810711a26817f160c42376b27f89`。Registry 唯一发现索引不变；源文件/Registry/mapping 与本轮基线无 diff。

| Metric | basis / 留存期 | previous → current | 派生绝对差 |
| --- | --- | --- | --- |
| US_EIA_COMMERCIAL_CRUDE_STOCKS | week_ending / 2026-09-04 → 09-11 | 424069 → 423429 | -640 千桶 |
| US_EIA_CRUDE_EXPORTS | week_ending / 2026-09-04 → 09-11 | 3417 → 4831 | +1414 千桶/日 |
| US_EIA_CRUDE_PRODUCTION | week_ending / 2026-09-04 → 09-11 | 13947 → 13944 | -3 千桶/日 |
| US_EIA_REFINERY_CRUDE_INPUT | week_ending / 2026-09-04 → 09-11 | 17586 → 17330 | -256 千桶/日 |
| CN_NBS_INDUSTRIAL_ROBOT_OUTPUT | monthly / 2026-07 → 08 | 98677 → 96174 | -2503 套 |

对应生成 **5 个 Signal / 5 个 Claim Candidate / 5 个 F2 graphs**。所有派生/候选保持 `not_admitted + partial + unknown`；数值可重算不意味正式 supported。这里 partial 包含声明窗口以外的历史覆盖不足，不把 EIA 的 11/11 已留存窗口称作缺行。NBS 官方同比 owner 与全部 year_to_date 不生成新派生，也不借绝对量反推官方同比。

候选例：“当前留存快照中，美国原油出口（周度日均）在2026-09-11较上一留存期2026-09-04增加 1414 千桶/日。”其他四条仅将相应名称、期间、差值和单位代入同一模板。`origin=ai_draft` 是既有 F2 自动草稿词表，`generation=TEMPLATE` 明确本轮不调用 LLM。没有文本提交/改写/提升为 verified 的接口。

### F2 与原始证据

- [派生/候选/输入 manifest 留存](../research-data/industry/signal-claim-v1/derived.json)；[完整 F2 图与资格结果](../research-data/industry/signal-claim-v1/graphs.json)。图只含引用与 typed relations，正文留在对应 owner。
- 每图 9 个节点、9 条边：source → 两条 capture/evidence/fact lineage → derived_metric → claim；部分 capture 同页，仍逐 operand 保留 exact observation/evidence refs。公式/input manifest/source conditions pins、原生 EvidenceRef、来源 origin 与所有状态保留。两条输入均可追到原官方 raw SHA、表格 locator/原始行/URL。
- 图的 `asOf/assertedAt=2026-09-19T13:10:00Z` 仅是本轮声明时间，所有 source releaseAvailableAt 仍 null；不是历史 PIT 图。Graph revision 1 无历史前图可冒称。未来新对象/修订必须新版本留存，`--write` 拒绝覆盖不同内容。
- 抽取原 F2 evaluator 为 browser/Node 共享执行核；合同 checker 保留 schema 和磁盘 pin 验证。Industry adapter 额外验证 formula/input roster、foreign owner、owner 条件、origin/release、逐 observation 的 Evidence/Artifact 边，不允许正确 pin 串到错误观测；所有资源及返回对象冻结，禁止 digest 下内容漂移。
- 原 schema 的 Unicode/date-time/uniqueItems 等通过 standalone 编译完整保留；`data:validate:industry` 校验生成字节。Node-only Ajv compiler 不进入 browser graph，纯格式/相等辅助函数包含依赖许可证。没有放宽 browser boundary。
- 真实现有来源没有反证边；明确的 synthetic mutation 添加反证时同时保留 supports/contradicts，结果 conflicted，不删除反证、不选胜者。原 F2 revision/identity 全部合同回归保留。

### Prosperity Eligibility

两个行业均 **ABSTAIN / NOT_ELIGIBLE**。共同 blockers：`DATA_NOT_ADMITTED`、`PIT_UNPROVED`、`RELEASE_TIME_UNKNOWN`、`REVISION_CONTINUITY_UNKNOWN`、`DIMENSION_MISSING`、`PARTIAL_INPUT`、`UNKNOWN_INPUT`、`ENTITY_UNRESOLVED`、`INDUSTRY_SCOPE_UNPROVED`、`FORMAL_METHOD_NOT_ADMITTED`、`EVIDENCE_NOT_SUPPORTED`。Robotics 另有 `MISSING_EVIDENCE`（声明窗口缺独立月度观测）。

Oil-shipping 必需5维，现有4维、price 缺失；robotics 必需4维，只有 supply，缺 demand/margin/price。维度存在仅是必要条件，当前美国指标不能证明全球油运全行业覆盖；还必须有 scope proof。V1 未实施官方 revision continuity proof adapter，始终明确该 blocker，不能凭 revision 字符串通过。当前无真实冲突，不虚构 CONFLICTED_INPUT；该 blocker 已通过显式冲突负例验证。

### F3

[独立 Industry frozen cases](../contracts/industry/eval/industry-cases.v1.json) 与 [机器报告](stage-4-2-slice-6/industry-eval-report.v1.json)：`industry-deterministic-derived-signal`、`industry-unsupported-claim`、`industry-conflict-propagation`、`industry-missing-evidence`、`industry-prosperity-abstention`，**5/5 PASS**。两项是真实留存输入重算，三项明确为真实图的 synthetic negative mutation，不能冒称真实反证或真实 Provider 故障。

通过原 `evaluateRequest` 只传 detached/frozen request/input，复用 Result schema 与集合精确比较；目标实际调用 Workspace 同一服务。case roster/版本/expected/fixture pin 漂移失败。原 Frozen Foundation 33-case、suite manifest、历史报告不改，reference 33/33 / actual service 0/33 不变，Industry 5-case 独立分母。本地 `research:eval:check` 同时核对两份报告，不回写；原 CLI 单 JSON stdout 保持兼容，Industry 结果另行报告。

### 验证记录

| 检查 | 本地结果 |
| --- | --- |
| test:industry | PASS；8 Python / 107 Node / 90 Vitest（12 files） |
| data:validate:industry | PASS；6 owners 原 raw/schema/binding/replay + F2 validator parity + derived/graph/gate exact replay |
| test:research-eval / research:eval:check | PASS；原45 + Industry6专项；原33-case报告与新增5-case报告均精确复现 |
| test:contracts / contracts:validate | PASS；106 Local Core + 78 Financial Research tests，冻结合同不变 |
| data:audit | exit 0；0 errors / P0=0；36 非阻断 warnings（P1=20、P2=16） |
| npm test | PASS；890 tests / 75 files |
| build | PASS；TypeScript、Local Core/browser boundary、bundle budget；既有大 chunk warning |
| test:discovery | PASS；75 正式 suite，嵌套 checkout 排除规则未削弱 |
| browser | PASS；2163 checks，三主题 × 320/390/1536、两行业与空行业、Snapshot/Metric/Candidate/Drawer；0 runtime errors，既有 favicon 404 warning |
| Hosted CI / independent audit | NOT_RUN / PENDING；本地结果不替代最终 SHA 独立审计 |

数据审计新增2条 P2 来自编译的 date-time helper 中可选时区分钟默认值 `|| 0`，不是 observation missing-to-zero；未加豁免或降低审计。提交前将新建 JSON 统一为 LF 并重算 pins；直接核对 Git index 中 20 个 owner 文件的 65 个 unique pins 全部匹配，避免 Windows 工作区通过而 clean checkout 摘要漂移。首次 browser-boundary/测试夹具/CLI 输出兼容性失败均修复后重跑通过。

[浏览器报告及源码摘要](stage-4-2-slice-6/browser/report.json) · [oil 桌面](stage-4-2-slice-6/browser/signals-oil-shipping-neon-1536.png) · [oil 320](stage-4-2-slice-6/browser/signals-oil-shipping-pro-320.png) · [robotics 390](stage-4-2-slice-6/browser/signals-robotics-light-390.png)。复现：build/preview 后运行 `scripts/industry-signal-claim-browser-check.mjs`，使用已安装 Playwright；无新依赖或采集。

### 停止点

Stage 4.2 可视为 **closeout candidate（待独立审计）**：既有 Registry/双来源/维度快照现已补齐可复算变化、事实候选、证据引用与明确 abstention 产品链。该判断不表示 CLOSED、MERGED、MAIN CI PASS 或 production admitted。

仍明确禁止：0–100 景气分数、正式行业景气上行/下行、bullish/bearish、Verified Claim、Thesis、Portfolio/Agent、买卖建议、Entity 自动映射、猜 release/revision、准入提升。Snapshot 原限制、正式 Metric presentation、六个来源事实与 frozen F1/F2/F3 历史合同均保留。
