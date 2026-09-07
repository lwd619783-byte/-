import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectSkill, loadRegistry, projectRoot, safePath } from './setup-codex-skills.mjs';

export function skillCommand(name, args, root = projectRoot, registry = loadRegistry(root)) {
  const skill = registry.externalSkills.find((entry) => entry.name === name);
  if (!skill) throw new Error('Unsupported managed runtime.');
  const check = inspectSkill(root, name, skill);
  if (check.status !== 'PASS') throw new Error(`${name}: ${check.message}`);
  const base = safePath(root, `.agents/skills/${name}`);
  const env = {
    ...process.env,
    ARCHIFY_UPDATE_CHECK_DISABLED: '1',
    IMPECCABLE_NO_UPDATE_CHECK: '1',
    IMPECCABLE_NO_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
    DISABLE_TELEMETRY: '1',
    IMPECCABLE_HOME: safePath(root, 'data-cache/agent-skills/impeccable'),
    IMPECCABLE_SKILL_DIR: base,
  };
  if (name === 'archify') {
    const allowed = new Set(['doctor', 'guide', 'examples', 'validate', 'render', 'deliver', 'compare', 'inspect', 'check', 'check-update']);
    if (!allowed.has(args[0]) || args.some((arg) => arg === '--open' || arg.startsWith('--open='))) {
      throw new Error('Archify project mode excludes preview, browser/background processes, remote brand capture and initialization.');
    }
    if (args[0] === 'check-update') {
      if (args.length !== 1) throw new Error('Disabled update checker takes no arguments.');
      return { command: process.execPath, args: [path.join(base, 'scripts/check-update.mjs')], env };
    }
    return { command: process.execPath, args: [path.join(base, 'bin/archify.mjs'), ...args], env };
  }
  if (name === 'impeccable') {
    if (!['context', 'detect', 'engine-probe', '--version', '--help'].includes(args[0])) {
      throw new Error('Impeccable project mode allows context/detect only; install, init, update, hooks, live and configuration commands are excluded.');
    }
    // Direct verified engine; never fall back to PATH, a user cache or a downloader.
    const binary = skill.binaries[`${process.platform}-${process.arch}`];
    return { command: safePath(root, `.agents/skills/${name}/${binary.file}`), args, env };
  }
  throw new Error('This Skill is instruction-only in the project.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [name, ...args] = process.argv.slice(2);
    const invocation = skillCommand(name, args);
    const result = spawnSync(invocation.command, invocation.args, { cwd: projectRoot, env: invocation.env, shell: false, windowsHide: true, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
