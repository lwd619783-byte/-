# Stage 4.2 / Slice 4 — Cross-source Industry Provider Proof

Status: **D0 GO / IMPLEMENTED / VERIFIED LOCALLY / PENDING INDEPENDENT REVIEW**

Date: 2026-09-18. Base fetched and verified before implementation: `2f2d707b8b222392a969327f10f9d5af5f021eab`.
Branch: `codex/stage-4-2-slice-4-cross-source-industry-provider`.
Delivery: ordinary commit/push only; stop for independent audit. No PR or merge. Hosted CI **NOT_RUN** (the existing workflow triggers only PR/main push); local checks are not Hosted CI certification.

## D0 official-source discovery — GO

No EIA key was present in the process credential environment. No credential was invented or copied from another service. The official credential-free history/file path succeeded:

| Identity | Verified official fact |
| --- | --- |
| Family | U.S. Energy Information Administration, Petroleum / Weekly Supply Estimates / Stocks |
| Exact series | `WCESTUS1`; history route `n=PET&s=WCESTUS1&f=W` |
| Official title | Weekly U.S. Ending Stocks excluding SPR of Crude Oil (Thousand Barrels) |
| Dimension | Inventory: commercial crude-oil ending stocks, excluding SPR and lease stock; not exports/flow or oil-shipping demand |
| Geography / frequency / unit | U.S. / Weekly (`W`) / `Thousand Barrels` |
| Runtime owner | `US_EIA_COMMERCIAL_CRUDE_STOCKS`, existing industry `oil-shipping` |
| History | [EIA official history HTML](https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=WCESTUS1&f=W) |
| Download | [Official XLS linked by that history page](https://www.eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls) |

Local acquisition returned HTTP 200 with unchanged final URLs. The retained HTML title, XLS link, weekly headers, year/month rows and end dates prove the exact series/frequency/unit; referring-page labels identify commercial stock excluding lease stock. D0 repeated offline extraction of the chosen 11-week window produced identical output (diagnostic JSON SHA-256 `66853e552e68a228b97bf171e8eb599289fc98d355263fda1b649f33b3244946`). The production replay has stronger structural/identity/date/duplicate/missing-value checks.

Also investigated the [official bulk downloads index](https://www.eia.gov/opendata/index.php#bulk-downloads) and [bulk manifest](https://www.eia.gov/opendata/bulk/manifest.txt), which were accessible. Bulk archive ingestion and API v2 were unnecessary for this bounded owner; no API route/series mapping is claimed beyond the verified history identity.

## Retained evidence and time boundaries

`research-data/industry/eia-petroleum-v1/manifest.json` pins two complete raw files, with URL/finalURL, byte length, SHA-256, role and acquisition instant:

| Role | Bytes | SHA-256 | Acquired UTC |
| --- | ---: | --- | --- |
| HTML, deterministic numeric replay input | 243405 | `3ef8db67185f696b7d7188291e39309d4c6feac3a97aa360c4c5e99f862d4fb6` | 2026-09-18T08:09:31.308439Z |
| Linked XLS, retained download corroboration only | 130048 | `4a06fba1d17db3a9626413dbe623b6721526bcdb3e589a19207a5c5e8d23cd04` | 2026-09-18T08:10:07.731459Z |

Raw files remain byte-exact (`-text -diff`). JSON pins use the existing LF attributes. XLS is not parsed into or used to manufacture the normalized readings.

Declared normalized window: **2026-07-03 → 2026-09-11, 11/11 weekly slots**, first 411357, last 423429 Thousand Barrels. Full HTML history is retained, but only this explicit window is normalized. `historicalCoverage=partial`; 11/11 does not mean complete history, historical vintages or admission. Null/withheld values remain null; absent weeks remain gaps with the original fixed denominator. The inventory reference period is its week-ending stock date (start=end), not a flow accumulation interval.

The current history page says release date 2026-09-16. This date-only snapshot label is retained in the reviewed source metadata and checked against raw bytes. It does not prove each historical observation's publication instant or availability of these exact bytes. All observations keep `publicationDateTime=null`, `releaseAvailableAt=null`, `revision.status=unknown`, `pit=UNPROVED`; acquisition/generation clocks stay separate. No revisions are selected by acquisition time. Source EvidenceRefs remain `candidate`.

## Source Adapter seam and reuse

`scripts/industry/source-adapters.mjs` defines version **`industry-source-adapters.v1`** and two code-owned entries:

- `nbs-industrial-production-html.v1`: original reviewed output and official-YoY owners, original parser and exact replay.
- `eia-petroleum-history-html.v1`: reviewed EIA inventory owner and `eia-parser.mjs` / `eia-artifact.mjs`.

Dispatch accepts the exact registered adapter ID, matching metric/industry identity, owner plan/artifact/binding/policy paths and reviewed plan hash. Unknown adapter, wrong owner, foreign path or changed plan hash fails closed. There is no arbitrary plugin execution, dynamic import, source fallback, or owner inferred from industry. Registry validation dispatches replay for **every** Registry entry instead of replaying a hard-coded NBS owner list.

`metric-artifact.mjs` extracts the unchanged generic V1 structural schema and existing F1 binding constructor. The NBS module keeps compatibility exports for existing consumers. EIA does not import the NBS builder. The generic Registry/schema/pin/Entity/Evidence vocabulary is reused without a second registry or contract version fork.

The runtime historical projection now distinguishes registered `monthly`/`year_to_date` and `weekly`/`week_ending` periods. It checks exact owner/source/unit/frequency/reference period, preserves zeros and gaps, and suppresses conflicted values and coverage. Unsupported frequencies do not receive monthly proxy points. `Thousand Barrels` passes through unchanged; there is no oil-shipping-specific runtime branch. Inventory delta is explicitly `none` in the Registry. The two NBS owners retain their original absolute difference / official YoY semantics.

Reproduction (offline except explicit acquisition):

```sh
npm run data:validate:industry
npm run test:industry
node scripts/industry/source-adapters.mjs --metric US_EIA_COMMERCIAL_CRUDE_STOCKS
# Optional explicit rebuild; Registry pins intentionally require review after any byte changes:
npm run data:build:industry -- --metric US_EIA_COMMERCIAL_CRUDE_STOCKS
# Optional future official acquisition, NEW directory only; does not change registered owners:
python scripts/industry/fetch_eia.py --capture-name eia-petroleum-new-reviewed-capture
```

## Signal / Event / Inbox / product proof

The existing pipeline produces **1 EIA Signal / 1 EIA Change Event / 1 weekly inventory reading**, alongside unchanged **2 NBS Signals / 1 NBS Event**. Inputs retain original observations and definition/artifact/binding/policy pins, source hashes and candidate Evidence. Conflicting copies retain evidence and suppress readings. No new event store, task owner, formal ResearchEvent/Evidence/Entity record, or business write is introduced.

EIA's unknown publication date stays unknown in Inbox. The existing default near-30-day filter excludes it; **全部日期（含未知）** shows exactly one EIA card and one NBS card. It opens the existing EvidenceDrawer and exact `oil-shipping` industry route. No observation/fetch date is substituted to force inclusion in the recent bucket.

The original Industry page discovers the EIA owner, renders its 11-point auditable history/table and shows source Evidence without a UI redesign. Weekly event titles use full week-ending dates, avoiding monthly/NaN labels. No prosperity, regime, bullish/bearish, demand or investment conclusion is generated. Non-target industries remain unavailable.

## Validation

| Gate | Result |
| --- | --- |
| `test:industry` | PASS: 8 Python freshness + 32 Node replay/Registry/adapter + 73 Vitest tests |
| `data:validate:industry` | PASS: all 3 owners, 2 families; exact replay/schema/F1 binding |
| After generic binding extraction | 32 Node tests and 3-owner replay re-run PASS |
| Full `npm test` | **865/865**, 71 files PASS |
| `npm run build` | PASS: TS, Local Core typecheck, Vite, bundle budget checks |
| `npm run data:audit` | PASS exit 0; **0 errors / 0 P0**, 28 nonblocking warnings (14 P1, 14 P2) |
| Contracts / F3 | `contracts:validate`, `test:contracts`, `test:research-eval`, `research:eval:check` PASS |
| Local Core / semantic / PBC gates | `test:local-core`, `data:validate:semantic-bindings`, `test:semantic-runtime`, `data:validate:semantic-readiness`, `test:stage-4-1-g`, `data:validate:pbc-evidence-v2`, `data:validate:semantic-readiness:v2` PASS |
| Test discovery | `test:discovery` PASS |
| EIA actual browser | **169 checks PASS**, 3 themes × 1536/390/320px, chart/table/Evidence/focus/Inbox/deep link/no external acquisition or downloads |
| NBS actual browser | **277 checks PASS**, both owners × same theme/viewport matrix; existing favicon 404 warning only |
| NBS retained bytes and semantics | No diff to original raw/manifest, 2 plans, 2 generated artifacts, 2 bindings; original 13 observations each and 6/8 monthly coverage retained |
| Hosted CI / independent audit | **NOT_RUN / PENDING**, no PR/main push authorized |

Committed browser reports: [EIA](stage-4-2-slice-4/eia-browser.json), [NBS](stage-4-2-slice-4/nbs-browser.json). Screenshots: [desktop](stage-4-2-slice-4/neon-1536.png), [390px](stage-4-2-slice-4/light-390.png), [320px](stage-4-2-slice-4/pro-320.png). Reproduce with `scripts/industry-cross-source-browser-check.mjs` and `scripts/industry-metric-browser-check.mjs`, using `UI_REVIEW_ORIGIN` and an installed Playwright module via `UI_REVIEW_PLAYWRIGHT_MODULE`.

Browser harness corrections were limited to opening an already-open table deterministically, traversing all 449 existing Inbox rows instead of assuming at most 400, and checking the current Slice 3 chain nodes rather than an obsolete pre-listing label. No product data was changed for these checks.

## Limits / blockers / stopping point

No implementation blocker remains. Data audit retains two new nonblocking notices: the explicitly partial historical source has full **declared-window** coverage (11/11), and its documented admission/vintage limitations. No denominator manipulation or audit suppression was used. The existing Company Guidance cross-epoch P2 is untouched.

DATA/PRODUCTION remain **NOT_ADMITTED**, F1 **NOT_READY**, Entity **UNRESOLVED**; F3 actual-service coverage is not elevated. No PIT/release-vintage/revision continuity proof or automatic refresh SLA. Prosperity/Regime, AI Claim/Thesis, Portfolio, MCP/Agent and unrelated data repair are outside this slice.

CURRENT feature/execution/architecture and plan status are synchronized. Strategic scope/order is unchanged, so the strategic roadmap is not mechanically edited. Stop after ordinary branch push and wait for independent audit; no PR or merge.
