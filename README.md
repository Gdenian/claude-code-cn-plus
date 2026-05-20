<h1 align="center">Claude Code CN Plus</h1>

<p align="center">
  <strong>Claude Code 中文汉化增强包</strong>
</p>

<p align="center">
  <a href="#最快安装">快速安装</a>
  ·
  <a href="#你会得到什么">功能亮点</a>
  ·
  <a href="#常见问题">常见问题</a>
  ·
  <a href="#给开发者">开发者说明</a>
</p>

<p align="center">
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933">
  <img alt="三端可用" src="https://img.shields.io/badge/%E4%B8%89%E7%AB%AF%E5%8F%AF%E7%94%A8-macOS%20%7C%20Linux%20%7C%20Windows-2563eb">
  <img alt="中文体验" src="https://img.shields.io/badge/%E4%B8%AD%E6%96%87%E4%BD%93%E9%AA%8C-%E5%BC%80%E7%AE%B1%E5%8D%B3%E7%94%A8-d946ef">
  <img alt="License MIT" src="https://img.shields.io/badge/License-MIT-111827">
</p>

> 让 Claude Code 对中文用户更友好：界面说明、按钮提示、插件描述、工具提示尽量变成中文，并让 Claude 默认用中文回复。

它不是另一个 Claude Code，而是在你已经安装好的 Claude Code 上加一层中文体验。安装完成后，你仍然使用原来的 Claude Code，只是更容易看懂、更容易上手。

## 核心亮点

| 亮点 | 对你有什么用 |
|------|--------------|
| 三端可用 | 支持 macOS、Linux、Windows 终端环境；Windows 推荐使用 WSL 或 Git Bash |
| 一键安装 | 复制一条命令就能安装，也可以直接让 Claude Code 帮你操作 |
| 中文优先 | 常见界面、命令说明、插件描述、工具提示都会尽量中文化 |
| 自动维护 | Claude Code 或插件更新后，会自动检查是否需要重新汉化 |
| 可恢复 | 安装前会备份，想卸载时可以尽量恢复原版 Claude Code |

适合这些用户：

- 刚开始用 Claude Code，不想被英文界面劝退
- 能复制命令，但不想研究复杂配置
- 希望 Claude Code 更新后，中文能力能自动恢复
- 想保留原版 Claude Code，必要时可以一键恢复

## 最快安装

### 方式 1：让 Claude Code 帮你安装（推荐）

如果你已经能打开 Claude Code，我们更推荐你直接把这个仓库链接复制给它：

```text
https://github.com/Gdenian/claude-code-cn-plus
```

然后对 Claude Code 说：

```text
请帮我安装这个 Claude Code 中文增强包。
仓库地址：https://github.com/Gdenian/claude-code-cn-plus

请你先检查我的 Node.js 版本是否满足要求，然后按照 README 完成安装。
安装完成后，请运行 doctor 检查是否成功。
如果中间报错，请用中文告诉我原因和下一步该怎么做。
```

这样你不用自己判断命令该怎么输，Claude Code 会帮你完成检查、安装和排错。

### 方式 2：自己复制命令一键安装

