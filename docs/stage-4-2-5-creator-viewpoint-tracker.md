# Stage 4.2.5 — Creator Viewpoint Tracker V1

> 2026-09-20 CURRENT · CHRONOLOGY HEALTH P1 IMPLEMENTED / VERIFIED LOCALLY / PENDING TARGETED RE-REVIEW。
> 路线：Stage 4.2 CLOSED → **Stage 4.2.5 CURRENT** → Stage 4.3 NEXT。
> 开始前 fetch 的精确基线：`8860c943919f90daa125934fde0f385707ea7028`；分支 `codex/stage-4-2-5-creator-viewpoint-tracker`。

## 领域范围与复用决定

Creator Viewpoint 是 `external_commentary`，人工审核只确认摘录和观点整理，不赋予 Provider Fact、Verified Claim、User Judgment 或正式 Thesis 资格。判断后来正确也不改变这一分类。Stage 4.3 未实施。

现有公司 `ResearchEvent` 要求 stock/industry/market，不能给 Fed/人民币事件编造公司身份。本次从原 owner `src/types/researchEvent.ts` 提取 `ResearchEventCore`，既有公司事件继续继承完全相同字段；增加 `ExternalResearchEvent` 明确 `scope: external` / `macro_external`。事件在 tracker envelope 中只存一份，多位 Creator 的 Observation 通过精确 eventId 引用。没有创建公司 ResearchEvent 的镜像、第二个宏观事实 Provider 或事件评分。外部事件支持 unverified/partial/verified；verified 复用 ResearchVerificationStatus 的来源级核对标签，要求来源名称与 URL，仅表示原始来源已核对。verified external event ≠ Provider Fact admission ≠ Verified Claim ≠ Thesis；录入或被引用不自动核验。

既有 Research Inbox 是公司 WatchItem/ReviewTask 的投影；ReviewTask 要求 watchItemId，不能为博主伪造 WatchItem。本专项的 T+5/20/60 到期项是已审核重要 Observation 的临时投影，只有人工复盘结果是 append-only 记录，不新增任务存储。Evidence Drawer 增加外部观点分支，复用原 Modal/focus/Escape、safeEvidenceUrl 和原 Workspace 导航。浏览器 adapter 复用 StorageLike / PersistedBaseGuard；不接 SQLite、Node Local Core、云库、Research Bridge 或任意写入口。

此专项新增的是独立浏览器 commentary 领域，不修改冻结 `contracts/v1` 的正式研究/资产权限或 wire 语义。版本事实源为 `creatorViewpoint.ts` types + `validateCreatorViewpointData` 的严格 V1 字段与引用校验，未知版本和未知字段均拒绝。

## V1 状态和时间语义

- Creator/Topic 支持任意数量；默认五个 Topic，可追加扩展。原始来源区分 post/article/comment/self_reply/repost，父级来源、内容、原网页时间标签、精确发布时间、抓取/录入时间各自保存。
- 精确时间必须带时区且为真实日历时刻；原网页没有时区时只保留 publishedAtLabel，publishedAt=null，不把抓取时间当成发布时间。
- 作者身份 unverified/other/verified_self 独立保存。本人回复这个来源类别不自动确认本人；verified_self 必须有来源 URL 和人工身份核验依据，仅代表账号匹配，不代表现实身份认证。
- 原文完整性和评论覆盖分别保留 FULL/PARTIAL/UNVERIFIED。展示的综合覆盖取当前来源及其父级最弱值；评论未抓全/未观察到回复不能解释为没有发表。
- Observation 不可变，审核另追加 Approval（reviewed/rejected），每条只审核一次。更正须新 Observation + supersedesId + revisionReason，旧记录和旧审批保留。Draft/rejected 不改变 Current View。
- State vector = stance + conditional + horizon + trigger + confirmation + invalidation。Summary/reasoning 的补充不自动产生 Transition。首次无前态是 initialization，不能称为已证明的历史观点变化。
- Current View 与 Transition 都是已审核 Observation 的确定性投影，没有第二份可漂移 current/transition 存储。Transition 分别保留 previous/next Observation、Creator effectiveAt 和本地审批 recordedAt；来源、改变理由和 event links 从对应不可变 Observation 读取。
- Creator chronology 使用来源带时区的 publishedAt；Timeline 按该时间升序，Current View 与 Transition 按该时间派生。先审核 9/18 新观点、后补录 8/29 旧观点，显示 8/29 → 9/18，Current View 保持 9/18。publishedAt=null 时显式 unknown_time，不以审批时间补齐，也不进入有序状态投影；同一 Creator/Topic/真实时刻存在冲突状态时标 ambiguous_time，不按审批顺序选赢家。
- Knowledge As-of 先按 source published/captured/recordedAt、Observation/Approval 和关联对象可见性过滤，再计算 Creator chronology。晚录入的旧帖在其录入/审核前不可见；新审核修订只在该 knowledge 时点后替代其祖先，历史记录不删除，旧 As-of 不变。修订旧帖子也不覆盖后来的新观点。此视图不是外部历史 strict PIT 认证。
- 宏观事件关系逐条声明 explicit（作者明确解释）/inferred（研究者推断）/temporal（时间背景）。前两者须文字依据；explicit 仍只是作者因果陈述，不是系统验证的因果。
- T+5/20/60 明确为 **calendar days，以来源可证明的 Creator 发布时间为锚点，按 UTC 加日**。不声称交易日，不自动获取价格。锚点未知时 anchorAt/dueAt=null、chronology=unresolved；不能制造审核日锚点。未满周期或锚点未知时 completed / inconclusive 均拒绝，只可保存 pending。历史回填已过期的周期可以补复盘，但 Review.recordedAt 始终保存真实人工复盘时间，不能回写历史。完成仍须实际表现及证据；结果修订必须指向同周期当前结果并保留旧记录。

