# UI Display Audit Report

Generated: 2026-07-02T16:01:05.137Z

## Scope
- Widths checked in the responsive checklist: 1920, 1440, 1280, 1024, 768, 390.
- Pages/components checked: 宏观 / 行业 / 个股池 / 观察清单 / 个股详情抽屉.
- Screenshot directory prepared: `docs/ui-screenshots/`.
- This lightweight audit is static. It does not create screenshots because the project does not include a browser automation dependency.

## Visual System Changes
- Tailwind tokens now expose bg/bg2/bg3, surface/surface2/surface3, card/cardHover, border/borderSoft/borderGlow, text/textStrong/textMuted/textWeak, cyan/blue/violet/amber, rise/fall/neutral, danger/success/warning.
- Header, nav, tables, cards, drawer, watchlist, and macro chart surfaces use the dark token family instead of white or low-contrast slate text.
- Active and hover states now use cyan glow/border cues and visible focus rings.

## Overflow / Overlap Fixes
- Header coverage summary is split into compact badges.
- Stock cards clamp leader text, thesis, source strings, update timestamps, and tags.
- Stock pool table is fixed-width with horizontal scroll; industry, segment, and thesis cells truncate or clamp with title tooltips.
- Stock detail drawer is widened to 920px on desktop; long sourceEndpoint/URL-like values use break-all.
- Reports and announcements clamp titles to two lines; empty price history renders a stable empty state.
- Industry tab buttons and segment buttons use bounded widths and title attributes.

## Width Checklist
| Width | Expected Result |
| --- | --- |
| 1920px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 1440px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 1280px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 1024px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 768px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |
| 390px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |

## Static Findings
- No high-risk legacy light-theme classes found in audited files.

## Remaining Manual Checks
- Use the running Vite URL to visually confirm exact text density at 390px and 768px.
- Open a stock detail drawer and verify the long data source endpoint wraps instead of pushing the drawer.
- Toggle Mock / Mixed / Real data modes and confirm Header badges remain compact.
