# BSE holiday archive supplement V2

通过 D1C 已保存的官方 header 导航进入“北交所公告”和“本所动态”，实际请求两页及其脚本。`news-index` 明确 `searchNodeId=1289`；`news-js` 明确 POST `/info/listse.do` 的分页、关键词、字段列表及 nodeIds 参数。未猜任何公告编号。

使用标题关键词“部分节假日休市安排”获得 firstPage/lastPage、totalPages=1、totalElements=5 的真实官方结果，覆盖 **2022、2023、2024、2025、2026** 五年年度公告；全部链接的完整 HTML 均成功保存。10 次实际请求全部 HTTP 200，无失败抓取。该补充只覆盖 V1 当时的“2022–2024 直接官方 URL 尚未恢复”结论；保留 V1 原始证据和历史记录。

新恢复的官方公告是：

- 2022：[200011381](https://www.bse.cn/important_news/200011381.html)
- 2023：[200014364](https://www.bse.cn/important_news/200014364.html)
- 2024：[200020235](https://www.bse.cn/important_news/200020235.html)

`evidence.v2.json` 保留全部 capture provenance、年度标题、原目录无时区 publication 文字以及各假期原 HTML byte locators。五年年度公告检索已闭合，**完整 official trading-day targetCount 仍 UNKNOWN**：2021 开市至年底 session 证明、每个 session 与临时休市/修订完整性、冻结的 literal ISO calendar locator 门禁均未闭合。不按 weekday 补日历，不把公告发布日期作为市场统计 release。

`python research-data/market-regime/source-catalog/r2-e/bse/supplement-v2/replay.py build` 与 `validate` 已执行 PASS，完整重放 10 个原响应、真实一页结果及五个被链接公告。此补充不增加任何日频数值候选、formal observation 或 strict PIT。
