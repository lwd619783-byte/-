# ChatGPT 每日复盘结构化写回 OS V1

## 2026-09-27 开工 / 合同冻结

Base `0092d02e7ef13764be7877d2f56a9137685d4b8a`，origin `https://github.com/lwd619783-byte/-.git`；fetch 后 main 无漂移，open PR 0。原工作区 clean，原 branch `codex/oil-shipping-observation-v1` HEAD `700d13f` 相对 main 1 ahead / 1 behind；已从 origin/main 新建 `codex/daily-review-writeback-v1`，不沿用旧分支。使用现有主工作区，不动其他 worktree。

### 基础设施审计与选择

- Stage 4.5 仅 `os:read` 是冻结的产品权限；其私有 snapshot 是显式共享的本地 formal owners 投影，24h 访问 TTL，不是远程 authority / 长期数据库。
- OAuth 已支持参数化 issuer/resource/scope/namespace，code + S256 PKCE + 单次 code + 1h bearer，可复用 primitive，新增独立 `/api/review-mcp`、`/daily-review` issuer、`review:write` scope，不扩大原 8 个 Domain tools。
- Vercel project `prj_yPOowW5bb2zUqi9rHbLkjHWfVPq8`，team `team_9Yr7DlwRIfTtq6lvfc30z6Ni` / Hobby。现有 `research-bridge-private-v1` (`store_riDR7JT0QbWr2Y54`) Active / Private / sin1，109 objects / 165.79KB（只读查询时点）。Marketplace integrations 无 resources。浏览器 formal repositories 和本机 SQLite 不适合作为 Vercel durable server store。
- 选择复用 **PrivateBlobStore primitive + 独立 daily-review 永久命名空间**。不用 DecisionStaging，不沿用 24h TTL，不修改旧批次。无需新账号/项目/资源。Hobby 免费额度内无新增付费；额度受限会 fail closed，不能承诺无限容量/可用性。
- 已核验当前 Production deployment `investment-research-dashboard-pu7vmj4n6-lkdmkl.vercel.app` READY，绑定 Base SHA。仅是基线部署状态，不是本功能验收。
- `vercel env ls`：Blob credential 仅 Preview；Bridge enabled/auth/callback/client 配置仅旧 Slice 2.5 Preview branch，Production 未配置。不得用历史 Preview 证明当前分支已配置，不修改 Production。
- 若改用 Postgres/Redis，必须新增投研专用资源、配置与维护；本轮不需要。Blob 适合单 owner、单行业、低频 append-only 文档；不适合大型关联查询。后续调度可复用相同业务 API，不授予存储管理员能力。

