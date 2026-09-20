// Compile only the new projection contract; frozen V1 permissions/registries are unchanged.
import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Match the frozen registry: its conditional required fields are declared in parent schemas.
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, ownProperties: true });
addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(new URL('../../contracts/v1/entity-resolution.v1.schema.json', import.meta.url), 'utf8')));
for (const file of ['research-extraction.schema.json', 'creator-projection.schema.json']) {
  const schema = JSON.parse(readFileSync(new URL(`../../contracts/research-extraction/v1/${file}`, import.meta.url), 'utf8'));
  ajv.addSchema(schema);
  for (const name of Object.keys(schema.$defs)) {
    if (!ajv.getSchema(`${schema.$id}#/$defs/${name}`)) throw new Error('RESEARCH_EXTRACTION_SCHEMA_MISSING');
  }
  console.log(`Research Source / Extraction V1: ${file}, ${Object.keys(schema.$defs).length} definitions compiled (no admission).`);
}
