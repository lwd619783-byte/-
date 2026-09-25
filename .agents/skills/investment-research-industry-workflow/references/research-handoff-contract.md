# Research Handoff Contract

面向 ChatGPT 网页端高级模型的证据交接，不面向普通读者。Structured first、prose minimal；不重复行业叙事，不把原文再摘要成另一篇报告。沿用 Notion Research Memory、Drive L0 与既有公司页/档案，无新增系统、runtime 或 dependency。

## 父页与状态

在已唯一匹配的研究档案下创建/复用 `Research Handoff｜<行业>｜<as-of>`。父页仅放 Industry、As-of/时区、Wiki baseline 与 Drive L0 链接、公司样本、Wiki Maturity、L0 Gate、V2 Gate、Handoff Readiness、实际覆盖范围、关键缺口、A—E 五子页索引及末尾 Writing Brief。不复制五子页或主 Wiki 内容。

Wiki Maturity（V0/V1/V1.1/V1.2/V2/V3）、Evidence/L0 Gate（PASS/GAP/BLOCKED）、Handoff Readiness（NOT_READY/READY_WITH_GAPS/READY_FOR_CHATGPT_SYNTHESIS）是独立轴。另列 V3 是否开始、AI Draft/人工审核、OS Promotion。生成并回读完以前不标 READY；缺口可解释且足以交接时用 READY_WITH_GAPS。L0 GAP 可以阻断 V2，不允许把已完成的公司验证回退为 V1.1。Writer 判定最终 Wiki maturity，Codex 只更正明确错误状态。

## A. Evidence Ledger

筛选会影响判断、被 Writer 引用或推理的重要证据，使用稳定 evidenceId，不倾倒所有财报数值。每条必填下列字段；确实未披露填 unknown/null 与原因，不猜页码/日期或填零：

| 字段 | 约束 |
| --- | --- |
| evidenceId / impactedModules / topic | 稳定 ID；M0—M13 用既有 taxonomy；具体主题 |
| claim / fact / evidenceType | 单一可检验事实；类型只能 official_actual、management_guidance、third_party_research、derived_calculation、AI_inference、conflict_or_unknown |
| publisher/company / sourceTitle | 区分披露主体、资料作者与转引者 |
| publicationDate / reportingOrObservationPeriod | 发布与报告/观察期分开；预测还须注明预测期 |
| currency/unit / basis | 币种/数量单位；GAAP/adjusted/non-GAAP/segment；集团与分部边界 |
| locator / officialURL / driveL0URL | 准确页码或可直接定位的章节/表格；原始正式链接；无 Drive 原件明确空及原因 |
| confidence / limitation | 核验方式、适用范围、冲突/未知；管理层自述不充作独立验证 |

派生项保留输入 evidenceId/来源与公式；推断列假设。官方机构预测明确预测，不能归 official_actual。网页无官方 PDF 只保留正式身份/URL，不伪造原件。共享来源索引可以减少重复，但每条必须能直接解析以上字段并定位原件。

## B. Company Fact Matrix

每家公司统一 20 字段，事实加极短限制，字段旁绑定 A evidenceId 或原始来源/定位：

1. ecosystem/control point
2. target business exposure
3. demand/order
4. backlog/SRA/order quality
5. delivery
6. revenue
7. gross margin / operating margin
8. OCF
9. capex
10. FCF definition/value
11. working capital / prepayments
12. customer concentration
13. capacity expansion
14. product commercialization
15. major accounting adjustments
16. share count / dilution
17. valuation dataset status
18. strongest supporting evidence
19. strongest counter-evidence
20. unknown/not disclosed

完整财报/关键附注支持需求→订单→交付→收入→毛利→OCF→FCF/ROIC，以及研发/产品→验证→商业化→收入→利润。缺环节明示，订单/产能/发布产品不等于收入。跨公司利润指标不兼容时不排名。名单依据生态位；转换既有 Pilot 时复用其已验证样本，不为模板再研究新公司。

## C. Delta & Conflict Register

每行：旧 Wiki 判断和 baseline 定位 → 新证据/evidenceId → reinforced/weakened/falsified/new/unchanged/unresolved → 影响模块 → 限制/Writer 待处理问题。baseline 已纳入该证据时注明“unchanged，本轮仅重组”，不伪装新增研究。

另列跨来源/公司冲突：双方证据、日期/口径差异、已能解释与尚不能解释的部分、所需验证。不要自动调和无证据支持的矛盾；公司市场地位自述与独立份额缺失分别保留。

## D. Valuation & Scenario Dataset

每家公司：common price date/时区；ticker/exchange/currency/price；财年定义和 FY1/FY2；可靠收入/EPS 预期及 GAAP/adjusted basis；基本/稀释股数及期间；可靠市值/EV及桥接；OCF/capex/FCF定义/期间；consensus source/date/revision availability；corporate action；valuation blockers。管理层指引与一致预期分列，缺失 null，不由 AI 补数。价格权益与盈利范围未桥接时禁止有效 P/E 排名；精确 EV/ROIC缺失保留。

每个下行情景：parameter、formula、assumption source（证据或明确研究假设）、affected ecosystem、calculated result、limitation。列输入期次/单位，按公式复算；机械敏感性不是盈利预测，不能给股票排名或最终投资结论。

## E. L0 Manifest & Gaps

引用已有权威原件台账，不复制/重传原件。汇总 total files、distinct reports、verified hashes、company grouping、duplicate-format relations、missing originals、download/upload failure 和影响 gate。每文件完整 source/date/identity/bytes/SHA-256/回读状态从既有台账可达；文件数与报告数不能混算。

未知 hash、失败上传、只读过网页但没有原始字节分别明示。已登记缺口沿用，不在交接轮次再次要求用户下载，不把 READY_WITH_GAPS 写成全部归档。

## Writing Brief 与验收

父页末尾只给七条简短答案：值得文章解释的 5—10 个核心问题；强证据结论；必须弱写/留空处；各公司生态位验证角色；值得展开的矛盾；建议重读的原文页/节；不必重复研究的内容。只指导 Writer，不写最终答案。

回读父页、五子页、主 Wiki 状态和档案 gate；确认字段/来源解析、重要计算、缺口与三个状态轴一致。对照主 Wiki baseline，除明确状态纠正外正文不变；保留历史证据，其他行业不改。交付真实六页链接及 READY 状态，等待 ChatGPT 独立审计和正式 synthesis，OS Promotion 默认未触发。
