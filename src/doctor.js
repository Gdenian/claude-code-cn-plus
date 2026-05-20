'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { detectClaudeInstallation } = require('./claude-installation');
const { readManifest, manifestPathFor } = require('./manifest');
const { readSettings } = require('./settings');

function isNode24Plus(version = process.versions.node) {
  const major = Number(version.split('.')[0]);
  return major >= 24;
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

  return {
    node: { ok: isNode24Plus(options.nodeVersion), version: options.nodeVersion || process.versions.node },
    installation: installation || null,
    hooks,
    pluginCache: { path: pluginCache, exists: fs.existsSync(pluginCache) },
    backups: { path: backupDir, exists: fs.existsSync(backupDir) },
    manifest: { path: manifestPathFor(claudeDir), exists: Boolean(manifest), data: manifest },
  };
}

module.exports = {
  hookStatus,
  isNode24Plus,
  runDoctor,
};
