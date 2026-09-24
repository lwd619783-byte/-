# Stage 4.5 — D0 Scope Freeze + Read-only OS Domain MCP V1

## P1 targeted fixes — 2026-09-24 CURRENT

**IMPLEMENTED / TARGETED FIX APPLIED / PENDING CHATGPT TARGETED RE-REVIEW**. Base: `cb970497da40e7d20cdc991a8c39168f62650ddd`; branch: `codex/stage-4-5-domain-mcp-readonly-v1`; fetched `origin/main`: `68698ae7548aeb46fe9dd95fd0fdfcb4f13d1e4e` (base ahead 3 / behind 0). This section supersedes the earlier delivery status below; historical D0, verification counts and changed-file inventory retain their original baseline meaning.

- **P1-A:** `DecisionSharePanel` renders the existing `DecisionPreview.snapshot` directly, without another preview model. Claim statement/status/gate/conditions/blockers, Thesis statement/status/risks/invalidation/blockers and scenarios, and Expression instrument/role/status/unknowns/blockers/context are reviewable before confirmation. Thesis and Expression use expandable sections. Every available Portfolio position displays account name/status, asset name, quantity, market value/currency, snapshot date, category/strategy bucket when present and blockers. Portfolio unavailable still says **不可读取，不含组合数据**, with no zero-position substitution. The panel identifies the private staging / ChatGPT destination and discloses retained audit references; no raw JSON/hash copying is required.
- **P1-B:** UI preview, publish acknowledgement and Domain OAuth consent now explicitly distinguish **24h access TTL** from a physical deletion SLA. Expiry/revoke rejects subsequent Domain reads; immutable private objects may remain stored, and physical deletion at 24 hours is not guaranteed. OAuth access-token lifetime remains one hour. No cleanup job, retention service or storage change is introduced.
- **OAuth tool `securitySchemes`: NOT_APPLIED.** Locked and installed `@modelcontextprotocol/sdk` is `1.30.0`. Its `dist/esm/server/mcp.d.ts` `registerTool` config and `dist/esm/types.js` `ToolSchema` do not declare tool-level `securitySchemes`; `dist/esm/server/mcp.js` registration and tools/list also do not forward it. Generic `_meta: Record<string, unknown>` is not a reliable typed security contract. No invented metadata, type bypass, SDK upgrade or auth change was applied. The official-client regression checks all eight existing names and all four read-only annotations.
- Existing owner/schema/F2/lineage, exact snapshot binding/digest/generation/CAS/asOf, 1 MiB limit, 15-minute publish freshness, current-generation-only access, `os:read`, Legacy isolation and localhost/Hosted Portfolio boundaries are unchanged. Stage 4.6 Agent remains NOT_IMPLEMENTED. No real private data was used or created.

### Targeted verification

| Check run for this fix | Result |
| --- | --- |
| `DecisionSharePanel.test.tsx` + `decisionSnapshot.test.ts` | 18 PASS (4 + 14); non-empty synthetic positions, actual research details/blockers, no publish before consent, exactly one after consent, unavailable remains explicit |
| Domain Node suite | 14 PASS; includes actual OAuth consent HTTP response |
| `npm run test:domain-mcp` | 14 Node + 33 Vitest PASS |
| `npm run test:bridge` | 31 PASS; Legacy unchanged |
| `npm run test:research-eval` | 65 Node + 57 Vitest PASS |
| `npm run contracts:validate` | PASS |
| `npm run build` | PASS; existing large-chunk advisory remains |
| `npm test -- --maxWorkers=1 --minWorkers=1` | 113 files / 1489 tests PASS (224.75s) |
| Isolated browser / official SDK / synthetic local HTTP | 33 PASS at 390 / 1440 widths; 0 page runtime errors; actual Portfolio fields, research details, TTL copy, explicit publish/revoke and owner drift |
| `git diff --check` | PASS |

The first browser attempt timed out waiting for the real-app home page, before any business assertions (0 checks, 0 page errors). An unchanged-script rerun passed all 33 checks; initial failure evidence was retained separately. This does not establish a root cause for that transient load timeout. Full synthetic Portfolio screenshots were inspected; no horizontal overflow at either viewport. Logs/screenshots are local ignored artifacts under `data-cache/stage-4-5/p1/`.

