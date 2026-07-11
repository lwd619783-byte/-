# A 股公告与业绩预告 Provider V1

## 结论

V1 采用巨潮资讯（CNInfo）公开公告检索接口和官方 PDF，覆盖当前股票池 56 家 A 股最近两年公告。所有公司都有状态记录，完整公告历史按公司懒加载；业绩预告、预告修正和业绩快报只在 PDF 文本规则可靠命中时生成结构化字段，无法可靠拆列的值保持 `null` 并标记 `parse_partial`。系统不生成“超预期/不及预期”判断。

本次生成范围为 2024-07-11 至 2026-07-11，共 15,674 条公告：26 家 `success`、30 家 `partial`、0 家 `error`、0 家 `empty`。`partial` 主要表示某些目标 PDF 的正文结构无法完整解析，不影响公告元数据和官方链接真实性。

## 数据源选择与实测

候选方案包括项目旧 CNInfo 脚本、交易所/公司披露页、AKShare 公告封装和巨潮公开检索。最终复用并标准化 CNInfo，原因是当前项目已有调用基础、无需 Token、可返回公告唯一 ID/标题/时间/PDF 路径，并能通过正式 PDF 回溯。

- 检索接口：`https://www.cninfo.com.cn/new/hisAnnouncement/query`
- 正式详情页：`https://www.cninfo.com.cn/new/disclosure/detail?annoId=<announcementId>`
- 正式 PDF：`https://static.cninfo.com.cn/<adjunctUrl>`
- Provider 标识：`CNInfo hisAnnouncement`
- Provider 版本：`2026-public-web`
- 凭据：不需要
- Python 包：`requests 2.32.5`、`pypdf 6.5.0`
- 实测行为：先用股票代码发现 CNInfo 的真实 `orgId`，再按 `stockCode,orgId` 分页；单页上限 30，以 `hasMore` 继续；PDF 返回 `application/pdf`，无需登录。
- 失败行为：有限重试后记录 `source_unavailable/fetch_error`；不会删除公司，也不会用示例公告替代。
- 限流：串行、默认最小间隔 0.2 秒、最多 2 次重试；不使用高并发。
- 使用限制：公开接口无 SLA，页面结构、字段和访问策略可能变化；仅用于项目内部研究数据生成，保留官方链接。

实际调用验证覆盖上海主板（601138）、深圳主板（002821）、创业板（300308）和科创板（688017/688235）。当前股票池没有北交所公司，因此 V1 没有伪造北交所覆盖。

## 架构与命令

同步入口只导入：

- `src/data/real/a-share-announcement-summaries.generated.json`：56 家摘要、最新公告和最新业绩类公告。

完整数据位于：

- `public/data/a-share-announcements/manifest.generated.json`：路径白名单、byteSize、SHA-256、覆盖统计。
- `public/data/a-share-announcements/<stockId>.json`：单公司最近两年完整公告历史、分类、解析结果和溯源。

`src/services/aShareAnnouncementLoader.ts` 使用 `import.meta.env.BASE_URL` 加载 Manifest，只允许匹配固定目录的白名单路径，并校验 schema、ID、代码、字节数和 SHA-256。成功结果进入内存缓存；并发相同请求去重；失败结果不进入成功缓存。详情抽屉仅为 A 股 Real/Mixed 模式加载当前公司文件，切换股票或卸载后旧请求不能覆盖新状态；港股明确显示“港股公告数据暂未接入”；Mock 模式继续保留原示例。

独立命令：

```text
npm run data:fetch:announcements:a
npm run data:validate:announcements:a
npm run test:announcements:a
```

抓取脚本支持全量、`--stock`、`--start/--end`、`--incremental`、`--missing-only`、`--performance-only`、`--dry-run` 和缓存控制。生成时先写临时目录，全部专项校验通过后再原子替换摘要和详情目录；单股调试不会删除其他公司数据，dry-run 不写正式文件。公告 Provider 仍未接入默认 `npm run data:refresh`，因为公开端点没有 SLA，也尚未积累跨日稳定性。

## 分类与结构化边界

分类采用标题规则、优先级和证据记录，支持业绩预告、预告修正、业绩快报、年度/半年度/季度报告、摘要、更正、回购、持股变化、股权激励、融资、并购、监管、调研等类别。引用“年度报告”的问询函回复、预约披露时间提示或信息披露制度不会冒充正式定期报告。

业绩预告保留归母净利润、扣非归母净利润、披露区间、同比区间、报告期、原因证据和推导中值；中值明确标记为派生值。若同一公告同时披露单季度和累计报告期，按公告标题对应报告期选择。下降百分比存为负小数，例如 `-0.63` 表示下降 63%。

业绩快报只接受明确单位和合法数字分组。PDF 表格把本期/上期两列粘连时，不猜测拆分、不按数值大小猜单位；不可靠字段为 `null`，公告标记 `parse_partial`。V1 不做 OCR，不把扫描件或复杂表格的失败值写成 0。

更正、补充和重复记录保留原公告，不按写入顺序静默覆盖；记录 `correctedAnnouncementId`、`supersededBy`、`duplicateOf` 等关系。定期报告公告按报告期关联已生成的 A 股财务文件，但不复制或改写财务数字。

## 覆盖结果

