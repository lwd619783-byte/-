import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const docsDir = path.join(root, "docs");
const screenshotDir = path.join(docsDir, "ui-screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

const filesToScan = [
  "src/App.tsx",
  "src/index.css",
  "src/styles/theme-tokens.css",
  "src/components/home/HomePage.tsx",
  "src/components/research/ResearchEventCenter.tsx",
  "src/components/expectation/EarningsExpectationCenter.tsx",
  "src/components/common/Modal.tsx",
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

const widths = [1920, 1600, 1440, 1280, 1024, 768, 390, 320];
const pages = ["首页", "宏观", "行业", "个股池", "公司研究五标签", "观察清单", "验证中心", "预期证据"];

const report = `# UI Display Audit Report

Generated: ${new Date().toISOString()}

## Scope
- Planned responsive checklist (not measured by this command): ${widths.join(", ")}.
- Static source surfaces: ${pages.join(" / ")}.
- Screenshot directory prepared: \`docs/ui-screenshots/\`.
- This lightweight audit is static. It does not create screenshots because the project does not include a browser automation dependency.

## Scope limitations
- This scan only detects the listed legacy color classes in the listed source files.
- It does not certify contrast, focus, layout, business state, persistence, or browser behavior.
- NEON-RC1 uses one shared component tree with neon / pro / light display tokens.
- The frozen design and actual UI V1 browser evidence are indexed in [implementation acceptance](ui-redesign/v1/implementation/acceptance.md).
- Historical drawer dimensions and expected truncation rules are not runtime findings for the new five-tab company page.

## Width Checklist
| Width | Expected Result |
| --- | --- |
${widths.map((width) => `| ${width}px | Header badges wrap, main grid remains readable, tables scroll inside their container, no page-level horizontal overflow expected. |`).join("\n")}

## Static Findings
${findings.length ? findings.join("\n") : "- No high-risk legacy light-theme classes found in audited files."}

## Runtime checks
- Verify the screenshot matrix, 320px, 200% zoom, keyboard, reduced motion and abnormal states in the separate acceptance evidence.
- Verify independent theme/data modes and unchanged business exports with actual browser interactions.
- No runtime PASS is inferred from this static command.
`;

fs.writeFileSync(path.join(docsDir, "ui-display-audit-report.md"), report, "utf8");
fs.writeFileSync(path.join(screenshotDir, ".gitkeep"), "", "utf8");
console.log(`UI audit written to ${path.join("docs", "ui-display-audit-report.md")}`);
if (findings.length) {
  console.log(findings.join("\n"));
}
