# Stage 4.1-G · Identity Bridge / PBC Evidence / Readiness V2

2026-09-13。原始实现基线：`origin/main @ ee7f2e35d967f58812706c2ee06255cc82ea4094`，fetch 后完全一致。
分支：`codex/stage-4-1-g-identity-pbc-evidence-closure`。
状态：IMPLEMENTED / VERIFIED（下列本地范围） / PENDING INDEPENDENT REVIEW。
DATA / PRODUCTION：NOT_ADMITTED。本文不声明本分支 MERGED 或 MAIN CI PASS。

## 2026-09-14 独立审计后最小同步收口

已审计功能提交：`aad643872fb32abe92e7b8517fc6209f0948a249`。本次 fetch 核验后，在同一功能分支正常合入 `origin/main @ 4bc68fec16ecb645b5690150c8f6d10a52342098`，无文本或实质语义冲突，保留原提交及全部 Stage G 实现。增量仅包括 main 已有的 CURRENT Development Direction 文档，以及 execution-plan、feature-registry、本文三份文档校正；不修改 Identity/PBC/Readiness、V1/V2 合同、数据或 admission。

[2026-09-13 Development Direction](../current-development-direction-2026-09-13.md) 为最新增量事实源，9 月 11 日 rebaseline 是其下层长期基线。Stage G 按独立审计、PR/CI/merge 流程收口后默认进入 **Stage 4.1B Research Inbox / Evidence Surface / Product Shell**；不默认新增 4.1-H/I，未闭合单指标数据任务作为并行数据支线，不重新阻塞产品主线（最新方向 §1.1 的真实正确性/安全条件除外）。

Stage G 仍为 **PENDING INDEPENDENT REVIEW**，等待本次最终 delta audit；不声明 MERGED / MAIN CI PASS。本次停止于同分支普通 commit/push 和 local=remote、behind=0 核验，不创建 PR、不合入 main。下文原始实现与验证记录保留交付时点意义。

本次同步后重新执行：`git diff --check` PASS；`npm run test:stage-4-1-g` PASS（27 Node + 14 Python）；`npm run data:validate:pbc-evidence-v2` PASS；`npm run data:validate:semantic-readiness:v2` PASS；`npm run test:semantic-runtime` PASS（37）；`npm run test:contracts` PASS（106 + 78）；`npm test` PASS（55 files / 725 tests）；`npm run build` PASS（保留既有 bundle size warning）。相对已审计提交的四文件 allowlist 核验通过，main 带入的方向文档原样保留，代码/合同/数据无 diff；PBC full graph/admission 仍 BLOCKED，normalization/backtest 仍各 READY 0 / BLOCKED 23。

## 身份边界与最终方案

| Owner | 实际语义 | 本轮处理 |
| --- | --- | --- |
| 原 Entity Registry / Resolver | RegistryEntry 的 `macro_metric`、原 entityId、revision、active/candidate/merged/archived | 保留原模型、数据库与 Resolver；每次通过原 Repository 的只读 list 核对当前完整 entry |
| F1 Query / EntityRef | `entityType="macro"` 的查询身份 claim | 不能以字符串、displayName 或调用者自报证明解析 |
| Market Regime definition | `metricId` 标识指标，sourceDefinitionId/version 标识统计口径 | 通过原 definition pin 验证；不与 entityId 等同 |

现有 `EntityService` 明确拒绝无法由 V1 Audit EntityRef 表达的 `macro_metric` mutation 并回滚；本轮没有更改该边界，也没有创建实体。原 `V1EntityResolver` 的 name/alias 候选机制不是跨 vocabulary equivalence 的凭据。

新增 `contracts/stage-4-1/v2/macro-identity-mapping.v1.schema.json` 与 owner policy V2：明确 F1、metric 与 Registry 三端，全集合 exact 1:1，重复/冲突 fail closed。mapping 与 review 都要求完整 owner/locator/objectId/version/digest；review 绑定 mapping 正文 digest、reviewer、时间、decision。revision 保留立即前驱，端点不可静默替换；revoked 仍可审计。审查记录是仓库治理 attestation，不是密码学签名。

保留的 Registry export 仅是 pin 证据，不是第二套 Registry。trusted Node host 给 `createMacroRuntimeV2({registry: {owner, list}})` 接入原 Repository 的只读能力；runtime 每次重读真实 owner，只接受唯一 active、userConfirmed、无 mergedIntoEntityId、内容和 revision 均与 pin 相符的 entry。query 本身不接受 mapping、policy、Registry 或 admission 参数。模块未打开、初始化或迁移本地数据库。

