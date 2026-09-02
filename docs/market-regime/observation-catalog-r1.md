# Historical Observation Catalog Skeleton R1

> Task 4.1-R1 实施说明
> 代码审计基线：`8a1d4c110b5eb8a248701be6cd84470d1fa0d7f7`
> 状态：研究基础设施；未准入生产评分或前端

## 1. 边界

本实现只建立历史 Point-in-Time 观测目录、官方源 probe 和离线校验基础。它没有计算 MarketTemperature，没有实现 Candidate A-D、percentile、module weight、UI、Portfolio、Supabase 或生产自动刷新。

现有 `scripts/fetch-macro-data.py` 继续服务当前宏观看板。它通过 AKShare 生成 `src/data/real/macro.generated.json`；本 R1 不删除、不重构，也不把历史 catalog 接入该文件或默认 `data:refresh`。

## 2. 数据链路

```text
SourceDefinitionVersion
        ↓
RawSourceArtifact
        ↓
MetricObservationVintage
        ↓
ObservationCatalog + deterministic content hash
        ↓
WeeklyBacktestClock schema
        ↓
BacktestInputManifest schema
```

核心 JSON Schema 位于 `config/market-regime/observation-catalog.schema.json`。Python typed contract 位于 `scripts/market_regime/models.py`。

`RawSourceArtifact.artifactRole` 明确区分：

- `RAW_SOURCE`：live probe 实际下载的官方原始响应；
- `TEST_FIXTURE_EXCERPT`：仅供离线 parser/validator 使用的受控摘录，绝不能冒充完整原始证据。

## 3. 时间语义

基线时钟冻结为：

```text
timezone = Asia/Shanghai
weekday = Monday
cutoff = 08:00
```

实现位置：`scripts/market_regime/time_semantics.py`。

严格 eligibility 只有一个主条件：

```text
observation.releaseAvailableAt <= weeklyCutoff
```

另外，`LATEST_REVISED_PROXY` 与 `STRUCTURALLY_UNAVAILABLE` 在 strict 模式下直接排除。`BACKCAST_RELEASED_LATER` 仍按它真正的 `releaseAvailableAt` 判断；早期 `valueDate` 不会获得提前可见性。

只有官方发布日期、没有准确时间时：

```text
releaseDateTime = null
metadata.publicationDate = official date
releaseAvailableAt = publicationDate + 1 day 00:00 Asia/Shanghai
releaseConfidenceClass = DATE_ONLY_SAFE
```

## 4. Deterministic catalog

`scripts/market_regime/catalog.py` 对各实体按稳定 ID 排序，并分别计算 definitions、artifacts、observations 与完整业务内容的 canonical SHA-256。

`generatedAt` 是运行元数据，不进入 `catalogContentSha256`。因此相同输入在不同运行时间具有相同内容哈希；使用相同固定 `generatedAt` 时，输出字节也完全一致。

受控 sample catalog：

```text
research-data/market-regime/source-catalog/catalog-seed.sample.v1.json
research-data/market-regime/catalog/observation-catalog.sample.v1.json
```

这两个文件是离线 contract fixture，不是完整历史数据库，也不是生产数据。

## 5. Validator fail-closed 规则

`scripts/market_regime/validator.py` 至少检查：

- definition / artifact / observation ID 唯一；
- observation 的 metric、unit、source 与 definition 一致；
- observation → artifact 引用完整；
- RFC 3339 时间含时区，且 `fetchedAt >= releaseAvailableAt >= releaseDateTime`；
- `valueDate` 不晚于对外可见时间；
- `DATE_ONLY_SAFE` 必须使用次日 00:00 上海时间；
- revisionSequence 非负，supersedes 不自引用、不跨 metric/valueDate、链无环；
- missing/structurally unavailable 不得伪装成数值 observation，尤其不得写成 0；
- artifact 必须是 2xx 成功下载、SHA-256 格式正确，可选择核对本地 bytes；
- manifest counts、范围与 content hash 可重算；
- 北交所成立前只能是 `STRUCTURALLY_UNAVAILABLE`，所有数值为 null；
- CSI 300 历史 TTM PE Provider slot 在新官方证据出现前必须保持 `NO_GO`。

错误不会被静默修复。build 遇到 validation error 不发布输出。

## 6. Collector / adapter 状态

### PBC M2 — PASS

官方页面 parser 能保留 `period / source URL / publication timestamp / M2 balance / M2 YoY / definition notes`。live probe 成功读取 2005、2015、2024 三个时代样本。

### PBC AFRE stock — PARTIAL

schema 与 parser 能表达 stock、YoY、definition version、revision/backcast。2014 年存量数据在 2015-02-10 正式发布，按 `BACKCAST_RELEASED_LATER` 保存；该信息在此前的周度回放中不可见。完整的月度 first-release vintage 目录尚未枚举，因此不能标为 PASS。

### CSRC monthly reports — PARTIAL

live probe 实际下载并校验了 2005、2010、2015 和 2026 样本。前三个是 `.xls`，近期样本已出现 `.docx`。页面只有发布日期时执行 `DATE_ONLY_SAFE`。

附件的 SHA-256、byte size、content type 和 URL 见：

`research-data/market-regime/source-catalog/p0-live-probe-evidence.v1.json`

R1 没有引入 `xlrd`，也没有声称已识别 IPO/再融资字段。所有附件保留为 `FIELD_SCHEMA_PROBE_REQUIRED`。

### SSE / SZSE / BSE market stats — PARTIAL

`scripts/market_regime/market_adapters.py` 建立 exchange adapter Protocol、市场 scope 版本和结构性不可用 helper。当前没有强行拼接 2005-2026 的沪深北日频数据。BSE 只从 2021-11-15 进入 scope，之前绝不写成 0。

### CSI 300 historical TTM PE — NO_GO

`scripts/market_regime/providers.py` 提供显式 Provider slot。调用 `collect()` 会 fail closed。官方 factsheet 只能证明滚动 PE 字段存在，不能证明已经拥有 2005 至今可自动化的官方 PIT 历史序列；本实现没有替换成第三方源。

## 7. 命令

```text
npm run test:market-regime:catalog
npm run data:build:market-regime:catalog
npm run data:validate:market-regime:catalog
npm run data:probe:market-regime:p0
```

前三个命令完全离线。最后一个是显式 live probe，网络失败不会影响普通测试。

## 8. 存储与前端隔离

历史研究数据位于 `research-data/market-regime/`，没有放进 `src/data/real`，也没有被任何 React / Vite 入口 import。

`.gitignore` 默认排除：

- raw download；
- extracted / vintages；
- weekly manifests / features / backtests；
- live probe 临时输出；
- generated catalog。

Git 只提交 schema、代码、紧凑 sample catalog、受控 fixture 与 live probe 的小型证据摘要，因此历史大数据不会进入 Vite initial bundle。
