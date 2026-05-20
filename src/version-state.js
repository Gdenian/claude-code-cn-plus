'use strict';

const fs = require('node:fs');
const path = require('node:path');

function readPluginVersions(claudeDir) {
  const installedPath = path.join(claudeDir, 'plugins', 'installed_plugins.json');
  if (!fs.existsSync(installedPath)) return {};
  let installed;
  try {
    installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
  } catch {
    return {};
  }
  const versions = {};
  if (!installed || typeof installed !== 'object' || Array.isArray(installed)) return versions;
  const plugins = installed.plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) return versions;
  for (const [key, entries] of Object.entries(plugins)) {
    if (Array.isArray(entries) && entries.length > 0) {
      const first = entries[0];
      const version = first && typeof first === 'object' && !Array.isArray(first) && typeof first.version === 'string' && first.version
        ? first.version
        : 'unknown';
      versions[key] = version;
    }
  }
  return versions;
}

function currentVersionState(claudeDir, installation) {
  return {
    cliVersion: installation?.version || null,
    plugins: readPluginVersions(claudeDir),
  };
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

module.exports = {
  currentVersionState,
  readPluginVersions,
  versionsChanged,
};
