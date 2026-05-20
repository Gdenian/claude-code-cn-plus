# Claude Code CN Plus Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Claude Code CN Plus 在安装、诊断、自动补全翻译和工具提示这几条用户信任路径上更可恢复、更可诊断、更少副作用。

**Architecture:** 不做大重构，沿用现有 CommonJS 模块和 `node:test`。每个风险点先补一个失败测试，再用最小代码修复；CI 配置只修正错误预期，不引入新工具链。

**Tech Stack:** Node.js CommonJS、`node:test`、Bash、GitHub Actions、`tweakcc@4.0.13`。

---

## Success Criteria

- GitHub Actions 不再因为“未安装 Claude Code 的 doctor 预期失败”而误失败。
- `/cccn-localize-missing` 生成的 skill/command 在 `allowed-tools` 约束下可以保存生成翻译并应用。
- 插件和命令 frontmatter 解析只读写首个 `--- ... ---` 区块，正文里的 `description:` 不会被误读或误改。
- `settings.json` 损坏时，`install` 在 patch CLI 前失败，不会留下半安装状态。
- `doctor` 默认只读，不会写出 `localize-missing-translations.json`。
- 工具提示不会原样回显常见 token、API key、Authorization header。
- `npm run check`、`npm test`、`npm run dry-run:install`、`npm run dry-run:uninstall` 全部通过。

## File Map

- Modify: `.github/workflows/ci.yml` - 修正 doctor 在空环境下的 CI 预期。
- Modify: `src/cli.js` - 增加 `save-generated-translations` 命令，读取 stdin JSON 并保存生成翻译。
- Modify: `src/plugin-localizer.js` - 增加 frontmatter block 解析、生成翻译保存、doctor 只读扫描支持。
- Modify: `src/missing-localize-skill.js` - 让自动补全 skill 使用 CLI 保存翻译，而不是要求模型直接写文件。
- Modify: `src/doctor.js` - 调用只读缺失翻译扫描。
- Modify: `src/installer.js` - 安装前预检 settings，避免 CLI 已 patch 后才失败。
- Modify: `src/hooks/tool-tips.js` - 对 Bash 命令提示做 secret redaction。
- Modify: `test/cli.test.js` - 覆盖保存生成翻译命令。
- Modify: `test/plugin-localizer.test.js` - 覆盖 frontmatter 精准解析、只读扫描和保存生成翻译。
- Modify: `test/installer.test.js` - 覆盖 settings 损坏时不 patch CLI。
- Create: `test/tool-tips.test.js` - 覆盖工具提示脱敏。

---

### Task 1: Fix CI Doctor Expectation

**Files:**
- Modify: `.github/workflows/ci.yml:39`

- [ ] **Step 1: Reproduce the current doctor exit behavior locally**

Run:

```bash
tmp="$(mktemp -d)"
set +e
node bin/cccn.js doctor --claude-dir "$tmp"
status=$?
rm -rf "$tmp"
test "$status" -eq 1
```

Expected: PASS. `doctor` should return `1` for an empty Claude config because Claude Code, hooks, backups, and manifest are missing.

- [ ] **Step 2: Replace the CI step with an explicit expected-failure check**

In `.github/workflows/ci.yml`, replace:

```yaml
      - run: node bin/cccn.js doctor --claude-dir "$RUNNER_TEMP/claude"
```

with:

```yaml
      - run: |
          set +e
          node bin/cccn.js doctor --claude-dir "$RUNNER_TEMP/claude"
          status=$?
          test "$status" -eq 1
```

- [ ] **Step 3: Verify**

Run:

```bash
tmp="$(mktemp -d)"
set +e
node bin/cccn.js doctor --claude-dir "$tmp"
status=$?
rm -rf "$tmp"
test "$status" -eq 1
npm test
```

Expected: empty doctor check returns status `1`; tests PASS.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: expect doctor failure in empty environment"
```

---

### Task 2: Make Generated Translation Saving Work Under Allowed Tools

**Files:**
- Modify: `src/plugin-localizer.js`
- Modify: `src/cli.js`
- Modify: `src/missing-localize-skill.js`
- Modify: `test/cli.test.js`
- Modify: `test/installer.test.js`

- [ ] **Step 1: Add a failing CLI test for saving generated translations**

Append this to `test/cli.test.js`:

```js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const { run } = require('../src/cli');

