# Agent Skills Registry

> Registry of project-managed external Coding Agent Skills. Adding or upgrading a Skill changes the available instruction set and is therefore a governance change. Root `AGENTS.md` owns project routing and hard invariants; this file only records Skill selection, versions, installation and upgrade policy.

## 1. Project baseline

The tracked project coordinator is `investment-dashboard-ui-workflow`, stored under `.agents/skills/` and used for substantive Dashboard UI work.

`PRODUCT.md` is a compact compatibility bridge for UI / design agents. It records durable product context and is not a second roadmap or contract authority.

Do not install broad Skill packs by default. Managed Skills should have a recurring project-specific use case.

## 2. Managed external UI Skills

### Taste — `redesign-existing-projects`

- repository: `Leonxlnx/taste-skill`
- pinned upstream commit: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`
- upstream path: `skills/redesign-skill/SKILL.md`
- installed name: `redesign-existing-projects`

Use for substantial redesign of existing Dashboard pages or major components: hierarchy, density, typography, layout, states and visual distinctiveness while retaining the current application structure.

It is intentionally preferred over Taste's general `design-taste-frontend` / `gpt-taste` variants for ordinary Dashboard work. Those general variants are only relevant when the task itself is a landing page, experimental cover or another matching brief.

### Impeccable — `impeccable`

- repository: `pbakaus/impeccable`
- pinned installer: `impeccable@4.0.1`
- audited upstream commit at adoption: `8dac6ae7e020c43ab10ce9b41939f6fd42627b96`
- installed name: `impeccable`

Use for UI critique, accessibility, responsive behavior, interaction / edge states and final polish. Relevant modes include `audit`, `critique`, `polish`, `adapt` and `harden`.

The repository already supplies `PRODUCT.md`; do not automatically run `impeccable init`. Creating or materially replacing `PRODUCT.md`, `DESIGN.md` or another design-governance source is a separate governance change.

The managed bootstrap uses `--no-hooks`; third-party Impeccable hooks are not part of the project baseline.

## 3. Installation and verification

```bash
npm run agent:skills:check
npm run agent:skills:setup
```

`agent:skills:setup` is for first-time bootstrap or explicit recovery. It installs project-local pinned copies so Codex does not depend on a developer's global Skill configuration. The managed third-party directories are intentionally gitignored:

- `.agents/skills/redesign-existing-projects/`
- `.agents/skills/impeccable/`

Impeccable 4.0.1 requires Node `>=22.18.0`. Reload Codex after installation so Skills are rediscovered.

## 4. UI routing

- Substantive Dashboard UI work starts from `investment-dashboard-ui-workflow`.
- Use Taste when a real existing-page redesign benefits from a dedicated redesign pass.
- Use Impeccable when critique, accessibility, responsive / edge-state hardening or polish adds value.
- Small CSS, copy, spacing or isolated component fixes do not require external Skills merely because they are available.

External Skills provide UI workflow guidance; they do not define financial data semantics, permissions, contracts or production admission. New frameworks, design systems, animation libraries, fonts or hooks are not implied by Skill installation and require task-level justification when proposed.

## 5. Upgrade policy

Do not auto-update managed external Skills.

Before changing a pinned source or version:

1. review the upstream changelog / diff, especially new mandatory, blocking, confirmation-seeking or hook behavior;
2. check compatibility with `AGENTS.md`, `PRODUCT.md`, the current stack and Dashboard information density;
3. update this registry and the setup script together;
4. validate the new instruction set on a representative frontend task or read-only UI audit;
5. use the repository's normal feature-branch and independent-review flow.