| 指标 | 结果 |
| --- | ---: |
| A 股公司 / 状态记录 | 56 / 56 |
| 公告总数 | 15,674 |
| success / partial / error / empty | 26 / 30 / 0 / 0 |
| 官方详情/PDF 链接覆盖 | 15,674 / 15,674 |
| metadata_only / parse_success / parse_partial | 15,559 / 31 / 84 |
| 业绩预告 / 修正 / 业绩快报 | 81 / 1 / 33 |
| 年报 / 半年报 / 季报 / 定期报告摘要 | 185 / 158 / 131 / 214 |
| 与财务报告期成功关联 | 633 |

“56/56 有状态记录”不等同于“56/56 正文完全结构化”。公告分类覆盖所有记录；正文结构化只覆盖 V1 明确支持且文本规则可靠的目标类别。

## 正式公告抽样核验

| 公司 | 公告与报告期 | Provider 结果 | 正式 PDF 对照 | 结论 |
| --- | --- | --- | --- | --- |
| 工业富联 601138 | [2026 半年度业绩预增，1225417297](https://www.cninfo.com.cn/new/disclosure/detail?annoId=1225417297) | 归母 234–244 亿元，同比 93%–101%；扣非 227–237 亿元，同比 94%–103% | 与正式 PDF 一致；没有误取同文中的第二季度区间 | 通过 |
| 凯莱英 002821 | [2024 年度业绩预告，1222448664](https://www.cninfo.com.cn/new/disclosure/detail?annoId=1222448664) | 归母 8.5–10.5 亿元，同比 -63% 至 -54% | 金额、下降方向和单位与正式 PDF 一致 | 通过 |
| 百济神州 688235 | [2025 年度业绩快报，1224986312](https://www.cninfo.com.cn/new/disclosure/detail?annoId=1224986312) | 归母净利润 14.22185 亿元；营业收入为 `null`，`parse_partial` | PDF 文本中营业收入本期/上期列粘连，Provider 拒绝生成错误超大值；归母值与表格一致 | 通过（部分解析） |
| 中际旭创 300308 | [2026 一季报提示性公告，1225111944](https://www.cninfo.com.cn/new/disclosure/detail?annoId=1225111944) | 分类为 `other`，不冒充季度报告 | 标题是披露提示，不是季度报告正文 | 通过 |
| 雷赛智能 002979 | [2026 半年度业绩预告补充说明，1225404882](https://www.cninfo.com.cn/new/disclosure/detail?annoId=1225404882) | `performance_forecast_revision`，正文无可靠新区间时为 `parse_partial` | 保留补充公告身份，不编造修正区间 | 通过（部分解析） |

抽样中未发现无法解释的金额差异。百济神州样本主动降级为部分解析，说明 V1 的失败边界按真实性优先，而不是追求字段填满。

## 前端与主观判断边界

详情页先展示真实摘要，再异步加载当前公司的完整公告；加载中、失败、部分解析、过期和未接入分别显示。业绩卡只展示公司正式披露的区间、报告期、原因摘要和官方链接。

以下能力明确不在 V1：

- 不生成“超预期/不及预期”、买入/卖出或情绪标签。
- 不接入机构一致预期、券商研报、估值模型或港股公告。
- 不把公告原因摘要当作经过验证的因果结论。
- 不把公告预告数替代审计后财务报告数。
- 不对未披露值做模型补齐，不把 `null` 转为 0。

## 性能与门禁

| 指标 | main 基线 | V1 | 变化 |
| --- | ---: | ---: | ---: |
| 初始 JavaScript | 1,830,005 bytes | 1,962,205 bytes | +7.22% |
| 最大初始 chunk | 1,830,005 bytes | 1,962,205 bytes | +7.22% |
| gzip 初始 JS | 基线未单独留存 | 434,784 bytes | - |
| 同步公告摘要 | 0 | 257,629 bytes | 新增 |
| Manifest | 0 | 23,555 bytes | 新增 |
| 56 个公司详情总量 | 0 | 27,042,130 bytes | 仅 public 按需加载 |
| 单公司平均 / 最大 | 0 | 482,895 / 954,216 bytes | 仅按需加载 |

初始 JS 的增加来自有限摘要，不包含 15,674 条完整历史。构建门禁扫描生产静态 import、摘要预算、56 个详情文件数量和完整历史标志；`npm run build` 已接入该门禁。Vite 仍有既有大 chunk warning，但公告完整历史不是初始 chunk 的组成部分。

## 验证与已知限制

- Python 专项单元测试覆盖代码/日期、分类优先级、报告期、单位、预告区间、下降符号、季度/累计选择、快报粘连列拒绝、更正/重复、Provider 失败、Manifest/checksum/路径穿越和稳定生成。
- TypeScript 测试覆盖摘要同步加载、Manifest 白名单、单公司加载、404/网络/坏 JSON/schema/身份不一致、缓存、并发去重、A 股/港股/Mock 路由和股票切换保护。
- 专项验证检查 56 家覆盖、摘要/详情/Manifest 一致、byteSize/checksum、稳定排序、路径安全、孤儿/缺失文件、非有限数、官方链接和生产静态 import。
- CI 使用 Node.js 22、Python 3.13，只校验已提交数据，不访问实时 CNInfo，不需要 Token。

已知限制：CNInfo 公开端点无 SLA；V1 仅覆盖最近两年；PDF 扫描件、跨页表格、复杂字体和粘连列可能只能部分解析；原因摘要是规则提取的披露文本片段，不等于独立核实；公告状态需与后续正式报告交叉验证。
