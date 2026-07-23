# A 股真实数据 Provider 稳定性准入审计 V2

## 1. 一句话结论

`a-share-financials` 与 `a-share-announcements` 的独立结论均为 **NO_GO**。账本完整性修复后的唯一一次真实隔离运行中，两家 Provider 均成功、56/56 覆盖、结构校验通过、生产数据未变化；但新的 V2 provenance cohort 各只有 1 次运行、1 个 Asia/Shanghai 自然日，未达到 5 个自然日、每家 10 次运行、5 个成功日的硬门槛。修复前 V2 因 observation tool checksum 变化转为 incompatible；旧 V1 记录缺少准入所需 provenance，且其隔离产物重算 checksum 与账本记录不一致，只能作为 legacy 证据保留。

本结论不改变默认刷新：即使未来 Gate 达标，也必须另开独立任务审查默认刷新接入。

## 2. 基线、分支与时间口径

- 审计分支：`feat/provider-default-refresh-admission-v2`
- `main` 基线：`419779e645b3599cbf4b73b825e4dee7ee80c106`
- V2 provenance 代码提交：`cca33f62f19eb83c24a9d0747a73813b790ac7c1`
- 账本完整性修复提交：`68ff5d54bf092d546c88f3ebf489ac9139b373f0`
- 新真实观察日期：2026-07-23（Asia/Shanghai）
- 观察时间记录使用 UTC 精确时刻，跨日统计统一转换到 `Asia/Shanghai`。
- 本地既存 `AGENTS.md` 始终保持未跟踪，未修改、未暂存、未提交。

## 3. 默认 `data:refresh` 与准入之间的缺口

当前默认命令仍为：

```text
npm run data:universe && npm run data:fetch:a-stock && npm run data:fetch:hk && npm run data:fetch:macro && npm run data:validate:a-stock
```

它不包含财务 Provider、公告 Provider 或观察命令。`validate_default_refresh` 和 Data audit 均继续把提前接入视为违规。本轮没有修改 `package.json`、`src/data/data-source-registry.ts` 或任何 `defaultRefreshEligible` 语义。

## 4. Gate 配置审计

`config/provider-stability-gate-v1.json` 未修改，硬门槛如下：

| 门槛 | 要求 |
|---|---:|
| 时区 | Asia/Shanghai |
| 不同自然日 | ≥ 5 |
| 每家 Provider 运行数 | ≥ 10 |
| 每家成功日 | ≥ 5 |
| 公司覆盖 | 56/56 |
| 结构校验率 | 100% |
| complete success rate | ≥ 90% |
| total success rate | ≥ 95% |
| 最新运行 | success |
| 阻断失败 | 0 个未解决 |

V2 没有降低或改写这些数值；Gate 配置仍使用 `schemaVersion=1.0.0`，观察记录升级为 `schemaVersion=2.0.0`，两种版本职责明确分离。

## 5. 本地观察账本边界

完整审计范围包括：

- `.provider-observations/runs/*.json`
- `.provider-observations/provider-health-ledger.jsonl`
- `.provider-observations/provider-health-resolutions.jsonl`（当前不存在，即 0 条）
- `.provider-observations/provider-health-summary.json`
- 每条 run 引用的 `artifacts/<run-id>/generated/`
- 两家 Provider 的隔离 cache

共读取 6 个 run 文件和 6 条 ledger 记录；runId 无重复、无 orphan ledger row、无缺失 ledger row。运行文件与 JSONL 对应行逐对象一致。所有本地观察内容仍由 `.gitignore` 排除。

## 6. 原始账本重算结果

没有信任既有 summary；统计从 run 文件、ledger 行和隔离产物重新计算。旧 V1 两条记录的账本对象一致，但 checksum 证据不一致：

| Provider | V1 runId | 记录 artifact | 重算 artifact | 记录 manifest | 重算 manifest |
|---|---|---|---|---|---|
| financials | `20260712T035210Z-a-share-financials-7a8b6917` | `ef8218ca…23ec6` | `13d432c4…fdb9` | `7ff684e7…7be7` | `f7691bb4…c283` |
| announcements | `20260712T035326Z-a-share-announcements-10d36e4e` | `90494cb5…ffe4` | `8c1339dc…dae` | `eb5ec25b…eda` | `d11a9f5…011` |

