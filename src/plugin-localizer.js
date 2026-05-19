'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function readField(content, field) {
  const quoted = content.match(new RegExp(`^---[\\s\\S]*?^${field}:\\s*["'](.+?)["']\\s*$`, 'm'));
  if (quoted) return quoted[1];
  const unquoted = content.match(new RegExp(`^---[\\s\\S]*?^${field}:\\s*(.+?)\\s*$`, 'm'));
  return unquoted ? unquoted[1].trim() : null;
}

function escapeYamlValue(value) {
  if (value.includes('"') || value.includes('\\') || value.includes('\n') || value.includes(': ')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return `"${value}"`;
}

function loadTranslationMemory(memoryPath) {
  if (!fs.existsSync(memoryPath)) return {};
  const parsed = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  return parsed.translations || {};
}

function isCommandFile(filePath) {
  return filePath.split(path.sep).includes('commands') && filePath.endsWith('.md');
}

function scanRecursively(dir, plugin, results) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanRecursively(fullPath, plugin, results);
      continue;
    }

    if (entry.name !== 'SKILL.md' && !isCommandFile(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    let name = readField(content, 'name');
    if (!name && isCommandFile(fullPath)) name = path.basename(entry.name, '.md');
    const desc = readField(content, 'description');
    if (!name || !desc) continue;

    results.push({
      path: fullPath,
      plugin,
      name,
      desc,
      isChinese: /[\u4e00-\u9fff]/.test(desc),
    });
  }
}

function scanPluginFiles(claudeDir) {
  const cacheDir = path.join(claudeDir, 'plugins', 'cache');
  const results = [];
  if (!fs.existsSync(cacheDir)) return results;

  for (const marketplace of fs.readdirSync(cacheDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const marketplaceDir = path.join(cacheDir, marketplace.name);
    for (const plugin of fs.readdirSync(marketplaceDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      scanRecursively(path.join(marketplaceDir, plugin.name), plugin.name, results);
    }
  }
  return results;
}

function replaceDescription(filePath, newDescription, dryRun) {
  const content = fs.readFileSync(filePath, 'utf8');
  const current = readField(content, 'description');
  if (current && /[\u4e00-\u9fff]/.test(current)) return 'skip';

  const nextContent = content.replace(
    /^(---[\s\S]*?^description:\s*).+$/m,
    `$1${escapeYamlValue(newDescription)}`
  );
  if (nextContent === content) return false;
  if (!dryRun) fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}

function buildExtraTranslations(claudeDir, homeDir = os.homedir()) {
  return [
    {
      path: path.join(claudeDir, 'skills', 'frontend-design', 'SKILL.md'),
      name: 'frontend-design',
      desc: '创建独特的、生产级前端界面，具有高设计质量。当用户要求构建网页组件、页面、制品、海报或应用程序时使用。生成创意、精致的代码和 UI 设计，避免千篇一律的 AI 美学。',
    },
    {
      path: path.join(homeDir, '.cc-switch', 'skills', 'agent-reach', 'SKILL.md'),
      name: 'agent-reach',
      desc: '为你的 AI Agent 赋予全互联网访问能力。安装并配置上游工具，支持 Twitter/X、Reddit、YouTube、GitHub、Bilibili、小红书、抖音、LinkedIn、Boss直聘、RSS 及任意网页 — 配置后可直接调用。',
    },
    {
      path: path.join(homeDir, '.cc-switch', 'skills', 'unified-workflow-main', 'SKILL.md'),
      name: 'unified-workflow-main',
      desc: '在开始任何开发工作时使用，用于在 GSD（项目管理）和 Superpowers（工程规范）系统之间进行路由。通过在任务开始时提供单一路由决策，防止重复规划、冲突的子代理模型和重叠的设计捕获。',
    },
  ];
}

function localizePluginDescriptions(options) {
  const claudeDir = options.claudeDir;
  const memory = loadTranslationMemory(options.memoryPath);
  const dryRun = Boolean(options.dryRun);
  const missingKeys = [];
  let patched = 0;
  let skipped = 0;
  let missing = 0;

  for (const file of scanPluginFiles(claudeDir)) {
    if (file.isChinese) {
      skipped += 1;
      continue;
    }

    const key = `${file.plugin}/${file.name}`;
    const translation = memory[key];
    if (!translation) {
      if (!file.name.endsWith('-en') && !file.name.endsWith('-ja')) {
        missing += 1;
        missingKeys.push(key);
      }
      continue;
    }

    const result = replaceDescription(file.path, translation, dryRun);
    if (result === true) patched += 1;
    if (result === 'skip') skipped += 1;
  }

  for (const item of options.extraTranslations || buildExtraTranslations(claudeDir, options.homeDir)) {
    if (!fs.existsSync(item.path)) continue;
    const result = replaceDescription(item.path, item.desc, dryRun);
    if (result === true) patched += 1;
    if (result === 'skip') skipped += 1;
  }

  return { patched, skipped, missing, missingKeys, dryRun };
}

module.exports = {
  buildExtraTranslations,
  escapeYamlValue,
  loadTranslationMemory,
  localizePluginDescriptions,
  readField,
  replaceDescription,
  scanPluginFiles,
};
