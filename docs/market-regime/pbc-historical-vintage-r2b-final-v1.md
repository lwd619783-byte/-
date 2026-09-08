# R2-B final：独立 C-tier backcast 与审计包

Base/main：`4920e38830cfde887dab39e64673e7f30857e331`；修复基线：`66c77bcd83b1df3d13e37e20c0ca62d3e84eafba`。保持原 `feat/stage-4-1-r2b-pbc-historical-vintage-dataset-v1` 分支。

本报告取代[上一轮修复报告](pbc-historical-vintage-r2b-afre2-fix-v1.md)中“缺 first release 时 backcast 只能 extraction-only”的限制及其最新计数。冻结 Scope Freeze 3.1/3.2 已允许独立后发 backcast：sequence=0 是 collected chain start，不是 first-release 证明。旧封存数据与旧报告保留，不回写。

## 最小修复

移除 AFRE backcast 的 admitted-first-release 前置条件，继续要求原官方 URL、真实发布时钟、独立适用期 definition、字段及 scope evidence。没有合格原版时，第一条已证明 BACKCAST 以 sequence=0 / supersedes=null 准入，之后按真实后发时间递增，extraction predecessor 与 observation supersedes 同步。R1/R2-A schema、validator、selector 未改。

紧凑报告的 `firstRelease` 改为只检查已准入 observation 的事件，不能因为候选列表含有未准入的原始字段就提升 first-release coverage。Adapter version 纳入 dataset 内容版本身份；六个 backcast definitions 仅纠正 revisionPolicy 说明，ID、原始字段、适用期和 release 规则不变。

## 2017-02 AFRE YoY

| cutoff（上海时间） | select_vintage | sequence |
| --- | --- | --- |
| 2018-08-13 19:25:11 | None | — |
| 2018-08-13 19:25:12 | 13.2% | 0 |
| 2018-10-17 16:00:00 | 13.2% | 0 |
| 2018-10-17 16:00:01 | 14.8% | 1 |
| 2019-10-15 16:30:01 | 14.8% | 1 |
| 2019-10-15 16:30:02 | 14.8% | 2 |

后两版数值相同但 definition 不同，均保留。六次完整原始 HTML bytes 的 `select_vintage` 检查与集成模型测试通过。原发布的 comparable stock YoY 证据仍有缺口，因此此 period 的 provenFirstReleaseCount=0、backcastCount=1、vintageCount=3；首次后发事件前没有可用值。

## 最终计数

下表为主窗口；AFRE 2002–2014 backcast 搜索另计，余额/同比仍各 available=1/156、first-release=0、backcastCount=1、vintageCount=1。

| 指标 | available / target | proven first release / target | backcastCount（期间数） | vintageCount |
| --- | --- | --- | ---: | ---: |
| M2 余额 | 256/260 | 256/260 | 0 | 256 |
| M2 YoY | 256/260 | 256/260 | 1 | 257 |
| AFRE 余额 | 129/140 | 129/140 | 32 | 199 |
| AFRE YoY | **111/140** | **110/140** | **32** | **180** |

相对修复基线，只有 AFRE YoY available +1、backcastCount +1、vintageCount +3；proven first release 不变。2015-01～2018-06 YoY era 的 available 32→33、first release 32→32、backcastCount 17→18、vintageCount 83→86。其余时代计数不变。各 era 的 inventory/revision/dataset 状态全部保持 PARTIAL。

原有 891 条 observation 完整对象逐一比较不变，只追加 3 条；最终 894 observations、953 extractions、482 release sections。没有新 definition/event/field extraction，没有新增网络请求。整体冲突 sidecar 仍为 0，不等于修订档案穷尽。

2019-12 两个 XLS 的字段/原始 bytes 仍未准入；既有缺月、索引分页证明、revision 穷尽性继续 PARTIAL。2017-02 原始同比的 first-release 缺口明确保留。

## 门禁与最终材料

PBC 69 tests、R2-A 66 tests、R1 48 tests、项目 39 suites / 597 tests 全部 PASS；build/typecheck/browser boundary/bundle gate PASS（保留既有大 chunk warning）。env 为 READY WITH WARNINGS：44 PASS / 14 WARN / 0 FAIL / 4 SKIP。正式 build、独立 validate 与交付 diff 检查通过。

最终 sealed output：ignored `research-data/market-regime/vintages/pbc-r2b-final-v1`；generatedAt=`2026-09-08T12:57:12Z`；datasetContentSha256=`fdc9da9a871818a19438843191cc1205a705255038dfb32b979202183081f1e3`。四个 snapshot 保留前批原 bytes；648 个 raw 文件共 30,082,765 bytes，包含失败响应，路径/size/SHA-256 复验通过。

仓库内只增加[最终 coverage CSV](../../research-data/market-regime/source-catalog/pbc-final-coverage.v1.csv)、[最终 evidence](../../research-data/market-regime/source-catalog/pbc-final-evidence.v1.json)、[最终 AFRE-2 evidence](../../research-data/market-regime/source-catalog/pbc-final-afre2-evidence.v1.json)与[最终 vintage CSV](../../research-data/market-regime/source-catalog/pbc-final-vintages.v1.csv)。旧 review evidence 不覆盖。

普通 commit + push 后，在仓库外生成 `r2b-final-audit-bundle.zip`，manifest 绑定最终 Git HEAD 与上述 dataset hash。包内根目录的 `pbc-historical-coverage.v1.csv`、`pbc-historical-evidence.v1.json`、`pbc-afre2-evidence.v1.json` 分别映射上述 final 文件，避免把早期基线计数误当最终值；manifest 记录路径映射。包内每个 payload 文件列相对路径、byteSize、SHA-256。Manifest 不计算循环的自哈希，由 ZIP 的独立 SHA-256 保护。

ZIP 包含完整 raw、四个 snapshot、最终 input/dataset/report、最终 CSV/evidence、plan/definitions 和复验说明。打包后重新读取 ZIP 逐项校验，并核对 journal/dataset 引用没有遗漏。ZIP、完整 raw 和 sealed datasets 不纳入 Git；不创建 PR，交付后停止等待审查。
