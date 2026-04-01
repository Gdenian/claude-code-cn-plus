# claude-code-cn-plus 开发指南

## 架构

- CLI 汉化：`localize.js` 从 `cli.bak.js` 恢复基准，再用 `keyword.js` + `extra-ui.js` 字符串替换
- 插件汉化（v3 Translation Memory）：`localize-plugins.js` 读取 `translation-memory.json`，按 `name` 字段匹配并替换 `description`
- 自动维护：`auto-localize.sh` hook → `auto-localize.js` 版本检测 → 调用汉化脚本

## 关键数据流

- `~/.claude/plugins/marketplaces/` = 原始英文文件（只读）
- `~/.claude/plugins/cache/` = 运行时缓存（翻译写入这里）
- 插件更新时 marketplaces 覆盖 cache → 翻译丢失 → auto-localize hook 从 translation-memory.json 恢复
- `~/.claude/localize-install-path` = hook 定位 localize 目录的唯一可靠路径
- `~/.claude/localize-manifest.json` = 版本清单，仅汉化成功后才更新

## 开发注意事项

- 新增翻译编辑 `localize/translation-memory.json`，不需要改 JS 代码
- frontmatter description 含双引号时已由 `escapeYamlValue` 自动处理
- `auto-localize.js` 中 `saveManifest` 在汉化成功后才调用（失败会下次重试）
- 运行汉化测试：`cd localize && node localize-plugins.js`
- 模拟插件更新恢复：从 `~/.claude/plugins/marketplaces/` 复制文件到 cache/ 后重新运行
- pua-en / pua-ja 变体故意保持英文，不需要翻译

## 语言

- 所有对话和文档使用中文
- 代码注释使用中文
- commit message 使用中文或英文均可
