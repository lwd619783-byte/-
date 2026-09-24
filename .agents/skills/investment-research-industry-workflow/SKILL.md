---
name: investment-research-industry-workflow
description: Conduct deep industry research or a material industry Delta from public baseline through company validation and global valuation comparison, preserving Drive originals and consolidating the existing Notion industry Wiki. Excludes OS feature development, formal decision writes, routine quotes and diagram-only tasks.
---

# 行业深度研究工作流

用于明确的行业深研、行业 Pilot 或重大增量研究。本 Skill 为 instruction-only 项目工作流，不是新的研究系统、业务合同或自动化 runtime。

## 职责与边界

- Google Drive = L0 原件库；Notion = Research Memory / 长期研究知识库；投研 OS = Formal Decision System；Codex = 当前任务研究执行 Agent。
- 沿用根 AGENTS.md 和 [投研知识与决策工作流](../../../docs/research-knowledge-decision-workflow-v1.md)。普通研究默认终止于 Notion；不用 Stage 4.5 OS Domain MCP 代理 Drive/Notion，不自动修改 Verified Claim、Thesis、Investment Expression、Portfolio 或正式 OS 状态。
- 研究成熟度、AI 草稿/人工审核状态、原件核验状态分别报告。V2 不意味着正式事实准入、人工审核或 OS Promotion。
- 不新增 npm/pip dependency、外部 Skill、MCP/server/hook/background service；复用当前已授权工具。私人资料、账户信息、Drive/Notion ID、真实研究原件和运行台账留在私人研究空间，不提交公开仓库。

## 执行入口

1. 先读 [研究生命周期](references/research-lifecycle.md) 与 [Notion / Drive 交付](references/notion-drive-delivery.md) 的 D0：唯一匹配既有 Wiki、待研究项和 L0 目录，实际探测可读写能力与公开网络。任何关键能力缺失，停在研究开始前；若任务也含 Skill 工程，仍完成工程验证和已授权交付。不得新建重复行业 Wiki。
2. 采集前读 [来源与证据规则](references/source-evidence-rules.md)。先官方/原始公开基线，再第三方 Delta，再按生态位选代表公司。研究期间维护私人来源台账、未决项和 gate 证据。
3. 按 V0 → V1 → V1.1 → V1.2 → V2 推进。后续无需逐阶段询问；缺数据如实留空，不能用进度压力换取成熟度升级。既有研究从最后可核验状态继续，不因旧版本标签跳过证据检查。
4. 收口前读 [深研验收](references/deep-dive-acceptance.md)，逐项绑定证据。全部 V2 gate 通过后才标 V2、勾选对应临时待研究项并转入 V3 Delta Research。
5. 先保存独立研究档案和公司页，再将主 Wiki 收口为当前有效认知；回读整页及相关索引，核实没有过期状态或施工日志。V3 是后续工作方式，不代表已创建后台监控。

## 允许打断的情况

仅关键权限缺失、影响研究的官方原件经全部可用自动方式仍无法取得、付费资料、无法消除的目标歧义、删除/不可恢复覆盖，或即将越过 OS Promotion Gate 时找用户。可公开查证、现有 connector 可解或已有文件可解的事项自行完成。普通有档案保留的 Wiki 更新属于已授权研究交付；不得借此删除历史或子页。

资料下载缺口一次性列全：报告准确标题/期次、官方直链、失败方式、影响哪个 gate、唯一需要的用户动作。关键缺口暂停相应 gate；非关键缺失可以保留未知继续，但不得宣称已解决。

## 交付

报告真实成熟度、Wiki/档案/公司页入口、L0 数量与身份/字节核验结果、来源与公司覆盖、未决项和停止点。OS Promotion 未发生时明确写“未触发”。工程任务另列 Base/Final SHA、分支及远端状态、修改文件、验证结果；不把 Skill 静态验证算成真实 Pilot 通过。
