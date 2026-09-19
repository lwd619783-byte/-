/** Disposable local browser acceptance. No persistent user profile, live acquisition or fixture writes in the app. */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const output = path.resolve(process.env.UI_REVIEW_OUTPUT || 'data-cache/stage-4-2-5/remediation-browser');
const storageKey = 'investment-research-dashboard.creator-viewpoint.v1';
await fs.mkdir(output, { recursive: true });
const report = { generatedAt: new Date().toISOString(), origin, checks: [], errors: [], warnings: [], screenshots: [], downloads: [], externalRequests: [], sourceSha256: {} };
for (const file of ['src/components/creator/CreatorViewpointWorkspace.tsx', 'src/components/creator/CreatorEntryForm.tsx', 'src/components/creator/CreatorEvidence.tsx', 'src/services/creatorViewpoint.ts', 'src/services/creatorViewpointRepository.ts', 'src/services/creatorViewpointExport.ts', 'src/services/creatorViewpoint.fixture.ts']) {
  report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
}
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw new Error(name); };
const browser = await chromium.launch({ channel: process.env.UI_REVIEW_BROWSER_CHANNEL || 'msedge', headless: true });
const contexts = [];
const createPage = async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'UTC', viewport: { width: 1536, height: 960 }, acceptDownloads: true });
  contexts.push(context);
  await context.addInitScript(() => {
    window.__creatorWrites = [];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { window.__creatorWrites.push(key); return set.call(this, key, value); };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('request', request => { if (!request.url().startsWith(origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) report.externalRequests.push(request.url()); });
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') {
    if (message.location().url.endsWith('/favicon.ico') && message.text().includes('404')) report.warnings.push('Existing favicon.ico 404');
    else report.errors.push(message.text());
  } });
  await page.goto(`${origin}/#/creators`);
  await page.getByRole('region', { name: '观点追踪工作区', exact: true }).waitFor();
  check(await page.locator('vite-error-overlay').count() === 0, 'no Vite error overlay');
  return page;
};
const workspace = page => page.getByRole('region', { name: '观点追踪工作区', exact: true });
const nav = (page, name) => workspace(page).getByRole('navigation', { name: '观点追踪视图' }).getByRole('button', { name, exact: true }).click();
const fits = async (page, label) => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no horizontal overflow: ${label}`);
const capture = async (page, name) => { await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false }); report.screenshots.push(`${name}.png`); };
const dataFrom = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const currentFrom = page => page.evaluate(async key => {
  const { buildCreatorCurrentViews } = await import('/src/services/creatorViewpoint.ts');
  return buildCreatorCurrentViews(JSON.parse(localStorage.getItem(key))).map(row => ({ creatorId: row.creatorId, topicId: row.topicId, observationId: row.observation.id, stance: row.observation.stance, coverage: row.coverage }));
}, storageKey);
const download = async (page, label, filename) => {
  const pending = page.waitForEvent('download');
  await workspace(page).getByRole('button', { name: label, exact: true }).click();
  const result = await pending;
  check(await result.failure() === null, `${filename} download completes`);
  const target = path.join(output, filename); await result.saveAs(target);
  report.downloads.push(filename); return target;
};
const importJson = async (page, raw, label) => {
  const before = await page.evaluate(key => localStorage.getItem(key), storageKey);
  await workspace(page).getByRole('button', { name: '恢复 JSON', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '恢复 JSON 备份', exact: true });
  await dialog.getByLabel('JSON 内容', { exact: true }).fill(raw);
  await dialog.getByRole('button', { name: '校验并预览', exact: true }).click();
  await dialog.getByRole('button', { name: '备份当前数据并确认恢复', exact: true }).waitFor();
  check(await page.evaluate(key => localStorage.getItem(key), storageKey) === before, `${label} preview has zero business write`);
  const pending = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '备份当前数据并确认恢复', exact: true }).click();
  const preRestore = await pending;
  await preRestore.saveAs(path.join(output, `${label}-pre-restore.json`));
  check(await preRestore.failure() === null, `${label} pre-restore backup downloaded`);
  await dialog.waitFor({ state: 'hidden' });
  check(await page.evaluate(key => Object.keys(localStorage).some(item => item.startsWith(`${key}.pre-import.`)), storageKey), `${label} local pre-import backup retained`);
};

try {
  // Complete real UI creation path in an empty, disposable storage context.
  const entryPage = await createPage();
  const entry = workspace(entryPage);
  check(await entry.getByRole('heading', { name: '从一个可信来源开始' }).count() === 1, 'empty-state onboarding');
  check(await entryPage.evaluate(key => localStorage.getItem(key) === null, storageKey), 'empty read does not seed business data');
  await entry.getByRole('button', { name: '新增博主', exact: true }).click();
  await entryPage.getByLabel('博主名称', { exact: true }).fill('UI 合成研究者');
  await entryPage.getByRole('dialog').getByRole('button', { name: '追加保存', exact: true }).click();
  await entryPage.getByRole('dialog').waitFor({ state: 'hidden' });
  await entry.getByRole('button', { name: '新增来源', exact: true }).click();
  await entryPage.getByLabel('来源 URL', { exact: true }).fill('https://example.com/ui-source');
  await entryPage.getByRole('dialog').locator('input[name="publishedAt"]').fill(new Date(Date.now() - 86_400_000).toISOString());
  await entryPage.getByLabel('原文或摘录（未知留空）', { exact: true }).fill('仅用于浏览器验收的合成来源。');
  await entryPage.getByRole('dialog').locator('select[name="completeness"]').selectOption('FULL');
  await entryPage.getByRole('dialog').locator('select[name="commentCoverage"]').selectOption('PARTIAL');
  await entryPage.getByRole('dialog').getByRole('button', { name: '追加保存', exact: true }).click();
  await entryPage.getByRole('dialog').waitFor({ state: 'hidden' });
  await entry.getByRole('button', { name: '记录观点', exact: true }).click();
  await entryPage.getByLabel('观点摘要', { exact: true }).fill('UI 合成条件性观点');
  await entryPage.getByRole('dialog').locator('select[name="stance"]').selectOption('cautious');
  await entryPage.getByRole('dialog').locator('select[name="conditional"]').selectOption('yes');
  await entryPage.getByLabel('Trigger · 成立条件', { exact: true }).fill('合成成立条件');
  await entryPage.getByLabel('Invalidation · 失效条件', { exact: true }).fill('合成失效条件');
  await entryPage.getByRole('checkbox', { name: /重要观点/ }).check();
  await entryPage.getByRole('button', { name: '保存为 Draft', exact: true }).click();
  await entryPage.getByRole('dialog').waitFor({ state: 'hidden' });
  check((await currentFrom(entryPage)).length === 0, 'UI Draft does not enter Current View');
  await nav(entryPage, '观点时间轴');
  await entry.getByRole('button', { name: '审核记录', exact: true }).click();
  await entryPage.getByLabel('审核依据 / 备注', { exact: true }).fill('浏览器合成验收，仅审核记录。');
  await entryPage.getByRole('button', { name: '确认审核决定', exact: true }).click();
  await entryPage.getByRole('dialog').waitFor({ state: 'hidden' });
  await entryPage.reload(); await entry.waitFor();
  const entryCurrent = await currentFrom(entryPage);
  check(entryCurrent.length === 1 && entryCurrent[0].stance === 'cautious' && entryCurrent[0].coverage === 'PARTIAL', 'real forms creator/source/observation/approval persist across reload');
  check((await dataFrom(entryPage)).observations[0].invalidation === '合成失效条件', 'UI condition fields persist');
  await nav(entryPage, '观点时间轴');
  await entry.getByRole('button', { name: '填写复盘', exact: true }).first().click();
  const earlyDialog = entryPage.getByRole('dialog');
  await earlyDialog.locator('textarea[name="actualOutcome"]').fill('合成尚未到期结果');
  await earlyDialog.locator('textarea[name="evidence"]').fill('合成尚未到期证据');
  for (const status of ['completed', 'inconclusive']) {
    await earlyDialog.locator('select[name="status"]').selectOption(status);
    await earlyDialog.getByRole('button', { name: '追加保存', exact: true }).click();
    await earlyDialog.getByRole('alert').waitFor();
    check((await earlyDialog.getByRole('alert').innerText()).includes('观察周期未满') && (await dataFrom(entryPage)).reviews.length === 0, `early ${status} review is rejected for timing without persistence`);
  }
  await earlyDialog.locator('select[name="status"]').selectOption('pending');
  const earlyRecordedBefore = Date.now();
  await earlyDialog.getByRole('button', { name: '追加保存', exact: true }).click();
  await earlyDialog.waitFor({ state: 'hidden' });
  const earlySaved = (await dataFrom(entryPage)).reviews[0];
  check(earlySaved.status === 'pending' && Date.parse(earlySaved.recordedAt) >= earlyRecordedBefore && Date.parse(earlySaved.recordedAt) <= Date.now(), 'early pending review records actual local capture time');
  await entry.getByRole('button', { name: '新增外部事件', exact: true }).click();
  const eventDialog = entryPage.getByRole('dialog');
  await eventDialog.locator('input[name="title"]').fill('来源级核验的合成外部事件');
  await eventDialog.locator('textarea[name="summary"]').fill('合成事件源核验范围说明');
  await eventDialog.locator('input[name="sourceName"]').fill('合成官方来源');
  await eventDialog.locator('input[name="url"]').fill('https://example.com/verified-event');
  await eventDialog.locator('select[name="verificationStatus"]').selectOption('verified');
  check((await eventDialog.innerText()).includes('事件来源级核验') && (await eventDialog.innerText()).includes('不代表 Provider Fact'), 'verified event form explicitly limits verification to source level');
  await eventDialog.getByRole('button', { name: '追加保存', exact: true }).click();
  await eventDialog.waitFor({ state: 'hidden' });
  check((await dataFrom(entryPage)).events[0].verificationStatus === 'verified', 'source-level verified event saves');
  await nav(entryPage, '事件对照');
  await entry.getByRole('button', { name: '核对事件来源', exact: true }).click();
  const verifiedDrawer = entryPage.getByRole('dialog');
  check((await verifiedDrawer.innerText()).includes('verified 仅表示事件来源级核验') && (await verifiedDrawer.innerText()).includes('不代表 Provider Fact 准入、Verified Claim 或正式 Thesis'), 'event Drawer prevents semantic promotion');
  await entryPage.keyboard.press('Escape');

  // Audit-time backfill must not rewind the creator publication chronology.
  const chronologyPage = await createPage();
  await chronologyPage.evaluate(async key => {
    const { creatorViewpointFixture } = await import('/src/services/creatorViewpoint.fixture.ts');
    const { validateCreatorViewpointData } = await import('/src/services/creatorViewpoint.ts');
    const data = creatorViewpointFixture();
    data.creators = data.creators.slice(0, 1); data.sources = []; data.observations = []; data.approvals = [];
    const sourceBase = creatorViewpointFixture().sources[0], base = creatorViewpointFixture().observations[0];
    const add = (id, publishedAt, hour, stance) => {
      const recordedAt = `2026-09-19T${String(hour).padStart(2, '0')}:00:00.000Z`;
      data.sources.push({ ...sourceBase, id: `source-${id}`, publishedAt, publishedAtLabel: publishedAt === null ? '原帖时间无时区' : null, capturedAt: recordedAt, recordedAt });
      data.observations.push({ ...base, id, sourceId: `source-${id}`, summary: id, stance, recordedAt });
      data.approvals.push({ id: `approval-${id}`, observationId: id, decision: 'reviewed', recordedAt: `2026-09-19T${String(hour + 1).padStart(2, '0')}:00:00.000Z`, note: '合成历史补录审核' });
    };
    add('latest-september-18', '2026-09-18T08:00:00.000Z', 1, 'positive');
    add('backfilled-august-29', '2026-08-29T08:00:00.000Z', 3, 'cautious');
    add('unknown-publication-time', null, 5, 'negative');
    data.observations.push({ ...data.observations[1], id: 'older-revision', recordedAt: '2026-09-19T07:00:00.000Z', summary: 'older-revision', stance: 'neutral', supersedesId: 'backfilled-august-29', revisionReason: '合成旧观点文字校正' });
    data.approvals.push({ id: 'approval-older-revision', observationId: 'older-revision', decision: 'reviewed', recordedAt: '2026-09-19T08:00:00.000Z', note: '旧观点追加修订' });
    validateCreatorViewpointData(data); localStorage.setItem(key, JSON.stringify(data));
  }, storageKey);
  await chronologyPage.reload(); const chronology = workspace(chronologyPage); await chronology.waitFor();
  check((await currentFrom(chronologyPage))[0].observationId === 'latest-september-18', 'older backfill and later-approved revision do not rewind Current View');
  const chronologyState = await chronologyPage.evaluate(async key => {
    const { buildViewpointTimeline, buildViewpointReviews, buildCreatorCurrentViews } = await import('/src/services/creatorViewpoint.ts');
    const data = JSON.parse(localStorage.getItem(key));
    return { transitions: buildViewpointTimeline(data).map(row => row.next.id), reviews: buildViewpointReviews(data), beforeBackfill: buildCreatorCurrentViews(data, '2026-09-19T02:30:00.000Z').map(row => row.observation.id) };
  }, storageKey);
  check(JSON.stringify(chronologyState.transitions) === JSON.stringify(['older-revision', 'latest-september-18']), 'transitions use creator chronology and omit approved superseded ancestor');
  check(JSON.stringify(chronologyState.beforeBackfill) === JSON.stringify(['latest-september-18']), 'knowledge As-of excludes later-discovered old viewpoint');
  const unresolvedReviews = chronologyState.reviews.filter(row => row.observationId === 'unknown-publication-time');
  check(unresolvedReviews.length === 3 && unresolvedReviews.every(row => row.anchorAt === null && row.dueAt === null && row.chronology === 'unresolved'), 'unknown source publication yields unresolved review anchors, never audit-time fallback');
  for (const offset of [5, 20, 60]) {
    const review = chronologyState.reviews.find(row => row.observationId === 'latest-september-18' && row.offsetDays === offset);
    check(Date.parse(review.dueAt) === Date.parse('2026-09-18T08:00:00.000Z') + offset * 86_400_000, `T+${offset} anchors source publication, not approval`);
  }
  await nav(chronologyPage, '观点时间轴');
  const chronologyText = await chronology.innerText();
  check(chronologyText.indexOf('backfilled-august-29') < chronologyText.indexOf('latest-september-18') && chronologyText.includes('unresolved'), 'UI timeline places August before September and explicitly marks unresolved publication');
  await chronology.getByLabel('As-of 本地时间（按记录 / 审核可得时点）', { exact: true }).fill('2026-09-19T02:30');
  check(await chronology.getByRole('button', { name: 'backfilled-august-29', exact: true }).count() === 0, 'UI knowledge As-of hides unrecorded historical backfill');
  await chronology.getByRole('button', { name: '回到当前', exact: true }).click();
  await capture(chronologyPage, 'source-chronology-backfill-unresolved');

  const page = await createPage();
  await page.evaluate(async key => {
    const { creatorViewpointFixture, fixtureTime } = await import('/src/services/creatorViewpoint.fixture.ts');
    const { validateCreatorViewpointData } = await import('/src/services/creatorViewpoint.ts');
    const data = creatorViewpointFixture();
    const base = data.observations[0];
    const add = (id, day, overrides, reviewDay) => {
      const sourceId = overrides.sourceId ?? `source-${id}`;
      if (!overrides.sourceId) data.sources.push({ ...data.sources[0], id: sourceId, url: `https://example.com/post/${id}`, publishedAt: fixtureTime(day), capturedAt: fixtureTime(day), recordedAt: fixtureTime(day) });
      data.observations.push({ ...base, id, sourceId, recordedAt: fixtureTime(day), ...overrides });
      if (reviewDay) data.approvals.push({ id: `approval-${id}`, observationId: id, decision: 'reviewed', recordedAt: fixtureTime(reviewDay), note: '合成审核' });
    };
    add('observation-reason', 4, { summary: '同状态增加理由', reasoning: '新增合成理由' }, 5);
    add('observation-change', 6, { summary: '合成转向积极', stance: 'positive', reasoning: '合成事件后的条件已发生变化' }, 7);
    add('observation-technology', 8, { topicId: 'technology', summary: '科技主题独立谨慎' }, 9);
    add('observation-draft', 10, { summary: '未审核未来消极观点', stance: 'negative' });
    data.sources.push({ ...data.sources[0], id: 'source-comment', kind: 'comment', parentSourceId: 'source-1', authorIdentity: 'other', recordedAt: fixtureTime(11), capturedAt: fixtureTime(11), content: '合成他人评论', commentCoverage: 'FULL' });
    data.sources.push({ ...data.sources[0], id: 'source-reply', kind: 'self_reply', parentSourceId: 'source-comment', authorIdentity: 'unverified', recordedAt: fixtureTime(11), capturedAt: fixtureTime(11), content: '身份尚未确认的合成回复', commentCoverage: 'FULL' });
    add('observation-comment', 12, { sourceId: 'source-comment', topicId: 'global-rates', summary: '评论来源的草稿观点' });
    add('observation-reply', 12, { sourceId: 'source-reply', topicId: 'china-liquidity-rmb', summary: '本人回复类型仍未核验身份' });
    validateCreatorViewpointData(data);
    localStorage.setItem(key, JSON.stringify(data));
  }, storageKey);
  await page.reload(); const work = workspace(page); await work.waitFor();
  const views = await currentFrom(page);
  check(views.length === 4 && views.find(row => row.creatorId === 'creator-1' && row.topicId === 'a-shares').stance === 'positive' && views.find(row => row.topicId === 'technology').stance === 'cautious', 'three creators and independent topic states');
  check(!views.some(row => row.observationId === 'observation-draft'), 'fixture Draft does not affect current');
  await nav(page, '观点时间轴');
  const reasonCard = work.locator('article').filter({ has: page.getByRole('button', { name: '同状态增加理由', exact: true }) });
  check((await reasonCard.innerText()).includes('状态未改变'), 'additional reasoning does not fabricate transition');
  const changeCard = work.locator('article').filter({ has: page.getByRole('button', { name: '合成转向积极', exact: true }) });
  check((await changeCard.innerText()).includes('谨慎 → 积极') && (await changeCard.innerText()).includes('合成事件后的条件已发生变化'), 'timeline answers when and why stance changed');
  for (const label of ['01 外部事件', '02 原始来源', '03 观点', '04 状态历史', '05 待验证条件', '06 后续 Review']) check((await changeCard.innerText()).includes(label), `timeline node ${label}`);
  const replyCard = work.locator('article').filter({ has: page.getByRole('button', { name: '本人回复类型仍未核验身份', exact: true }) });
  check((await replyCard.innerText()).includes('本人回复') && (await replyCard.innerText()).includes('身份 unverified') && (await replyCard.innerText()).includes('PARTIAL'), 'unverified self-reply identity and inherited partial coverage');
  check((await work.locator('article').filter({ has: page.getByRole('button', { name: '评论来源的草稿观点', exact: true }) }).innerText()).includes('评论 ·'), 'comment source differs from post and self-reply');
  await work.getByLabel('As-of 本地时间（按记录 / 审核可得时点）', { exact: true }).fill('2026-01-05T12:00');
  check(await work.getByRole('button', { name: '合成转向积极', exact: true }).count() === 0 && await work.getByRole('button', { name: '未审核未来消极观点', exact: true }).count() === 0, 'As-of timeline hides future observation and approval');
  check(await work.getByRole('button', { name: '新增博主', exact: true }).isDisabled(), 'As-of view is read only');
  await work.getByRole('button', { name: '回到当前', exact: true }).click();

  for (const offset of [5, 20, 60]) {
    const row = changeCard.getByText(new RegExp(`^T\\+${offset} ·`)).locator('..');
    await row.getByRole('button', { name: '填写复盘', exact: true }).click();
    const dialog = page.getByRole('dialog');
    check((await dialog.innerText()).includes('calendar days') && (await dialog.innerText()).includes('合成转向积极'), `T+${offset} original viewpoint and calendar-day disclosure`);
    await dialog.locator('select[name="triggerOccurred"]').selectOption('yes');
    await dialog.locator('select[name="invalidationOccurred"]').selectOption('no');
    await dialog.getByLabel('后续实际表现', { exact: true }).fill(`合成 T+${offset} 观察结果`);
    await dialog.getByLabel('后续验证证据', { exact: true }).fill('合成证据，仅测试表单');
    await dialog.getByRole('button', { name: '追加保存', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    check((await row.innerText()).includes('completed'), `T+${offset} review saves`);
  }
  const preRevision = await dataFrom(page);
  await changeCard.getByRole('button', { name: '追加修订', exact: true }).click();
  await page.getByRole('dialog').locator('textarea[name="summary"]').fill('合成修订保留原历史');
  await page.getByRole('dialog').locator('textarea[name="revisionReason"]').fill('新增合成来源解释');
  await page.getByRole('button', { name: '保存为 Draft', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  check((await currentFrom(page)).find(row => row.creatorId === 'creator-1' && row.topicId === 'a-shares').observationId === 'observation-change', 'draft revision leaves current unchanged');
  const revisionCard = work.locator('article').filter({ has: page.getByRole('button', { name: '合成修订保留原历史', exact: true }) });
  await revisionCard.getByRole('button', { name: '审核记录', exact: true }).click();
  await page.getByLabel('审核依据 / 备注', { exact: true }).fill('审核合成追加修订');
  await page.getByRole('button', { name: '确认审核决定', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  const postRevision = await dataFrom(page);
  check(preRevision.observations.every(row => JSON.stringify(postRevision.observations.find(item => item.id === row.id)) === JSON.stringify(row)), 'approved revision retains all original observations unchanged');
  check((await changeCard.innerText()).includes('已有后续修订'), 'timeline marks retained superseded record');

  for (const theme of ['neon', 'pro', 'light']) for (const width of [1536, 1280, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.getByLabel('外观', { exact: true }).selectOption(theme);
    const label = `${theme}-${width}`;
    check(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), `reduced-motion ${label}`);
    for (const view of ['博主概览', '观点时间轴', '事件对照', '博主比较']) {
      await nav(page, view); await fits(page, `${view}-${label}`);
      if (view === '博主比较') {
        await work.getByLabel('比较同一主题').selectOption('a-shares');
        check(await work.locator('article').count() === 3, `three parallel creator cards ${label}`);
        for (const creator of ['合成研究者 1', '合成研究者 2', '合成研究者 3']) check(await work.getByRole('heading', { name: creator, exact: true }).count() === 1, `${creator} comparison ${label}`);
        check((await work.innerText()).includes('核心理由') && (await work.innerText()).includes('待复盘'), `comparison reasons and pending reviews ${label}`);
      }
      if (view === '事件对照') {
        const text = await work.innerText();
        for (const relation of ['本人明确说明因果', '系统 / 研究者推断', '仅时间背景相关']) check(text.includes(relation), `event relationship ${relation} ${label}`);
      }
    }
    if (['neon-1536', 'pro-1280', 'light-390', 'pro-320'].includes(label)) await capture(page, `comparison-${label}`);
    await nav(page, '观点时间轴');
    const trigger = changeCard.getByRole('button', { name: '打开证据', exact: true }); await trigger.click();
    const drawer = page.getByRole('dialog'); await drawer.waitFor();
    const text = await drawer.innerText();
    check(text.includes('External Commentary / Creator Viewpoint') && text.includes('PARTIAL') && text.includes('原始来源'), `shared Evidence Drawer semantics ${label}`);
    check(await drawer.getByRole('link', { name: '打开原始来源', exact: true }).getAttribute('href') === 'https://example.com/post/observation-change', `drawer exact source link ${label}`);
    await fits(page, `drawer-${label}`);
    await page.keyboard.press('Shift+Tab'); check(await drawer.evaluate(element => element.contains(document.activeElement)), `drawer focus trap ${label}`);
    if (['neon-1536', 'light-390'].includes(label)) await capture(page, `drawer-${label}`);
    await page.keyboard.press('Escape'); await drawer.waitFor({ state: 'hidden' });
    check(await trigger.evaluate(element => element === document.activeElement), `drawer focus restored ${label}`);
  }
  await page.setViewportSize({ width: 1536, height: 960 });
  const jsonPath = await download(page, 'JSON 完整备份', 'creator-viewpoints-backup.json');
  const jsonRaw = await fs.readFile(jsonPath, 'utf8');
  const exported = JSON.parse(jsonRaw);
  check(exported.format === 'investment-research-dashboard.creator-viewpoint' && exported.data.observations.length === (await dataFrom(page)).observations.length, 'JSON backup includes complete append-only history');
  const xlsxPath = await download(page, 'Excel 分析副本', 'creator-viewpoints.xlsx');
  const xlsx = await fs.readFile(xlsxPath);
  check(xlsx.readUInt32LE(0) === 0x04034b50 && xlsx.includes(Buffer.from('xl/workbook.xml')), 'Excel downloads a ZIP OOXML workbook');
  for (const name of ['Creators', 'Current Views', 'Timeline', 'Sources', 'External Events', 'Reviews']) check(xlsx.includes(Buffer.from(`name="${name}"`)), `Excel sheet ${name}`);
  const fresh = await createPage();
  await importJson(fresh, jsonRaw, 'roundtrip');
  await fresh.reload(); await workspace(fresh).waitFor();
  check(JSON.stringify(await dataFrom(fresh)) === JSON.stringify(exported.data), 'JSON fresh-context restore and reload preserves complete data');
  check(JSON.stringify(await currentFrom(fresh)) === JSON.stringify(await currentFrom(page)), 'JSON round-trip preserves derived Current View semantics');
  await nav(fresh, '观点时间轴');
  check((await workspace(fresh).innerText()).includes('合成修订保留原历史') && (await workspace(fresh).innerText()).includes('completed'), 'restored UI retains revisions and review results');

  const corrupt = await createPage();
  const corruptRaw = '{broken-history\r\n中文损坏原文\n';
  await corrupt.evaluate(({ key, raw }) => { localStorage.setItem(key, raw); localStorage.setItem('creator-browser-unrelated-sentinel', 'keep-exact-other-key'); }, { key: storageKey, raw: corruptRaw });
  await corrupt.reload(); const corruptWork = workspace(corrupt); await corruptWork.waitFor();
  check((await corruptWork.getByRole('alert').innerText()).includes('写入已锁定'), 'corruption visible fail-closed error');
  for (const label of ['新增博主', '新增来源', '记录观点', '恢复 JSON', 'JSON 完整备份', 'Excel 分析副本']) check(await corruptWork.getByRole('button', { name: label, exact: true }).isDisabled(), `corruption disables ${label}`);
  check(await corrupt.evaluate(key => localStorage.getItem(key), storageKey) === corruptRaw, 'corruption keeps original raw storage bytes');
  check(await corrupt.evaluate(key => window.__creatorWrites.filter(item => item === key).length, storageKey) === 0, 'corruption reload performs no tracker write');
  await capture(corrupt, 'corruption-fail-closed');
  const unrelatedBefore = await corrupt.evaluate(key => Object.fromEntries(Object.entries(localStorage).filter(([name]) => !name.startsWith(key))), storageKey);
  const corruptDownload = corrupt.waitForEvent('download');
  await corruptWork.getByRole('button', { name: '导出原文并打开灾难恢复', exact: true }).click();
  const rawDownload = await corruptDownload;
  const rawPath = path.join(output, 'corrupted-original-bytes.txt'); await rawDownload.saveAs(rawPath);
  check((await fs.readFile(rawPath)).equals(Buffer.from(corruptRaw, 'utf8')), 'corruption download preserves CRLF and Unicode exact bytes');
  const recoveryDialog = corrupt.getByRole('dialog', { name: '灾难恢复观点备份', exact: true });
  await recoveryDialog.getByLabel('JSON 内容', { exact: true }).fill('{not-valid-backup');
  await recoveryDialog.getByRole('button', { name: '校验并预览', exact: true }).click();
  await recoveryDialog.getByRole('alert').waitFor();
  check(await corrupt.evaluate(key => localStorage.getItem(key), storageKey) === corruptRaw && await recoveryDialog.getByRole('button', { name: '确认备份损坏原文并替换观点存储', exact: true }).count() === 0, 'invalid disaster backup cannot write or expose confirmation');
  const invalidGraphBackup = JSON.parse(jsonRaw); invalidGraphBackup.data.observations[0].sourceId = 'absent-source';
  await recoveryDialog.getByLabel('JSON 内容', { exact: true }).fill(JSON.stringify(invalidGraphBackup));
  await recoveryDialog.getByRole('button', { name: '校验并预览', exact: true }).click();
  await recoveryDialog.getByRole('alert').waitFor();
  check(await corrupt.evaluate(key => localStorage.getItem(key), storageKey) === corruptRaw && await recoveryDialog.getByRole('button', { name: '确认备份损坏原文并替换观点存储', exact: true }).count() === 0, 'valid JSON with broken source graph fails full disaster-backup validation');
  await recoveryDialog.getByLabel('JSON 内容', { exact: true }).fill(jsonRaw);
  await recoveryDialog.getByRole('button', { name: '校验并预览', exact: true }).click();
  await recoveryDialog.getByRole('button', { name: '确认备份损坏原文并替换观点存储', exact: true }).waitFor();
  check(await corrupt.evaluate(key => localStorage.getItem(key), storageKey) === corruptRaw, 'valid disaster preview leaves corrupt store untouched until explicit confirmation');
  for (const collection of ['creators', 'topics', 'sources', 'events', 'observations', 'approvals', 'reviews']) check((await recoveryDialog.innerText()).includes(collection), `recovery preview enumerates ${collection}`);
  await recoveryDialog.getByRole('button', { name: '确认备份损坏原文并替换观点存储', exact: true }).click();
  await recoveryDialog.waitFor({ state: 'hidden' });
  check(await corruptWork.getByRole('button', { name: '新增博主', exact: true }).isEnabled(), 'confirmed disaster recovery unlocks UI without manual restart');
  check(await corrupt.evaluate(({ key, raw }) => Object.entries(localStorage).some(([name, value]) => name.startsWith(`${key}.pre-recovery.`) && value === raw), { key: storageKey, raw: corruptRaw }), 'disaster recovery retains exact local pre-recovery bytes');
  check(JSON.stringify(await corrupt.evaluate(key => Object.fromEntries(Object.entries(localStorage).filter(([name]) => !name.startsWith(key))), storageKey)) === JSON.stringify(unrelatedBefore), 'disaster recovery leaves every unrelated localStorage key unchanged');
  await corrupt.reload(); await corruptWork.waitFor();
  check(JSON.stringify(await dataFrom(corrupt)) === JSON.stringify(exported.data) && JSON.stringify(await currentFrom(corrupt)) === JSON.stringify(await currentFrom(page)), 'corrupt-store actual UI recovery round-trip and reload preserves history and Current View');
  await capture(corrupt, 'disaster-recovery-reloaded');

  const future = await createPage();
  const futureRaw = JSON.stringify({ ...exported.data, schemaVersion: 999 });
  await future.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: storageKey, raw: futureRaw });
  await future.reload(); await workspace(future).waitFor();
  check(await workspace(future).getByRole('button', { name: '导出原文并打开灾难恢复', exact: true }).count() === 0 && await workspace(future).getByRole('button', { name: '恢复 JSON', exact: true }).isDisabled(), 'future-schema store does not expose downgrade recovery');
  check(await future.evaluate(key => localStorage.getItem(key), storageKey) === futureRaw && await future.evaluate(key => window.__creatorWrites.filter(name => name === key).length, storageKey) === 0, 'future-schema raw store retained with zero tracker writes');

  if (process.env.CREATOR_VIEWPOINT_SAMPLE_JSON) {
    const sample = await createPage();
    const sampleRaw = await fs.readFile(process.env.CREATOR_VIEWPOINT_SAMPLE_JSON, 'utf8');
    await importJson(sample, sampleRaw.replace(/^\uFEFF/, ''), 'real-sample');
    check((await currentFrom(sample)).length === 0, 'real sample remains draft and does not invent historical transition');
    await nav(sample, '观点时间轴'); await capture(sample, 'real-sample-draft-timeline');
    report.realSample = 'Runtime draft JSON imported; no historical transition asserted.';
  } else report.warnings.push('Real runtime sample JSON not supplied; real-sample browser import NOT_RUN.');
  check(report.externalRequests.length === 0, 'no external network requests during acceptance');
  for (const [file, before] of Object.entries(report.sourceSha256)) check(createHash('sha256').update((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex') === before, `tested source stable during run: ${file}`);
  check(report.errors.length === 0, 'no browser runtime or console errors');
} catch (error) { report.errors.push(error.stack ?? error.message); process.exitCode = 1; }
finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ checks: report.checks.length, failures: report.checks.filter(item => !item.ok), errors: report.errors, warnings: report.warnings, screenshots: report.screenshots.length, downloads: report.downloads }));
