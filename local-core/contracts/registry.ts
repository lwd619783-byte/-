import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import type { AnySchemaObject, ValidateFunction } from 'ajv';
import type { ContractRegistry } from '../ports/index.js';
import { fail } from '../domain/errors.js';
import { projectRoot } from '../paths.js';

export const contractDirectory = path.join(projectRoot, 'contracts', 'v1');
export type ContractDocuments = Record<string, AnySchemaObject>;
export function loadContractDocuments(directory = contractDirectory): ContractDocuments {
  try {
    return Object.fromEntries(readdirSync(directory).filter((name) => name.endsWith('.json')).sort()
      .map((name) => [name, JSON.parse(readFileSync(path.join(directory, name), 'utf8')) as AnySchemaObject]));
  } catch {
    return fail('CONTRACT_INVALID', 'Unable to read V1 contract documents.');
  }
}
function invariant(valid: unknown, message: string): asserts valid {
  if (!valid) fail('CONTRACT_INVALID', message);
}
function overlaps(left: string, right: string): boolean {
  return left === right || left === '*' || right === '*' ||
    (left.endsWith('.*') && right.startsWith(left.slice(0, -1))) ||
    (right.endsWith('.*') && left.startsWith(right.slice(0, -1)));
}
export function validateStaticInvariants(documents: ContractDocuments): void {
  const modules = documents['industry-module-registry.v1.json'];
  invariant(modules?.schemaVersion === 'industry-module-registry.v1', 'Frozen module registry version required.');
  invariant(Array.isArray(modules.modules) && modules.modules.length === 14, 'M0-M13 must occur exactly once.');
  const ids = modules.modules.map((item: { moduleId?: unknown; canonicalNameZh?: unknown }) => {
    invariant(typeof item.canonicalNameZh === 'string' && item.canonicalNameZh.trim(), 'Module canonical name must not be empty.');
    return item.moduleId;
  });
  invariant(new Set(ids).size === 14 && ids.every((id: unknown) => typeof id === 'string' && /^M(?:[0-9]|1[0-3])$/.test(id)), 'Module IDs must be unique M0-M13.');
  const permissions = documents['permissions.v1.json'];
  invariant(permissions?.schemaVersion === 'permissions.v1', 'Frozen permissions version required.');
  const ai = permissions.roles?.AI_RESEARCHER;
  invariant(ai && [ai.allow, ai.confirmedOnly, ai.deny].every((items) => Array.isArray(items) && items.every((item: unknown) => typeof item === 'string')), 'AI permission lists required.');
  invariant(['trade.execute', 'broker.order.create', 'sql.execute', 'database.write_raw', 'database.delete_raw', 'history.hard_delete', 'audit.delete', 'schema.migrate', 'secret.*'].every((op) => ai.deny.includes(op)), 'AI hard-deny operations must remain denied.');
  invariant(!ai.deny.some((deny: string) => [...ai.allow, ...ai.confirmedOnly].some((allow: string) => overlaps(deny, allow))), 'AI hard-deny overlaps allowed permissions.');
  const cases = documents['contract-test-cases.v1.json'];
  invariant(cases?.schemaVersion === 'contract-test-cases.v1' && Array.isArray(cases.cases), 'Frozen test registry required.');
  const caseIds = cases.cases.map((item: { id?: unknown }) => item.id);
  invariant(caseIds.length > 0 && caseIds.every((id: unknown) => typeof id === 'string' && id.trim()) && new Set(caseIds).size === caseIds.length, 'Contract case IDs must be nonempty and unique.');
  const entity = documents['entity-resolution.v1.schema.json'];
  invariant(entity?.$defs?.ResolutionResult?.properties?.allowAutoCreate?.const === false, 'allowAutoCreate must remain false.');
  invariant(entity?.$defs?.ResolutionResult?.required?.includes('allowAutoCreate'), 'allowAutoCreate must be required.');
}

export class V1ContractRegistry implements ContractRegistry {
  readonly versions: readonly string[];
  readonly schemaCount: number;
  readonly definitionCount: number;
  readonly declaredCases: readonly { id: string; status: 'declared / not-yet-executable' }[];
  readonly #validators = new Map<string, ValidateFunction>();
  constructor(documents = loadContractDocuments()) {
    try {
      validateStaticInvariants(documents);
      // strictRequired is intentionally false: frozen conditional `then.required`
      // refers to properties declared in its parent. Unknown refs/formats stay fatal.
      const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, validateFormats: true, ownProperties: true });
      const addFormats = formats as unknown as (validator: Ajv2020) => void;
      addFormats(ajv);
      const schemas = Object.entries(documents).filter(([name]) => name.endsWith('.schema.json'));
      invariant(schemas.length === 5, 'All five frozen V1 schemas are required.');
      for (const [filename, schema] of schemas) {
        invariant(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'Draft 2020-12 required.');
        invariant(schema.$id === `https://investment-dashboard.local/contracts/v1/${filename}`, 'Frozen schema identity required.');
        ajv.addSchema(schema);
      }
      let definitions = 0;
      for (const [, schema] of schemas) {
        invariant(typeof schema.$id === 'string', 'Schema ID required.');
        invariant(ajv.getSchema(schema.$id), 'Root schema compilation failed.');
        for (const [name, definition] of Object.entries({ '': schema, ...(schema.$defs ?? {}) }) as [string, AnySchemaObject][]) {
          const validator = ajv.getSchema(`${schema.$id}${name ? `#/$defs/${name}` : ''}`);
          invariant(validator, 'Definition compilation failed.');
          if (name) definitions += 1;
          for (const key of ['schemaVersion', 'contractVersion']) {
            const version = definition.properties?.[key]?.const;
            if (version !== undefined) {
              invariant(typeof version === 'string' && version.endsWith('.v1') && !this.#validators.has(version), 'Frozen versions must be unique V1 constants.');
              this.#validators.set(version, validator);
            }
          }
        }
      }
      this.schemaCount = schemas.length;
      this.definitionCount = definitions;
      this.versions = Object.freeze([...this.#validators.keys()].sort());
      // No entire business case is implemented in 1A. S-001 has static evidence,
      // but its future MCP non-exposure rule cannot yet be marked executed.
      this.declaredCases = Object.freeze(documents['contract-test-cases.v1.json']!.cases.map((item: { id: string }) => ({ id: item.id, status: 'declared / not-yet-executable' as const })));
    } catch {
      fail('CONTRACT_INVALID', 'V1 schema compilation or static invariant failed.');
    }
  }
  validate(version: string, value: unknown): void {
    const validator = this.#validators.get(version);
    if (!validator || !validator(value)) fail('CONTRACT_INVALID', 'Payload does not satisfy the requested frozen V1 contract.');
  }
}
