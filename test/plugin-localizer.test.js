const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  generatedTranslationsPathFor,
  localizePluginDescriptions,
  missingTranslationsPathFor,
  readField,
  scanMissingPluginDescriptions,
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

test('readField only reads fields from frontmatter', () => {
  const content = [
    '---',
    'name: demo',
    'description: Frontmatter desc',
    '---',
    '',
    'description: Body desc',
  ].join('\n');

  assert.equal(readField(content, 'description'), 'Frontmatter desc');
});

test('replaceDescription does not modify body description text', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  fs.writeFileSync(fixture.skillPath, [
    '---',
    'name: demo-skill',
    'description: English desc',
    '---',
    '',
    'description: Body desc must stay as-is',
  ].join('\n'));
  writeMemory(memoryPath, {
    'demo-plugin/demo-skill': '中文描述',
  });

  const result = localizePluginDescriptions({ claudeDir: fixture.claudeDir, memoryPath });
  const content = fs.readFileSync(fixture.skillPath, 'utf8');

  assert.equal(result.patched, 1);
  assert.match(content, /^description: "中文描述"$/m);
  assert.match(content, /^description: Body desc must stay as-is$/m);
});

test('readField ignores files without frontmatter', () => {
  assert.equal(readField('description: Body only', 'description'), null);
});

test('readField ignores body fields when frontmatter omits the field', () => {
  const content = [
    '---',
    'name: demo',
    '---',
    '',
    'description: Body desc',
  ].join('\n');

  assert.equal(readField(content, 'description'), null);
});

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

test('scanMissingPluginDescriptions includes user skills, user commands, and cc-switch skills', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  const missingPath = missingTranslationsPathFor(fixture.claudeDir);
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-home-'));
  writeMemory(memoryPath, {});

  const userSkillDir = path.join(fixture.claudeDir, 'skills', 'review');
  fs.mkdirSync(userSkillDir, { recursive: true });
  fs.writeFileSync(path.join(userSkillDir, 'SKILL.md'), [
    '---',
    'name: review',
    'description: Review code changes',
    '---',
  ].join('\n'));

  const commandDir = path.join(fixture.claudeDir, 'commands');
  fs.mkdirSync(commandDir, { recursive: true });
  fs.writeFileSync(path.join(commandDir, 'commit.md'), [
    '---',
    'description: Write a commit message',
    '---',
  ].join('\n'));

  const ccSwitchSkillDir = path.join(homeDir, '.cc-switch', 'skills', 'new-skill');
  fs.mkdirSync(ccSwitchSkillDir, { recursive: true });
  fs.writeFileSync(path.join(ccSwitchSkillDir, 'SKILL.md'), [
    '---',
    'name: new-skill',
    'description: Access public web sources',
    '---',
  ].join('\n'));

  const result = scanMissingPluginDescriptions({
    claudeDir: fixture.claudeDir,
    memoryPath,
    homeDir,
    missingPath,
  });

  assert.deepEqual(
    result.missingItems.map((item) => item.key).sort(),
    [
      'cc-switch-skill/new-skill',
      'demo-plugin/demo-skill',
      'user-command/commit',
      'user-skill/review',
    ].sort()
  );

  const stored = JSON.parse(fs.readFileSync(missingPath, 'utf8'));
  assert.equal(stored.missing.length, 4);
  assert.equal(stored.generatedPath, generatedTranslationsPathFor(fixture.claudeDir));
});

test('localizePluginDescriptions uses generated translations as a fallback', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  const generatedMemoryPath = generatedTranslationsPathFor(fixture.claudeDir);
  writeMemory(memoryPath, {});
  writeMemory(generatedMemoryPath, {
    'demo-plugin/demo-skill': '生成的中文描述',
  });

  const result = localizePluginDescriptions({
    claudeDir: fixture.claudeDir,
    memoryPath,
    generatedMemoryPath,
  });

  const content = fs.readFileSync(fixture.skillPath, 'utf8');
  assert.equal(result.patched, 1);
  assert.equal(result.missing, 0);
  assert.equal(readField(content, 'description'), '生成的中文描述');
});