旧记录还缺少 `beforeChecksum`、`afterChecksum` 和 `eligibleSample` 的显式值，并在 `command` 中保存本机绝对路径。这些问题不篡改旧账本、不反向补值，只决定其不能进入 V2 准入 cohort。

## 7. V2 provenance 契约

每条新 run 必须记录以下 provenance：

- `sourceCommitSha`
- `observationToolVersion` 与 `observationToolChecksum`
- `providerCodeChecksum`
- `fetchScriptChecksum`
- `validatorChecksum`
- `stockUniverseChecksum` 与 `stockUniverseIdentityCount`
- `gateConfigChecksum`
- `productionBaselineChecksum`
- `dependencyFingerprint`
- `provenanceCohortId`

文件集合固定在 `scripts/provider_observability/provenance.py`。checksum 使用相对仓库根目录的 POSIX 路径和原始字节；股票池 checksum 使用排序后的 `id/code/exchange/market/shouldFetch*` 身份集合，而不是只使用数量；不包含绝对路径、运行时刻或其他易变字段。

`sourceCommitSha` 不参与 cohort hash，但必须严格匹配小写 40 位十六进制 Git SHA。所有 checksum 必须是小写 64 位十六进制，`stockUniverseIdentityCount` 必须是非布尔正整数，工具版本必须与当前正式版本一致。`valid_provenance()` 会仅按固定 `COHORT_FIELDS` 重算 cohort ID，并与存储值做常量时间比较；任何缺失、`unavailable`、格式错误或重算不一致都使 V2 provenance 无效并触发 fail-closed。

## 8. cohort 隔离与历史兼容

健康汇总把证据分成：

- current compatible eligible cohort；
- legacy V1；
- incompatible V2；
- explicit debug/ineligible。

只有与当前代码、抓取器、validator、股票池、Gate、生产基线、依赖和观察工具完全一致的 V2 cohort 才进入统计。不同 cohort 不混算；财务与公告不混算；debug 不混算。修复前两条 V2 的 `observationToolChecksum` 属于旧实现，因此自动转入 incompatible，未被删除或改写。旧 V1 仍可读取和审计，但只进入 `legacyRuns`；其历史 checksum 差异继续展示，但不阻断新的 current cohort。

## 9. Resolution Ledger 审计

当前 resolution 数量为 0，因而不存在被人工解释掉的失败。健康评估现在会在读取时逐条重验 resolution，而不再假设 JSONL 一定由 CLI 写入。

V2 新增以下硬约束：

- resolution 必须通过 schema、唯一 ID、Provider/run/failure/category、带时区时间、reason/evidence/resolvedBy 与敏感内容检查；
- 同一 `(runId, failureIndex)` 的重复或冲突 resolution 会使 resolution ledger 完整性失败；
- replacement 必须存在、严格晚于 source，且 source/replacement 都是同一 Provider、同一有效 V2 cohort；
- replacement 必须是通过 run ledger integrity audit 的 eligible、完整、可用 success 证据；
- legacy、跨 Provider、跨 cohort、earlier、debug、failed 或 invalid replacement 均拒绝；
- 只有完整验证通过的 resolution 才进入 `_resolved_keys()`；任一无效 resolution 都进入结构化 `resolutionAudit` 并使 Gate blocked；
- transient 自动恢复只在当前兼容 cohort 的后续成功 run 内生效。

## 9.1 账本防篡改修复

- `audit_observation_ledger()` 在读取时对 run 文件和 JSONL 行执行完整 `validate_run()`，结构化记录 schema、身份、时间、failure、provenance、eligible、checksum、command、敏感内容及产物错误。
- V2 run/ledger 不一致、无效 schema/provenance、产物或 manifest checksum 不一致、路径越界、缺失产物、orphan、重复 ID，或无法安全分类的损坏记录，都会使 evidence integrity fail-closed；损坏失败样本不能通过“退出分母”提升资格。
- 旧 V1 checksum 差异仍作为 `legacyValidationIssueCount=4` 展示，既不伪装为 current，也不因历史格式问题阻断新的 V2 cohort。
- `AGENTS.md` 工作树例外收紧为唯一精确原始 porcelain 行 `?? AGENTS.md`；tracked、staged、renamed、deleted、nested 或其他未跟踪文件均拒绝。`--allow-dirty-debug` 仍只产生 ineligible sample。

