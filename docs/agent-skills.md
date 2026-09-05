# Agent Skills Registry

> Purpose: define which external Coding Agent skills are intentionally part of this repository's workflow, when they should trigger, how they are installed, and how updates are audited.
>
> This registry is deliberately small. GPT-6-class models are more sensitive to skill instructions, so adding a skill is a governance change, not a casual convenience.

## 1. Current policy

Codex discovers repo-local skills under `.agents/skills/<name>/SKILL.md` and loads only skill metadata until the skill triggers. The root `AGENTS.md` remains the project-level authority for task routing and hard invariants.

Do not install broad skill packs by default. Every always-available repo skill should have a concrete recurring use case in this project.

The project-specific coordinator is:

- `investment-dashboard-ui-workflow`
  - maintained and tracked in this repository;
  - automatically relevant for substantive frontend design / redesign / polish work;
  - coordinates project constraints with the external skills below.

The root `PRODUCT.md` is a compact Impeccable compatibility bridge containing durable product truth. It is not a second roadmap or contract source; its precedence is explicitly subordinate to `AGENTS.md`, the current V2 freeze / audit documents and `contracts/v1`.

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

The repository already supplies `PRODUCT.md`, so Impeccable should not need to bootstrap product truth before ordinary UI work. Do not run `impeccable init` automatically. Creating or materially rewriting `PRODUCT.md`, `DESIGN.md` or other design-governance files is a separate governance task that requires explicit authorization and review.

Impeccable supports project hook manifests, but the managed bootstrap intentionally uses `--no-hooks`. Third-party hooks are **not part of the default project baseline**. Enabling an Impeccable hook later requires a separate explicit review of the hook definition and its side effects.

## 3. Installation and verification

Use the repository scripts:

```bash
npm run agent:skills:setup
npm run agent:skills:check
```

The setup command installs project-local copies under `.agents/skills/` using pinned versions/sources where supported. Project scope is intentional so Codex can discover the same workflow without depending on a developer's global configuration.

The two managed third-party skill directories are intentionally gitignored:

- `.agents/skills/redesign-existing-projects/`
- `.agents/skills/impeccable/`

This keeps the worktree clean after setup while the tracked project-owned coordinator remains versioned. Fresh clones therefore run setup once before using the external skills. Day-to-day tasks run `agent:skills:check`; they do not reinstall or update skills automatically.

Impeccable 4.0.1 requires Node `>=22.18.0`; the bootstrap checks this before attempting the Impeccable install.

After an install, restart / reload Codex so it rediscovers skills.

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
2. identify new mandatory, blocking, hook-related or confirmation-seeking instructions;
3. check for conflicts with `AGENTS.md`, `PRODUCT.md`, the current stack and dashboard information density;
4. update this registry and setup script together;
5. run a representative frontend task or read-only audit to confirm behavior;
6. merge the upgrade through the normal feature-branch / independent-review flow.

This keeps skill changes auditable and prevents upstream instruction drift from silently changing GPT/Codex behavior.