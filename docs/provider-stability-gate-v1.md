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
  provider-health-summary.json
```

两套抓取器新增 `--output-root` 和 `--cache-dir`；不传参数时生产行为不变。观测器始终传入隔离目录，并在运行前后计算生产财务/公告产物树 SHA-256，任何变化均记为 `atomicity_failure`。记录采用 UTF-8、LF、稳定键序和原子替换；重复 runId 被拒绝，失败运行仍留痕但不伪装为成功。

## 观测字段与差异

账本记录 Provider/版本/领域、起止时间、Asia/Shanghai 时区、耗时、平台、Python/Node 版本、脱敏命令、覆盖与状态数量、结构校验率、缓存模式、超时/限流、Manifest 和产物校验和、差异、原子性、工作区变化、退出码和失败分类。Provider 未暴露逐请求遥测时，重试数和 HTTP 状态分布保留 `null`/空对象，不编造。

财务比较公司集合、状态、最新报告期/类型、最新单季度收入、归母净利润、扣非净利润、经营现金流、关键比率、资产负债表摘要和校验和；忽略 `fetchedAt`、`generatedAt` 等时间噪声。同报告期核心值变化列为 value drift。

公告比较公告 ID、公司覆盖、总数、最新日期、分类、URL、Manifest 和校验和。新增公告是正常变化；历史公告移除属于高风险 `unexpected_removal`。

失败分类包括 network/provider/timeout/rate-limit/auth/schema/empty/coverage/removal/value drift/manifest/checksum/atomicity/validation/audit/filesystem/timezone/unknown。写账本前递归脱敏 Cookie、Authorization、OAuth、Token、Session、Password、Secret、Bearer 和敏感 URL 参数；不保存完整响应头或未经筛选响应体。

## 准入规则

`config/provider-stability-gate-v1.json` 要求：

- 不同自然日不少于 5；每个 Provider 运行不少于 10，成功日不少于 5。
- 公司覆盖 56/56，结构校验率 100%。
- 完整成功率不低于 90%，总成功率不低于 95%，最新运行成功。
- 无未解决 schema drift、原子发布失败、Manifest/checksum 错误、异常移除、P0 或审计错误。
- 生产 generated 数据继续通过专项验证；瞬时网络失败可恢复，不能持续限流。

状态支持 `insufficient_observation_window`、`observing`、`qualified`、`conditionally_qualified`、`disqualified`、`provider_unavailable`、`blocked`。严格命令退出码为 qualified=0、观察不足=2、条件准入=3、其他不通过=1。

只有 `qualified` 才允许后续通过独立 PR 讨论默认刷新。本 V1 不改 `data:refresh`，不自动改生产数据，不自动合并 PR。

## 当前状态

首次真实隔离运行结果保存在本机 `.provider-observations/provider-health-summary.json`，该文件不提交，避免把单次运行伪装成长期事实。当前仅能声明框架和离线门禁已建立；跨日观察窗口尚未完成；新浪和巨潮 Provider 均未获得默认刷新准入。

首次真实基线（2026-07-12，Asia/Shanghai）：新浪财务 62.264 秒，56/56，success 56、partial 0、error 0；巨潮公告 333.773 秒，56/56，success 27、partial 29、error 0，共 15,638 条，最新公告日 2026-07-11。两次结构校验率均为 100%，均无超时、限流或已知失败，生产产物树前后校验和一致。公告数量较已提交快照少 36 条，原因是两年滚动查询起点从 2024-07-11 推进到 2024-07-12；这是首日基线窗口差异，不作为跨日 removal 结论。

健康结果为 1 个观察日、每个 Provider 各 1 次成功运行，`insufficient_observation_window`，严格准入退出码 2。尚需至少 4 个不同自然日，并使每个 Provider 累计达到至少 10 次运行和 5 个成功日；不得在同一天重复运行来伪造跨日样本。
