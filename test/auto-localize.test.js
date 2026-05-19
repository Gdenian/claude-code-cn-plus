const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { localizeAuto, readPluginVersions, versionsChanged } = require('../src/auto-localize');

function makeClaudeDir() {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-auto-'));
  fs.mkdirSync(path.join(claudeDir, 'plugins'), { recursive: true });
  return claudeDir;
}

test('versionsChanged detects CLI or plugin version drift', () => {
  assert.equal(versionsChanged({ cliVersion: '1', plugins: { a: '1' } }, { cliVersion: '1', plugins: { a: '1' } }), false);
  assert.equal(versionsChanged({ cliVersion: '2', plugins: { a: '1' } }, { cliVersion: '1', plugins: { a: '1' } }), true);
  assert.equal(versionsChanged({ cliVersion: '1', plugins: { a: '2' } }, { cliVersion: '1', plugins: { a: '1' } }), true);
});

test('readPluginVersions returns installed plugin versions', () => {
  const claudeDir = makeClaudeDir();
  const installedPath = path.join(claudeDir, 'plugins', 'installed_plugins.json');
  fs.writeFileSync(installedPath, JSON.stringify({ plugins: { demo: [{ version: '3.2.1' }] } }));

  assert.deepEqual(readPluginVersions(claudeDir), { demo: '3.2.1' });
});

test('localizeAuto skips work when stored versions match', async () => {
  const claudeDir = makeClaudeDir();
  fs.writeFileSync(path.join(claudeDir, 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { demo: [{ version: '3.2.1' }] } }));
  fs.writeFileSync(path.join(claudeDir, 'localize-manifest.json'), JSON.stringify({ cliVersion: '2.0.0', plugins: { demo: '3.2.1' } }));

  const result = await localizeAuto({
    claudeDir,
    installDir: claudeDir,
    installation: { kind: 'npm', path: '/tmp/cli.js', version: '2.0.0' },
    dryRun: true,
    memoryPath: path.join(claudeDir, 'translation-memory.json'),
  });

  assert.equal(result.changed, false);
});
