---
name: investment-research-industry-workflow
description: Build a Research Handoff Pack for explicit deep industry research, a real industry pilot or a material industry Delta, using official evidence, Drive L0 originals, company validation and reproducible comparison datasets for a ChatGPT final writer. Excludes final Wiki writing, OS development or formal decision writes, routine quotes and diagram-only tasks.
---

# 行业深度研究工作流

**Industry Research Skill V1.1 — CURRENT / FROZEN SOP。** 这是工作流版本，不增加研究版本或状态轴。后续行业深研沿用本通用 SOP；具体行业的覆盖范围、公司样本和验收实例保留在独立研究档案。

用于明确的行业深研、行业 Pilot 或重大增量研究。本 Skill 为 instruction-only 项目工作流，不是新的研究系统、业务合同或自动化 runtime。

## 职责与边界

- Google Drive = L0 原件库；Notion = Research Memory / 长期研究知识库；投研 OS = Formal Decision System；Codex = Research Engineer / Evidence Builder；ChatGPT 网页端高级模型 = Final Writer / Research Synthesizer。
- 沿用根 AGENTS.md 和 [投研知识与决策工作流](../../../docs/research-knowledge-decision-workflow-v1.md)。普通研究默认终止于 Notion；不用 Stage 4.5 OS Domain MCP 代理 Drive/Notion，不自动修改 Verified Claim、Thesis、Investment Expression、Portfolio 或正式 OS 状态。
- 三条状态轴分别报告且不得互相覆盖：Wiki Maturity `V0 → V1 → V1.1 → V1.2 → V2 → V3`；Evidence/L0 Gate `PASS / GAP / BLOCKED`；Handoff Readiness `NOT_READY / READY_WITH_GAPS / READY_FOR_CHATGPT_SYNTHESIS`。另列 V2 Gate、V3 是否开始、AI 草稿/人工审核与 OS Promotion。L0 GAP 可以阻断 V2，不能把已完成公司验证的 V1.2 退回 V1.1。
- Codex 负责证据提取、完整财报及关键附注、两条验证链、产业控制点、统一估值数据、corporate action / dilution / FCF / capex、可复算情景、Delta / conflict / unknown 和 Handoff。最终行业 Wiki 长文、M0—M13 叙事、Notion 视觉/callout/图标/排版、投资综合判断及 Wiki 成熟度判定由 ChatGPT Final Writer 完成；Codex 不自动宣布 V2/V3。
- Writer 消费 Handoff、选择性回读关键原件、跨来源/跨公司推理，完成最终 M0—M13 结构、行业叙事、Notion 表格/视觉、当前 Wiki 收口及后续 Delta 更新。Research Maturity 不等于人工审核状态，Notion AI Draft 不等于 OS Verified Claim；Handoff READY 不等于 Wiki V2。
- 不新增 npm/pip dependency、外部 Skill、MCP/server/hook/background service；复用当前已授权工具。私人资料、账户信息、Drive/Notion ID、真实研究原件和运行台账留在私人研究空间，不提交公开仓库。

## 执行入口

1. 先读 [研究生命周期](references/research-lifecycle.md) 与 [Notion / Drive 交付](references/notion-drive-delivery.md) 的 D0：唯一匹配既有 Wiki、待研究项和 L0 目录，实际探测可读写能力与公开网络。任何关键能力缺失，停在研究开始前；若任务也含 Skill 工程，仍完成工程验证和已授权交付。不得新建重复行业 Wiki。
2. 采集前读 [来源与证据规则](references/source-evidence-rules.md)。先官方/原始公开基线，再第三方 Delta，再按生态位选代表公司。研究期间维护私人来源台账、未决项和 gate 证据。
3. 按生命周期准备对应证据，不把工作阶段当成 Wiki 升级指令。既有研究先复用已取得原件、公司页与比较底稿，仅补实际 Delta/缺口；无需逐阶段询问。缺数据留空，状态冲突保留原记录并明确当前更正。
4. 交付前读 [Research Handoff Contract](references/research-handoff-contract.md) 与 [深研验收](references/deep-dive-acceptance.md)。建立一个短父页和五个结构化证据子页，逐项绑定原始来源，不另写一篇行业报告。
5. 回读父页、五子页、主 Wiki 状态与档案 gate；Codex 只修复主 Wiki 明显错误状态标签，不改正文/顺序/视觉。默认停在 `READY_FOR_CHATGPT_SYNTHESIS` 或 `READY_WITH_GAPS`，等待 ChatGPT 审计和正式 synthesis；关键能力/证据不足则 `NOT_READY`。不自行勾选完整 V2 待研究项。
6. Writer 完成 synthesis 后保留 Handoff 作为审计证据包，不删除；后续新资料走 Delta Research，不重新跑全行业。Codex 不在主 Wiki 尾部追加阶段施工日志，不承担最终行业长文写作。

## 允许打断的情况

仅关键权限缺失、影响研究的官方原件经全部可用自动方式仍无法取得、付费资料、无法消除的目标歧义、删除/不可恢复覆盖，或即将越过 OS Promotion Gate 时找用户。可公开查证、现有 connector 可解或已有文件可解的事项自行完成。普通授权覆盖档案/公司事实底稿/Handoff 更新，不覆盖最终 Wiki 写作；不得删除历史或子页。

资料下载缺口首次需用户介入时一次性列全：准确标题/期次、官方直链、失败方式、影响 gate 和所需动作。已登记/已请求的缺口不重复索取；本轮仅转交既有研究时沿用缺口即可交付 READY_WITH_GAPS。关键缺口暂停相应 gate，不回退研究成熟度、不宣称缺口已解决。

## 交付

报告三条状态轴、V2/V3 状态、Handoff 父页/五子页入口、L0 数量与身份/字节核验、覆盖/缺口及停止点，明确“未执行最终 Wiki 写作”。OS Promotion 未发生写“未触发”。工程任务另列 Base/Final SHA、分支/远端、修改文件、验证；区分 Hosted CI / Preview / Production 及各自绑定提交，不把静态检查算成真实研究通过。
