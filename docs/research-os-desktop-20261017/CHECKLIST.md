# 桌面轮次审计清单

- [x] 基线工作区干净；远端分支与 PR87 同为 7cfcc0a，PR86 f64b64a；基于原分支继续，未覆盖/force push。
- [x] 四分组导航，整体与分组折叠；active aria-current、Tab、Enter、Space、Escape、skip link与标题焦点在实际浏览器验证。
- [x] 总览无详细确认操作；个股主区只有所选卡；知识索引、模拟、历史和旧证据链各有入口。
- [x] 读/决策确认分开、取消不写入、重复确认禁用、旧版本过时但留存；跨总览/索引/个股/历史保持状态。新增组件测试验证视图切换。
- [x] 模拟 draft筛选与locked快照跨页保留；20只唯一、每只5%总100%、19/21只不能锁、锁定不可回改。
- [x] 合成交易日计数、缺失/异常行情不成交、20日受阻待退出、22日最终清算含延期；规则/候选/锁定历史保留。模拟源码与工作区组件均相对7cfcc0a零改动。
- [x] 导入预览/取消/确认，跨刷新roundtrip，重复noop，冲突拒绝，formal scope及多活动轮次拒绝，拒绝不部分写入。
- [x] 没有机会保留候选并跳过；期间不替换、不再平衡；不代选真实股票。
- [x] 1440、1920、390核心流程无横向溢出；旧Thesis/Expression320、390、1536回归通过。
- [x] 11桌面+1小屏实际截图；代码SHA、UTC捕获时间、viewport/PNG尺寸、hash绑定，逐张查看。预检截图未交付，预检报告明确不作为最终截图证据。
- [x] CSP、memory-only、formal storage sentinel、禁用服务、来源链接四种原生操作无意外外联；原demo边界门禁未削弱。
- [x] 14条最终命令退出码和完整日志，预检失败/成功重试均保留；日志原始字节不清理空白。
- [x] 发布阻断：npm audit exit1 / 5 high；不升级重大依赖，不merge、不部署、不接真实账户/研究/交易。
- [ ] 父端对新代码与证据独立审计。
- [ ] 新HEAD Node22 CI由父端核实；实施端GraphQL Forbidden已停止该路径，未以旧CI充当新CI。

证据入口：`verification.json`、`evidence/browser/report.json`（199checks）、`evidence/legacy-browser/report.json`（102checks）、`evidence/desktop-final-*.json/.log`、`evidence-manifest.json`。原第一轮与R1的89/58文件清单仍须逐字节核验，不能被本轮截图替代。
