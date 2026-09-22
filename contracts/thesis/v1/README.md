# Thesis V1 — additive L4 contract

Stage 4.3-R2 implementation contract; PENDING INDEPENDENT AUDIT. No change to frozen F2, Claim V1, Phase 1 permissions, Provider admission or historical audits.

A stable Thesis ID has a linear immutable draft revision chain and separate append-only user confirmations. New drafts never inherit confirmation. The latest confirmed revision remains the current formal Thesis while its successor is a draft; every view rechecks original Claim authority and reports blocked when support becomes unavailable. Confirmation binds an exact saved head revision and reruns original F2 through Verified Claim V1. AI origin is retained permanently.

VerifiedClaimRef pins claimId/revisionId/reviewId and canonical revision/review bytes. These bytes are integrity tokens, not fallback evidence or an alternative Claim owner. Resolution always reads the original Claim repository, checks exact bytes, VERIFIED decision and review availability by Thesis asOf, and executes previewClaim using original owners. A later Claim head never substitutes for a pinned revision. Missing old owner, changed bytes, unsupported F2, corrupt/future Claim storage all fail closed.

Identity references use existing MacroIndicator / Industry / Stock owner IDs from the application dataset, with unique exact owner+ID matching only. This is not a Local Core Entity registry or a macro_metric-to-macro bridge. Unresolved or duplicate IDs block; no auto-create, alias matching or foreign-reference repair.

MacroIndustryRelationship lives inside the immutable Thesis revision. Each edge pins exact macro/industry identities, rationale, asOf, conditions and optional supporting Claims (a subset of Thesis support). Exposure is direct/indirect/unknown; sensitivity is qualitative/unknown; no numeric value, score or industry direction. Missing support or unknown fields produce unknown; invalid identity/evidence produces blocked. Unknown can be retained as explicitly unknown alongside an otherwise supported user Thesis; blocked edges prevent confirmation.

Research Context reuses Claim's non-authoritative kind/title/URL shape, never participates in F2 or identity resolution. No remote body fetching or AI runtime is introduced.

Local-first persistence reuses PersistedBaseGuard and exact loaded-byte snapshots, bound previews, append-only merge import, explicit confirmation, pre-import/recovery backup and observed-corruption recovery. Future versions lock recovery. Backups are portable data, not authenticated attestations; local storage and local user confirmations share the existing local trust boundary. Simultaneous cross-tab CAS is not provided by LocalStorage.
