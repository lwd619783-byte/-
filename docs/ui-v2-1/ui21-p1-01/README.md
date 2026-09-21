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

测试绑定、图片清单与 Preview 将在最终证据中补录；此代码检查点仍为 PENDING VERIFICATION / INDEPENDENT REVIEW。

## 不变边界与回滚

不访问真实用户 origin/profile，不接受真实旧稿，不读取或导出个人 cookies，不提交原件、贡献包或秘密。真实光通信审核、同 Wiki 的真实人工 UPDATE/history 与 ChatGPT 实际撤销拒读保持原 PENDING / NOT_VERIFIED。组合与 Agent 继续未实现。

回滚在功能分支普通 revert 本次代码提交即可；不修改知识数据版本、不清空浏览器存储、不删除其他 worktree。仅普通 commit/push，等待 ChatGPT 复审；不创建 PR、不 merge、不修改 main、不部署 Production、不改部署保护或密钥。
