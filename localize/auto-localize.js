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
// 使用日期 + PPID 作为标记，避免 process.ppid 在某些环境下不稳定
const SESSION_MARKER = path.join(os.tmpdir(), `claude-localize-${process.ppid || Date.now()}`);
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
  const npmRoot = safeExec('npm root -g');
  if (!npmRoot) return null;
  const pkgPath = path.join(npmRoot.trim(), '@anthropic-ai/claude-code', 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
    } catch {}
  }
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

// ========== 安全执行命令（处理路径中的空格和中文） ==========
function safeExec(cmd, opts) {
  try {
    return execSync(cmd, { ...opts, encoding: 'utf8' });
  } catch (e) {
    // 路径编码异常时不静默吞掉错误，记录到临时日志
    const logPath = path.join(os.tmpdir(), 'claude-localize-error.log');
    try {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${e.message}\n`);
    } catch {}
    return null;
  }
}

// ========== 执行汉化并返回是否成功 ==========
function runLocalization(cliChanged) {
  let success = true;

  // 插件汉化
  try {
    const { main: localizeMain } = require(path.join(SCRIPT_DIR, 'localize-plugins.js'));
    const result = localizeMain();
    // 如果有缺失翻译不算失败，只有异常才算
    if (result === undefined) success = false;
  } catch (e) {
    success = false;
    logError(`plugin-localize-failed: ${e.message}`);
  }

  // CLI 汉化（仅在 CLI 版本变化时）
  if (cliChanged) {
    try {
      const localizePath = path.join(SCRIPT_DIR, 'localize.js');
      if (fs.existsSync(localizePath)) {
        const result = safeExec(`node "${localizePath}"`, { cwd: SCRIPT_DIR, stdio: 'pipe' });
        if (result === null) success = false;
      }
    } catch (e) {
      success = false;
      logError(`cli-localize-failed: ${e.message}`);
    }
  }

  return success;
}

function logError(msg) {
  const logPath = path.join(os.tmpdir(), 'claude-localize-error.log');
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

// ========== 主流程 ==========
function main() {
  const currentVersions = getCurrentVersions();
  const cliVersion = getCliVersion();
  const stored = getStoredManifest();

  // 首次运行
  if (!stored) {
    // 先汉化，成功后才保存 manifest
    const ok = runLocalization(true);
    if (ok) {
      saveManifest(currentVersions, cliVersion);
    } else {
      logError('first-run-localization-failed, will retry next session');
    }
    return;
  }

  // 检测版本变化
  let changed = false;
  let cliChanged = false;

  if (cliVersion && cliVersion !== stored.cliVersion) {
    changed = true;
    cliChanged = true;
  }

  for (const [key, version] of Object.entries(currentVersions)) {
    if (version !== (stored.plugins || {})[key]) {
      changed = true;
      break;
    }
  }

  for (const key of Object.keys(currentVersions)) {
    if (!(stored.plugins || {})[key]) {
      changed = true;
      break;
    }
  }

  if (changed) {
    // 先汉化，成功后才更新 manifest
    const ok = runLocalization(cliChanged);
    if (ok) {
      saveManifest(currentVersions, cliVersion);
    } else {
      logError('version-change-localization-failed, will retry next session');
    }
  }
}

main();
