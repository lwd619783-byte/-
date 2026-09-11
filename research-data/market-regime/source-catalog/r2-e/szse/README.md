# R2-E SZSE evidence / candidate workstream

本目录只新增证据，不改变冻结 D1B、D2 输出或正式 observations。`workstream-report.v1.json` 是本工作流结论；All-A D3 由 Integration 统一生成。

## 新证据

- 官方统计年鉴目录当前列出 1998–2025 共 28 个年鉴链接，全部保存原始 HTML byte locator。2005、2022、2023 三册原始 PDF 已下载，另 25 册明确 `NOT_RUN`。目录连续不等于逐日数据、历史版本或历史可见性连续。
- 2005、2022、2023 年鉴指标说明均为自身报表提供成交单边、单位、总市值等定义证据。2005 数字字体映射存在损坏；可视核验第 11 页的 2005 统计期与说明，未据损坏字符猜数字或生成早期候选。
- 2022 年鉴第 4 页明确总交易日数是 A/B 股交易日数中的较大者。因此年/月报总交易日数不能直接成为 All-A 官方分母。
- SZSE 托管的《证券期货业统计指标标准指引（2025 年修订）》PDF 第 29 页分别定义 A 股流通市值与自由流通市值。它没有证明既有 daily API 的跨期定义或二者等价。
- 2022 年鉴创业板章节的逐日成交额（PDF 第 219 页，印刷页 204）与逐日总市值（PDF 第 223 页，印刷页 208）各提取 242 个候选，共 484 个。两表单位分别为亿元人民币与 10 亿元人民币，保留原文。没有逐日流通市值候选。

六份小型原始 PDF/HTML 在 `raw/`；四份大于 2 MB 的 PDF 位于 ignored `research-data/market-regime/raw/r2-e-szse/`，不提交大型下载物。`acquisition*.v1.json` 记录官方 URL、完整 SHA-256、字节数、实际获取时间及本地 archive 路径。`extractions.v1.json` 是有原始 PDF hash 绑定的派生文字，不冒充原始 byte locator。两张表和 2005 说明已可视审阅，临时 PNG 已清理。

## 准入结论

新 candidateCount **484** / formalCount **0** / strictPitCount **0**；加上未改动 D1B 的 45 个候选，跨独立 source family 合计 **529**。这不是 529 个全深市日频 observations。

两个 All-A era 的 SZSE 完整官方交易日分母仍为 **UNKNOWN**。2022 表内的 242 个有值日期不能反推交易日历，空白不能解释为休市。年度目录的“某年发布”不满足 `DATE_ONLY_SAFE`，也不证明 PDF bytes 的历史 vintage。精确 release、first-release、revision archive、daily API 跨 era 适用、板块标签 A membership 仍未闭合；正式状态保持 `NOT_ADMITTED`。

## 实际验证

- `python -m scripts.market_regime.r2e_szse_probe validate`：PASS，10 份 raw 完整 hash/长度；28 个目录链接 byte locator；13 页文字重放。文字提取固定为本机已有 `pypdf 6.5.0`。
- 使用 Codex bundled Python 运行 `-m scripts.market_regime.r2e_szse_probe replay-candidates`：PASS，484 个 PDF cell 候选逐条重放，12 个月成交额与印刷累计值在明示四舍五入容差内一致，单位、日期、原值、位置和不准入状态校验通过。该命令的文字 sidecar 重放标记 `NOT_RUN_SEPARATE_VALIDATE_COMMAND`，由上一项实际执行补齐；bundled `pypdf 6.10.0` 的输出与 6.5.0 排版有差异，不声称字面相同。
- `npm run test:market-regime:szse`：PASS，37 tests。
- `npm run data:validate:market-regime:szse:compact`：PASS；既有 D1B 仍为 45 candidates / formal 0 / strict PIT 0。
- `python -m scripts.market_regime.r2e_szse_probe validate-compact`：校验 committed bytes、sidecar hashes、candidate counts/身份、原始 HTML locator 与 fail-closed calendar。fresh checkout 缺四份 ignored PDF 时明确 `fullRawReplay=NOT_RUN_MISSING_RAW`，不冒称全文或 PDF cell 已重放；PDF 单元格须运行独立 `replay-candidates`。
- bundled Python `-m unittest discover -s research-data/market-regime/source-catalog/r2-e/szse -p test_evidence.py`：10 tests PASS，包括 count/删除重计数/原始 HTML locator/重 seal 后 PDF 位置篡改、缺 raw、伪正式准入及 max(A,B) 分母污染。
- `build-candidates` 同输入可重复执行，字节完全相同保持原文件；不同内容拒绝覆盖，须使用新版本路径。已封存 fetch 再运行只重放当前证据，不联网改变获取时间。

首次抓取因本地 12 MB 上限产生 runtime failure，随后采用 20 MB 上限完整重跑，正式 manifest 使用重跑的真实获取时间。初次 bundled parser 缺少 `requests`，改为仅获取命令导入；未安装或改动依赖。尝试用 bundled pypdf 重放旧文字时明确失败；现按上述两个 runtime 分别完成文字与候选重放。旧证据没有覆盖或篡改。

此轮没有穷尽其他 25 册 PDF 或官方 revision 全集。它们保留精确 `NOT_RUN` 清单；任何潜在数值不进入 formal coverage。
