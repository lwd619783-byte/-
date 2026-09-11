# Financial Research Foundations · Scope Freeze V1

> 2026-09-11 · CONTRACT FROZEN / PENDING REVIEW
> F1 wire version `financial-semantic-binding.v2`；F2 `evidence-graph.v1`；F3 `investment-research-golden-case.v1`。
> Runtime：NOT_IMPLEMENTED；production/data admission：NOT_ADMITTED。合同冻结不授权业务实现。
> Base：`origin/main @ 087c52a7962ed08c3f550d79987e0282be5607cf`；直接父基线：`02a29ff25e05afa31aa44cf5ccbb12cdade6db02`。

## 1. Existing → Reuse / Extend / New / Reject（先于 schema 的决策）

| Existing / 事实源 | 决策 | 基础层映射与兼容边界 |
| --- | --- | --- |
| `docs/market-regime/metric-registry-v1.md` §5；`config/market-regime/observation-catalog.schema.json` 的 sourceDefinitionVersion / metricObservationVintage | Reuse + Extend | 原 metricId、unit、nativeFrequency、definition、revisionPolicy、transformVersion 保持领域所有权。F1 仅增加字段绑定和 consumer policy；不再定义 Metric 或 Observation payload |
| `src/data/data-source-registry.ts` / `src/types/dataSource.ts` | Reuse | provider、source URL、coverage、sourceType、限制继续由原 Registry 持有；sourceId 与 Registry entry.id 不默认同义，必须显式绑定；generated_real / verified 不等于 admitted |
| `contracts/v1/entity-resolution.v1.schema.json` / Local Core Entity Resolver | Reuse | 查询直接复用 EntityRef；实体身份必须解析到原 Registry。`macro` EntityRef 与 `macro_metric` RegistryEntry 是不同 vocabulary，不能机械改名；universe 使用版本化 scope ref，不新造 Entity |
| `contracts/v1/research-asset-os.contracts.v1.schema.json#/$defs/EvidenceRef` | Reuse + Extend | 原 refType/refId 原样嵌入，新增外围 immutable pin；不改变 V1 quality enum、不把 asOf 当 releaseAvailableAt |
| `src/types/index.ts` EvidenceItem | Reuse | 原对象 ID / 来源 / 日期；缺 checksum、定位或可用时间只能保留 candidate，不自动变为完整引用 |
| `src/types/marketData.ts` 公告 / 财务；PIT RawSourceArtifact | Reuse | 公告 ID、报告期与 rawArtifactId 指向 retained bytes + locator；财务数字引用原字段；链接本身不足以证明引用完整 |
| `src/types/earningsExpectation.ts` Snapshot / canonical temporal / provider identity | Reuse | providerEvidenceIdentity 与 providerSnapshotVersionId 分开；extraction correction 与 business revision 分开；用户预期仍为 User Judgement |
| `src/types/researchEvent.ts` ResearchEvent / Verification | Reuse | eventOccurredAt、publishedAt、recordedAt、detectedAt 分开；Event 是原事实的事件视图，不是重复 Provider Fact |
| V2 Research OS design Thesis / IndustryResearchModule revision | Extend | 只添加 supporting / contradicting 引用关系；Thesis 内容、批准、revision 仍归原领域。未实现的 Thesis/Expression 不在本轮创造完整实体 schema |
| Phase 1B PositionSnapshot / Account / Asset / Ledger / DCA | Reuse | 图中 position 只是原对象版本引用；Thesis 关联不修改持仓数量、交易或账本 |
| Watchlist Review History / ReviewEvidenceRef | Reuse | Review 引用原历史版本，复盘不回写当时 Claim 或证据 |
| BridgeAuditEvent / append-only Audit / prepare-plan-confirm-commit | Reuse | 图不是审计日志或 mutation API；正式修订继续原批准、幂等与事务合同 |
| 跨 owner immutable pin / typed relation manifest | New | 只补引用定位、版本与关系，不能装载业务对象正文 |
| Golden Case + expected semantic result | New | 固定输入 fixture、业务 oracle、结果与证据集合；deterministic service / Agent 共用，不包含 SQL、prompt 或文案相等判断 |
| 第二套 Entity、Evidence、Metric、Audit、Position；万能 Metric payload；Graph DB / Vector DB | Reject | 无必要；会复制所有权或混淆金融口径。本轮无数据库、工具服务或新评分算法 |

## 2. F1：金融语义绑定，领域模型继续拥有值

新增 `contracts/financial-research/v1/` 是独立合同包，包版本 V1 与 F1 概念 V2 不混淆。不修改 `contracts/v1`，不加入现有 Local Core runtime registry。F1 是 **binding contract**，不是数据源清单或业务事实存储。

