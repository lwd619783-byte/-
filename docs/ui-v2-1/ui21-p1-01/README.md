# UI21-P1-01 操作拒绝与 owner 读取状态

范围：仅修复独立源码审计指出的跨页误锁及对应回归；沿用 V2.1 视觉。ChatGPT 尚未独立查看受保护 Preview 的全站图片，也未独立重跑整套测试，不登记视觉验收通过。

## 基线

开始时 fetch 后：功能分支 `codex/ui-v2-clear-research-workspace`、HEAD 与远端均为 `1c73243a8b552332b89d4c960e3d84b8a4cf6d81`；`origin/main` 为 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`，ahead 11 / behind 0，工作树干净。未 reset、amend 或重写历史。历史 protected runtime `26267b085b2c9ce9bc21eb31e578acab1dbfc2ed` 不作为本次修复通过证据。

## 原因与最小适配

两个 Store 的失败结果仅含 ok / error / 原 data，既可能是业务拒绝，也可能是持久化写入失败。App 原先把所有 error 写进读取状态，再将所有研究面板标记 locked。重复观察项和预期区间下限大于上限均能经真实表单触发；底层记录和字节并未变化。

App 将本次操作错误与两个 owner 的读取错误分开。失败仍显示在当前表单或所属操作面板；通过同一个 repository.load() 核验读取，再用新增的只读 currentBaseError(base) 调用原 PersistedBaseGuard.assertCurrent 检查已捕获字节基线。新增方法只返回错误，不写库、不重新绑定旧快照、不放宽 save 的并发保护，也不按中文文案推断错误类别。业务校验保持原样。

- 普通拒绝：原快照继续可读，操作不成功，错误留在操作表面。
- 写入配额失败：保存错误仍报告；读取和捕获基线有效时允许读原快照，后续写入仍经过原门禁。
- 损坏、未来 schema、读取权限错误或已改变基线：对应 owner 保持 locked；保存仍被拒绝，原字节保留。关闭弹窗不清除任何 owner 读取错误；未成功操作的错误仍可在所属操作面板查看。
- 其他健康来源继续可读；聚合状态明确 partial、范围不完整，任务数量标“当前可读”。观察 owner 不可读时研究复盘数量显示已锁定，不把未知当 0。旧的 loading / error / locked / 真空库行为仍分别测试。

App 的样例批量入口同时去掉错误中文关键词分支：根据已有活跃记录跳过重复公司，其余真实失败保留报告。未改 source/Wiki/Claim/Thesis owner、审核决定、合同、公式、持久化键、数据模式或样式。

## 证据原则

新增 App.owner-state.test.tsx 使用完整 App、真实旧 Store / Repository / 子组件，仅控制浏览器原语与异步 provider IO。新增 ui21-state-browser-check.mjs 使用隔离完整 App、真实表单与浏览器存储；模拟数据模式和合成输入由真实入口选择。修复前失败与修复后通过均保留，同一断言不以 source-state-trace 或手工传 ready 的组件截图代替。

最早 baseline 浏览器 B/C 在 reload 后回到默认 mixed，仍可证明状态错误，但不能标作纯 mock 图片；重跑遇到 HMR 的批次明确 INVALID_RUNTIME_CHANGED，不计验收。最终截图只纳入稳定构建，并保留每份历史图自身捕获元数据。

最终本地代码 `e5c2dcb957a325e355c30392c69ccae6258916d1`；测试脚本提交 `9efc2c2ad211e2cb251697f757a4d7bd171b6f6f`。仅脚本/文档的后续 HEAD 与应用 runtime 分别登记，不能将旧通过归给任意新 SHA。各组 testedAt、输入类型、origin、runtime 见 [acceptance.json](acceptance.json) 与 evidence。

| 证据 | 实际绑定 | 结果 |
| --- | --- | --- |
| 同一最终脚本、同序129项完整 App 断言 | 1c73243，隔离静态4204 | 96 PASS / 33 FAIL，旧问题可复现 |
| 同一脚本修复后 | e5c2dcb，隔离静态4203 | 129/129 PASS，运行期间源码哈希不变 |
| 全量单测（含9项完整App集成） | e5c2dcb | 96文件 / 1,220 PASS |
| 类型 / Local Core类型 / Vite / bundle gate | e5c2dcb | PASS |
| contracts / discovery / F3 / Bridge node | dcb141f | PASS；之后仅补公司/统计呈现与测试，不变这些领域路径 |
| UI导航 / Wiki / ingestion浏览器 | e5c2dcb，4203 | 198/198、76/76、131/131 |
| Bridge原生OAuth浏览器 | e5c2dcb，独立合成服务器 | PASS，非真实OAuth验收 |
| env:check | 1c73243，开始时 | 49 PASS / 9 WARN / 0 FAIL / 4 SKIP |

合同测试含106 Local Core、78 financial Node、51定向Vitest；discovery 1；research-eval测试51、Bridge Node11。F3仍仅 REFERENCE_ONLY 33/33，Agent runtime 33 NOT_IMPLEMENTED；Industry F3 5/5不提升准入。完整日志保留各自输出，不把合成测试升级为真实人工审核。

完整 App 首轮100检查中的8项错误来自测试前提：mock模式原研究事件服务不生成provider事件。修正为通过真实表单创建合法合成预期，先验证独立事件存在，再验证重复拒绝不隐藏其ID/数量；预期owner损坏时用真实合成观察与复盘证明另一owner可读。最终脚本重跑精确1c基线与e5修复版，129项名称和顺序相同、33项从失败转通过。原失败报告保留本地；无修改业务算法来迎合fixture。

收口还补齐同一状态链的公司详情与辅助统计：锁定时不能声称“尚未加入观察清单”或把未知数量显示0；完整App负向用例覆盖公司按钮禁用、锁定提示与部分范围计数。

浏览器 runtime errors 均为空；已有 `favicon.ico` 404如实登记，不宣称控制台完全无警告。原功能/知识门禁未删改，Wiki挂载/审核实现未变。

## 图片交付

本地ZIP `research-os-v2.1-UI21-P1-01-visual-review.zip` 含32张实际App图片与README、index.html、manifest.json；[清单](visual-bundle-manifest.json)保留SHA256。16张历史资料/知识/正文/待审/设置/错误图复用公开索引，保留原运行起点d80及晚期CSS884差异说明（逐图exact runtime未知），明确 LOCAL_DEV_HISTORICAL，未改标成本次运行。16张修复相关图是 LOCAL_BUILD / e5c2dcb / 4203，1440×1000与390×844，mock模式和合成输入；modal图仅记录当时可见滚动窗口，长文图为完整文章页面。没有组件harness、用户原稿、原件、profile或秘密。

已亲看工作台1440、重复提示390、真实锁定仍保留独立事件1440；这是有限图片复核，不是全站视觉验收或WCAG合规声明。ChatGPT仍需亲自复核交付ZIP。

受保护Preview的最终绑定将在普通push后单独登记；当前为 VERIFIED LOCAL / PENDING INDEPENDENT REVIEW。

## 不变边界与回滚

不访问真实用户 origin/profile，不接受真实旧稿，不读取或导出个人 cookies，不提交原件、贡献包或秘密。真实光通信审核、同 Wiki 的真实人工 UPDATE/history 与 ChatGPT 实际撤销拒读保持原 PENDING / NOT_VERIFIED。组合与 Agent 继续未实现。

回滚在功能分支普通 revert 本次代码提交即可；不修改知识数据版本、不清空浏览器存储、不删除其他 worktree。仅普通 commit/push，等待 ChatGPT 复审；不创建 PR、不 merge、不修改 main、不部署 Production、不改部署保护或密钥。
