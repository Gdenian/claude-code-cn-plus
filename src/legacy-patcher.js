'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { applyTranslations } = require('./translation-engine');
const { sha256 } = require('./hash');

function backupPathFor(cliPath) {
  return path.join(path.dirname(cliPath), 'cli.bak.js');
}

function readLegacyVersion(cliPath) {
  const packagePath = path.join(path.dirname(cliPath), 'package.json');
  if (!fs.existsSync(packagePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version || null;
  } catch {
    return null;
  }
}

function patchLegacyCli(options) {
  const cliPath = options.cliPath;
  const backupPath = options.backupPath || backupPathFor(cliPath);
  const dryRun = Boolean(options.dryRun);
  const translations = {
    ...(options.translations || {}),
    ...(options.extraTranslations || {}),
  };

  if (!fs.existsSync(backupPath) && !dryRun) {
    fs.copyFileSync(cliPath, backupPath);
  }

  const baselinePath = fs.existsSync(backupPath) ? backupPath : cliPath;
  const baseline = fs.readFileSync(baselinePath, 'utf8');
  const report = applyTranslations(baseline, translations);

  if (!dryRun) {
    fs.writeFileSync(cliPath, report.content, 'utf8');
  }

  return {
    type: 'legacy',
    cliPath,
    backupPath,
    version: readLegacyVersion(cliPath),
    originalHash: sha256(baseline),
    patchedHash: sha256(report.content),
    dryRun,
    report,
  };
}

function restoreLegacyCli(options) {
  const cliPath = options.cliPath;
  const backupPath = options.backupPath || backupPathFor(cliPath);
  const dryRun = Boolean(options.dryRun);
  const removeBackup = Boolean(options.removeBackup);

  if (!fs.existsSync(backupPath)) {
    return { type: 'legacy', cliPath, backupPath, restored: false, dryRun };
  }

  if (!dryRun) {
    fs.copyFileSync(backupPath, cliPath);
    if (removeBackup) fs.rmSync(backupPath);
  }

  return { type: 'legacy', cliPath, backupPath, restored: true, dryRun };
}

module.exports = {
  backupPathFor,
  patchLegacyCli,
  restoreLegacyCli,
};
