'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { detectClaudeInstallation } = require('./claude-installation');
const { installHooks, uninstallHooks } = require('./hooks-manager');
const { configureChineseLanguage } = require('./settings');
const { patchLegacyCli, restoreLegacyCli } = require('./legacy-patcher');
const { patchNativeCli, restoreNativeCli, manifestPathFor: nativeManifestPathFor } = require('./native-patcher');
const { localizePluginDescriptions } = require('./plugin-localizer');
const { installMissingLocalizeSkill, uninstallMissingLocalizeSkill } = require('./missing-localize-skill');
const { removeManifest, writeManifest } = require('./manifest');

function defaultClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function defaultInstallDir() {
  return path.resolve(__dirname, '..');
}

function defaultMemoryPath(installDir) {
  return path.join(installDir, 'localize', 'translation-memory.json');
}

function installPathFile(claudeDir) {
  return path.join(claudeDir, 'localize-install-path');
}

function recordInstallPath(claudeDir, installDir, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(installPathFile(claudeDir), installDir, 'utf8');
}

function removeInstallPath(claudeDir, dryRun) {
  if (dryRun) return;
  fs.rmSync(installPathFile(claudeDir), { force: true });
}

async function patchCli(options, installation) {
  const translations = options.translations || require('../localize/keyword');
  const extraTranslations = options.extraTranslations || require('../localize/extra-ui').translations;
  const backupDir = path.join(options.claudeDir, 'localize-backups');

  if (!installation) {
    throw new Error('未找到 Claude Code 安装');
  }

  if (installation.kind === 'native') {
    return patchNativeCli({
      installation,
      backupDir,
      api: options.tweakccApi,
      translations,
      extraTranslations,
      dryRun: options.dryRun,
      patcherVersion: 'tweakcc@4.0.13',
    });
  }

  return patchLegacyCli({
    cliPath: installation.path,
    translations,
    extraTranslations,
    dryRun: options.dryRun,
  });
}

async function install(options = {}) {
  const claudeDir = options.claudeDir || defaultClaudeDir();
  const installDir = options.installDir || defaultInstallDir();
  const dryRun = Boolean(options.dryRun);
  const installation = await detectClaudeInstallation(options);
  let cliResult = null;
  let cliError = null;

  if (installation || !dryRun) {
    try {
      cliResult = await patchCli({ ...options, claudeDir, installDir, dryRun }, installation);
    } catch (error) {
      cliError = error;
    }
  } else {
    cliResult = {
      type: 'none',
      dryRun: true,
      report: { matchedEntries: 0, replacements: 0, missingEntries: [], alreadyLocalized: false },
    };
  }

  recordInstallPath(claudeDir, installDir, dryRun);
  const pluginResult = localizePluginDescriptions({
    claudeDir,
    memoryPath: options.memoryPath || defaultMemoryPath(installDir),
    generatedMemoryPath: options.generatedMemoryPath,
    dryRun,
  });
  installHooks({ claudeDir, installDir, dryRun });
  installMissingLocalizeSkill({ claudeDir, installDir, dryRun });
  configureChineseLanguage({ claudeDir, dryRun });
  writeManifest(claudeDir, {
    lastCheck: new Date().toISOString(),
    installation,
    cli: cliResult,
    plugin: pluginResult,
  }, dryRun);

  return {
    ok: !cliError,
    exitCode: cliError ? 1 : 0,
    installation,
    cli: cliResult,
    plugin: pluginResult,
    error: cliError,
    dryRun,
  };
}

async function restoreCli(options = {}) {
  const claudeDir = options.claudeDir || defaultClaudeDir();
  const installation = await detectClaudeInstallation(options);
  if (!installation) return { restored: false, reason: '未找到 Claude Code 安装' };
  if (installation.kind === 'native') {
    return restoreNativeCli({ backupDir: path.join(claudeDir, 'localize-backups'), api: options.tweakccApi, dryRun: options.dryRun });
  }
  return restoreLegacyCli({ cliPath: installation.path, removeBackup: Boolean(options.removeBackup), dryRun: options.dryRun });
}

async function uninstall(options = {}) {
  const claudeDir = options.claudeDir || defaultClaudeDir();
  const dryRun = Boolean(options.dryRun);
  const restored = await restoreCli({ ...options, claudeDir, dryRun, removeBackup: true });

  uninstallHooks({ claudeDir, dryRun });
  uninstallMissingLocalizeSkill({ claudeDir, dryRun });
  removeManifest(claudeDir, dryRun);
  removeInstallPath(claudeDir, dryRun);
  if (!dryRun) {
    fs.rmSync(nativeManifestPathFor(path.join(claudeDir, 'localize-backups')), { force: true });
  }

  return { ok: true, restored, dryRun };
}

module.exports = {
  defaultClaudeDir,
  defaultInstallDir,
  defaultMemoryPath,
  install,
  installPathFile,
  patchCli,
  recordInstallPath,
  removeInstallPath,
  restoreCli,
  uninstall,
};
