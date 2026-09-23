# Stage 4.3-R3 — Investment Expression V1 + Closeout

## Final Closeout — 2026-09-23 CURRENT

**Stage 4.3 — CLOSED / IMPLEMENTED / INDEPENDENT AUDIT PASS / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。
本节 supersede 下方历史 CURRENT、CLOSEOUT READY、PENDING INDEPENDENT AUDIT 和旧停止点；下方 R3 实现、审计前自查与本地测试记录保留原时点含义。关闭代码阶段不等于完成旧私人资料验收或提升数据准入。

本次 docs-only 开工已 fetch 并核验仓库 `lwd619783-byte/-`，Base 为 `origin/main @ 925b496e92ef7c338a248b1fb2eef5e9dabb0ee0`，工作区 clean、开放 PR 为 0。从该 Base 新建 `docs/stage-4-3-final-closeout-stage-4-4-handoff`；未 merge / cherry-pick 旧 `codex/stage-4-3-closeout-status-sync @ a7d866da2a6c41f2bde3603f87c0d656e5ac2d7f`。

### 已核验的合入与部署事实

2026-09-23 通过 GitHub PR / Actions 与 Vercel deployment 只读查询重新核验以下事实。独立审计结论来自用户已确认结果与对应 PR 的 Audit 记录，不冒充本轮重新审计；PR reviews 列表为空不等于没有外部 ChatGPT 审计。

