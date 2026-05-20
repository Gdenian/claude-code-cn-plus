# Claude Code CN Plus Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复一键安装、可恢复性、自动维护、参数校验和 doctor 诊断这 5 个会直接影响用户信任的可靠性问题。

**Architecture:** 先让发布入口不依赖不存在的 tag，再保证 native patch 的原始备份永不被二次 patch 覆盖。随后统一 install 与 auto-localize 的版本状态 schema，让自动维护只在真实版本变化时工作，最后收紧 CLI 输入和健康检查退出码。

**Tech Stack:** Node.js CommonJS、`node:test`、Bash installer、GitHub Actions CI、`tweakcc@4.0.13`。

---

## Success Criteria

- README 默认安装命令不再下载不存在的 `v0.1.0` tag。
- native Claude Code 连续 patch 两次后，`restore` 仍能恢复到第一次 patch 前的原始内容。
- `install` 写出的 manifest 能被 `localize --auto` 直接识别；刚安装完、版本没变时不触发二次 CLI patch。
- `--claude-dir`、`--install-dir`、`--project-dir` 缺值时立即失败，不回落到真实用户目录。
- `doctor` 在 Claude Code 未找到或关键安装项缺失时返回非 0。
- `npm test`、`npm run check`、`npm run dry-run:install`、`npm run dry-run:uninstall` 全部通过。

## File Map

- Modify: `install.sh` - 默认下载分支策略，避免依赖不存在的 stable tag。
- Modify: `src/bootstrap-plan.js` - 让 JS bootstrap 计划与 shell installer 保持一致。
- Modify: `test/bootstrap.test.js` - 锁定默认 main 分支行为，并保留 explicit stable tag 行为。
- Modify: `README.md` - 文档改成当前真实发布状态，不承诺不存在的 stable tag。
- Modify: `src/native-patcher.js` - native backup 只在不存在时创建，防止覆盖原始备份。
- Modify: `test/native-patcher.test.js` - 增加重复 patch 后 restore 仍恢复原始内容的回归测试。
- Create: `src/version-state.js` - 集中维护 CLI/plugin 版本快照与 drift 判断。
- Modify: `src/auto-localize.js` - 使用统一版本状态，不再自己读 plugin 版本。
- Modify: `src/installer.js` - install manifest 写入 `cliVersion` 和 `plugins`。
- Modify: `test/auto-localize.test.js` - 覆盖 install manifest 与 auto-localize 的兼容性。
- Modify: `src/cli.js` - 校验路径参数缺值。
- Modify: `test/cli.test.js` - 覆盖参数缺值错误。
- Modify: `src/doctor.js` - 增加整体 `ok` 结论。
- Modify: `test/doctor.test.js` - 覆盖 doctor 成功和失败退出条件。
- Optional Modify: `docs/lessons-learned.md` - 记录这次可靠性原则，防止后续回归。

---

### Task 1: Fix Default Installation Target

**Files:**
- Modify: `install.sh:10-13`
- Modify: `src/bootstrap-plan.js:5-18`
- Modify: `test/bootstrap.test.js`
- Modify: `README.md`

- [ ] **Step 1: Write failing bootstrap tests**

Update `test/bootstrap.test.js` so the default branch is `main`, while explicit stable still downloads a tag:

```js
test('buildBootstrapPlan defaults to main branch and default install dir', () => {
  const plan = buildBootstrapPlan({
    env: { HOME: '/home/me' },
    cwd: '/tmp/curl',
    currentSource: false,
  });

  assert.equal(plan.channel, 'main');
  assert.equal(plan.version, 'v0.1.0');
  assert.equal(plan.installDir, '/home/me/.claude-code-cn-plus');
  assert.match(plan.archiveUrl, /\/refs\/heads\/main\.tar\.gz$/);
  assert.equal(plan.usesCurrentSource, false);
});

test('buildBootstrapPlan supports explicit CHANNEL=stable and VERSION override', () => {
  const stable = buildBootstrapPlan({
    env: { HOME: '/home/me', CHANNEL: 'stable', VERSION: 'v9.9.9' },
    cwd: '/tmp/curl',
    currentSource: false,
  });

  assert.equal(stable.channel, 'stable');
  assert.equal(stable.version, 'v9.9.9');
  assert.match(stable.archiveUrl, /\/refs\/tags\/v9\.9\.9\.tar\.gz$/);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test test/bootstrap.test.js
```

Expected: FAIL because current default channel is `stable`.

- [ ] **Step 3: Change default channel to main**

In `install.sh`, replace:

```bash
CHANNEL="${CHANNEL:-stable}"
```

with:

```bash
CHANNEL="${CHANNEL:-main}"
```

In `src/bootstrap-plan.js`, replace:

```js
const channel = env.CHANNEL || 'stable';
```

with:

