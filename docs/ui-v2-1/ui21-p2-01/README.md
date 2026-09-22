# UI21-P2-01 公司预期页来源状态

## 当前范围与基线

用户本轮确认 UI21-P1-01 源码及已交付证据复审通过，且已打开32张实际应用图片：16张绑定 e5c2dcb 静态构建，16张保留历史开发运行绑定。这不是完整线上视觉验收；旧审计文件不回写。

开始 fetch 核对：功能分支 `codex/ui-v2-clear-research-workspace`、HEAD/远端均为 `ffefc4bc5f298a8d317384abeb68bfd70320d1cd`，main 为 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`（ahead16/behind0），主工作树干净。精确 ffefc4bc 另建隔离 detached worktree 和静态构建，未 reset 或覆盖其他工作树。

## 原因与改动

App 已正确排除不可读本地快照并保留健康官方来源，但未把本地读取错误传给公司页。本次只通过 `earningsExpectationReadError` / `localReadError` 将原权威读取状态传至业绩预期面板。就近提示来源范围不完整，原错误在原生 details/summary 中可访问；新增/纠正按钮引用说明并禁用。无已读取快照时明确数量未知，有健康官方记录时继续原 ID、只读、比较和来源展示。

保留 P1 的独立操作错误、load() + currentBaseError() 验证；没有新增状态 owner、持久化键、Repository/Store 改动或清错路径。普通校验和只写失败不触发新增锁定。财务、公告、验证、观察均保留各自路径。

## 验证方式

扩展 App.owner-state.test.tsx 和 ui21-state-browser-check.mjs（公司场景拆入同目录 helper）。使用完整生产 App、真实表单、Store、Repository 和 provider loader。固定回放仓库已提交公开 provider JSON，经过原 checksum/schema 校验；不是手工传 ready 的组件 harness。损坏、未来版本、读取拒绝和并发字节变更仅在临时浏览器 context 的合成本地数据注入。公开财务/指引回放仍标明其真实公开来源，不把它改标为新生成事实。首次测试脚手架的定位词及重复来源标题错误不计通过证据。

精确基线最终公司浏览器断言82项，33 PASS / 49 FAIL，无场景异常；预期的49项失败揭示缺失提示、误报空库、按钮未禁用和原因入口缺失。原始字节保持不变，官方文章内容/ID/比较不受影响。修复后运行绑定及最终矩阵随后登记。

## 保持的边界

仅本 P2 展示遗漏，不重定性为 P1 修复失败或新引入故障。真实旧稿、同 Wiki 人工更新、ChatGPT 实际撤销拒读保持原状态；组合与 Agent 未实现。Wiki/导入/OAuth 实现未动，未重跑的门禁继续引用其原 SHA，不算新运行。

回滚使用普通 revert 本次 UI 提交即可；不回滚知识版本或清空浏览器数据。仅普通 commit/push 功能分支后停等复审，无 PR、merge、main、Production 或保护配置修改。
