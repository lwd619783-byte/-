// Local reproducible command receipts; output stays in ignored data-cache until reviewed.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [label, command, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label || '') || !command) throw Error('label and command required');
const root = 'data-cache/round-one-evidence';
mkdirSync(root, { recursive: true });
const startedAt = new Date().toISOString();
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const worktree = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: process.env });
const log = (result.stdout || '') + (result.stderr || '') + (result.error?.message || '');
writeFileSync(`${root}/${label}.log`, log);
const receipt = { label, command: [command, ...args], sha, worktree, node: process.version, startedAt, endedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal, log: `${label}.log`, logSha256: createHash('sha256').update(log).digest('hex') };
writeFileSync(`${root}/${label}.json`, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
console.log(log.slice(-2000));
process.exitCode = result.status ?? 1;
