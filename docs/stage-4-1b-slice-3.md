# Stage 4.1B / Slice 3 — F3 Research Eval Harness V1 + closeout readiness

2026-09-17。基线：`origin/main @ 18dad3e72a9d827fb0e6aeb923bee5a4873b1054`，fetch 后精确核对；分支 `codex/stage-4-1b-f3-eval-harness-closeout`。

**IMPLEMENTED / VERIFIED（本地） / PENDING INDEPENDENT REVIEW。** Stage 4.1B 尚未 CLOSED；本轮不创建 PR、不 merge、不宣称 main CI。Production/data admission 没有提升。

## 真实边界与架构

实现前审计以 Frozen F3、现有 Stage F/G runtime、Expectation comparison、Inbox/Evidence/Chart read models 为事实源，得到四条独立路径：

```text
Frozen Golden V1 → suite/case digest + fixture pin preflight
                → Harness（持有 expected；不向 target 暴露）
                → 审核 target registry → execute({operation, request, input})
                → Actual Result schema → exact semantic diff → deterministic report

contract oracle: scripts/contracts/financial-research.mjs
                └→ referenceTarget → REFERENCE_ONLY；不计 actual service coverage

actual services: Stage F/G queryMacro / selectVintage / PBC canary / earnings comparison
                └→ 当前无兼容 Frozen V1 的 reviewed adapter → 33 NOT_IMPLEMENTED

product models: ResearchEvent/ReviewTask/WatchItem → researchInbox
                price/financial owner → chartAudit / Evidence Drawer / Product Shell
                └→ 展示与导航，不执行 F2 graph closure，不提供 F3 Result

future Stage 4.5 / 4.6 MCP / Agent adapter
                └→ 经审核注册后复用同一 Harness / Result / comparator
                   本轮未注册、未调用 LLM、未写业务数据
```

新增 `scripts/research-eval/` 为 Node-only eval infrastructure，无新业务 owner、Provider 或 persistence。`harness.mjs` 负责验证、执行与报告；`targets.mjs` 是静态审核注册表与 capability audit；`cli.mjs` 提供离线命令和 artifact 重放校验。

原 `retrieve`、`assessGraph`、`earnings`、`recompute` 四函数正文不变；仅在原 checker 内抽取 `executeReference({operation,input,request})` dispatch，`checkCase` 仍走原 schema / comparison。未复制 oracle，未将 synthetic arithmetic 移入生产 domain。`contracts:validate` / `test:contracts` 保持兼容。

## Actual target capability matrix

| Operation | Frozen cases | 已存在的真实 seam | Frozen V1 实际 adapter / 原因 |
| --- | ---: | --- | --- |
| `retrieve` | 14 | `market-regime-adapter.mjs:queryMacro`、V2 `createMacroRuntimeV2`、`selection.mjs:selectVintage` | NOT_IMPLEMENTED。正式 query 校验 owned binding/version 2；`fixture-macro` 不是 runtime owner。内部 selector 需要可信 admission/coverage/conflict/freshness/Evidence context，Harness 不能补造 |
| `assess_graph` | 9 | PBC `queryCanaryEvidence`；Inbox/Chart/Evidence read models | NOT_IMPLEMENTED。特定 native PBC canary 不等于通用 F2 immutable graph/revision 服务；通用 assessor 仍只有 contract oracle |
| `qualify_earnings` | 7 | `src/services/earningsExpectationComparisonProvider.ts:compareEarningsExpectation` | NOT_IMPLEMENTED。需要完整 Snapshot/Event、measurement key、实际值与 disclosure scope；Frozen bool summaries 与通用 Evidence/Fact pins 不能无损生成这些业务记录 |
| `recompute` | 3 | Stage F/G readiness 与 Market Regime owner 工具 | NOT_IMPLEMENTED。readiness 判门禁，不执行 `fixture-only.v1 / sum_divide_fixed_denominator`；synthetic 公式没有生产 owner |

只读能力探测：将 14 个 Frozen retrieve request 输入真实 V2 `queryMacro`，全部 blocked，保留 `BINDING_IDENTITY`、`ENTITY_REGISTRY_UNRESOLVED`、`ADMISSION_UNKNOWN` 等；这是 wire 不兼容证据，不计作 Golden service PASS 或 FAIL。没有补造 Entity、Evidence 或 admission 来消除这些阻断。

