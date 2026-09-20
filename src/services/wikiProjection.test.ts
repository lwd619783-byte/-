import { describe, expect, it } from 'vitest';
import { posix } from 'node:path';
import { renderWikiVault, inspectWikiVault, normalizeWikiPath, WIKI_GENERATED_MARKER } from './wikiProjection';
import { wikiFixture, wikiFixtureOwners, wikiRevision, wikiReview, wikiTime as at } from './wiki.fixture';
import { zip } from '../utils/zip';

describe('deterministic one-way Markdown Vault', () => {
  it('same Domain produces byte-stable Markdown, manifest, ZIP and complete rebuild', async () => {
    const data = wikiFixture(), original = JSON.stringify(data), owners = wikiFixtureOwners();
    const first = await renderWikiVault(data, owners, at(8)), second = await renderWikiVault(JSON.parse(original), owners, at(8));
    expect(second).toEqual(first);
    expect(zip(Object.entries(first.files).map(([name, content]) => ({ name, content })))).toEqual(zip(Object.entries(second.files).map(([name, content]) => ({ name, content }))));
    expect(JSON.stringify(data)).toBe(original); expect(await inspectWikiVault(first, first.files)).toMatchObject({ status: 'current' });
    expect(first.files[first.manifest.pages[0].path]).toContain(WIKI_GENERATED_MARKER);
  });
  it('formal relative links resolve through ID/path manifest; title and path rename preserve IDs', async () => {
    const data = wikiFixture(); data.entries.push({ ...data.entries[0], wikiId: 'wiki-two', type: 'CONCEPT' }); const r = wikiRevision('wiki-two', 'revision-two'); data.revisions.push(r); data.reviews.push(wikiReview(r)); data.revisions[0].wikiRefs = [{ wikiId: 'wiki-two' }];
    const owners = wikiFixtureOwners(), original = await renderWikiVault(data, owners, at(8)); data.revisions[0].title = 'New title';
    const renamed = await renderWikiVault(data, owners, at(8), { 'wiki-one': 'research-wiki/frameworks/新 名称.md' });
    expect(renamed.manifest.pages.map(row => row.wikiId)).toEqual(original.manifest.pages.map(row => row.wikiId));
    for (const [path, content] of Object.entries(renamed.files)) for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (match[1].startsWith('<https:')) continue;
      expect(renamed.files[posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(match[1])))]).toBeDefined();
    }
    expect(renamed.files['research-wiki/concepts/wiki-two.md']).toContain('## Backlinks');
    expect(renamed.manifest.pages[0].path).toBe('research-wiki/frameworks/新 名称.md');
  });
  it.each(['../wiki.md', '/research-wiki/x/a.md', 'research-wiki/../x.md', 'research-wiki/x/CON.md', 'research-wiki/x/com1.md', 'research-wiki/x/lpt¹.md', 'research-wiki/x/a?.md', 'research-wiki/x/a:.md', 'research-wiki/x/a\\b.md', 'research-wiki/x/%2e%2e.md', 'research-wiki//a.md', 'research-wiki/x/a.md.', 'research-wiki/x/.hidden.md', 'research-wiki/x/a.md ', 'research-wiki/x/a\u0000.md', 'elsewhere/x/a.md', 'research-wiki/x/a.txt'])('rejects unsafe path %s', path => { expect(() => normalizeWikiPath(path)).toThrow(); });
  it('rejects collisions across case and Unicode normalization; refuses foreign path IDs', async () => {
    const data = wikiFixture(); data.entries.push({ ...data.entries[0], wikiId: 'wiki-two' }); const r = wikiRevision('wiki-two', 'revision-two'); data.revisions.push(r); data.reviews.push(wikiReview(r));
    for (const [a, b] of [['Name', 'name'], ['é', 'e\u0301']]) await expect(renderWikiVault(data, wikiFixtureOwners(), at(8), { 'wiki-one': `research-wiki/x/${a}.md`, 'wiki-two': `research-wiki/x/${b}.md` })).rejects.toThrow(/COLLISION/);
    await expect(renderWikiVault(data, wikiFixtureOwners(), at(8), { 'wiki-one': 'research-wiki/x/page.md', 'wiki-two': 'research-wiki/x/page.md/child.md' })).rejects.toThrow(/COLLISION/);
    await expect(renderWikiVault(data, wikiFixtureOwners(), at(8), { foreign: 'research-wiki/x/a.md' })).rejects.toThrow(/UNKNOWN_ID/);
  });
  it('edited, stale, deleted and unexpected files are detected without any Domain write-back', async () => {
    const data = wikiFixture(), before = JSON.stringify(data), owners = wikiFixtureOwners(), old = await renderWikiVault(data, owners, at(8));
    const edited = { ...old.files, [old.manifest.pages[0].path]: '# external edit' };
    expect(await inspectWikiVault(old, edited)).toMatchObject({ status: 'edited_or_incomplete', changed: [old.manifest.pages[0].path] });
    expect(JSON.stringify(data)).toBe(before);
    const regenerated = await renderWikiVault(data, owners, at(8)); expect(regenerated).toEqual(old);
    expect((await inspectWikiVault(old, {})).missing).toHaveLength(Object.keys(old.files).length);
    expect((await inspectWikiVault(old, { ...old.files, 'research-wiki/x/extra.md': 'x' })).unexpected).toHaveLength(1);
    const next = { ...wikiRevision('wiki-one', 'revision-two', 9), supersedes: 'revision-one' }; data.revisions.push(next); data.reviews.push(wikiReview(next, 10));
    const current = await renderWikiVault(data, owners, at(11)); expect(await inspectWikiVault(current, old.files)).toMatchObject({ status: 'stale' });
  });
});
