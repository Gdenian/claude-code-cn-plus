#!/usr/bin/env node
// localize-plugins.js v3 - 基于 Translation Memory 的插件汉化
// 核心改变：翻译存储在独立的 translation-memory.json 中
// 插件更新覆盖文件后，自动从 memory 恢复翻译
// License: MIT

const fs = require('fs');
const path = require('path');
const os = require('os');

const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const MAGENTA = '\x1b[38;5;206m';
const NC = '\x1b[0m';

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const CACHE_DIR = path.join(CLAUDE_DIR, 'plugins', 'cache');
const SCRIPT_DIR = __dirname;
const MEMORY_PATH = path.join(SCRIPT_DIR, 'translation-memory.json');

// ========== 加载翻译记忆 ==========
function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    console.error(`  ${YELLOW}⚠${NC} translation-memory.json 不存在: ${MEMORY_PATH}`);
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    return data.translations || {};
  } catch (e) {
    console.error(`  ${YELLOW}⚠${NC} translation-memory.json 解析失败: ${e.message}`);
    return {};
  }
}

// ========== 从 frontmatter 读取字段 ==========
function readField(content, field) {
  // 匹配 field: "value" 或 field: 'value' 或 field: value
  const quoted = content.match(new RegExp(`^---[\\s\\S]*?^${field}:\\s*["'](.+?)["']\\s*$`, 'm'));
  if (quoted) return quoted[1];
  const unquoted = content.match(new RegExp(`^---[\\s\\S]*?^${field}:\\s*(.+?)\\s*$`, 'm'));
  return unquoted ? unquoted[1].trim() : null;
}

// ========== 安全转义 frontmatter 中的字符串值 ==========
function escapeYamlValue(str) {
  // 如果包含双引号、反斜杠、换行符或冒号+空格，用双引号包裹并转义内部双引号
  if (str.includes('"') || str.includes('\\') || str.includes('\n') || str.includes(': ')) {
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  return '"' + str + '"';
}

// ========== 替换 frontmatter 中的 description ==========
function replaceDescription(filePath, newDesc) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');

  // 已经是中文 → 跳过
  const currentDesc = readField(content, 'description');
  if (currentDesc && /[\u4e00-\u9fff]/.test(currentDesc)) return 'skip';

  // 安全转义后替换 description 行
  const escaped = escapeYamlValue(newDesc);
  const newContent = content.replace(
    /^(---[\s\S]*?^description:\s*).+$/m,
    `$1${escaped}`
  );

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
  return false;
}

// ========== 扫描所有插件描述文件 ==========
function scanPluginFiles() {
  const results = [];
  if (!fs.existsSync(CACHE_DIR)) return results;

  // 遍历 cache/marketplace/plugin/version/... 结构
  const marketplaces = fs.readdirSync(CACHE_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const marketplace of marketplaces) {
    const mkDir = path.join(CACHE_DIR, marketplace.name);
    const plugins = fs.readdirSync(mkDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const plugin of plugins) {
      scanRecursively(path.join(mkDir, plugin.name), marketplace.name, plugin.name, results);
    }
  }
  return results;
}

function scanRecursively(dir, marketplace, plugin, results) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanRecursively(fullPath, marketplace, plugin, results);
    } else if (entry.name === 'SKILL.md' || (entry.name.endsWith('.md') && fullPath.includes('/commands/'))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // SKILL.md 有 name 字段；command.md 可能没有，用文件名
        let name = readField(content, 'name');
        if (!name && fullPath.includes('/commands/')) {
          name = entry.name.replace('.md', '');
        }
        const desc = readField(content, 'description');
        if (name && desc) {
          results.push({
            path: fullPath,
            plugin,
            name,
            desc,
            isChinese: /[\u4e00-\u9fff]/.test(desc),
          });
        }
      } catch {}
    }
  }
}

// ========== 本地技能和 cc-switch 汉化 ==========
const extraTranslations = [
  // 本地技能
  {
    path: path.join(CLAUDE_DIR, 'skills', 'frontend-design', 'SKILL.md'),
    name: 'frontend-design',
    desc: '创建独特的、生产级前端界面，具有高设计质量。当用户要求构建网页组件、页面、制品、海报或应用程序时使用。生成创意、精致的代码和 UI 设计，避免千篇一律的 AI 美学。',
  },
  // cc-switch
  {
    path: path.join(os.homedir(), '.cc-switch', 'skills', 'agent-reach', 'SKILL.md'),
    name: 'agent-reach',
    desc: '为你的 AI Agent 赋予全互联网访问能力。安装并配置上游工具，支持 Twitter/X、Reddit、YouTube、GitHub、Bilibili、小红书、抖音、LinkedIn、Boss直聘、RSS 及任意网页 — 配置后可直接调用。',
  },
  {
    path: path.join(os.homedir(), '.cc-switch', 'skills', 'unified-workflow-main', 'SKILL.md'),
    name: 'unified-workflow-main',
    desc: '在开始任何开发工作时使用，用于在 GSD（项目管理）和 Superpowers（工程规范）系统之间进行路由。通过在任务开始时提供单一路由决策，防止重复规划、冲突的子代理模型和重叠的设计捕获。',
  },
];

// ========== 主流程 ==========
function main() {
  console.log(`${MAGENTA}==============================================${NC}`);
  console.log(`${MAGENTA}  Claude Code 插件汉化 (v3 - Translation Memory)${NC}`);
  console.log(`${MAGENTA}==============================================${NC}`);
  console.log('');

  const memory = loadMemory();
  const memorySize = Object.keys(memory).length;
  console.log(`  翻译记忆库: ${memorySize} 条翻译`);
  console.log('');

  let patched = 0;
  let skipped = 0;
  let missing = 0;

  // 1. 扫描并翻译插件缓存
  const files = scanPluginFiles();
  const englishFiles = files.filter(f => !f.isChinese);

  console.log(`  扫描: ${files.length} 个描述文件, ${englishFiles.length} 个英文待处理`);
  console.log('');

  for (const file of englishFiles) {
    const key = `${file.plugin}/${file.name}`;
    const translation = memory[key];

    if (!translation) {
      // 跳过 pua-en 等故意保持英文的变体
      if (file.name.endsWith('-en') || file.name.endsWith('-ja')) continue;
      console.log(`  ${YELLOW}?${NC} ${key}`);
      missing++;
      continue;
    }

    const result = replaceDescription(file.path, translation);
    if (result === true) {
      console.log(`  ${GREEN}+${NC} ${key}`);
      patched++;
    } else if (result === 'skip') {
      skipped++;
    }
  }

  // 2. 本地技能和 cc-switch
  for (const item of extraTranslations) {
    if (!fs.existsSync(item.path)) continue;
    const result = replaceDescription(item.path, item.desc);
    if (result === true) {
      console.log(`  ${GREEN}+${NC} ${item.name}`);
      patched++;
    } else if (result === 'skip') {
      skipped++;
    }
  }

  console.log('');
  console.log(`${MAGENTA}完成! ${patched} 处已翻译, ${skipped} 处已跳过${NC}`);
  if (missing > 0) {
    console.log(`${YELLOW}⚠ ${missing} 个描述无翻译（需补充到 translation-memory.json）${NC}`);
  }
  console.log(`${YELLOW}请重启 Claude Code 使更改生效${NC}`);

  return { patched, skipped, missing };
}

if (require.main === module) {
  main();
}

module.exports = { main, loadMemory, scanPluginFiles, replaceDescription, extraTranslations };
