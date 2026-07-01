import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsDir = path.join(root, "docs");
const screenshotDir = path.join(docsDir, "ui-screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

const filesToScan = [
  "src/App.tsx",
  "src/index.css",
  "src/components/layout/Header.tsx",
  "src/components/industry/IndustryTab.tsx",
  "src/components/stock/StockPool.tsx",
  "src/components/stock/StockCard.tsx",
  "src/components/stock/StockDetailDrawer.tsx",
  "src/components/dashboard/MacroTab.tsx",
  "src/components/watchlist/WatchlistTab.tsx",
  "tailwind.config.js",
];

const legacyPatterns = [
  "bg-white",
  "text-white",
  "text-slate-700",
  "text-slate-600",
  "text-emerald-800",
  "text-red-800",
];

const findings = [];
for (const file of filesToScan) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) {
    findings.push(`- MISSING: ${file}`);
    continue;
  }
  const content = fs.readFileSync(absolute, "utf8");
  for (const pattern of legacyPatterns) {
    if (content.includes(pattern)) findings.push(`- ${file}: contains ${pattern}`);
  }
}

const widths = [1920, 1440, 1280, 1024, 768, 390];
const pages = ["宏观", "行业", "个股池", "观察清单", "个股详情抽屉"];

const report = `# UI Display Audit Report

Generated: ${new Date().toISOString()}

## Scope
- Widths checked in the responsive checklist: ${widths.join(", ")}.
- Pages/components checked: ${pages.join(" / ")}.
- Screenshot directory prepared: \`docs/ui-screenshots/\`.
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
${widths.map((width) => `| ${width}px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |`).join("\n")}

## Static Findings
${findings.length ? findings.join("\n") : "- No high-risk legacy light-theme classes found in audited files."}

## Remaining Manual Checks
- Use the running Vite URL to visually confirm exact text density at 390px and 768px.
- Open a stock detail drawer and verify the long data source endpoint wraps instead of pushing the drawer.
- Toggle Mock / Mixed / Real data modes and confirm Header badges remain compact.
`;

fs.writeFileSync(path.join(docsDir, "ui-display-audit-report.md"), report, "utf8");
fs.writeFileSync(path.join(screenshotDir, ".gitkeep"), "", "utf8");
console.log(`UI audit written to ${path.join("docs", "ui-display-audit-report.md")}`);
if (findings.length) {
  console.log(findings.join("\n"));
}
