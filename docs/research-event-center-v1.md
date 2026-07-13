# 投研事件与业绩验证中心 V1

## 数据边界

- 不新增 Provider，不修改 Provider Stability Gate。
- 验证中心同步使用已提交的财务摘要、公告摘要和现有股票资料。
- 单公司完整财务与公告历史继续通过现有 Manifest 白名单 Loader 按需加载。
- Real / Mixed 模式缺失或加载失败时生成 `data_warning`，不回退 mock 财务或 mock 公告。
- 不修改已有 generated 数据，不把财务或公告 Provider 加入默认 `data:refresh`。

## ResearchEvent

统一事件定义位于 `src/types/researchEvent.ts`。V1 仅支持：

- `earnings_preview`
- `earnings_preview_revision`
- `earnings_flash`
- `periodic_report`
- `financial_update`
- `announcement`
- `data_warning`

每个数字保留来源类型、来源名称、官方链接或 PDF、公告 ID / 财务报告期以及累计、单季度、区间或时点口径。缺失值保留为 `null`。

## 关联与差异规则

1. 只按 `stockId + reportPeriod` 关联公告与财务，不做模糊期间推断。
2. 同公告 ID 去重；同日同报告期的定期报告正文与摘要合并，优先保留正文记录。
3. 链条展示预告、修正、快报、正式报告四阶段。未发现阶段只表示当前本地数据缺口。
4. 预告中值、快报归母净利润和正式报告累计归母净利润仅在报告期与口径可比时计算差异。
5. 相对差异绝对值达到 10% 时进入只读复盘提示；基数为 0 时不计算百分比。
6. `metadata_only`、`parse_partial`、`stale`、`missing` 和 `error` 原样进入数据核验队列。

## 已知限制

- 顶层验证中心为避免一次加载全部公告历史，先基于摘要展示最近事件与链条缺口；完整链条在个股详情按需加载。
- 不做 OCR，不扩大公告正文解析类别。
- 没有机构一致预期数据，因此只比较公司自身不同披露阶段的同口径数值。
- 观察清单联动只生成提示，不修改用户维护的主观状态。
