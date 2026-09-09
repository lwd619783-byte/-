# 来源登记与取证限制

核对日期：2026-09-09。所有仓库文件锚定同一已核实commit；目录/代码内容优于历史文档自述的CURRENT字样。

## 仓库一手证据

### S01｜主干状态
https://api.github.com/repos/lwd619783-byte/-/branches/main

本轮实时读取main为bcca135530352ed9c85407e18acceed1dbf45690；commit信息显示PR #38合并。未由此推断CI通过。

### S02｜永久规则
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/AGENTS.md

任务边界、事实源、数据/时间/持久化不变量及分支流程。

### S03｜产品定位
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/PRODUCT.md

研究工作台与Asset OS定位；不是营销站。

### S04｜架构快照
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/docs/architecture.md

浏览器/Node-only边界、既有技术栈、LocalStorage工作流。

### S05｜功能登记
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/docs/feature-registry.md

已实现与未准入/未开始分别记录。

### S06｜UI工作流
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/.agents/skills/investment-dashboard-ui-workflow/SKILL.md

重大UI设计路由、现有栈、实际渲染验收。

### S07｜首页
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/home/HomePage.tsx

封面、模块入口、模式、统计、价格信任信息。

### S08｜宏观
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/dashboard/MacroTab.tsx

九分类、快照、时效待核验、模型未接入。

### S09｜行业
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/industry/IndustryTab.tsx

细分、产业链、机器人全部、未上市线索。

### S10｜个股池
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/stock/StockPool.tsx

原筛选、排序、表格/卡片、移动列表。

### S11｜个股详情
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/stock/StockDetailDrawer.tsx

完整主体区块、异步加载、原操作与来源展示。

### S12｜观察清单
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/watchlist/WatchlistTab.tsx

元数据、复盘、提醒、归档、模板、备份与存储异常。

### S13｜验证中心
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/research/ResearchEventCenter.tsx

事件筛选、全局队列、链条、日期/来源信息。

### S14｜预期证据
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/src/components/expectation/EarningsExpectationCenter.tsx

来源/时间资格、索引与明细状态、重复/冲突、修订/纠错。

### S15｜依赖版本
https://github.com/lwd619783-byte/-/blob/bcca135530352ed9c85407e18acceed1dbf45690/package.json

React18、Vite6、Tailwind3、Recharts2及已有测试工具。

## 外部一手规范

### W01｜WCAG 2.2 文字对比与可读性
https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum

正常字号文字4.5:1；设计定义色对检查不能替代最终环境验证。

### W02｜非文字对比
https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

必要控件与图形识别目标3:1；装饰边界不等于所有交互边界。

### W03｜目标尺寸
https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

2.5.8包含24 CSS px与例外，本设计触屏44px是更保守项目目标。

### W04｜模态对话框模式
https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

焦点进入/约束/返回与键盘交互。

### W05｜官方Codex模型与推理选择
https://learn.chatgpt.com/docs/models

本轮页面列出5.6 Sol等及Medium/High等选择；未检出GPT-6条目。可用模型以账号界面为准，不据公共页面否定用户所见。

## 用户提供的设计证据

本对话原C图 [references/C_已选视觉参考.png](references/C_已选视觉参考.png)，仅用于视觉方向。V0.1草案已读取并在V1.0中扩充；此前自动生成的其他英文品牌首页不作为事实源。

## 限制

本轮使用只读GitHub接口核实目标页面与基线；没有在运行中的真实网站上执行UI测试。设计图使用合成样例，并不把读取到的真实公司/行情内容复制为新金融研究。公开库的代码许可证、本轮新增依赖许可并无实际采用决策：本轮不引入它们，因此也不宣称完成相关法律审查。