官方依据：[Blob SDK consistency / conditional writes](https://vercel.com/docs/vercel-blob/using-blob-sdk)、[Hobby Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)。本机锁定 SDK `@vercel/blob 2.8.0` 支持 `useCache:false`、`ifMatch`。

### Daily Review 合同（先冻结，后实现）

属于 AI Research Context，可自动发布展示，**不是 Formal Decision State**。新增 `daily-review.v1`，严格字段 allowlist，32KiB 请求、短文本/列表限制。V1 subject 固定 industry/oil-shipping；其他 subject 待后续版本。real/synthetic 命名空间隔离。

- identity: 服务端派生 reviewId（subject + 上海 reviewDate），revision，createdAt/updatedAt；客户端 asOf / dataAsOf / generatedAt，严格日期和未来时间拒绝。
- provenance: AI generator，source refs（os/notion/public，locator/exact revision、source date/asOf/availableAt、availability、引用性质），previousReviewId/previousRevision 精确绑定。只保留引用，不抓取 URL，不存整份 Notion。
- content: summary、typed observations（fact/derived/interpretation）、delta/supports/challenges/risks、watchNext（condition/metric/currentState/direction/horizon）、confidence/uncertainty、formalDecisionImpact（none/review_required/candidate_for_formal_update）。来源结构有效不等于证据被独立验证；AI 文字不能成为数据 owner。
- AI 工具仅可产生 AI_DRAFT / AI_PUBLISHED。USER_CONFIRMED 需独立 owner 确认当前 exact revision；WITHDRAWN 是 owner 追加的 tombstone revision，不物理删除；SUPERSEDED 是历史读取派生状态，原 immutable status 保留。确认 Review 不等于确认 Claim/Thesis。
- 每条 immutable revision 含 audit actor、action、contentDigest、前版链接。一个 subject 的 CAS manifest 原子提交 revision 引用、idempotency receipts 和 auth epoch；无数据库跨对象事务假设。未进入 manifest 的对象不是已提交 revision。
- idempotency key 绑定 canonical 请求；完全相同 key 重试返回原 exact revision，key 改内容拒绝。同内容 current 重试不新建 revision。expectedRevision CAS 防止并发覆盖。读取只沿已提交 manifest；旧 revision 不覆盖。
- 有界 V1：4096 revisions / 8192 receipts，每日最多 24 个新 revision，超过明确拒绝，历史不删。列表分页、exact 读取；历史 context 同时过滤 asOf 和 createdAt，不能把后来发布的 revision 倒灌历史。
- Review write、revoke、owner confirmation 共用同一 manifest CAS；token epoch 撤销后新请求拒绝，在途写入 CAS 冲突；旧 os:read/research:read token audience/scope 不匹配。
- OS 页面只通过 owner-authenticated read 显示；密钥仅组件内存，刷新需重连，不存入 localStorage，不注入 Vite，不公开私人 Review。

正式 authority 仍是 BrowserClaimRepository / BrowserThesisRepository / BrowserExpressionRepository 与 localhost Portfolio projection。现有 preview、F2、exact binding、confirmation、audit 不改变。禁止 generic CRUD/SQL、任意路径、正式写入或交易。

## 实现范围与使用方式

Executable schema: `shared/daily-review.mjs`；类型声明 `shared/daily-review.d.mts`；合同检查纳入 `contracts:validate`。永久 owner 为 `server/daily-review/store.mjs`。五个 MCP tools：`get_daily_review_context`、`get_daily_review`、`get_daily_review_history`、`prepare_daily_review`、`publish_daily_review`。只有 publish 的 `readOnlyHint=false`，不伪装写动作。prepare 是无副作用预检；publish 自己重新验证，不依赖模型曾调用 prepare。

`get_daily_review_context(asOf)` 复用油运未准入常量和已有 priceHistory.generated owner，仅返回三个证券的留存元数据（source/availableAt/日期/状态/内容 digest），不产生价格/涨跌幅计算。write 强制带入 blocked freight ref，并按同一 asOf 核验所有 OS ref；未知 locator、伪造 available/revision 拒绝。来源较新于 asOf 时标为 missing，不能从后来取得的留存资料推断历史可得性。public/Notion URL 仅校验结构、日期和引用闭合，**不代表独立验证外部事实或语义**；自然语言仍明确显示 AI 未确认，不能覆盖数据区域。

每个提交包含完整 record 和 audit；manifest 是唯一提交 authority，原子含 revision refs、idempotency receipts、auth epoch。CAS 失败可留不可见 orphan，V1 不自动物理删除。withdraw 和 confirm 都追加 revision；revoke 追加私有 access audit 并推进同一 manifest epoch。首版容量上限是显式安全限制，达到后拒绝新写，不修剪历史；扩容/迁移是后续维护任务。

Hosted routes：`/api/review-mcp` + `/api/daily-review/{authorize,token,current,history,transition,revoke}`；两个独立 OAuth well-known 路由。owner REST 不提供 AI publish 公网捷径；write 仅 authenticated MCP。owner API 需要 `X-Bridge-Owner-Secret`，transition/revoke 还要求同源 Origin + JSON。前端仅内存保存访问密钥；连接后 30 秒与窗口重新聚焦读取 current，历史选择绑定 exact date/revision。后台/失败时不将旧页面内容当作新读取成功；人工确认绑定点击当时的精确版本，不随轮询跳到新版本。

### Setup / migration

无需建表、迁移已有业务资料或创建云资源。首次成功提交在永久 namespace 懒创建 manifest；旧 staging / formal stores 无迁移。server-only 配置沿用 `BRIDGE_OWNER_SECRET`、`BRIDGE_SIGNING_SECRET`、`BRIDGE_OAUTH_CLIENT_ID`、`BRIDGE_OAUTH_REDIRECT_URIS`、已有 Blob credential，新增 `DAILY_REVIEW_ENABLED=true`、`DAILY_REVIEW_WORKSPACE`；可选 `DAILY_REVIEW_SCOPE=synthetic` 用于隔离验收（默认 real）。`BRIDGE_ORIGIN` 可显式设置精确 HTTPS origin，否则使用 VERCEL_URL。Secret 只能放 Vercel 的 server-side Secret 或本机 ignored env，不能放 VITE_*，也不用发给 ChatGPT。

本地页面如需访问 Hosted Review，配置 server-only `DAILY_REVIEW_REMOTE_ORIGIN`；已有 loopback seam 仅转发固定 owner routes，不转发任意 URL/路径/SQL，不接受外部网络请求。配置/账号授权完成后正常页面即可读取，不需要改前端代码或复制 JSON。

### ChatGPT 与调度可行性

2026-09-27 真实账号只读检查：Pro 登录态可访问设置/插件。已安装「投研 OS 研究桥 · 公开资料验收」，仍绑定旧 `/api/mcp`、OAuth、dev mode，页面显示「关联」；没有本轮 Review write lane。首次 CUA 出现 `Unable to load browser request-header policy`，重试恢复，因此**不是最终 blocker，也不是平台禁写证明**。未变更旧插件、未代用户授予新写权限。

[官方 MCP 接入指引](https://developers.openai.com/plugins/deploy/connect-chatgpt) 要求 HTTPS endpoint、认证 discovery、developer-mode connection 与真实 tools/confirmation 验证。[Tasks 官方说明](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt) 说明支持部分 connected apps，需审批的动作会暂停；不能由此推断本自建 MCP、Notion 上下文、无人值守写入、失败重试在本账号均可用。本轮未完成新 write lane 的真实账号授权，所以 `SCHEDULED_CHATGPT_WRITE_NOT_PROVEN`，未创建定时任务、未购买/启用 OpenAI API。下阶段仍复用同一 publish API、idempotency key 与 CAS，无另起调度写库捷径。

## 验证与实际验收

所有 synthetic 与 real account 结果严格分列。最终数量和精确部署事实在收口时补齐。

| 已执行检查 | 结果 |
| --- | --- |
| Daily Review focused | 11 Node + 5 UI PASS；schema/PIT/refs/OS blocked/幂等/CAS/concurrency/owner/revoke/expiry/SDK 与人工 exact confirmation |
| 真实现有私有 Blob | 8 PASS；synthetic workspace `acceptance-78822275-aff2-4e10-b7c2-a3d38aa584c4`，创建/重试/新 adapter reload/修订/旧版/history/revoke/withdraw；测试历史保留，无 real Review |
| 本地 SDK→HTTP→store→真实油运 UI | 24 PASS，390/1440，空态/AI published/confirmed/历史/过期/缺失来源/长内容/空 supports/challenges，0 page errors |
| contracts:validate | PASS，含新 daily-review 合同 |
| test:contracts | 106 + 78 Node、162 Vitest PASS |
| Bridge / Domain | 31 Bridge、14 Domain Node + 33 Domain Vitest PASS |
| research eval | check PASS；65 Node + 57 Vitest PASS |
| data audit | exit 0；0 errors / 42 warnings，P0=0；本轮未新增业务告警，较旧生成报告多6个已存在 generated validators 的非阻断 missing-to-zero 匹配 |
| discovery / UI audit | PASS / PASS；UI audit 本身不证明视口验收 |
| build / bundle budget | PASS，保留原 large-chunk advisory；最终代码再次 build 结果待收口 |

失败记录保留在 ignored `data-cache/daily-review/`：浏览器首轮导航30s超时；第二轮测试 middleware 被原 local relay 先处理，未看到卡片，已修正**测试 harness 插件顺序**，未放宽生产路由/认证。第三轮24项通过。全量单测首轮115 files通过 / 1 file失败（1511 passed / 3 failed），owner-state 两项20s超时及其后续dialog失败；原文件单独重跑14/14通过。未降低断言、修改测试超时或排除测试；最终全量串行重跑另列。并行负载为疑似原因，不宣称已经证明根因。

安全：无 SQL/CRUD/任意对象路径/数据库管理工具；无 Formal/Portfolio/交易写入。Blob 私有读写只在服务端，owner/workspace/scope 路径隔离与 token 验证，RLS 不适用（未用 Postgres/Supabase）。无 secret 进入 Git/UI/PR/log；本地下载的 Preview 配置仅 ignored 文件，Sensitive 旧认证值无法导出，未从历史日志恢复密钥。
