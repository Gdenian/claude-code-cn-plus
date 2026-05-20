const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { install } = require('../src/installer');
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

test('readPluginVersions returns empty object for malformed installed plugins json', () => {
  const claudeDir = makeClaudeDir();
  const installedPath = path.join(claudeDir, 'plugins', 'installed_plugins.json');
  fs.writeFileSync(installedPath, '{bad');

  assert.deepEqual(readPluginVersions(claudeDir), {});
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

test('localizeAuto skips immediately after install writes manifest', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-auto-install-'));
  const claudeDir = path.join(root, '.claude');
  const installDir = path.join(root, 'app');
  const binaryPath = path.join(root, 'claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(installDir, { recursive: true });
  fs.writeFileSync(binaryPath, 'native-binary');

  let readContentCount = 0;
  const api = {
    readContent: async () => {
      readContentCount += 1;
      return 'const label = "Hello world";';
    },
    writeContent: async () => {},
    backupFile: async (source, backup) => fs.copyFileSync(source, backup),
    restoreBackup: async (backup, target) => fs.copyFileSync(backup, target),
  };
  const installation = { kind: 'native', path: binaryPath, version: '2.0.0' };

  await install({
    claudeDir,
    installDir,
    installation,
    tweakccApi: api,
    translations: { 'Hello world': '你好世界' },
    extraTranslations: {},
    memoryPath: path.join(installDir, 'translation-memory.json'),
  });
  readContentCount = 0;

  const result = await localizeAuto({
    claudeDir,
    installDir,
    installation,
    tweakccApi: api,
    translations: { 'Hello world': '你好世界' },
    extraTranslations: {},
    memoryPath: path.join(installDir, 'translation-memory.json'),
    dryRun: true,
  });

  assert.equal(result.changed, false);
  assert.equal(readContentCount, 0);
});
