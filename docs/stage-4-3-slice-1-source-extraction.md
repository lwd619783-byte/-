# Stage 4.3 / Slice 1 — Source + Extraction

状态：IMPLEMENTED / VERIFIED LOCALLY / INDEPENDENT REVIEW PASS / PENDING PR-HOSTED CI。开发基线：`98f92f9f1386d88e3baf890058c07ffc9c718fb5`。功能分支：`codex/stage-4-3-slice-1-source-extraction-contract`。初次独立审计为 P0=0 / P1=1；第三方作者误归因已在 `a716b2205d3056e99198852224bf56ad71026a36` 定向修复，最终针对性复审结论 PASS（P0=0 / P1=0）。Hosted CI 尚未运行；PR/merge/main CI/Production admission 仍未发生。

## Reuse / Delta Map（实现前决定）

| 现有真源 / seam | 直接复用 | Slice 1 delta / 禁止复制 |
| --- | --- | --- |
| `src/types/creatorViewpoint.ts` CreatorSource / Creator / Topic | 原始内容、身份、时间、覆盖、parent / supersedes | L0 只投影 metadata 和精确 content ref，不存全文，不建第二个 Source / Creator registry |
| ViewpointObservation / ViewpointApproval | 不可变观点、条件、理由、事件关系、一次审批；重审追加 revision | L1 只读投影，review 由原 Approval 派生；不回写状态，不复制持久化 Observation |
| `src/services/creatorViewpoint.ts` | knowledge visibility、effectiveAt、coverage、chronology、Current View、T+ Review | 复用纯函数；只额外拒绝 Source/Observation revision fork，不替 owner 选择赢家 |
| `src/types/researchEvent.ts` / `CreatorEvidence.tsx` / Evidence Drawer | ExternalResearchEvent 引用、explicit/inferred/temporal 关系与原下钻 owner | 不把关联事件改成因果事实；不新建 Event/Evidence 或抽屉 |
| `src/services/evidenceGraph.mjs` / F2 schema | 原 EvidenceRef、pin、graph revision、authority 边界继续有效 | SourceRef 是 owner ID 引用，不是 F2 immutable byte pin；不建立第二个 Claim Graph，不伪造 graph closure |
| Local Core EntityRepository / RegistryEntry / `src/types/index.ts` Industry | 正式 Entity 和行业 identity 继续由原 owner 拥有 | Creator Topic 是独立命名空间；无明确 mapping 时 entity/industry refs 为空且 mapping 标 not_provided，不从标签猜 identity |
| CreatorViewpointRepository / PersistedBaseGuard | load、append-only、冲突导入、JSON backup、corrupt lock/recovery、基线保护 | 新 repository seam 只读取原 repository；本轮没有需要独立落库的 native extraction，不新增 storage key/table/migration |
| F3 Harness / frozen 33-case / industry suite | 原门禁与语义评估边界 | 新 L0/L1 synthetic domain cases 独立验证，不改 frozen roster，不冒充原 33 项 actual service coverage |

最小新增合同：versioned `ResearchSourceRef`、`ResearchSource`、`ResearchExtractionRef`、`ResearchExtraction` 与 `ResearchSourceAdapter` / 只读 repository seam。初始可解析 domain 仅 `creator`；未来 owner 须新增经审计的 adapter，不能靠任意 domain 字符串或 JSON blob 自动接入。

Slice 1 不处理：native extraction 写入、其他来源正式 adapter、Wiki、Verified Claim、Thesis、Investment Expression、MCP、Agent、真实 LLM、cloud business DB、浏览器 SQLite、UI Workspace、Vector DB。持久化的一等 extraction 目前就是既有 ViewpointObservation；统一 read model 可由其历史重建。

## 公共合同与首个 owner profile

`contracts/research-extraction/v1/research-extraction.schema.json` 是 owner-neutral 公共读合同；`creator-projection.schema.json` 是首个正式 adapter 的更严格 profile。两者均关闭未知字段，没有万能 JSON payload。公共 ref 携带 version、domain 和精确 immutable ID；domain 字符串本身不注册 adapter。当前 runtime 仅解析 `creator`，其他 domain、错误版本、空 ID、额外字段和 missing owner 均拒绝。

公共 L0 支持 source type/class、Entity/Industry/Topic refs、author ref、provenance、published/captured/recorded/asOf、completeness/uncertainty、content ref 或 owner-provided SHA-256 digest、revision refs。Creator profile 不生成 digest，不复制 content；其精确 contentRef 可通过 `traceSource` 读取原 Owner 的冻结快照。所有 owner 返回对象和 read model 都是脱离调用者引用的 immutable 内存视图，不是第二份持久化真源。

公共 L1 的 finding 使用有限 discriminated union：viewpoint、relationship、fact_candidate、driver、catalyst、risk、invalidation、open_question。AI author/extractor 必须保留 `ai_draft` semantic class；`DRAFT_EXTRACTION_REVIEW` 是冻结的默认审核状态。质量 review 需要原 owner 的 append-only approval ref/time，不能改变 AI origin，更不能生成 Provider Fact / Verified Claim / Thesis。公共 schema 表达这些语义不代表已经创建 native AI extraction owner、存储或 LLM runtime。

