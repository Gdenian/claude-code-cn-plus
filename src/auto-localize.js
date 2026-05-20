'use strict';

const { detectClaudeInstallation } = require('./claude-installation');
const { defaultClaudeDir, defaultInstallDir, defaultMemoryPath, patchCli } = require('./installer');
const { localizePluginDescriptions } = require('./plugin-localizer');
const { readManifest, writeManifest } = require('./manifest');
const { currentVersionState, readPluginVersions, versionsChanged } = require('./version-state');

async function localizeAuto(options = {}) {
  const claudeDir = options.claudeDir || defaultClaudeDir();
  const installDir = options.installDir || defaultInstallDir();
  const installation = await detectClaudeInstallation(options);
  const current = currentVersionState(claudeDir, installation);
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
    generatedMemoryPath: options.generatedMemoryPath,
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
