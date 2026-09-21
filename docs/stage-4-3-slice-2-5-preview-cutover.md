# Preview 安全切换与公开真实资料验收

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