| 证据 | R3 Investment Expression | A 阶段 Legacy Hardening |
| --- | --- | --- |
| 独立审计 Head | `0970a31ec2487ea699943afe6e881420b8ae8535` | `0901880a7382aa75ed099014b06cc0c15c51cb3b` |
| 独立审计 | PASS / P0=0 / P1=0；PR 记录保留一项非阻断 UI 文案 P2 | PASS / P0=0 / P1=0 / P2=0 |
| PR | [#77](https://github.com/lwd619783-byte/-/pull/77) MERGED | [#78](https://github.com/lwd619783-byte/-/pull/78) MERGED |
| squash merge / main | `c3b2892459827a8ac060ee38031def840b56a546` | `925b496e92ef7c338a248b1fb2eef5e9dabb0ee0` |
| PR exact-head Hosted CI | [35804055411](https://github.com/lwd619783-byte/-/actions/runs/35804055411) completed / success；绑定上述审计 Head | [35819964450](https://github.com/lwd619783-byte/-/actions/runs/35819964450) completed / success；绑定上述审计 Head |
| merge 后 main push CI | [35804503402](https://github.com/lwd619783-byte/-/actions/runs/35804503402) completed / success；绑定上述 merge SHA | [35820222982](https://github.com/lwd619783-byte/-/actions/runs/35820222982) completed / success；绑定上述 merge SHA |
| Vercel Production | `dpl_6fHXcNWeFG9M1usPy7KyuZTopfyp`，READY / production，绑定 `c3b2892459827a8ac060ee38031def840b56a546`；R3 历史部署 | `dpl_hggnxDKt6agDP9Bq78qntZL66wbM`，READY / production，绑定 `925b496e92ef7c338a248b1fb2eef5e9dabb0ee0`；核验时当前生产域名亦解析到该部署 |

A 阶段仅迁移旧 `58dc00a` 仍有效的配置错误分类、安全中文错误、environment-neutral 提示、fail-before-store、HTTP → MCP read-only 与 TTL / revoke / selection / tenant isolation 回归。[迁移与原本地验证](research-bridge-readonly-v1.md#pre-44-legacy-hardening2026-09-23)保持历史记录。Research Bridge 继续 **Legacy compatibility / read-only / fail-closed**；应用 Production READY 不表示 Bridge 已完成真实私人资料验收、增加 Production business authority 或 MCP 写权限，也不替代 Drive/Notion。

### 双通道与真实研究状态

- Research Decision Lane：`Provider / official Evidence / Creator owner → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression`。
- External Knowledge Lane：`Google Drive L0 原件 → ChatGPT draft analysis / extraction → Notion L2 Wiki`。
- 两条通道可以引用，但 authority 不混淆。Notion / AI Draft / Creator Commentary / 研报等 research context 不能单独晋升 Verified Claim；正式 Claim 继续经过原 OS Evidence / F2 / PIT / admission / revision 门禁。
- Local Wiki、Markdown / Obsidian projection、BrowserSource/parser、Research Bridge 保留兼容能力，不再是默认长期知识主路线。

正式留存/生产研究对象状态仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression**。这些数字沿用已核验的真实留存状态；本轮不刷新数据、不盘点私人 profile，也不把 synthetic 能力测试当成真实研究资产。R1/R2/R3 实现不自动产生任何正式对象。

### Stage 4.4 handoff

主开发线切换为 **Stage 4.4 — Portfolio Exposure MVP：NEXT / PLANNED / NOT_IMPLEMENTED**；本轮没有实现。

优先复用既有 Phase 1B 的 `Account / Asset / Transaction / CashFlow / PositionSnapshot` 及其正式 owner / repository / persistence / permissions，**不得建立第二套投资账户或持仓账本**。Phase 1B 是既有 Node-only Local Core；其完成不代表 Portfolio Exposure runtime/UI 已实现，见 [Phase 1B 交付](investment-dashboard-v2-phase-1b-implementation-alignment-validation.md)与[冻结合同入口](../contracts/v1/README.md)。

`Investment Expression` 是研究层面的投资表达，不等于 Position、Target Allocation、Transaction、Rebalance、Trade Instruction 或实际账户持仓。Stage 4.4 需要建立研究表达 → Portfolio Exposure 的受控连接，不能把 Expression 直接当交易指令。资产 identity、账户 owner、价格、估值、交易单位或其他关键 owner 不完整时必须保持 **unknown / unresolved / blocked**，不能由 AI 猜值或默认补 0。

### 继承限制与本轮停止点

- Provider / PIT / data admission 未升级；Stage 4.3 CLOSED 不代表这些缺口已解决。
- LocalStorage 跨标签页仍不是原子 CAS / 多写者事务。
- ETF / Index / Fund / CommodityProxy 正式 runtime owner 仍不完整；immutable quantitative price / valuation / liquidity adapter 缺口继续保留。
- Research Bridge TTL 仍是逻辑过期；物理清理不是本轮能力，后续 revoke 无法收回已读取内容。
- 旧 Slice 2.5 真人 WikiReview、UPDATE / full history / accepted UPDATE 后 ChatGPT revoke-denial 继续 **PENDING / NOT_REVERIFIED**，不虚构 PASS。

本轮仅同步八份文档，不修改业务代码、contracts/schema、Provider、Evidence/F2、Claim/Thesis/Expression authority、资产 runtime、数据、Production 配置或 secret、Research Bridge/MCP connector。本 docs-only 分支自身仍待独立审计；上表 MERGED/CI/Production 只描述 #77/#78，不预写本分支已合入。停止点：普通 commit/push、核对 remote HEAD 与 clean worktree，等待 ChatGPT 独立审计；不创建 PR、不 merge、不修改 main、不部署。

本轮验证：8 份 docs-only diff allowlist、194 处 Markdown 本地链接/锚点、6 个新增 GitHub 证据 URL、历史日期段落与 R3/Bridge/Architecture 原正文保留检查、新增内容 secret/本机路径/URL 检查、`git diff --check` 均 PASS；`npm run contracts:validate` PASS（5 V1 schemas / 40 definitions / 28 versions 及各研究领域 validator）。全量 tests/build/browser、数据刷新、真实私人验收、本分支 Hosted CI / Production 部署均 NOT_RUN。历史 `stage:4.3:closeout` 检查器依赖 R3 本地报告和当时“等待独立审计”的停止点，本轮 NOT_RUN，不修改或降低其断言，也不冒充最终关闭 gate。

## 历史 R3 实现与审计前交付记录

状态：**Stage 4.3 — IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT**。Base `17a2e1929c1d7570e477a5e19aadbeee29aa04f5`，独立分支 `codex/stage-4-3-r3-investment-expression-closeout`。

## R2 CLOSED / D0

2026-09-22 实时核验 R2 PR [#76](https://github.com/lwd619783-byte/-/pull/76) merged，head `cf4adf4d27cb5b9803883283f458ae9e3d0fd616`，merge/main 为上述 Base。PR CI [35746157236](https://github.com/lwd619783-byte/-/actions/runs/35746157236) 与 main CI [35746962990](https://github.com/lwd619783-byte/-/actions/runs/35746962990) success；同 SHA Production deployment `6594270082` success / Deployment has completed。R2 正式 CLOSED，主线进入 R3；历史审计不回写。

| 原 owner / 机制 | Reuse | R3 Delta |
| --- | --- | --- |
| R0 authority split | 外部知识仅 Research Context，Legacy lane 保留 | 不重新建设旧 Slice 3，不接外部正文或写 API |
| R1 Claim / Frozen F2 | 原 review、canonical pin、原 Evidence owner 与 F2 gate | 经 exact Thesis 追溯，不复制 Evidence Graph |
| R2 Thesis | 原 revision、confirmation、asOf、Claim freshness | Expression pin exact revision + confirmation，确认时重读 authority |
| Stock / Entity / Asset | 原 owner exact ID；Stock runtime 可用，Local Core Asset 无当前浏览器读端口 | InstrumentRef 是引用合同，不建第二 registry；无 ETF/Index runtime owner 时 empty/unresolved |
| Quote / valuation | Stock 已有行情/估值字段但无本切片可用的 immutable context pin adapter | liquidity/valuation 显式 unknown 或定性 research judgement；不伪造指标 |
| Local-first | PersistedBaseGuard、bound preview、append-only、backup/recovery 模式 | 独立 Expression owner 和 JSON 备份，保留跨标签页非原子 CAS 限制 |
| Research Workspace | 原 Thesis 与 Evidence Drawer | Expression editor/history/diff/exact trace；不做全站重构 |
| F3 | 原 Foundation / Industry / R1 / R2 分母与服务 | 独立 Expression synthetic frozen suite，真实 5/0/0/0/0 分账 |

新增 additive Expression V1 合同先于实现；本次合同与实现等待独立审计，不借用历史审计证明新合同已获审计。Provider、PIT、release、admission 与 Phase 1 permissions 不变。

## Closeout evidence

R0/R1/R2 CLOSED；R3 本地工程验收完成，Stage 4.3 整体尚未 CLOSED，下一门禁为独立审计。旧 Slice 2.5 真人验收缺口保持 PENDING / NOT_REVERIFIED；按 R0 不再作为 R1–R3 关闭 blocker。Stage 4.4、4.5、4.6 保持 PLANNED / NOT_IMPLEMENTED。停止点：普通 commit/push、核对 remote HEAD、clean worktree 后等待独立审计；不创建 PR、不 merge、不修改 main。

## 实现与 authority

`contracts/investment-expression/v1`、`investmentExpression.ts` 定义新增 Expression owner。stable ID、不可变 revision、supersedes、origin、asOf、reason、instrument ref、role 和六组定性 context 完整保存；`ExpressionConfirmation` 独立追加。`ai_draft` 只表明来源，不能自动形成正式版本。没有重建已有 Entity/Stock/Asset、Evidence Graph、Thesis 或 Account/Position/Transaction。

FormalThesisRef 绑定 exact Thesis revision / confirmation 及 canonical bytes。每次正式 preview/confirm/import/read 都从原 Thesis repository 解析，重验 R2 → R1 → 原 F2。Draft、未确认、失联、损坏、future schema、字节漂移、晚于 asOf 的确认均阻断。Thesis successor 的 createdAt 小于等于 Expression asOf 时，旧 pin 不可用于新正式确认；晚于 cutoff 时历史合法，当前 UI 提示“基础 Thesis 已有新版本 / 需复核”。确认还比较同一 Thesis 的完整历史 token；preview 后 head 改变，即使 historical cutoff 仍合法，也要求用户重新预览。

InstrumentRef 按原 owner + exact ID + type + market 解析，名称仅展示，ticker 不参与匹配。合同支持 Index、ETF、Fund、Equity（A/H/US/global）、CommodityProxy。真实浏览器仅连接 `dataMode=real` 的现有 Stock owner；ETF/Index/Fund/CommodityProxy 尚无正式 runtime read port，保持 unresolved/empty。不是新增证券名录，也不硬编码真实 ETF/Index。冻结 synthetic fixture 经原 Claim/Thesis 服务明确确认后验证全部五类 domain；最低 ETF/Index/Equity 同时覆盖 F3、UI、browser。

Liquidity/valuation 没有新增 immutable owner adapter，因此只保存 unknown 或有明确标识的研究判断；directness/correlation/sensitivity/risk 同为定性文本。没有 expected return、target price、numeric score 或伪概率。上游 partial/stale/conflict/unknown/PIT/admission blocker 继续经原门禁传播。Context kind/title/URL 复用原安全约束，Drive/Notion/Legacy Wiki/Creator Commentary 永不作为验证授权。

`BrowserExpressionRepository` 复用 PersistedBaseGuard：原 loaded object / exact raw bytes、bound preview、tamper/clone/replay/stale 拒绝、append-only revision/confirmation、确定性 JSON export、import preview/显式确认/pre-import backup、已观察坏字节恢复、future schema 锁定。原坏字节及历史不静默覆盖或删除。real/synthetic scope 在 load、draft、formal gate、import 均核验；丢失原 owner 时保留历史/导出，后续写入保守阻断。

Research Workspace 沿用「论点与观察」原入口，在 Thesis 下接 Expression；包含 draft、exact formal Thesis 选择、instrument、role/六组 context、preview/confirm、history/diff、JSON backup/recovery，以及 `Expression → exact Thesis → exact Claim/review → original Evidence Drawer`。没有全站重构、外部正文复制、API 请求或 Domain MCP write。

## R0 关闭条件矩阵

| 条件 | 本轮工程结果 / 边界 |
| --- | --- |
| R0 authority split | 原双通道冻结保留；外部知识仅 context；R0 CLOSED |
| R1 Claim | 原业务代码/合同/F2不变；R1 CLOSED，专项/浏览器回归 |
| R2 Thesis | PR #76 / main CI / Production 实时核验，正式 CLOSED；原业务代码不变 |
| R3 Expression | additive contract/domain/repository/UI/F3/browser；本轮独立审计尚未发生 |
| exact trace | 固定 Thesis+confirmation、Claim+review、原 graph/pin；不能以 pin bytes 替代 owner |
| asOf/revision/confirmation | inclusive successor cutoff、历史合法、当前需复核；确认时重读 authority |
| unknown/partial/stale/conflict | 不将未知转 0；原 F2 blocker 保留，定性 context 明示 unknown |
| Local-first backup/recovery | deterministic export、append-only merge、pre-import backup、explicit confirm、corrupt/future fail closed |
| real vs synthetic | 隔离真实留存仍 5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression；不是用户私有 profile 盘点 |
| no private/copyright leak | 仅既有 frozen synthetic 材料、公开代码/合同；无真实私人资料、凭据或正文镜像入库 |
| no second truth source | 原 identity / Claim / Thesis / Evidence / Asset owner 不替代；新增 owner 仅负责 Expression |
| F3/UI/browser | 新独立 R3 分母；旧 Foundation/Industry/R1/R2 分母、assertions、timeout 保持 |
| legacy Slice 2.5 gaps | 本人 WikiReview、真实 UPDATE/full history、accepted UPDATE 后真实 ChatGPT revoke-denial：PENDING / NOT_REVERIFIED；未访问私人存储，不推断当前对象数；按 R0 非新主线关闭 blocker |
| future stages | Stage 4.4 Portfolio/Position/Transaction/exposure/allocation/rebalance/sizing/buy-sell/broker API；4.5 Domain MCP/remote write；4.6 Agent/Notion-Drive proxy/cloud DB：PLANNED / NOT_IMPLEMENTED |

## 验证与复现

| 验证 | 本地结果 |
| --- | --- |
| Expression domain/repository + UI + independent F3 | 43 + 6 + 22 = 71 PASS；ETF/Index/Equity、显式确认、历史、trace、asOf、upstream change、unresolved/ambiguous、context-only、scope污染、备份/损坏/未来版本与对抗路径 |
| R1 regression | 30 domain + 3 UI + 4 F3 PASS；原业务源码未改 |
| R2 regression | 29 domain + 8 UI + 12 F3 PASS；原业务源码未改，仅 workspace wrapper 接入 Expression |
| contracts validate / tests | PASS；106 Local Core + 78 Financial Research Node + 162 Vitest |
| research eval/check | PASS；51 Node + 38 Vitest；Foundation reference 33/33、actual deterministic service 0/33 NOT_IMPLEMENTED，Industry 5/5，原分母未变 |
| industry tests / validation | PASS；8 Python + 107 Node + 90 Vitest；原 retained bytes、registry、F1/F2、source replay 保留 |
| full `npm test -- --maxWorkers=1 --minWorkers=1` | PASS；106 files / 1,396 tests；无 skip、无 timeout 放宽、无删除断言 |
| discovery | PASS；106 formal suite paths 全部保留，control 仍复现3个 nested checkout failures |
| build | PASS；TypeScript / Local Core boundary / Vite / financial bundle，errors=[]；原大 chunk warning 保留 |
| data audit `--no-write` | PASS；0 errors / 42 warnings，P0=0 / P1=20 / P2=22；原历史 audit 文档无 diff |
| R3 real browser | 43/43 PASS；真实 5/0/0/0/0、正式确认阻断、read-only、reload、320/390/1536 / reduced-motion |
| R3 synthetic frozen browser | 103/103 PASS；三类 instrument 均 UI 新建+确认、版本/history/diff、完整 drill-down、preview后head变化阻断、historical保留/current需复核、superseded-asOf阻断；0 runtime error / console error |
| R1 / R2 real / R2 synthetic browser | 130/130、49/49、76/76 PASS；全部0 runtime error，旧 synthetic 404另记 |
| Stage 4.3 closeout checker | 9/9 PASS；冻结边界、closed schema、生产包fixture隔离、五组报告分母/source pins、CURRENT停止点 |

上述是本地能力验证，不是 Hosted CI、独立审计或 Production/data admission。提交后在 Final SHA 重跑全部指定验证，命令、exit code、Final SHA 与 tree 绑定保存在本地 `final-verification.json`；报告源码摘要由 closeout `--head` 与 Git bytes 再核对。普通 push 后核对 remote HEAD 与 clean worktree，最终 SHA 通过 Git commit / 最终交付消息定位，避免文档的自引用 commit hash。

新入口：`npm run test:expression`、`test:expression:browser`、`test:expression:browser:synthetic`、`stage:4.3:closeout`。浏览器脚本使用独立临时 Edge contexts，320/390/1536 宽度与 reduced-motion；真实页面用 build preview（4173），synthetic harness 用 Vite（4174）。若本地未安装 Playwright，设置既有 `UI_REVIEW_PLAYWRIGHT_MODULE` 指向可用依赖，不更改项目 dependencies。临时 harness 不进入生产 import graph。

详细本地日志、五组 browser report / screenshots / source SHA-256 位于 gitignored `data-cache/stage-4-3-r3/`。`stage:4.3:closeout -- --head` 核对 browser 分母、每一项通过、runtime errors=0、受测源码与 HEAD Git bytes 一致、原 owner/数据无 diff、生产 bundle 无 synthetic fixture，以及 CURRENT 停止点。该工具只核验本地 closeout 条件，不授予独立审计或 admission。

## 风险和继承限制

- 本轮自查未发现待修复的 P0/P1；不代表独立审计已经通过。静态 data audit 仍有 inherited P1=20、P2=20，加本轮生成 date-time validator helper 的 timezone `|| 0` 两条 P2，共42 warnings、0 errors；两处只处理 timezone offset，不处理金融缺失值，未改规则/添加豁免。
- LocalStorage 的最终同步 stale 检查不是跨标签页原子 CAS / 多写者事务锁。原 owner 失联使后续写入保守阻断，不用历史 pin 内容冒充证据。
- 本地备份/确认沿用现有单用户信任边界，不是签名认证材料。instrument 历史别名/跨 owner 映射与 immutable liquidity/valuation adapter 不在本轮实现。
- 研究判断文字、role 与定性关联没有自动语义证明；正式确认代表用户接受该研究表达，不提高 Provider/PIT/data admission。
- 旧 R2 synthetic harness 有既有1条资源404 console消息；0 page runtime error。R3 synthetic browser consoleErrors=[]。无新增依赖、Provider、云业务库、权限放宽或真实交易能力。