Creator profile 只产生 ViewpointObservation 实际提供的 viewpoint 与 event relationship；reasoning 保留原语义，不伪装成证实的驱动因素。extractor type/method/version 均保持 unknown/null。`verified_self / unverified` 的 author ref 引用原 Creator；`other` 的 L0 authorRef 为 null，L1 author 为 unknown/null，不能归因给 tracked Creator。Source 的 `provenance.creatorId` 与 Extraction 的 `creatorContext.creatorId` 保留讨论链上下文，与 actual author 分离；authorIdentity、commentCoverage、parent source 和 combined sourceCoverage 原样保留。Creator Topic 没有正式 Entity/Industry mapping，故数组为空并标记 `not_provided`。公共 Entity identity 的 enum 引用原 RegistryEntry，不使用名字映射，不把 `macro_metric` 改成 `macro`。

## 时间、审核、revision 与反查

- `asOf` 是显式、带时区的 knowledge cutoff；`createdAt` 对应 Observation 在本地被记录的时刻，不声称是作者创作/模型运行时间。`effectiveAt` 复用 `creatorEffectiveAt`，unknown publication 始终得到 null，绝不回退到 captured/recorded/approval。
- Source visibility 通过从原服务抽出的 `visibleCreatorSources` 复用原递归 parent visibility；Observation visibility、审核状态、chronology 和 Current View health 全部调用原服务。后来的来源、观点、事件发布时间、审批、topic 关联和 revision successor 不进入过去视图。
- `review.status` 是只读派生字段。Creator 原 Approval 一次审核，不可静默改写；重审必须新建 Observation revision。draft/rejected 不进入 reviewed Current View。`reviewedAt` 在 rejected 行表示原质量审核决定时间，不表示审核通过。
- `revision.supersedes` 精确指向原 immutable ID，`successor` 只表示已知结构修订，不表示 successor 已审核或成为 Current View。draft/rejected successor 不会让原 reviewed 状态自动 supersede。所有版本可单独反查。
- Source/Observation fork 在 adapter 层拒绝，原 Creator 历史不改写；修订前驱在指定 cutoff 不可见时拒绝整个 read session，不静默清空历史引用。无效完整 envelope（包括后录入的结构损坏）同样 fail closed，不提供部分成功视图。
- `creatorContext.chronology` 复用原 chronology status；`chronologyHealth` 和 unresolved refs 引用原 Current View 服务，null 表示没有可确定的 Current View，不等于 resolved。这里没有第二份 Current View 对象或状态机。
- `traceExtraction(ref)` 返回精确 Observation、Source、Creator、Topic、cutoff 内 Approval 和关联 ExternalResearchEvent；旧 Observation 不自动指向新 Source。`traceSource` 保留原文但不暴露未来 owner 数据。既有 Evidence Drawer 可继续消费这些原 owner，没有新增 UI/导航写路径。
- 外部 serialized projection 必须经过 `validateSource` / `validateExtraction` 对原 owner 重新投影并逐字段比较；schema-valid 不是信任依据。反查 identity 不依赖数组下标、显示标签或会变化的 latest/current ID。

## Local-first seam

`CreatorResearchExtractionRepository(owner).read(asOf)` 只调用既有 repository 的 `load`，无缓存、无新 storage key、无 append/import/recovery 代理权限。每次 read 建立独立冻结 session；旧 session 保留其读取时点，owner 追加后新 read 得到新投影。原 owner corruption、unsupported version、storage unavailable 都拒绝，不能把 recovery placeholder 当空知识库使用。恢复继续由原 repository 的显式确认、原始字节备份与 reload 流程执行。

本轮没有必须新建持久化的 native extraction，所以不增加 browser store、SQLite migration 或 Local Core port。泛型读合同与 read repository interface 为未来 owner 保留同一 seam，但不授予新 owner 写权限。应用路由、生产接线、数据库与架构持久化边界没有变化，因此不机械修改 `docs/architecture.md` 或战略路线。

## 初始交付验收（2026-09-20，b5b548a 时点）

| 验收 | 可重放证据 |
| --- | --- |
| 1–3 稳定 L0/L1 与完整反查 | metadata/contentRef、viewpoint/relationship、traceSource/traceExtraction 精确 owner equality |
| 4 原 owner revision 后投影变化 | owner append → 新 read；旧 session 与旧 ID 不变；只保留一个原 storage key |
| 5 unknown 时间 | published/effective null；页面时间原文保留；approval/capture 不作为回退 |
| 6 knowledge As-of | 独立 capture/record/observation/approval cutoff、future event publication、topic/revision/trace 防泄漏 |
| 7 draft/rejected | 默认 draft；不进入 reviewed Current View；schema 要求 review 的 owner ref/time |
| 8 missing/invalid ref | 错误 domain/version/ID、missing Source/Creator/Topic/Event 和损坏 envelope 拒绝 |
| 9 revision/supersede | forks、cycles、duplicates、duplicate approval、不可见 predecessor 均拒绝 |
| 10 authority | AI contract 保留 ai_draft；review 不变 Provider Fact/Claim/Thesis；Creator 拒绝身份/语义/审批/pin 伪造 |
| 11 duplicate/conflict/import/reload | duplicate import 为零新增；同 ID 不同内容冲突拒绝；export/reload trace 一致 |
| 12 Creator regression | 原 chronology/Current View/T+ review 与 corruption recovery 测试全量通过；新增比较与确认恢复测试 |
| 13 全量门禁 | 下表；只使用 synthetic Creator/AI/Note fixtures |

