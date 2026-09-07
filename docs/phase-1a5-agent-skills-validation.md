# Phase 1A.5 — Agent Skills Consolidation 验证记录

PR 前登记状态：**INDEPENDENT REVIEW PASS / READY FOR PR**。用户已确认 `e0bb08808d309b4c0eb8384bc03427abc810fd1c` 的独立复审通过，并授权创建 PR、等待 PR CI 全部通过后合并、核验 main SHA 和 main CI。此次登记仅修改状态文档，不改变已审查实现。

独立复审通过不等于 PR CI 通过；合并不等于 main CI 通过。PR / Actions 中的精确 SHA 与实际结果决定后续状态，只有达到 **CLOSED / MERGED / MAIN CI PASS** 才能关闭 Phase 1A.5。Phase 1A 保持 CLOSED / MERGED / MAIN CI PASS，Phase 1B 仍为 NOT STARTED；本次交付不开展 Phase 1B。

## R1：独立远端审查三项修复 · 2026-09-07

修复起点为已审查 HEAD `21593651c2c8fd3e22da292784828dfa9624dc6f`，继续使用 `chore/phase-1a5-agent-skills-consolidation`。开始时工作区干净，fetch 成功，本地 / 远端功能分支相同，origin/main 仍为 `41b3caa5e063805ec0ca42efc9c74ea17491ffc4`。此前审查状态为 **IMPLEMENTED / INDEPENDENT REVIEW CHANGES REQUIRED**；本轮仅处理下面三项，不改历史或进入下一阶段。

| 审查发现 | 修复与证据 |
| --- | --- |
| Impeccable broad frontmatter 与 UI coordinator 竞争发现入口 | 新增 tracked `investment-dashboard-impeccable-workflow`，description 明确仅在 UI workflow 已选中时用于重大 UI 收尾，排除普通 copy / spacing / 小 CSS。原版移至 `.agents/vendor/impeccable`；root → UI workflow → facade → pinned implementation。旧 `.agents/skills/impeccable` 已不存在，残留该目录时 check/setup/runtime 均拒绝 |
| Taste / Impeccable local copy 缺少 LICENSE | 从原有 immutable commits 取得原始 LICENSE bytes，通过既有 extraSources 纳入 lock。Taste 1,065 bytes / SHA-256 `4575a543ab88dad12ccea7d97e563d0bce5b448b06072e65d3264497dad326df`；Impeccable 10,766 bytes / `02bb8c3b4e70190e3986c0404ad2fd8d639b4f534252d82379cc1b502b6d1812`。local copy 实际存在且 digest 通过 |
| Archify examples 默认写回 immutable copy | 从 wrapper allowlist 删除 examples；实际 CLI 退出 1，调用前后 Archify / Impeccable copy 的文件 digest 和 mtime 未变。其他安全入口保持原集合，不放开 preview / visual-check / brands capture / demo / migrate / updater |

迁移不是自动修复或 force overwrite：先用 `2159365` 的旧 lock 校验既有 copy / engine 和未知文件，核对源与不存在的目标都在本项目，然后普通 Move-Item 移动 Impeccable，仅 exclusive create 两份原始 LICENSE。迁移前后 Taste 原有 1 文件、Impeccable 原有 57 文件（56 源文件 + Windows engine）逐 byte 相同。四个 upstream commits、既有 references / engine digest 均未变化；当前共有 353 个锁定文本文件。新 checkout 直接使用同一 setup 下载完整清单；旧 copy 缺失许可证仍 fail closed，不隐式修补。

### R1 实际验证