test('run saves generated translations from stdin', async () => {
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cccn-cli-save-'));
  let output = '';

  const code = await run(
    ['save-generated-translations', '--claude-dir', claudeDir],
    {
      stdin: Readable.from([JSON.stringify({
        version: 1,
        translations: {
          'demo-plugin/demo-skill': '生成的中文描述',
        },
      })]),
      stdout: { write: (chunk) => { output += chunk; } },
      stderr: { write: () => {} },
    }
  );

  const generatedPath = path.join(claudeDir, 'localize-generated-translations.json');
  const stored = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));

  assert.equal(code, 0);
  assert.equal(stored.version, 1);
  assert.deepEqual(stored.translations, {
    'demo-plugin/demo-skill': '生成的中文描述',
  });
  assert.match(output, /已保存本地生成翻译: count=1/);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test test/cli.test.js
```

Expected: FAIL with `未知命令: save-generated-translations`.

- [ ] **Step 3: Add save helper to plugin localizer**

In `src/plugin-localizer.js`, add this function near `generatedTranslationsPathFor`:

```js
function saveGeneratedTranslations(options, payload) {
  const translations = payload?.translations;
  if (!payload || payload.version !== 1 || !translations || typeof translations !== 'object' || Array.isArray(translations)) {
    throw new Error('生成翻译 JSON 必须包含 version=1 和 translations 对象');
  }

  const generatedPath = options.generatedMemoryPath || generatedTranslationsPathFor(options.claudeDir);
  const data = {
    version: 1,
    translations,
  };

  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(generatedPath), { recursive: true });
    fs.writeFileSync(generatedPath, JSON.stringify(data, null, 2));
  }

  return {
    path: generatedPath,
    count: Object.keys(translations).length,
    dryRun: Boolean(options.dryRun),
  };
}
```

Export it at the bottom:

```js
  saveGeneratedTranslations,
```

- [ ] **Step 4: Add stdin reading and CLI command**

In `src/cli.js`, update the plugin-localizer import:

```js
const {
  generatedTranslationsPathFor,
  localizePluginDescriptions,
  saveGeneratedTranslations,
  scanMissingPluginDescriptions,
} = require('./plugin-localizer');
```

Add this helper above `run`:

```js
function readAllStdin(stream) {
  return new Promise((resolve, reject) => {
    let input = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { input += chunk; });
    stream.on('end', () => resolve(input));
    stream.on('error', reject);
  });
}
```

Add this branch before `apply-generated-translations`:

```js
  if (command === 'save-generated-translations') {
    const input = await readAllStdin(io.stdin || process.stdin);
    const payload = JSON.parse(input);
    const result = saveGeneratedTranslations(options, payload);
    io.stdout.write(`已保存本地生成翻译: count=${result.count} ${result.path}\n`);
    return 0;
  }
```

Add the command to `printHelp`:

```js
    '  save-generated-translations  从 stdin 保存 Claude Code 生成的翻译缓存',
```

- [ ] **Step 5: Update generated skill allowed tools**

In `src/missing-localize-skill.js`, change `buildCommands` so it also returns a save command:

```js
  const saveCommand = nodeCommand(cliPath, [
    'save-generated-translations',
    '--claude-dir',
    JSON.stringify(options.claudeDir),
    '--install-dir',
    JSON.stringify(options.installDir),
  ]);
  const allowedTools = [
    `Bash(node ${JSON.stringify(cliPath)} scan-missing *)`,
    `Bash(node ${JSON.stringify(cliPath)} save-generated-translations *)`,
    `Bash(node ${JSON.stringify(cliPath)} apply-generated-translations *)`,
  ].join(' ');
  return { allowedTools, applyCommand, saveCommand, scanCommand };
```

In `buildInstructions`, read `saveCommand`:

```js
  const { applyCommand, saveCommand, scanCommand } = buildCommands(options);
```

Replace the direct file write instruction:

```js
    `5. 将这个 JSON 写入 \`${generatedPath}\`。`,
```

with:

```js
    '5. 用下面的命令把 JSON 保存到本地生成缓存，不要直接使用 Write/Edit 工具：',
    '',
    '```bash',
    `cat <<'JSON' | ${saveCommand}`,
    '{',
    '  "version": 1,',
    '  "translations": {',
    '    "<missing key>": "<中文描述>"',
    '  }',
    '}',
    'JSON',
    '```',
    '',
    `生成缓存路径是 \`${generatedPath}\`。`,
