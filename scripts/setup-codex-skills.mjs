import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const skillDirectory = '.agents/skills';
const hashPattern = /^[a-f0-9]{64}$/;

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':')
    || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Unsafe managed Skill path.');
  }
  return value;
}

// Reject links at every existing segment before reads or writes; never follow a
// project Skill junction into a global installation. Missing paths stay read-only.
export function safePath(root, relative) {
  let current = fs.realpathSync(root);
  for (const part of relativePath(relative).split('/')) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) throw new Error(`Linked path refused: ${relative}`);
  }
  return current;
}

export function digest(content, binary = false) {
  const bytes = binary ? content : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(content).replace(/\r\n/g, '\n');
  return createHash('sha256').update(bytes).digest('hex');
}

export function validateRegistry(registry) {
  if (registry?.version !== 1 || !Array.isArray(registry.projectSkills) || !Array.isArray(registry.externalSkills)) {
    throw new Error('Unsupported Skill registry.');
  }
  const names = [...registry.projectSkills, ...registry.externalSkills.map((skill) => skill.name)];
  if (new Set(names).size !== names.length || names.some((name) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))) {
    throw new Error('Duplicate or invalid managed Skill name.');
  }
  for (const skill of registry.externalSkills) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(skill.repository) || !/^[a-f0-9]{40}$/.test(skill.commit)) {
      throw new Error(`Immutable source pin required: ${skill.name}`);
    }
    relativePath(skill.sourceRoot);
    if (!skill.files || !Object.hasOwn(skill.files, 'SKILL.md')) throw new Error(`Missing Skill entrypoint: ${skill.name}`);
    for (const [file, hash] of Object.entries(skill.files)) {
      relativePath(file);
      if (!hashPattern.test(hash)) throw new Error(`Invalid content digest: ${skill.name}/${file}`);
    }
    for (const [file, source] of Object.entries(skill.extraSources ?? {})) {
      if (!Object.hasOwn(skill.files, file)) throw new Error('Extra source must belong to the file allowlist.');
      relativePath(source);
    }
    for (const [platform, binary] of Object.entries(skill.binaries ?? {})) {
      if (!/^(win32|linux|darwin)-(x64|arm64)$/.test(platform) || !hashPattern.test(binary.sha256)) throw new Error('Invalid engine pin.');
      relativePath(binary.file);
      const url = new URL(binary.url);
      if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash
        || !url.pathname.startsWith(`/${skill.repository}/releases/download/engine-v${skill.engineVersion}/`)) {
        throw new Error('Invalid pinned engine source.');
      }
    }
  }
  return registry;
}

export function loadRegistry(root = projectRoot) {
  return validateRegistry(JSON.parse(fs.readFileSync(safePath(root, 'config/agent-skills.lock.json'), 'utf8')));
}

