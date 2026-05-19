'use strict';

const fs = require('node:fs');
const path = require('node:path');

function settingsPathFor(claudeDir) {
  return path.join(claudeDir, 'settings.json');
}

function claudeMdPathFor(claudeDir) {
  return path.join(claudeDir, 'CLAUDE.md');
}

function readSettings(claudeDir) {
  const settingsPath = settingsPathFor(claudeDir);
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (error) {
    throw new Error(`settings.json 解析失败: ${error.message}`);
  }
}

function writeSettings(claudeDir, settings, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(settingsPathFor(claudeDir), JSON.stringify(settings, null, 2));
}

function configureChineseLanguage(options) {
  const claudeDir = options.claudeDir;
  const dryRun = Boolean(options.dryRun);
  const settings = readSettings(claudeDir);
  let changed = settings.language !== 'chinese';

  settings.language = 'chinese';
  writeSettings(claudeDir, settings, dryRun);

  const claudeMdPath = claudeMdPathFor(claudeDir);
  const languageBlock = '## 语言\n- 始终使用中文回复用户\n';
  const current = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';
  if (!current.includes('始终使用中文')) {
    changed = true;
    if (!dryRun) {
      fs.mkdirSync(claudeDir, { recursive: true });
      const prefix = current && !current.endsWith('\n') ? `${current}\n\n` : current ? `${current}\n` : '';
      fs.writeFileSync(claudeMdPath, `${prefix}${languageBlock}`, 'utf8');
    }
  }

  return { changed, dryRun };
}

module.exports = {
  claudeMdPathFor,
  configureChineseLanguage,
  readSettings,
  settingsPathFor,
  writeSettings,
};
