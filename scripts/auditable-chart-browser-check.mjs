/** Slice 2 acceptance: isolated UI-review only, installed Playwright + Edge. */
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.UI_REVIEW_ORIGIN || "http://127.0.0.1:4173";
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || "data-cache/stage-4-1b-slice-2/browser");
await fs.mkdir(output, { recursive: true });
const report = { baseline: "63208ce038f5222d10bfa471bc5d0a868fe2905e", generatedAt: new Date().toISOString(), checks: [], failures: [], pageErrors: [], screenshots: [], sourceDigestFormat: "UTF-8 with CRLF normalized to LF", sourceSha256: {} };
for (const file of ["src/services/chartAudit.ts", "src/services/stockProvider.ts", "src/utils/stockCoverage.ts", "src/types/index.ts", "src/utils/evidenceUrl.ts", "src/components/common/ChartPanel.tsx", "src/components/charts/ChartAuditPanel.tsx", "src/components/layout/ProductShell.tsx", "src/components/research/RelatedResearchEvidence.tsx", "src/components/stock/StockPriceHistoryChart.tsx", "src/components/stock/CompanyFinancialHistory.tsx", "src/components/home/HomePage.tsx", "src/components/stock/StockDetailDrawer.tsx", "src/ui-review/ChartAuditStateReview.tsx", "src/ui-review/fixtures.ts", "src/ui-review/UiReviewApp.tsx"]) report.sourceSha256[file] = createHash("sha256").update((await fs.readFile(file, "utf8")).replace(/\r\n/g, "\n")).digest("hex");
const browser = await chromium.launch({ channel: "msedge", headless: true });
function check(ok, name, detail) { report.checks.push({ name, ok, ...(detail === undefined ? {} : { detail }) }); if (!ok) report.failures.push(name); }
async function fits(page, name) { const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth })); check(geometry.document <= geometry.width, name, geometry); }
async function shot(page, name) { await page.screenshot({ path: path.join(output, `${name}.png`) }); report.screenshots.push(`${name}.png`); }
async function settle(page) { await page.waitForLoadState("networkidle"); await page.evaluate(() => document.fonts.ready); }
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => {
    window.__writes = [];
    for (const method of ["setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function(...args) { window.__writes.push([method, args[0]]); return original.apply(this, args); };
    }
  });
  const page = await context.newPage(); const dataRequests = []; let downloads = 0;
  page.on("pageerror", error => report.pageErrors.push(error.message));
  page.on("request", request => { if (/\/data\//.test(new URL(request.url()).pathname)) dataRequests.push(request.url()); });
  page.on("download", () => downloads++);
  for (const width of [1536, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const profile of ["full", "empty", "degraded"]) {
      for (const route of ["home", "company/ui-review-company-1/financials?from=home", "company/ui-review-company-1/valuation?from=home"]) {
        await page.goto(`${origin}/?ui-review=1&profile=${profile}#/${route}`); await settle(page);
        for (const theme of ["neon", "pro", "light"]) {
          await page.getByRole("combobox", { name: "外观" }).selectOption(theme);
          const name = `${width}-${profile}-${route.split("/").at(-1).split("?")[0]}-${theme}`;
          const shell = page.getByLabel("研究上下文");
          check(await shell.count() === 1 && (await shell.innerText()).includes("ui-review-company-1"), `shell context ${name}`);
          const panel = page.locator(".chart-audit").first();
          const summary = panel.locator(":scope > summary");
          if (!await panel.evaluate(element => element.open)) { await summary.focus(); await page.keyboard.press("Enter"); }
          check(await panel.evaluate(element => element.open), `keyboard audit disclosure ${name}`);
          check((await panel.innerText()).includes("当前图表没有可验证的 Evidence linkage"), `no invented linkage ${name}`);
          check((await panel.innerText()).includes("未证明 / unknown"), `PIT unknown ${name}`);
          check(await panel.getByRole("button").count() === 0, `no chart evidence action ${name}`);
          const contrasts = await panel.evaluate(element => {
            const luminance = color => {
              const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
              return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
            };
            const background = luminance(getComputedStyle(element).backgroundColor);
            return ["dt", "dd", ":scope > summary"].map(selector => {
              const foreground = luminance(getComputedStyle(element.querySelector(selector)).color);
              return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
            });
          });
          check(contrasts.every(ratio => ratio >= 4.5), `audit text contrast ${name}`, contrasts);
          if (route.includes("financials") && profile === "full") {
            const record = panel.locator("details").first();
            if (!await record.evaluate(element => element.open)) await record.locator("summary").click();
            const text = await record.innerText();
            check(["announcementDate", "fetchedAt", "generatedAt", "report revision", "CNY / 元", "partial"].every(value => text.includes(value)), `complete supplied metadata ${name}`);
          }
          await fits(page, `expanded audit fits ${name}`);
          if (theme === "neon" && profile === "full" && [1536, 390].includes(width) && route.includes("financials")) { await panel.locator(":scope > summary").scrollIntoViewIfNeeded(); await shot(page, `financial-audit-${width}`); }
          if (theme === "light" && profile === "degraded" && width === 320 && route.includes("valuation")) { await panel.scrollIntoViewIfNeeded(); await shot(page, "price-degraded-320-light"); }
          const trigger = shell.getByRole("button", { name: /公司相关证据/ });
          if (profile === "empty") check(await trigger.isDisabled(), `empty related evidence disabled ${name}`);
          else {
            await trigger.click(); const dialog = page.getByRole("dialog"); await dialog.waitFor();
            check((await dialog.innerText()).includes("ui-review-event-0"), `exact related event identity ${name}`);
            await page.keyboard.press("Shift+Tab");
            check(await dialog.evaluate(element => element.contains(document.activeElement)), `drawer focus trapped ${name}`);
            await fits(page, `drawer fits ${name}`);
            await page.keyboard.press("Escape");
            check(await dialog.count() === 0 && await trigger.evaluate(element => element === document.activeElement), `focus restored ${name}`);
          }
          check((await page.evaluate(() => window.__writes)).length === 0, `no storage writes ${name}`);
        }
      }
    }
  }
  // Selected object, exact event navigation, deep links, and browser history.
  await page.goto(`${origin}/?ui-review=1&profile=full#/home`); await settle(page);
  await page.getByLabel("价格脉络研究对象").selectOption("ui-review-company-2");
  check((await page.getByLabel("研究上下文").innerText()).includes("ui-review-company-2"), "home selection updates shell");
  await page.getByRole("button", { name: "继续公司研究" }).click();
  check(page.url().includes("/company/ui-review-company-2/overview"), "continue exact company");
  await page.getByRole("tab", { name: "经营与财务" }).click(); await page.reload(); await settle(page);
  check(await page.getByRole("tab", { name: "经营与财务" }).getAttribute("aria-selected") === "true", "financial deep link reload");
  await page.goto(`${origin}/?ui-review=1&profile=full#/home`); await settle(page);
  await page.getByLabel("研究上下文").getByRole("button", { name: /公司相关证据/ }).click();
  const eventSelector = page.getByRole("dialog").getByRole("combobox", { name: /^关联证据/ });
  if (await eventSelector.count()) await eventSelector.selectOption("ui-review-event-0");
  await page.getByRole("dialog").getByRole("button", { name: "打开对应事件" }).click();
  check(new URL(page.url()).hash === "#/verification?event=ui-review-event-0", "exact related event route");
  await page.goBack(); await settle(page); check(new URL(page.url()).hash === "#/home", "event back navigation");
  // State sample is explicitly synthetic and cannot enter the production app.
  await page.goto(`${origin}/?ui-review=1&profile=degraded&chart-audit-states=1#/home`); await settle(page);
  const sample = page.getByLabel("合成审计状态验收"); await sample.locator("summary").click();
  const sampleText = await sample.innerText();
  check(["NOT_ADMITTED", "missing", "partial", "stale", "conflicted", "unknown"].every(value => sampleText.includes(value)), "fail-closed synthetic states rendered");
  check(await sample.getByRole("link").count() === 0, "unsafe synthetic URL has no link");
  await fits(page, "synthetic state panel fits 320"); await sample.scrollIntoViewIfNeeded(); await shot(page, "synthetic-not-admitted-320");
  // Tooltip and horizontal data-table scroll are confined to the chart area.
  await page.goto(`${origin}/?ui-review=1&profile=full#/company/ui-review-company-1/financials?from=home`); await settle(page);
  await page.getByText("查看原始数据表", { exact: true }).click();
  const scroll = page.locator("details").filter({ has: page.getByText("查看原始数据表", { exact: true }) }).locator("div").first();
  check(await scroll.evaluate(element => { element.scrollLeft = 100; return element.scrollWidth > element.clientWidth && element.scrollLeft > 0; }), "mobile data table scroll");
  const chart = page.locator(".recharts-wrapper").first(); await chart.scrollIntoViewIfNeeded(); const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .4);
  check(await page.locator(".recharts-tooltip-wrapper").first().isVisible(), "chart tooltip visible"); await fits(page, "tooltip does not expand document");
  check(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), "reduced motion active");
  check((await page.evaluate(() => window.__writes)).length === 0 && dataRequests.length === 0 && downloads === 0, "review isolation", { dataRequests, downloads });
  check(report.pageErrors.length === 0, "no page errors", report.pageErrors);
} catch (error) { report.failures.push(error.stack || String(error)); }
finally { await browser.close(); await fs.writeFile(path.join(output, "browser-validation.json"), JSON.stringify(report, null, 2) + "\n"); }
console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, pageErrors: report.pageErrors, output }));
if (report.failures.length) process.exitCode = 1;
