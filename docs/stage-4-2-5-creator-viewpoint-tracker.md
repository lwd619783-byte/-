# Stage 4.2.5 — Creator Viewpoint Tracker V1

> 2026-09-19 CURRENT · IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW。
> 路线：Stage 4.2 CLOSED → **Stage 4.2.5 CURRENT** → Stage 4.3 NEXT。
> 开始前 fetch 的精确基线：`8860c943919f90daa125934fde0f385707ea7028`；分支 `codex/stage-4-2-5-creator-viewpoint-tracker`。

## 领域范围与复用决定

Creator Viewpoint 是 `external_commentary`，人工审核只确认摘录和观点整理，不赋予 Provider Fact、Verified Claim、User Judgment 或正式 Thesis 资格。判断后来正确也不改变这一分类。Stage 4.3 未实施。

现有公司 `ResearchEvent` 要求 stock/industry/market，不能给 Fed/人民币事件编造公司身份。本次从原 owner `src/types/researchEvent.ts` 提取 `ResearchEventCore`，既有公司事件继续继承完全相同字段；增加 `ExternalResearchEvent` 明确 `scope: external` / `macro_external`。事件在 tracker envelope 中只存一份，多位 Creator 的 Observation 通过精确 eventId 引用。没有创建公司 ResearchEvent 的镜像、第二个宏观事实 Provider 或事件评分。外部事件可保留 unverified/partial，录入或被引用不等于事实核验。

既有 Research Inbox 是公司 WatchItem/ReviewTask 的投影；ReviewTask 要求 watchItemId，不能为博主伪造 WatchItem。本专项的 T+5/20/60 到期项是已审核重要 Observation 的临时投影，只有人工复盘结果是 append-only 记录，不新增任务存储。Evidence Drawer 增加外部观点分支，复用原 Modal/focus/Escape、safeEvidenceUrl 和原 Workspace 导航。浏览器 adapter 复用 StorageLike / PersistedBaseGuard；不接 SQLite、Node Local Core、云库、Research Bridge 或任意写入口。

此专项新增的是独立浏览器 commentary 领域，不修改冻结 `contracts/v1` 的正式研究/资产权限或 wire 语义。版本事实源为 `creatorViewpoint.ts` types + `validateCreatorViewpointData` 的严格 V1 字段与引用校验，未知版本和未知字段均拒绝。

## V1 状态和时间语义

- Creator/Topic 支持任意数量；默认五个 Topic，可追加扩展。原始来源区分 post/article/comment/self_reply/repost，父级来源、内容、原网页时间标签、精确发布时间、抓取/录入时间各自保存。
- 精确时间必须带时区且为真实日历时刻；原网页没有时区时只保留 publishedAtLabel，publishedAt=null，不把抓取时间当成发布时间。
- 作者身份 unverified/other/verified_self 独立保存。本人回复这个来源类别不自动确认本人；verified_self 必须有来源 URL 和人工身份核验依据，仅代表账号匹配，不代表现实身份认证。
- 原文完整性和评论覆盖分别保留 FULL/PARTIAL/UNVERIFIED。展示的综合覆盖取当前来源及其父级最弱值；评论未抓全/未观察到回复不能解释为没有发表。
- Observation 不可变，审核另追加 Approval（reviewed/rejected），每条只审核一次。更正须新 Observation + supersedesId + revisionReason，旧记录和旧审批保留。Draft/rejected 不改变 Current View。
- State vector = stance + conditional + horizon + trigger + confirmation + invalidation。Summary/reasoning 的补充不自动产生 Transition。首次无前态是 initialization，不能称为已证明的历史观点变化。
- Current View 与 Transition 都是已审核 Observation 的确定性投影，没有第二份可漂移 current/transition 存储。Transition 保留 previous/next Observation、审批时间；来源、改变理由和 event links 从对应不可变 Observation 读取。
- 修订在新审批时才生效，不回写旧时点。As-of 是本地记录/审核可得时点视图，结合 source published/captured/recordedAt 与关联对象的可见性；它不是外部历史 strict PIT 认证。晚录入的旧帖子不会倒灌到录入前，未来审批与修订不影响过去 Current View。同一审批时刻保持 append 顺序。
- 宏观事件关系逐条声明 explicit（作者明确解释）/inferred（研究者推断）/temporal（时间背景）。前两者须文字依据；explicit 仍只是作者因果陈述，不是系统验证的因果。
- T+5/20/60 明确为 **calendar days，UTC，以人工审核时刻为锚点**。不声称交易日，不自动获取价格。重要 Observation 可有三个独立复盘结果；未满周期不能 completed，完成须实际表现及证据。结果修订必须指向同周期当前结果并保留旧记录。

## 持久化、恢复与分析副本

V1 envelope 保存 creators/topics/sources/events/observations/approvals/reviews；schemaVersion=1、semanticClass=external_commentary。repository interface 与 Browser adapter 分离，migration seam 对未支持版本 fail-closed，不修补未知字段或把缺失变零。

普通写入仅 append，duplicate ID 拒绝；load 时精确原字节与独立快照防止旧标签页/调用者原地改写。损坏原数据原样保留，写入锁定，不自动 reset。浏览器 localStorage 没有跨标签页 CAS：最终同步写前检查可检测已发生的基线变化，不宣称解决同时写竞争。

JSON 是完整可恢复备份，恢复先严格预览/引用验证，显式确认后保存 exact pre-import backup，再合并追加。相同 ID/相同内容 skip；相同 ID/不同内容拒绝，绝不覆盖历史。不自动重排已有审批；若合并来自分叉备份的旧审批导致时间顺序矛盾，拒绝导入，需人工处理。Corrupt store 不经本功能自动替换。

Excel 为标准 `.xlsx` OOXML，6 张表：Creators、Current Views、Timeline、Sources、External Events、Reviews。保留来源和关系标签、未知与草稿、修订及审核信息；所有文本使用 inline string 避免公式执行，长文本续列避免静默截断。Excel 只是分析副本，不支持反向导入。JSON 才是完整恢复格式。

## 真实样本与证据限制

公开读取 [冰冰小美原帖](https://xueqiu.com/7143769715/409823838)，账号与作者显示名匹配；页面发布时间显示 2026-09-18 16:59，未明确时区。页面明确部分评论已过滤，commentCoverage=PARTIAL。可形成 A股整体、全球利率、中国流动性/人民币三个 Observation；原文未提供明确周期和失效条件，保持 unknown。潜在政策是 trigger，不建立为已发生的事件。

没有取得该 Creator 此前已审核状态，故真实样本不能证明 A股“从某个状态改变到另一个状态”；只能作为首次录入，真实状态变化验收有证据缺口。合成测试另验证真正的 previous→new transition，不混用为真实研究结论。真实样本与核验记录仅存 gitignored 运行时 data-cache，不将真实原文/用户数据固化到测试 fixture 或正式页面 seed。仓库 fixture 只有明确合成内容。

## 验证与停止点

最终本地结果：

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
