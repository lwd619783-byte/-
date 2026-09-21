# Preview 安全切换与公开真实资料验收

## CURRENT：Contract + Delta 最终收口

2026-09-21：用户将本 Slice 的真实验收收口到首轮 CREATE/import/review 事实；不以接受不合用文章或制造 UPDATE 作为通过条件。本节覆盖下方 PREPARE 时点的待办状态，但不回写旧测试证据。当前功能分支保持 `codex/stage-4-3-slice-2-5-knowledge-ingestion-v1`，R1/R2/R3 的独立复审基线 `47612e1534e855561467043447e0ff6aa02b9f90` 为用户确认 PASS；其后的验收辅助脚本和本次 Markdown 差异仍待最终独立审计。

### 本轮 Delta 与不变量

- 共用 `KnowledgeDocument` 改用精确版本 `react-markdown@10.1.0` 与 `remark-gfm@4.0.1`，覆盖标题、段落、粗斜体、列表、引用、链接、代码和 GFM table；审核候选、Wiki 当前文章及历史正文使用同一阅读组件。长表格局部横向滚动，不撑宽整页。
- `skipHtml` 禁用原始 HTML；不接 rehype-raw、MDX、脚本或组件执行。链接保留依赖默认危险协议过滤并隔离新窗口；图片只呈现替代文字，不发起嵌入资源请求。存储 Markdown 原字节、Contribution schema、Wiki authority、审核权限和 UPDATE/history/revoke 行为均不变。
- 不改全站导航、首页、三套主题或数据模型；不开始 Frontend V2，不新增搜索/Agent/写 MCP。新增依赖未改变已有包版本；安装审计列出的既有工具链告警另存本地，不自动升级依赖或降低门禁。
- 专用验收改用 Chrome 并按真实窗口尺寸显示，保留原 profile/origin/batch；本机恢复适配属于 gitignored 操作辅助，不接管个人 Chrome 或复制其登录态。
- 最终门禁发现原数据审计把两份未改动的生成校验器内 `ajv-formats` 时区偏移默认值误报为4项财务缺失转零。仅增加精确生成文件路径 + LF-normalized SHA-256 + 时区 capture 表达式联合识别，任何生成字节变化均失去该例外；不跳过整个文件，不改变业务缺失值规则或合同。57项审计测试包含原字节/换行兼容、同一行插入财务回退及复制到其他路径的拒绝反例；修复后数据审计0 errors / 36保留warnings。该门禁修正也纳入本轮独立审计差异。

### 首轮真实事实（2026-09-21T12:24:30.904Z）

| 状态 | 结论及证据边界 |
| --- | --- |
| ChatGPT actual MCP first-round research | PASS，依据用户本轮真实使用确认；不宣称 Codex 独立观察了全部八工具 |
| real 8-source CREATE generation | PASS，收到用户保存的 `round-1-create.json` 并核验实际内容 |
| formal contribution importer / pending review | PASS；持久化 Bundle 与原文件 canonical 相同，重新运行 `validateContribution` / `validateIngestion` 通过；正式 UI 待审核全文可打开 |
| source / extraction / atom / reload | 8 sourceRefs、8 extractions、55 atoms、3 conflicts、1 CREATE、6章；313次引用对应32个独立来源定位；10原件 SHA 和 reload 一致 |
| user acceptance / WikiReview | **PENDING**；WikiEntry / WikiRevision / WikiReview / disposition 均为0，未替本人接受或拒绝 |
| PUBLIC_REAL_SOURCE_E2E | PARTIAL；完成真实读取/生成/导入，未声称真实已审核双版本闭环 |
| real +2 source UPDATE / full version-history | **DEFERRED / NOT_ATTEMPTED**，转 Knowledge V2；保留现有代码层测试 |
| accepted UPDATE 后 ChatGPT revoke-denial | **DEFERRED / NOT_ATTEMPTED**，转 Knowledge V2；SDK synthetic 与真实 ChatGPT 结果分列 |
| PRIVATE_DATA_E2E | NOT_ATTEMPTED |
| Hosted CI / PR / merge / Production | NOT_RUN / NOT_CREATED / NOT_MERGED / NOT_DEPLOYED |

绑定真实 run `optical-public-20260921`、batch `batch-cc5d6826-3e8c-42c5-924c-342d4255712e`；输入 SHA-256 `ba26fcd11208aa8ce929a10e2d826bbb854699b58e3a5a6703f547354e62e167`。原件、贡献全文和只读观测保留本机专用目录，不提交公开仓库。不修改该 run 的 origin 来冒充新 runtime 的真实验收。

