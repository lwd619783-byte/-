# Stage 4.1 R2-D1B — SZSE 交付报告 V1

结果：**PARTIAL；SZSE 独立 source contract、bounded inventory、严格 parser 和 fail-closed adapter V1 已实现。正式 observation / strict PIT coverage 均为 0，没有已准入历史子窗口。**

开工首先执行 `git fetch origin --prune`，确认仓库 `lwd619783-byte/-` 的 `origin/main` 精确为 `9b8924daaadc498d704156952e14c89c36dc0cbd`，工作树干净；从该点创建 `codex/stage-4-1-r2-d1b-szse`。不修改 SSE/R2-A/PBC/CSRC 及 normalization、backtest、UI；不创建 PR、不合并、不开始 BSE/D2/all-A。

## 结果的五个层次

| 层次 | 已证明的结果 |
| --- | --- |
| source discovered | 两套 SZSE 官方页面/API family，官方资源加载器和请求参数链；26 个冻结请求及原始获取记录 |
| parser works | `1803_sczm` 独立 parser，通过官方响应和对抗 fixture；第二 family 仅证据、不产出候选 |
| candidate available | 6 个离散日期、45 个板块/字段候选；每字段 15 个，其中每字段 10 个来自显式 A 标签，另 5 个保留 A membership 未证明；不是历史覆盖率 |
| formal coverage | 三字段分别为 **0**，exchangeMarketObservations / releaseEvents / fieldExtractions 全空 |
| strict PIT coverage | 三字段分别为 **0**；完整交易日分母 null；只有 2020-01-31..02-03 的 source calendar 子窗口有 1 个明确开市日，仍不准入 R2 |

来源、字段/板块矩阵、定点响应、日历修订、源断点和 replay 规则见 [SZSE source contract](szse-historical-source-contract-r2d1b-v1.md)。机器证据在 `research-data/market-regime/source-catalog/szse-d1b/inventory.v1.json`；原始 bytes + metadata 留在 ignored raw 目录。

## 验证

显式命令：

```text
npm run data:fetch:market-regime:szse
npm run data:build:market-regime:szse
npm run data:validate:market-regime:szse
npm run data:validate:market-regime:szse:compact
npm run test:market-regime:szse
```

本轮实际获取于 2026-09-09，显式 fetch 复核全部 26 份缓存；没有更新原 fetchedAt。full validate 逐份核验本地完整 bytes 及官方调用链；重复 build 幂等。固定输入 business hash 为 `e34a6514e49ee5f59236d8a256761978fbddb697a3a68f52eee03957b362ed7c`。

| 门禁 | 结果 |
| --- | --- |
| SZSE 专项 tests | PASS，37 tests；scope 混合、板块重复/历史断点、字段缺失/替代、无 release、日历/节假日、fixture/current-only、重复冲突、malformed/family/date/pagination、locator、重 seal 篡改、mock acquisition/cache/503 bytes |
| SZSE fetch/build/full validate/compact | PASS；validation 不构成 admission |
| historical R2 | PASS，66 tests，相关 CORE-1..6 与 locator/calendar/identity/coverage 约束保持 |
| SSE | PASS，22 tests |
| PBC | PASS，69 tests |
| 全部 CSRC，`test_market_regime_csrc*.py` | PASS，183 tests |
| catalog | PASS，48 tests |
| `npm run build` | PASS，TypeScript/Local Core/Vite/browser boundary/bundle gate；既有 >500 kB chunk warning |
| `npm run data:audit` | PASS，errors 0 / warnings 24；生成的历史审计文件时间/扫描数/行号变化经检查后恢复 |
| `npm run env:check` | READY WITH WARNINGS：48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `npm run --silent env:check:json` | READY WITH WARNINGS：48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| 标准 `npm test` | FAIL，仅两个已知 nested-worktree discovery 的 `No test suite found`；101 suites / 1661 tests PASS |
| `npm test -- --exclude 'data-cache/**'` | PASS，主仓 39 suites / 597 tests；未修改 discovery 规则 |
| `git diff --check` | PASS |

标准测试失败路径分别为 `data-cache/worktrees/stage-4-1-r2/scripts/tests/company-guidance-expectations.test.mjs` 和 `data-cache/worktrees/v2-phase1/scripts/tests/company-guidance-expectations.test.mjs`。不将主仓排除验证替代标准 gate，也不声称修复旧 discovery 问题。

环境 warnings 仍包括多 runtime 路径、未固定 Python 依赖、现有 mootdx/httpx 依赖不匹配、ignore 提示、旧生成物与公告 partial 等。未升级依赖或修改环境治理。

独立子任务编写对抗测试并审查 compact 校验，发现重 seal 后篡改 binding.contentValidation 可通过的实现缺口；现已改为从 parser 结果重新推导 parseStatus/error/contentValidation，并检查 binding 自身 artifact、locator 范围及 JSON prefix。新增反例已通过。全部修改仅在 SZSE 文件内。

## 保留的 blockers

1. **连续日频历史未证明**：primary family 在 2005-01-04 空表；6 个离散候选日期不是完整窗口。最早历史界限、断点相邻日、revision 穷尽都未知。
2. **完整官方 calendar 未证明**：只有明确春节修订窗口；不使用 weekday、其他交易所日历或成功响应反推分母。
3. **R2 calendar locator 不兼容**：真实公告为中文并夹杂 HTML 标签，缺规范化 ISO 日期字面；共享 validator 未放宽。
4. **逐字段跨期适用未证明**：成交额范围、收盘总市值、流通市值定义/币种适用均需独立证据；中小板及旧创业板无显式 A 标签的行另保留 A membership blocker。
5. **negotiable/free-float 未闭合**：月报术语只支持自身报表，不证明 daily API 的历史定义或 free-float 等价关系。
6. **市场统计 release/PIT 未证明**：没有官方 release clock、first-release 或完整 revision archive。不得将任何请求/交易/获取/HTTP/公告日期借作市场统计 release。
7. **第二 family 不可替代**：主板混合 A/B、统计含存托凭证、响应缺独立日期且两个市值字段不存在。2005-01-04 / 2021-04-02 请求 `scsj_gprdgk_after` 却返回旧 `scsj_gprdgk`，严格拒绝为 WRONG_SOURCE_FAMILY；已冻结合并前后迁移，不把旧 family、总计或月报填入三字段日频。
8. **raw replay 的交付边界**：fresh checkout 可离线重放 committed 小型 JSON 并验证 compact；完整 HTML/脚本/公告 archive 在 ignored 本地目录。再次获取受网站变化影响，不能宣称旧历史 byte archive 已公开穷尽。

本次实现交付不授予生产数据准入。Git 停止点为普通 commit + push 后核验 local HEAD = remote feature HEAD、相对 origin/main ahead/behind 和干净工作树；最终 SHA 与核验结果在任务最终回复中报告，避免把自引用 commit SHA 写进同一提交。
