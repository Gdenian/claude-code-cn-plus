# Claude Code CN Plus

Claude Code 中文汉化增强包 — 一键安装，全面汉化。

在 [cute-claude-hooks](https://github.com/gugug168/cute-claude-hooks) 基础上扩展，提供更完整的汉化覆盖。

## 功能

| 功能 | 说明 |
|------|------|
| 界面汉化 | 配置面板、斜杠命令描述、快捷键提示、交互按钮等 |
| 额外 UI 汉化 | 计划模式、权限对话框、插件推荐等交互界面 |
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

Claude Code 更新后汉化会失效，重新运行即可：

```bash
cd claude-code-cn-plus
bash install.sh
```

## 项目结构

```
claude-code-cn-plus/
├── install.sh                   # 一键安装脚本
├── uninstall.sh                 # 卸载脚本
├── localize/
│   ├── localize.js              # 汉化引擎（基于 cute-claude-hooks）
│   ├── keyword.js               # 关键词翻译字典（~160 条）
│   └── extra-ui.js              # 额外安全 UI 翻译（~50 条）
├── hooks/
│   └── tool-tips-post.sh        # 工具执行后中文提示
└── docs/
    └── lessons-learned.md       # 开发踩坑记录
```

## 汉化原理

Claude Code 的 npm 版本将所有 UI 文本打包在 `cli.js` 中。本项目通过字符串替换实现汉化：

1. **备份** — 首次运行时创建 `cli.bak.js` 备份
2. **关键词替换** — 用 `keyword.js` 字典匹配 UI 字符串并替换为中文
3. **额外 UI 替换** — 用 `extra-ui.js` 替换交互界面中的按钮、标签等
4. **恢复基准** — 每次运行先从备份恢复，确保基于原始英文替换

## 安全原则

我们踩过很多坑才总结出这些原则（详见 [docs/lessons-learned.md](docs/lessons-learned.md)）：

- **不翻译短字符串** — `"None"`, `"Default"` 等会出现在代码逻辑中，替换会破坏运行
- **不翻译非 UI 上下文字符串** — 如 `"Do you want to proceed?"` 在代码中有非 UI 用途
- **使用 `str.replace()` 而非位置替换** — 正则位置替换在多次匹配时会产生偏移错乱
- **逐个测试每条翻译** — 每新增一条翻译都要验证 cli.js 仍能正常运行

## 致谢

- [cute-claude-hooks](https://github.com/gugug168/cute-claude-hooks) — 汉化引擎和工具提示的基础实现
- [mine-auto-cli](https://github.com/NanjingYes/my-auto-cli) — 全局替换策略的灵感来源

## License

MIT
