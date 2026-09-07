import { existsSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail } from './domain/errors.js';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

function physicalPath(value: string): string {
  const absolute = path.resolve(value);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = path.dirname(absolute);
  return parent === absolute ? absolute : path.join(physicalPath(parent), path.basename(absolute));
}
function within(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export function localDataLayout(root = process.env.INVESTMENT_DASHBOARD_DATA_DIR ?? path.join(homedir(), '.investment-research-dashboard')) {
  if (!path.isAbsolute(root)) fail('DATABASE_OPEN_FAILED', 'Local data root must be absolute.');
  return {
    root,
    database: path.join(root, 'data', 'investment-dashboard.sqlite'),
    directories: ['data', 'archive', 'attachments', 'backup'].map((part) => path.join(root, part)),
  };
}
export function assertSafeDatabasePath(filename: string, purpose: 'local' | 'test'): void {
  if (filename === ':memory:') return;
  if (!filename || !path.isAbsolute(filename)) fail('DATABASE_OPEN_FAILED', 'Database path must be explicit and absolute.');
  // Reject a real user path before even stat/realpath; tests never inspect it.
  if (purpose === 'test' && (!within(path.resolve(filename), path.resolve(tmpdir())) || within(path.resolve(filename), path.join(homedir(), '.investment-research-dashboard')))) {
    fail('DATABASE_OPEN_FAILED', 'Tests require an OS temporary database or :memory:.');
  }
  const resolved = physicalPath(filename);
  if (purpose === 'test') {
    if (!within(resolved, physicalPath(tmpdir())) || within(resolved, physicalPath(path.join(homedir(), '.investment-research-dashboard')))) {
      fail('DATABASE_OPEN_FAILED', 'Tests require an OS temporary database or :memory:.');
    }
  }
  // Reject source trees (including nested worktrees) and symlink escapes from .local-data.
  for (let current = path.dirname(resolved); ; current = path.dirname(current)) {
    if (existsSync(path.join(current, '.git'))) {
      if (!within(resolved, path.join(current, '.local-data'))) fail('DATABASE_OPEN_FAILED', 'Repository databases are restricted to .local-data.');
      // The closest checkout owns this path, even inside an unrelated parent repo.
      break;
    }
    if (path.dirname(current) === current) break;
  }
}
