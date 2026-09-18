# Listing Status Reconciliation V1

This is a read-only discovery seam for **existing tracked private / pre-IPO research identities**. It is not an Entity Registry, a market-wide IPO scanner, an admission gate, or an automatic Universe writer.

`tracked-pre-ipo.v1.json` records the exact historical tracking identity and an explicitly reviewed migration mapping. The Unitree baseline points to `3edd80f...:src/data/privateCompanies.ts`; its historical `未上市` label is deliberately preserved as an input to the regression replay, not a statement about current status.

- `python scripts/listing/probe_listing.py`: intersect configured identities with the current `roboticsPrivateCompanies` source; unknown configured-source coverage returns `SOURCE_UNAVAILABLE`. A TypeScript AST reader extracts only literal top-level company identities from the named export; nested Evidence IDs are excluded and computed/spread/unknown executable forms fail closed. After the Unitree migration the current private set is empty.
- `python scripts/listing/probe_listing.py --baseline`: request the configured official exchange disclosure against the retained historical private baseline.
- `python scripts/listing/probe_listing.py --replay`: verify retained source bytes and provenance, then run the same parser against that baseline.
- `python -m unittest scripts.tests.test_listing_reconciliation`: positive replay, exact identity conflicts, fail-closed source handling and no writes.

The V1 adapter supports the SSE STAR Market listing announcement structure only. Other exchanges or undiscovered disclosures are not silently interpreted. Future tracked candidates require explicit official-source configuration or a separately reviewed adapter; failure or absence of an announcement is never proof that a company is still private. `UNCHANGED_PRIVATE` requires an explicit official private-status statement. IPO application progress and future effective listing dates remain `IPO_IN_PROGRESS`. Only complete exact legal name / security name / code / exchange / board / effective date can produce `LISTED_MIGRATION_REQUIRED`; conflicts hide candidate mapping. Probe output never changes the reviewed mapping or seeds.

The official Unitree disclosure was retrieved over HTTPS on 2026-09-18. Publication date is 2026-08-18; listing effective date is 2026-08-19; `releaseAvailableAt` remains unknown. The retained HTML and provenance record the exact raw bytes, SHA-256 and response URL. `fetchedAt` is the retrieval clock only. The source proves the listing identity; it does not verify the pre-existing robotics research claims or grant Provider admission.

Original product and IPO tracking evidence is retained in `src/data/unitreeHistoricalResearch.ts` without rewriting its claims or supplying invented source dates. Current stock evidence labels these entries as historical and applies the existing missing-source/date verification downgrade. The current listed seed and symbol mapping retain `id=unitree`, `robotics`, `robot-oem`, and the original `下游` research position. Provider refreshes do not decide this position.
