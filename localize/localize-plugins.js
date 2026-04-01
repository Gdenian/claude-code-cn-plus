#!/usr/bin/env node
// localize-plugins.js - Claude Code 插件汉化脚本
// 对已安装插件的 SKILL.md / command.md 描述进行汉化
// 插件更新后需重新运行此脚本
// License: MIT

const fs = require('fs');
const path = require('path');
const os = require('os');

const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[0;33m';
const RED = '\x1b[0;31m';
const MAGENTA = '\x1b[38;5;206m';
const NC = '\x1b[0m';

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const CACHE_DIR = path.join(CLAUDE_DIR, 'plugins', 'cache');

// ========== 汉化映射 ==========
// 格式: [glob匹配路径, 旧描述, 新描述]
const translations = [
  // --- claude-hud ---
  {
    file: 'claude-hud/*/commands/setup.md',
    find: 'Configure claude-hud as your statusline',
    replace: '配置 claude-hud 作为你的状态栏',
  },
  {
    file: 'claude-hud/*/commands/configure.md',
    find: 'Configure HUD display options (layout, presets, display elements) while preserving advanced manual overrides',
    replace: '配置 HUD 显示选项（布局、预设、显示元素），同时保留高级手动覆盖设置',
  },

  // --- claude-md-management ---
  {
    file: 'claude-md-management/*/skills/claude-md-improver/SKILL.md',
    find: 'Audit and improve CLAUDE.md files in repositories. Use when user asks to check, audit, update, improve, or fix CLAUDE.md files. Scans for all CLAUDE.md files, evaluates quality against templates, outputs quality report, then makes targeted updates. Also use when the user mentions "CLAUDE.md maintenance" or "project memory optimization".',
    replace: '审计和改进仓库中的 CLAUDE.md 文件。当用户要求检查、审计、更新、改进或修复 CLAUDE.md 文件时使用。扫描所有 CLAUDE.md 文件，对照模板评估质量，输出质量报告，然后进行针对性更新。当用户提到"CLAUDE.md 维护"或"项目记忆优化"时也可使用。',
  },

  // --- document-skills/slack-gif-creator ---
  {
    file: 'document-skills/*/skills/slack-gif-creator/SKILL.md',
    find: 'Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use when users request animated GIFs for Slack like "make me a GIF of X doing Y for Slack."',
    replace: '创建为 Slack 优化的动画 GIF 的知识和工具。提供约束条件、验证工具和动画概念。当用户要求为 Slack 创建动画 GIF 时使用，例如"帮我做一个 X 做 Y 的 GIF 用于 Slack"。',
  },

  // --- superpowers skills ---
  {
    file: 'superpowers/*/skills/brainstorming/SKILL.md',
    find: 'Use before any creative work — creating features, building components, adding new capabilities, or modifying behavior. Deeply explore user intent, needs, and design before implementation.',
    replace: '在任何创造性工作之前必须使用 — 创建功能、构建组件、添加新功能或修改行为。在实施之前深入探索用户意图、需求和设计。',
  },
  {
    file: 'superpowers/*/skills/brainstorming/SKILL.md',
    find: 'Use before any creative work to explore user intent, needs, and design before implementation.',
    replace: '在任何创造性工作之前必须使用 — 在实施之前探索用户意图、需求和设计。',
  },
  {
    file: 'superpowers/*/skills/dispatching-parallel-agents/SKILL.md',
    find: 'Use when faced with 2 or more tasks that can be executed independently with no shared state or sequential dependency',
    replace: '当面对 2 个或更多可独立执行、无需共享状态或顺序依赖的任务时使用',
  },
  {
    file: 'superpowers/*/skills/executing-plans/SKILL.md',
    find: 'Use when you have a written implementation plan to execute in a standalone session with review checkpoints',
    replace: '当有已编写的实施计划需要在独立会话中执行，并带有审查检查点时使用',
  },
  {
    file: 'superpowers/*/skills/finishing-a-development-branch/SKILL.md',
    find: 'Use when implementation is complete, tests pass, and you need to decide how to integrate the work',
    replace: '当实现完成、所有测试通过，需要决定如何集成工作时使用 — 引导完成开发工作，提供合并、创建 PR 或清理的结构化选项',
  },
  {
    file: 'superpowers/*/skills/receiving-code-review/SKILL.md',
    find: 'Use when receiving code review feedback, before implementing suggestions — especially when feedback is ambiguous or technically questionable',
    replace: '当收到代码审查反馈、在实施建议之前使用，尤其当反馈不明确或技术上有疑问时 — 需要技术严谨性和验证，而非敷衍同意或盲目实施',
  },
  {
    file: 'superpowers/*/skills/requesting-code-review/SKILL.md',
    find: 'Use when finishing a task, implementing a major feature, or validating work meets requirements before merging',
    replace: '当完成任务、实现主要功能或在合并之前验证工作是否满足需求时使用',
  },
  {
    file: 'superpowers/*/skills/subagent-driven-development/SKILL.md',
    find: 'Use when executing an implementation plan with independent tasks in the current session',
    replace: '当在当前会话中执行包含独立任务的实施计划时使用',
  },
  {
    file: 'superpowers/*/skills/systematic-debugging/SKILL.md',
    find: 'Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes',
    replace: '当遇到任何 bug、测试失败或意外行为时，在提出修复方案之前使用',
  },
  {
    file: 'superpowers/*/skills/test-driven-development/SKILL.md',
    find: 'Use when implementing any feature or fixing a bug, before writing implementation code',
    replace: '当实现任何功能或修复 bug 时，在编写实现代码之前使用',
  },
  {
    file: 'superpowers/*/skills/using-git-worktrees/SKILL.md',
    find: 'Use when starting feature development that needs isolation from the current workspace',
    replace: '当开始需要与当前工作区隔离的功能开发，或在执行实施计划之前使用 — 创建隔离的 git worktree，智能选择目录并进行安全验证',
  },
  {
    file: 'superpowers/*/skills/using-superpowers/SKILL.md',
    find: 'Use when starting any conversation — establishes how to find and use skills',
    replace: '当开始任何对话时使用 — 建立如何查找和使用技能的规范，要求在任何响应（包括澄清问题）之前调用 Skill 工具',
  },
  {
    file: 'superpowers/*/skills/verification-before-completion/SKILL.md',
    find: 'Use when about to claim work is done, fixed, or passing — before committing or creating a PR',
    replace: '当准备声称工作已完成、已修复或已通过时，在提交或创建 PR 之前使用 — 要求在做出任何成功声明之前运行验证命令并确认输出；始终先有证据再下结论',
  },
  {
    file: 'superpowers/*/skills/writing-plans/SKILL.md',
    find: 'Use when you have specs or requirements for a multi-step task, before writing code',
    replace: '当有多步骤任务的规格或需求时，在编写代码之前使用',
  },
  {
    file: 'superpowers/*/skills/writing-skills/SKILL.md',
    find: 'Use when creating new skills, editing existing skills, or verifying skills work correctly before deploying',
    replace: '当创建新技能、编辑现有技能或在部署前验证技能是否正常工作时使用',
  },

  // --- document-skills (通用模板) ---
  {
    file: 'document-skills/*/skills/algorithmic-art/SKILL.md',
    find: 'Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems.',
    replace: '使用 p5.js 创建带有种子随机性和交互式参数探索的算法艺术。当用户要求用代码创作艺术、生成艺术、算法艺术、流场或粒子系统时使用。',
  },
  {
    file: 'document-skills/*/skills/brand-guidelines/SKILL.md',
    find: 'Applies Anthropic\'s official brand colors and typography to any sort of artifact that may benefit from having Anthropic\'s look-and-feel.',
    replace: '将 Anthropic 官方品牌颜色和排版应用到任何可能需要 Anthropic 外观风格的作品。当涉及品牌颜色或样式指南、视觉格式或公司设计标准时使用。',
  },
  {
    file: 'document-skills/*/skills/canvas-design/SKILL.md',
    find: 'Create beautiful visual art in .png and .pdf documents using design philosophy.',
    replace: '使用设计理念在 .png 和 .pdf 文档中创建精美的视觉艺术。当用户要求创建海报、艺术作品、设计或其他静态作品时使用。',
  },
  {
    file: 'document-skills/*/skills/claude-api/SKILL.md',
    find: 'Build apps with the Claude API or Anthropic SDK.',
    replace: '使用 Claude API 或 Anthropic SDK 构建应用。',
  },
  {
    file: 'document-skills/*/skills/doc-coauthoring/SKILL.md',
    find: 'Guide users through a structured workflow for co-authoring documentation.',
    replace: '引导用户通过结构化工作流共同撰写文档。当用户想编写文档、提案、技术规格、决策文档或类似结构化内容时使用。',
  },
  {
    file: 'document-skills/*/skills/docx/SKILL.md',
    find: 'Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files).',
    replace: '当用户想要创建、读取、编辑或操作 Word 文档（.docx 文件）时使用此技能。',
  },
  {
    file: 'document-skills/*/skills/frontend-design/SKILL.md',
    find: 'Create distinctive, production-grade frontend interfaces with high design quality.',
    replace: '创建独特的、生产级前端界面，具有高设计质量。当用户要求构建网页组件、页面或应用程序时使用。生成创意、精致的代码，避免千篇一律的 AI 美学。',
  },
  {
    file: 'document-skills/*/skills/internal-comms/SKILL.md',
    find: 'A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use.',
    replace: '一套帮助编写各种内部沟通内容的资源，使用公司偏好的格式。当被要求编写某种内部沟通内容（状态报告、管理层更新、第三方更新、公司通讯、FAQ、事件报告、项目更新等）时使用此技能。',
  },
  {
    file: 'document-skills/*/skills/mcp-builder/SKILL.md',
    find: 'Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools.',
    replace: '创建高质量 MCP（模型上下文协议）服务器的指南，使 LLM 能够通过精心设计的工具与外部服务交互。当构建 MCP 服务器以集成外部 API 或服务时使用。',
  },
  {
    file: 'document-skills/*/skills/pdf/SKILL.md',
    find: 'Use this skill whenever the user wants to do anything with PDF files.',
    replace: '当用户想要对 PDF 文件进行任何操作时使用此技能。包括读取或提取 PDF 中的文本/表格、合并多个 PDF、拆分 PDF、旋转页面、添加水印、创建新 PDF 等。',
  },
  {
    file: 'document-skills/*/skills/pptx/SKILL.md',
    find: 'Use this skill any time a .pptx file is involved in any way — as input, output, or both.',
    replace: '任何时候涉及 .pptx 文件（作为输入、输出或两者）时使用此技能。包括创建幻灯片、演示文稿或宣讲稿；读取、解析或提取文本等。',
  },
  {
    file: 'document-skills/*/skills/skill-creator/SKILL.md',
    find: 'Create new skills, modify and improve existing skills, and measure skill performance.',
    replace: '创建新技能、修改和改进现有技能，并衡量技能性能。当用户想从头创建技能、编辑或优化现有技能、运行评估测试技能时使用。',
  },
  {
    file: 'document-skills/*/skills/theme-factory/SKILL.md',
    find: 'Toolkit for styling artifacts with a theme.',
    replace: '用主题为作品设置样式的工具包。作品可以是幻灯片、文档、报告、HTML 着陆页等。有 10 个预设主题（含颜色/字体），可应用于任何已创建的作品，也可即时生成新主题。',
  },
  {
    file: 'document-skills/*/skills/web-artifacts-builder/SKILL.md',
    find: 'Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui).',
    replace: '使用现代前端 Web 技术（React、Tailwind CSS、shadcn/ui）创建复杂的多组件 claude.ai HTML 制品的工具套件。用于需要状态管理、路由或 shadcn/ui 组件的复杂制品。',
  },
  {
    file: 'document-skills/*/skills/webapp-testing/SKILL.md',
    find: 'Toolkit for interacting with and testing local web applications using Playwright.',
    replace: '使用 Playwright 与本地 Web 应用交互和测试的工具包。支持验证前端功能、调试 UI 行为、捕获浏览器截图和查看浏览器日志。',
  },
  {
    file: 'document-skills/*/skills/xlsx/SKILL.md',
    find: 'Use this skill any time a spreadsheet file is the primary input or output.',
    replace: '任何时候电子表格文件是主要输入或输出时使用此技能。包括打开、读取、编辑或修复现有的 .xlsx、.xlsm、.csv 或 .tsv 文件等。',
  },

  // --- codex ---
  {
    file: 'codex/*/skills/codex-cli-runtime/SKILL.md',
    find: 'Internal helper contract for calling the codex-companion runtime from Claude Code',
    replace: '从 Claude Code 调用 codex-companion 运行时的内部辅助契约',
  },
  {
    file: 'codex/*/skills/codex-result-handling/SKILL.md',
    find: 'Internal guidance for presenting Codex helper output back to the user',
    replace: '向用户呈现 Codex 辅助输出的内部指引',
  },
  {
    file: 'codex/*/skills/gpt-5-4-prompting/SKILL.md',
    find: 'Internal guidance for composing Codex and GPT-5.4 prompts for coding, review, diagnosis, and research tasks inside the Codex Claude Code plugin',
    replace: '在 Codex Claude Code 插件中为编码、审查、诊断和研究任务编写 Codex 和 GPT-5.4 提示词的内部指引',
  },

  // --- codex commands ---
  {
    file: 'codex/*/commands/adversarial-review.md',
    find: 'Run Codex adversarial review, challenging implementation and design decisions',
    replace: '运行 Codex 对抗性审查，质疑实现方案和设计决策',
  },
  {
    file: 'codex/*/commands/cancel.md',
    find: 'Cancel active background Codex tasks for this repo',
    replace: '取消此仓库中活跃的后台 Codex 任务',
  },
  {
    file: 'codex/*/commands/rescue.md',
    find: 'Delegate investigation, an explicit fix request, or follow-up rescue work to the Codex rescue subagent',
    replace: '将调查、修复请求或后续救援工作委托给 Codex 救援子代理',
  },
  {
    file: 'codex/*/commands/result.md',
    find: 'Show final output of a completed Codex task for this repo',
    replace: '显示此仓库中已完成 Codex 任务的最终输出',
  },
  {
    file: 'codex/*/commands/review.md',
    find: 'Run Codex code review on local git state',
    replace: '对本地 git 状态运行 Codex 代码审查',
  },
  {
    file: 'codex/*/commands/setup.md',
    find: 'Check whether the local Codex CLI is ready and optionally toggle the stop-time review gate',
    replace: '检查本地 Codex CLI 是否就绪，可选切换停止时的审查门控',
  },
  {
    file: 'codex/*/commands/status.md',
    find: 'Show active and recent Codex tasks for the current repo, including review gate status',
    replace: '显示当前仓库中活跃和近期的 Codex 任务，包括审查门控状态',
  },
];

// ========== 本地技能汉化 ==========
const localSkills = [
  {
    dir: path.join(CLAUDE_DIR, 'skills', 'frontend-design'),
    find: 'Create distinctive, production-grade frontend interfaces with high design quality.',
    replace: '创建独特的、生产级前端界面，具有高设计质量。当用户要求构建网页组件、页面、制品、海报或应用程序时使用。生成创意、精致的代码和 UI 设计，避免千篇一律的 AI 美学。',
  },
];

// ========== cc-switch 技能汉化 ==========
const ccSwitchSkills = [
  {
    dir: path.join(os.homedir(), '.cc-switch', 'skills', 'agent-reach'),
    find: 'Give your AI agent eyes to see the entire internet. Install and configure',
    replace: '为你的 AI Agent 赋予全互联网访问能力。安装并配置',
  },
  {
    dir: path.join(os.homedir(), '.cc-switch', 'skills', 'unified-workflow-main'),
    find: 'Use when starting any development work to route between GSD (project management) and Superpowers (engineering discipline) systems.',
    replace: '在开始任何开发工作时使用，用于在 GSD（项目管理）和 Superpowers（工程规范）系统之间进行路由。',
  },
];

// ========== Glob 匹配 ==========
function globMatch(baseDir, pattern) {
  // 支持 cache/plugin-name/*/path 格式
  const parts = pattern.split('/');
  const results = [];

  function walk(dir, patternParts, currentPath) {
    if (patternParts.length === 0) {
      if (fs.existsSync(dir)) results.push(dir);
      return;
    }

    const part = patternParts[0];
    const rest = patternParts.slice(1);

    if (part === '*') {
      // 匹配一个目录层级（版本号）
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            walk(path.join(dir, entry.name), rest, path.join(currentPath, entry.name));
          }
        }
      } catch (e) { /* 忽略不存在的目录 */ }
    } else {
      walk(path.join(dir, part), rest, path.join(currentPath, part));
    }
  }

  walk(baseDir, parts, '');
  return results;
}

