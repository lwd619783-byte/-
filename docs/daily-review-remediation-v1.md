# Daily Review V1 独立审计整改

## 2026-09-27 冻结范围

续工基线 `553fb638eefab83f3379f6b183aec98bd28a1674`，当前分支 `codex/daily-review-writeback-v1`；fetch 后 main 仍为 `0092d02e7ef13764be7877d2f56a9137685d4b8a`，工作区 clean。不新建功能分支；只做 P1-A/P1-B/P2，不接真实 ChatGPT、Tasks、新 Provider/Store/云资源或 Production。

Provider 带入有来源/取得时间/可用状态的结构化事实；OS 用冻结纯函数计算；ChatGPT 读取 OS 数字后进行研究解释。Daily Review 仍是 AI Research Context，不晋升 Formal Decision。油运计算迁移至一个共享纯模块，原 UI service 重导出；页面与 context 使用同一计算。现有三只样本 identity 复用，不建立通用 Entity authority。

`oil-shipping-observation-context.v1`：requested asOf、effective cutoff、90自然日窗口、整体状态；每只股票 latest/1p/5p/20p 与实际端点、状态、unknown adjustment、calendar_unproven、来源时间/digest；固定3证券样本聚合不缩 denominator，stale/partial/conflict/missing 时返回 null；运价继续 blocked/null，关系继续确定性 unavailable。个股留存变化可带限制显示，不能声称总回报。有限结果不返回完整曲线。

确定性结果 identity + value/unit/window/endpoints/source refs + calculation revision/digest。新 publish/prepare 的 derived observation 必须引用当前 asOf context 中的真实 result ref；普通行情 source ref 与自造 locator 不可冒充结果。历史 Review 读取保留旧合同可读性，仍标明 AI 引用文字不等于 OS verified derived；不解析自然语言数值。

PIT：只有取得时间不晚于 requested asOf 的 owner 可进入计算；无历史 owner 时 missing，不从后来完整 snapshot 回推。不可见 owner 的内容/digest/来源元数据均不泄漏到过去 context；不为保存旧 context 新建 authority。

CI 对照保持 Node/lockfile/node_modules/worker 参数一致；先运行 main 与整改前分支默认命令，再依据证据处理。不得提高 timeout、删断言、skip 或缩小 discovery。OAuth 仅扩展共享 handler 的 surface 文案，不复制安全流程。

## P1-B 事实纠正与对照结果

**上一轮“默认 threads 失败、forks 成功”的归因错误。** 锁定安装为 Vitest 2.1.9，`configDefaults.pool` 和 `createVitest('test', {watch:false}).config.pool` 实查均为 `forks`；实际 config `isolate=true, fileParallelism=true`，max/minWorkers 未覆盖。package.json 的 `test=vitest run` 与 GitHub `npm run test` 原样保留。旧失败日志自身记录的命令是 `vitest run --maxWorkers=1 --minWorkers=1`；不是默认 worker 参数，更不是已证明的 threads pool。本轮未切 pool，不能把旧失败归因于 threads。

同机 Windows x64 / Node v22.23.2 / npm10.9.8 / availableParallelism22。main 与整改前分支分别从精确 Git tree 导出隔离副本，使用同一个 node_modules junction；lockfile SHA256 均为 `3a3ad4969c7de8099999acefd9c2e3560ee62e6d6ae643665cc3dff1a33db539`。隔离 Git index 仅供 tests 的 tracked-file 检查；没有 checkout/main 写入或新分支。两组对照按次序运行。

| 代码 / 命令 | files / tests | duration | owner-state / 资源 |
| --- | --- | --- | --- |
| main `0092d02` / `npm test` | 115 / 1509 PASS | 52.10s | 14/14 PASS，无 timeout |
| 整改前 `553fb63` / `npm test` | 116 / 1514 PASS | 50.60s | 14/14 PASS，无 timeout |
| main / `npm test -- --maxWorkers=1 --minWorkers=1 --logHeapUsage` | 115 / 1509 PASS | 163.07s | owner-state29.07s / heap223MB；进程正常退出 |
| 整改前 / 相同单worker参数 | 116 / 1514 PASS | 163.90s | owner-state27.49s / heap511MB；后续suite heap回落，进程正常退出 |
| 整改后 / 原样 `npm test` | 116 / 1516 PASS | 53.73s | 无 timeout / hanging-process 提示 |
| 整改后 / 原样 `npm test` 再次验证 | 116 / 1516 PASS | 51.31s | 无 timeout / hanging-process 提示 |

main 首轮导出副本尚未配置隔离 index，技能 tracked-file 检查失败1项，owner-state仍14/14通过；该轮不算合格 baseline。修正测试环境后重新完成上表。旧单worker两次超时仍是已发生事实，但在当前相同依赖的对照中**未稳定复现，具体根因未证实**；不能声称证明 main 固有问题或证明新增 Review 导致问题。旧失败中 owner-state先于 DailyReviewPanel 测试执行，也不能凭时间顺序把后者轮询当作原因。

资源核查：Review 轮询/focus listener 原本有 effect cleanup；新增回归在 StrictMode、成功读取、挂起请求、断开、重连、卸载后验证 interval=0、focus handler逐一解除、在途 signal aborted、后续focus不再fetch。HTTP请求改为显式可清除的20秒 timer，finally清理；组件断开/卸载 abort请求。MCP/HTTP属于独立 node:test，未进入 Vitest默认发现；test double均实例隔离，无新增模块级 timer/server/singleton。未改 owner-state、timeout、断言、discovery、CI执行命令或pool。

