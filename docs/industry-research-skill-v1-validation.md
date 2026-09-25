# 行业深度研究 Skill 与 Research Handoff 验证

## 正式冻结 — 2026-09-25 CURRENT

**Industry Research Skill V1.1 / CURRENT / FROZEN SOP。** Original Base `fc0f23466777f32eb27037f6cbcbba627f5b2478`；Pre-freeze `a0ed5d8b6b28bda69c01230b215812afa8a68c0c`。本轮 fetch 核对 main/功能分支均无漂移，初始 ahead 2 / behind 0，worktree 干净，无已有 PR 或未知提交。用户明确授权验证后 PR + squash merge；本条不预写尚未发生的 merge/Hosted/Production 结果。

- 通用 SOP 固定 Codex Research Engineer / Evidence Builder → Research Handoff → ChatGPT Final Writer / Research Synthesizer。三状态轴、五子页及简短 Writing Brief 保留；L0 GAP 不回退已完成的 V1.2，READY 不等于 V2，Research Maturity 不等于人工审核，AI Draft 不等于 OS Verified Claim。
- 从通用验收 reference 移除电力行业的产品/样本/压力清单，改为按行业实际控制点与传导选择代表公司和可复算压力情景。行业特定历史覆盖保留在本验证记录：全球电力/DC需求、输配电与供配电、热管理、燃机/新增电源、供给周期/capex/利润池，以及六家全球公司验证；这些不是其他行业的强制模板。
- **Pilot 链路已完成**：Codex Evidence Builder → Research Handoff → ChatGPT Final Writer → 主 Wiki 最终 synthesis。前两步已有上轮执行/回读证据；Writer 与最终 synthesis 完成按本轮用户明确确认登记，本轮未再次读取或修改私人 Wiki。本事实不自动证明 L0 缺口关闭、Wiki V2、人工审核或 OS Promotion；下方旧“等待 synthesis”仅为上轮时点。
- Token 纪律明确只交接高价值证据，不逐份全文摘要再写第二篇长报告；Writer 消费后保留 Handoff 作审计证据，后续新资料走 Delta。
- 仅指令/治理文档冻结；projectSkills 集合、lock、测试数量断言未变。无依赖/runtime/service/hook/MCP/contracts/schema/permissions/UI/business logic 变化；无私人 URL/身份/原件或易漂移公司研究数据入库。
- 本轮不继续行业研究、不补文件或 A/H 样本、不修改电力 Wiki 正文、不新建 Handoff，OS Promotion 未触发；下一行业研究不在本任务自动开始。

冻结提交前验证：`npm run agent:skills:check` PASS（6项目入口/4既有managed实现）；Skill frontmatter validator PASS；`npx vitest run scripts/setup-codex-skills.test.mjs` 24/24 PASS；`npm run env:check` 48 PASS / 11 WARN / 0 FAIL / 4 SKIP（无新增FAIL）；`git diff --check` PASS。generic Skill 行业/公司专属扫描零命中，Router/Registry/lock集合一致，隐私与非目标文件范围检查通过。application full test/build = NOT_RUN（无 application runtime 变化）。PR 检查实际运行则等待成功；若无 Hosted run 如实 NOT_RUN，按用户授权继续。合并后只观察 Git 集成自动 Production，不主动 deploy/rollback。

## Skill V1.1 / Handoff — 2026-09-25 CURRENT

**IMPLEMENTED / VERIFIED LOCALLY / PENDING CHATGPT AUDIT AND SYNTHESIS。** 本轮 Base `1b4e3c482798c1554477192b867890184c83fd4c`；fetch 后 `origin/main @ fc0f23466777f32eb27037f6cbcbba627f5b2478` 与功能分支 HEAD 均符合指定审计基线，无未知提交。继续 `codex/industry-research-skill-v1-pilot`，未切换或修改 main。