每个 binding pin 一个现有 metric 定义、source 定义、entity/scope 和 measurement/temporal/lineage/quality 的 owner 字段。字段路径用 JSON Pointer；缺失语义明确 null，禁止猜字段。`canonicalName`、unit、frequency 只通过原定义引用，不复制值。Domain 为 macro / industry / company / valuation / portfolio；aggregation、currency、reportingBasis、periodScope 必须由领域口径定义，不能隐式汇总、换汇或将单季与累计混用。暂无领域 Registry 的 Industry/Valuation/Portfolio 可表达 binding，但不能注册为已消费能力。

最小公共语义：identity（entity、metric、definition、scope）；measurement（value、unit、currency、frequency、aggregation、reportingBasis）；temporal（见下表）；lineage（source、artifact、transform/formula）；quality（原状态、coverage、admission、conflict、freshness）；consumer policy（allowedUses/forbiddenUses + policy ref）。allowed-use 只是必要条件，不能覆盖现有 admission/权限；交集为空或未知则拒绝。

| 时间语义 | 原字段映射 / 正式边界 |
| --- | --- |
| observationDate / period | PIT valueDate / tradeDate；财务 reportPeriod + periodScope。月粒度保持月，不补成虚构日；预测的未来报告期合法，不等于未来信息已披露 |
| publicationDate | 官方标注发布日；publicationDateTime / releaseDateTime / sourcePublishedAt 保留精度与时区。日期不是瞬时可得时间 |
| releaseAvailableAt | 证据证明的保守可得上界。strict PIT 必须 `<= asOf`；未知不准入。DATE_ONLY_SAFE 按原合同次日 00:00 Asia/Shanghai；SCHEDULE_INFERRED / LATEST_REVISED_PROXY 不进入 strict |
| effectiveDate | 定义或业务规则生效区间；sourceDefinition effectiveFrom/To 按 statistical period；不能代替发布时间。不存在时 null，不统一制造 |
| revision | 原 revisionSequence / supersedesObservationId / correction lineage；不排序任意字符串 revision，不跨独立 source chain 选“最大版本” |
| fetchedAt / recordedAt / createdAt / detectedAt | 采集、存储、审计时间；不证明历史 release。asOf 是查询截止，亦不是这些字段的 alias |

Deterministic request 固定 entity + metric binding + period(start/end/scope) + asOf + use + definition/scope pin；measurement 在 binding 对应的领域定义中固定。不允许 provider 顺序、模糊名称或向量距离决定数值。步骤：解析实体 → 精确匹配 key/definition/measurement → 验证 refs/admission → PIT 筛选 → 原 correction chain 选截止前唯一 terminal revision → 保留 quality/coverage。零项返回 missing；多条独立/分叉链返回 conflicted；缺证据、未知口径、policy 不允许均 fail closed。时间戳相等按现有 `<=`，不能用 array order 打破 revision 歧义。

实际跨域 resolver/service NOT_IMPLEMENTED。Golden fixture 使用原 MetricObservationVintage 验证最小可表达子集；实际财务、预期、Portfolio adapter 必须按上表实现自己的明确绑定和对应 tests，不能用 fixture oracle 替代。

## 3. F2：逻辑引用图

图只保存 immutable 引用和关系，不包含 Fact/Thesis/Position 正文。pin = owner + objectId + version + sha256 + locator；sha256 对 owner 归档字节，V1 locator 为归档 JSON 内 RFC 6901 Pointer。PDF/文本通过既有 Artifact 的定位记录引用精确页码/字段，不能只给首页 URL。native EvidenceRef 可原样附着。历史 mutable 对象需要先有 retained version，否则 missing_evidence。pin 不自动证明来源权威或 admission。

节点 kind：source、artifact、evidence、fact、derived_metric、claim、thesis、investment_expression、position、review。origin：provider_fact、derived_result、user_judgement、ai_draft；source/artifact/evidence 作为 provenance 使用 source_material。origin 必须来自 owner，不能由 AI 自报；AI 文本只能 ai_draft，哪怕引用真实来源也不能重标 provider_fact。

边方向统一从依据到消费者：Source → Artifact (`publishes`) → Evidence (`locates`) → Fact (`establishes`) → Derived Metric (`input_to`) → Claim / Thesis (`supports` / `contradicts`) → Expression (`expresses`) → Position (`motivates`) → Review (`reviews`)。Fact/Evidence 可直接支持 Claim，Claim 可支持 Thesis；不是强迫每条研究必须经过全部层。typed edge table 在机器合同中冻结。Position 的 motivates 只表研究关联，不授权交易或证明成交。