```

- [ ] **Step 6: Update installer test expectations**

In `test/installer.test.js`, extend the existing skill assertions:

```js
  assert.match(fs.readFileSync(skillPath, 'utf8'), /save-generated-translations/);
  assert.match(fs.readFileSync(commandPath, 'utf8'), /save-generated-translations/);
```

- [ ] **Step 7: Verify**

Run:

```bash
node --test test/cli.test.js test/installer.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/cli.js src/plugin-localizer.js src/missing-localize-skill.js test/cli.test.js test/installer.test.js
git commit -m "feat: save generated translations through cli"
```

---

### Task 3: Restrict Description Parsing To Frontmatter

**Files:**
- Modify: `src/plugin-localizer.js`
- Modify: `test/plugin-localizer.test.js`

- [ ] **Step 1: Add failing tests for body `description:` safety**

Append this to `test/plugin-localizer.test.js`:

```js
test('readField only reads fields from frontmatter', () => {
  const content = [
    '---',
    'name: demo',
    'description: Frontmatter desc',
    '---',
    '',
    'description: Body desc',
  ].join('\n');

  assert.equal(readField(content, 'description'), 'Frontmatter desc');
});

test('replaceDescription does not modify body description text', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  fs.writeFileSync(fixture.skillPath, [
    '---',
    'name: demo-skill',
    'description: English desc',
    '---',
    '',
    'description: Body desc must stay as-is',
  ].join('\n'));
  writeMemory(memoryPath, {
    'demo-plugin/demo-skill': '中文描述',
  });

  const result = localizePluginDescriptions({ claudeDir: fixture.claudeDir, memoryPath });
  const content = fs.readFileSync(fixture.skillPath, 'utf8');

  assert.equal(result.patched, 1);
  assert.match(content, /^description: "中文描述"$/m);
  assert.match(content, /^description: Body desc must stay as-is$/m);
});

test('readField ignores files without frontmatter', () => {
  assert.equal(readField('description: Body only', 'description'), null);
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
node --test test/plugin-localizer.test.js
```

Expected: at least the no-frontmatter test FAILS under the current parser.

- [ ] **Step 3: Add frontmatter block parser**

In `src/plugin-localizer.js`, replace `readField` with this helper pair:

```js
function splitFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/);
  if (!match) return null;
  return {
    full: match[0],
    body: match[1],
    end: match[0].length,
  };
}

