# BSE rule locator correction V3

独立终审发现 V1 的 `clause()` 按全页首次子串定位，三个生效/延后条款命中较早的分享链接摘要，再延伸至正文首个空段落。尤其 `DEFERRED_CLAUSES_NOT_ASSUMED_EFFECTIVE` 原定位没有完整延后条款，不能支撑其语义。原 V1、V2 与已提交报告均保留，不回写历史证据。

V3 在已保存且独立固定 SHA-256 的两份官方完整 HTML 中，重新定位 9 项 ruleEvidence 的**唯一完整正文 `<p>…</p>`**；保留原 byteOffset、byteLength、HTML 原文及显式派生的 normalizedText。生效声明同时匹配公告正文前缀、完整日期及例外说明；延后声明同时匹配 3.6.5 第二/三款、3.7.1–3.7.10、4.5.1–4.5.4 和“由本所另行通知”。全页摘要、重复段落和缺失条款均拒绝。

本修正 supersede V1 ruleEvidence 定位；不改变交易日分母、字段时代适用、candidate、formal 或 strict PIT 状态。交易规则的生效日期仍不是每日市场统计 release，延后条款不自动生效。

验证：`python -B research-data/market-regime/source-catalog/r2-e/bse/supplement-v3/replay.py build` / `validate`；`python -B research-data/market-regime/source-catalog/r2-e/bse/supplement-v3/test_replay.py`。
