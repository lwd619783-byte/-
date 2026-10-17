# 当前开发执行索引 · 2026-09-07

> CURRENT · 2026-10-17 独立安全迁移实现：Tailwind/PostCSS4.3.3、Vite6.4.3；新增两个audit失败门禁，业务/合同/数据及原CI不变。预检查完整audit为0，桌面demo一致；正式CSS兼容回归后进入固定SHA全套验证，尚未获发布准入。[证据与限制](tailwind4-security-20261017/README.md)。

> CURRENT · 2026-10-17 独立安全修复开工：用户验收桌面版后批准Tailwind4迁移，基于fd0009d新建fix/tailwind4-security-no-deploy；原PR87不改写。基线仍5high，保持发布阻断，待实际锁文件/audit和视觉回归验证。[范围与依据](tailwind4-security-20261017/README.md)。

> 2026-10-17 桌面布局本地验证完成：代码 `34e23a4eee12d8a84b8d3306249fe913e2a07cd4`，工作分支/PR87 Git HEAD 回读一致；120文件/1590测试，demo67+2，199新/102旧浏览器检查，1440/1920/390，11桌面+1小屏截图。仅合成UI，模拟规则未改；Node24实施方结果，待父端独立审计与新HEAD CI核实，5 high继续阻断发布。[完整回执与截图](research-os-desktop-20261017/README.md)。

> CURRENT · 2026-10-17 桌面布局候选：同分支在 7cfcc0a 上改合成 demo 侧栏与独立主区，业务语义不变，待固定 SHA 验证与父端独立审计。父端已完成 R1 审计并创建 draft PR87、旧 HEAD Node22 CI 通过；实施端 Git 远端 SHA 一致，GraphQL Forbidden，未独立复核 draft/CI 状态。PR86 依赖、禁止自动部署及5 high发布阻断保留。[范围与证据](research-os-desktop-20261017/README.md)。

> R1返修已交付本地验证：固定代码 `c905be186d2465283f8ef0c7f57aea6ff880a818`，120文件/1589测试，demo/正式构建与隔离，新154/旧102浏览器检查通过。日级成交假设不证明盘中/PIT无前视；最终清算口径含延期收益。Node24实施方结果，待父端复审及新draft HEAD CI；5 high仍阻断发布。[本轮证据](research-os-round1-20261016/remediation-r1/README.md)。

> CURRENT · 第一轮独立审计返修R1：在原分支补全全局单活动轮次、最终清算口径、日级模型限制、版本绑定用户确认和日期未知传播。实施方本地验证后仍待父端复审，无PR/merge/deploy；5 high继续阻断发布。[逐项修复与证据](research-os-round1-20261016/remediation-r1/README.md)。

> 2026-10-16 第一轮最终交付：固定实现 `d2f3eebcb6ae55be62b966720a56a871bc4e8d39`（明确依赖PR86 HEAD f64b64a），新分支 `feat/research-os-round1-no-deploy`；120文件/1569测试，正式/demo构建、合同、隔离检查，新106/旧102浏览器检查通过。13条固定SHA命令退出码/完整日志、17合成截图与失败重试均保留。完整audit exit1仍5 high，发布阻断；仅合成演示、正式系统NOT_ADMITTED。未PR/merge/deploy，停止待父端独立审计。[完整性清单与证据](research-os-round1-20261016/CHECKLIST.md)。

> 2026-10-16 第一轮合成实现已完成目标测试与浏览器预验收，待固定SHA全面验证和父端审计：指定 PR86 HEAD f64b64a 上新建 feat/research-os-round1-no-deploy，明确依赖 PR86；隔离合成 demo，禁止自动部署。最终父端独立审计后才考虑草稿 PR。见 [执行与证据](research-os-round1-20261016/README.md)。


## 2026-10-16 合成演示重建交接（CURRENT / 父任务待审计）

### 独立审计返修 R1（2026-10-16，基线 dd4cef9）

