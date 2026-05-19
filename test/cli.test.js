const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs } = require('../src/cli');

test('parseArgs parses command and common flags', () => {
  assert.deepEqual(
    parseArgs(['install', '--yes', '--dry-run', '--claude-dir', '/tmp/claude', '--install-dir', '/tmp/app', '--verbose']),
    {
      command: 'install',
      options: {
        yes: true,
        dryRun: true,
        claudeDir: '/tmp/claude',
        installDir: '/tmp/app',
        verbose: true,
      },
    }
  );
});

test('parseArgs parses localize --auto', () => {
  assert.deepEqual(
    parseArgs(['localize', '--auto']),
    {
      command: 'localize',
      options: { auto: true },
    }
  );
});