### 安全复核与最终构建绑定

本次 `2026-09-21T12:26:10.257Z` 至 `12:26:31.494Z` 只读复核 PASS：原固定 Preview 仍 READY，新 owner 200、旧 owner/匿名 owner/MCP 401，两 discovery 的 issuer/resource/S256/scope 正确；8个旧 host/alias 的22条路径均无凭据302至 Vercel保护。48字节独立密钥轮换和旧**未过期** token 拒绝/独立签名比较保留原始 `05:42:53Z` / `05:48:10Z` 证据，不以当前已过期 token 重测冒充。CLI 控制面凭据403及 connector project schema限制使当前全局保护字段未重新读到；部署绑定通过 connector 核对，指定入口保护通过公网实测。

真实首轮仍绑定 runtime `8aa28245556163f67b4beeb9233e278aa29da5bc` / deployment `dpl_6j9pLGnctUG1w3eaZtT56qw5Vc2y` / `https://investment-research-dashboard-oy854gw7y-lkdmkl.vercel.app`。该 origin 保留待审核原始环境；新 Markdown 构建不继承这份真实验收结果，也不要求用户重新 OAuth。

本轮普通 push 产生的最终代码 Preview 另按 exact HEAD/deployment/origin 核对，默认保持平台保护，不为新的合成验证扩大公网例外。最终 SHA、每项执行时间/exit code、构建及 browser/smoke 绑定写入 gitignored `data-cache/slice25-closeout/` 的最终矩阵，交付回复报告实际结果；历史1159/111/17等数字不作为本轮通过数。

### 最终门禁集与证据规则

代码收口预检已完成68项 focused tests、build、151项知识浏览器检查；这些预检不冒充最终 HEAD 结果。最终提交后重新执行下面实际仓库入口，结果只在成功退出并绑定该 HEAD 后计入最终矩阵：

- `npm test`（含新增8项 Markdown测试、原 Wiki/Contribution全部正式 Vitest）；`npm run test:knowledge`、`npm run test:bridge`。
- `npm run contracts:validate`、`npm run test:contracts`、`npm run test:local-core`、`npm run build`。
- `npm run env:check`、`npm run research:eval:check`、`npm run test:research-eval`、`npm run test:discovery`、`npm run ui:audit`、`npm run data:audit`。
- `npm run test:bridge:browser`，以及既有 `node scripts/knowledge-ingestion-browser-check.mjs` / `node scripts/wiki-browser-check.mjs`；均隔离 synthetic fixture，与本人验收 profile 分离。Markdown浏览器测试含真实390px表格滚动、CREATE/UPDATE review、当前与历史正文、恶意HTML不执行、三主题四尺寸回归。
- 最终 Preview 由 authenticated connector 核对部署及受保护页面/资源；如平台访问限制不能完成某项远程验证，记录实际限制，不借旧部署 smoke 升级该项状态。

后续 **Knowledge V2**：新主题初始化、公开资料补全、人读/机器读分离、结构化证据、增量 Wiki 更新，以及上述延期的真实 UPDATE/history/revoke-denial。**Frontend V2** 另开新分支实施，不属于本 Slice。当前仅普通 commit/push，停止等待最终独立审计，不建 PR、不 merge、不改 main、不部署 Production。

## 历史记录：PREPARE

2026-09-21 CURRENT：PREPARE 已完成，停在 HUMAN_RESEARCH / 用户 OAuth 与真实研究。沿用功能分支 `codex/stage-4-3-slice-2-5-knowledge-ingestion-v1` 与审计代码 `47612e1534e855561467043447e0ff6aa02b9f90`；用户交付的复审结论为 PASS，本轮不重做 R1/R2/R3，也不为新增脚本自授独立审查通过。

## 安全与数据边界

- 核实 Vercel 项目关联、授权账号、Git 仓库和分支后，仅更新该分支 Preview 的 owner/signing 两项 sensitive 环境变量，分别使用 48 随机字节；不改 Production、其他分支变量或 private Blob 关联。
- owner 存入 Windows Credential Manager；`scripts/bridge-preview-credential.ps1` 提供进程内取用及用户本机遮罩显示。密钥不进入命令行参数、报告、仓库或浏览器持久化存储。
- 6 个旧部署及分支 alias 已恢复平台保护：21 次无 Cookie、无 Bearer、无 bypass 的 GET 检查全部 302 到 Vercel。旧运行时的隔离依据是入口保护，不声称旧进程中的签名或已读取资料被追溯撤回。
- `scripts/research-bridge-cutover-check.mjs` 对最终部署检查新/旧 owner、新签名接受、旧未过期 token 拒绝、独立 HMAC 比较和匿名拒绝。配置变更版本另存本地证据，不能仅用 issuer 改变导致的 401 证明签名轮换。
- 十份公开一手资料分成 8 + 2：6 PDF、3 TXT、1 MD，来源和原始网页、获取时间、来源日期及不确定性、字节数和 SHA-256 均保存在本机 gitignored 验收目录。网页文本快照不冒充原始 PDF，获取时间不冒充发布时间。

