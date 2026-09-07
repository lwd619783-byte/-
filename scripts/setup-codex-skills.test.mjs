import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkSkills, digest, downloadFile, loadRegistry, safePath, setupSkills, skillHealth, validateRegistry } from './setup-codex-skills.mjs';
import { skillCommand } from './run-codex-skill.mjs';

let root;
let registry;
const body = Buffer.from('---\nname: archify\ndescription: Fixture architecture skill.\n---\nFixture only.\n');
const projectBody = '---\nname: project-fixture\ndescription: Fixture project workflow.\n---\n';
function write(relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
function installed() { write('.agents/skills/archify/SKILL.md', body); }
function snapshot(directory = root) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? snapshot(target) : [{ path: path.relative(root, target), mtime: fs.statSync(target).mtimeMs, hash: digest(fs.readFileSync(target), true) }];
  });
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-test-'));
  registry = {
    version: 1,
    projectSkills: ['project-fixture'],
    externalSkills: [{ name: 'archify', repository: 'example/fixture', commit: 'a'.repeat(40), sourceRoot: 'skill', files: { 'SKILL.md': digest(body) } }],
  };
  write('.agents/skills/project-fixture/SKILL.md', projectBody);
  write('config/agent-skills.lock.json', JSON.stringify(registry));
});
afterEach(() => {
  vi.unstubAllGlobals();
  // Only remove the unique temp directory created by this test.
  const relative = path.relative(fs.realpathSync(os.tmpdir()), fs.realpathSync(root));
  if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('agent-skills-test-')) throw new Error('Unsafe fixture cleanup.');
  fs.rmSync(root, { recursive: true });
});

