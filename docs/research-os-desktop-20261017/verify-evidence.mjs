// Run from repository root. disk checks files; index/HEAD verifies actual Git blobs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const mode = process.argv[2] || 'disk';
assert(['disk', 'index', 'HEAD'].includes(mode));
const read = file => mode === 'disk' ? readFileSync(file) : execFileSync('git', ['show', `${mode === 'index' ? '' : 'HEAD'}:${file}`], { maxBuffer: 16 * 1024 * 1024 });
const manifests = [
  'docs/research-os-round1-20261016/evidence/evidence-manifest.json',
  'docs/research-os-round1-20261016/remediation-r1/evidence/evidence-manifest.json',
  'docs/research-os-desktop-20261017/evidence-manifest.json',
];
const verified = manifests.map(file => {
  const manifest = JSON.parse(read(file));
  for (const entry of manifest.files) {
    const bytes = read(path.join(path.dirname(file), entry.file));
    assert.equal(bytes.length, entry.bytes, entry.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
  }
  return { manifest: file, files: manifest.files.length, status: 'passed' };
});
const code = '34e23a4eee12d8a84b8d3306249fe913e2a07cd4';
assert.equal(execFileSync('git', ['diff', code, '--', 'src', 'scripts', 'package.json', 'package-lock.json', 'vercel.json', '.github'], { encoding: 'utf8' }), '');
assert.equal(execFileSync('git', ['diff', code, '--', 'docs/research-os-round1-20261016'], { encoding: 'utf8' }), '');
console.log(JSON.stringify({ status: 'passed', mode, verified, runtimeUnchangedFromTestedCode: code }, null, 2));
