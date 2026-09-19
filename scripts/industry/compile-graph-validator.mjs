// Offline compiler only. Browser consumes the generated pure validator, never Ajv.
import fs from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const paths = ['contracts/financial-research/v1/evidence-graph.v1.schema.json', 'contracts/financial-research/v1/shared.schema.json', 'contracts/v1/research-asset-os.contracts.v1.schema.json'];
const raw = paths.map(p => fs.readFileSync(p, 'utf8'));
const [graph, shared, asset] = raw.map(JSON.parse);
const ajv = new Ajv2020({ strict: true, strictRequired: false, ownProperties: true, code: { source: true, esm: true, lines: true } });
addFormats(ajv);
ajv.addSchema(asset); ajv.addSchema(shared);
const check = ajv.compile(graph);
// Bundle only the standalone validator's pure equality/Unicode/format helpers.
// Neither compiler, Node APIs, dynamic require nor schema mutation enters the browser.
const compiled = await build({ stdin: { contents: standaloneCode(ajv, check), resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', format: 'esm' });
const output = '// Generated from unchanged F2 V1 schemas by scripts/industry/compile-graph-validator.mjs.\n'
  + '// Source digests: ' + raw.map(s => createHash('sha256').update(s).digest('hex')).join(' ') + '\n'
  + ['ajv', 'ajv-formats', 'fast-deep-equal'].map(name => `/*! ${name} runtime helper license\n${fs.readFileSync(`node_modules/${name}/LICENSE`, 'utf8')}\n*/\n`).join('')
  + compiled.outputFiles[0].text;
const target = 'src/services/evidenceGraphValidator.generated.mjs';
if (process.argv.includes('--write')) fs.writeFileSync(target, output);
else if (fs.readFileSync(target, 'utf8') !== output) {
  const actual = fs.readFileSync(target, 'utf8');
  let prefix = 0;
  while (prefix < actual.length && prefix < output.length && actual[prefix] === output[prefix]) prefix++;
  let suffix = 0;
  while (suffix < actual.length - prefix && suffix < output.length - prefix
    && actual[actual.length - 1 - suffix] === output[output.length - 1 - suffix]) suffix++;
  const version = name => JSON.parse(fs.readFileSync(`node_modules/${name}/package.json`, 'utf8')).version;
  console.error(JSON.stringify({
    code: 'F2_GENERATED_VALIDATOR_DRIFT',
    actualSha256: createHash('sha256').update(actual).digest('hex'),
    expectedSha256: createHash('sha256').update(output).digest('hex'),
    actualLength: actual.length,
    expectedLength: output.length,
    commonPrefix: prefix,
    commonSuffix: suffix,
    versions: { ajv: version('ajv'), ajvFormats: version('ajv-formats'), fastDeepEqual: version('fast-deep-equal'), esbuild: version('esbuild') },
    actualAroundFirstDiff: actual.slice(Math.max(0, prefix - 160), prefix + 320),
    expectedAroundFirstDiff: output.slice(Math.max(0, prefix - 160), prefix + 320),
  }));
  throw new Error('F2_GENERATED_VALIDATOR_DRIFT');
}
console.log('F2 generated validator: PASS');
