# Stage 4.1 R2-E Integrated — All-A D3 delivery

Branch: `codex/stage-4-1-r2-e-integrated`. Start `git fetch origin` succeeded; origin/main exactly matched `1179c0992881e01ab71bc409641e46acf129a408`. The same remote main identity was rechecked before final delivery. No baseline change, rebase, PR, merge, deployment, normalization, backtest, formula admission or UI work.

## Result

All five checkpoints completed as versioned evidence/admission work. **All-A remains NOT_ADMITTED.** No source/field changed from NOT_ADMITTED to formal ADMITTED/PARTIAL. Discovery evidence improved; it was not promoted into historical availability.

| All-A era | Required sources | Official targetCount | Numeric aggregates | Coverage |
| --- | --- | --- | ---: | --- |
| 2005-01-01..2021-11-14 | SSE + SZSE | UNKNOWN / null | 0 | null |
| 2021-11-15..2026-09-04 | SSE + SZSE + BSE | UNKNOWN / null | 0 | null |

Both full session grids and historical exceptional-closure/revision enumeration remain unproven. The existing literal ISO calendar locator gate remains unsatisfied. No weekdays, third-party calendars, populated daily responses, annual counts, or cross-exchange calendar borrowing were used to create a denominator. SSE's currently linked notice index reaches title years 2013–2026; it does not recover a 2005–2012 official calendar. BSE's five annual notices do not establish all sessions from launch to the frozen end. Existing bounded D1 calendars remain evidence for only their explicit windows.

| Exchange | Field | Definition evidence | Daily era applicability | PIT / formal admission |
| --- | --- | --- | --- | --- |
| SSE | turnoverValue | Publication definitions and API labels | UNPROVEN | NOT_ADMITTED |
| SSE | totalMarketCap | Publication definitions and API labels | UNPROVEN | NOT_ADMITTED |
| SSE | negotiableMarketCap | Publication negotiable/non-restricted terminology | UNPROVEN; no free-float equivalence | NOT_ADMITTED |
| SZSE | turnoverValue | Publication definitions; separate daily ChiNext table | UNPROVEN for all-SZSE A-share source | NOT_ADMITTED |
| SZSE | totalMarketCap | Publication definitions; separate daily ChiNext table | UNPROVEN for all-SZSE A-share source | NOT_ADMITTED |
| SZSE | negotiableMarketCap | Publication/official indicator definitions | UNPROVEN; no free-float equivalence | NOT_ADMITTED |
| BSE | turnoverValue | Trading-rule context, webpage mapping | UNPROVEN; amount inclusion of all modes/block trades unresolved | NOT_ADMITTED |
| BSE | totalMarketCap | Webpage mapping, annual-report context | UNPROVEN scope and close basis | NOT_ADMITTED |
| BSE | negotiableMarketCap | Webpage mapping, annual-report context | UNPROVEN; no free-float equivalence | NOT_ADMITTED |

Each source and field keeps its complete unadmitted window: SSE/SZSE `2005-01-01..2026-09-04`, BSE `2021-11-15..2026-09-04`. Common blockers are full official calendar, literal calendar evidence, continuous daily release history, actual market release, historical release/bytes binding, first-release/revision evidence and absence of eligible formal observations. Field-specific blockers are kept separate; free-float restrictions never leak into totalMarketCap/turnoverValue and BSE block-trade restrictions never leak into capitalization fields. BSE before launch remains OUTSIDE_REQUIRED_SCOPE with null value and release, not a zero component.

| Exchange | Prior field captures | New field captures | Combined candidateCount | Unique discovery keys | formalCount | strictPitCount |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| SSE | 42 | 87 | 129 | 120 | 0 | 0 |
| SZSE | 45 | 484 | 529 | 529 | 0 | 0 |
| BSE | 24 | 18 | 42 | 39 | 0 | 0 |
| Total | 111 | 589 | 700 | 688 | 0 | 0 |

