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

## 实现范围与兼容策略

- Tailwind / 专用 PostCSS 插件固定4.3.3；移除autoprefixer；Vite固定原锁文件6.4.3。共同锁文件条目只有Tailwind和其所需jiti升级，没有其他直接重大依赖升级。
- 保留原JS配置、主题tokens和非layer级联，限制扫描为原src/index范围。兼容v3圆角、小阴影/blur、默认边框/ring、透明outline、禁用控件原生opacity。
- 正式CSS对照发现v4 space/divide改为非末子元素及相对line-height会改变折叠边距、分隔线和表头高度；使用显式v3 sibling工具类和固定行高兼容，不修改业务组件。完整失败与修复前截图报告保留。
- CI新增两个真实失败门禁：完整依赖与production依赖audit high/critical阻断；原CI内容/触发/权限保持。独立security-integrity profile校验获批diff、旧门禁、数据/业务零改动与两构建隔离。
- 正式构建只通过已有ui-review=1合成入口验证，不装载BusinessApp或读取业务存储。正式CSS A/B为同一当前JS配旧/新CSS，不能称作旧完整构建复现；既有验收模式顶部提示被侧栏局部遮挡在旧CSS亦存在。
- 辅助文件搜索遇到/opt/containerd Permission denied后停止该路径；未提权、重试或绕过。Playwright使用此前已知可读安装路径。

视觉门禁明确区分：demo必须30状态全部computed布局一致且21帧逐像素一致；正式入口CSS A/B要求12状态所有元素几何与非颜色style完全一致，仅允许rgba→oklab序列化，桌面帧最多32个像素且通道差≤1（实测0/17/17/25重复两宽度）。CSS焦点探针最多1像素/通道差1。先前严格0像素比较退出1保留，不把容差结果描述成逐像素相同；没有裁剪、重绘或修改截图。
