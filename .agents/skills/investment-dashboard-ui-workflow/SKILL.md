---
name: investment-dashboard-ui-workflow
description: Project-specific UI coordinator for substantive investment-dashboard creation, redesign, polish, responsiveness and visual-quality work. Routes to Taste or Impeccable when those Skills materially help.
---

# Investment Dashboard UI Workflow

Use this Skill as the project-level coordinator for substantive UI work. Project data / business semantics remain defined by root `AGENTS.md`, current product sources and contracts; this Skill only adds UI-specific context and routing.

## Context

Read:

- root `AGENTS.md`;
- `docs/agent-skills.md`;
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
- **Critique, accessibility, responsive behavior, edge states or polish:** use the relevant Impeccable mode when installed and useful.
- Taste `design-taste-frontend` / `gpt-taste` are not default Dashboard Skills; use them only for briefs that actually match those variants.
- Small CSS, copy, spacing or isolated component fixes do not require both external Skills.
- Do not automatically run `impeccable init`; replacing `PRODUCT.md` / `DESIGN.md` is a separate governance change.
- The existing React / Vite / Tailwind stack is the baseline. A UI Skill recommendation alone is not a reason to add dependencies.

## UI-specific verification

For a substantive UI change, verify the changed surface rather than relying only on source inspection:

- relevant component / integration checks and `npm run ui:audit` when applicable;
- responsive and interaction / edge states for affected layouts;
- rendered visual result when browser or screenshot tooling is available;
- continued representation of research density, status and provenance concepts after visual refactoring.

The goal is a more intentional, legible and efficient research interface, not maximum decoration.
