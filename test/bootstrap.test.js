const test = require('node:test');
const assert = require('node:assert/strict');

const { buildBootstrapPlan } = require('../src/bootstrap-plan');

test('buildBootstrapPlan uses fixed stable tag and default install dir', () => {
  const plan = buildBootstrapPlan({
    env: { HOME: '/home/me' },
    cwd: '/tmp/curl',
    currentSource: false,
  });

  assert.equal(plan.channel, 'stable');
  assert.equal(plan.version, 'v0.1.0');
  assert.equal(plan.installDir, '/home/me/.claude-code-cn-plus');
  assert.match(plan.archiveUrl, /\/refs\/tags\/v0\.1\.0\.tar\.gz$/);
  assert.equal(plan.usesCurrentSource, false);
});

test('buildBootstrapPlan supports CHANNEL=main and VERSION override', () => {
  const main = buildBootstrapPlan({
    env: { HOME: '/home/me', CHANNEL: 'main' },
    cwd: '/tmp/curl',
    currentSource: false,
  });
  assert.match(main.archiveUrl, /\/refs\/heads\/main\.tar\.gz$/);

  const versioned = buildBootstrapPlan({
    env: { HOME: '/home/me', VERSION: 'v9.9.9', INSTALL_DIR: '/opt/cccn' },
    cwd: '/tmp/curl',
    currentSource: false,
  });
  assert.equal(versioned.version, 'v9.9.9');
  assert.equal(versioned.installDir, '/opt/cccn');
  assert.match(versioned.archiveUrl, /\/refs\/tags\/v9\.9\.9\.tar\.gz$/);
});

test('buildBootstrapPlan uses current repository source for development runs', () => {
  const plan = buildBootstrapPlan({
    env: { HOME: '/home/me' },
    cwd: '/repo',
    currentSource: true,
  });

  assert.equal(plan.sourceDir, '/repo');
  assert.equal(plan.installDir, '/repo');
  assert.equal(plan.usesCurrentSource, true);
  assert.equal(plan.archiveUrl, null);
});
