'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/);
  if (!match) return null;
  return {
    full: match[0],
    body: match[1],
    end: match[0].length,
  };
}

function readField(content, field) {
  const frontmatter = splitFrontmatter(content);
  if (!frontmatter) return null;

  const quoted = frontmatter.body.match(new RegExp(`^${field}:\\s*["'](.+?)["']\\s*$`, 'm'));
  if (quoted) return quoted[1];

  const unquoted = frontmatter.body.match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm'));
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

function loadTranslationMemories(memoryPaths) {
  const translations = {};
  for (const memoryPath of memoryPaths.filter(Boolean)) {
    Object.assign(translations, loadTranslationMemory(memoryPath));
  }
  return translations;
}

function missingTranslationsPathFor(claudeDir) {
  return path.join(claudeDir, 'localize-missing-translations.json');
}

function generatedTranslationsPathFor(claudeDir) {
  return path.join(claudeDir, 'localize-generated-translations.json');
}

function isCommandFile(filePath) {
  return filePath.split(path.sep).includes('commands') && filePath.endsWith('.md');
}

function pushDescriptionFile(filePath, source, keyPrefix, fallbackName, results) {
  const content = fs.readFileSync(filePath, 'utf8');
  const name = readField(content, 'name') || fallbackName;
  const desc = readField(content, 'description');
  if (!name || !desc) return;

  results.push({
    path: filePath,
    plugin: keyPrefix,
    source,
    name,
    key: `${keyPrefix}/${name}`,
    desc,
    isChinese: /[\u4e00-\u9fff]/.test(desc),
  });
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

    const fallbackName = isCommandFile(fullPath) ? path.basename(entry.name, '.md') : null;
    pushDescriptionFile(fullPath, 'plugin', plugin, fallbackName, results);
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

function scanUserSkills(claudeDir, results) {
  const skillsDir = path.join(claudeDir, 'skills');
  if (!fs.existsSync(skillsDir)) return;
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    pushDescriptionFile(skillPath, 'user-skill', 'user-skill', entry.name, results);
  }
}

function scanCommandFiles(rootDir, source, keyPrefix, results) {
  const commandsDir = path.join(rootDir, 'commands');
  if (!fs.existsSync(commandsDir)) return;
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      const relativeName = path.relative(commandsDir, fullPath).replace(/\\/g, '/').replace(/\.md$/, '');
      pushDescriptionFile(fullPath, source, keyPrefix, relativeName, results);
    }
  };
  visit(commandsDir);
}

function scanCcSwitchSkills(homeDir, results) {
  const skillsDir = path.join(homeDir, '.cc-switch', 'skills');
  if (!fs.existsSync(skillsDir)) return;
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    pushDescriptionFile(skillPath, 'cc-switch-skill', 'cc-switch-skill', entry.name, results);
  }
}

function scanAllDescriptionFiles(options) {
  const results = scanPluginFiles(options.claudeDir);
  scanUserSkills(options.claudeDir, results);
  scanCommandFiles(options.claudeDir, 'user-command', 'user-command', results);
  scanCcSwitchSkills(options.homeDir || os.homedir(), results);
  if (options.projectDir) {
    scanCommandFiles(path.join(options.projectDir, '.claude'), 'project-command', 'project-command', results);
  }
  return results;
}

function replaceDescription(filePath, newDescription, dryRun) {
  const content = fs.readFileSync(filePath, 'utf8');
  const current = readField(content, 'description');
  if (current && /[\u4e00-\u9fff]/.test(current)) return 'skip';

  const frontmatter = splitFrontmatter(content);
  if (!frontmatter) return false;

  const nextFrontmatter = frontmatter.full.replace(
    /^(description:\s*).+$/m,
    `$1${escapeYamlValue(newDescription)}`
  );
  const nextContent = `${nextFrontmatter}${content.slice(frontmatter.end)}`;

  if (nextContent === content) return false;
  if (!dryRun) fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}

function shouldIgnoreMissing(file) {
  return file.name.endsWith('-en') || file.name.endsWith('-ja');
}

