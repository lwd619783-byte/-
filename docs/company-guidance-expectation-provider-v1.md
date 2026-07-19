# A股公司指引预期 Provider V2（合并前完整性契约）

## 一句话结论

Provider V2 是一个只读、离线生成、默认失败关闭的公司指引证据层。Real/Mixed 模式先独立校验全局 workflow index，再按公司懒加载详情；Mock 模式严格隔离真实 Provider。生成器不会访问网络，也不会修改公告、财务源产物、默认 `data:refresh`、Provider Stability Gate 或 Developer Health Gate。

## 数据范围与只读边界

- 只接受已提交巨潮公告产物中的 `performance_forecast` / `performance_forecast_revision`。
- 只映射高置信、报告期明确、正式 URL 可核验的归母净利润、扣非净利润和营业收入区间。
- `metadata_only`、低置信、区间不完整、非正式 URL、快报、定期报告、新闻、券商预测和用户推断不进入 Provider。
- Provider 快照始终为 `ingestionMethod=provider`；Store API 拒绝写入或覆盖 LocalStorage 的人工、JSON、CSV 追加链。
- 当前产品规则固定为 56 家股票池公司；真实源数据对应 15 家、56 条 current、0 条 historical。

## 全局工作流、模式与失败语义

```text
manifest.generated.json
  -> workflow-index.generated.json  # 全局 current、SHA-256、低于 500 KB
  -> Comparison / ResearchEvent / ReviewTask / KPI

<stockId>.json                       # 原文、排除项、current、historical、警告
  -> 个股抽屉或预期证据中心按需加载
```

- App 启动 Real/Mixed 后立即校验 workflow，和当前导航页、选中公司无关。
- Mock 模式 active Provider records 恒为空；App request generation 与 loader epoch 共同阻断跨模式、跨重试的旧结果。
- workflow 校验失败时正式 Provider 全局关闭，本地快照仍可使用，不回退 mock 或半校验数据。
- 公司详情使用 `Promise.allSettled`；单家公司失败保留 stockId、错误码和重试入口，不拖垮其他公司。
- loader 的 detail、manifest、workflow 请求都捕获启动 epoch。`clearCache()` 递增 epoch；旧请求不得写回 cache，也不得清除新一代 Promise。`finally` 只删除仍指向自身的 in-flight 项。

## 详情关系、状态与发布代际契约

详情状态不能由数组是否非空直接决定。Node 生成/离线校验和浏览器 Loader 使用同一套浏览器安全关系契约，先验证集合成员和引用关系，再返回状态：

- `targetAnnouncements` 的公告 ID 在公司内唯一，股票、类型、严格日历日期、报告期/期间口径、解析状态和重复标记必须有效；
- current/historical snapshot 必须按公告 ID 回指 target，且股票、公告类型、来源日期、报告期、期间口径和解析状态逐字段一致；
- exclusion 必须回指 target，公司身份和公告投影一致，原因码非空、受支持且去重；
- warning 的来源公告必须属于本公司 target，候选公告 ID 必须是合法、去重的公告身份；
- 每个 target 至少有 current、historical 或 exclusion 覆盖；孤儿、重复、投影错配、未覆盖 target 和 historical-only 迁移态均失败关闭；
- 同一 target 可有多个 metric snapshot，也可在部分 metric 成功时同时保留 snapshot 与 exclusion，不按公告 ID 把合法多指标记录误判为重复。

关系有效后，状态只有三种：无 target/记录为 `missing`；任一 target 未形成完整 current 或存在 exclusion 为 `partial`；所有 target 都有可靠 current 且无 exclusion 才是 `generated_real`。全局 summary 从公司状态聚合，因此“全部 target 被排除、current 为零”仍是 `partial`；正式产品是否允许零可靠快照由更高层 generation gate 单独拒绝。

发布代际采用严格 ISO 精确时刻，不接受日期加 `Z`、空格分隔、无 offset、不存在的日期/时间或尾随字符。summary、manifest、workflow、detail 和 `quality.updatedAt` 必须属于同一发布 epoch；current record 的 `generatedAt` / `providerGeneratedAt` 也属于该 epoch。historical record 保留自身原始生成时刻，只要求其内部时刻严格且相互一致，不会被改写为本轮 epoch。

