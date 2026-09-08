# R2-A 合同审查修复记录 V1

本次修复从已审查 HEAD `1ac8b518f008d859db260e903340ddc83e439fff` 继续，保持分支 `feat/stage-4-1-r2a-historical-dataset-contract-core-v1`；实际原始 base 为 `origin/main @ 4f309255d8bea776846d4b6443ae29d25ce95397`。

Source of Truth 仍为 [R2 Scope Freeze V1](observation-catalog-r2-scope-freeze-v1.md)。本文记录四项 blocker 的代码修复与离线验证，独立复审仍待完成。[初次实现记录](historical-dataset-r2a-core-v1.md)及其 v1 fixture/plan 均保留原样，不回写历史验收。当前 R2 envelope/plan schemaVersion 为 `1.1.0`，新 sample planVersion 为 `2.0.0`；旧的仅布尔声明完整的输入不能直接通过新版合同，也没有自动补证据或静默迁移。

## 四项修复

| blocker | 当前合同与 fail-closed 行为 |
| --- | --- |
| Structured locator | 保留 UTF-8 byte/text locator，新增 `STRUCTURED_CELL` union 分支：raw artifact ID/SHA、XLS_OLE/XLSX/DOCX_TABLE、sheet/table/row/column/cell、rowSpan/columnSpan、OOXML part、parserVersion、原文。验证 MIME、magic/container、路径、A1 与行列一致性、格式边界。行列从 1 开始，cell 为矩形左上角；span 可涵盖原始表头、单位和数值。正式内容重放必须传入匹配版本的 `StructuredLocatorReplayer`，否则 `STRUCTURED_LOCATOR_REPLAYER_REQUIRED`。replayer 必须核对真实 sheet/table、合并单元格和原文，拒绝歧义、无缓存公式及外部链接，不计算公式、不执行宏、不合成标签。未实现正式 Office parser。 |
| Evidence graph | 独立 `evidenceArtifacts` 保存 ARCHIVE_INDEX / CALENDAR / INVENTORY，不携带 release clock，binding 的 releaseEventId 必须为 null。landing/attachment 仍是 R1 event artifact，角色由 release 的显式引用决定；其 source/publication/availability/confidence 与 event 强绑定。`indexEvidence` 绑定 index 原始 bytes 中唯一 landing 链接条目；publication fallback 必须使用同一条目，不能引用另一条目或含多个链接的整页。attachment 必须由 landing 的真实 href 解析到对应 artifact URL。 |
| Inventory / revision proof | 外部 plan 冻结 pageTargets、revisionPageTargets、页码/URL/页面标记、候选 URL pattern、两个 stopRule。每个实际 page 绑定独立 index artifact、原网络 SUCCESS、页码证据、候选 entry、下一页 href；validator 从完整留存 HTML 重新枚举匹配链接，拒绝未登记链接和未协调候选。complete 必须精确覆盖 plan 中所有页和末页停止证据；revision scan 同样逐页证明并包含窗口内所有已知 release/revision。布尔 true 不能代替任何关联。 |
| Cache verification | `CACHE_VERIFIED` 保存本次 attemptedAt/verifiedAt，并用 acquisitionAttemptId 引用保留的原网络 SUCCESS。缓存记录 httpStatus 必须为 null，不冒充新 HTTP 响应。source/URL/完整 bytes 与原 acquisition 一致，verifiedAt ≥ 本次 attemptedAt ≥ 原获取时间；原 artifact.fetchedAt 和 acquisition 记录保留。缓存不能替代或自指原获取证据。 |

CLI 未提供 `--generated-at` 时复用既有 `utc_now_iso()`。显式 synthetic npm build 固定 `2026-09-08T00:00:00Z`；HISTORICAL 默认使用本次构建的 UTC 时间。sealed 输出仍禁止不同 bytes 覆盖；需要确定性重放时显式传入已记录的构建时间。

## 对象图、identity 与 hash

```text
外部 plan registry ── page/revision targets + stop rules ─────┐
                                                            ▼
原网络 SUCCESS ── bytes/fetchedAt ── independent evidence ── scan proof
      ▲                              index / calendar / inventory
      └── CACHE_VERIFIED 引用                  │
          本次 verifiedAt                      └── index entry
                                                     │
                                                     ▼
R1 catalog event artifacts ◀── release event ── landing → attachment
       │                              │
       └── field extraction/locator ──┴── coverage ledger → R2 manifest
```

Plan identity 算法保持不变：`planName:v<planVersion>:SHA256(canonical_order(plan excluding planId))`。页目标、修订扫描、stop rule 都进入 plan identity；manifest 仍须引用真实、唯一、匹配内容的外部 registry 条目。

当前 synthetic planId：

```text
r2a-offline-protocol:v2.0.0:adf1a8b2b23fb9e14c97267f79a36a2125d31773c6231ce54a6e83691358a4c9
```

新增 independent evidence ID 投影为 `sourceId + sourceUrl + fetchedAt + sha256 + evidenceRole`。原 release identity 和包含 releaseEventId 的 event artifact identity 不变；相同 bytes 仍可属于多个官方 release event。

Dataset canonical projection 保持显式、无自引用：manifest 的 schemaVersion、datasetVersion、planId、planContentSha256、datasetAsOf、targetWindows、catalogContentSha256，加八个 sidecar 的完整内容。新增 evidenceArtifacts、扫描证据、structured locator 和缓存 verifiedAt 都参与业务 hash。generatedAt、自身 datasetContentSha256、派生 sidecar hashes/summary/admission/validation 仍排除，并独立重算派生字段。