每个关系也有 immutable relationId、assertedAt、supersedesRelationId；图快照有 graphId/revision/asOf。revision > 1 必须 pin previousGraphRef；关系更正必须引用前图中的 predecessor，不得重用同一 relationId 改写内容。更正追加新 manifest/关系版本，旧图保留。关系 assertedAt 必须在图 asOf 前；历史事实重建与当时研究判断要区分：不能把今天建立的 Claim 关系写进昨天的图。所有 node releaseAvailableAt 均为引用可用性的保守上界；源无可靠时间则 null 并阻断支持资格。

节点 conditions 是原 owner 状态投影的 **集合**，不替代原状态：missing_evidence、partial、stale、conflicted、not_admitted、unknown。必须保留原因与 conditionSourceRefs；源状态映射未覆盖即 unknown。Provider status=generated_real、EvidenceRef quality=verified、Artifact parse=PARSED 都不直接推出 admitted。

支持判定：引用闭合、bytes/pin/locator 可验证、可用时间合格、原 owner provenance/准入明确，且至少一条完整 supporting lineage 才能 supported；缺 Evidence 绝不 supported。事实必须有 Evidence→Artifact→Source；derived_metric 必须非空 input_to 且绑定公式版本和输入 manifest。与 Claim/Thesis 相关的 supporting 和 contradicting 分支均取 conditions 并集，不能择优丢掉坏分支；存在反证就 conflicted（保留反证 refs），用户后续裁决须新 revision，不能清空原记录。上游问题沿消费者方向传播到 Thesis/Expression/Position/Review；不改资产事实本身。图循环和 dangling ref 拒绝。

## 4. F3：业务 Golden Case

Golden Case 包含 caseId/version/category、synthetic 标记、固定 fixture pin、operation、request、expected（outcome、selected refs、citation refs、conditions、value、unit、exAnte、reproducible）、rationale。结果采用固定语义字段，未适用值为 null；集合无序精确比较，不比较 prompt、SQL、模型措辞或解释文本。改变 expected 是 case 新版本，必须审查；不得为迁就 runtime 输出自动更新 golden。

首批八类：pit、temporal_revision、deterministic_retrieval、lineage_citation、unsupported_claim、quality_propagation、earnings_ex_ante、market_regime_recompute。每类含成功/拒绝条件，具体向量见包内 fixtures。未来 service 和 Agent 均把输出投影到同一 expected schema，且必须提交相同完整引用集合；Agent 自称“supported”不算 oracle。当前仅合同离线向量校验，不是 Agent harness 或服务运行时。

Earnings 资格复用现有 `beforeAnyPerformanceDisclosure`：formation/source availability 的保守上界必须严格早于 **最早相关 confirmed 或 possible disclosure** 的下界；同日精度重叠、unknown scope、仅比选定 actual 更早、缺 verified source、报告期/metric/basis/unit/currency 不匹配均不能 exAnte。用户预测不可包装机构一致预期；exAnte 不推出 above/below，数值比较继续原领域合同。

Market Regime 复算须 pin 输入 observations、source definitions、scope/calendar、cutoff、公式/transform 版本、固定分母与 missingness policy；输出数值和 lineage 同时相等才通过。未知分母保持 null，缺输入不缩分母、不补零。首批仅用显式 synthetic arithmetic fixture 证明复算协议，不新增评分算法，不授权任何真实温度/收益值；正式 A–D 公式和 backtest admission 继续原 Stage 4.1 门禁。

## 5. 验证、权限和停止点

JSON Schema 2020-12 校验结构；离线 contract checker 额外检查引用、时间、typed edges、不可升级状态及 Golden 语义。测试夹具全部 synthetic，不联网、不写 Local Core，不导入业务运行时。schema-valid 不等于 provenance 已证明。真实 bytes、domain adapter、authority/entitlement、独立审查与生产准入必须分别验证。

Local-first、PIT、Provider Admission、prepare-plan-confirm-commit、append-only Audit、AI 不执行真实交易均不变。F1/F2/F3 本轮冻结未来实现依赖边界，runtime/Graph DB/Vector DB/Cloud DB/Agent/Evidence Drawer/migration 均不实施。

验证与交付结果见 [validation](financial-research-foundations-contract-v1-validation.md)。CURRENT 同步 feature-registry 与 execution plan；战略 scope 与 runtime/data flow 未变化，roadmap 与 architecture 不机械改写。普通 commit/push 后核验 local=remote，等待独立审查，不创建 PR、不 merge。
