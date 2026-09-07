# Agent Skills Registry

Phase 1A.5 正式项目 Registry。root `AGENTS.md` 负责路由与 hard invariants；这里记录选择、供应链、使用边界和升级流程，不是业务事实源或第二套设计治理。日常任务只读对应路由 / 使用边界，不加载整份审计或所有 Skill。

## 1. 按任务加载

Codex 先发现 name / description，命中后才读完整 `SKILL.md`，引用继续按需读取。项目用 root Router 作语义选择，不新增关键词分类器或 Agent runtime。指令路由不是操作系统权限沙箱，静态验证不能证明每次模型自动选择都正确。[官方 Skill 文档](https://learn.chatgpt.com/docs/build-skills)

| 场景 / 交付物 | 主要入口 | 可选补充与排除 |
| --- | --- | --- |
| A：重构现有 Dashboard 页面 | `investment-dashboard-ui-workflow` | 重大 redesign 才 Taste；收尾可 Impeccable；纯 UI 不读 Domain / Local Core |
| B：审计 SQLite migration 和 transaction | `investment-dashboard-local-core-workflow` | 不读 Taste / Diagram Design；合同语义也受影响才补 Domain |
| C：新增 A 股 Provider | `investment-dashboard-domain-workflow` | discovery != production admission；不安装 public-apis |
| D：画 Local Core → Repository → Audit 数据流架构 | `archify` | 读取真实目标代码；不选 Diagram Design，不因画图自动加载持久化实现 workflow |
| E：画 AI CAPEX → 光通信 → 存储 → 上游设备投资逻辑图 | `diagram-design` | 区分研究事实 / 假设、日期和来源；不选 Archify |
| F：重复 helper 最小安全重构 | `investment-dashboard-code-minimalism` | conservative / lite；不删除 contracts / Audit / PIT / tests 保障 |
| G：小幅文案或 spacing | 不要求外部 Skill | 不因可用而额外设计、审计或画图 |

工程真实性 / 系统架构选 Archify；研究表达 / 编辑型图表选 Diagram Design。状态机、workflow、Entity、Audit 等共同词按交付物和实际改动层判断，默认不同时运行两个图表 Skill。只有任务确实跨层才补读另一个项目 workflow。普通 coding task 不无条件触发 minimalism 或外部 Skill。

Skill 是 workflow。项目 hard invariants、冻结合同、数据真实性、PIT、provenance、append-only 和权限优先于外部建议；当前明确任务优先于非 hard Skill 建议。Skill recommendation 不自动授权 dependency、framework、hook、MCP、外部服务、用户配置写入或生产准入。

## 2. Tracked project Skills

以下 `.agents/skills/<name>/SKILL.md` 由 Git 跟踪，版本就是本仓库提交；均为项目自有工作流，无额外安装器、runtime、网络、telemetry 或初始化动作，沿用本仓库治理，不另引入第三方许可条款。

| 名称 | 职责 | 不触发场景 |
| --- | --- | --- |
| `investment-dashboard-ui-workflow` | 重大 Dashboard UI 协调，按需 Taste / Impeccable | 非 UI；小幅改字 / spacing 不要求外部 Skill |
| `investment-dashboard-domain-workflow` | Provider / PIT / Entity / Resolver / Evidence / Research Event / Thesis / ingestion / expectations / admission 的最小上下文 | 纯 UI、纯持久化机制、仅画图 |
| `investment-dashboard-local-core-workflow` | 复用 Phase 1A 的 SQLite、migration、Entity / Audit Repository、transaction、CLI、local-first / Node-only boundary | UI、研究表达；不包含 Phase 1B 业务 |
| `investment-dashboard-code-minimalism` | 当前明确任务内的保守去重 / 最小实现 | 普通 coding task；无跨任务持续模式 |

不复制业务合同、不写易漂移的覆盖数字、不预授权 Account / Asset / DCA 或其他后续域。

## 3. Managed external Skills 与 immutable pins

只安装单个 Skill 的明确文件清单，不安装整个 repository / pack / plugin。copy 在项目 `.agents/skills/` 内并被 gitignore；源文件保持原内容。机器可读 allowlist、逐文件 SHA-256 和平台 engine digest 在 [`config/agent-skills.lock.json`](../config/agent-skills.lock.json)。这是工具供应链清单，不是业务 contract。

| Skill | Upstream / 精确路径 | Immutable commit | License / 版本 |
| --- | --- | --- | --- |
| Taste `redesign-existing-projects` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/ccbc15639c97057cbfcf32ecebc38ef716e4bb37/skills/redesign-skill)，`skills/redesign-skill/` | `ccbc15639c97057cbfcf32ecebc38ef716e4bb37` | [MIT](https://github.com/Leonxlnx/taste-skill/blob/ccbc15639c97057cbfcf32ecebc38ef716e4bb37/LICENSE)；原 pin |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/8dac6ae7e020c43ab10ce9b41939f6fd42627b96/.agents/skills/impeccable)，`.agents/skills/impeccable/` | `8dac6ae7e020c43ab10ce9b41939f6fd42627b96` | [Apache-2.0](https://github.com/pbakaus/impeccable/blob/8dac6ae7e020c43ab10ce9b41939f6fd42627b96/LICENSE)；历史 installer 4.0.1、实际 Skill metadata 4.2.0、engine 0.1.0 是不同标识，未升级 |
| `archify` | [tt-a1i/archify](https://github.com/tt-a1i/archify/tree/c826e6c3a7abad19c0f3cd1ca57207d54b1ad8de/archify)，`archify/` | `c826e6c3a7abad19c0f3cd1ca57207d54b1ad8de` | [MIT / notices](https://github.com/tt-a1i/archify/blob/c826e6c3a7abad19c0f3cd1ca57207d54b1ad8de/archify/THIRD_PARTY_NOTICES.md)；stable tag `v2.16.0`，commit 是安装依据 |
| `diagram-design` | [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design/tree/2724fd2efd8c6737f6fa704fbf5da52d67375497/skills/diagram-design)，`skills/diagram-design/` | `2724fd2efd8c6737f6fa704fbf5da52d67375497` | [MIT](https://github.com/cathrynlavery/diagram-design/blob/2724fd2efd8c6737f6fa704fbf5da52d67375497/LICENSE)；无稳定 tag，选择 plugin manifest 2.6.17 对应 commit，不安装 plugin |

Impeccable engine 使用 `engine-v0.1.0` 的平台文件并另锁定 SHA-256，不只依赖 release URL。Windows x64 digest 为 `a522fcf352b47f325facc3964b337a6d6d7d55e136440f1442e8013aad27f1d7`；其余固定平台 digest 见 lock。Windows ARM64 未登记，不猜测或自动 fallback。

## 4. 对应使用边界

### UI：Taste / Impeccable

从项目 UI workflow 开始。Taste 仅用于现有页面或大型组件的重大 redesign；Impeccable 用于 critique、audit、accessibility、responsive、edge state、polish、adapt、harden。两者不自动串行执行，通用 Taste 变体不进 managed set。

保留 `--no-hooks` 方针；本版 setup 不执行 installer，也不调用 hook 注册。禁止自动 `impeccable init`、PRODUCT / DESIGN 初始化或替换、Agent 配置修改、pin 快捷 Skill、MCP、plugin、live/background service。上游 launcher 可下载到用户目录，项目不得直接调用它；使用已校验的局部 engine：

```bash
node scripts/run-codex-skill.mjs impeccable context
```

入口仅允许 context / detect 与版本帮助命令，设置 `IMPECCABLE_NO_UPDATE_CHECK=1`、`IMPECCABLE_NO_TELEMETRY=1`、`DO_NOT_TRACK=1`，不改全局环境。其他命令的实际副作用需要后续任务审计；Skill 不授权增加 UI library / framework 或重建治理事实源。

### Archify：工程架构与数据流

只用于复杂架构理解、架构图、架构变化审查、跨模块数据流与 trust boundary。Repository / Domain / Provider / Local Core 图必须从代码与可定位证据得出；图是派生解释，冲突时回到代码 / 合同。不为使用 Skill 改业务架构或生成无关图。

只读一份对应 schema / 示例和必要引用，通过项目入口使用本地 Node renderer：

```bash
node scripts/run-codex-skill.mjs archify doctor
node scripts/run-codex-skill.mjs archify validate architecture <candidate.json> --json
node scripts/run-codex-skill.mjs archify deliver architecture <candidate.json> <output.html> --json
node scripts/run-codex-skill.mjs archify check-update
```

Before / Delta / After 使用上游 compare 模式，先按 CLI 帮助核对参数。`check-update` 仅运行上游支持的 disabled 分支：`ARCHIFY_UPDATE_CHECK_DISABLED=1`，返回 silent/disabled，先于缓存和网络动作。不要直接运行 updater / ack。默认不启用 preview、remote brand capture、自动打开浏览器 / packaged visual-check、demo 或初始化。视觉验收使用当前已授权的浏览器工具并如实记录未测项；命令行通过不代表视觉通过。

模板含 Google Fonts，HTML 不能因此被称为完全无网络。离线交付在输出 artifact 使用可用本地字体 / fallback 并披露差异；不修改 pin 内模板、不替换 Dashboard 字体、不添加字体依赖。

### Diagram Design：研究表达

用于产业链、投资逻辑、宏观传导、商业模式、飞轮、时间轴、研究状态机 / 流程、公司行业关系和可发布研究图表。工程架构走 Archify。事实与推断分开，关系不能为排版而伪造或丢失。

本项目的最小局部方案是**直接使用 pin 内默认 style-guide，只影响当前输出图表**。这是本次治理任务确定的使用选择；跳过上游 first-run 定制和 profiles 的全局读写。不创建 `.diagram-design` marker（其 `profile: default` 仍要求 home profile），不读写 home profile library，不改安装内 style-guide，不产生第二套 design governance，不改 PRODUCT / DESIGN、UI library 或页面。未来明确品牌需求只在目标图表局部处理；项目治理变更另定范围。

按需读 style-guide、一个 type reference；只有图确实需要才补 semantic patterns / motion / export。三个 Python helper 使用标准库，调用加 `python -B` 防止在 pin 内写 `__pycache__`。PNG export 文档建议的 Playwright / browser 安装不是本次授权；用已有工具或报告缺失。字体网络请求和离线 fallback 同 Archify，不自动抓站点做 branding。

## 5. 2026-09-07 上游安全审计

安装新候选前取得独立 Git tree 并锁定 refs；实际读取 Skill frontmatter / body、相关 package / plugin manifests、license、安装 / 配置 / runtime / 网络 / filesystem 入口并检索副作用。未运行上游 installer、hooks、MCP 或初始化；README 只作导航。结论限于已查版本和所选文件，不能外推未来版本。

| 检查项 | Archify `c826e6c…` | Diagram Design `2724fd2…` | Ponytail `0a4dd63…` |
| --- | --- | --- | --- |
| Skill / 版本 | `archify/SKILL.md`，v2.16.0 | `skills/diagram-design/SKILL.md`；无 tag，2.6.17 commit | `skills/ponytail/SKILL.md`，v4.9.0 |
| license | MIT，package notices 含派生来源 | MIT，LICENSE / THIRD_PARTY_LICENSES 随局部 copy | MIT |
| project-local 安装 | 仅 pinned 文件 allowlist，不运行 zip builder / pack installer | 仅目标 Skill / license，不复制 plugin manifests 或 commands pack | Markdown 可局部复制，但项目拒绝其行为语义，改自有 minimalism |
| Node / runtime | 上游 Node >=18；项目 setup/wrapper 用现有 Node >=22；预生成 validators 无需 npm install | HTML/SVG + Python 3 标准库 helper，无 Node package runtime | 纯 Skill 无 runtime；完整分发另有 Node hooks、Pi、OpenCode、MCP |
| dependencies | 上游开发 Ajv / parse5 / saxes / simple-icons 不安装；排除 tests、package-lock、开发生成脚本 | helper 无新增包；可选 export 的 Playwright / browser 不安装 | MCP 依赖 `@modelcontextprotocol/sdk`、`zod`，全部不引入 |
| 全局目录 | checker 默认写 home cache；disabled 分支先于所有缓存动作 | profile 默认库在 home；default marker 也可能建全局 profile，不采用 | hooks 配置涉及 home / APPDATA；纯 Skill 无进程但有持续模式 |
| AGENTS / PRODUCT / DESIGN / settings | 所选 runtime 未发现自动改治理文件，不复制上游根治理文件 | onboarding 可写 style-guide / profile / marker；项目全部绕开 | plugin/hook 有 settings / mode 状态，不采用，不复制上游 AGENTS / rule variants |
| hooks / MCP / background | 可选 preview 启动 loopback server，visual-check 可启动 Chromium，入口默认排除；未启用 hook/MCP | 所选 Skill 未发现自动注册 hooks/MCP/server；export 可另起 browser，不自动执行 | Codex plugin 声明 hooks；另有 MCP / plugin runtime，全部拒绝 |
| shell / 网络 | Node CLI 子进程与目标产物写入；update manifest / brand capture / 模板字体可联网；禁用 updater/capture/preview | helper 读指定输入，extract 的 `--out` 可写指定输出；onboarding 抓网页、字体联网、export 可装包 | hooks 执行 Node；扩展 / uninstall 有配置和文件操作；Skill 可指导 shell；项目仅吸收文字原则 |
| telemetry / update | 所选 renderer 未发现 telemetry；update awareness 强制走 disabled；无自动升级 | 所选 Skill 未发现 telemetry/updater；不启用发布或 plugin 更新机制 | 原始 Markdown 未发现 telemetry；完整 runtime 未获准入，不宣称全上游无副作用 |
| 初始化 / broad / destructive | doctor 可只读；demo/render/deliver 写目标产物，内部清理自有暂存；setup 不运行 | first-run/profile 可初始化全局目录或删除 profile，项目跳过整个流程 | 持续每个响应、默认 full、deletion-first/ultra、压缩测试要求不符合项目范围和保障 |
| 触发 overlap | 上游描述工程 workflow/lifecycle；项目限工程交付物 | 上游也描述 architecture；项目限研究表达，不与 Archify 同跑 | ANY coding task + 启用后持续，explicit-only 开关不能限制持续期 |
| invariants / 结论 | ACCEPTED，project-scoped，updater disabled；图不能覆盖代码/合同 | ACCEPTED，project-scoped，默认 artifact 样式；不做全局 profile/UI 改造 | REJECTED direct install；改项目 minimalism |

证据入口：[Archify checker](https://github.com/tt-a1i/archify/blob/c826e6c3a7abad19c0f3cd1ca57207d54b1ad8de/archify/scripts/check-update.mjs)、[Archify CLI](https://github.com/tt-a1i/archify/blob/c826e6c3a7abad19c0f3cd1ca57207d54b1ad8de/archify/bin/archify.mjs)、[Diagram profiles](https://github.com/cathrynlavery/diagram-design/blob/2724fd2efd8c6737f6fa704fbf5da52d67375497/skills/diagram-design/references/profiles.md)、[Diagram helpers](https://github.com/cathrynlavery/diagram-design/tree/2724fd2efd8c6737f6fa704fbf5da52d67375497/skills/diagram-design/scripts)。

### Ponytail 决定

来源是 [DietrichGebert/ponytail v4.9.0](https://github.com/DietrichGebert/ponytail/blob/0a4dd63ad4541f4f655c4108a295916f3c1d8fda/skills/ponytail/SKILL.md)，审计 commit `0a4dd63ad4541f4f655c4108a295916f3c1d8fda`。考察了官方 `allow_implicit_invocation: false`：能关闭隐式选择，不能消除上游正文的跨响应持续要求和默认 full 强度。为限定任务期而改写正文会改变原始语义，所以不直接注册 Ponytail。

项目 minimalism 只吸收“先判断是否要写、复用仓库、标准库、平台原生、已安装依赖、最后最少代码”。`less code != less correctness`。禁止简化区域列于项目 Skill：contracts、schema、permissions、PIT、provenance、evidence、admission、Audit、atomicity、migration/checksum、Entity/revision、ledger、financial calculations、idempotency、backup/restore、authenticity、CI、tests、security/secret。无 MCP / plugin / hooks / background / global install / Agent config 行为。

### 保留能力复核

Taste 的 Markdown 与既有 pin 在 LF 归一后相同。Impeccable 的 56 个源文件与既有审计 commit 一致；既有 engine 与 release SHA-256 相同，全部原样保留。旧 installer 版本只能固定 CLI，仍获取另外分发的 Skill bundle；现在直接锁定 commit 内已生成的 Codex 文件，不依赖动态 bundle，也不执行 npm 安装器。Impeccable 确实存在 updater / telemetry / home-cache 入口，不能声称天然离线；runtime wrapper 禁用它们并直接调用局部 engine。

## 6. Setup / check / health

```bash
npm run agent:skills:setup
npm run agent:skills:check
npm run env:check
npm run --silent env:check:json
```

外部 script 名称不变，内部统一到 `scripts/setup-codex-skills.mjs`，旧 UI-only setup 不保留重复实现。

- 显式 setup 只下载 missing copy 的 fixed commit + digest 清单。Node 内置 fetch，无新 npm dependency、不执行远端代码；六文件一批，限制 HTTPS host、大小、超时、跳转，校验后才创建 Skill 目录。仅临时网络错误 / 429 / 5xx 最多尝试三次；404、禁止 host、内容不匹配不重试。
- 正确 copy 原样 SKIP。既有缺文件、hash 漂移、未知额外文件 / 不受管理目录均非零退出，不覆盖、不删除、不自行恢复。下载/hash 失败不产生新 Skill；磁盘写入中失败则保留不完整目录并报错，下次 preflight 拒绝，先人工核验再明确恢复。
- `--check` 不联网、不下载、不运行 Skill、不写 cache/config/lock；检查八个入口、external allowlist / digest、local engine 与 project scope。symlink / junction 被拒绝，防止跟随到全局目录。文本仅归一 CRLF/LF，二进制逐 byte 校验。
- env / JSON health 复用只读逻辑。缺第三方 copy 为 WARN，损坏 copy / 缺项目 Skill 为 FAIL；独立 `agent:skills:check` 对任何 missing 仍退出 1，不降低旧健康门禁。
- CI 保持原配置；新 fixture tests 随现有 Vitest 执行，不要求外部 Skill 安装，不增加 GitHub 在线下载门禁。
- 不操作用户全局 Skill / Codex config / 其他项目。新 Skill 未出现在客户端列表时再 reload；不宣称当前会话已重新发现所有新内容。

## 7. 升级与 deferred 清单

无 auto-update，不用浮动 main 长期 pin。升级需明确治理任务：读上游 diff / license / trigger / shell / 网络 / hooks / MCP / updater / 全局写入变化，重新确定 commit 和 file digests，同步 Registry / lock / 边界，跑 fixture 与对应验证，通过普通功能分支与独立审查。不要把本机未知来源内容反向生成“可信” digest，必须先核对固定 upstream。

以下不进入 managed set，也不删除历史研究记录、用户全局或其他项目 Skill：Taste `design-taste-frontend` / `gpt-taste`、重复 Taste / Impeccable、broad packs、无路由试验 Skill、Prime Agent、OpenMAIC、Semantica、awesome-gpt-image-2、Omarchy、OpenLogi、Vorssaint Utils、public-apis。

| 候选 | 决定 / 后续定位 |
| --- | --- |
| Ponytail 原版 | REJECTED direct install；改项目 minimalism，原因见审计 |
| Prime Agent / OpenMAIC | DEFERRED；未来 Multi-Agent / Agent Runtime 专项研究 |
| Semantica | DEFERRED；未来 ingestion / Wiki / Knowledge Graph 专项，必须复用 Entity / Version / Evidence / Audit / Local Core，不能平行建正式数据系统 |
| awesome-gpt-image-2 | DEFERRED；未来内容生产 / 报告视觉评估，不进当前 Coding Skill Router |
| public-apis | 不安装；仅吸收 discovery 原则，保留生产准入 |
| 其余变体 / packs / 工具集 | 不纳入；没有经过本项目审计的必要路由 |

本次路由、命令结果与综合自审见 [Phase 1A.5 验证记录](phase-1a5-agent-skills-validation.md)。Phase 1B 仍为 NOT STARTED。
