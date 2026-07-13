import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = "investment-research-dashboard-dev-health";
const VERSION = 1;
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_OUTPUT_CHARS = 4_000;
const STATUSES = new Set(["PASS", "WARN", "FAIL", "SKIP"]);
const CATEGORY_LABELS = {
  environment: "基础环境",
  dependencies: "项目文件与依赖",
  git: "Git 与安全",
  scripts: "package scripts 契约",
  ci: "CI 对齐",
  data: "数据结构",
  validators: "只读质量检查",
};

function parseArgs(argv) {
  const options = { json: false, strict: false, verbose: false, help: false };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--strict") options.strict = true;
    else if (arg === "--verbose") options.verbose = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function printHelp() {
  process.stdout.write(`投研看板开发环境健康检查 V1\n\n`);
  process.stdout.write(`用法：node scripts/dev-health.mjs [--json] [--strict] [--verbose] [--help]\n\n`);
  process.stdout.write(`  --json     仅输出机器可读 JSON\n`);
  process.stdout.write(`  --strict   WARN 或 FAIL 均返回退出码 1\n`);
  process.stdout.write(`  --verbose  显示脱敏后的命令、路径、耗时和跳过原因\n`);
  process.stdout.write(`  --help     显示帮助\n`);
}

function isProjectRoot(directory) {
  return ["package.json", ".git", "src", "scripts"].every((name) => fs.existsSync(path.join(directory, name)));
}

function pathKey(value) {
  const normalized = path.normalize(path.resolve(value));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function samePath(left, right) {
  return pathKey(left) === pathKey(right);
}

function isPathWithin(candidate, parent) {
  const candidateKey = pathKey(candidate);
  const parentKey = pathKey(parent);
  return candidateKey === parentKey || candidateKey.startsWith(`${parentKey}${path.sep}`);
}

function walkUp(start) {
  let current = path.resolve(start);
  while (true) {
    if (isProjectRoot(current)) return current;
    const parent = path.dirname(current);
    if (samePath(parent, current)) return null;
    current = parent;
  }
}

function findProjectRoot() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [process.cwd(), scriptDirectory];
  for (const candidate of candidates) {
    const found = walkUp(candidate);
    if (found) return found;
  }
  return null;
}

function truncate(value, limit = MAX_OUTPUT_CHARS) {
  const text = String(value ?? "").trim();
  return text.length <= limit ? text : `${text.slice(0, limit)}…[已截断]`;
}

function redactText(value) {
  let text = String(value ?? "");
  const home = os.homedir();
  if (home) {
    const escapedHome = home.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(escapedHome, process.platform === "win32" ? "gi" : "g"), "~");
  }
  text = text
    .replace(/\b(?:gh[opsu]|github_pat)_[A-Za-z0-9_\-]+\b/gi, "[TOKEN REDACTED]")
    .replace(/\bBearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/^.*Authorization\s*:.*$/gim, "[AUTHORIZATION REDACTED]")
    .replace(/(https?:\/\/)([^\s/@:]+):([^\s/@]+)@/gi, "$1[REDACTED]@[HOST]")
    .replace(/([?&](?:access_token|token|auth|key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/((?:proxy|代理)[^\r\n]*?)(https?:\/\/[^\s]+)/gi, "$1[PROXY REDACTED]")
    .replace(/((?:proxy|代理)[^\r\n]*?)(?:\d{1,3}\.){3}\d{1,3}:\d+/gi, "$1[PROXY REDACTED]");
  return truncate(text);
}

function sanitizeDetails(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(sanitizeDetails);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeDetails(item)]));
  }
  return value;
}

function displayCommand(command, args) {
  return [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function runCommand(command, args = [], options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
  });
  const errorCode = result.error?.code ?? null;
  return {
    command: displayCommand(command, args),
    durationMs: Date.now() - started,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? "").trim(),
    errorCode,
    timedOut: errorCode === "ETIMEDOUT" || result.signal === "SIGTERM",
    ok: !result.error && result.status === 0,
  };
}

function commandName(name) {
  if (process.platform === "win32" && name === "pip") return "pip.exe";
  return name;
}

function validateNpmCliPath(candidate) {
  if (!candidate || path.basename(candidate).toLowerCase() !== "npm-cli.js") {
    return { valid: false, reason: "basename is not npm-cli.js" };
  }
  let resolved;
  try {
    resolved = fs.realpathSync(candidate);
  } catch {
    return { valid: false, reason: "path does not exist" };
  }
  const suffix = path.join("node_modules", "npm", "bin", "npm-cli.js");
  const resolvedKey = pathKey(resolved);
  const suffixKey = process.platform === "win32" ? suffix.toLowerCase() : suffix;
  if (!resolvedKey.endsWith(suffixKey)) {
    return { valid: false, reason: "path is outside the npm CLI structure" };
  }
  const packageFile = path.resolve(path.dirname(resolved), "..", "package.json");
  try {
    const packageJson = readJson(packageFile);
    if (packageJson.name !== "npm") return { valid: false, reason: "package identity is not npm" };
  } catch {
    return { valid: false, reason: "npm package metadata is unavailable" };
  }
  return { valid: true, path: resolved };
}

