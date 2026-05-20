#!/usr/bin/env node
'use strict';

function explainCommand(command) {
  const first = String(command || '').trim().split(/\s+/)[0];
  const map = {
    git: 'Git 版本控制操作',
    npm: 'Node.js 包管理操作',
    npx: 'Node.js 包管理操作',
    node: '运行 Node.js 程序',
    python: '运行 Python 程序',
    python3: '运行 Python 程序',
    ls: '查看目录文件列表',
    cat: '查看文件内容',
    rg: '搜索文本或文件',
    grep: '搜索文本',
    find: '搜索文件或目录',
    curl: '请求网络资源',
    docker: 'Docker 容器操作',
    cargo: 'Rust 构建操作',
    go: 'Go 语言操作',
  };
  return map[first] || (command && command.length <= 20 ? `执行命令: ${command}` : '执行系统命令');
}

function redactCommand(command) {
  return String(command || '')
    .replace(/(authorization:\s*bearer\s+)[^\s"']+/ig, '$1[REDACTED]')
    .replace(/([?&](?:api_key|key|token|access_token)=)[^&\s"']+/ig, '$1[REDACTED]')
    .replace(/\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)=)("[^"]*"|'[^']*'|[^\s"']+)/g, '$1[REDACTED]')
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]');
}

function shortPath(filePath) {
  return String(filePath || '').split(/[\\/]/).pop().slice(0, 50);
}

function getTip(event) {
  const toolName = event.tool_name || event.toolName;
  const input = event.tool_input || event.input || event;
  if (toolName === 'Read') return input.file_path ? `读取: ${shortPath(input.file_path)} - 查看文件内容` : '读取完成';
  if (toolName === 'Write') return input.file_path ? `写入: ${shortPath(input.file_path)} - 创建或覆盖文件` : '写入完成';
  if (toolName === 'Edit' || toolName === 'MultiEdit') return input.file_path ? `编辑: ${shortPath(input.file_path)} - 修改文件内容` : '编辑完成';
  if (toolName === 'Bash') {
    const command = String(input.command || '').split('\n').find((line) => line.trim() && !line.trim().startsWith('#')) || '';
    const safeCommand = redactCommand(command);
    return command ? `执行: ${safeCommand} - ${explainCommand(safeCommand)}` : '命令执行完成';
  }
  if (toolName === 'Grep') return input.pattern ? `搜索: ${input.pattern}` : '搜索完成';
  if (toolName === 'Glob') return input.pattern ? `匹配文件: ${input.pattern}` : '文件匹配完成';
  return toolName ? `${toolName} 执行完成` : '';
}

function parseEvent(input) {
  try {
    return JSON.parse(input || '{}');
  } catch {
    return {};
  }
}

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    const tip = getTip(parseEvent(input));
    if (tip) process.stdout.write(`${tip}\n`);
  });
}

module.exports = {
  explainCommand,
  getTip,
  parseEvent,
  redactCommand,
};