新 synthetic sample business hash：`851c81e5e2a0f9f7037f64e6ac88a9abb27028c3b0de854d6ca069b496bb2366`。它含 5 个 release/event artifact view、3 个独立 evidence artifact、9 条 retrieval；正式 availableCount 仍为 0，admission 为 SYNTHETIC_ONLY，dataset coverage 为 PARTIAL。冻结 target grid 的月度 3 格/日频 2 格没有缩减，不补 0。

## 新增测试与全部门禁

新增 `test_market_regime_historical_blockers.py` 的 20 个独立测试方法，含参数化 adversarial cases：

- XLS/OLE、XLSX、DOCX table 定位正例；零/越界坐标、错误 A1、混用 sheet/table、span 越界、不安全/缺失 part、错误 MIME/magic/digest、混合 locator/未知字段；无 replayer、错误版本、自报原文不匹配。
- 独立 index/calendar/inventory 不需要 release clock；index publication fallback、跨源/缺链接/整页混绑、独立证据冒充 landing 或 event binding；完整 index → landing → attachment 正例及错误链接。
- plan 两页而只留一页且自报 complete 必须拒绝；诚实 partial 保留；两页与两次获取、末页证据齐备才 PASS；伪页码/URL/获取、复用第一页、错误停止条件、漏掉实际 HTML 候选链接。
- revisionComplete 只有布尔为 true、缺 page/stop、漏已知 revision、误用 inventory stop 均拒绝；完整 revision proof 正例通过。
- cache 新验证时钟与原获取共存；缺失/自指 acquisition、伪 HTTP 200、时间倒退、URL/bytes 漂移、删原网络记录、改 fetchedAt 均拒绝；HISTORICAL CLI 默认当前 UTC 与显式固定时间分别验证。

| 命令 / 验收 | 本次结果 |
| --- | --- |
| `npm run test:market-regime:historical` | PASS，66 tests（原 46 + 新 20），CORE-1～CORE-6 全部通过 |
| `npm run data:build:market-regime:historical` | PASS，显式固定时间，新 v2 fixture，SYNTHETIC_ONLY；同路径相同 bytes 幂等 |
| `npm run data:validate:market-regime:historical` | PASS，本地 bytes / 对象图 / plan / hash / coverage 全部重算 |
| JSON Schema metaschema + 仓库已固定 jsonschema 4.25.1 隔离验证 | PASS，66 tests；标准环境为既有 jsonschema 4.26.0，未改依赖 |
| `npm run test:market-regime:catalog` | PASS，原 48 tests |
| `npm run data:build:market-regime:catalog` | PASS，8 observations / 5 artifacts，原 hash 不变 |
| `npm run data:validate:market-regime:catalog` | PASS，verify-artifacts，0 errors |
| `npm test` | PASS，39 suites / 597 tests |
| `npm run build` | PASS，TypeScript / Local Core typecheck / Vite / financial bundle gate；既有 chunk >500 kB warning |
| `npm run env:check` | READY WITH WARNINGS，43 PASS / 15 WARN / 0 FAIL / 4 SKIP，exit 0 |
| `git diff --check` / staged diff check | PASS |

R1 schema、代码、48 tests、sample 均未修改。R1 content hash 仍为 `b7f9802eb46d44088adb75471c190af4c9b48d471a8865ef3b531d4c6b3bfec6`。R1 重建产生的纯换行工作区状态经确认无内容 diff 后恢复。Scope Freeze、旧 R2 v1 sample/plan/审计、contracts/v1、local-core 和业务前端保持不变。

env WARN 涉及多 runtime、既有未固定 Python 依赖/pip check、四个缺失的 project-local skill copies、提交前 dirty tree、ignore 提示、gh 登录探测不可用、旧生成物与公告 partial。没有调整环境或测试配置消除警告。当前 sibling worktree 标准 npm test 直接通过；历史 nested-worktree discovery 问题未在本目录复现，也未宣称已经修复。

## 修改文件与边界

- `config/market-regime/historical-dataset.schema.json`
- `config/market-regime/historical-dataset-plans.sample.v2.json`
- `scripts/market_regime/historical.py`
- `scripts/market_regime/historical_models.py`
- `scripts/market_regime/historical_validator.py`
- `scripts/market_regime/historical_locators.py`
- `scripts/market_regime/historical_cli.py`
- `scripts/tests/market_regime_historical_fixture.py`
- `scripts/tests/test_market_regime_historical.py`
- `scripts/tests/test_market_regime_historical_blockers.py`
- `scripts/tests/fixtures/market_regime/r2a-input.sample.v2.json`
- `scripts/tests/fixtures/market_regime/r2a-dataset.sample.v2.json`
- `scripts/tests/fixtures/market_regime/r2a-synthetic-calendar.v2.html`
- `scripts/tests/fixtures/market_regime/r2a-synthetic-index-test_m2.v2.html`
- `scripts/tests/fixtures/market_regime/r2a-synthetic-index-test_exchange.v2.html`
- `package.json`：更新既有三个显式 offline commands
- 本修复记录

当前修复没有剩余已复现的实现失败，四项 blocker 等待独立复审确认关闭。核心验证的是已冻结 plan 与存档证据的一致性，不能自行证明真实官方索引穷尽性或源定义正确性；正式 plan、源扫描规则及 Office replayer 仍须后续获授权切片独立审计。未实现 R2-B/C/D、正式 Office parser、全量历史抓取、normalization/backtest/Engine/UI。普通 commit + push 后停止，不创建 PR、不合并 main。
