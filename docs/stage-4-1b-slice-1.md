# Stage 4.1B / Slice 1 — Research Inbox + Evidence Drawer V1

基线：`origin/main @ 2829776f8ef4b7bcbf744c8edb37410bbd6ec67a`。分支：`codex/stage-4-1b-research-inbox-evidence-v1`。

## 能力与事实归属

首页先展示 Research Inbox，再展示概览指标和价格脉络。用户可完成：

`首页 → 待处理任务 / 近期事件 → Evidence Drawer → 精确公司 / 精确事件 / 已有复盘表单 → 提交复盘`

- `researchInbox.ts` 只接收已有 `ResearchEvent[]`、`ReviewTask[]`、`WatchItem[]`、显式时钟和工作流时区，返回临时引用投影；不生成业务任务、不读写存储、不调用 Provider。
- `App` 继续拥有聚合接线：Expectation owner → 原比较 / 事件生成服务 → ResearchEvent；原 `buildReviewTasks` → ReviewTask。沿用 `useDisplayNow` 的分钟时钟，保证跨日日期、到期/暂缓任务和首页展示共同更新。
- `ResearchInbox` 持有的只是日期范围、显示条数和选中事项 ID。任务按现有 WatchItem 汇总；抽屉与公司/事件导航只读，开始复盘复用 `startReview`、`ReviewFormModal`、`WatchlistStore.completeReview`。
- `ResearchEventCenter` 原 EventCard、qualification、metrics、status badge 抽为 `ResearchEventEvidence`，验证中心与抽屉共用；保留原数值格式、缺失及零值。没有复制 Event Detail 页面。
- 预期原始数值仅在 owner 快照 ID 与事件 payload 的 `snapshotId`、公司 ID 精确一致且唯一时展示，保留币种、单位、期间与会计口径。没有唯一快照时不借用相邻版本或其他公司记录。

## Deterministic projection V1

输入为原 owner 已归一化、每个 ID 唯一的当前记录；重复同一事件/任务 ID 不增加展示条数。该投影不承担 owner revision 冲突仲裁。

1. 待处理任务以 `watchItemId` 分组，保留全部任务 ID、原因和关联事件 ID。关联必须同时匹配 event ID 与 watch 的 stock ID；缺失/错公司引用显式列出。孤立任务不猜公司；归档观察项不产生待办入口。
2. 所有关联任务的事件不另列独立 Inbox 事项，包括 acknowledged / dismissed / snoozed 任务，避免把已处理提醒重新包装为高优先事件。任务结束后是否仍出现独立事件，服从当前 owner 的事件状态和日期范围；Inbox 不改写事件历史。
3. 任务组依次：任一有效 `dueAt` 早于今天、最早 `dueAt` 等于今天、其他 pending。每组按原 severity 枚举顺序 high → medium → low、最早任务日期升序、稳定 ID 的字符顺序排序。组内任务也按 severity、日期、ID 排序。这里的“任务日期”沿用 owner `dueAt`，事件触发任务的日期不被宣称为额外业务期限。
4. 未合并事件按 reviewStatus=pending 优先，再按原 materiality 的 high → medium → low → unknown、事件日降序、稳定 ID 排序。只有枚举排序位置，没有 0–100 分数、LLM 排名或投资结论。
5. 左栏只列已有 pending 任务组；右栏列未合并事件，默认近 30 个日历日（含今天），可展开全部日期。历史、未来或未知日期不静默消失，显示窗口外记录数。
6. 事件日取 `eventOccurredAt`、`eventBusinessDate`、`eventDate` 的原字段，严格日期解析。不会用 publishedAt / updatedAt / detectedAt / recordedAt 把旧事件变成新事件。日期字段不补精确时间。财务摘要日期可能是报告期，界面明确说明。
7. 初始最多 6 个任务组、4 个事件，继续显示可逐步展开；分母始终是当前完整投影/筛选结果，不用可见行数冒充全部记录。

## Evidence Drawer V1 的证明边界

展示 source、可安全打开的 owner HTTP(S) URL/PDF、原事件/发布时间字段、更新/检测/记录时间、parse/verification、原 metrics、关联公告/期间与原快照/版本引用。

- 非 HTTP(S)、无效或含凭据的 URL 不生成链接；不猜 URL，不通过 URL 推断来源真伪。
- parse_success 不覆盖 partial / stale / missing / error / unknown；缺失数值额外提示。content_conflict 与其他限制继续以原 reviewReasons 展示。
- 预期来源核验、既有服务的事前资格与数值可比性分别展示。原始时间不能补成有效时间；仅有 ingestionMethod=provider 不证明特定官方来源。
- 原 `financialSummaryToResearchEvent` 可能将报告期写到 eventDate、采集时间写到 publishedAt。本切片保留 owner，不把字段名当成公开可得性证明；抽屉注明其限制。
- 当前接入链没有正式的 releaseAvailableAt、PIT、admission、revision continuity 或 F2 graph proof。这些项为“未提供 / 未证明（unknown）”；不把链接、checksum 或关联引用当成原文留存、完整 lineage 或 production admission。
- 本轮专项测试补充 F3 所关注的 deterministic retrieval、quality propagation、unsupported proof 与 earnings evidence 情景，但**没有改动冻结的 33-case F3 V1 roster、case version 或 expected output**，不宣称新增 F3 runtime/service harness。

