const test = require('node:test');
const assert = require('node:assert/strict');

const { applyTranslations, containsChinese } = require('../src/translation-engine');

test('applyTranslations replaces quoted UI strings and reports counts', () => {
  const source = 'const a = "Hello world"; const b = \'Good bye\'; const c = "Missing";';
  const result = applyTranslations(source, {
    'Hello world': '你好世界',
    'Good bye': '再见',
    Unused: '不会出现',
  });

  assert.equal(result.content, 'const a = "你好世界"; const b = \'再见\'; const c = "Missing";');
  assert.equal(result.matchedEntries, 2);
  assert.equal(result.replacements, 2);
  assert.deepEqual(result.missingEntries, ['Unused']);
  assert.equal(result.alreadyLocalized, false);
});

test('applyTranslations is idempotent when content is already Chinese', () => {
  const source = 'const a = "你好世界";';
  const result = applyTranslations(source, {
    'Hello world': '你好世界',
  });

  assert.equal(result.content, source);
  assert.equal(result.matchedEntries, 0);
  assert.equal(result.replacements, 0);
  assert.deepEqual(result.missingEntries, ['Hello world']);
  assert.equal(result.alreadyLocalized, true);
});

test('containsChinese detects localized content', () => {
  assert.equal(containsChinese('Claude Code'), false);
  assert.equal(containsChinese('Claude Code 中文'), true);
});