**NOT_RUN / NOT_VERIFIED this round:** real private-data publication, real ChatGPT account acceptance, Hosted PR CI, final-SHA Preview status, Production runtime verification, separate discovery/data-audit and Portfolio Node/Local Core suites (their historical results below are not new evidence). No PR, merge, main edit, Production configuration/deployment, force push or history rewrite is part of this fix. Delivery stops after ordinary commit/push on the same branch, awaiting ChatGPT targeted re-review.

Actual targeted changed files: `src/components/research/DecisionSharePanel.tsx`, its `.test.tsx`, `server/os-domain/http.mjs`, `scripts/tests/os-domain.node.mjs`, `scripts/domain-mcp-browser-check.mjs`, this document, and the minimal CURRENT entries in `docs/feature-registry.md`, `docs/development-execution-plan-2026-09-07.md`, `docs/current-development-direction-2026-09-13.md`. Runtime architecture is unchanged; `docs/architecture.md` needs no rewrite.

## D0 freeze — 2026-09-24

Base: `e6a148d8e345e89cfbe4920d803265108e1b3e4c`; fetched main: `68698ae7548aeb46fe9dd95fd0fdfcb4f13d1e4e`; docs base ahead 2 / behind 0. This additive contract does not modify formal-owner or Phase 1 permission semantics. Independent audit and production admission remain separate gates.

| Owner / capability | Reuse | Delta |
| --- | --- | --- |
| BrowserClaimRepository | load validation, claimReadModel, original F2 gate | bounded current Claim projection, exact revision/review/digest and citation refs |
| BrowserThesisRepository | load, thesisReadModel, exact original Claim resolution | current confirmed Thesis, risks/invalidation, support update blockers |
| BrowserExpressionRepository | load, expressionReadModel, exact Thesis/instrument resolution | current confirmed Expression, unknown context and upstream update semantics |
| Portfolio | fetchPortfolio localhost seam + validateProjection | optional validated read projection; unavailable is never an empty portfolio |
| Legacy server/research-bridge | OAuth code + S256, owner auth, PrivateBlobStore CAS, SDK transport | reusable parameterized auth; independent Domain audience/issuer/scope, namespace and routing |
| F1 / F2 / F3 | F1 refs, original F2 decisions, existing evaluateRequest harness | bounded Domain tool-use cases in test:research-eval; no Agent runtime |

## Frozen transport contract

Formal local owners → validated canonical `decision-snapshot.v1` → explicit preview/confirmation → private temporary staging → authenticated read-only OS Domain MCP → ChatGPT.

Notion = Research Memory; OS = Formal Decision System. Legacy Bridge = compatibility/fallback, not expanded. Stage 4.5 Slice 1 = READ-ONLY. Stage 4.6 Agent remains NOT_IMPLEMENTED.

The executable additive contract is `shared/decision-snapshot.mjs`. It strictly allowlists bounded fields, preserves original IDs/revisions/asOf, review/confirmation IDs, revision digests, authority, gate/citation/lineage, missing/partial/stale/conflicted/blocked semantics. No Wiki/Drive body, raw storage, canonical formal-owner bytes, arbitrary files or ledger DB may be transported. Claim list only returns VERIFIED rows with a passing gate; blocked formal rows remain visible through summary/exact detail. Confirmed Thesis/Expression retain upstream update warnings without rewriting history. Snapshot is a user-published local projection, never remotely revalidated live authority or proof of cryptographic authenticity of local decisions.

V1 reads only the current published generation at exactly its asOf; it cannot answer arbitrary historical PIT questions. At most 200 records per Claim/Thesis/Expression domain, 1 MiB canonical snapshot, 20 rows per list response, 24-hour access TTL, and 15-minute maximum age at publication. A fresh explicit publication replaces the pointer using CAS; concurrent publish/revoke fails closed. All reads recheck generation/digest/expiry/revoke after reading immutable content. TTL limits access, not a promise of physical Blob deletion. Remote staging never becomes authority.

Domain scope is exclusively `os:read`, resource `/api/os-mcp`, issuer `/os-domain`, OAuth endpoints `/api/os-domain/authorize` and `/api/os-domain/token`, namespace `os-domain/`. Shared server credentials remain server-only; browser owner credential is transient and never persisted. Domain startup is separately gated by `OS_DOMAIN_ENABLED=true`; existing Bridge configuration supplies the shared security primitives. No production configuration changes are part of this work.

Tools: `decision_summary`, `list_verified_claims`, `get_claim`, `list_theses`, `get_thesis`, `list_expressions`, `get_expression`, `portfolio_exposure`. List/detail calls bind snapshot ID, digest, generation and exact asOf obtained from summary. Details require exact ID and revision. No writes or generic query tools.