注册 reference target 1 个：`financial-research-contract-reference@1`；**reference 33/33 PASS，REFERENCE_ONLY**。真实 deterministic target 注册 **0** 个，**actual service PASS 0/33，NOT_IMPLEMENTED 33/33**，八类别和四 operation 的完整分母均保留。没有用空 service target 冒充真实能力。所有未实现 caseId/version 可查机器报告 `actualServiceCoverage.cases`，不合并 oracle 与 service 数字。

## Frozen V1 integrity

未修改 `contracts/financial-research/v1/` 中任何文件：suite、33 个 `caseId@version`、request/expected、case digest、fixture identity/version、retained fixture bytes 全部保留。

Manifest SHA-256：`d2b95cba7576174a576d4f7de19c0b168fc1e50accfae1f413929a84d4b63610`。沿用原 checker 的 exact roster / canonical case digest；启动时先验证全套，再验证每个 scenario fixture pin 和 input schema/kind，任何异常在执行 target 前阻断，不生成成功形态报告。报告逐 case 保留 digest 与 outer fixture pin 验证；场景故意包含的坏 Evidence pin 仍由 target 执行其原 fail-closed 语义，不能预先改好。

未发现需要修订 Frozen V1 的合同错误。本轮不发布新 case/suite 版本。

## Semantic comparison 与 false-green 防护

- `outcome / value / unit / exAnte / reproducible` exact；`selectedRefs / citationRefs / conditions` set equality。集合顺序不影响结果；缺失或新增项输出 `missing / unexpected`；scalar diff 输出 `expected / actual`。0 保留，null 不补 0。
- 先通过原 `shared.schema.json#/$defs/Result`；缺字段、未知 outcome、NaN/Infinity、重复集合项、数字字符串或额外 prose 字段均 INVALID_OUTPUT。解释、prompt、SQL 不属于 Result；不做措辞、key order 或相似度打分。
- `PASS / SEMANTIC_MISMATCH / NOT_IMPLEMENTED / EXECUTION_ERROR / INVALID_OUTPUT` 分开统计。unsupported 不执行 target；throw/rejected promise 不 fallback；非法输出不拿 expected 补字段；unknown/not_admitted/conflicted/missing_evidence 原样比较。
- Adapter 仅收到 detached、deep-frozen 的 operation/request/input；无 expected、caseId、category、rationale 或 fixtureRef。执行、比较、报告分层；不存在 caseId→expected matcher。
- 正式 `runResearchEval` 只认可静态 registry 中的对象身份。直接重标 reference、普通/async wrapper、bound reference、任意未注册 service/agent 都不能出具 capability report。低层 `evaluateRequest` 支持测试 double，不能将其返回的单项比较结果当作正式服务覆盖。
- 本地复核曾用 wrapper 复现接口漏洞，现已通过 registry admission 修正，并加入反例测试。这是本地实现复核，不是 push 后独立审计。

Adapter 是审核后的可信代码；Harness **不是执行任意 JavaScript 的安全 sandbox**。未来加入 target 必须审计其真实 service imports、输入投影、证据与副作用，更新 capability matrix 和 source-boundary tests；不能只给 oracle wrapper 添加 registry 条目。未来 agent adapter 仍须遵守同一 Result 和 exact comparison，不允许模型裁决 expected。

## Machine-readable report 与稳定命令

[eval-report.v1.json](stage-4-1b-slice-3/eval-report.v1.json) 包含 suite identity/version/integrity、target identity/version/kind、operation/category coverage、逐 case expected/actual/status/diff 与分类 counts；`goldenContractHealth` 与 `actualServiceCoverage` 是不同字段。Service coverage 每 case 使用固定 33 分母；没有 registered service 时逐项 NOT_IMPLEMENTED。

```sh
npm run research:eval                 # stdout JSON；默认不写文件
npm run research:eval:check           # 重放并校验 committed artifact
npm run test:research-eval            # 专项离线测试
node scripts/research-eval/cli.mjs --write  # 显式仅写上述 eval artifact
```

命令适合以后直接加入 PR/main CI，本轮未改 CI workflow。Mismatch/error/invalid 或 artifact drift 使 CLI exit 1；NOT_IMPLEMENTED 保留 coverage 缺口，不当 FAIL，也不当 PASS。preflight/registry/artifact 错误输出 BLOCKED error envelope、exit 1，不暴露异常堆栈/本机路径/secret。报告没有 timestamp/duration；case、target、集合与 coverage 顺序稳定。无新依赖，lockfile 不变。

