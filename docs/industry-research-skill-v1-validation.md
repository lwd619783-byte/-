# 行业深度研究 Skill V1 与真实 Pilot 验证

## 2026-09-25 CURRENT

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
| PR / merge / main写入 / 部署 | NOT_PERFORMED；普通commit/push后等待ChatGPT独立审计 |

行为审查是指令审查，不是合成场景被执行的证明，也不代替真实Pilot。

## 真实 Pilot

对象为《全球电力与数据中心基础设施｜电网、供配电、液冷与燃机》，唯一复用既有行业页和待研究项，没有新增重复行业Wiki。D0真实Notion读写回读、Drive上传/原字节下载回读、公开网络均通过；研究不是D0模拟。

已形成官方公开基线与实质技术Delta；阅读IEA、OCP、NVIDIA来源以及按控制点选择的Eaton、Schneider Electric、Vertiv、Modine、GE Vernova、Siemens Energy完整财报和关键附注。完整报告取得/读取范围、网页身份与可下载PDF字节归档分别记录，不把财务摘要当完整10-Q，不声称逐字审计全部页。

六家公司经营双链、全球控制点/利润池、同为9月23日主市场收盘的条件估值、资本强度/FCF定义/稀释、明确反证及可复算下行情景已写入私人Notion。过程进入独立档案，六家公司进入子页；主Wiki按M0—M13重新收口为当前认知，整页回读无截断/未知块和施工日志，行业索引/待研究项已同步真实状态。

**已验收成熟度V1.1**。V1.2公司经营研究已有完整底稿，但原件归档门禁未关闭；V2完整统一估值仍有核心可比性缺口。未将完成的比较底稿冒充V2全通过，未勾选待研究项，未转入V3；仅准备了后续Delta触发。

实际障碍包括大型官方PDF上传传输超时、部分官方原件下载/字节归档受限，以及Modine分拆前含权价格与盈利预期业务范围无法可靠桥接。缺失共识/修正序列、精确价格日股数/EV与统一ROIC保留未知；不由AI补数字。私人档案记录逐项PASS/GAP/BLOCKED、准确来源、大小/hash、失败方式和一次性补档清单。完整原件数和最终核验结果以本次交付的私人台账及用户报告为准，不把易漂移私人运行记录固化为仓库数据。

OS Promotion Gate：**未触发**。没有修改Verified Claim、Thesis、Investment Expression、Portfolio或正式OS状态。Skill静态通过、真实研究内容完成与V2成熟度验收是三个独立结果。