function buildMissingFilePayload(options, missingItems) {
  return {
    version: 1,
    generatedPath: options.generatedMemoryPath || generatedTranslationsPathFor(options.claudeDir),
    missing: missingItems.map((item) => ({
      key: item.key,
      path: item.path,
      source: item.source,
      name: item.name,
      description: item.desc,
    })),
  };
}

function writeMissingFile(options, missingItems) {
  const missingPath = options.missingPath || missingTranslationsPathFor(options.claudeDir);
  if (options.dryRun) return missingPath;
  fs.mkdirSync(path.dirname(missingPath), { recursive: true });
  fs.writeFileSync(missingPath, JSON.stringify(buildMissingFilePayload(options, missingItems), null, 2));
  return missingPath;
}

function saveGeneratedTranslations(options, payload) {
  const translations = payload?.translations;
  if (!payload || payload.version !== 1 || !translations || typeof translations !== 'object' || Array.isArray(translations)) {
    throw new Error('生成翻译 JSON 必须包含 version=1 和 translations 对象');
  }

  const generatedPath = options.generatedMemoryPath || generatedTranslationsPathFor(options.claudeDir);
  const data = { version: 1, translations };

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
    fs.writeFileSync(generatedPath, JSON.stringify(data, null, 2));
  }

  return { path: generatedPath, count: Object.keys(translations).length, dryRun: Boolean(options.dryRun) };
}

function scanMissingPluginDescriptions(options) {
  const generatedMemoryPath = options.generatedMemoryPath || generatedTranslationsPathFor(options.claudeDir);
  const translations = loadTranslationMemories([generatedMemoryPath, options.memoryPath]);
  const extraTranslations = options.extraTranslations || buildExtraTranslations(options.claudeDir, options.homeDir);
  const extraByPath = new Map(extraTranslations.map((item) => [item.path, item.desc]));
  const missingItems = [];

  for (const file of scanAllDescriptionFiles(options)) {
    if (file.isChinese || translations[file.key] || extraByPath.has(file.path) || shouldIgnoreMissing(file)) continue;
    missingItems.push(file);
  }

  const missingPath = options.writeMissing === false
    ? (options.missingPath || missingTranslationsPathFor(options.claudeDir))
    : writeMissingFile({ ...options, generatedMemoryPath }, missingItems);
  return { missing: missingItems.length, missingItems, missingPath, generatedPath: generatedMemoryPath, dryRun: Boolean(options.dryRun) };
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
  const generatedMemoryPath = options.generatedMemoryPath || generatedTranslationsPathFor(claudeDir);
  const memory = loadTranslationMemories([generatedMemoryPath, options.memoryPath]);
  const extraTranslations = options.extraTranslations || buildExtraTranslations(claudeDir, options.homeDir);
  const extraByPath = new Map(extraTranslations.map((item) => [item.path, item.desc]));
  const dryRun = Boolean(options.dryRun);
  const missingItems = [];
  const missingKeys = [];
  let patched = 0;
  let skipped = 0;
  let missing = 0;

  for (const file of scanAllDescriptionFiles(options)) {
    if (file.isChinese) {
      skipped += 1;
      continue;
    }

    const translation = memory[file.key] || extraByPath.get(file.path);
    if (!translation) {
      if (!shouldIgnoreMissing(file)) {
        missing += 1;
        missingKeys.push(file.key);
        missingItems.push(file);
      }
      continue;
    }

    const result = replaceDescription(file.path, translation, dryRun);
    if (result === true) patched += 1;
    if (result === 'skip') skipped += 1;
  }

  for (const item of extraTranslations) {
    if (!fs.existsSync(item.path)) continue;
    const result = replaceDescription(item.path, item.desc, dryRun);
    if (result === true) patched += 1;
    if (result === 'skip') skipped += 1;
  }

  writeMissingFile({ ...options, generatedMemoryPath }, missingItems);
  return { patched, skipped, missing, missingKeys, missingItems, dryRun };
}

module.exports = {
  buildExtraTranslations,
  escapeYamlValue,
  generatedTranslationsPathFor,
  loadTranslationMemory,
  localizePluginDescriptions,
  missingTranslationsPathFor,
  readField,
  replaceDescription,
  saveGeneratedTranslations,
  scanAllDescriptionFiles,
  scanPluginFiles,
  scanMissingPluginDescriptions,
};
