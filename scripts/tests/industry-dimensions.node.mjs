import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, bytes, sha256 } from '../semantic-runtime/common.mjs';
import { REGISTRY, registryResources, validateDimensionMapping } from '../industry/registry.mjs';
import { createIndustryMetricProvider } from '../../src/services/industryMetricRegistry.mjs';
import { createIndustryDimensions, INDUSTRY_DIMENSIONS } from '../../src/services/industryDimensions.mjs';
const mapping = read('config/industry/industry-dimension-mapping.v1.json');
const registry = read(REGISTRY);
const provider = await createIndustryMetricProvider(registry, registryResources(), sha256);
const create = (m = mapping, p = provider) => createIndustryDimensions(m, p, sha256);

test('independent V1 schema and reviewed map covers six exact metrics, four oil dimensions', async () => {
  assert.equal(validateDimensionMapping(mapping), true);
  assert.equal(INDUSTRY_DIMENSIONS.length, 11);
  const d = await create();
  assert.equal(d.list('robotics').length, 2);
  assert.deepEqual(new Set(d.list('oil-shipping').map(m => m.mapping.dimension)), new Set(['supply', 'demand', 'trade_flow', 'inventory']));
  assert.deepEqual(d.list('other'), []);
  assert.throws(() => { d.list('robotics')[0].mapping.dimension = 'price'; }, TypeError);
});
test('Registry, resource, mapping and property order cannot affect dimensions', async () => {
  const r = structuredClone(registry); r.entries.reverse();
  const p = await createIndustryMetricProvider(r, registryResources().reverse(), sha256);
  const m = structuredClone(mapping); m.entries.reverse();
  m.entries = m.entries.map(e => Object.fromEntries(Object.entries(e).reverse()));
  assert.deepEqual((await create(m, p)).list('oil-shipping'), (await create()).list('oil-shipping'));
});
const mutations = [
  ['version', m => { m.revision = '2'; }, /VERSION/],
  ['foreign industry', m => { m.entries[0].industryId = 'oil-shipping'; }, /EXACT_OWNER/],
  ['unknown metric', m => { m.entries[0].metricId = 'UNKNOWN'; }, /EXACT_OWNER/],
  ['duplicate mapping', m => { m.entries.push(m.entries[0]); }, /DUPLICATE/],
  ['unknown dimension', m => { m.entries[0].dimension = 'prosperity'; }, /UNKNOWN/],
  ['reviewed but wrong dimension', m => { m.entries[0].dimension = 'demand'; }, /REVIEW_DRIFT/],
  ['foreign subdimension', m => { m.entries[0].subdimension = 'crude_stocks'; }, /REVIEW_DRIFT/],
  ['unmapped omission', m => { m.entries.pop(); }, /REVIEW_DRIFT/],
  ['extra score', m => { m.entries[0].score = 1; }, /REVIEW_DRIFT/],
];
for (const key of ['owner', 'objectId', 'version', 'locator', 'sha256']) mutations.push([`pin ${key}`, m => { m.entries[0].definitionRef[key] = 'foreign'; }, /PIN_DRIFT/]);
for (const [name, mutate, error] of mutations) test(`mapping rejects ${name}`, async () => {
  const m = structuredClone(mapping); mutate(m); await assert.rejects(create(m), error);
});
test('same resealed pin in Provider and map still requires reviewed mapping change', async () => {
  const m = structuredClone(mapping), row = m.entries[0], metric = structuredClone(provider.get(row.industryId, row.metricId));
  row.definitionRef.sha256 = 'a'.repeat(64); metric.entry.definitionRef = row.definitionRef; metric.owner.definitionRef = row.definitionRef;
  const p = { ...provider, get: (industry, id) => id === row.metricId ? metric : provider.get(industry, id) };
  await assert.rejects(create(m, p), /REVIEW_DRIFT/);
});
test('new Provider metric without mapping cannot silently shrink the snapshot roster', async () => {
  const p = { ...provider, list: id => [...provider.list(id), { entry: { metricId: 'UNMAPPED', industryId: id } }] };
  const d = await create(mapping, p); assert.throws(() => d.list('oil-shipping'), /MAPPING_MISSING/);
});
test('three baseline source-fact owners, pins, raw bytes and V1 schema are byte stable', () => {
  const baseline = read('scripts/tests/fixtures/industry-slice-5-baseline.json');
  for (const [path, digest] of Object.entries(baseline.sha256)) assert.equal(sha256(bytes(path)), digest, path);
  for (const entry of baseline.entries) assert.deepEqual(registry.entries.find(e => e.metricId === entry.metricId), entry);
});