## 范围之外

没有新 Provider、Market Regime 数据、Claim/Thesis、F2 runtime、正式评分、Auditable Chart、DB migration、Bridge 或新持久化 owner。Chart / F3 harness 留待后续 Slice。三主题、原 Modal focus trap/Escape/焦点恢复、响应式、reduced-motion 保留。

## 本地验证与审计交付

状态：**IMPLEMENTED / VERIFIED（本地） / PENDING INDEPENDENT REVIEW**。

| 检查 | 实际结果 |
| --- | --- |
| focused tests | 10 files / 68 tests PASS（projection、Inbox/Drawer、Home、验证中心、Watchlist、navigation、ui-review） |
| `npm test` | 58 files / 755 tests PASS；相对基线新增 30 tests |
| `npm run test:discovery` | PASS；保留 58 个正式 suite，负向对照仍能重现嵌套 checkout discovery 故障 |
| `npm run data:audit -- --no-write` | exit 0；P0=0、errors=0；24 warnings（P1=10 / P2=14）、10 skipped、35 allowlisted |
| `npm run build` | PASS；TypeScript / Local Core typecheck / Vite / financial bundle gate 通过；保留 >500 kB chunk WARN，不修改门槛 |
| `npm run ui:audit` | PASS（静态扫描，无高风险 legacy color 命中）；仅时间戳生成 diff 已恢复，不回写历史报告 |
| Slice 1 browser | 257 checks PASS；1536/1280/390/320 × full/empty/degraded × neon/pro/light；reduced-motion、焦点、精确导航、缺证据、复盘提交及刷新后状态 |
| Existing UI browser regression | 144 route/profile/width combinations PASS；继续保留隔离、三主题 geometry、company tabs/scroll/navigation checks |
| `git diff --check` | PASS |

测试均为本地验证，未执行新的 Provider refresh，不表示正式数据或 production admission。浏览器使用已安装 Playwright + Edge；未安装 CLI/依赖。原 F3 V1 suite 与 contracts、Provider、Store、repository、package/lockfile 均无业务修改。

代表截图：[桌面 Inbox](stage-4-1b-slice-1/home-1536-full-neon.png)、[手机 Inbox](stage-4-1b-slice-1/home-390-full-neon.png)、[手机退化证据](stage-4-1b-slice-1/drawer-390-degraded-light.png)、[空状态](stage-4-1b-slice-1/home-1536-empty-pro.png)。

验证结果与代表截图见 [browser validation](stage-4-1b-slice-1/browser-validation.json)。完整本地截图与逐项报告由 `scripts/research-inbox-browser-check.mjs` 生成到忽略目录 `data-cache/stage-4-1b/browser/`；远端保留精简记录与合成样例截图，不包含真实个人金融记录。

旧 `ui-review-browser-check.mjs` 的首页检查同步为 Inbox 在价格图之前、首批任务/事件行数受限、空状态无生成事项。原先已移除的独立事件卡 `.home-events` 及其与价格卡同高要求不再适用；其余全站隔离、主题、响应式、导航和滚动检查保留。

停止点：普通 commit + push 后等待独立审计；本切片不创建 PR、不 merge、不声明 MAIN CI PASS / production admission。上述固定基线为本次交付的比较起点，不是永久 CURRENT main。

## 变更文件索引

- 只读投影：`src/services/researchInbox.ts`。
- 首页与接线：`src/App.tsx`、`src/components/home/HomePage.tsx`、`src/components/home/ResearchInbox.tsx`、`src/ui-review/UiReviewApp.tsx`、`src/index.css`。
- 共享证据：`src/components/research/ResearchEventEvidence.tsx`、`EvidenceDrawer.tsx`、`ResearchEventCenter.tsx`。
- 测试：`src/services/researchInbox.test.ts`、`src/components/home/HomePage.test.tsx`、`ResearchInbox.test.tsx`、`src/components/research/EvidenceDrawer.test.tsx`、`ResearchEventCenter.ui-v1.test.tsx`。
- 浏览器：`scripts/research-inbox-browser-check.mjs`、`scripts/ui-review-browser-check.mjs`。
- 文档：`docs/feature-registry.md`、`docs/development-execution-plan-2026-09-07.md`、`docs/architecture.md`、本文；同名子目录内 `browser-validation.json` 与上述 4 张 PNG。