- Codex 改为 Research Engineer / Evidence Builder；ChatGPT 网页端承担最终 synthesis、Wiki 叙事/视觉与 maturity 判定。主 Wiki 只修复明确错误状态，未执行最终 Wiki 写作。
- Wiki Maturity、Evidence/L0 Gate、Handoff Readiness 三轴正交；本 Pilot 当前为 **V1.2 公司验证 / L0 GAP / V2 BLOCKED / V3 NOT STARTED / READY_WITH_GAPS**；AI Draft 待人工审核，OS Promotion 未触发。L0 GAP 不把研究退回 V1.1。
- 新增 Research Handoff Contract，更新入口/四份既有 references/Router/Registry。projectSkills 数量不变，lock 与 fixture 无需改动。无 dependency、runtime、service、合同、UI 或 Domain MCP 变更。
- 复用已有原件、公司页和比较底稿，建立一份短父页及 A Evidence Ledger、B Company Fact Matrix、C Delta & Conflict Register、D Valuation & Scenario Dataset、E L0 Manifest & Gaps。父页只含 metadata、覆盖/缺口、索引和七项 Writing Brief；不是第二份长报告。
- 私人 Notion 六页已写入并完整回读；27条重要证据、六公司各20字段、旧判断/冲突、统一价格日数据及机械情景均可追到原始来源。未知日期/精确页/指标保留明确限制，不编造定位。主 Wiki 当前核心判断及之后正文与 baseline 逐字一致；档案/gate/索引/待研究项仅同步本行业状态，历史阶段快照保留。
- L0 引用既有已核台账，不重复上传或声称本轮重新核验原件字节。三项既有缺口（Schneider URD、IEA ETP、OCP液冷白皮书）保留，本轮不再次索取用户下载；Modine价权/盈利范围、Eaton共识、精确EV/ROIC等仍缺失，未勾选V2待研究项。

| 本轮验证 | 实际结果 |
| --- | --- |
| `npm run agent:skills:check` | PASS；6项目入口和4个既有managed实现，无安装/升级 |
| `npx vitest run scripts/setup-codex-skills.test.mjs` | 24/24 PASS；未修改测试 |
| `npm run env:check` | 48 PASS / 11 WARN / 0 FAIL / 4 SKIP；未提交工作区WARN，无新增FAIL |
| `git diff --check` | PASS |
| 独立指令审查 | PASS；新分工/三状态轴/五页合同/停止点一致；不冒充真实执行验证 |
| Notion回读 | 父页、五子页、主Wiki状态与正文保护、档案/gate及本行业索引/清单已核 |
| 全量应用测试 / build | NOT_RUN；无应用runtime变更 |
| GitHub Hosted CI | NOT_RUN |
| Vercel Preview | READY；只读核验 `dpl_9oXH7fvD4PzczUVNoEKbRtNsmdyQ`，绑定 `1b4e3c482798c1554477192b867890184c83fd4c`，不是本轮Final SHA验收 |
| Production | NOT_MODIFIED；未主动执行Production deployment，本轮不主动再次部署 |

普通 commit/push 后停止等 ChatGPT 独立审计和正式 synthesis；不创建 PR、不 merge、不修改 main。上述 CURRENT supersede 下方 V1 的职责、错误成熟度与笼统“无部署”表述；保留原研究和本地验证历史，不把私人 Drive/Notion 身份或研究原件写入仓库。

## V1 交付历史｜2026-09-25（当前状态以上方为准）

**Skill IMPLEMENTED / VERIFIED LOCALLY / PENDING CHATGPT INDEPENDENT AUDIT。真实 Pilot PARTIAL / V2 BLOCKED。**

开工 fetch 后 `origin/main` 仍为 `fc0f23466777f32eb27037f6cbcbba627f5b2478`，与用户给定基线一致；从该提交建立 `codex/industry-research-skill-v1-pilot`。当前基线包含 Stage 4.5 变更，但本任务不继承其历史 CI、部署或私人验收结论。

## 工程范围

