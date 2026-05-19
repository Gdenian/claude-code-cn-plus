'use strict';

const fs = require('node:fs');
const path = require('node:path');

function manifestPathFor(claudeDir) {
  return path.join(claudeDir, 'localize-manifest.json');
}

function readManifest(claudeDir) {
  const manifestPath = manifestPathFor(claudeDir);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest(claudeDir, manifest, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(claudeDir, { recursive: true });
  fs.writeFileSync(manifestPathFor(claudeDir), JSON.stringify(manifest, null, 2));
}

function removeManifest(claudeDir, dryRun) {
  if (dryRun) return;
  fs.rmSync(manifestPathFor(claudeDir), { force: true });
}

module.exports = {
  manifestPathFor,
  readManifest,
  removeManifest,
  writeManifest,
};