describe('managed Skill supply chain and project boundaries', () => {
  it('retries transient downloads but never retries missing or forbidden sources', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response(body));
    vi.stubGlobal('fetch', request);
    expect(await downloadFile('https://raw.githubusercontent.com/example/fixture/a/SKILL.md')).toEqual(body);
    expect(request).toHaveBeenCalledTimes(2);
    request.mockClear().mockResolvedValue(new Response('', { status: 404 }));
    await expect(downloadFile('https://raw.githubusercontent.com/example/fixture/a/SKILL.md')).rejects.toThrow('404');
    expect(request).toHaveBeenCalledTimes(1);
    request.mockClear();
    await expect(downloadFile('https://untrusted.invalid/SKILL.md')).rejects.toThrow('host refused');
    expect(request).not.toHaveBeenCalled();
  });
  it('checks missing copies without creating files and reports an optional environment warning', () => {
    const before = snapshot();
    expect(checkSkills(root, registry).at(-1).status).toBe('MISSING');
    expect(skillHealth(root).at(-1).status).toBe('WARN');
    expect(snapshot()).toEqual(before);
  });
  it('downloads only an immutable allowlisted file, then skips without network or writes', async () => {
    const download = vi.fn(async () => body);
    await setupSkills(root, registry, download, () => {});
    expect(download).toHaveBeenCalledWith(`https://raw.githubusercontent.com/example/fixture/${'a'.repeat(40)}/skill/SKILL.md`, false);
    const before = snapshot();
    download.mockClear();
    await setupSkills(root, registry, download, () => {});
    expect(download).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
    expect(checkSkills(root, registry).every((check) => check.status === 'PASS')).toBe(true);
  });
  it('rejects altered downloads before creating a Skill', async () => {
    const before = snapshot();
    await expect(setupSkills(root, registry, async () => Buffer.from('tampered'), () => {})).rejects.toThrow('content mismatch');
    expect(snapshot()).toEqual(before);
    expect(fs.existsSync(path.join(root, '.agents/skills/archify'))).toBe(false);
  });
  it('does not overwrite an existing edited or incomplete copy', async () => {
    write('.agents/skills/archify/SKILL.md', Buffer.concat([body, Buffer.from('user edit')]));
    const before = snapshot(), download = vi.fn();
    expect(checkSkills(root, registry).at(-1).status).toBe('FAIL');
    await expect(setupSkills(root, registry, download)).rejects.toThrow('preflight');
    expect(download).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });
  it('fails the entire preflight when a project workflow is missing', async () => {
    fs.unlinkSync(path.join(root, '.agents/skills/project-fixture/SKILL.md'));
    const download = vi.fn();
    await expect(setupSkills(root, registry, download)).rejects.toThrow('preflight');
    expect(download).not.toHaveBeenCalled();
  });
  it('refuses a concurrent destination without overwriting it', async () => {
    const download = async () => { write('.agents/skills/archify/user.txt', 'keep'); return body; };
    await expect(setupSkills(root, registry, download, () => {})).rejects.toThrow();
    expect(fs.readFileSync(path.join(root, '.agents/skills/archify/user.txt'), 'utf8')).toBe('keep');
    expect(fs.existsSync(path.join(root, '.agents/skills/archify/SKILL.md'))).toBe(false);
  });
  it('does not follow a linked Skill directory into another installation', async () => {
    const target = write('outside/SKILL.md', body);
    fs.symlinkSync(path.dirname(target), path.join(root, '.agents/skills/archify'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(checkSkills(root, registry).at(-1).message).toContain('Linked path');
    const download = vi.fn();
    await expect(setupSkills(root, registry, download)).rejects.toThrow('preflight');
    expect(download).not.toHaveBeenCalled();
    expect(fs.readFileSync(target)).toEqual(body);
    fs.unlinkSync(path.join(root, '.agents/skills/archify'));
  });
  it('rejects traversal paths, floating sources and duplicate names', () => {
    expect(() => safePath(root, '../escape')).toThrow('Unsafe');
    expect(() => safePath(root, '/absolute')).toThrow('Unsafe');
    registry.externalSkills[0].commit = 'main';
    expect(() => validateRegistry(registry)).toThrow('Immutable');
    registry.externalSkills[0].commit = 'a'.repeat(40);
    registry.externalSkills[0].files['../outside'] = digest(body);
    expect(() => validateRegistry(registry)).toThrow('Unsafe');
    delete registry.externalSkills[0].files['../outside'];
    registry.projectSkills.push('archify');
    expect(() => validateRegistry(registry)).toThrow('Duplicate');
  });
  it('fails on an extra hook or unmanaged Skill without deleting it', () => {
    installed();
    write('.agents/skills/archify/hooks.json', '{}');
    write('.agents/skills/broad-pack/SKILL.md', 'keep');
    expect(checkSkills(root, registry).filter((check) => check.status === 'FAIL')).toHaveLength(2);
    expect(fs.existsSync(path.join(root, '.agents/skills/broad-pack/SKILL.md'))).toBe(true);
  });
  it('accepts CRLF checkouts but still detects semantic edits', () => {
    expect(digest(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), body]))).not.toBe(digest(body));
    expect(() => digest(Buffer.from([0xff]))).toThrow();
    write('.agents/skills/archify/SKILL.md', body.toString().replace(/\n/g, '\r\n'));
    expect(checkSkills(root, registry).at(-1).status).toBe('PASS');
    write('.agents/skills/archify/SKILL.md', body.toString().replace('Fixture only.', 'Changed.'));
    expect(checkSkills(root, registry).at(-1).status).toBe('FAIL');
  });
  it('runs --check as a read-only CLI, with nonzero status for missing copies and bad arguments', () => {
    const source = fs.readFileSync(fileURLToPath(new URL('./setup-codex-skills.mjs', import.meta.url)));
    const script = write('scripts/setup-codex-skills.mjs', source);
    const before = snapshot();
    const missing = spawnSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain('MISSING archify');
    expect(snapshot()).toEqual(before);
    installed();
    const after = snapshot();
    expect(spawnSync(process.execPath, [script, '--check'], { cwd: root }).status).toBe(0);
    expect(spawnSync(process.execPath, [script, '--force'], { cwd: root }).status).toBe(1);
    expect(snapshot()).toEqual(after);
  });
  it('scopes runtime environment without starting a process and blocks unsafe entrypoints', () => {
    installed();
    const before = snapshot();
    const original = process.env.ARCHIFY_UPDATE_CHECK_DISABLED;
    const command = skillCommand('archify', ['check-update'], root, registry);
    expect(command.env.ARCHIFY_UPDATE_CHECK_DISABLED).toBe('1');
    expect(command.env.IMPECCABLE_NO_UPDATE_CHECK).toBe('1');
    expect(command.env.IMPECCABLE_NO_TELEMETRY).toBe('1');
    expect(process.env.ARCHIFY_UPDATE_CHECK_DISABLED).toBe(original);
    for (const args of [['preview'], ['brands', 'capture'], ['deliver', '--open'], ['check-update', '--ack', 'x']]) {
      expect(() => skillCommand('archify', args, root, registry)).toThrow();
    }
    expect(snapshot()).toEqual(before);
  });
  it('validates the checked-in pin manifest without needing installed external Skills', () => {
    const real = loadRegistry();
    expect(real.projectSkills).toHaveLength(4);
    expect(real.externalSkills.map((skill) => skill.name)).toEqual(['redesign-existing-projects', 'impeccable', 'archify', 'diagram-design']);
    for (const skill of real.externalSkills) expect(skill.commit).toMatch(/^[a-f0-9]{40}$/);
  });
});
