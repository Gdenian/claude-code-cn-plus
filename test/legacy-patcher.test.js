const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { patchLegacyCli, restoreLegacyCli } = require('../src/legacy-patcher');

function makeTempClaudePackage() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-legacy-'));
  const pkgDir = path.join(root, '@anthropic-ai', 'claude-code');
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '1.2.3' }));
  fs.writeFileSync(path.join(pkgDir, 'cli.js'), 'const label = "Hello world";');
  return {
    root,
    pkgDir,
    cliPath: path.join(pkgDir, 'cli.js'),
    backupPath: path.join(pkgDir, 'cli.bak.js'),
  };
}

test('patchLegacyCli creates backup and applies translations from the original baseline', () => {
  const fixture = makeTempClaudePackage();

  const first = patchLegacyCli({
    cliPath: fixture.cliPath,
    translations: { 'Hello world': '你好世界' },
  });
  assert.equal(fs.readFileSync(fixture.backupPath, 'utf8'), 'const label = "Hello world";');
  assert.equal(fs.readFileSync(fixture.cliPath, 'utf8'), 'const label = "你好世界";');
  assert.equal(first.version, '1.2.3');
  assert.equal(first.report.replacements, 1);

  fs.writeFileSync(fixture.cliPath, 'const label = "手动污染";');
  const second = patchLegacyCli({
    cliPath: fixture.cliPath,
    translations: { 'Hello world': '你好世界' },
  });

  assert.equal(fs.readFileSync(fixture.cliPath, 'utf8'), 'const label = "你好世界";');
  assert.equal(second.report.replacements, 1);
});

test('restoreLegacyCli restores cli.js and can keep or remove the backup', () => {
  const fixture = makeTempClaudePackage();
  patchLegacyCli({
    cliPath: fixture.cliPath,
    translations: { 'Hello world': '你好世界' },
  });

  const kept = restoreLegacyCli({ cliPath: fixture.cliPath, removeBackup: false });
  assert.equal(kept.restored, true);
  assert.equal(fs.readFileSync(fixture.cliPath, 'utf8'), 'const label = "Hello world";');
  assert.equal(fs.existsSync(fixture.backupPath), true);

  const removed = restoreLegacyCli({ cliPath: fixture.cliPath, removeBackup: true });
  assert.equal(removed.restored, true);
  assert.equal(fs.existsSync(fixture.backupPath), false);
});