主要可定位错误码包括 `detail_target_contract`、`detail_exclusion_contract`、`detail_warning_contract`、`detail_target_duplicate`、`detail_target_uncovered`、`detail_snapshot_orphan`、`detail_exclusion_orphan`、`detail_projection_mismatch`、`detail_historical_only`、`detail_generation_epoch` 和 `detail_quality_contract`。

## Provider record 固定产品契约

detail current、detail historical 与 workflow current 共用同一个浏览器安全 record validator。每条 record/snapshot 必须同时满足：Provider ID/版本/解析规则、evidence/version/content/artifact 身份逐层镜像；市场固定为 A 股；指标仅限归母净利润、扣非净利润和营业收入；数值固定为 CNY/yuan/PRC_GAAP 的有限区间且不生成中点；来源必须是与公告 ID、PDF 日期一致的规范巨潮 URL；来源公司名、披露日和 date 精度字段必须相互一致；入库方式、验证状态、schema、createdBy、分析师/机构计数和本地纠错字段均固定为本 Provider 的产品值。

公开披露代理时间解释使用唯一常量，`formedAt` 保持 null，披露与形成精度均为 date，不接受仅“类型合法”但偏离 Provider 固定值的记录。主要错误码为 `provider_snapshot_product_contract`、`provider_snapshot_mirror_contract`、`provider_snapshot_time_contract` 和 `provider_business_revision_mirror`。

detail current/historical 必须保留非空 `sourceTextEvidence`、匹配的 SHA-256 和能在原文中找到的 `originalUnitEvidence`；缺原文或单位证据的候选在生成阶段显式排除。workflow current 必须删除原文和单位字段，仅保留原文 hash，其余产品契约不降级。排除项的非空 URL 必须是对应公告的规范巨潮 URL，null 必须伴随 `official_source_invalid`；候选公告引用由正式公告产物反查同公司归属，跨公司引用失败关闭；structured warning 只能使用受支持且与业务修订图一致的去重代码。

## 公司集合不可静默删除

旧 Provider 目录不存在时允许首次生成。目录已经存在时，生成器必须：

1. 独立读取旧 `manifest.generated.json`；
2. 按旧 manifest 的 items 读取并深校验全部旧详情；
3. 校验旧 summary、manifest、workflow、详情文件集合、字节数、SHA-256 和内部身份；
4. 将旧 Provider stockId 集合与本次公告输入 stockId 集合比较；
5. 任一旧 stockId 或旧 evidence 消失即失败。

因此“删除公司 A、加入公司 B、总数仍为 56”不能绕过检查；只删除到 55 也会失败；只新增到 57 则由显式的 56 家产品规则拒绝。未来迁移必须另行设计可审计 migration/tombstone 机制，不提供宽松 CLI 绕过参数。

## 内容 checksum 与版本事件身份

稳定业务证据身份：

```text
providerEvidenceIdentity = providerId + announcementId + stockId
                         + reportPeriod + periodScope + metric
```

规范化财务内容：

```text
providerContentChecksum = sha256(canonicalJson(
  evidenceIdentity + shape/value/range + currency/unit/accountingBasis
  + sourcePublishedAt + sourceTextEvidenceHash + parseRulesVersion
))
```

初始版本保留原 ID，避免现有 56 条产物无意义改号：

```text
initialVersionId = "company-guidance-version-" + providerContentChecksum
```

抽取纠错版本是“版本事件”，不能只按内容寻址：

```text
correctionVersionId = "company-guidance-version-" + sha256(canonicalJson({
  providerEvidenceIdentity,
  providerCorrectsVersionId,
  providerContentChecksum
}))
```

所以 A1→B→A2 中 A1 与 A2 可以具有相同 content checksum，但必须具有不同 version ID；B 指向 A1，A2 指向 B。历史仅按版本事件 ID 去重。no-op 重跑保留当前 version ID 和原 `createdAt`，不产生第四个版本。