| 命令 / 范围 | 结果 |
| --- | --- |
| 新 Source/Extraction domain + contract tests | PASS，36 + 13 = 49 tests |
| `npm test` | PASS，1052 tests / 82 files；包含原 Creator 113 项 |
| `npm run build` | PASS，TypeScript、Local Core typecheck、Vite、browser boundary（0 forbidden）、bundle gate |
| `npm run contracts:validate` | PASS，原 V1 + foundations + 新 common/profile 共 18 definitions |
| `npm run test:contracts` | PASS，106 V1 + 78 foundations + 13 新合同测试 |
| `npm run test:research-eval` | PASS，原 F3 Harness / Industry suites |
| `npm run research:eval:check` | PASS，committed report read-only replay；Industry 5/5 |

F3 Frozen V1 不改 roster/digests/expected：reference 33/33（REFERENCE_ONLY），actual service 0/33；本轮新 domain tests 不计入该服务覆盖率。无真实 LLM、Provider refresh 或外网数据依赖。

WARN：build 报告 >500 kB chunk 提示；全量测试有既有 jsdom `window.scrollTo` 未实现输出，测试仍全部通过。未降低检查阈值或修改这些相邻模块。Hosted CI NOT_RUN；独立审计 PENDING；没有生产准入或 strict PIT 提升。

真实限制：当前正式 adapter 仅 Creator；AI/native/其他 source 只有公共合同表达与 synthetic contract tests，尚无真实 ingestion/store/runtime。SourceRef 是 owner 引用而非 F2 retained-byte pin；不能把它当作历史发表证明、releaseAvailableAt 或 graph closure。Slice 2–6 未实现。

## P1 作者归因修复与针对性复审（2026-09-20 CURRENT）

审计发现 `authorIdentity=other` 的 draft/rejected 评论仍被投影为 Creator 作者。本次仅修复该误归因，不新增作者 registry、不猜测第三方身份，不改变原 CreatorSource/Observation/Approval、存储、时间或 revision 真源。

| owner identity | L0 actual author | L1 actual author | tracked Creator context |
| --- | --- | --- | --- |
| verified_self / unverified | 原 Creator ref | 原 external_creator / Creator ref，原 author.creatorId 保留 | provenance.creatorId / creatorContext.creatorId |
| other | null | unknown / null ref，identity=other；不带 author.creatorId | provenance.creatorId / creatorContext.creatorId |

types 使用判别联合；common/profile schema 用 identity 条件约束作者组合，不允许 `other` 携带 Creator 或猜测的第三方 ref，也不允许 other + reviewed。原 owner validator 继续首先拒绝 other + reviewed。schema-valid 的整体身份伪造（other 改标 unverified，同时伪造 Creator ref）仍由 owner-equivalence validation 拒绝。`trace*.creator` 返回 tracked context，actual identity 继续从原 Source 与投影 author 读取。

这是待审 V1 read model 的定向修正，不迁移持久化 owner。旧 serialized projection 须从原 owner 重建并重新校验；不能继续信任旧错误归因。原 self/unverified 作者字段、As-of、source parent、unknown 时间、精确 trace 和 revision/supersedes 保留。

| 本轮验证 | 结果 |
| --- | --- |
| 受影响 Source/Extraction + Creator domain/chronology/repository | PASS，144 tests；新增 6 个参数化/组合验收项 |
| Source/Extraction domain + contract | PASS，36 + 19 = 55 tests；包括两份 schema、身份伪造/错误 ref 与 owner equivalence |
| 全量 `npm test` | PASS，1058 tests / 82 files |
| `npm run build` | PASS，TypeScript / Local Core typecheck / Vite / browser boundary / bundle gate |
| `npm run contracts:validate` / `npm run test:contracts` | PASS，106 V1 + 78 foundations + 19 新合同 tests |
| `npm run test:research-eval` / `npm run research:eval:check` | PASS，51 F3 tests、committed report read-only replay、Industry 5/5；Frozen V1 service coverage 仍 0/33 |

原 chunk 大小提示和 jsdom `window.scrollTo` 输出仍为非阻断 WARN。最终针对性复审已 PASS（P0=0 / P1=0）。Hosted CI NOT_RUN；当前仅允许进入 PR / exact-head Hosted CI 门禁，尚未 merge、未修改 main、未声明 Production admission。
