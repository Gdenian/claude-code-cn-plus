const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runDoctor, isNode20Plus } = require('../src/doctor');

function makeClaudeDir() {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-doctor-'));
  fs.mkdirSync(path.join(claudeDir, 'plugins', 'cache'), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'localize-backups'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
    hooks: {
      PostToolUse: [
        { hooks: [{ command: 'node /tmp/tool-tips.js' }] },
        { hooks: [{ command: 'node /tmp/auto-localize.js' }] },
      ],
    },
  }));
  fs.writeFileSync(path.join(claudeDir, 'localize-manifest.json'), JSON.stringify({ ok: true }));
  return claudeDir;
}

test('isNode20Plus checks major version only', () => {
  assert.equal(isNode20Plus('20.0.0'), true);
  assert.equal(isNode20Plus('19.9.9'), false);
});

test('runDoctor reports hooks, plugin cache, backups, and manifest status', async () => {
  const claudeDir = makeClaudeDir();
  const report = await runDoctor({
    claudeDir,
    installation: { kind: 'npm', path: '/tmp/cli.js', version: '1.0.0' },
    nodeVersion: '20.0.0',
  });

  assert.equal(report.node.ok, true);
  assert.equal(report.installation.version, '1.0.0');
  assert.equal(report.hooks.toolTips, true);
  assert.equal(report.hooks.autoLocalize, true);
  assert.equal(report.pluginCache.exists, true);
  assert.equal(report.backups.exists, true);
  assert.equal(report.manifest.exists, true);
});
