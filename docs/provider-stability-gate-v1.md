# Provider 跨日稳定性观测与默认刷新准入门禁 V1

## 结论

项目已建立独立、可审计的 Provider 稳定性观测框架。它复用新浪 A 股财务 Provider 和巨潮资讯公告 Provider，只把真实运行产物写入被 Git 忽略的 `.provider-observations/`。生产摘要、Manifest、单公司文件以及默认 `data:refresh` 均不因观测运行而改变。

首次基线只能证明单一时点可用，**不能证明跨日稳定性**。至少 5 个不同自然日、每个 Provider 至少 10 次运行及 5 个成功日等条件满足前，状态必须是 `insufficient_observation_window`，不得描述为 qualified。

## 命令与边界

```text
npm run data:observe:providers
npm run data:observe:financials:a
npm run data:observe:announcements:a
npm run data:health:providers
npm run data:refresh:eligibility
npm run test:provider-observability
```

真实观测命令访问现有公开端点。CI 只执行离线测试及已提交数据验证，不进行定时网络抓取，不需要 Token 或浏览器凭据。

本地目录全部被忽略：

```text
.provider-observations/
  runs/<run-id>.json
  artifacts/<run-id>/generated/
  cache/<provider-id>/
  provider-health-ledger.jsonl
  provider-health-resolutions.jsonl
  provider-health-summary.json
```

两套抓取器新增 `--output-root` 和 `--cache-dir`；不传参数时生产行为不变。默认观测在启动任何实时 Provider 请求前执行 `git status --porcelain`，工作区不干净时返回非零退出码和脏文件名，不写正常 run，也不 stash、reset 或 clean。`--allow-dirty-debug` 仅用于显式调试，产生的运行带 `eligibleSample=false`，不进入准入统计。

观测器在运行前后计算固定生产逻辑根下的 SHA-256，分别写入 `beforeChecksum` 和 `afterChecksum`，任何变化均记为 `atomicity_failure`。跨运行 `artifactChecksum` 使用相对于本次 generated 逻辑根的 POSIX 相对路径和文件原始字节，不含机器绝对路径、run ID 前缀或临时目录名；文件新增、删除、重命名或内容变化都会改变哈希。`manifestChecksum` 只计算 Manifest 原始字节。记录采用 UTF-8、LF、稳定键序和原子替换；重复 runId 被拒绝，失败运行仍留痕但不伪装为成功。

## 观测字段与差异

账本记录 Provider/版本/领域、起止时间、Asia/Shanghai 时区、耗时、平台、Python/Node 版本、脱敏命令、覆盖与状态数量、结构校验率、缓存模式、超时/限流、Manifest 和产物校验和、差异、原子性、工作区变化、退出码和失败分类。Provider 未暴露逐请求遥测时，重试数和 HTTP 状态分布保留 `null`/空对象，不编造。

财务比较公司集合、状态、最新报告期/类型、最新单季度收入、归母净利润、扣非净利润、经营现金流、关键比率、资产负债表摘要和校验和；忽略 `fetchedAt`、`generatedAt`、字段顺序及 `1`/`1.0` 等数值等价差异。新增报告期不属于漂移；同一公司、同一报告期的核心值变化记录 `stockId`、报告期、字段、前后值和前后 run ID，并产生阻断性 `data_value_drift`。正式更正或重述在核验前仍阻断。

公告比较公告 ID、公司覆盖、总数、最新日期、分类、标题、URL、Manifest 和校验和，并把前后查询窗口一并写入差异：

- `expectedExpired`：公告日期严格早于当前窗口起点，属于滚动窗口自然退出，不阻断；日期等于当前起点仍在窗口内。
- `unexpectedRemoved`：公告日期仍位于前后窗口重叠区间，但 ID 消失，产生阻断性 `unexpected_removal`。
- `unverifiableRemoved`：日期缺失或窗口缺失、倒退、缩短、跳跃、矛盾，不能自动解释为过期，产生阻断性风险。
- 新增公告正常记录；标题、类别或官方/PDF URL 变化记录为 `modified`。

