const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { buildBootstrapPlan } = require('../src/bootstrap-plan');

test('buildBootstrapPlan defaults to main branch and default install dir', () => {
  const plan = buildBootstrapPlan({
    env: { HOME: '/home/me' },
    cwd: '/tmp/curl',
    currentSource: false,
  });

  assert.equal(plan.channel, 'main');
  assert.equal(plan.version, 'v0.1.0');
  assert.equal(plan.installDir, path.join('/home/me', '.claude-code-cn-plus'));
  assert.match(plan.archiveUrl, /\/refs\/heads\/main\.tar\.gz$/);
  assert.equal(plan.usesCurrentSource, false);
});

test('buildBootstrapPlan supports explicit CHANNEL=stable and VERSION override', () => {
  const stable = buildBootstrapPlan({
    env: { HOME: '/home/me', CHANNEL: 'stable', VERSION: 'v9.9.9' },
    cwd: '/tmp/curl',
    currentSource: false,
  });
  assert.equal(stable.channel, 'stable');
  assert.equal(stable.version, 'v9.9.9');
  assert.match(stable.archiveUrl, /\/refs\/tags\/v9\.9\.9\.tar\.gz$/);

  const versioned = buildBootstrapPlan({
    env: { HOME: '/home/me', VERSION: 'v9.9.9', INSTALL_DIR: '/opt/cccn' },
    cwd: '/tmp/curl',
    currentSource: false,
  });
  assert.equal(versioned.version, 'v9.9.9');
  assert.equal(versioned.installDir, '/opt/cccn');
  assert.match(versioned.archiveUrl, /\/refs\/heads\/main\.tar\.gz$/);
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
