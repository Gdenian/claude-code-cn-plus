#!/usr/bin/env node
// auto-localize.js - 插件版本变化自动检测 + 自动汉化
// 由 PostToolUse hook 触发，每个会话只运行一次
// License: MIT

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const MANIFEST_PATH = path.join(CLAUDE_DIR, 'localize-manifest.json');
const SESSION_MARKER = path.join(os.tmpdir(), `claude-localize-${process.ppid}`);
const SCRIPT_DIR = __dirname;

// 每个会话只检查一次
if (fs.existsSync(SESSION_MARKER)) {
  process.exit(0);
}

// 标记本会话已检查
try { fs.writeFileSync(SESSION_MARKER, Date.now().toString()); } catch {}

// ========== 获取当前插件版本 ==========
function getCurrentVersions() {
  const installedPath = path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json');
  if (!fs.existsSync(installedPath)) return {};

  const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
  const versions = {};

  for (const [key, entries] of Object.entries(installed.plugins || {})) {
    if (Array.isArray(entries) && entries.length > 0) {
      versions[key] = entries[0].version || 'unknown';
    }
  }
  return versions;
}

// ========== 获取 CLI 版本 ==========
function getCliVersion() {
  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const pkgPath = path.join(npmRoot, '@anthropic-ai/claude-code', 'package.json');
    if (fs.existsSync(pkgPath)) {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    }
  } catch {}
  return null;
}

// ========== 读取已记录的版本清单 ==========
function getStoredManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch { return null; }
}

// ========== 保存版本清单 ==========
function saveManifest(plugins, cliVersion) {
  const manifest = {
    lastCheck: new Date().toISOString(),
    cliVersion,
    plugins,
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ========== 主流程 ==========
function main() {
  const currentVersions = getCurrentVersions();
  const cliVersion = getCliVersion();
  const stored = getStoredManifest();

  // 首次运行：记录版本并执行汉化
  if (!stored) {
    saveManifest(currentVersions, cliVersion);
    // 执行插件汉化
    try {
      const { main: localizeMain } = require(path.join(SCRIPT_DIR, 'localize-plugins.js'));
      localizeMain();
    } catch {}
    // 执行 CLI 汉化
    try {
      const localizePath = path.join(SCRIPT_DIR, 'localize.js');
      if (fs.existsSync(localizePath)) {
        execSync(`node "${localizePath}"`, { cwd: SCRIPT_DIR, stdio: 'pipe' });
      }
    } catch {}
    return;
  }

  // 检测版本变化
  let changed = false;

  // 检查 CLI 版本
  if (cliVersion && cliVersion !== stored.cliVersion) {
    changed = true;
  }

  // 检查插件版本
  for (const [key, version] of Object.entries(currentVersions)) {
    if (version !== (stored.plugins || {})[key]) {
      changed = true;
      break;
    }
  }

  // 检查新增插件
  for (const key of Object.keys(currentVersions)) {
    if (!(stored.plugins || {})[key]) {
      changed = true;
      break;
    }
  }

  if (changed) {
    // 更新清单
    saveManifest(currentVersions, cliVersion);

    // 重新汉化
    try {
      const { main: localizeMain } = require(path.join(SCRIPT_DIR, 'localize-plugins.js'));
      localizeMain();
    } catch {}

    // CLI 版本变化时也重新汉化
    if (cliVersion && cliVersion !== stored.cliVersion) {
      try {
        const localizePath = path.join(SCRIPT_DIR, 'localize.js');
        if (fs.existsSync(localizePath)) {
          execSync(`node "${localizePath}"`, { cwd: SCRIPT_DIR, stdio: 'pipe' });
        }
      } catch {}
    }
  }
}

main();
