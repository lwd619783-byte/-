# 独立安全迁移完整性清单

固定测试代码：`efc8e6ca8dadf4f89d5b193729acfebd2e2a41cd`。以下为本地结果，父端独立审计与新分支Node22 CI尚待执行。分支依赖未合并PR87/86；安全审查差异范围为`fd0009d..HEAD`。

| 项目 | 证据与结果 |
|---|---|
| 干净安装/固定工具链 | Node24.19.0/npm11.9.0；npm ci exit0；Tailwind/PostCSS4.3.3，Vite6.4.3 |
| 漏洞前后 | 完整audit 5 high→0；production 0→0；旧braces链移除，未使用audit fix force/同版本override |
| 安全CI门禁 | 两条audit命令本地exit0；含所有依赖的high/critical阻断，无continue-on-error；原CI步骤/触发/权限保持 |
| 全量/专项 | 120文件1590；demo 2 Node+67 Vitest；合同106+78 Node/162 Vitest；contracts:validate与discovery通过 |
| 正式/demo构建 | 均exit0；正式资产29项检查无demo入口，demo图1628模块/455受限长文本/秘密模式0命中 |
| 桌面/窄屏与导航 | 1440/1920/390，展开/收起、键盘、焦点；新199/旧102浏览器检查通过 |
| 决策语义 | 建议与版本确认分离、取消不写入、重复禁用、更新后旧确认失效、日期未知传播、历史保留；源业务代码不变 |
| 模拟语义 | 20只唯一、5%/100%、快照冻结、两种交易日口径、缺失/未来行情、停牌/涨跌停、未成交/待退出、重复推进、取消/导入导出、冲突原子拒绝；原67测试及199浏览器检查复跑 |
| demo视觉 | 30状态几何/计算样式完全一致；21帧全部0像素差异（20桌面+1小屏） |
| 正式CSS A/B | 同一正式JS合成ui-review入口对照旧/新CSS；12状态元素几何和非颜色样式一致；8桌面帧差异0/17/17/25各重复两宽度，最大通道差1，预先公开32像素阈值 |
| CSS焦点探针 | border/radius/ring/outline/hidden；3帧差异1/0/1像素，最大通道差1 |
| 隔离与回归范围 | 业务/数据/合同/来源/审计链/隔离插件及原两浏览器测试源代码零改动；正式验收入口不触碰业务存储/服务 |
| 历史证据 | 原89/58/80项manifest和所有字节保留，由verify-evidence.mjs独立验证 |
| 失败保留 | npm默认缓存ENOENT、正式CSS严格比较失败、构建尚未结束时提前截图ENOENT与重试全部保留；无失败改写为通过 |
| 预期非零 | 最终npm explain braces exit1表示依赖不存在，明确单列；其余27条固定SHA命令均exit0 |
| 权限边界 | /opt/containerd拒绝路径已停止；既有GraphQL Forbidden未重试或绕过；无模型/服务配置调整 |
| 发布边界 | 本分支自动部署false；无PR创建/merge/deploy/trade；旧分支仍是原5high依赖，不能把新分支修复追溯成旧分支通过 |

## 证据入口

- [完整回执索引及限制](verification.json)；[命令/退出码/时间/原始日志](evidence/commands/)
- [完整audit前](evidence/audit-before.json)、[后](evidence/audit-after.json)、[production后](evidence/audit-after-production.json)、[完整依赖树](evidence/tree-after.json)、[构建链](evidence/toolchain-after.json)
- [新浏览器199检查](evidence/round-one-browser/report.json)、[旧浏览器102检查](evidence/legacy-browser/report.json)
- [demo全状态/截图hash](evidence/visual/report.json)、[正式CSS A/B](evidence/comparisons/security-final-formal-compare.json)、[焦点探针](evidence/comparisons/security-final-style-compare.json)
- [文件hash清单](evidence-manifest.json)，仓库根运行`node docs/tailwind4-security-20261017/verify-evidence.mjs HEAD`核对实际Git blob。

基线390截图与最终390截图字节及hash完全相同，只存一份，verification.json显式记录去重映射。199检查的重复截图不再复制；报告保留全部hash，所需页面由visual目录覆盖。诊断保留失败相关截图与报告，不混作固定SHA结果。

Safari16.4/Firefox128/旧浏览器未实际验证。正式ui-review原有提示条侧栏遮挡在旧CSS同样存在；未借迁移重做页面。完整正式私人工作流没有执行。本地安全目标已满足，不等于生产准入、真实策略有效性或成交证明。
