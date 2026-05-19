'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

async function loadTweakccApi() {
  try {
    return await import('tweakcc');
  } catch {
    return null;
  }
}

function readPackageVersion(cliPath) {
  const packagePath = path.join(path.dirname(cliPath), 'package.json');
  if (!fs.existsSync(packagePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || null;
  } catch {
    return null;
  }
}

function detectLegacyFromNpmRoot(npmRoot) {
  if (!npmRoot) return null;
  const cliPath = path.join(npmRoot, '@anthropic-ai', 'claude-code', 'cli.js');
  if (!fs.existsSync(cliPath)) return null;
  return { kind: 'npm', path: cliPath, version: readPackageVersion(cliPath) };
}

async function detectClaudeInstallation(options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, 'installation')) return options.installation;

  const api = options.tweakccApi || await loadTweakccApi();
  if (api && typeof api.findAllInstallations === 'function') {
    const installations = await api.findAllInstallations();
    const native = installations.find((item) => item.kind === 'native');
    if (native) return native;
    const npm = installations.find((item) => item.kind === 'npm');
    if (npm) return npm;
  }

  if (options.npmRoot) return detectLegacyFromNpmRoot(options.npmRoot);

  try {
    const npmRoot = childProcess.execSync('npm root -g', { encoding: 'utf8' }).trim();
    return detectLegacyFromNpmRoot(npmRoot);
  } catch {
    return null;
  }
}

module.exports = {
  detectClaudeInstallation,
  detectLegacyFromNpmRoot,
  readPackageVersion,
};