对每条 extraction correction，校验器从完整 current + historical 图重新取得 predecessor，重新计算规范内容差异并要求 `providerCorrectionChangedFields` 精确相等；多报、漏报、重复或非内容字段均失败。`providerCorrectedAt` 必须是严格时刻、等于该 current record 的 `generatedAt`、不早于 predecessor 且不晚于发布 epoch。纠错字段及业务前序在 record/snapshot 两层必须完全镜像，下游不再有第二套未经验证的链值。no-op 重跑不新增 version event；若当前纠错记录进入新发布 epoch，仅同步其发布态纠错时间镜像，不改变 version ID 或原 `createdAt`。

Provider 抽取纠错使用 `providerCorrectsVersionId`；公司业务修正公告使用独立的 `providerBusinessRevisionPredecessorSnapshotId`；用户本地纠错使用 `correctsSnapshotId`。三条链不得混用，抽取纠错不产生业务上调/下调方向。

## 可恢复产物事务

详情目录、manifest、workflow index 和 summary 作为一个事务发布：

1. 所有新文件先写入同卷 staging root；
2. staging 内运行正式离线深校验，包括 byte size、SHA-256、目录文件集合和图契约；
3. 备份旧详情目录；
4. 激活新详情目录；
5. 备份旧 summary；
6. 激活新 summary；
7. 最后清理 backup 和 staging。

替换始终先确保目标不存在，再使用 rename，避免依赖 Windows/Linux 对已存在目标的不一致覆盖语义。提交前任一步失败会删除已激活的新产物并逐字节恢复旧目录与旧 summary；原异常保持为主异常，回滚异常作为附加信息。若仅最终 backup 清理失败，正式新目录与新 summary 已保持内部一致，生成器抛出 `ArtifactTransactionCleanupError` 并列出待人工检查的清理路径。

## 离线目录反向审计

`validate-company-guidance-expectations.mjs` 反向枚举正式输出目录。允许的 JSON 集合必须精确等于：

- manifest 声明的 56 个详情文件；
- `manifest.generated.json`；
- `workflow-index.generated.json`。

孤儿/多余 JSON、重复 stockId、重复 stockCode、重复 relativePath、summary 缺项/多项、详情内部身份不一致都会失败。校验器同时验证 schema/provider/parser、严格巨潮 URL、时间和区间、内容 checksum、initial/correction 版本事件 ID、current 唯一性、版本图、业务修订图、workflow 与详情 current 的逐字段镜像，以及原文只保留在详情层。

`summary.audit` 具有显式 TypeScript 类型并完全视为派生数据。生成器和离线校验器用同一个函数从全部已验证 detail 的 targets/current/historical/exclusions 反推 23 个审计字段，再以 canonical JSON 要求与 summary 精确相等；`sourceArtifact` 也必须等于约定常量。浏览器初始加载只校验 audit 结构、内部计数关系和可由 manifest 反推的公司/current/historical 数，不静态导入 56 个详情。完整真实性由离线门禁以 `detail_audit_projection` 失败码保证。

## 产物与命令

```text
src/data/real/a-share-company-guidance-expectation-summaries.generated.json
public/data/a-share-company-guidance-expectations/
  manifest.generated.json
  workflow-index.generated.json
  <stockId>.json  # 56 个
```

```bash
npm run data:fetch:expectations:company-guidance
node scripts/generate-company-guidance-expectations.mjs --dry-run
npm run data:validate:expectations:company-guidance
npm run test:expectations:company-guidance
npm run test:provider-observability
npm run test
npm run data:audit
npm run build
npm run ui:audit
```

## 已知限制

- 仍只覆盖当前 56 家股票池和已提交公告窗口，属于 partial coverage。
- 51 条目标公告因正文解析或证据不足被排除；不 OCR、不降置信度、不补 0。
- 当前真实产物没有 historical 版本；A→B→A、事务故障和请求竞态由离线/运行时故障注入测试覆盖，不制造伪历史。
- Provider 不包含机构一致预期、券商预测、估值、目标价、仓位或投资建议。