function listFiles(root, relative) {
  const directory = safePath(root, relative);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relative}/${entry.name}`;
    const stat = fs.lstatSync(safePath(root, child));
    if (stat.isDirectory()) return listFiles(root, child);
    if (!stat.isFile()) throw new Error(`Non-regular Skill file: ${child}`);
    return [child];
  });
}

function checkEntrypoint(root, name) {
  const content = fs.readFileSync(safePath(root, `${skillDirectory}/${name}/SKILL.md`), 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter || !new RegExp(`^name: ${name}$`, 'm').test(frontmatter.replace(/\r/g, ''))
    || !/^description:\s*\S/m.test(frontmatter)) throw new Error(`Invalid frontmatter: ${name}`);
}

export function inspectSkill(root, name, external = null, platform = `${process.platform}-${process.arch}`) {
  try {
    const directory = safePath(root, `${skillDirectory}/${name}`);
    if (!fs.existsSync(directory)) return { name, external: Boolean(external), status: 'MISSING', message: 'Project-local copy missing.' };
    checkEntrypoint(root, name);
    if (external) {
      const files = listFiles(root, `${skillDirectory}/${name}`).map((file) => file.slice(`${skillDirectory}/${name}/`.length));
      const binaryFiles = Object.values(external.binaries ?? {});
      const allowed = new Set([...Object.keys(external.files), ...binaryFiles.map((binary) => binary.file)]);
      const unexpected = files.filter((file) => !allowed.has(file));
      if (unexpected.length) throw new Error(`Unmanaged files: ${unexpected.join(', ')}`);
      for (const [file, expected] of Object.entries(external.files)) {
        const actual = digest(fs.readFileSync(safePath(root, `${skillDirectory}/${name}/${file}`)));
        if (actual !== expected) throw new Error(`Content drift: ${file}`);
      }
      if (external.binaries && !external.binaries[platform]) throw new Error(`Engine platform not supported: ${platform}`);
      for (const binary of binaryFiles) {
        if (binary !== external.binaries[platform] && !files.includes(binary.file)) continue;
        if (digest(fs.readFileSync(safePath(root, `${skillDirectory}/${name}/${binary.file}`)), true) !== binary.sha256) {
          throw new Error(`Engine content drift: ${binary.file}`);
        }
      }
    }
    return { name, external: Boolean(external), status: 'PASS', message: external ? 'Pinned source and content verified.' : 'Project workflow entrypoint verified.' };
  } catch (error) {
    return { name, external: Boolean(external), status: 'FAIL', message: error.message };
  }
}

export function checkSkills(root = projectRoot, registry = loadRegistry(root)) {
  validateRegistry(registry);
  const checks = [
    ...registry.projectSkills.map((name) => inspectSkill(root, name)),
    ...registry.externalSkills.map((skill) => inspectSkill(root, skill.name, skill)),
  ];
  const managed = new Set(checks.map((check) => check.name));
  const directory = safePath(root, skillDirectory);
  if (fs.existsSync(directory)) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!managed.has(entry.name)) {
        checks.push({ name: entry.name, external: true, status: 'FAIL', message: 'Outside managed project scope; review without deleting.' });
      }
    }
  }
  return checks;
}

export function skillHealth(root) {
  return checkSkills(root).map((check) => ({
    id: `agent-skills.${check.name}`,
    status: check.status === 'MISSING' ? (check.external ? 'WARN' : 'FAIL') : check.status,
    message: `${check.name}: ${check.message}`,
  }));
}

// Download inert, allowlisted files only. No npm installer, Git checkout,
// lifecycle script, shell, hook, MCP, plugin registration or global configuration.
async function downloadAttempt(url, binary) {
  const maximum = binary ? 128 * 1024 * 1024 : 16 * 1024 * 1024;
  const hosts = new Set(['raw.githubusercontent.com', 'github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
  for (let hop = 0; hop < 5; hop += 1) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !hosts.has(target.hostname) || target.username || target.password) throw new Error('Download host refused.');
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(60_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      url = new URL(response.headers.get('location'), target).href;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(`Skill download HTTP ${response.status}.`);
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maximum) throw new Error('Skill download exceeds size limit.');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Too many download redirects.');
}

export async function downloadFile(url, binary = false) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await downloadAttempt(url, binary); }
    catch (error) {
      const transient = error.retryable || error.name === 'TimeoutError'
        || ['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'].includes(error.cause?.code);
      if (!transient || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}

export async function setupSkills(root = projectRoot, registry = loadRegistry(root), download = downloadFile, log = console.log) {
  const checks = checkSkills(root, registry);
  if (checks.some((check) => check.status === 'FAIL' || (check.status === 'MISSING' && !check.external))) {
    throw new Error('Setup preflight failed; existing copies and project-owned Skills were not changed. Run --check.');
  }
  for (const skill of registry.externalSkills) {
    if (checks.find((check) => check.name === skill.name).status === 'PASS') {
      log(`SKIP ${skill.name}: pinned project-local copy already correct.`);
      continue;
    }
    const entries = Object.entries(skill.files).map(([file, sha256]) => ({
      file, sha256, binary: false,
      url: `https://raw.githubusercontent.com/${skill.repository}/${skill.commit}/${skill.extraSources?.[file] ?? `${skill.sourceRoot}/${file}`}`,
    }));
    if (skill.binaries) {
      const binary = skill.binaries[`${process.platform}-${process.arch}`];
      if (!binary) throw new Error(`Engine platform not supported: ${skill.name}`);
      entries.push({ ...binary, binary: true });
    }
    log(`FETCH ${skill.name}: ${skill.commit}, ${entries.length} allowlisted files.`);
    // Verify the whole download before creating a discoverable Skill directory.
    // Bounded batches also settle failures before returning to the caller.
    const verified = [];
    for (let offset = 0; offset < entries.length; offset += 6) {
      const batch = await Promise.allSettled(entries.slice(offset, offset + 6).map(async (entry) => {
        let content;
        try { content = await download(entry.url, entry.binary); }
        catch (error) { throw new Error(`Download failed: ${skill.name}/${entry.file} (${error.cause?.code ?? error.message})`); }
        if (digest(content, entry.binary) !== entry.sha256) throw new Error(`Downloaded content mismatch: ${skill.name}/${entry.file}`);
        return { ...entry, content };
      }));
      const failure = batch.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
      verified.push(...batch.map((result) => result.value));
    }
    fs.mkdirSync(safePath(root, skillDirectory), { recursive: true });
    const destination = safePath(root, `${skillDirectory}/${skill.name}`);
    fs.mkdirSync(destination); // Exclusive: never replace even an empty existing copy.
    for (const entry of verified) {
      const target = safePath(root, `${skillDirectory}/${skill.name}/${entry.file}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.content, { flag: 'wx', mode: entry.binary ? 0o755 : 0o644 });
    }
    const check = inspectSkill(root, skill.name, skill);
    if (check.status !== 'PASS') throw new Error(`${skill.name}: ${check.message}`);
    log(`PASS ${skill.name}: installed without running upstream code.`);
  }
}

async function main(args) {
  if (args.length > 1 || (args.length && args[0] !== '--check')) throw new Error('Usage: node scripts/setup-codex-skills.mjs [--check]');
  if (!args.length) await setupSkills();
  const checks = checkSkills();
  for (const check of checks) console.log(`${check.status} ${check.name}: ${check.message}`);
  if (checks.some((check) => check.status !== 'PASS')) return 1;
  if (!args.length) console.log('Project Skills ready. Reload Codex only if discovery has not refreshed. No auto-update or global configuration changes.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
