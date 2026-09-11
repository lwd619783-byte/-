# R2-E BSE additive evidence V1

结论：**NOT_ADMITTED**。本轮增加规则、日历公告、年度档案和跨年日报候选证据，三字段全窗 formalCount / strictPitCount 均为 0。固定窗口沿用 D1C `2021-11-15..2026-09-04`，datasetAsOf 沿用 `2026-09-07T08:00:00+08:00`。冻结合同只引用 `config/market-regime/bse-source-contract.v1.json`；D1C 与 D2 文件未修改。

## 新证据与其限制

22 次实际请求全部 HTTP 200，无失败抓取；完整原响应合计 2,439,726 bytes，均在本目录 `raw/` 提交，独立 JSON metadata 保留 URL、GET/POST form、实际 UTC attemptedAt、状态、类型、完整 SHA-256 和 byteSize。`.gitattributes` 固定原 bytes，`probe.py replay` 在离线验证全部响应及子资源定位。无凭空编号扫描、无全日期枚举。请求计划 `maxRequests=24`，单次超时 12 秒，单响应上限 2,000,000 bytes。

1. 官方[2021 交易规则](https://www.bse.cn/jygl_list/200010919.html)明确开市规则起点；[2026 替代规则](https://www.bse.cn/jygl_list/200028217.html)明确一般生效日为 2026-07-06，并单列延后施行条款。新规则不能追溯解释全部历史日报，亦不能把延后条款当成已生效。
2. 两版规则的 2.3.1 说明通常交易周与休市例外。2025、2026 官方年度休市公告新增 13 段完整原 HTML 日期证据。它们没有枚举每个 session，也未证明全窗临时休市与修订穷尽性；没有按 weekday 计算分母，现有 R2 literal ISO locator gate 未被放宽。
3. 两版规则 3.6.8 明确大宗成交量在大宗交易结束后计入该证券当日成交总量；这是成交**量**的法定处理证据，尚不足以将网页代码 `2` 的 `hqcjje` 解释成覆盖所有交易方式的成交**金额**。因此 turnoverValue 专属 blocker 保留。
4. 5.1.1 要求及时编制/公布市场报表，但没有给每个历史日报可定位的真实发布时间、first-release 或 revision archive。法规发布时间、年度公告时间和每日统计 release 继续分离。
5. 沿官网年度页面和每日统计脚本的真实参数调用 `info/listse.do` 与 `neeqController/getSpecialList.do`。年度目录明确只有 1 个 2021 DOCX；专题目录明确只有 5 个 2021–2025 PDF，两个目录均 firstPage/lastPage、totalPages=1，已抓取所有返回附件。该完整性只适用于这两个实际目录响应，不能外推所有官网档案或所有日频数据。
6. 目录含无时区 `publishDate`。2021–2024 PDF 的上传路径含 2025-09，但这不是可替代的真实发布时间或 revision time。目录时间本身没有绑定当年首次发布的附件 bytes，故不填 `releaseAvailableAt`、firstRelease 或 revisionSequence。
7. 2021 PDF 第 1 页明确全年发行和交易包含开市前精选层数据；2022–2024 PDF 再次保留该注释。2025 PDF 的“历史数据已追溯调整”仅修饰股票再融资（含股权激励增发），不得污染本票三字段的 revision 归因。PDF 只做文本审计；未宣称视觉布局校验，文本定位不是 R2 原 bytes field extraction。年度/月度数值均未拆成日频候选。

## Calendar / field / PIT matrix

官方完整交易日 targetCount：**UNKNOWN / null**。缺口为：开市后 2021 剩余窗口缺完整 session 证明；2022–2024 年度公告直接官方 URL 尚未由本轮限定搜索恢复；2025–2026 已有公告仍缺每个 session 与例外/修订完整性证明，R2 literal ISO 定位要求仍不满足。搜索未恢复不等于官方不存在。

| 字段 | 映射证据 | 历史 era 适用 | PIT / formal | 专属未闭合问题 |
| --- | --- | --- | --- | --- |
| turnoverValue | `hqcjje` / 元 / 网页选择 `2` | 未证明；规则一般生效边界已补证 | 0 / 0 | 大宗及各交易方式是否全部包含在该金额字段 |
| totalMarketCap | `zsz` / 元 / 网页总市值标签 | 未证明每日收盘时点与证券范围 | 0 / 0 | 无额外 free-float / trade-mode blocker |
| negotiableMarketCap | `ltsz` / 元 / 网页流通市值标签 | 未证明每日历史范围与定义适用 | 0 / 0 | 不能等同指数 free-float |

所有字段共同保留 calendar、连续历史、field scope/era、market release、first-release/revision archive 门禁。每个字段的未准入窗口均为整个 `2021-11-15..2026-09-04`。规则背景分段为 `2021-11-15..2026-07-05` 与 `2026-07-06..2026-09-04`；前段中间修订穷尽性未证明，后段延后条款不自动生效，两个分段都不是准入的 SourceDefinitionVersion。

## Candidate 计数与重放

| 计数 | 值 |
| --- | ---: |
| D1C 原候选字段数 | 24 |
| 本轮新增 capture 中候选字段数 | 18 |
| 两轮 capture 候选合计 | 42 |
| 按 tradeDate × field 去重后的候选数 | 39 |
| 去重后的候选日期 | 13 |
| formalCount | 0 |
| strictPitCount | 0 |

新 probes 为 `2022-12-30`、`2023-12-29`、`2024-12-31`、`2025-12-31`、`2026-07-06`、`2026-09-04`。前四日来自年度目录的日期文字，第五日来自规则生效日，第六日是 D1C 重抓对照；这些选择都不预先声明交易日。所有真实响应均回显请求日期，经原 D1C parser 输出候选。与 D1C 重叠的 2026-09-04 三字段数值相同，只证明两次观察一致，不证明首次发布、无中间修订或历史 PIT。

`evidence.v1.json` business hash 为 `e34ce287bf2a5282ae8f99c63c33697e18fbe61a01083a163f237f35aeec9e8b`。`derive.py` 从完整原 bytes、冻结 D1C parser 和旧 inventory 独立重建；不能只改候选/计数/门禁并重封 hash 来提升准入。

## 实际验证

- `python research-data/market-regime/source-catalog/r2-e/bse/probe.py replay`：PASS，22/22 全 bytes。
- `python research-data/market-regime/source-catalog/r2-e/bse/derive.py build` 和 `validate`：PASS，18 新 capture 候选，formal/strict 0。
- `python research-data/market-regime/source-catalog/r2-e/bse/pdf_replay.py build` 和 `validate`：PASS，5 份 PDF 的页文本核验；使用已存在的 pypdf，无依赖安装。
- `python research-data/market-regime/source-catalog/r2-e/bse/test_evidence.py`：PASS，5 tests，含 raw byte 篡改、重复日期计数、naive publication、字段 blocker 隔离和全窗 fail-closed。
- `npm run test:market-regime:bse`：PASS，25 tests。
- `npm run data:validate:market-regime:bse:compact`：PASS，原 D1C hash 不变。
- `npm run data:validate:market-regime:bse`：PASS，原 D1C ignored raw 在当前工作区可用，完整重放通过。

NOT_RUN / BLOCKED：全日频枚举、正式 observation expansion 仍由上述 calendar / definition / daily release 门禁阻塞。没有把停止扩展包装成 HTTP 失败，也没有把少数跨年 probes 宣称为连续历史。没有任何 NOT_ADMITTED → ADMITTED/PARTIAL 的 formal 状态提升。

## 搜索范围记录

本轮公开搜索覆盖交易规则、交易日定义、统计指标解释、2022/2023/2024/2025 年度休市公告，以及成交金额/大宗统计关系。已直接命中的官方 URL 全部列入 request-plan。2022–2024 公告出现第三方转载线索，未作为官方 denominator 使用，也未由转载中的描述猜原 URL。原 D1C header 还指向 `/disclosure/vocational.html` 与 `/news/important_news.html`，它们可供独立 Calendar workstream 后续核验；本版本不声称穷尽未调用目录。
