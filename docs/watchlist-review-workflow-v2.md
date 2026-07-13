# 观察清单与投研复盘工作流 V2

## 定位

V2 是纯前端、本地优先的个人投研工作流。真实 `ResearchEvent` 只生成复盘任务，不自动改变用户的观察状态、投资假设或判断，也不生成买卖、评级、目标价或机构一致预期相关结论。

## 领域模型

- `WatchItem`：当前观察项，包含公司、状态、优先级、标签、关注理由、投资假设、验证/风险条件、复盘日期、归档时间和来源。
- `ReviewEntry`：不可变复盘记录，保存触发原因、关联事件、证据引用、复盘前后快照、判断和下一复盘日期。
- `ReviewTask`：由日期和事件确定性生成的只读任务视图。用户只持久化确认、忽略或暂缓状态。
- `WatchlistStoreEnvelope`：本地存储容器，包含 `watchItems`、`reviewEntries`、`reviewTaskStates` 和 `settings`。

## 本地存储

- LocalStorage key：`investment-research-dashboard.watchlist.v2`
- `schemaVersion`：`2`
- 替换导入备份前缀：`investment-research-dashboard.watchlist.backup.`

组件不分散读写 LocalStorage。读取、保存、校验、导入、替换和重置集中在 `watchlistRepository`；领域操作集中在 `watchlistStore`。表单只在显式提交时保存，不在每次输入时写入。

## 迁移规则

本项目在 V2 前没有真实 LocalStorage 观察清单 key，因此不虚构 V1 结构，也不迁移静态数组。当前迁移器只接受 `schemaVersion: 2`：

- 重复执行得到相同结果；
- 通过 JSON 克隆保留当前版本中未知但合法的用户字段；
- 未知版本明确拒绝；
- 校验或迁移失败时不覆盖原始数据。

## 用户数据与示例数据边界

`src/data/watchlist.ts` 只导出带 `source: sample` 的模板。Repository 初始化始终为空；示例不进入用户 KPI，也不生成任务。用户主动载入后，Store 会创建新的 ID、改为 `source: user` 并移除“示例”标签。同一公司已有活跃观察项时跳过；只有归档项时恢复旧项而非重复创建。

## ReviewEntry 不可变原则

Store 不提供修改或删除 ReviewEntry 的 API。一次复盘通过单次保存原子完成：

1. 追加 ReviewEntry；
2. 更新 WatchItem 当前快照；
3. 更新 `lastReviewedAt` 和 `nextReviewAt`；
4. 将本次处理的任务标记为已确认；
5. 写入版本化容器。

保存失败会返回原容器，不留下半完成状态。纠正历史记录时新增一条 ReviewEntry，并用 `correctsReviewEntryId` 指向旧记录。

## ReviewTask 规则

任务稳定 ID 由 `watchItemId + ruleType + eventId/复盘日期` 哈希生成，并在返回前按 ID 去重。当前规则包括：

- 复盘日期已到或已逾期；
- 上次复盘（未复盘则创建）后新增业绩预告、预告修正、业绩快报或定期报告；
- 现有业绩验证链标记的显著差异；
- 同报告期累计经营现金流与累计归母净利润在值、币种、口径可靠时达到差异阈值；
- `metadata_only`、`parse_partial`、`stale`、`missing` 或 `error`；
- 达到设置中的长期未复盘天数。

任务文案区分“公司新增正式披露”和“本地数据解析状态”。解析失败不等同于公司没有披露；缺值时不计算差异，`null` 不转换为 `0`。确认、忽略和暂缓只写入 `reviewTaskStates`，不会改变 WatchItem。

## JSON 导入导出

导出文件包含：

- `format: investment-research-dashboard.watchlist`
- `schemaVersion`
- `exportedAt`
- `updatedAt`
- `watchItems`
- `reviewEntries`
- `reviewTaskStates`
- `settings`

不包含行情、公告全文、财务历史、缓存、密钥或环境变量。

导入先预览版本、观察项、复盘记录、冲突、无效、新增、跳过和替换数量。默认安全合并：重复 ID 和重复活跃公司跳过，已有记录不覆盖。替换模式需要二次确认，并先把当前容器写入独立备份 key。非法 JSON、未知版本、字段类型错误和重复 ID 都返回明确错误。

## 损坏与写入失败恢复

损坏 JSON 会回退到安全空状态并保留错误和原始字符串，Repository 不自动覆盖原 key；页面可导出损坏原始数据或显式重置。存储不可用、空间不足或写入异常会显示错误，调用方保留操作前状态。

## 页面联动

- 观察清单：KPI、筛选排序、添加、非核心元数据编辑、归档/恢复、任务处理、复盘表单、时间线和备份恢复。
- 个股详情：加入/恢复观察项、显示状态、编辑、开始复盘、任务、证据来源和时间线。
- 验证中心：对已观察公司显示状态和待复盘数量，提供开始复盘入口，不复制完整编辑器。
- 首页：今日待复盘、已逾期、新事件提醒和高优先级观察项，同时保留原数据覆盖与缺失字段信息。

## 当前限制与云同步边界

- 数据仅保存在当前浏览器和当前 origin，不支持账号、跨设备、权限或多人协作。
- 浏览器隐私清理会删除本地数据，需使用 JSON 备份。
- 顶层仍只用已提交摘要和聚合事件；单公司财务与公告详情继续在打开详情后按需加载。
- 将来接入云同步时，可用远端 Repository 替换 `StorageLike/WatchlistRepository`，保留领域模型、Store 原子操作、任务规则和组件接口；冲突处理需要增加服务端版本或乐观锁，不应改变 ReviewEntry append-only 语义。

本版本没有新增 Provider，没有修改默认 `data:refresh`，也没有修改 Provider Stability Gate 或 Developer Health Gate 标准。