## 持久化、恢复与分析副本

V1 envelope 保存 creators/topics/sources/events/observations/approvals/reviews；schemaVersion=1、semanticClass=external_commentary。repository interface 与 Browser adapter 分离，migration seam 对未支持版本 fail-closed，不修补未知字段或把缺失变零。

普通写入仅 append，duplicate ID 拒绝；load 时精确原字节与独立快照防止旧标签页/调用者原地改写。损坏原数据原样保留，写入锁定，不自动 reset。浏览器 localStorage 没有跨标签页 CAS：最终同步写前检查可检测已发生的基线变化，不宣称解决同时写竞争。

JSON 是完整可恢复备份，恢复先严格预览/引用验证，显式确认后保存 exact pre-import backup，再合并追加。相同 ID/相同内容 skip；相同 ID/不同内容拒绝，绝不覆盖历史。不自动重排已有审批；若合并来自分叉备份的旧审批导致时间顺序矛盾，拒绝导入，需人工处理。损坏库的普通 append/import 继续锁定。独立灾难恢复 seam 为：观测并绑定 exact corrupt bytes → 导出原字节 → 完整 schema/graph 预检备份 → 显式确认 → 独立 pre-recovery key 保存并读回核对原字节 → 再检查原基线 → 仅替换 tracker key → reload + semantic validation。预览无写入；备份、确认、基线或重载校验失败均报错，不静默 reset。显式不支持的 schemaVersion（包括 future schema）不归类为普通 corruption，不允许通过此 seam 覆盖。

Excel 为标准 `.xlsx` OOXML，6 张表：Creators、Current Views、Timeline、Sources、External Events、Reviews。保留来源和关系标签、未知与草稿、修订及审核信息，分别导出 Creator 时间、knowledge 审核时间、复盘锚点/未知状态与实际人工 recordedAt；所有文本使用 inline string 避免公式执行，长文本续列避免静默截断。Excel 只是分析副本，不支持反向导入。JSON 才是完整恢复格式。

## 真实样本与证据限制