```js
const channel = env.CHANNEL || 'main';
```

- [ ] **Step 4: Update README wording**

In `README.md`, keep the existing copy command, but add a short developer note under optional install parameters:

```markdown
默认安装脚本会下载 `main` 分支，避免在正式 tag 发布前出现 stable 包不存在的问题。
如果你已经发布了 tag，可以显式指定：

```bash
CHANNEL=stable VERSION=v0.1.0 bash install.sh
```
```

Also remove or avoid wording that implies `stable v0.1.0` already exists.

- [ ] **Step 5: Verify**

Run:

```bash
node --test test/bootstrap.test.js
DRY_RUN=1 bash install.sh
```

Expected: tests PASS; dry-run prints current source install when run from this repo.

- [ ] **Step 6: Commit**

```bash
git add install.sh src/bootstrap-plan.js test/bootstrap.test.js README.md
git commit -m "fix: default installer to available main archive"
```

---

### Task 2: Preserve Native Original Backup

**Files:**
- Modify: `src/native-patcher.js:70-160`
- Modify: `test/native-patcher.test.js`

- [ ] **Step 1: Write failing regression test**

Append to `test/native-patcher.test.js`:

```js
test('patchNativeCli does not overwrite original native backup on repeated patches', async () => {
  const fixture = makeFixture();
  fs.writeFileSync(fixture.binaryPath, 'const label = "Hello world";');

  const api = {
    readContent: async (installation) => fs.readFileSync(installation.path, 'utf8'),
    writeContent: async (installation, content) => fs.writeFileSync(installation.path, content),
    backupFile: async (source, backup) => fs.copyFileSync(source, backup),
    restoreBackup: async (backup, target) => fs.copyFileSync(backup, target),
  };

  const installation = { path: fixture.binaryPath, kind: 'native', version: '2.0.0' };
  const first = await patchNativeCli({
    installation,
    backupDir: fixture.backupDir,
    api,
    translations: { 'Hello world': '你好世界' },
  });

  assert.equal(fs.readFileSync(first.backupPath, 'utf8'), 'const label = "Hello world";');

  await patchNativeCli({
    installation,
    backupDir: fixture.backupDir,
    api,
    translations: { 'Hello world': '你好世界' },
  });

  assert.equal(fs.readFileSync(first.backupPath, 'utf8'), 'const label = "Hello world";');

  const { restoreNativeCli } = require('../src/native-patcher');
  await restoreNativeCli({ backupDir: fixture.backupDir, api });
  assert.equal(fs.readFileSync(fixture.binaryPath, 'utf8'), 'const label = "Hello world";');
});
```

Also add `restoreNativeCli` to the destructuring import at the top:

```js
const {
  buildAdhocPatchArgs,
  patchNativeCli,
  restoreNativeCli,
} = require('../src/native-patcher');
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test test/native-patcher.test.js
```

Expected: FAIL because the second patch overwrites `backupPath`.

- [ ] **Step 3: Add helper that creates backup only once**

In `src/native-patcher.js`, add this helper near `writeManifest`:

```js
function backupExists(backupPath) {
  return fs.existsSync(backupPath);
}
```

- [ ] **Step 4: Change API backup path**

In `patchWithApi`, replace:

```js
fs.mkdirSync(backupDir, { recursive: true });
await api.backupFile(installation.path, backupPath);
try {
```

with:

```js
fs.mkdirSync(backupDir, { recursive: true });
if (!backupExists(backupPath)) {
  await api.backupFile(installation.path, backupPath);
}
try {
```

- [ ] **Step 5: Change CLI fallback backup path**

In `patchWithCli`, replace:

```js
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(installation.path, backupPath);
fs.writeFileSync(scriptPath, createAdhocPatchScript(translations), 'utf8');
```

with:

```js
fs.mkdirSync(backupDir, { recursive: true });
if (!backupExists(backupPath)) {
  fs.copyFileSync(installation.path, backupPath);
}
fs.writeFileSync(scriptPath, createAdhocPatchScript(translations), 'utf8');
```

- [ ] **Step 6: Verify**

Run:

```bash
node --test test/native-patcher.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/native-patcher.js test/native-patcher.test.js
git commit -m "fix: preserve native original backup"
```

---

### Task 3: Unify Manifest Version State

**Files:**
- Create: `src/version-state.js`
- Modify: `src/auto-localize.js:1-70`
- Modify: `src/installer.js:1-120`
- Modify: `test/auto-localize.test.js`
- Modify: `test/installer.test.js`

- [ ] **Step 1: Write version-state module**

