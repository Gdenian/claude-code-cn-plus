#!/usr/bin/env node
// extra-ui.js - 额外安全 UI 汉化
// 只包含较长、不会在代码逻辑中出现的 UI 字符串
// 所有条目经过逐个测试验证，不会破坏 cli.js

'use strict';

const fs = require('fs');

// 额外 UI 翻译（安全，已验证）
const translations = {
  // === AskUserQuestion UI ===
  "User answered Claude's questions:": "用户回答：",
  "User declined to answer questions": "用户拒绝回答问题",
  "No preview available": "无预览",
  "Chat about this": "讨论这个",
  "Skip interview and plan immediately": "跳过访谈，立即计划",

  // === Permission ===
  "Don't ask again": "不再询问",
  "Don't ask me again": "不再询问",

  // === Plan mode ===
  "Ready to code?": "准备好编码了吗?",
  "Exit plan mode?": "退出计划模式?",
  "Claude wants to exit plan mode": "Claude 想退出计划模式",
  "Here is Claude's plan:": "以下是 Claude 的计划:",
  "Plan saved!": "计划已保存!",
  "No, keep planning": "不，继续规划",
  "Use auto mode during plan": "在计划期间使用自动模式",
  "Requested permissions:": "请求的权限:",

  // === Network/Sandbox ===
  "Network request outside of sandbox": "沙箱外的网络请求",
  "Do you want to allow this connection?": "是否允许此连接?",

  // === Workspace ===
  "Remove directory from workspace?": "从工作区移除目录?",
  "(Original working directory)": "（原始工作目录）",

  // === Plugin ===
  "Plugin Recommendation": "插件推荐",
  "LSP Plugin Recommendation": "LSP 插件推荐",
  "Would you like to install it?": "是否安装？",
  "LSP provides code intelligence like go-to-definition and error checking": "LSP 提供代码智能功能，如转到定义和错误检查",

  // === 按钮/选项标签 ===
  "Continue without these settings": "不使用这些设置继续",
  "Continue without using this MCP server": "不使用此 MCP 服务器继续",
  "Use this MCP server": "使用此 MCP 服务器",
  "Continue this conversation": "继续此对话",
  "Restore code and conversation": "恢复代码和对话",
  "Restore code": "恢复代码",
  "Stash changes and continue": "暂存更改并继续",
  "Exit and fix manually": "退出并手动修复",
  "Exit without making changes": "退出且不修改",
  "Upgrade your plan": "升级你的计划",
  "View on GitHub": "在 GitHub 上查看",
  "Save to file": "保存到文件",
  "Copy to clipboard": "复制到剪贴板",
  "Submit answers": "提交答案",
  "Send message as a new conversation": "作为新对话发送",
  "Open in Claude Code on the web": "在 Claude Code 网页版中打开",
  "Proceed with Extra Usage billing": "使用额外用量计费继续",
  "Stop and wait for limit to reset": "停止并等待限制重置",
  "Summarize from here": "从这里开始摘要",
  "Full response": "完整回复",
  "Fix errors": "修复错误",
  "Update now": "立即更新",
  "Play animation": "播放动画",
  "Where should this rule be saved?": "此规则应保存到哪里？",
  "Where should these rules be saved?": "这些规则应保存到哪里？",
  "Project settings (local)": "项目设置（本地）",
  "User settings": "用户设置",
  "Open in editor": "在编辑器中打开",
};

function applyExtraTranslations(cliPath) {
  let content = fs.readFileSync(cliPath, 'utf8');
  let count = 0;

  for (const [eng, chn] of Object.entries(translations)) {
    const old = `"${eng}"`;
    const rep = `"${chn}"`;
    const n = content.split(old).length - 1;
    if (n > 0) {
      content = content.split(old).join(rep);
      count += n;
    }
  }

  fs.writeFileSync(cliPath, content, 'utf8');
  console.log(`  额外 UI 汉化: ${count} 处替换`);
  return count;
}

// 直接运行
if (require.main === module) {
  const cliPath = process.argv[2];
  if (!cliPath) {
    console.error('用法: node extra-ui.js <cli.js 路径>');
    process.exit(1);
  }
  applyExtraTranslations(cliPath);
}

module.exports = { applyExtraTranslations, translations };
