const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { configureChineseLanguage } = require('../src/settings');
const { installHooks, uninstallHooks } = require('../src/hooks-manager');

function makeClaudeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-hooks-'));
}

test('installHooks adds tool tips and auto localize hooks without duplicates', () => {
  const claudeDir = makeClaudeDir();
  const installDir = path.join(claudeDir, 'install');

  installHooks({ claudeDir, installDir });
  installHooks({ claudeDir, installDir });

  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
  const hooks = settings.hooks.PostToolUse;
  const commands = hooks.flatMap((entry) => entry.hooks.map((hook) => hook.command));

  assert.equal(commands.filter((cmd) => cmd.includes('tool-tips.js')).length, 1);
  assert.equal(commands.filter((cmd) => cmd.includes('auto-localize.js')).length, 1);
});

test('uninstallHooks removes new and legacy hook entries', () => {
  const claudeDir = makeClaudeDir();
  const installDir = path.join(claudeDir, 'install');
  installHooks({ claudeDir, installDir });
  const settingsPath = path.join(claudeDir, 'settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  settings.hooks.PostToolUse.push({
    matcher: 'Bash',
    hooks: [{ type: 'command', command: '/tmp/auto-localize.sh' }],
  });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  uninstallHooks({ claudeDir });

  const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(after.hooks, undefined);
});

test('configureChineseLanguage writes settings and CLAUDE.md, dry-run leaves files untouched', () => {
  const claudeDir = makeClaudeDir();
  const dryRun = configureChineseLanguage({ claudeDir, dryRun: true });
  assert.equal(dryRun.changed, true);
  assert.equal(fs.existsSync(path.join(claudeDir, 'settings.json')), false);

  const applied = configureChineseLanguage({ claudeDir });
  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
  const claudeMd = fs.readFileSync(path.join(claudeDir, 'CLAUDE.md'), 'utf8');

  assert.equal(applied.changed, true);
  assert.equal(settings.language, 'chinese');
  assert.match(claudeMd, /始终使用中文回复用户/);
});

test('settings JSON parse errors abort hook and language writes', () => {
  const claudeDir = makeClaudeDir();
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{bad');

  assert.throws(
    () => installHooks({ claudeDir, installDir: claudeDir }),
    /settings.json 解析失败/
  );
  assert.throws(
    () => configureChineseLanguage({ claudeDir }),
    /settings.json 解析失败/
  );
});