Create `src/version-state.js`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
```

- [ ] **Step 2: Update auto-localize imports**

In `src/auto-localize.js`, remove `fs` and `path` imports and the local `readPluginVersions` / `versionsChanged` functions. Import shared helpers:

```js
const { currentVersionState, readPluginVersions, versionsChanged } = require('./version-state');
```

Then replace the `current` object construction with:

```js
const current = currentVersionState(claudeDir, installation);
```

Keep exporting `readPluginVersions` and `versionsChanged` from `auto-localize.js` to avoid breaking existing tests:

```js
module.exports = {
  localizeAuto,
  readPluginVersions,
  versionsChanged,
};
```

- [ ] **Step 3: Make installer write the same schema**

In `src/installer.js`, add:

```js
const { currentVersionState } = require('./version-state');
```

Before `writeManifest`, add:

```js
const versionState = currentVersionState(claudeDir, installation);
```

Replace the manifest object:

```js
writeManifest(claudeDir, {
  lastCheck: new Date().toISOString(),
  installation,
  cli: cliResult,
  plugin: pluginResult,
}, dryRun);
```

with:

```js
writeManifest(claudeDir, {
  lastCheck: new Date().toISOString(),
  cliVersion: versionState.cliVersion,
  plugins: versionState.plugins,
  installation,
  cli: cliResult,
  plugin: pluginResult,
}, dryRun);
```

- [ ] **Step 4: Add regression test for install-to-auto compatibility**

Append to `test/auto-localize.test.js`:

```js
test('localizeAuto skips immediately after install manifest schema is written', async () => {
  const claudeDir = makeClaudeDir();
  fs.writeFileSync(
    path.join(claudeDir, 'localize-manifest.json'),
    JSON.stringify({
      cliVersion: '2.0.0',
      plugins: {},
      installation: { kind: 'native', path: '/tmp/claude', version: '2.0.0' },
      cli: { type: 'native' },
      plugin: { patched: 0, missing: 0 },
    })
  );

  const result = await localizeAuto({
    claudeDir,
    installDir: claudeDir,
    installation: { kind: 'native', path: '/tmp/claude', version: '2.0.0' },
    dryRun: true,
    memoryPath: path.join(claudeDir, 'translation-memory.json'),
  });

  assert.equal(result.changed, false);
});
```

In `test/installer.test.js`, after install writes manifest, assert the schema:

```js
const manifest = JSON.parse(fs.readFileSync(path.join(env.claudeDir, 'localize-manifest.json'), 'utf8'));
assert.equal(manifest.cliVersion, '1.0.0');
assert.deepEqual(manifest.plugins, {});
```

- [ ] **Step 5: Verify**

Run:

```bash
node --test test/auto-localize.test.js test/installer.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/version-state.js src/auto-localize.js src/installer.js test/auto-localize.test.js test/installer.test.js
git commit -m "fix: align install manifest with auto localize"
```

---

### Task 4: Validate CLI Option Values

**Files:**
- Modify: `src/cli.js:8-31`
- Modify: `test/cli.test.js`

- [ ] **Step 1: Write failing parser tests**

Append to `test/cli.test.js`:

```js
test('parseArgs rejects missing path option values', () => {
  assert.throws(() => parseArgs(['doctor', '--claude-dir']), /--claude-dir 需要路径参数/);
  assert.throws(() => parseArgs(['install', '--install-dir']), /--install-dir 需要路径参数/);
  assert.throws(() => parseArgs(['scan-missing', '--project-dir']), /--project-dir 需要路径参数/);
});

