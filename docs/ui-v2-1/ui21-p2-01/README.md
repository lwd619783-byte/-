# UI21-P2-01 公司预期页来源状态

## 当前范围与基线

用户本轮确认 UI21-P1-01 源码及已交付证据复审通过，且已打开32张实际应用图片：16张绑定 e5c2dcb 静态构建，16张保留历史开发运行绑定。这不是完整线上视觉验收；旧审计文件不回写。

开始 fetch 核对：功能分支 `codex/ui-v2-clear-research-workspace`、HEAD/远端均为 `ffefc4bc5f298a8d317384abeb68bfd70320d1cd`，main 为 `a029b1e3b96f8b8d28ec123cd741eadc09c12e3d`（ahead16/behind0），主工作树干净。精确 ffefc4bc 另建隔离 detached worktree 和静态构建，未 reset 或覆盖其他工作树。

## 原因与改动

App 已正确排除不可读本地快照并保留健康官方来源，但未把本地读取错误传给公司页。本次只通过 `earningsExpectationReadError` / `localReadError` 将原权威读取状态传至业绩预期面板。就近提示来源范围不完整，原错误在原生 details/summary 中可访问；新增/纠正按钮引用说明并禁用。无已读取快照时明确数量未知，有健康官方记录时继续原 ID、只读、比较和来源展示。

保留 P1 的独立操作错误、load() + currentBaseError() 验证；没有新增状态 owner、持久化键、Repository/Store 改动或清错路径。普通校验和只写失败不触发新增锁定。财务、公告、验证、观察均保留各自路径。

## 验证方式

扩展 App.owner-state.test.tsx 和 ui21-state-browser-check.mjs（公司场景拆入同目录 helper）。使用完整生产 App、真实表单、Store、Repository 和 provider loader。固定回放仓库已提交公开 provider JSON，经过原 checksum/schema 校验；不是手工传 ready 的组件 harness。损坏、未来版本、读取拒绝和并发字节变更仅在临时浏览器 context 的合成本地数据注入。公开财务/指引回放仍标明其真实公开来源，不把它改标为新生成事实。首次测试脚手架的定位词及重复来源标题错误不计通过证据。

精确基线最终公司浏览器断言82项，33 PASS / 49 FAIL，无场景异常；预期的49项失败揭示缺失提示、误报空库、按钮未禁用和原因入口缺失。原始字节保持不变，官方文章内容/ID/比较不受影响。修复版应用代码为 `5f05c302f25d362f2543c95bf3b50b3a846b079c`。同一脚本、同序断言、同 helper 哈希的公司检查修后82/82通过，见 [红绿比较](evidence/red-green.json)。

| 实际运行 | 绑定 | 结果 |
| --- | --- | --- |
| 精确基线完整App浏览器 | ffefc4bc，静态4205，隔离合成owner+固定公开provider回放 | 82项：33 PASS / 49 FAIL |
| 精确基线App集成新增5例 | ffefc4bc源码 + 5f05c30测试覆盖层 | 1 PASS / 4 FAIL；另外9例未选择，不算通过 |
| 完整App状态浏览器（含原P1与新增P2） | 5f05c30，静态4206 | 210/210 PASS，运行期间源文件哈希未变 |
| 受影响路径（本次全量内的App/Repository/公司预期面板） | 5f05c30 | 3文件 / 87 PASS |
| 全量Vitest（含14项App集成） | 5f05c30 | 96文件 / 1,225 PASS |
| 类型 / Local Core类型 / Vite / bundle检查 | 5f05c30 | PASS |
| 既有全站导航浏览器 | 5f05c30，静态4206 | 198/198 PASS |
| env:check | 开始时ffefc4bc | 48 PASS / 10 WARN / 0 FAIL / 4 SKIP |

完整运行时间、输入类型及日志见 [acceptance.json](acceptance.json) 与 evidence。全量单测首次双worker与浏览器同时运行时为1,224 PASS/1条既有App用例20秒超时；记录保留，未改变其超时或断言，随后完整单worker重跑1,225通过。JSDOM保留既有scrollTo未实现提示；浏览器只有原favicon.ico 404，零页面运行异常。不宣称控制台完全无提示。

浏览器逐项覆盖：合法保存后注入损坏/未来版本/读取拒绝；真实Store拒绝与关闭弹窗；章节切换/返回/reload；外部合法字节变化后旧App基线拒写；普通区间错误、合法数值0、配额只写失败及不刷新恢复；官方记录ID/数量/全文比较/只读保持；原始字节摘要前后相同；具体原因可用键盘展开。外部合法新基线允许新App正常重新读取，并不要求跨reload永久锁定；关闭UI不会解除旧基线锁定。

未重跑的专用Wiki76、ingestion131、Bridge OAuth浏览器仍绑定e5c2dcb；contracts/discovery/F3仍绑定dcb141f。全量单测中的相关用例和既有导航本次有运行，不与上述专用浏览器门禁混淆。未修改RMW挂载、知识审核或导入实现。

## 图片

本次小型ZIP仅六张完整App图片：公司expectations健康空、损坏本地owner、保留官方来源，各1440×1000与390×844，长页原尺寸。逐图route/viewport/state/runtime/time/输入与文件SHA256见 [screenshot-index.json](screenshot-index.json)。全部LOCAL_BUILD/5f05c30，不混入harness或旧图。已查看锁定390与官方保留1440，保留暖灰/绿既有视觉，不作全站视觉验收声明。

ZIP `research-os-v2.1-UI21-P2-01-visual-review-5f05c30.zip`，2,002,973字节，SHA256 `1870e0d9d94dfdbeae2b7e0ab2c10b9d730e4c8816842e60d824d2d0e5d27de9`。本地Downloads有可直接附带副本，仓库仅保存无敏感元数据。旧32图包不变。

## 受保护 Preview 与停止点

[已测immutable Preview](https://investment-research-dashboard-df0fgw0xi-lkdmkl.vercel.app)：deployment `dpl_7CRL899ztwgEzS6gB431sqPiu2vB`，runtime `eefa8b5e13d52a349eb74998140b831cd3009794`，READY、target=null、目标功能分支正确。与本地应用5f05c30的src/public/server/contracts/package文件无差异；后续仅证据/CURRENT更新，不把Final误写为已测runtime。

同一exact origin：公司状态82/82、导航198/198通过，零页面运行异常；公司状态控制台记录为空。公司测试开始于2026-09-22T04:56:11.079Z；详细时间、输入及隔离context见 [preview.json](preview.json)。匿名检查04:56:37.485Z为302至vercel.com，保护未关闭。平台临时访问只保存在内存，浏览器结束即清理，未读取个人profile/cookies。

当前为 LOCAL AND PROTECTED PREVIEW VERIFIED / PENDING INDEPENDENT REVIEW。本次仅普通commit/push，Final与远端关系由最终Git核对提供；已核对main仍为a029b1e。首次push遇到TLS EOF，原命令普通重试成功，无鉴权/保护配置调整。

## 不变范围

仅本 P2 展示遗漏，不重定性为 P1 修复失败或新引入故障。真实旧稿、同 Wiki 人工更新、ChatGPT 实际撤销拒读保持原状态；组合与 Agent 未实现。Wiki/导入/OAuth 实现未动，未重跑的门禁继续引用其原 SHA，不算新运行。

回滚使用普通 revert 本次 UI 提交即可；不回滚知识版本或清空浏览器数据。仅普通 commit/push 功能分支后停等复审，无 PR、merge、main、Production 或保护配置修改。
