# D0 设计归档校验记录

日期：2026-09-09；设计：NEON-RC1-20260909；状态：APPROVED / FROZEN。
输入及本票 base：`bcca135530352ed9c85407e18acceed1dbf45690`。

本记录仅覆盖文档与非生产资产归档。最终 HEAD、普通 push、远端 SHA 一致性、ahead/behind 和干净工作树在本票交付回复中报告，不在待提交文件内预写未来 commit SHA 或合入/CI 状态。

| 实际执行的检查 | 结果 / 范围 |
| --- | --- |
| `git fetch origin`、仓库根、origin URL、`origin/main` 完整 SHA、工作树检查 | PASS；仓库正确，main 与指定 base 完全相等，起始工作树干净；从该 base 建立指定分支 |
| 读取根 AGENTS、PRODUCT、architecture、feature registry、UI workflow 及原包 01–09 / 三个 JSON 索引 | PASS；仅 D0 文档归档，不执行包内未来实施指令 |
| `python docs/ui-redesign/v1/checks/verify-archive.py --zip <原交付包.zip>` | PASS；归档清单与 SHA-256、原包/源成员 hash、56 条迁移行逐字一致、42 个画板、32 页册索引、三主题身份、54 项最终审计 ID、批准/派发状态、相对链接/锚点及导航、Git 文件范围 |
| 原包与归档 01–09、design README 的逐文件 diff 审阅 | PASS；仅批准/派发状态与必要链接；05 的迁移行完全相同；token/book 索引逐字节相同 |
| 非生产资产边界检查 | PASS；仅文档目录内 SVG/代表 PNG；Vite 无 docs 复制配置，应用入口未引用本归档；未改动 src、public、业务数据、contracts 或依赖 |
| `git diff --check` / `git diff --cached --check`、提交清单审阅 | PASS；仅归档及三个文档导航入口，无空白错误、无计划外文件 |

`NOT_RUN`：业务单元/集成/合同测试、lint/typecheck、build/bundle 实测、`ui:audit`、`data:audit`、Provider/真实数据请求、浏览器交互/响应式/无障碍/性能验证、原设计对比度与几何算法重跑、PDF 渲染、远端 CI。纯文档票不据此声称 UI 已实现或业务回归通过。

PR、merge、部署、D1 均未执行；D1–D5 持续为 NOT DISPATCHABLE。长期项目规则参见[归档入口](../README.md)的事实源链接，此处不另建规则。
