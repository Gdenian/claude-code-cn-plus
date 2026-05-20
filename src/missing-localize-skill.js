'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { missingTranslationsPathFor } = require('./plugin-localizer');

function skillDirFor(claudeDir) {
  return path.join(claudeDir, 'skills', 'cccn-localize-missing');
}

function skillPathFor(claudeDir) {
  return path.join(skillDirFor(claudeDir), 'SKILL.md');
}

function commandPathFor(claudeDir) {
  return path.join(claudeDir, 'commands', 'cccn-localize-missing.md');
}

function nodeCommand(scriptPath, args) {
  return ['node', JSON.stringify(scriptPath), ...args].join(' ');
}

function buildCommands(options) {
  const cliPath = path.join(options.installDir, 'bin', 'cccn.js');
  const scanCommand = nodeCommand(cliPath, [
    'scan-missing',
    '--json',
    '--claude-dir',
    JSON.stringify(options.claudeDir),
    '--install-dir',
    JSON.stringify(options.installDir),
  ]);
  const applyCommand = nodeCommand(cliPath, [
    'apply-generated-translations',
    '--claude-dir',
    JSON.stringify(options.claudeDir),
    '--install-dir',
    JSON.stringify(options.installDir),
  ]);
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
}

function buildInstructions(options) {
  const { applyCommand, saveCommand, scanCommand } = buildCommands(options);
  const missingPath = missingTranslationsPathFor(options.claudeDir);

  return [
    '# 补全缺失汉化',
    '',
    '你正在为 Claude Code CN Plus 补全本机缺失的 `description` 汉化。',
    '',
    '## 当前缺失清单',
    '',
    `!\`${scanCommand}\``,
    '',
    '## 操作要求',
    '',
    `1. 如果上面的 \`missing\` 为空，告诉用户当前没有缺失项。缺失清单文件路径是 \`${missingPath}\`。`,
    '2. 如果存在缺失项，把每个 `description` 翻译成自然、简洁、适合 Claude Code 技能/命令选择器展示的中文。',
    '3. 不要翻译 `SKILL.md` 正文，不要修改英文原始描述字段以外的内容。',
    '4. 把翻译结果写成下面这个 JSON 结构：',
    '',
    '```json',
    '{',
    '  "version": 1,',
    '  "translations": {',
    '    "<missing key>": "<中文描述>"',
    '  }',
    '}',
    '```',
    '',
    '5. 不要直接使用 Write/Edit 工具保存翻译。必须用允许的 Bash 命令把 JSON 通过 stdin 传给保存命令：',
    '',
    '```bash',
    `${saveCommand} <<'JSON'`,
    '{',
    '  "version": 1,',
    '  "translations": {',
    '    "<missing key>": "<中文描述>"',
    '  }',
    '}',
    'JSON',
    '```',
    '',
    `6. 写入后运行：\`${applyCommand}\`。`,
    '7. 最后用中文简短告诉用户补全了多少项，以及是否还有缺失项。',
    '',
  ].join('\n');
}

function buildSkillContent(options) {
  const { allowedTools } = buildCommands(options);

  return [
    '---',
    'name: cccn-localize-missing',
    'description: 补全 Claude Code CN Plus 未覆盖的插件、技能和命令描述翻译。用户发现仍有英文描述或 doctor 提示缺失翻译时使用。',
    'disable-model-invocation: true',
    `allowed-tools: ${allowedTools}`,
    '---',
    '',
    buildInstructions(options),
  ].join('\n');
}

function buildCommandContent(options) {
  const { allowedTools } = buildCommands(options);

  return [
    '---',
    'description: 补全 Claude Code CN Plus 未覆盖的插件、技能和命令描述翻译',
    `allowed-tools: ${allowedTools}`,
    '---',
    '',
    buildInstructions(options),
  ].join('\n');
}

function installMissingLocalizeSkill(options) {
  if (options.dryRun) return { changed: true, path: skillPathFor(options.claudeDir), commandPath: commandPathFor(options.claudeDir), dryRun: true };
  fs.mkdirSync(skillDirFor(options.claudeDir), { recursive: true });
  fs.writeFileSync(skillPathFor(options.claudeDir), buildSkillContent(options), 'utf8');
  fs.mkdirSync(path.dirname(commandPathFor(options.claudeDir)), { recursive: true });
  fs.writeFileSync(commandPathFor(options.claudeDir), buildCommandContent(options), 'utf8');
  return { changed: true, path: skillPathFor(options.claudeDir), commandPath: commandPathFor(options.claudeDir), dryRun: false };
}

function uninstallMissingLocalizeSkill(options) {
  if (!options.dryRun) {
    fs.rmSync(skillDirFor(options.claudeDir), { recursive: true, force: true });
    fs.rmSync(commandPathFor(options.claudeDir), { force: true });
  }
  return { changed: true, path: skillPathFor(options.claudeDir), commandPath: commandPathFor(options.claudeDir), dryRun: Boolean(options.dryRun) };
}

module.exports = {
  buildCommandContent,
  buildSkillContent,
  commandPathFor,
  installMissingLocalizeSkill,
  skillPathFor,
  uninstallMissingLocalizeSkill,
};
