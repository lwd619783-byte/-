# Product

<!-- impeccable:product-schema 1 -->

> This file is a compact compatibility bridge for Impeccable and other design agents. It records durable product facts only. It is **not** an independent product roadmap or contract authority. For task routing, hard invariants and source-of-truth precedence, read `AGENTS.md`; for V2 product decisions and machine-readable semantics, use the current V2 freeze/audit documents and `contracts/v1`.

## Platform

web

## Users

The primary user is an individual investor/researcher using the product as a personal research workspace and asset operating system. The interface supports repeated macro, industry, company, evidence, portfolio and review workflows rather than one-off content consumption.

## Product Purpose

The product turns investment research into an auditable operating workflow:

`Macro / Market Regime → Industry → Thesis → Company verification → Real data & evidence → Investment expression → Portfolio / DCA → Event verification → Review`

Its long-term direction is **Personal Investment Research & Asset OS** rather than a market-data display page alone.

## Positioning

The product combines research reasoning, evidence provenance, Point-in-Time data discipline, controlled ChatGPT / Research Bridge ingestion, portfolio / DCA records and local-first persistence in one auditable workflow. Research conclusions and asset actions remain traceable to their underlying facts, time semantics and user confirmation boundaries.

## Operating Context

- Existing React / Vite / TypeScript / Tailwind web application used as a dense research terminal.
- A-share and Hong Kong stock research coexist with macro / Market Regime and evidence workflows.
- Current implemented features and future V2 contracts coexist; `implemented`, `contract passed` and `production admitted` are distinct states.
- Future ChatGPT contributions enter through controlled Research Bridge / contract flows rather than unrestricted database writes.
- V2 asset / portfolio / DCA storage is local-first, with explicit backup / restore and audit boundaries.

## Capabilities and Constraints

- Preserve the distinction between Provider facts, user judgments, AI research and derived outputs.
- Do not fabricate missing financial or market data or silently replace real fields with mock values.
- Preserve Point-in-Time availability, provenance, revisions and append-only history where the contracts require them.
- Missing / partial / stale / conflicted / not-implemented states must remain visible when semantically required.
- AI / Research Bridge does not receive unrestricted SQL, hard-delete authority or real-trading authority.
- User confirmation remains required where frozen contracts require it, including formal asset-ledger and restore operations.
- UI redesign must preserve research information density and business semantics unless the current task explicitly changes them.

## Evidence on Hand

Canonical evidence lives in the repository rather than in invented design copy:

- current implementation: source code, tests, `docs/feature-registry.md`, `docs/architecture.md`;
- V2 product / architecture decisions: current V2 Research OS, asset-management, contract-freeze and final-audit documents;
- machine-readable semantics: `contracts/v1`;
- Agent / design-skill governance: `AGENTS.md`, `docs/agent-skills.md`, `.agents/skills/investment-dashboard-ui-workflow/SKILL.md`.

Future UI work must not invent testimonials, financial metrics, data coverage, provider admission or product capabilities that these sources do not support.

## Product Principles

1. **Truth before completeness.** Missing or uncertain data is better than fabricated certainty.
2. **Research must remain auditable.** Evidence, provenance, time semantics and revisions are first-class product concerns.
3. **Decision support, not autonomous trading.** AI can structure and assist research but does not bypass user-controlled investment actions.
4. **Dense but legible.** The interface should improve research efficiency and hierarchy without turning an information-rich terminal into a marketing page.
5. **Local-first with controlled side effects.** Persistent writes, imports, backup and restore follow explicit contracts and confirmation boundaries.
