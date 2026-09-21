# Research Bridge + Read-only MCP V1

> 2026-09-21 CURRENT 安全切换：沿用已复审代码 `47612e1`（用户提供 PASS），新增验收辅助脚本仍待独立复审。两项密钥仅轮换本分支 Preview；6 个旧部署及分支 alias 的 21 次公网保护检查通过。最终 Preview 安全负向 6/6、远程 synthetic smoke 17/17、公开原件 UI 10/10 通过；首轮 8 份已发布，2 份未发送，持久 profile 已保留。当前停在 HUMAN_RESEARCH；真实 ChatGPT 调用与本人 CREATE / UPDATE 审核 PENDING。以[本轮切换记录](stage-4-3-slice-2-5-preview-cutover.md)为最新状态，下方旧记录保留原时点。无 PR / merge / Production。


状态：远程端到端 **PARTIAL**；IMPLEMENTED / LOCAL CONTRACT & HTTP INTEGRATION VERIFIED / REMOTE DISCOVERY & ANONYMOUS DENIAL VERIFIED；真实 owner/OAuth/staging 工具全链验收和 ChatGPT 账号连接仍分别 PENDING。本文件仅说明本切片 Preview；不授权 Production。

## 边界

Local Source（IndexedDB exact bytes）仍为正式原件；Research Bridge 是用户显式“发送给 ChatGPT”后产生的临时处理副本。仅发送选定 batch 的文件 metadata、原件 SHA-256、解析文本、页/行 locator 与 `parsedTextSha256`。`originalsCopied=false`：远端没有复制原文件，不把本地摘要冒充远端原件校验。用户可逐项选择已审核文章及其已审核完整历史；默认不选，不上传手工草稿、拒绝历史或全库。

Vercel private Blob（独立 store，Preview 连接）；服务端每次 `get(..., {access:'private', useCache:false})`。任何 public store 结果拒绝。没有向客户端返回私有 Blob URL，也不生成公开永久 URL。用户在原批次内选择已解析资料并确认未发送清单；manifest 仅含获选资料，不上传未选资料身份。manifest → bounded per-source / per-article uploads → publish，未完整发布的批次 MCP 不可见。解析文本按固定 `locator,label,text` 字段顺序计算 JSON SHA-256；原件 SHA 独立保留。

TTL 为创建后 24 小时，服务端逻辑过期；本轮没有物理清理 scheduler。过期/撤销副本仍可能留在私有存储供后续受控清理；不得宣称已经物理删除。撤销无法收回 ChatGPT 已读取内容。上传中断后可撤销并重发；本地原件不受影响。每个 source 或文章历史请求最多 3 MiB。批次发现仍有 500 个 stages 扫描键上限，累积超过则列表 fail closed，后续需索引/分页治理；**撤销与已知 stage 的状态/资料/知识读取不依赖此列表**，撤销无需先物理清理。

批次撤销直接访问 `batches/<batch hash>/access.json`：不可变事件记录 previousGeneration、generation、revokedAt，再以 Blob ETag CAS 更新访问指针（最多8次竞争重试）。成功指针及其 previousGeneration 链表示已提交撤销；未入链事件仅是失败尝试，不是成功证据。资料/知识/manifest/发布/状态均核验该代次，直接 stage tombstone 继续有效。旧 manifest 缺代次视为初始 null；首次批次撤销覆盖所有旧记录及同批此前多次发送。重发绑定新代次，不能复活旧 stage。begin 读取代次之前已提交的撤销不会阻止之后的新显式发送；取得旧代次的并发发送不可发布。失败返回错误，不能虚报已撤销；用户可重试。并发中已完成授权检查的在途响应、已被读取内容不能被追溯收回。

升级切换必须关闭旧代码 Preview 的公网访问例外：旧运行时不了解代次屏障，不能继续作为外部 MCP 入口。只为绑定本次 Final SHA 的 Preview 保留所需例外，项目保护保持。

## 认证

单用户 V1。`BRIDGE_OWNER_SECRET` 是至少 32 字符的高熵访问密钥，由用户在 Vercel Preview secret 配置；发送/检查/撤销仅接收请求头密钥，UI 不持久化。`BRIDGE_SIGNING_SECRET` 独立随机 secret，仅在 Vercel 环境。没有匿名 MCP、SQL、任意本地路径、万能 query、delete、Wiki write 或贡献包写工具。

ChatGPT 使用 OAuth authorization-code + S256 PKCE，预注册 public client `research-os-chatgpt`，不需要 client secret。授权页面要求 owner 密钥与明确只读同意；HttpOnly/Secure/SameSite cookie + 签名 consent ticket，精确 resource、client、redirect allowlist。授权码两分钟、耐久 single-use（Blob create-if-absent）；access token 一小时，签名/issuer/audience/subject/scope/expiry 每请求验证；无 refresh token，过期需重新授权。scope 为 `research:read`。

