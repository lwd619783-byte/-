# Research Bridge Production staging 定向诊断 · 2026-09-22

状态：**诊断及安全错误提示已实现；Production CONFIG BLOCKED；真实 MLCC / ChatGPT 全链 NOT_RUN；PENDING INDEPENDENT AUDIT**。

本轮仅普通功能分支 commit/push。没有写入 Production secret、部署 Production、创建 PR、merge、修改 main、迁移或删除资料。Wiki / contribution schema、八个只读工具、存储 owner 和生命周期不变。

## 基线与真实根因

- 正确仓库：`investment-research-dashboard`，Git remote `lwd619783-byte/-`。
- 开工时工作区 clean，原分支 `codex/ui-v2-clear-research-workspace` / HEAD `35bcb198965df6d3209d4cccd4ceaa01175d18ff`，与其远端一致；相对 fetch 后 main 为 ahead 19 / behind 1。
- fetch 后 `origin/main = 9769c46789a6efc98999fe7fabeda750710cbbb5`；从该 SHA 创建 `codex/fix-research-bridge-staging-auth`，未带入原 UI 分支的独有提交。交付 SHA 以本文件所在修复提交及最终 Git 报告为准。
- Vercel 当前 Production `dpl_8Egbposn2fHwtn7fnM4Q86NuUUnQ` 为 READY，绑定上述 main；READY 只表示部署成功。
- 本轮通过已有认证的 Vercel CLI `env ls production` 和 `api GET /v10/projects/{id}/env` 只读核验：**Production 项目配置项数量为 0**。只保留 key / target / gitBranch / type 元数据，不读取或记录解密值。
- Production alias `https://investment-research-dashboard-psi.vercel.app` 的 owner status、OAuth discovery、MCP 三条只读探针均返回 **503 BRIDGE_NOT_CONFIGURED**。

| 故障类别 | 当前结论 |
| --- | --- |
| staging / MCP 代码实现缺失 | 未发现；现有 begin/source/publish 和共享 store 已实现，本轮真实本地 HTTP 回归通过 |
| 配置检测逻辑错误 | 现有拒绝正确；缺陷是不同 prerequisite 被合并为笼统提示。拆分原因，不放宽条件 |
| Production 环境配置缺失 | **已确认根因**；缺开关、owner/signing 认证、Blob 绑定及 OAuth callback，首个失败条件是 BRIDGE_ENABLED |
| Web 与 MCP 配置不一致 | Production Web 未配置；本会话连接器描述绑定旧 8aa2824 Preview，实际 list 返回空数组；不能把 Preview 重连成功当 Production 可用。不是两套代码 owner；Production 无凭据，不能声称两端已指向同一实际 store |

## 调用链与正式 owner

1. `BridgeStagingPanel` 复核选择与本地解析快照，经同源 `/api/bridge/begin` 声明所选 metadata。已有 stage 时先查询 status。未选资料不在请求中。
2. `vercel.json` 将 `/api/bridge/:action` 转入 `api/research-bridge.mjs`，后者调用 `createBridgeHandler`。
3. `bridgeConfig` 检查开关、HTTPS origin、至少32字符的 owner/signing secret、Blob 配置、精确 ChatGPT callback。失败在读请求内容和访问存储之前返回503；owner 密钥不符返回401。
4. `ResearchStaging.begin` 写不可变 manifest；逐 source 上传后 publish。未 publish 不可被 MCP 发现。
5. `PrivateBlobStore` 是现有唯一远端 owner：private Blob，uncached read，不向浏览器返回 Blob URL。namespace 为 `research-bridge/v1/<subject hash>/`；单用户 subject 仍是 `personal-owner`。
6. `api/mcp.mjs` 也调用同一 handler/config/store；OAuth token 验证后 `list_pending_batches` → `ResearchStaging.list`，`get_batch_manifest` → `manifest`。两入口在同一部署使用同一进程环境来源和 namespace，无新兼容层。
7. 暂存为解析文本处理副本，原件保留 IndexedDB；24h 逻辑 TTL、publish 门槛、批次代次撤销、不可变审计保持。过期不是物理删除，既有物理清理缺口不在本轮扩展。

`scripts/dev-health.mjs` 是基础开发环境健康检查；研究桥运行时配置门禁仍由 `bridgeConfig` 负责，不新增第二套环境事实源。

## 配置状态（只列名称，不列值）

本轮 CLI/API 元数据核验于 2026-09-22。分支限定 Preview 均指 `codex/stage-4-3-slice-2-5-knowledge-ingestion-v1`。

| 配置能力 / 名称 | 现有 Preview | Production |
| --- | --- | --- |
| `BRIDGE_ENABLED` | 分支限定 | 缺失 |
| `BRIDGE_OWNER_SECRET` | 分支限定，Sensitive | 缺失 |
| `BRIDGE_SIGNING_SECRET` | 分支限定，Sensitive | 缺失 |
| `BRIDGE_OAUTH_REDIRECT_URIS` | 分支限定 | 缺失 |
| `BRIDGE_OAUTH_CLIENT_ID` | 分支限定；代码也有默认 client ID | 未设置，可沿用代码默认 |
| `BLOB_READ_WRITE_TOKEN` | Preview 全局范围 | 缺失 |
| `BLOB_STORE_ID` | 未设置；当前走 Blob token 路径 | 缺失；是另一种既有配置路径，不要求两者同时设置 |
| `BRIDGE_ORIGIN` | 未设置，旧 Preview 采用 VERCEL_URL | 未设置；生产应显式绑定用户访问的固定 origin |

