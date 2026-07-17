# A股公司指引预期 Provider V2（V1 终局稳定化）

## 一句话结论

V2 不新增数据源或业务功能，而是把 V1 收口为可审计的全局工作流：Real/Mixed 模式先独立校验轻量 workflow index，Mock 模式严格关闭真实 Provider；公司明细继续懒加载且单家公司失败不拖垮其他公司；证据身份、内容版本、抽取纠错和业务修正公告分别建模。

输入仍只来自已提交的巨潮公告产物。生成过程不访问网络、不修改公告/财务源产物、不进入默认 `data:refresh`，也不代表机构一致预期已接入。

## 数据与边界

- 仅接收 `performance_forecast` / `performance_forecast_revision` 中已解析为高置信区间的归母净利润、扣非净利润和营业收入。
- `metadata_only`、低置信、区间缺失、报告期不明、非官方 URL、快报、定期报告、新闻、券商预测和用户推断均不进入 Provider。
- 当前提交产物覆盖 56 家 A 股公司状态；15 家、31 个公告形成 56 个当前快照；51 个目标公告被显式排除。
- 公司内部形成时间未知：`formedAt=null`，`formationTimeBasis=public_disclosure_proxy`，公开日期只作为证据可用时间代理。
- Provider 只读，Store API 拒绝 `ingestionMethod=provider`，不会写入或覆盖 LocalStorage 的 manual / JSON / CSV 追加链。

## 全局工作流与失败边界

```text
manifest.generated.json
  -> workflow-index.generated.json  # 全局当前版本、轻量、带 checksum
  -> Comparison / ResearchEvent / ReviewTask / KPI

<stockId>.json                       # 原文、排除项、历史版本、完整警告
  -> 个股抽屉或预期证据页按需加载
```

- App 启动 Real/Mixed 后立即加载并深校验 workflow index，逻辑不依赖当前导航页或所选公司。
- Mock 模式的 active Provider records 始终为空；旧请求通过 request generation guard 不能跨模式回写。
- workflow index 字节数、SHA-256、schema、记录身份、内容 checksum、当前版本唯一性、版本图和业务修订图任何一项失败，正式 Provider 全局关闭；本地快照仍可工作。
- 公司详情使用 `Promise.allSettled`；成功项缓存，失败项保留结构化公司 ID / 错误码并可重试，失败不缓存为成功。
- 进入个股只加载该公司；进入预期证据/验证中心才批量加载有状态公司明细。全局事件、任务和 KPI 始终来自已验证 workflow index，而不是页面导航触发的详情集合。

## 不可变证据与版本账本

同一公告业务证据使用稳定身份：

```text
providerEvidenceIdentity = providerId + announcementId + stockId
                         + reportPeriod + periodScope + metric
```

每次规范化内容使用 SHA-256 寻址：

```text
providerContentChecksum = sha256(canonicalJson(
  evidenceIdentity + shape/value/range + currency/unit/accountingBasis
  + sourcePublishedAt + sourceTextEvidenceHash + parseRulesVersion
))
providerSnapshotVersionId = "company-guidance-version-" + providerContentChecksum
```

- 无内容变化的重复生成保持相同 version ID 和原 `createdAt`；`providerGeneratedAt` 可更新。
- V1 同内容迁移只换算 V2 身份并保留原 `createdAt`，不会制造伪历史。
- 同一 evidence identity 内容变化时，旧 current 追加到 `historicalProviderVersions`，新 current 通过 `providerCorrectsVersionId` 指向旧版本，并记录 `providerCorrectionType`、纠错时间和变更字段。
- 旧证据在新输入中消失时生成器直接失败，禁止静默删除历史。
- workflow index 只含 current；公司详情保存 current、历史版本、原文证据、排除项与完整警告。

## 两类“修正”严格分离

- Provider 抽取/来源纠错：`providerCorrectsVersionId`，产生 `earnings_expectation_correction`，明确“不表示业务上调或下调”。
- 公司修正公告：`providerBusinessRevisionPredecessorSnapshotId`，仅在同公司、报告期、期间口径、指标、时间和唯一前序均兼容时连链。
- 通用 `correctsSnapshotId` 只服务用户/本地数据纠正。Provider 快照必须保持 `correctsSnapshotId=null`，避免数据修复与业务修订混用。
- 只有经过业务修正链确认的 Provider 修正公告才可产生 `businessRevisionDelta`；抽取纠错永远不产生方向。

## 官方 URL 与本地证据关系

官方公告只接受：HTTPS、精确主机 `www.cninfo.com.cn`、精确路径 `/new/disclosure/detail`、唯一数字 `annoId`，无凭据、端口、fragment 或额外 query。PDF 只接受 HTTPS、精确主机 `static.cninfo.com.cn`、`/finalpage/YYYY-MM-DD/<annoId>.PDF`，日期/ID 必须与记录一致。

本地快照与 Provider 使用四类关系：

- `exact_duplicate`：财务字段和审计元数据均相同；
- `metadata_difference`：财务内容相同，只是来源名、标题、备注等元数据不同；
- `content_conflict`：同一官方证据与业务身份，但区间、点值、口径、单位、币种或来源日期不同；
- `independent`：不是同一严格官方证据。

前三类本地记录都保留可见，但正式 Comparison 只使用 Provider。`content_conflict` 额外生成稳定的结构化 `data_warning` ResearchEvent；观察清单公司同步生成 ReviewTask，列出冲突字段与双方版本 ID。

## 深校验与产物

```text
src/data/real/a-share-company-guidance-expectation-summaries.generated.json
public/data/a-share-company-guidance-expectations/
  manifest.generated.json
  workflow-index.generated.json
  <stockId>.json  # 56 个
```

生成端与离线验证器共用 `scripts/company-guidance-expectations/core.mjs` 的单记录、版本图、业务修订图和详情校验。Runtime 镜像同一规范并对实际下载字节重新计算 SHA-256。校验覆盖 schema/provider/parser 版本、严格 URL、时间、区间、证据身份、内容 checksum、版本 ID、current 唯一性、前序存在性、循环、跨证据连链、业务前序兼容性、manifest/summary/workflow 计数、checksum 和孤儿记录。

## 命令

```bash
npm run data:fetch:expectations:company-guidance
node scripts/generate-company-guidance-expectations.mjs --dry-run
npm run data:validate:expectations:company-guidance
npm run test:expectations:company-guidance
npm run data:audit
npm run build
```

CI 继续离线运行专项测试、提交产物深校验、数据审计、全量测试与 bundle 门禁。默认刷新链、Provider Stability Gate、Developer Health Gate 和公告/财务源产物保持不变。

## 已知限制与风险

- 仍只覆盖当前 56 家股票池和已提交公告窗口，属于 partial coverage。
- 51 条目标公告因正文解析或证据不足被排除；不 OCR、不降低置信度、不补 0。
- 当前真实产物没有可可靠连链的公司修正区间，也没有历史内容版本；相关路径由离线固定测试覆盖。
- Provider 不包含机构一致预期、券商预测、估值、目标价、仓位或投资建议。
- workflow index 校验失败会主动关闭正式 Provider，这是证据安全设计，不应回退 mock 或半验证数据。
