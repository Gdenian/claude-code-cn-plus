'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { applyTranslations } = require('./translation-engine');
const { hashFile, sha256 } = require('./hash');

function defaultBackupDir() {
  return path.join(os.homedir(), '.claude', 'localize-backups');
}

function backupPathForNative(backupDir, binaryPath) {
  const suffix = sha256(binaryPath).slice(0, 12);
  const baseName = path.basename(binaryPath || 'claude') || 'claude';
  return path.join(backupDir, `${baseName}-${suffix}.bak`);
}

function manifestPathFor(backupDir) {
  return path.join(backupDir, 'native-patch-manifest.json');
}

function hasTweakccApi(api) {
  return api
    && typeof api.readContent === 'function'
    && typeof api.writeContent === 'function'
    && typeof api.backupFile === 'function'
    && typeof api.restoreBackup === 'function';
}

async function loadTweakccApi() {
  try {
    return await import('tweakcc');
  } catch {
    return null;
  }
}

function buildAdhocPatchArgs(options) {
  return [
    'adhoc-patch',
    '--script',
    `@${options.scriptPath}`,
    '--path',
    options.binaryPath,
    '--confirm-possible-dangerous-patch',
  ];
}

function createAdhocPatchScript(translations) {
  return `
const translations = ${JSON.stringify(translations, null, 2)};
for (const [source, target] of Object.entries(translations)) {
  js = js.split(JSON.stringify(source)).join(JSON.stringify(target));
  js = js.split("'" + source.replace(/\\\\/g, "\\\\\\\\").replace(/'/g, "\\\\'") + "'").join("'" + target.replace(/\\\\/g, "\\\\\\\\").replace(/'/g, "\\\\'") + "'");
}
return js;
`;
}

function writeManifest(manifestPath, manifest) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function backupExists(backupPath) {
  return fs.existsSync(backupPath);
}

async function patchWithApi(options, api, installation, backupDir, translations) {
  const backupPath = backupPathForNative(backupDir, installation.path);
  const manifestPath = manifestPathFor(backupDir);
  const content = await api.readContent(installation);
  const report = applyTranslations(content, translations);
  const result = {
    type: 'native',
    path: installation.path,
    backupPath,
    manifestPath,
    version: installation.version || options.version || null,
    patcherVersion: options.patcherVersion || 'tweakcc@4.0.13',
    originalHash: sha256(content),
    patchedHash: sha256(report.content),
    dryRun: Boolean(options.dryRun),
    report,
  };

  if (options.dryRun) return result;

  fs.mkdirSync(backupDir, { recursive: true });
  if (!backupExists(backupPath)) {
    await api.backupFile(installation.path, backupPath);
  }
  try {
    await api.writeContent(installation, report.content);
  } catch (error) {
    await api.restoreBackup(backupPath, installation.path);
    error.restored = true;
    error.backupPath = backupPath;
    throw error;
  }

  writeManifest(manifestPath, {
    type: 'native',
    path: installation.path,
    backupPath,
    version: result.version,
    patcherVersion: result.patcherVersion,
    originalHash: result.originalHash,
    patchedHash: result.patchedHash,
    updatedAt: new Date().toISOString(),
  });

  return result;
}

function patchWithCli(options, installation, backupDir, translations) {
  const backupPath = backupPathForNative(backupDir, installation.path);
  const manifestPath = manifestPathFor(backupDir);
  const originalHash = fs.existsSync(installation.path) ? hashFile(installation.path) : null;
  const scriptPath = path.join(os.tmpdir(), `cccn-native-${process.pid}.js`);
  const command = options.tweakccCommand || 'tweakcc';
  const args = buildAdhocPatchArgs({ binaryPath: installation.path, scriptPath });

  if (options.dryRun) {
    return {
      type: 'native',
      path: installation.path,
      backupPath,
      manifestPath,
      version: installation.version || options.version || null,
      patcherVersion: options.patcherVersion || 'tweakcc@4.0.13',
      originalHash,
      patchedHash: null,
      dryRun: true,
      fallback: 'cli',
      args,
      report: { matchedEntries: 0, replacements: 0, missingEntries: [], alreadyLocalized: false },
    };
  }

  fs.mkdirSync(backupDir, { recursive: true });
  if (!backupExists(backupPath)) {
    fs.copyFileSync(installation.path, backupPath);
  }
  fs.writeFileSync(scriptPath, createAdhocPatchScript(translations), 'utf8');

  const run = childProcess.spawnSync(command, args, { encoding: 'utf8' });
  fs.rmSync(scriptPath, { force: true });
  if (run.status !== 0) {
    fs.copyFileSync(backupPath, installation.path);
    const message = run.stderr || run.stdout || `tweakcc exited with ${run.status}`;
    throw new Error(message.trim());
  }

  const patchedHash = fs.existsSync(installation.path) ? hashFile(installation.path) : null;
  writeManifest(manifestPath, {
    type: 'native',
    path: installation.path,
    backupPath,
    version: installation.version || options.version || null,
    patcherVersion: options.patcherVersion || 'tweakcc@4.0.13',
    originalHash,
    patchedHash,
    updatedAt: new Date().toISOString(),
    fallback: 'cli',
  });

  return {
    type: 'native',
    path: installation.path,
    backupPath,
    manifestPath,
    version: installation.version || options.version || null,
    patcherVersion: options.patcherVersion || 'tweakcc@4.0.13',
    originalHash,
    patchedHash,
    dryRun: false,
    fallback: 'cli',
    report: { matchedEntries: 0, replacements: 0, missingEntries: [], alreadyLocalized: false },
  };
}

async function patchNativeCli(options) {
  const installation = options.installation || {
    path: options.binaryPath,
    kind: 'native',
    version: options.version || null,
  };
  const backupDir = options.backupDir || defaultBackupDir();
  const translations = {
    ...(options.translations || {}),
    ...(options.extraTranslations || {}),
  };
  const api = options.api || await loadTweakccApi();

  if (hasTweakccApi(api)) {
    return patchWithApi(options, api, installation, backupDir, translations);
  }

  return patchWithCli(options, installation, backupDir, translations);
}

async function restoreNativeCli(options) {
  const backupDir = options.backupDir || defaultBackupDir();
  const manifestPath = manifestPathFor(backupDir);
  if (!fs.existsSync(manifestPath)) {
    return { type: 'native', restored: false, manifestPath };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const api = options.api || await loadTweakccApi();
  if (!options.dryRun) {
    if (hasTweakccApi(api)) {
      await api.restoreBackup(manifest.backupPath, manifest.path);
    } else {
      fs.copyFileSync(manifest.backupPath, manifest.path);
    }
  }

  return { type: 'native', restored: true, manifestPath, backupPath: manifest.backupPath, path: manifest.path };
}

module.exports = {
  backupPathForNative,
  buildAdhocPatchArgs,
  createAdhocPatchScript,
  defaultBackupDir,
  hasTweakccApi,
  loadTweakccApi,
  manifestPathFor,
  patchNativeCli,
  restoreNativeCli,
};
