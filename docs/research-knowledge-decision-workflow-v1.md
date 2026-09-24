# 投研知识与决策工作流 V1

> 状态：**CURRENT / FROZEN OPERATING MODEL V1**
>
> 日期：2026-09-24
>
> 作用：冻结 Google Drive、Notion、ChatGPT 与投研 OS 的长期职责边界，以及以后行业、宏观、公司、产业链、主题与观点跟踪的默认研究工作流。本文 supersede 旧路线中任何把 OS Local Wiki / Obsidian / Research Bridge 当作默认长期知识库的表述；旧实现继续作为 Legacy compatibility，不回写历史审计事实。

## 1. 一句话定位

- **Google Drive = L0 原件库**：保存不可改写的原始资料与文件身份。
- **Notion = Research Memory / 长期研究知识库**：保存“我们目前怎么理解这件事”。
- **投研 OS = Formal Decision System / 正式投资决策操作系统**：管理“哪些事实可正式采用、当前正式判断是什么、如何计算、何时失效、与真实组合有什么关系”。
- **ChatGPT = Research Orchestrator / 研究编排与推理层**：读取 Drive/Notion/OS，完成比较、增量研究、推理和产物生成，但自身不是事实 authority。

默认判断标准：

> **如果一个功能用 Notion + ChatGPT 就能可靠完成，就不应继续在 OS 中重建。**

OS 只开发 Notion 难以可靠承担、且会影响正式投资判断或资金状态的能力。

## 2. 三层长期架构

### 2.1 Google Drive — L0 Raw Source

负责：

- 研报 PDF、公告、政策原文、会议材料、公众号原文、原始表格；
- 真实文件 identity、来源、发布日期/抓取时间、文件名、大小、SHA-256、归档路径；
- 原件不可静默覆盖，不把 AI 摘要替代原件。

不负责：

- 正式投资结论；
- Thesis authority；
- Portfolio；
- 数据准入与确定性计算。

### 2.2 Notion — L2 Research Memory / Wiki

负责：

- 行业 Wiki；
- 公司 Wiki；
- 宏观与资产配置研究；
- 产业链与主题研究；
- 研究方法与模板；
- Creator / 博主长期观点；
- AI 综合研究；
- 观点版本、变化原因、反证、待验证项。

Notion 回答：

> **“我们目前怎么理解这个行业 / 公司 / 宏观问题？”**

Notion 是长期研究记忆的默认真源，不再要求 OS 保存同一篇 Wiki 正文，也不要求 Obsidian 成为第二真源。

Notion 内容可以是高质量 research context，但**不能单独升级为 Verified Claim / Thesis authority**。

### 2.3 投研 OS — Formal Decision System

OS 只保留需要结构化、确定性、可审计或与资金状态直接相关的领域：

- Structured Fact / Metric；
- Provider / Entity / unit / currency / period / basis；
- PIT（Point-in-Time，时点一致性）；
- release / revision / admission / stale / conflict；
- Evidence；
- Verified Claim；
- Thesis；
- Investment Expression；
- Portfolio / Exposure；
- Target Allocation；
- Review / Rebalance；
- Audit / F1 / F2 / F3；
- deterministic calculation / blocker propagation。

OS 回答：

> **“哪些事实能正式采用？当前正式判断是什么？什么会证伪？怎么算出来？我的实际暴露在哪里？”**

OS 不再扩建：

- 行业 Wiki / 公司 Wiki / 宏观 Wiki；
- Notion 正文镜像；
- Obsidian 主知识库；
- 普通全文研究搜索；
- 通用长文知识问答；
- 为了“AI 记忆”复制一套研究文档系统。

## 3. Authority 分层

| 层级 | 典型内容 | Authority |
| --- | --- | --- |
| Drive L0 | 原始 PDF / 公告 /原始材料 | 原件身份与内容证据 |
| Notion Research Memory | Wiki、综合研究、观点变化、AI draft/reviewed research | Research context |
| Web / 外部资料 | 最新公开世界信息 | External evidence candidate |
| OS Structured Fact / Evidence | 正式 Provider、PIT、admission、Evidence | Formal factual authority（按各合同） |
| OS Verified Claim | 通过 Evidence Gate 的明确 Claim | Formal claim authority |
| OS Thesis | 有 revision / invalidation / confirmation 的正式投资判断 | Formal decision authority |
| OS Investment Expression | Thesis 对应的 ETF / Equity / Fund 等投资表达 | Formal expression |
| OS Portfolio | 已记录仓位、暴露、目标、复核 | Capital-state authority |

