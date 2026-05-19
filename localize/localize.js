#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const path = require('node:path');

const extraUi = require('./extra-ui');
const keyword = require('./keyword');
const { detectLegacyFromNpmRoot } = require('../src/claude-installation');
const { patchLegacyCli } = require('../src/legacy-patcher');

function getCliPath() {
  const npmRoot = childProcess.execSync('npm root -g', { encoding: 'utf8' }).trim();
  const installation = detectLegacyFromNpmRoot(npmRoot);
  if (!installation) {
    throw new Error('未找到 Claude Code legacy cli.js');
  }
  return {
    cliPath: installation.path,
    cliBak: path.join(path.dirname(installation.path), 'cli.bak.js'),
  };
}

function localize(cliPath) {
  const result = patchLegacyCli({ cliPath, translations: keyword, extraTranslations: extraUi.translations });
  console.log(`关键词汉化完成! ${result.report.matchedEntries}/${Object.keys(keyword).length} 条匹配, ${result.report.replacements} 处替换`);
  return result.report.replacements;
}

if (require.main === module) {
  try {
    const { cliPath } = getCliPath();
    console.log(`CLI 路径: ${cliPath}`);
    localize(cliPath);
    console.log('请重启 Claude Code 使汉化生效');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { getCliPath, localize };