OAuth metadata 声明 RFC 9207 issuer identification，每次成功授权返回 `iss`。2026-09-21 重新核对官方说明：满足 issuer 条件时可能使用 stable callback，否则使用 callback-ID URI；**必须以本连接管理页实际显示值为准**，不能把已有环境中的 legacy URI 推定为新连接正确配置。把那个精确地址加入 `BRIDGE_OAUTH_REDIRECT_URIS`，不允许通配符，不把 owner 密钥填入 client secret。账号创建页与实际 OAuth 授权通过是两项不同证据。

Runtime 不记录请求体、原文、token、secret 或 SDK 原始错误。返回错误经过固定文案处理。所有读写端点 `Cache-Control: no-store`。部署实测发现 Vercel SSO 返回302，已按本轮远程 MCP 授权仅对验收 Preview 的 exact deployment 配置 protection exception；全项目保护未关闭，旧的失败 Preview 例外已撤销。例外仅允许抵达应用 OAuth/认证入口；资料与 MCP 仍要求凭据，无匿名降级。后续部署需单独核验例外，不能误用项目级 automation bypass 作为 ChatGPT 密钥。

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
2. “AI 整理”选择原批次，逐项选择或点击“选择全部已解析资料”，核对未发送清单并勾选确认；可另选已审核文章。输入访问密钥后“发送给 ChatGPT”；等到“已可读取”。扫描/损坏 PDF 仍留在原批次可下载，无需重复上传成功文件。
3. ChatGPT 连接 MCP 后调用 list_pending_batches → get_batch_manifest → 指定页/read/search；读取所选文章与历史。依 manifest 提供的合同生成 `contribution-bundle.json`。
4. 导回 OS，“待审核”核对完整文章与来源，接受或修改后接受；知识库查看完整新文章及历史。
5. “撤销 ChatGPT 访问”后再次调用该批工具，必须拒读；未主动发送的本地资料始终不可见。

离线复现：`npm run test:bridge`（包含真实本地 HTTP + 官方 MCP client，无外部服务）；浏览器：`node scripts/knowledge-ingestion-browser-check.mjs`。Hosted 验证与 exact deployment 在最终交付报告单列，未实际执行则标 PENDING/BLOCKED。

真实远程可重复验收：项目 PowerShell 中运行 `& ./scripts/verify-research-bridge-preview.ps1 -PreviewUrl 'https://<exact-preview-host>' -RedirectUri '<管理页显示且已精确配置的回调 URI>'`，安全输入 owner 密钥，不回显、不持久化；执行真实 OAuth 授权/PKCE/防重放、11份合成投影选择10份暂存、官方 MCP client 八工具、PDF 指定页、原件/文本 digest、六章完整文章双版本、未选择源隔离、拒写与批次撤销。原件 PDF 实际解析由浏览器验收覆盖；这里明确使用合成解析投影，不冒充真实研报。脚本结束撤销合成批次，安全报告写入 gitignored `data-cache/stage-4-3-slice-2-5/remote-acceptance.json`。该脚本不代表已在 ChatGPT 账号内建立连接。

2026-09-21 Preview checkpoint `9e82cdc6591d47d0c983d574b01d313ad156e49f`（`investment-research-dashboard-ouaeatc1t-lkdmkl.vercel.app`）实测 OAuth metadata/resource metadata 均200 JSON，匿名 MCP/owner status 均401。修复了 Vite 下动态 `.mjs` API 被 SPA fallback 吞掉的问题：明确 rewrite 至单一静态 dispatcher。真实 private Blob SDK 探针已验证写入、uncached read 原值一致、并发覆盖已有键均拒绝；没有返回公开 URL。该探针只含合成状态，不代替 owner OAuth 八工具验收。最终 SHA 的 exact Preview 单独在交付报告给出；不能把中间 checkpoint 当最终版本。

官方依据：[Vercel private Blob](https://vercel.com/docs/vercel-blob/private-storage)、[consistent reads](https://vercel.com/changelog/vercel-blob-now-supports-consistent-reads-on-private-storage)、[OpenAI OAuth/PKCE 与回调规范](https://developers.openai.com/plugins/build/auth)。

授权页 GET 使用 strict-origin，仅传递来源，不泄露授权 URL 路径/查询；CSP form-action 除 self 外仅允许配置验证过的精确 ChatGPT callback，以允许原生表单303回跳。其他响应继续 no-referrer；不接受 null 或外国 Origin。正式浏览器门禁：`npm run test:bridge:browser`。c179aeb 的真实远程17项已通过，后续 Final SHA 必须重新验收，账号连接仍单列。
