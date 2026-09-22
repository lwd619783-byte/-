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

## D1—D4 交付与实际验证

生产代码快照为 `884192d93b78367b0b062a10e1fc4b773c757c76`。D1/D2/D3及收尾使用普通独立commit；后续文档/截图提交不当作另一个已测runtime。颜色沿用HTML方向，侧栏210px、顶栏70px、主区最大1320px。工作台添加资料为深绿主动作；搜索明确只搜页面/公司。未添加新主题、库、写工具或运行器。

研究事件与个人任务分开：任务使用知识待审、研究复盘、事件核验三个真实队列；最后一类复用原 `needsDataReview`，没有复制普通公告列表冒充待办。相同状态文案只显示一次，解析和核验两个字段保留独立可访问标签。无复盘不生成该侧轨，无知识条目不生成15rem目录；错误/锁定不显示成0或空库。

知识列表与全文详情分开；维护、历史、备份/恢复、Obsidian投影在更多操作。原RMW组件和repositories维持同一挂载位置。资料以文件行呈现，添加在弹窗中；原件不会自动上传，文章备份不包含原件。行业四视图、宏观有效观测、公司池/五章、观察、验证三范围、预期同口径表和观点时间线均保留原服务及动作。逐项落点见[迁移清单](migration-inventory.json)。

| 验证 | 结果和适用范围 |
| --- | --- |
| Vitest | `d80f235`，95个文件、1211/1211；后续runtime仅事件容器CSS修正 |
| build | `884192d`，TypeScript、local typecheck、Vite、financial bundle gate通过 |
| contracts / discovery / F3 | 合同编译、test:contracts、95 suite discovery、research:eval:check、51项research-eval测试通过；不等于production admission |
| 真实App浏览器 | `884192d`，静态 `http://127.0.0.1:4202`，198/198；六宽度、200% CSS缩放、键盘、搜索回焦、旧路由、五章ID/刷新/返回 |
| Wiki / ingestion | `d80f235`同静态origin，76/76及131/131；原CREATE/同Wiki UPDATE、陈旧/重复拒绝、reload、历史只读、恢复预备份、未来版本锁定、单向ZIP与撤销拒读；合成数据，不代表本人接受 |
| Bridge | 11项服务测试及真实浏览器本地合成OAuth表单通过；PKCE、回放与外域/null Origin拒绝，不是远程ChatGPT已授权调用 |
| D3组件 | 68项几何/键盘/焦点，7子页×6宽度；before46图、after48图，另同一合成公司五章前后20图 |
| 工作台组件 | 132场景/359断言；LOADING/ERROR/LOCKED/空/长标题，1440/390截图与六宽度测量；源hash和后续CSS差异单独登记 |
| 阅读/导航/状态 | 长文6章54段12列表，目录焦点/避顶栏/局部滚动8项；长列表/阅读位置9项；四种关键状态两宽度8项 |

所有报告分别记录testedAt、origin、输入类型及runtime或源hash；不能将组件harness的旧导航壳当作正式App。见[机器证据](acceptance-evidence.json)、[截图索引](screenshot-index.json)。真实App改前92图、改后94图完整保留本地；公开归档只选隔离合成资料/空库及合成组件图，不含个人正文、原件、访问凭据。已亲看工作台、空库、窄屏资料、行业与预期代表图；子任务另记录各页有限视觉检查。截图不是完整WCAG合规证据。

### 可以复核的变化

同一fixture、Chrome、1440×900组件画布：研究事件首屏完整行从3条到8条；常规行从208px到约85.92px；原603px+603px双轨变成1260px单轨，空任务轨道下方约888px的保留空白不再生成。390×844相同fixture首屏从1条到3条。空观察提示桌面高度约219.48px→104px，手机约208.17px→142.78px；长错误自然增长，不截字。数据见[density comparison](evidence/density-comparison.json)，数值仅适用于该固定合成场景。

长列表筛选到50条、滚至2511px，打开wiki-38后浏览器Back恢复同一筛选及2511px；文章在2566px切到工作台回0，Back恢复同Wiki及2566px，reload仍为54段。同一正文未维护第二套HTML或删来源章节。引文身份与原稿E编号不猜配，Markdown/URL仍由原安全呈现层处理。