## Delivery verification

IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT AUDIT. Synthetic tests establish local contract capability only. Real private-data publication, real ChatGPT account acceptance, PR, merge and Production are NOT_RUN. Hosted CI was not requested or verified.

## Runtime and authority details

- `shared/decision-snapshot.mjs` is the strict versioned projection contract; `scripts/contracts/decision-snapshot.mjs` joins `contracts:validate`. Existing formal schemas, revisions, confirmations, permissions and frozen F1/F2 cases are unchanged.
- `src/services/decisionSnapshot.ts` reads the three original repositories and their original gates. It exports selected semantic fields and SHA-256 revision pins, not `revisionBytes`, `reviewBytes`, contexts or Wiki content. Exact cited historical refs remain refs; a current-only detail request for a non-current revision rejects rather than inventing a historical snapshot. Claim updates propagate stale warnings through Thesis and Expression without invalidating historical pins.
- `decisionPublish.ts` binds the preview in memory, rechecks original-owner content and gates plus the Portfolio projection at confirmation, then sends only the validated snapshot. Unbound/copied/mutated previews, changed owners, stale payloads and generation drift reject. Scope is fixed by the runtime, with synthetic publication accepted only by explicitly injected test instances; deployed handler uses `real`.
- HTTP/OAuth plumbing is shared in `server/shared/read-only-http.mjs`; Legacy `server/research-bridge/http.mjs` retains its existing owner operations and tools. New `server/os-domain/` has no Legacy tool registration or Wiki read path. OAuth codes/consents are also namespace-separated. Resource discovery precedes the old wildcard rewrite. No raw SDK diagnostic, private Blob URL or credential is returned.
- `os:read` is a transport grant for the explicitly published snapshot, corresponding to the existing `research.read` and, when included and expressly previewed, the bounded `assets.read` projection. It grants neither the full asset ledger nor transactions/cashflows, and creates no new business write permission. Domain OAuth does not accept `research:read` tokens or write scopes; Domain bearer tokens cannot call owner publish/revoke endpoints.
- A revocation CAS invalidates the current pointer and increments its generation. Every data tool rechecks the pointer after reading content. Expiry/revoke/digest drift/generation changes reject summary as well as detail/list/Portfolio calls. Explicit fresh publication can create a later generation. Revocation cannot retract content already delivered to ChatGPT; it blocks subsequent reads.

## Minimal UI and local Portfolio route

Entry: **设置与帮助 → 共享当前正式投资状态给 ChatGPT**. Enter the existing shared owner credential (memory only), generate/validate preview, review included domains/records, explicitly confirm, or revoke. No JSON/IDs/hash copying. The lazy panel does not modify the main research UI or formal owners. Revoke is independent of local owner/provider availability.

Hosted UI can publish browser-owned decisions but cannot read localhost assets. On localhost, `fetchPortfolio` uses the existing `PORTFOLIO_LOCAL_DB` opt-in read seam and `validateProjection`; only a successful same-asOf/same-scope read is included. Projection contains recorded positions, cohort exposures and original audit lineage, not ledger DB, target/rebalance plans or broker data. Existing research links/planning revisions are not copied into this V1 snapshot. Missing, denied or corrupt Portfolio yields unavailable with explicit reason and no fabricated zero/empty portfolio.

For an eventual approved environment, server `OS_DOMAIN_ENABLED=true` independently enables the Domain handler; shared `BRIDGE_ORIGIN`, `BRIDGE_OWNER_SECRET`, `BRIDGE_SIGNING_SECRET`, `BRIDGE_OAUTH_CLIENT_ID`, `BRIDGE_OAUTH_REDIRECT_URIS` and private Blob configuration retain their existing meanings. `BRIDGE_ENABLED` does not enable Domain, and Domain does not enable Legacy. Local development may set **process environment** `OS_DOMAIN_REMOTE_ORIGIN` to the fixed HTTPS staging origin. `scripts/os-domain-seam.mjs` relays only status/publish/revoke from loopback and same-origin requests; arbitrary URLs, MCP queries, external origins and local files are rejected. It forwards the user's transient owner header, never reads server secrets into the browser. This branch changes source routing only; no remote configuration/secrets have been changed.

## F3 integration and limitations

