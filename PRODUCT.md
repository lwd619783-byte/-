# Product

<!-- impeccable:product-schema 1 -->

> Compact product context for UI / design agents. This file records durable product facts, not Agent behavior or contract precedence. Project routing and hard invariants live in `AGENTS.md`; detailed V2 decisions and machine semantics live in the current freeze / audit documents and `contracts/v1`.

## Platform

web

## Users

The primary user is an individual investor / researcher using the product as a recurring personal research workspace and asset operating system.

## Product Purpose

The product turns investment research into an auditable operating workflow:

`Macro / Market Regime → Industry → Thesis → Company verification → Evidence → Investment expression → Portfolio / DCA → Event verification → Review`

Long-term direction: **Personal Investment Research & Asset OS**.

## Product Shape

- Existing React / Vite / TypeScript / Tailwind application designed as a dense research terminal.
- A-share and Hong Kong research coexist with macro / Market Regime, evidence and review workflows.
- Current implementation and staged V2 contracts coexist; use `docs/feature-registry.md` and `docs/architecture.md` to understand what exists today.
- ChatGPT / Research Bridge contributions are controlled inputs to research workflows, not an autonomous trading system.
- V2 asset / portfolio / DCA direction is local-first with explicit backup / restore semantics.

## UI Baseline

- Dense and legible, with strong hierarchy; do not turn research surfaces into marketing-page composition.
- Charts, tables, evidence, controls and research detail are first-class interface content.
- Facts, derived outputs, user judgments, provenance and operational states such as missing / partial / stale / conflicted are product-visible concepts.
- Use task-specific visual references as design direction without inventing unsupported data, coverage or capabilities.

## Product Evidence

- Current behavior: source code, tests, `docs/feature-registry.md`, `docs/architecture.md`.
- V2 product / architecture decisions: current Research OS, asset-management, contract-freeze and final-audit documents.
- Machine-readable semantics: `contracts/v1`.
- Agent / Skill routing: `AGENTS.md`, `docs/agent-skills.md`, `.agents/skills/investment-dashboard-ui-workflow/SKILL.md`.