失败分类包括 network/provider/timeout/rate-limit/auth/schema/empty/coverage/removal/value drift/manifest/checksum/atomicity/validation/audit/filesystem/timezone/unknown。写账本前递归脱敏 Cookie、Authorization、OAuth、Token、Session、Password、Secret、Bearer 和敏感 URL 参数；不保存完整响应头或未经筛选响应体。

## 准入规则

`config/provider-stability-gate-v1.json` 要求：

- 不同自然日不少于 5；每个 Provider 运行不少于 10，成功日不少于 5。
- 公司覆盖 56/56，结构校验率 100%。
- 完整成功率不低于 90%，总成功率不低于 95%，最新运行成功。
- 无未解决 schema drift、原子发布失败、Manifest/checksum 错误、异常移除、P0 或审计错误。
- 生产 generated 数据继续通过专项验证；瞬时网络失败可恢复，不能持续限流。

每次执行健康或严格准入命令都会完全离线地重新读取 56 家股票池，并调用现有财务、公告 artifact/数据集校验函数核对摘要、Manifest、详情文件、byteSize 和 checksum；随后调用 `node scripts/data-audit.mjs --json --no-write` 获取结构化 P0/errors，并检查默认 `data:refresh` 未包含未准入 Provider。任何一项失败都会将状态置为 `blocked`，这些值不再硬编码。

成功率是两个独立指标：

- 公司级 `success/partial/error` 描述单家公司数据状态；公告 PDF `parse_partial` 不等于 Provider 运行失败。
- 运行级 `success/partial/failed` 描述整次抓取。`completeSuccessRate = 无未解决失败的 success 运行数 / 总运行数`。
- `totalSuccessRate = usable 运行数 / 总运行数`。usable 可包含完整覆盖、结构校验通过、生产未修改且没有 blocking failure 的 partial；覆盖下降、结构校验失败或原子性失败的 partial 不计入。

## 失败解决账本

原始 run 与 `provider-health-ledger.jsonl` 不可修改。结构性异常核验后，使用独立追加式 Resolution Ledger：

```text
python scripts/provider-health.py --resolve <run-id>:<failure-index> --reason "核验结论" --evidence "可追溯证据" --resolved-by "operator"
```

Resolution 必须引用真实 run 和 failure，category 必须匹配，reason/evidence 不能为空，内容经过脱敏，重复 resolutionId 被拒绝。后续成功运行只能自动标记可恢复的瞬时网络类失败；schema drift、重叠窗口异常移除、data value drift 等结构性问题不会被自动抹去，必须显式 Resolution。健康摘要同时保留历史异常和解决记录。

状态支持 `insufficient_observation_window`、`observing`、`qualified`、`conditionally_qualified`、`disqualified`、`provider_unavailable`、`blocked`。严格命令退出码为 qualified=0、观察不足=2、条件准入=3、其他不通过=1。

只有 `qualified` 才允许后续通过独立 PR 讨论默认刷新。本 V1 不改 `data:refresh`，不自动改生产数据，不自动合并 PR。

## 当前状态

首次真实隔离运行结果保存在本机 `.provider-observations/provider-health-summary.json`，该文件不提交，避免把单次运行伪装成长期事实。当前仅能声明框架和离线门禁已建立；跨日观察窗口尚未完成；新浪和巨潮 Provider 均未获得默认刷新准入。

首次真实基线（2026-07-12，Asia/Shanghai）：新浪财务 62.264 秒，56/56，success 56、partial 0、error 0；巨潮公告 333.773 秒，56/56，success 27、partial 29、error 0，共 15,638 条，最新公告日 2026-07-11。两次结构校验率均为 100%，均无超时、限流或已知失败，生产产物树前后校验和一致。公告数量较已提交快照少 36 条，对应两年滚动起点从 2024-07-11 推进到 2024-07-12；正式算法现在依据公告日期和前后窗口重叠区分类，只有严格早于新起点的记录才能归入 `expectedExpired`，重叠区消失或无法验证的记录不会被人工说明放行。首个 run 本身仍是 baseline，不伪造前一观测日。

健康结果为 1 个观察日、每个 Provider 各 1 次成功运行，`insufficient_observation_window`，严格准入退出码 2。尚需至少 4 个不同自然日，并使每个 Provider 累计达到至少 10 次运行和 5 个成功日；不得在同一天重复运行来伪造跨日样本。