同机交替运行、每版每路由6个新context的开发服务器测量：工作台ready中位数约1169.8→1213.2ms，空知识库约1984.6→1960.2ms；有正常调度噪声，不宣称速度提升。首页两版均不挂载知识owner、不扫描全部原件；新知识空页DOM中位数328→290。定义/原样本见[性能报告](evidence/performance.json)。这是本地ready时间，不是远程网络或长文性能承诺。

### 失败保留与修复

- 前三次baseline脚本准备分别被错误模块路径、sample观察导入限制、Wiki append collection限制拒绝；修正合成fixture准备，不修改业务校验。最终92图成功。
- 开发服务器首次加载PDF/证据依赖曾触发页面重载，导致浏览器流程失效；无证据升级，改静态build后完成Wiki76/ingestion131。
- 初次全量测试1207通过、4失败：三个旧布局/标签断言及UI-review旧标题。保持业务/隔离断言，按新呈现入口更新后1211全通过，没有延长超时掩盖问题。
- App 768px原事件列溢出到793px；仅调viewport断点后，200% CSS缩放仍到1634px。最终采用实际事件容器宽度查询，重新完成198项App检查。未使用全站overflow:hidden。
- 首轮长文截图批次无后续进展而停止，未计PASS；独立同fixture及完整19路由序列未复现产品卡死。最终截图脚本逐路由独立加载、显式超时/进度，并等待待审按钮就绪；94图无页面错误。没有为此猜测性修改领域代码。
- 静态Wiki测试不能直接请求Vite `/src` fixture；仅将现有fixture本地编译为JSON注入隔离context，保留全部76项断言。

失败日志均在 `data-cache/ui-v2-1` 保留；不将历史局部通过数目相加冒充一份完整E2E。

## 回滚与验收profile

本轮不改变LocalStorage或IndexedDB的owner/键/ID，也不清旧主题偏好。每个自动浏览器都是新context；未读取个人cookies或操作原真实光通信origin。新Preview看不到原origin资料属于origin隔离，既不是删除，也不是迁移成功。需要实际资料时仍在授权origin/profile先分别保护原件、贡献包及完整Wiki历史；未实现整库跨origin恢复。

UI回退可在本功能分支普通revert本轮呈现提交，或本地独立检出 `cebe97f`；不reset/force-push、不覆盖其他worktree。受保护Preview回切仍沿用项目既有授权边界；不触发Production。前端回退不撤销知识Revision，不把文章ZIP当原件全量备份。保留基线worktree用于审计比较。

可访问性复核参考[W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)与[APG modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)；origin边界参考[IndexedDB说明](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)。本轮实测范围不等同全WCAG或真实辅助技术认证。

## Preview与独立审计

2026-09-22（北京时间）补录：普通push `26267b085b2c9ce9bc21eb31e578acab1dbfc2ed` 后，受保护[immutable Preview](https://investment-research-dashboard-ap5ric62k-lkdmkl.vercel.app) READY；deployment ID `dpl_9WTDbQbGPbzZM3HYu79phXAsc6S5`，target=null，功能分支正确。应用代码与 `884192d` 无差异，仅文档/截图/测试准备脚本不同。

在该exact origin以全新context实际运行全站浏览器 **198/198 PASS**，无runtime error、无意外外部请求；testedAt `2026-09-21T15:59:14.070Z`。匿名请求于 `15:59:20.641Z` 返回302并跳转 `vercel.com`，证明没有取消平台保护。临时平台访问仅保存在内存，不复制个人登录cookies，结束后context关闭。远程首页1440截图已亲看；正文与知识负向门禁仍按各自本地合成runtime登记，不升级为真实用户资料远程验收。见[远程报告](evidence/remote-ui-browser.json)。

本节补录为后续仅文档commit，交付Final SHA与被测Preview runtime分别报告。功能分支相对 `origin/main @ a029b1e` 为ahead，main未变；未创建PR。原光通信正式审核仍由用户决定；本轮新增UI及差异等待ChatGPT独立审计，不merge、不修改main、不部署Production。
