# Verified Claim V1 — additive L3 owner

Status: IMPLEMENTED / PENDING INDEPENDENT AUDIT. This owner realizes the R0 / Stage 4.3 master plan L3 seam; it does not amend Frozen F2 or Phase 1 permissions.

`claim.schema.json` is the closed wire shape; the standalone browser validator is compiled by `scripts/contracts/verified-claim.mjs`. Pins reference the original Financial Research `shared.schema.json#/$defs/Pin`. There is no new graph schema or Evidence store.

`verifiedClaim.ts` enforces stable candidate identity, linear append-only revisions, immutable origin, precise recorded/asOf ordering, exact review binding and context URL constraints. `verifiedClaimRepository.ts` enforces trusted loaded bases, preview identity, explicit user confirmation, F2 re-execution, append-only import, pre-write raw backup and observed-corruption recovery. Future schema storage is locked. `ClaimOwners` is a reviewed code port, not a user-provided assertion or external API; only the Industry adapter is connected to the UI.

Each revision pins the original candidate and original graph digest/identity/revision/target. Statement, scope and origin must equal resolved owner content. A draft revision does not inherit a predecessor's decision. A review is a terminal VERIFIED/REJECTED decision for its exact revision; changing the decision requires a new revision. Missing historical owner resolution blocks current usable VERIFIED without rewriting historical decisions.

Contexts contain only kind/title/URL. They never enter graph resolution, admission, PIT or F2. They are untrusted background links; no API, body, original file or external private identifier is stored in this public repository. User-local backups may contain user-local references.

Validation: `npm run contracts:validate`, `npm run test:contracts`, `npm test`, and the separate four-case R1 F3 regression in `verifiedClaim.eval.test.ts`. Synthetic supported fixtures do not establish real Provider admission, Foundation 33-case service coverage or real verified counts.
