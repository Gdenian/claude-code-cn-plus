const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  localizePluginDescriptions,
  readField,
} = require('../src/plugin-localizer');

function makeTempClaudeDir() {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-plugin-'));
  const skillDir = path.join(claudeDir, 'plugins', 'cache', 'market', 'demo-plugin', '1.0.0', 'skills', 'demo');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    'name: demo-skill',
    'description: "English desc"',
    '---',
    '',
    'Body stays English.',
  ].join('\n'));
  return { claudeDir, skillPath: path.join(skillDir, 'SKILL.md') };
}

function writeMemory(filePath, translations) {
  fs.writeFileSync(filePath, JSON.stringify({ version: 1, translations }, null, 2));
}

test('localizePluginDescriptions replaces only description from translation memory', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  writeMemory(memoryPath, {
    'demo-plugin/demo-skill': '中文描述: 带 "引号"',
  });

  const result = localizePluginDescriptions({ claudeDir: fixture.claudeDir, memoryPath });
  const content = fs.readFileSync(fixture.skillPath, 'utf8');

  assert.equal(result.patched, 1);
  assert.equal(result.missing, 0);
  assert.equal(readField(content, 'description'), '中文描述: 带 \\"引号\\"');
  assert.match(content, /Body stays English\./);
});

test('localizePluginDescriptions warns for missing translations and skips Chinese descriptions', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  writeMemory(memoryPath, {});

  const missing = localizePluginDescriptions({ claudeDir: fixture.claudeDir, memoryPath });
  assert.equal(missing.patched, 0);
  assert.equal(missing.missing, 1);
  assert.deepEqual(missing.missingKeys, ['demo-plugin/demo-skill']);

  fs.writeFileSync(fixture.skillPath, [
    '---',
    'name: demo-skill',
    'description: "已有中文"',
    '---',
  ].join('\n'));
  const skipped = localizePluginDescriptions({ claudeDir: fixture.claudeDir, memoryPath });
  assert.equal(skipped.skipped, 1);
  assert.equal(skipped.missing, 0);
});

test('localizePluginDescriptions supports dry-run without writing files', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  writeMemory(memoryPath, {
    'demo-plugin/demo-skill': '中文描述',
  });
  const before = fs.readFileSync(fixture.skillPath, 'utf8');

  const result = localizePluginDescriptions({ claudeDir: fixture.claudeDir, memoryPath, dryRun: true });

  assert.equal(result.patched, 1);
  assert.equal(fs.readFileSync(fixture.skillPath, 'utf8'), before);
});
