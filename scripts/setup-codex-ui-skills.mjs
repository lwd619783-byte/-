import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const managedSkills = [
  {
    name: 'investment-dashboard-ui-workflow',
    path: '.agents/skills/investment-dashboard-ui-workflow/SKILL.md',
    source: 'repo',
  },
  {
    name: 'redesign-existing-projects',
    path: '.agents/skills/redesign-existing-projects/SKILL.md',
    source: 'Taste Skill',
  },
  {
    name: 'impeccable',
    path: '.agents/skills/impeccable/SKILL.md',
    source: 'Impeccable',
  },
];

function verifySkills() {
  let ok = true;
  for (const skill of managedSkills) {
    const present = existsSync(skill.path);
    const mark = present ? 'PASS' : 'MISSING';
    console.log(`${mark} ${skill.name} (${skill.path})`);
    if (!present) ok = false;
  }
  return ok;
}

function runNpx(args, label) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(npx, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      DISABLE_TELEMETRY: process.env.DISABLE_TELEMETRY ?? '1',
    },
  });

  if (result.error) {
    console.error(`${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

if (checkOnly) {
  process.exit(verifySkills() ? 0 : 1);
}

runNpx(
  [
    '--yes',
    'skills@1.5.23',
    'add',
    'https://github.com/Leonxlnx/taste-skill/tree/ccbc15639c97057cbfcf32ecebc38ef716e4bb37/skills/redesign-skill',
    '--skill',
    'redesign-existing-projects',
    '--agent',
    'codex',
    '--copy',
    '--yes',
  ],
  'Install Taste redesign-existing-projects for Codex (project scope)',
);

runNpx(
  [
    '--yes',
    'impeccable@4.0.1',
    'install',
    '--providers=codex',
    '--scope=project',
  ],
  'Install Impeccable for Codex (project scope)',
);

console.log('\n==> Verify managed skills');
if (!verifySkills()) {
  console.error('\nOne or more managed skills are still missing. Review the installer output above.');
  process.exit(1);
}

console.log('\nManaged Codex UI skills are installed. Restart or reload Codex so it rediscovers them.');
console.log('If you want to use Impeccable hooks, inspect /hooks in Codex and approve the project hook explicitly.');
