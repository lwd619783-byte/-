# R2-E checkpoint 3 — field definitions and era applicability

`integration/definitions.v1.json` records all **3 exchanges × 3 fields** with separate definition evidence, review partitions, source-wide blockers and field-specific blockers. All nine remain NOT_ADMITTED; no new SourceDefinitionVersion or formal admission authority is created.

SSE annual publications distinguish amount terminology and later non-restricted capitalization; the 2006 volume's definition year conflicts with its 2005 market table and remains unresolved. The two API families' local migration behavior is evidenced, but the review partitions explicitly say family/definition applicability NOT_PROVEN and calendar UNKNOWN.

SZSE yearbooks establish their own calculation descriptions and units. The 2022 ChiNext daily tables remain a separate candidate family; their board label does not become an all-SZSE A-share aggregate. The official 2025 indicator guide distinguishes circulating A-share capitalization from free-float capitalization. Annual total trading-day counts use max(A,B), so they cannot establish an A-only denominator.

BSE 2021/2026 rules establish rule context, including explicitly deferred 2026 clauses. Rule 3.6.8 concerns block-trade volume; it does not independently prove all-mode inclusion in `hqcjje` amount. Annual 2021 figures can include pre-launch selected-layer data. A note about refinancing historical adjustment does not create a revision blocker for unrelated market-value/turnover fields.

Only negotiableMarketCap carries the free-float distinction blocker; only BSE turnoverValue carries the block-trade amount inclusion blocker. All fields retain their actual daily source/era/scope and PIT gaps. Full unadmitted windows remain SSE/SZSE 2005-01-01..2026-09-04 and BSE 2021-11-15..2026-09-04.

Validation: deterministic nine-cell matrix replay; adversarial era-promotion and field-blocker isolation tests; original SSE/SZSE/BSE source suites. Frozen contracts and D2 are unchanged.