打开终端，复制下面这行命令执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Gdenian/claude-code-cn-plus/main/install.sh | bash
```

看到 `安装完成` 后，重启 Claude Code。

如果你不确定有没有安装成功，可以运行：

```bash
node ~/.claude-code-cn-plus/bin/cccn.js doctor
```

其中 `OK` 表示正常，`missing` 表示对应项目还没找到或还没安装。

## 安装前准备

一般只需要确认两件事：

1. 你的电脑已经能正常打开 Claude Code。
2. 你的电脑已经安装 Node.js 20 或更高版本。

Claude Code 官方 npm 包要求 Node.js 18+；本增强包因为补丁依赖需要 Node.js 20+。

macOS 和 Linux 用户可以直接在系统终端执行安装命令。Windows 用户建议在 WSL 或 Git Bash 里执行安装命令。

不知道 Node.js 有没有装，可以在终端输入：

```bash
node -v
```

如果显示 `v20` 或更高版本号，就可以继续。

如果提示找不到命令，或版本低于 20，请先安装新版 Node.js。

## 你会得到什么

| 能力 | 说明 |
|------|------|
| 界面汉化 | 配置面板、斜杠命令、按钮、提示语等改成中文 |
| 插件说明汉化 | 把插件和技能的描述改成中文，更容易知道该用哪个能力 |
| 工具提示 | Claude Code 执行工具后，用中文解释刚刚发生了什么 |
| 默认中文回复 | 自动写入语言配置，让 Claude 优先用中文回答 |
| 缺失翻译补全 | 新插件没覆盖时，可让 Claude Code 主动补全本机翻译缓存 |
| 三端可用 | macOS、Linux、Windows 终端环境都可以使用 |
| 自动维护 | Claude Code 或插件更新后，自动检查是否需要重新汉化 |
| 可恢复 | 安装前会备份，想卸载或恢复原版时可以撤回 |

## 常用命令

大多数用户只需要记住这几条：

```bash
# 检查安装状态
node ~/.claude-code-cn-plus/bin/cccn.js doctor

# 扫描还有哪些插件、技能、命令描述没汉化
node ~/.claude-code-cn-plus/bin/cccn.js scan-missing

# 应用 Claude Code 生成的本地翻译缓存
node ~/.claude-code-cn-plus/bin/cccn.js apply-generated-translations

# 重新安装或重新汉化
node ~/.claude-code-cn-plus/bin/cccn.js install --yes

# 卸载，并尽量恢复原版 Claude Code
node ~/.claude-code-cn-plus/bin/cccn.js uninstall --yes

