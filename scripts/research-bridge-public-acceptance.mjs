/** Public-source acceptance only. Persistent UI, read-only inspection; never accepts a Wiki proposal. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

// Remove credentials before launching Edge or other children. Never log raw exceptions.
let ownerSecret = process.env.BRIDGE_OWNER_SECRET;
delete process.env.BRIDGE_OWNER_SECRET;
delete process.env.BRIDGE_SIGNING_SECRET;
delete process.env.DEBUG;
delete process.env.PWDEBUG;
const { values } = parseArgs({ options: { run: { type: 'string' }, action: { type: 'string' }, file: { type: 'string' }, 'keep-open': { type: 'boolean' } }, strict: true });
const actions = ['prepare', 'prepare-sources', 'inspect', 'import', 'revoke', 'stage-update', 'stage-history'];
const preparing = ['prepare', 'prepare-sources'].includes(values.action);
if (values.action === 'prepare-sources') ownerSecret = undefined;
let phase = 'CONFIG', context, page, run, runPath;
const assert = (value, code) => { if (!value) throw new Error(code); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const save = async () => {
  const temporary = `${runPath}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, runPath);
};
const nav = name => page.getByRole('navigation', { name: '研究记忆视图' }).getByRole('button', { name, exact: true }).click();
const button = name => page.getByRole('button', { name, exact: true });
const secretInput = () => page.getByLabel('研究桥访问密钥', { exact: true });

// Only readonly IDB transactions; all mutations go through existing application UI.
async function snapshot() {
  return page.evaluate(async () => {
    const name = 'investment-research-dashboard.knowledge-ingestion.v1';
    if (!(await indexedDB.databases()).some(row => row.name === name)) return null;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('IDB_OPEN'));
      request.onupgradeneeded = () => { request.transaction.abort(); reject(new Error('IDB_ABSENT')); };
    });
    try {
      const read = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('IDB_READ')); });
      const tx = db.transaction(['state', 'originals'], 'readonly');
      const [state, keys, raw] = await Promise.all([read(tx.objectStore('state').get('current')), read(tx.objectStore('originals').getAllKeys()), read(tx.objectStore('originals').getAll())]);
      if (!state) return null;
      if (raw.some(bytes => !(bytes instanceof Uint8Array))) throw new Error('IDB_ORIGINAL_TYPE');
      const originals = await Promise.all(keys.map(async (key, i) => ({ sourceId: key, size: raw[i].byteLength, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw[i]))].map(b => b.toString(16).padStart(2, '0')).join('') })));
      return { state, originals };
    } finally { db.close(); }
  });
}
const wiki = () => page.evaluate(() => JSON.parse(localStorage.getItem('investment-research-dashboard.wiki.v1')));
const rememberedStage = () => page.evaluate(id => localStorage.getItem(`research-bridge.stage.v1:${id}`), run.batchId);

function verifySources(value) {
  assert(value?.state.batches.length === 1 && value.state.sources.length === 10, 'SOURCE_SET_NOT_EXACT');
  const state = value.state, batch = state.batches[0];
  assert(!run.batchId || batch.batchId === run.batchId, 'BATCH_DRIFT');
  assert(value.originals.length === 10 && batch.sourceIds.length === 10, 'ORIGINAL_COUNT');
  for (const file of run.sources) {
    const source = state.sources.find(row => row.filename === file.filename && row.sha256 === file.sha256);
    assert(source && source.batchId === batch.batchId && (!file.sourceId || file.sourceId === source.sourceId), 'SOURCE_IDENTITY');
    const raw = value.originals.find(row => row.sourceId === source.sourceId);
    assert(raw?.sha256 === file.sha256 && raw.size === source.size, 'ORIGINAL_DIGEST');
    assert(source.parse.status === 'parsed' && source.parse.segments.some(row => row.text.trim()), 'PARSE_INCOMPLETE');
    assert(source.parse.segments.every(row => (source.kind === 'pdf' ? /^page:[1-9]\d*$/ : /^line:[1-9]\d*$/).test(row.locator)), 'LOCATOR_INVALID');
    Object.assign(file, { sourceId: source.sourceId, segmentCount: source.parse.segments.length, firstLocator: source.parse.segments[0].locator, lastLocator: source.parse.segments.at(-1).locator });
  }
  run.batchId = batch.batchId;
  return state;
}

async function selectBatch() { await nav('AI 整理'); await page.getByRole('combobox', { name: '选择资料批次', exact: true }).selectOption(run.batchId); }
async function credential() {
  assert(typeof ownerSecret === 'string' && ownerSecret.length >= 32, 'OWNER_CREDENTIAL_REQUIRED');
  await secretInput().fill(ownerSecret);
}
async function uiCall(label, action) {
  const reply = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === run.origin && url.pathname === `/api/bridge/${action}`;
  }, { timeout: 120000 });
  await button(label).click();
  const response = await reply;
  assert(response.ok() && response.headers()['content-type']?.includes('application/json'), 'BRIDGE_UI_REQUEST_FAILED');
  return response.json();
}
const cleanStatus = status => ({ stageId: status.stageId, batchId: status.batchId, createdAt: status.createdAt, expiresAt: status.expiresAt, status: status.status });
async function inspectRemote() {
  await credential();
  try {
    const status = await uiCall('检查访问状态', 'status');
    assert(status.batchId === run.batchId && status.stageId === await rememberedStage(), 'STAGE_BINDING');
    run.remoteStatus = { ...cleanStatus(status), checkedAt: new Date().toISOString(), remainingSeconds: Math.max(0, Math.floor((Date.parse(status.expiresAt) - Date.now()) / 1000)) };
    return status;
  } finally { await secretInput().fill(''); }
}
async function publish(round, includeWiki) {
  await selectBatch();
  const existing = await rememberedStage();
  if (existing) {
    const status = await inspectRemote();
    if (status.status === 'readable' || status.status === 'uploading') {
      const record = run.stages?.find(row => row.stageId === existing);
      assert(record?.round === round && status.status === 'readable' && record.status === 'readable', 'EXISTING_STAGE_REQUIRES_REVIEW');
      assert(same(record.selectedSourceIds, run.sources.filter(row => round === 1 ? row.round === 1 : true).map(row => row.sourceId)), 'EXISTING_SELECTION_DRIFT');
      run.stageId = existing;
      return;
    }
    assert(['revoked', 'expired'].includes(status.status), 'UNEXPECTED_STAGE_STATUS');
  }
  const selected = run.sources.filter(row => round === 1 ? row.round === 1 : true);
  await button('选择全部已解析资料').click();
  for (const file of run.sources) await page.getByRole('checkbox', { name: `${file.filename}（已解析）`, exact: true }).setChecked(selected.includes(file));
  let knowledgeIds = [];
  if (includeWiki) {
    const data = await wiki();
    assert(data?.entries.length === 1, 'SINGLE_ACCEPTED_WIKI_REQUIRED');
    const revisions = data.revisions.filter(row => row.wikiId === data.entries[0].wikiId);
    assert(revisions.length >= (round === 3 ? 2 : 1), 'HUMAN_REVIEW_REQUIRED');
    const current = revisions.filter(row => !revisions.some(next => next.supersedes === row.revisionId));
    assert(current.length === 1 && data.reviews.some(row => row.revisionId === current[0].revisionId && row.decision === 'reviewed' && row.reviewerType === 'user'), 'HUMAN_REVIEW_REQUIRED');
    assert(!run.wikiId || run.wikiId === current[0].wikiId, 'WIKI_IDENTITY_DRIFT');
    run.wikiId = current[0].wikiId; run.baseRevisionId = current[0].revisionId;
    await page.getByRole('checkbox', { name: `${current[0].title}（含已审核历史版本）`, exact: true }).check();
    knowledgeIds = [run.wikiId];
  }
  await page.getByRole('checkbox', { name: `我已核对清单，仅发送所选 ${selected.length} 份资料，保留 ${10 - selected.length} 份不发送`, exact: true }).check();
  await credential();
  // Save the intended selection before begin; a crash never silently triggers a new publish.
  run.pendingPublish = { round, selectedSourceIds: selected.map(row => row.sourceId), knowledgeIds, startedAt: new Date().toISOString() };
  await save();
  try {
    const published = await uiCall('发送给 ChatGPT', 'publish');
    await page.getByText(`所选 ${selected.length} 份资料已可供 ChatGPT 只读研究；${10 - selected.length} 份未发送。`, { exact: false }).waitFor();
    assert(published.status === 'readable' && published.batchId === run.batchId && published.stageId === await rememberedStage(), 'PUBLISH_NOT_READABLE');
    const record = { ...cleanStatus(published), round, selectedSourceIds: selected.map(row => row.sourceId), unselectedSourceIds: run.sources.filter(row => !selected.includes(row)).map(row => row.sourceId), knowledgeIds };
    run.stages ??= []; run.stages.push(record);
    run.stageId = record.stageId; run.selectedSourceIds = record.selectedSourceIds; run.unselectedSourceIds = record.unselectedSourceIds;
    delete run.pendingPublish;
    await save();
  } finally { await secretInput().fill(''); }
}

async function importContribution(state) {
  assert(values.file, 'INBOX_FILE_REQUIRED');
  const root = await fs.realpath(run.inboxPath), file = await fs.realpath(path.resolve(values.file));
  const relative = path.relative(root, file);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.extname(file).toLowerCase() === '.json', 'INBOX_BOUNDARY');
  assert((await fs.stat(file)).size <= 10 * 1024 * 1024, 'CONTRIBUTION_TOO_LARGE');
  const bytes = await fs.readFile(file), bundle = JSON.parse(bytes.toString('utf8'));
  const { build } = await import('esbuild');
  const entry = fileURLToPath(new URL('../src/services/knowledgeContribution.ts', import.meta.url));
  const built = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { validateContribution } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
  validateContribution(bundle, state, new Date().toISOString());
  assert(bundle.batchId === run.batchId && bundle.proposals.length === 1, 'CONTRIBUTION_TARGET');
  const stage = run.stages?.find(row => row.stageId === run.stageId);
  assert(stage && [1, 2].includes(stage.round) && bundle.sourceRefs.every(row => stage.selectedSourceIds.includes(row.sourceRef.sourceId)), 'CONTRIBUTION_STAGE_SCOPE');
  const proposal = bundle.proposals[0], before = await wiki();
  assert(proposal.action === (stage.round === 1 ? 'CREATE' : 'UPDATE') || proposal.action === 'NO_ACTION', 'CONTRIBUTION_ACTION');
  if (proposal.action === 'UPDATE') {
    assert(proposal.wikiId === run.wikiId && proposal.baseRevisionId === run.baseRevisionId, 'CONTRIBUTION_BASE');
    assert(before?.revisions.some(row => row.revisionId === proposal.baseRevisionId) && !before.revisions.some(row => row.supersedes === proposal.baseRevisionId), 'STALE_BASE');
  }
  assert(!state.contributions.some(row => row.bundle.bundleId === bundle.bundleId), 'BUNDLE_ALREADY_IMPORTED');
  await selectBatch();
  await page.getByLabel('选择研究贡献包', { exact: true }).setInputFiles(file);
  await page.getByRole('heading', { name: '审核 AI 建议', exact: true }).waitFor();
  assert(same(before, await wiki()), 'WIKI_CHANGED_BEFORE_REVIEW');
  const after = await snapshot();
  assert(after.state.contributions.some(row => row.bundle.bundleId === bundle.bundleId), 'IMPORT_NOT_RECORDED');
  run.imports ??= []; run.imports.push({ filename: relative, sha256: sha(bytes), bundleId: bundle.bundleId, proposalId: proposal.proposalId, action: proposal.action, importedAt: new Date().toISOString(), stageId: run.stageId, humanDecision: 'pending' });
  await save();
  const article = page.getByRole('article').filter({ has: page.getByRole('heading', { name: proposal.document?.title ?? '本次无需修改文章', exact: true }) });
  await article.getByRole('button', { name: '查看与审核', exact: true }).click();
  await page.getByRole('dialog').waitFor();
}

try {
  assert(values.run && actions.includes(values.action), 'USAGE_RUN_ACTION_REQUIRED');
  runPath = path.resolve(values.run); run = JSON.parse(await fs.readFile(runPath, 'utf8'));
  const allowedOrigin = /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(run.origin) || (values.action === 'prepare-sources' && /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(run.origin));
  assert(typeof run.runId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(run.runId) && allowedOrigin && /^dpl_/.test(run.deploymentId) && /^[a-f0-9]{40}$/.test(run.runtimeSha), 'DEPLOYMENT_BINDING_REQUIRED');
  assert(path.isAbsolute(run.profilePath) && path.isAbsolute(run.inboxPath), 'ABSOLUTE_LOCAL_PATHS_REQUIRED');
  assert(Array.isArray(run.sources) && run.sources.length === 10 && run.sources.filter(row => row.round === 1).length === 8 && run.sources.filter(row => row.round === 2).length === 2, 'SOURCE_ROUNDS_REQUIRED');
  assert(new Set(run.sources.map(row => row.sha256)).size === 10 && new Set(run.sources.map(row => row.filename)).size === 10, 'SOURCE_DUPLICATES');
  for (const source of run.sources) {
    assert(path.isAbsolute(source.path) && path.basename(source.path) === source.filename && /^[a-f0-9]{64}$/.test(source.sha256), 'SOURCE_MANIFEST_INVALID');
    assert(sha(await fs.readFile(source.path)) === source.sha256, 'LOCAL_SOURCE_DIGEST');
  }
  await fs.mkdir(run.inboxPath, { recursive: true });
  await fs.mkdir(run.profilePath, { recursive: true });
  const bindingPath = path.join(run.profilePath, 'acceptance-profile.json');
  const binding = { runId: run.runId, origin: run.origin, deploymentId: run.deploymentId, runtimeSha: run.runtimeSha };
  const profileFiles = await fs.readdir(run.profilePath);
  if (profileFiles.includes('acceptance-profile.json')) assert(same(JSON.parse(await fs.readFile(bindingPath, 'utf8')), binding), 'PROFILE_BINDING_DRIFT');
  else { assert(profileFiles.length === 0, 'DEDICATED_EMPTY_PROFILE_REQUIRED'); await fs.writeFile(bindingPath, JSON.stringify(binding, null, 2), { flag: 'wx' }); }
  const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
  phase = 'BROWSER';
  context = await chromium.launchPersistentContext(run.profilePath, { channel: 'msedge', headless: false, viewport: { width: 1440, height: 960 }, acceptDownloads: true, serviceWorkers: 'block' });
  // This dedicated browser is only for the frozen Preview; OAuth remains in the user's own session.
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['blob:', 'data:'].includes(url.protocol) || url.origin === run.origin ? route.continue() : route.abort('blockedbyclient');
  });
  page = context.pages().find(p => p.url().startsWith(run.origin)) ?? context.pages()[0] ?? await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(`${run.origin}/#/memory`);
  await page.getByLabel('选择多份文件', { exact: true }).waitFor();
  assert(new URL(page.url()).origin === run.origin, 'ORIGIN_DRIFT');
  phase = 'SOURCES';
  let value = await snapshot();
  if (preparing && (!value || value.state.sources.length === 0)) {
    assert(!run.batchId && (!value || value.state.batches.length === 0), 'MISSING_EXISTING_BATCH');
    await page.getByLabel('本批资料名称（可选）', { exact: true }).fill(`全球光通信产业链 · ${run.runId}`);
    await page.getByLabel('选择多份文件', { exact: true }).setInputFiles(run.sources.map(row => row.path));
    await page.getByText('已保存 10 份原件。', { exact: false }).waitFor({ timeout: 180000 });
    value = await snapshot();
  }
  if (preparing && value?.state.sources.some(row => row.parse.status === 'pending')) {
    assert(value.state.batches.length === 1 && value.state.sources.length === 10 && run.sources.every(file => value.state.sources.some(source => file.sha256 === source.sha256 && file.filename === source.filename)), 'PENDING_SOURCE_DRIFT');
    await button('继续提取文字').click();
    await button('继续提取文字').waitFor({ state: 'hidden', timeout: 180000 });
    value = await snapshot();
  }
  const state = verifySources(value); await save();
  phase = values.action.toUpperCase();
  if (values.action === 'prepare') await publish(1, false);
  if (values.action === 'stage-update') await publish(2, true);
  if (values.action === 'stage-history') await publish(3, true);
  if (values.action === 'revoke') {
    await selectBatch(); await credential();
    try { await uiCall('撤销 ChatGPT 访问', 'revoke-batch'); await page.getByText('已撤销本批此前全部暂存的资料与知识访问。', { exact: false }).waitFor(); }
    finally { await secretInput().fill(''); }
    const status = await inspectRemote(); assert(status.status === 'revoked', 'REVOKE_NOT_CONFIRMED');
    run.stages?.forEach(stage => { stage.status = 'revoked'; });
  }
  if (values.action === 'inspect') {
    await selectBatch();
    if (ownerSecret && await rememberedStage()) await inspectRemote();
  }
  if (values.action === 'import') await importContribution(state);
  if (values.action !== 'import') {
    await page.reload(); await page.getByLabel('选择多份文件', { exact: true }).waitFor();
    verifySources(await snapshot());
  }
  const data = await wiki();
  const finalSnapshot = await snapshot();
  for (const imported of run.imports ?? []) {
    const reviewId = `c-${imported.bundleId.length}-${imported.bundleId}-${imported.proposalId.length}-${imported.proposalId}-review`;
    const review = data?.reviews.find(row => row.reviewId === reviewId);
    const disposition = finalSnapshot.state.dispositions.find(row => row.bundleId === imported.bundleId && row.proposalId === imported.proposalId);
    imported.humanDecision = review?.decision === 'reviewed' && review.reviewerType === 'user' ? 'accepted' : disposition?.decision ?? 'pending';
    if (review) { imported.wikiId = review.wikiId; imported.revisionId = review.revisionId; imported.reviewId = review.reviewId; }
  }
  run.lastInspection = { at: new Date().toISOString(), action: values.action, sourceCount: 10, originalDigestsVerified: true,
    wiki: data ? { entryIds: data.entries.map(row => row.wikiId), revisions: data.revisions.map(row => ({ wikiId: row.wikiId, revisionId: row.revisionId, supersedes: row.supersedes, bodySha256: sha(row.bodyMarkdown), sourceIds: row.sourceRefs.filter(ref => ref.sourceDomain === 'browser-source').map(ref => ref.sourceId) })), reviews: data.reviews.map(row => ({ reviewId: row.reviewId, wikiId: row.wikiId, revisionId: row.revisionId, decision: row.decision, reviewerType: row.reviewerType })) } : null };
  await save();
  if (values.action !== 'import') {
    await selectBatch();
    if (ownerSecret && await rememberedStage()) { await inspectRemote(); await save(); }
  }
  ownerSecret = undefined;
  console.log(JSON.stringify({ ok: true, action: values.action, runId: run.runId, manifest: runPath, stageId: run.stageId ?? null, humanAcceptancePerformed: false, keptOpen: !!values['keep-open'] }));
} catch (error) {
  // Whitelist local codes only. Playwright errors may contain typed credential values.
  const code = /^[A-Z][A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'ACTION_FAILED_DETAILS_WITHHELD';
  console.error(JSON.stringify({ ok: false, phase, code, recovery: 'Reuse the same manifest and dedicated profile; do not recreate or clear browser data.' }));
  process.exitCode = 1;
} finally {
  ownerSecret = undefined;
  if (context) {
    let safeToKeep = !!page && !page.isClosed();
    try { if (safeToKeep && await secretInput().count()) await secretInput().fill(''); }
    catch {
      // A fresh document discards the React password state. If that fails, close.
      try { await page.reload({ timeout: 15000 }); } catch { safeToKeep = false; }
    }
    if (values['keep-open'] && safeToKeep && !page.isClosed()) {
      await new Promise(resolve => { context.once('close', resolve); process.once('SIGINT', () => void context.close()); process.once('SIGTERM', () => void context.close()); });
    }
    await context.close().catch(() => {});
  }
}