The 15 additive tool-use cases use existing `evaluateRequest` plus the official MCP SDK client/server transport. They cover exact Claim/Thesis/Expression chains, unavailable Portfolio, blocked Claim, schema corruption/future versions, mutation/digest/generation drift, expiry/revoke, arbitrary asOf, Wiki and writes. The Domain Node security suite is also included in `test:research-eval`. This is deterministic service coverage, not Agent execution; Foundation and prior F3 expected cases are untouched.

Real ledger reads, private cloud publication and real ChatGPT account acceptance were not exercised. Positive financial/research content is synthetic, created through the original formal-owner confirmation services. The real application browser check used an isolated empty profile. No real Verified Claim/Thesis/Expression/holding was created. Domain is disabled until separately configured and deployed after audit; current local test PASS is not Production admission.

Browser diagnostics retained the initial navigation timeouts. The cause was Vite dependency crawling withholding React responses; the isolated check sets bounded entries and `holdUntilCrawlEnd: false`. It does not weaken business assertions or timeouts. Final check: 17 assertions, mobile 390 / desktop 1440, 0 page runtime errors; real HTTP handler + official SDK read after UI publish and rejection after UI revoke. No new browser/package dependency was installed.

## Verification matrix (2026-09-24)

| Check | Result |
| --- | --- |
| Domain Node auth/store/HTTP/official SDK/loopback relay | 13 PASS |
| Decision snapshot + F3 tool-use + UI unit | 31 PASS (14 + 15 + 2) |
| Legacy `npm run test:bridge` | 31 PASS |
| Claim / Thesis / Expression / Portfolio focused | 108 PASS |
| `npm run test:portfolio` | 7 Local Core + 44 Node + 51 Vitest PASS |
| `npm run test:research-eval` | 64 Node + 57 Vitest PASS |
| `npm test -- --maxWorkers=1 --minWorkers=1` | 113 files / 1487 tests PASS |
| `npm run test:discovery` | PASS; 113 formal suite paths; nested-copy control reproduces 3 failures |
| `npm run contracts:validate` | PASS including additive Decision Snapshot contract |
| `npm run build` | PASS; full browser graph has no Node-only module |
| `node scripts/data-audit.mjs --no-write` | PASS; 0 errors / 42 warnings (P1 20, P2 22), no data writes |
| isolated browser | 17 PASS / 0 runtime errors |
| `git diff --check` | PASS |
| Private real-data / ChatGPT account / PR / merge / Production | NOT_RUN |
| Hosted CI | NOT_REQUESTED / NOT_VERIFIED |


The full Vitest run reports JSDOM `window.scrollTo` not-implemented diagnostics in existing UI tests; these are not browser runtime errors or failed tests. Build retains its large-chunk advisory. Data-audit warnings remain explicit; no admission or data repair is inferred.

## Changed files

This Stage 4.5 delta changes 39 files from the requested docs base; the complete prospective diff against main changes 42 files, including the previously confirmed docs branch.

```text
api/os-domain.mjs
api/os-mcp.mjs
docs/architecture.md
docs/current-development-direction-2026-09-13.md
docs/development-execution-plan-2026-09-07.md
docs/feature-registry.md
docs/stage-4-5-domain-mcp-readonly-v1.md
package.json
scripts/contracts/decision-snapshot.mjs
scripts/domain-mcp-browser-check.mjs
scripts/os-domain-seam.mjs
scripts/tests/os-domain.fixture.d.mts
scripts/tests/os-domain.fixture.mjs
scripts/tests/os-domain.node.mjs
scripts/tests/test-discovery.node.mjs
server/os-domain/config.mjs
server/os-domain/http.mjs
server/os-domain/mcp.d.mts
server/os-domain/mcp.mjs
server/os-domain/staging.d.mts
server/os-domain/staging.mjs
server/os-domain/tools.d.mts
server/os-domain/tools.mjs
server/research-bridge/auth.mjs
server/research-bridge/http.mjs
server/shared/read-only-http.mjs
shared/decision-snapshot.d.mts
shared/decision-snapshot.mjs
src/App.tsx
src/components/research/DecisionSharePanel.test.tsx
src/components/research/DecisionSharePanel.tsx
src/services/decisionPublish.ts
src/services/decisionSnapshot.eval.test.ts
src/services/decisionSnapshot.fixture.ts
src/services/decisionSnapshot.test.ts
src/services/decisionSnapshot.ts
vercel.json
vite.config.js
vite.config.ts
```