function npmInvocation() {
  const rejected = [];
  const candidates = [
    { source: "npm_execpath", path: process.env.npm_execpath },
    { source: "node installation", path: path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js") },
  ];
  for (const candidate of candidates) {
    if (!candidate.path) continue;
    const validation = validateNpmCliPath(candidate.path);
    if (validation.valid) {
      return { command: process.execPath, prefix: [validation.path], source: candidate.source, rejected };
    }
    rejected.push({ source: candidate.source, file: path.basename(candidate.path), reason: validation.reason });
  }
  return { command: "npm", prefix: [], source: "PATH", rejected };
}

function executablePaths(name, cwd) {
  const lookup = process.platform === "win32"
    ? runCommand("where.exe", [name], { cwd, timeoutMs: 5_000 })
    : runCommand("which", ["-a", name], { cwd, timeoutMs: 5_000 });
  if (!lookup.ok) return [];
  const unique = new Map();
  for (const executable of lookup.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
    const key = pathKey(executable);
    if (!unique.has(key)) unique.set(key, executable);
  }
  return [...unique.values()];
}

function classifyExecutablePaths(name, paths) {
  const installations = new Set();
  let windowsShimDetected = false;
  const npmByDirectory = new Map();
  for (const executable of paths) {
    const basename = path.basename(executable).toLowerCase();
    const directory = pathKey(path.dirname(executable));
    if (process.platform === "win32" && name.toLowerCase() === "npm" && (basename === "npm" || basename === "npm.cmd")) {
      const names = npmByDirectory.get(directory) ?? new Set();
      names.add(basename);
      npmByDirectory.set(directory, names);
      installations.add(`${directory}${path.sep}npm`);
    } else {
      installations.add(pathKey(executable));
    }
  }
  for (const names of npmByDirectory.values()) {
    if (names.has("npm") && names.has("npm.cmd")) windowsShimDetected = true;
  }
  return { installationCount: installations.size, windowsShimDetected };
}

function parseVersion(text) {
  const match = String(text).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match ? { major: Number(match[1]), minor: Number(match[2] ?? 0), patch: Number(match[3] ?? 0), raw: match[0] } : null;
}

function matchesExpectedVersion(actual, expected) {
  const current = parseVersion(actual);
  const target = parseVersion(expected);
  if (!current || !target) return null;
  const parts = String(expected).replace(/^v/, "").split(".").length;
  if (current.major !== target.major) return false;
  return parts < 2 || current.minor === target.minor;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function itemCount(items) {
  if (Array.isArray(items)) return items.length;
  if (items && typeof items === "object") return Object.keys(items).length;
  return null;
}

function hashFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseCiConfig(ciText) {
  const node = ciText.match(/node-version\s*:\s*["']?([^\s"']+)/i)?.[1] ?? null;
  const python = ciText.match(/python-version\s*:\s*["']?([^\s"']+)/i)?.[1] ?? null;
  const npmScripts = [...ciText.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
  const livePatterns = [
    "data:fetch:financials:a",
    "data:fetch:announcements:a",
    "data:observe:providers",
    "fetch-a-share-financials.py",
    "fetch-a-share-announcements.py",
  ];
  return {
    node,
    python,
    npmScripts: [...new Set(npmScripts)],
    liveCalls: livePatterns.filter((pattern) => ciText.includes(pattern)),
    hasTests: /npm\s+run\s+(?:test|test:[A-Za-z0-9:_-]+)/.test(ciText),
    hasAudit: /npm\s+run\s+data:audit/.test(ciText),
    hasBuild: /npm\s+run\s+build\b/.test(ciText),
  };
}

function extractNpmRuns(command) {
  return [...String(command ?? "").matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
}

function expandScriptGraph(start, scripts, seen = new Set()) {
  if (seen.has(start)) return seen;
  seen.add(start);
  for (const child of extractNpmRuns(scripts[start])) expandScriptGraph(child, scripts, seen);
  return seen;
}

function referencedLocalFiles(scripts) {
  const files = new Set();
  const pattern = /(?:^|[\s;&|])(?:node|python3?|py(?:\s+-3)?)\s+(?:-B\s+|-X\s+utf8\s+)*["']?([^"'\s]+\.(?:mjs|js|py|cmd))/g;
  for (const command of Object.values(scripts)) {
    for (const match of String(command).matchAll(pattern)) files.add(match[1].replaceAll("/", path.sep));
  }
  return [...files].sort();
}

function potentialWritePatterns(source) {
  const patterns = [
    /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdirSync|rmSync|renameSync|unlinkSync)\b/,
    /\.write_(?:text|bytes)\s*\(/,
    /\.(?:mkdir|unlink|rename)\s*\(/,
    /\bopen\s*\([^)]*,\s*["'][wa][+b]?["']/,
  ];
  return patterns.filter((pattern) => pattern.test(source)).map((pattern) => pattern.source);
}

function placeholderPaths(value, prefix = "$", found = []) {
  if (found.length >= 20) return found;
  if (typeof value === "string" && /^(?:mock|sample|placeholder)$/i.test(value.trim())) found.push(prefix);
  else if (Array.isArray(value)) value.forEach((item, index) => placeholderPaths(item, `${prefix}[${index}]`, found));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) placeholderPaths(item, `${prefix}.${key}`, found);
  }
  return found;
}

function createReporter(options, context) {
  const checks = [];
  function add(id, category, status, message, details = {}) {
    if (!STATUSES.has(status)) throw new Error(`无效检查状态：${status}`);
    checks.push({ id, category, status, message, details: sanitizeDetails(details) });
  }
  function guard(id, category, action) {
    try {
      action();
    } catch (error) {
      add(id, category, "FAIL", `检查执行失败：${redactText(error?.message ?? error)}`, {});
    }
  }
  return { checks, add, guard, options, context };
}

function checkTool(reporter, id, label, command, args, expectedVersion, required, pathName = command) {
  const result = runCommand(command, args, { cwd: reporter.context.root, timeoutMs: 10_000 });
  const paths = executablePaths(pathName, reporter.context.root);
  const pathClassification = classifyExecutablePaths(pathName, paths);
  if (!result.ok) {
    reporter.add(id, "environment", required ? "FAIL" : "WARN", `${label} 不可用`, {
      command: result.command,
      reason: result.errorCode ?? result.stderr ?? `exit ${result.status}`,
    });
    return { available: false, result, paths, version: null };
  }
  const version = parseVersion(`${result.stdout}\n${result.stderr}`)?.raw ?? result.stdout.split(/\r?\n/)[0];
  const versionMatch = expectedVersion ? matchesExpectedVersion(version, expectedVersion) : true;
  let status = "PASS";
  let message = `${label} ${version} 可用`;
  if (versionMatch === false) {
    status = "WARN";
    message = `${label} ${version} 与 CI ${expectedVersion} 不一致`;
  } else if (expectedVersion && versionMatch === null) {
    status = "WARN";
    message = `${label} 版本无法与 CI 要求比较`;
  } else if (expectedVersion) {
    message = `${label} ${version}，与 CI ${expectedVersion} 一致`;
  }
  if (pathClassification.installationCount > 1) {
    status = "WARN";
    message += `；发现 ${pathClassification.installationCount} 个不同目录的安装`;
  } else if (pathClassification.windowsShimDetected) {
    message += "；npm Windows shim detected";
  }
  reporter.add(id, "environment", status, message, {
    version,
    expectedVersion: expectedVersion ?? null,
    paths,
    installationCount: pathClassification.installationCount,
    windowsShimDetected: pathClassification.windowsShimDetected,
    command: reporter.options.verbose ? result.command : undefined,
    durationMs: reporter.options.verbose ? result.durationMs : undefined,
  });
  return { available: true, result, paths, version };
}

function selectPython(root) {
  const candidates = process.platform === "win32"
    ? [{ command: "python", prefix: [] }, { command: "py", prefix: ["-3"] }, { command: "python3", prefix: [] }]
    : [{ command: "python", prefix: [] }, { command: "python3", prefix: [] }, { command: "py", prefix: ["-3"] }];
  for (const candidate of candidates) {
    const result = runCommand(candidate.command, [...candidate.prefix, "--version"], { cwd: root, timeoutMs: 10_000 });
    if (result.ok) return { ...candidate, result };
  }
  return null;
}

function pythonArgs(python, args) {
  return [...python.prefix, "-B", "-X", "utf8", ...args];
}

function checkEnvironment(reporter, ci) {
  const nodePaths = executablePaths("node", reporter.context.root);
  const nodePathClassification = classifyExecutablePaths("node", nodePaths);
  const nodeVersion = process.version.replace(/^v/, "");
  const nodeMatch = ci.node ? matchesExpectedVersion(nodeVersion, ci.node) : null;
  reporter.add("node.version", "environment", ci.node && nodeMatch === false ? "WARN" : nodePathClassification.installationCount > 1 ? "WARN" : "PASS",
    ci.node ? `Node.js ${nodeVersion}${nodeMatch ? `，与 CI ${ci.node} 一致` : `，CI 期望 ${ci.node}`}` : `Node.js ${nodeVersion} 可用；无法解析 CI 版本`,
    { version: nodeVersion, expectedVersion: ci.node, paths: nodePaths.length ? nodePaths : [redactText(process.execPath)] });

  const npmRunner = npmInvocation();
  reporter.add("npm.execpath-security", "environment", npmRunner.rejected.length ? "WARN" : "PASS",
    npmRunner.rejected.length ? "检测到未通过验证的 npm CLI 路径，已拒绝执行并使用安全候选" : "npm CLI 执行路径通过结构验证",
    { source: npmRunner.source, rejected: npmRunner.rejected });
  const npm = checkTool(reporter, "npm.version", "npm", npmRunner.command, [...npmRunner.prefix, "--version"], null, true, "npm");
  npm.command = npmRunner.command;
  npm.prefix = npmRunner.prefix;
  const python = selectPython(reporter.context.root);
  if (!python) {
    reporter.add("python.version", "environment", "FAIL", "未找到可用的 Python（已尝试 python、py -3、python3）", {});
  } else {
    const version = parseVersion(`${python.result.stdout}\n${python.result.stderr}`)?.raw ?? "unknown";
    const match = ci.python ? matchesExpectedVersion(version, ci.python) : null;
    const paths = executablePaths(python.command, reporter.context.root);
    const status = ci.python && match === false ? "WARN" : paths.length > 1 ? "WARN" : "PASS";
    reporter.add("python.version", "environment", status,
      ci.python ? `Python ${version}${match ? `，与 CI ${ci.python} 一致` : `，CI 期望 ${ci.python}`}` : `Python ${version} 可用；无法解析 CI 版本`,
      { version, expectedVersion: ci.python, selectedCommand: displayCommand(python.command, python.prefix), paths });
  }

  if (python) {
    const pipResult = runCommand(python.command, pythonArgs(python, ["-m", "pip", "--version"]), { cwd: reporter.context.root, timeoutMs: 15_000 });
    reporter.add("pip.version", "environment", pipResult.ok ? "PASS" : "FAIL",
      pipResult.ok ? `pip 可用：${pipResult.stdout.split(/\r?\n/)[0]}` : "Python 环境中的 pip 不可用",
      { selectedCommand: displayCommand(python.command, [...python.prefix, "-m", "pip"]), reason: pipResult.ok ? undefined : pipResult.stderr });
  }

  const git = checkTool(reporter, "git.version", "Git", "git", ["--version"], null, true, "git");
  const gh = checkTool(reporter, "gh.version", "GitHub CLI", "gh", ["--version"], null, false, "gh");
  return { npm, python, git, gh };
}

function checkProjectFilesAndDependencies(reporter, tools) {
  const root = reporter.context.root;
  let packageJson = null;
  let lock = null;
  for (const [id, filename] of [["package.json", "package.json"], ["package-lock.json", "package-lock.json"]]) {
    const file = path.join(root, filename);
    try {
      const parsed = readJson(file);
      if (filename === "package.json") packageJson = parsed;
      else lock = parsed;
      reporter.add(`dependencies.${id}`, "dependencies", "PASS", `${filename} 可解析`, filename === "package-lock.json" ? { lockfileVersion: parsed.lockfileVersion ?? null } : {});
    } catch (error) {
      reporter.add(`dependencies.${id}`, "dependencies", "FAIL", `${filename} 缺失或无法解析：${redactText(error.message)}`, {});
    }
  }
  reporter.context.packageJson = packageJson;
  reporter.context.lock = lock;

  const nodeModules = path.join(root, "node_modules");
  reporter.add("dependencies.node-modules", "dependencies", fs.existsSync(nodeModules) ? "PASS" : "WARN",
    fs.existsSync(nodeModules) ? "node_modules 已存在" : "node_modules 不存在；需要人工执行 npm ci", {});

  if (tools.npm.available && fs.existsSync(nodeModules)) {
    const npmLs = runCommand(tools.npm.command, [...tools.npm.prefix, "ls", "--depth=0", "--json"], { cwd: root, timeoutMs: 90_000 });
    reporter.add("dependencies.npm-ls", "dependencies", npmLs.ok ? "PASS" : "FAIL",
      npmLs.ok ? "npm 顶层依赖完整" : "npm ls --depth=0 失败",
      { command: reporter.options.verbose ? npmLs.command : undefined, durationMs: npmLs.durationMs, reason: npmLs.ok ? undefined : npmLs.stderr || npmLs.stdout });
  } else {
    reporter.add("dependencies.npm-ls", "dependencies", "SKIP", "未执行 npm ls：npm 或 node_modules 不可用", {});
  }

  if (packageJson && lock) {
    const expected = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
    const missing = Object.keys(expected).filter((name) => !lock.packages?.[`node_modules/${name}`] && !lock.dependencies?.[name]);
    reporter.add("dependencies.lock-coverage", "dependencies", missing.length ? "FAIL" : "PASS",
      missing.length ? `lockfile 缺少 ${missing.length} 个顶层依赖` : "package.json 顶层依赖均存在于 lockfile",
      { missing });
  } else {
    reporter.add("dependencies.lock-coverage", "dependencies", "SKIP", "package.json 或 lockfile 不可用", {});
  }

  const requirementFiles = fs.readdirSync(root).filter((name) => /^requirements.*\.txt$/i.test(name)).sort();
  const unreadable = [];
  const unpinned = [];
  for (const filename of requirementFiles) {
    try {
      const lines = fs.readFileSync(path.join(root, filename), "utf8").split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith("#") || line.startsWith("-")) continue;
        const requirement = line.split(";")[0].trim();
        if (!/===|==/.test(requirement)) unpinned.push(`${filename}:${requirement.split(/[<>=!~\s]/)[0]}`);
      }
    } catch {
      unreadable.push(filename);
    }
  }
  reporter.add("dependencies.requirements", "dependencies", unreadable.length ? "FAIL" : requirementFiles.length ? "PASS" : "WARN",
    unreadable.length ? "存在不可读取的 requirements 文件" : requirementFiles.length ? `发现并读取 ${requirementFiles.length} 个 requirements 文件` : "未找到 requirements*.txt",
    { files: requirementFiles, unreadable });
  reporter.add("dependencies.requirements-pins", "dependencies", unpinned.length ? "WARN" : "PASS",
    unpinned.length ? `发现 ${unpinned.length} 个未固定版本的 Python 依赖` : "Python requirements 均固定版本",
    { unpinned });

  if (tools.python) {
    const pipCheck = runCommand(tools.python.command, pythonArgs(tools.python, ["-m", "pip", "check"]), { cwd: root, timeoutMs: 60_000 });
    reporter.add("dependencies.pip-check", "dependencies", pipCheck.ok ? "PASS" : "WARN",
      pipCheck.ok ? "python -m pip check 通过" : "pip check 发现依赖问题或无法完成",
      { durationMs: pipCheck.durationMs, reason: pipCheck.ok ? undefined : pipCheck.stderr || pipCheck.stdout });
  } else {
    reporter.add("dependencies.pip-check", "dependencies", "SKIP", "Python 不可用，未执行 pip check", {});
  }
}

function containsCredentialInUrl(url) {
  if (!url) return false;
  if (/\b(?:gh[opsu]|github_pat)_[A-Za-z0-9_\-]+\b/i.test(url)) return true;
  try {
    const parsed = new URL(url);
    return Boolean(parsed.username || parsed.password || [...parsed.searchParams.keys()].some((key) => /token|auth|key/i.test(key)));
  } catch {
    return /https?:\/\/[^/\s@]+@/i.test(url);
  }
}

function checkGitAndSecurity(reporter, tools) {
  const root = reporter.context.root;
  if (!tools.git.available) {
    reporter.add("git.repository", "git", "FAIL", "Git 不可用，无法检查仓库", {});
    return;
  }
  const top = runCommand("git", ["rev-parse", "--show-toplevel"], { cwd: root, timeoutMs: 10_000 });
  reporter.add("git.repository", "git", top.ok ? "PASS" : "FAIL", top.ok ? "Git 仓库有效" : "当前项目不是有效 Git 仓库", { topLevel: top.ok ? top.stdout : undefined });

  const branch = runCommand("git", ["branch", "--show-current"], { cwd: root, timeoutMs: 10_000 });
  const head = runCommand("git", ["rev-parse", "HEAD"], { cwd: root, timeoutMs: 10_000 });
  reporter.add("git.branch-head", "git", branch.ok && head.ok ? "PASS" : "FAIL",
    branch.ok && head.ok ? `当前分支 ${branch.stdout || "(detached)"}，HEAD ${head.stdout.slice(0, 12)}` : "无法读取当前分支或 HEAD",
    { branch: branch.stdout || null, head: head.stdout || null });

  const upstream = runCommand("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { cwd: root, timeoutMs: 10_000 });
  reporter.add("git.upstream", "git", upstream.ok ? "PASS" : "WARN", upstream.ok ? `上游分支：${upstream.stdout}` : "当前分支未配置上游分支", {});

  const origin = runCommand("git", ["remote", "get-url", "origin"], { cwd: root, timeoutMs: 10_000 });
  if (!origin.ok) reporter.add("git.origin", "git", "WARN", "origin 未配置", {});
  else {
    const unsafe = containsCredentialInUrl(origin.stdout);
    reporter.add("git.origin", "git", unsafe ? "FAIL" : "PASS", unsafe ? "origin URL 疑似包含凭据，已脱敏" : "origin 已配置且未发现嵌入凭据", { url: redactText(origin.stdout) });
  }

  const status = runCommand("git", ["status", "--short"], { cwd: root, timeoutMs: 15_000 });
  const statusLines = status.ok ? status.stdout.split(/\r?\n/).filter(Boolean) : [];
  reporter.add("git.worktree", "git", status.ok ? statusLines.length ? "WARN" : "PASS" : "FAIL",
    !status.ok ? "无法读取工作区状态" : statusLines.length ? `工作区存在 ${statusLines.length} 个未提交状态` : "工作区干净",
    { files: statusLines });

  const helper = runCommand("git", ["config", "--get", "credential.helper"], { cwd: root, timeoutMs: 10_000 });
  reporter.add("git.credential-helper", "git", helper.ok ? "PASS" : "WARN", helper.ok ? `credential.helper：${helper.stdout}` : "未检测到 credential.helper", {});

  const tracked = runCommand("git", ["ls-files", "-z"], { cwd: root, timeoutMs: 15_000, maxBuffer: 16 * 1024 * 1024 });
  if (!tracked.ok) {
    reporter.add("security.tracked-files", "git", "FAIL", "无法检查 Git 跟踪文件", {});
  } else {
    const files = tracked.stdout.split("\0").filter(Boolean).map((name) => name.replaceAll("\\", "/"));
    const sensitive = files.filter((name) => {
      const lower = name.toLowerCase();
      if (lower === ".env.example") return false;
      return lower === ".env" || lower.startsWith(".env.") || /\.(?:pem|key|pfx|p12)$/.test(lower) || lower.startsWith(".ssh-private/");
    });
    const generated = files.filter((name) => /^(?:dist|node_modules|data-cache|\.provider-observations)\//.test(name) || /\.log$/i.test(name));
    reporter.add("security.tracked-sensitive", "git", sensitive.length ? "FAIL" : "PASS",
      sensitive.length ? `发现 ${sensitive.length} 个被 Git 跟踪的敏感文件名` : "未发现被 Git 跟踪的 Token/私钥类文件",
      { files: sensitive });
    reporter.add("security.tracked-generated", "git", generated.length ? "WARN" : "PASS",
      generated.length ? `发现 ${generated.length} 个被跟踪的缓存、日志或构建文件` : "未发现被跟踪的缓存、日志或构建目录",
      { files: generated.slice(0, 50) });
  }

  const environmentNames = ["GITHUB_TOKEN", "GH_TOKEN", "GH_ENTERPRISE_TOKEN", "OPENAI_API_KEY", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"];
  const presence = Object.fromEntries(environmentNames.map((name) => [name, process.env[name] ? "FOUND" : "NOT FOUND"]));
  reporter.add("security.environment-presence", "git", "PASS", "敏感及代理环境变量仅检查存在性，未读取或输出值", presence);

  const ignoreTargets = [".env", ".ssh-private", ".provider-observations", "dist", "node_modules", "data-cache"];
  const ignored = [];
  const notIgnored = [];
  for (const target of ignoreTargets) {
    const check = runCommand("git", ["check-ignore", "-q", target], { cwd: root, timeoutMs: 5_000 });
    (check.ok ? ignored : notIgnored).push(target);
  }
  reporter.add("security.ignore-rules", "git", notIgnored.length ? "WARN" : "PASS",
    notIgnored.length ? "部分敏感或生成目录未被 ignore 规则覆盖" : "敏感和生成目录均有 Git ignore 规则",
    { ignored, notIgnored });
}

function checkGitHubCli(reporter, tools) {
  if (!tools.gh.available) {
    reporter.add("gh.auth", "git", "WARN", "GitHub CLI 未安装或不在 PATH，未检查登录状态", {});
    return;
  }
  const result = runCommand("gh", ["auth", "status"], { cwd: reporter.context.root, timeoutMs: 20_000 });
  const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (result.ok) {
    reporter.add("gh.auth", "git", "PASS", "GitHub CLI 登录状态正常", { durationMs: result.durationMs });
  } else if (result.timedOut || /timeout|timed out|eof|proxy|tls|connection|network/.test(combined)) {
    reporter.add("gh.auth", "git", "WARN", "GitHub CLI 登录状态因网络或代理验证失败，不能据此判断凭据损坏", { timedOut: result.timedOut, reason: redactText(result.stderr || result.stdout) });
  } else if (/not logged|not logged into any|run: gh auth login|to get started/.test(combined)) {
    reporter.add("gh.auth", "git", "WARN", "GitHub CLI 已安装但尚未登录", {});
  } else {
    reporter.add("gh.auth", "git", "WARN", "GitHub CLI 登录状态不可用", { reason: redactText(result.stderr || result.stdout) });
  }
}

function checkScriptsAndCi(reporter, ci) {
  const packageJson = reporter.context.packageJson;
  if (!packageJson) {
    reporter.add("scripts.required", "scripts", "SKIP", "package.json 不可用", {});
    reporter.add("ci.contract", "ci", "SKIP", "package.json 不可用", {});
    return;
  }
  const scripts = packageJson.scripts ?? {};
  const required = [
    "dev", "build", "test", "data:universe", "data:fetch:a-stock", "data:fetch:hk", "data:fetch:macro",
    "data:validate:a-stock", "data:fetch:financials:a", "data:validate:financials:a",
    "data:fetch:announcements:a", "data:validate:announcements:a", "data:audit", "data:refresh",
  ];
  const missing = required.filter((name) => !scripts[name]);
  reporter.add("scripts.required", "scripts", missing.length ? "FAIL" : "PASS",
    missing.length ? `缺少 ${missing.length} 个必要 package script` : "开发、构建、测试和数据链路 scripts 完整",
    { missing });

  const referenced = referencedLocalFiles(scripts);
  const missingFiles = referenced.filter((relative) => !fs.existsSync(path.resolve(reporter.context.root, relative)));
  reporter.add("scripts.local-files", "scripts", missingFiles.length ? "FAIL" : "PASS",
    missingFiles.length ? "package scripts 引用了不存在的本地文件" : `package scripts 引用的 ${referenced.length} 个本地入口均存在`,
    { referenced, missing: missingFiles });

  const refreshGraph = [...expandScriptGraph("data:refresh", scripts)];
  const directRefresh = extractNpmRuns(scripts["data:refresh"]);
  const expected = ["data:universe", "data:fetch:a-stock", "data:fetch:hk", "data:fetch:macro", "data:validate:a-stock"];
  const missingRefresh = expected.filter((name) => !refreshGraph.includes(name));
  const order = expected.map((name) => directRefresh.indexOf(name));
  const ordered = order.every((index) => index >= 0) && order.every((index, position) => position === 0 || index > order[position - 1]);
  reporter.add("scripts.default-refresh", "scripts", missingRefresh.length ? "FAIL" : ordered ? "PASS" : "WARN",
    missingRefresh.length ? "默认 data:refresh 缺少约定步骤" : ordered ? "默认 data:refresh 链路与当前约定一致" : "默认 data:refresh 包含约定步骤，但直接顺序无法确认",
    { directSteps: directRefresh, expandedScripts: refreshGraph, missing: missingRefresh });

  const unqualified = ["data:fetch:financials:a", "data:fetch:announcements:a", "data:observe:providers"].filter((name) => refreshGraph.includes(name));
  reporter.add("scripts.provider-admission", "scripts", unqualified.length ? "WARN" : "PASS",
    unqualified.length ? "财务或公告实时 Provider 已进入默认刷新链路，可能改变准入策略" : "财务、公告和观测 Provider 未进入默认刷新链路",
    { included: unqualified });

  const ciPath = path.join(reporter.context.root, ".github", "workflows", "ci.yml");
  if (!fs.existsSync(ciPath)) {
    reporter.add("ci.file", "ci", "WARN", "未找到 .github/workflows/ci.yml", {});
    return;
  }
  reporter.add("ci.file", "ci", "PASS", "CI 工作流存在且可读取", { node: ci.node, python: ci.python });
  const missingCiScripts = ci.npmScripts.filter((name) => !scripts[name]);
  reporter.add("ci.scripts", "ci", missingCiScripts.length ? "FAIL" : "PASS",
    missingCiScripts.length ? "CI 调用了 package.json 中不存在的 npm script" : `CI 调用的 ${ci.npmScripts.length} 个 npm scripts 均存在`,
    { scripts: ci.npmScripts, missing: missingCiScripts });
  reporter.add("ci.offline-provider-policy", "ci", ci.liveCalls.length ? "WARN" : "PASS",
    ci.liveCalls.length ? "CI 疑似调用实时 Provider 抓取" : "CI 未调用实时财务、公告或观测抓取",
    { liveCalls: ci.liveCalls });
  const gates = { tests: ci.hasTests, dataAudit: ci.hasAudit, build: ci.hasBuild };
  reporter.add("ci.quality-gates", "ci", Object.values(gates).every(Boolean) ? "PASS" : "WARN",
    Object.values(gates).every(Boolean) ? "CI 包含测试、数据审计和构建门禁" : "无法确认 CI 完整包含测试、数据审计和构建门禁",
    gates);
}

function checkJsonDocument(reporter, relative, label) {
  const file = path.join(reporter.context.root, relative);
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return { file, relative, raw, parsed, label, error: null };
  } catch (error) {
    reporter.add(`data.json.${relative.replace(/[^A-Za-z0-9]+/g, "-")}`, "data", "FAIL", `${label} 缺失或无法解析`, { path: relative, reason: error.message });
    return { file, relative, raw: null, parsed: null, label, error };
  }
}

function checkSplitArtifacts(reporter, options) {
  const summaryDoc = checkJsonDocument(reporter, options.summary, `${options.label}摘要`);
  const manifestDoc = checkJsonDocument(reporter, options.manifest, `${options.label} Manifest`);
  if (!summaryDoc.parsed || !manifestDoc.parsed) {
    reporter.add(`data.${options.id}.consistency`, "data", "SKIP", `${options.label}摘要或 Manifest 不可用`, {});
    return;
  }
  const errors = [];
  const warnings = [];
  const summary = summaryDoc.parsed;
  const manifest = manifestDoc.parsed;
  if (!summary.schemaVersion || !manifest.schemaVersion) errors.push("summary/manifest schemaVersion 缺失");
  if (!validDate(summary.generatedAt) || !validDate(manifest.generatedAt)) errors.push("summary/manifest generatedAt 缺失或无效");
  const entries = Array.isArray(manifest.items) ? manifest.items : [];
  const summaryCount = itemCount(summary.items);
  const declaredTotal = manifest[options.totalKey];
  if (!Array.isArray(manifest.items)) errors.push("manifest.items 不是数组");
  if (!Number.isInteger(declaredTotal) || declaredTotal <= 0) errors.push(`${options.totalKey} 不是正整数`);
  if (declaredTotal !== entries.length) errors.push(`Manifest 声明数量 ${declaredTotal} 与条目 ${entries.length} 不一致`);
  if (summaryCount !== entries.length) errors.push(`摘要数量 ${summaryCount} 与 Manifest ${entries.length} 不一致`);
  if (options.expectedCount != null && entries.length !== options.expectedCount) errors.push(`Manifest ${entries.length} 与当前股票池适用数量 ${options.expectedCount} 不一致`);

  const expectedNames = new Set();
  const placeholderHits = [];
  const publicRoot = path.resolve(reporter.context.root, "public");
  for (const entry of entries) {
    const relativePath = entry.relativePath;
    if (typeof relativePath !== "string" || !relativePath) {
      errors.push("Manifest 条目缺少 relativePath");
      continue;
    }
    const detailPath = path.resolve(publicRoot, relativePath.replaceAll("/", path.sep));
    if (!isPathWithin(detailPath, publicRoot)) {
      errors.push(`非法详情路径：${relativePath}`);
      continue;
    }
    expectedNames.add(path.basename(detailPath));
    if (!fs.existsSync(detailPath)) {
      errors.push(`详情文件不存在：${relativePath}`);
      continue;
    }
    const size = fs.statSync(detailPath).size;
    if (entry.byteSize !== size) errors.push(`byteSize 不一致：${relativePath}`);
    if (typeof entry.checksumSha256 !== "string" || entry.checksumSha256.toLowerCase() !== hashFile(detailPath)) errors.push(`checksum 不一致：${relativePath}`);
    try {
      const detail = readJson(detailPath);
      if (!detail.schemaVersion) errors.push(`详情 schemaVersion 缺失：${relativePath}`);
      if (!validDate(detail.generatedAt)) errors.push(`详情 generatedAt 无效：${relativePath}`);
      placeholderHits.push(...placeholderPaths(detail).map((hit) => `${relativePath}:${hit}`));
    } catch (error) {
      errors.push(`详情 JSON 无法解析：${relativePath} (${error.message})`);
    }
  }
  const detailDirectory = path.dirname(manifestDoc.file);
  const actualNames = fs.existsSync(detailDirectory)
    ? fs.readdirSync(detailDirectory).filter((name) => name.endsWith(".json") && name !== path.basename(manifestDoc.file))
    : [];
  const actualNameKeys = new Set(actualNames.map((name) => process.platform === "win32" ? name.toLowerCase() : name));
  const expectedNameKeys = new Set([...expectedNames].map((name) => process.platform === "win32" ? name.toLowerCase() : name));
  const orphans = actualNames.filter((name) => !expectedNameKeys.has(process.platform === "win32" ? name.toLowerCase() : name));
  const missing = [...expectedNames].filter((name) => !actualNameKeys.has(process.platform === "win32" ? name.toLowerCase() : name));
  if (orphans.length) errors.push(`存在 ${orphans.length} 个孤儿详情文件`);
  if (missing.length) errors.push(`缺少 ${missing.length} 个详情文件`);
  if (placeholderHits.length) warnings.push(`发现 ${placeholderHits.length} 个明显占位字符串`);

  reporter.add(`data.${options.id}.consistency`, "data", errors.length ? "FAIL" : warnings.length ? "WARN" : "PASS",
    errors.length ? `${options.label} Manifest/摘要/详情存在 ${errors.length} 个结构问题` : warnings.length ? `${options.label}结构一致，但存在占位值提示` : `${options.label} Manifest、摘要和 ${entries.length} 个详情文件一致`,
    { currentCount: entries.length, errors: errors.slice(0, 30), warnings, placeholderHits: placeholderHits.slice(0, 20) });

  const partial = Number(manifest.partial ?? 0);
  const error = Number(manifest.error ?? 0);
  const status = error > 0 ? "WARN" : partial > 0 ? "WARN" : "PASS";
  reporter.add(`data.${options.id}.coverage`, "data", status,
    error > 0 ? `${options.label}包含 ${error} 个 error 状态` : partial > 0 ? `${options.label}包含 ${partial} 个 partial 状态` : `${options.label}未包含 partial/error 状态`,
    { success: manifest.success ?? null, partial, error, empty: manifest.empty ?? null });
}

function checkDataArtifacts(reporter) {
  const universeDoc = checkJsonDocument(reporter, "src/data/real/stock-universe.generated.json", "股票池 JSON");
  let universeItems = [];
  let marketCounts = {};
  if (universeDoc.parsed) {
    universeItems = Array.isArray(universeDoc.parsed.items) ? universeDoc.parsed.items : [];
    for (const item of universeItems) marketCounts[item.market ?? "unknown"] = (marketCounts[item.market ?? "unknown"] ?? 0) + 1;
    const declaredTotal = universeDoc.parsed.total;
    const declaredMarkets = universeDoc.parsed.markets ?? {};
    const errors = [];
    if (!universeItems.length) errors.push("股票池为空或 items 不是数组");
    if (declaredTotal !== universeItems.length) errors.push(`total ${declaredTotal} 与 items ${universeItems.length} 不一致`);
    for (const [market, count] of Object.entries(marketCounts)) if (declaredMarkets[market] !== count) errors.push(`${market} 声明 ${declaredMarkets[market]}，实际 ${count}`);
    if (!validDate(universeDoc.parsed.generatedAt)) errors.push("generatedAt 缺失或无效");
    reporter.add("data.universe", "data", errors.length ? "FAIL" : "PASS",
      errors.length ? "股票池内部数量或时间不一致" : `当前股票池：总计 ${universeItems.length}，${Object.entries(marketCounts).map(([name, count]) => `${name} ${count}`).join("，")}`,
      { total: universeItems.length, markets: marketCounts, errors });
  } else {
    reporter.add("data.universe", "data", "SKIP", "股票池不可用，无法检查市场数量", {});
  }

  const corePaths = [
    ["src/data/real/macro.generated.json", "宏观数据"],
    ["src/data/real/stocks.generated.json", "股票资料"],
    ["src/data/real/quotes.generated.json", "行情数据"],
    ["src/data/real/priceHistory.generated.json", "价格历史"],
  ];
  const core = corePaths.map(([relative, label]) => checkJsonDocument(reporter, relative, label));
  const coreErrors = [];
  const metadataWarnings = [];
  for (const doc of core) {
    if (!doc.parsed) continue;
    const timestamp = doc.parsed.generatedAt ?? doc.parsed.updatedAt;
    if (!validDate(timestamp)) coreErrors.push(`${doc.relative} 缺少有效 generatedAt/updatedAt`);
    if (!doc.parsed.schemaVersion) metadataWarnings.push(`${doc.relative} 缺少 schemaVersion`);
    const count = itemCount(doc.parsed.items);
    if (count != null && universeItems.length && count !== universeItems.length) coreErrors.push(`${doc.relative} items ${count} 与股票池 ${universeItems.length} 不一致`);
    const placeholders = placeholderPaths(doc.parsed);
    if (placeholders.length) metadataWarnings.push(`${doc.relative} 存在 ${placeholders.length} 个明显占位字符串`);
  }
  reporter.add("data.core-generated", "data", coreErrors.length ? "FAIL" : metadataWarnings.length ? "WARN" : "PASS",
    coreErrors.length ? "宏观、行情或股票生成物存在结构问题" : metadataWarnings.length ? "核心生成物可解析，但部分旧格式缺少 schemaVersion" : "宏观、行情和股票生成物结构正常",
    { errors: coreErrors, warnings: metadataWarnings });

  const aShareCount = universeItems.filter((item) => item.market === "A股").length;
  const financialCount = universeItems.filter((item) => item.market === "A股" && item.shouldFetchFinancials !== false).length;
  checkSplitArtifacts(reporter, {
    id: "financials",
    label: "A 股财务",
    summary: "src/data/real/a-share-financial-summaries.generated.json",
    manifest: "public/data/a-share-financials/manifest.generated.json",
    totalKey: "total",
    expectedCount: universeItems.length ? financialCount : null,
  });
  checkSplitArtifacts(reporter, {
    id: "announcements",
    label: "A 股公告",
    summary: "src/data/real/a-share-announcement-summaries.generated.json",
    manifest: "public/data/a-share-announcements/manifest.generated.json",
    totalKey: "totalCompanies",
    expectedCount: universeItems.length ? aShareCount : null,
  });

  const legacyFinancial = path.join(reporter.context.root, "src/data/real/a-share-financials.generated.json");
  const providerSourcePath = path.join(reporter.context.root, "src/services/providers/aStockDataProvider.ts");
  const providerSource = fs.existsSync(providerSourcePath) ? fs.readFileSync(providerSourcePath, "utf8") : "";
  const legacyAnnouncement = path.join(reporter.context.root, "src/data/real/announcements.generated.json");
  const legacyIssues = [];
  if (fs.existsSync(legacyFinancial)) legacyIssues.push("a-share-financials.generated.json 旧单体文件仍存在");
  if (providerSource.includes("a-share-financials.generated.json") || providerSource.includes("announcements.generated.json")) legacyIssues.push("同步 Provider 仍引用旧完整历史文件");
  if (fs.existsSync(legacyAnnouncement) && !providerSource.includes("announcements.generated.json")) legacyIssues.push("announcements.generated.json 仍由旧数据链维护，但当前同步 Provider 未消费");
  reporter.add("data.legacy-artifacts", "data", legacyIssues.length ? "WARN" : "PASS",
    legacyIssues.length ? "发现旧生成物或未消费聚合文件，需要人工确认保留边界" : "未发现被生产同步入口使用的旧单体生成物",
    { issues: legacyIssues });
}

function validatorResult(reporter, id, label, command, args, timeoutMs) {
  const result = runCommand(command, args, { cwd: reporter.context.root, timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  reporter.add(id, "validators", result.ok ? "PASS" : "FAIL", result.ok ? `${label} 通过` : `${label} 失败`, {
    command: reporter.options.verbose ? result.command : undefined,
    durationMs: result.durationMs,
    reason: result.ok ? undefined : result.stderr || result.stdout || result.errorCode,
  });
}

function checkReadOnlyValidators(reporter, tools) {
  if (!tools.python) {
    reporter.add("validators.financials", "validators", "SKIP", "Python 不可用，未执行财务 validator", {});
    reporter.add("validators.announcements", "validators", "SKIP", "Python 不可用，未执行公告 validator", {});
  } else {
    for (const [id, label, relative, timeoutMs] of [
      ["validators.financials", "财务 validator", "scripts/validate-a-share-financials.py", 90_000],
      ["validators.announcements", "公告 validator", "scripts/validate-a-share-announcements.py", 120_000],
    ]) {
      const file = path.join(reporter.context.root, relative);
      if (!fs.existsSync(file)) {
        reporter.add(id, "validators", "SKIP", `${label} 文件不存在`, { path: relative });
        continue;
      }
      const source = fs.readFileSync(file, "utf8");
      const writes = potentialWritePatterns(source);
      if (writes.length) {
        reporter.add(id, "validators", "SKIP", `为确保健康检查只读，未执行存在潜在写入风险的 ${label}`, { patterns: writes });
        continue;
      }
      validatorResult(reporter, id, label, tools.python.command, pythonArgs(tools.python, [relative]), timeoutMs);
    }
  }

  const auditRelative = "scripts/data-audit.mjs";
  const auditPath = path.join(reporter.context.root, auditRelative);
  if (!fs.existsSync(auditPath)) {
    reporter.add("validators.data-audit", "validators", "SKIP", "data-audit.mjs 不存在", {});
  } else {
    const source = fs.readFileSync(auditPath, "utf8");
    if (!source.includes("--no-write")) {
      reporter.add("validators.data-audit", "validators", "SKIP", "data-audit 不支持 --no-write，未执行", {});
    } else {
      validatorResult(reporter, "validators.data-audit", "data-audit --no-write", process.execPath, [auditRelative, "--json", "--no-write"], 90_000);
    }
  }

  for (const [id, command, reason] of [
    ["validators.a-stock", "validate-a-stock-data.py / data:validate:a-stock", "会写验证报告或重生成股票池"],
    ["validators.provider-health", "data:health:providers", "会写 Provider 本地健康摘要"],
    ["validators.ui-audit", "ui:audit", "会创建目录并重写 UI 审计报告"],
    ["validators.bundle", "build:check", "依赖 dist 构建产物"],
  ]) reporter.add(id, "validators", "SKIP", `未执行 ${command}：${reason}`, { reason });
}

function summarize(checks) {
  const summary = { pass: 0, warn: 0, fail: 0, skip: 0, status: "READY" };
  for (const check of checks) summary[check.status.toLowerCase()] += 1;
  if (summary.fail) summary.status = "NOT READY";
  else if (summary.warn) summary.status = "READY WITH WARNINGS";
  return summary;
}

function exitCodeFor(summary, options) {
  if (summary.fail > 0) return 1;
  if (options.strict && summary.warn > 0) return 1;
  return 0;
}

function humanReport(report, options, exitCode) {
  const lines = [
    "============================================================",
    " 投研看板开发环境健康检查 V1",
    "============================================================",
    "",
    `运行目录：${redactText(report.runDirectory)}`,
    `项目根目录：${redactText(report.projectRoot)}`,
    `开始时间：${report.startedAt}`,
    "",
  ];
  for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
    const items = report.checks.filter((check) => check.category === category);
    if (!items.length) continue;
    lines.push(`[${label}]`);
    for (const check of items) {
      lines.push(`${check.status.padEnd(5)} ${check.message}`);
      if (options.verbose && check.details && Object.keys(check.details).length) {
        lines.push(`      ${truncate(JSON.stringify(check.details), 1_500)}`);
      }
    }
    lines.push("");
  }
  lines.push("============================================================", "汇总", "============================================================", "");
  lines.push(`PASS：${report.summary.pass}`);
  lines.push(`WARN：${report.summary.warn}`);
  lines.push(`FAIL：${report.summary.fail}`);
  lines.push(`SKIP：${report.summary.skip}`);
  lines.push("");
  lines.push(`总体状态：${report.summary.status}`);
  lines.push(`退出码：${exitCode}`);
  return `${lines.join("\n")}\n`;
}

function toolErrorOutput(options, startedAt, error) {
  const finishedAt = new Date().toISOString();
  const report = {
    tool: TOOL,
    version: VERSION,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    summary: { pass: 0, warn: 0, fail: 1, skip: 0, status: "TOOL ERROR" },
    checks: [{ id: "tool.initialization", category: "environment", status: "FAIL", message: redactText(error?.message ?? error), details: {} }],
  };
  if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(`投研看板开发环境健康检查 V1\n\nTOOL ERROR  ${report.checks[0].message}\n退出码：2\n`);
}

function main() {
  const startedAt = new Date().toISOString();
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return 0;
    }
    const root = findProjectRoot();
    if (!root) throw new Error("无法从当前目录或脚本目录向上定位项目根目录");
    const ciPath = path.join(root, ".github", "workflows", "ci.yml");
    const ciText = fs.existsSync(ciPath) ? fs.readFileSync(ciPath, "utf8") : "";
    const ci = parseCiConfig(ciText);
    const reporter = createReporter(options, { root, packageJson: null, lock: null });

    reporter.add("repository.root", "environment", "PASS", "已定位项目根目录", { root });
    if (!ci.node || !ci.python) reporter.add("ci.runtime-versions", "ci", "WARN", "无法可靠解析 CI 的 Node 或 Python 版本", { node: ci.node, python: ci.python });
    else reporter.add("ci.runtime-versions", "ci", "PASS", `CI 运行时要求：Node ${ci.node}，Python ${ci.python}`, { node: ci.node, python: ci.python });

    const tools = checkEnvironment(reporter, ci);
    reporter.guard("dependencies.unexpected", "dependencies", () => checkProjectFilesAndDependencies(reporter, tools));
    reporter.guard("git.unexpected", "git", () => checkGitAndSecurity(reporter, tools));
    reporter.guard("gh.unexpected", "git", () => checkGitHubCli(reporter, tools));
    reporter.guard("scripts.unexpected", "scripts", () => checkScriptsAndCi(reporter, ci));
    reporter.guard("data.unexpected", "data", () => checkDataArtifacts(reporter));
    reporter.guard("validators.unexpected", "validators", () => checkReadOnlyValidators(reporter, tools));

    const finishedAt = new Date().toISOString();
    const summary = summarize(reporter.checks);
    const report = {
      tool: TOOL,
      version: VERSION,
      startedAt,
      finishedAt,
      durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
      runDirectory: process.cwd(),
      projectRoot: root,
      summary,
      checks: reporter.checks,
    };
    const exitCode = exitCodeFor(summary, options);
    if (options.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else process.stdout.write(humanReport(report, options, exitCode));
    return exitCode;
  } catch (error) {
    options ??= { json: process.argv.includes("--json") };
    toolErrorOutput(options, startedAt, error);
    return 2;
  }
}

process.exitCode = main();
