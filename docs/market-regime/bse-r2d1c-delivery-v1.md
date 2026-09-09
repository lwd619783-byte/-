# Stage 4.1 R2-D1C — BSE delivery V1

交付结论：BSE 独立 source contract、官方 inventory、strict parser、locator/replay、coverage/admission ledger 和 fail-closed adapter 已实现。**INVENTORY PARTIAL，正式覆盖 0，strict PIT 0，完整官方交易日分母未知**。实现与验证通过不代表生产准入或独立审查通过。

基线：`origin/main @ aa1f5aff6fe1da1246be68376bcc4af9ef6ea8d2`。
分支：`codex/stage-4-1-r2-d1c-bse`。
开工 `git fetch origin --prune` 成功，origin/main 与指定 SHA 相等，工作树干净；核对 9 个已登记 worktree 后，从该 SHA 新建普通分支。未修改其他 worktree。

## 实际证据与覆盖

- 24 次沿官方导航/资源/API或明确官方页面搜索命中的 bounded 请求，全部 HTTP 200，完整原响应合计 411097 bytes；包括一个空日报响应。
- 8 个日期有三字段候选，各字段 candidateDateCount=8，总计 24 candidates；56 个非目标/未证明 scope 行保留 rejected evidence。
- 候选日期为开市日及下一日期、2026 元旦后的官方开市日，以及 `2026-08-31..09-04` 五个相邻日期；不是整个窗口的连续历史证明。
- 官网当前总貌 `2026-09-08` 只作 current-only evidence，不计候选。
- 官方 calendar 只证明两个小窗口中的 2 个开市日期，完整 `2021-11-15..2026-09-04` 分母保持 null，三个字段正式 availableCount/strictPitCount 均 0。
- 既有 pre-launch marker 仍是三字段 null、无 release；未生成正式 exchange observation、release event 或 field extraction。

全部 source chain、字段/era 语义、8 个 blockers、完整与 compact replay 边界见 [BSE source contract](bse-historical-source-contract-r2d1c-v1.md)。blockers 分别为完整官方日历、全窗连续历史、逐字段范围/时代适用、成交方式/大宗范围、市场发布证据、首次发布/修订档案、negotiable/free-float 区分、R2 calendar literal ISO locator 不兼容。

## 验收证据

| Gate | 结果与范围 |
| --- | --- |
| MARKET-1 | PASS fail-closed：只选官方代码 `2` 为未准入候选；不聚合混合响应；字段/单位变更、free-float/数量/换手率替代拒绝 |
| MARKET-2 | PASS：`2021-11-14` 三字段 null、无 release；开市后候选不自动准入；精选层/NEEQ/pre-launch 数字零拼接拒绝 |
| MARKET-4 | PASS fail-closed：calendar 独立；空响应与 weekday 不推分母；请求日期/tradeDate 不充当发布；周/月统计不拆日 |
| CORE-1/2 | PASS：canonical business hash、固定采集锚点、原 bytes/path/size/locator 校验；错误页/JSONP脚本/重复键/分页拒绝；HTTP/transport/read timeout/size bound 留痕 |
| CORE-3/4/5 | PASS：缺市场 release/vintage 不产生 strict 数值；重复/冲突行不按顺序选；structural 不补0；沿用原时间/lineage validator |
| CORE-6 | PASS：完整目标窗口保留，分母未知不变成0，fixture/current-only 不计覆盖；compact 重封不能提升 coverage |

## 命令结果

2026-09-09 在上述工作区执行；Python 专项测试均离线，未安装或升级依赖。

| 命令 | 结果 |
| --- | --- |
| `npm run test:market-regime:bse` | PASS，25 tests；含完整 compact 重放和多组 reseal 对抗 |
| `npm run data:validate:market-regime:bse:compact` | PASS；从 committed 小响应和独立合同/采集锚点重算 |
| `npm run data:build:market-regime:bse` | PASS；sealed V1 幂等，hash 不变 |
| `npm run data:validate:market-regime:bse` | PASS；本机全部 ignored raw/metadata 与 locator 重放 |
| `npm run test:market-regime:historical` | PASS，66 tests |
| `npm run test:market-regime:sse` | PASS，22 tests |
| `npm run test:market-regime:szse` | PASS，37 tests |
| `npm run test:market-regime:pbc` | PASS，69 tests |
| `npm run test:market-regime:csrc-c1` | PASS，183 tests；通配模式包括 recovery、IPO admission/provenance 回归 |
| `npm run test:market-regime:catalog` | PASS，48 tests |
| `npm test` | FAIL，2 nested-worktree suites；101 suites / 1661 tests PASS，exit 1 |
| `npm test -- --exclude 'data-cache/**'` | PASS，主仓 39 suites / 597 tests，exit 0；独立结果，不替代标准 gate |
| `npm run build` | PASS；TypeScript、Local Core typecheck、Vite 与 bundle check；现有大 chunk warning |
| `npm run data:audit` | PASS，301 scanned / 29 registry / 0 errors / 24 warnings，exit 0 |
| `npm run env:check` | READY WITH WARNINGS：47 PASS / 11 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `npm run --silent env:check:json` | READY WITH WARNINGS：47 PASS / 11 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `git diff --check` | PASS |

Python 专项与回归合计 450 tests。标准 Vitest 的失败是现有 `data-cache/worktrees/stage-4-1-r2`、`data-cache/worktrees/v2-phase1` 中 `scripts/tests/company-guidance-expectations.test.mjs` 被扫入后报 `No test suite found`。这两个 worktree 在开工就存在，其文件及主仓 test discovery 命令未修改；本轮没有修复或隐藏标准失败，也没有把排除验证写成标准 PASS。

data audit 生成的历史报告仅有执行时间、扫描数量与既有行号变化，已恢复本轮生成改动，结果单独记录在本文。env warning 未通过修改环境配置消除。

## Git 范围与停止点

改动仅有 BSE contract、captures/inventory、两个 BSE Python 模块、专项测试、10 个小型完整 JSONP fixtures 与 provenance、两份 BSE 文档，以及 package 的五个 BSE commands 和限定 JSONP 的 byte-preserving attribute。

SSE/SZSE 合同/证据、R1 seed、historical schema/validator、normalization/backtest/formula/UI/production admission 均未修改。没有 R2-D2、all-A aggregation、真实生产刷新、PR 或 merge。只执行本分支普通 commit + push；最终提交 SHA、本地/远端 HEAD、最新 origin/main ahead/behind 与工作树状态在任务最终回执核验，避免把自引用 commit SHA 写进本提交。
