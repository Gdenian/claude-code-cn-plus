'use strict';

const path = require('node:path');

const { readSettings, writeSettings } = require('./settings');

function nodeCommand(scriptPath) {
  return `node ${JSON.stringify(scriptPath)}`;
}

function buildHookCommands(installDir) {
  return {
    toolTips: nodeCommand(path.join(installDir, 'src', 'hooks', 'tool-tips.js')),
    autoLocalize: nodeCommand(path.join(installDir, 'src', 'hooks', 'auto-localize.js')),
  };
}

function hasHook(settings, marker) {
  return (settings.hooks?.PostToolUse || []).some((entry) =>
    (entry.hooks || []).some((hook) => hook.command && hook.command.includes(marker))
  );
}

function installHooks(options) {
  const settings = readSettings(options.claudeDir);
  const dryRun = Boolean(options.dryRun);
  const commands = buildHookCommands(options.installDir);

  settings.hooks = settings.hooks || {};
  settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];

  if (!hasHook(settings, 'tool-tips.js') && !hasHook(settings, 'tool-tips-post.sh')) {
    settings.hooks.PostToolUse.push({
      matcher: 'Bash|Read|Write|Edit|MultiEdit|Glob|Grep|mcp__*',
      hooks: [{ type: 'command', command: commands.toolTips }],
    });
  }

  if (!hasHook(settings, 'auto-localize.js') && !hasHook(settings, 'auto-localize.sh')) {
    settings.hooks.PostToolUse.push({
      matcher: 'Bash',
      hooks: [{ type: 'command', command: commands.autoLocalize }],
    });
  }

  writeSettings(options.claudeDir, settings, dryRun);
  return { changed: true, dryRun, commands };
}

function isCccnHook(command) {
  return command
    && (
      command.includes('tool-tips.js')
      || command.includes('auto-localize.js')
      || command.includes('tool-tips-post.sh')
      || command.includes('auto-localize.sh')
    );
}

function uninstallHooks(options) {
  const settings = readSettings(options.claudeDir);
  const dryRun = Boolean(options.dryRun);
  if (!settings.hooks?.PostToolUse) return { changed: false, dryRun };

  const next = [];
  for (const entry of settings.hooks.PostToolUse) {
    const hooks = (entry.hooks || []).filter((hook) => !isCccnHook(hook.command));
    if (hooks.length > 0) next.push({ ...entry, hooks });
  }

  if (next.length > 0) {
    settings.hooks.PostToolUse = next;
  } else {
    delete settings.hooks.PostToolUse;
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  writeSettings(options.claudeDir, settings, dryRun);
  return { changed: true, dryRun };
}

module.exports = {
  buildHookCommands,
  installHooks,
  uninstallHooks,
};
