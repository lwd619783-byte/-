# Phase 1A.5 — Agent Skills Consolidation 验证记录

状态：**IMPLEMENTED / PENDING INDEPENDENT REVIEW**。未创建 PR，未合并 main，未进入 Phase 1B。本记录说明本分支的实现与本机验证，不代表独立远端审查或该分支 CI 通过。

## 基线与范围

- actual base：`41b3caa5e063805ec0ca42efc9c74ea17491ffc4`。
- branch：`chore/phase-1a5-agent-skills-consolidation`。
- 开始时 repository / origin 与任务一致，工作区干净；重新 fetch 后 origin/main 与指定快照相同，从该提交创建分支，未 reset / stash / clean / 覆盖已有 worktree。
- Phase 1A 的合并快照已通过 [main CI 34115340100](https://github.com/lwd619783-byte/-/actions/runs/34115340100)，headSha 与 actual base 相同、completed/success。历史 Phase 1A 实施文档保留原时点结论，仅更新当前执行索引。
- 本轮只改 Router、Skills、Registry / lock、setup / runtime wrapper / health / fixtures、README 和当前执行状态。没有新增 npm dependency 或更改 package-lock。

最终本地 / 远端 HEAD 由普通 push 后核验并在任务交付消息列明，不在本提交文档中写自引用 SHA。

## 交付与路由

保留 UI workflow、Taste 和 Impeccable。新增 tracked Domain workflow、Local Core workflow 和 conservative / lite minimalism。外部 managed set 恰为 Taste、Impeccable、Archify、Diagram Design，具体 upstream、immutable commit、license、原始行为和项目约束见 [Registry](agent-skills.md)。

Ponytail 审计 `0a4dd63ad4541f4f655c4108a295916f3c1d8fda` / v4.9.0，拒绝原始直接安装：隐式调用开关不能消除正文的持续生效 / 默认 full 语义；项目自有 minimalism 不保留这些行为。Prime Agent / OpenMAIC / Semantica / awesome-gpt-image-2 等后续项目没有引入。

| 代表场景 | 静态 dry-run 选择 | 排除 / 保障 | 结果 |
| --- | --- | --- | --- |
| A：现有 Dashboard 页面重构 | UI workflow，按需 Taste / Impeccable | UI-only 不读 Domain / Local Core | MATCH |
| B：SQLite migration / transaction 审计 | Local Core workflow | 不读 Taste / Diagram Design | MATCH |
| C：新增 A 股 Provider | Domain workflow | discovery != production admission | MATCH |
| D：Local Core → Repository → Audit 工程图 | Archify | 代码证据优先，不选 Diagram Design | MATCH |
| E：AI CAPEX → 光通信 → 存储 → 上游设备投资逻辑图 | Diagram Design | 研究表达，不选 Archify | MATCH |
| F：重复 helper 最小安全重构 | 项目 minimalism | 禁止削弱 contracts / Audit / PIT / tests 等全部 correctness safeguards | MATCH |
| G：文案 / spacing 小改 | 不要求外部 Skill | 不额外加载整套 workflow | MATCH |

这是对 root Router、入口 description、条件引用及 Registry 的逐场景静态核对，没有创建业务功能、图表、模型触发测试框架或新 Agent runtime；**未声称真实 Codex 自动触发 E2E 已测试**。

## 实际验证命令与退出码

| 命令 | 退出码 | 实际结果 |
| --- | ---: | --- |
| `npm run agent:skills:setup` 初次 | 1 | 临时 fetch 失败；未覆盖已有 copy，也未创建未通过完整校验的新 Skill |
| `npm run agent:skills:setup` 修复后重试 | 0 | 临时网络错误增加最多三次尝试；Taste / Impeccable 原样 SKIP，Archify 76 files、Diagram Design 218 files 按 commit / digest 安装，无上游代码执行 |
| `npm run agent:skills:check` | 0 | 4 project + 4 external，全部 PASS；源文件白名单与 digest、engine、局部 scope 通过 |
| `npm run env:check` | 0 | 46 PASS / 11 WARN / 0 FAIL / 4 SKIP；含一次 gh.auth 状态不可用 |
| `npm run --silent env:check:json` | 0 | JSON 可解析；47 PASS / 10 WARN / 0 FAIL / 4 SKIP；gh.auth 为 PASS |
| `gh auth status`（丢弃身份输出，仅读退出码） | 0 | 对上项临时登录状态 warning 单独复核通过 |
| `npx --no-install vitest run scripts/setup-codex-skills.test.mjs` | 0 | 14/14 fixture tests；覆盖只读检查、下载 hash 拒绝、有限重试、no-overwrite、目录链接、并发占用、未知文件、CRLF、runtime 边界 |
| `npm test` | 1 | 101 suites / 1,651 tests 通过；2 个旧 nested worktree 的 Node test 被默认 Vitest glob 误扫描，报 No test suite found |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前分支隔离验证：39 suites / 587 tests；未修改默认 npm test / Vitest 配置 |
| `npm run data:audit` | 0 | 301 scanned，29 registry，errors=0，P0=0，warnings=24（既有） |
| `npm run build` | 0 | 前端与 Local Core typecheck、原 bundle budget 均通过；2,291 graph modules / 1 chunk / 0 forbidden |
| `git diff --check` | 0 | 无 whitespace error；Git 的 LF→CRLF 提示另列，不当作失败或隐藏 |
| `python -X utf8 <skill-creator>/scripts/quick_validate.py <project-skill>`，四个项目 Skill 分别执行 | 0（各项） | 四个 frontmatter / naming / scaffold 校验通过；Windows 默认 GBK 的首次调用失败，指定 UTF-8 后通过，未改全局 Python 设置 |
| `node scripts/run-codex-skill.mjs archify doctor` | 0 | schema / renderers / references / required runtime 文件齐全；存在可选 runtime 不等于已启动 |
| `node scripts/run-codex-skill.mjs archify check-update` | 0 | `silent` / `disabled`，未进行更新查询或缓存动作 |
| `node scripts/run-codex-skill.mjs impeccable engine-probe` | 0 | 已有局部 engine `0.1.0` 可执行；未通过自动下载 launcher |

原始 npm test 的失败文件均为旧 worktree 下的 `scripts/tests/company-guidance-expectations.test.mjs`，分别属于 `stage-4-1-r2` / `v2-phase1`，与 Phase 1A 历史验证记录相同。没有删除、移动或修改这两个 worktree，也未通过降级默认测试来隐藏失败。

data:audit 只引起历史 `docs/data-audit-v1.md` 的执行时间、扫描数量和旧 finding 行号变化；已核对并恢复其原始 bytes，本轮结果只记本文件。真实 generated 数据未刷新。

## Warning 与限制

- 新增 Skill health 项全部 PASS；开发时未提交状态会使既有 git.worktree check 报 WARN，不是业务失败。
- 修改前 health 是 40 PASS / 9 WARN / 0 FAIL / 4 SKIP。既有 warnings 涉及 Node / Python / Git 多安装路径、4 个未固定 Python dependency、pip check、ignore 诊断、旧 metadata、公告 partial 和 legacy artifacts；本轮未修改环境或真实数据来消除它们。
- 文本 / JSON 检查时间不同，gh.auth 有一次临时差异，后续单独复核退出 0；不把两次检查写成完全相同结果。
- 构建保留 Vite >500 kB chunk warning；实际 initial JS 2,332,952 bytes、gzip 533,113 bytes，原预算通过。未升级依赖或调整 warning 阈值。
- 新 setup 初次网络失败已通过有限重试处理；内容 mismatch、404、禁止 host 不重试。setup 仍依赖显式下载时的 GitHub 可用性；check 和 CI fixtures 离线。
- 提交前重新 fetch 有一次 TLS EOF 临时失败，保持 TLS 校验的普通重试通过；main 仍与 actual base 相同，目标远端功能分支尚不存在。
- Archify / Diagram 模板含远端字体；默认项目命令禁用 updater / capture / preview，离线图表仍需按 Registry 使用本地字体 fallback。没有进行图表视觉验收或自动触发 E2E，本任务也不要求修改 UI。
- Windows 上 skill validator 默认 GBK 与 UTF-8 中文不兼容，使用进程参数解决。未改全局 Codex、Python 或 Git 配置。
- 本次 engine 实测平台为 Windows x64；Linux / macOS 只登记 release digest，未执行平台运行验证。Windows ARM64 未登记支持。
- 上游审计工作文件已普通清理；只读 Git pack 缓存的强制递归清理被工具审批策略拒绝，剩余目录在 ignored `data-cache`，未提交。原有 nested worktree 保持不动。

## 终局综合自审

| 关注点 | 最终判断 |
| --- | --- |
| 两个 Skill 无条件竞争普通 coding task？ | Router 先选交付物 / 改动层；普通 coding 不要求外部 Skill，minimalism 仅明确任务；图表二选一。模型仍需遵守 Router，不能把静态检查说成概率为零的触发保证 |
| 外部 Skill 覆盖 hard invariants？ | root / project workflow 明确优先；图是派生解释，style 只限图表，minimalism 不删 correctness safeguards |
| 全局安装 / 用户配置副作用？ | setup 只有 repo-local allowlisted copy；不运行 installer、不注册 Agent / plugin、不改全局 config；拒绝 symlink / junction |
| hooks / MCP / updater / background？ | 新安装不执行任何上游代码；运行入口禁用更新 / telemetry，排除 preview / capture / live / init / hooks；doctor 仅核对文件存在 |
| supply-chain / immutable pin？ | 四个 external commit 固定，351 个文本文件逐项 SHA-256；Impeccable engine 另外按平台 pin bytes，不用动态 Skill bundle |
| 按任务最小加载？ | root 单表 + 每个短入口 + 条件引用；不读全部 Registry / V2 / Provider docs，不新增分类器、外部服务或 Agent runtime；metadata 的少量目录成本仍存在 |
| Ponytail 方式与原因？ | 自有 conservative / lite Skill；原版 ANY coding / 跨响应持续 / 默认 full 不适合任务范围，未用改正文 hack 伪装原版 |
| Router 是否更简单？ | 入口覆盖扩大但选择流程仍是一张表；setup/check/health 共享一份 lock 和检查逻辑，没有两套重复 setup 或复杂编排框架 |
| gitignore / tracked / docs？ | 仅四个外部目录 ignored；四个项目 Skill tracked；README、AGENTS、Registry、执行索引和 package 入口一致，历史文件不回写 |
| CI / 数据 / Phase 1B？ | `.github`、package-lock、contracts/v1、local-core、src、public 无 diff；无业务 migration、Provider refresh、真实 DB / 用户数据、PIT / Entity / Audit / transaction 语义变化；Phase 1B NOT STARTED |

正常 commit / push 功能分支后，停止等待独立远端终局审查；PASS 不授权 PR、merge、production admission 或 Phase 1B。
