---
name: investment-dashboard-ui-workflow
description: Project-specific frontend workflow for the investment research dashboard. Use for creating, redesigning, polishing, auditing, or visually refactoring dashboard pages/components where UI quality matters. Coordinates the project's design constraints with Taste Skill and Impeccable when installed.
---

# Investment Dashboard UI Workflow

Use this skill for substantive UI work in this repository. It is the project-specific coordinator; external design skills are advisory layers and may not override the user's current instructions, root `AGENTS.md`, product contracts, business behavior, accessibility, or data semantics.

## Read first

1. Read the root `AGENTS.md` UI / skill policy.
2. Read `docs/agent-skills.md` for managed external skill versions and invocation rules.
3. Read the target feature code plus the smallest relevant design / architecture documents.
4. Preserve existing product behavior unless the current task explicitly changes it.

## Project design baseline

Treat this product as a dense personal investment research terminal, not a marketing site.

Default qualities:
- dark, technical, research-terminal identity;
- high information density with strong hierarchy rather than decorative whitespace;
- clear distinction between facts, status, warnings, evidence and user judgments;
- desktop-first efficiency while retaining narrow-screen usability;
- restrained motion that improves orientation or feedback;
- charts, tables, filters and research content remain legible before visual novelty;
- visual polish must not hide missing / partial / stale / conflicted states.

User-supplied visual references and explicit task-specific art direction take precedence over these defaults where they do not violate product invariants.

## External skill routing

### Existing dashboard redesign or substantial visual upgrade

If installed, use `redesign-existing-projects` from Taste Skill as the first external design pass.

Purpose:
- scan the existing stack and design patterns;
- identify generic AI-looking patterns and weak hierarchy;
- propose targeted improvements without framework migration or functionality rewrite.

Do not automatically substitute Taste's general `design-taste-frontend` or `gpt-taste` for dashboard work. Those variants are for different visual contexts and may over-prioritize landing-page composition or aggressive motion.

### UI critique, audit, polish, accessibility or finishing pass

If installed, use `impeccable` after the implementation direction is understood.

Preferred modes by intent:
- audit / technical quality: `impeccable audit`;
- UX and hierarchy review: `impeccable critique`;
- final refinement: `impeccable polish`;
- responsive behavior: `impeccable adapt`;
- robustness / edge states: `impeccable harden`;
- motion only when explicitly useful: `impeccable animate`.

Do not run `impeccable init` automatically in this mature repository. The project already has durable product and architecture sources. Only create or replace `PRODUCT.md` / `DESIGN.md` when the current task explicitly authorizes that governance change.

### When to use both

For a major existing-page redesign:
1. establish current product behavior and constraints;
2. run the Taste redesign pass for visual direction and targeted changes;
3. implement with the existing React / Vite / Tailwind stack unless the task requires otherwise;
4. run Impeccable critique / audit / polish as a second-pass quality gate;
5. visually verify the rendered result when browser or screenshot tooling is available.

For a small CSS fix, copy tweak, spacing bug, or isolated component defect, do not invoke two heavyweight skills merely because they exist. Use the minimum skill set that materially improves the result.

## Conflict rules

- User instructions for the current task outrank style preferences in an external skill.
- Root `AGENTS.md` hard invariants and frozen product / data contracts remain binding unless the task explicitly changes those governance sources.
- Existing framework, dependencies and design behavior are evidence, not disposable defaults.
- A skill must not invent financial data, replace missing states with fabricated content, or change data semantics for visual completeness.
- A skill must not force a new UI library, animation library, font package or design system merely because it recommends one. New dependencies require a task-level justification and normal validation.
- A skill must not remove dense information, tables, controls or status details solely to make the interface look more like a marketing page.
- If a skill instruction would cause work to stop, request unnecessary confirmation, or materially diverge from the user's task, identify the exact skill and conflicting instruction in the delivery report and follow the higher-priority project instruction.

## UI validation

Choose validation proportional to the change:
- run relevant component / integration tests;
- run `npm run ui:audit` when its checks cover the changed surface;
- run typecheck / build when the UI change can affect compilation or bundling;
- inspect responsive states and interaction states for substantive layout changes;
- visually inspect the rendered page when browser tooling is available;
- confirm no data/status semantics were lost during visual refactoring.

The goal is not maximum decoration. The goal is a more intentional, legible, efficient and distinctive research interface without breaking research workflows.
