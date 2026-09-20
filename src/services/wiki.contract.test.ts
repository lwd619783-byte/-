import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import entity from '../../contracts/v1/entity-resolution.v1.schema.json';
import extraction from '../../contracts/research-extraction/v1/research-extraction.schema.json';
import shared from '../../contracts/financial-research/v1/shared.schema.json';
import wiki from '../../contracts/wiki/v1/wiki.schema.json';
import generated from './wikiValidator.generated.mjs';
import { wikiFixture, wikiFixtureOwners, wikiTime as at } from './wiki.fixture';
import { renderWikiVault } from './wikiProjection';
import { WIKI_TYPES } from '../types/wiki';
describe('closed Wiki V1 machine contract and portable YAML', () => {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, ownProperties: true }); addFormats(ajv); [entity, extraction, shared].forEach(schema => ajv.addSchema(schema)); const validate = ajv.compile(wiki);
  it.each(WIKI_TYPES)('supports %s in the single shared store', type => { const f = wikiFixture(); f.entries[0].type = type; expect(validate(f)).toBe(true); expect(generated(f)).toBe(true); });
  it('parity rejects future version, unknown origin, nested authority, and extra owner fields', () => {
    for (const change of [(f: ReturnType<typeof wikiFixture>) => Object.assign(f, { schemaVersion: 'wiki.v2' }),
      (f: ReturnType<typeof wikiFixture>) => Object.assign(f.revisions[0], { authorType: 'provider' }),
      (f: ReturnType<typeof wikiFixture>) => Object.assign(f.revisions[0], { thesis: {} }),
      (f: ReturnType<typeof wikiFixture>) => Object.assign(f.revisions[0].sourceRefs[0], { content: 'copy' })]) {
      const f = wikiFixture(); change(f); expect(validate(f)).toBe(false); expect(generated(f)).toBe(false);
    }
  });
  it('standard YAML parser reads flat atomic properties including quotes, newlines and Unicode', async () => {
    const f = wikiFixture(); f.revisions[0].title = '中文: "title"\n---'; f.revisions[0].aliases = ['[alias]', '中文'];
    const vault = await renderWikiVault(f, wikiFixtureOwners(), at(8)); const md = vault.files[vault.manifest.pages[0].path];
    const metadata = parse(md.split('---\n')[1]) as Record<string, unknown>;
    expect(metadata.title).toBe(f.revisions[0].title); expect(metadata.aliases).toEqual(['[alias]', '中文']); expect(metadata.generated).toBe(true);
    for (const value of Object.values(metadata)) expect(Array.isArray(value) ? value.every(item => typeof item === 'string') : ['string', 'boolean', 'number'].includes(typeof value)).toBe(true);
    for (const key of ['sourceRefs', 'extractionRefs', 'evidenceRefs', 'wikiRefs']) expect(metadata).not.toHaveProperty(key);
  });
});
