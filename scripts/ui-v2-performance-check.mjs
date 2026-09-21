/** Paired cold-context measurements; serve both builds with the same Vite preview
 * version/options (separate ports/outDir). No user profile or inferred runtime SHA. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/ui-v2/performance');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.UI_REVIEW_BROWSER_CHANNEL || 'msedge', headless: true });
const targets = [
  { name: 'baseline', origin: process.env.UI_REVIEW_BASELINE_ORIGIN || 'http://127.0.0.1:4190', runtimeSha: process.env.UI_REVIEW_BASELINE_RUNTIME_SHA || null, deploymentId: process.env.UI_REVIEW_BASELINE_DEPLOYMENT_ID || null },
  { name: 'candidate', origin: process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4191', runtimeSha: process.env.UI_REVIEW_RUNTIME_SHA || null, deploymentId: process.env.UI_REVIEW_DEPLOYMENT_ID || null },
];
const report = { testedAt: new Date().toISOString(), inputType: 'isolated-empty-profile', browser: browser.version(), viewport: { width: 1440, height: 960 }, runsPerTarget: 3, serverRequirement: 'Both origins must use the same Vite preview version/options; only port and outDir differ. Verify server setup separately before interpreting comparisons.', cache: 'fresh browser context per run; same browser process', thresholds: null, targets, samples: [], summaries: [], errors: [] };
try {
  for (let run = 1; run <= 3; run++) for (const target of targets) {
    const context = await browser.newContext({ viewport: report.viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push({ target: target.name, run, message: error.message }));
      await page.goto(`${target.origin}/#/home`, { waitUntil: 'load' });
      await page.locator('main').waitFor();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const scripts = performance.getEntriesByType('resource').filter(row => row.initiatorType === 'script');
        return {
          domContentLoadedMs: navigation.domContentLoadedEventEnd - navigation.startTime,
          loadMs: navigation.loadEventEnd - navigation.startTime,
          navigationDurationMs: navigation.duration,
          scriptRequests: scripts.length,
          scriptEncodedBytes: scripts.reduce((sum, row) => sum + row.encodedBodySize, 0),
          scriptDecodedBytes: scripts.reduce((sum, row) => sum + row.decodedBodySize, 0),
          scriptTransferBytes: scripts.reduce((sum, row) => sum + row.transferSize, 0),
          resourceTimingBufferEntries: performance.getEntriesByType('resource').length,
        };
      });
      report.samples.push({ target: target.name, run, testedAt: new Date().toISOString(), ...metrics });
    } finally { await context.close(); }
  }
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const target of targets) {
    const samples = report.samples.filter(row => row.target === target.name);
    report.summaries.push({ target: target.name, sampleCount: samples.length, medians: Object.fromEntries(['domContentLoadedMs', 'loadMs', 'navigationDurationMs', 'scriptRequests', 'scriptEncodedBytes', 'scriptDecodedBytes', 'scriptTransferBytes'].map(key => [key, median(samples.map(row => row[key]))])) });
  }
  if (report.errors.length) process.exitCode = 1;
} catch (error) { report.errors.push({ message: error.message }); process.exitCode = 1; }
finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, summaries: report.summaries, errors: report.errors }));
}
