'use strict';

function containsChinese(value) {
  return /[\u4e00-\u9fff]/.test(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeDoubleQuoted(value) {
  return JSON.stringify(value);
}

function escapeSingleQuoted(value) {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')}'`;
}

function countOccurrences(content, needle) {
  if (!needle) return 0;
  return content.split(needle).length - 1;
}

function applyTranslations(content, translations) {
  let nextContent = content;
  const missingEntries = [];
  let matchedEntries = 0;
  let replacements = 0;

  for (const [source, target] of Object.entries(translations)) {
    let count = 0;

    if (source.startsWith('`') || source.startsWith('\\')) {
      const regex = new RegExp(escapeRegex(source).replace(/\\n/g, '\\\\n'), 'g');
      const matches = nextContent.match(regex);
      count = matches ? matches.length : 0;
      if (count > 0) {
        nextContent = nextContent.replace(regex, target);
      }
    } else {
      const doubleNeedle = `"${source}"`;
      const singleNeedle = `'${source}'`;
      const doubleCount = countOccurrences(nextContent, doubleNeedle);
      const singleCount = countOccurrences(nextContent, singleNeedle);
      count = doubleCount + singleCount;

      if (doubleCount > 0) {
        nextContent = nextContent.split(doubleNeedle).join(escapeDoubleQuoted(target));
      }
      if (singleCount > 0) {
        nextContent = nextContent.split(singleNeedle).join(escapeSingleQuoted(target));
      }
    }

    if (count > 0) {
      matchedEntries += 1;
      replacements += count;
    } else {
      missingEntries.push(source);
    }
  }

  return {
    content: nextContent,
    matchedEntries,
    replacements,
    missingEntries,
    alreadyLocalized: containsChinese(content),
  };
}

module.exports = {
  applyTranslations,
  containsChinese,
};