| 命令 / 检查 | 退出码 | 实际结果 |
| --- | ---: | --- |
| `npm run agent:skills:setup` | 0 | 明确迁移与补齐许可证后，四个正确 external copy 全部 SKIP；5 个 project + 4 个 external 全部 PASS |
| `npm run agent:skills:check` | 0 | 9 项全部 PASS，含 vendor、LICENSE、原 engine 和禁止旧发现入口 |
| `npm run env:check` | 0 | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `npm run --silent env:check:json` | 0 | JSON 可解析；48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `npx --no-install vitest run scripts/setup-codex-skills.test.mjs` | 0 | 24/24；增加 facade Git tracking / discovery / 窄 description、vendor 安装、extraSources LICENSE、digest engine、禁止命令、缺失 / 漂移 / 未知文件 / 链接 / 旧入口拒绝 |
| `npm test` | 1 | 101 suites / 1,661 tests 通过；仅两个旧 ignored nested worktree 的 company-guidance-expectations Node test 被默认 Vitest 扫描，仍报 No test suite found |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前分支 39 suites / 597 tests 通过；未修改默认测试配置或已有 nested worktree |
| `npm run data:audit` | 0 | 301 scanned / 29 registry / errors=0 / P0=0 / warnings=24；历史报告仅产生时间、扫描量和旧行号差异，核对后恢复原始 bytes；真实数据未刷新 |
| `npm run build` | 0 | typecheck / 原 bundle budget 通过；2,291 graph modules / 1 chunk / 0 forbidden；既有 Vite 大 chunk warning 保留 |
| `git diff --check` 与 `git diff --cached --check` | 0 | 无 whitespace errors；LF→CRLF 提示不作为失败 |
| `python -X utf8 <skill-creator>/scripts/quick_validate.py .agents/skills/investment-dashboard-impeccable-workflow` | 0 | 新 facade 校验通过 |
| `python -X utf8 <skill-creator>/scripts/quick_validate.py .agents/skills/investment-dashboard-ui-workflow` | 0 | 修改后的 coordinator 校验通过 |
| `node scripts/run-codex-skill.mjs archify doctor` | 0 | runtime 文件齐全；未启动所列可选服务 |
| `node scripts/run-codex-skill.mjs archify check-update` | 0 | silent / disabled |
| `node scripts/run-codex-skill.mjs archify examples` | 1（预期） | wrapper 拒绝；未运行上游 examples |
| `node scripts/run-codex-skill.mjs impeccable engine-probe` | 0 | vendor Windows x64 digest-verified engine 0.1.0 |
| `node scripts/run-codex-skill.mjs impeccable context` | 0 | facade 的实际 context 入口可运行，输出引用 vendor 路径，无缺失 runtime；随后只读 check 仍为 9 PASS |
| `node scripts/run-codex-skill.mjs impeccable <init / hooks / mcp / plugin / live / update / install / config>`，分别执行 | 各 1（预期） | wrapper 全部拒绝；没有注册或启动对应能力 |
| vendor runtime path / 原始副本 snapshot 对比 | 0 | 命令仅指向 `.agents/vendor/impeccable/scripts/bin/windows-x64/impeccable.exe`；旧发现目录不存在；拒绝命令前后副本 digest / mtime 相同 |

### R1 静态路由回归

| 场景 | 最终路由 | 结果 |
| --- | --- | --- |
| 重大 Dashboard redesign | project UI workflow → 可选 Taste / project Impeccable facade → pinned vendor | MATCH |
| 小 copy / spacing | 原任务直接处理，不自动进入 Impeccable | MATCH |
| SQLite / migration | Local Core workflow | MATCH |
| Provider / PIT | Domain workflow，保留 production admission 边界 | MATCH |
| 工程架构图 | Archify | MATCH |
| 研究图 | Diagram Design | MATCH |
| 明确最小安全重构 | project minimalism | MATCH |

上表逐项核对 root Router、各 project Skill 入口和 Registry；fixture 另检查 facade 已进入 Git index 且 description 包含 coordinator 前置与小改排除。没有搭建真实模型自动触发 E2E，也不保证客户端缓存已即时刷新；如旧 metadata 仍显示，需要重新发现 / reload，不恢复原版发现入口。

R1 的 Skill 项均 PASS，没有新增 Skill warning。10 个环境 warnings 包括既有多安装路径、未固定 Python 依赖、pip check、ignore 诊断、旧 metadata、公告 partial、legacy artifacts，以及验证时尚未提交的工作区。未更改环境、默认 CI / tests、warning 阈值或业务数据以消除它们。engine 仅实测 Windows x64，其他平台未运行。仅新增一个共享路径函数让 setup/check/runtime/health 共用 vendor 位置，没有重新安排其他外部 Skills，没有新增 npm dependency 或全局配置写入。

综合自审以这三项修复为范围：保留 supply-chain pin 和 upstream bytes，许可证随副本保存，facade 不增加与 coordinator 并列的普通 UI 路由，runtime 无 PATH/home/launcher fallback，examples 不再执行。本轮未改 contracts/v1、Local Core migration / Entity / Audit / transaction / PIT / Provider / admission、业务页面、真实 generated 数据、package-lock 或 `.github`；未运行 hooks / MCP / plugin / background service。

## 初次实现记录（2159365 的历史证据）

以下保留初次实现的测试与自审原记录。其“八个入口”“四个项目 Skill”、Impeccable 直接发现路径及原自审判断仅代表当时实现，独立审查发现的不足由上方 R1 修复记录纠正；不能继续作为当前已通过终局审查的依据。

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
