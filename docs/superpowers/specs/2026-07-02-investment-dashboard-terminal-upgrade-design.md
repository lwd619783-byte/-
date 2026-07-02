# Investment Dashboard Terminal Upgrade Design

## Direction

Use the approved **A: 深色研究终端** direction. Keep the current Vite/React data flow, data providers, generated JSON, Vercel deployment, and route behavior unchanged. The work is presentation-focused: improve visual hierarchy, information density, readability, responsive behavior, and reusable UI components.

## Experience Goals

- The first viewport should immediately communicate that this is an investment research dashboard for monitoring coverage, market movement, risks, watchlist items, and research signals.
- The UI should feel like a restrained research terminal: dark surfaces, disciplined borders, compact spacing, clear typography, and consistent semantic colors.
- KPI cards should show a label, primary value, directional change, and short explanation. Positive and negative states must use both color and text/icon cues.
- Charts, tables, filters, and empty states should share consistent containers and copy.
- Mobile layouts should collapse to single-column cards and avoid page-level horizontal overflow.

## Implementation Boundaries

- Do not change stock, industry, macro, watchlist, provider, validation, or generated JSON schemas.
- Do not introduce a backend, new data fetching, tokens, cookies, or cloud scraping.
- Prefer adding small reusable display components under `src/components/common/`.
- Keep the existing tab set: 宏观 / 行业 / 个股池 / 观察清单.
- Preserve existing Vercel deployment files.

## Target UI Structure

- Header: title, short purpose sentence, data mode control, updated time, compact data coverage badges.
- Dashboard overview: KPI cards for coverage, real quote count, missing-field count, and recently updated count, plus a risk/research snapshot.
- Main layout: left tab navigation on desktop, top-scrolling navigation on smaller screens, central content, right insight rail on desktop.
- Stock pool: toolbar filters, professional table on desktop, compact stock cards on mobile.
- Detail drawer: widened research-card structure with grouped panels, readable long endpoints, chart empty state, and report title clamps.

## Verification

Run:

- `npm run build`
- `npm run data:validate:a-stock`
- `npm run test`
- `npm run ui:audit`

Then deploy to Vercel and verify the public URL returns 200 and assets load.