- 新增 instruction-only `investment-research-industry-workflow` 入口及 lifecycle、source/evidence、Notion/Drive、deep-dive acceptance 四份 references。
- 根 Router、Skill Registry 与 lock 的 `projectSkills` 一致；项目入口五个增至六个，fixture仅同步既有数量断言。
- Drive=L0，Notion=Research Memory，OS=Formal Decision System，Codex=研究执行 Agent；沿用既有 M0—M13 taxonomy，不修改合同或新建研究 authority。
- V0→V1→V1.1→V1.2→V2→V3；V2八项全部通过后才升级、勾选清单。主 Wiki 当前认知、公司层、独立过程档案分离并回读。
- Pilot发现分拆含权价格与盈利范围错配，已在通用证据规则中明确公司行动/除权/分配权益检查；条件算式不得伪装有效比较。
- 未新增依赖、外部 Skill、MCP/server/hook/background service；未修改 UI、业务 runtime、contracts/schema/permissions 或 Stage 4.5 Domain MCP。
- 研究原件、私人台账、账户和外部对象身份均不进入仓库。此文仅登记去标识验收事实。

## 本地验证

| 检查 | 实际结果 |
| --- | --- |
| Skill frontmatter validator | PASS；Windows默认GBK读取UTF-8首次报编码错误，使用 `python -X utf8` 后通过，未改验证器 |
| `npm run agent:skills:check` | PASS，6个tracked入口及4个既有managed实现；没有安装/升级外部Skill |
| `npx vitest run scripts/setup-codex-skills.test.mjs` | 24/24 PASS |
| `npm run env:check` 基线 | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `npm run env:check` 本轮未提交状态 | 48 PASS / 11 WARN / 0 FAIL / 4 SKIP；新增工作区未提交WARN，无新增FAIL |
| `git diff --check` | PASS |
| 有界独立行为审查 | PASS：正常深研路由、混合价格/缺失共识不强升、Drive只读时D0停止、分拆价权不直接排名 |
| 全量应用测试 / build / Hosted CI | NOT_RUN；instruction-only及既有fixture计数变化，无应用runtime变更 |
| PR / merge / main写入 | NOT_PERFORMED；普通commit/push后等待ChatGPT独立审计；原“无部署”表述已由上方精确Preview/Production记录更正 |

行为审查是指令审查，不是合成场景被执行的证明，也不代替真实Pilot。

## 真实 Pilot

对象为《全球电力与数据中心基础设施｜电网、供配电、液冷与燃机》，唯一复用既有行业页和待研究项，没有新增重复行业Wiki。D0真实Notion读写回读、Drive上传/原字节下载回读、公开网络均通过；研究不是D0模拟。

已形成官方公开基线与实质技术Delta；阅读IEA、OCP、NVIDIA来源以及按控制点选择的Eaton、Schneider Electric、Vertiv、Modine、GE Vernova、Siemens Energy完整财报和关键附注。完整报告取得/读取范围、网页身份与可下载PDF字节归档分别记录，不把财务摘要当完整10-Q，不声称逐字审计全部页。

六家公司经营双链、全球控制点/利润池、同为9月23日主市场收盘的条件估值、资本强度/FCF定义/稀释、明确反证及可复算下行情景已写入私人Notion。过程进入独立档案，六家公司进入子页；主Wiki按M0—M13重新收口为当前认知，整页回读无截断/未知块和施工日志，行业索引/待研究项已同步真实状态。

**历史状态更正**：V1交付曾将已完成公司验证与L0归档门禁混写，误报成熟度V1.1；审计纠正为 **Wiki V1.2 / L0 GAP / V2 BLOCKED**。经营研究底稿保留；归档与完整估值可比性缺口未关闭，未勾选待研究项、未转V3，仅准备候选Delta触发。

实际障碍包括大型官方PDF上传传输超时、部分官方原件下载/字节归档受限，以及Modine分拆前含权价格与盈利预期业务范围无法可靠桥接。缺失共识/修正序列、精确价格日股数/EV与统一ROIC保留未知；不由AI补数字。私人档案记录逐项PASS/GAP/BLOCKED、准确来源、大小/hash、失败方式和一次性补档清单。完整原件数和最终核验结果以本次交付的私人台账及用户报告为准，不把易漂移私人运行记录固化为仓库数据。

OS Promotion Gate：**未触发**。没有修改Verified Claim、Thesis、Investment Expression、Portfolio或正式OS状态。Skill静态通过、真实研究内容完成与V2成熟度验收是三个独立结果。
