# UI V2 验收与交付

状态：PROTECTED PREVIEW VERIFIED / PENDING INDEPENDENT AUDIT。代码基线是已合入的 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`；前端主体实现 `4cd54415c899af24ca84ea61f41479377881fd48`，最后阅读控件修正 runtime `5d2e5d46351bbafac4c9c0de108c6d8608dfbad9`。最终文档提交与被测 runtime 分开记录。不创建 PR、不 merge、不改 main、不部署 Production。

## 外观与功能

以用户提供 HTML 的视觉为准：精确采用暖灰画布、灰绿侧栏、深绿强调色，以及 210px/70px 框架、10px 卡片圆角、按钮、页签和文章排版。工作台不填入原型模拟任务或研究结论。桌面与390px合成空工作区截图见 [桌面](screenshots/home-1440.png)、[窄屏](screenshots/home-390.png)。两张截图来自下列受保护Preview的5d2e5d4 runtime、隔离合成context。

33项[迁移清单](migration-inventory.json)保留旧路由、动作、owner、持久化与新落点。工作台、研究下的原宏观/行业/公司/观察/验证/预期/观点模块、知识库、任务、资料与连接、设置均接原数据与服务；组合显示明确未连接。搜索目前定位页面与公司研究池，不声称已有跨资料全文检索或Agent执行器。

## 实测证据

每组命令、runtime SHA、origin、deployment ID、时间与输入类型见 [机器证据](acceptance-evidence.json)。单元与本地构建没有deployment ID，不能用云端READY代填。UI浏览器、旧Wiki、导入和真实原稿阅读分开计数，重叠断言不累加成独立业务案例。

- 主体实现：1194/1194 Vitest；build、contracts:validate、test:contracts、test:discovery、research:eval:check、test:research-eval、test:knowledge、静态UI/data audit、迁移清单检查通过。env:check为49 PASS / 9 WARN / 0 FAIL / 4 SKIP，警告仍是环境依赖/历史资料完整性，未以降级规则消除。
- 全站浏览器198/198：15旧/新入口、刷新、公司五章与同对象返回、行业query、搜索与清除、Modal键盘焦点/Esc、320/390/768/1024/1440/1920、CSS 200%重排、reduced-motion、旧偏好字节不清除、未来能力空状态。此结果不代表完整WCAG认证。
- 导入浏览器127/127：隔离合成原件、CREATE、同Wiki UPDATE、完整历史、重复/陈旧版本拒绝、混合批次、reload与撤销门禁，零运行错误和意外外部请求。这些合成审核不是用户本人接受。
- 最后阅读修正：27/27定向组件测试及build通过；旧Wiki完整浏览器71/71，含精确ID深链/返回/reload、历史、备份恢复、确定性ZIP、Obsidian单向投影、外部编辑不回写、损坏与未来schema锁定。原件/知识/审批owner和权限没有改动。
- 真实旧正文55/55：只读harness使用生产阅读器呈现37254字符、六章、788个text/code叶节点，全部来源日期/摘要标识保留；未导入、未接受、无外部请求、未创建业务存储。真实原稿与截图仅在gitignored本地证据中，不提交公开仓库。
- 独立Bridge浏览器验证原生OAuth表单、Origin、PKCE、callback、重放与foreign/null Origin拒绝；使用本地进程与synthetic origin，不宣称真实ChatGPT账号调用通过。F3 reference合同与actual deterministic service的原有限制保持不变。

初次运行有过测试选择器与加载时序失败：旧首用文案、懒加载历史目录summary、Vite构建目录更新及12s加载等待。修正测试后完整重跑，未删安全断言；失败报告保留在本地，最终报告分别绑定实际runtime。颜色测试期望同步到用户最新原型精确色值。

## 真实验收与数据边界

原光通信真实run在旧专用origin/profile只读复核仍为PENDING，正式Wiki/Revision/Review与处置均0。本人CREATE决定、同Wiki真实UPDATE/历史、真实ChatGPT撤销后拒读仍未完成；既有代码合入不等于原范围完整PASS，也不等于Stage4.3 CLOSED。

旧IndexedDB原件留在旧origin。新Preview采用隔离浏览器context；看到空库不是数据丢失或迁移成功。Wiki备份不包含全部原件，尚未实现完整跨origin资料迁移。未复制个人cookies、未改密钥/权限、未清浏览器存储。回滚与数据保护步骤见 [实现说明](implementation.md#数据保护与回滚)。

4.4 Portfolio Exposure MVP、4.5受控工具层、4.6+研究Agent的真实执行、公开检索快照登记、自动待审提交均未在本轮实现。只读Bridge没有升级为写库工具。

## 同环境性能

在同一Chrome进程、同一机器与相同Vite preview版本/选项下，各3次独立冷context。基线a029加载中位数49.0ms，候选5d中位数40.7ms；初始JS encoded bytes由745191增至751725（+6534）。样本少且为本地空工作区，仅记录观测，不推断显著提速或生产性能。完整样本在机器证据performance字段；没有设置虚构阈值。

## 受保护 Preview

[打开实际页面](https://investment-research-dashboard-i5e836hz5-lkdmkl.vercel.app)。deployment `dpl_HHXeUd1GjGiRw2JUCiuh7WvMjyAn`，exact runtime `5d2e5d46351bbafac4c9c0de108c6d8608dfbad9`，Git触发的Preview `target=null`，平台状态READY。匿名访问于2026-09-21T14:23:20.022Z返回302到vercel.com，保护没有取消。

在该exact origin另跑全站浏览器 **198/198 PASS**，零运行错误、零意外外部请求；时间及逐条断言在机器证据remote-ui-browser项。访问使用内存中临时平台会话、全新合成context，测试后关闭；未接管个人profile、未持久化登录凭据。远程Wiki真实资料、本人审核与ChatGPT真实调用不由此升级通过。

后续文档提交仅补本报告、机器证据、迁移索引与合成截图；使用上述不可变Preview作为本轮被测交付，不把分支alias的新构建自动当作同一验收。普通push后停止，等待ChatGPT对相对main真实差异独立审计。

临时性能基线的停止服务已完成。删除其本地worktree的清理命令被自动审批返回blocked by policy，因此目录保留；不影响交付，也不将其计为用户资料或正式工作树。
