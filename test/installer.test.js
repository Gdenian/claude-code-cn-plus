const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { install, restoreCli, uninstall } = require('../src/installer');

function makeEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-install-'));
  const claudeDir = path.join(root, '.claude');
  const installDir = path.join(root, 'app');
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(installDir, { recursive: true });
  return { root, claudeDir, installDir };
}

function makeLegacyPackage(root) {
  const pkgDir = path.join(root, 'npm', '@anthropic-ai', 'claude-code');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
  fs.writeFileSync(path.join(pkgDir, 'cli.js'), 'const label = "Hello world";');
  return {
    kind: 'npm',
    path: path.join(pkgDir, 'cli.js'),
    version: '1.0.0',
  };
}

test('install patches legacy CLI, installs hooks, language config, and install path', async () => {
  const env = makeEnv();
  const installation = makeLegacyPackage(env.root);

  const result = await install({
    yes: true,
    claudeDir: env.claudeDir,
    installDir: env.installDir,
    installation,
    translations: { 'Hello world': '你好世界' },
    extraTranslations: {},
    memoryPath: path.join(env.installDir, 'missing-memory.json'),
  });

  assert.equal(result.ok, true);
  assert.equal(fs.readFileSync(installation.path, 'utf8'), 'const label = "你好世界";');
  assert.equal(fs.readFileSync(path.join(env.claudeDir, 'localize-install-path'), 'utf8'), env.installDir);
  assert.match(fs.readFileSync(path.join(env.claudeDir, 'CLAUDE.md'), 'utf8'), /始终使用中文/);

  const settings = JSON.parse(fs.readFileSync(path.join(env.claudeDir, 'settings.json'), 'utf8'));
  assert.equal(settings.language, 'chinese');
  assert.equal(settings.hooks.PostToolUse.length, 2);

  const manifest = JSON.parse(fs.readFileSync(path.join(env.claudeDir, 'localize-manifest.json'), 'utf8'));
  assert.equal(manifest.cliVersion, '1.0.0');
  assert.deepEqual(manifest.plugins, {});

  const skillPath = path.join(env.claudeDir, 'skills', 'cccn-localize-missing', 'SKILL.md');
  assert.equal(fs.existsSync(skillPath), true);
  assert.match(fs.readFileSync(skillPath, 'utf8'), /cccn-localize-missing/);
  assert.match(fs.readFileSync(skillPath, 'utf8'), /scan-missing --json/);

  const commandPath = path.join(env.claudeDir, 'commands', 'cccn-localize-missing.md');
  assert.equal(fs.existsSync(commandPath), true);
  assert.match(fs.readFileSync(commandPath, 'utf8'), /scan-missing --json/);
  assert.match(fs.readFileSync(commandPath, 'utf8'), /apply-generated-translations/);
});

test('install returns failure after native patch rollback but keeps non-CLI features', async () => {
  const env = makeEnv();
  const binaryPath = path.join(env.root, 'claude');
  fs.writeFileSync(binaryPath, 'native-binary');
  const api = {
    readContent: async () => 'const label = "Hello world";',
    writeContent: async () => {
      throw new Error('native write failed');
    },
    backupFile: async (source, backup) => fs.copyFileSync(source, backup),
    restoreBackup: async (backup, target) => fs.copyFileSync(backup, target),
  };

  const result = await install({
    yes: true,
    claudeDir: env.claudeDir,
    installDir: env.installDir,
    installation: { kind: 'native', path: binaryPath, version: '2.0.0' },
    tweakccApi: api,
    translations: { 'Hello world': '你好世界' },
    extraTranslations: {},
    memoryPath: path.join(env.installDir, 'missing-memory.json'),
  });

  assert.equal(result.ok, false);
  assert.match(result.error.message, /native write failed/);
  assert.equal(fs.readFileSync(binaryPath, 'utf8'), 'native-binary');
  assert.equal(fs.existsSync(path.join(env.claudeDir, 'settings.json')), true);
  assert.equal(fs.readFileSync(path.join(env.claudeDir, 'localize-install-path'), 'utf8'), env.installDir);
});

test('install dry-run succeeds without a Claude Code installation', async () => {
  const env = makeEnv();

  const result = await install({
    yes: true,
    dryRun: true,
    claudeDir: env.claudeDir,
    installDir: env.installDir,
    installation: null,
    memoryPath: path.join(env.installDir, 'missing-memory.json'),
  });

  assert.equal(result.ok, true);
  assert.equal(result.cli.type, 'none');
  assert.equal(fs.existsSync(path.join(env.claudeDir, 'settings.json')), false);
});

test('restoreCli and uninstall restore CLI and remove hooks plus manifest files', async () => {
  const env = makeEnv();
  const installation = makeLegacyPackage(env.root);
  await install({
    yes: true,
    claudeDir: env.claudeDir,
    installDir: env.installDir,
    installation,
    translations: { 'Hello world': '你好世界' },
    extraTranslations: {},
    memoryPath: path.join(env.installDir, 'missing-memory.json'),
  });

  const restored = await restoreCli({ claudeDir: env.claudeDir, installation });
  assert.equal(restored.restored, true);
  assert.equal(fs.readFileSync(installation.path, 'utf8'), 'const label = "Hello world";');

  await install({
    yes: true,
    claudeDir: env.claudeDir,
    installDir: env.installDir,
    installation,
    translations: { 'Hello world': '你好世界' },
    extraTranslations: {},
    memoryPath: path.join(env.installDir, 'missing-memory.json'),
  });
  const removed = await uninstall({ yes: true, claudeDir: env.claudeDir, installation });
  const settings = JSON.parse(fs.readFileSync(path.join(env.claudeDir, 'settings.json'), 'utf8'));

  assert.equal(removed.ok, true);
  assert.equal(fs.readFileSync(installation.path, 'utf8'), 'const label = "Hello world";');
  assert.equal(fs.existsSync(path.join(path.dirname(installation.path), 'cli.bak.js')), false);
  assert.equal(settings.hooks, undefined);
  assert.equal(fs.existsSync(path.join(env.claudeDir, 'localize-install-path')), false);
  assert.equal(fs.existsSync(path.join(env.claudeDir, 'skills', 'cccn-localize-missing')), false);
  assert.equal(fs.existsSync(path.join(env.claudeDir, 'commands', 'cccn-localize-missing.md')), false);
});
