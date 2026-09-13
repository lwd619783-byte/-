# Stage 4.1-G PBC retained evidence closure V2

Status: IMPLEMENTED / VERIFIED locally; pending independent review. No source or production admission, PR, merge, or main CI claim.

## Actual retained evidence audit

The primary checkout had neither `research-data/market-regime/vintages/pbc-r2b-final-v1` nor `research-data/market-regime/raw/pbc-r2b`. The registered R2-B worktree did contain both. This distinction matters: missing in this checkout did not mean the sealed bytes had been lost.

The bounded export checked the existing `pbc-final-evidence.v1.json` seal against all four original snapshot byte sizes/digests, all eight native R2 sidecar canonical hashes, the full R1 catalog content hash and full R2 dataset content hash. Every comparison passed. The unchanged native `validate_dataset` also passed against the complete retained archive in that worktree; its admission remains PARTIAL. That local archive check is delivery-time evidence and requires the external worktree to repeat. It is not a clean-clone full-graph claim.

No network requests or source reacquisition were performed. No compact CSV was used to build an observation, release record, extraction, acquisition receipt or raw artifact. No test fixture was promoted.

## Committed positive replay

`research-data/market-regime/source-catalog/pbc-canary-v2/graph.json` is a projection of existing R1 catalog and R2 sidecar records. It contains one native observation and the complete supporting release, extraction, definition, retrieval and independent archive-entry evidence. It does not define a second Observation model or claim to be a full R2 dataset envelope. Only storage locations changed, with explicit original-to-committed relocations; byte content, original acquisition clock, source identity, and native artifact/observation IDs were retained.

| Proof | Committed canary |
| --- | --- |
| Metric / native period | `MACRO_M2_YOY` / `2011-10` |
| Value / unit | `12.9` / `%` |
| Definition | `pbc-m2-yoy-2011-v2` |
| Official release | HTTPS `www.pbc.gov.cn/diaochatongjisi/116219/116225/2855441/index.html` |
| Raw release bytes | 28,539; SHA-256 `ae3ba30b58f7ff84750c61550e85f5cf88f65dfff514a382254618aff3e01dc1` |
| Independent dated archive bytes | 39,229; SHA-256 `90b516493937671ecb867084722a276165135a43fb209f6fed317c077c7dc76d` |
| Release availability | `2011-11-11T15:05:06+08:00`, exact publication text locator |
| Actual release-page acquisition | `2026-09-08T11:06:07.128856Z` |
| Extraction | Byte offset 21,900; length 54; original M2 growth clause |
| Lineage | Native sequence 0, no predecessor, independently dated first-release archive link; quality remains PROVISIONAL |
| PIT checks | Excluded at `2011-11-07T08:00:00+08:00`; included at `2011-11-14T08:00:00+08:00`; exact release boundary tested |

The September 2026 acquisition is an authentic retained R2-B response; it is **not** a claim that bytes were captured in 2011. `fetchedAt` is never used to infer publication or availability. Official publication text and the retained independent dated index link provide the release evidence under the existing R2 contract.

Native replay uses R1 schema/catalog checks and R2 `Graph.validate_artifacts`, `validate_retrievals`, `validate_events`, `validate_extractions`, and `validate_conflicts`, followed by the original PBC parser and native observation/extraction identity recomputation. Definition equality is checked against the current native definition owner. The frozen plan's original grid is reused without shrinking its denominator.

## Capability and admission boundaries

The positive canary capability is PASS. Full graph replay remains BLOCKED: only 1 of the seal's 894 native observations is committed. The complete raw archive, full native input/dataset and sealed snapshots remain ignored local archive material, unavailable to clean CI. Revision inventory/exhaustiveness remains incomplete under the existing R2-B evidence. Source admission remains BLOCKED/PARTIAL and production remains NOT_ADMITTED.

Storage classes are explicit: two committed raw responses; remaining ignored local archive; no configured external retention service; no reacquisition; test fixtures excluded. A local full validator PASS and a clean-clone single-observation PASS are separate facts.

Stable full blockers: `PBC_FULL_GRAPH_NOT_COMMITTED`, `PBC_REVISION_INVENTORY_INCOMPLETE`, `PBC_SOURCE_ADMISSION_PARTIAL`. Machine-readable missing owners and digest-bound supporting references are in `closure-report.json`. No normalization, formula, weekly feature, backtest or full-source gate is promoted by this canary.

## Reproduction and integration

- `python -m scripts.market_regime.pbc_canary` replays the committed slice offline.
- `python -m unittest scripts.tests.test_pbc_canary_v2` runs 14 adversarial native tests.
- `node --test scripts/tests/pbc-evidence-v2.node.mjs` checks deterministic capability reporting and cutoff-safe query references.
- `node scripts/semantic-runtime/pbc-evidence-v2.mjs` verifies the committed closure report; `--write` explicitly regenerates it.
- Optional bounded re-export: `python -m scripts.market_regime.pbc_canary --archive-root <retained-R2-B-worktree>` verifies the original seal before copying bytes. It never downloads sources or infers missing evidence.

`queryCanaryEvidence({asOf, metricId, sourceDefinitionId, valueDate}, {root})` returns only already-visible native observations and their extraction/release references. It never returns future observation IDs or values. The caller must still run the reviewed Entity identity and full-source admission gates; this helper resolves neither. `buildPbcEvidenceClosure({root})` reports positive, full-graph and source statuses separately. V1 published artifacts and semantics are unchanged.

Tests cover fixture rejection, reacquired/retained separation, tampered raw bytes, locator, release, definition, official URL, acquisition/publication clocks, missing independent archive bytes, invalid future revision, release cutoff, and canary/full-admission separation. Test success proves these offline checks, not broader source admission.
