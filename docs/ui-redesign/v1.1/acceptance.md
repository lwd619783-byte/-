# UI V1.1 验收记录

结论：本地实现与本票验证 **PASS**。停止点为功能分支普通 push；未执行 PR、main 合并或 production deploy。用户 Vercel Preview 视觉确认与 ChatGPT 远端审计仍待执行。

输入 base：`a419607ebc9d7b4413bedd8786cf814394b3c00d`。启动时 `git fetch origin` 后精确匹配。最终 HEAD 由本报告所属提交及交付消息确定；[浏览器证据](browser-evidence.json)记录最终应用源码 SHA-256 与实际构建资源名，归档前已逐项复核源码指纹一致。测试后仅追加证据文档，不改业务逻辑。

## 结果与证据

| 检查 | 实际结果 | 证据 |
|---|---|---|
| focused tests | 5 文件 / 39 测试通过，含启动分流、三 profile 七页五章节、零存储访问、零加载、阻断导入导出、原 drawer 焦点与 Escape | [focused.txt](checks/focused.txt) |
| npm test | 55 文件 / 725 测试通过 | [npm-test.txt](checks/npm-test.txt) |
| npm run build | TypeScript、Node-only Local Core typecheck、Vite、browser boundary、bundle gate 均通过 | [build.txt](checks/build.txt) |
| npm run ui:audit | 静态扫描通过；该命令自身不证明浏览器视觉 | [ui-audit.txt](checks/ui-audit.txt) |
| npm run data:audit | exit 0；P0=0、errors=0；保留 24 warnings（P1=10、P2=14），不降低门禁 | [data-audit.txt](checks/data-audit.txt) |
| 响应式 | 1536 / 1280 / 390 / 320 × 三 profile × 七一级页及五公司标签，共 144 组合无页面级横向溢出；另检查 1600 首页 full/empty | [browser-evidence.json](browser-evidence.json) |
| 三主题 | 1536px full 的 12 页面/标签，pro/light 对 neon 共 24 次标题、表格、图表、标签和首页模块几何对比一致 | 同上 `themes` |
| 公司滚动 | 摘要 `position: static`，滚动后 bottom=-316px；标签栏 top=8px、height=54px；切章后正文 top=78px，栏底62px，间隔16px。四种视口均通过 | 同上 `scroll` |
| 普通公司路径 | 普通业务 URL 的 `sugon` 页面摘要滚走、标签栏54px；既有数据加载路径可用，存储原文保持 | 同上 `ordinaryCompany` |
| 其他 | 首页200%文字缩放未溢出；browser reduced-motion 开启；无 pageerror | 同上 |

测试输出将本机工作目录替换为 `<workspace>` 并去除末尾空行，原始日志保留在本地忽略目录。

浏览器使用本机 Edge / Playwright，访问本地 `vite preview` 的生产构建，不是线上 production 或用户 Vercel Preview。共归档95张原始截图；[截图摘要与哈希](screenshot-manifest.json)可逐项复查。验证/预期的三 profile 桌面 neon 截图补拍为完整页面，以包含首屏下方的核心核验状态。没有用合成数据证明真实 Provider 的覆盖或准入。

## 业务存储隔离

浏览器在全新上下文里使用合成哨兵测试既有业务键：含非空观察项与复盘历史的 Watchlist V2、损坏但必须保留原文的 Expectation key、历史备份键及外观键。没有读取用户现有浏览器私有数据。JS 测试另外监视 `getItem/setItem/removeItem/clear` 和两个公司明细 loader。

进入验收前、退出验收后、普通 URL 再刷新后的完整 LocalStorage 原始字符串集合 SHA-256 均为：

`c37bd57c0939e5794c60e0c5f3ab5c00e073c751bd5636bd6f5e42dc88dd3187`

- 144 个 review 检查：业务及外观存储读取0、写入0，原始字节摘要不变。
- review：fetch/XHR/数据目录请求0；业务 App chunk加载0；下载0。
- 退出与普通刷新后的数据请求集合与进入前相同：仅既有 company-guidance `manifest.generated.json` 与 `workflow-index.generated.json`。
- 验收进入/退出不会保存、清除、迁移或覆盖业务记录。普通 URL 恢复原业务数据模式路径。

## 重点截图

| 内容 | 证据 |
|---|---|
| 首页 full / empty | [full](screenshots/full-home-1536-neon.png) · [empty](screenshots/empty-home-1536-neon.png) |
| 首页三主题 | [neon](screenshots/full-home-1536-neon.png) · [pro](screenshots/full-home-1536-pro.png) · [light](screenshots/full-home-1536-light.png) |
| 公司摘要滚动与章节位置 | [滚动前](screenshots/company-before-scroll-1536.png) · [摘要已滚走](screenshots/company-summary-scrolled-1536.png) · [切章不遮正文](screenshots/company-new-chapter-1536.png) |
| 普通业务公司路径 | [滚动前](screenshots/ordinary-company-before-scroll.png) · [滚动后](screenshots/ordinary-company-summary-scrolled.png) |
| 320px长名称与标签栏 | [退化首页](screenshots/degraded-home-320-neon.png) · [公司切章](screenshots/company-new-chapter-320.png) |
| 行业三profile | [full](screenshots/full-industry-1536-neon.png) · [empty](screenshots/empty-industry-1536-neon.png) · [degraded](screenshots/degraded-industry-1536-neon.png) |
| 验证三profile | [full](screenshots/full-verification-1536-neon.png) · [empty](screenshots/empty-verification-1536-neon.png) · [degraded](screenshots/degraded-verification-1536-neon.png) |
| 预期三profile | [full](screenshots/full-expectations-1536-neon.png) · [empty](screenshots/empty-expectations-1536-neon.png) · [degraded](screenshots/degraded-expectations-1536-neon.png) |

## 使用与待确认范围

[入口和场景说明](README.md)。Preview 根地址后添加 `?ui-review=1&profile=full#/home`，可切 full / empty / degraded；普通地址无入口。公司深链为 `?ui-review=1#/company/ui-review-company-1/overview`。

本次修正不新增 Provider、评分、新闻或 AI 结论。验收数据只用于视觉检查，业务提交/导入/导出明确被阻断。三主题结构和当前浏览器矩阵已验证；Vercel Preview 的实际字体、缓存、部署资源与用户视觉接受度仍由后续确认，不以本地PASS代替。