## 可恢复执行入口

`scripts/research-bridge-public-acceptance.mjs` 读取本机 run manifest，并将 runId / exact origin / deploymentId / runtimeSha 与专用持久 Edge profile 绑定。通过真实 UI 导入、发送、撤销和导入候选，只读检查 IndexedDB 原件与 Wiki authority；不写浏览器存储伪造操作，不接受正式文章。

可用动作：`prepare-sources`（本地公开原件预检）、`prepare`、`inspect`、`import`、`revoke`、`stage-update`、`stage-history`。`--keep-open` 保留用户审核窗口，退出后用同一 manifest 恢复；没有后台收件监听。入口由 Codex 运行，用户无需配置环境或执行命令。

贡献包只读取专用 inbox 的 JSON，复用原 `validateContribution` 核验 identity/digest/locator/引文/时间/完整章节，并核对本 run 的 stage 资料范围、CREATE / UPDATE 和基线。导入只生成待审核建议，正式文章由用户本人接受。导入后记录审查状态，不能把测试工具调用或合成文章当成真实 ChatGPT 研究。

阶段为 PREPARE → HUMAN_RESEARCH → VERIFY_AND_REPORT。首轮人工接受后撤销原 stage；同批选择十份资料和已审核文章创建新 stage，要求对同一 wikiId 的完整 UPDATE。第二次接受后再显式发送最新文章及历史，供 ChatGPT 验证完整双版本；最后撤销本 run，SDK 与 ChatGPT 拒读分列。TTL 24 小时为逻辑有效期；token 一小时无 refresh；stages 键扫描上限 500，均保持原规则。

## 当前证据与待完成

- 本轮本地 `env:check` 无阻断；环境警告保留。`test:knowledge`、`test:bridge`（11/11）、`test:bridge:browser` 通过。
- 最终验收 runtime SHA `8aa28245556163f67b4beeb9233e278aa29da5bc`，deployment `dpl_6j9pLGnctUG1w3eaZtT56qw5Vc2y`，origin `https://investment-research-dashboard-oy854gw7y-lkdmkl.vercel.app`。安全负向 6/6、真实 private Blob / OAuth / 官方 SDK 八工具 synthetic smoke 17/17；该合成批次已撤销。此次结果均为本轮重新执行，精确 testedAt 与原始无凭据记录保留本地。
- 公开原件真实 UI：10/10 已保存/解析/SHA/locator/reload 通过（6 PDF 共 55 页，4 文本共 146 行）；首轮只选择 8 份并通过 UI 发布，其余 2 份未发送；正式 Wiki 仍为空。专用持久 profile 与 manifest 已绑定最终 origin，可恢复且不重复导入/发送。
- `build`（含 TypeScript / Local Core / bundle gate）PASS；本轮未改 runtime / contract，未重复全量 Vitest、旧 Wiki 全主题矩阵或 F3。stages metadata 键数 52/500，无扫描错误、无物理删除。
- PUBLIC_REAL_SOURCE_E2E：PARTIAL；CHATGPT_ACTUAL_TOOL_CALLS / HUMAN_REVIEW_CREATE / HUMAN_REVIEW_UPDATE：PENDING；PRIVATE_DATA_E2E：NOT_ATTEMPTED。
- PR / MERGE / PRODUCTION：NOT_CREATED / NOT_MERGED / NOT_DEPLOYED；本轮未请求 Hosted CI。普通 commit/push 后等待新增差异独立复审。

官方核对：[Vercel 部署例外](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions)、[Vercel 环境变量](https://vercel.com/docs/environment-variables)、[OpenAI 连接与测试](https://developers.openai.com/plugins/deploy/connect-chatgpt)、[OpenAI OAuth](https://developers.openai.com/plugins/build/auth)。已有连接优先管理/更新/重授权，精确回调保持当前配置，只有管理页实际显示变化才更新白名单。

最终文档提交可以晚于验收 runtime SHA；随后自动生成的 Preview 保持平台保护，不切换本次验收 origin、不要求重复授权。旧部署 raw hosts 继续受保护；分支 alias 随文档部署移动，交付前再核对其保护状态。
