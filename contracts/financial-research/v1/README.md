# Financial Research Foundations contract package V1

CONTRACT FROZEN / PENDING REVIEW. Runtime NOT_IMPLEMENTED; production NOT_ADMITTED.

Authority / reuse matrix / semantics: [Scope Freeze](../../../docs/financial-research-foundations-contract-v1.md).

- `semantic-binding.v2.schema.json`: F1 field bindings to owner contracts, not a Metric payload.
- `evidence-graph.v1.schema.json`: F2 immutable pins and typed relationships, not business objects.
- `relation-policy.v1.json`: permitted directed kind pairs and propagation rule.
- `golden-case.v1.schema.json`: F3 fixed input / expected semantic output for either future deterministic services or Agent adapters.
- `shared.schema.json`: reference pins, request and result; imports original V1 EntityRef. Graph imports original EvidenceRef.
- `test-input.v1.schema.json`: **synthetic test data only**, not a production wire schema; imports original MetricObservationVintage.
- `golden-cases.v1.json`, `fixtures/`: eight categories of immutable synthetic scenarios. Assumed fixture eligibility is scoped to the offline exercise and conveys no real admission.
- `examples/pbc-binding.json`: binds an actual existing PBC definition, without copying it or enabling any use. Missing semantic bindings remain null. Its policy pin is explicitly synthetic; replace it with an audited domain policy before implementation.

Run `npm run contracts:validate` and `npm run test:contracts`; the existing V1 checks run first, followed by the isolated foundations checker. Direct commands: `node scripts/contracts/financial-research.mjs`, `node --test scripts/tests/financial-research-contracts.node.mjs`.

The checker has no network, Provider, database or application integration. Its arithmetic oracle only supports the frozen synthetic fixture formula. It is not a production retrieval service or Agent harness. The graph checker verifies logical closure and fixture pins, not real-world truth. Authority, admission, original-state projection and identity equivalence remain mandatory owner-adapter checks before any runtime can consume real data.

Pins in V1 use a SHA-256 of the entire retained UTF-8 JSON file and an RFC 6901 pointer into that file. Source documents such as PDFs use their existing Artifact metadata plus a retained evidence locator record; raw document parsing is not implemented here. A URL, a digest without retained bytes, or arbitrary matching labels cannot prove citation completeness.

Do not edit an existing expected result to match a failing implementation. Incompatible semantics need a new wire version. Approved Golden changes need case version increments and review; retained released case sets remain immutable. No changes to existing `contracts/v1` payloads, permissions or runtime version discovery are made by this package.
