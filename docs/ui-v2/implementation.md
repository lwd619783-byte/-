# 投研 OS 前端 V2

状态：IMPLEMENTED / VALIDATION IN PROGRESS / PENDING INDEPENDENT AUDIT。本次只交功能分支与受保护 Preview。最终 runtime 与部署证据追加在本目录验收报告，不把文档 HEAD 当作被测构建。

## 基线与原范围结账

[D0](d0.md)记录冻结 SHA、已发生的 PR #72/main CI 与真实资料观察。原光通信 CREATE 当前待审核；本人审核、同 Wiki 真实 UPDATE/历史/撤销后的 ChatGPT 拒读仍属于原范围 PENDING。合成测试不替代本人审核；UI V2 不要求用户接受不满意的研究。Stage 4.3 Slice 3–6 继续未实现。

## 导航与接线

- 工作台：一个开始研究动作，已有观察的继续入口、待处理复盘、知识入口；最近阅读尚未持久化时明确说明。
- 研究：原首页完整研究收件箱/数据概况迁至总览；宏观、行业、公司五章、观察判断、验证事件、预期证据、观点追踪保留原组件/数据服务/动作。
- 知识库：原 Wiki 类型筛选、正文搜索、已审核文章、历史、关联、源材料追溯、修订和单向投影。
- 组合：明确未连接的首次访问状态，无虚假持仓、净值、收益或建议。
- 任务：已有研究 Inbox 与知识候选审核；没有 Agent 执行按钮或假进度。
- 资料与连接：原件保存/下载/解析、显式发送、只读 Bridge 状态与撤销、手动贡献包导入。
- 设置与帮助：数据保护说明、既有备份/单向导出入口和操作帮助；没有原型“方案与交付”客户导航。

机器清单：[migration-inventory.json](migration-inventory.json)。每条保留原 route、动作、owner、持久化与新位置；`wired`是代码接线证据，回归项单列，不能替代真实资料E2E。旧 `/company/:id/:tab?from=...`、行业/细分/事件 query 和浏览器返回保持；新增 `#/knowledge?wiki=...` 只读定位原 Wiki ID。

## 阅读与外观边界

单一白/浅灰底、深色文字、低饱和绿强调色，复用原语义警告/涨跌。依用户后续明确反馈逐项采用原HTML视觉：#f7f8f4画布、#f0f2eb侧栏、#285b44强调色、#e4e8e1边线、#222823文字；桌面210px侧栏（1200px以下188px）、70px顶栏、主区最大1220px；连续正文800px/16px/1.95，表格容器滚动。共用既有DashboardLayout、Modal、Status、EvidenceDrawer和领域表格；不建立第二套组件框架或状态管理。

`react-markdown@10.1.0` / `remark-gfm@4.0.1` 渲染原 `bodyMarkdown`；HTML不执行、图片不发远程请求、危险URL不激活。目录由同一正文AST派生；历史展开才解析。原六章、来源日期、parsedTextSha等文字保留，不删“来源”章。E编号缺显式映射时提示不确定；来源卡片按原ID/locator展示。接受不升级为投资信号或Verified Claim。

## 数据保护与回滚

1. 本次无schema migration、无新业务storage key、无数据复制；旧外观键保持原字节，runtime固定light。
2. 本地Wiki/观察/预期/Creator原owner与ID不变；原件/批次/贡献包仍在原IndexedDB。Wiki JSON不含原件；原件目前仅逐文件下载，不宣称全库可恢复。
3. 旧真实验收固定origin/profile继续保留；新Preview采用临时合成context。新origin为空不等于迁移成功。没有复制cookies或接管个人浏览器。
4. UI回滚由后续获授权的普通分支提交恢复本轮presentation文件/路由，或选择已验证旧构建；不reset/force-push、不回滚知识版本、不清storage。保留Wiki/IndexedDB authority和旧主题键。不同origin须回到原地址读取，不能假定自动跨域恢复。
5. 私人原件、完整贡献、真实文章截图与本机profile路径仅gitignored本地证据；公开仓库只保留代码、无正文的验证摘要和隔离fixture截图。

## 后续接入合同

4.4仍复用Local Core account/position/time/currency/entity关系；4.5仍按scope/confirmation/Audit受控使用同一Wiki；4.6+依赖真正执行器和Eval。公开来源登记、免手工提审、收费模型、写MCP、ETF穿透均未在本轮新增。隐藏/空状态只管呈现，不替代底层权限。

## 验证与证据

实际命令来自package.json；环境、Vitest、contracts、discovery、F3/research-eval、Bridge负向、Wiki/导入浏览器、build、静态UI/data audit分列。隔离全站浏览器脚本验证旧/新路由、公司五章、六宽度、键盘、缩放与reduced-motion；不是完整WCAG认证。性能按同浏览器、同机器、相同服务器、每版三次冷context记录，不给未测数字或生产性能承诺。

参考边界已核对：[W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)、[W3C modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)、[MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)。目录焦点不改应用hash；非模态窄屏导航不陷住焦点；Modal继续Esc/焦点归还。