Unique keys include exchange/family/scope/date/field. They are neither selected vintages nor trading-day coverage. All 700 source pointers and candidate hashes were independently checked; 12 duplicate keys retain both captures without truth selection. New per-field counts are turnover 277, total cap 277, negotiable cap 35. SZSE's 484 cells are two 242-date tables, not 484 all-market observations. `numericAggregateCount=0`, `observations=[]`, `dailyGrid=null`, `targetCount=null`, `coveragePercent=null`.

## Evidence workstreams and artifact navigation

- Calendar: [foundation](../../research-data/market-regime/source-catalog/r2-e/calendar/foundation.v1.json), 13 acquisition journals and 104 complete response attempts; 103 HTTP 200 and one BSE redirect-loop/302 response. Exact SSE index navigation, actual pagination script and all 6 pages / 83 linked notices replayed. This is completeness of the particular current index only.
- SSE: [workstream](../../research-data/market-regime/source-catalog/r2-e/sse/README.md), 51 successful captures, two-family 19-civil-date boundary grid plus 2005 probe, publication definitions and unresolved 2006-volume year conflict. Candidate-only source migration evidence; no globally inferred family era.
- SZSE: [workstream](../../research-data/market-regime/source-catalog/r2-e/szse/README.md), 10 successful captures, 28 official annual links, three inspected yearbooks and 484 page/cell candidates. Printed monthly turnover totals cross-checked. max(A,B) total-day terminology is explicitly excluded as an A-only denominator.
- BSE: [workstream](../../research-data/market-regime/source-catalog/r2-e/bse/README.md), 22 successful captures and [holiday supplement V2](../../research-data/market-regime/source-catalog/r2-e/bse/supplement-v2/README.md), 10 successful captures. All six returned annual attachments and five queried annual notices captured. V2 supersedes only the earlier unresolved 2022–2024 notice URLs, not source admission.
- BSE final correction: [rule-locator supplement V3](../../research-data/market-regime/source-catalog/r2-e/bse/supplement-v3/evidence.v3.json) binds nine rules to complete unique body paragraphs. Independent final review found that V1 first-substring locators for effective/deferred statements had matched share-link summaries; the deferred locator omitted the actual clauses. V3 supersedes only these rule locators, preserving original V1/V2 bytes.
- Integration: [release](../../research-data/market-regime/source-catalog/r2-e/integration/release.v1.json), preserved [definition review V1](../../research-data/market-regime/source-catalog/r2-e/integration/definitions.v1.json), corrected [definition review V2](../../research-data/market-regime/source-catalog/r2-e/integration/definitions.v2.json), [candidate eligibility ledger](../../research-data/market-regime/source-catalog/r2-e/integration/history.v1.json), and new [All-A D3](../../research-data/market-regime/source-catalog/all-a-d3/admission-report.v1.json). Definition V2 changes only BSE rule locators and their references; candidate history contains unchanged blockers, not the faulty locators, and remains V1. D3 explicitly binds and replays all four checkpoint artifacts.

D3 content hash: `f7fc8468b9dcbf90825ff9aa94740c6f59430ce90361675db91f42bbf7d81797`. Corrected definition V2 content hash: `86c748053bc71aef8daf9848b0eb96b9f61c99d15506448120e6e53cc093a9a6`. V3 correction input is separately pinned by full-object canonical SHA `18938ada45e9aaa5f56b73cb3beb6cbf1ac3a9a852ed9c24ff90fa8dbd98f6ad`; this pin does not alter prior checkpoint input identities.

The complete new source artifact path/byte-hash list is [delivery-artifacts.v1.json](../../research-data/market-regime/source-catalog/all-a-d3/delivery-artifacts.v1.json). It lists source-catalog additions and excludes its own self-referential hash; raw response metadata retains official URLs, byte locators and retrieval details.

