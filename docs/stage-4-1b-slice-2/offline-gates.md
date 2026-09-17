# Stage 4.1B Slice 2 offline gate results

All runs are local offline validation; no hosted CI or admission claim.

| Command | Exit code | Log |
| --- | --- | --- |
| `npm run contracts:validate` | 0 | contracts-validate.log |
| `npm run test:contracts` | 0 | test-contracts.log |
| `npm run test:local-core` | 0 | test-local-core.log |
| `npm run test:financials:a` | 0 | test-financials-a.log |
| `npm run data:validate:financials:a` | 0 | data-validate-financials-a.log |
| `npm run test:announcements:a` | 0 | test-announcements-a.log |
| `npm run data:validate:announcements:a` | 0 | data-validate-announcements-a.log |
| `npm run test:expectations:company-guidance` | 0 | test-expectations-company-guidance.log |
| `npm run data:validate:expectations:company-guidance` | 0 | data-validate-expectations-company-guidance.log |
| `npm run test:expectations:institution-consensus-probe` | 0 | test-expectations-institution-consensus-probe.log |
| `npm run test:provider-observability` | 0 | test-provider-observability.log |
| `npm run test:market-regime:catalog` | 0 | test-market-regime-catalog.log |
| `npm run test:market-regime:historical` | 0 | test-market-regime-historical.log |
| `npm run test:market-regime:pbc` | 0 | test-market-regime-pbc.log |
| `npm run test:market-regime:csrc-c1` | 0 | test-market-regime-csrc-c1.log |
| `npm run test:market-regime:sse` | 0 | test-market-regime-sse.log |
| `npm run test:market-regime:szse` | 0 | test-market-regime-szse.log |
| `npm run test:market-regime:bse` | 0 | test-market-regime-bse.log |
| `npm run test:market-regime:all-a` | 0 | test-market-regime-all-a.log |
| `npm run data:validate:market-regime:all-a` | 0 | data-validate-market-regime-all-a.log |
| `npm run data:validate:semantic-bindings` | 0 | data-validate-semantic-bindings.log |
| `npm run test:semantic-runtime` | 0 | test-semantic-runtime.log |
| `npm run data:validate:semantic-readiness` | 0 | data-validate-semantic-readiness.log |
| `npm run test:stage-4-1-g` | 0 | test-stage-4-1-g.log |
| `npm run data:validate:pbc-evidence-v2` | 0 | data-validate-pbc-evidence-v2.log |
| `npm run data:validate:semantic-readiness:v2` | 0 | data-validate-semantic-readiness-v2.log |
| `npm run data:validate:market-regime:catalog` | 0 | data-validate-market-regime-catalog.log |
| `node scripts/generate-company-guidance-expectations.mjs --check` | 0 | company-guidance-committed-check.log |
| `python -m scripts.market_regime.cli build --input research-data/market-regime/source-catalog/catalog-seed.sample.v1.json --output data-cache/stage-4-1b-slice-2/gates/catalog.sample.json` | 0 | catalog-isolated-build.log |
| `python -m scripts.market_regime.cli validate --catalog data-cache/stage-4-1b-slice-2/gates/catalog.sample.json --verify-artifacts` | 0 | catalog-isolated-validate.log |

Catalog build uses an isolated data-cache output to avoid overwriting committed artifacts; both isolated and committed catalogs were validated.
Focused chart audit: 27 tests PASS; chart-audit-focused.log.
