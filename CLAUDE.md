# claude-code-cn-plus 开发指南

## 架构

- `bin/cccn.js` 是主 CLI 入口。
- `src/installer.js` 负责 install / uninstall / restore 的调度。
- `src/native-patcher.js` 适配 `tweakcc@4.0.13`，native 优先，API 不可用时回退到 `adhoc-patch`。
- `src/legacy-patcher.js` 负责旧版 `cli.js` 备份、替换和恢复。
- `src/plugin-localizer.js` 负责 Translation Memory 和 frontmatter `description` 汉化。
- `src/hooks-manager.js`、`src/settings.js`、`src/auto-localize.js` 负责 hooks、语言配置和自动维护。

## 开发注意事项

- 新增翻译优先改 `localize/translation-memory.json`，不要把正文翻译进 SKILL.md。
- native patch 失败必须回滚，install 仍要尽量完成 hooks、插件和语言配置。
- `settings.json` 解析失败要直接报错，不要静默跳过。
- `npm test` 使用 `node:test`，`npm run check` 负责语法检查。

## 语言

- 所有对话和文档使用中文
- 代码注释尽量简短，保持和现有风格一致
