// Isolated synthetic frozen-F2 browser acceptance. Harness is ignored and never enters production imports.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const { chromium } = createRequire(import.meta.url)(process.env.UI_REVIEW_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.UI_REVIEW_SYNTHETIC_ORIGIN || 'http://127.0.0.1:4174';
const output = path.resolve(process.env.UI_REVIEW_SYNTHETIC_OUTPUT || 'data-cache/stage-4-3-r2/synthetic-browser');
await fs.mkdir(output, { recursive: true });
const harness = path.resolve('data-cache/stage-4-3-r2/browser-harness');
await fs.mkdir(harness, { recursive: true });
await fs.writeFile(path.join(harness, 'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
await fs.writeFile(path.join(harness, 'main.tsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import '/src/index.css';
import '/src/styles/workspace-v2.css';
import { thesisFixture } from '/src/services/thesis.fixture';
import { pinVerifiedClaim } from '/src/services/thesis';
import { BrowserClaimRepository, CLAIM_STORAGE_KEY } from '/src/services/verifiedClaimRepository';
import { BrowserThesisRepository } from '/src/services/thesisRepository';
import { ThesisWorkspacePanel } from '/src/components/research/ThesisWorkspace';
const f = await thesisFixture();
if (localStorage.getItem(CLAIM_STORAGE_KEY) === null) localStorage.setItem(CLAIM_STORAGE_KEY, f.claimStore.getItem(CLAIM_STORAGE_KEY)!);
const claimRepository = new BrowserClaimRepository(localStorage, f.claim.owners);
const owners = { claims() { const result = claimRepository.load(); if (result.error) throw Error(result.error); return { data: result.data, owners: f.claim.owners }; }, resolveIdentity: f.owners.resolveIdentity };
const repository = new BrowserThesisRepository(localStorage, owners);
if (!repository.load().data.entries.length) {
  const data = owners.claims().data, ref = pinVerifiedClaim(data.revisions[0], data.reviews[0]);
  repository.saveDraft(repository.load().data, { ...f.revision, supportingClaims: [ref], macroIndustry: f.revision.macroIndustry.map(edge => ({ ...edge, supportingClaims: [ref] })) });
}
const runtime = { owners, repository, claimRepository, claimOwners: f.claim.owners, bindings: [f.claim.binding], identities: f.identities.map(ref => ({ ref, label: ref.id })),
  evidence: () => ({ title: 'Synthetic frozen F2 original evidence', scope: 'synthetic-only', quality: [], rows: [{ label: 'Original frozen graph', value: JSON.stringify(f.claim.graph) }], records: [], linkage: null }) };
function successor(decision: 'DRAFT' | 'VERIFIED' | 'REJECTED') {
  const current = claimRepository.load().data, head = current.revisions.at(-1)!;
  const data = claimRepository.saveDraft(current, { ...head, revisionId: 'synthetic-browser-successor', supersedes: head.revisionId, createdAt: new Date().toISOString(), reason: 'Synthetic supersession acceptance' });
  if (decision !== 'DRAFT') claimRepository.confirmReview(claimRepository.prepareReview(data, 'synthetic-browser-successor'), decision, 'Synthetic successor review', true);
  location.reload();
}
createRoot(document.getElementById('root')!).render(<main style={{ padding: 12 }}><p>SYNTHETIC ONLY · frozen F2 acceptance · no real admission</p><ThesisWorkspacePanel runtime={runtime} /><button onClick={() => successor('DRAFT')}>Synthetic successor DRAFT</button><button onClick={() => successor('VERIFIED')}>Synthetic successor VERIFIED</button><button onClick={() => successor('REJECTED')}>Synthetic successor REJECTED</button></main>);
`);
const report = { scope: 'SYNTHETIC_FROZEN_F2_ONLY', checks: [], errors: [], consoleErrors: [], resourceErrors: [], screenshots: [], sourceSha256: {} };
for (const file of ['src/services/thesis.ts', 'src/services/thesisRepository.ts', 'src/components/research/ThesisWorkspace.tsx', 'src/services/thesis.fixture.ts']) report.sourceSha256[file] = createHash('sha256').update((await fs.readFile(file, 'utf8')).replace(/\r\n/g, '\n')).digest('hex');
const check = (ok, name) => { report.checks.push({ ok, name }); if (!ok) throw Error(name); };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const thesisKey = 'investment-research-dashboard.thesis.v1', claimKey = 'investment-research-dashboard.claim.v1';
const bytes = page => page.evaluate(([t,c]) => ({ thesis: localStorage.getItem(t), claim: localStorage.getItem(c) }), [thesisKey, claimKey]);
try {
  for (const width of [320, 390, 1536]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' }), page = await context.newPage();
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('response', response => { if (response.status() >= 400) report.resourceErrors.push({ status: response.status(), path: new URL(response.url()).pathname }); });
    page.on('console', e => { if (e.type() === 'error') report.consoleErrors.push(e.text()); });
    await page.goto(`${origin}/data-cache/stage-4-3-r2/browser-harness/index.html`);
    const panel = page.getByRole('region', { name: 'Thesis V1', exact: true }); await panel.waitFor();
    check((await panel.getByTestId('thesis-counts').innerText()).includes('1 verified / 0 formal Thesis'), `synthetic draft has no automatic confirmation ${width}`);
    const original = await bytes(page), initial = JSON.parse(original.thesis);
    await panel.getByRole('button', { name: '生成 Thesis 确认预览' }).click();
    check(JSON.stringify(await bytes(page)) === JSON.stringify(original), `preview exact bytes ${width}`);
    check(await panel.getByRole('button', { name: '本人确认正式 Thesis' }).isDisabled(), `confirmation note required ${width}`);
    await panel.getByLabel('本人确认说明').fill('Synthetic explicit browser user confirmation');
    await panel.getByRole('button', { name: '本人确认正式 Thesis' }).click();
    const confirmed = await bytes(page), formal = JSON.parse(confirmed.thesis);
    check(formal.confirmations.length === 1 && formal.revisions[0].origin === 'ai_draft', `explicit formal and AI origin ${width}`);
    check(confirmed.claim === original.claim, `Thesis does not mutate Claim ${width}`);
    check(JSON.stringify(formal.revisions[0]) === JSON.stringify(initial.revisions[0]), `immutable saved draft ${width}`);
    await panel.getByText('Thesis 版本历史与 diff（1）').click();
    check(JSON.stringify(await bytes(page)) === JSON.stringify(confirmed), `history exact bytes ${width}`);
    await panel.getByRole('button', { name: /Claim → Evidence/ }).first().click();
    const modal = page.getByRole('dialog', { name: 'Thesis 支持主张精确版本' }); await modal.waitFor();
    check((await modal.innerText()).includes(formal.revisions[0].supportingClaims[0].revisionId), `exact pinned Claim detail ${width}`);
    await modal.getByRole('button', { name: '查看原始证据' }).click();
    const drawer = page.getByRole('dialog', { name: '证据核对' }); await drawer.waitFor();
    check((await drawer.innerText()).includes('Synthetic frozen F2 original evidence'), `original Evidence Drawer ${width}`);
    check(JSON.stringify(await bytes(page)) === JSON.stringify(confirmed), `Claim and Evidence drill read only ${width}`);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `formal viewport fits ${width}`);
    const file = `synthetic-formal-${width}.png`; await page.screenshot({ path: path.join(output,file), fullPage: true }); report.screenshots.push(file);
    await page.reload(); await panel.waitFor();
    check(JSON.stringify(await bytes(page)) === JSON.stringify(confirmed), `reload exact bytes and refs ${width}`);
    await panel.getByRole('button', { name: '修订为新草稿' }).click();
    await panel.getByLabel('论点陈述', { exact: true }).fill('Synthetic second thesis revision');
    await panel.getByLabel('Thesis 修订说明').fill('Synthetic second revision reason');
    await panel.getByRole('button', { name: '保存 Thesis 草稿' }).click();
    const secondDraft = JSON.parse((await bytes(page)).thesis);
    check(secondDraft.revisions.length === 2 && secondDraft.confirmations.length === 1, `new revision needs new confirmation ${width}`);
    check(JSON.stringify(secondDraft.revisions[0]) === JSON.stringify(formal.revisions[0]), `first revision preserved ${width}`);
    await panel.getByRole('button', { name: '生成 Thesis 确认预览' }).click();
    await panel.getByLabel('本人确认说明').fill('Synthetic second explicit confirmation');
    await panel.getByRole('button', { name: '本人确认正式 Thesis' }).click();
    const secondFormal = await bytes(page), next = JSON.parse(secondFormal.thesis);
    check(next.confirmations.length === 2 && JSON.stringify(next.confirmations[0]) === JSON.stringify(formal.confirmations[0]), `append-only confirmation history ${width}`);
    await panel.getByText('Thesis 版本历史与 diff（2）').click();
    check((await panel.innerText()).includes('Synthetic second thesis revision'), `history contains revision diff ${width}`);
    check(JSON.stringify(await bytes(page)) === JSON.stringify(secondFormal), `two-version history read only ${width}`);
    const decision = width === 320 ? 'DRAFT' : width === 390 ? 'VERIFIED' : 'REJECTED';
    await page.getByRole('button', { name: `Synthetic successor ${decision}`, exact: true }).click();
    await panel.getByText('支持主张已有后续版本/需复核；历史 Thesis 的精确引用保持不变。').waitFor();
    const afterSuccessor = await bytes(page);
    check(afterSuccessor.thesis === secondFormal.thesis, `successor ${decision} preserves formal Thesis exact raw bytes ${width}`);
    await panel.getByRole('button', { name: /Claim → Evidence/ }).first().click();
    await modal.waitFor();
    check((await modal.innerText()).includes('主张版本：synthetic-revision-1'), `history still drills original Claim after successor ${width}`);
    await page.keyboard.press('Escape');
    await panel.getByRole('button', { name: '修订为新草稿' }).click();
    const choices = panel.getByRole('group', { name: '选择支持主张的精确版本' });
    check(await choices.getByRole('checkbox', { name: /synthetic-revision-1/ }).count() === 0, `superseded R1 absent from current choices ${decision} ${width}`);
    check(await choices.getByRole('checkbox', { name: /synthetic-browser-successor/ }).count() === (decision === 'VERIFIED' ? 1 : 0), `successor choices follow exact review ${decision} ${width}`);
    await panel.getByLabel('论点 asOf（ISO 时间）').fill(formal.revisions[0].asOf);
    check(await choices.getByRole('checkbox', { name: /synthetic-revision-1/ }).count() === 1, `historical asOf still offers original R1 ${width}`);
    await panel.getByLabel('论点 asOf（ISO 时间）').fill(new Date().toISOString());
    await panel.getByLabel('Thesis 修订说明').fill('Synthetic obsolete support must fail');
    await panel.getByRole('button', { name: '保存 Thesis 草稿' }).click();
    await panel.getByRole('button', { name: '生成 Thesis 确认预览' }).click();
    await panel.getByLabel('本人确认说明').fill('Cannot override supersession');
    check(await panel.getByRole('button', { name: '本人确认正式 Thesis' }).isDisabled(), `new Thesis blocked for superseded R1 ${decision} ${width}`);
    const blockedState = await bytes(page), blockedData = JSON.parse(blockedState.thesis);
    check(blockedData.confirmations.length === 2 && JSON.stringify(blockedData.revisions.slice(0,2)) === JSON.stringify(next.revisions), `formal history immutable after blocked attempt ${width}`);
    check(blockedState.claim === afterSuccessor.claim, `Thesis flow cannot rewrite successor Claim ${width}`);
    await context.close();
  }
  check(report.errors.length === 0, 'no runtime errors');
} catch (error) { report.errors.push(String(error)); process.exitCode = 1; }
finally { await browser.close(); await fs.writeFile(path.join(output,'report.json'), JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify({ scope: report.scope, checks: report.checks.length, failed: report.checks.filter(c => !c.ok), errors: report.errors, consoleErrors: report.consoleErrors, resourceErrors: report.resourceErrors, screenshots: report.screenshots.length }));