## P1-A 实际实现与边界

- 原 stockObservation、observationChange、samplePerformance、normalizeObservationSeries、observationRelationship、freightObservation 提升到 `shared/oil-shipping-observation.mjs`，原 TS service重导出；获取上海“今天”的时钟函数仍在 UI service。现有 stock seeds 的3个 identity提升到同一共享scope，UI与MCP共同引用。
- `get_daily_review_context` 返回17个bounded refs：运价1、股票事实3、个股return9、样本return3、relationship1。每个计算结果含stable locator、value/unit、periods、实际endpoints、sourceIds、calculationRevision、digest；digest绑定asOf与cutoff-visible source pin。context不返回points/完整曲线。
- 2026-09-27T12:00:00Z读取既有留存owner：effectiveDataCutoff=2026-09-17；三股均明确 stale/unknown_basis/calendar_unproven。个股raw-close 1/5/20仍可核对，但不是总回报或新鲜值；样本等权及up/down/flat为null，freight=blocked/null，relationship=unavailable。上下文15823 bytes；5000条额外早期历史不增加输出长度。没有刷新Provider、补齐缺口或冒充真实运价。
- 历史asOf前没有合格owner时明确missing，不持久化新的context authority；后来完整snapshot不能回填旧latest/5p/20p。若原先历史owner已不在当前留存源中，就返回missing，不承诺尚不存在的历史snapshot档案能力。
- prepare/publish必须验证derived至少引用一个该asOf合法deterministic ref。自造locator、错误digest、普通price-history ref和公共研究ref冒充计算均拒绝。旧immutable Review仍可按exact读取，文字显示“AI 引用派生结果”，不追认旧文本为OS计算证据。

## P2 与验证矩阵

共享OAuth handler最小新增surface错误和文案配置。Review显示“投研 OS 每日复盘 / ChatGPT 复盘写入授权 / Review access credential / AI_PUBLISHED / 一小时 / 可撤销 / 不修改 Claim、Thesis、Expression、Portfolio”；Legacy与Domain原consent语义不变。未配置分别为 REVIEW_NOT_CONFIGURED / DOMAIN_NOT_CONFIGURED / BRIDGE_NOT_CONFIGURED；Review错误不再借用“研究桥”。

| 验证 | 本轮结果 |
| --- | --- |
| `test:daily-review` | 20 Node + 6 UI PASS |
| Review + context + Bridge + Domain 合跑 | 65 Node PASS |
| observation共享函数 / 油运UI / ReviewUI | 3 files / 27 tests PASS |
| `contracts:validate` / `test:contracts` | PASS；106 + 78 Node、162 Vitest |
| `research:eval:check` / `test:research-eval` | PASS；65 Node、57 Vitest |
| `test:industry` | 8 Python + 107 Node + 90 Vitest PASS |
| `data:audit` | 0 errors / 42 warnings，较续工基线无增加；P0=0 |
| `npm test` | 原样命令连续2次116 files / 1516 tests PASS |
| `test:discovery` | PASS；保留116正式suite，3个嵌套副本反例仍被排除 |
| build / bundle budget / UI audit | PASS；budget errors=[]，原large-chunk advisory保留 |
| browser 390 / 1440 | 34 checks PASS，0 page runtime errors；含current/history/source/stale/withdrawn/AI边界 |
| Hosted CI | NOT_RUN：仍仅main/PR触发，本轮不创建PR |

本轮浏览器为隔离SDK→HTTP handler→store→真实App的synthetic验收；生产 PrivateBlob adapter 在独立fixture中完成create/reload/CAS/history回归。未再次向真实云Blob写测试业务数据，也不把上一轮真实Blob结果冒充本轮重跑。

| 交付轴 | 当前状态 |
| --- | --- |
| Backend write | PASS |
| Persistence | PASS（生产adapter回归；本轮live cloud NOT_RUN） |
| Deterministic OS context | PASS |
| MCP SDK write | PASS |
| Default full CI mode | PASS（实际默认forks未改，不代表Hosted CI已执行） |
| Real ChatGPT visibility / write | NOT_RUN / NOT_RUN |
| Scheduled ChatGPT write | NOT_PROVEN |
| Preview | 普通push后的精确SHA状态以最终交付核验为准 |
| Production | NOT_MODIFIED |

[桌面截图](daily-review-remediation-v1/sdk-app-1440.png)、[移动截图](daily-review-remediation-v1/sdk-app-390.png)、[34项浏览器报告](daily-review-remediation-v1/browser-report.json)、[同机同依赖 CI 对照](daily-review-remediation-v1/ci-comparison.json)。详细日志在ignored `data-cache/daily-review-remediation/`，保留旧失败、环境修正和真实执行结果。

清理限制：自动审批审查拒绝临时baseline/branch-before源码副本的递归清理，返回“blocked by policy”，未给具体原因；副本、tar和隔离index仍在ignored目录，未提交。没有绕过审批或删除依赖目标。数据/UI audit的自动生成旧报告已恢复，结果记录在此，不覆盖历史日期。

停止点：普通commit/push当前分支后等待ChatGPT独立复审；无PR、merge、main修改、Production配置/部署、Protection调整、账号写回或新增资源。
