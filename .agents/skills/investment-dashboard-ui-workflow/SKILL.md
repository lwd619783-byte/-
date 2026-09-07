---
name: investment-dashboard-ui-workflow
description: Project-specific UI coordinator for substantive investment-dashboard creation, redesign, polish, responsiveness and visual-quality work. Routes to Taste or the project Impeccable facade when needed; ordinary copy, spacing or small CSS edits do not trigger an external quality pass.
---

# Investment Dashboard UI Workflow

Use this Skill as the project-level coordinator for substantive UI work. Project data / business semantics remain defined by root `AGENTS.md`, current product sources and contracts; this Skill only adds UI-specific context and routing.

## Context

Read:

- root `AGENTS.md`;
- `docs/agent-skills.md` 的 UI 使用边界，仅在调用对应外部 Skill 时读取；
- the target feature code and the smallest relevant product / architecture context.

## Design baseline

Treat the product as a dense personal investment research terminal, not a marketing site.

- Dark, technical research-terminal identity.
- High information density with strong hierarchy rather than decorative whitespace.
- Facts, status, warnings, evidence and user judgments remain visually distinguishable.
- Desktop research efficiency with usable narrow-screen behavior.
- Motion is restrained and should improve orientation or feedback.
- Charts, tables, filters and research content take priority over visual novelty.

Task-specific visual references may define the art direction while the project's business and data semantics remain intact.

## External Skill routing

- **Major existing-Dashboard redesign:** use Taste `redesign-existing-projects` when installed and useful for diagnosis / redesign direction.
- **Major UI quality finishing:** only when critique, accessibility, responsive behavior, edge states or polish materially require Impeccable, select [investment-dashboard-impeccable-workflow](../investment-dashboard-impeccable-workflow/SKILL.md). The facade then reads the needed pinned upstream mode; never route directly to the broad upstream entrypoint.
- Taste `design-taste-frontend` / `gpt-taste` are outside the managed set; do not install them as a side effect of UI work.
- Ordinary copy, spacing, small CSS or isolated component fixes do not activate the Impeccable facade; handle them within the original task.
- Do not automatically run `impeccable init`; replacing `PRODUCT.md` / `DESIGN.md` is a separate governance change.
- The existing React / Vite / Tailwind stack is the baseline. A UI Skill recommendation alone is not a reason to add dependencies.
- The facade uses `node scripts/run-codex-skill.mjs impeccable context` for the digest-verified `.agents/vendor/impeccable` engine; no PATH / home cache / download launcher fallback. No update checks, telemetry, hooks, MCP, live server, Agent configuration writes or automatic governance initialization.
- Do not load Domain / Local Core or diagram Skills for a UI-only task. Choose Taste or the project Impeccable facade only as needed; their presence does not require both passes.

## UI-specific verification

For a substantive UI change, verify the changed surface rather than relying only on source inspection:

- relevant component / integration checks and `npm run ui:audit` when applicable;
- responsive and interaction / edge states for affected layouts;
- rendered visual result when browser or screenshot tooling is available;
- continued representation of research density, status and provenance concepts after visual refactoring.

The goal is a more intentional, legible and efficient research interface, not maximum decoration.
