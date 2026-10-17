# 合成投研 OS 桌面布局 · 2026-10-17

本轮只改独立 demo 的布局与导航。沿用 `feat/research-os-round1-no-deploy`，基线 `7cfcc0a4e5aae95e386beeaa0ab5d8b125a9a4b2`；仍依赖未合并 PR86 `f64b64a4d2c24a7f3ddc4d6a329091cc983f53ce`。不改运维看板、正式 App、依赖、模拟规则或数据合同。

父端提供：R1 已独立审计；draft [PR87](https://github.com/lwd619783-byte/-/pull/87) 在基线 SHA 的 Node22 [CI 38937609865](https://github.com/lwd619783-byte/-/actions/runs/38937609865) 通过。实施端 Git transport 核验工作分支与 PR87 HEAD 同为该基线，main 仍为 dbb58bc，PR86 HEAD 仍为 f64b64a。`gh pr view` GraphQL 查询返回 Forbidden / exit1，未重试该接口或绕过；draft 状态和旧 CI 结果是父端提供，不冒充实施端独立核实。当前新代码的 CI 不继承旧结果。

## 范围

- 整体可收起侧栏，四组导航：决策总览、行业与个股、超跌模拟、历史复盘。各组可折叠，当前项高亮；原生按钮支持 Tab、Enter、Space，Escape 收起导航并将焦点送回开关，切换功能聚焦标题。
- 总览展示三条合成建议、条件、日期、未知状态与确认数量。个股详情只展示选中公司；知识索引、模拟和历史各有主区。行业功能明确未接入，不凭空制造研究。
- 决策确认、阅读、建议版本与模拟轮次仍在当前会话内保留；刷新重置。历史可见旧版确认，确认不表示成交。旧证据链入口保留 Thesis / Expression。
- 保留浅色演示风格，1440 / 1920 桌面优先，390 小屏导航按需展开且选择后收起。导入导出、锁定、退出等业务语义不改。

## 验证与交付

固定代码 **`34e23a4eee12d8a84b8d3306249fe913e2a07cd4`** 已普通推送，工作分支与 PR87 HEAD Git 回读一致。Node **24.19.0** / npm **11.9.0** / Chromium **154.0.8037.57**；这是实施方本地结果，不冒充 Node22 CI 或父端独立审计。

- 全量测试：120 files / **1590 PASS**；demo：2 Node + 67 Vitest PASS。
- contracts:validate PASS；合同测试 106 + 78 Node / 162 Vitest PASS；discovery PASS（120 suites，3 个预期负向控制）。
- 正式/demo build PASS；demo 隔离扫描 1628 modules、7 restricted sources、455 long literals，秘密/受限内容匹配0；正式运行时、模拟引擎与规则、依赖、部署与CI配置均未改。
- 新浏览器 **199 PASS**（1440 / 1920 / 390）；旧证据链 **102 PASS**（320 / 390 / 1536，仅回归、不保存旧流程截图）；零运行时错误/意外请求/弹窗。
- `ui:audit` PASS；生成的唯一报告时间戳变更保留原始 patch 后还原。完整 `npm audit --json` **exit1 / 5 high**，发布仍阻断。
- 14 条固定 SHA 验证命令均从干净工作区启动；26 条实施阶段命令回执及完整日志保留。初次旧浏览器默认缓存缺失 exit1，指定已安装 Chromium 后成功；未安装浏览器或绕过权限。

[汇总回执](verification.json) · [完整性清单](evidence-manifest.json) · [覆盖清单](CHECKLIST.md) · [浏览器报告](evidence/browser/report.json) · [完整依赖审计](evidence/audit.json)

每条命令保留完整日志、时间、退出码与代码 SHA；截图来自哈希核验后的本地实际演示产物，不使用静态设计稿。交付桌面截图覆盖总览、展开导航、个股、知识索引、独立模拟和历史；仅一张小屏截图。最终结果另见本目录 verification.json 与 evidence/ 清单。

## 不变限制

仅合成 demo，不接正式账户或私人研究，不代选真实股票，不做真实交易；内存状态不是持久系统。Notion 仅占位索引；决策确认/阅读/建议版本未提供导出，模拟备份只含模拟轮次。没有浏览器 Back 路由。

日级模拟使用当日完整 bar 的合成假设，不证明真实盘中执行或 PIT 无前视；最终清算收益包括延期退出收益，没有独立第20日估值快照。两三轮不证明策略稳定有效。全部既有规则边界及未知/未成交/待退出状态保留。

5 high 依赖风险继续阻断发布。分支自动部署开关仍为 false；未 merge、未部署、未获正式准入。完成后只交父端独立审计，本执行不创建新 PR 或更改已有 draft 状态。

## 实际截图

截图绑定上述代码 SHA；viewport 高960，整页 PNG 尺寸与 UTC 时间详见 verification.json。总览截图保留跳转到主区后的键盘焦点框；展开导航截图保留组按钮焦点框。没有裁剪或修饰截图。

| 页面 | 1440 桌面 | 1920 桌面 |
| --- | --- | --- |
| 总览 | [查看](evidence/browser/1440-home.png) | [查看](evidence/browser/1920-home.png) |
| 展开分组 | [查看](evidence/browser/1440-expanded-navigation.png) | [查看](evidence/browser/1920-expanded-navigation.png) |
| 个股决策卡 | [查看](evidence/browser/1440-individual-decision.png) | [查看](evidence/browser/1920-individual-decision.png) |
| 独立模拟 | [查看](evidence/browser/1440-simulation.png) | [查看](evidence/browser/1920-simulation.png) |
| 历史入口 | [查看](evidence/browser/1440-history.png) | [查看](evidence/browser/1920-history.png) |
| 知识索引 | — | [查看](evidence/browser/1920-knowledge.png) |

[唯一小屏截图：390 总览](evidence/browser/390-home.png)。本轮只更新已有 draft 的分支，最终证据提交不改实现。下一步为父端独立审计；新 HEAD CI 状态未从受阻 API 独立核实。

父端可从仓库根目录运行 `node docs/research-os-desktop-20261017/verify-evidence.mjs HEAD`：逐项核验三轮清单的 Git blobs，并确认测试代码之后无运行时代码变化。清单不包含自身；命令原始日志与 patch 保留原始空白，源码/说明文档 whitespace 检查单独排除这两类原始证据。