function readField(content, field) {
  const frontmatter = splitFrontmatter(content);
  if (!frontmatter) return null;

  const quoted = frontmatter.body.match(new RegExp(`^${field}:\\s*["'](.+?)["']\\s*$`, 'm'));
  if (quoted) return quoted[1];

  const unquoted = frontmatter.body.match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, 'm'));
  return unquoted ? unquoted[1].trim() : null;
}
```

- [ ] **Step 4: Replace description only inside the frontmatter block**

Replace `replaceDescription` with:

```js
function replaceDescription(filePath, newDescription, dryRun) {
  const content = fs.readFileSync(filePath, 'utf8');
  const current = readField(content, 'description');
  if (current && /[\u4e00-\u9fff]/.test(current)) return 'skip';

  const frontmatter = splitFrontmatter(content);
  if (!frontmatter) return false;

  const nextFrontmatter = frontmatter.full.replace(
    /^(description:\s*).+$/m,
    `$1${escapeYamlValue(newDescription)}`
  );
  const nextContent = `${nextFrontmatter}${content.slice(frontmatter.end)}`;

  if (nextContent === content) return false;
  if (!dryRun) fs.writeFileSync(filePath, nextContent, 'utf8');
  return true;
}
```

Export `splitFrontmatter` only if a test needs direct access. Prefer keeping it private if the tests above are enough.

- [ ] **Step 5: Verify**

Run:

```bash
node --test test/plugin-localizer.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugin-localizer.js test/plugin-localizer.test.js
git commit -m "fix: localize only frontmatter descriptions"
```

---

### Task 4: Preflight Settings Before Patching CLI

**Files:**
- Modify: `src/installer.js`
- Modify: `test/installer.test.js`

- [ ] **Step 1: Add failing regression test**

Append this to `test/installer.test.js`:

```js
test('install does not patch CLI when settings json is invalid', async () => {
  const env = makeEnv();
  const installation = makeLegacyPackage(env.root);
  fs.writeFileSync(path.join(env.claudeDir, 'settings.json'), '{bad');

  await assert.rejects(
    () => install({
      yes: true,
      claudeDir: env.claudeDir,
      installDir: env.installDir,
      installation,
      translations: { 'Hello world': '你好世界' },
      extraTranslations: {},
      memoryPath: path.join(env.installDir, 'missing-memory.json'),
    }),
    /settings.json 解析失败/
  );

  assert.equal(fs.readFileSync(installation.path, 'utf8'), 'const label = "Hello world";');
  assert.equal(fs.existsSync(path.join(path.dirname(installation.path), 'cli.bak.js')), false);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test test/installer.test.js
```

Expected: FAIL because current install patches CLI before settings parsing fails.

- [ ] **Step 3: Add settings preflight**

In `src/installer.js`, change the settings import:

```js
const { configureChineseLanguage, readSettings } = require('./settings');
```

Add this near the start of `install`, after `installation` is detected and before `patchCli` can run:

```js
  readSettings(claudeDir);
```

The exact location should be:

```js
  const installation = await detectClaudeInstallation(options);
  readSettings(claudeDir);
  let cliResult = null;
  let cliError = null;
```

- [ ] **Step 4: Verify**

Run:

```bash
node --test test/installer.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/installer.js test/installer.test.js
git commit -m "fix: preflight settings before cli patch"
```

---

### Task 5: Make Doctor Read-Only

**Files:**
- Modify: `src/plugin-localizer.js`
- Modify: `src/doctor.js`
- Modify: `test/plugin-localizer.test.js`
- Modify: `test/doctor.test.js`

- [ ] **Step 1: Add failing tests for read-only scanning**

Append this to `test/plugin-localizer.test.js`:

```js
test('scanMissingPluginDescriptions can run without writing missing file', () => {
  const fixture = makeTempClaudeDir();
  const memoryPath = path.join(fixture.claudeDir, 'translation-memory.json');
  const missingPath = missingTranslationsPathFor(fixture.claudeDir);
  writeMemory(memoryPath, {});

  const result = scanMissingPluginDescriptions({
    claudeDir: fixture.claudeDir,
    memoryPath,
    writeMissing: false,
  });

  assert.equal(result.missing, 1);
  assert.equal(result.missingPath, missingPath);
  assert.equal(fs.existsSync(missingPath), false);
});
```

Append this to `test/doctor.test.js`:

```js
test('runDoctor does not write missing translations file', async () => {
  const claudeDir = makeClaudeDir();
  const skillDir = path.join(claudeDir, 'plugins', 'cache', 'market', 'demo-plugin', '1.0.0', 'skills', 'demo');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
    '---',
    'name: demo-skill',
    'description: English desc',
    '---',
  ].join('\n'));

  await runDoctor({
    claudeDir,
    installation: { kind: 'npm', path: '/tmp/cli.js', version: '1.0.0' },
    nodeVersion: '20.0.0',
  });

  assert.equal(fs.existsSync(path.join(claudeDir, 'localize-missing-translations.json')), false);
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
node --test test/plugin-localizer.test.js test/doctor.test.js
```

Expected: FAIL because scanning currently writes the missing file.

- [ ] **Step 3: Add read-only scan option**

In `src/plugin-localizer.js`, change `scanMissingPluginDescriptions` near the end from:

```js
  const missingPath = writeMissingFile({ ...options, generatedMemoryPath }, missingItems);
```

to:

```js
  const missingPath = options.writeMissing === false
    ? (options.missingPath || missingTranslationsPathFor(options.claudeDir))
    : writeMissingFile({ ...options, generatedMemoryPath }, missingItems);
```

- [ ] **Step 4: Use read-only mode in doctor**

In `src/doctor.js`, add `writeMissing: false` to the `scanMissingPluginDescriptions` call:

```js
  const missing = scanMissingPluginDescriptions({
    claudeDir,
    memoryPath: options.memoryPath,
    generatedMemoryPath: options.generatedMemoryPath,
    homeDir: options.homeDir,
    projectDir: options.projectDir,
    dryRun: options.dryRun,
    writeMissing: false,
  });
```

- [ ] **Step 5: Verify**

Run:

```bash
node --test test/plugin-localizer.test.js test/doctor.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/plugin-localizer.js src/doctor.js test/plugin-localizer.test.js test/doctor.test.js
git commit -m "fix: keep doctor read only"
```

---

### Task 6: Redact Secrets In Tool Tips

**Files:**
- Modify: `src/hooks/tool-tips.js`
- Create: `test/tool-tips.test.js`

- [ ] **Step 1: Add failing tests**

Create `test/tool-tips.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { getTip, redactCommand } = require('../src/hooks/tool-tips');

test('redactCommand hides common secret values', () => {
  const command = [
    'curl https://api.example.com?api_key=sk-abc123456789',
    '-H "Authorization: Bearer sk-secret987654321"',
    'OPENAI_API_KEY=sk-env123456789',
    'PASSWORD=hunter2',
  ].join(' ');

  const redacted = redactCommand(command);

  assert.doesNotMatch(redacted, /sk-abc123456789/);
  assert.doesNotMatch(redacted, /sk-secret987654321/);
  assert.doesNotMatch(redacted, /sk-env123456789/);
  assert.doesNotMatch(redacted, /hunter2/);
  assert.match(redacted, /api_key=\[REDACTED\]/);
  assert.match(redacted, /Authorization: Bearer \[REDACTED\]/i);
  assert.match(redacted, /OPENAI_API_KEY=\[REDACTED\]/);
  assert.match(redacted, /PASSWORD=\[REDACTED\]/);
});

test('getTip redacts bash command before printing', () => {
  const tip = getTip({
    tool_name: 'Bash',
    tool_input: {
      command: 'OPENAI_API_KEY=sk-test123456789 node script.js',
    },
  });

  assert.match(tip, /OPENAI_API_KEY=\[REDACTED\]/);
  assert.doesNotMatch(tip, /sk-test123456789/);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test test/tool-tips.test.js
```

Expected: FAIL because `redactCommand` does not exist.

- [ ] **Step 3: Implement redaction**

In `src/hooks/tool-tips.js`, add this function after `explainCommand`:

```js
function redactCommand(command) {
  return String(command || '')
    .replace(/(authorization:\s*bearer\s+)[^\s"']+/ig, '$1[REDACTED]')
    .replace(/([?&](?:api_key|key|token|access_token)=)[^&\s"']+/ig, '$1[REDACTED]')
    .replace(/\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)=)[^\s"']+/g, '$1[REDACTED]')
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]');
}
```

In `getTip`, replace:

```js
    return command ? `执行: ${command} - ${explainCommand(command)}` : '命令执行完成';
```

with:

```js
    return command ? `执行: ${redactCommand(command)} - ${explainCommand(command)}` : '命令执行完成';
```

Export it:

```js
  redactCommand,
```

- [ ] **Step 4: Verify**

Run:

```bash
node --test test/tool-tips.test.js
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/tool-tips.js test/tool-tips.test.js
git commit -m "fix: redact secrets in tool tips"
```

---

### Task 7: Final Verification

**Files:**
- No code changes unless a verification failure exposes a task-related regression.

- [ ] **Step 1: Run syntax checks**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run dry-run install and uninstall**

Run:

```bash
npm run dry-run:install
npm run dry-run:uninstall
```

Expected: both commands exit 0.

- [ ] **Step 4: Re-check empty doctor semantics**

Run:

```bash
tmp="$(mktemp -d)"
set +e
node bin/cccn.js doctor --claude-dir "$tmp"
status=$?
rm -rf "$tmp"
test "$status" -eq 1
```

Expected: PASS.

- [ ] **Step 5: Review diff scope**

Run:

```bash
git diff --stat
git diff --check
```

Expected: no whitespace errors; changed files match the File Map.

- [ ] **Step 6: Final commit if any verification-only cleanup was needed**

Only run this if Step 5 required a small follow-up fix:

```bash
git add <changed-files>
git commit -m "test: verify hardening workflow"
```

---

## Self-Review Notes

- Spec coverage: each issue from the review has a task: CI doctor expectation, generated translation persistence, frontmatter scope, install preflight, doctor read-only behavior, and tool-tip secret redaction.
- Scope control: no new dependencies, no CLI framework rewrite, no broad installer refactor.
- Risk order: start with CI and broken command flow, then reduce file mutation risk, then polish safety behavior.
