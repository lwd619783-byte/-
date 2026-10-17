# Tailwind 4 独立安全修复 · 2026-10-17

基线 `fd0009db95148e72f6e8804b37618634274c588c`，新分支 `fix/tailwind4-security-no-deploy`。用户已批准受控 Tailwind 4 大版本迁移，不扩展其他重大依赖或业务。原 PR86/87 与桌面分支不改写、不合并；新分支自动部署明确禁用。

开工 Git transport fresh read：工作分支/PR87 为fd0009d；PR86为f64b64a；main为dbb58bc。父端提供该HEAD Node22 CI #185/run38991677421成功54/54；实施端不重试既有GraphQL Forbidden路径，新分支CI/草稿PR由父端核实。

## 依据与边界

2026-10-17重新读取[GitHub公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)：braces≤3.0.3，尚无修复版本，递归处理深嵌套模式可耗尽调用栈。锁文件已为3.0.3，不能以override到同版本修复。完整基线audit exit1，5 high是braces经chokidar、micromatch、fast-glob、Tailwind传播；dev标签不免责。

[npm registry](https://registry.npmjs.org/tailwindcss/4.3.3)确认4.3.3可用；[官方发布](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.3)与[升级指南](https://tailwindcss.com/docs/upgrade-guide)作为迁移依据。选择匹配的@tailwindcss/postcss，以最少构建配置改动保持两入口隔离插件；Vite保持6.4.3。

这属于构建工具链安全修复，不进入Formal Decision State，不改合同、投资状态、来源/时间/审计链，不接私人研究/账户/交易或运维看板。视觉以用户已验收桌面截图为基线，不重新设计。

Tailwind4浏览器最低要求：Safari16.4、Chrome111、Firefox128。当前环境仅实际验证可用Chromium；Safari/Firefox及旧浏览器未经真实验证。安全审计通过不等于获得发布许可。

## 执行记录

- 环境固定Node24.19.0/npm11.9.0，未改模型或服务配置。父端报告gpt-6-astra/high/default受理，后台实际路由不在本地可验证范围。
- 首次npm view因默认/home/agent/.npm缓存不存在而exit1；停止默认缓存路径，后续显式使用允许写入的/tmp/security-npm-cache，不更改home或权限。完整失败与重试日志保留。
- 旧demo产物和v3主题/preflight已保存在本地临时基线用于同浏览器对照；不上传正式数据产物。
- 后续固定SHA安装、审计、测试、截图和剩余限制见最终证据。
