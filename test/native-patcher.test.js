const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildAdhocPatchArgs,
  patchNativeCli,
  restoreNativeCli,
} = require('../src/native-patcher');

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-native-'));
  const binaryPath = path.join(dir, 'claude');
  const backupDir = path.join(dir, 'backups');
  fs.writeFileSync(binaryPath, 'native-binary');
  return { dir, binaryPath, backupDir };
}

test('patchNativeCli uses tweakcc API, writes manifest, and reports replacements', async () => {
  const fixture = makeFixture();
  const written = [];
  const api = {
    readContent: async () => 'const label = "Hello world";',
    writeContent: async (_installation, content) => written.push(content),
    backupFile: async (source, backup) => fs.copyFileSync(source, backup),
    restoreBackup: async () => {},
  };

  const result = await patchNativeCli({
    installation: { path: fixture.binaryPath, kind: 'native', version: '2.0.0' },
    backupDir: fixture.backupDir,
    api,
    translations: { 'Hello world': '你好世界' },
    patcherVersion: 'tweakcc@4.0.13',
  });

  assert.equal(written[0], 'const label = "你好世界";');
  assert.equal(result.report.replacements, 1);
  assert.equal(result.version, '2.0.0');
  assert.equal(result.patcherVersion, 'tweakcc@4.0.13');
  assert.equal(fs.existsSync(result.backupPath), true);

  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
  assert.equal(manifest.type, 'native');
  assert.equal(manifest.path, fixture.binaryPath);
  assert.equal(manifest.version, '2.0.0');
  assert.equal(manifest.patcherVersion, 'tweakcc@4.0.13');
  assert.match(manifest.originalHash, /^[a-f0-9]{64}$/);
  assert.match(manifest.patchedHash, /^[a-f0-9]{64}$/);
});

test('patchNativeCli restores backup when writeContent fails', async () => {
  const fixture = makeFixture();
  let restored = false;
  const api = {
    readContent: async () => 'const label = "Hello world";',
    writeContent: async () => {
      throw new Error('write failed');
    },
    backupFile: async (source, backup) => fs.copyFileSync(source, backup),
    restoreBackup: async (backup, target) => {
      restored = true;
      fs.copyFileSync(backup, target);
    },
  };

  await assert.rejects(
    patchNativeCli({
      installation: { path: fixture.binaryPath, kind: 'native', version: '2.0.0' },
      backupDir: fixture.backupDir,
      api,
      translations: { 'Hello world': '你好世界' },
    }),
    /write failed/
  );
  assert.equal(restored, true);
  assert.equal(fs.readFileSync(fixture.binaryPath, 'utf8'), 'native-binary');
});

test('buildAdhocPatchArgs creates tweakcc CLI fallback arguments', () => {
  assert.deepEqual(
    buildAdhocPatchArgs({
      binaryPath: '/opt/claude',
      scriptPath: '/tmp/patch.js',
    }),
    [
      'adhoc-patch',
      '--script',
      '@/tmp/patch.js',
      '--path',
      '/opt/claude',
      '--confirm-possible-dangerous-patch',
    ]
  );
});

test('patchNativeCli does not overwrite original native backup on repeated patches', async () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.binaryPath, 'const label = "Hello world";');

  const api = {
    readContent: async (installation) => fs.readFileSync(installation.path, 'utf8'),
    writeContent: async (installation, content) => fs.writeFileSync(installation.path, content),
    backupFile: async (source, backup) => fs.copyFileSync(source, backup),
    restoreBackup: async (backup, target) => fs.copyFileSync(backup, target),
  };

  const installation = { path: fixture.binaryPath, kind: 'native', version: '2.0.0' };
  const first = await patchNativeCli({
    installation,
    backupDir: fixture.backupDir,
    api,
    translations: { 'Hello world': '你好世界' },
  });

  assert.equal(fs.readFileSync(first.backupPath, 'utf8'), 'const label = "Hello world";');

  await patchNativeCli({
    installation,
    backupDir: fixture.backupDir,
    api,
    translations: { 'Hello world': '你好世界' },
  });

  assert.equal(fs.readFileSync(first.backupPath, 'utf8'), 'const label = "Hello world";');

  await restoreNativeCli({ backupDir: fixture.backupDir, api });
  assert.equal(fs.readFileSync(fixture.binaryPath, 'utf8'), 'const label = "Hello world";');
});
