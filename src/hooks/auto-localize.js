#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function markerPath() {
  return path.join(os.tmpdir(), `claude-localize-${process.ppid || process.pid}`);
}

function readInstallDir() {
  const filePath = path.join(claudeDir(), 'localize-install-path');
  if (!fs.existsSync(filePath)) return path.resolve(__dirname, '..', '..');
  return fs.readFileSync(filePath, 'utf8').trim();
}

if (require.main === module) {
  const marker = markerPath();
  if (fs.existsSync(marker)) process.exit(0);
  try { fs.writeFileSync(marker, Date.now().toString()); } catch {}

  const installDir = readInstallDir();
  const cliPath = path.join(installDir, 'bin', 'cccn.js');
  if (fs.existsSync(cliPath)) {
    const child = childProcess.spawn(process.execPath, [cliPath, 'localize', '--auto', '--claude-dir', claudeDir(), '--install-dir', installDir], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }
}

module.exports = {
  claudeDir,
  markerPath,
  readInstallDir,
};