# 只恢复 Claude Code CLI，不移除其他配置
node ~/.claude-code-cn-plus/bin/cccn.js restore
```

如果你是克隆源码后安装的，也可以在项目目录里运行：

```bash
bash install.sh
bash uninstall.sh
```

## Claude Code 更新后怎么办

Claude Code 或插件更新后，部分中文可能会变回英文。

正常情况下不用管。安装器会注册自动维护 hook，新会话里第一次使用 Bash 工具时，会检查版本变化并尝试重新汉化。

如果你想立刻修复，可以手动运行：

```bash
node ~/.claude-code-cn-plus/bin/cccn.js install --yes
```

## 新插件没有汉化怎么办

本项目内置常见插件、技能和命令的稳定翻译包。你安装新插件后，如果仍然看到英文描述，可以先运行：

```bash
node ~/.claude-code-cn-plus/bin/cccn.js doctor
```

如果提示还有缺失翻译，请在 Claude Code 里运行：

```text
/cccn-localize-missing
```

这个命令会让 Claude Code 做 3 件事：

1. 读取本机缺失清单。
2. 把缺失的英文 `description` 翻译成中文。
3. 写入本地缓存并自动应用。

生成结果只保存在你的本机，默认路径是：

```text
~/.claude/localize-generated-translations.json
```

缺失清单默认保存在：

```text
~/.claude/localize-missing-translations.json
```

本项目不会在后台静默调用 Claude Code 或任何模型。只有你主动运行 `/cccn-localize-missing` 时，才会让 Claude Code 参与补全。

## 常见问题

### 安装后还是英文

先重启 Claude Code。

如果还是英文，运行检查命令：

```bash
node ~/.claude-code-cn-plus/bin/cccn.js doctor
```

再手动重新汉化：

```bash
node ~/.claude-code-cn-plus/bin/cccn.js install --yes
```

### 提示 Node.js 版本太低

本项目需要 Node.js 20+。请升级 Node.js 后再执行安装命令。

### 我想卸载，恢复原来的 Claude Code

运行：

```bash
node ~/.claude-code-cn-plus/bin/cccn.js uninstall --yes
```

卸载会移除本项目写入的 hook、manifest 和安装路径记录，并尝试恢复安装前备份的 Claude Code CLI。

### 会不会改坏 Claude Code

安装时会先备份，再写入汉化内容。

如果 CLI 汉化失败，会尽量回滚 CLI，并保留语言配置、插件说明汉化、hook 等非 CLI 能力，同时返回失败状态，方便你发现问题。

另外，插件汉化只改 frontmatter 里的 `description` 字段，不翻译 `SKILL.md` 正文。正文是给 Claude 看的行为指令，随便翻译会影响模型理解，所以这里故意不动。

### 会不会偷偷消耗 token

不会。默认安装、doctor、自动维护 hook 都只做本地扫描和本地替换。

只有你在 Claude Code 里主动运行 `/cccn-localize-missing`，才会让 Claude Code 根据缺失清单生成翻译。

## 汉化范围

当前主要覆盖：

| 类别 | 数量 |
|------|------|
| CLI 关键词 | 188 条 |
| 额外 UI 文案 | 51 条 |
| 插件和技能描述 | 52 条 |

覆盖内容包括配置面板、斜杠命令、交互按钮、权限提示、插件技能说明、工具执行提示等。

如果你安装了新的插件或自定义 skill，内置翻译包可能还没有覆盖。可以运行 `/cccn-localize-missing` 生成本机补全翻译。

## 它是怎么工作的

简单说，安装器会做 6 件事：

1. 找到你电脑上的 Claude Code 安装位置。
2. 备份原文件，然后把已确认安全的英文 UI 文案替换成中文。
3. 扫描已安装插件，只汉化插件描述，不改插件正文。
4. 写入中文语言配置，让 Claude 默认使用中文回复。
5. 安装 `/cccn-localize-missing`，用于缺失翻译的主动补全。
6. 注册自动维护 hook，更新后自动检查是否需要重新汉化。

新版 native Claude Code 会优先通过 `tweakcc@4.0.13` 处理。旧版 npm `cli.js` 会继续走备份加字符串替换的兼容方案。

## 安全原则

本项目不会追求“所有英文都替换”。为了不破坏 Claude Code，本项目遵守这些规则：

- 不翻译太短、容易被代码逻辑使用的字符串，比如 `None`、`Default`
- 不翻译插件正文，只翻译描述字段
- 不做模糊替换，只替换翻译表里明确登记过的文本
- 不在后台自动调用模型；缺失翻译需要你主动运行 `/cccn-localize-missing`
- 每次 CLI 汉化前先备份，失败时尽量回滚
- 稳定翻译优先放进 `localize/translation-memory.json`，个人补全翻译放进本机生成缓存

更多踩坑记录见 [docs/lessons-learned.md](docs/lessons-learned.md)。

## 给开发者

本仓库是 `curl` 一键 bootstrap + `cccn` Node CLI 的形态。默认安装到 `~/.claude-code-cn-plus`，源码运行时会直接使用当前仓库。

常用开发命令：

```bash
npm install
npm test
npm run check
```

可选安装参数：

```bash
VERSION=v0.1.0
CHANNEL=stable   # 或 main
INSTALL_DIR=~/.claude-code-cn-plus
DRY_RUN=1
```

主要目录：

```text
bin/cccn.js              CLI 入口
src/                     核心实现
src/hooks/               自动维护和工具提示 hook
localize/                翻译资源和兼容旧入口
hooks/                   兼容旧 hook 包装
install.sh               一键安装脚本
uninstall.sh             卸载脚本
test/                    node:test 测试
```

## 致谢

- [cute-claude-hooks](https://github.com/gugug168/cute-claude-hooks)：早期汉化能力和工具提示的基础参考
- [mine-auto-cli](https://github.com/NanjingYes/my-auto-cli)：全局替换策略的灵感来源

## 许可证

MIT
