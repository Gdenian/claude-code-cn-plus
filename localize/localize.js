#!/usr/bin/env node
// localize.js - Claude Code 汉化引擎
// 基于 cute-claude-hooks 项目 (https://github.com/gugug168/cute-claude-hooks)
// 采用全局替换策略：匹配引号包裹的字符串
// License: MIT

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAGENTA = '\x1b[38;5;206m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const RED = '\x1b[0;31m';
const NC = '\x1b[0m';

// ========== 获取 Claude Code CLI 路径 ==========
function getCliPath() {
  const pkgName = '@anthropic-ai/claude-code';
  let npmRoot;

  try {
    const log = execSync(`npm list -g ${pkgName} --depth=0`, { encoding: 'utf8' });
    if (!log.trim().includes(pkgName)) {
      console.log(`${RED}请先安装 Claude Code: npm install -g ${pkgName}${NC}`);
      process.exit(1);
    }
    npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  } catch (e) {
    console.log(`${RED}请先安装 Claude Code: npm install -g ${pkgName}${NC}`);
    process.exit(1);
  }

  const cliPath = path.join(npmRoot, pkgName, 'cli.js');
  const cliBak = path.join(npmRoot, pkgName, 'cli.bak.js');

  if (!fs.existsSync(cliPath)) {
    console.log(`${RED}找不到 Claude Code CLI 文件${NC}`);
    process.exit(1);
  }

  // 备份原始文件（仅首次）
  if (!fs.existsSync(cliBak)) {
    fs.copyFileSync(cliPath, cliBak);
    console.log(`${GREEN}已创建备份: cli.bak.js${NC}`);
  }

  return { cliPath, cliBak };
}

// ========== 转义正则特殊字符 ==========
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========== 执行汉化（全局替换策略） ==========
function localize(cliPath) {
  // 加载关键词字典
  const keywordFile = path.join(__dirname, 'keyword.js');
  const keyword = require(keywordFile);

  // 先从备份恢复，确保每次基于原始英文替换
  const { cliBak } = getCliPath();
  fs.copyFileSync(cliBak, cliPath);

  let content = fs.readFileSync(cliPath, 'utf8');
  const entries = Object.entries(keyword);
  let totalReplacements = 0;
  let processedCount = 0;

  for (const [key, value] of entries) {
    const escapedKey = escapeRegex(key).replace(/\\n/g, '\\\\n');
    const newValue = value.replace(/\n/g, '\\n');

    let replaced = false;
    let count = 0;

    if (escapedKey.startsWith('`') || escapedKey.startsWith('\\')) {
      const regex = new RegExp(escapedKey, 'g');
      const m = content.match(regex);
      if (m) {
        content = content.replace(regex, value);
        replaced = true;
        count = m.length;
      }
    } else {
      const doubleRegex = new RegExp(`"${escapedKey}"`, 'g');
      const dm = content.match(doubleRegex);
      if (dm) {
        content = content.replace(doubleRegex, `"${newValue}"`);
        replaced = true;
        count += dm.length;
      }

      const singleRegex = new RegExp(`'${escapedKey}'`, 'g');
      const sm = content.match(singleRegex);
      if (sm) {
        content = content.replace(singleRegex, `'${newValue}'`);
        replaced = true;
        count += sm.length;
      }
    }

    if (replaced) {
      processedCount++;
      totalReplacements += count;
      console.log(`  ${GREEN}+${NC} ${key.substring(0, 50)}${key.length > 50 ? '...' : ''} ${YELLOW}->${NC} ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
    }
  }

  fs.writeFileSync(cliPath, content, 'utf8');

  console.log('');
  console.log(`${MAGENTA}关键词汉化完成! ${processedCount}/${entries.length} 条匹配, ${totalReplacements} 处替换${NC}`);

  return totalReplacements;
}

// ========== 导出 ==========
if (require.main === module) {
  const { cliPath } = getCliPath();
  console.log(`${GREEN}CLI 路径: ${cliPath}${NC}`);
  localize(cliPath);
  console.log(`${YELLOW}请重启 Claude Code 使汉化生效${NC}`);
}

module.exports = { getCliPath, localize };