禁止 authority 混淆：

- AI Draft ≠ Fact；
- Notion Wiki ≠ Verified Claim；
- Creator Commentary ≠ official Evidence；
- 研报观点 ≠ Provider Fact；
- Portfolio planning ≠ executed trade；
- Preview / synthetic ≠ real user state。

## 4. 标准研究工作流

以后新行业、宏观、公司、产业链、主题研究默认执行以下流程。

### Step 1 — Intake：新资料进入 Drive

新研报 / 公告 / 公众号 / 会议资料先进入 Google Drive L0。

保留：

- 原件；
- 来源；
- 日期；
- identity；
- SHA-256；
- 归档路径。

### Step 2 — Baseline：先读 Notion 既有研究

ChatGPT 在分析新资料前，先找到相关 Notion Wiki 的当前版本，恢复：

- 当前行业/公司/宏观认知；
- 已有核心假设；
- 关键数据与驱动；
- 反证；
- 上一版待验证项。

没有基准线时，先建立 V1.0，而不是只围绕一份新 PDF 写结论。

### Step 3 — Delta Research：做“新增证据 vs 原观点”比较

重点回答：

1. 新资料提供了什么新增事实 / 新解释？
2. 哪些旧判断被加强？
3. 哪些旧判断被削弱或证伪？
4. 哪些模块需要变化？
5. 是否出现第二增长曲线、供需拐点、技术路线切换、竞争格局变化、盈利中枢变化等结构性变化？
6. 新信息是否已经被价格或一致预期反映？

行业研究默认继续使用既定 M0—M13 框架，但只更新受影响模块，不机械重写全部章节。

### Step 4 — Update Research Memory：必要增量更新 Notion

如果存在实质变化：

- 更新同一 Wiki 版本链；
- 记录旧观点；
- 记录新证据；
- 记录变化原因；
- 记录反证与待验证项；
- 保留原件链接。

没有实质变化时记录“结论未变”，不制造新观点。

**大多数研究工作到这里结束。**

### Step 5 — Promotion Decision：判断是否需要晋升 OS

默认：**不晋升。**

只有满足以下任一条件，才考虑进入 OS：

1. 需要正式、可重复的 deterministic calculation；
2. 需要 PIT / release / revision / admission 管理；
3. 结论将改变正式 Claim / Thesis；
4. 结论需要长期证伪条件与状态机跟踪；
5. 需要形成 Investment Expression；
6. 已经影响 Portfolio exposure / target / review；
7. 需要成为 Agent 可依赖的正式事实或决策状态。

仅有以下情况时继续留在 Notion：

- 新的行业故事；
- 券商观点；
- AI 综合判断；
- 尚未闭合证据链的第二增长曲线假设；
- 一般公司比较；
- 普通宏观推演；
- Creator / 博主观点；
- 研究素材摘要。

### Step 6 — Evidence Gate：正式事实晋升

需要进入 OS 的新结论，必须回到正式 Evidence。

路径：

`Source / Provider → Evidence → F2 / Gate → Verified Claim`

不能使用“Notion 写得很好”作为 Claim 晋升理由。

缺：

- source authority；
- exact identity；
- PIT；
- releaseAvailableAt；
- revision；
- admission；

则保持 candidate / blocked / unsupported，不由 AI 补齐。

### Step 7 — Thesis / Expression：影响正式投资判断

如果 Verified Claim 足以改变投资判断：

`Verified Claim → Thesis revision → Investment Expression`

必须保留：

- 原 Thesis；
- revision；
- 新增证据；
- bull/base/bear；
- drivers；
- risks；
- catalysts；
- invalidation；
- asOf；
- user confirmation。

### Step 8 — Portfolio：映射到真实资金

当 Thesis / Expression 与真实持仓相关时：

