'use strict';

const path = require('node:path');

const DEFAULT_VERSION = 'v0.1.0';
const DEFAULT_REPO_URL = 'https://github.com/Gdenian/claude-code-cn-plus';

function buildArchiveUrl(repoUrl, channel, version) {
  const base = repoUrl.replace(/\.git$/, '');
  if (channel === 'main') return `${base}/archive/refs/heads/main.tar.gz`;
  return `${base}/archive/refs/tags/${version}.tar.gz`;
}

function buildBootstrapPlan(options) {
  const env = options.env || process.env;
  const currentSource = Boolean(options.currentSource);
  const channel = env.CHANNEL || 'stable';
  const version = env.VERSION || DEFAULT_VERSION;
  const repoUrl = env.REPO_URL || DEFAULT_REPO_URL;
  const home = env.HOME || env.USERPROFILE || '';

  if (currentSource) {
    return {
      channel,
      version,
      repoUrl,
      installDir: options.cwd,
      sourceDir: options.cwd,
      archiveUrl: null,
      usesCurrentSource: true,
    };
  }

  const installDir = env.INSTALL_DIR || path.join(home, '.claude-code-cn-plus');
  return {
    channel,
    version,
    repoUrl,
    installDir,
    sourceDir: installDir,
    archiveUrl: buildArchiveUrl(repoUrl, channel, version),
    usesCurrentSource: false,
  };
}

module.exports = {
  DEFAULT_REPO_URL,
  DEFAULT_VERSION,
  buildArchiveUrl,
  buildBootstrapPlan,
};
