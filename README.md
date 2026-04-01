# Claude Code CN Plus

Claude Code 中文汉化增强包 — 一键安装，全面汉化，自动维护。

在 [cute-claude-hooks](https://github.com/gugug168/cute-claude-hooks) 基础上扩展，提供更完整的汉化覆盖。

## 功能

| 功能 | 说明 |
|------|------|
| CLI 界面汉化 | 配置面板、斜杠命令描述、快捷键提示、交互按钮等（~188 条关键词 + 57 条 UI） |
| 插件技能汉化 | superpowers、codex、document-skills 等 52+ 个插件技能/命令描述 |
| Translation Memory | 翻译记忆库独立存储，插件更新后自动恢复翻译，不再丢失 |
| 自动汉化 Hook | 检测插件/CLI 版本变化，自动重新汉化，无需手动干预 |
| 工具提示 | 每次工具执行后显示中文解释（小白友好） |
| 语言配置 | 自动设置 AI 使用中文回复 |
| 一键安装/卸载 | 自动检测环境，备份恢复 |

## 前提条件

- [Node.js](https://nodejs.org/) (v18+)
- Claude Code **npm 全局安装版本**

```bash
# 如果使用独立版 (standalone)，需要额外安装 npm 版本
npm install -g @anthropic-ai/claude-code
# 两个版本可以共存
```

## 快速安装

```bash
# 方式 1: 克隆仓库
git clone https://github.com/Gdenian/claude-code-cn-plus.git
cd claude-code-cn-plus
bash install.sh

# 方式 2: 一行命令安装 (curl)
curl -fsSL https://raw.githubusercontent.com/Gdenian/claude-code-cn-plus/main/install.sh | bash
```

安装完成后**重启 Claude Code** 即可看到中文界面。

## 卸载

```bash
cd claude-code-cn-plus
bash uninstall.sh
```

## Claude Code 更新后

Claude Code 或插件更新后汉化会失效，有两种方式恢复：

**方式 1：自动（推荐）**

安装后已注册自动检测 Hook，新会话首次使用时自动检测版本变化并重新汉化。

**方式 2：手动**

```bash
cd claude-code-cn-plus
bash install.sh
```

## 项目结构

```
claude-code-cn-plus/
├── install.sh                   # 一键安装脚本（6 步流程）
├── uninstall.sh                 # 卸载脚本
├── localize/
│   ├── localize.js              # CLI 汉化引擎（基于 cute-claude-hooks）
│   ├── keyword.js               # CLI 关键词翻译字典（~188 条）
│   ├── extra-ui.js              # 额外安全 UI 翻译（~57 条）
│   ├── localize-plugins.js      # 插件汉化引擎 v3（Translation Memory）
│   ├── translation-memory.json  # 翻译记忆库（独立于插件文件）
│   └── auto-localize.js         # 版本检测 + 自动汉化引擎
├── hooks/
│   ├── tool-tips-post.sh        # 工具执行后中文提示
│   └── auto-localize.sh         # 自动汉化 Hook（三层回退策略）
└── docs/
    └── lessons-learned.md       # 开发踩坑记录
```

## 汉化原理

### CLI 汉化

Claude Code 的 npm 版本将所有 UI 文本打包在 `cli.js` 中。通过字符串替换实现汉化：

1. **备份** — 首次运行时创建 `cli.bak.js` 备份
2. **关键词替换** — 用 `keyword.js` 字典匹配 UI 字符串并替换为中文
3. **额外 UI 替换** — 用 `extra-ui.js` 替换交互界面中的按钮、标签等
4. **恢复基准** — 每次运行先从备份恢复，确保基于原始英文替换

### 插件汉化（Translation Memory 架构）

v3 采用 Translation Memory 架构，翻译结果持久化存储在 `translation-memory.json` 中，与插件文件解耦合：

1. **扫描** — 自动扫描所有已安装插件的 SKILL.md 和 command.md
2. **匹配** — 用 `name` 字段（跨版本稳定）查找翻译记忆库
3. **替换** — 安全转义后写入 frontmatter 的 `description` 字段
4. **恢复** — 插件更新覆盖文件后，自动从记忆库恢复翻译

新增翻译只需编辑 `translation-memory.json`，无需修改代码。

### 自动汉化

通过 PostToolUse Hook 实现：
1. 每个会话首次使用 Bash 工具时触发检测
2. 对比 `localize-manifest.json` 中记录的版本与当前版本
3. 版本变化时自动运行汉化脚本并更新清单
4. 后台执行，不阻塞正常使用

## 汉化覆盖范围

| 类别 | 覆盖数 | 示例 |
|------|--------|------|
| CLI 配置面板 | ~40 条 | "主题" "模型" "输出风格" |
| CLI 斜杠命令 | ~62 条 | "/compact" "/config" "/insights" "/statusline" |
| CLI 交互提示 | ~50 条 | "Enter 确认 · Esc 取消" |
| CLI 额外 UI | ~57 条 | "不再询问" "保存到文件" |
| 插件技能/命令描述 | 52+ 条 | superpowers、codex、document-skills 等 |
| **总计** | **~570+ 处替换** | |

## 安全原则

我们踩过很多坑才总结出这些原则（详见 [docs/lessons-learned.md](docs/lessons-learned.md)）：

- **不翻译短字符串** — `"None"`, `"Default"` 等会出现在代码逻辑中，替换会破坏运行
- **不翻译非 UI 上下文字符串** — 如 `"Do you want to proceed?"` 在代码中有非 UI 用途
- **不翻译插件正文内容** — SKILL.md 正文是 Claude 的行为指令，翻译会导致理解偏差
- **使用 `str.replace()` 而非位置替换** — 正则位置替换在多次匹配时会产生偏移错乱
- **逐个测试每条翻译** — 每新增一条翻译都要验证 cli.js 仍能正常运行

## 致谢

- [cute-claude-hooks](https://github.com/gugug168/cute-claude-hooks) — 汉化引擎和工具提示的基础实现
- [mine-auto-cli](https://github.com/NanjingYes/my-auto-cli) — 全局替换策略的灵感来源

## License

MIT
