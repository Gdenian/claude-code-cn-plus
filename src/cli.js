'use strict';

const { localizeAuto } = require('./auto-localize');
const { runDoctor } = require('./doctor');
const { defaultClaudeDir, defaultInstallDir, defaultMemoryPath, install, restoreCli, uninstall } = require('./installer');
const { generatedTranslationsPathFor, localizePluginDescriptions, saveGeneratedTranslations, scanMissingPluginDescriptions } = require('./plugin-localizer');

function readPathOption(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} 需要路径参数`);
  }
  return value;
}

function parseArgs(argv) {
  const command = argv[0] || 'help';
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--yes' || arg === '-y') options.yes = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--verbose') options.verbose = true;
    else if (arg === '--auto') options.auto = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--claude-dir') {
      options.claudeDir = readPathOption(argv, index, arg);
      index += 1;
    } else if (arg === '--install-dir') {
      options.installDir = readPathOption(argv, index, arg);
      index += 1;
    } else if (arg === '--project-dir') {
      options.projectDir = readPathOption(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }
  return { command, options };
}

function printDoctor(report, io) {
  io.stdout.write(`Node.js: ${report.node.ok ? 'OK' : 'FAIL'} ${report.node.version}\n`);
  if (report.installation) {
    io.stdout.write(`Claude Code: ${report.installation.kind} ${report.installation.version || 'unknown'} ${report.installation.path}\n`);
  } else {
    io.stdout.write('Claude Code: 未找到\n');
  }
  io.stdout.write(`Hooks: tool-tips=${report.hooks.toolTips ? 'OK' : 'missing'} auto-localize=${report.hooks.autoLocalize ? 'OK' : 'missing'}\n`);
  io.stdout.write(`Plugin cache: ${report.pluginCache.exists ? 'OK' : 'missing'} ${report.pluginCache.path}\n`);
  io.stdout.write(`Backups: ${report.backups.exists ? 'OK' : 'missing'} ${report.backups.path}\n`);
  io.stdout.write(`Manifest: ${report.manifest.exists ? 'OK' : 'missing'} ${report.manifest.path}\n`);
  if (report.missingTranslations) {
    io.stdout.write(`Missing translations: ${report.missingTranslations.missing} ${report.missingTranslations.path}\n`);
    if (report.missingTranslations.missing > 0) {
      io.stdout.write('提示: 在 Claude Code 中运行 /cccn-localize-missing 可自动补全缺失描述。\n');
    }
  }
}

function printPluginHint(result, io) {
  if (result.plugin?.missing > 0) {
    io.stdout.write(`还有 ${result.plugin.missing} 个插件/技能/命令描述未汉化。\n`);
    io.stdout.write('打开 Claude Code 后运行 /cccn-localize-missing 可让 Claude Code 自动补全。\n');
  }
}

function printHelp(io) {
  io.stdout.write([
    '用法: cccn <command> [options]',
    '',
    'Commands:',
    '  install --yes        安装全部汉化能力',
    '  uninstall --yes      卸载并恢复 CLI',
    '  doctor               检查安装状态',
    '  localize --auto      供自动维护 hook 调用',
    '  scan-missing         扫描缺失的插件/技能/命令描述翻译',
    '  save-generated-translations  从 stdin 保存 Claude Code 生成的翻译缓存',
    '  apply-generated-translations  应用 Claude Code 生成的本地翻译缓存',
    '  restore              只恢复 Claude Code CLI',
    '',
    'Options:',
    '  --dry-run',
    '  --claude-dir <path>',
    '  --install-dir <path>',
    '  --verbose',
  ].join('\n') + '\n');
}

function readAllStdin(stream) {
  return new Promise((resolve, reject) => {
    let input = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => { input += chunk; });
    stream.on('end', () => resolve(input));
    stream.on('error', reject);
  });
}

async function run(argv = process.argv.slice(2), io = { stdout: process.stdout, stderr: process.stderr }) {
  const { command, options } = parseArgs(argv);
  options.claudeDir = options.claudeDir || defaultClaudeDir();
  options.installDir = options.installDir || defaultInstallDir();
  options.memoryPath = options.memoryPath || defaultMemoryPath(options.installDir);
  options.generatedMemoryPath = options.generatedMemoryPath || generatedTranslationsPathFor(options.claudeDir);

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp(io);
    return 0;
  }

  if (command === 'install') {
    const result = await install(options);
    if (result.ok) {
      io.stdout.write(`安装完成${options.dryRun ? ' (dry-run)' : ''}\n`);
    } else {
      io.stderr.write(`CLI 汉化失败，已保留其他功能安装: ${result.error.message}\n`);
    }
    printPluginHint(result, io);
    return result.exitCode;
  }

  if (command === 'uninstall') {
    await uninstall(options);
    io.stdout.write(`卸载完成${options.dryRun ? ' (dry-run)' : ''}\n`);
    return 0;
  }

  if (command === 'restore') {
    const result = await restoreCli(options);
    io.stdout.write(result.restored ? 'CLI 已恢复\n' : `CLI 未恢复: ${result.reason || '未找到备份'}\n`);
    return result.restored ? 0 : 1;
  }

  if (command === 'doctor') {
    const report = await runDoctor(options);
    printDoctor(report, io);
    return report.ok ? 0 : 1;
  }

  if (command === 'scan-missing') {
    const result = scanMissingPluginDescriptions(options);
    const payload = {
      missing: result.missing,
      missingPath: result.missingPath,
      generatedPath: result.generatedPath,
      items: result.missingItems.map((item) => ({
        key: item.key,
        path: item.path,
        source: item.source,
        name: item.name,
        description: item.desc,
      })),
    };
    if (options.json) {
      io.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else if (result.missing > 0) {
      io.stdout.write(`发现 ${result.missing} 个描述未汉化，缺失清单已写入 ${result.missingPath}\n`);
      io.stdout.write('请在 Claude Code 中运行 /cccn-localize-missing 自动补全。\n');
    } else {
      io.stdout.write('没有发现缺失的描述翻译。\n');
    }
    return 0;
  }

  if (command === 'save-generated-translations') {
    const input = await readAllStdin(io.stdin || process.stdin);
    const payload = JSON.parse(input);
    const result = saveGeneratedTranslations(options, payload);
    io.stdout.write(`已保存本地生成翻译: count=${result.count} ${result.path}\n`);
    return 0;
  }

  if (command === 'apply-generated-translations') {
    const result = localizePluginDescriptions(options);
    io.stdout.write(`已应用本地生成翻译: patched=${result.patched} missing=${result.missing}\n`);
    if (result.missing > 0) {
      io.stdout.write('仍有缺失项，可再次运行 /cccn-localize-missing 补全。\n');
    }
    return 0;
  }

  if (command === 'localize') {
    await localizeAuto(options);
    io.stdout.write(`自动维护完成${options.dryRun ? ' (dry-run)' : ''}\n`);
    return 0;
  }

  throw new Error(`未知命令: ${command}`);
}

module.exports = {
  parseArgs,
  printDoctor,
  run,
};