// ========== 替换描述 ==========
function replaceDescription(filePath, findStr, replaceStr) {
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes(findStr)) return false;

  content = content.replace(findStr, replaceStr);
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

// ========== 主流程 ==========
function main() {
  console.log(`${MAGENTA}==============================================${NC}`);
  console.log(`${MAGENTA}  Claude Code 插件汉化${NC}`);
  console.log(`${MAGENTA}==============================================${NC}`);
  console.log('');

  let totalPatched = 0;
  let totalSkipped = 0;

  // 1. 插件缓存汉化
  const marketplaces = fs.readdirSync(CACHE_DIR).filter(d => {
    try { return fs.statSync(path.join(CACHE_DIR, d)).isDirectory(); } catch { return false; }
  });

  for (const marketplace of marketplaces) {
    const marketplaceDir = path.join(CACHE_DIR, marketplace);
    const plugins = fs.readdirSync(marketplaceDir).filter(d => {
      try { return fs.statSync(path.join(marketplaceDir, d)).isDirectory(); } catch { return false; }
    });

    for (const plugin of plugins) {
      const pluginDir = path.join(marketplaceDir, plugin);

      for (const t of translations) {
        if (!t.file.startsWith(plugin + '/')) continue;

        // 去掉插件名前缀，得到 */path
        const relPattern = t.file.substring(plugin.length + 1);
        const matchedFiles = globMatch(pluginDir, relPattern);

        for (const filePath of matchedFiles) {
          if (replaceDescription(filePath, t.find, t.replace)) {
            console.log(`  ${GREEN}+${NC} ${path.relative(CACHE_DIR, filePath)}`);
            totalPatched++;
          } else {
            totalSkipped++;
          }
        }
      }
    }
  }

  // 2. 本地技能汉化
  for (const skill of localSkills) {
    const skillFile = path.join(skill.dir, 'SKILL.md');
    if (replaceDescription(skillFile, skill.find, skill.replace)) {
      console.log(`  ${GREEN}+${NC} ${path.relative(CLAUDE_DIR, skillFile)}`);
      totalPatched++;
    } else {
      totalSkipped++;
    }
  }

  // 3. cc-switch 技能汉化
  for (const skill of ccSwitchSkills) {
    const skillFile = path.join(skill.dir, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      if (replaceDescription(skillFile, skill.find, skill.replace)) {
        console.log(`  ${GREEN}+${NC} ${skillFile.replace(os.homedir(), '~')}`);
        totalPatched++;
      } else {
        totalSkipped++;
      }
    }
  }

  console.log('');
  console.log(`${MAGENTA}插件汉化完成! ${totalPatched} 处已替换${totalSkipped > 0 ? `，${totalSkipped} 处已跳过（无需更新）` : ''}${NC}`);
  console.log(`${YELLOW}请重启 Claude Code 使所有更改生效${NC}`);
}

if (require.main === module) {
  main();
}

module.exports = { translations, localSkills, ccSwitchSkills, main };
