# Slice 2.5 — 独立审计定向修复交付

状态：REQUEST_CHANGES 后定向修复；等待新 SHA 独立复审。远程端到端仍为 **PARTIAL**，不声明账号已连接。无 PR、merge、Production 或 MAIN CI PASS。

审计 HEAD `81c7663401bf511b5f6fb81ec81d3eb0dfb23367`；原 Base `812e7551e67b0b8af4f673524e2578ecf2e19335`；继续 `codex/stage-4-3-slice-2-5-knowledge-ingestion-v1`。开始时工作区干净，fetch 后本地/远端功能分支相同；本地 main `974bcbfdf95aff65908fce13c8a6bf1edcc34fe1`、origin/main `1d883414fe7828b682c8cd888223ccf7bd729834`。未 checkout/修改 main，未 reset、rebase 或强推。Final SHA、远端 ahead/behind 和 exact Preview 的最终部署元数据在本轮交付报告记录；不能用审计 HEAD 或中间部署代替。

## 根因与修复

| 发现 | 根因 | 修复与边界 |
| --- | --- | --- |
| R1 / P1 | 用户的 revoke-batch 路径枚举全 subject，501+ 对象先抛错，已知 stage 的读路径却仍可读 | subject + batchId 直达访问代次；不可变撤销事件 + ETag CAS 指针，成功链可审计。所有状态、发布、资料、知识读取检查代次；旧记录缺字段视为初始代次。覆盖同批此前所有发送，其他批次不受影响。重发新代次不复活旧 stage。最多8次竞争重试，失败不返回成功。旧 Preview 公网例外必须撤回，防止旧代码绕过新屏障 |
| R2 / P2 | 整批 all-parsed 发送条件与全库原件去重组合，使9成功/1失败无法恢复 | 原批次内显式选已解析子集，未发送清单与确认门禁，失败原件保留/可下载；manifest 精确授权子集，原 batch/source/SHA 不变。返回贡献包仍经现有校验与人工 Wiki Revision/Review 接受 |
| R3 / P2 | raw HTTP fallback 对每个 Buffer 分别转字符串，破坏跨 chunk UTF-8 | 逐块累计实际字节，超过3 MiB立即拒绝；限内收集 Buffer 后一次解码。保留 parsed req.body 路径。未宣称这是已验证的 Vercel 远程故障 |

R2 浏览器→真实 handler 回归同时发现并修复既有字段排序接线问题：本地 canonical snapshot 重排段落键，UI 曾按该顺序计算摘要；服务端 schema 输出顺序不同。现在传输统一为 `locator,label,text` 后计算 `parsedTextSha256`，原件摘要不变；实际解析的 PDF 页和中文/emoji 文本均通过服务器校验。无新 authority、MCP write、收费模型、OCR 或双向 Obsidian。

实现前追加冻结见 [D0](stage-4-3-slice-2-5-knowledge-ingestion.md)；[合同说明](../contracts/knowledge-ingestion/v1/README.md)、[桥手册](research-bridge-readonly-v1.md) 与 [中文首用规范](research-memory-chinese-first-use-v1.md) 已同步。

## 正式回归与证据

| 门禁 | 结果 |
| --- | --- |
| 领域/Repository + UI 专项 | 28/28（22 + 6）；真实 IndexedDB repository、9成功/1失败、重开、显式8份子集、未选择身份不上传、字段顺序摘要、失败原件下载、无本机 stageId 仍可调用批次撤销 |
| Bridge contract / HTTP integration | 11/11；正式生产 PrivateBlobStore 接合成 SDK transport（真实100条分页、500键限制、不可覆盖、原子ETag）；510过期manifest及撤销累积、legacy已知stage、多次发送、八工具、资料/知识拒读、其他批次隔离、并发与配额错误。HTTP 每个字节边界及逐字节中文/emoji、JSON/摘要一致、3 MiB早拒、parsed body 兼容；callback-ID精确白名单回归 |
| 全量 Vitest | 1159/1159，89 files PASS |
| build | TypeScript、Local Core typecheck、Vite、browser boundary 与 bundle gate PASS；既有大 chunk 提示保留 |
| contracts | validate PASS；106 Local Core + 78 financial contract tests、51 Source/Wiki/Ingestion Vitest PASS |
| F3 | check PASS，51/51 tests；reference33/33，actual deterministic service0/33，Industry5/5，未提升 admission |
| discovery / UI audit | PASS；89套正式Vitest路径，隔离反例检查与标准全量测试通过。静态 audit 不代替截图验收 |
| 新流程浏览器 | 111/111；实际 PDF/MD/TXT、exact bytes/reload/download、9成功1失败、8份显式选择、真实 handler/domain/private repository + 隔离合成存储、PDF指定页、未选择源不可读、完整文章/双历史、贡献包人工接受为同 Wiki 第3版、实际 revoke-batch；3主题×4宽选择面板与原四入口无横溢出；0 runtime errors / 0未经授权外部请求；24截图 |
| 原 Wiki 浏览器 | 99/99 PASS；手工文章、审核/拒绝、完整历史、ZIP字节一致、Markdown禁止回写、备份/reload、损坏恢复前备份、未来schema锁定、3主题4宽4入口；0 runtime/console errors、0外部请求，13截图；既有 favicon 404 单列 |

