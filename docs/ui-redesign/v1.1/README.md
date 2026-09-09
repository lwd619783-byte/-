# 投研工作台 UI V1.1｜布局与隔离验收

本次票据 base：`a419607ebc9d7b4413bedd8786cf814394b3c00d`。分支：`codex/ui-v1-1-layout-review-fixtures`。

## Delta 与边界

本票在以下范围 supersede V1 蓝图的首页三列跨行组织与公司页固定大摘要建议；V1 数据、权限、来源、时间与持久化合同保持有效。V1 历史文档不回写。

- 完整公司 `page`：身份、价格、行情资格与风险摘要正常滚动。仅五章节标签栏 sticky，单行、局部横滚；深滚动后切章使用正文的文档位置定位，预留标签栏高度和 16px 间隔。`drawer` 的遮罩、焦点限制、Escape 与焦点恢复沿用原逻辑。
- 首页：KPI → 今日优先事项 → 价格脉络 / 最近事件 → 关注公司 / 数据状态。待办最多预览三项，空待办紧凑呈现；事件最多预览三条，保留查看全部。价格对象选择器放进实际图表卡片，双列顶部和底部对齐。窄屏按相同 DOM 顺序单列排列。
- 主题：neon / pro / light 仍使用相同组件、模块顺序、图表和交互，只改变视觉 token。

## URL 与场景

在任意本分支构建的站点根 URL 后附加以下内容（查询参数在 `#` 之前）：

| 场景 | URL 后缀 |
|---|---|
| full | `?ui-review=1&profile=full#/home` |
| empty | `?ui-review=1&profile=empty#/home` |
| degraded | `?ui-review=1&profile=degraded#/home` |
| 公司研究 | `?ui-review=1#/company/ui-review-company-1/overview` |

省略 `profile` 或提供未知 profile 时使用 full。只有查询参数 `ui-review=1` 启用；`mock/mixed/real`、hash 中同名参数、`ui-review=0/true` 均不会启用。

可通过已有七个一级导航进入全部页面，也可替换 hash 为 `macro`、`industry`、`stocks`、`watchlist`、`verification`、`expectations`。公司标签为 `overview`、`financials`、`valuation`、`expectations`、`evidence`。正常用户导航不显示验收入口。

| Profile | 主要视觉内容 |
|---|---|
| full | 六个合成公司、两个行业与产业链、价格序列、四期财务（三表、负值与零）、观察任务与历史复盘、研究事件、来源对照与已有纯比较引擎生成的合成比较状态 |
| empty | 无观察/事件/预期/宏观/行业资料；保留一个明确为空的合成公司供检查五章节缺失状态 |
| degraded | 超长公司名、旧行情、价格序列缺口、明细失败、仅元数据、来源索引失败提示及仍保留的独立预期样例 |

场景时点固定为 `2026-09-09T10:00:00+08:00`。顶部说明和滚动可见水印均显示“界面验收样例 / 合成数据 / 不用于投资研究”。所有公司使用独立 `ui-review-*` ID 和 `DEMO*` 代码，不映射真实证券。

## 隔离实现

`Application` 在启动时分流：普通 URL lazy import 业务 `App`；验收 URL lazy import `UiReviewApp`。验收不挂载业务 App，因此不实例化 Watchlist / Expectation / Review Store，不执行业务导出，也不运行 App 的 Provider effects。

- `src/ui-review/fixtures.ts` 独立构造内存对象，没有导入真实数据集，没有进入 `src/data`、注册表或 Provider 事实源。Stock 的 `dataMode` 留空，不新增或借用业务数据模式。
- 验收容器复用实际页面组件和既有纯比较/排序函数。网络 loader 不运行。公司明细由有身份作用域的 `presentationDetails` 提供；即使为空或身份不匹配也不回退到网络加载。
- 外观选择仅在内存中生效，既不读取也不写入外观存储键。profile 只写当前 URL 和 React state。
- 导入、导出、备份、修改、复盘提交、重试等业务动作均显示隔离说明；不会打开业务备份/导入模态框，不生成下载，不调用 Store。此入口用于页面与状态验收，不声称完成业务写入流程验收。
- 退出链接删除 review 查询参数并重新加载普通首页。普通 URL 刷新正常挂载业务 App；业务记录原文保持不变。

## 验收证据

见 [acceptance.md](acceptance.md) 与 [browser-evidence.json](browser-evidence.json)。浏览器检查脚本为 `scripts/ui-review-browser-check.mjs`，针对本地 production preview 执行，使用已安装的 Playwright 与 Edge，不新增项目依赖。

复跑：先 `npm run build`，再 `npm run preview -- --host 127.0.0.1 --port 4173`。另一个终端运行 `node scripts/ui-review-browser-check.mjs`；若 Playwright 来自外置运行时，可用环境变量 `UI_REVIEW_PLAYWRIGHT_MODULE` 指定已安装模块的位置。默认输出到忽略目录 `data-cache/ui-v1-1/browser`，可以用 `UI_REVIEW_OUTPUT` 改到其他本地目录。

本票停止于普通 push。PR、main 合并和 production deploy 不在本次执行范围。远端差异待 ChatGPT 审计，Vercel Preview 视觉确认由用户完成。