默认离线且只读合同 fixtures/schema；不联网、不调用生产 Provider、不读个人金融记录、不访问 browser storage/Local Core、不执行 raw SQL、不改变准入。测试在禁用 network、child-process、filesystem writes、browser storage 的进程中重复执行默认 CLI，并验证输出逐字节一致。显式 `--write` 仅写 synthetic eval report，不是业务写入。

## 验证与 closeout readiness

完整结果见 [validation.json](stage-4-1b-slice-3/validation.json)。

| 验证 | 本地结果 |
| --- | --- |
| Harness focused | 45/45 PASS；冻结 roster/digest、scalar/set diff、0、错误、非法输出、状态保留、wrapper/expected/caseId 防伪、默认副作用隔离、artifact 重放 |
| F1/F2/F3 contracts | contracts:validate PASS；test:contracts 106 + 78 PASS（最终 checker 改动后复跑） |
| `npm test` | 60 files / 788 tests PASS；Slice 1 / Slice 2 全部保留 |
| `npm run test:discovery` | PASS；保留 60 suites，负向对照仍复现 3 个 nested checkout failures |
| 当前 CI 其余正式 gates | 30 项全部 exit 0，含上述 contract/local checks、Local Core、Provider、Market Regime、Stage F/G；详见 JSON 逐项结果 |
| `npm run data:audit -- --no-write` | exit 0；P0=0、errors=0；24 warnings（P1=10 / P2=14）、10 skipped、35 allowlisted |
| `npm run build` | TypeScript / Local Core typecheck / Vite / bundle gate PASS；既有 >500 kB chunk WARN 保留 |
| Slice 1 browser | 257 checks PASS，无 failures/pageErrors |
| Slice 2 browser | 1214 checks PASS，无 failures/pageErrors |
| 全站 UI browser | 144 route/profile/width combinations PASS；隔离、导航、三主题、storage、下载/数据请求、business chunk 检查保留 |
| `research:eval:check` / `git diff --check` | PASS |

Browser 重跑原三个脚本，使用当前 production build、已安装 Playwright + Edge、全新 synthetic context；未改 UI。原 browser scripts 中 baseline 是各 Slice 的历史基线，本次验证的实际基线以上方 Slice 3 SHA 与 validation source digests 为准。运行日志/截图在忽略目录 `data-cache/stage-4-1b-slice-3/`，本轮仅提交精简验证记录，不覆盖旧 Slice 报告。

| Stage 4.1B acceptance | 当前状态 |
| --- | --- |
| Research Inbox / What Changed | Slice 1 已合入 PR #50；本轮回归 PASS |
| Evidence Drawer | Slice 1 已合入；fail-closed 展示与原业务回路回归 PASS |
| Auditable Chart | Slice 2 已合入 PR #52；identity、缺失/冲突、PIT/admission 未证明边界回归 PASS |
| Product Shell | Slice 2 已合入；route/navigation/storage 回归 PASS |
| F3 Eval | Harness 实现且本地验证；Frozen V1 不变；reference 与 actual service 明确分离 |
| 跨域 P0 correctness/security | 本轮边界复核与正式 gates 未发现必须阻塞 Stage 4.2 的新增 P0；不是全系统安全认证 |
| Stage 4.1B closeout | **PENDING INDEPENDENT REVIEW**；最终关闭等待独立审计 → PR CI → merge → main CI |

Remaining：F3 wire 的四项 service adapter、通用 F2 runtime、真实 MCP/Agent 均未实现。Stage F/G normalization/PIT backtest 仍 0 READY / 23 BLOCKED，23 identity unresolved；PBC retained canary PASS 不提升 full graph/source admission；all-A NOT_ADMITTED。单 Provider、指标 coverage、PBC/CSRC/all-A admission、normalization/backtest 继续 parallel data track，不作为无限延长 Stage 4.1B 的理由。

本轮同步 CURRENT feature registry / execution plan；因新增 Node eval data flow，补充 architecture。未改战略 roadmap、Frozen contracts、业务 owner、UI、生产数据或准入。普通 commit/push 后停止，等待独立审计。
