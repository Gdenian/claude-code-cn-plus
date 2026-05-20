'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { detectClaudeInstallation } = require('./claude-installation');
const { readManifest, manifestPathFor } = require('./manifest');
const { scanMissingPluginDescriptions } = require('./plugin-localizer');
const { readSettings } = require('./settings');

function isNode20Plus(version = process.versions.node) {
  const major = Number(version.split('.')[0]);
  return major >= 20;
}

function hookStatus(settings) {
  const commands = (settings.hooks?.PostToolUse || []).flatMap((entry) => entry.hooks || []).map((hook) => hook.command || '');
  return {
    toolTips: commands.some((command) => command.includes('tool-tips.js') || command.includes('tool-tips-post.sh')),
    autoLocalize: commands.some((command) => command.includes('auto-localize.js') || command.includes('auto-localize.sh')),
  };
}

async function runDoctor(options = {}) {
  const claudeDir = options.claudeDir;
  const installation = await detectClaudeInstallation(options);
  const settings = readSettings(claudeDir);
  const hooks = hookStatus(settings);
  const backupDir = path.join(claudeDir, 'localize-backups');
  const pluginCache = path.join(claudeDir, 'plugins', 'cache');
  const manifest = readManifest(claudeDir);
  const missing = scanMissingPluginDescriptions({
    claudeDir,
    memoryPath: options.memoryPath,
    generatedMemoryPath: options.generatedMemoryPath,
    homeDir: options.homeDir,
    projectDir: options.projectDir,
    dryRun: options.dryRun,
  });
  const node = { ok: isNode20Plus(options.nodeVersion), version: options.nodeVersion || process.versions.node };
  const ok = Boolean(
    node.ok
    && installation
    && hooks.toolTips
    && hooks.autoLocalize
    && manifest
  );

  return {
    ok,
    node,
    installation: installation || null,
    hooks,
    pluginCache: { path: pluginCache, exists: fs.existsSync(pluginCache) },
    backups: { path: backupDir, exists: fs.existsSync(backupDir) },
    manifest: { path: manifestPathFor(claudeDir), exists: Boolean(manifest), data: manifest },
    missingTranslations: { missing: missing.missing, path: missing.missingPath, generatedPath: missing.generatedPath },
  };
}

module.exports = {
  hookStatus,
  isNode20Plus,
  runDoctor,
};
