# AI Knowledge Ingestion V1

> 2026-09-22 [R0](../../../docs/stage-4-3-r0-external-knowledge-rebaseline.md)：KEEP knowledge-contribution.v1 interchange / fallback transport；BrowserSource/parser/read-only Bridge 为 FREEZE / LEGACY COMPATIBILITY。现有 schema、permissions、persistence 与审核规则不变；外部 context 不能单独晋升 Verified Claim。

Additive candidate transport. No change to the frozen Phase 1 permissions, Source/Extraction common schema, Creator authority, or Wiki schema. `contribution.schema.json` references Slice 1 ResearchExtraction; the browser's generated validator is reproducibly checked by `contracts:validate`.

## Authority and review

- BrowserSource owns local exact bytes; IndexedDB `originals` contains Uint8Array, `state` contains batches/metadata/parser results/imported bundles/transport dispositions. Batch + bytes save atomically before parsing. No base64/localStorage original mirror. Every load verifies byte length and SHA-256; stale writes use transaction CAS; quota, duplicate, unsupported version and corruption fail closed.
- `browser-source.v1` is the explicitly registered native adapter implementing Slice 1 `ResearchSourceAdapter`. The composite adapter dispatches only registered domains; Creator continues to own Creator material. Local uploaded documents have unknown publication/author/verification, even when byte integrity passes.
- Imported ResearchExtraction stays `ai_draft`, `draft`, unknown publication, `effectiveAt=null`; its persistence owner is the imported immutable bundle. Knowledge atoms are pointers into those findings. No separate Extraction schema/store/review authority and no event relationship authority are created.
- CREATE / UPDATE / LINK / CONFLICT require a complete human-readable document and grounded section change summaries. NO_ACTION has no document/write target. All imported proposals initially await review. Import is not acceptance. An accepted proposal appends the existing WikiEntry when needed, one full WikiRevision and one WikiReview in one original repository append. AI origin persists, including user edits. UPDATE retains identity and requires the exact current reviewed base; an existing later draft blocks it rather than forking the chain.
- `bundleId` and `proposalId` are lowercase alphanumeric/hyphen IDs up to 32 characters. Length-prefixed pair IDs fit the frozen Wiki ID contract without collision. Accepted state derives from the existing WikiReview; rejection/NO_ACTION dispositions are immutable transport triage, not a second article-quality Review owner. Web Locks serialize competing review actions; absence locks review. Wiki CAS still detects concurrent manual edits.
- Uncertainty is retained in the bundle, inbox, complete article and revision reason. Acceptance does not produce Provider Fact, Verified Claim, Thesis, Entity mappings, PIT proof or admission.

## Source and parser limits

1–30 PDF/MD/TXT files, 25 MiB per file and 100 MiB per batch. Paste is stored as a UTF-8 text original. MD/TXT decoding is strict UTF-8 and creates `line:N` locators. PDF.js 6.3.289 is lazy-loaded with a same-origin bundled worker, text-only, up to 500 pages, `page:N` locators. No OCR, password handling, document scripts, external font/CDN or network acquisition. Scanned, encrypted, malformed, unsupported font/CMap and empty-text PDFs fail extraction; original remains downloadable. Parse failure does not imply original-save failure. Page text has no claim to pixel-perfect reading order or layout.

## Runtime and transport

`KnowledgeAnalysisProvider` has no default implementation; no paid model call or production fake. `ResearchBridgeReadPort` describes an explicit future/remote read transport, not automatic access to IndexedDB. `ContributionSubmitPort` preserves future direct-submit compatibility but no MCP write tool is registered.

Current transports: export `research-task.json` (contract + local parse text/locators); or explicit owner-authenticated private staging → OAuth read-only MCP → ChatGPT → manual JSON import → pending → user acceptance. The MCP manifest supplies the same self-contained contribution schema. Export/import round-trip never bypasses owner/digest/locator/quote/time checks.

Audit clarification: a remote stage may contain an explicitly confirmed subset of parsed sources from one original batch. `sourceMetadata` is the entire authorized set for that stage; omitted source identities/content are not uploaded. Failed originals remain local and downloadable. Bundle `sourceRefs` may cover a subset of the original batch, retaining original batch/source IDs and SHA-256; references to failed sources or citations outside the bundle's declared source set are rejected. Offline bundles do not require a remote stage. Parsed-text SHA-256 covers UTF-8 JSON of segments in fixed field order `locator`, `label`, `text`; local canonical object key sorting must not alter that wire order. Original-byte SHA-256 remains independent.

Obsidian remains an existing read-only Markdown projection. Full Wiki backup does not contain original-file bytes; retain/download those independently. Origin/profile changes, browser data clearing and browser storage eviction can remove local data; this is not cloud backup.

See [D0 and delivery](../../../docs/stage-4-3-slice-2-5-knowledge-ingestion.md), [private Bridge operations](../../../docs/research-bridge-readonly-v1.md), and [Chinese first-use rules](../../../docs/research-memory-chinese-first-use-v1.md).
