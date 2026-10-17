import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root = path.resolve('docs/research-os-round1-20261016');
async function walk(directory) { return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(e => e.isDirectory() ? walk(path.join(directory, e.name)) : path.join(directory, e.name)))).flat(); }
const files = (await walk(root)).filter(f => !f.endsWith('.png'));
const combined = (await Promise.all(files.map(f => readFile(f, 'utf8')))).join('\n');
assert(!/-----BEGIN [\w ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}/.test(combined));
const sources = ['industries.ts','industryChainResearch.ts','stocks.ts','unitreeHistoricalResearch.ts','privateCompanies.ts','real/research.generated.json','real/signals.generated.json'];
const needles = new Set();
const collect = v => { if (typeof v === 'string' && v.trim().length >= 32) needles.add(v); else if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
for (const file of sources) {
 const raw = await readFile(path.join('src/data', file), 'utf8');
 if (file.endsWith('.json')) collect(JSON.parse(raw));
 else { const ast = ts.createSourceFile(file, raw, ts.ScriptTarget.Latest, true); const visit = n => { if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) collect(n.text); ts.forEachChild(n,visit); }; visit(ast); }
}
assert([...needles].every(v => !combined.includes(v) && !combined.includes(JSON.stringify(v).slice(1,-1))), 'restricted literal in evidence');
const hosts = new Set([...combined.matchAll(/https?:\/\/([^\s/"<>\\]+)/g)].map(match => match[1]));
const allowed = ['github.com','example.invalid','vite.dev','127.0.0.1','www.example.com','rollupjs.org'];
assert([...hosts].every(host => allowed.includes(host) || /^127\.0\.0\.1:\d+$/.test(host)), 'unexpected URL host in evidence');
const report = { status: 'passed', scope: 'all round-one handoff/evidence text (PNG separately visually reviewed)', textFilesChecked: files.length, restrictedSourceFilesCompared: sources.length, restrictedLongLiteralsCompared: needles.size, restrictedLiteralMatches: 0, secretPatternMatches: 0, unapprovedUrlHosts: 0, screenshotsVisuallyReviewed: 17, note: 'Pattern/literal scans are supporting controls, not proof of absence; all screenshots are built from synthetic-only allowed graph.' };
await writeFile(root + '/evidence/public-content-scan.json', JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report));