- 在同一分支承接已授权返修，不重试已被拒绝的远端部署查询；不创建 PR、合并或部署。CI 新增 `npm run test:demo` 与 `npm run build:demo`，触发范围与权限未改变。
- 动态复现旧演示：Thesis Research Context 与 portaled Claim 背景链接均是 `target=_blank` anchor。320px 下四种原生操作（click / Ctrl-click / middle-click / Enter）在两处合计产生 **8 popups / 4 outbound request attempts**；浏览器测试路由全部取消外站请求，没有访问真实站点。失败报告绑定基线与旧资产 hashes。
- 演示专用 React navigation policy 将研究来源显示为 `aria-disabled` 文本，无 href / target，明确“演示不打开外链”，策略透传 portal；覆盖 Thesis、Claim 与图表证据来源。正式模式默认仍为原 href / target / rel；合同/schema、来源 URL、数据原件和序列化语义不改。
- 预提交验证：正式/演示 build、Thesis 49 / Expression 71、demo 2 Node + 13 Vitest 均通过。浏览器 **102 checks PASS**，含三种宽度、两处来源链接四种操作、popup/request 计数与原有导入导出/CSP/溢出检查。首次修复后浏览器测试因 Playwright 拒绝点击 aria-disabled 元素而超时，修正测试为原生鼠标操作（force 只跳过 actionability，不注入 handler），重跑通过；失败保留。
- 实现已普通 push / 远端回读一致：[`29b4c3261be94adbf43eb3bd6c0bf5f66e376fbc`](https://github.com/lwd619783-byte/-/commit/29b4c3261be94adbf43eb3bd6c0bf5f66e376fbc)。固定代码 SHA 上九条最终验收命令均从干净工作区启动；证据随后单独落盘，后续证据提交不改变该实现。
- 固定 SHA 验收：Node **22.23.3** / npm **11.9.0** 干净 `npm ci` PASS；`npm test` **118 files / 1536 tests PASS**；`test:demo` **2 Node + 13 Vitest PASS**；`contracts:validate` PASS；`test:contracts` **106 + 78 Node / 162 Vitest PASS**；`test:discovery` PASS（118 suites，预期负向控制复现 3 nested checkout failures）；正式与演示 build PASS；CI YAML 与两个门禁检查 PASS。首次安装保留既有 Recharts / whatwg-encoding deprecated 和 devdir 环境提示。R1 不重算前阶段 Local Core 结果。
- Chromium **154.0.8037.57** 固定产物验收 **102 checks PASS**：320 / 390 / 1536px、两处来源链接四种原生操作、导入导出、schema 拒绝、服务禁用、CSP 与宽度检查；**0 popups / 0 unexpected requests / 0 page errors / 0 unexpected console errors**。已逐张查看 8 张最终纯合成截图。产物清单覆盖 **1614 modules / 7 restricted sources / 455 long literals**，受限内容及秘密模式 0 命中。
- 持久回执入口：[verification.json](synthetic-demo-rebuild-20261016/audit-r1/verification.json)（SHA、版本、每条命令/退出码、时间、日志 hash、失败/重试与限制）、[完整 audit JSON](synthetic-demo-rebuild-20261016/audit-r1/audit.json)、[最终浏览器机器报告及同目录截图](synthetic-demo-rebuild-20261016/audit-r1/final-browser/report.json)、[合成资产清单](synthetic-demo-rebuild-20261016/audit-r1/demo-asset-inventory.json)、[证据文件 hash 清单](synthetic-demo-rebuild-20261016/audit-r1/evidence-manifest.json)。基线失败、首次修复后的 actionability 超时、预提交成功重试均保留原机器报告，不能与最终干净 SHA 的结果混算。
- 本次实际代码 diff（相对 dd4cef9）：`.github/workflows/ci.yml`、`package.json`、`scripts/demo-browser-check.mjs`、新增 `scripts/demo-navigation-scenarios.mjs`、新增 `src/components/common/ResearchLink.tsx` 与 `.test.tsx`、`src/components/research/{ThesisWorkspacePanel,ClaimVerificationModal}.tsx`、`src/components/charts/ChartAuditPanel.tsx`、`src/demo/main.tsx`；另更新本交接与新增上述精简证据。`contracts/`、`src/data/` 相对基线零改动。
- 完整原始命令日志仅保留在本容器 `/tmp/os-r1`，**未持久交付**；Git 中提供退出码/摘要/hash，hash 不等于完整日志。基线及预提交截图未复制；最终 8 张合成截图已交付。没有上传正式构建产物、真实研究、账本、旧证据包或凭据。工程流程 Space 页面此前工具不可读，采用任务约定和仓库合同。
- **发布仍阻断**：完整 `npm audit --json` 实际 exit **1**、**5 high**，braces 无补丁依赖链未消除。Hosted CI / Sites / Preview / Production 均 NOT_RUN；不重试 Forbidden 部署查询，不推断远端部署状态。下一步仅父任务按固定 SHA 独立审计；本任务不建 PR、不 merge、不部署。
- 精简证据已 push / 回读 [`db9f0048f05df3f056b941b8f8fc468c89c750b7`](https://github.com/lwd619783-byte/-/commit/db9f0048f05df3f056b941b8f8fc468c89c750b7)，main 仍为 dbb58bc。保存时额外 staged-diff 扫描强制将 PNG 当文本，UTF-8 解码失败；shell 未启用 fail-fast，仍执行了 commit/push。此前证据 JSON 敏感扫描、八张截图逐张检查和 hash 核验均已通过；随后按九个文本文件重扫通过，17 个文件均为交接/证据、实现零变化。此次流程失败与复核结果完整记入 [post-save-check.json](synthetic-demo-rebuild-20261016/audit-r1/post-save-check.json)，不将失败扫描计为通过；本补记也仅改证据/交接。


- 基线：`dbb58bc0b17a17f3568c72cacab89161d8d71b5f`；开工时远端 main 一致，工作区干净，最新已核 PR #85。分支：`codex/synthetic-demo-rebuild-20261016`。旧容器未推送补丁不恢复，旧测试不计入本轮。
- 授权范围：依赖风险修复、独立纯合成演示候选、Thesis/Expression 窄屏修复、验证与阶段保存；不改真实研究、账本、权限或投资状态，不改其他仓库。实现后交父任务独立审计；本任务不建 PR、不 merge、不部署。
- 演示计划：只复用合同与现有决策链面板，显式合成 fixture / 独立入口 / 内存存储；来源与 schema 门禁保留，SQLite、共享、Review、生产服务禁用。正式本地入口保留。此为候选，不是全平台迁移或正式状态准入。
- 推送防部署：此分支的 `vercel.json → git.deploymentEnabled` 明确为 false；现有 Actions 只对 main push / PR 运行。依据 [Vercel 官方 Git 配置](https://vercel.com/docs/project-configuration/git-configuration)。没有改变远端项目设置或生产分支。

### 阶段 1：依赖修复（本轮本地验证）

- Node **22.23.3**；干净 `npm ci` 成功（`npm_config_devdir=/tmp/os-node-gyp`，npm cache 在 `/tmp/os-npm-cache`）。首次安装因默认 home 缓存不可写失败，保留失败记录；未跳过安装脚本。
- MCP SDK 1.30.0 → 1.31.0；Vitest 2.1.9 → 4.1.12（移除旧 tinypool / 嵌套 Vite 风险）；PostCSS selector parser 6.1.4 → 7.1.6 override；更新 PostCSS、Browserslist、fast-uri、nanoid、source-map-js 等兼容子依赖。没有使用 omit-dev、审计忽略或 force 安装。
- 官方依据：[SDK](https://github.com/advisories/GHSA-6qxp-vccf-f47h)、[Vitest](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)、[Tinypool](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)、[selector parser](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)。完整 `npm audit --json`：33 → **5 high / 0 critical / 0 moderate**。剩余根因是 [braces <=3.0.3，无官方补丁](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，经 chokidar / micromatch / fast-glob / Tailwind 传播。**仍为发布阻断，不宣称依赖风险清零**；大幅迁移 Tailwind 或维护私有 fork 不在本次最小修复内。
- `npm test`：**116 files / 1523 tests PASS**。初次升级运行 11 failures，原因是 Vitest 4 的 `vi.importActual(node:...)` 不再携带 Vite SSR 标记；仅 Node 测试配置移除浏览器打包插件，正式构建和负向构建门禁不变。测试发现命令移除已不支持的 minWorkers 参数。
- `npm run build` PASS（typecheck、Local Core typecheck、完整正式 bundle boundary / financial bundle budgets）；`contracts:validate` PASS；`test:contracts` 106 + 78 Node / 162 Vitest PASS；`test:bridge` 31 PASS；`test:daily-review` 22 Node / 6 UI PASS；`test:domain-mcp` 14 Node / 33 UI PASS；`test:discovery` PASS。
- `test:local-core`：初次 222 PASS / 39 FAIL。环境在 `/tmp/.git` 挂只读占位，数据库安全规则因此拒绝普通 tmp 路径；不改业务规则，设置 `TMPDIR=/tmp/.local-data/os-rebuild-tests` 后 **261 PASS**（含实际 Vite 静态、动态、传递 Node 导入拒绝及 SSR 控制组）。只使用临时合成数据库。
- 本轮日志暂存 `/tmp/os-rebuild-logs`，不推送完整日志、真实数据或旧证据包。GitHub 交付为代码、锁文件及此摘要；容器完整日志不构成持久交付。CI / Preview / Production 未运行，真实账号与真实账本未验收。
- 阶段 1 已推送且回读一致：[`6aa3048c112cafbfca82bde35f92e0163b077540`](https://github.com/lwd619783-byte/-/commit/6aa3048c112cafbfca82bde35f92e0163b077540)。GitHub deployments 只读查询被接口拒绝（Forbidden），故远端“无部署”状态未核验；不绕过拒绝，未调用任何部署操作。

### 阶段 2：纯合成候选与窄屏修复（IMPLEMENTED / VERIFIED LOCALLY）

- 阶段 2 已普通推送并回读一致：[`566689157c0c5a7da5e1c2be10d43eba470eebff`](https://github.com/lwd619783-byte/-/commit/566689157c0c5a7da5e1c2be10d43eba470eebff)。父任务代码审计范围：[基线至成果真实 diff](https://github.com/lwd619783-byte/-/compare/dbb58bc0b17a17f3568c72cacab89161d8d71b5f...566689157c0c5a7da5e1c2be10d43eba470eebff)。本后续提交仅补交接，不改变已验证实现。

- 入口：`npm run build:demo` → `dist-demo/`；`npm run preview:demo` 仅本地预览。原 `npm run build` / 本地正式入口不变。演示只覆盖 Thesis / Expression / 原始证据链，不声称完整 Sites 迁移；Sites 托管、PR CI、Preview 和 Production 均 NOT_RUN。
- `vite.demo.config.mjs` 独立 HTML root，`publicDir:false`、不加载 env、不安装 SQLite/Portfolio/OS Domain 中间件；所有正式 `src/data/**`、`research-data/**`、public、server、api、Local Core 和正式 App 入口禁止进入完整依赖图（含 lazy / tree-shaken 模块）。四种真实负向构建测试通过。
- 复用原面板与 schema/来源/revision/确认/追加导入逻辑；仅拆分纯 Thesis 面板和纯图表证据抽屉，避免 provider 被传递引入。Thesis 面板主体与基线逐字比对相同，仅增加 scoped CSS class。`src/demo/fixture.json` 是原合成合同 fixture 经原 Claim review / Thesis confirmation 服务生成的固定合成快照；固定 exact pins 支持刷新后导入。无 mock 填充真实模式。
- 独立内存存储；不读写正式 localStorage、IndexedDB 或 SQLite。所有标的/证据均显式合成；预置合成确认状态在页面说明。共享/MCP、Research Bridge、Daily Review、本机账本入口均 disabled；无服务客户端或生产端点进入演示依赖图。CSP `connect-src 'none'` / `worker-src 'none'` / `form-action 'none'` 阻止服务与外联请求。
- 320px 真实复现：Thesis 文档宽 334px、Expression 335px，原因是 exact-reference action 按钮。定向 scoped 换行、max-width 与 fieldset min-width 修复；不隐藏溢出。320/390/1536px 的面板、编辑、导入预览、确认预览、Expression trace / Evidence drawer 均无横向溢出；视觉检查了实际截图。
- 本轮 `npm run test:demo`：2 Node gates / 10 runtime tests PASS（跨实例导入导出、拒绝错误 schema / scope / identity / exact-source、确认前不写入、幂等、正式存储未触碰）。`test:thesis` 49、`test:expression` 71 PASS。
- `npm run test:demo:browser`：系统 Chromium **154.0.8037.57**、3 种宽度、**93 checks PASS**；0 page errors、0 unexpected console errors、0 unexpected requests；同源 API 与外部 fetch 的主动 CSP 拒绝演练另记为预期控制组，不计入正常流程错误。导出后刷新、拒绝错误 schema、预览不写、确认导入 exact data、确认说明必填均通过。21 张本轮纯合成截图。
- 浏览器安装尝试曾被 CDN 403 Domain forbidden 拒绝，未改下载域或绕过限制；使用环境已有 `/usr/bin/chromium` 完成验收。复现命令：`UI_REVIEW_PLAYWRIGHT_MODULE=<已有 playwright 包路径> DEMO_BROWSER_EXECUTABLE=<已有 chromium 路径> npm run test:demo:browser`。脚本只在 loopback 启动审核后资产的临时静态服务器，无 API。
- 最终 `npm test`：**117 files / 1533 tests PASS**；`npm run build` / `build:demo` / `contracts:validate` / `test:contracts` / `test:discovery` 均 PASS。未拼接旧轮计数。阶段 1 SDK 专项与 Local Core 结果见上文。
- 产物全图检查 **1613 modules**；七类受限源文件原件保持未改。仅本地比较 `src/data/{industries.ts,industryChainResearch.ts,stocks.ts,unitreeHistoricalResearch.ts,privateCompanies.ts,real/research.generated.json,real/signals.generated.json}` 的 **455 条长度至少 32 字符的字面值**，0 命中；秘密模式 0 命中。结合全图禁入与 `publicDir:false`，检查不只依赖文本匹配。报告不包含受限原文。
- 原始日志 `/tmp/os-rebuild-logs`、完整浏览器回执和 21 截图 `data-cache/synthetic-demo-browser`、构建产物 `dist-demo` **未推送**；仅当前容器留存，不保证恢复后仍在。GitHub 持久交付为可公开代码/测试/合成 fixture 和本交接摘要，可从锁文件重建。旧证据包、真实资料、凭据均未上传。
- **阻断/下一步**：braces 链仍有 5 high 审计项；不能称安全清零、批准发布或生产准入。父任务按固定成果 SHA 独立审计，协调范围内返修；审计通过后由父任务处理已授权 PR。本任务停止在实现交付，不建 PR、不 merge、不部署。

### 恢复与独立审计入口

- 恢复时先核 `origin/codex/synthetic-demo-rebuild-20261016` 包含上述两个阶段 SHA，检查工作区，再使用 Node 22 执行 `npm ci`、`npm run test:demo`、`npm run build:demo`；需浏览器时使用已有 Playwright/Chromium 运行上面的本地命令。若 exact commit 缺失，不退回 main 冒充恢复成功。
- 本轮未修改 `ops-collaboration-dashboard`。未读取或复制凭据，未新增 OAuth、密钥、外部权限。main 在阶段 2 前回读仍为基线 SHA。没有 PR/merge/部署操作。
- 固定合成 fixture 的一次性 SSR 生成辅助进程曾对仓库其他 HTML 发出 dependency scan 错误；生成快照随后通过原 schema/来源门禁、独立构建和完整浏览器验收。该辅助进程的原始输出未保存为完整日志；不将其计为通过的构建。
- 真实 diff 文件清单（相对基线，包含本交接文件）：

```text
.gitignore
demo/index.html
docs/development-execution-plan-2026-09-07.md
package-lock.json
package.json
scripts/check-demo-bundle.mjs
scripts/demo-boundary.mjs
scripts/demo-browser-check.mjs
scripts/tests/demo-boundary.node.mjs
scripts/tests/test-discovery.node.mjs
src/components/research/ChartEvidenceDrawer.tsx
src/components/research/EvidenceDrawer.tsx
src/components/research/ExpressionWorkspace.tsx
src/components/research/ThesisWorkspace.tsx
src/components/research/ThesisWorkspacePanel.tsx
src/demo/fixture.json
src/demo/main.tsx
src/demo/runtime.test.ts
src/demo/runtime.ts
src/services/verifiedClaim.fixture.ts
src/styles/workspace-v2.css
vercel.json
vite.demo.config.mjs
vitest.config.ts
```

本轮合成资产清单（`demo-asset-inventory.json` 不自哈希；实际构建另生成该清单）：

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `assets/index-B6rqiOJ1.css` | 51448 | `e4313ed2100492e51364e8f27b24e6eb4abf26dc07980058d06be45737d780ed` |
| `assets/index-CBBvI8VP.js` | 484599 | `0f1028d4c620c6c1a2ea3e5a9d968f834ddef365db70bc123e034d55a8c0758a` |
| `demo-boundary.json` | 100629 | `707511c82610f9b1634c36a524e667f9343cee9dba9486aaf819eb1df9d75ca7` |
| `index.html` | 676 | `54182d8e58071e89361619bcb4c0f25fb6c91149d8e4e4bb3d60a9363046261d` |



> 2026-09-27 CURRENT · **Daily Review 审计整改**：共享 deterministic context、derived 精确结果引用、OAuth 文案与资源清理已实现；本轮真实账号不接入、Production 不修改。默认测试模式对照与最终交付见 [整改记录](daily-review-remediation-v1.md)。

> 2026-09-27 CURRENT · **Daily Review Writeback V1**：contract / durable adapter / OAuth write lane / MCP / 油运 UI / SDK 集成已实现。真实 Blob synthetic 与本地页面通过，真实 ChatGPT 新连接验收和调度单列；仅 commit/push 后等待独立审计。[完整交付记录](daily-review-writeback-v1.md)。

> 2026-09-27 CURRENT · **行业动态观察页 V1——油运 / IMPLEMENTED / PENDING INDEPENDENT AUDIT（受限数据版）**。按真实可行性先冻结页面/公式合同，改造原行业默认概览，复用原 Stock/Price History/Industry Metric/Evidence/公司详情。CTFI授权及历史准入未闭合；三只A股只读历史可核对，复权未知/过期、基准未接入和关系数据不足公开呈现。没有付费源、云库、Formal Decision写入或Stage 4.6工作。交付与验收细节见[油运观察页记录](oil-shipping-observation-v1.md)。只普通commit/push，停止等待ChatGPT独立审计；不创建PR/merge/手工部署Production。

> 同日已核验 merged PR #81 / #82 / #83，main分别包含 `fc0f23466777f32eb27037f6cbcbba627f5b2478` / `7509d0ecdad530760639feadea07cb2d1d74a4cc` / `0debad7f68ba28449cf7c0c0487f012e5d09ab9f`。本条补齐旧CURRENT未登记的merge事实；不重写历史审计，也不推断Hosted/Production通过。

> 2026-09-25 CURRENT · **Industry Research Skill V1.1 / CURRENT / FROZEN SOP**。Pre-freeze `a0ed5d8b6b28bda69c01230b215812afa8a68c0c`，`origin/main @ fc0f23466777f32eb27037f6cbcbba627f5b2478` 无漂移。通用 SOP 固定 Codex Evidence Builder → Research Handoff → ChatGPT Final Writer；三状态轴正交、五子页合同、Handoff消费后保留/后续Delta明确，已移除generic Skill的电力Pilot专属要求。Pilot最终synthesis按本轮用户确认登记；本轮不继续研究、不改私人Wiki或OS、不新增runtime/依赖/合同/UI/MCP。项目入口集合不变。[冻结范围与验证](industry-research-skill-v1-validation.md)。用户已授权验证后PR+squash merge，只核验自动Production，不主动部署。本条supersede下方本任务旧待synthesis/禁止PR停止点，merge/Hosted结果待真实发生后核验。

> 2026-09-25 CURRENT · **行业深度研究 Skill V1.1：Codex Evidence Builder → ChatGPT Final Writer；IMPLEMENTED / VERIFIED LOCALLY / PENDING CHATGPT AUDIT。** 本轮 Base `1b4e3c482798c1554477192b867890184c83fd4c`，fetch 确认 `origin/main @ fc0f23466777f32eb27037f6cbcbba627f5b2478` 未漂移。复用既有研究形成短父页及 A—E Research Handoff；真实 Pilot **Wiki V1.2 / L0 GAP / V2 BLOCKED / V3 NOT STARTED / Handoff READY_WITH_GAPS**，AI 草稿待人工审核、OS Promotion 未触发。L0 缺口不回退公司验证成熟度；未执行最终 Wiki 写作，仅更正错误状态标签。项目入口数量不变，无依赖/runtime/合同/UI/Domain MCP变更，私人身份/原件未入库。Skill check、24项测试及env检查无新增FAIL；[验证与限制](industry-research-skill-v1-validation.md)。Hosted CI NOT_RUN；既有 Preview READY 绑定 Base SHA；Production NOT_MODIFIED，未主动执行Production deployment。本轮普通commit/push后停等ChatGPT审计/synthesis，无PR/merge/main写入，不主动再次部署。本条 supersede 本任务旧状态与部署表述。

> 2026-09-24 CURRENT · **Stage 4.5 — IMPLEMENTED / TARGETED FIX APPLIED / PENDING CHATGPT TARGETED RE-REVIEW**。Base `cb970497da40e7d20cdc991a8c39168f62650ddd`；同一功能分支定向修复：共享预览直接展示 snapshot 实际研究字段及逐个仓位，保留 unavailable；UI / OAuth 明确 24h 是访问有效期，不是物理删除 SLA。锁定 SDK 1.30.0 未可靠支持 tool-level `securitySchemes`，记为 NOT_APPLIED；8 tools / `os:read` / owner / staging / Legacy 边界不变。仅普通 commit/push 后等待 ChatGPT targeted re-review，无 PR/merge/main/Production 操作。[本轮修复与实际验证](stage-4-5-domain-mcp-readonly-v1.md#p1-targeted-fixes--2026-09-24-current)。本条 supersede 下方 Stage 4.5 旧停止点，不回写历史验证数字。

> 2026-09-24 CURRENT · **Stage 4.5 D0 Scope Freeze + Read-only OS Domain MCP V1 — IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。Base `e6a148d8e345e89cfbe4920d803265108e1b3e4c`（含已确认 Research Memory / Formal Decision 文档）；原本地正式 owner → 经校验的 canonical decision snapshot → 本人预览确认 → 独立私有暂存 → `os:read` Domain MCP。8 个有界只读工具、TTL/digest/generation/CAS/revoke、最小发布/撤销入口与既有 F3 tool-use 已实现。Notion = Research Memory；OS = Formal Decision System；Legacy Bridge 不扩建；Slice 1 = READ-ONLY；Stage 4.6 Agent 仍 NOT_IMPLEMENTED。Portfolio 仅复用真实 localhost projection 读取路径，Hosted 保持 unavailable；私人账本/真实 ChatGPT 账号验收 NOT_RUN。113 files / 1487 tests、build/contracts/discovery、专项与隔离浏览器验证通过；[D0、合同、验证与限制](stage-4-5-domain-mcp-readonly-v1.md)。普通 push 后停止等待独立综合审计，无 PR/merge/Production 操作。本条 supersede 下方旧 Stage 4.5 仅规划状态，不回写历史。

> 2026-09-24 CURRENT · **Stage 4.4 CLOSED；Stage 4.5 OS Domain MCP CURRENT**。PR #80 已 squash merge；merge/main `68698ae7548aeb46fe9dd95fd0fdfcb4f13d1e4e`，PR CI `35985508556` / main CI `35986495424` 均 success，Production `dpl_G8cjdpD9oT3E5sN9dCckptzkc77J` READY。产品职责同步重基线：Drive=L0 Raw Source，Notion=长期 Research Memory，OS=正式 Evidence/Claim/Thesis/Expression/Portfolio 决策系统。后续研究默认先对比/更新 Notion；只有需要正式 Evidence Gate、PIT/admission/revision、确定性计算、正式 Thesis/Expression 或 Portfolio 决策时才晋升 OS。Stage 4.5 不代理 Notion/Drive，旧 Wiki/Bridge 冻结兼容。正式工作流见 [投研知识与决策工作流 V1](research-knowledge-decision-workflow-v1.md)。


> 2026-09-24 CURRENT · Stage 4.4 docs-only closeout：**IMPLEMENTED / TARGETED RE-REVIEW PASS / READY FOR PR**。ChatGPT targeted re-review 绑定 `5d12c97cb0342176ec82196f39502668f5d9238f`，P0=0 / P1=0 / P2=0；full projection canonical integrity binding、Account lifecycle / denominator semantics、confirmation / Audit authority 与只读边界均 PASS。该 SHA 的 Preview deployment READY，用户已完成人工验收且无新增修改要求。PR NOT_CREATED / Hosted PR CI NOT_RUN / merge NOT_DONE / main NOT_MODIFIED / Production NOT_UPDATED、NOT_VERIFIED FOR STAGE 4.4；真实 Portfolio 对象不增加。下一停止点为 ChatGPT docs-only Final SHA 极轻量复核，之后由用户另行授权创建 PR。本条 supersede 下方旧 Stage 4.4 CURRENT / 停止点，历史记录与测试数字保留原时点含义。[精确事实与收口边界](stage-4-4-portfolio-exposure.md#docs-only-closeout--2026-09-24-current)。

> 2026-09-23 CURRENT · Stage 4.4 targeted audit fix：**IMPLEMENTED / PENDING TARGETED RE-REVIEW**。在已审计 `3bff8f1b52af26b812d633b9a1c66c4bad929ce6` 原分支定向修复 P1 全投影 canonical integrity binding 与 P2 Account lifecycle 传播；inactive/archived 仍计入已记录持仓分母并显式阻断/提示。冻结 Phase 1B、目标 universe、exact research pin、本机只读、交易与绩效边界不变。仅普通 commit/push，停止等待 ChatGPT targeted re-review；本条 supersede 上一条待独立审计状态，保留其历史验证数字。[定向修复与复验](stage-4-4-portfolio-exposure.md#targeted-audit-fix--2026-09-23)。

> 2026-09-23 CURRENT · **Stage 4.4 Portfolio Exposure Integrated MVP — IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。最新 main Base `9e363474abc22ebb6da391dbb2c45c9e8c9358e8`；A Foundation、B Research Exposure、C Planning/Workspace/Eval 在同一功能分支完成。110 files / 1427 tests、Local Core、contracts、build、data audit 与 browser 检查通过；细目及真实限制见 [Stage 4.4 交付](stage-4-4-portfolio-exposure.md)。普通 push 后停止等待独立审计，不创建 PR/merge/部署。本条覆盖旧 Stage 4.4 NEXT 状态，历史审计不回写。

> 2026-09-23 Final Closeout / CURRENT — **Stage 4.3 CLOSED / IMPLEMENTED / INDEPENDENT AUDIT PASS / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。R3 #77 与 A 阶段 #78 已关闭；Base `925b496e92ef7c338a248b1fb2eef5e9dabb0ee0`。下一主线 **Stage 4.4 — Portfolio Exposure MVP：NEXT / PLANNED / NOT_IMPLEMENTED**，本轮仅文档同步、普通 push 后待独立审计。精确证据见 [Final Closeout 与 Stage 4.4 handoff](stage-4-3-r3-investment-expression-closeout.md#final-closeout--2026-09-23-current)；supersede 下方旧 CURRENT、Bridge 待审计与“下一步 B”停止点，不回写其历史验证。

> 2026-09-23 Bridge 专项增量 — **Pre-4.4 Legacy Hardening / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。基于 `c3b2892459827a8ac060ee38031def840b56a546` 选择性迁移 `58dc00a` 的配置分类、安全中文错误、环境中立提示与失败隔离/只读闭环测试；Research Bridge 继续 Legacy compatibility / read-only / fail-closed，R0 authority split 不变。无 Production / Preview / MCP / private store 真实配置写入，不宣称 Production Bridge 已启用。本条仅更新 Bridge 修复事实；已完成 R3 后的 Stage 4.3 CLOSED / Stage 4.4 NEXT 总状态同步留给下一步 B，不重做 closeout。[迁移与验证记录](research-bridge-readonly-v1.md#pre-44-legacy-hardening2026-09-23)。普通 push 后等待独立审计。

> 2026-09-23 CURRENT — R2 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**。PR #76，merge/main `17a2e1929c1d7570e477a5e19aadbeee29aa04f5`；PR CI `35746157236`、main CI `35746962990`、同 SHA Production deployment `6594270082` 已实时核验 success。主线切换 **Stage 4.3-R3 Investment Expression V1 + Closeout：IMPLEMENTED / VERIFIED LOCALLY / CLOSEOUT READY / PENDING INDEPENDENT AUDIT**。真实 5 candidates / 0 verifiable / 0 verified / 0 formal Thesis / 0 formal Expression；Stage 4.4–4.6 PLANNED / NOT_IMPLEMENTED。本条 supersede 下方较早 CURRENT，不回写历史审计。[R3 D0 与交付](stage-4-3-r3-investment-expression-closeout.md)。



> 2026-09-22 CURRENT 增量：R2 基于 `8505b607be998dc8313bfc2feeea3c004669ed57` 完成 superseded Claim asOf 定向修复；**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT RE-REVIEW**。新 Thesis 必须引用其 asOf 时的 Claim head；历史 pin 保持并提示后续版本需复核。R1 CLOSED、真实 5/0/0/0 与原 admission/PIT/release blockers 不变；R3 PLANNED / NOT_IMPLEMENTED。[修复与验证](stage-4-3-r2-thesis-v1.md#p1--p2-定向修复)，普通 commit/push 后等 ChatGPT 复审。

> 2026-09-22 CURRENT — **Stage 4.3-R2 Thesis V1 + Macro → Industry：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。真实 Base `1651aa7bbf3fcdf4a59d17e7ae6e6edaf057ef7d`，分支 `codex/stage-4-3-r2-thesis-v1`。R1 **CLOSED / MERGED / PR CI PASS / MAIN CI PASS / Production READY**：PR [#75](https://github.com/lwd619783-byte/-/pull/75) 于 2026-09-22T13:33:13Z 合入上述 merge/main；PR CI [35733395999](https://github.com/lwd619783-byte/-/actions/runs/35733395999)、main CI [35734221779](https://github.com/lwd619783-byte/-/actions/runs/35734221779) 已实时核验 success；Production deployment `6591911800`（同一 Base SHA）已实时核验 `success / Deployment has completed`，与用户确认的 READY 一致。真实仍为 **5 candidates / 0 verifiable / 0 verified / 0 formal Thesis**，data admission / PIT / release blockers 不变。R2 完成后仅普通 commit/push，等待 ChatGPT 独立审计；R3 **PLANNED / NOT_IMPLEMENTED**。本条 supersede 下方旧 CURRENT 与停止点，不回写历史审计。 R2 本地全量 1,317 tests、build、contracts、research/industry/data audit、discovery 均通过；R2 real browser 49/49、synthetic browser 52/52、R1 browser 130/130（均 0 runtime errors）。详见 [R2 实现与验证](stage-4-3-r2-thesis-v1.md)。


> 2026-09-22 CURRENT — **Stage 4.3-R1 Verified Claim V1：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT**。基于本轮 fetch 的 `origin/main @ de2107571ae5ee2189b82f7ab05b6521a4457b75`。复用原 Industry candidate / F2 Graph / Evidence Drawer；新增 exact revision 用户确认、append-only Claim/history、非权威 Research Context 与 Local-first JSON backup/recovery。真实留存 5 candidates / 0 verifiable / 0 verified；admission、PIT、release 与原始数据不变。普通 commit/push 后等待 ChatGPT 独立审计，无 PR/merge/Production；R2/R3仍未实现。[R1 D0、实现与验证](stage-4-3-r1-verified-claim-v1.md)。

> R0 已实时核验：PR [#74](https://github.com/lwd619783-byte/-/pull/74)，head `44ccdd01a6d65914f2a2a8f26384fd468a71ad3b`，2026-09-22T11:50:16Z 合入 `de2107571ae5ee2189b82f7ab05b6521a4457b75`；main CI [35723692280](https://github.com/lwd619783-byte/-/actions/runs/35723692280) completed/success。登记 R0 **IMPLEMENTED / MERGED / MAIN CI PASS**；不推导 Production、data admission 或旧私人验收状态。下方较早 CURRENT 记录仅代表原时点。


> 2026-09-22 CURRENT — **Stage 4.3-R0 External Knowledge Rebaseline**；默认 External Knowledge Lane（Drive → ChatGPT → Notion），OS 聚焦 Research Decision Lane；Local Wiki / Bridge 为冻结功能范围的兼容能力。下一任务 **Stage 4.3-R1 Verified Claim V1**。本轮功能分支待独立审计；普通 commit/push 后停止，无 PR/merge/Production。[Stage 4.3-R0 正式决定](stage-4-3-r0-external-knowledge-rebaseline.md) supersede 下方旧路线与 CURRENT 停止点，历史审计/验证数字仍仅代表原时点。

> 合入事实已于 2026-09-22 重新核验：Slice 2/2.5 经 PR [#72](https://github.com/lwd619783-byte/-/pull/72) 合入 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，main CI [35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441) success；UI V2.1 经 PR [#73](https://github.com/lwd619783-byte/-/pull/73) 合入开工基线 `9769c46789a6efc98999fe7fabeda750710cbbb5`，main CI [35690271399](https://github.com/lwd619783-byte/-/actions/runs/35690271399) success。代码已 MERGED / MAIN CI PASS；旧真人审核、UPDATE/history/revoke 验收仍 PENDING / NOT_VERIFIED，本轮私人数据 NOT_REVERIFIED，不能据此宣称 Slice 2.5 完整验收 CLOSED。

> 2026-09-22 CURRENT · UI21-P1-01 源码与交付证据复审通过（用户本轮确认）；32张图片保留原捕获绑定，不代表完整线上视觉验收。UI21-P2-01 仅补公司业绩预期的本地来源读取状态，健康官方快照继续可读。应用5f05c30：全量1,225 PASS、类型/构建PASS，完整App状态210/210、导航198/198；公司专项同82断言49 FAIL→82 PASS，六张新图片独立交付。受保护Preview eefa8b5：公司状态82/82、导航198/198，保护保留。实现及运行证据见 [本轮问题记录](ui-v2-1/ui21-p2-01/README.md)。合成验证不提升真实稿件/UPDATE/撤销验收，P2 等待独立复审。

> 2026-09-22 CURRENT · UI21-P1-01：操作错误与 owner 读取健康分离，真实锁定不再把未知当0，并传播至公司/辅助统计。应用 `e5c2dcb`：全量1,220 PASS，完整App同脚本基线33 FAIL→修后129/129，导航198、Wiki76、ingestion131通过。受保护Preview `0dd9bfb` 状态129/导航198通过；32张图片ZIP已交付，历史图保留原绑定。[修法/运行证据](ui-v2-1/ui21-p1-01/README.md)。仅普通功能分支交付，PENDING INDEPENDENT REVIEW；ChatGPT未完成全站视觉验收，真实旧稿/UPDATE/撤销缺口不升级。

> 2026-09-21 CURRENT · UI V2.1：用户确认后在原 UI 功能分支继续完成信息层级与空状态校正。暖灰/灰绿/深绿视觉保持；工作台、研究事件、三类任务、知识列表/完整正文、资料三分类、设置行和七个研究子页已接线。代码 `884192d`；1,211 项测试与 build 通过，本地及受保护 Preview 全站浏览器各 198/198，Wiki 76/76、ingestion 131/131（具体 runtime 分别记录）。[本轮审计与回滚](ui-v2-1/visual-audit.md)、[33 项迁移映射](ui-v2-1/migration-inventory.json)、[机器证据](ui-v2-1/acceptance-evidence.json)。仅普通功能分支 push / 受保护 Preview，PENDING INDEPENDENT AUDIT；无 PR/merge/main/Production 授权扩大，真实光通信人工验收状态不变。

> 2026-09-21 CURRENT — 原 Slice 2/2.5 代码已由 PR #72 合入 `main @ a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，exact main CI [35603915441](https://github.com/lwd619783-byte/-/actions/runs/35603915441) success（本轮只读核实，非本任务执行 merge）。原光通信验收 13:48Z 实查仍待审核、正式 Wiki/Revision/Review 为0；真实 UPDATE/history/revoke 拒读按本次明确范围保留 PENDING/NOT_VERIFIED，不以旧延期条目或代码合入宣布完整验收PASS。Stage 4.3 后续3–6仍未实现。
>
> UI V2 作为跨模块增强插入本切片之后：从上述最新 main 建立 `codex/ui-v2-clear-research-workspace`，五入口、单浅色、旧路由兼容、共享网页阅读与原有模块接线已实现；最终验证/Preview绑定与人工缺口见 [UI V2交付](ui-v2/implementation.md) 和 [D0](ui-v2/d0.md)。仅功能分支普通push，PENDING INDEPENDENT AUDIT；不宣称本轮PR/merge/Production或后续阶段完成。以下历史CURRENT条目保留其时点，本条只覆盖当前范围及合入事实。


> 2026-09-21 CURRENT · Contract + Delta 最终收口：R1/R2/R3 @ `47612e1` 独立复审 PASS（用户确认）；本次共用正文 Markdown/GFM 安全阅读修复及其余新增差异 PENDING FINAL INDEPENDENT AUDIT。真实 ChatGPT MCP 首轮研究 / 8-source CREATE 为 PASS（用户确认并有真实贡献文件），正式 importer 与 reload 核验 PASS；本人审核仍 PENDING，正式 Wiki/Revision/Review 均0。真实 +2 UPDATE/full history 与 accepted UPDATE 后 ChatGPT revoke-denial 明确 DEFERRED / NOT_ATTEMPTED 至 Knowledge V2，不强迫接受或制造版本。安全切换只读复核 PASS；最终回归按交付 HEAD 单独绑定，不继承历史计数。详见[最终状态与验收边界](stage-4-3-slice-2-5-preview-cutover.md#currentcontract--delta-最终收口)。仅当前分支普通 commit/push 后停等独立审计，无 PR/merge/Production；Frontend V2 必须另开分支。


> 2026-09-21 CURRENT 安全切换：沿用已复审代码 `47612e1`（用户提供 PASS），新增验收辅助脚本仍待独立复审。两项密钥仅轮换本分支 Preview；6 个旧部署及分支 alias 的 21 次公网保护检查通过。最终 Preview 安全负向 6/6、远程 synthetic smoke 17/17、公开原件 UI 10/10 通过；首轮 8 份已发布，2 份未发送，持久 profile 已保留。当前停在 HUMAN_RESEARCH；真实 ChatGPT 调用与本人 CREATE / UPDATE 审核 PENDING。以[本轮切换记录](stage-4-3-slice-2-5-preview-cutover.md)为最新状态，下方旧记录保留原时点。无 PR / merge / Production。


> 2026-09-21 CURRENT 更新：独立审计 `81c7663` 为 REQUEST_CHANGES；本次 R1/R2/R3 定向修复、原生浏览器 OAuth 授权修正与正式回归见 [修复交付记录](stage-4-3-slice-2-5-audit-fixes.md)。保持同一功能分支，等待绑定新 SHA 的独立复审；远程 owner/OAuth 验收与 ChatGPT 账号连接分别记账，未取得证据不升级 PASS。下方原验收数字保留其历史时点。

> 2026-09-21 CURRENT — **Slice 2：Wiki Infrastructure V1 — independent review PASS；Slice 2.5：AI Knowledge Ingestion Foundation V1 + Research Bridge / Read-only MCP V1，IMPLEMENTED / LOCAL VERIFIED / PENDING INDEPENDENT REVIEW**。精确基线 `812e7551e67b0b8af4f673524e2578ecf2e19335`。中文四入口、多文件 exact bytes IndexedDB、页/行解析、贡献包候选、完整文章人工审核复用原 Wiki Revision/Review；用户明确发送后才进入 private Blob，八个 OAuth 只读 MCP 工具，人工 JSON 回传。真实远程部署与账号连接结果单独登记，不由本地测试推定。[本切片及验收](stage-4-3-slice-2-5-knowledge-ingestion.md)、[远程边界与连接](research-bridge-readonly-v1.md)。旧条目保留历史时点；当前停止点为 Slice 2.5 普通 commit/push 后等待独立审计，无 PR/merge/Production。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 2 P1 remediation：IMPLEMENTED / VERIFIED LOCALLY / PENDING TARGETED RE-REVIEW**。原独立审计 HEAD `188f1adcd2a5662f24dc9a57c861ae6e95934394` 为 P0=0 / P1=1；固定 `research-wiki/index.md` / `research-wiki/manifest.json` 已统一预留，沿用 NFC / NFKC / case-insensitive 与文件/目录 collision fail-closed。Projection 29、全部 Wiki 78、全量 1136 tests、build、contracts、F3、261 Local Core、discovery PASS；本轮 90/90 browser checks、13 screenshots，0 runtime/console errors、0 external requests。正常 Markdown/manifest/ZIP 字节与审计 HEAD 相同。F3 actual deterministic service 仍 0/33 NOT_IMPLEMENTED，authority/PIT/admission 不变。Hosted CI NOT_RUN；仅原分支普通 commit/push 后等待针对性复审，不创建 PR/merge，不修改 main 或部署 Production。[P1 修复与本轮验证](stage-4-3-slice-2-llm-wiki.md#p1-remediation--固定-vault-路径保留2026-09-20)。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 2 LLM Wiki V1 + Markdown/Obsidian Projection：IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。从 fetch 后精确 `origin/main @ 1d883414fe7828b682c8cd888223ccf7bd729834` 创建 `codex/stage-4-3-slice-2-llm-wiki-obsidian`。L2 Entry/append-only Revision/Review、historical Current、exact refs/trace、search/backlinks/orphans、Local-first Wiki JSON backup/recovery、`#/memory` 三视图与单向可重建 Vault 已实现；Markdown 不是真源，AI origin 不升级。70 Wiki 专项 / 1128 全量 Vitest、build、contracts、F3、261 Local Core tests、90 browser checks PASS。F3 actual service 仍 0/33，admission 不提升。Hosted CI NOT_RUN；本切片普通 commit/push 后停止等待独立审计，不创建 PR/merge/部署。[D0、验证及真实限制](stage-4-3-slice-2-llm-wiki.md)。

> Slice 2 初始交付及下方较早记录保留原时点；本次 CURRENT 状态以顶部 Slice 2.5 条目为准。

> 2026-09-20 CURRENT — **Stage 4.3 / Slice 1 Source + Extraction 正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 / Slice 2 — LLM Wiki V1 + Markdown/Obsidian Projection 进入 CURRENT PLAN / NOT_IMPLEMENTED。** Slice 1 初审 HEAD `b5b548a2e6308a2603d6603fbd0afca315cb1727` 为 P0=0/P1=1；第三方作者归因修复 HEAD `a716b2205d3056e99198852224bf56ad71026a36` 最终复审 PASS（P0=0/P1=0）；PR [#69](https://github.com/lwd619783-byte/-/pull/69) exact-head CI [35512099983](https://github.com/lwd619783-byte/-/actions/runs/35512099983) completed/success；merge/main `f9b9026a52c7e47c6a1d6a88eb9e9d22953b0186`，main push CI [35512366207](https://github.com/lwd619783-byte/-/actions/runs/35512366207) completed/success；Vercel Production `dpl_CmeXXfaEqc2BwXBBnuByMcZb7DNE` READY。Production 只表示应用部署成功，不提升 Provider/Data admission 或 strict PIT。Slice 2 冻结为“结构化 Wiki Domain 真源 → deterministic Markdown projection → Obsidian-compatible read-only Vault”；Obsidian 不成为数据库，生成 Markdown 不形成第二真源。详见 [Slice 2 冻结方案](stage-4-3-slice-2-llm-wiki.md)。

> 2026-09-20 CURRENT — **Stage 4.2.5 Creator Viewpoint Tracker V1 已正式 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS / VERCEL PRODUCTION READY；Stage 4.3 / Slice 1 Source + Extraction 已 IMPLEMENTED / VERIFIED LOCALLY / INDEPENDENT REVIEW PASS / PENDING PR-HOSTED CI；L2–L5 仍未实现。** Stage 4.2.5 独立审计最终 HEAD `025352f5bb7879ce6e1e2130fb9cd43788409928`（P0=0 / P1=0）；PR [#67](https://github.com/lwd619783-byte/-/pull/67) exact-head CI [35489459196](https://github.com/lwd619783-byte/-/actions/runs/35489459196) completed/success；merge/main `2cea477105d3e63242e65b7f3eec0b658a87ce17`，main push CI [35489619887](https://github.com/lwd619783-byte/-/actions/runs/35489619887) completed/success；Vercel Production `dpl_ExmoiCEYa2EXRfmuqnRxEAE5AfrE` READY。Production deployment 不提升 Provider/Data admission。Stage 4.3 最新冻结路线为 `L0 Raw Source/Evidence → L1 Structured Extraction → L2 Reviewed Research Memory/LLM Wiki → L3 Verified Claim → L4 Thesis → L5 Investment Expression`，Schema / Entity Identity / Provenance / PIT-asOf / Revision / Verification / Audit 贯穿全链；详见 [Stage 4.3 冻结方案](stage-4-3-research-memory-wiki-thesis-plan.md)。

> 下方 Stage 4.2.5 功能分支验证与更早记录保留其时点意义；当前执行主线为 Stage 4.3 / Slice 1；第三方作者误归因 P1 已定向修复并通过最终针对性复审（P0=0 / P1=0），下一门禁为 PR / exact-head Hosted CI。

## CURRENT — Stage 4.5 OS Domain MCP

默认 External Knowledge Lane：Google Drive L0 → ChatGPT AI draft → Notion L2 Wiki。
OS Research Decision Lane：Provider / official Evidence / Creator structured owner → Evidence Gate / F2 → Verified Claim → Thesis → Investment Expression → Stage 4.4。

| 顺序 | 交付与状态 |
| --- | --- |
| 历史 Slice 1 | CLOSED；公共 Source/Extraction、Creator adapter 继续 KEEP |
| 历史 Slice 2 / 2.5 | 代码 MERGED / MAIN CI PASS；Local Wiki / backup / Obsidian / BrowserSource / parser / read-only Bridge / Wiki UI 转 FREEZE / LEGACY COMPATIBILITY；真人验收缺口保留 |
| R0（CLOSED） | 双通道 authority；PR #74 / main CI PASS，冻结边界继续有效 |
| R1（CLOSED） | Verified Claim V1；PR #75 / PR-main CI PASS / Production READY；真实仍 5/0/0 |
| R2（CLOSED） | Thesis V1 + Macro → Industry；PR #76 / PR-main CI PASS / Production READY |
| R3（CLOSED） | Investment Expression V1 + Closeout；INDEPENDENT AUDIT PASS / PR #77 MERGED / PR CI PASS / MAIN CI PASS / Production READY |
| A 阶段（CLOSED） | Pre-4.4 Legacy Hardening；INDEPENDENT AUDIT PASS / PR #78 MERGED / PR CI PASS / MAIN CI PASS / Production READY；Bridge authority 不升级 |
| Stage 4.4（CLOSED） | Portfolio Exposure Integrated MVP；PR #80 MERGED / PR CI PASS / MAIN CI PASS / Production READY；merge/main `68698ae7548aeb46fe9dd95fd0fdfcb4f13d1e4e` |
| Stage 4.5（CURRENT） | OS Domain MCP / Controlled Tool Layer；D0 NEXT：只服务 Formal Decision System，不代理 Notion/Drive；Slice 1 默认 READ-ONLY；旧 Bridge 保留 fallback |

旧 Slice 3“Creator → Wiki + 三位真实博主”不再独立实施；Creator 保留 OS owner，长期 Wiki 交外部 Notion。旧 Slice 4–6 未实现范围由 R1–R3 承接，历史编号不改。R0 不接 Notion/Drive API、不存外部正文、不开发 Claim/Thesis/Expression、不修改 4.4；Stage 4.5 改为 OS Domain MCP，原 Bridge 仅 transitional/fallback，真实替代迁移通过前不退役。

**CURRENT STOP：Stage 4.5 D0 — 冻结 OS Domain MCP 的 authority、read scope、tool admission 与 F3 tool-use 验收；不扩建 Wiki、不实现 write tool、不删除 Legacy Bridge。** [Stage 4.4 收口](stage-4-4-portfolio-exposure.md#docs-only-closeout--2026-09-24-current)。

> 2026-09-19 CURRENT · Stage 4.2.5 独立审计修复：Creator 发布时间与本地 knowledge/audit 时间分离；历史回填不回退 Current View，T+ 使用来源锚点，未到期 completed/inconclusive 均拒绝。增加 exact corrupt bytes 保留、完整备份校验、显式确认和 reload 的受控灾难恢复；future schema 继续锁定。外部事件 verified 仅表示来源核对。124 项受影响测试、全量 997 tests / 80 files、build、321 browser checks、JSON recovery round-trip、Excel 独立读取 PASS；PENDING TARGETED RE-REVIEW，Hosted CI NOT_RUN。路线保持 Stage 4.2 CLOSED → Stage 4.2.5 CURRENT → Stage 4.3 NEXT。[当前语义与限制](stage-4-2-5-creator-viewpoint-tracker.md#独立审计修复与针对性复审2026-09-19)。

> 下方初始交付与更早记录保留原时点；本轮修复状态以上述条目为准。

> 2026-09-19 CURRENT — **Stage 4.2 CLOSED → Stage 4.2.5 Creator Viewpoint Tracker V1 CURRENT → Stage 4.3 NEXT**。本专项新增外部观点记录、独立 Topic 状态历史、人工审核/复盘、四视图 Workspace、JSON 完整恢复和 Excel 分析副本；Current View/Transition/到期项均为已审核历史投影。复用 ResearchEvent 公共 owner、Evidence Drawer、Workspace 导航和 PersistedBaseGuard；不接 SQLite/云，不提前实现 Claim/Thesis。精确开发基线 `8860c943919f90daa125934fde0f385707ea7028`。本地 959 tests / build / 287 browser checks / JSON round-trip / Excel 独立读取 PASS；IMPLEMENTED / VERIFIED LOCALLY。真实样本旧状态与明确失效条件仍未证明，未伪造转换。完整交付与限制见 [Stage 4.2.5 当前方案与交付](stage-4-2-5-creator-viewpoint-tracker.md)。独立审计 PENDING，Hosted CI NOT_RUN；仅功能分支普通 commit/push，不创建 PR/merge/部署。

> 以下 Stage 4.2 closeout 及更早 CURRENT 条目保留其记录时点；本轮顺序以上述 Stage 4.2.5 增量为准。

> 2026-09-19 CURRENT — **Stage 4.2 CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。Slice 6 独立审计通过；最终 PR head `8cc62168681719e1eedfe3b1974f5b35844df2cb`，PR [#64](https://github.com/lwd619783-byte/-/pull/64) Hosted CI [35447795829](https://github.com/lwd619783-byte/-/actions/runs/35447795829) completed/success；merge/main `05ffb33ce4edee81f174253ccbad4ee697ed974a`，main push CI [35448015019](https://github.com/lwd619783-byte/-/actions/runs/35448015019) completed/success。Stage 4.2 以 Registry/Provider → Dimensions/Snapshot → descriptive Derived Signal/Claim Candidate → F2 evidence chain → Prosperity Eligibility/ABSTAIN 收口；DATA / PRODUCTION admission、严格 PIT、正式景气 score/direction、Verified Claim/Thesis 均未提升。CURRENT 主开发线进入 **Stage 4.3 — Top-down Research Workflow**。

> Slice 5 CURRENT 事实补齐（本次实时核验）：PR [#63](https://github.com/lwd619783-byte/-/pull/63) 已合入，PR branch head `dfc54f1d0437774387869e75696681a5791082cb`，merge/main `dc8f5ec36d9626e92acc3fc91088c1b8c42ce753`。PR CI [35442595473](https://github.com/lwd619783-byte/-/actions/runs/35442595473) 与 main CI [35442791153](https://github.com/lwd619783-byte/-/actions/runs/35442791153) 均 completed/success。此事实只适用于 Slice 5；以下较早交付状态保留其时点意义。

> 2026-09-18 CURRENT — Stage 4.2 Slice 5：**D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。独立版本化 exact dimension mapping + 多因子只读快照；新增 EIA 原油产量/出口/炼厂净投入 3 owners，总计 6 owners，oil-shipping 覆盖 supply/demand/trade_flow/inventory 四维，robotics 原双 owner 保持。原 21 文件字节与 3 Registry pins/entries 不变。8 Python / 63 Node / 87 Industry Vitest、全量887 tests、6-owner replay、build、contracts、1038 browser checks PASS；data audit 0 errors / 34 非阻断 warnings。PIT/Entity/F1/F2/F3/admission 不提升；不生成新 delta/score/trend/Claim/Thesis。只普通 commit/push 后停止；本切片 Hosted CI NOT_RUN，独立审计 PENDING。[冻结方案与实测证据](stage-4-2-slice-5-plan.md)。

> 2026-09-18 CURRENT 基线核验：PR [#62](https://github.com/lwd619783-byte/-/pull/62) 已 MERGED；main `8497ac9199def1fbec420eecc6ad7b7305ce160d`，PR CI [35335279897](https://github.com/lwd619783-byte/-/actions/runs/35335279897) / main CI [35335680417](https://github.com/lwd619783-byte/-/actions/runs/35335680417) completed/success。Vercel Production deployment `6522548855`（同一 main SHA）success / READY，核验于本轮；中文化切片与 Slice 4 均已合入。以下旧交付段落保留原时点，准入/PIT/F1/F3 不提升。当前 Slice 5 仅 Metric → Dimension → Multi-factor Snapshot，冻结方案见 [Slice 5](stage-4-2-slice-5-plan.md)，不授权 Prosperity/Regime/Claim/Thesis。

> 2026-09-18 中文化审计修复增量：从 `2fd51dba9b42fc99f7bf2b3415f5c831727edbec` 修复 Industry Change / Inbox / 证据摘要的 EIA 标题展示，以及复盘任务 pending 的“待处理”上下文翻译；全局 pending 仍为“待核验”，原始事件标题与任务状态不变。相关36 tests、全量875 tests、build PASS；PENDING INDEPENDENT RE-REVIEW。仅原分支普通 commit/push，不建 PR、不 merge。[记录](chinese-ui-evidence-display-2026-09-18.md#独立审计修复增量)。

> 2026-09-18 CURRENT — 中文化与证据展示降噪：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。精确基线 `01b246a25bbe304ceb9c121e92eb91bedbdcf478`；仅显示层中文标签、证据摘要与默认折叠高级审计信息。Evidence / Chart Audit / Inbox / Industry / 产业链及首页、宏观、个股、预期主要文案已同步；原始审计字段完整保留。869 Vitest、8 Industry Python、35 Industry Node、73 Industry Vitest、build、三主题三尺寸508 browser checks PASS。Provider / Registry / Contract / PIT / Evidence owner / pins / 原始数据无差异；准入不提升。本分支普通 commit/push 后停止，不创建 PR/merge；本切片 Hosted CI 未核验。[交付记录](chinese-ui-evidence-display-2026-09-18.md)。

> 2026-09-18 基线事实补齐：Stage 4.2 Slice 4（含 CLI P1 修复）已通过 PR [#61](https://github.com/lwd619783-byte/-/pull/61) 合入；merge/main `01b246a25bbe304ceb9c121e92eb91bedbdcf478`，main CI [35332262999](https://github.com/lwd619783-byte/-/actions/runs/35332262999) completed/success，本轮实时核验。该基线为 **MERGED / MAIN CI PASS**；下方原交付记录保留其时点状态，DATA/PRODUCTION/PIT/F1/F3 不提升。

> Slice 4 P1 CLI 兼容修复（2026-09-18）：无 `--metric` 恢复历史 NBS output 默认目标；显式 EIA / 未知目标仍按 exact Registry 处理，adapter dispatch 不变。仅 CLI、回归测试及状态补充，retained data / owners / pins / PIT / admission 无变化；等待独立复审。[修复记录](stage-4-2-slice-4.md#p1-remediation--public-build-cli-compatibility-2026-09-18)。

> 2026-09-18 CURRENT — Stage 4.2 / Slice 4：**D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。从 fetch 后精确基线 `2f2d707b8b222392a969327f10f9d5af5f021eab` 实施；EIA `WCESTUS1` 官方周末商业原油库存接入既有 `oil-shipping`，11/11 声明窗口读数；3 metric owners / 2 source families，显式 fail-closed Source Adapter 分派。EIA 1 Signal / 1 Event 复用 Inbox/Evidence；未知发布时间只在 Inbox 全部日期中出现。NBS 两个 owner 的原始/生成数据与 pins 未变。865 full tests、32 Node replay tests、73 Industry Vitest、8 freshness tests、build、data audit（0 errors；28 非阻断 warnings）、EIA 169 + NBS 277 browser checks PASS。DATA/PRODUCTION NOT_ADMITTED、PIT/revision unknown、F1 NOT_READY、F3 未提升。仅普通 commit/push，不创建 PR/merge；Hosted CI NOT_RUN，push 后停止等待独立审计。[交付与可重放证据](stage-4-2-slice-4.md)。

> 2026-09-18 Stage 4.2 / Slice 3 CLOSED：独立审计最终 HEAD `910d66dff14b6c32da7aea07174dccaf97494a2c`；PR #59 Hosted CI `35318164694` completed/success；merge/main `6a9aa233b4351938b39c247833d9e72d99854269`；main push CI `35320061290` completed/success；Vercel production READY。正式登记为 **CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。保留 Company Guidance cross-epoch P2，Industry DATA/PRODUCTION、PIT/F1/F3、财务/公告默认 refresh admission 未提升。下一主线进入 **Stage 4.2 / Slice 4 — Cross-source Industry Provider Proof**，见 [Slice 3 closeout](stage-4-2-slice-3-closeout.md) 与 [Slice 4 plan](stage-4-2-slice-4-plan.md)。

> 2026-09-18 细分关系增量 CURRENT：机器人产业链按主要功能展示7个唯一细分（上4/中1/下1/横向1），移除阶段箭头，新增6条源自既有研究原文的细分功能连线；能力迁移为虚线，不表示公司供货事实。公司跨阶段原文保留，明细默认折叠。数据/Provider/PIT/cohort57/准入无变化。854 tests、build、三主题三尺寸331 browser checks PASS；[关系图与证据](stage-4-2-slice-3.md)。IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW；普通push后核验exact Preview，不建PR/merge。

> 2026-09-18 UI反馈增量（历史 b626be6）：产业链默认只显示上中下游、细分方向与阶段衔接；公司/覆盖率/Provider明细均点击节点展开，覆盖下面a0c1f64版默认展示细节的要求。原topology、数据、cohort57与准入不变。22项相关tests、build、三主题三尺寸298 browser checks PASS；[简图与证据](stage-4-2-slice-3.md)。普通push后等待独立审阅。

> 2026-09-18 Slice 3 final remediation CURRENT：**IMPLEMENTED / VERIFIED LOCALLY / PENDING THIRD INDEPENDENT REVIEW**。审计输入 `a1a4be2`、main仍`086521d`。产业链改为Architecture Canvas：3彩色Stage Groups → 10 Segment Nodes（7unique）→二级公司标签/完整展开数据，用户参考图仅供视觉方向；原topology和12家unresolved不变。Unitree保留688836.SH/A股/科创板。Stability单一受控cohort57与current generated universe精确核验，57/57候选可通过、56/57/extra/foreign拒绝，全部稳定阈值不变；0观察日导致默认refresh eligibility仍BLOCKED，不提升admission。261 observability、851 full tests、build、277 browser checks本地PASS；真实数据全部无diff，Guidance cross-epoch P2保留。普通push后核验exact Vercel SHA，停止等待第三次独立审计，不建PR/merge。[完整记录](stage-4-2-slice-3.md)、[delta](stage-4-2-slice-3-freshness.md)。

> 2026-09-18 Stage 4.2 / Slice 3：**IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**。精确基线 `086521d6bd305ea73cb5d4a426b9d4138e4a824b`；分支 `codex/stage-4-2-slice-3-industry-events-chain-diagram`。非破坏式 NBS freshness probe、真实公司刷新验证、2 个 Derived Signal / 1 个 Industry Change Event / 4 项读数、原 Inbox 与 Industry 页、既有研究结构产业链图。NBS 最新仍为 2026-08，无新 capture；NOT_ADMITTED / F1 NOT_READY / F3 actual service 0/33 保持。交付与实际 freshness delta 见 [Slice 3](stage-4-2-slice-3.md)。本轮只普通 push，等待独立审计，不创建 PR / merge。

> 2026-09-18 Slice 2 CURRENT 事实补齐：PR [#58](https://github.com/lwd619783-byte/-/pull/58) 已合入；merge/main `086521d6bd305ea73cb5d4a426b9d4138e4a824b`。PR CI [35299972640](https://github.com/lwd619783-byte/-/actions/runs/35299972640) 与 main CI [35300272837](https://github.com/lwd619783-byte/-/actions/runs/35300272837) 均 completed/success，本轮已实时核验。Slice 2 Registry / 双 metric 为 **MERGED / MAIN CI PASS**，不代表生产准入；原 Slice 2 文档保留交付时点证据。

> Slice 1 已按 [closeout](stage-4-2-slice-1-closeout.md) 关闭：PR #56、merge/main `c664021d02a45aac79c1272d4c42f6061d3fbbf2`，PR CI `35230502534`、main CI `35230848333` completed/success，独立复审 PASS。此处补齐已发生的 CURRENT 状态；不改写原审计时点记录。

> 2026-09-17 CURRENT：Stage 4.1B 已完成计划产品化收口，正式登记为 **CLOSED / IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**。Slice 3 最终独立审计 HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`；PR #54 Hosted CI `35207107183` completed/success；merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`；main push CI `35207381240` completed/success。F3 `test:research-eval` 与 `research:eval:check` 两个 direct gates 已在 PR/main Hosted CI 实际通过；Frozen V1 33-case 不变，reference 33/33 PASS（REFERENCE_ONLY），actual service 0/33、NOT_IMPLEMENTED 33/33。PRODUCTION / DATA ADMISSION 未提升。CURRENT 主开发线进入 **Stage 4.2 — Industry Data Platform**；未闭合单指标、Provider、PBC/CSRC/all-A admission、normalization/backtest 继续并行数据支线。详见 [Slice 3 closeout](stage-4-1b-slice-3.md)。

> 2026-09-17 Slice 2 合入记录：Stage 4.1B / Slice 2 — Auditable Chart V1 + Product Shell V1 已完成独立审计、PR #52、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**；audited HEAD `88f97a56d44c3d512c00444f650000d60af89e40`，merge/main `753073912356de00504ba97c221c7ac1b7c8b81d`，PR CI `35201231930` 与 main push CI `35201547659` 均 completed/success。PRODUCTION / DATA ADMISSION 未因本切片提升；严格 PIT、正式 `releaseAvailableAt`、report revision continuity、Evidence Graph closure 与 chart exact Evidence linkage 仍未证明。该段保留 Slice 2 收口时点记录。

> 2026-09-16 Slice 1 合入记录：Stage 4.1B / Slice 1 — Research Inbox + Evidence Drawer V1 已完成独立审计、PR #50、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**；audited HEAD `3a94f1c78cdea95481e49ba77ae8464cc3c6b37c`，merge/main `38ffcbd44ecd2c4531b6ef737d4c6616ec197ca8`，PR CI `35071221955` 与 main push CI `35071457928` 均 completed/success。PRODUCTION / DATA ADMISSION 未因本切片提升；该段保留 Slice 1 收口时点记录。

> 2026-09-14 CURRENT 历史记录：Stage 4.1-G 已完成独立审计、PR #48、合并与 main push CI，正式登记为 **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS**；DATA / PRODUCTION 仍 NOT_ADMITTED。当前主开发线转入 **Stage 4.1B Research Inbox / Evidence Surface / Product Shell**。以下 2026-09-12 记录保留 Stage F 合入时点意义。

> CURRENT 战略路线入口：[`current-development-direction-2026-09-13.md`](current-development-direction-2026-09-13.md) 是最新增量事实源；[2026-09-11 rebaseline](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md) 作为其下层长期基线，继续提供未被覆盖的跨域架构与同步规则。本文负责 CURRENT 开发进展、停止点与已发生交付事实。

> UI V1.0 设计入口：[NEON-RC1-20260909 获批事实源](ui-redesign/v1/README.md)与[D0–D5 执行索引](ui-redesign/v1/execution-index.md)。2026-09-09 APPROVED / FROZEN；D0 仅文档归档，D1–D5 未派发，不表示 UI 已实现或业务准入。

本索引固化当前任务顺序，不重写历史审计结论，也不重命名已有 Phase 编号。产品保持**单用户 Local-first、全球研究视角**，继续复用已有证据、PIT、Provider Stability 与审计基础。全球视角不等于已覆盖全球行情。

> CURRENT 更新：2026-09-12。已核对 `origin/main @ fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`。Financial Research Foundations V1 已由 PR #43 合入；Stage 4.1-F 已由 PR #45 合入：audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac`，PR CI run `34673260311` completed/success，main push CI run `34673371463` completed/success。固定 SHA 仅代表本次记录时点，不是永久 CURRENT main。下表既有 Phase 的 SHA/CI 是相应关闭时点证据；R2 以 Git ancestry、当前代码、committed artifacts、专项验证与对应 PR 事实登记。
> PR、merge 与 CI 必须分别按真实状态登记；静态 CURRENT 文档不预写 MAIN MERGED，也不自证 CI PASS。

## Stage 4.1B / Slice 3 当前交付（2026-09-17 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；Stage 4.1B CLOSED；PRODUCTION / DATA ADMISSION 未提升。** 统一 Node/offline Harness、审核 target registry、严格 Result schema、结构化 exact/set diff 与确定性 eval artifact 已实现；真实服务覆盖保持 0/33，禁止 oracle fallback、expected/caseId 泄露和 reference wrapper 冒充服务；future MCP/Agent 仍须通过审核 adapter 接入同一 seam。最终独立审计锁定 HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`；PR #54 Hosted CI `35207107183` completed/success；merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`；main push CI `35207381240` completed/success。两个 F3 direct gates 在 PR/main Hosted CI 均 success；45 focused、788 全量应用 tests、contracts、discovery、data audit、build 与 report replay 均由对应本地/Hosted 证据覆盖。旧 browser 证据保留原验证时点；CI remediation 未重跑视觉验收。Slice 1/2、Frozen V1 与现有 Stage F/G 不回归。closeout acceptance 与剩余 NOT_IMPLEMENTED 见 [Slice 3](stage-4-1b-slice-3.md)。

## Stage 4.1B / Slice 2 当前交付（2026-09-17 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION / DATA ADMISSION 未提升。** 本轮交付两类 Auditable Chart（价格历史、财务历史）和首页/公司 Product Shell；保留 owner 数据身份、时间语义、unknown 证明与质量降级。原公司/章节/事件深链、Evidence Drawer 和研究工作流继续复用。独立审计锁定 HEAD `88f97a56d44c3d512c00444f650000d60af89e40`；PR #52 Hosted CI `35201231930` completed/success；merge/main `753073912356de00504ba97c221c7ac1b7c8b81d`；main push CI `35201547659` completed/success。严格 PIT、正式 `releaseAvailableAt`、report revision continuity、Evidence Graph closure 与 chart exact Evidence linkage 仍未证明；价格/财务 owner 的 data/production admission 仍 unknown，既有 NOT_ADMITTED/BLOCKED 状态不变。详情与验证见 [Slice 2](stage-4-1b-slice-2.md)。

## Stage 4.1B / Slice 1 当前交付（2026-09-16 CLOSED）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION / DATA ADMISSION 未提升。** 原实现基线 `origin/main @ 2829776f8ef4b7bcbf744c8edb37410bbd6ec67a`；实现分支 `codex/stage-4-1b-research-inbox-evidence-v1`；独立审计 HEAD `3a94f1c78cdea95481e49ba77ae8464cc3c6b37c`。

首页 Inbox → 共享 Evidence Drawer → 精确公司/事件或已有 ReviewFormModal/Store 已接线；projection 仅复用 owner，确定性排序/去重、历史日期窗口、缺证据与质量状态不提升准入。详见 [设计与验证](stage-4-1b-slice-1.md)。本次仅 Slice 1；Auditable Chart、F2 runtime、Claim/Thesis、评分和 F3 service harness 未实施。

独立审计 PASS（P0=0 / P1=0 / P2=0）；PR #50 以精确 audited HEAD 合入，PR CI run `35071221955` completed/success；merge/main `38ffcbd44ecd2c4531b6ef737d4c6616ec197ca8`；main push CI run `35071457928` completed/success。严格 PIT、正式 releaseAvailableAt、production/data admission、revision continuity 与 F2 Evidence Graph closure 仍保持未证明 / 未提供。

## 冻结顺序与停止点

| 顺序 | 实现与验证门槛 | 独立审查 / 合入门槛 | 当前状态与停止点 |
| --- | --- | --- | --- |
| 独立 P0 可信展示纠偏 V1 | 移除条数评分和方向结论；source identity、quality status、value coverage、data time / freshness 分离；固定时钟边界及组件交互测试；环境检查、tests、data audit、build、UI 静态审计和浏览器验证，逐项记录限制 | 普通 push 后独立远端审查最终 HEAD；审查通过并获授权后才创建 PR，检查该 HEAD 的 CI，再决定合入 | 已合并并通过 main CI；本次核对 main 快照为 `285ff87e8d109730956517edcaeadec501d79f4c` |
| Phase 1A — Local Core Foundation | 按[实施基线](investment-dashboard-v2-phase-1a-local-core-foundation.md)落实合同校验、SQLite、Entity Registry / Resolver、append-only Audit、Repository / Domain 基础；通过专项与原有门禁 | 独立审查权限、事务、时间、历史与 bundle 边界；获授权后 PR / 精确 HEAD CI / 合入 | **CLOSED / MERGED / MAIN CI PASS**；合并快照 `41b3caa5e063805ec0ca42efc9c74ea17491ffc4`，对应 [main CI 34115340100](https://github.com/lwd619783-byte/-/actions/runs/34115340100) 已核对 completed/success；旧实施验证记录保留原时点结论 |
| Phase 1A.5 — Agent Skills Consolidation | 正式 [Skill Registry / Router](agent-skills.md)、固定上游审计、项目 Domain / Local Core / minimalism Skills、只读 check 和隔离 fixture 验证；Impeccable facade / vendor、LICENSE、副本写入三项修复已获用户确认独立复审通过 | 已完成 PR / 合并与 main CI 核验；历史验证文件保留 PR 前登记节点 | **CLOSED / MERGED / MAIN CI PASS**；合并快照 `87d33595a49dc99463333ad4637b44b7e33f68a9`，本轮核对 [main CI 34125472101](https://github.com/lwd619783-byte/-/actions/runs/34125472101) 为 completed/success，headSha 与合并快照一致 |
| Phase 1B — Long-term Account & DCA Core | 复用 Phase 1A Local Core，完成 Account / Asset / Transaction / CashFlow / PositionSnapshot、DCA revision / execution、导入、确认、幂等与 Audit；按已合入合同完成 CB-1 / CB-2 / CB-3 implementation alignment | 独立终局审计通过；[PR #24](https://github.com/lwd619783-byte/-/pull/24) 以 audited HEAD `9633130b772e8571bfd130c2b35317f2da1183b3` 合入，PR CI [34170387749](https://github.com/lwd619783-byte/-/actions/runs/34170387749) 与 main CI [34173206443](https://github.com/lwd619783-byte/-/actions/runs/34173206443) 均 completed/success | **CLOSED / MERGED / MAIN CI PASS**；merge/main `2230265e727f0f2787de9e82d509f0c1d3a6230a`；[实现对齐验证](investment-dashboard-v2-phase-1b-implementation-alignment-validation.md)、[原实施与合同阻塞记录](investment-dashboard-v2-phase-1b-implementation-validation.md)、[历史修复验证](investment-dashboard-v2-phase-1b-review-fixes-validation.md)继续保留各自记录时点的结论 |
| Phase 1B Contract Clarification V1 | [合同澄清](investment-dashboard-v2-phase-1b-contract-clarification-v1.md)，审计提交 `829bae54`，PR #23 合并快照 `de77ad872` | 合同独立审计、PR CI 与 main CI 已通过；CB-1 / CB-2 / CB-3 随后由 Phase 1B implementation alignment 消费 | **CLOSED / MERGED / MAIN CI PASS**；本行只登记 contract-definition 交付，后续业务实现关闭状态见 Phase 1B 行；历史合同与实现记录均保留 |

验证失败或工具阻塞须标明原因与受影响验收项；安全改动可推送待审查，但不得称验收通过。测试通过、独立审查、合入与生产准入是不同状态，任何一步不自动授权下一步。

## 后续共用边界

- 后续研究入库、行业 / Wiki、多 Agent 成果共用统一实体、版本、审计与 **prepare-plan-confirm-commit**，不建立平行系统。
- Phase 1A 已落实 **provider identifier 精确匹配**与 **resolver 合同输入**的内部 seam；后续继续复用当前代码与[实施验证中的合同边界](investment-dashboard-v2-phase-1a-implementation-validation.md)，不擅改 `contracts/v1`。
- Phase 1B 已关闭，但只完成 Node-only Local Core；没有由此获得 Portfolio UI / Exposure、Research Bridge、可信来源 adapter、OCR、真实历史迁移或 cloud business database 的实现与准入。
- [Local-first 冻结决定](investment-dashboard-v2-contract-freeze-decisions-local-first-backup.md)覆盖旧云端业务数据库假设；[Master Plan](investment-dashboard-master-plan-2026-09.md)中的 Stage 4 顺序保留为历史基线。
- Phase 1B 后的 CURRENT 战略顺序以[2026-09-13 Development Direction](current-development-direction-2026-09-13.md)为最新增量事实源，其下层长期基线为[Financial Research OS 重基线](investment-dashboard-v2-financial-research-os-rebaseline-2026-09-11.md)；业务语义与准入仍由冻结合同、Feature Registry、Architecture 和专项审计决定。
- Stage 4.1 R2 已进入逐源实现 / 准入未闭合阶段，不再是整体 NOT_STARTED；不得因为代码或证据闭环任务已合并就自动提升生产准入。Stage 4.1 主产品线已经关闭，R2 未闭合项以后按并行数据支线管理。

## Stage 4.1 R2 与当前停止点

| 切片 | 已合入事实 | 当前数据 / 执行状态 |
| --- | --- | --- |
| Scope Freeze / R2-A | PR #26 / #27 | IMPLEMENTED / VERIFIED（离线 CORE）；不是全部历史数据准入 |
| R2-B PBC | PR #28 | IMPLEMENTED / VERIFIED；数据 PARTIAL；既有 committed evidence 继续按专项报告解释 |
| CSRC C1 / C1.1 | PR #30 / #31 | IMPLEMENTED / VERIFIED；历史缺口与 field readiness 继续按专项报告解释 |
| CSRC C2A1 / C2A2 | PR #32 / #33 | IMPLEMENTED / VERIFIED；NOT_ADMITTED；不得把 definition-compatible candidate 提升为正式 PIT observation |
| SSE / SZSE / BSE D1 | PR #34 / #35 / #36 | IMPLEMENTED / VERIFIED；三所历史数值准入继续受 definition / calendar / release provenance 约束 |
| all-A D2 | PR #37 | IMPLEMENTED / VERIFIED；原 D2 记录保持其时点状态，不由后续工作回写 |
| R2-E Integrated / all-A D3 | PR #42，merge `087c52a7962ed08c3f550d79987e0282be5607cf` | **MERGED / NOT_ADMITTED**；已补官方 calendar/denominator evidence、release/PIT evidence、exchange field-era verification、expanded candidate observations 与 D3 rerun；完整 denominator/targetCount 在官方完整交易时段枚举未证明时仍保持未知，缺少充分 release provenance 的 candidate 不进入 formal/strict-PIT observation |
| normalization / backtest / formula admission / Market Regime UI | 无因 PR #42 自动获得的正式准入 | 仍须依据当前正式 admission / blocker 状态单独冻结与验收；不得从 evidence closure 直接跳到伪评分 UI |
| cloud business database / cross-device sync | Local-first freeze | DEFERRED |

`IMPLEMENTED / VERIFIED`、`MERGED` 与 `PRODUCTION ADMITTED` 是不同状态。R2 后继工作必须围绕仍未闭合的 source / definition / calendar / release / denominator 等真实 blocker 决定是否可以进入 normalization / backtest，不因路线重基线降低门槛。

## Financial Research OS 跨域重基线

从 2026-09-11 起，后续 Stage 4 在不改变既有编号主线的前提下增加三项 cross-cutting foundation：

| Foundation | 目的 | 当前状态 | 首次主要消费阶段 |
| --- | --- | --- | --- |
| F1 Financial Semantic Registry V2 | 统一 metric / entity / unit / temporal / lineage / quality / allowed-use 语义；复用既有 Data Source Registry 与领域 Metric Registry，不建立第二套同义 Registry | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；Stage 4.1-F Macro runtime IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS | Stage 4.1 / 4.2 |
| F2 Evidence Graph V1 | 统一 Source → Artifact → Evidence → Fact → Derived Metric → Claim → Thesis → Position → Review 的引用关系；不预设 Graph DB | CONTRACT FROZEN / VERIFIED / MERGED / MAIN CI PASS；runtime：Slice 6 Industry candidate read-only subset；通用跨域准入未实施 | Stage 4.1B / 4.3 |
| F3 Investment Research Eval Suite V1 | 用 Golden Cases 验证 PIT、检索、计算、Evidence、Claim 与未来 Agent tool use | 合同已合入；Harness IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；reference 33/33 PASS，actual service 0/33、NOT_IMPLEMENTED 33/33；真实 Agent runtime NOT_IMPLEMENTED | Stage 4.1B 起持续扩展 |

本轮 [F1/F2/F3 Scope Freeze](financial-research-foundations-contract-v1.md) 新增独立版本化合同包与八类 33 个 synthetic Golden Cases，保留 `contracts/v1` 的原 schema / 权限 / Local Core runtime registry。独立审计在 remediation 后 PASS；PR #43 以 audited HEAD `204176924b23ed5c1d480203d284c0b01a28f966` 合入，PR CI run `34621319869` completed/success，merge/main `4ad9ec286a6cb73485ebf0e88a28837c0ae8b3c0`，main push CI run `34621558359` completed/success。Stage 4.1-F 经独立审计 PASS 后由 PR #45 以 audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac` 合入，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`，PR CI run `34673260311` 与 main push CI run `34673371463` 均 completed/success。Stage 4.1B Slice 3 Harness 由 PR #54 以 audited HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea` 合入，merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`，PR CI `35207107183` 与 main CI `35207381240` 均 completed/success。production/data 仍 NOT_ADMITTED；Entity Registry mapping、完整 RAW_SOURCE replay 与 R2 source blockers 仍未闭合。

依据 [2026-09-13 最新增量方向](current-development-direction-2026-09-13.md)，CURRENT 战略顺序为：

1. **Stage 4.1-G — CLOSED / MERGED / MAIN CI PASS**：独立审计 HEAD `5489e3f77e284c69d492cfccb7242e2bd9e504d8`；PR #48 CI `34820778498` completed/success；merge/main `f1b85a28dbe83a1ae7875f0b7a80d8b56e25b123`；main push CI `34821083781` completed/success。数据 / production admission 仍未提升。未闭合的单指标、Provider、历史覆盖率及 normalization/backtest 等任务转为并行数据支线；仅当满足最新方向 §1.1 的主线正确性/安全阻断条件时重新评估。
2. **Stage 4.1B — CLOSED / MERGED / MAIN CI PASS**：Slice 1 PR #50、Slice 2 PR #52、Slice 3 PR #54 均已完成独立审计、PR/main CI 与合并。最终 Slice 3 audited HEAD `f4d43844cf17005bcf46c9818474acdece6b47ea`，merge/main `93b577d599d9a1ebf187dc4388f4bcd983916850`。Research Inbox / Evidence Drawer / Auditable Chart / Product Shell / F3 Eval Harness 均已进入 main；production/data admission 未因此提升。
3. **Stage 4.2 — CLOSED：Industry Data Platform**：Slice 1–6 已合入并通过独立审计、PR CI 与 main CI。已具备 Registry/Provider、Dimensions/Snapshot、描述型派生、事实性候选、F2 引用链与 Prosperity Eligibility/ABSTAIN；正式 score/direction、Verified Claim/Thesis 仍 deferred，数据准入未提升。
4. **Stage 4.3 — External Knowledge + Research Decision**：R0 → R1 Verified Claim → R2 Thesis → R3 Investment Expression；外部知识与 OS 决策 authority 分离。
5. **Stage 4.4 — Portfolio Exposure MVP**：复用 Phase 1B Local Core，补 thesis ↔ position、macro / industry exposure、target allocation、rebalance、read model / UI。
6. **Stage 4.5 — OS Domain MCP / Controlled Tool Layer**：Creator context / Evidence / Verified Claim / Thesis / Investment Expression；prepare/preview/confirm/commit；Local-first、Auth/scope/Audit；不默认代理 Notion/Drive，旧 Bridge 保留 fallback。
7. **Stage 4.6+ — Research Agent / Artifact / Global Coverage**

明确暂缓：cloud business database 全迁移、常驻 multi-agent 集群、强制 Graph DB、所有数据 Vector 化、企业 SSO/RBAC、自动交易、未授权商业数据抓取。

## P0 展示口径与待办

- 宏观按展示条目计覆盖（重复指标未去重），来源标识与质量状态分别保留原值；没有正式模型时不输出 0—100 方向分。月 / 季度报告期不补发布时间，含糊的来源日期标为语义待核验。
- 已核对 A / H 股生成脚本：行情 `updatedAt` 是采集运行时间；不替代市场观测时间。24 小时只划分采集时间窗口，不是统一失效规则；旧值可继续作为历史快照查看。
- 缺失、非法、未来时间不算正常新鲜；汇总保留完整分母。来源标识、质量状态、价格覆盖与时间/时效分别展示；status=real 的计数仅表示质量状态，不代表来源真实性。当前未实现可靠交易日历或逐指标发布规则，故时效保守标为待核验。
- Mock 数据包时间为空；非 Mock 的 manifest.updatedAt 仅显示“数据包更新时间”，不代表行情采集时间或所有模块同步刷新。
- 本轮[验证记录及基线阻塞](p0-data-trust-display-v1-validation.md)单独列明；远端提交状态见任务交付记录。独立审查须核对最终 diff、测试、浏览器证据和最终远端 SHA，不沿用旧提交的 CI。

## 每步交付后的同步要求

以后每个正式切片在普通 push 前都要把文档同步纳入同一交付：

- `docs/feature-registry.md`：实际 capability / coverage / admission；
- 本文：当前步骤、验证、停止点、下一步；
- 战略 roadmap：只有顺序 / scope / cross-stage dependency 真实变化时更新；
- `docs/architecture.md`：只有真实实现边界 / data flow / runtime 改变时更新。

分支上不得预写 merge / main CI / production admission；合入后若 CURRENT 文档因此已知过期，下一次项目同步优先补齐。

## Stage 4.1-G — Identity / PBC Evidence / Readiness V2（2026-09-14 CLOSED）

- 原始实现基线 `ee7f2e35d967f58812706c2ee06255cc82ea4094`；审计功能提交 `aad643872fb32abe92e7b8517fc6209f0948a249`；最终独立审计 HEAD `5489e3f77e284c69d492cfccb7242e2bd9e504d8`。
- **IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；DATA / PRODUCTION NOT_ADMITTED。** PR #48 以精确 audited HEAD 合入；PR CI `34820778498` completed/success；merge/main `f1b85a28dbe83a1ae7875f0b7a80d8b56e25b123`；main push CI `34821083781` completed/success。
- 新增 exact reviewed mapping 合同与只读 current Registry 验证；真实 resolved 0 / unresolved 23，不创建实体，不修改 V1 vocabulary/permissions。
- R2-B 原 sealed archive 对账后提交一条原生 M2 YoY graph 和两份 RAW_SOURCE，positive replay PASS；full graph BLOCKED（1/894 committed），source/data/production 未提升。
- V1 发布内容与报告保留；V2 重新推导全部 23 metrics，normalization / PIT backtest / overall 各 READY 0 / BLOCKED 23。368 条 gate delta 保留原 full-scope 状态；独立 canary capability BLOCKED→PASS。all-A D3/CSRC 不变。
- 专项 27 Node + 14 Python、原 semantic 37、contracts 106+78、应用 725、build 与 validators 本地通过；PR/main Hosted CI 完整工作流均 completed/success。
- Stage G 已关闭；该段保留 2026-09-14 时点“主线进入 Stage 4.1B”的历史事实；CURRENT 主线见本文顶部，Stage 4.2 已关闭并进入 Stage 4.3。未闭合单指标数据任务继续作为并行数据支线，不重新成为产品主线 blocker，除非满足最新方向 §1.1 的真实正确性/安全阻断条件。

## Stage 4.1-F — Semantic Runtime / Readiness（2026-09-12 已合入的 V1 发布事实）

**IMPLEMENTED / VERIFIED / MERGED / MAIN CI PASS；PRODUCTION/DATA NOT_ADMITTED。**

- 28 个 PBC F1 definition bindings、只读 Macro Semantic API、native vintage 截止前唯一 revision 选择与 owner adapter 已合入；EntityRef 仅为请求 claim，正式 Registry-backed mapping 尚不可用。审计 remediation 已去除 metricId 自动生成 EntityRef，entity binding=null，ENTITY_REGISTRY_UNRESOLVED 始终阻断，不创建实体。
- 23 metric normalization / PIT backtest readiness：分别按冻结 15/16 gate 集计算，各 READY 0 / BLOCKED 23；overall=BOTH_READY，progress 独立为 PARTIAL 9 / NOT_PROVEN 14。PBC PARTIAL 与 CSRC/all-A NOT_ADMITTED 保留；未知分母仍 null。
- PBC committed ledger 894 行及 retained official excerpt 诊断重放可复现；完整 raw/catalog/extraction graph 未 committed，正向 RAW_SOURCE replay 仍有真实 evidence blocker。
- PR/main CI workflow 已加入 bindings validate、semantic-runtime tests、readiness validate 三项直接门禁；PR #45 CI `34673260311` 与 main push CI `34673371463` 均 completed/success。
- PR #45 audited HEAD `1c31efcdeb182c1c43254ad03dde0162371de1ac`，merge/main `fe0a0a3fe3aa0b2d084d2b41713974bd3303f07e`。当前停止点：Stage 4.1-F 已关闭并合入；下一业务任务仍须服从 readiness 报告中的真实 blocker，不自动进入 normalization/backtest。
- 验证与具体限制：[Stage 4.1-F design / validation](market-regime/semantic-runtime-readiness-v1.md)。