`Expression → Position / Exposure → Target → Review / Rebalance`

区分：

- 当前实际暴露；
- 目标暴露；
- 差额；
- blocker；
- review；

不得把规划写成交易或成交。

### Step 9 — Review：持续复盘

新事件到来时重复：

`新证据 → Notion 增量研究 → Promotion Gate → 必要时更新 OS → Portfolio 复核`

形成：

`研究 → 沉淀 → 验证 → 决策 → 组合 → 复盘 → 再研究`

## 5. “老树发新芽 / 第二增长曲线”标准示例

假设传统行业出现新的增量需求：

1. 新研报进入 Drive；
2. ChatGPT 读取 Notion 原行业 Wiki；
3. 比较原假设与新证据；
4. 如果只是“新需求可能形成”，更新 Notion，标为待验证；
5. 如果官方/公司证据显示新业务收入、利用率、毛利率等达到正式门槛，再进入 OS Evidence；
6. 通过 Evidence Gate 后形成/修订 Verified Claim；
7. 足以改变长期盈利中枢时，修订 Thesis；
8. 形成更具体的 ETF / 公司 Investment Expression；
9. 再与真实 Portfolio exposure 比较，决定是否需要 review / rebalance。

因此“发现新故事”与“改变正式仓位判断”之间必须存在清晰门槛。

## 6. 默认指令语义

### “整理知识库资料库里的待研究文件”

默认授权范围：

`Drive 投研知识库/00_待整理_Inbox → 去重/分类/规范命名 → 归档 L0 → 读取相关 Notion Wiki → Delta Research → 必要增量更新 Wiki → 汇总变化`

默认**不**自动：

- 新建 Verified Claim；
- 修改 Thesis；
- 修改 Investment Expression；
- 修改 Portfolio；
- 删除原件；
- 改共享权限。

发现满足 OS 晋升条件时，先在汇总中标记“建议晋升 OS 的候选”，再进入对应正式门禁。

### “研究某行业的新变化”

默认顺序：

`公开/用户资料 → Notion baseline → Delta Research → Wiki update`

不是先查 OS Wiki。

### “把这个结论纳入正式投资判断”

才进入：

`Evidence → Verified Claim → Thesis → Expression → Portfolio`

## 7. Stage 4.5 对本模型的实现含义

Stage 4.5 不建设“大而全知识 MCP”。

**OS Domain MCP 只暴露 Formal Decision System 的受控能力。**

优先候选：

- Evidence；
- Verified Claim；
- Thesis；
- Investment Expression；
- Portfolio / Exposure；
- 必要的 Creator structured context；
- 已具备正式 owner 的 structured facts。

不代理：

- Drive 原件；
- Notion Wiki；
- `search_wiki`；
- `get_wiki_entry`；
- 普通知识正文。

旧 Local Wiki / Obsidian / Research Bridge：

> **Legacy compatibility / fallback only**

在 Domain MCP 替代与真实迁移验收完成前不删除，但不再扩建。

Stage 4.5 Slice 1 默认只读；未来写入仍必须：

`prepare → preview → explicit user confirm → commit`

## 8. 产品开发判定规则

新功能进入 OS 开发前必须回答：

1. Notion + ChatGPT 是否已经能可靠完成？
2. 是否需要 deterministic calculation？
3. 是否需要 PIT / admission / revision？
4. 是否需要正式 Evidence / Claim / Thesis authority？
5. 是否与 Portfolio / capital state 直接相关？
6. 是否需要 fail-closed / Audit / permission？

如果 2—6 均否，则默认不进入 OS。

## 9. 当前主线

截至 2026-09-24：

- Stage 4.3：CLOSED；
- Stage 4.4：CLOSED；
- Stage 4.5：CURRENT — OS Domain MCP / Controlled Tool Layer；
- Stage 4.6：NEXT — ChatGPT-connected Research Agent / Artifact Integration。

Stage 4.5 的成功标准不是“把更多资料搬进 OS”，而是：

> **让 ChatGPT 能安全读取正式 Evidence / Claim / Thesis / Expression / Portfolio，并始终知道它与 Notion research context、Drive raw source、Web public evidence 的 authority 差异。**