## 10. 财务 Provider 独立统计

当前 cohort：`d643d02f700c6ade2b896ee08152ab45518917ec93dcf489822fc2e4507468e9`

| 指标 | 结果 |
|---|---:|
| current eligible runs | 1 |
| legacy / incompatible / debug | 1 / 1 / 0 |
| 不同自然日 / 成功日 | 1 / 1 |
| success / partial / failed runs | 1 / 0 / 0 |
| complete / total success rate | 100% / 100% |
| 最新 run | success |
| 公司覆盖 | 56/56 |
| 结构校验率 | 100% |
| 未解决失败 | 0 |
| 时长 | 1.295 秒 |

旧 V1 成功结果不再计入上述分子或分母。

## 11. 公告 Provider 独立统计

当前 cohort：`d0e3fbf47cc9a7f119334b9fd49d30c9dcf88a4fe120b5295051a806a2f32f95`

| 指标 | 结果 |
|---|---:|
| current eligible runs | 1 |
| legacy / incompatible / debug | 1 / 1 / 0 |
| 不同自然日 / 成功日 | 1 / 1 |
| success / partial / failed runs | 1 / 0 / 0 |
| complete / total success rate | 100% / 100% |
| 最新 run | success |
| 公司覆盖 | 56/56 |
| 公司层 success / partial / error | 26 / 30 / 0 |
| 公告总数 | 15,670 |
| 最新公告日 | 2026-07-23 |
| 结构校验率 | 100% |
| 未解决失败 | 0 |
| 时长 | 1.538 秒 |

公司层 `partial` 表示部分 PDF 正文解析不完整；本轮 56 家均有真实状态、artifact validator 通过且无 run-level failure，因此 run 状态为 success。该语义未被用来放宽准入天数或运行数。

## 12. 本轮新真实隔离观察

执行命令：

```text
npm run data:observe:providers
```

运行前 `git status --short` 只有精确原始行 `?? AGENTS.md`。任何 tracked、staged、renamed、deleted、nested 或其他未跟踪状态都会拒绝；`--allow-dirty-debug` 产生的记录仍排除。

新 run：

- 财务：`20260723T100643Z-a-share-financials-18164538`
- 公告：`20260723T100647Z-a-share-announcements-2533e149`
- 两条 `sourceCommitSha`：`68ff5d54bf092d546c88f3ebf489ac9139b373f0`
- 两条 `observationToolChecksum`：`2c36342758996960d074db493751b61810ad14e6f0de1443997f3b5e01faa045`
- 两条均 `eligibleSample=true`、`status=success`、`exitCode=0`
- 未重试观察任务，没有人工修改 run、ledger、summary 或隔离产物。

## 13. 生产原子性与正式产物

两条新 run 的生产树校验和均为：

```text
beforeChecksum = af8b9d0ee07f3f4b1ca9c830545e67cb80f50b621c632b6d5b8d3c68c74096d0
afterChecksum  = af8b9d0ee07f3f4b1ca9c830545e67cb80f50b621c632b6d5b8d3c68c74096d0
```

`productionUnchanged=true`、`worktree.unchanged=true`。正式财务、公告 JSON、App、默认刷新、数据源注册表和 Stability Gate 配置均无差异。

## 14. 财务 Provider 判定

**NO_GO**

已满足：最新成功、56/56、结构 100%、两个成功率 100%、未解决失败 0、生产 validator 通过、生产未变化、V2 provenance 完整。

未满足：仅 1/5 个自然日、1/10 次运行、1/5 个成功日。至少还缺 4 个不同自然日、9 次 current-cohort 运行、4 个成功日。假设 cohort 不变、后续样本真实独立且门槛全部持续通过，最早可在 2026-07-27（Asia/Shanghai）重新评估。

`GO_WITH_LIMITS` 不适用：它不能掩盖观察窗口和运行数不足。

## 15. 公告 Provider 判定

**NO_GO**

已满足：最新成功、56/56、结构 100%、两个成功率 100%、未解决失败 0、生产 validator 通过、生产未变化、V2 provenance 完整。

未满足：仅 1/5 个自然日、1/10 次运行、1/5 个成功日。至少还缺 4 个不同自然日、9 次 current-cohort 运行、4 个成功日。假设 cohort 不变、后续样本真实独立且门槛全部持续通过，最早可在 2026-07-27（Asia/Shanghai）重新评估。

