#!/usr/bin/env node
'use strict';

const os = require('node:os');
const path = require('node:path');

const { generatedTranslationsPathFor, localizePluginDescriptions } = require('../src/plugin-localizer');

function main(options = {}) {
  const claudeDir = options.claudeDir || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const memoryPath = options.memoryPath || path.join(__dirname, 'translation-memory.json');
  const generatedMemoryPath = options.generatedMemoryPath || generatedTranslationsPathFor(claudeDir);
  const result = localizePluginDescriptions({ claudeDir, memoryPath, generatedMemoryPath, dryRun: options.dryRun });

  console.log(`插件汉化完成! ${result.patched} 处已翻译, ${result.skipped} 处已跳过`);
  if (result.missing > 0) {
    console.log(`警告: ${result.missing} 个描述无翻译（可在 Claude Code 中运行 /cccn-localize-missing 补全）`);
  }
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { main };
