# 独立审计返修 R1 · CURRENT

本次仅在原分支 `feat/research-os-round1-no-deploy` 返修，起点 `b818a40a47a81948cc14e4db30e9c8a6f06435bd`。仍明确依赖PR86 HEAD `f64b64a4d2c24a7f3ddc4d6a329091cc983f53ce`。无新任务、模型配置调整、PR、合并或部署。

父端此前独立只读审计确认旧89份证据哈希，但没有重跑实施方测试。本目录记录本次实施方验证，不能称父端独立复验通过。旧证据保留原字节，不改写其历史结果。

| 审计项 | 本次修复 | 验证范围 |
| --- | --- | --- |
| 1. 导入绕过单活动轮次 | prepareImport按合并后全量状态校验最多一个未完成轮次；confirm/import重新prepare，拒绝预览后状态变化；任何冲突全包不写入 | 空实例两draft、现存draft/locked/pending-exit再导另一轮、混合skip与冲突轮原子拒绝、预览失效、合法终态历史+一活动轮及重复导入；浏览器多活动包拒绝 |
| 2. 延期收益误称到期收益 | `finalLiquidationReturnPct`/最终清算净收益，显示计划到期、最终退出、延期交易日数；第20日未全退显示未知，第22日收益明确包含延期 | 第20/22日投影及浏览器断言；原第20日事件前缀重放仍未知。不提供独立到期估值，不以最终收益补填第20日 |
| 3. 日级成交模型边界 | 保留原有限日级场景，未伪装修成盘中模型。16:00检查整日open/close及状态，用选定字段进行合成计算；open不是开盘执行证据 | 同日09:30/15:59:59不可用，16:00日级门禁通过；close缺失仍拒绝整日bar。这只验证日级快照门禁，不证明开盘可成交或无前视 |
| 4. 版本绑定决策确认 | 阅读独立；明确按钮确认建议ID/版本/正文、当前会话UTC确认时间、适用及失效条件，追加只读历史；合成更新v1→v2识别旧确认过时 | 阅读/决策取消、重复、建议更新使待确认预览失效、旧记录原文保留、切Notion索引再点首页仍保留记录；始终不是成交或真实投资决定 |
| 5. 日期/计数/导出说明 | 严格日历日期回环校验、过期/未来/非法/矛盾日期均未知；首页计数由当前cards推导；顶部说明每模块导出范围及首页状态未导出 | 非法格式/月日/非闰年/截止早于数据日/asOf非法、有效闰日和有效期边界、单样例计数；demo/Notion占位声明 |

日级成交假设的限制是本轮明确选择的最低修复范围：尚未拆分预先订单、盘中执行时点、每字段可得时点与成交证据；因此**不可用于真实时点回测，不声称模型无前视偏差**。此前README/CHECKLIST中的“PIT/当时可得/禁止未来回填”仅能解释为“拒绝晚于日终快照观察时点的数据、拒绝跳日事件”，不得扩大为开盘执行证据。旧规则/备份版本保留，因为固定场景计算没有更改；新增清算字段是准确的只读口径，导入约束收紧后旧多活动包会被拒绝。

确认记录仅在合成页面内存，刷新清空；不验证条件已满足，不晋升正式状态。超跌备份只有超跌轮次；Thesis/Expression各自导出；首页阅读、决策确认与建议版本未导出。Notion是合成索引占位，尚未接入或迁移正式App。浏览器Back没有history路由支持，为NOT_APPLICABLE；测试的是点击“决策首页”返回。

Node24.19.0 / npm11.9.0，未沿用PR86的Node22 CI结果；Hosted新HEAD CI待父端建立draft后验收。5 high仍为发布阻断；无重大依赖升级、私人数据或真实股票代选。

预提交验证：53项专项单测、demo构建、151项浏览器检查通过。最终浏览器补充确认预览的窄屏检查与截图，以下仍需绑定修复代码SHA重跑。原分支与环境持续可用，未更改模型配置。

## 固定修复 SHA 验证

- 代码提交/远端已核：`c905be186d2465283f8ef0c7f57aea6ff880a818`。后续仅保存证据与交接。
- Node24.19.0 / npm11.9.0。12条最终命令均从该SHA干净工作区启动：全量120文件/1589测试，demo 2 Node/66 Vitest，contracts校验及106+78 Node/162 Vitest、discovery、正式/demo build、UI audit、完整性检查、新浏览器154/旧链102通过。完整audit exit1 / 5 high，继续发布阻断。
- 本轮未出现单测、构建或浏览器失败；此前失败/重试历史保留原样。全量测试本次无scrollTo stderr；构建既有chunk/static-dynamic警告和npm版本提示保留。UI audit仍只改生成时间，留patch并还原。
- 浏览器Chromium154，320/390/1536px，无页面错误、意外console错误、意外请求或弹窗。保存19截图（11新模块+8旧链），已逐张检查11张新模块截图。Browser Back不适用；只验证索引后点击首页。
- 原89份证据文件按旧manifest与b818a40 Git字节复核，完全不变。新证据入口：[机器回执](evidence/verification.json)、[新界面报告](evidence/browser/report.json)、[旧链报告](evidence/legacy-browser/report.json)、[资产清单](evidence/demo-asset-inventory.json)、[完整文件清单](evidence/evidence-manifest.json)。对应.log完整保存并显式加入Git，不依赖被忽略的本地文件。
- 单独的新证据manifest逐文件检查磁盘/暂存区/提交内容及Git跟踪；公开文本扫描继续比较7类受限来源的455条长字面值、秘密模式与URL域。没有上传私人研究、账户、私有链接或凭据。
- 仍为实施方验收，父端需独立复审；新draft建立后的新HEAD CI尚未运行，不借用PR86的Node22结果。无PR/merge/deploy/真实交易；自动部署禁用保持。

关键复现命令仍使用仓库原入口：`npm test`、`npm run test:demo`、`npm run contracts:validate`、`npm run test:contracts`、`npm run test:discovery`、`npm run build`、`npm run build:demo`、`node scripts/round-one-integrity.mjs`。浏览器使用已装Playwright/Chromium运行 `npm run test:round-one:browser` 与 `npm run test:demo:browser`；完整命令参数、时间和退出码在机器回执。无新增依赖或下载浏览器。
