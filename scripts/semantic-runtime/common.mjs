import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const unique = (values) => [...new Set(values)].sort();
export const instant = (value) => typeof value === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
export function bytes(owner, root = ROOT) {
  if (typeof owner !== 'string' || path.isAbsolute(owner) || owner.split(/[\\/]/).includes('..')) throw new Error('OWNER_PATH');
  const resolved = realpathSync(path.resolve(root, owner));
  const relative = path.relative(realpathSync(root), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('OWNER_PATH');
  return readFileSync(resolved);
}
export const read = (owner, root = ROOT) => JSON.parse(bytes(owner, root).toString('utf8'));
export function pointer(object, locator) {
  if (!/^\//.test(locator) || /~(?![01])/u.test(locator)) throw new Error('PIN_LOCATOR');
  for (const part of locator.slice(1).split('/').map((s) => s.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (object === null || typeof object !== 'object' || !Object.hasOwn(object, part)) throw new Error('PIN_LOCATOR');
    object = object[part];
  }
  return object;
}
export function pin(owner, locator, objectId, version, root = ROOT) {
  return { owner, locator, objectId, version, sha256: sha256(bytes(owner, root)) };
}
export function resolve(ref, root = ROOT) {
  const content = bytes(ref.owner, root);
  if (sha256(content) !== ref.sha256) throw new Error('PIN_DIGEST');
  return pointer(JSON.parse(content), ref.locator);
}
export const refName = (ref) => `${ref.owner}#${ref.locator}`;
export function periodBounds(valueDate) {
  if (!/^\d{4}-\d{2}(?:-\d{2})?$/.test(valueDate)) return null;
  const start = valueDate.length === 7 ? valueDate + '-01' : valueDate;
  if (!Number.isFinite(Date.parse(start)) || new Date(start).toISOString().slice(0, 10) !== start) return null;
  const end = valueDate.length === 7 ? new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 0)).toISOString().slice(0, 10) : start;
  return { start, end };
}
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
addFormats(ajv);
for (const owner of ['contracts/v1/research-asset-os.contracts.v1.schema.json', 'config/market-regime/observation-catalog.schema.json', 'contracts/financial-research/v1/shared.schema.json']) ajv.addSchema(read(owner));
export function valid(schemaId, value) { return ajv.getSchema(schemaId)(value); }
export const CATALOG = 'urn:investment-research-dashboard:market-regime:observation-catalog:v1';
export const QUERY = 'https://investment-dashboard.local/contracts/financial-research/v1/shared.schema.json#/$defs/Query';
