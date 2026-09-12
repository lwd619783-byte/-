# Stage 4.1 semantic runtime / readiness V1

This additive package owns only Stage 4.1 result/projection contracts. It does not modify Financial Research Foundations V1 or `contracts/v1`, and grants no Provider/data/production admission.

- `semantic-runtime.schema.json`: F1 Query and EntityRef references; adapter status projection and fail-closed output envelope. Native values remain owned by the existing MetricObservationVintage and SourceDefinitionVersion. Unknown owner fields are null, not inferred facts.
- `readiness.schema.json`: compact-evidence assessment, per-metric normalization/backtest prerequisites, machine blocker codes and byte-pinned input references. READY requires all required gates PASS; UNKNOWN blocks eligibility. PARTIAL is tracked separately as implementation/evidence progress, not authorization to run.

Versioned interpretation, source/identity mapping and real replay limitations: [Stage 4.1-F](../../../docs/market-regime/semantic-runtime-readiness-v1.md).

Validation: `npm run test:semantic-runtime`, `npm run data:validate:semantic-bindings`, `npm run data:validate:semantic-readiness`. Historical F3 suite remains checked separately through `npm run contracts:validate` and `npm run test:contracts`.

Changes to the assessment scope, trusted owner equivalence, admission policy or readiness eligibility require a new reviewed contract/report version. Build commands are explicit maintenance operations; they must not be used to silently rewrite a published verdict to fit new inputs.