内部合同审计在依赖新语义前通过；随后内部只读 runtime 审查与专项测试通过。两者不替代普通 push 后的远端独立审计。

**真实身份状态：resolved 0 / unresolved 23。** 已实现解析机制，但当前没有 confirmed Registry owner/export/reviewed mapping；policy 为空，不能用 synthetic 测试创建正式事实。committed readiness 不接本机 Registry port，明确评估可提交证据；即使以后加入 mapping，也还需正式 owner 接线/可重放证据任务，不能仅把 policy 改成“resolved”。

## PBC 实际闭合

当前工作区缺少 full ignored archive，但原 R2-B 注册工作树保留了 sealed bytes。4 个 snapshot、8 个 sidecar、完整 catalog/dataset digest 均已对账；原生 full local validator PASS 仍只对应原 PARTIAL admission。

本轮提交两份完整 RAW_SOURCE（28,539 / 39,229 bytes），闭合一条 `MACRO_M2_YOY / 2011-10 / 12.9%` 原生 observation。发布日期证据、原始 acquisition、extraction locator、definition、observation ID、revision root 与 PIT cutoff 通过原 R1/R2 validator 和原 PBC parser 重放。采集发生于 2026-09-08，未声称 2011 年已保留这些 bytes；未联网 reacquire，未以 fetchedAt 推导 release。

完整 checksum、正式 HTTPS source、时间与定位见 [PBC 专项证据](pbc-evidence-closure-v2.md)；机器记录为 `source-catalog/pbc-canary-v2/{graph,closure-report}.json`。完整图仍 BLOCKED：仅提交 1/894 条，剩余 full input/dataset/raw 与 snapshot 仍为 ignored local archive；revision inventory、完整 coverage 和 source admission 未闭合。保留 PROVISIONAL quality，query 不输出 admitted value。

## V1 → V2 与查询入口

原 V1 owner/readiness/runtime 及 Financial Research Foundations、`contracts/v1` 未改写。`preserved-v1.json` 固定基线 34 个原文件的 UTF8_LF 摘要（仅用于文本历史完整性，不用于 raw bytes）；validator 同时检查该 manifest 固定摘要与原 V1 重新推导结果。V2 另有 schema、report、入口。

```js
import { queryMacro, queryForDefinition } from '../../scripts/semantic-runtime/market-regime-adapter-v2.mjs';
// entity 仍是 caller claim；默认无正式 Registry mapping，因此结果保持 blocked。
const request = queryForDefinition('pbc-m2-yoy-2011-v2',
  { start: '2011-10-01', end: '2011-10-31' }, '2011-11-14T08:00:00+08:00',
  'strict_pit', { entityType: 'macro', entityId: 'caller-claim' });
const result = queryMacro(request);
```

V2 canary 通过完整 native graph 验证后交给同一个 `selectVintage`；仅对该条已可见 observation 关闭 excerpt/catalog/extraction 缺口，保留 source/quality/coverage/freshness 等门槛。截止前不返回 future observation ID、value 或 extraction refs。原 `market-regime-adapter.mjs` 与 V1 CLI 继续保持 V1 语义；V2 CLI 为 `npm run data:query:macro:v2 -- <repo-relative-F1-query.json>`。

| 评估项 | V1 | V2 |
| --- | --- | --- |
| 正式 Registry resolution | 0 resolved / 23 unresolved | 0 resolved / 23 unresolved；已有显式 mapping 验证机制 |
| RAW_SOURCE → native observation canary | BLOCKED | PASS，1 条、2 份 raw |
| COMPLETE_OBSERVATION_GRAPH_REPLAY | BLOCKED | BLOCKED，未由 canary 提升 |
| Normalization | READY 0 / BLOCKED 23 | READY 0 / BLOCKED 23 |
| PIT historical backtest | READY 0 / BLOCKED 23 | READY 0 / BLOCKED 23 |
| Overall | READY 0 / BLOCKED 23 | READY 0 / BLOCKED 23 |

报告逐项输出全部 23×16=368 条 full-scope gate delta：previous/current status、blockers、supporting refs、是否真实关闭、是否需 source/Registry owner 后续任务；这些 gate 的状态均未被提升。独立 `evidenceCapabilityDelta` 记录单条 canary 的 BLOCKED→PASS，不能作为 readiness required gate 的替代。

新关闭的是该 canary 的真实 raw/extraction/native replay 缺口；未关闭正式 Registry owner、完整 PBC graph、revision inventory、coverage、release/calendar、freshness、semantic binding completeness 等原门槛。all-A D3 与 CSRC 原 counts/非 identity gate 原样对账；未实施 normalization 数值、weekly matrix、backtest、formula admission 或相邻业务功能。

