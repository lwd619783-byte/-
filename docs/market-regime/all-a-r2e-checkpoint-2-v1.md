# R2-E checkpoint 2 — release / PIT evidence

The three independent workstreams are integrated as versioned, replayable evidence bundles. `research-data/market-regime/source-catalog/r2-e/integration/release.v1.json` pins their reviewed JSON identities; raw replay is a separate check, not implied by the integration object's own hash.

SSE: 51 successful captures. Monthly publication schedule, source migration dates and annual publication definitions do not establish a historical daily release-to-bytes binding. SZSE: 10 successful captures, 28 official yearbook links and a 484-cell daily-table candidate artifact. Yearbook titles/years and statistical dates do not establish actual market publication or first-release identity. BSE: 32 successful captures including 2022–2026 holiday notices and all six attachments in two bounded annual directories. Naive index times, holiday dates and trading-rule publication remain separate from market releases.

All three sources retain `publicationDate=null`, `publicationDateTime=null`, `releaseAvailableAt=null` for the proposed market releases. No actual market publication date has been proven to which the frozen DATE_ONLY_SAFE rule could be applied. `releaseEvents=[]`, formalCount=0 and strictPitCount=0. First-release and revision history remain unproven; this is not evidence that no historical release/revision existed.

The evidence bundles include candidate and definition source material so each independent workstream is reviewable in this commit. Checkpoints 3/4 separately integrate their definition/era and candidate/eligibility decisions; only checkpoint 5 writes D3 admission. D1/D2 and frozen rules remain unchanged.

Validated: SSE/SZSE/BSE source tests 22/37/25, catalog 48, new SSE nine adversarial tests, BSE five tests, SZSE ten tampering tests, full raw replay for all three new source bundles, BSE five PDF text replays and its ten-capture holiday supplement. Integration release replay/refusal tests and frozen DATE_ONLY_SAFE boundary checks pass. SZSE PDF text uses installed pypdf 6.5.0; cell replay uses bundled pdfplumber. Both were actually run. SSE/SZSE large PDFs are local ignored raw: clean-clone full PDF replay is NOT_RUN without those bytes; small complete source responses and evidence metadata are committed.

No source or field changes from NOT_ADMITTED to ADMITTED/PARTIAL. New source-discovery findings are documented separately from formal admission. The bound source snapshots cannot be promoted by editing flags or resealing their own hashes.