`GO_WITH_LIMITS` 不适用：正文解析 partial 的产品限制可以继续披露，但不能替代跨日稳定性样本。

## 16. 严格准入命令

```text
npm run data:refresh:eligibility
```

本轮 npm 进程退出码为 1；健康 JSON 的领域退出码为 2，状态为 `insufficient_observation_window`。该命令按原样执行，没有使用 `|| true` 或其他吞错方式。两种数值同时保留，是因为 Windows 下 npm wrapper 将非零脚本结果报告为 1，而 Gate 自身明确返回观察不足语义 2。

## 17. 下一轮精确范围

下一轮只应继续积累同一 current provenance cohort 的真实隔离样本，并在每次运行后执行 health 与 strict eligibility：

1. 至少覆盖 2026-07-24、25、26、27 四个新增 Asia/Shanghai 自然日；
2. 每家再积累至少 9 次运行，且至少 4 个新增成功日；
3. 每次运行前仅允许精确原始 porcelain 行 `?? AGENTS.md`，其他工作树变化必须拒绝或显式作为 debug 排除；
4. 如代码、validator、股票池、Gate、依赖或生产基线改变，自动形成新 cohort，旧 V2 run 转为 incompatible，不得混算；
5. 任一 checksum、schema、覆盖、原子性、最新失败或 unresolved failure 触发 NO_GO；
6. Gate 真正 qualified 后，仍另开独立默认刷新准入任务。

## 18. 明确禁止与产品边界

- 不把财务或公告加入默认 `data:refresh`；
- 不修改 `defaultRefreshEligible`；
- 不修改 Stability Gate 阈值；
- 不修改 App、Provider runtime、公司指引 Provider 或正式生产数据；
- 不把旧 V1 checksum 差异人工解释为已通过；
- 不把公告公司层 partial 包装成完整正文覆盖；
- 不运行或重启自动机构一致预期 Provider；
- 自动机构一致预期继续 `not_implemented`，正式自动记录继续为 0，既有 `NO_GO` 不改变；
- 本轮不创建 PR、不合并、不删除分支。

## 19. 验证记录

最终验收结果：

- `npm run test:provider-observability`：146/146 通过；
- `npm run test:financials:a`：18/18 通过；
- `npm run data:validate:financials:a`：passed，56/56，56 success、0 partial、0 error；
- `npm run test:announcements:a`：26/26 通过；
- `npm run data:validate:announcements:a`：passed，56 家、15,674 条正式公告、26 success、30 partial、0 error；
- `npm run test:expectations:company-guidance`：Node 173/173、Vitest 102/102 通过；
- `node scripts/generate-company-guidance-expectations.mjs --check`：passed，59 个 committed artifacts 逐字节一致，mismatches=0；
- `npm run data:validate:expectations:company-guidance`：passed，56 家状态文件、56 个快照、15 家有快照；
- `npm run test:expectations:institution-consensus-probe`：65/65 通过；
- `npm run data:health:providers`：生产校验通过，两家 inventory 均为 current / legacy / incompatible / debug = 1 / 1 / 1 / 0，current cohort 各 1 run / 1 day / 1 successful day；
- `npm run data:refresh:eligibility`：预期非零，npm=1、Gate=2，`insufficient_observation_window`；
- `npm run data:audit`：P0=0、errors=0、warnings=24、exit=0；
- `npm run test`：30 个测试文件、498/498 通过；
- `npm run build`：通过；bundle budget 通过；Vite 既有大 chunk warning 未升级为错误；
- `git diff --check`：通过；
- 开始与结束 `env:check` 及 JSON 均为 40 PASS / 6 WARN / 0 FAIL / 4 SKIP。

env WARN 均为既有环境/工作流提示；本轮没有新增 FAIL。两条新 run 的正式生产树 before/after checksum 均为 `af8b9d0ee07f3f4b1ca9c830545e67cb80f50b621c632b6d5b8d3c68c74096d0`。正式财务、公告、公司指引产物、App、registry、默认刷新、Provider runtime 和 Stability Gate 配置相对基线均无差异；`.provider-observations/` 仍被 Git 忽略，`AGENTS.md` 仍未跟踪。自动机构一致预期继续 `not_implemented`，正式自动记录为 0，既有 NO_GO 不变。
