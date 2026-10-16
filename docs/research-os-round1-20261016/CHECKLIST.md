# 第一轮完整性清单（父端独立审计入口）

固定代码 SHA：`d2f3eebcb6ae55be62b966720a56a871bc4e8d39`。基线为指定 PR86 HEAD `f64b64a4d2c24a7f3ddc4d6a329091cc983f53ce`，依赖 PR86，不能以 main 代替。

状态：IMPLEMENTED / VERIFIED LOCALLY / PARENT AUDIT PENDING。没有 PR、合并、部署或真实交易；5 high 继续阻断发布。

| 用户要求 | 实现与验证入口 | 实际结果/边界 |
| --- | --- | --- |
| 决策优先首页、个股卡 | `src/demo/round-one/DecisionHome.tsx`；[首页320](evidence/browser/320-home.png)、[首页1536](evidence/browser/1536-home.png) | 默认首页；3条合成建议/条件/数据日/知识索引；正式App未迁移 |
| 旧证据与历史二级保留 | 原 Thesis/Expression 面板、[旧链浏览器报告](evidence/legacy-browser/report.json) | 102 checks；revision、原始Evidence、导入导出与来源禁外链回归保留 |
| 建议/确认分开，确认不是成交 | `DecisionHome.test.tsx` 与新浏览器报告 | 预览、取消、确认已阅读、重复按钮禁用；阅读记录仅当页会话，不写正式状态、不包含于超跌备份 |
| 缺失、过期、未来数据未知 | `decisionFreshness` 与首页测试 | 过期/缺失样例明确标未知；固定观察日不是实时行情 |
| 候选池与无机会轮次保留 | `createSimulation().create/skip`；`simulation.test.ts` | 每轮24合成候选快照；无机会只追加skip、无持仓 |
| 用户选择20只唯一股票 | `validateRound` 与选择测试；新浏览器19/21只阻断 | 无真实选股；手动勾选20只；重复/不存在候选拒绝 |
| 初始每只5%，总计100% | allocation `weightBps:500`；sum=10000；导出检查 | 20只严格验证；未成交份额保留现金，分母不重新分配 |
| 锁定不可回改 | 输入深拷贝、快照冻结、追加事件、冲突导入测试 | 同名不同内容备份拒绝；不能再lock/skip/换股；外部备份不是签名或真实时点审计凭证 |
| 20交易日计数可配置 | `tradingDaysElapsed`；两个计数口径测试 | 计划入场日计1/0，周末和合成休市日排除；不冒充真实交易所日历 |
| 入场价、成本待确认 | 规则表单/预览、成本与入场价格测试 | 下一合成交易日open/close、单边0–1000bps整数，合成参数需勾选确认；真实口径待确认 |
| 不回填未来价格 | `fillBlock`/严格逐日事件重放 | 日期/标的/availableAt/价格有效性校验；SYN-06因晚到数据未成交；导入跳日/附加价格字段拒绝 |
| 停牌/涨跌停/缺行情 | 入场测试和浏览器持仓状态 | SYN-02..06共5只未成交；后续有行情也不补买、不替换 |
| 到期评价与待退出 | [待退出截图](evidence/browser/320-pending-exits.png)、到期退出测试 | 到期4只待退出，组合净收益未知；后续实际合成退出日保留，不倒签到期日 |
| 期间不再平衡/不替换 | shares与allocation不变测试 | 只允许逐交易日推进、到期退出；无调整接口 |
| 规则版本/候选/锁定快照 | `synthetic-oversold-v1`、`synthetic-sessions-v1`、严格备份格式 | 原候选全量保留，锁定事件含规则与权重；不同规则版本拒绝 |
| 导入导出、重复与取消 | [新浏览器报告](evidence/browser/report.json)、strict backup tests | 刷新后精确重放；先预览后确认；取消无写入；同包重复导入0新增；整包失败原子性 |
| 窄屏与可读性 | 320/390/1536实际Chromium | 新106 checks、旧102 checks；无横向溢出；新卡正文对比度≥4.5；17截图逐张查看 |
| 正式/demo隔离 | [完整性命令](evidence/final-integrity.log)、[资产清单](evidence/demo-asset-inventory.json) | 正式23个JS/HTML无新模块标记；demo1628模块禁入图；7受限源/455长字面值0命中；正式存储sentinel不变 |
| 服务和外链边界 | 两组浏览器报告 + 原demo负向构建 | 零意外请求/弹窗/页面错误；CSP主动拒绝同源API和外站fetch；静态/lazy/传递/tree-shaken正式数据导入拒绝 |
| 未改真实资料、账户、依赖、部署流程 | `round-one-integrity.mjs` | 正式src/data、research-data、contracts、local-core、server、api、App/main、CI与lockfile均无改动；无其他仓库修改操作 |
| 禁自动部署 | `vercel.json` exact branch=false | 仅本分支配置；未调用部署API，未验证远端部署状态 |
| 发布阻断 | [完整npm audit](evidence/final-dependency-audit.log) | exit1 / 5 high；本轮未升级依赖；不宣称可发布 |
| 两三轮不证明有效 | UI和README说明 | 所有轮次重复同一合成场景，不能作为策略绩效证据 |

## 可复现命令与证据

[verification.json](evidence/verification.json) 提供13条固定SHA命令、开始结束时间、退出码、干净工作区声明、日志SHA256、环境与限制。对应 `.log` 是完整保留输出，不仅是摘要。`evidence-manifest.json` 校验本证据目录文件，不自哈希。

```sh
npm ci
npm test
npm run test:demo
npm run contracts:validate
TMPDIR=/tmp/.local-data/os-round1-tests npm run test:contracts
npm run test:discovery
npm run build
npm run build:demo
node scripts/round-one-integrity.mjs
UI_REVIEW_PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright DEMO_BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:round-one:browser
UI_REVIEW_PLAYWRIGHT_MODULE=/opt/codex/cua_node/lib/node_modules/playwright DEMO_BROWSER_EXECUTABLE=/usr/bin/chromium DEMO_BROWSER_COMPACT=1 npm run test:demo:browser
npm audit --json
```

已有Playwright/Chromium路径为本环境示例，父端使用自己已安装路径；不需安装新依赖。演示本地查看：`npm run preview:demo -- --host 127.0.0.1`。本轮没有远程托管预览。

没有重跑整个Hosted CI，Node22 CI环境尚未验收；本轮用Node24.19.0（项目engines允许≥22）。全量Vitest exit0但stderr保留2条既有 `window.scrollTo` jsdom未实现信息；浏览器无对应错误。UI audit是静态检查，响应式结果来自实际浏览器。构建chunk warning、npm旧依赖deprecated/devdir警告均保留。

本轮严格停止在实现与证据交付。下一步由父端从固定SHA独立审计及必要返修，之后才提交草稿PR。
