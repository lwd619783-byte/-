# Stage 4.1-G identity / evidence readiness V2

Additive interpretation release. Stage 4.1-F V1 owners, bindings, reports and
Financial Research Foundations / `contracts/v1` remain published unchanged.
This package grants no source, data, normalization, backtest or production admission.

## Macro identity bridge V1

RegistryEntry.entityType=`macro_metric`, F1 EntityRef.entityType=`macro`, and
Market Regime metricId have different owners. No conversion by equal strings,
name, alias or display label is permitted. `macro-identity-mapping.v1.schema.json`
is an explicit equivalence assertion, not another Entity Registry.

Each mapping pins both its original RegistryEntry export and the original metric
definition. Its F1 endpoint is an exact EntityRef. A policy-owned list selects the
current mapping revisions; the request cannot supply policy, mapping or authority.
The entire selected set must be exact 1:1 by metricId, F1 entityId and Registry
entityId. Duplicate or conflicting endpoints reject the set, without tie breaking.

Mapping revisions are append-only: revision 1 has no predecessor; later revisions
pin the immediately preceding revision of the same mappingId. The endpoints never
change under one mappingId. Status is `reviewed` or `revoked`; revocation remains
in history. Every revision pins a review record containing reviewer, review time,
decision, mappingId, revision and SHA-256 of the mapping excluding reviewRef.
Review records are repository-governed attestations, not cryptographic signatures
and not permission for Registry mutations. Populating the trusted policy requires
explicit owner evidence and review; schema-valid self assertions are insufficient.

At runtime a trusted Node host supplies **only the existing EntityRepository's
read-only list port and its owner identity**. Every query verifies retained export
bytes/locator/entityId/revision, then compares the complete entry with a fresh
Registry list result. It requires one active, userConfirmed macro_metric entry,
without mergedIntoEntityId. Missing current Registry access, stale export,
inactive/merged/candidate/archived identity, bad pin or unreviewed mapping fail
closed. A historical export alone cannot assert current active identity.

No database discovery, init, migration, entity create, rename or merge is provided.
No raw SQL or mutable repository is exposed to query callers. The default trusted
policy has no Registry owner and no mappings because this delivery has no confirmed
Registry identity evidence. Positive tests use explicitly synthetic owner data.

## Readiness V2

V2 re-evaluates the same 23 metrics and retains the independently evaluated 15
normalization / 16 PIT backtest prerequisites. It carries machine-reproducible
V1 → V2 deltas including evidence references, closed-by-evidence and follow-up
source requirements. Identity capability and a limited raw replay are reported
separately from full-scope gate eligibility. One replay never establishes complete
observation graph coverage or source admission. Committed V1 and V2 must both
validate in CI. New owner equivalence or eligibility changes require a subsequent
reviewed version, not a rewrite of either published version.
