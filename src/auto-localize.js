'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { detectClaudeInstallation } = require('./claude-installation');
const { defaultClaudeDir, defaultInstallDir, defaultMemoryPath, patchCli } = require('./installer');
const { localizePluginDescriptions } = require('./plugin-localizer');
const { readManifest, writeManifest } = require('./manifest');

function readPluginVersions(claudeDir) {
  const installedPath = path.join(claudeDir, 'plugins', 'installed_plugins.json');
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

function versionsChanged(current, stored) {
  if (!stored) return true;
  if (current.cliVersion !== stored.cliVersion) return true;
  const oldPlugins = stored.plugins || {};
  const newPlugins = current.plugins || {};
  const keys = new Set([...Object.keys(oldPlugins), ...Object.keys(newPlugins)]);
  for (const key of keys) {
    if (oldPlugins[key] !== newPlugins[key]) return true;
  }
  return false;
}

async function localizeAuto(options = {}) {
  const claudeDir = options.claudeDir || defaultClaudeDir();
  const installDir = options.installDir || defaultInstallDir();
  const installation = await detectClaudeInstallation(options);
  const current = {
    cliVersion: installation?.version || null,
    plugins: readPluginVersions(claudeDir),
  };
  const stored = readManifest(claudeDir);

  if (!versionsChanged(current, stored)) {
    return { changed: false, current };
  }

  let cli = null;
  if (!stored || current.cliVersion !== stored.cliVersion) {
    cli = await patchCli({ ...options, claudeDir, installDir }, installation);
  }
  const plugin = localizePluginDescriptions({
    claudeDir,
    memoryPath: options.memoryPath || defaultMemoryPath(installDir),
    dryRun: options.dryRun,
  });

  writeManifest(claudeDir, {
    lastCheck: new Date().toISOString(),
    cliVersion: current.cliVersion,
    plugins: current.plugins,
    cli,
    plugin,
  }, options.dryRun);

  return { changed: true, current, cli, plugin };
}

module.exports = {
  localizeAuto,
  readPluginVersions,
  versionsChanged,
};