公开读取 [冰冰小美原帖](https://xueqiu.com/7143769715/409823838)，账号与作者显示名匹配；页面发布时间显示 2026-09-18 16:59，未明确时区。页面明确部分评论已过滤，commentCoverage=PARTIAL。可形成 A股整体、全球利率、中国流动性/人民币三个 Observation；原文未提供明确周期和失效条件，保持 unknown。潜在政策是 trigger，不建立为已发生的事件。

没有取得该 Creator 此前已审核状态，故真实样本不能证明 A股“从某个状态改变到另一个状态”；只能作为首次录入，真实状态变化验收有证据缺口。合成测试另验证真正的 previous→new transition，不混用为真实研究结论。真实样本与核验记录仅存 gitignored 运行时 data-cache，不将真实原文/用户数据固化到测试 fixture 或正式页面 seed。仓库 fixture 只有明确合成内容。

## 初始交付验证快照（7f1d3b2，保留历史）

以下是独立审计前的初始交付结果，不代表本轮修复验证：

| 检查 | 实测结果 |
| --- | --- |
| 全量 Vitest | 79 files / 959 tests PASS |
| 本专项 domain/repository/export/UI | 41 + 12 + 5 + 11 = 69 tests PASS（已包含在全量中） |
| build | TypeScript + Local Core typecheck + Vite + financial bundle boundary PASS |
| contracts:validate | PASS；原正式合同/runtime/admission 不提升 |
| test:discovery | PASS，79 个正式 suite 保留；嵌套副本仍隔离 |
| ui:audit | PASS 静态扫描；仅生成时间变化，未把扫描冒充截图验证 |
| Browser | 287 checks PASS，0 runtime/console errors，0 external requests，目标源码运行前后 SHA-256 稳定 |
| 主题/布局 | neon/pro/light × 1536/1280/390/320，四视图和 Drawer 无横溢；reduced-motion、焦点限制/返回通过 |
| 实际写入 | 新增 Creator/Source/Observation→Draft→审核→reload；追加修订、PARTIAL、身份、As-of 与三周期复盘通过 |
| JSON | 实际下载→全新浏览器上下文→预览无写入→确认/预备份→恢复/reload，完整数据和 Current View 一致 |
| Excel | 浏览器真实下载 .xlsx；独立 ZIP CRC + openpyxl 打开六张表通过 |
| 真实样本 | 运行时 Draft 导入与时间轴通过；未冒充已核验历史转换 |
| Hosted CI | NOT_RUN；当前 workflow 只监听 pull_request 与 main push |

可审查的检查列表与源码摘要：[validation.json](stage-4-2-5-validation.json)。重跑入口：`node scripts/creator-viewpoint-browser-check.mjs`，支持 `UI_REVIEW_ORIGIN`、`UI_REVIEW_PLAYWRIGHT_MODULE`、`UI_REVIEW_OUTPUT`；使用既有 Playwright 和本地 Vite server，不安装浏览器依赖。实际截图/下载只保留在 gitignored data-cache。现存 favicon.ico 404 作为 warning 单列，不归入功能错误。

16项验收中，N Creator、来源分类、多Topic、Observation/Transition分离、append-only、draft、共享事件和三类关系、Timeline、三人比较、复盘、JSON、Excel、owner复用、三主题与build/test均有合成和/或运行时证据。真实“旧A股状态→新A股状态”仍无前态来源，不将这项真实历史证据标PASS；需补充此前原帖后经人工审核建立。

最后 fetch 的 origin/main 仍为上述精确基线，无漂移。交付只 commit / 普通 push 功能分支；独立审计 PENDING，不创建 PR、不 merge、不部署、不宣称 production admission。


## 独立审计修复与针对性复审（2026-09-19）

本轮仅处理 Creator/knowledge 时间分离、T+ 锚点及提前结果拒绝、受控 corrupt-store recovery、来源级事件 verified。输入 HEAD 为 `7f1d3b2cce7dbd72830292e99cfb83e93268733b`，继续原功能分支；main 基线仍为 `8860c943919f90daa125934fde0f385707ea7028`。

| 检查 | 本轮实测结果 |
| --- | --- |
| 受影响专项 | domain 41 + chronology 13 + repository 31 + export 6 + workspace 16 + Evidence Drawer 13 + UI review 4 = 124 tests PASS，均包含在全量中 |
| 全量 Vitest | 80 files / 997 tests PASS |
| Build | TypeScript + Local Core typecheck + Vite + financial bundle boundary PASS |
| 真实浏览器 | 321 checks PASS，0 runtime/console errors，0 external requests；目标源码运行前后摘要一致 |
| 布局 | neon/pro/light × 1536/1280/390/320、reduced-motion、Drawer 与焦点通过 |
| 时间链路 | 历史乱序回填、knowledge As-of、revision、unknown chronology、历史 T+ 锚点、early completed/inconclusive 拒绝通过 |
| JSON recovery | exact 损坏原字节导出、坏备份/断链拒绝、预览无写入、确认及原字节备份、仅 tracker 替换、reload 语义一致；future schema 拒绝通过 |
| Excel | 实际浏览器下载，ZIP CRC / openpyxl 六表及拆分时间列通过 |
| Hosted CI | NOT_RUN；workflow 仅监听 PR/main，未创建 PR |

可审查的检查清单与源码摘要见 [remediation-validation.json](stage-4-2-5-remediation-validation.json)。初始 validation.json 不回写。截图/下载/完整日志仍只在 gitignored data-cache；仅现存 favicon.ico 404 warning。CURRENT 为 IMPLEMENTED / VERIFIED LOCALLY / PENDING TARGETED RE-REVIEW，普通 commit/push 后停止。

### 仍存在的限制

- Creator chronology 依赖人工提供、带明确时区的来源时间；不是独立 strict PIT 认证。原冰冰小美样本缺少明确时区和旧状态来源，继续保留 Draft/unknown，不能据此证明真实历史转换或计算 T+。
- 同一 Creator/Topic/精确时刻的冲突观点保持 chronology unresolved；不会用本地审核先后制造真实顺序。
- localStorage 无跨标签页原子 CAS；恢复会核对原字节并保留灾前备份，但不宣称解决所有同时写竞争。
- 原实现曾接受的提前 inconclusive 或无锚点终结结果，在新校验下会 fail closed。原字节仍保留，恢复必须提供完整有效备份；不自动修改或删除旧 Review。
- 事件 verified 仅为来源核对，没有自动行情验证、Provider/Claim/Thesis 晋升或生产准入。


## Current chronology uncertainty P1（2026-09-20）

输入 HEAD `065dd8421ada9a3c2ddb1a1c32ceddd9cb10e396`；继续原功能分支，main 仍为 `8860c943919f90daa125934fde0f385707ea7028`。仅修复已审核 unknown_time 观点被旧 Current View 掩盖的问题；状态为 IMPLEMENTED / VERIFIED LOCALLY / PENDING FINAL TARGETED RE-REVIEW。

- Current View 新增纯派生 chronologyHealth（resolved/incomplete）和 unresolvedObservationIds，不增加持久化字段或第二份 current 状态，不修改 V1 envelope。
- 在同一 knowledge As-of 内，只检查已审核、active、未被已审核修订 supersede 的同 Creator × Topic 观点。若来源 publishedAt=null 且 capturedAt 晚于最近确定状态 effectiveAt，返回最近可确定状态并标 incomplete。capturedAt 仅作来源时间上界，不显示成 Creator time；recordedAt/approval time 仍只用于本地可见性。
- 若来源 capturedAt 早于或等于后续确定状态的 effectiveAt，不因此阻断该状态。Draft、rejected、未来录入/审核记录不影响当前 health。来源时间校正须追加 source/observation revision 并审核；之后自动重新派生 Current View，旧 knowledge As-of 继续保留原有 uncertainty。
- Overview 和 Comparison 共享状态卡，明确显示“最近可确定状态 + 未解析观点数量，当前状态不完整 / 无法确认”。Excel Current Views 同步 health、未解析 ID 与解释文案；Timeline 保持 unknown_time，不伪造转换。没有任何可确定状态时，原有 unknown / unresolved 空态不变。

| 本轮检查 | 真实结果 |
| --- | --- |
| 受影响专项 | 5 files / 113 tests PASS（含新增 chronology 4、UI 1、Excel 1） |
| 全量 | 80 files / 1003 tests PASS，退出码 0 |
| Build | TypeScript、Local Core typecheck、Vite、bundle boundary PASS |
| 浏览器 | 329 checks PASS，0 runtime/console errors、0 external requests；三主题、四尺寸、reduced-motion、原回填/T+/JSON recovery 回归通过 |
| Current health 实机 | Overview / Comparison / knowledge As-of / historical capture upper bound / reviewed correction / 320px 警示均通过 |
| Excel | 实际下载六表，独立 openpyxl + ZIP CRC 校验通过；health=incomplete、准确 unresolved ID、原 Creator time 均保留 |
| Hosted CI | NOT_RUN；未创建 PR，普通功能分支 push 不触发现有 workflow |

重放入口仍为原浏览器脚本；本轮证据见 [chronology-health-validation.json](stage-4-2-5-chronology-health-validation.json)。本轮全量初次发现旧文案断言未同步；随后发现原恢复 UI 测试的下载延时回调在 URL mock 清理后运行，已仅在该测试中使用受控定时器并在撤销 mock 前执行回调。最终全量无失败或 unhandled error。此前 959/997 tests、287/321 browser checks 保留为各自历史快照，不回写。

限制保持：此 health 仅描述已录入、已审核历史的 chronology 完整性，resolved 不代表抓取覆盖完整或 Provider/Claim/Thesis 核验；capture 上界可靠性依赖原始记录。未知 Creator 时间仍不可计算 T+。未改变 source-level verified、早期复盘拒绝、受控损坏恢复或既有 localStorage CAS 限制。普通 commit/push 后停止，等待最后针对性复审。
