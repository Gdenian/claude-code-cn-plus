const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const { parseArgs, run } = require('../src/cli');

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

test('parseArgs parses scan-missing json mode', () => {
  assert.deepEqual(
    parseArgs(['scan-missing', '--json', '--claude-dir', '/tmp/claude', '--install-dir', '/tmp/app']),
    {
      command: 'scan-missing',
      options: {
        json: true,
        claudeDir: '/tmp/claude',
        installDir: '/tmp/app',
      },
    }
  );
});

test('parseArgs rejects missing path option values', () => {
  assert.throws(() => parseArgs(['doctor', '--claude-dir']), /--claude-dir 需要路径参数/);
  assert.throws(() => parseArgs(['install', '--install-dir']), /--install-dir 需要路径参数/);
  assert.throws(() => parseArgs(['scan-missing', '--project-dir']), /--project-dir 需要路径参数/);
});

test('parseArgs rejects another flag as a path value', () => {
  assert.throws(() => parseArgs(['doctor', '--claude-dir', '--json']), /--claude-dir 需要路径参数/);
});

test('run saves generated translations from stdin', async () => {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-cli-save-'));
  let output = '';

  const code = await run(
    ['save-generated-translations', '--claude-dir', claudeDir],
    {
      stdin: Readable.from([JSON.stringify({
        version: 1,
        translations: {
          'demo-plugin/demo-skill': '生成的中文描述',
        },
      })]),
      stdout: { write: (chunk) => { output += chunk; } },
      stderr: { write: () => {} },
    }
  );

  const generatedPath = path.join(claudeDir, 'localize-generated-translations.json');
  const stored = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));

  assert.equal(code, 0);
  assert.equal(stored.version, 1);
  assert.deepEqual(stored.translations, {
    'demo-plugin/demo-skill': '生成的中文描述',
  });
  assert.match(output, /已保存本地生成翻译: count=1/);
});

test('run rejects generated translations with non-string values', async () => {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-cli-save-invalid-'));

  await assert.rejects(
    run(
      ['save-generated-translations', '--claude-dir', claudeDir],
      {
        stdin: Readable.from([JSON.stringify({
          version: 1,
          translations: {
            'demo-plugin/demo-skill': { text: '中文描述' },
          },
        })]),
        stdout: { write: () => {} },
        stderr: { write: () => {} },
      }
    ),
    /字符串键值对/
  );

  assert.equal(fs.existsSync(path.join(claudeDir, 'localize-generated-translations.json')), false);
});