test('parseArgs rejects another flag as a path value', () => {
  assert.throws(() => parseArgs(['doctor', '--claude-dir', '--json']), /--claude-dir 需要路径参数/);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test test/cli.test.js
```

Expected: FAIL because current parser accepts missing values.

- [ ] **Step 3: Add value reader**

In `src/cli.js`, add above `parseArgs`:

```js
function readPathOption(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} 需要路径参数`);
  }
  return value;
}
```

Then replace the three path option branches with:

```js
} else if (arg === '--claude-dir') {
  options.claudeDir = readPathOption(argv, index, arg);
  index += 1;
} else if (arg === '--install-dir') {
  options.installDir = readPathOption(argv, index, arg);
  index += 1;
} else if (arg === '--project-dir') {
  options.projectDir = readPathOption(argv, index, arg);
  index += 1;
}
```

Export the helper only if a test needs it; the tests above only use `parseArgs`, so no export is needed.

- [ ] **Step 4: Verify**

Run:

```bash
node --test test/cli.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli.js test/cli.test.js
git commit -m "fix: reject missing cli option values"
```

---

### Task 5: Make Doctor Exit Status Trustworthy

**Files:**
- Modify: `src/doctor.js:24-49`
- Modify: `src/cli.js:116-119`
- Modify: `test/doctor.test.js`

- [ ] **Step 1: Write failing doctor tests**

Append to `test/doctor.test.js`:

```js
test('runDoctor marks empty installation as unhealthy', async () => {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-doctor-empty-'));

  const report = await runDoctor({
    claudeDir,
    installation: null,
    nodeVersion: '20.0.0',
  });

  assert.equal(report.ok, false);
});

test('runDoctor marks complete installation as healthy', async () => {
  const claudeDir = makeClaudeDir();

  const report = await runDoctor({
    claudeDir,
    installation: { kind: 'npm', path: '/tmp/cli.js', version: '1.0.0' },
    nodeVersion: '20.0.0',
  });

  assert.equal(report.ok, true);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test test/doctor.test.js
```

Expected: FAIL because `report.ok` does not exist.

- [ ] **Step 3: Compute doctor health**

In `src/doctor.js`, before `return`, add:

```js
const node = { ok: isNode20Plus(options.nodeVersion), version: options.nodeVersion || process.versions.node };
const ok = Boolean(
  node.ok
  && installation
  && hooks.toolTips
  && hooks.autoLocalize
  && manifest
);
```

Then return `ok` and reuse `node`:

```js
return {
  ok,
  node,
  installation: installation || null,
  hooks,
  pluginCache: { path: pluginCache, exists: fs.existsSync(pluginCache) },
  backups: { path: backupDir, exists: fs.existsSync(backupDir) },
  manifest: { path: manifestPathFor(claudeDir), exists: Boolean(manifest), data: manifest },
  missingTranslations: { missing: missing.missing, path: missing.missingPath, generatedPath: missing.generatedPath },
};
```

Do not make missing translations a failure; they already have a remediation flow.

- [ ] **Step 4: Return doctor health from CLI**

In `src/cli.js`, replace:

```js
return report.node.ok ? 0 : 1;
```

with:

```js
return report.ok ? 0 : 1;
```

- [ ] **Step 5: Verify**

Run:

```bash
node --test test/doctor.test.js
tmp=$(mktemp -d); node bin/cccn.js doctor --claude-dir "$tmp"; test "$?" -ne 0
```

Expected: tests PASS; empty temp doctor command returns non-zero.

- [ ] **Step 6: Commit**

```bash
git add src/doctor.js src/cli.js test/doctor.test.js
git commit -m "fix: make doctor fail on unhealthy install"
```

---

### Task 6: Final Verification And Documentation

**Files:**
- Optional Modify: `docs/lessons-learned.md`
- Read-only verify: full repository

- [ ] **Step 1: Record the reliability lesson**

Append this section to `docs/lessons-learned.md`:

```markdown
## Reliability hardening notes

- Installer defaults must point to an artifact that exists today. Do not make README one-liners depend on a tag before the tag is pushed.
- Backup files are recovery roots. A repeated patch may update manifests, but it must not overwrite the original backup.
- Manifest writers and manifest readers must share the same version-state schema.
- Diagnostic commands should return non-zero when they print a failed health state.
```

- [ ] **Step 2: Run targeted tests**

Run:

```bash
node --test test/bootstrap.test.js
node --test test/native-patcher.test.js
node --test test/auto-localize.test.js test/installer.test.js
node --test test/cli.test.js
node --test test/doctor.test.js
```

Expected: all targeted tests PASS.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run check
npm run dry-run:install
npm run dry-run:uninstall
npm audit --omit=dev
```

Expected:

```text
npm test: 0 failures
npm run check: exits 0
dry-run install/uninstall: exits 0
npm audit --omit=dev: found 0 vulnerabilities
```

- [ ] **Step 4: Check git diff**

Run:

```bash
git diff --stat
git diff --check
```

Expected: diff only touches files listed in this plan; `git diff --check` has no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add docs/lessons-learned.md
git commit -m "docs: record reliability hardening lessons"
```

---

## Rollback Plan

- If Task 1 causes concern because `main` is less stable than a tag, push a real `v0.1.0` tag first, then keep `CHANNEL=stable`. Do not ship a README command that points at a missing tag.
- If Task 2 reveals `tweakcc` expects backup overwrite semantics, preserve the original backup under `*.original.bak` and let the tweakcc-specific backup be separate.
- If Task 3 introduces circular imports, keep `src/version-state.js`; do not import `auto-localize` from `installer`.
- If Task 5 makes CI fail because a dry-run doctor intentionally lacks hooks, pass a fixture `CLAUDE_CONFIG_DIR` with installed hook settings or keep that CI command as a non-gating smoke check with explicit `|| true`. Prefer fixing the fixture over weakening doctor.

## Self-Review

- Spec coverage: all five review findings map to Tasks 1-5, with Task 6 covering final verification and lessons.
- Placeholder scan: no unresolved placeholders, no open-ended error handling instruction, and every test/implementation step includes concrete code or exact commands.
- Type consistency: shared version state exports `currentVersionState`, `readPluginVersions`, and `versionsChanged`; imports and tests use the same names.
