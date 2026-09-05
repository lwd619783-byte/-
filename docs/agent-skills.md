# Agent Skills Registry

> Purpose: define which external Coding Agent skills are intentionally part of this repository's workflow, when they should trigger, how they are installed, and how updates are audited.
>
> This registry is deliberately small. GPT-6-class models are more sensitive to skill instructions, so adding a skill is a governance change, not a casual convenience.

## 1. Current policy

Codex discovers repo-local skills under `.agents/skills/<name>/SKILL.md` and loads only skill metadata until the skill triggers. The root `AGENTS.md` remains the project-level authority for task routing and hard invariants.

Do not install broad skill packs by default. Every always-available repo skill should have a concrete recurring use case in this project.

The project-specific coordinator is:

- `investment-dashboard-ui-workflow`
  - maintained in this repository;
  - automatically relevant for substantive frontend design / redesign / polish work;
  - coordinates project constraints with the external skills below.

## 2. Managed external UI skills

### A. Taste Skill — `redesign-existing-projects`

Upstream:
- repository: `Leonxlnx/taste-skill`
- pinned upstream commit: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`
- upstream skill path: `skills/redesign-skill/SKILL.md`
- installed skill name: `redesign-existing-projects`

Why this variant:
- this repository is an existing React/Vite/Tailwind dashboard, not a greenfield marketing page;
- the upstream default `design-taste-frontend` explicitly says it is not for dashboards / data tables / multi-step product UI;
- `redesign-existing-projects` is audit-first, works with an existing stack and targets incremental visual upgrades without rewriting functionality.

Use when:
- redesigning an existing page or major component;
- improving hierarchy, density, typography, layout, states or visual distinctiveness;
- removing generic AI UI patterns while preserving current behavior.

Do not auto-use for:
- tiny CSS fixes;
- data-only / backend tasks;
- ordinary component bug fixes where visual direction is not material.

`design-taste-frontend` and `gpt-taste` are not part of the default repo workflow. They may be invoked explicitly for a landing page, experimental cover page or other task whose brief actually matches those skills.

### B. Impeccable — `impeccable`

Upstream:
- repository: `pbakaus/impeccable`
- pinned installer version: `impeccable@4.0.1`
- audited upstream commit at adoption: `8dac6ae7e020c43ab10ce9b41939f6fd42627b96`
- installed skill name: `impeccable`

Use when:
- auditing UI accessibility, responsive behavior, interaction states or technical polish;
- critiquing hierarchy / clarity;
- hardening empty, loading, error and edge states;
- running a final visual-quality pass after a substantial redesign.

Preferred commands:
- `impeccable audit`
- `impeccable critique`
- `impeccable polish`
- `impeccable adapt`
- `impeccable harden`

Do not run `impeccable init` automatically. This repository already has mature product, architecture and contract sources. Creating a new `PRODUCT.md` or replacing design-governance files is a separate governance task that requires explicit authorization and review.

Impeccable can install a Codex project hook. Hook trust is a local Codex decision and must not be silently assumed. The skill remains usable without treating unapproved hooks as active.

## 3. Installation and verification

Use the repository scripts:

```bash
npm run agent:skills:setup
npm run agent:skills:check
```

The setup command installs project-local copies under `.agents/skills/` using pinned versions/sources where supported. Project scope is intentional so the same workflow travels with the repository instead of depending on a developer's global Codex configuration.

After an Impeccable install or update, restart / reload Codex so it rediscovers skills. If using the Impeccable Codex hook, inspect `/hooks` and approve it explicitly when prompted.

## 4. Invocation order for frontend work

For a major existing-dashboard redesign:

1. Read root `AGENTS.md`, this registry, relevant feature docs and current implementation.
2. Use `investment-dashboard-ui-workflow` as the project coordinator.
3. Use `redesign-existing-projects` for the first redesign / diagnosis pass when installed.
4. Implement only the task-authorized changes using the existing stack unless a dependency change is justified.
5. Use `impeccable` for critique / audit / polish.
6. Run relevant automated checks and visually verify the rendered result when tooling is available.

For audit-only work, Impeccable may be used without the Taste redesign skill. For small fixes, neither external skill is mandatory unless it clearly adds value.

## 5. Precedence and conflict policy

External skill instructions are advisory workflow instructions inside the project hierarchy. They do not override:

1. explicit current-task user instructions;
2. root `AGENTS.md` hard invariants;
3. frozen data / permission / business contracts;
4. existing product behavior that the current task did not authorize changing.

If an external skill conflicts with one of those sources, follow the higher-priority source and report the conflict rather than silently combining incompatible rules.

A style skill may never justify:
- inventing financial data or hiding missing / stale / partial states;
- changing Point-in-Time semantics;
- replacing dense research content with marketing-style whitespace for aesthetics alone;
- adding a framework, design system, animation library or font package merely because the skill prefers it;
- rewriting unrelated pages or business flows.

## 6. Upgrade policy

Do not auto-update these skills on every install.

An external skill upgrade is an instruction-set change. Before changing the pinned source/version:

1. review the upstream changelog / diff;
2. identify new mandatory, blocking or confirmation-seeking instructions;
3. check for conflicts with `AGENTS.md`, current stack and dashboard information density;
4. update this registry and setup script together;
5. run a representative frontend task or read-only audit to confirm behavior;
6. merge the upgrade through the normal feature-branch / independent-review flow.

This keeps skill changes auditable and prevents upstream instruction drift from silently changing GPT/Codex behavior.