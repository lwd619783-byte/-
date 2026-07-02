# Investment Dashboard Terminal Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing investment research dashboard into a more professional dark research terminal without changing data flow or deployment.

**Architecture:** Add focused presentation components under `src/components/common/`, then compose them in `App.tsx`, `Header`, tab pages, and stock components. Existing services, types, generated JSON, tests, and Vercel settings remain intact.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Recharts, Vitest, Vercel.

---

## File Structure

- Create `src/components/common/DashboardCard.tsx`: terminal card shell for sections and KPI blocks.
- Create `src/components/common/SectionHeader.tsx`: consistent section titles, subtitles, and actions.
- Create `src/components/common/KpiCard.tsx`: reusable KPI card with direction cue, value, delta, and explanation.
- Create `src/components/common/ChartPanel.tsx`: chart frame with title, copy, legend, and empty state.
- Create `src/components/common/FilterBar.tsx`: common toolbar wrapper for stock filters.
- Create `src/components/common/EmptyState.tsx`: polished empty/loading/error placeholder.
- Create `src/components/common/DataTable.tsx`: responsive table shell and optional mobile card container.
- Modify `src/components/common/terminal.tsx`: compatibility exports.
- Modify `src/App.tsx`: first-viewport overview, improved nav, KPI summary, insight rail.
- Modify `src/components/layout/Header.tsx`: title area, explanatory copy, badges, mode controls.
- Modify `src/components/stock/StockPool.tsx`: filter toolbar, desktop table, mobile card fallback.
- Modify `src/components/stock/StockCard.tsx`: clearer hierarchy and compact terminal card behavior.
- Modify `src/components/stock/StockDetailDrawer.tsx`: grouped research-card panels and long text safety.
- Modify `src/components/industry/IndustryTab.tsx`, `MacroTab.tsx`, `WatchlistTab.tsx`: use common section/card patterns.
- Modify `src/index.css` and `tailwind.config.js` only if token polish is needed.

## Tasks

### Task 1: Shared UI Components

- [ ] Add `DashboardCard`, `SectionHeader`, `KpiCard`, `ChartPanel`, `FilterBar`, `EmptyState`, and `DataTable`.
- [ ] Export them from `src/components/common/terminal.tsx`.
- [ ] Keep props simple and typed: no dependency on business data types.
- [ ] Run `npm run build`; expected: TypeScript passes.

### Task 2: First-Viewport Dashboard Shell

- [ ] Modify `Header.tsx` to include purpose copy and compact status metadata.
- [ ] Modify `App.tsx` to compute coverage, missing, recent update, and real quote KPIs from `dataset.stocks`.
- [ ] Replace the current top stat strip with `KpiCard` summary and a concise right insight rail.
- [ ] Keep tab IDs and tab rendering unchanged.
- [ ] Run `npm run build`; expected: TypeScript passes.

### Task 3: Stock Pool and Tables

- [ ] Wrap filters with `FilterBar`.
- [ ] Use `DataTable` for the desktop table shell.
- [ ] Add a mobile card list under the table breakpoint.
- [ ] Preserve all existing filters, sort modes, and `onOpenStock` behavior.
- [ ] Run `npm run test`; expected: existing filter/provider tests pass.

### Task 4: Chart and Detail Presentation

- [ ] Use `ChartPanel` in `MacroTab` and `StockDetailDrawer`.
- [ ] Ensure chart axes and tooltips remain dark-mode readable.
- [ ] Use `EmptyState` for absent price history and empty watchlist/filter results.
- [ ] Keep long endpoints and article URLs wrapped or clamped.
- [ ] Run `npm run build`; expected: TypeScript passes.

### Task 5: Final Verification and Deployment

- [ ] Run `npm run data:validate:a-stock`; expected: errors=0.
- [ ] Run `npm run test`; expected: all existing tests pass.
- [ ] Run `npm run ui:audit`; expected: report written and no high-risk light-theme classes.
- [ ] Run `npm run build`; expected: `dist` generated.
- [ ] Commit and push changes.
- [ ] Deploy to Vercel and verify the public URL returns 200 and assets return 200.

## Self-Review

- Spec coverage: all requested areas map to tasks: visual system, hierarchy, KPI cards, charts, filters, tables, states, responsive behavior, code quality, and deployment verification.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: all planned components are presentational and exported from the existing compatibility barrel.
