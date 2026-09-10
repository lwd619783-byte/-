# R2-E SSE evidence V1

本目录为版本化 discovery / candidate evidence，**三个字段均 NOT_ADMITTED；formalCount=0、strictPitCount=0**。不修改 D1A/D2 合同、旧 inventory 或准入结论。冻结截止日仍为 2026-09-04，datasetAsOf 仍为 2026-09-07T08:00:00+08:00。

## 实际证据与新增发现

- 51 次受控官方获取均 HTTP 200：7 份 HTML/JS，40 个两套日频接口响应，4 份年鉴 PDF。每次的 URL、实际 acquisition timestamp、原始 bytes SHA-256 / size / 相对路径见 `*.metadata.json`。
- 当前[每日概况页](https://www.sse.com.cn/market/stockdata/overview/day/)明确链接“2021年12月24日之前”的旧历史入口。两套官方页面直接引用的脚本继续提供 D1A 冻结 sqlId / 字段映射。本轮连续请求 2021-12-20..2022-01-07 **每一个自然日期**，每日期分别请求两套 family；另重新获取 2005-01-04 两 family。日期仅为公开接口受控参数，不推断为交易日。
- 断点处 legacy 12 月 24 日仍有候选，12 月 27 日起在本次网格内为空；daily 在 12 月 24 日为空，12 月 27 日起出现候选。它闭合了先前未验证的局部接口迁移行为，并未证明最早/最晚完整边界或 historical vintage。旧 script cutoff claim 保持原样。
- 本轮 87 个板块×字段×请求候选，三个字段各 29。40 请求中 15 个有候选，25 个为空。与 D1A 的 42 候选相比，9 个日期/板块/字段键为重复获取；合并只按 discovery key 计为 120。此去重只用于 inventory 计数，不选择事实版本，不产生 observation。
- [官方年鉴索引](https://www.sse.com.cn/aboutus/publication/yearly/)直接链接的 2006、2013、2022、2023 卷完整 PDF 已归档。本出版物指标定义及统计年份得到进一步核实：2013 卷明确 2012 年，2022 卷明确 2021 年，2023 卷明确 2022 年。2023 卷改称总股本 / 总市值 / 非限售股本 / 非限售市值；这不证明日频 API 在某日自动采用同口径。
- 2006 卷指标页实际写“统计日期：2003 年”，同卷全年概貌却列 2005 年；已人工查看 PDFium 渲染确认真实矛盾。未修正文档，未用刊名年份推断定义适用年份。
- 年鉴表内 SSE 交易天数 2005=242、2012=243、2021=243、2022=242 仅作交叉证据，不能替代逐日官方 calendar 或跨所共同目标分母。完整 SSE targetCount 仍 UNKNOWN。
- [月报索引](https://www.sse.com.cn/aboutus/publication/monthly/documents/)“每月15日披露”仅为排期，不能创建每一期实际 release event，更不能代替日频市场 release。API 数据日期、HTTP Date、抓取时间、脚本更新时间均未转为 publicationDate / releaseAvailableAt。

## 准入与窗口

`evidence.v1.json` 的 `fieldAdmission`、`definitions`、`release`、`history` 分别给出三个字段和 source era 的证据与不足。所有目标窗口 2005-01-01..2026-09-04 仍未准入，共同 blocker 为完整官方逐日日历、API 字段/币种/收盘口径的历史适用性、actual release / first-release / revision 和连续历史发布档案不足。`negotiableMarketCap` 另外保留 `NEGOTIABLE_VS_FREE_FLOAT_UNPROVEN`；从未把 negotiable / 非限售市值等价为 free-float。

`fieldAdmission.eras` 仅为需要审查的分段 (`REVIEW_PARTITION_NOT_PROVEN_ERA`)。`claimedApiFamily` 是待验证 family，不是整段实证；每段 `familyApplicability` / `definitionApplicability` 都为 `NOT_PROVEN`，`calendarStatus` 为 `UNKNOWN`。2021-12-25/26 的空响应不产生休市判断。有限定点/边界网格不外推为2005..2026任何完整era的定义或source applicability。

本轮有条件对当前公开入口做了有界系统核查，不声称已穷尽全部官方历史文件或修订。未做全目标每日 API 扫描：缺 release/定义/日历证据时更大的数值样本不能获得准入；完整连续历史仍明确未证明。没有 NOT_ADMITTED → ADMITTED/PARTIAL 的正式准入状态转换。

## 重放与归档限制

运行命令：

```text
python -m scripts.market_regime.r2e_sse_probe build-candidates
python -m scripts.market_regime.r2e_sse_probe build-evidence
python -m scripts.market_regime.r2e_sse_probe replay --compact
python -m scripts.market_regime.r2e_sse_probe replay
npm run test:market-regime:sse
npm run data:validate:market-regime:sse:compact
python -m unittest discover -s research-data/market-regime/source-catalog/r2-e/sse -p test_r2e_sse_review.py
```

实测 compact / full replay 均 PASS；SSE 专项 22 tests PASS；旧 D1A compact validator PASS，旧 formal=0。候选由既有 `parse_daily` 原样解析，重放逐条比对；HTML locator 按原始 byte offset/length 重放；full 模式另对 PDF 指标/年表衍生页重新执行 pypdf 提取并逐页比较。

大 PDF 原始 bytes 保存在 ignored `research-data/market-regime/raw/r2-e-sse/`，其 metadata 和明确标识为派生的 `annual-*.excerpts.json` 提交。**clean clone 的四份 PDF 原始重放为 NOT_RUN_RAW_NOT_DISTRIBUTED**；compact 模式显式输出这四项 `rawReplayNotRun`，不把衍生页当作原始 PDF。当前本机完整 PDF replay 已成功。HTML/JS/JSON `.body` 原始 bytes 为小型提交证据，由集成阶段设置 scoped `-text` 保留换行。

输出使用 sealed identical-only writer：已存在文件只接受完全相同bytes的重跑，变化会报 `SEALED_ARTIFACT_CHANGED`。未来衍生产物须显式 `--version 2`（候选、evidence与replay使用同版本），不能覆盖V1。当前51项metadata的canonical集合hash独立固定在probe代码中，包含URL/final URL、实际acquisition时间、bytes hash/size/path；同时篡改metadata和inventory不能自行重新封存通过。新acquisition batch需要独立审查后更新代码pin；Integration仍应独立固定整个输入产物的hash，以防连同代码pin一起改写以及覆盖未由compact认证的PDF衍生摘要。这些pins证明提交数据的完整性，不独立证明官方服务器的历史发布身份。
