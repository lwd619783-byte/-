# UI V1.0 implementation checkpoints

Input base: `473289db6da79db5be892015bffc2c75b964abcb` (fetch + live refs/heads/main equality verified).
Branch: `codex/ui-v1-full-implementation-ultra`. This task executes D1–D5 continuously under the user's explicit single-branch authorization. Frozen D0 documents remain historical design evidence.

## D1 — shared shell and themes

- Shared seven-entry shell, compact global controls and contextual data health; independent versioned UI preference, neon default, invalid/unreadable/unwritable preference handling.
- Frozen tokens shared through CSS variables; no theme-dependent business tree, provider, sort or persistence changes. Mobile primary navigation retains all seven entries.
- Common chart color semantics are red up / green down; missing points remain gaps and single points remain visible.
- Focused validation: 7 files / 36 tests PASS; TypeScript PASS; `npm run ui:audit` completed.
- Browser: Chromium at 1600×1000, macro page switched neon/pro/light, same main geometry and text, zero page errors. Screenshots and JSON: `data-cache/ui-v1-acceptance/d1-*` (local evidence, excluded from production).
- Baseline build PASS: initial JS 2,334.70 kB / gzip 534.59 kB, CSS 44.00 kB / gzip 9.90 kB. Vite existing >500 kB chunk warning retained. Baseline browser and build evidence in `data-cache/ui-v1-acceptance/baseline-*`.
- Existing local generated workflow byte-size validation failure is visible and fail-closed in Mixed mode; no provider bytes or validation rules changed. Success/failure fixtures and final page-specific layout checks belong to D2–D5.

## D2 — company research and recoverable navigation

- Research table default, all five quality and six sorting choices retained; basic and advanced filters, original fields in row details/cards. Quick preview is separate from the complete company page and performs no heavy detail requests.
- Whitelisted hash pages/company IDs/five chapters; invalid IDs show an explicit empty state. Visited entry pages retain their filter/sort/selection state while company pages are open; history restores scroll and the selected company row.
- M13–M36 checked: business, financial fields and complete source report history, valuation/eight quote fields/signals, earnings comparisons, evidence/events/announcements/reports, watchlist actions, relation/chain links, quality/provenance all have explicit chapter destinations. Original callback and request identity guards retained.
- Modal focus confinement, Escape, focus return and appearance control work with the shared shell; appearance changes preserve the form subtree.
- Focused validation: 9 files / 84 tests PASS, including eight new company identity/chapter/late-response checks. TypeScript and full build/bundle gate PASS.
- Actual Chromium workflow: filter → sort → preview (zero new data requests) → Escape → full research → financials → neon/pro/light → browser back; filter, sort, scroll and company row focus restored. Invalid company deep link verified. Company overview at 390px and 320px has no document overflow.
- Local evidence: `data-cache/ui-v1-acceptance/d2-focused.log`, `d2-build.log`, `d2-browser.json`, `d2-responsive.json`, `d2-*.png`.

## D3 — research overview pages

- Home now starts with actual user tasks and research events, a selected existing price series, user observations and six research entries. Empty user work is explicit; no market temperature, news feed or AI conclusions were introduced.
- Macro retains all nine categories and original detail rows. The selected snapshot separates observation/time/source from the explicitly unavailable historical series and model.
- Industry provides overview, segment comparison and chain views, with research-pool denominators, scoped amount limitations, all robotics companies and independent private-company clues. Industry hash context survives company research and entry-page navigation.
- D2 follow-up correction: its final test-only selector used an unsupported `exact` option after the earlier successful typecheck/build. The extra selector option is removed here; the assertions and business implementation are unchanged. Current TypeScript and full build PASS.
- Focused validation: 5 files / 45 tests PASS. Browser verifies industry → preview → full research → back, page revisit, private-company access, nine desktop page/theme screenshots, and all three pages at 390px and 320px without document overflow or page errors.
- Evidence: `data-cache/ui-v1-acceptance/d3-focused.log`, `d3-build.log`, `d3-browser.json`, `d3-*.png`. Existing local guidance CRLF integrity failure remains visible pending the isolated checkout-byte correction in D5.

## D4 — evidence and review workflows

- Watchlist is a compact list with selected details; all original filters, five sorts, three task actions, metadata/review boundaries, archive/restore, templates and backup flows remain reachable. Full task lists and before/after review conditions can be inspected. Unmatched company records are explicitly retained and exportable.
- Verification separates event reconciliation, the global review queue and verification chains. Six filters retain their original scope; event deep links restore selection and invalid/withdrawn IDs cannot display prior details.
- Expectations separates comparison, source/time audit and import history, retaining all ten filters and effective snapshots/business revisions/corrections/import entries. Source rows are never averaged into invented consensus; conflict/exclusion warnings remain visible and official records remain read-only.
- Forms share compact/research/import sizes, labelled controls, visible in-modal store errors, submit serialization, focus containment and dirty-input protection. File-read generations prevent stale file content from overwriting newer input. Existing validator, partial-import confirmation, backup/replace/reset and append-only semantics are preserved.
- Integrated focused validation: 13 files / 289 tests PASS; additional final watchlist focus checks: 5 files / 43 tests PASS. TypeScript and full build/bundle boundary checks PASS.
- Actual browser sequence B: create an isolated synthetic observation, edit review, switch all themes without changing stored bytes, cancel close and browser back, continue and submit exactly one before/after review entry. Invalid import retains raw text and disables both write modes; 390px pro/light import screenshots have no document overflow.
- Evidence: `data-cache/ui-v1-acceptance/d4-focused.log`, `d4-forms.log`, `d4-build.log`, `d4-browser.json`, `d4-*.png`. Production stores, providers, schemas and financial source files are unchanged.
