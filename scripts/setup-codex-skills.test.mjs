import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkSkills, digest, downloadFile, loadRegistry, projectRoot, safePath, setupSkills, skillHealth, validateRegistry } from './setup-codex-skills.mjs';
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
function impeccableFixture() {
  const source = Buffer.from(body.toString().replace('name: archify', 'name: impeccable'));
  const license = Buffer.from('Upstream license fixture\n'), engine = Buffer.from('inert engine fixture');
  const skill = {
    name: 'impeccable', installPath: '.agents/vendor/impeccable', repository: 'example/fixture',
    commit: 'b'.repeat(40), sourceRoot: 'skill', engineVersion: '0.1.0',
    files: { 'SKILL.md': digest(source), LICENSE: digest(license) }, extraSources: { LICENSE: 'LICENSE' },
    binaries: { [`${process.platform}-${process.arch}`]: {
      file: 'scripts/engine-fixture', sha256: digest(engine, true),
      url: 'https://github.com/example/fixture/releases/download/engine-v0.1.0/engine-fixture',
    } },
  };
  registry.externalSkills = [skill];
  const facade = 'investment-dashboard-impeccable-workflow';
  registry.projectSkills.push(facade);
  write(`.agents/skills/${facade}/SKILL.md`, projectBody.replace('project-fixture', facade));
  write('config/agent-skills.lock.json', JSON.stringify(registry));
  const download = vi.fn(async (url, binary) => binary ? engine : url.endsWith('/LICENSE') ? license : source);
  return { skill, source, license, engine, download };
}
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
  vi.unstubAllEnvs();
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
    for (const args of [['examples'], ['preview'], ['visual-check'], ['brands', 'capture'], ['demo'], ['migrate'], ['updater'], ['deliver', '--open'], ['check-update', '--ack', 'x']]) {
      expect(() => skillCommand('archify', args, root, registry)).toThrow();
    }
    for (const name of ['doctor', 'guide', 'validate', 'render', 'deliver', 'compare', 'inspect', 'check']) {
      expect(skillCommand('archify', [name], root, registry).args.at(-1)).toBe(name);
    }
    expect(snapshot()).toEqual(before);
  });
  it('installs licensed upstream Impeccable outside discovery through the existing download pipeline', async () => {
    const { skill, license, download } = impeccableFixture();
    await setupSkills(root, registry, download, () => {});
    expect(fs.existsSync(path.join(root, '.agents/skills/impeccable'))).toBe(false);
    expect(fs.readFileSync(path.join(root, skill.installPath, 'LICENSE'))).toEqual(license);
    expect(download).toHaveBeenCalledWith(`https://raw.githubusercontent.com/example/fixture/${skill.commit}/LICENSE`, false);
    expect(checkSkills(root, registry).every(check => check.status === 'PASS')).toBe(true);
    const before = snapshot();
    await setupSkills(root, registry, vi.fn(() => { throw new Error('Unexpected download'); }), () => {});
    expect(snapshot()).toEqual(before);
    skill.installPath = '.agents/skills/impeccable';
    expect(() => validateRegistry(registry)).toThrow('installation path');
  });
  it('selects only the verified vendor engine and rejects unsafe Impeccable commands', async () => {
    const { skill, download } = impeccableFixture();
    await setupSkills(root, registry, download, () => {});
    vi.stubEnv('IMPECCABLE_BIN', path.join(root, 'untrusted-engine'));
    const before = snapshot();
    const command = skillCommand('impeccable', ['engine-probe'], root, registry);
    expect(command.command).toBe(path.join(root, skill.installPath, 'scripts/engine-fixture'));
    expect(command.env.IMPECCABLE_SKILL_DIR).toBe(path.join(root, skill.installPath));
    expect(command.env.IMPECCABLE_NO_UPDATE_CHECK).toBe('1');
    expect(command.env.IMPECCABLE_NO_TELEMETRY).toBe('1');
    for (const verb of ['install', 'init', 'hooks', 'mcp', 'plugin', 'live', 'update', 'config', 'pin']) {
      expect(() => skillCommand('impeccable', [verb], root, registry)).toThrow('excluded');
    }
    expect(snapshot()).toEqual(before);
  });
  it.each([
    ['missing license', 'LICENSE', null],
    ['license drift', 'LICENSE', 'changed'],
    ['source drift', 'SKILL.md', 'changed'],
    ['missing engine', 'scripts/engine-fixture', null],
    ['engine drift', 'scripts/engine-fixture', 'changed'],
    ['unknown file', 'hooks.json', '{}'],
  ])('fails closed on vendor %s without repair or fallback', async (_label, file, content) => {
    const { skill, download } = impeccableFixture();
    await setupSkills(root, registry, download, () => {});
    if (content === null) fs.unlinkSync(path.join(root, skill.installPath, file));
    else write(`${skill.installPath}/${file}`, content);
    const before = snapshot();
    expect(skillHealth(root).at(-1).status).toBe('FAIL');
    expect(() => skillCommand('impeccable', ['context'], root, registry)).toThrow();
    await expect(setupSkills(root, registry, vi.fn())).rejects.toThrow('preflight');
    expect(snapshot()).toEqual(before);
  });
  it('refuses missing vendors, discoverable legacy copies and vendor directory links', async () => {
    const { skill, source } = impeccableFixture();
    expect(checkSkills(root, registry).at(-1).status).toBe('MISSING');
    expect(() => skillCommand('impeccable', ['context'], root, registry)).toThrow('missing');
    const legacy = write('.agents/skills/impeccable/SKILL.md', source);
    const before = snapshot();
    await expect(setupSkills(root, registry, vi.fn())).rejects.toThrow('preflight');
    expect(() => skillCommand('impeccable', ['context'], root, registry)).toThrow('Discoverable');
    expect(snapshot()).toEqual(before);
    fs.unlinkSync(legacy);
    fs.rmdirSync(path.dirname(legacy));
    const outside = write('outside/SKILL.md', source);
    fs.mkdirSync(path.join(root, '.agents/vendor'));
    fs.symlinkSync(path.dirname(outside), path.join(root, skill.installPath), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => skillCommand('impeccable', ['context'], root, registry)).toThrow('Linked path');
    fs.unlinkSync(path.join(root, skill.installPath));
  });
  it('keeps a tracked discoverable facade with a coordinator-only description', () => {
    const facade = 'investment-dashboard-impeccable-workflow';
    const relative = `.agents/skills/${facade}/SKILL.md`;
    expect(loadRegistry().projectSkills).toContain(facade);
    expect(execFileSync('git', ['ls-files', '--error-unmatch', relative], { cwd: projectRoot, encoding: 'utf8' }).trim()).toBe(relative);
    const content = fs.readFileSync(path.join(projectRoot, relative), 'utf8');
    const description = content.match(/^description: (.+)$/m)?.[1];
    expect(description).toMatch(/only after investment-dashboard-ui-workflow/i);
    expect(description).toMatch(/Never self-trigger for ordinary copy, spacing or small CSS edits/);
    expect(description).toMatch(/No automatic init, hooks, MCP, live, update, global configuration writes or dependency installation/);
  });
  it('validates the checked-in pin manifest without needing installed external Skills', () => {
    const real = loadRegistry();
    expect(real.projectSkills).toHaveLength(5);
    expect(real.externalSkills.map((skill) => skill.name)).toEqual(['redesign-existing-projects', 'impeccable', 'archify', 'diagram-design']);
    for (const skill of real.externalSkills) expect(skill.commit).toMatch(/^[a-f0-9]{40}$/);
    for (const name of ['redesign-existing-projects', 'impeccable']) {
      const skill = real.externalSkills.find(entry => entry.name === name);
      expect(skill.extraSources.LICENSE).toBe('LICENSE');
      expect(skill.files.LICENSE).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