`VERCEL_URL` 的部署地址 fallback 不等于固定 Production alias；启用时须将 `BRIDGE_ORIGIN` 精确绑定正式网页 origin，MCP 连接同一 origin 的 `/api/mcp`，保留严格 Origin/issuer/audience 校验，不以放宽 CORS 解决。

旧 Preview `https://investment-research-dashboard-oy854gw7y-lkdmkl.vercel.app` / `dpl_6j9pLGnctUG1w3eaZtT56qw5Vc2y` / runtime `8aa28245556163f67b4beeb9233e278aa29da5bc`：本轮 discovery 200，匿名 owner/MCP 401；连接器真实调用 `list_pending_batches` 得到 `batches=[]`。这不是本次修复 SHA 的 Preview 验收，也不是 MLCC 已暂存的证据。

## 修改与验证

- `server/research-bridge/auth.mjs`：拆分 prerequisite 失败原因，接受条件保持不变。
- `server/research-bridge/http.mjs`：固定中文错误分类；保留503/401与原 error 字段；未知配置异常降为安全通用文案，不回显原异常或配置值。
- `src/components/research-memory/BridgeStagingPanel.tsx`：非JSON响应改为环境中立的不可用提示，不再引导 Production 用户检查 Preview。
- `scripts/tests/research-bridge.node.mjs`：增加10种配置缺失/非法值门禁、错误访问密钥、SDK敏感错误遮蔽、两 handler 的 HTTP 创建到 MCP list/manifest/撤销闭环；补充过期 manifest 拒读断言。
- `src/components/research-memory/ResearchMemoryWorkspace.test.tsx`：5种失败停止于 begin，不上传后续资料、不虚报成功、不持久化密钥或失败 stage，保留本地原件；原8选中/2未选发送测试继续回归。
- 本文、Bridge CURRENT、feature registry、执行计划：分别记录代码、测试、环境和真实链路，历史审计不回写。runtime/data flow 不变，无 architecture 改动。

| 验证 | 数量 | 结果 | 环境与证据边界 |
| --- | ---: | --- | --- |
| 原基线 `npm run test:bridge` | 11 | PASS | 本地，修改前 |
| 修复 `npm run test:bridge` | 24 | PASS | 本地；含真实 HTTP + 官方 MCP client，Blob SDK 使用内存 fixture，非远程 Blob |
| Workspace 专项 Vitest | 14 | PASS | 本地 jsdom / fake IndexedDB；包含5个新增错误与原选择集成功用例 |
| `npm run test:bridge:browser` | 1 场景 | PASS | 本地真实 Edge + HTTP；合成凭据/存储，含原生表单、PKCE、重放、foreign/null Origin 拒绝 |
| `npm test` | 1,230 / 96 files | PASS | 全量 Vitest，88.73秒 |
| `npm run build` | 1 流水线 | PASS | app TypeScript + Local Core typecheck + Vite + browser boundary + bundle gate |
| Production 只读负向探针 | 3 | PASS（确认阻断） | status/discovery/MCP 均503，不是可用性PASS |
| 旧 Preview 只读探针 | 3 | PASS（仅旧部署） | discovery 200，匿名 owner/MCP 401 |
| 当前 ChatGPT connector list | 1 | PASS（空列表） | 不表示 MLCC 或新 SHA 已验收 |
| 本修复 SHA Preview staging/MCP 正向 | 0 | BLOCKED | 新修复分支没有 bridge 专属配置，不复制旧 Preview Secrets，不修改 protection |
| Production MLCC create/list/manifest | 0 | BLOCKED / NOT_RUN | 未授权 Production 配置写入 |

本地验证针对本修复工作树；交付前只补文档，最终报告用实际 commit SHA 绑定该代码与测试内容。浏览器脚本首次因本仓库未安装 Playwright 无法启动；使用已有 `UI_REVIEW_PLAYWRIGHT_MODULE` 路径后通过，未安装依赖。全量测试和构建的既有非失败 warning 不通过本轮扩大修复。

## 最终链路与唯一待授权动作

| 链路节点 | 真实 Production MLCC | 本轮本地合成验证 |
| --- | --- | --- |
| 浏览器本地保存/解析 | PASS（用户已确认，本轮未读取私有资料） | PASS |
| staging create | BLOCKED（配置503） | PASS（真实本地HTTP） |
| private store | BLOCKED（Production无绑定） | PASS（现有私有store适配器 + 模拟SDK） |
| MCP list_pending_batches 看到该批次 | NOT_RUN | PASS（官方MCP client） |
| get_batch_manifest 返回该批次 | NOT_RUN | PASS（官方MCP client） |

独立审计后，唯一需要用户批准的动作是：**授权一次 Production 研究桥启用与同源连接器切换验收**。具体执行范围：给现有项目建立与 Preview 隔离的 private Blob 绑定，配置独立 owner/signing Secret、开关、固定 Production origin 与连接器实际精确 callback，重新部署已获准代码并核验正式 MCP；不复用旧 Preview 凭据/存储来扩大旧连接器可读范围，不迁移或删除既有数据。用户不需要自行猜变量或逐项手工配置。

需要授权的原因是本轮用户明确禁止未授权的 Production Secret 写入，而非 Skill 额外设置的审批门槛。该动作可能消耗 Vercel Blob 存储、请求、流量及 Functions 额度；是否收费取决于套餐与余量，本轮未核验账单额度，不承诺免费，见[官方费用说明](https://vercel.com/docs/vercel-blob/usage-and-pricing)。对既有数据无迁移/覆盖/删除影响；浏览器 MLCC 原件仍在原 origin，只有用户后续明确选择并发送的资料进入新暂存。当前停止在普通 commit/push 后等待独立审计。
