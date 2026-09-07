# P0 可信展示纠偏 V1 · 验证记录

状态：**已实现，待独立远端审查/合入；存在本地基线验收阻塞，不宣称全项通过。**

- 实际 base：`799bb3903aa029c655e502557ee6b5b99204cf86`，fetch 后建立 `fix/p0-data-trust-display-v1`。
- 执行顺序与停止点：[开发执行索引](development-execution-plan-2026-09-07.md)。本轮不进入 Phase 1A。
- 最终 HEAD / 远端 SHA 在推送后核验，见任务交付记录；此记录随实现提交，不自称独立审查通过。

## 改动与自审

| 文件 / 区域 | 目的 |
| --- | --- |
| `src/components/dashboard/MacroTab.tsx`、`src/data/macroData.ts` | 删除条数加分、固定兜底分、方向图和静态结论/日期兜底；保留原值、分类、来源状态、报告期、原始说明、空态；单位仅从原值提取，不凭指标名称猜测或重复追加 |
| `src/utils/dataTrustDisplay.ts`、`src/utils/dataQuality.ts`、`src/hooks/useDisplayNow.ts`、`src/components/common/QuoteTrust.tsx` | 共用严格日期解析、可注入时钟与运行时分钟级刷新；分别展示来源、覆盖、采集/生成/观测/发布/报告期；未来、非法、缺失不算正常新鲜 |
| `src/services/dataProvider.ts`、`src/services/stockProvider.ts` | 行情覆盖只取行情记录，不用真实公司资料替代；行情采集窗口不受其他模块的新时间影响；缺失数据包时间不回退 |
| `src/App.tsx`、`HomePage.tsx`、`Header.tsx`、`RightRail.tsx`、`StockPool.tsx`、`StockCard.tsx`、`StockDetailDrawer.tsx`、`RoboticsStockSection.tsx` | 接通相同展示语义；“最新价”改为“快照价格”；停止从采集日期推断交易日；筛选明确为行情采集窗口；均值标明有值样本分母 |
| 相关 tests、执行索引、`docs/feature-registry.md` | 固定时钟边界与真实用户可见行为回归；固化 P0 → Phase 1A → Phase 1B 及审查停止点 |

自审覆盖来源状态不变、时间阈值边界、未来/非法/缺失/月季度日期、混合状态/全缺失分母、历史值保留、组件点击/筛选/空态、窄屏换行与 Git 范围。没有修改合同、生成数据、依赖或权限。重复宏观指标仍按展示条目计数，已明示未去重。

## 命令与结果

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `npm run agent:skills:check` | 0 | 现有三个项目 Skill 存在；未安装/升级 |
| `npm run env:check` | 0 | READY WITH WARNINGS：36 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| `npm run --silent env:check:json` | 0 | 同样为 READY WITH WARNINGS |
| `npm test` | 1 | 1623 用例通过；两个嵌套工作树的 Node 测试文件被 Vitest 误扫，报 No test suite found |
| `npm test -- --exclude 'data-cache/**'` | 0 | 当前分支完整测试：38 文件 / 559 用例通过；仅排除非本分支工作树，不改脚本或门禁 |
| `npm run data:audit` | 0 | 297 扫描文件，29 注册项，0 blocking / 24 warnings（P1 10、P2 14） |
| `npm run build` | 0 | TypeScript、Vite 与数据 bundle gate 通过；保留现有 chunk size 提示 |
| `npm run ui:audit` | 0 | 静态检查，不能等同浏览器验收 |
| `git diff --check` | 0 | 无空白错误 |
| `node scripts/generate-company-guidance-expectations.mjs --check` | 1 | 只读追加排查：基线 generated 文件字节/校验和不匹配，见下方 |

环境 WARN：Node/Python/Git 多路径；`requirements-data.txt` 四项 Python 依赖未固定版本；mootdx 要求 httpx <0.26，但本机为 0.28.1；`.ssh-private` / `.provider-observations` 未命中 ignore；四个旧 generated 文件缺 schemaVersion；公告 30 项 partial；旧 announcements 聚合文件未被当前同步 Provider 消费；另有本轮未提交修改提示。除未提交修改外均为已有环境/数据状态，本轮未改变这些配置或材料。

环境检查内 SKIP：有写副作用的 A 股总校验、Provider 健康摘要、UI 报告，以及依赖 dist 的 bundle 检查；本轮已另跑 UI audit 和包含 bundle gate 的 build。未跑任何实时抓取 / data:refresh，也未扩大到无关 Provider 离线测试。审计命令生成的旧报告时间戳已清理，不回写历史报告。

## 真实浏览器证据与阻塞

2026-09-07 使用本地 Vite + Codex 浏览器实际交互（非 jsdom）：

- 首页、宏观页分别核验 1440×1000 与 390×844；页面 scrollWidth 分别为 1425 / 375，无页面级横向溢出。宏观明细表保留内部横向滚动。
- 首页显示采集已过 63 天、24 小时内 0/59，仍保留真实来源；Mock 切换后价格覆盖 0/59、时间缺失 59/59，切回 Mixed 恢复历史快照。
- 宏观页未出现评分图；政策分类可选中，中文长日期正常换行；就业保留缺失，空分类可打开；`5%` 不再显示成 `5%%`。
- 个股池“行情采集24小时内”筛选为空，“行情来源真实”仍可打开中科曙光详情。旧价格与来源继续可见。
- 浏览器捕获的 console error / warn 为 0。页面业务告警仍有 **Company-guidance byteSize mismatch for workflow index**，不能因此称全应用 E2E 通过。
- 截图作为本次任务本地附件保留（首页/宏观，桌面/窄屏）；不把全页拼接截图的工具渲染异常作为 UI 证据。

基线阻塞证据：`core.autocrlf=true`；工作树 `workflow-index.generated.json` 为 244979 字节，base Git blob 为 240254 字节；4725 个 CRLF，归一到 LF 后与 base 完全相同。相关 generated 文件和校验代码对 base 无 diff；只读指引 check 也报 checksum mismatch。本轮禁止修改真实 generated 数据，故保留原样。合入前需在不改数据内容的受控 checkout 验证字节完整性，并复核最终 HEAD 的 CI。嵌套工作树误扫也需在干净 checkout 重跑原始 `npm test`。

使用 Skill：`investment-dashboard-ui-workflow`、`react-best-practices`；读取 `agent-browser` 后确认 CLI 不可用，改用 `computer-use` / CUA 浏览器工具。未使用多 Agent，未安装新工具平台。

停止边界：仅普通 commit / push 至功能分支，待独立审查；不创建 PR、不合并 main、不继续 Phase 1A，不代表生产准入。