## 验证与交付边界

| 命令 / 检查 | 本地结果 |
| --- | --- |
| `npm run test:stage-4-1-g` | PASS，27 Node + 14 Python 专项 |
| `npm run data:validate:pbc-evidence-v2` | PASS，canary PASS / full graph BLOCKED |
| `npm run data:validate:semantic-readiness:v2` | PASS，V1 preservation、V2 schema、源重推导、gate delta、committed bytes |
| `npm run data:validate:semantic-bindings` | PASS，28 bindings |
| `npm run test:semantic-runtime` | PASS，37/37 原 V1 专项 |
| `npm run data:validate:semantic-readiness` | PASS，原 V1 report 不变 |
| `npm run contracts:validate` | PASS，原 F3 33 cases / 8 categories |
| `npm run test:contracts` | PASS，原 V1 106 + Foundations 78 |
| `npm test` | PASS，55 files / 725 tests |
| `npm run build` | PASS；既有 bundle size warning 保留 |
| `npm run data:audit -- --no-write` | PASS with warnings，0 errors / 24 warnings / 10 skipped |
| `npm run env:check` | READY WITH WARNINGS，48 PASS / 10 WARN / 0 FAIL / 4 SKIP |
| Git index 导出副本：bindings / V1 readiness / V2 readiness / Stage G tests | PASS；不含 ignored archive，canary 仅用 committed bytes 重放；共享既有 Node dependencies/Python 环境，不声称全新 npm ci 或 Hosted/Linux 认证 |
| `git diff --check` / staged diff check | PASS；raw 保持原字节并按二进制证据对账 |

新增三个直接 CI 步骤：Stage G tests、PBC V2 validator、readiness V2 validator；原 V1 三门禁仍执行。均无生成报告、条件跳过或 continue-on-error。Hosted CI 实际执行须后续远端事件核验，当前只声明配置已接入和本地验证。

CURRENT 同步 feature-registry / execution-plan；新增 runtime/evidence flow 同步 architecture。战略顺序未改变，不修改 roadmap。完成最终 diff 自审与 `git diff --check` 后普通 commit/push，核验 local HEAD=remote HEAD，停止等待独立审计；不创建 PR、不 merge。

## 最终 diff 与文件清单

自审确认新增范围仅为版本化 identity/readiness、单条原生 PBC graph 与两个 raw、专项 tests / CI / CURRENT 文档。既有 V1 合同与 report 无差异。raw 按 `-text -diff` 保存，避免 Git 修改或按代码格式要求清理证据本身的原始换行/空白；真实性仍由完整 SHA-256 / byteSize 验证。

以下 29 个文件构成原始已审计功能提交的交付：

```text
.gitattributes
.github/workflows/ci.yml
config/market-regime/semantic-identity-policy.v2.json
contracts/stage-4-1/v2/README.md
contracts/stage-4-1/v2/macro-identity-mapping.v1.schema.json
contracts/stage-4-1/v2/preserved-v1.json
contracts/stage-4-1/v2/readiness.schema.json
contracts/stage-4-1/v2/semantic-runtime.schema.json
docs/architecture.md
docs/development-execution-plan-2026-09-07.md
docs/feature-registry.md
docs/market-regime/identity-pbc-evidence-closure-v2.md
docs/market-regime/pbc-evidence-closure-v2.md
package.json
research-data/market-regime/semantic-readiness/report.v2.json
research-data/market-regime/source-catalog/pbc-canary-v2/closure-report.json
research-data/market-regime/source-catalog/pbc-canary-v2/graph.json
research-data/market-regime/source-catalog/pbc-canary-v2/raw/90b516493937671ecb867084722a276165135a43fb209f6fed317c077c7dc76d.html
research-data/market-regime/source-catalog/pbc-canary-v2/raw/ae3ba30b58f7ff84750c61550e85f5cf88f65dfff514a382254618aff3e01dc1.html
scripts/market_regime/pbc_canary.py
scripts/semantic-runtime/cli-v2.mjs
scripts/semantic-runtime/identity-bridge-v2.mjs
scripts/semantic-runtime/market-regime-adapter-v2.mjs
scripts/semantic-runtime/pbc-evidence-v2.mjs
scripts/semantic-runtime/readiness-v2.mjs
scripts/tests/identity-bridge-v2.node.mjs
scripts/tests/pbc-evidence-v2.node.mjs
scripts/tests/semantic-readiness-v2.node.mjs
scripts/tests/test_pbc_canary_v2.py
```
