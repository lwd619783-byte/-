# UI V2.1 信息层级与空状态校正

## D0 冻结与范围

用户已确认随附V2.1方向。继续未合入的 `codex/ui-v2-clear-research-workspace`，起点及远端均 `cebe97fda751c58c3d2c5a14e167452226e53cbe`；fetch后的 `origin/main=a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，ahead/behind=3/0，无PR，初始工作树干净。被测前版源代码固定在独立detached worktree，其他已有工作树不改动。

原UI V2 Preview runtime `5d2e5d46351bbafac4c9c0de108c6d8608dfbad9` 与D0 HEAD的生产代码相同，后者仅追加文档。此次改前截图使用 `http://127.0.0.1:4200`、cebe97f源码、临时Chrome context；不是远程真实用户workspace。后续改后runtime单独记录，不继承前版PASS。

参考HTML摘要 `48c824d8af479f621299594c61524b5ea747fb31d05b98e28e7e657cba1bd1f9`。仅作为呈现参考；不执行原型脚本，不导入合成业务、演示审核或示例路由。React18/Vite6/Tailwind3保持；暖灰/灰绿/深绿token不改。UI workflow + Taste用于诊断，用户明确样式与数据约束优先，不添加字体、图像、依赖或装饰动画。

CURRENT、原迁移清单、UI V2验收与路线图均已读取。4.4 Portfolio Exposure MVP、4.5 Research Bridge / Controlled Tool Layer、4.6+ Research Agent / Artifact / Global Coverage继续原顺序/范围；未新增组合、自动研究、公开抓取或写工具能力。原真实光通信稿本人决定、真实同Wiki UPDATE/history/ChatGPT revoke拒读继续PENDING/NOT_VERIFIED；不将Stage4.3写CLOSED。

env:check实际49 PASS / 9 WARN / 0 FAIL / 4 SKIP；未修改环境或降低检查。初次截图脚本有导入路径错误，第二次合成观察的sample记录被原校验正确拒绝；改为显式隔离的synthetic user记录后重跑，失败报告保留本地。不是用户业务写入，不改owner验证。

## 已定位的问题与改法

| 表面 | D0代码/视觉线索 | 本轮落点 | 保留一级限制 |
| --- | --- | --- | --- |
| 工作台 | 大Hero、泛研究问题框、未实现最近阅读 | 紧凑入口、我的观察、实际待办 | owner未就绪不可写0，存储错误可见 |
| 研究总览 | ResearchInbox固定双列、事件长卡；重复KPI说明 | 可组合事件行与复盘展示；空轨道不生成 | 仅元数据、未核验、未知记录日期、范围分母 |
| 知识库 | 固定15rem空列表、维护卡占首屏 | 列表/完整详情分层、更多工具 | 具体来源限制、锁定、历史只读、正文完整 |
| 任务 | 再次渲染完整Inbox、普通公告混入 | 知识待审/研究复盘/事件核验三队列 | 原needsDataReview选择规则和owner计数 |
| 资料与连接 | 添加表单和长解释常驻、四分类重复 | 文件列表+添加流程；资料/整理/桥 | 不自动上传、失败原件可下载、解析/审核分开 |
| 设置 | 三张大说明卡 | 设置行与就近帮助 | 文章备份不含原件、单向导出 |
| 研究子页 | 说明/KPI/空趋势与多面板堆叠 | 主数据优先、低频筛选/口径收纳、行业分视图 | PIT/来源/不可比/当前观点不完整仍可见 |
| 全局 | 主区40—55px横padding、浮动筛选可能压住标题 | 24—32px横padding，1320px主区，筛选占正常流 | 数据模式始终可辨，正文不缩成小字 |

## 数据与回滚

沿用现有Source/Wiki/Watchlist/Creator/Expectation owner、ID、持久化和审核服务。仅在隔离浏览器写合成测试记录；不读取个人cookies，不复制profile，不操作旧真实origin。文章备份不包含原件；没有新增整库跨origin迁移。修改前后UI回滚不撤销知识版本，不清整个storage空间。

阶段提交采用普通commit，不amend/reset/force-push；最终只push功能分支，等待独立审计。不创建PR、merge、修改main或部署Production。后续验收与截图索引在本目录追加，不回写旧审计。
