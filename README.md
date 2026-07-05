# 投资研究看板

用于 A 股 / 港股内部投研的研究型 Dashboard。第一版使用本地 mock 数据，覆盖宏观、行业、细分板块、个股池和观察清单，不接入实时行情，也不构成投资建议。

## 启动方式

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

测试筛选工具：

```bash
npm run test
```

## 真实数据 MVP

第一阶段采用本地脚本生成 JSON 缓存，前端只读取标准化后的 `src/data/real/*.generated.json`。Token 不进入前端。

```bash
npm run data:fetch
npm run data:validate
npm run data:refresh
```

当前数据模式可在页面 Header 中切换：

- `Mock Data`：只看示例数据
- `Mixed Data`：真实数据优先，缺失字段降级为“数据暂缺”或保留 mock 说明
- `Real Data`：尽量展示真实缓存，但缺失字段仍不会导致页面崩溃

Python 数据依赖：

```bash
pip install -r requirements-data.txt
```

本机已验证 `akshare`、`baostock`、`pandas`、`yfinance` 可用。A 股数据由本地 A Stock Data 脚本生成；港股 MVP 使用 `yfinance` 生成联想集团、优必选、舜宇光学科技的 quote 与 60 日 K 线。港股财务、研报、公告当前仍标记为 `not_implemented`，不伪造数据。

数据源与字段说明：

- `docs/data-source-research.md`
- `docs/data-field-mapping.md`
- `docs/data-validation-report.md`

## 目录结构

```text
src/types          数据模型定义
src/data           mock 数据源
src/utils          筛选、名称映射等纯函数
src/components     看板 UI 组件
```

## 如何新增行业

在 `src/data/industries.ts` 中新增一个 `Industry` 对象。至少填写：

- `id`：稳定唯一标识
- `name`：行业名称
- `prosperity`、`stage`、`drivers`、`catalysts`、`risks`
- `chain`：上游 / 中游 / 下游结构
- `segments`：行业下的细分板块

## 如何新增细分板块

在对应行业的 `segments` 数组中新增 `IndustrySegment`：

- `id` 必须唯一
- `industryId` 必须等于所属行业 `id`
- `stockIds` 放入该板块展示的 1-3 只龙头个股 `id`
- 逻辑、需求、供给、壁垒和关键变量尽量保持可核验

## 如何新增个股

在 `src/data/stocks.ts` 中新增 `Stock` 对象：

- `industryId` 和 `segmentId` 必须对应已有行业和细分板块
- 财务和估值字段如果未接入可靠来源，保持 `X` 或 `待接入`
- `growthDrivers`、`risks`、`trackingMetrics` 分开写，避免把推论写成事实

## 如何新增观察项

在 `src/data/watchlist.ts` 中新增 `WatchlistItem`：

- `stockId` 指向已存在个股
- `status` 可选：观察、已配置、等回调、等业绩验证、剔除观察
- `questions` 用来记录待核验问题
- `nextReviewDate` 用于后续复盘提醒

## 未来接入真实数据源

建议保留当前类型层和数据层接口，把真实数据适配成同样的结构：

- Wind / 同花顺 / 东方财富：行情、估值、资金和行业数据
- 财报 API / 巨潮公告：财务、订单、客户和风险披露
- CSV / Excel：内部维护的主题池、观察清单和复盘结论
- 自建数据库：长期跟踪指标、证据等级、前期判断对账

真实数据接入后，应在数据层增加 `source`、`sourceDate`、`confidenceLevel` 等字段，并继续把 D/X 证据留在待核验区，不进入长期投资逻辑。

当前已经增加 `source`、`updatedAt`、`status` 和缺失字段统计。新增真实数据源时，先写脚本生成 JSON，再在 `src/services/dataProvider.ts` 聚合，不要让组件直接依赖具体数据源。