Browser 与服务器 fixture 只存在测试，不进入用户流程；这不是远程 Vercel OAuth 证据。回归已进入现有正式 Vitest/Node/browser 套件，不依赖摘出源码的隔离复现脚本。并行构建期间一次旧 UI 隔离测试超时、一次原 Wiki 浏览器导航上下文被销毁；完整 Vitest 独立重跑通过，不修改原测试标准。原 Wiki 另行在稳定 dev server 上重跑。

## 远程与账号验收分账

- Final Preview 的 deployment SHA/READY、无凭据 OAuth discovery 200、MCP/owner 401：普通 push 后核验最终部署并记录在交付报告。
- 真实 owner/OAuth/PKCE/八工具/子集隔离/文章历史/撤销：**PENDING**，只可通过安全交互 wrapper 输入密钥，未读取或回显环境秘密来填补证据。wrapper 已改为显式 `-RedirectUri`，不默认 legacy。
- 用户 ChatGPT 账号连接：**PENDING**。已实际打开账号自定义创建页，用户报告已开启开发者模式；创建页要求 MCP URL 后发现 OAuth 设置。未提交账号授权、未观察到连接成功。精确 callback 以最终 URL 对应的管理页显示值为准。
- 2026-09-21 核对 [OpenAI 官方认证说明](https://developers.openai.com/plugins/build/auth)：issuer 条件可影响 stable/callback-ID 模式，均需抄录实际管理页值。保留 public client、S256、research:read 与 issuer/resource/scope 校验、精确 allowlist；没有通配符或 client secret 降级。

## 仍然存在的限制

24小时是逻辑 TTL；无 scheduler 或物理删除。过期/撤销/失败尝试对象会累积；发现列表仍受500个 stages键限制而 fail closed，但撤销和已知 stage 的读权限检查不受此限制。撤销不能追回已读取内容或此前通过检查的在途响应。ETag CAS 实际远程验证随 owner 脚本验收单列；合成 SDK 验证不能推定云端通过。Origin/profile 本地原件权威、浏览器存储限制、无全库原件备份等沿用既有合同。

## 账号连接现场补充（2026-09-21，c179aeb 后续修复）

`c179aeb` 的 exact Preview `investment-research-dashboard-o3z9t9njz-lkdmkl.vercel.app` 已通过用户安全输入后执行的真实远程17项验收，涵盖 OAuth/PKCE、重放拒绝、八工具、10份私有暂存、未选择源隔离、PDF页、完整文章/历史与 batch revoke；合成暂存已撤销。该结果仅绑定 c179aeb，不自动转移到后续部署。

账号实际创建页给出的 callback 为 `https://chatgpt.com/connector_platform_oauth_redirect`，public client 为 `research-os-chatgpt`，client secret 留空。创建了同名研究桥，但账号工具发现仍未成功，不登记账号连接 PASS。

现场发现此前脚本未覆盖浏览器原生表单：授权页的 `Referrer-Policy: no-referrer` 使 Chromium 的 POST 带 `Origin: null` 而被403拒绝；随后 `form-action 'self'` 还阻止303回跳 ChatGPT。正式隔离浏览器用生产 handler 与合成私有存储复现，修复仅将授权 GET 改为 `strict-origin`（不发送路径/查询），并在 CSP 中加入经过配置校验的精确 callback 地址。null/外国 Origin 继续拒绝，cookie/ticket/PKCE/issuer/resource/scope 校验不变。

新增正式 `npm run test:bridge:browser` 门禁，覆盖原生表单、Origin、cookie、真实303导航、callback state/issuer、PKCE兑换及重放/外国来源拒绝。没有使用真实密钥或用户浏览器 profile 作为自动测试 fixture。最终部署与账号状态仍需按新 SHA 重新核验；旧 c179aeb 不再作为最终可连接部署。

补充修复验证：全量 Vitest1159/89、Bridge11、contracts validate与106+78+51测试、build、F3、discovery、UI audit再次通过；原生OAuth浏览器门禁通过。浏览器测试以离线模式阻止所有真实ChatGPT网络流量，验证原生303发起的精确callback导航，再用生产handler完成PKCE兑换，不冒充真实账号授权。原Wiki99与新流程111的完整验收沿用本轮前述记录，文章/UI/domain未被此次授权页修正改变；最终Preview新流程另行复核。