Old D1 contracts/inventories and D2 are unchanged. D2 business hash remains `4ba8737f2dc9e0ba32a35249b36b07075253ea9a11270b67be78029f9ff3b3c1`. Large PDFs live only in ignored local raw, with exact relative paths/full hashes in the new metadata. Small complete public HTML/JS/JSON/PDF responses are committed with byte-preserving attributes. JSON CRLF is retained where captured; cr-at-eol is recognized by whitespace checking instead of editing evidence bytes. No global Git/environment configuration changed.

## Executed verification

| Command/check | Result |
| --- | --- |
| `npm run test:market-regime:sse` | PASS, 22 tests |
| `npm run test:market-regime:szse` | PASS, 37 tests |
| `npm run test:market-regime:bse` | PASS, 25 tests |
| `npm run test:market-regime:all-a` | PASS, 40 tests |
| `npm run test:market-regime:historical` | PASS, 66 tests including calendar/PIT/identity guards |
| `npm run test:market-regime:catalog` | PASS, 48 tests |
| `npm run test:market-regime:r2-e` | PASS, 28 tests including additive correction pins, checkpoint tampering and field isolation |
| SSE review `unittest discover -s research-data/market-regime/source-catalog/r2-e/sse -p test_r2e_sse_review.py` | PASS, 9 adversarial/sealed/version tests |
| SZSE `unittest discover -s research-data/market-regime/source-catalog/r2-e/szse -p test_evidence.py` with bundled Python | PASS, 10 tests, real PDF bbox tampering test executed, no skip |
| BSE `test_evidence.py` | PASS, 5 tests |
| Original three `data:validate:market-regime:{sse,szse,bse}` | PASS, full local D1 raw replay |
| Original three `data:validate:market-regime:{sse,szse,bse}:compact` | PASS, also in tracked-file export |
| Original `data:validate:market-regime:all-a` | PASS, original D2 preserved |
| `python -m scripts.market_regime.r2e_calendar validate` | PASS, all 104 attempts, raw hashes, typed discovery and six-page navigation |
| SSE `r2e_sse_probe build-candidates`, `build-evidence`, `replay`, `replay --compact` | PASS; builders identical-only, 51 captures / 87 candidates; full locally replayed 4 PDFs |
| SZSE `r2e_szse_probe validate` | PASS, 10 raw and 13 text pages using installed pypdf 6.5.0 |
| SZSE `r2e_szse_probe replay-candidates` with bundled Python | PASS, 484 PDF cells, 12 monthly sums; separate text replay explicitly delegated to previous command |
| SZSE `build-candidates` twice; `validate-compact` | PASS, identical sealed output; compact clearly excludes missing large PDFs |
| BSE `probe.py replay`, `derive.py build/validate`, `pdf_replay.py build/validate` | PASS, 22 raw, 18 candidates, 5 PDF text replays |
| BSE `supplement-v2/replay.py build/validate` | PASS, 10 raw / 5 annual notices |
| BSE `supplement-v3/replay.py build/validate` and `test_replay.py` | PASS, nine complete body-paragraph locators and four regression tests |
| `r2e_integration build/validate release`, `definitions`, `history` | PASS, immutable deterministic artifacts and pinned external inputs |
| `r2e_integration build/validate definitions-v2` | PASS, additive BSE correction; V1 bytes and admission blockers preserved |
| `npm run data:build:market-regime:all-a-d3` and `data:validate:market-regime:all-a-d3` | PASS; no invented calendar or aggregation |
| `npm test` | PASS, 55 files / 725 tests; no exclusion workaround needed |
| `npm run data:audit` | exit 0, 0 errors / 24 warnings / 10 skipped / 34 allowlisted; only generated timestamp/count changes restored in old audit document |
| `npm run build` | PASS, TypeScript/Local Core/Vite/browser/bundle boundaries; existing >500 kB chunk warning |
| `npm run env:check` | exit 0, READY WITH WARNINGS: 48 PASS / 10 WARN / 0 FAIL / 4 SKIP, pre-final-commit snapshot |
| `npm run --silent env:check:json` | same pre-final-commit summary; never represented as warning-free PASS |
| `git diff --check` / staged diff check | PASS after source-byte attributes were correctly specified |

