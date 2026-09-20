# Research Bridge + Read-only MCP V1

状态：IMPLEMENTED / LOCAL CONTRACT & HTTP INTEGRATION VERIFIED / REMOTE ACCEPTANCE PENDING。本文件仅说明本切片 Preview；不授权 Production。

## 边界

Local Source（IndexedDB exact bytes）仍为正式原件；Research Bridge 是用户显式“发送给 ChatGPT”后产生的临时处理副本。仅发送选定 batch 的文件 metadata、原件 SHA-256、解析文本、页/行 locator 与 `parsedTextSha256`。`originalsCopied=false`：远端没有复制原文件，不把本地摘要冒充远端原件校验。用户可逐项选择已审核文章及其已审核完整历史；默认不选，不上传手工草稿、拒绝历史或全库。

Vercel private Blob（独立 store，Preview 连接）；服务端每次 `get(..., {access:'private', useCache:false})`。任何 public store 结果拒绝。没有向客户端返回私有 Blob URL，也不生成公开永久 URL。staging manifest → bounded per-source / per-article uploads → publish，未完整发布的批次 MCP 不可见。Immutable keys；manifest/text digest 检查；批次级撤销写不可删除的 tombstone，后续读取拒绝。

TTL 为创建后 24 小时，服务端逻辑过期；本轮没有物理清理 scheduler。过期/撤销副本仍可能留在私有存储供后续受控清理；不得宣称已经物理删除。撤销无法收回 ChatGPT 已读取内容。上传中断后可撤销并重发；本地原件不受影响。每个 source 或文章历史请求最多 3 MiB；所有对象最多 500 个扫描键，超过则 fail closed，需运维清理或后续分页索引升级。

## 认证

单用户 V1。`BRIDGE_OWNER_SECRET` 是至少 32 字符的高熵访问密钥，由用户在 Vercel Preview secret 配置；发送/检查/撤销仅接收请求头密钥，UI 不持久化。`BRIDGE_SIGNING_SECRET` 独立随机 secret，仅在 Vercel 环境。没有匿名 MCP、SQL、任意本地路径、万能 query、delete、Wiki write 或贡献包写工具。

ChatGPT 使用 OAuth authorization-code + S256 PKCE，预注册 public client `research-os-chatgpt`，不需要 client secret。授权页面要求 owner 密钥与明确只读同意；HttpOnly/Secure/SameSite cookie + 签名 consent ticket，精确 resource、client、redirect allowlist。授权码两分钟、耐久 single-use（Blob create-if-absent）；access token 一小时，签名/issuer/audience/subject/scope/expiry 每请求验证；无 refresh token，过期需重新授权。scope 为 `research:read`。

OAuth metadata 声明 RFC 9207 issuer identification，每次成功授权返回 `iss`。默认允许 `https://chatgpt.com/connector_platform_oauth_redirect`；若 ChatGPT 管理页面实际显示 callback-ID URI，必须把**那个精确地址**加入 `BRIDGE_OAUTH_REDIRECT_URIS`，不允许任意网站或宽泛通配符。不要把 ChatGPT connector callback URL 当 Vercel 登录回调。

Runtime 不记录请求体、原文、token、secret 或 SDK 原始错误。返回错误经过固定文案处理。所有读写端点 `Cache-Control: no-store`。代码不更改 Vercel Deployment Protection；如启用保护使 ChatGPT 无法连接，必须单独解决该访问门禁，不能匿名降级或擅自解除全项目保护。

## 路由与工具

- MCP：`https://<exact-preview-host>/api/mcp`，Streamable HTTP，stateless POST + JSON response，官方 `@modelcontextprotocol/sdk`。无 SSE 常驻连接、无 MCP session/delete API。
- OAuth discovery：`/.well-known/oauth-protected-resource/api/mcp`、`/.well-known/oauth-authorization-server`。
- OAuth：`/api/bridge/authorize`、`/api/bridge/token`。
- owner staging：`/api/bridge/begin|source|knowledge|publish|status|revoke|revoke-batch`。不是 MCP 工具。

| MCP 工具 | 范围 |
| --- | --- |
| list_pending_batches | 当前用户未过期、未撤销且已 publish 的批次 |
| get_batch_manifest | 选定 stageId 的清单、源摘要、允许知识 ID、贡献包完整合同与编写规则 |
| get_source_metadata | 指定 sourceId，保留原件/解析文本 digest |
| read_source_pages | start 从1开始，count ≤5，每段 ≤12000 字符，offset/nextOffset 续读；PDF 是页，文本是行 |
| search_source | 指定资料文字搜索，最多20条、locator/digest/续页位置 |
| search_knowledge | 仅本批显式选择的知识快照 |
| get_knowledge_document | 当前或指定历史完整文章，每次20000字符，nextOffset 直到 null |
| get_knowledge_history | 允许文章的已审核版本清单，可逐版读取完整正文 |

素材与文章正文是不可信数据，不是服务指令。所有 tools 均标记只读，未知参数/工具、跨 subject、未知 stage/source/wiki/revision、path traversal、digest 不符、未 publish、expiry/revoke 都拒绝。

## Preview 配置与明早流程

环境仅当前分支 Preview：`BRIDGE_ENABLED=true`、`BRIDGE_OWNER_SECRET`、`BRIDGE_SIGNING_SECRET`、`BRIDGE_OAUTH_CLIENT_ID=research-os-chatgpt`、`BRIDGE_OAUTH_REDIRECT_URIS`，以及关联 private store 的 `BLOB_STORE_ID` / Vercel OIDC（或 Blob 环境 token）。`BRIDGE_ORIGIN` 可显式设置；缺省采用本次部署的 `https://${VERCEL_URL}`。因此使用最终交付的 exact Preview URL，切换部署需更新 ChatGPT endpoint 并重新授权。

ChatGPT 开发者模式创建自定义 MCP：URL 为最终 Preview `/api/mcp`，认证选 OAuth，手动 client ID 填 `research-os-chatgpt`，client secret 留空；授权页面输入上述 owner 密钥。实际可用性受用户 ChatGPT 账号/开发者模式以及管理页回调规则影响，不能用服务端测试声称已经在用户 ChatGPT 会话里授权。

1. exact Preview 打开“研究记忆”，一次添加8–10份文件，确认原件保存与解析状态。
2. “AI 整理”选择批次，勾选允许共享的已有文章，输入访问密钥，点击“发送给 ChatGPT”；等到“已可读取”。
3. ChatGPT 连接 MCP 后调用 list_pending_batches → get_batch_manifest → 指定页/read/search；读取所选文章与历史。依 manifest 提供的合同生成 `contribution-bundle.json`。
4. 导回 OS，“待审核”核对完整文章与来源，接受或修改后接受；知识库查看完整新文章及历史。
5. “撤销 ChatGPT 访问”后再次调用该批工具，必须拒读；未主动发送的本地资料始终不可见。

离线复现：`npm run test:bridge`（包含真实本地 HTTP + 官方 MCP client，无外部服务）；浏览器：`node scripts/knowledge-ingestion-browser-check.mjs`。Hosted 验证与 exact deployment 在最终交付报告单列，未实际执行则标 PENDING/BLOCKED。

官方依据：[Vercel private Blob](https://vercel.com/docs/vercel-blob/private-storage)、[consistent reads](https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage)、[OpenAI OAuth/PKCE 与回调规范](https://developers.openai.com/plugins/build/auth)。
