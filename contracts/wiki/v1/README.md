# Wiki Domain V1

> 2026-09-22 [R0](../../../docs/stage-4-3-r0-external-knowledge-rebaseline.md)：FREEZE / LEGACY COMPATIBILITY：V1 local authority 仅管理 Legacy lane 的本地对象（含经既有审核流程新增/修订）；不镜像 Notion 正文。现有 schema、permissions、persistence 与审核规则不变；外部 context 不能单独晋升 Verified Claim。

Additive L2 Research Memory contract. `wiki.schema.json` references the unchanged Slice 1 Source/Extraction/RelatedRefs definitions and F2 `Pin`. The eight entry types share one versioned envelope. This does not change `contracts/v1` permissions, Evidence, Verified Claim, Thesis, Creator or production admission.

- `WikiEntry`: immutable `wikiId`, type and creation instant. Identity is independent of title and projected filename.
- `WikiRevision`: append-only content, refs, origin and knowledge cutoff. Revisions form one acyclic chain per entry. `asOf <= createdAt`; predecessor cutoffs never move backwards. Source/Extraction refs resolve at the revision cutoff.
- `WikiReview`: separate append-only user quality decision, exact revision, review ID and matching `approvalRef`. First decision is reviewed or rejected; no second decision silently overwrites it. An explicit archive points to the original reviewed decision. Re-review needs a new revision. Import/recovery requires an explicit user confirmation and a pre-write backup.
- Current: latest knowledge-visible approved chain member; drafts and rejections do not displace it. An archive tombstone does not revive an older page. Formal current Wiki refs must resolve to active reviewed targets; invalid references close the read/projection gate.
- Review requires at least one Source, Extraction or Evidence ref. Orphan means no incoming/outgoing formal Wiki links; it does not mean source-free knowledge. Source uncertainty and extraction review status remain visible. AI authoring remains `ai_draft` after review.

Validation is closed schema **and** history semantics **and** owner resolution. A schema-valid imported ref is not owner authority. The browser uses the existing Creator adapter and byte-checked Industry Registry Evidence; unavailable Entity Registry owners and unknown source domains fail closed. Future adapters must resolve original identity rather than registering arbitrary strings as owners.

`scripts/contracts/wiki.mjs` reproducibly compiles the browser validator, including schema digests. `contracts:validate` checks drift; `test:contracts` includes independent Ajv/schema and standard YAML parser tests. The `yaml` dev dependency is only a test parser and is not part of the browser renderer.

The repository has no Markdown import or write-back method. A JSON backup includes every Wiki entry/revision/review, including rejected, draft and archived history; original Source/Evidence owner backups remain independently necessary. Vault export is a reviewed read projection and is not a backup.

See [Slice 2 delivery and limits](../../../docs/stage-4-3-slice-2-llm-wiki.md).