Environment warnings concern multiple runtimes, four unpinned Python dependencies, existing pip check issue, pre-commit dirty state, ignore coverage and older/partial generated data. No dependency/environment changes were made to suppress warnings. Build/data-audit warning details remain in local task logs.

Independent final integration review passed: D3 fieldAdmission equals corrected V2, old three checkpoint artifacts and BSE V1/V2 match committed bytes, D2 has no diff against the specified base, and all counts/source-field blocker boundaries replay. An added regression initially assumed the last evidence reference was the correction; canonical set ordering does not preserve that position, so the assertion now checks membership. The corrected 28-test suite passed.

Transient failures were fixed and rechecked: calendar test originally compared canonical set order as an ordered list; initial direct-file SSE test invocation lacked package import context and was rerun with unittest discovery; D3 draft had a bracket syntax error fixed before successful tests; source-workstream fetch/parser/runtime issues and their corrected replays are recorded in their READMEs. Initial Git commit lacked configured author identity; authenticated GitHub account and existing repository authors were verified, then the same audited author identity was supplied per commit without global configuration changes. No failed commit rewrote history.

## NOT_RUN / BLOCKED and verification limits

- Both full All-A official session grids and complete calendar revision/exception history remain BLOCKED/UNKNOWN.
- Actual historical daily release-to-bytes, first-release/revision and daily definition-era eligibility remain BLOCKED for all three fields/sources. Formal observation expansion cannot proceed through missing gates.
- The other 25 SZSE index-discovered yearbook PDFs were NOT_RUN; exact links remain in archive-index. No claim is made that all potentially obtainable official archives or all historical revisions were exhausted.
- Eight large SSE/SZSE PDFs were fully replayed locally but are not committed. A clean clone without the exact local raw bytes reports NOT_RUN for full PDF replay. No off-machine durable archive is claimed.
- Tracked-only export at checkpoint 4 `52beada358fe07fbcf93af9f76d37f4d0711ff0a`: 439 files, no ignored raw and no network. Calendar full, BSE complete raw/PDF, all three old compact and integration release/definitions/history passed. SSE/SZSE compact explicitly reported four missing PDFs each; deliberate full replay exited nonzero as expected. Initial export lacked 59 tracked old fixtures, which were then exported from the identical commit and the check passed.
- Final candidate export overlay: eight relevant current files over that 439-file base; snapshot hash `2407810a4a25bc1a7c26badd40137e7cda0b4512817c664b2e789306eae3a080`. D3, definitions-v2 and BSE V3 validators all passed with subprocess audit hooks denying network and actual-workspace reads outside the export. This is an explicitly identified final working candidate overlay, not the original checkpoint 4 commit; it contains no ignored PDFs.
- Hosted CI was NOT_RUN: no PR or merge was requested. Local checks do not imply hosted CI or production admission.

## Checkpoint commits

1. Calendar foundation: `5d6edfb8bd88ddcb0de547b1fcffa73fb83f6923`
2. Release/PIT evidence: `e6b9639b3fec447cb7c5052e08208fb5eb8027fe`
3. Definition/era review: `efe240d347fcf6b947dec16aa2eb6154fa37493f`
4. Candidate/history eligibility: `52beada358fe07fbcf93af9f76d37f4d0711ff0a`
5. D3 final checkpoint: final delivery commit, full SHA in the final task message (avoids a self-referential SHA).

Each checkpoint was ordinarily pushed before the next. Final HEAD/remote equality, ahead/behind relative to origin/main, and clean working tree are checked after the final push and reported in the task message.
