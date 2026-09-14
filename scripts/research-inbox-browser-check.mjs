/** Scoped Slice 1 browser acceptance. Existing installed Playwright only, fresh contexts,
 * synthetic storage, local committed artifacts; never refresh a Provider. */
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || "playwright");
const origin = process.env.UI_REVIEW_ORIGIN || "http://127.0.0.1:4173";
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || "data-cache/stage-4-1b/browser");
await fs.mkdir(output, { recursive: true });
const report = { baseline: "2829776f8ef4b7bcbf744c8edb37410bbd6ec67a", generatedAt: new Date().toISOString(), checks: [], failures: [], pageErrors: [], screenshots: [], sourceSha256: {} };
for (const file of ["src/App.tsx", "src/services/researchInbox.ts", "src/components/home/ResearchInbox.tsx", "src/components/home/HomePage.tsx", "src/components/research/EvidenceDrawer.tsx", "src/components/research/ResearchEventEvidence.tsx", "src/index.css"]) report.sourceSha256[file] = createHash("sha256").update(await fs.readFile(file)).digest("hex");
const browser = await chromium.launch({ channel: "msedge", headless: true });
function check(ok, name, detail) { report.checks.push({ name, ok, detail }); if (!ok) report.failures.push(name); }
async function settle(page) { await page.waitForLoadState("networkidle"); await page.evaluate(() => document.fonts.ready); }
async function shot(page, name) { await page.screenshot({ path: path.join(output, `${name}.png`) }); report.screenshots.push(`${name}.png`); }
async function fits(page) { return page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, panel: document.querySelector('[role="dialog"]')?.getBoundingClientRect().toJSON() })); }
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
      await page.goto(`${origin}/?ui-review=1&profile=${profile}#/home`); await settle(page);
      for (const theme of ["neon", "pro", "light"]) {
        await page.getByRole("combobox", { name: "外观" }).selectOption(theme);
        const name = `${width}-${profile}-${theme}`;
        const geometry = await fits(page); check(geometry.document <= width, `home fits ${name}`, geometry);
        check(await page.getByRole("region", { name: "Research Inbox", exact: true }).count() === 1, `inbox present ${name}`);
        if (width === 1536 || width === 390) await shot(page, `home-${name}`);
        if (profile === "empty") {
          check(await page.getByRole("button", { name: /查看证据/ }).count() === 0, `empty has no invented evidence ${name}`);
          continue;
        }
        const trigger = page.getByRole("button", { name: /查看证据/ }).first(); await trigger.click();
        const dialog = page.getByRole("dialog"); await dialog.waitFor();
        const drawerGeometry = await fits(page);
        check(drawerGeometry.document <= width && drawerGeometry.panel.x >= 0 && drawerGeometry.panel.right <= width + 1, `drawer fits ${name}`, drawerGeometry);
        check((await dialog.innerText()).includes("严格 PIT：未证明"), `PIT remains unproven ${name}`);
        const footer = dialog.locator("footer");
        check(await footer.getByRole("button", { name: "打开对应事件" }).isVisible(), `event action visible ${name}`);
        await page.keyboard.press("Shift+Tab");
        check(await dialog.evaluate(element => element.contains(document.activeElement)), `focus trapped ${name}`);
        if (width === 1536 || width === 390) await shot(page, `drawer-${name}`);
        await page.keyboard.press("Escape");
        check(await dialog.count() === 0 && await trigger.evaluate(element => element === document.activeElement), `Escape restores focus ${name}`);
      }
      if (profile !== "empty") {
        await page.getByRole("button", { name: /查看证据/ }).first().click();
        await page.getByRole("dialog").getByRole("button", { name: "打开对应事件" }).click();
        check(new URL(page.url()).hash === "#/verification?event=ui-review-event-0", `exact event ${width}-${profile}`);
        check((await page.getByLabel("选中事件详情").innerText()).includes("ui-review-event-0"), `event selected ${width}-${profile}`);
        await page.goBack(); await settle(page);
        await page.getByRole("button", { name: /查看证据/ }).first().click();
        await page.getByRole("dialog").getByRole("button", { name: "打开对应公司" }).click();
        check(new URL(page.url()).hash === "#/company/ui-review-company-1/overview?from=home", `exact company ${width}-${profile}`);
        await page.goBack(); await settle(page);
        await page.getByRole("button", { name: /查看证据/ }).first().click();
        await page.getByRole("dialog").getByRole("button", { name: "开始复盘" }).click();
        check((await page.getByRole("status").allTextContents()).some(text => text.includes("业务写入")), `review mode still isolates writes ${width}-${profile}`);
      }
      check((await page.evaluate(() => window.__writes)).length === 0, `review profile no writes ${width}-${profile}`);
    }
    console.log(`UI matrix completed: ${width}px`);
  }
  check(dataRequests.length === 0, "review mode has no data requests", dataRequests);
  check(downloads === 0, "review mode has no downloads");
  await context.close();

  // Exercise actual App wiring and persisted review workflow in a new disposable browser context.
  const liveContext = await browser.newContext({ viewport: { width: 1536, height: 1000 }, reducedMotion: "reduce" });
  const live = await liveContext.newPage(); live.on("pageerror", error => report.pageErrors.push(error.message));
  await live.goto(`${origin}/#/stocks`); await settle(live);
  const stockId = await live.locator('main [data-stock-id]').first().getAttribute("data-stock-id");
  check(Boolean(stockId), "production stock identity read from rendered owner");
  await live.evaluate(id => {
    localStorage.setItem("investment-research-dashboard.watchlist.v2", JSON.stringify({ schemaVersion: 2, updatedAt: "2026-09-01T00:00:00Z", watchItems: [{ id: "slice1-synthetic-watch", stockId: id, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", status: "观察", priority: "high", tags: ["synthetic acceptance"], reason: "合成浏览器验收", thesis: "合成假设，不是投资判断", validationCriteria: ["核对来源"], riskCriteria: [], nextReviewAt: "2026-09-01", lastReviewedAt: null, archivedAt: null, source: "user", schemaVersion: 2 }], reviewEntries: [], reviewTaskStates: [], settings: { longUnreviewedDays: 90 } }));
  }, stockId);
  await live.goto(`${origin}/#/home`); await live.reload(); await settle(live);
  const storageBefore = await live.evaluate(() => localStorage.getItem("investment-research-dashboard.watchlist.v2"));
  await shot(live, "production-home-synthetic-watch");
  const row = live.locator('[data-inbox-id="watch:slice1-synthetic-watch"]');
  check(await row.count() === 1, "one inbox group per existing watch item");
  await row.getByRole("button", { name: /查看证据/ }).click();
  check(await live.evaluate(() => localStorage.getItem("investment-research-dashboard.watchlist.v2")) === storageBefore, "opening evidence does not write business storage");
  await live.getByRole("dialog").getByRole("button", { name: "开始复盘" }).click();
  check(await live.getByRole("dialog", { name: "完成一次投研复盘" }).count() === 1, "actual App reuses ReviewFormModal");
  await live.getByLabel("本次新证据", { exact: true }).fill("Synthetic browser acceptance; checked source and status.");
  await live.getByLabel("下一次复盘日期").fill("2099-01-01");
  await live.getByRole("button", { name: "提交复盘", exact: true }).click();
  await live.getByRole("dialog").waitFor({ state: "hidden" });
  const saved = await live.evaluate(() => JSON.parse(localStorage.getItem("investment-research-dashboard.watchlist.v2")));
  check(saved.watchItems.length === 1 && saved.reviewEntries.length === 1, "one existing watch and one append-only review");
  check(new Set(saved.reviewTaskStates.map(task => task.taskId)).size === saved.reviewTaskStates.length, "no duplicate task states");
  await live.reload(); await settle(live);
  check(await live.locator('[data-inbox-id="watch:slice1-synthetic-watch"]').count() === 0, "completed group stays handled after reload");
  await liveContext.close();
} catch (error) { report.failures.push(error.stack ?? String(error)); }
finally {
  await browser.close();
  if (report.pageErrors.length) report.failures.push("browser page errors");
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ checks: report.checks.length, failures: report.failures, pageErrors: report.pageErrors, output }, null, 2));
  if (report.failures.length) process.exitCode = 1;
}
